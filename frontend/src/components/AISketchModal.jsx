import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, HelpCircle, Key, Cpu, ToggleLeft, ToggleRight, Layers, ChevronDown, Image as ImageIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { BACKEND_URL } from '../App'
import { useToast } from './Toast'
import { getFriendlyErrorMessage } from '../utils/errorHelper'

export default function AISketchModal({
  isOpen,
  onClose,
  onApply,
  currentCanvasMode,
  styles = {}
}) {
  const { showToast } = useToast()
  const [prompt, setPrompt] = useState('')
  const [targetCanvas, setTargetCanvas] = useState('2d')
  const [modelId, setModelId] = useState('stabilityai/stable-diffusion-xl-base-1.0')
  const [hfToken, setHfToken] = useState(() => localStorage.getItem('hf_api_token') || '')
  const [useFallback, setUseFallback] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [serviceUsed, setServiceUsed] = useState('')
  const [isModelSelectOpen, setIsModelSelectOpen] = useState(false)
  const [showTokenHelp, setShowTokenHelp] = useState(false)

  // Auto-close model dropdown when clicking outside
  useEffect(() => {
    if (!isModelSelectOpen) return
    const handleGlobalClick = () => {
      setIsModelSelectOpen(false)
    }
    document.addEventListener('click', handleGlobalClick)
    return () => {
      document.removeEventListener('click', handleGlobalClick)
    }
  }, [isModelSelectOpen])

  // Limit States
  const [usageCount, setUsageCount] = useState(0)
  const [maxUsage, setMaxUsage] = useState(5)
  const [resetTime, setResetTime] = useState(null)
  const [countdownStr, setCountdownStr] = useState('')

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

  // Sync target canvas with active canvas mode on open
  useEffect(() => {
    if (isOpen) {
      setTargetCanvas(currentCanvasMode || '2d')
      setError('')
      setServiceUsed('')
      fetchUsage()
    }
  }, [isOpen, currentCanvasMode])

  // Countdown timer effect
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
    const timerId = setInterval(updateCountdown, 1000)
    return () => clearInterval(timerId)
  }, [resetTime, usageCount, maxUsage])

  // Save HF token to local storage when it changes
  const handleTokenChange = (val) => {
    setHfToken(val)
    localStorage.setItem('hf_api_token', val)
  }

  const handleGenerate = async (e) => {
    e.preventDefault()
    if (!prompt.trim() || usageCount >= maxUsage) return

    setGenerating(true)
    setError('')
    setServiceUsed('')

    const token = localStorage.getItem('token')

    try {
      const response = await fetch(`${BACKEND_URL}/api/ai-sketch/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          model_id: modelId,
          hf_token: hfToken.trim() || '',
          use_fallback: useFallback ? 'true' : 'false'
        })
      })

      const data = await response.json()
      if (!response.ok) {
        const errorMsg = typeof data.detail === 'object'
          ? (data.detail.msg || JSON.stringify(data.detail))
          : (data.detail || 'Failed to generate sketch');
        throw new Error(errorMsg);
      }

      setServiceUsed(data.service_used || 'AI Generator')
      if (data.usage_count !== undefined) {
        setUsageCount(data.usage_count)
        setMaxUsage(data.max_usage)
        setResetTime(data.reset_time)
      }
      
      // Trigger the animated drawing process in parent
      onApply({
        imageUrl: data.image_data,
        targetCanvas: targetCanvas,
        prompt: prompt.trim()
      })
      
      showToast(`AI Sketch outline for "${prompt.trim()}" generated!`, 'ai')
      onClose()
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Failed to connect to backend server.'));
      fetchUsage()
    } finally {
      setGenerating(false)
    }
  }

  const modelOptions = [
    { id: 'stabilityai/stable-diffusion-xl-base-1.0', name: 'Stable Diffusion XL 1.0 (HQ)' },
    { id: 'runwayml/stable-diffusion-v1-5', name: 'Stable Diffusion v1.5 (Fast)' },
    { id: 'black-forest-labs/FLUX.1-schnell', name: 'Flux.1 Schnell (Ultra HQ)' },
    { id: 'CompVis/stable-diffusion-v1-4', name: 'Stable Diffusion v1.4' }
  ]

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { duration: 0.2 } }
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            perspective: '1000px',
            pointerEvents: 'auto'
          }}
        >
          {/* Backdrop blur overlay */}
          <motion.div 
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1 }
            }}
            transition={{ duration: 0.25 }}
            className="modal-backdrop-glass"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: -1
            }}
            onClick={generating ? null : onClose}
          />

          {/* Dialog Content Box */}
          <motion.div
            variants={{
              hidden: { 
                opacity: 0, 
                scaleX: 0.35, 
                scaleY: 1.6, 
                borderRadius: "200px",
                y: 100,
                filter: "blur(10px)",
                transformOrigin: "center bottom"
              },
              visible: { 
                opacity: 1, 
                scaleX: 1, 
                scaleY: 1, 
                borderRadius: "24px",
                y: 0,
                filter: "blur(0px)",
                transformOrigin: "center bottom",
                transition: { 
                  y: {
                    type: 'spring',
                    stiffness: 300,
                    damping: 22,
                    mass: 0.8
                  },
                  scaleX: {
                    type: 'spring',
                    stiffness: 280,
                    damping: 14,
                    mass: 0.6
                  },
                  scaleY: {
                    type: 'spring',
                    stiffness: 280,
                    damping: 14,
                    mass: 0.6
                  },
                  borderRadius: {
                    duration: 0.38,
                    ease: 'easeOut'
                  },
                  filter: {
                    duration: 0.25
                  },
                  opacity: {
                    duration: 0.15
                  }
                }
              }
            }}
            className="glass-panel-heavy modal-content-scroll"
            style={{ ...styles.modalContent, maxWidth: '600px', transformStyle: 'preserve-3d', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={20} color="var(--theme-color-1)" className="spin-animation" style={{ animationDuration: '3s' }} />
                <h2 style={styles.modalTitle}>AI Sketch Generator</h2>
              </div>
              {!generating && (
                <button 
                  className="glass-btn" 
                  style={{ padding: '6px 10px', minWidth: 'auto', border: 'none', background: 'transparent' }} 
                  onClick={onClose}
                >
                  ✕
                </button>
              )}
            </div>

            <div style={{
              background: 'rgba(139, 92, 246, 0.05)',
              border: '1px solid rgba(139, 92, 246, 0.15)',
              padding: '12px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              color: 'rgba(255, 255, 255, 0.85)',
              lineHeight: '1.5',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <span style={{ fontWeight: 'bold', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={14} /> AI Sketch Plotter
              </span>
              <span>Tell the AI what to draw. The AI will generate a silhouette and <strong>plot it as an animated sketch over 2 minutes</strong>!</span>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.65)',
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              marginTop: '8px'
            }}>
              <span>Hourly Generation Limit:</span>
              <span style={{ fontWeight: 'bold', color: usageCount >= maxUsage ? '#f87171' : '#38bdf8' }}>
                {usageCount} / {maxUsage} sketches used
              </span>
            </div>

            {usageCount >= maxUsage && (
              <div style={{
                padding: '12px 14px',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#f87171',
                borderRadius: '8px',
                fontSize: '12px',
                lineHeight: '1.4',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                marginTop: '8px'
              }}>
                <span style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ⚠️ Rate Limit Reached
                </span>
                <span>You have reached the maximum of {maxUsage} AI sketch generations per hour. Please wait for the limit to reset.</span>
                {countdownStr && (
                  <span style={{ fontWeight: '700', color: '#fca5a5', marginTop: '2px' }}>
                    Resets in: {countdownStr}
                  </span>
                )}
              </div>
            )}

            <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
              {/* Prompt input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>
                  What should the AI sketch?
                </label>
                <input
                  type="text"
                  placeholder={usageCount >= maxUsage ? "Limit reached. Waiting for reset..." : "e.g. butterfly, futuristic car, coffee mug, cat silhouette..."}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="glass-input"
                  style={{ width: '100%' }}
                  disabled={generating || usageCount >= maxUsage}
                  required
                  autoFocus
                />
              </div>

              {/* Target Canvas Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>
                  Target Canvas Mode
                </span>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid ' + (targetCanvas === '2d' ? 'var(--theme-color-1)' : 'rgba(255,255,255,0.15)'),
                      background: targetCanvas === '2d' ? 'rgba(var(--theme-color-1-rgb), 0.15)' : 'transparent',
                      color: targetCanvas === '2d' ? 'var(--theme-color-1)' : 'rgba(255,255,255,0.7)',
                      cursor: (generating || usageCount >= maxUsage) ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    onClick={() => !(generating || usageCount >= maxUsage) && setTargetCanvas('2d')}
                    disabled={generating || usageCount >= maxUsage}
                  >
                    <span>2D Canvas</span>
                    <span style={{ fontSize: '10px', fontWeight: 'normal', opacity: 0.7 }}>Plot as 2D strokes</span>
                  </button>
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid ' + (targetCanvas === '3d' ? 'var(--theme-color-1)' : 'rgba(255,255,255,0.15)'),
                      background: targetCanvas === '3d' ? 'rgba(var(--theme-color-1-rgb), 0.15)' : 'transparent',
                      color: targetCanvas === '3d' ? 'var(--theme-color-1)' : 'rgba(255,255,255,0.7)',
                      cursor: (generating || usageCount >= maxUsage) ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    onClick={() => !(generating || usageCount >= maxUsage) && setTargetCanvas('3d')}
                    disabled={generating || usageCount >= maxUsage}
                  >
                    <span>3D Canvas</span>
                    <span style={{ fontSize: '10px', fontWeight: 'normal', opacity: 0.7 }}>Plot as 3D extruded wireframe</span>
                  </button>
                </div>
              </div>

              {/* Collapsible Advanced Settings (Hugging Face Configuration) */}
              <div style={{
                border: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.01)',
                padding: '14px',
                borderRadius: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.85)' }}>
                  <Cpu size={14} color="var(--theme-color-2)" />
                  <span>Hugging Face Settings</span>
                </div>

                {/* Model Select */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}>
                  <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                    Text-to-Image Model
                  </label>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!generating && usageCount < maxUsage) {
                        setIsModelSelectOpen(!isModelSelectOpen)
                      }
                    }}
                    className="glass-input"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--glass-border)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      color: '#fff',
                      cursor: (generating || usageCount >= maxUsage) ? 'not-allowed' : 'pointer',
                      outline: 'none',
                      textAlign: 'left'
                    }}
                    disabled={generating || usageCount >= maxUsage}
                  >
                    <span>
                      {modelOptions.find(o => o.id === modelId)?.name || 'Select Model'}
                    </span>
                    <ChevronDown 
                      size={14} 
                      style={{ 
                        transform: isModelSelectOpen ? 'rotate(180deg)' : 'rotate(0deg)', 
                        transition: 'transform 0.3s ease',
                        opacity: 0.7
                      }} 
                    />
                  </button>

                  {isModelSelectOpen && (
                    <div
                      className="glass-panel-heavy fade-in"
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '4px',
                        borderRadius: '12px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        background: 'rgba(15, 23, 42, 0.95)',
                        backdropFilter: 'blur(16px)',
                        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
                        zIndex: 100,
                        overflow: 'hidden',
                        padding: '4px'
                      }}
                    >
                      {modelOptions.map((opt) => {
                        const isSelected = opt.id === modelId
                        return (
                          <div
                            key={opt.id}
                            onClick={() => {
                              setModelId(opt.id)
                              setIsModelSelectOpen(false)
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '8px 12px',
                              fontSize: '12px',
                              color: isSelected ? 'var(--theme-color-1)' : '#fff',
                              cursor: 'pointer',
                              borderRadius: '8px',
                              background: isSelected 
                                ? 'rgba(255, 255, 255, 0.08)' 
                                : 'transparent',
                              transition: 'all 0.2s ease',
                              fontWeight: isSelected ? '600' : 'normal',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = isSelected 
                                ? 'rgba(255, 255, 255, 0.08)' 
                                : 'transparent'
                            }}
                          >
                            {opt.name}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* API Token Input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Key size={10} /> Hugging Face API Token (Optional)
                    </label>
                    <a 
                      href="https://huggingface.co/settings/tokens" 
                      target="_blank" 
                      rel="noreferrer" 
                      style={{ fontSize: '10px', color: 'var(--theme-color-2)', textDecoration: 'none' }}
                    >
                      Get Token ↗
                    </a>
                  </div>
                  <input
                    type="password"
                    placeholder="hf_..."
                    value={hfToken}
                    onChange={(e) => handleTokenChange(e.target.value)}
                    className="glass-input"
                    style={{ width: '100%', fontSize: '12px' }}
                    disabled={generating || usageCount >= maxUsage}
                  />
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', lineHeight: '1.3' }}>
                    Provide a Hugging Face token to avoid rate limits. It is saved locally in your browser.
                  </span>
                </div>

                {/* Fallback Checkbox */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: (generating || usageCount >= maxUsage) ? 'not-allowed' : 'pointer', fontSize: '12px', color: 'rgba(255,255,255,0.8)', marginTop: '4px' }}>
                  <input 
                    type="checkbox"
                    checked={useFallback}
                    onChange={(e) => setUseFallback(e.target.checked)}
                    disabled={generating || usageCount >= maxUsage}
                    style={{ cursor: (generating || usageCount >= maxUsage) ? 'not-allowed' : 'pointer', width: '14px', height: '14px' }}
                  />
                  <span>Fallback to free Pollinations AI if Hugging Face fails/loads</span>
                </label>
              </div>

              {error && (
                <div style={{
                  padding: '12px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#f87171',
                  borderRadius: '8px',
                  fontSize: '12px',
                  lineHeight: '1.4'
                }}>
                  ⚠️ {error}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                {!generating && (
                  <button 
                    type="button" 
                    className="glass-btn" 
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="glass-btn glass-btn-primary"
                  style={{
                    flex: generating ? 1 : 'none',
                    minWidth: '150px',
                    justifyContent: 'center',
                    background: (generating || usageCount >= maxUsage) ? 'rgba(var(--theme-color-1-rgb), 0.15)' : undefined
                  }}
                  disabled={generating || usageCount >= maxUsage || !prompt.trim()}
                >
                  {generating ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                      <span>AI Generating...</span>
                    </div>
                  ) : (
                    <>
                      <Sparkles size={14} style={{ marginRight: '6px' }} />
                      <span>Generate Sketch</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
