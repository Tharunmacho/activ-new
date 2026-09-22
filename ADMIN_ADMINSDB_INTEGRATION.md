# Admin Authentication with Existing adminsdb

## Overview
The backend has been successfully configured to use your existing `adminsdb` MongoDB database with 7,769 pre-configured admin accounts across all Indian states, districts, and blocks.

## Database Structure

### adminsdb Collections
- **blockadmins**: 6,969 block-level administrators
- **districtadmins**: 762 district-level administrators  
- **stateadmins**: 36 state-level administrators
- **superadmins**: 2 super administrators
- **Total**: 7,769 admin accounts

### Admin Document Structure
```javascript
{
  _id: ObjectId,
  adminId: String,
  email: String,  // Format: block.{block}.{district}.{state}@activ.com
  passwordHash: String,  // bcrypt hashed password
  fullName: String,
  role: String,  // "BlockAdmin", "DistrictAdmin", "StateAdmin", "SuperAdmin"
  active: Boolean,
  meta: {
    state: String,      // "Tamil Nadu"
    district: String,   // "Tiruvannamalai"
    block: String,      // "Thandrampet"
    stateLc: String,    // "tamil nadu" (lowercase for queries)
    districtLc: String, // "tiruvannamalai"
    blockLc: String     // "thandrampet"
  },
  lastLoginAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

## Backend Configuration

### Database Connections
Located in `server/config/multiDatabase.js`:
- **mainDbConnection**: Connected to `activ-db` (main application data)
- **adminDbConnection**: Connected to `adminsdb` (admin authentication)

### Admin Models
Located in `server/models/ExistingAdmins.js`:
- `BlockAdmin`: Maps to `blockadmins` collection
- `DistrictAdmin`: Maps to `districtadmins` collection
- `StateAdmin`: Maps to `stateadmins` collection
- `SuperAdmin`: Maps to `superadmins` collection

Each model includes:
- Schema definition matching existing database structure
- `comparePassword()` method for bcrypt verification
- Connection to `adminDbConnection`

## API Endpoints

### 1. Admin Login
**Endpoint**: `POST /api/admin/auth/login`

**Request Body**:
```json
{
  "email": "block.thandrampet.tiruvannamalai.tamil.nadu@activ.com",
  "password": "your_password_here"
}
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "admin": {
    "adminId": "BLOCK_TV_THANDU_001",
    "email": "block.thandrampet.tiruvannamalai.tamil.nadu@activ.com",
    "fullName": "Thandrampet Block Admin",
    "role": "block_admin",
    "state": "Tamil Nadu",
    "district": "Tiruvannamalai",
    "block": "Thandrampet"
  }
}
```

**Error Responses**:
- 400: Missing email or password
- 401: Invalid credentials
- 500: Server error

### 2. Get Admin Info
**Endpoint**: `GET /api/admin/auth/me`

**Headers**: 
```
Authorization: Bearer <JWT_TOKEN>
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "_id": "67...",
    "adminId": "BLOCK_TV_THANDU_001",
    "email": "block.thandrampet.tiruvannamalai.tamil.nadu@activ.com",
    "fullName": "Thandrampet Block Admin",
    "role": "block_admin",
    "active": true,
    "state": "Tamil Nadu",
    "district": "Tiruvannamalai",
    "block": "Thandrampet"
  }
}
```

### 3. Get Dashboard Stats
**Endpoint**: `GET /api/admin/dashboard/stats`

**Headers**: 
```
Authorization: Bearer <JWT_TOKEN>
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "pending": 5,
    "approved": 12,
    "rejected": 2,
    "total": 19,
    "pendingByLevel": {
      "block": 5,
      "district": 0,
      "state": 0
    }
  }
}
```

## Application Approval Workflow

### Endpoint
**GET**: `/api/applications` - Get applications for your jurisdiction  
**GET**: `/api/applications/:id` - Get specific application  
**POST**: `/api/applications/:id/approve` - Approve application  
**POST**: `/api/applications/:id/reject` - Reject application  
**GET**: `/api/applications/stats` - Get application statistics

### Authorization Hierarchy

1. **Block Admin**
   - Can only see applications from their specific block
   - Applications must be in `pending_block_approval` status
   - Location filter: `state`, `district`, `block` must match
   - Example: Thandrampet Block Admin sees only Thandrampet applications

2. **District Admin**
   - Can see applications from entire district (all blocks)
   - Applications must be in `pending_district_approval` status
   - Location filter: `state`, `district` must match
   - Receives applications after block approval

3. **State Admin**
   - Can see applications from entire state (all districts)
   - Applications must be in `pending_state_approval` status
   - Location filter: `state` must match
   - Receives applications after district approval

4. **Super Admin**
   - Can see all applications from all locations
   - No location filtering
   - Can manage any application at any stage

### Application Flow
```
User Submits → pending_block_approval
    ↓ Block Admin Approves
pending_district_approval
    ↓ District Admin Approves
pending_state_approval
    ↓ State Admin Approves
approved ✅
```

## Sample Admin Credentials

### Tamil Nadu (Example)
- **Block**: `block.thandrampet.tiruvannamalai.tamil.nadu@activ.com`
- **District**: `district.tiruvannamalai.tamil.nadu@activ.com`
- **State**: `state.tamil.nadu@activ.com`
- **Super Admin**: `superadmin@activ.com`

### Andaman and Nicobar Islands (Example)
- **Block**: `block.campbell.bay.nicobars.andaman.and.nicobar.islands@activ.com`
- **District**: `district.nicobars.andaman.and.nicobar.islands@activ.com`
- **State**: `state.andaman.and.nicobar.islands@activ.com`

## Testing the API

### Using cURL
```bash
# Login
curl -X POST http://localhost:4000/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "block.thandrampet.tiruvannamalai.tamil.nadu@activ.com",
    "password": "your_password"
  }'

# Get admin info (replace TOKEN with actual JWT)
curl -X GET http://localhost:4000/api/admin/auth/me \
  -H "Authorization: Bearer TOKEN"

# Get applications
curl -X GET http://localhost:4000/api/applications \
  -H "Authorization: Bearer TOKEN"

# Approve application (replace ID with actual application ID)
curl -X POST http://localhost:4000/api/applications/ID/approve \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"remarks": "Approved after verification"}'
```

### Using Postman
1. Create a new request
2. Set method to POST
3. URL: `http://localhost:4000/api/admin/auth/login`
4. Body (JSON):
   ```json
   {
     "email": "your_admin_email@activ.com",
     "password": "your_password"
   }
   ```
5. Copy the token from response
6. For protected routes, add Header:
   - Key: `Authorization`
   - Value: `Bearer <your_token>`

## Location Matching Logic

The system uses the `meta` object from adminsdb to match applications:

1. **Application Submission**: When a user submits a declaration form, an application is created with:
   - `state`, `district`, `block` from user's personal form

2. **Admin Login**: JWT token contains admin's location from `admin.meta`:
   - `state: admin.meta.state`
   - `district: admin.meta.district`
   - `block: admin.meta.block`

3. **Application Filtering**: Queries match based on exact location:
   - Block Admin: `state === admin.meta.state && district === admin.meta.district && block === admin.meta.block`
   - District Admin: `state === admin.meta.state && district === admin.meta.district`
   - State Admin: `state === admin.meta.state`

## Key Files Modified

### Core Configuration
- `server/config/multiDatabase.js` - Dual database connections
- `server/models/ExistingAdmins.js` - Admin models for adminsdb

### Controllers
- `server/controllers/adminController.js` - Admin authentication and dashboard
- `server/controllers/applicationController.js` - Application management

### Middleware
- `server/middleware/adminAuth.js` - JWT verification and admin authorization

### Routes
- `server/routes/adminRoutes.js` - Admin authentication routes
- `server/routes/applicationRoutes.js` - Application management routes

## Next Steps

1. **Test Login**: Use one of the sample admin emails with the actual password
2. **Submit Test Application**: Have a user submit a complete profile to create an application
3. **Test Approval Flow**: Login as each level of admin and approve the application
4. **Build Frontend**: Create admin dashboard UI to display applications and approval buttons
5. **Add Notifications**: Implement email/SMS notifications on approval/rejection

## Password Information

The passwords in adminsdb are bcrypt hashed. You need to know the original passwords used during admin creation. If you don't have them:

1. Contact the database administrator who created the adminsdb
2. Or create a password reset mechanism
3. Or manually update password hashes in the database using bcrypt

## Troubleshooting

### Issue: Login fails with "Invalid credentials"
- **Check**: Email format matches exactly (lowercase, dots, @activ.com)
- **Check**: Password is correct (case-sensitive)
- **Check**: Admin account has `active: true`

### Issue: "Admin not found"
- **Check**: Database connection to adminsdb is successful
- **Check**: Email exists in one of the 4 admin collections
- **Check**: Collection names are correct (blockadmins, not blockAdmins)

### Issue: Applications not showing
- **Check**: User's location matches admin's location exactly
- **Check**: Application status matches admin level (pending_block_approval for block admin)
- **Check**: Applications exist in activ-db database

### Issue: Authorization failed
- **Check**: JWT token is included in Authorization header
- **Check**: Token format is `Bearer <token>` (note the space)
- **Check**: Token hasn't expired (24 hour expiry)
