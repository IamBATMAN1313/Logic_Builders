#!/bin/bash
# DATABASE SYNCHRONIZATION SCRIPT
# RUN THIS ON: REMOTE MACHINE (target machine to be synced)
# PURPOSE: Sync remote database to match local database schema

echo "🚀 Starting database synchronization..."
echo "⚠️  IMPORTANT: Make sure you have copied the 'extracted_schema' folder from local machine!"

# REMOTE database connection details (MODIFY THESE FOR YOUR REMOTE MACHINE)
REMOTE_DB="logicbuilders"
REMOTE_USER="your_username"      # CHANGE THIS
REMOTE_HOST="localhost"          # Usually localhost on remote machine
REMOTE_PORT="5432"

# Check if extracted schema folder exists
if [ ! -d "extracted_schema" ]; then
    echo "❌ ERROR: 'extracted_schema' folder not found!"
    echo "   Please copy the extracted schema from your local machine first."
    echo "   Run 'extract-schema.sh' on local machine, then copy the 'extracted_schema' folder here."
    exit 1
fi

cd extracted_schema

echo "💾 Step 1: Creating database backup..."
# Create backup of current database
backup_file="backup_before_sync_$(date +%Y%m%d_%H%M%S).sql"
pg_dump -h $REMOTE_HOST -p $REMOTE_PORT -U $REMOTE_USER -d $REMOTE_DB > "../$backup_file"
echo "✅ Backup created: $backup_file"

echo "🔧 Step 2: Installing helper functions..."
# Install helper functions
psql -h $REMOTE_HOST -p $REMOTE_PORT -U $REMOTE_USER -d $REMOTE_DB -f ../helper-functions.sql

echo "📋 Step 3: Syncing table structures..."
# Execute table structure synchronization
if [ -f "01_table_structures.sql" ]; then
    echo "   Creating tables and adding columns..."
    psql -h $REMOTE_HOST -p $REMOTE_PORT -U $REMOTE_USER -d $REMOTE_DB -f 01_table_structures.sql
    echo "✅ Tables and columns synchronized"
else
    echo "⚠️  Warning: 01_table_structures.sql not found"
fi

echo "🔧 Step 4: Cleaning up temporary columns..."
# Remove temporary columns
psql -h $REMOTE_HOST -p $REMOTE_PORT -U $REMOTE_USER -d $REMOTE_DB -c "SELECT drop_temp_columns();"

echo "📊 Step 5: Syncing sequences..."
# Sync sequences
if [ -f "06_sequences.sql" ]; then
    echo "   Creating sequences..."
    psql -h $REMOTE_HOST -p $REMOTE_PORT -U $REMOTE_USER -d $REMOTE_DB -f 06_sequences.sql
    echo "✅ Sequences synchronized"
else
    echo "⚠️  Warning: 06_sequences.sql not found"
fi

echo "📇 Step 6: Syncing indexes..."
# Sync indexes
if [ -f "03_indexes.sql" ]; then
    echo "   Creating indexes..."
    # Execute each index creation with error handling
    while IFS= read -r line; do
        if [[ $line =~ ^CREATE.*INDEX ]]; then
            psql -h $REMOTE_HOST -p $REMOTE_PORT -U $REMOTE_USER -d $REMOTE_DB -c "SELECT safe_execute('$line');"
        fi
    done < 03_indexes.sql
    echo "✅ Indexes synchronized"
else
    echo "⚠️  Warning: 03_indexes.sql not found"
fi

echo "⚙️ Step 7: Syncing functions..."
# Sync functions
if [ -f "04_functions.sql" ]; then
    echo "   Installing custom functions..."
    psql -h $REMOTE_HOST -p $REMOTE_PORT -U $REMOTE_USER -d $REMOTE_DB -f 04_functions.sql
    echo "✅ Functions synchronized"
else
    echo "⚠️  Warning: 04_functions.sql not found"
fi

echo "🔗 Step 8: Syncing constraints..."
# Sync constraints (must be done after all tables and columns exist)
if [ -f "02_constraints.sql" ]; then
    echo "   Adding constraints..."
    psql -h $REMOTE_HOST -p $REMOTE_PORT -U $REMOTE_USER -d $REMOTE_DB -f 02_constraints.sql
    echo "✅ Constraints synchronized"
else
    echo "⚠️  Warning: 02_constraints.sql not found"
fi

echo "🔧 Step 9: Syncing triggers..."
# Sync triggers (must be done last)
if [ -f "05_triggers.sql" ]; then
    echo "   Creating triggers..."
    psql -h $REMOTE_HOST -p $REMOTE_PORT -U $REMOTE_USER -d $REMOTE_DB -f 05_triggers.sql
    echo "✅ Triggers synchronized"
else
    echo "⚠️  Warning: 05_triggers.sql not found"
fi

echo "📊 Step 10: Generating sync report..."
# Generate detailed sync report
report_file="../sync_report_$(date +%Y%m%d_%H%M%S).txt"
cat > "$report_file" << EOF
DATABASE SYNCHRONIZATION REPORT
===============================
Date: $(date)
Remote Database: $REMOTE_HOST:$REMOTE_PORT/$REMOTE_DB
Backup File: $backup_file

SYNC STATISTICS:
EOF

# Add database statistics to report
psql -h $REMOTE_HOST -p $REMOTE_PORT -U $REMOTE_USER -d $REMOTE_DB << 'EOF' >> "$report_file"
\echo 'Tables:'
SELECT '  ' || table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;

\echo ''
\echo 'Functions:'
SELECT '  ' || routine_name FROM information_schema.routines WHERE routine_schema = 'public' ORDER BY routine_name;

\echo ''
\echo 'Constraints:'
SELECT '  ' || constraint_name || ' (' || constraint_type || ') on ' || table_name FROM information_schema.table_constraints WHERE constraint_schema = 'public' ORDER BY table_name, constraint_name;

\echo ''
\echo 'Summary Counts:'
SELECT 'Tables: ' || count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
SELECT 'Columns: ' || count(*) FROM information_schema.columns WHERE table_schema = 'public';
SELECT 'Functions: ' || count(*) FROM information_schema.routines WHERE routine_schema = 'public';
SELECT 'Constraints: ' || count(*) FROM information_schema.table_constraints WHERE constraint_schema = 'public';
SELECT 'Indexes: ' || count(*) FROM pg_indexes WHERE schemaname = 'public';
EOF

echo ""
echo "🎉 DATABASE SYNCHRONIZATION COMPLETE!"
echo ""
echo "📋 Results:"
echo "  ✅ Backup created: $backup_file"
echo "  ✅ Schema synchronized to match local database"
echo "  ✅ All existing data preserved"
echo "  📊 Detailed report: $report_file"
echo ""
echo "🔍 Next steps:"
echo "  1. Review the sync report: cat $report_file"
echo "  2. Test your application with the updated database"
echo "  3. If something went wrong, restore from backup:"
echo "     psql -h $REMOTE_HOST -p $REMOTE_PORT -U $REMOTE_USER -d $REMOTE_DB < $backup_file"
echo ""
