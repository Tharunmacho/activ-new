# Profile Page Simplification - Mobile App Alignment

## Overview
Simplified the Profile page to match the mobile app's field structure and functionality. Removed the complex 4-step additional details form and replaced it with a clean 3-screen mobile app design.

## Changes Made

### 1. ProfileData Type Updated
**Before:**
```typescript
type ProfileData = {
  firstName: string;
  middleName?: string;
  lastName?: string;
  email: string;
  phone: string;
  dateOfBirth?: string;
  gender?: string;
  state?: string;
  district?: string;
  block?: string;
  address?: string;
};
```

**After:**
```typescript
type ProfileData = {
  name: string;
  phone: string;
  email: string;
  password?: string;
  confirmPassword?: string;
  religion?: string;
  socialCategory?: string;
  block?: string;
  state?: string;
  district?: string;
  city?: string;
};
```

### 2. Form Structure Simplified

#### Screen 1: Personal Details
- **Fields:** Phone Number, Email ID, Password (Optional), Confirm Password
- **Button:** "Save Personal Details"
- **Functionality:** Validates required fields, checks password match, saves to localStorage

#### Screen 2: Demographic Details
- **Fields:** Religion (dropdown), Social Category (dropdown)
- **Buttons:** "Back", "Next"
- **Functionality:** Validates required fields, saves to localStorage, proceeds to Step 3

#### Screen 3: Additional Details Form
- **Title:** "Additional Details Form - Step 1 of 4"
- **Fields:** Name, State (dropdown), District (dropdown - cascading), Block (dropdown - cascading from API), City
- **Buttons:** "Back", "Save Profile"
- **Functionality:** Validates all fields, saves to localStorage + backend, navigates to dashboard

### 3. Removed Complex Features
- ❌ Multi-step additional details form (4 steps with 30+ fields)
- ❌ Business information fields
- ❌ Financial & compliance fields
- ❌ Declaration and sister concerns
- ❌ Edit/Cancel mode toggle
- ❌ Profile completion percentage display
- ❌ Extra details state management
- ❌ Application submission flow

### 4. Added Features
- ✅ Password visibility toggle (Eye/EyeOff icons)
- ✅ Step indicators (1, 2, 3) with visual feedback
- ✅ Cascading dropdowns for State → District → Block
- ✅ Real-time block loading from backend API
- ✅ Form validation with error messages
- ✅ LocalStorage integration for profile data
- ✅ Backend sync on final save

## Field Mappings

### Mobile App → Web Profile

**Screen 1: Personal Details**
- Phone Number → `phone` field
- Email ID → `email` field
- Password → `password` field (optional)
- Confirm Password → `confirmPassword` field

**Screen 2: Demographic Details**
- Religion → `religion` dropdown (7 options: Hinduism, Islam, Christianity, Sikhism, Buddhism, Jainism, Others)
- Social Category → `socialCategory` dropdown (5 options: General, OBC, SC, ST, EWS)

**Screen 3: Additional Form**
- Name → `name` field (auto-split into firstName/lastName)
- State → `state` dropdown (36 states from INDIA_DISTRICTS)
- District → `district` dropdown (cascading from selected state)
- Block → `block` dropdown (cascading from backend API based on state + district)
- City → `city` text input

## Data Flow

### Loading Profile Data
1. On component mount, loads from `localStorage.getItem("userProfile")` or `"registrationData"`
2. Maps existing fields: `name || firstName`, `phone`, `email`, `religion`, `socialCategory`, `block`, `state`, `district`, `city`
3. Resets form with loaded data

### Saving Personal Details (Step 1)
1. Validates phone and email are filled
2. If password provided, validates match with confirmPassword
3. Merges with existing profile data in localStorage
4. Saves to `userProfile` and `registrationData`
5. Advances to Step 2

### Saving Demographic Details (Step 2)
1. Validates religion and socialCategory are selected
2. Merges with existing profile data
3. Saves to localStorage
4. Advances to Step 3

### Saving Additional Form (Step 3)
1. Validates all fields are filled
2. Splits name into firstName and lastName
3. Merges all data
4. Saves to localStorage (`userProfile`, `registrationData`, `userName`)
5. Sends POST request to `http://localhost:4000/api/profile`
6. Navigates to `/member/dashboard` on success

## API Integration

### Backend Profile Endpoint
```typescript
POST /api/profile
Body: {
  userId: string,  // from localStorage.getItem("memberId")
  name: string,
  firstName: string,
  lastName: string,
  phone: string,
  email: string,
  religion: string,
  socialCategory: string,
  state: string,
  district: string,
  block: string,
  city: string
}
```

### Blocks API (Existing)
```typescript
GET /api/locations/blocks?state={stateName}&district={districtName}
Response: {
  blocks: string[]
}
```

## localStorage Keys Used
- `userProfile` - Main profile data storage
- `registrationData` - Backup profile data
- `userName` - User's full name
- `memberId` - User ID for backend calls

## UI/UX Improvements
- Clean, modern card-based layout
- Centered content with max-width for better readability
- Visual step indicators with active state highlighting
- Proper form validation with inline error messages
- Password visibility toggles for better UX
- Responsive design for mobile and desktop
- Smooth transitions between steps
- Disabled states for cascading dropdowns

## Files Modified
- `src/pages/member/Profile.tsx` - Complete rewrite (787 lines → 543 lines)

## Testing Checklist
- [ ] Step 1: Personal Details saves correctly
- [ ] Password validation works (match check)
- [ ] Password visibility toggle works
- [ ] Step 2: Religion and Social Category save correctly
- [ ] Step 3: State selection loads districts
- [ ] Step 3: District selection loads blocks from API
- [ ] Step 3: All fields save to localStorage
- [ ] Step 3: Backend API call succeeds
- [ ] Navigation to dashboard works after save
- [ ] Profile data persists on page reload
- [ ] Mobile responsive design works
- [ ] Step indicators update correctly

## Related Files
- `src/pages/member/Dashboard.tsx` - Reads profile from localStorage (no changes needed)
- `src/pages/member/Register.tsx` - Saves initial registration data (already compatible)
- `src/data/india-districts.ts` - State/District data source
- `server/data/india-locations.js` - Block data source (backend)

## Migration Notes
- Existing user profiles will load correctly (backward compatible)
- `firstName` + `lastName` auto-mapped to `name` field
- All existing localStorage data preserved
- No database migration needed

## Benefits
✅ Simpler, cleaner user interface
✅ Matches mobile app experience exactly
✅ Fewer fields to reduce user friction
✅ Better focus on essential profile information
✅ Easier to maintain and extend
✅ Reduced code complexity (787 → 543 lines)
✅ Improved mobile responsiveness
