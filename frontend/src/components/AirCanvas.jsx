import React, { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { 
  Palette, Eraser, Circle as CircleIcon, Square, Slash, Trash2, Undo, Redo, Download, Save, Camera, CameraOff, Video, Eye, ShieldAlert, Crosshair, Zap, Triangle, Star,
  Pencil, Highlighter, Sparkles, ArrowUpRight, Move, CircleDot, Heart, Moon, Cloud, Plus, Box, ChevronDown, Hexagon, Image as ImageIcon, X
} from 'lucide-react'
import { BACKEND_URL } from '../App'
import { 
  project3DPoint, unprojectPoint, drawViewportGrid, drawWireframeCanvasBox, drawAxisHelper, 
  getMesh, drawMesh, draw3DStroke, generateOBJString 
} from '../utils/3dUtils'
import { drawShapePath } from '../utils/canvasUtils'
import { processImageToStencil } from '../utils/stencilUtils'
import ThreeDModelViewerModal from './ThreeDModelViewerModal'
import GlassDialog from './GlassDialog'

// Lightweight child component to isolate range slider re-renders and prevent canvas lag during drags
function SmoothSlider({ label, min, max, step = 1, value, onChange, onRelease, formatValue = (v) => v, isInline = false, inlineSliderStyle = {} }) {
  const [localVal, setLocalVal] = useState(value)

  useEffect(() => {
    setLocalVal(value)
  }, [value])

  const handleChange = (e) => {
    const val = parseFloat(e.target.value)
    setLocalVal(val)
    if (onChange) onChange(val)
  }

  const handleRelease = () => {
    if (onRelease) onRelease(localVal)
  }

  if (isInline) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '12px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
          {label}: {formatValue(localVal)}
        </span>
        <input 
          type="range" 
          min={min} 
          max={max} 
          step={step}
          value={localVal}
          onChange={handleChange}
          onMouseUp={handleRelease}
          onTouchEnd={handleRelease}
          className="glass-range"
          style={inlineSliderStyle}
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>
          {label}
        </span>
        <span style={{ color: '#06b6d4', fontWeight: 'bold' }}>
          {formatValue(localVal)}
        </span>
      </div>
      <input 
        type="range" 
        min={min} 
        max={max} 
        step={step}
        value={localVal}
        onChange={handleChange}
        onMouseUp={handleRelease}
        onTouchEnd={handleRelease}
        className="glass-range"
      />
    </div>
  )
}


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
// 3D Wireframe Canvas rendering helper functions are now imported from ../utils/3dUtils



// Image to Stencil processing helpers are now imported from ../utils/stencilUtils

export default function AirCanvas({ initialDrawing, onDrawingCleared, onDrawingSaved }) {
  const canvasRef = useRef(null)
  const videoRef = useRef(null)
  const handCanvasRef = useRef(null)
  const loadedDrawingIdRef = useRef(null)
  
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

  // Custom Glass Dialog State
  const [dialog, setDialog] = useState({
    isOpen: false,
    type: 'confirm',
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'OK',
    cancelText: 'Cancel'
  })

  // Stencil Converter States
  const [showStencilModal, setShowStencilModal] = useState(false)
  const [uploadedImage, setUploadedImage] = useState(null)
  const [stencilThreshold, setStencilThreshold] = useState(50)
  const [stencilInvert, setStencilInvert] = useState(false)
  const [stencilScale, setStencilScale] = useState(1.0)
  const [stencilPreviewUrl, setStencilPreviewUrl] = useState('')
  const [extractedContours, setExtractedContours] = useState([])
  const [extractedGrayscale, setExtractedGrayscale] = useState(null)
  const [stencilWidth, setStencilWidth] = useState(0)
  const [stencilHeight, setStencilHeight] = useState(0)
  const [stencilMode3D, setStencilMode3D] = useState('extrusion') // extrusion, heightmap
  const [show3DDownloadModal, setShow3DDownloadModal] = useState(false)
  const [downloaded3DModelData, setDownloaded3DModelData] = useState(null)

  useEffect(() => {
    if (!uploadedImage) {
      setStencilPreviewUrl('')
      setExtractedContours([])
      setExtractedGrayscale(null)
      return
    }

    const img = new Image()
    img.src = uploadedImage
    img.onload = () => {
      const { previewUrl, contours, w, h, grayscale } = processImageToStencil(img, stencilThreshold, stencilInvert)
      setStencilPreviewUrl(previewUrl)
      setExtractedContours(contours)
      setStencilWidth(w)
      setStencilHeight(h)
      setExtractedGrayscale(grayscale)
    }
  }, [uploadedImage, stencilThreshold, stencilInvert])

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      setUploadedImage(event.target.result)
    }
    reader.readAsDataURL(file)
  }

  const handleApplyStencil = () => {
    if (!stencilPreviewUrl) return

    // Apply to 2D Canvas
    const canvas = canvasRef.current
    if (canvas && extractedContours.length > 0) {
      const ctx = canvas.getContext('2d')
      
      ctx.save()
      ctx.strokeStyle = color || '#06b6d4'
      ctx.lineWidth = Math.max(2, brushSize / 2)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.globalAlpha = brushOpacity
      
      const scale2D = stencilScale * 1.5
      const offsetX = (canvas.width - stencilWidth * scale2D) / 2
      const offsetY = (canvas.height - stencilHeight * scale2D) / 2
      
      extractedContours.forEach(path => {
        if (path.length < 2) return
        ctx.beginPath()
        ctx.moveTo(offsetX + path[0].x * scale2D, offsetY + path[0].y * scale2D)
        for (let i = 1; i < path.length; i++) {
          ctx.lineTo(offsetX + path[i].x * scale2D, offsetY + path[i].y * scale2D)
        }
        ctx.stroke()
      })
      
      ctx.restore()
      saveCanvasState()
    }

    // Apply to 3D Canvas
    if (stencilMode3D === 'heightmap' && extractedGrayscale) {
      const scale3D = (250 / Math.max(stencilWidth, stencilHeight)) * stencilScale
      const depth3D = 60 * stencilScale
      
      const gridW = 35
      const gridH = 35
      const stepX = stencilWidth / (gridW - 1)
      const stepY = stencilHeight / (gridH - 1)
      
      const pointsGrid = []
      
      for (let r = 0; r < gridH; r++) {
        const rowPoints = []
        for (let c = 0; c < gridW; c++) {
          const px = Math.min(stencilWidth - 1, Math.round(c * stepX))
          const py = Math.min(stencilHeight - 1, Math.round(r * stepY))
          const idx = py * stencilWidth + px
          const val = extractedGrayscale[idx] || 0
          
          // Z depth is proportional to pixel brightness, centered on Z:
          const z3d = (val / 255 - 0.5) * depth3D
          
          rowPoints.push({
            x: (px - stencilWidth / 2) * scale3D,
            y: (py - stencilHeight / 2) * scale3D,
            z: z3d
          })
        }
        pointsGrid.push(rowPoints)
      }
      
      const new3DStrokes = []
      
      // Horizontal lines (rows)
      for (let r = 0; r < gridH; r++) {
        new3DStrokes.push({
          type: 'stroke',
          points: pointsGrid[r],
          color: color || '#38bdf8',
          opacity: 0.4,
          size: 1.5
        })
      }
      
      // Vertical lines (columns)
      for (let c = 0; c < gridW; c++) {
        const colPoints = []
        for (let r = 0; r < gridH; r++) {
          colPoints.push(pointsGrid[r][c])
        }
        new3DStrokes.push({
          type: 'stroke',
          points: colPoints,
          color: color || '#38bdf8',
          opacity: 0.4,
          size: 1.5
        })
      }
      
      stamped3DObjectsRef.current = [
        ...stamped3DObjectsRef.current,
        ...new3DStrokes
      ]
      save3DState()
    } else if (extractedContours.length > 0) {
      const scale3D = (250 / Math.max(stencilWidth, stencilHeight)) * stencilScale
      const depth3D = 40 * stencilScale
      
      const new3DStrokes = []

      extractedContours.forEach(path => {
        // 1. Back face path (z = -depth3D / 2)
        const backPoints = path.map(pt => ({
          x: (pt.x - stencilWidth / 2) * scale3D,
          y: (pt.y - stencilHeight / 2) * scale3D,
          z: -depth3D / 2
        }))

        // 2. Front face path (z = depth3D / 2)
        const frontPoints = path.map(pt => ({
          x: (pt.x - stencilWidth / 2) * scale3D,
          y: (pt.y - stencilHeight / 2) * scale3D,
          z: depth3D / 2
        }))

        // Add back face stroke
        new3DStrokes.push({
          type: 'stroke',
          points: backPoints,
          color: color || '#38bdf8',
          opacity: 0.8,
          size: 2
        })

        // Add front face stroke
        new3DStrokes.push({
          type: 'stroke',
          points: frontPoints,
          color: color || '#38bdf8',
          opacity: 0.8,
          size: 2
        })

        // 3. Connect back and front faces at regular intervals
        const step = Math.max(4, Math.floor(path.length / 12))
        for (let i = 0; i < path.length; i += step) {
          const pt = path[i]
          const x3d = (pt.x - stencilWidth / 2) * scale3D
          const y3d = (pt.y - stencilHeight / 2) * scale3D
          
          new3DStrokes.push({
            type: 'stroke',
            points: [
              { x: x3d, y: y3d, z: -depth3D / 2 },
              { x: x3d, y: y3d, z: depth3D / 2 }
            ],
            color: color || '#38bdf8',
            opacity: 0.5,
            size: 1.5
          })
        }

        // Connect the last point to close
        if (path.length > 0) {
          const pt = path[path.length - 1]
          const x3d = (pt.x - stencilWidth / 2) * scale3D
          const y3d = (pt.y - stencilHeight / 2) * scale3D
          new3DStrokes.push({
            type: 'stroke',
            points: [
              { x: x3d, y: y3d, z: -depth3D / 2 },
              { x: x3d, y: y3d, z: depth3D / 2 }
            ],
            color: color || '#38bdf8',
            opacity: 0.5,
            size: 1.5
          })
        }
      })

      stamped3DObjectsRef.current = [
        ...stamped3DObjectsRef.current,
        ...new3DStrokes
      ]
      save3DState()
    }

    setShowStencilModal(false)
    setUploadedImage(null)
  }

  // Keep saveTitle synced with initialDrawing
  useEffect(() => {
    if (initialDrawing && initialDrawing.title) {
      setSaveTitle(initialDrawing.title)
    } else {
      setSaveTitle('')
    }
  }, [initialDrawing])
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

  // 3D Canvas Mode States & Refs
  const [canvasMode, setCanvasMode] = useState('2d') // '2d' or '3d'
  const [active3DTool, setActive3DToolState] = useState('orbit') // 'orbit', '3d-freehand', '3d-cube', '3d-sphere', '3d-cylinder', '3d-pyramid', '3d-cone'
  const [undoStack3D, setUndoStack3D] = useState([[]])
  const [redoStack3D, setRedoStack3D] = useState([])

  const active3DToolRef = useRef('orbit')
  const camera3DRef = useRef({ rx: 0.5, ry: -0.5, scale: 1.0 })
  const stamped3DObjectsRef = useRef([])
  const active3DStrokeRef = useRef(null)
  const previewPos3DRef = useRef({ x: 0, y: 0, z: 0 })
  const previewSize3DRef = useRef(40)
  const canvas2DDataRef = useRef(null)

  const set3DTool = (t) => {
    setActive3DToolState(t)
    active3DToolRef.current = t
  }

  const save3DState = () => {
    const snapshot = [...stamped3DObjectsRef.current]
    setUndoStack3D(prev => {
      const next = [...prev, snapshot]
      if (next.length > 25) next.shift()
      return next
    })
    setRedoStack3D([])
  }

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
    waveHistory: [],
    // 3D tracking states
    isOrbiting: false,
    isOrbitingGest: false,
    lastOrbitX: 0,
    lastOrbitY: 0,
    orbitStartRx: 0,
    orbitStartRy: 0,
    isDrawing3D: false,
    isSizing3D: false,
    wasSizing3D: false,
    sizingSize3D: 0
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
    isCameraOn,
    canvasMode: '2d'
  })

  useEffect(() => {
    stateRef.current = {
      color,
      tool,
      brushSize,
      brushOpacity,
      stabilizeEnabled,
      settings,
      isCameraOn,
      canvasMode
    }
  }, [color, tool, brushSize, brushOpacity, stabilizeEnabled, settings, isCameraOn, canvasMode])

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
    
    const initialId = initialDrawing ? initialDrawing.id : null
    if (initialId !== loadedDrawingIdRef.current) {
      loadedDrawingIdRef.current = initialId
      
      // Fill canvas with default background color
      ctx.fillStyle = '#0a0518'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      if (initialDrawing && initialDrawing.image_data) {
        console.log("Loading image data from initialDrawing...")
        const img = new Image()
        img.onload = () => {
          console.log("Image loaded successfully! Drawing on canvas...")
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          saveCanvasState(false)
        }
        img.onerror = (err) => {
          console.error("Failed to load image data URL:", err)
        }
        img.src = initialDrawing.image_data
      } else {
        console.log("No initial drawing provided, saving default state.")
        // Save initial state
        saveCanvasState(true)
      }
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
  const saveCanvasState = (isEmpty = false) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    
    setUndoStack(prev => {
      const next = [...prev, { imgData, isEmpty }]
      if (next.length > 25) next.shift()
      return next
    })
    setRedoStack([])
  }

  // Handle Mode Switching
  const handleModeSwitch = (newMode) => {
    if (newMode === canvasMode) return
    
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    
    if (newMode === '3d') {
      // Save 2D canvas content before going to 3D
      canvas2DDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
      setCanvasMode('3d')
    } else {
      // Going to 2D
      setCanvasMode('2d')
      // Restore 2D canvas content
      setTimeout(() => {
        const canvas2 = canvasRef.current
        if (!canvas2) return
        const ctx2 = canvas2.getContext('2d')
        ctx2.lineCap = 'round'
        ctx2.lineJoin = 'round'
        if (canvas2DDataRef.current) {
          ctx2.putImageData(canvas2DDataRef.current, 0, 0)
        } else {
          ctx2.fillStyle = '#0a0518'
          ctx2.fillRect(0, 0, canvas2.width, canvas2.height)
        }
      }, 50)
    }
  }

  // Handle Undo
  const handleUndo = () => {
    if (canvasMode === '3d') {
      handleUndo3D()
      return
    }
    if (undoStack.length <= 1) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    const current = undoStack[undoStack.length - 1]
    setRedoStack(prev => [...prev, current])
    
    const previous = undoStack[undoStack.length - 2]
    ctx.putImageData(previous.imgData, 0, 0)
    setUndoStack(prev => prev.slice(0, -1))
  }

  const handleUndo3D = () => {
    if (undoStack3D.length <= 1) return
    
    const current = undoStack3D[undoStack3D.length - 1]
    setRedoStack3D(prev => [...prev, current])
    
    const previous = undoStack3D[undoStack3D.length - 2]
    stamped3DObjectsRef.current = [...previous]
    setUndoStack3D(prev => prev.slice(0, -1))
  }

  // Handle Redo
  const handleRedo = () => {
    if (canvasMode === '3d') {
      handleRedo3D()
      return
    }
    if (redoStack.length === 0) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    const nextState = redoStack[redoStack.length - 1]
    ctx.putImageData(nextState.imgData, 0, 0)
    
    setUndoStack(prev => [...prev, nextState])
    setRedoStack(prev => prev.slice(0, -1))
  }

  const handleRedo3D = () => {
    if (redoStack3D.length === 0) return
    
    const nextState = redoStack3D[redoStack3D.length - 1]
    stamped3DObjectsRef.current = [...nextState]
    
    setUndoStack3D(prev => [...prev, nextState])
    setRedoStack3D(prev => prev.slice(0, -1))
  }

  // Handle Clear
  const handleClear = () => {
    if (canvasMode === '3d') {
      handleClear3D()
      return
    }
    setDialog({
      isOpen: true,
      type: 'confirm',
      title: 'Clear 2D Canvas',
      message: 'Are you sure you want to clear the canvas? All current drawing paths will be cleared.',
      confirmText: 'Clear',
      cancelText: 'Cancel',
      onConfirm: () => {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#0a0518'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        saveCanvasState(true)
        setDialog(prev => ({ ...prev, isOpen: false }))
      },
      onCancel: () => setDialog(prev => ({ ...prev, isOpen: false }))
    })
  }

  const handleClear3D = () => {
    setDialog({
      isOpen: true,
      type: 'confirm',
      title: 'Clear 3D Canvas',
      message: 'Are you sure you want to clear the 3D canvas? This will permanently delete all 3D meshes on the screen.',
      confirmText: 'Clear',
      cancelText: 'Cancel',
      onConfirm: () => {
        stamped3DObjectsRef.current = []
        save3DState()
        setDialog(prev => ({ ...prev, isOpen: false }))
      },
      onCancel: () => setDialog(prev => ({ ...prev, isOpen: false }))
    })
  }

  // 3D Mouse event listeners
  const handleMouseDown3D = (e, rect) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const sx = (e.clientX - rect.left) * scaleX
    const sy = (e.clientY - rect.top) * scaleY
    const tool3d = active3DToolRef.current
    
    if (tool3d === 'orbit') {
      drawingRef.current.isOrbiting = true
      drawingRef.current.orbitStartX = sx
      drawingRef.current.orbitStartY = sy
      drawingRef.current.orbitStartRx = camera3DRef.current.rx
      drawingRef.current.orbitStartRy = camera3DRef.current.ry
    } else if (tool3d === '3d-freehand') {
      drawingRef.current.isDrawing3D = true
      const pt = unprojectPoint(sx, sy, camera3DRef.current.rx, camera3DRef.current.ry, camera3DRef.current.scale, canvas.width, canvas.height)
      active3DStrokeRef.current = [pt]
    } else if (['3d-cube', '3d-sphere', '3d-cylinder', '3d-pyramid', '3d-cone'].includes(tool3d)) {
      drawingRef.current.isSizing3D = true
      drawingRef.current.sizingStartX = sx
      drawingRef.current.sizingStartY = sy
      
      const pt = unprojectPoint(sx, sy, camera3DRef.current.rx, camera3DRef.current.ry, camera3DRef.current.scale, canvas.width, canvas.height)
      previewPos3DRef.current = pt
      previewSize3DRef.current = 20
    }
  }

  const handleMouseMove3D = (e, rect) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const sx = (e.clientX - rect.left) * scaleX
    const sy = (e.clientY - rect.top) * scaleY
    const tool3d = active3DToolRef.current
    const drawState = drawingRef.current
    
    if (drawState.isOrbiting) {
      const dx = sx - drawState.orbitStartX
      const dy = sy - drawState.orbitStartY
      camera3DRef.current.ry = drawState.orbitStartRy + dx * 0.007
      camera3DRef.current.rx = drawState.orbitStartRx - dy * 0.007
    } else if (drawState.isDrawing3D) {
      const pt = unprojectPoint(sx, sy, camera3DRef.current.rx, camera3DRef.current.ry, camera3DRef.current.scale, canvas.width, canvas.height)
      active3DStrokeRef.current = [...(active3DStrokeRef.current || []), pt]
    } else if (drawState.isSizing3D) {
      const dx = sx - drawState.sizingStartX
      const dy = sy - drawState.sizingStartY
      const dist = Math.sqrt(dx * dx + dy * dy)
      previewSize3DRef.current = Math.max(10, dist * 0.5)
    } else {
      if (['3d-cube', '3d-sphere', '3d-cylinder', '3d-pyramid', '3d-cone'].includes(tool3d)) {
        const pt = unprojectPoint(sx, sy, camera3DRef.current.rx, camera3DRef.current.ry, camera3DRef.current.scale, canvas.width, canvas.height)
        previewPos3DRef.current = pt
      }
    }
  }

  const handleMouseUp3D = () => {
    const drawState = drawingRef.current
    
    if (drawState.isOrbiting) {
      drawState.isOrbiting = false
    } else if (drawState.isDrawing3D) {
      drawState.isDrawing3D = false
      if (active3DStrokeRef.current && active3DStrokeRef.current.length > 1) {
        stamped3DObjectsRef.current.push({
          type: 'stroke',
          points: active3DStrokeRef.current,
          color: stateRef.current.color,
          opacity: stateRef.current.brushOpacity,
          size: stateRef.current.brushSize
        })
        save3DState()
        // Auto-switch to orbit mode so user can immediately rotate/zoom!
        set3DTool('orbit')
      }
      active3DStrokeRef.current = null
    } else if (drawState.isSizing3D) {
      drawState.isSizing3D = false
      const toolType = active3DToolRef.current.replace('3d-', '')
      stamped3DObjectsRef.current.push({
        type: toolType,
        pos: { ...previewPos3DRef.current },
        size: previewSize3DRef.current,
        color: stateRef.current.color,
        opacity: stateRef.current.brushOpacity
      })
      save3DState()
      // Auto-switch to orbit mode so user can immediately rotate/zoom!
      set3DTool('orbit')
    }
  }

  const handleWheel3D = (e) => {
    if (canvasMode !== '3d') return
    const zoomSpeed = 0.05
    camera3DRef.current.scale = Math.max(0.1, Math.min(5.0, camera3DRef.current.scale - e.deltaY * zoomSpeed * 0.01))
  }

  // Fallback mouse listeners
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    
    if (stateRef.current.canvasMode === '3d') {
      handleMouseDown3D(e, rect)
      return
    }
    
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY
    startDraw(x, y)
  }

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    
    if (stateRef.current.canvasMode === '3d') {
      handleMouseMove3D(e, rect)
      return
    }
    
    if (!drawingRef.current.isDrawing) return
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY
    
    // Add interactive pointer particles while mouse dragging
    addParticles(x, y, stateRef.current.color)
    drawMove(x, y)
  }

  const handleMouseUp = () => {
    if (stateRef.current.canvasMode === '3d') {
      handleMouseUp3D()
      return
    }
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

  const draw3DViewportOverlay = (ctx, rx, ry, scale, width, height) => {
    ctx.save()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.font = '11px monospace'
    
    // Top-left viewport status
    ctx.fillText(`Viewport: Blender Perspective`, 20, 30)
    ctx.fillText(`Grid Spacing: 50m`, 20, 46)
    ctx.fillText(`Cam Orbit: rx=${rx.toFixed(2)} ry=${ry.toFixed(2)}`, 20, 62)
    ctx.fillText(`Zoom: ${scale.toFixed(2)}x`, 20, 78)
    
    // Top-right viewport stats
    ctx.fillText(`Objects: ${stamped3DObjectsRef.current.length}`, width - 110, 30)
    ctx.fillText(`Mode: 3D Gesture Viewport`, width - 200, 46)
    
    ctx.restore()
  }

  const draw3DCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    
    // Clear main canvas with dark viewport background
    ctx.fillStyle = '#0a0518'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // Get current camera settings from Ref (safe for 60fps)
    const { rx, ry, scale } = camera3DRef.current
    
    // Draw grid
    drawViewportGrid(ctx, rx, ry, scale, canvas.width, canvas.height)
    
    // Draw Axis Helper (in top-left corner)
    drawAxisHelper(ctx, rx, ry, scale, canvas.width, canvas.height)
    
    // Draw all stamped 3D objects (sorted back-to-front for proper depth sorting)
    const stampedObjects = [...stamped3DObjectsRef.current]
    const objectsWithDepth = stampedObjects.map(obj => {
      let depth = 0
      if (obj.type === 'stroke') {
        if (obj.points && obj.points.length > 0) {
          let sumZ = 0
          obj.points.forEach(pt => {
            const cosY = Math.cos(ry)
            const sinY = Math.sin(ry)
            const z1 = pt.x * sinY + pt.z * cosY
            const cosX = Math.cos(rx)
            const sinX = Math.sin(rx)
            const z2 = pt.y * sinX + z1 * cosX
            sumZ += z2
          })
          depth = sumZ / obj.points.length
        }
      } else {
        const cosY = Math.cos(ry)
        const sinY = Math.sin(ry)
        const z1 = obj.pos.x * sinY + obj.pos.z * cosY
        const cosX = Math.cos(rx)
        const sinX = Math.sin(rx)
        const z2 = obj.pos.y * sinX + z1 * cosX
        depth = z2
      }
      return { obj, depth }
    })

    objectsWithDepth.sort((a, b) => b.depth - a.depth)

    objectsWithDepth.forEach(({ obj }) => {
      if (obj.type === 'stroke') {
        draw3DStroke(ctx, obj.points, rx, ry, scale, 1.0, canvas.width, canvas.height, obj.color, obj.opacity, obj.size)
      } else {
        const mesh = getMesh(obj.type, obj.size)
        drawMesh(ctx, mesh, obj.pos, null, rx, ry, scale, 1.0, canvas.width, canvas.height, obj.color, obj.opacity, 2)
      }
    })
    
    // Draw active 3D freehand stroke if drawing
    const activeStroke = active3DStrokeRef.current
    if (activeStroke && activeStroke.length > 0) {
      draw3DStroke(ctx, activeStroke, rx, ry, scale, 1.0, canvas.width, canvas.height, stateRef.current.color, stateRef.current.brushOpacity, stateRef.current.brushSize)
    }
    
    // Draw shape preview if placing a primitive
    const tool3d = active3DToolRef.current
    if (['3d-cube', '3d-sphere', '3d-cylinder', '3d-pyramid', '3d-cone'].includes(tool3d)) {
      const shapeType = tool3d.replace('3d-', '')
      const previewPos = previewPos3DRef.current
      const previewSize = previewSize3DRef.current
      
      const mesh = getMesh(shapeType, previewSize)
      drawMesh(ctx, mesh, previewPos, null, rx, ry, scale, 1.0, canvas.width, canvas.height, stateRef.current.color, 0.8, 2)
      
      // Label near preview
      const proj = project3DPoint(previewPos.x, previewPos.y, previewPos.z, rx, ry, scale, canvas.width, canvas.height)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
      ctx.font = 'bold 11px monospace'
      ctx.fillText(`${shapeType.toUpperCase()} (Pinch to size, Fist to stamp)`, proj.x - 70, proj.y - 12)
    }
    
    // Viewport labels overlay
    draw3DViewportOverlay(ctx, rx, ry, scale, canvas.width, canvas.height)
  }

  const process3DTracking = (landmarks, x, y, isIndexUp, isMiddleUp, hCtx, canvas) => {
    const indexTip = landmarks[8]
    const thumbTip = landmarks[4]
    const drawState = drawingRef.current
    const tool3d = active3DToolRef.current
    
    // Calculate pinch distance (index tip to thumb tip)
    const pinchDist = Math.sqrt(
      Math.pow(indexTip.x - thumbTip.x, 2) +
      Math.pow(indexTip.y - thumbTip.y, 2)
    )
    
    let currentMode = 'None'
    
    // Wave gesture detection for Eraser tool in 3D
    const { color: currentColor, brushOpacity: currentBrushOpacity, brushSize: currentBrushSize } = stateRef.current
    
    if (tool3d === 'eraser' || (tool3d === 'orbit' && stateRef.current.tool === 'eraser')) {
      const now = performance.now()
      if (!drawState.waveHistory) {
        drawState.waveHistory = []
      }
      drawState.waveHistory.push({ x, y, time: now })
      drawState.waveHistory = drawState.waveHistory.filter(pt => now - pt.time < 1000)
      
      if (drawState.waveHistory.length > 10) {
        let directionChanges = 0
        let lastDirection = 0
        let lastPeakX = drawState.waveHistory[0].x
        const minAmplitude = 60
        
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
          drawState.waveHistory = []
          stamped3DObjectsRef.current = []
          save3DState()
          currentMode = 'Canvas Cleared'
          
          hCtx.fillStyle = 'rgba(239, 68, 68, 0.3)'
          hCtx.fillRect(0, 0, hCtx.canvas.width, hCtx.canvas.height)
          hCtx.fillStyle = '#ffffff'
          hCtx.font = 'bold 20px sans-serif'
          hCtx.fillText("👋 Wave Detected - 3D Scene Cleared!", hCtx.canvas.width / 2 - 190, hCtx.canvas.height / 2)
        }
      }
    } else {
      drawState.waveHistory = []
    }
    
    if (currentMode === 'Canvas Cleared') {
      if (drawState.lastGestureMode !== currentMode) {
        drawState.lastGestureMode = currentMode
        updateDOMGestureStatus(currentMode)
      }
      return
    }

    // Main 3D Gesture States:
    // 1. Hover Mode: Index & Middle up
    if (isIndexUp && isMiddleUp) {
      drawState.wasSizing3D = false
      
      // Stop drawing if we were drawing
      if (drawState.isDrawing3D) {
        drawState.isDrawing3D = false
        if (active3DStrokeRef.current && active3DStrokeRef.current.length > 1) {
          stamped3DObjectsRef.current.push({
            type: 'stroke',
            points: active3DStrokeRef.current,
            color: currentColor,
            opacity: currentBrushOpacity,
            size: currentBrushSize
          })
          save3DState()
          set3DTool('orbit')
        }
        active3DStrokeRef.current = null
      }
      
      if (tool3d === 'orbit') {
        currentMode = '3D Orbit Rotate'
        if (!drawState.isOrbitingGest) {
          drawState.isOrbitingGest = true
          drawState.lastOrbitX = x
          drawState.lastOrbitY = y
        } else {
          const dx = x - drawState.lastOrbitX
          const dy = y - drawState.lastOrbitY
          camera3DRef.current.ry += dx * 0.007
          camera3DRef.current.rx -= dy * 0.007
          drawState.lastOrbitX = x
          drawState.lastOrbitY = y
        }
      } else if (['3d-cube', '3d-sphere', '3d-cylinder', '3d-pyramid', '3d-cone'].includes(tool3d)) {
        currentMode = '3D Placing Shape'
        drawState.isOrbitingGest = false
        previewPos3DRef.current = unprojectPoint(x, y, camera3DRef.current.rx, camera3DRef.current.ry, camera3DRef.current.scale, canvas.width, canvas.height)
      } else {
        currentMode = 'Hover'
        drawState.isOrbitingGest = false
      }
    }
    // 2. Sizing / Zooming or Drawing: Index Up & Middle Down
    else if (isIndexUp && !isMiddleUp) {
      drawState.isOrbitingGest = false
      
      // Check for Pinch Gesture: Index & Thumb raised, and pinch distance is large
      if (pinchDist > 0.05) {
        if (drawState.isDrawing3D) {
          drawState.isDrawing3D = false
          if (active3DStrokeRef.current && active3DStrokeRef.current.length > 1) {
            stamped3DObjectsRef.current.push({
              type: 'stroke',
              points: active3DStrokeRef.current,
              color: currentColor,
              opacity: currentBrushOpacity,
              size: currentBrushSize
            })
            save3DState()
          }
          active3DStrokeRef.current = null
        }
        
        if (tool3d === 'orbit') {
          currentMode = '3D View Zooming'
          camera3DRef.current.scale = Math.max(0.1, Math.min(5.0, pinchDist * 7.0))
        } else if (['3d-cube', '3d-sphere', '3d-cylinder', '3d-pyramid', '3d-cone'].includes(tool3d)) {
          currentMode = '3D Sizing Shape'
          previewPos3DRef.current = unprojectPoint(x, y, camera3DRef.current.rx, camera3DRef.current.ry, camera3DRef.current.scale, canvas.width, canvas.height)
          previewSize3DRef.current = pinchDist * canvas.width * 0.4
          
          drawState.wasSizing3D = true
          drawState.sizingSize3D = previewSize3DRef.current
        }
      } 
      // Thumb tucked: lock position / draw freehand stroke
      else {
        if (tool3d === '3d-freehand') {
          currentMode = '3D Drawing'
          if (!drawState.isDrawing3D) {
            drawState.isDrawing3D = true
            const pt = unprojectPoint(x, y, camera3DRef.current.rx, camera3DRef.current.ry, camera3DRef.current.scale, canvas.width, canvas.height)
            active3DStrokeRef.current = [pt]
          } else {
            const pt = unprojectPoint(x, y, camera3DRef.current.rx, camera3DRef.current.ry, camera3DRef.current.scale, canvas.width, canvas.height)
            active3DStrokeRef.current = [...(active3DStrokeRef.current || []), pt]
          }
        } else if (['3d-cube', '3d-sphere', '3d-cylinder', '3d-pyramid', '3d-cone'].includes(tool3d)) {
          if (drawState.wasSizing3D) {
            currentMode = '3D Shape Size Locked'
            previewPos3DRef.current = unprojectPoint(x, y, camera3DRef.current.rx, camera3DRef.current.ry, camera3DRef.current.scale, canvas.width, canvas.height)
          } else {
            currentMode = '3D Placing Shape'
            previewPos3DRef.current = unprojectPoint(x, y, camera3DRef.current.rx, camera3DRef.current.ry, camera3DRef.current.scale, canvas.width, canvas.height)
            previewSize3DRef.current = 40
          }
        }
      }
    }
    // 3. Fist (No fingers up) - Stamp Shape or finish stroke
    else {
      drawState.isOrbitingGest = false
      
      if (['3d-cube', '3d-sphere', '3d-cylinder', '3d-pyramid', '3d-cone'].includes(tool3d)) {
        if (drawState.wasSizing3D) {
          const shapeType = tool3d.replace('3d-', '')
          stamped3DObjectsRef.current.push({
            type: shapeType,
            pos: { ...previewPos3DRef.current },
            size: drawState.sizingSize3D || 40,
            color: currentColor,
            opacity: currentBrushOpacity
          })
          save3DState()
          
          drawState.wasSizing3D = false
          drawState.sizingSize3D = 0
          currentMode = '3D Shape Stamped'
          set3DTool('orbit')
        } else {
          currentMode = 'None'
        }
      } else if (tool3d === '3d-freehand') {
        if (drawState.isDrawing3D) {
          drawState.isDrawing3D = false
          if (active3DStrokeRef.current && active3DStrokeRef.current.length > 1) {
            stamped3DObjectsRef.current.push({
              type: 'stroke',
              points: active3DStrokeRef.current,
              color: currentColor,
              opacity: currentBrushOpacity,
              size: currentBrushSize
            })
            save3DState()
            set3DTool('orbit')
          }
          active3DStrokeRef.current = null
          currentMode = '3D Stroke Complete'
        } else {
          currentMode = 'None'
        }
      } else {
        currentMode = 'None'
      }
    }
    
    if (coordsTextRef.current) {
      coordsTextRef.current.innerText = `(${Math.round(x)}, ${Math.round(y)})`
    }
    
    if (drawState.lastGestureMode !== currentMode) {
      drawState.lastGestureMode = currentMode
      updateDOMGestureStatus(currentMode)
    }
  }

  // Background particle animator loop (keeps rendering smooth and distinct from drawings)
  const startParticlesAnimationLoop = () => {
    const loop = () => {
      updateAndDrawParticles()
      trackFps()
      
      if (stateRef.current.canvasMode === '3d') {
        draw3DCanvas()
      }
      
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
        setDialog({
          isOpen: true,
          type: 'alert',
          title: 'MediaPipe Load Error',
          message: 'MediaPipe tracking script libraries failed to load. Please check your network connection and reload.',
          confirmText: 'OK',
          onConfirm: () => setDialog(prev => ({ ...prev, isOpen: false }))
        })
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

      if (stateRef.current.canvasMode === '3d') {
        const isIndexUp = indexTip.y < indexPip.y
        const isMiddleUp = middleTip.y < middlePip.y
        process3DTracking(landmarks, x, y, isIndexUp, isMiddleUp, hCtx, canvas)
        return
      }

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
            saveCanvasState(true)
            
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
      if (stateRef.current.canvasMode === '3d') {
        drawState.isOrbitingGest = false
        if (drawState.isDrawing3D) {
          drawState.isDrawing3D = false
          if (active3DStrokeRef.current && active3DStrokeRef.current.length > 1) {
            stamped3DObjectsRef.current.push({
              type: 'stroke',
              points: active3DStrokeRef.current,
              color: stateRef.current.color,
              opacity: stateRef.current.brushOpacity,
              size: stateRef.current.brushSize
            })
            save3DState()
          }
          active3DStrokeRef.current = null
        }
      } else {
        if (drawState.isDrawing) {
          endDraw()
        }
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

    const isUpdate = !!initialDrawing
    const url = isUpdate 
      ? `${BACKEND_URL}/api/drawings/${initialDrawing.id}`
      : `${BACKEND_URL}/api/drawings`
    const method = isUpdate ? 'PUT' : 'POST'

    try {
      const res = await fetch(url, {
        method: method,
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
        const data = await res.json()
        setDbMessage(isUpdate ? 'Sketch updated successfully!' : 'Sketch saved successfully!')
        
        if (onDrawingSaved) {
          onDrawingSaved(data)
        }
        
        if (!isUpdate) {
          setSaveTitle('')
        }
        
        setTimeout(() => {
          setShowSaveModal(false)
          setDbMessage('')
        }, 2000)
      } else {
        const data = await res.json()
        setDbMessage(data.detail || (isUpdate ? 'Failed to update sketch' : 'Failed to save sketch'))
      }
    } catch (err) {
      setDbMessage('Server connection error')
    } finally {
      setSaving(false)
    }
  }

  // Local file download
  const handleDownloadLocally = () => {
    if (canvasMode === '3d') {
      setDownloaded3DModelData([...stamped3DObjectsRef.current])
      setShow3DDownloadModal(true)
    } else {
      const canvas = canvasRef.current
      const dataUrl = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `miro_canvas_sketch_${Date.now()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const is2DEmpty = undoStack.length === 0 || !!undoStack[undoStack.length - 1]?.isEmpty
  const is3DEmpty = (undoStack3D[undoStack3D.length - 1] || []).length === 0
  const isCanvasEmpty = canvasMode === '3d' ? is3DEmpty : is2DEmpty

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
          <div style={styles.segmentedControl}>
            <button 
              style={canvasMode === '2d' ? styles.segmentedBtnActive : styles.segmentedBtn}
              onClick={() => handleModeSwitch('2d')}
              title="Switch to 2D Canvas"
            >
              <Palette size={14} />
              <span>2D Canvas</span>
            </button>
            <button 
              style={canvasMode === '3d' ? styles.segmentedBtnActive : styles.segmentedBtn}
              onClick={() => handleModeSwitch('3d')}
              title="Switch to 3D digital wireframe canvas"
            >
              <Box size={14} />
              <span>3D Canvas</span>
            </button>
          </div>

          <button 
            className="glass-btn glass-btn-primary" 
            onClick={() => setShowStencilModal(true)}
            title="Convert image to stencil outline for 2D & 3D canvases"
          >
            <ImageIcon size={16} />
            <span>Stencil Converter</span>
          </button>

          <button className="glass-btn" onClick={handleUndo} disabled={canvasMode === '3d' ? undoStack3D.length <= 1 : undoStack.length <= 1} title="Undo last stroke/stamp">
            <Undo size={16} />
            <span>Undo</span>
          </button>
          <button className="glass-btn" onClick={handleRedo} disabled={canvasMode === '3d' ? redoStack3D.length === 0 : redoStack.length === 0} title="Redo last stroke/stamp">
            <Redo size={16} />
            <span>Redo</span>
          </button>
          <button className="glass-btn" onClick={handleClear} disabled={isCanvasEmpty} title="Clear Canvas">
            <Trash2 size={16} color="#f43f5e" />
            <span>Clear</span>
          </button>
          <button className="glass-btn" onClick={handleDownloadLocally} disabled={isCanvasEmpty} title="Save to local disk">
            <Download size={16} />
            <span>Download</span>
          </button>
          <button className="glass-btn glass-btn-primary" onClick={() => setShowSaveModal(true)} title="Save to database" disabled={isCanvasEmpty || canvasMode === '3d'}>
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
            {canvasMode === '3d' ? (
              <>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', marginRight: '6px' }}>3D Tools:</span>
                  <button 
                    className={`glass-btn ${active3DTool === 'orbit' ? 'glass-btn-active' : ''}`}
                    style={{ padding: '6px 12px', fontSize: '13px', height: '34px' }}
                    onClick={() => set3DTool('orbit')}
                    title="Orbit View: Drag mouse or raise index & middle fingers to rotate, scroll wheel or pinch to zoom"
                  >
                    <Crosshair size={14} />
                    <span>Orbit View</span>
                  </button>
                  <button 
                    className={`glass-btn ${active3DTool === '3d-freehand' ? 'glass-btn-active' : ''}`}
                    style={{ padding: '6px 12px', fontSize: '13px', height: '34px' }}
                    onClick={() => set3DTool('3d-freehand')}
                    title="3D Freehand Sketch: Drag mouse or raise index finger to sketch in 3D"
                  >
                    <Pencil size={14} />
                    <span>3D Sketch</span>
                  </button>
                  <button 
                    className={`glass-btn ${active3DTool === '3d-cube' ? 'glass-btn-active' : ''}`}
                    style={{ padding: '6px 12px', fontSize: '13px', height: '34px' }}
                    onClick={() => set3DTool('3d-cube')}
                    title="Cube Primitive: Drag to resize, raise index & thumb to resize, fist to stamp"
                  >
                    <Box size={14} />
                    <span>Cube</span>
                  </button>
                  <button 
                    className={`glass-btn ${active3DTool === '3d-sphere' ? 'glass-btn-active' : ''}`}
                    style={{ padding: '6px 12px', fontSize: '13px', height: '34px' }}
                    onClick={() => set3DTool('3d-sphere')}
                    title="Sphere Primitive: Drag to resize, raise index & thumb to resize, fist to stamp"
                  >
                    <CircleIcon size={14} />
                    <span>Sphere</span>
                  </button>
                  <button 
                    className={`glass-btn ${active3DTool === '3d-cylinder' ? 'glass-btn-active' : ''}`}
                    style={{ padding: '6px 12px', fontSize: '13px', height: '34px' }}
                    onClick={() => set3DTool('3d-cylinder')}
                    title="Cylinder Primitive: Drag to resize, raise index & thumb to resize, fist to stamp"
                  >
                    <Box size={14} />
                    <span>Cylinder</span>
                  </button>
                  <button 
                    className={`glass-btn ${active3DTool === '3d-pyramid' ? 'glass-btn-active' : ''}`}
                    style={{ padding: '6px 12px', fontSize: '13px', height: '34px' }}
                    onClick={() => set3DTool('3d-pyramid')}
                    title="Pyramid Primitive: Drag to resize, raise index & thumb to resize, fist to stamp"
                  >
                    <Triangle size={14} />
                    <span>Pyramid</span>
                  </button>
                  <button 
                    className={`glass-btn ${active3DTool === '3d-cone' ? 'glass-btn-active' : ''}`}
                    style={{ padding: '6px 12px', fontSize: '13px', height: '34px' }}
                    onClick={() => set3DTool('3d-cone')}
                    title="Cone Primitive: Drag to resize, raise index & thumb to resize, fist to stamp"
                  >
                    <Triangle size={14} />
                    <span>Cone</span>
                  </button>
                </div>
                
                {/* Color Palette Dropdown */}
                <div 
                  style={{ ...styles.dropdownContainer, marginLeft: 'auto' }}
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

                {/* Line size slider for 3D strokes */}
                <SmoothSlider 
                  label="Size"
                  min="1"
                  max="30"
                  value={brushSize}
                  onChange={(val) => { stateRef.current.brushSize = val; }}
                  onRelease={(val) => setBrushSize(val)}
                  formatValue={(v) => `${v}px`}
                  isInline={true}
                  inlineSliderStyle={styles.inlineSlider}
                />
              </>
            ) : (
              <>
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
                <SmoothSlider 
                  label="Size"
                  min="1"
                  max="100"
                  value={brushSize}
                  onChange={(val) => { stateRef.current.brushSize = val; }}
                  onRelease={(val) => setBrushSize(val)}
                  formatValue={(v) => `${v}px`}
                  isInline={true}
                  inlineSliderStyle={styles.inlineSlider}
                />

                {/* Opacity Slider */}
                <SmoothSlider 
                  label="Opacity"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={brushOpacity}
                  onChange={(val) => { stateRef.current.brushOpacity = val; }}
                  onRelease={(val) => setBrushOpacity(val)}
                  formatValue={(v) => `${Math.round(v * 100)}%`}
                  isInline={true}
                  inlineSliderStyle={styles.inlineSlider}
                />

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
              </>
            )}
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
              onWheel={handleWheel3D}
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
            {canvasMode === '3d' ? (
              <>
                <h4 style={styles.helpTitle}>How to Build 3D Models in the Air:</h4>
                <ul style={styles.helpList}>
                  <li>Ensure you are in a well-lit area.</li>
                  <li><strong>Orbit View Tool</strong>:
                    <ul style={{ paddingLeft: '14px', listStyleType: 'circle', display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '3px' }}>
                      <li><strong>Rotate View</strong>: Raise both <strong>index & middle fingers</strong> (Hover) and move them left/right/up/down to orbit the camera!</li>
                      <li><strong>Zoom Camera</strong>: Raise <strong>index finger & thumb</strong> (Pinch) and spread them apart or pinch together to zoom in or out!</li>
                    </ul>
                  </li>
                  <li><strong>3D Primitive Shapes (Cube, Sphere, Cylinder, Pyramid, Cone)</strong>:
                    <ul style={{ paddingLeft: '14px', listStyleType: 'circle', display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '3px' }}>
                      <li><strong>Hover/Move Shape</strong>: Raise <strong>index & middle fingers</strong> to move the active shape preview in 3D space!</li>
                      <li><strong>Resize Shape</strong>: Raise <strong>index finger & thumb</strong> and move them apart/together to adjust the shape's size.</li>
                      <li><strong>Lock Shape Size</strong>: Tuck your <strong>thumb</strong> back (only index up) to lock the shape's size. Move your finger to position the shape.</li>
                      <li><strong>Stamp Shape into Scene</strong>: Close all your fingers (make a <strong>fist</strong>) to stamp the shape onto the wireframe canvas!</li>
                    </ul>
                  </li>
                  <li><strong>3D Freehand Sketching Tool</strong>:
                    <ul style={{ paddingLeft: '14px', listStyleType: 'circle', display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '3px' }}>
                      <li><strong>Draw 3D Stroke</strong>: Raise only your <strong>index finger</strong> and draw in thin air to create beautiful 3D wireframe sketches!</li>
                      <li><strong>Lift Finger</strong>: Raise both <strong>index & middle fingers</strong> or close your fist to stop drawing.</li>
                    </ul>
                  </li>
                  <li><strong>Clear Viewport</strong>: Select <strong>Eraser</strong> or press <strong>Clear</strong>. You can also wave your hand left & right to wipe the 3D scene!</li>
                  <li>You can also drag with your mouse to orbit/sketch, and use the scroll wheel to zoom!</li>
                </ul>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && createPortal(
        <div className="modal-backdrop-glass" onClick={() => setShowSaveModal(false)}>
          <div className="glass-panel-heavy" style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>{initialDrawing ? 'Update Sketch in Database' : 'Save Sketch to Database'}</h2>
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
                  {saving ? (initialDrawing ? 'Updating...' : 'Saving...') : (initialDrawing ? 'Update Sketch' : 'Save Sketch')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Stencil Converter Modal */}
      {showStencilModal && createPortal(
        <div className="modal-backdrop-glass" onClick={() => { setShowStencilModal(false); setUploadedImage(null); }}>
          <div className="glass-panel-heavy" style={{ ...styles.modalContent, maxWidth: '750px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <h2 style={styles.modalTitle}>Image to Stencil Converter</h2>
              <button 
                className="glass-btn" 
                style={{ padding: '6px 10px', minWidth: 'auto', border: 'none', background: 'transparent' }} 
                onClick={() => { setShowStencilModal(false); setUploadedImage(null); }}
              >
                ✕
              </button>
            </div>
            
            <div style={{
              background: 'rgba(6, 182, 212, 0.05)',
              border: '1px solid rgba(6, 182, 212, 0.15)',
              padding: '12px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              color: 'rgba(255, 255, 255, 0.85)',
              lineHeight: '1.5',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <span style={{ fontWeight: 'bold', color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={14} /> Tip for Best Stencil Extraction:
              </span>
              <span>Please upload <strong>focused images</strong> with a single clear subject, sharp outlines, and high-contrast boundaries (like silhouettes or clean sketches). Avoid blurry or cluttered backgrounds.</span>
            </div>

            {!uploadedImage ? (
              <div 
                style={{
                  border: '2px dashed rgba(255, 255, 255, 0.15)',
                  borderRadius: '12px',
                  padding: '40px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'rgba(255, 255, 255, 0.02)',
                  transition: 'all 0.3s ease',
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file && file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (event) => setUploadedImage(event.target.result);
                    reader.readAsDataURL(file);
                  }
                }}
                onClick={() => document.getElementById('stencil-file-input').click()}
              >
                <input 
                  type="file" 
                  id="stencil-file-input" 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                  onChange={handleImageUpload} 
                />
                <ImageIcon size={48} style={{ color: 'rgba(255, 255, 255, 0.3)', marginBottom: '12px' }} />
                <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', color: 'rgba(255, 255, 255, 0.9)' }}>
                  Drag & drop your focus image here
                </h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255, 255, 255, 0.4)' }}>
                  or click to browse from files
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Image Previews */}
                <div style={{ 
                  display: 'flex', 
                  gap: '16px', 
                  flexWrap: 'wrap', 
                  justifyContent: 'center' 
                }}>
                  <div style={{ 
                    flex: '1 1 200px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    gap: '8px' 
                  }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'rgba(255,255,255,0.5)' }}>
                      Original Focus Image
                    </span>
                    <div style={{
                      width: '100%',
                      height: '220px',
                      borderRadius: '8px',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <img 
                        src={uploadedImage} 
                        alt="Original source" 
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                      />
                    </div>
                  </div>

                  <div style={{ 
                    flex: '1 1 200px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    gap: '8px' 
                  }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'rgba(255,255,255,0.5)' }}>
                      Live Stencil Preview ({extractedContours.length} Paths)
                    </span>
                    <div style={{
                      width: '100%',
                      height: '220px',
                      borderRadius: '8px',
                      background: stencilInvert ? '#090518' : '#ffffff',
                      border: '1px solid rgba(255,255,255,0.08)',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background-color 0.3s ease'
                    }}>
                      {stencilPreviewUrl ? (
                        <img 
                          src={stencilPreviewUrl} 
                          alt="Stencil preview" 
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                        />
                      ) : (
                        <div className="spinner"></div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sliders and Configuration */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '14px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  padding: '16px',
                  borderRadius: '10px'
                }}>
                  {/* Stencil 3D Mode Selector */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>
                      3D Model Extraction Mode
                    </span>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        type="button"
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid ' + (stencilMode3D === 'extrusion' ? '#06b6d4' : 'rgba(255,255,255,0.15)'),
                          background: stencilMode3D === 'extrusion' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                          color: stencilMode3D === 'extrusion' ? '#06b6d4' : 'rgba(255,255,255,0.7)',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        onClick={() => setStencilMode3D('extrusion')}
                      >
                        <span>3D Extruded Outline</span>
                        <span style={{ fontSize: '10px', fontWeight: 'normal', opacity: 0.7 }}>Best for outline stencils</span>
                      </button>
                      <button
                        type="button"
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid ' + (stencilMode3D === 'heightmap' ? '#06b6d4' : 'rgba(255,255,255,0.15)'),
                          background: stencilMode3D === 'heightmap' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                          color: stencilMode3D === 'heightmap' ? '#06b6d4' : 'rgba(255,255,255,0.7)',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        onClick={() => setStencilMode3D('heightmap')}
                      >
                        <span>3D Volumetric Mesh</span>
                        <span style={{ fontSize: '10px', fontWeight: 'normal', opacity: 0.7 }}>Best for photos & shading</span>
                      </button>
                    </div>
                  </div>

                  {/* Threshold Slider */}
                  <SmoothSlider 
                    label="Edge Detection Threshold (Sensitivity)"
                    min="10"
                    max="180"
                    step="1"
                    value={stencilThreshold}
                    onRelease={(val) => setStencilThreshold(val)}
                  />

                  {/* Scale Slider */}
                  <SmoothSlider 
                    label="Stencil Scale"
                    min="0.3"
                    max="2.0"
                    step="0.05"
                    value={stencilScale}
                    onRelease={(val) => setStencilScale(val)}
                    formatValue={(v) => `${Math.round(v * 100)}%`}
                  />

                  {/* Checkbox / Toggle Options */}
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginTop: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>
                      <input 
                        type="checkbox"
                        checked={stencilInvert}
                        onChange={(e) => setStencilInvert(e.target.checked)}
                        style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                      />
                      <span>Invert Preview Colors (White lines on Dark)</span>
                    </label>
                  </div>
                </div>

                {/* Action Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                  <button 
                    type="button" 
                    className="glass-btn glass-btn-danger" 
                    onClick={() => { setUploadedImage(null); setStencilPreviewUrl(''); }}
                  >
                    Change Image
                  </button>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                      type="button" 
                      className="glass-btn" 
                      onClick={() => { setShowStencilModal(false); setUploadedImage(null); }}
                    >
                      Cancel
                    </button>
                    <button 
                      type="button" 
                      className="glass-btn glass-btn-primary" 
                      onClick={handleApplyStencil}
                      disabled={!stencilPreviewUrl}
                    >
                      Convert & Apply Stencil
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
      <ThreeDModelViewerModal
        isOpen={show3DDownloadModal}
        onClose={() => setShow3DDownloadModal(false)}
        objects={downloaded3DModelData}
        onDownloadAgain={(mode) => {
          if (!downloaded3DModelData) return
          const objContent = generateOBJString(downloaded3DModelData, mode)
          const blob = new Blob([objContent], { type: 'text/plain' })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `miro_3d_model_${Date.now()}.obj`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
        }}
      />
      <GlassDialog
        isOpen={dialog.isOpen}
        type={dialog.type}
        title={dialog.title}
        message={dialog.message}
        confirmText={dialog.confirmText}
        cancelText={dialog.cancelText}
        onConfirm={dialog.onConfirm}
        onCancel={dialog.onCancel}
      />
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
    overflow: 'visible',
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
    aspectRatio: '12/7',
    borderRadius: '12px',
    overflow: 'hidden',
    background: 'rgba(0, 0, 0, 0.4)',
    border: '1px solid var(--glass-border)',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'fill',
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
    margin: 'auto',
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
  },
  segmentedControl: {
    display: 'flex',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '100px',
    padding: '3px',
    gap: '4px',
    marginRight: '8px',
  },
  segmentedBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'transparent',
    border: '1px solid transparent',
    color: 'var(--text-secondary)',
    padding: '6px 14px',
    borderRadius: '100px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  segmentedBtnActive: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    color: '#ffffff',
    padding: '6px 14px',
    borderRadius: '100px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)',
  }
}

