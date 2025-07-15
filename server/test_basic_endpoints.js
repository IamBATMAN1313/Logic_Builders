const axios = require('axios');

const BASE_URL = 'http://localhost:54321';

// Test authentication endpoints
async function testAuthEndpoints() {
    console.log('🔐 Testing Authentication Endpoints...\n');
    
    try {
        // Test 1: Login endpoint
        console.log('=== Test 1: Login Endpoint ===');
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
            identifier: 'authtest@test.com',
            password: 'testpass123'
        });
        console.log('✅ Login Success:', loginResponse.status);
        console.log('Token received:', !!loginResponse.data.token);
        
        // Test 2: Verify token
        if (loginResponse.data.token) {
            console.log('\n=== Test 2: Verify Token ===');
            const verifyResponse = await axios.get(`${BASE_URL}/api/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${loginResponse.data.token}`
                }
            });
            console.log('✅ Token Verify Success:', verifyResponse.status);
            console.log('User data:', verifyResponse.data);
        }
        
    } catch (error) {
        console.log('❌ Auth Error:', error.response?.status, error.response?.data || error.message);
    }
}

// Test product endpoints
async function testProductEndpoints() {
    console.log('\n📦 Testing Product Endpoints...\n');
    
    try {
        // Test 1: Get all products
        console.log('=== Test 1: Get All Products ===');
        const productsResponse = await axios.get(`${BASE_URL}/api/products`);
        console.log('✅ Products Success:', productsResponse.status);
        console.log('Products count:', productsResponse.data.length);
        
        // Test 2: Get categories
        console.log('\n=== Test 2: Get Categories ===');
        const categoriesResponse = await axios.get(`${BASE_URL}/api/categories`);
        console.log('✅ Categories Success:', categoriesResponse.status);
        console.log('Categories:', categoriesResponse.data.slice(0, 3)); // Show first 3 only
        
    } catch (error) {
        console.log('❌ Product Error:', error.response?.status, error.response?.data || error.message);
    }
}

// Test basic server endpoints
async function testBasicEndpoints() {
    console.log('🏥 Testing Basic Server Health...\n');
    
    try {
        // Test root endpoint
        console.log('=== Test 1: Root Endpoint ===');
        const rootResponse = await axios.get(`${BASE_URL}/`);
        console.log('✅ Root Success:', rootResponse.status);
        console.log('Message:', rootResponse.data);
        
    } catch (error) {
        console.log('❌ Basic Error:', error.response?.status, error.response?.data || error.message);
    }
}

async function main() {
    console.log('🧪 Running Basic Endpoint Tests\n');
    
    await testBasicEndpoints();
    await testAuthEndpoints();
    await testProductEndpoints();
    
    console.log('\n🏁 Basic endpoint tests complete!');
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { testAuthEndpoints, testProductEndpoints, testBasicEndpoints };
