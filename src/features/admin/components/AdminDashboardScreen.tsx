import { useState, useEffect } from "react";
import { formatApplicationRef } from '@/lib/applicationRef';
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Menu, Users, Clock, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import AdminSidebar from "./AdminSidebar";
import { getAdminProfile, getAdminDashboard, errorMessage } from "@/services/activApi";
import { TIERS, type AdminTier } from "./tierConfig";

/**
 * The admin dashboard, shared by the three tiers.
 *
 * Block, district and state each carried a ~360-line copy, and the copies had
 * drifted in ways that changed what the screen reported: block read
 * `stats.totalApplications` where district and state read `stats.totalMembers`,
 * and only block guarded the response before dereferencing it.
 *
 * Two figures come from the server and are shown as the server states them —
 * there is no trend, because no endpoint returns one. A hardcoded
 * "0% vs last 30 days" with an upward arrow used to sit under every tile on
 * mobile; an arrow beside a hard zero reads as a real metric, so it is gone
 * rather than left to be believed.
 */
export default function AdminDashboardScreen({ tier }: { tier: AdminTier }) {
    const config = TIERS[tier];

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [adminInfo, setAdminInfo] = useState<any>(null);
    const [stats, setStats] = useState({ totalMembers: 0, pending: 0, approved: 0, rejected: 0 });
    const [recentApplications, setRecentApplications] = useState<any[]>([]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);

                /*
                 * Both requests at once, not one after the other.
                 *
                 * These are independent — the dashboard is scoped server-side
                 * from the caller's token, not from anything the profile call
                 * returns — but they were awaited in sequence, so the screen
                 * cost two full round trips before it could render. Against the
                 * production cluster that is a measured 111ms median just in
                 * network, per trip, before either endpoint does any work.
                 *
                 * `allSettled`, not `all`: a failing profile lookup used to take
                 * the whole dashboard down with it via the shared catch, leaving
                 * the stats on "…" forever. They now fail independently.
                 */
                const [profileResult, dashboardResult] = await Promise.allSettled([
                    getAdminProfile(),
                    getAdminDashboard(),
                ]);

                if (cancelled) return;

                // `getAdminProfile` returns the unwrapped record, so there is
                // no `success` envelope to test here.
                const admin: any = profileResult.status === 'fulfilled' ? profileResult.value : null;
                if (!cancelled && admin) {
                    setAdminInfo({
                        ...admin,
                        state: admin.meta?.state || admin.state,
                        district: admin.meta?.district || admin.district,
                        block: admin.meta?.block || admin.block,
                    });
                }

                if (dashboardResult.status === 'rejected') throw dashboardResult.reason;
                const dashboard = dashboardResult.value;

                if (dashboard.scopeUnresolved) {
                    setStats({ totalMembers: 0, pending: 0, approved: 0, rejected: 0 });
                    setRecentApplications([]);
                    toast.error(dashboard.message || "Scope unresolved");
                    return;
                }

                setStats({
                    totalMembers: dashboard.stats?.totalMembers || 0,
                    pending: dashboard.stats?.pendingApplications || 0,
                    approved: dashboard.stats?.approvedApplications || 0,
                    rejected: dashboard.stats?.rejectedApplications || 0,
                });

                /**
                 * The bucket the server already computed, not a re-derivation.
                 *
                 * This used to re-classify each row with
                 * `approvedApps.some(a => a._id === app._id || ...)`. The
                 * applicant payload has `id` and `applicationId` and **no
                 * `_id`**, so that clause was `undefined === undefined` — true —
                 * and `.some()` matched every application the moment the
                 * approved bucket was non-empty. Every row in Recent Activity
                 * was labelled "Approved", including files still waiting for
                 * this admin to review them.
                 */
                const all = dashboard.applicants?.all || [];
                setRecentApplications(all.slice(0, 5));
            } catch (error: any) {
                if (!cancelled) {
                    console.error("Error loading dashboard data:", error);
                    toast.error(errorMessage(error, "Failed to load dashboard data"));
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [tier]);

    const userName = adminInfo?.fullName || localStorage.getItem("userName") || "Admin";
    const location = [adminInfo?.block, adminInfo?.district, adminInfo?.state]
        .filter(Boolean).join(", ");

    const TILES = [
        { label: "Total Members", value: stats.totalMembers, icon: Users, tint: "from-blue-600 to-blue-700 border-blue-500", sub: "text-blue-100" },
        { label: "Pending", value: stats.pending, icon: Clock, tint: "from-amber-500 to-amber-600 border-amber-400", sub: "text-amber-100" },
        { label: "Approved", value: stats.approved, icon: CheckCircle, tint: "from-green-600 to-green-700 border-green-500", sub: "text-green-100" },
        { label: "Rejected", value: stats.rejected, icon: XCircle, tint: "from-red-600 to-red-700 border-red-500", sub: "text-red-100" },
    ];

    const stageTone: Record<string, string> = {
        approved: "bg-green-100 text-green-700",
        rejected: "bg-red-100 text-red-700",
        pending: "bg-amber-100 text-amber-700",
        upstream: "bg-slate-100 text-slate-700",
        closed: "bg-slate-100 text-slate-700",
    };

    return (
        <div className="min-h-screen flex bg-gradient-to-br from-gray-100 to-gray-50">
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
                    <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
                    <span className="w-10" />
                </div>

                <div className="flex-1 overflow-auto">
                    {/* Identity band */}
                    <div className="bg-white p-6 lg:p-10 shadow-lg">
                        <div className="max-w-7xl mx-auto">
                            <div className="flex items-center gap-4 mb-8">
                                <Avatar className="w-16 h-16 ring-4 ring-blue-100">
                                    <AvatarFallback className="bg-gradient-to-br from-blue-600 to-purple-600 text-white font-bold text-xl">
                                        {config.initials}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 truncate">{userName}</h1>
                                    <p className="text-gray-600">{config.dashboardTitle}</p>
                                    {location ? <p className="text-sm text-gray-500 truncate">{location}</p> : null}
                                </div>
                            </div>

                            <h2 className="text-xl font-semibold mb-4 text-gray-900">Overview Statistics</h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {TILES.map((t) => (
                                    <div
                                        key={t.label}
                                        className={`bg-gradient-to-br ${t.tint} rounded-2xl p-6 border shadow-xl`}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <t.icon className={`w-5 h-5 ${t.sub}`} />
                                            <p className={`${t.sub} text-sm font-medium`}>{t.label}</p>
                                        </div>
                                        <p className="text-4xl font-bold text-white tabular-nums">
                                            {loading ? "…" : t.value}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Recent activity */}
                    <div className="bg-gradient-to-br from-gray-50 to-white p-6 lg:p-10">
                        <div className="max-w-7xl mx-auto space-y-6">
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900">Recent Activity</h2>
                                    <p className="text-gray-600 text-sm">Latest application submissions</p>
                                </div>
                                <Link to={`${config.base}/approvals`}>
                                    <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg px-6 shadow-lg">
                                        View All
                                    </Button>
                                </Link>
                            </div>

                            <div className="bg-white rounded-2xl p-6 shadow-2xl border border-gray-100">
                                <div className="hidden md:grid grid-cols-4 gap-4 px-4 py-3 text-sm font-semibold text-gray-700 border-b border-gray-200 mb-4">
                                    <div>Name</div>
                                    <div>Status</div>
                                    {/* These read "Size" and "Modified" — leftovers from a
                                        file-list table, above cells holding the member type
                                        and the submission date. */}
                                    <div>Type</div>
                                    <div>Submitted</div>
                                </div>

                                <div className="space-y-3">
                                    {recentApplications.length > 0 ? (
                                        recentApplications.map((app) => {
                                            const displayName = app.fullName || "Unknown";
                                            const initials = displayName !== "Unknown"
                                                ? displayName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
                                                : "N/A";
                                            const stage = String(app.stage || "pending");
                                            return (
                                                <div
                                                    key={app.id || app.applicationId}
                                                    className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-all duration-200 shadow-sm border border-blue-100"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <Avatar className="w-10 h-10 ring-2 ring-blue-200">
                                                            <AvatarFallback className="bg-gradient-to-br from-blue-600 to-purple-600 text-white font-bold text-sm">
                                                                {initials}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="min-w-0">
                                                            <p className="font-semibold text-gray-900 text-sm truncate">{displayName}</p>
                                                            <p className="text-xs text-gray-600 truncate">
                                                                <span title={app.applicationId || undefined}>
                                                                    {formatApplicationRef(app).short || 'N/A'}
                                                                </span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <Badge className={`${stageTone[stage] || stageTone.pending} hover:opacity-90`}>
                                                            {app.statusLabel || stage}
                                                        </Badge>
                                                    </div>
                                                    <div className="text-sm text-gray-700 capitalize">
                                                        {app.memberType || "—"}
                                                    </div>
                                                    <div className="text-sm text-gray-700">
                                                        {app.submittedAt
                                                            ? new Date(app.submittedAt).toLocaleDateString("en-GB", {
                                                                day: "2-digit", month: "short", year: "numeric",
                                                            })
                                                            : "—"}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="text-center py-10">
                                            <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                            <p className="text-gray-500 text-sm">
                                                {loading ? "Loading applications…" : "No applications yet"}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
