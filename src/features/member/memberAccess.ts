export { formatApplicationRef } from '@/lib/applicationRef';

/**
 * The dashboard this member actually has.
 *
 * Three places need it — the sidebar entry, the Application Status back button
 * and its "Back to Dashboard" footer — and they were three separate literals.
 There is no single "member dashboard" route: a paid member and an unpaid one
 * are two different screens, and `/member/dashboard` — the router that used to
 * choose between them — no longer exists. Every caller therefore has to name the
 * right one, and getting it wrong in one of the three places is the whole reason
 * this is a function rather than three literals.
 */
export const dashboardPathFor = (membershipActive: boolean): string =>
    membershipActive ? '/payment/member-dashboard' : '/member/unpaid-dashboard';

/**
 * What a member has earned the right to see, and the one table that decides it.
 *
 * The member area unlocks progressively: someone who has just registered gets a
 * short sidebar, and each entry appears as the thing it depends on becomes real.
 * That rule was previously spread across the sidebar, the two dashboards and a
 * `requirePayment` boolean, which is how the same account could see Business
 * Account in one place and not the other.
 *
 * Everything here is derived from live state. Nothing reads a stored flag about
 * what the member "should" see, because such a flag goes stale the moment they
 * submit a form and nothing rewrites it.
 */

/**
 * The four facts every gate is written against.
 *
 * Deliberately four booleans and not a single "level" enum: the stages are not
 * strictly ordered in practice. A member can complete their profile without
 * having submitted, and an application can be approved while payment is still
 * outstanding, so collapsing them loses the distinction the gates need.
 */
export interface MemberAccess {
    /** Every required form is filled in. */
    profileComplete: boolean;
    /** An application exists and is somewhere in the review chain. */
    applicationSubmitted: boolean;
    /** All three tiers have signed off. Payment is the only thing left. */
    applicationApproved: boolean;
    /** Payment recorded — a full member. */
    membershipActive: boolean;
}

export const NO_ACCESS: MemberAccess = {
    profileComplete: false,
    applicationSubmitted: false,
    applicationApproved: false,
    membershipActive: false,
};

/**
 * Build the access facts from the pieces each screen already has.
 *
 * `application` is whatever `getMyApplication()` returned — `null` before one
 * exists. `isPaid` is `useMembershipGate`'s answer, and `null` (not yet known)
 * is treated as unpaid *for unlocking only*: showing a locked sidebar for a
 * moment is recoverable, showing a paid member's entries to an unpaid one is
 * not.
 */
export const deriveMemberAccess = (
    profileCompletion: number,
    application: any | null,
    isPaid: boolean | null,
): MemberAccess => {
    const status = String(application?.status || '');

    return {
        profileComplete: Number(profileCompletion || 0) >= 100,
        applicationSubmitted: !!application,
        applicationApproved: status === 'Approved',
        membershipActive: isPaid === true,
    };
};

/**
 * What a destination may depend on.
 *
 * `membershipActive` is here because two entries point somewhere different
 * depending on it: an unpaid member's dashboard is a different screen from a
 * paid member's, and the entry has to resolve to whichever one they will
 * actually be looking at.
 */
export interface NavContext {
    hasBusinessAccount: boolean;
    membershipActive: boolean;
}

/** Which fact a nav entry waits on. `null` means it is always available. */
export type UnlockKey = keyof MemberAccess | null;

export interface MemberNavItem {
    key: string;
    label: string;
    /**
     * Where the entry goes once unlocked.
     *
     * `null` marks a feature that is designed and gated but has no screen yet.
     * Such an entry never becomes a link — it stays in the "Upcoming Features"
     * list below the rail — so the sidebar cannot grow a link to a blank page
     * behind the exact milestone a member had just worked to reach.
     */
    to: string | ((ctx: NavContext) => string) | null;
    icon: string;
    unlock: UnlockKey;
    /** Shown beside the entry in Upcoming Features, so the member knows the cost. */
    requirement: string;
}

/**
 * The member sidebar, in the finished design's order.
 *
 * The starting set is Dashboard, My Profile and Business Account — the three
 * screens a brand-new account can actually use. Help & Support is listed too,
 * but as an upcoming feature rather than a link: see the note on that entry.
 *
 * Ordering is the *finished* sidebar's ordering, so entries appear in place as
 * they unlock rather than being appended to the end and reshuffling what the
 * member had already learned to aim at.
 */
export const MEMBER_NAV: MemberNavItem[] = [
    /*
     * Straight to the screen this member actually has.
     *
     * There is no router route in front of these two any more, so the entry has
     * to resolve to the real one. It also has to carry a hash, which a redirect
     * would have dropped — `#application-status` would arrive nowhere.
     */
    {
        key: 'dashboard',
        label: 'Dashboard',
        to: ({ membershipActive }) => dashboardPathFor(membershipActive),
        icon: 'home',
        unlock: null,
        requirement: '',
    },
    { key: 'profile', label: 'My Profile', to: '/member/profile-view', icon: 'user', unlock: null, requirement: '' },
    {
        key: 'business',
        label: 'Business Account',
        to: ({ hasBusinessAccount }) => (hasBusinessAccount ? '/business/dashboard' : '/business/create-profile'),
        icon: 'briefcase',
        unlock: null,
        requirement: '',
    },

    /*
     * Application Status points at the dashboard, not at its own screen.
     *
     * The tracker lives on the unpaid dashboard, so sending this entry to a
     * separate page would show the member the same information twice and make
     * the rail disagree with the card they were just looking at. The hash
     * scrolls them to it, and `View Full Timeline` on the card itself is the one
     * route into `/member/application-status`.
     *
     * A paid member has no such card — their dashboard is a different screen —
     * so for them the entry resolves to the dedicated page instead.
     */
    {
        key: 'application',
        label: 'Application Status',
        to: ({ membershipActive }) => (
            membershipActive
                ? '/member/application-status'
                : '/member/unpaid-dashboard#application-status'
        ),
        icon: 'clipboard',
        unlock: 'applicationSubmitted',
        requirement: 'Submit your application',
    },
    {
        key: 'documents',
        label: 'Documents',
        to: null,
        icon: 'file',
        unlock: 'applicationSubmitted',
        requirement: 'Coming soon',
    },
    /*
     * The directory, not the old Explore page.
     *
     * `/explore` loaded every member the API would return and filtered the list
     * in the browser, so its "search" reached only the first fifty rows and it
     * had no way to ask for a district or a sector at all. `/member/directory`
     * asks the server, which is the only place those filters can be applied
     * against the whole membership. The old path still resolves to the new
     * screen so that a bookmark does not 404.
     */
    {
        key: 'explore',
        label: 'Member Directory',
        to: '/member/directory',
        icon: 'search',
        unlock: 'applicationSubmitted',
        requirement: 'Submit your application',
    },
    {
        key: 'messages',
        label: 'Messages',
        to: null,
        icon: 'message',
        unlock: 'membershipActive',
        requirement: 'Coming soon',
    },
    /*
     * The member events screen, not the public marketing page.
     *
     * `/events` is part of the public site: it carries the visitor header and a
     * "Register" call to action for an account this member already has, and it
     * cannot show a members-only event or a seat they hold — both of which are
     * the point of the paid programme.
     */
    {
        key: 'events',
        label: 'Events',
        to: '/member/events',
        icon: 'calendar',
        unlock: 'membershipActive',
        requirement: 'Activate your membership',
    },
    {
        key: 'updates',
        label: 'Association Updates',
        to: '/member/updates',
        icon: 'megaphone',
        unlock: 'membershipActive',
        requirement: 'Activate your membership',
    },

    /*
     * Not a link to the public Contact page.
     *
     * `/contact` is part of the marketing site: it carries the public header,
     * the onboarding navigation and a "Register" call to action. Sending a
     * signed-in member there drops them out of the member area and invites them
     * to sign up for an account they already have. Until there is a support
     * screen inside the member area, this is an upcoming feature — and the
     * dashboard's Need Help card carries the real phone number and address in
     * the meantime.
     */
    { key: 'help', label: 'Help & Support', to: null, icon: 'help', unlock: null, requirement: 'Coming soon' },

    {
        key: 'settings',
        label: 'Settings',
        to: '/member/settings',
        icon: 'settings',
        unlock: 'membershipActive',
        requirement: 'Activate your membership',
    },
];

/** Has this member earned the entry? Says nothing about whether a screen exists. */
export const isUnlocked = (item: MemberNavItem, access: MemberAccess): boolean =>
    item.unlock === null ? true : !!access[item.unlock];

/** Unlocked *and* reachable — the entries that render as links, in table order. */
export const unlockedNav = (access: MemberAccess): MemberNavItem[] =>
    MEMBER_NAV.filter(item => isUnlocked(item, access) && item.to !== null);

/**
 * What is still ahead, as readable text rather than dead links.
 *
 * Two kinds of entry land here: those the member has not earned yet, and those
 * whose screen does not exist yet. Both are things they cannot open, and both
 * are worth seeing — the same argument as the read-only benefits panel on the
 * dashboard. A greyed-out row that does nothing when clicked reads as a broken
 * link; a named upcoming feature reads as a reason to carry on.
 */
export const upcomingFeatures = (access: MemberAccess): MemberNavItem[] =>
    MEMBER_NAV.filter(item => !isUnlocked(item, access) || item.to === null);

/**
 * What kind of applicant this is, read the way the backend reads it.
 *
 * The obvious answer — `application.memberType` — is `undefined` on most rows.
 * The Application schema gained `memberType` and `registrationType` long after
 * applications started being written, and Mongoose strict mode had been
 * silently dropping both on every create until it did. What survived is the
 * copy inside `data`, because `data` is a Mixed path strict mode does not
 * police. Of the twelve applications in the live database, eight carry no
 * top-level `memberType` at all and seven of those say `aspirant` inside
 * `data.registrationType`.
 *
 * That is why the tile read "Standard": nothing matched, so it fell through to
 * the profile context's own label, which is computed from "are you doing
 * business" and has no idea what the applicant actually declared.
 *
 * Order of trust:
 *   1. an explicit declaration, wherever it survived
 *   2. failing that, the same derivation `buildApplicant` uses on the server,
 *      so the member's tile and the admin's queue agree
 *
 * The declaration is checked first on purpose. The server's derivation requires
 * `doingBusiness === false` to conclude "aspirant", and a row that recorded
 * `memberType: 'aspirant'` without ever recording `doingBusiness` therefore
 * derives to "business" — contradicting what the applicant plainly said. One
 * such row exists today.
 */
export type ApplicantKind = 'aspirant' | 'business' | '';

const DECLARED = (value: unknown): ApplicantKind => {
    const v = String(value || '').toLowerCase();
    return v === 'aspirant' || v === 'business' ? v : '';
};

export const resolveApplicantKind = (application: any | null): ApplicantKind => {
    if (!application) return '';

    const data = application.data || {};
    const business = data.business || data.businessInfo || {};

    // 1. Whatever the applicant actually declared, in any of the four places a
    //    version of this application could have stored it.
    const declared =
        DECLARED(application.memberType) ||
        DECLARED(application.registrationType) ||
        DECLARED(data.memberType) ||
        DECLARED(data.registrationType);
    if (declared) return declared;

    // 2. The server's own derivation, character for character.
    const doingBusiness =
        business.doingBusiness === true ||
        data.doingBusiness === true ||
        !!business.organizationName ||
        !!data.organizationName;

    const isAspirant =
        (business.doingBusiness === false || data.doingBusiness === false) && !doingBusiness;

    return isAspirant ? 'aspirant' : (doingBusiness ? 'business' : '');
};

/** The same answer, phrased for a person. Empty when nothing is known yet. */
export const applicantKindLabel = (application: any | null): string => {
    const kind = resolveApplicantKind(application);
    if (kind === 'aspirant') return 'Aspirant';
    if (kind === 'business') return 'Business Applicant';
    return '';
};


/**
 * Which membership this account holds, and what that entitles them to (ENT-001).
 *
 * The distinction is the one the applicant themselves made at registration: an
 * Aspirant or Student is here for the association — its updates, its events,
 * the directory — while a Company or Business member also gets the trading
 * side, a catalogue and the analytics over it.
 *
 * `resolveApplicantKind` above already answers "what did they declare", reading
 * the four places that answer survived. This layer is about what the ANSWER
 * BUYS, and it is deliberately separate: a member can be a business applicant
 * whose business record has not been created yet, and the sidebar has to be
 * right about them on the day they pay, not on the day they get round to
 * filling in the business form.
 */
export type MemberPlan = 'aspirant' | 'business' | 'unknown';

export interface PlanContext {
    /** What the applicant declared, from `resolveApplicantKind`. */
    declared: ApplicantKind;
    /** Whether a business record actually exists for them yet. */
    hasBusinessRecord: boolean;
}

/**
 * The plan, from the declaration first and the business record second.
 *
 * A declaration outranks a record because it is what the member said about
 * themselves. Someone who registered as a business but has not yet filled in
 * the business form is a business member with an empty catalogue — not an
 * aspirant — and telling them otherwise hides the very screen they need next.
 *
 * The reverse inference is still worth making: a record exists only because
 * somebody created one, so an account with a business but no surviving
 * declaration (there are such rows — see the note on `resolveApplicantKind`) is
 * treated as a business member rather than as unknown.
 */
export const resolvePlan = ({ declared, hasBusinessRecord }: PlanContext): MemberPlan => {
    if (declared === 'business') return 'business';
    if (declared === 'aspirant') return 'aspirant';
    return hasBusinessRecord ? 'business' : 'unknown';
};

/** How the plan reads on a membership card. Empty when nothing is known. */
export const planLabel = (plan: MemberPlan): string => {
    if (plan === 'business') return 'Business Membership';
    if (plan === 'aspirant') return 'Aspirant Membership';
    return '';
};

/**
 * What a plan may reach.
 *
 * Written as a table for the same reason `MEMBER_NAV` is: the dashboard, the
 * sidebar and the business screens all ask this question, and three answers
 * maintained separately is how the same account ends up seeing a Catalogue tile
 * that leads to a screen refusing to open.
 *
 * `unknown` is treated as a business member on purpose. Every entitlement here
 * is additive — nothing is withheld from an aspirant that would harm a business
 * member to see — so the failure to guess right costs a business member a
 * feature they paid for in one direction, and shows an aspirant a screen with
 * an empty state in the other. The second is the cheaper mistake.
 */
export interface PlanEntitlements {
    /** Product and service catalogue, stock, and the business dashboard. */
    catalogue: boolean;
    /** Operational analytics over that catalogue. */
    analytics: boolean;
    /** Listing in the directory WITH a business, rather than as a person. */
    businessListing: boolean;
}

export const entitlementsFor = (plan: MemberPlan): PlanEntitlements => {
    const trading = plan !== 'aspirant';

    return {
        catalogue: trading,
        analytics: trading,
        businessListing: trading,
    };
};

/**
 * Why a feature is not available, phrased for the member holding this plan.
 *
 * ENT-001 asks for features to be hidden OR EXPLAINED. Explained is almost
 * always the better of the two: a member who cannot find the catalogue assumes
 * the site is broken, while one who is told it belongs to a different
 * membership knows both where they stand and what to do about it. Hiding is
 * kept for the case where there is nothing useful to say.
 */
export const planExplainer = (plan: MemberPlan, feature: keyof PlanEntitlements): string => {
    if (entitlementsFor(plan)[feature]) return '';

    if (feature === 'catalogue') {
        return 'Catalogue and stock tools come with a Company or Business membership. '
            + 'An Aspirant membership covers association updates, events and the member directory.';
    }
    if (feature === 'analytics') {
        return 'Operational analytics measure a catalogue, which comes with a Company or '
            + 'Business membership.';
    }
    return 'This is part of a Company or Business membership.';
};

/**
 * The single next action, phrased for the member.
 *
 * Ordered by what actually has to happen first, so it never tells someone to
 * activate a membership for an application that has not been reviewed yet.
 */
export const nextMilestone = (access: MemberAccess): string => {
    if (!access.profileComplete) return 'Complete your profile';
    if (!access.applicationSubmitted) return 'Submit your application';
    if (!access.applicationApproved) return 'Awaiting admin approval';
    if (!access.membershipActive) return 'Activate your membership';
    return '';
};
