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

// Search products by name and specs
router.get('/search', async (req, res) => {
  const { q: query, page = 1, limit = 10 } = req.query;

  if (!query || query.trim() === '') {
    return res.status(400).json({ error: 'Search query is required' });
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const searchTerm = `%${query.trim()}%`;

  try {
    // Get total count for pagination
    const countResult = await pool.query(
      `SELECT COUNT(*) as total 
       FROM product 
       WHERE LOWER(name) LIKE LOWER($1) 
       OR LOWER(specs::text) LIKE LOWER($1)`,
      [searchTerm]
    );

    // Get search results with pagination
    const { rows } = await pool.query(
      `SELECT id, name, excerpt, specs 
       FROM product 
       WHERE LOWER(name) LIKE LOWER($1) 
       OR LOWER(specs::text) LIKE LOWER($1)
       ORDER BY 
         CASE 
           WHEN LOWER(name) LIKE LOWER($1) THEN 1 
           ELSE 2 
         END,
         name
       LIMIT $2 OFFSET $3`,
      [searchTerm, parseInt(limit), offset]
    );

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      products: rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
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


