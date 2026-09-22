# ACTIV Platform - Feature Implementation Plan

## Priority 1: Business Form Validation (Requirement #10)
**Status**: ✅ READY TO IMPLEMENT
**Requirement**: "In types of business need to have only manufacturing, services and trade"

### Implementation:
1. Update BusinessForm.tsx to restrict business type options
2. Add validation on backend BusinessForm model
3. Update existing data if needed

---

## Priority 2: Privacy Settings (Requirement #18-19)
**Status**: 🔄 NEEDS IMPLEMENTATION
**Requirements**: 
- "Only paid member can see other paid member details and can connect"
- "Only mobile no to be shared with other member"

### Implementation:
1. Create privacy settings in user profile
2. Add payment status check before showing member directory
3. Implement contact visibility controls
4. Update member search/directory to respect privacy settings

---

## Priority 3: Trust List Feature (Requirement #20)
**Status**: 🔄 NEEDS IMPLEMENTATION
**Requirement**: "Create trust list for the company"

### Implementation:
1. Create TrustedCompany model (userId, companyId, addedAt)
2. Add "Add to Trust List" button on company profiles
3. Create "My Trusted Companies" page
4. API endpoints: POST /api/trusted-companies, GET /api/trusted-companies

---

## Priority 4: Event Management System (Requirements #22-24, #32)
**Status**: 🔄 NEEDS IMPLEMENTATION
**Requirements**:
- Event search by month & date
- Event types: Free, Paid, Online
- Paid event types: Full day, QLM (3 hrs)
- QLM sub-types: Tea party, Coffee meet (women only)
- Venue details, date, city

### Implementation:
1. Create Event model with fields:
   - title, description, venue, city, date
   - eventType: 'free' | 'paid' | 'online'
   - paidEventType: 'full_day' | 'qlm'
   - qlmSubType: 'tea_party' | 'coffee_meet'
   - genderRestriction: 'all' | 'women' | 'men'
   - price, duration
2. Create event search/filter UI
3. Event registration system
4. Admin event management

---

## Priority 5: Company Update Restrictions (Requirement #21)
**Status**: ✅ READY TO VERIFY
**Requirement**: "Only company details to be updated"

### Verification Needed:
- Check if company edit form only allows company details
- Ensure member personal info cannot be changed via company form

---

## Implementation Order:
1. ✅ Business Form Validation (Quick - 15 min)
2. 🔄 Trust List Feature (Medium - 30 min)
3. 🔄 Privacy Settings (Medium - 45 min)  
4. 🔄 Event Management (Complex - 2 hours)
5. ✅ Company Update Verification (Quick - 10 min)

---

## Files to Create/Modify:

### Backend:
- `server/src/shared/models/TrustedCompany.js` (NEW)
- `server/src/shared/models/Event.js` (NEW)
- `server/src/features/member/controllers/trustedCompanyController.js` (NEW)
- `server/src/features/event/controllers/eventController.js` (NEW)
- `server/src/shared/models/BusinessForm.js` (MODIFY - add enum validation)
- `server/src/shared/models/WebUserProfile.js` (MODIFY - add privacy settings)

### Frontend:
- `src/pages/member/BusinessForm.tsx` (MODIFY - restrict business types)
- `src/pages/member/TrustedCompanies.tsx` (NEW)
- `src/pages/member/Events.tsx` (MODIFY - add search/filter)
- `src/pages/member/EventDetails.tsx` (NEW)
- `src/pages/admin/EventManagement.tsx` (NEW)
- `src/pages/member/Settings.tsx` (MODIFY - add privacy settings)

---

## Next Steps:
Run implementations in order 1-5, testing each before moving to next.
