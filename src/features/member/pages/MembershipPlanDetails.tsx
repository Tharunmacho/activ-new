import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    ArrowRight, BadgeCheck, CalendarDays, CreditCard, FileText, IndianRupee,
    MapPin, ReceiptText, RefreshCw, ShieldCheck, Sparkles, UserCircle,
} from 'lucide-react';
import MemberPageShell from '@/pages/member/MemberPageShell';
import { SectionCard, RowsSkeleton } from '@/features/member/components/MemberUI';
import { BIZ_DETAIL_LABEL } from '@/components/layout/surface';
import { getMyProfile, getMyApplication } from '@/services/activApi';
import { resolvePlanEligibility, type MembershipPlan } from '@/features/member/membershipPlans';
import { resolveApplicantKind, resolvePlan, planLabel } from '@/features/member/memberAccess';

import { CARD_TITLE, PAGE_TITLE } from '@/components/layout/appTypography';
/**
 * `/member/plan` — what this membership is, what it cost and when it renews.
 *
 * =========================================================================
 * WHY THIS SCREEN EXISTS
 * =========================================================================
 *
 * The dashboard has said "View plan details" in three places since it was
 * redesigned — on the membership card, on the closing band and on the fourth
 * documents tile — and all three went somewhere else: the profile view and
 * the documents list. A button that names a destination and opens a different
 * one is worse than no button, because the reader concludes the product is
 * broken rather than that they misread it.
 *
 * So this is the destination. It answers the four questions a member has
 * about their plan and nothing else:
 *
 *   WHAT is it            the plan, its term, and whether it is active
 *   WHAT does it INCLUDE  the plan's own feature list, from the server
 *   WHAT was PAID         the amount, the date and the transaction reference
 *   WHEN does it RENEW    the expiry, or the word "lifetime"
 *
 * =========================================================================
 * EVERY FIGURE IS THE SERVER'S
 * =========================================================================
 *
 * The price comes from `resolvePlanEligibility`, which reads
 * `/membership/plans/mine` — the same service the payment path prices an
 * order through. There is deliberately no fallback table: a hardcoded price
 * is a WRONG price the moment the Super Admin edits one, and this screen sits
 * one click from a receipt. When the call fails the price block says so and
 * offers a retry, rather than printing a number nobody set.
 *
 * The card, the headings, the label/value pairs and the type are the Business
 * Account form's, as on the dashboard — see `MemberUI` and `surface.ts`.
 */

const formatDate = (value?: string | null): string => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? ''
        : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

const rupees = (value?: number | null): string =>
    (value === null || value === undefined || Number.isNaN(Number(value)))
        ? '—'
        : `₹${Number(value).toLocaleString('en-IN')}`;

/** A label over its value — `BIZ_DETAIL_LABEL` and its 17px bold partner. */
function Fact({ icon: Icon, label, value }: {
    icon: typeof CalendarDays; label: string; value: string;
}) {
    return (
        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl
                             bg-blue-50 text-blue-600">
                <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
                <span className={`${BIZ_DETAIL_LABEL} block`}>{label}</span>
                <span className="mt-1 block text-[1.125rem] font-bold text-slate-900">{value}</span>
            </span>
        </div>
    );
}

export default function MembershipPlanDetails() {
    const navigate = useNavigate();

    const [profile, setProfile] = useState<any>(null);
    const [application, setApplication] = useState<any>(null);
    const [plan, setPlan] = useState<MembershipPlan | null>(null);
    const [priceFailed, setPriceFailed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let cancelled = false;

        Promise.allSettled([getMyProfile(), getMyApplication(), resolvePlanEligibility()])
            .then(([p, a, e]) => {
                if (cancelled) return;
                if (p.status === 'fulfilled') setProfile(p.value);
                if (a.status === 'fulfilled') setApplication(a.value);
                if (e.status === 'fulfilled') {
                    setPlan(e.value.selected || e.value.plans[0] || null);
                    setPriceFailed(!!e.value.failed);
                } else {
                    setPriceFailed(true);
                }
                setLoading(false);
            });

        return () => { cancelled = true; };
    }, [attempt]);

    const kind = useMemo(
        () => resolvePlan({ declared: resolveApplicantKind(application), hasBusinessRecord: false }),
        [application],
    );

    const membershipType = String(profile?.membershipType || '').trim();
    const lifetime = membershipType.toLowerCase() === 'lifetime';
    const status = String(profile?.membershipStatus || 'active');
    const activeNow = status.toLowerCase() === 'active';

    const memberSince = profile?.membershipActivatedAt || profile?.approvedAt || '';

    /*
     * The same derivation the dashboard and the certificate use: rows written
     * before `membershipExpiresAt` existed carry an activation date and no
     * expiry, and three screens printing three different renewal dates for one
     * membership is the fault this rule exists to prevent.
     */
    const expiresAt = useMemo(() => {
        if (lifetime) return '';
        if (profile?.membershipExpiresAt) return profile.membershipExpiresAt;
        if (membershipType.toLowerCase() === 'annual' && memberSince) {
            const d = new Date(memberSince);
            if (!Number.isNaN(d.getTime())) {
                d.setFullYear(d.getFullYear() + 1);
                return d.toISOString();
            }
        }
        return '';
    }, [lifetime, profile?.membershipExpiresAt, membershipType, memberSince]);

    const paidAmount = profile?.lastPaymentAmount ?? profile?.paymentAmount;
    const paidAt = profile?.lastPaymentDate || memberSince;
    const txnRef = profile?.paymentId || '';

    const region = [profile?.block, profile?.district, profile?.state]
        .map((part: any) => String(part || '').trim()).filter(Boolean).join(' · ');

    if (loading) {
        return (
            <MemberPageShell title="Membership Plan" subtitle="Your plan, in full" width="standard">
                <RowsSkeleton rows={4} />
            </MemberPageShell>
        );
    }

    return (
        <MemberPageShell
            title="Membership Plan"
            subtitle="What your membership is, what it cost and when it renews"
            width="standard"
        >
            <div className="space-y-6">

                {/* ================================================ the plan */}
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white
                                    shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_30px_-12px_rgba(16,24,40,0.28)]">
                    <div className="flex flex-col gap-5 bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white
                                    sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl
                                             bg-white/15 ring-1 ring-white/25">
                                <UserCircle className="h-7 w-7" />
                            </span>
                            <div>
                                <p className="text-[1.0625rem] font-extrabold uppercase tracking-[0.12em] text-white/70">
                                    Your membership
                                </p>
                                <h2 className={`${PAGE_TITLE} mt-1`}>
                                    {plan?.name || planLabel(kind) || 'Membership'}
                                </h2>
                                {membershipType && (
                                    <p className="mt-0.5 text-[1.125rem] font-semibold text-white/80">
                                        {membershipType} term
                                    </p>
                                )}
                            </div>
                        </div>

                        <span className={`inline-flex w-fit items-center gap-2 rounded-full px-4 py-2
                                          text-[1rem] font-extrabold uppercase tracking-[0.08em]
                                          ${activeNow
                                ? 'bg-emerald-400/20 text-emerald-50 ring-1 ring-emerald-200/40'
                                : 'bg-amber-400/20 text-amber-50 ring-1 ring-amber-200/40'}`}>
                            <BadgeCheck className="h-5 w-5" /> {status}
                        </span>
                    </div>

                    <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-4">
                        {profile?.membershipNumber && (
                            <Fact icon={ShieldCheck} label="Member ID" value={profile.membershipNumber} />
                        )}
                        {memberSince && (
                            <Fact icon={CalendarDays} label="Member since" value={formatDate(memberSince)} />
                        )}
                        <Fact
                            icon={RefreshCw}
                            label={lifetime ? 'Renewal' : 'Valid until'}
                            value={lifetime ? 'No renewal needed' : (formatDate(expiresAt) || 'Not recorded')}
                        />
                        {region && <Fact icon={MapPin} label="Region" value={region} />}
                    </div>
                </section>

                {/* ====================================== price · what you paid */}
                <div className="grid items-stretch gap-6 lg:grid-cols-2">

                    <SectionCard
                        title="What this plan costs"
                        subtitle="The association's current rate for your plan"
                        icon={<IndianRupee className="w-5 h-5" />}
                        className="h-full"
                    >
                        {/*
                          NO FALLBACK PRICE. When the rate cannot be read the
                          card says so and offers a retry — a number this screen
                          invented would be wrong the moment the Super Admin
                          edits one, and a receipt sits one click away.
                        */}
                        {priceFailed || !plan ? (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                                <p className="text-[1.125rem] font-bold text-amber-900">
                                    The current rate could not be loaded
                                </p>
                                <p className="mt-1 text-[1.1875rem] font-semibold text-amber-800">
                                    Nothing is shown here rather than a figure that might be out of date.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => { setLoading(true); setAttempt((n) => n + 1); }}
                                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-3
                                               text-[1.125rem] font-bold text-white transition-colors
                                               hover:bg-amber-700"
                                >
                                    <RefreshCw className="h-5 w-5" /> Try again
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                                    <p className={BIZ_DETAIL_LABEL}>Current rate</p>
                                    <p className="mt-1 flex items-baseline gap-2">
                                        <span className="text-[2.25rem] font-extrabold tracking-tight text-slate-900
                                                         tabular-nums">
                                            {rupees(plan.price)}
                                        </span>
                                        {membershipType && (
                                            <span className="text-[1.125rem] font-bold text-slate-500">
                                                per {membershipType.toLowerCase() === 'annual' ? 'year' : 'term'}
                                            </span>
                                        )}
                                    </p>
                                    {plan.description && (
                                        <p className="mt-2 text-[1.1875rem] font-semibold text-slate-500">
                                            {plan.description}
                                        </p>
                                    )}
                                </div>

                                {plan.features.length > 0 && (
                                    <ul className="mt-5 space-y-2.5">
                                        {plan.features.map((feature, i) => (
                                            <li key={i} className="flex items-start gap-3">
                                                <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                                                <span className="text-[1.1875rem] font-semibold text-slate-700">
                                                    {feature}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </>
                        )}
                    </SectionCard>

                    <SectionCard
                        title="What you paid"
                        subtitle="The payment this membership was issued against"
                        icon={<CreditCard className="w-5 h-5" />}
                        className="h-full"
                    >
                        <div className="space-y-4">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                                <p className={BIZ_DETAIL_LABEL}>Amount paid</p>
                                <p className="mt-1 text-[2.25rem] font-extrabold tracking-tight text-slate-900
                                              tabular-nums">
                                    {rupees(paidAmount)}
                                </p>
                                {paidAt && (
                                    <p className="mt-1 text-[1.1875rem] font-semibold text-slate-500">
                                        Paid on {formatDate(paidAt)}
                                    </p>
                                )}
                            </div>

                            {txnRef && (
                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                    <p className={BIZ_DETAIL_LABEL}>Transaction reference</p>
                                    <p className="mt-1 break-all text-[1.125rem] font-bold tracking-wide tabular-nums text-slate-900">
                                        {txnRef}
                                    </p>
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={() => navigate('/member/payment-success?view=receipt')}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl
                                           bg-blue-600 px-5 py-3.5 text-[1.125rem] font-bold text-white
                                           transition-colors hover:bg-blue-700"
                            >
                                <ReceiptText className="h-5 w-5" /> View payment receipt
                            </button>
                        </div>
                    </SectionCard>
                </div>

                {/* ============================================== documents */}
                <SectionCard
                    title="Documents for this plan"
                    subtitle="Issued against your active membership"
                    icon={<FileText className="w-5 h-5" />}
                    actionTo="/member/documents"
                >
                    <div className="grid gap-4 sm:grid-cols-3">
                        {[
                            { label: 'Membership Certificate', to: '/member/certificate/membership', icon: FileText },
                            { label: 'Tax Exemption Certificate', to: '/member/certificate/tax-exemption', icon: ShieldCheck },
                            { label: 'Payment Receipt', to: '/member/payment-success?view=receipt', icon: ReceiptText },
                        ].map(({ label, to, icon: Icon }) => (
                            <Link
                                key={to}
                                to={to}
                                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4
                                           transition-all hover:-translate-y-0.5 hover:border-blue-300
                                           hover:shadow-md"
                            >
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl
                                                 bg-blue-50 text-blue-600">
                                    <Icon className="h-5 w-5" />
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-[1.125rem] font-bold text-slate-900">{label}</span>
                                    <span className="block text-[1.1875rem] font-semibold text-slate-500">
                                        View / download
                                    </span>
                                </span>
                            </Link>
                        ))}
                    </div>
                </SectionCard>

                {/* ================================================ renewal */}
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white
                                    shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_30px_-12px_rgba(16,24,40,0.28)]">
                    <div className="flex flex-col gap-5 bg-gradient-to-r from-blue-50 via-white to-blue-50 p-6
                                    sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl
                                             bg-blue-600 text-white">
                                <Sparkles className="h-6 w-6" />
                            </span>
                            <div>
                                <p className="text-[1.5rem] font-extrabold tracking-tight text-slate-900">
                                    {lifetime ? 'This membership does not expire' : 'Keep your membership active'}
                                </p>
                                <p className="text-[1.1875rem] font-semibold text-slate-500">
                                    {lifetime
                                        ? 'Nothing to renew — your benefits continue for life.'
                                        : expiresAt
                                            ? `Your plan runs to ${formatDate(expiresAt)}.`
                                            : 'Your renewal date is not recorded yet.'}
                                </p>
                            </div>
                        </div>

                        <Link
                            to="/member/help"
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white
                                       px-6 py-3.5 text-[1.125rem] font-bold text-slate-700 transition-colors
                                       hover:border-blue-300 hover:text-blue-700"
                        >
                            Ask about renewal <ArrowRight className="h-5 w-5" />
                        </Link>
                    </div>
                </section>
            </div>
        </MemberPageShell>
    );
}
