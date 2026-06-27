import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Image, Download, Trash2, Eye, Calendar, X, Edit, ChevronLeft, ChevronRight } from 'lucide-react'
import { BACKEND_URL } from '../App'
import GlassDialog from './GlassDialog'
import { useToast } from './Toast'

export default function Gallery({ onEditDrawing }) {
  const { showToast } = useToast()
  const [drawings, setDrawings] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDrawing, setSelectedDrawing] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const pageSize = 8
  const totalPages = Math.ceil(drawings.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const paginatedDrawings = drawings.slice(startIndex, startIndex + pageSize)

  // Auto-correct page number if drawings are deleted
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages)
    }
  }, [drawings, totalPages, currentPage])

  // Custom Glass Dialog State
  const [dialog, setDialog] = useState({
    isOpen: false,
    type: 'confirm',
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'OK',
    cancelText: 'Cancel'
  })

  const fetchDrawings = async () => {
    setLoading(true)
    setErrorMsg('')
    const token = localStorage.getItem('token')
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/drawings`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (res.ok) {
        const data = await res.json()
        setDrawings(data)
      } else {
        const data = await res.json()
        setErrorMsg(data.detail || 'Failed to retrieve drawings')
      }
    } catch (e) {
      console.error('Error fetching drawings:', e)
      setErrorMsg('Failed to connect to the backend server')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDrawings()
  }, [])

  const handleDelete = (id, e) => {
    if (e) e.stopPropagation()
    const targetDrawing = drawings.find(d => d.id === id)
    const drawingTitle = targetDrawing ? targetDrawing.title : 'Drawing'
    setDialog({
      isOpen: true,
      type: 'confirm',
      title: 'Delete Artwork',
      message: 'Are you sure you want to permanently delete this artwork? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setDialog(prev => ({ ...prev, isOpen: false }))
        const token = localStorage.getItem('token')
        try {
          const res = await fetch(`${BACKEND_URL}/api/drawings/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
          if (res.ok) {
            setDrawings(drawings.filter(d => d.id !== id))
            if (selectedDrawing && selectedDrawing.id === id) {
              setSelectedDrawing(null)
            }
            showToast(`"${drawingTitle}" deleted from gallery.`, 'error')
          } else {
            const data = await res.json()
            setDialog({
              isOpen: true,
              type: 'alert',
              title: 'Error',
              message: data.detail || 'Could not delete drawing',
              confirmText: 'OK',
              onConfirm: () => setDialog(prev => ({ ...prev, isOpen: false }))
            })
          }
        } catch (err) {
          console.error('Error deleting drawing:', err)
          setDialog({
            isOpen: true,
            type: 'alert',
            title: 'Network Error',
            message: 'A network error occurred. Please check your connection and try again.',
            confirmText: 'OK',
            onConfirm: () => setDialog(prev => ({ ...prev, isOpen: false }))
          })
        }
      },
      onCancel: () => setDialog(prev => ({ ...prev, isOpen: false }))
    })
  }

  const handleDownload = (drawing, e) => {
    if (e) e.stopPropagation()
    const link = document.createElement('a')
    link.href = drawing.image_data
    link.download = `${drawing.title.replace(/\s+/g, '_')}_miro_canvas.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast(`Sketch "${drawing.title}" downloaded!`, 'download')
  }

  return (
    <>
      <div className="fade-in" style={styles.container}>
        <h1 style={styles.title}>Sketch Gallery</h1>
        
        {loading ? (
          <div style={styles.loadingContainer}>
            <div style={styles.spinner}></div>
            <p>Loading gallery items...</p>
          </div>
        ) : errorMsg ? (
          <div className="glass-panel" style={styles.emptyContainer}>
            <h2 style={{ ...styles.emptyTitle, color: '#f43f5e' }}>Authentication Error</h2>
            <p style={styles.emptyText}>{errorMsg}</p>
          </div>
        ) : drawings.length === 0 ? (
          <div className="glass-panel" style={styles.emptyContainer}>
            <Image size={48} color="var(--text-muted)" />
            <h2 style={styles.emptyTitle}>Canvas is Empty</h2>
            <p style={styles.emptyText}>
              You haven't saved any air drawings yet. Head over to the Canvas and create your first sketch!
            </p>
          </div>
        ) : (
          <>
            <div style={styles.grid}>
              {paginatedDrawings.map((drawing) => (
                <div 
                  key={drawing.id} 
                  className="glass-card" 
                  style={styles.card}
                  onClick={() => setSelectedDrawing(drawing)}
                >
                  <div style={styles.imageWrapper}>
                    <img src={drawing.image_data} alt={drawing.title} style={styles.image} />
                    <div className="card-overlay" style={styles.cardOverlay}>
                      <button 
                        style={styles.overlayBtn} 
                        onClick={() => setSelectedDrawing(drawing)}
                        title="View Fullscreen"
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        style={styles.overlayBtn} 
                        onClick={(e) => handleDownload(drawing, e)}
                        title="Download Sketch"
                      >
                        <Download size={18} />
                      </button>
                    </div>
                  </div>
                  <div style={styles.cardInfo}>
                    <h3 style={styles.cardTitle}>{drawing.title}</h3>
                    <div style={styles.cardMeta}>
                      <Calendar size={12} />
                      <span>{drawing.created_at}</span>
                    </div>
                  </div>
                  <div style={styles.cardActions}>
                    <button 
                      className="glass-btn glass-btn-primary" 
                      style={{ ...styles.actionBtn, marginRight: 'auto' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onEditDrawing(drawing)
                      }}
                    >
                      <Edit size={14} />
                      <span>Edit</span>
                    </button>
                    <button 
                      className="glass-btn" 
                      style={{ ...styles.actionBtn, ...styles.deleteBtn }}
                      onClick={(e) => handleDelete(drawing.id, e)}
                    >
                      <Trash2 size={14} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div style={styles.paginationContainer}>
                <button 
                  style={{
                    ...styles.paginationArrowBtn,
                    ...(currentPage === 1 ? styles.paginationArrowBtnDisabled : {})
                  }}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="glass-btn"
                >
                  <ChevronLeft size={16} />
                  <span>Prev</span>
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    style={currentPage === pageNum ? styles.paginationBtnActive : styles.paginationBtn}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                ))}

                <button 
                  style={{
                    ...styles.paginationArrowBtn,
                    ...(currentPage === totalPages ? styles.paginationArrowBtnDisabled : {})
                  }}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="glass-btn"
                >
                  <span>Next</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Lightbox / Zoom Modal */}
      {selectedDrawing && createPortal(
        <div className="modal-backdrop-glass" onClick={() => setSelectedDrawing(null)}>
          <div className="glass-panel-heavy" style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>{selectedDrawing.title}</h2>
                <div style={styles.modalMeta}>
                  <Calendar size={14} />
                  <span>Saved on {selectedDrawing.created_at}</span>
                </div>
              </div>
              <button style={styles.closeBtn} onClick={() => setSelectedDrawing(null)}>
                <X size={20} />
              </button>
            </div>
            
            <div style={styles.modalImageWrapper}>
              <img src={selectedDrawing.image_data} alt={selectedDrawing.title} style={styles.modalImage} />
            </div>

            <div style={styles.modalFooter}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  className="glass-btn glass-btn-primary" 
                  onClick={(e) => handleDownload(selectedDrawing, e)}
                >
                  <Download size={16} />
                  <span>Download High-Res</span>
                </button>
                <button 
                  className="glass-btn" 
                  style={{ background: 'rgba(255, 255, 255, 0.05)', borderColor: 'var(--glass-border)' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onEditDrawing(selectedDrawing)
                  }}
                >
                  <Edit size={16} />
                  <span>Resume Sketch</span>
                </button>
              </div>
              <button 
                className="glass-btn glass-btn-danger" 
                style={styles.modalDeleteBtn}
                onClick={(e) => handleDelete(selectedDrawing.id, e)}
              >
                <Trash2 size={16} />
                <span>Delete Sketch</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      <GlassDialog
        isOpen={dialog.isOpen}
        type={dialog.type}
        title={dialog.title}
        message={dialog.message}
        confirmText={dialog.confirmText}
        cancelText={dialog.cancelText}
        onConfirm={dialog.onConfirm}
        onCancel={dialog.onCancel}
      />
    </>
  )
}

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px 0 100px 0',
    minHeight: 'calc(100vh - 180px)',
    position: 'relative',
  },
  title: {
    fontFamily: 'var(--font-title)',
    fontSize: '36px',
    fontWeight: '800',
    marginBottom: '32px',
    letterSpacing: '-1px',
    background: 'linear-gradient(135deg, #ffffff 40%, #a1a1aa 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 0',
    gap: '16px',
    color: 'var(--text-secondary)',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid rgba(255, 255, 255, 0.1)',
    borderTopColor: 'var(--theme-color-2)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    padding: '60px 40px',
    gap: '16px',
    maxWidth: '500px',
    margin: '40px auto',
  },
  emptyTitle: {
    fontFamily: 'var(--font-title)',
    fontSize: '22px',
    fontWeight: '600',
  },
  emptyText: {
    color: 'var(--text-secondary)',
    fontSize: '15px',
    lineHeight: '1.6',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '24px',
  },
  card: {
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    cursor: 'pointer',
    position: 'relative',
  },
  imageWrapper: {
    width: '100%',
    height: '180px',
    borderRadius: '12px',
    overflow: 'hidden',
    position: 'relative',
    background: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  cardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'rgba(5, 2, 15, 0.6)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    opacity: 0,
    transition: 'opacity 0.3s ease',
  },
  overlayBtn: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  cardInfo: {
    padding: '0 4px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  cardTitle: {
    fontFamily: 'var(--font-title)',
    fontSize: '18px',
    fontWeight: '600',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: 'var(--text-muted)',
  },
  cardActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    paddingTop: '12px',
  },
  actionBtn: {
    padding: '6px 12px',
    fontSize: '13px',
    borderRadius: '8px',
  },
  deleteBtn: {
    background: 'transparent',
    color: '#f43f5e',
    borderColor: 'rgba(244, 63, 94, 0.15)',
    ':hover': {
      background: 'rgba(244, 63, 94, 0.1)',
    }
  },
  modalBg: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(3, 1, 8, 0.8)',
    backdropFilter: 'blur(8px)',
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  modalContent: {
    width: '100%',
    maxWidth: '750px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    margin: 'auto',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalTitle: {
    fontFamily: 'var(--font-title)',
    fontSize: '24px',
    fontWeight: '700',
  },
  modalMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    marginTop: '4px',
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
  modalImageWrapper: {
    width: '100%',
    height: '350px',
    borderRadius: '12px',
    overflow: 'hidden',
    background: 'rgba(0,0,0,0.5)',
    border: '1px solid var(--glass-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImage: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '8px',
  },
  modalDeleteBtn: {
    background: 'rgba(244, 63, 94, 0.1)',
    borderColor: 'rgba(244, 63, 94, 0.2)',
    color: '#fda4af',
  },
  paginationContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px',
    position: 'absolute',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 100,
    background: 'rgba(15, 10, 30, 0.65)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    padding: '8px 16px',
    borderRadius: '16px',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
  },
  paginationBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: '600',
    transition: 'all 0.2s ease',
  },
  paginationBtnActive: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%)',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: '700',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 4px 10px rgba(0, 0, 0, 0.15)',
  },
  paginationArrowBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 16px',
    height: '44px',
    borderRadius: '12px',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.2s ease',
    gap: '6px',
  },
  paginationArrowBtnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
    pointerEvents: 'none',
  }
}

