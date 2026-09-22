# Profile Page - Single Card Layout (4 Steps)

## Overview
Implemented a single card layout for the Profile page with all 4 steps of the registration form in one continuous scrollable card, matching the mobile app design exactly.

## Layout Structure

### Top Bar
- **Blue app bar** with "ACTIV" branding
- Mobile menu icon on left
- Fixed header design

### Main Container
- **Light blue background** (#F3F4F6 - `bg-blue-50`)
- **Single large white rounded card** with shadow
- **Max-width: 3xl** for optimal readability
- Vertical scroll for all content

### Card Header
- **Title**: "Additional Details Form"
- **Subtitle**: "Member Registration"
- **Progress Indicators**: 4 steps (1-4) with visual feedback
- **Step Counter**: "Step X of 4"

## Step-by-Step Form Structure

### **Step 1: Personal, Account & Demographic Details**

#### Section: Personal details
- Name * (text input)
- Block * (dropdown - cascading from district selection)
- State * (dropdown - 36 states from INDIA_DISTRICTS)
- District * (dropdown - cascading from state selection)
- City * (text input)
- Phone Number * (tel input)
- Email ID * (email input)

#### Section: Account security
- Password (password input with eye icon toggle)
- Confirm Password (password input with eye icon toggle)
- Helper text: "Leave blank to keep your current password."

#### Section: Demographic details
- Religion * (text input)
- Social Category * (dropdown: General, OBC, SC, ST, EWS)

#### Actions
- **"Save Personal Details"** button (blue) - Validates and saves
- **"Next >"** button (green) - Proceeds to Step 2

---

### **Step 2: Business Information Form**

#### Doing Business Decision
- **Radio buttons**: Yes / No (Aspirant/Student)
- If "No" selected → Skips directly to application submission

#### Business Details (shown only if "Yes")
- Name of the Organization * (text input)
- Constitution of the Company * (dropdown)
  - Proprietorship
  - Partnership
  - Private Limited
  - Public Limited
  - Others
- Type of Business * (multi-select checkboxes)
  - Agriculture
  - Manufacturing
  - Trader
  - Retailer
  - Service Provider
  - Others

#### Additional Business Info
- Business Commencement Year (dropdown: current year - 50 years)
- Number of Employees (number input)
- Member of any other Chamber/Association (text input)
- Registered with Govt. Organization (multi-select)
  - MSME
  - KVIC
  - NABARD
  - None
  - Others

#### Actions
- **"< Back"** button - Returns to Step 1
- **"Next >"** button - Proceeds to Step 3

---

### **Step 3: Financial & Compliance Form**

#### Core Financial Fields
- **PAN Number *** (text input with validation)
  - Format: ABCDE1234F
  - Regex: `/^[A-Z]{5}[0-9]{4}[A-Z]$/`
  - Max length: 10 characters

- **GST Number *** (text input with validation)
  - Format: 15 characters
  - Min/Max length: 15

- **Udyam Number** (text input - MSME Registration)

#### ITR Filing Status
- **Filed Income Tax Returns *** (radio buttons: Yes / No)
- **Years Filed** (number input - shown only if "Yes")

#### Turnover Information
- **Turnover Range** (dropdown)
  - Less than ₹10 Lakhs
  - ₹10 Lakhs - ₹1 Crore
  - Over ₹1 Crore

- **Turnover for Last 3 Years** (3 text inputs)
  - FY 2021-22
  - FY 2020-21
  - FY 2019-20

- **Government Scheme Benefits** (text input)

#### Actions
- **"< Back"** button - Returns to Step 2
- **"Next >"** button - Proceeds to Step 4

---

### **Step 4: Declaration Form**

#### Company Information
- **No. of Sister Concerns** (number input)
  - Helper text: "Please input a value"

- **Name(s) of Company** (textarea)
  - Multi-line input for company names

#### Declaration
- **Checkbox** (required) with declaration text:
  > "This application is under the Verification and Screening Process. We have every right to ACCEPT or REJECT this application according to our membership policy. I confirm the above information is true and correct."

#### Actions
- **"< Back"** button - Returns to Step 3
- **"Submit Application"** button (blue) - Final submission

---

## Data Flow & Validation

### Step 1 Validation
```typescript
- All personal fields required (name, block, state, district, city, phone, email)
- Password match validation if provided
- Religion and social category required
```

### Step 2 Validation
```typescript
- Doing business selection required
- If "No" → Skip to submission (aspirant flow)
- If "Yes" → Organization, constitution, and business types required
```

### Step 3 Validation
```typescript
- PAN number required (format: ABCDE1234F)
- GST number required (15 characters)
- Filed ITR status required
```

### Step 4 Validation
```typescript
- Declaration checkbox must be accepted
```

## Data Storage

### localStorage Keys
- `userProfile` - Main profile data
- `registrationData` - Backup profile data
- `userName` - User's full name

### ProfileData TypeScript Type
```typescript
type ProfileData = {
  // Step 1
  name: string;
  block?: string;
  state?: string;
  district?: string;
  city?: string;
  phone: string;
  email: string;
  password?: string;
  confirmPassword?: string;
  religion?: string;
  socialCategory?: string;
  
  // Step 2
  doingBusiness?: string;
  organization?: string;
  constitution?: string;
  businessTypes?: string[];
  businessYear?: string;
  employees?: string;
  chamber?: string;
  govtOrgs?: string[];
  
  // Step 3
  pan?: string;
  gst?: string;
  udyam?: string;
  filedITR?: string;
  itrYears?: string;
  turnoverRange?: string;
  turnover1?: string; // FY 2021-22
  turnover2?: string; // FY 2020-21
  turnover3?: string; // FY 2019-20
  govtSchemes?: string;
  
  // Step 4
  sisterConcerns?: string;
  companyNames?: string;
  declarationAccepted?: boolean;
};
```

## Backend Integration

### Profile Save Endpoint
```typescript
POST /api/profile
Body: { userId, ...allProfileFields }
```

### Location API (existing)
```typescript
GET /api/locations/blocks?state={state}&district={district}
Response: { blocks: string[] }
```

## UI/UX Features

### Visual Design
✅ Single card layout on light blue background
✅ Large white rounded card with shadow
✅ 4-step progress indicators with active state
✅ Section headers with dividers
✅ Consistent spacing and padding

### Form Elements
✅ Password visibility toggles (eye icons)
✅ Cascading dropdowns (State → District → Block)
✅ Multi-select checkboxes for arrays
✅ Radio buttons for Yes/No decisions
✅ Textarea for multi-line input
✅ Number inputs for numeric data
✅ Validation with inline error messages

### Navigation
✅ "Save Personal Details" on Step 1
✅ "Next >" button advances steps
✅ "< Back" button returns to previous step
✅ "Submit Application" on final step
✅ Auto-submit for aspirants (Step 2 "No" option)

### Responsive Design
✅ Mobile-first approach
✅ Vertical scrolling for long forms
✅ Touch-friendly form controls
✅ Centered layout with max-width

## Special Flows

### Aspirant Flow
- User selects "No" for "Doing Business" in Step 2
- Application is automatically submitted
- Skips Steps 3 and 4

### Business Flow
- User selects "Yes" for "Doing Business" in Step 2
- Must complete Steps 3 and 4
- All financial and declaration fields required

## Color Scheme
- **Primary Blue**: `#2563EB` (bg-blue-600)
- **Green Action**: `#16A34A` (bg-green-600)
- **Light Blue BG**: `#EFF6FF` (bg-blue-50)
- **White Card**: `#FFFFFF`
- **Gray Text**: `#6B7280` (text-gray-500/600)

## Files Modified
- `src/pages/member/Profile.tsx` - Complete rewrite with single card layout

## Testing Checklist
- [ ] Step 1: All personal fields validate correctly
- [ ] Password visibility toggle works
- [ ] State/District/Block cascading works
- [ ] Step 1: Save button works
- [ ] Step 2: Doing business radio selection works
- [ ] Step 2: Aspirant flow (No option) submits directly
- [ ] Step 2: Business details show only when "Yes"
- [ ] Step 2: Multi-select checkboxes work
- [ ] Step 3: PAN validation (ABCDE1234F format)
- [ ] Step 3: GST validation (15 chars)
- [ ] Step 3: ITR conditional field works
- [ ] Step 4: Declaration checkbox required
- [ ] Step 4: Final submission works
- [ ] Back buttons navigate correctly
- [ ] Data persists across steps
- [ ] LocalStorage saves correctly
- [ ] Backend API call succeeds
- [ ] Mobile responsive design works
- [ ] Progress indicators update correctly

## Benefits
✅ Single card layout as per mobile app design
✅ All sections in one continuous vertical scroll
✅ Clear visual progress indicators (1-4)
✅ Grouped sections with headers and dividers
✅ Comprehensive validation at each step
✅ Aspirant flow for non-business users
✅ Complete business and financial data capture
✅ Declaration and compliance tracking
✅ Better mobile user experience
✅ Matches mobile app exactly
