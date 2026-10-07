import { createPortal } from 'react-dom';
/**
 * Payment Successful — and, at `?view=receipt`, the same payment as a receipt.
 *
 * A STANDALONE PAGE. No member rail: this is a moment, not a place a member
 * navigates around in, and the rail beside a celebration read as the dashboard
 * with a banner on it. `MemberPageShell` with `sidebar={false}` gives the slim
 * top bar and a Back button — the only way out a confirmation needs.
 *
 * Every value is read back from the server rather than passed through the
 * navigation. A receipt assembled from whatever the previous screen held is a
 * receipt for what the client *thinks* it bought; this one shows what was
 * recorded, which is the only version worth printing.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
    ArrowRight, Award, BadgeCheck, CalendarDays, Check, Copy, CreditCard, Hash,
    LayoutDashboard, Loader2, MailCheck, Printer, ReceiptText, ShieldCheck, Sparkles, UserRound,
} from 'lucide-react';
import MemberPageShell from '@/pages/member/MemberPageShell';
import { getMyProfile } from '@/services/activApi';
import { getUserApplication } from '@/services/applicationApi';
import { formatApplicationRef } from '@/lib/applicationRef';
import { getPaymentOrder } from '@/services/paymentApi';

const GRADIENT = 'bg-gradient-to-br from-[#0b1f5c] via-[#1e3a8a] to-[#2563eb]';

const money = (n: unknown): string => {
    const value = Number(n);
    if (n === null || n === undefined || !Number.isFinite(value) || value < 0) return '—';
    return `₹${value.toLocaleString('en-IN')}`;
};

const formatDate = (value?: string | Date | null): string => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
};

const titleCase = (s: string) => (s || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Confetti pieces for the hero — positions fixed so the render is stable. */
const CONFETTI = [
    { l: '8%', d: '0s', c: '#93c5fd' }, { l: '18%', d: '.4s', c: '#fde68a' }, { l: '29%', d: '.9s', c: '#bfdbfe' },
    { l: '41%', d: '.2s', c: '#a7f3d0' }, { l: '55%', d: '.7s', c: '#fde68a' }, { l: '66%', d: '.3s', c: '#93c5fd' },
    { l: '77%', d: '1s', c: '#bfdbfe' }, { l: '88%', d: '.5s', c: '#a7f3d0' }, { l: '94%', d: '1.2s', c: '#fde68a' },
];

export default function PaymentSuccess() {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const [profile, setProfile] = useState<any>(null);
    const [application, setApplication] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [order, setOrder] = useState<any>(null);
    const [orderError, setOrderError] = useState('');
    const [copied, setCopied] = useState(false);

    const isReceipt = searchParams.get('view') === 'receipt';
    /* Set by the payment screen when this payment RENEWED an existing membership. */
    const renewed = !isReceipt && (location.state as any)?.renewed === true;
    const requestedOrder = searchParams.get('orderId') || '';

    const load = useCallback(async () => {
        setLoading(true); setOrderError('');
        const [p, a] = await Promise.allSettled([getMyProfile(), getUserApplication()]);
        setProfile(p.status === 'fulfilled' ? p.value : null);
        setApplication(a.status === 'fulfilled' ? a.value : null);
        const orderId = requestedOrder || (p.status === 'fulfilled' ? p.value?.paidMembership?.orderId : '');
        if (orderId) {
            try {
                const receipt = await getPaymentOrder(orderId);
                if (receipt.status !== 'paid' || receipt.orderType !== 'membership') throw new Error('This membership payment is not confirmed.');
                setOrder(receipt);
            } catch {
                setOrder(null);
                if (requestedOrder) setOrderError('This receipt could not be loaded. Check that you are signed in to the account that made this payment.');
            }
        } else setOrder(null);
        setLoading(false);
    }, [requestedOrder]);

    useEffect(() => {
        load();
        /*
         * ONLY WHEN A PAYMENT ACTUALLY JUST HAPPENED. The dashboards gate on
         * membership, so arriving from the gateway must tell them it moved.
         * Opening the same page as a RECEIPT is not that event.
         */
        if (searchParams.get('view') === 'receipt') return;
        window.dispatchEvent(new CustomEvent('paymentCompleted'));
        window.dispatchEvent(new Event('profileUpdated'));
    }, [load, searchParams]);

    const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/member/documents'));

    const shellProps = {
        title: isReceipt ? 'Payment receipt' : 'Payment successful',
        subtitle: isReceipt ? 'Your membership fee, as recorded' : renewed ? 'Your membership is renewed' : 'Your membership is now active',
        width: 'standard' as const,
        sidebar: false,
        backTo: isReceipt ? '/member/documents' : '/payment/member-dashboard',
        onBack: isReceipt ? goBack : () => navigate('/payment/member-dashboard'),
    };

    if (loading) {
        return (
            <MemberPageShell {...shellProps}>
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
            </MemberPageShell>
        );
    }

    if (orderError) return <MemberPageShell {...shellProps}><div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800"><p>{orderError}</p><button className="mt-4 font-semibold underline" onClick={() => void load()}>Retry loading receipt</button></div></MemberPageShell>;

    /* ------------------------------------------------------------ the facts */
    const memberName = String(profile?.fullName || application?.fullName || '');
    const firstName = memberName.split(' ').filter(Boolean)[0] || 'member';
    const memberId = String(profile?.membershipNumber || profile?.memberCode || formatApplicationRef(application).short || '');
    const kind = String(order?.planAudience || profile?.memberType || application?.memberType || '').toLowerCase();
    const kindLabel = kind === 'student' ? 'Student' : kind === 'aspirant' ? 'Aspirant' : kind === 'business' ? 'Business' : '';
    const platinum = order ? kind === 'platinum' : String(profile?.membershipTier || '').toLowerCase() === 'platinum';
    const typeRaw = String(order?.membershipType || profile?.membershipType || '').toLowerCase();
    const lifetime = typeRaw === 'lifetime' || platinum;
    const planName = order?.planName || profile?.paidMembership?.planName || (platinum ? 'Lifetime membership' : [kindLabel, 'membership'].filter(Boolean).join(' ') || 'ACTIV membership');
    const period = lifetime ? 'Lifetime' : typeRaw === 'annual' ? 'Annual' : '';
    const paidAt = order?.paidAt || profile?.lastPaymentDate || profile?.membershipActivatedAt || null;
    const amount = order?.amount ?? profile?.lastPaymentAmount ?? profile?.paymentAmount;
    const txnRef = String(order?.gatewayPaymentId || profile?.paymentId || '');
    const method = String(order?.paymentMethod || profile?.paymentMethod || '');

    const validUntil = (() => {
        if (lifetime) return 'Lifetime — no renewal';
        // A receipt for an older annual payment must not acquire the member's
        // current expiry after a later renewal or Platinum upgrade.
        if (order && order.orderId !== profile?.paidMembership?.orderId
            && order.orderId !== profile?.paymentId && order.gatewayPaymentId !== profile?.paymentId) return '';
        if (profile?.membershipExpiresAt) return formatDate(profile.membershipExpiresAt);
        const start = profile?.membershipActivatedAt || paidAt;
        if (!start) return '';
        const d = new Date(start);
        if (Number.isNaN(d.getTime())) return '';
        d.setFullYear(d.getFullYear() + 1);
        return formatDate(d);
    })();

    const copyRef = async () => {
        try {
            await navigator.clipboard.writeText(txnRef);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
        } catch {
            toast.error('Could not copy — select the reference and copy it instead');
        }
    };

    const rows: { icon: typeof Hash; label: string; value: string }[] = [
        { icon: BadgeCheck, label: 'Paid for', value: [planName, period && !lifetime ? `· ${period}` : ''].filter(Boolean).join(' ') },
        { icon: CalendarDays, label: 'Valid until', value: validUntil },
        { icon: UserRound, label: 'Member name', value: memberName },
        { icon: Hash, label: 'Member ID', value: memberId },
        { icon: CalendarDays, label: 'Paid on', value: formatDate(paidAt) },
        ...(method ? [{ icon: CreditCard, label: 'Payment method', value: titleCase(method) }] : []),
    ].filter((r) => !!r.value);

    return (
        <MemberPageShell {...shellProps}>
            <style>{`
                @keyframes ps-pop { 0% { transform: scale(.4); opacity: 0 } 60% { transform: scale(1.08); opacity: 1 } 100% { transform: scale(1) } }
                @keyframes ps-ring { 0% { transform: scale(.8); opacity: .55 } 100% { transform: scale(1.9); opacity: 0 } }
                @keyframes ps-fall { 0% { transform: translateY(-20px) rotate(0); opacity: 0 } 15% { opacity: 1 } 100% { transform: translateY(180px) rotate(320deg); opacity: 0 } }
                .ps-pop { animation: ps-pop .6s cubic-bezier(.2,.9,.3,1.3) both }
                .ps-ring { animation: ps-ring 2.2s ease-out infinite }
                .ps-confetti { animation: ps-fall 3.2s ease-in infinite }
                @media (prefers-reduced-motion: reduce) { .ps-pop, .ps-ring, .ps-confetti { animation: none !important } .ps-confetti { display: none } }
                .ps-print-sheet { display: none }
                /* PRINT / SAVE AS PDF: only the A4 receipt sheet below, on one page.
                   The page itself scrolls inside the shell, so printing the screen
                   cut the receipt at whatever was on screen — hence a dedicated sheet. */
                @media print {
                    @page { size: A4 portrait; margin: 12mm }
                    html, body { background: #fff !important }
                    /* The sheet is portalled onto <body>; everything else is removed,
                       not hidden, so it cannot push a blank second page. */
                    body > *:not(.ps-print-sheet) { display: none !important }
                    .ps-print-sheet { display: block !important; -webkit-print-color-adjust: exact; print-color-adjust: exact }
                }
            `}</style>

            {/* ================= the printable receipt (print / PDF only) */}
            {createPortal(
            <div className="ps-print-sheet" aria-hidden="true">
                <div style={{ fontFamily: 'Poppins, Arial, sans-serif', color: '#0f172a', border: '2px solid #1e3a8a', borderRadius: 16, overflow: 'hidden' }}>
                    <div style={{ background: 'linear-gradient(135deg,#0b1f5c,#1e3a8a 55%,#2563eb)', color: '#fff', padding: '22px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <img src="/logo_ACTIVian-removebg-preview.png" alt="ACTIV" style={{ height: 46, background: '#fff', borderRadius: 8, padding: '4px 8px' }} />
                            <div>
                                <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.3 }}>Adidravidar Confederation of Trade &amp; Industrial Vision</div>
                                <div style={{ fontSize: 12, opacity: 0.85 }}>6&amp;7, Hayagreeva Apartment, 121, Velachery Main Road, Chennai 600032 · member@activ.org.in · +91 82201 12188</div>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.85 }}>Payment receipt</div>
                            <div style={{ fontSize: 13, marginTop: 2 }}>{formatDate(paidAt) || formatDate(new Date().toISOString())}</div>
                        </div>
                    </div>
                    <div style={{ padding: '26px 28px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: 13, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.5 }}>Received from</div>
                                <div style={{ fontSize: 24, fontWeight: 800 }}>{memberName}</div>
                                {memberId ? <div style={{ fontSize: 14, color: '#334155' }}>Member ID: <b>{memberId}</b></div> : null}
                            </div>
                            <div style={{ border: '3px solid #059669', color: '#059669', borderRadius: 10, padding: '6px 16px', fontSize: 22, fontWeight: 900, letterSpacing: 4, transform: 'rotate(-6deg)' }}>PAID</div>
                        </div>
                        <table style={{ width: '100%', marginTop: 22, borderCollapse: 'collapse', fontSize: 15 }}>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.label}>
                                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', color: '#64748b', width: '38%' }}>{r.label}</td>
                                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', fontWeight: 700 }}>{r.value}</td>
                                    </tr>
                                ))}
                                {txnRef ? (
                                    <tr>
                                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>Transaction reference</td>
                                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', fontWeight: 700, fontFamily: 'monospace' }}>{txnRef}</td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                        <div style={{ marginTop: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '16px 20px' }}>
                            <span style={{ fontSize: 16, fontWeight: 700, color: '#1e3a8a' }}>Amount paid</span>
                            <span style={{ fontSize: 28, fontWeight: 900, color: '#1e3a8a' }}>{money(amount)}</span>
                        </div>
                        <p style={{ marginTop: 26, fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
                            This is a computer-generated receipt for your ACTIV membership fee and needs no signature.
                            Your membership and 80G tax certificates are available in your member dashboard at activ.org.in.
                        </p>
                    </div>
                    <div style={{ background: '#0b1f5c', color: '#fff', fontSize: 12, padding: '10px 28px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>www.activ.org.in</span><span>Thank you for being part of ACTIV</span>
                    </div>
                </div>
            </div>, document.body)}

            <div className="w-full space-y-5 sm:space-y-6">
                {/* =============================================== hero */}
                {isReceipt ? (
                    <section className={`ps-no-print relative overflow-hidden rounded-3xl ${GRADIENT} px-5 py-6 sm:px-8 sm:py-7 text-white`}>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3">
                                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                                    <ReceiptText className="h-6 w-6" />
                                </span>
                                <div className="min-w-0">
                                    <p className="text-[0.8125rem] font-semibold uppercase tracking-[0.16em] text-blue-100">Payment receipt</p>
                                    <p className="font-display text-[1.375rem] sm:text-[1.625rem] font-bold leading-tight">{planName}</p>
                                </div>
                            </div>
                            <div className="sm:text-right">
                                <p className="text-[0.8125rem] font-semibold uppercase tracking-[0.16em] text-blue-100">Amount paid</p>
                                <p className="font-display text-[2rem] sm:text-[2.25rem] font-bold leading-none tabular-nums">{money(amount)}</p>
                            </div>
                        </div>
                    </section>
                ) : (
                    <section className={`ps-no-print relative overflow-hidden rounded-3xl ${GRADIENT} px-5 pb-8 pt-9 sm:px-10 sm:pb-10 sm:pt-12 text-center text-white
                                         shadow-[0_24px_60px_-24px_rgba(30,58,138,0.7)]`}>
                        <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-20 h-64 w-64 rounded-full bg-sky-300/20 blur-3xl" />
                        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -right-10 h-72 w-72 rounded-full bg-blue-400/25 blur-3xl" />
                        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-40 overflow-hidden">
                            {CONFETTI.map((c, i) => (
                                <span key={i} className="ps-confetti absolute top-0 h-2.5 w-1.5 rounded-sm"
                                    style={{ left: c.l, animationDelay: c.d, backgroundColor: c.c }} />
                            ))}
                        </div>

                        <div className="relative mx-auto grid h-24 w-24 place-items-center sm:h-28 sm:w-28">
                            <span aria-hidden="true" className="ps-ring absolute inset-0 rounded-full bg-emerald-300/40" />
                            <span className="ps-pop relative grid h-20 w-20 place-items-center rounded-full bg-white shadow-xl sm:h-24 sm:w-24">
                                <Check className="h-10 w-10 text-emerald-500 sm:h-12 sm:w-12" strokeWidth={3} />
                            </span>
                        </div>

                        <span className="relative mt-5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-[0.8125rem] font-semibold uppercase tracking-[0.16em] ring-1 ring-white/25">
                            <Sparkles className="h-3.5 w-3.5 text-amber-200" /> Payment confirmed
                        </span>
                        <h2 className="relative mt-3 font-display text-[1.75rem] sm:text-[2.5rem] font-bold leading-tight">
                            {renewed ? `Thank you for renewing, ${firstName}!` : `Welcome to ACTIV, ${firstName}!`}
                        </h2>
                        <p className="relative mx-auto mt-2 max-w-xl text-[1rem] sm:text-[1.125rem] text-blue-100">
                            {renewed
                                ? `Your ${planName.toLowerCase()} is renewed${profile?.membershipExpiresAt ? ` until ${new Date(profile.membershipExpiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}. Every member benefit carries on.`
                                : `Your ${planName.toLowerCase()} is now active. Everything a member gets is open to you.`}
                        </p>

                        <div className="relative mx-auto mt-6 inline-flex flex-col items-center rounded-2xl bg-white/10 px-7 py-4 ring-1 ring-white/20 backdrop-blur-sm">
                            <span className="text-[0.8125rem] font-semibold uppercase tracking-[0.16em] text-blue-100">Total paid</span>
                            <span className="font-display text-[2.25rem] sm:text-[2.75rem] font-bold leading-none tabular-nums">{money(amount)}</span>
                            <span className="mt-1.5 text-[0.9375rem] text-blue-100">{planName}{period && !lifetime ? ` · ${period}` : ''}</span>
                        </div>
                    </section>
                )}

                <div className="grid items-start gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                    {/* =============================================== receipt */}
                    <section className="ps-receipt relative min-w-0 overflow-hidden rounded-3xl bg-white shadow-[0_1px_3px_rgba(16,24,40,0.08),0_18px_40px_-20px_rgba(16,24,40,0.28)] ring-1 ring-slate-200">
                        <div className="flex items-center justify-between gap-3 px-5 pt-5 sm:px-7 sm:pt-6">
                            <div className="flex min-w-0 items-center gap-2.5">
                                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
                                    <ReceiptText className="h-5 w-5" />
                                </span>
                                <div className="min-w-0">
                                    <p className="font-display text-[1.25rem] font-bold text-slate-900">Membership receipt</p>
                                    <p className="text-[0.9375rem] text-slate-500">Adidravidar Confederation of Trade &amp; Industrial Vision</p>
                                </div>
                            </div>
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[0.875rem] font-bold text-emerald-700 ring-1 ring-emerald-100">
                                <BadgeCheck className="h-4 w-4" /> Paid
                            </span>
                        </div>

                        {/* perforated divider */}
                        <div aria-hidden="true" className="relative my-5 h-6">
                            <span className="absolute -left-3 top-0 h-6 w-6 rounded-full bg-slate-100 ring-1 ring-slate-200" />
                            <span className="absolute -right-3 top-0 h-6 w-6 rounded-full bg-slate-100 ring-1 ring-slate-200" />
                            <span className="absolute inset-x-5 top-1/2 border-t-2 border-dashed border-slate-200" />
                        </div>

                        <dl className="grid gap-x-6 gap-y-4 px-5 sm:grid-cols-2 sm:px-7">
                            {rows.map(({ icon: Icon, label, value }) => (
                                <div key={label} className="flex min-w-0 items-start gap-3">
                                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-500">
                                        <Icon className="h-4 w-4" />
                                    </span>
                                    <div className="min-w-0">
                                        <dt className="text-[0.8125rem] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
                                        <dd className="mt-0.5 break-words text-[1.0625rem] font-semibold text-slate-900">{value}</dd>
                                    </div>
                                </div>
                            ))}
                        </dl>

                        <div className="mx-5 mt-5 flex items-center justify-between gap-3 rounded-2xl bg-blue-50/70 px-4 py-4 ring-1 ring-blue-100 sm:mx-7">
                            <span className="text-[1rem] font-semibold text-slate-700">Amount paid</span>
                            <span className="font-display text-[1.75rem] font-bold leading-none tabular-nums text-blue-800">{money(amount)}</span>
                        </div>

                        {txnRef ? (
                            <div className="mx-5 mt-3 flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200 sm:mx-7">
                                <div className="min-w-0 flex-1">
                                    <p className="text-[0.8125rem] font-semibold uppercase tracking-wider text-slate-500">Transaction reference</p>
                                    <p className="mt-0.5 break-all font-mono text-[0.9375rem] font-semibold text-slate-900">{txnRef}</p>
                                </div>
                                <button type="button" onClick={copyRef}
                                    className="ps-no-print inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 text-[0.9375rem] font-semibold text-blue-700 ring-1 ring-slate-200 hover:bg-blue-50">
                                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                        ) : null}

                        <div className="ps-no-print mt-5 flex flex-col gap-2 border-t border-slate-100 px-5 py-5 sm:flex-row sm:px-7">
                            <button type="button" onClick={() => window.print()}
                                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 font-semibold text-white sm:w-auto">
                                <Printer className="h-4 w-4" /> Print or save as PDF
                            </button>
                            <button type="button" onClick={() => navigate('/member/plan?view=standalone')}
                                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-5 font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 sm:w-auto">
                                View plan details
                            </button>
                        </div>
                    </section>

                    {/* =============================================== next */}
                    <aside className="ps-no-print min-w-0 space-y-4 lg:sticky lg:top-28">
                        <div className="rounded-3xl bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.08),0_18px_40px_-20px_rgba(16,24,40,0.28)] ring-1 ring-slate-200">
                            <p className="font-display text-[1.125rem] font-bold text-slate-900">Your documents</p>
                            <p className="text-[0.9375rem] text-slate-500">Ready now — open, print or save.</p>
                            <div className="mt-4 grid gap-2.5">
                                {[
                                    { Icon: Award, title: 'Membership certificate', note: 'With your Member ID', to: '/member/certificate/membership' },
                                    { Icon: ReceiptText, title: '80G tax certificate', note: 'For your income-tax filing', to: '/member/certificate/tax-exemption' },
                                ].map(({ Icon, title, note, to }) => (
                                    <button key={to} type="button" onClick={() => navigate(to)}
                                        className="group flex min-w-0 items-center gap-3 rounded-2xl p-3 text-left ring-1 ring-slate-200 transition-colors hover:bg-blue-50/60 hover:ring-blue-200">
                                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#1e3a8a] to-[#2563eb] text-white">
                                            <Icon className="h-5 w-5" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate font-semibold text-slate-900">{title}</span>
                                            <span className="block truncate text-[0.875rem] text-slate-500">{note}</span>
                                        </span>
                                        <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-600" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {!isReceipt ? (
                            <div className="flex gap-3 rounded-2xl bg-sky-50 p-4 ring-1 ring-sky-100">
                                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-sky-600">
                                    <MailCheck className="h-4 w-4" />
                                </span>
                                <div className="min-w-0">
                                    <p className="font-semibold text-sky-900">Confirmation sent</p>
                                    <p className="text-[0.9375rem] text-sky-800">Your receipt is on its way to your email and WhatsApp.</p>
                                </div>
                            </div>
                        ) : null}

                        <button type="button" onClick={() => navigate('/payment/member-dashboard')}
                            className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl ${GRADIENT} px-5 text-[1.0625rem] font-bold text-white shadow-[0_12px_28px_-12px_rgba(30,58,138,0.7)] transition-transform hover:-translate-y-0.5`}>
                            <LayoutDashboard className="h-5 w-5" /> Go to my dashboard <ArrowRight className="h-4 w-4" />
                        </button>
                        <p className="flex items-center justify-center gap-1.5 text-[0.875rem] text-slate-500">
                            <ShieldCheck className="h-4 w-4" /> Recorded securely by ACTIV
                        </p>
                    </aside>
                </div>
            </div>
        </MemberPageShell>
    );
}
