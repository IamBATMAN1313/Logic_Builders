#!/usr/bin/env node

const axios = require('axios');

const API_BASE = 'http://localhost:54321/api';

async function testProductNavigation() {
  try {
    console.log('Testing product navigation from cart...\n');

    // 1. Register and login
    const timestamp = Date.now();
    const registerResponse = await axios.post(`${API_BASE}/signup`, {
      username: `testuser_${timestamp}`,
      full_name: 'Test User',
      email: `test_${timestamp}@example.com`,
      password: 'testpass123'
    });

    const loginResponse = await axios.post(`${API_BASE}/login`, {
      identifier: registerResponse.data.user.email,
      password: 'testpass123'
    });

    const token = loginResponse.data.token;
    const authApi = axios.create({
      baseURL: API_BASE,
      headers: { 'Authorization': `Bearer ${token}` }
    });

    // 2. Get a product
    const productsResponse = await authApi.get('/products?limit=1');
    const testProduct = productsResponse.data[0];
    console.log('✅ Found test product:', testProduct.name, 'ID:', testProduct.id);

    // 3. Add product directly to cart
    await authApi.post('/cart/add', {
      product_id: testProduct.id,
      quantity: 1
    });
    console.log('✅ Product added to cart');

    // 4. Check cart contents
    const cartResponse = await authApi.get('/cart');
    console.log('✅ Cart items:', cartResponse.data.items.length);
    
    if (cartResponse.data.items.length > 0) {
      const item = cartResponse.data.items[0];
      console.log('   Item name:', item.product_name || 'Unknown');
      console.log('   Item type:', item.product_id ? 'Product' : 'Build');
      console.log('   Product ID:', item.product_id);
    }

    // 5. Test direct product API access
    console.log('5. Testing direct product API access...');
    const productResponse = await authApi.get(`/products/${testProduct.id}`);
    console.log('✅ Product API response:', productResponse.data.name);

    console.log('\n✅ Product navigation test completed!');
    console.log('When you click on the product in cart, it should navigate to: /product/' + testProduct.id);

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data?.error || error.message);
  }
}

testProductNavigation();
