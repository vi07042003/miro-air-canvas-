import React, { useState, useEffect } from 'react'
import { Palette, Save, Camera } from 'lucide-react'
import { BACKEND_URL } from '../App'

const THEME_OPTIONS = [
  { name: 'Aurora Sky', color1: '#00f2fe', color2: '#4facfe' },
  { name: 'Liquid Pearl', color1: '#ff758c', color2: '#ff7eb3' },
  { name: 'Royal Orchid', color1: '#b18cfd', color2: '#ff7ebb' },
  { name: 'Solar Flare', color1: '#ff0844', color2: '#ffb199' },
  { name: 'Velvet Emerald', color1: '#0575e6', color2: '#00f260' }
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
          <div className="glass-panel" style={styles.card}>
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
                <label style={styles.label}>Default Brush Color</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input 
                    type="color" 
                    value={appSettings.defaultColor}
                    onChange={(e) => setAppSettings({ ...appSettings, defaultColor: e.target.value })}
                    style={styles.colorPicker}
                  />
                  <span style={{ fontStyle: 'monospace' }}>{appSettings.defaultColor}</span>
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
          <div className="glass-panel" style={styles.card}>
            <div style={styles.cardHeader}>
              <Palette size={20} color="var(--primary-pink)" />
              <h2 style={styles.cardTitle}>Liquid Glass Themes</h2>
            </div>
            <p style={styles.sidebarDesc}>
              Select a curated glow theme. It instantly applies dynamic organic shapes and gradients to your interface.
            </p>
            <div style={styles.themeGrid}>
              {THEME_OPTIONS.map((theme) => {
                const isActive = theme.name === activeThemeName
                return (
                  <button 
                    key={theme.name}
                    className={`glass-card ${isActive ? 'glass-btn-active' : ''}`}
                    style={styles.themeCard(theme.color1, theme.color2, isActive)}
                    onClick={() => onThemeChange(theme.color1, theme.color2, theme.name)}
                  >
                    <div style={styles.themePreview(theme.color1, theme.color2)}>
                      <div style={styles.themePreviewDot(theme.color1)}></div>
                      <div style={styles.themePreviewDot(theme.color2)}></div>
                    </div>
                    <span style={styles.themeName}>{theme.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: {
    maxWidth: '1100px',
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
  },
  mainColumn: {
    flex: '2 1 600px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  sidebar: {
    flex: '1 1 300px',
  },
  card: {
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
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
    display: 'flex',
    flexDirection: 'column',
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
  themePreview: (color1, color2) => ({
    width: '48px',
    height: '24px',
    borderRadius: '100px',
    background: `linear-gradient(90deg, ${color1}, ${color2})`,
    display: 'flex',
    padding: '4px',
    gap: '8px',
    alignItems: 'center',
    boxShadow: `0 0 10px ${color1}44`,
  }),
  themePreviewDot: (color) => ({
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.7)',
  }),
  themeName: {
    fontFamily: 'var(--font-title)',
    fontWeight: '600',
    fontSize: '15px',
    color: '#fff',
  }
}
