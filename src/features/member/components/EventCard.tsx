import { Link } from 'react-router-dom';
import { MapPin, Users, Clock, BadgeCheck, Lock, CalendarDays, Tag, IndianRupee, BadgePercent } from 'lucide-react';
import { resolveMediaUrl } from '@/config/api.config';
import type { MemberEvent } from '@/services/memberHubApi';
import { calendarTile, formatWhen, isPast, seatsLeft, registrationGate } from './eventFormat';

import { CARD_TITLE } from '@/components/layout/appTypography';
/**
 * One event, as a card.
 *
 * The banner is rendered at the top and NOT cropped to a strip: the association
 * publishes event posters, and a poster is the announcement — the title, the
 * chief guest and the venue are usually printed on the image itself. A 96-pixel
 * band across the top of a card shows the top inch of it and nothing legible.
 * So the frame is a 16:9 area and `bannerFit`/`bannerPosition` — the controls
 * the CMS already offers and whose values used to be dropped before they
 * reached any client — decide how the poster sits in it.
 *
 * `compact` is the dashboard's variant: same card, no poster, for the strip
 * where three events share the width one would have.
 */
export default function EventCard({
    event,
    compact = false,
}: {
    event: MemberEvent;
    compact?: boolean;
}) {
    const tile = calendarTile(event.startAt);
    const past = isPast(event);
    const left = seatsLeft(event);
    const gate = registrationGate(event);

    const registered = event.myRegistration && event.myRegistration.status !== 'cancelled';
    const waitlisted = event.myRegistration?.status === 'waitlist';
    /*
     * A held-but-unpaid seat, called what it is.
     *
     * "Registered" on a card whose seat is still awaiting payment is the badge
     * that would cost somebody their place: they see it in the list, believe
     * they are going, and never open the event again. The hold does not count
     * against capacity, so the seat goes to whoever pays first.
     */
    const awaitingPayment = event.myRegistration?.payment?.status === 'pending';

    const seatLabel = awaitingPayment
        ? 'Payment due'
        : waitlisted ? 'Waiting list' : 'Registered';

    const banner = resolveMediaUrl(event.bannerUrl);

    return (
        <Link
            to={`/member/events/${event.id}`}
            className={`group flex h-full flex-col bg-white rounded-2xl border border-slate-200 shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)] overflow-hidden
                        hover:border-blue-400 hover:shadow-md transition-all ${past ? 'opacity-75' : ''}`}
        >
            {/*
              * THE SAME 16:9 HEAD ON EVERY CARD, poster or no poster.
              *
              * Banners are optional on this collection, and a card that simply
              * omitted the head was a different shape from the one beside it —
              * which is why the list used to be told not to line its cards up.
              * Where there is no poster the head carries the DATE, set large on
              * a soft wash: the first thing anybody asks of an event, and a card
              * that looks designed rather than half-loaded.
              */}
            {!compact ? (
                <div className="relative w-full aspect-[16/9] bg-slate-100 overflow-hidden">
                    {banner ? (
                        <img
                            src={banner}
                            alt={event.bannerAlt || ''}
                            loading="lazy"
                            className="w-full h-full"
                            style={{
                                objectFit: event.bannerFit === 'contain' ? 'contain' : 'cover',
                                objectPosition: event.bannerPosition || 'center',
                            }}
                        />
                    ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center
                                        bg-gradient-to-br from-blue-50 via-slate-50 to-slate-100">
                            <p className="text-[3.25rem] font-extrabold leading-none tabular-nums text-blue-600/80">
                                {tile.day}
                            </p>
                            <p className="mt-1 text-[1.25rem] font-bold uppercase tracking-[0.2em] text-blue-700/60">
                                {tile.month}
                            </p>
                        </div>
                    )}

                    {/* Members-only is a fact about the event worth stating on the
                        poster itself — it is the visible half of what the
                        membership buys. */}
                    {event.audience === 'paid' ? (
                        <span className="absolute top-3 left-3 inline-flex items-center gap-1 bg-blue-600
                                         text-white text-[0.8125rem] font-bold uppercase tracking-wide
                                         px-3 py-1.5 rounded-full shadow-sm">
                            <Lock className="w-3 h-3" /> Members only
                        </span>
                    ) : null}

                    {registered ? (
                        // Amber, not green, while the fee is outstanding: a green
                        // badge reading "Payment due" says two opposite things at
                        // once, and the colour is what gets read at card size.
                        <span className={`absolute top-3 right-3 inline-flex items-center gap-1
                                          text-white text-[0.8125rem] font-bold uppercase
                                          tracking-wide px-3 py-1.5 rounded-full shadow-sm ${
                            awaitingPayment ? 'bg-amber-500' : 'bg-emerald-600'
                        }`}>
                            {awaitingPayment ? <Clock className="w-3 h-3" /> : <BadgeCheck className="w-3 h-3" />}
                            {seatLabel}
                        </span>
                    ) : null}
                </div>
            ) : null}

            <div className="flex flex-1 gap-4 p-4 lg:p-5">
                {/* The date, as a calendar leaf. Kept even on the poster variant:
                    a poster rarely repeats the date in a form the eye can scan. */}
                <div className="shrink-0 w-16 rounded-xl bg-blue-50 text-blue-700 text-center py-2.5">
                    <p className="text-[1.375rem] font-bold leading-none tabular-nums">{tile.day}</p>
                    <p className="text-[0.75rem] font-bold tracking-wider mt-0.5">{tile.month}</p>
                </div>

                <div className="flex min-w-0 flex-1 flex-col">
                    {/*
                      * WHAT KIND OF EVENT, first.
                      *
                      * A stranger reading "krishna jayanthi" has no idea what
                      * they are looking at. "AWARENESS" above it answers that
                      * before the title is read, which is what a category is
                      * for and why it was worth a managed list.
                      */}
                    {event.category ? (
                        <p className="inline-flex items-center gap-1 text-[1.0625rem] font-bold uppercase
                                      tracking-wider text-violet-700 bg-violet-50 px-2 py-0.5
                                      rounded-full mb-1.5">
                            <Tag className="w-3 h-3" />
                            {event.category}
                        </p>
                    ) : null}

                    <h3 className={`${CARD_TITLE} text-slate-900 line-clamp-2 group-hover:text-blue-700 transition-colors`}>
                        {/* Never a blank heading — an untitled event reads as a
                            broken card rather than as one still being written. */}
                        {event.title || 'Untitled event'}
                    </h3>

                    <p className="text-[1rem] text-slate-500 mt-1 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 shrink-0" />
                        <span className="truncate">{formatWhen(event)}</span>
                    </p>

                    {event.venue ? (
                        <p className="text-[1rem] text-slate-500 mt-0.5 flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 shrink-0" />
                            <span className="truncate">{event.venue}</span>
                        </p>
                    ) : null}

                    {/*
                      * WHAT IT COSTS. The fourth question every event card is
                      * asked, and the one this card never answered.
                      *
                      * The member rate is named beside the price rather than
                      * replacing it: a member seeing only "₹600" cannot tell
                      * their membership did anything, and a non-member seeing
                      * only "₹600" would be quoted a price they cannot have.
                      */}
                    {event.registrationEnabled ? (
                        <p className="text-[1rem] mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                                <IndianRupee className="w-4 h-4 shrink-0" />
                                {event.registrationFee > 0
                                    ? `₹${Number(event.registrationFee).toLocaleString('en-IN')}`
                                    : 'Free'}
                            </span>
                            {event.hasMemberRate && Number(event.memberPrice) < event.registrationFee ? (
                                <span className="inline-flex items-center gap-1 text-[1.1875rem] font-semibold
                                                 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                                    <BadgePercent className="w-3.5 h-3.5" />
                                    Members ₹{Number(event.memberPrice).toLocaleString('en-IN')}
                                </span>
                            ) : null}
                        </p>
                    ) : null}

                    {/* Pushed to the foot of the card, so “Registration open”
                        and the seat count sit on one line across a row rather
                        than wherever each title happened to end. */}
                    <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-2.5">
                        {compact && event.audience === 'paid' ? (
                            <span className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold
                                             text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
                                <Lock className="w-3 h-3" /> Members only
                            </span>
                        ) : null}

                        {compact && registered ? (
                            <span className={`inline-flex items-center gap-1 text-[0.8125rem] font-semibold
                                              px-2.5 py-1 rounded-full ${
                                awaitingPayment
                                    ? 'text-amber-700 bg-amber-50'
                                    : 'text-emerald-700 bg-emerald-50'
                            }`}>
                                {awaitingPayment
                                    ? <Clock className="w-3 h-3" />
                                    : <BadgeCheck className="w-3 h-3" />}
                                {seatLabel}
                            </span>
                        ) : null}

                        {event.agenda.length > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[0.8125rem] text-slate-500">
                                <CalendarDays className="w-3 h-3" />
                                {event.agenda.length} sessions
                            </span>
                        ) : null}

                        {/*
                          * Seats remaining, only when both halves are real.
                          * `seatsLeft` returns null for an uncapped event and
                          * for one whose registrations were not counted — the
                          * second would otherwise print a confident "0 left".
                          */}
                        {!past && left !== null ? (
                            <span className={`inline-flex items-center gap-1 text-[0.8125rem] font-semibold
                                              ${left === 0 ? 'text-amber-600' : 'text-slate-500'}`}>
                                <Users className="w-3 h-3" />
                                {left === 0 ? 'Full — waiting list' : `${left} seats left`}
                            </span>
                        ) : null}

                        {!past && gate.open && !registered ? (
                            <span className="text-[0.8125rem] font-bold text-blue-600">Registration open</span>
                        ) : null}

                        {past ? <span className="text-[0.8125rem] font-semibold text-slate-400">Past event</span> : null}
                    </div>
                </div>
            </div>
        </Link>
    );
}
