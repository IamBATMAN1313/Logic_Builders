const axios = require('axios');

const BASE_URL = 'http://localhost:54321';

// Create a test admin user and get token
async function createTestAdminAndGetToken() {
    try {
        // First, let's check if we can create a test admin directly in the database
        console.log('🔑 Creating test admin user...');
        
        // For now, we'll skip authentication and test just the public endpoints
        return null;
    } catch (error) {
        console.log('Error creating test admin:', error.message);
        return null;
    }
}

// Test only public endpoints first
async function testPublicAdminEndpoints() {
    console.log('🧪 Testing Public Admin Endpoints\n');
    
    // Test data
    const testAdminSignup = {
        employee_id: 'EMP999',
        name: 'Test Admin User',
        email: 'testadmin999@test.com',
        password: 'testpass123',
        phone: '5559876543',
        department: 'IT',
        position: 'System Administrator',
        reason_for_access: 'Testing admin endpoints and system functionality',
        requested_clearance: 'ADMIN'
    };
    
    try {
        console.log('=== Test 1: Submit Admin Signup Request ===');
        const response = await axios.post(`${BASE_URL}/api/admin/signup-request`, testAdminSignup);
        console.log('✅ Success:', response.status);
        console.log('Response:', JSON.stringify(response.data, null, 2));
        return response.data;
    } catch (error) {
        console.log('❌ Error:', error.response?.status);
        console.log('Error details:', error.response?.data || error.message);
        return null;
    }
}

async function main() {
    console.log('🚀 Testing Admin Endpoints (Public Only)\n');
    
    const signupResult = await testPublicAdminEndpoints();
    
    console.log('\n✨ Public endpoint test completed!');
    if (signupResult) {
        console.log('📋 Signup request created with ID:', signupResult.request_id);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { testPublicAdminEndpoints };
