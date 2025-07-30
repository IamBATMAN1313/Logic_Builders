#!/bin/bash
# DATABASE SCHEMA EXTRACTION SCRIPT
# RUN THIS ON: LOCAL MACHINE (your current machine)
# PURPOSE: Extract complete schema from your local database

echo "🔍 Extracting schema from LOCAL database..."

# Database connection details for LOCAL machine
LOCAL_DB="logic"
LOCAL_USER="rawnak" 
LOCAL_HOST="localhost"
LOCAL_PORT="5432"

# Create output directory
mkdir -p extracted_schema
cd extracted_schema

echo "📋 Step 1: Extracting table structures..."

# 1. Extract complete table structures with all columns and constraints
psql -h $LOCAL_HOST -p $LOCAL_PORT -U $LOCAL_USER -d $LOCAL_DB << 'EOF' > 01_table_structures.sql
\echo '-- TABLE STRUCTURES AND COLUMNS'
\echo '-- Generated from local database'
\echo ''

SELECT 
    'DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = ''public'' AND table_name = ''' 
    || t.table_name || ''') THEN CREATE TABLE ' || t.table_name || ' (placeholder_col INTEGER); END IF; END $$;' as create_table_stmt
FROM information_schema.tables t
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name;

\echo ''
\echo '-- COLUMN ADDITIONS'

SELECT 
    'SELECT add_column_if_not_exists(''' || c.table_name || ''', ''' || c.column_name || ''', ''' ||
    c.data_type ||
    CASE 
        WHEN c.character_maximum_length IS NOT NULL THEN '(' || c.character_maximum_length || ')'
        WHEN c.numeric_precision IS NOT NULL AND c.numeric_scale IS NOT NULL THEN '(' || c.numeric_precision || ',' || c.numeric_scale || ')'
        WHEN c.numeric_precision IS NOT NULL THEN '(' || c.numeric_precision || ')'
        ELSE ''
    END ||
    CASE WHEN c.is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
    CASE WHEN c.column_default IS NOT NULL THEN ' DEFAULT ' || c.column_default ELSE '' END ||
    ''');' as add_column_stmt
FROM information_schema.tables t
JOIN information_schema.columns c ON c.table_name = t.table_name AND c.table_schema = t.table_schema
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;
EOF

echo "🔗 Step 2: Extracting constraints..."

# 2. Extract all constraints
psql -h $LOCAL_HOST -p $LOCAL_PORT -U $LOCAL_USER -d $LOCAL_DB << 'EOF' > 02_constraints.sql
\echo '-- CONSTRAINTS'
\echo '-- Primary Keys, Foreign Keys, Unique, Check constraints'
\echo ''

-- Primary Keys
SELECT 
    'DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = ''public'' AND constraint_name = ''' || tc.constraint_name || ''') THEN ALTER TABLE ' || tc.table_name || ' ADD CONSTRAINT ' || tc.constraint_name || ' PRIMARY KEY (' || string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) || '); END IF; END $$;' as constraint_stmt
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
GROUP BY tc.table_name, tc.constraint_name
ORDER BY tc.table_name;

-- Foreign Keys  
SELECT 
    'DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = ''public'' AND constraint_name = ''' || tc.constraint_name || ''') THEN ALTER TABLE ' || tc.table_name || ' ADD CONSTRAINT ' || tc.constraint_name || ' FOREIGN KEY (' || string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) || ') REFERENCES ' || ccu.table_name || '(' || string_agg(ccu.column_name, ', ') || ') ON DELETE ' || rc.delete_rule || ' ON UPDATE ' || rc.update_rule || '; END IF; END $$;' as constraint_stmt
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
GROUP BY tc.table_name, tc.constraint_name, ccu.table_name, rc.delete_rule, rc.update_rule
ORDER BY tc.table_name;

-- Unique Constraints
SELECT 
    'DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = ''public'' AND constraint_name = ''' || tc.constraint_name || ''') THEN ALTER TABLE ' || tc.table_name || ' ADD CONSTRAINT ' || tc.constraint_name || ' UNIQUE (' || string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) || '); END IF; END $$;' as constraint_stmt
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'UNIQUE' AND tc.table_schema = 'public'
GROUP BY tc.table_name, tc.constraint_name
ORDER BY tc.table_name;

-- Check Constraints
SELECT 
    'DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = ''public'' AND constraint_name = ''' || tc.constraint_name || ''') THEN ALTER TABLE ' || tc.table_name || ' ADD CONSTRAINT ' || tc.constraint_name || ' CHECK ' || cc.check_clause || '; END IF; END $$;' as constraint_stmt
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc ON cc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'CHECK' AND tc.table_schema = 'public'
ORDER BY tc.table_name;
EOF

echo "📊 Step 3: Extracting indexes..."

# 3. Extract indexes
pg_dump -h $LOCAL_HOST -p $LOCAL_PORT -U $LOCAL_USER -d $LOCAL_DB --schema-only --no-owner --no-privileges | grep -E "^CREATE.*INDEX" > 03_indexes.sql

echo "⚙️ Step 4: Extracting functions..."

# 4. Extract functions
echo "-- FUNCTIONS" > 04_functions.sql
echo "-- Custom functions from local database" >> 04_functions.sql
echo "" >> 04_functions.sql
pg_dump -h $LOCAL_HOST -p $LOCAL_PORT -U $LOCAL_USER -d $LOCAL_DB --schema-only --no-owner --no-privileges | sed -n '/^CREATE.*FUNCTION/,/^;$/p' >> 04_functions.sql

echo "🔧 Step 5: Extracting triggers..."

# 5. Extract triggers
echo "-- TRIGGERS" > 05_triggers.sql
echo "-- Triggers from local database" >> 05_triggers.sql
echo "" >> 05_triggers.sql
pg_dump -h $LOCAL_HOST -p $LOCAL_PORT -U $LOCAL_USER -d $LOCAL_DB --schema-only --no-owner --no-privileges | sed -n '/^CREATE TRIGGER/,/^;$/p' >> 05_triggers.sql

echo "📋 Step 6: Extracting sequences..."

# 6. Extract sequences
psql -h $LOCAL_HOST -p $LOCAL_PORT -U $LOCAL_USER -d $LOCAL_DB << 'EOF' > 06_sequences.sql
\echo '-- SEQUENCES'
\echo '-- Auto-increment sequences'
\echo ''

SELECT 
    'CREATE SEQUENCE IF NOT EXISTS ' || sequence_name || 
    ' START WITH ' || COALESCE(start_value::text, '1') || 
    ' INCREMENT BY ' || COALESCE(increment::text, '1') || 
    ' MINVALUE ' || COALESCE(min_value::text, '1') || 
    ' MAXVALUE ' || COALESCE(max_value::text, '9223372036854775807') || 
    ' CACHE ' || COALESCE(cache_value::text, '1') || ';' as sequence_stmt
FROM information_schema.sequences
WHERE sequence_schema = 'public'
ORDER BY sequence_name;
EOF

# 7. Create a summary report
echo "📊 Creating extraction summary..."
cat > extraction_summary.txt << EOF
DATABASE SCHEMA EXTRACTION SUMMARY
==================================
Date: $(date)
Source Database: $LOCAL_HOST:$LOCAL_PORT/$LOCAL_DB

Files Generated:
- 01_table_structures.sql : Table creation and column definitions
- 02_constraints.sql      : All constraints (PK, FK, Unique, Check)
- 03_indexes.sql         : Database indexes
- 04_functions.sql       : Custom functions
- 05_triggers.sql        : Database triggers
- 06_sequences.sql       : Auto-increment sequences

Statistics:
EOF

psql -h $LOCAL_HOST -p $LOCAL_PORT -U $LOCAL_USER -d $LOCAL_DB -c "
SELECT 'Tables: ' || count(*) FROM information_schema.tables WHERE table_schema = 'public';
SELECT 'Columns: ' || count(*) FROM information_schema.columns WHERE table_schema = 'public';
SELECT 'Functions: ' || count(*) FROM information_schema.routines WHERE routine_schema = 'public';
SELECT 'Constraints: ' || count(*) FROM information_schema.table_constraints WHERE constraint_schema = 'public';
SELECT 'Indexes: ' || count(*) FROM pg_indexes WHERE schemaname = 'public';
" -t -A >> extraction_summary.txt

echo ""
echo "✅ Schema extraction complete!"
echo "📁 Files created in: $(pwd)"
echo "📋 Summary: $(pwd)/extraction_summary.txt"
echo ""
echo "📤 NEXT STEP: Copy the 'extracted_schema' folder to your remote machine"
echo "   Then run 'sync-database.sh' on the remote machine"
