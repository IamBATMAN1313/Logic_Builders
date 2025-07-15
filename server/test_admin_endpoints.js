const axios = require('axios');

const BASE_URL = 'http://localhost:54321';

// Test data
const testAdminSignup = {
    employee_id: `EMP${Date.now()}`,
    name: 'Test Admin User',
    email: `testadmin${Date.now()}@test.com`,
    password: 'testpass123',
    phone: `555${Math.floor(Math.random() * 10000000)}`,
    department: 'IT',
    position: 'System Administrator',
    reason_for_access: 'Testing admin endpoints and system functionality',
    requested_clearance: 'ADMIN'
};

const testApproval = {
    action: 'approve',
    assigned_clearance: 'ADMIN',
    notes: 'Test approval'
};

async function testEndpoint(method, url, data = null, headers = {}) {
    try {
        console.log(`\n🧪 Testing ${method.toUpperCase()} ${url}`);
        
        const config = {
            method,
            url: `${BASE_URL}${url}`,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };
        
        if (data) {
            config.data = data;
        }
        
        const response = await axios(config);
        console.log(`✅ Success: ${response.status} ${response.statusText}`);
        console.log('Response:', JSON.stringify(response.data, null, 2));
        return response.data;
    } catch (error) {
        console.log(`❌ Error: ${error.response?.status || 'Network Error'}`);
        console.log('Error details:', error.response?.data || error.message);
        return null;
    }
}

async function runAdminEndpointTests() {
    console.log('🚀 Starting Admin Endpoint Tests...\n');
    
    // Test 1: Submit signup request
    console.log('=== Test 1: Submit Admin Signup Request ===');
    const signupResult = await testEndpoint('POST', '/api/admin/signup-request', testAdminSignup);
    
    // Test 2: Get pending requests (without auth for now)
    console.log('\n=== Test 2: Get Pending Requests ===');
    await testEndpoint('GET', '/api/admin/signup-requests');
    
    // Test 3: Get all admins
    console.log('\n=== Test 3: Get All Admins ===');
    await testEndpoint('GET', '/api/admin/admins');
    
    // Test 4: Get notifications
    console.log('\n=== Test 4: Get Notifications ===');
    await testEndpoint('GET', '/api/admin/notifications');
    
    // Test 5: Get admin logs
    console.log('\n=== Test 5: Get Admin Logs ===');
    await testEndpoint('GET', '/api/admin/logs');
    
    // Test 6: Approve request (if we have a request)
    if (signupResult && signupResult.request_id) {
        console.log('\n=== Test 6: Approve Signup Request ===');
        await testEndpoint('PUT', `/api/admin/signup-requests/${signupResult.request_id}`, testApproval);
    }
    
    console.log('\n🏁 Admin Endpoint Tests Complete!');
}

// Also test basic server health
async function testServerHealth() {
    console.log('\n=== Server Health Check ===');
    await testEndpoint('GET', '/');
    await testEndpoint('GET', '/api/health');
}

async function main() {
    console.log('🔧 Testing Admin Endpoints and Server Health\n');
    
    await testServerHealth();
    await runAdminEndpointTests();
    
    console.log('\n✨ All tests completed!');
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { testEndpoint, runAdminEndpointTests };
