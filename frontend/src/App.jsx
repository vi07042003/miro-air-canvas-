import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Home, Image, Settings as SettingsIcon, Palette, LogIn, LogOut, User as UserIcon, Lock, X, Sparkles, Wand2, Rotate3d, Users } from 'lucide-react'
import LandingPage from './components/LandingPage'
import AirCanvas from './components/AirCanvas'
import Gallery from './components/Gallery'
import Settings from './components/Settings'
import Auth from './components/Auth'
import WelcomeAnimation from './components/WelcomeAnimation'
import AIStencils from './components/AIStencils'
import RevolveStudio from './components/RevolveStudio'
import DoodleStudio from './components/DoodleStudio'
import CollaborationPage from './components/CollaborationPage'
import { AnimatePresence, motion } from 'framer-motion'
import { useToast } from './components/Toast'

// Backend URL configuration
export const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function App() {
  const { showToast } = useToast()
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

  // Collaboration State
  const [collabRoomCode, setCollabRoomCode] = useState('')

  // Theme Configuration
  const [theme, setTheme] = useState(() => {
    const savedName = localStorage.getItem('theme_name')
    const savedColor1 = localStorage.getItem('theme_color_1')
    const savedColor2 = localStorage.getItem('theme_color_2')
    const savedBg1 = localStorage.getItem('theme_bg_1')
    const savedBg2 = localStorage.getItem('theme_bg_2')
    return savedName && savedColor1 && savedColor2 
      ? { name: savedName, color1: savedColor1, color2: savedColor2, bg1: savedBg1 || '#0C121C', bg2: savedBg2 || '#05080C' }
      : { name: 'Aurora Sky', color1: '#3FA7D6', color2: '#5BC0EB', bg1: '#0C121C', bg2: '#05080C' }
  })

  // Glass Transparency Configuration
  const [glassOpacity, setGlassOpacity] = useState(() => {
    const saved = localStorage.getItem('glass_opacity')
    return saved ? parseInt(saved, 10) : 20
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
    
    // Set custom backgrounds if defined, otherwise use default
    root.style.setProperty('--bg-dark-1', theme.bg1 || '#0C121C')
    root.style.setProperty('--bg-dark-2', theme.bg2 || '#05080C')
    
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

  // Reset editing drawing when user leaves the drawing workspaces
  useEffect(() => {
    if (activePage !== 'canvas' && activePage !== 'revolve') {
      setEditingDrawing(null)
    }
  }, [activePage])

  // Change theme handler
  const handleThemeChange = (color1, color2, name, bg1, bg2) => {
    let resolvedBg1 = bg1
    let resolvedBg2 = bg2
    
    if (!bg1 || !bg2) {
      const preset = [
        { name: 'Aurora Sky', bg1: '#0C121C', bg2: '#05080C' },
        { name: 'Liquid Pearl', bg1: '#16161D', bg2: '#0D0D11' },
        { name: 'Royal Orchid', bg1: '#0E141B', bg2: '#070A0E' },
        { name: 'Solar Flare', bg1: '#141A24', bg2: '#0A0D12' },
        { name: 'Velvet Emerald', bg1: '#101826', bg2: '#080C13' }
      ].find(p => p.name === name)
      
      resolvedBg1 = preset?.bg1 || '#0C121C'
      resolvedBg2 = preset?.bg2 || '#05080C'
    }
    
    setTheme({ color1, color2, name, bg1: resolvedBg1, bg2: resolvedBg2 })
    localStorage.setItem('theme_name', name)
    localStorage.setItem('theme_color_1', color1)
    localStorage.setItem('theme_color_2', color2)
    localStorage.setItem('theme_bg_1', resolvedBg1)
    localStorage.setItem('theme_bg_2', resolvedBg2)
    showToast(`Theme updated to ${name}`, 'theme')
  }

  // Collaboration Helpers
  const createRoom = async () => {
    if (!user) {
      showToast('Please sign in to host a collaborative session', 'error')
      setActivePage('auth')
      return null
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/collaboration/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      })
      if (!res.ok) throw new Error('Failed to create room')
      const data = await res.json()
      return data.room_code
    } catch (err) {
      showToast('Error creating collaboration session', 'error')
      console.error(err)
      return null
    }
  }

  const checkRoomExists = async (code) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/collaboration/check/${code}`)
      if (!res.ok) return false
      const data = await res.json()
      return data.exists
    } catch (err) {
      console.error(err)
      return false
    }
  }

  const joinCollabRoom = (code) => {
    setCollabRoomCode(code)
    setActivePage('canvas')
    showToast(`Joining room ${code}...`, 'success')
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
    showToast(`Welcome back, ${username}! Splashed into your creative canvas.`, 'login')
    // Redirect back to where the user wanted to go
    if (activePage === 'auth') {
      setActivePage('canvas')
    }
  }

  // Session logout callback
  const handleLogout = () => {
    if (collabRoomCode) {
      showToast('Cannot log out while in collaboration mode. Please disconnect first.', 'warning')
      return
    }
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    localStorage.removeItem('profile_picture')
    setUser(null)
    setActivePage('landing')
    showToast("Logged out. See you soon in the stream!", 'logout')
  }

  // Profile Click Handler
  const handleProfileClick = () => {
    if (!user) return
    if (collabRoomCode) {
      showToast('Cannot edit profile while in collaboration mode. Please disconnect first.', 'warning')
      return
    }
    setEditUsername(user.username)
    setEditPassword('')
    setEditProfilePicture(user.profilePicture || '')
    setProfileMessage('')
    setShowProfileModal(true)
  }
  const handleCloseProfileModal = () => {
    setShowProfileModal(false)
    setEditUsername('')
    setEditPassword('')
    setEditProfilePicture('')
    setProfileMessage('')
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
        showToast("Profile details updated successfully!", 'profile')
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

  const isProfileUnchanged = 
    editUsername === (user?.username || '') &&
    editPassword === '' &&
    editProfilePicture === (user?.profilePicture || '')

  // Safe navigation: always redirects to auth for protected pages
  const navigateTo = (page) => {
    const protectedPages = ['canvas', 'gallery', 'stencils', 'revolve', 'doodle', 'collab']
    if (protectedPages.includes(page) && !user) {
      setActivePage('auth')
    } else {
      setActivePage(page)
    }
  }

  // macOS-style Liquid Glass Droplet Morph transition variants for page switching
  const macPageVariants = {
    initial: { 
      opacity: 0, 
      scaleX: 0.45, 
      scaleY: 1.5, 
      borderRadius: "200px",
      y: -60,
      filter: "blur(12px) contrast(1.25)",
      transformOrigin: "center top"
    },
    animate: { 
      opacity: 1, 
      scaleX: 1, 
      scaleY: 1, 
      borderRadius: "24px",
      y: 0,
      filter: "blur(0px) contrast(1)",
      transformOrigin: "center top",
      transition: { 
        y: {
          type: 'spring',
          stiffness: 280,
          damping: 20,
          mass: 0.8
        },
        scaleX: {
          type: 'spring',
          stiffness: 260,
          damping: 14,
          mass: 0.6
        },
        scaleY: {
          type: 'spring',
          stiffness: 260,
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
          duration: 0.2
        }
      }
    },
    exit: { 
      opacity: 0, 
      scaleX: 0.25, 
      scaleY: 1.6, 
      borderRadius: "200px",
      y: 70,
      filter: "blur(12px) contrast(1.25)",
      transformOrigin: "center bottom",
      transition: { 
        y: { duration: 0.28, ease: [0.4, 0, 1, 1] },
        scaleX: { duration: 0.22, ease: 'easeIn' },
        scaleY: { duration: 0.22, ease: 'easeIn' },
        borderRadius: { duration: 0.22, ease: 'easeInOut' },
        filter: { duration: 0.22 },
        opacity: { duration: 0.22 }
      }
    }
  }

  const renderPage = () => {
    // Strict auth gate — canvas, gallery, stencils, revolve, and doodle are ALWAYS blocked without a session
    if ((activePage === 'canvas' || activePage === 'gallery' || activePage === 'stencils' || activePage === 'revolve' || activePage === 'doodle') && !user) {
      return (
        <motion.div
          key="auth"
          variants={macPageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{ gridColumn: 1, gridRow: 1, transformStyle: 'preserve-3d' }}
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
          variants={macPageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{ gridColumn: 1, gridRow: 1, transformStyle: 'preserve-3d' }}
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
            variants={macPageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ gridColumn: 1, gridRow: 1, transformStyle: 'preserve-3d' }}
          >
            <LandingPage 
              onStartCanvas={() => navigateTo('canvas')} 
              onStartCollaboration={() => navigateTo('collab')}
            />
          </motion.div>
        )
      case 'canvas':
        return null
      case 'gallery':
        return (
          <motion.div
            key="gallery"
            variants={macPageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ gridColumn: 1, gridRow: 1, transformStyle: 'preserve-3d' }}
          >
            <Gallery onEditDrawing={(drawing) => {
              setEditingDrawing(drawing)
              if (drawing.canvas_mode === 'revolve') {
                setActivePage('revolve')
              } else {
                setActivePage('canvas')
              }
            }} />
          </motion.div>
        )
      case 'settings':
        return (
          <motion.div
            key="settings"
            variants={macPageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ gridColumn: 1, gridRow: 1, transformStyle: 'preserve-3d' }}
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
            variants={macPageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ width: '100%', padding: '0 40px', gridColumn: 1, gridRow: 1, transformStyle: 'preserve-3d' }}
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
      case 'revolve':
        return (
          <motion.div
            key="revolve"
            variants={macPageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ width: '100%', padding: '0 40px', gridColumn: 1, gridRow: 1, transformStyle: 'preserve-3d' }}
          >
            <RevolveStudio 
              user={user} 
              initialDrawing={editingDrawing}
              onDrawingCleared={() => setEditingDrawing(null)}
              onDrawingSaved={(drawing) => setEditingDrawing(drawing)}
            />
          </motion.div>
        )
      case 'doodle':
        return (
          <motion.div
            key="doodle"
            variants={macPageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ width: '100%', padding: '0 40px', gridColumn: 1, gridRow: 1, transformStyle: 'preserve-3d' }}
          >
            <DoodleStudio user={user} />
          </motion.div>
        )
      case 'collab':
        return (
          <motion.div
            key="collab"
            variants={macPageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ gridColumn: 1, gridRow: 1, transformStyle: 'preserve-3d' }}
          >
            <CollaborationPage
              user={user}
              createRoom={createRoom}
              joinRoom={joinCollabRoom}
              checkRoomExists={checkRoomExists}
              onStartCanvas={() => navigateTo('canvas')}
            />
          </motion.div>
        )
      default:
        return (
          <motion.div
            key="landing"
            variants={macPageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ gridColumn: 1, gridRow: 1, transformStyle: 'preserve-3d' }}
          >
            <LandingPage 
              onStartCanvas={() => navigateTo('canvas')} 
              onStartCollaboration={() => navigateTo('collab')}
            />
          </motion.div>
        )
    }
  }

  return (
    <>
      {/* Premium Ambient Aurora Glow Background */}
      <div className="app-bg-container">
        <div className="ambient-glow glow-1"></div>
        <div className="ambient-glow glow-2"></div>
        <div className="ambient-glow glow-3"></div>
        <div className="ambient-glow glow-4"></div>
        <div className="ambient-glow glow-5"></div>

        {/* Interactive Hand-drawn Sketch Doodles (visible only on landing page, draggable) */}
        {activePage === 'landing' && (
          <div className="glass-shapes-container">
            {/* SVG wobble filter definitions */}
            <svg style={{ position: 'absolute', width: 0, height: 0 }}>
              <defs>
                <filter id="wobble" x="-20%" y="-20%" width="140%" height="140%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" result="noise" />
                  <feDisplacementMap in="SourceGraphic" in2="noise" scale="8" xChannelSelector="R" yChannelSelector="G" />
                </filter>
              </defs>
            </svg>

            {/* 1. Doodle Star (Drawing itself slowly on mount) */}
            <motion.div 
              drag 
              dragMomentum={false}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.55, scale: 1 }}
              whileHover={{ scale: 1.10, opacity: 0.95 }}
              whileTap={{ scale: 0.95 }}
              className="glass-shape-draggable shape-star"
            >
              <div className="glass-shape float-1">
                <svg viewBox="0 0 100 100" width="200" height="200" className="doodle-svg">
                  <motion.path
                    d="M 50 15 L 63 40 L 90 40 L 68 57 L 76 83 L 50 67 L 24 83 L 32 57 L 10 40 L 37 40 Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 4.5, ease: "easeInOut" }}
                  />
                  <motion.path
                    d="M 48 16 L 64 39 L 88 41 L 67 58 L 77 81 L 51 66 L 26 84 L 31 56 L 11 39 L 38 39 Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 5.0, delay: 0.8, ease: "easeInOut" }}
                  />
                </svg>
              </div>
            </motion.div>

            {/* 2. Doodle Paper Plane (Swoops in slowly and draws on mount) */}
            <motion.div 
              drag 
              dragMomentum={false}
              initial={{ x: 250, y: -150, opacity: 0, rotate: 30, scale: 0.6 }}
              animate={{ x: 0, y: 0, opacity: 0.55, rotate: 0, scale: 1 }}
              whileHover={{ scale: 1.10, opacity: 0.95 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 22, damping: 9, delay: 0.2 }}
              className="glass-shape-draggable shape-plane"
            >
              <div className="glass-shape float-2">
                <svg viewBox="0 0 100 100" width="200" height="200" className="doodle-svg">
                  <motion.path
                    d="M 15 55 L 85 20 L 45 65 Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 4.0, delay: 0.8 }}
                  />
                  <motion.path
                    d="M 45 65 L 55 85 L 70 50"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 3.5, delay: 2.0 }}
                  />
                  <motion.path
                    d="M 45 65 L 85 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 3.5, delay: 1.4 }}
                  />
                </svg>
              </div>
            </motion.div>

            {/* 3. Doodle House (Self-drawing wobbly house on mount) */}
            <motion.div 
              drag 
              dragMomentum={false}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.55, scale: 1 }}
              whileHover={{ scale: 1.10, opacity: 0.95 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 1.5, delay: 0.4 }}
              className="glass-shape-draggable shape-house"
            >
              <div className="glass-shape float-1">
                <svg viewBox="0 0 100 100" width="220" height="220" className="doodle-svg">
                  <motion.path 
                    d="M 15 45 L 50 15 L 85 45 Z" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 4.2, delay: 0.5, ease: "easeInOut" }}
                  />
                  <motion.path 
                    d="M 22 45 L 22 85 L 78 85 L 78 45" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 4.8, delay: 1.2, ease: "easeInOut" }}
                  />
                  <motion.path 
                    d="M 42 85 L 42 60 L 58 60 L 58 85" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="1.8" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 3.2, delay: 2.2, ease: "easeInOut" }}
                  />
                  <motion.path 
                    d="M 40 35 L 60 35" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="1.8" 
                    strokeLinecap="round" 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2.5, delay: 2.8, ease: "easeInOut" }}
                  />
                </svg>
              </div>
            </motion.div>

            {/* 4. Doodle Flower (Self-drawing wobbly flower on mount) */}
            <motion.div 
              drag 
              dragMomentum={false}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.55, scale: 1 }}
              whileHover={{ scale: 1.10, opacity: 0.95 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 1.5, delay: 0.5 }}
              className="glass-shape-draggable shape-flower"
            >
              <div className="glass-shape float-2">
                <svg viewBox="0 0 100 100" width="220" height="220" className="doodle-svg">
                  <motion.path 
                    d="M 50 40 A 10 10 0 1 1 49.9 40 Z" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.5" 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 3.5, delay: 0.5 }}
                  />
                  <motion.path 
                    d="M 50 30 C 45 20, 35 20, 40 33 C 28 30, 25 40, 38 43 C 28 48, 32 58, 42 50 C 45 60, 55 60, 50 48 C 60 50, 64 40, 52 38 C 60 30, 55 20, 50 30 Z" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="1.8" 
                    strokeLinecap="round" 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 5.2, delay: 1.2 }}
                  />
                  <motion.path 
                    d="M 50 50 L 50 85" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 3.5, delay: 2.5 }}
                  />
                  <motion.path 
                    d="M 50 65 C 60 62, 65 70, 50 75" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="1.8" 
                    strokeLinecap="round" 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2.8, delay: 3.2 }}
                  />
                </svg>
              </div>
            </motion.div>

            {/* 5. Doodle Heart (Self-drawing wobbly heart on mount) */}
            <motion.div 
              drag 
              dragMomentum={false}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.55, scale: 1 }}
              whileHover={{ scale: 1.10, opacity: 0.95 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 1.5, delay: 0.6 }}
              className="glass-shape-draggable shape-heart"
            >
              <div className="glass-shape float-1">
                <svg viewBox="0 0 100 100" width="180" height="180" className="doodle-svg">
                  <motion.path 
                    d="M 50 30 C 60 10, 90 20, 50 80 C 10 20, 40 10, 50 30 Z" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 4.8, delay: 0.6, ease: "easeInOut" }}
                  />
                  <motion.path 
                    d="M 49 32 C 58 13, 87 22, 49 77 C 13 22, 41 13, 49 32 Z" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="1.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 5.2, delay: 1.2, ease: "easeInOut" }}
                  />
                </svg>
              </div>
            </motion.div>

            {/* 6. Doodle Smiley (Self-drawing wobbly smiley on mount) */}
            <motion.div 
              drag 
              dragMomentum={false}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.55, scale: 1 }}
              whileHover={{ scale: 1.10, opacity: 0.95 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 1.5, delay: 0.7 }}
              className="glass-shape-draggable shape-smiley"
            >
              <div className="glass-shape float-2">
                <svg viewBox="0 0 100 100" width="180" height="180" className="doodle-svg">
                  <motion.path 
                    d="M 50 15 A 35 35 0 1 1 49.9 15 Z" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.5" 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 4.5, delay: 0.4, ease: "easeInOut" }}
                  />
                  <motion.path 
                    d="M 33 55 C 40 70, 60 70, 67 55" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 3.5, delay: 1.8, ease: "easeInOut" }}
                  />
                  <motion.path 
                    d="M 38 40 A 3 3 0 1 1 37.9 40 Z" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2.0, delay: 2.8 }}
                  />
                  <motion.path 
                    d="M 62 40 A 3 3 0 1 1 61.9 40 Z" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2.0, delay: 3.0 }}
                  />
                </svg>
              </div>
            </motion.div>

            {/* 7. Doodle Clock (Self-drawing clock in blank space) */}
            <motion.div 
              drag 
              dragMomentum={false}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.55, scale: 1 }}
              whileHover={{ scale: 1.10, opacity: 0.95 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 1.5, delay: 0.8 }}
              className="glass-shape-draggable shape-clock"
            >
              <div className="glass-shape float-1">
                <svg viewBox="0 0 100 100" width="180" height="180" className="doodle-svg">
                  <motion.path 
                    d="M 50 15 A 35 35 0 1 1 49.9 15 Z" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.5" 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 4.5, delay: 0.6, ease: "easeInOut" }}
                  />
                  <motion.path 
                    d="M 50 50 L 50 30" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 3.0, delay: 2.0, ease: "easeInOut" }}
                  />
                  <motion.path 
                    d="M 50 50 L 68 50" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 3.5, delay: 2.5, ease: "easeInOut" }}
                  />
                </svg>
              </div>
            </motion.div>

            {/* 8. Doodle Music Notes (Self-drawing music notes in blank space) */}
            <motion.div 
              drag 
              dragMomentum={false}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.55, scale: 1 }}
              whileHover={{ scale: 1.10, opacity: 0.95 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 1.5, delay: 0.9 }}
              className="glass-shape-draggable shape-music"
            >
              <div className="glass-shape float-2">
                <svg viewBox="0 0 100 100" width="180" height="180" className="doodle-svg">
                  <motion.path 
                    d="M 35 70 L 35 25" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.5" 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 3.0, delay: 0.8 }}
                  />
                  <motion.path 
                    d="M 35 70 A 10 7 0 1 1 25 65 Z" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2.0, delay: 1.2 }}
                  />
                  <motion.path 
                    d="M 65 60 L 65 15" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.5" 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 3.0, delay: 1.5 }}
                  />
                  <motion.path 
                    d="M 65 60 A 10 7 0 1 1 55 55 Z" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2.0, delay: 1.9 }}
                  />
                  <motion.path 
                    d="M 35 25 L 65 15 L 65 23 L 35 33 Z" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.5" 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2.5, delay: 2.4 }}
                  />
                </svg>
              </div>
            </motion.div>

            {/* 9. Doodle Cloud (Self-drawing cloud in blank space) */}
            <motion.div 
              drag 
              dragMomentum={false}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.55, scale: 1 }}
              whileHover={{ scale: 1.10, opacity: 0.95 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 1.5, delay: 1.0 }}
              className="glass-shape-draggable shape-cloud"
            >
              <div className="glass-shape float-1">
                <svg viewBox="0 0 100 100" width="200" height="200" className="doodle-svg">
                  <motion.path 
                    d="M 25 60 C 15 60, 10 50, 18 40 C 12 30, 25 15, 45 20 C 55 10, 75 15, 78 30 C 88 32, 90 48, 80 58 C 75 65, 30 65, 25 60 Z" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 5.0, delay: 0.8 }}
                  />
                  <motion.path 
                    d="M 35 72 L 30 82" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2.0, delay: 2.5 }}
                  />
                  <motion.path 
                    d="M 52 75 L 47 85" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2.0, delay: 2.9 }}
                  />
                  <motion.path 
                    d="M 68 72 L 63 82" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2.0, delay: 3.3 }}
                  />
                </svg>
              </div>
            </motion.div>

            {/* 10. Doodle Bulb (Self-drawing lightbulb in blank space) */}
            <motion.div 
              drag 
              dragMomentum={false}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.55, scale: 1 }}
              whileHover={{ scale: 1.10, opacity: 0.95 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 1.5, delay: 1.1 }}
              className="glass-shape-draggable shape-bulb"
            >
              <div className="glass-shape float-2">
                <svg viewBox="0 0 100 100" width="180" height="180" className="doodle-svg">
                  <motion.path 
                    d="M 35 55 C 22 45, 25 20, 50 20 C 75 20, 78 45, 65 55 C 62 65, 38 65, 35 55 Z" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.5" 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 4.8, delay: 0.8 }}
                  />
                  <motion.path 
                    d="M 45 58 L 45 42 L 50 48 L 55 42 L 55 58" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 3.2, delay: 1.8 }}
                  />
                  <motion.path 
                    d="M 40 68 L 60 68 M 43 74 L 57 74 M 47 80 L 53 80" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2.5, delay: 2.8 }}
                  />
                  <motion.path 
                    d="M 20 25 L 28 31 M 50 10 L 50 16 M 80 25 L 72 31 M 15 45 L 22 45 M 85 45 L 78 45" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 3.0, delay: 3.5 }}
                  />
                </svg>
              </div>
            </motion.div>

          </div>
        )}
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
            <motion.div 
              className="logo-container" 
              onClick={() => {
                if (activePage === 'landing') {
                  window.location.reload()
                } else {
                  setActivePage('landing')
                }
              }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              style={{ cursor: 'pointer' }}
            >
              <div className="logo-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="var(--theme-color-1)" />
                      <stop offset="100%" stopColor="var(--theme-color-2)" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M5 18C5 18 8 6 10.5 6C12.5 6 12 13.5 13.5 13.5C15 13.5 16.5 7.5 19 7.5"
                    stroke="url(#logo-grad)"
                    strokeWidth="2.5"
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
                <span className="header-brand-mi">miro</span>
                <span className="header-brand-dot">·</span>
                <span className="header-brand-canvas">canvas</span>
              </span>
            </motion.div>

            <nav className="nav-links">
              <motion.button 
                className={`nav-item ${activePage === 'landing' ? 'nav-item-active' : ''} ${collabRoomCode ? 'nav-item-locked' : ''}`}
                onClick={() => {
                  if (collabRoomCode) {
                    showToast('Cannot leave the canvas while in collaboration mode. Please disconnect first.', 'warning')
                    return
                  }
                  setActivePage('landing')
                }}
                style={{ position: 'relative' }}
                whileHover={collabRoomCode ? {} : { scale: 1.04, y: -1 }}
                whileTap={collabRoomCode ? {} : { scale: 0.95 }}
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
                  {collabRoomCode && <Lock size={13} style={{ opacity: 0.5, marginLeft: '2px' }} />}
                </span>
              </motion.button>
              <motion.button 
                className={`nav-item ${activePage === 'canvas' ? 'nav-item-active' : ''} ${!user ? 'nav-item-locked' : ''}`}
                onClick={() => navigateTo('canvas')}
                title={!user ? 'Sign in to access Canvas' : 'Canvas'}
                style={{ position: 'relative' }}
                whileHover={!user ? {} : { scale: 1.04, y: -1 }}
                whileTap={!user ? {} : { scale: 0.95 }}
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
              </motion.button>
              <motion.button 
                className={`nav-item ${activePage === 'gallery' ? 'nav-item-active' : ''} ${(!user || collabRoomCode) ? 'nav-item-locked' : ''}`}
                onClick={() => {
                  if (collabRoomCode) {
                    showToast('Cannot access Gallery while in collaboration mode. Please disconnect first.', 'warning')
                    return
                  }
                  navigateTo('gallery')
                }}
                title={!user ? 'Sign in to access Gallery' : (collabRoomCode ? 'Gallery disabled during collaboration' : 'Gallery')}
                style={{ position: 'relative' }}
                whileHover={(!user || collabRoomCode) ? {} : { scale: 1.04, y: -1 }}
                whileTap={(!user || collabRoomCode) ? {} : { scale: 0.95 }}
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
                  {(!user || collabRoomCode) && <Lock size={13} style={{ opacity: 0.5, marginLeft: '2px' }} />}
                </span>
              </motion.button>
              <motion.button 
                className={`nav-item ${activePage === 'stencils' ? 'nav-item-active' : ''} ${(!user || collabRoomCode) ? 'nav-item-locked' : ''}`}
                onClick={() => {
                  if (collabRoomCode) {
                    showToast('Cannot access AI Stencils while in collaboration mode. Please disconnect first.', 'warning')
                    return
                  }
                  navigateTo('stencils')
                }}
                title={!user ? 'Sign in to generate AI stencils' : (collabRoomCode ? 'AI Stencils disabled during collaboration' : 'AI Stencil Generator')}
                style={{ position: 'relative' }}
                whileHover={(!user || collabRoomCode) ? {} : { scale: 1.04, y: -1 }}
                whileTap={(!user || collabRoomCode) ? {} : { scale: 0.95 }}
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
                  {(!user || collabRoomCode) && <Lock size={13} style={{ opacity: 0.5, marginLeft: '2px' }} />}
                </span>
              </motion.button>
              <motion.button 
                className={`nav-item ${activePage === 'revolve' ? 'nav-item-active' : ''} ${(!user || collabRoomCode) ? 'nav-item-locked' : ''}`}
                onClick={() => {
                  if (collabRoomCode) {
                    showToast('Cannot access 3D Revolve while in collaboration mode. Please disconnect first.', 'warning')
                    return
                  }
                  navigateTo('revolve')
                }}
                title={!user ? 'Sign in to access 3D Revolve' : (collabRoomCode ? '3D Revolve disabled during collaboration' : '3D Revolve')}
                style={{ position: 'relative' }}
                whileHover={(!user || collabRoomCode) ? {} : { scale: 1.04, y: -1 }}
                whileTap={(!user || collabRoomCode) ? {} : { scale: 0.95 }}
              >
                {activePage === 'revolve' && (
                  <motion.div
                    layoutId="active-nav-pill"
                    className="nav-item-active-bg"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Rotate3d size={19} />
                  <span>3D Revolve</span>
                  {(!user || collabRoomCode) && <Lock size={13} style={{ opacity: 0.5, marginLeft: '2px' }} />}
                </span>
              </motion.button>
              <motion.button 
                className={`nav-item ${activePage === 'doodle' ? 'nav-item-active' : ''} ${(!user || collabRoomCode) ? 'nav-item-locked' : ''}`}
                onClick={() => {
                  if (collabRoomCode) {
                    showToast('Cannot access Doodle Art while in collaboration mode. Please disconnect first.', 'warning')
                    return
                  }
                  navigateTo('doodle')
                }}
                title={!user ? 'Sign in to access Doodle to Art' : (collabRoomCode ? 'Doodle Art disabled during collaboration' : 'Doodle Art')}
                style={{ position: 'relative' }}
                whileHover={(!user || collabRoomCode) ? {} : { scale: 1.04, y: -1 }}
                whileTap={(!user || collabRoomCode) ? {} : { scale: 0.95 }}
              >
                {activePage === 'doodle' && (
                  <motion.div
                    layoutId="active-nav-pill"
                    className="nav-item-active-bg"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Wand2 size={19}/>
                  <span>Doodle Art</span>
                  {(!user || collabRoomCode) && <Lock size={13} style={{ opacity: 0.5, marginLeft: '2px' }} />}
                </span>
              </motion.button>

              <motion.button 
                className={`nav-item ${(activePage === 'collab' || collabRoomCode) ? 'nav-item-active' : ''} ${!user ? 'nav-item-locked' : ''}`}
                onClick={() => {
                  if (!user) {
                    showToast('Please sign in to collaborate', 'error')
                    setActivePage('auth')
                    return
                  }
                  if (collabRoomCode) {
                    setActivePage('canvas')
                  } else {
                    navigateTo('collab')
                  }
                }}
                title={!user ? 'Sign in to access collaboration features' : (collabRoomCode ? `Active Session: ${collabRoomCode}` : 'Start real-time collaboration')}
                style={{ position: 'relative' }}
                whileHover={!user ? {} : { scale: 1.04, y: -1 }}
                whileTap={!user ? {} : { scale: 0.95 }}
              >
                {(activePage === 'collab' || collabRoomCode) && (
                  <motion.div
                    layoutId="active-nav-pill"
                    className="nav-item-active-bg"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={19} />
                  <span>{collabRoomCode ? `Live: ${collabRoomCode}` : 'Collaborate'}</span>
                  {!user && <Lock size={13} style={{ opacity: 0.5, marginLeft: '2px' }} />}
                </span>
              </motion.button>
              <motion.button 
                className={`nav-item ${activePage === 'settings' ? 'nav-item-active' : ''} ${collabRoomCode ? 'nav-item-locked' : ''}`}
                onClick={() => {
                  if (collabRoomCode) {
                    showToast('Cannot open Settings while in collaboration mode. Please disconnect first.', 'warning')
                    return
                  }
                  setActivePage('settings')
                }}
                style={{ position: 'relative' }}
                whileHover={collabRoomCode ? {} : { scale: 1.04, y: -1 }}
                whileTap={collabRoomCode ? {} : { scale: 0.95 }}
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
                  {collabRoomCode && <Lock size={13} style={{ opacity: 0.5, marginLeft: '2px' }} />}
                </span>
              </motion.button>
            </nav>

            {/* User Session Nav Panel */}
            <div style={styles.authPanel}>
              {user ? (
                <div style={styles.userInfoRow}>
                  <div className="user-badge-wrapper">
                    <motion.div 
                      className="user-badge-clickable" 
                      onClick={handleProfileClick} 
                      title="Edit Profile"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      {user.profilePicture ? (
                        <img src={user.profilePicture} style={styles.headerAvatar} alt="Profile" />
                      ) : (
                        <UserIcon size={18} color="var(--theme-color-2)" />
                      )}
                      <span>{user.username}</span>
                    </motion.div>

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
                  
                  <motion.button 
                    className="glass-btn" 
                    style={styles.authBtn} 
                    onClick={handleLogout} 
                    title="Log Out"
                    whileHover={{ scale: 1.04, y: -1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <LogOut size={16} />
                    <span>Log Out</span>
                  </motion.button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <motion.button 
                    className="glass-btn glass-btn-primary" 
                    style={styles.authBtn} 
                    onClick={() => setActivePage('auth')}
                    whileHover={{ scale: 1.04, y: -1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <LogIn size={16} />
                    <span>Sign In</span>
                  </motion.button>
                </div>
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
            gridTemplateRows: 'auto',
            perspective: '1200px',
            transformStyle: 'preserve-3d'
          }}>
            <AnimatePresence mode="wait">
              {renderPage()}
            </AnimatePresence>
            {user && (
              <motion.div 
                initial="hidden"
                animate={(activePage === 'canvas' || (activePage === 'auth' && user)) ? "visible" : "hidden"}
                variants={{
                  visible: { 
                    opacity: 1, 
                    scaleX: 1, 
                    scaleY: 1, 
                    borderRadius: "24px",
                    y: 0,
                    filter: "blur(0px) contrast(1)",
                    display: 'block', 
                    transition: { 
                      y: {
                        type: 'spring',
                        stiffness: 280,
                        damping: 20,
                        mass: 0.8
                      },
                      scaleX: {
                        type: 'spring',
                        stiffness: 260,
                        damping: 14,
                        mass: 0.6
                      },
                      scaleY: {
                        type: 'spring',
                        stiffness: 260,
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
                        duration: 0.2
                      }
                    }
                  },
                  hidden: { 
                    opacity: 0, 
                    scaleX: 0.25, 
                    scaleY: 1.6, 
                    borderRadius: "200px",
                    y: 70,
                    filter: "blur(12px) contrast(1.25)",
                    transitionEnd: { display: 'none' },
                    transition: { 
                      y: { duration: 0.28, ease: [0.4, 0, 1, 1] },
                      scaleX: { duration: 0.22, ease: 'easeIn' },
                      scaleY: { duration: 0.22, ease: 'easeIn' },
                      borderRadius: { duration: 0.22, ease: 'easeInOut' },
                      filter: { duration: 0.22 },
                      opacity: { duration: 0.22 }
                    } 
                  }
                }}
                style={{ 
                  width: '100%',
                  gridColumn: 1,
                  gridRow: 1,
                  pointerEvents: (activePage === 'canvas' || (activePage === 'auth' && user)) ? 'auto' : 'none',
                  transformStyle: 'preserve-3d'
                }}
              >
                <AirCanvas 
                  initialDrawing={editingDrawing} 
                  onDrawingCleared={() => setEditingDrawing(null)} 
                  onDrawingSaved={(drawing) => setEditingDrawing(drawing)}
                  initialStencil={externalStencil}
                  onClearInitialStencil={() => setExternalStencil(null)}
                  isActivePage={activePage === 'canvas' || (activePage === 'auth' && user)}
                  collabRoomCode={collabRoomCode}
                  onLeaveCollab={() => setCollabRoomCode('')}
                  user={user}
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
                    onClick={handleCloseProfileModal}
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
                    className="glass-panel-heavy"
                    style={{ ...styles.modalContent, transformStyle: 'preserve-3d', overflow: 'hidden' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={styles.modalHeader}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <UserIcon size={20} color="var(--theme-color-2)" />
                        <h3 style={styles.modalTitle}>User Profile</h3>
                      </div>
                      <button style={styles.closeBtn} onClick={handleCloseProfileModal}>
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
                        {editProfilePicture !== (user?.profilePicture || '') && (
                          <div style={{
                            fontSize: '11px',
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: '#fbbf24',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontWeight: '600',
                            marginTop: '2px',
                            marginBottom: '6px'
                          }}>
                            Unsaved Photo Preview
                          </div>
                        )}
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
                        disabled={profileLoading || isProfileUnchanged}
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
