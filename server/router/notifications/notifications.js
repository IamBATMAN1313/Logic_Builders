const express = require('express');
const pool = require('../../db/connection');
const auth = require('../../middlewares/authenticateToken');
const router = express.Router();

// ============================================================================
// USER NOTIFICATION ENDPOINTS
// ============================================================================

// Get user notifications
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { seen_status, notification_type, category, limit = 50 } = req.query;

    let queryConditions = ['user_id = $1'];
    let queryParams = [userId];
    let paramCount = 1;

    // Add condition for non-expired notifications
    queryConditions.push('(expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)');

    if (seen_status !== undefined) {
      paramCount++;
      queryConditions.push(`seen_status = $${paramCount}`);
      queryParams.push(seen_status === 'true');
    }

    if (notification_type) {
      paramCount++;
      queryConditions.push(`notification_type = $${paramCount}`);
      queryParams.push(notification_type);
    }

    if (category) {
      paramCount++;
      queryConditions.push(`category = $${paramCount}`);
      queryParams.push(category);
    }

    paramCount++;
    queryParams.push(parseInt(limit));

    const notifications = await pool.query(`
      SELECT 
        id,
        notification_text,
        notification_type,
        category,
        seen_status,
        created_at,
        link,
        action_url,
        priority,
        data,
        expires_at
      FROM notification
      WHERE ${queryConditions.join(' AND ')}
      ORDER BY priority DESC, created_at DESC
      LIMIT $${paramCount}
    `, queryParams);

    res.json(notifications.rows);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get unread notification count
router.get('/unread-count', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT COUNT(*) as unread_count
      FROM notification
      WHERE user_id = $1 
        AND seen_status = FALSE
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `, [userId]);

    res.json({ unread_count: parseInt(result.rows[0].unread_count) });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark notification as read
router.patch('/:notificationId/read', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;

    await pool.query(`
      UPDATE notification 
      SET seen_status = TRUE 
      WHERE id = $1 AND user_id = $2
    `, [notificationId, userId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark all notifications as read
router.patch('/mark-all-read', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.query(`
      UPDATE notification 
      SET seen_status = TRUE 
      WHERE user_id = $1 AND seen_status = FALSE
    `, [userId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete notification
router.delete('/:notificationId', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;

    await pool.query(`
      DELETE FROM notification 
      WHERE id = $1 AND user_id = $2
    `, [notificationId, userId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// ADMIN NOTIFICATION MANAGEMENT
// ============================================================================

// Send notification to specific users
router.post('/admin/send', auth, async (req, res) => {
  try {
    const senderId = req.user.id;
    const { 
      user_ids, 
      notification_text, 
      notification_type = 'general', 
      category = 'admin',
      priority = 'normal',
      link,
      action_url,
      expires_at,
      data = {}
    } = req.body;

    // Check if user is admin
    const adminCheck = await pool.query(`
      SELECT 1 FROM admin a
      JOIN general_user gu ON a.user_id = gu.id
      WHERE gu.id = $1
    `, [senderId]);

    if (adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({ error: 'user_ids array is required' });
    }

    if (!notification_text) {
      return res.status(400).json({ error: 'notification_text is required' });
    }

    // Insert notifications for all specified users
    const insertPromises = user_ids.map(userId => {
      return pool.query(`
        INSERT INTO notification (
          user_id, 
          notification_text, 
          notification_type, 
          category, 
          priority, 
          link, 
          action_url, 
          expires_at, 
          data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `, [userId, notification_text, notification_type, category, priority, link, action_url, expires_at, JSON.stringify(data)]);
    });

    const results = await Promise.all(insertPromises);

    res.json({ 
      success: true, 
      notifications_created: results.length,
      message: `Notifications sent to ${results.length} users` 
    });

  } catch (error) {
    console.error('Error sending notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send notification to all customers
router.post('/admin/broadcast', auth, async (req, res) => {
  try {
    const senderId = req.user.id;
    const { 
      notification_text, 
      notification_type = 'general', 
      category = 'broadcast',
      priority = 'normal',
      link,
      action_url,
      expires_at,
      data = {}
    } = req.body;

    // Check if user is admin
    const adminCheck = await pool.query(`
      SELECT 1 FROM admin a
      JOIN general_user gu ON a.user_id = gu.id
      WHERE gu.id = $1 AND a.role IN ('Product Manager', 'General Manager')
    `, [senderId]);

    if (adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!notification_text) {
      return res.status(400).json({ error: 'notification_text is required' });
    }

    // Get all customer user IDs
    const customers = await pool.query(`
      SELECT c.user_id FROM customer c
      JOIN general_user gu ON c.user_id = gu.id
    `);

    if (customers.rows.length === 0) {
      return res.status(404).json({ error: 'No customers found' });
    }

    // Insert notifications for all customers
    const insertPromises = customers.rows.map(customer => {
      return pool.query(`
        INSERT INTO notification (
          user_id, 
          notification_text, 
          notification_type, 
          category, 
          priority, 
          link, 
          action_url, 
          expires_at, 
          data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [customer.user_id, notification_text, notification_type, category, priority, link, action_url, expires_at, JSON.stringify(data)]);
    });

    await Promise.all(insertPromises);

    res.json({ 
      success: true, 
      notifications_created: customers.rows.length,
      message: `Broadcast notification sent to ${customers.rows.length} customers` 
    });

  } catch (error) {
    console.error('Error broadcasting notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get notification statistics for admin dashboard
router.get('/admin/stats', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user is admin
    const adminCheck = await pool.query(`
      SELECT 1 FROM admin a
      JOIN general_user gu ON a.user_id = gu.id
      WHERE gu.id = $1
    `, [userId]);

    if (adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_notifications,
        COUNT(CASE WHEN seen_status = FALSE THEN 1 END) as unread_notifications,
        COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as todays_notifications,
        COUNT(CASE WHEN notification_type = 'order_status_update' THEN 1 END) as order_notifications,
        COUNT(CASE WHEN notification_type = 'qa_answered' THEN 1 END) as qa_notifications,
        COUNT(CASE WHEN notification_type = 'promo_available' THEN 1 END) as promo_notifications
      FROM notification
      WHERE (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `);

    // Get notification counts by priority
    const priorityStats = await pool.query(`
      SELECT 
        priority,
        COUNT(*) as count
      FROM notification
      WHERE (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      GROUP BY priority
      ORDER BY 
        CASE priority 
          WHEN 'urgent' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'normal' THEN 3 
          WHEN 'low' THEN 4 
        END
    `);

    res.json({
      ...stats.rows[0],
      priority_breakdown: priorityStats.rows
    });
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// SYSTEM NOTIFICATION HELPERS
// ============================================================================

// Create order status notification (called by system)
router.post('/system/order-status', async (req, res) => {
  try {
    const { order_id, customer_user_id, old_status, new_status } = req.body;

    if (!order_id || !customer_user_id || !new_status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await pool.query(`
      INSERT INTO notification (
        user_id,
        notification_text,
        notification_type,
        category,
        link,
        priority,
        data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      customer_user_id,
      `Your order #${order_id} status has been updated to: ${new_status}`,
      'order_status_update',
      'orders',
      '/account/orders',
      'normal',
      JSON.stringify({ order_id, old_status, new_status })
    ]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error creating order status notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create Q&A answered notification (called by system)
router.post('/system/qa-answered', async (req, res) => {
  try {
    const { customer_user_id, question_id, product_name, product_id } = req.body;

    if (!customer_user_id || !question_id || !product_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await pool.query(`
      INSERT INTO notification (
        user_id,
        notification_text,
        notification_type,
        category,
        link,
        priority,
        data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      customer_user_id,
      `Your question about "${product_name}" has been answered.`,
      'qa_answered',
      'support',
      `/product/${product_id}`,
      'normal',
      JSON.stringify({ question_id, product_name, product_id })
    ]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error creating Q&A notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
