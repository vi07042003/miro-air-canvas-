import React from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Info } from 'lucide-react'

export default function GlassDialog({ 
  isOpen, 
  type = 'confirm', 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = 'OK', 
  cancelText = 'Cancel' 
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
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
            perspective: '1000px'
          }}
        >
          {/* Backdrop blur overlay */}
          <motion.div 
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1 }
            }}
            transition={{ duration: 0.25 }}
            onClick={type === 'confirm' ? onCancel : onConfirm}
            className="modal-backdrop-glass"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: -1
            }}
          />

          {/* Dialog Content Box */}
          <motion.div
            variants={{
              hidden: { opacity: 0, scale: 0.95, y: 15, rotateX: -5 },
              visible: { opacity: 1, scale: 1, y: 0, rotateX: 0 }
            }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="glass-panel-heavy"
            style={{
              width: '90%',
              maxWidth: '400px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              position: 'relative',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
              margin: 'auto',
              transformStyle: 'preserve-3d'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div 
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: type === 'confirm' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                  border: type === 'confirm' ? '1px solid rgba(244, 63, 94, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                {type === 'confirm' ? (
                  <AlertTriangle size={20} color="#fda4af" />
                ) : (
                  <Info size={20} color="#93c5fd" />
                )}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#fff', fontFamily: 'var(--font-title)' }}>
                  {title}
                </h3>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  {message}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              {type === 'confirm' && (
                <button 
                  className="glass-btn" 
                  onClick={onCancel}
                  style={{
                    padding: '10px 18px',
                    fontSize: '14px',
                    borderRadius: '10px',
                    cursor: 'pointer'
                  }}
                >
                  {cancelText}
                </button>
              )}
              <button 
                className="glass-btn glass-btn-primary" 
                onClick={onConfirm}
                style={{
                  padding: '10px 18px',
                  fontSize: '14px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  background: type === 'confirm' ? 'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)' : undefined,
                  borderColor: type === 'confirm' ? 'rgba(244, 63, 94, 0.4)' : undefined,
                  boxShadow: type === 'confirm' ? '0 4px 15px rgba(244, 63, 94, 0.3)' : undefined
                }}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
