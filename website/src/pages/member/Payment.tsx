/**
 * Complete Membership — pick (or confirm) the plan and pay.
 *
 * The plans come from `membershipPlans.ts` → `/membership/plans/mine`: the one
 * the applicant's declaration earns them (business band, aspirant, student),
 * or every plan when the Super Admin has "show all" on. The AMOUNT IS NEVER
 * SENT: `payForMembership` takes the plan key and the server prices it from
 * its own table, so nothing this screen displays can change what is charged.
 *
 * Standalone (no rail): paying is a step somebody is working THROUGH, and
 * offering four ways to leave halfway is how a half-finished payment happens.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { renewalMessage, useRenewal } from '@/features/member/useRenewal';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
    ArrowRight, BadgeCheck, Briefcase, Check, FileText, GraduationCap, LayoutDashboard, Loader2, Lock,
    Mail, ShieldCheck, Sparkles, Zap, Handshake, CalendarDays, Users, Landmark, Award, TrendingUp, Store, BarChart3,
} from 'lucide-react';
import MemberPageShell from '@/pages/member/MemberPageShell';
import {
    resolvePlanEligibility, type MembershipPlan, type PlanEligibility,
} from '@/features/member/membershipPlans';
import { payForMembership, getPaymentConfig, startHostedMembershipPayment } from '@/services/paymentApi';
import { errorMessage } from '@/services/activApi';
import { dashboardPathFor } from '@/features/member/memberAccess';
import useMembershipGate from '@/features/member/useMembershipGate';

const GRADIENT = 'bg-gradient-to-br from-[#0b1f5c] via-[#1e3a8a] to-[#2563eb]';
const CARD = 'rounded-3xl bg-white ring-1 ring-slate-200 shadow-[0_1px_3px_rgba(16,24,40,0.08),0_18px_40px_-20px_rgba(16,24,40,0.28)]';

const rupees = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const AFTER_PAYMENT = [
    { Icon: Zap, title: 'Instant activation', text: 'Your membership goes live the moment payment clears.' },
    { Icon: FileText, title: 'Digital certificates', text: 'Membership and 80G certificates, ready to download.' },
    { Icon: Mail, title: 'Email & WhatsApp receipt', text: 'A confirmation with your Member ID, on both.' },
    { Icon: LayoutDashboard, title: 'Full member dashboard', text: 'Directory, messages, events and every benefit.' },
];

/*
 * WHY THIS MEMBERSHIP — per kind, so a student reads a student's reasons.
 * Kept to what the association actually does (the directory, events, schemes,
 * certificates, the office, the business account); no invented discounts.
 */
const KIND_BENEFITS: Record<'student' | 'aspirant' | 'business', { Icon: typeof Zap; title: string; text: string }[]> = {
    student: [
        { Icon: Handshake, title: 'Mentorship', text: 'Guidance from established ACTIV entrepreneurs while you study.' },
        { Icon: CalendarDays, title: 'Events & workshops', text: 'Invitations to conclaves, seminars and skill workshops.' },
        { Icon: Users, title: 'Member network', text: 'The ACTIV Network — reach business owners across the association.' },
        { Icon: Landmark, title: 'Schemes & funding', text: 'Updates on government schemes for first-generation entrepreneurs.' },
        { Icon: Award, title: 'Membership certificate', text: 'An official ACTIV certificate for your résumé and portfolio.' },
        { Icon: TrendingUp, title: 'Grow into business', text: 'Move to a Business membership the day you start trading.' },
    ],
    aspirant: [
        { Icon: Handshake, title: 'Start-up guidance', text: 'Mentors who have built businesses, for the one you are planning.' },
        { Icon: Landmark, title: 'Schemes & funding', text: 'Stand-Up India, MSME and state schemes explained and announced.' },
        { Icon: Users, title: 'Member network', text: 'Suppliers, partners and customers in the ACTIV Network.' },
        { Icon: CalendarDays, title: 'Events & workshops', text: 'Invitations to conclaves, seminars and business programmes.' },
        { Icon: Store, title: 'Business account', text: 'Draft your company page and catalogue before you launch.' },
        { Icon: Award, title: 'Membership certificate', text: 'An official ACTIV certificate with your Member ID.' },
    ],
    business: [
        { Icon: Users, title: 'B2B network', text: 'Find and message members across every region.' },
        { Icon: Store, title: 'Company page & catalogue', text: 'Showcase your company and products to the association.' },
        { Icon: BarChart3, title: 'Reach analytics', text: 'See who views your company and products.' },
        { Icon: CalendarDays, title: 'Members-only events', text: 'Conclaves, trade programmes and business meets.' },
        { Icon: Landmark, title: 'Schemes & tenders', text: 'Updates on schemes and opportunities for SC/ST enterprises.' },
        { Icon: Award, title: 'Certificates', text: 'Membership certificate and your 80G receipt.' },
    ],
};

export default function Payment() {
    const navigate = useNavigate();
    const { isPaid, refresh } = useMembershipGate();
    /* RENEWAL MODE: the server says this member may renew (expired, or the last
       30 days) — same payment, same plan lookup, renewal wording. */
    const renewal = useRenewal();
    const renewing = renewal?.canRenew === true && (renewal.state === 'expired' || renewal.state === 'active');
    const [eligibility, setEligibility] = useState<PlanEligibility | null>(null);
    const [selected, setSelected] = useState<MembershipPlan | null>(null);
    const [loading, setLoading] = useState(true);
    const [paying, setPaying] = useState(false);

    const dashboard = dashboardPathFor(isPaid === true);

    const load = useCallback(async () => {
        try {
            const result = await resolvePlanEligibility();
            setEligibility(result);
            setSelected(result.selected);
        } catch {
            setEligibility(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const plans = eligibility?.plans || [];
    const isCompany = eligibility?.isCompany !== false;
    const isStudent = eligibility?.audience === 'student';
    const kindLabel = isCompany ? 'Business' : isStudent ? 'Student' : 'Aspirant';
    const KindIcon = isCompany ? Briefcase : isStudent ? GraduationCap : Sparkles;
    const locked = eligibility?.locked === true;

    // The plan AS LISTED — the summary and the Pay button must show the same
    // name and price as the card, even if `selected` came back as a thinner object.
    const activePlan = useMemo(
        () => plans.find((p) => p.id === selected?.id) || selected || plans[0] || null,
        [selected, plans],
    );

    const pay = async () => {
        if (!activePlan || paying) return;
        setPaying(true);
        try {
            /*
             * THE SERVER SAYS WHICH CHECKOUT IS LIVE. This button used to call
             * the mock flow unconditionally, so in production — where the
             * server refuses mock authorisation — no member could ever reach
             * Instamojo from here. Gateway: hand off to Instamojo's page; the
             * webhook activates the membership, never this client. A config
             * read that fails throws, rather than guessing mock.
             */
            const config = await getPaymentConfig();
            if (config?.mode === 'gateway') {
                const start = await startHostedMembershipPayment(activePlan.id, eligibility?.applicationId || undefined);
                if (!start?.payment_url) throw new Error('The payment could not be started');
                try { sessionStorage.setItem('activ:lastOrderId', start.orderId || ''); } catch { /* private mode */ }
                // `paying` stays true: the browser is leaving for Instamojo.
                window.location.replace(start.payment_url);
                return;
            }

            // Mock (development servers only). The plan key, not an amount.
            await payForMembership(activePlan.id, {
                ...(eligibility?.applicationId ? { applicationId: eligibility.applicationId } : {}),
                paymentMethod: 'card',
            });
            window.dispatchEvent(new CustomEvent('paymentCompleted'));
            window.dispatchEvent(new Event('profileUpdated'));
            refresh();
            navigate('/member/payment-success', { state: { renewed: renewing } });
        } catch (err) {
            toast.error(errorMessage(err, 'Payment failed. Please try again.'));
            setPaying(false);
        }
    };

    const shell = {
        title: renewing ? 'Renew membership' : 'Complete membership',
        subtitle: renewing ? 'Confirm your plan and renew for another year' : 'Confirm your plan and activate your membership',
        width: 'wide' as const,
        sidebar: false,
        backTo: dashboard,
    };

    if (loading) {
        return (
            <MemberPageShell {...shell}>
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
            </MemberPageShell>
        );
    }

    return (
        <MemberPageShell {...shell}>
            <div className="w-full space-y-5 sm:space-y-6">
                {/* ================================================ hero */}
                <section className={`relative overflow-hidden rounded-3xl ${GRADIENT} px-5 py-7 sm:px-9 sm:py-9 text-white shadow-[0_24px_60px_-24px_rgba(30,58,138,0.7)]`}>
                    <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-sky-300/20 blur-3xl" />
                    <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl" />

                    <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div className="min-w-0">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[0.8125rem] font-semibold uppercase tracking-[0.16em] ring-1 ring-white/25">
                                <KindIcon className="h-3.5 w-3.5" /> {renewing ? 'Membership renewal' : 'Membership plan'}
                            </span>
                            <h2 className="mt-3 font-display text-[1.75rem] sm:text-[2.375rem] font-bold leading-tight">
                                {renewing
                                    ? `Renew your ${kindLabel.toLowerCase()} membership`
                                    : isCompany && plans.length > 1 ? 'Choose your business plan' : `Activate your ${kindLabel.toLowerCase()} membership`}
                            </h2>
                            <p className="mt-1.5 max-w-2xl text-[1rem] sm:text-[1.0625rem] text-blue-100">
                                {renewing
                                    ? renewalMessage(renewal)
                                    : isCompany
                                    ? 'Your plan follows your years in business. One payment a year, every member benefit.'
                                    : isStudent
                                        ? 'For students who are not in business yet — the full ACTIV Network while you study.'
                                        : 'For future entrepreneurs — the full ACTIV Network while you build.'}
                            </p>
                        </div>

                        {/* 3-step progress */}
                        <ol className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 sm:gap-3" aria-label="Your progress">
                            {[
                                { label: renewing ? (renewal?.state === 'expired' ? 'Expired' : 'Member') : 'Approved', state: 'done' },
                                { label: renewing ? 'Renew' : 'Payment', state: 'now' },
                                { label: 'Active', state: 'next' },
                            ].map((s, i, all) => (
                                <li key={s.label} className="flex items-center gap-2 sm:gap-3">
                                    <span className="flex items-center gap-2">
                                        <span className={`grid h-8 w-8 place-items-center rounded-full text-[0.875rem] font-bold ${
                                            s.state === 'done' ? 'bg-emerald-400 text-emerald-950'
                                                : s.state === 'now' ? 'bg-white text-blue-800 ring-4 ring-white/25'
                                                    : 'bg-white/15 text-white/80 ring-1 ring-white/25'}`}>
                                            {s.state === 'done' ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
                                        </span>
                                        <span className={`whitespace-nowrap text-[0.9375rem] font-semibold ${s.state === 'next' ? 'text-blue-200' : 'text-white'}`}>{s.label}</span>
                                    </span>
                                    {i < all.length - 1 ? <span className="hidden h-px w-8 bg-white/30 sm:block" /> : null}
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>

                <div className="grid items-start gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
                    <div className="min-w-0 space-y-5 sm:space-y-6">
                        {/* ============================================ plans */}
                        {plans.length === 0 ? (
                            <div className={`${CARD} p-8 text-center`}>
                                <p className="text-[1.125rem] font-semibold text-slate-900">No plan is available for your account yet.</p>
                                <p className="mt-1 text-[1rem] text-slate-500">
                                    {eligibility?.failed
                                        ? 'The prices could not be loaded. Please try again in a moment.'
                                        : 'Complete your profile and the plan that applies to you appears here.'}
                                </p>
                                {eligibility?.failed ? (
                                    <button type="button" onClick={() => { setLoading(true); load(); }}
                                        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 font-semibold text-white">
                                        Try again
                                    </button>
                                ) : null}
                            </div>
                        ) : (
                            <div className={`grid gap-4 ${plans.length > 1 ? 'md:grid-cols-2' : ''}`}>
                                {plans.map((plan) => {
                                    const active = activePlan?.id === plan.id;
                                    return (
                                        <button
                                            key={plan.id}
                                            type="button"
                                            onClick={() => !locked && setSelected(plan)}
                                            aria-pressed={active}
                                            disabled={locked}
                                            className={`${CARD} group relative min-w-0 overflow-hidden text-left transition-all ${
                                                active ? 'ring-2 ring-blue-600' : 'hover:-translate-y-0.5 hover:ring-blue-300'} ${locked ? 'cursor-default' : ''}`}
                                        >
                                            <span aria-hidden="true" className={`block h-1.5 w-full ${active ? GRADIENT : 'bg-slate-100'}`} />
                                            <div className="p-5 sm:p-7">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex min-w-0 items-center gap-3">
                                                        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${active ? `${GRADIENT} text-white` : 'bg-blue-50 text-blue-700'}`}>
                                                            <KindIcon className="h-6 w-6" />
                                                        </span>
                                                        <div className="min-w-0">
                                                            <p className="break-words font-display text-[1.375rem] font-bold capitalize text-slate-900">{plan.name}</p>
                                                            {plan.experience && String(plan.experience).toLowerCase() !== String(plan.name).toLowerCase()
                                                                ? <p className="text-[0.9375rem] text-slate-500">{plan.experience}</p> : null}
                                                        </div>
                                                    </div>
                                                    {active ? (
                                                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-[0.8125rem] font-bold text-white">
                                                            <BadgeCheck className="h-3.5 w-3.5" /> {locked ? 'Your plan' : 'Selected'}
                                                        </span>
                                                    ) : plan.popular ? (
                                                        <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[0.8125rem] font-bold text-amber-700 ring-1 ring-amber-100">Popular</span>
                                                    ) : null}
                                                </div>

                                                {plan.description ? <p className="mt-3 text-[1rem] text-slate-600">{plan.description}</p> : null}

                                                <p className="mt-4 flex items-baseline gap-1.5">
                                                    <span className="font-display text-[2.25rem] sm:text-[2.5rem] font-bold leading-none tabular-nums text-slate-900">{rupees(plan.price)}</span>
                                                    <span className="text-[1rem] font-medium text-slate-500">/ year</span>
                                                </p>

                                                {plan.features?.length ? (
                                                    <ul className={`mt-5 grid gap-2.5 border-t border-slate-100 pt-5 ${plans.length === 1 ? 'sm:grid-cols-2' : ''}`}>
                                                        {(plans.length === 1 ? plan.features : plan.features.slice(0, 4)).map((f) => (
                                                            <li key={f} className="flex items-start gap-2.5">
                                                                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                                                                    <Check className="h-3 w-3" strokeWidth={3} />
                                                                </span>
                                                                <span className="text-[0.9375rem] leading-snug text-slate-700">{f}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : null}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* ================================ why this membership */}
                        <section className={`${CARD} overflow-hidden`}>
                            <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white px-5 py-4 sm:px-7">
                                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white ${GRADIENT}`}>
                                    <KindIcon className="h-5 w-5" />
                                </span>
                                <div className="min-w-0">
                                    <p className="font-display text-[1.25rem] font-bold text-slate-900">Why join as {isCompany ? 'a Business member' : isStudent ? 'a Student' : 'an Aspirant'}</p>
                                    <p className="text-[0.9375rem] text-slate-500">What your {kindLabel.toLowerCase()} membership opens up</p>
                                </div>
                            </div>
                            <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-7 xl:grid-cols-3">
                                {KIND_BENEFITS[isCompany ? 'business' : isStudent ? 'student' : 'aspirant'].map(({ Icon, title, text }) => (
                                    <div key={title} className="group flex min-w-0 items-start gap-3 rounded-2xl p-3.5 ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:bg-blue-50/50 hover:ring-blue-200">
                                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white">
                                            <Icon className="h-5 w-5" />
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block font-semibold text-slate-900">{title}</span>
                                            <span className="block text-[0.9375rem] text-slate-500">{text}</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* ===================================== after payment */}
                        <section className={`${CARD} p-5 sm:p-7`}>
                            <p className="font-display text-[1.25rem] font-bold text-slate-900">What happens after you pay</p>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                {AFTER_PAYMENT.map(({ Icon, title, text }) => (
                                    <div key={title} className="flex min-w-0 items-start gap-3 rounded-2xl bg-slate-50 p-3.5 ring-1 ring-slate-100">
                                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-blue-700 ring-1 ring-blue-100">
                                            <Icon className="h-5 w-5" />
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block font-semibold text-slate-900">{title}</span>
                                            <span className="block text-[0.9375rem] text-slate-500">{text}</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    {/* ============================================ summary */}
                    <aside className="min-w-0 lg:sticky lg:top-28">
                        <div className={`${CARD} overflow-hidden`}>
                            <div className={`${GRADIENT} px-5 py-4 text-white sm:px-6`}>
                                <p className="text-[0.8125rem] font-semibold uppercase tracking-[0.16em] text-blue-100">Order summary</p>
                                <p className="mt-0.5 font-display text-[1.25rem] font-bold">{activePlan ? activePlan.name : 'No plan selected'}</p>
                            </div>

                            <div className="space-y-3 px-5 py-5 sm:px-6">
                                <Row label="Member type" value={kindLabel} />
                                {activePlan ? <Row label="Plan" value={activePlan.name} /> : null}
                                <Row label="Billing" value="Yearly" />
                                {activePlan ? <Row label="Subtotal" value={rupees(activePlan.price)} /> : null}
                                <Row label="Tax" value="₹0 · included" tone="text-emerald-600" />
                                <div className="flex items-center justify-between gap-3 border-t border-dashed border-slate-200 pt-4">
                                    <span className="font-display text-[1.125rem] font-bold text-slate-900">Total</span>
                                    <span className="font-display text-[2rem] font-bold leading-none tabular-nums text-blue-800">
                                        {activePlan ? rupees(activePlan.price) : '—'}
                                    </span>
                                </div>

                                <button type="button" onClick={pay} disabled={!activePlan || paying}
                                    className={`mt-1 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl ${GRADIENT} px-5 text-[1.0625rem] font-bold text-white
                                                shadow-[0_12px_28px_-12px_rgba(30,58,138,0.7)] transition-transform hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0`}>
                                    {paying ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-4 w-4" />}
                                    {paying ? 'Processing…' : `Pay ${activePlan ? rupees(activePlan.price) : ''} securely`}
                                    {!paying ? <ArrowRight className="h-4 w-4" /> : null}
                                </button>

                                <div className="rounded-2xl bg-slate-50 p-3.5 ring-1 ring-slate-100">
                                    <p className="flex items-center gap-2 font-semibold text-slate-800">
                                        <ShieldCheck className="h-4 w-4 text-emerald-600" /> Secure payment
                                    </p>
                                    <p className="mt-0.5 text-[0.875rem] text-slate-500">Processed over an encrypted connection. We never store your card.</p>
                                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                                        {['SSL encrypted', 'PCI-DSS compliant'].map((t) => (
                                            <span key={t} className="rounded-full bg-white px-2.5 py-1 text-[0.75rem] font-bold uppercase tracking-wider text-slate-600 ring-1 ring-slate-200">{t}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <p className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[0.875rem] text-slate-500">
                            <span className="inline-flex items-center gap-1"><Zap className="h-3.5 w-3.5" /> Instant activation</span>
                            <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> 100% safe &amp; secure</span>
                        </p>
                    </aside>
                </div>

                {/* Phones: the summary card sits below every benefit, so the way to
                    pay stays in reach — a slim bar pinned to the bottom. The spacer
                    keeps the last card clear of it. */}
                {activePlan ? <div className="h-20 lg:hidden" aria-hidden="true" /> : null}
            </div>

            {activePlan ? (
                <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(16,24,40,0.25)] backdrop-blur lg:hidden
                                pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                    <div className="flex items-center gap-3">
                        <div className="min-w-0">
                            <p className="truncate text-[0.8125rem] font-semibold uppercase tracking-wide text-slate-500">{activePlan.name} · yearly</p>
                            <p className="font-display text-[1.375rem] font-bold leading-tight text-slate-900">{rupees(activePlan.price)}</p>
                        </div>
                        <button type="button" onClick={pay} disabled={paying}
                            className={`ml-auto inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl ${GRADIENT} px-5 font-bold text-white disabled:opacity-60`}>
                            {paying ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-4 w-4" />}
                            {paying ? 'Processing…' : 'Pay securely'}
                        </button>
                    </div>
                </div>
            ) : null}
        </MemberPageShell>
    );
}

const Row = ({ label, value, tone = 'text-slate-900' }: { label: string; value: string; tone?: string }) => (
    <div className="flex items-center justify-between gap-3">
        <span className="shrink-0 text-[0.9375rem] text-slate-500">{label}</span>
        <span className={`min-w-0 break-words text-right text-[0.9375rem] font-semibold ${tone}`}>{value}</span>
    </div>
);
