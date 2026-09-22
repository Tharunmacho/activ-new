import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowRight, BadgeCheck, Briefcase, CalendarDays, CalendarPlus, ChevronRight, Clock, CreditCard, FileText, FolderOpen, History, MapPin, Megaphone, Package, ReceiptText, ShieldCheck, Sparkles, Sun, User, UserCircle, UserCog, Users, Zap,
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
import { BIZ_DETAIL_LABEL } from '@/components/layout/surface';
import cardBackdrop from '@/assets/membership-card-bg.svg';
import greetingBubbles from '@/assets/greeting-bubbles.svg';

import { CARD_TITLE, PAGE_TITLE } from '@/components/layout/appTypography';
/** The mark, as a watermark on the greeting card. */
const ACTIV_MARK = '/logo_ACTIVian-removebg-preview.png';
import {
    listAnnouncements, listMemberEvents,
    type Announcement, type MemberEvent,
} from '@/services/memberHubApi';
import {
    resolveApplicantKind, resolvePlan, planLabel,
    type MemberPlan,
} from '@/features/member/memberAccess';

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
    { label: 'Register for Event', icon: CalendarPlus, to: '/member/events', tint: 'bg-rose-50/70', ink: 'text-rose-600' },
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
    { label: 'Update Profile', icon: UserCog, to: '/member/profile-view', tint: 'bg-emerald-50/70', ink: 'text-emerald-600' },
    { label: 'Explore Directory', icon: Users, to: '/member/directory', tint: 'bg-violet-50/70', ink: 'text-violet-600' },
    /*
     * `/business/products` — the member's OWN catalogue, which is what a tile
     * called View Products means. It pointed at `/business/discover`, the
     * network-wide search, so pressing "View Products" opened somebody
     * else's. Discover has its own place in the business rail.
     */
    { label: 'View Products', icon: Package, to: '/business/products', tint: 'bg-amber-50/70', ink: 'text-amber-600' },
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
        time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
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
    const [application, setApplication] = useState<any>(null);
    const [hasBusinessRecord, setHasBusinessRecord] = useState(false);
    /* Printed on the membership card. The dashboard already fetches this
       record and was reading a single boolean out of it. */
    const [businessType, setBusinessType] = useState('');

    const [updates, setUpdates] = useState<Announcement[]>([]);
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
            getMyCompanies(),
            getMyApplication(),
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
        () => resolvePlan({ declared: resolveApplicantKind(application), hasBusinessRecord }),
        [application, hasBusinessRecord],
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
    const lifetime = membershipType.toLowerCase() === 'lifetime';
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

    const validUntilLabel = expiresAt
        ? new Date(expiresAt).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'long', year: 'numeric',
        })
        : '';

    /**
     * `profilePhoto` is what this backend returns; `profileImage` is a name no
     * endpoint has ever sent, and reading it is what left every avatar blank on
     * the profile screen. Both are accepted, and the URL is re-anchored to the
     * API origin — a stored `/uploads/...` path resolves against this site,
     * which serves no uploads.
     */
    const photoUrl = useMemo(
        () => resolveMediaUrl(profile?.profilePhoto || profile?.profileImage) || '',
        [profile],
    );

    // ---------------------------------------------------------------- derived

    const at = (event: MemberEvent) => (event.startAt ? new Date(event.startAt).getTime() : 0);

    const upcomingEvents = useMemo(
        () => (events || []).filter((event) => !isPast(event)).sort((a, b) => at(a) - at(b)),
        [events],
    );

    const myEventCount = useMemo(
        () => (events || []).filter((event) =>
            event.myRegistration && event.myRegistration.status !== 'cancelled' && !isPast(event)).length,
        [events],
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
            label: 'Membership Plan', detail: planLabel(plan) || 'Your plan',
            to: '/member/plan', icon: BadgeCheck,
            tint: 'bg-amber-50 text-amber-600', issued: false,
        },
    ];

    /*
     * THE PHOTO IS READ, NEVER WRITTEN, ON THIS SCREEN.
     *
     * It is changed on the profile screen, which posts it and then fires
     * `profilePhotoUpdated` — the same event the sidebar listens for. This
     * picks it up too, so a member who changes their photo two screens away
     * comes back to the dashboard and finds it already there, without a
     * reload and without a second upload control to maintain.
     */
    const [livePhoto, setLivePhoto] = useState('');

    useEffect(() => {
        const read = () => {
            try { setLivePhoto(localStorage.getItem('userProfilePhoto') || ''); } catch { /* unavailable */ }
        };
        read();
        window.addEventListener('profilePhotoUpdated', read);
        return () => window.removeEventListener('profilePhotoUpdated', read);
    }, []);

    /** The record's photo, unless a newer one was just saved on the profile. */
    const candidate = livePhoto || photoUrl;

    /*
     * A PHOTO THAT DOES NOT LOAD IS NOT A PHOTO.
     *
     * `userProfilePhoto` in localStorage outlives the file it points at: the
     * upload is replaced, the member signs in on another device, the path
     * changes — and the avatar then rendered the browser's broken-image
     * glyph, which is what was reported. `onError` drops the src and the
     * initials take over, which is what the card shows for a member who has
     * no photo at all. Reset on change, or a good URL after a bad one would
     * stay hidden.
     */
    const [photoBroken, setPhotoBroken] = useState(false);
    useEffect(() => { setPhotoBroken(false); }, [candidate]);
    const avatarSrc = photoBroken ? '' : candidate;

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
        <MemberPageShell title="Dashboard" subtitle="Your membership at a glance" width="wide">
            <div className="space-y-6">

                {/* ============================= greeting · membership card
                    TWO CARDS, NOT ONE BAND.

                    The design puts the welcome and the membership side by
                    side as separate objects, and that is the right split:
                    the greeting is a message that changes with the hour, the
                    membership card is a credential. Inside one band they
                    read as one thing, and the card — which is what a member
                    actually came to check — has no edge of its own.

                    The GREETING keeps the site's weather (dot field, orbit
                    rings, brand blooms) on the tinted card; the MEMBERSHIP
                    CARD carries the navy, so it is the darkest object on the
                    screen and therefore the first one seen. */}
                {/* ================================================== hero
                    ONE CARD, NOT TWO.

                    The greeting and the membership card were two sections
                    side by side on the same gradient with the same bubbles —
                    so the row already read as one object with a seam down the
                    middle, and the seam was the only thing the split bought.
                    The approved design puts both on a single band: the
                    greeting at the left, the membership as a white panel
                    inset in it.

                    Everything the pair carried is here — the sunrise ripples,
                    the bubbles, the waves inside the white panel, the date,
                    the status, the facts and the button. What has gone is the
                    duplicate frame, the duplicate background and the gap
                    between them. */}
                <section className="relative overflow-hidden rounded-[1.75rem]
                                    bg-gradient-to-br from-brand-900 via-blue-700 to-sky-500
                                    shadow-[0_1px_2px_rgba(16,24,40,0.06),0_18px_44px_-20px_rgba(28,46,104,0.55)]">

                    {/* ---- the field: sunrise, ripples, bubbles, mark ---- */}
                    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                        <svg className="absolute inset-0 h-full w-full"
                             viewBox="0 0 1200 380" preserveAspectRatio="none">
                            <defs>
                                <radialGradient id="heroSun" cx="1" cy="0" r="0.75">
                                    {/* White at the centre, warm only at the rim:
                                        amber over navy makes olive. */}
                                    <stop offset="0" stopColor="#ffffff" stopOpacity={0.38} />
                                    <stop offset="0.3" stopColor="#fde68a" stopOpacity={0.18} />
                                    <stop offset="0.65" stopColor="#7dd3fc" stopOpacity={0.12} />
                                    <stop offset="1" stopColor="#38bdf8" stopOpacity={0} />
                                </radialGradient>
                            </defs>
                            <rect x="0" y="0" width="1200" height="380" fill="url(#heroSun)" />
                            {/* the rings from the sun, top right */}
                            <g fill="none" stroke="#ffffff">
                                <circle cx="1200" cy="0" r="150" strokeWidth="2" opacity="0.20" />
                                <circle cx="1200" cy="0" r="240" strokeWidth="1.6" opacity="0.15" />
                                <circle cx="1200" cy="0" r="350" strokeWidth="1.3" opacity="0.11" />
                                <circle cx="1200" cy="0" r="480" strokeWidth="1" opacity="0.08" />
                            </g>

                            {/*
                              AND A SET FROM THE BOTTOM LEFT.

                              The band's left half carried the greeting and
                              nothing else — the ACTIV watermark had been
                              filling it, and with that gone the corner was
                              flat. A second source of ripples, quieter than
                              the sun's and rising from the opposite corner,
                              gives the whole card weather instead of a lit
                              side and a dead one. Wider spacing and half the
                              opacity, so it never competes with the copy
                              sitting on it.
                            */}
                            <g fill="none" stroke="#ffffff">
                                <circle cx="0" cy="380" r="130" strokeWidth="1.8" opacity="0.12" />
                                <circle cx="0" cy="380" r="225" strokeWidth="1.5" opacity="0.09" />
                                <circle cx="0" cy="380" r="340" strokeWidth="1.2" opacity="0.07" />
                                <circle cx="0" cy="380" r="470" strokeWidth="1" opacity="0.05" />
                            </g>
                        </svg>

                        <img
                            src={greetingBubbles}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                        />

                    </div>

                    {/*
                      THE PANEL STOPS SHORT OF THE RIGHT EDGE.

                      It ran to within 32px of it, which put the white card
                      over the corner the sunrise rings radiate from — the
                      effect was drawn and then covered by the one element
                      large enough to hide it. A wider right gutter at `lg`
                      gives the rings their corner back and gives the card
                      something to sit in front of.
                    */}
                    {/*
                      THE LEFT COLUMN SIZES TO ITS CONTENT, and the slack goes
                      to the right of the panel.

                      It was `1fr`, so the greeting's column took every pixel
                      the panel did not and the two ended up at opposite ends
                      of the band with a lake between them. `auto` + a fixed
                      panel means the pair sit together at the left, and the
                      space that is left over lands where the rings are —
                      which is the only part of the field worth showing.
                    */}
                    {/*
                      `justify-between`, not `justify-start`.

                      With `start` the spare width all landed to the RIGHT of
                      the panel, over the decorative rings, and the card sat
                      further left than the field it is inset in. Between the
                      two columns instead: the greeting stays put and the panel
                      moves right by whatever the window has to give — at every
                      width, rather than at one.
                    */}
                    {/*
                      `lg:pr-32` is the two inches asked for.

                      `justify-between` alone put the panel hard against the
                      field's right edge, over the rings rather than beside
                      them. The padding insets the right column and leaves the
                      decoration visible behind it.
                    */}
                    <div className="relative grid items-center justify-between gap-6 p-6 sm:p-8
                                    lg:grid-cols-[minmax(0,auto)_minmax(0,26rem)] lg:pr-24">

                        {/* ------------------------------------ the greeting */}
                        <div>
                            <div className="mb-6 inline-flex items-center gap-2.5 rounded-full bg-white/15 px-4 py-2.5
                                            ring-1 ring-white/25 backdrop-blur-sm">
                                <Sun className="h-5 w-5 text-amber-300" />
                                {/* Up a step throughout this block: it was all set
                                    smaller than the white card beside it, on a band
                                    four times its height. */}
                                <span className="text-[1.5rem] font-extrabold text-white">{today.date}</span>
                                <span className="text-[1.3125rem] font-semibold text-white/70">· {today.day}</span>
                            </div>

                            <div className="flex items-start gap-5">
                                {/* STATIC. The photo is changed on the profile
                                    screen and arrives here through the record.
                                    `onError` drops to the initials: a stored
                                    path outlives the file it points at. */}
                                <span className="flex h-[5.5rem] w-[5.5rem] shrink-0 items-center justify-center
                                                 overflow-hidden rounded-full bg-white/15 text-[2.125rem]
                                                 font-extrabold text-white shadow-lg ring-4 ring-white/30">
                                    {avatarSrc
                                        ? (
                                            <img
                                                src={avatarSrc}
                                                alt=""
                                                className="h-full w-full object-cover"
                                                onError={() => setPhotoBroken(true)}
                                            />
                                        )
                                        : initials}
                                </span>

                                <div className="min-w-0">
                                    <p className="text-[1.5625rem] font-bold text-white/70">{greeting},</p>
                                    <h2 className={`${PAGE_TITLE} mt-1 text-white`}>
                                        {name} <span aria-hidden="true">👋</span>
                                    </h2>
                                    <p className="mt-3 text-[1.5rem] font-semibold leading-relaxed text-white/85">
                                        Your journey with ACTIV is making a difference.
                                    </p>
                                    <p className="text-[1.5rem] font-semibold leading-relaxed text-white/85">
                                        Together we build a stronger community.
                                    </p>
                                </div>
                            </div>

                            {/*
                              THE SAME FACTS THE UNPAID HEADER CARRIES.

                              A member walking from the unpaid dashboard to this
                              one lost the membership type and the application
                              reference from the header — both are on the panel to
                              the right, but that is a card somebody reads
                              deliberately, and these pills are what the eye takes
                              in without stopping.
                            */}
                            <div className="mt-6 flex flex-wrap items-center gap-2.5">
                                {plan && (
                                    <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2.5
                                                     text-[1.375rem] font-bold text-white ring-1 ring-white/25
                                                     backdrop-blur-sm">
                                        <BadgeCheck className="h-4 w-4" /> {planLabel(plan) || 'Member'}
                                    </span>
                                )}
                                {applicationRef && (
                                    <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2.5
                                                     text-[1.375rem] font-bold text-white ring-1 ring-white/25
                                                     backdrop-blur-sm">
                                        <FileText className="h-4 w-4" /> {applicationRef}
                                    </span>
                                )}
                                {memberSinceLabel && (
                                    <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2.5
                                                     text-[1.375rem] font-bold text-white ring-1 ring-white/25
                                                     backdrop-blur-sm">
                                        <CalendarDays className="h-4 w-4" /> Member since {memberSinceLabel}
                                    </span>
                                )}
                                {(district || state) && (
                                    <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2.5
                                                     text-[1.375rem] font-bold text-white ring-1 ring-white/25
                                                     backdrop-blur-sm">
                                        <MapPin className="h-4 w-4" /> {[district, state].filter(Boolean).join(', ')}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* ------------------------- the membership panel ----
                            White, inset in the field — the same relationship
                            the approved design has, and the same one the
                            separate card had with its own frame. The waves
                            (`membership-card-bg.svg`) stay inside it. */}
                        {/* 26rem and 20px of padding, down from 30rem and 24.
                            Eight facts and a button in a half-metre-wide card
                            read as a page of its own beside the greeting. */}
                        <div className="relative overflow-hidden rounded-[1.25rem] bg-white p-5
                                        shadow-[0_18px_40px_-18px_rgba(0,0,0,0.45)]">
                            <img
                                src={cardBackdrop}
                                alt=""
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                            />

                            <div className="relative flex items-start justify-between gap-3">
                                <div className="flex items-center gap-4">
                                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl
                                                     bg-gradient-to-br from-blue-600 to-sky-400 text-white shadow-md">
                                        <User className="h-6 w-6" strokeWidth={2.4} />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-[1.4375rem] font-extrabold tracking-tight text-slate-900">
                                            {planLabel(plan) || 'Member'}
                                        </p>
                                        <p className="text-[1.25rem] font-semibold text-blue-600">
                                            {membershipType ? `${membershipType} membership` : 'Membership'}
                                        </p>
                                    </div>
                                </div>

                                <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1
                                                  text-[1.0625rem] font-extrabold ${activeNow
                                        ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200'
                                        : 'bg-amber-50 text-amber-600 ring-1 ring-amber-200'}`}>
                                    <BadgeCheck className="h-4 w-4" /> {activeNow ? 'Active' : statusLabel}
                                </span>
                            </div>

                            <div className="relative mt-3 grid grid-cols-3 divide-x divide-slate-200 border-t
                                            border-slate-200 pt-4">
                                <CardFact label="Member ID" value={memberId} />
                                <CardFact label="Member since" value={cardDate(memberSince)} className="px-3" />
                                <CardFact
                                    label={lifetime ? 'Validity' : 'Valid until'}
                                    value={lifetime ? 'Lifetime' : cardDate(expiresAt)}
                                    className="pl-3"
                                />
                            </div>

                            <div className="relative mt-3 grid grid-cols-3 divide-x divide-slate-200 border-t
                                            border-slate-200 pt-4">
                                <CardFact icon={MapPin} label="State" value={state} />
                                <CardFact icon={MapPin} label="District" value={district} className="px-3" />
                                <CardFact icon={MapPin} label="Block" value={block} className="pl-3" />
                            </div>

                            {/*
                              THE TWO FACTS A MEMBER IS ASKED TO QUOTE.

                              Both were a screen away: the business type on the
                              Business Account page, the application reference on
                              Application Status. They belong on the card that is
                              open when somebody rings and asks for them.

                              Two columns, not three — an application reference is
                              long, and a third divider would leave it truncated to
                              the point of being useless to read down a telephone.
                            */}
                            {(businessType || applicationRef) && (
                                <div className="relative mt-4 grid grid-cols-2 divide-x divide-slate-200
                                                border-t border-slate-200 pt-4">
                                    <CardFact icon={Briefcase} label="Business type" value={businessType} />
                                    <CardFact label="Application ID" value={applicationRef} className="pl-3" />
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={() => navigate('/member/plan')}
                                className="relative mt-4 inline-flex w-full items-center justify-center gap-2
                                           rounded-xl bg-blue-600 px-5 py-3 text-[1.1875rem] font-bold text-white
                                           transition-colors hover:bg-blue-700"
                            >
                                View plan details <ArrowRight className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </section>

                {/* ============================ quick actions · documents */}
                {/* 1.6 / 1, not 1.05 / 1. Five tiles in half a 1280px
                    content column are 100px each, which wraps "Register for
                    Event" onto three lines and clips the third. */}
                <div className="grid items-stretch gap-6 xl:grid-cols-2">

                    <SectionCard
                        title="Quick Actions"
                        subtitle="Access your most used features"
                        icon={<Zap className="w-5 h-5" />}
                        className="h-full"
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
                        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                            {QUICK_ACTIONS.map(({ label, icon: Icon, to, tint, ink }) => (
                                <button
                                    key={label}
                                    type="button"
                                    onClick={() => navigate(to)}
                                    className={`group flex h-full flex-col justify-between gap-6 rounded-2xl border
                                                border-slate-200 p-5 text-left transition-all
                                                hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md ${tint}`}
                                >
                                    <span className={`flex h-12 w-12 items-center justify-center rounded-xl
                                                      bg-white ${ink} shadow-sm`}>
                                        <Icon className="h-6 w-6" />
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
                                    <span className="block">
                                        <span className="block min-h-[2.8em] text-[1.25rem] font-bold
                                                         leading-snug text-slate-900">
                                            {label}
                                        </span>
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
                        className="h-full"
                    >
                        {/* FOUR TILES IN A ROW, stacked inside — the icon
                            above the name, the badge under it and the arrow
                            in the corner, as the design draws them. Two
                            abreast until there is room for four. */}
                        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                            {DOCUMENTS.map((doc) => (
                                <button
                                    key={doc.to}
                                    type="button"
                                    onClick={() => navigate(doc.to)}
                                    className="group flex h-full flex-col gap-3 rounded-2xl border border-slate-200
                                               bg-white p-4 text-left transition-all hover:-translate-y-0.5
                                               hover:border-blue-300 hover:shadow-md"
                                >
                                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center
                                                      rounded-xl ${doc.tint}`}>
                                        <doc.icon className="h-5 w-5" />
                                    </span>

                                    <span className="block text-[1.25rem] font-bold leading-snug text-slate-900">
                                        {doc.label}
                                    </span>

                                    <span className="mt-auto block">
                                        {doc.issued ? (
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50
                                                             px-2.5 py-1 text-[1rem] font-bold text-emerald-700">
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
                <div className="grid items-stretch gap-6">

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
                                            className="flex items-stretch gap-4 rounded-2xl border border-slate-200
                                                       bg-white p-3 transition-all hover:border-blue-300
                                                       hover:shadow-md"
                                        >
                                            {/* the date block */}
                                            <span className="flex w-16 shrink-0 flex-col items-center justify-center
                                                             rounded-xl bg-blue-50 px-2 py-3 text-center">
                                                <span className="text-[1.75rem] font-extrabold leading-none text-blue-700">
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
                                                                         bg-slate-900/80 px-2 py-0.5 text-[0.9375rem]
                                                                         font-bold text-white">
                                                            {event.category}
                                                        </span>
                                                    )}
                                                </span>
                                            )}

                                            <span className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-1">
                                                {!banner && event.category && (
                                                    <span className="w-fit rounded-md bg-slate-100 px-2 py-0.5
                                                                     text-[1rem] font-bold text-slate-600">
                                                        {event.category}
                                                    </span>
                                                )}
                                                {/* Two lines reserved: one-line and
                                                    two-line titles otherwise start
                                                    their time and venue rows a line
                                                    apart, and three rows down the
                                                    card nothing lines up. */}
                                                <span className="line-clamp-2 text-[1.5rem]
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

                                            <span className="flex shrink-0 items-center self-center">
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(`/member/events/${event.id}`)}
                                                    className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5
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
                <div className="grid items-stretch gap-6 lg:grid-cols-2">

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
                                                                         text-[1rem] font-bold capitalize
                                                                         text-blue-700">
                                                            {update.category}
                                                        </span>
                                                    )}
                                                    {update.pinned && (
                                                        <span className="rounded-md bg-amber-50 px-2 py-0.5
                                                                         text-[1rem] font-bold text-amber-700">
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
                                                    <span className="mt-1.5 flex items-center gap-1.5 text-[1.125rem]
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

                {/* ================================================= footer */}
                <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white
                                    shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_30px_-12px_rgba(16,24,40,0.28)]">
                    <div className="flex flex-col gap-5 bg-gradient-to-r from-blue-50 via-white to-blue-50
                                    p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-7">
                        <div className="flex items-center gap-4">
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl
                                             bg-blue-600 text-white">
                                <Sparkles className="h-6 w-6" />
                            </span>
                            <div>
                                <p className="text-[1.5rem] font-extrabold tracking-tight text-slate-900">
                                    More opportunities await
                                </p>
                                <p className="text-[1.25rem] font-semibold text-slate-500">
                                    Your membership is what opens them.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
                            <div>
                                <p className={BIZ_DETAIL_LABEL}>Your membership plan</p>
                                <p className="mt-1 flex items-center gap-2 text-[1.25rem] font-bold text-slate-900">
                                    {planLabel(plan) || 'Member'}
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50
                                                     px-2.5 py-0.5 text-[1.0625rem] font-bold text-emerald-700">
                                        <BadgeCheck className="h-4 w-4" /> {statusLabel}
                                    </span>
                                </p>
                            </div>

                            {(validUntilLabel || lifetime) && (
                                <div>
                                    <p className={BIZ_DETAIL_LABEL}>Next renewal</p>
                                    <p className="mt-1 text-[1.25rem] font-bold text-slate-900">
                                        {lifetime ? 'No renewal needed' : validUntilLabel}
                                    </p>
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={() => navigate('/member/plan')}
                                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5
                                           text-[1.25rem] font-bold text-white transition-colors
                                           hover:bg-blue-700"
                            >
                                View plan details <ArrowRight className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </MemberPageShell>
    );
}

/* ------------------------------------------------------------------ pieces */

/**
 * A fact on the membership card — the same `BIZ_DETAIL_*` pair the rest of
 * the product uses, in the card's own ink.
 *
 * An absent value renders a dash rather than an empty cell: on a credential
 * the three columns have to keep their places, and a blank where "Block"
 * should be reads as a card that failed to render rather than as a member
 * whose block was never recorded.
 */
function CardFact({ icon: Icon, label, value, className = '' }: {
    icon?: typeof MapPin; label: string; value: string; className?: string;
}) {
    return (
        <div className={`min-w-0 ${className}`}>
            {/* `whitespace-nowrap` and a tighter track: inset in the blue
                frame the panel lost 24px, and "MEMBER SINCE" was wrapping to
                two lines in its column while its neighbours stayed on one —
                which pushed that one value down a line. */}
            <p className="flex items-center gap-1.5 whitespace-nowrap text-[0.9375rem] font-extrabold
                          uppercase tracking-[0.1em] text-slate-400">
                {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                {label}
            </p>
            <p className="mt-1 truncate text-[1.25rem] font-bold text-slate-900" title={value || '—'}>
                {value || '—'}
            </p>
        </div>
    );
}

/** A label over its value inside the hero card — `BIZ_DETAIL_*`, as elsewhere. */
function HeroFact({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0 rounded-xl bg-slate-50 px-3.5 py-3">
            <p className={BIZ_DETAIL_LABEL}>{label}</p>
            <p className="mt-1 truncate text-[1.25rem] font-bold text-slate-900" title={value}>
                {value}
            </p>
        </div>
    );
}
