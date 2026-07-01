from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    profile_picture = Column(Text, nullable=True)
    stencil_usage_count = Column(Integer, default=0, nullable=False)
    stencil_reset_time = Column(DateTime, nullable=True)
    ai_sketch_usage_count = Column(Integer, default=0, nullable=False)
    ai_sketch_reset_time = Column(DateTime, nullable=True)

    # Establish one-to-many relationship with Drawing
    drawings = relationship("Drawing", back_populates="user", cascade="all, delete-orphan")

class Drawing(Base):
    __tablename__ = "drawings"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), nullable=False)
    image_data = Column(Text, nullable=False)  # Base64 data URL
    canvas_mode = Column(String(20), default="2d", nullable=True)
    threed_objects = Column(Text, nullable=True) # JSON representation of 3D objects
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Associate drawing with a specific user
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Establish relationship back to User
    user = relationship("User", back_populates="drawings")

class Setting(Base):
    __tablename__ = "settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=True)
