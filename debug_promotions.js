const fetch = require('node-fetch');

async function testPromotionsEndpoint() {
  console.log('🔍 Testing Promotions Endpoint...');
  
  try {
    // First test basic server connectivity
    console.log('\n1. Testing server health...');
    const healthResponse = await fetch('http://localhost:54321/api/health');
    console.log('Health status:', healthResponse.status);
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('Health data:', healthData);
    }

    // Test admin login to get a token
    console.log('\n2. Testing admin login...');
    const loginResponse = await fetch('http://localhost:54321/api/admin/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'admin', // You might need to update this
        password: 'admin123' // You might need to update this
      })
    });
    
    console.log('Login status:', loginResponse.status);
    if (!loginResponse.ok) {
      const loginError = await loginResponse.text();
      console.error('Login failed:', loginError);
      
      // Try alternative login credentials
      console.log('\n2.1 Trying alternative admin credentials...');
      const altLoginResponse = await fetch('http://localhost:54321/api/admin/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: 'test_admin',
          password: 'password123'
        })
      });
      
      console.log('Alt login status:', altLoginResponse.status);
      if (!altLoginResponse.ok) {
        const altLoginError = await altLoginResponse.text();
        console.error('Alt login failed:', altLoginError);
        return;
      }
      
      const altLoginData = await altLoginResponse.json();
      console.log('Alt login successful, token received');
      var token = altLoginData.token;
    } else {
      const loginData = await loginResponse.json();
      console.log('Login successful, token received');
      var token = loginData.token;
    }

    // Test promotions endpoint with token
    console.log('\n3. Testing promotions endpoint...');
    const promotionsResponse = await fetch('http://localhost:54321/api/admin/promotions', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Promotions status:', promotionsResponse.status);
    console.log('Promotions ok:', promotionsResponse.ok);
    
    if (promotionsResponse.ok) {
      const promotionsData = await promotionsResponse.json();
      console.log('Promotions data:', promotionsData);
    } else {
      const errorText = await promotionsResponse.text();
      console.error('Promotions error:', errorText);
    }

  } catch (error) {
    console.error('Network error:', error.message);
  }
}

// Test database connection directly
async function testDatabaseConnection() {
  console.log('\n🗄️  Testing Database Connection...');
  
  try {
    const pool = require('./server/db/connection');
    
    // Test basic query
    console.log('Testing basic database query...');
    const result = await pool.query('SELECT NOW() as current_time');
    console.log('Database connected successfully:', result.rows[0]);
    
    // Test promo table exists
    console.log('\nTesting promo table...');
    const promoTest = await pool.query('SELECT COUNT(*) FROM promo');
    console.log('Promo table accessible, count:', promoTest.rows[0].count);
    
    // Test promo table structure
    console.log('\nTesting promo table structure...');
    const promoStructure = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'promo'
      ORDER BY ordinal_position
    `);
    console.log('Promo table columns:', promoStructure.rows);
    
    // Test actual promo data
    console.log('\nTesting promo data...');
    const promoData = await pool.query('SELECT * FROM promo LIMIT 3');
    console.log('Sample promo data:', promoData.rows);
    
  } catch (error) {
    console.error('Database error:', error.message);
    console.error('Full error:', error);
  }
}

// Run tests
async function runAllTests() {
  await testDatabaseConnection();
  await testPromotionsEndpoint();
}

runAllTests();
