import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Image, Download, Trash2, Eye, Calendar, X, Edit, ChevronLeft, ChevronRight, Rotate3d } from 'lucide-react'
import { BACKEND_URL } from '../App'
import GlassDialog from './GlassDialog'
import { useToast } from './Toast'
import { motion, AnimatePresence } from 'framer-motion'

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
    // For 3D / revolve drawings, export as OBJ instead of PNG
    if (drawing.canvas_mode === '3d' || drawing.canvas_mode === 'revolve') {
      handleDownloadOBJ(drawing, e)
      return
    }
    const link = document.createElement('a')
    link.href = drawing.image_data
    link.download = `${drawing.title.replace(/\s+/g, '_')}_miro_canvas.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast(`Sketch "${drawing.title}" downloaded!`, 'download')
  }

  // ---- OBJ Export Helpers ----

  const buildRevolveOBJ = (threedData, title) => {
    const { profilePoints, segments = 20 } = threedData
    if (!profilePoints || profilePoints.length < 2) return null
    const scale = 0.8
    const vertices = []
    const faces = []
    for (let s = 0; s < segments; s++) {
      const angle = (s * 2 * Math.PI) / segments
      const cosVal = Math.cos(angle)
      const sinVal = Math.sin(angle)
      profilePoints.forEach(pt => {
        vertices.push({
          x: pt.radius * cosVal * scale,
          y: pt.height * scale,
          z: pt.radius * sinVal * scale
        })
      })
    }
    const pCount = profilePoints.length
    for (let s = 0; s < segments; s++) {
      const nextS = (s + 1) % segments
      for (let i = 0; i < pCount - 1; i++) {
        const a = s * pCount + i
        const b = s * pCount + i + 1
        const c = nextS * pCount + i
        const d = nextS * pCount + i + 1
        faces.push([a, c, d, b])
      }
    }
    let obj = `# AeroCanvas Revolve Studio Export\n`
    obj += `# Title: ${title}\n`
    obj += `# Created: ${new Date().toISOString()}\n`
    obj += `# Segments: ${segments}\n\n`
    vertices.forEach(v => {
      obj += `v ${(v.x / 100).toFixed(4)} ${(-v.y / 100).toFixed(4)} ${(v.z / 100).toFixed(4)}\n`
    })
    obj += '\n'
    faces.forEach(f => {
      obj += `f ${f.map(i => i + 1).join(' ')}\n`
    })
    return obj
  }

  const buildSphereGeometry = (cx, cy, cz, r, rings = 10, segs = 16) => {
    const verts = []
    const faces = []
    const s = r / 100
    for (let lat = 0; lat <= rings; lat++) {
      const theta = (lat / rings) * Math.PI
      for (let lon = 0; lon <= segs; lon++) {
        const phi = (lon / segs) * 2 * Math.PI
        verts.push([
          cx / 100 + s * Math.sin(theta) * Math.cos(phi),
          -cy / 100 + s * Math.cos(theta),
          cz / 100 + s * Math.sin(theta) * Math.sin(phi)
        ])
      }
    }
    for (let lat = 0; lat < rings; lat++) {
      for (let lon = 0; lon < segs; lon++) {
        const a = lat * (segs + 1) + lon
        const b = a + segs + 1
        faces.push([a, b, b + 1])
        faces.push([a, b + 1, a + 1])
      }
    }
    return { verts, faces }
  }

  const buildCubeGeometry = (cx, cy, cz, s) => {
    const h = s / 100 / 2
    const px = cx / 100, py = -cy / 100, pz = cz / 100
    const verts = [
      [px - h, py - h, pz - h], [px + h, py - h, pz - h],
      [px + h, py + h, pz - h], [px - h, py + h, pz - h],
      [px - h, py - h, pz + h], [px + h, py - h, pz + h],
      [px + h, py + h, pz + h], [px - h, py + h, pz + h]
    ]
    const faces = [
      [0, 1, 2, 3], [4, 7, 6, 5], [0, 3, 7, 4],
      [1, 5, 6, 2], [0, 4, 5, 1], [3, 2, 6, 7]
    ]
    return { verts, faces }
  }

  const buildCylinderGeometry = (cx, cy, cz, s, segs = 16) => {
    const r = s / 100 / 2, h = s / 100 / 2
    const px = cx / 100, py = -cy / 100, pz = cz / 100
    const verts = []
    const faces = []
    // Bottom circle verts, top circle verts
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * 2 * Math.PI
      verts.push([px + r * Math.cos(a), py - h, pz + r * Math.sin(a)])
    }
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * 2 * Math.PI
      verts.push([px + r * Math.cos(a), py + h, pz + r * Math.sin(a)])
    }
    // Side faces
    for (let i = 0; i < segs; i++) {
      const a = i, b = i + 1, c = i + segs + 1, d = i + segs + 2
      faces.push([a, c, d, b])
    }
    return { verts, faces }
  }

  const buildPyramidGeometry = (cx, cy, cz, s) => {
    const h = s / 100, w = s / 100 / 2
    const px = cx / 100, py = -cy / 100, pz = cz / 100
    const verts = [
      [px - w, py, pz - w], [px + w, py, pz - w],
      [px + w, py, pz + w], [px - w, py, pz + w],
      [px, py + h, pz]
    ]
    const faces = [
      [0, 1, 2, 3],
      [0, 4, 1], [1, 4, 2], [2, 4, 3], [3, 4, 0]
    ]
    return { verts, faces }
  }

  const buildOBJFrom3DObjects = (objects, title) => {
    let obj = `# AeroCanvas 3D Canvas Export\n`
    obj += `# Title: ${title}\n`
    obj += `# Created: ${new Date().toISOString()}\n\n`
    let vertexOffset = 0
    objects.forEach((o, idx) => {
      obj += `# Object ${idx + 1}: ${o.type}\n`
      let geom = null
      const px = (o.pos && o.pos.x != null) ? o.pos.x : 0
      const py = (o.pos && o.pos.y != null) ? o.pos.y : 0
      const pz = (o.pos && o.pos.z != null) ? o.pos.z : 0
      const sz = o.size || 40
      if (o.type === 'sphere') {
        geom = buildSphereGeometry(px, py, pz, sz)
      } else if (o.type === 'cube') {
        geom = buildCubeGeometry(px, py, pz, sz)
      } else if (o.type === 'cylinder') {
        geom = buildCylinderGeometry(px, py, pz, sz)
      } else if (o.type === 'pyramid') {
        geom = buildPyramidGeometry(px, py, pz, sz)
      } else if (o.type === 'cone') {
        // Cone ≈ pyramid with circular base
        const { verts, faces } = buildCylinderGeometry(px, py, pz, sz)
        // Replace top ring with single apex
        const apex = [px / 100, -py / 100 + sz / 100, pz / 100]
        geom = { verts: [...verts, apex], faces }
      } else if (o.type === 'prism') {
        geom = buildCylinderGeometry(px, py, pz, sz, 3)
      } else if (o.type === 'octahedron') {
        const r = sz / 100 / 2
        const bx = px / 100, by = -py / 100, bz = pz / 100
        const verts = [
          [bx, by + r, bz], [bx + r, by, bz], [bx, by, bz + r],
          [bx - r, by, bz], [bx, by, bz - r], [bx, by - r, bz]
        ]
        const faces = [
          [0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 1],
          [5, 2, 1], [5, 3, 2], [5, 4, 3], [5, 1, 4]
        ]
        geom = { verts, faces }
      } else if (o.type === 'torus') {
        const R = sz / 100 / 2, r2 = R * 0.3
        const bx = px / 100, by = -py / 100, bz = pz / 100
        const segsA = 16, segsB = 8
        const verts = []
        const faces = []
        for (let i = 0; i <= segsA; i++) {
          const a = (i / segsA) * 2 * Math.PI
          for (let j = 0; j <= segsB; j++) {
            const b = (j / segsB) * 2 * Math.PI
            verts.push([
              bx + (R + r2 * Math.cos(b)) * Math.cos(a),
              by + r2 * Math.sin(b),
              bz + (R + r2 * Math.cos(b)) * Math.sin(a)
            ])
          }
        }
        for (let i = 0; i < segsA; i++) {
          for (let j = 0; j < segsB; j++) {
            const a = i * (segsB + 1) + j
            const b = a + segsB + 1
            faces.push([a, b, b + 1, a + 1])
          }
        }
        geom = { verts, faces }
      } else if (o.type === 'capsule') {
        geom = buildCylinderGeometry(px, py, pz, sz)
      } else if (o.type === 'stroke' && o.points && o.points.length > 0) {
        // Export stroke as a polyline of vertices (no faces)
        o.points.forEach(pt => {
          obj += `v ${(pt.x / 100).toFixed(4)} ${(-pt.y / 100).toFixed(4)} ${(pt.z / 100).toFixed(4)}\n`
        })
        obj += '\n'
        vertexOffset += o.points.length
        return
      }
      if (geom) {
        geom.verts.forEach(v => {
          obj += `v ${v[0].toFixed(4)} ${v[1].toFixed(4)} ${v[2].toFixed(4)}\n`
        })
        obj += '\n'
        geom.faces.forEach(f => {
          obj += `f ${f.map(i => i + vertexOffset + 1).join(' ')}\n`
        })
        obj += '\n'
        vertexOffset += geom.verts.length
      }
    })
    return obj
  }

  const handleDownloadOBJ = (drawing, e) => {
    if (e) e.stopPropagation()
    if (!drawing.threed_objects) {
      showToast('No 3D data found for this drawing.', 'error')
      return
    }
    try {
      const data = JSON.parse(drawing.threed_objects)
      let objText = ''
      const safeName = drawing.title.replace(/\s+/g, '_')
      if (drawing.canvas_mode === 'revolve') {
        objText = buildRevolveOBJ(data, drawing.title)
        if (!objText) {
          showToast('Not enough profile points to export.', 'error')
          return
        }
      } else if (drawing.canvas_mode === '3d') {
        if (!Array.isArray(data) || data.length === 0) {
          showToast('No 3D objects found in this drawing.', 'error')
          return
        }
        objText = buildOBJFrom3DObjects(data, drawing.title)
      }
      const blob = new Blob([objText], { type: 'text/plain' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${safeName}_aerocanvas.obj`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(link.href)
      showToast(`OBJ model "${drawing.title}" downloaded!`, 'success')
    } catch (err) {
      console.error('OBJ export error:', err)
      showToast('Failed to export OBJ file.', 'error')
    }
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
                        title={drawing.canvas_mode === '3d' || drawing.canvas_mode === 'revolve' ? 'Download OBJ' : 'Download PNG'}
                      >
                        <Download size={18} />
                      </button>
                    </div>
                  </div>
                  <div style={styles.cardInfo}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ ...styles.cardTitle, margin: 0, flex: 1 }}>{drawing.title}</h3>
                      <span style={{
                        fontSize: '9px',
                        fontWeight: '700',
                        padding: '2px 6.5px',
                        borderRadius: '6px',
                        background: drawing.canvas_mode === '3d' 
                          ? 'rgba(99, 102, 241, 0.15)' 
                          : drawing.canvas_mode === 'revolve'
                          ? 'rgba(236, 72, 153, 0.15)'
                          : 'rgba(16, 185, 129, 0.15)',
                        color: drawing.canvas_mode === '3d' 
                          ? '#a5b4fc' 
                          : drawing.canvas_mode === 'revolve'
                          ? '#f472b6'
                          : '#6ee7b7',
                        border: drawing.canvas_mode === '3d' 
                          ? '1px solid rgba(99, 102, 241, 0.3)' 
                          : drawing.canvas_mode === 'revolve'
                          ? '1px solid rgba(236, 72, 153, 0.3)'
                          : '1px solid rgba(16, 185, 129, 0.3)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}>
                        {drawing.canvas_mode === 'revolve' && <Rotate3d size={10} />}
                        {drawing.canvas_mode === '3d' ? '3D' : drawing.canvas_mode === 'revolve' ? 'Revolve' : '2D'}
                      </span>
                    </div>
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
      {createPortal(
        <AnimatePresence>
          {selectedDrawing && (
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
                onClick={() => setSelectedDrawing(null)}
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
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h2 style={{ ...styles.modalTitle, margin: 0 }}>{selectedDrawing.title}</h2>
                       <span style={{
                        fontSize: '10px',
                        fontWeight: '700',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: selectedDrawing.canvas_mode === '3d' 
                          ? 'rgba(99, 102, 241, 0.15)' 
                          : selectedDrawing.canvas_mode === 'revolve'
                          ? 'rgba(236, 72, 153, 0.15)'
                          : 'rgba(16, 185, 129, 0.15)',
                        color: selectedDrawing.canvas_mode === '3d' 
                          ? '#a5b4fc' 
                          : selectedDrawing.canvas_mode === 'revolve'
                          ? '#f472b6'
                          : '#6ee7b7',
                        border: selectedDrawing.canvas_mode === '3d' 
                          ? '1px solid rgba(99, 102, 241, 0.3)' 
                          : selectedDrawing.canvas_mode === 'revolve'
                          ? '1px solid rgba(236, 72, 153, 0.3)'
                          : '1px solid rgba(16, 185, 129, 0.3)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {selectedDrawing.canvas_mode === 'revolve' && <Rotate3d size={12} />}
                        {selectedDrawing.canvas_mode === '3d' ? '3D Canvas' : selectedDrawing.canvas_mode === 'revolve' ? 'Revolve Studio' : '2D Canvas'}
                      </span>
                    </div>
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
                      <span>Download</span>
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
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
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
    fontWeight: '500',
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
    fontWeight: '500',
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

