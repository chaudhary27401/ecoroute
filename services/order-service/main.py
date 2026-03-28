# FastAPI app
from fastapi import FastAPI
import models
from database import engine
from routers import order

# Create tables automatically
models.Base.metadata.create_all(bind=engine)

# Initialize app
app = FastAPI(title="Order Service")

# Include routes
app.include_router(order.router)


# Root endpoint
@app.get("/")
def root():
    return {"message": "Order Service Running 🚀"}