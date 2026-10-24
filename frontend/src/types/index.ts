// Navigation Types
import type { MemberRoutes } from './routes/member';
import type { PaymentRoutes } from './routes/payment';
import type { BusinessRoutes } from './routes/business';
import type { AdminRoutes } from './routes/admin';
import type { SuperRoutes } from './routes/super';

/** Every area's own routes merge here — add new screens in types/routes/<area>.ts. */
export type RootStackParamList = BaseStackParamList & MemberRoutes & PaymentRoutes & BusinessRoutes & AdminRoutes & SuperRoutes;

type BaseStackParamList = {
  /** `portal` picks the member or the admin reset, exactly like the website. */
  ForgotPassword: { portal?: 'member' | 'admin' } | undefined;
  /**
   * `token` arrives from a deep link (activ://reset-password?token=… or the
   * emailed https link, when the member opens it with the app); otherwise the
   * member pastes the link or code from the email.
   */
  ResetPassword: { token?: string; portal?: 'member' | 'admin' } | undefined;
  /**
   * Where the social sign-in deep link lands (activ://auth/social?…): the
   * server's one-time `code`, or an `error` (and for `no_account`, the verified
   * `email`/`name` to prefill registration with).
   */
  SocialSignIn: { code?: string; error?: string; provider?: string; email?: string; name?: string } | undefined;
  // Auth Stack
  Onboarding: undefined;
  PublicExplore: { section?: 'home' | 'events' | 'news' | 'gallery' | 'zones'; notifications?: 'open'; noticeId?: string } | undefined;
  PublicNotifications: { id?: string } | undefined;
  PublicEventDetail: { id: string };
  Welcome: undefined;
  Login: undefined;
  /** The admin sign-in (website /admin/login): no social, no register. */
  AdminLogin: undefined;
  /**
   * `email`/`name` prefill from a social sign-in with no account yet; `taken`
   * is set when step 2's register call found a duplicate.
   */
  RegistrationStep1: { email?: string; name?: string; taken?: 'email' | 'phoneNumber' } | undefined;
  RegistrationStep2: {
    fullName: string;
    email: string;
    /** Normalised: 10 digits for India, '+<code><number>' abroad. */
    phoneNumber: string;
    whatsappNumber?: string;
    password: string;
    /** Set (non-empty) only for a member abroad — step 2 then asks for a place. */
    countryName?: string;
  };
  
  // Member Stack
  MemberMain: undefined;
  ProfileDetail: { memberId: string };
  EditProfile: undefined;
  EditBusiness: undefined;
  EditFinancial: undefined;
  EditDeclaration: undefined;
  PersonalDetailsForm: { userData: any };
  BusinessInformationForm: { userData: any };
  FinancialComplianceForm: { userData: any };
  DeclarationForm: { userData: any };
  Dashboard: undefined;
  PaidDashboard: undefined;
  PaidProfile: undefined;
  PaidSettings: undefined;
  ApplicationStatus: undefined;
  ApplicationSubmitted: undefined;
  BusinessProfile: undefined;
  ManageCompanies: undefined;
  BusinessDashboard: undefined;
  CompleteMembership: undefined;
  AddCompany: undefined;
  ProductsServices: { companyId?: string };
  AddProduct: { productId?: string; companyId: string };
  Discover: undefined;
  Settings: undefined;
  EditCompany: { companyId: string };
  ViewCompany: { companyId: string };
  BusinessProfileView: { companyId: string };
  PaymentWebView: { orderId: string; amount: number };
  PaymentGateway: {
    /**
     * The plan key the server prices from ('basic' | 'intermediate' | 'ideal' |
     * 'aspirant'). It is what decides the amount; `planAmount` and
     * `totalAmount` below are for display only, and the server ignores both.
     */
    planId: string;
    planType: string;
    planAmount: number;
    totalAmount: number;
    applicationId?: string;
  };
  MockPayment: {
    paymentRequestId?: string;
    amount: number;
    planType: string;
    applicationId?: string;
  };
  PaymentSuccess: {
    orderId?: string;
    transactionId?: string;
    paymentDate?: string;
    planType?: string;
    planAmount?: number;
    totalAmount?: number;
    applicationId?: string;
    memberName?: string;
  };
  PaymentFailed: { orderId: string; reason: string };
  
  // Admin Common Screens
  ApplicantDetail: { applicant: Applicant };
  
  // Block Admin Screens
  BlockDashboard: undefined;
  BlockApprovals: undefined;
  BlockMembers: undefined;
  BlockAnalytics: undefined;
  BlockSettings: undefined;
  
  // District Admin Screens
  DistrictDashboard: undefined;
  DistrictApprovals: undefined;
  DistrictMembers: undefined;
  DistrictAnalytics: undefined;
  DistrictSettings: undefined;
  
  // State Admin Screens
  StateDashboard: undefined;
  StateApprovals: undefined;
  StateMembers: undefined;
  StateAnalytics: undefined;
  StateSettings: undefined;

  // Legacy Admin Routes
  BlockAdminDashboard: undefined;
  BlockAdminApproval: undefined;
  BlockAdminMembers: undefined;
  BlockAdminSettings: undefined;
  DistrictAdminDashboard: undefined;
  DistrictAdminApproval: undefined;
  StateAdminDashboard: undefined;
  StateAdminApproval: undefined;
  SuperAdminDashboard: undefined;

  // Events Admin (QR check-in at the event door)
  EventsAdminHome: undefined;
  EventCheckinScanner: { eventId?: string; eventTitle?: string } | undefined;
  EventAttendance: { eventId: string; eventTitle?: string };
  
  // Admin Common Screens
  UserManagement: undefined;
  Analytics: undefined;
  AdminAnalytics: undefined;
  Reports: undefined;
};

export type MemberBottomTabParamList = {
  Dashboard: undefined;
  BrowseMembers: undefined;
  Notifications: undefined;
  Profile: undefined;
};

// User Roles
export enum UserRole {
  MEMBER = 'member',
  BLOCK_ADMIN = 'block_admin',
  DISTRICT_ADMIN = 'district_admin',
  STATE_ADMIN = 'state_admin',
  SUPER_ADMIN = 'super_admin',
}

// Application Status
//
// ONE PENDING VALUE. The review used to run Block -> District -> State and the
// status named whose turn it was; an application now goes to all three admins
// of the applicant's own region at once and the first of them to decide decides
// it, so there is nothing left for a tier-named status to say.
//
// The three legacy spellings are kept because rows carrying them are still in
// the collection and nothing rewrote them. They all mean PENDING — compare
// through `normalizeApplicationStatus` below, never against a literal.
export enum ApplicationStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',

  /** @deprecated Legacy stored spellings. All of them mean `PENDING`. */
  PENDING_BLOCK = 'Pending-Block',
  /** @deprecated */
  PENDING_DISTRICT = 'Pending-District',
  /** @deprecated */
  PENDING_STATE = 'Pending-State',
}

/**
 * Fold any spelling the server or the database can produce to one of the three
 * canonical values. The mobile counterpart of the backend's `normalizeStatus`.
 */
export const normalizeApplicationStatus = (
  value?: string | null,
): ApplicationStatus.PENDING | ApplicationStatus.APPROVED | ApplicationStatus.REJECTED => {
  const key = String(value || '').trim().toLowerCase().replace(/[\s_\-.]/g, '');
  if (key === 'rejected' || key === 'declined') return ApplicationStatus.REJECTED;
  if (key === 'approved' || key === 'stateapproved' || key === 'complete' || key === 'completed') {
    return ApplicationStatus.APPROVED;
  }
  return ApplicationStatus.PENDING;
};

// Member Types
export enum MemberType {
  ASPIRANT = 'aspirant',
  COMPANY = 'company',
}

// User Interface
export interface User {
  id: string;
  _id?: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

// Member Interface
export interface Member extends User {
  profilePhoto?: string;
  state?: string;
  district?: string;
  block?: string;
  city?: string;
  profileCompletion: number;
  hasApplication: boolean;
  applicationStatus?: ApplicationStatus;
  hasBusinessProfile: boolean;
  memberType?: MemberType;
}

// Location Interfaces
export interface Block {
  name: string;
}

export interface District {
  district: string;
  block: string[];
}

export interface State {
  state: string;
  districts: District[];
}

export interface LocationData {
  states: State[];
}

// Application Interface
export interface Application {
  id: string;
  userId: string;
  memberType: MemberType;
  status: ApplicationStatus;
  personalDetails: any;
  businessDetails?: any;
  financialDetails: any;
  submittedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  timeline: ApplicationTimeline[];
}

// Applicant as returned by the admin dashboard endpoints — a flattened
// application joined with the member profile it belongs to.
//
// Three stages, and THEY ARE THIS TIER'S OWN VERDICT.
//
// The block, district and state admin of a region all hold every one of its
// applications from submission — nothing is upstream of anybody, which is why
// `upstream` and `closed` are gone — but each of them records a SEPARATE
// verdict. `approved` here means the tier that fetched the row approved it. It
// does NOT mean the applicant was admitted: that is `outcome`, written by the
// State Admin alone.
//
// Briefly the three shared one verdict, and a District admin's Hub showed rows
// as Approved because the State had approved them. See `Applicant.outcome`.
export type ApplicantStage = 'pending' | 'approved' | 'rejected';

/** One tier's recorded answer. */
export interface TierVerdict {
  decision: 'pending' | 'approved' | 'rejected';
  adminType?: string;
  decidedAt?: string | null;
  reason?: string;
}

/**
 * Which tier's dashboard a payload was built for.
 *
 * It no longer changes how an application is classified — it labels the rows
 * and picks the region rollup the dashboard shows beneath them.
 */
export type AdminLevel = 'block' | 'district' | 'state';

/** The four buckets every admin dashboard renders. */
export interface ApplicantBuckets {
  pending: Applicant[];
  approved: Applicant[];
  rejected: Applicant[];
  all: Applicant[];
}

export interface Applicant {
  id: string;
  _id?: string;
  applicationId: string;
  memberId: string;
  /** The auth-user id, present on rows loaded straight from an application. */
  userId?: string;
  memberCode: string;
  fullName: string;
  memberName?: string;
  memberType?: string;
  email: string;
  phone: string;
  role: string;
  /** Mirrors businessInfo.doingBusiness; the backend flattens it to the top level too. */
  doingBusiness?: boolean;
  registrationType?: string;
  organizationName?: string;
  gender: string;
  block: string;
  district: string;
  state: string;
  city: string;
  /**
   * The APPLICATION's outcome — `Pending`, `Approved` or `Rejected`.
   *
   * Only the State Admin (or a Super Admin in that seat) writes it, and it is
   * what makes somebody a member. Run it through `normalizeApplicationStatus`
   * before comparing: live rows carry several spellings.
   */
  status: string;
  /** THIS TIER'S OWN VERDICT. Not the outcome — see the type's note. */
  stage: ApplicantStage;
  level?: AdminLevel;
  statusLabel: string;
  approvedByText?: string;
  /** The outcome again, named so it cannot be read as this tier's verdict. */
  outcome?: string;
  /** Has THIS tier's verdict still to be given? The only thing that draws buttons. */
  canAct?: boolean;
  /** Would this tier's approval enrol the applicant, or only be recorded? */
  decidesOutcome?: boolean;
  /** All three verdicts, keyed by tier. */
  tierReviews?: Record<string, TierVerdict>;
  /** The decided ones among the other two tiers, widest first. */
  otherTierReviews?: { tier: string; label: string; decision: string; decidedAt?: string | null }[];
  /** Those as one line: "State approved". Empty when nobody else has decided. */
  endorsementLine?: string;
  /**
   * Orphan fallback. True when the tier that formally owns this application has
   * no active admin, so it has escalated to the tier reading it now. The stored
   * status is unchanged — ownership is derived from live staffing, so the file
   * returns to its own tier the moment one is staffed again.
   */
  orphaned?: boolean;
  /** The tier the status names. */
  owningTier?: string;
  /** The tier that can actually act, once staffing is taken into account. */
  effectiveTier?: string;
  /** One line explaining the escalation, empty when there is none. */
  fallbackReason?: string;
  submittedAt: string | null;
  blockApprovedAt: string | null;
  districtApprovedAt?: string | null;
  stateApprovedAt?: string | null;
  rejectionReason: string;
  rejectedBy?: {
    adminType: string;
    rejectedAt: string | null;
  } | null;
  personalDetails: {
    fullName: string;
    block: string;
    city: string;
    district: string;
    phone: string;
    email: string;
    dateOfBirth: string;
    aadhaarNumber: string;
    streetName: string;
    education: string;
    religion: string;
    socialCategory: string;
  };
  businessInfo: {
    doingBusiness: boolean;
    organizationName: string;
    constitutionType: string;
    businessTypes: string[];
    businessActivities: string;
    businessCommencementYear: string | number;
    numberOfEmployees: string | number;
    memberOfOtherChamber?: boolean;
    otherChamber: string;
    govtOrganizations: string[];
  };
  financialInfo: {
    panNumber: string;
    gstNumber: string;
    udyamNumber: string;
    itrFiled: boolean | string;
    turnoverRange: string;
    govtSchemeBenefit?: boolean;
  };
  declaration: {
    sisterConcerns: number | string;
    companyNames: string[];
    agreeToDeclaration?: boolean;
  };
}

export interface ApplicationTimeline {
  stage: string;
  status: string;
  adminName?: string;
  comments?: string;
  timestamp: string;
}

// Business Profile Interface
export interface BusinessProfile {
  id: string;
  memberId: string;
  companyName: string;
  businessType: string;
  gstNumber?: string;
  registrationNumber: string;
  website?: string;
  description?: string;
  logo?: string;
  coverImage?: string;
  email: string;
  phone: string;
  address: string;
  createdAt: string;
  updatedAt: string;
}

// Company Interface
export interface Company {
  id: string;
  memberId: string;
  name: string;
  logo?: string;
  isActive: boolean;
  createdAt: string;
}

// Product Interface
export interface Product {
  id: string;
  companyId: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  images: string[];
  createdAt: string;
  updatedAt: string;
}

// Notification Interface
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  isRead: boolean;
  createdAt: string;
}

// Membership Plan Interface
export interface MembershipPlan {
  id: string;
  name: string;
  type: MemberType;
  price: number;
  duration: number; // in days
  features: string[];
  isPopular: boolean;
}

// Admin Stats Interface
export interface AdminStats {
  totalApplications: number;
  pendingApplications: number;
  approvedApplications: number;
  rejectedApplications: number;
  totalMembers: number;
}
