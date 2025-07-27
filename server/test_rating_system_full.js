require('dotenv').config();
const pool = require('./db/connection');

async function testRatingSystemFull() {
  try {
    console.log('=== FULL RATING SYSTEM TEST ===\n');

    // 1. Test the user_ratable_products view
    console.log('1. Testing user_ratable_products view:');
    const ratableProducts = await pool.query(`
      SELECT user_id, product_id, product_name, item_type, order_id, order_item_id 
      FROM user_ratable_products 
      LIMIT 10
    `);
    
    console.log(`Found ${ratableProducts.rows.length} ratable products:`);
    ratableProducts.rows.forEach(product => {
      console.log(`   User ${product.user_id.substring(0, 8)}...: Product ${product.product_id} (${product.product_name}) - ${product.item_type}`);
    });

    // 2. Test rating insertion for a direct product
    console.log('\n2. Testing rating insertion for direct product:');
    const directProduct = ratableProducts.rows.find(p => p.item_type === 'product');
    if (directProduct) {
      try {
        await pool.query(`
          INSERT INTO ratings (user_id, product_id, rating, review_text, order_id, order_item_id)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          directProduct.user_id,
          directProduct.product_id,
          5,
          'Test direct product rating',
          directProduct.order_id,
          directProduct.order_item_id
        ]);
        console.log(`   ✅ Successfully rated direct product ${directProduct.product_id} (${directProduct.product_name})`);
      } catch (error) {
        if (error.message.includes('duplicate key')) {
          console.log(`   ⚠️ Rating already exists for product ${directProduct.product_id}`);
        } else {
          console.log(`   ❌ Failed: ${error.message}`);
        }
      }
    } else {
      console.log('   No direct products available for testing');
    }

    // 3. Test rating insertion for a build product
    console.log('\n3. Testing rating insertion for build product:');
    const buildProduct = ratableProducts.rows.find(p => p.item_type === 'build');
    if (buildProduct) {
      try {
        await pool.query(`
          INSERT INTO ratings (user_id, product_id, rating, review_text, order_id, order_item_id)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          buildProduct.user_id,
          buildProduct.product_id,
          4,
          'Test build product rating',
          buildProduct.order_id,
          buildProduct.order_item_id
        ]);
        console.log(`   ✅ Successfully rated build product ${buildProduct.product_id} (${buildProduct.product_name})`);
      } catch (error) {
        if (error.message.includes('duplicate key')) {
          console.log(`   ⚠️ Rating already exists for product ${buildProduct.product_id}`);
        } else {
          console.log(`   ❌ Failed: ${error.message}`);
        }
      }
    } else {
      console.log('   No build products available for testing');
    }

    // 4. Check total ratings created
    const totalRatings = await pool.query('SELECT COUNT(*) as total FROM ratings');
    console.log(`\n4. Total ratings in database: ${totalRatings.rows[0].total}`);

    // 5. Test product ratings summary
    const ratingSummary = await pool.query(`
      SELECT * FROM product_ratings_summary 
      WHERE total_ratings > 0 
      ORDER BY average_rating DESC 
      LIMIT 5
    `);
    console.log('\n5. Top rated products:');
    ratingSummary.rows.forEach(product => {
      console.log(`   ${product.product_name}: ${product.average_rating}/5 (${product.total_ratings} ratings)`);
    });

    // 6. Check remaining ratable products after our tests
    const remainingRatable = await pool.query(`
      SELECT COUNT(*) as remaining, item_type 
      FROM user_ratable_products 
      GROUP BY item_type
    `);
    console.log('\n6. Remaining ratable products by type:');
    remainingRatable.rows.forEach(row => {
      console.log(`   ${row.item_type}: ${row.remaining} products`);
    });

    console.log('\n=== RATING SYSTEM TEST COMPLETE ===');

  } catch (error) {
    console.error('Test error:', error);
  } finally {
    pool.end();
  }
}

testRatingSystemFull();
