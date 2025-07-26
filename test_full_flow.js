const http = require('http');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: data,
          headers: res.headers
        });
      });
    });
    
    req.on('error', (e) => {
      reject(e);
    });
    
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function testFullPromotionsFlow() {
  console.log('🔍 Testing Full Promotions Flow...');
  
  try {
    // First, let's try to login with the admin user
    console.log('\n1. Testing admin login...');
    const loginData = JSON.stringify({
      employee_id: 'EMP001',
      password: 'admin123'  // This might need to be the correct password
    });
    
    const loginOptions = {
      hostname: 'localhost',
      port: 54321,
      path: '/api/admin/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
      }
    };
    
    const loginResponse = await makeRequest(loginOptions, loginData);
    console.log('Login status:', loginResponse.status);
    console.log('Login response:', loginResponse.data);
    
    if (loginResponse.status !== 200) {
      console.log('❌ Login failed. Let\'s check what authentication endpoint expects...');
      
      // Let's try a different password or check the auth endpoint structure
      console.log('\n2. Testing with different credentials...');
      const altLoginData = JSON.stringify({
        email: 'admin@test.com',
        password: 'password123'
      });
      
      const altLoginResponse = await makeRequest({
        ...loginOptions,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(altLoginData)
        }
      }, altLoginData);
      
      console.log('Alt login status:', altLoginResponse.status);
      console.log('Alt login response:', altLoginResponse.data);
      return;
    }
    
    // Parse the login response to get the token
    const loginResult = JSON.parse(loginResponse.data);
    if (!loginResult.token) {
      console.log('❌ No token in login response');
      return;
    }
    
    const token = loginResult.token;
    console.log('✅ Login successful, token received');
    
    // Now test the promotions endpoint with the real token
    console.log('\n3. Testing promotions endpoint with valid token...');
    const promotionsOptions = {
      hostname: 'localhost',
      port: 54321,
      path: '/api/admin/promotions',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    
    const promotionsResponse = await makeRequest(promotionsOptions);
    console.log('Promotions status:', promotionsResponse.status);
    console.log('Promotions response:', promotionsResponse.data);
    
    if (promotionsResponse.status === 200) {
      console.log('✅ Promotions endpoint working correctly!');
    } else {
      console.log('❌ Promotions endpoint still failing');
    }

  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
}

testFullPromotionsFlow();
