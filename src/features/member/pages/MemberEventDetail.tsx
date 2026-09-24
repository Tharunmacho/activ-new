import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
    MapPin, Clock, Users, Phone, Mail, CalendarDays, BadgeCheck, Lock,
    ExternalLink, Bell, Loader2, User, ShieldCheck, Ticket, ChevronRight,
} from 'lucide-react';
import MemberPageShell from '@/pages/member/MemberPageShell';
import { EmptyState, RowsSkeleton, SectionCard } from '@/features/member/components/MemberUI';
import {
    formatWhen, formatDate, formatReminders, registrationGate, seatsLeft, isPast,
    type RegistrationGate,
} from '@/features/member/components/eventFormat';
import {
    getMemberEvent, cancelEventRegistration, type MemberEvent,
} from '@/services/memberHubApi';
import { errorMessage } from '@/services/activApi';
import { resolveMediaUrl } from '@/config/api.config';

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
    const { id = '' } = useParams();
    const navigate = useNavigate();

    const [event, setEvent] = useState<MemberEvent | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [working, setWorking] = useState(false);


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

    const past = isPast(event);
    const reminders = formatReminders(event.reminderOffsetsHours || []);

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
            <div className="space-y-5">
                {/* ---------- the poster, whole ---------- */}
                {banner ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-100 overflow-hidden shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)]">
                        <img
                            src={banner}
                            alt={event.bannerAlt || event.title}
                            className="w-full h-auto max-h-[40rem] object-contain mx-auto"
                        />
                    </div>
                ) : null}

                <div className="grid gap-5 lg:grid-cols-12 items-start">
                    {/* ---------- left: what it is ---------- */}
                    <div className="lg:col-span-7 space-y-5">
                        <SectionCard
                            title="About this event"
                            icon={<CalendarDays className="w-5 h-5" />}
                        >
                            <div className="flex flex-wrap gap-2 mb-4">
                                {event.audience === 'paid' ? (
                                    <span className="inline-flex items-center gap-1 text-[1.0625rem] font-bold
                                                     uppercase tracking-wide text-blue-700 bg-blue-50
                                                     px-2.5 py-1 rounded-full">
                                        <Lock className="w-3 h-3" /> Members only
                                    </span>
                                ) : null}
                                {past ? (
                                    <span className="text-[1.0625rem] font-bold uppercase tracking-wide
                                                     text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                                        Past event
                                    </span>
                                ) : null}
                            </div>

                            {event.description ? (
                                <p className="text-[1.1875rem] text-slate-700 leading-relaxed whitespace-pre-line">
                                    {event.description}
                                </p>
                            ) : (
                                <p className="text-[1.0625rem] text-slate-400">
                                    No description was published for this event.
                                </p>
                            )}
                        </SectionCard>

                        {/* ---------- agenda ---------- */}
                        {event.agenda.length > 0 ? (
                            <SectionCard
                                title="Agenda"
                                subtitle={`${event.agenda.length} sessions`}
                                icon={<Clock className="w-5 h-5" />}
                            >
                                <ol className="relative">
                                    {event.agenda.map((item, index) => (
                                        <li key={item.id || index} className="flex gap-4 pb-5 last:pb-0">
                                            {/* The time column is fixed width and
                                                tabular so the rail of times reads
                                                as a column rather than a ragged
                                                edge. */}
                                            <div className="w-[4.25rem] shrink-0 text-right">
                                                <p className="text-[1.0625rem] font-bold text-slate-900 tabular-nums">
                                                    {item.startTime || '—'}
                                                </p>
                                                {item.endTime ? (
                                                    <p className="text-[1.0625rem] text-slate-400 tabular-nums">
                                                        {item.endTime}
                                                    </p>
                                                ) : null}
                                            </div>

                                            <div className="relative pl-5 min-w-0 flex-1
                                                            border-l border-slate-200">
                                                <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5
                                                                 rounded-full bg-blue-600" />

                                                <p className="text-[1.1875rem] font-semibold text-slate-900 leading-snug">
                                                    {item.title || 'Session'}
                                                </p>

                                                {item.speaker ? (
                                                    <p className="text-[1.0625rem] text-blue-700 mt-0.5 font-medium">
                                                        {item.speaker}
                                                    </p>
                                                ) : null}

                                                {item.location ? (
                                                    <p className="text-[1.0625rem] text-slate-500 mt-0.5
                                                                  inline-flex items-center gap-1">
                                                        <MapPin className="w-3 h-3" /> {item.location}
                                                    </p>
                                                ) : null}

                                                {item.description ? (
                                                    <p className="text-[1.0625rem] text-slate-600 mt-1 leading-relaxed">
                                                        {item.description}
                                                    </p>
                                                ) : null}
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                            </SectionCard>
                        ) : null}

                        {/* ---------- speakers ---------- */}
                        {event.speakers.length > 0 ? (
                            <SectionCard
                                title="Speakers"
                                icon={<User className="w-5 h-5" />}
                            >
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {event.speakers.map((speaker, index) => {
                                        const photo = resolveMediaUrl(speaker.photoUrl);

                                        return (
                                            <div key={speaker.id || index} className="flex gap-3 min-w-0">
                                                {photo ? (
                                                    <img
                                                        src={photo}
                                                        alt=""
                                                        loading="lazy"
                                                        className="w-14 h-14 rounded-full object-cover shrink-0
                                                                   ring-2 ring-blue-100"
                                                    />
                                                ) : (
                                                    <span className="w-14 h-14 rounded-full bg-blue-600 text-white
                                                                     shrink-0 flex items-center justify-center
                                                                     text-[1.1875rem] font-bold">
                                                        {(speaker.name || '?')
                                                            .split(' ').filter(Boolean).slice(0, 2)
                                                            .map((part) => part[0]).join('').toUpperCase()}
                                                    </span>
                                                )}

                                                <div className="min-w-0">
                                                    <p className="text-[1.1875rem] font-semibold text-slate-900 truncate">
                                                        {speaker.name}
                                                    </p>
                                                    {speaker.role ? (
                                                        <p className="text-[1.0625rem] text-slate-600 truncate">
                                                            {speaker.role}
                                                        </p>
                                                    ) : null}
                                                    {speaker.organization ? (
                                                        <p className="text-[1.0625rem] text-slate-400 truncate">
                                                            {speaker.organization}
                                                        </p>
                                                    ) : null}
                                                    {speaker.bio ? (
                                                        <p className="text-[1.0625rem] text-slate-600 mt-1 leading-relaxed">
                                                            {speaker.bio}
                                                        </p>
                                                    ) : null}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </SectionCard>
                        ) : null}
                    </div>

                    {/* ---------- right: when, where, and a seat ---------- */}
                    <div className="lg:col-span-5 space-y-5">
                        <SectionCard title="When and where" icon={<MapPin className="w-5 h-5" />}>
                            <dl className="space-y-3.5">
                                <div>
                                    <dt className="text-[1.0625rem] font-semibold uppercase tracking-wide text-slate-400">
                                        Date and time
                                    </dt>
                                    <dd className="text-[1.1875rem] text-slate-900 font-medium mt-0.5">
                                        {formatWhen(event)}
                                    </dd>
                                </div>

                                {event.venue || event.venueAddress ? (
                                    <div>
                                        <dt className="text-[1.0625rem] font-semibold uppercase tracking-wide text-slate-400">
                                            Venue
                                        </dt>
                                        <dd className="text-[1.1875rem] text-slate-900 font-medium mt-0.5">
                                            {event.venue}
                                            {event.venueAddress ? (
                                                <span className="block text-[1.0625rem] text-slate-600 font-normal mt-0.5">
                                                    {event.venueAddress}
                                                </span>
                                            ) : null}
                                        </dd>

                                        {event.venueMapUrl ? (
                                            <a
                                                href={event.venueMapUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="mt-1.5 inline-flex items-center gap-1 text-[1.0625rem]
                                                           font-semibold text-blue-600 hover:underline"
                                            >
                                                Open in maps <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                        ) : null}
                                    </div>
                                ) : null}

                                {[event.block, event.district, event.state].filter(Boolean).length > 0 ? (
                                    <div>
                                        <dt className="text-[1.0625rem] font-semibold uppercase tracking-wide text-slate-400">
                                            Region
                                        </dt>
                                        <dd className="text-[1.1875rem] text-slate-700 mt-0.5">
                                            {[event.block, event.district, event.state].filter(Boolean).join(', ')}
                                        </dd>
                                    </div>
                                ) : null}

                                {event.contactName || event.contactPhone || event.contactEmail ? (
                                    <div>
                                        <dt className="text-[1.0625rem] font-semibold uppercase tracking-wide text-slate-400">
                                            Contact
                                        </dt>
                                        <dd className="text-[1.1875rem] text-slate-700 mt-0.5 space-y-1">
                                            {event.contactName ? <p>{event.contactName}</p> : null}
                                            {event.contactPhone ? (
                                                <a
                                                    href={`tel:${event.contactPhone}`}
                                                    className="flex items-center gap-1.5 text-blue-600 hover:underline"
                                                >
                                                    <Phone className="w-3.5 h-3.5" /> {event.contactPhone}
                                                </a>
                                            ) : null}
                                            {event.contactEmail ? (
                                                <a
                                                    href={`mailto:${event.contactEmail}`}
                                                    className="flex items-center gap-1.5 text-blue-600 hover:underline"
                                                >
                                                    <Mail className="w-3.5 h-3.5" /> {event.contactEmail}
                                                </a>
                                            ) : null}
                                        </dd>
                                    </div>
                                ) : null}
                            </dl>
                        </SectionCard>

                        {/* ---------- registration ---------- */}
                        <SectionCard
                            title={registration ? 'Your seat' : 'Registration'}
                            icon={<Users className="w-5 h-5" />}
                        >
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
                                        <p className="text-[2.5625rem] font-extrabold mt-1 tabular-nums">
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
                                        onClick={() => navigate(`/member/events/${event.id}/register`)}
                                        className="w-full h-12 rounded-xl bg-emerald-600 text-white text-[1.1875rem]
                                                   font-bold hover:bg-emerald-700
                                                   transition-colors inline-flex items-center justify-center gap-2
                                                   shadow-sm"
                                    >
                                        <ShieldCheck className="w-4 h-4" />
                                        Pay ₹{registration.payment.amount.toLocaleString('en-IN')} and confirm
                                        <ChevronRight className="w-4 h-4" />
                                    </button>

                                    {!past ? (
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
                                    </div>

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

                                    {!past ? (
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
                                        <p className="text-[1.0625rem] text-slate-600 leading-relaxed">
                                            {event.registrationNote}
                                        </p>
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
                                                <span className="block text-[1.5625rem] font-extrabold text-slate-900
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
                                        onClick={() => navigate(`/member/events/${event.id}/book`)}
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
                        </SectionCard>
                    </div>
                </div>
            </div>
        </MemberPageShell>
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
