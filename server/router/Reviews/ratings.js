const express = require('express');
const router = express.Router();
const pool = require('../../db/connection');
const authenticateToken = require('../../middlewares/authenticateToken');

// Get user's ratable products (delivered but not yet rated)
router.get('/ratable-products', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // First get the customer_id for this user
    const customerResult = await pool.query('SELECT id FROM customer WHERE user_id = $1', [userId]);
    
    if (customerResult.rows.length === 0) {
      return res.json([]); // No customer record means no orders
    }
    
    const customerId = customerResult.rows[0].id;
    
    const result = await pool.query(`
      SELECT DISTINCT
        oi.product_id,
        p.name as product_name,
        p.image_url,
        p.price,
        oi.id as order_item_id,
        o.id as order_id,
        o.order_date,
        oi.quantity,
        oi.unit_price
      FROM "order" o
      JOIN order_item oi ON o.id = oi.order_id
      JOIN product p ON oi.product_id = p.id
      WHERE o.customer_id = $1
        AND o.status = 'delivered'
        AND oi.product_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM ratings r 
          WHERE r.user_id = $2 
            AND r.product_id = oi.product_id 
            AND r.order_item_id = oi.id
        )
      ORDER BY o.order_date DESC
    `, [customerId, userId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching ratable products:', error);
    res.status(500).json({ message: 'Failed to fetch ratable products' });
  }
});

// Get user's existing ratings
router.get('/my-ratings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await pool.query(`
      SELECT 
        r.id,
        r.product_id,
        p.name as product_name,
        p.image_url,
        r.rating,
        r.review_text,
        r.created_at,
        r.updated_at,
        o.order_date,
        o.status as order_status
      FROM ratings r
      JOIN product p ON r.product_id = p.id
      JOIN "order" o ON r.order_id = o.id
      JOIN customer c ON o.customer_id = c.id
      WHERE r.user_id = $1
        AND o.status = 'delivered'
        AND c.user_id = $1
      ORDER BY r.created_at DESC
    `, [userId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user ratings:', error);
    res.status(500).json({ message: 'Failed to fetch your ratings' });
  }
});

// Submit a new rating
router.post('/submit', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { product_id, order_item_id, order_id, rating, review_text } = req.body;
    
    // Validate input
    if (!product_id || !order_item_id || !order_id || rating === undefined) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    if (rating < 0 || rating > 10 || !Number.isInteger(rating)) {
      return res.status(400).json({ message: 'Rating must be an integer between 0 and 10' });
    }
    
    // Check if user has already rated this product from this order
    const existingRating = await pool.query(`
      SELECT id FROM ratings 
      WHERE user_id = $1 AND product_id = $2 AND order_item_id = $3
    `, [userId, product_id, order_item_id]);
    
    if (existingRating.rows.length > 0) {
      return res.status(400).json({ message: 'You have already rated this product from this order' });
    }
    
    // Verify that the user can rate this product (order is delivered and belongs to user)
    const orderVerification = await pool.query(`
      SELECT o.id, c.user_id
      FROM "order" o
      JOIN order_item oi ON o.id = oi.order_id
      JOIN customer c ON o.customer_id = c.id
      WHERE o.id = $1 
        AND oi.id = $2
        AND c.user_id = $3
        AND oi.product_id = $4
        AND o.status = 'delivered'
    `, [order_id, order_item_id, userId, product_id]);
    
    if (orderVerification.rows.length === 0) {
      return res.status(403).json({ 
        message: 'You can only rate products from your delivered orders' 
      });
    }
    
    // Insert the rating
    const result = await pool.query(`
      INSERT INTO ratings (user_id, product_id, order_id, order_item_id, rating, review_text)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, rating, review_text, created_at
    `, [userId, product_id, order_id, order_item_id, rating, review_text || null]);
    
    res.status(201).json({
      message: 'Rating submitted successfully',
      rating: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error submitting rating:', error);
    if (error.message.includes('Can only rate products from delivered orders')) {
      res.status(403).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Failed to submit rating' });
    }
  }
});

// Update an existing rating
router.put('/:rating_id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const ratingId = req.params.rating_id;
    const { rating, review_text } = req.body;
    
    // Validate input
    if (rating !== undefined && (rating < 0 || rating > 10 || !Number.isInteger(rating))) {
      return res.status(400).json({ message: 'Rating must be an integer between 0 and 10' });
    }
    
    // Check if rating exists and belongs to user
    const existingRating = await pool.query(`
      SELECT id FROM ratings WHERE id = $1 AND user_id = $2
    `, [ratingId, userId]);
    
    if (existingRating.rows.length === 0) {
      return res.status(404).json({ message: 'Rating not found or not authorized' });
    }
    
    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (rating !== undefined) {
      updates.push(`rating = $${paramIndex}`);
      values.push(rating);
      paramIndex++;
    }
    
    if (review_text !== undefined) {
      updates.push(`review_text = $${paramIndex}`);
      values.push(review_text);
      paramIndex++;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }
    
    values.push(ratingId, userId);
    
    const result = await pool.query(`
      UPDATE ratings 
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
      RETURNING id, rating, review_text, updated_at
    `, values);
    
    res.json({
      message: 'Rating updated successfully',
      rating: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error updating rating:', error);
    res.status(500).json({ message: 'Failed to update rating' });
  }
});

// Delete a rating
router.delete('/:rating_id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const ratingId = req.params.rating_id;
    
    const result = await pool.query(`
      DELETE FROM ratings 
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `, [ratingId, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Rating not found or not authorized' });
    }
    
    res.json({ message: 'Rating deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting rating:', error);
    res.status(500).json({ message: 'Failed to delete rating' });
  }
});

// Get product ratings (public endpoint)
router.get('/product/:product_id', async (req, res) => {
  try {
    const productId = req.params.product_id;
    
    const result = await pool.query(`
      SELECT 
        r.id,
        r.rating,
        r.review_text,
        r.created_at,
        gu.username,
        gu.full_name,
        COALESCE(ROUND(AVG(r.rating) OVER(), 1), 0) as average_rating,
        COUNT(r.id) OVER() as total_ratings
      FROM ratings r
      JOIN general_user gu ON r.user_id = gu.id
      WHERE r.product_id = $1
      ORDER BY r.created_at DESC
    `, [productId]);
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('Error fetching product ratings:', error);
    res.status(500).json({ message: 'Failed to fetch product ratings' });
  }
});

module.exports = router;
