import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, Camera, Image, Layers, ArrowRight, HelpCircle, BookOpen, X, MousePointer, Settings, Hand } from 'lucide-react'

export default function LandingPage({ onStartCanvas }) {
  const [showManual, setShowManual] = useState(false)

  return (
    <div className="fade-in" style={styles.container}>
      {/* Hero Section */}
      <section style={styles.heroSection}>
        <div style={styles.badge}>
          <Sparkles size={14} style={{ color: 'var(--theme-color-2)' }} />
          <span>Next-Generation Interaction</span>
        </div>
        <h1 style={styles.headline}>
          Create Magic in <br />
          <span style={styles.highlightText}>Thin Air</span>
        </h1>
        <p style={styles.subheadline}>
          MIRO Canvas is an interactive, gesture-controlled air canvas. 
          Draw, paint, and create shapes by moving your hands in front of your webcam. 
          No physical mouse or touch screen required.
        </p>
        <div style={styles.ctaContainer}>
          <button className="glass-btn glass-btn-primary" onClick={onStartCanvas}>
            <span>Launch MIRO Canvas</span>
            <ArrowRight size={18} />
          </button>
          <button className="glass-btn" onClick={() => setShowManual(true)}>
            <HelpCircle size={18} />
            <span>How it Works</span>
          </button>
        </div>
      </section>

      {/* Feature Grid */}
      <section style={styles.featuresSection}>
        <h2 style={styles.sectionTitle}>Engineered for Magic</h2>
        <div style={styles.grid}>
          <div className="glass-card" style={styles.card}>
            <div style={styles.iconWrapper}>
              <Camera size={24} color="#06b6d4" />
            </div>
            <h3 style={styles.cardTitle}>Webcam Gesture Control</h3>
            <p style={styles.cardText}>
              Powered by browser-based MediaPipe WASM. Tracks 21 coordinates on your hand in real-time with sub-millisecond latency.
            </p>
          </div>

          <div className="glass-card" style={styles.card}>
            <div style={styles.iconWrapper}>
              <Layers size={24} color="#8b5cf6" />
            </div>
            <h3 style={styles.cardTitle}>Complete Vector Tools</h3>
            <p style={styles.cardText}>
              Draw lines, rectangles, perfect circles, or paint freehand. Control brush thickness, opacity, and neon-themed color choices.
            </p>
          </div>

          <div className="glass-card" style={styles.card}>
            <div style={styles.iconWrapper}>
              <Image size={24} color="#ec4899" />
            </div>
            <h3 style={styles.cardTitle}>Personal User Gallery</h3>
            <p style={styles.cardText}>
              All designs are secured and saved in your personal database profile. Sign in to load and edit only your sketches.
            </p>
          </div>
        </div>
      </section>

      {/* Decorative Interactive Mockup */}
      <section style={styles.mockupSection}>
        <div className="glass-panel" style={styles.mockupCanvas}>
          <div style={styles.mockupHeader}>
            <div style={styles.mockupDots}>
              <span style={{...styles.dot, backgroundColor: '#ef4444'}}></span>
              <span style={{...styles.dot, backgroundColor: '#eab308'}}></span>
              <span style={{...styles.dot, backgroundColor: '#22c55e'}}></span>
            </div>
            <span style={styles.mockupTitle}>miro_canvas_workspace.sketch</span>
          </div>
          <div style={styles.mockupContent}>
            {/* Draw a floating mock vector sketch inside */}
            <svg width="100%" height="240" viewBox="0 0 600 240" style={styles.mockupSvg}>
              {/* Dynamic light glowing paths */}
              <path d="M50,150 Q150,50 250,120 T450,80" fill="none" stroke="var(--theme-color-1)" strokeWidth="6" strokeLinecap="round" style={{ opacity: 0.8 }} />
              <path d="M100,180 Q250,220 380,120 T520,160" fill="none" stroke="var(--theme-color-2)" strokeWidth="4" strokeLinecap="round" style={{ opacity: 0.6 }} />
              <circle cx="250" cy="120" r="40" fill="none" stroke="var(--primary-pink)" strokeWidth="2" strokeDasharray="5,5" />
              <rect x="360" y="40" width="70" height="50" rx="8" fill="none" stroke="var(--primary-emerald)" strokeWidth="3" />
              
              {/* Simulated Hand pointer */}
              <g transform="translate(450, 80)">
                <circle cx="0" cy="0" r="10" fill="rgba(6, 182, 212, 0.4)" />
                <circle cx="0" cy="0" r="4" fill="#06b6d4" />
                <text x="15" y="5" fill="#a1a1aa" fontSize="11" fontFamily="monospace">INDEX_FINGER_TIP (DRAWING)</text>
              </g>
            </svg>
          </div>
        </div>
      </section>

      {/* Manual / How It Works Modal */}
      {showManual && createPortal(
        <div className="modal-backdrop-glass" onClick={() => setShowManual(false)}>
          <div className="glass-panel-heavy" style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <BookOpen size={22} color="var(--theme-color-2)" />
                <h2 style={styles.modalTitle}>User Guide & Controls</h2>
              </div>
              <button style={styles.closeBtn} onClick={() => setShowManual(false)}>
                <X size={20} />
              </button>
            </div>

            <div style={styles.modalBody}>
              <p style={styles.manualIntro}>
                MIRO Canvas converts standard webcam feeds into real-time gesture paint canvases. Follow the instructions below to learn how to interact with the device.
              </p>

              <div style={styles.guideStep}>
                <div style={styles.stepHeader}>
                  <Camera size={18} color="var(--theme-color-2)" />
                  <span style={styles.stepTitle}>1. Camera Positioning</span>
                </div>
                <p style={styles.stepText}>
                  Ensure your room is well-lit and you sit directly in front of the lens. Place your hand approximately 1 to 2 feet away from the webcam for optimum tracking precision.
                </p>
              </div>

              <div style={styles.guideStep}>
                <div style={styles.stepHeader}>
                  <Hand size={18} color="var(--theme-color-1)" style={{ transform: 'rotate(90deg)' }} />
                  <span style={styles.stepTitle}>2. Paint Gesture (Index Raised)</span>
                </div>
                <p style={styles.stepText}>
                  Raise only your **index finger** (fold middle, ring, pinky, and thumb). A neon paint trail will follow your fingertip to sketch lines, curves, or shape objects.
                </p>
              </div>

              <div style={styles.guideStep}>
                <div style={styles.stepHeader}>
                  <Hand size={18} color="var(--primary-emerald)" />
                  <span style={styles.stepTitle}>3. Hover & Navigation Gesture (V-Sign)</span>
                </div>
                <p style={styles.stepText}>
                  Raise both your **index and middle fingers** split apart (like a peace sign). This activates cursor-only hover mode, letting you reposition without painting.
                </p>
              </div>

              <div style={styles.guideStep}>
                <div style={styles.stepHeader}>
                  <MousePointer size={18} color="var(--primary-pink)" />
                  <span style={styles.stepTitle}>4. Mouse Safety Fallback</span>
                </div>
                <p style={styles.stepText}>
                  If you don't have a webcam or camera permissions are blocked, you can drag your mouse cursor directly on the dark canvas to paint and test all vector shapes.
                </p>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button className="glass-btn glass-btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowManual(false)}>
                Got it!
              </button>
            </div>
          </div>
        </div>,
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
    background: 'linear-gradient(135deg, var(--theme-color-1) 0%, var(--theme-color-2) 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    textShadow: '0 0 40px rgba(139, 92, 246, 0.2)',
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
    fontSize: '32px',
    fontWeight: '700',
    letterSpacing: '-0.5px',
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
    fontSize: '20px',
    fontWeight: '600',
  },
  cardText: {
    color: 'var(--text-secondary)',
    fontSize: '15px',
    lineHeight: '1.5',
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
