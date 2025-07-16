#!/bin/bash

echo "=== Testing LogicBuilders Admin System ==="
echo

# Test 1: Check if backend is running
echo "1. Testing backend server..."
if curl -s http://localhost:54321/api/admin/public/access-levels > /dev/null; then
    echo "✅ Backend server is running"
else
    echo "❌ Backend server is not responding"
    exit 1
fi

# Test 2: Check public access levels endpoint
echo "2. Testing public access levels endpoint..."
ACCESS_LEVELS=$(curl -s http://localhost:54321/api/admin/public/access-levels | jq length)
if [ "$ACCESS_LEVELS" -gt 0 ]; then
    echo "✅ Access levels endpoint returns $ACCESS_LEVELS levels"
else
    echo "❌ Access levels endpoint not working"
fi

# Test 3: Test login
echo "3. Testing admin login..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:54321/api/admin/login \
    -H "Content-Type: application/json" \
    -d '{"employee_id": "TEST001", "password": "test123"}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')
CLEARANCE_LEVEL=$(echo $LOGIN_RESPONSE | jq -r '.admin.clearance_level')
CLEARANCE_NAME=$(echo $LOGIN_RESPONSE | jq -r '.admin.clearance_name')

if [ "$TOKEN" != "null" ] && [ "$CLEARANCE_LEVEL" = "0" ]; then
    echo "✅ Login successful - Token received, Level: $CLEARANCE_LEVEL ($CLEARANCE_NAME)"
else
    echo "❌ Login failed or wrong clearance level"
fi

# Test 4: Test products endpoint with General Manager
echo "4. Testing products access with General Manager..."
PRODUCTS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
    http://localhost:54321/api/admin/products)

if echo $PRODUCTS_RESPONSE | jq -e '.products' > /dev/null; then
    PRODUCT_COUNT=$(echo $PRODUCTS_RESPONSE | jq '.products | length')
    echo "✅ Products endpoint accessible - $PRODUCT_COUNT products returned"
else
    echo "❌ Products endpoint not accessible"
    echo "Response: $PRODUCTS_RESPONSE"
fi

# Test 5: Check frontend
echo "5. Testing frontend server..."
if curl -s http://localhost:3001 > /dev/null; then
    echo "✅ Frontend server is running on port 3001"
else
    echo "❌ Frontend server is not responding on port 3001"
fi

# Test 6: Test access levels through frontend proxy
echo "6. Testing frontend proxy for access levels..."
FRONTEND_ACCESS_LEVELS=$(curl -s http://localhost:3001/api/admin/public/access-levels | jq length)
if [ "$FRONTEND_ACCESS_LEVELS" -gt 0 ]; then
    echo "✅ Frontend proxy working - $FRONTEND_ACCESS_LEVELS levels"
else
    echo "❌ Frontend proxy not working"
fi

echo
echo "=== Test Summary ==="
echo "Open your browser to:"
echo "- Login: http://localhost:3001/admin"
echo "- Signup: http://localhost:3001/admin/signup"
echo
echo "Test credentials:"
echo "- Employee ID: TEST001"
echo "- Password: test123"
echo "- Clearance Level: 0 (General Manager)"
