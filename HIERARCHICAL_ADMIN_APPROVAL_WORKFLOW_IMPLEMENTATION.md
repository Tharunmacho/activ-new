# Hierarchical Admin Approval Workflow - Implementation Guide

## 🎯 Overview

The ACTIV Web Application now implements a **3-tier hierarchical admin approval workflow**. When a member completes their profile, their application goes through multiple approval stages based on their geographic location (Block → District → State).

---

## 📊 Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    MEMBER SUBMITS APPLICATION                    │
│               (Completes Personal + Business +                   │
│                 Financial* + Declaration Forms)                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              APPLICATION RECORD CREATED IN DATABASE              │
│  - Status: "pending_block_approval"                              │
│  - Location: State > District > Block                            │
│  - Member Type: Aspirant or Business                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    🏛️  BLOCK ADMIN REVIEW                       │
│  Block Admin Login → Dashboard → See Pending Applications        │
│  - View Application Details                                       │
│  - Review All Forms                                               │
│  - Decision: APPROVE or REJECT                                    │
└────────────┬────────────────────┬───────────────────────────────┘
             │                    │
        ✅ APPROVE          ❌ REJECT
             │                    │
             │                    └──────────────┐
             ▼                                   ▼
┌──────────────────────────────────┐  ┌──────────────────────────┐
│  Status: pending_district_approval│  │  Status: rejected        │
│  Goes to District Admin           │  │  Workflow ENDS           │
└────────────┬─────────────────────┘  └──────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  🏢  DISTRICT ADMIN REVIEW                       │
│  District Admin Login → Dashboard → See Pending Applications     │
│  - View Application + Block Admin's Approval                     │
│  - Decision: APPROVE or REJECT                                    │
└────────────┬────────────────────┬───────────────────────────────┘
             │                    │
        ✅ APPROVE          ❌ REJECT
             │                    │
             │                    └──────────────┐
             ▼                                   ▼
┌──────────────────────────────────┐  ┌──────────────────────────┐
│  Status: pending_state_approval   │  │  Status: rejected        │
│  Goes to State Admin              │  │  Workflow ENDS           │
└────────────┬─────────────────────┘  └──────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   🏛️  STATE ADMIN REVIEW                        │
│  State Admin Login → Dashboard → See Pending Applications        │
│  - View Application + All Previous Approvals                     │
│  - Decision: APPROVE or REJECT                                    │
└────────────┬────────────────────┬───────────────────────────────┘
             │                    │
        ✅ APPROVE          ❌ REJECT
             │                    │
             ▼                    ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│  Status: approved         │  │  Status: rejected        │
│  FINAL APPROVAL ✅        │  │  Workflow ENDS           │
│  Ready for Payment        │  └──────────────────────────┘
└───────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      💳  PAYMENT SCREEN                          │
│  Member can proceed to payment after all approvals               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Structure

### 1. **Admins Collection** (`admins`)

```javascript
{
  _id: ObjectId,
  fullName: String,
  email: String (unique),
  password: String (hashed),
  phoneNumber: String,
  role: String (enum: ['block_admin', 'district_admin', 'state_admin', 'super_admin']),
  state: String,      // Required for state/district/block admins
  district: String,   // Required for district/block admins
  block: String,      // Required for block admins only
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### 2. **Applications Collection** (`applications`)

```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: 'WebUser'),
  applicationId: String (unique, e.g., "APP-1702886400-XYZ123"),
  
  // Member Info
  memberName: String,
  memberEmail: String,
  memberPhone: String,
  
  // Location
  state: String,
  district: String,
  block: String,
  city: String,
  
  // Type
  memberType: String (enum: ['aspirant', 'business']),
  
  // Status
  status: String (enum: [
    'pending_block_approval',
    'pending_district_approval',
    'pending_state_approval',
    'approved',
    'rejected'
  ]),
  
  // Approval Tracking
  approvals: {
    block: {
      adminId: ObjectId (ref: 'Admin'),
      adminName: String,
      status: String (enum: ['pending', 'approved', 'rejected']),
      remarks: String,
      actionDate: Date
    },
    district: {
      adminId: ObjectId (ref: 'Admin'),
      adminName: String,
      status: String (enum: ['pending', 'approved', 'rejected']),
      remarks: String,
      actionDate: Date
    },
    state: {
      adminId: ObjectId (ref: 'Admin'),
      adminName: String,
      status: String (enum: ['pending', 'approved', 'rejected']),
      remarks: String,
      actionDate: Date
    }
  },
  
  // Form References
  personalFormId: ObjectId (ref: 'PersonalForm'),
  businessFormId: ObjectId (ref: 'BusinessForm'),
  financialFormId: ObjectId (ref: 'FinancialForm'),
  declarationFormId: ObjectId (ref: 'DeclarationForm'),
  
  // Payment
  paymentStatus: String (enum: ['pending', 'completed', 'failed']),
  paymentAmount: Number,
  paymentDate: Date,
  transactionId: String,
  
  submittedAt: Date,
  lastUpdated: Date
}
```

---

## 🔌 API Endpoints

### Admin Authentication

#### POST `/api/admin/login`
**Purpose:** Admin login  
**Authentication:** None  

**Request:**
```json
{
  "email": "thandrampattu.block@activ.com",
  "password": "Admin@123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "admin": {
      "id": "...",
      "fullName": "Thandrampattu Block Admin",
      "email": "thandrampattu.block@activ.com",
      "role": "block_admin",
      "state": "Andhra Pradesh",
      "district": "Anantapur",
      "block": "Thandrampattu"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

#### GET `/api/admin/me`
**Purpose:** Get current admin info  
**Authentication:** Required (Admin JWT)  

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "fullName": "Thandrampattu Block Admin",
    "email": "thandrampattu.block@activ.com",
    "role": "block_admin",
    "state": "Andhra Pradesh",
    "district": "Anantapur",
    "block": "Thandrampattu"
  }
}
```

---

#### GET `/api/admin/dashboard/stats`
**Purpose:** Get dashboard statistics for admin  
**Authentication:** Required (Admin JWT)  

**Response:**
```json
{
  "success": true,
  "data": {
    "pending": 5,
    "approved": 12,
    "total": 20,
    "role": "block_admin",
    "location": {
      "state": "Andhra Pradesh",
      "district": "Anantapur",
      "block": "Thandrampattu"
    }
  }
}
```

---

### Application Management

#### GET `/api/applications`
**Purpose:** Get all applications for admin (filtered by role and location)  
**Authentication:** Required (Admin JWT)  

**Filtering Logic:**
- **Block Admin:** See applications from their block with status `pending_block_approval`
- **District Admin:** See applications from their district with status `pending_district_approval`
- **State Admin:** See applications from their state with status `pending_state_approval`
- **Super Admin:** See all applications

**Response:**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "_id": "...",
      "applicationId": "APP-1702886400-XYZ123",
      "memberName": "Sai Sree",
      "memberEmail": "saisree@example.com",
      "memberPhone": "9876543210",
      "state": "Andhra Pradesh",
      "district": "Anantapur",
      "block": "Thandrampattu",
      "memberType": "aspirant",
      "status": "pending_block_approval",
      "submittedAt": "2025-12-18T10:30:00.000Z"
    }
  ]
}
```

---

#### GET `/api/applications/:id`
**Purpose:** Get single application with full details  
**Authentication:** Required (Admin JWT)  

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "applicationId": "APP-1702886400-XYZ123",
    "memberName": "Sai Sree",
    "memberEmail": "saisree@example.com",
    "status": "pending_block_approval",
    "approvals": {
      "block": { "status": "pending" },
      "district": { "status": "pending" },
      "state": { "status": "pending" }
    },
    "personalFormId": { /* full personal form data */ },
    "businessFormId": { /* full business form data */ },
    "declarationFormId": { /* full declaration data */ }
  }
}
```

---

#### POST `/api/applications/:id/approve`
**Purpose:** Approve application at current admin level  
**Authentication:** Required (Admin JWT)  

**Request:**
```json
{
  "remarks": "Application verified and approved"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Application approved successfully",
  "data": {
    "_id": "...",
    "applicationId": "APP-1702886400-XYZ123",
    "status": "pending_district_approval",
    "approvals": {
      "block": {
        "adminId": "...",
        "adminName": "Thandrampattu Block Admin",
        "status": "approved",
        "remarks": "Application verified and approved",
        "actionDate": "2025-12-18T11:00:00.000Z"
      },
      "district": { "status": "pending" },
      "state": { "status": "pending" }
    }
  }
}
```

---

#### POST `/api/applications/:id/reject`
**Purpose:** Reject application at current admin level  
**Authentication:** Required (Admin JWT)  

**Request:**
```json
{
  "remarks": "Incomplete documentation"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Application rejected",
  "data": {
    "_id": "...",
    "applicationId": "APP-1702886400-XYZ123",
    "status": "rejected",
    "approvals": {
      "block": {
        "adminId": "...",
        "adminName": "Thandrampattu Block Admin",
        "status": "rejected",
        "remarks": "Incomplete documentation",
        "actionDate": "2025-12-18T11:00:00.000Z"
      }
    }
  }
}
```

---

#### GET `/api/applications/stats`
**Purpose:** Get application statistics for admin's jurisdiction  
**Authentication:** Required (Admin JWT)  

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 50,
    "pending": 15,
    "approved": 30,
    "rejected": 5,
    "aspirants": 35,
    "business": 15
  }
}
```

---

## 🚀 Setup Instructions

### Step 1: Seed Admin Users

Run the seed script to create admin users in the database:

```bash
cd server
node scripts/seed-admins.js
```

This will create the following admin accounts:

| Role | Email | Password | State | District | Block |
|------|-------|----------|-------|----------|-------|
| Block Admin | thandrampattu.block@activ.com | Admin@123 | Andhra Pradesh | Anantapur | Thandrampattu |
| District Admin | anantapur.district@activ.com | Admin@123 | Andhra Pradesh | Anantapur | - |
| State Admin | ap.state@activ.com | Admin@123 | Andhra Pradesh | - | - |
| Block Admin | blr.north.block@activ.com | Admin@123 | Karnataka | Bangalore Urban | Bangalore North |
| District Admin | blr.district@activ.com | Admin@123 | Karnataka | Bangalore Urban | - |
| State Admin | karnataka.state@activ.com | Admin@123 | Karnataka | - | - |
| Super Admin | super.admin@activ.com | Admin@123 | All India | - | - |

---

### Step 2: Test Member Application Submission

1. Login as **saisree** (existing member)
2. Complete profile if not already done
3. Submit declaration form
4. Backend automatically creates Application record with status `pending_block_approval`
5. Application is assigned to block admin based on member's location

---

### Step 3: Test Admin Approval Workflow

#### Test Block Admin Approval:
```bash
# 1. Login as Block Admin
POST http://localhost:4000/api/admin/login
{
  "email": "thandrampattu.block@activ.com",
  "password": "Admin@123"
}

# 2. Get pending applications
GET http://localhost:4000/api/applications
Headers: Authorization: Bearer <token>

# 3. View application details
GET http://localhost:4000/api/applications/:applicationId
Headers: Authorization: Bearer <token>

# 4. Approve application
POST http://localhost:4000/api/applications/:applicationId/approve
Headers: Authorization: Bearer <token>
{
  "remarks": "Verified by block admin"
}
```

#### Test District Admin Approval:
```bash
# 1. Login as District Admin
POST http://localhost:4000/api/admin/login
{
  "email": "anantapur.district@activ.com",
  "password": "Admin@123"
}

# 2. Get pending applications (only district-level)
GET http://localhost:4000/api/applications
Headers: Authorization: Bearer <token>

# 3. Approve application
POST http://localhost:4000/api/applications/:applicationId/approve
Headers: Authorization: Bearer <token>
{
  "remarks": "Verified by district admin"
}
```

#### Test State Admin Approval:
```bash
# 1. Login as State Admin
POST http://localhost:4000/api/admin/login
{
  "email": "ap.state@activ.com",
  "password": "Admin@123"
}

# 2. Get pending applications (only state-level)
GET http://localhost:4000/api/applications
Headers: Authorization: Bearer <token>

# 3. Final approval
POST http://localhost:4000/api/applications/:applicationId/approve
Headers: Authorization: Bearer <token>
{
  "remarks": "Final approval by state admin"
}
```

---

## 🧪 Testing Scenarios

### Scenario 1: Saisree's Application from Thandrampattu

**Member Details:**
- Name: Sai Sree
- Location: Andhra Pradesh > Anantapur > Thandrampattu

**Expected Flow:**
1. Saisree submits application → Status: `pending_block_approval`
2. Appears in **Thandrampattu Block Admin** dashboard
3. Block admin approves → Status: `pending_district_approval`
4. Appears in **Anantapur District Admin** dashboard
5. District admin approves → Status: `pending_state_approval`
6. Appears in **Andhra Pradesh State Admin** dashboard
7. State admin approves → Status: `approved` ✅

---

### Scenario 2: Application Rejection at District Level

**Flow:**
1. Member submits → Status: `pending_block_approval`
2. Block admin approves → Status: `pending_district_approval`
3. **District admin rejects** → Status: `rejected` ❌
4. Workflow stops, member notified

---

### Scenario 3: Multiple Applications in Same Block

**Setup:**
- 5 members register in Thandrampattu block
- All submit applications

**Expected:**
- All 5 applications appear in Thandrampattu Block Admin dashboard
- Block admin can approve/reject each individually
- Each follows its own approval chain

---

## 📱 Frontend Integration (To Be Built)

### Admin Dashboard Pages Needed:

1. **Admin Login Page** (`/admin/login`)
   - Email + Password fields
   - POST to `/api/admin/login`
   - Store admin token and role

2. **Admin Dashboard** (`/admin/dashboard`)
   - Display stats from `/api/admin/dashboard/stats`
   - Show pending, approved, total counts
   - Admin profile info (name, role, location)

3. **Applications List** (`/admin/applications`)
   - Fetch from `/api/applications`
   - Display table: Member Name, Email, Type, Submitted Date, Status
   - Actions: View Details, Approve, Reject

4. **Application Details** (`/admin/applications/:id`)
   - Fetch from `/api/applications/:id`
   - Display all form data (Personal, Business, Financial, Declaration)
   - Show approval history (who approved at each level)
   - Approve/Reject buttons with remarks textarea

---

## 🔐 Security Features

1. **JWT Authentication:** All admin routes protected with JWT tokens
2. **Role-Based Access:** Admins can only see applications in their jurisdiction
3. **Password Hashing:** Bcrypt with salt rounds for password security
4. **Location Validation:** Applications can only be approved by admins with authority over that location
5. **Status Validation:** Application must be at correct approval stage for admin's role

---

## 📊 Database Queries for Monitoring

### Find all pending applications in a block:
```javascript
db.applications.find({
  state: "Andhra Pradesh",
  district: "Anantapur",
  block: "Thandrampattu",
  status: "pending_block_approval"
})
```

### Find all applications approved by specific admin:
```javascript
db.applications.find({
  "approvals.block.adminId": ObjectId("admin_id_here")
})
```

### Count applications by status:
```javascript
db.applications.aggregate([
  { $group: { _id: "$status", count: { $sum: 1 } } }
])
```

---

## ✅ Implementation Checklist

- [x] Create Admin model
- [x] Create Application model
- [x] Create admin authentication controller and routes
- [x] Create application management controller and routes
- [x] Add admin authentication middleware
- [x] Update declaration form controller to create applications
- [x] Create admin seed script
- [x] Mount routes in main server file
- [x] Convert all files to ES6 modules
- [ ] Build admin frontend pages
- [ ] Test complete approval workflow
- [ ] Add email notifications for approvals
- [ ] Add member notification system

---

## 🎉 Workflow is Ready!

The backend implementation is **complete and ready for testing**. When Saisree (or any member) completes their profile, an Application record will automatically be created and assigned to the appropriate block admin based on their location.

**Next Steps:**
1. Run `node server/scripts/seed-admins.js` to create admin users
2. Test admin login with provided credentials
3. Have a member complete their profile
4. Login as block admin to see the application
5. Test the approval workflow through all three levels

---

**Document Version:** 1.0  
**Created:** December 18, 2025  
**Status:** Backend Complete, Frontend Pending
