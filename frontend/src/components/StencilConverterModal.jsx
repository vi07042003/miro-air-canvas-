import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, Image as ImageIcon } from 'lucide-react'
import { processImageToStencil } from '../utils/stencilUtils'
import SmoothSlider from './SmoothSlider'

export default function StencilConverterModal({ 
  isOpen, 
  onClose, 
  onApply, 
  initialImage,
  styles = {} 
}) {
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen)
  const [uploadedImage, setUploadedImage] = useState(null)
  const [stencilThreshold, setStencilThreshold] = useState(50)
  const [stencilInvert, setStencilInvert] = useState(false)
  const [stencilScale, setStencilScale] = useState(1.0)
  const [stencilPreviewUrl, setStencilPreviewUrl] = useState('')
  const [extractedContours, setExtractedContours] = useState([])
  const [extractedGrayscale, setExtractedGrayscale] = useState(null)
  const [stencilWidth, setStencilWidth] = useState(0)
  const [stencilHeight, setStencilHeight] = useState(0)
  const [stencilMode3D, setStencilMode3D] = useState('extrusion') // extrusion, heightmap
  const [targetCanvas, setTargetCanvas] = useState('2d') // 2d, 3d

  // Sync state transitions during render to avoid useEffect state update warnings
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen)
    if (isOpen) {
      if (initialImage) {
        setUploadedImage(initialImage)
      }
    } else {
      setUploadedImage(null)
      setStencilPreviewUrl('')
      setExtractedContours([])
      setExtractedGrayscale(null)
      setTargetCanvas('2d')
    }
  }

  // Run stencil outline extraction on threshold/invert change
  useEffect(() => {
    if (!uploadedImage) return

    const img = new Image()
    img.src = uploadedImage
    img.onload = () => {
      const { previewUrl, contours, w, h, grayscale } = processImageToStencil(img, stencilThreshold, stencilInvert)
      setStencilPreviewUrl(previewUrl)
      setExtractedContours(contours)
      setStencilWidth(w)
      setStencilHeight(h)
      setExtractedGrayscale(grayscale)
    }
  }, [uploadedImage, stencilThreshold, stencilInvert])

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      setUploadedImage(event.target.result)
    }
    reader.readAsDataURL(file)
  }

  const handleApplyStencil = () => {
    if (!stencilPreviewUrl) return
    onApply({
      previewUrl: stencilPreviewUrl,
      contours: extractedContours,
      grayscale: extractedGrayscale,
      width: stencilWidth,
      height: stencilHeight,
      scale: stencilScale,
      mode3D: stencilMode3D,
      targetCanvas: targetCanvas
    })
    onClose()
  }

  if (!isOpen) return null

  return createPortal(
    <div className="modal-backdrop-glass" onClick={onClose}>
      <div className="glass-panel-heavy modal-content-scroll" style={{ ...styles.modalContent, maxWidth: '750px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <h2 style={styles.modalTitle}>Image to Stencil Converter</h2>
          <button 
            className="glass-btn" 
            style={{ padding: '6px 10px', minWidth: 'auto', border: 'none', background: 'transparent' }} 
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        
        <div style={{
          background: 'rgba(6, 182, 212, 0.05)',
          border: '1px solid rgba(6, 182, 212, 0.15)',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '13px',
          color: 'rgba(255, 255, 255, 0.85)',
          lineHeight: '1.5',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <span style={{ fontWeight: 'bold', color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} /> Tip for Best Stencil Extraction:
          </span>
          <span>Please upload <strong>focused images</strong> with a single clear subject, sharp outlines, and high-contrast boundaries (like silhouettes or clean sketches). Avoid blurry or cluttered backgrounds.</span>
        </div>

        {!uploadedImage ? (
          <div 
            style={{
              border: '2px dashed rgba(255, 255, 255, 0.15)',
              borderRadius: '12px',
              padding: '40px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: 'rgba(255, 255, 255, 0.02)',
              transition: 'all 0.3s ease',
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (event) => setUploadedImage(event.target.result);
                reader.readAsDataURL(file);
              }
            }}
            onClick={() => document.getElementById('stencil-file-input').click()}
          >
            <input 
              type="file" 
              id="stencil-file-input" 
              accept="image/*" 
              style={{ display: 'none' }} 
              onChange={handleImageUpload} 
            />
            <ImageIcon size={48} style={{ color: 'rgba(255, 255, 255, 0.3)', marginBottom: '12px' }} />
            <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', color: 'rgba(255, 255, 255, 0.9)' }}>
              Drag & drop your focus image here
            </h4>
            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255, 255, 255, 0.4)' }}>
              or click to browse from files
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Image Previews */}
            <div style={{ 
              display: 'flex', 
              gap: '16px', 
              flexWrap: 'wrap', 
              justifyContent: 'center' 
            }}>
              <div style={{ 
                flex: '1 1 200px', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                gap: '8px' 
              }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'rgba(255,255,255,0.5)' }}>
                  Original Focus Image
                </span>
                <div style={{
                  width: '100%',
                  height: '220px',
                  borderRadius: '8px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <img 
                    src={uploadedImage} 
                    alt="Original source" 
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                  />
                </div>
              </div>

              <div style={{ 
                flex: '1 1 200px', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                gap: '8px' 
              }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'rgba(255,255,255,0.5)' }}>
                  Live Stencil Preview ({extractedContours.length} Paths)
                </span>
                <div style={{
                  width: '100%',
                  height: '220px',
                  borderRadius: '8px',
                  background: stencilInvert ? '#090518' : '#ffffff',
                  border: '1px solid rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.3s ease'
                }}>
                  {stencilPreviewUrl ? (
                    <img 
                      src={stencilPreviewUrl} 
                      alt="Stencil preview" 
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                    />
                  ) : (
                    <div className="spinner"></div>
                  )}
                </div>
              </div>
            </div>

            {/* Sliders and Configuration */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '14px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              padding: '16px',
              borderRadius: '10px'
            }}>
              {/* Target Canvas Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>
                  Target Canvas
                </span>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid ' + (targetCanvas === '2d' ? '#06b6d4' : 'rgba(255,255,255,0.15)'),
                      background: targetCanvas === '2d' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                      color: targetCanvas === '2d' ? '#06b6d4' : 'rgba(255,255,255,0.7)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    onClick={() => setTargetCanvas('2d')}
                  >
                    <span>2D Canvas</span>
                    <span style={{ fontSize: '10px', fontWeight: 'normal', opacity: 0.7 }}>Apply as 2D lines/shapes</span>
                  </button>
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid ' + (targetCanvas === '3d' ? '#06b6d4' : 'rgba(255,255,255,0.15)'),
                      background: targetCanvas === '3d' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                      color: targetCanvas === '3d' ? '#06b6d4' : 'rgba(255,255,255,0.7)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    onClick={() => setTargetCanvas('3d')}
                  >
                    <span>3D Canvas</span>
                    <span style={{ fontSize: '10px', fontWeight: 'normal', opacity: 0.7 }}>Apply as 3D extruded mesh/heightmap</span>
                  </button>
                </div>
              </div>

              {/* Stencil 3D Mode Selector */}
              {targetCanvas === '3d' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>
                    3D Model Extraction Mode
                  </span>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid ' + (stencilMode3D === 'extrusion' ? '#06b6d4' : 'rgba(255,255,255,0.15)'),
                        background: stencilMode3D === 'extrusion' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                        color: stencilMode3D === 'extrusion' ? '#06b6d4' : 'rgba(255,255,255,0.7)',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      onClick={() => setStencilMode3D('extrusion')}
                    >
                      <span>3D Extruded Outline</span>
                      <span style={{ fontSize: '10px', fontWeight: 'normal', opacity: 0.7 }}>Best for outline stencils</span>
                    </button>
                    <button
                      type="button"
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid ' + (stencilMode3D === 'heightmap' ? '#06b6d4' : 'rgba(255,255,255,0.15)'),
                        background: stencilMode3D === 'heightmap' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                        color: stencilMode3D === 'heightmap' ? '#06b6d4' : 'rgba(255,255,255,0.7)',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      onClick={() => setStencilMode3D('heightmap')}
                    >
                      <span>3D Volumetric Mesh</span>
                      <span style={{ fontSize: '10px', fontWeight: 'normal', opacity: 0.7 }}>Best for photos & shading</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Threshold Slider */}
              <SmoothSlider 
                label="Edge Detection Threshold (Sensitivity)"
                min="10"
                max="180"
                step="1"
                value={stencilThreshold}
                onRelease={(val) => setStencilThreshold(val)}
              />

              {/* Scale Slider */}
              <SmoothSlider 
                label="Stencil Scale"
                min="0.3"
                max="2.0"
                step="0.05"
                value={stencilScale}
                onRelease={(val) => setStencilScale(val)}
                formatValue={(v) => `${Math.round(v * 100)}%`}
              />

              {/* Checkbox / Toggle Options */}
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginTop: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>
                  <input 
                    type="checkbox"
                    checked={stencilInvert}
                    onChange={(e) => setStencilInvert(e.target.checked)}
                    style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                  />
                  <span>Invert Preview Colors (White lines on Dark)</span>
                </label>
              </div>
            </div>

            {/* Action Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <button 
                type="button" 
                className="glass-btn glass-btn-danger" 
                onClick={() => { setUploadedImage(null); setStencilPreviewUrl(''); }}
              >
                Change Image
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  type="button" 
                  className="glass-btn" 
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="glass-btn glass-btn-primary" 
                  onClick={handleApplyStencil}
                  disabled={!stencilPreviewUrl}
                >
                  Convert & Apply Stencil
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
