const express = require('express');
const router = express.Router();

// Import feature-specific routers
const authRouter = require('./Authentication/auth');
const productsRouter = require('./Products/products');
const categoriesRouter = require('./Products/categories');
const accountRouter = require('./Account/account');
const cartRouter = require('./Cart/cart');
const buildsRouter = require('./Builds/builds');
const ordersRouter = require('./Orders/orders');
const userRouter = require('./User/user');

// Mount routes - auth routes at root level to maintain compatibility
router.use('/', authRouter);
router.use('/products', productsRouter);
router.use('/categories', categoriesRouter);
router.use('/account', accountRouter);
router.use('/cart', cartRouter);
router.use('/builds', buildsRouter);
router.use('/orders', ordersRouter);
router.use('/user', userRouter);

module.exports = router;
