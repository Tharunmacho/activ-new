# ACTIV Backend - Complete Structure & Architecture

**Version:** 1.0.0  
**Last Updated:** December 18, 2025  
**Tech Stack:** Node.js + Express + MongoDB (Mongoose) + Redis  
**Deployment:** PM2 Cluster Mode  

---

## 📁 Project Directory Structure

```
activ-backend/
├── server.js                      # Main application entry point
├── package.json                   # Dependencies and scripts
├── config.env                     # Development environment variables
├── production.env                 # Production environment variables
├── pm2.config.js                  # PM2 process manager configuration
│
├── models/                        # MongoDB Mongoose Schemas
│   ├── MemberDetails.js           # Member profile and personal info
│   ├── MemberAuth.js              # Authentication credentials
│   ├── MemberBusinessInfo.js      # Business information
│   ├── MemberFinancialInfo.js     # Financial & compliance data
│   ├── MemberDeclaration.js       # Declaration form data
│   ├── adminModels.js             # Admin schemas (Block/District/State/Super)
│   ├── applicationModel.js        # Membership application workflow
│   ├── Product.js                 # Products and services
│   ├── Notification.js            # In-app notifications
│   ├── Activity.js                # User activity logs
│   └── Connection.js              # Member connections/network
│
├── routes/                        # API Route Handlers
│   ├── auth.js                    # Authentication (login, register)
│   ├── members.js                 # Member CRUD operations
│   ├── memberDetails.js           # Member detailed info endpoints
│   ├── profile.js                 # Profile management
│   ├── adminAuth.js               # Admin authentication
│   ├── applications.js            # Application submission & approval
│   ├── browseMembers.js           # Member discovery/search
│   ├── business.js                # Business account management
│   ├── businessSettings.js        # Business settings & preferences
│   ├── companies.js               # Multi-company management
│   ├── products.js                # Product catalog management
│   ├── discover.js                # Product discovery & search
│   ├── analytics.js               # Business analytics & statistics
│   ├── dashboard.js               # Dashboard data aggregation
│   ├── notifications.js           # Notification system
│   ├── locations.js               # Location dropdowns (states/districts/blocks)
│   └── webhook.js                 # Payment gateway webhooks
│
├── middleware/                    # Express Middleware
│   ├── cache.js                   # In-memory caching layer
│   ├── hybrid-cache.js            # Redis + In-memory hybrid cache
│   ├── compression.js             # Response compression
│   ├── performance.js             # Performance monitoring
│   └── validation.js              # Request validation
│
├── utils/                         # Utility Functions
│   └── redis-cache.js             # Redis connection and helpers
│
├── data/                          # Static Data Files
│   └── locations_nested.json     # India states/districts/blocks
│
├── scripts/                       # Helper Scripts
│   ├── create-admin.js            # Create admin users
│   ├── check-members-detailed.js  # Debugging tools
│   └── ...                        # Various utility scripts
│
└── logs/                          # Application Logs (if enabled)
    ├── error.log
    └── combined.log
```

---

## 🗄️ Database Architecture

### MongoDB Atlas Configuration
```javascript
Database Name: membersdb
Connection String: mongodb+srv://activapp2025_db_user:password@cluster1.gf7usct.mongodb.net/membersdb

Connection Pool Settings:
- maxPoolSize: 100           // Maximum concurrent connections
- minPoolSize: 20            // Pre-warmed connections
- serverSelectionTimeoutMS: 10000
- socketTimeoutMS: 30000
- retryWrites: true
- w: 1                      // Write concern (acknowledge from primary)
- compression: zlib         // Network compression enabled
```

### Collections & Purpose

| Collection | Purpose | Key Indexes |
|-----------|---------|-------------|
| `memberdetails` | Member profiles, personal info, location | email, memberId, state/district/block |
| `memberauths` | Login credentials (email + hashed password) | email, memberId |
| `memberbusinessinfos` | Business-related information | memberId |
| `memberfinancialinfos` | PAN, GST, ITR, turnover data | memberId |
| `memberdeclarations` | Final declaration and company names | memberId |
| `applications` | Membership approval workflow | email, status, state/district/block |
| `blockadmins` | Block-level administrators | email, state, district, block |
| `districtadmins` | District-level administrators | email, state, district |
| `stateadmins` | State-level administrators | email, state |
| `superadmins` | Super administrators (nationwide) | email |
| `companies` | Business companies under member accounts | memberId, createdAt |
| `products` | Products and services catalog | companyId, category, featured |
| `notifications` | In-app notification system | recipientId, isRead, createdAt |
| `activities` | User activity tracking | memberId, companyId, createdAt |
| `connections` | Member networking | memberId, connectedMemberId |

---

## 📊 Database Schemas

### 1. MemberDetails Schema
```javascript
{
  _id: ObjectId,
  memberId: String (unique),
  fullName: String (required),
  email: String (required, unique, lowercase),
  phoneNumber: String (required),
  
  // Location
  state: String (required),
  district: String (required),
  block: String (required),
  city: String,
  
  // Personal Details (from Additional Form 1)
  dateOfBirth: Date,
  gender: String ['Male', 'Female', 'Other'],
  aadhaarNumber: String,
  streetName: String,
  educationalQualification: String,
  religion: String,
  socialCategory: String ['Christian SC', 'ST', 'Christian ST', 'Other'],
  
  // Profile Status
  profileCompleted: Boolean (default: false),
  profilePicture: String,
  
  // Metadata
  createdAt: Date (auto),
  updatedAt: Date (auto),
  memberType: String ['member', 'aspirant'] (default: 'member')
}

Indexes:
- email (unique)
- state + district + block (compound)
- fullName (text search)
```

### 2. MemberAuth Schema
```javascript
{
  _id: ObjectId,
  memberId: ObjectId (ref: 'MemberDetails'),
  email: String (required, unique, lowercase),
  password: String (required, bcrypt hashed),
  isActive: Boolean (default: true),
  lastLogin: Date,
  
  createdAt: Date (auto),
  updatedAt: Date (auto)
}

Methods:
- comparePassword(candidatePassword): Boolean  // Bcrypt comparison
- updateLastLogin(): Promise                   // Update last login timestamp

Pre-save Hook:
- Hashes password automatically before saving
```

### 3. MemberBusinessInfo Schema
```javascript
{
  _id: ObjectId,
  memberId: ObjectId (ref: 'MemberDetails', required),
  
  // Business Status
  doingBusiness: Boolean,
  
  // Organization Details
  organizationName: String,
  constitutionType: String ['OPC', 'TRUST', 'SOCIETY'],
  businessTypes: [String] ['Manufacturing', 'Trader', 'Service Provider', 'Others'],
  businessActivities: String,
  businessCommencementYear: String,
  numberOfEmployees: String,
  
  // Associations
  memberOfOtherChamber: Boolean,
  otherChamber: String,
  govtOrganizations: [String] ['MSME', 'KVIC', 'NABARD', 'None', 'Others'],
  
  createdAt: Date (auto),
  updatedAt: Date (auto)
}

Index: memberId
```

### 4. MemberFinancialInfo Schema
```javascript
{
  _id: ObjectId,
  memberId: ObjectId (ref: 'MemberDetails', required),
  
  // Tax IDs
  panNumber: String,
  gstNumber: String,
  udyamNumber: String,
  
  // ITR Details
  filedITR: Boolean,
  itrYears: String,
  
  // Turnover
  turnoverRange: String ['Less than 25 Lakhs', '25 Lakhs - 50 Lakhs', ...],
  turnover: String,
  fy2021: String,
  fy2020: String,
  fy2019: String,
  
  // Government Schemes
  govtSchemeBenefit: Boolean,
  scheme1: String,
  scheme2: String,
  scheme3: String,
  
  createdAt: Date (auto),
  updatedAt: Date (auto)
}

Index: memberId
```

### 5. MemberDeclaration Schema
```javascript
{
  _id: ObjectId,
  memberId: ObjectId (ref: 'MemberDetails', required),
  
  sisterConcerns: String,
  companyNames: String,
  agreeToDeclaration: Boolean (required),
  
  createdAt: Date (auto),
  updatedAt: Date (auto)
}

Index: memberId
```

### 6. Application Schema (Approval Workflow)
```javascript
{
  _id: ObjectId,
  email: String (required, indexed),
  fullName: String (required),
  phoneNumber: String (required),
  
  // Location
  state: String (required, indexed),
  district: String (required, indexed),
  block: String (required, indexed),
  city: String,
  
  // Application Status
  status: String (enum: [
    'pending',
    'block_review',
    'block_approved',
    'block_rejected',
    'district_review',
    'district_approved',
    'district_rejected',
    'state_review',
    'state_approved',
    'state_rejected'
  ], default: 'pending'),
  
  // Admin Reviews
  blockAdminId: ObjectId,
  blockAdminComment: String,
  blockReviewDate: Date,
  
  districtAdminId: ObjectId,
  districtAdminComment: String,
  districtReviewDate: Date,
  
  stateAdminId: ObjectId,
  stateAdminComment: String,
  stateReviewDate: Date,
  
  // Form Data (embedded)
  formData: {
    // Personal Details
    aadhaarNumber: String,
    streetName: String,
    educationalQualification: String,
    religion: String,
    socialCategory: String,
    
    // Business Information
    doingBusiness: Boolean,
    organizationName: String,
    businessTypes: [String],
    
    // Financial Information
    panNumber: String,
    gstNumber: String,
    turnoverRange: String,
    
    // Declaration
    sisterConcerns: String,
    companyNames: String,
    agreeToDeclaration: Boolean
  },
  
  // Metadata
  submittedAt: Date,
  createdAt: Date (auto),
  updatedAt: Date (auto)
}

Indexes:
- email (unique)
- status + state + district + block (compound, for admin filtering)
- createdAt (for sorting)
```

### 7. Admin Schemas (Block/District/State/Super)
```javascript
// BlockAdmin Schema
{
  _id: ObjectId,
  adminId: String (unique, required),
  email: String (unique, required, lowercase),
  password: String (required, bcrypt hashed),
  fullName: String (required),
  phoneNumber: String,
  
  // Location
  state: String (required),
  district: String (required),
  block: String (required),
  
  // Status
  isActive: Boolean (default: true),
  role: String (default: 'block_admin'),
  
  createdAt: Date (auto),
  updatedAt: Date (auto)
}

// DistrictAdmin Schema (same as above, but no 'block' field)
{
  ...
  state: String (required),
  district: String (required),
  role: String (default: 'district_admin'),
  ...
}

// StateAdmin Schema (only 'state' field)
{
  ...
  state: String (required),
  role: String (default: 'state_admin'),
  ...
}

// SuperAdmin Schema (nationwide access, no location fields)
{
  ...
  role: String (default: 'super_admin'),
  ...
}

Methods (All Admin Models):
- comparePassword(candidatePassword): Boolean
- updateLastLogin(): Promise

Indexes:
- email (unique)
- state/district/block (location-based filtering)
```

### 8. Company Schema
```javascript
{
  _id: ObjectId,
  memberId: ObjectId (ref: 'MemberDetails', required, indexed),
  
  // Company Info
  companyName: String (required),
  industry: String,
  description: String,
  logo: String,
  
  // Contact
  email: String,
  phone: String,
  website: String,
  address: String,
  
  // Status
  isActive: Boolean (default: true),
  featured: Boolean (default: false),
  
  // Metadata
  createdAt: Date (auto),
  updatedAt: Date (auto)
}

Indexes:
- memberId + createdAt (compound, descending)
- companyName (text search)
```

### 9. Product Schema
```javascript
{
  _id: ObjectId,
  companyId: ObjectId (ref: 'Company', required, indexed),
  memberId: ObjectId (ref: 'MemberDetails', required, indexed),
  
  // Product Info
  name: String (required),
  description: String,
  category: String (required),
  subcategory: String,
  
  // Pricing
  price: Number,
  currency: String (default: 'INR'),
  unit: String ['pieces', 'kg', 'litre', 'service'],
  
  // Images
  images: [String],
  primaryImage: String,
  
  // Stock
  inStock: Boolean (default: true),
  stockQuantity: Number,
  minimumOrderQuantity: Number,
  
  // Features
  status: String ['active', 'inactive', 'draft'] (default: 'active'),
  featured: Boolean (default: false),
  
  // Engagement
  views: Number (default: 0),
  inquiries: Number (default: 0),
  
  // Metadata
  createdAt: Date (auto),
  updatedAt: Date (auto)
}

Indexes:
- companyId + createdAt (compound)
- name + description (text search)
- category (filtering)
- featured + createdAt (featured products first)
- status (active/inactive filtering)
```

### 10. Notification Schema
```javascript
{
  _id: ObjectId,
  recipientId: ObjectId (ref: 'MemberDetails', required, indexed),
  senderId: ObjectId (ref: 'MemberDetails'),
  
  // Notification Content
  type: String ['connection_request', 'profile_view', 'application_status', 'system', 'business'],
  title: String (required),
  message: String (required),
  
  // Related Entity
  relatedEntityType: String ['member', 'company', 'product', 'application'],
  relatedEntityId: ObjectId,
  
  // Status
  isRead: Boolean (default: false),
  readAt: Date,
  
  // Metadata
  createdAt: Date (auto),
  updatedAt: Date (auto)
}

Indexes:
- recipientId + isRead + createdAt (compound, for unread notifications)
```

### 11. Activity Schema
```javascript
{
  _id: ObjectId,
  memberId: ObjectId (ref: 'MemberDetails', required, indexed),
  companyId: ObjectId (ref: 'Company', indexed),
  
  // Activity Type
  activityType: String [
    'profile_view',
    'product_view',
    'company_view',
    'connection_made',
    'profile_updated',
    'product_added',
    'inquiry_sent'
  ],
  
  // Activity Details
  description: String,
  metadata: Mixed (JSON),
  ipAddress: String,
  userAgent: String,
  
  // Metadata
  createdAt: Date (auto)
}

Indexes:
- memberId + companyId + createdAt (compound)
- companyId + createdAt (for company activity logs)
```

### 12. Connection Schema
```javascript
{
  _id: ObjectId,
  memberId: ObjectId (ref: 'MemberDetails', required, indexed),
  connectedMemberId: ObjectId (ref: 'MemberDetails', required, indexed),
  
  status: String ['pending', 'accepted', 'rejected'] (default: 'pending'),
  connectedAt: Date,
  
  createdAt: Date (auto),
  updatedAt: Date (auto)
}

Indexes:
- memberId + status (compound)
- connectedMemberId + status (compound)
- memberId + connectedMemberId (unique compound, prevent duplicates)
```

---

## 🛣️ API Routes & Endpoints

### Base URL
```
Development: http://localhost:3000/api
Production: https://actv-project.onrender.com/api
```

### Authentication Routes (`/api/auth`)

#### POST /api/auth/login
**Purpose:** Member login  
**Rate Limit:** 1000 requests per 15 minutes  

**Request:**
```json
{
  "email": "member@example.com",
  "password": "password123"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "member": {
      "id": "60f7b3b3b3b3b3b3b3b3b3b3",
      "memberId": "60f7b3b3b3b3b3b3b3b3b3b3",
      "fullName": "John Doe",
      "email": "member@example.com",
      "phoneNumber": "9876543210",
      "state": "Karnataka",
      "district": "Bangalore Urban",
      "block": "Bangalore North",
      "city": "Bangalore",
      "profileCompleted": true
    }
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Invalid password"
}
```

**Process Flow:**
1. Validate email and password
2. Find member in `memberdetails` collection
3. Find credentials in `memberauths` collection
4. Compare password using bcrypt
5. Generate JWT token (24-hour expiry)
6. Update last login timestamp
7. Return token + member data

**Backend Code:**
```javascript
// Parallel queries for optimization
const [member, memberAuth] = await Promise.all([
  MemberDetails.findOne({ email: normalizedEmail }).select('...').lean(),
  MemberAuth.findOne({ email: normalizedEmail }).select('...').lean(false)
]);

// Verify password
const isPasswordValid = await memberAuth.comparePassword(password);

// Generate JWT
const token = jwt.sign({ userId: member._id, email: member.email }, 
  process.env.JWTSECRET, { expiresIn: '24h' });
```

---

#### POST /api/auth/register
**Purpose:** New member registration  

**Request:**
```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "phoneNumber": "9876543210",
  "state": "Karnataka",
  "district": "Bangalore Urban",
  "block": "Bangalore North",
  "city": "Bangalore"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registration successful. Please complete additional details.",
  "data": {
    "member": {
      "id": "...",
      "email": "john@example.com",
      "fullName": "John Doe"
    }
  }
}
```

**Process:**
1. Validate input data
2. Check if email already exists
3. Create `MemberDetails` document
4. Create `MemberAuth` document (password auto-hashed)
5. Return success response

---

#### GET /api/auth/member-by-email/:email
**Purpose:** Fetch member details by email (used for data loading)  

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "memberId": "...",
    "fullName": "John Doe",
    "email": "john@example.com",
    "phoneNumber": "9876543210",
    "state": "Karnataka",
    "district": "Bangalore Urban",
    "block": "Bangalore North",
    "city": "Bangalore",
    "aadhaarNumber": "123456789012",
    "religion": "Christian",
    "socialCategory": "Christian SC"
  }
}
```

---

### Member Routes (`/api/members`)

#### GET /api/members/by-email?email=john@example.com
**Purpose:** Get member by email  
**Cache:** Hybrid cache (Redis + In-memory, 1 minute)  

#### PUT /api/members/:id
**Purpose:** Update member details (including password and email)  

**Request:**
```json
{
  "fullName": "John Updated",
  "email": "newemail@example.com",
  "phoneNumber": "9876543210",
  "state": "Karnataka",
  "district": "Bangalore Urban",
  "block": "Bangalore North Updated",
  "city": "Bangalore",
  "aadhaarNumber": "123456789012",
  "streetName": "123 Main St",
  "educationalQualification": "Bachelor's Degree",
  "religion": "Christian",
  "socialCategory": "Christian SC",
  "password": "newpassword123"
}
```

**Process:**
1. Update `MemberDetails` collection with all fields except password
2. If email changed: Update `MemberAuth.email`
3. If password provided: Update `MemberAuth.password` (auto-hashed)
4. Return updated member data

**Backend Code:**
```javascript
// Update MemberDetails
const doc = await MemberDetails.findByIdAndUpdate(id, payload, { new: true });

// Handle email update in MemberAuth
if (updates.email) {
  const memberAuth = await MemberAuth.findOne({ memberId: id });
  if (memberAuth) {
    memberAuth.email = normalizedEmail;
    await memberAuth.save();
  }
}

// Handle password update in MemberAuth
if (updates.password) {
  const memberAuth = await MemberAuth.findOne({ memberId: id });
  if (memberAuth) {
    memberAuth.password = updates.password; // Auto-hashed by pre-save hook
    await memberAuth.save();
  }
}
```

#### POST /api/members/:id/business-info
**Purpose:** Save business information (Additional Form 2)  

**Request:**
```json
{
  "doingBusiness": true,
  "organizationName": "ABC Traders",
  "constitutionType": "OPC",
  "businessTypes": ["Trading", "Service Provider"],
  "businessActivities": "Import and export of electronics",
  "businessCommencementYear": "2020",
  "numberOfEmployees": "10",
  "memberOfOtherChamber": false,
  "govtOrganizations": ["MSME"]
}
```

#### POST /api/members/:id/financial-info
**Purpose:** Save financial information (Additional Form 3)  

**Request:**
```json
{
  "panNumber": "ABCDE1234F",
  "gstNumber": "22ABCDE1234F1Z5",
  "udyamNumber": "UDYAM-KA-01-1234567",
  "filedITR": true,
  "itrYears": "3",
  "turnoverRange": "50 Lakhs - 1 Crore",
  "fy2021": "7500000",
  "fy2020": "6000000",
  "fy2019": "5000000",
  "govtSchemeBenefit": false
}
```

---

### Application Routes (`/api/applications`)

#### POST /api/applications/submit
**Purpose:** Submit membership application after completing all 4 forms  

**Request:**
```json
{
  "email": "john@example.com",
  "fullName": "John Doe",
  "phoneNumber": "9876543210",
  "state": "Karnataka",
  "district": "Bangalore Urban",
  "block": "Bangalore North",
  "city": "Bangalore",
  "formData": {
    // All data from 4 forms
    "aadhaarNumber": "...",
    "doingBusiness": true,
    "panNumber": "...",
    "agreeToDeclaration": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Application submitted successfully",
  "data": {
    "applicationId": "...",
    "status": "pending",
    "submittedAt": "2025-12-18T10:30:00.000Z"
  }
}
```

#### GET /api/applications/status/:email
**Purpose:** Track application status  

**Response:**
```json
{
  "success": true,
  "data": {
    "applicationId": "...",
    "status": "block_review",
    "timeline": [
      { "stage": "submitted", "date": "2025-12-15", "status": "completed" },
      { "stage": "block_review", "date": "2025-12-16", "status": "in_progress" },
      { "stage": "district_review", "date": null, "status": "pending" }
    ],
    "blockAdminComment": "Under verification",
    "estimatedCompletion": "2025-12-20"
  }
}
```

---

### Admin Routes (`/api/admin`)

#### POST /api/admin/login
**Purpose:** Admin login (Block/District/State/Super)  

**Request:**
```json
{
  "email": "admin@block.com",
  "password": "adminpass123",
  "role": "block_admin"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "...",
    "admin": {
      "adminId": "...",
      "email": "admin@block.com",
      "fullName": "Block Admin",
      "role": "block_admin",
      "state": "Karnataka",
      "district": "Bangalore Urban",
      "block": "Bangalore North"
    }
  }
}
```

#### GET /api/admin/applications?status=pending&role=block_admin
**Purpose:** Get applications for admin review  

**Query Parameters:**
- `status`: pending, block_review, district_review, etc.
- `role`: block_admin, district_admin, state_admin
- `page`: pagination (default: 1)
- `limit`: results per page (default: 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "applications": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalApplications": 100,
      "limit": 20
    }
  }
}
```

#### PUT /api/admin/applications/:id/review
**Purpose:** Approve/reject application  

**Request:**
```json
{
  "action": "approve",
  "comment": "All details verified",
  "adminId": "..."
}
```

---

### Business Routes (`/api/business`)

#### POST /api/business/create
**Purpose:** Create business profile  

**Request:**
```json
{
  "memberId": "...",
  "businessName": "ABC Traders",
  "businessType": "Trading",
  "description": "Import export business",
  "email": "business@abc.com",
  "phone": "9876543210",
  "website": "https://abc.com",
  "address": "123 Main St, Bangalore"
}
```

#### GET /api/business/profile/:memberId
**Purpose:** Get business profile  
**Cache:** 3 minutes  

---

### Companies Routes (`/api/companies`)

#### GET /api/companies/:memberId
**Purpose:** Get all companies under a member account  
**Cache:** 3 minutes  

**Response:**
```json
{
  "success": true,
  "data": {
    "companies": [
      {
        "_id": "...",
        "companyName": "ABC Traders",
        "industry": "Trading",
        "logo": "...",
        "isActive": true,
        "createdAt": "..."
      }
    ]
  }
}
```

#### POST /api/companies/create
**Purpose:** Create new company  

**Request:**
```json
{
  "memberId": "...",
  "companyName": "New Company",
  "industry": "Manufacturing",
  "description": "...",
  "logo": "...",
  "email": "...",
  "phone": "...",
  "website": "...",
  "address": "..."
}
```

#### PUT /api/companies/:id
**Purpose:** Update company details  

#### DELETE /api/companies/:id
**Purpose:** Delete/deactivate company  

---

### Products Routes (`/api/products`)

#### GET /api/products/company/:companyId
**Purpose:** Get all products for a company  
**Cache:** 3 minutes  

**Query Parameters:**
- `category`: Filter by category
- `status`: active, inactive, draft
- `page`: pagination
- `limit`: results per page

**Response:**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "_id": "...",
        "name": "Product Name",
        "description": "...",
        "category": "Electronics",
        "price": 10000,
        "currency": "INR",
        "images": ["..."],
        "inStock": true,
        "featured": false,
        "views": 150,
        "inquiries": 10,
        "createdAt": "..."
      }
    ],
    "pagination": {...}
  }
}
```

#### POST /api/products/create
**Purpose:** Add new product  

**Request:**
```json
{
  "companyId": "...",
  "memberId": "...",
  "name": "Product Name",
  "description": "...",
  "category": "Electronics",
  "subcategory": "Mobile Phones",
  "price": 10000,
  "unit": "pieces",
  "images": ["..."],
  "inStock": true,
  "stockQuantity": 100,
  "minimumOrderQuantity": 10
}
```

#### PUT /api/products/:id
**Purpose:** Update product  

#### DELETE /api/products/:id
**Purpose:** Delete product  

#### PUT /api/products/:id/increment-view
**Purpose:** Increment product view count  

---

### Discover Routes (`/api/discover`)

#### GET /api/discover/products
**Purpose:** Search and filter products from all companies  
**Cache:** 3 minutes  

**Query Parameters:**
- `search`: Text search in name/description
- `category`: Filter by category
- `minPrice`: Minimum price
- `maxPrice`: Maximum price
- `state`: Location filter
- `district`: Location filter
- `featured`: true/false
- `sort`: price_asc, price_desc, views_desc, newest
- `page`: pagination
- `limit`: results per page

**Response:**
```json
{
  "success": true,
  "data": {
    "products": [...],
    "filters": {
      "categories": ["Electronics", "Clothing", ...],
      "priceRange": { "min": 100, "max": 100000 },
      "locations": [...]
    },
    "pagination": {...}
  }
}
```

---

### Analytics Routes (`/api/analytics`)

#### GET /api/analytics/business/:memberId
**Purpose:** Get business analytics and statistics  
**Cache:** 5 minutes  

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalCompanies": 3,
      "totalProducts": 45,
      "totalViews": 1250,
      "totalInquiries": 89
    },
    "productPerformance": [
      { "productId": "...", "name": "...", "views": 150, "inquiries": 20 }
    ],
    "viewsOverTime": [
      { "date": "2025-12-01", "views": 50 },
      { "date": "2025-12-02", "views": 65 }
    ],
    "topProducts": [...],
    "categoryBreakdown": {
      "Electronics": 15,
      "Clothing": 20,
      "Food": 10
    }
  }
}
```

---

### Dashboard Routes (`/api/dashboard`)

#### GET /api/dashboard/member/:memberId
**Purpose:** Get member dashboard data  
**Cache:** 1 minute  

**Response:**
```json
{
  "success": true,
  "data": {
    "profile": {
      "fullName": "...",
      "email": "...",
      "profileCompleted": true,
      "memberSince": "..."
    },
    "statistics": {
      "totalConnections": 25,
      "profileViews": 150,
      "activePosts": 5
    },
    "recentActivities": [...],
    "notifications": [...],
    "applicationStatus": "approved"
  }
}
```

---

### Browse Members Routes (`/api/browse-members`)

#### GET /api/browse-members
**Purpose:** Search and browse members  
**Cache:** 1 minute  

**Query Parameters:**
- `search`: Search by name
- `state`: Location filter
- `district`: Location filter
- `block`: Location filter
- `profession`: Business/profession filter
- `page`: pagination
- `limit`: results per page

**Response:**
```json
{
  "success": true,
  "data": {
    "members": [
      {
        "_id": "...",
        "fullName": "John Doe",
        "profilePicture": "...",
        "city": "Bangalore",
        "state": "Karnataka",
        "district": "Bangalore Urban",
        "block": "Bangalore North",
        "profession": "Trader",
        "memberSince": "..."
      }
    ],
    "pagination": {...}
  }
}
```

---

### Notifications Routes (`/api/notifications`)

#### GET /api/notifications/:memberId
**Purpose:** Get member notifications  

**Query Parameters:**
- `unreadOnly`: true/false
- `page`: pagination
- `limit`: results per page

**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "_id": "...",
        "type": "connection_request",
        "title": "New Connection Request",
        "message": "John Doe wants to connect with you",
        "isRead": false,
        "createdAt": "..."
      }
    ],
    "unreadCount": 5,
    "pagination": {...}
  }
}
```

#### PUT /api/notifications/:id/read
**Purpose:** Mark notification as read  

#### DELETE /api/notifications/:id
**Purpose:** Delete notification  

---

### Locations Routes (`/api/locations`)

#### GET /api/locations/states
**Purpose:** Get all Indian states  
**Cache:** 1 hour (static data)  

**Response:**
```json
{
  "success": true,
  "data": ["Andhra Pradesh", "Karnataka", "Kerala", ...]
}
```

#### GET /api/locations/states/:stateName/districts
**Purpose:** Get districts for a state  
**Cache:** 1 hour  

**Example:** `/api/locations/states/Karnataka/districts`

**Response:**
```json
{
  "success": true,
  "data": ["Bangalore Urban", "Bangalore Rural", "Mysore", ...]
}
```

#### GET /api/locations/states/:stateName/districts/:districtName/blocks
**Purpose:** Get blocks for a district  
**Cache:** 1 hour  

**Example:** `/api/locations/states/Karnataka/districts/Bangalore%20Urban/blocks`

**Response:**
```json
{
  "success": true,
  "data": ["Bangalore North", "Bangalore South", "Bangalore East", ...]
}
```

#### GET /api/locations/all
**Purpose:** Get complete hierarchical location data  
**Cache:** 1 hour  

**Response:**
```json
{
  "success": true,
  "data": {
    "Andhra Pradesh": {
      "Anantapur": ["Agali", "Amadagur", ...],
      "Chittoor": [...]
    },
    "Karnataka": {
      "Bangalore Urban": ["Bangalore North", "Bangalore South", ...],
      "Mysore": [...]
    }
  }
}
```

---

### Webhook Routes (`/api/webhook`)

#### POST /api/webhook/instamojo
**Purpose:** Handle Instamojo payment gateway webhooks  
**No Rate Limit:** Webhooks need unrestricted access  

**Request (from Instamojo):**
```json
{
  "payment_id": "...",
  "payment_status": "Credit",
  "amount": "500",
  "buyer_email": "john@example.com",
  "buyer_phone": "9876543210"
}
```

**Process:**
1. Verify webhook signature
2. Find member by email
3. Update payment status in application
4. Send notification to member
5. Return success response

---

## 🔒 Security & Authentication

### JWT Token Structure
```javascript
Token Payload:
{
  userId: "ObjectId",
  email: "member@example.com",
  iat: 1702900000,  // Issued at
  exp: 1702986400   // Expires in 24 hours
}

Token Secret: process.env.JWTSECRET
Algorithm: HS256
Expiry: 24 hours
```

### Password Security
```javascript
// Bcrypt hashing (10 rounds)
// Pre-save hook in MemberAuth model

memberAuthSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Password comparison
memberAuthSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};
```

### Rate Limiting
```javascript
// Authentication endpoints: 1000 requests per 15 minutes
// API endpoints: 10,000 requests per minute (effectively unlimited in dev)
// General endpoints: 10,000 requests per minute

// Production should use stricter limits:
// Auth: 10 requests per 15 minutes
// API: 100 requests per minute
// General: 50 requests per minute
```

### CORS Configuration
```javascript
Allowed Origins:
- http://localhost:3000
- http://localhost:5173 (Vite dev server)
- https://actv-project.onrender.com (production)

Credentials: Enabled
Methods: GET, POST, PUT, DELETE, PATCH
Headers: Content-Type, Authorization
```

---

## ⚡ Performance Optimizations

### 1. Connection Pooling
```javascript
MongoDB Connection Pool:
- maxPoolSize: 100      // Maximum concurrent connections
- minPoolSize: 20       // Pre-warmed connections
- Compression: zlib     // Reduce network traffic
- Write Concern: w=1    // Faster writes
```

### 2. Caching Strategy

#### Hybrid Cache (Redis + In-Memory)
```javascript
// Redis for shared cache across PM2 cluster
// In-memory fallback if Redis unavailable

Cache TTL by Route:
- /api/dashboard: 60 seconds
- /api/companies: 180 seconds (3 minutes)
- /api/products: 180 seconds
- /api/analytics: 300 seconds (5 minutes)
- /api/browse-members: 60 seconds
- /api/discover: 180 seconds
- /api/locations: 3600 seconds (1 hour - static data)

Cache Invalidation:
- On data update (PUT/POST/DELETE)
- On admin approval actions
- On profile updates
```

#### Cache Middleware Usage
```javascript
app.use('/api/dashboard', hybridCacheMiddleware(60), dashboardRoutes);
app.use('/api/companies', hybridCacheMiddleware(180), companiesRoutes);
app.use('/api/locations', hybridCacheMiddleware(3600), locationsRoutes);
```

### 3. Database Indexes
```javascript
// Automatically created indexes on all schemas

Critical Indexes:
- memberdetails: email (unique), state+district+block
- memberauths: email (unique), memberId
- applications: email, status+state+district+block
- products: companyId+createdAt, category, featured
- notifications: recipientId+isRead+createdAt
- activities: memberId+companyId+createdAt

Text Search Indexes:
- memberdetails: fullName (text)
- products: name+description (text)
- companies: companyName (text)
```

### 4. Query Optimization

#### Parallel Queries
```javascript
// Login endpoint example
const [member, memberAuth] = await Promise.all([
  MemberDetails.findOne({ email }).lean(),
  MemberAuth.findOne({ email }).lean(false)
]);
// Reduces total query time by ~50%
```

#### Lean Queries
```javascript
// Use .lean() for read-only queries (faster)
const members = await MemberDetails.find({}).lean();

// Don't use .lean() when you need Mongoose methods
const memberAuth = await MemberAuth.findOne({ email }).lean(false);
```

#### Field Selection
```javascript
// Only select needed fields
const member = await MemberDetails.findOne({ email })
  .select('fullName email phoneNumber state district')
  .lean();
```

### 5. Compression
```javascript
// Gzip compression for all responses
// Configured in middleware/compression.js
// Reduces response size by 70-90%
```

### 6. Response Compression
```javascript
// All responses are compressed with gzip
// Typical compression ratios:
// - JSON responses: 80-90% reduction
// - HTML responses: 70-85% reduction
```

---

## 🚀 Deployment Configuration

### PM2 Cluster Mode
```javascript
// pm2.config.js
module.exports = {
  apps: [{
    name: 'activ-backend',
    script: './server.js',
    instances: 2,              // 2 cluster instances
    exec_mode: 'cluster',      // Cluster mode for load balancing
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};

// Start with PM2:
// npm install -g pm2
// pm2 start pm2.config.js
// pm2 save
// pm2 startup
```

### Environment Variables

#### Development (config.env)
```bash
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb+srv://activapp2025_db_user:password@cluster1.gf7usct.mongodb.net/membersdb
JWTSECRET=your-super-secret-jwt-key-change-in-production
REDIS_URL=redis://localhost:6379 (optional)
```

#### Production (production.env)
```bash
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb+srv://activapp2025_db_user:password@cluster1.gf7usct.mongodb.net/membersdb
JWTSECRET=your-production-jwt-secret-key-very-strong
REDIS_URL=redis://your-redis-server:6379
```

### Server Management Commands
```bash
# Development
npm run dev              # Start with nodemon (auto-reload)

# Production
npm start                # Start server
pm2 start pm2.config.js  # Start with PM2 cluster
pm2 restart all          # Restart all instances
pm2 stop all             # Stop all instances
pm2 logs                 # View logs
pm2 monit                # Monitor processes

# Kill all Node processes (Windows)
npm run stop             # taskkill /F /IM node.exe
```

---

## 📊 Monitoring & Health Checks

### Health Check Endpoints

#### GET /health
**Purpose:** Quick health check (production monitoring)  

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-18T10:30:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "mongodb": {
    "state": "connected",
    "stateCode": 1,
    "connected": true
  },
  "memory": {
    "usedMB": 150,
    "totalMB": 512,
    "percentUsed": 29
  }
}
```

#### GET /health/detailed
**Purpose:** Detailed health check with database ping  

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-18T10:30:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "mongodb": {
    "connected": true,
    "readyState": 1,
    "ping": "success",
    "pingTimeMs": 45,
    "host": "cluster1.gf7usct.mongodb.net"
  },
  "memory": {
    "rss": 150000000,
    "heapTotal": 100000000,
    "heapUsed": 80000000,
    "external": 5000000
  },
  "cpu": {
    "user": 1000000,
    "system": 500000
  }
}
```

### Performance Monitoring
```javascript
// Middleware tracks request duration
// Logs slow queries (>1000ms)
// Monitors MongoDB connection state
// Tracks memory usage
```

---

## 🛠️ Error Handling

### Error Response Format
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error (development only)"
}
```

### HTTP Status Codes
```
200 - Success
201 - Created
400 - Bad Request (validation error)
401 - Unauthorized (invalid credentials)
403 - Forbidden (inactive account)
404 - Not Found
409 - Conflict (duplicate entry)
500 - Internal Server Error
503 - Service Unavailable (database down)
```

### Global Error Handler
```javascript
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: 'error',
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});
```

---

## 📦 NPM Scripts

```json
{
  "start": "node server.js",              // Production start
  "dev": "nodemon server.js",             // Development with auto-reload
  "stop": "taskkill /F /IM node.exe",     // Kill all Node processes (Windows)
  "restart": "npm run stop && npm run dev",
  "test": "node test/load-test.js",       // Load testing
  "optimize": "node run-optimization.js"  // Apply optimizations
}
```

---

## 🔧 Middleware Stack

### Request Processing Order
```
1. Trust Proxy Setting
2. Helmet (Security headers)
3. Compression (Gzip)
4. Performance Monitoring
5. Rate Limiting
6. CORS
7. Body Parsing (JSON + URL-encoded)
8. Request Logging
9. Route-specific Cache Middleware
10. Route Handlers
11. Error Handler
12. 404 Handler
```

### Custom Middleware

#### 1. Compression Middleware
```javascript
// middleware/compression.js
const compression = require('compression');

module.exports = compression({
  level: 6,                    // Balance between speed and compression
  threshold: 1024,             // Only compress responses > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
});
```

#### 2. Performance Middleware
```javascript
// middleware/performance.js
module.exports = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`⚠️  Slow request: ${req.method} ${req.url} - ${duration}ms`);
    }
  });
  
  next();
};
```

#### 3. Hybrid Cache Middleware
```javascript
// middleware/hybrid-cache.js
const hybridCacheMiddleware = (ttlSeconds) => {
  return async (req, res, next) => {
    const cacheKey = `${req.method}:${req.originalUrl}`;
    
    // Try Redis first
    let cached = await redisCache.get(cacheKey);
    
    // Fallback to in-memory
    if (!cached) {
      cached = memoryCache.get(cacheKey);
    }
    
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    
    // Store original res.json
    const originalJson = res.json.bind(res);
    
    // Override res.json
    res.json = function(data) {
      const jsonData = JSON.stringify(data);
      
      // Cache in both Redis and memory
      redisCache.set(cacheKey, jsonData, ttlSeconds);
      memoryCache.set(cacheKey, jsonData, ttlSeconds);
      
      originalJson(data);
    };
    
    next();
  };
};
```

#### 4. Validation Middleware
```javascript
// middleware/validation.js
const { body, validationResult } = require('express-validator');

exports.validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  }
];
```

---

## 🧪 Testing

### Test Files
```
test/
├── load-test.js              # Load testing with multiple concurrent users
├── test-apis.js              # API endpoint testing
├── test-login-api.js         # Login flow testing
├── test-browse-members.js    # Browse members functionality
├── test-companies-system.js  # Company management testing
├── test-products-system.js   # Product catalog testing
└── test-optimizations.js     # Performance optimization testing
```

### Load Testing
```bash
# Run load test
npm run test

# Output:
# 📊 Load Test Results:
# ✅ 100 requests completed
# ⏱️  Average response time: 150ms
# 🚀 Requests per second: 200
# ❌ Failed requests: 0
```

---

## 🔐 Best Practices Implemented

### 1. Security
- ✅ Helmet for security headers
- ✅ CORS configured with whitelist
- ✅ Rate limiting on all endpoints
- ✅ JWT tokens with expiry
- ✅ Bcrypt password hashing (10 rounds)
- ✅ Input validation with express-validator
- ✅ SQL injection prevention (Mongoose)
- ✅ XSS protection

### 2. Performance
- ✅ Connection pooling (100 max, 20 min)
- ✅ Database indexes on all collections
- ✅ Hybrid caching (Redis + In-memory)
- ✅ Response compression (gzip)
- ✅ Lean queries for read operations
- ✅ Parallel query execution
- ✅ Field selection (select only needed fields)

### 3. Scalability
- ✅ PM2 cluster mode (2 instances)
- ✅ Stateless architecture (JWT tokens)
- ✅ Shared cache with Redis
- ✅ Load balancing ready
- ✅ Horizontal scaling support

### 4. Reliability
- ✅ Auto-reconnection to MongoDB
- ✅ Health check endpoints
- ✅ Error handling middleware
- ✅ Request logging
- ✅ Graceful shutdown handling
- ✅ Database connection retries (5 attempts)

### 5. Maintainability
- ✅ Modular route structure
- ✅ Separated models and routes
- ✅ Environment-based configuration
- ✅ Comprehensive error messages
- ✅ Code comments and documentation

---

## 📝 Development Workflow

### 1. Local Development Setup
```bash
# Clone repository
git clone https://github.com/syed-rahmannnn/actv-project.git
cd actv-project/activ-backend

# Install dependencies
npm install

# Create config.env file
# Add MongoDB URI and JWT secret

# Start development server
npm run dev

# Server runs on http://localhost:3000
```

### 2. Adding New Routes
```javascript
// 1. Create new route file in routes/
// routes/newFeature.js
const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  // Implementation
});

module.exports = router;

// 2. Import in server.js
const newFeatureRoutes = require('./routes/newFeature');

// 3. Mount route with middleware
app.use('/api/new-feature', limiter, hybridCacheMiddleware(60), newFeatureRoutes);
```

### 3. Adding New Models
```javascript
// 1. Create model file in models/
// models/NewModel.js
const mongoose = require('mongoose');

const newModelSchema = new mongoose.Schema({
  field1: { type: String, required: true },
  field2: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// Add indexes
newModelSchema.index({ field1: 1 });

module.exports = mongoose.model('NewModel', newModelSchema);

// 2. Import in route file
const NewModel = require('../models/NewModel');

// 3. Use in route handlers
const data = await NewModel.find({}).lean();
```

---

## 🚨 Common Issues & Solutions

### Issue 1: Port Already in Use
```bash
# Solution 1: Kill all Node processes
npm run stop

# Solution 2: Change port in config.env
PORT=3001

# Solution 3: Find and kill specific process
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Issue 2: MongoDB Connection Failed
```
# Check MongoDB URI in config.env
# Ensure IP whitelist in MongoDB Atlas
# Check internet connection
# Verify credentials

# Backend will auto-retry 5 times with 2-second delay
```

### Issue 3: Redis Not Available
```
# Backend automatically falls back to in-memory cache
# No action needed for development
# For production, install and configure Redis
```

### Issue 4: PM2 Not Found
```bash
# Install PM2 globally
npm install -g pm2

# Or use npx
npx pm2 start pm2.config.js
```

---

## 📚 Additional Resources

### Documentation Files
- `BACKEND_ARCHITECTURE.md` - Architecture overview
- `API_DOCUMENTATION.md` - Complete API reference
- `OPTIMIZATION_GUIDE.md` - Performance optimization guide
- `PM2_COMMANDS.md` - PM2 management commands
- `WEBHOOK_SETUP_GUIDE.md` - Payment webhook integration
- `ADMIN_SETUP_GUIDE.md` - Admin user creation guide

### Useful Links
- MongoDB Atlas: https://www.mongodb.com/cloud/atlas
- Express.js Docs: https://expressjs.com/
- Mongoose Docs: https://mongoosejs.com/
- PM2 Docs: https://pm2.keymetrics.io/
- JWT.io: https://jwt.io/

---

## 🎯 Summary

This backend architecture provides:

1. **Robust Authentication** - JWT-based auth with bcrypt password hashing
2. **Multi-tier Admin System** - Block/District/State/Super admin hierarchy
3. **Business Management** - Multi-company and product catalog support
4. **Performance** - Caching, connection pooling, compression, indexes
5. **Scalability** - PM2 cluster mode, stateless design, Redis support
6. **Security** - Rate limiting, CORS, Helmet, input validation
7. **Reliability** - Auto-reconnection, health checks, error handling
8. **Developer-Friendly** - Modular structure, comprehensive docs, easy setup

### Quick Start for Website Integration
```javascript
// 1. Use same MongoDB database (membersdb)
// 2. Reuse same API endpoints
// 3. Implement JWT authentication
// 4. Use same data models
// 5. Connect to same backend: https://actv-project.onrender.com/api

// Example: Login from website
const response = await fetch('https://actv-project.onrender.com/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

const data = await response.json();
if (data.success) {
  localStorage.setItem('token', data.data.token);
  // Redirect to dashboard
}
```

---

**End of Documentation**  
**Author:** ACTIV Development Team  
**Last Updated:** December 18, 2025  
**Version:** 1.0.0  
**License:** Proprietary
