require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  user:     process.env.DB_USER,
  host:     process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port:     process.env.DB_PORT,
});

app.get('/api/hello', async (req, res) => {
  console.log('→ /api/hello hit');
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('→ query returned', result.rows[0]);
    res.json({ now: result.rows[0].now });
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Simple ping route
app.get('/ping', (req, res) => res.send('pong'));

const PORT = process.env.PORT || 54321;
const HOST = '127.0.0.1';    // change to '0.0.0.0' if you need external access

const server = app.listen(PORT, HOST, () => {
  const addr = server.address();
  console.log(`🖥️ Server listening on http://${addr.address}:${addr.port}`);
  console.log('process.env.PORT =', process.env.PORT);
});
