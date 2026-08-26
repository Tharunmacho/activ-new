import { useCallback, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Check, X, MapPin, Phone, TrendingUp, Inbox } from 'lucide-react';
import type { Applicant } from '@/services/activApi';

/**
 * The shared approval queue — the web counterpart of the mobile app's
 * `ApprovalQueue`, with the same rules.
 *
 * Five of those rules were missing from the website and each is load-bearing:
 *
 * 1. The buckets come from the SERVER, untouched. `classifyForLevel` decides
 *    what each tier sees, including the two stages a tier can view but not act
 *    on — `upstream` (still with an earlier tier) and `closed` (rejected by a
 *    different tier). Re-deriving them here from a stages array loses both.
 * 2. Only a `pending` file is actionable. Offering Approve on an upstream file
 *    produces a 400 from the geofence, after the admin has already clicked.
 * 3. A rejection carries a reason the admin types. The website sent a constant
 *    string, so every rejection reached the applicant with the same words.
 * 4. An escalated file explains itself. Deciding on another tier's application
 *    with no explanation is how an admin stops trusting the queue.
 * 5. One card at a time is busy, so a double-click cannot submit twice — and
 *    the second submit would hit a terminal state and fail.
 */

export type BucketKey = 'pending' | 'approved' | 'rejected' | 'all';
export type AdminLevel = 'block' | 'district' | 'state' | 'super';

export interface ApplicantBuckets {
    pending: Applicant[];
    approved: Applicant[];
    rejected: Applicant[];
    all: Applicant[];
}

interface Props {
    buckets: ApplicantBuckets;
    level: AdminLevel;
    /** Resolves once the decision is persisted; the parent then refetches. */
    onReview: (applicant: Applicant, action: 'approve' | 'reject', reason?: string) => Promise<void>;
    onPressApplicant?: (applicant: Applicant) => void;
    activeFilter?: BucketKey;
    onFilterChange?: (filter: BucketKey) => void;
}

const FILTER_TABS: { key: BucketKey; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all', label: 'All' },
];

/**
 * Why a queue is empty is more useful than the fact that it is. A District
 * Admin seeing nothing should know files only arrive after Block approval,
 * rather than assuming the page is broken.
 */
const LEVEL_COPY: Record<AdminLevel, { title: string; waitingOn: string }> = {
    block: {
        title: 'Block Approvals',
        waitingOn: 'New member applications land here first.',
    },
    district: {
        title: 'District Approvals',
        waitingOn: 'Applications appear here only after the Block Admin approves them.',
    },
    state: {
        title: 'State Approvals',
        waitingOn: 'Applications appear here only after the District Admin approves them.',
    },
    super: {
        title: 'All Approvals',
        waitingOn: 'Every application across the platform appears here.',
    },
};

const STAGE_COLORS: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
    approved: 'bg-green-100 text-green-700 hover:bg-green-100',
    rejected: 'bg-red-100 text-red-700 hover:bg-red-100',
    upstream: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-100',
    closed: 'bg-slate-100 text-slate-600 hover:bg-slate-100',
};

const TAB_ACTIVE: Record<BucketKey, string> = {
    pending: 'bg-blue-600 text-white border-blue-600',
    approved: 'bg-green-600 text-white border-green-600',
    rejected: 'bg-red-600 text-white border-red-600',
    all: 'bg-blue-600 text-white border-blue-600',
};

const getInitials = (fullName?: string | null): string => {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

export default function ApprovalQueue({
    buckets,
    level,
    onReview,
    onPressApplicant,
    activeFilter: controlledFilter,
    onFilterChange,
}: Props) {
    const [internalFilter, setInternalFilter] = useState<BucketKey>('pending');
    const activeFilter = controlledFilter ?? internalFilter;

    const setActiveFilter = (f: BucketKey) => {
        setInternalFilter(f);
        onFilterChange?.(f);
    };

    const [busyId, setBusyId] = useState<string | null>(null);
    const [busyAction, setBusyAction] = useState<'approve' | 'reject' | null>(null);
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    const safeBuckets = useMemo<ApplicantBuckets>(
        () => ({
            pending: buckets?.pending || [],
            approved: buckets?.approved || [],
            rejected: buckets?.rejected || [],
            all: buckets?.all || [],
        }),
        [buckets],
    );

    const visible = safeBuckets[activeFilter] || [];
    const copy = LEVEL_COPY[level] || LEVEL_COPY.block;

    const submit = useCallback(
        async (applicant: Applicant, action: 'approve' | 'reject', reason?: string) => {
            setBusyId(applicant?.id || '');
            setBusyAction(action);
            try {
                await onReview(applicant, action, reason);
                setRejectingId(null);
                setRejectReason('');
            } finally {
                setBusyId(null);
                setBusyAction(null);
            }
        },
        [onReview],
    );

    const renderCard = (applicant: Applicant) => {
        const stage = applicant?.stage || 'pending';
        const isBusy = busyId === (applicant?.id || '');
        // Only the tier that owes the decision may act. `upstream` and `closed`
        // are visible but not actionable — the server would refuse them.
        const canAct = stage === 'pending';
        const isRejecting = rejectingId === (applicant?.id || '');

        const location = [applicant?.block, applicant?.district].filter(Boolean).join(', ');

        const isAspirant =
            applicant?.doingBusiness === false ||
            (applicant as any)?.businessInfo?.doingBusiness === false ||
            String((applicant as any)?.registrationType || (applicant as any)?.memberType || applicant?.role || '')
                .toLowerCase()
                .includes('aspirant');

        const displayRole = isAspirant
            ? 'Aspirant'
            : applicant?.doingBusiness === true || (applicant as any)?.businessInfo?.organizationName
              ? 'Business Member'
              : applicant?.role && applicant.role.toLowerCase() !== 'member'
                ? applicant.role
                : 'Business Member';

        return (
            <Card
                key={applicant?.id || applicant?.applicationId}
                className={`mb-3 ${onPressApplicant ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
                onClick={() => onPressApplicant?.(applicant)}
            >
                <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">
                            {getInitials(applicant?.fullName)}
                        </div>

                        <div className="flex-1 min-w-0">
                            {/* Never a placeholder name: an admin deciding on a
                                membership must not be shown invented details. */}
                            <p className="font-semibold text-gray-900 truncate">
                                {applicant?.fullName || 'Name not provided'}
                            </p>
                            {!!applicant?.email && (
                                <p className="text-sm text-gray-500 truncate">{applicant.email}</p>
                            )}
                        </div>

                        <Badge className={STAGE_COLORS[stage] || STAGE_COLORS.pending}>
                            {applicant?.statusLabel || 'Pending'}
                        </Badge>
                    </div>

                    <div className="mt-3 space-y-1 text-sm">
                        <div className="flex items-center gap-1">
                            <span className="text-gray-500">Role:</span>
                            <span className={isAspirant ? 'text-emerald-600 font-semibold' : 'text-blue-600 font-semibold'}>
                                {displayRole}
                            </span>
                        </div>
                        {!!location && (
                            <div className="flex items-center gap-1 text-gray-600">
                                <MapPin className="w-3.5 h-3.5" />
                                <span className="truncate">{location}</span>
                            </div>
                        )}
                        {!!applicant?.phone && (
                            <div className="flex items-center gap-1 text-gray-600">
                                <Phone className="w-3.5 h-3.5" />
                                <span>{applicant.phone}</span>
                            </div>
                        )}
                    </div>

                    {/*
                        Applied on / Membership Type, the pair the mobile
                        applicant card shows beneath the contact rows. Without
                        them an admin could not tell from the queue how long a
                        file had been waiting, or whether the applicant was a
                        business or an aspirant, without opening it.

                        The date format is mobile's: 02 Sep 2026.
                    */}
                    <div className="mt-3 grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                        <div>
                            <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
                                Applied on
                            </p>
                            <p className="text-sm text-gray-800 font-medium">
                                {applicant?.submittedAt
                                    ? new Date(applicant.submittedAt).toLocaleDateString('en-GB', {
                                        day: '2-digit', month: 'short', year: 'numeric',
                                    })
                                    : '—'}
                            </p>
                        </div>
                        <div>
                            <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
                                Membership Type
                            </p>
                            <p className="text-sm text-gray-800 font-medium capitalize">
                                {applicant?.memberType || applicant?.role || 'Member'}
                            </p>
                        </div>
                    </div>

                    {/* This file reached a tier it does not formally belong to,
                        because the tier below has no active admin. */}
                    {!!applicant?.orphaned && !!applicant?.fallbackReason && (
                        <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-2">
                            <TrendingUp className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-800">{applicant.fallbackReason}</p>
                        </div>
                    )}

                    {!!applicant?.approvedByText && (
                        <p
                            className={`mt-2 text-xs ${
                                stage === 'rejected' || stage === 'closed' ? 'text-red-600' : 'text-gray-500'
                            }`}
                        >
                            {applicant.approvedByText}
                        </p>
                    )}

                    {!!applicant?.rejectionReason && stage !== 'pending' && (
                        <p className="mt-2 text-xs text-red-600 line-clamp-3">
                            Reason: {applicant.rejectionReason}
                        </p>
                    )}

                    {canAct && !isRejecting && (
                        <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                                size="sm"
                                className="flex-1 bg-green-600 hover:bg-green-700"
                                disabled={isBusy}
                                onClick={() => submit(applicant, 'approve')}
                            >
                                {isBusy && busyAction === 'approve' ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <Check className="w-4 h-4 mr-1" /> Approve
                                    </>
                                )}
                            </Button>
                            <Button
                                size="sm"
                                variant="destructive"
                                className="flex-1"
                                disabled={isBusy}
                                onClick={() => {
                                    setRejectingId(applicant?.id || '');
                                    setRejectReason('');
                                }}
                            >
                                <X className="w-4 h-4 mr-1" /> Reject
                            </Button>
                        </div>
                    )}

                    {/* Inline, not a dialog — the queue renders inside tab views
                        and the reason must stay visible while it is typed. */}
                    {canAct && isRejecting && (
                        <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                            <label className="text-xs font-medium text-gray-700">Reason for rejection</label>
                            <Textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Explain why this application is being rejected"
                                rows={3}
                            />
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1"
                                    disabled={isBusy}
                                    onClick={() => {
                                        setRejectingId(null);
                                        setRejectReason('');
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    className="flex-1"
                                    disabled={isBusy}
                                    onClick={() => submit(applicant, 'reject', (rejectReason || '').trim())}
                                >
                                    {isBusy && busyAction === 'reject' ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        'Confirm Reject'
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="p-4">
            <h2 className="text-lg font-bold text-gray-900 mb-3">{copy.title}</h2>

            <div className="flex gap-1 mb-4">
                {FILTER_TABS.map((tab) => {
                    const isActive = activeFilter === tab.key;
                    const count = (safeBuckets[tab.key] || []).length;
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveFilter(tab.key)}
                            className={`flex-1 px-2 py-2 rounded-full border text-xs font-medium truncate transition-colors ${
                                isActive ? TAB_ACTIVE[tab.key] : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            {tab.label} ({count})
                        </button>
                    );
                })}
            </div>

            {visible.length > 0 ? (
                visible.map(renderCard)
            ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Inbox className="w-9 h-9 text-gray-300 mb-2" />
                    <p className="font-medium text-gray-700">No {activeFilter} applications</p>
                    <p className="text-sm text-gray-500 mt-1 max-w-sm">
                        {activeFilter === 'pending' ? copy.waitingOn : 'Nothing to show in this bucket yet.'}
                    </p>
                </div>
            )}
        </div>
    );
}
