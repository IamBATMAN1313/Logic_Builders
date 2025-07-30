#!/bin/bash
# DATABASE CONNECTION TEST
# RUN THIS ON: BOTH MACHINES (to verify database connectivity)
# PURPOSE: Test database connection and show basic statistics

echo "🔍 Testing database connection..."

# Database connection details (MODIFY THESE)
DB_NAME="logic"
DB_USER="rawnak"           # CHANGE THIS for remote machine
DB_HOST="localhost"
DB_PORT="5432"

echo "Connecting to: $DB_HOST:$DB_PORT/$DB_NAME as $DB_USER"

# Test connection
if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT version();" > /dev/null 2>&1; then
    echo "✅ Database connection successful!"
    
    echo ""
    echo "📊 Database Statistics:"
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << 'EOF'
\echo 'Current database schema summary:'
\echo '================================'

SELECT 'Tables: ' || count(*) as stat FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
UNION ALL
SELECT 'Columns: ' || count(*) FROM information_schema.columns WHERE table_schema = 'public'
UNION ALL  
SELECT 'Functions: ' || count(*) FROM information_schema.routines WHERE routine_schema = 'public'
UNION ALL
SELECT 'Constraints: ' || count(*) FROM information_schema.table_constraints WHERE constraint_schema = 'public'
UNION ALL
SELECT 'Indexes: ' || count(*) FROM pg_indexes WHERE schemaname = 'public';

\echo ''
\echo 'Sample tables:'
SELECT '  - ' || table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name LIMIT 10;

\echo ''
\echo 'Sample functions:'
SELECT '  - ' || routine_name FROM information_schema.routines WHERE routine_schema = 'public' ORDER BY routine_name LIMIT 5;
EOF

    echo ""
    echo "🔗 Connection test complete!"
    
else
    echo "❌ Database connection failed!"
    echo "   Please check:"
    echo "   - Database name: $DB_NAME"
    echo "   - Username: $DB_USER"  
    echo "   - Host: $DB_HOST"
    echo "   - Port: $DB_PORT"
    echo "   - PostgreSQL is running"
    echo "   - User has proper permissions"
    exit 1
fi
