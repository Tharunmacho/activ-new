import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CalendarDays, CalendarPlus, Users, IndianRupee, Clock, Ticket, RefreshCw, Loader2,
    MapPin, ArrowRight, Tags, FileEdit, CheckCircle2,
} from 'lucide-react';
import AdminSidebar from '@/features/admin/components/AdminSidebar';
import {
    AdminPageHeader, AdminStat, ADMIN_BG, ADMIN_PAGE, ADMIN_CARD, ADMIN_SECONDARY_BTN, rupees,
} from '@/features/admin/components/AdminUI';
import { AdminChip, AdminCount } from '@/features/admin/components/AdminTable';
import { listBookingOverview, type BookingOverview, type BookingOverviewRow } from '@/services/eventBookingAdminApi';
import { errorMessage } from '@/services/api';
import { CARD_TITLE } from '@/components/layout/appTypography';

/**
 * The Events Admin's landing page.
 *
 * Everything on it comes from ONE request — `listBookingOverview`, the same
 * server aggregate the super admin's Bookings screen reads — so the figures
 * here and there cannot disagree. Drafts are included, because this person
 * writes the programme and an unpublished event is work in progress they own.
 *
 * The screens it links to are the super admin's own (All events, Categories,
 * Bookings), mounted under `/events-admin`.
 */

const formatDay = (iso: string | null) => {
    if (!iso) return '';
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return '';
    return at.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTime = (iso: string | null) => {
    if (!iso) return '';
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return '';
    return at.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
};

/** Undated events are not past — a missing date is missing information. */
const isUpcoming = (row: BookingOverviewRow) =>
    !row.startAt || new Date(row.endAt || row.startAt).getTime() >= Date.now();

const EMPTY: BookingOverview = {
    events: [],
    totals: { events: 0, seats: 0, capacity: 0, bookings: 0, collected: 0, pending: 0 },
};

export default function EventsAdminDashboard() {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [data, setData] = useState<BookingOverview>(EMPTY);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const result = await listBookingOverview(true);
            setData(result || EMPTY);
        } catch (err) {
            setError(errorMessage(err, 'Could not load the events overview'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const events = useMemo(() => data?.events || [], [data]);
    const totals = data?.totals || EMPTY.totals;

    const counts = useMemo(() => {
        const list = events || [];
        return {
            all: list.length,
            published: list.filter((e) => e.status === 'published').length,
            drafts: list.filter((e) => e.status !== 'published').length,
            upcoming: list.filter(isUpcoming).length,
        };
    }, [events]);

    /* The next events, soonest first; undated ones lead, as on every events list. */
    const upcoming = useMemo(() => (events || [])
        .filter(isUpcoming)
        .sort((a, b) => {
            if (!a.startAt) return -1;
            if (!b.startAt) return 1;
            return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
        })
        .slice(0, 6), [events]);

    /* Where attention is needed: nearly full, or money still owed. */
    const attention = useMemo(() => (events || []).filter((e) => isUpcoming(e) && (
        (e.totalSeats > 0 && e.remainingSeats !== null && e.remainingSeats <= Math.max(5, e.totalSeats * 0.1))
        || e.pendingAmount > 0
    )).slice(0, 5), [events]);

    const shortcuts = [
        { label: 'Create an event', hint: 'Write, schedule and publish', icon: <CalendarPlus className="w-5 h-5" />, to: '/events-admin/events' },
        { label: 'Manage categories', hint: 'The chips events are filed under', icon: <Tags className="w-5 h-5" />, to: '/events-admin/events/categories' },
        { label: 'Bookings & payments', hint: 'Who is coming, and what was paid', icon: <Ticket className="w-5 h-5" />, to: '/events-admin/bookings' },
    ];

    return (
        <div className={`flex h-screen ${ADMIN_BG}`}>
            <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <AdminPageHeader
                    title="Events Dashboard"
                    subtitle="The programme at a glance — what is coming up, how full it is, and what has been paid."
                    onMenu={() => setSidebarOpen(true)}
                    actions={
                        <button type="button" onClick={load} className={ADMIN_SECONDARY_BTN} disabled={loading}>
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            Refresh
                        </button>
                    }
                />

                <div className={`flex-1 overflow-y-auto ${ADMIN_PAGE}`}>
                    {error && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4
                                        text-[1.25rem] font-semibold text-rose-700">
                            {error}
                        </div>
                    )}

                    {/* ------------------------------------------------ figures */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <AdminStat
                            icon={<CalendarDays className="w-5 h-5" />}
                            label="Events"
                            value={String(counts.all)}
                            hint={`${counts.published} published · ${counts.drafts} draft${counts.drafts === 1 ? '' : 's'}`}
                            tone="blue"
                            primary
                            onClick={() => navigate('/events-admin/events')}
                        />
                        <AdminStat
                            icon={<Users className="w-5 h-5" />}
                            label="Seats booked"
                            value={String(totals.seats)}
                            hint={totals.capacity > 0 ? `of ${totals.capacity} available` : `${totals.bookings} bookings`}
                            tone="violet"
                            onClick={() => navigate('/events-admin/bookings')}
                        />
                        <AdminStat
                            icon={<IndianRupee className="w-5 h-5" />}
                            label="Collected"
                            value={rupees(totals.collected)}
                            hint="money actually received"
                            tone="emerald"
                            onClick={() => navigate('/events-admin/bookings')}
                        />
                        <AdminStat
                            icon={<Clock className="w-5 h-5" />}
                            label="Awaiting payment"
                            value={rupees(totals.pending)}
                            hint="held, not taken"
                            tone="amber"
                            onClick={() => navigate('/events-admin/bookings')}
                        />
                    </div>

                    {/* ---------------------------------------------- shortcuts */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {shortcuts.map((s) => (
                            <button
                                key={s.to}
                                type="button"
                                onClick={() => navigate(s.to)}
                                className={`${ADMIN_CARD} p-5 text-left flex items-center gap-4
                                            hover:border-blue-300 hover:shadow-md transition-all group`}
                            >
                                <span className="w-12 h-12 shrink-0 rounded-xl bg-blue-50 text-blue-600
                                                 flex items-center justify-center">
                                    {s.icon}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[1.25rem] font-semibold text-slate-900">{s.label}</span>
                                    <span className="block text-[1.125rem] text-slate-500 truncate">{s.hint}</span>
                                </span>
                                <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 shrink-0" />
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        {/* ------------------------------------------ upcoming */}
                        <section className={`${ADMIN_CARD} xl:col-span-2 min-w-0`}>
                            <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-100">
                                <h2 className={CARD_TITLE}>Upcoming events</h2>
                                <button
                                    type="button"
                                    onClick={() => navigate('/events-admin/events')}
                                    className="text-[1.125rem] font-semibold text-blue-600 hover:text-blue-700
                                               inline-flex items-center gap-1"
                                >
                                    All events <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>

                            {loading ? (
                                <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
                            ) : upcoming.length === 0 ? (
                                <p className="px-6 py-8 text-[1.25rem] text-slate-500">
                                    Nothing upcoming. Create an event under <strong className="text-slate-700">All events</strong>.
                                </p>
                            ) : (
                                <ul className="divide-y divide-slate-100">
                                    {upcoming.map((e) => (
                                        <li key={e.id}>
                                            <button
                                                type="button"
                                                onClick={() => navigate(`/events-admin/bookings/${e.id}`)}
                                                className="w-full text-left px-5 sm:px-6 py-4 hover:bg-slate-50
                                                           flex items-center gap-4 min-w-0"
                                            >
                                                <div className="w-14 shrink-0 rounded-xl bg-blue-50 text-blue-700 text-center py-2">
                                                    <div className="text-[1.375rem] font-bold leading-none">
                                                        {e.startAt ? new Date(e.startAt).getDate() : '–'}
                                                    </div>
                                                    <div className="text-[0.9375rem] font-semibold uppercase mt-1">
                                                        {e.startAt ? new Date(e.startAt).toLocaleDateString('en-IN', { month: 'short' }) : 'TBC'}
                                                    </div>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-[1.25rem] font-semibold text-slate-900 truncate">
                                                        {e.title || 'Untitled event'}
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[1.125rem] text-slate-500">
                                                        <span>
                                                            {formatDay(e.startAt) || 'Date to be confirmed'}
                                                            {e.startAt && formatTime(e.startAt) ? ` · ${formatTime(e.startAt)}` : ''}
                                                        </span>
                                                        {!!e.venue && (
                                                            <span className="inline-flex items-center gap-1 truncate max-w-[14rem]">
                                                                <MapPin className="w-4 h-4 shrink-0" />
                                                                <span className="truncate">{e.venue}</span>
                                                            </span>
                                                        )}
                                                        {e.status !== 'published'
                                                            ? <AdminChip tone="slate">Draft</AdminChip>
                                                            : <AdminChip tone="emerald">Published</AdminChip>}
                                                    </div>
                                                </div>
                                                <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                                                    <AdminCount tone="emerald">{e.bookedSeats}</AdminCount>
                                                    <span className="text-[1rem] text-slate-400">
                                                        {e.totalSeats > 0 ? `of ${e.totalSeats} seats` : 'seats booked'}
                                                    </span>
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        {/* ----------------------------------------- attention */}
                        <section className={`${ADMIN_CARD} min-w-0`}>
                            <div className="px-5 sm:px-6 py-4 border-b border-slate-100">
                                <h2 className={CARD_TITLE}>Needs attention</h2>
                            </div>
                            {loading ? (
                                <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
                            ) : attention.length === 0 ? (
                                <div className="px-6 py-8 flex items-start gap-3 text-[1.1875rem] text-slate-500">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                    No event is nearly full and no payment is outstanding.
                                </div>
                            ) : (
                                <ul className="divide-y divide-slate-100">
                                    {attention.map((e) => (
                                        <li key={e.id}>
                                            <button
                                                type="button"
                                                onClick={() => navigate(`/events-admin/bookings/${e.id}`)}
                                                className="w-full text-left px-5 sm:px-6 py-4 hover:bg-slate-50"
                                            >
                                                <div className="text-[1.1875rem] font-semibold text-slate-900 truncate">
                                                    {e.title || 'Untitled event'}
                                                </div>
                                                <div className="mt-1 flex flex-wrap gap-2">
                                                    {e.totalSeats > 0 && e.remainingSeats !== null
                                                        && e.remainingSeats <= Math.max(5, e.totalSeats * 0.1) && (
                                                        <AdminChip tone={e.remainingSeats === 0 ? 'rose' : 'amber'}>
                                                            {e.remainingSeats === 0 ? 'Sold out' : `${e.remainingSeats} seats left`}
                                                        </AdminChip>
                                                    )}
                                                    {e.pendingAmount > 0 && (
                                                        <AdminChip tone="amber">{rupees(e.pendingAmount)} awaiting payment</AdminChip>
                                                    )}
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <div className="px-5 sm:px-6 py-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => navigate('/events-admin/events')}
                                    className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl
                                               bg-blue-600 text-white text-[1.1875rem] font-semibold hover:bg-blue-700"
                                >
                                    <FileEdit className="w-4 h-4" /> Open the event editor
                                </button>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
