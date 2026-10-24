/**
 * ============================================================================
 * THE WEBSITE'S MEMBER RULES — ported verbatim, not re-invented
 * ============================================================================
 *
 * Sources (website/src): services/activApi.ts (normaliseStatus,
 * pickMostAdvancedApplication, deriveApprovalFlags, tierVerdict,
 * tierDecidedByLabel, tierDecidedAt, timelineStageStatus),
 * features/member/memberAccess.ts (resolveApplicantKind, applicantKindLabel,
 * resolvePlan, planLabel, deriveMemberAccess, nextMilestone, membershipCta),
 * contexts/ProfileContext.tsx (profile completion).
 *
 * Kept identical so the app and the website can never show the same member a
 * different stage, a different next step or a different completion figure.
 */

import { personalDetailsErrors } from '../../profile/personalDetailsValidation';

export type Tier = 'block' | 'district' | 'state';
export type StageState = 'pending' | 'in_progress' | 'approved' | 'rejected';

export const normaliseStatus = (value: any): 'Pending' | 'Approved' | 'Rejected' => {
  const key = String(value || '').trim().toLowerCase().replace(/[\s_\-.]/g, '');
  if (key === 'rejected' || key === 'declined') return 'Rejected';
  if (key === 'approved' || key === 'stateapproved' || key === 'complete' || key === 'completed') return 'Approved';
  return 'Pending';
};

/** Approved first, then Rejected, else the newest. */
export const pickMostAdvancedApplication = (list: any[]): any | null => {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list.find((a) => normaliseStatus(a?.status) === 'Approved')
    || list.find((a) => normaliseStatus(a?.status) === 'Rejected')
    || list[0];
};

export const tierVerdict = (app: any, tier: Tier): 'pending' | 'approved' | 'rejected' => {
  const served = app?.tierReviews?.[tier]?.decision;
  if (served === 'approved' || served === 'rejected') return served;
  if (served === 'pending') return 'pending';
  if (tier === 'block' && app?.blockApprovedAt) return 'approved';
  if (tier === 'district' && app?.districtApprovedAt) return 'approved';
  const rejected = normaliseStatus(app?.status) === 'Rejected';
  const signer = String((rejected ? app?.rejectedBy?.adminType : app?.approvedBy?.adminType) || '');
  const SEAT: Record<string, string> = { BlockAdmin: 'block', DistrictAdmin: 'district', StateAdmin: 'state', SuperAdmin: 'state' };
  const seat = SEAT[signer] || (normaliseStatus(app?.status) === 'Approved' && !app?.approvedBy ? 'state' : '');
  if (seat && seat === tier) return rejected ? 'rejected' : 'approved';
  return 'pending';
};

export const deriveApprovalFlags = (app: any) => {
  const status = normaliseStatus(app?.status);
  const isApproved = status === 'Approved';
  const isRejected = status === 'Rejected';
  return {
    isApproved,
    isRejected,
    isUnderReview: !!app && !isApproved && !isRejected,
    isBlockApproved: tierVerdict(app, 'block') === 'approved',
    isDistrictApproved: tierVerdict(app, 'district') === 'approved',
    isStateApproved: tierVerdict(app, 'state') === 'approved',
  };
};

const ADMIN_LABELS: Record<string, string> = {
  BlockAdmin: 'Block Admin', DistrictAdmin: 'District Admin', StateAdmin: 'State Admin', SuperAdmin: 'ACTIV Head Office',
};

export const tierDecidedByLabel = (app: any, tier: Tier): string => {
  const served = app?.tierReviews?.[tier];
  if (served?.adminType) return ADMIN_LABELS[String(served.adminType)] || '';
  if (tierVerdict(app, tier) === 'pending') return '';
  return ADMIN_LABELS[`${tier.charAt(0).toUpperCase()}${tier.slice(1)}Admin`] || '';
};

export const tierDecidedAt = (app: any, tier: Tier): string | null => {
  const served = app?.tierReviews?.[tier]?.decidedAt;
  if (served) return served;
  if (tier === 'block') return app?.blockApprovedAt || null;
  if (tier === 'district') return app?.districtApprovedAt || null;
  return app?.approvedBy?.approvedAt || app?.rejectedBy?.rejectedAt || app?.stateApprovedAt || null;
};

export const timelineStageStatus = (stage: 'review' | Tier, app: any): StageState => {
  if (!app) return 'pending';
  if (stage === 'review') {
    const f = deriveApprovalFlags(app);
    if (f.isRejected) return 'rejected';
    if (f.isApproved) return 'approved';
    return 'in_progress';
  }
  const v = tierVerdict(app, stage);
  if (v === 'approved') return 'approved';
  if (v === 'rejected') return 'rejected';
  return 'in_progress';
};

export const TIERS: { key: Tier; label: string; grants: boolean }[] = [
  { key: 'block', label: 'Block Admin', grants: false },
  { key: 'district', label: 'District Admin', grants: false },
  { key: 'state', label: 'State Admin', grants: true },
];
/** Members outside India are reviewed by the head office alone. */
export const ABROAD_TIERS: typeof TIERS = [{ key: 'state', label: 'ACTIV Head Office', grants: true }];

/* ------------------------------------------------------------------ applicant kind, plan */

export type ApplicantKind = 'business' | 'aspirant' | 'student' | '';
const DECLARED = (v: any): ApplicantKind => {
  const k = String(v || '').trim().toLowerCase();
  return k === 'business' || k === 'aspirant' || k === 'student' ? k : '';
};

export const resolveApplicantKind = (application: any): ApplicantKind => {
  if (!application) return '';
  const data = application.data || {};
  const business = data.business || data.businessInfo || {};
  const declared = DECLARED(application.memberType) || DECLARED(application.registrationType)
    || DECLARED(data.memberType) || DECLARED(data.registrationType);
  if (declared) return declared;
  const doingBusiness = business.doingBusiness === true || data.doingBusiness === true
    || !!business.organizationName || !!data.organizationName;
  const isAspirant = (business.doingBusiness === false || data.doingBusiness === false) && !doingBusiness;
  return isAspirant ? 'aspirant' : (doingBusiness ? 'business' : '');
};

export const applicantKindLabel = (application: any): string => {
  const k = resolveApplicantKind(application);
  return k === 'aspirant' ? 'Aspirant' : k === 'student' ? 'Student' : k === 'business' ? 'Business' : '';
};

export const planLabelFor = (declared: ApplicantKind, hasBusinessRecord: boolean): string => {
  const plan = declared || (hasBusinessRecord ? 'business' : '');
  if (plan === 'business') return 'Business Membership';
  if (plan === 'aspirant') return 'Aspirant Membership';
  if (plan === 'student') return 'Student Membership';
  return '';
};

/* ------------------------------------------------------------------ completion & access */

export const TOTAL_FORMS = 3;

/** ProfileContext.loadProfileCompletion — same three forms, same 100% rule. */
export const profileCompletion = (profile: any, business: any, declaration: any, application: any) => {
  const completed: string[] = [];
  const personalComplete = profile?.personalDetailsComplete === true
    || (profile?.personalDetailsComplete === undefined && Object.keys(personalDetailsErrors(profile)).length === 0);
  if (personalComplete) completed.push('Personal Details');
  if (business && business.doingBusiness !== null && business.doingBusiness !== undefined) completed.push('Business Details');
  const SUBMITTED = ['submitted', 'verified', 'approved', 'completed'];
  if (declaration?.agreeToDeclaration || SUBMITTED.includes(String(declaration?.status || '').toLowerCase())) completed.push('Declaration');
  const hasSubmitted = !!(application && (application._id || application.id || application.status));
  const isPaid = ['active', 'completed'].includes(String(profile?.membershipStatus || '').toLowerCase());
  const percent = hasSubmitted || isPaid ? 100 : Math.min(100, Math.round((completed.length / TOTAL_FORMS) * 100));
  return { percent, completed };
};

export interface MemberAccess {
  profileComplete: boolean;
  applicationSubmitted: boolean;
  applicationApproved: boolean;
  membershipActive: boolean;
}

export const deriveMemberAccess = (completion: number, application: any, isPaid: boolean): MemberAccess => ({
  profileComplete: Number(completion || 0) >= 100,
  applicationSubmitted: !!application,
  applicationApproved: normaliseStatus(application?.status) === 'Approved',
  membershipActive: isPaid === true,
});

export const nextMilestone = (access: MemberAccess): string => {
  if (!access.profileComplete) return 'Complete your profile';
  if (!access.applicationSubmitted) return 'Submit your application';
  if (!access.applicationApproved) return 'Awaiting admin approval';
  if (!access.membershipActive) return 'Activate your membership';
  return '';
};

/** The website's membershipCta, with mobile routes instead of web paths. */
export type CtaTarget = 'PaidDashboard' | 'Renew' | 'Activate' | 'ApplicationStatus' | 'Submit' | 'Profile';
export const membershipCta = (access: MemberAccess, renewal?: { state?: string; canRenew?: boolean } | null) => {
  if (access.membershipActive) return { label: 'Your membership', target: 'PaidDashboard' as CtaTarget, detail: '' };
  if (renewal?.state === 'expired' && renewal?.canRenew) {
    return { label: 'Renew membership', target: 'Renew' as CtaTarget, detail: 'Your membership has ended. One payment renews it for another year.' };
  }
  if (access.applicationApproved) {
    return { label: 'Activate membership', target: 'Activate' as CtaTarget, detail: 'Your application is approved. One payment activates everything.' };
  }
  if (access.applicationSubmitted) {
    return { label: 'Track your application', target: 'ApplicationStatus' as CtaTarget, detail: 'Your application is with the review team. Activation opens once it is approved.' };
  }
  if (access.profileComplete) {
    return { label: 'Submit your application', target: 'Submit' as CtaTarget, detail: 'Your profile is complete. Submitting it starts the review.' };
  }
  return { label: 'Complete your profile', target: 'Profile' as CtaTarget, detail: 'Finish your profile to start the membership review.' };
};
