require('dotenv').config();
const axios = require('axios');
const pool = require('./db/connection');

async function testRatingAPI() {
  try {
    console.log('=== TESTING RATING API ENDPOINT ===\n');

    // First, let's get a valid user token - we'll need to create a test scenario
    // Get a user who has ratable products
    const ratableQuery = await pool.query(`
      SELECT DISTINCT 
        user_id, 
        product_id, 
        product_name, 
        order_item_id, 
        order_id, 
        item_type
      FROM user_ratable_products 
      WHERE user_id IN (
        SELECT user_id FROM user_ratable_products 
        GROUP BY user_id 
        HAVING COUNT(*) > 0
      )
      LIMIT 3
    `);

    if (ratableQuery.rows.length === 0) {
      console.log('No ratable products found');
      return;
    }

    console.log('Available ratable products:');
    ratableQuery.rows.forEach((product, index) => {
      console.log(`${index + 1}. User ${product.user_id.substring(0, 8)}... can rate Product ${product.product_id} (${product.product_name}) - ${product.item_type} from order ${product.order_id}, item ${product.order_item_id}`);
    });

    // Let's test the verification query directly first
    console.log('\n=== TESTING VERIFICATION QUERIES ===');
    
    for (const product of ratableQuery.rows) {
      console.log(`\nTesting ${product.item_type} product: ${product.product_name}`);
      
      // Test the new verification query
      const verificationResult = await pool.query(`
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
      `, [product.order_id, product.order_item_id, product.user_id, product.product_id]);

      if (verificationResult.rows.length > 0) {
        console.log(`   ✅ Verification passed for ${product.item_type} product`);
        
        // Try to insert the rating directly
        try {
          await pool.query(`
            INSERT INTO ratings (user_id, product_id, rating, review_text, order_id, order_item_id)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            product.user_id,
            product.product_id,
            3,
            `Test rating for ${product.item_type} product`,
            product.order_id,
            product.order_item_id
          ]);
          console.log(`   ✅ Rating insertion successful`);
        } catch (insertError) {
          if (insertError.message.includes('duplicate key')) {
            console.log(`   ⚠️ Rating already exists`);
          } else {
            console.log(`   ❌ Rating insertion failed: ${insertError.message}`);
          }
        }
      } else {
        console.log(`   ❌ Verification failed for ${product.item_type} product`);
        
        // Let's debug why it failed
        if (product.item_type === 'product') {
          const directCheck = await pool.query(`
            SELECT o.id, oi.id, c.user_id, oi.product_id, o.status
            FROM "order" o
            JOIN order_item oi ON o.id = oi.order_id
            JOIN customer c ON o.customer_id = c.id
            WHERE o.id = $1 AND oi.id = $2 AND c.user_id = $3 AND oi.product_id = $4
          `, [product.order_id, product.order_item_id, product.user_id, product.product_id]);
          console.log(`   Debug direct product:`, directCheck.rows[0] || 'No match');
        } else {
          const buildCheck = await pool.query(`
            SELECT o.id, oi.id, c.user_id, bp.product_id, o.status, oi.build_id, b.id as build_id_check
            FROM "order" o
            JOIN order_item oi ON o.id = oi.order_id
            JOIN customer c ON o.customer_id = c.id
            JOIN build b ON oi.build_id = b.id
            JOIN build_product bp ON b.id = bp.build_id
            WHERE o.id = $1 AND oi.id = $2 AND c.user_id = $3 AND bp.product_id = $4
          `, [product.order_id, product.order_item_id, product.user_id, product.product_id]);
          console.log(`   Debug build product:`, buildCheck.rows[0] || 'No match');
        }
      }
    }

    console.log('\n=== RATING API TEST COMPLETE ===');

  } catch (error) {
    console.error('Test error:', error);
  } finally {
    pool.end();
  }
}

testRatingAPI();
