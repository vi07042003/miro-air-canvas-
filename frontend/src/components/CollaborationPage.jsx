import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Sparkles, Copy, Check, ArrowRight, Play, RefreshCw } from 'lucide-react'
import { useToast } from './Toast'

export default function CollaborationPage({
  user,
  createRoom,
  joinRoom,
  checkRoomExists,
  onStartCanvas
}) {
  const { showToast } = useToast()
  const [roomInput, setRoomInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [generatedCode, setGeneratedCode] = useState('')

  const handleCreate = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const code = await createRoom()
      if (code) {
        setGeneratedCode(code)
        showToast('Collaboration room created successfully!', 'success')
      } else {
        setErrorMsg('Failed to create collaboration room.')
      }
    } catch (err) {
      setErrorMsg('An error occurred while creating room.')
    } finally {
      setLoading(false)
    }
  }

  const handleJoinGenerated = () => {
    if (!generatedCode) return
    joinRoom(generatedCode)
    onStartCanvas()
  }

  const handleJoin = async (e) => {
    if (e) e.preventDefault()
    const code = roomInput.trim().toUpperCase()
    if (!code) {
      setErrorMsg('Please enter a room code.')
      return
    }

    if (!code.startsWith('AER-') && code.length === 6) {
      setErrorMsg('Format should be AER-XXX (e.g. AER-982).')
      return
    }

    setLoading(true)
    setErrorMsg('')
    try {
      const exists = await checkRoomExists(code)
      if (exists) {
        joinRoom(code)
        onStartCanvas()
        showToast(`Joined session ${code}!`, 'success')
      } else {
        setErrorMsg('Room not found or session has expired.')
      }
    } catch (err) {
      setErrorMsg('Connection error checking room status.')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = () => {
    if (!generatedCode) return
    navigator.clipboard.writeText(generatedCode)
    setCopied(true)
    showToast('Room code copied to clipboard!', 'success')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={styles.pageContainer}>
      {/* Page Header */}
      <div style={styles.header}>
        <div style={styles.headerTitleRow}>
          <div className="logo-icon" style={{ padding: '8px', width: '48px', height: '48px' }}>
            <Users size={24} color="#ffffff" />
          </div>
          <div>
            <h1 style={styles.title}>Live Collaboration</h1>
            <p style={styles.subtitle}>Draw, paint, and collaborate with your friends in real-time on a shared virtual canvas</p>
          </div>
        </div>
      </div>

      <div style={styles.contentGrid}>
        {/* Left Column - Create Room */}
        <div style={styles.column}>
          <div className="glass-panel-heavy" style={styles.panel}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={styles.iconWrapper}>
                <Sparkles size={20} color="var(--theme-color-1)" />
              </div>
              <h3 style={styles.panelTitle}>Start a New Session</h3>
            </div>
            
            <p style={styles.introText}>
              Initialize a brand new multiplayer drawing canvas. You'll receive a unique room code that you can share with your friends to draw together.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
              {!generatedCode ? (
                <motion.button 
                  className="glass-btn glass-btn-primary" 
                  style={styles.actionBtn}
                  onClick={handleCreate}
                  disabled={loading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="spin-animation" size={16} style={{ marginRight: '8px' }} />
                      <span>Creating room...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Session Room</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </motion.button>
              ) : (
                <div style={styles.codeOutputContainer}>
                  <div style={styles.codeBox}>
                    <span style={styles.codeText}>{generatedCode}</span>
                    <button 
                      style={styles.copyBtn} 
                      onClick={copyToClipboard}
                      title="Copy to clipboard"
                    >
                      {copied ? <Check size={18} color="#10b981" /> : <Copy size={18} color="#d4d4d8" />}
                    </button>
                  </div>
                  <p style={styles.shareHint}>Share this code with your friends to invite them!</p>
                  <motion.button 
                    className="glass-btn glass-btn-primary" 
                    style={{ ...styles.actionBtn, marginTop: '16px' }}
                    onClick={handleJoinGenerated}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span>Launch & Join Room</span>
                    <Play size={14} />
                  </motion.button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Join Room */}
        <div style={styles.column}>
          <div className="glass-panel-heavy" style={styles.panel}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={styles.iconWrapper}>
                <Users size={20} color="var(--theme-color-2)" />
              </div>
              <h3 style={styles.panelTitle}>Join an Existing Session</h3>
            </div>
            
            <p style={styles.introText}>
              Have a code already? Paste the room code below to jump directly into your friend's collaborative canvas.
            </p>

            <form onSubmit={handleJoin} style={styles.joinForm}>
              <div style={styles.inputContainer}>
                <input
                  type="text"
                  placeholder="e.g. AER-982"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  className="glass-input"
                  style={styles.input}
                  disabled={loading}
                />
                <motion.button 
                  type="submit"
                  className="glass-btn glass-btn-primary" 
                  style={styles.joinBtn}
                  disabled={loading || !roomInput.trim()}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {loading ? (
                    <RefreshCw className="spin-animation" size={16} />
                  ) : (
                    <>
                      <span>Join Room</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </motion.button>
              </div>
            </form>

            {errorMsg && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                style={styles.errorText}
              >
                {errorMsg}
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
    maxWidth: '960px',
    margin: '40px auto 0 auto',
    padding: '0 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    boxSizing: 'border-box',
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
    gridTemplateColumns: '1fr 1fr',
    gap: '30px',
    width: '100%',
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
  },
  panel: {
    padding: '36px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    boxSizing: 'border-box',
  },
  panelTitle: {
    fontFamily: 'var(--font-title)',
    fontSize: '20px',
    fontWeight: '700',
    margin: 0,
    color: '#ffffff',
  },
  iconWrapper: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  introText: {
    fontSize: '15px',
    color: 'var(--text-secondary)',
    lineHeight: '1.6',
    margin: 0,
  },
  actionBtn: {
    width: '100%',
    justifyContent: 'center',
    padding: '14px',
    fontSize: '15px',
    borderRadius: '12px',
    height: '48px',
  },
  codeOutputContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    alignItems: 'center',
    width: '100%',
  },
  codeBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    background: 'rgba(0, 0, 0, 0.25)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    padding: '12px 20px',
    boxSizing: 'border-box',
  },
  codeText: {
    fontSize: '24px',
    fontWeight: '800',
    fontFamily: 'monospace',
    color: 'var(--theme-color-1)',
    letterSpacing: '3px',
  },
  copyBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  shareHint: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    margin: 0,
    textAlign: 'center',
  },
  joinForm: {
    width: '100%',
    marginTop: '12px',
  },
  inputContainer: {
    display: 'flex',
    gap: '12px',
    width: '100%',
  },
  input: {
    flex: 1,
    padding: '14px 16px',
    fontSize: '16px',
    borderRadius: '12px',
  },
  joinBtn: {
    padding: '0 24px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  errorText: {
    color: '#f43f5e',
    fontSize: '14px',
    textAlign: 'center',
    background: 'rgba(244, 63, 94, 0.08)',
    border: '1px solid rgba(244, 63, 94, 0.2)',
    borderRadius: '10px',
    padding: '10px 16px',
    fontWeight: '500',
    marginTop: '16px',
  }
}
