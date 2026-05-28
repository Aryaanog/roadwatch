from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

# ==================== 1. DEFINE THIS FIRST ====================
class Road(Base):
    __tablename__ = "roads"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    type = Column(String)
    condition = Column(String)

    lastRepaired = Column("lastRepaired", String) 
    contractor = Column(String)
    budgetSanctioned = Column(Float, default=0.0, server_default="0.0")
    budgetSpent = Column(Float, default=0.0, server_default="0.0")

    geometry = Column(Text)  

    # 🌍 Global citizen scaling parameters
    currency_code = Column(String, default="INR", server_default="INR")       
    budget_source = Column(String, default="Public Record Ledger")
    authority_name = Column(String, default="Local Roads Authority")
    authority_email = Column(String, default="community-safety@city.gov")

    # This can safely reference "Complaint" because Python resolves strings dynamically at runtime
    complaints = relationship("Complaint", back_populates="road", cascade="all, delete-orphan")


# ==================== 2. DEFINE THIS SECOND ====================
class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String)
    severity = Column(String)
    lat = Column(Float)
    lng = Column(Float)
    
    # ✅ PostgreSQL can now find "roads.id" successfully!
    road_id = Column(Integer, ForeignKey("roads.id", ondelete="SET NULL"), nullable=True)
    
    road = relationship("Road", back_populates="complaints")