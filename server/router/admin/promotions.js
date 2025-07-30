const express = require('express');
const router = express.Router();
const pool = require('../../db/connection');
const jwt = require('jsonwebtoken');

// Simple admin authentication middleware
const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    console.log('🔐 Admin Auth Debug:', {
      hasToken: !!token,
      tokenStart: token ? token.substring(0, 20) + '...' : 'none'
    });
    
    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    console.log('✅ Token decoded:', decoded);
    
    // Get admin details from database (using admin_users table)
    const adminResult = await pool.query(
      'SELECT admin_id, employee_id, clearance_level FROM admin_users WHERE admin_id = $1 AND is_active = true',
      [decoded.admin_id]
    );

    console.log('🔍 Admin query result:', {
      found: adminResult.rows.length > 0,
      searchedId: decoded.admin_id,
      result: adminResult.rows[0] || 'not found'
    });

    if (adminResult.rows.length === 0) {
      console.log('❌ Admin not found in database');
      return res.status(401).json({ message: 'Invalid admin token.' });
    }

    req.admin = adminResult.rows[0];
    console.log('✅ Admin authenticated:', req.admin);
    next();
  } catch (error) {
    console.log('❌ Token verification error:', error.message);
    return res.status(401).json({ message: 'Invalid token.' });
  }
};

// Get all promotions with analytics
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const promotionsQuery = `
      SELECT 
        p.*,
        COALESCE(usage_stats.total_used, 0) as total_used,
        COALESCE(usage_stats.total_discount_given, 0) as total_discount_given,
        CASE 
          WHEN p.end_date < NOW() THEN 'Expired'
          WHEN p.is_active = false THEN 'Inactive'
          ELSE 'Active'
        END as status
      FROM promotions p
      LEFT JOIN (
        SELECT 
          promotion_id,
          COUNT(*) as total_used,
          SUM(discount_amount) as total_discount_given
        FROM promotion_usage 
        GROUP BY promotion_id
      ) usage_stats ON p.id = usage_stats.promotion_id
      ORDER BY p.created_at DESC
    `;
    
    const result = await pool.query(promotionsQuery);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching promotions:', err);
    res.status(500).json({ error: 'Failed to fetch promotions 2' });
  }
});

// Get promotion analytics
router.get('/analytics', async (req, res) => {
  try {
    const analyticsQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE is_active = true AND end_date > NOW()) as active_promotions,
        COALESCE(SUM(pu.discount_amount), 0) as total_discount_given,
        COUNT(pu.id) as total_coupons_used,
        ROUND(
          CASE 
            WHEN COALESCE(SUM(pu.discount_amount), 0) = 0 THEN 0
            ELSE (COALESCE(SUM(pu.order_value), 0) - COALESCE(SUM(pu.discount_amount), 0)) / COALESCE(SUM(pu.discount_amount), 1) * 100
          END, 
          2
        ) as roi_percentage
      FROM promotions p
      LEFT JOIN promotion_usage pu ON p.id = pu.promotion_id
    `;
    
    const result = await pool.query(analyticsQuery);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching promotion analytics:', err);
    res.status(500).json({ error: 'Failed to fetch promotion 3 analytics' });
  }
});

// Create new promotion
router.post('/', async (req, res) => {
  const {
    name,
    code,
    type,
    discount_value,
    max_uses,
    min_order_value,
    start_date,
    end_date,
    description,
    is_active
  } = req.body;

  try {
    console.log('Creating promotion with data:', req.body);
    console.log('Admin user:', req.admin);
    
    const insertQuery = `
      INSERT INTO promotions (
        name, code, type, discount_value, max_uses, 
        min_order_value, start_date, end_date, description,
        is_active, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      RETURNING *
    `;
    
    const values = [
      name, 
      code, 
      type, 
      parseFloat(discount_value) || 0,
      max_uses ? parseInt(max_uses) : null,
      min_order_value ? parseFloat(min_order_value) : 0,
      start_date || null,
      end_date || null,
      description || null,
      is_active !== undefined ? is_active : true,
      req.admin.admin_id
    ];
    
    console.log('Insert values:', values);
    
    const result = await pool.query(insertQuery, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating promotion:', err);
    console.error('Error details:', err.message);
    if (err.code === '23505') { // Duplicate key
      res.status(400).json({ error: 'Promotion code already exists' });
    } else {
      res.status(500).json({ error: `Failed to create promotion: ${err.message}` });
    }
  }
});

// Update promotion
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    name,
    code,
    type,
    discount_value,
    max_uses,
    min_order_value,
    start_date,
    end_date,
    description,
    is_active
  } = req.body;

  try {
    const updateQuery = `
      UPDATE promotions 
      SET name = $1, code = $2, type = $3, discount_value = $4,
          max_uses = $5, min_order_value = $6, start_date = $7,
          end_date = $8, description = $9, is_active = $10,
          updated_at = NOW()
      WHERE id = $11
      RETURNING *
    `;
    
    const values = [
      name, code, type, discount_value, max_uses,
      min_order_value, start_date, end_date, description, is_active, id
    ];
    
    const result = await pool.query(updateQuery, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Promotion not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating promotion:', err);
    res.status(500).json({ error: 'Failed to update promotion' });
  }
});

// Delete promotion
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const deleteQuery = 'DELETE FROM promotions WHERE id = $1 RETURNING *';
    const result = await pool.query(deleteQuery, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Promotion not found' });
    }
    
    res.json({ message: 'Promotion deleted successfully' });
  } catch (err) {
    console.error('Error deleting promotion:', err);
    res.status(500).json({ error: 'Failed to delete promotion' });
  }
});

// Generate bulk coupon codes
router.post('/generate-coupons', async (req, res) => {
  console.log('🎯 Coupon generation endpoint hit!');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  
  // Temporarily bypass authentication for debugging
  req.admin = { admin_id: '27c219a1-9a50-4187-97fb-d7c81861cd1a' };
  const {
    base_name,
    count,
    type,
    discount_value,
    max_uses_per_code,
    min_order_value,
    start_date,
    end_date,
    description
  } = req.body;

  try {
    // Validate required fields (handle empty strings as missing)
    if (!base_name || base_name.toString().trim() === '' || 
        !count || count.toString().trim() === '' || 
        !type || type.toString().trim() === '' || 
        !discount_value || discount_value.toString().trim() === '') {
      return res.status(400).json({ 
        error: 'Missing required fields: base_name, count, type, discount_value' 
      });
    }

    // Validate and convert numeric fields
    const parsedCount = parseInt(count);
    const parsedDiscountValue = parseFloat(discount_value);
    const parsedMaxUses = max_uses_per_code && max_uses_per_code.toString().trim() !== '' 
      ? parseInt(max_uses_per_code) : null;
    const parsedMinOrderValue = min_order_value && min_order_value.toString().trim() !== '' 
      ? parseFloat(min_order_value) : 0;

    if (isNaN(parsedCount) || parsedCount <= 0) {
      return res.status(400).json({ error: 'Count must be a positive number' });
    }

    if (isNaN(parsedDiscountValue) || parsedDiscountValue <= 0) {
      return res.status(400).json({ error: 'Discount value must be a positive number' });
    }

    // Validate optional numeric fields
    if (parsedMaxUses !== null && (isNaN(parsedMaxUses) || parsedMaxUses <= 0)) {
      return res.status(400).json({ error: 'Invalid max_uses_per_code' });
    }

    if (isNaN(parsedMinOrderValue) || parsedMinOrderValue < 0) {
      return res.status(400).json({ error: 'Invalid min_order_value' });
    }

    const coupons = [];
    
    for (let i = 1; i <= parsedCount; i++) {
      const code = `${base_name}${i.toString().padStart(3, '0')}`;
      const name = `${base_name} Coupon ${i}`;
      
      const insertQuery = `
        INSERT INTO promotions (
          name, code, type, discount_value, max_uses,
          min_order_value, start_date, end_date, description,
          created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        RETURNING *
      `;
      
      const values = [
        name, 
        code, 
        type, 
        parsedDiscountValue,
        parsedMaxUses,
        parsedMinOrderValue,
        start_date && start_date.trim() !== '' ? start_date : null,
        end_date && end_date.trim() !== '' ? end_date : null,
        description && description.trim() !== '' ? description.trim() : null,
        req.admin.admin_id
      ];
      
      const result = await pool.query(insertQuery, values);
      coupons.push(result.rows[0]);
    }
    
    res.status(201).json({
      message: `Successfully generated ${parsedCount} coupon codes`,
      coupons
    });
  } catch (err) {
    console.error('Error generating coupons:', err);
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      code: err.code
    });
    res.status(500).json({ error: 'Failed to generate coupons' });
  }
});

// Get promotion usage history
router.get('/:id/usage', async (req, res) => {
  const { id } = req.params;

  try {
    const usageQuery = `
      SELECT 
        pu.*,
        o.order_date,
        u.email as user_email
      FROM promotion_usage pu
      JOIN orders o ON pu.order_id = o.id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE pu.promotion_id = $1
      ORDER BY pu.used_at DESC
    `;
    
    const result = await pool.query(usageQuery, [id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching promotion usage:', err);
    res.status(500).json({ error: 'Failed to fetch promotion 4 usage' });
  }
});

module.exports = router;
