import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

export default function WelcomeAnimation({ onComplete }) {
  // Auto-complete the intro after 3.8 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete()
    }, 3800)
    return () => clearTimeout(timer)
  }, [onComplete])

  // Split text into individual letters for a staggered reveal
  const textBrand = "MIRO"
  const textSub = "CANVAS"

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
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            style={{
              ...styles.particle,
              left: `${15 + Math.random() * 70}%`,
              top: `${20 + Math.random() * 60}%`,
              background: i % 2 === 0 ? 'var(--theme-color-1)' : 'var(--theme-color-2)',
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.15, 0.5, 0.15],
              scale: [1, 1.3, 1],
            }}
            transition={{
              duration: 3 + Math.random() * 4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: Math.random() * 2
            }}
          />
        ))}
      </div>

      <div style={styles.logoAndTextWrapper}>
        {/* Large SVG Drawing Logo Container */}
        <div style={styles.svgContainer}>
          {/* Outer glowing glass circle behind the logo */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            style={styles.logoRing}
          />

          <svg 
            width="140" 
            height="140" 
            viewBox="0 0 24 24" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            style={styles.svg}
          >
            <defs>
              <linearGradient id="welcome-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--theme-color-1)" />
                <stop offset="100%" stopColor="var(--theme-color-2)" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="1" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Drawing M path */}
            <motion.path
              d="M5 18C5 18 8 6 10.5 6C12.5 6 12 13.5 13.5 13.5C15 13.5 16.5 7.5 19 7.5"
              stroke="url(#welcome-logo-grad)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{
                duration: 1.8,
                ease: [0.6, 0.05, 0.1, 0.9],
                delay: 0.3
              }}
            />

            {/* Sparkle/Star path popping up on top right */}
            <motion.path
              d="M19 3.5 Q19 7.5 23 7.5 Q19 7.5 19 11.5 Q19 7.5 15 7.5 Q19 7.5 19 3.5"
              fill="#ffffff"
              filter="url(#glow)"
              initial={{ scale: 0, opacity: 0, rotate: -30 }}
              animate={{ 
                scale: [0, 1.2, 1],
                opacity: 1, 
                rotate: 0 
              }}
              transition={{
                delay: 1.6,
                duration: 0.8,
                ease: "easeOut"
              }}
            />
          </svg>
        </div>

        {/* Brand Name Typography Reveal */}
        <div style={styles.brandRow}>
          {textBrand.split("").map((char, index) => (
            <motion.span
              key={index}
              variants={letterVariants}
              style={{
                ...styles.brandLetter,
                background: index >= 2 
                  ? 'linear-gradient(135deg, var(--theme-color-1) 0%, var(--theme-color-2) 100%)' 
                  : '#ffffff',
                WebkitBackgroundClip: index >= 2 ? 'text' : 'none',
                WebkitTextFillColor: index >= 2 ? 'transparent' : 'none'
              }}
            >
              {char}
            </motion.span>
          ))}
        </div>

        {/* Subtitle / Description reveal */}
        <div style={styles.subRow}>
          {textSub.split("").map((char, index) => (
            <motion.span
              key={index}
              variants={letterVariants}
              style={styles.subLetter}
            >
              {char}
            </motion.span>
          ))}
        </div>

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
    justifyContent: 'center',
    gap: '4px',
    marginBottom: '4px',
  },
  brandLetter: {
    fontFamily: "var(--font-display)",
    fontSize: '64px',
    fontWeight: '800',
    letterSpacing: '-1.5px',
    color: '#ffffff',
    textShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
    display: 'inline-block',
  },
  subRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: '3px',
    marginBottom: '36px',
  },
  subLetter: {
    fontFamily: "var(--font-accent)",
    fontSize: '15px',
    fontWeight: '700',
    letterSpacing: '5px',
    color: 'var(--text-secondary)',
    opacity: 0.75,
    textTransform: 'uppercase',
    display: 'inline-block',
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
