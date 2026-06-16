import { useState } from 'react'

export default function SmoothSlider({ 
  label, 
  min, 
  max, 
  step = 1, 
  value, 
  onChange, 
  onRelease, 
  formatValue = (v) => v, 
  isInline = false, 
  inlineSliderStyle = {} 
}) {
  const [prevValue, setPrevValue] = useState(value)
  const [localVal, setLocalVal] = useState(value)

  if (value !== prevValue) {
    setPrevValue(value)
    setLocalVal(value)
  }

  const handleChange = (e) => {
    const val = parseFloat(e.target.value)
    setLocalVal(val)
    if (onChange) onChange(val)
  }

  const handleRelease = () => {
    if (onRelease) onRelease(localVal)
  }

  if (isInline) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '12px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
          {label}: {formatValue(localVal)}
        </span>
        <input 
          type="range" 
          min={min} 
          max={max} 
          step={step}
          value={localVal}
          onChange={handleChange}
          onMouseUp={handleRelease}
          onTouchEnd={handleRelease}
          className="glass-range"
          style={inlineSliderStyle}
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', fontSize: '13px' }}>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>
          {label}
        </span>
        <span style={{ color: '#06b6d4', fontWeight: 'bold' }}>
          {formatValue(localVal)}
        </span>
      </div>
      <input 
        type="range" 
        min={min} 
        max={max} 
        step={step}
        value={localVal}
        onChange={handleChange}
        onMouseUp={handleRelease}
        onTouchEnd={handleRelease}
        className="glass-range"
      />
    </div>
  )
}
