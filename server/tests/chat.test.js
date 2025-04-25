'use strict';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const { io: Client } = require('socket.io-client');
const jwt = require('jsonwebtoken');

const { registerSocketHandlers, resetRateLimiter } = require('../src/socket/handlers');
const User = require('../src/models/User');
const Message = require('../src/models/Message');

const JWT_SECRET = 'test-secret-at-least-32-chars-long!!';

let mongod;
let httpServer;
let io;
let serverUrl;

// Helper: create a test user and return a signed JWT
async function createUser(username) {
  const user = await User.create({
    username,
    email: `${username}@test.com`,
    password: 'Password123!',
  });
  return {
    user,
    token: jwt.sign({ id: user._id.toString(), username }, JWT_SECRET),
  };
}

// Helper: connect a socket client with a token
function connectClient(token) {
  return new Promise((resolve, reject) => {
    const client = Client(serverUrl, {
      autoConnect: false,
      auth: { token },
    });
    client.on('connect', () => resolve(client));
    client.on('connect_error', reject);
    client.connect();
  });
}

beforeAll(async () => {
  process.env.JWT_SECRET = JWT_SECRET;

  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  httpServer = http.createServer();
  io = new Server(httpServer);
  registerSocketHandlers(io);

  await new Promise(resolve => httpServer.listen(0, resolve));
  const { port } = httpServer.address();
  serverUrl = `http://localhost:${port}`;
});

afterAll(async () => {
  io.close();
  httpServer.close();
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Message.deleteMany({});
  resetRateLimiter();
});

// ── Test: Auth rejection ────────────────────────────────────────────────────

describe('Auth rejection', () => {
  it('rejects connection with no token', (done) => {
    const client = Client(serverUrl, {
      autoConnect: false,
      auth: { token: null },
    });
    client.on('connect_error', (err) => {
      expect(err.message).toMatch(/authentication required/i);
      client.close();
      done();
    });
    client.connect();
  });

  it('rejects connection with invalid token', (done) => {
    const client = Client(serverUrl, {
      autoConnect: false,
      auth: { token: 'bad.token.value' },
    });
    client.on('connect_error', (err) => {
      expect(err.message).toMatch(/invalid token/i);
      client.close();
      done();
    });
    client.connect();
  });
});

// ── Test: Room join + message broadcast ────────────────────────────────────

describe('Room join and message broadcast', () => {
  it('receives message_history and presence on join_room', (done) => {
    createUser('alice').then(async ({ token, user }) => {
      // Pre-seed a message
      await Message.create({ room: 'general', sender: user._id, text: 'Hello from history' });

      const client = await connectClient(token);
      let historyReceived = false;
      let presenceReceived = false;

      client.on('message_history', (history) => {
        expect(Array.isArray(history)).toBe(true);
        expect(history.length).toBe(1);
        expect(history[0].text).toBe('Hello from history');
        historyReceived = true;
        if (historyReceived && presenceReceived) { client.close(); done(); }
      });

      client.on('presence', ({ online, room }) => {
        expect(room).toBe('general');
        expect(online).toContain('alice');
        presenceReceived = true;
        if (historyReceived && presenceReceived) { client.close(); done(); }
      });

      client.emit('join_room', { room: 'general' });
    }).catch(done);
  });

  it('broadcasts new_message to all clients in room', (done) => {
    Promise.all([createUser('alice'), createUser('bob')]).then(async ([a, b]) => {
      const clientA = await connectClient(a.token);
      const clientB = await connectClient(b.token);

      await new Promise(res => { clientA.emit('join_room', { room: 'general' }); clientA.once('presence', res); });
      await new Promise(res => { clientB.emit('join_room', { room: 'general' }); clientB.once('presence', res); });

      clientA.on('new_message', (msg) => {
        expect(msg.text).toBe('Hey Bob!');
        clientA.close();
        clientB.close();
        done();
      });

      clientB.emit('send_message', { room: 'general', text: 'Hey Bob!' });
    }).catch(done);
  });

  it('rejects invalid room name', (done) => {
    createUser('alice').then(async ({ token }) => {
      const client = await connectClient(token);
      client.on('error', ({ message }) => {
        expect(message).toMatch(/alphanumeric/i);
        client.close();
        done();
      });
      client.emit('join_room', { room: 'bad room name!' });
    }).catch(done);
  });

  it('rejects message exceeding 2000 chars', (done) => {
    createUser('alice').then(async ({ token }) => {
      const client = await connectClient(token);
      client.on('error', ({ message }) => {
        expect(message).toMatch(/maximum length/i);
        client.close();
        done();
      });
      await new Promise(res => { client.emit('join_room', { room: 'general' }); client.once('presence', res); });
      client.emit('send_message', { room: 'general', text: 'x'.repeat(2001) });
    }).catch(done);
  });
});

// ── Test: Reaction toggle (no duplicate reactions) ──────────────────────────

describe('Reaction toggle', () => {
  it('adds a reaction and does not create duplicates', (done) => {
    createUser('alice').then(async ({ token, user }) => {
      const msg = await Message.create({ room: 'general', sender: user._id, text: 'React to this' });
      const client = await connectClient(token);

      client.on('reaction_update', async ({ messageId, reactions }) => {
        expect(messageId).toBe(msg._id.toString());
        const thumbs = reactions.find(r => r.emoji === '👍');
        expect(thumbs).toBeDefined();
        // No duplicate userIds
        const uniqueIds = new Set(thumbs.userIds.map(String));
        expect(uniqueIds.size).toBe(thumbs.userIds.length);
        client.close();
        done();
      });

      await new Promise(res => { client.emit('join_room', { room: 'general' }); client.once('presence', res); });
      client.emit('add_reaction', { messageId: msg._id.toString(), emoji: '👍' });
    }).catch(done);
  });

  it('toggles reaction off when the same user reacts twice', (done) => {
    createUser('alice').then(async ({ token, user }) => {
      const msg = await Message.create({ room: 'general', sender: user._id, text: 'React to this' });
      const client = await connectClient(token);

      let callCount = 0;
      client.on('reaction_update', async ({ reactions }) => {
        callCount++;
        if (callCount === 1) {
          // First reaction added
          const thumbs = reactions.find(r => r.emoji === '👍');
          expect(thumbs.userIds.length).toBe(1);
          // React again to toggle off
          client.emit('add_reaction', { messageId: msg._id.toString(), emoji: '👍' });
        } else if (callCount === 2) {
          // Reaction should be removed
          const thumbs = reactions.find(r => r.emoji === '👍');
          expect(thumbs).toBeUndefined();
          client.close();
          done();
        }
      });

      await new Promise(res => { client.emit('join_room', { room: 'general' }); client.once('presence', res); });
      client.emit('add_reaction', { messageId: msg._id.toString(), emoji: '👍' });
    }).catch(done);
  });
});

// ── Test: Disconnect removes from presence ──────────────────────────────────

describe('Disconnect', () => {
  it('removes user from presence list on disconnect', (done) => {
    Promise.all([createUser('alice'), createUser('bob')]).then(async ([a, b]) => {
      const clientA = await connectClient(a.token);
      const clientB = await connectClient(b.token);

      await new Promise(res => { clientA.emit('join_room', { room: 'general' }); clientA.once('presence', res); });
      await new Promise(res => { clientB.emit('join_room', { room: 'general' }); clientB.once('presence', res); });

      clientA.on('presence', ({ online }) => {
        if (!online.includes('bob')) {
          expect(online).not.toContain('bob');
          clientA.close();
          done();
        }
      });

      clientB.close();
    }).catch(done);
  });
});
