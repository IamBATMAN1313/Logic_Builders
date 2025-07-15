const pool = require('../db/connection');

async function createAdminTables() {
  try {
    // 1. Create admin_signup_requests table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_signup_requests (
        request_id SERIAL PRIMARY KEY,
        employee_id VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL,
        password TEXT NOT NULL,
        phone VARCHAR(20),
        department VARCHAR(100),
        position VARCHAR(100),
        reason_for_access TEXT,
        status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
        requested_clearance VARCHAR(50),
        assigned_clearance VARCHAR(50),
        approved_by INTEGER REFERENCES admin_users(admin_id),
        approved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Create admin_logs table for audit trail
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_logs (
        log_id SERIAL PRIMARY KEY,
        admin_id INTEGER REFERENCES admin_users(admin_id),
        action VARCHAR(100) NOT NULL,
        target_type VARCHAR(50), -- 'USER', 'ADMIN', 'PRODUCT', 'ORDER', etc.
        target_id VARCHAR(100),  -- ID of the affected entity
        details JSONB,           -- Additional details in JSON format
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Create notifications table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_notifications (
        notification_id SERIAL PRIMARY KEY,
        admin_id INTEGER REFERENCES admin_users(admin_id),
        type VARCHAR(50) NOT NULL, -- 'SIGNUP_REQUEST', 'SYSTEM_ALERT', etc.
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        related_id INTEGER, -- Reference to related entity (e.g., signup request ID)
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Create triggers for updated_at
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_signup_requests_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_signup_requests_updated_at ON admin_signup_requests;
      CREATE TRIGGER trg_signup_requests_updated_at
        BEFORE UPDATE ON admin_signup_requests
        FOR EACH ROW EXECUTE PROCEDURE update_signup_requests_updated_at();
    `);

    // 5. Create indexes for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_signup_requests_status ON admin_signup_requests(status);
      CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);
      CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_notifications_admin_id ON admin_notifications(admin_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON admin_notifications(is_read);
    `);

    console.log('✅ Admin tables created successfully:');
    console.log('  - admin_signup_requests (for pending admin registrations)');
    console.log('  - admin_logs (for audit trail)');
    console.log('  - admin_notifications (for real-time alerts)');
    console.log('  - All indexes and triggers created');
    
  } catch (error) {
    console.error('Error creating admin tables:', error);
  } finally {
    await pool.end();
  }
}

createAdminTables();
