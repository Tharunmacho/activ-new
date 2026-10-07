import { useCallback, useEffect, useState } from 'react';
import {
    Crown, Infinity as InfinityIcon, BadgeCheck, Award, CalendarCheck, Headset, Sparkles, Check, X,
    Phone, MessageCircle, Mail, Loader2, Send, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import api, { unwrap } from '@/services/api';
import { isMemberSession } from '@/lib/session';
import {
    getMyPlatinumRequest, applyForPlatinum, type PlatinumContact, type PlatinumRequest,
} from '@/services/platinumApi';

/**
 * PLATINUM — the lifetime tier, on the member's side.
 *
 * One showcase (`PlatinumShowcase`) carries the offer AND the way in: a member
 * presses "Apply for Platinum", says how the office should reach them, and a
 * request lands with the ACTIV office and every Super Admin
 * (`members/platinum.service.createRequest`). The office calls, the fee is paid
 * at the office, and the Super Admin grants it — which closes the request.
 *
 * The price is the `platinum` plan row the Super Admin edits, read live —
 * never a number typed into this file. Blue brand theme; gold only on the
 * crown.
 */

const GOLD = 'text-[#f5d27a]';

export function PlatinumBadge({ size = 'md', label = 'Lifetime' }: { size?: 'sm' | 'md' | 'lg'; label?: string }) {
    const pad = size === 'sm' ? 'px-2 py-0.5 text-[0.75rem]' : size === 'lg' ? 'px-3.5 py-1.5 text-base' : 'px-2.5 py-1 text-[0.8125rem]';
    const icon = size === 'lg' ? 'h-4 w-4' : size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';
    return (
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-[#0b1f5c] via-[#1e3a8a] to-[#2563eb]
                          font-semibold text-white ring-1 ring-[#f5d27a]/70 ${pad}`}>
            <Crown className={`${icon} ${GOLD}`} /> {label}
        </span>
    );
}

export const isPlatinumProfile = (profile: any): boolean =>
    String(profile?.membershipTier || '').toLowerCase() === 'platinum';

/** The Platinum plan's live price, or null when the association has retired it. */
export const usePlatinumPrice = (): number | null => {
    const [price, setPrice] = useState<number | null>(null);
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                // Platinum is left out of the public list unless asked for.
                const body = unwrap<any>(await api.get('/membership/plans', { params: { include: 'platinum' } }), {});
                const rows: any[] = Array.isArray(body) ? body : Array.isArray(body?.plans) ? body.plans : [];
                const row = rows.find((r) =>
                    r && (r.audience === 'platinum' || r.key === 'platinum' || r.id === 'platinum') && r.active !== false && r.isActive !== false);
                const value = row ? Number(row.price ?? row.amount ?? (row.amountPaise ? row.amountPaise / 100 : 0)) : 0;
                if (!cancelled) setPrice(value > 0 ? value : null);
            } catch {
                if (!cancelled) setPrice(null);
            }
        })();
        return () => { cancelled = true; };
    }, []);
    return price;
};

const BENEFITS = [
    { icon: InfinityIcon, title: 'Member for life', text: 'One payment — no renewal, ever.' },
    { icon: BadgeCheck, title: 'Lifetime badge', text: 'On your dashboard and your membership certificate.' },
    { icon: Award, title: 'Recognised at ACTIV', text: 'Acknowledged as a Lifetime member at association conclaves.' },
    { icon: CalendarCheck, title: 'First to hear', text: 'Early word on ACTIV events and business programmes.' },
    { icon: Headset, title: 'A direct line', text: 'The ACTIV office looks after your membership personally.' },
    { icon: Sparkles, title: 'Everything included', text: 'Every member benefit, for as long as you are a member.' },
];

const CONTACTS: { key: PlatinumContact; label: string; icon: typeof Phone }[] = [
    { key: 'call', label: 'Phone call', icon: Phone },
    { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
    { key: 'email', label: 'Email', icon: Mail },
];

const STATUS_COPY: Record<string, { title: string; text: string }> = {
    new: { title: 'We have your request', text: 'The ACTIV office will contact you within two working days.' },
    contacted: { title: 'The office has been in touch', text: 'Complete the payment at the office and your membership is upgraded to Lifetime.' },
};

function ApplyForm({ onDone, onCancel }: { onDone: (r: PlatinumRequest) => void; onCancel: () => void }) {
    const [contact, setContact] = useState<PlatinumContact>('call');
    const [time, setTime] = useState('');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        try {
            const res = await applyForPlatinum({ preferredContact: contact, preferredTime: time.trim(), message: message.trim() });
            toast.success(res?.existing ? 'We already have your request — the office will contact you' : 'Request received — the ACTIV office will contact you');
            if (res?.request) onDone(res.request);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || err?.message || 'Your request could not be sent');
        } finally {
            setBusy(false);
        }
    };

    const field = 'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

    return (
        <form onSubmit={submit} className="mt-4 rounded-2xl bg-white p-4 sm:p-5 text-slate-800 shadow-xl">
            <p className="font-display text-[1.125rem] sm:text-[1.25rem] font-bold text-slate-900">How should the ACTIV office reach you?</p>
            <div role="radiogroup" aria-label="Preferred contact" className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {CONTACTS.map(({ key, label, icon: Icon }) => {
                    const on = contact === key;
                    return (
                        <button key={key} type="button" role="radio" aria-checked={on} onClick={() => setContact(key)}
                            className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left font-semibold transition-colors ${on
                                ? 'border-blue-600 bg-blue-50 text-blue-800 ring-2 ring-blue-100'
                                : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                            <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${on ? 'border-blue-600' : 'border-slate-300'}`}>
                                {on ? <span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> : null}
                            </span>
                            <Icon className="h-4 w-4 shrink-0" /> {label}
                        </button>
                    );
                })}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-[0.9375rem] font-semibold text-slate-700">Best time to reach you
                    <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="e.g. Weekdays after 6 pm" className={`${field} h-11`} />
                </label>
                <label className="block text-[0.9375rem] font-semibold text-slate-700">Anything to add? <span className="font-normal text-slate-400">(optional)</span>
                    <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="A question for the office" className={`${field} h-11`} />
                </label>
            </div>
            <p className="mt-3 text-[0.875rem] text-slate-500">
                Nothing is charged online. The office explains the next steps; Lifetime is paid at the office and
                activated for you once your membership application is approved.
            </p>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={onCancel} disabled={busy}
                    className="min-h-11 rounded-xl border border-slate-200 px-4 font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={busy}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 font-semibold text-white disabled:opacity-70">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send my request
                </button>
            </div>
        </form>
    );
}

/**
 * The Platinum section — offer, benefits, comparison and the apply flow.
 * `context` only changes one line of copy.
 */
export function PlatinumShowcase({ context = 'dashboard' }: { context?: 'application' | 'dashboard' }) {
    const price = usePlatinumPrice();
    const member = isMemberSession();
    const [state, setState] = useState<{ loaded: boolean; request: PlatinumRequest | null; isPlatinum: boolean }>(
        { loaded: !member, request: null, isPlatinum: false });
    const [open, setOpen] = useState(false);

    const load = useCallback(async () => {
        if (!member) return;
        try {
            const r = await getMyPlatinumRequest();
            setState({ loaded: true, request: r?.request || null, isPlatinum: !!r?.isPlatinum });
        } catch {
            setState((s) => ({ ...s, loaded: true }));
        }
    }, [member]);
    useEffect(() => { load(); }, [load]);

    if (!price || state.isPlatinum) return null; // retired plan, or they already hold it

    const req = state.request;
    const openRequest = req && (req.status === 'new' || req.status === 'contacted') ? req : null;
    /* On the application form it is an aside under the step, not the page:
       smaller, benefits as chips, no comparison rows. The dashboard keeps the full card. */
    const compact = context === 'application';

    return (
        <section className={`relative overflow-hidden bg-gradient-to-br from-[#0b1f5c] via-[#1e3a8a] to-[#2563eb] text-white ${compact ? 'rounded-2xl p-4 sm:p-5' : 'rounded-3xl p-5 sm:p-8 shadow-[0_18px_44px_-16px_rgba(30,58,138,0.6)]'}`}>
            <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-sky-300/20 blur-3xl" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-blue-400/20 blur-3xl" />

            {/* ---- headline + price ---- */}
            <div className={`relative flex flex-col lg:flex-row lg:items-start lg:justify-between ${compact ? 'gap-3' : 'gap-5'}`}>
                <div className="min-w-0 max-w-2xl">
                    <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[0.8125rem] font-semibold uppercase tracking-[0.16em] ring-1 ring-white/20">
                        <Crown className={`h-4 w-4 ${GOLD}`} /> Lifetime membership
                    </p>
                    <h3 className={`font-display font-bold leading-tight ${compact ? 'mt-2 text-[1.25rem] sm:text-[1.5rem]' : 'mt-3 text-[1.75rem] sm:text-[2.25rem]'}`}>
                        Join once. Stay an ACTIV member for life.
                    </h3>
                    <p className={`text-blue-100 ${compact ? 'mt-1 text-[0.9375rem]' : 'mt-2 text-[1rem] sm:text-[1.0625rem]'}`}>
                        {context === 'application'
                            ? 'Building a business? Lifetime makes your membership permanent — one payment, no renewals, and the association’s highest recognition.'
                            : 'Upgrade to Lifetime: one payment makes your membership permanent, with the association’s highest recognition.'}
                    </p>
                </div>
                <div className={`shrink-0 rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur-sm ${compact ? 'p-3 sm:p-4 lg:min-w-[12rem]' : 'p-4 sm:p-5 lg:min-w-[15rem]'}`}>
                    <p className="text-[0.8125rem] font-semibold uppercase tracking-wider text-blue-100">One payment</p>
                    <p className={`font-display font-bold leading-none ${compact ? 'text-[1.625rem] sm:text-[1.875rem]' : 'text-[2rem] sm:text-[2.5rem]'}`}>₹{price.toLocaleString('en-IN')}</p>
                    <p className="mt-2 flex items-center gap-1.5 text-[0.9375rem] text-blue-100"><InfinityIcon className="h-4 w-4" /> Valid for life · never renew</p>
                </div>
            </div>

            {/* ---- benefits ---- */}
            {compact ? (
                <ul className="relative mt-3 flex flex-wrap gap-2">
                    {BENEFITS.map(({ icon: Icon, title }) => (
                        <li key={title} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[0.875rem] font-semibold ring-1 ring-white/15">
                            <Icon className="h-3.5 w-3.5" /> {title}
                        </li>
                    ))}
                </ul>
            ) : (
            <ul className="relative mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {BENEFITS.map(({ icon: Icon, title, text }) => (
                    <li key={title} className="flex min-w-0 items-start gap-3 rounded-2xl bg-white/[0.08] p-3.5 ring-1 ring-white/15">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15"><Icon className="h-5 w-5" /></span>
                        <span className="min-w-0">
                            <span className="block font-semibold">{title}</span>
                            <span className="block text-[0.9375rem] text-blue-100">{text}</span>
                        </span>
                    </li>
                ))}
            </ul>
            )}

            {/* ---- annual vs platinum (full card only) ---- */}
            {compact ? null : (
            <div className="relative mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="flex items-center gap-2 rounded-xl bg-white/[0.06] px-4 py-3 text-blue-100 ring-1 ring-white/10">
                    <X className="h-4 w-4 shrink-0 text-blue-200" /> <span><strong className="text-white">Annual membership</strong> — renew every year</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-blue-900">
                    <Check className="h-4 w-4 shrink-0 text-emerald-600" /> <span><strong>Lifetime</strong> — pay once, never renew</span>
                </div>
            </div>
            )}

            {/* ---- the way in ---- */}
            <div className={`relative ${compact ? 'mt-4' : 'mt-6'}`}>
                {!member ? (
                    <p className="text-[0.9375rem] text-blue-100">Sign in as a member to apply for Lifetime.</p>
                ) : !state.loaded ? null : openRequest ? (
                    <div className="flex items-start gap-3 rounded-2xl bg-white p-4 text-slate-800">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Clock className="h-5 w-5" /></span>
                        <div className="min-w-0">
                            <p className="font-semibold text-slate-900">{STATUS_COPY[openRequest.status].title}</p>
                            <p className="text-[0.9375rem] text-slate-600">{STATUS_COPY[openRequest.status].text}</p>
                        </div>
                    </div>
                ) : open ? (
                    <ApplyForm onCancel={() => setOpen(false)} onDone={(r) => { setOpen(false); setState((s) => ({ ...s, request: r })); }} />
                ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <button type="button" onClick={() => setOpen(true)}
                            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 text-base font-bold text-blue-800
                                       shadow-lg transition-transform hover:-translate-y-0.5 sm:w-auto">
                            <Crown className="h-5 w-5 text-[#d4a72c]" /> Apply for Lifetime
                        </button>
                        <p className="text-[0.9375rem] text-blue-100">No payment online — the ACTIV office calls you and explains everything.</p>
                    </div>
                )}
            </div>
        </section>
    );
}

/** On the application form (business applicants). */
export function PlatinumNotice() {
    return <PlatinumShowcase context="application" />;
}

/** On the paid dashboard. `onContact` is kept for compatibility; the showcase carries its own apply flow. */
export function PlatinumOffer(_props: { onContact?: () => void; compact?: boolean }) {
    return <PlatinumShowcase context="dashboard" />;
}
