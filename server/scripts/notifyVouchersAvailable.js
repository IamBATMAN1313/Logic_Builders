const pool = require('../db/connection');

// Function to create notifications for users with available vouchers
async function notifyVouchersAvailable() {
  try {
    console.log('🎫 Checking for users with available vouchers...');
    
    // Get users who have active vouchers and haven't been notified recently
    const result = await pool.query(`
      SELECT DISTINCT 
        c.user_id,
        gu.username,
        COUNT(v.id) as voucher_count
      FROM vouchers v
      JOIN customer c ON v.customer_id = c.id
      JOIN general_user gu ON c.user_id = gu.id
      WHERE v.status = 'active' 
        AND v.is_redeemed = false 
        AND v.expires_at > CURRENT_TIMESTAMP
        AND NOT EXISTS (
          SELECT 1 FROM notification n 
          WHERE n.user_id = c.user_id 
            AND n.notification_type = 'vouchers_available'
            AND n.created_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
        )
      GROUP BY c.user_id, gu.username
      HAVING COUNT(v.id) > 0
    `);
    
    console.log(`Found ${result.rows.length} users with available vouchers`);
    
    // Create notifications for each user
    for (const user of result.rows) {
      const notificationMessage = `🎫 You have ${user.voucher_count} active voucher(s) available! Use them in your cart before they expire.`;
      
      await pool.query(`
        INSERT INTO notification (
          user_id, notification_text, notification_type, category, 
          link, priority, data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        user.user_id,
        notificationMessage,
        'vouchers_available',
        'rewards',
        '/account/vouchers',
        'normal',
        JSON.stringify({
          voucher_count: user.voucher_count,
          username: user.username
        })
      ]);
      
      console.log(`✅ Notification created for user ${user.username} (${user.voucher_count} vouchers)`);
    }
    
    console.log('🎉 Voucher notifications completed!');
    
  } catch (error) {
    console.error('❌ Error creating voucher notifications:', error);
  }
}

// Run if called directly
if (require.main === module) {
  notifyVouchersAvailable()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = { notifyVouchersAvailable };
