import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Send, Trash2, Edit3, Reply, X, CornerDownRight, Smile, Paperclip, FileText, Download, Image, ChevronDown } from 'lucide-react'
import { useToast } from './Toast'

export default function ChatModal({
  isOpen,
  onClose,
  user,
  chatMessages,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onDeleteAllMessages = () => {},
  inline = false,
  onTyping = () => {},
  typingUsers = []
}) {
  const [inputText, setInputText] = useState('')
  const [replyingTo, setReplyingTo] = useState(null) // null or message object
  const [editingMsg, setEditingMsg] = useState(null) // null or message object
  const [selectedFile, setSelectedFile] = useState(null) // { name, type, size, data }
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isTypingSent, setIsTypingSent] = useState(false)
  const typingTimeoutRef = useRef(null)
  const fileInputRef = useRef(null)
  const messagesEndRef = useRef(null)
  
  const { showToast } = useToast()
  const [openDropdownId, setOpenDropdownId] = useState(null)
  const [deleteConfirmMsg, setDeleteConfirmMsg] = useState(null)
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false)

  useEffect(() => {
    const handleOutsideClick = () => {
      setOpenDropdownId(null)
    }
    window.addEventListener('click', handleOutsideClick)
    return () => window.removeEventListener('click', handleOutsideClick)
  }, [])

  const emojis = ['😀', '😂', '😍', '👍', '🔥', '🎉', '👏', '🎨', '🚀', '💡', '🤔', '😢', '❤️', '👀', '✨', '💯']

  // Scroll to bottom when messages update or modal opens
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages, isOpen, typingUsers])

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    }
  }, [])

  if (!isOpen) return null

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      alert("File size exceeds 2MB limit.")
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setSelectedFile({
        name: file.name,
        type: file.type,
        size: file.size,
        data: reader.result
      })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleInputChange = (e) => {
    const val = e.target.value
    setInputText(val)
    setShowEmojiPicker(false)

    if (val.trim() && !isTypingSent) {
      setIsTypingSent(true)
      onTyping(true)
    } else if (!val.trim() && isTypingSent) {
      setIsTypingSent(false)
      onTyping(false)
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)

    if (val.trim()) {
      typingTimeoutRef.current = setTimeout(() => {
        setIsTypingSent(false)
        onTyping(false)
      }, 3000)
    }
  }

  const handleInputFocus = () => {
    if (!isTypingSent) {
      setIsTypingSent(true)
      onTyping(true)
    }
  }

  const handleInputBlur = () => {
    if (isTypingSent) {
      setIsTypingSent(false)
      onTyping(false)
    }
  }

  const handleEmojiClick = (emoji) => {
    setInputText(prev => {
      const newVal = prev + emoji
      if (newVal.trim() && !isTypingSent) {
        setIsTypingSent(true)
        onTyping(true)
      }
      return newVal
    })
  }

  const handleSend = (e) => {
    if (e) e.preventDefault()
    if (!inputText.trim() && !selectedFile) return

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    setIsTypingSent(false)
    onTyping(false)

    if (editingMsg) {
      onEditMessage(editingMsg.id, inputText.trim())
      setEditingMsg(null)
    } else {
      onSendMessage(inputText.trim(), replyingTo, selectedFile)
      setReplyingTo(null)
      setSelectedFile(null)
    }
    setInputText('')
  }

  const handleCancelReply = () => {
    setReplyingTo(null)
  }

  const handleCancelEdit = () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    setIsTypingSent(false)
    onTyping(false)
    setEditingMsg(null)
    setInputText('')
  }

  const startEdit = (msg) => {
    setEditingMsg(msg)
    setReplyingTo(null)
    setInputText(msg.text)
  }

  const startReply = (msg) => {
    setReplyingTo(msg)
    setEditingMsg(null)
    setInputText('')
  }

  const handleForwardMessage = (msg) => {
    if (msg.text) {
      navigator.clipboard.writeText(msg.text)
        .then(() => {
          showToast('Message text copied to clipboard', 'info')
        })
        .catch(() => {
          showToast('Failed to copy message', 'error')
        })
    } else if (msg.file) {
      navigator.clipboard.writeText(msg.file.name)
      showToast(`Copied filename: ${msg.file.name}`, 'info')
    }
  }

  const containerStyle = inline ? {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: 'transparent',
    border: 'none',
    boxShadow: 'none',
  } : styles.chatContainer

  return (
    <motion.div
      initial={inline ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.95 }}
      animate={inline ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={inline ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.95 }}
      transition={{ type: 'spring', damping: 25, stiffness: 350 }}
      className={inline ? "" : "glass-panel-heavy chat-modal-window"}
      style={containerStyle}
    >
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquare size={18} color="var(--theme-color-1)" />
          <span style={styles.title}>Session Chat</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {chatMessages.length > 0 && (
            <button 
              className="chat-delete-all-btn"
              onClick={() => setShowDeleteAllConfirm(true)}
              title="Clear All Messages"
            >
              <Trash2 size={14} style={{ marginRight: '4px' }} />
              <span style={{ fontSize: '11px', fontWeight: '600' }}>Clear All</span>
            </button>
          )}
          <button style={styles.closeBtn} onClick={onClose}>
            <X size={18} color="#d4d4d8" />
          </button>
        </div>
      </div>

      {/* Messages list */}
      <div style={styles.messageList}>
        {chatMessages.length === 0 ? (
          <div style={styles.emptyState}>
            <MessageSquare size={36} color="rgba(255, 255, 255, 0.15)" style={{ marginBottom: '8px' }} />
            <p style={{ margin: 0, fontSize: '13px' }}>No messages yet</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>Send a message to start collaborating!</p>
          </div>
        ) : (
          chatMessages.map((msg) => {
            const isMe = msg.sender === user?.username
            return (
              <div key={msg.id} style={{ ...styles.messageWrapper, alignSelf: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{ ...styles.senderName, textAlign: isMe ? 'right' : 'left' }}>
                  {isMe ? 'You' : msg.sender}
                  <span style={styles.timestamp}>{msg.timestamp}</span>
                </div>

                <div className="message-bubble-hover-trigger" style={styles.messageBubbleContainer}>
                  {/* Reply Reference */}
                  {msg.replyTo && (
                    <div style={styles.replyRefContainer}>
                      <div style={styles.replyRefHeader}>
                        <CornerDownRight size={10} style={{ marginRight: '4px' }} />
                        Replying to {msg.replyTo.sender === user?.username ? 'you' : msg.replyTo.sender}
                      </div>
                      <div style={styles.replyRefText}>{msg.replyTo.text}</div>
                    </div>
                  )}

                  {/* Bubble Content */}
                  <div
                    style={{
                      ...styles.bubble,
                      background: isMe 
                        ? 'linear-gradient(135deg, var(--theme-color-1) 0%, var(--theme-color-2) 100%)' 
                        : 'rgba(255, 255, 255, 0.06)',
                      color: isMe ? '#000000' : '#ffffff',
                      fontWeight: isMe ? '500' : '400',
                      borderBottomRightRadius: isMe ? '4px' : '16px',
                      borderBottomLeftRadius: isMe ? '16px' : '4px',
                    }}
                  >
                    {msg.file && (
                      <div style={{ marginBottom: msg.text ? '8px' : '0px' }}>
                        {msg.file.type.startsWith('image/') ? (
                          <div style={styles.imageFileContainer}>
                            <img 
                              src={msg.file.data} 
                              alt={msg.file.name} 
                              style={styles.imageFile} 
                              onClick={() => {
                                const link = document.createElement('a')
                                link.href = msg.file.data
                                link.download = msg.file.name
                                link.click()
                              }} 
                            />
                          </div>
                        ) : (
                          <div style={{ ...styles.docFileContainer, borderColor: isMe ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.1)' }}>
                            <FileText size={20} color={isMe ? '#000000' : 'var(--theme-color-1)'} />
                            <div style={styles.docFileInfo}>
                              <span style={{ ...styles.docFileName, color: isMe ? '#000000' : '#ffffff' }}>{msg.file.name}</span>
                              <span style={{ ...styles.docFileSize, color: isMe ? 'rgba(0,0,0,0.6)' : 'var(--text-muted)' }}>{(msg.file.size / 1024).toFixed(1)} KB</span>
                            </div>
                            <button 
                              style={styles.downloadFileBtn} 
                              onClick={() => {
                                const link = document.createElement('a')
                                link.href = msg.file.data
                                link.download = msg.file.name
                                link.click()
                              }}
                            >
                              <Download size={14} color={isMe ? '#000000' : '#ffffff'} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    {msg.text && <div style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{msg.text}</div>}
                    {msg.edited && (
                      <span style={{ 
                        ...styles.editedTag, 
                        color: isMe ? 'rgba(0,0,0,0.5)' : 'var(--text-muted)' 
                      }}>
                        (edited)
                      </span>
                    )}

                    {/* WhatsApp-like Dropdown Trigger */}
                    <button
                      className="message-dropdown-trigger"
                      style={{
                        position: 'absolute',
                        right: '6px',
                        top: '6px',
                        background: 'rgba(15, 23, 42, 0.65)',
                        backdropFilter: 'blur(4px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '50%',
                        width: '22px',
                        height: '22px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: '#ffffff',
                        opacity: openDropdownId === msg.id ? 1 : 0,
                        transition: 'opacity 0.2s, background 0.2s',
                        zIndex: 10,
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenDropdownId(openDropdownId === msg.id ? null : msg.id)
                      }}
                    >
                      <ChevronDown size={12} />
                    </button>

                    <AnimatePresence>
                      {openDropdownId === msg.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.85, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.85, y: -10 }}
                          transition={{ type: 'spring', duration: 0.25, bounce: 0.1 }}
                          style={{
                            position: 'absolute',
                            right: '6px',
                            top: '32px',
                            background: 'rgba(15, 23, 42, 0.95)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
                            zIndex: 100,
                            padding: '4px',
                            minWidth: '110px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            className="chat-dropdown-item"
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenDropdownId(null)
                              startReply(msg)
                            }}
                          >
                            <Reply size={12} color="var(--theme-color-1)" />
                            <span>Reply</span>
                          </button>
                          
                          <button
                            className="chat-dropdown-item"
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenDropdownId(null)
                              handleForwardMessage(msg)
                            }}
                          >
                            <CornerDownRight size={12} color="#10b981" />
                            <span>Forward</span>
                          </button>

                          {isMe && (
                            <button
                              className="chat-dropdown-item"
                              onClick={(e) => {
                                e.stopPropagation()
                                setOpenDropdownId(null)
                                startEdit(msg)
                              }}
                            >
                              <Edit3 size={12} color="var(--theme-color-2)" />
                              <span>Edit</span>
                            </button>
                          )}
                          
                          <button
                            className="chat-dropdown-item"
                            style={{ color: '#ef4444' }}
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenDropdownId(null)
                              setDeleteConfirmMsg(msg)
                            }}
                          >
                            <Trash2 size={12} color="#ef4444" />
                            <span>Delete</span>
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            )
          })
        )}
        {typingUsers.length > 0 && (
          <div style={styles.typingIndicatorWrapper}>
            <div style={styles.typingBubble}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing
              </span>
              <div className="typing-indicator-dots">
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer / Input area */}
      <div style={styles.footer}>
        {/* Replying Status banner */}
        {replyingTo && (
          <div style={styles.replyBanner}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <Reply size={12} color="var(--theme-color-1)" />
              <span>Replying to <strong>{replyingTo.sender === user?.username ? 'yourself' : replyingTo.sender}</strong></span>
            </div>
            <button style={styles.cancelBannerBtn} onClick={handleCancelReply}>
              <X size={12} />
            </button>
          </div>
        )}

        {/* Editing Status banner */}
        {editingMsg && (
          <div style={styles.replyBanner}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <Edit3 size={12} color="var(--theme-color-2)" />
              <span>Editing message</span>
            </div>
            <button style={styles.cancelBannerBtn} onClick={handleCancelEdit}>
              <X size={12} />
            </button>
          </div>
        )}

        {/* Selected File Preview Banner */}
        {selectedFile && (
          <div style={styles.selectedFilePreview}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {selectedFile.type.startsWith('image/') ? (
                <img src={selectedFile.data} alt="Upload preview" style={styles.thumbnailPreview} />
              ) : (
                <FileText size={20} color="var(--theme-color-1)" />
              )}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={styles.previewFileName}>{selectedFile.name}</span>
                <span style={styles.previewFileSize}>{(selectedFile.size / 1024).toFixed(1)} KB</span>
              </div>
            </div>
            <button type="button" style={styles.cancelBannerBtn} onClick={() => setSelectedFile(null)}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Emoji Selector Panel */}
        {showEmojiPicker && (
          <div style={styles.emojiPickerContainer}>
            <div style={styles.emojiGrid}>
              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  style={styles.emojiBtn}
                  onClick={() => handleEmojiClick(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSend} style={styles.inputForm}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            style={{
              ...styles.iconBtn,
              background: showEmojiPicker ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
            }}
            title="Add Emoji"
          >
            <Smile size={18} color="#d4d4d8" />
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={styles.iconBtn}
            title="Attach file (Image or Document)"
          >
            <Paperclip size={18} color="#d4d4d8" />
          </button>

          <input
            type="text"
            value={inputText}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder={editingMsg ? 'Edit your message...' : 'Type a message...'}
            className="glass-input"
            style={styles.input}
          />
          <button 
            type="submit" 
            disabled={!inputText.trim() && !selectedFile}
            style={{
              ...styles.sendBtn,
              opacity: (inputText.trim() || selectedFile) ? 1 : 0.5,
              cursor: (inputText.trim() || selectedFile) ? 'pointer' : 'default'
            }}
          >
            <Send size={16} color={(inputText.trim() || selectedFile) ? '#ffffff' : '#a1a1aa'} />
          </button>
        </form>
      </div>

      {/* Delete Confirmation Modal Overlay */}
      <AnimatePresence>
        {deleteConfirmMsg && (
          <div style={styles.modalOverlay}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel-heavy"
              style={styles.deleteConfirmModal}
            >
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#ffffff', fontWeight: '600' }}>Delete message?</h4>
              <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                Are you sure you want to delete this message?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {deleteConfirmMsg.sender === user?.username && (
                  <button
                    className="glass-btn-danger"
                    style={styles.deleteBtnOption}
                    onClick={() => {
                      onDeleteMessage(deleteConfirmMsg.id, 'everyone')
                      setDeleteConfirmMsg(null)
                    }}
                  >
                    Delete for Everyone
                  </button>
                )}
                <button
                  className="glass-btn"
                  style={styles.deleteBtnOption}
                  onClick={() => {
                    onDeleteMessage(deleteConfirmMsg.id, 'me')
                    setDeleteConfirmMsg(null)
                  }}
                >
                  Delete for Me
                </button>
                <button
                  className="glass-btn"
                  style={{ ...styles.deleteBtnOption, background: 'transparent', borderColor: 'transparent', color: 'var(--text-muted)' }}
                  onClick={() => setDeleteConfirmMsg(null)}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete All Confirmation Modal Overlay */}
      <AnimatePresence>
        {showDeleteAllConfirm && (
          <div style={styles.modalOverlay}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel-heavy"
              style={styles.deleteConfirmModal}
            >
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#ffffff', fontWeight: '600' }}>Clear all messages?</h4>
              <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                Are you sure you want to delete all messages in this session? This action cannot be undone.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  className="glass-btn-danger"
                  style={styles.deleteBtnOption}
                  onClick={() => {
                    onDeleteAllMessages()
                    setShowDeleteAllConfirm(false)
                  }}
                >
                  Clear chat for everyone
                </button>
                <button
                  className="glass-btn"
                  style={{ ...styles.deleteBtnOption, background: 'transparent', borderColor: 'transparent', color: 'var(--text-muted)' }}
                  onClick={() => setShowDeleteAllConfirm(false)}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

const styles = {
  chatContainer: {
    position: 'fixed',
    bottom: '90px',
    right: '24px',
    width: '360px',
    height: '480px',
    borderRadius: '20px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    zIndex: 1000,
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  header: {
    padding: '14px 18px',
    background: 'rgba(0, 0, 0, 0.25)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#ffffff',
    fontFamily: 'var(--font-title)',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
    transition: 'background 0.2s',
    ':hover': {
      background: 'rgba(255, 255, 255, 0.05)',
    }
  },
  messageList: {
    flex: 1,
    padding: '16px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    background: 'rgba(0, 0, 0, 0.1)',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--text-secondary)',
    textAlign: 'center',
    padding: '0 20px',
  },
  messageWrapper: {
    display: 'flex',
    flexDirection: 'column',
    maxWidth: '80%',
    gap: '4px',
  },
  senderName: {
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  timestamp: {
    fontSize: '9px',
    fontWeight: '400',
    color: 'var(--text-muted)',
  },
  messageBubbleContainer: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  },
  bubble: {
    padding: '10px 32px 10px 14px',
    borderRadius: '16px',
    fontSize: '13px',
    lineHeight: '1.4',
    position: 'relative',
  },
  editedTag: {
    fontSize: '9px',
    marginLeft: '6px',
    fontStyle: 'italic',
  },
  replyRefContainer: {
    background: 'rgba(0, 0, 0, 0.2)',
    borderLeft: '2px solid var(--theme-color-1)',
    padding: '4px 8px',
    borderRadius: '6px',
    marginBottom: '4px',
    fontSize: '11px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  replyRefHeader: {
    fontWeight: '700',
    color: 'var(--theme-color-1)',
    display: 'flex',
    alignItems: 'center',
  },
  replyRefText: {
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '200px',
  },
  actionsOverlay: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    right: '-75px',
    display: 'flex',
    gap: '4px',
    background: 'rgba(15, 23, 42, 0.85)',
    backdropFilter: 'blur(4px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    padding: '3px 6px',
    borderRadius: '20px',
    opacity: 0,
    pointerEvents: 'none',
    transition: 'opacity 0.2s, transform 0.2s',
    zIndex: 5,
  },
  bubbleActionBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    transition: 'background 0.2s',
    ':hover': {
      background: 'rgba(255, 255, 255, 0.1)',
    }
  },
  footer: {
    padding: '12px 16px',
    background: 'rgba(0, 0, 0, 0.25)',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  replyBanner: {
    background: 'rgba(255, 255, 255, 0.04)',
    padding: '6px 12px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  cancelBannerBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '2px',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
  },
  inputForm: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    fontSize: '13px',
    borderRadius: '10px',
    background: 'rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#ffffff',
  },
  sendBtn: {
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s, transform 0.1s',
  },
  imageFileContainer: {
    marginTop: '4px',
    maxHeight: '180px',
    borderRadius: '12px',
    overflow: 'hidden',
    cursor: 'pointer',
    border: '1px solid rgba(255, 255, 255, 0.1)'
  },
  imageFile: {
    width: '100%',
    maxHeight: '180px',
    objectFit: 'cover',
    display: 'block',
    transition: 'opacity 0.2s',
  },
  docFileContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 12px',
    borderRadius: '10px',
    background: 'rgba(0, 0, 0, 0.15)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    marginTop: '4px',
    maxWidth: '240px'
  },
  docFileInfo: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0
  },
  docFileName: {
    fontSize: '12px',
    fontWeight: '600',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  docFileSize: {
    fontSize: '10px',
  },
  downloadFileBtn: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    cursor: 'pointer',
    padding: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
    transition: 'background 0.2s',
  },
  selectedFilePreview: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  },
  thumbnailPreview: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    objectFit: 'cover',
    border: '1px solid rgba(255, 255, 255, 0.1)'
  },
  previewFileName: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#ffffff',
    maxWidth: '180px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  previewFileSize: {
    fontSize: '9px',
    color: 'var(--text-muted)'
  },
  emojiPickerContainer: {
    background: 'rgba(15, 23, 42, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '10px',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)',
    backdropFilter: 'blur(10px)'
  },
  emojiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(8, 1fr)',
    gap: '6px',
    maxHeight: '120px',
    overflowY: 'auto'
  },
  emojiBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: '16px',
    padding: '4px',
    cursor: 'pointer',
    borderRadius: '6px',
    transition: 'transform 0.1s, background 0.1s',
  },
  iconBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    transition: 'background 0.2s',
  },
  typingIndicatorWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignSelf: 'flex-start',
    maxWidth: '80%',
    gap: '4px',
  },
  typingBubble: {
    padding: '8px 12px',
    borderRadius: '16px',
    borderBottomLeftRadius: '4px',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.55)',
    backdropFilter: 'blur(3px)',
    borderRadius: '20px',
    zIndex: 1000,
  },
  deleteConfirmModal: {
    background: 'rgba(15, 23, 42, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    padding: '16px',
    borderRadius: '16px',
    width: '85%',
    maxWidth: '260px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
    display: 'flex',
    flexDirection: 'column',
  },
  deleteBtnOption: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background 0.2s, border-color 0.2s',
  }
}
