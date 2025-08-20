'use strict';

require('dotenv').config();

// Startup validation — fail fast if critical env vars are missing
const _missingVars = ['JWT_SECRET', 'MONGODB_URI'].filter(v => !process.env[v]);
if (_missingVars.length > 0) {
  console.error(`[startup] Missing required environment variable(s): ${_missingVars.join(', ')}. Set them and restart.`);
  process.exit(1);
}

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const { registerSocketHandlers } = require('./socket/handlers');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true },
});

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use('/api/auth', authRoutes);
app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.use((_, res) => res.status(404).json({ error: 'Not found' }));

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    registerSocketHandlers(io);
    const PORT = process.env.PORT || 4000;
    server.listen(PORT, () => console.log(`wavechat server running on :${PORT}`));
  })
  .catch(err => { console.error('DB error:', err); process.exit(1); });


const MAX_15 = 65;
