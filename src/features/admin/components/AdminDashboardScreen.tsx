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
import { AdminBackButton } from './AdminUI';

import { PAGE_SUBTITLE, PAGE_TITLE, CARD_TITLE } from '@/components/layout/appTypography';
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
 *
 * ------------------------------------------ THE FOUR TILES ARE ONE SUM
 *
 * The first tile is the region's applicants and the other three are the
 * buckets they fall into, so the row adds up: 2 = 1 pending + 1 approved + 0
 * rejected. It used to read `stats.totalMembers`, which the server computed as
 * "the approved count, unless nothing is approved, in which case the total" —
 * so on a region with one of each it printed 1 beside an Approved tile also
 * printing 1, and the only way to tell which question had been answered was to
 * already know the answer.
 *
 * "Applicants", not "Members": somebody whose application is still pending is
 * not a member, and three of these four tiles are counting applications.
 */
export default function AdminDashboardScreen({ tier }: { tier: AdminTier }) {
    const config = TIERS[tier];

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [adminInfo, setAdminInfo] = useState<any>(null);
    const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
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
                    setStats({ total: 0, pending: 0, approved: 0, rejected: 0 });
                    setRecentApplications([]);
                    toast.error(dashboard.message || "Scope unresolved");
                    return;
                }

                const pending = dashboard.stats?.pendingApplications || 0;
                const approved = dashboard.stats?.approvedApplications || 0;
                const rejected = dashboard.stats?.rejectedApplications || 0;

                setStats({
                    /*
                     * The server's own total, and the sum as the fallback.
                     *
                     * They agree — every applicant is in exactly one of the
                     * three buckets — so the fallback only covers a server old
                     * enough not to send the field, and even then the row still
                     * adds up rather than showing a blank first tile.
                     */
                    total: dashboard.stats?.totalApplications ?? (pending + approved + rejected),
                    pending,
                    approved,
                    rejected,
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
        { label: "Total Applicants", value: stats.total, icon: Users, tint: "from-blue-600 to-blue-700 border-blue-500", sub: "text-blue-100" },
        { label: "Pending", value: stats.pending, icon: Clock, tint: "from-amber-500 to-amber-600 border-amber-400", sub: "text-amber-100" },
        { label: "Approved", value: stats.approved, icon: CheckCircle, tint: "from-green-600 to-green-700 border-green-500", sub: "text-green-100" },
        { label: "Rejected", value: stats.rejected, icon: XCircle, tint: "from-red-600 to-red-700 border-red-500", sub: "text-red-100" },
    ];

    const stageTone: Record<string, string> = {
        approved: "bg-green-100 text-green-700",
        rejected: "bg-red-100 text-red-700",
        pending: "bg-amber-100 text-amber-700",
    };

    return (
        <div className="min-h-screen flex bg-white">
            <AdminSidebar tier={tier} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 min-w-0 flex flex-col">
                <div className="lg:hidden flex items-center gap-2 p-4 bg-white border-b shadow-sm">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        aria-label="Open menu"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    {/* The rail moves sideways between sections; this retraces
                        the step that got here. On a phone it was the only thing
                        missing, because the rail is behind the hamburger and the
                        browser chrome was the sole way back. Renders nothing on
                        the tier's own landing page. */}
                    <AdminBackButton />
                    <h1 className={`${PAGE_TITLE} text-slate-900 flex-1 min-w-0 truncate`}>Dashboard</h1>
                </div>

                {/*
                  The white header bar every other admin screen opens with.
                  Dashboard had none, so it was the one screen whose title
                  scrolled away with the content — and the only one without a way
                  back to itself from a sub-page.
                */}
                {/* `lg`, matching the bar above and the breakpoint the rail appears
                    at. The two were `md:hidden` / `hidden md:flex`, which was
                    exclusive while the rail also switched at `md`. Moving the
                    rail to `lg` left both bars rendering between 768px and
                    1023px — the same title and the same back arrow, twice. */}
                <header className="hidden lg:flex bg-white border-b border-slate-200 px-6 py-4
                                   flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                        <h1 className={`${PAGE_TITLE} text-slate-900`}>
                            Dashboard
                        </h1>
                        <p className={`${PAGE_SUBTITLE} text-slate-500 mt-0.5`}>
                            {config.label} admin — your region at a glance.
                        </p>
                    </div>
                </header>

                <div className="flex-1 overflow-auto">
                    {/* `max-w-7xl mx-auto` centred this one screen's content
                        while every other admin page runs from the left margin. */}
                    <div className="p-6 max-w-[90rem] space-y-6">
                        <div>
                            <div className="flex items-center gap-4 mb-8">
                                <Avatar className="w-16 h-16 ring-4 ring-blue-100">
                                    <AvatarFallback className="bg-blue-600 text-white font-bold text-[1.5625rem]">
                                        {config.initials}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                    <h1 className="text-[1.75rem] md:text-[2.125rem] font-bold text-slate-900 truncate">{userName}</h1>
                                    <p className="text-slate-500">{config.dashboardTitle}</p>
                                    {location ? <p className="text-[1.25rem] text-slate-500 truncate">{location}</p> : null}
                                </div>
                            </div>

                            <h2 className={`${CARD_TITLE} mb-4 text-slate-900`}>Overview Statistics</h2>
                            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                                {TILES.map((t) => (
                                    <div
                                        key={t.label}
                                        className={`bg-gradient-to-br ${t.tint} rounded-2xl p-6 border shadow-xl`}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <t.icon className={`w-5 h-5 ${t.sub}`} />
                                            <p className={`${t.sub} text-[1.25rem] font-medium`}>{t.label}</p>
                                        </div>
                                        <p className="text-[2.5625rem] font-bold tracking-tight tabular-nums text-white tabular-nums">
                                            {loading ? "…" : t.value}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Recent activity */}
                    <div className="px-6 pb-6 max-w-[90rem]">
                        <div className="max-w-[90rem] space-y-6">
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <div>
                                    <h2 className={`${CARD_TITLE} text-slate-900`}>Recent Activity</h2>
                                    <p className="text-slate-500 text-[1.25rem]">Latest application submissions</p>
                                </div>
                                <Link to={`${config.base}/approvals`}>
                                    <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 shadow-sm">
                                        View All
                                    </Button>
                                </Link>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)]">
                                <div className="hidden md:grid grid-cols-4 gap-4 px-5 py-4 text-[1.25rem] font-semibold text-slate-700 border-b border-slate-200 mb-4">
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
                                                    className="grid grid-cols-1 md:grid-cols-4 gap-5 items-center p-4 rounded-xl bg-white hover:bg-slate-50 transition-colors duration-200 border border-slate-200"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <Avatar className="w-10 h-10 ring-2 ring-blue-200">
                                                            <AvatarFallback className="bg-blue-600 text-white font-bold text-[1.25rem]">
                                                                {initials}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="min-w-0">
                                                            <p className="font-semibold text-slate-900 text-[1.25rem] truncate">{displayName}</p>
                                                            <p className="text-[1.1875rem] text-slate-500 truncate">
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
                                                    <div className="text-[1.25rem] text-slate-700 capitalize">
                                                        {app.memberType || "—"}
                                                    </div>
                                                    <div className="text-[1.25rem] text-slate-700">
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
                                            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                                            <p className="text-slate-500 text-[1.25rem]">
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
