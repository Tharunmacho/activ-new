import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Ticket, Users, IndianRupee, Clock, RefreshCw, CalendarDays,
    MapPin, ArrowRight, Eye, BadgePercent, Loader2, CalendarRange, Contact,
} from 'lucide-react';
import AdminSidebar from './AdminSidebar';
import {
    AdminPageHeader, AdminStat, ADMIN_BG, ADMIN_PAGE, ADMIN_SECONDARY_BTN, rupees,
} from '@/features/admin/components/AdminUI';
import { AdminTable, AdminChip, AdminCount, type AdminColumn }
    from '@/features/admin/components/AdminTable';
import {
    listBookingOverview, type BookingOverviewRow,
} from '@/services/eventBookingAdminApi';
import { errorMessage } from '@/services/api';
import BookingPeople from './BookingPeople';

/**
 * Booking Events — every event, and how full it is.
 *
 * The landing page of the Bookings section, and the screen that answers the
 * question an organiser actually opens this product with: which of our events
 * is filling up. It replaced a dropdown picker that could answer it only one
 * event at a time, and only by reading four stat cards per selection.
 *
 * =========================================================================
 * THE SEAT FIGURES COME FROM THE SERVER, IN ONE REQUEST
 * =========================================================================
 *
 * `Booked` is the sum of seats on live bookings PLUS members' own
 * registrations, because both fill the same room — the server's
 * `bookingOverview` adds them, using the same arithmetic its per-event seat
 * count uses. Doing that sum in the browser would need two collections' worth
 * of rows on the wire and would drift from the per-event screen the first time
 * either rule changed.
 *
 * `Remaining` is `null` on an event with no seat limit and renders as an em
 * dash. A "0" there would read as full and stop an organiser taking bookings
 * they can perfectly well take — the reason the server does not clamp it.
 *
 * =========================================================================
 * IT UPDATES ITSELF WHEN AN EVENT IS ADDED
 * =========================================================================
 *
 * There is no list of events kept here. Every row is derived from the events
 * collection on load, so an event published from the Events screen appears the
 * next time this page is opened or refreshed, with zero bookings against it —
 * nothing has to be registered anywhere for it to show up.
 */

const formatDay = (iso: string | null) => {
    if (!iso) return '';
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return '';
    return at.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * How full an event is, as a proportion — or `null` when it has no limit.
 *
 * `null` rather than 0, so the bar is not drawn at all on an uncapped event. A
 * bar at zero says "empty"; the truth is that the question does not apply.
 */
const fullness = (row: BookingOverviewRow) =>
    row.totalSeats > 0 ? Math.min(1, row.bookedSeats / row.totalSeats) : null;

export default function SuperAdminBookingEvents() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const navigate = useNavigate();

    const [data, setData] = useState<BookingOverviewRow[]>([]);
    const [totals, setTotals] = useState({
        events: 0, seats: 0, capacity: 0, bookings: 0, collected: 0, pending: 0,
    });
    const [includeDrafts, setIncludeDrafts] = useState(false);
    /**
     * Events, or the people who booked them.
     *
     * A TAB rather than a fifth entry in the rail. Both answer "who is coming
     * to our events" and an organiser moves between them constantly; splitting
     * them across the navigation would make that a two-click round trip through
     * a menu, and would put the contact book a level away from the seat counts
     * that send you looking for it.
     */
    const [tab, setTab] = useState<'events' | 'people'>('events');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await listBookingOverview(includeDrafts);
            setData(response.events || []);
            setTotals(response.totals);
        } catch (err) {
            setError(errorMessage(err, 'The events could not be loaded'));
        } finally {
            setLoading(false);
        }
    }, [includeDrafts]);

    useEffect(() => { load(); }, [load]);

    const open = (row: BookingOverviewRow) => navigate(`/super-admin/bookings/${row.id}`);

    const columns: AdminColumn<BookingOverviewRow>[] = useMemo(() => [
        {
            key: 'sno',
            header: 'S.No',
            width: 'w-16',
            render: (_row, index) => (
                <span className="font-semibold text-slate-400 tabular-nums">{index + 1}</span>
            ),
        },
        {
            key: 'title',
            header: 'Event Name',
            sortValue: (row) => row.title || 'Untitled event',
            render: (row) => (
                <div className="min-w-0">
                    {/* An untitled event reads as "Untitled event", never as a
                        blank cell — a blank reads as a broken row. */}
                    <div className="text-[1.25rem] font-semibold tracking-tight text-slate-900 truncate">
                        {row.title || 'Untitled event'}
                    </div>
                    {/* The meta line steps down but stays legible: 15px, not the
                        12px it was, which was a caption under a caption. */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5
                                    text-[1.125rem] text-slate-500">
                        <span className="inline-flex items-center gap-1">
                            <CalendarDays className="w-4 h-4" />
                            {/* An undated event says so. Omitting the line leaves
                                a row that looks like the others minus a corner. */}
                            {formatDay(row.startAt) || 'Date to be confirmed'}
                        </span>
                        {!!row.venue && (
                            <span className="inline-flex items-center gap-1 truncate max-w-[16rem]">
                                <MapPin className="w-4 h-4 shrink-0" />
                                <span className="truncate">{row.venue}</span>
                            </span>
                        )}
                        {!!row.category && <AdminChip tone="violet">{row.category}</AdminChip>}
                        {row.status !== 'published' && <AdminChip tone="slate">Draft</AdminChip>}
                        {!row.registrationEnabled && (
                            <AdminChip
                                tone="amber"
                                title="Registration is switched off on this event, so its public Book Now page refuses bookings."
                            >
                                Bookings off
                            </AdminChip>
                        )}
                    </div>
                </div>
            ),
        },
        {
            key: 'price',
            header: 'Price',
            align: 'right',
            width: 'w-40',
            hideOnMobile: true,
            sortValue: (row) => row.price,
            render: (row) => (
                <div className="text-right">
                    <div className="text-[1.25rem] font-semibold text-slate-900 tabular-nums">
                        {row.price > 0 ? rupees(row.price) : 'Free'}
                    </div>
                    {row.hasMemberRate && (
                        /* The member rate, where the money is. An event carrying
                           one and not showing it here would leave the organiser
                           reconciling two different totals with no explanation
                           on screen for why some seats cost less. */
                        <div className="mt-1 inline-flex items-center gap-1 text-[1.1875rem] font-semibold text-emerald-600">
                            <BadgePercent className="w-4 h-4" />
                            Members {rupees(row.memberPrice)}
                        </div>
                    )}
                </div>
            ),
        },
        {
            key: 'total',
            header: 'Total Seat',
            align: 'center',
            width: 'w-32',
            sortValue: (row) => row.totalSeats,
            render: (row) => (row.totalSeats > 0
                ? <AdminCount tone="rose">{row.totalSeats}</AdminCount>
                : <span className="text-[1.1875rem] font-semibold text-slate-400">Unlimited</span>),
        },
        {
            key: 'booked',
            header: 'Booked Seat',
            align: 'center',
            width: 'w-32',
            sortValue: (row) => row.bookedSeats,
            render: (row) => <AdminCount tone="emerald">{row.bookedSeats}</AdminCount>,
        },
        {
            key: 'remaining',
            header: 'Remaining Seat',
            align: 'center',
            width: 'w-36',
            // Uncapped events sort to the bottom rather than to the top: -1 is
            // not "fewest remaining", it is "the question does not apply".
            sortValue: (row) => (row.remainingSeats === null ? -1 : row.remainingSeats),
            render: (row) => {
                if (row.remainingSeats === null) {
                    return <span className="text-slate-300 font-semibold">—</span>;
                }
                const share = fullness(row);
                return (
                    <div className="flex flex-col items-center gap-1.5">
                        <AdminCount tone={row.remainingSeats === 0 ? 'rose' : 'blue'}>
                            {row.remainingSeats}
                        </AdminCount>
                        {share !== null && (
                            <div className="w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${share >= 1 ? 'bg-rose-500'
                                        : share >= 0.8 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${Math.round(share * 100)}%` }}
                                />
                            </div>
                        )}
                        {!!row.waitlistedSeats && (
                            <span className="text-[1.0625rem] font-semibold text-amber-600">
                                +{row.waitlistedSeats} waiting
                            </span>
                        )}
                    </div>
                );
            },
        },
        {
            key: 'collected',
            header: 'Collected',
            align: 'right',
            width: 'w-40',
            hideOnMobile: true,
            sortValue: (row) => row.collected,
            render: (row) => (
                <div className="text-right">
                    <div className="text-[1.25rem] font-semibold text-slate-900 tabular-nums">
                        {rupees(row.collected)}
                    </div>
                    {row.pendingAmount > 0 && (
                        /* Owed, and labelled as owed. Adding it to the takings
                           would tell an organiser they hold money that is still
                           in somebody's wallet. */
                        <div className="text-[1.1875rem] font-semibold text-amber-600 mt-1">
                            {rupees(row.pendingAmount)} unpaid
                        </div>
                    )}
                </div>
            ),
        },
        {
            key: 'action',
            header: 'Action',
            align: 'right',
            // Pinned: on a table this wide the Action button is the first thing
            // to fall off the right edge, and it is the reason the row is here.
            sticky: 'right',
            width: 'w-48',
            render: (row) => (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); open(row); }}
                    /* `whitespace-nowrap`: without it the two-word label wraps
                       inside the button and the row grows a line taller than
                       every other row in the table. */
                    className="inline-flex items-center gap-1.5 h-11 px-4 rounded-xl bg-blue-600
                               text-[1.1875rem] font-semibold text-white shadow-sm hover:bg-blue-700
                               transition-colors whitespace-nowrap"
                >
                    <Eye className="w-4 h-4" /> Booking Details
                </button>
            ),
        },
    ], []);

    return (
        <div className={`flex h-screen ${ADMIN_BG}`}>
            <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <AdminPageHeader
                    title="Booking Details"
                    subtitle="Every event, how full it is, and what has been taken. Open one to see who is coming."
                    onMenu={() => setSidebarOpen(true)}
                    actions={
                        <button
                            type="button"
                            onClick={load}
                            className={ADMIN_SECONDARY_BTN}
                            disabled={loading}
                        >
                            {loading
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <RefreshCw className="w-4 h-4" />}
                            Refresh
                        </button>
                    }
                />

                <div className={`flex-1 overflow-y-auto ${ADMIN_PAGE}`}>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <AdminStat
                            icon={<Users className="w-5 h-5" />}
                            label="Seats booked"
                            value={String(totals.seats)}
                            hint={totals.capacity > 0
                                ? `of ${totals.capacity} across ${totals.events} events`
                                : `across ${totals.events} events`}
                            tone="blue"
                            primary
                        />
                        <AdminStat
                            icon={<Ticket className="w-5 h-5" />}
                            label="Bookings"
                            value={String(totals.bookings)}
                            hint="one booking may hold several seats"
                            tone="violet"
                        />
                        <AdminStat
                            icon={<IndianRupee className="w-5 h-5" />}
                            label="Collected"
                            value={rupees(totals.collected)}
                            hint="money actually received"
                            tone="emerald"
                        />
                        <AdminStat
                            icon={<Clock className="w-5 h-5" />}
                            label="Awaiting payment"
                            value={rupees(totals.pending)}
                            hint="held, not taken"
                            tone="amber"
                        />
                    </div>

                    {error && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4
                                        text-[1.25rem] font-semibold text-rose-700">
                            {error}
                        </div>
                    )}

                    {/* ------------------------------------------------- tabs */}
                    <div className="flex gap-1 p-1 rounded-xl bg-slate-100 w-full sm:w-auto sm:inline-flex">
                        {([
                            ['events', 'Events', <CalendarRange key="c" className="w-4 h-4" />],
                            ['people', 'People', <Contact key="p" className="w-4 h-4" />],
                        ] as const).map(([value, label, icon]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setTab(value)}
                                aria-pressed={tab === value}
                                className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2
                                            h-12 px-6 rounded-xl text-[1.25rem] font-semibold transition-colors
                                            ${tab === value
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                {icon}{label}
                            </button>
                        ))}
                    </div>

                    {tab === 'people' && <BookingPeople />}

                    {tab === 'events' && (<>
                    <AdminTable
                        rows={data}
                        columns={columns}
                        rowKey={(row) => row.id}
                        loading={loading}
                        onRowClick={open}
                        searchable
                        searchPlaceholder="Search an event by name, venue or category"
                        minWidth="78rem"
                        empty={<>
                            No published events yet. Create one under{' '}
                            <strong className="font-semibold text-slate-700">Events</strong>{' '}
                            and it appears here the moment it is saved.
                        </>}
                        toolbar={
                            <label className="inline-flex items-center gap-2.5 h-12 px-4 rounded-xl
                                              border border-slate-200 bg-white cursor-pointer
                                              text-[1.25rem] font-semibold text-slate-600 whitespace-nowrap">
                                <input
                                    type="checkbox"
                                    checked={includeDrafts}
                                    onChange={(e) => setIncludeDrafts(e.target.checked)}
                                    className="w-[1.125rem] h-[1.125rem] rounded border-slate-300 text-blue-600"
                                />
                                {/* Drafts are off by default: an unpublished event
                                    has no public booking page, so a row for it
                                    reads as an event taking bookings nobody can
                                    reach. */}
                                Include drafts
                            </label>
                        }
                    />

                    <p className="text-[1.25rem] text-slate-500 leading-relaxed max-w-3xl">
                        <strong className="font-semibold text-slate-700">Booked</strong> counts seats on live
                        bookings taken through the public Book&nbsp;Now page together with members' own
                        registrations — both fill the same room. A checkout somebody abandoned holds its
                        seats for thirty minutes and then releases them, so this figure can go down as
                        well as up. <ArrowRight className="inline w-3.5 h-3.5" /> Open an event for the
                        names, the payments and the door list.
                    </p>
                    </>)}
                </div>
            </div>
        </div>
    );
}
