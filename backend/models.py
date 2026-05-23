from sqlalchemy import Column, Integer, String, Float
from database import Base   # ✅ FIXED

class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String)
    severity = Column(String)
    lat = Column(Float)
    lng = Column(Float)
    road_id = Column(Integer)   

class Road(Base):
    __tablename__ = "roads"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    type = Column(String)
    condition = Column(String)

    lastRepaired = Column("lastRepaired", String)  # ✅ FIX

    contractor = Column(String)
    budgetSanctioned = Column(Integer)
    budgetSpent = Column(Integer)

    start_lat = Column(Float)
    start_lng = Column(Float)
    end_lat = Column(Float)
    end_lng = Column(Float)