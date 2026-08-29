import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
    MapPin, Clock, Users, Phone, Mail, CalendarDays, BadgeCheck, Lock,
    ExternalLink, Bell, Loader2, User,
} from 'lucide-react';
import MemberPageShell from '@/pages/member/MemberPageShell';
import { EmptyState, RowsSkeleton, SectionCard } from '@/features/member/components/MemberUI';
import {
    formatWhen, formatDate, formatReminders, registrationGate, seatsLeft, isPast,
    type RegistrationGate,
} from '@/features/member/components/eventFormat';
import {
    getMemberEvent, registerForEvent, cancelEventRegistration, type MemberEvent,
} from '@/services/memberHubApi';
import { errorMessage, getMyProfile } from '@/services/activApi';
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

    /** Pre-filled from the member's own record — nobody enjoys retyping this. */
    const [form, setForm] = useState({ memberName: '', phone: '', organization: '', note: '' });
    const [showForm, setShowForm] = useState(false);

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

    useEffect(() => {
        let cancelled = false;

        // Settled, not awaited alongside the event: a profile that 404s must not
        // stop the event from rendering.
        getMyProfile()
            .then((profile: any) => {
                if (cancelled || !profile) return;
                setForm((current) => ({
                    ...current,
                    memberName: current.memberName || profile.fullName || '',
                    phone: current.phone || profile.phoneNumber || '',
                }));
            })
            .catch(() => null);

        return () => { cancelled = true; };
    }, []);

    const registration = event?.myRegistration && event.myRegistration.status !== 'cancelled'
        ? event.myRegistration
        : null;

    const gate: RegistrationGate = useMemo(
        () => (event ? registrationGate(event) : { open: false, reason: '' }),
        [event],
    );
    const left = event ? seatsLeft(event) : null;
    const banner = resolveMediaUrl(event?.bannerUrl);

    const register = async () => {
        if (!event) return;

        setWorking(true);
        try {
            const seat = await registerForEvent(event.id, form);

            if (seat?.alreadyRegistered) {
                toast.info('You were already registered for this event');
            } else if (seat?.status === 'waitlist') {
                toast.success('The event is full — you are on the waiting list');
            } else {
                toast.success('You are registered');
            }

            setShowForm(false);
            // Re-read rather than patching state: the seat count and any
            // waitlist promotion are the server's to decide.
            await load();
        } catch (err) {
            toast.error(errorMessage(err, 'Could not register you for this event'));
        } finally {
            setWorking(false);
        }
    };

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
                            className="text-[0.8125rem] font-semibold text-blue-600 hover:underline"
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
            title={event.title}
            subtitle={formatWhen(event)}
            width="standard"
            actions={
                <button
                    type="button"
                    onClick={() => navigate('/member/events')}
                    className="text-[0.8125rem] font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                >
                    All events
                </button>
            }
        >
            <div className="space-y-5">
                {/* ---------- the poster, whole ---------- */}
                {banner ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-100 overflow-hidden shadow-sm">
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
                                    <span className="inline-flex items-center gap-1 text-[0.6875rem] font-bold
                                                     uppercase tracking-wide text-blue-700 bg-blue-50
                                                     px-2.5 py-1 rounded-full">
                                        <Lock className="w-3 h-3" /> Members only
                                    </span>
                                ) : null}
                                {past ? (
                                    <span className="text-[0.6875rem] font-bold uppercase tracking-wide
                                                     text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                                        Past event
                                    </span>
                                ) : null}
                            </div>

                            {event.description ? (
                                <p className="text-[0.90625rem] text-slate-700 leading-relaxed whitespace-pre-line">
                                    {event.description}
                                </p>
                            ) : (
                                <p className="text-[0.8125rem] text-slate-400">
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
                                                <p className="text-[0.8125rem] font-bold text-slate-900 tabular-nums">
                                                    {item.startTime || '—'}
                                                </p>
                                                {item.endTime ? (
                                                    <p className="text-[0.6875rem] text-slate-400 tabular-nums">
                                                        {item.endTime}
                                                    </p>
                                                ) : null}
                                            </div>

                                            <div className="relative pl-5 min-w-0 flex-1
                                                            border-l border-slate-200">
                                                <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5
                                                                 rounded-full bg-blue-600" />

                                                <p className="text-[0.875rem] font-semibold text-slate-900 leading-snug">
                                                    {item.title || 'Session'}
                                                </p>

                                                {item.speaker ? (
                                                    <p className="text-[0.78125rem] text-blue-700 mt-0.5 font-medium">
                                                        {item.speaker}
                                                    </p>
                                                ) : null}

                                                {item.location ? (
                                                    <p className="text-[0.75rem] text-slate-500 mt-0.5
                                                                  inline-flex items-center gap-1">
                                                        <MapPin className="w-3 h-3" /> {item.location}
                                                    </p>
                                                ) : null}

                                                {item.description ? (
                                                    <p className="text-[0.78125rem] text-slate-600 mt-1 leading-relaxed">
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
                                                                     text-sm font-bold">
                                                        {(speaker.name || '?')
                                                            .split(' ').filter(Boolean).slice(0, 2)
                                                            .map((part) => part[0]).join('').toUpperCase()}
                                                    </span>
                                                )}

                                                <div className="min-w-0">
                                                    <p className="text-[0.875rem] font-semibold text-slate-900 truncate">
                                                        {speaker.name}
                                                    </p>
                                                    {speaker.role ? (
                                                        <p className="text-[0.78125rem] text-slate-600 truncate">
                                                            {speaker.role}
                                                        </p>
                                                    ) : null}
                                                    {speaker.organization ? (
                                                        <p className="text-[0.75rem] text-slate-400 truncate">
                                                            {speaker.organization}
                                                        </p>
                                                    ) : null}
                                                    {speaker.bio ? (
                                                        <p className="text-[0.75rem] text-slate-600 mt-1 leading-relaxed">
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
                                    <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-400">
                                        Date and time
                                    </dt>
                                    <dd className="text-[0.875rem] text-slate-900 font-medium mt-0.5">
                                        {formatWhen(event)}
                                    </dd>
                                </div>

                                {event.venue || event.venueAddress ? (
                                    <div>
                                        <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-400">
                                            Venue
                                        </dt>
                                        <dd className="text-[0.875rem] text-slate-900 font-medium mt-0.5">
                                            {event.venue}
                                            {event.venueAddress ? (
                                                <span className="block text-[0.8125rem] text-slate-600 font-normal mt-0.5">
                                                    {event.venueAddress}
                                                </span>
                                            ) : null}
                                        </dd>

                                        {event.venueMapUrl ? (
                                            <a
                                                href={event.venueMapUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="mt-1.5 inline-flex items-center gap-1 text-[0.78125rem]
                                                           font-semibold text-blue-600 hover:underline"
                                            >
                                                Open in maps <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                        ) : null}
                                    </div>
                                ) : null}

                                {[event.block, event.district, event.state].filter(Boolean).length > 0 ? (
                                    <div>
                                        <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-400">
                                            Region
                                        </dt>
                                        <dd className="text-[0.875rem] text-slate-700 mt-0.5">
                                            {[event.block, event.district, event.state].filter(Boolean).join(', ')}
                                        </dd>
                                    </div>
                                ) : null}

                                {event.contactName || event.contactPhone || event.contactEmail ? (
                                    <div>
                                        <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-400">
                                            Contact
                                        </dt>
                                        <dd className="text-[0.84375rem] text-slate-700 mt-0.5 space-y-1">
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
                            {registration ? (
                                <div className="space-y-3">
                                    <div className={`rounded-xl p-4 ${
                                        registration.status === 'waitlist'
                                            ? 'bg-amber-50 border border-amber-200'
                                            : 'bg-emerald-50 border border-emerald-200'
                                    }`}>
                                        <p className={`text-sm font-bold flex items-center gap-1.5 ${
                                            registration.status === 'waitlist'
                                                ? 'text-amber-800' : 'text-emerald-800'
                                        }`}>
                                            <BadgeCheck className="w-4 h-4" />
                                            {registration.status === 'waitlist'
                                                ? 'You are on the waiting list'
                                                : 'You are registered'}
                                        </p>
                                        <p className="text-[0.78125rem] text-slate-600 mt-1">
                                            {registration.status === 'waitlist'
                                                ? 'You will move into a seat automatically if one is given up.'
                                                : `Registered on ${formatDate(registration.registeredAt)}.`}
                                        </p>
                                    </div>

                                    {!past ? (
                                        <button
                                            type="button"
                                            onClick={cancel}
                                            disabled={working}
                                            className="w-full h-11 rounded-xl border border-slate-200 text-[0.84375rem]
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
                                <p className="text-[0.8125rem] text-slate-500 py-2">{gate.reason}</p>
                            ) : showForm ? (
                                <form
                                    onSubmit={(e) => { e.preventDefault(); register(); }}
                                    className="space-y-3"
                                >
                                    <Field
                                        label="Your name"
                                        value={form.memberName}
                                        onChange={(v) => setForm({ ...form, memberName: v })}
                                        required
                                    />
                                    <Field
                                        label="Phone"
                                        value={form.phone}
                                        onChange={(v) => setForm({ ...form, phone: v })}
                                        placeholder="For the organiser to reach you on the day"
                                    />
                                    <Field
                                        label="Organisation (optional)"
                                        value={form.organization}
                                        onChange={(v) => setForm({ ...form, organization: v })}
                                    />
                                    <Field
                                        label="Anything the organiser should know (optional)"
                                        value={form.note}
                                        onChange={(v) => setForm({ ...form, note: v })}
                                    />

                                    <div className="flex gap-2 pt-1">
                                        <button
                                            type="submit"
                                            disabled={working || !form.memberName.trim()}
                                            className="flex-1 h-11 rounded-xl bg-blue-600 text-white text-[0.84375rem]
                                                       font-bold hover:bg-blue-700 disabled:opacity-60
                                                       transition-colors inline-flex items-center
                                                       justify-center gap-2"
                                        >
                                            {working ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                            {left === 0 ? 'Join the waiting list' : 'Confirm registration'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowForm(false)}
                                            className="px-4 h-11 rounded-xl border border-slate-200 text-[0.84375rem]
                                                       font-semibold text-slate-600 hover:bg-slate-50"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div className="space-y-3">
                                    {event.registrationNote ? (
                                        <p className="text-[0.8125rem] text-slate-600 leading-relaxed">
                                            {event.registrationNote}
                                        </p>
                                    ) : null}

                                    {left !== null ? (
                                        <p className={`text-[0.8125rem] font-semibold ${
                                            left === 0 ? 'text-amber-600' : 'text-slate-600'
                                        }`}>
                                            {left === 0
                                                ? 'This event is full — you can join the waiting list.'
                                                : `${left} of ${event.capacity} seats left.`}
                                        </p>
                                    ) : null}

                                    {event.registrationDeadline ? (
                                        <p className="text-[0.78125rem] text-slate-500">
                                            Registration closes {formatDate(event.registrationClosesAt)}.
                                        </p>
                                    ) : null}

                                    <button
                                        type="button"
                                        onClick={() => setShowForm(true)}
                                        className="w-full h-11 rounded-xl bg-blue-600 text-white text-[0.84375rem]
                                                   font-bold hover:bg-blue-700 transition-colors"
                                    >
                                        {left === 0 ? 'Join the waiting list' : 'Register for this event'}
                                    </button>
                                </div>
                            )}

                            {reminders ? (
                                <p className="mt-4 pt-3 border-t border-slate-100 text-[0.75rem] text-slate-500
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
 * One labelled input.
 *
 * An inline expandable form, never a `<Modal>` — the same rule the member area
 * follows everywhere: a dialog inside a nested view is what the crash-proof
 * directive forbids on Android, and consistency between the two clients is
 * worth more here than a dialog would buy.
 */
function Field({
    label,
    value,
    onChange,
    placeholder,
    required,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    required?: boolean;
}) {
    return (
        <label className="block">
            <span className="block text-[0.75rem] font-semibold text-slate-600 mb-1">{label}</span>
            <input
                type="text"
                value={value}
                required={required}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
        </label>
    );
}
