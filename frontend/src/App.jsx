import { useState, useEffect } from 'react'
import { Home, Image, Settings as SettingsIcon, Palette, LogIn, LogOut, User as UserIcon, Lock } from 'lucide-react'
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
    return token && username ? { username, token } : null
  })

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

  // Change theme handler
  const handleThemeChange = (color1, color2, name) => {
    setTheme({ color1, color2, name })
  }

  // Session login success callback
  const handleLoginSuccess = (username, token) => {
    localStorage.setItem('token', token)
    localStorage.setItem('username', username)
    setUser({ username, token })
    // Redirect back to where the user wanted to go
    if (activePage === 'auth') {
      setActivePage('canvas')
    }
  }

  // Session logout callback
  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    setUser(null)
    setActivePage('landing')
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
      return <AirCanvas />
    }

    switch (activePage) {
      case 'landing':
        return <LandingPage onStartCanvas={() => navigateTo('canvas')} />
      case 'canvas':
        return <AirCanvas />
      case 'gallery':
        return <Gallery />
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
              <div style={styles.userBadge}>
                <UserIcon size={14} color="var(--theme-color-2)" />
                <span>{user.username}</span>
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
  authBtn: {
    padding: '8px 14px',
    fontSize: '13px',
    borderRadius: '10px',
  }
}

export default App
