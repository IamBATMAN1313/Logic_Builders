const express = require('express');
const router = express.Router();
const pool = require('../../db/connection'); // Add this missing import

router.get('/random', async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  try {
    const { rows } = await pool.query(
      `SELECT id, name FROM product ORDER BY RANDOM() LIMIT $1`,
      [limit]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, excerpt, specs FROM product WHERE id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

module.exports = router;


