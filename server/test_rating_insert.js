require('dotenv').config();
const pool = require('./db/connection');

async function testRatingInsert() {
  try {
    console.log('=== TESTING RATING INSERTION ===\n');

    // First, find a delivered order with items
    const deliveredOrder = await pool.query(`
      SELECT 
        o.id as order_id,
        o.customer_id,
        c.user_id,
        oi.id as order_item_id,
        oi.product_id,
        p.name as product_name
      FROM "order" o
      JOIN customer c ON o.customer_id = c.id
      JOIN order_item oi ON o.id = oi.order_id
      JOIN product p ON oi.product_id = p.id
      WHERE o.status = 'delivered'
      LIMIT 1
    `);

    if (deliveredOrder.rows.length === 0) {
      console.log('No delivered orders found. Creating test data...');
      await createTestDeliveredOrder();
      return;
    }

    const testOrder = deliveredOrder.rows[0];
    console.log('Testing with delivered order:');
    console.log(`Order ${testOrder.order_id}, Customer ${testOrder.customer_id}, User ${testOrder.user_id}, Product ${testOrder.product_id} (${testOrder.product_name})`);

    // Check if rating already exists
    const existingRating = await pool.query(`
      SELECT * FROM ratings 
      WHERE user_id = $1 AND product_id = $2 AND order_item_id = $3
    `, [testOrder.user_id, testOrder.product_id, testOrder.order_item_id]);

    if (existingRating.rows.length > 0) {
      console.log('\n⚠️ Rating already exists for this combination');
      console.log(existingRating.rows[0]);
      return;
    }

    // Try to insert a rating
    try {
      const result = await pool.query(`
        INSERT INTO ratings (user_id, product_id, rating, review_text, order_id, order_item_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        testOrder.user_id,
        testOrder.product_id,
        4, // Use rating 4 (within 1-5 range)
        'Test rating from debug script',
        testOrder.order_id,
        testOrder.order_item_id
      ]);
      
      console.log('\n✅ Rating inserted successfully:');
      console.log(result.rows[0]);
      
    } catch (insertError) {
      console.log('\n❌ Rating insertion failed:');
      console.log('Error:', insertError.message);
      console.log('Detail:', insertError.detail);
      
      // Let's manually check the validation
      const validationCheck = await pool.query(`
        SELECT 
          o.id as order_id,
          oi.id as order_item_id,
          o.customer_id,
          c.user_id,
          oi.product_id,
          o.status,
          CASE 
            WHEN o.id = $1 AND oi.id = $2 AND c.user_id = $3 AND oi.product_id = $4 AND o.status = 'delivered'
            THEN 'VALID'
            ELSE 'INVALID'
          END as validation_result
        FROM "order" o
        JOIN customer c ON o.customer_id = c.id
        JOIN order_item oi ON o.id = oi.order_id
        WHERE o.id = $1 AND oi.id = $2 AND c.user_id = $3 AND oi.product_id = $4
      `, [
        testOrder.order_id,
        testOrder.order_item_id,
        testOrder.user_id,
        testOrder.product_id
      ]);
      
      console.log('\nManual Validation Check:');
      console.log(validationCheck.rows[0] || 'No matching record found');
    }

  } catch (error) {
    console.error('Test error:', error);
  } finally {
    pool.end();
  }
}

async function createTestDeliveredOrder() {
  try {
    console.log('Creating test delivered order...');
    
    // Get a random customer and product
    const customer = await pool.query('SELECT id FROM customer LIMIT 1');
    const product = await pool.query('SELECT id FROM product LIMIT 1');
    
    if (customer.rows.length === 0 || product.rows.length === 0) {
      console.log('Need customers and products to create test data');
      return;
    }
    
    // Create order
    const orderResult = await pool.query(`
      INSERT INTO "order" (customer_id, total_price, status, order_date, payment_status, payment_method, delivery_charge, shipping_address_id)
      VALUES ($1, 100.00, 'delivered', CURRENT_TIMESTAMP, true, 'test', 0, 1)
      RETURNING id
    `, [customer.rows[0].id]);
    
    // Create order item
    await pool.query(`
      INSERT INTO order_item (order_id, product_id, quantity, unit_price, total_price)
      VALUES ($1, $2, 1, 100.00, 100.00)
    `, [orderResult.rows[0].id, product.rows[0].id]);
    
    console.log(`Created test order ${orderResult.rows[0].id}`);
    
  } catch (error) {
    console.error('Error creating test data:', error);
  }
}

testRatingInsert();
