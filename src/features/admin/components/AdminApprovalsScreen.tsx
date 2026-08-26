import { useEffect, useState, useCallback } from "react";
import { Menu } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/toaster";
import AdminSidebar from "./AdminSidebar";
import ApprovalQueue, { type ApplicantBuckets, type BucketKey } from "@/components/ApprovalQueue";
import ProfileViewModal from "@/components/ui/profile-view-modal";
import {
    apiFetch, dashboardPathForRole, approveApplication, rejectApplication,
    getApplicationProfile, errorMessage, type Applicant,
} from "@/services/activApi";
import { TIERS, type AdminTier } from "./tierConfig";

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
    const config = TIERS[tier];

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [tab, setTab] = useState<BucketKey>("all");

    const [serverBuckets, setServerBuckets] = useState<ApplicantBuckets>({
        pending: [], approved: [], rejected: [], all: [],
    });

    const [detailOpen, setDetailOpen] = useState(false);
    const [detailProfile, setDetailProfile] = useState<any>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailApplicant, setDetailApplicant] = useState<Applicant | null>(null);

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
                await approveApplication(applicant.id);
                toast.success("Application approved");
            } else {
                await rejectApplication(applicant.id, (reason || "").trim() || "No reason given");
                toast.success("Application rejected");
            }
            await load();
        } catch (error) {
            toast.error(errorMessage(error, `Could not ${action} the application`));
        }
    }, [load]);

    /**
     * The applicant detail view, opened from the queue.
     *
     * `ApprovalQueue` has always accepted an `onPressApplicant` callback and no
     * page passed one, so clicking a card on the website did nothing — while
     * the same tap on mobile opens the full four-form detail. The decision
     * buttons are handed through too, so an admin can read the whole
     * application and act on it without going back to the card.
     */
    const openDetail = useCallback(async (applicant: Applicant) => {
        setDetailApplicant(applicant);
        setDetailOpen(true);
        setDetailLoading(true);
        try {
            const profile = await getApplicationProfile(applicant.id);
            // The queue row carries the computed stage and label; the fetch
            // carries the four forms. The view needs both.
            setDetailProfile({
                ...(profile || {}),
                stage: applicant.stage,
                statusLabel: applicant.statusLabel,
                rejectionReason: applicant.rejectionReason || (profile as any)?.rejectionReason || "",
            });
        } catch (error) {
            toast.error(errorMessage(error, "Failed to load application data"));
            setDetailOpen(false);
        } finally {
            setDetailLoading(false);
        }
    }, []);

    return (
        <div className="min-h-screen flex bg-gradient-to-br from-gray-50 to-white">
            <AdminSidebar tier={tier} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 min-w-0 flex flex-col">
                <div className="md:hidden flex items-center justify-between p-4 bg-white border-b shadow-sm">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        aria-label="Open menu"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    <h1 className="text-xl font-bold text-gray-900">Approvals</h1>
                    <span className="w-10" />
                </div>

                <div className="flex-1 p-4 md:p-6 overflow-auto">
                    <div className="w-full max-w-7xl mx-auto space-y-5 md:space-y-6">
                        {/*
                            Heading only — no banner, no stat tiles.

                            Mobile's Approvals screen is a plain "Approvals"
                            title above the four filter pills. The website
                            carried a gradient banner and a four-tile row whose
                            numbers were, by construction, the same four numbers
                            the pills underneath already print: Total / Pending /
                            Approved / Rejected against All (9) / Pending (3) /
                            Approved (5) / Rejected (0). Two thirds of the
                            viewport restated the tab bar.
                        */}
                        <h1 className="hidden md:block text-2xl font-bold text-gray-900">Approvals</h1>

                        <ApprovalQueue
                            buckets={serverBuckets}
                            level={config.queueLevel}
                            activeFilter={tab}
                            onFilterChange={(f) => setTab(f)}
                            onReview={handleReview}
                            onPressApplicant={openDetail}
                        />
                    </div>
                </div>
            </div>

            <ProfileViewModal
                open={detailOpen}
                onClose={() => { setDetailOpen(false); setDetailProfile(null); setDetailApplicant(null); }}
                profile={detailProfile}
                loading={detailLoading}
                onReview={async (action, reason) => {
                    if (detailApplicant) await handleReview(detailApplicant, action, reason);
                }}
            />
            <Toaster />
        </div>
    );
}
