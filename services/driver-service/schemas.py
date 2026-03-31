from pydantic import BaseModel

class DriverCreate(BaseModel):
    name: str
    phone: str
    address: str
    latitude: float
    longitude: float
    
    
# Used by PATCH /{driver_id}/location
class DriverLocation(BaseModel):
    latitude: float
    longitude: float
     