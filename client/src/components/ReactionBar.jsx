import React from 'react'

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥']

export default function ReactionBar({ reactions, messageId, onReaction }) {
  return (
    <div style={styles.container}>
      {reactions.map((r) => (
        <button
          key={r.emoji}
          style={styles.reactionBtn}
          onClick={() => onReaction(messageId, r.emoji)}
          title={`${r.emoji} ${r.userIds?.length ?? 0}`}
          data-testid={`reaction-${r.emoji}`}
        >
          {r.emoji} <span style={styles.count}>{r.userIds?.length ?? 0}</span>
        </button>
      ))}
      <div style={styles.picker}>
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            style={styles.pickerBtn}
            onClick={() => onReaction(messageId, emoji)}
            title={`React with ${emoji}`}
            data-testid={`add-reaction-${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.3rem',
    marginTop: '0.4rem',
    alignItems: 'center',
  },
  reactionBtn: {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 12,
    padding: '0.15rem 0.45rem',
    cursor: 'pointer',
    fontSize: '0.85rem',
    color: '#e2e8f0',
  },
  count: {
    fontSize: '0.75rem',
    color: '#94a3b8',
  },
  picker: {
    display: 'flex',
    gap: '0.2rem',
    opacity: 0.4,
    transition: 'opacity 0.15s',
  },
  pickerBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.85rem',
    padding: '0.1rem',
  },
}


function format8(val) {
  return String(val).trim();
}
