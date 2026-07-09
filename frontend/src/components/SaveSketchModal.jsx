import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

export default function SaveSketchModal({
  isOpen,
  onClose,
  saveTitle,
  onSaveTitleChange,
  onSubmit,
  dbMessage,
  saving,
  initialDrawing,
  styles = {}
}) {
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
            className="glass-panel-heavy modal-content-scroll"
            style={{ ...styles.modalContent, transformStyle: 'preserve-3d', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={styles.modalTitle}>{initialDrawing ? 'Update Sketch in Database' : 'Save Sketch to Database'}</h2>
            <form onSubmit={onSubmit} style={styles.modalForm}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Sketch Title</label>
                <input 
                  type="text" 
                  className="glass-input"
                  value={saveTitle}
                  onChange={(e) => onSaveTitleChange(e.target.value)}
                  placeholder="e.g. Neon Horizon"
                  autoFocus
                />
              </div>

              {dbMessage && (
                <div style={dbMessage.includes('successfully') ? styles.successAlert : styles.failureAlert}>
                  {dbMessage}
                </div>
              )}

              <div style={styles.modalBtnRow}>
                <button type="button" className="glass-btn" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="glass-btn glass-btn-primary" disabled={saving}>
                  {saving ? (initialDrawing ? 'Updating...' : 'Saving...') : (initialDrawing ? 'Update Sketch' : 'Save Sketch')}
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
