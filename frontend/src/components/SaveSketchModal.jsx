import { createPortal } from 'react-dom'

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
  if (!isOpen) return null

  return createPortal(
    <div className="modal-backdrop-glass" onClick={onClose}>
      <div className="glass-panel-heavy" style={styles.modalContent} onClick={e => e.stopPropagation()}>
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
      </div>
    </div>,
    document.body
  )
}
