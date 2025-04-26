'use strict';

const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const User = require('../models/User');

// room -> Set of socket IDs
const rooms = new Map();
// socketId -> { userId, username, room }
const socketMeta = new Map();
// room -> Set of usernames currently typing
const typingUsers = new Map();

// Rate limiting: ip -> { count, resetAt }
const ipConnections = new Map();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

const ROOM_NAME_RE = /^[a-zA-Z0-9-]{1,50}$/;
const MAX_MESSAGE_LENGTH = 2000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = ipConnections.get(ip);
  if (!entry || now >= entry.resetAt) {
    ipConnections.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

function registerSocketHandlers(io) {
  // Auth middleware
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

  // Rate-limit middleware
  io.use((socket, next) => {
    const ip = socket.handshake.address;
    if (!checkRateLimit(ip)) {
      return next(new Error('Too many connections from this IP'));
    }
    next();
  });

  io.on('connection', (socket) => {
    console.log(`[+] ${socket.user.username} connected (${socket.id})`);

    socket.on('join_room', async ({ room }) => {
      try {
        if (!room) {
          socket.emit('error', { message: 'Room name is required' });
          return;
        }
        if (!ROOM_NAME_RE.test(room)) {
          socket.emit('error', { message: 'Room name must be alphanumeric and dashes only, max 50 chars' });
          return;
        }

        socket.join(room);

        if (!rooms.has(room)) rooms.set(room, new Set());
        rooms.get(room).add(socket.id);
        socketMeta.set(socket.id, { userId: socket.user.id, username: socket.user.username, room });

        // Update last seen
        await User.findByIdAndUpdate(socket.user.id, { lastSeen: new Date() });

        // Send message history (last 50, ascending order)
        const history = await Message.find({ room })
          .sort({ createdAt: 1 }).limit(50).populate('sender', 'username').lean();
        socket.emit('message_history', history);

        // Broadcast presence
        const online = [...(rooms.get(room) || [])].map(sid => socketMeta.get(sid)?.username).filter(Boolean);
        io.to(room).emit('presence', { online, room });
      } catch (err) {
        console.error('join_room error:', err);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    socket.on('send_message', async ({ room, text }) => {
      try {
        if (!room) {
          socket.emit('error', { message: 'Room is required' });
          return;
        }
        if (!text?.trim()) {
          socket.emit('error', { message: 'Message text is required' });
          return;
        }
        if (text.trim().length > MAX_MESSAGE_LENGTH) {
          socket.emit('error', { message: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` });
          return;
        }

        const msg = await Message.create({ room, sender: socket.user.id, text: text.trim() });
        const populated = await msg.populate('sender', 'username');
        io.to(room).emit('new_message', populated);
      } catch (err) {
        console.error('send_message error:', err);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('typing_start', ({ room }) => {
      try {
        if (!room) return;
        if (!typingUsers.has(room)) typingUsers.set(room, new Set());
        typingUsers.get(room).add(socket.user.username);
        socket.to(room).emit('typing', { users: [...typingUsers.get(room)] });
      } catch (err) {
        console.error('typing_start error:', err);
      }
    });

    socket.on('typing_stop', ({ room }) => {
      try {
        if (!room) return;
        typingUsers.get(room)?.delete(socket.user.username);
        socket.to(room).emit('typing', { users: [...(typingUsers.get(room) || [])] });
      } catch (err) {
        console.error('typing_stop error:', err);
      }
    });

    socket.on('add_reaction', async ({ messageId, emoji }) => {
      try {
        if (!messageId || !emoji) {
          socket.emit('error', { message: 'messageId and emoji are required' });
          return;
        }

        // Check whether the user has already reacted with this emoji
        const existing = await Message.findOne({ _id: messageId, 'reactions.emoji': emoji });

        let updatedMsg;
        if (existing) {
          const reaction = existing.reactions.find(r => r.emoji === emoji);
          const alreadyReacted = reaction && reaction.userIds.includes(socket.user.id);
          if (alreadyReacted) {
            // Remove the user from the reaction
            await Message.findOneAndUpdate(
              { _id: messageId, 'reactions.emoji': emoji },
              { $pull: { 'reactions.$.userIds': socket.user.id } },
              { new: true }
            );
            // Remove empty reaction groups in application code ($size is not
            // supported inside a $pull filter in MongoDB)
            const afterPull = await Message.findById(messageId);
            afterPull.reactions = afterPull.reactions.filter(r => r.userIds.length > 0);
            updatedMsg = await afterPull.save();
          } else {
            // Add user to existing reaction
            updatedMsg = await Message.findOneAndUpdate(
              { _id: messageId, 'reactions.emoji': emoji },
              { $addToSet: { 'reactions.$.userIds': socket.user.id } },
              { new: true }
            );
          }
        } else {
          // Add a new reaction group
          updatedMsg = await Message.findByIdAndUpdate(
            messageId,
            { $push: { reactions: { emoji, userIds: [socket.user.id] } } },
            { new: true }
          );
        }

        if (!updatedMsg) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        io.to(updatedMsg.room).emit('reaction_update', { messageId, reactions: updatedMsg.reactions });
      } catch (err) {
        console.error('add_reaction error:', err);
        socket.emit('error', { message: 'Failed to update reaction' });
      }
    });

    socket.on('disconnect', async () => {
      try {
        const meta = socketMeta.get(socket.id);
        if (meta) {
          rooms.get(meta.room)?.delete(socket.id);

          // Remove from typing and emit updated typing state to room
          if (typingUsers.get(meta.room)?.has(meta.username)) {
            typingUsers.get(meta.room).delete(meta.username);
            io.to(meta.room).emit('typing', { users: [...(typingUsers.get(meta.room) || [])] });
          }

          const online = [...(rooms.get(meta.room) || [])].map(sid => socketMeta.get(sid)?.username).filter(Boolean);
          io.to(meta.room).emit('presence', { online, room: meta.room });
          socketMeta.delete(socket.id);
          await User.findByIdAndUpdate(meta.userId, { lastSeen: new Date() });
        }
      } catch (err) {
        console.error('disconnect error:', err);
      }
      console.log(`[-] ${socket.user?.username} disconnected`);
    });
  });
}

function resetRateLimiter() {
  ipConnections.clear();
}

module.exports = { registerSocketHandlers, resetRateLimiter };
// typing_start/stop events with per-room tracking
// emoji reactions toggled by userId
// reconnection: client should re-join room after socket reconnect
