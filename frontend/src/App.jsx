import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Home, Image, Settings as SettingsIcon, Palette, LogIn, LogOut, User as UserIcon, Lock, X, Sparkles } from 'lucide-react'
import LandingPage from './components/LandingPage'
import AirCanvas from './components/AirCanvas'
import Gallery from './components/Gallery'
import Settings from './components/Settings'
import Auth from './components/Auth'
import WelcomeAnimation from './components/WelcomeAnimation'
import { AnimatePresence, motion } from 'framer-motion'

// Backend URL configuration
export const BACKEND_URL = 'http://localhost:8000'

function App() {
  const [showWelcome, setShowWelcome] = useState(true)
  const [activePage, setActivePage] = useState('landing')
  
  // User Session State
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('token')
    const username = localStorage.getItem('username')
    const profilePicture = localStorage.getItem('profile_picture')
    return token && username ? { username, token, profilePicture } : null
  })

  // Profile Modal State
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [editUsername, setEditUsername] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editProfilePicture, setEditProfilePicture] = useState('')
  const [profileMessage, setProfileMessage] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)
  const [editingDrawing, setEditingDrawing] = useState(null)

  // AI Stencil Generator State
  const [showStencilGenModal, setShowStencilGenModal] = useState(false)
  const [stencilKeyword, setStencilKeyword] = useState('')
  const [stencilGenLoading, setStencilGenLoading] = useState(false)
  const [stencilGenResult, setStencilGenResult] = useState(null)
  const [stencilUsage, setStencilUsage] = useState({ count: 0, max: 10 })
  const [stencilGenError, setStencilGenError] = useState('')
  const [externalStencil, setExternalStencil] = useState(null)

  // Theme Configuration
  const [theme, setTheme] = useState(() => {
    const savedName = localStorage.getItem('theme_name')
    const savedColor1 = localStorage.getItem('theme_color_1')
    const savedColor2 = localStorage.getItem('theme_color_2')
    return savedName && savedColor1 && savedColor2 
      ? { name: savedName, color1: savedColor1, color2: savedColor2 }
      : { name: 'Aurora Sky', color1: '#00f2fe', color2: '#4facfe' }
  })

  // Glass Transparency Configuration
  const [glassOpacity, setGlassOpacity] = useState(() => {
    const saved = localStorage.getItem('glass_opacity')
    return saved ? parseInt(saved, 10) : 80
  })

  // Apply glass transparency dynamically to :root
  useEffect(() => {
    const root = document.documentElement
    // Calculate alpha factor from transparency percentage (e.g. 80% transparency -> 0.06 alpha)
    const glassOpacityVal = 0.3 * (1 - glassOpacity / 100)
    root.style.setProperty('--glass-opacity-val', glassOpacityVal)
  }, [glassOpacity])

  // Apply theme variables dynamically to :root
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--theme-color-1', theme.color1)
    root.style.setProperty('--theme-color-2', theme.color2)
    
    // Hex to RGB conversion for CSS alpha glows
    const hexToRgb = (hex) => {
      let c = hex.substring(1)
      if (c.length === 3) {
        c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2]
      }
      const r = parseInt(c.substring(0, 2), 16)
      const g = parseInt(c.substring(2, 4), 16)
      const b = parseInt(c.substring(4, 6), 16)
      return `${r}, ${g}, ${b}`
    }
    
    root.style.setProperty('--theme-color-1-rgb', hexToRgb(theme.color1))
    root.style.setProperty('--theme-color-2-rgb', hexToRgb(theme.color2))
  }, [theme])

  // Reset editing drawing when user leaves the canvas page
  useEffect(() => {
    if (activePage !== 'canvas') {
      setEditingDrawing(null)
    }
  }, [activePage])

  // Fetch stencil usage stats from backend
  const fetchStencilUsage = async () => {
    if (!user || !user.token) return
    try {
      const response = await fetch(`${BACKEND_URL}/api/stencil/usage`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setStencilUsage({ count: data.usage_count, max: data.max_usage, resetTime: data.reset_time })
      }
    } catch (err) {
      console.error("Failed to fetch stencil usage:", err)
    }
  }

  // Load stencil usage on modal open
  useEffect(() => {
    if (showStencilGenModal && user) {
      fetchStencilUsage()
      setStencilGenError('')
      setStencilKeyword('')
      setStencilGenResult(null)
    }
  }, [showStencilGenModal, user])

  // Handle generating the stencil using backend AI
  const handleGenerateStencil = async (e) => {
    if (e) e.preventDefault()
    const keyword = stencilKeyword.trim()
    if (!keyword) return

    setStencilGenLoading(true)
    setStencilGenError('')
    setStencilGenResult(null)

    try {
      const response = await fetch(`${BACKEND_URL}/api/stencil/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ keyword })
      })

      const data = await response.json()
      if (!response.ok) {
        setStencilGenError(data.detail || 'Failed to generate stencil')
      } else {
        // Fetch the image from the returned stencil_url in the browser to avoid server timeout
        const imgRes = await fetch(data.stencil_url)
        if (!imgRes.ok) throw new Error("Failed to load image from generator")
        const blob = await imgRes.blob()
        const base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })

        setStencilGenResult(base64Data)
        setStencilUsage({ count: data.usage_count, max: data.max_usage, resetTime: data.reset_time })
      }
    } catch (err) {
      setStencilGenError(err.message === "Failed to load image from generator"
        ? 'Failed to fetch the image from AI service. Please try again.'
        : 'Network error. Failed to connect to server.')
      console.error(err)
    } finally {
      setStencilGenLoading(false)
    }
  }

  // Handle applying stencil to canvas
  const handleApplyStencil = () => {
    if (!stencilGenResult) return
    setExternalStencil(stencilGenResult)
    setShowStencilGenModal(false)
    navigateTo('canvas')
  }

  // Format the stencil usage limit reset time
  const formatResetTime = (isoString) => {
    if (!isoString) return ''
    try {
      const dateObj = isoString.endsWith('Z') ? new Date(isoString) : new Date(isoString + 'Z')
      if (isNaN(dateObj.getTime())) return ''
      return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch (e) {
      return ''
    }
  }

  // Change theme handler
  const handleThemeChange = (color1, color2, name) => {
    setTheme({ color1, color2, name })
    localStorage.setItem('theme_name', name)
    localStorage.setItem('theme_color_1', color1)
    localStorage.setItem('theme_color_2', color2)
  }

  // Session login success callback
  const handleLoginSuccess = (username, token, profilePicture) => {
    localStorage.setItem('token', token)
    localStorage.setItem('username', username)
    if (profilePicture) {
      localStorage.setItem('profile_picture', profilePicture)
    } else {
      localStorage.removeItem('profile_picture')
    }
    setUser({ username, token, profilePicture })
    // Redirect back to where the user wanted to go
    if (activePage === 'auth') {
      setActivePage('canvas')
    }
  }

  // Session logout callback
  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    localStorage.removeItem('profile_picture')
    setUser(null)
    setActivePage('landing')
  }

  // Profile Click Handler
  const handleProfileClick = () => {
    if (!user) return
    setEditUsername(user.username)
    setEditPassword('')
    setEditProfilePicture(user.profilePicture || '')
    setProfileMessage('')
    setShowProfileModal(true)
  }

  // Handle file picker selection and base64 conversion
  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Limit size to 2MB to keep PostgreSQL and payload lightweight
    if (file.size > 2 * 1024 * 1024) {
      setProfileMessage('Image size must be less than 2MB')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setEditProfilePicture(reader.result)
    }
    reader.onerror = () => {
      setProfileMessage('Failed to read image file')
    }
    reader.readAsDataURL(file)
  }

  // Profile Update Submission Handler
  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    if (!editUsername.trim()) {
      setProfileMessage('Username cannot be empty')
      return
    }
    if (editUsername.trim().length < 3) {
      setProfileMessage('Username must be at least 3 characters long')
      return
    }
    if (editPassword && editPassword.length < 6) {
      setProfileMessage('Password must be at least 6 characters long')
      return
    }

    setProfileLoading(true)
    setProfileMessage('')
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          username: editUsername.trim(),
          password: editPassword || null,
          profile_picture: editProfilePicture || null
        })
      })

      const data = await response.json()
      if (!response.ok) {
        setProfileMessage(data.detail || 'Failed to update profile')
      } else {
        // Update user state
        setUser({ username: data.username, token: data.token, profilePicture: data.profile_picture })
        localStorage.setItem('username', data.username)
        localStorage.setItem('token', data.token)
        if (data.profile_picture) {
          localStorage.setItem('profile_picture', data.profile_picture)
        } else {
          localStorage.removeItem('profile_picture')
        }
        setProfileMessage('Profile updated successfully!')
        setTimeout(() => {
          setShowProfileModal(false)
        }, 1500)
      }
    } catch (err) {
      setProfileMessage('Error connecting to backend')
    } finally {
      setProfileLoading(false)
    }
  }

  // Safe navigation: always redirects to auth for protected pages
  const navigateTo = (page) => {
    const protectedPages = ['canvas', 'gallery']
    if (protectedPages.includes(page) && !user) {
      setActivePage('auth')
    } else {
      setActivePage(page)
    }
  }

  const renderPage = () => {
    // Strict auth gate — canvas and gallery are ALWAYS blocked without a session
    if ((activePage === 'canvas' || activePage === 'gallery') && !user) {
      return (
        <motion.div
          key="auth"
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -15 }}
          transition={{ duration: 0.22, ease: 'easeInOut' }}
        >
          <Auth onLoginSuccess={handleLoginSuccess} />
        </motion.div>
      )
    }

    // Show auth page when explicitly requested (unauthenticated)
    if (activePage === 'auth' && !user) {
      return (
        <motion.div
          key="auth"
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -15 }}
          transition={{ duration: 0.22, ease: 'easeInOut' }}
        >
          <Auth onLoginSuccess={handleLoginSuccess} />
        </motion.div>
      )
    }

    // Already logged in but ended up on auth page — go to canvas
    if (activePage === 'auth' && user) {
      return (
        <motion.div
          key="canvas"
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -15 }}
          transition={{ duration: 0.22, ease: 'easeInOut' }}
        >
          <AirCanvas 
            initialDrawing={editingDrawing} 
            onDrawingCleared={() => setEditingDrawing(null)} 
            onDrawingSaved={(drawing) => setEditingDrawing(drawing)}
            initialStencil={externalStencil}
            onClearInitialStencil={() => setExternalStencil(null)}
          />
        </motion.div>
      )
    }

    switch (activePage) {
      case 'landing':
        return (
          <motion.div
            key="landing"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
          >
            <LandingPage onStartCanvas={() => navigateTo('canvas')} />
          </motion.div>
        )
      case 'canvas':
        return (
          <motion.div
            key="canvas"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
          >
            <AirCanvas 
              initialDrawing={editingDrawing} 
              onDrawingCleared={() => setEditingDrawing(null)} 
              onDrawingSaved={(drawing) => setEditingDrawing(drawing)}
              initialStencil={externalStencil}
              onClearInitialStencil={() => setExternalStencil(null)}
            />
          </motion.div>
        )
      case 'gallery':
        return (
          <motion.div
            key="gallery"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
          >
            <Gallery onEditDrawing={(drawing) => {
              setEditingDrawing(drawing)
              setActivePage('canvas')
            }} />
          </motion.div>
        )
      case 'settings':
        return (
          <motion.div
            key="settings"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
          >
            <Settings 
              onThemeChange={handleThemeChange} 
              activeThemeName={theme.name}
              glassOpacity={glassOpacity}
              onGlassOpacityChange={(val) => {
                setGlassOpacity(val)
                localStorage.setItem('glass_opacity', val)
              }}
            />
          </motion.div>
        )
      default:
        return (
          <motion.div
            key="landing"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
          >
            <LandingPage onStartCanvas={() => navigateTo('canvas')} />
          </motion.div>
        )
    }
  }

  return (
    <AnimatePresence mode="wait">
      {showWelcome ? (
        <WelcomeAnimation key="welcome" onComplete={() => setShowWelcome(false)} />
      ) : (
        <motion.div
          key="main-app"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}
        >
          {/* Background liquid elements */}
          <div className="app-bg-container">
            <div className="liquid-blob blob-1"></div>
            <div className="liquid-blob blob-2"></div>
            <div className="liquid-blob blob-3"></div>
            <div className="liquid-blob blob-4"></div>
            <div className="liquid-blob blob-5"></div>
          </div>

          {/* Main Glass Header */}
          <header className="header-glass">
            <div className="logo-container" onClick={() => setActivePage('landing')}>
              <div className="logo-icon" style={{ padding: '6px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ffffff" />
                      <stop offset="100%" stopColor="rgba(255, 255, 255, 0.75)" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M5 18C5 18 8 6 10.5 6C12.5 6 12 13.5 13.5 13.5C15 13.5 16.5 7.5 19 7.5"
                    stroke="url(#logo-grad)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M19 3.5 Q19 7.5 23 7.5 Q19 7.5 19 11.5 Q19 7.5 15 7.5 Q19 7.5 19 3.5"
                    fill="#ffffff"
                  />
                </svg>
              </div>
              <span className="header-logo-text">
                <span className="header-brand-mi">MI</span>
                <span className="header-brand-ro">RO</span>
                <span className="header-brand-canvas">CANVAS</span>
              </span>
            </div>

            <nav className="nav-links">
              <button 
                className={`nav-item ${activePage === 'landing' ? 'nav-item-active' : ''}`}
                onClick={() => setActivePage('landing')}
              >
                <Home size={19} />
                <span>Home</span>
              </button>
              <button 
                className={`nav-item ${activePage === 'canvas' ? 'nav-item-active' : ''} ${!user ? 'nav-item-locked' : ''}`}
                onClick={() => navigateTo('canvas')}
                title={!user ? 'Sign in to access Canvas' : 'Canvas'}
              >
                <Palette size={19} />
                <span>Canvas</span>
                {!user && <Lock size={13} style={{ opacity: 0.5, marginLeft: '2px' }} />}
              </button>
              <button 
                className={`nav-item ${activePage === 'gallery' ? 'nav-item-active' : ''} ${!user ? 'nav-item-locked' : ''}`}
                onClick={() => navigateTo('gallery')}
                title={!user ? 'Sign in to access Gallery' : 'Gallery'}
              >
                <Image size={19} />
                <span>Gallery</span>
                {!user && <Lock size={13} style={{ opacity: 0.5, marginLeft: '2px' }} />}
              </button>
              <button 
                className={`nav-item ${showStencilGenModal ? 'nav-item-active' : ''} ${!user ? 'nav-item-locked' : ''}`}
                onClick={() => {
                  if (!user) {
                    alert("Please sign in to use the AI Stencil Generator.");
                    return;
                  }
                  setShowStencilGenModal(true);
                }}
                title={!user ? 'Sign in to generate AI stencils' : 'AI Stencil Generator'}
              >
                <Sparkles size={19} />
                <span>AI Stencils</span>
                {!user && <Lock size={13} style={{ opacity: 0.5, marginLeft: '2px' }} />}
              </button>
              <button 
                className={`nav-item ${activePage === 'settings' ? 'nav-item-active' : ''}`}
                onClick={() => setActivePage('settings')}
              >
                <SettingsIcon size={19} />
                <span>Settings</span>
              </button>
            </nav>

            {/* User Session Nav Panel */}
            <div style={styles.authPanel}>
              {user ? (
                <div style={styles.userInfoRow}>
                  <div className="user-badge-wrapper">
                    <div className="user-badge-clickable" onClick={handleProfileClick} title="Edit Profile">
                      {user.profilePicture ? (
                        <img src={user.profilePicture} style={styles.headerAvatar} alt="Profile" />
                      ) : (
                        <UserIcon size={18} color="var(--theme-color-2)" />
                      )}
                      <span>{user.username}</span>
                    </div>

                    {/* Profile Hover Card */}
                    <div className="profile-hover-card" onClick={handleProfileClick} title="Edit Profile">
                      <div className="profile-hover-avatar">
                        {user.profilePicture ? (
                          <img src={user.profilePicture} className="profile-hover-img" alt="Profile" />
                        ) : (
                          <UserIcon size={24} color="var(--theme-color-2)" />
                        )}
                      </div>
                      <div className="profile-hover-info">
                        <div className="profile-hover-name">{user.username}</div>
                        <div className="profile-hover-hint">Click to edit profile</div>
                      </div>
                    </div>
                  </div>
                  <button className="glass-btn" style={styles.authBtn} onClick={handleLogout} title="Log Out">
                    <LogOut size={16} />
                    <span>Log Out</span>
                  </button>
                </div>
              ) : (
                <button className="glass-btn glass-btn-primary" style={styles.authBtn} onClick={() => setActivePage('auth')}>
                  <LogIn size={16} />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          </header>

          {/* Main Content Area */}
          <main style={{ minHeight: 'calc(100vh - 73px)', padding: '24px', position: 'relative', overflowX: 'hidden' }}>
            <AnimatePresence mode="wait">
              {renderPage()}
            </AnimatePresence>
          </main>

          {/* Profile Edit Modal */}
          {showProfileModal && createPortal(
            <div className="modal-backdrop-glass" onClick={() => setShowProfileModal(false)}>
              <div className="glass-panel-heavy fade-in" style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <div style={styles.modalHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <UserIcon size={20} color="var(--theme-color-2)" />
                    <h3 style={styles.modalTitle}>User Profile</h3>
                  </div>
                  <button style={styles.closeBtn} onClick={() => setShowProfileModal(false)}>
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleUpdateProfile} style={styles.modalBody}>
                  <div style={styles.avatarSection}>
                    <div style={styles.avatarContainer}>
                      {editProfilePicture ? (
                        <img src={editProfilePicture} style={styles.profilePreview} alt="Preview" />
                      ) : (
                        <UserIcon size={36} color="var(--theme-color-2)" />
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <label className="glass-btn" style={styles.uploadBtn}>
                        <span>Choose Photo</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          style={{ display: 'none' }} 
                          onChange={handleFileChange}
                        />
                      </label>
                      {editProfilePicture && (
                        <button 
                          type="button" 
                          className="glass-btn" 
                          style={styles.removeBtn}
                          onClick={() => setEditProfilePicture('')}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Username</label>
                    <input 
                      type="text" 
                      className="glass-input"
                      style={styles.modalInput}
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      placeholder="Enter username"
                      required
                    />
                  </div>

                  <div style={styles.inputGroup}>
                    <label style={styles.label}>New Password (Optional)</label>
                    <input 
                      type="password" 
                      className="glass-input"
                      style={styles.modalInput}
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="Leave blank to keep current password"
                    />
                  </div>

                  {profileMessage && (
                    <div style={{
                      ...styles.modalMessage,
                      color: profileMessage.includes('successfully') ? '#10b981' : '#f43f5e'
                    }}>
                      {profileMessage}
                    </div>
                  )}

                  <button 
                    type="submit" 
                    className="glass-btn glass-btn-primary" 
                    style={styles.modalSubmitBtn}
                    disabled={profileLoading}
                  >
                    {profileLoading ? 'Saving Changes...' : 'Save Profile'}
                  </button>
                </form>
              </div>
            </div>,
            document.body
          )}

          {/* AI Stencil Generator Modal */}
          {showStencilGenModal && createPortal(
            <div className="modal-backdrop-glass" onClick={() => setShowStencilGenModal(false)}>
              <div className="glass-panel-heavy fade-in" style={styles.stencilModalContent} onClick={(e) => e.stopPropagation()}>
                <div style={styles.modalHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Sparkles size={22} color="var(--theme-color-2)" />
                    <h3 style={styles.modalTitle}>AI Stencil Generator</h3>
                  </div>
                  <button style={styles.closeBtn} onClick={() => setShowStencilGenModal(false)}>
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleGenerateStencil} style={styles.modalBody}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={styles.label}>What would you like to paint?</label>
                    <span style={{ fontSize: '11px', color: stencilUsage.count >= stencilUsage.max ? '#ef4444' : 'rgba(255,255,255,0.6)', fontWeight: 'bold' }}>
                      Usage: {stencilUsage.count} / {stencilUsage.max} gens
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="text"
                      placeholder="e.g. rocket, butterfly, heart, star..."
                      value={stencilKeyword}
                      onChange={(e) => setStencilKeyword(e.target.value)}
                      className="glass-input"
                      style={{
                        ...styles.modalInput,
                        flex: 1,
                      }}
                      disabled={stencilGenLoading || stencilUsage.count >= stencilUsage.max}
                    />
                    <button
                      type="submit"
                      className="glass-btn glass-btn-primary"
                      style={{ minWidth: '110px', justifyContent: 'center' }}
                      disabled={stencilGenLoading || !stencilKeyword.trim() || stencilUsage.count >= stencilUsage.max}
                    >
                      {stencilGenLoading ? 'Generating...' : 'Generate'}
                    </button>
                  </div>

                  {stencilUsage.resetTime && (
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', textAlign: 'right', marginTop: '-8px' }}>
                      Rolling 24h limit resets at {formatResetTime(stencilUsage.resetTime)}
                    </div>
                  )}

                  {stencilGenError && (
                    <div style={{ 
                      background: 'rgba(244, 63, 94, 0.15)', 
                      border: '1px solid rgba(244, 63, 94, 0.3)', 
                      color: '#fda4af', 
                      padding: '10px 14px', 
                      borderRadius: '10px', 
                      fontSize: '13px' 
                    }}>
                      {stencilGenError}
                    </div>
                  )}

                  {stencilUsage.count >= stencilUsage.max && !stencilGenResult && (
                    <div style={{ 
                      background: 'rgba(239, 68, 68, 0.15)', 
                      border: '1px solid rgba(239, 68, 68, 0.3)', 
                      color: '#f87171', 
                      padding: '10px 14px', 
                      borderRadius: '10px', 
                      fontSize: '13px' 
                    }}>
                      ⚠️ You have reached your limit of {stencilUsage.max} free AI stencil generations. Limit resets at {formatResetTime(stencilUsage.resetTime)}.
                    </div>
                  )}

                  {/* Stencil Result Preview */}
                  {stencilGenResult && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center', marginTop: '10px' }}>
                      <div style={{ 
                        width: '100%', 
                        height: '220px', 
                        borderRadius: '14px', 
                        border: '1px solid rgba(255, 255, 255, 0.1)', 
                        background: 'rgba(0,0,0,0.3)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        overflow: 'hidden',
                        position: 'relative'
                      }}>
                        <img 
                          src={stencilGenResult} 
                          alt="Generated Stencil" 
                          style={{ 
                            maxHeight: '100%', 
                            maxWidth: '100%', 
                            objectFit: 'contain', 
                            filter: 'invert(1) drop-shadow(0 0 8px rgba(6, 182, 212, 0.6))'
                          }} 
                        />
                      </div>
                      <button
                        type="button"
                        className="glass-btn"
                        style={{
                          width: '100%',
                          justifyContent: 'center',
                          background: 'linear-gradient(135deg, var(--theme-color-2) 0%, var(--theme-color-1) 100%)',
                          color: '#fff',
                          border: 'none',
                          boxShadow: '0 4px 15px rgba(6, 182, 212, 0.3)'
                        }}
                        onClick={handleApplyStencil}
                      >
                        <span>Apply Stencil to Canvas</span>
                      </button>
                    </div>
                  )}
                </form>
              </div>
            </div>,
            document.body
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const styles = {
  authPanel: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  userInfoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  userBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--glass-border)',
    padding: '8px 12px',
    borderRadius: '10px',
    fontSize: '13px',
    fontWeight: '500',
    color: '#fff',
  },
  headerAvatar: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '1px solid var(--theme-color-2)',
  },
  authBtn: {
    padding: '10px 18px',
    fontSize: '15px',
    borderRadius: '10px',
  },
  avatarSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px',
  },
  avatarContainer: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.03)',
    border: '2px dashed var(--glass-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profilePreview: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  uploadBtn: {
    padding: '8px 16px',
    fontSize: '13px',
    borderRadius: '10px',
    cursor: 'pointer',
  },
  removeBtn: {
    padding: '8px 16px',
    fontSize: '13px',
    borderRadius: '10px',
    background: 'rgba(244, 63, 94, 0.15)',
    borderColor: 'rgba(244, 63, 94, 0.3)',
    color: '#fda4af',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  modalBg: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(3, 1, 8, 0.75)',
    backdropFilter: 'blur(8px)',
    zIndex: 2000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  modalContent: {
    width: '100%',
    maxWidth: '400px',
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    margin: 'auto',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: 'var(--font-title)',
    fontSize: '20px',
    fontWeight: '700',
    color: '#fff',
    margin: 0,
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
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#d4d4d8',
    textAlign: 'left',
  },
  modalInput: {
    width: '100%',
    boxSizing: 'border-box',
  },
  modalSubmitBtn: {
    width: '100%',
    justifyContent: 'center',
    marginTop: '8px',
    padding: '14px',
  },
  modalMessage: {
    fontSize: '13px',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: '4px',
  },
  stencilModalContent: {
    width: '100%',
    maxWidth: '460px',
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    margin: 'auto',
  }
}

export default App
