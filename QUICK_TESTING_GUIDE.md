# Quick Testing Guide - Admin Authentication with adminsdb

## ✅ Backend Setup Complete

Your backend is now configured to use the existing **adminsdb** with 7,769 real admin accounts!

## 🎯 What's Been Done

1. ✅ Dual database connection (activ-db + adminsdb)
2. ✅ Admin models mapped to existing collections
3. ✅ Login searches all 4 admin collections (block, district, state, super)
4. ✅ Location data extracted from `admin.meta` object
5. ✅ Application filtering by admin jurisdiction
6. ✅ Hierarchical approval workflow (block → district → state)
7. ✅ JWT authentication with 24-hour expiry

## 🚀 How to Test

### Step 1: Start the Backend Server
```bash
cd c:\activ-web\actv-webfinal\server
node server.js
```

The server should start on `http://localhost:4000`

### Step 2: Test Admin Login

**For Thandrampet Block Admin:**
```bash
curl -X POST http://localhost:4000/api/admin/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\": \"block.thandrampet.tiruvannamalai.tamil.nadu@activ.com\", \"password\": \"YOUR_PASSWORD\"}"
```

Replace `YOUR_PASSWORD` with the actual password from your admin setup.

**Expected Response:**
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

### Step 3: Test Dashboard Access

Copy the token from login response and use it:

```bash
curl -X GET http://localhost:4000/api/admin/auth/me ^
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "email": "block.thandrampet.tiruvannamalai.tamil.nadu@activ.com",
    "fullName": "Thandrampet Block Admin",
    "role": "block_admin",
    "state": "Tamil Nadu",
    "district": "Tiruvannamalai",
    "block": "Thandrampet"
  }
}
```

### Step 4: Test Application Viewing

```bash
curl -X GET http://localhost:4000/api/applications ^
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected Response:**
```json
{
  "success": true,
  "count": 0,
  "data": []
}
```

Initially empty - applications will appear when users from Thandrampet submit their profiles.

## 📋 Available Admin Accounts

### Tamil Nadu Admins
- **Block**: `block.thandrampet.tiruvannamalai.tamil.nadu@activ.com`
- **District**: `district.tiruvannamalai.tamil.nadu@activ.com`
- **State**: `state.tamil.nadu@activ.com`

### Super Admin
- **Email**: `superadmin@activ.com`

### All States Available
Your adminsdb has admins for **all 36 Indian states/UTs**, **762 districts**, and **6,969 blocks**!

## 🔑 Finding Admin Credentials

Since passwords are hashed in the database, you need to know the original passwords. If you don't have them:

### Option 1: Check your admin setup documentation
Look for password documentation from when adminsdb was created.

### Option 2: Create a password reset script
```javascript
// Reset password for a specific admin
import bcrypt from 'bcryptjs';
import { BlockAdmin } from './models/ExistingAdmins.js';

const newPassword = 'YourNewPassword123';
const hashedPassword = await bcrypt.hash(newPassword, 10);

await BlockAdmin.updateOne(
  { email: 'block.thandrampet.tiruvannamalai.tamil.nadu@activ.com' },
  { passwordHash: hashedPassword }
);
```

### Option 3: Ask database administrator
Contact whoever created the adminsdb database for password information.

## 🧪 Testing Complete Workflow

1. **User Registration**: Have a test user register from Thandrampet, Tiruvannamalai
2. **Complete Profile**: User fills personal, business, financial, declaration forms
3. **Auto-Create Application**: Application automatically created on declaration submission
4. **Block Admin Login**: Login as Thandrampet block admin
5. **View Application**: See the application in pending_block_approval status
6. **Approve**: Approve the application
7. **District Admin Login**: Login as Tiruvannamalai district admin
8. **View Application**: See the application moved to pending_district_approval
9. **Approve**: Approve at district level
10. **State Admin Login**: Login as Tamil Nadu state admin
11. **View Application**: See the application moved to pending_state_approval
12. **Approve**: Final approval - status becomes "approved"

## 🐛 Common Issues

### "Invalid credentials"
- ✅ Check email is exact match (lowercase, no spaces)
- ✅ Verify password is correct
- ✅ Ensure admin account has `active: true`

### "No applications found"
- ✅ User location must match admin location exactly
- ✅ User must have completed declaration form
- ✅ Application status must match admin level

### "Not authorized"
- ✅ Include JWT token in Authorization header
- ✅ Use format: `Bearer <token>` (note the space)
- ✅ Token expires after 24 hours - login again

## 📊 Database Information

**MongoDB Connection**: 
```
mongodb+srv://activapp2025_db_user:o6xFHfqzLXM6LUaa@cluster1.gf7usct.mongodb.net/
```

**Databases**:
- `activ-db`: Main application data (users, forms, applications, companies, products)
- `adminsdb`: Admin authentication (blockadmins, districtadmins, stateadmins, superadmins)

**Admin Collections**:
- `blockadmins`: 6,969 documents
- `districtadmins`: 762 documents
- `stateadmins`: 36 documents
- `superadmins`: 2 documents

## 📚 Full Documentation

For complete API documentation and technical details, see:
- [ADMIN_ADMINSDB_INTEGRATION.md](./ADMIN_ADMINSDB_INTEGRATION.md)

## 🎉 Next Steps

1. Test login with your actual admin passwords
2. Submit a test user application from Thandrampet
3. Verify application appears in block admin dashboard
4. Test the full approval workflow
5. Build frontend admin dashboard UI
6. Add email/SMS notifications for approvals

---

**Need Help?** 
Check the server logs for detailed error messages:
```bash
# In server directory
node server.js
```

All authentication attempts are logged with details.
