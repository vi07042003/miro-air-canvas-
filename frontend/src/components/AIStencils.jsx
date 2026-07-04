import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, ArrowRight, Download, HelpCircle, RefreshCw, Layers, Check, Search } from 'lucide-react'
import { BACKEND_URL } from '../App'
import { useToast } from './Toast'

export default function AIStencils({ user, onApplyStencil }) {
  const { showToast } = useToast()
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [usage, setUsage] = useState({ count: 0, max: 10, resetTime: '' })

  const inspirationIdeas = [
    { label: '🚀 Rocket Ship', text: 'rocket ship' },
    { label: '🦋 Butterfly', text: 'butterfly' },
    { label: '⭐ Star Outline', text: 'star shape outline' },
    { label: '🐱 Cute Cat', text: 'cute cartoon cat face' },
    { label: '🏰 Castle', text: 'medieval castle' },
    { label: '🌲 Pine Tree', text: 'pine tree outline' }
  ]

  const fetchUsage = async () => {
    if (!user || !user.token) return
    try {
      const response = await fetch(`${BACKEND_URL}/api/stencil/usage`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setUsage({ count: data.usage_count, max: data.max_usage, resetTime: data.reset_time })
      }
    } catch (err) {
      console.error("Failed to fetch stencil usage:", err)
    }
  }

  useEffect(() => {
    fetchUsage()
  }, [user])

  const handleGenerate = async (e) => {
    if (e) e.preventDefault()
    const promptKeyword = keyword.trim()
    if (!promptKeyword) return

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch(`${BACKEND_URL}/api/stencil/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ keyword: promptKeyword })
      })

      const data = await response.json()
      if (!response.ok) {
        setError(data.detail || 'Failed to generate stencil')
      } else {
        // Fetch the image from the returned stencil_url in the browser to avoid server timeout
        const imgRes = await fetch(data.stencil_url)
        if (!imgRes.ok) throw new Error("Failed to load image from generator")
        const blob = await imgRes.blob()
        const base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })

        setResult(base64Data)
        setUsage({ count: data.usage_count, max: data.max_usage, resetTime: data.reset_time })
        showToast(`AI Stencil for "${promptKeyword}" generated!`, 'ai')
      }
    } catch (err) {
      setError(err.message === "Failed to load image from generator"
        ? 'Failed to fetch the image from AI service. Please try again.'
        : 'Network error. Failed to connect to server.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (!result) return
    const link = document.createElement('a')
    link.href = result
    link.download = `miro-stencil-${keyword.replace(/\s+/g, '-') || 'stencil'}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast("AI Stencil PNG downloaded!", "download")
  }

  const formatResetTime = (isoString) => {
    if (!isoString) return ''
    try {
      const dateObj = isoString.endsWith('Z') ? new Date(isoString) : new Date(isoString + 'Z')
      if (isNaN(dateObj.getTime())) return ''
      return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch (e) {
      return ''
    }
  }

  const usagePercentage = Math.min(100, (usage.count / usage.max) * 100)

  return (
    <div style={styles.pageContainer}>
      {/* Page Header */}
      <div style={styles.header}>
        <div style={styles.headerTitleRow}>
          <div className="logo-icon" style={{ padding: '8px', width: '48px', height: '48px' }}>
            <Sparkles size={24} color="#ffffff" />
          </div>
          <div>
            <h1 style={styles.title}>AI Stencils</h1>
            <p style={styles.subtitle}>Generate custom tracing guidelines using AI prompts and overlay them on your canvas</p>
          </div>
        </div>
      </div>

      <div style={styles.contentGrid}>
        {/* Left Column - Forms & Limits */}
        <div style={styles.leftColumn}>
          <div className="glass-panel-heavy" style={{ ...styles.panel, flex: 1 }}>
            <h3 style={styles.panelTitle}>Describe Stencil</h3>
            <form onSubmit={handleGenerate} style={styles.form}>
              <div style={styles.inputContainer}>
                <input
                  type="text"
                  placeholder="e.g. rocket ship, butterfly, dinosaur..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="glass-input"
                  style={styles.input}
                  disabled={loading || usage.count >= usage.max}
                />
                <button
                  type="submit"
                  className="glass-btn glass-btn-primary"
                  style={styles.generateBtn}
                  disabled={loading || !keyword.trim() || usage.count >= usage.max}
                >
                  {loading ? (
                    <RefreshCw className="spin-animation" size={18} style={styles.spinner} />
                  ) : (
                    <>
                      <span>Generate</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Inspiration Prompt Chips */}
            <div style={styles.inspirationSection}>
              <span style={styles.sectionLabel}>Try an Idea:</span>
              <div style={styles.chipGrid}>
                {inspirationIdeas.map((idea, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      if (!loading && usage.count < usage.max) {
                        setKeyword(idea.text)
                      }
                    }}
                    className="glass-btn"
                    style={{
                      ...styles.chip,
                      borderColor: keyword === idea.text ? 'var(--theme-color-2)' : 'rgba(255, 255, 255, 0.08)'
                    }}
                    disabled={loading || usage.count >= usage.max}
                  >
                    {idea.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Usage Limit Tracker */}
          <div className="glass-panel-heavy" style={styles.panel}>
            <div style={styles.usageHeader}>
              <h3 style={{ ...styles.panelTitle, marginBottom: 0 }}>Generations Limit</h3>
              <span style={styles.usageCounter}>{usage.count} / {usage.max} used</span>
            </div>
            
            <div style={styles.progressContainer}>
              <div style={styles.progressTrack}>
                <div 
                  style={{ 
                    ...styles.progressBar, 
                    width: `${usagePercentage}%`,
                    background: usage.count >= usage.max 
                      ? 'linear-gradient(90deg, #ef4444, #f43f5e)'
                      : 'linear-gradient(90deg, var(--theme-color-1) 0%, var(--theme-color-2) 100%)'
                  }} 
                />
              </div>
            </div>

            {usage.resetTime && (
              <p style={styles.usageTip}>
                Your rolling 24-hour limit resets at <strong>{formatResetTime(usage.resetTime)}</strong>.
              </p>
            )}

            {usage.count >= usage.max && (
              <div style={styles.limitWarning}>
                ⚠️ You've reached your free generations limit. Please wait for the reset time to generate more stencils.
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Preview & Actions */}
        <div style={styles.rightColumn}>
          <div className="glass-panel-heavy" style={{ ...styles.panel, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 style={styles.panelTitle}>Stencil Preview</h3>
            
            <div style={styles.previewViewport}>
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.div
                    key="generating"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={styles.loadingState}
                  >
                    <div style={styles.scanLines} />
                    {/* Star Animation for AI */}
                    <div style={{ position: 'relative', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                      {/* Outer rotating pulse ring */}
                      <motion.div
                        animate={{ rotate: 360, scale: [1, 1.08, 1] }}
                        transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                        style={{
                          position: 'absolute',
                          width: '74px',
                          height: '74px',
                          borderRadius: '50%',
                          border: '2px dashed var(--theme-color-2)',
                          opacity: 0.35,
                        }}
                      />
                      {/* Inner glowing pulse ring */}
                      <motion.div
                        animate={{ scale: [1, 1.25, 1], opacity: [0.15, 0.35, 0.15] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                        style={{
                          position: 'absolute',
                          width: '54px',
                          height: '54px',
                          borderRadius: '50%',
                          background: 'radial-gradient(circle, var(--theme-color-2) 0%, transparent 75%)',
                        }}
                      />
                      {/* Main Sparkles Icon */}
                      <motion.div
                        animate={{ 
                          scale: [1, 1.15, 1],
                          rotate: [0, 8, -8, 0]
                        }}
                        transition={{ 
                          duration: 3, 
                          repeat: Infinity, 
                          ease: "easeInOut" 
                        }}
                        style={{ zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Sparkles size={42} style={{ color: 'var(--theme-color-2)', filter: 'drop-shadow(0 0 8px rgba(var(--theme-color-2-rgb), 0.5))' }} />
                      </motion.div>
                      {/* Tiny twinkling star 1 */}
                      <motion.div
                        animate={{ 
                          scale: [0, 1.1, 0],
                          x: [-24, -28, -24],
                          y: [-18, -22, -18],
                          opacity: [0, 0.9, 0]
                        }}
                        transition={{ 
                          duration: 1.8, 
                          repeat: Infinity, 
                          delay: 0.2,
                          ease: "easeInOut" 
                        }}
                        style={{ position: 'absolute', display: 'flex' }}
                      >
                        <Sparkles size={14} style={{ color: 'var(--theme-color-1)', filter: 'drop-shadow(0 0 4px rgba(var(--theme-color-1-rgb), 0.4))' }} />
                      </motion.div>
                      {/* Tiny twinkling star 2 */}
                      <motion.div
                        animate={{ 
                          scale: [0, 1.1, 0],
                          x: [24, 28, 24],
                          y: [16, 20, 16],
                          opacity: [0, 0.9, 0]
                        }}
                        transition={{ 
                          duration: 2.2, 
                          repeat: Infinity, 
                          delay: 0.7,
                          ease: "easeInOut" 
                        }}
                        style={{ position: 'absolute', display: 'flex' }}
                      >
                        <Sparkles size={16} style={{ color: 'var(--theme-color-1)', filter: 'drop-shadow(0 0 4px rgba(var(--theme-color-1-rgb), 0.4))' }} />
                      </motion.div>
                    </div>
                    <p style={styles.previewText}>AI is crafting your stencil...</p>
                    <p style={styles.previewSubtext}>This usually takes about 5-10 seconds</p>
                  </motion.div>
                ) : result ? (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    style={styles.resultContainer}
                  >
                    <div style={styles.stencilImageWrapper}>
                      <img
                        src={result}
                        alt="AI Stencil Result"
                        style={styles.stencilImage}
                      />
                    </div>
                  </motion.div>
                ) : error ? (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={styles.emptyState}
                  >
                    <div style={{ ...styles.errorIcon, color: '#f87171' }}>⚠️</div>
                    <p style={styles.previewText}>{error}</p>
                    <button onClick={() => setError('')} className="glass-btn" style={{ marginTop: '12px' }}>
                      Try Again
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={styles.emptyState}
                  >
                    <Layers size={48} style={{ opacity: 0.2, color: '#fff', marginBottom: '16px' }} />
                    <p style={styles.previewText}>No stencil loaded</p>
                    <p style={styles.previewSubtext}>Enter a keyword and click generate to visualize your stencil template</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Action buttons below viewport */}
            {result && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={styles.actionsBar}
              >
                <button 
                  onClick={() => onApplyStencil(result)}
                  className="glass-btn glass-btn-primary" 
                  style={styles.applyBtn}
                >
                  <Check size={18} />
                  <span>Apply Stencil to Canvas</span>
                </button>

                <button 
                  onClick={handleDownload} 
                  className="glass-btn" 
                  style={styles.downloadBtnAction}
                  title="Download Stencil"
                >
                  <Download size={18} />
                  <span>Download PNG</span>
                </button>

                <button 
                  onClick={() => setResult(null)} 
                  className="glass-btn" 
                  style={styles.resetBtn}
                >
                  Reset
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  pageContainer: {
    width: '100%',
    maxWidth: '100%',
    margin: '0 auto',
    padding: '0',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    height: 'calc(100vh - 150px)',
    minHeight: '500px',
    overflow: 'hidden'
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  headerTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: '36px',
    fontWeight: '500',
    margin: 0,
    background: 'linear-gradient(135deg, #ffffff 40%, #a1a1aa 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    fontFamily: 'var(--font-body)',
    fontSize: '15px',
    color: 'var(--text-secondary)',
    margin: '4px 0 0 0',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '420px 1fr',
    gap: '30px',
    alignItems: 'stretch',
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  leftColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    height: '100%',
  },
  rightColumn: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  panel: {
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  panelTitle: {
    fontFamily: 'var(--font-title)',
    fontSize: '18px',
    fontWeight: '700',
    margin: '0 0 8px 0',
    color: '#ffffff',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    display: 'flex',
    gap: '12px',
    width: '100%',
  },
  input: {
    flex: 1,
  },
  generateBtn: {
    minWidth: '120px',
    justifyContent: 'center',
  },
  spinner: {
    animation: 'spin 1s linear infinite',
  },
  inspirationSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '8px',
  },
  sectionLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-accent)',
  },
  chipGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },
  chip: {
    padding: '8px 14px',
    fontSize: '13px',
    borderRadius: '10px',
    background: 'rgba(255, 255, 255, 0.02)',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
  },
  usageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  usageCounter: {
    fontFamily: 'var(--font-accent)',
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--theme-color-2)',
  },
  progressContainer: {
    width: '100%',
  },
  progressTrack: {
    width: '100%',
    height: '8px',
    background: 'rgba(255, 255, 255, 0.04)',
    borderRadius: '99px',
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  progressBar: {
    height: '100%',
    borderRadius: '99px',
    transition: 'width 0.4s ease-out',
  },
  usageTip: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    margin: '4px 0 0 0',
  },
  limitWarning: {
    padding: '12px 16px',
    background: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    color: '#f87171',
    borderRadius: '12px',
    fontSize: '13px',
    lineHeight: '1.4',
    marginTop: '6px',
  },
  previewViewport: {
    flex: 1,
    minHeight: '340px',
    borderRadius: '18px',
    background: 'rgba(0, 0, 0, 0.35)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    textAlign: 'center',
    zIndex: 2,
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    textAlign: 'center',
    zIndex: 2,
  },
  scanLines: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
    backgroundSize: '100% 4px, 6px 100%',
    pointerEvents: 'none',
    opacity: 0.4,
  },
  previewText: {
    fontFamily: 'var(--font-title)',
    fontSize: '16px',
    fontWeight: '600',
    color: '#ffffff',
    margin: '0 0 6px 0',
  },
  previewSubtext: {
    fontFamily: 'var(--font-body)',
    fontSize: '13px',
    color: 'var(--text-muted)',
    margin: 0,
    maxWidth: '280px',
    lineHeight: '1.4',
  },
  errorIcon: {
    fontSize: '32px',
    marginBottom: '12px',
  },
  resultContainer: {
    width: '100%',
    height: '100%',
    padding: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  stencilImageWrapper: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    filter: 'drop-shadow(0 0 15px rgba(6, 182, 212, 0.3))',
  },
  stencilImage: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    filter: 'invert(1) drop-shadow(0 0 10px rgba(6, 182, 212, 0.5))',
  },
  actionsBar: {
    display: 'flex',
    gap: '12px',
    marginTop: '20px',
  },
  applyBtn: {
    flex: 2,
    justifyContent: 'center',
    background: 'linear-gradient(135deg, var(--theme-color-2) 0%, var(--theme-color-1) 100%)',
    border: 'none',
    boxShadow: '0 4px 15px rgba(6, 182, 212, 0.3)',
    color: '#ffffff',
  },
  downloadBtnAction: {
    flex: 1.2,
    justifyContent: 'center',
  },
  resetBtn: {
    flex: 0.8,
    justifyContent: 'center',
    background: 'rgba(255, 255, 255, 0.02)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  }
}
