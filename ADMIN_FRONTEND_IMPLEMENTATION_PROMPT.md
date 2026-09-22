# Admin Dashboard Frontend Implementation Prompt

## 🎯 Objective
Create admin dashboard pages to complete the hierarchical approval workflow. Admins need to login, view pending applications, and approve/reject them based on their role and location.

---

## 📋 Required Pages

### 1. Admin Login Page (`/admin/login`)

**Location:** `src/pages/admin/Login.tsx`

**Features:**
- Email and password input fields
- Login button
- Error message display
- Redirect to dashboard on success

**API Integration:**
```typescript
const handleLogin = async (email: string, password: string) => {
  const response = await fetch('http://localhost:4000/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  
  if (data.success) {
    // Store admin data
    localStorage.setItem('adminToken', data.data.token);
    localStorage.setItem('adminId', data.data.admin.id);
    localStorage.setItem('adminName', data.data.admin.fullName);
    localStorage.setItem('adminRole', data.data.admin.role);
    localStorage.setItem('adminEmail', data.data.admin.email);
    
    // Redirect to dashboard
    navigate('/admin/dashboard');
  }
};
```

**UI Design:**
- Similar to member login page
- Use Shadcn UI Card component
- Input fields for email and password
- Primary button for login
- Display admin role icon/badge

---

### 2. Admin Dashboard (`/admin/dashboard`)

**Location:** `src/pages/admin/Dashboard.tsx`

**Features:**
- Display admin profile (name, role, location)
- Show statistics cards:
  - Pending applications count
  - Approved applications count
  - Total applications count
- Quick actions: "View Pending Applications"
- Logout button

**API Integration:**
```typescript
// Get dashboard stats
const fetchStats = async () => {
  const token = localStorage.getItem('adminToken');
  const response = await fetch('http://localhost:4000/api/admin/dashboard/stats', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  setStats(data.data);
};
```

**UI Design:**
```
┌─────────────────────────────────────────────────┐
│  ACTIV Admin Dashboard                  [Logout]│
├─────────────────────────────────────────────────┤
│  Welcome, Thandrampet Block Admin               │
│  Role: Block Admin                              │
│  Location: Tamil Nadu > Tiruvannamalai >        │
│            Thandrampet                           │
├─────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Pending  │  │ Approved │  │  Total   │      │
│  │    5     │  │    12    │  │    20    │      │
│  └──────────┘  └──────────┘  └──────────┘      │
├─────────────────────────────────────────────────┤
│  [View Pending Applications] →                  │
└─────────────────────────────────────────────────┘
```

---

### 3. Applications List (`/admin/applications`)

**Location:** `src/pages/admin/Applications.tsx`

**Features:**
- Table showing all pending applications
- Columns: Member Name, Email, Type (Aspirant/Business), Location, Submitted Date, Status
- "View Details" button for each application
- Filter/search functionality
- Pagination

**API Integration:**
```typescript
// Get pending applications
const fetchApplications = async () => {
  const token = localStorage.getItem('adminToken');
  const response = await fetch('http://localhost:4000/api/applications', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  setApplications(data.data);
};
```

**UI Design:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Pending Applications (5)                                       │
├─────────────────────────────────────────────────────────────────┤
│  Member Name  │ Email          │ Type     │ Location │ Action   │
├───────────────┼────────────────┼──────────┼──────────┼──────────┤
│  Sai Sree     │ saisree@...    │ Aspirant │ Thanipa  │ [View]   │
│  John Doe     │ john@...       │ Business │ Chennal  │ [View]   │
│  ...          │ ...            │ ...      │ ...      │ ...      │
└─────────────────────────────────────────────────────────────────┘
```

---

### 4. Application Details (`/admin/applications/:id`)

**Location:** `src/pages/admin/ApplicationDetails.tsx`

**Features:**
- Display full application details
- Show all form data (Personal, Business, Financial*, Declaration)
- Display approval history (who approved at each level)
- Approve button with remarks textarea
- Reject button with remarks textarea
- Back to applications list button

**API Integration:**
```typescript
// Get application details
const fetchApplicationDetails = async (id: string) => {
  const token = localStorage.getItem('adminToken');
  const response = await fetch(`http://localhost:4000/api/applications/${id}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  setApplication(data.data);
};

// Approve application
const handleApprove = async (remarks: string) => {
  const token = localStorage.getItem('adminToken');
  const response = await fetch(
    `http://localhost:4000/api/applications/${applicationId}/approve`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ remarks })
    }
  );
  
  if (response.ok) {
    toast.success('Application approved successfully');
    navigate('/admin/applications');
  }
};

// Reject application
const handleReject = async (remarks: string) => {
  const token = localStorage.getItem('adminToken');
  const response = await fetch(
    `http://localhost:4000/api/applications/${applicationId}/reject`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ remarks })
    }
  );
  
  if (response.ok) {
    toast.success('Application rejected');
    navigate('/admin/applications');
  }
};
```

**UI Design:**
```
┌─────────────────────────────────────────────────────────────┐
│  Application Details: APP-1702886400-XYZ123                 │
│  [← Back to Applications]                                    │
├─────────────────────────────────────────────────────────────┤
│  Member Information:                                         │
│  Name: Sai Sree                                             │
│  Email: saisree@gmail.com                                   │
│  Phone: 9876543210                                          │
│  Location: Tamil Nadu > Tiruvannamalai > Thandrampet       │
│  Type: Aspirant                                             │
│  Status: Pending Block Approval                             │
├─────────────────────────────────────────────────────────────┤
│  Personal Details:                                          │
│  Religion: Hindu                                            │
│  Social Category: General                                   │
│  ...                                                        │
├─────────────────────────────────────────────────────────────┤
│  Business Information:                                      │
│  Doing Business: No                                         │
│  ...                                                        │
├─────────────────────────────────────────────────────────────┤
│  Declaration:                                               │
│  Accepted: Yes                                              │
│  Remarks: I agree to all terms...                          │
├─────────────────────────────────────────────────────────────┤
│  Approval History:                                          │
│  ✓ Block Admin: Pending                                    │
│  ○ District Admin: Pending                                 │
│  ○ State Admin: Pending                                    │
├─────────────────────────────────────────────────────────────┤
│  Remarks (optional):                                        │
│  [_______________________________________________]          │
│                                                             │
│  [Approve] [Reject]                                         │
└─────────────────────────────────────────────────────────────┘
```

---

### 5. Member Application Status Page (Enhancement)

**Location:** Update `src/pages/member/ApplicationStatus.tsx`

**Features:**
- Display application ID
- Show current status
- Display approval progress with visual indicators
- Show remarks from each admin level
- Show what's next

**API Integration:**
```typescript
// Get application by userId
const fetchApplicationStatus = async () => {
  const token = localStorage.getItem('token');
  const memberId = localStorage.getItem('memberId');
  
  // You'll need to add this endpoint or modify existing one
  const response = await fetch(
    `http://localhost:4000/api/applications/user/${memberId}`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  const data = await response.json();
  setApplication(data.data);
};
```

**UI Design:**
```
┌─────────────────────────────────────────────────────────────┐
│  Application Status                                          │
│  Application ID: APP-1702886400-XYZ123                      │
├─────────────────────────────────────────────────────────────┤
│  Current Status: Pending District Approval                  │
├─────────────────────────────────────────────────────────────┤
│  Approval Progress:                                         │
│                                                             │
│  1. ✅ Block Admin Review                                  │
│     Approved by: Thandrampet Block Admin                   │
│     Date: Dec 18, 2025                                     │
│     Remarks: Verified and approved                         │
│                                                             │
│  2. 🔄 District Admin Review (In Progress)                 │
│     Status: Pending                                        │
│                                                             │
│  3. ⏳ State Admin Review                                   │
│     Status: Pending                                        │
│                                                             │
│  4. ⏳ Ready for Payment                                    │
│     Status: Pending                                        │
├─────────────────────────────────────────────────────────────┤
│  What's Next?                                               │
│  Your application is being reviewed by the District Admin. │
│  You will be notified once approved.                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛡️ Protected Routes Setup

**Location:** Update `src/App.tsx` or routing file

```typescript
// Add admin routes
<Route path="/admin/login" element={<AdminLogin />} />
<Route
  path="/admin/dashboard"
  element={
    <AdminProtectedRoute>
      <AdminDashboard />
    </AdminProtectedRoute>
  }
/>
<Route
  path="/admin/applications"
  element={
    <AdminProtectedRoute>
      <AdminApplications />
    </AdminProtectedRoute>
  }
/>
<Route
  path="/admin/applications/:id"
  element={
    <AdminProtectedRoute>
      <ApplicationDetails />
    </AdminProtectedRoute>
  }
/>

// AdminProtectedRoute component
const AdminProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const adminToken = localStorage.getItem('adminToken');
  
  if (!adminToken) {
    return <Navigate to="/admin/login" />;
  }
  
  return <>{children}</>;
};
```

---

## 🎨 UI Components to Use

### Shadcn UI Components:
- `Card` - For dashboard stats, application details
- `Table` - For applications list
- `Button` - For actions
- `Input` - For forms
- `Textarea` - For remarks
- `Badge` - For status indicators
- `Alert` - For error/success messages
- `Dialog` - For confirmation modals

### Status Indicators:
```typescript
const getStatusBadge = (status: string) => {
  const statusConfig = {
    pending_block_approval: { label: 'Pending Block', variant: 'warning' },
    pending_district_approval: { label: 'Pending District', variant: 'info' },
    pending_state_approval: { label: 'Pending State', variant: 'info' },
    approved: { label: 'Approved', variant: 'success' },
    rejected: { label: 'Rejected', variant: 'destructive' }
  };
  
  const config = statusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
};
```

---

## 📝 Additional Backend Endpoint Needed

You may need to add this endpoint to get a member's application:

**File:** `server/controllers/applicationController.js`

```javascript
// @desc    Get application by user ID
// @route   GET /api/applications/user/:userId
// @access  Private (Member)
export const getApplicationByUserId = async (req, res) => {
  try {
    const application = await Application.findOne({ userId: req.params.userId })
      .sort({ submittedAt: -1 }); // Get latest
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'No application found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: application
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
```

**Add route in:** `server/routes/applicationRoutes.js`

```javascript
import { protect as memberProtect } from '../middleware/auth.js';

// Public route for members to check their application
router.get('/user/:userId', memberProtect, getApplicationByUserId);
```

---

## ✅ Testing Checklist

### Admin Login:
- [ ] Can login with block admin credentials
- [ ] Can login with district admin credentials
- [ ] Can login with state admin credentials
- [ ] Token stored in localStorage
- [ ] Redirects to dashboard on success
- [ ] Shows error on invalid credentials

### Admin Dashboard:
- [ ] Displays admin name and role
- [ ] Shows correct location
- [ ] Displays accurate statistics
- [ ] "View Applications" button works
- [ ] Logout button clears localStorage and redirects

### Applications List:
- [ ] Shows only applications for admin's jurisdiction
- [ ] Block admin sees only their block applications
- [ ] District admin sees only their district applications
- [ ] State admin sees only their state applications
- [ ] View button navigates to details page

### Application Details:
- [ ] Displays all form data correctly
- [ ] Shows approval history
- [ ] Approve button works
- [ ] Reject button works
- [ ] Remarks field optional
- [ ] Success toast on approval
- [ ] Redirects back to list after action

### Member Application Status:
- [ ] Shows current status
- [ ] Displays approval progress
- [ ] Shows admin remarks
- [ ] Updates in real-time

---

## 🚀 Implementation Priority

1. **High Priority:**
   - Admin Login Page ✨
   - Admin Dashboard ✨
   - Applications List ✨
   - Application Details with Approve/Reject ✨

2. **Medium Priority:**
   - Member Application Status enhancement
   - Search/filter in applications list
   - Pagination

3. **Low Priority:**
   - Email notifications
   - Real-time updates
   - Advanced analytics

---

## 📞 Test Data Available

### Members:
- **Saisree** (saisree@gmail.com) - Forms complete, ready to create application

### Admins:
- **Block:** thandrampet.block@activ.com / Admin@123
- **District:** tiruvannamalai.district@activ.com / Admin@123
- **State:** tamilnadu.state@activ.com / Admin@123

---

## 🎯 Expected Outcome

After implementation:
1. Admin can login with credentials
2. Admin sees their jurisdiction's pending applications
3. Admin can view application details
4. Admin can approve/reject with remarks
5. Application moves to next approval level
6. Member can see approval progress

---

**This prompt provides complete guidance for implementing the admin dashboard frontend!** 🎉
