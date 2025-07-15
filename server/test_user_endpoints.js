const axios = require('axios');

const BASE_URL = 'http://localhost:54321';

async function testUserEndpoints() {
    console.log('🛒 Testing User-facing Endpoints...\n');
    
    // First get a valid user token
    let userToken = null;
    
    try {
        console.log('=== Getting User Token ===');
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
            identifier: 'authtest@test.com',
            password: 'testpass123'
        });
        userToken = loginResponse.data.token;
        console.log('✅ User login successful');
        
    } catch (error) {
        console.log('❌ User login failed:', error.response?.data);
        return;
    }
    
    const headers = {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
    };
    
    // Test Cart endpoints
    console.log('\n=== Testing Cart Endpoints ===');
    try {
        const cartResponse = await axios.get(`${BASE_URL}/api/cart`, { headers });
        console.log('✅ Cart fetch success:', cartResponse.status);
        console.log('Cart items:', cartResponse.data.items?.length || 0);
    } catch (error) {
        console.log('❌ Cart error:', error.response?.status, error.response?.data);
    }
    
    // Test Orders endpoints
    console.log('\n=== Testing Orders Endpoints ===');
    try {
        const ordersResponse = await axios.get(`${BASE_URL}/api/orders`, { headers });
        console.log('✅ Orders fetch success:', ordersResponse.status);
        console.log('Orders count:', ordersResponse.data?.length || 0);
    } catch (error) {
        console.log('❌ Orders error:', error.response?.status, error.response?.data);
    }
    
    // Test Builds endpoints
    console.log('\n=== Testing PC Builds Endpoints ===');
    try {
        const buildsResponse = await axios.get(`${BASE_URL}/api/builds`, { headers });
        console.log('✅ Builds fetch success:', buildsResponse.status);
        console.log('Builds count:', buildsResponse.data?.length || 0);
    } catch (error) {
        console.log('❌ Builds error:', error.response?.status, error.response?.data);
    }
    
    // Test Account endpoints
    console.log('\n=== Testing Account Endpoints ===');
    try {
        const profileResponse = await axios.get(`${BASE_URL}/api/account/profile`, { headers });
        console.log('✅ Profile fetch success:', profileResponse.status);
    } catch (error) {
        console.log('❌ Profile error:', error.response?.status, error.response?.data);
    }
    
    try {
        const reviewsResponse = await axios.get(`${BASE_URL}/api/account/reviews`, { headers });
        console.log('✅ Reviews fetch success:', reviewsResponse.status);
        console.log('Reviews count:', reviewsResponse.data?.length || 0);
    } catch (error) {
        console.log('❌ Reviews error:', error.response?.status, error.response?.data);
    }
}

if (require.main === module) {
    testUserEndpoints().catch(console.error);
}

module.exports = { testUserEndpoints };
