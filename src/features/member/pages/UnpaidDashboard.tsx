import { MenuTile } from '@/components/shared/MenuTile';
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    CheckCircle, Clock, FileText, ArrowRight, TrendingUp, ShieldCheck, Sparkles,
    Search, Bell, CreditCard, BadgeCheck, BarChart3,
    CalendarDays, MapPin, Info, AlertTriangle, Users, Mail, Phone, LifeBuoy, Copy, Check,
    Megaphone, MessageSquare, FileBadge, Handshake, Store, Circle,
} from "lucide-react";
import MemberSidebar from "./MemberSidebar";
import { useProfile } from "@/contexts/ProfileContext";
import {
    getMyApplication,
    getMyProfile,
    getRecentActivity,
    deriveApprovalFlags,
    decidedByLabel,
    timelineStageStatus,
    tierDecidedAt,
    tierDecidedByLabel,
    type MemberActivity,
    type TimelineStageStatus,
} from "@/services/activApi";
import { getContactInfo } from "@/services/cmsApi";
import {
    deriveMemberAccess, nextMilestone, applicantKindLabel, formatApplicationRef,
    membershipCta,
} from "@/features/member/memberAccess";
import useMembershipGate from "@/features/member/useMembershipGate";
import MemberTopBar from "@/features/member/components/MemberTopBar";
/*
 * The in-app type scale. Every size and weight on this screen comes from here,
 * so the rest of the member area moves onto the same voice by importing rather
 * than by retyping — the header comment in that file says where the numbers
 * come from (the sign-in screen).
 */
import {
    ACTION_TEXT,
    CARD_BODY,
    CARD_SUBTITLE,
    CARD_TITLE,
    CHIP_TEXT,
    EYEBROW,
    ITEM_BODY,
    ITEM_TITLE,
    META_TEXT,
    PAGE_SUBTITLE,
    PAGE_TITLE,
    SECTION_TITLE,
    STAT_FIGURE,
} from "@/components/layout/appTypography";

/**
 * The dashboard an applicant sees between registering and paying.
 *
 * Its job is to be *readable*. Everything a full membership unlocks is shown
 * here in full, described, and inert: a member who has not activated cannot act
 * on any of it, and the screen says so rather than offering a control that
 * refuses. That distinction matters more than it sounds — a disabled button
 * reads as a bug, while a labelled preview reads as an invitation.
 *
 * Nothing on this page is hardcoded. The completion figure, the review stage,
 * the timeline, the updates feed and the support details all come from live
 * endpoints, so the page reflects the account's real position at every refresh.
 */

/** What a business account gets you, exactly as the mobile card lists it. */
const BUSINESS_BENEFITS = [
    { icon: TrendingUp, title: 'Grow Your Reach', detail: 'Connect with more customers' },
    { icon: ShieldCheck, title: 'Verified & Trusted', detail: 'Build credibility for your business' },
    { icon: Sparkles, title: 'Premium Benefits', detail: 'Unlock exclusive business tools' },
];

/**
 * What becoming a member of the association actually gets you.
 *
 * This replaced a "Pre-Payment Benefits (Draft Features)" panel that listed six
 * things the applicant could already do — a business profile, a draft
 * catalogue, stock, documents. Telling someone what they ALREADY have is not a
 * reason to join anything, and it was the largest panel on a screen whose one
 * job is to turn an applicant into a member.
 *
 * So the list is what activation ADDS, and it leads with the association's own
 * purpose: being connected to the other members. The trading tools come second,
 * because a chamber is a network first and a catalogue afterwards.
 *
 * Still description only — no `onClick`, no `to`, no button per row. There is
 * exactly one control on this card, the one that moves the account forward, and
 * a row that offers a second control the member cannot use would teach them the
 * product is broken.
 */
const MEMBERSHIP_BENEFITS = [
    {
        icon: MessageSquare,
        tone: 'text-blue-600 bg-blue-50',
        title: 'Message any member',
        detail: 'Reach members directly from their directory card.',
    },
    {
        icon: Handshake,
        tone: 'text-indigo-600 bg-indigo-50',
        title: 'Business introductions',
        detail: 'Be introduced to members trading in your own sector.',
    },
    {
        icon: Users,
        tone: 'text-teal-600 bg-teal-50',
        title: 'Listed in the directory',
        detail: 'Your name and business visible to the whole association.',
    },
    {
        icon: CalendarDays,
        tone: 'text-emerald-600 bg-emerald-50',
        title: 'Members-only events',
        detail: 'Conclaves and networking meets held for members alone.',
    },
    {
        icon: Megaphone,
        tone: 'text-amber-600 bg-amber-50',
        title: 'Schemes and tenders',
        detail: 'Notices the association publishes to active members first.',
    },
    {
        icon: FileBadge,
        tone: 'text-rose-600 bg-rose-50',
        title: 'Your certificates',
        detail: 'Membership and tax exemption certificates in your name.',
    },
    {
        icon: Store,
        tone: 'text-orange-600 bg-orange-50',
        title: 'Publish your catalogue',
        detail: 'Put your products in front of every member of the network.',
    },
    {
        icon: BarChart3,
        tone: 'text-purple-600 bg-purple-50',
        title: 'Reach and analytics',
        detail: 'See who is viewing your profile and your catalogue.',
    },
];

/** The three review tiers, in order. Payment is the fourth node, added below. */
/**
 * The progress rail: one review, then the payment.
 *
 * It was three tier nodes — Block, District, State — and a payment node, which
 * is how the workflow used to run. An application now goes to all three admins
 * of the member's own area at once and the first of them to decide decides it,
 * so three nodes could only ever be one node lit and two greyed out for a turn
 * that was never coming, or, after an approval, one lit and two grey forever on
 * a membership that had already been granted.
 *
 * `stateApprovedAt` is the review's date whichever tier signed it — the server
 * stamps that field for every approval so the member screens have one place to
 * read it.
 */
/**
 * The three review tiers, in the order an applicant reads them.
 *
 * Each records their OWN verdict, so these are three different answers rather
 * than three copies of one — which is why they are three nodes again. Only the
 * State's approval grants the membership; `grants` carries that so the copy
 * below does not have to compare against `'state'` in four places.
 */
const TIERS: { key: 'block' | 'district' | 'state'; label: string; grants: boolean }[] = [
    { key: 'block', label: 'Block Admin', grants: false },
    { key: 'district', label: 'District Admin', grants: false },
    { key: 'state', label: 'State Admin', grants: true },
];

const STAGE_CHIP: Record<TimelineStageStatus, { label: string; cls: string }> = {
    approved: { label: 'Approved', cls: 'bg-emerald-100 text-emerald-700' },
    in_progress: { label: 'In Review', cls: 'bg-amber-100 text-amber-700' },
    rejected: { label: 'Returned', cls: 'bg-red-100 text-red-700' },
    pending: { label: 'Pending', cls: 'bg-slate-100 text-slate-500' },
};

const formatDate = (value?: string | null): string => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * The three forms an application is made of.
 *
 * `Financial Details` used to sit between Business and Declaration, and was
 * filtered out of this list for an aspirant. It is asked in the Business
 * Creation Account now — which is not part of the application — so it is gone
 * from here rather than conditionally hidden, and every applicant sees the same
 * three rows.
 */
const PROFILE_FORMS = [
    'Personal Details',
    'Business Details',
    'Declaration',
] as const;

const UnpaidDashboard = () => {
    // The same figure the sidebar badge shows, from the one place that computes
    // it — two independent calculations would disagree the moment either moved.
    const { profileCompletion, formsCompleted, totalFormsRequired, memberType } = useProfile();
    const { isPaid } = useMembershipGate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    const [loading, setLoading] = useState(true);
    const [application, setApplication] = useState<any>(null);
    /* A member outside India — the server's answer, from their phone number. */
    const [abroad, setAbroad] = useState<{ on: boolean; place: string; country: string }>({ on: false, place: '', country: '' });
    const [activity, setActivity] = useState<MemberActivity[]>([]);
    const [contact, setContact] = useState<any>(null);
    // Seeded from storage so a returning member sees their name before the
    // profile call lands; replaced by the database answer either way.
    const [memberName, setMemberName] = useState(() => localStorage.getItem('userName') || '');

    /** The greeting takes the first name only — see the note on the header. */
    const firstName = (memberName || '').split(' ').filter(Boolean)[0] || '';


    /**
     * One load, three independent feeds.
     *
     * `allSettled` rather than `all`: the updates feed and the support details
     * are decoration around the application status, and a failure in either must
     * not blank the part of the page the member actually came for.
     */
    const load = useCallback(async () => {
        const [app, profileRes, acts, info] = await Promise.allSettled([
            getMyApplication(),
            getMyProfile(),
            getRecentActivity(6),
            getContactInfo(),
        ]);

        setApplication(app.status === 'fulfilled' ? app.value : null);
        setActivity(acts.status === 'fulfilled' ? (acts.value || []) : []);
        setContact(info.status === 'fulfilled' ? info.value : null);

        /*
         * The name comes from the profile, not from localStorage.
         *
         * A member who has just registered has never been through `login()`, so
         * nothing has written `userName` — the greeting read the empty string
         * and said "Welcome back, there". The database has known the name since
         * the moment the account existed; this asks it.
         *
         * It is written back to storage because the sidebar and other screens
         * still read that key, so one fetch serves all of them.
         */
        const profile: any = profileRes.status === 'fulfilled' ? profileRes.value : null;
        setAbroad({
            on: profile?.isInternational === true,
            place: String(profile?.place || profile?.city || ''),
            country: String(profile?.country || ''),
        });
        const name = profile?.fullName || '';
        if (name) {
            setMemberName(name);
            try { localStorage.setItem('userName', name); } catch { /* storage unavailable */ }
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        load();

        // Submitting a form or completing a payment changes what belongs on
        // this page. Without these it only refreshed on a full reload.
        window.addEventListener('formSubmitted', load);
        window.addEventListener('profileUpdated', load);
        window.addEventListener('paymentCompleted', load);
        return () => {
            window.removeEventListener('formSubmitted', load);
            window.removeEventListener('profileUpdated', load);
            window.removeEventListener('paymentCompleted', load);
        };
    }, [load]);

    /**
     * Scroll to the section the sidebar asked for.
     *
     * `Application Status` in the rail points at `#application-status` on this
     * page rather than at a separate screen, so the entry and the card it names
     * cannot drift apart. Waiting for `loading` matters: the anchor does not
     * exist while the skeleton is up, and scrolling to a missing element is a
     * silent no-op that reads as a broken menu item.
     */
    useEffect(() => {
        if (loading || !location.hash) return;
        const el = document.getElementById(location.hash.slice(1));
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [loading, location.hash]);

    const access = useMemo(
        () => deriveMemberAccess(profileCompletion, application, isPaid),
        [profileCompletion, application, isPaid],
    );

    const flags = useMemo(() => deriveApprovalFlags(application), [application]);

    /**
     * The one call to action, named for the step this account is actually on.
     *
     * Every locked surface on this page ends in it, so an applicant is never
     * offered "Activate membership" while their application is still in review
     * — that button leads to a payment screen which would refuse them.
     */
    const cta = useMemo(() => membershipCta(access), [access]);

    /**
     * The identifier a member can quote to support.
     *
     * Formatted by `formatApplicationRef`, which every screen that shows this
     * value now shares — the dashboard and the status screen used to format it
     * two different ways from the same `_id`, so one member saw two different
     * "Application ID"s for one application.
     */
    const appRef = useMemo(() => formatApplicationRef(application), [application]);

    /**
     * Aspirant or Business, resolved the way the server resolves it.
     *
     * `memberType` is `undefined` on most rows — the schema gained the field
     * after applications started being written, so Mongoose strict mode dropped
     * it on every create until then. `resolveApplicantKind` looks where the
     * declaration actually survived and falls back to the server's own
     * derivation, so this tile and the admin's queue name the same thing.
     * The profile context's label is the last resort only, because it is
     * computed from "are you doing business" and answers "Standard" for an
     * application that plainly declared otherwise.
     */
    const resolvedMemberType = useMemo(
        () => applicantKindLabel(application) || memberType || 'Applicant',
        [application, memberType],
    );

/**
     * How many of the four stages are behind this applicant: the three tier
     * reviews, then payment.
     *
     * Counted from each tier's own verdict, so a Block approval moves the bar
     * even though it grants nothing — which is the honest picture of progress,
     * and the reason the applicant is shown three rows rather than one.
     */
    /*
     * WHO REVIEWS THIS APPLICATION.
     *
     * Three tiers in India. Outside India there is no block, district or state
     * admin for the file to reach — it goes to the head office alone, and the
     * Super Admin's decision is recorded in the State's seat (it is the one
     * that grants the membership). So the timeline has one review node, read
     * from that seat, instead of two that would stay grey forever.
     */
    const isAbroad = abroad.on || application?.isInternational === true;
    const tiers = useMemo(() => (isAbroad
        ? [{ key: 'state' as const, label: 'ACTIV Head Office', grants: true }]
        : TIERS), [isAbroad]);

    const stagesDone = useMemo(() => {
        if (!application) return 0;
        const reviewed = tiers.filter(t => timelineStageStatus(t.key, application) === 'approved').length;
        return reviewed + (access.membershipActive ? 1 : 0);
    }, [application, access.membershipActive, tiers]);

    const TOTAL_STAGES = tiers.length + 1;
    const overallPercent = useMemo(
        () => Math.round((stagesDone / TOTAL_STAGES) * 100),
        [stagesDone, TOTAL_STAGES],
    );

    /**
     * What is actually happening to the file right now, as a sentence.
     *
     * A NOUN PHRASE THAT READS AS A PLACE, not a tier name. It used to be
     * dropped into "currently under review at the ___ level", which produced
     * "under review at the Ready for Payment level" — a level that is not a
     * level and not under review. The sentence is built here instead, so the
     * words and the state cannot come apart.
     *
     * It does not name one tier as the holder: all three hold it from
     * submission, and only the State's approval admits anybody.
     */
    const currentTier = useMemo(() => {
        if (!application) return '';
        if (access.membershipActive) return 'Your membership is active.';
        if (flags.isRejected) return 'Your application was returned. See the reviewer note below.';
        if (flags.isApproved) return 'Approved by your State Admin. You can now complete the membership payment.';

        const waiting = tiers
            .filter(t => timelineStageStatus(t.key, application) !== 'approved')
            .map(t => t.label);

        if (!waiting.length) return 'All three admins have reviewed your application.';
        return `With your ${waiting.join(', ').replace(/, ([^,]*)$/, ' and $1')}. `
            + 'Your State Admin\u2019s approval is what grants the membership.';
    }, [application, flags, access.membershipActive, tiers]);

    const milestone = nextMilestone(access);

    /**
     * The review timeline, built from the application itself.
     *
     * Not from the activity feed: that records what the *member* did, and this
     * has to show the steps that have not happened yet as well. Each row's state
     * comes from `timelineStageStatus` — the same function
     * `/member/application-status` uses, so the two screens cannot disagree
     * about where a file has got to.
     *
     * A "Forwarded to X" row per tier used to sit above each review row, which
     * was the truth when a file was handed from one tier to the next. It is sent
     * to all three the moment it is submitted, so there is one such row and it
     * is dated with the submission — and then one review row per tier, because
     * each of them answers separately.
     */
    const timeline = useMemo(() => {
        if (!application) return [];

        const submittedAt = application.createdAt || application.submittedAt || null;
        const rows: { title: string; by: string; at: string | null; state: TimelineStageStatus }[] = [
            {
                title: 'Application Submitted',
                by: `by ${memberName || 'you'}`,
                at: submittedAt,
                state: 'approved',
            },
        ];

        rows.push({
            title: 'Sent to your Block, District and State Admin',
            by: 'by System',
            at: submittedAt,
            state: 'approved',
        });
        /*
         * One row per tier, each with its own verdict and its own date.
         *
         * The State's row is the one that admits anybody; the two above it say
         * "approved" without implying the process is over, because the row
         * beneath them is still open.
         */
        tiers.forEach((tier) => {
            const state = timelineStageStatus(tier.key, application);
            rows.push({
                title: state === 'approved'
                    ? `Approved by your ${tier.label}`
                    : state === 'rejected'
                        ? `Returned by your ${tier.label}`
                        : `With your ${tier.label}`,
                by: tierDecidedByLabel(application, tier.key)
                    ? `by ${tierDecidedByLabel(application, tier.key)}`
                    : '',
                at: tierDecidedAt(application, tier.key),
                state,
            });
        });

        rows.push({
            title: access.membershipActive ? 'Membership payment received' : 'Membership payment',
            by: '',
            at: null,
            state: access.membershipActive ? 'approved' : flags.isApproved ? 'in_progress' : 'pending',
        });

        return rows;
    }, [application, flags, memberName, access.membershipActive, tiers]);

    /**
     * What happens next, in the member's own terms.
     *
     * Each row is a plain statement of a step in the process — read, not
     * clicked. The one that is currently true is highlighted, so the panel
     * doubles as "where am I" without needing a second widget for it.
     */
    const WHATS_NEXT = useMemo(() => ([
        {
            icon: Search,
            title: 'Application Under Review',
            detail: 'Your Block, District and State Admin can all see your application '
                + 'from the moment it is submitted, and each records their own decision.',
            active: !!application && !flags.isApproved && !flags.isRejected,
        },
        {
            icon: Bell,
            title: 'You Will Be Notified',
            detail: 'You will receive notifications for every update.',
            active: false,
        },
        {
            icon: CheckCircle,
            title: 'State Admin Approval',
            detail: 'Your Block and District Admin record their view; your State Admin\u2019s '
                + 'approval is what grants the membership and opens the payment step.',
            active: !!application && flags.isApproved && !access.membershipActive,
        },
        {
            icon: CreditCard,
            title: 'Activate Membership',
            detail: 'Complete payment to activate your membership and unlock all benefits.',
            active: access.applicationApproved && !access.membershipActive,
        },
    ]), [application, flags, currentTier, access]);


    /**
     * Support details, from the CMS the site's Contact page already uses.
     *
     * Falls back to nothing rather than to an invented address: a phone number
     * that does not answer is worse than no phone number, and the button below
     * reaches the same team either way.
     */
    const supportHours = (contact?.workingHours || []).filter(Boolean) as string[];
    const supportEmail = contact?.email || '';
    const supportPhone = contact?.phone || '';

    if (loading) {
        return (
            <div className="flex h-screen bg-slate-50">
                <MemberSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-slate-500">Loading your dashboard…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-50">
            <MemberSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            {/*
              * No page header.
              *
              * The mark lives at the top of the rail and the account it belongs
              * to is one click away in My Profile. A second bar repeating both
              * cost a strip of vertical space on every screen and gave the eye
              * two places to look for the same two facts.
              */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                <MenuTile onClick={() => setSidebarOpen(true)} className="fixed top-6 left-4 z-40" />

                {/*
                  THE GREETING IS THE PAGE HEADER, in the white bar every other
                  screen opens with.

                  It used to be the first block of the scrolling content, with
                  the icon strip floating on a row of its own above it. Two
                  consequences, both visible: the dashboard was the one member
                  screen with no header band, and the greeting scrolled away
                  while every other screen's title stayed put.

                  Same bar as `MemberPageShell` and the admin screens — white,
                  `border-b`, sticky, with the icons on the right — so the
                  dashboard now introduces itself the way the rest of the product
                  does.
                */}
                <header className="h-[5.5rem] shrink-0 sticky top-0 z-10 bg-white border-b border-slate-200
                                   px-4 sm:px-6 flex items-center gap-2 sm:gap-3">
                    {/* Clear of the floating menu button below `lg`, where it is
                        pinned to the top-left corner and would otherwise sit
                        across the first word of the greeting. */}
                    <div className="min-w-0 flex-1 pl-11 lg:pl-0">
                        {/*
                          * THE GREETING FITS THE BAR IT IS IN.
                          *
                          * `h-[5.5rem]` is a fixed height, and this was
                          * `text-[2rem]` with no truncation and the member's
                          * WHOLE name in it — "Welcome back, Rajeshwari
                          * Muthukrishnan" wrapped to three lines on a 390px
                          * screen and spilled out of the header over the card
                          * below it. The first name is what a greeting uses
                          * anyway, and the line truncates rather than wrapping,
                          * so no name can break the bar.
                          */}
                        <h1 className={`${PAGE_TITLE} text-slate-900 truncate`}>
                            {/* On a phone the full greeting truncates to
                                "Welcome back, …" and loses the one word on the
                                line that identifies the reader. */}
                            <span className="sm:hidden">
                                {firstName ? `Hi, ${firstName} 👋` : 'Welcome back 👋'}
                            </span>
                            <span className="hidden sm:inline">
                                Welcome back{firstName ? `, ${firstName}` : ''} 👋
                            </span>
                        </h1>
                        <p className={`${PAGE_SUBTITLE} text-slate-500 mt-0.5 truncate`}>
                            {milestone ? "Let's complete your membership journey" : "You're all set."}
                        </p>
                    </div>

                    {/*
                      THE TWO FACTS THAT IDENTIFY THIS APPLICATION LIVE IN THE
                      HEADER BAR.

                      They were a strip of two cards floating in the body, right-
                      aligned above the hero pair — so the first thing under a
                      header that says "Welcome back" was two boxes hanging in
                      space, and they scrolled away the moment the member moved.

                      A reference number and a membership type are not content;
                      they are what this screen IS, the same way the title is.
                      They belong in the band that stays put, beside the greeting
                      and before the icons.

                      From `xl` only — below it the bar has room for the greeting
                      and the two icons and nothing else, so the body strip below
                      still renders at those widths. One or the other, never both.
                    */}
                    {access.applicationSubmitted && (
                        <div className="hidden xl:flex items-center gap-5 shrink-0 mr-1">
                            <HeaderFact
                                icon={<FileText className="h-3.5 w-3.5" />}
                                tone="text-blue-600 bg-blue-50"
                                label="Application ID"
                                value={appRef.short}
                                fullValue={appRef.full}
                                valueTone="text-blue-700"
                            />
                            <span className="w-px h-10 bg-slate-200" aria-hidden />
                            <HeaderFact
                                icon={<BadgeCheck className="h-3.5 w-3.5" />}
                                tone="text-sky-600 bg-sky-50"
                                label="Member Type"
                                value={resolvedMemberType}
                                valueTone="text-sky-700"
                            />
                            <span className="w-px h-10 bg-slate-200" aria-hidden />
                        </div>
                    )}

                    <div className="shrink-0">
                        <MemberTopBar />
                    </div>
                </header>

                <div className="w-full max-w-[110rem] mx-auto p-4 sm:p-6 lg:px-8 space-y-6">

                    {/* ---------- identity tiles, below `xl` only ----------
                        The same two facts the header carries from `xl` up. Not a
                        duplicate on screen: exactly one of the two is ever
                        rendered. */}
                    <div className="xl:hidden flex flex-col lg:flex-row lg:items-center justify-end gap-5">

                        {/*
                          * Nothing here until there is something to show.
                          *
                          * Both tiles describe a submitted application. Rendering
                          * them beforehand meant an empty "Application ID" reading
                          * "Not submitted" beside a "Member Type" the applicant had
                          * not been asked for yet — two facts presented as answers
                          * before either question had been put.
                          */}
                        {access.applicationSubmitted && (
                            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-4 w-full lg:w-[28.75rem] lg:shrink-0">
                                <IdentityTile
                                    icon={<FileText className="h-3.5 w-3.5" />}
                                    tone="text-blue-600 bg-blue-50"
                                    label="Application ID"
                                    value={appRef.short}
                                    fullValue={appRef.full}
                                    valueTone="text-blue-700"
                                />
                                <IdentityTile
                                    icon={<BadgeCheck className="h-3.5 w-3.5" />}
                                    tone="text-sky-600 bg-sky-50"
                                    label="Member Type"
                                    value={resolvedMemberType}
                                    valueTone="text-sky-700"
                                />
                            </div>
                        )}
                    </div>

                    {/* ---------- the two action cards ---------- */}
                    <div className="grid gap-6 lg:grid-cols-2 items-stretch">
                        {/*
                          * Blue while there is still work to do, green once the
                          * application is in.
                          *
                          * The colour is the state. A member who has submitted
                          * has nothing left to complete on this card, and asking
                          * them to "Continue Profile" — or even "View Profile" —
                          * points at the one thing that is finished instead of
                          * the one thing that is now happening.
                          */}
                        <Card className={`text-white overflow-hidden h-full rounded-2xl border-0 shadow-[0_10px_28px_-6px_rgba(16,24,40,0.25)] ${
                            access.applicationSubmitted ? 'bg-emerald-600' : 'bg-blue-600'
                        }`}>
                            <CardContent className="p-5 h-full flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <h2 className={`${CARD_TITLE} mb-3`}>
                                        {access.applicationSubmitted ? 'Profile Complete' : 'Complete Your Profile'}
                                    </h2>
                                    <p className="mb-2.5">
                                        <span className={STAT_FIGURE}>{profileCompletion}%</span>
                                        <span className={`ml-2 ${CARD_BODY} text-white/85`}>completed</span>
                                    </p>

                                    <div className="h-1.5 bg-white/25 rounded-full overflow-hidden mb-3 max-w-[12rem]">
                                        <div
                                            className="h-full bg-white rounded-full transition-all duration-500"
                                            style={{ width: `${profileCompletion}%` }}
                                        />
                                    </div>

                                    {/*
                                      * At 100% the raw form counts stop being the
                                      * story. Submitting locks the forms and the
                                      * figure is 100 by definition, so "2 of 3
                                      * forms done" beside "100% completed" read as
                                      * a contradiction the member could not act on.
                                      */}
                                    <p className={`${CARD_BODY} text-white/85 mb-6`}>
                                        {access.applicationSubmitted
                                            ? 'Your application is submitted and under review.'
                                            : profileCompletion >= 100
                                                ? 'Your profile is complete. Submit to start the review.'
                                                : `${formsCompleted.length} of ${totalFormsRequired} forms done. Unlock all features by completing your profile.`}
                                    </p>

                                    <Button
                                        /*
                                          THREE DESTINATIONS, AND THE MIDDLE ONE WAS A
                                          DEAD END.

                                          At 100% and not yet submitted this went to
                                          `/member/profile-view`, labelled "View Profile" —
                                          while the line directly above it read "Submit to
                                          start the review". That page is a READ-ONLY
                                          record: an "Edit profile" toggle and per-section
                                          edit links, and no submit control of any kind. So
                                          the card named the one action the member had left
                                          and handed them a button that could not do it.

                                          The ONLY "Submit Application" button in the
                                          product is at the foot of STEP 3 of this wizard,
                                          and the dashboard linked to the wizard only while
                                          completion was BELOW 100 — so the route vanished
                                          at exactly the moment it was needed. A member who
                                          saved all three forms sat at 100% with no
                                          Application document, in no admin queue at any
                                          tier, and nothing on any screen they could press
                                          to change it. `/member/forms/declaration` submits
                                          too, but nothing links to it — it is reachable
                                          only by typing the URL.

                                          `?step=3` lands on the declaration step because
                                          `Profile.tsx` honours `?step=` up to the furthest
                                          step reached, and a member at 100% has reached
                                          the last one.

                                          `?step=1` — this button starts the
                                          application, it does not resume it.

                                          Bare `/member/profile` opens at the
                                          first step still needing an answer,
                                          which is right for coming back to
                                          half-finished work and wrong for the
                                          card headed "Complete Your Profile":
                                          a member who has only done Personal
                                          pressed it and landed on Business,
                                          having never been shown the screen the
                                          button names. The three ticks directly
                                          below say which forms are outstanding,
                                          and the rail inside jumps to any step
                                          already reached — so starting at the
                                          top costs nothing and skips nothing.
                                        */
                                        onClick={() => navigate(
                                            access.applicationSubmitted
                                                ? '/member/application-status'
                                                : profileCompletion >= 100
                                                    ? '/member/profile?step=3'
                                                    : '/member/profile?step=1',
                                        )}
                                        size="lg"
                                        className={`bg-white ${ACTION_TEXT} ${
                                            access.applicationSubmitted
                                                ? 'text-emerald-700 hover:bg-emerald-50'
                                                : 'text-blue-600 hover:bg-blue-50'
                                        }`}
                                    >
                                        {access.applicationSubmitted
                                            ? 'View Status'
                                            : profileCompletion >= 100 ? 'Submit Application' : 'Continue Profile'}
                                        <ArrowRight className="ml-1.5 h-4 w-4" />
                                    </Button>

                                    {/*
                                      THE THREE FORMS, TICKED OFF — the profile
                                      card's answer to the business card's three
                                      benefit rows.

                                      The card said "2 of 3 forms done" and left
                                      the rest of its height empty, so the one
                                      question it raises — WHICH two — was
                                      answered on another screen. The same rows
                                      the business card uses: a tinted square, a
                                      title, a line under it.

                                      Read from `formsCompleted`, the list the
                                      percentage is computed from, so the ticks
                                      and the figure above them cannot disagree.
                                    */}
                                    <ul className="mt-5 space-y-2">
                                        {PROFILE_FORMS
                                            .map((form) => {
                                                const done = access.applicationSubmitted
                                                    || formsCompleted.includes(form);

                                                return (
                                                    <li key={form} className="flex items-center gap-2.5">
                                                        <span className={`w-6 h-6 rounded-lg shrink-0 flex items-center
                                                                          justify-center ${
                                                            done ? 'bg-white/25' : 'bg-white/10'
                                                        }`}>
                                                            {done
                                                                ? <Check className="w-3.5 h-3.5 text-white" />
                                                                : <Circle className="w-2.5 h-2.5 text-white/60" />}
                                                        </span>
                                                        <span className={`${ITEM_BODY} ${
                                                            done ? 'font-semibold text-white' : 'text-white/70'
                                                        }`}>
                                                            {form}
                                                        </span>
                                                    </li>
                                                );
                                            })}
                                    </ul>
                                </div>
                                <img
                                    src="/clipboard_3d.png"
                                    alt=""
                                    className="hidden sm:block w-40 md:w-48 lg:w-56 xl:w-64 shrink-0 self-center
                                               object-contain drop-shadow-2xl"
                                />
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-[#1e3a8a] to-[#2563eb] text-white overflow-hidden h-full rounded-2xl border-0 shadow-[0_10px_28px_-6px_rgba(16,24,40,0.25)]">
                            <CardContent className="p-5 h-full flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <h2 className={`${CARD_TITLE} mb-2`}>Your Business Account</h2>
                                    <span className={`inline-block ${CHIP_TEXT} bg-white/25 rounded px-2.5 py-1 mb-4`}>
                                        Draft Mode
                                    </span>
                                    <p className={`${CARD_BODY} text-white/80 mb-5`}>
                                        Start building your business profile, catalogue and manage products
                                        before approval.
                                    </p>
                                    <Button
                                        onClick={() => navigate('/business/create-profile')}
                                        size="lg"
                                        className={`w-full sm:w-auto h-auto min-h-11 whitespace-normal py-3 bg-white text-blue-700 hover:bg-blue-50 ${ACTION_TEXT}`}
                                    >
                                        Manage Business Account
                                        <ArrowRight className="ml-1.5 h-4 w-4" />
                                    </Button>

                                    <div className="mt-6 space-y-3">
                                        {BUSINESS_BENEFITS.map(({ icon: Icon, title, detail }) => (
                                            <div key={title} className="flex items-start gap-3">
                                                <div className="w-8 h-8 rounded bg-white/20 flex items-center
                                                                justify-center shrink-0">
                                                    <Icon className="h-4 w-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className={ITEM_TITLE}>{title}</p>
                                                    <p className={`${ITEM_BODY} text-white/70 mt-1`}>{detail}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <img
                                    src="/briefcase_3d.png"
                                    alt=""
                                    className="hidden sm:block w-40 md:w-48 lg:w-56 xl:w-64 shrink-0 self-center
                                               object-contain drop-shadow-2xl"
                                />
                            </CardContent>
                        </Card>
                    </div>

                    {/* ---------- application status & progress ---------- */}
                    {/*
                      * Always on screen, whatever stage the member is at.
                      *
                      * It was gated on a complete profile, on the argument that a
                      * chain of four Pending nodes is scaffolding rather than
                      * information. That was wrong for the case that matters
                      * most: someone who has just registered wants to know what
                      * the process ahead of them looks like, and hiding the map
                      * until they finish the journey helps nobody. Before an
                      * application exists it shows the four stages waiting and
                      * says so in the timeline.
                      */}
                    <section id="application-status" className="scroll-mt-4">
                        {/*
                          * The card is the way in to the full screen.
                          *
                          * Clicking a summary should open the detail it summarises;
                          * making the member hunt for the one small button in the
                          * corner is the kind of thing that reads as "this is not
                          * clickable". The button stays for people who look for a
                          * button, and stops the click from firing twice.
                          */}
                        <Card
                            role="link"
                            tabIndex={0}
                            onClick={() => navigate('/member/application-status')}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    navigate('/member/application-status');
                                }
                            }}
                            className={`cursor-pointer rounded-2xl border border-slate-200 shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)]
                                        transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_4px_8px_-2px_rgba(16,24,40,0.12),0_16px_32px_-8px_rgba(16,24,40,0.16)]
                                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
                        >
                            {/*
                              THE HEADING BELONGS TO THE CARD, NOT TO THE PAGE.

                              It sat above as a free-floating section title, which
                              is what every other card on this dashboard does NOT
                              do: theirs are inside, in a header row with a rule
                              under it. Outside, the title read as a page section
                              that happened to contain a card, and the card itself
                              opened straight onto a progress bar with nothing
                              naming it.

                              NO ICON TILE HERE. The heading carries this card on
                              its own — a tile beside it would be the third
                              calendar glyph in one header, since the action
                              button already has one, and the point of the tiles
                              elsewhere is to tell cards apart at a glance rather
                              than to decorate every one of them.
                            */}
                            <div className="flex flex-wrap items-start gap-3 p-6 pb-5 border-b border-slate-100">
                                <div className="min-w-0 flex-1">
                                    <h3 className={`${CARD_TITLE} text-slate-900`}>
                                        Application Status &amp; Progress
                                    </h3>
                                    <p className={`${CARD_SUBTITLE} text-slate-500 mt-1`}>
                                        Track your membership approval progress
                                    </p>
                                </div>
                                {/*
                                  * The only route into the dedicated status screen.
                                  * Every other reference to the application — the
                                  * sidebar entry included — lands on this card.
                                  *
                                  * `stopPropagation`, because the card is itself a
                                  * link now that the button lives inside it: without
                                  * it one press would navigate twice.
                                  */}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="shrink-0 gap-1.5 text-[1.1875rem] font-semibold rounded-xl"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate('/member/application-status');
                                    }}
                                >
                                    <CalendarDays className="h-3.5 w-3.5" />
                                    View Full Timeline
                                </Button>
                            </div>

                            <CardContent className="p-6 space-y-6">

                                {/* ---- top: overall progress + the four nodes ----
                                     Tinted rather than outlined: it sits directly under
                                     the header rule now, and a border here would draw a
                                     second line a few pixels below the first. */}
                                <div className="rounded-xl bg-slate-50 p-5">
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                        <div>
                                            <p className={`${SECTION_TITLE} text-slate-800`}>Overall Progress</p>
                                            <p className={`${META_TEXT} text-slate-500 mt-1`}>
                                                {stagesDone} of {TOTAL_STAGES} stages completed
                                            </p>
                                        </div>
                                        <span className="font-display text-[1.5625rem] font-bold text-white bg-blue-600
                                                         rounded-lg px-4 py-2 shrink-0 tabular">
                                            {overallPercent}%
                                        </span>
                                    </div>

                                    <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden mb-8 mt-4">
                                        <div
                                            className="h-full bg-blue-600 rounded-full transition-all duration-500"
                                            style={{ width: `${overallPercent}%` }}
                                        />
                                    </div>

                                    <div className="relative">
                                        {/* The joining line spans an eighth in from each end, which is
                                            where the outer node centres land in a four-column grid. */}
                                        <div className={`hidden sm:block absolute top-5 h-px border-t border-dashed border-slate-300 ${
                                            isAbroad ? 'left-[25%] right-[25%]' : 'left-[12.5%] right-[12.5%]'}`} />
                                        <div className={`relative grid grid-cols-2 gap-y-6 gap-x-2 ${isAbroad ? '' : 'sm:grid-cols-4'}`}>
                                            {tiers.map(tier => (
                                                <StageNode
                                                    key={tier.key}
                                                    label={tier.label}
                                                    state={application
                                                        ? timelineStageStatus(tier.key, application)
                                                        : 'pending'}
                                                    at={formatDate(tierDecidedAt(application, tier.key))}
                                                />
                                            ))}
                                            <StageNode
                                                label="Payment"
                                                state={
                                                    access.membershipActive
                                                        ? 'approved'
                                                        : flags.isApproved
                                                            ? 'in_progress'
                                                            : 'pending'
                                                }
                                                at=""
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* ---- bottom: timeline | current status + corrections ---- */}
                                <div className="grid gap-6 lg:grid-cols-2 items-start">

                                    <div>
                                        <p className={`${SECTION_TITLE} text-slate-800 mb-3`}>Timeline</p>
                                        {!application ? (
                                            <EmptyState
                                                icon={<FileText className="h-5 w-5" />}
                                                title="Not submitted yet"
                                                detail="Complete your profile forms and your application will enter the review chain."
                                            />
                                        ) : (
                                            <ul className="space-y-3">
                                                {timeline.map((row, i) => (
                                                    <li key={`${row.title}-${i}`} className="flex items-start gap-2.5">
                                                        <span className="mt-0.5 shrink-0">
                                                            {row.state === 'approved' ? (
                                                                <CheckCircle className="h-4 w-4 text-blue-600" />
                                                            ) : row.state === 'in_progress' ? (
                                                                <Clock className="h-4 w-4 text-amber-500" />
                                                            ) : row.state === 'rejected' ? (
                                                                <AlertTriangle className="h-4 w-4 text-red-500" />
                                                            ) : (
                                                                <span className="block h-4 w-4 rounded-full border-2 border-slate-200" />
                                                            )}
                                                        </span>
                                                        <span className="flex-1 min-w-0">
                                                            <span className={`block text-[1.25rem] leading-tight ${
                                                                row.state === 'pending'
                                                                    ? 'font-normal text-slate-400'
                                                                    : 'font-semibold text-slate-800'
                                                            }`}>
                                                                {row.title}
                                                            </span>
                                                            {row.by && row.state !== 'pending' && (
                                                                <span className={`block ${META_TEXT} text-slate-400 mt-1`}>
                                                                    {row.by}
                                                                </span>
                                                            )}
                                                        </span>
                                                        <span className={`shrink-0 ${META_TEXT} text-slate-400`}>
                                                            {row.at && row.state !== 'pending'
                                                                ? formatDate(row.at)
                                                                : row.state === 'pending' ? 'Pending' : ''}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}

                                        <div className="mt-4 rounded-xl bg-blue-50 border border-blue-200 px-3 py-2
                                                        flex items-start gap-2">
                                            <Info className="h-3.5 w-3.5 text-blue-600 mt-0.5 shrink-0" />
                                            <p className={`${ITEM_BODY} text-blue-800`}>
                                                You will be notified at each stage of the review process.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="rounded-xl border border-slate-200 bg-white p-5">
                                            <div className="flex items-center justify-between gap-2 mb-2">
                                                <p className={`${SECTION_TITLE} text-slate-800`}>Current Status</p>
                                                <span className={`${CHIP_TEXT} rounded-full px-3 py-1.5 shrink-0 ${
                                                    application
                                                        ? flags.isRejected
                                                            ? 'bg-red-100 text-red-700'
                                                            : 'bg-blue-100 text-blue-700'
                                                        : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                    {application
                                                        ? flags.isRejected ? 'Returned' : 'In Review'
                                                        : 'Not Submitted'}
                                                </span>
                                            </div>

                                            <p className={`${CARD_BODY} text-slate-500 mb-6`}>
                                                {application
                                                    ? currentTier
                                                    : 'Your application has not been submitted yet. It will appear here the moment it is.'}
                                            </p>

                                            <div className="space-y-3">
                                                <DetailRow
                                                    icon={<MapPin className="h-3.5 w-3.5" />}
                                                    label="Location"
                                                    value={(isAbroad
                                                        ? [application?.place || abroad.place, application?.country || abroad.country]
                                                        : [application?.block, application?.district, application?.state])
                                                        .filter(Boolean).join(', ') || '—'}
                                                />
                                                <DetailRow
                                                    icon={<Users className="h-3.5 w-3.5" />}
                                                    label="Member Type"
                                                    value={resolvedMemberType}
                                                />
                                                <DetailRow
                                                    icon={<CalendarDays className="h-3.5 w-3.5" />}
                                                    label="Submitted On"
                                                    value={formatDate(application?.createdAt || application?.submittedAt) || '—'}
                                                />
                                                <DetailRow
                                                    icon={<Clock className="h-3.5 w-3.5" />}
                                                    label="Estimated Time"
                                                    value="2 – 5 Working Days"
                                                />
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </section>

                    {/* ---------- what's next + membership benefits ---------- */}
                    {/*
                      * Two cards, not two halves of one.
                      *
                      * They answer different questions — "what happens to me next"
                      * and "what do I get" — and sharing a frame made the eye read
                      * the second as a continuation of the first. Separate cards
                      * also let each one stack cleanly on a narrow screen instead
                      * of one column collapsing under the other inside a shared
                      * border.
                      */}
                    <div className="grid gap-6 lg:grid-cols-2 items-start">
                        <Card className="h-full rounded-2xl border border-slate-200 shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)]">
                            <CardContent className="p-6">
                                <div>
                                    <h3 className={`${CARD_TITLE} text-slate-900 mb-4`}>What&apos;s Next?</h3>
                                    <ul className="space-y-4">
                                        {WHATS_NEXT.map(({ icon: Icon, title, detail, active }) => (
                                            <li key={title} className="flex items-start gap-4">
                                                <div className={`w-10 h-10 rounded-full flex items-center
                                                                 justify-center shrink-0 ${
                                                    active ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-500'
                                                }`}>
                                                    <Icon className="h-5 w-5" />
                                                </div>
                                                <div className="min-w-0 pt-1.5">
                                                    <p className={`${ITEM_TITLE} ${
                                                        active ? 'text-slate-900' : 'text-slate-700'
                                                    }`}>{title}</p>
                                                    <p className={`${ITEM_BODY} text-slate-500 mt-1.5`}>{detail}</p>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>

                        {/*
                          * What membership unlocks — read only, by design.
                          *
                          * Eight descriptions and exactly one control. This is
                          * the catalogue of what activation buys, and the way to
                          * get any of it is the single button at the foot of the
                          * card. A per-row control that then refuses teaches a
                          * member the product is broken.
                          *
                          * It leads with messaging and introductions because that
                          * is what an association IS — a chamber is a network
                          * first and a set of trading tools second, and an
                          * applicant deciding whether to join is deciding whether
                          * to be connected to the people already in it.
                          */}
                        <Card className="h-full rounded-2xl border border-blue-200 shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)]">
                            <CardContent className="p-6">
                                <div>
                                    <span className={`inline-flex items-center gap-1.5 ${EYEBROW} text-blue-700 bg-blue-50
                                                     rounded-full px-2.5 py-1 mb-3`}>
                                        <Sparkles className="h-3 w-3" /> Membership benefits
                                    </span>

                                    <h3 className={`${CARD_TITLE} text-slate-900`}>
                                        What your membership unlocks
                                    </h3>
                                    <p className={`${CARD_BODY} text-slate-500 mt-2 mb-6`}>
                                        ACTIV is a network before it is anything else. Activating your
                                        membership puts you in touch with every other member — and puts your
                                        business in front of them.
                                    </p>

                                    <div className="grid grid-cols-2 gap-x-5 gap-y-5">
                                        {MEMBERSHIP_BENEFITS.map(({ icon: Icon, tone, title, detail }) => (
                                            <div key={title} className="flex items-start gap-3 min-w-0">
                                                <div className={`w-9 h-9 rounded-lg ${tone} flex items-center
                                                                 justify-center shrink-0 shadow-sm`}>
                                                    <Icon className="h-4 w-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className={`${ITEM_TITLE} text-slate-800`}>
                                                        {title}
                                                    </p>
                                                    <p className={`${ITEM_BODY} text-slate-500 mt-1`}>
                                                        {detail}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/*
                                      * The step this account is actually on.
                                      *
                                      * `membershipCta` never offers "Activate
                                      * membership" to someone whose application has
                                      * not been approved — that button leads to a
                                      * payment screen which would refuse them, and a
                                      * member refused once stops pressing buttons.
                                      */}
                                    <div className="mt-6 pt-5 border-t border-slate-100">
                                        {cta.detail ? (
                                            <p className={`${CARD_BODY} text-slate-500 mb-3`}>
                                                {cta.detail}
                                            </p>
                                        ) : null}
                                        <Button
                                            onClick={() => navigate(cta.to)}
                                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                                        >
                                            {cta.label}
                                            <ArrowRight className="ml-1.5 h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* ---------- recent updates + support ---------- */}
                    <div className="grid gap-6 lg:grid-cols-2 items-start">
                        <Card className="h-full rounded-2xl border border-slate-200 shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)]">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between gap-2 mb-4">
                                    <h3 className={`${CARD_TITLE} text-slate-900`}>Recent Updates</h3>
                                    <button
                                        onClick={() => navigate('/member/application-status')}
                                        className={`${ACTION_TEXT} text-blue-600 hover:underline shrink-0`}
                                    >
                                        View All
                                    </button>
                                </div>

                                {activity.length === 0 ? (
                                    <EmptyState
                                        icon={<Bell className="h-6 w-6" />}
                                        title="Nothing yet"
                                        detail="Updates about your application will appear here."
                                    />
                                ) : (
                                    <ul className="space-y-5">
                                        {activity.slice(0, 3).map(item => (
                                            <li key={item.id} className="flex items-start gap-4">
                                                <div className="w-10 h-10 rounded-md bg-blue-50 text-blue-600
                                                                flex items-center justify-center shrink-0">
                                                    <Bell className="h-5 w-5" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className={`${ITEM_TITLE} text-slate-800 leading-snug`}>
                                                        {item.description}
                                                    </p>
                                                    <p className={`${META_TEXT} text-slate-400 mt-1`}>
                                                        {formatDate(item.at)}
                                                    </p>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>

                        {/*
                          * Support, with the details filled in.
                          *
                          * Hours, address and number come from the same CMS record
                          * the public Contact page renders, so there is one set of
                          * support details on the platform rather than a second copy
                          * here that nobody remembers to update. Each row is omitted
                          * when the CMS has not been given that value.
                          */}
                        <Card className="h-full rounded-2xl bg-blue-50/60 border border-blue-200 shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)]">
                            <CardContent className="p-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <LifeBuoy className="h-5 w-5 text-blue-600" />
                                    <h3 className={`${CARD_TITLE} text-slate-900`}>Need Help?</h3>
                                </div>
                                <p className={`${CARD_BODY} text-slate-500 mb-6`}>
                                    Our support team is here to help you at every step of your membership journey.
                                </p>

                                <div className="space-y-4 mb-6">
                                    {supportHours.length > 0 && (
                                        <SupportRow icon={<Clock className="h-4 w-4" />}>
                                            {supportHours.map(line => (
                                                <span key={line} className="block">{line}</span>
                                            ))}
                                        </SupportRow>
                                    )}
                                    {supportEmail && (
                                        <SupportRow icon={<Mail className="h-4 w-4" />}>
                                            <a href={`mailto:${supportEmail}`} className="hover:underline break-all">
                                                {supportEmail}
                                            </a>
                                        </SupportRow>
                                    )}
                                    {supportPhone && (
                                        <SupportRow icon={<Phone className="h-3.5 w-3.5" />}>
                                            <a href={`tel:${supportPhone}`} className="hover:underline">
                                                {supportPhone}
                                            </a>
                                        </SupportRow>
                                    )}
                                    {supportHours.length === 0 && !supportEmail && !supportPhone && (
                                        <p className={`${ITEM_BODY} text-slate-500`}>
                                            Send us a message and the team will get back to you.
                                        </p>
                                    )}
                                </div>

                                {/*
                                  * A mail link, not a route to `/contact`.
                                  *
                                  * That page belongs to the marketing site: public
                                  * header, onboarding navigation, and a "Register"
                                  * call to action aimed at someone who does not have
                                  * an account. Sending a signed-in member there drops
                                  * them out of the member area to be invited to sign
                                  * up again. `mailto:` reaches the same team without
                                  * leaving the app.
                                  */}
                                {supportEmail ? (
                                    <Button
                                        asChild
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold w-full sm:w-auto"
                                        size="sm"
                                    >
                                        <a href={`mailto:${supportEmail}?subject=${encodeURIComponent(
                                            appRef.full ? `Support request - application ${appRef.full}` : 'Support request',
                                        )}`}>
                                            Email Support
                                            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                                        </a>
                                    </Button>
                                ) : (
                                    <p className={`${ITEM_BODY} text-slate-500`}>
                                        In-app support is coming soon.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* ---------- the single call to action ---------- */}
                    <Card className="rounded-2xl bg-blue-50/70 border border-blue-200 shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)]">
                        <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center gap-5">
                            <img
                                src="/clipboard_3d.png"
                                alt=""
                                className="hidden md:block w-28 lg:w-32 shrink-0 object-contain drop-shadow-lg"
                            />
                            <div className="flex-1 min-w-0">
                                <h3 className={`${CARD_TITLE} text-slate-900`}>
                                    Complete Your Profile &amp; Unlock Full Benefits
                                </h3>
                                <p className={`${CARD_BODY} text-slate-500 mt-1.5`}>
                                    Finish your profile, get verified and access all features designed to grow
                                    your business with ACTIV.
                                </p>
                            </div>
                            <Button
                                /* Step 1 for the same reason as the hero card
                                   above: "Complete Your Profile" opens the
                                   profile, not whichever step is next. */
                                onClick={() => navigate(
                                    access.applicationApproved ? '/member/payment' : '/member/profile?step=1',
                                )}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 shrink-0"
                            >
                                {access.applicationApproved ? 'Activate Membership' : 'Continue Your Journey'}
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

/**
 * `fullValue`, when given, is what the copy button puts on the clipboard.
 *
 * The short reference is the readable one, but the admin queues display the
 * whole `_id`, so the long form has to be one click away rather than lost.
 */
/**
 * One fact, sized for the header band.
 *
 * The same content as `IdentityTile` and deliberately NOT the same shape: a
 * card inside a header bar is a box drawn on a box. Here the icon, the label
 * and the value sit on the bar itself, divided from their neighbour by a rule —
 * which is how the admin header and the reference dashboard present a figure
 * that belongs to the page rather than to its content.
 *
 * The copy button is kept. It is the whole reason the short form is safe to
 * show: a member quoting their reference to support needs the full id, and
 * truncating it without a way to retrieve it would make the tile decorative.
 */
const HeaderFact = ({ icon, tone, label, value, valueTone, fullValue }: {
    icon: React.ReactNode; tone: string; label: string; value: string;
    valueTone: string; fullValue?: string;
}) => {
    const [copied, setCopied] = useState(false);

    const copy = () => {
        if (!fullValue) return;
        navigator.clipboard?.writeText(fullValue)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
            })
            .catch(() => { /* clipboard blocked; the tooltip still shows the value */ });
    };

    return (
        <div className="flex items-center gap-2.5 min-w-0">
            <span className={`w-9 h-9 rounded-xl ${tone} flex items-center justify-center shrink-0`}>
                {icon}
            </span>
            <div className="min-w-0">
                <p className={`${EYEBROW} text-slate-500 leading-none`}>
                    {label}
                </p>
                <div className="flex items-center gap-1.5 mt-1.5 min-w-0">
                    <p title={fullValue || value}
                       className={`font-display font-semibold text-[1.25rem] leading-none truncate ${valueTone}`}>
                        {value}
                    </p>
                    {fullValue ? (
                        <button
                            type="button"
                            onClick={copy}
                            title={`Copy full ID: ${fullValue}`}
                            aria-label="Copy full application ID"
                            className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            {copied
                                ? <Check className="h-3.5 w-3.5 text-emerald-600" />
                                : <Copy className="h-3.5 w-3.5" />}
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

const IdentityTile = ({ icon, tone, label, value, valueTone, fullValue }: {
    icon: React.ReactNode; tone: string; label: string; value: string;
    valueTone: string; fullValue?: string;
}) => {
    const [copied, setCopied] = useState(false);

    const copy = () => {
        if (!fullValue) return;
        navigator.clipboard?.writeText(fullValue)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
            })
            .catch(() => { /* clipboard blocked; the tooltip still shows the value */ });
    };

    return (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
            <div className="flex items-center gap-2 mb-1">
                <span className={`w-8 h-8 rounded-full ${tone} flex items-center justify-center shrink-0`}>
                    {icon}
                </span>
                <span className={`${EYEBROW} text-slate-500`}>{label}</span>
            </div>
            <div className="flex items-center gap-2 min-w-0 mt-1">
                <p title={fullValue || value} className={`font-display font-semibold text-[1.75rem] truncate ${valueTone}`}>
                    {value}
                </p>
                {fullValue ? (
                    <button
                        type="button"
                        onClick={copy}
                        title={`Copy full ID: ${fullValue}`}
                        aria-label="Copy full application ID"
                        className="shrink-0 text-slate-400 hover:text-slate-500 transition-colors"
                    >
                        {copied
                            ? <Check className="h-3.5 w-3.5 text-emerald-600" />
                            : <Copy className="h-3.5 w-3.5" />}
                    </button>
                ) : null}
            </div>
        </div>
    );
};

const StageNode = ({ label, state, at }: { label: string; state: TimelineStageStatus; at: string }) => {
    const chip = STAGE_CHIP[state] || STAGE_CHIP.pending;
    const done = state === 'approved';
    return (
        <div className="text-center">
            <div className={`w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center ring-4 ring-white ${
                done
                    ? 'bg-blue-600 text-white'
                    : state === 'in_progress'
                        ? 'bg-white text-amber-500 border-2 border-amber-400'
                        : state === 'rejected'
                            ? 'bg-red-100 text-red-600'
                            : 'bg-white text-slate-300 border-2 border-slate-200'
            }`}>
                {done ? <CheckCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
            </div>
            <p className={`${ITEM_TITLE} text-slate-800`}>{label}</p>
            <span className={`inline-block mt-2 ${CHIP_TEXT} rounded px-2.5 py-1 ${chip.cls}`}>
                {chip.label}
            </span>
            {at && <p className={`${META_TEXT} text-slate-400 mt-2`}>{at}</p>}
        </div>
    );
};

const DetailRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
    <div className="flex items-start gap-2.5">
        <span className="text-blue-600 mt-0.5 shrink-0">{icon}</span>
        <div className="min-w-0">
            <p className={`${ITEM_TITLE} text-slate-700`}>{label}</p>
            <p className={`${CARD_BODY} text-slate-500 break-words mt-1.5`}>{value}</p>
        </div>
    </div>
);

const SupportRow = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
    <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-md bg-white text-blue-600 flex items-center
                         justify-center shrink-0 border border-blue-100">
            {icon}
        </span>
        <div className={`min-w-0 ${CARD_BODY} text-slate-700 pt-2`}>{children}</div>
    </div>
);

const EmptyState = ({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) => (
    <div className="text-center py-8">
        <div className="w-12 h-12 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            {icon}
        </div>
        <p className={`${ITEM_TITLE} text-slate-700`}>{title}</p>
        <p className={`${ITEM_BODY} text-slate-500 mt-1 max-w-[13.75rem] mx-auto`}>{detail}</p>
    </div>
);

export default UnpaidDashboard;
