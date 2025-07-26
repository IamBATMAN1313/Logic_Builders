const pool = require('./server/db/connection');
const fs = require('fs');

async function synchronizeDatabase() {
  try {
    console.log('🔄 SYNCHRONIZING DATABASE WITH SCHEMA.TXT...\n');
    
    // Get current tables
    const currentTablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const currentTables = currentTablesResult.rows.map(r => r.table_name);
    console.log('📊 Current database tables:', currentTables);
    
    // Tables that should exist according to schema.txt
    const schemaTables = [
      'general_user', 'access_levels', 'admin_users', 'admin_signup_requests', 
      'admin', 'customer', 'product_category', 'product', 'product_attribute',
      'template', 'template_product', 'build', 'build_product', 'cart', 
      'cart_item', 'shipping_address', 'promo', 'order', 'order_item',
      'product_qa', 'qa_answer', 'review', 'wishlist', 'message', 
      'notification', 'admin_notification', 'admin_action_log', 'product_view_log'
    ];
    
    console.log('📋 Schema tables:', schemaTables);
    
    // Tables in database but not in schema (new tables to add to schema)
    const newTables = currentTables.filter(t => !schemaTables.includes(t));
    console.log('🆕 NEW TABLES (need to add to schema.txt):', newTables);
    
    // Tables in schema but not in database (missing tables to create)
    const missingTables = schemaTables.filter(t => !currentTables.includes(t));
    console.log('❌ MISSING TABLES (need to create):', missingTables);
    
    // Handle the ratings vs review table conflict
    if (currentTables.includes('ratings') && !currentTables.includes('review')) {
      console.log('\n⚠️  CONFLICT: Database has "ratings" table, schema has "review" table');
      console.log('Decision: Keeping current "ratings" table structure and adding to schema');
      
      // Get ratings table structure
      const ratingsStructure = await pool.query(`
        SELECT 
          column_name, 
          data_type, 
          character_maximum_length,
          is_nullable, 
          column_default,
          numeric_precision,
          numeric_scale
        FROM information_schema.columns 
        WHERE table_name = 'ratings'
        ORDER BY ordinal_position
      `);
      
      console.log('📋 Ratings table structure:');
      ratingsStructure.rows.forEach(col => {
        let type = col.data_type;
        if (col.character_maximum_length) {
          type += `(${col.character_maximum_length})`;
        } else if (col.numeric_precision && col.numeric_scale) {
          type += `(${col.numeric_precision},${col.numeric_scale})`;
        }
        console.log(`  ${col.column_name}: ${type} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });
    }
    
    // Add missing tables to database
    if (missingTables.length > 0) {
      console.log('\n🔨 CREATING MISSING TABLES...');
      
      // We'll need to create these tables manually since we can't parse the full schema file
      console.log('Note: These tables need to be created manually based on schema.txt');
      missingTables.forEach(table => {
        console.log(`  - ${table}`);
      });
    }
    
    // Update existing tables that have structural differences
    console.log('\n🔧 CHECKING TABLE STRUCTURES...');
    
    // Check promo table structure (we know this was recently fixed)
    const promoColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'promo'
      ORDER BY ordinal_position
    `);
    
    const promoColumnNames = promoColumns.rows.map(r => r.column_name);
    const expectedPromoColumns = ['id', 'name', 'code', 'discount_percent', 'status', 'start_date', 'end_date', 'usage_limit', 'usage_count', 'created_at', 'updated_at'];
    
    console.log('📋 Promo table columns:', promoColumnNames);
    console.log('📋 Expected promo columns:', expectedPromoColumns);
    
    const missingPromoColumns = expectedPromoColumns.filter(col => !promoColumnNames.includes(col));
    if (missingPromoColumns.length > 0) {
      console.log('❌ Missing promo columns:', missingPromoColumns);
    } else {
      console.log('✅ Promo table structure is correct');
    }
    
    // Check admin_users table structure
    const adminUsersColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'admin_users'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Admin_users table structure:');
    adminUsersColumns.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // Generate schema additions for new tables
    if (newTables.length > 0) {
      console.log('\n📝 GENERATING SCHEMA ADDITIONS...');
      let schemaAdditions = '\\n-- ============================================================================\\n';
      schemaAdditions += '-- ADDITIONAL TABLES (found in database but not in original schema)\\n';
      schemaAdditions += '-- ============================================================================\\n\\n';
      
      for (const tableName of newTables) {
        schemaAdditions += `-- ${tableName} table\\n`;
        
        // Get table structure
        const tableStructure = await pool.query(`
          SELECT 
            column_name, 
            data_type, 
            character_maximum_length,
            is_nullable, 
            column_default,
            numeric_precision,
            numeric_scale
          FROM information_schema.columns 
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [tableName]);
        
        schemaAdditions += `CREATE TABLE ${tableName} (\\n`;
        
        tableStructure.rows.forEach((col, index) => {
          let type = col.data_type.toUpperCase();
          if (col.character_maximum_length) {
            type += `(${col.character_maximum_length})`;
          } else if (col.numeric_precision && col.numeric_scale !== null) {
            type += `(${col.numeric_precision},${col.numeric_scale})`;
          }
          
          const nullable = col.is_nullable === 'YES' ? '' : ' NOT NULL';
          const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
          const comma = index < tableStructure.rows.length - 1 ? ',' : '';
          
          schemaAdditions += `  ${col.column_name.padEnd(20)} ${type}${nullable}${defaultVal}${comma}\\n`;
        });
        
        schemaAdditions += `);\\n\\n`;
        
        // Get constraints
        const constraints = await pool.query(`
          SELECT 
            tc.constraint_name,
            tc.constraint_type,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM information_schema.table_constraints tc
          LEFT JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
          LEFT JOIN information_schema.constraint_column_usage ccu 
            ON tc.constraint_name = ccu.constraint_name
          WHERE tc.table_name = $1
          ORDER BY tc.constraint_type
        `, [tableName]);
        
        constraints.rows.forEach(constraint => {
          if (constraint.constraint_type === 'PRIMARY KEY') {
            schemaAdditions += `ALTER TABLE ${tableName} ADD PRIMARY KEY (${constraint.column_name});\\n`;
          } else if (constraint.constraint_type === 'FOREIGN KEY') {
            schemaAdditions += `ALTER TABLE ${tableName} ADD FOREIGN KEY (${constraint.column_name}) REFERENCES ${constraint.foreign_table_name}(${constraint.foreign_column_name});\\n`;
          } else if (constraint.constraint_type === 'UNIQUE') {
            schemaAdditions += `ALTER TABLE ${tableName} ADD UNIQUE (${constraint.column_name});\\n`;
          }
        });
        
        schemaAdditions += '\\n';
      }
      
      console.log('\\n📄 SCHEMA ADDITIONS TO ADD TO schema.txt:');
      console.log(schemaAdditions);
      
      // Write to a file
      fs.writeFileSync('schema_additions.sql', schemaAdditions.replace(/\\\\n/g, '\\n'));
      console.log('💾 Schema additions written to schema_additions.sql');
    }
    
    console.log('\\n✅ DATABASE SYNCHRONIZATION ANALYSIS COMPLETE');
    console.log('\\n📋 SUMMARY:');
    console.log(`  - Current tables: ${currentTables.length}`);
    console.log(`  - Schema tables: ${schemaTables.length}`);
    console.log(`  - New tables to add to schema: ${newTables.length}`);
    console.log(`  - Missing tables to create: ${missingTables.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  process.exit(0);
}

synchronizeDatabase();
