export const drawShapePath = (ctx, shapeType, startX, startY, drawX, drawY) => {
  const w = drawX - startX
  const h = drawY - startY
  const cx = startX + w / 2
  const cy = startY + h / 2

  if (shapeType === 'line') {
    ctx.moveTo(startX, startY)
    ctx.lineTo(drawX, drawY)
  } else if (shapeType === 'arrow') {
    ctx.moveTo(startX, startY)
    ctx.lineTo(drawX, drawY)
    const angle = Math.atan2(drawY - startY, drawX - startX)
    const headLen = Math.max(12, ctx.lineWidth * 1.5)
    ctx.lineTo(drawX - headLen * Math.cos(angle - Math.PI / 6), drawY - headLen * Math.sin(angle - Math.PI / 6))
    ctx.moveTo(drawX, drawY)
    ctx.lineTo(drawX - headLen * Math.cos(angle + Math.PI / 6), drawY - headLen * Math.sin(angle + Math.PI / 6))
  } else if (shapeType === 'double-arrow') {
    ctx.moveTo(startX, startY)
    ctx.lineTo(drawX, drawY)
    const angle = Math.atan2(drawY - startY, drawX - startX)
    const headLen = Math.max(12, ctx.lineWidth * 1.5)
    ctx.lineTo(drawX - headLen * Math.cos(angle - Math.PI / 6), drawY - headLen * Math.sin(angle - Math.PI / 6))
    ctx.moveTo(drawX, drawY)
    ctx.lineTo(drawX - headLen * Math.cos(angle + Math.PI / 6), drawY - headLen * Math.sin(angle + Math.PI / 6))
    
    ctx.moveTo(startX, startY)
    ctx.lineTo(startX + headLen * Math.cos(angle - Math.PI / 6), startY + headLen * Math.sin(angle - Math.PI / 6))
    ctx.moveTo(startX, startY)
    ctx.lineTo(startX + headLen * Math.cos(angle + Math.PI / 6), startY + headLen * Math.sin(angle + Math.PI / 6))
  } else if (shapeType === 'rect') {
    ctx.rect(startX, startY, w, h)
  } else if (shapeType === 'circle') {
    const r = Math.sqrt(w * w + h * h) / 2
    ctx.arc(cx, cy, r, 0, 2 * Math.PI)
  } else if (shapeType === 'ellipse') {
    ctx.ellipse(cx, cy, Math.abs(w / 2), Math.abs(h / 2), 0, 0, 2 * Math.PI)
  } else if (shapeType === 'ring') {
    ctx.ellipse(cx, cy, Math.abs(w / 2), Math.abs(h / 2), 0, 0, 2 * Math.PI)
    ctx.ellipse(cx, cy, Math.abs(w / 3), Math.abs(h / 3), 0, 0, 2 * Math.PI)
  } else if (shapeType === 'triangle') {
    ctx.moveTo(startX + w / 2, startY)
    ctx.lineTo(drawX, drawY)
    ctx.lineTo(startX, drawY)
    ctx.closePath()
  } else if (shapeType === 'diamond') {
    ctx.moveTo(cx, startY)
    ctx.lineTo(drawX, cy)
    ctx.lineTo(cx, drawY)
    ctx.lineTo(startX, cy)
    ctx.closePath()
  } else if (shapeType === 'pentagon') {
    const r = Math.min(Math.abs(w), Math.abs(h)) / 2
    for (let i = 0; i < 5; i++) {
      const angle = (i * 2 * Math.PI / 5) - Math.PI / 2
      const px = cx + Math.cos(angle) * r
      const py = cy + Math.sin(angle) * r
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
  } else if (shapeType === 'hexagon') {
    const r = Math.min(Math.abs(w), Math.abs(h)) / 2
    for (let i = 0; i < 6; i++) {
      const angle = (i * 2 * Math.PI / 6) - Math.PI / 2
      const px = cx + Math.cos(angle) * r
      const py = cy + Math.sin(angle) * r
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
  } else if (shapeType === 'octagon') {
    const r = Math.min(Math.abs(w), Math.abs(h)) / 2
    for (let i = 0; i < 8; i++) {
      const angle = (i * 2 * Math.PI / 8) - Math.PI / 2
      const px = cx + Math.cos(angle) * r
      const py = cy + Math.sin(angle) * r
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
  } else if (shapeType === 'star') {
    const r = Math.min(Math.abs(w), Math.abs(h)) / 2
    let rot = Math.PI / 2 * 3
    const step = Math.PI / 5
    ctx.moveTo(cx, cy - r)
    for (let i = 0; i < 5; i++) {
      ctx.lineTo(cx + Math.cos(rot) * r, cy + Math.sin(rot) * r)
      rot += step
      ctx.lineTo(cx + Math.cos(rot) * (r * 0.4), cy + Math.sin(rot) * (r * 0.4))
      rot += step
    }
    ctx.closePath()
  } else if (shapeType === 'star6') {
    const r = Math.min(Math.abs(w), Math.abs(h)) / 2
    let rot = Math.PI / 2 * 3
    const step = Math.PI / 6
    ctx.moveTo(cx, cy - r)
    for (let i = 0; i < 6; i++) {
      ctx.lineTo(cx + Math.cos(rot) * r, cy + Math.sin(rot) * r)
      rot += step
      ctx.lineTo(cx + Math.cos(rot) * (r * 0.5), cy + Math.sin(rot) * (r * 0.5))
      rot += step
    }
    ctx.closePath()
  } else if (shapeType === 'star8') {
    const r = Math.min(Math.abs(w), Math.abs(h)) / 2
    let rot = Math.PI / 2 * 3
    const step = Math.PI / 8
    ctx.moveTo(cx, cy - r)
    for (let i = 0; i < 8; i++) {
      ctx.lineTo(cx + Math.cos(rot) * r, cy + Math.sin(rot) * r)
      rot += step
      ctx.lineTo(cx + Math.cos(rot) * (r * 0.5), cy + Math.sin(rot) * (r * 0.5))
      rot += step
    }
    ctx.closePath()
  } else if (shapeType === 'heart') {
    const topCurveHeight = Math.abs(h) * 0.3
    ctx.moveTo(cx, startY + topCurveHeight)
    ctx.bezierCurveTo(cx, startY, startX, startY, startX, startY + topCurveHeight)
    ctx.bezierCurveTo(startX, startY + (Math.abs(h) + topCurveHeight)/2, cx, drawY, cx, drawY)
    ctx.bezierCurveTo(cx, drawY, drawX, startY + (Math.abs(h) + topCurveHeight)/2, drawX, startY + topCurveHeight)
    ctx.bezierCurveTo(drawX, startY, cx, startY, cx, startY + topCurveHeight)
    ctx.closePath()
  } else if (shapeType === 'crescent') {
    const r = Math.min(Math.abs(w), Math.abs(h)) / 2
    ctx.arc(cx, cy, r, -Math.PI/4, 3 * Math.PI / 4, false)
    ctx.quadraticCurveTo(cx - r * 0.2, cy - r * 0.2, cx + r * Math.cos(-Math.PI/4), cy + r * Math.sin(-Math.PI/4))
  } else if (shapeType === 'cross') {
    const crossThick = Math.min(Math.abs(w), Math.abs(h)) * 0.3
    ctx.rect(cx - crossThick/2, startY, crossThick, Math.abs(h))
    ctx.rect(startX, cy - crossThick/2, Math.abs(w), crossThick)
  } else if (shapeType === 'cloud') {
    const rw = Math.abs(w)
    const rh = Math.abs(h)
    ctx.moveTo(startX + rw * 0.2, cy + rh * 0.2)
    ctx.quadraticCurveTo(startX, cy, startX + rw * 0.15, cy - rh * 0.2)
    ctx.quadraticCurveTo(cx - rw * 0.1, startY, cx + rw * 0.1, startY + rh * 0.1)
    ctx.quadraticCurveTo(drawX - rw * 0.1, cy - rh * 0.3, drawX, cy)
    ctx.quadraticCurveTo(drawX, cy + rh * 0.2, drawX - rw * 0.2, cy + rh * 0.3)
    ctx.quadraticCurveTo(cx, drawY, startX + rw * 0.2, cy + rh * 0.2)
    ctx.closePath()
  } else if (shapeType === 'cylinder') {
    const rx = Math.abs(w) / 2
    const ry = Math.abs(h) * 0.15
    ctx.ellipse(cx, startY + ry, rx, ry, 0, 0, 2 * Math.PI)
    ctx.moveTo(cx - rx, startY + ry)
    ctx.lineTo(cx - rx, drawY - ry)
    ctx.moveTo(cx + rx, startY + ry)
    ctx.lineTo(cx + rx, drawY - ry)
    ctx.ellipse(cx, drawY - ry, rx, ry, 0, 0, Math.PI)
  } else if (shapeType === 'cube') {
    const side = Math.min(Math.abs(w), Math.abs(h)) * 0.7
    ctx.rect(startX, startY + side * 0.3, side, side)
    ctx.rect(startX + side * 0.3, startY, side, side)
    ctx.moveTo(startX, startY + side * 0.3)
    ctx.lineTo(startX + side * 0.3, startY)
    ctx.moveTo(startX + side, startY + side * 0.3)
    ctx.lineTo(startX + side * 1.3, startY)
    ctx.moveTo(startX, startY + side * 1.3)
    ctx.lineTo(startX + side * 0.3, startY + side)
    ctx.moveTo(startX + side, startY + side * 1.3)
    ctx.lineTo(startX + side * 1.3, startY + side)
  }
}
