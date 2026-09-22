import { getMyMembershipPlans } from '@/services/activApi';
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

/*
 * THERE IS NO PLAN TABLE HERE ANY MORE, AND THAT IS THE POINT.
 *
 * This file used to hold four plans at four prices, and they were consulted
 * whenever the API call failed or had not answered yet. A fallback price is a
 * WRONG price the moment the Super Admin edits one: an association that raised
 * the aspirant fee to ₹5,000 would still have had ₹2,000 shown to anyone whose
 * request hiccuped, on a screen with a Pay button under it.
 *
 * So a failed load now fails visibly — `plans: []` and `failed: true`, which
 * the screen renders as "we could not load the prices" with a retry. Showing
 * nothing is recoverable; showing a number the association did not set is not.
 */

export interface PlanEligibility {
    /** The plans this member may choose between. Empty when the load failed. */
    plans: MembershipPlan[];
    /** Pre-selection, and the only choice when `locked`. Null when none loaded. */
    selected: MembershipPlan | null;
    /** True when the answer is a single plan: an aspirant, or a matched band. */
    locked: boolean;
    isCompany: boolean;
    experience: string;
    applicationId: string;
    /**
     * The prices could not be read.
     *
     * Its own flag rather than "plans is empty", because the two are different
     * situations and only one of them is the association's fault: an empty list
     * from a healthy server means every plan has been retired, which the screen
     * should say plainly rather than blaming the network.
     */
    failed: boolean;
}

/**
 * WHICH PLANS THIS MEMBER IS OFFERED — ASKED OF THE SERVER, NOT DECIDED HERE.
 *
 * This file used to hold the prices and the year thresholds and work the answer
 * out in the browser. Both have moved:
 *
 *   - the PRICES are rows in `membershipPlans`, edited by the Super Admin, and
 *     the same rows `paymentOrder.createOrder` charges from. A copy here would
 *     be a second opinion about money, and the first time the two disagreed the
 *     screen would advertise one figure while the card was debited another.
 *   - the BAND — which commencement year earns which plan — is on those rows
 *     too, so moving a boundary is an edit rather than a deploy.
 *
 * So `resolvePlanEligibility` is now one call to `/membership/plans/mine`,
 * which resolves the band server-side from the applicant's own business record.
 * The RETURN SHAPE is unchanged, deliberately: the plans screen renders exactly
 * what it rendered before, and the only difference is that the numbers and the
 * number of cards are now the association's to set.
 *
 * The constants above are kept as the LAST-RESORT fallback for a failed call —
 * a member who cannot reach the API sees the platform's shipped prices rather
 * than an empty screen with a Pay button on it. They are not consulted on the
 * normal path.
 */

/** What the server says, before it is reshaped for the screen. */
interface ServerPlan {
    key: string;
    name: string;
    description: string;
    price: number;
    audience: 'business' | 'aspirant';
    experience: string;
    features: string[];
    popular?: boolean;
}

interface ResolvedPlans {
    plans: ServerPlan[];
    matched: ServerPlan | null;
    years: number | null;
    /**
     * Why this set was returned:
     *   band      matched a commencement-year band — one plan
     *   aspirant  declared no business — the aspirant plan
     *   all       the Super Admin asked for every plan to be shown
     *   no-year   no commencement year on file
     *   no-band   a year that no band covers
     */
    reason: 'band' | 'aspirant' | 'all' | 'no-year' | 'no-band';
    showAllPlans: boolean;
}

const toPlan = (row: ServerPlan): MembershipPlan => ({
    id: row.key,
    name: row.name || '',
    description: row.description || '',
    price: Number(row.price || 0),
    experience: row.experience || '',
    features: Array.isArray(row.features) ? row.features : [],
    popular: row.popular === true,
});

/**
 * The application id, which the plans screen passes on to the payment order.
 *
 * Still read here because it is not a pricing question and the endpoint above
 * has no reason to carry it. Failure is non-fatal: an order without an
 * application id is still a valid order.
 */
const readApplicationId = async (): Promise<string> => {
    const app = await getUserApplication().catch(() => null);
    if (!app) return '';
    const a = app as any;
    return a.applicationId || a._id || a.id || '';
};

export const resolvePlanEligibility = async (): Promise<PlanEligibility> => {
    const [resolved, applicationId] = await Promise.all([
        getMyMembershipPlans().catch(() => null),
        readApplicationId(),
    ]);

    const rows = Array.isArray(resolved?.plans) ? resolved!.plans : [];

    /*
     * NOTHING LOADED — say so, and show no price.
     *
     * There is no shipped table to fall back to any more, on purpose: a
     * fallback price becomes a wrong price the moment the Super Admin edits
     * one, and this screen has a Pay button on it. `failed` separates "the
     * request did not land" from "every plan is retired", which are different
     * sentences to put in front of a member.
     */
    if (!rows.length) {
        return {
            plans: [],
            selected: null,
            locked: false,
            isCompany: true,
            experience: '',
            applicationId,
            failed: resolved === null,
        };
    }

    const plans = rows.map(toPlan);
    const isCompany = rows[0].audience !== 'aspirant';

    /*
     * `locked` means "there is nothing to choose", and that is now true in more
     * cases than it used to be. It was set only for an aspirant; a business
     * applicant whose commencement year lands in a band is in exactly the same
     * position — one plan, at one price, decided by what they declared — so the
     * screen should present it the same way rather than as a choice of one.
     */
    const locked = plans.length === 1;

    const matched = resolved?.matched ? toPlan(resolved.matched) : null;
    const selected = matched
        || plans.find((plan) => plan.popular)
        || plans[0];

    return {
        plans,
        selected,
        locked,
        isCompany,
        experience: selected.experience,
        applicationId,
        failed: false,
    };
};
