'use strict';

const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const sign = (user) => jwt.sign(
  { id: user._id, username: user.username },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || typeof username !== 'string' || username.trim().length < 2 || username.trim().length > 30)
    return res.status(400).json({ error: 'Username must be between 2 and 30 characters' });
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    return res.status(400).json({ error: 'Valid email is required' });
  if (!password || typeof password !== 'string' || password.length < 8 || password.length > 128)
    return res.status(400).json({ error: 'Password must be between 8 and 128 characters' });
  try {
    if (await User.findOne({ $or: [{ email }, { username }] }))
      return res.status(409).json({ error: 'Username or email already taken' });
    const user = await User.create({ username, email, password });
    res.status(201).json({ token: sign(user), user: { id: user._id, username, email } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Valid email is required' });
  if (!password || typeof password !== 'string')
    return res.status(400).json({ error: 'Password is required' });
  try {
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password, user.password)))
      return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ token: sign(user), user: { id: user._id, username: user.username, email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
