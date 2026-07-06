import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, Camera, Image, Layers, ArrowRight, HelpCircle, BookOpen, X, MousePointer, Settings, Hand, FileImage, Wand2, Rotate3d, Users } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const FEATURES = [
  { verb: 'just draw in',           label: 'thin air',           icon: Sparkles  },
  { verb: 'wave your hand,',        label: 'start painting',     icon: Hand      },
  { verb: 'describe it, we\'ll',    label: 'sketch it out',      icon: Wand2     },
  { verb: 'spin your lines into',   label: '3D shapes',          icon: Rotate3d  },
  { verb: 'drop a photo, get a',    label: 'trace stencil',      icon: FileImage },
  { verb: 'draw together,',         label: 'in real-time',       icon: Users     },
  { verb: 'your sketches,',         label: 'always saved',       icon: Image     },
  { verb: 'clean shapes &',         label: 'sharp lines',        icon: Layers    },
]

const slideVariants = {
  enter: (dir) => ({ y: dir > 0 ? 36 : -36, opacity: 0, filter: 'blur(5px)' }),
  center: { y: 0, opacity: 1, filter: 'blur(0px)' },
  exit:  (dir) => ({ y: dir > 0 ? -36 : 36, opacity: 0, filter: 'blur(5px)' }),
}

function useFeatureIndex() {
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  useEffect(() => {
    const id = setInterval(() => {
      setDirection(1)
      setIndex(prev => (prev + 1) % FEATURES.length)
    }, 2500)
    return () => clearInterval(id)
  }, [])
  return { index, direction }
}

// Shared state lifted to parent — both components receive index & direction as props
function DynamicVerbText({ index, direction }) {
  return (
    <span style={{ ...styles.dynamicWrapper, minHeight: '78px' }}>
      <AnimatePresence mode="wait" custom={direction}>
        <motion.span
          key={index}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.38, ease: [0.4, 0, 0.2, 1] }}
          style={{
            ...styles.headline,
            fontWeight: '100',
            color: 'rgba(255, 255, 255, 0.47)',
            fontStyle: 'italic',
            display: 'inline-block',
            whiteSpace: 'nowrap',
          }}
        >
          {FEATURES[index].verb}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

function DynamicFeatureText({ index, direction }) {
  const feature = FEATURES[index]
  const Icon = feature.icon
  return (
    <span style={styles.dynamicWrapper}>
      <AnimatePresence mode="wait" custom={direction}>
        <motion.span
          key={index}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.50, ease: [0.4, 0, 0.2, 1] }}
          style={{
            ...styles.highlightText,
            color: '#ffffff',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            whiteSpace: 'nowrap',
          }}
        >
          <motion.span
            style={styles.featureIconWrap}
            initial={{ rotate: -20, scale: 0.6, opacity: 0 }}
            animate={{ rotate: 0,   scale: 1,   opacity: 1 }}
            transition={{ delay: 0.12, type: 'spring', stiffness: 300, damping: 18 }}
          >
            <Icon size={48} style={{ display: 'block', color: '#ffffff' }} strokeWidth={1.6} />
          </motion.span>
          {feature.label}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

function HeadlineBlock() {
  const { index, direction } = useFeatureIndex()
  return (
    <h1 style={{ ...styles.headline, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <DynamicVerbText index={index} direction={direction} />
      <DynamicFeatureText index={index} direction={direction} />
    </h1>
  )
}

export default function LandingPage({ onStartCanvas, onStartCollaboration }) {
  const [showManual, setShowManual] = useState(false)

  return (
    <div className="fade-in" style={styles.container}>
      {/* Hero Section */}
      <section style={styles.heroSection}>
        <div style={styles.badge}>
          <Sparkles size={14} style={{ color: 'var(--theme-color-2)' }} />
          <span>your webcam is the canvas</span>
        </div>
        <HeadlineBlock />
        <p style={styles.subheadline}>
          point your index finger at the screen and start drawing.
          no touch screen, no mouse — just your hand and a webcam.
        </p>
        <div style={styles.ctaContainer}>
          <motion.button 
            className="glass-btn glass-btn-primary" 
            onClick={onStartCanvas}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 350, damping: 20 }}
          >
            <span>Launch MIRO Canvas</span>
            <ArrowRight size={18} />
          </motion.button>
          <motion.button 
            className="glass-btn" 
            onClick={() => setShowManual(true)}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 350, damping: 20 }}
          >
            <HelpCircle size={18} />
            <span>How it Works</span>
          </motion.button>
        </div>
      </section>

      {/* Decorative Interactive Mockup */}
      <motion.section 
        style={styles.mockupSection}
        initial={{ opacity: 0, y: 50, filter: 'blur(15px)' }}
        whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      >
        <div className="glass-panel" style={styles.mockupCanvas}>
          <div style={styles.mockupHeader}>
            <span style={styles.mockupTitle}>miro_canvas_workspace.sketch</span>
          </div>
          <div style={styles.mockupContent}>
            {/* Draw a floating mock vector sketch inside */}
            <svg width="100%" height="240" viewBox="0 0 600 240" style={styles.mockupSvg}>
              {/* Dynamic light glowing paths */}
              <motion.path 
                d="M50,150 Q150,50 250,120 T450,80" 
                fill="none" 
                stroke="var(--theme-color-1)" 
                strokeWidth="6" 
                strokeLinecap="round" 
                animate={{ pathLength: [0, 1, 1, 0] }}
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: "easeInOut",
                  times: [0, 0.7, 0.9, 1]
                }}
              />
              <motion.path 
                d="M100,180 Q250,220 380,120 T520,160" 
                fill="none" 
                stroke="var(--theme-color-2)" 
                strokeWidth="4" 
                strokeLinecap="round" 
                animate={{ pathLength: [0, 1, 1, 0] }}
                transition={{
                  duration: 6,
                  delay: 0.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  times: [0, 0.7, 0.9, 1]
                }}
              />
              <motion.circle 
                cx="250" 
                cy="120" 
                r="40" 
                fill="none" 
                stroke="var(--primary-pink)" 
                strokeWidth="2" 
                strokeDasharray="5,5" 
                animate={{ scale: [0, 0, 1, 1, 0], opacity: [0, 0, 0.8, 0.8, 0] }}
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  times: [0, 0.35, 0.45, 0.85, 1]
                }}
              />
              <motion.rect 
                x="360" 
                y="40" 
                width="70" 
                height="50" 
                rx="8" 
                fill="none" 
                stroke="var(--primary-emerald)" 
                strokeWidth="3" 
                animate={{ scale: [0, 0, 1, 1, 0], opacity: [0, 0, 0.8, 0.8, 0] }}
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  times: [0, 0.6, 0.7, 0.85, 1]
                }}
              />
              
              {/* Simulated Hand pointer */}
              <g>
                <animateMotion 
                  dur="6s" 
                  repeatCount="indefinite" 
                  path="M50,150 Q150,50 250,120 T450,80" 
                  keyTimes="0;0.7;0.9;1"
                  keyPoints="0;1;1;0"
                  calcMode="linear"
                />
                <circle cx="0" cy="0" r="12" fill="rgba(6, 182, 212, 0.4)" />
                <circle cx="0" cy="0" r="5" fill="#06b6d4" />
                <g transform="translate(8, 8) scale(0.04)" style={{ filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.5))' }}>
                  <path 
                    d="M384 112c0-26.51-21.49-48-48-48-9.06 0-17.43 2.53-24.58 6.9C304.28 30.54 270.82 0 230 0c-35.31 0-65.7 22.86-77.16 54.77C146.5 51.13 138.41 48 128 48c-35.35 0-64 28.65-64 64v192c0 24.3-8.87 46.55-23.49 63.8C15.82 396.11 0 428.16 0 464c0 26.51 21.49 48 48 48h220.57c66.75 0 126.96-41.6 150.91-104.22l34.82-90.93C474.33 266.69 480 242.01 480 217V160c0-26.51-21.49-48-48-48-9.06 0-17.43 2.53-24.58 6.9-7.14-40.46-40.6-70.9-81.42-70.9z" 
                    fill="#fff" 
                  />
                </g>
                <text x="35" y="5" fill="#a1a1aa" fontSize="11" fontFamily="monospace">INDEX_FINGER_TIP (DRAWING)</text>
              </g>
            </svg>
          </div>
        </div>
      </motion.section>

      {/* Feature Grid */}
      <section style={styles.featuresSection}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', textAlign: 'center' }}>
          <motion.h2 
            style={styles.sectionTitle}
            initial={{ opacity: 0, y: 25, filter: 'blur(8px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            What MIRO Canvas Can Do
          </motion.h2>
          <motion.p
            style={styles.sectionSubtitle}
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
          >
            Explore the advanced drawing mechanics, AI tracing stencils, and interactive 3D tools built right into your browser.
          </motion.p>
        </div>
        <div style={styles.grid}>
          <motion.div 
            className="glass-card" 
            style={styles.card}
            initial={{ opacity: 0, y: 40, filter: 'blur(12px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            whileHover={{ y: -6, scale: 1.02, boxShadow: '0 12px 30px rgba(0,0,0,0.3)' }}
          >
            <div style={styles.iconWrapper}>
              <Camera size={24} color="#06b6d4" />
            </div>
            <h3 style={styles.cardTitle}>your hand, the cursor</h3>
            <p style={styles.cardText}>
              uses mediapipe running right in your browser — no app, no install. tracks 21 points on your hand and turns it into a drawing cursor.
            </p>
          </motion.div>

          <motion.div 
            className="glass-card" 
            style={styles.card}
            initial={{ opacity: 0, y: 40, filter: 'blur(12px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
            whileHover={{ y: -6, scale: 1.02, boxShadow: '0 12px 30px rgba(0,0,0,0.3)' }}
          >
            <div style={styles.iconWrapper}>
              <Layers size={24} color="#8b5cf6" />
            </div>
            <h3 style={styles.cardTitle}>lines, shapes, anything</h3>
            <p style={styles.cardText}>
              freehand, straight lines, circles, rectangles — pick a tool, pick a colour, and go. brush size and opacity are yours to control.
            </p>
          </motion.div>

          <motion.div 
            className="glass-card" 
            style={styles.card}
            initial={{ opacity: 0, y: 40, filter: 'blur(12px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
            whileHover={{ y: -6, scale: 1.02, boxShadow: '0 12px 30px rgba(0,0,0,0.3)' }}
          >
            <div style={styles.iconWrapper}>
              <Sparkles size={24} color="#c084fc" className="spin-animation" style={{ animationDuration: '6s' }} />
            </div>
            <h3 style={styles.cardTitle}>type it, see it drawn</h3>
            <p style={styles.cardText}>
              describe what you want — a star, a face, a house — and the AI drops the outline straight onto the canvas for you to trace.
            </p>
          </motion.div>

          <motion.div 
            className="glass-card" 
            style={styles.card}
            initial={{ opacity: 0, y: 40, filter: 'blur(12px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
            whileHover={{ y: -6, scale: 1.02, boxShadow: '0 12px 30px rgba(0,0,0,0.3)' }}
          >
            <div style={styles.iconWrapper}>
              <FileImage size={24} color="#10b981" />
            </div>
            <h3 style={styles.cardTitle}>photo → trace outline</h3>
            <p style={styles.cardText}>
              drop any photo in, and edge detection breaks it down into a clean stencil you can draw over — great for portraits or logos.
            </p>
          </motion.div>

          <motion.div 
            className="glass-card" 
            style={styles.card}
            initial={{ opacity: 0, y: 40, filter: 'blur(12px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
            whileHover={{ y: -6, scale: 1.02, boxShadow: '0 12px 30px rgba(0,0,0,0.3)' }}
          >
            <div style={styles.iconWrapper}>
              <Wand2 size={24} color="#f43f5e" />
            </div>
            <h3 style={styles.cardTitle}>doodle → actual art</h3>
            <p style={styles.cardText}>
              rough sketch on the canvas, hit enhance — the AI fills in colours, smooths the lines, and turns it into something that looks intentional.
            </p>
          </motion.div>

          <motion.div 
            className="glass-card" 
            style={styles.card}
            initial={{ opacity: 0, y: 40, filter: 'blur(12px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
            whileHover={{ y: -6, scale: 1.02, boxShadow: '0 12px 30px rgba(0,0,0,0.3)' }}
          >
            <div style={styles.iconWrapper}>
              <Image size={24} color="#ec4899" />
            </div>
            <h3 style={styles.cardTitle}>your stuff, always there</h3>
            <p style={styles.cardText}>
              every sketch saves to your account automatically. log back in and it's all waiting — nothing lost between sessions.
            </p>
          </motion.div>

          <motion.div 
            className="glass-card" 
            style={styles.card}
            initial={{ opacity: 0, y: 40, filter: 'blur(12px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
            whileHover={{ y: -6, scale: 1.02, boxShadow: '0 12px 30px rgba(0,0,0,0.3)' }}
          >
            <div style={styles.iconWrapper}>
              <Rotate3d size={24} color="#8b5cf6" />
            </div>
            <h3 style={styles.cardTitle}>draw a line, get a 3D shape</h3>
            <p style={styles.cardText}>
              sketch a side profile and watch it spin into a 3D object — bowls, vases, bottles, chess pieces. it just works.
            </p>
          </motion.div>

          <motion.div 
            className="glass-card" 
            style={{ ...styles.card, cursor: 'pointer' }}
            initial={{ opacity: 0, y: 40, filter: 'blur(12px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
            onClick={onStartCollaboration}
            whileHover={{ y: -6, scale: 1.02, boxShadow: '0 12px 30px rgba(0,0,0,0.3)' }}
          >
            <div style={styles.iconWrapper}>
              <Users size={24} color="var(--theme-color-1)" />
            </div>
            <h3 style={styles.cardTitle}>draw with others, live</h3>
            <p style={styles.cardText}>
              open a room, share the link, and anyone can join and draw alongside you in real-time — on the same canvas, at the same time.
            </p>
          </motion.div>
        </div>
      </section>



      {/* Manual / How It Works Modal */}
      {createPortal(
        <AnimatePresence>
          {showManual && (
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
                onClick={() => setShowManual(false)}
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
                style={{ ...styles.modalContent, transformStyle: 'preserve-3d', overflow: 'hidden' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={styles.modalHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <BookOpen size={22} color="var(--theme-color-2)" />
                    <h2 style={styles.modalTitle}>how to use it</h2>
                  </div>
                  <button style={styles.closeBtn} onClick={() => setShowManual(false)}>
                    <X size={20} />
                  </button>
                </div>

                <div style={styles.modalBody}>
                  <p style={styles.manualIntro}>
                    your webcam becomes the canvas. here's how to get started.
                  </p>

                  <div style={styles.guideStep}>
                    <div style={styles.stepHeader}>
                      <Camera size={18} color="var(--theme-color-2)" />
                      <span style={styles.stepTitle}>1. get the lighting right</span>
                    </div>
                    <p style={styles.stepText}>
                      sit somewhere decent-lit, face the camera straight on. hand works best about 1–2 feet away from the lens.
                    </p>
                  </div>

                  <div style={styles.guideStep}>
                    <div style={styles.stepHeader}>
                      <Hand size={18} color="var(--theme-color-1)" style={{ transform: 'rotate(90deg)' }} />
                      <span style={styles.stepTitle}>2. one finger up = draw</span>
                    </div>
                    <p style={styles.stepText}>
                      raise just your index finger, fold the rest. the canvas follows your fingertip. that's it — move to draw.
                    </p>
                  </div>

                  <div style={styles.guideStep}>
                    <div style={styles.stepHeader}>
                      <Hand size={18} color="var(--primary-emerald)" />
                      <span style={styles.stepTitle}>3. two fingers up = hover</span>
                    </div>
                    <p style={styles.stepText}>
                      peace sign (index + middle, spread apart) moves the cursor without drawing. use it to reposition or hover over buttons.
                    </p>
                  </div>

                  <div style={styles.guideStep}>
                    <div style={styles.stepHeader}>
                      <MousePointer size={18} color="var(--primary-pink)" />
                      <span style={styles.stepTitle}>4. no webcam? use your mouse</span>
                    </div>
                    <p style={styles.stepText}>
                      if there's no camera or you blocked it, just click and drag on the canvas — everything still works.
                    </p>
                  </div>
                </div>

                <div style={styles.modalFooter}>
                  <button className="glass-btn glass-btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowManual(false)}>
                    Got it!
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '40px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '80px',
  },
  heroSection: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px',
    marginTop: '20px',
  },
  badge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '100px',
    padding: '6px 16px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#e4e4e7',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    fontFamily: 'var(--font-accent)',
  },
  headline: {
    fontFamily: 'var(--font-display)',
    fontSize: '64px',
    fontWeight: '800',
    lineHeight: '1.1',
    letterSpacing: '-2px',
    color: '#ffffff',
  },
  highlightText: {
    fontFamily: 'var(--font-display)',
    fontSize: '64px',
    fontWeight: '500',
    lineHeight: '1.1',
    letterSpacing: '-2px',
  },
  dynamicWrapper: {
    display: 'inline-block',
    minHeight: '80px',
    position: 'relative',
    overflow: 'visible',
  },
  featureIconWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    verticalAlign: 'middle',
    marginBottom: '4px',
  },
  subheadline: {
    fontFamily: 'var(--font-title)',
    fontSize: '20px',
    fontWeight: '300',
    color: 'var(--text-secondary)',
    maxWidth: '680px',
    lineHeight: '1.6',
    letterSpacing: '-0.3px',
  },
  ctaContainer: {
    marginTop: '12px',
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  featuresSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
    alignItems: 'center',
  },
  sectionTitle: {
    fontFamily: 'var(--font-title)',
    fontSize: '44px',
    fontWeight: '700',
    letterSpacing: '-1px',
    color: '#ffffff',
  },
  sectionSubtitle: {
    fontFamily: 'var(--font-body)',
    fontSize: '16px',
    fontWeight: '400',
    color: 'var(--text-secondary)',
    maxWidth: '560px',
    lineHeight: '1.5',
    margin: '0 auto',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '24px',
    width: '100%',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    alignItems: 'flex-start',
  },
  iconWrapper: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: 'var(--font-title)',
    fontSize: '17px',
    fontWeight: '500',
    letterSpacing: '-0.2px',
    lineHeight: '1.3',
  },
  cardText: {
    color: 'var(--text-secondary)',
    fontSize: '14px',
    lineHeight: '1.65',
    fontWeight: '400',
  },
  mockupSection: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
  },
  mockupCanvas: {
    width: '100%',
    maxWidth: '800px',
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  mockupHeader: {
    background: 'rgba(0, 0, 0, 0.2)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    padding: '12px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  mockupDots: {
    display: 'flex',
    gap: '6px',
  },
  dot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  },
  mockupTitle: {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: 'var(--text-muted)',
  },
  mockupContent: {
    padding: '20px',
    background: 'rgba(0, 0, 0, 0.15)',
  },
  mockupSvg: {
    display: 'block',
  },
  modalBg: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(3, 1, 8, 0.75)',
    backdropFilter: 'blur(8px)',
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  modalContent: {
    width: '100%',
    maxWidth: '500px',
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: 'var(--font-title)',
    fontSize: '22px',
    fontWeight: '700',
    color: '#fff',
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
    gap: '16px',
  },
  manualIntro: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
    marginBottom: '8px',
  },
  guideStep: {
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid var(--glass-border)',
    borderRadius: '12px',
    padding: '14px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  stepHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  stepTitle: {
    fontWeight: '600',
    fontSize: '14px',
    color: '#fff',
    fontFamily: 'var(--font-accent)',
  },
  stepText: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
  },
  modalFooter: {
    marginTop: '8px',
  }
}
