import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Clock, Lock, MapPin, Ticket, Users } from 'lucide-react';
import { resolveMediaUrl } from '@/config/api.config';
import { registrationHref, type MemberEvent } from '@/services/memberHubApi';
import { calendarTile, formatTime, isPast } from './eventFormat';
import { eventKey, memberEventPath } from '@/lib/eventPath';

/**
 * ONE EVENT AS A ROW — the member events list.
 *
 * The same shape as the paid dashboard's Upcoming Events rows: date tile,
 * poster thumbnail (sm and up, only when there is one), title / time / venue,
 * the member's own seat state, one action on the right. The list used to be a
 * two-column grid of 16:9 poster cards, which on a desktop put three events
 * on a screen and left a wide gap beside the rail.
 *
 * A seat that came from the Book Now form opens the member's TICKET
 * (`registrationHref`); anything else opens the event.
 */
export default function EventRow({ event }: { event: MemberEvent }) {
    const tile = calendarTile(event.startAt);
    const time = formatTime(event.startAt);
    const banner = resolveMediaUrl(event.bannerUrl) || '';
    const past = isPast(event);

    const reg = event.myRegistration && event.myRegistration.status !== 'cancelled' ? event.myRegistration : null;
    const awaitingPayment = reg?.payment?.status === 'pending';
    const waitlisted = reg?.status === 'waitlist';
    const seatLabel = !reg ? '' : awaitingPayment ? 'Payment due' : waitlisted ? 'Waiting list' : 'Registered';
    const seats = Number(reg?.seats || 0);

    const href = reg ? registrationHref(eventKey(event), reg) : memberEventPath(event);
    const action = !reg ? (past ? 'View event' : 'View details')
        : awaitingPayment ? 'Complete payment'
            : reg.source === 'booking' ? 'View ticket' : 'View seat';
    const venue = [event.venue, event.district].filter(Boolean).join(', ');

    return (
        <div className={`flex flex-wrap sm:flex-nowrap items-stretch gap-3 sm:gap-4 rounded-2xl border bg-white p-3
                         transition-all hover:shadow-md ${reg ? 'border-emerald-200 hover:border-emerald-300' : 'border-slate-200 hover:border-blue-300'}
                         ${past ? 'opacity-90' : ''}`}>
            <span className="flex w-14 sm:w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-blue-50 px-2 py-2.5 text-center">
                <span className="text-[1.5rem] sm:text-[1.75rem] font-extrabold leading-none text-blue-700">{tile.day}</span>
                <span className="mt-1 text-sm font-extrabold uppercase tracking-wider text-blue-500">{tile.month}</span>
            </span>

            {banner ? (
                <span className="relative hidden w-40 lg:w-48 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:block">
                    <img src={banner} alt={event.bannerAlt || ''} loading="lazy" className="h-full w-full object-cover" />
                </span>
            ) : null}

            <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-0.5">
                <span className="flex flex-wrap items-center gap-1.5">
                    {event.category ? (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-sm font-bold text-slate-600">{event.category}</span>
                    ) : null}
                    {event.audience === 'paid' ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-sm font-bold text-amber-700">
                            <Lock className="h-3 w-3" /> Members only
                        </span>
                    ) : null}
                    {reg ? (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-bold text-white
                                          ${awaitingPayment ? 'bg-amber-500' : waitlisted ? 'bg-slate-500' : 'bg-emerald-600'}`}>
                            {awaitingPayment ? <Clock className="h-3 w-3" /> : <BadgeCheck className="h-3 w-3" />} {seatLabel}
                        </span>
                    ) : null}
                </span>
                <span className="line-clamp-2 break-words text-ui-small sm:text-[1.375rem] font-extrabold leading-snug tracking-tight text-slate-900">
                    {event.title || 'Untitled event'}
                </span>
                <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm sm:text-base font-semibold text-slate-500">
                    {event.startAt ? (
                        time ? <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4 shrink-0" /> {time}</span> : null
                    ) : (
                        <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4 shrink-0" /> Date to be confirmed</span>
                    )}
                    {venue ? (
                        <span className="inline-flex min-w-0 items-center gap-1.5"><MapPin className="h-4 w-4 shrink-0" /><span className="truncate">{venue}</span></span>
                    ) : null}
                    {reg && seats > 1 ? (
                        <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4 shrink-0" /> {seats} seats</span>
                    ) : null}
                    {reg?.bookingRef ? (
                        <span className="inline-flex items-center gap-1.5"><Ticket className="h-4 w-4 shrink-0" /> {reg.bookingRef}</span>
                    ) : null}
                </span>
            </span>

            <span className="flex w-full sm:w-auto shrink-0 items-center self-center">
                <Link
                    to={href}
                    className={`inline-flex w-full sm:w-auto justify-center items-center gap-1.5 rounded-xl px-4 py-2.5 text-base font-bold transition-colors
                                ${awaitingPayment ? 'bg-amber-500 text-white hover:bg-amber-600'
                                    : reg ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                    {action} <ArrowRight className="h-4 w-4" />
                </Link>
            </span>
        </div>
    );
}
