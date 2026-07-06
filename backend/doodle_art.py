import base64
import io
import json
import random
import ssl
import urllib.request
import urllib.parse
from fastapi import HTTPException
from PIL import Image, ImageOps
import models

MAX_AI_SKETCH_USAGE = 10


def check_and_reset_ai_sketch_limit(user, db):
    from datetime import datetime, timedelta
    now = datetime.utcnow()
    if not user.ai_sketch_reset_time or now > user.ai_sketch_reset_time:
        user.ai_sketch_reset_time = now + timedelta(hours=1)
        user.ai_sketch_usage_count = 0
        db.commit()


def analyze_sketch_locally(img: Image.Image) -> str:
    """
    Simple fallback description when AI vision is not available.
    """
    return "a hand-drawn sketch"


def describe_sketch_via_huggingface(image_bytes: bytes, hf_token: str) -> str:
    """
    Call Salesforce/blip-image-captioning-large via modern router.huggingface.co
    """
    if not hf_token:
        return ""
    try:
        import urllib.request
        import json
        import ssl
        import time
        
        url = "https://router.huggingface.co/hf-inference/models/Salesforce/blip-image-captioning-large"
        req = urllib.request.Request(
            url,
            data=image_bytes,
            headers={
                "Content-Type": "image/jpeg",
                "Authorization": f"Bearer {hf_token}",
                "User-Agent": "Mozilla/5.0"
            },
            method="POST"
        )
        ctx = ssl._create_unverified_context()
        
        # Retry up to 3 times if model is loading
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, context=ctx, timeout=12) as resp:
                    res_data = json.loads(resp.read().decode())
                    if isinstance(res_data, list) and len(res_data) > 0:
                        desc = res_data[0].get("generated_text", "")
                        if desc:
                            return desc.strip()
                    elif isinstance(res_data, dict) and "error" in res_data:
                        err_msg = res_data.get("error", "")
                        if "loading" in err_msg.lower():
                            time.sleep(2.5)
                            continue
                break
            except urllib.error.HTTPError as he:
                try:
                    err_body = json.loads(he.read().decode())
                    if "loading" in err_body.get("error", "").lower():
                        time.sleep(3.0)
                        continue
                except:
                    pass
                break
    except Exception as e:
        print(f"HuggingFace vision description failed: {e}")
    return ""


def describe_sketch_via_gemini(image_bytes: bytes) -> tuple:
    """
    Call Gemini 2.5 Flash API directly using the backend's GEMINI_API_KEY.
    Checks the database first (user-configured), then falls back to env var.
    Returns (description_str, status_code_int).
    """
    import os
    from dotenv import load_dotenv
    import urllib.request
    import urllib.error
    import json
    import ssl
    import base64

    # 1. Try to get key from database (user-configured, survives Render restarts)
    api_key = None
    try:
        import database, models
        db = next(database.get_db())
        db_setting = db.query(models.Setting).filter(models.Setting.key == "GEMINI_API_KEY").first()
        if db_setting and db_setting.value:
            api_key = db_setting.value
        db.close()
    except Exception:
        pass

    # 2. Fall back to environment variable (Render env vars / local .env)
    if not api_key:
        load_dotenv(override=True)
        api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        print("GEMINI_API_KEY not configured in database or environment")
        return "", 401

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key={api_key}"
        img_b64 = base64.b64encode(image_bytes).decode("utf-8")
        
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": (
                                "Analyze this hand-drawn outline sketch. "
                                "Identify the main subject or object drawn (e.g. a car, a face, a house, a cat). "
                                "Describe ONLY what is drawn: the main subject, its shape and key details. "
                                "Be extremely concise (1-2 sentences). "
                                "Do NOT use any markdown formatting or prefix like 'This is'."
                            )
                        },
                        {
                            "inlineData": {
                                "mimeType": "image/jpeg",
                                "data": img_b64
                            }
                        }
                    ]
                }
            ],
            "generationConfig": {
                "maxOutputTokens": 800,
                "temperature": 0.3
            }
        }
        
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
            method="POST"
        )
        ctx = ssl._create_unverified_context()
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            res_data = json.loads(resp.read().decode())
            candidates = res_data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts:
                    desc = parts[0].get("text", "")
                    if desc:
                        return desc.strip(), 200
        return "", 204
    except urllib.error.HTTPError as e:
        print(f"Gemini API description failed: {e}")
        return "", e.code
    except Exception as e:
        print(f"Gemini API description failed: {e}")
        return "", 500



def describe_sketch_via_vision(image_base64: str) -> str:
    """
    Try Pollinations AI vision endpoint to describe the sketch.
    Returns empty string on failure so caller falls back to local analysis.
    """
    for model_name in ["openai", "openai-large"]:
        try:
            url = "https://text.pollinations.ai/openai/v1/chat/completions"
            payload = {
                "model": model_name,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": (
                                    "Look at this hand-drawn sketch. "
                                    "Describe ONLY what you see drawn: the main subject, "
                                    "its shape and key details. Be concise (1-2 sentences). "
                                    "Do NOT say you cannot see it — just describe what is present."
                                )
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_base64}",
                                    "detail": "low"
                                }
                            }
                        ]
                    }
                ],
                "max_tokens": 80,
                "temperature": 0.3
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0"
                },
                method="POST"
            )
            context = ssl._create_unverified_context()
            with urllib.request.urlopen(req, context=context, timeout=12) as response:
                data = json.loads(response.read().decode("utf-8"))
                description = data["choices"][0]["message"]["content"].strip()
                # Reject generic refusal responses
                refusal_phrases = [
                    "cannot see", "can't see", "no image", "not able to see",
                    "don't see", "i see no", "no attachment", "please attach",
                    "i'm not able", "unable to", "sorry", "comply",
                    "i cannot", "no visible", "not provided"
                ]
                if not any(ph in description.lower() for ph in refusal_phrases):
                    return description
        except Exception:
            continue
    return ""


def handle_doodle_to_art(payload: dict, current_user, db):
    from datetime import datetime
 
    prompt = (payload.get("prompt") or "").strip()
    image_data = (payload.get("image_data") or "").strip()
    sketch_description = (payload.get("sketch_description") or "").strip()
    hf_token = (payload.get("hf_token") or "").strip()
 
    if not image_data:
        raise HTTPException(status_code=400, detail="Image data is required")
 
    check_and_reset_ai_sketch_limit(current_user, db)
 
    if current_user.ai_sketch_usage_count >= MAX_AI_SKETCH_USAGE:
        remaining = (current_user.ai_sketch_reset_time - datetime.utcnow()).total_seconds()
        remaining = max(0, int(remaining))
        mins = remaining // 60
        secs = remaining % 60
        time_str = f"{mins}m {secs}s" if mins > 0 else f"{secs}s"
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. {MAX_AI_SKETCH_USAGE} per hour. Try again in {time_str}."
        )
 
    # --- Decode & preprocess sketch ---
    try:
        if "," in image_data:
            _, encoded = image_data.split(",", 1)
        else:
            encoded = image_data
        image_bytes = base64.b64decode(encoded)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image base64 data: {str(e)}")
 
    try:
        img = Image.open(io.BytesIO(image_bytes))
 
        # Flatten transparency onto white background
        if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
            bg = Image.new("RGB", img.size, (255, 255, 255))
            alpha = img.split()[-1]
            bg.paste(img, mask=alpha)
            img = bg
        else:
            img = img.convert("RGB")
 
        # Detect dark background → keep original for analysis, invert for vision
        gray = img.convert("L")
        corners = [
            gray.getpixel((0, 0)),
            gray.getpixel((gray.width - 1, 0)),
            gray.getpixel((0, gray.height - 1)),
            gray.getpixel((gray.width - 1, gray.height - 1)),
        ]
        # Save original (pre-inversion) for local analyser
        original_img = img.copy()
 
        if sum(corners) / 4 < 127:
            img = ImageOps.invert(img)
 
        # Encode small JPEG for vision API
        vision_buf = io.BytesIO()
        img.resize((256, 256)).save(vision_buf, format="JPEG", quality=80)
        vision_base64 = base64.b64encode(vision_buf.getvalue()).decode("utf-8")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to preprocess sketch: {str(e)}")
 
    # --- Step 1: Describe sketch (client-provided/confirmed description has priority, then Gemini vision, then HF vision API, then legacy vision, then local fallback) ---
    if not sketch_description:
        # 1. Try Gemini Vision API first (backend env config)
        # Save original pre-inversion image as JPEG bytes for Gemini
        gemini_buf = io.BytesIO()
        original_img.resize((384, 384)).save(gemini_buf, format="JPEG", quality=90)
        sketch_description, _ = describe_sketch_via_gemini(gemini_buf.getvalue())

        # 2. Try Salesforce BLIP model if hf_token is provided
        if not sketch_description and hf_token:
            hf_buf = io.BytesIO()
            original_img.resize((384, 384)).save(hf_buf, format="JPEG", quality=90)
            sketch_description = describe_sketch_via_huggingface(hf_buf.getvalue(), hf_token)
            
        # 3. Try legacy Pollinations vision completions
        if not sketch_description:
            sketch_description = describe_sketch_via_vision(vision_base64)
            
        # 4. Fall back to local analyser
        if not sketch_description:
            sketch_description = analyze_sketch_locally(original_img)
 
    # --- Step 2: Build enriched prompt from sketch description + user style ---
    style_part = prompt if prompt else "vibrant colors, highly detailed, masterpiece"
    if sketch_description:
        enriched_prompt = (
            f"{style_part}, beautiful artwork of {sketch_description}, "
            "colorful, sharp focus, 4k, detailed illustration"
        )
    else:
        enriched_prompt = (
            f"{style_part}, vibrant digital artwork, "
            "sharp focus, 4k, detailed illustration"
        )

    # --- Step 3: Generate via Pollinations sana (free, no token) ---
    output_bytes = None
    error_detail = ""
    service_used = "Pollinations AI (sketch-analysed, sana)"

    try:
        seed = random.randint(1, 100000)
        encoded_prompt = urllib.parse.quote(enriched_prompt)
        pollinations_url = (
            f"https://image.pollinations.ai/prompt/{encoded_prompt}"
            f"?width=512&height=512&seed={seed}&model=sana&enhance=true&nologo=true"
        )
        req = urllib.request.Request(
            pollinations_url,
            headers={"User-Agent": "Mozilla/5.0"}
        )
        context = ssl._create_unverified_context()
        with urllib.request.urlopen(req, context=context, timeout=30) as response:
            output_bytes = response.read()
    except Exception as e:
        print(f"Pollinations sana generation failed: {e}. Trying fallback model flux...")
        error_detail = str(e)

    # Fallback to flux model if sana fails
    if not output_bytes:
        try:
            service_used = "Pollinations AI (sketch-analysed, flux-fallback)"
            seed = random.randint(1, 100000)
            encoded_prompt = urllib.parse.quote(enriched_prompt)
            pollinations_url = (
                f"https://image.pollinations.ai/prompt/{encoded_prompt}"
                f"?width=512&height=512&seed={seed}&model=flux&enhance=true&nologo=true"
            )
            req = urllib.request.Request(
                pollinations_url,
                headers={"User-Agent": "Mozilla/5.0"}
            )
            context = ssl._create_unverified_context()
            with urllib.request.urlopen(req, context=context, timeout=30) as response:
                output_bytes = response.read()
        except Exception as e:
            error_detail = str(e)

    if not output_bytes:
        raise HTTPException(status_code=500, detail=f"Failed to generate artwork: {error_detail}")

    current_user.ai_sketch_usage_count += 1
    db.commit()
    db.refresh(current_user)

    img_str = base64.b64encode(output_bytes).decode("utf-8")
    return {
        "image_data": f"data:image/png;base64,{img_str}",
        "service_used": service_used,
        "sketch_description": sketch_description,
        "usage_count": current_user.ai_sketch_usage_count,
        "max_usage": MAX_AI_SKETCH_USAGE,
        "reset_time": current_user.ai_sketch_reset_time.isoformat() if current_user.ai_sketch_reset_time else None
    }
