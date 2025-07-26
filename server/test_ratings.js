const axios = require('axios');

const API_BASE = 'http://127.0.0.1:54321/api';

async function testRatingsAPI() {
  console.log('🧪 Testing Ratings API...\n');
  
  try {
    // Test 1: Check if ratings endpoints are accessible (should get 401 unauthorized without token)
    console.log('1. Testing ratings endpoints accessibility...');
    
    try {
      await axios.get(`${API_BASE}/ratings/my-ratings`);
      console.log('   ❌ Expected 401 but got success');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('   ✅ Correctly returns 401 without authentication');
      } else {
        console.log(`   ⚠️  Got status ${error.response?.status}, expected 401`);
      }
    }
    
    // Test 2: Check categories with ratings still works
    console.log('\n2. Testing categories with ratings...');
    const categoriesResponse = await axios.get(`${API_BASE}/categories-with-ratings`);
    console.log(`   ✅ Categories with ratings: Found ${categoriesResponse.data.length} categories`);
    
    if (categoriesResponse.data.length > 0) {
      const topCategory = categoriesResponse.data[0];
      console.log(`   ✅ Top rated category: ${topCategory.name} (${topCategory.average_rating}/10 with ${topCategory.total_ratings} ratings)`);
    }
    
    // Test 3: Check products with ratings in a category
    console.log('\n3. Testing products with ratings...');
    const productsResponse = await axios.get(`${API_BASE}/categories/12/products?limit=3&sortBy=rating&sortOrder=DESC`);
    console.log(`   ✅ Products with ratings: Found ${productsResponse.data.products.length} products`);
    
    if (productsResponse.data.products.length > 0) {
      const topProduct = productsResponse.data.products[0];
      console.log(`   ✅ Top rated product: ${topProduct.name} (${topProduct.average_rating}/10 with ${topProduct.total_ratings} ratings)`);
    }
    
    // Test 4: Check filter options include rating sort
    console.log('\n4. Testing filter options...');
    const filtersResponse = await axios.get(`${API_BASE}/categories/12/filters`);
    const hasRatingSort = filtersResponse.data.sortOptions.some(option => option.value === 'rating');
    console.log(`   ${hasRatingSort ? '✅' : '❌'} Rating sort option available: ${hasRatingSort}`);
    
    console.log('\n🎉 All tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', error.response.data);
    }
  }
}

testRatingsAPI();
