import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    User, Settings, Calendar, FileText, Download, Clock, Briefcase,
    ChevronRight, BadgeCheck, CalendarDays, Megaphone, Users, Package,
    AlertTriangle, Eye, LineChart, Search, Ticket,
} from 'lucide-react';
import MemberPageShell from '@/pages/member/MemberPageShell';
import {
    SectionCard, EmptyState, PlanLockedCard, StatTile, RowsSkeleton,
} from '@/features/member/components/MemberUI';
import EventCard from '@/features/member/components/EventCard';
import UpdateCard from '@/features/member/components/UpdateCard';
import { isPast } from '@/features/member/components/eventFormat';
import {
    getRecentActivity, getMyProfile, getBusinessInfo, getMyApplication,
    type MemberActivity,
} from '@/services/activApi';
import {
    listAnnouncements, listMemberEvents, getMyAnalytics, listLowStock,
    EMPTY_ANALYTICS,
    type Announcement, type MemberEvent, type MemberAnalytics, type LowStockLine,
} from '@/services/memberHubApi';
import {
    resolveApplicantKind, resolvePlan, planLabel, entitlementsFor, planExplainer,
    type MemberPlan,
} from '@/features/member/memberAccess';

/**
 * The dashboard a member sees once their payment has been recorded.
 *
 * What this screen is FOR changed with the paid feature set. It used to be a
 * membership card, four tiles and an activity log — a receipt. A paid member
 * does not need a receipt every time they sign in; they need the four things
 * their membership actually buys, on the day they buy it:
 *
 *   Association Updates  — what the association has told them (MEM-001)
 *   Events               — what is coming up, and whether they have a seat (EVT-001/2)
 *   Member Directory     — who else is here (DIR-001)
 *   Business suite       — how their catalogue is doing (BUS-001…004)
 *
 * Each section is a summary that leads somewhere: the dashboard answers "is
 * there anything new", and the dedicated screen answers "show me all of it".
 * Nothing here is a dead tile — the previous version had two buttons with no
 * `onClick` at all, styled identically to the two that worked.
 *
 * ENT-001 is applied by SHOWING the business sections to an aspirant with an
 * explanation rather than hiding them. A member who cannot find the catalogue
 * concludes the site is broken; one who is told it belongs to a Company
 * membership knows where they stand. See `planExplainer`.
 *
 * Two invented values are still absent and must stay absent: a member id
 * falling back to a literal, and a "member since" falling back to a date in
 * 2020. Each row is omitted when there is nothing real to put in it.
 */
export default function PaidDashboard() {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [application, setApplication] = useState<any>(null);
    const [hasBusinessRecord, setHasBusinessRecord] = useState(false);
    const [activity, setActivity] = useState<MemberActivity[]>([]);

    const [updates, setUpdates] = useState<Announcement[]>([]);
    const [events, setEvents] = useState<MemberEvent[]>([]);
    const [analytics, setAnalytics] = useState<MemberAnalytics>(EMPTY_ANALYTICS);
    const [lowStock, setLowStock] = useState<LowStockLine[]>([]);
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
        const [profileResult, businessResult, applicationResult] = await Promise.allSettled([
            getMyProfile(),
            getBusinessInfo(),
            getMyApplication(),
        ]);

        if (profileResult.status === 'fulfilled') setProfile(profileResult.value);
        if (applicationResult.status === 'fulfilled') setApplication(applicationResult.value);
        if (businessResult.status === 'fulfilled') {
            const info = businessResult.value as any;
            setHasBusinessRecord(!!info && (info.doingBusiness === true || !!info.organizationName));
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        let cancelled = false;

        loadIdentity();

        Promise.allSettled([
            listAnnouncements({ limit: 6 }),
            listMemberEvents(),
            getMyAnalytics(30),
            listLowStock(),
        ]).then(([updatesResult, eventsResult, analyticsResult, stockResult]) => {
            if (cancelled) return;

            if (updatesResult.status === 'fulfilled') {
                setUpdates(updatesResult.value?.announcements || []);
            }
            if (eventsResult.status === 'fulfilled') {
                setEvents(eventsResult.value?.events || []);
            }
            if (analyticsResult.status === 'fulfilled') {
                setAnalytics(analyticsResult.value || EMPTY_ANALYTICS);
            }
            if (stockResult.status === 'fulfilled') {
                setLowStock(stockResult.value || []);
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

    const entitlements = useMemo(() => entitlementsFor(plan), [plan]);

    /** Only what the record holds — no placeholder id, no placeholder date. */
    const memberId = profile?.membershipNumber || '';
    const membershipType = String(profile?.membershipType || '').trim();
    const memberSince = profile?.membershipActivatedAt || profile?.approvedAt || '';
    const memberSinceLabel = memberSince
        ? new Date(memberSince).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'long', year: 'numeric',
        })
        : '';

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

    const DOCUMENTS = [
        { label: 'Membership Certificate', to: '/member/certificate/membership' },
        { label: 'Tax Exemption Certificate', to: '/member/certificate/tax-exemption' },
    ];

    if (loading) {
        return (
            <MemberPageShell title="Dashboard" subtitle="Your membership" width="wide">
                <RowsSkeleton rows={5} />
            </MemberPageShell>
        );
    }

    return (
        <MemberPageShell
            title="Dashboard"
            subtitle={`Welcome back, ${firstName}`}
            width="wide"
        >
            <div className="space-y-6">
                {/* ================================ membership card */}
                <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 text-white
                                p-6 lg:p-8 shadow-lg">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                            <h2 className="text-2xl font-bold truncate">{name}</h2>
                            <p className="text-blue-100 text-sm mt-1">
                                {planLabel(plan) || 'Membership'}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2 shrink-0">
                            {/* Absent when the record carries no type, rather than
                                the literal "Lifetime" this printed for everyone
                                while the stored value was 'annual'. */}
                            {membershipType && membershipType !== 'none' ? (
                                <span className="bg-white/20 px-3 py-1.5 rounded-full text-xs font-semibold
                                                 uppercase tracking-wide capitalize">
                                    {membershipType}
                                </span>
                            ) : null}
                            <span className="bg-green-500 px-3 py-1.5 rounded-full text-xs font-bold
                                             uppercase tracking-wide inline-flex items-center gap-1">
                                <BadgeCheck className="w-3.5 h-3.5" /> Active
                            </span>
                        </div>
                    </div>

                    {(memberSinceLabel || memberId) && (
                        <div className="mt-6 pt-5 border-t border-white/20 flex flex-wrap gap-x-10 gap-y-3">
                            {memberSinceLabel ? (
                                <div>
                                    <p className="text-xs text-blue-200 uppercase tracking-wide
                                                  flex items-center gap-1.5">
                                        <CalendarDays className="w-3.5 h-3.5" /> Member since
                                    </p>
                                    <p className="font-semibold mt-0.5">{memberSinceLabel}</p>
                                </div>
                            ) : null}
                            {memberId ? (
                                <div>
                                    <p className="text-xs text-blue-200 uppercase tracking-wide">Member ID</p>
                                    <p className="font-semibold mt-0.5 tracking-wider tabular-nums">{memberId}</p>
                                </div>
                            ) : null}
                        </div>
                    )}
                </div>

                {/* ================================ at a glance */}
                <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                    <StatTile
                        label="Updates"
                        value={updates.length}
                        hint="For your region"
                        icon={<Megaphone className="w-4 h-4" />}
                        to="/member/updates"
                    />
                    <StatTile
                        label="Upcoming events"
                        value={upcomingEvents.length}
                        hint={myEventCount > 0 ? `${myEventCount} registered` : 'In the programme'}
                        icon={<Calendar className="w-4 h-4" />}
                        to="/member/events"
                    />
                    <StatTile
                        label="Profile views"
                        value={analytics.engagement.profileViews}
                        hint={`Last ${analytics.windowDays} days`}
                        icon={<Eye className="w-4 h-4" />}
                    />
                    {entitlements.catalogue ? (
                        <StatTile
                            label="Needs restock"
                            value={analytics.catalogue.lowStock + analytics.catalogue.outOfStock}
                            hint={`${analytics.catalogue.published} lines published`}
                            icon={<AlertTriangle className="w-4 h-4" />}
                            tone={analytics.catalogue.lowStock + analytics.catalogue.outOfStock > 0
                                ? 'warn' : 'neutral'}
                            to="/business/stock"
                        />
                    ) : (
                        <StatTile
                            label="Directory"
                            value="Search"
                            hint="Find members by region"
                            icon={<Search className="w-4 h-4" />}
                            to="/member/directory"
                        />
                    )}
                </div>

                <div className="grid gap-6 lg:grid-cols-12 items-start">
                    {/* ================================ left column */}
                    <div className="lg:col-span-7 space-y-6">
                        {/* ---------- Association Updates (MEM-001) ---------- */}
                        <SectionCard
                            title="Association Updates"
                            subtitle="Targeted to your state, district and block"
                            icon={<Megaphone className="w-5 h-5" />}
                            actionTo="/member/updates"
                        >
                            {sectionsLoading ? (
                                <RowsSkeleton rows={2} />
                            ) : pinnedFirst.length === 0 ? (
                                <EmptyState
                                    icon={<Megaphone className="w-6 h-6" />}
                                    title="No updates yet"
                                    detail="Notices published for your region will appear here first."
                                />
                            ) : (
                                <div className="space-y-3">
                                    {pinnedFirst.slice(0, 3).map((update) => (
                                        <UpdateCard key={update.id} update={update} compact />
                                    ))}
                                </div>
                            )}
                        </SectionCard>

                        {/* ---------- Events (EVT-001, EVT-002) ---------- */}
                        <SectionCard
                            title="Upcoming Events"
                            subtitle={myEventCount > 0
                                ? `You have ${myEventCount} registration${myEventCount === 1 ? '' : 's'}`
                                : 'Open an event for its agenda and to register'}
                            icon={<Calendar className="w-5 h-5" />}
                            actionTo="/member/events"
                        >
                            {sectionsLoading ? (
                                <RowsSkeleton rows={2} />
                            ) : upcomingEvents.length === 0 ? (
                                <EmptyState
                                    icon={<CalendarDays className="w-6 h-6" />}
                                    title="Nothing scheduled"
                                    detail="Events published by the association appear here, members-only ones included."
                                />
                            ) : (
                                <div className="space-y-3">
                                    {upcomingEvents.slice(0, 3).map((event) => (
                                        <EventCard key={event.id} event={event} compact />
                                    ))}
                                </div>
                            )}
                        </SectionCard>

                        {/* ---------- Business suite (BUS-001…004 / ENT-001) ---------- */}
                        {entitlements.catalogue ? (
                            <SectionCard
                                title="Business Suite"
                                subtitle={`Catalogue and stock · last ${analytics.windowDays} days`}
                                icon={<Briefcase className="w-5 h-5" />}
                                actionTo="/business/dashboard"
                                actionLabel="Open"
                            >
                                <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                                    <StatTile
                                        label="Catalogue"
                                        value={analytics.catalogue.total}
                                        hint={`${analytics.catalogue.published} published`}
                                        icon={<Package className="w-4 h-4" />}
                                        to="/business/products"
                                    />
                                    <StatTile
                                        label="Low stock"
                                        value={analytics.catalogue.lowStock}
                                        hint={`${analytics.catalogue.outOfStock} out of stock`}
                                        icon={<AlertTriangle className="w-4 h-4" />}
                                        tone={analytics.catalogue.lowStock > 0 ? 'warn' : 'neutral'}
                                        to="/business/stock"
                                    />
                                    <StatTile
                                        label="Catalogue views"
                                        value={analytics.engagement.productViews}
                                        hint={`Last ${analytics.windowDays} days`}
                                        icon={<Eye className="w-4 h-4" />}
                                        to="/business/analytics"
                                    />
                                    <StatTile
                                        label="Stock value"
                                        value={`₹${analytics.catalogue.stockValue.toLocaleString('en-IN')}`}
                                        hint="On hand, at list price"
                                        icon={<LineChart className="w-4 h-4" />}
                                        to="/business/analytics"
                                    />
                                </div>

                                {/*
                                  * The restock list, right here.
                                  *
                                  * This is the one figure on the dashboard that
                                  * is ACTIONABLE today, so it names the lines
                                  * rather than only counting them — a member who
                                  * has to open two screens to find out which
                                  * product is out of stock will not open either.
                                  */}
                                {lowStock.length > 0 ? (
                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                        <p className="text-[12px] font-semibold uppercase tracking-wide
                                                      text-slate-500 mb-2.5">
                                            Needs restocking
                                        </p>
                                        <ul className="space-y-2">
                                            {lowStock.slice(0, 4).map((line) => (
                                                <li
                                                    key={line.id}
                                                    className="flex items-center gap-3 text-[13px]"
                                                >
                                                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                                                        line.stockState === 'out' ? 'bg-red-500' : 'bg-amber-500'
                                                    }`} />
                                                    <span className="min-w-0 flex-1 truncate font-medium
                                                                     text-slate-800">
                                                        {line.name}
                                                    </span>
                                                    <span className={`shrink-0 tabular-nums font-semibold ${
                                                        line.stockState === 'out'
                                                            ? 'text-red-600' : 'text-amber-600'
                                                    }`}>
                                                        {line.stockState === 'out'
                                                            ? 'Out of stock'
                                                            : `${line.stock} left`}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : null}
                            </SectionCard>
                        ) : (
                            <PlanLockedCard
                                title="Business Suite"
                                explanation={planExplainer(plan, 'catalogue')}
                            />
                        )}
                    </div>

                    {/* ================================ right column */}
                    <div className="lg:col-span-5 space-y-6">
                        {/* ---------- quick actions ---------- */}
                        <SectionCard title="Quick actions" icon={<User className="w-5 h-5" />}>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: 'My Profile', icon: User, to: '/member/profile-view' },
                                    { label: 'Directory', icon: Users, to: '/member/directory' },
                                    { label: 'My Events', icon: Ticket, to: '/member/events' },
                                    { label: 'Settings', icon: Settings, to: '/member/settings' },
                                ].map(({ label, icon: Icon, to }) => (
                                    <button
                                        key={label}
                                        type="button"
                                        onClick={() => navigate(to)}
                                        className="bg-white rounded-xl p-4 flex flex-col items-center justify-center
                                                   border border-slate-200 hover:border-blue-400 hover:bg-blue-50
                                                   transition-colors"
                                    >
                                        <span className="w-11 h-11 bg-blue-50 rounded-xl flex items-center
                                                         justify-center mb-2">
                                            <Icon className="w-5 h-5 text-blue-600" />
                                        </span>
                                        <span className="text-[12.5px] font-semibold text-slate-800 text-center">
                                            {label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </SectionCard>

                        {/* ---------- documents ---------- */}
                        <SectionCard
                            title="Official Documents"
                            subtitle="Issued against your active membership"
                            icon={<FileText className="w-5 h-5" />}
                        >
                            <div className="space-y-3">
                                {DOCUMENTS.map((doc) => (
                                    <button
                                        key={doc.to}
                                        type="button"
                                        onClick={() => navigate(doc.to)}
                                        className="w-full flex items-center justify-between gap-3 p-4 rounded-xl
                                                   border border-slate-200 hover:border-blue-400 hover:bg-blue-50
                                                   transition-colors text-left"
                                    >
                                        <span className="flex items-center gap-3 min-w-0">
                                            <span className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600
                                                             flex items-center justify-center shrink-0">
                                                <FileText className="w-5 h-5" />
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block text-sm font-semibold text-slate-900 truncate">
                                                    {doc.label}
                                                </span>
                                                <span className="block text-xs text-slate-500">
                                                    View, print or save as PDF
                                                </span>
                                            </span>
                                        </span>
                                        <Download className="w-5 h-5 text-blue-500 shrink-0" />
                                    </button>
                                ))}
                            </div>
                        </SectionCard>

                        {/* ---------- business shortcut ---------- */}
                        {entitlements.catalogue ? (
                            <div className="rounded-2xl bg-gradient-to-br from-blue-700 to-blue-900 text-white
                                            p-6 shadow-md">
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <h4 className="text-base font-bold flex items-center gap-1.5">
                                            <Briefcase className="w-4 h-4" /> Business Dashboard
                                        </h4>
                                        <p className="text-xs text-blue-100 mt-1">
                                            Catalogue, stock, companies &amp; analytics
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => navigate('/business/dashboard')}
                                        className="inline-flex items-center gap-1 bg-white text-blue-700
                                                   hover:bg-blue-50 px-4 py-2.5 rounded-xl text-sm font-bold
                                                   shadow-sm transition-colors shrink-0"
                                    >
                                        Open <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ) : null}

                        {/* ---------- activity ---------- */}
                        <SectionCard
                            title="Recent Activity"
                            subtitle="What has happened on your account"
                            icon={<Clock className="w-5 h-5" />}
                        >
                            {activity.length === 0 ? (
                                <EmptyState
                                    icon={<Clock className="w-6 h-6" />}
                                    title="Nothing yet"
                                    detail="Activity appears here as your account changes."
                                />
                            ) : (
                                <div className="divide-y divide-slate-100 -my-1">
                                    {activity.map((row, i) => (
                                        <div key={row.id || i} className="flex items-start gap-3 py-3">
                                            <span className="w-9 h-9 rounded-full bg-blue-50 text-blue-600
                                                             flex items-center justify-center shrink-0">
                                                <Clock className="w-4 h-4" />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-[13.5px] font-medium text-slate-900">
                                                    {row.description || row.type}
                                                </span>
                                                <span className="block text-[11.5px] text-slate-400 mt-0.5">
                                                    {row.at ? new Date(row.at).toLocaleString() : ''}
                                                </span>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </SectionCard>
                    </div>
                </div>
            </div>
        </MemberPageShell>
    );
}
