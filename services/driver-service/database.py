# Import SQLAlchemy tools
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# PostgreSQL connection string
DATABASE_URL = "postgresql://postgres:password@localhost:5432/ecoroute"

# Create DB engine
engine = create_engine(DATABASE_URL)

# Create session (used to interact with DB)
SessionLocal = sessionmaker(bind=engine)

# Base class for models
Base = declarative_base()