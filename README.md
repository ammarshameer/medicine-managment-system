# Medicine Management System (MMS) - Multi-Tenant SaaS Platform

A comprehensive multi-tenant full-stack solution for managing medicine orders, inventory, and pharmacy operations with both mobile and web interfaces.

## Project Overview

The Medicine Management System (MMS) is a **multi-tenant SaaS platform** that allows multiple pharmacies/medical stores to operate independently on the same platform. The system consists of:
- **Backend API**: Node.js + Express REST API with MySQL database
- **Super Admin Panel**: React.js dashboard for platform administrators
- **Business Owner Panel**: React.js dashboard for pharmacy owners
- **Mobile App**: React Native application for customers/patients
- **Database**: MySQL with multi-tenant schema supporting business isolation

## Multi-Tenant Architecture

### Key Concepts

**Tenant Isolation**: Each pharmacy (business) operates in complete isolation. Data is segregated using a `businessId` foreign key in all relevant tables.

**Role-Based Access Control (RBAC)**:
- **SUPER_ADMIN**: Platform administrator with access to all businesses and platform analytics
- **BUSINESS_OWNER**: Pharmacy owner with full access to their business data
- **STAFF**: Pharmacy staff with limited access to business operations
- **CUSTOMER**: Mobile app users who can browse and order from their selected pharmacy

**Business Code**: Each pharmacy has a unique code that customers use during registration to associate their account with the correct pharmacy.

## Features

### Super Admin Panel
- Platform-wide analytics dashboard
- Business management (CRUD operations)
- View and manage all registered pharmacies
- Activate/deactivate businesses
- Platform revenue and user statistics
- Business owner account management

### Business Owner Panel
- Business-specific analytics dashboard
- Medicine inventory management
- Order processing and fulfillment
- Staff and customer management
- Prescription approval workflow
- Sales and inventory reports
- Business settings and configuration

### Backend API
- Multi-tenant data isolation
- JWT-based authentication with businessId
- Role-based access control (SUPER_ADMIN, BUSINESS_OWNER, STAFF, CUSTOMER)
- Tenant filtering middleware
- Medicine management (CRUD operations)
- Order processing and tracking
- Prescription upload and approval workflow
- Inventory management with stock tracking
- User management and profiles
- Reporting and analytics
- File upload for images and prescriptions

### Mobile App
- User registration with pharmacy code selection
- Browse medicines by category
- Search and filter medicines
- Add to cart and checkout
- Order tracking and history
- Prescription upload functionality
- Profile management
- Address management

## Technology Stack

### Backend
- **Node.js** + **Express.js** - REST API framework
- **MySQL** - Database
- **JWT** - Authentication
- **Multer** - File uploads
- **bcryptjs** - Password hashing
- **express-validator** - Input validation

### Frontend (Admin Web)
- **React.js** - UI framework
- **React Router** - Navigation
- **React Query** - Data fetching
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **Axios** - HTTP client

### Mobile App
- **React Native** - Mobile framework
- **React Navigation** - Navigation
- **Async Storage** - Local storage
- **React Native Paper** - UI components
- **Vector Icons** - Icons

## Project Structure

```
mms/
|-- backend/                 # Node.js API server
|   |-- config/             # Database configuration
|   |-- middleware/         # Custom middleware
|   |-- routes/             # API routes
|   |-- uploads/            # File upload directory
|   |-- package.json
|   |-- server.js           # Main server file
|   |-- .env.example        # Environment variables template
|
|-- admin-web/              # React.js admin panel
|   |-- public/
|   |-- src/
|   |   |-- components/     # Reusable components
|   |   |-- contexts/       # React contexts
|   |   |-- pages/          # Page components
|   |   |-- App.js          # Main app component
|   |   |-- index.js        # Entry point
|   |   |-- index.css       # Global styles
|   |-- package.json
|   |-- tailwind.config.js  # Tailwind configuration
|
|-- mobile-app/             # React Native mobile app
|   |-- src/
|   |   |-- screens/        # Screen components
|   |   |-- contexts/       # React contexts
|   |   |-- App.js          # Main app component
|   |-- package.json
|
|-- database/               # Database scripts
|   |-- schema.sql          # Database schema
|   |-- seed_data.sql       # Sample data
|
|-- README.md               # This file
```

## Installation and Setup

### Prerequisites
- Node.js (v14 or higher)
- MySQL or MariaDB
- React Native development environment (for mobile app)

### Database Setup

#### For New Installation (Multi-Tenant)

1. Create a MySQL database:
```sql
CREATE DATABASE mms_db;
```

2. Import the multi-tenant database schema:
```bash
mysql -u username -p mms_db < database/schema_multi_tenant.sql
```

#### For Existing Single-Tenant Installation (Migration)

If you have an existing single-tenant database and want to migrate to multi-tenant:

1. Backup your existing database:
```bash
mysqldump -u username -p mms_db > backup_before_migration.sql
```

2. Run the migration script:
```bash
mysql -u username -p mms_db < database/migrate_to_multi_tenant.sql
```

**Note**: The migration script will:
- Create a `Businesses` table
- Add `BusinessId` columns to all relevant tables
- Create a default business and link all existing data to it
- Update user roles to the new multi-tenant structure

### Backend Setup

1. Navigate to the backend directory:
```bash
cd mms/backend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Edit `.env` with your database credentials:
```env
DB_HOST=localhost
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=mms_db
JWT_SECRET=your_jwt_secret_key
```

5. Start the server:
```bash
npm run dev
```

The API will be available at `http://localhost:3000`

### Admin Web Panel Setup

1. Navigate to the admin web directory:
```bash
cd mms/admin-web
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The admin panel will be available at `http://localhost:3001`

### Mobile App Setup

1. Navigate to the mobile app directory:
```bash
cd mms/mobile-app
```

2. Install dependencies:
```bash
npm install
```

3. For Android:
```bash
npm run android
```

4. For iOS:
```bash
npm run ios
```

## API Documentation

### Authentication Endpoints

#### POST /api/auth/register
Register a new customer with pharmacy code
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "phone": "1234567890",
  "businessCode": "PHARM001"
}
```

#### POST /api/auth/login
User login (returns JWT with businessId)
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

#### POST /api/auth/super-admin-login
Super Admin login for platform management
```json
{
  "email": "superadmin@mms.com",
  "password": "admin123"
}
```

### Medicine Endpoints

#### GET /api/medicines
Get all medicines with pagination and filtering (tenant-filtered)
```
GET /api/medicines?page=1&limit=20&category=1&search=paracetamol
```

#### POST /api/medicines
Add new medicine (Business Owner only)
```json
{
  "name": "Paracetamol 500mg",
  "categoryId": 1,
  "price": 50.00,
  "stock": 100,
  "description": "Pain relief medication"
}
```

### Super Admin Endpoints

#### GET /api/super-admin/analytics
Get platform-wide analytics (SUPER_ADMIN only)
```
GET /api/super-admin/analytics
```

#### GET /api/super-admin/businesses
Get all businesses (SUPER_ADMIN only)
```
GET /api/super-admin/businesses?page=1&limit=20&status=active
```

#### POST /api/super-admin/businesses
Create new business (SUPER_ADMIN only)
```json
{
  "businessName": "City Pharmacy",
  "businessCode": "PHARM001",
  "ownerName": "John Smith",
  "ownerEmail": "john@pharm.com",
  "ownerPhone": "1234567890",
  "address": "123 Main St",
  "city": "New York",
  "subscriptionPlan": "premium"
}
```

#### GET /api/super-admin/businesses/:businessId
Get business details (SUPER_ADMIN only)
```
GET /api/super-admin/businesses/1
```

#### PATCH /api/super-admin/businesses/:businessId/status
Toggle business status (SUPER_ADMIN only)
```json
{
  "isActive": false
}
```

### Order Endpoints

#### POST /api/orders
Create new order
```json
{
  "items": [
    {
      "medicineId": 1,
      "quantity": 2
    }
  ],
  "deliveryAddress": "123 Main St, City",
  "paymentMethod": "Cash on Delivery"
}
```

#### GET /api/orders/my-orders
Get user's orders
```
GET /api/orders/my-orders?page=1&limit=10
```

## Default Credentials

### Super Admin Panel
- **Email**: superadmin@mms.com
- **Password**: admin123

### Business Owner Panel
- **Email**: owner@pharm.com
- **Password**: owner123

### Mobile App (Demo Users)
- **Email**: customer@email.com
- **Password**: customer123
- **Pharmacy Code**: PHARM001

## Features Implementation Status

### Multi-Tenant Architecture
- [x] Database schema with Businesses table
- [x] Tenant isolation via businessId foreign keys
- [x] JWT tokens with businessId
- [x] Tenant filtering middleware
- [x] Role-based access control (SUPER_ADMIN, BUSINESS_OWNER, STAFF, CUSTOMER)
- [x] Business code for customer registration
- [x] Database migration script for existing installations

### Backend API
- [x] Multi-tenant data isolation
- [x] User authentication and authorization
- [x] Medicine management (CRUD) with tenant filtering
- [x] Order management with tenant filtering
- [x] Prescription upload and approval with tenant filtering
- [x] Inventory management with tenant filtering
- [x] User management with tenant filtering
- [x] Category management with tenant filtering
- [x] Super Admin routes for business management
- [x] Platform-wide analytics
- [x] File upload functionality

### Super Admin Panel
- [x] Platform-wide analytics dashboard
- [x] Business listing with search and filters
- [x] Business creation and editing
- [x] Business details view
- [x] Business activation/deactivation
- [x] Business deletion
- [x] User management per business

### Business Owner Panel
- [x] Business-specific analytics dashboard
- [x] Medicine management interface with tenant filtering
- [x] Order management with tenant filtering
- [x] User management with tenant filtering
- [x] Prescription approval workflow
- [x] Responsive design
- [ ] Complete reporting interface (placeholder)

### Mobile App
- [x] User authentication with pharmacy code
- [x] Medicine browsing and search
- [x] Cart functionality
- [x] Order placement
- [x] Order tracking
- [x] Profile management
- [x] Prescription upload interface
- [ ] Complete checkout flow (placeholder)
- [ ] Payment integration (placeholder)

## Security Features

- JWT-based authentication with businessId
- Password hashing with bcrypt
- Multi-tenant data isolation
- Role-based access control (RBAC)
- Tenant filtering middleware
- Input validation and sanitization
- Rate limiting
- File upload security
- CORS configuration
- Soft deletion for data integrity

## Future Enhancements

- Online payment gateway integration (Stripe, PayPal)
- Push notifications for order updates
- Subscription management and billing
- AI-based medicine suggestions
- Advanced analytics dashboard with charts
- Real-time inventory updates via WebSockets
- Delivery tracking integration
- Multi-language support
- Email notifications
- SMS verification
- Two-factor authentication
- Audit logging for compliance

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please contact the development team or create an issue in the repository.

---

**Note**: This is a comprehensive medicine management system suitable for pharmacies, medical stores, and healthcare facilities. The system is designed to be scalable, secure, and user-friendly.
# medicine-managment-system
