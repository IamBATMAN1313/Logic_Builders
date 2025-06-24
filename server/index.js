// server/index.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { Pool }= require('pg');

// Import your route modules (they don’t call `app.use` themselves)
const authRoutes    = require('./routes/auth');
const productRoutes = require('./routes/products');

const app = express();         // ← app must be created before you use it
const pool = new Pool({        // you can also centralize this in db/connection.js
  user:     process.env.DB_USER,
  host:     process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port:     process.env.DB_PORT,
});

app.use(cors());
app.use(express.json());

// Provide the pool to routes via `req.pool` (optional) or import directly in each
app.use((req, _, next) => { req.pool = pool; next(); });

// Mount your routes
app.use('/api', authRoutes);
app.use('/api/products', productRoutes);

// Example protected route placeholder
// const authenticateToken = require('./middleware/authenticateToken');
// app.get('/api/profile', authenticateToken, (req, res) => { /* ... */ });

const PORT = process.env.PORT || 54321;
app.listen(PORT, () => {
  console.log(`🖥️ Server listening on http://127.0.0.1:${PORT}`);
});
