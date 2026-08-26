import { getMyProfile, getBusinessInfo } from '@/services/activApi';
import { getUserApplication } from '@/services/applicationApi';

/**
 * The membership plans, and which of them a given member is offered.
 *
 * Transcribed from the mobile `CompleteMembershipScreen`, which is the source of
 * truth for both. Three company plans and one aspirant plan, at the same four
 * prices; the website previously offered only the three company plans, so an
 * applicant who had declared **no** business was shown a ₹5,000-and-up company
 * plan and no way to buy the ₹2,000 one that applies to them.
 *
 * Prices are the same integers mobile sends, so a payment recorded from either
 * client describes the same purchase.
 */

export interface MembershipPlan {
    /** Stable key, sent as `membershipType` when a plan implies one. */
    id: string;
    /** What mobile calls `title` — shown on the card and stored as the plan. */
    name: string;
    description: string;
    price: number;
    /** Mobile's `experience` line. */
    experience: string;
    features: string[];
    popular?: boolean;
}

export const COMPANY_PLANS: MembershipPlan[] = [
    {
        id: 'basic',
        name: 'Starter',
        description: 'For companies less than 5 years',
        price: 5000,
        experience: '< 5 years',
        features: [
            'Compliance and documentation guidance',
            'Access to networking forums',
            'Standard email support',
        ],
    },
    {
        id: 'intermediate',
        name: 'Professional',
        description: 'For companies 5 – 10 years',
        price: 10000,
        experience: '5 - 10 years',
        popular: true,
        features: [
            'All Starter benefits',
            'Priority event invitations',
            'Growth and scaling advisory sessions',
        ],
    },
    {
        id: 'ideal',
        name: 'Enterprise',
        description: 'For companies 10+ years',
        price: 20000,
        experience: '10+ years',
        features: [
            'All Professional benefits',
            'Premium advisory and consulting',
            'Featured listing and special recognition',
        ],
    },
];

/** Mobile's `aspirantPlan`, at the same ₹2,000. */
export const ASPIRANT_PLAN: MembershipPlan = {
    id: 'aspirant',
    name: 'Aspirant',
    description: 'For students without company experience',
    price: 2000,
    experience: 'Student / Aspirant',
    features: [
        'Access to learning resources and webinars',
        'Student-only events and competitions',
        'Mentorship and career guidance',
        'Networking with professionals',
    ],
};

export interface PlanEligibility {
    /** The plans this member may choose between. */
    plans: MembershipPlan[];
    /** Pre-selection, and the only choice when `locked`. */
    selected: MembershipPlan;
    /** True for an aspirant: the plan follows from what they declared. */
    locked: boolean;
    isCompany: boolean;
    experience: string;
    applicationId: string;
}

/** Years in business → the plan tier that describes them. Mobile's thresholds. */
const experienceFromYear = (commencementYear: unknown): string | null => {
    const start = parseInt(String(commencementYear ?? ''), 10);
    if (Number.isNaN(start)) return null;
    const years = new Date().getFullYear() - start;
    if (years < 5) return '< 5 years';
    if (years <= 10) return '5 - 10 years';
    return '10+ years';
};

/**
 * Which plans to offer, resolved the way mobile resolves it.
 *
 * Application first, then the profile — in that order, each able to overturn the
 * previous, exactly as `CompleteMembershipScreen` does. Neither source is
 * required: an applicant with no record yet falls through to the company plans,
 * which is mobile's default too.
 */
export const resolvePlanEligibility = async (): Promise<PlanEligibility> => {
    let isAspirant = false;
    let experience = '5 - 10 years';
    let applicationId = '';

    const [app, profile, business] = await Promise.all([
        getUserApplication().catch(() => null),
        getMyProfile().catch(() => null),
        getBusinessInfo().catch(() => null),
    ]);

    if (app) {
        const a = app as any;
        applicationId = a.applicationId || a._id || a.id || '';
        const biz = a.businessInfo || a.personalDetails || a.data || {};
        const regType = a.registrationType || a.data?.registrationType;
        const memType = a.memberType || a.data?.memberType;

        if (biz.doingBusiness === false || regType === 'aspirant' || memType === 'aspirant') {
            isAspirant = true;
        } else if (biz.doingBusiness === true || regType === 'business') {
            isAspirant = false;
            experience = experienceFromYear(biz.businessCommencementYear) || experience;
        }
    }

    // The profile is consulted second and wins, matching mobile. It is the more
    // current record: a member can change what they declared after applying.
    const p = (profile || {}) as any;
    const b = (business || {}) as any;
    const doingBusiness = b.doingBusiness ?? p.doingBusiness;

    if (doingBusiness === false || p.registrationType === 'aspirant' || p.memberType === 'aspirant') {
        isAspirant = true;
    } else if (doingBusiness === true || p.registrationType === 'business') {
        isAspirant = false;
        experience = experienceFromYear(b.businessCommencementYear) || experience;
    }

    if (isAspirant) {
        return {
            plans: [ASPIRANT_PLAN],
            selected: ASPIRANT_PLAN,
            locked: true,
            isCompany: false,
            experience: ASPIRANT_PLAN.experience,
            applicationId,
        };
    }

    const selected =
        COMPANY_PLANS.find(plan => plan.experience === experience) || COMPANY_PLANS[1];

    return {
        plans: COMPANY_PLANS,
        selected,
        locked: false,
        isCompany: true,
        experience,
        applicationId,
    };
};
