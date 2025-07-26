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

// Get featured products sorted by average rating
router.get('/featured', async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 12;
  try {
    const { rows } = await pool.query(
      `SELECT 
        p.id, 
        p.name, 
        p.price,
        p.image_url,
        p.availability,
        COALESCE(pa.stock, 0) as stock,
        COALESCE(ROUND(AVG(r.rating), 1), 0) as average_rating,
        COUNT(r.id) as rating_count
      FROM product p
      LEFT JOIN product_attribute pa ON p.id = pa.product_id
      LEFT JOIN ratings r ON p.id = r.product_id
      WHERE p.availability = true 
        AND (pa.stock IS NULL OR pa.stock > 0)
      GROUP BY p.id, p.name, p.price, p.image_url, p.availability, pa.stock
      ORDER BY 
        CASE 
          WHEN COUNT(r.id) > 0 THEN AVG(r.rating) 
          ELSE 0 
        END DESC,
        COUNT(r.id) DESC,
        p.name
      LIMIT $1`,
      [limit]
    );
    
    // If no products found, try with less strict criteria
    if (rows.length === 0) {
      const fallbackRows = await pool.query(
        `SELECT 
          p.id, 
          p.name, 
          p.price,
          p.image_url,
          p.availability,
          COALESCE(pa.stock, 0) as stock,
          COALESCE(ROUND(AVG(r.rating), 1), 0) as average_rating,
          COUNT(r.id) as rating_count
        FROM product p
        LEFT JOIN product_attribute pa ON p.id = pa.product_id
        LEFT JOIN ratings r ON p.id = r.product_id
        GROUP BY p.id, p.name, p.price, p.image_url, p.availability, pa.stock
        ORDER BY 
          CASE 
            WHEN COUNT(r.id) > 0 THEN AVG(r.rating) 
            ELSE 0 
          END DESC,
          COUNT(r.id) DESC,
          p.name
        LIMIT $1`,
        [limit]
      );
      return res.json(fallbackRows.rows);
    }
    
    res.json(rows);
  } catch (err) {
    console.error('Featured products error:', err);
    res.status(500).json({ error: 'Failed to fetch featured products' });
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
       FROM product p
       LEFT JOIN product_category pc ON p.category_id = pc.id
       WHERE LOWER(p.name) LIKE LOWER($1) 
       OR LOWER(p.specs::text) LIKE LOWER($1)`,
      [searchTerm]
    );

    // Get search results with pagination
    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.excerpt, p.specs, p.price, p.image_url,
              pc.name as category
       FROM product p
       LEFT JOIN product_category pc ON p.category_id = pc.id
       WHERE LOWER(p.name) LIKE LOWER($1) 
       OR LOWER(p.specs::text) LIKE LOWER($1)
       ORDER BY 
         CASE 
           WHEN LOWER(p.name) LIKE LOWER($1) THEN 1 
           ELSE 2 
         END,
         p.name
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
      `SELECT 
        p.id, 
        p.name, 
        p.excerpt, 
        p.specs, 
        p.price, 
        p.discount_status, 
        p.discount_percent, 
        p.availability,
        p.image_url,
        p.category_id,
        pc.name as category_name,
        pa.stock,
        pa.units_sold,
        pa.cost
       FROM product p
       LEFT JOIN product_category pc ON p.category_id = pc.id
       LEFT JOIN product_attribute pa ON p.id = pa.product_id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    
    const product = rows[0];
    // Override availability based on stock
    product.availability = product.availability && (product.stock > 0);
    
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// Get products by category
router.get('/', async (req, res) => {
  const { category, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let query = `
      SELECT 
        p.id, 
        p.name, 
        p.excerpt, 
        p.specs, 
        p.price, 
        p.discount_status, 
        p.discount_percent, 
        p.availability,
        p.image_url,
        p.category_id,
        pc.name as category_name,
        pa.stock,
        pa.units_sold
      FROM product p
      LEFT JOIN product_category pc ON p.category_id = pc.id
      LEFT JOIN product_attribute pa ON p.id = pa.product_id
      WHERE p.availability = true AND pa.stock > 0
    `;
    
    const params = [];
    let paramCount = 1;

    if (category) {
      query += ` AND pc.name = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    query += ` ORDER BY p.name LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), offset);

    const { rows } = await pool.query(query, params);
    
    // Override availability based on stock for each product
    rows.forEach(product => {
      product.availability = product.availability && (product.stock > 0);
    });
    
    res.json(rows);
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

module.exports = router;


