require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { Pool }= require('pg');

// Importing route modules
const apiRoutes = require('./router/indexRouter');

const app = express();         // create Express app
const pool = new Pool({        // initialize a PostgreSQL connection pool
  user:     process.env.DB_USER,
  host:     process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port:     process.env.DB_PORT,
});

app.use(cors()); 
app.use(express.json());

// Provide the pool to routes via `req.pool`
app.use((req, _, next) => { req.pool = pool; next(); });

// Mount routes
app.use('/api', apiRoutes);

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`🖥️ Server listening on http://127.0.0.1:${PORT}`);
});
