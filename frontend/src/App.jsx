import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Home, Image, Settings as SettingsIcon, Palette, LogIn, LogOut, User as UserIcon, Lock, X, Sparkles } from 'lucide-react'
import LandingPage from './components/LandingPage'
import AirCanvas from './components/AirCanvas'
import Gallery from './components/Gallery'
import Settings from './components/Settings'
import Auth from './components/Auth'
import WelcomeAnimation from './components/WelcomeAnimation'
import AIStencils from './components/AIStencils'
import { AnimatePresence, motion } from 'framer-motion'

// Backend URL configuration
export const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

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
    
    // Dynamically adjust text opacity: when glass background is 0% transparent (solid),
    // text is 1.0 (fully solid). When glass is 100% transparent (clear), text is 0.85
    // (semi-transparent for style, yet still bright and readable).
    const textOpacityVal = 0.85 + (1 - glassOpacity / 100) * 0.15
    root.style.setProperty('--text-opacity', textOpacityVal)
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
    const protectedPages = ['canvas', 'gallery', 'stencils']
    if (protectedPages.includes(page) && !user) {
      setActivePage('auth')
    } else {
      setActivePage(page)
    }
  }
  const renderPage = () => {
    // Strict auth gate — canvas, gallery and stencils are ALWAYS blocked without a session
    if ((activePage === 'canvas' || activePage === 'gallery' || activePage === 'stencils') && !user) {
      return (
        <motion.div
          key="auth"
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -15 }}
          transition={{ duration: 0.22, ease: 'easeInOut' }}
          style={{ gridColumn: 1, gridRow: 1 }}
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
          style={{ gridColumn: 1, gridRow: 1 }}
        >
          <Auth onLoginSuccess={handleLoginSuccess} />
        </motion.div>
      )
    }

    // Already logged in but ended up on auth page — go to canvas
    if (activePage === 'auth' && user) {
      return null
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
            style={{ gridColumn: 1, gridRow: 1 }}
          >
            <LandingPage onStartCanvas={() => navigateTo('canvas')} />
          </motion.div>
        )
      case 'canvas':
        return null
      case 'gallery':
        return (
          <motion.div
            key="gallery"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            style={{ gridColumn: 1, gridRow: 1 }}
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
            style={{ gridColumn: 1, gridRow: 1 }}
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
      case 'stencils':
        return (
          <motion.div
            key="stencils"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            style={{ width: '100%', padding: '0 40px', gridColumn: 1, gridRow: 1 }}
          >
            <AIStencils 
              user={user}
              onApplyStencil={(stencilResult) => {
                setExternalStencil(stencilResult)
                navigateTo('canvas')
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
            style={{ gridColumn: 1, gridRow: 1 }}
          >
            <LandingPage onStartCanvas={() => navigateTo('canvas')} />
          </motion.div>
        )
    }
  }

  return (
    <>
      {/* Background liquid elements */}
      <div className="app-bg-container">
        <div className="liquid-blob blob-1"></div>
        <div className="liquid-blob blob-2"></div>
        <div className="liquid-blob blob-3"></div>
        <div className="liquid-blob blob-4"></div>
        <div className="liquid-blob blob-5"></div>
        <div className="liquid-blob blob-6"></div>
        <div className="liquid-blob blob-7"></div>
        <div className="liquid-blob blob-8"></div>
        <div className="liquid-blob blob-9"></div>
        <div className="liquid-blob blob-10"></div>
      </div>

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
                style={{ position: 'relative' }}
              >
                {activePage === 'landing' && (
                  <motion.div
                    layoutId="active-nav-pill"
                    className="nav-item-active-bg"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Home size={19} />
                  <span>Home</span>
                </span>
              </button>
              <button 
                className={`nav-item ${activePage === 'canvas' ? 'nav-item-active' : ''} ${!user ? 'nav-item-locked' : ''}`}
                onClick={() => navigateTo('canvas')}
                title={!user ? 'Sign in to access Canvas' : 'Canvas'}
                style={{ position: 'relative' }}
              >
                {(activePage === 'canvas') && (
                  <motion.div
                    layoutId="active-nav-pill"
                    className="nav-item-active-bg"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Palette size={19} />
                  <span>Canvas</span>
                  {!user && <Lock size={13} style={{ opacity: 0.5, marginLeft: '2px' }} />}
                </span>
              </button>
              <button 
                className={`nav-item ${activePage === 'gallery' ? 'nav-item-active' : ''} ${!user ? 'nav-item-locked' : ''}`}
                onClick={() => navigateTo('gallery')}
                title={!user ? 'Sign in to access Gallery' : 'Gallery'}
                style={{ position: 'relative' }}
              >
                {activePage === 'gallery' && (
                  <motion.div
                    layoutId="active-nav-pill"
                    className="nav-item-active-bg"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Image size={19} />
                  <span>Gallery</span>
                  {!user && <Lock size={13} style={{ opacity: 0.5, marginLeft: '2px' }} />}
                </span>
              </button>
              <button 
                className={`nav-item ${activePage === 'stencils' ? 'nav-item-active' : ''} ${!user ? 'nav-item-locked' : ''}`}
                onClick={() => navigateTo('stencils')}
                title={!user ? 'Sign in to generate AI stencils' : 'AI Stencil Generator'}
                style={{ position: 'relative' }}
              >
                {activePage === 'stencils' && (
                  <motion.div
                    layoutId="active-nav-pill"
                    className="nav-item-active-bg"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={19} />
                  <span>AI Stencils</span>
                  {!user && <Lock size={13} style={{ opacity: 0.5, marginLeft: '2px' }} />}
                </span>
              </button>
              <button 
                className={`nav-item ${activePage === 'settings' ? 'nav-item-active' : ''}`}
                onClick={() => setActivePage('settings')}
                style={{ position: 'relative' }}
              >
                {activePage === 'settings' && (
                  <motion.div
                    layoutId="active-nav-pill"
                    className="nav-item-active-bg"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <SettingsIcon size={19} />
                  <span>Settings</span>
                </span>
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
          <main style={{ 
            minHeight: 'calc(100vh - 73px)', 
            padding: '24px', 
            position: 'relative', 
            overflowX: 'hidden',
            display: 'grid',
            gridTemplateColumns: '100%',
            gridTemplateRows: 'auto'
          }}>
            <AnimatePresence mode="wait">
              {renderPage()}
            </AnimatePresence>
            {user && (
              <motion.div 
                initial={false}
                animate={(activePage === 'canvas' || (activePage === 'auth' && user)) ? "visible" : "hidden"}
                variants={{
                  visible: { 
                    opacity: 1, 
                    x: 0, 
                    scale: 1,
                    display: 'block', 
                    transition: { duration: 0.22, ease: 'easeInOut' } 
                  },
                  hidden: { 
                    opacity: 0, 
                    x: -15, 
                    scale: 0.98,
                    transitionEnd: { display: 'none' },
                    transition: { duration: 0.22, ease: 'easeInOut' } 
                  }
                }}
                style={{ 
                  width: '100%',
                  gridColumn: 1,
                  gridRow: 1,
                  pointerEvents: (activePage === 'canvas' || (activePage === 'auth' && user)) ? 'auto' : 'none'
                }}
              >
                <AirCanvas 
                  initialDrawing={editingDrawing} 
                  onDrawingCleared={() => setEditingDrawing(null)} 
                  onDrawingSaved={(drawing) => setEditingDrawing(drawing)}
                  initialStencil={externalStencil}
                  onClearInitialStencil={() => setExternalStencil(null)}
                  isActivePage={activePage === 'canvas' || (activePage === 'auth' && user)}
                />
              </motion.div>
            )}
          </main>

          {/* Profile Edit Modal */}
          {createPortal(
            <AnimatePresence>
              {showProfileModal && (
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
                    onClick={() => setShowProfileModal(false)}
                  />

                  {/* Dialog Content Box */}
                  <motion.div
                    variants={{
                      hidden: { opacity: 0, scale: 0.95, y: 15, rotateX: -5 },
                      visible: { opacity: 1, scale: 1, y: 0, rotateX: 0 }
                    }}
                    transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                    className="glass-panel-heavy"
                    style={{ ...styles.modalContent, transformStyle: 'preserve-3d' }}
                    onClick={(e) => e.stopPropagation()}
                  >
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
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>,
            document.body
          )}
        </motion.div>
      )}
      </AnimatePresence>
    </>
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
