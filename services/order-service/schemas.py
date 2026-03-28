# Pydantic models (used for request validation)
from pydantic import BaseModel

# Schema for creating a new order
class OrderCreate(BaseModel):
    order_name: str
    order_size: str
    address: str
    latitude: float
    longitude: float


# Schema for assigning cluster manually (optional)
class AssignClusterRequest(BaseModel):
    driver_id: int
    cluster_id: int
    orders: list[dict]