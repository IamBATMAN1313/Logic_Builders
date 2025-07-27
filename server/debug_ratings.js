require('dotenv').config();
const pool = require('./db/connection');

async function debugRatings() {
  try {
    console.log('=== DEBUGGING RATINGS SYSTEM ===\n');

    // 1. Check if there are any orders
    const ordersResult = await pool.query(`
      SELECT COUNT(*) as total_orders, 
             COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_orders
      FROM "order"
    `);
    console.log('1. Orders Summary:', ordersResult.rows[0]);

    // 2. Check order structure and customer IDs
    const orderDetails = await pool.query(`
      SELECT id, customer_id, status, order_date, created_at
      FROM "order" 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    console.log('\n2. Recent Orders:');
    orderDetails.rows.forEach(order => {
      console.log(`   Order ${order.id}: Customer ${order.customer_id}, Status: ${order.status}`);
    });

    // 3. Check order_item structure
    const orderItems = await pool.query(`
      SELECT oi.id, oi.order_id, oi.product_id, oi.quantity, o.status, o.customer_id
      FROM order_item oi
      JOIN "order" o ON oi.order_id = o.id
      ORDER BY oi.id DESC 
      LIMIT 5
    `);
    console.log('\n3. Recent Order Items:');
    orderItems.rows.forEach(item => {
      console.log(`   Item ${item.id}: Order ${item.order_id}, Product ${item.product_id}, Customer ${item.customer_id}, Status: ${item.status}`);
    });

    // 4. Check general_user vs customer relationship
    const userCustomerCheck = await pool.query(`
      SELECT 
        COUNT(DISTINCT gu.id) as total_general_users,
        COUNT(DISTINCT c.id) as total_customers,
        COUNT(DISTINCT o.customer_id) as unique_order_customers
      FROM general_user gu
      FULL OUTER JOIN customer c ON gu.id = c.user_id
      FULL OUTER JOIN "order" o ON c.id = o.customer_id
    `);
    console.log('\n4. User/Customer/Order Relationship:');
    console.log(userCustomerCheck.rows[0]);

    // 5. Check for delivered orders with items
    const deliveredOrders = await pool.query(`
      SELECT 
        o.id as order_id,
        o.customer_id,
        o.status,
        oi.id as order_item_id,
        oi.product_id,
        p.name as product_name
      FROM "order" o
      JOIN order_item oi ON o.id = oi.order_id
      JOIN product p ON oi.product_id = p.id
      WHERE o.status = 'delivered'
      ORDER BY o.created_at DESC
      LIMIT 10
    `);
    console.log('\n5. Delivered Orders with Items:');
    deliveredOrders.rows.forEach(order => {
      console.log(`   Order ${order.order_id} (Customer ${order.customer_id}): Item ${order.order_item_id}, Product ${order.product_id} (${order.product_name})`);
    });

    // 6. Check if there are any builds in orders
    const buildOrders = await pool.query(`
      SELECT 
        o.id as order_id,
        o.customer_id,
        o.status,
        COUNT(oi.id) as item_count,
        STRING_AGG(p.name, ', ') as products
      FROM "order" o
      JOIN order_item oi ON o.id = oi.order_id
      JOIN product p ON oi.product_id = p.id
      GROUP BY o.id, o.customer_id, o.status
      HAVING COUNT(oi.id) > 1
      ORDER BY o.created_at DESC
      LIMIT 5
    `);
    console.log('\n6. Multi-Item Orders (Potential Builds):');
    buildOrders.rows.forEach(order => {
      console.log(`   Order ${order.order_id} (Customer ${order.customer_id}): ${order.item_count} items, Status: ${order.status}`);
      console.log(`   Products: ${order.products}`);
    });

    // 7. Check existing ratings
    const existingRatings = await pool.query(`
      SELECT COUNT(*) as total_ratings,
             COUNT(DISTINCT user_id) as unique_users,
             COUNT(DISTINCT product_id) as unique_products
      FROM ratings
    `);
    console.log('\n7. Existing Ratings:', existingRatings.rows[0]);

    // 8. Test the view for ratable products
    const ratableProducts = await pool.query(`
      SELECT * FROM user_ratable_products LIMIT 5
    `);
    console.log('\n8. Ratable Products (from view):');
    if (ratableProducts.rows.length > 0) {
      ratableProducts.rows.forEach(item => {
        console.log(`   User ${item.user_id}: Product ${item.product_id} (${item.product_name}), Order ${item.order_id}`);
      });
    } else {
      console.log('   No ratable products found');
    }

    // 9. Check customer table structure and relationship
    const customerCheck = await pool.query(`
      SELECT 
        c.id as customer_id,
        c.user_id,
        gu.username,
        COUNT(o.id) as order_count
      FROM customer c
      JOIN general_user gu ON c.user_id = gu.id
      LEFT JOIN "order" o ON c.id = o.customer_id
      GROUP BY c.id, c.user_id, gu.username
      ORDER BY order_count DESC
      LIMIT 5
    `);
    console.log('\n9. Customer-User Relationship:');
    customerCheck.rows.forEach(customer => {
      console.log(`   Customer ${customer.customer_id} -> User ${customer.user_id} (${customer.username}): ${customer.order_count} orders`);
    });

  } catch (error) {
    console.error('Debug error:', error);
  } finally {
    pool.end();
  }
}

debugRatings();
