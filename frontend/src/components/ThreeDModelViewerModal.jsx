import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Box, X, Crosshair, Zap, Download } from 'lucide-react';
import { drawModel, getModelStats, generateOBJString } from '../utils/3dUtils';

export default function ThreeDModelViewerModal({ isOpen, onClose, objects, onDownloadAgain }) {
  const modalCanvasRef = useRef(null);
  const [renderMode, setRenderMode] = useState('solid'); // solid, wireframe, point
  const [lightAngle, setLightAngle] = useState(135);
  const [camera, setCamera] = useState({ rx: 0.4, ry: -0.6, scale: 1.2 });
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  const handleResetView = () => {
    setCamera({ rx: 0.4, ry: -0.6, scale: 1.2 });
  };

  useEffect(() => {
    if (!isOpen || !modalCanvasRef.current || !objects) return;
    drawModel(modalCanvasRef.current, objects, camera, renderMode, lightAngle);
  }, [isOpen, objects, camera, renderMode, lightAngle]);

  if (!isOpen || !objects) return null;

  const handleMouseDown = (e) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    
    setCamera(prev => ({
      rx: Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, prev.rx - dy * 0.008)),
      ry: prev.ry + dx * 0.008,
      scale: prev.scale
    }));
    
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setCamera(prev => ({
      ...prev,
      scale: Math.max(0.2, Math.min(5.0, prev.scale * zoomFactor))
    }));
  };

  const stats = getModelStats(objects);

  return createPortal(
    <div className="modal-backdrop-glass" onClick={onClose}>
      <div 
        className="glass-panel-heavy fade-in" 
        style={{
          ...styles.modalContent,
          maxWidth: '900px',
          width: '95%',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          padding: '24px',
          margin: 'auto'
        }} 
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Box size={20} color="var(--theme-color-2)" />
            <h2 style={{ ...styles.modalTitle, margin: 0, fontSize: '20px' }}>Interactive 3D Model Viewer</h2>
          </div>
          <button 
            className="glass-btn" 
            style={{ padding: '6px 10px', minWidth: 'auto', border: 'none', background: 'transparent' }} 
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{
          background: 'rgba(6, 182, 212, 0.05)',
          border: '1px solid rgba(6, 182, 212, 0.15)',
          padding: '10px 14px',
          borderRadius: '8px',
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.8)',
          lineHeight: '1.4'
        }}>
          🎉 <strong>3D Model Downloaded!</strong> Drag on the viewport to rotate, and use your mouse wheel to zoom in/out. Explore your creation in different render styles below.
        </div>

        <div style={{
          display: 'flex',
          gap: '20px',
          flexDirection: 'row',
          flexWrap: 'wrap'
        }}>
          <div style={{
            flex: '2 1 450px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{
              position: 'relative',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: '#0a0518',
              overflow: 'hidden',
              cursor: 'grab',
              height: '420px',
              width: '100%'
            }}>
              <canvas
                ref={modalCanvasRef}
                width="600"
                height="420"
                style={{ width: '100%', height: '100%', display: 'block' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
                onWheel={handleWheel}
              />
              <div style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'rgba(0, 0, 0, 0.5)',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '10px',
                color: 'rgba(255, 255, 255, 0.6)',
                backdropFilter: 'blur(4px)'
              }}>
                🖱️ Drag: Rotate | Scroll: Zoom
              </div>
            </div>
          </div>

          <div style={{
            flex: '1 1 250px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            justifyContent: 'space-between'
          }}>
            <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Render Style</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  className={`glass-btn ${renderMode === 'solid' ? 'glass-btn-active' : ''}`}
                  onClick={() => setRenderMode('solid')}
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                >
                  <Box size={14} style={{ marginRight: '8px' }} />
                  <span>Glassmorphic Solid</span>
                </button>
                <button
                  className={`glass-btn ${renderMode === 'wireframe' ? 'glass-btn-active' : ''}`}
                  onClick={() => setRenderMode('wireframe')}
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                >
                  <Crosshair size={14} style={{ marginRight: '8px' }} />
                  <span>Neon Wireframe</span>
                </button>
                <button
                  className={`glass-btn ${renderMode === 'point' ? 'glass-btn-active' : ''}`}
                  onClick={() => setRenderMode('point')}
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                >
                  <Zap size={14} style={{ marginRight: '8px' }} />
                  <span>Vertex Point Cloud</span>
                </button>
              </div>
            </div>

            {renderMode === 'solid' && (
              <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Light Direction</span>
                  <span style={{ fontSize: '11px', color: 'var(--theme-color-2)' }}>{lightAngle}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={lightAngle}
                  onChange={(e) => setLightAngle(parseInt(e.target.value))}
                  className="glass-range"
                />
              </div>
            )}

            <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: '4px' }}>Model Stats</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>Total Elements:</span>
                <span style={{ fontWeight: 'bold' }}>{stats.objectCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>Strokes:</span>
                <span style={{ fontWeight: 'bold' }}>{stats.strokeCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>Primitives:</span>
                <span style={{ fontWeight: 'bold' }}>{stats.shapeCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>Total Vertices:</span>
                <span style={{ fontWeight: 'bold' }}>{stats.totalVertices}</span>
              </div>
              {renderMode === 'solid' && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>Total Faces:</span>
                  <span style={{ fontWeight: 'bold' }}>{stats.totalFaces}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="glass-btn"
                onClick={handleResetView}
                style={{ flex: 1, padding: '10px', fontSize: '13px' }}
                title="Reset Rotation & Zoom"
              >
                Reset Camera
              </button>
              <button
                className="glass-btn glass-btn-primary"
                onClick={() => onDownloadAgain(renderMode)}
                style={{ flex: 1.2, padding: '10px', fontSize: '13px' }}
                title="Download OBJ File"
              >
                <Download size={13} style={{ marginRight: '6px' }} />
                <span>Download OBJ</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

const styles = {
  modalBg: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 5, 24, 0.75)',
    backdropFilter: 'blur(12px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: 'transparent',
    border: 'none',
  },
  modalTitle: {
    color: '#fff',
    fontWeight: '700',
  },
};
