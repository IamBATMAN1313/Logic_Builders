const pool = require('./db/connection');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

async function generateAdminToken() {
  try {
    // Check admin user EMP001
    const adminQuery = await pool.query(`
      SELECT admin_id, user_id, employee_id, name, email, clearance_level, password
      FROM admin_users 
      WHERE employee_id = $1
    `, ['EMP001']);

    if (adminQuery.rows.length === 0) {
      console.log('❌ Admin EMP001 not found');
      return;
    }

    const admin = adminQuery.rows[0];
    
    // Verify password
    const passwordMatch = await bcrypt.compare('admin123', admin.password);
    if (!passwordMatch) {
      console.log('❌ Invalid password');
      return;
    }

    // Generate JWT token
    const payload = {
      admin_id: admin.admin_id,
      user_id: admin.user_id,
      employee_id: admin.employee_id,
      clearance_level: admin.clearance_level
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'eiSecRetKEyERjaLAyOrdHekDingEchegastillg9r8koRteParInai', { expiresIn: '24h' });
    console.log(token);
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

generateAdminToken();
