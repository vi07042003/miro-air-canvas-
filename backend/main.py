from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import List, Dict, Optional
import pydantic
import os
import hashlib
import secrets
import hmac
import base64
import json

import database
import models

# Ensure tables are created/updated on startup
database.init_db()

app = FastAPI(title="AeroCanvas API", description="Secure API for drawings and user authentication")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Authentication Security Token setup
security = HTTPBearer()
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "aerocanvas_glowing_liquid_glass_key_2026")

# Utility Hashing Functions
def hash_password(password: str) -> str:
    """Hash password using SHA-256 with PBKDF2."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    )
    return f"{salt}:{key.hex()}"

def verify_password(password: str, hashed_password: str) -> bool:
    """Verify password match against stored hash."""
    try:
        salt, hex_key = hashed_password.split(':')
        key = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            100000
        )
        return hmac.compare_digest(key.hex(), hex_key)
    except Exception:
        return False

# Utility Token (JWT-like HMAC) Functions
def generate_token(username: str, user_id: int) -> str:
    """Generate signed HMAC-SHA256 session token."""
    payload = {
        "username": username,
        "user_id": user_id,
        "exp": os.time() + 86400 * 7 if hasattr(os, 'time') else 1800000000 # Fallback high exp
    }
    # Secure Python fallback for timestamps
    import time
    payload["exp"] = time.time() + 86400 * 7 # 7 days expiry
    
    payload_str = base64.b64encode(json.dumps(payload).encode()).decode()
    signature = hmac.new(SECRET_KEY.encode(), payload_str.encode(), hashlib.sha256).hexdigest()
    return f"{payload_str}.{signature}"

def verify_token(token: str) -> dict:
    """Verify token signature and return payload."""
    try:
        payload_str, signature = token.split('.')
        expected_sig = hmac.new(SECRET_KEY.encode(), payload_str.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected_sig):
            return None
        
        payload = json.loads(base64.b64decode(payload_str.encode()).decode())
        import time
        if payload["exp"] < time.time():
            return None # Expired
        return payload
    except Exception:
        return None

# Dependency to fetch active user from bearer token
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(database.get_db)):
    token = credentials.credentials
    payload = verify_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.query(models.User).filter(models.User.id == payload["user_id"]).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user

# Pydantic Schemas
class UserAuthSchema(pydantic.BaseModel):
    username: str
    password: str

class UserResponseSchema(pydantic.BaseModel):
    id: int
    username: str
    token: str
    profile_picture: Optional[str] = None

class ProfileUpdateSchema(pydantic.BaseModel):
    username: str
    password: Optional[str] = None
    profile_picture: Optional[str] = None

class ProfileResponseSchema(pydantic.BaseModel):
    username: str
    token: str
    profile_picture: Optional[str] = None

class DrawingBase(pydantic.BaseModel):
    title: str
    image_data: str

class DrawingCreate(DrawingBase):
    pass

class DrawingUpdate(DrawingBase):
    pass

class DrawingResponse(DrawingBase):
    id: int
    created_at: str

    class Config:
        from_attributes = True

# --- API Endpoints ---

@app.get("/")
def read_root():
    return {"message": "AeroCanvas Secure API is running!"}

# Authentication Routes
@app.post("/api/auth/register", response_model=UserResponseSchema)
def register(user_in: UserAuthSchema, db: Session = Depends(database.get_db)):
    """Create a new user account."""
    username = user_in.username.strip()
    if not username or len(username) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username must be at least 3 characters long"
        )
    
    if len(user_in.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long"
        )

    # Check unique username
    existing_user = db.query(models.User).filter(models.User.username == username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is already taken"
        )

    # Hash and save
    pwd_hash = hash_password(user_in.password)
    db_user = models.User(username=username, password_hash=pwd_hash)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    token = generate_token(db_user.username, db_user.id)
    return UserResponseSchema(id=db_user.id, username=db_user.username, token=token, profile_picture=db_user.profile_picture)

@app.post("/api/auth/login", response_model=UserResponseSchema)
def login(user_in: UserAuthSchema, db: Session = Depends(database.get_db)):
    """Authenticate user credentials."""
    username = user_in.username.strip()
    db_user = db.query(models.User).filter(models.User.username == username).first()
    
    if not db_user or not verify_password(user_in.password, db_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )

    token = generate_token(db_user.username, db_user.id)
    return UserResponseSchema(id=db_user.id, username=db_user.username, token=token, profile_picture=db_user.profile_picture)

@app.post("/api/auth/profile", response_model=ProfileResponseSchema)
def update_profile(
    profile_in: ProfileUpdateSchema,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """Update user profile name and/or password."""
    new_username = profile_in.username.strip()
    if not new_username or len(new_username) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username must be at least 3 characters long"
        )
    
    # Check if username is taken by another user
    existing_user = db.query(models.User).filter(
        models.User.username == new_username, 
        models.User.id != current_user.id
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is already taken"
        )
    
    current_user.username = new_username
    
    if profile_in.password:
        new_password = profile_in.password
        if len(new_password) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 6 characters long"
            )
        current_user.password_hash = hash_password(new_password)
        
    if profile_in.profile_picture is not None:
        current_user.profile_picture = profile_in.profile_picture

    db.commit()
    db.refresh(current_user)
    
    # Generate new token with updated username
    new_token = generate_token(current_user.username, current_user.id)
    return ProfileResponseSchema(username=current_user.username, token=new_token, profile_picture=current_user.profile_picture)

# Drawings Scoped to User
@app.get("/api/drawings", response_model=List[DrawingResponse])
def get_drawings(current_user: models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    """Retrieve saved drawings belonging *only* to the logged-in user."""
    drawings = db.query(models.Drawing).filter(
        models.Drawing.user_id == current_user.id
    ).order_by(models.Drawing.id.desc()).all()
    
    response = []
    for d in drawings:
        response.append(DrawingResponse(
            id=d.id,
            title=d.title,
            image_data=d.image_data,
            created_at=d.created_at.strftime("%Y-%m-%d %H:%M:%S")
        ))
    return response

@app.post("/api/drawings", response_model=DrawingResponse)
def save_drawing(
    drawing_in: DrawingCreate, 
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(database.get_db)
):
    """Save a drawing and associate it with the active user."""
    db_drawing = models.Drawing(
        title=drawing_in.title,
        image_data=drawing_in.image_data,
        user_id=current_user.id
    )
    db.add(db_drawing)
    db.commit()
    db.refresh(db_drawing)
    
    return DrawingResponse(
        id=db_drawing.id,
        title=db_drawing.title,
        image_data=db_drawing.image_data,
        created_at=db_drawing.created_at.strftime("%Y-%m-%d %H:%M:%S")
    )

@app.put("/api/drawings/{drawing_id}", response_model=DrawingResponse)
def update_drawing(
    drawing_id: int,
    drawing_in: DrawingUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """Update an existing drawing belonging to the active user."""
    db_drawing = db.query(models.Drawing).filter(
        models.Drawing.id == drawing_id,
        models.Drawing.user_id == current_user.id
    ).first()
    
    if not db_drawing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Drawing not found or access denied"
        )
    
    db_drawing.title = drawing_in.title
    db_drawing.image_data = drawing_in.image_data
    db.commit()
    db.refresh(db_drawing)
    
    return DrawingResponse(
        id=db_drawing.id,
        title=db_drawing.title,
        image_data=db_drawing.image_data,
        created_at=db_drawing.created_at.strftime("%Y-%m-%d %H:%M:%S")
    )

@app.delete("/api/drawings/{drawing_id}")
def delete_drawing(
    drawing_id: int, 
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(database.get_db)
):
    """Delete a drawing by its ID (must belong to active user)."""
    db_drawing = db.query(models.Drawing).filter(
        models.Drawing.id == drawing_id,
        models.Drawing.user_id == current_user.id
    ).first()
    
    if not db_drawing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Drawing not found or access denied"
        )
    db.delete(db_drawing)
    db.commit()
    return {"message": "Drawing deleted successfully"}

# General Settings API
@app.get("/api/settings", response_model=Dict[str, str])
def get_settings(db: Session = Depends(database.get_db)):
    """Retrieve app configurations."""
    settings = db.query(models.Setting).all()
    return {s.key: s.value for s in settings}

@app.post("/api/settings")
def update_settings(settings_data: Dict[str, str], db: Session = Depends(database.get_db)):
    """Update app configurations."""
    for key, value in settings_data.items():
        db_setting = db.query(models.Setting).filter(models.Setting.key == key).first()
        if db_setting:
            db_setting.value = value
        else:
            db_setting = models.Setting(key=key, value=value)
            db.add(db_setting)
    db.commit()
    return {"message": "Settings updated successfully"}

# --- AI Stencil Generation API ---

MAX_STENCIL_USAGE = 10

def generate_ai_stencil(keyword: str) -> str:
    import urllib.request
    import urllib.parse
    import ssl
    
    # 1. Fetch AI image from Pollinations AI using a specific silhouette prompt and model=sana
    prompt = f"black silhouette outline of {keyword}, pure white background, stencil, vector, minimalist, high contrast, clean edges"
    encoded_prompt = urllib.parse.quote(prompt)
    url = f"https://image.pollinations.ai/p/{encoded_prompt}?width=512&height=512&seed=42&model=sana"
    
    # Send HTTP request with User-Agent header and ignore SSL check just in case
    req = urllib.request.Request(
        url, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    )
    context = ssl._create_unverified_context()
    
    with urllib.request.urlopen(req, context=context, timeout=25) as response:
        img_data = response.read()
        
    img_str = base64.b64encode(img_data).decode('utf-8')
    return f"data:image/png;base64,{img_str}"

def check_and_reset_stencil_limit(user, db):
    from datetime import datetime, timedelta
    now = datetime.utcnow()
    if not user.stencil_reset_time:
        user.stencil_reset_time = now + timedelta(days=1)
        user.stencil_usage_count = 0
        db.commit()
    elif now > user.stencil_reset_time:
        user.stencil_reset_time = now + timedelta(days=1)
        user.stencil_usage_count = 0
        db.commit()

@app.post("/api/stencil/generate")
def generate_stencil(
    payload: Dict[str, str],
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    keyword = payload.get("keyword", "").strip()
    if not keyword:
        raise HTTPException(status_code=400, detail="Keyword is required")
        
    check_and_reset_stencil_limit(current_user, db)
        
    # Check limit
    if current_user.stencil_usage_count >= MAX_STENCIL_USAGE:
        raise HTTPException(
            status_code=403, 
            detail=f"You have reached your limit of {MAX_STENCIL_USAGE} free AI stencil generations."
        )
        
    import urllib.parse
    import random
    seed = random.randint(1, 100000)
    
    prompt = f"black silhouette outline of {keyword}, pure white background, stencil, vector, minimalist, high contrast, clean edges"
    encoded_prompt = urllib.parse.quote(prompt)
    stencil_url = f"https://image.pollinations.ai/p/{encoded_prompt}?width=512&height=512&seed={seed}&model=sana"
        
    # Update usage
    current_user.stencil_usage_count += 1
    db.commit()
    db.refresh(current_user)
    
    return {
        "stencil_url": stencil_url,
        "usage_count": current_user.stencil_usage_count,
        "max_usage": MAX_STENCIL_USAGE,
        "reset_time": current_user.stencil_reset_time.isoformat() if current_user.stencil_reset_time else None
    }

@app.get("/api/stencil/usage")
def get_stencil_usage(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    check_and_reset_stencil_limit(current_user, db)
    return {
        "usage_count": current_user.stencil_usage_count,
        "max_usage": MAX_STENCIL_USAGE,
        "reset_time": current_user.stencil_reset_time.isoformat() if current_user.stencil_reset_time else None
    }

from pydantic import BaseModel
from shape_recognizer import predict_shape

class PointModel(BaseModel):
    x: float
    y: float

class PredictShapeRequest(BaseModel):
    points: List[PointModel]

@app.post("/api/predict-shape")
def api_predict_shape(payload: PredictShapeRequest):
    pts = [(pt.x, pt.y) for pt in payload.points]
    return predict_shape(pts)
