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


#fix 1
@router.get("/available")
def get_available_drivers(db: Session = Depends(get_db)):
    return db.query(models.Driver).filter(models.Driver.status == "AVAILABLE").all()

#fix 2
@router.patch("/{driver_id}/assign")
def assign_driver(driver_id: int, db: Session = Depends(get_db)):
    driver = db.query(models.Driver).filter(models.Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    driver.status = "ASSIGNED"
    db.commit()
    db.refresh(driver)
    return driver

#fix 3
@router.patch("/{driver_id}/free")
def free_driver(driver_id: int, db: Session = Depends(get_db)):
    driver = db.query(models.Driver).filter(models.Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    driver.status = "AVAILABLE"
    db.commit()
    db.refresh(driver)
    return driver
