/**
 * Payment Successful — the website's version of the mobile screen.
 *
 * Ported from `frontend/src/screens/payment/PaymentSuccessScreen.tsx`: the
 * celebration hero with its PAYMENT CONFIRMED badge and Total Paid pill, the
 * membership receipt card as a four-cell grid over a transaction reference box,
 * the Member Documents pair, the confirmation note, and the dashboard CTA.
 *
 * Every value is read back from the server rather than passed through the
 * navigation. A receipt assembled from whatever the previous screen happened to
 * hold is a receipt for what the client *thinks* it bought; this one shows what
 * was actually recorded, which is the only version worth printing.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MemberPageShell from '@/pages/member/MemberPageShell';
import { toast } from 'sonner';
import { BIZ_DETAIL_LABEL, BIZ_DETAIL_VALUE } from '@/components/layout/surface';
import { ArrowRight, Award, BadgeCheck, LayoutDashboard, Loader2, MailCheck, Printer, Receipt, ReceiptText } from 'lucide-react';
import { getMyProfile, getCertificate, errorMessage } from '@/services/activApi';
import { getUserApplication } from '@/services/applicationApi';
import { formatApplicationRef } from '@/lib/applicationRef';
import { PALETTE, KitCard } from '@/features/member/memberScreenKit';

import { PAGE_TITLE, CARD_TITLE } from '@/components/layout/appTypography';
const rupees = (n: unknown) => {
    const value = Number(n || 0);
    return value > 0 ? `₹${value.toLocaleString('en-IN')}` : '—';
};

const formatDate = (value?: string | null): string => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** A year on from activation — the validity mobile prints. */
const validityFrom = (value?: string | null): string => {
    if (!value) return '1 Year';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '1 Year';
    d.setFullYear(d.getFullYear() + 1);
    return `Valid till ${formatDate(d.toISOString())}`;
};

export default function PaymentSuccess() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [profile, setProfile] = useState<any>(null);
    const [application, setApplication] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        const [p, a] = await Promise.allSettled([getMyProfile(), getUserApplication()]);
        setProfile(p.status === 'fulfilled' ? p.value : null);
        setApplication(a.status === 'fulfilled' ? a.value : null);
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
        /*
         * ONLY WHEN A PAYMENT ACTUALLY JUST HAPPENED.
         *
         * The dashboards and the sidebar gate on membership, so arriving here
         * from the gateway has to tell them it moved. Opening the same screen
         * as a RECEIPT is not that event — announcing a completed payment
         * every time somebody looks up what they paid would have the whole
         * member area refetch itself, and any listener that reacts to it
         * (a toast, a redirect) fire on a page view.
         */
        if (searchParams.get('view') === 'receipt') return;
        window.dispatchEvent(new CustomEvent('paymentCompleted'));
        window.dispatchEvent(new Event('profileUpdated'));
    }, [load, searchParams]);

    /**
     * Open a certificate.
     *
     * `getCertificate` throws on a 403 rather than resolving empty, and that
     * refusal is the answer the member needs — a membership that is not active
     * yet cannot produce a certificate, and showing a blank one instead of the
     * reason helps nobody.
     */
    const openCertificate = async (kind: 'membership' | 'tax-exemption') => {
        try {
            const cert = await getCertificate(kind);
            const url = (cert as any)?.url || (cert as any)?.downloadUrl || '';
            if (url) window.open(url, '_blank', 'noopener,noreferrer');
            else toast.info('Your certificate is being prepared and will be emailed to you.');
        } catch (err) {
            toast.error(errorMessage(err, 'That certificate is not available yet.'));
        }
    };

    if (loading) {
        return (
            <MemberPageShell title="Payment Successful" width="wide" sidebar={false} backTo="/payment/member-dashboard">
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: PALETTE.primary }} />
                </div>
            </MemberPageShell>
        );
    }

    /*
     * THE SAME SCREEN, TWO OCCASIONS.
     *
     * Arriving here straight from the gateway, this is the moment a payment
     * went through and the celebration is the point. Opened months later from
     * Official Documents, the same figures are a RECEIPT — and a page that
     * shouts "Payment Successful! Welcome to ACTIV!" at somebody looking for
     * a number to give their accountant is the wrong register entirely.
     *
     * `?view=receipt` is the difference: the tick, the confetti ring and the
     * welcome come off, the heading says what the page is, and the payment
     * details — which were always the substance of it — are all that is left.
     */
    const isReceipt = searchParams.get('view') === 'receipt';

    const memberName = profile?.fullName || application?.fullName || '—';
    const membershipId = profile?.memberCode || formatApplicationRef(application).short || '—';
    const planType = profile?.membershipType || application?.memberType || 'Membership';
    const paidAt = profile?.lastPaymentDate || profile?.membershipActivatedAt || null;
    const amount = profile?.lastPaymentAmount ?? profile?.paymentAmount;
    const txnRef = profile?.paymentId || '—';

    return (
        <MemberPageShell
            title={isReceipt ? 'Payment Receipt' : 'Payment Successful'}
            subtitle={isReceipt
                ? 'Your membership fee, as recorded'
                : 'Your membership is now active'}
            width="wide"
            sidebar={!isReceipt}
            /* Back goes where the reader came FROM. The receipt is reached
               from Documents, from the plan screen and from the dashboard, and
               a fixed `backTo` sent all three to Documents — which is why
               leaving the receipt landed somewhere the reader had never been.
               `backTo` takes a path, so the history step is done here and the
               path is only the fallback for a direct visit. */
            backTo="/member/documents"
            onBack={() => (window.history.length > 1 ? navigate(-1) : navigate('/member/documents'))}
        >
            <div className="w-full">

                {/* ---------------- celebration hero ---------------- */}
                {!isReceipt && (
                <div className="rounded-2xl bg-white border p-7 text-center mb-5
                                shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)]"
                     style={{ borderColor: PALETTE.border }}>
                    <div className="relative h-[7.5rem] flex items-center justify-center">
                        <span aria-hidden className="absolute w-[6.5rem] h-[6.5rem] rounded-full opacity-20 animate-ping"
                              style={{ backgroundColor: '#10B981', animationDuration: '2.4s' }} />
                        <span className="relative w-[5.75rem] h-[5.75rem] rounded-full flex items-center justify-center"
                              style={{ backgroundColor: '#ECFDF5' }}>
                            <BadgeCheck className="w-14 h-14" style={{ color: '#10B981' }} strokeWidth={1.8} />
                        </span>
                    </div>

                    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5
                                     text-[0.8125rem] font-extrabold tracking-wide mt-2"
                          style={{ backgroundColor: '#ECFDF5', color: '#059669' }}>
                        <BadgeCheck className="w-3.5 h-3.5" />
                        PAYMENT CONFIRMED
                    </span>

                    <h1 className={`font-display ${PAGE_TITLE} mt-4`}
                        style={{ color: PALETTE.ink }}>
                        Payment Successful!
                    </h1>
                    <p className="text-[1.1875rem] mt-2" style={{ color: PALETTE.muted }}>
                        Welcome to ACTIV! Your membership is officially active.
                    </p>

                    <div className="inline-block rounded-2xl px-6 py-3 mt-5"
                         style={{ backgroundColor: '#F8FAFC' }}>
                        <p className="text-[0.75rem] font-bold uppercase tracking-[0.06em]"
                           style={{ color: PALETTE.muted }}>
                            Total Paid
                        </p>
                        <p className="font-display text-[1.75rem] font-extrabold tabular mt-0.5"
                           style={{ color: PALETTE.ink }}>
                            {rupees(amount)}
                        </p>
                    </div>
                </div>
                )}

                <div className="grid items-start gap-6 lg:grid-cols-3">

                {/* ---------------- membership receipt ----------------
                    A RECEIPT READS TOP TO BOTTOM: what was paid, then what
                    for, then to whom, then the reference that proves it. It
                    was a 2×2 grid of unrelated facts with the amount missing
                    from it entirely — the one number a receipt exists to
                    state was on the celebration panel above, which the
                    receipt view does not draw. */}
                <div className="lg:col-span-2">
                <KitCard>
                    <div className="mb-5 flex items-center gap-2">
                        <Receipt className="h-5 w-5 shrink-0 text-blue-600" />
                        <h2 className={`${CARD_TITLE} text-slate-900`}>
                            Membership payment
                        </h2>
                    </div>

                    {/* ---- the amount, at the top, in the size it deserves ---- */}
                    <div className="rounded-2xl border border-blue-100 bg-blue-50/60 px-5 py-5">
                        <p className={BIZ_DETAIL_LABEL}>Amount paid</p>
                        <p className="mt-1 flex flex-wrap items-baseline gap-x-3">
                            <span className="font-display text-[2.8125rem] font-extrabold leading-none tabular
                                             tracking-tight text-slate-900">
                                {rupees(amount)}
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1
                                             text-[1.0625rem] font-extrabold text-emerald-700">
                                <BadgeCheck className="h-4 w-4" /> Paid
                            </span>
                        </p>
                        {paidAt ? (
                            <p className="mt-2 text-[1.1875rem] font-semibold text-slate-500">
                                Received on {formatDate(paidAt)}
                            </p>
                        ) : null}
                    </div>

                    {/* ---- what it was for ---- */}
                    <div className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2">
                        <Metric label="Paid for" value={`${String(planType)} membership`} />
                        <Metric label="Valid until" value={validityFrom(paidAt)} />
                        <Metric label="Member name" value={memberName} />
                        <Metric label="Membership ID" value={membershipId} />
                    </div>

                    {/* ---- and the reference that proves it ---- */}
                    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                        <p className={BIZ_DETAIL_LABEL}>Transaction reference</p>
                        <p className="mt-1.5 break-all text-[1.125rem] font-bold tracking-wide tabular-nums text-slate-900">
                            {txnRef}
                        </p>
                    </div>

                    {/* ---- the two things a member does with a receipt ---- */}
                    <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-200 pt-5">
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5
                                       text-[1.125rem] font-bold text-white transition-colors hover:bg-blue-700"
                        >
                            <Printer className="h-5 w-5" /> Print or save as PDF
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/member/plan')}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white
                                       px-6 py-3.5 text-[1.125rem] font-bold text-slate-700 transition-colors
                                       hover:border-blue-300 hover:text-blue-700"
                        >
                            View plan details
                        </button>
                    </div>
                </KitCard>

                </div>

                {/* ---------------- member documents ---------------- */}
                <div className="space-y-5 lg:sticky lg:top-6">
                <div>
                    <p className={`${BIZ_DETAIL_LABEL} mb-3`}>
                        Member Documents
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        <DocCard
                            Icon={Award}
                            tone="#4F46E5"
                            soft="#EEF2FF"
                            title="Membership Certificate"
                            subtitle="Digital PDF"
                            onClick={() => openCertificate('membership')}
                        />
                        <DocCard
                            Icon={ReceiptText}
                            tone="#059669"
                            soft="#ECFDF5"
                            title="Tax Exemption"
                            subtitle="80G Certificate"
                            onClick={() => openCertificate('tax-exemption')}
                        />
                    </div>
                </div>

                {/* ---------------- confirmation note ---------------- */}
                <div className="rounded-2xl border p-4 flex gap-3"
                     style={{ backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' }}>
                    <span className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0">
                        <MailCheck className="w-[1.125rem] h-[1.125rem]" style={{ color: '#0284C7' }} />
                    </span>
                    <div className="min-w-0">
                        <p className="font-display text-[1.1875rem] font-bold" style={{ color: '#075985' }}>
                            Confirmation Sent
                        </p>
                        <p className="text-[1.0625rem] mt-1 leading-relaxed" style={{ color: '#0369A1' }}>
                            Receipt and login details have been sent to your email and WhatsApp.
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => navigate('/payment/member-dashboard')}
                    className="w-full h-12 rounded-xl text-white font-bold text-[1.125rem] flex items-center
                               justify-center gap-2 transition-opacity hover:opacity-90"
                    style={{ backgroundColor: PALETTE.primary }}
                >
                    <LayoutDashboard className="w-4 h-4" />
                    Go to Member Dashboard
                    <ArrowRight className="w-4 h-4" />
                </button>
                </div>

                </div>
            </div>
        </MemberPageShell>
    );
}

/**
 * A label over its value — `BIZ_DETAIL_LABEL` and `BIZ_DETAIL_VALUE` from
 * `surface.ts`, which are the business account screens' pair.
 *
 * The label stays small and uppercase and the VALUE carries the weight: a
 * caption over "Tharun .v" is a key beside its value, and at the same size
 * and weight as the thing it names the eye has no way to tell which is which.
 */
const Metric = ({ label, value }: { label: string; value: string }) => (
    <div className="min-w-0">
        <p className={BIZ_DETAIL_LABEL}>{label}</p>
        <p className={`${BIZ_DETAIL_VALUE} mt-1.5 break-words text-[1.125rem]`} title={value}>
            {value}
        </p>
    </div>
);

const DocCard = ({ Icon, tone, soft, title, subtitle, onClick }: {
    Icon: typeof Award; tone: string; soft: string;
    title: string; subtitle: string; onClick: () => void;
}) => (
    <button
        type="button"
        onClick={onClick}
        /* `BusinessUI.Card`'s border and two-stop shadow, so a document tile
           is the same object as every other card in the product. */
        className="rounded-2xl border border-slate-200 bg-white p-5 text-center
                   shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_30px_-12px_rgba(16,24,40,0.28)]
                   transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
    >
        <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl"
              style={{ backgroundColor: soft, color: tone }}>
            <Icon className="h-7 w-7" />
        </span>
        <p className="text-[1.125rem] font-bold text-slate-900">{title}</p>
        <p className="mt-1 text-[1.1875rem] font-semibold text-slate-500">{subtitle}</p>
    </button>
);
