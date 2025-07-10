const express = require('express');
const router = express.Router();
const pool = require('../../db/connection');
const authenticateToken = require('../../middlewares/authenticateToken');

// Get user's cart
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    // Get customer_id from user_id, create if doesn't exist
    let customerResult, customerId, cartResult, cartId, cartItemsResult, total;
    try {
      customerResult = await pool.query(
        'SELECT id FROM customer WHERE user_id = $1',
        [userId]
      );
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
    } catch (err) {
      console.error('Error fetching/creating customer:', err);
      return res.status(500).json({ error: 'Failed to fetch or create customer', details: err.message });
    }

    try {
      cartResult = await pool.query(
        'SELECT id FROM cart WHERE customer_id = $1',
        [customerId]
      );
      if (cartResult.rows.length === 0) {
        // Create cart if it doesn't exist
        cartResult = await pool.query(
          'INSERT INTO cart (customer_id) VALUES ($1) RETURNING id',
          [customerId]
        );
      }
      cartId = cartResult.rows[0].id;
    } catch (err) {
      console.error('Error fetching/creating cart:', err);
      return res.status(500).json({ error: 'Failed to fetch or create cart', details: err.message });
    }

    try {
      cartItemsResult = await pool.query(`
        SELECT 
          ci.id,
          ci.quantity,
          ci.unit_price,
          ci.product_id,
          ci.build_id,
          p.name as product_name,
          p.image_url as product_image,
          p.availability as product_availability,
          b.name as build_name,
          ci.unit_price as build_total_price
        FROM cart_item ci
        LEFT JOIN product p ON ci.product_id = p.id
        LEFT JOIN build b ON ci.build_id = b.id
        WHERE ci.cart_id = $1
        ORDER BY ci.created_at DESC
      `, [cartId]);
    } catch (err) {
      console.error('Error fetching cart items:', err);
      return res.status(500).json({ error: 'Failed to fetch cart items', details: err.message });
    }

    try {
      total = cartItemsResult.rows.reduce((sum, item) => {
        return sum + (parseFloat(item.unit_price) * item.quantity);
      }, 0);
    } catch (err) {
      console.error('Error calculating cart total:', err);
      return res.status(500).json({ error: 'Failed to calculate cart total', details: err.message });
    }

    res.json({
      items: cartItemsResult.rows,
      total: total.toFixed(2)
    });
  } catch (err) {
    console.error('Cart fetch error (outer):', err);
    res.status(500).json({ error: 'Failed to fetch cart (outer)', details: err.message });
  }
});

// Add item to cart
router.post('/add', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { product_id, build_id, quantity = 1 } = req.body;
    
    if (!product_id && !build_id) {
      return res.status(400).json({ error: 'Either product_id or build_id is required' });
    }
    
    if (product_id && build_id) {
      return res.status(400).json({ error: 'Cannot add both product and build in same item' });
    }
    
    // Get customer_id
    const customerResult = await pool.query(
      'SELECT id FROM customer WHERE user_id = $1',
      [userId]
    );
    
    if (customerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const customerId = customerResult.rows[0].id;
    
    // Get or create cart
    let cartResult = await pool.query(
      'SELECT id FROM cart WHERE customer_id = $1',
      [customerId]
    );
    
    if (cartResult.rows.length === 0) {
      cartResult = await pool.query(
        'INSERT INTO cart (customer_id) VALUES ($1) RETURNING id',
        [customerId]
      );
    }
    
    const cartId = cartResult.rows[0].id;
    
    let unit_price = 0;
    
    if (product_id) {
      // Get product price, availability, and stock
      const productResult = await pool.query(
        `SELECT p.price, p.availability, pa.stock 
         FROM product p
         LEFT JOIN product_attribute pa ON p.id = pa.product_id
         WHERE p.id = $1`,
        [product_id]
      );
      
      if (productResult.rows.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }
      
      const productData = productResult.rows[0];
      
      if (!productData.availability) {
        return res.status(400).json({ error: 'Product is not available' });
      }
      
      if (productData.stock < quantity) {
        return res.status(400).json({ 
          error: 'Insufficient stock', 
          available: productData.stock,
          requested: quantity 
        });
      }
      
      unit_price = productData.price;
      
      // Check if item already exists in cart
      const existingItem = await pool.query(
        'SELECT id, quantity FROM cart_item WHERE cart_id = $1 AND product_id = $2',
        [cartId, product_id]
      );
      
      if (existingItem.rows.length > 0) {
        // Check if total quantity (existing + new) exceeds stock
        const totalQuantity = existingItem.rows[0].quantity + quantity;
        if (totalQuantity > productData.stock) {
          return res.status(400).json({ 
            error: 'Total quantity exceeds available stock', 
            available: productData.stock,
            currentInCart: existingItem.rows[0].quantity,
            trying_to_add: quantity,
            total: totalQuantity
          });
        }
        
        // Update quantity
        await pool.query(
          'UPDATE cart_item SET quantity = $1 WHERE id = $2',
          [totalQuantity, existingItem.rows[0].id]
        );
      } else {
        // Add new item
        await pool.query(
          'INSERT INTO cart_item (cart_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)',
          [cartId, product_id, quantity, unit_price]
        );
      }
    } else if (build_id) {
      // Get build products and calculate total price
      const buildResult = await pool.query(
        'SELECT id FROM build WHERE id = $1 AND customer_id = $2',
        [build_id, customerId]
      );
      
      if (buildResult.rows.length === 0) {
        return res.status(404).json({ error: 'Build not found or access denied' });
      }
      
      // Calculate build total price from its products
      const buildProductsResult = await pool.query(`
        SELECT SUM(bp.quantity * p.price) as total_price
        FROM build_product bp
        JOIN product p ON bp.product_id = p.id
        WHERE bp.build_id = $1
      `, [build_id]);
      
      unit_price = parseFloat(buildProductsResult.rows[0].total_price) || 0;
      
      // Check if build already exists in cart
      const existingItem = await pool.query(
        'SELECT id, quantity FROM cart_item WHERE cart_id = $1 AND build_id = $2',
        [cartId, build_id]
      );
      
      if (existingItem.rows.length > 0) {
        // Update quantity
        const newQuantity = existingItem.rows[0].quantity + quantity;
        await pool.query(
          'UPDATE cart_item SET quantity = $1 WHERE id = $2',
          [newQuantity, existingItem.rows[0].id]
        );
      } else {
        // Add new item
        await pool.query(
          'INSERT INTO cart_item (cart_id, build_id, quantity, unit_price) VALUES ($1, $2, $3, $4)',
          [cartId, build_id, quantity, unit_price]
        );
      }
    }
    
    res.json({ message: 'Item added to cart successfully' });
  } catch (err) {
    console.error('Add to cart error:', err);
    res.status(500).json({ error: 'Failed to add item to cart' });
  }
});

// Update cart item quantity
router.put('/item/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    const userId = req.user.id;
    
    if (quantity < 1) {
      return res.status(400).json({ error: 'Quantity must be at least 1' });
    }
    
    // Verify the cart item belongs to the user
    const result = await pool.query(`
      SELECT ci.id 
      FROM cart_item ci
      JOIN cart c ON ci.cart_id = c.id
      JOIN customer cu ON c.customer_id = cu.id
      WHERE ci.id = $1 AND cu.user_id = $2
    `, [id, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cart item not found' });
    }
    
    await pool.query(
      'UPDATE cart_item SET quantity = $1 WHERE id = $2',
      [quantity, id]
    );
    
    res.json({ message: 'Cart item updated successfully' });
  } catch (err) {
    console.error('Update cart item error:', err);
    res.status(500).json({ error: 'Failed to update cart item' });
  }
});

// Remove item from cart
router.delete('/item/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Verify the cart item belongs to the user
    const result = await pool.query(`
      SELECT ci.id 
      FROM cart_item ci
      JOIN cart c ON ci.cart_id = c.id
      JOIN customer cu ON c.customer_id = cu.id
      WHERE ci.id = $1 AND cu.user_id = $2
    `, [id, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cart item not found' });
    }
    
    await pool.query('DELETE FROM cart_item WHERE id = $1', [id]);
    
    res.json({ message: 'Item removed from cart successfully' });
  } catch (err) {
    console.error('Remove cart item error:', err);
    res.status(500).json({ error: 'Failed to remove cart item' });
  }
});

// Clear cart
router.delete('/clear', authenticateToken, async (req, res) => {
  try {
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
    
    // Clear cart items
    await pool.query(`
      DELETE FROM cart_item 
      WHERE cart_id IN (
        SELECT id FROM cart WHERE customer_id = $1
      )
    `, [customerId]);
    
    res.json({ message: 'Cart cleared successfully' });
  } catch (err) {
    console.error('Clear cart error:', err);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

module.exports = router;
