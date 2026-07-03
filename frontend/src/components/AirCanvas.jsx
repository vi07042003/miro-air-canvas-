import { useRef, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Palette, Eraser, Circle as CircleIcon, Trash2, Undo, Redo, Download, Save, Camera, CameraOff, Video, Crosshair, Zap, Triangle,
  Pencil, ChevronDown, Box, Image as ImageIcon, Paintbrush, ChevronLeft, ChevronRight, Type
} from 'lucide-react'
import { BACKEND_URL } from '../App'
import { useToast } from './Toast'
import { 
  project3DPoint, unprojectPoint, drawViewportGrid, drawAxisHelper, 
  getMesh, drawMesh, draw3DStroke, generateOBJString 
} from '../utils/3dUtils'
import { drawShapePath } from '../utils/canvasUtils'
import { detectAndFitShape } from '../utils/shapeSnapper'
import ThreeDModelViewerModal from './ThreeDModelViewerModal'
import GlassDialog from './GlassDialog'

// Split components & constants
import SmoothSlider from './SmoothSlider'
import StencilConverterModal from './StencilConverterModal'
import { processImageToStencil } from '../utils/stencilUtils'
import AISketchModal from './AISketchModal'
import SaveSketchModal from './SaveSketchModal'
import GestureHelpCard from './GestureHelpCard'
import { PRESET_COLORS, TOOL_GROUPS, styles } from './AirCanvas.constants'

// Lucide icon helper mapping
import { 
  Square, Slash, Star, Highlighter, Sparkles, ArrowUpRight, Move, CircleDot, Heart, Moon, Cloud, Plus, Hexagon,
  Diamond, Pentagon, Octagon, Ellipse, Cylinder, Pyramid, Pill
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
  Hexagon,
  Diamond,
  Pentagon,
  Octagon,
  Ellipse,
  Cylinder,
  Pyramid,
  Pill,
  Type
}

const RenderIcon = ({ iconName, size = 18 }) => {
  const IconComp = ICON_MAP[iconName] || Palette
  return <IconComp size={size} />
}

const fitContoursToCanvas = (contours, canvasWidth, canvasHeight) => {
  if (!contours || contours.length === 0) return { contours, w: canvasWidth, h: canvasHeight };

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  contours.forEach(path => {
    path.forEach(pt => {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    });
  });

  const bboxW = maxX - minX;
  const bboxH = maxY - minY;

  if (bboxW <= 0 || bboxH <= 0) return { contours, w: canvasWidth, h: canvasHeight };

  // Add a nice 8% margin around the canvas boundary for breathing room
  const paddingX = canvasWidth * 0.08;
  const paddingY = canvasHeight * 0.08;
  const targetW = canvasWidth - paddingX * 2;
  const targetH = canvasHeight - paddingY * 2;

  // Scale factor to fill the canvas
  const scale = Math.min(targetW / bboxW, targetH / bboxH);

  // Offset to center the bounding box
  const offsetX = (canvasWidth - bboxW * scale) / 2;
  const offsetY = (canvasHeight - bboxH * scale) / 2;

  const fittedContours = contours.map(path => 
    path.map(pt => ({
      x: (pt.x - minX) * scale + offsetX,
      y: (pt.y - minY) * scale + offsetY
    }))
  );

  return {
    contours: fittedContours,
    w: canvasWidth,
    h: canvasHeight
  };
};

const smoothContour = (path) => {
  if (path.length < 3) return path;

  // 1. Remove consecutive duplicate points
  const clean = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const prev = clean[clean.length - 1];
    const curr = path[i];
    if (prev.x !== curr.x || prev.y !== curr.y) {
      clean.push(curr);
    }
  }

  if (clean.length < 5) return clean;

  // 2. Apply a 5-point moving average smoothing window to eliminate staircase jaggedness
  const result = [clean[0], clean[1]];
  for (let i = 2; i < clean.length - 2; i++) {
    const sumX = clean[i-2].x + clean[i-1].x + clean[i].x + clean[i+1].x + clean[i+2].x;
    const sumY = clean[i-2].y + clean[i-1].y + clean[i].y + clean[i+1].y + clean[i+2].y;
    result.push({ x: sumX / 5, y: sumY / 5 });
  }
  result.push(clean[clean.length - 2], clean[clean.length - 1]);
  return result;
};

const drawPartialContours = (ctx, contours, progress, color, size, opacity, width, height, scale, canvasWidth, canvasHeight, activeTool = 'brush') => {
  ctx.save()
  ctx.strokeStyle = color || '#06b6d4'
  ctx.lineWidth = Math.max(2, size / 2)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.globalAlpha = opacity
  
  // Adapt to active 2D paint tools
  if (activeTool === 'pencil') {
    ctx.lineWidth = 2
    ctx.globalAlpha = 1.0
  } else if (activeTool === 'highlighter') {
    ctx.globalAlpha = 0.35
    ctx.lineWidth = Math.max(12, size * 2.5)
    ctx.lineCap = 'square'
    ctx.lineJoin = 'miter'
  } else if (activeTool === 'spray') {
    ctx.lineWidth = Math.max(3, size)
    ctx.setLineDash([2, 5])
  } else if (activeTool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.lineWidth = Math.max(15, size * 2)
  }
  
  const totalPoints = contours.reduce((sum, p) => sum + p.length, 0)
  const targetPoints = Math.floor(progress * totalPoints)
  
  let pointsProcessed = 0
  
  for (let c = 0; c < contours.length; c++) {
    const path = contours[c]
    if (path.length < 2) continue
    
    const remaining = targetPoints - pointsProcessed
    if (remaining <= 0) break
    
    const pointsToDraw = Math.min(path.length, remaining)
    if (pointsToDraw < 2) continue
    
    ctx.beginPath()
    ctx.moveTo(path[0].x, path[0].y)
    for (let i = 1; i < pointsToDraw; i++) {
      ctx.lineTo(path[i].x, path[i].y)
    }
    ctx.stroke()
    
    pointsProcessed += pointsToDraw
  }
  ctx.restore()
}

const generate3DStrokesFromContours = (contours, width, height, scale, color, brushSizeVal = 8, activeTool = 'orbit') => {
  const scale3D = (250 / Math.max(width, height)) * scale
  const depth3D = 40 * scale
  const new3DStrokes = []
  
  // If the drawing is detailed/complex (multiple contours), draw a single clean layer at z=0 
  // to avoid a dense, cluttered double-outline cage with hundreds of vertical struts.
  const isComplex = contours.length > 8;

  // Adapt stroke size and opacity to active tool
  let strokeSize = 2;
  let strokeOpacity = 0.9;
  
  if (activeTool === 'pencil') {
    strokeSize = 1.2;
    strokeOpacity = 1.0;
  } else if (activeTool === 'highlighter') {
    strokeSize = Math.max(5, brushSizeVal / 1.5);
    strokeOpacity = 0.4;
  } else {
    strokeSize = Math.max(1.5, brushSizeVal / 3.5);
  }

  contours.forEach(path => {
    if (path.length < 2) return;

    if (isComplex) {
      const points = path.map(pt => ({
        x: (pt.x - width / 2) * scale3D,
        y: (pt.y - height / 2) * scale3D,
        z: 0
      }))
      new3DStrokes.push({
        type: 'stroke',
        points: points,
        color: color || '#38bdf8',
        opacity: strokeOpacity,
        size: strokeSize
      })
    } else {
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
        opacity: strokeOpacity,
        size: strokeSize
      })

      new3DStrokes.push({
        type: 'stroke',
        points: frontPoints,
        color: color || '#38bdf8',
        opacity: strokeOpacity,
        size: strokeSize
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
          opacity: strokeOpacity * 0.6,
          size: strokeSize * 0.75
        })
      }
    }
  })
  return new3DStrokes
}

const getPartial3DStrokes = (strokes, progress) => {
  const totalPoints = strokes.reduce((sum, s) => sum + s.points.length, 0)
  const targetPoints = Math.floor(progress * totalPoints)
  
  let pointsProcessed = 0
  const result = []
  
  for (let i = 0; i < strokes.length; i++) {
    const stroke = strokes[i]
    const remaining = targetPoints - pointsProcessed
    if (remaining <= 0) break
    
    const pointsToDraw = Math.min(stroke.points.length, remaining)
    if (pointsToDraw < 2) continue
    
    result.push({
      ...stroke,
      points: stroke.points.slice(0, pointsToDraw)
    })
    pointsProcessed += pointsToDraw
  }
  return result
}

const PRIMITIVE_3D_TOOLS = ['3d-cube', '3d-sphere', '3d-cylinder', '3d-pyramid', '3d-cone', '3d-prism', '3d-torus', '3d-octahedron', '3d-capsule']

export default function AirCanvas({ initialDrawing, onDrawingCleared, onDrawingSaved, initialStencil, onClearInitialStencil, isActivePage }) {
  const { showToast } = useToast()
  const canvasRef = useRef(null)
  const videoRef = useRef(null)
  const handCanvasRef = useRef(null)
  const loadedDrawingIdRef = useRef(null)
  
  const safePutImageData = (ctx, imgData) => {
    if (!ctx || !imgData) return
    const canvas = ctx.canvas
    if (imgData.width === canvas.width && imgData.height === canvas.height) {
      ctx.putImageData(imgData, 0, 0)
    } else {
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = imgData.width
      tempCanvas.height = imgData.height
      tempCanvas.getContext('2d').putImageData(imgData, 0, 0)
      
      ctx.save()
      ctx.globalAlpha = 1.0
      ctx.fillStyle = '#0a0518'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      const scale = Math.min(canvas.width / imgData.width, canvas.height / imgData.height)
      const dw = imgData.width * scale
      const dh = imgData.height * scale
      const dx = (canvas.width - dw) / 2
      const dy = (canvas.height - dh) / 2
      
      ctx.drawImage(tempCanvas, dx, dy, dw, dh)
      ctx.restore()
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const container = canvas.closest('.glass-panel')
    if (!container) return

    // Holds the original-size snapshot taken at the START of a resize sequence
    let snapshotCanvas = null
    let debounceTimer = null

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect
        if (width === 0 || height === 0) continue

        const roundedWidth = Math.round(width)
        const roundedHeight = Math.round(height)

        if (canvas.width === roundedWidth && canvas.height === roundedHeight) continue

        // --- First tick of a new resize sequence: capture the snapshot ---
        if (!snapshotCanvas) {
          snapshotCanvas = document.createElement('canvas')
          snapshotCanvas.width = canvas.width
          snapshotCanvas.height = canvas.height
          const snapCtx = snapshotCanvas.getContext('2d')
          snapCtx.drawImage(canvas, 0, 0)
        }

        // Resize the canvas resolution immediately so CSS layout is satisfied,
        // but just fill with background — we'll paint the real content after debounce.
        const ctx = canvas.getContext('2d')
        canvas.width = roundedWidth
        canvas.height = roundedHeight
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.fillStyle = '#0a0518'
        ctx.fillRect(0, 0, roundedWidth, roundedHeight)

        // Mirror resolution to hand overlay canvas
        const handCanvas = handCanvasRef.current
        if (handCanvas) {
          handCanvas.width = roundedWidth
          handCanvas.height = roundedHeight
        }

        // Debounce: wait for the animation to finish, then do one clean redraw
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          if (!snapshotCanvas) return

          const finalWidth = canvas.width
          const finalHeight = canvas.height
          const finalCtx = canvas.getContext('2d')

          // Fill background
          finalCtx.fillStyle = '#0a0518'
          finalCtx.fillRect(0, 0, finalWidth, finalHeight)
          finalCtx.drawImage(snapshotCanvas, 0, 0, finalWidth, finalHeight)

          // Reset for the next resize sequence
          snapshotCanvas = null
        }, 450) // slightly longer than the 0.4s CSS transition
      }
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      clearTimeout(debounceTimer)
    }
  }, [])
  
  // DOM element references for 60 FPS direct updates (no React re-renders)
  const coordsTextRef = useRef(null)
  const gestureIndicatorRef = useRef(null)
  const gestureIndicatorDotRef = useRef(null)
  const fpsTextRef = useRef(null)

  // States (Only state variables that trigger UI actions)
  const [tool, setTool] = useState('pencil') // brush, line, rect, circle, eraser
  const [color, setColor] = useState('#06b6d4')
  const [brushSize, setBrushSize] = useState(1)
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

  // AI Sketcher States & Refs
  const [showAISketchModal, setShowAISketchModal] = useState(false)
  const [showAiSketchLoader, setShowAiSketchLoader] = useState(false)
  const aiSketchingRef = useRef(null)
  const aiSketchingProgressRef = useRef(0)
  const preSketchImageDataRef = useRef(null)
  const preSketch3DObjectsRef = useRef(null)

  const [textInput, setTextInputState] = useState(null) // { cssX, cssY, canvasX, canvasY, value }
  const textInputRef = useRef(null)
  const setTextInput = (val) => {
    textInputRef.current = val
    setTextInputState(val)
  }

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
        // Filter out short noise/speckles and apply smoothing
        const cleanContours = contours
          .filter(c => c.length >= 4)
          .map(smoothContour)
          .filter(c => c.length >= 2)

        if (cleanContours.length === 0) return

        // Calculate bounding box of the clean contours to fit exactly to the canvas area
        let minX = Infinity, maxX = -Infinity
        let minY = Infinity, maxY = -Infinity
        cleanContours.forEach(path => {
          path.forEach(pt => {
            if (pt.x < minX) minX = pt.x
            if (pt.x > maxX) maxX = pt.x
            if (pt.y < minY) minY = pt.y
            if (pt.y > maxY) maxY = pt.y
          })
        })

        const bboxW = maxX - minX
        const bboxH = maxY - minY

        const ctx = canvas.getContext('2d')
        ctx.save()
        ctx.strokeStyle = color || '#06b6d4'
        ctx.lineWidth = Math.max(2, brushSize / 2)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.globalAlpha = brushOpacity

        if (bboxW > 0 && bboxH > 0) {
          // Fit stencil to 75% of the canvas area
          const targetW = canvas.width * 0.75
          const targetH = canvas.height * 0.75
          const fitScale = Math.min(targetW / bboxW, targetH / bboxH)
          const finalScale = scale * fitScale

          // Offset to center the bounding box on the canvas
          const offsetX = (canvas.width - bboxW * finalScale) / 2
          const offsetY = (canvas.height - bboxH * finalScale) / 2

          cleanContours.forEach(path => {
            if (path.length < 2) return
            ctx.beginPath()
            ctx.moveTo((path[0].x - minX) * finalScale + offsetX, (path[0].y - minY) * finalScale + offsetY)
            for (let i = 1; i < path.length; i++) {
              ctx.lineTo((path[i].x - minX) * finalScale + offsetX, (path[i].y - minY) * finalScale + offsetY)
            }
            ctx.stroke()
          })
        } else {
          // Fallback to original image scaling if bounding box is invalid
          const scale2D = scale * 1.5
          const offsetX = (canvas.width - width * scale2D) / 2
          const offsetY = (canvas.height - height * scale2D) / 2

          cleanContours.forEach(path => {
            if (path.length < 2) return
            ctx.beginPath()
            ctx.moveTo(offsetX + path[0].x * scale2D, offsetY + path[0].y * scale2D)
            for (let i = 1; i < path.length; i++) {
              ctx.lineTo(offsetX + path[i].x * scale2D, offsetY + path[i].y * scale2D)
            }
            ctx.stroke()
          })
        }
        
        ctx.restore()
        saveCanvasState()
      }
    } else if (target === '3d') {
      // Switch to 3D view mode
      handleModeSwitch('3d')

      // Apply to 3D Canvas
      if (mode3D === 'heightmap' && grayscale) {
        const scale3D = (500 / Math.max(width, height)) * scale
        const depth3D = 100 * scale
        
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
        const cleanContours = contours
          .filter(c => c.length >= 4)
          .map(smoothContour)
          .filter(c => c.length >= 2)

        if (cleanContours.length === 0) return

        const scale3D = (500 / Math.max(width, height)) * scale
        const depth3D = 80 * scale
        
        const new3DStrokes = []

        cleanContours.forEach(path => {
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
    showToast("Stencil applied to canvas successfully!", "success")
  }

  const handleApplyAISketch = ({ imageUrl, targetCanvas, prompt }) => {
    if (!imageUrl) return

    const img = new Image()
    img.src = imageUrl
    img.onload = () => {
      const { contours, w, h } = processImageToStencil(img, 55, false, true)
      if (!contours || contours.length === 0) {
        alert("The AI generated a blank sketch or could not detect clear outlines. Please try again with a different prompt.")
        return
      }

      // Filter out small speckles/noise contours (< 4 points) and apply path smoothing
      const cleanContours = contours
        .filter(c => c.length >= 4)
        .map(smoothContour)
        .filter(c => c.length >= 2);

      if (cleanContours.length === 0) {
        alert("The AI generated a blank sketch or could not detect clear outlines. Please try again with a different prompt.")
        return
      }

      // Dynamically fit contours to the full dimensions of the active canvas to make the sketch large and clear
      const canvas = canvasRef.current;
      const canvasW = canvas ? canvas.width : w;
      const canvasH = canvas ? canvas.height : h;
      const { contours: fittedContours, w: fittedW, h: fittedH } = fitContoursToCanvas(cleanContours, canvasW, canvasH);

      if (targetCanvas !== canvasMode) {
        handleModeSwitch(targetCanvas)
      }

      startAISketching(fittedContours, fittedW, fittedH, targetCanvas, prompt)
    }
  }

  const startAISketching = (contours, w, h, targetCanvas, promptStr) => {
    cancelAISketching()

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    aiSketchingProgressRef.current = 0

    if (targetCanvas === '2d') {
      preSketchImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
    } else {
      preSketch3DObjectsRef.current = [...stamped3DObjectsRef.current]
    }

    // Dynamic duration based on complexity (total point count)
    // 12ms per point. Min 15 seconds, max 1.5 minutes (90s).
    const totalPoints = contours.reduce((sum, p) => sum + p.length, 0)
    const dynamicDuration = Math.min(90000, Math.max(15000, totalPoints * 12))

    aiSketchingRef.current = {
      startTime: performance.now(),
      duration: dynamicDuration,
      prompt: promptStr,
      targetCanvas: targetCanvas,
      contours: contours,
      strokes: targetCanvas === '3d' ? generate3DStrokesFromContours(contours, w, h, 1.0, color, brushSize, active3DToolRef.current) : null,
      w: w,
      h: h,
      scale: 1.0,
      color: color,
      tool: targetCanvas === '2d' ? tool : active3DToolRef.current
    }

    setShowAiSketchLoader(true)
  }

  const cancelAISketching = () => {
    if (!aiSketchingRef.current) return

    const targetCanvas = aiSketchingRef.current.targetCanvas
    if (targetCanvas === '2d' && preSketchImageDataRef.current) {
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        safePutImageData(ctx, preSketchImageDataRef.current)
      }
    }
    
    aiSketchingRef.current = null
    aiSketchingProgressRef.current = 0
    preSketchImageDataRef.current = null
    preSketch3DObjectsRef.current = null

    setShowAiSketchLoader(false)
  }

  const completeAISketching = () => {
    if (!aiSketchingRef.current) return

    const targetCanvas = aiSketchingRef.current.targetCanvas
    const { contours, w, h, color: sketchColor, strokes } = aiSketchingRef.current

    if (targetCanvas === '2d') {
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (preSketchImageDataRef.current) {
          safePutImageData(ctx, preSketchImageDataRef.current)
        }
        drawPartialContours(ctx, contours, 1.0, sketchColor, brushSize, brushOpacity, w, h, 1.0, canvas.width, canvas.height, aiSketchingRef.current.tool)
        saveCanvasState()
      }
    } else {
      if (strokes) {
        stamped3DObjectsRef.current = [
          ...stamped3DObjectsRef.current,
          ...strokes
        ]
        save3DState()
      }
    }

    aiSketchingRef.current = null
    aiSketchingProgressRef.current = 0
    preSketchImageDataRef.current = null
    preSketch3DObjectsRef.current = null

    setShowAiSketchLoader(false)
  }

  useEffect(() => {
    if (!showAiSketchLoader) return

    let animId
    const loop = () => {
      if (!aiSketchingRef.current) return

      const now = performance.now()
      const elapsed = now - aiSketchingRef.current.startTime
      const duration = aiSketchingRef.current.duration
      const progress = Math.min(1.0, elapsed / duration)
      aiSketchingProgressRef.current = progress

      const progressBar = document.getElementById('ai-sketch-progress-bar')
      const timeText = document.getElementById('ai-sketch-time-text')
      const percentText = document.getElementById('ai-sketch-percent-text')
      const statusText = document.getElementById('ai-sketch-status-text')

      if (progressBar) {
        progressBar.style.width = `${progress * 100}%`
      }
      if (percentText) {
        percentText.innerText = `${Math.round(progress * 100)}%`
      }
      if (timeText) {
        const elapsedSec = Math.floor(elapsed / 1000)
        const totalSec = Math.floor(duration / 1000)
        const elapsedMinStr = `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`
        const totalMinStr = `${Math.floor(totalSec / 60)}m ${totalSec % 60}s`
        timeText.innerText = `${elapsedMinStr} / ${totalMinStr}`
      }
      if (statusText) {
        if (progress < 0.20) {
          statusText.innerText = 'Analyzing prompt & outlines...'
        } else if (progress < 0.55) {
          statusText.innerText = 'Sketching main outlines...'
        } else if (progress < 0.85) {
          statusText.innerText = 'Drawing fine details...'
        } else {
          statusText.innerText = 'Finalizing and polishing...'
        }
      }

      if (aiSketchingRef.current.targetCanvas === '2d') {
        const canvas = canvasRef.current
        if (canvas && preSketchImageDataRef.current) {
          const ctx = canvas.getContext('2d')
          safePutImageData(ctx, preSketchImageDataRef.current)
          drawPartialContours(
            ctx,
            aiSketchingRef.current.contours,
            progress,
            aiSketchingRef.current.color,
            brushSize,
            brushOpacity,
            aiSketchingRef.current.w,
            aiSketchingRef.current.h,
            aiSketchingRef.current.scale,
            canvas.width,
            canvas.height,
            aiSketchingRef.current.tool
          )
        }
      }

      if (progress >= 1.0) {
        completeAISketching()
      } else {
        animId = requestAnimationFrame(loop)
      }
    }

    animId = requestAnimationFrame(loop)

    const cancelBtn = document.getElementById('ai-sketch-cancel-btn')
    if (cancelBtn) {
      cancelBtn.onclick = cancelAISketching
    }

    return () => {
      cancelAnimationFrame(animId)
    }
  }, [showAiSketchLoader])

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
  const [autoCorrectShapes, setAutoCorrectShapes] = useState(false)

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

  const drawnShapesRef = useRef([])

  const expandSelectionToContainIntersectingShapes = (rect) => {
    if (!rect) return rect
    let currentRect = { ...rect }
    let expanded = true
    const shapes = drawnShapesRef.current
    const visited = new Set()
    
    while (expanded) {
      expanded = false
      for (let i = 0; i < shapes.length; i++) {
        if (visited.has(i)) continue
        const s = shapes[i]
        
        // Check intersection
        const intersects = 
          currentRect.x < s.x + s.w &&
          currentRect.x + currentRect.w > s.x &&
          currentRect.y < s.y + s.h &&
          currentRect.y + currentRect.h > s.y
          
        if (intersects) {
          visited.add(i)
          const x1 = Math.min(currentRect.x, s.x)
          const y1 = Math.min(currentRect.y, s.y)
          const x2 = Math.max(currentRect.x + currentRect.w, s.x + s.w)
          const y2 = Math.max(currentRect.y + currentRect.h, s.y + s.h)
          currentRect = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
          expanded = true
        }
      }
    }
    return currentRect
  }

  const selectionRef = useRef({
    active: false,
    rect: null, // { x, y, w, h }
    pixels: null, // ImageData
    backgroundData: null, // ImageData
    originalCanvasData: null, // ImageData
    isSelecting: false,
    isMoving: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    selectedShapeIndices: [],
    originalRect: null
  })

  const drawMarqueeOutline = (ctx, rect) => {
    if (!rect) return
    ctx.save()
    ctx.strokeStyle = '#38bdf8'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 4])
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)'
    ctx.shadowBlur = 4
    
    // Draw outer boundary
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)
    
    // Draw little handles at corners
    ctx.fillStyle = '#38bdf8'
    const handleSize = 6
    ctx.fillRect(rect.x - handleSize/2, rect.y - handleSize/2, handleSize, handleSize)
    ctx.fillRect(rect.x + rect.w - handleSize/2, rect.y - handleSize/2, handleSize, handleSize)
    ctx.fillRect(rect.x - handleSize/2, rect.y + rect.h - handleSize/2, handleSize, handleSize)
    ctx.fillRect(rect.x + rect.w - handleSize/2, rect.y + rect.h - handleSize/2, handleSize, handleSize)
    
    ctx.restore()
  }

  const commitSelection = () => {
    const sel = selectionRef.current
    if (!sel.active) return
    
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    
    // Put background data back
    if (sel.backgroundData) {
      safePutImageData(ctx, sel.backgroundData)
    }
    
    // Draw the floating pixels at final position
    if (sel.pixels && sel.rect) {
      const offscreen = document.createElement('canvas')
      offscreen.width = sel.pixels.width
      offscreen.height = sel.pixels.height
      const offscreenCtx = offscreen.getContext('2d')
      offscreenCtx.putImageData(sel.pixels, 0, 0)
      ctx.drawImage(offscreen, sel.rect.x, sel.rect.y)
    }
    
    // Offset the coordinates of the selected shapes
    if (sel.selectedShapeIndices && sel.selectedShapeIndices.length > 0 && sel.originalRect && sel.rect) {
      const dx = sel.rect.x - sel.originalRect.x
      const dy = sel.rect.y - sel.originalRect.y
      sel.selectedShapeIndices.forEach(idx => {
        if (drawnShapesRef.current[idx]) {
          drawnShapesRef.current[idx].x += dx
          drawnShapesRef.current[idx].y += dy
        }
      })
    }
    
    sel.active = false
    sel.rect = null
    sel.pixels = null
    sel.backgroundData = null
    sel.originalCanvasData = null
    sel.isSelecting = false
    sel.isMoving = false
    sel.selectedShapeIndices = []
    sel.originalRect = null
    
    saveCanvasState()
  }

  const cancelSelection = () => {
    const sel = selectionRef.current
    if (!sel.active) return
    
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    
    // Restore the canvas to the state before selection started
    if (sel.originalCanvasData) {
      safePutImageData(ctx, sel.originalCanvasData)
    }
    
    sel.active = false
    sel.rect = null
    sel.pixels = null
    sel.backgroundData = null
    sel.originalCanvasData = null
    sel.isSelecting = false
    sel.isMoving = false
    sel.selectedShapeIndices = []
    sel.originalRect = null
  }

  const deleteSelection = () => {
    const sel = selectionRef.current
    if (!sel.active) return
    
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    
    // Put background data (which has cutout filled with bg color)
    if (sel.backgroundData) {
      safePutImageData(ctx, sel.backgroundData)
    }
    
    // Remove the selected shapes from drawnShapesRef
    if (sel.selectedShapeIndices && sel.selectedShapeIndices.length > 0) {
      drawnShapesRef.current = drawnShapesRef.current.filter((_, idx) => !sel.selectedShapeIndices.includes(idx))
    }
    
    sel.active = false
    sel.rect = null
    sel.pixels = null
    sel.backgroundData = null
    sel.originalCanvasData = null
    sel.isSelecting = false
    sel.isMoving = false
    sel.selectedShapeIndices = []
    sel.originalRect = null
    
    saveCanvasState()
  }

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
    points: [],
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
    autoCorrectShapes,
    settings,
    isCameraOn: isCameraOn && isActivePage,
    canvasMode: '2d'
  })

  useEffect(() => {
    stateRef.current = {
      color,
      tool,
      brushSize,
      brushOpacity,
      stabilizeEnabled,
      autoCorrectShapes,
      settings,
      isCameraOn: isCameraOn && isActivePage,
      canvasMode
    }
  }, [color, tool, brushSize, brushOpacity, stabilizeEnabled, autoCorrectShapes, settings, isCameraOn, isActivePage, canvasMode])

  // Particles Trail System Reference
  const particlesRef = useRef([])
  const animationFrameIdRef = useRef(null)
  const wsRef = useRef(null)
  
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
      
      ctx.globalAlpha = 1.0
      ctx.fillStyle = '#0a0518'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      if (initialDrawing) {
        if (initialDrawing.canvas_mode === '3d') {
          setCanvasMode('3d')
          if (initialDrawing.threed_objects) {
            try {
              const parsed = JSON.parse(initialDrawing.threed_objects)
              if (Array.isArray(parsed)) {
                stamped3DObjectsRef.current = parsed
                setUndoStack3D([parsed])
                setRedoStack3D([])
              }
            } catch (e) {
              console.error("Failed to parse 3D objects:", e)
            }
          } else {
            stamped3DObjectsRef.current = []
            setUndoStack3D([[]])
            setRedoStack3D([])
          }
        } else {
          setCanvasMode('2d')
          stamped3DObjectsRef.current = []
          setUndoStack3D([[]])
          setRedoStack3D([])
          if (initialDrawing.image_data) {
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
      } else {
        setCanvasMode('2d')
        stamped3DObjectsRef.current = []
        setUndoStack3D([[]])
        setRedoStack3D([])
        saveCanvasState(true)
      }
    }

  }, [initialDrawing])

  // Play or pause particles/3D rendering loop based on page activity
  useEffect(() => {
    if (isActivePage) {
      startParticlesAnimationLoop()
    } else {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current)
      }
    }
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current)
      }
    }
  }, [isActivePage])

  // Commit active selection if tool changes away from 'select', and commit text if tool changes away from 'text'
  useEffect(() => {
    if (tool !== 'select') {
      commitSelection()
    }
    if (tool !== 'text' && textInputRef.current) {
      commitTextInput()
    }
    const canvas = canvasRef.current
    if (canvas) {
      canvas.style.cursor = tool === 'select' ? 'default' : 'crosshair'
    }
  }, [tool])

  // Listen to keyboard shortcuts for selection manipulation (Nudge, Delete, Cancel)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (stateRef.current.canvasMode === '3d') return
      
      const sel = selectionRef.current
      if (!sel.active) return
      
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      
      let moved = false
      let nudgeAmt = e.shiftKey ? 10 : 2
      
      if (e.key === 'ArrowUp') {
        sel.rect.y -= nudgeAmt
        moved = true
      } else if (e.key === 'ArrowDown') {
        sel.rect.y += nudgeAmt
        moved = true
      } else if (e.key === 'ArrowLeft') {
        sel.rect.x -= nudgeAmt
        moved = true
      } else if (e.key === 'ArrowRight') {
        sel.rect.x += nudgeAmt
        moved = true
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteSelection()
        return
      } else if (e.key === 'Escape') {
        e.preventDefault()
        cancelSelection()
        return
      }
      
      if (moved) {
        e.preventDefault()
        // Redraw canvas with new position
        safePutImageData(ctx, sel.backgroundData)
        if (sel.pixels) {
          const offscreen = document.createElement('canvas')
          offscreen.width = sel.pixels.width
          offscreen.height = sel.pixels.height
          const offscreenCtx = offscreen.getContext('2d')
          offscreenCtx.putImageData(sel.pixels, 0, 0)
          ctx.drawImage(offscreen, sel.rect.x, sel.rect.y)
        }
        drawMarqueeOutline(ctx, sel.rect)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const saveCanvasState = (isEmpty = false) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    
    setUndoStack(prev => {
      const next = [...prev, { imgData, isEmpty, shapes: [...drawnShapesRef.current] }]
      if (next.length > 25) next.shift()
      return next
    })
    setRedoStack([])
  }

  const handleModeSwitch = (newMode) => {
    if (newMode === canvasMode) return
    
    if (selectionRef.current.active) {
      commitSelection()
    }
    
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
          safePutImageData(ctx2, canvas2DDataRef.current)
        } else {
          ctx2.globalAlpha = 1.0
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
    if (selectionRef.current.active) {
      commitSelection()
    }
    if (undoStack.length <= 1) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    const current = undoStack[undoStack.length - 1]
    setRedoStack(prev => [...prev, current])
    
    const previous = undoStack[undoStack.length - 2]
    safePutImageData(ctx, previous.imgData)
    drawnShapesRef.current = previous.shapes || []
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
    if (selectionRef.current.active) {
      commitSelection()
    }
    if (redoStack.length === 0) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    const nextState = redoStack[redoStack.length - 1]
    safePutImageData(ctx, nextState.imgData)
    drawnShapesRef.current = nextState.shapes || []
    
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
    if (selectionRef.current.active) {
      commitSelection()
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
        ctx.globalAlpha = 1.0
        ctx.fillStyle = '#0a0518'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        drawnShapesRef.current = []
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
    } else if (PRIMITIVE_3D_TOOLS.includes(tool3d)) {
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
      if (PRIMITIVE_3D_TOOLS.includes(tool3d)) {
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
    
    if (stateRef.current.tool === 'select') {
      if (textInputRef.current) {
        commitTextInput()
      }
      e.preventDefault()
      const sel = selectionRef.current
      
      const clickedInside = sel.active && sel.rect &&
        x >= sel.rect.x && x <= sel.rect.x + sel.rect.w &&
        y >= sel.rect.y && y <= sel.rect.y + sel.rect.h
        
      if (clickedInside) {
        sel.isMoving = true
        sel.startX = x
        sel.startY = y
        sel.lastX = sel.rect.x
        sel.lastY = sel.rect.y
      } else {
        commitSelection()
        sel.isSelecting = true
        sel.startX = x
        sel.startY = y
        const ctx = canvas.getContext('2d')
        sel.originalCanvasData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        sel.rect = null
      }
    } else {
      startDraw(x, y)
    }
  }

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    
    if (stateRef.current.canvasMode === '3d') {
      handleMouseMove3D(e, rect)
      return
    }
    
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY
    
    if (stateRef.current.tool === 'select') {
      e.preventDefault()
      const sel = selectionRef.current
      const ctx = canvas.getContext('2d')
      
      if (sel.isSelecting) {
        const x1 = Math.min(sel.startX, x)
        const y1 = Math.min(sel.startY, y)
        const w = Math.abs(x - sel.startX)
        const h = Math.abs(y - sel.startY)
        sel.rect = { x: x1, y: y1, w, h }
        
        safePutImageData(ctx, sel.originalCanvasData)
        drawMarqueeOutline(ctx, sel.rect)
      } else if (sel.isMoving) {
        const dx = x - sel.startX
        const dy = y - sel.startY
        sel.rect.x = sel.lastX + dx
        sel.rect.y = sel.lastY + dy
        
        safePutImageData(ctx, sel.backgroundData)
        if (sel.pixels) {
          const offscreen = document.createElement('canvas')
          offscreen.width = sel.pixels.width
          offscreen.height = sel.pixels.height
          const offscreenCtx = offscreen.getContext('2d')
          offscreenCtx.putImageData(sel.pixels, 0, 0)
          ctx.drawImage(offscreen, sel.rect.x, sel.rect.y)
        }
        drawMarqueeOutline(ctx, sel.rect)
      }
    } else {
      if (!drawingRef.current.isDrawing) return
      addParticles(x, y, stateRef.current.color)
      drawMove(x, y)
    }
  }

  const handleMouseUp = () => {
    if (stateRef.current.canvasMode === '3d') {
      handleMouseUp3D()
      return
    }
    
    if (stateRef.current.tool === 'select') {
      const sel = selectionRef.current
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      
      if (sel.isSelecting) {
        sel.isSelecting = false
        if (sel.rect && sel.rect.w > 4 && sel.rect.h > 4) {
          // Expand selection rectangle to contain any intersected shapes
          sel.rect = expandSelectionToContainIntersectingShapes(sel.rect)
          
          // Find indices of shapes inside the selection
          sel.selectedShapeIndices = []
          for (let i = 0; i < drawnShapesRef.current.length; i++) {
            const s = drawnShapesRef.current[i]
            const intersects = 
              sel.rect.x <= s.x + s.w &&
              sel.rect.x + sel.rect.w >= s.x &&
              sel.rect.y <= s.y + s.h &&
              sel.rect.y + sel.rect.h >= s.y
            if (intersects) {
              sel.selectedShapeIndices.push(i)
            }
          }
          sel.originalRect = { ...sel.rect }

          // Restore clean canvas to avoid capturing the marquee outline in pixels or background
          if (sel.originalCanvasData) {
            safePutImageData(ctx, sel.originalCanvasData)
          }
          sel.pixels = ctx.getImageData(sel.rect.x, sel.rect.y, sel.rect.w, sel.rect.h)
          ctx.fillStyle = '#0a0518'
          ctx.fillRect(sel.rect.x, sel.rect.y, sel.rect.w, sel.rect.h)
          sel.backgroundData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          
          safePutImageData(ctx, sel.backgroundData)
          if (sel.pixels) {
            const offscreen = document.createElement('canvas')
            offscreen.width = sel.pixels.width
            offscreen.height = sel.pixels.height
            const offscreenCtx = offscreen.getContext('2d')
            offscreenCtx.putImageData(sel.pixels, 0, 0)
            ctx.drawImage(offscreen, sel.rect.x, sel.rect.y)
          }
          drawMarqueeOutline(ctx, sel.rect)
          sel.active = true
        } else {
          if (sel.originalCanvasData) {
            safePutImageData(ctx, sel.originalCanvasData)
          }
          sel.active = false
          sel.rect = null
          sel.pixels = null
          sel.backgroundData = null
          sel.originalCanvasData = null
        }
      } else if (sel.isMoving) {
        sel.isMoving = false
        safePutImageData(ctx, sel.backgroundData)
        if (sel.pixels) {
          const offscreen = document.createElement('canvas')
          offscreen.width = sel.pixels.width
          offscreen.height = sel.pixels.height
          const offscreenCtx = offscreen.getContext('2d')
          offscreenCtx.putImageData(sel.pixels, 0, 0)
          ctx.drawImage(offscreen, sel.rect.x, sel.rect.y)
        }
        drawMarqueeOutline(ctx, sel.rect)
      }
    } else {
      if (!drawingRef.current.isDrawing) return
      endDraw()
    }
  }

  const commitTextInput = () => {
    const currentInput = textInputRef.current
    if (!currentInput) return
    
    // Protect against instant blur caused by browser click event cycle
    const age = Date.now() - (currentInput.createdAt || 0)
    if (age < 300 && stateRef.current.tool === 'text') {
      setTimeout(() => {
        const inputEl = document.getElementById('canvas-text-input')
        if (inputEl) inputEl.focus()
      }, 10)
      return
    }
    
    setTextInput(null)
    
    const { canvasX, canvasY, value } = currentInput
    if (!value.trim()) return
    
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    
    const { color: currentColor, brushSize: currentBrushSize, brushOpacity: currentBrushOpacity } = stateRef.current
    
    ctx.save()
    ctx.fillStyle = currentColor
    ctx.globalAlpha = currentBrushOpacity
    const fontSize = Math.max(16, currentBrushSize * 2.5)
    ctx.font = `bold ${fontSize}px Inter, Roboto, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(value, canvasX, canvasY)
    ctx.restore()
    
    saveCanvasState()
  }

  const startDraw = (x, y) => {
    if (stateRef.current.tool === 'select') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    
    if (stateRef.current.tool === 'text') {
      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const cssX = x / scaleX
      const cssY = y / scaleY
      
      if (textInputRef.current) {
        commitTextInput()
      }
      
      setTextInput({
        cssX,
        cssY,
        canvasX: x,
        canvasY: y,
        value: '',
        createdAt: Date.now()
      })
      return
    }
    
    drawingRef.current.isDrawing = true
    drawingRef.current.startX = x
    drawingRef.current.startY = y
    drawingRef.current.lastX = x
    drawingRef.current.lastY = y
    drawingRef.current.points = [{ x, y }]
    
    drawingRef.current.savedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  }

  const drawMove = (x, y) => {
    if (stateRef.current.tool === 'select') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const drawState = drawingRef.current
    
    const { tool: currentTool, color: currentColor, brushSize: currentBrushSize, brushOpacity: currentBrushOpacity, stabilizeEnabled: currentStabilizeEnabled } = stateRef.current

    ctx.strokeStyle = currentTool === 'eraser' ? '#0a0518' : currentColor
    ctx.fillStyle = currentTool === 'eraser' ? '#0a0518' : currentColor
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

    const paintTools = ['brush', 'pencil', 'highlighter', 'spray', 'eraser', 'text']
    const isPainting = paintTools.includes(currentTool)

    if (isPainting) {
      if (drawState.points) {
        drawState.points.push({ x: drawX, y: drawY })
      }
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
        safePutImageData(ctx, drawState.savedImageData)
      }
      
      ctx.beginPath()
      drawShapePath(ctx, currentTool, drawState.startX, drawState.startY, drawX, drawY)
      ctx.stroke()
      
      drawState.lastX = drawX
      drawState.lastY = drawY
    }
  }

  const applySnappedShape = (canvas, savedData, detected, colorVal, sizeVal, opacityVal, toolVal) => {
    if (!canvas || !detected) return
    const ctx = canvas.getContext('2d')
    safePutImageData(ctx, savedData)
    
    ctx.save()
    ctx.strokeStyle = colorVal
    ctx.lineWidth = sizeVal
    ctx.globalAlpha = opacityVal
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    
    if (toolVal === 'pencil') {
      ctx.lineWidth = 2
      ctx.globalAlpha = 1.0
    } else if (toolVal === 'highlighter') {
      ctx.globalAlpha = 0.35
      ctx.lineWidth = Math.max(12, sizeVal * 2.5)
      ctx.lineCap = 'square'
      ctx.lineJoin = 'miter'
    }
    
    ctx.beginPath()
    if (detected.type === 'line') {
      ctx.moveTo(detected.params.startX, detected.params.startY)
      ctx.lineTo(detected.params.endX, detected.params.endY)
      ctx.stroke()
    } else if (detected.type === 'circle') {
      ctx.arc(detected.params.cx, detected.params.cy, detected.params.r, 0, 2 * Math.PI)
      ctx.stroke()
    } else if (detected.type === 'rect') {
      ctx.rect(detected.params.startX, detected.params.startY, detected.params.w, detected.params.h)
      ctx.stroke()
    } else if (detected.type === 'triangle') {
      ctx.moveTo(detected.params.p1.x, detected.params.p1.y)
      ctx.lineTo(detected.params.p2.x, detected.params.p2.y)
      ctx.lineTo(detected.params.p3.x, detected.params.p3.y)
      ctx.closePath()
      ctx.stroke()
    } else if (detected.type === 'ellipse') {
      ctx.ellipse(detected.params.cx, detected.params.cy, detected.params.rx, detected.params.ry, 0, 0, 2 * Math.PI)
      ctx.stroke()
    }
    // Record the snapped shape box in drawnShapesRef
    let shapeRect = null
    const margin = sizeVal + 4
    if (detected.type === 'line') {
      const x1 = Math.min(detected.params.startX, detected.params.endX)
      const y1 = Math.min(detected.params.startY, detected.params.endY)
      const x2 = Math.max(detected.params.startX, detected.params.endX)
      const y2 = Math.max(detected.params.startY, detected.params.endY)
      shapeRect = {
        x: x1 - margin,
        y: y1 - margin,
        w: (x2 - x1) + 2 * margin,
        h: (y2 - y1) + 2 * margin
      }
    } else if (detected.type === 'circle') {
      const r = detected.params.r
      shapeRect = {
        x: detected.params.cx - r - margin,
        y: detected.params.cy - r - margin,
        w: 2 * r + 2 * margin,
        h: 2 * r + 2 * margin
      }
    } else if (detected.type === 'rect') {
      shapeRect = {
        x: detected.params.startX - margin,
        y: detected.params.startY - margin,
        w: detected.params.w + 2 * margin,
        h: detected.params.h + 2 * margin
      }
    } else if (detected.type === 'triangle') {
      const xs = [detected.params.p1.x, detected.params.p2.x, detected.params.p3.x]
      const ys = [detected.params.p1.y, detected.params.p2.y, detected.params.p3.y]
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)
      shapeRect = {
        x: minX - margin,
        y: minY - margin,
        w: (maxX - minX) + 2 * margin,
        h: (maxY - minY) + 2 * margin
      }
    } else if (detected.type === 'ellipse') {
      const rx = detected.params.rx
      const ry = detected.params.ry
      shapeRect = {
        x: detected.params.cx - rx - margin,
        y: detected.params.cy - ry - margin,
        w: 2 * rx + 2 * margin,
        h: 2 * ry + 2 * margin
      }
    }
    if (shapeRect) {
      drawnShapesRef.current.push(shapeRect)
    }

    ctx.restore()
    saveCanvasState()
  }

  const endDraw = () => {
    if (stateRef.current.tool === 'select') return
    const drawState = drawingRef.current
    drawState.isDrawing = false
    
    const { tool: currentTool, color: currentColor, brushSize: currentBrushSize, brushOpacity: currentBrushOpacity, autoCorrectShapes: currentAutoCorrect } = stateRef.current
    
    const paintTools = ['brush', 'pencil', 'highlighter']
    const isPaintTool = paintTools.includes(currentTool)
    
    if (currentAutoCorrect && isPaintTool && drawState.points && drawState.points.length >= 12 && drawState.savedImageData) {
      const canvas = canvasRef.current
      const points = [...drawState.points]
      const savedData = drawState.savedImageData
      
      const runLocalFallback = () => {
        const localDetected = detectAndFitShape(points)
        if (localDetected) {
          applySnappedShape(canvas, savedData, localDetected, currentColor, currentBrushSize, currentBrushOpacity, currentTool)
        } else {
          saveCanvasState()
        }
      }

      fetch(`${BACKEND_URL}/api/predict-shape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points })
      })
      .then(res => {
        if (!res.ok) throw new Error('API error')
        return res.json()
      })
      .then(detected => {
        if (detected && detected.type !== 'unknown' && detected.confidence > 0.6) {
          applySnappedShape(canvas, savedData, detected, currentColor, currentBrushSize, currentBrushOpacity, currentTool)
        } else {
          runLocalFallback()
        }
      })
      .catch(() => {
        runLocalFallback()
      })
    } else {
      const paintTools2 = ['brush', 'pencil', 'highlighter', 'spray', 'eraser', 'text']
      if (!paintTools2.includes(currentTool) && currentTool !== 'select') {
        const x1 = Math.min(drawState.startX, drawState.lastX)
        const y1 = Math.min(drawState.startY, drawState.lastY)
        const x2 = Math.max(drawState.startX, drawState.lastX)
        const y2 = Math.max(drawState.startY, drawState.lastY)
        const margin = currentBrushSize + 4
        drawnShapesRef.current.push({
          x: x1 - margin,
          y: y1 - margin,
          w: (x2 - x1) + 2 * margin,
          h: (y2 - y1) + 2 * margin
        })
      }
      saveCanvasState()
    }
    
    drawState.savedImageData = null
    drawState.points = []
  }

  const stampShape = (x, y, radius, shapeType, colorVal, sizeVal, opacityVal) => {
    if (stateRef.current.tool === 'select') return
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
    
    const margin = sizeVal + 4
    drawnShapesRef.current.push({
      x: x - radius - margin,
      y: y - radius - margin,
      w: 2 * radius + 2 * margin,
      h: 2 * radius + 2 * margin
    })
    
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
    
    ctx.globalAlpha = 1.0
    ctx.fillStyle = '#0a0518'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    const { rx, ry, scale } = camera3DRef.current
    
    drawViewportGrid(ctx, rx, ry, scale, canvas.width, canvas.height)
    drawAxisHelper(ctx, rx, ry)
    
    let stampedObjects = [...stamped3DObjectsRef.current]
    if (aiSketchingRef.current && aiSketchingRef.current.targetCanvas === '3d' && aiSketchingRef.current.strokes) {
      const partial = getPartial3DStrokes(aiSketchingRef.current.strokes, aiSketchingProgressRef.current)
      stampedObjects = [...stampedObjects, ...partial]
    }
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
    if (PRIMITIVE_3D_TOOLS.includes(tool3d)) {
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
          
          hCtx.globalAlpha = 1.0
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
      } else if (PRIMITIVE_3D_TOOLS.includes(tool3d)) {
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
        } else if (PRIMITIVE_3D_TOOLS.includes(tool3d)) {
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
        } else if (PRIMITIVE_3D_TOOLS.includes(tool3d)) {
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
      
      if (PRIMITIVE_3D_TOOLS.includes(tool3d)) {
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
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current)
    }
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

    // If camera is turned off or page is inactive, reset loader immediately and stop
    if (!isCameraOn || !isActivePage) {
      setCameraLoading(false)
      return
    }

    const initTracking = () => {
      const CameraLib = window.Camera

      if (!CameraLib) {
        setDialog({
          isOpen: true,
          type: 'alert',
          title: 'Camera Library Load Error',
          message: 'Camera utility script libraries failed to load. Please check your network connection and reload.',
          confirmText: 'OK',
          onConfirm: () => setDialog(prev => ({ ...prev, isOpen: false }))
        })
        setIsCameraOn(false)
        return
      }

      setCameraLoading(true)
      
      // Initialize WebSocket for backend hand tracking with dynamic confidence
      const wsProtocol = BACKEND_URL.startsWith('https') ? 'wss' : 'ws'
      const wsHost = BACKEND_URL.replace(/^https?:\/\//, '')
      const confidence = settings.detectionConfidence || '0.5'
      const wsUrl = `${wsProtocol}://${wsHost}/api/ws/hand-tracking?confidence=${confidence}`
      
      console.log("Connecting hand tracking WebSocket:", wsUrl)
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws
      
      let isProcessingFrame = false
      
      ws.onopen = () => {
        console.log("Backend hand tracking WebSocket connected.")
      }
      
      ws.onmessage = (event) => {
        if (!active) return
        setCameraLoading(false)
        isProcessingFrame = false
        
        try {
          const results = JSON.parse(event.data)
          if (results.error) {
            console.error("Backend hand tracking error:", results.error)
            return
          }
          processTrackingResults(results)
        } catch (e) {
          console.error("Failed to parse backend hand tracking results:", e)
        }
      }
      
      ws.onerror = (err) => {
        console.error("WebSocket hand tracking error:", err)
        if (active) setCameraLoading(false)
      }
      
      ws.onclose = () => {
        console.log("WebSocket hand tracking closed.")
        if (active) setCameraLoading(false)
      }
      
      // Offscreen canvas to capture and compress frame to send
      const offscreenCanvas = document.createElement('canvas')
      offscreenCanvas.width = 320
      offscreenCanvas.height = 240
      const offscreenCtx = offscreenCanvas.getContext('2d')
      
      if (videoRef.current) {
        cameraInstance = new CameraLib(videoRef.current, {
          onFrame: async () => {
            if (!active || !isCameraOn || !isActivePage) return
            
            if (ws.readyState === WebSocket.OPEN && !isProcessingFrame) {
              isProcessingFrame = true
              
              // Draw current video frame to offscreen canvas
              offscreenCtx.drawImage(videoRef.current, 0, 0, offscreenCanvas.width, offscreenCanvas.height)
              
              // Convert to JPEG blob and send to backend
              offscreenCanvas.toBlob((blob) => {
                if (blob && ws.readyState === WebSocket.OPEN) {
                  ws.send(blob)
                } else {
                  isProcessingFrame = false
                }
              }, 'image/jpeg', 0.6)
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
      if (wsRef.current) {
        try {
          wsRef.current.close()
        } catch (e) {
          console.error(e)
        }
        wsRef.current = null
      }
    }
  }, [isCameraOn, settings.detectionConfidence, isActivePage])

  const processTrackingResults = (results) => {
    const canvas = canvasRef.current
    const handCanvas = handCanvasRef.current
    if (!canvas || !handCanvas) return

    const hCtx = handCanvas.getContext('2d')
    hCtx.clearRect(0, 0, handCanvas.width, handCanvas.height)
    hCtx.globalAlpha = 1.0

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
      const currentAlpha = currentStabilizeEnabled && !['brush', 'pencil', 'highlighter', 'spray', 'eraser', 'text'].includes(currentTool) ? 0.85 : 0.55

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
            mainCtx.globalAlpha = 1.0
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

      if (currentTool === 'select') {
        const thumbTip = landmarks[4]
        const pinchDist = Math.sqrt(
          Math.pow(indexTip.x - thumbTip.x, 2) +
          Math.pow(indexTip.y - thumbTip.y, 2)
        )
        const isPinching = pinchDist < 0.045
        
        const sel = selectionRef.current
        const mainCtx = canvas.getContext('2d')

        if (isPinching) {
          const clickedInside = sel.active && sel.rect &&
            x >= sel.rect.x && x <= sel.rect.x + sel.rect.w &&
            y >= sel.rect.y && y <= sel.rect.y + sel.rect.h

          if (clickedInside || sel.isMoving) {
            currentMode = 'Pinch Move'
            if (!sel.isMoving) {
              sel.isMoving = true
              sel.startX = x
              sel.startY = y
              sel.lastX = sel.rect.x
              sel.lastY = sel.rect.y
            } else {
              const dx = x - sel.startX
              const dy = y - sel.startY
              sel.rect.x = sel.lastX + dx
              sel.rect.y = sel.lastY + dy

              safePutImageData(mainCtx, sel.backgroundData)
              if (sel.pixels) {
                const offscreen = document.createElement('canvas')
                offscreen.width = sel.pixels.width
                offscreen.height = sel.pixels.height
                const offscreenCtx = offscreen.getContext('2d')
                offscreenCtx.putImageData(sel.pixels, 0, 0)
                mainCtx.drawImage(offscreen, sel.rect.x, sel.rect.y)
              }
              drawMarqueeOutline(mainCtx, sel.rect)
            }
          } else {
            currentMode = 'Pinch Select'
            if (!sel.isSelecting) {
              if (sel.active) {
                commitSelection()
              }
              sel.isSelecting = true
              sel.startX = x
              sel.startY = y
              sel.originalCanvasData = mainCtx.getImageData(0, 0, canvas.width, canvas.height)
              sel.rect = null
            } else {
              const x1 = Math.min(sel.startX, x)
              const y1 = Math.min(sel.startY, y)
              const w = Math.abs(x - sel.startX)
              const h = Math.abs(y - sel.startY)
              sel.rect = { x: x1, y: y1, w, h }

              safePutImageData(mainCtx, sel.originalCanvasData)
              drawMarqueeOutline(mainCtx, sel.rect)
            }
          }
        } else {
          currentMode = 'Hover'
          if (sel.isSelecting) {
            sel.isSelecting = false
            if (sel.rect && sel.rect.w > 4 && sel.rect.h > 4) {
              // Expand selection rectangle to contain any intersected shapes
              sel.rect = expandSelectionToContainIntersectingShapes(sel.rect)
              
              // Find indices of shapes inside the selection
              sel.selectedShapeIndices = []
              for (let i = 0; i < drawnShapesRef.current.length; i++) {
                const s = drawnShapesRef.current[i]
                const intersects = 
                  sel.rect.x <= s.x + s.w &&
                  sel.rect.x + sel.rect.w >= s.x &&
                  sel.rect.y <= s.y + s.h &&
                  sel.rect.y + sel.rect.h >= s.y
                if (intersects) {
                  sel.selectedShapeIndices.push(i)
                }
              }
              sel.originalRect = { ...sel.rect }

              // Restore clean canvas to avoid capturing the marquee outline in pixels or background
              if (sel.originalCanvasData) {
                safePutImageData(mainCtx, sel.originalCanvasData)
              }
              sel.pixels = mainCtx.getImageData(sel.rect.x, sel.rect.y, sel.rect.w, sel.rect.h)
              mainCtx.fillStyle = '#0a0518'
              mainCtx.fillRect(sel.rect.x, sel.rect.y, sel.rect.w, sel.rect.h)
              sel.backgroundData = mainCtx.getImageData(0, 0, canvas.width, canvas.height)
              
              safePutImageData(mainCtx, sel.backgroundData)
              if (sel.pixels) {
                const offscreen = document.createElement('canvas')
                offscreen.width = sel.pixels.width
                offscreen.height = sel.pixels.height
                const offscreenCtx = offscreen.getContext('2d')
                offscreenCtx.putImageData(sel.pixels, 0, 0)
                mainCtx.drawImage(offscreen, sel.rect.x, sel.rect.y)
              }
              drawMarqueeOutline(mainCtx, sel.rect)
              sel.active = true
            } else {
              if (sel.originalCanvasData) {
                safePutImageData(mainCtx, sel.originalCanvasData)
              }
              sel.active = false
              sel.rect = null
              sel.pixels = null
              sel.backgroundData = null
              sel.originalCanvasData = null
            }
          } else if (sel.isMoving) {
            sel.isMoving = false
            safePutImageData(mainCtx, sel.backgroundData)
            if (sel.pixels) {
              const offscreen = document.createElement('canvas')
              offscreen.width = sel.pixels.width
              offscreen.height = sel.pixels.height
              const offscreenCtx = offscreen.getContext('2d')
              offscreenCtx.putImageData(sel.pixels, 0, 0)
              mainCtx.drawImage(offscreen, sel.rect.x, sel.rect.y)
            }
            drawMarqueeOutline(mainCtx, sel.rect)
          }
        }
      } else {
        const isIndexUp = indexTip.y < indexPip.y
        const isMiddleUp = middleTip.y < middlePip.y

        if (isIndexUp && !isMiddleUp) {
          const isShapeTool = !['brush', 'pencil', 'highlighter', 'spray', 'eraser', 'text'].includes(currentTool)
          
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
          image_data: dataUrl,
          canvas_mode: canvasMode,
          threed_objects: canvasMode === '3d' ? JSON.stringify(stamped3DObjectsRef.current) : null
        })
      })

      if (res.ok) {
        const data = await res.json()
        const successMsg = isUpdate ? 'Sketch updated successfully!' : 'Sketch saved successfully!'
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
        const errorMsg = data.detail || (isUpdate ? 'Failed to update sketch' : 'Failed to save sketch')
        setDbMessage(errorMsg)
        showToast(errorMsg, 'error')
      }
    } catch (err) {
      console.error(err)
      const errorMsg = 'Server connection error'
      setDbMessage(errorMsg)
      showToast(errorMsg, 'error')
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
      showToast("Canvas sketch downloaded locally!", "download")
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
              {canvasMode === '2d' && (
                <motion.div
                  layoutId="active-canvas-mode-bg"
                  style={styles.segmentedBtnActiveBg}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Palette size={14} />
                <span>2D Canvas</span>
              </span>
            </button>
            <button 
              style={canvasMode === '3d' ? styles.segmentedBtnActive : styles.segmentedBtn}
              onClick={() => handleModeSwitch('3d')}
              title="Switch to 3D digital wireframe canvas"
            >
              {canvasMode === '3d' && (
                <motion.div
                  layoutId="active-canvas-mode-bg"
                  style={styles.segmentedBtnActiveBg}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Box size={14} />
                <span>3D Canvas</span>
              </span>
            </button>
          </div>

          <button 
            className="glass-btn" 
            onClick={() => setShowAISketchModal(true)}
            title="Generate drawing/sketch using AI prompts"
            style={{
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(99, 102, 241, 0.25) 100%)',
              borderColor: 'rgba(139, 92, 246, 0.45)',
              boxShadow: '0 4px 15px rgba(139, 92, 246, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.35)'
            }}
          >
            <Sparkles size={16} className="spin-animation" style={{ animationDuration: '3s', color: '#c084fc' }} />
            <span>Sketch With AI</span>
          </button>

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
          <button className="glass-btn glass-btn-primary" onClick={() => setShowSaveModal(true)} title="Save to database" disabled={isCanvasEmpty}>
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
                    <Cylinder size={14} />
                    <span>Cylinder</span>
                  </button>
                  <button 
                    className={`glass-btn tool-grid-item ${active3DTool === '3d-pyramid' ? 'glass-btn-active' : ''}`}
                    onClick={() => set3DTool('3d-pyramid')}
                    title="Pyramid Primitive: Drag to resize, raise index & thumb to resize, fist to stamp"
                  >
                    <Pyramid size={14} />
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
                  <button 
                    className={`glass-btn tool-grid-item ${active3DTool === '3d-prism' ? 'glass-btn-active' : ''}`}
                    onClick={() => set3DTool('3d-prism')}
                    title="Prism Primitive: Drag to resize, raise index & thumb to resize, fist to stamp"
                  >
                    <Triangle size={14} />
                    <span>Prism</span>
                  </button>
                  <button 
                    className={`glass-btn tool-grid-item ${active3DTool === '3d-torus' ? 'glass-btn-active' : ''}`}
                    onClick={() => set3DTool('3d-torus')}
                    title="Torus Primitive: Drag to resize, raise index & thumb to resize, fist to stamp"
                  >
                    <CircleDot size={14} />
                    <span>Torus</span>
                  </button>
                  <button 
                    className={`glass-btn tool-grid-item ${active3DTool === '3d-octahedron' ? 'glass-btn-active' : ''}`}
                    onClick={() => set3DTool('3d-octahedron')}
                    title="Octahedron Primitive: Drag to resize, raise index & thumb to resize, fist to stamp"
                  >
                    <Diamond size={14} />
                    <span>Octahedron</span>
                  </button>
                  <button 
                    className={`glass-btn tool-grid-item ${active3DTool === '3d-capsule' ? 'glass-btn-active' : ''}`}
                    onClick={() => set3DTool('3d-capsule')}
                    title="Capsule Primitive: Drag to resize, raise index & thumb to resize, fist to stamp"
                  >
                    <Pill size={14} />
                    <span>Capsule</span>
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

                {canvasMode !== '3d' && (
                  <button 
                    className={`glass-btn ${autoCorrectShapes ? 'glass-btn-active' : ''}`}
                    style={{ padding: '8px 12px', fontSize: '13px', width: '100%', justifyContent: 'center', marginTop: '8px' }}
                    onClick={() => setAutoCorrectShapes(!autoCorrectShapes)}
                    title="Automatically detect circles, rectangles, triangles, ellipses, and lines from your freehand drawing and convert them to perfect geometric paths"
                  >
                    <Sparkles size={14} style={{ marginRight: '6px' }} />
                    <span>{autoCorrectShapes ? 'Auto-Snap ON' : 'Auto-Snap OFF'}</span>
                  </button>
                )}
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
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <canvas 
                ref={canvasRef}
                style={styles.canvas}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel3D}
              />
              {textInput && (
                <input
                  type="text"
                  value={textInput.value}
                  onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
                  onBlur={commitTextInput}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      commitTextInput()
                    } else if (e.key === 'Escape') {
                      setTextInput(null)
                    }
                  }}
                  id="canvas-text-input"
                  autoFocus
                  placeholder="Type text here..."
                  style={{
                    position: 'absolute',
                    left: `${textInput.cssX}px`,
                    top: `${textInput.cssY}px`,
                    background: 'rgba(10, 5, 24, 0.95)',
                    border: `1px solid ${color}`,
                    color: color,
                    fontFamily: 'Inter, sans-serif',
                    fontSize: `${Math.max(14, brushSize * 1.5)}px`,
                    fontWeight: 'bold',
                    outline: 'none',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    zIndex: 100,
                    minWidth: '150px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                    transform: 'translate(-50%, -50%)',
                    backdropFilter: 'blur(8px)',
                  }}
                />
              )}
            </div>
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
          showToast("3D OBJ Model downloaded!", "download")
        }}
      />

      <AISketchModal
        isOpen={showAISketchModal}
        onClose={() => setShowAISketchModal(false)}
        onApply={handleApplyAISketch}
        currentCanvasMode={canvasMode}
        styles={styles}
      />

      {showAiSketchLoader && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(5, 2, 12, 0.85)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          fontFamily: 'var(--font-body)'
        }}>
          <style>{`
            @keyframes ai-pulse-glow {
              0%, 100% { transform: scale(1); filter: drop-shadow(0 0 10px rgba(56, 189, 248, 0.4)) drop-shadow(0 0 15px rgba(139, 92, 246, 0.2)); }
              50% { transform: scale(1.05); filter: drop-shadow(0 0 25px rgba(56, 189, 248, 0.7)) drop-shadow(0 0 35px rgba(139, 92, 246, 0.5)); }
            }
            @keyframes ai-spin-ring-cw {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes ai-spin-ring-ccw {
              0% { transform: rotate(360deg); }
              100% { transform: rotate(0deg); }
            }
            @keyframes ai-sparkle-float-1 {
              0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.7; }
              50% { transform: translate(12px, -12px) scale(1.3); opacity: 1; }
            }
            @keyframes ai-sparkle-float-2 {
              0%, 100% { transform: translate(0, 0) scale(1.2); opacity: 0.9; }
              50% { transform: translate(-12px, 12px) scale(0.8); opacity: 0.5; }
            }
          `}</style>
          <div style={{
            background: 'rgba(13, 8, 28, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
            padding: '40px 30px',
            borderRadius: '24px',
            textAlign: 'center',
            maxWidth: '440px',
            width: '90%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative'
          }}>
            {/* Premium AI Star loading animation container */}
            <div style={{
              position: 'relative',
              width: '100px',
              height: '100px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'ai-pulse-glow 2.5s ease-in-out infinite'
            }}>
              {/* Outer Neon Ring */}
              <div style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                border: '3px solid transparent',
                borderTopColor: 'var(--theme-color-1)',
                borderBottomColor: 'var(--theme-color-1)',
                animation: 'ai-spin-ring-cw 4s linear infinite',
                opacity: 0.8
              }}></div>
              
              {/* Inner Neon Ring */}
              <div style={{
                position: 'absolute',
                width: '80%',
                height: '80%',
                borderRadius: '50%',
                border: '3px solid transparent',
                borderLeftColor: 'var(--theme-color-2)',
                borderRightColor: 'var(--theme-color-2)',
                animation: 'ai-spin-ring-ccw 3s linear infinite',
                opacity: 0.8
              }}></div>

              {/* Floating sparkles/stars around the core */}
              <div style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                animation: 'ai-sparkle-float-1 3s ease-in-out infinite'
              }}>
                <Sparkles size={16} color="#38bdf8" />
              </div>
              <div style={{
                position: 'absolute',
                bottom: '10px',
                left: '10px',
                animation: 'ai-sparkle-float-2 3.5s ease-in-out infinite'
              }}>
                <Sparkles size={14} color="#c084fc" />
              </div>

              {/* Glowing Core with central Star/Sparkle */}
              <div style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, rgba(56, 189, 248, 0.1) 70%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 20px rgba(139, 92, 246, 0.3)'
              }}>
                <Sparkles size={28} color="#fff" />
              </div>
            </div>

            <h3 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '20px', fontWeight: '700', letterSpacing: '-0.3px' }}>AI is Sketching...</h3>
            <p id="ai-sketch-status-text" style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--theme-color-2)', fontWeight: '600' }}>
              Analyzing prompt & outlines...
            </p>
            <p id="ai-sketch-prompt-text" style={{ margin: '0 0 24px 0', fontSize: '13px', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', wordBreak: 'break-word', maxWidth: '320px', lineHeight: '1.4' }}>
              "{aiSketchingRef.current?.prompt || 'Loading...'}"
            </p>

            <div style={{
              width: '100%',
              height: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '99px',
              overflow: 'hidden',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}>
              <div id="ai-sketch-progress-bar" style={{
                height: '100%',
                width: '0%',
                background: 'linear-gradient(90deg, var(--theme-color-1) 0%, var(--theme-color-2) 100%)',
                borderRadius: '99px'
              }}></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '8px', fontFamily: 'monospace' }}>
              <span id="ai-sketch-time-text">0m 0s / 0m 0s</span>
              <span id="ai-sketch-percent-text">0%</span>
            </div>
            <button 
              id="ai-sketch-cancel-btn" 
              className="glass-btn" 
              style={{ 
                marginTop: '28px', 
                width: '100%', 
                justifyContent: 'center', 
                background: 'rgba(239, 68, 68, 0.1)', 
                borderColor: 'rgba(239, 68, 68, 0.25)', 
                color: '#f87171' 
              }}
            >
              Cancel AI Sketching
            </button>
          </div>
        </div>
      )}

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
