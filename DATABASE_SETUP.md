# 📋 LogicBuilders Database Schema

## Overview
This `schema.sql` file contains the complete database structure for the LogicBuilders e-commerce platform. Running this file will create all tables, views, functions, procedures, and triggers needed for the application.

## Database Components Included

### 🗄️ **Tables (30+ Tables)**
- **User Management**: `general_user`, `admin`, `customer`
- **Product Management**: `product`, `product_category`, `product_attribute`
- **Order Management**: `order`, `order_item`, `shipping_address`
- **Cart System**: `cart`, `cart_item`
- **Build System**: `build`, `build_product`, `compatibility_rules`
- **Messaging**: `conversation`, `message`, `conversation_participant`
- **Ratings & Reviews**: `ratings`, `product_qa`, `qa_answer`
- **Points & Vouchers**: `customer_points`, `points_transaction`, `voucher`
- **Promotions**: `promotion`, `promotion_usage`, `coupon`
- **Notifications**: `notification`, `admin_notifications`
- **Access Control**: `access_levels`, `admin_logs`

### 🔧 **Functions (15+ Functions)**
- `award_points_for_order()` - Points system automation
- `check_cart_stock()` - Inventory validation
- `check_order_stock()` - Order stock verification
- `handle_order_stock()` - Stock management
- `notify_order_status_change()` - Order notifications
- `notify_qa_answered()` - Q&A notifications
- `redeem_voucher()` - Voucher redemption logic
- `sync_all_product_availability()` - Inventory sync
- `update_product_availability()` - Product availability updates
- `validate_rating_eligibility()` - Rating validation

### 📊 **Views (4 Views)**
- `active_notifications` - User notification view
- `admin_qa_management` - Admin Q&A management
- `low_stock_products` - Inventory monitoring
- `product_ratings_summary` - Product rating aggregation

### ⚡ **Triggers (30+ Triggers)**
- Stock management triggers
- Notification triggers
- Data validation triggers
- Timestamp update triggers
- Points calculation triggers

## 🚀 Quick Setup

### Prerequisites
- PostgreSQL 12+ installed
- Database user with CREATE privileges
- `uuid-ossp` extension support

### Installation Steps

1. **Create Database**
   ```bash
   createdb logicbuilders_db
   ```

2. **Run Schema**
   ```bash
   psql -d logicbuilders_db -f schema.sql
   ```

3. **Verify Installation**
   ```sql
   \dt  -- List tables
   \df  -- List functions  
   \dv  -- List views
   ```

### Alternative Setup (with user creation)
```bash
# Connect as superuser
sudo -u postgres psql

# Create user and database
CREATE USER your_username WITH PASSWORD 'your_password';
CREATE DATABASE logicbuilders_db OWNER your_username;
GRANT ALL PRIVILEGES ON DATABASE logicbuilders_db TO your_username;

# Exit and connect as new user
\q
psql -U your_username -d logicbuilders_db -f schema.sql
```

## 🔧 Configuration

### Environment Variables
Update your application's database configuration:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=logicbuilders_db
DB_USER=your_username
DB_PASSWORD=your_password
```

### Database Connection (Node.js)
```javascript
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'your_username',
  password: process.env.DB_PASSWORD || 'your_password',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'logicbuilders_db'
});
```

## 📊 Key Features

### 🔐 **Security Features**
- UUID-based primary keys
- Role-based access control
- Admin authentication system
- Input validation triggers

### 🛒 **E-commerce Features**
- Complete product catalog
- Shopping cart functionality
- Order management system
- Inventory tracking
- Promotion and coupon system

### 🖥️ **PC Build System**
- Custom PC build creation
- Component compatibility checking
- Build validation rules
- Product recommendations

### 💬 **Communication**
- Customer support messaging
- Q&A system for products
- Notification system
- Admin messaging tools

### 🎯 **Business Intelligence**
- Product rating aggregation
- Sales analytics foundation
- Inventory monitoring
- Admin activity logging

## 🗂️ **Sample Data**

After running the schema, you may want to populate it with sample data:

1. **Categories**: Add product categories
2. **Products**: Add sample products
3. **Admin User**: Create initial admin account
4. **Test Customer**: Create test customer accounts

## 🔍 **Verification Queries**

Check if everything was created successfully:

```sql
-- Count tables
SELECT COUNT(*) as table_count FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- Count functions
SELECT COUNT(*) as function_count FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';

-- Count views
SELECT COUNT(*) as view_count FROM information_schema.views 
WHERE table_schema = 'public';

-- Check extensions
SELECT * FROM pg_extension WHERE extname = 'uuid-ossp';
```

## 🐛 **Troubleshooting**

### Common Issues:

1. **Permission Errors**
   ```bash
   GRANT ALL ON SCHEMA public TO your_username;
   ```

2. **Extension Missing**
   ```sql
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```

3. **Function Conflicts**
   ```sql
   DROP FUNCTION IF EXISTS function_name CASCADE;
   ```

## 📝 **Notes**

- This schema is optimized for PostgreSQL 12+
- All timestamps use UTC
- UUIDs are used for primary keys
- Triggers handle data consistency
- Views provide optimized queries for common operations

## 🔄 **Maintenance**

To keep the database structure updated:
1. Backup your data before schema changes
2. Test schema modifications in development
3. Use migrations for production updates
4. Monitor trigger performance

---

**Created for LogicBuilders E-commerce Platform**  
**Compatible with: PostgreSQL 12+**  
**Last Updated: August 2025**
