// Database test script using the existing connection
const pool = require('./server/db/connection');

async function testAndFixDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Testing database connection...');
    
    // Test basic connection
    const result = await client.query('SELECT NOW()');
    console.log('✅ Database connected at:', result.rows[0].now);
    
    // Check if points tables exist
    console.log('\n📊 Checking points tables...');
    const tablesCheck = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE tablename IN ('customer_points', 'points_transaction', 'vouchers')
      ORDER BY tablename
    `);
    
    console.log('Tables found:', tablesCheck.rows.map(r => r.tablename));
    
    // Check current user and customer data
    console.log('\n👤 Checking user "aka"...');
    const userCheck = await client.query(`
      SELECT gu.id as user_id, gu.username, gu.email, c.id as customer_id
      FROM general_user gu
      LEFT JOIN customer c ON gu.id = c.user_id
      WHERE gu.username = 'aka'
    `);
    
    if (userCheck.rows.length > 0) {
      const user = userCheck.rows[0];
      console.log('User found:', user);
      
      // Create customer_points table if it doesn't exist
      console.log('\n🔧 Creating points tables...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS public.customer_points (
          id SERIAL PRIMARY KEY,
          customer_id uuid NOT NULL,
          points_balance integer DEFAULT 0 NOT NULL,
          total_earned integer DEFAULT 0 NOT NULL,
          total_redeemed integer DEFAULT 0 NOT NULL,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
          CONSTRAINT customer_points_customer_id_unique UNIQUE (customer_id),
          CONSTRAINT customer_points_balance_check CHECK ((points_balance >= 0))
        )
      `);
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS public.points_transaction (
          id SERIAL PRIMARY KEY,
          customer_id uuid NOT NULL,
          transaction_type character varying(20) NOT NULL,
          points integer NOT NULL,
          order_id integer,
          voucher_id integer,
          description text,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
      `);
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS public.vouchers (
          id SERIAL PRIMARY KEY,
          customer_id uuid NOT NULL,
          code character varying(50) NOT NULL UNIQUE,
          type character varying(20) DEFAULT 'discount'::character varying NOT NULL,
          value numeric(10,2) NOT NULL,
          discount_type character varying(20) DEFAULT 'percentage'::character varying NOT NULL,
          min_order_amount numeric(10,2) DEFAULT 0,
          max_discount_amount numeric(10,2),
          is_redeemed boolean DEFAULT false NOT NULL,
          redeemed_at timestamp without time zone,
          order_id integer,
          points_used integer,
          expires_at timestamp without time zone,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
      `);
      
      console.log('✅ Tables created successfully');
      
      // Add test points for the user
      if (user.customer_id) {
        console.log('\n🎁 Adding test points...');
        await client.query(`
          INSERT INTO customer_points (customer_id, points_balance, total_earned)
          VALUES ($1, 500, 500)
          ON CONFLICT (customer_id) 
          DO UPDATE SET 
            points_balance = GREATEST(customer_points.points_balance, 500),
            total_earned = GREATEST(customer_points.total_earned, 500)
        `, [user.customer_id]);
        
        await client.query(`
          INSERT INTO points_transaction (customer_id, transaction_type, points, description)
          VALUES ($1, 'bonus', 500, 'Test bonus points for system testing')
        `, [user.customer_id]);
        
        console.log('✅ Added 500 test points');
      } else {
        console.log('⚠️ No customer profile found for user "aka"');
      }
      
      // Create fixed trigger function
      console.log('\n🔧 Creating trigger function...');
      await client.query(`
        CREATE OR REPLACE FUNCTION public.award_points_for_order() RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        DECLARE
            customer_uuid UUID;
            customer_user_id UUID;
            points_to_award INTEGER;
        BEGIN
            -- NEW.customer_id is already the customer UUID in the order table
            customer_uuid := NEW.customer_id;
            
            -- Get the user_id for notifications
            SELECT c.user_id INTO customer_user_id
            FROM customer c
            WHERE c.id = customer_uuid;

            IF customer_uuid IS NOT NULL AND customer_user_id IS NOT NULL THEN
                -- Calculate points (1 point per dollar spent)
                points_to_award := FLOOR(NEW.total_amount);

                -- Skip if no points to award
                IF points_to_award <= 0 THEN
                    RETURN NEW;
                END IF;

                -- Insert or update customer points
                INSERT INTO customer_points (customer_id, points_balance, total_earned)
                VALUES (customer_uuid, points_to_award, points_to_award)
                ON CONFLICT (customer_id) 
                DO UPDATE SET 
                    points_balance = customer_points.points_balance + points_to_award,
                    total_earned = customer_points.total_earned + points_to_award,
                    updated_at = CURRENT_TIMESTAMP;

                -- Record the transaction
                INSERT INTO points_transaction (
                    customer_id, 
                    transaction_type, 
                    points, 
                    order_id, 
                    description
                ) VALUES (
                    customer_uuid,
                    'earned',
                    points_to_award,
                    NEW.id,
                    'Points earned from order #' || NEW.id || ' - $' || NEW.total_amount
                );

                -- Create notification for points earned
                INSERT INTO notification (
                    user_id,
                    notification_text,
                    notification_type,
                    category,
                    link,
                    priority,
                    data
                ) VALUES (
                    customer_user_id,
                    '🎉 You earned ' || points_to_award || ' points from your recent order! Use them to get discount coupons.',
                    'points_earned',
                    'rewards',
                    '/account/vouchers',
                    'normal',
                    jsonb_build_object(
                        'points_earned', points_to_award,
                        'order_id', NEW.id,
                        'total_amount', NEW.total_amount,
                        'points_rate', '1 point per $1 spent'
                    )
                );
                
                RAISE NOTICE 'Points awarded: % points to customer % for order %', 
                    points_to_award, customer_uuid, NEW.id;
            END IF;

            RETURN NEW;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Error awarding points for order %: %', NEW.id, SQLERRM;
                RETURN NEW;
        END;
        $$;
      `);
      
      // Create trigger if order table exists
      const orderTableCheck = await client.query(`
        SELECT tablename FROM pg_tables WHERE tablename = 'order'
      `);
      
      if (orderTableCheck.rows.length > 0) {
        await client.query(`
          DROP TRIGGER IF EXISTS trg_award_points_for_order ON public."order"
        `);
        
        await client.query(`
          CREATE TRIGGER trg_award_points_for_order 
            AFTER UPDATE OF status ON public."order"
            FOR EACH ROW 
            WHEN (NEW.status = 'delivered' AND OLD.status != 'delivered')
            EXECUTE FUNCTION public.award_points_for_order()
        `);
        
        console.log('✅ Trigger created successfully');
      } else {
        console.log('⚠️ Order table not found');
      }
      
    } else {
      console.log('❌ User "aka" not found');
    }
    
    console.log('\n✅ Database setup complete!');
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    client.release();
  }
}

testAndFixDatabase().then(() => {
  console.log('\n🎯 Test the points system now with: node test-api-endpoints.js');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
