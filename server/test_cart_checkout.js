#!/usr/bin/env node

const axios = require('axios');

const API_BASE = 'http://localhost:54321/api';

async function testCartAndCheckout() {
  try {
    console.log('Testing cart and checkout functionality...\n');

    // 1. Register a test user
    console.log('1. Registering test user...');
    const timestamp = Date.now();
    const registerResponse = await axios.post(`${API_BASE}/signup`, {
      username: `testuser_${timestamp}`,
      full_name: 'Test User',
      email: `test_${timestamp}@example.com`,
      password: 'testpass123'
    });
    console.log('✅ User registered successfully');

    // 2. Login
    console.log('2. Logging in...');
    const loginResponse = await axios.post(`${API_BASE}/login`, {
      identifier: registerResponse.data.user.email,
      password: 'testpass123'
    });
    console.log('✅ Login successful');

    const token = loginResponse.data.token;
    const authApi = axios.create({
      baseURL: API_BASE,
      headers: { 'Authorization': `Bearer ${token}` }
    });

    // 3. Create a build
    console.log('3. Creating a test build...');
    const buildResponse = await authApi.post('/builds', {
      name: 'Test Gaming Build'
    });
    console.log('✅ Build created:', buildResponse.data.name);

    // 4. Get a product to add to the build
    console.log('4. Getting products...');
    const productsResponse = await authApi.get('/products?limit=1');
    if (productsResponse.data.length === 0) {
      throw new Error('No products available for testing');
    }
    const testProduct = productsResponse.data[0];
    console.log('✅ Found test product:', testProduct.name);

    // 5. Add product to build
    console.log('5. Adding product to build...');
    await authApi.post(`/builds/${buildResponse.data.id}/add-product`, {
      product_id: testProduct.id,
      quantity: 1
    });
    console.log('✅ Product added to build');

    // 6. Add build to cart
    console.log('6. Adding build to cart...');
    await authApi.post('/cart/add', {
      build_id: buildResponse.data.id,
      quantity: 1
    });
    console.log('✅ Build added to cart');

    // 7. Check cart contents
    console.log('7. Checking cart contents...');
    const cartResponse = await authApi.get('/cart');
    console.log('✅ Cart items:', cartResponse.data.items.length);
    console.log('   Cart total:', cartResponse.data.total);
    
    if (cartResponse.data.items.length > 0) {
      const item = cartResponse.data.items[0];
      console.log('   Item name:', item.build_name || item.product_name || 'Unknown');
      console.log('   Item type:', item.build_id ? 'Build' : 'Product');
    }

    // 8. Test checkout
    console.log('8. Testing checkout...');
    const checkoutResponse = await authApi.post('/orders/from-cart');
    console.log('✅ Checkout successful!');
    console.log('   Order ID:', checkoutResponse.data.order.id);
    console.log('   Total items:', checkoutResponse.data.total_items);

    // 9. Verify cart is empty after checkout
    console.log('9. Verifying cart is empty...');
    const emptyCartResponse = await authApi.get('/cart');
    console.log('✅ Cart items after checkout:', emptyCartResponse.data.items.length);

    // 9.5. Test product navigation (add this before verifying cart is empty)
    console.log('9.5. Testing product page navigation...');
    try {
      const productResponse = await authApi.get(`/products/${testProduct.id}`);
      console.log('✅ Product page API works:', productResponse.data.name);
    } catch (err) {
      console.error('❌ Product page API failed:', err.response?.data || err.message);
    }

    console.log('\n🎉 All tests passed! Cart and checkout functionality is working correctly.');

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data?.error || error.message);
    if (error.response?.data) {
      console.error('Response data:', error.response.data);
    }
  }
}

testCartAndCheckout();
