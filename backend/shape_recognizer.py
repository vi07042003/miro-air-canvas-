import math

# 1. Resample path to N points
def resample(points, n=64):
    if not points:
        return []
    
    # Calculate total path length
    path_len = 0.0
    for i in range(1, len(points)):
        pt1 = points[i - 1]
        pt2 = points[i]
        path_len += math.sqrt((pt2[0] - pt1[0])**2 + (pt2[1] - pt1[1])**2)
    
    interval = path_len / (n - 1) if path_len > 0 else 0.0
    if interval == 0.0:
        return [points[0]] * n
    
    new_points = [points[0]]
    d = 0.0
    i = 1
    # Work on a copy of points since we will insert intermediate values
    pts_copy = list(points)
    while i < len(pts_copy):
        pt1 = pts_copy[i - 1]
        pt2 = pts_copy[i]
        dist = math.sqrt((pt2[0] - pt1[0])**2 + (pt2[1] - pt1[1])**2)
        if d + dist >= interval:
            t = (interval - d) / dist if dist > 0 else 0.0
            qx = pt1[0] + t * (pt2[0] - pt1[0])
            qy = pt1[1] + t * (pt2[1] - pt1[1])
            new_points.append((qx, qy))
            pts_copy.insert(i, (qx, qy))
            d = 0.0
        else:
            d += dist
        i += 1
        
    while len(new_points) < n:
        new_points.append(points[-1])
    return new_points[:n]

# 2. Rotate by angle theta
def rotate_by(points, radians):
    cos_r = math.cos(radians)
    sin_r = math.sin(radians)
    cx, cy = centroid(points)
    rotated = []
    for x, y in points:
        dx = x - cx
        dy = y - cy
        rx = dx * cos_r - dy * sin_r + cx
        ry = dx * sin_r + dy * cos_r + cy
        rotated.append((rx, ry))
    return rotated

# 3. Calculate centroid
def centroid(points):
    sx = sum(p[0] for p in points)
    sy = sum(p[1] for p in points)
    return sx / len(points), sy / len(points)

# 4. Scale to square of size
def scale_to(points, size=250.0):
    min_x = min(p[0] for p in points)
    max_x = max(p[0] for p in points)
    min_y = min(p[1] for p in points)
    max_y = max(p[1] for p in points)
    w = max_x - min_x
    h = max_y - min_y
    w = max(0.001, w)
    h = max(0.001, h)
    
    scaled = []
    for x, y in points:
        sx = (x - min_x) * (size / w)
        sy = (y - min_y) * (size / h)
        scaled.append((sx, sy))
    return scaled

# 5. Translate centroid to origin
def translate_to(points, pt=(0.0, 0.0)):
    cx, cy = centroid(points)
    translated = []
    for x, y in points:
        tx = x - cx + pt[0]
        ty = y - cy + pt[1]
        translated.append((tx, ty))
    return translated

# 6. Distance at best angle (Golden Section Search)
def distance_at_best_angle(points, template, a=-45.0 * math.pi/180.0, b=45.0 * math.pi/180.0, threshold=2.0 * math.pi/180.0):
    phi = 0.5 * (-1.0 + math.sqrt(5.0))
    x1 = phi * a + (1.0 - phi) * b
    f1 = distance_at_angle(points, template, x1)
    x2 = (1.0 - phi) * a + phi * b
    f2 = distance_at_angle(points, template, x2)
    
    while abs(b - a) > threshold:
        if f1 < f2:
            b = x2
            x2 = x1
            f2 = f1
            x1 = phi * a + (1.0 - phi) * b
            f1 = distance_at_angle(points, template, x1)
        else:
            a = x1
            x1 = x2
            f1 = f2
            x2 = (1.0 - phi) * a + phi * b
            f2 = distance_at_angle(points, template, x2)
    return min(f1, f2)

def distance_at_angle(points, template, radians):
    pts = rotate_by(points, radians)
    return path_distance(pts, template)

def path_distance(pts1, pts2):
    d = 0.0
    for p1, p2 in zip(pts1, pts2):
        d += math.sqrt((p2[0] - p1[0])**2 + (p2[1] - p1[1])**2)
    return d / len(pts1)

# RDP path simplification (for corner extraction)
def rdp(points, epsilon):
    if len(points) < 3:
        return points
    
    max_dist = 0.0
    index = 0
    end = len(points) - 1
    
    for i in range(1, end):
        dist = perpendicular_distance(points[i], points[0], points[end])
        if dist > max_dist:
            max_dist = dist
            index = i
            
    if max_dist > epsilon:
        results1 = rdp(points[:index + 1], epsilon)
        results2 = rdp(points[index:], epsilon)
        return results1[:-1] + results2
    else:
        return [points[0], points[end]]

def perpendicular_distance(p, p1, p2):
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    denom = math.sqrt(dx * dx + dy * dy)
    if denom == 0:
        return math.sqrt((p[0] - p1[0]) ** 2 + (p[1] - p1[1]) ** 2)
    return abs(dy * p[0] - dx * p[1] + p2[0] * p1[1] - p2[1] * p1[0]) / denom

# Mathematical generation of template paths
def generate_line_template(n=64):
    return [(-125.0 + 250.0 * (i / (n - 1)), 0.0) for i in range(n)]

def generate_circle_template(n=64):
    return [(125.0 * math.cos(2.0 * math.pi * i / (n - 1)), 125.0 * math.sin(2.0 * math.pi * i / (n - 1))) for i in range(n)]

def generate_ellipse_template(n=64):
    return [(125.0 * math.cos(2.0 * math.pi * i / (n - 1)), 75.0 * math.sin(2.0 * math.pi * i / (n - 1))) for i in range(n)]

def generate_rect_template(n=64):
    points = []
    side_len = 250.0
    half = side_len / 2.0
    for i in range(n):
        t = i / (n - 1)
        pt = t * 4.0
        if pt <= 1.0:
            x, y = -half + side_len * pt, -half
        elif pt <= 2.0:
            x, y = half, -half + side_len * (pt - 1.0)
        elif pt <= 3.0:
            x, y = half - side_len * (pt - 2.0), half
        else:
            x, y = -half, half - side_len * (pt - 3.0)
        points.append((x, y))
    return points

def generate_triangle_template(n=64):
    half_w = 125.0 * math.sin(math.pi / 3)
    half_h = 125.0
    points = []
    for i in range(n):
        t = i / (n - 1)
        pt = t * 3.0
        if pt <= 1.0:
            x, y = half_w * pt, -half_h + (1.5 * half_h) * pt
        elif pt <= 2.0:
            x, y = half_w - (2.0 * half_w) * (pt - 1.0), 0.5 * half_h
        else:
            x, y = -half_w + half_w * (pt - 2.0), 0.5 * half_h - (1.5 * half_h) * (pt - 2.0)
        points.append((x, y))
    return points

# Initialize reference templates
TEMPLATES = {
    'line': translate_to(scale_to(resample(generate_line_template()))),
    'circle': translate_to(scale_to(resample(generate_circle_template()))),
    'ellipse': translate_to(scale_to(resample(generate_ellipse_template()))),
    'rect': translate_to(scale_to(resample(generate_rect_template()))),
    'triangle': translate_to(scale_to(resample(generate_triangle_template()))),
}

def prune_overshoot(points):
    if len(points) < 15:
        return points
        
    min_x = min(p[0] for p in points)
    max_x = max(p[0] for p in points)
    min_y = min(p[1] for p in points)
    max_y = max(p[1] for p in points)
    w = max_x - min_x
    h = max_y - min_y
    diagonal = math.sqrt(w*w + h*h)
    
    start_idx = int(len(points) * 0.6)
    min_dist = float('inf')
    best_idx = len(points) - 1
    
    start_pt = points[0]
    for i in range(start_idx, len(points)):
        pt = points[i]
        d = math.sqrt((pt[0] - start_pt[0])**2 + (pt[1] - start_pt[1])**2)
        if d < min_dist:
            min_dist = d
            best_idx = i
            
    threshold = max(70.0, 0.18 * diagonal)
    if min_dist < threshold and best_idx < len(points) - 1:
        return points[:best_idx + 1]
        
    return points

def prune_hooks(points):
    if len(points) < 10:
        return points
        
    total_len = 0.0
    for i in range(1, len(points)):
        total_len += math.sqrt((points[i][0] - points[i-1][0])**2 + (points[i][1] - points[i-1][1])**2)
        
    accum_len = 0.0
    prune_at = len(points) - 1
    for i in range(len(points) - 2, int(len(points) * 0.7), -1):
        dx1 = points[i][0] - points[i-1][0]
        dy1 = points[i][1] - points[i-1][1]
        dx2 = points[i+1][0] - points[i][0]
        dy2 = points[i+1][1] - points[i][1]
        
        len1 = math.sqrt(dx1*dx1 + dy1*dy1)
        len2 = math.sqrt(dx2*dx2 + dy2*dy2)
        
        accum_len += len2
        if accum_len > 0.15 * total_len:
            break
            
        if len1 > 0 and len2 > 0:
            cos_theta = (dx1*dx2 + dy1*dy2) / (len1 * len2)
            if cos_theta < 0.25:
                prune_at = i
                break
                
    return points[:prune_at + 1]

def predict_shape(points):
    if not points or len(points) < 8:
        return {'type': 'unknown', 'confidence': 0.0}
    
    # Prune overshoot and hooks
    points = prune_overshoot(points)
    points = prune_hooks(points)
    
    if len(points) < 8:
        return {'type': 'unknown', 'confidence': 0.0}
    
    # Extract bounding box from original points
    min_x = min(p[0] for p in points)
    max_x = max(p[0] for p in points)
    min_y = min(p[1] for p in points)
    max_y = max(p[1] for p in points)
    w = max_x - min_x
    h = max_y - min_y
    cx = (min_x + max_x) / 2
    cy = (min_y + max_y) / 2
    diagonal = math.sqrt(w * w + h * h)

    # Process points for template matching
    pts = [(p[0], p[1]) for p in points]
    pts = resample(pts)
    
    # Align indicative angle to 0
    scx, scy = centroid(pts)
    indicative_angle = math.atan2(pts[0][1] - scy, pts[0][0] - scx)
    pts = rotate_by(pts, -indicative_angle)
    pts = scale_to(pts)
    pts = translate_to(pts)
    
    best_score = float('inf')
    best_type = 'unknown'
    
    for shape_type, template in TEMPLATES.items():
        score = distance_at_best_angle(pts, template)
        if score < best_score:
            best_score = score
            best_type = shape_type
            
    # Calculate confidence: score < 40 is high confidence, score > 90 is low
    confidence = max(0.0, min(1.0, 1.0 - (best_score / 90.0)))
    
    # Calculate geometric parameters
    params = {}
    if best_type == 'line':
        params = {
            'startX': points[0][0],
            'startY': points[0][1],
            'endX': points[-1][0],
            'endY': points[-1][1]
        }
    elif best_type == 'circle':
        params = {
            'cx': cx,
            'cy': cy,
            'r': (w + h) / 4
        }
    elif best_type == 'rect':
        params = {
            'startX': min_x,
            'startY': min_y,
            'w': w,
            'h': h
        }
    elif best_type == 'ellipse':
        params = {
            'cx': cx,
            'cy': cy,
            'rx': w / 2,
            'ry': h / 2
        }
    elif best_type == 'triangle':
        # Simplify original points using RDP to find the 3 corners
        epsilon = diagonal * 0.045
        simplified = rdp([(p[0], p[1]) for p in points], epsilon)
        unique_verts = []
        for pt in simplified:
            if not unique_verts:
                unique_verts.append(pt)
            else:
                prev = unique_verts[-1]
                if math.sqrt((pt[0] - prev[0])**2 + (pt[1] - prev[1])**2) > diagonal * 0.1:
                    unique_verts.append(pt)
        
        # Ensure we have at least 3 vertices
        while len(unique_verts) < 3:
            unique_verts.append(points[-1])
            
        params = {
            'p1': {'x': unique_verts[0][0], 'y': unique_verts[0][1]},
            'p2': {'x': unique_verts[1][0], 'y': unique_verts[1][1]},
            'p3': {'x': unique_verts[2][0], 'y': unique_verts[2][1]}
        }
        
    return {
        'type': best_type,
        'confidence': confidence,
        'params': params
    }
