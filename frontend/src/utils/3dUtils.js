// 3D Wireframe Canvas Projection & Drawing Math Helpers

export const project3DPoint = (x, y, z, rx, ry, zoom, width, height) => {
  // Rotate around Y axis
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const x1 = x * cosY - z * sinY;
  const z1 = x * sinY + z * cosY;

  // Rotate around X axis
  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  const y2 = y * cosX - z1 * sinX;
  const z2 = y * sinX + z1 * cosX;

  // Perspective projection
  const fov = 700;
  const cameraZ = 700 / zoom;
  const scaleProj = fov / (fov + z2 + cameraZ);
  
  const baseScale = 2.0;
  
  const screenX = (width / 2) + x1 * scaleProj * baseScale * zoom;
  const screenY = (height / 2) + y2 * scaleProj * baseScale * zoom;

  return { x: screenX, y: screenY, z: z2 };
};

export const unprojectPoint = (sx, sy, rx, ry, zoom, width, height) => {
  const fov = 700;
  const cameraZ = 700 / zoom;
  const baseScale = 2.0;
  const gridY = 100; // Snap shape placement to grid floor plane

  const dx = (sx - width / 2) / (baseScale * zoom);
  const dy = (sy - height / 2) / (baseScale * zoom);

  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);

  const C = fov + gridY * sinX + cameraZ;
  const denom = dy * cosX + fov * sinX;
  
  // Avoid division by zero
  const z1 = Math.abs(denom) > 0.001 
    ? (fov * gridY * cosX - dy * C) / denom 
    : 0;

  const z2 = gridY * sinX + z1 * cosX;
  const scaleProj = fov / (fov + z2 + cameraZ);
  const x1 = dx / scaleProj;

  const x = x1 * cosY + z1 * sinY;
  const z = -x1 * sinY + z1 * cosY;

  return { x, y: gridY, z };
};

export const drawViewportGrid = (ctx, rx, ry, zoom, width, height) => {
  ctx.save();
  const gridY = 100; // Place grid floor at standard baseline
  
  for (let x = -350; x <= 350; x += 50) {
    ctx.beginPath();
    let baseAlpha = 0.12;
    if (x === 0) {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.lineWidth = 1.5;
      baseAlpha = 0.4;
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
    }
    const pStart = project3DPoint(x, gridY, -350, rx, ry, zoom, width, height);
    const pEnd = project3DPoint(x, gridY, 350, rx, ry, zoom, width, height);
    
    // Average depth of the segment
    const segmentZ = (pStart.z + pEnd.z) / 2;
    const k = (segmentZ + 300) / 600;
    const depthCue = Math.max(0.1, Math.min(1.0, 1.0 - k * 0.8));
    
    if (x === 0) {
      ctx.strokeStyle = `rgba(239, 68, 68, ${baseAlpha * depthCue})`;
    } else {
      ctx.strokeStyle = `rgba(255, 255, 255, ${baseAlpha * depthCue})`;
    }
    
    ctx.moveTo(pStart.x, pStart.y);
    ctx.lineTo(pEnd.x, pEnd.y);
    ctx.stroke();
  }
  
  for (let z = -350; z <= 350; z += 50) {
    ctx.beginPath();
    let baseAlpha = 0.12;
    if (z === 0) {
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
      ctx.lineWidth = 1.5;
      baseAlpha = 0.4;
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
    }
    const pStart = project3DPoint(-350, gridY, z, rx, ry, zoom, width, height);
    const pEnd = project3DPoint(350, gridY, z, rx, ry, zoom, width, height);
    
    // Average depth of the segment
    const segmentZ = (pStart.z + pEnd.z) / 2;
    const k = (segmentZ + 300) / 600;
    const depthCue = Math.max(0.1, Math.min(1.0, 1.0 - k * 0.8));
    
    if (z === 0) {
      ctx.strokeStyle = `rgba(16, 185, 129, ${baseAlpha * depthCue})`;
    } else {
      ctx.strokeStyle = `rgba(255, 255, 255, ${baseAlpha * depthCue})`;
    }
    
    ctx.moveTo(pStart.x, pStart.y);
    ctx.lineTo(pEnd.x, pEnd.y);
    ctx.stroke();
  }
  ctx.restore();
};

export const drawWireframeCanvasBox = (ctx, rx, ry, zoom, width, height) => {
  ctx.save();
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.25)'; // Sleek neon violet frame matching Miro aesthetics
  ctx.lineWidth = 1.5;
  
  const hW = 350; // half width
  const hH = 200; // half height
  const hD = 350; // half depth
  
  // 8 vertices of the wireframe bounding box
  const vertices = [
    { x: -hW, y: -hH, z: -hD },
    { x: hW, y: -hH, z: -hD },
    { x: hW, y: hH, z: -hD },
    { x: -hW, y: hH, z: -hD },
    { x: -hW, y: -hH, z: hD },
    { x: hW, y: -hH, z: hD },
    { x: hW, y: hH, z: hD },
    { x: -hW, y: hH, z: hD }
  ];
  
  // Project vertices
  const proj = vertices.map(v => project3DPoint(v.x, v.y, v.z, rx, ry, zoom, width, height));
  
  // 12 edges
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0], // Back face
    [4, 5], [5, 6], [6, 7], [7, 4], // Front face
    [0, 4], [1, 5], [2, 6], [3, 7]  // Connecting segments
  ];
  
  ctx.beginPath();
  edges.forEach(([s, e]) => {
    ctx.moveTo(proj[s].x, proj[s].y);
    ctx.lineTo(proj[e].x, proj[e].y);
  });
  ctx.stroke();
  
  // Draw corner labels for style
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.font = '9px monospace';
  ctx.fillText("3D CANVAS LIMITS", proj[0].x + 10, proj[0].y + 15);
  ctx.restore();
};

export const drawAxisHelper = (ctx, rx, ry) => {
  const cornerX = 70;
  const cornerY = 80;
  const axisLen = 35;
  const pCenter = { x: cornerX, y: cornerY };
  
  const projectAxis = (ax, ay, az) => {
    const cosY = Math.cos(ry);
    const sinY = Math.sin(ry);
    const x1 = ax * cosY - az * sinY;
    const z1 = ax * sinY + az * cosY;
    const cosX = Math.cos(rx);
    const sinX = Math.sin(rx);
    const y2 = ay * cosX - z1 * sinX;
    return {
      x: cornerX + x1 * axisLen,
      y: cornerY + y2 * axisLen
    };
  };
  
  const pX = projectAxis(1, 0, 0);
  const pY = projectAxis(0, -1, 0);
  const pZ = projectAxis(0, 0, 1);
  
  ctx.save();
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pCenter.x, pCenter.y);
  ctx.lineTo(pX.x, pX.y);
  ctx.stroke();
  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('X', pX.x + 3, pX.y + 3);
  
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pCenter.x, pCenter.y);
  ctx.lineTo(pY.x, pY.y);
  ctx.stroke();
  ctx.fillStyle = '#3b82f6';
  ctx.fillText('Y', pY.x + 3, pY.y + 3);
  
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pCenter.x, pCenter.y);
  ctx.lineTo(pZ.x, pZ.y);
  ctx.stroke();
  ctx.fillStyle = '#10b981';
  ctx.fillText('Z', pZ.x + 3, pZ.y + 3);
  
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(pCenter.x, pCenter.y, 3, 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();
};

export const getMesh = (type, size) => {
  const vertices = [];
  const edges = [];
  
  if (type === 'cube') {
    const s = size;
    vertices.push({x: -s, y: -s, z: -s});
    vertices.push({x: s, y: -s, z: -s});
    vertices.push({x: s, y: s, z: -s});
    vertices.push({x: -s, y: s, z: -s});
    vertices.push({x: -s, y: -s, z: s});
    vertices.push({x: s, y: -s, z: s});
    vertices.push({x: s, y: s, z: s});
    vertices.push({x: -s, y: s, z: s});
    
    edges.push([0, 1], [1, 2], [2, 3], [3, 0]);
    edges.push([4, 5], [5, 6], [6, 7], [7, 4]);
    edges.push([0, 4], [1, 5], [2, 6], [3, 7]);
  } else if (type === 'pyramid') {
    const w = size;
    const h = size * 1.5;
    vertices.push({x: -w, y: h/2, z: -w});
    vertices.push({x: w, y: h/2, z: -w});
    vertices.push({x: w, y: h/2, z: w});
    vertices.push({x: -w, y: h/2, z: w});
    vertices.push({x: 0, y: -h/2, z: 0});
    
    edges.push([0, 1], [1, 2], [2, 3], [3, 0]);
    edges.push([0, 4], [1, 4], [2, 4], [3, 4]);
  } else if (type === 'cylinder') {
    const r = size;
    const h = size * 1.8;
    const segments = 12;
    for (let i = 0; i < segments; i++) {
      const angle = (i * 2 * Math.PI) / segments;
      vertices.push({x: r * Math.cos(angle), y: -h/2, z: r * Math.sin(angle)});
      vertices.push({x: r * Math.cos(angle), y: h/2, z: r * Math.sin(angle)});
    }
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      edges.push([i*2, next*2]);
      edges.push([i*2+1, next*2+1]);
      edges.push([i*2, i*2+1]);
    }
  } else if (type === 'cone') {
    const r = size;
    const h = size * 1.8;
    const segments = 12;
    for (let i = 0; i < segments; i++) {
      const angle = (i * 2 * Math.PI) / segments;
      vertices.push({x: r * Math.cos(angle), y: h/2, z: r * Math.sin(angle)});
    }
    vertices.push({x: 0, y: -h/2, z: 0});
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      edges.push([i, next]);
      edges.push([i, segments]);
    }
  } else if (type === 'sphere') {
    const r = size;
    const stacks = 6;
    const slices = 10;
    for (let lat = 0; lat <= stacks; lat++) {
      const phi = (lat * Math.PI) / stacks;
      for (let lon = 0; lon < slices; lon++) {
        const theta = (lon * 2 * Math.PI) / slices;
        vertices.push({
          x: r * Math.sin(phi) * Math.cos(theta),
          y: r * Math.cos(phi),
          z: r * Math.sin(phi) * Math.sin(theta)
        });
      }
    }
    for (let lat = 0; lat < stacks; lat++) {
      for (let lon = 0; lon < slices; lon++) {
        const current = lat * slices + lon;
        const nextLon = lat * slices + ((lon + 1) % slices);
        const nextLat = (lat + 1) * slices + lon;
        edges.push([current, nextLon]);
        edges.push([current, nextLat]);
      }
    }
  }
  
  return { vertices, edges };
};

export const drawMesh = (ctx, mesh, pos, rotation, rx, ry, zoom, baseScale, width, height, color, opacity, size) => {
  ctx.save();
  
  const projectedVertices = mesh.vertices.map(v => {
    const wx = v.x + pos.x;
    const wy = v.y + pos.y;
    const wz = v.z + pos.z;
    return project3DPoint(wx, wy, wz, rx, ry, zoom, width, height);
  });
  
  // Calculate average depth of the entire mesh
  let avgZ = 0;
  projectedVertices.forEach(v => {
    avgZ += v.z;
  });
  avgZ /= Math.max(1, projectedVertices.length);
  
  const k = (avgZ + 300) / 600;
  const depthCue = Math.max(0.15, Math.min(1.2, 1.2 - k * 0.95));
  
  ctx.strokeStyle = color;
  ctx.globalAlpha = opacity * depthCue;
  ctx.lineWidth = (size || 2) * depthCue;
  
  mesh.edges.forEach(([s, e]) => {
    if (projectedVertices[s] && projectedVertices[e]) {
      ctx.beginPath();
      ctx.moveTo(projectedVertices[s].x, projectedVertices[s].y);
      ctx.lineTo(projectedVertices[e].x, projectedVertices[e].y);
      ctx.stroke();
    }
  });
  
  ctx.fillStyle = color;
  ctx.globalAlpha = opacity * depthCue * 0.9;
  projectedVertices.forEach(pv => {
    ctx.fillRect(pv.x - 2, pv.y - 2, 4, 4);
  });
  
  ctx.restore();
};

export const draw3DStroke = (ctx, strokePoints, rx, ry, zoom, baseScale, width, height, color, opacity, size) => {
  if (!strokePoints || strokePoints.length < 2) return;
  
  let avgZ = 0;
  const projected = [];
  strokePoints.forEach(pt => {
    const proj = project3DPoint(pt.x, pt.y, pt.z, rx, ry, zoom, width, height);
    projected.push(proj);
    avgZ += proj.z;
  });
  avgZ /= strokePoints.length;
  
  const k = (avgZ + 300) / 600;
  const depthCue = Math.max(0.15, Math.min(1.2, 1.2 - k * 0.95));
  
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = opacity * depthCue;
  ctx.lineWidth = (size || 3) * depthCue;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  ctx.beginPath();
  ctx.moveTo(projected[0].x, projected[0].y);
  for (let i = 1; i < projected.length; i++) {
    ctx.lineTo(projected[i].x, projected[i].y);
  }
  ctx.stroke();
  ctx.restore();
};

export const getPrimitiveFaces = (type, offset) => {
  const localFaces = [];
  if (type === 'cube') {
    localFaces.push(
      [4, 5, 6, 7], // Front
      [1, 0, 3, 2], // Back
      [0, 1, 5, 4], // Top
      [3, 7, 6, 2], // Bottom
      [0, 4, 7, 3], // Left
      [1, 2, 6, 5]  // Right
    );
  } else if (type === 'pyramid') {
    localFaces.push(
      [0, 3, 2, 1], // Base
      [0, 1, 4],    // Sides
      [1, 2, 4],
      [2, 3, 4],
      [3, 0, 4]
    );
  } else if (type === 'cylinder') {
    const segments = 12;
    // Top cap (odd indices)
    const topCap = [];
    for (let i = 0; i < segments; i++) {
      topCap.push(i * 2 + 1);
    }
    localFaces.push(topCap);
    
    // Bottom cap (even indices, reversed)
    const bottomCap = [];
    for (let i = segments - 1; i >= 0; i--) {
      bottomCap.push(i * 2);
    }
    localFaces.push(bottomCap);
    
    // Sides
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      localFaces.push([
        i * 2,
        next * 2,
        next * 2 + 1,
        i * 2 + 1
      ]);
    }
  } else if (type === 'cone') {
    const segments = 12;
    // Base cap
    const baseCap = [];
    for (let i = segments - 1; i >= 0; i--) {
      baseCap.push(i);
    }
    localFaces.push(baseCap);
    
    // Sides
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      localFaces.push([i, next, segments]);
    }
  } else if (type === 'sphere') {
    const stacks = 6;
    const slices = 10;
    for (let lat = 0; lat < stacks; lat++) {
      for (let lon = 0; lon < slices; lon++) {
        const current = lat * slices + lon;
        const nextLon = lat * slices + ((lon + 1) % slices);
        const nextLat = (lat + 1) * slices + lon;
        const nextLatLon = (lat + 1) * slices + ((lon + 1) % slices);
        
        localFaces.push([
          current,
          nextLon,
          nextLatLon,
          nextLat
        ]);
      }
    }
  }
  return localFaces.map(face => face.map(idx => offset + idx));
};

export const getSolidGeometry = (type, size) => {
  const vertices = [];
  const faces = [];
  
  if (type === 'cube') {
    const s = size;
    vertices.push(
      {x: -s, y: -s, z: -s},
      {x: s, y: -s, z: -s},
      {x: s, y: s, z: -s},
      {x: -s, y: s, z: -s},
      {x: -s, y: -s, z: s},
      {x: s, y: -s, z: s},
      {x: s, y: s, z: s},
      {x: -s, y: s, z: s}
    );
    faces.push(
      [4, 5, 6, 7], // Front
      [1, 0, 3, 2], // Back
      [0, 1, 5, 4], // Top
      [3, 7, 6, 2], // Bottom
      [0, 4, 7, 3], // Left
      [1, 2, 6, 5]  // Right
    );
  } else if (type === 'pyramid') {
    const w = size;
    const h = size * 1.5;
    vertices.push(
      {x: -w, y: h/2, z: -w},
      {x: w, y: h/2, z: -w},
      {x: w, y: h/2, z: w},
      {x: -w, y: h/2, z: w},
      {x: 0, y: -h/2, z: 0}
    );
    faces.push(
      [0, 3, 2, 1], // Base
      [0, 1, 4],    // Side 1
      [1, 2, 4],    // Side 2
      [2, 3, 4],    // Side 3
      [3, 0, 4]     // Side 4
    );
  } else if (type === 'cylinder') {
    const r = size;
    const h = size * 1.8;
    const segments = 12;
    for (let i = 0; i < segments; i++) {
      const angle = (i * 2 * Math.PI) / segments;
      vertices.push({x: r * Math.cos(angle), y: -h/2, z: r * Math.sin(angle)});
      vertices.push({x: r * Math.cos(angle), y: h/2, z: r * Math.sin(angle)});
    }
    const topCap = [];
    for (let i = 0; i < segments; i++) {
      topCap.push(i * 2 + 1);
    }
    faces.push(topCap);
    
    const bottomCap = [];
    for (let i = segments - 1; i >= 0; i--) {
      bottomCap.push(i * 2);
    }
    faces.push(bottomCap);
    
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      faces.push([
        i * 2,
        next * 2,
        next * 2 + 1,
        i * 2 + 1
      ]);
    }
  } else if (type === 'cone') {
    const r = size;
    const h = size * 1.8;
    const segments = 12;
    for (let i = 0; i < segments; i++) {
      const angle = (i * 2 * Math.PI) / segments;
      vertices.push({x: r * Math.cos(angle), y: h/2, z: r * Math.sin(angle)});
    }
    vertices.push({x: 0, y: -h/2, z: 0});
    
    const baseCap = [];
    for (let i = segments - 1; i >= 0; i--) {
      baseCap.push(i);
    }
    faces.push(baseCap);
    
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      faces.push([i, next, segments]);
    }
  } else if (type === 'sphere') {
    const r = size;
    const stacks = 6;
    const slices = 10;
    for (let lat = 0; lat <= stacks; lat++) {
      const phi = (lat * Math.PI) / stacks;
      for (let lon = 0; lon < slices; lon++) {
        const theta = (lon * 2 * Math.PI) / slices;
        vertices.push({
          x: r * Math.sin(phi) * Math.cos(theta),
          y: r * Math.cos(phi),
          z: r * Math.sin(phi) * Math.sin(theta)
        });
      }
    }
    for (let lat = 0; lat < stacks; lat++) {
      for (let lon = 0; lon < slices; lon++) {
        const current = lat * slices + lon;
        const nextLon = lat * slices + ((lon + 1) % slices);
        const nextLat = (lat + 1) * slices + lon;
        const nextLatLon = (lat + 1) * slices + ((lon + 1) % slices);
        faces.push([
          current,
          nextLon,
          nextLatLon,
          nextLat
        ]);
      }
    }
  }
  return { vertices, faces };
};

export const generateOBJString = (objects, renderMode = 'solid') => {
  if (!objects || objects.length === 0) return "# Empty Miro Air Canvas Model";
  
  let objText = "# Miro Air Canvas 3D Model Export\n";
  objText += `# Created: ${new Date().toISOString()}\n`;
  objText += `# Render Mode: ${renderMode}\n\n`;
  
  let vertexOffset = 1;
  
  objects.forEach((obj, idx) => {
    const objName = `${obj.type}_${idx + 1}`;
    objText += `o ${objName}\n`;
    objText += `g ${objName}\n`;
    objText += `# Object ${idx + 1}: ${obj.type}\n`;
    
    if (obj.type === 'stroke') {
      if (!obj.points || obj.points.length === 0) return;
      
      obj.points.forEach(pt => {
        objText += `v ${pt.x.toFixed(4)} ${(-pt.y).toFixed(4)} ${pt.z.toFixed(4)}\n`;
      });
      
      if (renderMode === 'point') {
        objText += "p";
        for (let i = 0; i < obj.points.length; i++) {
          objText += ` ${vertexOffset + i}`;
        }
        objText += "\n\n";
      } else {
        objText += "l";
        for (let i = 0; i < obj.points.length; i++) {
          objText += ` ${vertexOffset + i}`;
        }
        objText += "\n\n";
      }
      
      vertexOffset += obj.points.length;
    } else {
      const geom = getSolidGeometry(obj.type, obj.size);
      if (!geom || !geom.vertices) return;
      
      geom.vertices.forEach(v => {
        const wx = v.x + obj.pos.x;
        const wy = v.y + obj.pos.y;
        const wz = v.z + obj.pos.z;
        objText += `v ${wx.toFixed(4)} ${(-wy).toFixed(4)} ${wz.toFixed(4)}\n`;
      });
      
      if (renderMode === 'point') {
        objText += "p";
        for (let i = 0; i < geom.vertices.length; i++) {
          objText += ` ${vertexOffset + i}`;
        }
        objText += "\n\n";
      } else if (renderMode === 'wireframe') {
        const mesh = getMesh(obj.type, obj.size);
        if (mesh && mesh.edges) {
          mesh.edges.forEach(([s, e]) => {
            objText += `l ${vertexOffset + s} ${vertexOffset + e}\n`;
          });
        }
        objText += "\n";
      } else {
        const faces = getPrimitiveFaces(obj.type, vertexOffset);
        faces.forEach(f => {
          objText += `f ${f.join(' ')}\n`;
        });
        objText += "\n";
      }
      
      vertexOffset += geom.vertices.length;
    }
  });
  
  return objText;
};

export const shadeColor = (color, intensity) => {
  let hex = color.replace('#', '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  let r = parseInt(hex.substring(0, 2), 16) || 0;
  let g = parseInt(hex.substring(2, 4), 16) || 0;
  let b = parseInt(hex.substring(4, 6), 16) || 0;
  
  r = Math.min(255, Math.max(0, Math.round(r * intensity)));
  g = Math.min(255, Math.max(0, Math.round(g * intensity)));
  b = Math.min(255, Math.max(0, Math.round(b * intensity)));
  
  return `rgb(${r}, ${g}, ${b})`;
};

export const drawCoordinateAxisCompass = (ctx, cameraState, width, height) => {
  ctx.save();
  const compassX = 55;
  const compassY = height - 55;
  const axisLen = 30;
  
  const projectAxis = (ax, ay, az) => {
    const cosY = Math.cos(cameraState.ry);
    const sinY = Math.sin(cameraState.ry);
    let x1 = ax * cosY - az * sinY;
    let z1 = ax * sinY + az * cosY;

    const cosX = Math.cos(cameraState.rx);
    const sinX = Math.sin(cameraState.rx);
    let y2 = ay * cosX - z1 * sinX;
    
    return {
      x: compassX + x1 * axisLen,
      y: compassY + y2 * axisLen
    };
  };
  
  const pX = projectAxis(1, 0, 0);
  const pY = projectAxis(0, -1, 0);
  const pZ = projectAxis(0, 0, 1);
  
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(compassX, compassY);
  ctx.lineTo(pX.x, pX.y);
  ctx.stroke();
  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('X', pX.x + 3, pX.y + 3);
  
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(compassX, compassY);
  ctx.lineTo(pY.x, pY.y);
  ctx.stroke();
  ctx.fillStyle = '#10b981';
  ctx.fillText('Y', pY.x + 3, pY.y + 3);
  
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(compassX, compassY);
  ctx.lineTo(pZ.x, pZ.y);
  ctx.stroke();
  ctx.fillStyle = '#06b6d4';
  ctx.fillText('Z', pZ.x + 3, pZ.y + 3);
  
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(compassX, compassY, 3, 0, 2*Math.PI);
  ctx.fill();
  
  ctx.restore();
};

export const drawModel = (canvas, objects, cameraState, renderMode, lightAngle) => {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  
  ctx.fillStyle = '#0a0518';
  ctx.fillRect(0, 0, width, height);
  
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  const gridY = 150;
  const gridSize = 400;
  const gridStep = 50;
  
  for (let x = -gridSize; x <= gridSize; x += gridStep) {
    const pStart = project3DPoint(x, gridY, -gridSize, cameraState.rx, cameraState.ry, cameraState.scale, width, height);
    const pEnd = project3DPoint(x, gridY, gridSize, cameraState.rx, cameraState.ry, cameraState.scale, width, height);
    ctx.beginPath();
    ctx.moveTo(pStart.x, pStart.y);
    ctx.lineTo(pEnd.x, pEnd.y);
    ctx.stroke();
  }
  for (let z = -gridSize; z <= gridSize; z += gridStep) {
    const pStart = project3DPoint(-gridSize, gridY, z, cameraState.rx, cameraState.ry, cameraState.scale, width, height);
    const pEnd = project3DPoint(gridSize, gridY, z, cameraState.rx, cameraState.ry, cameraState.scale, width, height);
    ctx.beginPath();
    ctx.moveTo(pStart.x, pStart.y);
    ctx.lineTo(pEnd.x, pEnd.y);
    ctx.stroke();
  }
  
  const rad = (lightAngle * Math.PI) / 180;
  const lx = Math.cos(rad) * 0.7;
  const ly = -0.6;
  const lz = Math.sin(rad) * 0.7;
  const lLength = Math.sqrt(lx*lx + ly*ly + lz*lz);
  const lightDir = { x: lx / lLength, y: ly / lLength, z: lz / lLength };
  
  const renderables = [];
  
  objects.forEach((obj) => {
    if (obj.type === 'stroke') {
      if (!obj.points || obj.points.length === 0) return;
      
      const pts = obj.points.map(pt => project3DPoint(pt.x, pt.y, pt.z, cameraState.rx, cameraState.ry, cameraState.scale, width, height));
      
      if (renderMode === 'point') {
        pts.forEach((pt) => {
          renderables.push({
            type: 'point',
            z: pt.z,
            x: pt.x,
            y: pt.y,
            color: obj.color,
            size: obj.size || 4,
            opacity: obj.opacity || 1.0
          });
        });
      } else {
        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = pts[i];
          const p2 = pts[i + 1];
          const avgZ = (p1.z + p2.z) / 2;
          
          renderables.push({
            type: 'line',
            z: avgZ,
            p1: p1,
            p2: p2,
            color: obj.color,
            width: obj.size || 2,
            opacity: obj.opacity || 1.0
          });
        }
      }
    } else {
      const geom = getSolidGeometry(obj.type, obj.size);
      if (!geom) return;
      
      const projVerts = geom.vertices.map(v => {
        const wx = v.x + obj.pos.x;
        const wy = v.y + obj.pos.y;
        const wz = v.z + obj.pos.z;
        return project3DPoint(wx, wy, wz, cameraState.rx, cameraState.ry, cameraState.scale, width, height);
      });
      
      if (renderMode === 'point') {
        projVerts.forEach((pv) => {
          renderables.push({
            type: 'point',
            z: pv.z,
            x: pv.x,
            y: pv.y,
            color: obj.color,
            size: 6,
            opacity: obj.opacity || 1.0
          });
        });
      } else if (renderMode === 'wireframe') {
        const mesh = getMesh(obj.type, obj.size);
        mesh.edges.forEach(([s, e]) => {
          if (projVerts[s] && projVerts[e]) {
            const avgZ = (projVerts[s].z + projVerts[e].z) / 2;
            renderables.push({
              type: 'line',
              z: avgZ,
              p1: projVerts[s],
              p2: projVerts[e],
              color: obj.color,
              width: 2,
              opacity: obj.opacity || 1.0
            });
          }
        });
      } else {
        geom.faces.forEach((face) => {
          if (face.length < 3) return;
          const v3d = face.map(idx => {
            const v = geom.vertices[idx];
            return {
              x: v.x + obj.pos.x,
              y: v.y + obj.pos.y,
              z: v.z + obj.pos.z
            };
          });
          
          const ux = v3d[1].x - v3d[0].x;
          const uy = v3d[1].y - v3d[0].y;
          const uz = v3d[1].z - v3d[0].z;
          
          const vx = v3d[2].x - v3d[0].x;
          const vy = v3d[2].y - v3d[0].y;
          const vz = v3d[2].z - v3d[0].z;
          
          let nx = uy*vz - uz*vy;
          let ny = uz*vx - ux*vz;
          let nz = ux*vy - uy*vx;
          
          const nLen = Math.sqrt(nx*nx + ny*ny + nz*nz);
          if (nLen > 0) {
            nx /= nLen;
            ny /= nLen;
            nz /= nLen;
          }
          
          const dot = nx*lightDir.x + ny*lightDir.y + nz*lightDir.z;
          const intensity = 0.35 + 0.65 * Math.max(0, dot);
          const faceColor = shadeColor(obj.color, intensity);
          
          let avgZ = 0;
          face.forEach(idx => {
            avgZ += projVerts[idx].z;
          });
          avgZ /= face.length;
          
          const points2D = face.map(idx => projVerts[idx]);
          
          renderables.push({
            type: 'face',
            z: avgZ,
            points: points2D,
            color: faceColor,
            outlineColor: obj.color,
            opacity: obj.opacity || 1.0
          });
        });
      }
    }
  });
  
  renderables.sort((a, b) => b.z - a.z);
  
  renderables.forEach((item) => {
    if (item.type === 'point') {
      ctx.save();
      ctx.fillStyle = item.color;
      ctx.globalAlpha = item.opacity;
      
      const k = (item.z + 300) / 600;
      const depthCue = Math.max(0.2, Math.min(1.2, 1.2 - k * 0.95));
      const r = item.size * depthCue;
      
      ctx.beginPath();
      ctx.arc(item.x, item.y, r, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = item.opacity * 0.4;
      ctx.beginPath();
      ctx.arc(item.x, item.y, r * 1.8, 0, 2 * Math.PI);
      ctx.stroke();
      
      ctx.restore();
    } else if (item.type === 'line') {
      ctx.save();
      ctx.strokeStyle = item.color;
      ctx.globalAlpha = item.opacity;
      
      const k = (item.z + 300) / 600;
      const depthCue = Math.max(0.15, Math.min(1.2, 1.2 - k * 0.95));
      ctx.lineWidth = item.width * depthCue;
      
      ctx.beginPath();
      ctx.moveTo(item.p1.x, item.p1.y);
      ctx.lineTo(item.p2.x, item.p2.y);
      ctx.stroke();
      ctx.restore();
    } else if (item.type === 'face') {
      ctx.save();
      ctx.fillStyle = item.color;
      ctx.globalAlpha = item.opacity * 0.45; // Semi-transparent glassmorphic face
      
      ctx.beginPath();
      ctx.moveTo(item.points[0].x, item.points[0].y);
      for (let i = 1; i < item.points.length; i++) {
        ctx.lineTo(item.points[i].x, item.points[i].y);
      }
      ctx.closePath();
      ctx.fill();

      // Sharp glass outline/rim
      ctx.strokeStyle = item.outlineColor;
      ctx.globalAlpha = item.opacity * 0.8;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    }
  });
  
  drawCoordinateAxisCompass(ctx, cameraState, width, height);
};

export const getModelStats = (objects) => {
  let objectCount = objects.length;
  let strokeCount = 0;
  let shapeCount = 0;
  let totalVertices = 0;
  let totalFaces = 0;
  
  objects.forEach(obj => {
    if (obj.type === 'stroke') {
      strokeCount++;
      if (obj.points) {
        totalVertices += obj.points.length;
      }
    } else {
      shapeCount++;
      const mesh = getSolidGeometry(obj.type, obj.size);
      if (mesh) {
        totalVertices += mesh.vertices.length;
        totalFaces += mesh.faces.length;
      }
    }
  });
  
  return { objectCount, strokeCount, shapeCount, totalVertices, totalFaces };
};
