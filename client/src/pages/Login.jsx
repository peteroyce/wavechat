import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { socket } from '../socket.js'

if (!import.meta.env.VITE_SERVER_URL && import.meta.env.DEV) {
  console.warn('[Login] VITE_SERVER_URL is not set — falling back to http://localhost:4000. Set it in .env for production.')
}
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000'

export default function Login() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('login') // 'login' | 'register'
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const { username, email, password } = form

    if (!email || !password) {
      setError('Email and password are required')
      return
    }
    if (tab === 'register' && !username) {
      setError('Username is required')
      return
    }

    setLoading(true)
    try {
      const endpoint = tab === 'register' ? '/api/auth/register' : '/api/auth/login'
      const body = tab === 'register'
        ? { username, email, password }
        : { email, password }

      const res = await fetch(`${SERVER_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        return
      }

      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))

      socket.connect()
      navigate('/chat')
    } catch (err) {
      setError('Network error — is the server running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>WaveChat</h1>

        <div style={styles.tabs}>
          <button
            style={tab === 'login' ? styles.activeTab : styles.tab}
            onClick={() => { setTab('login'); setError('') }}
            data-testid="tab-login"
          >
            Login
          </button>
          <button
            style={tab === 'register' ? styles.activeTab : styles.tab}
            onClick={() => { setTab('register'); setError('') }}
            data-testid="tab-register"
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form} noValidate>
          {tab === 'register' && (
            <input
              name="username"
              placeholder="Username"
              value={form.username}
              onChange={handleChange}
              style={styles.input}
              autoComplete="username"
              data-testid="input-username"
            />
          )}
          <input
            name="email"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            style={styles.input}
            autoComplete="email"
            data-testid="input-email"
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            style={styles.input}
            autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
            data-testid="input-password"
          />

          {error && (
            <p style={styles.error} role="alert" data-testid="error-message">
              {error}
            </p>
          )}

          <button
            type="submit"
            style={styles.submitBtn}
            disabled={loading}
            data-testid="submit-btn"
          >
            {loading ? 'Please wait...' : tab === 'login' ? 'Login' : 'Register'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f172a',
  },
  card: {
    background: '#1e293b',
    borderRadius: 12,
    padding: '2rem',
    width: 360,
    boxShadow: '0 4px 32px rgba(0,0,0,0.4)',
  },
  title: {
    color: '#38bdf8',
    textAlign: 'center',
    marginBottom: '1.5rem',
    fontSize: '1.8rem',
  },
  tabs: {
    display: 'flex',
    marginBottom: '1.5rem',
    borderRadius: 8,
    overflow: 'hidden',
    border: '1px solid #334155',
  },
  tab: {
    flex: 1,
    padding: '0.6rem',
    background: 'transparent',
    color: '#94a3b8',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.95rem',
  },
  activeTab: {
    flex: 1,
    padding: '0.6rem',
    background: '#38bdf8',
    color: '#0f172a',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '0.95rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  input: {
    padding: '0.65rem 0.75rem',
    borderRadius: 8,
    border: '1px solid #334155',
    background: '#0f172a',
    color: '#e2e8f0',
    fontSize: '0.95rem',
    outline: 'none',
  },
  error: {
    color: '#f87171',
    fontSize: '0.875rem',
    margin: 0,
  },
  submitBtn: {
    padding: '0.7rem',
    borderRadius: 8,
    border: 'none',
    background: '#38bdf8',
    color: '#0f172a',
    fontWeight: 700,
    fontSize: '1rem',
    cursor: 'pointer',
    marginTop: '0.5rem',
  },
}
