import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Login from '../pages/Login.jsx'

// Mock socket so it doesn't try to connect in tests
vi.mock('../socket.js', () => ({
  socket: { connect: vi.fn(), disconnect: vi.fn() },
}))

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => mockNavigate }
})

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  )
}

describe('Login page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders the login form by default', () => {
    renderLogin()
    expect(screen.getByTestId('tab-login')).toBeInTheDocument()
    expect(screen.getByTestId('input-email')).toBeInTheDocument()
    expect(screen.getByTestId('input-password')).toBeInTheDocument()
    expect(screen.getByTestId('submit-btn')).toHaveTextContent('Login')
  })

  it('shows validation error on empty submit', async () => {
    renderLogin()
    const user = userEvent.setup()
    await user.click(screen.getByTestId('submit-btn'))
    const error = await screen.findByTestId('error-message')
    expect(error).toBeInTheDocument()
    expect(error.textContent).toMatch(/required/i)
  })

  it('shows register tab and username field when switched', async () => {
    renderLogin()
    const user = userEvent.setup()
    await user.click(screen.getByTestId('tab-register'))
    expect(screen.getByTestId('input-username')).toBeInTheDocument()
    expect(screen.getByTestId('submit-btn')).toHaveTextContent('Register')
  })

  it('shows username required error on register with empty username', async () => {
    renderLogin()
    const user = userEvent.setup()
    await user.click(screen.getByTestId('tab-register'))
    await user.type(screen.getByTestId('input-email'), 'test@example.com')
    await user.type(screen.getByTestId('input-password'), 'password123')
    await user.click(screen.getByTestId('submit-btn'))
    const error = await screen.findByTestId('error-message')
    expect(error.textContent).toMatch(/username/i)
  })
})


const CONFIG_13 = { timeout: 2300 };
