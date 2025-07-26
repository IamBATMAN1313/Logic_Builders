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

async function testPromotionsEndpoint() {
  console.log('🔍 Testing Promotions Endpoint...');
  
  try {
    // Test server health first
    console.log('\n1. Testing server health...');
    const healthOptions = {
      hostname: 'localhost',
      port: 54321,
      path: '/api/health',
      method: 'GET'
    };
    
    const healthResponse = await makeRequest(healthOptions);
    console.log('Health status:', healthResponse.status);
    console.log('Health response:', healthResponse.data);

    // Try to get promotions without auth to see auth error
    console.log('\n2. Testing promotions without auth...');
    const noAuthOptions = {
      hostname: 'localhost',
      port: 54321,
      path: '/api/admin/promotions',
      method: 'GET'
    };
    
    const noAuthResponse = await makeRequest(noAuthOptions);
    console.log('No auth status:', noAuthResponse.status);
    console.log('No auth response:', noAuthResponse.data);

    // Try with a dummy token to see permission error
    console.log('\n3. Testing promotions with dummy token...');
    const dummyAuthOptions = {
      hostname: 'localhost',
      port: 54321,
      path: '/api/admin/promotions',
      method: 'GET',
      headers: {
        'Authorization': 'Bearer dummy_token',
        'Content-Type': 'application/json'
      }
    };
    
    const dummyAuthResponse = await makeRequest(dummyAuthOptions);
    console.log('Dummy auth status:', dummyAuthResponse.status);
    console.log('Dummy auth response:', dummyAuthResponse.data);

  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
}

testPromotionsEndpoint();
