import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Eye, X, Mail, Phone, Ticket, Users, IndianRupee, CalendarDays,
    BadgePercent, Loader2, ShieldCheck, UserRound,
} from 'lucide-react';
import {
    AdminCard, ADMIN_CARD, ADMIN_SECONDARY_BTN, rupees,
} from '@/features/admin/components/AdminUI';
import { AdminTable, AdminChip, type AdminColumn }
    from '@/features/admin/components/AdminTable';
import {
    listBookingPeople, getBookingPerson, type BookingPerson,
} from '@/services/eventBookingAdminApi';
import type { EventBooking } from '@/services/eventBookingApi';
import { errorMessage } from '@/services/api';

import { CARD_TITLE } from '@/components/layout/appTypography';
/**
 * Everyone who has booked anything — the association's contact book.
 *
 * =========================================================================
 * THIS SCREEN SHOWS NO PASSWORDS, AND WILL NOT
 * =========================================================================
 *
 * It replaces one that printed every member's password in a column beside
 * their email address. Everything else that screen offered is here — the name,
 * the address, the mobile number, and a View that opens the whole history —
 * and nothing here reads a credential. The server does not return one, so
 * there is nothing to render even by accident.
 *
 * A password identifies nobody and contacts nobody; it is only useful for
 * signing in as somebody else. What a super admin actually needs from a list of
 * people is who they are, how to reach them, what they have booked and what
 * they have paid, and that is the whole of what is below.
 *
 * =========================================================================
 * ONE ROW PER PERSON, KEYED ON THE EMAIL ADDRESS
 * =========================================================================
 *
 * Not per booking, and not per member. Most bookers are GUESTS with no account
 * at all, so a list keyed on the member id would leave out nearly everybody who
 * has ever come to an event. The same person who booked once as a guest and
 * once signed in is one row, with their totals added together — because they
 * are one person to the association, and two rows would make both figures wrong.
 */

const formatDay = (iso: string | null) => {
    if (!iso) return '';
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return '';
    return at.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** The circle of initials. The same treatment the reference directory uses. */
function Initials({ name, email }: { name: string; email: string }) {
    // Falls back to the address when no name was given — a blank circle reads
    // as a failed avatar load rather than as a person who did not type a name.
    const source = (name || email || '?').trim();
    /*
     * LETTERS ONLY, and the first letter of each word rather than each token.
     *
     * Real names in this database carry punctuation — "Tharun .v" splits into
     * ["Tharun", ".v"] on whitespace, and taking `charAt(0)` of each produced
     * the initials "T." on a screen where every other row shows two letters.
     * Matching letters directly skips the punctuation wherever it lands.
     */
    const letters = (source.match(/[A-Za-z]+/g) || [])
        .slice(0, 2)
        .map((part) => part.charAt(0))
        .join('')
        .toUpperCase() || '?';

    return (
        <span className="w-11 h-11 rounded-xl bg-blue-600 text-white text-[1.1875rem] font-semibold
                         flex items-center justify-center shrink-0">
            {letters}
        </span>
    );
}

export default function BookingPeople() {
    const [people, setPeople] = useState<BookingPerson[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    /** The person whose history is open, and their bookings once fetched. */
    const [open, setOpen] = useState<BookingPerson | null>(null);
    const [history, setHistory] = useState<EventBooking[] | null>(null);
    const [historyLoading, setHistoryLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = await listBookingPeople();
            setPeople(data.people || []);
        } catch (err) {
            setError(errorMessage(err, 'The list could not be loaded'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    /**
     * The history is fetched when the panel opens, not with the list.
     *
     * Every booking of every person is the whole collection; sending it with
     * the directory would put it on the wire for an admin who wanted one name.
     */
    const openPerson = async (person: BookingPerson) => {
        setOpen(person);
        setHistory(null);
        setHistoryLoading(true);
        try {
            const data = await getBookingPerson(person.email);
            setHistory(data.bookings || []);
        } catch (err) {
            setError(errorMessage(err, 'That history could not be loaded'));
            setHistory([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    const columns: AdminColumn<BookingPerson>[] = useMemo(() => [
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
            sortValue: (row) => row.name || row.email,
            render: (row) => (
                <div className="flex items-center gap-2.5 min-w-0">
                    <Initials name={row.name} email={row.email} />
                    <div className="min-w-0">
                        <div className="text-[1.25rem] font-semibold tracking-tight
                                        text-slate-900 truncate">
                            {row.name || <span className="text-slate-400 italic">No name given</span>}
                        </div>
                        <div className="text-[1.1875rem] text-slate-500 truncate mt-0.5">{row.email}</div>
                    </div>
                </div>
            ),
        },
        {
            key: 'phone',
            header: 'Mobile',
            width: 'w-40',
            hideOnMobile: true,
            sortValue: (row) => row.phone,
            render: (row) => (
                <span className="text-slate-600 tabular-nums">{row.phone || '—'}</span>
            ),
        },
        {
            key: 'who',
            header: 'Account',
            align: 'center',
            width: 'w-36',
            sortValue: (row) => (row.isMember ? 'Member' : 'Guest'),
            render: (row) => (
                <div className="flex flex-col items-center gap-1">
                    {row.isMember
                        ? <AdminChip tone="violet" title="At least one of their bookings was made signed in.">
                            Member
                        </AdminChip>
                        : <AdminChip tone="slate" title="Every booking was made through guest checkout.">
                            Guest
                        </AdminChip>}
                    {row.hasMemberRate && (
                        <span className="inline-flex items-center gap-1 text-[1.0625rem] font-semibold text-emerald-600">
                            <BadgePercent className="w-3.5 h-3.5" /> Member rate
                        </span>
                    )}
                </div>
            ),
        },
        {
            key: 'bookings',
            header: 'Bookings',
            align: 'center',
            width: 'w-32',
            sortValue: (row) => row.bookings,
            render: (row) => (
                <div className="text-center">
                    <span className="text-[1.25rem] font-semibold text-slate-900 tabular-nums">
                        {row.bookings}
                    </span>
                    <div className="text-[1.0625rem] text-slate-400 font-semibold mt-0.5">
                        {/* Bookings, events and seats are three different numbers
                            and a person reading one will assume the others. One
                            booking can cover four seats at one event. */}
                        {row.events} event{row.events === 1 ? '' : 's'} · {row.seats} seat{row.seats === 1 ? '' : 's'}
                    </div>
                </div>
            ),
        },
        {
            key: 'paid',
            header: 'Paid',
            align: 'right',
            width: 'w-40',
            sortValue: (row) => row.paid,
            render: (row) => (
                <div className="text-right">
                    <div className="text-[1.25rem] font-semibold text-slate-900 tabular-nums">
                        {rupees(row.paid)}
                    </div>
                    {row.pending > 0 && (
                        <div className="text-[1.1875rem] font-semibold text-amber-600 mt-1">
                            {rupees(row.pending)} unpaid
                        </div>
                    )}
                </div>
            ),
        },
        {
            key: 'last',
            header: 'Last Booked',
            align: 'right',
            width: 'w-40',
            hideOnMobile: true,
            // Sorted on the timestamp, not the printed date. "03 Oct 2026"
            // compared as a string sorts by day-of-month.
            sortValue: (row) => new Date(row.lastBookedAt || 0).getTime(),
            render: (row) => (
                <span className="text-slate-600 text-[1.25rem]">{formatDay(row.lastBookedAt) || '—'}</span>
            ),
        },
        {
            key: 'action',
            header: 'Action',
            align: 'right',
            // Pinned: on a table this wide the Action button is the first thing
            // to fall off the right edge, and it is the reason the row is here.
            sticky: 'right',
            width: 'w-28',
            render: (row) => (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openPerson(row); }}
                    className="inline-flex items-center gap-1.5 h-11 px-4 rounded-xl bg-emerald-600
                               text-[1.1875rem] font-semibold text-white shadow-sm hover:bg-emerald-700
                               transition-colors whitespace-nowrap"
                >
                    <Eye className="w-4 h-4" /> View
                </button>
            ),
        },
    ], []);

    return (
        <>
            {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4
                                text-[1.25rem] font-semibold text-rose-700 mb-4">
                    {error}
                </div>
            )}

            <AdminTable
                rows={people}
                columns={columns}
                rowKey={(row) => row.email}
                loading={loading}
                onRowClick={openPerson}
                searchable
                searchPlaceholder="Search a name, email address or mobile number"
                pageSize={25}
                minWidth="70rem"
                empty="Nobody has booked an event yet."
            />

            <p className="text-[1.25rem] text-slate-500 leading-relaxed max-w-3xl mt-4">
                One row per person, matched on their email address — so somebody who booked once as a
                guest and once signed in appears once, with their totals added together.{' '}
                <strong className="font-semibold text-slate-700">Bookings, events and seats are three
                different numbers</strong>: one booking can cover four seats at a single event.
            </p>

            {open && (
                <PersonDetail
                    person={open}
                    bookings={history}
                    loading={historyLoading}
                    onClose={() => { setOpen(null); setHistory(null); }}
                />
            )}
        </>
    );
}

/**
 * One person in full — the View panel.
 *
 * A CENTRED CARD, matching the booking detail panel and the event dialog. It
 * was a slide-over on the reasoning that the history is read against the row
 * that was clicked; in practice the row is one line of a table and the sheet
 * covered the whole right half of the screen anyway, so nothing was being read
 * against anything. What it did instead was lose its own edges — a panel flush
 * to the glass has no left or bottom border and stops reading as an object.
 *
 * Header and footer are fixed and only the middle scrolls, so Close cannot end
 * up below a dozen bookings.
 */
function PersonDetail({ person, bookings, loading, onClose }: {
    person: BookingPerson;
    bookings: EventBooking[] | null;
    loading: boolean;
    onClose: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-6">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" onClick={onClose} />

            <aside
                role="dialog"
                aria-modal="true"
                aria-label={`${person.name || person.email} — booking history`}
                /* 2xl, and it stays 2xl. A card sized in `vw` is a card on one
                   monitor and a page on another. */
                className="relative w-full sm:max-w-2xl h-full sm:h-auto sm:max-h-[88vh]
                           bg-white shadow-2xl sm:rounded-2xl border border-slate-200
                           flex flex-col overflow-hidden"
            >
                <header className="shrink-0 bg-white border-b border-slate-200
                                   px-5 sm:px-6 py-4 flex items-start gap-3">
                    <Initials name={person.name} email={person.email} />
                    <div className="min-w-0 flex-1">
                        <h2 className={`${CARD_TITLE} text-slate-900 truncate`}>
                            {person.name || 'No name given'}
                        </h2>
                        <p className="text-[1.25rem] text-slate-500 truncate mt-0.5">{person.email}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="shrink-0 w-9 h-9 rounded-lg border border-slate-200
                                   flex items-center justify-center text-slate-500 hover:bg-slate-50"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </header>

                <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-5">

                    {/* ------------------------------------------- contact */}
                    <AdminCard icon={<UserRound className="w-5 h-5" />} title="Contact">
                        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-[1.1875rem]">
                            <Row icon={<Mail className="w-4 h-4" />} label="Email" value={person.email} />
                            <Row icon={<Phone className="w-4 h-4" />} label="Mobile" value={person.phone} />
                            <Row
                                icon={<ShieldCheck className="w-4 h-4" />}
                                label="Account"
                                value={person.isMember ? 'Signed-in member' : 'Guest checkout only'}
                            />
                            <Row
                                icon={<CalendarDays className="w-4 h-4" />}
                                label="First booked"
                                value={formatDay(person.firstBookedAt)}
                            />
                        </dl>
                        {/*
                          * No credential appears here, and none is fetched. The
                          * screen this panel replaces printed one; see the note
                          * at the head of this file.
                          */}
                    </AdminCard>

                    {/* -------------------------------------------- totals */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Tile icon={<Ticket className="w-4 h-4" />} label="Bookings" value={String(person.bookings)} />
                        <Tile icon={<CalendarDays className="w-4 h-4" />} label="Events" value={String(person.events)} />
                        <Tile icon={<Users className="w-4 h-4" />} label="Seats" value={String(person.seats)} />
                        <Tile icon={<IndianRupee className="w-4 h-4" />} label="Paid" value={rupees(person.paid)} />
                    </div>

                    {person.pending > 0 && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4
                                        text-[1.25rem] font-semibold text-amber-800">
                            {rupees(person.pending)} is owed on a booking that was never completed.
                        </div>
                    )}

                    {/* ------------------------------------------ history */}
                    <AdminCard
                        icon={<Ticket className="w-5 h-5" />}
                        title="Every booking"
                        subtitle="Newest first, across every event."
                        flush
                    >
                        {loading && (
                            <div className="px-6 py-10 text-center">
                                <Loader2 className="w-5 h-5 animate-spin text-blue-600 mx-auto" />
                            </div>
                        )}

                        {!loading && !bookings?.length && (
                            <p className="px-6 py-10 text-[1.25rem] font-semibold text-slate-500 text-center">
                                No bookings found for this address.
                            </p>
                        )}

                        {!loading && !!bookings?.length && (
                            <ul className="divide-y divide-slate-100">
                                {bookings.map((booking) => (
                                    <li key={booking.bookingRef} className="px-6 py-4">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-[1.25rem] font-semibold tracking-tight
                                                              text-slate-900 truncate">
                                                    {booking.eventTitle || 'Untitled event'}
                                                </p>
                                                <p className="text-[1.1875rem] text-slate-500 mt-1 font-mono">
                                                    {booking.bookingRef}
                                                    {booking.eventStartAt
                                                        ? ` · ${formatDay(booking.eventStartAt)}`
                                                        : ''}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-[1.25rem] font-semibold text-slate-900
                                                              tabular-nums">
                                                    {booking.totalAmount > 0 ? rupees(booking.totalAmount) : 'Free'}
                                                </p>
                                                <p className="text-[1.1875rem] text-slate-500 mt-0.5">
                                                    {booking.noOfPersons} seat{booking.noOfPersons === 1 ? '' : 's'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 mt-2.5">
                                            <AdminChip tone={booking.payment.status === 'paid' ? 'emerald'
                                                : booking.payment.status === 'not_required' ? 'blue'
                                                    : booking.payment.status === 'failed' ? 'rose' : 'amber'}>
                                                {booking.payment.status === 'paid' ? 'Paid'
                                                    : booking.payment.status === 'not_required' ? 'Free'
                                                        : booking.payment.status === 'failed' ? 'Failed' : 'Unpaid'}
                                            </AdminChip>
                                            {!!booking.payment.mode && (
                                                <AdminChip tone="amber">{booking.payment.mode}</AdminChip>
                                            )}
                                            {booking.status === 'cancelled' && (
                                                <AdminChip tone="rose">Cancelled</AdminChip>
                                            )}
                                            {booking.status === 'waitlist' && (
                                                <AdminChip tone="amber">Waiting list</AdminChip>
                                            )}
                                            {booking.memberRateApplied && (
                                                <span className="inline-flex items-center gap-1 text-[1.0625rem]
                                                                 font-semibold text-emerald-600">
                                                    <BadgePercent className="w-3.5 h-3.5" />
                                                    Member rate
                                                    {booking.memberSaving > 0
                                                        && ` · saved ${rupees(booking.memberSaving)}`}
                                                </span>
                                            )}
                                        </div>

                                        {/* Who was actually coming on this booking. The booker is
                                            the person on this panel; these may be nobody else in
                                            the system. */}
                                        {/* The names that were given, and only
                                            those. It used to fill the gaps with
                                            "Guest 2", "Guest 3" — people nobody
                                            had entered, printed as though they
                                            had been. */}
                                        {(() => {
                                            const names = (booking.participants || [])
                                                .map((p) => (p.name || '').trim())
                                                .filter(Boolean);
                                            return names.length ? (
                                                <p className="text-[1.1875rem] text-slate-500 mt-2.5">
                                                    {names.join(' · ')}
                                                </p>
                                            ) : null;
                                        })()}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </AdminCard>

                </div>

                {/* The way out, pinned. It used to sit under the booking
                    history, which on a frequent attendee meant scrolling past
                    a dozen rows to leave. */}
                <footer className="shrink-0 border-t border-slate-200 bg-white px-5 sm:px-6 py-4">
                    <button type="button" onClick={onClose} className={`${ADMIN_SECONDARY_BTN} w-full`}>
                        Close
                    </button>
                </footer>
            </aside>
        </div>
    );
}

/**
 * One contact fact. NOT DRAWN when there is nothing to draw.
 *
 * A labelled row with an em dash under it asks the reader a question the record
 * cannot answer - and "Mobile —" on somebody who checked out without one reads
 * as a number that has gone missing rather than one never given.
 */
function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    if (!String(value || '').trim()) return null;
    return (
        <div className="flex items-start gap-2.5 min-w-0">
            <span className="text-slate-400 mt-0.5 shrink-0">{icon}</span>
            <div className="min-w-0">
                <dt className="text-[1.0625rem] font-semibold uppercase tracking-wider text-slate-400">
                    {label}
                </dt>
                <dd className="text-[1.25rem] font-semibold text-slate-800 break-words mt-0.5">{value}</dd>
            </div>
        </div>
    );
}

function Tile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className={`${ADMIN_CARD} p-3.5`}>
            <div className="flex items-center gap-1.5 text-slate-400">
                {icon}
                <span className="text-[1.0625rem] font-semibold uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-[1.75rem] sm:text-[2.125rem] font-semibold tracking-tight text-slate-900
                          mt-1.5 tabular-nums">{value}</p>
        </div>
    );
}
