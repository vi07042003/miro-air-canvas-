import React, { useRef, useState, useEffect } from 'react'
import { 
  Palette, Eraser, Circle as CircleIcon, Square, Slash, Trash2, Undo, Redo, Download, Save, Camera, CameraOff, Video, Eye, ShieldAlert, Crosshair, Zap, Triangle, Star,
  Pencil, Highlighter, Sparkles, ArrowUpRight, Move, CircleDot, Heart, Moon, Cloud, Plus, Box, ChevronDown, Hexagon
} from 'lucide-react'
import { BACKEND_URL } from '../App'

const PRESET_COLORS = [
  '#06b6d4', // Neon Cyan
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#ffffff', // White
  '#000000'  // Black
]

const TOOL_GROUPS = [
  {
    name: 'Drawing & Painting',
    tools: [
      { id: 'brush', name: 'Paint Brush', icon: 'Palette' },
      { id: 'pencil', name: 'Sharp Pencil', icon: 'Pencil' },
      { id: 'highlighter', name: 'Highlighter', icon: 'Highlighter' },
      { id: 'spray', name: 'Spray Can', icon: 'Sparkles' },
      { id: 'eraser', name: 'Eraser', icon: 'Eraser' }
    ]
  },
  {
    name: 'Basic Geometry',
    tools: [
      { id: 'line', name: 'Straight Line', icon: 'Slash' },
      { id: 'arrow', name: 'Single Arrow', icon: 'ArrowUpRight' },
      { id: 'double-arrow', name: 'Double Arrow', icon: 'Move' },
      { id: 'rect', name: 'Rectangle', icon: 'Square' },
      { id: 'circle', name: 'Circle', icon: 'CircleIcon' },
      { id: 'ellipse', name: 'Ellipse', icon: 'CircleIcon' },
      { id: 'ring', name: 'Ring/Donut', icon: 'CircleDot' }
    ]
  },
  {
    name: 'Polygons & Stars',
    tools: [
      { id: 'triangle', name: 'Triangle', icon: 'Triangle' },
      { id: 'diamond', name: 'Diamond', icon: 'Triangle' },
      { id: 'pentagon', name: 'Pentagon', icon: 'Hexagon' },
      { id: 'hexagon', name: 'Hexagon', icon: 'Hexagon' },
      { id: 'octagon', name: 'Octagon', icon: 'Hexagon' },
      { id: 'star', name: '5-Point Star', icon: 'Star' },
      { id: 'star6', name: '6-Point Star', icon: 'Star' },
      { id: 'star8', name: '8-Point Star', icon: 'Star' }
    ]
  },
  {
    name: 'Creative & 3D',
    tools: [
      { id: 'heart', name: 'Heart', icon: 'Heart' },
      { id: 'crescent', name: 'Crescent Moon', icon: 'Moon' },
      { id: 'cross', name: 'Plus Cross', icon: 'Plus' },
      { id: 'cloud', name: 'Cloud', icon: 'Cloud' },
      { id: 'cylinder', name: 'Cylinder', icon: 'Box' },
      { id: 'cube', name: 'Cube', icon: 'Box' }
    ]
  }
]

const ICON_MAP = {
  Palette,
  Eraser,
  CircleIcon,
  Square,
  Slash,
  Triangle,
  Star,
  Pencil,
  Highlighter,
  Sparkles,
  ArrowUpRight,
  Move,
  CircleDot,
  Heart,
  Moon,
  Cloud,
  Plus,
  Box,
  Hexagon
}

const RenderIcon = ({ iconName, size = 18 }) => {
  const IconComp = ICON_MAP[iconName] || Palette
  return <IconComp size={size} />
}

const drawShapePath = (ctx, shapeType, startX, startY, drawX, drawY) => {
  const w = drawX - startX
  const h = drawY - startY
  const cx = startX + w / 2
  const cy = startY + h / 2
  const radius = Math.sqrt(w * w + h * h) / 2

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

export default function AirCanvas({ initialDrawing, onDrawingCleared }) {
  const canvasRef = useRef(null)
  const videoRef = useRef(null)
  const handCanvasRef = useRef(null)
  
  // DOM element references for 60 FPS direct updates (no React re-renders)
  const coordsTextRef = useRef(null)
  const gestureIndicatorRef = useRef(null)
  const gestureIndicatorDotRef = useRef(null)
  const fpsTextRef = useRef(null)

  // States (Only state variables that trigger UI actions)
  const [tool, setTool] = useState('brush') // brush, line, rect, circle, eraser
  const [color, setColor] = useState('#06b6d4')
  const [brushSize, setBrushSize] = useState(8)
  const [brushOpacity, setBrushOpacity] = useState(1.0)
  const [isCameraOn, setIsCameraOn] = useState(false)
  const [cameraLoading, setCameraLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveTitle, setSaveTitle] = useState('')
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [dbMessage, setDbMessage] = useState('')
  const [toolDropdownOpen, setToolDropdownOpen] = useState(false)
  const [colorDropdownOpen, setColorDropdownOpen] = useState(false)

  const getActiveToolName = (id) => {
    for (const group of TOOL_GROUPS) {
      const found = group.tools.find(t => t.id === id)
      if (found) return found.name
    }
    return 'Paint Brush'
  }

  const getActiveToolIcon = (id) => {
    for (const group of TOOL_GROUPS) {
      const found = group.tools.find(t => t.id === id)
      if (found) return found.icon
    }
    return 'Palette'
  }
  
  // Custom Controls
  const [stabilizeEnabled, setStabilizeEnabled] = useState(true)

  // Undo/Redo Stacks
  const [undoStack, setUndoStack] = useState([])
  const [redoStack, setRedoStack] = useState([])

  // Tracking state refs (keeps drawing loop at 60 FPS without React re-render lags)
  const drawingRef = useRef({
    isDrawing: false,
    lastX: 0,
    lastY: 0,
    startX: 0,
    startY: 0,
    savedImageData: null,
    smoothedX: 0,
    smoothedY: 0,
    lastGestureMode: 'None',
    wasSizing: false,
    sizingRadius: 0,
    waveHistory: []
  })

  // Camera settings loaded from Backend
  const [settings, setSettings] = useState({
    mirrorCamera: 'true',
    detectionConfidence: '0.5'
  })

  // Ref to hold changing states, avoiding stale closures in event loops and MediaPipe callbacks
  const stateRef = useRef({
    color,
    tool,
    brushSize,
    brushOpacity,
    stabilizeEnabled,
    settings,
    isCameraOn
  })

  useEffect(() => {
    stateRef.current = {
      color,
      tool,
      brushSize,
      brushOpacity,
      stabilizeEnabled,
      settings,
      isCameraOn
    }
  }, [color, tool, brushSize, brushOpacity, stabilizeEnabled, settings, isCameraOn])

  // Particles Trail System Reference
  const particlesRef = useRef([])
  const animationFrameIdRef = useRef(null)
  
  // FPS tracker references
  const fpsTrackerRef = useRef({
    frameCount: 0,
    lastTime: performance.now(),
    currentFps: 60
  })

  // Fetch initial configurations
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/settings`)
        if (res.ok) {
          const data = await res.json()
          if (data.mirrorCamera) setSettings(prev => ({ ...prev, ...data }))
          if (data.defaultColor) setColor(data.defaultColor)
        }
      } catch (e) {
        console.error(e)
      }
    }
    fetchSettings()
  }, [])

  // Initialize main canvas context
  useEffect(() => {
    console.log("Canvas context init running, initialDrawing:", initialDrawing)
    const canvas = canvasRef.current
    if (!canvas) {
      console.log("No canvas ref found!")
      return
    }
    const ctx = canvas.getContext('2d')
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    
    // Fill canvas with default background color
    ctx.fillStyle = '#0a0518'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    if (initialDrawing && initialDrawing.image_data) {
      console.log("Loading image data from initialDrawing...")
      const img = new Image()
      img.onload = () => {
        console.log("Image loaded successfully! Drawing on canvas...")
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        saveCanvasState()
      }
      img.onerror = (err) => {
        console.error("Failed to load image data URL:", err)
      }
      img.src = initialDrawing.image_data
    } else {
      console.log("No initial drawing provided, saving default state.")
      // Save initial state
      saveCanvasState()
    }

    // Start particle trail animation loop
    startParticlesAnimationLoop()

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current)
      }
    }
  }, [initialDrawing])

  // Save state helper
  const saveCanvasState = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    
    setUndoStack(prev => {
      const next = [...prev, imgData]
      if (next.length > 25) next.shift()
      return next
    })
    setRedoStack([])
  }

  // Handle Undo
  const handleUndo = () => {
    if (undoStack.length <= 1) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    const current = undoStack[undoStack.length - 1]
    setRedoStack(prev => [...prev, current])
    
    const previous = undoStack[undoStack.length - 2]
    ctx.putImageData(previous, 0, 0)
    setUndoStack(prev => prev.slice(0, -1))
  }

  // Handle Redo
  const handleRedo = () => {
    if (redoStack.length === 0) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    const nextState = redoStack[redoStack.length - 1]
    ctx.putImageData(nextState, 0, 0)
    
    setUndoStack(prev => [...prev, nextState])
    setRedoStack(prev => prev.slice(0, -1))
  }

  // Fallback mouse listeners
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    startDraw(x, y)
  }

  const handleMouseMove = (e) => {
    if (!drawingRef.current.isDrawing) return
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // Add interactive pointer particles while mouse dragging
    addParticles(x, y, stateRef.current.color)
    drawMove(x, y)
  }

  const handleMouseUp = () => {
    if (!drawingRef.current.isDrawing) return
    endDraw()
  }

  // Drawing Core Logic
  const startDraw = (x, y) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    
    drawingRef.current.isDrawing = true
    drawingRef.current.startX = x
    drawingRef.current.startY = y
    drawingRef.current.lastX = x
    drawingRef.current.lastY = y
    
    drawingRef.current.savedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  }

  const drawMove = (x, y) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const drawState = drawingRef.current
    
    const { tool: currentTool, color: currentColor, brushSize: currentBrushSize, brushOpacity: currentBrushOpacity, stabilizeEnabled: currentStabilizeEnabled } = stateRef.current

    ctx.strokeStyle = currentTool === 'eraser' ? '#0a0518' : currentColor
    ctx.lineWidth = currentBrushSize
    ctx.globalAlpha = currentBrushOpacity
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    
    // Coordinate snapping/stabilization for shape accuracy
    let drawX = x
    let drawY = y

    if (currentStabilizeEnabled) {
      if (currentTool === 'line') {
        const dx = x - drawState.startX
        const dy = y - drawState.startY
        const absDx = Math.abs(dx)
        const absDy = Math.abs(dy)
        
        // Snap vertical
        if (absDx < absDy * 0.176) { // ~10 degrees
          drawX = drawState.startX
        }
        // Snap horizontal
        else if (absDy < absDx * 0.176) {
          drawY = drawState.startY
        }
      } else if (currentTool === 'rect') {
        const dx = x - drawState.startX
        const dy = y - drawState.startY
        const absDx = Math.abs(dx)
        const absDy = Math.abs(dy)
        
        // Snap aspect ratio to square if close
        if (Math.abs(absDx - absDy) < Math.max(absDx, absDy) * 0.15) {
          const size = Math.min(absDx, absDy)
          drawX = drawState.startX + Math.sign(dx) * size
          drawY = drawState.startY + Math.sign(dy) * size
        }
      }
    }

    const paintTools = ['brush', 'pencil', 'highlighter', 'spray', 'eraser']
    const isPainting = paintTools.includes(currentTool)

    if (isPainting) {
      ctx.beginPath()
      if (currentTool === 'spray') {
        const radius = Math.max(10, currentBrushSize * 2.5)
        const density = 25
        for (let i = 0; i < density; i++) {
          const angle = Math.random() * Math.PI * 2
          const dist = Math.random() * radius
          const sx = drawX + Math.cos(angle) * dist
          const sy = drawY + Math.sin(angle) * dist
          ctx.fillRect(sx, sy, 1.5, 1.5)
        }
      } else {
        if (currentTool === 'pencil') {
          ctx.lineWidth = 2
          ctx.globalAlpha = 1.0
        } else if (currentTool === 'highlighter') {
          ctx.globalAlpha = 0.35
          ctx.lineWidth = Math.max(12, currentBrushSize * 2.5)
          ctx.lineCap = 'square'
          ctx.lineJoin = 'miter'
        }
        ctx.moveTo(drawState.lastX, drawState.lastY)
        ctx.lineTo(drawX, drawY)
        ctx.stroke()
      }
      drawState.lastX = drawX
      drawState.lastY = drawY
    } else {
      // Shape Preview (Restores offscreen buffer, previews shape vector)
      if (drawState.savedImageData) {
        ctx.putImageData(drawState.savedImageData, 0, 0)
      }
      
      ctx.beginPath()
      drawShapePath(ctx, currentTool, drawState.startX, drawState.startY, drawX, drawY)
      ctx.stroke()
    }
  }

  const endDraw = () => {
    drawingRef.current.isDrawing = false
    drawingRef.current.savedImageData = null
    saveCanvasState()
  }

  const stampShape = (x, y, radius, shapeType, colorVal, sizeVal, opacityVal) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    
    ctx.strokeStyle = colorVal
    ctx.lineWidth = sizeVal
    ctx.globalAlpha = opacityVal
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (shapeType === 'highlighter') {
      ctx.globalAlpha = 0.35
      ctx.lineWidth = Math.max(12, sizeVal * 2.5)
      ctx.lineCap = 'square'
      ctx.lineJoin = 'miter'
    }
    
    ctx.beginPath()
    drawShapePath(ctx, shapeType, x - radius, y - radius, x + radius, y + radius)
    ctx.stroke()
    
    saveCanvasState()
  }

  // Clear Board
  const handleClear = () => {
    if (!window.confirm('Are you sure you want to clear the canvas?')) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#0a0518'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    saveCanvasState()
  }

  // Particle System Logic
  const addParticles = (x, y, particleColor) => {
    // Limit total particles to avoid memory leaks
    if (particlesRef.current.length > 80) {
      particlesRef.current.shift()
    }
    
    // Add 2 particles per movement frame
    for (let i = 0; i < 2; i++) {
      particlesRef.current.push({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        size: Math.random() * 8 + 4,
        alpha: 1.0,
        color: particleColor
      })
    }
  }

  // Background particle animator loop (keeps rendering smooth and distinct from drawings)
  const startParticlesAnimationLoop = () => {
    const loop = () => {
      updateAndDrawParticles()
      trackFps()
      animationFrameIdRef.current = requestAnimationFrame(loop)
    }
    animationFrameIdRef.current = requestAnimationFrame(loop)
  }

  // Track FPS calculation
  const trackFps = () => {
    const now = performance.now()
    const tracker = fpsTrackerRef.current
    tracker.frameCount++
    
    if (now >= tracker.lastTime + 1000) {
      tracker.currentFps = Math.round((tracker.frameCount * 1000) / (now - tracker.lastTime))
      tracker.frameCount = 0
      tracker.lastTime = now

      // Direct write to DOM to avoid rendering react component
      if (fpsTextRef.current) {
        fpsTextRef.current.innerText = `${tracker.currentFps} FPS`
        // Color coder
        if (tracker.currentFps >= 50) {
          fpsTextRef.current.style.color = '#10b981'
        } else if (tracker.currentFps >= 30) {
          fpsTextRef.current.style.color = '#f59e0b'
        } else {
          fpsTextRef.current.style.color = '#ef4444'
        }
      }
    }
  }

  // Update particle vectors and render them to hand overlay canvas
  const updateAndDrawParticles = () => {
    const handCanvas = handCanvasRef.current
    if (!handCanvas) return
    const hCtx = handCanvas.getContext('2d')
    
    // Check if webcam is off; if so, clear the hand canvas and return!
    if (!stateRef.current.isCameraOn) {
      hCtx.clearRect(0, 0, handCanvas.width, handCanvas.height)
      return
    }

    const particles = particlesRef.current
    
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.x += p.vx
      p.y += p.vy
      p.alpha -= 0.04
      p.size -= 0.1
      
      if (p.alpha <= 0 || p.size <= 0) {
        particles.splice(i, 1)
        continue
      }
      
      // Draw glowing particle
      hCtx.save()
      hCtx.globalAlpha = p.alpha
      hCtx.beginPath()
      hCtx.arc(p.x, p.y, p.size, 0, 2 * Math.PI)
      
      // Glow shadow
      hCtx.shadowColor = p.color
      hCtx.shadowBlur = 12
      hCtx.fillStyle = p.color
      hCtx.fill()
      hCtx.restore()
    }
  }

  // Direct DOM state changes to maintain performance
  const updateDOMGestureStatus = (mode) => {
    // Write coordinate texts
    if (gestureIndicatorRef.current) {
      gestureIndicatorRef.current.innerText = mode
    }

    // Adjust neon dots style
    if (gestureIndicatorDotRef.current) {
      let color = '#6b7280'
      if (mode === 'Drawing') color = '#10b981'
      if (mode === 'Hover') color = '#06b6d4'
      if (mode === 'Shape Sizing') color = '#ec4899'
      if (mode === 'Shape Lock') color = '#8b5cf6'
      if (mode === 'Shape Stamped') color = '#f59e0b'
      if (mode === 'Canvas Cleared') color = '#ef4444'
      
      gestureIndicatorDotRef.current.style.backgroundColor = color
      gestureIndicatorDotRef.current.style.boxShadow = mode !== 'None' ? `0 0 10px ${color}` : 'none'
    }
  }

  // MediaPipe Hand tracking initializer
  useEffect(() => {
    let cameraInstance = null
    let active = true

    const initTracking = () => {
      if (!isCameraOn) return
      
      const HandsLib = window.Hands
      const CameraLib = window.Camera

      if (!HandsLib || !CameraLib) {
        alert('MediaPipe tracking script libraries failed to load. Please check your network connection.')
        setIsCameraOn(false)
        return
      }

      setCameraLoading(true)

      const hands = new HandsLib({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      })

      const confidence = parseFloat(settings.detectionConfidence) || 0.5
      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: confidence,
        minTrackingConfidence: confidence
      })

      hands.onResults((results) => {
        if (!active) return
        setCameraLoading(false)
        processTrackingResults(results)
      })

      if (videoRef.current) {
        cameraInstance = new CameraLib(videoRef.current, {
          onFrame: async () => {
            if (videoRef.current && isCameraOn) {
              await hands.send({ image: videoRef.current })
            }
          },
          width: 320,
          height: 240
        })
        cameraInstance.start()
      }
    }

    initTracking()

    return () => {
      active = false
      if (cameraInstance) {
        try {
          cameraInstance.stop()
        } catch (e) {
          console.error(e)
        }
      }
    }
  }, [isCameraOn, settings.detectionConfidence])

  // Process Hand Tracking Frames
  const processTrackingResults = (results) => {
    const canvas = canvasRef.current
    const handCanvas = handCanvasRef.current
    if (!canvas || !handCanvas) return

    const hCtx = handCanvas.getContext('2d')
    hCtx.clearRect(0, 0, handCanvas.width, handCanvas.height)

    // Overlay main canvas drawings onto the camera tracking canvas (screen blend mode hides black background)
    hCtx.save()
    hCtx.globalCompositeOperation = 'screen'
    hCtx.drawImage(canvas, 0, 0)
    hCtx.restore()

    const { color: currentColor, tool: currentTool, stabilizeEnabled: currentStabilizeEnabled, settings: currentSettings } = stateRef.current
    const isMirrored = currentSettings.mirrorCamera === 'true'

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0]

      // Draw hand bones skeleton
      drawSkeleton(hCtx, landmarks)

      const indexTip = landmarks[8]
      const indexPip = landmarks[6]
      const middleTip = landmarks[12]
      const middlePip = landmarks[10]
      const ringTip = landmarks[16]
      const pinkyTip = landmarks[20]

      // Canvas mapping
      let rawX = isMirrored ? (1 - indexTip.x) : indexTip.x
      let rawY = indexTip.y

      rawX = rawX * canvas.width
      rawY = rawY * canvas.height

      // Exponential coordinate stabilizer (Higher alpha for shape stabilization mode)
      const drawState = drawingRef.current
      const currentAlpha = currentStabilizeEnabled && !['brush', 'pencil', 'highlighter', 'spray', 'eraser'].includes(currentTool) ? 0.85 : 0.55

      if (drawState.smoothedX === 0) {
        drawState.smoothedX = rawX
        drawState.smoothedY = rawY
      } else {
        drawState.smoothedX = drawState.smoothedX * currentAlpha + rawX * (1 - currentAlpha)
        drawState.smoothedY = drawState.smoothedY * currentAlpha + rawY * (1 - currentAlpha)
      }

      const x = drawState.smoothedX
      const y = drawState.smoothedY

      // Direct write coordinates to DOM ref (eliminates state updates -> guarantees 60 FPS)
      if (coordsTextRef.current) {
        coordsTextRef.current.innerText = `(${Math.round(x)}, ${Math.round(y)})`
      }

      // Add visual particle movement trail behind active finger tip
      addParticles(x, y, currentColor)

      let currentMode = 'None'

      // Eraser wave gesture detection
      if (currentTool === 'eraser') {
        const now = performance.now()
        if (!drawState.waveHistory) {
          drawState.waveHistory = []
        }
        drawState.waveHistory.push({ x, y, time: now })
        
        // Keep only last 1000ms
        drawState.waveHistory = drawState.waveHistory.filter(pt => now - pt.time < 1000)
        
        // Find direction changes in X to detect hand waving
        if (drawState.waveHistory.length > 10) {
          let directionChanges = 0
          let lastDirection = 0 // -1 for left, 1 for right, 0 for start
          let lastPeakX = drawState.waveHistory[0].x
          const minAmplitude = 60 // Minimum horizontal displacement in pixels to count as a wave stroke
          
          for (let i = 1; i < drawState.waveHistory.length; i++) {
            const currentX = drawState.waveHistory[i].x
            const diff = currentX - lastPeakX
            
            if (lastDirection === 0) {
              if (Math.abs(diff) > minAmplitude) {
                lastDirection = diff > 0 ? 1 : -1
                lastPeakX = currentX
              }
            } else if (lastDirection === 1) {
              if (diff < -minAmplitude) {
                directionChanges++
                lastDirection = -1
                lastPeakX = currentX
              } else if (currentX > lastPeakX) {
                lastPeakX = currentX
              }
            } else if (lastDirection === -1) {
              if (diff > minAmplitude) {
                directionChanges++
                lastDirection = 1
                lastPeakX = currentX
              } else if (currentX < lastPeakX) {
                lastPeakX = currentX
              }
            }
          }
          
          if (directionChanges >= 3) {
            // Wave gesture detected!
            drawState.waveHistory = [] // Clear history to prevent multiple triggers
            
            // Clear canvas permanently
            const mainCtx = canvas.getContext('2d')
            mainCtx.fillStyle = '#0a0518'
            mainCtx.fillRect(0, 0, canvas.width, canvas.height)
            saveCanvasState()
            
            currentMode = 'Canvas Cleared'
            
            // Draw a temporary visual flash overlay
            hCtx.fillStyle = 'rgba(239, 68, 68, 0.3)'
            hCtx.fillRect(0, 0, handCanvas.width, handCanvas.height)
            
            hCtx.fillStyle = '#ffffff'
            hCtx.font = 'bold 20px sans-serif'
            hCtx.fillText("👋 Wave Detected - Canvas Cleared!", handCanvas.width / 2 - 170, handCanvas.height / 2)
          }
        }
      } else {
        // Reset wave history when not using eraser
        drawState.waveHistory = []
      }

      // Detect Gestures
      const isIndexUp = indexTip.y < indexPip.y
      const isMiddleUp = middleTip.y < middlePip.y

      if (isIndexUp && !isMiddleUp) {
        const isShapeTool = !['brush', 'pencil', 'highlighter', 'spray', 'eraser'].includes(currentTool)
        
        if (isShapeTool) {
          const thumbTip = landmarks[4]
          const pinchDist = Math.sqrt(
            Math.pow(indexTip.x - thumbTip.x, 2) +
            Math.pow(indexTip.y - thumbTip.y, 2)
          )
          
          if (pinchDist > 0.05) {
            currentMode = 'Shape Sizing'
            
            if (drawState.isDrawing) {
              endDraw()
            }
            
            drawState.wasSizing = true
            drawState.sizingRadius = pinchDist * canvas.width * 0.8
          } else if (drawState.wasSizing) {
            currentMode = 'Shape Lock'
          }
          if (pinchDist > 0.05 || drawState.wasSizing) {
            // Draw shape preview on hand overlay canvas
            hCtx.strokeStyle = currentColor
            hCtx.lineWidth = 3
            hCtx.globalAlpha = 0.8
            hCtx.beginPath()
            const previewRadius = drawState.sizingRadius
            
            drawShapePath(hCtx, currentTool, x - previewRadius, y - previewRadius, x + previewRadius, y + previewRadius)
            hCtx.stroke()
            
            // Draw instruction text
            hCtx.fillStyle = '#ffffff'
            hCtx.font = 'bold 13px sans-serif'
            hCtx.shadowColor = 'black'
            hCtx.shadowBlur = 4
            if (currentMode === 'Shape Sizing') {
              hCtx.fillText(`Sizing: ${Math.round(previewRadius)}px`, x - 35, y - previewRadius - 28)
              hCtx.fillText("Tuck thumb to lock size", x - 65, y - previewRadius - 10)
            } else {
              hCtx.fillText(`Size Locked: ${Math.round(previewRadius)}px`, x - 45, y - previewRadius - 28)
              hCtx.fillText("Close fist to STAMP shape", x - 70, y - previewRadius - 10)
            }
            hCtx.shadowBlur = 0
          } else {
            // Normal drag-to-draw shape
            currentMode = 'Drawing'
            if (!drawState.isDrawing) {
              startDraw(x, y)
            } else {
              drawMove(x, y)
            }
          }
        } else {
          currentMode = 'Drawing'
          if (!drawState.isDrawing) {
            startDraw(x, y)
          } else {
            drawMove(x, y)
          }
        }
      } else if (isIndexUp && isMiddleUp) {
        currentMode = 'Hover'
        drawState.wasSizing = false
        drawState.sizingRadius = 0
        if (drawState.isDrawing) {
          endDraw()
        }
      } else {
        if (drawState.wasSizing) {
          stampShape(x, y, drawState.sizingRadius, currentTool, currentColor, stateRef.current.brushSize, stateRef.current.brushOpacity)
          drawState.wasSizing = false
          drawState.sizingRadius = 0
          currentMode = 'Shape Stamped'
        } else {
          currentMode = 'None'
          if (drawState.isDrawing) {
            endDraw()
          }
        }
      }

      // Only update DOM styles when gesture mode transition occurs
      if (drawState.lastGestureMode !== currentMode) {
        drawState.lastGestureMode = currentMode
        updateDOMGestureStatus(currentMode)
      }

    } else {
      let currentMode = 'None'
      const drawState = drawingRef.current
      if (drawState.isDrawing) {
        endDraw()
      }
      if (drawState.lastGestureMode !== currentMode) {
        drawState.lastGestureMode = currentMode
        updateDOMGestureStatus(currentMode)
      }
    }
  }

  // Render skeletal bones
  const drawSkeleton = (ctx, landmarks) => {
    const { color: currentColor, settings: currentSettings } = stateRef.current
    ctx.fillStyle = currentColor // Glow follows active color
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.lineWidth = 2

    const getX = (lm) => {
      const isMirrored = currentSettings.mirrorCamera === 'true'
      return isMirrored ? (1 - lm.x) * ctx.canvas.width : lm.x * ctx.canvas.width
    }
    const getY = (lm) => lm.y * ctx.canvas.height

    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8], // Index
      [9, 10], [10, 11], [11, 12],     // Middle
      [13, 14], [14, 15], [15, 16],    // Ring
      [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
      [5, 9], [9, 13], [13, 17] // Palm
    ]

    connections.forEach(([s, e]) => {
      ctx.beginPath()
      ctx.moveTo(getX(landmarks[s]), getY(landmarks[s]))
      ctx.lineTo(getX(landmarks[e]), getY(landmarks[e]))
      ctx.stroke()
    })

    landmarks.forEach((lm) => {
      ctx.beginPath()
      ctx.arc(getX(lm), getY(lm), 4, 0, 2 * Math.PI)
      ctx.fill()
    })
  }

  // Save to user account gallery
  const handleSaveToGallery = async (e) => {
    e.preventDefault()
    if (!saveTitle.trim()) {
      setDbMessage('Please enter a sketch title')
      return
    }

    setSaving(true)
    setDbMessage('')

    const canvas = canvasRef.current
    const dataUrl = canvas.toDataURL('image/png')
    const token = localStorage.getItem('token')

    try {
      const res = await fetch(`${BACKEND_URL}/api/drawings`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: saveTitle,
          image_data: dataUrl
        })
      })

      if (res.ok) {
        setDbMessage('Sketch saved successfully!')
        setSaveTitle('')
        setTimeout(() => {
          setShowSaveModal(false)
          setDbMessage('')
        }, 2000)
      } else {
        const data = await res.json()
        setDbMessage(data.detail || 'Failed to save sketch')
      }
    } catch (err) {
      setDbMessage('Server connection error')
    } finally {
      setSaving(false)
    }
  }

  // Local file download
  const handleDownloadLocally = () => {
    const canvas = canvasRef.current
    const dataUrl = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `miro_canvas_sketch_${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="fade-in" style={styles.container}>
      {/* Top action bar */}
      <div style={styles.topBar}>
        <div style={styles.gestureStatus}>
          <div style={styles.gestureIndicator}>
            <div ref={gestureIndicatorDotRef} style={styles.gestureIndicatorDot}></div>
            <span>Gesture: <strong ref={gestureIndicatorRef}>None</strong></span>
          </div>
          <span ref={coordsTextRef} style={styles.coordsText}>(0, 0)</span>
          
          {/* Target 60 FPS monitor */}
          <div style={styles.fpsBadge}>
            <Zap size={13} />
            <span ref={fpsTextRef} style={{ fontWeight: 'bold' }}>60 FPS</span>
          </div>
        </div>

        <div style={styles.actionButtons}>
          <button className="glass-btn" onClick={handleUndo} disabled={undoStack.length <= 1} title="Undo last stroke">
            <Undo size={16} />
            <span>Undo</span>
          </button>
          <button className="glass-btn" onClick={handleRedo} disabled={redoStack.length === 0} title="Redo last stroke">
            <Redo size={16} />
            <span>Redo</span>
          </button>
          <button className="glass-btn" onClick={handleClear} title="Clear Canvas">
            <Trash2 size={16} color="#f43f5e" />
            <span>Clear</span>
          </button>
          <button className="glass-btn" onClick={handleDownloadLocally} title="Save to local disk">
            <Download size={16} />
            <span>Download</span>
          </button>
          <button className="glass-btn glass-btn-primary" onClick={() => setShowSaveModal(true)} title="Save to database">
            <Save size={16} />
            <span>Save to files</span>
          </button>
        </div>
      </div>

      <div style={styles.workspace}>
        {/* Center Canvas Column (Controls + Canvas) */}
        <div style={styles.canvasColumn}>
          {/* Top Canvas Controls Panel */}
          <div className="glass-panel" style={styles.canvasControls}>
            {/* Tool Selection Dropdown */}
            <div 
              style={styles.dropdownContainer}
              onMouseLeave={() => setToolDropdownOpen(false)}
            >
              <button 
                className="glass-btn" 
                style={styles.controlDropdownBtn}
                onClick={() => {
                  setToolDropdownOpen(!toolDropdownOpen)
                  setColorDropdownOpen(false)
                }}
              >
                <RenderIcon iconName={getActiveToolIcon(tool)} size={16} />
                <span style={{ margin: '0 8px 0 6px', fontWeight: '600' }}>{getActiveToolName(tool)}</span>
                <ChevronDown size={14} />
              </button>
              
              {toolDropdownOpen && (
                <div className="glass-panel-heavy" style={styles.toolDropdownMenu}>
                  {TOOL_GROUPS.map(group => (
                    <div key={group.name} style={styles.dropdownGroup}>
                      <div style={styles.dropdownGroupTitle}>{group.name}</div>
                      <div style={styles.dropdownGroupGrid}>
                        {group.tools.map(t => (
                          <button
                            key={t.id}
                            className={`glass-btn dropdown-item ${tool === t.id ? 'glass-btn-active' : ''}`}
                            style={styles.dropdownItemBtn}
                            onClick={() => {
                              setTool(t.id)
                              setToolDropdownOpen(false)
                            }}
                          >
                            <RenderIcon iconName={t.icon} size={14} />
                            <span style={{ marginLeft: '6px' }}>{t.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Color Palette Dropdown */}
            <div 
              style={styles.dropdownContainer}
              onMouseLeave={() => setColorDropdownOpen(false)}
            >
              <button 
                className="glass-btn" 
                style={styles.controlDropdownBtn}
                onClick={() => {
                  setColorDropdownOpen(!colorDropdownOpen)
                  setToolDropdownOpen(false)
                }}
              >
                <span style={{
                  display: 'inline-block',
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  backgroundColor: color,
                  border: '1px solid rgba(255,255,255,0.3)',
                  boxShadow: `0 0 6px ${color}`,
                  marginRight: '6px'
                }} />
                <span style={{ marginRight: '8px', fontWeight: '600' }}>Color</span>
                <ChevronDown size={14} />
              </button>

              {colorDropdownOpen && (
                <div className="glass-panel-heavy" style={styles.colorDropdownMenu}>
                  <div style={styles.colorPaletteGrid}>
                    {PRESET_COLORS.map(c => (
                      <button 
                        key={c}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          backgroundColor: c,
                          border: color === c ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                          boxShadow: color === c ? `0 0 8px ${c}` : 'none',
                          cursor: 'pointer',
                          padding: 0
                        }}
                        onClick={() => {
                          setColor(c)
                          setColorDropdownOpen(false)
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Custom:</span>
                    <input 
                      type="color" 
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      style={{
                        border: 'none',
                        width: '24px',
                        height: '24px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        background: 'none'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Brush Size Slider */}
            <div style={styles.inlineControl}>
              <span style={styles.inlineLabel}>Size: {brushSize}px</span>
              <input 
                type="range" 
                min="1" 
                max="100" 
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                style={styles.inlineSlider}
              />
            </div>

            {/* Opacity Slider */}
            <div style={styles.inlineControl}>
              <span style={styles.inlineLabel}>Opacity: {Math.round(brushOpacity * 100)}%</span>
              <input 
                type="range" 
                min="0.1" 
                max="1.0" 
                step="0.05"
                value={brushOpacity}
                onChange={(e) => setBrushOpacity(parseFloat(e.target.value))}
                style={styles.inlineSlider}
              />
            </div>

            {/* Stabilizer Toggle */}
            <button 
              className={`glass-btn ${stabilizeEnabled ? 'glass-btn-active' : ''}`}
              style={{ padding: '6px 12px', fontSize: '13px', height: '34px' }}
              onClick={() => setStabilizeEnabled(!stabilizeEnabled)}
              title="Enhance drawing stability and snap lines/rectangles to perfect orientations"
            >
              <Crosshair size={14} style={{ marginRight: '6px' }} />
              <span>{stabilizeEnabled ? 'Stabilizer ON' : 'Stabilizer OFF'}</span>
            </button>
          </div>

          {/* Main Drawing Canvas Container */}
          <div className="glass-panel" style={styles.canvasContainer}>
            <canvas 
              ref={canvasRef}
              width="1200"
              height="700"
              style={styles.canvas}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>
        </div>

        {/* Right Side: Camera Overlay controls */}
        <div style={styles.sidebar}>
          <div className="glass-panel" style={styles.videoCard}>
            <div style={styles.videoHeader}>
              <Video size={16} />
              <span>Camera Tracking Feed</span>
            </div>
            
            <div style={styles.videoWrapper}>
              {cameraLoading && (
                <div style={styles.cameraLoadingOverlay}>
                  <div className="spinner" style={styles.miniSpinner}></div>
                  <span>Tracking hand model...</span>
                </div>
              )}
              {!isCameraOn && (
                <div style={styles.cameraOffOverlay}>
                  <CameraOff size={32} color="var(--text-muted)" />
                  <span>Camera Offline</span>
                </div>
              )}
              <video 
                ref={videoRef}
                style={{
                  ...styles.video,
                  display: isCameraOn ? 'block' : 'none',
                  transform: settings.mirrorCamera === 'true' ? 'scaleX(-1)' : 'none'
                }}
                playsInline
                muted
              />
              {/* Hand bones overlay canvas (Double functions as visual trail renderer) */}
              <canvas 
                ref={handCanvasRef}
                width="1200"
                height="700"
                style={styles.handOverlayCanvas}
              />
            </div>

            <button 
              className={`glass-btn ${isCameraOn ? 'glass-btn-danger' : 'glass-btn-primary'}`}
              style={styles.camToggleBtn}
              onClick={() => setIsCameraOn(!isCameraOn)}
            >
              <Camera size={16} />
              <span>{isCameraOn ? 'Stop Camera Tracking' : 'Enable Gesture Canvas'}</span>
            </button>
          </div>

          <div className="glass-panel" style={styles.helpCard}>
            <h4 style={styles.helpTitle}>How to Draw in the Air:</h4>
            <ul style={styles.helpList}>
              <li>Ensure you are in a well-lit area.</li>
              <li><strong>Draw Gesture</strong>: Raise only your <strong>index finger</strong>. A line will trail your finger tip (works for Paint Brush, Sharp Pencil, Highlighter, Spray Can, and Eraser).</li>
              <li><strong>Hover Pointer Gesture</strong>: Raise both your <strong>index & middle fingers</strong> (like a 'V' peace sign) to move the pointer without drawing.</li>
              <li><strong>Eraser Wave Gesture</strong>: Select the <strong>Eraser</strong> tool and wave your hand rapidly left and right to clear the canvas paint!</li>
              <li><strong>Shape Sizing Gesture</strong>: When a shape is active (e.g., Rectangle, Triangle, Heart, Cloud, Moon, Cube, etc.), raise your <strong>index finger & thumb</strong>. Move them apart/together to change the size.</li>
              <li><strong>Lock Size Gesture</strong>: Tuck your <strong>thumb</strong> back to lock the shape's size. You can move your finger around to position the shape preview.</li>
              <li><strong>Stamp Shape Gesture</strong>: Close all your fingers (make a <strong>fist</strong>) to stamp the shape onto the canvas!</li>
              <li><strong>Tools & Colors Dropdown</strong>: Use the top bar dropdowns to select from 20+ shapes, customize colors, adjust size/opacity, and toggle stabilizer.</li>
              <li>You can also click/drag on the canvas using your mouse as a fallback!</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div style={styles.modalBg} onClick={() => setShowSaveModal(false)}>
          <div className="glass-panel-heavy" style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Save Sketch to Database</h2>
            <form onSubmit={handleSaveToGallery} style={styles.modalForm}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Sketch Title</label>
                <input 
                  type="text" 
                  className="glass-input"
                  value={saveTitle}
                  onChange={(e) => setSaveTitle(e.target.value)}
                  placeholder="e.g. Neon Horizon"
                  autoFocus
                />
              </div>

              {dbMessage && (
                <div style={dbMessage.includes('successfully') ? styles.successAlert : styles.failureAlert}>
                  {dbMessage}
                </div>
              )}

              <div style={styles.modalBtnRow}>
                <button type="button" className="glass-btn" onClick={() => setShowSaveModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="glass-btn glass-btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Sketch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    maxWidth: '1600px',
    margin: '0 auto',
    padding: '10px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px',
  },
  gestureStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  gestureIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: '100px',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    fontSize: '14px',
  },
  gestureIndicatorDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#6b7280',
    transition: 'all 0.3s ease'
  },
  coordsText: {
    fontFamily: 'monospace',
    color: 'var(--text-muted)',
    fontSize: '13px',
    minWidth: '70px'
  },
  fpsBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '100px',
    background: 'rgba(16, 185, 129, 0.05)',
    border: '1px solid rgba(16, 185, 129, 0.15)',
    fontSize: '12px',
  },
  actionButtons: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  workspace: {
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap',
  },
  canvasColumn: {
    flex: '3 1 750px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  canvasControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '10px 16px',
    height: '56px',
    borderRadius: '12px',
    position: 'relative',
    zIndex: 10,
  },
  dropdownContainer: {
    position: 'relative',
    display: 'inline-block',
  },
  controlDropdownBtn: {
    padding: '6px 14px',
    height: '36px',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  toolDropdownMenu: {
    position: 'absolute',
    top: '42px',
    left: '0',
    width: '450px',
    background: 'rgba(10, 5, 24, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    zIndex: '1000',
    backdropFilter: 'blur(20px)',
  },
  colorDropdownMenu: {
    position: 'absolute',
    top: '42px',
    left: '0',
    width: '180px',
    background: 'rgba(10, 5, 24, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '12px',
    padding: '12px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
    zIndex: '1000',
    backdropFilter: 'blur(20px)',
  },
  dropdownGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  dropdownGroupTitle: {
    fontSize: '11px',
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.4)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '2px',
  },
  dropdownGroupGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '6px',
  },
  dropdownItemBtn: {
    justifyContent: 'flex-start',
    padding: '6px 10px',
    fontSize: '12px',
    height: '28px',
    border: '1px solid transparent',
    width: '100%',
  },
  colorPaletteGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
  },
  inlineControl: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  inlineLabel: {
    whiteSpace: 'nowrap',
    fontWeight: '500',
  },
  inlineSlider: {
    width: '85px',
    cursor: 'pointer',
  },
  canvasContainer: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0a0518',
    padding: '0',
    border: '1px solid rgba(255,255,255,0.1)',
    height: '702px',
    borderRadius: '12px',
  },
  canvas: {
    display: 'block',
    cursor: 'crosshair',
    background: 'transparent',
    maxWidth: '100%',
    maxHeight: '100%',
  },
  sidebar: {
    flex: '1.2 1 300px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  videoCard: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  videoHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  videoWrapper: {
    position: 'relative',
    width: '100%',
    aspectRatio: '4/3',
    borderRadius: '12px',
    overflow: 'hidden',
    background: 'rgba(0, 0, 0, 0.4)',
    border: '1px solid var(--glass-border)',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  handOverlayCanvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  },
  cameraLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'rgba(5, 2, 15, 0.8)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    zIndex: 2,
  },
  miniSpinner: {
    width: '24px',
    height: '24px',
    border: '3px solid rgba(255, 255, 255, 0.1)',
    borderTopColor: 'var(--theme-color-2)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  cameraOffOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontSize: '13px',
    color: 'var(--text-muted)',
  },
  camToggleBtn: {
    width: '100%',
    justifyContent: 'center',
  },
  helpCard: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  helpTitle: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#fff',
  },
  helpList: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    paddingLeft: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    lineHeight: '1.4',
  },
  modalBg: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(3, 1, 8, 0.7)',
    backdropFilter: 'blur(8px)',
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  modalContent: {
    width: '100%',
    maxWidth: '450px',
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  modalTitle: {
    fontFamily: 'var(--font-title)',
    fontSize: '22px',
    fontWeight: '700',
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    fontWeight: '500',
  },
  modalBtnRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  },
  successAlert: {
    color: '#10b981',
    background: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '14px',
    fontWeight: '500',
  },
  failureAlert: {
    color: '#f43f5e',
    background: 'rgba(244, 63, 94, 0.1)',
    border: '1px solid rgba(244, 63, 94, 0.2)',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '14px',
    fontWeight: '500',
  }
}

