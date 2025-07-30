-- HELPER FUNCTIONS FOR DATABASE SYNC
-- RUN THIS ON: REMOTE MACHINE (before running sync-database.sh)
-- PURPOSE: Create utility functions needed for safe database synchronization

\echo 'Creating helper functions for database synchronization...'

-- Function to safely add columns without losing data
CREATE OR REPLACE FUNCTION add_column_if_not_exists(
    table_name text, 
    column_name text, 
    column_definition text
)
RETURNS void AS $$
DECLARE
    full_table_name text;
BEGIN
    full_table_name := quote_ident(table_name);
    
    -- Check if column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1 
        AND column_name = $2
    ) THEN
        -- Add the column
        EXECUTE 'ALTER TABLE ' || full_table_name || ' ADD COLUMN ' || quote_ident(column_name) || ' ' || column_definition;
        RAISE NOTICE '✅ Added column %.%', table_name, column_name;
    ELSE
        -- Column exists, check if definition needs updating
        RAISE NOTICE '⚠️  Column %.% already exists', table_name, column_name;
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE WARNING '❌ Failed to add column %.%: %', table_name, column_name, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Function to safely create tables
CREATE OR REPLACE FUNCTION create_table_if_not_exists(
    table_name text
)
RETURNS void AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
    ) THEN
        -- Create basic table structure - columns will be added later
        EXECUTE 'CREATE TABLE ' || quote_ident(table_name) || ' (temp_id SERIAL PRIMARY KEY)';
        RAISE NOTICE '✅ Created table %', table_name;
    ELSE
        RAISE NOTICE '⚠️  Table % already exists', table_name;
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE WARNING '❌ Failed to create table %: %', table_name, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Function to safely drop temporary columns
CREATE OR REPLACE FUNCTION drop_temp_columns()
RETURNS void AS $$
DECLARE
    rec RECORD;
BEGIN
    -- Drop any temporary columns that were created during table creation
    FOR rec IN (
        SELECT table_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND column_name = 'temp_id'
        AND EXISTS (
            SELECT 1 FROM information_schema.columns c2 
            WHERE c2.table_schema = 'public' 
            AND c2.table_name = information_schema.columns.table_name 
            AND c2.column_name != 'temp_id'
        )
    ) LOOP
        BEGIN
            EXECUTE 'ALTER TABLE ' || quote_ident(rec.table_name) || ' DROP COLUMN IF EXISTS temp_id';
            RAISE NOTICE '🧹 Removed temporary column from %', rec.table_name;
        EXCEPTION
            WHEN others THEN
                RAISE WARNING '⚠️  Could not remove temp column from %: %', rec.table_name, SQLERRM;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to safely execute SQL with error handling
CREATE OR REPLACE FUNCTION safe_execute(sql_statement text)
RETURNS void AS $$
BEGIN
    EXECUTE sql_statement;
    RAISE NOTICE '✅ Executed: %', left(sql_statement, 100);
EXCEPTION
    WHEN others THEN
        RAISE WARNING '❌ Failed to execute: % - Error: %', left(sql_statement, 100), SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Function to backup a table before major changes
CREATE OR REPLACE FUNCTION backup_table_data(table_name text)
RETURNS void AS $$
DECLARE
    backup_table_name text;
    row_count integer;
BEGIN
    backup_table_name := table_name || '_backup_' || to_char(now(), 'YYYYMMDD_HH24MI');
    
    -- Check if table has data
    EXECUTE 'SELECT count(*) FROM ' || quote_ident(table_name) INTO row_count;
    
    IF row_count > 0 THEN
        EXECUTE 'CREATE TABLE ' || quote_ident(backup_table_name) || ' AS SELECT * FROM ' || quote_ident(table_name);
        RAISE NOTICE '💾 Created backup table % with % rows', backup_table_name, row_count;
    ELSE
        RAISE NOTICE '📝 Table % is empty, no backup needed', table_name;
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE WARNING '❌ Failed to backup table %: %', table_name, SQLERRM;
END;
$$ LANGUAGE plpgsql;

\echo '✅ Helper functions created successfully!'
\echo 'Ready for database synchronization.'
