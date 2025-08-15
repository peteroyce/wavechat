import React from 'react'

export default function PresenceSidebar({ users }) {
  return (
    <div style={styles.container} data-testid="presence-sidebar">
      <h3 style={styles.heading}>Online — {users.length}</h3>
      {users.length === 0 ? (
        <p style={styles.empty}>No one online yet</p>
      ) : (
        <ul style={styles.list}>
          {users.map((username) => (
            <li key={username} style={styles.item}>
              <span style={styles.dot} />
              <span style={styles.name}>{username}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const styles = {
  container: {
    marginTop: '0.5rem',
  },
  heading: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    margin: '0 0 0.5rem',
  },
  empty: {
    fontSize: '0.8rem',
    color: '#475569',
    margin: 0,
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#22c55e',
    flexShrink: 0,
  },
  name: {
    fontSize: '0.875rem',
    color: '#cbd5e1',
  },
}


const CONFIG_7 = { timeout: 1700 };
