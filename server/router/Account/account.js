const express = require('express');
const router = express.Router();
const pool = require('../../db/connection');
const authenticateToken = require('../../middlewares/authenticateToken');

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userResult = await pool.query(
      'SELECT id, username, email, full_name, contact_no, gender FROM general_user WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(userResult.rows[0]);
  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Get user reviews
router.get('/reviews', authenticateToken, async (req, res) => {
  try {
    // For now, return empty array
    res.json([]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Get user vouchers and points
router.get('/vouchers', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get customer ID from user ID
    const customerResult = await pool.query(
      'SELECT id FROM customer WHERE user_id = $1',
      [userId]
    );
    
    if (customerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Customer profile not found' });
    }
    
    const customerId = customerResult.rows[0].id;
    
    // Get customer's current points
    const pointsResult = await pool.query(
      'SELECT points_balance FROM customer_points WHERE customer_id = $1',
      [customerId]
    );
    
    const points = pointsResult.rows.length > 0 ? pointsResult.rows[0].points_balance : 0;
    
    // Get customer's vouchers (coupons)
    const vouchersResult = await pool.query(
      `SELECT id, code, type, value, discount_type, min_order_amount, 
              max_discount_amount, is_redeemed, redeemed_at, expires_at, created_at
       FROM vouchers 
       WHERE customer_id = $1 
       ORDER BY created_at DESC`,
      [customerId]
    );
    
    const vouchers = vouchersResult.rows.map(voucher => ({
      ...voucher,
      status: voucher.is_redeemed ? 'used' : (voucher.expires_at && new Date(voucher.expires_at) < new Date()) ? 'expired' : 'active'
    }));
    
    res.json({ vouchers, points });
  } catch (err) {
    console.error('Vouchers fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch vouchers and points' });
  }
});

// Redeem points for coupons
router.post('/redeem-points', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = req.user.id;
    const { points: pointsToRedeem } = req.body;
    
    // Validate input
    if (!pointsToRedeem || pointsToRedeem < 100 || pointsToRedeem % 100 !== 0) {
      return res.status(400).json({ 
        error: 'Points must be redeemed in multiples of 100, minimum 100 points' 
      });
    }
    
    await client.query('BEGIN');
    
    // Get customer ID from user ID
    const customerResult = await client.query(
      'SELECT id FROM customer WHERE user_id = $1',
      [userId]
    );
    
    if (customerResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Customer profile not found' });
    }
    
    const customerId = customerResult.rows[0].id;
    
    // Check customer's current points
    const pointsResult = await client.query(
      'SELECT points_balance FROM customer_points WHERE customer_id = $1',
      [customerId]
    );
    
    const currentPoints = pointsResult.rows.length > 0 ? pointsResult.rows[0].points_balance : 0;
    
    if (currentPoints < pointsToRedeem) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient points' });
    }
    
    // Deduct points from balance and record transaction
    await client.query(
      `UPDATE customer_points 
       SET points_balance = points_balance - $1, 
           total_redeemed = total_redeemed + $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE customer_id = $2`,
      [pointsToRedeem, customerId]
    );
    
    // Record the redemption transaction
    await client.query(
      `INSERT INTO points_transaction (
        customer_id, transaction_type, points, description
      ) VALUES ($1, 'redeemed', $2, $3)`,
      [customerId, -pointsToRedeem, `Redeemed ${pointsToRedeem} points for coupons`]
    );
    
    // Generate coupons (1 coupon per 100 points)
    const couponsToGenerate = Math.floor(pointsToRedeem / 100);
    const coupons = [];
    
    for (let i = 0; i < couponsToGenerate; i++) {
      // Generate unique coupon code
      const couponCode = `LOYALTY${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      // Create coupon with 10% discount and $500 max discount cap
      const couponResult = await client.query(
        `INSERT INTO vouchers (
          customer_id, code, type, value, discount_type, 
          min_order_amount, max_discount_amount, expires_at, points_used
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
        RETURNING id, code, value`,
        [
          customerId,
          couponCode,
          'discount',
          10.00,
          'percentage',
          50.00,
          500.00, // $500 maximum discount cap
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days (1 month) from now
          100 // points used per coupon
        ]
      );
      
      coupons.push(couponResult.rows[0]);
    }
    
    // Create notification for the user
    const notificationMessage = `🎉 ${couponsToGenerate} new coupon(s) generated! You redeemed ${pointsToRedeem} points and received ${couponsToGenerate} discount coupon(s). Check your vouchers section to use them.`;
    
    await client.query(
      `INSERT INTO notification (
        user_id, notification_text, notification_type, category, 
        link, priority, data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, notificationMessage, 'coupon_generated', 'rewards', 
       '/account/vouchers', 'normal', JSON.stringify({
         points_redeemed: pointsToRedeem,
         coupons_generated: couponsToGenerate,
         coupon_codes: coupons.map(c => c.code)
       })]
    );
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      message: `Successfully redeemed ${pointsToRedeem} points for ${couponsToGenerate} coupon(s)`,
      coupons 
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Redeem points error:', err);
    res.status(500).json({ error: 'Failed to redeem points' });
  } finally {
    client.release();
  }
});

module.exports = router;
