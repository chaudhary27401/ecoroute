# Import SQLAlchemy column types
from sqlalchemy import Column, Integer, Float, String
from database import Base

# Driver table
class Driver(Base):
    __tablename__ = "drivers"

    # Primary key
    id = Column(Integer, primary_key=True)

    # Driver details
    name = Column(String)
    phone = Column(String)
    address = Column(String)

    # Location (used for routing/assignment)
    latitude = Column(Float)
    longitude = Column(Float)

    # Driver status
    # AVAILABLE → free
    # ASSIGNED → currently delivering
    status = Column(String, default="AVAILABLE")