# Import FastAPI
from fastapi import FastAPI

# Import DB and models
import models
from database import engine

# Import router
from routers import driver

# Create DB tables automatically
models.Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(title="Driver Service")

# Include driver routes
app.include_router(driver.router)


# Root endpoint (for testing)
@app.get("/")
def root():
    return {"message": "Driver Service Running 🚀"}