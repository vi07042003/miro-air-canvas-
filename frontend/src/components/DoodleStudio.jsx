import React, { useRef, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Wand2, Download, Trash2, Eraser, Paintbrush, RotateCcw } from 'lucide-react'
import { BACKEND_URL } from '../App'
import { useToast } from './Toast'

export default function DoodleStudio({ user }) {
  const { showToast } = useToast()
  
  const canvasRef = useRef(null)
  const isDrawingRef = useRef(false)
  const lastPosRef = useRef({ x: 0, y: 0 })

  // Drawing settings state
  const [brushColor, setBrushColor] = useState('#ffffff')
  const [brushSize, setBrushSize] = useState(4)
  const [activeTool, setActiveTool] = useState('brush') // 'brush' or 'eraser'

  // AI settings and status state
  const [prompt, setPrompt] = useState('')
  const [useFallback, setUseFallback] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [generatedImage, setGeneratedImage] = useState(null)
  const [error, setError] = useState('')
  const [serviceUsed, setServiceUsed] = useState('')
  const [sketchDescription, setSketchDescription] = useState('')
  const [detectedObject, setDetectedObject] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isDescriptionEdited, setIsDescriptionEdited] = useState(false)
  const [isCanvasBlank, setIsCanvasBlank] = useState(true)
  const analysisTimeoutRef = useRef(null)
  const lastAnalysisTimeRef = useRef(0)

  // Limit States
  const [usageCount, setUsageCount] = useState(0)
  const [maxUsage, setMaxUsage] = useState(10)
  const [resetTime, setResetTime] = useState(null)
  const [countdownStr, setCountdownStr] = useState('')

  const PRESET_COLORS = [
    { hex: '#ffffff', name: 'White' },
    { hex: '#00f2fe', name: 'Neon Cyan' },
    { hex: '#8b5cf6', name: 'Violet' },
    { hex: '#ec4899', name: 'Pink' },
    { hex: '#10b981', name: 'Emerald' },
    { hex: '#f59e0b', name: 'Amber' },
    { hex: '#ef4444', name: 'Red' }
  ]

  // Initialize canvas background
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    
    // Set display/drawing resolution matching element size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width || 800
    canvas.height = rect.height || 800
    
    // Fill canvas with default deep slate/black background
    ctx.fillStyle = '#0a0518'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    fetchUsage()
  }, [])

  // Fetch AI usage limits
  const fetchUsage = async () => {
    const token = localStorage.getItem('token')
    if (!token) return
    try {
      const response = await fetch(`${BACKEND_URL}/api/ai-sketch/usage`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setUsageCount(data.usage_count)
        setMaxUsage(data.max_usage)
        setResetTime(data.reset_time)
      }
    } catch (e) {
      console.error("Failed to fetch AI sketch usage:", e)
    }
  }

  // Countdown timer effect for rate limit
  useEffect(() => {
    if (!resetTime || usageCount < maxUsage) {
      setCountdownStr('')
      return
    }

    const updateCountdown = () => {
      const diff = new Date(resetTime) - new Date()
      if (diff <= 0) {
        setCountdownStr('')
        fetchUsage()
        return
      }
      const totalSecs = Math.floor(diff / 1000)
      const mins = Math.floor(totalSecs / 60)
      const secs = totalSecs % 60
      setCountdownStr(mins > 0 ? `${mins}m ${secs}s` : `${secs}s`)
    }

    updateCountdown()
    const timer = setInterval(updateCountdown, 1000)
    return () => clearInterval(timer)
  }, [resetTime, usageCount, maxUsage])

  // Resize listener to ensure canvas stays valid
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      
      // Save current content
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = canvas.width
      tempCanvas.height = canvas.height
      const tempCtx = tempCanvas.getContext('2d')
      tempCtx.drawImage(canvas, 0, 0)
      
      // Resize
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width || 800
      canvas.height = rect.height || 800
      
      // Restore content
      ctx.fillStyle = '#0a0518'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Drawing event handlers
  const getMousePos = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    }
  }

  const startDrawing = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    isDrawingRef.current = true
    setIsDescriptionEdited(false)
    setIsCanvasBlank(false)
    const pos = getMousePos(e)
    lastPosRef.current = pos
    
    // Draw dot on click
    const ctx = canvas.getContext('2d')
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2)
    ctx.fillStyle = activeTool === 'eraser' ? '#0a0518' : brushColor
    ctx.fill()
  }

  const draw = (e) => {
    if (!isDrawingRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const pos = getMousePos(e)

    ctx.beginPath()
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = activeTool === 'eraser' ? '#0a0518' : brushColor
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()

    lastPosRef.current = pos
  }

  const analyzeCurrentSketch = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const token = localStorage.getItem('token')
    if (!token) return

    const now = Date.now()
    const cooldown = 10000 // 10 seconds minimum interval to completely prevent 429
    const timeSinceLast = now - lastAnalysisTimeRef.current

    if (timeSinceLast < cooldown) {
      // Re-schedule the analysis to run when the cooldown expires
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current)
      }
      analysisTimeoutRef.current = setTimeout(() => {
        analyzeCurrentSketch()
      }, cooldown - timeSinceLast + 100)
      return
    }

    lastAnalysisTimeRef.current = now
    setIsAnalyzing(true)
    const sketchDataUrl = canvas.toDataURL('image/png')

    try {
      const res = await fetch(`${BACKEND_URL}/api/ai-sketch/analyze-doodle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          image_data: sketchDataUrl,
          hf_token: localStorage.getItem('hf_api_token') || ''
        })
      })

      if (res.ok) {
        const data = await res.json()
        setDetectedObject(data.sketch_description || '')
        setSketchDescription(data.sketch_description || '')
        if (data.gemini_status === 429) {
          showToast("Gemini Rate Limit Exceeded (429)! Please pause a moment between drawings.", "warning")
        } else if (data.gemini_status === 503) {
          showToast("Gemini Service Overloaded (503). Using alternative models...", "info")
        }
      }
    } catch (err) {
      console.error("Failed to analyze sketch:", err)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const stopDrawing = () => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#0a0518'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setDetectedObject('')
    setSketchDescription('')
    setIsCanvasBlank(true)
    if (analysisTimeoutRef.current) {
      clearTimeout(analysisTimeoutRef.current)
    }
    showToast("Canvas cleared!", "info")
  }

  // Reset generated artwork
  const resetArtwork = () => {
    setGeneratedImage(null)
    setError('')
    setServiceUsed('')
    setSketchDescription('')
    setDetectedObject('')
    setIsCanvasBlank(true)
    if (analysisTimeoutRef.current) {
      clearTimeout(analysisTimeoutRef.current)
    }
    showToast('Artwork cleared', 'info')
  }

  // AI Art Generation
  const handleGenerateArt = async (e) => {
    if (e) e.preventDefault()
    
    const canvas = canvasRef.current
    if (!canvas) return

    setGenerating(true)
    setError('')
    setGeneratedImage(null)

    const token = localStorage.getItem('token')
    if (!token) {
      setError("Please sign in to use this feature.")
      setGenerating(false)
      return
    }

    // Capture sketch as PNG
    const sketchDataUrl = canvas.toDataURL('image/png')

    try {
      const res = await fetch(`${BACKEND_URL}/api/ai-sketch/doodle-to-art`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          image_data: sketchDataUrl,
          use_fallback: useFallback,
          sketch_description: detectedObject || sketchDescription || '',
          hf_token: localStorage.getItem('hf_api_token') || ''
        })
      })

      if (res.ok) {
        const data = await res.json()
        setGeneratedImage(data.image_data)
        setServiceUsed(data.service_used)
        setSketchDescription(data.sketch_description || '')
        setDetectedObject(data.sketch_description || '')
        setUsageCount(data.usage_count)
        setMaxUsage(data.max_usage)
        if (data.reset_time) setResetTime(data.reset_time)
        showToast("Artwork generated successfully!", "success")
      } else {
        const data = await res.json()
        setError(data.detail || "Failed to generate artwork. Please try again.")
        showToast("Generation failed", "error")
      }
    } catch (err) {
      console.error(err)
      setError("Failed to connect to backend server.")
      showToast("Server connection error", "error")
    } finally {
      setGenerating(false)
    }
  }

  const downloadArtwork = () => {
    if (!generatedImage) return
    const link = document.createElement('a')
    link.href = generatedImage
    link.download = `miro_doodle_art_${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast("Artwork downloaded!", "success")
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '20px',
      height: 'calc(100vh - 165px)',
      maxWidth: '1500px',
      margin: '0 auto',
      width: '100%',
      color: '#fff',
      paddingBottom: '10px'
    }}>
      {/* Left Workspace: 2D Doodle Draw Canvas */}
      <motion.div 
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="glass-panel-heavy"
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '20px',
          borderRadius: '24px',
          height: '100%',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Paintbrush size={20} color="var(--theme-color-1)" />
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '0.5px' }}>Doodle Canvas</h2>
          </div>
          <button 
            onClick={clearCanvas} 
            className="glass-btn" 
            title="Clear drawing"
            style={{ padding: '6px 12px', minWidth: 'auto', display: 'flex', alignItems: 'center', gap: '6px', borderColor: 'rgba(239, 68, 68, 0.3)' }}
          >
            <Trash2 size={14} color="#f87171" />
            <span style={{ color: '#f87171', fontSize: '12px' }}>Clear</span>
          </button>
        </div>

        {/* Drawing Workspace Area */}
        <div style={{
          flex: 1,
          position: 'relative',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.1)',
          background: '#0a0518',
          overflow: 'hidden',
          cursor: activeTool === 'eraser' ? 'cell' : 'crosshair'
        }}>
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        </div>

        {/* Real-time AI Sketch Detection Preview */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginTop: '12px',
          padding: '8px 16px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          fontSize: '12px',
          minHeight: '38px',
          boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.03)'
        }}>
          <Sparkles 
            size={14} 
            color="var(--theme-color-1)" 
            style={{ 
              animation: isAnalyzing ? 'doodle-spin 1s linear infinite' : 'none' 
            }} 
          />
          <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>AI Detection Preview:</span>
          {isAnalyzing ? (
            <span style={{ 
              color: 'var(--theme-color-1)', 
              fontStyle: 'italic', 
              animation: 'doodle-pulse 1s infinite alternate' 
            }}>
              Analyzing sketch...
            </span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
              <input
                type="text"
                value={detectedObject}
                onChange={(e) => {
                  setDetectedObject(e.target.value)
                  setSketchDescription(e.target.value)
                  setIsDescriptionEdited(true)
                }}
                placeholder="Draw a simple object to detect shape..."
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: detectedObject ? 'var(--theme-color-1)' : 'rgba(255,255,255,0.4)',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  outline: 'none',
                  padding: '2px 0'
                }}
              />
              {detectedObject ? (
                <span style={{ fontSize: '10px', opacity: 0.35, fontStyle: 'italic' }}>
                  (click to edit description)
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (analysisTimeoutRef.current) {
                      clearTimeout(analysisTimeoutRef.current)
                    }
                    analyzeCurrentSketch()
                  }}
                  disabled={isAnalyzing || isCanvasBlank}
                  title={isCanvasBlank ? "Please draw something on the canvas first" : "Analyze sketch"}
                  className="glass-btn"
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    marginLeft: 'auto',
                    minWidth: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderColor: isCanvasBlank ? 'rgba(255,255,255,0.1)' : 'var(--theme-color-1)',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '8px',
                    cursor: isCanvasBlank ? 'not-allowed' : 'pointer',
                    opacity: isCanvasBlank ? 0.4 : 1
                  }}
                >
                  <Sparkles size={11} color={isCanvasBlank ? "rgba(255,255,255,0.3)" : "var(--theme-color-1)"} />
                  <span style={{ color: isCanvasBlank ? "rgba(255,255,255,0.3)" : "var(--theme-color-1)", fontWeight: '600' }}>Analyze Sketch</span>
                </button>
              )}
            </div>
          )}
        </div>
        
        {/* User Guidance / Rate-limit Helper Tip */}
        <div style={{ 
          fontSize: '11px', 
          color: 'rgba(255, 255, 255, 0.4)', 
          marginTop: '6px', 
          padding: '0 6px',
          fontStyle: 'italic',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '6px',
          lineHeight: '1.4'
        }}>
          <span style={{ color: 'var(--theme-color-1)' }}>💡</span>
          <span><strong>Tip:</strong> Click <strong>"Analyze Sketch"</strong> first to let the AI understand your drawing, then click <strong>"Generate Art"</strong> to create your image!</span>
        </div>

        {/* Drawing Toolbar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '16px',
          paddingTop: '14px',
          borderTop: '1px solid rgba(255,255,255,0.06)'
        }}>
          {/* Tool selection */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`glass-btn ${activeTool === 'brush' ? 'glass-btn-primary' : ''}`}
              onClick={() => setActiveTool('brush')}
              title="Paintbrush Tool"
              style={{ padding: '8px', minWidth: 'auto' }}
            >
              <Paintbrush size={16} />
            </button>
            <button
              className={`glass-btn ${activeTool === 'eraser' ? 'glass-btn-primary' : ''}`}
              onClick={() => setActiveTool('eraser')}
              title="Eraser Tool"
              style={{ padding: '8px', minWidth: 'auto' }}
            >
              <Eraser size={16} />
            </button>
          </div>

          {/* Color palette */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {PRESET_COLORS.map(c => (
              <button
                key={c.name}
                onClick={() => {
                  setBrushColor(c.hex)
                  setActiveTool('brush')
                }}
                title={c.name}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: c.hex,
                  border: brushColor === c.hex && activeTool === 'brush' ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                  cursor: 'pointer',
                  transform: brushColor === c.hex && activeTool === 'brush' ? 'scale(1.15)' : 'scale(1)',
                  transition: 'all 0.15s ease'
                }}
              />
            ))}
            <input
              type="color"
              value={brushColor}
              onChange={(e) => {
                setBrushColor(e.target.value)
                setActiveTool('brush')
              }}
              title="Custom Color"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: '0'
              }}
            />
          </div>

          {/* Brush size */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Size:</span>
            <input
              type="range"
              min="1"
              max="24"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              style={{
                width: '80px',
                cursor: 'pointer',
                accentColor: 'var(--theme-color-1)'
              }}
            />
            <span style={{ fontSize: '11px', width: '20px', textAlign: 'right' }}>{brushSize}px</span>
          </div>
        </div>
      </motion.div>

      {/* Right Workspace: AI Control Panel & Generative Output */}
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="glass-panel-heavy"
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '20px',
          borderRadius: '24px',
          height: '100%',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wand2 size={20} color="var(--theme-color-1)" className="pulse-animation" />
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '0.5px' }}>AI Artwork Studio</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {generatedImage && (
              <button
                onClick={resetArtwork}
                className="glass-btn"
                title="Reset artwork"
                style={{ padding: '5px 10px', minWidth: 'auto', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px' }}
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>
            )}
            <div style={{
              fontSize: '11px',
              color: 'rgba(255, 255, 255, 0.65)',
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '5px 10px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <span>Hourly Sketch Limit: </span>
              <span style={{ fontWeight: 'bold', color: usageCount >= maxUsage ? '#f87171' : 'var(--theme-color-1)' }}>
                {usageCount} / {maxUsage}
              </span>
            </div>
          </div>
        </div>

        {/* Rate limit exceeded warning */}
        {usageCount >= maxUsage && (
          <div style={{
            padding: '10px 12px',
            background: 'rgba(var(--theme-color-1-rgb), 0.08)',
            border: '1px solid rgba(var(--theme-color-1-rgb), 0.25)',
            color: 'var(--theme-color-1)',
            borderRadius: '8px',
            fontSize: '12px',
            marginBottom: '10px',
            lineHeight: '1.4'
          }}>
            <span>⚠️ Hourly limit reached. Please wait {countdownStr || 'a few minutes'} to generate again.</span>
          </div>
        )}

        {/* Generative Output Display */}
        <div style={{
          flex: 1,
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative'
        }}>
          {generating ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
              {/* Star-orbit loader — matches AI Stencil modal style */}
              <div style={{ position: 'relative', width: '72px', height: '72px' }}>
                {/* Outer spinning ring */}
                <div style={{
                  position: 'absolute', inset: 0,
                  borderRadius: '50%',
                  border: '2px solid rgba(var(--theme-color-1-rgb), 0.15)',
                  borderTopColor: 'var(--theme-color-1)',
                  animation: 'doodle-spin 1.1s linear infinite'
                }} />
                {/* Inner counter-spin ring */}
                <div style={{
                  position: 'absolute', inset: '10px',
                  borderRadius: '50%',
                  border: '2px solid rgba(var(--theme-color-2-rgb), 0.15)',
                  borderBottomColor: 'var(--theme-color-2)',
                  animation: 'doodle-spin-rev 0.8s linear infinite'
                }} />
                {/* Orbiting star dot */}
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  width: '8px', height: '8px',
                  marginTop: '-4px', marginLeft: '-4px',
                  borderRadius: '50%',
                  background: 'var(--theme-color-1)',
                  boxShadow: '0 0 10px var(--theme-color-1)',
                  animation: 'doodle-orbit 1.1s linear infinite'
                }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: 'var(--theme-color-1)', fontWeight: '600', marginBottom: '4px' }}>
                  Analysing &amp; Rendering...
                </p>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                  AI is reading your sketch
                </p>
              </div>
            </div>
          ) : generatedImage ? (
            <img 
              src={generatedImage} 
              alt="AI Artwork" 
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
            />
          ) : error ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--theme-color-1)', fontSize: '13px' }}>
              <p style={{ fontWeight: '600', marginBottom: '6px' }}>Error</p>
              <p style={{ opacity: 0.85 }}>{error}</p>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '13px', padding: '20px' }}>
              <Sparkles size={36} style={{ opacity: 0.3, marginBottom: '8px' }} />
              <p>Your finished rendering will appear here</p>
              <p style={{ fontSize: '11px', opacity: 0.5, marginTop: '4px' }}>Draw on the canvas — AI will analyse your sketch automatically</p>
            </div>
          )}
        </div>

        {/* Sketch Description Badge */}
        {sketchDescription && (
          <div style={{
            marginTop: '10px',
            padding: '8px 12px',
            background: 'rgba(var(--theme-color-1-rgb), 0.06)',
            border: '1px solid rgba(var(--theme-color-1-rgb), 0.2)',
            borderRadius: '8px',
            fontSize: '11px',
            color: 'rgba(255,255,255,0.7)',
            lineHeight: '1.4'
          }}>
            <span style={{ color: 'var(--theme-color-1)', fontWeight: '600' }}>🎨 AI detected: </span>
            {sketchDescription}
          </div>
        )}

        {/* Prompt Input Form */}
        <form onSubmit={handleGenerateArt} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>
              Style instructions <span style={{ fontWeight: '400', opacity: 0.6 }}>(optional)</span>
            </label>
            <input
              type="text"
              placeholder={usageCount >= maxUsage ? "Limit reached..." : "e.g. oil painting style, watercolour, anime, photorealistic..."}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="glass-input"
              style={{ width: '100%', fontSize: '13px', padding: '10px 14px' }}
              disabled={generating || usageCount >= maxUsage}
            />
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {generatedImage && (
                <button
                  type="button"
                  className="glass-btn"
                  onClick={downloadArtwork}
                  style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download size={14} />
                  <span>Download</span>
                </button>
              )}
            </div>

            <button
              type="submit"
              className="glass-btn glass-btn-primary"
              disabled={generating || usageCount >= maxUsage || !detectedObject}
              title={!detectedObject ? "Please click 'Analyze Sketch' first" : "Generate artwork"}
              style={{
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: (!detectedObject && !generating) ? 0.4 : 1,
                cursor: !detectedObject ? 'not-allowed' : 'pointer'
              }}
            >
              {generating ? (
                <>
                  <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                  <span>Rendering...</span>
                </>
              ) : (
                <>
                  <Wand2 size={14} />
                  <span>Generate Art</span>
                </>
              )}
            </button>
          </div>
        </form>

        {serviceUsed && (
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textAlign: 'right', marginTop: '8px' }}>
            Model: {serviceUsed}
          </div>
        )}
      </motion.div>

      <style>{`
        @keyframes doodle-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes doodle-spin-rev {
          to { transform: rotate(-360deg); }
        }
        @keyframes doodle-orbit {
          0%   { transform: translateX(28px) rotate(0deg);   }
          100% { transform: translateX(28px) rotate(360deg); }
        }
        @keyframes doodle-pulse {
          from { opacity: 0.4; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
