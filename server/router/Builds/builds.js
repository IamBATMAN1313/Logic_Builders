const express = require('express');
const router = express.Router();
const pool = require('../../db/connection');
const authenticateToken = require('../../middlewares/authenticateToken');

// Get user's builds
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
    
    // Get builds with product count and total price
    const buildsResult = await pool.query(`
      SELECT 
        b.id,
        b.name,
        b.image_url,
        COALESCE(SUM(bp.quantity * p.price), 0) as total_price,
        'active' as status,
        b.created_at,
        COUNT(bp.id) as product_count
      FROM build b
      LEFT JOIN build_product bp ON b.id = bp.build_id
      LEFT JOIN product p ON bp.product_id = p.id
      WHERE b.customer_id = $1
      GROUP BY b.id, b.name, b.image_url, b.created_at
      ORDER BY b.created_at DESC
    `, [customerId]);
    
    res.json(buildsResult.rows);
  } catch (err) {
    console.error('Builds fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch builds' });
  }
});

// Create new build
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Build name is required' });
    }
    
    // Get or create customer_id
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
    
    // Create build with name and default image
    const defaultBuildImage = '/Users/muttakin/LogicBuilders/client/public/pcbuild.jpg';
    const buildResult = await pool.query(
      'INSERT INTO build (customer_id, name, image_url) VALUES ($1, $2, $3) RETURNING *',
      [customerId, name.trim(), defaultBuildImage]
    );
    
    res.json(buildResult.rows[0]);
  } catch (err) {
    console.error('Create build error:', err);
    res.status(500).json({ error: 'Failed to create build' });
  }
});

// Get build details with products
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
    
    // Get build details
    const buildResult = await pool.query(
      'SELECT * FROM build WHERE id = $1 AND customer_id = $2',
      [id, customerId]
    );
    
    if (buildResult.rows.length === 0) {
      return res.status(404).json({ error: 'Build not found' });
    }
    
    // Get build products with full details
    const productsResult = await pool.query(`
      SELECT 
        bp.id,
        bp.quantity,
        p.id as product_id,
        p.name,
        p.price,
        p.image_url,
        p.specs,
        pc.id as category_id,
        pc.name as category_name
      FROM build_product bp
      JOIN product p ON bp.product_id = p.id
      JOIN product_category pc ON p.category_id = pc.id
      WHERE bp.build_id = $1
      ORDER BY pc.name, p.name
    `, [id]);

    // Calculate total price
    const totalPrice = productsResult.rows.reduce((sum, product) => {
      return sum + (parseFloat(product.price) * product.quantity);
    }, 0);
    
    res.json({
      ...buildResult.rows[0],
      products: productsResult.rows,
      total_price: totalPrice.toFixed(2)
    });
  } catch (err) {
    console.error('Build details fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch build details' });
  }
});

// Update build name
router.put('/:id/name', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const userId = req.user.id;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Build name is required' });
    }
    
    // Verify build belongs to user
    const customerResult = await pool.query(
      'SELECT id FROM customer WHERE user_id = $1',
      [userId]
    );
    
    if (customerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const customerId = customerResult.rows[0].id;
    
    const buildResult = await pool.query(
      'UPDATE build SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND customer_id = $3 RETURNING *',
      [name.trim(), id, customerId]
    );
    
    if (buildResult.rows.length === 0) {
      return res.status(404).json({ error: 'Build not found or access denied' });
    }
    
    res.json(buildResult.rows[0]);
  } catch (err) {
    console.error('Update build name error:', err);
    res.status(500).json({ error: 'Failed to update build name' });
  }
});

// Add product to build
router.post('/:id/add-product', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { product_id, quantity = 1 } = req.body;
    const userId = req.user.id;
    
    if (!product_id) {
      return res.status(400).json({ error: 'product_id is required' });
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
    
    // Verify build belongs to user
    const buildResult = await pool.query(
      'SELECT id FROM build WHERE id = $1 AND customer_id = $2',
      [id, customerId]
    );
    
    if (buildResult.rows.length === 0) {
      return res.status(404).json({ error: 'Build not found or access denied' });
    }
    
    // Verify product exists and is available
    const productResult = await pool.query(
      'SELECT id, availability FROM product WHERE id = $1',
      [product_id]
    );
    
    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    if (!productResult.rows[0].availability) {
      return res.status(400).json({ error: 'Product is not available' });
    }
    
    // Check if product already exists in build
    const existingResult = await pool.query(
      'SELECT id, quantity FROM build_product WHERE build_id = $1 AND product_id = $2',
      [id, product_id]
    );
    
    if (existingResult.rows.length > 0) {
      // Update quantity
      const newQuantity = existingResult.rows[0].quantity + quantity;
      await pool.query(
        'UPDATE build_product SET quantity = $1 WHERE id = $2',
        [newQuantity, existingResult.rows[0].id]
      );
    } else {
      // Add new product
      await pool.query(
        'INSERT INTO build_product (build_id, product_id, quantity) VALUES ($1, $2, $3)',
        [id, product_id, quantity]
      );
    }
    
    res.json({ message: 'Product added to build successfully' });
  } catch (err) {
    console.error('Add product to build error:', err);
    res.status(500).json({ error: 'Failed to add product to build' });
  }
});

// Update build details
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;
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
    
    // Update build
    const updateFields = [];
    const values = [];
    let paramCount = 1;
    
    if (name !== undefined) {
      updateFields.push(`name = $${paramCount++}`);
      values.push(name);
    }
    
    if (description !== undefined) {
      updateFields.push(`description = $${paramCount++}`);
      values.push(description);
    }
    
    if (status !== undefined) {
      updateFields.push(`status = $${paramCount++}`);
      values.push(status);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(id);
    values.push(customerId);
    
    const result = await pool.query(
      `UPDATE build SET ${updateFields.join(', ')} WHERE id = $${paramCount++} AND customer_id = $${paramCount++} RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Build not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update build error:', err);
    res.status(500).json({ error: 'Failed to update build' });
  }
});

// Remove product from build
router.delete('/:id/product/:productId', authenticateToken, async (req, res) => {
  try {
    const { id, productId } = req.params;
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
    
    // Verify build belongs to user and remove product
    const result = await pool.query(`
      DELETE FROM build_product 
      WHERE build_id = $1 AND product_id = $2 
      AND build_id IN (
        SELECT id FROM build WHERE customer_id = $3
      )
    `, [id, productId, customerId]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Product not found in build or access denied' });
    }
    
    res.json({ message: 'Product removed from build successfully' });
  } catch (err) {
    console.error('Remove product from build error:', err);
    res.status(500).json({ error: 'Failed to remove product from build' });
  }
});

// Delete build
router.delete('/:id', authenticateToken, async (req, res) => {
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
    
    // Delete build (cascade will remove build_products)
    const result = await pool.query(
      'DELETE FROM build WHERE id = $1 AND customer_id = $2',
      [id, customerId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Build not found or access denied' });
    }
    
    res.json({ message: 'Build deleted successfully' });
  } catch (err) {
    console.error('Delete build error:', err);
    res.status(500).json({ error: 'Failed to delete build' });
  }
});

module.exports = router;
