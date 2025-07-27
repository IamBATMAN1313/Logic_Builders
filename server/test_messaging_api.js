const axios = require('axios');

// Test messaging API endpoints
async function testMessagingAPI() {
  const baseURL = 'http://localhost:54321/api';
  
  // Use the token from the debug script
  const adminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZG1pbl9pZCI6IjI3YzIxOWExLTlhNTAtNDE4Ny05N2ZiLWQ3YzgxODYxY2QxYSIsInVzZXJfaWQiOiIyN2MyMTlhMS05YTUwLTQxODctOTdmYi1kN2M4MTg2MWNkMWEiLCJlbXBsb3llZV9pZCI6IkVNUDAwMSIsImNsZWFyYW5jZV9sZXZlbCI6MCwiaWF0IjoxNzUzNTczNzM3LCJleHAiOjE3NTM2NjAxMzd9.xQ2lmjGsSxQMTlG8cI8GUtYk_hmCXNkcrGdPB0cpVG4';

  console.log('=== MESSAGING API TEST ===\n');

  try {
    // 1. Test admin authentication
    console.log('1. Testing admin messaging auth endpoint...');
    try {
      const authTest = await axios.get(`${baseURL}/messaging/admin/test`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      console.log('✅ Admin auth successful:', authTest.data);
    } catch (error) {
      console.log('❌ Admin auth failed:', error.response?.data || error.message);
    }

    // 2. Test get admin conversations
    console.log('\n2. Testing admin conversations endpoint...');
    try {
      const adminConvs = await axios.get(`${baseURL}/messaging/admin/conversations`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      console.log('✅ Admin conversations successful, count:', adminConvs.data.length);
      if (adminConvs.data.length > 0) {
        console.log('First conversation:', {
          id: adminConvs.data[0].id,
          subject: adminConvs.data[0].subject,
          customer_name: adminConvs.data[0].customer_name,
          status: adminConvs.data[0].status
        });
      }
    } catch (error) {
      console.log('❌ Admin conversations failed:', error.response?.data || error.message);
    }

    // 3. Test get conversation messages (if we have a conversation)
    console.log('\n3. Testing conversation messages endpoint...');
    try {
      // First get conversations to get an ID
      const convResponse = await axios.get(`${baseURL}/messaging/admin/conversations`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      
      if (convResponse.data.length > 0) {
        const conversationId = convResponse.data[0].id;
        const messages = await axios.get(`${baseURL}/messaging/admin/conversation/${conversationId}`, {
          headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        console.log('✅ Conversation messages successful, count:', messages.data.length);
        if (messages.data.length > 0) {
          console.log('First message:', {
            sender_name: messages.data[0].sender_name,
            message_text: messages.data[0].message_text.substring(0, 50)
          });
        }

        // 4. Test admin reply
        console.log('\n4. Testing admin reply endpoint...');
        try {
          const reply = await axios.post(`${baseURL}/messaging/admin/conversation/${conversationId}/reply`, {
            message_text: 'This is a test reply from admin API debug script'
          }, {
            headers: { 
              'Authorization': `Bearer ${adminToken}`,
              'Content-Type': 'application/json'
            }
          });
          console.log('✅ Admin reply successful:', reply.data);
        } catch (error) {
          console.log('❌ Admin reply failed:', error.response?.data || error.message);
          console.log('Request details:', {
            url: `${baseURL}/messaging/admin/conversation/${conversationId}/reply`,
            headers: { 'Authorization': `Bearer ${adminToken}` },
            data: { message_text: 'Test reply' }
          });
        }

        // 5. Test status update
        console.log('\n5. Testing conversation status update...');
        try {
          const statusUpdate = await axios.patch(`${baseURL}/messaging/admin/conversation/${conversationId}`, {
            status: 'resolved'
          }, {
            headers: { 
              'Authorization': `Bearer ${adminToken}`,
              'Content-Type': 'application/json'
            }
          });
          console.log('✅ Status update successful:', statusUpdate.data);
        } catch (error) {
          console.log('❌ Status update failed:', error.response?.data || error.message);
        }

        // Test invalid status
        console.log('\n5b. Testing invalid status rejection...');
        try {
          await axios.patch(`${baseURL}/messaging/admin/conversation/${conversationId}`, {
            status: 'pending'
          }, {
            headers: { 
              'Authorization': `Bearer ${adminToken}`,
              'Content-Type': 'application/json'
            }
          });
          console.log('❌ Invalid status was allowed (this is wrong)');
        } catch (error) {
          console.log('✅ Invalid status correctly rejected:', error.response?.data?.error || error.message);
        }
      } else {
        console.log('❌ No conversations found to test messages');
      }
    } catch (error) {
      console.log('❌ Getting conversation ID failed:', error.response?.data || error.message);
    }

    // 6. Test user authentication and messaging
    console.log('\n6. Testing user messaging...');
    
    // First, let's get a user token
    console.log('Getting user token...');
    try {
      const userLogin = await axios.post(`${baseURL}/auth/login`, {
        identifier: 'manush',
        password: 'password123'
      });
      const userToken = userLogin.data.token;
      console.log('✅ User login successful');

      // Test user conversations
      const userConvs = await axios.get(`${baseURL}/messaging/conversations`, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      console.log('✅ User conversations successful, count:', userConvs.data.length);

      // Test creating a new conversation
      const newConv = await axios.post(`${baseURL}/messaging/conversations`, {
        subject: 'API Test Conversation',
        type: 'general',
        message_text: 'This is a test message from the API debug script'
      }, {
        headers: { 
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ New conversation created:', newConv.data);

    } catch (error) {
      console.log('❌ User messaging test failed:', error.response?.data || error.message);
    }

  } catch (error) {
    console.error('❌ General error:', error.message);
  }

  console.log('\n=== API TEST COMPLETE ===');
}

testMessagingAPI();
