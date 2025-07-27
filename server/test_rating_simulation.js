require('dotenv').config();
const pool = require('./db/connection');

async function simulateRatingSubmission() {
  try {
    console.log('=== SIMULATING RATING SUBMISSION ===\n');

    // Get a user and their ratable products
    const ratableQuery = await pool.query(`
      SELECT 
        user_id, 
        product_id, 
        product_name, 
        order_item_id, 
        order_id, 
        item_type
      FROM user_ratable_products 
      WHERE user_id = (
        SELECT user_id FROM user_ratable_products 
        WHERE item_type = 'build'
        LIMIT 1
      )
      AND item_type = 'build'
      LIMIT 1
    `);

    if (ratableQuery.rows.length === 0) {
      console.log('No build products available for testing');
      return;
    }

    const testProduct = ratableQuery.rows[0];
    console.log('Testing with build product:');
    console.log(`User: ${testProduct.user_id}`);
    console.log(`Product: ${testProduct.product_id} (${testProduct.product_name})`);
    console.log(`Order: ${testProduct.order_id}, Item: ${testProduct.order_item_id}`);
    console.log(`Type: ${testProduct.item_type}`);

    // Simulate the exact API call flow
    console.log('\n1. Testing API validation logic...');

    // Step 1: Check for existing rating
    const existingRating = await pool.query(`
      SELECT id FROM ratings 
      WHERE user_id = $1 AND product_id = $2 AND order_item_id = $3
    `, [testProduct.user_id, testProduct.product_id, testProduct.order_item_id]);

    if (existingRating.rows.length > 0) {
      console.log('   ⚠️ Rating already exists, cleaning it up for test...');
      await pool.query('DELETE FROM ratings WHERE id = $1', [existingRating.rows[0].id]);
    }

    // Step 2: Test the order verification (API logic)
    console.log('\n2. Testing order verification query...');
    const orderVerification = await pool.query(`
      SELECT 1 FROM (
        -- Check for direct product purchase
        SELECT 1 
        FROM "order" o
        JOIN order_item oi ON o.id = oi.order_id
        JOIN customer c ON o.customer_id = c.id
        WHERE o.id = $1 
          AND oi.id = $2
          AND c.user_id = $3
          AND oi.product_id = $4
          AND o.status = 'delivered'
        
        UNION
        
        -- Check for product from build purchase
        SELECT 1
        FROM "order" o
        JOIN order_item oi ON o.id = oi.order_id
        JOIN customer c ON o.customer_id = c.id
        JOIN build b ON oi.build_id = b.id
        JOIN build_product bp ON b.id = bp.build_id
        WHERE o.id = $1 
          AND oi.id = $2
          AND c.user_id = $3
          AND bp.product_id = $4
          AND o.status = 'delivered'
      ) AS verification
    `, [testProduct.order_id, testProduct.order_item_id, testProduct.user_id, testProduct.product_id]);

    if (orderVerification.rows.length === 0) {
      console.log('   ❌ Order verification failed - this would be rejected by API');
      
      // Debug the verification
      console.log('\n   Debugging verification failure...');
      
      // Check build path specifically
      const buildDebug = await pool.query(`
        SELECT 
          o.id as order_id,
          oi.id as order_item_id, 
          oi.build_id,
          c.user_id,
          bp.product_id,
          o.status
        FROM "order" o
        JOIN order_item oi ON o.id = oi.order_id
        JOIN customer c ON o.customer_id = c.id
        JOIN build b ON oi.build_id = b.id
        JOIN build_product bp ON b.id = bp.build_id
        WHERE o.id = $1 AND oi.id = $2 AND c.user_id = $3 AND bp.product_id = $4
      `, [testProduct.order_id, testProduct.order_item_id, testProduct.user_id, testProduct.product_id]);
      
      console.log('   Build debug result:', buildDebug.rows[0] || 'No match found');
      return;
    } else {
      console.log('   ✅ Order verification passed');
    }

    // Step 3: Test the actual insertion
    console.log('\n3. Testing rating insertion...');
    try {
      const insertResult = await pool.query(`
        INSERT INTO ratings (user_id, product_id, rating, review_text, order_id, order_item_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, rating, review_text, created_at
      `, [
        testProduct.user_id,
        testProduct.product_id, 
        4, 
        'Test build product rating via API simulation',
        testProduct.order_id,
        testProduct.order_item_id
      ]);

      console.log('   ✅ Rating insertion successful!');
      console.log('   Result:', insertResult.rows[0]);

    } catch (insertError) {
      console.log('   ❌ Rating insertion failed:', insertError.message);
      
      if (insertError.message.includes('Can only rate products from delivered orders')) {
        console.log('   This is the trigger validation failing');
      }
    }

    console.log('\n=== SIMULATION COMPLETE ===');
    console.log('\nIf this test passes, the API should work correctly.');
    console.log('If you\'re still having issues, please share:');
    console.log('1. The exact error message you see');
    console.log('2. The request payload you\'re sending');
    console.log('3. Which user/product you\'re trying to rate');

  } catch (error) {
    console.error('Simulation error:', error);
  } finally {
    pool.end();
  }
}

simulateRatingSubmission();
