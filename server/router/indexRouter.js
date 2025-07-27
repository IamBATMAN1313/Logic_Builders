const express = require('express');
const router = express.Router();
const pool = require('../db/connection');

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Get categories with ratings (sorted by average rating)
router.get('/categories-with-ratings', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        c.id,
        c.name,
        c.description,
        c.image_url,
        c.created_at,
        c.updated_at,
        COALESCE(ROUND(AVG(r.rating::NUMERIC), 1), 0) as average_rating,
        COUNT(r.rating) as total_ratings,
        COUNT(DISTINCT p.id) as product_count
      FROM 
        product_category c
      LEFT JOIN 
        product p ON c.id = p.category_id AND p.availability = true
      LEFT JOIN 
        ratings r ON p.id = r.product_id
      GROUP BY 
        c.id, c.name, c.description, c.image_url, c.created_at, c.updated_at
      ORDER BY 
        average_rating DESC, total_ratings DESC, c.name ASC
    `);
    
    // Convert numeric values to proper types
    const categoriesWithRatings = rows.map(category => ({
      ...category,
      average_rating: parseFloat(category.average_rating) || 0,
      total_ratings: parseInt(category.total_ratings) || 0,
      product_count: parseInt(category.product_count) || 0
    }));
    
    res.json(categoriesWithRatings);
  } catch (err) {
    console.error('Categories with ratings fetch error:', err.message);
    console.error('Error details:', err);
    res.status(500).json({ 
      error: 'Failed to fetch categories with ratings',
      details: err.message 
    });
  }
});

// Import feature-specific routers
const authRouter = require('./Authentication/auth');
const productsRouter = require('./Products/products');
const categoriesRouter = require('./Products/categories');
const accountRouter = require('./Account/account');
const cartRouter = require('./Cart/cart');
const buildsRouter = require('./Builds/builds');
const ordersRouter = require('./Orders/orders');
const userRouter = require('./User/user');
const adminRouter = require('./admin/admin');
const ratingsRouter = require('./Reviews/ratings');
const messagingRouter = require('./messaging/messaging');
const qaRouter = require('./qa/qa');
const notificationsRouter = require('./notifications/notifications');

// Mount routes - auth routes with proper prefix
router.use('/auth', authRouter);
router.use('/products', productsRouter);
router.use('/categories', categoriesRouter);
router.use('/account', accountRouter);
router.use('/cart', cartRouter);
router.use('/builds', buildsRouter);
router.use('/orders', ordersRouter);
router.use('/user', userRouter);
router.use('/admin', adminRouter);
router.use('/ratings', ratingsRouter);
router.use('/messaging', messagingRouter);
router.use('/qa', qaRouter);
router.use('/notifications', notificationsRouter);

module.exports = router;
