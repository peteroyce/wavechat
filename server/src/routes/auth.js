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
