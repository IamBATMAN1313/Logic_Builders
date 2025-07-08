const express = require('express');
const router = express.Router();

// Import feature-specific routers
const authRouter = require('./Authentication/auth');
const productsRouter = require('./Products/products');
const categoriesRouter = require('./Products/categories');

// Mount routes - auth routes at root level to maintain compatibility
router.use('/', authRouter);
router.use('/products', productsRouter);
router.use('/categories', categoriesRouter);

module.exports = router;
