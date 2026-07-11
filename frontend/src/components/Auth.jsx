import React, { useState } from 'react'
import { User, Lock, LogIn, UserPlus, Sparkles, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { BACKEND_URL } from '../App'
import { getFriendlyErrorMessage } from '../utils/errorHelper'

export default function Auth({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [hoverEye, setHoverEye] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields')
      return
    }

    if (username.length < 3) {
      setError('Username must be at least 3 characters long')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }

    setLoading(true)
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register'

    try {
      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      const data = await res.json()
      if (res.ok) {
        onLoginSuccess(data.username, data.token, data.profile_picture)
      } else {
        setError(getFriendlyErrorMessage(data.detail || data, 'Authentication failed. Please check your credentials.'))
      }
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Could not connect to the server. Please verify the backend is running.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fade-in" style={styles.container}>
      <div className="theme-modal-panel" style={styles.card}>
        <div style={styles.header}>
          <div className="logo-icon" style={styles.logoIcon}>
            <Sparkles size={20} color="#fff" />
          </div>
          <h2 style={styles.title}>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
          <p style={styles.subtitle}>
            {isLogin 
              ? 'Sign in to access your custom sketches and drawings' 
              : 'Register a profile to save drawings to your personal gallery'
            }
          </p>
        </div>

        {error && (
          <div style={styles.errorAlert}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Username</label>
            <div style={styles.inputWrapper}>
              <User size={16} style={styles.inputIcon} />
              <input 
                type="text" 
                className="glass-input" 
                style={styles.inputWithIcon}
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <div style={styles.inputWrapper}>
              <Lock size={16} style={styles.inputIcon} />
              <input 
                type={showPassword ? "text" : "password"} 
                className="glass-input" 
                style={{ ...styles.inputWithIcon, paddingRight: '40px' }}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                style={{ 
                  ...styles.eyeBtn, 
                  color: hoverEye ? '#fff' : 'var(--text-muted)' 
                }}
                onClick={() => setShowPassword(!showPassword)}
                onMouseEnter={() => setHoverEye(true)}
                onMouseLeave={() => setHoverEye(false)}
                tabIndex="-1"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="glass-btn glass-btn-primary" style={styles.submitBtn} disabled={loading}>
            {isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
            <span>{loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}</span>
          </button>
        </form>

        <div style={styles.toggleRow}>
          <span>{isLogin ? "Don't have an account?" : 'Already have an account?'}</span>
          <button 
            type="button" 
            style={styles.toggleBtn}
            onClick={() => {
              setIsLogin(!isLogin)
              setError('')
              setShowPassword(false)
            }}
          >
            {isLogin ? 'Sign Up Now' : 'Log In Here'}
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    minHeight: 'calc(100vh - 200px)',
  },
  card: {
    width: '100%',
    maxWidth: '440px',
    padding: '36px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  header: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
  },
  logoIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, var(--theme-color-1) 0%, var(--theme-color-2) 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)',
    marginBottom: '8px',
  },
  title: {
    fontFamily: 'var(--font-title)',
    fontSize: '26px',
    fontWeight: '800',
    letterSpacing: '-0.5px',
    color: '#fff',
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(244, 63, 94, 0.1)',
    border: '1px solid rgba(244, 63, 94, 0.2)',
    color: '#fda4af',
    borderRadius: '12px',
    padding: '12px 16px',
    fontSize: '13px',
    fontWeight: '500',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#d4d4d8',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '14px',
    color: 'var(--text-muted)',
    pointerEvents: 'none',
  },
  inputWithIcon: {
    paddingLeft: '40px',
  },
  eyeBtn: {
    position: 'absolute',
    right: '14px',
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px',
    borderRadius: '4px',
    transition: 'color 0.2s ease',
    outline: 'none',
  },
  submitBtn: {
    width: '100%',
    justifyContent: 'center',
    marginTop: '8px',
    padding: '14px',
  },
  toggleRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: '6px',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    marginTop: '10px',
  },
  toggleBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--theme-color-2)',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
  }
}
