// Test cart and builds with authentication
const axios = require('axios');

const API_BASE = 'http://localhost:54321/api';

async function testCartAndBuilds() {
  console.log('🧪 Testing Cart and Builds with Authentication...\n');
  
  try {
    // 1. First, try to login to get a token
    console.log('1. Testing login...');
    let loginResponse;
    try {
      loginResponse = await axios.post(`${API_BASE}/login`, {
        identifier: 'alice',
        password: 'password' // This might not be the correct password
      });
      console.log('   ✅ Login successful');
    } catch (loginError) {
      console.log('   ❌ Login failed, let\'s check what users exist...');
      
      // Check what users exist and their passwords (for testing)
      console.log('   Checking available users...');
      
      // Try a different approach - check if we can create a test user
      try {
        const signupResponse = await axios.post(`${API_BASE}/signup`, {
          username: 'testuser2',
          email: 'test2@example.com',
          password: 'testpassword',
          full_name: 'Test User 2',
          contact_no: '1234567890',
          gender: 'M'
        });
        console.log('   ✅ Created test user');
        
        // Now login with the test user
        loginResponse = await axios.post(`${API_BASE}/login`, {
          identifier: 'testuser2',
          password: 'testpassword'
        });
        console.log('   ✅ Login successful with test user');
      } catch (signupError) {
        console.log('   ❌ Could not create test user:', signupError.response?.data || signupError.message);
        
        // Try to login with existing testuser
        try {
          loginResponse = await axios.post(`${API_BASE}/login`, {
            identifier: 'testuser',
            password: 'testpassword'
          });
          console.log('   ✅ Login successful with existing test user');
        } catch (existingLoginError) {
          console.log('   ❌ Could not login with existing user:', existingLoginError.response?.data || existingLoginError.message);
          return;
        }
      }
    }
    
    const token = loginResponse.data.token;
    console.log(`   Token: ${token.substring(0, 20)}...`);
    
    // Set up axios instance with auth
    const authApi = axios.create({
      baseURL: API_BASE,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log();
    
    // 2. Test cart endpoints
    console.log('2. Testing cart endpoints...');
    
    try {
      const cartResponse = await authApi.get('/cart');
      console.log('   ✅ Get cart successful');
      console.log(`   Cart items: ${cartResponse.data.items?.length || 0}`);
    } catch (cartError) {
      console.log('   ❌ Get cart failed:', cartError.response?.data || cartError.message);
    }
    
    try {
      const addToCartResponse = await authApi.post('/cart/add', {
        product_id: 1605,
        quantity: 1
      });
      console.log('   ✅ Add to cart successful');
    } catch (addCartError) {
      console.log('   ❌ Add to cart failed:', addCartError.response?.data || addCartError.message);
    }
    
    console.log();
    
    // 3. Test builds endpoints
    console.log('3. Testing builds endpoints...');
    
    try {
      const buildsResponse = await authApi.get('/builds');
      console.log('   ✅ Get builds successful');
      console.log(`   Builds: ${buildsResponse.data?.length || 0}`);
    } catch (buildsError) {
      console.log('   ❌ Get builds failed:', buildsError.response?.data || buildsError.message);
    }
    
    try {
      const createBuildResponse = await authApi.post('/builds', {
        name: 'Test Build',
        description: 'Test build for debugging'
      });
      console.log('   ✅ Create build successful');
      const buildId = createBuildResponse.data.id;
      
      // Try to add product to build
      try {
        const addToBuildResponse = await authApi.post(`/builds/${buildId}/add-product`, {
          product_id: 1605,
          quantity: 1
        });
        console.log('   ✅ Add to build successful');
      } catch (addBuildError) {
        console.log('   ❌ Add to build failed:', addBuildError.response?.data || addBuildError.message);
      }
      
    } catch (createBuildError) {
      console.log('   ❌ Create build failed:', createBuildError.response?.data || createBuildError.message);
    }
    
    console.log('\n🎉 Authentication test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }
}

// Run the test
testCartAndBuilds();
