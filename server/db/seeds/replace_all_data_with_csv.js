const fs = require('fs');
const csv = require('csv-parser');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  user: 'mufti',
  host: 'localhost',
  database: 'logicbuilders',
  password: 'mufti',
  port: 5432,
});

async function replaceAllDataWithCSV() {
  const client = await pool.connect();
  
  try {
    console.log('Starting complete data replacement process...');
    
    // Start transaction
    await client.query('BEGIN');
    
    // Show initial state
    const initialProductCount = await client.query('SELECT COUNT(*) as count FROM product');
    const initialCategoryCount = await client.query('SELECT COUNT(*) as count FROM product_category');
    console.log(`Initial products: ${initialProductCount.rows[0].count}`);
    console.log(`Initial categories: ${initialCategoryCount.rows[0].count}`);
    
    // Temporarily disable triggers
    await client.query('ALTER TABLE ratings DISABLE TRIGGER trg_validate_rating_eligibility');
    
    // Delete all related records first
    console.log('Clearing all related tables...');
    await client.query('TRUNCATE TABLE product_attribute CASCADE');
    await client.query('TRUNCATE TABLE template_product CASCADE');
    await client.query('TRUNCATE TABLE build_product CASCADE');
    await client.query('TRUNCATE TABLE cart_item CASCADE');
    await client.query('TRUNCATE TABLE product_qa CASCADE');
    await client.query('TRUNCATE TABLE review CASCADE');
    await client.query('TRUNCATE TABLE wishlist CASCADE');
    await client.query('TRUNCATE TABLE ratings CASCADE');
    await client.query('TRUNCATE TABLE order_item CASCADE');
    
    // Clear products table first (due to foreign key to categories)
    console.log('Clearing products table...');
    await client.query('TRUNCATE TABLE product RESTART IDENTITY CASCADE');
    
    // Clear categories table
    console.log('Clearing product_category table...');
    await client.query('TRUNCATE TABLE product_category RESTART IDENTITY CASCADE');
    
    // STEP 1: Load and insert categories
    console.log('Reading product_category CSV file...');
    const categories = [];
    
    await new Promise((resolve, reject) => {
      fs.createReadStream('/Users/muttakin/LogicBuilders/server/db/seeds/product_category_export.csv')
        .pipe(csv())
        .on('data', (row) => {
          // Add 2 to category id as requested
          const modifiedRow = {
            ...row,
            id: parseInt(row.id) + 2
          };
          categories.push(modifiedRow);
        })
        .on('end', resolve)
        .on('error', reject);
    });
    
    console.log(`Read ${categories.length} categories from CSV`);
    
    // Insert categories
    for (const category of categories) {
      const query = `
        INSERT INTO product_category (
          id, name, description, image_url, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `;
      
      const values = [
        category.id,
        category.name,
        category.description || '',
        category.image_url || null,
        category.created_at,
        category.updated_at
      ];
      
      await client.query(query, values);
    }
    
    // Update category sequence
    const maxCategoryId = await client.query('SELECT COALESCE(MAX(id), 0) as max_id FROM product_category');
    const nextCategorySeqVal = parseInt(maxCategoryId.rows[0].max_id) + 1;
    await client.query(`SELECT setval('product_category_id_seq', ${nextCategorySeqVal}, false)`);
    
    console.log(`Inserted ${categories.length} categories`);
    
    // STEP 2: Load and insert products
    console.log('Reading product CSV file...');
    const products = [];
    
    await new Promise((resolve, reject) => {
      fs.createReadStream('/Users/muttakin/LogicBuilders/server/db/seeds/product_table_export.csv')
        .pipe(csv())
        .on('data', (row) => {
          // Add 2 to category_id as requested
          const modifiedRow = {
            ...row,
            category_id: parseInt(row.category_id) + 2
          };
          products.push(modifiedRow);
        })
        .on('end', resolve)
        .on('error', reject);
    });
    
    console.log(`Read ${products.length} products from CSV`);
    
    // Insert products in batches
    const batchSize = 100;
    let insertedCount = 0;
    
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      
      for (const product of batch) {
        const query = `
          INSERT INTO product (
            id, name, excerpt, image_url, price, discount_status, 
            discount_percent, availability, date_added, category_id, 
            created_at, updated_at, specs
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `;
        
        const values = [
          parseInt(product.id),
          product.name,
          product.excerpt || '',
          product.image_url,
          parseFloat(product.price),
          product.discount_status === 't' || product.discount_status === 'true',
          parseFloat(product.discount_percent),
          product.availability === 't' || product.availability === 'true',
          product.date_added,
          product.category_id, // Already modified (+2)
          product.created_at,
          product.updated_at,
          product.specs || '{}'
        ];
        
        await client.query(query, values);
        insertedCount++;
      }
      
      console.log(`Inserted ${Math.min(i + batchSize, products.length)}/${products.length} products`);
    }
    
    // Update product sequence
    const maxProductId = await client.query('SELECT COALESCE(MAX(id), 0) as max_id FROM product');
    const nextProductSeqVal = parseInt(maxProductId.rows[0].max_id) + 1;
    await client.query(`SELECT setval('product_id_seq', ${nextProductSeqVal}, false)`);
    
    // Re-enable triggers
    await client.query('ALTER TABLE ratings ENABLE TRIGGER trg_validate_rating_eligibility');
    
    // Final verification
    const finalProductCount = await client.query('SELECT COUNT(*) as count FROM product');
    const finalCategoryCount = await client.query('SELECT COUNT(*) as count FROM product_category');
    const productWithImages = await client.query('SELECT COUNT(*) as count FROM product WHERE image_url IS NOT NULL');
    
    console.log('\n=== IMPORT COMPLETE ===');
    console.log(`Total categories imported: ${finalCategoryCount.rows[0].count}`);
    console.log(`Total products imported: ${finalProductCount.rows[0].count}`);
    console.log(`Products with images: ${productWithImages.rows[0].count}`);
    
    // Check category distribution
    const categoryDist = await client.query(`
      SELECT pc.id, pc.name, COUNT(p.id) as product_count 
      FROM product_category pc
      LEFT JOIN product p ON pc.id = p.category_id
      GROUP BY pc.id, pc.name 
      ORDER BY pc.id
    `);
    
    console.log('\nCategory distribution:');
    categoryDist.rows.forEach(row => {
      console.log(`${row.id}. ${row.name}: ${row.product_count} products`);
    });
    
    await client.query('COMMIT');
    console.log('\nTransaction committed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during import:', error);
    throw error;
  } finally {
    client.release();
  }
}

replaceAllDataWithCSV()
  .then(() => {
    console.log('Complete data replacement completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Data replacement failed:', error);
    process.exit(1);
  });
