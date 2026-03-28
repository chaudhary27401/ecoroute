# Import required SQLAlchemy functions
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Database connection URL (PostgreSQL)
DATABASE_URL = "postgresql://postgres:password@localhost:5432/ecoroute"

# Create database engine
engine = create_engine(DATABASE_URL)

# Create session factory (used to interact with DB)
SessionLocal = sessionmaker(bind=engine)

# Base class for models (all tables inherit from this)
Base = declarative_base()