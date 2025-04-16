'use strict';

require('dotenv').config();
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

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wavechat')
  .then(() => {
    console.log('MongoDB connected');
    registerSocketHandlers(io);
    const PORT = process.env.PORT || 4000;
    server.listen(PORT, () => console.log(`wavechat server running on :${PORT}`));
  })
  .catch(err => { console.error('DB error:', err); process.exit(1); });
