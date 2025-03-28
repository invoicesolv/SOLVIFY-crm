# Vibe CRM Pages Documentation

## Public Pages

### Landing Page (`/landing`, `/sv`)
- Main marketing page
- Available in English (`/landing`) and Swedish (`/sv`)
- Features product information, pricing, and contact details
- Accessible to all users

### Login Page (`/login`)
- User authentication page
- Features:
  - Email/Password login
  - Google OAuth login
  - Link to registration page
- Redirects to dashboard after successful login

### Registration Page (`/register`)
- New user registration
- Features:
  - Email/Password registration
  - Google OAuth registration
  - Company name (optional)
  - Free trial signup
- Redirects to dashboard after successful registration

## Protected Pages (Requires Authentication)

### Dashboard Page (`/`)
- Main application interface
- Features:
  - Revenue overview
  - Customer statistics
  - Recent invoices
  - Task management
  - Analytics data

### Customers Page (`/customers`)
- Customer management interface
- Features:
  - Customer list
  - Customer details
  - Add/Edit customers

### Projects Page (`/projects`)
- Project management
- Features:
  - Project overview
  - Task tracking
  - Project timelines

### Invoices Page (`/invoices`)
- Invoice management
- Features:
  - Create/Edit invoices
  - Invoice status tracking
  - Payment history

### Receipts Page (`/receipts`)
- Receipt management
- Features:
  - Upload/Store receipts
  - Receipt categorization
  - Expense tracking

### Transactions Page (`/transactions`)
- Financial transaction tracking
- Features:
  - Transaction history
  - Transaction categorization
  - Financial reporting

### Domains Page (`/domains`)
- Domain management
- Features:
  - Domain list
  - Domain status
  - Domain analytics

### Marketing Page (`/marketing`)
- Marketing tools and analytics
- Features:
  - Campaign management
  - Marketing metrics
  - Performance tracking

### Calendar Page (`/calendar`)
- Schedule management
- Features:
  - Event scheduling
  - Meeting management
  - Task deadlines

### Profile Page (`/profile`)
- User profile management
- Features:
  - Personal information
  - Account settings
  - Preferences

### Settings Page (`/settings`)
- Application settings
- Features:
  - Integration management
  - API configurations
  - Account preferences

## Authentication Flow

1. **New Users**:
   - Register via `/register`
   - Complete profile information
   - Redirected to dashboard

2. **Existing Users**:
   - Login via `/login`
   - Redirected to dashboard or requested page

3. **Logout**:
   - Redirects to `/login`
   - Clears session

## Protected Routes
- All routes except `/landing`, `/login`, `/register`, and `/sv` require authentication
- Unauthorized access redirects to login page
- Authenticated users accessing public pages are redirected to dashboard 