require('dotenv').config();
const fs   = require('fs/promises');
const path = require('path');
const pool = require('../connection');
const { faker } = require('@faker-js/faker');

async function upsertCategory(name) {
  const res = await pool.query(
    'SELECT id FROM product_category WHERE name = $1',
    [name]
  );
  if (res.rows.length) return res.rows[0].id;

  const insert = await pool.query(
    `INSERT INTO product_category (name, description, image_url)
     VALUES ($1,$2,$3) RETURNING id`,
    [name, `${name} parts and accessories`, null]
  );
  return insert.rows[0].id;
}

async function seed() {
  const dir   = path.join(__dirname, 'json');
  const files = await fs.readdir(dir);

  for (const file of files) {
    if (!file.endsWith('.json')) continue;

    const rawName = path.basename(file, '.json');
    const categoryName = rawName
      .split(/[-_]/g)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    console.log(`\n➡ Processing category: ${categoryName}`);
    const categoryId = await upsertCategory(categoryName);

    let items;
    try {
      items = JSON.parse(await fs.readFile(path.join(dir, file), 'utf8'));
    } catch (err) {
      console.warn(`  • Skipping ${file}: invalid JSON`);
      continue;
    }

    console.log(`  • Seeding ${items.length} items…`);
    for (const item of items) {
      const { name, price: rawPrice, ...specs } = item; //some items have price as /gb, need to handle that and rerun
      if (!name) {
        console.warn(`    – Skipping item with missing name: ${JSON.stringify(item)}`);
        continue;
      }

      const price = rawPrice
        ? parseFloat(rawPrice.replace(/[^0-9.]/g, '')) || 0
        : 0;

      try {
        const prodRes = await pool.query(
          `INSERT INTO product
            (name, excerpt, image_url, price, category_id, specs)
           VALUES ($1,$2,$3,$4,$5,$6)
           RETURNING id`,
          [name, null, null, price, categoryId, specs]
        );
        const productId = prodRes.rows[0].id;

        await pool.query(
          `INSERT INTO product_attribute
            (product_id, cost, units_sold, stock)
           VALUES ($1,$2,$3,$4)`,
          [
            productId,
            +(price * 0.6).toFixed(2),
            faker.number.int({ min: 0, max: 100 }),
            faker.number.int({ min: 0, max: 50 })
          ]
        );
      } catch (err) {
        console.warn(`    – Failed to seed item "${name}": ${err.message}`);
        // continue with next item
      }
    }
  }

  console.log('\n✅ Seeding complete.');
  await pool.end();
}

seed().catch(err => {
  console.error('Fatal seeding error:', err);
  process.exit(1);
});