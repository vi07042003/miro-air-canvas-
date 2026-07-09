import React, { useRef, useState, useEffect } from 'react'
import { Rotate3d, Trash2, Download, RefreshCw, Box, HelpCircle, ArrowRight, Sun, Layers, ChevronLeft, ChevronRight, Save } from 'lucide-react'
import { motion } from 'framer-motion'
import { project3DPoint, shadeColor } from '../utils/3dUtils'
import { useToast } from './Toast'
import SaveSketchModal from './SaveSketchModal'
import { PRESET_COLORS, styles as modalStyles } from './AirCanvas.constants'
import { BACKEND_URL } from '../App'
import { getFriendlyErrorMessage } from '../utils/errorHelper'

const getBgColor = () => {
  if (typeof window !== 'undefined') {
    const rootStyle = getComputedStyle(document.documentElement)
    return rootStyle.getPropertyValue('--bg-dark-1').trim() || '#0C121C'
  }
  return '#0C121C'
}

export default function RevolveStudio({ user, initialDrawing, onDrawingCleared, onDrawingSaved }) {
  const { showToast } = useToast()
  
  const canvas2D = useRef(null)
  const canvas3D = useRef(null)
  
  const [profilePoints, setProfilePoints] = useState([])
  const [isDrawing, setIsDrawing] = useState(false)
  
  // 3D Viewport state
  const [rx, setRx] = useState(-0.5) // rotation X
  const [ry, setRy] = useState(0.8)  // rotation Y
  const [zoom, setZoom] = useState(1.8)
  const [segments, setSegments] = useState(20)
  const [renderMode, setRenderMode] = useState('solid') // wireframe, solid, points
  const [meshColor, setMeshColor] = useState('#8b5cf6')
  const [dragStart, setDragStart] = useState(null)
  const [isDragging3D, setIsDragging3D] = useState(false)
  const [dragMode, setDragMode] = useState('rotate') // 'rotate' or 'pan'
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [autoRotate, setAutoRotate] = useState(true)
  const [controlsOpen, setControlsOpen] = useState(true)

  const [saveTitle, setSaveTitle] = useState('')
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dbMessage, setDbMessage] = useState('')
  const loadedDrawingIdRef = useRef(null)
  const touchStartDistRef = useRef(null)

  // Keep saveTitle synced with initialDrawing
  useEffect(() => {
    if (initialDrawing && initialDrawing.title) {
      setSaveTitle(initialDrawing.title)
    }
  }, [initialDrawing])

  useEffect(() => {
    const initialId = initialDrawing ? initialDrawing.id : null
    if (initialId !== loadedDrawingIdRef.current) {
      loadedDrawingIdRef.current = initialId
      if (initialDrawing && initialDrawing.canvas_mode === 'revolve') {
        if (initialDrawing.threed_objects) {
          try {
            const parsed = JSON.parse(initialDrawing.threed_objects)
            if (parsed.profilePoints) {
              setProfilePoints(parsed.profilePoints)
            }
            if (parsed.segments) setSegments(parsed.segments)
            if (parsed.renderMode) setRenderMode(parsed.renderMode)
            if (parsed.meshColor) setMeshColor(parsed.meshColor)
          } catch (e) {
            console.error("Failed to parse revolve drawing data:", e)
          }
        }
      } else {
        // Reset/clear
        setProfilePoints([])
        setSegments(20)
        setRenderMode('solid')
        setMeshColor('#8b5cf6')
        setSaveTitle('')
      }
    }
  }, [initialDrawing])

  // Colors available for mesh, matching AirCanvas preset palette
  const COLORS = PRESET_COLORS.map(colorHex => {
    const nameMap = {
      '#3FA7D6': 'Softened Electric Blue',
      '#5BC0EB': 'Airy Cyan',
      '#4DA3A6': 'Teal-Blue Hybrid',
      '#9D8DF1': 'Hazy Lavender',
      '#B48EAD': 'Muted Orchid',
      '#8F7AFE': 'Glitched Indigo',
      '#46CFA7': 'Aqua-Mint Fusion',
      '#3FBF7F': 'Toned-down Green',
      '#7DD3A0': 'Pastel Tech Green',
      '#F2859E': 'Dusty Rose Neon',
      '#EFA6A6': 'Faded Coral',
      '#FF9B85': 'Warm Soft Glow',
      '#ffffff': 'White',
      '#000000': 'Black'
    }
    return { hex: colorHex, name: nameMap[colorHex] || 'Color' }
  })

  // Initialize and Redraw 2D profile canvas
  useEffect(() => {
    draw2DCanvas()
  }, [profilePoints])

  // Auto-rotate 3D model when not dragging
  useEffect(() => {
    if (!autoRotate || isDragging3D) return
    
    let frameId
    const spin = () => {
      setRy(prev => (prev + 0.006) % (2 * Math.PI))
      frameId = requestAnimationFrame(spin)
    }
    
    frameId = requestAnimationFrame(spin)
    return () => cancelAnimationFrame(frameId)
  }, [autoRotate, isDragging3D])

  const draw2DCanvas = () => {
    const canvas = canvas2D.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const w = canvas.width
    const h = canvas.height
    
    ctx.clearRect(0, 0, w, h)
    
    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)'
    ctx.lineWidth = 1
    for (let x = 0; x < w; x += 20) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    for (let y = 0; y < h; y += 20) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    // Draw central axis line (Y-axis)
    const midX = w / 2
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.5)'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(midX, 0)
    ctx.lineTo(midX, h)
    ctx.stroke()
    ctx.setLineDash([])
    
    // Axis Label
    ctx.fillStyle = 'rgba(6, 182, 212, 0.8)'
    ctx.font = '10px monospace'
    ctx.fillText('REVOLVE CENTER AXIS', midX + 8, 20)
    
    // Draw drawn profile points
    if (profilePoints.length > 0) {
      ctx.strokeStyle = '#8b5cf6'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      
      ctx.beginPath()
      ctx.moveTo(profilePoints[0].canvasX, profilePoints[0].canvasY)
      for (let i = 1; i < profilePoints.length; i++) {
        ctx.lineTo(profilePoints[i].canvasX, profilePoints[i].canvasY)
      }
      ctx.stroke()
      
      // Draw point handles
      profilePoints.forEach((pt, index) => {
        ctx.fillStyle = index === profilePoints.length - 1 ? '#00f2fe' : '#ffffff'
        ctx.beginPath()
        ctx.arc(pt.canvasX, pt.canvasY, 5, 0, 2 * Math.PI)
        ctx.fill()
        ctx.strokeStyle = '#8b5cf6'
        ctx.lineWidth = 1.5
        ctx.stroke()
      })
    }
  }

  // Handle 2D Drawing click/drag
  const get2DCoords = (e) => {
    const canvas = canvas2D.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    }
  }

  const handle2DStart = (e) => {
    e.preventDefault()
    const { x, y } = get2DCoords(e)
    const midX = canvas2D.current.width / 2
    
    // Restrict drawing to the right side of the axis (radius must be positive)
    if (x < midX - 5) {
      showToast('Draw on the right side of the axis line!', 'info')
      return
    }
    
    // Start a new line
    const radius = x - midX
    // Map vertical coordinate center-aligned
    const height = y - canvas2D.current.height / 2
    
    setProfilePoints([{ canvasX: x, canvasY: y, radius, height }])
    setIsDrawing(true)
  }

  const handle2DMove = (e) => {
    if (!isDrawing) return
    e.preventDefault()
    const { x, y } = get2DCoords(e)
    const midX = canvas2D.current.width / 2
    
    // Clamp to the axis line
    const clampedX = Math.max(midX, x)
    const radius = clampedX - midX
    const height = y - canvas2D.current.height / 2
    
    // Prevent duplicated points too close together
    const last = profilePoints[profilePoints.length - 1]
    if (last) {
      const dist = Math.hypot(clampedX - last.canvasX, y - last.canvasY)
      if (dist < 8) return
    }
    
    setProfilePoints(prev => [...prev, { canvasX: clampedX, canvasY: y, radius, height }])
  }

  const handle2DStop = () => {
    if (isDrawing) {
      setIsDrawing(false)
      showToast(`Captured profile with ${profilePoints.length} points`, 'info')
    }
  }

  const handleClear2D = () => {
    setProfilePoints([])
    showToast('Profile cleared', 'info')
  }

  // 3D Mesh Generation Logic
  const buildRevolvedMesh = () => {
    const vertices = []
    const edges = []
    const faces = []
    
    if (profilePoints.length < 2) {
      return { vertices, edges, faces }
    }
    
    // Scale factor to map 2D pixel coordinates to 3D units
    const scale = 0.8
    
    // 1. Generate Vertices by revolving profile points
    for (let s = 0; s < segments; s++) {
      const angle = (s * 2 * Math.PI) / segments
      const cosVal = Math.cos(angle)
      const sinVal = Math.sin(angle)
      
      profilePoints.forEach(pt => {
        // x in 3D = radius * cos
        // y in 3D = height
        // z in 3D = radius * sin
        vertices.push({
          x: pt.radius * cosVal * scale,
          y: pt.height * scale,
          z: pt.radius * sinVal * scale
        })
      })
    }
    
    const pCount = profilePoints.length
    
    // 2. Generate connections
    for (let s = 0; s < segments; s++) {
      const nextS = (s + 1) % segments
      for (let i = 0; i < pCount - 1; i++) {
        const currIdx = s * pCount + i
        const nextIdx = s * pCount + i + 1
        const neighborIdx = nextS * pCount + i
        const neighborNextIdx = nextS * pCount + i + 1
        
        // Horizontal rings
        edges.push([currIdx, neighborIdx])
        // Vertical lines
        edges.push([currIdx, nextIdx])
        
        // Quads (Faces)
        faces.push([currIdx, neighborIdx, neighborNextIdx, nextIdx])
      }
      
      // Close top/bottom circular loops
      edges.push([s * pCount, nextS * pCount])
      edges.push([s * pCount + pCount - 1, nextS * pCount + pCount - 1])
    }
    
    return { vertices, edges, faces }
  }

  // Render 3D Viewport
  useEffect(() => {
    const canvas = canvas3D.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const w = canvas.width
    const h = canvas.height
    
    ctx.clearRect(0, 0, w, h)
    
    // Render standard dark canvas limits
    ctx.fillStyle = getBgColor()
    ctx.fillRect(0, 0, w, h)
    
    // Draw 3D floor grid & axes helpers
    ctx.save()
    // Align viewport center
    ctx.translate(0, 0)
    
    // Math adjustments to align grid floor
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
    ctx.lineWidth = 1
    
    const mesh = buildRevolvedMesh()
    
    // Project 3D points
    const projected = mesh.vertices.map(v => {
      const p = project3DPoint(v.x, v.y, v.z, rx, ry, zoom, w, h)
      return { x: p.x + panX, y: p.y + panY, z: p.z }
    })
    
    if (projected.length > 0) {
      if (renderMode === 'points') {
        // Draw vertices
        ctx.fillStyle = meshColor
        projected.forEach(p => {
          ctx.beginPath()
          ctx.arc(p.x, p.y, 3, 0, 2 * Math.PI)
          ctx.fill()
        })
      } else if (renderMode === 'wireframe') {
        // Draw edges
        ctx.strokeStyle = meshColor
        ctx.lineWidth = 1.0
        ctx.globalAlpha = 0.6
        mesh.edges.forEach(([start, end]) => {
          const pS = projected[start]
          const pE = projected[end]
          if (pS && pE) {
            ctx.beginPath()
            ctx.moveTo(pS.x, pS.y)
            ctx.lineTo(pE.x, pE.y)
            ctx.stroke()
          }
        })
        ctx.globalAlpha = 1.0
        
        // Draw vertices as glowing dots
        ctx.fillStyle = meshColor
        projected.forEach(p => {
          ctx.beginPath()
          ctx.arc(p.x, p.y, 2, 0, 2 * Math.PI)
          ctx.fill()
        })
      } else {
        // Flat shading Solid Mode using Painter's Algorithm
        const facesWithDepth = []
        mesh.faces.forEach((face, idx) => {
          let avgZ = 0
          face.forEach(vIdx => {
            if (projected[vIdx]) avgZ += projected[vIdx].z
          })
          avgZ /= face.length
          facesWithDepth.push({ face, avgZ, idx })
        })
        
        // Sort from back to front (highest z is deepest)
        facesWithDepth.sort((a, b) => b.avgZ - a.avgZ)
        
        facesWithDepth.forEach(({ face }) => {
          if (face.some(vIdx => !projected[vIdx])) return
          
          ctx.beginPath()
          const p0 = projected[face[0]]
          ctx.moveTo(p0.x, p0.y)
          for (let i = 1; i < face.length; i++) {
            const pi = projected[face[i]]
            ctx.lineTo(pi.x, pi.y)
          }
          ctx.closePath()
          
          // Calculate flat shading based on face normal vector
          const v0 = mesh.vertices[face[0]]
          const v1 = mesh.vertices[face[1]]
          const v2 = mesh.vertices[face[2]]
          
          if (!v0 || !v1 || !v2) return
          
          const ux = v1.x - v0.x
          const uy = v1.y - v0.y
          const uz = v1.z - v0.z
          
          const vx = v2.x - v0.x
          const vy = v2.y - v0.y
          const vz = v2.z - v0.z
          
          // Normal cross product
          const nx = uy * vz - uz * vy
          const ny = uz * vx - ux * vz
          const nz = ux * vy - uy * vx
          
          const len = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1
          const normal = { x: nx/len, y: ny/len, z: nz/len }
          
          // Shading light source direction vector
          const light = { x: 0.5, y: -0.8, z: -0.6 }
          const lightLen = Math.sqrt(light.x*light.x + light.y*light.y + light.z*light.z)
          const dot = (normal.x * light.x + normal.y * light.y + normal.z * light.z) / lightLen
          const intensity = Math.max(0.18, Math.min(1.0, (dot + 1) / 2))
          
          ctx.fillStyle = shadeColor(meshColor, intensity)
          ctx.fill()
          
          // Edge borders to define geometry shape
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
          ctx.lineWidth = 0.6
          ctx.stroke()
        })
      }
    } else {
      // Draw instructions when empty
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.font = '13px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('DRAW PROFILE TO RENDER 3D SHAPE', w/2, h/2)
    }
    
    ctx.restore()
  }, [profilePoints, rx, ry, zoom, segments, renderMode, meshColor, panX, panY])

  // Drag to rotate handlers on 3D viewport
  const getTouchDistance = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const handle3DMouseDown = (e) => {
    const isTouch = !!e.touches
    
    if (isTouch && e.touches.length === 2) {
      touchStartDistRef.current = getTouchDistance(e.touches)
      setDragMode('pan')
      setDragStart({
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2
      })
      setIsDragging3D(true)
      return
    }

    const clientX = isTouch ? e.touches[0].clientX : e.clientX
    const clientY = isTouch ? e.touches[0].clientY : e.clientY

    const isPan = isTouch 
      ? false 
      : (e.shiftKey || e.button === 1 || e.button === 2)

    setDragMode(isPan ? 'pan' : 'rotate')
    setDragStart({ x: clientX, y: clientY })
    setIsDragging3D(true)
  }

  const handle3DMouseMove = (e) => {
    if (!isDragging3D || !dragStart) return
    const isTouch = !!e.touches
    
    if (isTouch && e.touches.length === 2 && touchStartDistRef.current !== null) {
      const dist = getTouchDistance(e.touches)
      const diff = dist - touchStartDistRef.current
      setZoom(prev => Math.max(0.4, Math.min(6.0, prev + diff * 0.01)))
      touchStartDistRef.current = dist

      const currentTouchX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const currentTouchY = (e.touches[0].clientY + e.touches[1].clientY) / 2
      const dx = currentTouchX - dragStart.x
      const dy = currentTouchY - dragStart.y
      setPanX(prev => prev + dx)
      setPanY(prev => prev + dy)
      setDragStart({ x: currentTouchX, y: currentTouchY })
      return
    }

    const clientX = isTouch ? e.touches[0].clientX : e.clientX
    const clientY = isTouch ? e.touches[0].clientY : e.clientY

    const dx = clientX - dragStart.x
    const dy = clientY - dragStart.y
    
    if (dragMode === 'pan') {
      setPanX(prev => prev + dx)
      setPanY(prev => prev + dy)
    } else {
      setRy(prev => prev + dx * 0.01)
      setRx(prev => prev + dy * 0.01)
    }
    setDragStart({ x: clientX, y: clientY })
  }

  const handle3DMouseUp = () => {
    setIsDragging3D(false)
    setDragStart(null)
    touchStartDistRef.current = null
  }

  const handle3DWheel = (e) => {
    // Zoom in/out based on scroll direction
    const zoomAmount = e.deltaY * -0.0015
    setZoom(prev => Math.max(0.4, Math.min(6.0, prev + zoomAmount)))
  }

  // Reset 3D camera
  const resetCamera = () => {
    setRx(-0.5)
    setRy(0.8)
    setZoom(1.8)
    setPanX(0)
    setPanY(0)
    showToast('Camera reset to default', 'info')
  }

  // Export Revolved Mesh to Wavefront OBJ File
  const handleExportOBJ = () => {
    const mesh = buildRevolvedMesh()
    if (mesh.vertices.length === 0) {
      showToast('Draw a profile first before exporting!', 'error')
      return
    }

    let objText = "# AeroCanvas Revolve Studio Export\n"
    objText += `# Created: ${new Date().toISOString()}\n`
    objText += `# Segments: ${segments}\n\n`
    
    mesh.vertices.forEach(v => {
      // Scale down and invert Y for normal OBJ orientation
      objText += `v ${(v.x/100).toFixed(4)} ${(-v.y/100).toFixed(4)} ${(v.z/100).toFixed(4)}\n`
    })
    
    objText += "\n"
    mesh.faces.forEach(f => {
      // OBJ indexing is 1-based
      objText += `f ${f.map(idx => idx + 1).join(' ')}\n`
    })
    
    try {
      const blob = new Blob([objText], { type: 'text/plain' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `revolve_mesh_${Date.now()}.obj`
      link.click()
      showToast('OBJ Model downloaded successfully!', 'success')
    } catch (e) {
      showToast('Failed to export OBJ', 'error')
    }
  }

  const handleSaveToGallery = async (e) => {
    e.preventDefault()
    if (!saveTitle.trim()) {
      setDbMessage('Please enter a sketch title')
      return
    }

    setSaving(true)
    setDbMessage('')

    const canvas = canvas3D.current
    const dataUrl = canvas.toDataURL('image/png')
    const token = localStorage.getItem('token')

    const isUpdate = !!initialDrawing
    const url = isUpdate 
      ? `${BACKEND_URL}/api/drawings/${initialDrawing.id}`
      : `${BACKEND_URL}/api/drawings`
    const method = isUpdate ? 'PUT' : 'POST'

    const revolveData = {
      profilePoints: profilePoints,
      segments: segments,
      renderMode: renderMode,
      meshColor: meshColor
    }

    try {
      const res = await fetch(url, {
        method: method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: saveTitle,
          image_data: dataUrl,
          canvas_mode: 'revolve',
          threed_objects: JSON.stringify(revolveData)
        })
      })

      if (res.ok) {
        const data = await res.json()
        const successMsg = isUpdate ? 'Model updated successfully!' : 'Model saved successfully!'
        setDbMessage(successMsg)
        showToast(successMsg, 'success')
        
        if (onDrawingSaved) {
          onDrawingSaved(data)
        }
        
        if (!isUpdate) {
          setSaveTitle('')
        }
        
        setTimeout(() => {
          setShowSaveModal(false)
          setDbMessage('')
        }, 1000)
      } else {
        const data = await res.json()
        const errorMsg = getFriendlyErrorMessage(data.detail || data, isUpdate ? 'Failed to update model' : 'Failed to save model')
        setDbMessage(errorMsg)
        showToast(errorMsg, 'error')
      }
    } catch (err) {
      console.error(err)
      const errorMsg = getFriendlyErrorMessage(err, 'Server connection error')
      setDbMessage(errorMsg)
      showToast(errorMsg, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={styles.container} className="revolve-studio-container">
      <div style={styles.header}>
        <h2 style={styles.title}>
          <Rotate3d size={22} color="var(--theme-color-2)" className="spin-animation" style={{ animationDuration: '10s' }} />
          <span>3D Revolve & Lathe Studio</span>
        </h2>
        <p style={styles.subtitle}>
          Draw a 2D silhouette outline on the left canvas. AeroCanvas will revolve it 360° around the vertical blue axis to generate a 3D vase, goblet, glass, or chess piece in real-time.
        </p>
      </div>

      <div style={styles.workspaceGrid} className="revolve-workspace-grid">
        {/* 2D Profile Drawing Pad */}
        <div className="glass-panel" style={{ ...styles.canvasPanel, flex: 1 }}>
          <div style={styles.panelTitleRow}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={16} color="var(--theme-color-2)" />
              <span style={styles.panelTitle}>1. Draw 2D Profile Contour</span>
            </div>
            <button className="glass-btn" style={styles.actionBtnSmall} onClick={handleClear2D} title="Clear Outline">
              <Trash2 size={14} />
            </button>
          </div>
          <div style={styles.canvasContainer}>
            <canvas
              ref={canvas2D}
              width={512}
              height={512}
              style={styles.canvas2D}
              onMouseDown={handle2DStart}
              onMouseMove={handle2DMove}
              onMouseUp={handle2DStop}
              onMouseLeave={handle2DStop}
              onTouchStart={handle2DStart}
              onTouchMove={handle2DMove}
              onTouchEnd={handle2DStop}
            />
          </div>
          <div style={styles.hintBox}>
            <HelpCircle size={12} color="var(--text-secondary)" />
            <span>Click and drag on the right side of the blue dashed line to define the profile.</span>
          </div>
        </div>

        {/* 3D Viewport */}
        <div className="glass-panel" style={{ ...styles.canvasPanel, flex: 1 }}>
          <div style={styles.panelTitleRow}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Box size={16} color="var(--theme-color-1)" />
              <span style={styles.panelTitle}>2. Live 3D Mesh Output</span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="glass-btn" style={styles.actionBtnSmall} onClick={resetCamera} title="Reset Camera View">
                <RefreshCw size={14} />
              </button>
              <button className="glass-btn" style={styles.actionBtnSmall} onClick={handleExportOBJ} title="Export OBJ">
                <Download size={14} />
              </button>
              <button 
                className="glass-btn glass-btn-primary" 
                style={{ ...styles.actionBtnSmall, width: 'auto', display: 'flex', alignItems: 'center', gap: '5px', padding: '0 10px', height: '30px' }} 
                onClick={() => setShowSaveModal(true)} 
                title="Save model to your gallery"
                disabled={profilePoints.length === 0}
              >
                <Save size={14} />
                <span style={{ fontSize: '11.5px', fontWeight: '600' }}>Save to files</span>
              </button>
            </div>
          </div>
          <div style={styles.canvasContainer}>
            <canvas
              ref={canvas3D}
              width={512}
              height={512}
              style={styles.canvas3D}
              onMouseDown={handle3DMouseDown}
              onMouseMove={handle3DMouseMove}
              onMouseUp={handle3DMouseUp}
              onMouseLeave={handle3DMouseUp}
              onTouchStart={(e) => {
                e.preventDefault()
                handle3DMouseDown(e)
              }}
              onTouchMove={(e) => {
                e.preventDefault()
                handle3DMouseMove(e)
              }}
              onTouchEnd={(e) => {
                e.preventDefault()
                handle3DMouseUp()
              }}
              onWheel={handle3DWheel}
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>
          <div style={styles.hintBox}>
            <Rotate3d size={12} color="var(--text-secondary)" />
            <span>Drag to rotate. Right-click drag (or Shift+Drag) to pan. Scroll to zoom.</span>
          </div>
        </div>

        {/* Controls Sidebar */}
        <div 
          className="glass-panel revolve-controls-panel" 
          style={{
            ...styles.controlsPanel,
            width: controlsOpen ? '300px' : '0px',
            padding: controlsOpen ? '16px' : '0px',
            opacity: controlsOpen ? 1 : 0,
            borderLeft: controlsOpen ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
            borderRight: controlsOpen ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            position: 'relative',
            flexShrink: 0,
            overflow: 'hidden'
          }}
        >
          {/* Inner Content to preserve dimensions when collapsed */}
          <div style={{
            opacity: controlsOpen ? 1 : 0,
            transition: 'opacity 0.25s ease',
            pointerEvents: controlsOpen ? 'auto' : 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            width: '268px',
            height: '100%',
            overflowY: 'auto'
          }}>
            <span style={styles.panelTitle}>3. Studio Controls</span>
            
            <div style={styles.controlItem}>
              <span style={styles.controlLabel}>Lathe Resolution ({segments})</span>
              <input
                type="range"
                min="8"
                max="36"
                step="2"
                value={segments}
                onChange={(e) => setSegments(parseInt(e.target.value))}
                style={styles.slider}
              />
              <span style={styles.controlDesc}>Higher segments make circles smoother.</span>
            </div>

            <div style={styles.controlItem}>
              <span style={styles.controlLabel}>Mesh Render Styling</span>
              <div style={styles.segmentedControl}>
                {['solid', 'wireframe', 'points'].map(mode => (
                  <button
                    key={mode}
                    style={renderMode === mode ? styles.segmentedBtnActive : styles.segmentedBtn}
                    onClick={() => setRenderMode(mode)}
                  >
                    <span style={{ textTransform: 'capitalize' }}>{mode}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.controlItem}>
              <span style={styles.controlLabel}>Auto Rotation</span>
              <button
                className={`glass-btn ${autoRotate ? 'glass-btn-primary' : ''}`}
                style={{ justifyContent: 'center', height: '36px', width: '100%', borderRadius: '8px' }}
                onClick={() => setAutoRotate(!autoRotate)}
              >
                {autoRotate ? 'Pause 360° Spin' : 'Resume 360° Spin'}
              </button>
            </div>

            <div style={styles.controlItem}>
              <div style={styles.colorPalette}>
                {COLORS.map(c => (
                  <button
                    key={c.hex}
                    style={{
                      ...styles.colorDot,
                      backgroundColor: c.hex,
                      border: meshColor.toLowerCase() === c.hex.toLowerCase() ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.2)',
                      boxShadow: meshColor.toLowerCase() === c.hex.toLowerCase() ? `0 0 8px ${c.hex}` : 'none',
                      transition: 'all 0.2s ease',
                      transform: meshColor.toLowerCase() === c.hex.toLowerCase() ? 'scale(1.15)' : 'scale(1)'
                    }}
                    onClick={() => setMeshColor(c.hex)}
                    title={c.name}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Custom Color:</span>
                <div style={{ display: 'flex', alignItems: 'center', position: 'relative', width: '22px', height: '22px' }}>
                  <input
                    type="color"
                    className="custom-color-picker"
                    value={COLORS.some(c => c.hex.toLowerCase() === meshColor.toLowerCase()) ? '#a855f7' : meshColor}
                    onChange={(e) => setMeshColor(e.target.value)}
                    title="Custom Color"
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      border: !COLORS.some(c => c.hex.toLowerCase() === meshColor.toLowerCase()) ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.2)',
                      boxShadow: !COLORS.some(c => c.hex.toLowerCase() === meshColor.toLowerCase()) ? `0 0 8px ${meshColor}` : 'none',
                      transition: 'all 0.2s ease',
                      transform: !COLORS.some(c => c.hex.toLowerCase() === meshColor.toLowerCase()) ? 'scale(1.15)' : 'scale(1)'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Collapse/Expand Handle - placed outside to avoid clipping */}
        <button 
          className={`drawer-toggle-handle toggle-right ${!controlsOpen ? 'collapsed' : ''}`}
          onClick={() => setControlsOpen(!controlsOpen)}
          style={{
            right: controlsOpen ? '300px' : '0px',
            transition: 'right 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            zIndex: 20
          }}
          title={controlsOpen ? "Hide Controls" : "Show Controls"}
        >
          {controlsOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Save Modal */}
      <SaveSketchModal 
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        saveTitle={saveTitle}
        onSaveTitleChange={setSaveTitle}
        onSubmit={handleSaveToGallery}
        dbMessage={dbMessage}
        saving={saving}
        initialDrawing={initialDrawing}
        styles={modalStyles}
      />
    </div>
  )
}

const styles = {
  container: {
    width: '90%',
    maxWidth: '100%',
    margin: '0 auto',
    padding: '0',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    height: 'calc(100vh - 150px)',
    minHeight: '500px',
    overflow: 'hidden'
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flexShrink: 0
  },
  title: {
    fontFamily: 'var(--font-title)',
    fontSize: '22px',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    margin: 0
  },
  subtitle: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    maxWidth: '780px',
    lineHeight: '1.4',
    margin: 0
  },
  workspaceGrid: {
    display: 'flex',
    flexDirection: 'row',
    gap: '16px',
    flex: 1,
    minHeight: 0,
    height: '100%',
    alignItems: 'stretch',
    position: 'relative'
  },
  toggleHandle: {
    position: 'absolute',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: 'rgba(15, 8, 30, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 10,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)',
    top: '50%',
    transform: 'translateY(-50%)',
    transition: 'all 0.3s ease'
  },
  canvasPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '16px',
    height: '90%',
    minHeight: 0
  },
  panelTitleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0
  },
  panelTitle: {
    fontWeight: '700',
    fontSize: '15px',
    color: '#fff',
    fontFamily: 'var(--font-accent)',
    letterSpacing: '0.5px'
  },
  actionBtnSmall: {
    padding: '6px',
    height: '30px',
    width: '30px',
    justifyContent: 'center',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center'
  },
  canvasContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: '12px',
    overflow: 'hidden',
    width: '100%',
    flex: 1,
    minHeight: 0,
    border: '1px solid rgba(255, 255, 255, 0.08)'
  },
  canvas2D: {
    background: 'var(--bg-dark-1, #0C121C)',
    cursor: 'crosshair',
    maxWidth: '100%',
    maxHeight: '100%',
    aspectRatio: '1/1',
    objectFit: 'contain'
  },
  canvas3D: {
    background: 'var(--bg-dark-1, #0C121C)',
    cursor: 'grab',
    maxWidth: '100%',
    maxHeight: '100%',
    aspectRatio: '1/1',
    objectFit: 'contain'
  },
  hintBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '11px',
    color: 'var(--text-secondary)',
    background: 'rgba(255,255,255,0.02)',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.04)',
    flexShrink: 0
  },
  controlsPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    padding: '16px',
    height: '90%',
    minHeight: 0,
    overflowY: 'auto'
  },
  controlItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  controlLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'var(--font-accent)'
  },
  controlDesc: {
    fontSize: '11px',
    color: 'var(--text-muted)'
  },
  slider: {
    width: '100%',
    cursor: 'pointer'
  },
  segmentedControl: {
    display: 'flex',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    padding: '3px',
    gap: '4px'
  },
  segmentedBtn: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'color 0.2s ease'
  },
  segmentedBtnActive: {
    flex: 1,
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.15)',
    color: '#fff',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
  },
  colorPalette: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    height: '32px'
  },
  colorDot: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    cursor: 'pointer',
    padding: 0
  }
}

