import { useCallback, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Check, X, MapPin, Phone, TrendingUp, Inbox, Eye } from 'lucide-react';
import type { Applicant } from '@/services/activApi';

/**
 * The shared approval queue — the web counterpart of the mobile app's
 * `ApprovalQueue`, with the same rules.
 *
 * 1. The buckets come from the SERVER, untouched. `classifyForLevel` decides
 *    what a tier sees; re-deriving it here from a stages array is a second
 *    implementation of the workflow that can disagree with the first.
 * 2. Only a `pending` file is actionable. Everything decided stays in the list
 *    and loses its buttons.
 * 3. A rejection carries a reason the admin types. The website sent a constant
 *    string, so every rejection reached the applicant with the same words.
 * 4. One card at a time is busy, so a double-click cannot submit twice — and
 *    the second submit would hit a terminal state and fail.
 * 5. EVERY CARD OFFERS "VIEW", on every tier, beside the status badge. The
 *    whole card has always been clickable and opened the four submitted forms,
 *    but nothing on it said so — an admin deciding a membership could not tell
 *    that the answers behind the decision were one press away, so they decided
 *    on a name, a phone number and a role. A named button is the difference
 *    between a feature that exists and one that gets used.
 *
 * ---------------------------------------------- one queue, three tiers on it
 *
 * The Block, District and State admin of a region now see the SAME queue: an
 * application is submitted to all three at once and the first of them to decide
 * decides it. So a file an admin can see is a file they can act on, and a file
 * they cannot act on has been decided — by them or by one of the other two.
 *
 * That makes the fourth rule this file used to carry unnecessary: there is no
 * escalated file to explain, because nothing is escalated. What it is worth
 * saying instead is that a decision can arrive from somebody else, which is why
 * a decided card keeps its place in the list with its verdict on it.
 */

export type BucketKey = 'pending' | 'approved' | 'rejected' | 'all';
export type AdminLevel = 'block' | 'district' | 'state' | 'super';

export interface ApplicantBuckets {
    pending: Applicant[];
    approved: Applicant[];
    rejected: Applicant[];
    all: Applicant[];
}

interface Props {
    buckets: ApplicantBuckets;
    level: AdminLevel;
    /** Resolves once the decision is persisted; the parent then refetches. */
    onReview: (applicant: Applicant, action: 'approve' | 'reject', reason?: string) => Promise<void>;
    onPressApplicant?: (applicant: Applicant) => void;
    activeFilter?: BucketKey;
    onFilterChange?: (filter: BucketKey) => void;
}

const FILTER_TABS: { key: BucketKey; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all', label: 'All' },
];

/**
 * Why a queue is empty is more useful than the fact that it is.
 *
 * These three sentences used to explain the relay — "applications appear here
 * only after the Block Admin approves them" — which was the honest answer to an
 * empty district queue and is now false. A district admin sees every applicant
 * in their district from the moment they apply, so an empty queue means one
 * thing: nobody has applied, or everything has been dealt with.
 */
const LEVEL_COPY: Record<AdminLevel, { title: string; waitingOn: string }> = {
    block: {
        title: 'Block Approvals',
        waitingOn: 'Every application from your block, from the moment it is submitted.',
    },
    district: {
        title: 'District Approvals',
        waitingOn: 'Every application from your district, from the moment it is submitted.',
    },
    state: {
        title: 'State Approvals',
        waitingOn: 'Every application from your state, from the moment it is submitted.',
    },
    super: {
        title: 'All Approvals',
        waitingOn: 'Every application across the platform appears here.',
    },
};

/*
 * Three stages, because there are three answers. `upstream` (with a tier below
 * you) and `closed` (somebody else's rejection) were positions in a relay that
 * no longer exists — see the note at the head of this file.
 */
const STAGE_COLORS: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
    approved: 'bg-green-100 text-green-700 hover:bg-green-100',
    rejected: 'bg-red-100 text-red-700 hover:bg-red-100',
};

/**
 * The selected tab's fill.
 *
 * Each bucket keeps its own colour — green for approved, red for rejected — so
 * the tab agrees with the badges on the cards underneath it. No borders: these
 * sit on an inset track now and a border on the raised tab would read as a
 * second outline inside the first.
 */
const TAB_ACTIVE: Record<BucketKey, string> = {
    pending: 'bg-blue-600 text-white shadow-sm',
    approved: 'bg-emerald-600 text-white shadow-sm',
    rejected: 'bg-rose-600 text-white shadow-sm',
    all: 'bg-blue-600 text-white shadow-sm',
};

const getInitials = (fullName?: string | null): string => {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

export default function ApprovalQueue({
    buckets,
    level,
    onReview,
    onPressApplicant,
    activeFilter: controlledFilter,
    onFilterChange,
}: Props) {
    const [internalFilter, setInternalFilter] = useState<BucketKey>('pending');
    const activeFilter = controlledFilter ?? internalFilter;

    const setActiveFilter = (f: BucketKey) => {
        setInternalFilter(f);
        onFilterChange?.(f);
    };

    const [busyId, setBusyId] = useState<string | null>(null);
    const [busyAction, setBusyAction] = useState<'approve' | 'reject' | null>(null);
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    const safeBuckets = useMemo<ApplicantBuckets>(
        () => ({
            pending: buckets?.pending || [],
            approved: buckets?.approved || [],
            rejected: buckets?.rejected || [],
            all: buckets?.all || [],
        }),
        [buckets],
    );

    const visible = safeBuckets[activeFilter] || [];
    const copy = LEVEL_COPY[level] || LEVEL_COPY.block;

    const submit = useCallback(
        async (applicant: Applicant, action: 'approve' | 'reject', reason?: string) => {
            setBusyId(applicant?.id || '');
            setBusyAction(action);
            try {
                await onReview(applicant, action, reason);
                setRejectingId(null);
                setRejectReason('');
            } finally {
                setBusyId(null);
                setBusyAction(null);
            }
        },
        [onReview],
    );

    const renderCard = (applicant: Applicant) => {
        const stage = applicant?.stage || 'pending';
        const isBusy = busyId === (applicant?.id || '');
        /*
         * THIS TIER'S OWN VERDICT IS THE WHOLE TEST.
         *
         * Not "has anybody decided". The three tiers hold three separate
         * verdicts: the State approving does not sign the District's slot, and
         * the District's buttons must stay live until the District itself acts.
         * That was the reported bug — a District Hub showing "Approved" on rows
         * the District had never looked at.
         *
         * `canAct` from the server when it is there; `stage === 'pending'` is
         * the same answer for this tier and covers a payload from an older
         * build.
         */
        const canAct = applicant?.canAct ?? (stage === 'pending');
        const isRejecting = rejectingId === (applicant?.id || '');

        /*
         * The APPLICATION's outcome, which the badge above does NOT report.
         * Only the State's approval enrols somebody, so a block or district
         * admin's own "Approved" badge says nothing about membership.
         */
        const outcome = String((applicant as any)?.outcome || applicant?.status || '');
        const enrolled = outcome === 'Approved';
        const declined = outcome === 'Rejected';
        const endorsement = String((applicant as any)?.endorsementLine || '');
        const grantsMembership = (applicant as any)?.decidesOutcome !== false;

        const location = [applicant?.block, applicant?.district].filter(Boolean).join(', ');

        const isAspirant =
            applicant?.doingBusiness === false ||
            (applicant as any)?.businessInfo?.doingBusiness === false ||
            String((applicant as any)?.registrationType || (applicant as any)?.memberType || applicant?.role || '')
                .toLowerCase()
                .includes('aspirant');

        const displayRole = isAspirant
            ? 'Aspirant'
            : applicant?.doingBusiness === true || (applicant as any)?.businessInfo?.organizationName
              ? 'Business Member'
              : applicant?.role && applicant.role.toLowerCase() !== 'member'
                ? applicant.role
                : 'Business Member';

        return (
            <Card
                key={applicant?.id || applicant?.applicationId}
                /* The admin area's card, so an applicant row sits at the same
                   elevation as every other panel around it. */
                className={`mb-4 border border-slate-200 rounded-2xl
                            shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)] ${
                    onPressApplicant
                        ? 'cursor-pointer transition-all duration-200 hover:-translate-y-0.5 '
                          + 'hover:border-slate-300 '
                          + 'hover:shadow-[0_4px_8px_-2px_rgba(16,24,40,0.12),0_16px_32px_-8px_rgba(16,24,40,0.16)]'
                        : ''
                }`}
                onClick={() => onPressApplicant?.(applicant)}
            >
                <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">
                            {getInitials(applicant?.fullName)}
                        </div>

                        <div className="flex-1 min-w-0">
                            {/* Never a placeholder name: an admin deciding on a
                                membership must not be shown invented details. */}
                            <p className="font-semibold text-slate-900 truncate">
                                {applicant?.fullName || 'Name not provided'}
                            </p>
                            {!!applicant?.email && (
                                <p className="text-[1.25rem] text-slate-500 truncate">{applicant.email}</p>
                            )}
                        </div>

                        {/*
                          * VIEW SITS WITH THE STATUS, NOT IN THE FOOTER.
                          *
                          * "What does this say" and "what has been decided" are
                          * the same glance, so the control and the verdict share
                          * a corner. It was at the foot of the card, which put it
                          * among the two decisions — and on a decided card it sat
                          * alone under a rule, a footer built for one button.
                          *
                          * To the LEFT of the badge: the badge is the column the
                          * eye runs down a list of cards on, and it keeps that
                          * right edge whether or not the button is there.
                          */}
                        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {!!onPressApplicant && (
                                <button
                                    type="button"
                                    onClick={() => onPressApplicant(applicant)}
                                    aria-label="View application"
                                    title="View application"
                                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border
                                               border-slate-200 bg-slate-50 px-2.5 sm:px-3 text-[1rem]
                                               font-bold text-slate-700 transition-colors
                                               hover:bg-slate-100 hover:border-slate-300"
                                >
                                    <Eye className="w-3.5 h-3.5 shrink-0" />
                                    {/* The label costs 110px the name needs on a
                                        phone; the icon and the `aria-label` carry
                                        it there. */}
                                    <span className="hidden sm:inline">View application</span>
                                </button>
                            )}

                            <Badge className={STAGE_COLORS[stage] || STAGE_COLORS.pending}>
                                {applicant?.statusLabel || 'Pending'}
                            </Badge>
                        </div>
                    </div>

                    <div className="mt-3 space-y-1 text-[1.25rem]">
                        <div className="flex items-center gap-1">
                            <span className="text-slate-500">Role:</span>
                            <span className={isAspirant ? 'text-emerald-600 font-semibold' : 'text-blue-600 font-semibold'}>
                                {displayRole}
                            </span>
                        </div>
                        {!!location && (
                            <div className="flex items-center gap-1 text-slate-500">
                                <MapPin className="w-3.5 h-3.5" />
                                <span className="truncate">{location}</span>
                            </div>
                        )}
                        {!!applicant?.phone && (
                            <div className="flex items-center gap-1 text-slate-500">
                                <Phone className="w-3.5 h-3.5" />
                                <span>{applicant.phone}</span>
                            </div>
                        )}
                    </div>

                    {/*
                        Applied on / Membership Type, the pair the mobile
                        applicant card shows beneath the contact rows. Without
                        them an admin could not tell from the queue how long a
                        file had been waiting, or whether the applicant was a
                        business or an aspirant, without opening it.

                        The date format is mobile's: 02 Sep 2026.
                    */}
                    <div className="mt-3 grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                        <div>
                            <p className="text-[1.0625rem] uppercase tracking-wider text-slate-400 font-semibold">
                                Applied on
                            </p>
                            <p className="text-[1.25rem] text-slate-800 font-medium">
                                {applicant?.submittedAt
                                    ? new Date(applicant.submittedAt).toLocaleDateString('en-GB', {
                                        day: '2-digit', month: 'short', year: 'numeric',
                                    })
                                    : '—'}
                            </p>
                        </div>
                        <div>
                            <p className="text-[1.0625rem] uppercase tracking-wider text-slate-400 font-semibold">
                                Membership Type
                            </p>
                            <p className="text-[1.25rem] text-slate-800 font-medium capitalize">
                                {applicant?.memberType || applicant?.role || 'Member'}
                            </p>
                        </div>
                    </div>

                    {/* Nobody at any tier covers this region: the Super Admin
                        is the only person who will ever clear it unless
                        somebody is appointed. */}
                    {!!applicant?.orphaned && !!applicant?.fallbackReason && (
                        <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-2">
                            <TrendingUp className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                            <p className="text-[1.1875rem] text-amber-800">{applicant.fallbackReason}</p>
                        </div>
                    )}

                    {!!applicant?.approvedByText && (
                        <p
                            className={`mt-2 text-[1.1875rem] ${
                                stage === 'rejected' ? 'text-red-600' : 'text-slate-500'
                            }`}
                        >
                            {applicant.approvedByText}
                        </p>
                    )}

                    {/*
                      * ==========================================================
                      * WHAT THE OTHER TIERS SAID, AND WHETHER THEY ARE A MEMBER
                      * ==========================================================
                      *
                      * Two facts the badge cannot carry, and both change what an
                      * admin does next:
                      *
                      *   - somebody else has already recorded a view of this
                      *     applicant, which is worth reading before adding your
                      *     own;
                      *   - the State has enrolled them (or not), which is the
                      *     only thing that makes them a member — a Block admin's
                      *     green "Approved" badge does not.
                      *
                      * Both are withheld when they would restate the badge: a
                      * State admin's own approved card does not need "Member"
                      * printed under it.
                      */}
                    {(!!endorsement || (enrolled && stage !== 'approved') || (declined && stage !== 'rejected')) && (
                        <p className="mt-2 text-[1.1875rem] text-slate-500">
                            {[
                                endorsement,
                                enrolled && stage !== 'approved' ? 'Approved — the member profile exists' : '',
                                declined && stage !== 'rejected' ? 'The State Admin rejected this application' : '',
                            ].filter(Boolean).join(' · ')}
                        </p>
                    )}

                    {/*
                      Said before the buttons, not after: an admin whose verdict
                      is recorded rather than granting should know that as they
                      decide, and it is the difference between the two kinds of
                      Approve button on this screen.
                    */}
                    {canAct && !grantsMembership && (
                        <p className="mt-2 text-[1.1875rem] text-slate-500">
                            Your decision is recorded for the file. The State Admin grants the membership.
                        </p>
                    )}

                    {!!applicant?.rejectionReason && stage !== 'pending' && (
                        <p className="mt-2 text-[1.1875rem] text-red-600 line-clamp-3">
                            Reason: {applicant.rejectionReason}
                        </p>
                    )}

                    {/*
                      * ==========================================================
                      * ONE ACTION ROW, ON ITS OWN RULE
                      * ==========================================================
                      *
                      * View, Approve and Reject were three separate blocks
                      * stacked down the card at three different margins. That is
                      * what made the row look wrong: the eye reads a footer, and
                      * a footer assembled out of three independently-spaced
                      * pieces has no bottom edge to sit on. One rule, one row,
                      * one height (`h-10`) for all three.
                      *
                      * VIEW IS NOT A GHOST BUTTON. It was `variant="outline"` at
                      * full width, which renders as a pale hairline box with
                      * faint text in it — the shape of an empty input field, not
                      * of something to press, and on a white card it all but
                      * disappeared. It is a filled slate button now, with a real
                      * border and bold text.
                      *
                      * It is outside the `canAct` test on purpose: an approved or
                      * rejected application still has four forms behind it, and
                      * "what did this member actually submit" is asked long after
                      * the decision. It takes the whole row when it is alone and
                      * sits at its natural width beside the two decisions when
                      * they are there — so Approve and Reject keep the weight.
                      */}
                    {/*
                      * THE FOOTER IS THE DECISION, and nothing else.
                      *
                      * View used to share this rule, which meant a decided card
                      * still drew a footer to hold one secondary button. With
                      * View up beside the status, an approved or rejected card
                      * ends at its last line — no rule, no empty row.
                      *
                      * Stacked on a phone, one row from `sm` up: two buttons
                      * sharing 340px is two cramped buttons, and full width is
                      * the right thumb target there.
                      */}
                    {canAct && !isRejecting && (
                        <div
                            className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row
                                       sm:items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => submit(applicant, 'approve')}
                                className="inline-flex h-10 w-full sm:flex-1 items-center justify-center
                                           gap-2 rounded-lg bg-green-600 px-4 text-[1.1875rem] font-bold text-white
                                           transition-colors hover:bg-green-700
                                           disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {isBusy && busyAction === 'approve' ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <><Check className="w-4 h-4" /> Approve</>
                                )}
                            </button>
                            <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => {
                                    setRejectingId(applicant?.id || '');
                                    setRejectReason('');
                                }}
                                className="inline-flex h-10 w-full sm:flex-1 items-center justify-center
                                           gap-2 rounded-lg border border-red-200 bg-white px-4 text-[1.1875rem]
                                           font-bold text-red-600 transition-colors hover:bg-red-50
                                           disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <X className="w-4 h-4" /> Reject
                            </button>
                        </div>
                    )}

                    {/* Inline, not a dialog — the queue renders inside tab views
                        and the reason must stay visible while it is typed. */}
                    {canAct && isRejecting && (
                        <div
                            className="mt-4 pt-4 border-t border-slate-100 space-y-2"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <label className="text-[1.1875rem] font-bold text-slate-800">Reason for rejection</label>
                            <Textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Explain why this application is being rejected"
                                rows={3}
                            />
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1"
                                    disabled={isBusy}
                                    onClick={() => {
                                        setRejectingId(null);
                                        setRejectReason('');
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    className="flex-1"
                                    disabled={isBusy}
                                    onClick={() => submit(applicant, 'reject', (rejectReason || '').trim())}
                                >
                                    {isBusy && busyAction === 'reject' ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        'Confirm Reject'
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };

    return (
        <div>
            <h2 className="text-[1.25rem] font-bold tracking-tight text-slate-900 mb-3">{copy.title}</h2>

            {/*
              AN INSET TRACK, not four free-floating pills.

              Each tab carried its own white fill and border, so on the page tint
              they read as four separate cards rather than as one control with
              four positions — and the selected one was hard to pick out among
              them. One slate track with the active tab raised out of it in solid
              blue is the same treatment the Members tabs use, and the two
              screens sit one click apart.
            */}
            {/*
              TWO ROWS ON A PHONE, ONE FROM `sm`.

              Four tabs across a 360px screen give each about 73px, and each has
              to hold a word plus a count. `truncate` then ate the count — the
              row read "Pendin… Approv… Rejecte… All (0)", which is every label
              clipped and the one number that matters missing from three of them.
              A 2x2 grid gives each tab ~160px, which fits "Pending (12)" whole.

              `grid` rather than `flex-wrap`: wrapping would leave the last row
              with one stretched tab whenever the count is odd, and these four
              are a set that should stay the same size as each other.
            */}
            <div className="grid grid-cols-2 sm:flex sm:gap-1 gap-1 mb-5 p-1 rounded-xl
                            bg-slate-100 ring-1 ring-slate-200/60">
                {FILTER_TABS.map((tab) => {
                    const isActive = activeFilter === tab.key;
                    const count = (safeBuckets[tab.key] || []).length;
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveFilter(tab.key)}
                            className={`sm:flex-1 px-2 py-2 rounded-lg text-[1.1875rem] font-semibold truncate
                                        transition-colors ${
                                isActive
                                    ? TAB_ACTIVE[tab.key]
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            {tab.label} ({count})
                        </button>
                    );
                })}
            </div>

            {visible.length > 0 ? (
                visible.map(renderCard)
            ) : (
                /*
                  AN EMPTY STATE IS STILL A SURFACE.

                  This was bare text and an icon floating on the page, so an
                  empty bucket looked like a screen that had failed to render
                  rather than a screen with nothing in it. The card is the same
                  card an applicant row would have appeared in, which is exactly
                  the point: the panel is there, it is simply empty.
                */
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center
                                bg-white border border-slate-200 rounded-2xl
                                shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)]">
                    <span className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
                        <Inbox className="w-7 h-7 text-slate-400" />
                    </span>
                    <p className="text-[1.25rem] font-bold tracking-tight text-slate-900">
                        {/* `No all applications` is not a sentence. The `all`
                            bucket is the absence of a filter, so it has no
                            adjective to put in front of the noun. */}
                        No {activeFilter === 'all' ? '' : `${activeFilter} `}applications
                    </p>
                    <p className="text-[1.25rem] text-slate-500 mt-1 max-w-sm">
                        {activeFilter === 'pending' ? copy.waitingOn : 'Nothing to show in this bucket yet.'}
                    </p>
                </div>
            )}
        </div>
    );
}
