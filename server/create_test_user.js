const bcrypt = require('bcrypt');
const pool = require('./db/connection');

async function createTestUser() {
    try {
        console.log('🔧 Creating test user...');
        
        const testEmail = 'test@test.com';
        const testPassword = 'testpass123';
        const testUsername = 'testuser';
        
        // Check if user already exists
        const existingUser = await pool.query(
            'SELECT id FROM general_user WHERE email = $1 OR username = $2',
            [testEmail, testUsername]
        );
        
        if (existingUser.rows.length > 0) {
            console.log('✅ Test user already exists');
            console.log('Email:', testEmail);
            console.log('Password:', testPassword);
            return;
        }
        
        // Hash password
        const passwordHash = await bcrypt.hash(testPassword, 12);
        
        // Create user
        const result = await pool.query(`
            INSERT INTO general_user (username, email, password_hash, contact_no, full_name, gender)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, username, email
        `, [testUsername, testEmail, passwordHash, '1234567890', 'Test User', 'Other']);
        
        console.log('✅ Test user created:');
        console.log('ID:', result.rows[0].id);
        console.log('Username:', result.rows[0].username);
        console.log('Email:', result.rows[0].email);
        console.log('Password:', testPassword);
        
    } catch (error) {
        console.error('❌ Error creating test user:', error.message);
    }
}

if (require.main === module) {
    createTestUser().then(() => process.exit(0)).catch(console.error);
}

module.exports = { createTestUser };
