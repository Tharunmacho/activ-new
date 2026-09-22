import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Search, Users, IndianRupee, Ticket, Clock, X, CheckCircle2, Loader2,
    ChevronLeft, ChevronRight, Ban, RefreshCw, FileSpreadsheet, ArrowLeft,
    ListChecks, BadgePercent, UserCheck,
} from 'lucide-react';
import AdminSidebar from './AdminSidebar';
import {
    AdminPageHeader, AdminStat, ADMIN_BG, ADMIN_CARD, ADMIN_PAGE,
    ADMIN_INPUT, ADMIN_PRIMARY_BTN, ADMIN_SECONDARY_BTN, rupees,
} from '@/features/admin/components/AdminUI';
import { listEvents } from '@/services/activApi';
import {
    listEventBookings, recordBookingPayment, cancelEventBooking,
    listEventAttendees, exportBookingsCsv,
    type BookingPage, type EventAttendee,
} from '@/services/eventBookingAdminApi';
import { AdminTable, AdminChip, type AdminColumn }
    from '@/features/admin/components/AdminTable';
import type { EventBooking } from '@/services/eventBookingApi';
import { errorMessage } from '@/services/api';

import { CARD_TITLE } from '@/components/layout/appTypography';
/**
 * Who is coming to an event, and who has paid.
 *
 * The counterpart of the public "Book Now" flow: every row here is one booking
 * taken through `/events/:id/book`, by a guest or by a signed-in member, with
 * however many participants on it.
 *
 * =========================================================================
 * BOOKINGS ARE NOT REGISTRATIONS, AND THIS SCREEN SHOWS BOOKINGS
 * =========================================================================
 *
 * A member's own seat (`EventRegistration`, taken from inside the member area)
 * is a different collection and a different shape — one row, one person, no
 * booker. Both fill the same room, which is why the SEATS figure below comes
 * from the booking summary and the event's own capacity is reported by the
 * booking endpoint, which counts both. Do not add registrations to this table:
 * they have no booker, no participant list and no total, and every column here
 * would be empty for them.
 *
 * =========================================================================
 * THE TOTALS ARE THE EVENT'S, NOT THE PAGE'S
 * =========================================================================
 *
 * `summary` is computed server-side over every booking on the event, and is
 * deliberately NOT recomputed from `bookings` — that array is one page of ten.
 * Summing the page would make "Rs. 34,000 collected" change every time somebody
 * turned to page two, and narrowing to the unpaid ones would report the takings
 * as zero.
 */

interface EventOption {
    id: string;
    title: string;
    startAt: string | null;
    registrationFee: number;
    capacity: number;
}

/** "25-08-2026" — the form the association's own screens use. */
const formatDay = (iso?: string | null): string => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
};

// The admin area's one money formatter — see its note in `AdminUI`. This file
// used to carry its own, printing `Rs. 2,000` against the overview's `₹2,000`
// for the same booking.

/**
 * The payment status, as a chip.
 *
 * A BLANK CELL IS A REAL ANSWER and is rendered as one. The reference screen
 * shows rows with no Payment Mode and no Payment Status — bookings that were
 * started and never completed — and printing "Pending" in a grey chip where the
 * source data has nothing would be this screen inventing a fact. `pending` is
 * what the server writes for a held booking, so it gets the amber chip; a row
 * that somehow carries neither gets an em dash.
 */
function PaymentChip({ status }: { status: string }) {
    const map: Record<string, { label: string; className: string }> = {
        paid: { label: 'Paid', className: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
        pending: { label: 'Pending', className: 'bg-amber-50 text-amber-700 border-amber-100' },
        not_required: { label: 'Free', className: 'bg-slate-100 text-slate-600 border-slate-200' },
        failed: { label: 'Failed', className: 'bg-rose-50 text-rose-700 border-rose-100' },
    };

    const chip = map[status];
    if (!chip) return <span className="text-slate-300">—</span>;

    return (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1
                          text-[1.1875rem] font-semibold ${chip.className}`}>
            {chip.label}
        </span>
    );
}

function ModeChip({ mode }: { mode: string }) {
    if (!mode) return <span className="text-slate-300">—</span>;

    const label = mode === 'bank_transfer' ? 'Bank' : mode.charAt(0).toUpperCase() + mode.slice(1);
    return (
        <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50
                         px-2.5 py-1 text-[1.1875rem] font-semibold text-blue-700">
            {label}
        </span>
    );
}

export default function SuperAdminBookings() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const navigate = useNavigate();

    /**
     * THE EVENT COMES FROM THE ROUTE, not from a dropdown that remembers it.
     *
     * `/super-admin/bookings/:eventId` — so the screen is linkable, the browser
     * Back button returns to the Booking Events table rather than to whatever
     * was open before this section, and a reload lands on the same event. The
     * picker is still here as a quick switch, and changing it navigates rather
     * than setting local state: two ways to say which event is being looked at
     * is two answers to disagree about.
     */
    const { eventId: routeEventId } = useParams<{ eventId?: string }>();

    const [events, setEvents] = useState<EventOption[]>([]);
    const [eventId, setEventId] = useState(routeEventId || '');

    /**
     * Bookings, or the door list.
     *
     * Two genuinely different questions over the same rows. A booking is the
     * transaction — who paid, how much, by what means. The door list is the
     * room: one booking for four colleagues is one row there and four rows
     * here, and on the door only the second shape is any use, because the
     * person in front of you may be none of the three whose name is on the
     * payment.
     */
    const [tab, setTab] = useState<'bookings' | 'attendees'>('bookings');

    const [attendees, setAttendees] = useState<EventAttendee[]>([]);
    /**
     * Seats sold on this event, named or not.
     *
     * Carried as a number beside the list rather than expanded into rows for
     * people nobody entered - the whole point of the change that removed the
     * "Guest 2 of 4" placeholder.
     */
    const [seatsBooked, setSeatsBooked] = useState(0);
    const [attendeesLoading, setAttendeesLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    /**
     * Bumped by any write, to force the door list to be fetched again.
     *
     * The two tabs read the same bookings through two endpoints, and the detail
     * panel can be open over either of them — so marking a booking paid while
     * the door list is on screen leaves it showing the old status. A nonce in
     * the effect's dependencies is what makes "this is now stale" expressible;
     * clearing the array would only blank it until the next render put it back.
     */
    const [attendeeNonce, setAttendeeNonce] = useState(0);
    const [eventsLoading, setEventsLoading] = useState(true);

    const [data, setData] = useState<BookingPage | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [paymentStatus, setPaymentStatus] = useState<'' | 'paid' | 'pending'>('');

    const [open, setOpen] = useState<EventBooking | null>(null);
    const [acting, setActing] = useState('');

    /* ------------------------------------------------------------- events */

    useEffect(() => {
        let cancelled = false;

        listEvents({ limit: 200 })
            .then((response: any) => {
                if (cancelled) return;
                // `/events` answers `{ events, total }`; an older build answered
                // a bare array. Both are read rather than assumed, because a
                // mismatch here renders an empty picker with no error.
                const rows: any[] = Array.isArray(response) ? response : (response?.events || []);
                setEvents(rows.map((e) => ({
                    id: String(e.id || e._id || ''),
                    title: e.title || 'Untitled event',
                    startAt: e.startAt || null,
                    registrationFee: Number(e.registrationFee || 0),
                    capacity: Number(e.capacity || 0),
                })).filter((e) => e.id));
                setEventsLoading(false);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(errorMessage(err, 'The event list could not be loaded'));
                setEventsLoading(false);
            });

        return () => { cancelled = true; };
    }, []);

    /**
     * The route wins. Always.
     *
     * Arriving from the Booking Events table, going Back, or pasting a link all
     * change the URL; this is what makes the screen follow. Without it the
     * component would keep whichever event it selected first and the Back button
     * would appear not to work.
     */
    useEffect(() => {
        if (routeEventId && routeEventId !== eventId) setEventId(routeEventId);
    }, [routeEventId, eventId]);

    /**
     * Opened with no event in the URL — fall back to the first one.
     *
     * `replace`, not `push`: this is a redirect, not a step the admin took, and
     * leaving it in the history means Back lands on the same screen it just
     * left and bounces forward again.
     */
    useEffect(() => {
        if (!routeEventId && events.length) {
            navigate(`/super-admin/bookings/${events[0].id}`, { replace: true });
        }
    }, [events, routeEventId, navigate]);

    /* ----------------------------------------------------------- bookings */

    const load = useCallback(() => {
        if (!eventId) return;

        setLoading(true);
        setError('');

        listEventBookings(eventId, { page, limit: 10, search, paymentStatus })
            .then((response) => {
                setData(response);
                setLoading(false);
            })
            .catch((err) => {
                setError(errorMessage(err, 'The bookings could not be loaded'));
                setLoading(false);
            });
    }, [eventId, page, search, paymentStatus]);

    useEffect(() => { load(); }, [load]);

    /**
     * The door list, fetched only when its tab is open.
     *
     * It is not paged — the whole list is the point, since an organiser scrolls
     * it or searches it rather than turning pages at a door — so it is the one
     * request on this screen that grows with the event. Loading it up front for
     * every admin who only wanted the payment totals would put a 400-row
     * response behind every visit to this page.
     */
    useEffect(() => {
        if (tab !== 'attendees' || !eventId) return;
        let cancelled = false;

        setAttendeesLoading(true);
        listEventAttendees(eventId)
            .then((response) => {
                if (cancelled) return;
                setAttendees(response.attendees || []);
                setSeatsBooked(Number(response.seatsBooked || 0));
            })
            .catch((err) => {
                if (cancelled) return;
                setError(errorMessage(err, 'The attendee list could not be loaded'));
            })
            .finally(() => { if (!cancelled) setAttendeesLoading(false); });

        return () => { cancelled = true; };
    }, [tab, eventId, attendeeNonce]);

    /**
     * Marking a booking paid or cancelling it changes the door list too.
     *
     * The two tabs read the same rows through two endpoints, so a write on one
     * leaves the other stale — an organiser who marks a booking paid and
     * switches to the door list would see it still showing as unpaid. Dropping
     * the cached list forces a refetch the next time that tab is opened.
     */
    const invalidateAttendees = useCallback(() => setAttendeeNonce((n) => n + 1), []);

    const downloadCsv = async () => {
        if (!eventId) return;
        setExporting(true);
        setError('');
        try {
            await exportBookingsCsv(eventId, selected?.title || 'event');
        } catch (err) {
            setError(errorMessage(err, 'The report could not be downloaded'));
        } finally {
            setExporting(false);
        }
    };

    /*
     * Changing the event or the filter goes back to page one.
     *
     * Without this, an admin on page 3 of a 34-booking event who switches to an
     * event with four bookings gets an empty table and a pager that says
     * "Showing 21 to 30 of 4" — which reads as data loss rather than as a stale
     * page number.
     */
    useEffect(() => { setPage(1); }, [eventId, search, paymentStatus]);

    const selected = useMemo(
        () => events.find((e) => e.id === eventId) || null,
        [events, eventId],
    );

    const summary = data?.summary;
    const pagination = data?.pagination;
    const rows = data?.bookings || [];

    /** "Showing 11 to 20 of 34 entries" — the reference screen's own line. */
    const showingLine = (() => {
        if (!pagination || !pagination.total) return 'No entries';
        const from = (pagination.page - 1) * pagination.limit + 1;
        const to = Math.min(pagination.page * pagination.limit, pagination.total);
        return `Showing ${from} to ${to} of ${pagination.total} entries`;
    })();

    /* ------------------------------------------------------------ actions */

    const markPaid = async (booking: EventBooking) => {
        setActing(booking.bookingRef);
        try {
            const updated = await recordBookingPayment(eventId, booking.bookingRef, 'offline');
            setOpen(updated);
            load();
            invalidateAttendees();
        } catch (err) {
            setError(errorMessage(err, 'The payment could not be recorded'));
        } finally {
            setActing('');
        }
    };

    const cancel = async (booking: EventBooking) => {
        setActing(booking.bookingRef);
        try {
            await cancelEventBooking(eventId, booking.bookingRef, 'Cancelled by administrator');
            setOpen(null);
            load();
            // A cancelled booking frees its seats, so the door list is now one
            // party shorter — see the note on the nonce.
            invalidateAttendees();
        } catch (err) {
            setError(errorMessage(err, 'The booking could not be cancelled'));
        } finally {
            setActing('');
        }
    };

    /* -------------------------------------------------------------- render */

    return (
        <div className={`flex h-screen ${ADMIN_BG}`}>
            <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <AdminPageHeader
                    title="Event Bookings"
                    subtitle="Seats booked through the public Book Now page, and what has been paid"
                    onMenu={() => setSidebarOpen(true)}
                    backTo="/super-admin/bookings"
                    actions={
                        <>
                            <button
                                type="button"
                                onClick={() => navigate('/super-admin/bookings')}
                                className={ADMIN_SECONDARY_BTN}
                            >
                                <ArrowLeft className="w-4 h-4" /> All events
                            </button>
                            {/*
                              * The spreadsheet.
                              *
                              * A CSV, and the button says Excel because that is
                              * what it will be opened in — see the server's note
                              * on why a real workbook was not worth a binary
                              * dependency. It is FETCHED rather than linked: the
                              * route is behind the admin token and a plain link
                              * carries no Authorization header.
                              */}
                            <button
                                type="button"
                                onClick={downloadCsv}
                                className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl
                                           bg-emerald-600 text-[1.1875rem] font-semibold text-white shadow-sm
                                           transition-colors hover:bg-emerald-700 disabled:opacity-60"
                                disabled={exporting || !eventId}
                            >
                                {exporting
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <FileSpreadsheet className="w-4 h-4" />}
                                Excel Report
                            </button>
                            <button type="button" onClick={load} className={ADMIN_SECONDARY_BTN} disabled={loading}>
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                            </button>
                        </>
                    }
                />

                <div className={`flex-1 overflow-y-auto ${ADMIN_PAGE}`}>

                    {/* ---------------------------------------------- picker */}
                    <div className={`${ADMIN_CARD} p-4 sm:p-5`}>
                        <label className="block text-[1.0625rem] sm:text-[1rem] font-semibold uppercase
                                          tracking-wider text-slate-500 mb-2.5">
                            Event
                        </label>
                        <select
                            value={eventId}
                            /*
                             * Navigate, do not setState. The route is the one
                             * record of which event is open — see the note on
                             * `routeEventId` above — and writing local state
                             * here would give the screen a second answer that
                             * the URL, the Back button and a reload disagree
                             * with.
                             */
                            onChange={(e) => navigate(`/super-admin/bookings/${e.target.value}`)}
                            disabled={eventsLoading || !events.length}
                            className={ADMIN_INPUT}
                        >
                            {eventsLoading && <option>Loading events…</option>}
                            {!eventsLoading && !events.length && <option>No events yet</option>}
                            {events.map((e) => (
                                <option key={e.id} value={e.id}>
                                    {e.title}
                                    {e.startAt ? ` — ${formatDay(e.startAt)}` : ''}
                                    {e.registrationFee > 0 ? ` — ${rupees(e.registrationFee)}` : ' — Free'}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* ---------------------------------------------- totals */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <AdminStat
                            icon={<Ticket className="w-5 h-5" />}
                            label="Bookings"
                            value={String(summary?.bookings ?? 0)}
                            hint={`${summary?.paidBookings ?? 0} paid`}
                            tone="blue"
                            primary
                        />
                        <AdminStat
                            icon={<Users className="w-5 h-5" />}
                            label="Seats taken"
                            value={String(summary?.seats ?? 0)}
                            hint={selected && selected.capacity > 0
                                ? `of ${selected.capacity}`
                                : 'no seat limit set'}
                            tone="violet"
                        />
                        <AdminStat
                            icon={<IndianRupee className="w-5 h-5" />}
                            label="Collected"
                            value={rupees(summary?.collected ?? 0)}
                            hint="money actually received"
                            tone="emerald"
                        />
                        <AdminStat
                            icon={<Clock className="w-5 h-5" />}
                            label="Awaiting payment"
                            value={rupees(summary?.pending ?? 0)}
                            hint={`${summary?.pendingBookings ?? 0} booking${
                                (summary?.pendingBookings ?? 0) === 1 ? '' : 's'}`}
                            tone="amber"
                        />
                    </div>

                    {/* ------------------------------------------------- tabs */}
                    {/*
                      * Two views of the same event, and the labels carry the
                      * counts so the choice is informed before it is made. "34
                      * bookings / 61 attending" is itself the answer to the
                      * commonest question on this screen.
                      */}
                    <div className="flex gap-1 p-1 rounded-xl bg-slate-100 w-full sm:w-auto sm:inline-flex">
                        {([
                            ['bookings', 'Bookings', <Ticket key="t" className="w-4 h-4" />,
                                summary ? `${summary.bookings}` : ''],
                            ['attendees', 'Who is coming', <UserCheck key="u" className="w-4 h-4" />,
                                summary ? `${summary.seats}` : ''],
                        ] as const).map(([value, label, icon, count]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setTab(value)}
                                aria-pressed={tab === value}
                                className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2
                                            h-12 px-5 rounded-xl text-[1.25rem] font-semibold transition-colors
                                            ${tab === value
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                {icon}
                                {label}
                                {!!count && (
                                    <span className={`text-[1.1875rem] font-semibold tabular-nums px-2 py-0.5 rounded-lg
                                                      ${tab === value ? 'bg-blue-50 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {tab === 'attendees' && (
                        <AttendeePanel
                            rows={attendees}
                            loading={attendeesLoading}
                            seatsBooked={seatsBooked}
                        />
                    )}

                    {tab === 'bookings' && (<>
                    {/* ---------------------------------------------- filters */}
                    <div className={`${ADMIN_CARD} p-4 sm:p-5 flex flex-col sm:flex-row gap-3`}>
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Name, email, mobile or booking reference"
                                className={`${ADMIN_INPUT} pl-10`}
                            />
                        </div>

                        <div className="flex gap-2">
                            {([
                                ['', 'All'],
                                ['paid', 'Paid'],
                                ['pending', 'Unpaid'],
                            ] as const).map(([value, label]) => (
                                <button
                                    key={value || 'all'}
                                    type="button"
                                    onClick={() => setPaymentStatus(value)}
                                    aria-pressed={paymentStatus === value}
                                    className={
                                        'h-12 px-5 rounded-xl text-[1.25rem] font-semibold transition-colors '
                                        + (paymentStatus === value
                                            ? 'bg-blue-600 text-white'
                                            : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50')
                                    }
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4
                                        text-[1.25rem] font-semibold text-rose-700">
                            {error}
                        </div>
                    )}

                    {/* ----------------------------------------------- table */}
                    <div className={`${ADMIN_CARD} overflow-hidden`}>
                        <div className="overflow-x-auto">
                            {/*
                              `min-w-[76rem]`, not 60. Nine columns including an
                              email address and a "View Booking Details" button do
                              not fit in 960px: the table compressed to the
                              container instead of overflowing, which crushed
                              tharunroobika@gmail.com into four stacked lines and
                              clipped the action button to "View Booking Det".
                              Wide enough to overflow is what makes the scroll bar
                              appear and every column readable.
                            */}
                            <table className="w-full text-left border-collapse min-w-[76rem]">
                                <thead>
                                    <tr className="bg-slate-50">
                                        {[
                                            'S.No', 'Name', 'Email', 'Mobile', 'Payment Mode',
                                            'Payment Status', 'No Of Participants', 'Total Amount', 'Action',
                                        ].map((head) => (
                                            <th
                                                key={head}
                                                /* Matched to `AdminTable`'s head cell — 13px bold
                                                   capitals on a 16px table. This screen and the
                                                   overview above it are one section and must not
                                                   set the same heading two different ways. */
                                                className="px-5 py-4 text-[1.0625rem] sm:text-[1rem] font-semibold
                                                           uppercase tracking-wider text-slate-500
                                                           border-b border-slate-200 whitespace-nowrap"
                                            >
                                                {head}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>

                                <tbody>
                                    {loading && (
                                        <tr>
                                            <td colSpan={9} className="px-4 py-16 text-center text-slate-400">
                                                <Loader2 className="w-5 h-5 animate-spin inline" />
                                            </td>
                                        </tr>
                                    )}

                                    {!loading && !rows.length && (
                                        <tr>
                                            <td colSpan={9} className="px-4 py-16 text-center">
                                                <p className="text-[1.25rem] font-semibold text-slate-500">
                                                    {search || paymentStatus
                                                        ? 'No bookings match that filter.'
                                                        : 'No bookings for this event yet.'}
                                                </p>
                                            </td>
                                        </tr>
                                    )}

                                    {!loading && rows.map((booking, i) => (
                                        <tr
                                            key={booking.bookingRef}
                                            className={
                                                'border-b border-slate-100 last:border-0 hover:bg-slate-50/70 '
                                                + (booking.status === 'cancelled' ? 'opacity-50' : '')
                                            }
                                        >
                                            {/*
                                              The running number continues across pages — row 11 on
                                              page 2 is "11", as the reference screen shows. A
                                              per-page 1-10 would make two different bookings both
                                              "row 3" in the same conversation.
                                            */}
                                            <td className="px-5 py-4 text-[1.25rem] text-slate-400 font-semibold tabular-nums">
                                                {((pagination?.page || 1) - 1) * (pagination?.limit || 10) + i + 1}
                                            </td>
                                            <td className="px-5 py-4 text-[1.25rem] font-semibold tracking-tight
                                                           text-slate-900 whitespace-nowrap">
                                                {booking.bookedBy.name || '—'}
                                                {booking.status === 'cancelled' && (
                                                    <span className="ml-2 text-[1.1875rem] font-semibold text-rose-600">
                                                        Cancelled
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-[1.25rem] text-slate-600 whitespace-nowrap">
                                                {booking.bookedBy.email || '—'}
                                            </td>
                                            <td className="px-5 py-4 text-[1.25rem] text-slate-600 tabular-nums">
                                                {booking.bookedBy.phone || '—'}
                                            </td>
                                            <td className="px-5 py-4"><ModeChip mode={booking.payment.mode} /></td>
                                            <td className="px-5 py-4">
                                                <PaymentChip status={booking.payment.status} />
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="inline-flex items-center justify-center min-w-[3rem]
                                                                 rounded-xl bg-blue-600/90 px-3 py-1.5 text-[1.25rem]
                                                                 font-semibold text-white tabular-nums">
                                                    {booking.noOfPersons}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-[1.25rem] font-semibold text-slate-900 tabular-nums">
                                                {booking.totalAmount > 0 ? rupees(booking.totalAmount) : 'Free'}
                                                {/*
                                                  * WHICH RATE THIS WAS TAKEN AT,
                                                  * read off the booking.
                                                  *
                                                  * Without it an organiser
                                                  * reconciling a column of totals
                                                  * finds two different amounts for
                                                  * the same number of seats and
                                                  * nothing on screen explaining
                                                  * why. It is never recomputed from
                                                  * the booker's membership today —
                                                  * that answer changes on its own.
                                                  */}
                                                {booking.memberRateApplied && (
                                                    <div className="mt-1.5 inline-flex items-center gap-1
                                                                    text-[1.1875rem] font-semibold text-emerald-600">
                                                        <BadgePercent className="w-3.5 h-3.5" />
                                                        Member rate
                                                        {booking.memberSaving > 0
                                                            && ` · saved ${rupees(booking.memberSaving)}`}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                <button
                                                    type="button"
                                                    onClick={() => setOpen(booking)}
                                                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600
                                                               h-11 px-4 text-[1.1875rem] font-semibold text-white
                                                               hover:bg-blue-700 transition-colors whitespace-nowrap"
                                                >
                                                    View Booking Details
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* -------------------------------------------- pager */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3
                                        border-t border-slate-200 px-4 py-3.5">
                            <p className="text-[1.25rem] text-slate-500">{showingLine}</p>

                            {!!pagination && pagination.pages > 1 && (
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        disabled={pagination.page <= 1}
                                        className="h-11 w-11 inline-flex items-center justify-center rounded-xl
                                                   border border-slate-200 text-slate-600 disabled:opacity-40
                                                   hover:bg-slate-50 transition-colors"
                                        aria-label="Previous page"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>

                                    {Array.from({ length: pagination.pages }, (_, i) => i + 1)
                                        /*
                                         * A window around the current page. An event with
                                         * sixty pages would otherwise render sixty buttons
                                         * and wrap the pager over four lines.
                                         */
                                        .filter((n) => Math.abs(n - pagination.page) <= 2
                                            || n === 1 || n === pagination.pages)
                                        .map((n, idx, all) => (
                                            <span key={n} className="flex items-center">
                                                {idx > 0 && all[idx - 1] !== n - 1 && (
                                                    <span className="px-1 text-slate-300">…</span>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setPage(n)}
                                                    aria-current={n === pagination.page ? 'page' : undefined}
                                                    className={
                                                        'h-11 min-w-[2.75rem] px-3 rounded-xl text-[1.25rem] font-semibold '
                                                        + 'transition-colors '
                                                        + (n === pagination.page
                                                            ? 'bg-blue-600 text-white'
                                                            : 'border border-slate-200 text-slate-600 hover:bg-slate-50')
                                                    }
                                                >
                                                    {n}
                                                </button>
                                            </span>
                                        ))}

                                    <button
                                        type="button"
                                        onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                                        disabled={pagination.page >= pagination.pages}
                                        className="h-11 w-11 inline-flex items-center justify-center rounded-xl
                                                   border border-slate-200 text-slate-600 disabled:opacity-40
                                                   hover:bg-slate-50 transition-colors"
                                        aria-label="Next page"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    </>)}
                </div>
            </div>

            {/* ------------------------------------------------ detail panel */}
            {open && (
                <BookingDetail
                    booking={open}
                    event={selected}
                    acting={acting === open.bookingRef}
                    onClose={() => setOpen(null)}
                    onMarkPaid={() => markPaid(open)}
                    onCancel={() => cancel(open)}
                />
            )}
        </div>
    );
}

/**
 * WHO IS COMING — one row per person, not per booking.
 *
 * =========================================================================
 * THIS IS NOT THE BOOKINGS TABLE WITH DIFFERENT COLUMNS
 * =========================================================================
 *
 * A booking is a transaction; this is the room. One booking for four colleagues
 * is ONE row on the other tab and FOUR here, and on the door only this shape is
 * any use — the person standing in front of you may be none of the three whose
 * name is on the payment, and an organiser ticking names off a booking list
 * would turn them away.
 *
 * THE BOOKER IS NOT LISTED UNLESS THEY ARE ALSO ATTENDING. An office manager
 * who books four seats and does not come is not in the room; their name is
 * carried on each of their four rows as "booked by", which is who to ask about
 * that seat, rather than taking a fifth chair that does not exist.
 *
 * UNNAMED SEATS ARE STILL LISTED, as "Guest 2 of 4". A booking for four where
 * only the first name was typed is four people arriving, and dropping the
 * unnamed three would under-report the event by three chairs on the one screen
 * whose whole job is to count them.
 */
function AttendeePanel({ rows, loading, seatsBooked = 0 }: {
    rows: EventAttendee[];
    loading: boolean;
    /** Every seat sold on this event, named or not. Reported, never expanded. */
    seatsBooked?: number;
}) {
    const columns: AdminColumn<EventAttendee>[] = useMemo(() => [
        {
            key: 'sno',
            header: 'S.No',
            width: 'w-16',
            render: (_row, index) => (
                <span className="font-semibold text-slate-400 tabular-nums">{index + 1}</span>
            ),
        },
        {
            key: 'name',
            header: 'Name',
            sortValue: (row) => row.name,
            render: (row) => (
                <div className="min-w-0">
                    {/* Every listed row is a person somebody entered — the
                        unnamed-seat placeholder is gone from the server. */}
                    <div className="font-semibold truncate text-slate-900">
                        {row.name}
                    </div>
                    {row.bookedByName && row.bookedByName !== row.name && (
                        <div className="text-[1.0625rem] text-slate-500 mt-0.5 truncate">
                            booked by {row.bookedByName}
                        </div>
                    )}
                </div>
            ),
        },
        {
            key: 'email',
            header: 'Email',
            hideOnMobile: true,
            sortValue: (row) => row.email,
            render: (row) => (
                <span className="text-slate-600">
                    {/* Their own address, or the booker's when this participant
                        gave none — a real address either way. Blank when
                        neither exists; no dash standing in for one. */}
                    {row.email || <span className="text-slate-400">{row.bookedByEmail}</span>}
                </span>
            ),
        },
        {
            key: 'phone',
            header: 'Mobile',
            hideOnMobile: true,
            sortValue: (row) => row.phone,
            render: (row) => (
                <span className="text-slate-600 tabular-nums">
                    {row.phone || <span className="text-slate-400">{row.bookedByPhone}</span>}
                </span>
            ),
        },
        {
            key: 'ref',
            header: 'Booking Ref',
            hideOnMobile: true,
            sortValue: (row) => row.bookingRef,
            render: (row) => (
                <span className="font-mono text-[1.0625rem] font-semibold text-slate-500">{row.bookingRef}</span>
            ),
        },
        {
            key: 'who',
            header: 'Booked As',
            align: 'center',
            width: 'w-32',
            sortValue: (row) => (row.isGuest ? 'Guest' : 'Member'),
            render: (row) => (row.isGuest
                ? <AdminChip tone="slate">Guest</AdminChip>
                : <AdminChip tone="violet">Member</AdminChip>),
        },
        {
            key: 'payment',
            header: 'Payment',
            align: 'center',
            width: 'w-40',
            sortValue: (row) => row.paymentStatus,
            render: (row) => (
                <div className="flex flex-col items-center gap-1">
                    <AdminChip tone={row.paymentStatus === 'paid' ? 'emerald'
                        : row.paymentStatus === 'not_required' ? 'blue'
                            : row.paymentStatus === 'failed' ? 'rose' : 'amber'}>
                        {row.paymentStatus === 'paid' ? 'Paid'
                            : row.paymentStatus === 'not_required' ? 'Free'
                                : row.paymentStatus === 'failed' ? 'Failed' : 'Unpaid'}
                    </AdminChip>
                    {row.isMemberRate && (
                        <span className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-emerald-600">
                            <BadgePercent className="w-3 h-3" /> Member rate
                        </span>
                    )}
                </div>
            ),
        },
        {
            key: 'status',
            header: 'Seat',
            align: 'center',
            width: 'w-32',
            sortValue: (row) => row.status,
            render: (row) => (row.status === 'waitlist'
                /* A waitlisted party holds no seat — that is the whole point of
                   the list — and must not be ticked off at the door as though
                   it did. */
                ? <AdminChip tone="amber" title="No seat held — the event was full when this was booked.">
                    Waiting list
                </AdminChip>
                : <AdminChip tone="emerald">Confirmed</AdminChip>),
        },
    ], []);

    const confirmed = rows.filter((r) => r.status !== 'waitlist').length;
    const waiting = rows.length - confirmed;

    return (
        <AdminTable
            rows={rows}
            columns={columns}
            rowKey={(row) => row.key}
            loading={loading}
            searchable
            searchPlaceholder="Search a name, email, mobile or booking reference"
            pageSize={25}
            minWidth="70rem"
            empty="Nobody has booked a seat on this event yet."
            footer={!loading && rows.length ? (
                <div className="px-5 py-4 border-t border-slate-100 bg-blue-50/40
                                text-[1.25rem] font-semibold text-slate-600 flex flex-wrap gap-x-6 gap-y-1">
                    <span>
                        <ListChecks className="inline w-4 h-4 mr-1 text-blue-600" />
                        {/* Names, not seats. The list holds the people who were
                            entered; seats that were paid for without a name
                            are counted beside it rather than invented as rows. */}
                        <span className="font-semibold text-slate-900">{confirmed}</span> named
                    </span>
                    {seatsBooked > confirmed + waiting && (
                        <span>
                            <span className="font-semibold text-slate-900">{seatsBooked}</span>
                            {' '}seats booked in total
                        </span>
                    )}
                    {!!waiting && (
                        <span className="text-amber-700">
                            <span className="font-semibold">{waiting}</span> on the waiting list — no seat held
                        </span>
                    )}
                </div>
            ) : undefined}
        />
    );
}

/**
 * One booking in full — the "View Booking Details" panel.
 *
 * A SLIDE-OVER, NOT A MODAL DIALOG over the table. The participant list can be
 * a dozen rows and an admin reads it against the row they clicked; a centred
 * dialog covers exactly the thing they were looking at. It is also why the
 * table stays mounted underneath.
 */
function BookingDetail(props: {
    booking: EventBooking;
    /**
     * The event this booking is against, for the one figure the BOOKING does
     * not carry: how many seats the room holds.
     *
     * Optional and explicitly typed, because without the prop `event` resolves
     * to the DOM's own global `Event` — which has no `capacity`, compiles on
     * some paths and is never the object meant.
     */
    event: EventOption | null;
    acting: boolean;
    onClose: () => void;
    onMarkPaid: () => void;
    onCancel: () => void;
}) {
    const { booking, event, acting, onClose, onMarkPaid, onCancel } = props;

    /* Escape closes it. A panel that can only be dismissed by finding a small
       × is one an admin leaves open and scrolls the page behind. */
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    /**
     * One labelled field.
     *
     * `ReactNode` rather than `string` for the value, so a payment status can
     * arrive as a chip and still sit in the same grid as the plain fields. The
     * label is 13px bold caps and the value 16px — the same pairing the admin
     * area's cards use, rather than the 12/14 this panel had.
     */
    /*
     * A FIELD WITH NO VALUE IS NOT DRAWN.
     *
     * It used to render the label with a grey dash under it, which puts a
     * question on the screen that the record cannot answer - and eight of them
     * on a sparse booking reads as data that has gone missing rather than as
     * data nobody was asked for. What was filled in is shown; what was not is
     * absent.
     */
    const row = (label: string, value: ReactNode) => {
        const empty = value === null || value === undefined || value === '' || value === false;
        if (empty) return null;
        return (
            <div className="py-3 border-b border-slate-100 last:border-0">
                <dt className="text-[1.0625rem] sm:text-[1rem] font-semibold uppercase tracking-wider
                               text-slate-400 mb-1">
                    {label}
                </dt>
                <dd className="text-[1.25rem] font-semibold text-slate-800 break-words min-w-0">
                    {value}
                </dd>
            </div>
        );
    };

    /**
     * The participants who were actually entered.
     *
     * A participant row with no name is a slot the booker skipped, not a person
     * — the form keeps as many boxes as there are seats and does not require
     * any of them to be filled.
     */
    const named = (booking.participants || []).filter(
        (person) => (person.name || '').trim() || (person.email || '').trim() || (person.phone || '').trim(),
    );

    /** A payment word, as the chip the table beside it uses. */
    const paymentChip = () => {
        const status = booking.payment.status;
        return (
            <AdminChip tone={status === 'paid' ? 'emerald'
                : status === 'not_required' ? 'blue'
                    : status === 'failed' ? 'rose' : 'amber'}>
                {status === 'paid' ? 'Paid'
                    : status === 'not_required' ? 'Free'
                        : status === 'failed' ? 'Failed' : 'Pending'}
            </AdminChip>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-6">
            <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            />

            <aside
                role="dialog"
                aria-modal="true"
                aria-label={`Booking ${booking.bookingRef}`}
                /* 3xl, not 4xl. The field rows sit two abreast from `sm` and at
                   36rem they had no room to — but 4xl (896px) is the entire
                   width of a laptop running at 150%, which is how a card comes
                   to read as a page. 48rem keeps both. */
                className="relative w-full sm:max-w-3xl h-full sm:h-auto sm:max-h-[88vh]
                           bg-slate-50 shadow-2xl sm:rounded-2xl border border-slate-200
                           flex flex-col overflow-hidden"
            >
                <header className="shrink-0 bg-white border-b border-slate-200 px-5 sm:px-6 py-4
                                   flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        {/* The EVENT names the sheet, the reference identifies
                           it. The panel led with the reference alone, which is
                           the one thing on it that means nothing to a reader. */}
                        <h2 className={`${CARD_TITLE} text-slate-900 truncate`}>
                            {booking.eventTitle || 'Untitled event'}
                        </h2>
                        <p className="text-[1.25rem] text-slate-500 mt-0.5 font-mono break-all">
                            {booking.bookingRef}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="shrink-0 text-slate-400 hover:text-slate-700 transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </header>

                <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-5 space-y-6">

                    {/* ------------------------------------- event details */}
                    <section className={`${ADMIN_CARD} p-5 sm:p-6`}>
                        <h3 className={`${CARD_TITLE} text-slate-900 mb-3`}>
                            Event Details
                        </h3>
                        {/*
                          * TWO ABREAST from `sm`, which is what the widened
                          * panel buys. One field per line ran this sheet to
                          * three screens and put the total out of sight of the
                          * seat count it is derived from.
                          */}
                        <dl className="grid sm:grid-cols-2 gap-x-8">
                            {row('Event Name', booking.eventTitle)}
                            {row('Date', formatDay(booking.eventStartAt))}
                            {/*
                              * TICKET PRICE IS NOT REPEATED HERE.
                              *
                              * This row and the one in Booking Details below
                              * printed the SAME field — `booking.unitAmount` —
                              * under the same label, three centimetres apart.
                              * It belongs with the total it multiplies into.
                              */}
                            {/* From the EVENT, not the booking — a booking does
                                not carry the room's size. Omitted, rather than
                                called "Unlimited", when no cap was set: no
                                number was entered, so none is shown. */}
                            {row('No Of Seat', event && event.capacity > 0 ? String(event.capacity) : '')}
                            {row('Venue', booking.eventVenue)}
                        </dl>
                    </section>

                    {/* ----------------------------------- booking details */}
                    <section className={`${ADMIN_CARD} p-5 sm:p-6`}>
                        <h3 className={`${CARD_TITLE} text-slate-900 mb-3`}>
                            Booking Details
                        </h3>
                        <dl className="grid sm:grid-cols-2 gap-x-8">
                            {row('Booking Date', booking.createdAt
                                ? new Date(booking.createdAt).toLocaleString('en-IN', {
                                    day: '2-digit', month: 'short', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit',
                                })
                                : '')}
                            {row('Name', booking.bookedBy.name)}
                            {row('Email', booking.bookedBy.email)}
                            {row('Mobile', booking.bookedBy.phone)}
                            {row('No Of Participants', booking.noOfPersons ? String(booking.noOfPersons) : '')}
                            {row('Booked As', booking.isGuest ? 'Guest' : 'Signed-in member')}
                            {row('Ticket Price', booking.unitAmount > 0 ? rupees(booking.unitAmount) : 'Free')}
                            {row('Total Amount', booking.totalAmount > 0 ? rupees(booking.totalAmount) : 'Free')}
                            {row('Payment Mode', booking.payment.mode
                                ? <AdminChip tone="amber">{booking.payment.mode}</AdminChip>
                                : null)}
                            {row('Payment Status', paymentChip())}
                            {/* Only when it was actually applied — an empty
                                "Rate" row on every standard-price booking is a
                                field that asks a question about nothing. */}
                            {booking.memberRateApplied
                                ? row('Rate Applied', (
                                    <span className="inline-flex items-center gap-1.5 text-emerald-600">
                                        <BadgePercent className="w-4 h-4" />
                                        Member price
                                        {booking.memberSaving > 0 && ` · saved ${rupees(booking.memberSaving)}`}
                                    </span>
                                ))
                                : null}
                        </dl>
                    </section>

                    {/* -------------------------------------- participants */}
                    <section className={`${ADMIN_CARD} overflow-hidden`}>
                        <h3 className={`${CARD_TITLE} text-slate-900 px-5 sm:px-6 pt-5 sm:pt-6 pb-3`}>
                            Participants
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[34rem]">
                                <thead>
                                    <tr className="bg-slate-50 border-y border-slate-200">
                                        {['S.No', 'Name', 'Email', 'Mobile'].map((head) => (
                                            <th
                                                key={head}
                                                className="px-5 py-4 text-[1.0625rem] sm:text-[1rem] font-semibold
                                                           uppercase tracking-wider text-slate-500 whitespace-nowrap"
                                            >
                                                {head}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {/*
                                      * ONLY THE PEOPLE WHO WERE ENTERED.
                                      *
                                      * This table used to be padded out to the
                                      * seat count with rows reading "Guest 2 of
                                      * 2 — —": a person nobody had recorded,
                                      * manufactured so the row count would match
                                      * the number of seats. The seat count is
                                      * "No Of Participants" above, where it is a
                                      * recorded number rather than a row.
                                      *
                                      * A cell inside a listed row is left blank
                                      * for the same reason — no dash standing in
                                      * for an address that was never given.
                                      */}
                                    {named.map((person, i) => (
                                        <tr key={i} className={`border-b border-slate-100 last:border-0
                                                                ${i % 2 === 1 ? 'bg-slate-50/60' : ''}`}>
                                            <td className="px-5 py-4 text-[1.25rem] font-semibold text-slate-400 tabular-nums">
                                                {i + 1}
                                            </td>
                                            <td className="px-5 py-4 text-[1.25rem] font-semibold text-slate-900">
                                                {person.name}
                                            </td>
                                            <td className="px-5 py-4 text-[1.25rem] text-slate-600 break-all">
                                                {person.email}
                                            </td>
                                            <td className="px-5 py-4 text-[1.25rem] text-slate-600 tabular-nums">
                                                {person.phone}
                                            </td>
                                        </tr>
                                    ))}
                                    {!named.length && (
                                        <tr>
                                            <td colSpan={4} className="px-5 py-10 text-center text-[1.25rem]
                                                                       font-semibold text-slate-400">
                                                No participant details were given.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>

                </div>

                {/*
                  * THE ACTIONS ARE THE FOOTER.
                  *
                  * "Record payment received" and "Cancel booking" sat at the
                  * bottom of the scroll, below the participants table — so on a
                  * booking for eight people the two controls the panel exists
                  * for were the two things off screen. Close is here for the
                  * same reason and is always drawn; the other two appear only
                  * when they apply.
                  */}
                <footer className="shrink-0 border-t border-slate-200 bg-white px-5 sm:px-6 py-4
                                   flex flex-col sm:flex-row gap-3">
                    {booking.status === 'active'
                        && booking.payment.status !== 'paid'
                        && booking.payment.status !== 'not_required' && (
                        <button
                            type="button"
                            onClick={onMarkPaid}
                            disabled={acting}
                            className={ADMIN_PRIMARY_BTN}
                        >
                            {acting
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <CheckCircle2 className="w-4 h-4" />}
                            {/* Cash at the door. The server stamps who
                                recorded it, from the token. */}
                            Record payment received
                        </button>
                    )}

                    {booking.status === 'active' && (
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={acting}
                            className={`${ADMIN_SECONDARY_BTN} !text-rose-600 hover:!bg-rose-50`}
                        >
                            <Ban className="w-4 h-4" /> Cancel booking
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={onClose}
                        className={`${ADMIN_SECONDARY_BTN} sm:ml-auto`}
                    >
                        Close
                    </button>
                </footer>
            </aside>
        </div>
    );
}
