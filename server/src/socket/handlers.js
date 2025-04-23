'use strict';

const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const User = require('../models/User');

// room → Set of socket IDs
const rooms = new Map();
// socketId → { userId, username, room }
const socketMeta = new Map();
// room → Set of userIds currently typing
const typingUsers = new Map();

function registerSocketHandlers(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[+] ${socket.user.username} connected (${socket.id})`);

    socket.on('join_room', async ({ room }) => {
      if (!room) return;
      socket.join(room);

      if (!rooms.has(room)) rooms.set(room, new Set());
      rooms.get(room).add(socket.id);
      socketMeta.set(socket.id, { userId: socket.user.id, username: socket.user.username, room });

      // Update last seen
      await User.findByIdAndUpdate(socket.user.id, { lastSeen: new Date() });

      // Send message history (last 50)
      const history = await Message.find({ room })
        .sort({ createdAt: -1 }).limit(50).populate('sender', 'username avatar').lean();
      socket.emit('message_history', history.reverse());

      // Broadcast presence
      const online = [...(rooms.get(room) || [])].map(sid => socketMeta.get(sid)?.username).filter(Boolean);
      io.to(room).emit('presence', { online, room });
    });

    socket.on('send_message', async ({ room, text }) => {
      if (!text?.trim() || !room) return;
      const msg = await Message.create({ room, sender: socket.user.id, text: text.trim() });
      const populated = await msg.populate('sender', 'username avatar');
      io.to(room).emit('new_message', populated);
    });

    socket.on('typing_start', ({ room }) => {
      if (!typingUsers.has(room)) typingUsers.set(room, new Set());
      typingUsers.get(room).add(socket.user.username);
      socket.to(room).emit('typing', { users: [...typingUsers.get(room)] });
    });

    socket.on('typing_stop', ({ room }) => {
      typingUsers.get(room)?.delete(socket.user.username);
      socket.to(room).emit('typing', { users: [...(typingUsers.get(room) || [])] });
    });

    socket.on('add_reaction', async ({ messageId, emoji }) => {
      const msg = await Message.findById(messageId);
      if (!msg) return;
      const existing = msg.reactions.find(r => r.emoji === emoji);
      if (existing) {
        const idx = existing.userIds.indexOf(socket.user.id);
        if (idx === -1) existing.userIds.push(socket.user.id);
        else existing.userIds.splice(idx, 1);
        if (existing.userIds.length === 0) msg.reactions = msg.reactions.filter(r => r.emoji !== emoji);
      } else {
        msg.reactions.push({ emoji, userIds: [socket.user.id] });
      }
      await msg.save();
      io.to(msg.room).emit('reaction_update', { messageId, reactions: msg.reactions });
    });

    socket.on('disconnect', async () => {
      const meta = socketMeta.get(socket.id);
      if (meta) {
        rooms.get(meta.room)?.delete(socket.id);
        typingUsers.get(meta.room)?.delete(meta.username);
        const online = [...(rooms.get(meta.room) || [])].map(sid => socketMeta.get(sid)?.username).filter(Boolean);
        io.to(meta.room).emit('presence', { online, room: meta.room });
        socketMeta.delete(socket.id);
        await User.findByIdAndUpdate(meta.userId, { lastSeen: new Date() });
      }
      console.log(`[-] ${socket.user?.username} disconnected`);
    });
  });
}

module.exports = { registerSocketHandlers };
# typing_start/stop events with per-room tracking
# emoji reactions toggled by userId
# reconnection: client should re-join room after socket reconnect
