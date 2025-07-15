const express = require('express');
const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
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

module.exports = router;
