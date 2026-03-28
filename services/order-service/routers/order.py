# FastAPI router + dependencies
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import SessionLocal
import models, schemas
import requests  # used to call ML service

# Create router
router = APIRouter(prefix="/orders", tags=["Orders"])


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
            "location": (o.latitude, o.longitude)
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
    for idx, (cluster_id, data) in enumerate(result.items()):

        driver_id = driver_ids[idx]

        # 🔥 Mark driver as assigned
        requests.patch(f"http://localhost:5002/drivers/{driver_id}/assign")

        route = data["route"]
        etas = data["eta"]

        for r, e in zip(route, etas):

            order = db.query(models.Order).filter(models.Order.id == r["order_id"]).first()

            if order:
                order.driver_id = driver_id
                order.cluster_id = int(cluster_id)
                order.sequence_order = r["stop"]
                order.eta = e["minutes_left"]
                order.status = "ASSIGNED"

    db.commit()

    return {"message": "Optimization complete"}




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