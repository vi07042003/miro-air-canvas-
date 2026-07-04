import { useState, useEffect, useRef } from 'react'
import { useToast } from '../components/Toast'
import { drawShapePath } from '../utils/canvasUtils'

const getBgColor = () => {
  if (typeof window !== 'undefined') {
    const rootStyle = getComputedStyle(document.documentElement)
    return rootStyle.getPropertyValue('--bg-dark-1').trim() || '#0C121C'
  }
  return '#0C121C'
}

export function useCollaboration({
  canvasRef,
  saveCanvasState,
  user,
  BACKEND_URL,
  onRemoteModeSwitch,
  onRemoteUndo,
  onRemoteRedo,
  onRemoteClear,
  onRemoteDraw3DObject,
  onRemoteSync3DObjects,
  get3DObjectsData,
  getCanvasMode,
  onRemoteStartAISketch,
  onRemoteCancelAISketch,
  onRemoteCompleteAISketch
}) {
  const { showToast } = useToast()
  const [active, setActive] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [participants, setParticipants] = useState([])
  const [remoteCursors, setRemoteCursors] = useState({})
  
  const socketRef = useRef(null)
  const callbacksRef = useRef({})
  callbacksRef.current = {
    user,
    participants,
    onRemoteModeSwitch,
    onRemoteUndo,
    onRemoteRedo,
    onRemoteClear,
    onRemoteDraw3DObject,
    onRemoteSync3DObjects,
    get3DObjectsData,
    getCanvasMode,
    onRemoteStartAISketch,
    onRemoteCancelAISketch,
    onRemoteCompleteAISketch
  }
  
  // Assign a consistent user color for cursors
  const [userColor] = useState(() => {
    const colors = ['#00f2fe', '#4facfe', '#ff007f', '#a855f7', '#10b981', '#fbbf24', '#f43f5e', '#ec4899']
    return colors[Math.floor(Math.random() * colors.length)]
  })

  const sendJsonMessage = (msg) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg))
    }
  }

  // Create a new session room
  const createRoom = async () => {
    if (!user) {
      showToast('Please sign in to start collaboration', 'error')
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
      setRoomCode(data.room_code)
      return data.room_code
    } catch (err) {
      showToast('Error creating collaboration session', 'error')
      console.error(err)
      return null
    }
  }

  // Check if a room exists
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

  // Connect to a room WebSocket
  const joinRoom = (code) => {
    if (!user) return
    if (socketRef.current) {
      socketRef.current.close()
    }

    const wsProto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const wsBaseUrl = BACKEND_URL.replace(/^https?/, wsProto)
    const cleanColor = userColor.replace('#', '')
    const wsUrl = `${wsBaseUrl}/api/collaboration/ws/${code}/${encodeURIComponent(user.username)}/${cleanColor}`

    let socket
    try {
      socket = new WebSocket(wsUrl)
    } catch (err) {
      console.error('WebSocket creation failed:', err)
      showToast('Failed to connect to collaboration server.', 'error')
      return
    }
    socketRef.current = socket

    socket.onopen = () => {
      setActive(true)
      setRoomCode(code)
      showToast(`Connected to session ${code}!`, 'success')
      
      // Request initial canvas state from other participants
      setTimeout(() => {
        sendJsonMessage({
          type: 'request-canvas-sync',
          requester: user.username
        })
      }, 500)
    }

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        handleRemoteMessage(msg)
      } catch (err) {
        console.error('Error parsing WebSocket message:', err)
      }
    }

    socket.onerror = (err) => {
      console.error('WebSocket Error:', err)
      showToast('Collaboration connection error', 'error')
    }

    socket.onclose = () => {
      setActive(false)
      setParticipants([])
      setRemoteCursors({})
      showToast('Collaboration session disconnected', 'info')
    }
  }

  // Leave active room
  const leaveRoom = () => {
    if (socketRef.current) {
      socketRef.current.close()
      socketRef.current = null
    }
    setActive(false)
    setRoomCode('')
    setParticipants([])
    setRemoteCursors({})
  }

  // Handle all incoming remote payloads
  const handleRemoteMessage = (msg) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    switch (msg.type) {
      case 'user-joined':
        setParticipants(msg.participants || [])
        if (msg.username !== callbacksRef.current.user?.username) {
          showToast(`${msg.username} joined the session`, 'info')
        }
        break

      case 'user-left':
        setParticipants(msg.participants || [])
        showToast(`${msg.username} left the session`, 'info')
        setRemoteCursors(prev => {
          const next = { ...prev }
          delete next[msg.username]
          return next
        })
        break

      case 'request-canvas-sync':
        // If we are the older user in the room, send our canvas snapshot to sync the new user
        // We can check if we are the first participant in the list (who is not the requester)
        const activeParticipants = callbacksRef.current.participants.filter(p => p.username !== msg.requester)
        const amOldest = activeParticipants.length > 0 && activeParticipants[0].username === callbacksRef.current.user?.username
        
        if (amOldest || activeParticipants.length === 0) {
          sendJsonMessage({
            type: 'canvas-sync',
            targetUser: msg.requester,
            imageData: canvas.toDataURL(),
            threedObjects: callbacksRef.current.get3DObjectsData ? callbacksRef.current.get3DObjectsData() : [],
            canvasMode: callbacksRef.current.getCanvasMode ? callbacksRef.current.getCanvasMode() : '2d'
          })
        }
        break

      case 'canvas-sync':
        if (msg.targetUser === callbacksRef.current.user?.username) {
          const img = new Image()
          img.onload = () => {
            ctx.save()
            ctx.globalAlpha = 1.0
            ctx.fillStyle = getBgColor()
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            ctx.restore()
            saveCanvasState(false)
          }
          img.src = msg.imageData

          if (msg.threedObjects && callbacksRef.current.onRemoteSync3DObjects) {
            callbacksRef.current.onRemoteSync3DObjects(msg.threedObjects)
          }

          if (msg.canvasMode && callbacksRef.current.onRemoteModeSwitch) {
            callbacksRef.current.onRemoteModeSwitch(msg.canvasMode)
          }
        }
        break

      case 'broadcast-canvas-state':
        {
          const img = new Image()
          img.onload = () => {
            ctx.save()
            ctx.globalAlpha = 1.0
            ctx.fillStyle = getBgColor()
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            ctx.restore()
            saveCanvasState(false)
          }
          img.src = msg.imageData

          if (msg.threedObjects && callbacksRef.current.onRemoteSync3DObjects) {
            callbacksRef.current.onRemoteSync3DObjects(msg.threedObjects)
          }
        }
        break

      case 'draw-point':
        ctx.save()
        ctx.strokeStyle = msg.tool === 'eraser' ? getBgColor() : msg.color
        ctx.fillStyle = msg.tool === 'eraser' ? getBgColor() : msg.color
        ctx.lineWidth = msg.brushSize
        ctx.globalAlpha = msg.brushOpacity
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        
        ctx.beginPath()
        if (msg.tool === 'spray') {
          const radius = Math.max(10, msg.brushSize * 2.5)
          const density = 25
          const drawX = msg.x * canvas.width
          const drawY = msg.y * canvas.height
          for (let i = 0; i < density; i++) {
            const angle = Math.random() * Math.PI * 2
            const dist = Math.random() * radius
            const sx = drawX + Math.cos(angle) * dist
            const sy = drawY + Math.sin(angle) * dist
            ctx.fillRect(sx, sy, 1.5, 1.5)
          }
        } else {
          if (msg.tool === 'pencil') {
            ctx.lineWidth = 2
            ctx.globalAlpha = 1.0
          } else if (msg.tool === 'highlighter') {
            ctx.globalAlpha = 0.35
            ctx.lineWidth = Math.max(12, msg.brushSize * 2.5)
            ctx.lineCap = 'square'
            ctx.lineJoin = 'miter'
          }
          ctx.moveTo(msg.lastX * canvas.width, msg.lastY * canvas.height)
          ctx.lineTo(msg.x * canvas.width, msg.y * canvas.height)
          ctx.stroke()
        }
        ctx.restore()
        break

      case 'draw-shape':
        ctx.save()
        ctx.strokeStyle = msg.color
        ctx.lineWidth = msg.brushSize
        ctx.globalAlpha = msg.brushOpacity
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        
        if (msg.tool === 'pencil') {
          ctx.lineWidth = 2
          ctx.globalAlpha = 1.0
        } else if (msg.tool === 'highlighter') {
          ctx.globalAlpha = 0.35
          ctx.lineWidth = Math.max(12, msg.brushSize * 2.5)
          ctx.lineCap = 'square'
          ctx.lineJoin = 'miter'
        }

        ctx.beginPath()
        drawShapePath(
          ctx,
          msg.tool,
          msg.startX * canvas.width,
          msg.startY * canvas.height,
          msg.endX * canvas.width,
          msg.endY * canvas.height
        )
        ctx.stroke()
        ctx.restore()
        saveCanvasState(false)
        break

      case 'clear':
        if (callbacksRef.current.onRemoteClear) {
          callbacksRef.current.onRemoteClear(msg.mode || '2d')
        } else {
          ctx.save()
          ctx.globalAlpha = 1.0
          ctx.fillStyle = getBgColor()
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.restore()
          saveCanvasState(true)
        }
        break

      case 'switch-mode':
        if (callbacksRef.current.onRemoteModeSwitch) {
          callbacksRef.current.onRemoteModeSwitch(msg.mode)
        }
        break

      case 'undo':
        if (callbacksRef.current.onRemoteUndo) {
          callbacksRef.current.onRemoteUndo(msg.mode)
        }
        break

      case 'redo':
        if (callbacksRef.current.onRemoteRedo) {
          callbacksRef.current.onRemoteRedo(msg.mode)
        }
        break

      case 'draw-3d-object':
        if (callbacksRef.current.onRemoteDraw3DObject) {
          callbacksRef.current.onRemoteDraw3DObject(msg.object)
        }
        break

      case 'start-ai-sketch':
        if (callbacksRef.current.onRemoteStartAISketch) {
          callbacksRef.current.onRemoteStartAISketch(msg.contours, msg.w, msg.h, msg.targetCanvas, msg.promptStr)
        }
        break

      case 'cancel-ai-sketch':
        if (callbacksRef.current.onRemoteCancelAISketch) {
          callbacksRef.current.onRemoteCancelAISketch()
        }
        break

      case 'complete-ai-sketch':
        if (callbacksRef.current.onRemoteCompleteAISketch) {
          callbacksRef.current.onRemoteCompleteAISketch()
        }
        break

      case 'cursor-move':
        setRemoteCursors(prev => ({
          ...prev,
          [msg.sender]: {
            x: msg.x,
            y: msg.y,
            color: msg.color
          }
        }))
        break

      default:
        break
    }
  }

  // Broadcast mouse / hand cursor movements
  const sendCursorMove = (clientX, clientY) => {
    const canvas = canvasRef.current
    if (!canvas || !active) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    
    // Normalized coordinates (0 to 1) relative to canvas size
    const x = ((clientX - rect.left) * scaleX) / canvas.width
    const y = ((clientY - rect.top) * scaleY) / canvas.height
    
    sendJsonMessage({
      type: 'cursor-move',
      x,
      y,
      color: userColor
    })
  }

  // Broadcast hand-gesture coordinates directly
  const sendHandCursorMove = (normX, normY) => {
    if (!active) return
    sendJsonMessage({
      type: 'cursor-move',
      x: normX,
      y: normY,
      color: userColor
    })
  }

  // Broadcast draw stroke point
  const sendDrawPoint = (pointData) => {
    if (!active) return
    sendJsonMessage({
      type: 'draw-point',
      ...pointData
    })
  }

  // Broadcast completed vector shape
  const sendDrawShape = (shapeData) => {
    if (!active) return
    sendJsonMessage({
      type: 'draw-shape',
      ...shapeData
    })
  }

  // Broadcast canvas clear
  const sendClear = (mode = '2d') => {
    if (!active) return
    sendJsonMessage({
      type: 'clear',
      mode
    })
  }

  // Broadcast 2D/3D mode switch
  const sendSwitchMode = (mode) => {
    if (!active) return
    sendJsonMessage({
      type: 'switch-mode',
      mode
    })
  }

  // Broadcast AI Sketch start
  const sendStartAISketch = (contours, w, h, targetCanvas, promptStr) => {
    if (!active) return
    sendJsonMessage({
      type: 'start-ai-sketch',
      contours,
      w,
      h,
      targetCanvas,
      promptStr
    })
  }

  // Broadcast AI Sketch cancel
  const sendCancelAISketch = () => {
    if (!active) return
    sendJsonMessage({
      type: 'cancel-ai-sketch'
    })
  }

  // Broadcast AI Sketch complete
  const sendCompleteAISketch = () => {
    if (!active) return
    sendJsonMessage({
      type: 'complete-ai-sketch'
    })
  }

  // Broadcast undo command
  const sendUndo = (mode) => {
    if (!active) return
    sendJsonMessage({
      type: 'undo',
      mode
    })
  }

  // Broadcast redo command
  const sendRedo = (mode) => {
    if (!active) return
    sendJsonMessage({
      type: 'redo',
      mode
    })
  }

  // Broadcast completed 3D Object
  const sendDraw3DObject = (object) => {
    if (!active) return
    sendJsonMessage({
      type: 'draw-3d-object',
      object
    })
  }

  // Broadcast entire canvas state (e.g. for stencils or AI sketches)
  const broadcastCanvasState = () => {
    const canvas = canvasRef.current
    if (!canvas || !active) return
    sendJsonMessage({
      type: 'broadcast-canvas-state',
      imageData: canvas.toDataURL(),
      threedObjects: get3DObjectsData ? get3DObjectsData() : []
    })
  }

  // Close socket on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close()
      }
    }
  }, [])

  return {
    active,
    roomCode,
    userColor,
    participants,
    remoteCursors,
    createRoom,
    joinRoom,
    leaveRoom,
    checkRoomExists,
    sendCursorMove,
    sendHandCursorMove,
    sendDrawPoint,
    sendDrawShape,
    sendClear,
    sendSwitchMode,
    sendStartAISketch,
    sendCancelAISketch,
    sendCompleteAISketch,
    sendUndo,
    sendRedo,
    sendDraw3DObject,
    broadcastCanvasState
  }
}
