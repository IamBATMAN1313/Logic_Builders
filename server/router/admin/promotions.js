const express = require('express');
const router = express.Router();
const pool = require('../../db/connection');

// Get all promotions with analytics
router.get('/', async (req, res) => {
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
    res.status(500).json({ error: 'Failed to fetch promotions' });
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
    res.status(500).json({ error: 'Failed to fetch promotion analytics' });
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
    description
  } = req.body;

  try {
    const insertQuery = `
      INSERT INTO promotions (
        name, code, type, discount_value, max_uses, 
        min_order_value, start_date, end_date, description,
        created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *
    `;
    
    const values = [
      name, code, type, discount_value, max_uses,
      min_order_value, start_date, end_date, description,
      req.admin.admin_id
    ];
    
    const result = await pool.query(insertQuery, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating promotion:', err);
    if (err.code === '23505') { // Duplicate key
      res.status(400).json({ error: 'Promotion code already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create promotion' });
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
  const {
    base_name,
    count,
    type,
    discount_value,
    max_uses_per_code,
    min_order_value,
    start_date,
    end_date
  } = req.body;

  try {
    const coupons = [];
    
    for (let i = 1; i <= count; i++) {
      const code = `${base_name}${i.toString().padStart(3, '0')}`;
      const name = `${base_name} Coupon ${i}`;
      
      const insertQuery = `
        INSERT INTO promotions (
          name, code, type, discount_value, max_uses,
          min_order_value, start_date, end_date,
          created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING *
      `;
      
      const values = [
        name, code, type, discount_value, max_uses_per_code,
        min_order_value, start_date, end_date, req.admin.admin_id
      ];
      
      const result = await pool.query(insertQuery, values);
      coupons.push(result.rows[0]);
    }
    
    res.status(201).json({
      message: `Successfully generated ${count} coupon codes`,
      coupons
    });
  } catch (err) {
    console.error('Error generating coupons:', err);
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
    res.status(500).json({ error: 'Failed to fetch promotion usage' });
  }
});

module.exports = router;
