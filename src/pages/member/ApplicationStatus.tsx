/**
 * Application Status — the website's version of the mobile screen.
 *
 * The presentation is a port of `frontend/src/screens/application/
 * ApplicationStatusScreen.tsx`: a gradient status hero whose colour *is* the
 * outcome, a reference strip, and a rail-and-card review timeline. The tones,
 * the copy and the stage rules are the mobile ones, so a member who has seen one
 * recognises the other.
 *
 * What changes for the web is the frame, not the design. Mobile stacks
 * everything in a single column because it has no choice; here the hero and the
 * strip take the full width and the timeline sits beside a details panel, so a
 * desktop screen gets used rather than padded out with empty margin.
 *
 * Stage derivation comes from `timelineStageStatus` in `activApi` — the same
 * function the dashboard tracker calls — so when an admin approves, this screen
 * and the dashboard card move together instead of drifting apart. An earlier
 * version derived its own stages from `approvals.*`, which is a second set of
 * rules over the same timestamps and the usual way two screens end up
 * disagreeing about one file.
 *
 * ------------------------------------------- four stages: the three tiers, then payment
 *
 * Block → District → State → Payment. Each tier records its OWN verdict, so the
 * three rows say three different things and every one of them is information
 * the applicant wants: who has looked at my file, and who has not yet.
 *
 * **Only the State's approval grants the membership.** The Block and District
 * rows are endorsements, and the rail says so rather than letting a green Block
 * row imply the process is over.
 *
 * It collapsed to two rows for a while, under a build where all three tiers
 * shared one verdict — three rows would then have been three copies of one
 * answer. What it must never return to is the RELAY reading, where two rows sat
 * at "Waiting" for a turn to come round: nobody is queued behind anybody, all
 * three admins hold the file from the day it is submitted, and an undecided
 * tier is "In Review".
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MemberPageShell from '@/pages/member/MemberPageShell';
import { Button } from '@/components/ui/button';
import {
    Loader2, RefreshCw, CreditCard, Check, Hourglass, X, Clock, ChevronRight, Info, ArrowLeft,
    AlertTriangle, User, Calendar, MapPin, Mail, Phone, FileText, BadgeCheck,
} from 'lucide-react';
import { getUserApplication } from '@/services/applicationApi';
import {
    deriveApprovalFlags, decidedByLabel, timelineStageStatus,
    tierDecidedAt, tierDecidedByLabel,
    type TimelineStageStatus,
} from '@/services/activApi';
import { applicantKindLabel, dashboardPathFor, formatApplicationRef } from '@/features/member/memberAccess';
import useMembershipGate from '@/features/member/useMembershipGate';

import { CARD_TITLE, PAGE_TITLE } from '@/components/layout/appTypography';
/** The mobile screen's palette, one for one. */
const TONE: Record<TimelineStageStatus, {
    text: string; soft: string; dot: string; label: string; Icon: typeof Check;
}> = {
    approved: { text: 'text-[#16A34A]', soft: 'bg-[#DCFCE7]', dot: 'bg-[#16A34A]', label: 'Approved', Icon: Check },
    in_progress: { text: 'text-[#1E50E6]', soft: 'bg-[#E0E7FF]', dot: 'bg-[#1E50E6]', label: 'In Review', Icon: Hourglass },
    rejected: { text: 'text-[#DC2626]', soft: 'bg-[#FEE2E2]', dot: 'bg-[#DC2626]', label: 'Rejected', Icon: X },
    pending: { text: 'text-[#94A3B8]', soft: 'bg-[#F1F5F9]', dot: 'bg-[#94A3B8]', label: 'Waiting', Icon: Clock },
};

/**
 * The four stages, in order. `short` is what the hero rail shows.
 *
 * `grants` marks the one stage that actually admits the applicant. Carrying it
 * as data rather than as a comparison against `'state'` in four places is what
 * lets the copy below stay honest about which approvals are endorsements.
 */
const STAGES = [
    { key: 'block', name: 'Block Admin Review', short: 'Block', grants: false },
    { key: 'district', name: 'District Admin Review', short: 'District', grants: false },
    { key: 'state', name: 'State Admin Approval', short: 'State', grants: true },
    { key: 'payment', name: 'Membership Payment', short: 'Payment', grants: false },
] as const;

const formatDate = (value?: string | null): string => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * The per-stage copy.
 *
 * It has to distinguish the two kinds of approval, or a green Block row reads
 * as "you're in" — which it is not. The Block and District admins endorse; the
 * State admin admits.
 */
const stageMessage = (
    key: string,
    grants: boolean,
    status: TimelineStageStatus,
    rejectionReason?: string,
): string => {
    const tier = key === 'block' ? 'Block' : key === 'district' ? 'District' : 'State';

    if (status === 'approved') {
        return grants
            ? 'Approved. Your membership has been granted.'
            : `Your ${tier} Admin has approved your application.`;
    }
    if (status === 'rejected') {
        return rejectionReason
            || (grants
                ? 'Your application was not approved.'
                : `Your ${tier} Admin did not approve your application. The State Admin decides the outcome.`);
    }
    if (status === 'in_progress') {
        return grants
            ? 'Your State Admin has still to review your application. Theirs is the approval that grants the membership.'
            : `Your ${tier} Admin has still to review your application.`;
    }
    return '';
};

export default function ApplicationStatus() {
    const navigate = useNavigate();
    const { isPaid } = useMembershipGate();
    const [application, setApplication] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');

    const dashboard = dashboardPathFor(isPaid === true);

    /*
     * A FULL MEMBER DOES NOT HAVE AN APPLICATION OUTSTANDING.
     *
     * The rail entry retires on payment (`retires` in `memberAccess`), but
     * taking an entry out of the rail only stops the screen being OFFERED.
     * A bookmark, the back button or the browser's history still opens it,
     * and what it shows a paid member is the history of how they got in,
     * headed by a hero that reads as something still in progress.
     *
     * `isPaid` is `null` until the gate answers, and only `=== true` sends
     * anybody away: redirecting on an unknown would bounce an applicant off
     * their own status page for as long as the check takes.
     */
    useEffect(() => {
        if (isPaid === true) navigate(dashboard, { replace: true });
    }, [isPaid, dashboard, navigate]);

    const load = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true); else setLoading(true);
        try {
            setApplication(await getUserApplication());
            setError('');
        } catch (err: any) {
            setError(err?.message || 'Failed to load application status. Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const flags = useMemo(() => deriveApprovalFlags(application), [application]);
    const isRejected = flags.isRejected === true;
    // Read through the flags, not off the raw status: live rows carry
    // `approved` in lower case and legacy spellings besides.
    const isApproved = flags.isApproved === true;

    /**
     * The four stages with their state resolved.
     *
     * Payment is not a review and has no tier verdict of its own: it is approved
     * once the membership is active, in progress while an approved application
     * waits to be paid for, and pending before that.
     *
     * Each review row names the admin who actually signed THAT tier, resolved
     * by the server (`tierReviews` on the payload). It cannot be inferred from
     * the region, and it cannot be read off `approvedBy` for all three — that
     * field holds the outcome, which is the State's alone.
     */
    const stages = useMemo(() => STAGES.map((stage) => {
        const isPayment = stage.key === 'payment';
        const tier = stage.key as 'block' | 'district' | 'state';

        /*
         * Payment is the one stage that is not a review, and the only one that
         * can honestly be `pending`: it has not begun until the State approves.
         * The three tiers are all live from submission, so an undecided one is
         * "In Review" and never "Waiting".
         */
        const status: TimelineStageStatus = isPayment
            ? (isPaid ? 'approved' : isApproved ? 'in_progress' : 'pending')
            : (application ? timelineStageStatus(tier, application) : 'pending');

        return {
            key: stage.key,
            name: stage.name,
            short: stage.short,
            /* Carried through so the card can mark the ONE row whose
               approval grants the membership. Comparing against 'state'
               at the render site would be a second copy of a rule that
               already exists as data on `STAGES`. */
            grants: stage.grants,
            status,
            completed: status === 'approved',
            active: status === 'in_progress',
            /*
             * "In Review" is the right word for a tier that is reading the
             * file, and the wrong one for this stage: the payment is waiting on
             * the MEMBER, and a badge saying somebody else is reviewing it sits
             * directly above a sentence asking them to pay. The rest of the
             * stage's colour and icon stay as they are — it IS the live step.
             */
            badge: isPayment && status === 'in_progress' ? 'Action needed' : '',
            reviewer: isPayment ? 'ACTIV System' : tierDecidedByLabel(application, tier),
            date: formatDate(isPayment ? null : tierDecidedAt(application, tier)),
            message: isPayment
                ? (isPaid
                    ? 'Your membership payment has been received.'
                    : isApproved
                        ? 'Your application is approved. Please proceed with membership payment.'
                        : 'This opens once your State Admin has approved your application.')
                : stageMessage(stage.key, stage.grants, status, application?.rejectionReason),
        };
    }), [application, isApproved, isPaid]);

    const completedCount = stages.filter(s => s.completed).length;
    const progress = Math.round((completedCount / stages.length) * 100);

    /**
     * The colour is the outcome, readable before a word is.
     *
     * A solid fill rather than the two-stop gradient this was: the member area
     * uses one flat blue everywhere else, and a gradient beside it shows two
     * nearly-identical blues on one page — which reads as a rendering fault
     * rather than as a choice. The named tokens also keep it on the same ramp as
     * every other status colour in the product, where the hex pairs did not.
     */
    const heroSolid = isRejected
        ? 'bg-rose-600'
        : isApproved
            ? 'bg-emerald-600'
            : 'bg-blue-600';

    const heroHeadline = isRejected ? 'Application Rejected'
        : isApproved ? 'Application Approved' : 'Under Review';

    const heroCaption = isRejected ? 'See the reviewer note below for details.'
        : isApproved ? 'You can now complete your membership payment.'
            : `${completedCount} of ${stages.length} stages completed`;

    const personal = application?.data?.personalDetails || application?.data?.personal || {};

    // ---------------------------------------------------------------- states

    if (loading) {
        return (
            <MemberPageShell title="Application Status" subtitle="Track your membership approval progress" width="wide" sidebar={false} backTo={dashboard}>
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-blue-600
                                    flex items-center justify-center mb-5 shadow-lg shadow-blue-500/30">
                        <Loader2 className="w-8 h-8 animate-spin text-white" />
                    </div>
                    <h2 className={`${CARD_TITLE} text-slate-900`}>Loading Application</h2>
                    <p className="text-[1.1875rem] text-slate-500 mt-1">Fetching your latest status…</p>
                </div>
            </MemberPageShell>
        );
    }

    if (!application) {
        return (
            <MemberPageShell title="Application Status" subtitle="Track your membership approval progress" width="wide" sidebar={false} backTo={dashboard}>
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-[4.75rem] h-[4.75rem] rounded-full bg-white border border-slate-200
                                    flex items-center justify-center mb-5">
                        {error
                            ? <AlertTriangle className="w-9 h-9 text-[#DC2626]" />
                            : <FileText className="w-9 h-9 text-[#64748B]" />}
                    </div>
                    <h2 className={`${CARD_TITLE} text-slate-900`}>
                        {error ? 'Something Went Wrong' : 'No Application Found'}
                    </h2>
                    <p className="text-[1.1875rem] text-slate-500 mt-2 max-w-sm leading-relaxed">
                        {error || "You haven't submitted an application yet. Complete your profile to get started."}
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-3 mt-7">
                        {error ? (
                            <Button onClick={() => load()} className="bg-[#1E50E6] hover:bg-[#1a45c9] font-semibold">
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Try Again
                            </Button>
                        ) : (
                            /* Step 1 — see the note on the dashboard's hero
                               button. A control named "Complete Your Profile"
                               opens the profile. */
                            <Button onClick={() => navigate('/member/profile?step=1')} className="bg-[#1E50E6] hover:bg-[#1a45c9] font-semibold">
                                Complete Your Profile
                            </Button>
                        )}
                        <Button variant="outline" onClick={() => navigate(dashboard)} className="font-semibold">
                            Back to Dashboard
                        </Button>
                    </div>
                </div>
            </MemberPageShell>
        );
    }

    // ---------------------------------------------------------------- screen

    return (
        <MemberPageShell
            title="Application Status"
            subtitle="Track your membership approval progress"
            width="wide"
            /*
              * No rail on this screen.
              *
              * It is a place a member is looking AT one thing, reached from the
              * dashboard card and left again by the same route. A sidebar here
              * offers eight ways out of a screen whose whole job is one file,
              * and it costs 288px that the timeline and the details panel put to
              * better use. `sidebar={false}` also turns the shell's menu button
              * into a back arrow, which is the control this screen actually
              * wants.
              */
            sidebar={false}
            backTo={dashboard}
            /*
              * THE WAY OUT BELONGS IN THE HEADER.
              *
              * "Back to Dashboard" was the last thing in the right-hand column,
              * which put the only labelled exit from this screen below four
              * timeline rows and two cards — reachable by scrolling to the
              * bottom of a page whose length depends on how many stages have
              * been decided. An exit that moves as the content grows is an exit
              * people stop looking for.
              *
              * The shell already draws a bare back ARROW here (`sidebar={false}`
              * turns the menu button into one). The arrow is the gesture and
              * this is the label: on a screen a member arrives at from one card
              * and leaves again by the same route, it is worth saying where
              * "back" goes.
              *
              * IT LEADS THE PAIR. Leaving is what a member does on this screen
              * far more often than re-reading it, and a left-pointing arrow
              * reads as "out of here" only while it is the leftmost thing in
              * the group — put Refresh first and the arrow points at Refresh.
              *
              * Light blue rather than the solid brand fill: the primary action
              * on this screen is Proceed to Payment once the State approves, and
              * two solid blue buttons on one page is two primary actions. This
              * one is the quiet one.
              */
            actions={
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        onClick={() => navigate(dashboard)}
                        className="gap-1.5 bg-blue-50 text-blue-700 border border-blue-200
                                   font-semibold shadow-none hover:bg-blue-100 hover:text-blue-800"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Back to Dashboard</span>
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => load(true)}
                        disabled={refreshing}
                        className="gap-1.5 font-semibold"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">Refresh</span>
                    </Button>
                </div>
            }
        >
            {/*
              * SOLID WHITE CARDS, `BusinessUI`'s exactly.
              *
              * These were frosted — `bg-white/65` over `backdrop-blur-xl`, on
              * three blurred colour washes — so the shell's dot field read
              * through them. It made the cards themselves indistinct: on a
              * pale blue page a 65% white panel has almost no edge, and the
              * association could not tell where one card stopped and the page
              * began.
              *
              * The washes went with it. They existed only to give the glass
              * something to pick up; behind opaque cards they would show in
              * the gutters alone, which is a coloured smudge with no reason
              * to be there.
              *
              * ONE CARD TREATMENT ACROSS THE PRODUCT. This is `BusinessUI`'s
              * card copied exactly — white, `border-slate-200`, and the same
              * two-layer shadow — because the Business Account screens are one
              * click away and a second card style is how two halves of a
              * product stop looking like one product.
              */}
            <div className="relative w-full space-y-6">
                <div className={`relative overflow-hidden rounded-3xl ${heroSolid}
                                 text-white shadow-xl shadow-blue-900/20`}>
                    {/* Two rings bled off the corner. Decoration, so `aria-hidden`
                        and `pointer-events-none` — it must not sit between a
                        reader and the status, in either sense. */}
                    <span aria-hidden className="pointer-events-none absolute -right-20 -top-28
                                                h-[22rem] w-[22rem] rounded-full border border-white/10" />
                    <span aria-hidden className="pointer-events-none absolute -right-40 -top-10
                                                h-[26rem] w-[26rem] rounded-full border border-white/[0.07]" />

                    <div className="relative p-6 lg:p-8">
                        <div className="flex flex-wrap items-start justify-between gap-6">
                            <div className="min-w-0 flex-1">
                                <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/20
                                                 px-3 py-1.5 text-[0.8125rem] font-bold tracking-wide">
                                    {isRejected ? <X className="w-3.5 h-3.5" />
                                        : isApproved ? <BadgeCheck className="w-3.5 h-3.5" />
                                            : <Hourglass className="w-3.5 h-3.5" />}
                                    {application.status || 'Pending'}
                                </span>

                                <h2 className={`${PAGE_TITLE} mt-4`}>
                                    {heroHeadline}
                                </h2>
                                <p className="text-[1.1875rem] text-white/85 mt-1">{heroCaption}</p>
                            </div>

                            {/* The figure was a bare number floating in the top
                                corner with nothing to scale it against. A dial
                                reads as a proportion before the digits are. */}
                            <ProgressDial percent={progress} />
                        </div>

                        {/* ---- the track ---- */}
                        <div className="mt-7 rounded-2xl bg-white/10 ring-1 ring-white/15 p-4 sm:p-5">
                            <p className="text-[0.8125rem] font-bold uppercase tracking-[0.1em] text-white/70">
                                All three reviews run at the same time
                            </p>

                            <div className="mt-4 flex flex-col sm:flex-row items-stretch gap-3">
                                <div className="flex-1 grid grid-cols-3 gap-2 rounded-xl bg-white/10 p-2">
                                    {stages.filter(stage => stage.key !== 'payment').map(stage => (
                                        <TrackNode key={stage.key} stage={stage} />
                                    ))}
                                </div>

                                <span aria-hidden className="hidden sm:flex items-center text-white/40">
                                    <ChevronRight className="w-5 h-5" />
                                </span>

                                <div className="rounded-xl bg-white/10 p-2 sm:w-[10rem]">
                                    {stages.filter(stage => stage.key === 'payment').map(stage => (
                                        <TrackNode key={stage.key} stage={stage} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ---------------- reference strip ---------------- */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_30px_-12px_rgba(16,24,40,0.28)] py-5
                                grid grid-cols-2 lg:grid-cols-4 lg:divide-x divide-[#E8EEF6]">
                    <StripCell
                        label="Application ID"
                        value={formatApplicationRef(application).short || '—'}
                        title={formatApplicationRef(application).full}
                    />
                    <StripCell label="Submitted" value={formatDate(application.createdAt) || '—'} className="border-l lg:border-l-0 border-[#E8EEF6]" />
                    <StripCell
                        label="Member Type"
                        value={applicantKindLabel(application) || '—'}
                        className="border-t lg:border-t-0 border-[#E8EEF6] pt-4 lg:pt-0"
                    />
                    <StripCell
                        label="Region"
                        value={[application.block, application.district].filter(Boolean).join(', ') || '—'}
                        className="border-t border-l lg:border-t-0 lg:border-l-0 border-[#E8EEF6] pt-4 lg:pt-0"
                    />
                </div>

                {/* ---------------- reviewer note on a rejection ---------------- */}
                {isRejected && application.rejectionReason ? (
                    <div className="rounded-2xl bg-[#FEF2F2] border border-[#FECACA] p-5 flex gap-3
                                    shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_30px_-12px_rgba(16,24,40,0.28)]">
                        <span className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0">
                            <AlertTriangle className="w-[1.125rem] h-[1.125rem] text-[#DC2626]" />
                        </span>
                        <div className="min-w-0">
                            <p className="font-display text-[1.1875rem] font-bold text-[#991B1B]">Reviewer Note</p>
                            <p className="text-[1rem] text-[#B91C1C] mt-1 leading-relaxed">
                                {application.rejectionReason}
                            </p>
                        </div>
                    </div>
                ) : null}

                {/* ---------------- timeline + details ----------------
                  *
                  * BOTH COLUMNS OPEN WITH THE SAME CAPTION ELEMENT, so the two
                  * start level. "Review Timeline" used to be a bare line above
                  * the left column while "Applicant" sat INSIDE its card, and
                  * every row down the page was offset from the one beside it.
                  */}
                <div className="grid gap-6 lg:grid-cols-3 items-start">

                    <div className="lg:col-span-2">
                        <SectionCaption>Review timeline</SectionCaption>

                        {/*
                          * ONE CARD, FOUR ROWS — not four cards.
                          *
                          * Each stage used to be its own bordered card with its
                          * own shadow, stacked down the page with the rail
                          * threading between them. Four cards is four of
                          * everything: four borders, four shadows, four sets of
                          * rounded corners and three gaps for the rail to cross —
                          * and the rail crossing a gap is the reason the dots
                          * looked detached from the rows they belonged to. It
                          * also said the wrong thing: four cards read as four
                          * separate objects, and this is ONE application with
                          * four things happening to it.
                          *
                          * So: one surface, rows divided by a hairline, and the
                          * rail running down the inside of it with nothing to
                          * cross. The dot is a flex child rather than an
                          * absolutely-placed one, so it cannot drift out of line
                          * with its own row whatever that row's height.
                          *
                          * `ring-4 ring-white/85` on each dot is what makes the
                          * rail appear to pass BEHIND it rather than through it.
                          */}
                        <div className="bg-white border border-slate-200 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_30px_-12px_rgba(16,24,40,0.28)] overflow-hidden">
                            <div className="relative">
                                {/* Stops short of the first and last dot so the
                                    rail begins and ends on a node, not on the
                                    card's own edge. */}
                                <span aria-hidden className="absolute left-[2.625rem] top-11 bottom-11 w-0.5
                                                            rounded-full bg-slate-200" />

                                {stages.map((stage, i) => {
                                    const tone = TONE[stage.status];
                                    const StageIcon = tone.Icon;
                                    return (
                                        <div
                                            key={stage.key}
                                            className={`relative flex gap-5 px-6 py-6 transition-colors ${
                                                i > 0 ? 'border-t border-slate-100' : ''
                                            } ${stage.active ? 'bg-blue-50/60' : ''}`}
                                        >
                                            {/* The live row, marked on the card's edge.
                                                A full border round one row inside a
                                                shared card would cut it out of the card. */}
                                            {stage.active ? (
                                                <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#1E50E6]" />
                                            ) : null}

                                            <span className={`relative z-10 w-9 h-9 shrink-0 rounded-full ${tone.dot}
                                                              flex items-center justify-center ring-4 ring-white`}>
                                                {stage.active ? (
                                                    <span className={`absolute inset-0 rounded-full ${tone.dot}
                                                                      opacity-30 animate-ping`} />
                                                ) : null}
                                                <StageIcon className="w-4 h-4 text-white relative" strokeWidth={2.5} />
                                            </span>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                                                    <p className="font-display text-[1.25rem] font-bold text-[#0F172A]">
                                                        {stage.name}
                                                    </p>
                                                    {stage.grants ? (
                                                        /* The one row whose approval admits the
                                                           applicant. Without it a green Block row
                                                           reads as "you are in", which it is not. */
                                                        <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[0.8125rem]
                                                                         font-bold text-amber-700 ring-1 ring-amber-200">
                                                            Grants membership
                                                        </span>
                                                    ) : null}
                                                    <span className={`ml-auto shrink-0 rounded-lg px-2.5 py-1
                                                                      text-[0.8125rem] font-extrabold ${tone.soft} ${tone.text}`}>
                                                        {stage.badge || tone.label}
                                                    </span>
                                                </div>

                                                {stage.message ? (
                                                    <p className="text-[1.0625rem] text-[#475569] mt-2 leading-relaxed">
                                                        {stage.message}
                                                    </p>
                                                ) : null}

                                                {stage.reviewer || stage.date ? (
                                                    <div className="flex flex-wrap items-center gap-2 mt-3">
                                                        {stage.reviewer ? (
                                                            <MetaChip icon={<User className="w-3.5 h-3.5" />} text={stage.reviewer} />
                                                        ) : null}
                                                        {stage.date ? (
                                                            <MetaChip icon={<Calendar className="w-3.5 h-3.5" />} text={stage.date} />
                                                        ) : null}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/*
                      * The applicant, beside the timeline rather than under it.
                      *
                      * Mobile stacks this because it has one column; on a desktop
                      * the timeline would otherwise run down the left of an empty
                      * half-screen.
                      */}
                    {/*
                      * NOT STICKY, AND THAT IS THE FIX — not a tuning.
                      *
                      * This column was `lg:sticky lg:top-6`. A sticky element
                      * TALLER THAN THE VIEWPORT pins its own top at the offset
                      * and then never moves again, so everything past the fold
                      * inside it becomes unreachable: scrolling the page slides
                      * the rest of the layout past a column that is standing
                      * still. "What happens next" and the Back to Dashboard
                      * button sat below that line and simply could not be
                      * scrolled to — the card was rendering perfectly and was
                      * impossible to see.
                      *
                      * It only showed up once the column grew, which is what
                      * makes it worth a note: sticky is a bet that the content
                      * stays short, and nothing in the markup enforces that bet.
                      * The timeline is a single card now rather than four, so
                      * the two columns are close in height and sticky was
                      * buying very little to begin with.
                      */}
                    <div>
                        <SectionCaption>Applicant</SectionCaption>

                        <div className="space-y-6">
                            {/* Same surface as the timeline cards beside it — two
                                treatments on one screen is what made the two columns
                                read as two pages. */}
                            <div className="bg-white border border-slate-200 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_30px_-12px_rgba(16,24,40,0.28)] p-6">
                                <div className="space-y-4">
                                    <DetailLine icon={<User className="w-4 h-4" />} label="Full Name"
                                        value={application.fullName || personal.fullName || '—'} />
                                    <DetailLine icon={<Mail className="w-4 h-4" />} label="Email"
                                        value={application.email || personal.email || '—'} />
                                    <DetailLine icon={<Phone className="w-4 h-4" />} label="Phone"
                                        value={application.phone || personal.phoneNumber || personal.phone || '—'} />
                                    <DetailLine icon={<MapPin className="w-4 h-4" />} label="Location"
                                        value={[application.block, application.district, application.state]
                                            .filter(Boolean).join(', ') || '—'} />
                                </div>
                            </div>

                            {/*
                              * WHAT HAPPENS NEXT, AND THE WAY OUT, IN ONE CARD.
                              *
                              * The note was a card and the two buttons were loose
                              * elements under it, so the column ended in a stack of
                              * unrelated rectangles. They are one thing: the note
                              * says what is happening and the buttons are what you
                              * can do about it, and an action belongs with the
                              * sentence that prompts it.
                              *
                              * The actions sit on their own footer band inside the
                              * card — the same arrangement as a dialog, which is
                              * what this is: a statement, then the responses to it.
                              *
                              * The copy is a different sentence in each outcome.
                              * Three timeline rows all say "In Review" and nothing
                              * else on the screen says which one the member is
                              * actually waiting on, or that they are all waiting at
                              * once.
                              */}
                            <div className="bg-white border border-slate-200 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_30px_-12px_rgba(16,24,40,0.28)] overflow-hidden">
                                <div className="p-6">
                                    <div className="flex items-center gap-2">
                                        <span className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                            <Info className="w-4 h-4 text-[#1E50E6]" />
                                        </span>
                                        <p className="font-display text-[1.125rem] font-bold text-[#0F172A]">
                                            What happens next
                                        </p>
                                    </div>
                                    <p className="text-[1.0625rem] text-[#475569] mt-3 leading-relaxed">
                                        {isRejected
                                            ? 'Your application was not approved. The reviewer note above explains why — you can correct your details and speak to your Block Admin.'
                                            : isApproved
                                                ? (isPaid
                                                    ? 'Your membership is active. Your certificate and member directory entry are available from the dashboard.'
                                                    : 'Your State Admin has approved you. Complete the membership payment to activate your account.')
                                                : 'Your Block, District and State Admins each hold your file and are reviewing it at the same time — nobody is queued behind anybody. Only the State Admin\'s approval grants the membership; the other two are recorded as endorsements.'}
                                    </p>
                                </div>

                                {/*
                                  * The footer exists only when there is something in
                                  * it. "Back to Dashboard" has moved to the header, so
                                  * the band holds one conditional button — and an empty
                                  * grey strip under a paragraph reads as a control that
                                  * failed to render rather than as one that does not
                                  * apply.
                                  */}
                                {isApproved && !isPaid ? (
                                    <div className="border-t border-slate-100 bg-slate-50 p-5">
                                        <Button
                                            onClick={() => navigate('/member/payment')}
                                            className="w-full bg-[#1E50E6] hover:bg-[#1a45c9] font-bold h-12 rounded-xl"
                                        >
                                            <CreditCard className="w-4 h-4 mr-2" />
                                            Proceed to Payment
                                        </Button>
                                    </div>
                                ) : null}

                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </MemberPageShell>
    );
}

const StripCell = ({ label, value, className = '', title }: {
    label: string; value: string; className?: string; title?: string;
}) => (
    <div className={`px-4 text-center min-w-0 ${className}`}>
        <p className="text-[0.75rem] font-bold uppercase tracking-[0.06em] text-[#64748B]">{label}</p>
        <p className="font-display text-[1.1875rem] font-bold text-[#0F172A] mt-1 truncate" title={title || value}>
            {value}
        </p>
    </div>
);


const DetailLine = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
    <div className="flex items-start gap-2.5">
        <span className="w-8 h-8 rounded-lg bg-slate-50 text-[#1E50E6] flex items-center
                         justify-center shrink-0">
            {icon}
        </span>
        <div className="min-w-0">
            <p className="text-[0.75rem] font-bold uppercase tracking-[0.06em] text-[#64748B]">{label}</p>
            <p className="text-[1rem] font-medium text-[#0F172A] break-words leading-snug mt-0.5">{value}</p>
        </div>
    </div>
);

/**
 * The caption that opens each column. ONE definition, because the two columns
 * only start level while they are the same element — they were two different
 * ones, in two different places, and the page was visibly stepped.
 */
const SectionCaption = ({ children }: { children: React.ReactNode }) => (
    <p className="font-display text-[1rem] font-extrabold uppercase tracking-[0.08em]
                  text-[#64748B] mb-4 h-5 flex items-center">
        {children}
    </p>
);

/**
 * The completion figure, as a proportion rather than as a number.
 *
 * Pure SVG: a track, an arc, and the digits in the middle. `strokeDasharray`
 * on a circle of radius 42 gives a circumference of 2*PI*42; the offset is
 * what is NOT yet done. `rotate(-90)` starts the arc at twelve o'clock, which
 * is where a reader expects a dial to begin.
 *
 * `currentColor` for the arc so it inherits the hero's white and nothing has
 * to be told which of the three outcome colours the card is wearing.
 */
const ProgressDial = ({ percent }: { percent: number }) => {
    const safe = Math.max(0, Math.min(100, Number(percent) || 0));
    const r = 42;
    const c = 2 * Math.PI * r;
    return (
        <div className="relative shrink-0 w-[6.5rem] h-[6.5rem]">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" aria-hidden>
                <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor"
                        strokeWidth="8" className="opacity-25" />
                <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor"
                        strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={c}
                        strokeDashoffset={c - (c * safe) / 100}
                        className="transition-[stroke-dashoffset] duration-700 ease-out" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center
                             font-display text-[1.5rem] font-extrabold tabular tracking-tight">
                {safe}%
            </span>
        </div>
    );
};

/**
 * One node on the hero track.
 *
 * It carries its own label, so the three review nodes can sit in a grid that
 * groups them without a second array of names to keep in step with `STAGES`.
 */
const TrackNode = ({ stage }: { stage: { short: string; completed: boolean; active: boolean } }) => (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg px-1 py-2.5">
        <span className={`w-6 h-6 rounded-full border-[1.5px] flex items-center justify-center
                          transition-colors ${
            stage.completed
                ? 'bg-white border-white'
                : stage.active
                    ? 'bg-white/60 border-white'
                    : 'bg-white/20 border-white/40'
        }`}>
            {stage.completed ? <Check className="w-3.5 h-3.5 text-[#1E3FA8]" strokeWidth={3} /> : null}
        </span>
        <span className="text-[0.8125rem] font-bold text-white/90 text-center leading-tight">
            {stage.short}
        </span>
    </div>
);

/** A reviewer or a date, as a chip on the card's meta row. */
const MetaChip = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1
                     text-[0.9375rem] font-medium text-[#475569] max-w-full">
        <span className="shrink-0 text-[#94A3B8]">{icon}</span>
        <span className="truncate">{text}</span>
    </span>
);

