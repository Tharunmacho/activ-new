/**
 * Complete Membership — the website's version of the mobile screen.
 *
 * Ported from `frontend/src/screens/payment/CompleteMembershipScreen.tsx`: the
 * MEMBERSHIP PLAN badge and title that changes with who is buying, the plan
 * cards, the Secure Payment card with its SSL / PCI-DSS pills, "What's Next
 * After Payment?", the payment summary, and the pay button carrying the amount.
 *
 * The plans come from `membershipPlans.ts`, which is itself a transcription of
 * the mobile screen. This page used to carry its own inline pair —
 * `annual: ₹500` and `lifetime: ₹2500` — prices that exist nowhere else on the
 * platform: not on mobile, not in the plan table, not in the server's pricing.
 * An aspirant was shown company plans, and everybody was shown two amounts that
 * were never going to be charged.
 *
 * The amount is still never sent. `payForMembership` takes the plan key and the
 * server prices it from its own table, so what this screen displays cannot
 * change what is charged — that was already true and stays true.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MemberPageShell from '@/pages/member/MemberPageShell';
import { toast } from 'sonner';
import {
    Loader2, Lock, Star, Zap, FileText, Mail, LayoutDashboard, ShieldCheck, Check,
} from 'lucide-react';
import {
    resolvePlanEligibility, type MembershipPlan, type PlanEligibility,
} from '@/features/member/membershipPlans';
import { payForMembership } from '@/services/paymentApi';
import { errorMessage } from '@/services/activApi';
import { dashboardPathFor } from '@/features/member/memberAccess';
import useMembershipGate from '@/features/member/useMembershipGate';
import { PALETTE, KitCard, PrimaryAction } from '@/features/member/memberScreenKit';

/** Mobile's four post-payment promises, with its colours. */
const AFTER_PAYMENT = [
    { Icon: Zap, text: 'Instant activation', color: '#F59E0B' },
    { Icon: FileText, text: 'Digital certificate', color: '#8B5CF6' },
    { Icon: Mail, text: 'Email & WhatsApp confirmation', color: '#0EA5E9' },
    { Icon: LayoutDashboard, text: 'Full Member Dashboard access', color: '#10B981' },
];

const rupees = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function Payment() {
    const navigate = useNavigate();
    const { isPaid, refresh } = useMembershipGate();
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
            // `resolvePlanEligibility` already falls back to the company plans;
            // this is the last resort, and leaving the screen empty is better
            // than inventing a price.
            setEligibility(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const plans = eligibility?.plans || [];
    const isCompany = eligibility?.isCompany !== false;

    const activePlan = useMemo(
        () => selected || plans[0] || null,
        [selected, plans],
    );

    const pay = async () => {
        if (!activePlan || paying) return;
        setPaying(true);
        try {
            /*
             * The plan key, not an amount.
             *
             * `payForMembership` opens an order, has it authorised and completes
             * it server-side; the server prices the plan from its own table and
             * verifies the signature. Nothing this screen displays can change
             * what is charged or what is recorded.
             */
            await payForMembership(activePlan.id, {
                ...(eligibility?.applicationId ? { applicationId: eligibility.applicationId } : {}),
                paymentMethod: 'card',
            });

            // So the dashboards re-read the membership without a page reload.
            window.dispatchEvent(new CustomEvent('paymentCompleted'));
            window.dispatchEvent(new Event('profileUpdated'));
            refresh();

            navigate('/member/payment-success');
        } catch (err) {
            toast.error(errorMessage(err, 'Payment failed. Please try again.'));
            setPaying(false);
        }
    };

    if (loading) {
        return (
            <MemberPageShell title="Complete Membership" width="wide" sidebar={false} backTo={dashboard}>
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: PALETTE.primary }} />
                </div>
            </MemberPageShell>
        );
    }

    return (
        <MemberPageShell
            title="Complete Membership"
            subtitle="Choose your plan and activate your membership"
            width="wide"
            sidebar={false}
            backTo={dashboard}
        >
            <div className="mx-auto w-full max-w-[1400px] space-y-6">

                {/* ---------------- title header ---------------- */}
                <div className="text-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5
                                     text-[11px] font-extrabold tracking-wide mb-3"
                          style={{ backgroundColor: '#F3E8FF', color: '#8B5CF6' }}>
                        <Star className="w-3.5 h-3.5" />
                        MEMBERSHIP PLAN
                    </span>
                    <h1 className="font-display text-[26px] lg:text-3xl font-extrabold tracking-tight"
                        style={{ color: PALETTE.ink }}>
                        {isCompany ? 'Select Business Plan' : 'Aspirant Membership Plan'}
                    </h1>
                    <p className="text-sm mt-2" style={{ color: PALETTE.muted }}>
                        {isCompany
                            ? 'Choose a plan that fits your business experience'
                            : 'Empowering students and future entrepreneurs'}
                    </p>
                </div>

                {/*
                  * Two columns from `lg`, like the Application Status screen.
                  *
                  * What is being bought reads down the left; what it costs and
                  * the button that commits to it stay in view on the right. In
                  * one narrow column the total sat below the fold under three
                  * cards, so the member had to scroll away from the plans to see
                  * the price of the one they had picked.
                  */}
                <div className="grid gap-6 lg:grid-cols-3 items-start">

                <div className="lg:col-span-2 space-y-6">

                {/* ---------------- plan cards ---------------- */}
                {plans.length === 0 ? (
                    <KitCard className="text-center py-10">
                        <p className="text-sm font-semibold" style={{ color: PALETTE.ink }}>
                            No plan is available for your account yet.
                        </p>
                        <p className="text-xs mt-1" style={{ color: PALETTE.muted }}>
                            Complete your profile and we will show the plan that applies to you.
                        </p>
                    </KitCard>
                ) : (
                    /*
                     * The column count follows the number of plans.
                     *
                     * A locked aspirant has exactly one, and a fixed
                     * three-column grid pinned that single card to the left
                     * third of the page while every card below it ran the full
                     * width — the one thing being bought was also the one thing
                     * that did not line up with anything.
                     */
                    <div className={`grid gap-4 ${
                        plans.length === 1 ? 'grid-cols-1'
                            : plans.length === 2 ? 'sm:grid-cols-2'
                                : 'sm:grid-cols-2 xl:grid-cols-3'
                    }`}>
                        {plans.map((plan) => {
                            const active = activePlan?.id === plan.id;
                            /*
                             * An aspirant's plan follows from what they declared,
                             * so there is nothing to choose — mobile locks it and
                             * so does this. It is still rendered as a card, not a
                             * line of text, because it is the thing being bought.
                             */
                            const locked = eligibility?.locked === true;
                            return (
                                <button
                                    key={plan.id}
                                    type="button"
                                    onClick={() => !locked && setSelected(plan)}
                                    aria-pressed={active}
                                    disabled={locked}
                                    className={`text-left rounded-2xl border-2 p-5 transition-all bg-white
                                                ${locked ? 'cursor-default' : 'hover:shadow-md'}
                                                ${active ? 'shadow-lg' : 'shadow-sm'}`}
                                    style={{ borderColor: active ? PALETTE.primary : PALETTE.border }}
                                >
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <p className="font-display text-base font-extrabold"
                                           style={{ color: PALETTE.ink }}>
                                            {plan.name}
                                        </p>
                                        {plan.popular ? (
                                            <span className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-extrabold"
                                                  style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}>
                                                POPULAR
                                            </span>
                                        ) : null}
                                    </div>

                                    <p className="text-xs mb-3" style={{ color: PALETTE.muted }}>
                                        {plan.description}
                                    </p>

                                    <p className="mb-3">
                                        <span className="font-display text-2xl font-extrabold tabular"
                                              style={{ color: active ? PALETTE.primary : PALETTE.ink }}>
                                            {rupees(plan.price)}
                                        </span>
                                        <span className="text-xs ml-1" style={{ color: PALETTE.muted }}>/ year</span>
                                    </p>

                                    <ul className="space-y-1.5">
                                        {(plans.length === 1 ? plan.features : plan.features.slice(0, 3)).map((f) => (
                                            <li key={f} className="flex items-start gap-1.5">
                                                <Check className="w-3.5 h-3.5 shrink-0 mt-0.5"
                                                       style={{ color: PALETTE.success }} />
                                                <span className="text-[11px] leading-snug"
                                                      style={{ color: PALETTE.muted }}>{f}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* ---------------- secure payment ---------------- */}
                <div className="rounded-2xl p-5 text-white"
                     style={{ background: `linear-gradient(135deg, ${PALETTE.primary} 0%, #1E3FA8 100%)` }}>
                    <div className="flex items-start gap-3">
                        <span className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                            <Lock className="w-5 h-5" />
                        </span>
                        <div className="min-w-0">
                            <p className="font-display text-[15px] font-bold">Secure Payment</p>
                            <p className="text-xs text-white/80 mt-0.5 leading-relaxed">
                                Your payment is processed over an encrypted connection.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4">
                        {['SSL Encrypted', 'PCI-DSS Compliant'].map(tag => (
                            <span key={tag} className="rounded-lg bg-white/20 px-2.5 py-1 text-[11px] font-bold">
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>

                {/* ---------------- what's next ---------------- */}
                <KitCard>
                    <p className="font-display text-[15px] font-bold mb-4" style={{ color: PALETTE.ink }}>
                        What&apos;s Next After Payment?
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        {AFTER_PAYMENT.map(({ Icon, text, color }) => (
                            <div key={text} className="flex items-start gap-2.5">
                                <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                      style={{ backgroundColor: `${color}15`, color }}>
                                    <Icon className="w-[18px] h-[18px]" />
                                </span>
                                <span className="text-xs font-medium leading-snug pt-2"
                                      style={{ color: PALETTE.ink }}>{text}</span>
                            </div>
                        ))}
                    </div>
                </KitCard>

                </div>

                {/* ---------------- payment summary + action ---------------- */}
                <div className="space-y-5 lg:sticky lg:top-6">
                {activePlan ? (
                    <KitCard>
                        <p className="font-display text-[15px] font-bold mb-4" style={{ color: PALETTE.ink }}>
                            Payment Summary
                        </p>
                        <div className="space-y-2.5">
                            <SummaryRow label="Member Type" value={isCompany ? 'Company' : 'Aspirant'} />
                            <SummaryRow label="Experience" value={activePlan.experience} />
                            <SummaryRow label="Selected Plan" value={activePlan.name} />
                            <SummaryRow label="Subtotal" value={rupees(activePlan.price)} />
                            <SummaryRow label="Tax" value="₹0 (Included)" valueColor="#10B981" />
                            <div className="border-t pt-3 mt-3 flex items-center justify-between"
                                 style={{ borderColor: PALETTE.border }}>
                                <span className="font-display text-sm font-extrabold"
                                      style={{ color: PALETTE.ink }}>Total</span>
                                <span className="font-display text-xl font-extrabold tabular"
                                      style={{ color: PALETTE.primary }}>
                                    {rupees(activePlan.price)}
                                </span>
                            </div>
                        </div>
                    </KitCard>
                ) : null}

                {/* ---------------- action ---------------- */}
                <PrimaryAction onClick={pay} disabled={!activePlan || paying}>
                    {paying
                        ? 'Processing…'
                        : `Proceed to Payment${activePlan ? ` (${rupees(activePlan.price)})` : ''}`}
                </PrimaryAction>

                <div className="flex items-center justify-center gap-5">
                    {['100% Safe & Secure', 'Instant Activation'].map(t => (
                        <span key={t} className="flex items-center gap-1.5 text-[11px]"
                              style={{ color: PALETTE.muted }}>
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {t}
                        </span>
                    ))}
                </div>
                </div>

                </div>
            </div>
        </MemberPageShell>
    );
}

const SummaryRow = ({ label, value, valueColor }: {
    label: string; value: string; valueColor?: string;
}) => (
    <div className="flex items-center justify-between gap-3">
        <span className="text-xs" style={{ color: PALETTE.muted }}>{label}</span>
        <span className="text-xs font-bold text-right" style={{ color: valueColor || PALETTE.ink }}>
            {value}
        </span>
    </div>
);
