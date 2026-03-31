from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict

from clustering import cluster_orders
from routing import optimization_using_or
from eta import calculate_eta


class OrderItem(BaseModel):
    id: int
    location: List[float] = Field(..., min_length=2, max_length=2)

    # Pydantic v1 / v2 compatibility
    def to_dict(self):
        try:
            return self.model_dump()   # pydantic v2
        except AttributeError:
            return self.dict()         # pydantic v1


class OptimizeRequest(BaseModel):
    orders: List[OrderItem]
    num_drivers: int


app = FastAPI(title="EcoRoute Optimizer", version="1.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok", "service": "optimizer", "version": "1.1"}


@app.post("/optimize")
def optimize(request: OptimizeRequest):
    if not request.orders:
        raise HTTPException(status_code=400, detail="orders list cannot be empty")
    if request.num_drivers < 1:
        raise HTTPException(status_code=400, detail="num_drivers must be at least 1")

    num_drivers = min(request.num_drivers, len(request.orders))

    # BUG FIX 6: Use compatibility shim instead of bare .dict()
    raw_orders = [o.to_dict() for o in request.orders]

    # Validate order locations early before clustering and calls to OSRM.
    for order in raw_orders:
        if 'location' not in order or not isinstance(order['location'], list) or len(order['location']) != 2:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid order location format for order {order.get('id')}: {order.get('location')}",
            )
        lat, lon = order['location']
        if not (isinstance(lat, (int, float)) and isinstance(lon, (int, float))):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid order location values for order {order.get('id')}: {order.get('location')}",
            )

    try:
        clusters = cluster_orders(raw_orders, num_drivers)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"clustering failed: {exc}")

    optimized = {}
    for driver_id, driver_orders_list in clusters.items():
        try:
            route = optimization_using_or(driver_orders_list)
            eta = calculate_eta(route)
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail=f"optimization failed for driver {driver_id}: {exc}",
            )
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"optimization failed for driver {driver_id}: {exc}",
            )

        optimized[str(driver_id)] = {
            "orders": driver_orders_list,
            "route": route,
            "eta": eta,
        }

    return optimized
