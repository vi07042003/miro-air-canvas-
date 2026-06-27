/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LogIn, LogOut, Download, Sparkles, Palette, User, CheckCircle2, AlertCircle } from 'lucide-react'

// Create the context
const ToastContext = createContext(null)

// Custom Hook to use the toast
export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

// Injected styles for the liquid glass toast and droplet animation
const TOAST_STYLES = `
  /* Liquid Glass Toast Styles */
  .toast-liquid-filter-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 99999;
    display: flex;
    justify-content: center;
  }

  .toast-island-notch {
    position: absolute;
    top: 0;
    width: 160px;
    height: 30px;
    background: rgba(15, 10, 25, 0.35);
    backdrop-filter: blur(12px);
    border-radius: 0 0 20px 20px;
    border-left: 1px solid rgba(255, 255, 255, 0.08);
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    border-bottom: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    z-index: 10;
  }

  /* Droplet falling keyframes */
  @keyframes droplet-fall {
    0% {
      transform: translateY(15px) scale(1, 1);
      opacity: 0.9;
      border-radius: 50% 50% 50% 50%;
    }
    30% {
      transform: translateY(25px) scale(0.8, 1.4);
      opacity: 1;
      border-radius: 50% 50% 35% 35% / 60% 60% 40% 40%;
    }
    60% {
      transform: translateY(45px) scale(0.6, 1.8);
      opacity: 1;
      border-radius: 50% 50% 20% 20% / 70% 70% 30% 30%;
    }
    90% {
      transform: translateY(65px) scale(1.4, 0.6);
      opacity: 0.8;
      border-radius: 60% 60% 40% 40% / 40% 40% 60% 60%;
    }
    100% {
      transform: translateY(70px) scale(2, 0.2);
      opacity: 0;
      border-radius: 50%;
    }
  }

  .liquid-droplet {
    position: absolute;
    top: 0;
    left: calc(50% - 10px);
    width: 20px;
    height: 20px;
    background: var(--toast-accent-color, #00f2fe);
    box-shadow: 0 0 15px var(--toast-accent-color, #00f2fe), inset 2px 2px 4px rgba(255,255,255,0.6);
    filter: blur(0.2px);
    animation: droplet-fall 0.25s cubic-bezier(0.6, -0.28, 0.735, 0.045) forwards;
    z-index: 5;
  }

  /* Main Toast container style with wobbling and glassmorphism */
  .toast-liquid-capsule {
    position: absolute;
    top: 48px;
    min-width: 320px;
    max-width: 460px;
    min-height: 64px;
    border-radius: 32px;
    border: 1px solid transparent;
    background: 
      linear-gradient(rgba(15, 10, 25, 0.22), rgba(15, 10, 25, 0.22)) padding-box,
      linear-gradient(135deg, var(--toast-accent-color) 0%, rgba(255, 255, 255, 0.15) 50%, var(--toast-accent-color) 100%) border-box;
    backdrop-filter: blur(28px) saturate(210%);
    box-shadow: 
      inset 0 1px 2px rgba(255, 255, 255, 0.4),
      inset 0 -1px 2px rgba(0, 0, 0, 0.4),
      inset 0 0 14px rgba(var(--toast-accent-rgb), 0.12),
      0 12px 40px rgba(0, 0, 0, 0.4),
      0 0 25px rgba(var(--toast-accent-rgb), 0.22);
    display: flex;
    align-items: center;
    padding: 12px 20px;
    gap: 14px;
    pointer-events: auto;
    overflow: hidden;
    transform-origin: center top;
    z-index: 8;
  }

  /* Water Condensation Beads on the Glass */
  .condensation-bead {
    position: absolute;
    background: rgba(255, 255, 255, 0.22);
    border-radius: 50%;
    box-shadow: 
      inset -1px -1px 2px rgba(0,0,0,0.6), 
      inset 1px 1px 1px rgba(255,255,255,0.7), 
      1px 1.5px 2px rgba(0,0,0,0.35);
    filter: blur(0.3px);
    pointer-events: none;
    opacity: 0.75;
  }

  /* Water Ripple Animation */
  @keyframes ripple-wave {
    0% {
      transform: translate(-50%, -50%) scale(0.05);
      opacity: 0.85;
    }
    100% {
      transform: translate(-50%, -50%) scale(1.4);
      opacity: 0;
    }
  }

  .water-ripple-layer {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 250px;
    height: 250px;
    border-radius: 50%;
    border: 2px solid rgba(var(--toast-accent-rgb), 0.4);
    background: radial-gradient(circle, rgba(var(--toast-accent-rgb), 0.08) 0%, transparent 70%);
    pointer-events: none;
    transform: translate(-50%, -50%);
    animation: ripple-wave 0.4s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
    z-index: 1;
  }

  /* Glowing liquid-looking icon bubble */
  .toast-liquid-icon-container {
    position: relative;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(var(--toast-accent-rgb), 0.25) 0%, rgba(var(--toast-accent-rgb), 0.08) 100%);
    border: 1px solid rgba(var(--toast-accent-rgb), 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--toast-accent-color);
    box-shadow: 
      inset 0 1px 1px rgba(255,255,255,0.3),
      0 0 12px rgba(var(--toast-accent-rgb), 0.25);
    flex-shrink: 0;
    z-index: 2;
  }

  .toast-liquid-icon-container::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 7px;
    width: 10px;
    height: 5px;
    background: rgba(255, 255, 255, 0.4);
    border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
    transform: rotate(-15deg);
  }

  /* Text layout */
  .toast-liquid-text-container {
    display: flex;
    flex-direction: column;
    gap: 3px;
    z-index: 2;
    flex-grow: 1;
  }

  .toast-liquid-title {
    font-family: var(--font-title, 'Outfit', 'Inter', sans-serif);
    font-weight: 700;
    font-size: 14px;
    color: #ffffff;
    letter-spacing: -0.2px;
  }

  .toast-liquid-msg {
    font-family: var(--font-body, 'Inter', sans-serif);
    font-weight: 400;
    font-size: 12.5px;
    color: rgba(255, 255, 255, 0.82);
    line-height: 1.35;
  }

  /* Liquid draining progress indicator */
  .toast-liquid-progress-container {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 3px;
    background: rgba(255, 255, 255, 0.05);
    z-index: 2;
  }

  .toast-liquid-progress-bar {
    height: 100%;
    background: linear-gradient(90deg, var(--toast-accent-color) 0%, rgba(var(--toast-accent-rgb), 0.4) 100%);
    box-shadow: 0 0 6px var(--toast-accent-color);
  }

  /* Exit splash animations */
  @keyframes splash-droplet-n {
    0% { transform: translate(0, 0) scale(1); opacity: 1; }
    100% { transform: translate(0, -35px) scale(0.2); opacity: 0; }
  }
  @keyframes splash-droplet-e {
    0% { transform: translate(0, 0) scale(1); opacity: 1; }
    100% { transform: translate(35px, 0) scale(0.2); opacity: 0; }
  }
  @keyframes splash-droplet-s {
    0% { transform: translate(0, 0) scale(1); opacity: 1; }
    100% { transform: translate(0, 35px) scale(0.2); opacity: 0; }
  }
  @keyframes splash-droplet-w {
    0% { transform: translate(0, 0) scale(1); opacity: 1; }
    100% { transform: translate(-35px, 0) scale(0.2); opacity: 0; }
  }

  .exit-splash-bead {
    position: absolute;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--toast-accent-color, #00f2fe);
    box-shadow: 0 0 8px var(--toast-accent-color, #00f2fe);
    pointer-events: none;
    z-index: 9;
  }
`

// Web Audio API Synthesizers for satisfying liquid feedback sounds
const playDropletSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    
    osc.connect(gain)
    gain.connect(ctx.destination)
    
    const now = ctx.currentTime
    
    // Smooth upward pitch sweep to sound like a droplet landing (plop)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(140, now)
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.13)
    
    // Very fast attack, gentle decay envelope
    gain.gain.setValueAtTime(0.001, now)
    gain.gain.linearRampToValueAtTime(0.15, now + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13)
    
    osc.start(now)
    osc.stop(now + 0.14)
  } catch {
    // Ignore context blocked errors (browsers require user interaction first)
  }
}

const playPopSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    
    osc.connect(gain)
    gain.connect(ctx.destination)
    
    const now = ctx.currentTime
    
    // Fast downward pitch sweep (pop)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(750, now)
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.07)
    
    gain.gain.setValueAtTime(0.1, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07)
    
    osc.start(now)
    osc.stop(now + 0.08)
  } catch {
    // Ignore context blocked errors
  }
}

// Define properties based on toast type (Static Helper)
const getToastConfig = (type) => {
  switch (type) {
    case 'login':
      return {
        icon: <LogIn size={18} />,
        accentColor: '#10b981', // Emerald green
        accentRgb: '16, 185, 129',
        borderColor: 'rgba(16, 185, 129, 0.35)',
      }
    case 'logout':
      return {
        icon: <LogOut size={18} />,
        accentColor: '#ef4444', // Red
        accentRgb: '239, 68, 68',
        borderColor: 'rgba(239, 68, 68, 0.35)',
      }
    case 'download':
      return {
        icon: <Download size={18} />,
        accentColor: '#f59e0b', // Amber / gold
        accentRgb: '245, 158, 11',
        borderColor: 'rgba(245, 158, 11, 0.35)',
      }
    case 'ai':
      return {
        icon: <Sparkles size={18} />,
        accentColor: '#a78bfa', // Lavender / Violet
        accentRgb: '167, 139, 250',
        borderColor: 'rgba(167, 139, 250, 0.4)',
      }
    case 'theme':
      return {
        icon: <Palette size={18} />,
        accentColor: 'var(--theme-color-2, #00f2fe)', // Matches local active theme
        accentRgb: 'var(--theme-color-2-rgb, 0, 242, 254)',
        borderColor: 'rgba(var(--theme-color-2-rgb, 0, 242, 254), 0.35)',
      }
    case 'profile':
      return {
        icon: <User size={18} />,
        accentColor: '#38bdf8', // Sky Blue
        accentRgb: '56, 189, 248',
        borderColor: 'rgba(56, 189, 248, 0.35)',
      }
    case 'success':
      return {
        icon: <CheckCircle2 size={18} />,
        accentColor: '#10b981',
        accentRgb: '16, 185, 129',
        borderColor: 'rgba(16, 185, 129, 0.35)',
      }
    case 'error':
      return {
        icon: <AlertCircle size={18} />,
        accentColor: '#f43f5e', // Rose
        accentRgb: '244, 63, 94',
        borderColor: 'rgba(244, 63, 94, 0.35)',
      }
    default:
      return {
        icon: <CheckCircle2 size={18} />,
        accentColor: '#00f2fe',
        accentRgb: '0, 242, 254',
        borderColor: 'rgba(0, 242, 254, 0.3)',
      }
  }
}

// Static helper to get titles
const getDefaultTitle = (type) => {
  switch (type) {
    case 'login': return 'Session Connected'
    case 'logout': return 'Session Closed'
    case 'download': return 'Download Finished'
    case 'ai': return 'AI Generation Complete'
    case 'theme': return 'Dynamic Theme Applied'
    case 'profile': return 'Profile Updated'
    case 'success': return 'Action Successful'
    case 'error': return 'Action Error'
    default: return 'Notification'
  }
}

export const ToastProvider = ({ children }) => {
  const [currentToast, setCurrentToast] = useState(null)
  const [queue, setQueue] = useState([])
  const [dropletActive, setDropletActive] = useState(false)
  const [capsuleActive, setCapsuleActive] = useState(false)
  const [showExitSplash, setShowExitSplash] = useState(false)
  const [splashCoords, setSplashCoords] = useState({ x: 0, y: 0 })
  const timeoutRef = useRef(null)

  // Inject Styles into Document Head
  useEffect(() => {
    const styleElement = document.createElement('style')
    styleElement.innerHTML = TOAST_STYLES
    document.head.appendChild(styleElement)
    return () => {
      document.head.removeChild(styleElement)
    }
  }, [])

  // Process queue of toasts
  const processNextToast = useCallback(() => {
    if (queue.length === 0 || currentToast) return

    const next = queue[0]
    setQueue((prev) => prev.slice(1))
    setCurrentToast(next)
    setDropletActive(true)

    // Stage 1: Droplet falls (lasts ~250ms)
    setTimeout(() => {
      setDropletActive(false)
      setCapsuleActive(true)
      playDropletSound()
    }, 220)

    // Stage 2: Toast Capsule remains visible
    const displayDuration = next.duration || 4000
    timeoutRef.current = setTimeout(() => {
      // Trigger Bubble Pop Exit
      const capsule = document.querySelector('.toast-liquid-capsule')
      if (capsule) {
        const rect = capsule.getBoundingClientRect()
        setSplashCoords({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        })
      }
      setCapsuleActive(false)
      setShowExitSplash(true)
      playPopSound()
      
      // Clear exit splash after it finishes (180ms)
      setTimeout(() => {
        setShowExitSplash(false)
        setCurrentToast(null)
      }, 180)
    }, displayDuration + 220)
  }, [queue, currentToast])

  useEffect(() => {
    processNextToast()
  }, [queue, currentToast, processNextToast])

  // Function to show toast
  const showToast = useCallback((message, type = 'info', options = {}) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9)
    const duration = options.duration || 4000
    const title = options.title || getDefaultTitle(type)
    
    setQueue((prev) => [...prev, { id, message, type, title, duration }])
  }, [])

  // Helper to cancel the active toast early
  const dismissToast = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    const capsule = document.querySelector('.toast-liquid-capsule')
    if (capsule) {
      const rect = capsule.getBoundingClientRect()
      setSplashCoords({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      })
    }
    setCapsuleActive(false)
    setShowExitSplash(true)
    setTimeout(() => {
      setShowExitSplash(false)
      setCurrentToast(null)
    }, 350)
  }, [])

  const activeConfig = currentToast ? getToastConfig(currentToast.type) : null

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}

      {/* SVG Gooey filter definition for the droplet snapping effect */}
      <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="toast-gooey-effect">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      <div className="toast-liquid-filter-container">
        {/* Upper Drip Area wrapped in Gooey Filter */}
        <div style={{
          filter: 'url(#toast-gooey-effect)',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '160px',
          pointerEvents: 'none',
          display: 'flex',
          justifyContent: 'center',
          zIndex: 10
        }}>
          {/* Dynamic Island style top notch */}
          <AnimatePresence>
            {(dropletActive || capsuleActive) && (
              <motion.div
                className="toast-island-notch"
                initial={{ y: -30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -30, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 220, damping: 22 }}
              />
            )}
          </AnimatePresence>

          {/* Falling Drip Animation */}
          {dropletActive && activeConfig && (
            <div 
              className="liquid-droplet" 
              style={{ 
                '--toast-accent-color': activeConfig.accentColor,
                '--toast-accent-rgb': activeConfig.accentRgb
              }} 
            />
          )}
        </div>

        {/* Main Liquid Glass Toast Capsule */}
        <AnimatePresence>
          {capsuleActive && currentToast && activeConfig && (
            <motion.div
              className="toast-liquid-capsule"
              style={{
                '--toast-accent-color': activeConfig.accentColor,
                '--toast-accent-rgb': activeConfig.accentRgb,
                '--toast-border-color': activeConfig.borderColor,
              }}
              initial={{ scaleX: 0.25, scaleY: 1.6, y: 15, opacity: 0, borderRadius: '50%' }}
              animate={{ 
                scaleX: 1,
                scaleY: 1,
                borderRadius: '32px',
                y: 50,
                opacity: 1
              }}
              exit={{ 
                scaleX: 0.1, 
                scaleY: 1.8,
                borderRadius: '50%',
                y: -40,
                opacity: 0,
                transition: {
                  y: { duration: 0.26, ease: [0.4, 0, 1, 1] },
                  scaleX: { duration: 0.22, ease: 'easeIn' },
                  scaleY: { duration: 0.22, ease: 'easeIn' },
                  borderRadius: { duration: 0.2, ease: 'easeInOut' },
                  opacity: { duration: 0.22, ease: 'easeIn' }
                }
              }}
              transition={{
                y: {
                  type: 'spring',
                  stiffness: 300,
                  damping: 22,
                  mass: 0.8
                },
                scaleX: {
                  type: 'spring',
                  stiffness: 280,
                  damping: 13,
                  mass: 0.6
                },
                scaleY: {
                  type: 'spring',
                  stiffness: 280,
                  damping: 13,
                  mass: 0.6
                },
                borderRadius: {
                  duration: 0.38,
                  ease: 'easeOut'
                },
                opacity: {
                  duration: 0.15
                }
              }}
            >


              {/* Inner Ripple spreading on impact */}
              <div className="water-ripple-layer" />

              {/* Condensation beads on glass */}
              <div className="condensation-bead" style={{ width: '4px', height: '4px', top: '15%', left: '8%' }} />
              <div className="condensation-bead" style={{ width: '5px', height: '5px', top: '70%', left: '15%' }} />
              <div className="condensation-bead" style={{ width: '3px', height: '3px', top: '25%', left: '85%' }} />
              <div className="condensation-bead" style={{ width: '4px', height: '4px', top: '60%', left: '92%' }} />
              <div className="condensation-bead" style={{ width: '6px', height: '6px', top: '45%', left: '94%' }} />

              {/* Water sheen overlay gradient */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '50%',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 100%)',
                pointerEvents: 'none'
              }} />

              {/* Liquid-like Icon */}
              <div className="toast-liquid-icon-container">
                <motion.div
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 18 }}
                  style={{ display: 'flex' }}
                >
                  {activeConfig.icon}
                </motion.div>
              </div>

              {/* Text content */}
              <div className="toast-liquid-text-container">
                <motion.div 
                  className="toast-liquid-title"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.18, duration: 0.15 }}
                >
                  {currentToast.title}
                </motion.div>
                <motion.div 
                  className="toast-liquid-msg"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.22, duration: 0.15 }}
                >
                  {currentToast.message}
                </motion.div>
              </div>

              {/* Liquid level progress indicator at the bottom */}
              <div className="toast-liquid-progress-container">
                <motion.div 
                  className="toast-liquid-progress-bar"
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: currentToast.duration / 1000, ease: 'linear', delay: 0.22 }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Exit Splash physical particle droplets (Bubble Pop effect) */}
        {showExitSplash && activeConfig && (
          <div style={{ position: 'fixed', left: splashCoords.x, top: splashCoords.y, pointerEvents: 'none', zIndex: 99999 }}>
            {/* North droplet */}
            <div className="exit-splash-bead" style={{ 
              animation: 'splash-droplet-n 0.35s ease-out forwards',
              '--toast-accent-color': activeConfig.accentColor 
            }} />
            {/* East droplet */}
            <div className="exit-splash-bead" style={{ 
              animation: 'splash-droplet-e 0.35s ease-out forwards',
              '--toast-accent-color': activeConfig.accentColor 
            }} />
            {/* South droplet */}
            <div className="exit-splash-bead" style={{ 
              animation: 'splash-droplet-s 0.35s ease-out forwards',
              '--toast-accent-color': activeConfig.accentColor 
            }} />
            {/* West droplet */}
            <div className="exit-splash-bead" style={{ 
              animation: 'splash-droplet-w 0.35s ease-out forwards',
              '--toast-accent-color': activeConfig.accentColor 
            }} />
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}
