import React from 'react'

export default function TypingIndicator({ users }) {
  if (!users || users.length === 0) return null

  let label
  if (users.length === 1) {
    label = `${users[0]} is typing...`
  } else if (users.length === 2) {
    label = `${users[0]} and ${users[1]} are typing...`
  } else {
    label = `${users.slice(0, 2).join(', ')} and ${users.length - 2} more are typing...`
  }

  return (
    <div style={styles.container} data-testid="typing-indicator">
      <span style={styles.dots}>
        <span style={styles.dot} />
        <span style={styles.dot} />
        <span style={styles.dot} />
      </span>
      <span style={styles.text}>{label}</span>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.3rem 1rem',
    color: '#94a3b8',
    fontSize: '0.82rem',
    minHeight: 28,
  },
  dots: {
    display: 'flex',
    gap: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: '50%',
    background: '#64748b',
    display: 'inline-block',
    animation: 'bounce 1.2s infinite',
  },
  text: {
    fontStyle: 'italic',
  },
}
