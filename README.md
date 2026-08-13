# wavechat

A small, self-hostable real-time chat server and web client. Named rooms, presence, typing
indicators, emoji reactions and persisted history over a single Socket.IO connection, backed by
MongoDB. No third-party realtime provider is involved, so the whole message path stays in your
own infrastructure.

![license](https://img.shields.io/badge/license-MIT-blue) ![node](https://img.shields.io/badge/node-22-informational) ![ci](https://img.shields.io/badge/CI-GitHub%20Actions-lightgrey)

## Features

- **Named rooms** — `join_room` puts the socket in a Socket.IO room; room names are validated
  against `/^[a-zA-Z0-9-]{1,50}$/` on both client and server, so a room name can never be a
  path or an injection vector.
- **Presence** — the server keeps an in-memory `room -> Set<socketId>` map and rebroadcasts the
  online list on every join and disconnect. Presence is deliberately not persisted; it is
  connection state, not data.
- **Typing indicators** — per-room `Set` of usernames, driven by `typing_start` / `typing_stop`.
  The client debounces with a 2 second timer, so a steady typist sends one event, not one per
  keystroke.
- **Emoji reactions** — `add_reaction` toggles: reacting twice with the same emoji removes you.
  Empty reaction groups are pruned in application code, because MongoDB will not accept `$size`
  inside a `$pull` filter.
- **Message history** — the last 50 messages of a room are sent on join, sorted ascending, with
  the sender populated. A compound index on `{ room, createdAt }` keeps that query cheap.
- **JWT auth on the socket handshake** — a Socket.IO `io.use` middleware verifies the token
  before `connection` fires, so an unauthenticated socket never reaches a handler.
- **Per-IP connection rate limit** — 5 connections per minute per address, enforced in a second
  handshake middleware.
- **Input limits everywhere** — 2000 character messages, 10 character emoji, ObjectId-shaped
  message IDs, and a check that the sender actually joined the room they are posting to.

## Architecture

```
browser (React 18 + Vite)
   |
   |  POST /api/auth/register | /api/auth/login   -> JWT stored in localStorage
   |
   |  socket.io-client, auth: { token }
   v
handshake middleware:  verify JWT  ->  per-IP rate limit
   |
   v
socket/handlers.js  ── in-memory maps ──>  rooms, socketMeta, typingUsers
   |                                        (presence and typing state)
   v
Mongoose models
   Message { room, sender, text, reactions[] }
   User    { username, email, password (bcrypt), lastSeen }
```

| Path | Role |
|---|---|
| `server/src/index.js` | Express app, env validation, Mongo connection, Socket.IO server |
| `server/src/socket/handlers.js` | All socket events, auth and rate-limit middleware, room state |
| `server/src/routes/auth.js` | Register and login, issues 7-day JWTs |
| `server/src/models/` | `Message`, `User` |
| `client/src/pages/` | `Login`, `Chat` |
| `client/src/components/` | `MessageList`, `Message`, `PresenceSidebar`, `TypingIndicator`, `ReactionBar` |

## Quickstart

```bash
npm install                       # npm workspaces: installs server and client

cp server/.env.example server/.env
# PORT=4000
# MONGODB_URI=mongodb://localhost:27017/wavechat
# JWT_SECRET=your-secret-min-32-chars
# CLIENT_URL=http://localhost:5173

docker compose up mongo -d        # or point MONGODB_URI at an existing MongoDB

npm run dev                       # server on :4000, Vite client on :5173
```

The server exits at startup if `JWT_SECRET` or `MONGODB_URI` is unset, rather than failing later
on the first token verification.

For the client, set `VITE_SERVER_URL` in `client/.env` if the server is not on
`http://localhost:4000`; in dev it falls back to that URL and logs a warning.

Note: `docker-compose.yml` defines a `server` service with `build: ./server`, but no Dockerfile
is committed. Only the `mongo` service runs out of the box.

## Socket API

All events carry the authenticated user implicitly — the client never sends a user ID.

| Event | Direction | Payload |
|---|---|---|
| `join_room` | client → server | `{ room }` |
| `send_message` | client → server | `{ room, text }` |
| `typing_start` / `typing_stop` | client → server | `{ room }` |
| `add_reaction` | client → server | `{ messageId, emoji }` |
| `message_history` | server → client | `Message[]` (last 50, ascending) |
| `new_message` | server → client | `Message` with `sender.username` populated |
| `presence` | server → client | `{ online: string[], room }` |
| `typing` | server → client | `{ users: string[] }` |
| `reaction_update` | server → client | `{ messageId, reactions }` |
| `error` | server → client | `{ message }` |

HTTP surface: `POST /api/auth/register`, `POST /api/auth/login`, `GET /health`.

```js
import { io } from 'socket.io-client'

const socket = io('http://localhost:4000', { auth: { token } })
socket.emit('join_room', { room: 'general' })
socket.on('message_history', (msgs) => console.log(msgs.length))
socket.on('new_message', (msg) => console.log(msg.sender.username, msg.text))
socket.emit('send_message', { room: 'general', text: 'hello' })
```

## Tech stack

Node.js 22 · Express 4 · Socket.IO 4 · Mongoose 8 · bcryptjs · jsonwebtoken · React 18 ·
React Router 6 · Vite 5

## Testing

```bash
npm test                          # both workspaces
npm test --workspace=server       # Jest, real sockets against mongodb-memory-server
npm test --workspace=client       # Vitest + Testing Library, jsdom
```

Server tests boot an in-memory MongoDB and a real Socket.IO server on an ephemeral port, then
drive it with `socket.io-client` — auth rejection, history and presence on join, broadcast,
room-name and length validation, reaction toggling, and presence cleanup on disconnect.
GitHub Actions runs both suites on push and pull request.

## License

MIT
