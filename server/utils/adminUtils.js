const pool = require('../db/connection');

// Log admin actions for audit trail
async function logAdminAction(adminId, action, targetType = null, targetId = null, details = {}, req = null) {
  try {
    const ipAddress = req?.ip || req?.connection?.remoteAddress || null;
    const userAgent = req?.get('User-Agent') || null;

    await pool.query(`
      INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [adminId, action, targetType, targetId, JSON.stringify(details), ipAddress, userAgent]);

  } catch (error) {
    console.error('Error logging admin action:', error);
  }
}

// Create notification for specific admin or all admins with specific clearance
async function createNotification(adminId, type, title, message, relatedId = null) {
  try {
    await pool.query(`
      INSERT INTO admin_notifications (admin_id, type, title, message, related_id)
      VALUES ($1, $2, $3, $4, $5)
    `, [adminId, type, title, message, relatedId]);

  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

// Create notification for all admins with specific clearance
async function createNotificationForClearance(clearanceLevel, type, title, message, relatedId = null) {
  try {
    const admins = await pool.query(
      'SELECT admin_id FROM admin_users WHERE clearance_level = $1 AND is_active = true',
      [clearanceLevel]
    );

    for (const admin of admins.rows) {
      await createNotification(admin.admin_id, type, title, message, relatedId);
    }

  } catch (error) {
    console.error('Error creating notifications for clearance:', error);
  }
}

// Get unread notifications count
async function getUnreadNotificationsCount(adminId) {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM admin_notifications WHERE admin_id = $1 AND is_read = false',
      [adminId]
    );
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error('Error getting unread notifications count:', error);
    return 0;
  }
}

// Mark notifications as read
async function markNotificationsAsRead(adminId, notificationIds = null) {
  try {
    if (notificationIds && notificationIds.length > 0) {
      // Mark specific notifications as read
      await pool.query(
        'UPDATE admin_notifications SET is_read = true WHERE admin_id = $1 AND notification_id = ANY($2)',
        [adminId, notificationIds]
      );
    } else {
      // Mark all notifications as read
      await pool.query(
        'UPDATE admin_notifications SET is_read = true WHERE admin_id = $1',
        [adminId]
      );
    }
  } catch (error) {
    console.error('Error marking notifications as read:', error);
  }
}

module.exports = {
  logAdminAction,
  createNotification,
  createNotificationForClearance,
  getUnreadNotificationsCount,
  markNotificationsAsRead
};
