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
              hidden: { opacity: 0, scale: 0.95, y: 15, rotateX: -5 },
              visible: { opacity: 1, scale: 1, y: 0, rotateX: 0 }
            }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="glass-panel-heavy modal-content-scroll"
            style={{ ...styles.modalContent, transformStyle: 'preserve-3d' }}
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
