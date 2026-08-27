import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    Menu, CheckCircle, Clock, FileText, ArrowRight, TrendingUp, ShieldCheck, Sparkles,
    Search, Bell, CreditCard, BadgeCheck, Building2, BookOpen, BarChart3,
    CalendarDays, MapPin, Info, AlertTriangle, Users, Mail, Phone, LifeBuoy, Copy, Check,
} from "lucide-react";
import MemberSidebar from "./MemberSidebar";
import { useProfile } from "@/contexts/ProfileContext";
import {
    getMyApplication,
    getMyProfile,
    getRecentActivity,
    deriveApprovalFlags,
    timelineStageStatus,
    type MemberActivity,
    type TimelineStageStatus,
} from "@/services/activApi";
import { getContactInfo } from "@/services/cmsApi";
import { deriveMemberAccess, nextMilestone, applicantKindLabel, formatApplicationRef } from "@/features/member/memberAccess";
import useMembershipGate from "@/features/member/useMembershipGate";

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
 * The features that arrive with an active membership.
 *
 * Presented as description only — no `onClick`, no `to`, no button. A member
 * reads what each one is; wanting it is the reason to activate. Giving these
 * controls that then refuse would teach the member that the product is broken.
 */
const PRE_PAYMENT_FEATURES = [
    { icon: Building2, tone: 'text-purple-600 bg-purple-50', title: 'Business Profile', detail: 'Add logo, company details and description.' },
    { icon: BookOpen, tone: 'text-emerald-600 bg-emerald-50', title: 'Catalogue (Draft)', detail: 'Add your products and services to your catalogue.' },
    { icon: BarChart3, tone: 'text-orange-600 bg-orange-50', title: 'Stock Management', detail: 'Add stock details and manage inventory.' },
    { icon: FileText, tone: 'text-blue-600 bg-blue-50', title: 'Documents', detail: 'Upload business documents and certificates.' },
    { icon: Search, tone: 'text-teal-600 bg-teal-50', title: 'Analytics (Preview)', detail: 'Track preview of profile and catalogue views.' },
    { icon: Bell, tone: 'text-rose-600 bg-rose-50', title: 'Events & Updates', detail: 'Stay updated with events and announcements.' },
];

/** The three review tiers, in order. Payment is the fourth node, added below. */
const TIERS: { key: 'block' | 'district' | 'state'; label: string; at: string }[] = [
    { key: 'block', label: 'Block Admin', at: 'blockApprovedAt' },
    { key: 'district', label: 'District Admin', at: 'districtApprovedAt' },
    { key: 'state', label: 'State Admin', at: 'stateApprovedAt' },
];

const STAGE_CHIP: Record<TimelineStageStatus, { label: string; cls: string }> = {
    approved: { label: 'Approved', cls: 'bg-emerald-100 text-emerald-700' },
    in_progress: { label: 'In Review', cls: 'bg-amber-100 text-amber-700' },
    rejected: { label: 'Returned', cls: 'bg-red-100 text-red-700' },
    pending: { label: 'Pending', cls: 'bg-gray-100 text-gray-500' },
};

const formatDate = (value?: string | null): string => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

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
    const [activity, setActivity] = useState<MemberActivity[]>([]);
    const [contact, setContact] = useState<any>(null);
    // Seeded from storage so a returning member sees their name before the
    // profile call lands; replaced by the database answer either way.
    const [memberName, setMemberName] = useState(() => localStorage.getItem('userName') || '');

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
     * The identifier a member can quote to support.
     *
     * Formatted by `formatApplicationRef`, which every screen that shows this
     * value now shares — the dashboard and the status screen used to format it
     * two different ways from the same `_id`, so one member saw two different
     * "Application ID"s for one application.
     */
    const appRef = useMemo(() => formatApplicationRef(application), [application]);

    /**
     * Aspirant or Business Applicant, resolved the way the server resolves it.
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

    /** How many of the four stages are behind this application. */
    const stagesDone = useMemo(() => {
        if (!application) return 0;
        const approvals = [flags.isBlockApproved, flags.isDistrictApproved, flags.isStateApproved]
            .filter(Boolean).length;
        return approvals + (access.membershipActive ? 1 : 0);
    }, [application, flags, access.membershipActive]);

    const overallPercent = useMemo(() => Math.round((stagesDone / 4) * 100), [stagesDone]);

    /** The tier the file is sitting with right now. */
    const currentTier = useMemo(() => {
        if (!application) return '';
        if (access.membershipActive) return 'Active Member';
        if (flags.isStateApproved) return 'Ready for Payment';
        if (flags.isDistrictApproved) return 'State Admin';
        if (flags.isBlockApproved) return 'District Admin';
        return 'Block Admin';
    }, [application, flags, access.membershipActive]);

    const milestone = nextMilestone(access);

    /**
     * The review timeline, built from the application itself.
     *
     * Not from the activity feed: that records what the *member* did, and this
     * has to show the steps that have not happened yet as well. Each tier
     * contributes a "forwarded to" and an "under review by" row, and each row's
     * state comes from `timelineStageStatus` — the same function
     * `/member/application-status` uses, so the two screens cannot disagree
     * about where a file has got to.
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

        TIERS.forEach((tier, i) => {
            const previousDone = i === 0
                ? true
                : [flags.isBlockApproved, flags.isDistrictApproved][i - 1];

            rows.push({
                title: `Forwarded to ${tier.label}`,
                by: 'by System',
                at: i === 0 ? submittedAt : (application as any)[TIERS[i - 1].at] || null,
                state: previousDone ? 'approved' : 'pending',
            });
            rows.push({
                title: `Under Review by ${tier.label}`,
                by: '',
                at: (application as any)[tier.at] || null,
                state: timelineStageStatus(tier.key, application),
            });
        });

        rows.push({
            title: 'Final Approval & Ready for Payment',
            by: '',
            at: application.stateApprovedAt || null,
            state: flags.isStateApproved ? 'approved' : 'pending',
        });

        return rows;
    }, [application, flags, memberName]);

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
            detail: `${currentTier || 'Block Admin'} is reviewing your application and documents.`,
            active: !!application && !flags.isStateApproved && !flags.isRejected,
        },
        {
            icon: Bell,
            title: 'You Will Be Notified',
            detail: 'You will receive notifications for every update.',
            active: false,
        },
        {
            icon: CheckCircle,
            title: 'Final Approval',
            detail: 'Once approved by State Admin, you can proceed to payments.',
            active: !!application && flags.isStateApproved && !access.membershipActive,
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
            <div className="flex h-screen bg-gray-50">
                <MemberSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-gray-600">Loading your dashboard…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-gray-50">
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
                <button
                    className="lg:hidden fixed top-3 left-3 z-40 p-2 rounded-lg bg-white shadow border"
                    onClick={() => setSidebarOpen(true)}
                    aria-label="Open menu"
                >
                    <Menu className="h-5 w-5" />
                </button>

                <div className="mx-auto w-full max-w-[1440px] px-6 lg:px-10 py-6 space-y-7">

                    {/* ---------- greeting + identity ---------- */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                        {/*
                          * Clear of the floating menu button below `lg`, where it
                          * is pinned to the top-left corner and would otherwise sit
                          * across the first word of the greeting.
                          */}
                        <div className="min-w-0 pl-11 lg:pl-0">
                            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                                Welcome back{memberName ? `, ${memberName}` : ''} 👋
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">
                                {milestone ? "Let's complete your membership journey" : "You're all set."}
                            </p>
                        </div>

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
                            <div className="grid grid-cols-2 gap-4 w-full lg:w-[460px] lg:shrink-0">
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
                                    tone="text-purple-600 bg-purple-50"
                                    label="Member Type"
                                    value={resolvedMemberType}
                                    valueTone="text-purple-700"
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
                        <Card className={`text-white shadow-lg overflow-hidden h-full border-0 ${
                            access.applicationSubmitted ? 'bg-emerald-600' : 'bg-blue-600'
                        }`}>
                            <CardContent className="p-7 h-full flex items-center justify-between gap-5">
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-xl font-bold mb-4">
                                        {access.applicationSubmitted ? 'Profile Complete' : 'Complete Your Profile'}
                                    </h2>
                                    <p className="mb-3">
                                        <span className="font-display font-extrabold text-4xl tabular">{profileCompletion}%</span>
                                        <span className="ml-2 text-sm text-white/85">completed</span>
                                    </p>

                                    <div className="h-1.5 bg-white/25 rounded-full overflow-hidden mb-4 max-w-[220px]">
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
                                    <p className="text-white/85 mb-5 text-xs leading-snug font-medium">
                                        {access.applicationSubmitted
                                            ? 'Your application is submitted and under review.'
                                            : profileCompletion >= 100
                                                ? 'Your profile is complete. Submit to start the review.'
                                                : `${formsCompleted.length} of ${totalFormsRequired} forms done. Unlock all features by completing your profile.`}
                                    </p>

                                    <Button
                                        onClick={() => navigate(
                                            access.applicationSubmitted
                                                ? '/member/application-status'
                                                : profileCompletion >= 100
                                                    ? '/member/profile-view'
                                                    : '/member/profile',
                                        )}
                                        size="sm"
                                        className={`bg-white font-bold ${
                                            access.applicationSubmitted
                                                ? 'text-emerald-700 hover:bg-emerald-50'
                                                : 'text-blue-600 hover:bg-blue-50'
                                        }`}
                                    >
                                        {access.applicationSubmitted
                                            ? 'View Status'
                                            : profileCompletion >= 100 ? 'View Profile' : 'Continue Profile'}
                                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                                    </Button>
                                </div>
                                <img
                                    src="/clipboard_3d.png"
                                    alt=""
                                    className="hidden sm:block w-32 md:w-36 lg:w-44 xl:w-48 shrink-0 self-center
                                               object-contain drop-shadow-2xl"
                                />
                            </CardContent>
                        </Card>

                        <Card className="bg-purple-700 text-white shadow-lg overflow-hidden h-full border-0">
                            <CardContent className="p-7 h-full flex items-start justify-between gap-5">
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-xl font-extrabold tracking-tight mb-2">Your Business Account</h2>
                                    <span className="inline-block text-[10px] font-semibold bg-white/25
                                                     rounded px-2 py-0.5 mb-3">
                                        Draft Mode
                                    </span>
                                    <p className="text-white/80 mb-4 text-xs leading-snug">
                                        Start building your business profile, catalogue and manage products
                                        before approval.
                                    </p>
                                    <Button
                                        onClick={() => navigate('/business/create-profile')}
                                        size="sm"
                                        className="bg-white text-purple-700 hover:bg-purple-50 font-semibold"
                                    >
                                        Manage Business Account
                                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                                    </Button>

                                    <div className="mt-4 space-y-2">
                                        {BUSINESS_BENEFITS.map(({ icon: Icon, title, detail }) => (
                                            <div key={title} className="flex items-start gap-2">
                                                <div className="w-6 h-6 rounded bg-white/20 flex items-center
                                                                justify-center shrink-0">
                                                    <Icon className="h-3 w-3" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-[11px] leading-tight">{title}</p>
                                                    <p className="text-white/70 text-[10px] leading-tight">{detail}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <img
                                    src="/briefcase_3d.png"
                                    alt=""
                                    className="hidden sm:block w-32 md:w-36 lg:w-44 xl:w-48 shrink-0 self-center
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
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <h3 className="text-lg font-extrabold text-gray-900 tracking-tight">
                                    Application Status &amp; Progress
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    Track your membership approval progress
                                </p>
                            </div>
                            {/*
                              * The only route into the dedicated status screen.
                              * Every other reference to the application — the
                              * sidebar entry included — lands on this card.
                              */}
                            <Button
                                variant="outline"
                                size="sm"
                                className="shrink-0 gap-1.5 text-xs"
                                onClick={() => navigate('/member/application-status')}
                            >
                                <CalendarDays className="h-3.5 w-3.5" />
                                View Full Timeline
                            </Button>
                        </div>

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
                            className="cursor-pointer transition-shadow hover:shadow-md
                                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                            <CardContent className="p-6 sm:p-7 space-y-6">

                                {/* ---- top: overall progress + the four nodes ---- */}
                                <div className="rounded-lg border bg-gray-50/60 p-4">
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                        <div>
                                            <p className="font-display text-sm font-extrabold text-gray-800">Overall Progress</p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {stagesDone} of 4 stages completed
                                            </p>
                                        </div>
                                        <span className="font-display text-sm font-extrabold text-white bg-blue-600
                                                         rounded-lg px-3 py-1.5 shrink-0 tabular">
                                            {overallPercent}%
                                        </span>
                                    </div>

                                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-8">
                                        <div
                                            className="h-full bg-blue-600 rounded-full transition-all duration-500"
                                            style={{ width: `${overallPercent}%` }}
                                        />
                                    </div>

                                    <div className="relative">
                                        {/* The joining line only makes sense when all four sit in a row. */}
                                        <div className="hidden sm:block absolute left-[12.5%] right-[12.5%] top-4 h-px
                                                        border-t border-dashed border-gray-300" />
                                        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-y-6 gap-x-2">
                                            {TIERS.map(tier => (
                                                <StageNode
                                                    key={tier.key}
                                                    label={tier.label}
                                                    state={application
                                                        ? timelineStageStatus(tier.key, application)
                                                        : 'pending'}
                                                    at={formatDate((application as any)?.[tier.at])}
                                                />
                                            ))}
                                            <StageNode
                                                label="Ready for Payment"
                                                state={
                                                    access.membershipActive
                                                        ? 'approved'
                                                        : flags.isStateApproved
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
                                        <p className="font-display text-sm font-extrabold text-gray-800 mb-3">Timeline</p>
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
                                                                <span className="block h-4 w-4 rounded-full border-2 border-gray-200" />
                                                            )}
                                                        </span>
                                                        <span className="flex-1 min-w-0">
                                                            <span className={`block text-sm leading-tight ${
                                                                row.state === 'pending'
                                                                    ? 'text-gray-400'
                                                                    : 'font-semibold text-gray-800'
                                                            }`}>
                                                                {row.title}
                                                            </span>
                                                            {row.by && row.state !== 'pending' && (
                                                                <span className="block text-[11px] text-gray-400 mt-1">
                                                                    {row.by}
                                                                </span>
                                                            )}
                                                        </span>
                                                        <span className="shrink-0 text-[11px] text-gray-400 font-medium">
                                                            {row.at && row.state !== 'pending'
                                                                ? formatDate(row.at)
                                                                : row.state === 'pending' ? 'Pending' : ''}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}

                                        <div className="mt-4 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2
                                                        flex items-start gap-2">
                                            <Info className="h-3.5 w-3.5 text-blue-600 mt-0.5 shrink-0" />
                                            <p className="text-[11px] text-blue-800 leading-snug">
                                                You will be notified at each stage of the review process.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="rounded-lg border bg-gray-50/60 p-4">
                                            <div className="flex items-center justify-between gap-2 mb-2">
                                                <p className="font-display text-sm font-extrabold text-gray-800">Current Status</p>
                                                <span className={`text-[11px] font-bold rounded-full px-2.5 py-1 shrink-0 ${
                                                    application
                                                        ? flags.isRejected
                                                            ? 'bg-red-100 text-red-700'
                                                            : 'bg-blue-100 text-blue-700'
                                                        : 'bg-gray-100 text-gray-500'
                                                }`}>
                                                    {application
                                                        ? flags.isRejected ? 'Returned' : 'In Review'
                                                        : 'Not Submitted'}
                                                </span>
                                            </div>

                                            <p className="text-xs text-gray-600 leading-relaxed mb-5">
                                                {application ? (
                                                    <>
                                                        Your application is currently under review at the{' '}
                                                        <span className="font-semibold text-blue-700">{currentTier}</span>{' '}
                                                        level.
                                                    </>
                                                ) : (
                                                    'Your application has not been submitted yet. It will appear here the moment it is.'
                                                )}
                                            </p>

                                            <div className="space-y-3">
                                                <DetailRow
                                                    icon={<MapPin className="h-3.5 w-3.5" />}
                                                    label="Location"
                                                    value={[application?.block, application?.district, application?.state]
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

                    {/* ---------- what's next + pre-payment benefits ---------- */}
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
                        <Card className="h-full">
                            <CardContent className="p-6 sm:p-7">
                                <div>
                                    <h3 className="text-base font-extrabold text-gray-900 tracking-tight mb-4">What&apos;s Next?</h3>
                                    <ul className="space-y-4">
                                        {WHATS_NEXT.map(({ icon: Icon, title, detail, active }) => (
                                            <li key={title} className="flex items-start gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center
                                                                 justify-center shrink-0 ${
                                                    active ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-500'
                                                }`}>
                                                    <Icon className="h-3.5 w-3.5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className={`text-xs font-bold leading-tight ${
                                                        active ? 'text-blue-700' : 'text-gray-800'
                                                    }`}>
                                                        {title}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                                        {detail}
                                                    </p>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>

                        {/*
                          * Pre-payment benefits — read only, by design.
                                  *
                                  * Six descriptions and not one control. This is the
                                  * catalogue of what activation buys, and the way to get
                                  * any of it is the single CTA at the foot of the page. A
                                  * control that refuses teaches a member the product is
                          * broken.
                          */}
                        <Card className="h-full">
                            <CardContent className="p-6 sm:p-7">
                                <div>
                                    <h3 className="text-base font-extrabold text-gray-900 tracking-tight">
                                        Pre-Payment Benefits{' '}
                                        <span className="text-sm font-medium text-gray-400">(Draft Features)</span>
                                    </h3>
                                    <p className="text-xs text-gray-500 mt-1.5 mb-5 leading-relaxed">
                                        Start building your business profile and catalogue. All data is private
                                        until your membership is activated.
                                    </p>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                                        {PRE_PAYMENT_FEATURES.map(({ icon: Icon, tone, title, detail }) => (
                                            <div key={title} className="text-center">
                                                <div className={`w-9 h-9 rounded-lg ${tone} flex items-center
                                                                 justify-center mx-auto mb-2`}>
                                                    <Icon className="h-4 w-4" />
                                                </div>
                                                <p className="text-xs font-bold text-gray-800 leading-tight">
                                                    {title}
                                                </p>
                                                <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                                                    {detail}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* ---------- recent updates + support ---------- */}
                    <div className="grid gap-6 lg:grid-cols-2 items-start">
                        <Card className="h-full">
                            <CardContent className="p-6 sm:p-7">
                                <div className="flex items-center justify-between gap-2 mb-4">
                                    <h3 className="text-base font-extrabold text-gray-900 tracking-tight">Recent Updates</h3>
                                    <button
                                        onClick={() => navigate('/member/application-status')}
                                        className="text-[11px] font-semibold text-blue-600 hover:underline shrink-0"
                                    >
                                        View All
                                    </button>
                                </div>

                                {activity.length === 0 ? (
                                    <EmptyState
                                        icon={<Bell className="h-5 w-5" />}
                                        title="Nothing yet"
                                        detail="Updates about your application will appear here."
                                    />
                                ) : (
                                    <ul className="space-y-4">
                                        {activity.slice(0, 3).map(item => (
                                            <li key={item.id} className="flex items-start gap-3">
                                                <div className="w-9 h-9 rounded-md bg-blue-50 text-blue-600
                                                                flex items-center justify-center shrink-0">
                                                    <Bell className="h-4 w-4" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-semibold text-gray-800 leading-snug">
                                                        {item.description}
                                                    </p>
                                                    <p className="text-[10px] text-gray-400 mt-1">
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
                        <Card className="h-full bg-blue-50/60 border-blue-100">
                            <CardContent className="p-6 sm:p-7">
                                <div className="flex items-center gap-2 mb-1">
                                    <LifeBuoy className="h-4 w-4 text-blue-600" />
                                    <h3 className="text-base font-extrabold text-gray-900 tracking-tight">Need Help?</h3>
                                </div>
                                <p className="text-xs text-gray-600 leading-relaxed mb-5">
                                    Our support team is here to help you at every step of your membership journey.
                                </p>

                                <div className="space-y-3 mb-5">
                                    {supportHours.length > 0 && (
                                        <SupportRow icon={<Clock className="h-3.5 w-3.5" />}>
                                            {supportHours.map(line => (
                                                <span key={line} className="block">{line}</span>
                                            ))}
                                        </SupportRow>
                                    )}
                                    {supportEmail && (
                                        <SupportRow icon={<Mail className="h-3.5 w-3.5" />}>
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
                                        <p className="text-[11px] text-gray-500">
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
                                    <p className="text-[11px] text-gray-500 font-medium">
                                        In-app support is coming soon.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* ---------- the single call to action ---------- */}
                    <Card className="bg-blue-50/70 border-blue-100">
                        <CardContent className="p-6 sm:p-7 flex flex-col md:flex-row items-start md:items-center gap-5">
                            <img
                                src="/clipboard_3d.png"
                                alt=""
                                className="hidden md:block w-20 lg:w-24 shrink-0 object-contain drop-shadow-lg"
                            />
                            <div className="flex-1 min-w-0">
                                <h3 className="text-base font-extrabold text-gray-900 tracking-tight">
                                    Complete Your Profile &amp; Unlock Full Benefits
                                </h3>
                                <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">
                                    Finish your profile, get verified and access all features designed to grow
                                    your business with ACTIV.
                                </p>
                            </div>
                            <Button
                                onClick={() => navigate(
                                    access.applicationApproved ? '/member/payment' : '/member/profile',
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
        <div className="rounded-xl border bg-white px-5 py-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
                <span className={`w-6 h-6 rounded-full ${tone} flex items-center justify-center shrink-0`}>
                    {icon}
                </span>
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
                <p title={fullValue || value} className={`font-display font-extrabold text-base truncate ${valueTone}`}>
                    {value}
                </p>
                {fullValue ? (
                    <button
                        type="button"
                        onClick={copy}
                        title={`Copy full ID: ${fullValue}`}
                        aria-label="Copy full application ID"
                        className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
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
            <div className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center ring-4 ring-white ${
                done
                    ? 'bg-blue-600 text-white'
                    : state === 'in_progress'
                        ? 'bg-white text-amber-500 border-2 border-amber-400'
                        : state === 'rejected'
                            ? 'bg-red-100 text-red-600'
                            : 'bg-white text-gray-300 border-2 border-gray-200'
            }`}>
                {done ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-3.5 w-3.5" />}
            </div>
            <p className="text-xs font-bold text-gray-800 leading-tight">{label}</p>
            <span className={`inline-block mt-1.5 text-[10px] font-bold rounded px-2 py-0.5 ${chip.cls}`}>
                {chip.label}
            </span>
            {at && <p className="text-[10px] text-gray-400 mt-1.5">{at}</p>}
        </div>
    );
};

const DetailRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
    <div className="flex items-start gap-2">
        <span className="text-blue-600 mt-0.5 shrink-0">{icon}</span>
        <div className="min-w-0">
            <p className="text-[11px] font-bold text-gray-700 leading-tight">{label}</p>
            <p className="text-xs text-gray-600 break-words leading-snug mt-1 font-medium">{value}</p>
        </div>
    </div>
);

const SupportRow = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
    <div className="flex items-start gap-2.5">
        <span className="w-7 h-7 rounded-md bg-white text-blue-600 flex items-center
                         justify-center shrink-0 border border-blue-100">
            {icon}
        </span>
        <div className="min-w-0 text-xs text-gray-700 leading-snug pt-1 font-medium">{children}</div>
    </div>
);

const EmptyState = ({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) => (
    <div className="text-center py-8">
        <div className="w-10 h-10 rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-2">
            {icon}
        </div>
        <p className="text-xs font-semibold text-gray-700">{title}</p>
        <p className="text-[10px] text-gray-500 mt-1 max-w-[220px] mx-auto leading-snug">{detail}</p>
    </div>
);

export default UnpaidDashboard;
