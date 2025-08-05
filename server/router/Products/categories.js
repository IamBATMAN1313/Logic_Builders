const express = require('express');
const router = express.Router();
const pool = require('../../db/connection');

// Get all categories
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, description, image_url 
       FROM product_category 
       ORDER BY id`
    );
    res.json(rows);
  } catch (err) {
    console.error('Categories fetch error:', err.message);
    console.error('Error details:', err);
    res.status(500).json({ 
      error: 'Failed to fetch categories',
      details: err.message 
    });
  }
});

// Get category by ID with product count
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get category details
    const categoryResult = await pool.query(
      `SELECT id, name, description, image_url 
       FROM product_category 
       WHERE id = $1`,
      [id]
    );
    
    if (!categoryResult.rows.length) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Get product count for this category
    const countResult = await pool.query(
      `SELECT COUNT(*) as product_count 
       FROM product 
       WHERE category_id = $1 AND availability = true`,
      [id]
    );
    
    const category = categoryResult.rows[0];
    category.product_count = parseInt(countResult.rows[0].product_count);
    
    res.json(category);
  } catch (err) {
    console.error('Category fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

// Get products by category with filters
router.get('/:id/products', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      page = 1, 
      limit = 12, 
      minPrice, 
      maxPrice, 
      availability = 'true',
      sortBy = 'date_added',
      sortOrder = 'DESC',
      ...specFilters 
    } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Build dynamic WHERE clause
    let whereConditions = ['category_id = $1'];
    let queryParams = [id];
    let paramIndex = 2;
    
    // Availability filter
    if (availability !== 'all') {
      whereConditions.push(`availability = $${paramIndex}`);
      queryParams.push(availability === 'true');
      paramIndex++;
    }
    
    // Price filters - consider discounted prices
    if (minPrice && !isNaN(minPrice)) {
      whereConditions.push(`
        CASE 
          WHEN discount_status = true AND discount_percent > 0 
          THEN price * (1 - discount_percent / 100.0)
          ELSE price 
        END >= $${paramIndex}
      `);
      queryParams.push(parseFloat(minPrice));
      paramIndex++;
    }
    
    if (maxPrice && !isNaN(maxPrice)) {
      whereConditions.push(`
        CASE 
          WHEN discount_status = true AND discount_percent > 0 
          THEN price * (1 - discount_percent / 100.0)
          ELSE price 
        END <= $${paramIndex}
      `);
      queryParams.push(parseFloat(maxPrice));
      paramIndex++;
    }
    
    // Specs filters - dynamically build JSON queries
    const specConditions = [];
    Object.keys(specFilters).forEach(key => {
      if (key.startsWith('spec_') && specFilters[key]) {
        const specKey = key.replace('spec_', '');
        specConditions.push(`specs->>'${specKey}' ILIKE $${paramIndex}`);
        queryParams.push(`%${specFilters[key]}%`);
        paramIndex++;
      }
    });
    
    if (specConditions.length > 0) {
      whereConditions.push(`(${specConditions.join(' OR ')})`);
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    // Validate sort options
    const validSortFields = ['date_added', 'price', 'name', 'rating'];
    const validSortOrders = ['ASC', 'DESC'];
    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'date_added';
    const finalSortOrder = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM product p
      LEFT JOIN ratings r ON p.id = r.product_id 
      WHERE ${whereClause}
    `;
    const countResult = await pool.query(countQuery, queryParams);
    
    // Get products with ratings
    const sortColumn = finalSortBy === 'rating' ? 'COALESCE(AVG(r.rating), 0)' : `p.${finalSortBy}`;
    const productsQuery = `
      SELECT 
        p.id, 
        p.name, 
        p.excerpt, 
        p.image_url, 
        p.price, 
        p.discount_status, 
        p.discount_percent, 
        p.specs, 
        p.availability,
        COALESCE(ROUND(AVG(r.rating::NUMERIC), 1), 0) as average_rating,
        COUNT(r.rating) as total_ratings
      FROM product p
      LEFT JOIN ratings r ON p.id = r.product_id
      WHERE ${whereClause}
      GROUP BY p.id, p.name, p.excerpt, p.image_url, p.price, p.discount_status, p.discount_percent, p.specs, p.availability, p.date_added
      ORDER BY ${sortColumn} ${finalSortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParams.push(parseInt(limit), offset);
    const { rows } = await pool.query(productsQuery, queryParams);
    
    // Convert numeric values to proper types
    const productsWithRatings = rows.map(product => ({
      ...product,
      average_rating: parseFloat(product.average_rating) || 0,
      total_ratings: parseInt(product.total_ratings) || 0
    }));
    
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / parseInt(limit));
    
    res.json({
      products: productsWithRatings,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (err) {
    console.error('Category products fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch category products' });
  }
});

// Get filter options for a category
router.get('/:id/filters', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get price range - consider discounted prices
    const priceRange = await pool.query(
      `SELECT 
        MIN(
          CASE 
            WHEN discount_status = true AND discount_percent > 0 
            THEN price * (1 - discount_percent / 100.0)
            ELSE price 
          END
        ) as min_price, 
        MAX(
          CASE 
            WHEN discount_status = true AND discount_percent > 0 
            THEN price * (1 - discount_percent / 100.0)
            ELSE price 
          END
        ) as max_price 
       FROM product 
       WHERE category_id = $1 AND availability = true`,
      [id]
    );
    
    // Get all unique spec keys and values for this category
    const specsQuery = await pool.query(
      `SELECT specs 
       FROM product 
       WHERE category_id = $1 AND availability = true AND specs IS NOT NULL`,
      [id]
    );
    
    // Process specs to extract unique keys and their possible values
    const specOptions = {};
    specsQuery.rows.forEach(row => {
      if (row.specs) {
        Object.keys(row.specs).forEach(key => {
          if (!specOptions[key]) {
            specOptions[key] = new Set();
          }
          const value = row.specs[key];
          if (value !== null && value !== undefined && value !== '') {
            specOptions[key].add(String(value));
          }
        });
      }
    });
    
    // Convert sets to sorted arrays
    const processedSpecs = {};
    Object.keys(specOptions).forEach(key => {
      processedSpecs[key] = Array.from(specOptions[key]).sort();
    });
    
    res.json({
      priceRange: {
        min: parseFloat(priceRange.rows[0].min_price) || 0,
        max: parseFloat(priceRange.rows[0].max_price) || 1000
      },
      specs: processedSpecs,
      availabilityOptions: [
        { value: 'true', label: 'In Stock' },
        { value: 'false', label: 'Out of Stock' },
        { value: 'all', label: 'All' }
      ],
      sortOptions: [
        { value: 'date_added', label: 'Newest First' },
        { value: 'price', label: 'Price' },
        { value: 'name', label: 'Name' },
        { value: 'rating', label: 'Highest Rated' }
      ]
    });
  } catch (err) {
    console.error('Filter options fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch filter options' });
  }
});

module.exports = router;
