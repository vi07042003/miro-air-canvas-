from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import List, Dict, Optional, Any
import pydantic
import os
import hashlib
import secrets
import hmac
import base64
import json

import database
import models
import collaboration

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

app.include_router(collaboration.router)

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
    canvas_mode: Optional[str] = "2d"
    threed_objects: Optional[str] = None

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
            canvas_mode=d.canvas_mode or "2d",
            threed_objects=d.threed_objects,
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
        canvas_mode=drawing_in.canvas_mode or "2d",
        threed_objects=drawing_in.threed_objects,
        user_id=current_user.id
    )
    db.add(db_drawing)
    db.commit()
    db.refresh(db_drawing)
    
    return DrawingResponse(
        id=db_drawing.id,
        title=db_drawing.title,
        image_data=db_drawing.image_data,
        canvas_mode=db_drawing.canvas_mode or "2d",
        threed_objects=db_drawing.threed_objects,
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
    db_drawing.canvas_mode = drawing_in.canvas_mode or "2d"
    db_drawing.threed_objects = drawing_in.threed_objects
    db.commit()
    db.refresh(db_drawing)
    
    return DrawingResponse(
        id=db_drawing.id,
        title=db_drawing.title,
        image_data=db_drawing.image_data,
        canvas_mode=db_drawing.canvas_mode or "2d",
        threed_objects=db_drawing.threed_objects,
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

def upload_to_tmpfiles(image_bytes: bytes) -> str:
    import urllib.request
    import json
    import uuid
    import ssl
    
    url = "https://tmpfiles.org/api/v1/upload"
    boundary = f"----WebKitFormBoundary{uuid.uuid4().hex}"
    
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="doodle.png"\r\n'
        f"Content-Type: image/png\r\n\r\n"
    ).encode('utf-8') + image_bytes + f"\r\n--{boundary}--\r\n".encode('utf-8')
    
    headers = {
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Content-Length": str(len(body)),
        "User-Agent": "Mozilla/5.0"
    }
    
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        context = ssl._create_unverified_context()
        with urllib.request.urlopen(req, context=context, timeout=20) as response:
            resp_data = json.loads(response.read().decode('utf-8'))
            if resp_data.get("status") == "success":
                original_url = resp_data["data"]["url"]
                dl_url = original_url.replace("tmpfiles.org/", "tmpfiles.org/dl/")
                return dl_url
    except Exception as e:
        print(f"Error uploading to tmpfiles: {e}", flush=True)
    return None

# --- AI Stencil Generation API ---

def generate_hf_image(prompt: str, model_id: str, hf_token: str = None) -> bytes:
    import urllib.request
    import urllib.parse
    import json
    import ssl
    
    if not model_id:
        model_id = "stabilityai/stable-diffusion-xl-base-1.0"
        
    url = f"https://api-inference.huggingface.co/models/{model_id}"
    
    # Format the prompt to generate a high-contrast black outline / line-art sketch on a pure white background
    enhanced_prompt = f"minimalist simple black outline drawing of {prompt}, pure white background, simple outline, no coloring, no shading, no shadow, no background, no details, no hatching, clean single stroke lineart"
    negative_prompt = "color, shading, shadow, texture, fill, gradients, 3d, realistic, photo, complex, detailed, background patterns, sketch lines background, multiple lines, sketchy, scribble, colored, gray, grey"
    payload = {
        "inputs": enhanced_prompt,
        "parameters": {
            "negative_prompt": negative_prompt
        }
    }
    data = json.dumps(payload).encode('utf-8')
    
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }
    if hf_token:
        headers["Authorization"] = f"Bearer {hf_token}"
        
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    context = ssl._create_unverified_context()
    
    try:
        with urllib.request.urlopen(req, context=context, timeout=40) as response:
            return response.read()
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='ignore')
        try:
            err_json = json.loads(err_body)
            err_msg = err_json.get("error", "Hugging Face API error")
            if "loading" in err_msg.lower() and "estimated_time" in err_json:
                raise HTTPException(status_code=503, detail=f"Hugging Face model is loading. Estimated time: {err_json['estimated_time']:.1f}s. Please retry shortly.")
            raise HTTPException(status_code=e.code, detail=err_msg)
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=e.code, detail=f"HF API returned error code {e.code}: {err_body[:200]}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to connect to Hugging Face: {str(e)}")

MAX_AI_SKETCH_USAGE = 10

def check_and_reset_ai_sketch_limit(user, db):
    from datetime import datetime, timedelta
    now = datetime.utcnow()
    if not user.ai_sketch_reset_time or now > user.ai_sketch_reset_time:
        user.ai_sketch_reset_time = now + timedelta(hours=1)
        user.ai_sketch_usage_count = 0
        db.commit()

@app.post("/api/ai-sketch/generate")
def generate_ai_sketch(
    payload: Dict[str, Optional[str]],
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    from datetime import datetime
    
    prompt = (payload.get("prompt") or "").strip()
    hf_token = (payload.get("hf_token") or "").strip()
    model_id = (payload.get("model_id") or "stabilityai/stable-diffusion-xl-base-1.0").strip()
    use_fallback = payload.get("use_fallback") == "true" or payload.get("use_fallback") is True
    
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")
        
    check_and_reset_ai_sketch_limit(current_user, db)
    
    if current_user.ai_sketch_usage_count >= MAX_AI_SKETCH_USAGE:
        remaining = (current_user.ai_sketch_reset_time - datetime.utcnow()).total_seconds()
        remaining = max(0, int(remaining))
        mins = remaining // 60
        secs = remaining % 60
        time_str = f"{mins}m {secs}s" if mins > 0 else f"{secs}s"
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. You can generate {MAX_AI_SKETCH_USAGE} sketches per hour. Try again in {time_str}."
        )
        
    image_bytes = None
    service_used = "Hugging Face"
    error_detail = ""
    
    try:
        image_bytes = generate_hf_image(prompt, model_id, hf_token)
    except HTTPException as h_err:
        error_detail = h_err.detail
        if use_fallback:
            try:
                import urllib.request
                import ssl
                import urllib.parse
                import random
                seed = random.randint(1, 100000)
                enhanced_prompt = f"minimalist simple black outline drawing of {prompt}, pure white background, simple outline, no coloring, no shading, no shadow, no background, no details, no hatching, clean single stroke lineart"
                negative_prompt = "color, shading, shadow, texture, fill, gradients, 3d, realistic, photo, complex, detailed, background patterns, sketch lines background, multiple lines, sketchy, scribble, colored, gray, grey"
                encoded_prompt = urllib.parse.quote(enhanced_prompt)
                encoded_neg = urllib.parse.quote(negative_prompt)
                url = f"https://image.pollinations.ai/p/{encoded_prompt}?width=512&height=512&seed={seed}&model=sana&negative_prompt={encoded_neg}"
                
                req = urllib.request.Request(
                    url, 
                    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
                )
                context = ssl._create_unverified_context()
                with urllib.request.urlopen(req, context=context, timeout=25) as response:
                    image_bytes = response.read()
                service_used = f"Pollinations AI (HF failed: {error_detail})"
            except Exception as fallback_err:
                raise HTTPException(status_code=500, detail=f"HF failed: {error_detail}. Fallback failed: {str(fallback_err)}")
        else:
            raise h_err
    except Exception as e:
        error_detail = str(e)
        if use_fallback:
            try:
                import urllib.request
                import ssl
                import urllib.parse
                import random
                seed = random.randint(1, 100000)
                enhanced_prompt = f"minimalist simple black outline drawing of {prompt}, pure white background, simple outline, no coloring, no shading, no shadow, no background, no details, no hatching, clean single stroke lineart"
                negative_prompt = "color, shading, shadow, texture, fill, gradients, 3d, realistic, photo, complex, detailed, background patterns, sketch lines background, multiple lines, sketchy, scribble, colored, gray, grey"
                encoded_prompt = urllib.parse.quote(enhanced_prompt)
                encoded_neg = urllib.parse.quote(negative_prompt)
                url = f"https://image.pollinations.ai/p/{encoded_prompt}?width=512&height=512&seed={seed}&model=sana&negative_prompt={encoded_neg}"
                req = urllib.request.Request(
                    url, 
                    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
                )
                context = ssl._create_unverified_context()
                with urllib.request.urlopen(req, context=context, timeout=25) as response:
                    image_bytes = response.read()
                service_used = f"Pollinations AI (HF failed: {error_detail})"
            except Exception as fallback_err:
                raise HTTPException(status_code=500, detail=f"HF failed: {error_detail}. Fallback failed: {str(fallback_err)}")
        else:
            raise HTTPException(status_code=500, detail=f"Failed to connect to Hugging Face: {str(e)}")
            
    if not image_bytes:
        raise HTTPException(status_code=500, detail="Generated image data was empty")
        
    current_user.ai_sketch_usage_count += 1
    db.commit()
    db.refresh(current_user)
    
    img_str = base64.b64encode(image_bytes).decode('utf-8')
    return {
        "image_data": f"data:image/png;base64,{img_str}",
        "service_used": service_used,
        "usage_count": current_user.ai_sketch_usage_count,
        "max_usage": MAX_AI_SKETCH_USAGE,
        "reset_time": current_user.ai_sketch_reset_time.isoformat() if current_user.ai_sketch_reset_time else None
    }

@app.get("/api/ai-sketch/usage")
def get_ai_sketch_usage(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    check_and_reset_ai_sketch_limit(current_user, db)
    return {
        "usage_count": current_user.ai_sketch_usage_count,
        "max_usage": MAX_AI_SKETCH_USAGE,
        "reset_time": current_user.ai_sketch_reset_time.isoformat() if current_user.ai_sketch_reset_time else None
    }

@app.post("/api/ai-sketch/analyze-doodle")
def analyze_doodle(
    payload: Dict[str, Any],
    current_user: models.User = Depends(get_current_user)
):
    import doodle_art
    import base64
    import io
    from PIL import Image
    
    image_data = (payload.get("image_data") or "").strip()
    hf_token = (payload.get("hf_token") or "").strip()
    if not image_data:
        raise HTTPException(status_code=400, detail="Image data is required")
        
    try:
        if "," in image_data:
            _, encoded = image_data.split(",", 1)
        else:
            encoded = image_data
        image_bytes = base64.b64decode(encoded)
        img = Image.open(io.BytesIO(image_bytes))
        
        # Flatten transparency onto white background
        if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
            bg = Image.new("RGB", img.size, (255, 255, 255))
            alpha = img.split()[-1]
            bg.paste(img, mask=alpha)
            img = bg
        else:
            img = img.convert("RGB")
            
        description = ""
        gemini_status = 200
        # 1. Try Gemini Vision first
        gemini_buf = io.BytesIO()
        img.resize((384, 384)).save(gemini_buf, format="JPEG", quality=90)
        description, gemini_status = doodle_art.describe_sketch_via_gemini(gemini_buf.getvalue())
        
        # 2. Try Hugging Face second
        if not description and hf_token:
            hf_buf = io.BytesIO()
            img.resize((384, 384)).save(hf_buf, format="JPEG", quality=90)
            description = doodle_art.describe_sketch_via_huggingface(hf_buf.getvalue(), hf_token)
            
        # 3. Fallback to local
        if not description:
            description = doodle_art.analyze_sketch_locally(img)
            
        return {
            "sketch_description": description,
            "gemini_status": gemini_status
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze sketch: {str(e)}")

@app.post("/api/ai-sketch/doodle-to-art")
def doodle_to_art(
    payload: Dict[str, Any],
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    import doodle_art
    return doodle_art.handle_doodle_to_art(payload, current_user, db)

@app.get("/api/ai-sketch/gemini-status")
def get_gemini_status(db: Session = Depends(database.get_db)):
    import os
    from dotenv import load_dotenv
    # 1. Check database first (user-configured key, persists across restarts)
    db_setting = db.query(models.Setting).filter(models.Setting.key == "GEMINI_API_KEY").first()
    key = db_setting.value if db_setting and db_setting.value else None
    # 2. Fall back to environment variable (Render env vars / .env file)
    if not key:
        load_dotenv(override=True)
        key = os.getenv("GEMINI_API_KEY")
    configured = bool(key)
    masked_key = ""
    if key:
        if len(key) > 8:
            masked_key = f"{key[:4]}...{key[-4:]}"
        else:
            masked_key = "Configured"
    return {"configured": configured, "masked_key": masked_key}

@app.post("/api/ai-sketch/update-gemini-key")
def update_gemini_key(payload: Dict[str, Any], db: Session = Depends(database.get_db)):
    new_key = (payload.get("api_key") or "").strip()
    if not new_key:
        raise HTTPException(status_code=400, detail="API key is required")
        
    # Validate the key by making a test request to Gemini API
    import urllib.request
    import urllib.error
    import json
    import ssl
    
    validation_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key={new_key}"
    validation_payload = {
        "contents": [{"parts": [{"text": "Hello"}]}]
    }
    try:
        req_data = json.dumps(validation_payload).encode("utf-8")
        req = urllib.request.Request(
            validation_url,
            data=req_data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        context = ssl._create_unverified_context()
        with urllib.request.urlopen(req, context=context, timeout=8) as response:
            pass
    except urllib.error.HTTPError as e:
        raise HTTPException(
            status_code=400,
            detail="The API key is invalid or unauthorized. Please verify your Gemini API key."
        )
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Could not verify API key due to connection error: {str(e)}"
        )

    # Save to database (persists across container restarts on Render)
    db_setting = db.query(models.Setting).filter(models.Setting.key == "GEMINI_API_KEY").first()
    if db_setting:
        db_setting.value = new_key
    else:
        db_setting = models.Setting(key="GEMINI_API_KEY", value=new_key)
        db.add(db_setting)
    db.commit()

    # Also update the in-memory environment variable so it takes effect immediately
    import os
    os.environ["GEMINI_API_KEY"] = new_key

    return {"message": "Gemini API key updated successfully"}

@app.delete("/api/ai-sketch/delete-gemini-key")
def delete_gemini_key(db: Session = Depends(database.get_db)):
    """Remove the stored Gemini API key from the database and environment."""
    import os
    db_setting = db.query(models.Setting).filter(models.Setting.key == "GEMINI_API_KEY").first()
    if db_setting:
        db.delete(db_setting)
        db.commit()
    # Clear the in-memory env var so the change takes effect immediately
    os.environ.pop("GEMINI_API_KEY", None)
    return {"message": "Gemini API key deleted successfully"}

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


# --- Backend OpenCV & MediaPipe Hand Tracking WebSocket ---

@app.websocket("/api/ws/hand-tracking")
async def websocket_hand_tracking(websocket: WebSocket, confidence: float = 0.5):
    """
    Accepts raw binary images from the client, processes them using OpenCV and MediaPipe,
    and returns detected hand landmarks.
    """
    await websocket.accept()
    
    # Lazily import opencv and mediapipe to keep startup fast
    import cv2
    import numpy as np
    import mediapipe as mp
    
    mp_hands = mp.solutions.hands
    
    # Initialize MediaPipe Hands inside a context manager for proper cleanup
    with mp_hands.Hands(
        static_image_mode=False,
        max_num_hands=1,
        model_complexity=1,
        min_detection_confidence=confidence,
        min_tracking_confidence=confidence
    ) as hands:
        try:
            while True:
                # Receive binary frame from client
                data = await websocket.receive_bytes()
                if not data:
                    break
                    
                # Decode the frame using OpenCV
                nparr = np.frombuffer(data, np.uint8)
                img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                if img is None:
                    await websocket.send_json({"error": "Failed to decode frame", "multiHandLandmarks": []})
                    continue
                
                # Convert the BGR image to RGB (MediaPipe requires RGB)
                img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                
                # Process the image with MediaPipe
                results = hands.process(img_rgb)
                
                # Build the response landmarks
                response = {"multiHandLandmarks": []}
                if results.multi_hand_landmarks:
                    for hand_landmarks in results.multi_hand_landmarks:
                        landmarks_list = []
                        for lm in hand_landmarks.landmark:
                            landmarks_list.append({
                                "x": lm.x,
                                "y": lm.y,
                                "z": lm.z
                            })
                        response["multiHandLandmarks"].append(landmarks_list)
                
                # Send the landmarks back to the client
                await websocket.send_json(response)
                
        except WebSocketDisconnect:
            pass
        except Exception as e:
            # Send error details and close cleanly
            try:
                await websocket.send_json({"error": str(e), "multiHandLandmarks": []})
            except Exception:
                pass
