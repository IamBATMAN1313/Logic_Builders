# LogicBuilders Admin Dashboard

A separate React frontend application for LogicBuilders admin management with role-based access control.

## Features

- **Role-based Authentication**: Secure login with employee ID and password
- **Clearance Levels**: Six different clearance levels with specific permissions
- **Dashboard**: Overview of key business metrics and quick actions
- **Modular Design**: Separate pages for different admin functions

## Clearance Levels

1. **GENERAL_MANAGER** - Full system access, can manage all admins and settings
2. **ANALYTICS** - Access to analytics, reports, and business intelligence  
3. **PROMO_MANAGER** - Manage promotions, discounts, and marketing campaigns
4. **ORDER_MANAGER** - Process orders, handle shipping and returns
5. **PRODUCT_EXPERT** - Manage product catalog, descriptions, and categories
6. **INVENTORY_MANAGER** - Control stock levels, inventory tracking, and restocking

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- LogicBuilders backend server running on port 5000

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm start
   ```

3. Open [http://localhost:3001](http://localhost:3001) to view the admin dashboard

### Default Admin Login

- **Employee ID**: EMP001
- **Password**: admin123
- **Clearance**: GENERAL_MANAGER

## Available Scripts

- `npm start` - Runs the app in development mode
- `npm run build` - Builds the app for production
- `npm test` - Launches the test runner
- `npm run eject` - Ejects from Create React App (one-way operation)

## Project Structure

```
admin/
├── public/
├── src/
│   ├── components/
│   │   └── AdminLayout.js       # Main layout with sidebar
│   ├── pages/
│   │   ├── Dashboard.js         # Main dashboard
│   │   ├── Login.js            # Admin login page
│   │   ├── Inventory.js        # Inventory management
│   │   ├── Products.js         # Product management
│   │   ├── Orders.js           # Order management
│   │   ├── Promotions.js       # Promotion management
│   │   ├── Analytics.js        # Analytics and reports
│   │   └── AdminManagement.js  # Admin user management
│   ├── contexts/
│   │   └── AdminAuthContext.js # Authentication context
│   └── utils/
├── package.json
└── README.md
```

## API Endpoints

The admin app communicates with these backend endpoints:

- `POST /api/admin/login` - Admin authentication
- `GET /api/admin/validate` - Validate admin token  
- `GET /api/admin/dashboard/stats` - Dashboard statistics
- `GET /api/admin/admins` - List all admin users (GENERAL_MANAGER only)
- `POST /api/admin/admins` - Create new admin (GENERAL_MANAGER only)
- `PUT /api/admin/admins/:id` - Update admin (GENERAL_MANAGER only)

## Security Features

- JWT token-based authentication
- Role-based access control
- Automatic token validation
- Secure password hashing
- Session management

## Development

The admin app runs on port 3001 by default and proxies API requests to the backend server on port 5000.

To run both the main client app and admin app simultaneously:

1. Terminal 1: `cd client && npm start` (runs on port 3000)
2. Terminal 2: `cd admin && npm start` (runs on port 3001)  
3. Terminal 3: `cd server && npm run dev` (backend on port 5000)
