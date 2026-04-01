from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal
import models, schemas
import requests
import json
import os

router = APIRouter(prefix="/orders", tags=["Orders"])

OSRM_BASE_URL = os.getenv("OSRM_BASE_URL", "https://router.project-osrm.org/route/v1/driving")
DRIVER_SVC_URL = os.getenv("DRIVER_SVC_URL", "http://localhost:5002")
ML_OPTIMIZER_URL = os.getenv("ML_OPTIMIZER_URL", "http://localhost:8000")


def get_osrm_route_geometry(locations):
    """locations: [[lat,lon], ...] → [[lat,lon], ...] road polyline, or None on failure."""
    if not locations or len(locations) < 2:
        return None
    coords = ";".join(f"{lon},{lat}" for lat, lon in locations)
    try:
        r = requests.get(
            f"{OSRM_BASE_URL}/{coords}"
            "?overview=simplified&geometries=geojson&steps=false&annotations=false",
            timeout=10,
        )
        r.raise_for_status()
        geo = r.json().get("routes", [{}])[0].get("geometry", {}).get("coordinates", [])
        if isinstance(geo, list) and len(geo) > 1:
            return [[lat, lon] for lon, lat in geo]   # OSRM [lon,lat] → [lat,lon]
    except Exception:
        pass
    return None


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── CREATE ORDER ──────────────────────────────────────────────────────────────
@router.post("/")
def create_order(order: schemas.OrderCreate, db: Session = Depends(get_db)):
    new_order = models.Order(**order.dict())
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    return new_order


# ── GET ALL ORDERS ────────────────────────────────────────────────────────────
@router.get("/")
def get_orders(db: Session = Depends(get_db)):
    return db.query(models.Order).all()


# ── GET UNASSIGNED ORDERS ─────────────────────────────────────────────────────
@router.get("/unassigned")
def get_unassigned(db: Session = Depends(get_db)):
    return db.query(models.Order).filter(models.Order.status == "UNASSIGNED").all()


# ── GET DRIVER ORDERS (SORTED) ────────────────────────────────────────────────
@router.get("/driver/{driver_id}")
def get_driver_orders(driver_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.Order)
        .filter(models.Order.driver_id == driver_id)
        .order_by(models.Order.sequence_order)
        .all()
    )


# ── OPTIMIZE ──────────────────────────────────────────────────────────────────
@router.post("/optimize")
def optimize(db: Session = Depends(get_db)):

    orders = db.query(models.Order).filter(models.Order.status == "UNASSIGNED").all()
    if not orders:
        return {"message": "No orders to optimize"}

    payload = [{"id": o.id, "location": [o.latitude, o.longitude]} for o in orders]

    try:
        driver_response = requests.get(f"{DRIVER_SVC_URL}/drivers/available", timeout=5)
    except requests.exceptions.ConnectionError:
        raise HTTPException(status_code=503, detail="Driver service not reachable")

    if driver_response.status_code != 200:
        raise HTTPException(status_code=502, detail="Driver service returned error")

    drivers = driver_response.json()
    if not drivers:
        return {"message": "No drivers available"}

    num_drivers = min(len(drivers), len(orders))

    try:
        ml_response = requests.post(
            f"{ML_OPTIMIZER_URL}/optimize",
            json={"orders": payload, "num_drivers": num_drivers},
            timeout=60,
        )
    except requests.exceptions.ConnectionError:
        raise HTTPException(status_code=503, detail="ML optimizer not reachable on port 8000")

    if ml_response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"ML service error: {ml_response.text}")

    result     = ml_response.json()
    driver_ids = [d["id"] for d in drivers]

    clusters = sorted(
        result.items(),
        key=lambda item: int(item[0]) if str(item[0]).lstrip("-").isdigit() else item[0],
    )

    route_geometries = {}

    for idx, (cluster_id, data) in enumerate(clusters):
        if idx >= len(driver_ids):
            break

        driver_id   = driver_ids[idx]
        driver_info = next((d for d in drivers if d.get("id") == driver_id), None)

        if isinstance(data, str):
            try: data = json.loads(data)
            except Exception: data = {}
        if not isinstance(data, dict):
            data = {}

        route = data.get("route") or []
        etas  = data.get("eta")   or []

        if isinstance(route, str):
            try: route = json.loads(route)
            except Exception: route = []
        if isinstance(etas, str):
            try: etas = json.loads(etas)
            except Exception: etas = []

        if not isinstance(route, list): route = []
        if not isinstance(etas,  list): etas  = []

        route_positions = []
        if driver_info and isinstance(driver_info.get("latitude"), (int, float)):
            route_positions.append([driver_info["latitude"], driver_info["longitude"]])
        for stop in route:
            if isinstance(stop, dict):
                loc = stop.get("location")
                if isinstance(loc, list) and len(loc) == 2:
                    route_positions.append(loc)

        if len(route_positions) > 1:
            geo = get_osrm_route_geometry(route_positions) or route_positions
            route_geometries[str(driver_id)] = geo
            route_geometries[driver_id]      = geo

        assigned_any = False
        for r, e in zip(route, etas):
            r = r if isinstance(r, dict) else {}
            e = e if isinstance(e, dict) else {}
            order_id = r.get("order_id")
            if order_id is None:
                continue
            order = db.query(models.Order).filter(models.Order.id == order_id).first()
            if not order:
                continue
            order.driver_id      = driver_id
            order.cluster_id     = int(cluster_id) if str(cluster_id).lstrip("-").isdigit() else None
            order.sequence_order = r.get("stop")
            order.eta            = e.get("minutes_left")
            order.status         = "ASSIGNED"
            assigned_any = True

        if assigned_any:
            try:
                requests.patch(f"{DRIVER_SVC_URL}/drivers/{driver_id}/assign", timeout=5)
            except Exception:
                pass

    db.commit()
    return {"message": "Optimization complete", "geometries": route_geometries}


# ── MARK ORDER DELIVERED ──────────────────────────────────────────────────────
@router.patch("/{order_id}/deliver")
def deliver(order_id: int, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    driver_id = order.driver_id

    # ── Move driver location via driver-service API ───────────────────────────
    # IMPORTANT: order-service's models.py only defines Order — there is no
    # Driver model here. Querying models.Driver would raise AttributeError.
    # The correct microservice approach is to call the driver-service REST API,
    # which owns the drivers table and the Driver model.
    if driver_id and order.latitude is not None and order.longitude is not None:
        try:
            requests.patch(
                f"{DRIVER_SVC_URL}/drivers/{driver_id}/location",
                json={"latitude": order.latitude, "longitude": order.longitude},
                timeout=5,
            )
        except Exception:
            pass  # non-fatal — map pin may lag but delivery still succeeds

    order.status = "DELIVERED"

    # Commit FIRST — the count query below must see the updated status
    db.commit()

    driver_freed = False
    new_geometry = None

    if driver_id:
        remaining_orders = (
            db.query(models.Order)
            .filter(
                models.Order.driver_id == driver_id,
                models.Order.status    != "DELIVERED",
            )
            .order_by(models.Order.sequence_order)
            .all()
        )

        if not remaining_orders:
            # All stops done — free the driver
            driver_freed = True
            try:
                requests.patch(f"{DRIVER_SVC_URL}/drivers/{driver_id}/free", timeout=5)
            except Exception:
                pass
        else:
            # Rebuild OSRM polyline from the driver's new position to remaining stops.
            # Fetch the updated driver location from driver-service (it was just patched above).
            try:
                drv_res = requests.get(f"{DRIVER_SVC_URL}/drivers/", timeout=5)
                driver_list = drv_res.json() if drv_res.status_code == 200 else []
                driver_info = next((d for d in driver_list if d.get("id") == driver_id), None)
            except Exception:
                driver_info = None

            if driver_info and isinstance(driver_info.get("latitude"), (int, float)):
                waypoints = [[driver_info["latitude"], driver_info["longitude"]]]
                waypoints += [[o.latitude, o.longitude] for o in remaining_orders]
                new_geometry = get_osrm_route_geometry(waypoints) or waypoints

    return {
        "message":     "Order delivered",
        "driver_freed": driver_freed,
        "driver_id":   driver_id,
        "new_geometry": new_geometry,
    }