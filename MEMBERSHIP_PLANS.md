# ACTIV Membership Plans

## Overview
ACTIV offers two types of memberships based on member profile: **Aspirant Membership** for students and **Business Membership** for professionals with company experience.

---

## 1. Aspirant Membership Plan

**Target Audience:** Students without company experience

**Annual Fee:** ₹2,000/annum

### Features & Benefits
- ✅ Access to learning resources and webinars
- ✅ Student-only events and competitions
- ✅ Mentorship and career guidance
- ✅ Networking with professionals

### Eligibility
- Students pursuing education
- Individuals without business/company experience
- Selected "No" for doing business during registration

### Route
`/payment/membership-plan`

---

## 2. Business Membership Plans

**Target Audience:** Professionals with company/business experience

### Three Tier Structure

#### 🥉 Basic Plan
**Annual Fee:** ₹5,000/annum

**Recommended For:**
- Professionals with less than 5 years of business experience
- Entry-level business owners
- Early-stage entrepreneurs

**Features:**
- All aspirant plan benefits
- Business networking events
- Industry-specific resources
- Professional mentorship
- Member directory access

---

#### 🥈 Intermediate Plan (Most Popular)
**Annual Fee:** ₹10,000/annum

**Recommended For:**
- Professionals with 5-10 years of business experience
- Established business owners
- Mid-level entrepreneurs

**Features:**
- All Basic Plan benefits
- Priority event registration
- Advanced business workshops
- One-on-one consulting sessions
- Marketing and growth resources
- Collaboration opportunities

**Badge:** "Most Popular"

---

#### 🥇 Ideal Plan (Premium)
**Annual Fee:** ₹20,000/annum

**Recommended For:**
- Professionals with 10+ years of business experience
- Senior business leaders
- Established enterprises

**Features:**
- All Intermediate Plan benefits
- VIP event access
- Exclusive networking circles
- Strategic business consulting
- Policy advocacy participation
- Speaking opportunities at events
- Premium member recognition

---

## Membership Determination Logic

### Backend Logic
Located in: `server/controllers/declarationFormController.js`

```javascript
const memberType = businessForm.doingBusiness === 'yes' ? 'business' : 'aspirant';
```

**Database Field:** `applications.memberType`
- Values: `'aspirant'` or `'business'`

### Frontend Routing
Located in: `src/pages/member/ApplicationStatus.tsx`

```javascript
const isAspirant = application?.memberType === 'aspirant';

if (isAspirant) {
  navigate('/payment/membership-plan'); // Aspirant Plan ₹2000
} else {
  navigate('/payment/membership-plans'); // Business Plans (3 tiers)
}
```

---

## Payment Flow

### 1. Application Approval
- Block Admin → District Admin → State Admin approval
- Application status becomes `'approved'`

### 2. Payment Initiation
- User clicks "Register for Payment" button
- System checks `memberType` field
- Routes to appropriate payment page

### 3. Plan Selection
**Aspirant Members:**
- Single plan page with ₹2000 fixed price

**Business Members:**
- Three-tier selection page
- Plan selection based on business experience
- Recommended plan highlighted

### 4. Payment Processing
- Test Mode: Mock payment (USE_TEST_MODE=true)
- Production: Instamojo payment gateway
- Endpoint: `/api/payment/initiate`

### 5. Payment Confirmation
- Success page with membership details
- Downloadable certificate and receipt
- Access to member dashboard

---

## Database Schema

### Application Model
```javascript
memberType: {
  type: String,
  enum: ['aspirant', 'business'],
  required: true
}

paymentDetails: {
  paymentId: String,
  planType: String,  // "Aspirant Plan", "Basic Plan", "Intermediate Plan", "Ideal Plan"
  planAmount: Number,
  supportAmount: Number,
  totalAmount: Number,
  initiatedAt: Date,
  completedAt: Date
}
```

---

## API Endpoints

### Get User Application
```
GET /api/applications/my-application
Headers: Authorization: Bearer <token>
Response: { success: true, data: { memberType, status, ... } }
```

### Initiate Payment
```
POST /api/payment/initiate
Headers: Authorization: Bearer <token>
Body: {
  planType: "Basic Plan",
  planAmount: 5000,
  supportAmount: 0,
  totalAmount: 5000
}
```

---

## File Structure

### Frontend Pages
- `/src/pages/payment/PaymentRegistration.tsx` - Aspirant Plan (₹2000)
- `/src/pages/payment/MembershipPlans.tsx` - Business Plans (3 tiers)
- `/src/pages/payment/PaymentConfirmation.tsx` - Success page
- `/src/pages/payment/MockPayment.tsx` - Test payment simulator
- `/src/pages/payment/MemberDashboard.tsx` - Post-payment dashboard

### Backend Controllers
- `/server/controllers/paymentController.js` - Payment logic
- `/server/controllers/declarationFormController.js` - memberType determination
- `/server/controllers/applicationController.js` - Application management

### Services
- `/server/services/instamojoService.js` - Instamojo integration
- `/src/services/paymentApi.ts` - Frontend payment API

---

## Environment Variables

```env
# Payment Gateway
INSTAMOJO_ENDPOINT=https://www.instamojo.com/api/1.1/
INSTAMOJO_API_KEY=your_api_key
INSTAMOJO_AUTH_TOKEN=your_auth_token
INSTAMOJO_SALT=your_private_salt

# Test Mode
USE_TEST_MODE=true
NODE_ENV=development

# URLs
FRONTEND_URL=http://localhost:8080
BACKEND_URL=http://localhost:4000
```

---

## Testing

### Test Mode
When `USE_TEST_MODE=true`:
- Payment redirects to `/payment/mock`
- No actual Instamojo API calls
- Unlimited test payments allowed
- Direct navigation to confirmation page

### Test Accounts
**Aspirant Member:**
- Create application with "Doing Business" = No
- memberType will be 'aspirant'
- Routes to ₹2000 plan

**Business Member:**
- Create application with "Doing Business" = Yes
- memberType will be 'business'
- Routes to 3-tier plans

---

## Troubleshooting

### Issue: Always showing Aspirant Plan
**Problem:** Application memberType not set correctly
**Solution:** Check businessForm.doingBusiness value during application creation

### Issue: Payment 500 Error
**Problem:** planType enum validation failing
**Solution:** Remove enum restriction on paymentDetails.planType (accepts any string)

### Issue: Wrong plan displayed after payment
**Problem:** Frontend not checking memberType
**Solution:** Update PaymentConfirmation.tsx and MemberDashboard.tsx to check app.memberType

---

## Future Enhancements

1. **Dynamic Pricing**
   - Allow admin to modify plan prices
   - Seasonal discounts and promotions

2. **Multi-Year Plans**
   - 2-year and 3-year membership options
   - Discounted rates for longer commitments

3. **Add-on Services**
   - Optional premium features
   - Certification programs
   - Training workshops

4. **Corporate Plans**
   - Bulk membership for organizations
   - Custom enterprise pricing
   - Team management features

5. **Auto-Renewal**
   - Automatic membership renewal
   - Payment reminders
   - Grace period for renewals

---

## Contact & Support

For membership queries:
- Email: support@activ.com
- Phone: +91-XXXX-XXXXXX
- Member Portal: /member/dashboard

---

**Last Updated:** December 20, 2025  
**Version:** 1.0  
**Status:** Active
