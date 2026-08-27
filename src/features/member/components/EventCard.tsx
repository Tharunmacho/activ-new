import { Link } from 'react-router-dom';
import { MapPin, Users, Clock, BadgeCheck, Lock, CalendarDays } from 'lucide-react';
import { resolveMediaUrl } from '@/config/api.config';
import type { MemberEvent } from '@/services/memberHubApi';
import { calendarTile, formatWhen, isPast, seatsLeft, registrationGate } from './eventFormat';

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

    const banner = resolveMediaUrl(event.bannerUrl);

    return (
        <Link
            to={`/member/events/${event.id}`}
            className={`group block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden
                        hover:border-blue-400 hover:shadow-md transition-all ${past ? 'opacity-75' : ''}`}
        >
            {!compact && banner ? (
                <div className="relative w-full aspect-[16/9] bg-slate-100 overflow-hidden">
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

                    {/* Members-only is a fact about the event worth stating on the
                        poster itself — it is the visible half of what the
                        membership buys. */}
                    {event.audience === 'paid' ? (
                        <span className="absolute top-3 left-3 inline-flex items-center gap-1 bg-blue-600
                                         text-white text-[11px] font-bold uppercase tracking-wide
                                         px-2.5 py-1 rounded-full shadow-sm">
                            <Lock className="w-3 h-3" /> Members only
                        </span>
                    ) : null}

                    {registered ? (
                        <span className="absolute top-3 right-3 inline-flex items-center gap-1
                                         bg-emerald-600 text-white text-[11px] font-bold uppercase
                                         tracking-wide px-2.5 py-1 rounded-full shadow-sm">
                            <BadgeCheck className="w-3 h-3" />
                            {waitlisted ? 'Waiting list' : 'Registered'}
                        </span>
                    ) : null}
                </div>
            ) : null}

            <div className="p-4 lg:p-5 flex gap-4">
                {/* The date, as a calendar leaf. Kept even on the poster variant:
                    a poster rarely repeats the date in a form the eye can scan. */}
                <div className="shrink-0 w-14 rounded-xl bg-blue-50 text-blue-700 text-center py-2">
                    <p className="text-lg font-bold leading-none tabular-nums">{tile.day}</p>
                    <p className="text-[10px] font-bold tracking-wider mt-0.5">{tile.month}</p>
                </div>

                <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] font-bold text-slate-900 leading-snug line-clamp-2
                                   group-hover:text-blue-700 transition-colors">
                        {event.title}
                    </h3>

                    <p className="text-[12.5px] text-slate-500 mt-1 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{formatWhen(event)}</span>
                    </p>

                    {event.venue ? (
                        <p className="text-[12.5px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{event.venue}</span>
                        </p>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2.5">
                        {compact && event.audience === 'paid' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold
                                             text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                                <Lock className="w-3 h-3" /> Members only
                            </span>
                        ) : null}

                        {compact && registered ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold
                                             text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                                <BadgeCheck className="w-3 h-3" />
                                {waitlisted ? 'Waiting list' : 'Registered'}
                            </span>
                        ) : null}

                        {event.agenda.length > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
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
                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold
                                              ${left === 0 ? 'text-amber-600' : 'text-slate-500'}`}>
                                <Users className="w-3 h-3" />
                                {left === 0 ? 'Full — waiting list' : `${left} seats left`}
                            </span>
                        ) : null}

                        {!past && gate.open && !registered ? (
                            <span className="text-[11px] font-bold text-blue-600">Registration open</span>
                        ) : null}

                        {past ? <span className="text-[11px] font-semibold text-slate-400">Past event</span> : null}
                    </div>
                </div>
            </div>
        </Link>
    );
}
