const pool = require('./db/connection');

async function testDatabaseConnection() {
    console.log('🔍 Testing Database Connection and Tables...\n');
    
    try {
        // Test basic connection
        console.log('=== Test 1: Basic Connection ===');
        const connectionTest = await pool.query('SELECT NOW()');
        console.log('✅ Database connected at:', connectionTest.rows[0].now);
        
        // Test if product_category table exists
        console.log('\n=== Test 2: Check product_category table ===');
        const tableCheck = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'product_category'
        `);
        
        if (tableCheck.rows.length > 0) {
            console.log('✅ product_category table exists');
            
            // Check columns
            const columnsCheck = await pool.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'product_category'
                ORDER BY ordinal_position
            `);
            console.log('Columns:', columnsCheck.rows);
            
            // Try to count rows
            const countTest = await pool.query('SELECT COUNT(*) FROM product_category');
            console.log('Row count:', countTest.rows[0].count);
            
        } else {
            console.log('❌ product_category table does not exist');
        }
        
        // Test if users table exists for auth
        console.log('\n=== Test 3: Check users table ===');
        const usersCheck = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'users'
        `);
        
        if (usersCheck.rows.length > 0) {
            console.log('✅ users table exists');
            const usersCount = await pool.query('SELECT COUNT(*) FROM users');
            console.log('Users count:', usersCount.rows[0].count);
        } else {
            console.log('❌ users table does not exist');
        }
        
        // Check admin tables
        console.log('\n=== Test 4: Check admin tables ===');
        const adminTables = ['admin_users', 'admin_signup_requests', 'admin_notifications', 'admin_logs'];
        
        for (const tableName of adminTables) {
            const tableExists = await pool.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = $1
            `, [tableName]);
            
            if (tableExists.rows.length > 0) {
                const count = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
                console.log(`✅ ${tableName}: ${count.rows[0].count} rows`);
            } else {
                console.log(`❌ ${tableName} does not exist`);
            }
        }
        
    } catch (error) {
        console.error('❌ Database error:', error.message);
        console.error('Full error:', error);
    } finally {
        // Don't close pool as it might be used by server
        console.log('\n🏁 Database tests complete!');
    }
}

if (require.main === module) {
    testDatabaseConnection().catch(console.error);
}

module.exports = { testDatabaseConnection };
