import { useState, useEffect } from 'react'
import { Home, Image, Settings as SettingsIcon, Palette, LogIn, LogOut, User as UserIcon, Lock, X } from 'lucide-react'
import LandingPage from './components/LandingPage'
import AirCanvas from './components/AirCanvas'
import Gallery from './components/Gallery'
import Settings from './components/Settings'
import Auth from './components/Auth'

// Backend URL configuration
export const BACKEND_URL = 'http://localhost:8000'

function App() {
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

  // Theme Configuration
  const [theme, setTheme] = useState({
    name: 'Liquid Indigo',
    color1: '#8b5cf6', // Violet
    color2: '#06b6d4'  // Cyan
  })

  // Apply theme variables dynamically to :root
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--theme-color-1', theme.color1)
    root.style.setProperty('--theme-color-2', theme.color2)
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
      return <Auth onLoginSuccess={handleLoginSuccess} />
    }

    // Show auth page when explicitly requested (unauthenticated)
    if (activePage === 'auth' && !user) {
      return <Auth onLoginSuccess={handleLoginSuccess} />
    }

    // Already logged in but ended up on auth page — go to canvas
    if (activePage === 'auth' && user) {
      return <AirCanvas initialDrawing={editingDrawing} onDrawingCleared={() => setEditingDrawing(null)} />
    }

    switch (activePage) {
      case 'landing':
        return <LandingPage onStartCanvas={() => navigateTo('canvas')} />
      case 'canvas':
        return <AirCanvas initialDrawing={editingDrawing} onDrawingCleared={() => setEditingDrawing(null)} />
      case 'gallery':
        return <Gallery onEditDrawing={(drawing) => {
          setEditingDrawing(drawing)
          setActivePage('canvas')
        }} />
      case 'settings':
        return <Settings onThemeChange={handleThemeChange} activeThemeName={theme.name} />
      default:
        return <LandingPage onStartCanvas={() => navigateTo('canvas')} />
    }
  }

  return (
    <>
      {/* Background liquid elements */}
      <div className="app-bg-container">
        <div className="liquid-blob blob-1"></div>
        <div className="liquid-blob blob-2"></div>
        <div className="liquid-blob blob-3"></div>
      </div>

      {/* Main Glass Header */}
      <header className="header-glass">
        <div className="logo-container" onClick={() => setActivePage('landing')}>
          <div className="logo-icon" style={{ padding: '4px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 19V5L12 13L20 5V19" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span>MIRO CANVAS</span>
        </div>

        <nav className="nav-links">
          <button 
            className={`nav-item ${activePage === 'landing' ? 'nav-item-active' : ''}`}
            onClick={() => setActivePage('landing')}
          >
            <Home size={16} />
            <span>Home</span>
          </button>
          <button 
            className={`nav-item ${activePage === 'canvas' ? 'nav-item-active' : ''} ${!user ? 'nav-item-locked' : ''}`}
            onClick={() => navigateTo('canvas')}
            title={!user ? 'Sign in to access Canvas' : 'Canvas'}
          >
            <Palette size={16} />
            <span>Canvas</span>
            {!user && <Lock size={11} style={{ opacity: 0.5, marginLeft: '2px' }} />}
          </button>
          <button 
            className={`nav-item ${activePage === 'gallery' ? 'nav-item-active' : ''} ${!user ? 'nav-item-locked' : ''}`}
            onClick={() => navigateTo('gallery')}
            title={!user ? 'Sign in to access Gallery' : 'Gallery'}
          >
            <Image size={16} />
            <span>Gallery</span>
            {!user && <Lock size={11} style={{ opacity: 0.5, marginLeft: '2px' }} />}
          </button>
          <button 
            className={`nav-item ${activePage === 'settings' ? 'nav-item-active' : ''}`}
            onClick={() => setActivePage('settings')}
          >
            <SettingsIcon size={16} />
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
                    <UserIcon size={14} color="var(--theme-color-2)" />
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
                <LogOut size={14} />
                <span>Log Out</span>
              </button>
            </div>
          ) : (
            <button className="glass-btn glass-btn-primary" style={styles.authBtn} onClick={() => setActivePage('auth')}>
              <LogIn size={14} />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ minHeight: 'calc(100vh - 73px)', padding: '24px' }}>
        {renderPage()}
      </main>

      {/* Profile Edit Modal */}
      {showProfileModal && (
        <div style={styles.modalBg} onClick={() => setShowProfileModal(false)}>
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
        </div>
      )}
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
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '1px solid var(--theme-color-2)',
  },
  authBtn: {
    padding: '8px 14px',
    fontSize: '13px',
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
  }
}

export default App
