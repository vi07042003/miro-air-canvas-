// Geometric shape auto-correction and snapping detector
// Classifies freehand coordinate paths into Line, Circle, Ellipse, Rectangle, or Triangle

const pruneOvershoot = (points) => {
  if (points.length < 15) return points;

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const diagonal = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2);

  const startIdx = Math.floor(points.length * 0.6);
  let minDist = Infinity;
  let bestIdx = points.length - 1;
  const startPt = points[0];

  for (let i = startIdx; i < points.length; i++) {
    const pt = points[i];
    const d = Math.sqrt((pt.x - startPt.x) ** 2 + (pt.y - startPt.y) ** 2);
    if (d < minDist) {
      minDist = d;
      bestIdx = i;
    }
  }

  const threshold = Math.max(70, 0.18 * diagonal);
  if (minDist < threshold && bestIdx < points.length - 1) {
    return points.slice(0, bestIdx + 1);
  }
  return points;
};

const pruneHooks = (points) => {
  if (points.length < 10) return points;

  let totalLen = 0;
  for (let i = 1; i < points.length; i++) {
    totalLen += Math.sqrt((points[i].x - points[i - 1].x) ** 2 + (points[i].y - points[i - 1].y) ** 2);
  }

  let accumLen = 0;
  let pruneAt = points.length - 1;

  for (let i = points.length - 2; i > Math.floor(points.length * 0.7); i--) {
    const dx1 = points[i].x - points[i - 1].x;
    const dy1 = points[i].y - points[i - 1].y;
    const dx2 = points[i + 1].x - points[i].x;
    const dy2 = points[i + 1].y - points[i].y;

    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

    accumLen += len2;
    if (accumLen > 0.15 * totalLen) break;

    if (len1 > 0 && len2 > 0) {
      const cosTheta = (dx1 * dx2 + dy1 * dy2) / (len1 * len2);
      if (cosTheta < 0.25) {
        pruneAt = i;
        break;
      }
    }
  }

  return points.slice(0, pruneAt + 1);
};

export const detectAndFitShape = (rawPoints) => {
  if (!rawPoints || rawPoints.length < 12) return null;

  let points = pruneOvershoot(rawPoints);
  points = pruneHooks(points);

  if (points.length < 12) return null;

  // 1. Calculate bounding box
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const w = maxX - minX;
  const h = maxY - minY;
  const diagonal = Math.sqrt(w * w + h * h);

  // If bounding box is tiny, don't attempt to snap
  if (w < 15 || h < 15 || diagonal < 25) return null;

  // Calculate direct distance between start and end points
  const startPt = points[0];
  const endPt = points[points.length - 1];
  const directDist = Math.sqrt((endPt.x - startPt.x) ** 2 + (endPt.y - startPt.y) ** 2);

  // Calculate total path length
  let pathLength = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    pathLength += Math.sqrt(dx * dx + dy * dy);
  }

  // Calculate centroid
  let sumX = 0, sumY = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
  }
  const cx = sumX / points.length;
  const cy = sumY / points.length;

  // Calculate average distance to centroid
  let sumDist = 0;
  for (const p of points) {
    sumDist += Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
  }
  const avgDist = sumDist / points.length;

  // Calculate variance of distance to centroid (for circle detection)
  let sumVar = 0;
  for (const p of points) {
    const d = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
    sumVar += (d - avgDist) ** 2;
  }
  const stdDev = Math.sqrt(sumVar / points.length);
  const circleError = stdDev / avgDist;

  // Check if shape is closed (start and end points are close)
  const isClosed = directDist < 0.35 * diagonal || directDist < 75;

  // Aspect ratio
  const aspectRatio = w / h;

  // 2. Check: Line
  // If the total drawn path length is very close to the start-to-end direct distance, it's a straight line
  if (pathLength / Math.max(1, directDist) < 1.18) {
    return {
      type: 'line',
      params: { startX: startPt.x, startY: startPt.y, endX: endPt.x, endY: endPt.y }
    };
  }

  // 3. Check: Circle & Ellipse (Combined for high tolerance)
  // Compute error against an ellipse formula
  const rx = w / 2;
  const ry = h / 2;
  let ellipseErrorSum = 0;
  for (const p of points) {
    const termX = (p.x - cx) / rx;
    const termY = (p.y - cy) / ry;
    const distToEllipse = Math.abs(Math.sqrt(termX * termX + termY * termY) - 1);
    ellipseErrorSum += distToEllipse;
  }
  const avgEllipseError = ellipseErrorSum / points.length;

  // If it matches a circular shape directly
  if (circleError < 0.20 && isClosed) {
    if (aspectRatio >= 0.72 && aspectRatio <= 1.38) {
      return {
        type: 'circle',
        params: { cx, cy, r: (w + h) / 4 }
      };
    } else {
      return {
        type: 'ellipse',
        params: { cx, cy, rx, ry }
      };
    }
  }

  // If it has ellipse characteristics
  if (avgEllipseError < 0.18 && isClosed) {
    if (aspectRatio >= 0.72 && aspectRatio <= 1.38) {
      return {
        type: 'circle',
        params: { cx, cy, r: (w + h) / 4 }
      };
    } else {
      return {
        type: 'ellipse',
        params: { cx, cy, rx, ry }
      };
    }
  }

  // 4. Polygon detection using Ramer-Douglas-Peucker (RDP) path simplification
  const epsilon = diagonal * 0.045; // 4.5% of diagonal
  const simplified = rdp(points, epsilon);

  // Filter out simplified vertices that are too close to each other
  const uniqueVerts = [];
  for (const pt of simplified) {
    if (uniqueVerts.length === 0) {
      uniqueVerts.push(pt);
    } else {
      const prev = uniqueVerts[uniqueVerts.length - 1];
      const d = Math.sqrt((pt.x - prev.x) ** 2 + (pt.y - prev.y) ** 2);
      if (d > diagonal * 0.1) {
        uniqueVerts.push(pt);
      }
    }
  }

  // If the first and last points are close, close the loop
  const lastFirstDist = Math.sqrt(
    (uniqueVerts[uniqueVerts.length - 1].x - uniqueVerts[0].x) ** 2 +
    (uniqueVerts[uniqueVerts.length - 1].y - uniqueVerts[0].y) ** 2
  );
  if (lastFirstDist < diagonal * 0.2 && uniqueVerts.length > 2) {
    uniqueVerts[uniqueVerts.length - 1] = uniqueVerts[0];
  }

  // Count corners
  let numCorners = uniqueVerts.length;
  if (uniqueVerts[uniqueVerts.length - 1].x === uniqueVerts[0].x && uniqueVerts[uniqueVerts.length - 1].y === uniqueVerts[0].y) {
    numCorners = uniqueVerts.length - 1;
  }

  if (numCorners === 3) {
    // Triangle
    return {
      type: 'triangle',
      params: {
        p1: uniqueVerts[0],
        p2: uniqueVerts[1],
        p3: uniqueVerts[2]
      }
    };
  } else if (numCorners === 4) {
    // Rectangle
    return {
      type: 'rect',
      params: { startX: minX, startY: minY, w, h }
    };
  }

  return null;
};

// Ramer-Douglas-Peucker line simplification algorithm
function rdp(points, epsilon) {
  if (points.length < 3) return points;
  
  let maxDist = 0;
  let index = 0;
  const end = points.length - 1;
  
  for (let i = 1; i < end; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[end]);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }
  
  if (maxDist > epsilon) {
    const results1 = rdp(points.slice(0, index + 1), epsilon);
    const results2 = rdp(points.slice(index), epsilon);
    return results1.slice(0, results1.length - 1).concat(results2);
  } else {
    return [points[0], points[end]];
  }
}

// Calculate distance from point p to line segment (p1, p2)
function perpendicularDistance(p, p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const denom = Math.sqrt(dx * dx + dy * dy);
  if (denom === 0) return Math.sqrt((p.x - p1.x) ** 2 + (p.y - p1.y) ** 2);
  return Math.abs(dy * p.x - dx * p.y + p2.x * p1.y - p2.y * p1.x) / denom;
}
