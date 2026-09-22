import { useState, useEffect } from "react";
import { BarChart3, Eye, Package, Star, CheckCircle2, Store } from "lucide-react";
import {
    Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import BusinessPageShell from "./BusinessPageShell";
/* Where an unpaid member is sent. A function, not a literal:
   these routes moved once already. */
import { dashboardPathFor } from '@/features/member/memberAccess';
import { Card, SectionHeading, StatTile, Loading, companyName } from "./BusinessUI";
import { apiFetch, getPaymentStatus } from "@/services/activApi";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Lock } from "lucide-react";
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
    /** How many companies keep this one on their trust list. */
    trustedBy: 0,
    /** What the chart draws: the products people actually opened. */
    topViewed: [] as { name: string; views: number }[],
};

const Analytics = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(EMPTY_STATS);

    /**
     * Has this member paid?
     *
     * `null` is “not known yet” and is treated as UNPAID. Showing a member's
     * traffic figures to somebody who has not paid for them is the mistake
     * that cannot be taken back; a locked panel for half a second is not.
     */
    const [paid, setPaid] = useState<boolean | null>(null);

    useEffect(() => {
        let cancelled = false;
        getPaymentStatus()
            .then((status) => { if (!cancelled) setPaid(status === 'completed'); })
            .catch(() => { if (!cancelled) setPaid(false); });
        return () => { cancelled = true; };
    }, []);

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
                /* Served now — see `getProductStats`. It is the sum of every
                   view of this catalogue's products, counted by the server on
                   each outside open. */
                profileViews: Number(data.views || 0),
                /* Counted on the server, never listed: WHO trusts you is that
                   member's own business and is not this screen's to show. */
                trustedBy: Number(data.trustedBy || 0),
                topViewed: Array.isArray(data.topViewed) ? data.topViewed : [],
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
            {/* One rhythm down the page. The company card, the tiles and the
                chart were `space-y-6` against tiles gapped at 12px, so the
                vertical spacing changed twice between the top and the chart. */}
            <div className="space-y-5">
                {/*
                    Which company these figures describe. Read-only, as on mobile:
                    switching happens once, on the Business dashboard or My
                    Companies, never from a reporting screen.
                */}
                <Card className="flex items-center gap-4 sm:gap-5">
                    {activeCompany?.logo ? (
                        <img
                            src={resolveMediaUrl(activeCompany.logo)}
                            alt={companyName(activeCompany)}
                            className="w-12 h-12 rounded-xl object-cover shrink-0"
                        />
                    ) : (
                        <span className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                            <Store className="h-6 w-6 text-blue-600" />
                        </span>
                    )}
                    <div className="min-w-0">
                        <p className="text-[1.1875rem] text-blue-600 font-semibold uppercase tracking-wider">
                            Analytics for
                        </p>
                        <p className="text-[1.375rem] font-bold text-slate-900 truncate">
                            {activeCompany ? companyName(activeCompany) : 'No active company'}
                        </p>
                        {/*
                          A COMPANY NAME TRUNCATES; AN INSTRUCTION MUST NOT.
                          The line below carries two different kinds of text. A
                          business name and location is a label — clipping it
                          with an ellipsis is fine, and wrapping it would push
                          the card around. "Create a company to see its
                          analytics" is the only thing on this screen telling a
                          member what to do next, and truncating it to "Create a
                          company to see its a…" is the one case where the
                          ellipsis costs the reader the answer.
                        */}
                        <p className={`text-[1.25rem] text-slate-500 ${activeCompany ? 'truncate' : ''}`}>
                            {activeCompany
                                ? `${activeCompany.businessType || '—'}${activeCompany.location ? ` · ${activeCompany.location}` : ''}`
                                : 'Create a company to see its analytics'}
                        </p>
                    </div>
                </Card>

                {loading || paid === null ? (
                    <Loading label="Loading analytics…" />
                ) : paid === false ? (
                    /*
                      ANALYTICS IS A MEMBERSHIP BENEFIT.

                      Not an apology — it names the two things being kept,
                      because those are the reasons to join and this is the
                      screen where somebody is already asking for them.
                    */
                    <Card className="p-8 sm:p-10">
                        <div className="text-center">
                            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center
                                             rounded-2xl bg-blue-50">
                                <Lock className="h-7 w-7 text-blue-600" />
                            </span>
                            <h2 className="text-[1.75rem] font-bold text-slate-900">
                                Analytics opens with membership
                            </h2>
                            <p className="mx-auto mt-2 max-w-xl text-[1.25rem] text-slate-600">
                                Your products are already being counted. Membership is what lets
                                you read the figures.
                            </p>
                        </div>

                        <div className="mt-8 grid gap-4 border-t border-slate-200 pt-8 sm:grid-cols-2">
                            {[
                                {
                                    icon: Eye,
                                    title: 'Who is opening your products',
                                    detail: 'Every view, counted when somebody outside your company '
                                        + 'opens one — and which products they open most.',
                                },
                                {
                                    icon: ShieldCheck,
                                    title: 'Who has kept your company',
                                    detail: 'How many members have added you to their trust list, '
                                        + 'which is the network deciding you are worth dealing with.',
                                },
                            ].map(({ icon: Icon, title, detail }) => (
                                <div key={title} className="flex items-start gap-3">
                                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center
                                                     justify-center rounded-xl bg-blue-50 text-blue-600">
                                        <Icon className="h-4 w-4" />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-[1.25rem] font-bold text-slate-900">
                                            {title}
                                        </span>
                                        <span className="block text-[1.125rem] leading-relaxed text-slate-600">
                                            {detail}
                                        </span>
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 text-center">
                            <Button
                                className="h-12 bg-blue-600 px-8 text-[1.25rem] font-bold hover:bg-blue-700"
                                /* The unpaid dashboard, not the plans — the same
                                   destination Discover uses. The plans screen is a
                                   Pay button with no idea whether an admin has
                                   approved anything; this one shows the
                                   application's progress and offers payment only
                                   once it is approved. */
                                onClick={() => navigate(dashboardPathFor(false))}
                            >
                                Become a member
                            </Button>
                            <p className="mt-3 text-[1.125rem] text-slate-500">
                                Read who is finding you, and who has kept your company. The counting
                                carries on either way — membership is what opens the figures.
                            </p>
                        </div>
                    </Card>
                ) : (
                    <>
                        {/* Two-up on a phone — see the note on `StatTile`. */}
                        {/* Four across from `md`, not only from `xl`. At two
                            columns the figures stacked into two tall rows on
                            every laptop and pushed the chart below the fold —
                            and the chart is what the figures are a summary of. */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5">
                            <StatTile
                                label="Product Views"
                                value={stats.profileViews}
                                unit="Opened from outside"
                                icon={Eye}
                            />
                            {/* The second figure the association asked for. Beside
                                the views rather than below the chart: they are the
                                two answers to “is anybody finding us”. */}
                            <StatTile
                                label="Members Trust You"
                                value={stats.trustedBy}
                                unit="On their trust list"
                                icon={ShieldCheck}
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
                        </div>

                        <Card>
                            <SectionHeading
                                title="Traffic &amp; Engagement"
                                description="Views of each product, counted when somebody outside your company opens it"
                                icon={BarChart3}
                            />
                            {/*
                                THE CHART, from figures the server has been
                                keeping all along. An empty catalogue — or one
                                nobody has opened yet — says so plainly rather
                                than drawing an axis with nothing on it.
                            */}
                            {stats.topViewed.some((row) => row.views > 0) ? (
                                <div className="h-72 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={stats.topViewed}
                                            margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                            <XAxis
                                                dataKey="name"
                                                tick={{ fontSize: 12, fill: '#64748b' }}
                                                tickLine={false}
                                                axisLine={{ stroke: '#e2e8f0' }}
                                                interval={0}
                                                height={48}
                                                tickFormatter={(value: string) => (
                                                    value.length > 14 ? `${value.slice(0, 13)}…` : value
                                                )}
                                            />
                                            <YAxis
                                                allowDecimals={false}
                                                tick={{ fontSize: 12, fill: '#64748b' }}
                                                tickLine={false}
                                                axisLine={false}
                                                width={36}
                                            />
                                            <Tooltip
                                                cursor={{ fill: '#f1f5f9' }}
                                                contentStyle={{
                                                    borderRadius: 12,
                                                    border: '1px solid #e2e8f0',
                                                    fontSize: 14,
                                                }}
                                                formatter={(value: number) => [`${value} views`, 'Opened']}
                                            />
                                            <Bar dataKey="views" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={56} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-16 px-4 rounded-xl
                                                bg-slate-50 border border-slate-200">
                                    <BarChart3 className="h-12 w-12 text-blue-300 mb-3" />
                                    <p className="text-[1.25rem] text-slate-500 text-center max-w-md">
                                        Nobody has opened one of your products yet. Each time somebody
                                        outside your company does, it is counted here.
                                    </p>
                                </div>
                            )}
                        </Card>
                    </>
                )}
            </div>
        </BusinessPageShell>
    );
};

export default Analytics;
