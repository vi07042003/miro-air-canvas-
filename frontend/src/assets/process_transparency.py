import os
from PIL import Image

def make_transparent(img_path, output_path):
    img = Image.open(img_path).convert("RGBA")
    datas = img.getdata()
    
    new_data = []
    for item in datas:
        r, g, b, a = item
        # Calculate pixel intensity/brightness
        v = max(r, g, b)
        
        # Smooth thresholding for the dark background
        if v < 15:
            # Fully transparent for very dark background pixels
            new_data.append((0, 0, 0, 0))
        elif v < 45:
            # Smoothly transition from transparent to semi-transparent
            factor = (v - 15) / 30.0
            alpha = int(v * factor)
            new_data.append((r, g, b, alpha))
        else:
            # Keep bright pixels opaque/semi-opaque
            # We can boost the alpha of the glowing orb to make it stand out nicely
            alpha = min(255, int(v * 1.2))
            new_data.append((r, g, b, alpha))
            
    img.putdata(new_data)
    img.save(output_path, "PNG")
    print(f"Successfully processed {img_path} -> {output_path}")

assets_dir = "/home/vinitprajapati/miro-air-canvas-/frontend/src/assets"
themes = ["aurora_sky", "liquid_pearl", "royal_orchid", "solar_flare", "velvet_emerald", "custom_theme"]

for theme in themes:
    path = os.path.join(assets_dir, f"{theme}.png")
    if os.path.exists(path):
        make_transparent(path, path)
