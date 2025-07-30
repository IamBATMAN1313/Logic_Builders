# Database Synchronization Guide

This folder contains scripts to synchronize your local database schema to a remote machine while preserving all existing data.

## 📁 Files Overview

| File | Machine | Purpose |
|------|---------|---------|
| `extract-schema.sh` | LOCAL | Extract complete schema from your current database |
| `helper-functions.sql` | REMOTE | Install utility functions for safe synchronization |
| `sync-database.sh` | REMOTE | Main synchronization script |
| `test-connection.sh` | BOTH | Test database connectivity |

## 🚀 Step-by-Step Instructions

### Step 1: Test Connection (Both Machines)
```bash
# On LOCAL machine
chmod +x test-connection.sh
./test-connection.sh

# On REMOTE machine (edit DB_USER first)
chmod +x test-connection.sh
# Edit the script to change DB_USER to your remote username
./test-connection.sh
```

### Step 2: Extract Schema (LOCAL Machine)
```bash
# On your LOCAL machine (current machine)
chmod +x extract-schema.sh
./extract-schema.sh
```
This creates an `extracted_schema/` folder with all your database structure.

### Step 3: Transfer Files (LOCAL → REMOTE)
```bash
# Copy the entire db-sync folder to your remote machine
# You can use scp, rsync, or any file transfer method:

scp -r db-sync/ user@remote-machine:/path/to/destination/
# OR
rsync -av db-sync/ user@remote-machine:/path/to/destination/
```

### Step 4: Prepare Remote Database (REMOTE Machine)
```bash
# On REMOTE machine
cd db-sync
chmod +x sync-database.sh

# IMPORTANT: Edit sync-database.sh and update these variables:
# REMOTE_USER="your_username"      # Your PostgreSQL username
# REMOTE_HOST="localhost"          # Usually localhost
# REMOTE_DB="logicbuilders"        # Your database name
```

### Step 5: Install Helper Functions (REMOTE Machine)
```bash
# On REMOTE machine
psql -d logicbuilders -f helper-functions.sql
```

### Step 6: Run Synchronization (REMOTE Machine)
```bash
# On REMOTE machine
./sync-database.sh
```

## 🛡️ Safety Features

- **Automatic Backup**: Creates a backup before any changes
- **Data Preservation**: Only adds/modifies schema, never deletes data
- **Error Handling**: Continues on errors, reports what failed
- **Detailed Logging**: Shows exactly what was added/modified
- **Rollback Capability**: Can restore from backup if needed

## 📊 What Gets Synchronized

✅ **Tables**: Creates missing tables  
✅ **Columns**: Adds missing columns to existing tables  
✅ **Data Types**: Updates column definitions  
✅ **Constraints**: Primary keys, foreign keys, unique, check constraints  
✅ **Indexes**: Database indexes for performance  
✅ **Functions**: Custom PostgreSQL functions  
✅ **Triggers**: Database triggers  
✅ **Sequences**: Auto-increment sequences  

## 🔍 Verification

After sync, check the generated report:
```bash
# View the sync report
cat sync_report_YYYYMMDD_HHMMSS.txt

# Test your application
# If issues occur, restore from backup:
psql -d logicbuilders < backup_before_sync_YYYYMMDD_HHMMSS.sql
```

## ⚠️ Important Notes

1. **Network Access**: Ensure PostgreSQL accepts connections from your source machine
2. **Permissions**: Remote user needs CREATE, ALTER, DROP privileges
3. **Backup**: Always review the backup file location
4. **Testing**: Test on a copy of production data first
5. **Data Types**: Some complex data type changes may need manual intervention

## 🆘 Troubleshooting

### Connection Issues
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check pg_hba.conf for connection permissions
sudo nano /etc/postgresql/*/main/pg_hba.conf

# Check postgresql.conf for listen_addresses
sudo nano /etc/postgresql/*/main/postgresql.conf
```

### Permission Issues
```sql
-- Grant necessary permissions
GRANT CREATE, USAGE ON SCHEMA public TO your_username;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_username;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_username;
```

### Rollback
```bash
# If something goes wrong, restore from backup:
psql -d logicbuilders < backup_before_sync_YYYYMMDD_HHMMSS.sql
```

## 📞 Support

If you encounter issues:
1. Check the sync report for detailed error messages
2. Verify database connections with `test-connection.sh`
3. Review PostgreSQL logs for detailed error information
4. Use the backup to restore if needed

Remember: This sync preserves all your data while updating the schema structure!
