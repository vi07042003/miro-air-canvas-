import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Users, Sparkles, Copy, Check, ArrowRight, Play } from 'lucide-react'

export default function CollaborationModal({
  isOpen,
  onClose,
  user,
  createRoom,
  joinRoom,
  checkRoomExists
}) {
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
      } else {
        setErrorMsg('Failed to create collaboration room.')
      }
    } catch (err) {
      setErrorMsg('An error occurred.')
    } finally {
      setLoading(false)
    }
  }

  const handleJoinGenerated = () => {
    if (!generatedCode) return
    joinRoom(generatedCode)
    onClose()
  }

  const handleJoin = async (e) => {
    e.preventDefault()
    const code = roomInput.trim().toUpperCase()
    if (!code) {
      setErrorMsg('Please enter a room code.')
      return
    }

    // Format check: E.g., AER-123 or just a 6 digit code
    if (!code.startsWith('AER-') && code.length === 6) {
      // Allow users to just type AER123 or similar and format it
      setErrorMsg('Format should be AER-XXX (e.g. AER-982).')
      return
    }

    setLoading(true)
    setErrorMsg('')
    try {
      const exists = await checkRoomExists(code)
      if (exists) {
        joinRoom(code)
        onClose()
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
    setTimeout(() => setCopied(false), 2000)
  }

  if (!isOpen) return null

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      exit="hidden"
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.2 } }
      }}
      style={styles.modalBg}
    >
      {/* Backdrop blur overlay */}
      <motion.div 
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1 }
        }}
        transition={{ duration: 0.25 }}
        className="modal-backdrop-glass"
        style={styles.backdrop}
        onClick={onClose}
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
        className="glass-panel-heavy"
        style={styles.modalContent}
        onClick={(e) => e.stopPropagation()}
      >
          <div style={styles.modalHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={styles.iconWrapper}>
                <Users size={20} color="var(--theme-color-2)" />
              </div>
              <h3 style={styles.modalTitle}>Multiplayer Canvas</h3>
            </div>
            <button style={styles.closeBtn} onClick={onClose} title="Close dialog">
              <X size={18} />
            </button>
          </div>

          <div style={styles.modalBody}>
            {!user ? (
              <div style={styles.lockContainer}>
                <p style={styles.lockText}>
                  Please sign in to access multiplayer drawing rooms.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <p style={styles.introText}>
                  Create a shared virtual whiteboard session or join an existing room to draw and collaborate together in real time.
                </p>

                {/* Section 1: Create Room */}
                <div className="glass-card" style={styles.sessionCard}>
                  <h4 style={styles.cardHeader}>
                    <Sparkles size={16} color="var(--theme-color-1)" style={{ marginRight: '6px' }} />
                    Start New Collaboration
                  </h4>
                  
                  {!generatedCode ? (
                    <button 
                      className="glass-btn glass-btn-primary" 
                      style={styles.actionBtn}
                      onClick={handleCreate}
                      disabled={loading}
                    >
                      {loading ? 'Creating session...' : 'Create Session Room'}
                    </button>
                  ) : (
                    <div style={styles.codeOutputContainer}>
                      <div style={styles.codeBox}>
                        <span style={styles.codeText}>{generatedCode}</span>
                        <button 
                          style={styles.copyBtn} 
                          onClick={copyToClipboard}
                          title="Copy to clipboard"
                        >
                          {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} color="#d4d4d8" />}
                        </button>
                      </div>
                      <p style={styles.shareHint}>Share this code with your friends to invite them!</p>
                      <button 
                        className="glass-btn glass-btn-primary" 
                        style={{ ...styles.actionBtn, marginTop: '8px' }}
                        onClick={handleJoinGenerated}
                      >
                        <span>Join Room Now</span>
                        <Play size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div style={styles.divider}>
                  <span style={styles.dividerText}>or</span>
                </div>

                {/* Section 2: Join Room */}
                <form onSubmit={handleJoin} className="glass-card" style={styles.sessionCard}>
                  <h4 style={styles.cardHeader}>Join Existing Room</h4>
                  <div style={styles.inputRow}>
                    <input
                      type="text"
                      className="glass-input"
                      placeholder="e.g. AER-982"
                      value={roomInput}
                      onChange={(e) => setRoomInput(e.target.value)}
                      style={styles.roomInput}
                      disabled={loading}
                    />
                    <button 
                      type="submit"
                      className="glass-btn" 
                      style={styles.joinBtn}
                      disabled={loading || !roomInput.trim()}
                    >
                      <span>Join</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </form>

                {errorMsg && (
                  <div style={styles.errorText}>
                    {errorMsg}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
    </motion.div>
  )
}

const styles = {
  modalBg: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    perspective: '1000px',
    pointerEvents: 'auto',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: -1,
  },
  modalContent: {
    width: '100%',
    maxWidth: '440px',
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    margin: 'auto',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
    overflow: 'hidden',
    transformStyle: 'preserve-3d',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconWrapper: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontFamily: 'var(--font-title)',
    fontSize: '20px',
    fontWeight: '700',
    color: '#fff',
    margin: 0,
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    display: 'flex',
    flexDirection: 'column',
  },
  introText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
    margin: 0,
  },
  sessionCard: {
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    background: 'rgba(255, 255, 255, 0.015)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '16px',
  },
  cardHeader: {
    margin: 0,
    fontSize: '15px',
    fontWeight: '600',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
  },
  actionBtn: {
    width: '100%',
    justifyContent: 'center',
    padding: '12px',
    fontSize: '14px',
    borderRadius: '10px',
  },
  codeOutputContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    alignItems: 'center',
    width: '100%',
  },
  codeBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    background: 'rgba(0, 0, 0, 0.2)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '10px',
    padding: '10px 16px',
    boxSizing: 'border-box',
  },
  codeText: {
    fontSize: '20px',
    fontWeight: '800',
    fontFamily: 'monospace',
    color: 'var(--theme-color-1)',
    letterSpacing: '2px',
  },
  copyBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareHint: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    margin: 0,
    textAlign: 'center',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
  },
  dividerText: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  inputRow: {
    display: 'flex',
    gap: '10px',
    width: '100%',
  },
  roomInput: {
    flex: 1,
    padding: '12px 14px',
    fontSize: '15px',
    borderRadius: '10px',
  },
  joinBtn: {
    padding: '0 20px',
    borderRadius: '10px',
  },
  lockContainer: {
    textAlign: 'center',
    padding: '40px 20px',
  },
  lockText: {
    fontSize: '15px',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  errorText: {
    color: '#f43f5e',
    fontSize: '13px',
    textAlign: 'center',
    background: 'rgba(244, 63, 94, 0.08)',
    border: '1px solid rgba(244, 63, 94, 0.2)',
    borderRadius: '8px',
    padding: '8px 12px',
    fontWeight: '500',
  }
}
