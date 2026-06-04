import React, { useRef, useState, useEffect } from 'react'
import { Palette, Eraser, Circle as CircleIcon, Square, Slash, Trash2, Undo, Redo, Download, Save, Camera, CameraOff, Video, Eye, ShieldAlert, Crosshair, Zap } from 'lucide-react'
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

export default function AirCanvas() {
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
    lastGestureMode: 'None'
  })

  // Camera settings loaded from Backend
  const [settings, setSettings] = useState({
    mirrorCamera: 'true',
    detectionConfidence: '0.5'
  })

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
    
    // Fill canvas with default background color
    ctx.fillStyle = '#0a0518'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // Save initial state
    saveCanvasState()

    // Start particle trail animation loop
    startParticlesAnimationLoop()

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current)
      }
    }
  }, [])

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
    addParticles(x, y, color)
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
    
    ctx.strokeStyle = tool === 'eraser' ? '#0a0518' : color
    ctx.lineWidth = brushSize
    ctx.globalAlpha = brushOpacity
    
    // Coordinate snapping/stabilization for shape accuracy
    let drawX = x
    let drawY = y

    if (stabilizeEnabled) {
      if (tool === 'line') {
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
      } else if (tool === 'rect') {
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

    if (tool === 'brush' || tool === 'eraser') {
      ctx.beginPath()
      ctx.moveTo(drawState.lastX, drawState.lastY)
      ctx.lineTo(drawX, drawY)
      ctx.stroke()
      drawState.lastX = drawX
      drawState.lastY = drawY
    } else {
      // Shape Preview (Restores offscreen buffer, previews shape vector)
      if (drawState.savedImageData) {
        ctx.putImageData(drawState.savedImageData, 0, 0)
      }
      
      ctx.beginPath()
      if (tool === 'line') {
        ctx.moveTo(drawState.startX, drawState.startY)
        ctx.lineTo(drawX, drawY)
        ctx.stroke()
      } else if (tool === 'rect') {
        const width = drawX - drawState.startX
        const height = drawY - drawState.startY
        ctx.strokeRect(drawState.startX, drawState.startY, width, height)
      } else if (tool === 'circle') {
        const radius = Math.sqrt(Math.pow(drawX - drawState.startX, 2) + Math.pow(drawY - drawState.startY, 2))
        ctx.arc(drawState.startX, drawState.startY, radius, 0, 2 * Math.PI)
        ctx.stroke()
      }
    }
  }

  const endDraw = () => {
    drawingRef.current.isDrawing = false
    drawingRef.current.savedImageData = null
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
    
    // Check if webcam is off; if so, clear the hand canvas but keep drawing particles!
    if (!isCameraOn) {
      hCtx.clearRect(0, 0, handCanvas.width, handCanvas.height)
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

    const isMirrored = settings.mirrorCamera === 'true'

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
      const currentAlpha = stabilizeEnabled && (tool !== 'brush' && tool !== 'eraser') ? 0.85 : 0.55

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
      addParticles(x, y, color)

      // Detect Gestures
      const isIndexUp = indexTip.y < indexPip.y
      const isMiddleUp = middleTip.y < middlePip.y

      let currentMode = 'None'

      if (isIndexUp && !isMiddleUp) {
        currentMode = 'Drawing'
        
        // Perform drawing actions
        if (!drawState.isDrawing) {
          startDraw(x, y)
        } else {
          drawMove(x, y)
        }
      } else if (isIndexUp && isMiddleUp) {
        currentMode = 'Hover'
        
        if (drawState.isDrawing) {
          endDraw()
        }
      } else {
        currentMode = 'None'
        if (drawState.isDrawing) {
          endDraw()
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
    ctx.fillStyle = color // Glow follows active color
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.lineWidth = 2

    const getX = (lm) => {
      const isMirrored = settings.mirrorCamera === 'true'
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
        {/* Left Side: Floating Canvas Toolbar */}
        <div className="glass-panel" style={styles.toolbar}>
          <h3 style={styles.toolbarTitle}>Tools</h3>
          
          <div style={styles.toolList}>
            <button 
              className={`glass-btn ${tool === 'brush' ? 'glass-btn-active' : ''}`}
              style={styles.toolBtn}
              onClick={() => setTool('brush')}
            >
              <Palette size={18} />
              <span>Paint</span>
            </button>
            <button 
              className={`glass-btn ${tool === 'line' ? 'glass-btn-active' : ''}`}
              style={styles.toolBtn}
              onClick={() => setTool('line')}
            >
              <Slash size={18} />
              <span>Line</span>
            </button>
            <button 
              className={`glass-btn ${tool === 'rect' ? 'glass-btn-active' : ''}`}
              style={styles.toolBtn}
              onClick={() => setTool('rect')}
            >
              <Square size={18} />
              <span>Rect</span>
            </button>
            <button 
              className={`glass-btn ${tool === 'circle' ? 'glass-btn-active' : ''}`}
              style={styles.toolBtn}
              onClick={() => setTool('circle')}
            >
              <CircleIcon size={18} />
              <span>Circle</span>
            </button>
            <button 
              className={`glass-btn ${tool === 'eraser' ? 'glass-btn-active' : ''}`}
              style={styles.toolBtn}
              onClick={() => setTool('eraser')}
            >
              <Eraser size={18} />
              <span>Eraser</span>
            </button>
          </div>

          <div style={styles.divider}></div>

          {/* Dynamic Shape Snap Stabilizer Toggle */}
          <div style={styles.controlGroup}>
            <button 
              className={`glass-btn ${stabilizeEnabled ? 'glass-btn-active' : ''}`}
              style={{ ...styles.toolBtn, justifyContent: 'center', padding: '8px' }}
              onClick={() => setStabilizeEnabled(!stabilizeEnabled)}
              title="Enhance drawing stability and snap lines/rectangles to perfect orientations"
            >
              <Crosshair size={16} />
              <span style={{ fontSize: '13px' }}>{stabilizeEnabled ? 'Stabilizer ON' : 'Stabilizer OFF'}</span>
            </button>
          </div>

          <div style={styles.divider}></div>

          {/* Size slider */}
          <div style={styles.controlGroup}>
            <label style={styles.controlLabel}>Size: {brushSize}px</label>
            <input 
              type="range"
              min="2"
              max="50"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              style={styles.range}
            />
          </div>

          {/* Opacity slider */}
          <div style={styles.controlGroup}>
            <label style={styles.controlLabel}>Opacity: {Math.round(brushOpacity * 100)}%</label>
            <input 
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={brushOpacity}
              onChange={(e) => setBrushOpacity(parseFloat(e.target.value))}
              style={styles.range}
            />
          </div>

          <div style={styles.divider}></div>

          {/* Colors */}
          <h3 style={styles.toolbarTitle}>Palette</h3>
          <div style={styles.colorPalette}>
            {PRESET_COLORS.map(c => (
              <button 
                key={c}
                style={{
                  ...styles.colorCircle(c),
                  border: color === c ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                  boxShadow: color === c ? `0 0 10px ${c}` : 'none'
                }}
                onClick={() => setColor(c)}
              />
            ))}
            <input 
              type="color" 
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={styles.colorPicker}
            />
          </div>
        </div>

        {/* Center: Canvas Area */}
        <div className="glass-panel" style={styles.canvasContainer}>
          <canvas 
            ref={canvasRef}
            width="800"
            height="500"
            style={styles.canvas}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
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
                width="800"
                height="500"
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
              <li><strong>Draw Gesture</strong>: Raise only your <strong>index finger</strong>. A line will trail your finger tip.</li>
              <li><strong>Hover Pointer Gesture</strong>: Raise both your <strong>index & middle fingers</strong> (like a 'V' peace sign) to move the pointer without drawing.</li>
              <li><strong>Stop Gesture</strong>: Fold all fingers or make a closed fist to stop.</li>
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
    maxWidth: '1280px',
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
  toolbar: {
    flex: '1 1 200px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    alignSelf: 'flex-start',
  },
  toolbarTitle: {
    fontFamily: 'var(--font-title)',
    fontSize: '16px',
    fontWeight: '700',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    color: 'var(--text-secondary)',
  },
  toolList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  toolBtn: {
    width: '100%',
    justifyContent: 'flex-start',
    padding: '10px 16px',
  },
  divider: {
    height: '1px',
    background: 'rgba(255, 255, 255, 0.08)',
    margin: '4px 0',
  },
  controlGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  controlLabel: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    fontWeight: '500',
  },
  range: {
    width: '100%',
    height: '4px',
    borderRadius: '2px',
    outline: 'none',
    background: 'rgba(255,255,255,0.1)',
    WebkitAppearance: 'none',
    cursor: 'pointer',
  },
  colorPalette: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
  },
  colorCircle: (c) => ({
    width: '100%',
    aspectRatio: '1',
    borderRadius: '50%',
    backgroundColor: c,
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.2s',
  }),
  colorPicker: {
    border: 'none',
    width: '100%',
    aspectRatio: '1',
    borderRadius: '50%',
    cursor: 'pointer',
    background: 'none',
  },
  canvasContainer: {
    flex: '3 1 650px',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0a0518',
    padding: '0',
    border: '1px solid rgba(255,255,255,0.1)',
    height: '502px',
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

