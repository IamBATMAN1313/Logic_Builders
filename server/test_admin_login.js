const axios = require('axios');

const BASE_URL = 'http://localhost:54321';

async function testAdminLogin() {
    console.log('🔐 Testing Admin Login...\n');
    
    try {
        console.log('=== Admin Login Test ===');
        const loginResponse = await axios.post(`${BASE_URL}/api/admin/login`, {
            employee_id: 'EMP001',
            password: 'admin123'
        });
        
        console.log('✅ Admin Login Success:', loginResponse.status);
        console.log('Token received:', !!loginResponse.data.token);
        
        if (loginResponse.data.token) {
            console.log('\n=== Testing Admin Dashboard Stats ===');
            const statsResponse = await axios.get(`${BASE_URL}/api/admin/dashboard/stats`, {
                headers: {
                    'Authorization': `Bearer ${loginResponse.data.token}`
                }
            });
            
            console.log('✅ Dashboard Stats Success:', statsResponse.status);
            console.log('Stats:', JSON.stringify(statsResponse.data, null, 2));
        }
        
    } catch (error) {
        console.log('❌ Admin Test Error:', error.response?.status);
        console.log('Error details:', error.response?.data || error.message);
    }
}

if (require.main === module) {
    testAdminLogin().catch(console.error);
}

module.exports = { testAdminLogin };
