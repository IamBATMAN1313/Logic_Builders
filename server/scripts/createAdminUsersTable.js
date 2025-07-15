const pool = require('../db/connection');

async function createAdminUsersTable() {
  try {
    // Create admin_users table for separate admin authentication
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        admin_id SERIAL PRIMARY KEY,
        employee_id VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        password TEXT NOT NULL,
        clearance_level VARCHAR(50) NOT NULL DEFAULT 'INVENTORY_MANAGER',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ admin_users table created successfully!');
    
    // Create trigger for updated_at
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_admin_users_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await pool.query(`
      DROP TRIGGER IF EXISTS trg_admin_users_updated_at ON admin_users;
      CREATE TRIGGER trg_admin_users_updated_at
        BEFORE UPDATE ON admin_users
        FOR EACH ROW EXECUTE PROCEDURE update_admin_users_updated_at();
    `);

    console.log('✅ admin_users trigger created successfully!');
    
  } catch (error) {
    console.error('Error creating admin_users table:', error);
  } finally {
    await pool.end();
  }
}

createAdminUsersTable();
