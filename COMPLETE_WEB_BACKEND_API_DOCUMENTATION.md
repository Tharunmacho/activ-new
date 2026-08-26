# ACTIV Web Application - Complete Backend Workflow & API Documentation

**Project:** ACTIV Web Application  
**Backend Framework:** Node.js + Express.js  
**Database:** MongoDB Atlas (activ-db)  
**Port:** 4000  
**Version:** 1.0.0  
**Last Updated:** December 18, 2025  

---

## 📚 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Structure](#database-structure)
3. [Authentication Flow](#authentication-flow)
4. [API Endpoints](#api-endpoints)
5. [Frontend-Backend Integration](#frontend-backend-integration)
6. [Data Flow Diagrams](#data-flow-diagrams)
7. [Error Handling](#error-handling)

---

## 🏗️ Architecture Overview

### Backend Structure
```
server/
├── server.js                      # Main application entry
├── config/
│   └── database.js               # MongoDB connection
├── models/                        # Mongoose schemas
│   ├── WebUser.js                # Authentication (email + password)
│   ├── WebUserProfile.js         # User profile data
│   ├── PersonalForm.js           # Personal information form
│   ├── BusinessForm.js           # Business information form
│   ├── FinancialForm.js          # Financial information form
│   ├── DeclarationForm.js        # Declaration form
│   ├── Company.js                # Company/business entity
│   ├── Product.js                # Product catalog
│   └── Location.js               # India states/districts/blocks
├── routes/                        # API route handlers
│   ├── authRoutes.js
│   ├── profileRoutes.js
│   ├── personalFormRoutes.js
│   ├── businessFormRoutes.js
│   ├── financialFormRoutes.js
│   ├── declarationFormRoutes.js
│   ├── companyRoutes.js
│   ├── productRoutes.js
│   └── locationRoutes.js
├── controllers/                   # Business logic
│   └── (mirrors routes/)
└── middleware/
    ├── auth.js                   # JWT verification
    └── errorHandler.js           # Global error handling
```

### Tech Stack
```
Backend:     Node.js 18.x + Express.js 4.x
Database:    MongoDB Atlas (Cloud)
ORM:         Mongoose 7.x
Auth:        JWT (jsonwebtoken)
Validation:  express-validator
Security:    bcryptjs (password hashing)
CORS:        cors middleware
Environment: dotenv
```

---

## 🗄️ Database Structure

### MongoDB Atlas Configuration
```
Connection URL: mongodb+srv://activapp2025_db_user:password@cluster1.gf7usct.mongodb.net/activ-db
Database Name: activ-db
```

### Collections

#### 1. `web auth` - Authentication Credentials
```javascript
{
  _id: ObjectId,
  email: String (unique, required),
  password: String (hashed with bcrypt, required),
  isActive: Boolean (default: true),
  createdAt: Date,
  updatedAt: Date
}
```
**Purpose:** Stores only email and password for authentication (security best practice)

#### 2. `web users` - User Profile Data
```javascript
{
  _id: ObjectId,
  userId: ObjectId (reference to web auth),
  email: String (unique, required),
  fullName: String,
  phoneNumber: String,
  state: String,
  district: String,
  block: String,
  city: String,
  role: String (enum: ['member', 'block_admin', 'district_admin', 'state_admin', 'super_admin']),
  isActive: Boolean (default: true),
  createdAt: Date,
  updatedAt: Date
}
```
**Purpose:** Stores all user profile information linked to auth credentials

#### 3. `additional form for personal information 1` - Personal Form
```javascript
{
  _id: ObjectId,
  userId: ObjectId (reference to web auth),
  name: String,
  phoneNumber: String,
  email: String,
  state: String,
  district: String,
  block: String,
  city: String,
  religion: String,
  socialCategory: String,
  isLocked: Boolean (default: false),
  createdAt: Date,
  updatedAt: Date
}
```
**Purpose:** Step 1 of profile completion - Personal details

#### 4. `additional form for bussiness 2` - Business Form
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  doingBusiness: String ('yes' | 'no'),
  organization: String,
  constitution: String,
  businessTypes: Array<String>,
  businessYear: String,
  employees: String,
  chamber: String,
  chamberDetails: String,
  govtOrgs: Array<String>,
  createdAt: Date,
  updatedAt: Date
}
```
**Purpose:** Step 2 - Business information (determines if user is aspirant or business member)

#### 5. `additional form for financial 3` - Financial Form
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  pan: String,
  gst: String,
  udyam: String,
  filedITR: String,
  itrYears: String,
  filedGST: String,
  gstYears: String,
  turnoverRange: String,
  investmentInMachinery: String,
  benefitOfGovtScheme: String,
  createdAt: Date,
  updatedAt: Date
}
```
**Purpose:** Step 3 - Financial & compliance data (only for business members, skipped for aspirants)

#### 6. `additional form for declaration 4` - Declaration Form
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  remarks: String,
  declarationAccepted: Boolean (required: true),
  createdAt: Date,
  updatedAt: Date
}
```
**Purpose:** Step 4 (or Step 3 for aspirants) - Final declaration

#### 7. `companies` - Business Companies
```javascript
{
  _id: ObjectId,
  userId: ObjectId (owner),
  companyName: String (required),
  businessCategory: String,
  email: String,
  phoneNumber: String,
  website: String,
  description: String,
  address: String,
  city: String,
  state: String,
  pincode: String,
  isActive: Boolean (default: true),
  createdAt: Date,
  updatedAt: Date
}
```
**Purpose:** Business companies created by members (multi-company support)

#### 8. `products` - Product Catalog
```javascript
{
  _id: ObjectId,
  companyId: ObjectId (reference to companies),
  userId: ObjectId (owner),
  name: String (required),
  description: String,
  category: String,
  price: Number,
  unit: String,
  images: Array<String> (image URLs),
  specifications: Object,
  availability: String,
  minimumOrder: String,
  isActive: Boolean (default: true),
  views: Number (default: 0),
  createdAt: Date,
  updatedAt: Date
}
```
**Purpose:** Products/services offered by companies

#### 9. `locations` - India Location Data
```javascript
{
  _id: ObjectId,
  state: String,
  districts: Array<{
    name: String,
    blocks: Array<String>
  }>
}
```
**Purpose:** Hierarchical location data for dropdowns

---

## 🔐 Authentication Flow

### Registration Flow
```
1. User fills registration form
   ↓
2. Frontend: POST /api/auth/register
   Body: { fullName, email, phoneNumber, password, confirmPassword, state, district, block, city }
   ↓
3. Backend validates:
   - All required fields present
   - Email format valid
   - Password minimum 6 characters
   - Password matches confirmPassword
   - Email doesn't already exist
   ↓
4. Backend creates two records:
   - web auth: { email, password (hashed) }
   - web users: { userId, email, fullName, phoneNumber, state, district, block, city, role: 'member' }
   ↓
5. Backend generates JWT token (24-hour expiry)
   ↓
6. Backend returns: { success: true, token, user }
   ↓
7. Frontend stores:
   - localStorage.setItem('token', token)
   - localStorage.setItem('memberId', user.id)
   - localStorage.setItem('userName', user.fullName)
   ↓
8. Frontend redirects to /member/dashboard
```

### Login Flow
```
1. User enters email + password
   ↓
2. Frontend: POST /api/auth/login
   Body: { email, password }
   ↓
3. Backend finds user in 'web auth' collection
   ↓
4. Backend compares password (bcrypt.compare)
   ↓
5. Backend checks if user is active
   ↓
6. Backend fetches profile from 'web users' collection (using userId)
   ↓
7. Backend generates JWT token
   ↓
8. Backend returns: { success: true, token, user: { id, fullName, email, phoneNumber, role } }
   ↓
9. Frontend stores token and user data in localStorage
   ↓
10. Frontend redirects based on role:
    - member → /member/dashboard
    - block_admin → /admin/dashboard
    - etc.
```

### JWT Token Structure
```javascript
{
  userId: "ObjectId",
  email: "user@example.com",
  iat: 1702886400,  // Issued at
  exp: 1702972800   // Expires in 24 hours
}
```

### Protected Route Flow
```
1. Frontend makes API request with Authorization header
   Headers: { Authorization: 'Bearer <token>' }
   ↓
2. Backend middleware (auth.js) extracts token
   ↓
3. Backend verifies token using JWT_SECRET
   ↓
4. If valid: Decode token → Attach user to req.user → Continue
   ↓
5. If invalid: Return 401 Unauthorized
```

---

## 📡 API Endpoints

### Base URL
```
Development: http://localhost:4000/api
```

---

### 1. Authentication Routes (`/api/auth`)

#### POST /api/auth/register
**Purpose:** New user registration  
**Authentication:** None  
**Frontend Files:** `src/pages/Register.tsx`

**Request:**
```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "phoneNumber": "9876543210",
  "password": "password123",
  "confirmPassword": "password123",
  "state": "Karnataka",
  "district": "Bangalore Urban",
  "block": "Bangalore North",
  "city": "Bangalore"
}
```

**Response (Success - 201):**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": "6942b0e607b72144ee8856ab",
      "email": "john@example.com"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Response (Error - 400):**
```json
{
  "success": false,
  "message": "Email already registered"
}
```

**Backend Files:**
- Route: `server/routes/authRoutes.js`
- Controller: `server/controllers/authController.js`
- Models: `server/models/WebUser.js`, `server/models/WebUserProfile.js`

---

#### POST /api/auth/login
**Purpose:** User login  
**Authentication:** None  
**Frontend Files:** `src/components/EnhancedLoginPage.tsx`, `src/pages/member/Login.tsx`

**Request:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "6942b0e607b72144ee8856ab",
      "fullName": "John Doe",
      "email": "john@example.com",
      "phoneNumber": "9876543210",
      "role": "member"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Response (Error - 401):**
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

**Frontend Usage:**
```typescript
// EnhancedLoginPage.tsx (Line 98, 192)
const res = await fetch('http://localhost:4000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

if (res.ok) {
  const data = await res.json();
  localStorage.setItem('token', data.data.token);
  localStorage.setItem('memberId', data.data.user.id);
  localStorage.setItem('userName', data.data.user.fullName);
  navigate('/member/dashboard');
}
```

---

#### GET /api/auth/me
**Purpose:** Get current user details  
**Authentication:** Required (JWT)  
**Frontend Files:** Used internally

**Request Headers:**
```
Authorization: Bearer <token>
```

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "id": "6942b0e607b72144ee8856ab",
    "email": "john@example.com",
    "fullName": "John Doe",
    "phoneNumber": "9876543210",
    "role": "member"
  }
}
```

---

### 2. Profile Routes (`/api/profile`)

#### GET /api/profile/:userId
**Purpose:** Get user profile by ID  
**Authentication:** Required  
**Frontend Files:** `src/pages/member/Login.tsx` (Line 106)

**Request:**
```
GET /api/profile/6942b0e607b72144ee8856ab
Headers: { Authorization: 'Bearer <token>' }
```

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "_id": "6942b0e607b72144ee8856ab",
    "userId": "6942b0e607b72144ee8856ab",
    "email": "john@example.com",
    "fullName": "John Doe",
    "phoneNumber": "9876543210",
    "state": "Karnataka",
    "district": "Bangalore Urban",
    "block": "Bangalore North",
    "city": "Bangalore",
    "role": "member",
    "isActive": true
  }
}
```

---

#### POST /api/profile
**Purpose:** Create or update profile  
**Authentication:** Required  
**Frontend Files:** `src/pages/member/Login.tsx` (Line 130)

**Request:**
```json
{
  "userId": "6942b0e607b72144ee8856ab",
  "fullName": "John Doe Updated",
  "phoneNumber": "9876543210",
  "state": "Karnataka",
  "district": "Bangalore Urban",
  "block": "Bangalore North",
  "city": "Bangalore"
}
```

**Response (Success - 200/201):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": { /* updated profile */ }
}
```

---

### 3. Personal Form Routes (`/api/personal-form`)

#### GET /api/personal-form
**Purpose:** Get user's personal form data  
**Authentication:** Required  
**Frontend Files:** `src/pages/member/Profile.tsx` (Line 136), `src/pages/member/PersonalForm.tsx` (Line 86)

**Request Headers:**
```
Authorization: Bearer <token>
```

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "userId": "6942b0e607b72144ee8856ab",
    "name": "John Doe",
    "phoneNumber": "9876543210",
    "email": "john@example.com",
    "state": "Karnataka",
    "district": "Bangalore Urban",
    "block": "Bangalore North",
    "city": "Bangalore",
    "religion": "Hindu",
    "socialCategory": "General",
    "isLocked": true
  }
}
```

**Response (No Data - 200):**
```json
{
  "success": true,
  "data": null
}
```

---

#### POST /api/personal-form
**Purpose:** Save personal form data  
**Authentication:** Required  
**Frontend Files:** `src/pages/member/Profile.tsx` (Line 417), `src/pages/member/PersonalForm.tsx` (Line 123)

**Request:**
```json
{
  "name": "John Doe",
  "phoneNumber": "9876543210",
  "email": "john@example.com",
  "state": "Karnataka",
  "district": "Bangalore Urban",
  "block": "Bangalore North",
  "city": "Bangalore",
  "religion": "Hindu",
  "socialCategory": "General",
  "isLocked": true
}
```

**Response (Success - 200/201):**
```json
{
  "success": true,
  "message": "Personal form saved successfully",
  "data": { /* saved form data */ }
}
```

**Frontend Usage:**
```typescript
// Profile.tsx (Line 417)
const saveResponse = await fetch("http://localhost:4000/api/personal-form", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify(personalData)
});
```

---

### 4. Business Form Routes (`/api/business-form`)

#### GET /api/business-form
**Purpose:** Get user's business form data  
**Authentication:** Required  
**Frontend Files:** `src/pages/member/Profile.tsx` (Line 201), `src/pages/member/BusinessForm.tsx` (Line 57)

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "userId": "6942b0e607b72144ee8856ab",
    "doingBusiness": "yes",
    "organization": "Acme Corp",
    "constitution": "Private Limited",
    "businessTypes": ["Manufacturing", "Trading"],
    "businessYear": "2020",
    "employees": "11-50",
    "chamber": "yes",
    "chamberDetails": "ICC Member",
    "govtOrgs": ["MSME"]
  }
}
```

---

#### POST /api/business-form
**Purpose:** Save business form data  
**Authentication:** Required  
**Frontend Files:** `src/pages/member/Profile.tsx` (Line 469, 558), `src/pages/member/BusinessForm.tsx` (Line 110)

**Request (Business Member):**
```json
{
  "doingBusiness": "yes",
  "organization": "Acme Corp",
  "constitution": "Private Limited",
  "businessTypes": ["Manufacturing", "Trading"],
  "businessYear": "2020",
  "employees": "11-50",
  "chamber": "yes",
  "chamberDetails": "ICC Member",
  "govtOrgs": ["MSME"]
}
```

**Request (Aspirant - Student/Non-business):**
```json
{
  "doingBusiness": "no"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Business form saved successfully",
  "data": { /* saved form */ }
}
```

**Key Logic:**
- If `doingBusiness === "no"`: User is an aspirant, skip financial form
- If `doingBusiness === "yes"`: User is business member, complete all 4 forms

---

### 5. Financial Form Routes (`/api/financial-form`)

#### GET /api/financial-form
**Purpose:** Get user's financial form data  
**Authentication:** Required  
**Frontend Files:** `src/pages/member/FinancialForm.tsx` (Line 63)

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "userId": "6942b0e607b72144ee8856ab",
    "pan": "ABCDE1234F",
    "gst": "27ABCDE1234F1Z5",
    "udyam": "UDYAM-KA-12-1234567",
    "filedITR": "yes",
    "itrYears": "3",
    "filedGST": "yes",
    "gstYears": "2",
    "turnoverRange": "1-5 Crore",
    "investmentInMachinery": "50 Lakh",
    "benefitOfGovtScheme": "yes"
  }
}
```

---

#### POST /api/financial-form
**Purpose:** Save financial form data  
**Authentication:** Required  
**Frontend Files:** `src/pages/member/Profile.tsx` (Line 612), `src/pages/member/FinancialForm.tsx` (Line 88)

**Request:**
```json
{
  "pan": "ABCDE1234F",
  "gst": "27ABCDE1234F1Z5",
  "udyam": "UDYAM-KA-12-1234567",
  "filedITR": "yes",
  "itrYears": "3",
  "filedGST": "yes",
  "gstYears": "2",
  "turnoverRange": "1-5 Crore",
  "investmentInMachinery": "50 Lakh",
  "benefitOfGovtScheme": "yes"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Financial form saved successfully",
  "data": { /* saved form */ }
}
```

**Note:** This form is **only for business members**. Aspirants skip this step.

---

### 6. Declaration Form Routes (`/api/declaration-form`)

#### GET /api/declaration-form
**Purpose:** Get user's declaration form data  
**Authentication:** Required  
**Frontend Files:** `src/pages/member/DeclarationForm.tsx` (Line 43)

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "userId": "6942b0e607b72144ee8856ab",
    "remarks": "I agree to all terms",
    "declarationAccepted": true,
    "createdAt": "2025-12-18T07:30:00.000Z"
  }
}
```

---

#### POST /api/declaration-form
**Purpose:** Save declaration and complete application  
**Authentication:** Required  
**Frontend Files:** `src/pages/member/Profile.tsx` (Line 493, 653), `src/pages/member/DeclarationForm.tsx` (Line 93)

**Request:**
```json
{
  "remarks": "I agree to all terms and conditions",
  "declarationAccepted": true
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Declaration submitted successfully",
  "data": { /* saved declaration */ }
}
```

**Frontend Flow After Submission:**
```typescript
// Profile.tsx (Line 653)
const response = await fetch("http://localhost:4000/api/declaration-form", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify(declarationData)
});

if (response.ok) {
  // Generate application ID
  const applicationId = `APP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  localStorage.setItem('applicationId', applicationId);
  
  // Redirect to application submitted screen
  navigate('/member/application-submitted');
}
```

---

### 7. Company Routes (`/api/companies`)

#### GET /api/companies
**Purpose:** Get all companies for logged-in user  
**Authentication:** Required  
**Frontend Files:** 
- `src/pages/business/Dashboard.tsx` (Line 24)
- `src/pages/business/MyCompanies.tsx` (Line 53)
- `src/pages/business/Analytics.tsx` (Line 24)

**Request Headers:**
```
Authorization: Bearer <token>
```

**Response (Success - 200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "userId": "6942b0e607b72144ee8856ab",
      "companyName": "Acme Corporation",
      "businessCategory": "Manufacturing",
      "email": "contact@acme.com",
      "phoneNumber": "9876543210",
      "website": "https://acme.com",
      "description": "Leading manufacturer",
      "address": "123 Main St",
      "city": "Bangalore",
      "state": "Karnataka",
      "pincode": "560001",
      "isActive": true,
      "createdAt": "2025-12-18T07:00:00.000Z"
    }
  ]
}
```

---

#### GET /api/companies/active
**Purpose:** Get currently active company  
**Authentication:** Required  
**Frontend Files:**
- `src/pages/business/BusinessProfile.tsx` (Line 35)
- `src/pages/business/Settings.tsx` (Line 42)

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "companyName": "Acme Corporation",
    "businessCategory": "Manufacturing",
    "isActive": true,
    /* other fields */
  }
}
```

**Response (No Active Company - 404):**
```json
{
  "success": false,
  "message": "No active company found"
}
```

---

#### GET /api/companies/:id
**Purpose:** Get single company details  
**Authentication:** Required  
**Frontend Files:**
- `src/pages/business/CompanyDetails.tsx` (Line 51)
- `src/pages/business/AddEditCompany.tsx` (Line 56)

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "companyName": "Acme Corporation",
    "businessCategory": "Manufacturing",
    /* all company fields */
  }
}
```

---

#### POST /api/companies
**Purpose:** Create new company  
**Authentication:** Required  
**Frontend Files:** `src/pages/business/BusinessProfile.tsx` (Line 113)

**Request:**
```json
{
  "companyName": "New Company Ltd",
  "businessCategory": "Trading",
  "email": "info@newcompany.com",
  "phoneNumber": "9876543210",
  "website": "https://newcompany.com",
  "description": "Trading company",
  "address": "456 Another St",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001"
}
```

**Response (Success - 201):**
```json
{
  "success": true,
  "message": "Company created successfully",
  "data": { /* created company */ }
}
```

---

#### PUT /api/companies/:id
**Purpose:** Update company details  
**Authentication:** Required  
**Frontend Files:**
- `src/pages/business/Settings.tsx` (Line 89)

**Request:**
```json
{
  "companyName": "Updated Company Name",
  "description": "Updated description",
  /* fields to update */
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Company updated successfully",
  "data": { /* updated company */ }
}
```

---

#### DELETE /api/companies/:id
**Purpose:** Delete/deactivate company  
**Authentication:** Required  
**Frontend Files:** `src/pages/business/MyCompanies.tsx` (Line 77)

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Company deleted successfully"
}
```

---

#### POST /api/companies/:id/set-active
**Purpose:** Set company as active (switch between companies)  
**Authentication:** Required  
**Frontend Files:**
- `src/pages/business/MyCompanies.tsx` (Line 101)
- `src/pages/business/CompanyDetails.tsx` (Line 85)

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Company set as active",
  "data": { /* updated company */ }
}
```

**Frontend Usage:**
```typescript
// MyCompanies.tsx (Line 101)
const response = await fetch(`http://localhost:4000/api/companies/${companyId}/set-active`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

---

### 8. Product Routes (`/api/products`)

#### GET /api/products
**Purpose:** Get all products for logged-in user  
**Authentication:** Required  
**Frontend Files:**
- `src/pages/business/Products.tsx` (Line 24)
- `src/pages/business/Dashboard.tsx` (Line 36)
- `src/pages/business/Analytics.tsx` (Line 21)

**Response (Success - 200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "companyId": "...",
      "userId": "6942b0e607b72144ee8856ab",
      "name": "Product ABC",
      "description": "High quality product",
      "category": "Electronics",
      "price": 5000,
      "unit": "piece",
      "images": ["url1", "url2"],
      "specifications": {
        "weight": "2kg",
        "dimensions": "30x20x10"
      },
      "availability": "In Stock",
      "minimumOrder": "10 units",
      "isActive": true,
      "views": 150,
      "createdAt": "2025-12-18T08:00:00.000Z"
    }
  ]
}
```

---

#### GET /api/products/:id
**Purpose:** Get single product details  
**Authentication:** Required  
**Frontend Files:** `src/pages/business/EditProduct.tsx` (Line 38)

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "name": "Product ABC",
    /* all product fields */
  }
}
```

---

#### POST /api/products
**Purpose:** Create new product  
**Authentication:** Required  
**Frontend Files:** `src/pages/business/AddProduct.tsx` (Line 88)

**Request:**
```json
{
  "companyId": "...",
  "name": "New Product",
  "description": "Product description",
  "category": "Electronics",
  "price": 5000,
  "unit": "piece",
  "images": [],
  "specifications": {},
  "availability": "In Stock",
  "minimumOrder": "5 units"
}
```

**Response (Success - 201):**
```json
{
  "success": true,
  "message": "Product created successfully",
  "data": { /* created product */ }
}
```

---

#### PUT /api/products/:id
**Purpose:** Update product details  
**Authentication:** Required  
**Frontend Files:** `src/pages/business/EditProduct.tsx` (Line 135)

**Request:**
```json
{
  "name": "Updated Product Name",
  "price": 6000,
  /* fields to update */
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Product updated successfully",
  "data": { /* updated product */ }
}
```

---

#### DELETE /api/products/:id
**Purpose:** Delete product  
**Authentication:** Required  
**Frontend Files:** `src/pages/business/Products.tsx` (Line 47)

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Product deleted successfully"
}
```

---

### 9. Location Routes (`/api/locations`)

#### GET /api/locations/states
**Purpose:** Get list of all Indian states  
**Authentication:** None  
**Frontend Files:** Location dropdowns in various forms

**Response (Success - 200):**
```json
{
  "success": true,
  "data": [
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    /* ... */
  ]
}
```

---

#### GET /api/locations/states/:state/districts
**Purpose:** Get districts for a specific state  
**Authentication:** None  

**Example:**
```
GET /api/locations/states/Karnataka/districts
```

**Response (Success - 200):**
```json
{
  "success": true,
  "data": [
    "Bagalkot",
    "Bangalore Rural",
    "Bangalore Urban",
    "Belgaum",
    "Bellary",
    "Bidar",
    "Bijapur",
    "Chamarajanagar",
    "Chikkaballapur",
    "Chikkamagaluru",
    "Chitradurga",
    "Dakshina Kannada",
    "Davanagere",
    /* ... */
  ]
}
```

---

#### GET /api/locations/states/:state/districts/:district/blocks
**Purpose:** Get blocks for a specific district  
**Authentication:** None  

**Example:**
```
GET /api/locations/states/Karnataka/districts/Bangalore%20Urban/blocks
```

**Response (Success - 200):**
```json
{
  "success": true,
  "data": [
    "Anekal",
    "Bangalore East",
    "Bangalore North",
    "Bangalore South",
    "Devanahalli"
  ]
}
```

---

### 10. Health Check Routes

#### GET /api/health
**Purpose:** Server health check  
**Authentication:** None  

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2025-12-18T10:30:00.000Z"
}
```

---

## 🔄 Complete User Workflows

### Workflow 1: New User Registration → Profile Completion → Application Submission

```
Step 1: Registration
└─ POST /api/auth/register
   └─ Creates: web auth + web users records
   └─ Returns: JWT token
   └─ Frontend stores token, redirects to /member/dashboard

Step 2: Dashboard - Profile Completion Check
└─ GET /api/personal-form (check completion)
└─ GET /api/business-form (check completion)
└─ GET /api/financial-form (check completion)
└─ GET /api/declaration-form (check completion)
└─ Calculate: percentage = (completedForms / totalForms) * 100
   ├─ Aspirant (doing business = no): totalForms = 3
   └─ Business Member (doing business = yes): totalForms = 4

Step 3: Complete Profile Forms
└─ Click "Complete Profile" button → Navigate to /member/profile

   Step 3.1: Personal Information (Step 1)
   └─ POST /api/personal-form
      Body: { name, phone, email, state, district, block, city, religion, socialCategory, isLocked: true }
      └─ On success: Navigate to Step 2

   Step 3.2: Business Information (Step 2)
   └─ User selects: Doing Business? (Yes/No)
      
      If "No" (Aspirant):
      ├─ POST /api/business-form
      │  Body: { doingBusiness: "no" }
      ├─ POST /api/declaration-form (same screen)
      │  Body: { remarks: "Aspirant application", declarationAccepted: true }
      └─ Navigate to /member/application-submitted
      
      If "Yes" (Business Member):
      └─ POST /api/business-form
         Body: { doingBusiness: "yes", organization, constitution, businessTypes, ... }
         └─ Navigate to Step 3

   Step 3.3: Financial Information (Step 3) - Only for Business Members
   └─ POST /api/financial-form
      Body: { pan, gst, udyam, filedITR, ... }
      └─ Navigate to Step 4

   Step 3.4: Declaration (Step 4)
   └─ POST /api/declaration-form
      Body: { remarks, declarationAccepted: true }
      └─ Navigate to /member/application-submitted

Step 4: Application Submitted Screen
└─ Display success message
└─ Show application ID
└─ Button: "View Application Status"
   └─ Navigate to /member/application-status?id=APP-xxx

Step 5: Application Status Screen
└─ Display approval stages:
   1. Block Admin Review (Pending)
   2. District Admin Review (Pending)
   3. State Admin Review (Pending)
   4. Ready for Payment (Pending)
```

---

### Workflow 2: Business Member → Create Company → Add Products

```
Step 1: Login
└─ POST /api/auth/login
   └─ Returns: token + user data
   └─ Navigate to /member/dashboard

Step 2: Switch to Business Account
└─ Navigate to /business/dashboard

Step 3: Create Company
└─ Navigate to /business/profile
   └─ Click "Create Account" button
   └─ POST /api/companies
      Body: { companyName, businessCategory, email, phone, website, description, address, ... }
      └─ On success: Company created and set as active

Step 4: View Companies
└─ Navigate to /business/my-companies
   └─ GET /api/companies (fetch all companies)
   └─ Display list of companies
   └─ Can switch active company:
      └─ POST /api/companies/:id/set-active

Step 5: Add Products
└─ Navigate to /business/products
   └─ Click "Add Product" button
   └─ POST /api/products
      Body: { companyId, name, description, category, price, unit, images, specifications, ... }
      └─ On success: Product added to catalog

Step 6: Manage Products
└─ GET /api/products (fetch all products)
└─ Display product list
└─ Edit product:
   └─ GET /api/products/:id
   └─ PUT /api/products/:id
└─ Delete product:
   └─ DELETE /api/products/:id
```

---

### Workflow 3: Dashboard Progress Calculation (Dynamic)

```
When user loads /member/dashboard:

1. Fetch all form data in parallel:
   ├─ GET /api/personal-form
   ├─ GET /api/business-form
   ├─ GET /api/financial-form
   └─ GET /api/declaration-form

2. Check which forms are completed:
   completedForms = []
   
   If personalForm exists and isLocked:
   └─ completedForms.push("Personal Details")
   
   If businessForm exists and doingBusiness is set:
   ├─ completedForms.push("Business Information")
   └─ If doingBusiness === "no":
      └─ isAspirant = true
      └─ totalForms = 3 (Personal, Business, Declaration)
   └─ Else:
      └─ totalForms = 4 (Personal, Business, Financial, Declaration)
   
   If financialForm exists (only if isAspirant === false):
   └─ completedForms.push("Financial Details")
   
   If declarationForm exists:
   └─ completedForms.push("Declaration")

3. Calculate percentage:
   percentage = (completedForms.length / totalForms) * 100
   
   Examples:
   - Aspirant with 2 forms: 2/3 = 67%
   - Aspirant with 3 forms: 3/3 = 100%
   - Business member with 2 forms: 2/4 = 50%
   - Business member with 3 forms: 3/4 = 75%
   - Business member with 4 forms: 4/4 = 100%

4. Display:
   └─ Show blue card: "Complete Your Profile - X% completed"
   └─ List completed forms
   └─ If 100%: Show green card "Profile Complete!" with "View Application Status" button
```

---

## 🔄 Data Flow Diagrams

### Login & Authentication Flow
```
┌─────────────┐
│   Browser   │
│  (Frontend) │
└──────┬──────┘
       │ 1. Enter email + password
       │ POST /api/auth/login
       ▼
┌──────────────────────────────────────────────────────────────┐
│                        Backend Server                         │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  authController.js                                      │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │ 1. Find user in "web auth" collection            │  │  │
│  │  │    - Check email exists                          │  │  │
│  │  │    - Verify password (bcrypt.compare)            │  │  │
│  │  │    - Check isActive status                       │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │                          │                              │  │
│  │                          ▼                              │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │ 2. Find profile in "web users" collection        │  │  │
│  │  │    - Use userId from auth record                 │  │  │
│  │  │    - Get fullName, email, phoneNumber, role      │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │                          │                              │  │
│  │                          ▼                              │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │ 3. Generate JWT token                            │  │  │
│  │  │    - Payload: { userId, email }                  │  │  │
│  │  │    - Expiry: 24 hours                            │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
└───────────────────────────────┬──────────────────────────────┘
                                │ 2. Return token + user data
                                ▼
                         ┌──────────────┐
                         │   Browser    │
                         │  3. Store:   │
                         │  - token     │
                         │  - memberId  │
                         │  - userName  │
                         │  4. Redirect │
                         └──────────────┘
```

---

### Profile Completion Flow (Business Member)
```
┌────────────────┐
│    Dashboard   │
│  Check Forms   │
└───────┬────────┘
        │
        │ GET /api/personal-form
        │ GET /api/business-form
        │ GET /api/financial-form
        │ GET /api/declaration-form
        ▼
┌───────────────────────────────────┐
│  Calculate Progress:              │
│  - Personal: ✓ (1/4)             │
│  - Business: ✓ (2/4)             │
│  - Financial: ✗ (2/4)            │
│  - Declaration: ✗ (2/4)          │
│  Progress: 50%                    │
└───────┬───────────────────────────┘
        │
        │ User clicks "Complete Profile"
        ▼
┌────────────────────────────────────────────────────────────┐
│                     Profile Form                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Step 1: Personal Information                        │  │
│  │  POST /api/personal-form                             │  │
│  │  { name, phone, email, state, district, ... }        │  │
│  └──────────────┬───────────────────────────────────────┘  │
│                 │                                            │
│                 ▼                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Step 2: Business Information                        │  │
│  │  POST /api/business-form                             │  │
│  │  { doingBusiness: "yes", organization, ... }         │  │
│  └──────────────┬───────────────────────────────────────┘  │
│                 │                                            │
│                 ▼                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Step 3: Financial Information                       │  │
│  │  POST /api/financial-form                            │  │
│  │  { pan, gst, udyam, filedITR, ... }                  │  │
│  └──────────────┬───────────────────────────────────────┘  │
│                 │                                            │
│                 ▼                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Step 4: Declaration                                 │  │
│  │  POST /api/declaration-form                          │  │
│  │  { remarks, declarationAccepted: true }              │  │
│  └──────────────┬───────────────────────────────────────┘  │
│                 │                                            │
└─────────────────┼────────────────────────────────────────────┘
                  │
                  ▼
         ┌──────────────────────┐
         │  Application         │
         │  Submitted Screen    │
         │  - Show App ID       │
         │  - Button: View      │
         │    Status            │
         └──────────────────────┘
```

---

### Profile Completion Flow (Aspirant)
```
┌────────────────┐
│    Dashboard   │
│  Check Forms   │
└───────┬────────┘
        │
        │ GET /api/personal-form
        │ GET /api/business-form
        │ GET /api/declaration-form
        ▼
┌───────────────────────────────────┐
│  Calculate Progress:              │
│  - Personal: ✓ (1/3)             │
│  - Business: ✓ (2/3)             │
│  - Declaration: ✗ (2/3)          │
│  Progress: 67% (Aspirant)         │
└───────┬───────────────────────────┘
        │
        │ User clicks "Complete Profile"
        ▼
┌────────────────────────────────────────────────────────────┐
│                     Profile Form                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Step 1: Personal Information                        │  │
│  │  POST /api/personal-form                             │  │
│  └──────────────┬───────────────────────────────────────┘  │
│                 │                                            │
│                 ▼                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Step 2: Business Information                        │  │
│  │  - Select "No" for doing business                    │  │
│  │  - Declaration checkbox appears on same screen       │  │
│  │  POST /api/business-form                             │  │
│  │  { doingBusiness: "no" }                             │  │
│  │  POST /api/declaration-form                          │  │
│  │  { declarationAccepted: true }                       │  │
│  │  (Step 3 Financial form is skipped)                  │  │
│  └──────────────┬───────────────────────────────────────┘  │
│                 │                                            │
└─────────────────┼────────────────────────────────────────────┘
                  │
                  ▼
         ┌──────────────────────┐
         │  Application         │
         │  Submitted Screen    │
         │  (3/3 forms = 100%)  │
         └──────────────────────┘
```

---

### Company & Product Management Flow
```
┌────────────────┐
│ Business       │
│ Dashboard      │
└───────┬────────┘
        │
        │ GET /api/companies (fetch all companies)
        │ GET /api/products (fetch all products)
        ▼
┌─────────────────────────────────────────────┐
│  Display:                                   │
│  - Active Company: Acme Corp                │
│  - Total Products: 15                       │
│  - Recent Products                          │
└───────┬─────────────────────────────────────┘
        │
        │ User navigates to My Companies
        ▼
┌─────────────────────────────────────────────┐
│  My Companies Page                          │
│  ┌────────────────────────────────────────┐ │
│  │  Company 1: Acme Corp (Active)         │ │
│  │  Company 2: Tech Solutions              │ │
│  │  Company 3: Trading Co                  │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  Actions:                                    │
│  - Create New Company                        │
│  - Switch Active Company                     │
│  - Edit Company                              │
│  - Delete Company                            │
└───────┬──────────────────────────────────────┘
        │
        │ User clicks "Add Product"
        ▼
┌─────────────────────────────────────────────┐
│  Add Product Form                           │
│  POST /api/products                         │
│  {                                           │
│    companyId: "...",                         │
│    name: "New Product",                      │
│    description: "...",                       │
│    category: "Electronics",                  │
│    price: 5000,                              │
│    ...                                       │
│  }                                           │
└───────┬──────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│  Product Created                            │
│  - Navigate to Products page                 │
│  - Product visible in catalog                │
└──────────────────────────────────────────────┘
```

---

## ⚠️ Error Handling

### Common Error Responses

#### 400 - Bad Request
```json
{
  "success": false,
  "message": "Please provide all required fields"
}
```

#### 401 - Unauthorized
```json
{
  "success": false,
  "message": "Not authorized, token failed"
}
```

#### 404 - Not Found
```json
{
  "success": false,
  "message": "Resource not found"
}
```

#### 409 - Conflict
```json
{
  "success": false,
  "message": "Email already registered"
}
```

#### 500 - Server Error
```json
{
  "success": false,
  "message": "Server error",
  "error": "Detailed error message (development only)"
}
```

### Frontend Error Handling Pattern
```typescript
try {
  const response = await fetch(apiUrl, options);
  
  if (!response.ok) {
    const errorData = await response.json();
    toast.error(errorData.message || 'An error occurred');
    return;
  }
  
  const data = await response.json();
  // Success handling
  
} catch (error) {
  console.error('Error:', error);
  toast.error('Failed to connect to server');
}
```

---

## 📝 Summary

### Total API Endpoints: **40+**

**Authentication:** 3 endpoints  
**Profile:** 2 endpoints  
**Personal Form:** 2 endpoints  
**Business Form:** 2 endpoints  
**Financial Form:** 2 endpoints  
**Declaration Form:** 2 endpoints  
**Companies:** 7 endpoints  
**Products:** 5 endpoints  
**Locations:** 3 endpoints  
**Health Check:** 1 endpoint  

### Database Collections: **9**
- web auth
- web users  
- personal forms (additional form for personal information 1)
- business forms (additional form for bussiness 2)
- financial forms (additional form for financial 3)
- declaration forms (additional form for declaration 4)
- companies
- products
- locations

### User Flows: **3 Main Workflows**
1. Registration → Profile Completion → Application Submission
2. Business Member → Create Company → Add Products
3. Dashboard Progress Tracking (Dynamic for Aspirants/Business Members)

---

**Document Version:** 1.0  
**Created:** December 18, 2025  
**Backend Port:** 4000  
**Frontend Port:** 8080 (Vite dev server)  
**Database:** MongoDB Atlas (activ-db)  
**Authentication:** JWT (24-hour expiry)
