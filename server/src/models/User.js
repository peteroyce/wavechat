'use strict';
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const schema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  lastSeen: { type: Date, default: Date.now },
}, { timestamps: true });

schema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

schema.methods.comparePassword = function(candidate, hash) {
  return bcrypt.compare(candidate, hash);
};

module.exports = mongoose.model('User', schema);
