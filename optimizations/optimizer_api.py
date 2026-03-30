from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict

from clustering import cluster_orders
from routing import optimization_using_or
from eta import calculate_eta


class OrderItem(BaseModel):
    id: int
    location: List[float] = Field(..., min_items=2, max_items=2)


class OptimizeRequest(BaseModel):
    orders: List[OrderItem]
    num_drivers: int


app = FastAPI(title="EcoRoute Optimizer", version="1.0")


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok", "service": "optimizer"}


@app.post("/optimize")
def optimize(request: OptimizeRequest):
    if not request.orders:
        raise HTTPException(status_code=400, detail="orders list cannot be empty")

    if request.num_drivers < 1:
        raise HTTPException(status_code=400, detail="num_drivers must be at least 1")

    # Prevent requested drivers from exceeding available orders
    num_drivers = min(request.num_drivers, len(request.orders))

    raw_orders = [order.dict() for order in request.orders]

    try:
        clusters = cluster_orders(raw_orders, num_drivers)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"clustering failed: {exc}")

    optimized = {}
    for driver_id, cluster_orders_list in clusters.items():
        try:
            route = optimization_using_or(cluster_orders_list)
            eta = calculate_eta(route)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"optimization failed for driver {driver_id}: {exc}")

        optimized[str(driver_id)] = {
            "orders": cluster_orders_list,
            "route": route,
            "eta": eta
        }

    return optimized
