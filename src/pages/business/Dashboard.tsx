import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
    Eye, Package, CheckCircle2, Star, Pencil, Clock, Plus, Store, ArrowLeftRight,
} from "lucide-react";
import BusinessPageShell from "./BusinessPageShell";
import { Card, SectionHeading, StatTile, EmptyState, Loading, Chip } from "./BusinessUI";
import { apiFetch } from "@/services/activApi";
import { resolveMediaUrl } from "@/config/api.config";
import { useActiveCompanyStore } from "@/contexts/ActiveCompanyContext";

/**
 * The company `status` vocabulary is `pending | active | inactive` — the enum on
 * `company.model.js`. This screen tested for 'approved' and 'rejected', which
 * are application statuses and never appear on a company, so an active company
 * was painted amber as though it were still awaiting approval.
 */
const STATUS_TONES: Record<string, 'green' | 'red' | 'amber'> = {
    active: 'green',
    inactive: 'red',
    pending: 'amber',
};

const BusinessDashboard = () => {
    const navigate = useNavigate();
    const { activeCompany, companies, hasLoaded, loadCompanies } = useActiveCompanyStore();
    /**
     * Counts and activity come from the endpoints that exist for them —
     * `/products/stats` and `/products/activities` — which is what the mobile
     * dashboard calls. This page pulled the whole product list instead and
     * counted it in the browser, which is both a second definition of "active"
     * and a much larger response than three numbers need.
     */
    const [stats, setStats] = useState({ total: 0, active: 0, featured: 0 });
    const [activities, setActivities] = useState<any[]>([]);
    /**
     * How many companies the member owns at all.
     *
     * "No active company" and "no company exists" are different states and
     * they need different instructions. This screen only ever asked
     * `/business-profiles/me`, which answers `null` for both — so a member who
     * had never created a company was told to "Select Active Company", sending
     * them to an empty list with nothing to select. The mobile dashboard has
     * always distinguished the two ("No Business Profile Found" → Create); the
     * two clients now say the same thing.
     */
    const [companyCount, setCompanyCount] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadCompanies();
    }, [loadCompanies]);

    useEffect(() => {
        if (!hasLoaded) return;
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasLoaded, activeCompany?._id]);

    const loadData = async () => {
        try {
            // The company and the count both come from the shared selection,
            // so the dashboard cannot show one company while the sidebar shows
            // another.
            setCompanyCount(companies.length);

            const companyId = activeCompany?._id;
            if (!companyId) {
                setStats({ total: 0, active: 0, featured: 0 });
                setActivities([]);
                return;
            }

            // Both scoped to the selected company. Without `companyId` these
            // endpoints answer for every company the member owns, so the counts
            // used to be the sum of every catalog.
            const scope = encodeURIComponent(companyId);

            const [statsRes, activitiesRes] = await Promise.allSettled([
                apiFetch(`/products/stats?companyId=${scope}`),
                apiFetch(`/products/activities?companyId=${scope}&limit=5`),
            ]);

            if (statsRes.status === 'fulfilled') {
                const body = await statsRes.value.json().catch(() => null);
                const data = body?.data || {};
                setStats({
                    total: Number(data.total || 0),
                    active: Number(data.active || 0),
                    featured: Number(data.featured || 0),
                });
            }

            if (activitiesRes.status === 'fulfilled') {
                const body = await activitiesRes.value.json().catch(() => null);
                const data = body?.data ?? [];
                setActivities(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    };

    /**
     * The activity feed the server already builds, rather than a second one
     * derived from the product list. `time` is an ISO date on the payload.
     */
    const recentActivity = (activities || []).slice(0, 5).map((activity, index) => ({
        id: String(activity?.productId || index),
        type: activity?.label || 'Product created',
        name: activity?.description || 'Untitled',
        time: activity?.time
            ? new Date(activity.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : '',
    }));

    /**
     * `status` is optional on the company document, so `.charAt` on it throws
     * for any row written before the field existed — a blank dashboard rather
     * than a missing word.
     */
    const status = (activeCompany?.status || 'pending').toLowerCase();
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

    return (
        <BusinessPageShell
            title="Business Dashboard"
            subtitle="Manage your business presence"
            width="wide"
            actions={
                <Button
                    onClick={() => navigate('/business/companies')}
                    variant="outline"
                    className="border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                    <ArrowLeftRight className="h-4 w-4 mr-2" />
                    Switch company
                </Button>
            }
        >
            {loading ? (
                <Loading label="Loading dashboard…" />
            ) : (
                <div className="space-y-6">
                    {/*
                        Four figures across, rather than the three-then-split
                        arrangement this had. The old layout put a single short
                        card in a `lg:col-span-2` — a ~700px-wide box holding four
                        lines of text — with the activity list beside it, so the
                        left two-thirds of the page was mostly empty.
                    */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                        <StatTile label="Profile Views" value={0} unit="Last 30 days" icon={Eye} />
                        <StatTile label="Products Listed" value={stats.total} unit="Total catalog" icon={Package} />
                        {/*
                            The server's count of active products. This read
                            `p.status === 'active'` from each product — the Product
                            schema has no `status` field, so the badge read "0
                            active" for every catalog, however many items were live.
                        */}
                        <StatTile label="Live Products" value={stats.active} unit="Visible in Discover" icon={CheckCircle2} />
                        <StatTile label="Featured" value={stats.featured} unit="Promoted items" icon={Star} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                        {/* Active company */}
                        <Card className="lg:col-span-2">
                            <SectionHeading
                                title="Active Company"
                                description="Everything on this dashboard describes this company"
                                icon={Store}
                            />

                            {!activeCompany ? (
                                <EmptyState
                                    icon={Store}
                                    title={companyCount === 0 ? 'No business profile found' : 'No active company'}
                                    hint={
                                        companyCount === 0
                                            ? 'Create one to start listing products and reaching buyers.'
                                            : 'Pick which of your companies this dashboard should describe.'
                                    }
                                    action={
                                        companyCount === 0 ? (
                                            <Button
                                                className="bg-blue-600 hover:bg-blue-700"
                                                onClick={() => navigate('/business/companies/add')}
                                            >
                                                <Plus className="h-4 w-4 mr-2" />
                                                Create Business Profile
                                            </Button>
                                        ) : (
                                            <Button
                                                className="bg-blue-600 hover:bg-blue-700"
                                                onClick={() => navigate('/business/companies')}
                                            >
                                                Select Active Company
                                            </Button>
                                        )
                                    }
                                />
                            ) : (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                                        {activeCompany.logo ? (
                                            <img
                                                src={resolveMediaUrl(activeCompany.logo)}
                                                alt={activeCompany.businessName}
                                                className="w-14 h-14 rounded-xl object-cover shrink-0"
                                            />
                                        ) : (
                                            <span className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                                                <Store className="h-7 w-7 text-blue-600" />
                                            </span>
                                        )}

                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <h3 className="font-bold text-lg text-slate-900 truncate">
                                                    {activeCompany.businessName}
                                                </h3>
                                                <Chip tone={STATUS_TONES[status] || 'amber'}>{statusLabel}</Chip>
                                            </div>

                                            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 mt-3 text-sm">
                                                <div className="flex gap-2 min-w-0">
                                                    <dt className="text-slate-500 shrink-0">Type</dt>
                                                    <dd className="text-slate-800 font-medium truncate">
                                                        {activeCompany.businessType || '—'}
                                                    </dd>
                                                </div>
                                                <div className="flex gap-2 min-w-0">
                                                    <dt className="text-slate-500 shrink-0">Phone</dt>
                                                    <dd className="text-slate-800 font-medium truncate">
                                                        {activeCompany.mobileNumber || '—'}
                                                    </dd>
                                                </div>
                                                <div className="flex gap-2 min-w-0">
                                                    <dt className="text-slate-500 shrink-0">Email</dt>
                                                    <dd className="text-slate-800 font-medium truncate">
                                                        {activeCompany.email || '—'}
                                                    </dd>
                                                </div>
                                                <div className="flex gap-2 min-w-0">
                                                    <dt className="text-slate-500 shrink-0">Location</dt>
                                                    <dd className="text-slate-800 font-medium truncate">
                                                        {[activeCompany.area, activeCompany.location]
                                                            .filter(Boolean).join(', ') || '—'}
                                                    </dd>
                                                </div>
                                            </dl>
                                        </div>

                                        <div className="flex sm:flex-col gap-2 shrink-0">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="border-slate-200 text-slate-700 hover:bg-white"
                                                onClick={() => navigate(`/business/companies/${activeCompany._id}`)}
                                            >
                                                <Eye className="h-4 w-4 mr-2" />
                                                Details
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="border-slate-200 text-slate-700 hover:bg-white"
                                                onClick={() => navigate(`/business/companies/edit/${activeCompany._id}`)}
                                            >
                                                <Pencil className="h-4 w-4 mr-2" />
                                                Edit
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </Card>

                        {/* Recent activity */}
                        <Card className="lg:sticky lg:top-0">
                            <SectionHeading title="Recent Activity" description="Latest catalog changes" icon={Clock} />

                            {recentActivity.length === 0 ? (
                                <div className="text-center py-10">
                                    <Package className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                                    <p className="text-sm text-slate-500">No recent activity</p>
                                </div>
                            ) : (
                                <ul className="space-y-2">
                                    {recentActivity.map((activity) => (
                                        <li
                                            key={activity.id}
                                            className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200"
                                        >
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2 shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-semibold text-slate-800">{activity.type}</p>
                                                <p className="text-sm text-slate-600 truncate">{activity.name}</p>
                                                <p className="text-xs text-slate-400 mt-0.5">{activity.time}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            <div className="mt-5 pt-5 border-t border-slate-200 space-y-2">
                                <Button
                                    onClick={() => navigate('/business/products')}
                                    className="w-full bg-blue-600 hover:bg-blue-700"
                                >
                                    View Products
                                </Button>
                                <Button
                                    onClick={() => navigate('/business/analytics')}
                                    variant="outline"
                                    className="w-full border-slate-200 text-slate-700 hover:bg-slate-50"
                                >
                                    View Analytics
                                </Button>
                            </div>
                        </Card>
                    </div>
                </div>
            )}
        </BusinessPageShell>
    );
};

export default BusinessDashboard;
