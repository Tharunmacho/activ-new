import { apiFetch, getMyProfile, pickMostAdvancedApplication } from "@/services/activApi";
import { resolveApplicantKind } from "@/features/member/memberAccess";
// Member Application API Service
// Empty: every call below goes through apiFetch, which prefixes the real
// API base itself. Kept as a constant so the call sites need no edit.
const API_BASE_URL = '';

/**
 * One membership application, as this backend returns it.
 *
 * Aligned with `backend/src/modules/applications/application.model.js`. The
 * shape it replaces described the retired API: `memberName`/`memberEmail`, an
 * `approvals.{block,district,state}` object, and a `paymentStatus` field. None
 * of those exist here — approval is recorded as a timestamp per tier, and
 * payment lives on the MEMBER (`users.membershipStatus`), not the application.
 */
interface Application {
  _id: string;
  userId: string;

  fullName: string;
  email: string;
  phone: string;

  state: string;
  district: string;
  block: string;

  /** Canonical: Pending-Block | Pending-District | Pending-State | Approved | Rejected. */
  status: string;

  /** A tier has signed off exactly when its timestamp is set. */
  blockApprovedAt?: string | null;
  districtApprovedAt?: string | null;
  stateApprovedAt?: string | null;

  rejectionReason?: string;
  rejectedBy?: {
    adminType?: 'BlockAdmin' | 'DistrictAdmin' | 'StateAdmin';
    rejectedAt?: string | null;
  };

  /** The four form sections, exactly as the admin screens read them. */
  data?: {
    personalDetails?: Record<string, any>;
    businessInfo?: Record<string, any>;
    financialInfo?: Record<string, any>;
    declaration?: Record<string, any>;
  };

  notes?: Array<{ adminId?: string; adminType?: string; note?: string; createdAt?: string }>;

  createdAt: string;
  updatedAt: string;

  // ---- derived, not stored -------------------------------------------------
  // None of these exist in the Mongoose schema, so the server never returns
  // them; `decorate()` below computes each from what IS stored. They are
  // declared optional because a raw application read elsewhere will not have
  // them.

  /** Alias of `_id`. The old API issued its own id; this one uses the document's. */
  applicationId?: string;
  /** From the declared business info — the schema drops a top-level copy. */
  memberType?: string;
  businessExperience?: string;
  /** Rebuilt from the per-tier approval timestamps for the timeline UI. */
  approvals?: {
    block: { status: string; actionDate?: string | null; remarks?: string; adminName?: string };
    district: { status: string; actionDate?: string | null; remarks?: string; adminName?: string };
    state: { status: string; actionDate?: string | null; remarks?: string; adminName?: string };
  };
  /**
   * Payment lives on the MEMBER, not on the application — `users` carries
   * `membershipStatus`, `membershipType`, `paymentId` and `lastPaymentDate`.
   * These are filled from the member profile so the payment screens have one
   * object to read, rather than inventing fields the application never had.
   */
  paymentStatus?: string;
  paymentDate?: string | null;
  paymentAmount?: number;
  paymentDetails?: {
    paymentId?: string;
    planType?: string;
    totalAmount?: number;
    transactionId?: string;
    status?: string;
    completedAt?: string | null;
    /**
     * Gateway-specific details. This backend does not persist them — the
     * Instamojo response is used to activate the membership and then dropped —
     * so these are always undefined and the UI must handle their absence.
     */
    planAmount?: number;
    supportAmount?: number;
    instamojoPaymentId?: string;
  };
  submittedAt?: string;
}

/**
 * Fill in the fields the pages expect but the schema does not store.
 *
 * Every value is computed from real data — an approval stage is "approved"
 * exactly when its timestamp exists — so nothing here invents an outcome.
 */
const decorate = (app: any, member?: any): Application => {
  if (!app) return app;

  const data = app.data || {};
  const business = data.businessInfo || data.business || {};
  const rejectedBy = app.rejectedBy?.adminType || '';

  const stageStatus = (approvedAt: any, rejector: string) => {
    if (approvedAt) return 'approved';
    if (app.status === 'Rejected' && rejectedBy === rejector) return 'rejected';
    return 'pending';
  };

  /*
   * One rule for what kind of applicant this is, shared with the dashboard.
   *
   * This used to read `data.businessInfo.doingBusiness` and
   * `data.businessInfo.registrationType` and nothing else. On every application
   * in the live database those flags sit at the ROOT of `data` - there is no
   * `data.businessInfo` - so `business` was `{}`, `isAspirant` was `false`, and
   * the line below then *overwrote* `memberType` with "business" for applicants
   * who had plainly declared themselves aspirants.
   *
   * That overwrite is why one screen disagreed with another: the dashboard
   * reads the raw application through `getMyApplication()` and said "Aspirant",
   * while anything reading this decorated copy said "Business Applicant" about
   * the very same document. `resolveApplicantKind` looks in all four places the
   * declaration can have survived and falls back to the server's own
   * derivation, so both now answer from one rule.
   */
  const applicantKind = resolveApplicantKind(app);

  return {
    ...app,
    applicationId: app._id || app.id || '',
    submittedAt: app.submittedAt || app.createdAt,
    memberType: applicantKind || app.memberType || 'business',
    businessExperience: business.businessCommencementYear || '',
    approvals: {
      block: { status: stageStatus(app.blockApprovedAt, 'BlockAdmin'), actionDate: app.blockApprovedAt || null, remarks: app.rejectionReason || '' },
      district: { status: stageStatus(app.districtApprovedAt, 'DistrictAdmin'), actionDate: app.districtApprovedAt || null, remarks: app.rejectionReason || '' },
      state: { status: stageStatus(app.stateApprovedAt, 'StateAdmin'), actionDate: app.stateApprovedAt || null, remarks: app.rejectionReason || '' },
    },

    // Approval and payment are separate states: a fully approved application
    // still leaves membershipStatus at 'pending' until the member pays. This
    // list said so and then counted 'approved' as paid anyway, which is what
    // marked approved-but-unpaid members as having settled their membership.
    paymentStatus:
      member && ['active', 'completed'].includes(String(member.membershipStatus || '').toLowerCase())
        ? 'completed'
        : 'pending',
    paymentDate: member?.lastPaymentDate || member?.membershipActivatedAt || null,
    paymentDetails: member
      ? {
          paymentId: member.paymentId || '',
          planType: member.membershipType || '',
          transactionId: member.paymentId || '',
          status: member.membershipStatus || '',
          completedAt: member.membershipActivatedAt || null,
        }
      : undefined,
  } as Application;
};

// Get user's application status
export const getUserApplication = async (): Promise<Application | null> => {
  const token = localStorage.getItem('token');
  
  
  if (!token) {
    return null;
  }

  try {
    // Try to fetch from backend first
    try {
      const response = await apiFetch(`${API_BASE_URL}/applications/my-applications`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      
      if (response.status === 401) {
        // Clear invalid token
        localStorage.removeItem('token');
        return null;
      }
      
      if (response.status === 404) {
        return null;
      }
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // `/applications/my-applications` answers with an array, newest
          // first. Returning it whole made every `application.x` read undefined.
          const list = Array.isArray(data.data) ? data.data : [data.data];
          if (list.length === 0) return null;

          // The member profile carries the payment state; a failure to read it
          // must not lose the application, so it degrades to "unpaid".
          const member = await getMyProfile().catch(() => null);

          // The most ADVANCED application, not the newest. A member can hold
          // more than one row, and date order can put a stale Pending-Block
          // record ahead of one already at the State tier — telling someone
          // nobody had looked at their application when it was nearly done.
          return decorate(pickMostAdvancedApplication(list), member);
        }
      }
    } catch {
      // Fall through to the explanation below: a member with no application,
      // and a request that never arrived, both mean "nothing to show" — and
      // neither is an error worth putting in the console on a page that
      // renders perfectly well without one.
    }

    /**
     * No localStorage fallback.
     *
     * What stood here rebuilt an "application" from whatever the browser had
     * cached, and filled the gaps with invented values — state "Tamil Nadu",
     * district "Tiruvannamalai", block "Thandrampet", a synthetic id. On screen
     * that is indistinguishable from a real application, so a member whose
     * submission had failed was shown one that did not exist, in a region they
     * had never chosen.
     *
     * The server is the only source of truth for whether an application exists.
     */
    return null;
  } catch (error) {
    console.error('Error fetching user application:', error);
    return null;
  }
};

// Check if user has completed their profile
export const checkProfileCompletion = async (): Promise<{
  isComplete: boolean;
  completedForms: string[];
  totalFormsRequired: number;
  memberType: 'business' | 'aspirant';
}> => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    return {
      isComplete: false,
      completedForms: [],
      totalFormsRequired: 4,
      memberType: 'business'
    };
  }

  try {
    const completed: string[] = [];
    let isDoingBusiness = true;
    let totalForms = 4;

    // Check Personal Form
    const personalRes = await apiFetch(`${API_BASE_URL}/members/my-profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (personalRes.ok) {
      const data = await personalRes.json();
      if (data.data && data.data.isLocked) {
        completed.push('Personal Details');
      }
    }

    // Check Business Form
    const businessRes = await apiFetch(`${API_BASE_URL}/members/business-info`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (businessRes.ok) {
      const data = await businessRes.json();
      if (data.data) {
        if (data.data.doingBusiness === 'no') {
          isDoingBusiness = false;
          totalForms = 3;
        }
        if (data.data.doingBusiness) {
          completed.push('Business Information');
        }
      }
    }

    // Check Financial Form (only if doing business)
    if (isDoingBusiness) {
      const financialRes = await apiFetch(`${API_BASE_URL}/members/financial-info`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (financialRes.ok) {
        const data = await financialRes.json();
        if (data.data && data.data.pan) {
          completed.push('Financial Details');
        }
      }
    }

    // Check Declaration Form
    const declarationRes = await apiFetch(`${API_BASE_URL}/members/declaration-info`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (declarationRes.ok) {
      const data = await declarationRes.json();
      if (data.data && data.data.declarationAccepted) {
        completed.push('Declaration');
      }
    }

    return {
      isComplete: completed.length === totalForms,
      completedForms: completed,
      totalFormsRequired: totalForms,
      memberType: isDoingBusiness ? 'business' : 'aspirant'
    };
  } catch (error) {
    console.error('Error checking profile completion:', error);
    return {
      isComplete: false,
      completedForms: [],
      totalFormsRequired: 4,
      memberType: 'business'
    };
  }
};

// Get user's business form data (contains company name)
export const getBusinessForm = async (): Promise<any | null> => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    return null;
  }

  try {
    const response = await apiFetch(`${API_BASE_URL}/members/business-info`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const result = await response.json();
      return result.data;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching business form:', error);
    return null;
  }
};
