const bcrypt = require('bcrypt');
const pool = require('../db/connection');

async function createInitialAdmin() {
  try {
    // Check if admin table exists and has the initial admin
    const checkResult = await pool.query(
      'SELECT * FROM admin_users WHERE employee_id = $1',
      ['EMP001']
    );

    if (checkResult.rows.length > 0) {
      console.log('Initial admin already exists!');
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // Create the initial admin
    const result = await pool.query(
      'INSERT INTO admin_users (employee_id, name, password, clearance_level) VALUES ($1, $2, $3, $4) RETURNING *',
      ['EMP001', 'Muttakin Ahmed Chowdhury', hashedPassword, 'GENERAL_MANAGER']
    );

    console.log('✅ Initial admin created successfully!');
    console.log('Employee ID: EMP001');
    console.log('Password: admin123');
    console.log('Clearance: GENERAL_MANAGER');
    
  } catch (error) {
    console.error('Error creating initial admin:', error);
  } finally {
    await pool.end();
  }
}

createInitialAdmin();
