# Import required SQLAlchemy types
from sqlalchemy import Column, Integer, Float, String
from database import Base

# Order table model
class Order(Base):
    __tablename__ = "orders"  # table name

    # Primary key
    id = Column(Integer, primary_key=True, index=True)

    # Basic order details
    order_name = Column(String)
    order_size = Column(String)

    # Address + geo coordinates
    address = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)

    # Order status
    # UNASSIGNED → created
    # ASSIGNED → assigned to driver
    # DELIVERED → completed
    status = Column(String, default="UNASSIGNED")

    # Driver assigned to this order
    driver_id = Column(Integer, nullable=True)

    # ML-related fields
    cluster_id = Column(Integer, nullable=True)      # cluster from ML
    sequence_order = Column(Integer, nullable=True)  # delivery order
    eta = Column(Float, nullable=True)               # estimated time