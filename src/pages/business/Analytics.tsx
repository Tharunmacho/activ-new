import { useState, useEffect } from "react";
import { BarChart3, Eye, Package, Star, CheckCircle2, Store } from "lucide-react";
import BusinessPageShell from "./BusinessPageShell";
import { Card, SectionHeading, StatTile, Loading } from "./BusinessUI";
import { apiFetch } from "@/services/activApi";
import { resolveMediaUrl } from "@/config/api.config";
import { useActiveCompanyStore } from "@/contexts/ActiveCompanyContext";

/**
 * Business Analytics — the website's copy of `AnalyticsScreen.tsx`.
 *
 * Data layer notes (unchanged from the previous pass):
 *
 * 1. The figures come from `GET /products/stats?companyId=`, the same endpoint
 *    mobile reads. This page used to derive them from `GET /products` in the
 *    browser, which is a second definition of "active" that can disagree with
 *    the database's.
 *
 * 2. Two of the four figures could never be anything but zero or blank: "In
 *    Stock" filtered `p.status === 'in_stock'` on a schema with no `status`
 *    field, and the stock bars printed `product.stockQuantity`, likewise not a
 *    schema field.
 *
 * Layout note: mobile shows two headline tiles and then folds Active and
 * Featured into a two-row "Catalog Breakdown" list, because a phone has room
 * for two tiles across. A desktop has room for four, so the same four figures
 * are four tiles and the breakdown panel — which held nothing else — is gone.
 * Every figure mobile shows is still shown; only the shelf changed.
 */

const EMPTY_STATS = {
    totalProducts: 0,
    featuredProducts: 0,
    activeProducts: 0,
    profileViews: 0,
};

const Analytics = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(EMPTY_STATS);

    const { activeCompany, hasLoaded, loadCompanies } = useActiveCompanyStore();

    useEffect(() => {
        loadCompanies();
    }, [loadCompanies]);

    useEffect(() => {
        if (!hasLoaded) return;
        loadStats();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasLoaded, activeCompany?._id]);

    const loadStats = async () => {
        const companyId = activeCompany?._id;

        if (!companyId) {
            setStats(EMPTY_STATS);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const response = await apiFetch(
                `/products/stats?companyId=${encodeURIComponent(companyId)}`,
            );
            const body = await response.json();
            const data = body?.data || {};

            setStats({
                totalProducts: Number(data.total || 0),
                featuredProducts: Number(data.featured || 0),
                activeProducts: Number(data.active || 0),
                // Not yet served by the endpoint; mobile reads the same key and
                // shows 0 rather than inventing a number.
                profileViews: Number(data.views || 0),
            });
        } catch (error) {
            console.error('Error loading analytics stats:', error);
            setStats(EMPTY_STATS);
        } finally {
            setLoading(false);
        }
    };

    return (
        <BusinessPageShell
            title="Business Analytics"
            subtitle="Track your business performance and insights"
            width="standard"
        >
            <div className="space-y-6">
                {/*
                    Which company these figures describe. Read-only, as on mobile:
                    switching happens once, on the Business dashboard or My
                    Companies, never from a reporting screen.
                */}
                <Card className="flex items-center gap-4">
                    {activeCompany?.logo ? (
                        <img
                            src={resolveMediaUrl(activeCompany.logo)}
                            alt={activeCompany.businessName}
                            className="w-12 h-12 rounded-xl object-cover shrink-0"
                        />
                    ) : (
                        <span className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                            <Store className="h-6 w-6 text-blue-600" />
                        </span>
                    )}
                    <div className="min-w-0">
                        <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider">
                            Analytics for
                        </p>
                        <p className="text-lg font-bold text-slate-900 truncate">
                            {activeCompany?.businessName || 'No active company'}
                        </p>
                        <p className="text-sm text-slate-500 truncate">
                            {activeCompany
                                ? `${activeCompany.businessType || '—'}${activeCompany.location ? ` · ${activeCompany.location}` : ''}`
                                : 'Create a company to see its analytics'}
                        </p>
                    </div>
                </Card>

                {loading ? (
                    <Loading label="Loading analytics…" />
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                            <StatTile
                                label="Profile Views"
                                value={stats.profileViews}
                                unit="This month"
                                icon={Eye}
                            />
                            <StatTile
                                label="Catalog Products"
                                value={stats.totalProducts}
                                unit="Total listed"
                                icon={Package}
                            />
                            <StatTile
                                label="Active Catalog Items"
                                value={stats.activeProducts}
                                unit="Live now"
                                icon={CheckCircle2}
                            />
                            <StatTile
                                label="Featured Offerings"
                                value={stats.featuredProducts}
                                unit="Promoted"
                                icon={Star}
                            />
                        </div>

                        <Card>
                            <SectionHeading
                                title="Traffic &amp; Engagement"
                                description="How buyers are finding and using your catalog"
                                icon={BarChart3}
                            />
                            <div className="flex flex-col items-center justify-center py-16 px-4 rounded-xl bg-slate-50 border border-slate-200">
                                <BarChart3 className="h-12 w-12 text-blue-300 mb-3" />
                                <p className="text-sm text-slate-500 text-center max-w-md">
                                    Analytics &amp; engagement graphs populate in real-time as buyers
                                    visit your catalog.
                                </p>
                            </div>
                        </Card>
                    </>
                )}
            </div>
        </BusinessPageShell>
    );
};

export default Analytics;
