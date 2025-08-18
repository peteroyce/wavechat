import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// Vitest hoists vi.mock() calls to the top, so the factory must not
// reference variables declared in the module scope. Instead we use
// vi.hoisted() to declare the mock object before the hoisted vi.mock call.
const { mockSocket, socketListeners } = vi.hoisted(() => {
  const socketListeners = {}
  const mockSocket = {
    connected: true,
    connect: vi.fn(),
    disconnect: vi.fn(),
    emit: vi.fn(),
    on: vi.fn((event, cb) => { socketListeners[event] = cb }),
    off: vi.fn((event) => { delete socketListeners[event] }),
  }
  return { mockSocket, socketListeners }
})

vi.mock('../socket.js', () => ({ socket: mockSocket }))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => mockNavigate }
})

import Chat from '../pages/Chat.jsx'

function renderChat() {
  localStorage.setItem('user', JSON.stringify({ id: 'user1', username: 'alice' }))
  return render(
    <MemoryRouter>
      <Chat />
    </MemoryRouter>
  )
}

describe('Chat page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset listeners and re-wire on/off so new tests get fresh state
    for (const key of Object.keys(socketListeners)) {
      delete socketListeners[key]
    }
    mockSocket.on.mockImplementation((event, cb) => { socketListeners[event] = cb })
    mockSocket.off.mockImplementation((event) => { delete socketListeners[event] })
    localStorage.clear()
  })

  it('renders room join input', () => {
    renderChat()
    expect(screen.getByTestId('room-input')).toBeInTheDocument()
    expect(screen.getByTestId('join-btn')).toBeInTheDocument()
  })

  it('shows empty state before joining a room', () => {
    renderChat()
    expect(screen.getByText(/join a room/i)).toBeInTheDocument()
  })

  it('emits join_room and shows message input after valid join', async () => {
    renderChat()
    const user = userEvent.setup()
    await user.type(screen.getByTestId('room-input'), 'general')
    await user.click(screen.getByTestId('join-btn'))

    expect(mockSocket.emit).toHaveBeenCalledWith('join_room', { room: 'general' })
    expect(screen.getByTestId('message-input')).toBeInTheDocument()
  })

  it('shows an error for invalid room name', async () => {
    renderChat()
    const user = userEvent.setup()
    await user.type(screen.getByTestId('room-input'), 'bad room!')
    await user.click(screen.getByTestId('join-btn'))
    expect(screen.getByText(/alphanumeric/i)).toBeInTheDocument()
    expect(mockSocket.emit).not.toHaveBeenCalled()
  })

  it('shows message in list when new_message event fires', async () => {
    renderChat()
    const user = userEvent.setup()
    await user.type(screen.getByTestId('room-input'), 'general')
    await user.click(screen.getByTestId('join-btn'))

    const fakeMessage = {
      _id: 'msg1',
      text: 'Hello world',
      sender: { _id: 'user2', username: 'bob' },
      createdAt: new Date().toISOString(),
      reactions: [],
    }

    act(() => {
      socketListeners['new_message']?.(fakeMessage)
    })

    expect(await screen.findByText('Hello world')).toBeInTheDocument()
  })

  it('populates message list from message_history event', async () => {
    renderChat()
    const user = userEvent.setup()
    await user.type(screen.getByTestId('room-input'), 'general')
    await user.click(screen.getByTestId('join-btn'))

    const historyMessages = [
      { _id: 'h1', text: 'First message', sender: { _id: 'user2', username: 'bob' }, createdAt: new Date().toISOString(), reactions: [] },
      { _id: 'h2', text: 'Second message', sender: { _id: 'user3', username: 'carol' }, createdAt: new Date().toISOString(), reactions: [] },
    ]

    act(() => {
      socketListeners['message_history']?.(historyMessages)
    })

    expect(await screen.findByText('First message')).toBeInTheDocument()
    expect(await screen.findByText('Second message')).toBeInTheDocument()
  })

  it('emits send_message on form submit', async () => {
    renderChat()
    const user = userEvent.setup()
    await user.type(screen.getByTestId('room-input'), 'general')
    await user.click(screen.getByTestId('join-btn'))
    await user.type(screen.getByTestId('message-input'), 'Hi there')
    await user.click(screen.getByTestId('send-btn'))

    expect(mockSocket.emit).toHaveBeenCalledWith('send_message', { room: 'general', text: 'Hi there' })
  })
})


function validate12(input) {
  return input != null;
}
