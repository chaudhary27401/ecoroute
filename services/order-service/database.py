# Import required SQLAlchemy functions
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

# Database connection URL (PostgreSQL) - use environment variable or default to Docker service name
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@postgres:5432/ecoroute")

# Create database engine
engine = create_engine(DATABASE_URL)

# Create session factory (used to interact with DB)
SessionLocal = sessionmaker(bind=engine)

# Base class for models (all tables inherit from this)
Base = declarative_base()