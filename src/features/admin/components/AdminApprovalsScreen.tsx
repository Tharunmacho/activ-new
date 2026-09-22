import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { toast } from "sonner";
import { Toaster } from "@/components/ui/toaster";
import AdminSidebar from "./AdminSidebar";
import ApprovalQueue, { type ApplicantBuckets, type BucketKey } from "@/components/ApprovalQueue";
import useApplicantDetail from './useApplicantDetail';
import ProfileViewModal from "@/components/ui/profile-view-modal";
import {
    apiFetch, dashboardPathForRole, approveApplication, rejectApplication,
    errorMessage, type Applicant,
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
        try {
            const token = localStorage.getItem("token");
            if (!token) {
                toast.error("Please login again");
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
            console.error("Error loading applications:", error);
            toast.error(errorMessage(error, "Failed to load applications"));
        }
    }, []);

    useEffect(() => { load(); }, [load]);

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
            <AdminSidebar tier={tier} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

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
