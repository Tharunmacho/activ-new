import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
    MapPin, CalendarDays, Users, Loader2, Check, ChevronLeft, ChevronRight,
    CreditCard, Smartphone, Landmark, ShieldCheck, Info, Ticket, BadgeCheck,
    Lock, PartyPopper,
} from 'lucide-react';
import MemberPageShell from '@/pages/member/MemberPageShell';
import { EmptyState, RowsSkeleton } from '@/features/member/components/MemberUI';
import {
    formatWhen, isPast, registrationGate, seatsLeft,
} from '@/features/member/components/eventFormat';
import {
    getMemberEvent, registerForEvent, payForEvent,
    type MemberEvent, type RegistrationFieldDef,
} from '@/services/memberHubApi';
import { getMyProfile, errorMessage } from '@/services/activApi';
import { resolveMediaUrl } from '@/config/api.config';

import { CARD_TITLE } from '@/components/layout/appTypography';
/**
 * Registering for an event — its own screen (EVT-002 / EVT-004).
 *
 * It used to be an inline form inside the event page's sidebar column: a
 * six-field form, a fee, a payment method and a receipt, all squeezed into a
 * third of the width beside the agenda. Registration is a TRANSACTION — it has
 * steps, it takes money, and it is the one thing on that page a member is
 * actually trying to complete — and a transaction conducted in a sidebar reads
 * as an afterthought. Worse, the custom questions an organiser adds have no
 * room there: eight questions turn the column into a scroll.
 *
 * NO SIDEBAR, deliberately. `MemberPageShell` draws the member rail on screens
 * a member navigates TO and omits it on the ones they work THROUGH — the
 * registration forms, the submission screens, the payment flow. Offering four
 * ways to leave halfway through paying is how a half-finished registration
 * happens. There is a back arrow to the event and nothing else.
 *
 * THREE STEPS, and the middle one disappears when the event is free:
 *
 *   1 Your details   the standing four, then whatever the organiser asked
 *   2 Payment        only when the super admin set a fee
 *   3 Confirmed      the ticket, with its reference
 *
 * THE MEMBER PAYS THE AMOUNT THE SUPER ADMIN SET, and no other. The figure
 * shown here is the one the server copied onto the seat when it was held, and
 * `payRegistration` reads it from that record — this screen never sends an
 * amount, so there is nothing for a client to change. See the note on `payment`
 * in the registration model.
 */

type Step = 'details' | 'payment' | 'done';

const INPUT =
    'w-full h-11 px-3.5 rounded-xl border border-slate-200 text-[1.1875rem] text-slate-900 '
    + 'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 '
    + 'focus:border-blue-400 transition-shadow';

export default function EventRegistration() {
    const { id = '' } = useParams();
    const navigate = useNavigate();

    const [event, setEvent] = useState<MemberEvent | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [working, setWorking] = useState(false);

    const [step, setStep] = useState<Step>('details');
    const [method, setMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');

    const [form, setForm] = useState({ memberName: '', phone: '', organization: '', note: '' });
    const [answers, setAnswers] = useState<Record<string, string | boolean>>({});

    const load = useCallback(async () => {
        try {
            const data = await getMemberEvent(id);
            setEvent(data);

            /*
             * Land on the step this seat is actually at.
             *
             * A member who closed the tab on the payment screen and came back
             * must not be shown the details form again — they would fill it in,
             * press continue, and be told they are already registered. The seat
             * already exists; what is left is the fee.
             */
            const seat = data?.myRegistration;
            if (seat && seat.status !== 'cancelled') {
                setStep(seat.payment?.status === 'pending' ? 'payment' : 'done');
            }
        } catch (err) {
            setError(errorMessage(err, 'This event could not be opened'));
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    /*
     * The form starts filled in.
     *
     * The association already knows this member's name and phone — they are
     * signed in. Asking them to retype it before they can take a seat is
     * friction with nothing behind it, and a mistyped number is an organiser
     * who cannot reach them on the day.
     */
    useEffect(() => {
        let cancelled = false;

        getMyProfile()
            .then((me: any) => {
                if (cancelled || !me) return;
                setForm((current) => ({
                    ...current,
                    memberName: current.memberName || me.fullName || '',
                    phone: current.phone || me.phoneNumber || '',
                }));
            })
            .catch(() => { /* an empty form is still a usable form */ });

        return () => { cancelled = true; };
    }, []);

    const fields: RegistrationFieldDef[] = useMemo(
        () => event?.registrationFields || [], [event],
    );

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
    const registration = event?.myRegistration && event.myRegistration.status !== 'cancelled'
        ? event.myRegistration
        : null;

    const gate = event ? registrationGate(event) : { open: false, reason: '' };
    const left = event ? seatsLeft(event) : null;
    const full = left === 0;

    /** A waitlisted place is never charged — there is no seat yet to charge for. */
    const willPay = fee > 0 && !full;

    // ---------------------------------------------------------------- actions

    const submitDetails = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!event) return;

        setWorking(true);
        try {
            const seat = await registerForEvent(event.id, { ...form, responses: answers });
            await load();

            if (seat?.payment?.status === 'pending') {
                setStep('payment');
                toast.info('Seat held — one step left');
            } else {
                setStep('done');
                toast.success(seat?.status === 'waitlist'
                    ? 'You are on the waiting list'
                    : 'You are registered');
            }
        } catch (err) {
            // The server rejects a missing required answer with the question's
            // own wording; showing it verbatim points at the field to fix.
            toast.error(errorMessage(err, 'Could not complete your registration'));
        } finally {
            setWorking(false);
        }
    };

    const pay = async () => {
        if (!event) return;

        setWorking(true);
        try {
            await payForEvent(event.id, { method });
            await load();
            setStep('done');
            toast.success('Payment received — your seat is confirmed');
        } catch (err) {
            toast.error(errorMessage(err, 'The payment could not be completed'));
        } finally {
            setWorking(false);
        }
    };

    // ---------------------------------------------------------------- render

    if (loading) {
        return (
            <MemberPageShell
                title="Registration"
                width="standard"
                sidebar={false}
                backTo={`/member/events/${id}`}
            >
                <RowsSkeleton rows={5} />
            </MemberPageShell>
        );
    }

    if (error || !event) {
        return (
            <MemberPageShell
                title="Registration"
                width="standard"
                sidebar={false}
                backTo="/member/events"
            >
                <EmptyState
                    icon={<CalendarDays className="w-6 h-6" />}
                    title="This event could not be opened"
                    detail={error || 'It may have been withdrawn, or it was never aimed at your region.'}
                />
            </MemberPageShell>
        );
    }

    /* Registration closed and no seat held: there is nothing to do here. */
    if (!gate.open && !registration) {
        return (
            <MemberPageShell
                title="Registration"
                subtitle={event.title}
                width="standard"
                sidebar={false}
                backTo={`/member/events/${id}`}
            >
                <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)]">
                    <EmptyState
                        icon={<Lock className="w-6 h-6" />}
                        title="Registration is not open"
                        detail={gate.reason || 'The organiser has not opened registration for this event.'}
                    />
                </div>
            </MemberPageShell>
        );
    }

    const steps: { key: Step; label: string }[] = [
        { key: 'details', label: 'Your details' },
        ...(willPay ? [{ key: 'payment' as Step, label: 'Payment' }] : []),
        { key: 'done', label: 'Confirmed' },
    ];

    const stepIndex = steps.findIndex((s) => s.key === step);

    return (
        <MemberPageShell
            title={step === 'done' ? 'You are registered' : 'Register'}
            subtitle={event.title}
            width="standard"
            sidebar={false}
            backTo={`/member/events/${id}`}
        >
            <div className="space-y-5">
                {/* ---------------------------------------------- stepper ---- */}
                <ol className="flex items-center gap-2">
                    {steps.map((s, i) => {
                        const done = i < stepIndex;
                        const current = i === stepIndex;

                        return (
                            <li key={s.key} className="flex items-center gap-2 min-w-0 flex-1 last:flex-none">
                                <span className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center
                                                  text-[1.0625rem] font-bold transition-colors ${
                                    done ? 'bg-emerald-600 text-white'
                                        : current ? 'bg-blue-600 text-white'
                                            : 'bg-slate-200 text-slate-500'
                                }`}>
                                    {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                                </span>
                                <span className={`text-[1.0625rem] font-semibold truncate ${
                                    current ? 'text-slate-900' : 'text-slate-400'
                                }`}>
                                    {s.label}
                                </span>
                                {i < steps.length - 1 ? (
                                    <span className={`h-px flex-1 min-w-4 ${
                                        done ? 'bg-emerald-300' : 'bg-slate-200'
                                    }`} />
                                ) : null}
                            </li>
                        );
                    })}
                </ol>

                <div className="grid gap-5 lg:grid-cols-12 items-start">
                    {/* ------------------------------------------ main ------- */}
                    <div className="lg:col-span-7 space-y-5">
                        {step === 'details' ? (
                            <form
                                onSubmit={submitDetails}
                                className="bg-white rounded-2xl border border-slate-200 shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)] p-5 lg:p-6
                                           space-y-4"
                            >
                                <div>
                                    <h2 className={`${CARD_TITLE} text-slate-900`}>Your details</h2>
                                    <p className="text-[1.0625rem] text-slate-500 mt-0.5">
                                        So the organiser can reach you on the day.
                                    </p>
                                </div>

                                <Field
                                    label="Your name"
                                    required
                                    value={form.memberName}
                                    onChange={(v) => setForm({ ...form, memberName: v })}
                                />
                                <Field
                                    label="Phone"
                                    value={form.phone}
                                    placeholder="For the organiser to reach you on the day"
                                    onChange={(v) => setForm({ ...form, phone: v })}
                                />
                                <Field
                                    label="Organisation"
                                    value={form.organization}
                                    placeholder="Optional"
                                    onChange={(v) => setForm({ ...form, organization: v })}
                                />

                                {/*
                                  * The questions THIS event asks.
                                  *
                                  * Rendered from the event's own definition — this
                                  * file holds no list of known fields, so the
                                  * association adds a question in the CMS and it
                                  * appears here without a deploy.
                                  */}
                                {fields.length > 0 ? (
                                    <div className="pt-4 border-t border-slate-100 space-y-4">
                                        <p className="text-[1.0625rem] font-bold uppercase tracking-wide
                                                      text-slate-500">
                                            For this event
                                        </p>
                                        {fields.map((field) => (
                                            <CustomField
                                                key={field.key}
                                                field={field}
                                                value={answers[field.key]}
                                                onChange={(value) =>
                                                    setAnswers((c) => ({ ...c, [field.key]: value }))}
                                            />
                                        ))}
                                    </div>
                                ) : null}

                                <div className="pt-4 border-t border-slate-100 space-y-4">
                                    <Field
                                        label="Anything the organiser should know"
                                        value={form.note}
                                        placeholder="Optional"
                                        onChange={(v) => setForm({ ...form, note: v })}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={working || !form.memberName.trim()}
                                    className="w-full h-12 rounded-xl bg-blue-600 text-white text-[1.1875rem]
                                               font-bold hover:bg-blue-700 disabled:opacity-60
                                               transition-colors inline-flex items-center justify-center gap-2"
                                >
                                    {working ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                    {full
                                        ? 'Join the waiting list'
                                        : willPay
                                            ? <>Continue to payment <ChevronRight className="w-4 h-4" /></>
                                            : 'Confirm registration'}
                                </button>
                            </form>
                        ) : null}

                        {step === 'payment' && registration ? (
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)] p-5 lg:p-6
                                            space-y-5">
                                <div>
                                    <h2 className={`${CARD_TITLE} text-slate-900`}>Payment</h2>
                                    <p className="text-[1.0625rem] text-slate-500 mt-0.5">
                                        Your seat is held. It is confirmed the moment this is paid.
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-blue-600
                                                text-white p-5 shadow-md">
                                    <p className="text-[1.0625rem] font-bold uppercase tracking-wider
                                                  text-blue-200">
                                        Amount due
                                    </p>
                                    <p className="text-[2.5625rem] font-extrabold mt-1 tabular-nums">
                                        ₹{registration.payment.amount.toLocaleString('en-IN')}
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
                                  No card number field, on purpose.

                                  A form that asks for real card details and does
                                  nothing with them teaches a member to type a card
                                  into this application — and the day a real gateway
                                  is wired in, those details must go to the gateway
                                  and never through this server.
                                */}
                                <div>
                                    <p className="text-[1.0625rem] font-bold uppercase tracking-wide
                                                  text-slate-500 mb-2">
                                        Pay using
                                    </p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {([
                                            { key: 'upi', label: 'UPI', icon: Smartphone },
                                            { key: 'card', label: 'Card', icon: CreditCard },
                                            { key: 'netbanking', label: 'Net banking', icon: Landmark },
                                        ] as const).map(({ key, label, icon: Icon }) => (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => setMethod(key)}
                                                aria-pressed={method === key}
                                                className={`h-[4.5rem] rounded-xl border-2 flex flex-col
                                                            items-center justify-center gap-1.5 transition-all ${
                                                    method === key
                                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                                                }`}
                                            >
                                                <Icon className="w-5 h-5" />
                                                <span className="text-[1.0625rem] font-bold">{label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={pay}
                                    disabled={working}
                                    className="w-full h-12 rounded-xl bg-emerald-600 text-white text-[1.1875rem]
                                               font-bold hover:bg-emerald-700 disabled:opacity-60
                                               transition-colors inline-flex items-center justify-center gap-2
                                               shadow-sm"
                                >
                                    {working
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <ShieldCheck className="w-4 h-4" />}
                                    Pay ₹{registration.payment.amount.toLocaleString('en-IN')}
                                </button>

                                <p className="text-[1.0625rem] text-amber-700 bg-amber-50 border
                                              border-amber-200 rounded-lg px-3 py-2 leading-snug
                                              flex items-start gap-1.5">
                                    <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
                                    <span>
                                        Test payment — no money is taken and no card details are collected.
                                        Your seat is confirmed straight away.
                                    </span>
                                </p>
                            </div>
                        ) : null}

                        {step === 'done' && registration ? (
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)] p-6 lg:p-8
                                            text-center">
                                <span className={`w-16 h-16 rounded-2xl mx-auto flex items-center
                                                  justify-center ${
                                    registration.status === 'waitlist'
                                        ? 'bg-amber-100 text-amber-600'
                                        : 'bg-emerald-100 text-emerald-600'
                                }`}>
                                    {registration.status === 'waitlist'
                                        ? <Users className="w-7 h-7" />
                                        : <PartyPopper className="w-7 h-7" />}
                                </span>

                                <h2 className={`${CARD_TITLE} text-slate-900 mt-4`}>
                                    {registration.status === 'waitlist'
                                        ? 'You are on the waiting list'
                                        : 'Your seat is confirmed'}
                                </h2>
                                <p className="text-[1.1875rem] text-slate-500 mt-1.5 max-w-sm mx-auto
                                              leading-relaxed">
                                    {registration.status === 'waitlist'
                                        ? 'You will move into a seat automatically if one is given up.'
                                        : `We have saved your place at ${event.title}.`}
                                </p>

                                {/* The ticket. The reference is what a member quotes
                                    at the door, so it is on the screen rather than
                                    only in an email nobody can find. */}
                                <div className="mt-6 rounded-xl border border-dashed border-slate-300
                                                bg-slate-50 p-4 text-left space-y-1.5">
                                    <ReceiptRow label="Name" value={registration.memberName || '—'} />
                                    <ReceiptRow label="Event" value={event.title} />
                                    <ReceiptRow label="When" value={formatWhen(event)} />
                                    {event.venue ? <ReceiptRow label="Venue" value={event.venue} /> : null}
                                    {registration.payment?.status === 'paid' ? (
                                        <>
                                            <ReceiptRow
                                                label="Paid"
                                                value={`₹${registration.payment.amount.toLocaleString('en-IN')}`}
                                            />
                                            <ReceiptRow
                                                label="Reference"
                                                value={registration.payment.reference || '—'}
                                            />
                                        </>
                                    ) : null}
                                    {(registration.responses || []).map((answer) => (
                                        <ReceiptRow
                                            key={answer.key}
                                            label={answer.label}
                                            value={answer.value || '—'}
                                        />
                                    ))}
                                </div>

                                <div className="flex flex-wrap gap-2 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/member/events/${event.id}`)}
                                        className="flex-1 h-11 rounded-xl bg-blue-600 text-white text-[1.1875rem]
                                                   font-bold hover:bg-blue-700 transition-colors"
                                    >
                                        Back to the event
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => navigate('/member/events')}
                                        className="flex-1 h-11 rounded-xl border border-slate-200
                                                   text-[1.1875rem] font-semibold text-slate-600
                                                   hover:bg-slate-50 transition-colors"
                                    >
                                        All events
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {/* ------------------------------------------ summary ---- */}
                    <aside className="lg:col-span-5 space-y-4 lg:sticky lg:top-24">
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)] overflow-hidden">
                            {resolveMediaUrl(event.bannerUrl) ? (
                                <div className="aspect-[16/9] bg-slate-100">
                                    <img
                                        src={resolveMediaUrl(event.bannerUrl)}
                                        alt={event.bannerAlt || ''}
                                        className="w-full h-full"
                                        style={{
                                            objectFit: event.bannerFit === 'contain' ? 'contain' : 'cover',
                                            objectPosition: event.bannerPosition || 'center',
                                        }}
                                    />
                                </div>
                            ) : null}

                            <div className="p-5 space-y-3">
                                <h3 className={`${CARD_TITLE} text-slate-900`}>
                                    {event.title}
                                </h3>

                                <p className="text-[1.0625rem] text-slate-600 flex items-start gap-2">
                                    <CalendarDays className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
                                    {formatWhen(event)}
                                </p>

                                {event.venue ? (
                                    <p className="text-[1.0625rem] text-slate-600 flex items-start gap-2">
                                        <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
                                        {event.venue}
                                    </p>
                                ) : null}

                                {left !== null ? (
                                    <p className={`text-[1.0625rem] font-semibold flex items-center gap-2 ${
                                        full ? 'text-amber-600' : 'text-slate-600'
                                    }`}>
                                        <Users className="w-4 h-4 shrink-0" />
                                        {full
                                            ? 'Full — waiting list only'
                                            : `${left} of ${event.capacity} seats left`}
                                    </p>
                                ) : null}
                            </div>

                            {/*
                              The order summary.

                              The figure is the one the SUPER ADMIN set on the
                              event. This screen never sends an amount and the
                              server reads it from the seat it wrote, so there is
                              nothing here a client could change.
                            */}
                            <div className="border-t border-slate-100 p-5 bg-slate-50">
                                <div className="flex items-baseline justify-between gap-3">
                                    <span className="text-[1.0625rem] text-slate-600 flex items-center gap-1.5">
                                        <Ticket className="w-3.5 h-3.5" />
                                        Registration fee
                                    </span>
                                    <span className={`text-[1.375rem] font-extrabold tabular-nums ${
                                        fee > 0 ? 'text-slate-900' : 'text-emerald-600'
                                    }`}>
                                        {fee > 0 ? `₹${fee.toLocaleString('en-IN')}` : 'Free'}
                                    </span>
                                </div>

                                {/* The membership's effect, on the screen that
                                    takes the money. */}
                                {savedByMembership > 0 ? (
                                    <p className="text-[1.0625rem] font-semibold text-emerald-600 mt-2">
                                        Member price applied — ₹{savedByMembership.toLocaleString('en-IN')} off
                                        the usual ₹{listFee.toLocaleString('en-IN')}.
                                    </p>
                                ) : null}

                                {full && fee > 0 ? (
                                    <p className="text-[1.0625rem] text-slate-500 mt-2 leading-snug">
                                        Nothing is charged for a place on the waiting list. You pay only if a
                                        seat becomes yours.
                                    </p>
                                ) : null}

                                {registration?.payment?.status === 'paid' ? (
                                    <p className="text-[1.0625rem] text-emerald-700 font-semibold mt-2
                                                  inline-flex items-center gap-1.5">
                                        <BadgeCheck className="w-3.5 h-3.5" /> Paid
                                    </p>
                                ) : null}
                            </div>
                        </div>

                        {event.registrationNote ? (
                            <p className="text-[1.0625rem] text-slate-600 leading-relaxed bg-blue-50
                                          border border-blue-100 rounded-xl p-4">
                                {event.registrationNote}
                            </p>
                        ) : null}

                        {step !== 'done' ? (
                            <button
                                type="button"
                                onClick={() => navigate(`/member/events/${event.id}`)}
                                className="w-full h-10 rounded-xl text-[1.0625rem] font-semibold
                                           text-slate-500 hover:text-slate-700 inline-flex items-center
                                           justify-center gap-1"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" /> Back to the event
                            </button>
                        ) : null}
                    </aside>
                </div>
            </div>
        </MemberPageShell>
    );
}

// ---------------------------------------------------------------- fields

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
            <span className="block text-[1.0625rem] font-semibold text-slate-600 mb-1.5">
                {label}
                {required ? <span className="text-red-500"> *</span> : null}
            </span>
            <input
                type="text"
                value={value}
                required={required}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                className={INPUT}
            />
        </label>
    );
}

/**
 * One question from the event's own registration form.
 *
 * A switch on the declared type and nothing else — this component knows what a
 * dropdown looks like, not what any particular event asks. That is the whole
 * arrangement: the association adds a question in the CMS and it appears here
 * without a deploy.
 *
 * `required` is passed to the browser AND enforced on the server. The attribute
 * is the courtesy; the server check is the rule, because a request made by
 * anything other than this page never saw the attribute.
 */
function CustomField({
    field,
    value,
    onChange,
}: {
    field: RegistrationFieldDef;
    value: string | boolean | undefined;
    onChange: (value: string | boolean) => void;
}) {
    if (field.type === 'checkbox') {
        return (
            <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                    type="checkbox"
                    checked={value === true}
                    required={field.required}
                    onChange={(e) => onChange(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-blue-600 shrink-0"
                />
                <span className="min-w-0">
                    <span className="block text-[1.0625rem] text-slate-700 leading-snug">
                        {field.label}
                        {field.required ? <span className="text-red-500"> *</span> : null}
                    </span>
                    {field.helpText ? (
                        <span className="block text-[1.0625rem] text-slate-400 mt-0.5">{field.helpText}</span>
                    ) : null}
                </span>
            </label>
        );
    }

    const text = typeof value === 'string' ? value : '';

    return (
        <label className="block">
            <span className="block text-[1.0625rem] font-semibold text-slate-600 mb-1.5">
                {field.label}
                {field.required ? <span className="text-red-500"> *</span> : null}
            </span>

            {field.type === 'textarea' ? (
                <textarea
                    rows={3}
                    value={text}
                    required={field.required}
                    placeholder={field.placeholder}
                    onChange={(e) => onChange(e.target.value)}
                    className={`${INPUT} h-auto py-2.5 resize-y`}
                />
            ) : field.type === 'select' ? (
                <select
                    value={text}
                    required={field.required}
                    onChange={(e) => onChange(e.target.value)}
                    className={`${INPUT} bg-white`}
                >
                    {/* An empty first option so a required dropdown starts
                        unanswered rather than silently defaulting to whichever
                        option the organiser happened to type first. */}
                    <option value="">{field.placeholder || 'Choose…'}</option>
                    {(field.options || []).map((option) => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
            ) : (
                <input
                    type={
                        field.type === 'number' ? 'number'
                            : field.type === 'email' ? 'email'
                                : field.type === 'phone' ? 'tel'
                                    : field.type === 'date' ? 'date'
                                        : 'text'
                    }
                    value={text}
                    required={field.required}
                    placeholder={field.placeholder}
                    onChange={(e) => onChange(e.target.value)}
                    className={INPUT}
                />
            )}

            {field.helpText ? (
                <span className="block text-[1.0625rem] text-slate-400 mt-1">{field.helpText}</span>
            ) : null}
        </label>
    );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <span className="text-[1.0625rem] text-slate-500 shrink-0">{label}</span>
            <span className="text-[1.0625rem] font-semibold text-slate-900 text-right break-words">
                {value}
            </span>
        </div>
    );
}
