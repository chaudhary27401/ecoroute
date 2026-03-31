# FastAPI router + dependencies
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import SessionLocal
import models, schemas
import requests  # used to call ML service
import json

# Create router
router = APIRouter(prefix="/orders", tags=["Orders"])

OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/driving"


def get_osrm_route_geometry(locations):
    # locations: [[lat,lon], ...]
    if not locations or len(locations) < 2:
        return None

    coordinates = ";".join([f"{lon},{lat}" for [lat, lon] in locations])
    try:
        response = requests.get(
            f"{OSRM_BASE_URL}/{coordinates}?overview=simplified&geometries=geojson&steps=false&annotations=false",
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        geo = data.get("routes", [{}])[0].get("geometry", {}).get("coordinates", [])

        if isinstance(geo, list) and len(geo) > 1:
            # OSRM returns [lon, lat]
            return [[lat, lon] for [lon, lat] in geo]
    except Exception:
        pass

    return None


# Dependency → get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# CREATE ORDER

@router.post("/")
def create_order(order: schemas.OrderCreate, db: Session = Depends(get_db)):
    # Create new order object
    new_order = models.Order(**order.dict())

    # Save to DB
    db.add(new_order)
    db.commit()
    db.refresh(new_order)

    return new_order


# Get all orders
@router.get("/")
def get_orders(db: Session = Depends(get_db)):
    return db.query(models.Order).all()



# GET UNASSIGNED ORDERS

@router.get("/unassigned")
def get_unassigned(db: Session = Depends(get_db)):
    return db.query(models.Order).filter(models.Order.status == "UNASSIGNED").all()



# OPTIMIZE (CALL ML SERVICE)

# THis is our main routes for Optimizing the routes and for clustering .
@router.post("/optimize")
def optimize(db: Session = Depends(get_db)):

    # Step 1: Get unassigned orders
    orders = db.query(models.Order).filter(models.Order.status == "UNASSIGNED").all()

    if not orders:
        return {"message": "No orders to optimize"}

    # Step 2: Prepare payload
    payload = [
        {
            "id": o.id,
            "location": [o.latitude, o.longitude]
        }
        for o in orders
    ]

    # Step 3: Get available drivers
    driver_response = requests.get("http://localhost:5002/drivers/available")

    if driver_response.status_code != 200:
        return {"error": "Driver service not available"}

    drivers = driver_response.json()

    if not drivers:
        return {"message": "No drivers available"}

    num_drivers = min(len(drivers), len(orders))

    # Step 4: Call ML service
    response = requests.post(
        "http://localhost:8000/optimize",
        json={
            "orders": payload,
            "num_drivers": num_drivers
        }
    )

    result = response.json()

    # 🔥 Map real driver IDs
    driver_ids = [d["id"] for d in drivers]

    # Step 5: Assign clusters to drivers
    # ML returns clusters as a dict keyed by cluster_id. Sort keys so cluster->driver
    # mapping is stable (and not based on dict insertion order).
    clusters = list(result.items())

    def sort_key(item):
        k = item[0]
        try:
            return int(k)
        except Exception:
            return str(k)

    clusters.sort(key=sort_key)

    route_geometries = {}

    for idx, (cluster_id, data) in enumerate(clusters):
        if idx >= len(driver_ids):
            break

        driver_id = driver_ids[idx]
        driver_info = next((d for d in drivers if d.get("id") == driver_id), None)

        # Defensive parsing: optimizer response value should be a dict, but
        # in some runs it may arrive as a JSON string.
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except Exception:
                data = {}

        if not isinstance(data, dict):
            data = {}

        route = data.get("route") or []
        etas = data.get("eta") or []

        if isinstance(route, str):
            try:
                route = json.loads(route)
            except Exception:
                route = []

        if isinstance(etas, str):
            try:
                etas = json.loads(etas)
            except Exception:
                etas = []

        if not isinstance(route, list):
            route = []
        if not isinstance(etas, list):
            etas = []

        # Build points sequence for route geometry (driver current position first).
        route_positions = []
        if driver_info and isinstance(driver_info.get("latitude"), (int, float)) and isinstance(driver_info.get("longitude"), (int, float)):
            route_positions.append([driver_info["latitude"], driver_info["longitude"]])

        for stop in route:
            if isinstance(stop, dict):
                loc = stop.get("location")
                if isinstance(loc, list) and len(loc) == 2:
                    route_positions.append([loc[0], loc[1]])

        if len(route_positions) > 1:
            osrm_geometry = get_osrm_route_geometry(route_positions)
            route_geometries[str(driver_id)] = osrm_geometry or route_positions
            route_geometries[driver_id] = route_geometries[str(driver_id)]

        # Only mark driver as assigned if this cluster assigned at least one order.
        assigned_any = False

        for r, e in zip(route, etas):
            const_r = r if isinstance(r, dict) else {}
            const_e = e if isinstance(e, dict) else {}

            order_id = const_r.get("order_id")
            if order_id is None:
                continue

            order = db.query(models.Order).filter(models.Order.id == order_id).first()
            if not order:
                continue

            order.driver_id = driver_id
            try:
                order.cluster_id = int(cluster_id)
            except Exception:
                order.cluster_id = None

            order.sequence_order = const_r.get("stop")
            order.eta = const_e.get("minutes_left")
            order.status = "ASSIGNED"
            assigned_any = True

        if assigned_any:
            requests.patch(f"http://localhost:5002/drivers/{driver_id}/assign")

    db.commit()

    return {
        "message": "Optimization complete",
        "geometries": route_geometries,
    }




# GET DRIVER ORDERS (SORTED)



@router.get("/driver/{driver_id}")
def get_driver_orders(driver_id: int, db: Session = Depends(get_db)):

    # Return orders assigned to driver sorted by sequence
    return db.query(models.Order).filter(
        models.Order.driver_id == driver_id
    ).order_by(models.Order.sequence_order).all()



# MARK ORDER AS DELIVERED

@router.patch("/{order_id}/deliver")
def deliver(order_id: int, db: Session = Depends(get_db)):

    # Find order
    order = db.query(models.Order).filter(models.Order.id == order_id).first()

    if not order:
        return {"error": "Order not found"}

    # Mark as delivered
    order.status = "DELIVERED"

    # 🔥 Check if driver has remaining orders
    remaining_orders = db.query(models.Order).filter(
        models.Order.driver_id == order.driver_id,
        models.Order.status != "DELIVERED"
    ).all()


    # 🔥 If no remaining → free driver
    if not remaining_orders:
        try:
            requests.patch(
                f"http://localhost:5002/drivers/{order.driver_id}/free"
            )
        except:
            print("Driver service not reachable")

    db.commit()

    return {"message": "Order delivered"}