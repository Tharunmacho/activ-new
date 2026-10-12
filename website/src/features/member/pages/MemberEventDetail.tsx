import { useEventClock } from '@/lib/useEventClock';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { EventQrFeature } from '@/components/shared/EventQr';
import EventActions from '@/components/shared/EventActions';
import { countdownLabel, eventPhase, type CalendarEventLike } from '@/lib/eventCalendar';
import { toast } from 'sonner';
import {
    MapPin, Clock, Users, Phone, Mail, CalendarDays, BadgeCheck, Lock,
    ExternalLink, Bell, Loader2, User, ShieldCheck, Ticket, ChevronRight, Timer,
} from 'lucide-react';
import MemberPageShell from '@/pages/member/MemberPageShell';
import { EmptyState, RowsSkeleton } from '@/features/member/components/MemberUI';
import {
    formatWhen, formatDate, formatReminders, registrationGate, seatsLeft, isPast,
    type RegistrationGate,
} from '@/features/member/components/eventFormat';
import {
    getMemberEvent, cancelEventRegistration, registrationHref, type MemberEvent,
} from '@/services/memberHubApi';
import { errorMessage } from '@/services/activApi';
import { resolveMediaUrl } from '@/config/api.config';
import { eventKey, memberEventPath } from '@/lib/eventPath';

/**
 * One event, in full: poster, agenda, speakers, venue and a seat (EVT-001/002).
 *
 * The poster is shown WHOLE — `object-contain` against a neutral ground, with a
 * generous maximum height — rather than cropped to a banner. The association
 * publishes designed posters where the chief guest, the timings and the venue
 * are printed on the image, so cropping one to a 16:9 strip discards the
 * announcement and keeps the decoration. The card in the list is the place for
 * a cropped preview; this is the place to actually read it.
 *
 * Registration is optimistic in neither direction: the button is disabled while
 * the request is in flight and the event is re-read afterwards, because the
 * seat count and the waitlist promotion are both decided on the server and a
 * locally incremented counter would disagree with it the moment two members
 * registered at once.
 */
export default function MemberEventDetail() {
    const eventNow = useEventClock();
    const { id = '' } = useParams();
    const navigate = useNavigate();

    const [event, setEvent] = useState<MemberEvent | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [working, setWorking] = useState(false);
    /* A portrait poster gets a height cap and a blurred fill; see the banner. */
    const [bannerTall, setBannerTall] = useState(false);


    const load = useCallback(async () => {
        try {
            const row = await getMemberEvent(id);
            setEvent(row);
            setError(row ? '' : 'This event is not available');
        } catch (err) {
            setError(errorMessage(err, 'Could not open this event'));
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { load(); }, [load]);


    const registration = event?.myRegistration && event.myRegistration.status !== 'cancelled'
        ? event.myRegistration
        : null;

    /**
     * A seat that is held but not paid for.
     *
     * Deliberately its own state and not folded into `registration`. The two
     * mean opposite things to a member: one is "you are going", the other is
     * "you are not going yet and here is why". Showing the confirmation card for
     * a pending seat is the failure that would actually cost somebody their
     * place — they would close the tab, and the hold does not count against
     * capacity, so the seat goes to whoever pays first.
     */
    const awaitingPayment = !!registration && registration.payment?.status === 'pending';
    /*
     * A seat from the Book Now form (here, or on the public site with this
     * member's email). It is paid for, and its ticket shown, on the booking
     * page — the legacy /register screen and its cancel call know nothing of it.
     */
    const fromBooking = registration?.source === 'booking';
    const ticketHref = event && registration ? registrationHref(eventKey(event), registration) : '';

    /**
     * What THIS member will be charged — resolved by the server.
     *
     * `registrationFee` is the COMMON price. An event can carry a member rate,
     * and `event.service.register` charges `priceFor(event, context).amount` —
     * so reading the common price here quoted a paid-up member the full ₹1,000
     * and then took ₹600 from them. The price shown and the price charged must
     * be one lookup, and `yourPrice` IS that lookup, sent down already resolved
     * against this member's live membership.
     *
     * `?? registrationFee` for an older server that does not send it — falling
     * back to the COMMON price, which is the safe direction to be wrong in.
     */
    const fee = Number(event?.yourPrice ?? event?.registrationFee ?? 0);
    /** The common price, for showing what the membership saved. */
    const listFee = Number(event?.registrationFee || 0);
    const savedByMembership = Number(event?.yourSaving || 0);

    /** The questions the super admin designed for this event. */
    const customFields = useMemo(() => event?.registrationFields || [], [event]);

    const gate: RegistrationGate = useMemo(
        () => (event ? registrationGate(event) : { open: false, reason: '' }),
        [event],
    );
    const left = event ? seatsLeft(event) : null;
    const banner = resolveMediaUrl(event?.bannerUrl);


    const cancel = async () => {
        if (!event) return;

        setWorking(true);
        try {
            await cancelEventRegistration(event.id);
            toast.success('Your registration has been cancelled');
            await load();
        } catch (err) {
            toast.error(errorMessage(err, 'Could not cancel your registration'));
        } finally {
            setWorking(false);
        }
    };

    if (loading) {
        return (
            <MemberPageShell title="Event" subtitle="The association programme" width="standard">
                <RowsSkeleton rows={5} />
            </MemberPageShell>
        );
    }

    if (error || !event) {
        return (
            <MemberPageShell title="Event" subtitle="The association programme" width="standard">
                <EmptyState
                    icon={<CalendarDays className="w-6 h-6" />}
                    title="This event is not available"
                    detail={error || 'It may have been withdrawn, or it is for a different membership.'}
                    action={
                        <button
                            type="button"
                            onClick={() => navigate('/member/events')}
                            className="text-[1.0625rem] font-semibold text-blue-600 hover:underline"
                        >
                            Back to events
                        </button>
                    }
                />
            </MemberPageShell>
        );
    }

    const past = isPast(event, eventNow);
    const reminders = formatReminders(event.reminderOffsetsHours || []);
    const phase = eventPhase(event as CalendarEventLike, eventNow);
    const countdown = !past && phase === 'upcoming' ? countdownLabel(event.startAt) : null;
    const fillingFast = left !== null && left > 0 && event.capacity > 0 && left <= Math.max(5, Math.round(event.capacity * 0.1));
    const region = [event.block, event.district, event.state].filter(Boolean).join(', ');
    const speakers = (event.speakers || []).filter((person) => person && person.name);
    const qrEvent = event as unknown as { id?: string; slug?: string; title?: string; startAt?: string | null; showQrOnPage?: boolean };

    return (
        <MemberPageShell
            /* Never an empty heading. A blank one reads as a page that failed
               to load; "Untitled event" reads as an event still being written,
               which is what it is. Same fallback the list card uses. */
            title={event.title || 'Untitled event'}
            subtitle={formatWhen(event)}
            width="standard"
            actions={
                <button
                    type="button"
                    onClick={() => navigate('/member/events')}
                    className="text-[1.0625rem] font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                >
                    All events
                </button>
            }
        >
            <div className="space-y-5 sm:space-y-6">
                {/*
                  * THE POSTER, WHOLE AND EDGE TO EDGE — the public event page's
                  * banner. A landscape or square poster is drawn at the full
                  * width of the column and its own height, so it fills the card
                  * with no white bands either side. Only a PORTRAIT poster is
                  * capped (85vh) so it cannot run several screens tall; its sides
                  * are then the same poster blurred, never an empty plate.
                  */}
                {banner ? (
                    <div className={`relative w-full overflow-hidden rounded-[1.5rem] border border-slate-200
                                     shadow-[0_1px_3px_rgba(16,24,40,0.10),0_12px_32px_-14px_rgba(16,24,40,0.25)] ${
                        bannerTall ? 'bg-slate-900' : 'bg-slate-100'}`}>
                        {bannerTall ? (
                            <img
                                src={banner}
                                alt=""
                                aria-hidden="true"
                                className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-2xl"
                            />
                        ) : null}
                        <img
                            src={banner}
                            alt={event.bannerAlt || event.title}
                            onLoad={(e) => {
                                const img = e.currentTarget;
                                setBannerTall(img.naturalHeight > img.naturalWidth * 1.05);
                            }}
                            className={`relative block w-full h-auto ${bannerTall ? 'max-h-[85vh] object-contain' : ''}`}
                        />
                    </div>
                ) : null}

                <div className="grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-start">
                    {/* ---------------- the event ---------------- */}
                    <article className={`${CARD} p-4 sm:p-8 min-w-0 lg:col-start-1 lg:row-start-1`}>
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                            {event.category ? (
                                <span className={`${CHIP} bg-blue-50 text-blue-700 border border-blue-100`}>
                                    {event.category}
                                </span>
                            ) : null}
                            {event.audience === 'paid' ? (
                                <span className={`${CHIP} bg-blue-50 text-blue-700 border border-blue-100`}>
                                    <Lock className="w-3.5 h-3.5" /> Members only
                                </span>
                            ) : null}
                            {past ? (
                                <span className={`${CHIP} bg-slate-100 text-slate-500`}>
                                    <Timer className="w-3.5 h-3.5" /> This event has taken place
                                </span>
                            ) : phase === 'live' ? (
                                <span className={`${CHIP} bg-emerald-50 text-emerald-700 border border-emerald-100`}>
                                    <span className="relative flex h-2 w-2">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                                    </span>
                                    Happening now
                                </span>
                            ) : countdown ? (
                                <span className={`${CHIP} bg-blue-50 text-blue-700 border border-blue-100`}>
                                    <Timer className="w-3.5 h-3.5" /> {countdown}
                                </span>
                            ) : null}
                            {left === 0 ? (
                                <span className={`${CHIP} bg-rose-50 text-rose-700 border border-rose-100`}>
                                    <Users className="w-3.5 h-3.5" /> Fully booked
                                </span>
                            ) : fillingFast ? (
                                <span className={`${CHIP} bg-amber-50 text-amber-800 border border-amber-100`}>
                                    <Users className="w-3.5 h-3.5" /> Only {left} seats left
                                </span>
                            ) : null}
                        </div>

                        <h2 className="font-display text-[1.75rem] sm:text-[2.375rem] font-extrabold leading-tight tracking-tight
                                       text-[#1e3a8a] break-words [overflow-wrap:anywhere] mb-4">
                            {event.title || 'Untitled event'}
                        </h2>

                        {event.description ? (
                            <p className="text-[1.1875rem] sm:text-[1.3125rem] leading-relaxed font-medium text-slate-600
                                          whitespace-pre-line mb-6">
                                {event.description}
                            </p>
                        ) : (
                            <p className="text-[1.0625rem] text-slate-400 mb-6">
                                No description was published for this event.
                            </p>
                        )}

                        {/* Diary, share, directions — the public page's own row. */}
                        <EventActions event={event as unknown as CalendarEventLike} className="mb-2" />

                        {/* ---------- programme ---------- */}
                        {(event.agenda || []).length > 0 ? (
                            <section className="mt-6 pt-6 sm:mt-8 sm:pt-8 border-t border-slate-100">
                                <h3 className={`${CARD_TITLE} mb-5`}>Programme</h3>
                                <ol className="border-l-2 border-slate-200 pl-5 space-y-6">
                                    {(event.agenda || []).map((item, index) => (
                                        <li key={item.id || index} className="relative">
                                            {/* The dot sits on the rule, so the times read as a timeline. */}
                                            <span className="absolute -left-[1.6875rem] top-1.5 w-3 h-3 rounded-full bg-blue-600 ring-4 ring-white" />
                                            {item.startTime || item.endTime ? (
                                                <p className={`${LABEL} mb-1`}>
                                                    {[item.startTime, item.endTime].filter(Boolean).join(' – ')}
                                                </p>
                                            ) : null}
                                            <p className="text-[1.25rem] font-bold text-slate-900">{item.title || 'Session'}</p>
                                            {item.description ? (
                                                <p className="text-[1.1875rem] text-slate-500 mt-1 whitespace-pre-line">{item.description}</p>
                                            ) : null}
                                            {item.speaker || item.location ? (
                                                <p className={`${LABEL} mt-1.5 normal-case tracking-normal`}>
                                                    {[item.speaker, item.location].filter(Boolean).join(' · ')}
                                                </p>
                                            ) : null}
                                        </li>
                                    ))}
                                </ol>
                            </section>
                        ) : null}

                        {/* ---------- speakers ---------- */}
                        {speakers.length > 0 ? (
                            <section className="mt-6 pt-6 sm:mt-8 sm:pt-8 border-t border-slate-100">
                                <h3 className={`${CARD_TITLE} mb-5`}>Speakers</h3>
                                <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
                                    {speakers.map((speaker, index) => (
                                        <SpeakerCard key={speaker.id || index} speaker={speaker} />
                                    ))}
                                </div>
                            </section>
                        ) : null}
                    </article>

                    {/* ---------------- when, where, and a seat ---------------- */}
                    <aside className="min-w-0 space-y-5 sm:space-y-6 lg:col-start-2 lg:row-start-1 lg:sticky lg:top-6">
                        <div className={`${CARD} p-4 sm:p-7`}>
                            <ul className="divide-y divide-slate-100">
                                <Fact icon={<CalendarDays className="w-4 h-4" />} label="Date and time" value={formatWhen(event)} />
                                {event.venue || event.venueAddress ? (
                                    <Fact
                                        icon={<MapPin className="w-4 h-4" />}
                                        label="Venue"
                                        value={event.venue}
                                        extra={(
                                            <>
                                                {event.venueAddress ? (
                                                    <span className="block text-[1.0625rem] text-slate-500 font-medium mt-0.5">{event.venueAddress}</span>
                                                ) : null}
                                                {event.venueMapUrl ? (
                                                    <a href={event.venueMapUrl} target="_blank" rel="noopener noreferrer"
                                                        className="mt-1.5 inline-flex items-center gap-1 text-[1.0625rem] font-semibold text-blue-600 hover:underline">
                                                        Open in maps <ExternalLink className="w-3.5 h-3.5" />
                                                    </a>
                                                ) : null}
                                            </>
                                        )}
                                    />
                                ) : null}
                                {region ? <Fact icon={<MapPin className="w-4 h-4" />} label="Region" value={region} /> : null}
                                {event.contactName ? <Fact icon={<User className="w-4 h-4" />} label="Contact" value={event.contactName} /> : null}
                                {event.contactPhone ? (
                                    <Fact icon={<Phone className="w-4 h-4" />} label="Phone" value={event.contactPhone} href={`tel:${event.contactPhone}`} />
                                ) : null}
                                {event.contactEmail ? (
                                    <Fact icon={<Mail className="w-4 h-4" />} label="Email" value={event.contactEmail} href={`mailto:${event.contactEmail}`} />
                                ) : null}
                            </ul>
                        </div>

                        <div className={`${CARD} p-4 sm:p-7`}>
                            <h3 className={`${CARD_TITLE} mb-4 flex items-center gap-2.5`}>
                                <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-700">
                                    {registration ? <BadgeCheck className="w-5 h-5" /> : <Ticket className="w-5 h-5" />}
                                </span>
                                {registration ? 'Your seat' : 'Registration'}
                            </h3>
                            {awaitingPayment ? (
                                /*
                                 * CHECKOUT.
                                 *
                                 * Its own branch above "your seat", because a held
                                 * seat is not a registration and the screen must
                                 * not congratulate the member on one. Everything
                                 * here is about the one action left to them.
                                 */
                                <div className="space-y-4">
                                    <div className="rounded-2xl bg-blue-600
                                                    text-white p-5 shadow-lg">
                                        <p className="text-[1.0625rem] font-bold uppercase tracking-wider
                                                      text-blue-200">
                                            Amount due
                                        </p>
                                        <p className="text-[2rem] sm:text-[2.5625rem] font-extrabold mt-1 tabular-nums">
                                            ₹{registration.payment.amount.toLocaleString('en-IN')}
                                        </p>
                                        <p className="text-[1.0625rem] text-blue-100 mt-2 leading-snug">
                                            Your seat is held. It is confirmed the moment this is paid.
                                        </p>

                                        {registration.payment.reference ? (
                                            <p className="mt-4 pt-3 border-t border-white/20 text-[1.0625rem]
                                                          text-blue-200">
                                                Reference{' '}
                                                <span className="font-semibold tracking-wider text-white">
                                                    {registration.payment.reference}
                                                </span>
                                            </p>
                                        ) : null}
                                    </div>

                                    {/*
                                      * Paying happens on the registration screen,
                                      * at the step this seat is already on.
                                      *
                                      * One checkout, in one place. Two — one here
                                      * and one there — is two things to keep in
                                      * step, and the member who used the smaller
                                      * one would never see the order summary.
                                      */}
                                    <button
                                        type="button"
                                        onClick={() => navigate(fromBooking ? ticketHref : memberEventPath(event, '/register'))}
                                        className="w-full h-12 rounded-xl bg-emerald-600 text-white text-[1.1875rem]
                                                   font-bold hover:bg-emerald-700
                                                   transition-colors inline-flex items-center justify-center gap-2
                                                   shadow-sm"
                                    >
                                        <ShieldCheck className="w-4 h-4" />
                                        Pay ₹{registration.payment.amount.toLocaleString('en-IN')} and confirm
                                        <ChevronRight className="w-4 h-4" />
                                    </button>

                                    {!past && !fromBooking ? (
                                        <button
                                            type="button"
                                            onClick={cancel}
                                            disabled={working}
                                            className="w-full h-10 rounded-xl text-[1.0625rem] font-semibold
                                                       text-slate-500 hover:text-slate-700 disabled:opacity-60"
                                        >
                                            Give up this seat instead
                                        </button>
                                    ) : null}
                                </div>
                            ) : registration ? (
                                <div className="space-y-3">
                                    <div className={`rounded-xl p-4 ${
                                        registration.status === 'waitlist'
                                            ? 'bg-amber-50 border border-amber-200'
                                            : 'bg-emerald-50 border border-emerald-200'
                                    }`}>
                                        <p className={`text-[1.1875rem] font-bold flex items-center gap-1.5 ${
                                            registration.status === 'waitlist'
                                                ? 'text-amber-800' : 'text-emerald-800'
                                        }`}>
                                            <BadgeCheck className="w-4 h-4" />
                                            {registration.status === 'waitlist'
                                                ? 'You are on the waiting list'
                                                : 'You are registered'}
                                        </p>
                                        <p className="text-[1.0625rem] text-slate-600 mt-1">
                                            {registration.status === 'waitlist'
                                                ? 'You will move into a seat automatically if one is given up.'
                                                : `Registered on ${formatDate(registration.registeredAt)}.`}
                                        </p>
                                        {fromBooking ? (
                                            <p className="text-[1.0625rem] text-slate-700 mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                                                {registration.bookingRef ? <span>Booking <strong>{registration.bookingRef}</strong></span> : null}
                                                {Number(registration.seats || 0) > 0 ? (
                                                    <span>{registration.seats} {Number(registration.seats) === 1 ? 'seat' : 'seats'}</span>
                                                ) : null}
                                            </p>
                                        ) : null}
                                    </div>

                                    {fromBooking ? (
                                        <button
                                            type="button"
                                            onClick={() => navigate(ticketHref)}
                                            className="w-full h-11 rounded-xl bg-blue-600 text-white text-[1.1875rem] font-bold
                                                       hover:bg-blue-700 transition-colors inline-flex items-center justify-center gap-2"
                                        >
                                            View your ticket <ChevronRight className="w-4 h-4" />
                                        </button>
                                    ) : null}

                                    {/*
                                      The receipt, for a seat that was paid for.

                                      The reference is the thing a member quotes to
                                      the organiser, so it is on the screen rather
                                      than only in an email nobody can find.
                                    */}
                                    {registration.payment?.status === 'paid' ? (
                                        <div className="rounded-xl border border-slate-200 p-4">
                                            <p className="text-[1.0625rem] font-bold uppercase tracking-wide
                                                          text-slate-500 flex items-center gap-1.5">
                                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                                Payment received
                                            </p>
                                            <div className="mt-2.5 space-y-1.5">
                                                <ReceiptRow
                                                    label="Amount"
                                                    value={`₹${registration.payment.amount.toLocaleString('en-IN')}`}
                                                />
                                                {registration.payment.method ? (
                                                    <ReceiptRow
                                                        label="Method"
                                                        value={registration.payment.method.toUpperCase()}
                                                    />
                                                ) : null}
                                                {registration.payment.reference ? (
                                                    <ReceiptRow
                                                        label="Reference"
                                                        value={registration.payment.reference}
                                                    />
                                                ) : null}
                                                {registration.payment.paidAt ? (
                                                    <ReceiptRow
                                                        label="Paid on"
                                                        value={formatDate(registration.payment.paidAt)}
                                                    />
                                                ) : null}
                                            </div>
                                        </div>
                                    ) : null}

                                    {!past && !fromBooking ? (
                                        <button
                                            type="button"
                                            onClick={cancel}
                                            disabled={working}
                                            className="w-full h-11 rounded-xl border border-slate-200 text-[1.1875rem]
                                                       font-semibold text-slate-600 hover:bg-slate-50
                                                       disabled:opacity-60 transition-colors
                                                       inline-flex items-center justify-center gap-2"
                                        >
                                            {working ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                            Cancel my registration
                                        </button>
                                    ) : null}
                                </div>
                            ) : !gate.open ? (
                                /*
                                 * Closed, and said so as a state rather than a
                                 * stray grey sentence.
                                 *
                                 * A section headed "Registration" followed by one
                                 * faint line reads as a page that failed to load —
                                 * which is exactly how it was reported. The
                                 * organiser's contact details are offered here
                                 * because "registration is not open" is the moment
                                 * a member most wants to ask a person about it.
                                 */
                                <div className="py-6 text-center">
                                    <span className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto
                                                     mb-3 flex items-center justify-center">
                                        <Lock className="w-5 h-5" />
                                    </span>
                                    <p className="text-[1.1875rem] font-semibold text-slate-700">
                                        Registration is not open
                                    </p>
                                    <p className="text-[1.0625rem] text-slate-500 mt-1 max-w-xs mx-auto
                                                  leading-relaxed">
                                        {gate.reason || 'The organiser has not opened registration for this event.'}
                                    </p>

                                    {event.contactPhone || event.contactEmail ? (
                                        <p className="text-[1.0625rem] text-slate-500 mt-3">
                                            Contact{' '}
                                            {event.contactName ? (
                                                <span className="font-semibold text-slate-700">
                                                    {event.contactName}
                                                </span>
                                            ) : 'the organiser'}
                                            {event.contactPhone ? (
                                                <>
                                                    {' on '}
                                                    <a
                                                        href={`tel:${event.contactPhone}`}
                                                        className="font-semibold text-blue-600 hover:underline"
                                                    >
                                                        {event.contactPhone}
                                                    </a>
                                                </>
                                            ) : null}
                                            {event.contactEmail ? (
                                                <>
                                                    {event.contactPhone ? ' or ' : ' at '}
                                                    <a
                                                        href={`mailto:${event.contactEmail}`}
                                                        className="font-semibold text-blue-600 hover:underline
                                                                   break-all"
                                                    >
                                                        {event.contactEmail}
                                                    </a>
                                                </>
                                            ) : null}
                                            .
                                        </p>
                                    ) : null}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {event.registrationNote ? (
                                        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                                            <p className="text-[0.875rem] font-extrabold uppercase tracking-widest text-amber-700">Please note</p>
                                            <p className="mt-1 text-[1.0625rem] font-semibold text-amber-900 whitespace-pre-line">
                                                {event.registrationNote}
                                            </p>
                                        </div>
                                    ) : null}

                                    {/*
                                      What it costs, before anything else in the
                                      card. It is the first thing a member wants to
                                      know and the last thing the old layout said.
                                    */}
                                    {fee > 0 ? (
                                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4
                                                        flex items-center gap-3">
                                            <span className="w-10 h-10 rounded-xl bg-blue-600 text-white
                                                             flex items-center justify-center shrink-0">
                                                <Ticket className="w-4 h-4" />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-[1.3125rem] sm:text-[1.5625rem] font-extrabold text-slate-900
                                                                 tabular-nums leading-none">
                                                    ₹{fee.toLocaleString('en-IN')}
                                                </span>
                                                {/*
                                                  * SHOWN ONLY WHEN IT APPLIES.
                                                  *
                                                  * A "you saved" line on every
                                                  * event, including the ones
                                                  * with no member rate, is a
                                                  * claim about a discount that
                                                  * does not exist. This renders
                                                  * only when the server says
                                                  * this member is actually
                                                  * getting the lower price.
                                                  */}
                                                {savedByMembership > 0 ? (
                                                    <span className="block text-[1.1875rem] font-semibold text-emerald-600 mt-1">
                                                        Member price — you save
                                                        ₹{savedByMembership.toLocaleString('en-IN')}
                                                        <span className="text-slate-400 font-normal line-through ml-1.5">
                                                            ₹{listFee.toLocaleString('en-IN')}
                                                        </span>
                                                    </span>
                                                ) : event?.hasMemberRate
                                                    && Number(event?.memberPrice) < listFee ? (
                                                    /*
                                                     * SIGNED IN, BUT NOT PAYING THE MEMBER RATE.
                                                     *
                                                     * A member whose membership has lapsed or was
                                                     * never completed was shown the full price and
                                                     * nothing else — the one reader for whom the
                                                     * discount is both relevant and one payment
                                                     * away. They have an account already, so this
                                                     * points at the plans rather than at signing up.
                                                     */
                                                    <Link
                                                        to="/payment/membership-plans"
                                                        className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg
                                                                   bg-amber-50 px-2.5 py-1 text-[1.1875rem] font-bold
                                                                   text-amber-800 hover:bg-amber-100 transition-colors"
                                                    >
                                                        Members pay ₹{Number(event.memberPrice).toLocaleString('en-IN')}
                                                        {' '}— activate your membership
                                                    </Link>
                                                ) : null}
                                                <span className="block text-[1.0625rem] text-slate-500 mt-1">
                                                    per seat
                                                </span>
                                            </span>
                                        </div>
                                    ) : (
                                        <p className="text-[1.0625rem] font-semibold text-emerald-700
                                                      inline-flex items-center gap-1.5">
                                            <Ticket className="w-3.5 h-3.5" /> Free to attend
                                        </p>
                                    )}

                                    {left !== null ? (
                                        <p className={`text-[1.0625rem] font-semibold ${
                                            left === 0 ? 'text-amber-600' : 'text-slate-600'
                                        }`}>
                                            {left === 0
                                                ? 'This event is full — you can join the waiting list.'
                                                : `${left} of ${event.capacity} seats left.`}
                                        </p>
                                    ) : null}

                                    {event.registrationDeadline ? (
                                        <p className="text-[1.0625rem] text-slate-500">
                                            Registration closes {formatDate(event.registrationClosesAt)}.
                                        </p>
                                    ) : null}

                                    {/*
                                      * Booking opens its own screen — the SAME
                                      * one the public site uses.
                                      *
                                      * It used to expand into this column: six
                                      * fields, a fee, a payment method and a
                                      * receipt, in a third of the width beside the
                                      * agenda. Booking is a transaction with steps
                                      * and money in it, and it has no room here.
                                      *
                                      * It also used to go to
                                      * `/member/events/:id/register`, which books
                                      * ONE seat — the member's own. That is not
                                      * what the association asked for: a member
                                      * bringing two colleagues could not say so,
                                      * and the seats they took were counted in a
                                      * different collection from every booking
                                      * made through the public page, so the
                                      * organiser had two attendee lists for one
                                      * room. It is one booking system for both
                                      * audiences; a signed-in member is
                                      * recognised by the token the request
                                      * already carries, so it is attached to
                                      * their account rather than taken as a
                                      * guest booking.
                                      *
                                      * It opens at `/member/events/:id/book`,
                                      * which is that same page rendered in the
                                      * member shell — the booking no longer
                                      * throws the member out to the public site
                                      * to pay.
                                      */}
                                    <button
                                        type="button"
                                        onClick={() => navigate(memberEventPath(event, '/book'))}
                                        className="w-full h-11 rounded-xl bg-blue-600 text-white text-[1.1875rem]
                                                   font-bold hover:bg-blue-700 transition-colors
                                                   inline-flex items-center justify-center gap-1.5"
                                    >
                                        {left === 0 ? 'Join the waiting list' : 'Book Now'}
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            )}


                            {reminders ? (
                                <p className="mt-4 pt-3 border-t border-slate-100 text-[1.0625rem] text-slate-500
                                              inline-flex items-center gap-1.5">
                                    <Bell className="w-3.5 h-3.5" /> {reminders}
                                </p>
                            ) : null}
                        </div>
                    </aside>

                </div>

                {/* The event's QR — the public page's feature card, full width so the
                    code is big enough to scan across a room. */}
                {qrEvent.showQrOnPage !== false ? <EventQrFeature event={qrEvent} /> : null}
            </div>
        </MemberPageShell>
    );
}

/** White card on the member area's tint — the public page's BIZ_CARD, in the member palette. */
const CARD = 'rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(16,24,40,0.08),0_8px_24px_-12px_rgba(16,24,40,0.18)]';
const CARD_TITLE = 'font-display text-[1.375rem] sm:text-[1.625rem] font-bold tracking-tight text-slate-900';
const CHIP = 'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[1rem] font-bold';
const LABEL = 'text-[0.9375rem] font-extrabold uppercase tracking-wider text-slate-400';

/** One fact in the side card: an icon tile, a label, the value — one rhythm for every row. */
function Fact({ icon, label, value, href, extra }: {
    icon: React.ReactNode; label: string; value?: string; href?: string; extra?: React.ReactNode;
}) {
    return (
        <li className="flex items-start gap-3.5 py-3.5 first:pt-0 last:pb-0">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">{icon}</span>
            <div className="min-w-0 flex-1">
                <p className={LABEL}>{label}</p>
                {value ? (
                    <p className="mt-1 text-[1.1875rem] font-semibold text-slate-900 break-words [overflow-wrap:anywhere]">
                        {href ? <a href={href} className="text-blue-700 hover:underline">{value}</a> : value}
                    </p>
                ) : null}
                {extra}
            </div>
        </li>
    );
}

/**
 * A speaker, as a card with a portrait big enough to be a face.
 *
 * The list drew 3.5rem circles with every line truncated, so a minister was a
 * smudge and "Minister for Social Justice Department" was cut to "Minister for
 * Soc…". 5.5rem, cropped from the TOP (a centred crop of a standing photograph
 * is a chest), and the role and organisation wrap instead of vanishing.
 */
function SpeakerCard({ speaker }: { speaker: MemberEvent['speakers'][number] }) {
    const [broken, setBroken] = useState(false);
    const photo = resolveMediaUrl(speaker.photoUrl);
    const initials = (speaker.name || '?').split(' ').filter(Boolean).slice(0, 2)
        .map((part) => part.charAt(0)).join('').toUpperCase();

    return (
        <div className="flex items-start gap-3.5 sm:gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5 sm:p-4 min-w-0">
            <div className="h-16 w-16 sm:h-[5.5rem] sm:w-[5.5rem] shrink-0 overflow-hidden rounded-full bg-white ring-2 ring-blue-100">
                {photo && !broken ? (
                    <img
                        src={photo}
                        alt=""
                        loading="lazy"
                        onError={() => setBroken(true)}
                        className="h-full w-full object-cover object-top"
                    />
                ) : (
                    <span className="grid h-full w-full place-items-center bg-gradient-to-br from-[#1e3a8a] to-[#2563eb]
                                     text-[1.25rem] sm:text-[1.5rem] font-bold text-white">
                        {initials}
                    </span>
                )}
            </div>
            <div className="min-w-0">
                <p className="text-[1.25rem] font-bold text-slate-900 break-words">{speaker.name}</p>
                {speaker.role ? <p className="text-[1.0625rem] font-semibold text-slate-600 mt-0.5 break-words">{speaker.role}</p> : null}
                {speaker.organization ? <p className="text-[1.0625rem] text-slate-500 break-words">{speaker.organization}</p> : null}
                {speaker.bio ? <p className="text-[1.0625rem] text-slate-600 mt-2 leading-relaxed">{speaker.bio}</p> : null}
            </div>
        </div>
    );
}

/**
 * One line of a receipt.
 *
 * Label left, value right, tabular figures — so an amount and a reference line
 * up down the column rather than drifting with the width of their labels.
 */
function ReceiptRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <span className="text-[1.0625rem] text-slate-500 shrink-0">{label}</span>
            <span className="text-[1.0625rem] font-semibold text-slate-900 text-right break-all tabular-nums">
                {value}
            </span>
        </div>
    );
}
