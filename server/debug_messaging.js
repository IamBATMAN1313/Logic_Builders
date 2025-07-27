const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// Test admin login and messaging endpoints
async function debugMessaging() {
  const pool = require('./db/connection');
  
  console.log('=== MESSAGING DEBUG SCRIPT ===\n');

  try {
    // 1. Test database connection
    console.log('1. Testing database connection...');
    const dbTest = await pool.query('SELECT NOW()');
    console.log('✅ Database connected:', dbTest.rows[0].now);

    // 2. Check admin user EMP001
    console.log('\n2. Checking admin user EMP001...');
    const adminQuery = await pool.query(`
      SELECT admin_id, user_id, employee_id, name, email, clearance_level, password
      FROM admin_users 
      WHERE employee_id = 'EMP001'
    `);
    
    if (adminQuery.rows.length === 0) {
      console.log('❌ Admin EMP001 not found');
      return;
    }
    
    const admin = adminQuery.rows[0];
    console.log('✅ Admin found:', {
      admin_id: admin.admin_id,
      user_id: admin.user_id,
      employee_id: admin.employee_id,
      name: admin.name,
      email: admin.email,
      clearance_level: admin.clearance_level
    });

    // 3. Test password verification
    console.log('\n3. Testing password verification...');
    const passwordMatch = await bcrypt.compare('admin123', admin.password);
    console.log('✅ Password match:', passwordMatch);

    if (!passwordMatch) {
      console.log('❌ Password does not match');
      return;
    }

    // 4. Generate JWT token
    console.log('\n4. Generating JWT token...');
    const token = jwt.sign(
      {
        admin_id: admin.admin_id,
        user_id: admin.user_id,
        name: admin.name,
        clearance_level: admin.clearance_level
      },
      process.env.JWT_SECRET || 'eiSecRetKEyERjaLAyOrdHekDingEchegastillg9r8koRteParInai',
      { expiresIn: '24h' }
    );
    console.log('✅ JWT token generated');
    console.log('Token:', token.substring(0, 50) + '...');

    // 5. Test messaging tables
    console.log('\n5. Testing messaging tables...');
    
    // Check conversations table
    const convQuery = await pool.query('SELECT COUNT(*) FROM conversation');
    console.log('✅ Conversations table exists, count:', convQuery.rows[0].count);
    
    // Check messages table
    const msgQuery = await pool.query('SELECT COUNT(*) FROM message');
    console.log('✅ Messages table exists, count:', msgQuery.rows[0].count);
    
    // Check conversation_participant table
    const partQuery = await pool.query('SELECT COUNT(*) FROM conversation_participant');
    console.log('✅ Conversation_participant table exists, count:', partQuery.rows[0].count);

    // 6. Test admin messaging endpoints manually
    console.log('\n6. Testing admin conversations query...');
    const adminConvsQuery = `
      SELECT 
        c.id,
        c.subject,
        c.type,
        c.status,
        c.created_at,
        c.last_message_at,
        cu.full_name as customer_name,
        cu.email as customer_email,
        latest_msg.message_text as last_message,
        COALESCE(unread.unread_count, 0) as unread_count
      FROM conversation c
      LEFT JOIN general_user cu ON c.created_by = cu.id
      LEFT JOIN (
        SELECT DISTINCT ON (conversation_id) 
          conversation_id, message_text
        FROM message 
        ORDER BY conversation_id, sent_at DESC
      ) latest_msg ON c.id = latest_msg.conversation_id
      LEFT JOIN (
        SELECT 
          conversation_id,
          COUNT(*) as unread_count
        FROM message m
        WHERE m.seen_status = false AND m.sender_id != $1
        GROUP BY conversation_id
      ) unread ON c.id = unread.conversation_id
      ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
    `;

    const adminConvs = await pool.query(adminConvsQuery, [admin.user_id]);
    console.log('✅ Admin conversations query successful, found:', adminConvs.rows.length);
    
    if (adminConvs.rows.length > 0) {
      console.log('First conversation:', {
        id: adminConvs.rows[0].id,
        subject: adminConvs.rows[0].subject,
        customer_name: adminConvs.rows[0].customer_name,
        status: adminConvs.rows[0].status
      });
    }

    // 7. Test user conversations (simulate regular user)
    console.log('\n7. Testing user conversations...');
    const userQuery = await pool.query('SELECT id, username, full_name FROM general_user LIMIT 1');
    
    if (userQuery.rows.length > 0) {
      const user = userQuery.rows[0];
      console.log('✅ Test user found:', user.username);
      
      const userConvsQuery = `
        SELECT 
          c.id as conversation_id,
          c.subject,
          c.type,
          c.status,
          c.created_at,
          c.last_message_at,
          latest_msg.message_text as last_message,
          COALESCE(unread.unread_count, 0) as unread_count
        FROM conversation c
        JOIN conversation_participant cp ON c.id = cp.conversation_id
        LEFT JOIN (
          SELECT DISTINCT ON (conversation_id) 
            conversation_id, message_text
          FROM message 
          ORDER BY conversation_id, sent_at DESC
        ) latest_msg ON c.id = latest_msg.conversation_id
        LEFT JOIN (
          SELECT 
            conversation_id,
            COUNT(*) as unread_count
          FROM message m
          WHERE m.seen_status = false AND m.sender_id != $1
          GROUP BY conversation_id
        ) unread ON c.id = unread.conversation_id
        WHERE cp.user_id = $1 AND cp.is_active = TRUE
        ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
      `;
      
      const userConvs = await pool.query(userConvsQuery, [user.id]);
      console.log('✅ User conversations query successful, found:', userConvs.rows.length);
    }

    // 8. Test create conversation
    console.log('\n8. Testing conversation creation...');
    if (userQuery.rows.length > 0) {
      const user = userQuery.rows[0];
      
      // Create test conversation
      const createConvResult = await pool.query(`
        INSERT INTO conversation (subject, type, status, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, ['Debug Test Conversation', 'general', 'pending', user.id]);
      
      const conversationId = createConvResult.rows[0].id;
      console.log('✅ Test conversation created with ID:', conversationId);
      
      // Add participant
      await pool.query(`
        INSERT INTO conversation_participant (conversation_id, user_id, is_active)
        VALUES ($1, $2, $3)
      `, [conversationId, user.id, true]);
      
      console.log('✅ Participant added to conversation');
      
      // Add initial message
      await pool.query(`
        INSERT INTO message (sender_id, receiver_id, conversation_id, message_text, message_type)
        VALUES ($1, $2, $3, $4, $5)
      `, [user.id, null, conversationId, 'This is a debug test message', 'text']);
      
      console.log('✅ Test message added to conversation');
      
      // Update conversation last_message_at
      await pool.query(`
        UPDATE conversation 
        SET last_message_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [conversationId]);
      
      console.log('✅ Conversation timestamp updated');
    }

    console.log('\n=== DEBUG COMPLETE ===');
    console.log('Use this token for testing:');
    console.log(token);

  } catch (error) {
    console.error('❌ Debug error:', error);
  } finally {
    process.exit(0);
  }
}

debugMessaging();
