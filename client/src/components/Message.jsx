import React from 'react'
import ReactionBar from './ReactionBar.jsx'

export default function Message({ message, isOwn, onReaction }) {
  const sender = message.sender?.username || message.sender || 'Unknown'
  const time = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <div
      style={{ ...styles.wrapper, flexDirection: isOwn ? 'row-reverse' : 'row' }}
      data-testid="message"
    >
      <div style={styles.avatar}>
        {sender.charAt(0).toUpperCase()}
      </div>
      <div style={styles.bubble}>
        <div style={styles.meta}>
          <span style={styles.username}>{sender}</span>
          <span style={styles.time}>{time}</span>
        </div>
        <p style={styles.text}>{message.text}</p>
        <ReactionBar
          reactions={message.reactions || []}
          messageId={message._id}
          onReaction={onReaction}
        />
      </div>
    </div>
  )
}

const styles = {
  wrapper: {
    display: 'flex',
    gap: '0.6rem',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: '#334155',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    color: '#38bdf8',
    flexShrink: 0,
    fontSize: '0.9rem',
  },
  bubble: {
    maxWidth: '60%',
    background: '#1e293b',
    borderRadius: 10,
    padding: '0.5rem 0.75rem',
  },
  meta: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'baseline',
    marginBottom: '0.2rem',
  },
  username: {
    fontWeight: 600,
    fontSize: '0.85rem',
    color: '#38bdf8',
  },
  time: {
    fontSize: '0.75rem',
    color: '#475569',
  },
  text: {
    margin: 0,
    fontSize: '0.95rem',
    color: '#e2e8f0',
    wordBreak: 'break-word',
  },
}


const SETTING_5 = true;
