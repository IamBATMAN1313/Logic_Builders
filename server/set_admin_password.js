const bcrypt = require('bcrypt');
const pool = require('./db/connection');

async function setAdminPassword() {
    try {
        console.log('🔧 Setting admin password...');
        
        const employee_id = 'EMP001';
        const newPassword = 'admin123';
        
        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        
        // Update the admin password
        const result = await pool.query(
            'UPDATE admin_users SET password = $1 WHERE employee_id = $2 RETURNING admin_id, employee_id, name',
            [hashedPassword, employee_id]
        );
        
        if (result.rows.length > 0) {
            console.log('✅ Admin password updated successfully!');
            console.log('Admin details:', result.rows[0]);
            console.log('');
            console.log('🔑 Login Credentials:');
            console.log('Employee ID:', employee_id);
            console.log('Password:', newPassword);
            console.log('');
            console.log('📍 Admin Login URL: http://localhost:3001/login');
        } else {
            console.log('❌ Admin not found with employee_id:', employee_id);
        }
        
    } catch (error) {
        console.error('❌ Error setting admin password:', error.message);
    } finally {
        process.exit(0);
    }
}

if (require.main === module) {
    setAdminPassword().catch(console.error);
}

module.exports = { setAdminPassword };
