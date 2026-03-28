from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import SessionLocal
import models, schemas

router = APIRouter(prefix="/drivers", tags=["Drivers"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Admin Routes for managing drivers

@router.post("/")
def create_driver(driver: schemas.DriverCreate, db: Session = Depends(get_db)):
    new_driver = models.Driver(**driver.dict())
    db.add(new_driver)
    db.commit()
    db.refresh(new_driver)
    return new_driver

@router.get("/login")
def driver_login(phone: str, db: Session = Depends(get_db)):

    # Find driver by phone
    driver = db.query(models.Driver).filter(models.Driver.phone == phone).first()

    if not driver:
        return {"error": "Driver not found"}

    return driver

@router.get("/")
def get_drivers(db: Session = Depends(get_db)):
    return db.query(models.Driver).all()