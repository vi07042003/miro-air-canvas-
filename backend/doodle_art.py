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
    Comprehensive sketch analyser using pure PIL pixel analysis.
    Detects stars, circles, triangles, rectangles, vehicles, people,
    houses, trees, hearts, arrows, flowers and more.
    Works with ANY stroke colour on any background.
    """
    try:
        small = img.resize((128, 128)).convert("L")
        w, h = small.size
        pixels = list(small.getdata())
        n = len(pixels)
        sorted_p = sorted(pixels)
        mean_val = sum(pixels) / n

        # Adaptive, colour-agnostic threshold
        if mean_val < 127:
            threshold = sorted_p[int(n * 0.70)]
            if threshold < 30:
                threshold = 40
            drawn = [1 if p > threshold else 0 for p in pixels]
        else:
            threshold = sorted_p[int(n * 0.30)]
            if threshold > 210:
                threshold = 200
            drawn = [1 if p < threshold else 0 for p in pixels]

        total_drawn = sum(drawn)
        if total_drawn < 8:
            return "an abstract shape or minimal line"

        grid = [drawn[i * w:(i + 1) * w] for i in range(h)]

        # --- Bounding box ---
        row_has = [any(row) for row in grid]
        col_has = [any(grid[r][c] for r in range(h)) for c in range(w)]
        top    = next((i for i, v in enumerate(row_has) if v), 0)
        bottom = h - 1 - next((i for i, v in enumerate(reversed(row_has)) if v), 0)
        left   = next((i for i, v in enumerate(col_has) if v), 0)
        right  = w - 1 - next((i for i, v in enumerate(reversed(col_has)) if v), 0)

        bbox_w = max(right - left, 1)
        bbox_h = max(bottom - top, 1)
        aspect = bbox_w / bbox_h
        fill_ratio = total_drawn / (bbox_w * bbox_h)

        # Zone density helper
        def zd(r1, r2, c1, c2):
            r1, r2 = max(int(r1), 0), min(int(r2), h)
            c1, c2 = max(int(c1), 0), min(int(c2), w)
            count = sum(grid[r][c] for r in range(r1, r2) for c in range(c1, c2))
            return count / max((r2 - r1) * (c2 - c1), 1)

        top_d    = zd(top,              top  + bbox_h / 3,   left, right)
        mid_v_d  = zd(top + bbox_h / 3, bottom - bbox_h / 3, left, right)
        bot_d    = zd(bottom - bbox_h / 3, bottom,            left, right)
        left_d   = zd(top, bottom,  left,              left  + bbox_w / 3)
        mid_h_d  = zd(top, bottom,  left + bbox_w / 3, right - bbox_w / 3)
        right_d  = zd(top, bottom,  right - bbox_w / 3, right)
        center_d = zd(top  + bbox_h / 4, bottom - bbox_h / 4,
                      left + bbox_w / 4, right  - bbox_w / 4)

        bot_top_ratio  = bot_d  / max(top_d,            0.001)
        left_right_sym = 1 - abs(left_d - right_d) / max(left_d + right_d, 0.001)
        top_bot_sym    = 1 - abs(top_d  - bot_d)   / max(top_d  + bot_d,   0.001)

        # Edge crossings per row (high = spiky/star, low = smooth circle)
        h_crossings = 0
        for r in range(top, bottom + 1):
            prev = 0
            for c in range(left, right + 1):
                cur = grid[r][c]
                if cur != prev:
                    h_crossings += 1
                prev = cur
        avg_crossings = h_crossings / max(bbox_h, 1)

        # Average pixel-gap blobs per row (detects multi-lobe shapes)
        gap_total = 0
        for r in range(top, bottom + 1):
            in_b = False
            for c in range(left, right + 1):
                if grid[r][c] and not in_b:
                    in_b = True
                elif not grid[r][c] and in_b:
                    in_b = False
                    gap_total += 1
        avg_gaps = gap_total / max(bbox_h, 1)

        # ===================== CLASSIFICATION =====================
        # Thresholds empirically calibrated from measured metric values.

        # 1. RECTANGLE / SQUARE — low avg_gaps (<1.2), low crossings, hollow centre
        if avg_gaps < 1.2 and avg_crossings < 3.2 and center_d < 0.05:
            if 0.82 < aspect < 1.22:
                return "a square"
            return "a rectangle"

        # 2. STAR — cd>0.08 (tips reach centre), high crossings (>4), many gaps (>1.9)
        if (avg_crossings > 4.0
                and avg_gaps > 1.9
                and center_d > 0.08
                and left_right_sym > 0.70
                and fill_ratio < 0.40):
            return "a five-pointed star"

        # 3. CIRCLE — centre is EMPTY (cd≈0), symmetric, smooth crossings
        if (center_d < 0.04
                and avg_crossings < 4.2
                and fill_ratio < 0.25
                and left_right_sym > 0.85
                and top_bot_sym > 0.80):
            if aspect < 0.78 or aspect > 1.28:
                return "an oval or ellipse"
            return "a circle"

        # 4. TRIANGLE — sparse top, denser bottom, symmetric L-R, low fill
        if (top_d < bot_d * 0.65
                and fill_ratio < 0.20
                and left_right_sym > 0.80
                and center_d < 0.12):
            return "a triangle"

        # 5. CAR / VEHICLE — high fill, high cd, bottom-heavier
        if (fill_ratio > 0.15
                and center_d > 0.15
                and bot_top_ratio > 1.5
                and aspect > 1.0):
            return "a side view of a car or vehicle with wheels at the bottom"

        if aspect > 1.5 and bot_top_ratio > 1.5:
            return "a side view of a car or vehicle with wheels at the bottom"

        if aspect > 2.2:
            return "a wide horizontal object such as a car, bus, or landscape"

        # 6. SOLID DISC / SUN — high fill, symmetric
        if fill_ratio > 0.55 and left_right_sym > 0.60:
            return "a solid filled circle or sun"

        # 7. HEART — symmetric L-R, dip at top, wide mid
        if (left_right_sym > 0.60
                and top_d < mid_v_d * 0.75
                and bot_d < mid_v_d * 0.85
                and fill_ratio < 0.55):
            return "a heart shape"

        # 8. AIRPLANE / BIRD — wide + top-heavy + symmetric wings
        if (aspect > 1.4
                and top_d > bot_d * 1.4
                and left_right_sym > 0.60):
            return "an airplane or bird with wings spread"

        # 9. HOUSE — peaked top, wide base
        if (top_d < bot_d * 0.65
                and left_d > center_d * 0.4
                and right_d > center_d * 0.4
                and 0.8 < aspect < 2.0):
            return "a house with a peaked roof"

        # 10. TREE — narrower base, wider canopy
        if (0.4 < aspect < 1.0
                and top_d > bot_d * 1.2
                and left_right_sym > 0.50):
            return "a tree with a leafy canopy"

        # 11. PERSON / STICK FIGURE — tall and narrow
        if aspect < 0.58:
            return "a stick figure or person standing"

        # 12. FLOWER — symmetric, multi-lobed petals
        if avg_gaps > 1.4 and left_right_sym > 0.50 and 0.65 < aspect < 1.45:
            return "a flower with petals"

        # 13. ARROW — asymmetric, sparse fill
        if aspect > 1.2 and abs(left_d - right_d) > 0.07 and fill_ratio < 0.32:
            direction = "right" if right_d > left_d else "left"
            return f"an arrow pointing {direction}"

        # Fallback
        if aspect > 1.8:
            return "a wide horizontal drawing"
        if aspect < 0.6:
            return "a tall vertical shape"
        return "a detailed sketch with multiple drawn elements"

    except Exception:
        return ""



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

    # --- Step 1: Describe sketch (vision API first, local analysis fallback) ---
    sketch_description = describe_sketch_via_vision(vision_base64)

    if not sketch_description:
        # Always-reliable local pixel analyser
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
        with urllib.request.urlopen(req, context=context, timeout=45) as response:
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
