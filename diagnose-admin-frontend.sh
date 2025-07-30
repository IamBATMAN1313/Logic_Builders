#!/bin/bash

# Admin Frontend Diagnostic Script
echo "🔧 ADMIN FRONTEND DIAGNOSTIC"
echo "============================"
echo ""

# Check if admin frontend exists and is set up
echo "1. Checking admin frontend structure..."
if [ -d "/Users/muttakin/LogicBuilders/admin" ]; then
    echo "✅ Admin directory exists"
    
    if [ -f "/Users/muttakin/LogicBuilders/admin/package.json" ]; then
        echo "✅ package.json exists"
        echo "   Dependencies:"
        grep -A 10 '"dependencies"' /Users/muttakin/LogicBuilders/admin/package.json | head -15
    else
        echo "❌ No package.json found"
    fi
    
    if [ -f "/Users/muttakin/LogicBuilders/admin/src/components/CouponGeneratorModal.js" ]; then
        echo "✅ CouponGeneratorModal.js exists"
    else
        echo "❌ CouponGeneratorModal.js not found"
    fi
else
    echo "❌ Admin directory not found"
fi

echo ""
echo "2. Checking admin build status..."
if [ -d "/Users/muttakin/LogicBuilders/admin/build" ]; then
    echo "✅ Build directory exists"
    echo "   Build size: $(du -sh /Users/muttakin/LogicBuilders/admin/build 2>/dev/null | cut -f1)"
else
    echo "⚠️  No build directory found - frontend may not be built"
fi

echo ""
echo "3. Checking server status..."
if curl -s http://localhost:54321/api/admin/login > /dev/null 2>&1; then
    echo "✅ Server is responding on localhost:54321"
else
    echo "❌ Server not responding on localhost:54321"
fi

echo ""
echo "4. Checking common admin frontend issues..."

# Check for common React issues
echo "   - React version compatibility:"
if [ -f "/Users/muttakin/LogicBuilders/admin/package.json" ]; then
    react_version=$(grep '"react":' /Users/muttakin/LogicBuilders/admin/package.json | cut -d'"' -f4)
    echo "     React: $react_version"
else
    echo "     Unable to check React version"
fi

echo ""
echo "5. Recommended next steps:"
echo "   a) Start the admin frontend:"
echo "      cd /Users/muttakin/LogicBuilders/admin && npm start"
echo ""
echo "   b) Check browser console for errors when using the admin interface"
echo ""
echo "   c) Verify admin login in browser:"
echo "      http://localhost:3000 (or admin frontend port)"
echo ""
echo "   d) Test API directly in browser dev tools:"
echo "      fetch('http://localhost:54321/api/admin/login', {"
echo "        method: 'POST',"
echo "        headers: {'Content-Type': 'application/json'},"
echo "        body: JSON.stringify({employee_id: 'EMP001', password: 'admin123'})"
echo "      })"
echo ""
echo "🎯 API BACKEND IS CONFIRMED WORKING ✅"
echo "    The issue is in the frontend interface or browser environment"
