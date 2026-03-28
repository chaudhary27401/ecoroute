from pydantic import BaseModel

class DriverCreate(BaseModel):
    name: str
    phone: str
    address: str
    latitude: float
    longitude: float