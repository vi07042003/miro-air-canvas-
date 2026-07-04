/* eslint-disable react-hooks/purity */
import { useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'

export default function WelcomeAnimation({ onComplete }) {
  // Auto-complete the intro after 3.8 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete()
    }, 3800)
    return () => clearTimeout(timer)
  }, [onComplete])

  // Pre-calculate floating particles to keep render function pure
  const particles = useMemo(() => {
    return Array.from({ length: 8 }).map((_, i) => ({
      left: `${15 + Math.random() * 70}%`,
      top: `${20 + Math.random() * 60}%`,
      duration: 3 + Math.random() * 4,
      delay: Math.random() * 2,
      background: i % 2 === 0 ? 'var(--theme-color-1)' : 'var(--theme-color-2)',
    }))
  }, [])



  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    },
    exit: {
      opacity: 0,
      y: -20,
      filter: "blur(10px)",
      transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1] }
    }
  }

  const letterVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.6, ease: [0.215, 0.61, 0.355, 1] }
    }
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={styles.container}
      onClick={onComplete}
      className="welcome-animation-backdrop"
    >
      {/* Ambient background glow mesh blobs */}
      <motion.div 
        animate={{
          scale: [1, 1.25, 1],
          x: [0, 40, 0],
          y: [0, -40, 0]
        }}
        transition={{
          duration: 9,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        style={{
          position: 'absolute',
          top: '-15%',
          left: '-15%',
          width: '60vw',
          height: '60vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.28) 0%, rgba(139, 92, 246, 0.05) 50%, transparent 70%)',
          filter: 'blur(70px)',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />
      <motion.div 
        animate={{
          scale: [1.15, 0.9, 1.15],
          x: [0, -50, 0],
          y: [0, 30, 0]
        }}
        transition={{
          duration: 11,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        style={{
          position: 'absolute',
          bottom: '-15%',
          right: '-15%',
          width: '60vw',
          height: '60vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.28) 0%, rgba(6, 182, 212, 0.05) 50%, transparent 70%)',
          filter: 'blur(70px)',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />

      {/* Background radial glow effect */}
      <div style={styles.radialGlow} />

      {/* Grid pattern context */}
      <div style={styles.gridOverlay} />

      {/* Floating particles */}
      <div className="welcome-particles-container" style={styles.particlesContainer}>
        {particles.map((p, i) => (
          <motion.div
            key={i}
            style={{
              ...styles.particle,
              left: p.left,
              top: p.top,
              background: p.background,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.15, 0.5, 0.15],
              scale: [1, 1.3, 1],
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              ease: "easeInOut",
              delay: p.delay
            }}
          />
        ))}
      </div>

      <div style={styles.logoAndTextWrapper}>

        {/* Brand wordmark — icon inline with miro, canvas small below */}
        <motion.div
          variants={letterVariants}
          style={styles.brandRow}
        >
          <div style={styles.brandIconInline}>
            <svg
              width="120"
              height="120"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ filter: 'drop-shadow(0 0 12px rgba(139,92,246,0.4))' }}
            >
              <defs>
                <linearGradient id="brand-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--theme-color-1)" />
                  <stop offset="100%" stopColor="var(--theme-color-2)" />
                </linearGradient>
              </defs>
              <motion.path
                d="M5 18C5 18 8 6 10.5 6C12.5 6 12 13.5 13.5 13.5C15 13.5 16.5 7.5 19 7.5"
                stroke="url(#brand-grad)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.8, ease: [0.6, 0.05, 0.1, 0.9], delay: 0.3 }}
              />
              <motion.path
                d="M19 3.5 Q19 7.5 23 7.5 Q19 7.5 19 11.5 Q19 7.5 15 7.5 Q19 7.5 19 3.5"
                fill="#ffffff"
                initial={{ scale: 0, opacity: 0, rotate: -30 }}
                animate={{ scale: [0, 1.2, 1], opacity: 1, rotate: 0 }}
                transition={{ delay: 1.6, duration: 0.8, ease: "easeOut" }}
              />
            </svg>
          </div>
          <div style={styles.brandTextStack}>
            <span style={styles.brandMiro}>miro</span>
            <span style={styles.brandCanvas}>canvas</span>
          </div>
        </motion.div>

        {/* Decorative thin modern progress indicator */}
        <div style={styles.progressTrack}>
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 3.2, ease: "linear", delay: 0.2 }}
            style={styles.progressBar}
          />
        </div>
      </div>

      {/* Skip Button hint at bottom */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ delay: 2.2, duration: 0.8 }}
        style={styles.skipHint}
      >
        <span>Click anywhere to skip intro</span>
      </motion.div>
    </motion.div>
  )
}

const styles = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'radial-gradient(circle at 50% 50%, #0d0624 0%, #03010b 100%)',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    cursor: 'pointer',
  },
  radialGlow: {
    position: 'absolute',
    width: '800px',
    height: '800px',
    background: 'radial-gradient(circle, rgba(139, 92, 246, 0.16) 0%, rgba(6, 182, 212, 0.06) 50%, transparent 100%)',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    zIndex: 1,
    filter: 'blur(30px)',
  },
  gridOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundSize: '40px 40px',
    backgroundImage: 'linear-gradient(to right, rgba(255, 255, 255, 0.015) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.015) 1px, transparent 1px)',
    maskImage: 'radial-gradient(circle, black 30%, transparent 70%)',
    WebkitMaskImage: 'radial-gradient(circle, black 30%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 2,
  },
  particlesContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 3,
  },
  particle: {
    position: 'absolute',
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    filter: 'blur(1px) drop-shadow(0 0 4px currentColor)',
  },
  logoAndTextWrapper: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    zIndex: 10,
    textAlign: 'center',
  },
  svgContainer: {
    position: 'relative',
    width: '180px',
    height: '180px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '28px',
  },
  logoRing: {
    position: 'absolute',
    width: '180px',
    height: '180px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    boxShadow: 'inset 0 0 20px rgba(255, 255, 255, 0.02), 0 0 40px rgba(0, 0, 0, 0.3)',
  },
  svg: {
    zIndex: 5,
    filter: 'drop-shadow(0 0 15px rgba(139, 92, 246, 0.35))',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '36px',
  },
  brandIconInline: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  brandTextStack: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '2px',
    lineHeight: 1,
  },
  brandMiro: {
    fontFamily: 'var(--font-display)',
    fontSize: '100px',
    fontWeight: '500',
    fontStyle: 'italic',
    letterSpacing: '-3px',
    lineHeight: '1',
    color: '#ffffff',
  },
  brandDot: {
    display: 'none',
  },
  brandCanvas: {
    fontFamily: 'var(--font-accent)',
    fontSize: '13px',
    fontWeight: '500',
    letterSpacing: '0.22em',
    color: 'rgba(255,255,255,0.38)',
    textTransform: 'uppercase',
    lineHeight: '1',
  },
  progressTrack: {
    width: '140px',
    height: '2px',
    background: 'rgba(255, 255, 255, 0.06)',
    borderRadius: '99px',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    background: 'linear-gradient(90deg, var(--theme-color-1) 0%, var(--theme-color-2) 100%)',
    boxShadow: '0 0 8px var(--theme-color-2)',
  },
  skipHint: {
    position: 'absolute',
    bottom: '40px',
    fontFamily: 'var(--font-body)',
    fontSize: '12px',
    letterSpacing: '0.5px',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    pointerEvents: 'none',
  }
}
