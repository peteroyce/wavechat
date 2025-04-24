# wavechat

> Minimal, self-hostable real-time chat. WebSocket rooms, presence indicators, typing signals, message history — no Firebase, no vendor lock-in.

## Features

- **WebSocket rooms** — join any named room, messages broadcast in real time
- **Presence** — see who's online in a room, updates instantly on join/leave
- **Typing indicators** — live "Alice is typing..." with debounce
- **Message reactions** — add emoji reactions, toggle on/off
- **Persistent history** — last 50 messages loaded on room join (MongoDB)
- **JWT auth** — stateless, works with the Socket.io auth handshake
- **Self-hostable** — docker-compose up and you're done

## Quick Start

```bash
cp server/.env.example server/.env
# set JWT_SECRET and MONGODB_URI

# With Docker
docker-compose up

# Or manually
cd server && npm install && npm run dev
cd client && npm install && npm run dev
```

## Socket Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `join_room` | client → server | `{ room: string }` |
| `send_message` | client → server | `{ room, text }` |
| `typing_start` | client → server | `{ room }` |
| `typing_stop` | client → server | `{ room }` |
| `add_reaction` | client → server | `{ messageId, emoji }` |
| `new_message` | server → client | Message object |
| `message_history` | server → client | Message[] |
| `presence` | server → client | `{ online: string[], room }` |
| `typing` | server → client | `{ users: string[] }` |
| `reaction_update` | server → client | `{ messageId, reactions }` |

## Tech Stack

Node.js · Express · Socket.io · MongoDB (Mongoose) · React · JWT · Docker
