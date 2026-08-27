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
import { useNavigate } from 'react-router-dom';
import MemberPageShell from '@/pages/member/MemberPageShell';
import { toast } from 'sonner';
import {
    Loader2, BadgeCheck, Award, ReceiptText, MailCheck, LayoutDashboard, ArrowRight,
} from 'lucide-react';
import { getMyProfile, getCertificate, errorMessage } from '@/services/activApi';
import { getUserApplication } from '@/services/applicationApi';
import { formatApplicationRef } from '@/lib/applicationRef';
import { PALETTE, KitCard } from '@/features/member/memberScreenKit';

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
        // The dashboards and the sidebar gate on membership; tell them it moved.
        window.dispatchEvent(new CustomEvent('paymentCompleted'));
        window.dispatchEvent(new Event('profileUpdated'));
    }, [load]);

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

    const memberName = profile?.fullName || application?.fullName || '—';
    const membershipId = profile?.memberCode || formatApplicationRef(application).short || '—';
    const planType = profile?.membershipType || application?.memberType || 'Membership';
    const paidAt = profile?.lastPaymentDate || profile?.membershipActivatedAt || null;
    const amount = profile?.lastPaymentAmount ?? profile?.paymentAmount;
    const txnRef = profile?.paymentId || '—';

    return (
        <MemberPageShell
            title="Payment Successful"
            subtitle="Your membership is now active"
            width="wide"
            sidebar={false}
            backTo="/payment/member-dashboard"
        >
            <div className="mx-auto w-full max-w-[1400px]">

                {/* ---------------- celebration hero ---------------- */}
                <div className="rounded-3xl bg-white border p-7 text-center shadow-sm mb-5"
                     style={{ borderColor: PALETTE.border }}>
                    <div className="relative h-[120px] flex items-center justify-center">
                        <span aria-hidden className="absolute w-[104px] h-[104px] rounded-full opacity-20 animate-ping"
                              style={{ backgroundColor: '#10B981', animationDuration: '2.4s' }} />
                        <span className="relative w-[92px] h-[92px] rounded-full flex items-center justify-center"
                              style={{ backgroundColor: '#ECFDF5' }}>
                            <BadgeCheck className="w-14 h-14" style={{ color: '#10B981' }} strokeWidth={1.8} />
                        </span>
                    </div>

                    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5
                                     text-[11px] font-extrabold tracking-wide mt-2"
                          style={{ backgroundColor: '#ECFDF5', color: '#059669' }}>
                        <BadgeCheck className="w-3.5 h-3.5" />
                        PAYMENT CONFIRMED
                    </span>

                    <h1 className="font-display text-[26px] lg:text-3xl font-extrabold tracking-tight mt-4"
                        style={{ color: PALETTE.ink }}>
                        Payment Successful!
                    </h1>
                    <p className="text-sm mt-2" style={{ color: PALETTE.muted }}>
                        Welcome to ACTIV! Your membership is officially active.
                    </p>

                    <div className="inline-block rounded-2xl px-6 py-3 mt-5"
                         style={{ backgroundColor: '#F8FAFC' }}>
                        <p className="text-[10px] font-bold uppercase tracking-[0.06em]"
                           style={{ color: PALETTE.muted }}>
                            Total Paid
                        </p>
                        <p className="font-display text-2xl font-extrabold tabular mt-0.5"
                           style={{ color: PALETTE.ink }}>
                            {rupees(amount)}
                        </p>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-3 items-start">

                {/* ---------------- membership receipt ---------------- */}
                <div className="lg:col-span-2">
                <KitCard>
                    <p className="font-display text-[15px] font-bold mb-4" style={{ color: PALETTE.ink }}>
                        Membership Details
                    </p>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                        <Metric label="Membership ID" value={membershipId} />
                        <Metric label="Member Name" value={memberName} />
                        <Metric label="Plan Type" value={String(planType)} />
                        <Metric label="Validity" value={validityFrom(paidAt)} />
                    </div>

                    <div className="rounded-xl mt-5 px-4 py-3" style={{ backgroundColor: '#F8FAFC' }}>
                        <p className="text-[10px] font-bold uppercase tracking-[0.06em]"
                           style={{ color: PALETTE.muted }}>
                            Transaction Reference
                        </p>
                        <p className="text-sm font-mono font-semibold mt-1 break-all"
                           style={{ color: PALETTE.ink }}>
                            {txnRef}
                        </p>
                        {paidAt ? (
                            <p className="text-[11px] mt-1" style={{ color: PALETTE.muted }}>
                                Paid on {formatDate(paidAt)}
                            </p>
                        ) : null}
                    </div>
                </KitCard>

                </div>

                {/* ---------------- member documents ---------------- */}
                <div className="space-y-5 lg:sticky lg:top-6">
                <div>
                    <p className="font-display text-[13px] font-extrabold uppercase tracking-[0.08em] mb-3"
                       style={{ color: PALETTE.muted }}>
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
                        <MailCheck className="w-[18px] h-[18px]" style={{ color: '#0284C7' }} />
                    </span>
                    <div className="min-w-0">
                        <p className="font-display text-sm font-bold" style={{ color: '#075985' }}>
                            Confirmation Sent
                        </p>
                        <p className="text-xs mt-1 leading-relaxed" style={{ color: '#0369A1' }}>
                            Receipt and login details have been sent to your email and WhatsApp.
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => navigate('/payment/member-dashboard')}
                    className="w-full h-12 rounded-xl text-white font-bold text-[15px] flex items-center
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

const Metric = ({ label, value }: { label: string; value: string }) => (
    <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: PALETTE.muted }}>
            {label}
        </p>
        <p className="font-display text-sm font-bold mt-1 break-words" style={{ color: PALETTE.ink }} title={value}>
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
        className="rounded-2xl bg-white border p-4 text-center transition-shadow hover:shadow-md"
        style={{ borderColor: PALETTE.border }}
    >
        <span className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2.5"
              style={{ backgroundColor: soft, color: tone }}>
            <Icon className="w-6 h-6" />
        </span>
        <p className="text-xs font-bold" style={{ color: PALETTE.ink }}>{title}</p>
        <p className="text-[11px] mt-0.5" style={{ color: PALETTE.muted }}>{subtitle}</p>
    </button>
);
