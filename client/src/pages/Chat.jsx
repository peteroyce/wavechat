import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { socket } from '../socket.js'
import MessageList from '../components/MessageList.jsx'
import PresenceSidebar from '../components/PresenceSidebar.jsx'
import TypingIndicator from '../components/TypingIndicator.jsx'

const ROOM_NAME_RE = /^[a-zA-Z0-9-]{1,50}$/

export default function Chat() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  const [room, setRoom] = useState('')
  const [joinedRoom, setJoinedRoom] = useState('')
  const [roomInput, setRoomInput] = useState('')
  const [messages, setMessages] = useState([])
  const [onlineUsers, setOnlineUsers] = useState([])
  const [typingUsers, setTypingUsers] = useState([])
  const [text, setText] = useState('')
  const [roomError, setRoomError] = useState('')
  const typingTimerRef = useRef(null)
  const isTypingRef = useRef(false)

  useEffect(() => {
    if (!socket.connected) socket.connect()

    socket.on('message_history', (history) => setMessages(history))
    socket.on('new_message', (msg) => setMessages(prev => [...prev, msg]))
    socket.on('presence', ({ online }) => setOnlineUsers(online))
    socket.on('typing', ({ users }) => setTypingUsers(users.filter(u => u !== user.username)))
    socket.on('reaction_update', ({ messageId, reactions }) => {
      setMessages(prev => prev.map(m =>
        (m._id === messageId ? { ...m, reactions } : m)
      ))
    })
    socket.on('error', ({ message }) => console.error('Socket error:', message))

    return () => {
      socket.off('message_history')
      socket.off('new_message')
      socket.off('presence')
      socket.off('typing')
      socket.off('reaction_update')
      socket.off('error')
    }
  }, [])

  function handleJoinRoom(e) {
    e.preventDefault()
    setRoomError('')
    const name = roomInput.trim()
    if (!ROOM_NAME_RE.test(name)) {
      setRoomError('Room name must be alphanumeric and dashes only, max 50 chars')
      return
    }
    setMessages([])
    setOnlineUsers([])
    setTypingUsers([])
    setJoinedRoom(name)
    setRoom(name)
    socket.emit('join_room', { room: name })
  }

  function handleSend(e) {
    e.preventDefault()
    if (!text.trim() || !joinedRoom) return
    socket.emit('send_message', { room: joinedRoom, text })
    setText('')
    stopTyping()
  }

  function handleTextChange(e) {
    setText(e.target.value)
    if (!joinedRoom) return

    if (!isTypingRef.current) {
      isTypingRef.current = true
      socket.emit('typing_start', { room: joinedRoom })
    }
    clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(stopTyping, 2000)
  }

  function stopTyping() {
    if (isTypingRef.current) {
      isTypingRef.current = false
      socket.emit('typing_stop', { room: joinedRoom })
    }
    clearTimeout(typingTimerRef.current)
  }

  function handleReaction(messageId, emoji) {
    socket.emit('add_reaction', { messageId, emoji })
  }

  function handleLogout() {
    socket.disconnect()
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  return (
    <div style={styles.layout}>
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <span style={styles.logo}>WaveChat</span>
          <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>

        <form onSubmit={handleJoinRoom} style={styles.joinForm}>
          <input
            value={roomInput}
            onChange={e => setRoomInput(e.target.value)}
            placeholder="Room name"
            style={styles.roomInput}
            data-testid="room-input"
          />
          <button type="submit" style={styles.joinBtn} data-testid="join-btn">Join</button>
        </form>
        {roomError && <p style={styles.roomError}>{roomError}</p>}
        {joinedRoom && <p style={styles.roomLabel}>#{joinedRoom}</p>}

        <PresenceSidebar users={onlineUsers} />
      </aside>

      <main style={styles.main}>
        {joinedRoom ? (
          <>
            <MessageList
              messages={messages}
              currentUserId={user.id}
              onReaction={handleReaction}
            />
            <TypingIndicator users={typingUsers} />
            <form onSubmit={handleSend} style={styles.sendForm}>
              <input
                value={text}
                onChange={handleTextChange}
                placeholder={`Message #${joinedRoom}`}
                style={styles.messageInput}
                maxLength={2000}
                data-testid="message-input"
              />
              <button type="submit" style={styles.sendBtn} data-testid="send-btn">
                Send
              </button>
            </form>
          </>
        ) : (
          <div style={styles.emptyState}>
            <p>Join a room to start chatting</p>
          </div>
        )}
      </main>
    </div>
  )
}

const styles = {
  layout: {
    display: 'flex',
    height: '100vh',
    background: '#0f172a',
    color: '#e2e8f0',
    fontFamily: 'system-ui, sans-serif',
  },
  sidebar: {
    width: 240,
    background: '#1e293b',
    display: 'flex',
    flexDirection: 'column',
    padding: '1rem',
    gap: '0.75rem',
    borderRight: '1px solid #334155',
  },
  sidebarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    color: '#38bdf8',
    fontWeight: 700,
    fontSize: '1.1rem',
  },
  logoutBtn: {
    background: 'transparent',
    border: '1px solid #475569',
    color: '#94a3b8',
    borderRadius: 6,
    padding: '0.25rem 0.5rem',
    cursor: 'pointer',
    fontSize: '0.8rem',
  },
  joinForm: {
    display: 'flex',
    gap: '0.4rem',
  },
  roomInput: {
    flex: 1,
    padding: '0.45rem 0.5rem',
    borderRadius: 6,
    border: '1px solid #334155',
    background: '#0f172a',
    color: '#e2e8f0',
    fontSize: '0.85rem',
  },
  joinBtn: {
    padding: '0.45rem 0.6rem',
    borderRadius: 6,
    border: 'none',
    background: '#38bdf8',
    color: '#0f172a',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  roomError: {
    color: '#f87171',
    fontSize: '0.8rem',
    margin: 0,
  },
  roomLabel: {
    color: '#38bdf8',
    fontWeight: 600,
    margin: 0,
    fontSize: '0.95rem',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  sendForm: {
    display: 'flex',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    borderTop: '1px solid #334155',
  },
  messageInput: {
    flex: 1,
    padding: '0.65rem 0.75rem',
    borderRadius: 8,
    border: '1px solid #334155',
    background: '#1e293b',
    color: '#e2e8f0',
    fontSize: '0.95rem',
  },
  sendBtn: {
    padding: '0.65rem 1rem',
    borderRadius: 8,
    border: 'none',
    background: '#38bdf8',
    color: '#0f172a',
    fontWeight: 700,
    cursor: 'pointer',
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#475569',
    fontSize: '1.1rem',
  },
}
