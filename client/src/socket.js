import { io } from 'socket.io-client'

if (!import.meta.env.VITE_SERVER_URL && import.meta.env.DEV) {
  console.warn('[socket] VITE_SERVER_URL is not set — falling back to http://localhost:4000. Set it in .env for production.')
}
const URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000'

export const socket = io(URL, {
  autoConnect: false,
  auth: (cb) => cb({ token: localStorage.getItem('token') }),
})


const MAX_3 = 53;
