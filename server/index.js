require('dotenv').config();
const express = require('express');
const cors    = require('cors');

// Importing route modules
const apiRoutes = require('./router/indexRouter');

const app = express();         // create Express app

app.use(cors()); 
app.use(express.json());

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'LogicBuilders API Server is running!', version: '1.0.0' });
});

// Mount routes
app.use('/api', apiRoutes);

const PORT = 54321;
app.listen(PORT, () => {
  console.log(`🖥️ Server listening on http://127.0.0.1:${PORT}`);
});
