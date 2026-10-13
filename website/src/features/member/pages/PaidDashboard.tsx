import { membershipValidityLabel } from '@/lib/membershipDates';
import { useEventClock } from '@/lib/useEventClock';
import DashboardMembership, { DashboardMembershipReview } from '../components/DashboardMembership';
import DashboardWelcome from '../components/DashboardWelcome';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RenewalBanner from '@/features/member/components/RenewalBanner';
import { readRenewal } from '@/features/member/useRenewal';
import {
    ArrowRight, BadgeCheck, Briefcase, CalendarDays, CalendarPlus, ChevronRight, Clock, CreditCard, Crown, FileText, FolderOpen, History, MapPin, Megaphone, Package, ReceiptText, ShieldCheck, Sparkles, Sun, User, UserCircle, UserCog, Users, Zap,
} from 'lucide-react';
import MemberPageShell from '@/pages/member/MemberPageShell';
import {
    SectionCard, EmptyState, RowsSkeleton,
} from '@/features/member/components/MemberUI';
import { isPast } from '@/features/member/components/eventFormat';
import {
    getRecentActivity, getMyProfile, getBusinessInfo, getMyApplication, getMyCompanies,
    type MemberActivity,
} from '@/services/activApi';
import { resolveMediaUrl } from '@/config/api.config';
/* One formatter for the application reference, so this card and the
   Application Status screen cannot print different numbers. */
import { formatApplicationRef } from '@/lib/applicationRef';
import { isPlatinumProfile } from '@/components/shared/Platinum';
import { MemberAvatar } from '@/features/member/memberPhoto';

import {
    listAnnouncements, listMemberEvents,
    type Announcement, type MemberEvent,
} from '@/services/memberHubApi';
import {
    resolveApplicantKind, resolvePlan, planLabel,
    type MemberPlan,
} from '@/features/member/memberAccess';
import { memberEventPath } from '@/lib/eventPath';

/**
 * The dashboard a member sees once their payment has been recorded.
 *
 * ==========================================================================
 * THE MEMBERSHIP CARD, AND THEN ONLY WHAT IS ACTUALLY THERE
 * ==========================================================================
 *
 * The card says what kind of membership this is. Below it, a section appears
 * when it has something to show and is simply absent when it does not.
 *
 *   Association Updates  — what the association has told them (MEM-001)
 *   Quick actions        — the four places a member goes most
 *   Business suite       — how their catalogue is doing (BUS-001…004)
 *   Official documents   — certificate and receipts
 *   Recent Activity      — what has happened on the account
 *
 * WHAT WAS TAKEN OFF IT: the four "at a glance" tiles and the Upcoming Events
 * card.
 *
 * The tiles because three of the four read `0` on a healthy account — Updates
 * 0, Profile views 0 — so the first thing the screen said about a member's
 * association was a row of zeroes, and the fourth was a Directory tile whose
 * VALUE was the word "Search", which is a link wearing a statistic's clothes.
 *
 * Events because the association asked for them off this screen. They have a
 * screen of their own, reachable from the sidebar and from Quick actions, and
 * the dashboard is not the place a member browses a programme.
 *
 * THE BUSINESS SUITE IS NOT HERE ANY MORE, and nor is the locked-plan card
 * that stood in its place for an aspirant. They went together on purpose: the
 * locked card was the suite's empty state, and "Compare memberships" was its
 * only control, so keeping one without the other would leave an upgrade prompt
 * on a dashboard with nothing to upgrade FOR. The catalogue has its own area,
 * reachable from Business Account in the sidebar.
 *
 * Two invented values are still absent and must stay absent: a member id
 * falling back to a literal, and a "member since" falling back to a date in
 * 2020. Each row is omitted when there is nothing real to put in it.
 */

/**
 * The five destinations the dashboard offers, each in its own colour.
 *
 * Taken from the approved design. The colour is not decoration: on a screen
 * of blue cards, five identical blue tiles are five things to read rather
 * than five things to recognise, and a member uses the same two or three of
 * these every week.
 */
const QUICK_ACTIONS = [
    { label: 'Register for Event', detail: 'Book your seat', icon: CalendarPlus, to: '/member/events', tint: 'bg-rose-50/70', ink: 'text-rose-600' },
    /*
     * `/member/profile-view`, NOT `/member/profile`.
     *
     * The second is the APPLICATION WIZARD — three steps ending in "Submit
     * Application" — and a member whose application three admins have
     * already approved has no business being dropped into it from a tile
     * called Update Profile. It is still the right screen for someone who
     * has not finished applying, and the profile view links into it per
     * section for exactly that.
     */
    { label: 'Update Profile', detail: 'Keep details current', icon: UserCog, to: '/member/profile-view', tint: 'bg-emerald-50/70', ink: 'text-emerald-600' },
    { label: 'Explore Directory', detail: 'Find fellow members', icon: Users, to: '/member/directory', tint: 'bg-violet-50/70', ink: 'text-violet-600' },
    /*
     * `/business/products` — the member's OWN catalogue, which is what a tile
     * called View Products means. It pointed at `/business/discover`, the
     * network-wide search, so pressing "View Products" opened somebody
     * else's. Discover has its own place in the business rail.
     */
    { label: 'View Products', detail: 'Your catalogue', icon: Package, to: '/business/products', tint: 'bg-amber-50/70', ink: 'text-amber-600' },
] as const;

/*
 * FOUR, not five. A "My Documents" tile sat here and the Documents card is
 * the next thing on the row — the same destination offered twice, a hand's
 * width apart.
 */

/** "Thu, 09:24" is the chrome's job; this is the date the hero prints. */
const todayParts = () => {
    const now = new Date();
    return {
        date: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        day: now.toLocaleDateString('en-GB', { weekday: 'long' }),
    };
};

/** Morning / Afternoon / Evening, from the reader's own clock. */
const greetingFor = (hour: number) =>
    (hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');

/** The date block on an event row: "25" over "SEP", plus the time range. */
const eventDay = (iso: string | null) => {
    if (!iso) return { day: '--', month: '', time: '' };
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return { day: '--', month: '', time: '' };
    return {
        day: d.toLocaleDateString('en-GB', { day: '2-digit' }),
        month: d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase(),
        /* 12-hour, like every other time on the site — see `formatTime` on
           the event detail page for why a 24-hour clock read as wrong. */
        time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })
            .toUpperCase(),
    };
};

/**
 * "16 Sep 2026" — the form the membership card uses.
 *
 * Its three facts share a row, so each has about a third of the card: at
 * "16 September 2026" two of the three truncate to "16 September …", which
 * loses the year — the one part of a validity date that matters.
 */
const cardDate = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? ''
        : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const shortDate = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? ''
        : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * "2 hours ago".
 *
 * A timestamp printed in full — "17/09/2026, 09:24:11" — answers a question
 * nobody asked of an activity feed; what a reader wants is how recent it is.
 */
const timeAgo = (iso?: string | null): string => {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    return shortDate(iso);
};

/** The feed's rows carry a `type`; it decides the mark beside the sentence. */
const activityIcon = (type: string) => {
    const key = String(type || '').toLowerCase();
    if (key.includes('event') || key.includes('register')) return CalendarDays;
    if (key.includes('payment') || key.includes('paid')) return CreditCard;
    if (key.includes('document') || key.includes('certificate')) return FileText;
    if (key.includes('profile')) return UserCog;
    return History;
};


export default function PaidDashboard() {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    useEffect(() => {
        let closed = false, checking = false;
        const syncIdentity = async () => {
            if (document.visibilityState === 'hidden' || checking) return;
            checking = true;
            try { const latest = await getMyProfile(); if (!closed) setProfile(latest); }
            catch { /* Keep the last known card while offline. */ }
            finally { checking = false; }
        };
        const timer = window.setInterval(syncIdentity, 30000);
        window.addEventListener('focus', syncIdentity);
        document.addEventListener('visibilitychange', syncIdentity);
        return () => { closed = true; clearInterval(timer); window.removeEventListener('focus', syncIdentity); document.removeEventListener('visibilitychange', syncIdentity); };
    }, []);
    // From the profile this screen already loads — the server's renewal answer.
    const renewal = useMemo(() => readRenewal(profile), [profile]);
    const [application, setApplication] = useState<any>(null);
    const [hasBusinessRecord, setHasBusinessRecord] = useState(false);
    /* Printed on the membership card. The dashboard already fetches this
       record and was reading a single boolean out of it. */
    const [businessType, setBusinessType] = useState('');

    const [updates, setUpdates] = useState<Announcement[]>([]);
    const eventNow = useEventClock();
    const [events, setEvents] = useState<MemberEvent[]>([]);
    const [activity, setActivity] = useState<MemberActivity[]>([]);
    const [sectionsLoading, setSectionsLoading] = useState(true);

    /**
     * Everything at once, and nothing all-or-nothing.
     *
     * `allSettled`, not `all`: the business lookup 404s for a member who never
     * filled that form in, and the analytics endpoint answers an empty
     * catalogue for an aspirant. Neither is an error and neither may blank the
     * page — which is exactly what a rejected `Promise.all` would do.
     */
    const loadIdentity = useCallback(async () => {
        const [profileResult, businessResult, applicationResult, companiesResult]
            = await Promise.allSettled([
            getMyProfile(),
            getBusinessInfo(),
            /* The COMPANY record, which is where a business type actually
               lives — see the note where it is read. */
            getMyApplication(),
            getMyCompanies(),
        ]);

        if (profileResult.status === 'fulfilled') setProfile(profileResult.value);
        if (applicationResult.status === 'fulfilled') setApplication(applicationResult.value);
        if (businessResult.status === 'fulfilled') {
            const info = businessResult.value as any;
            setHasBusinessRecord(!!info && (info.doingBusiness === true || !!info.organizationName));
            /*
             * `businessTypes` on the member's registration form is an ARRAY,
             * and on live data it is empty for every member — the field is on
             * the form but nobody has ever filled it in. Kept as the first
             * source anyway, because a member who does fill it in has said
             * something more specific than their company record does.
             */
            const types = Array.isArray(info?.businessTypes)
                ? info.businessTypes.filter(Boolean)
                : [];
            if (types.length) setBusinessType(types.join(', '));
        }

        /*
         * ==================================================================
         * THE BUSINESS TYPE LIVES ON THE COMPANY, NOT ON THE MEMBER FORM
         * ==================================================================
         *
         * `businessInfo.businessTypes` is empty on every live record; the
         * answer somebody actually typed is `Company.businessType` — “Trader”,
         * “Service Provider” — set when they created the business account. The
         * directory has been printing it all along, which is how the card
         * came to show an em dash for a company whose type is on screen two
         * clicks away.
         *
         * Set only if the member form did not answer: a member's own words
         * about themselves outrank a dropdown on another screen. The
         * constitution joins it, because “Trader · Private Limited” is what
         * the directory card says and the two should not disagree.
         */
        if (companiesResult.status === 'fulfilled') {
            /* Typed to the two fields this reads, not `any[]`. The list is
               loosely typed at the API boundary; that is no reason to lose
               the check on the names read out of it here. */
            const first = (companiesResult.value as
                { businessType?: string; constitutionType?: string }[] | undefined)?.[0];
            const fromCompany = [first?.businessType, first?.constitutionType]
                .map((v) => String(v || '').trim())
                .filter(Boolean)
                .join(' · ');
            if (fromCompany) setBusinessType((current) => current || fromCompany);
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        let cancelled = false;

        loadIdentity();

        /*
         * TWO CALLS, NOT FOUR. The analytics and low-stock requests fed the
         * Business Suite card, which is no longer on this screen — and they are
         * two of the slowest endpoints the member area has. Leaving them in
         * would make the dashboard wait on figures nothing renders.
         */
        Promise.allSettled([
            listAnnouncements({ limit: 6 }),
            listMemberEvents(),
        ]).then(([updatesResult, eventsResult]) => {
            if (cancelled) return;

            if (updatesResult.status === 'fulfilled') {
                setUpdates(updatesResult.value?.announcements || []);
            }
            if (eventsResult.status === 'fulfilled') {
                setEvents(eventsResult.value?.events || []);
            }

            setSectionsLoading(false);
        });


        getRecentActivity(6).then((rows) => { if (!cancelled) setActivity(rows || []); });

        return () => { cancelled = true; };
    }, [loadIdentity]);

    // ---------------------------------------------------------------- identity

    const name = profile?.fullName || 'Member';
    const firstName = (name || '').split(' ').filter(Boolean)[0] || 'Member';

    /**
     * Which membership this is (ENT-001).
     *
     * The declaration on the application outranks the presence of a business
     * record: someone who registered as a business but has not yet filled in
     * the business form is a business member with an empty catalogue, and
     * treating them as an aspirant hides the screen they need next.
     */
    const plan: MemberPlan = useMemo(
        () => resolvePlan({ declared: resolveApplicantKind(profile?.paidMembership?.kind ? { memberType: profile.paidMembership.kind } : application), hasBusinessRecord }),
        [application, hasBusinessRecord, profile?.paidMembership?.kind],
    );

    /** Only what the record holds — no placeholder id, no placeholder date. */
    const memberId = profile?.membershipNumber || '';
    const applicationRef = formatApplicationRef(application).short;
    const membershipType = String(profile?.membershipType || '').trim();
    const memberSince = profile?.membershipActivatedAt || profile?.approvedAt || '';
    const memberSinceLabel = memberSince
        ? new Date(memberSince).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'long', year: 'numeric',
        })
        : '';

    /**
     * Where the member is — THREE FIELDS, kept apart.
     *
     * They used to be joined into one string for the card, which printed
     * "Ariyalur, Ariyalur, Tamil Nadu": a value that repeats a word and labels
     * none of them. In this association a block and its district very often
     * share a name, so a reader cannot tell which is which. The card labels all
     * three now, and each is simply absent when the record has nothing for it.
     */
    const block = String(profile?.block || '').trim();
    const district = String(profile?.district || '').trim();
    const state = String(profile?.state || '').trim();
    /* A member outside India has no region — their place and country instead. */
    const abroad = profile?.isInternational === true;
    const place = String(profile?.place || profile?.city || '').trim();
    const country = String(profile?.country || '').trim();

    /**
     * When the membership lapses.
     *
     * `membershipExpiresAt` is the stored answer. The fallback derives a year
     * from activation for an ANNUAL membership, because that field went
     * undeclared for a long time and rows written in that window carry an
     * activation date and no expiry — the same rule the certificate endpoint
     * applies, so the card and the certificate cannot print different dates.
     *
     * A LIFETIME membership has no expiry and must not be given an invented
     * one; `lifetime` below makes the card print the word instead.
     */
    /* Platinum is the lifetime tier the Super Admin grants — always lifetime. */
    const platinum = isPlatinumProfile(profile);
    const lifetime = platinum || membershipType.toLowerCase() === 'lifetime';
    const planTitle = platinum ? 'Lifetime Membership' : (profile?.currentMembership?.planName || profile?.paidMembership?.planName || planLabel(plan) || 'Member');
    const expiresAt = useMemo(() => {
        if (lifetime) return '';
        if (profile?.membershipExpiresAt) return profile.membershipExpiresAt;
        if (membershipType.toLowerCase() === 'annual' && memberSince) {
            const d = new Date(memberSince);
            if (!Number.isNaN(d.getTime())) {
                d.setFullYear(d.getFullYear() + 1);
                return d.toISOString();
            }
        }
        return '';
    }, [lifetime, profile?.membershipExpiresAt, membershipType, memberSince]);

    const validUntilLabel = membershipValidityLabel(expiresAt);


    // ---------------------------------------------------------------- derived

    const at = (event: MemberEvent) => (event.startAt ? new Date(event.startAt).getTime() : 0);

    const upcomingEvents = useMemo(
        () => (events || []).filter((event) => !isPast(event, eventNow)).sort((a, b) => at(a) - at(b)),
        [events, eventNow],
    );

    const myEventCount = useMemo(
        () => (events || []).filter((event) =>
            event.myRegistration && event.myRegistration.status !== 'cancelled' && !isPast(event, eventNow)).length,
        [events, eventNow],
    );

    const pinnedFirst = useMemo(
        () => [...(updates || [])].sort((a, b) => Number(b.pinned) - Number(a.pinned)),
        [updates],
    );

    /*
     * The receipt belongs here with the two certificates: it is the third
     * thing issued against a paid membership, and it was reachable only in
     * the minute after paying — a member wanting it for their accountant six
     * months later had nowhere to go for it.
     *
     * `?view=receipt` opens the payment screen in its receipt register rather
     * than its "Payment Successful!" one — see the note in `PaymentSuccess`.
     */
    const DOCUMENTS = [
        {
            label: 'Membership Certificate', detail: 'View / download',
            to: '/member/certificate/membership', icon: FileText,
            tint: 'bg-blue-50 text-blue-600', issued: true,
        },
        {
            label: 'Tax Exemption Certificate', detail: 'View / download',
            to: '/member/certificate/tax-exemption', icon: ShieldCheck,
            tint: 'bg-emerald-50 text-emerald-600', issued: true,
        },
        {
            label: 'Payment Receipt', detail: 'View / download',
            to: '/member/payment-success?view=receipt', icon: ReceiptText,
            tint: 'bg-violet-50 text-violet-600', issued: true,
        },
        {
            label: 'Membership Plan', detail: platinum ? 'Lifetime Membership' : (planLabel(plan) || 'Your plan'),
            to: '/member/plan', icon: BadgeCheck,
            tint: 'bg-amber-50 text-amber-600', issued: false,
        },
    ];


    const greeting = greetingFor(new Date().getHours());
    const today = todayParts();
    const statusLabel = String(profile?.membershipStatus || 'active').toUpperCase();
    const activeNow = String(profile?.membershipStatus || 'active').toLowerCase() === 'active';
    const initials = (name || 'M')
        .split(' ').filter(Boolean).slice(0, 2)
        .map((part: string) => part[0]?.toUpperCase() || '')
        .join('') || 'M';

    if (loading) {
        return (
            <MemberPageShell title="Dashboard" subtitle="Your membership" width="wide">
                <RowsSkeleton rows={5} />
            </MemberPageShell>
        );
    }

    return (
        <MemberPageShell title={platinum ? 'Lifetime Membership' : 'Dashboard'} subtitle={platinum ? 'Your connection to the ACTIV community' : 'Your membership at a glance'} width="wide" appearance={platinum ? 'gold' : 'default'}>
            <div className={`space-y-4 sm:space-y-6 ${platinum ? 'platinum-dashboard' : ''}`}>

                <div className="dashboard-overview"><div className="dashboard-overview__cards">
                    <DashboardWelcome name={name} greeting={greeting} date={today.date} day={today.day}
                        plan={planTitle} lifetime={lifetime} applicationRef={applicationRef} memberSince={memberSinceLabel}
                        region={(abroad ? [place, country] : [district, state]).filter((value, i, all) => !!value && all.indexOf(value) === i).join(', ')}
                        avatar={<MemberAvatar name={name} className="h-16 w-16 shrink-0 rounded-full bg-white/15 shadow-lg ring-4 ring-white/30 sm:h-20 sm:w-20" initialsClassName="text-2xl font-bold text-white" />} />
                    <DashboardMembership name={name} plan={planTitle} memberId={memberId}
                        membershipLabel={membershipType ? `${membershipType} membership` : 'Membership'}
                        since={cardDate(memberSince)} validUntil={validUntilLabel} lifetime={lifetime}
                        active={activeNow} status={activeNow ? 'Active' : statusLabel}
                        details={[
                            ...(abroad ? [{ label: 'Place', value: place }, { label: 'Country', value: country }]
                                : [{ label: 'State', value: state }, { label: 'District', value: district }, { label: 'Block', value: block }]),
                            { label: 'Business type', value: businessType }, { label: 'Application ID', value: applicationRef },
                        ]}
                        onPlan={() => navigate('/member/plan')} />
                </div></div>
                {profile?.currentMembership?.message && <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"><p className="font-semibold">Membership progression</p><p className="mt-1">{profile.currentMembership.message}</p></div>}

                {/* ============================ quick actions · documents */}
                {/* 1.6 / 1, not 1.05 / 1. Five tiles in half a 1280px
                    content column are 100px each, which wraps "Register for
                    Event" onto three lines and clips the third. */}
                <div className="grid items-stretch gap-4 sm:gap-6 2xl:grid-cols-2">

                    <SectionCard
                        title="Quick Actions"
                        subtitle="Access your most used features"
                        icon={<Zap className="w-5 h-5" />}
                        className={`h-full ${platinum ? 'platinum-panel' : ''}`}
                    >
                        {/*
                          FIVE TILES, EACH ITS OWN COLOUR. The colour is not
                          decoration: these are the five destinations a member
                          uses most, and on a screen of blue cards a row of
                          five identical blue tiles is five things to read
                          rather than five things to recognise.
                        */}
                        {/*
                          FOUR COLUMNS FOR FOUR TILES.

                          The grid still asked for five after the fifth tile
                          was removed, so the row laid out four tiles and left
                          the fifth column empty — the tiles stopped short of
                          the card's right edge while the documents beside them
                          filled theirs, which is exactly the misalignment that
                          was reported. The count is the number of actions.
                        */}
                        {/* 2 × 2, FILLING THE CARD — the same grid as My Documents
                            beside it. Four abreast left a short row floating in
                            the middle of a tall card (the body centres its
                            content), so the two cards never lined up. */}
                        <div className="lifetime-tiles grid flex-1 auto-rows-fr grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4 2xl:grid-cols-2">
                            {QUICK_ACTIONS.map(({ label, detail, icon: Icon, to, tint, ink }) => (
                                <button
                                    key={label}
                                    type="button"
                                    onClick={() => navigate(to)}
                                    className={`group flex h-full min-w-0 flex-col gap-3 rounded-2xl border
                                                border-slate-200 p-3.5 sm:p-4 text-left transition-all
                                                hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md ${tint}`}
                                >
                                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl
                                                      bg-white ${ink} shadow-sm`}>
                                        <Icon className="h-5 w-5" />
                                    </span>
                                    {/* Label left, the arrow in its own circle
                                        bottom-right — the design's tile. Inline
                                        under the label it read as punctuation
                                        on the last word. */}
                                    {/*
                                      THE LABEL RESERVES TWO LINES, so the four
                                      arrows land on one line across the row.

                                      "Register for Event" wraps and "Update
                                      Profile" does not; with the label sized to
                                      its own text the arrow under each one sat
                                      at a different height and the row read as
                                      four tiles that had slipped. `em`, so it
                                      follows the type size.
                                    */}
                                    <span className="block text-[1.125rem] sm:text-[1.25rem] font-bold leading-snug text-slate-900
                                                     break-normal [overflow-wrap:normal] [hyphens:manual]">
                                        {label}
                                    </span>
                                    <span className="-mt-1.5 block text-[0.9375rem] sm:text-[1rem] font-medium text-slate-500">
                                        {detail}
                                    </span>
                                    <span className="mt-auto block">
                                        <span className="mt-3 flex justify-end">
                                            <span className={`flex h-8 w-8 items-center justify-center rounded-full
                                                              bg-white ${ink} shadow-sm transition-transform
                                                              group-hover:translate-x-0.5`}>
                                                <ArrowRight className="h-4 w-4" />
                                            </span>
                                        </span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="My Documents"
                        subtitle="Your important documents at one place"
                        icon={<FolderOpen className="w-5 h-5" />}
                        actionTo="/member/documents"
                        className={`h-full ${platinum ? 'platinum-panel' : ''}`}
                    >
                        {/* FOUR TILES IN A ROW, stacked inside — the icon
                            above the name, the badge under it and the arrow
                            in the corner, as the design draws them. Two
                            abreast until there is room for four. */}
                        {/* Always two abreast: this card is HALF the page wide, and four
                            tiles in it split "Membership" into "Membershi / p". */}
                        <div className="lifetime-tiles grid flex-1 auto-rows-fr grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4 2xl:grid-cols-2">
                            {DOCUMENTS.map((doc) => (
                                <button
                                    key={doc.to}
                                    type="button"
                                    onClick={() => navigate(doc.to)}
                                    className="group flex h-full flex-col gap-3 rounded-2xl border border-slate-200
                                               bg-white p-3.5 sm:p-4 text-left transition-all hover:-translate-y-0.5
                                               hover:border-blue-300 hover:shadow-md min-w-0"
                                >
                                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center
                                                      rounded-xl ${doc.tint}`}>
                                        <doc.icon className="h-5 w-5" />
                                    </span>

                                    <span className="block text-[1.125rem] sm:text-[1.25rem] font-bold leading-snug text-slate-900
                                                     break-normal [overflow-wrap:normal] [hyphens:manual]">
                                        {doc.label}
                                    </span>

                                    <span className="block">
                                        {doc.issued ? (
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50
                                                             px-2.5 py-1 text-[1.0625rem] font-bold text-emerald-700">
                                                <BadgeCheck className="h-4 w-4" /> Verified
                                            </span>
                                        ) : (
                                            <span className="block text-[1.25rem] font-semibold text-slate-500">
                                                {doc.detail}
                                            </span>
                                        )}
                                        <span className="mt-3 flex justify-end">
                                            <span className="flex h-8 w-8 items-center justify-center rounded-full
                                                             bg-blue-50 text-blue-600 transition-transform
                                                             group-hover:translate-x-0.5">
                                                <ArrowRight className="h-4 w-4" />
                                            </span>
                                        </span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </SectionCard>
                </div>


                {/* ================= events · updates · activity */}
                {/*
                  EVENTS GETS A ROW OF ITS OWN.

                  Three cards abreast left each event row about 420px to hold a
                  date block, a poster, a title, a time, a venue AND a button —
                  so the title truncated to "Business Integra…" and the venue to
                  "Hosu…", which is a card that cannot do its one job. Across
                  the full width every part of the row fits, and the two cards
                  that ARE happy in a narrow column — a list of notices and a
                  list of timestamps — share the row beneath it.
                */}
                <div className="grid items-stretch gap-4 sm:gap-6">

                    {/* ---------------------------------------- events ---- */}
                    <SectionCard
                        title="Upcoming Events"
                        subtitle="Don't miss out on what's next"
                        icon={<CalendarDays className="w-5 h-5" />}
                        actionTo="/member/events"
                        className="h-full"
                    >
                        {sectionsLoading ? (
                            <RowsSkeleton rows={3} />
                        ) : upcomingEvents.length === 0 ? (
                            <EmptyState
                                icon={<CalendarDays className="w-6 h-6" />}
                                title="Nothing scheduled yet"
                                detail="Events open to your membership will appear here."
                            />
                        ) : (
                            <div className="space-y-4">
                                {upcomingEvents.slice(0, 3).map((event) => {
                                    const when = eventDay(event.startAt);
                                    const banner = resolveMediaUrl(event.bannerUrl) || '';
                                    const registered = !!event.myRegistration
                                        && event.myRegistration.status !== 'cancelled';
                                    return (
                                        <div
                                            key={event.id}
                                            className="flex flex-wrap sm:flex-nowrap items-stretch gap-3 sm:gap-4 rounded-2xl border border-slate-200
                                                       bg-white p-3 transition-all hover:border-blue-300
                                                       hover:shadow-md"
                                        >
                                            {/* the date block */}
                                            <span className="flex w-14 sm:w-16 shrink-0 flex-col items-center justify-center
                                                             rounded-xl bg-blue-50 px-2 py-2.5 sm:py-3 text-center">
                                                <span className="text-[1.5rem] sm:text-[1.75rem] font-extrabold leading-none text-blue-700">
                                                    {when.day}
                                                </span>
                                                <span className="mt-1 text-[1.0625rem] font-extrabold uppercase
                                                                 tracking-wider text-blue-500">
                                                    {when.month}
                                                </span>
                                            </span>

                                            {/*
                                              THE POSTER WHEN THERE IS ONE, and
                                              nothing at all when there is not —
                                              the row simply gives its width to
                                              the text. A grey placeholder tile
                                              on an event with no artwork reads
                                              as an image that failed to load.
                                            */}
                                            {banner && (
                                                <span className="relative hidden w-48 shrink-0 overflow-hidden
                                                                 rounded-xl sm:block">
                                                    <img
                                                        src={banner}
                                                        alt={event.bannerAlt || ''}
                                                        loading="lazy"
                                                        className="h-full w-full object-cover"
                                                    />
                                                    {event.category && (
                                                        <span className="absolute left-1.5 top-1.5 rounded-md
                                                                         bg-slate-900/80 px-2 py-0.5 text-[1.0625rem]
                                                                         font-bold text-white">
                                                            {event.category}
                                                        </span>
                                                    )}
                                                </span>
                                            )}

                                            <span className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-1">
                                                {!banner && event.category && (
                                                    <span className="w-fit rounded-md bg-slate-100 px-2 py-0.5
                                                                     text-[1.0625rem] font-bold text-slate-600">
                                                        {event.category}
                                                    </span>
                                                )}
                                                {/* Two lines reserved: one-line and
                                                    two-line titles otherwise start
                                                    their time and venue rows a line
                                                    apart, and three rows down the
                                                    card nothing lines up. */}
                                                <span className="line-clamp-2 break-words text-[1.25rem] sm:text-[1.5625rem]
                                                                 font-extrabold leading-snug tracking-tight
                                                                 text-slate-900">
                                                    {event.title || 'Untitled event'}
                                                </span>
                                                {when.time && (
                                                    <span className="flex items-center gap-1.5 text-[1.25rem]
                                                                     font-semibold text-slate-500">
                                                        <Clock className="h-4 w-4 shrink-0" /> {when.time}
                                                    </span>
                                                )}
                                                {(event.venue || event.district) && (
                                                    <span className="flex items-center gap-1.5 text-[1.25rem]
                                                                     font-semibold text-slate-500">
                                                        <MapPin className="h-4 w-4 shrink-0" />
                                                        <span className="truncate">
                                                            {[event.venue, event.district].filter(Boolean).join(', ')}
                                                        </span>
                                                    </span>
                                                )}
                                            </span>

                                            <span className="flex w-full sm:w-auto shrink-0 items-center self-center">
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(memberEventPath(event))}
                                                    className={`inline-flex w-full sm:w-auto justify-center items-center gap-1.5 rounded-xl px-4 py-2.5
                                                                text-[1.25rem] font-bold transition-colors ${registered
                                                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                                            : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                                >
                                                    {registered ? 'Registered' : 'View details'}
                                                    <ArrowRight className="h-4 w-4" />
                                                </button>
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </SectionCard>

                </div>

                {/* ------------------------- updates · activity, side by side */}
                <div className="grid items-stretch gap-4 sm:gap-6 lg:grid-cols-2">

                    {/* --------------------------------------- updates ---- */}
                    <SectionCard
                        title="Association Updates"
                        subtitle="Latest news & announcements"
                        icon={<Megaphone className="w-5 h-5" />}
                        actionTo="/member/updates"
                        className="h-full"
                    >
                        {sectionsLoading ? (
                            <RowsSkeleton rows={3} />
                        ) : pinnedFirst.length === 0 ? (
                            <EmptyState
                                icon={<Megaphone className="w-6 h-6" />}
                                title="No updates yet"
                                detail="Notices published for your region appear here first."
                            />
                        ) : (
                            <div className="space-y-4">
                                {pinnedFirst.slice(0, 3).map((update) => {
                                    const banner = resolveMediaUrl(update.bannerUrl) || '';
                                    return (
                                        <button
                                            key={update.id}
                                            type="button"
                                            onClick={() => navigate(`/member/updates/${update.id}`)}
                                            className="flex w-full items-start gap-3.5 rounded-2xl border
                                                       border-slate-200 bg-white p-3 text-left transition-all
                                                       hover:border-blue-300 hover:shadow-md"
                                        >
                                            {/* Same rule as the events row: the
                                                image when the notice carries
                                                one, the text alone when it does
                                                not. */}
                                            {banner && (
                                                <span className="hidden h-20 w-24 shrink-0 overflow-hidden
                                                                 rounded-xl sm:block">
                                                    <img
                                                        src={banner}
                                                        alt={update.bannerAlt || ''}
                                                        loading="lazy"
                                                        className="h-full w-full object-cover"
                                                    />
                                                </span>
                                            )}

                                            <span className="min-w-0 flex-1">
                                                <span className="flex flex-wrap items-center gap-2">
                                                    {update.category && (
                                                        <span className="rounded-md bg-blue-50 px-2 py-0.5
                                                                         text-[1.0625rem] font-bold capitalize
                                                                         text-blue-700">
                                                            {update.category}
                                                        </span>
                                                    )}
                                                    {update.pinned && (
                                                        <span className="rounded-md bg-amber-50 px-2 py-0.5
                                                                         text-[1.0625rem] font-bold text-amber-700">
                                                            Pinned
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="mt-1.5 line-clamp-2 block min-h-[2.6em]
                                                                 text-[1.25rem] font-extrabold leading-snug
                                                                 tracking-tight text-slate-900">
                                                    {update.title}
                                                </span>
                                                {update.summary && (
                                                    <span className="mt-1 line-clamp-2 block min-h-[3em] text-[1.25rem]
                                                                     font-medium text-slate-500">
                                                        {update.summary}
                                                    </span>
                                                )}
                                                {update.publishedAt && (
                                                    <span className="mt-1.5 flex items-center gap-1.5 text-[1.1875rem]
                                                                     font-semibold text-slate-400">
                                                        <CalendarDays className="h-4 w-4" />
                                                        {shortDate(update.publishedAt)}
                                                    </span>
                                                )}
                                            </span>

                                            <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-400" />
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </SectionCard>

                    {/* -------------------------------------- activity ---- */}
                    <SectionCard
                        title="Recent Activity"
                        subtitle="Your latest actions"
                        icon={<History className="w-5 h-5" />}
                        className="h-full"
                    >
                        {activity.length === 0 ? (
                            <EmptyState
                                icon={<History className="w-6 h-6" />}
                                title="Nothing yet"
                                detail="Activity appears here as your account changes."
                            />
                        ) : (
                            <div className="space-y-3">
                                {activity.slice(0, 5).map((row, i) => {
                                    const Icon = activityIcon(row.type);
                                    return (
                                        <div
                                            key={row.id || i}
                                            className="flex items-start gap-3 rounded-xl px-1 py-1.5"
                                        >
                                            <span className="flex h-10 w-10 shrink-0 items-center justify-center
                                                             rounded-xl bg-blue-50 text-blue-600">
                                                <Icon className="h-5 w-5" />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                {/* Two lines reserved here too, so a
                                                    long sentence and a short one keep
                                                    their "2 hours ago" on the same
                                                    line down the column. */}
                                                <span className="line-clamp-2 block min-h-[2.6em] text-[1.25rem]
                                                                 font-bold leading-snug text-slate-900">
                                                    {row.description || row.type}
                                                </span>
                                                <span className="mt-0.5 block text-[1.25rem] font-semibold text-slate-400">
                                                    {timeAgo(row.at)}
                                                </span>
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </SectionCard>
                </div>

                <DashboardMembershipReview lifetime={lifetime}
                    onPlan={() => navigate('/member/plan')}
                    onUpgrade={() => navigate('/payment/membership-plans?upgrade=1')} />
                <RenewalBanner renewal={renewal} />
            </div>
        </MemberPageShell>
    );
}
