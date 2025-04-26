'use strict';
const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema({
  emoji:   String,
  userIds: [String],
}, { _id: false });

const schema = new mongoose.Schema({
  room:      { type: String, required: true, index: true },
  sender:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text:      { type: String, required: true, maxlength: 2000 },
  reactions: [reactionSchema],
}, { timestamps: true });

schema.index({ room: 1, createdAt: -1 });

module.exports = mongoose.model('Message', schema);
