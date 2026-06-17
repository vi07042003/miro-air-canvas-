/* eslint-disable react-hooks/purity, react-hooks/immutability, react-hooks/exhaustive-deps, no-unused-vars, react-hooks/set-state-in-effect */
import { useRef, useState, useEffect } from 'react'
import { 
  Palette, Eraser, Circle as CircleIcon, Trash2, Undo, Redo, Download, Save, Camera, CameraOff, Video, Crosshair, Zap, Triangle,
  Pencil, ChevronDown, Box, Image as ImageIcon, Paintbrush, ChevronLeft, ChevronRight
} from 'lucide-react'
import { BACKEND_URL } from '../App'
import { 
  project3DPoint, unprojectPoint, drawViewportGrid, drawAxisHelper, 
  getMesh, drawMesh, draw3DStroke, generateOBJString 
} from '../utils/3dUtils'
import { drawShapePath } from '../utils/canvasUtils'
import ThreeDModelViewerModal from './ThreeDModelViewerModal'
import GlassDialog from './GlassDialog'

// Split components & constants
import SmoothSlider from './SmoothSlider'
import StencilConverterModal from './StencilConverterModal'
import SaveSketchModal from './SaveSketchModal'
import GestureHelpCard from './GestureHelpCard'
import { PRESET_COLORS, TOOL_GROUPS, styles } from './AirCanvas.constants'

// Lucide icon helper mapping
import { 
  Square, Slash, Star, Highlighter, Sparkles, ArrowUpRight, Move, CircleDot, Heart, Moon, Cloud, Plus, Hexagon
} from 'lucide-react'

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

export default function AirCanvas({ initialDrawing, onDrawingCleared, onDrawingSaved, initialStencil, onClearInitialStencil }) {
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
  const [show3DDownloadModal, setShow3DDownloadModal] = useState(false)
  const [downloaded3DModelData, setDownloaded3DModelData] = useState(null)

  // Drawer visibility states
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(true)
  const [rightDrawerOpen, setRightDrawerOpen] = useState(true)

  useEffect(() => {
    if (initialStencil) {
      setUploadedImage(initialStencil)
      setShowStencilModal(true)
      if (onClearInitialStencil) {
        onClearInitialStencil()
      }
    }
  }, [initialStencil, onClearInitialStencil])

  const handleApplyStencil = ({ previewUrl, contours, grayscale, width, height, scale, mode3D, targetCanvas }) => {
    if (!previewUrl) return

    const target = targetCanvas || '2d'

    if (target === '2d') {
      // Switch to 2D view mode
      handleModeSwitch('2d')

      // Apply to 2D Canvas
      const canvas = canvasRef.current
      if (canvas && contours.length > 0) {
        const ctx = canvas.getContext('2d')
        
        ctx.save()
        ctx.strokeStyle = color || '#06b6d4'
        ctx.lineWidth = Math.max(2, brushSize / 2)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.globalAlpha = brushOpacity
        
        const scale2D = scale * 1.5
        const offsetX = (canvas.width - width * scale2D) / 2
        const offsetY = (canvas.height - height * scale2D) / 2
        
        contours.forEach(path => {
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
    } else if (target === '3d') {
      // Switch to 3D view mode
      handleModeSwitch('3d')

      // Apply to 3D Canvas
      if (mode3D === 'heightmap' && grayscale) {
        const scale3D = (250 / Math.max(width, height)) * scale
        const depth3D = 60 * scale
        
        const gridW = 35
        const gridH = 35
        const stepX = width / (gridW - 1)
        const stepY = height / (gridH - 1)
        
        const pointsGrid = []
        
        for (let r = 0; r < gridH; r++) {
          const rowPoints = []
          for (let c = 0; c < gridW; c++) {
            const px = Math.min(width - 1, Math.round(c * stepX))
            const py = Math.min(height - 1, Math.round(r * stepY))
            const idx = py * width + px
            const val = grayscale[idx] || 0
            
            const z3d = (val / 255 - 0.5) * depth3D
            
            rowPoints.push({
              x: (px - width / 2) * scale3D,
              y: (py - height / 2) * scale3D,
              z: z3d
            })
          }
          pointsGrid.push(rowPoints)
        }
        
        const new3DStrokes = []
        for (let r = 0; r < gridH; r++) {
          new3DStrokes.push({
            type: 'stroke',
            points: pointsGrid[r],
            color: color || '#38bdf8',
            opacity: 0.4,
            size: 1.5
          })
        }
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
      } else if (contours.length > 0) {
        const scale3D = (250 / Math.max(width, height)) * scale
        const depth3D = 40 * scale
        
        const new3DStrokes = []

        contours.forEach(path => {
          const backPoints = path.map(pt => ({
            x: (pt.x - width / 2) * scale3D,
            y: (pt.y - height / 2) * scale3D,
            z: -depth3D / 2
          }))

          const frontPoints = path.map(pt => ({
            x: (pt.x - width / 2) * scale3D,
            y: (pt.y - height / 2) * scale3D,
            z: depth3D / 2
          }))

          new3DStrokes.push({
            type: 'stroke',
            points: backPoints,
            color: color || '#38bdf8',
            opacity: 0.8,
            size: 2
          })

          new3DStrokes.push({
            type: 'stroke',
            points: frontPoints,
            color: color || '#38bdf8',
            opacity: 0.8,
            size: 2
          })

          const step = Math.max(4, Math.floor(path.length / 12))
          for (let i = 0; i < path.length; i += step) {
            const pt = path[i]
            const x3d = (pt.x - width / 2) * scale3D
            const y3d = (pt.y - height / 2) * scale3D
            
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

          if (path.length > 0) {
            const pt = path[path.length - 1]
            const x3d = (pt.x - width / 2) * scale3D
            const y3d = (pt.y - height / 2) * scale3D
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
    }
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
  
  const [stabilizeEnabled, setStabilizeEnabled] = useState(true)

  // Undo/Redo Stacks
  const [undoStack, setUndoStack] = useState([])
  const [redoStack, setRedoStack] = useState([])

  // 3D Canvas Mode States & Refs
  const [canvasMode, setCanvasMode] = useState('2d') // '2d' or '3d'
  const [active3DTool, setActive3DToolState] = useState('orbit') // 'orbit', '3d-freehand', '3d-cube', '3d-sphere', etc.
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
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    
    const initialId = initialDrawing ? initialDrawing.id : null
    if (initialId !== loadedDrawingIdRef.current) {
      loadedDrawingIdRef.current = initialId
      
      ctx.fillStyle = '#0a0518'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      if (initialDrawing && initialDrawing.image_data) {
        const img = new Image()
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          saveCanvasState(false)
        }
        img.src = initialDrawing.image_data
      } else {
        saveCanvasState(true)
      }
    }

    startParticlesAnimationLoop()

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current)
      }
    }
  }, [initialDrawing])

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

  const handleModeSwitch = (newMode) => {
    if (newMode === canvasMode) return
    
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    
    if (newMode === '3d') {
      canvas2DDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
      setCanvasMode('3d')
    } else {
      setCanvasMode('2d')
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
      set3DTool('orbit')
    }
  }

  const handleWheel3D = (e) => {
    if (canvasMode !== '3d') return
    const zoomSpeed = 0.05
    camera3DRef.current.scale = Math.max(0.1, Math.min(5.0, camera3DRef.current.scale - e.deltaY * zoomSpeed * 0.01))
  }

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
    
    let drawX = x
    let drawY = y

    if (currentStabilizeEnabled) {
      if (currentTool === 'line') {
        const dx = x - drawState.startX
        const dy = y - drawState.startY
        const absDx = Math.abs(dx)
        const absDy = Math.abs(dy)
        
        if (absDx < absDy * 0.176) {
          drawX = drawState.startX
        } else if (absDy < absDx * 0.176) {
          drawY = drawState.startY
        }
      } else if (currentTool === 'rect') {
        const dx = x - drawState.startX
        const dy = y - drawState.startY
        const absDx = Math.abs(dx)
        const absDy = Math.abs(dy)
        
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

  const addParticles = (x, y, particleColor) => {
    if (particlesRef.current.length > 80) {
      particlesRef.current.shift()
    }
    
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

  const draw3DViewportOverlay = (ctx, rx, ry, scale, width) => {
    ctx.save()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.font = '11px monospace'
    
    ctx.fillText(`Viewport: Blender Perspective`, 20, 30)
    ctx.fillText(`Grid Spacing: 50m`, 20, 46)
    ctx.fillText(`Cam Orbit: rx=${rx.toFixed(2)} ry=${ry.toFixed(2)}`, 20, 62)
    ctx.fillText(`Zoom: ${scale.toFixed(2)}x`, 20, 78)
    
    ctx.fillText(`Objects: ${stamped3DObjectsRef.current.length}`, width - 110, 30)
    ctx.fillText(`Mode: 3D Gesture Viewport`, width - 200, 46)
    
    ctx.restore()
  }

  const draw3DCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    
    ctx.fillStyle = '#0a0518'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    const { rx, ry, scale } = camera3DRef.current
    
    drawViewportGrid(ctx, rx, ry, scale, canvas.width, canvas.height)
    drawAxisHelper(ctx, rx, ry)
    
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
    
    const activeStroke = active3DStrokeRef.current
    if (activeStroke && activeStroke.length > 0) {
      draw3DStroke(ctx, activeStroke, rx, ry, scale, 1.0, canvas.width, canvas.height, stateRef.current.color, stateRef.current.brushOpacity, stateRef.current.brushSize)
    }
    
    const tool3d = active3DToolRef.current
    if (['3d-cube', '3d-sphere', '3d-cylinder', '3d-pyramid', '3d-cone'].includes(tool3d)) {
      const shapeType = tool3d.replace('3d-', '')
      const previewPos = previewPos3DRef.current
      const previewSize = previewSize3DRef.current
      
      const mesh = getMesh(shapeType, previewSize)
      drawMesh(ctx, mesh, previewPos, null, rx, ry, scale, 1.0, canvas.width, canvas.height, stateRef.current.color, 0.8, 2)
      
      const proj = project3DPoint(previewPos.x, previewPos.y, previewPos.z, rx, ry, scale, canvas.width, canvas.height)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
      ctx.font = 'bold 11px monospace'
      ctx.fillText(`${shapeType.toUpperCase()} (Pinch to size, Fist to stamp)`, proj.x - 70, proj.y - 12)
    }
    
    draw3DViewportOverlay(ctx, rx, ry, scale, canvas.width)
  }

  const process3DTracking = (landmarks, x, y, isIndexUp, isMiddleUp, hCtx, canvas) => {
    const indexTip = landmarks[8]
    const thumbTip = landmarks[4]
    const drawState = drawingRef.current
    const tool3d = active3DToolRef.current
    
    const pinchDist = Math.sqrt(
      Math.pow(indexTip.x - thumbTip.x, 2) +
      Math.pow(indexTip.y - thumbTip.y, 2)
    )
    
    let currentMode = 'None'
    
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

    if (isIndexUp && isMiddleUp) {
      drawState.wasSizing3D = false
      
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
    } else if (isIndexUp && !isMiddleUp) {
      drawState.isOrbitingGest = false
      
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
      } else {
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
    } else {
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

  const trackFps = () => {
    const now = performance.now()
    const tracker = fpsTrackerRef.current
    tracker.frameCount++
    
    if (now >= tracker.lastTime + 1000) {
      tracker.currentFps = Math.round((tracker.frameCount * 1000) / (now - tracker.lastTime))
      tracker.frameCount = 0
      tracker.lastTime = now

      if (fpsTextRef.current) {
        fpsTextRef.current.innerText = `${tracker.currentFps} FPS`
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

  const updateAndDrawParticles = () => {
    const handCanvas = handCanvasRef.current
    if (!handCanvas) return
    const hCtx = handCanvas.getContext('2d')
    
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
      
      hCtx.save()
      hCtx.globalAlpha = p.alpha
      hCtx.beginPath()
      hCtx.arc(p.x, p.y, p.size, 0, 2 * Math.PI)
      
      hCtx.shadowColor = p.color
      hCtx.shadowBlur = 12
      hCtx.fillStyle = p.color
      hCtx.fill()
      hCtx.restore()
    }
  }

  const updateDOMGestureStatus = (mode) => {
    if (gestureIndicatorRef.current) {
      gestureIndicatorRef.current.innerText = mode
    }

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

  const processTrackingResults = (results) => {
    const canvas = canvasRef.current
    const handCanvas = handCanvasRef.current
    if (!canvas || !handCanvas) return

    const hCtx = handCanvas.getContext('2d')
    hCtx.clearRect(0, 0, handCanvas.width, handCanvas.height)

    hCtx.save()
    hCtx.globalCompositeOperation = 'screen'
    hCtx.drawImage(canvas, 0, 0)
    hCtx.restore()

    const { color: currentColor, tool: currentTool, stabilizeEnabled: currentStabilizeEnabled, settings: currentSettings } = stateRef.current
    const isMirrored = currentSettings.mirrorCamera === 'true'

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0]

      drawSkeleton(hCtx, landmarks)

      const indexTip = landmarks[8]
      const indexPip = landmarks[6]
      const middleTip = landmarks[12]
      const middlePip = landmarks[10]

      let rawX = isMirrored ? (1 - indexTip.x) : indexTip.x
      let rawY = indexTip.y

      rawX = rawX * canvas.width
      rawY = rawY * canvas.height

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

      if (coordsTextRef.current) {
        coordsTextRef.current.innerText = `(${Math.round(x)}, ${Math.round(y)})`
      }

      addParticles(x, y, currentColor)

      if (stateRef.current.canvasMode === '3d') {
        const isIndexUp = indexTip.y < indexPip.y
        const isMiddleUp = middleTip.y < middlePip.y
        process3DTracking(landmarks, x, y, isIndexUp, isMiddleUp, hCtx, canvas)
        return
      }

      let currentMode = 'None'

      if (currentTool === 'eraser') {
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
            
            const mainCtx = canvas.getContext('2d')
            mainCtx.fillStyle = '#0a0518'
            mainCtx.fillRect(0, 0, canvas.width, canvas.height)
            saveCanvasState(true)
            
            currentMode = 'Canvas Cleared'
            
            hCtx.fillStyle = 'rgba(239, 68, 68, 0.3)'
            hCtx.fillRect(0, 0, handCanvas.width, handCanvas.height)
            
            hCtx.fillStyle = '#ffffff'
            hCtx.font = 'bold 20px sans-serif'
            hCtx.fillText("👋 Wave Detected - Canvas Cleared!", handCanvas.width / 2 - 170, handCanvas.height / 2)
          }
        }
      } else {
        drawState.waveHistory = []
      }

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
            hCtx.strokeStyle = currentColor
            hCtx.lineWidth = 3
            hCtx.globalAlpha = 0.8
            hCtx.beginPath()
            const previewRadius = drawState.sizingRadius
            
            drawShapePath(hCtx, currentTool, x - previewRadius, y - previewRadius, x + previewRadius, y + previewRadius)
            hCtx.stroke()
            
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

  const drawSkeleton = (ctx, landmarks) => {
    const { color: currentColor, settings: currentSettings } = stateRef.current
    ctx.fillStyle = currentColor
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
      console.error(err)
      setDbMessage('Server connection error')
    } finally {
      setSaving(false)
    }
  }

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
          <button 
            className={`glass-btn ${leftDrawerOpen ? 'glass-btn-active' : ''}`}
            onClick={() => setLeftDrawerOpen(!leftDrawerOpen)}
            title={leftDrawerOpen ? "Collapse Tools" : "Expand Tools"}
            style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', height: '38px', borderRadius: '10px', marginRight: '8px' }}
          >
            <Paintbrush size={16} />
          </button>

          <div style={styles.gestureIndicator}>
            <div ref={gestureIndicatorDotRef} style={styles.gestureIndicatorDot}></div>
            <span>Gesture: <strong ref={gestureIndicatorRef}>None</strong></span>
          </div>
          <span ref={coordsTextRef} style={styles.coordsText}>(0, 0)</span>
          
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
          <button 
            className={`glass-btn ${rightDrawerOpen ? 'glass-btn-active' : ''}`}
            onClick={() => setRightDrawerOpen(!rightDrawerOpen)}
            title={rightDrawerOpen ? "Collapse Camera & Guide" : "Expand Camera & Guide"}
            style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', height: '38px', borderRadius: '10px' }}
          >
            <Video size={16} />
          </button>
        </div>
      </div>

      <div className="aircanvas-workspace">
        {/* Left Drawer (Tools & Brush Settings) */}
        <div className={`glass-panel drawer-panel drawer-left ${leftDrawerOpen ? 'open' : 'collapsed'}`}>
          <div className="drawer-content" style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
            <div style={styles.drawerSectionHeader}>
              <Paintbrush size={16} color="var(--theme-color-2)" />
              <span style={styles.drawerTitle}>Drawing Tools</span>
            </div>

            <div className="active-tool-banner">
              <span>Active Tool:</span>
              <strong>{canvasMode === '3d' ? active3DTool.replace('3d-', '') : getActiveToolName(tool)}</strong>
            </div>

            {canvasMode === '3d' ? (
              <div style={styles.drawerGroup}>
                <span style={styles.drawerSubTitle}>3D Geometry</span>
                <div className="tool-grid-3d">
                  <button 
                    className={`glass-btn tool-grid-item ${active3DTool === 'orbit' ? 'glass-btn-active' : ''}`}
                    onClick={() => set3DTool('orbit')}
                    title="Orbit View: Drag mouse or raise index & middle fingers to rotate, scroll wheel or pinch to zoom"
                  >
                    <Crosshair size={14} />
                    <span>Orbit</span>
                  </button>
                  <button 
                    className={`glass-btn tool-grid-item ${active3DTool === '3d-freehand' ? 'glass-btn-active' : ''}`}
                    onClick={() => set3DTool('3d-freehand')}
                    title="3D Freehand Sketch: Drag mouse or raise index finger to sketch in 3D"
                  >
                    <Pencil size={14} />
                    <span>3D Sketch</span>
                  </button>
                  <button 
                    className={`glass-btn tool-grid-item ${active3DTool === '3d-cube' ? 'glass-btn-active' : ''}`}
                    onClick={() => set3DTool('3d-cube')}
                    title="Cube Primitive: Drag to resize, raise index & thumb to resize, fist to stamp"
                  >
                    <Box size={14} />
                    <span>Cube</span>
                  </button>
                  <button 
                    className={`glass-btn tool-grid-item ${active3DTool === '3d-sphere' ? 'glass-btn-active' : ''}`}
                    onClick={() => set3DTool('3d-sphere')}
                    title="Sphere Primitive: Drag to resize, raise index & thumb to resize, fist to stamp"
                  >
                    <CircleIcon size={14} />
                    <span>Sphere</span>
                  </button>
                  <button 
                    className={`glass-btn tool-grid-item ${active3DTool === '3d-cylinder' ? 'glass-btn-active' : ''}`}
                    onClick={() => set3DTool('3d-cylinder')}
                    title="Cylinder Primitive: Drag to resize, raise index & thumb to resize, fist to stamp"
                  >
                    <Box size={14} />
                    <span>Cylinder</span>
                  </button>
                  <button 
                    className={`glass-btn tool-grid-item ${active3DTool === '3d-pyramid' ? 'glass-btn-active' : ''}`}
                    onClick={() => set3DTool('3d-pyramid')}
                    title="Pyramid Primitive: Drag to resize, raise index & thumb to resize, fist to stamp"
                  >
                    <Triangle size={14} />
                    <span>Pyramid</span>
                  </button>
                  <button 
                    className={`glass-btn tool-grid-item ${active3DTool === '3d-cone' ? 'glass-btn-active' : ''}`}
                    onClick={() => set3DTool('3d-cone')}
                    title="Cone Primitive: Drag to resize, raise index & thumb to resize, fist to stamp"
                  >
                    <Triangle size={14} />
                    <span>Cone</span>
                  </button>
                </div>
              </div>
            ) : (
              TOOL_GROUPS.map(group => (
                <div key={group.name} style={styles.drawerGroup}>
                  <span style={styles.drawerSubTitle}>{group.name}</span>
                  <div className="tool-grid">
                    {group.tools.map(t => {
                      const isActive = tool === t.id;
                      return (
                        <button
                          key={t.id}
                          className={`glass-btn tool-grid-item ${isActive ? 'glass-btn-active' : ''}`}
                          onClick={() => setTool(t.id)}
                          title={t.name}
                        >
                          <RenderIcon iconName={t.icon} size={14} />
                          <span>{t.name.replace('Straight ', '').replace('Single ', '').replace('Double ', '').replace('5-Point ', '').replace('6-Point ', '').replace('8-Point ', '').replace('Plus ', '').replace('Crescent ', '')}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}

            {/* Color Palette */}
            <div style={styles.drawerGroup}>
              <span style={styles.drawerSubTitle}>Color Palette</span>
              <div style={styles.colorPaletteGrid}>
                {PRESET_COLORS.map(c => (
                  <button 
                    key={c}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: c,
                      border: color === c ? '2px solid #fff' : '1px solid rgba(255, 255, 255, 0.2)',
                      boxShadow: color === c ? `0 0 8px ${c}` : 'none',
                      cursor: 'pointer',
                      padding: 0
                    }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Custom Color:</span>
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

            {/* Brush Settings */}
            <div style={styles.drawerGroup}>
              <span style={styles.drawerSubTitle}>Brush Settings</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <SmoothSlider 
                  label="Size"
                  min="1"
                  max={canvasMode === '3d' ? "30" : "100"}
                  value={brushSize}
                  onChange={(val) => { stateRef.current.brushSize = val; }}
                  onRelease={(val) => setBrushSize(val)}
                  formatValue={(v) => `${v}px`}
                />

                {canvasMode !== '3d' && (
                  <SmoothSlider 
                    label="Opacity"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={brushOpacity}
                    onChange={(val) => { stateRef.current.brushOpacity = val; }}
                    onRelease={(val) => setBrushOpacity(val)}
                    formatValue={(v) => `${Math.round(v * 100)}%`}
                  />
                )}

                <button 
                  className={`glass-btn ${stabilizeEnabled ? 'glass-btn-active' : ''}`}
                  style={{ padding: '8px 12px', fontSize: '13px', width: '100%', justifyContent: 'center' }}
                  onClick={() => setStabilizeEnabled(!stabilizeEnabled)}
                  title="Enhance drawing stability and snap lines/rectangles to perfect orientations"
                >
                  <Crosshair size={14} style={{ marginRight: '6px' }} />
                  <span>{stabilizeEnabled ? 'Stabilizer ON' : 'Stabilizer OFF'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Left Drawer Toggle Button handle */}
        <button 
          className={`drawer-toggle-handle toggle-left ${leftDrawerOpen ? 'open' : 'collapsed'}`}
          onClick={() => setLeftDrawerOpen(!leftDrawerOpen)}
          title={leftDrawerOpen ? "Collapse Tools" : "Expand Tools"}
        >
          {leftDrawerOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* Center Canvas Column */}
        <div className="canvas-main-column">
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

        {/* Floating Right Drawer Toggle Button handle */}
        <button 
          className={`drawer-toggle-handle toggle-right ${rightDrawerOpen ? 'open' : 'collapsed'}`}
          onClick={() => setRightDrawerOpen(!rightDrawerOpen)}
          title={rightDrawerOpen ? "Collapse Camera & Guide" : "Expand Camera & Guide"}
        >
          {rightDrawerOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Right Column (Drawer Shell for Camera & Help) */}
        <div className={`drawer-right-column ${rightDrawerOpen ? 'open' : 'collapsed'}`}>
          {/* Camera Feed Card */}
          <div className={`glass-panel camera-feed-card ${rightDrawerOpen ? 'in-drawer' : 'in-pip'}`}>
            <div style={styles.videoHeader} className="video-header-pip">
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
              <canvas 
                ref={handCanvasRef}
                width="1200"
                height="700"
                style={styles.handOverlayCanvas}
              />
            </div>

            <button 
              className={`glass-btn cam-toggle-btn-pip ${isCameraOn ? 'glass-btn-danger' : 'glass-btn-primary'}`}
              style={styles.camToggleBtn}
              onClick={() => setIsCameraOn(!isCameraOn)}
            >
              <Camera size={16} />
              <span>{isCameraOn ? 'Stop Camera Tracking' : 'Enable Gesture Canvas'}</span>
            </button>
          </div>
          
          {/* Help Drawer Panel */}
          {rightDrawerOpen && (
            <div className="glass-panel help-drawer-panel">
              <div className="drawer-content" style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
                <div style={styles.drawerSectionHeader}>
                  <Video size={16} color="var(--theme-color-2)" />
                  <span style={styles.drawerTitle}>User Guide</span>
                </div>
                <GestureHelpCard canvasMode={canvasMode} styles={styles} />
              </div>
            </div>
          )}
        </div>
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
        styles={styles}
      />

      {/* Stencil Converter Modal */}
      <StencilConverterModal 
        isOpen={showStencilModal}
        onClose={() => { setShowStencilModal(false); setUploadedImage(null); }}
        onApply={handleApplyStencil}
        initialImage={uploadedImage}
        styles={styles}
      />

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
