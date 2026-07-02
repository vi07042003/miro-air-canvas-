import React, { useState, useEffect } from 'react'
import { Palette, Save, Camera } from 'lucide-react'
import { BACKEND_URL } from '../App'

import auroraSkyImg from '../assets/aurora_sky.png'
import liquidPearlImg from '../assets/liquid_pearl.png'
import royalOrchidImg from '../assets/royal_orchid.png'
import solarFlareImg from '../assets/solar_flare.png'
import velvetEmeraldImg from '../assets/velvet_emerald.png'
import customThemeImg from '../assets/custom_theme.png'

const THEME_OPTIONS = [
  { name: 'Aurora Sky', color1: '#00f2fe', color2: '#4facfe', image: auroraSkyImg },
  { name: 'Liquid Pearl', color1: '#ff758c', color2: '#ff7eb3', image: liquidPearlImg },
  { name: 'Royal Orchid', color1: '#b18cfd', color2: '#ff7ebb', image: royalOrchidImg },
  { name: 'Solar Flare', color1: '#ff0844', color2: '#ffb199', image: solarFlareImg },
  { name: 'Velvet Emerald', color1: '#0575e6', color2: '#00f260', image: velvetEmeraldImg }
]

export default function Settings({ onThemeChange, activeThemeName, glassOpacity, onGlassOpacityChange }) {
  // App settings
  const [appSettings, setAppSettings] = useState({
    mirrorCamera: 'true',
    detectionConfidence: '0.5',
    defaultColor: '#06b6d4'
  })
  
  // Local values for smooth real-time slider updates without dragging latency
  const [localOpacity, setLocalOpacity] = useState(glassOpacity !== undefined ? glassOpacity : 80)
  const [localConfidence, setLocalConfidence] = useState(0.5)

  const activeColor1 = activeThemeName === 'Custom Theme'
    ? (localStorage.getItem('theme_color_1') || '#da12db')
    : (THEME_OPTIONS.find(t => t.name === activeThemeName)?.color1 || '#00f2fe')

  const activeColor2 = activeThemeName === 'Custom Theme'
    ? (localStorage.getItem('theme_color_2') || '#13cbd6')
    : (THEME_OPTIONS.find(t => t.name === activeThemeName)?.color2 || '#4facfe')

  // Selected theme details (local state until Saved is clicked)
  const [selectedThemeName, setSelectedThemeName] = useState(activeThemeName)
  const [selectedColor1, setSelectedColor1] = useState(activeColor1)
  const [selectedColor2, setSelectedColor2] = useState(activeColor2)
  const [themeSavedMessage, setThemeSavedMessage] = useState('')

  // Local values for custom colors, initialized to active custom colors or saved values or defaults
  const [customColor1, setCustomColor1] = useState(() => {
    if (activeThemeName === 'Custom Theme') {
      const savedColor1 = localStorage.getItem('theme_color_1')
      if (savedColor1) return savedColor1
    }
    return localStorage.getItem('custom_theme_color_1') || '#da12db'
  })

  const [customColor2, setCustomColor2] = useState(() => {
    if (activeThemeName === 'Custom Theme') {
      const savedColor2 = localStorage.getItem('theme_color_2')
      if (savedColor2) return savedColor2
    }
    return localStorage.getItem('custom_theme_color_2') || '#13cbd6'
  })

  // Keep custom colors and selected theme in sync with active theme when it changes
  useEffect(() => {
    setSelectedThemeName(activeThemeName)
    setSelectedColor1(activeColor1)
    setSelectedColor2(activeColor2)

    if (activeThemeName === 'Custom Theme') {
      const savedColor1 = localStorage.getItem('theme_color_1')
      const savedColor2 = localStorage.getItem('theme_color_2')
      if (savedColor1) setCustomColor1(savedColor1)
      if (savedColor2) setCustomColor2(savedColor2)
    }
  }, [activeThemeName, activeColor1, activeColor2])

  useEffect(() => {
    if (glassOpacity !== undefined) {
      setLocalOpacity(glassOpacity)
    }
  }, [glassOpacity])

  useEffect(() => {
    if (appSettings.detectionConfidence) {
      setLocalConfidence(parseFloat(appSettings.detectionConfidence) || 0.5)
    }
  }, [appSettings.detectionConfidence])

  const isThemeChanged = selectedThemeName !== activeThemeName || 
                         selectedColor1 !== activeColor1 || 
                         selectedColor2 !== activeColor2

  const handleSaveTheme = () => {
    onThemeChange(selectedColor1, selectedColor2, selectedThemeName)
    setThemeSavedMessage('Theme saved successfully!')
    setTimeout(() => setThemeSavedMessage(''), 3000)
  }

  const [loadingSettings, setLoadingSettings] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState('')

  // Fetch current settings
  const fetchData = async () => {
    try {
      const settingsRes = await fetch(`${BACKEND_URL}/api/settings`)
      if (settingsRes.ok) {
        const data = await settingsRes.json()
        if (Object.keys(data).length > 0) {
          setAppSettings(prev => ({ ...prev, ...data }))
        }
      }
    } catch (e) {
      console.error('Error fetching settings:', e)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Save App Settings
  const handleSaveSettings = async () => {
    setLoadingSettings(true)
    setSettingsMessage('')

    try {
      const res = await fetch(`${BACKEND_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appSettings)
      })

      if (res.ok) {
        setSettingsMessage('Settings saved successfully!')
        setTimeout(() => setSettingsMessage(''), 3000)
      } else {
        setSettingsMessage('Failed to save settings')
      }
    } catch (e) {
      setSettingsMessage('Error saving settings')
    } finally {
      setLoadingSettings(false)
    }
  }

  return (
    <div className="fade-in" style={styles.container}>
      <h1 style={styles.title}>System Settings</h1>
      
      <div style={styles.layout}>
        {/* Main Column: App Settings */}
        <div style={styles.mainColumn}>
          {/* Canvas Defaults Card */}
          <div className="glass-panel-heavy" style={styles.card}>
            <div style={styles.cardHeader}>
              <Camera size={20} color="var(--theme-color-1)" />
              <h2 style={styles.cardTitle}>Camera & Gesture Defaults</h2>
            </div>

            <div style={styles.formGrid}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Mirror Video Feed</label>
                <select 
                  className="glass-input"
                  style={styles.select}
                  value={appSettings.mirrorCamera}
                  onChange={(e) => setAppSettings({ ...appSettings, mirrorCamera: e.target.value })}
                >
                  <option value="true" style={styles.option}>Mirror Camera (Recommended)</option>
                  <option value="false" style={styles.option}>No Mirror (Standard)</option>
                </select>
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Gesture Sensitivity (Min Confidence)</label>
                <input 
                  type="range"
                  min="0.2"
                  max="0.9"
                  step="0.05"
                  value={localConfidence}
                  onChange={(e) => setLocalConfidence(parseFloat(e.target.value))}
                  onMouseUp={() => setAppSettings({ ...appSettings, detectionConfidence: localConfidence.toString() })}
                  onTouchEnd={() => setAppSettings({ ...appSettings, detectionConfidence: localConfidence.toString() })}
                  className="glass-range"
                />
                <div style={styles.rangeValues}>
                  <span>0.2 (Low - Easier detection)</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--theme-color-2)' }}>{localConfidence}</span>
                  <span>0.9 (High - Stricter)</span>
                </div>
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Glass Transparency</label>
                <input 
                  type="range"
                  min="0"
                  max="95"
                  step="5"
                  value={localOpacity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setLocalOpacity(val);
                    // Update CSS variable directly on root for 60fps real-time feedback
                    const glassOpacityVal = 0.3 * (1 - val / 100);
                    document.documentElement.style.setProperty('--glass-opacity-val', glassOpacityVal);
                  }}
                  onMouseUp={() => onGlassOpacityChange(localOpacity)}
                  onTouchEnd={() => onGlassOpacityChange(localOpacity)}
                  className="glass-range"
                />
                <div style={styles.rangeValues}>
                  <span>0% (Solid)</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--theme-color-1)' }}>
                    {localOpacity}%
                  </span>
                  <span>95% (Fully Clear)</span>
                </div>
              </div>
            </div>

            <div style={styles.btnRow}>
              <button onClick={handleSaveSettings} className="glass-btn" disabled={loadingSettings}>
                <Save size={16} />
                <span>{loadingSettings ? 'Saving...' : 'Save Settings'}</span>
              </button>
              {settingsMessage && <span style={styles.successText}>{settingsMessage}</span>}
            </div>
          </div>
        </div>

        {/* Right Column: Theme picker */}
        <div style={styles.sidebar}>
          <div className="glass-panel-heavy" style={styles.card}>
            <div style={styles.cardHeader}>
              <Palette size={20} color="var(--primary-pink)" />
              <h2 style={styles.cardTitle}>Liquid Glass Themes</h2>
            </div>
            <p style={styles.sidebarDesc}>
              Select a curated glow theme. It instantly applies dynamic organic shapes and gradients to your interface.
            </p>
            <div style={styles.themeGrid}>
              {THEME_OPTIONS.map((theme) => {
                const isSelected = theme.name === selectedThemeName
                return (
                  <button 
                    key={theme.name}
                    className={`glass-card ${isSelected ? 'glass-btn-active' : ''}`}
                    style={styles.themeCard(theme.color1, theme.color2, isSelected)}
                    onClick={() => {
                      setSelectedThemeName(theme.name)
                      setSelectedColor1(theme.color1)
                      setSelectedColor2(theme.color2)
                    }}
                  >
                    <img 
                      src={theme.image} 
                      alt={theme.name} 
                      style={styles.themeImagePreview(theme.color1, isSelected)} 
                    />
                    <span style={styles.themeName}>{theme.name}</span>
                  </button>
                )
              })}

              {/* Custom Theme Option */}
              {(() => {
                const isCustomSelected = selectedThemeName === 'Custom Theme'
                return (
                  <>
                    <button 
                      className={`glass-card ${isCustomSelected ? 'glass-btn-active' : ''}`}
                      style={styles.themeCard(customColor1, customColor2, isCustomSelected)}
                      onClick={() => {
                        setSelectedThemeName('Custom Theme')
                        setSelectedColor1(customColor1)
                        setSelectedColor2(customColor2)
                      }}
                    >
                      <img 
                        src={customThemeImg} 
                        alt="Custom Theme" 
                        style={styles.themeImagePreview(customColor1, isCustomSelected)} 
                      />
                      <span style={styles.themeName}>Custom Theme</span>
                    </button>
                    
                    {isCustomSelected && (
                      <div style={styles.customColorPickers} className="fade-in">
                        <div style={styles.customColorInputGroup}>
                          <label style={styles.customColorLabel}>Glow Color 1</label>
                          <div style={styles.colorPickerWrapper}>
                            <input 
                              type="color" 
                              value={customColor1}
                              onChange={(e) => {
                                const val = e.target.value
                                setCustomColor1(val)
                                setSelectedColor1(val)
                                localStorage.setItem('custom_theme_color_1', val)
                              }}
                              style={styles.customColorPickerInput}
                            />
                            <span style={styles.colorHexText}>{customColor1}</span>
                          </div>
                        </div>
                        <div style={styles.customColorInputGroup}>
                          <label style={styles.customColorLabel}>Glow Color 2</label>
                          <div style={styles.colorPickerWrapper}>
                            <input 
                              type="color" 
                              value={customColor2}
                              onChange={(e) => {
                                const val = e.target.value
                                setCustomColor2(val)
                                setSelectedColor2(val)
                                localStorage.setItem('custom_theme_color_2', val)
                              }}
                              style={styles.customColorPickerInput}
                            />
                            <span style={styles.colorHexText}>{customColor2}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>

            {/* Save Theme Button */}
            <div style={styles.btnRowTheme}>
              <button 
                onClick={handleSaveTheme} 
                className="glass-btn glass-btn-primary" 
                style={styles.saveThemeBtn(isThemeChanged)}
                disabled={!isThemeChanged}
              >
                <Save size={16} />
                <span>Save Theme</span>
              </button>
              {themeSavedMessage && <span style={styles.successText}>{themeSavedMessage}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: {
    width: '100%',
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '20px 0',
  },
  title: {
    fontFamily: 'var(--font-title)',
    fontSize: '36px',
    fontWeight: '800',
    marginBottom: '32px',
    letterSpacing: '-1px',
    background: 'linear-gradient(135deg, #ffffff 40%, #a1a1aa 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  layout: {
    display: 'flex',
    gap: '24px',
    flexWrap: 'wrap',
    alignItems: 'stretch',
  },
  mainColumn: {
    flex: '1 1 0px',
    minWidth: '320px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  sidebar: {
    flex: '1 1 0px',
    minWidth: '320px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  card: {
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    height: '100%',
    flex: 1,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  cardTitle: {
    fontFamily: 'var(--font-title)',
    fontSize: '22px',
    fontWeight: '600',
  },
  formGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#d4d4d8',
  },
  btnRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  successText: {
    color: '#10b981',
    fontWeight: '500',
    fontSize: '14px',
  },
  select: {
    appearance: 'none',
    cursor: 'pointer',
  },
  option: {
    background: '#0d0724',
    color: '#fff',
  },
  range: {
    width: '100%',
    height: '6px',
    borderRadius: '3px',
    outline: 'none',
    background: 'rgba(255,255,255,0.1)',
    WebkitAppearance: 'none',
    cursor: 'pointer',
  },
  rangeValues: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: 'var(--text-muted)',
  },
  colorPicker: {
    border: 'none',
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    cursor: 'pointer',
    background: 'none',
  },
  sidebarDesc: {
    color: 'var(--text-secondary)',
    fontSize: '14px',
    lineHeight: '1.5',
  },
  themeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '12px',
    marginTop: '10px',
  },
  themeCard: (color1, color2, isActive) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    width: '100%',
    padding: '16px',
    cursor: 'pointer',
    background: isActive ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
    textAlign: 'left',
  }),
  themeImagePreview: (color, isActive) => ({
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    objectFit: 'cover',
    mixBlendMode: 'screen',
    transition: 'all 0.3s ease',
  }),
  themeName: {
    fontFamily: 'var(--font-title)',
    fontWeight: '600',
    fontSize: '15px',
    color: '#fff',
  },
  customColorPickers: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    padding: '16px',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    marginTop: '4px',
    gridColumn: '1 / -1',
  },
  customColorInputGroup: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
  },
  customColorLabel: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#a1a1aa',
  },
  colorPickerWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  customColorPickerInput: {
    border: 'none',
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    cursor: 'pointer',
    background: 'none',
    padding: 0,
  },
  colorHexText: {
    fontFamily: 'monospace',
    fontSize: '13px',
    color: '#fff',
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '4px 8px',
    borderRadius: '4px',
    minWidth: '70px',
    textAlign: 'center',
  },
  btnRowTheme: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginTop: '20px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    paddingTop: '20px',
  },
  saveThemeBtn: (isEnabled) => ({
    opacity: isEnabled ? 1 : 0.6,
    cursor: isEnabled ? 'pointer' : 'not-allowed',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  })
}
