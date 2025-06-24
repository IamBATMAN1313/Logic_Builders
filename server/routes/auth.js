const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const {
  getUserByUsernameOrEmail,
  createUser
} = require('../database_queries/userQueries');

const router = express.Router();
const SALT_ROUNDS = 12;

// Signup: collects every column your schema needs
router.post('/signup', async (req, res) => {
  const {
    username, email, password,
    contact_no, full_name, gender
  } = req.body;

  if (!username || !email || !password || !full_name) {
    console.log('Bad signup payload:', req.body);
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const newUser = await createUser(
      username, email, hash,
      contact_no, full_name, gender
    );
    res.status(201).json({ user: newUser });
  } catch (err) {
    console.error('Signup error:', err.code, err.detail || err.message);
    // Send back Postgres error code/message for debugging
    res.status(500).json({ error: err.detail || err.message });
  }
});




// POST /api/login
router.post('/login', async (req, res) => {
  const { identifier, password } = req.body;  // identifier = username or email
  if (!identifier || !password) {
    return res.status(400).json({ error: 'All fields required' });
  }
  try {
    const user = await getUserByUsernameOrEmail(identifier);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    // Sign a JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );
    res.json({ token });
  } catch (err) {
    console.error('Login error', err);
    res.status(500).json({ error: 'Database error on login' });
  }
});

module.exports = router;
