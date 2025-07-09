const express = require('express');
const router = express.Router();
const pool = require('../../db/connection');




// Get user reviews
router.get('/reviews', async (req, res) => {
  try {
    // For now, return empty array
    res.json([]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Get user vouchers
router.get('/vouchers', async (req, res) => {
  try {
    // For now, return empty vouchers and points
    res.json({ vouchers: [], points: 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch vouchers' });
  }
});

module.exports = router;
