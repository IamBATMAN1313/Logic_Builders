const express = require('express');
const router = express.Router();
const pool = require('../../db/connection');
const authenticateToken = require('../../middlewares/authenticateToken');

// Get user's orders
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get customer_id, create if doesn't exist
    let customerResult = await pool.query(
      'SELECT id FROM customer WHERE user_id = $1',
      [userId]
    );
    
    let customerId;
    if (customerResult.rows.length === 0) {
      // Create customer record if it doesn't exist
      const newCustomerResult = await pool.query(
        'INSERT INTO customer (user_id) VALUES ($1) RETURNING id',
        [userId]
      );
      customerId = newCustomerResult.rows[0].id;
    } else {
      customerId = customerResult.rows[0].id;
    }
    
    // Get orders with order items
    const ordersResult = await pool.query(`
      SELECT 
        o.id,
        o.order_date,
        o.status,
        o.payment_status,
        o.payment_method,
        o.total_price,
        o.delivery_charge,
        o.discount_amount,
        sa.address,
        sa.city,
        sa.zip_code,
        sa.country,
        COUNT(oi.id) as item_count
      FROM "order" o
      LEFT JOIN shipping_address sa ON o.shipping_address_id = sa.id
      LEFT JOIN order_item oi ON o.id = oi.order_id
      WHERE o.customer_id = $1
      GROUP BY o.id, sa.address, sa.city, sa.zip_code, sa.country
      ORDER BY o.created_at DESC
    `, [customerId]);
    
    res.json(ordersResult.rows);
  } catch (err) {
    console.error('Orders fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get order details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Get customer_id
    const customerResult = await pool.query(
      'SELECT id FROM customer WHERE user_id = $1',
      [userId]
    );
    
    if (customerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const customerId = customerResult.rows[0].id;
    
    // Get order details
    const orderResult = await pool.query(`
      SELECT 
        o.*,
        sa.address,
        sa.city,
        sa.zip_code,
        sa.country
      FROM "order" o
      LEFT JOIN shipping_address sa ON o.shipping_address_id = sa.id
      WHERE o.id = $1 AND o.customer_id = $2
    `, [id, customerId]);
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Get order items
    const itemsResult = await pool.query(`
      SELECT 
        oi.*,
        p.name as product_name,
        p.image_url as product_image,
        b.name as build_name
      FROM order_item oi
      LEFT JOIN product p ON oi.product_id = p.id
      LEFT JOIN build b ON oi.build_id = b.id
      WHERE oi.order_id = $1
      ORDER BY oi.created_at
    `, [id]);
    
    res.json({
      ...orderResult.rows[0],
      items: itemsResult.rows
    });
  } catch (err) {
    console.error('Order details fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch order details' });
  }
});

// Create order from cart
router.post('/checkout', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const userId = req.user.id;
    const { 
      payment_method, 
      shipping_address,
      promo_code 
    } = req.body;
    
    if (!payment_method || !shipping_address) {
      return res.status(400).json({ error: 'Payment method and shipping address are required' });
    }
    
    // Get customer_id
    const customerResult = await client.query(
      'SELECT id FROM customer WHERE user_id = $1',
      [userId]
    );
    
    if (customerResult.rows.length === 0) {
      throw new Error('Customer not found');
    }
    
    const customerId = customerResult.rows[0].id;
    
    // Get cart items
    const cartResult = await client.query(
      'SELECT id FROM cart WHERE customer_id = $1',
      [customerId]
    );
    
    if (cartResult.rows.length === 0) {
      throw new Error('Cart not found');
    }
    
    const cartId = cartResult.rows[0].id;
    
    const cartItemsResult = await client.query(`
      SELECT 
        ci.product_id,
        ci.build_id,
        ci.quantity,
        ci.unit_price,
        p.availability as product_availability
      FROM cart_item ci
      LEFT JOIN product p ON ci.product_id = p.id
      WHERE ci.cart_id = $1
    `, [cartId]);
    
    if (cartItemsResult.rows.length === 0) {
      throw new Error('Cart is empty');
    }
    
    // Check product availability
    for (const item of cartItemsResult.rows) {
      if (item.product_id && !item.product_availability) {
        throw new Error(`Product ${item.product_id} is not available`);
      }
    }
    
    // Create or get shipping address
    let shippingAddressId;
    
    const existingAddressResult = await client.query(`
      SELECT id FROM shipping_address 
      WHERE customer_id = $1 AND address = $2 AND city = $3 AND zip_code = $4 AND country = $5
    `, [customerId, shipping_address.address, shipping_address.city, shipping_address.zip_code, shipping_address.country]);
    
    if (existingAddressResult.rows.length > 0) {
      shippingAddressId = existingAddressResult.rows[0].id;
    } else {
      const newAddressResult = await client.query(`
        INSERT INTO shipping_address (customer_id, address, city, zip_code, country)
        VALUES ($1, $2, $3, $4, $5) RETURNING id
      `, [customerId, shipping_address.address, shipping_address.city, shipping_address.zip_code, shipping_address.country]);
      
      shippingAddressId = newAddressResult.rows[0].id;
    }
    
    // Calculate totals
    const subtotal = cartItemsResult.rows.reduce((sum, item) => {
      return sum + (parseFloat(item.unit_price) * item.quantity);
    }, 0);
    
    let discount_amount = 0;
    let promo_id = null;
    
    // Apply promo code if provided
    if (promo_code) {
      const promoResult = await client.query(`
        SELECT id, discount_percent 
        FROM promo 
        WHERE name = $1 AND status = 'active' 
        AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE
      `, [promo_code]);
      
      if (promoResult.rows.length > 0) {
        promo_id = promoResult.rows[0].id;
        discount_amount = subtotal * (promoResult.rows[0].discount_percent / 100);
      }
    }
    
    const delivery_charge = 10.00; // Fixed delivery charge
    const total_price = subtotal - discount_amount + delivery_charge;
    
    // Create order
    const orderResult = await client.query(`
      INSERT INTO "order" (
        customer_id, promo_id, payment_method, status, 
        delivery_charge, discount_amount, total_price, 
        shipping_address_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
    `, [
      customerId, promo_id, payment_method, 'pending',
      delivery_charge, discount_amount, total_price,
      shippingAddressId
    ]);
    
    const orderId = orderResult.rows[0].id;
    
    // Create order items
    for (const item of cartItemsResult.rows) {
      const total_item_price = parseFloat(item.unit_price) * item.quantity;
      
      await client.query(`
        INSERT INTO order_item (order_id, product_id, build_id, quantity, unit_price, total_price)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [orderId, item.product_id, item.build_id, item.quantity, item.unit_price, total_item_price]);
    }
    
    // Clear cart
    await client.query('DELETE FROM cart_item WHERE cart_id = $1', [cartId]);
    
    // Update customer points (1 point per dollar spent)
    const pointsEarned = Math.floor(total_price);
    await client.query(
      'UPDATE customer SET points = points + $1 WHERE id = $2',
      [pointsEarned, customerId]
    );
    
    await client.query('COMMIT');
    
    res.json({
      orderId: orderId,
      total_price: total_price.toFixed(2),
      points_earned: pointsEarned,
      message: 'Order placed successfully'
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Checkout error:', err);
    res.status(500).json({ error: err.message || 'Failed to create order' });
  } finally {
    client.release();
  }
});

// Update order status (for admin or delivery status updates)
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, payment_status } = req.body;
    const userId = req.user.id;
    
    // Get customer_id
    const customerResult = await pool.query(
      'SELECT id FROM customer WHERE user_id = $1',
      [userId]
    );
    
    if (customerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const customerId = customerResult.rows[0].id;
    
    // Update order
    const updateFields = [];
    const values = [];
    let paramCount = 1;
    
    if (status !== undefined) {
      updateFields.push(`status = $${paramCount++}`);
      values.push(status);
    }
    
    if (payment_status !== undefined) {
      updateFields.push(`payment_status = $${paramCount++}`);
      values.push(payment_status);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(id);
    values.push(customerId);
    
    const result = await pool.query(
      `UPDATE "order" SET ${updateFields.join(', ')} WHERE id = $${paramCount++} AND customer_id = $${paramCount++} RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update order status error:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Create order from cart
router.post('/from-cart', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { shipping_address_id } = req.body;
    
    // Get customer_id
    const customerResult = await pool.query(
      'SELECT id FROM customer WHERE user_id = $1',
      [userId]
    );
    
    if (customerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const customerId = customerResult.rows[0].id;
    
    // Validate shipping address if provided
    let shippingAddressId = shipping_address_id;
    if (shipping_address_id) {
      const addressResult = await pool.query(
        'SELECT id FROM shipping_address WHERE id = $1 AND customer_id = $2',
        [shipping_address_id, customerId]
      );
      
      if (addressResult.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid shipping address' });
      }
    } else {
      return res.status(400).json({ error: 'Shipping address is required' });
    }
    
    // Get cart and cart items
    const cartResult = await pool.query(
      'SELECT id FROM cart WHERE customer_id = $1',
      [customerId]
    );
    
    if (cartResult.rows.length === 0) {
      return res.status(400).json({ error: 'No cart found' });
    }
    
    const cartId = cartResult.rows[0].id;
    
    // Get cart items
    const cartItemsResult = await pool.query(`
      SELECT 
        ci.id,
        ci.product_id,
        ci.build_id,
        ci.quantity,
        ci.unit_price,
        p.availability as product_availability,
        pa.stock
      FROM cart_item ci
      LEFT JOIN product p ON ci.product_id = p.id
      LEFT JOIN product_attribute pa ON p.id = pa.product_id
      WHERE ci.cart_id = $1
    `, [cartId]);
    
    if (cartItemsResult.rows.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }
    
    // Validate cart items (check availability and stock)
    for (const item of cartItemsResult.rows) {
      if (item.product_id) {
        if (!item.product_availability) {
          return res.status(400).json({ 
            error: `Product with ID ${item.product_id} is not available` 
          });
        }
        if (item.stock < item.quantity) {
          return res.status(400).json({ 
            error: `Insufficient stock for product ID ${item.product_id}. Available: ${item.stock}, Requested: ${item.quantity}` 
          });
        }
      }
    }
    
    // Calculate total
    const totalPrice = cartItemsResult.rows.reduce((sum, item) => {
      return sum + (parseFloat(item.unit_price) * item.quantity);
    }, 0);

    // Create order
    const orderResult = await pool.query(`
      INSERT INTO "order" (
        customer_id, 
        order_date, 
        status, 
        payment_status, 
        payment_method, 
        total_price, 
        delivery_charge, 
        discount_amount,
        shipping_address_id
      ) VALUES (
        $1, CURRENT_TIMESTAMP, 'pending', false, 'cod', $2, 0, 0, $3
      ) RETURNING *
    `, [customerId, totalPrice, shippingAddressId]);
    
    const order = orderResult.rows[0];
    
    // Create order items from cart items
    for (const cartItem of cartItemsResult.rows) {
      const totalPrice = parseFloat(cartItem.unit_price) * cartItem.quantity;
      await pool.query(`
        INSERT INTO order_item (
          order_id, 
          product_id, 
          build_id, 
          quantity, 
          unit_price,
          total_price
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        order.id,
        cartItem.product_id,
        cartItem.build_id,
        cartItem.quantity,
        cartItem.unit_price,
        totalPrice
      ]);
    }
    
    // Clear the cart
    await pool.query('DELETE FROM cart_item WHERE cart_id = $1', [cartId]);
    
    res.json({
      message: 'Order created successfully',
      order: order,
      total_items: cartItemsResult.rows.length
    });
  } catch (err) {
    console.error('Create order from cart error:', err);
    console.error('Error details:', err.message);
    console.error('Error stack:', err.stack);
    res.status(500).json({ error: 'Failed to create order from cart' });
  }
});

module.exports = router;
