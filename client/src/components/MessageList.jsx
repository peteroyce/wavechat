import React, { useEffect, useRef } from 'react'
import Message from './Message.jsx'

export default function MessageList({ messages, currentUserId, onReaction }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    if (typeof bottomRef.current?.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  if (messages.length === 0) {
    return (
      <div style={styles.empty}>
        No messages yet. Say hello!
      </div>
    )
  }

  return (
    <div style={styles.list} data-testid="message-list">
      {messages.map((msg) => (
        <Message
          key={msg._id}
          message={msg}
          isOwn={msg.sender?._id === currentUserId || msg.sender === currentUserId}
          onReaction={onReaction}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}

const styles = {
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  empty: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#475569',
    fontSize: '0.95rem',
  },
}
