import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { adminRegionLabel } from '@/lib/session';
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, RefreshCw } from 'lucide-react';

import { toast } from "sonner";
import { Toaster } from "@/components/ui/toaster";
import AdminSidebar from "./AdminSidebar";
import ApprovalQueue, { type ApplicantBuckets, type BucketKey } from "@/components/ApprovalQueue";
import useApplicantDetail from './useApplicantDetail';
import ProfileViewModal from "@/components/ui/profile-view-modal";
import {
    apiFetch, dashboardPathForRole, approveApplication, rejectApplication,
    errorMessage, getSuperApplications, type Applicant,
} from "@/services/activApi";
import { TIERS, type AdminTier } from "./tierConfig";
import { AdminPageHeader, ADMIN_BG, ADMIN_PAGE } from './AdminUI';
import ApplicantRegionFilter, {
    EMPTY_SELECTION, matchesSelection, type RegionSelection,
} from "./ApplicantRegionFilter";

/**
 * The admin approvals queue, shared by every tier.
 *
 * Three near-identical copies of this existed (~380 lines each), and each
 * carried a `handleApprove`/`handleReject` pair that was never wired to
 * anything — dead code that still posted a hardcoded `'Application rejected'`
 * reason. Those are gone; `handleReview` below is the only path.
 *
 * The three-tier workflow is enforced by the server, and this screen renders
 * exactly what it decides. `classifyForLevel` returns four buckets plus two
 * stages this tier can see but not act on — `upstream` (still with an earlier
 * tier) and `closed` (rejected by a different one) — and `ApprovalQueue` only
 * offers Approve/Reject on a `pending` file. Deriving buckets on the client
 * loses both stages and mis-files anything whose status spelling it cannot
 * match, which is why the server's classification is used verbatim.
 */
export default function AdminApprovalsScreen({ tier }: { tier: AdminTier }) {
    const navigate = useNavigate();
    const config = TIERS[tier];
    const [params] = useSearchParams();
    const requestedApplication = params.get('application') || '';
    const openedApplication = useRef('');
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [truncated, setTruncated] = useState(false);

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [tab, setTab] = useState<BucketKey>("all");

    const [serverBuckets, setServerBuckets] = useState<ApplicantBuckets>({
        pending: [], approved: [], rejected: [], all: [],
    });

    /**
     * Which block, or which district's blocks, the queue is narrowed to.
     *
     * A view over what the server already sent — see `ApplicantRegionFilter`.
     * Nothing here is sent back to the API, so a district admin cannot widen
     * their geofence with it and the mobile app is unaffected.
     */
    const [region, setRegion] = useState<RegionSelection>({ ...EMPTY_SELECTION });

    /**
     * The filter applied to ALL FOUR buckets, not just the visible one.
     *
     * The pills print their own counts, and filtering only the rendered list
     * would leave "Pending (12)" above three cards — which reads as a screen
     * that has lost nine applicants rather than as a filter doing its job.
     */
    const buckets = useMemo(() => {
        const active = !!(region.state || region.district || region.block);
        if (!active) return serverBuckets;

        const narrow = (rows: Applicant[]) =>
            (rows || []).filter((row) => matchesSelection(row, region));

        return {
            pending: narrow(serverBuckets.pending),
            approved: narrow(serverBuckets.approved),
            rejected: narrow(serverBuckets.rejected),
            all: narrow(serverBuckets.all),
        };
    }, [serverBuckets, region]);

    /*
     * The four submitted forms, opened from a card.
     *
     * Four pieces of state and a fetch used to live here. The two Hubs needed
     * the same thing and had nothing, so it moved to `useApplicantDetail` —
     * copying it into them would have been three implementations of "view an
     * applicant", which is two more than can be kept in step.
     */
    const { openDetail, target: detailApplicant, detailProps } = useApplicantDetail();

    const load = useCallback(async () => {
        setLoading(true); setLoadError('');
        try {
            const token = localStorage.getItem("token");
            if (!token) {
                throw new Error('Please login again');
            }
            if (tier === 'super') {
                // The super dashboard supplies statistics, not the queue. Read
                // the actual application endpoint, including its later pages.
                const first = await getSuperApplications({ limit: 100 });
                const pages = Math.max(1, Number(first.pagination?.pages || 1));
                const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, index) => getSuperApplications({ limit: 100, page: index + 2 })));
                const all: Applicant[] = [first, ...rest].flatMap(result => result.applicants || []);
                const outcome = (row: Applicant) => row.outcome || row.status;
                setServerBuckets({ all, pending: all.filter(row => !['Approved', 'Rejected'].includes(outcome(row))), approved: all.filter(row => outcome(row) === 'Approved'), rejected: all.filter(row => outcome(row) === 'Rejected') });
                setTruncated(!!first.pagination?.truncated);
                return;
            }
            const response = await apiFetch(dashboardPathForRole());
            if (!response.ok) throw new Error("Failed to fetch applications");

            const data = await response.json();
            const buckets = data.data?.applicants || {};
            setServerBuckets({
                pending: buckets.pending || [],
                approved: buckets.approved || [],
                rejected: buckets.rejected || [],
                all: buckets.all || [],
            });
        } catch (error) {
            setLoadError(errorMessage(error, "Failed to load applications"));
        } finally { setLoading(false); }
    }, [tier]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        if (!requestedApplication || loading || loadError || openedApplication.current === requestedApplication) return;
        openedApplication.current = requestedApplication;
        void openDetail(serverBuckets.all.find(row => row.id === requestedApplication) || { id: requestedApplication });
    }, [requestedApplication, loading, loadError, serverBuckets.all, openDetail]);

    /**
     * Approve or reject, then refetch.
     *
     * The reason is whatever the admin typed. It used to be the constant string
     * "Application rejected", sent as `remarks` — a field the schema does not
     * have — so every applicant received the same non-explanation, and even
     * that was dropped by Mongoose before it reached the database.
     */
    const handleReview = useCallback(async (
        applicant: Applicant,
        action: "approve" | "reject",
        reason?: string,
    ) => {
        try {
            if (action === "approve") {
                // The server's own sentence, which names the tier the decision
                // was recorded under. Any of the three tiers covering this
                // applicant could have made it, so "Approved" alone no longer
                // says who did.
                const res = await approveApplication(applicant.id);
                toast.success(res?.message || "Application approved");
            } else {
                await rejectApplication(applicant.id, (reason || "").trim() || "No reason given");
                toast.success("Application rejected");
            }
            await load();
        } catch (error) {
            toast.error(errorMessage(error, `Could not ${action} the application`));
        }
    }, [load]);

    return (
        <div className={`min-h-screen flex ${ADMIN_BG}`}>
            {/* The rail reads the tier from the SIGNED-IN role, never the route. */}
            <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 min-w-0 flex flex-col">
                {/*
                  * `AdminPageHeader` — the one header, like every other admin
                  * screen. This carried a bespoke mobile bar AND a bespoke
                  * desktop header, written separately and kept in step by hand,
                  * which is why this screen's title sat at a different size and
                  * a different distance from its content than the screens
                  * either side of it in the rail.
                  */}
                <AdminPageHeader
                    title="Approvals"
                    subtitle={
                        /*
                         * The super admin is not geofenced — `tierConfig` gives
                         * them `regionKey: null` — so "reached your tier" is the
                         * wrong sentence for the one role that sees everything.
                         */
                        tier === 'super'
                            ? 'Every application on the platform, decided or not.'
                            // "what has reached your tier" described the relay:
                            // a file only arrived once the tier below had signed
                            // it. Every application in the region is here from
                            // the moment it is submitted.
                            // Name the region outright: "your state" left a State
                            // Admin reading a statewide list as a mistake.
                            : adminRegionLabel()
                                ? `Every application in ${adminRegionLabel()} (your ${config.label.toLowerCase()}) — any of them is yours to decide.`
                                : `Every application in your ${config.label.toLowerCase()} — any of them is yours to decide.`
                    }
                    onMenu={() => setSidebarOpen(true)}
                />

                {/*
                  Left-aligned at the shared width. `max-w-7xl mx-auto` centred
                  this one screen's content while the rest of the admin area runs
                  from the left margin.
                */}
                {/* The shared padding and the centred 90rem column. This was
                    `p-6` with a `max-w-[90rem]` carrying no `mx-auto`, so the
                    content hugged the left on a wide display. */}
                <div className={`flex-1 overflow-y-auto ${ADMIN_PAGE}`}>
                    <div className="flex flex-wrap justify-end gap-3"><button disabled={loading} onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 font-semibold disabled:opacity-50"><RefreshCw size={18} /> Refresh</button></div>
                    {loading ? <div role="status" className="flex items-center justify-center gap-3 py-16 text-slate-500"><Loader2 className="animate-spin" size={24} />Loading applications…</div> : loadError ? <div role="alert" className="rounded-xl bg-rose-50 p-5 text-rose-700">{loadError}<button className="ml-3 underline" onClick={() => void load()}>Retry</button></div> : <>
                        {truncated && <p className="rounded-xl bg-amber-50 p-4 text-amber-800">Showing the most recent 500 applications. Use the Hub’s region filters to review older regional applications.</p>}
                        {/*
                          Above the pills, because it narrows what they count.
                          Options are built from the `all` bucket — the complete
                          set this tier can see — so choosing one does not delete
                          the choices beside it.
                        */}
                        <ApplicantRegionFilter
                            applicants={serverBuckets.all}
                            levels={config.approvalFilters}
                            selection={region}
                            onChange={setRegion}
                        />

                        <ApprovalQueue
                            buckets={buckets}
                            level={config.queueLevel}
                            activeFilter={tab}
                            onFilterChange={(f) => setTab(f)}
                            onReview={handleReview}
                            onPressApplicant={openDetail}
                        />
                    </>}
                </div>
            </div>

            <ProfileViewModal
                {...detailProps}
                onReview={async (action, reason) => {
                    if (detailApplicant) await handleReview(detailApplicant as Applicant, action, reason);
                    detailProps.onClose();
                }}
            />
            <Toaster />
        </div>
    );
}
