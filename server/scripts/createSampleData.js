const pool = require('../db/connection');
const bcrypt = require('bcrypt');

async function createSampleData() {
  try {
    // Create a sample admin signup request
    const hashedPassword = await bcrypt.hash('samplepass123', 10);
    
    await pool.query(`
      INSERT INTO admin_signup_requests 
      (employee_id, name, email, password, phone, department, position, reason_for_access, requested_clearance)
      VALUES 
      ('EMP002', 'Sarah Johnson', 'sarah.johnson@company.com', $1, '+1-555-234-5678', 'Analytics', 'Data Analyst', 'I need access to analytics dashboard to generate monthly reports and track business KPIs for the management team.', 'ANALYTICS'),
      ('EMP003', 'Mike Chen', 'mike.chen@company.com', $2, '+1-555-345-6789', 'Inventory', 'Warehouse Manager', 'Need inventory management access to track stock levels, manage reorders, and handle warehouse operations efficiently.', 'INVENTORY_MANAGER'),
      ('EMP004', 'Lisa Rodriguez', 'lisa.rodriguez@company.com', $3, '+1-555-456-7890', 'Marketing', 'Marketing Specialist', 'Require promotion management access to create marketing campaigns, manage discount codes, and track promotional effectiveness.', 'PROMO_MANAGER')
      ON CONFLICT (employee_id) DO NOTHING
    `, [hashedPassword, hashedPassword, hashedPassword]);

    // Create a sample notification for the general manager
    const generalManagerResult = await pool.query(
      'SELECT admin_id FROM admin_users WHERE clearance_level = $1 LIMIT 1',
      ['GENERAL_MANAGER']
    );

    if (generalManagerResult.rows.length > 0) {
      const gmAdminId = generalManagerResult.rows[0].admin_id;
      
      await pool.query(`
        INSERT INTO admin_notifications (admin_id, type, title, message, related_id)
        VALUES 
        ($1, 'SIGNUP_REQUEST', 'New Admin Signup Requests', 'You have 3 pending admin signup requests that need review.', 1),
        ($1, 'SYSTEM_ALERT', 'System Maintenance Scheduled', 'Scheduled maintenance will occur this weekend from 2 AM to 4 AM EST.', NULL)
        ON CONFLICT DO NOTHING
      `, [gmAdminId]);
    }

    // Create some sample admin logs
    const adminResult = await pool.query('SELECT admin_id FROM admin_users LIMIT 1');
    if (adminResult.rows.length > 0) {
      const adminId = adminResult.rows[0].admin_id;
      
      await pool.query(`
        INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
        VALUES 
        ($1, 'LOGIN', 'SYSTEM', NULL, '{"login_method": "password", "success": true}'),
        ($1, 'VIEW_DASHBOARD', 'DASHBOARD', NULL, '{"page": "dashboard", "duration": 120}'),
        ($1, 'VIEW_ADMIN_MANAGEMENT', 'ADMIN', NULL, '{"page": "admin_management", "tab": "requests"}')
      `, [adminId]);
    }

    console.log('✅ Sample data created successfully!');
    console.log('📊 3 admin signup requests created');
    console.log('🔔 2 notifications created for General Manager');
    console.log('📝 3 admin activity logs created');
    console.log('');
    console.log('🔗 You can now:');
    console.log('1. Login to admin dashboard with EMP001/admin123');
    console.log('2. Check notifications (bell icon)');
    console.log('3. Go to Admin Management to review signup requests');
    console.log('4. Test the signup flow at /admin/signup');

  } catch (error) {
    console.error('Error creating sample data:', error);
  } finally {
    await pool.end();
  }
}

createSampleData();
