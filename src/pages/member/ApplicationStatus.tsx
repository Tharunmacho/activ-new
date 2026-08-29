/**
 * Application Status — the website's version of the mobile screen.
 *
 * The presentation is a port of `frontend/src/screens/application/
 * ApplicationStatusScreen.tsx`: a gradient status hero whose colour *is* the
 * outcome, a reference strip, and a rail-and-card review timeline. The tones,
 * the copy and the stage rules are the mobile ones, so a member who has seen one
 * recognises the other.
 *
 * What changes for the web is the frame, not the design. Mobile stacks
 * everything in a single column because it has no choice; here the hero and the
 * strip take the full width and the timeline sits beside a details panel, so a
 * desktop screen gets used rather than padded out with empty margin.
 *
 * Stage derivation comes from `timelineStageStatus` in `activApi` — the same
 * function the dashboard tracker calls — so when a Block Admin approves, this
 * screen and the dashboard card move together instead of drifting apart. The
 * previous version derived its own stages from `approvals.*`, which is a second
 * set of rules over the same timestamps and the usual way two screens end up
 * disagreeing about one file.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MemberPageShell from '@/pages/member/MemberPageShell';
import { Button } from '@/components/ui/button';
import {
    Loader2, RefreshCw, CreditCard, Check, Hourglass, X, Clock,
    AlertTriangle, User, Calendar, MapPin, Mail, Phone, FileText, BadgeCheck,
} from 'lucide-react';
import { getUserApplication } from '@/services/applicationApi';
import { deriveApprovalFlags, timelineStageStatus, type TimelineStageStatus } from '@/services/activApi';
import { applicantKindLabel, dashboardPathFor, formatApplicationRef } from '@/features/member/memberAccess';
import useMembershipGate from '@/features/member/useMembershipGate';

/** The mobile screen's palette, one for one. */
const TONE: Record<TimelineStageStatus, {
    text: string; soft: string; dot: string; label: string; Icon: typeof Check;
}> = {
    approved: { text: 'text-[#16A34A]', soft: 'bg-[#DCFCE7]', dot: 'bg-[#16A34A]', label: 'Approved', Icon: Check },
    in_progress: { text: 'text-[#1E50E6]', soft: 'bg-[#E0E7FF]', dot: 'bg-[#1E50E6]', label: 'In Review', Icon: Hourglass },
    rejected: { text: 'text-[#DC2626]', soft: 'bg-[#FEE2E2]', dot: 'bg-[#DC2626]', label: 'Rejected', Icon: X },
    pending: { text: 'text-[#94A3B8]', soft: 'bg-[#F1F5F9]', dot: 'bg-[#94A3B8]', label: 'Waiting', Icon: Clock },
};

/** The four stages, in order. `short` is what the hero rail shows. */
const STAGES = [
    { key: 'block', name: 'Block Admin Review', short: 'Block', at: 'blockApprovedAt' },
    { key: 'district', name: 'District Admin Review', short: 'District', at: 'districtApprovedAt' },
    { key: 'state', name: 'State Admin Review', short: 'State', at: 'stateApprovedAt' },
    { key: 'payment', name: 'Ready for Payment', short: 'Payment', at: 'stateApprovedAt' },
] as const;

const formatDate = (value?: string | null): string => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** The mobile screen's per-stage copy, word for word. */
const stageMessage = (status: TimelineStageStatus, rejectionReason?: string): string => {
    if (status === 'approved') return 'Application approved at this stage.';
    if (status === 'in_progress') return 'Your application is currently being reviewed. Please check back later.';
    if (status === 'rejected') return rejectionReason || 'Application was rejected at this stage.';
    return '';
};

export default function ApplicationStatus() {
    const navigate = useNavigate();
    const { isPaid } = useMembershipGate();
    const [application, setApplication] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');

    const dashboard = dashboardPathFor(isPaid === true);

    const load = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true); else setLoading(true);
        try {
            setApplication(await getUserApplication());
            setError('');
        } catch (err: any) {
            setError(err?.message || 'Failed to load application status. Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const flags = useMemo(() => deriveApprovalFlags(application), [application]);
    const isRejected = flags.isRejected === true;
    const isApproved = application?.status === 'Approved';

    /**
     * The four stages with their state resolved.
     *
     * Payment is not a review tier and has no `timelineStageStatus` of its own:
     * it is approved once the membership is active, in progress while an
     * approved application waits to be paid for, and pending before that.
     */
    const stages = useMemo(() => STAGES.map((stage) => {
        const status: TimelineStageStatus = stage.key === 'payment'
            ? (isPaid ? 'approved' : isApproved ? 'in_progress' : 'pending')
            : (application ? timelineStageStatus(stage.key as 'block' | 'district' | 'state', application) : 'pending');

        return {
            key: stage.key,
            name: stage.name,
            short: stage.short,
            status,
            completed: status === 'approved',
            active: status === 'in_progress',
            reviewer: stage.key === 'payment' ? 'ACTIV System' : '',
            date: formatDate((application as any)?.[stage.at]),
            message: stage.key === 'payment'
                ? (isApproved ? 'Your application is approved. Please proceed with membership payment.' : '')
                : stageMessage(status, application?.rejectionReason),
        };
    }), [application, isApproved, isPaid]);

    const completedCount = stages.filter(s => s.completed).length;
    const progress = Math.round((completedCount / stages.length) * 100);

    // The gradient is the outcome, readable before a word is.
    const heroGradient = isRejected
        ? 'from-[#EF4444] to-[#B91C1C]'
        : isApproved
            ? 'from-[#22C55E] to-[#15803D]'
            : 'from-[#3B6FF5] to-[#1E3FA8]';

    const heroHeadline = isRejected ? 'Application Rejected'
        : isApproved ? 'Application Approved' : 'Under Review';

    const heroCaption = isRejected ? 'See the reviewer note below for details.'
        : isApproved ? 'You can now complete your membership payment.'
            : `${completedCount} of ${stages.length} stages completed`;

    const personal = application?.data?.personalDetails || application?.data?.personal || {};

    // ---------------------------------------------------------------- states

    if (loading) {
        return (
            <MemberPageShell title="Application Status" subtitle="Track your membership approval progress" width="wide" sidebar={false} backTo={dashboard}>
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#3B6FF5] to-[#1E3FA8]
                                    flex items-center justify-center mb-5 shadow-lg shadow-blue-500/30">
                        <Loader2 className="w-8 h-8 animate-spin text-white" />
                    </div>
                    <h2 className="font-display text-lg font-bold text-slate-900">Loading Application</h2>
                    <p className="text-sm text-slate-500 mt-1">Fetching your latest status…</p>
                </div>
            </MemberPageShell>
        );
    }

    if (!application) {
        return (
            <MemberPageShell title="Application Status" subtitle="Track your membership approval progress" width="wide" sidebar={false} backTo={dashboard}>
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-[4.75rem] h-[4.75rem] rounded-full bg-white border border-slate-200
                                    flex items-center justify-center mb-5">
                        {error
                            ? <AlertTriangle className="w-9 h-9 text-[#DC2626]" />
                            : <FileText className="w-9 h-9 text-[#64748B]" />}
                    </div>
                    <h2 className="font-display text-xl font-extrabold text-slate-900">
                        {error ? 'Something Went Wrong' : 'No Application Found'}
                    </h2>
                    <p className="text-sm text-slate-500 mt-2 max-w-sm leading-relaxed">
                        {error || "You haven't submitted an application yet. Complete your profile to get started."}
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-3 mt-7">
                        {error ? (
                            <Button onClick={() => load()} className="bg-[#1E50E6] hover:bg-[#1a45c9] font-semibold">
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Try Again
                            </Button>
                        ) : (
                            <Button onClick={() => navigate('/member/profile')} className="bg-[#1E50E6] hover:bg-[#1a45c9] font-semibold">
                                Complete Your Profile
                            </Button>
                        )}
                        <Button variant="outline" onClick={() => navigate(dashboard)} className="font-semibold">
                            Back to Dashboard
                        </Button>
                    </div>
                </div>
            </MemberPageShell>
        );
    }

    // ---------------------------------------------------------------- screen

    return (
        <MemberPageShell
            title="Application Status"
            subtitle="Track your membership approval progress"
            width="wide"
            /*
              * No rail on this screen.
              *
              * It is a place a member is looking AT one thing, reached from the
              * dashboard card and left again by the same route. A sidebar here
              * offers eight ways out of a screen whose whole job is one file,
              * and it costs 288px that the timeline and the details panel put to
              * better use. `sidebar={false}` also turns the shell's menu button
              * into a back arrow, which is the control this screen actually
              * wants.
              */
            sidebar={false}
            backTo={dashboard}
            actions={
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => load(true)}
                        disabled={refreshing}
                        className="gap-1.5 font-semibold"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">Refresh</span>
                    </Button>
            }
        >
            <div className="mx-auto w-full max-w-[87.5rem] space-y-6">

                {/* ---------------- gradient status hero ---------------- */}
                <div className={`rounded-3xl bg-gradient-to-br ${heroGradient} p-6 lg:p-8
                                 text-white shadow-xl shadow-blue-900/20`}>
                    <div className="flex items-center justify-between gap-4">
                        <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/20
                                         px-3 py-1.5 text-[0.6875rem] font-bold tracking-wide">
                            {isRejected ? <X className="w-3.5 h-3.5" />
                                : isApproved ? <BadgeCheck className="w-3.5 h-3.5" />
                                    : <Hourglass className="w-3.5 h-3.5" />}
                            {application.status || 'Pending'}
                        </span>

                        <span className="font-display text-3xl lg:text-4xl font-extrabold tabular tracking-tight">
                            {progress}%
                        </span>
                    </div>

                    <h2 className="font-display text-2xl lg:text-3xl font-extrabold mt-4 tracking-tight">
                        {heroHeadline}
                    </h2>
                    <p className="text-sm text-white/85 mt-1">{heroCaption}</p>

                    <div className="h-2 rounded-full bg-white/25 mt-6 overflow-hidden">
                        <div
                            className="h-full rounded-full bg-white transition-all duration-700 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>

                    {/* Node rail — one dot per stage, filled as each is cleared. */}
                    <div className="grid grid-cols-4 mt-5">
                        {stages.map((stage) => (
                            <div key={stage.key} className="flex flex-col items-center gap-2">
                                <span className={`w-5 h-5 rounded-full border-[1.5px] flex items-center
                                                  justify-center transition-colors ${
                                    stage.completed
                                        ? 'bg-white border-white'
                                        : stage.active
                                            ? 'bg-white/60 border-white'
                                            : 'bg-white/25 border-white/45'
                                }`}>
                                    {stage.completed ? <Check className="w-3 h-3 text-[#1E3FA8]" strokeWidth={3} /> : null}
                                </span>
                                <span className="text-[0.6875rem] font-semibold text-white/90">{stage.short}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ---------------- reference strip ---------------- */}
                <div className="rounded-2xl bg-white border border-[#E8EEF6] py-4
                                grid grid-cols-2 lg:grid-cols-4 lg:divide-x divide-[#E8EEF6]">
                    <StripCell
                        label="Application ID"
                        value={formatApplicationRef(application).short || '—'}
                        title={formatApplicationRef(application).full}
                    />
                    <StripCell label="Submitted" value={formatDate(application.createdAt) || '—'} className="border-l lg:border-l-0 border-[#E8EEF6]" />
                    <StripCell
                        label="Member Type"
                        value={applicantKindLabel(application) || '—'}
                        className="border-t lg:border-t-0 border-[#E8EEF6] pt-4 lg:pt-0"
                    />
                    <StripCell
                        label="Region"
                        value={[application.block, application.district].filter(Boolean).join(', ') || '—'}
                        className="border-t border-l lg:border-t-0 lg:border-l-0 border-[#E8EEF6] pt-4 lg:pt-0"
                    />
                </div>

                {/* ---------------- reviewer note on a rejection ---------------- */}
                {isRejected && application.rejectionReason ? (
                    <div className="rounded-2xl bg-[#FEF2F2] border border-[#FECACA] p-4 flex gap-3">
                        <span className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0">
                            <AlertTriangle className="w-[1.125rem] h-[1.125rem] text-[#DC2626]" />
                        </span>
                        <div className="min-w-0">
                            <p className="font-display text-sm font-bold text-[#991B1B]">Reviewer Note</p>
                            <p className="text-[0.8125rem] text-[#B91C1C] mt-1 leading-relaxed">
                                {application.rejectionReason}
                            </p>
                        </div>
                    </div>
                ) : null}

                {/* ---------------- timeline + details ---------------- */}
                <div className="grid gap-6 lg:grid-cols-3 items-start">

                    <div className="lg:col-span-2">
                        <p className="font-display text-[0.8125rem] font-extrabold uppercase tracking-[0.08em]
                                      text-[#64748B] mb-4">
                            Review Timeline
                        </p>

                        {stages.map((stage, i) => {
                            const tone = TONE[stage.status];
                            const isLast = i === stages.length - 1;
                            const StageIcon = tone.Icon;
                            return (
                                <div key={stage.key} className="flex">
                                    {/* rail */}
                                    <div className="w-[1.875rem] shrink-0 flex flex-col items-center">
                                        <span className={`relative w-[1.875rem] h-[1.875rem] rounded-full ${tone.dot}
                                                          flex items-center justify-center shrink-0`}>
                                            {stage.active ? (
                                                <span className={`absolute inset-0 rounded-full ${tone.dot}
                                                                  opacity-30 animate-ping`} />
                                            ) : null}
                                            <StageIcon className="w-3.5 h-3.5 text-white relative" strokeWidth={2.5} />
                                        </span>
                                        {!isLast ? (
                                            <span className={`w-0.5 flex-1 my-1 ${
                                                stage.completed ? 'bg-[#16A34A]' : 'bg-slate-200'
                                            }`} />
                                        ) : null}
                                    </div>

                                    {/* card */}
                                    <div className={`flex-1 min-w-0 ml-3 mb-3.5 rounded-2xl bg-white p-4 border
                                                     transition-shadow ${
                                        stage.active
                                            ? 'border-[#1E50E6] shadow-lg shadow-blue-500/10'
                                            : 'border-[#E8EEF6] shadow-sm'
                                    }`}>
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="font-display text-[0.9375rem] font-bold text-[#0F172A] truncate">
                                                {stage.name}
                                            </p>
                                            <span className={`shrink-0 rounded-lg px-2.5 py-1 text-[0.65625rem]
                                                              font-extrabold ${tone.soft} ${tone.text}`}>
                                                {tone.label}
                                            </span>
                                        </div>

                                        {stage.reviewer ? (
                                            <MetaLine icon={<User className="w-3.5 h-3.5" />} text={stage.reviewer} />
                                        ) : null}
                                        {stage.date ? (
                                            <MetaLine icon={<Calendar className="w-3.5 h-3.5" />} text={stage.date} />
                                        ) : null}
                                        {stage.message ? (
                                            <p className="text-[0.8125rem] text-[#475569] mt-2 leading-relaxed">
                                                {stage.message}
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/*
                      * The applicant, beside the timeline rather than under it.
                      *
                      * Mobile stacks this because it has one column; on a desktop
                      * the timeline would otherwise run down the left of an empty
                      * half-screen. Same card treatment, so it still reads as one
                      * screen rather than two.
                      */}
                    <div className="space-y-6 lg:sticky lg:top-6">
                        <div className="rounded-2xl bg-white border border-[#E8EEF6] p-5 shadow-sm">
                            <p className="font-display text-[0.8125rem] font-extrabold uppercase tracking-[0.08em]
                                          text-[#64748B] mb-4">
                                Applicant
                            </p>
                            <div className="space-y-3.5">
                                <DetailLine icon={<User className="w-4 h-4" />} label="Full Name"
                                    value={application.fullName || personal.fullName || '—'} />
                                <DetailLine icon={<Mail className="w-4 h-4" />} label="Email"
                                    value={application.email || personal.email || '—'} />
                                <DetailLine icon={<Phone className="w-4 h-4" />} label="Phone"
                                    value={application.phone || personal.phoneNumber || personal.phone || '—'} />
                                <DetailLine icon={<MapPin className="w-4 h-4" />} label="Location"
                                    value={[application.block, application.district, application.state]
                                        .filter(Boolean).join(', ') || '—'} />
                            </div>
                        </div>

                        {isApproved && !isPaid ? (
                            <Button
                                onClick={() => navigate('/member/payment')}
                                className="w-full bg-[#1E50E6] hover:bg-[#1a45c9] font-bold h-11"
                            >
                                <CreditCard className="w-4 h-4 mr-2" />
                                Proceed to Payment
                            </Button>
                        ) : null}

                        <Button
                            variant="outline"
                            onClick={() => navigate(dashboard)}
                            className="w-full font-semibold h-11"
                        >
                            Back to Dashboard
                        </Button>
                    </div>
                </div>
            </div>
        </MemberPageShell>
    );
}

const StripCell = ({ label, value, className = '', title }: {
    label: string; value: string; className?: string; title?: string;
}) => (
    <div className={`px-4 text-center min-w-0 ${className}`}>
        <p className="text-[0.625rem] font-bold uppercase tracking-[0.06em] text-[#64748B]">{label}</p>
        <p className="font-display text-sm font-bold text-[#0F172A] mt-1 truncate" title={title || value}>
            {value}
        </p>
    </div>
);

const MetaLine = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
    <div className="flex items-center gap-1.5 mt-2 text-[#64748B]">
        <span className="shrink-0">{icon}</span>
        <span className="text-[0.78125rem] truncate">{text}</span>
    </div>
);

const DetailLine = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
    <div className="flex items-start gap-2.5">
        <span className="w-8 h-8 rounded-lg bg-slate-50 text-[#1E50E6] flex items-center
                         justify-center shrink-0">
            {icon}
        </span>
        <div className="min-w-0">
            <p className="text-[0.625rem] font-bold uppercase tracking-[0.06em] text-[#64748B]">{label}</p>
            <p className="text-[0.8125rem] font-medium text-[#0F172A] break-words leading-snug mt-0.5">{value}</p>
        </div>
    </div>
);
