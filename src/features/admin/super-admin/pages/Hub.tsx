import { useEffect, useState } from 'react';
import {
    Menu, ChevronRight, ArrowLeft, Loader2, MapPin, Map, Globe,
    Users, Search, AlertTriangle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import { apiFetch, getSuperOverview } from '@/services/activApi';

/**
 * The Hub: every application on the platform, reached by drilling down through
 * the geography that owns it.
 *
 *     tiers  →  regions in that tier  →  that region's applications
 *
 * This replaces a flat stat panel with a "Recent Activity" table that was empty
 * on every load. Four numbers told a super admin how much work existed and
 * nothing about where it was — the drill-down is what makes a platform of 405
 * blocks navigable, because it answers "which region is stuck" rather than
 * "how many are pending".
 *
 * All three levels live in one screen, so stepping back is instant and never
 * refetches a level already loaded.
 */

type Tier = 'block' | 'district' | 'state';
type Level = 'tiers' | 'regions' | 'applications';
type Status = 'all' | 'pending' | 'approved' | 'rejected';

const TIERS: { key: Tier; title: string; plural: string; icon: typeof MapPin; accent: string }[] = [
    { key: 'block', title: 'Block', plural: 'Blocks', icon: MapPin, accent: 'text-purple-600 bg-purple-50' },
    { key: 'district', title: 'District', plural: 'Districts', icon: Map, accent: 'text-amber-600 bg-amber-50' },
    { key: 'state', title: 'State', plural: 'States', icon: Globe, accent: 'text-green-600 bg-green-50' },
];

const STATUSES: Status[] = ['all', 'pending', 'approved', 'rejected'];

interface Region {
    id: string;
    name: string;
    state: string;
    district: string;
    block: string;
    admins: number;
    applications: number;
    pending: number;
    approved: number;
    rejected: number;
}

export default function Hub() {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const [level, setLevel] = useState<Level>('tiers');
    const [tier, setTier] = useState<Tier>('block');
    const [region, setRegion] = useState<Region | null>(null);
    const [status, setStatus] = useState<Status>('all');

    const [overview, setOverview] = useState<any>(null);
    const [regions, setRegions] = useState<Region[]>([]);
    const [applicants, setApplicants] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState('');

    const [overviewFailed, setOverviewFailed] = useState(false);

    useEffect(() => {
        getSuperOverview()
            .then((data) => {
                setOverview(data);
                // An empty object means the request resolved with nothing usable.
                // Saying so beats rendering four confident zeros.
                setOverviewFailed(!data || !data.stats);
            })
            .catch(() => { setOverview(null); setOverviewFailed(true); });
    }, []);

    /**
     * The response nests: `data.stats` for the platform, `data.tierStats` for the
     * per-level breakdown. Reading these off the root is what made every figure
     * read zero.
     */
    const platform = overview?.stats || {};
    const tierStats: Record<string, any> = overview?.tierStats || {};

    const openTier = async (t: Tier) => {
        setTier(t);
        setLevel('regions');
        setLoading(true);
        try {
            const res = await apiFetch(`/admin/super/directory?level=${t}`);
            const data = res.ok ? (await res.json()).data : {};
            setRegions(data.regions || []);
        } catch {
            setRegions([]);
        } finally {
            setLoading(false);
        }
    };

    const openRegion = async (r: Region, nextStatus: Status = status) => {
        setRegion(r);
        setStatus(nextStatus);
        setLevel('applications');
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: '50' });
            // Only the fields this tier actually names — sending an empty block
            // would filter to applications whose block is literally ''.
            if (r.state) params.set('state', r.state);
            if (r.district) params.set('district', r.district);
            if (r.block) params.set('block', r.block);
            if (nextStatus !== 'all') params.set('status', nextStatus);

            const res = await apiFetch(`/admin/super/applications?${params}`);
            const data = res.ok ? (await res.json()).data : {};
            setApplicants(data.applicants || []);
        } catch {
            setApplicants([]);
        } finally {
            setLoading(false);
        }
    };

    const back = () => {
        if (level === 'applications') { setLevel('regions'); setRegion(null); }
        else if (level === 'regions') { setLevel('tiers'); setRegions([]); }
    };

    const visibleRegions = query.trim().length >= 2
        ? regions.filter(r => `${r.name} ${r.state} ${r.district} ${r.block}`
            .toLowerCase().includes(query.trim().toLowerCase()))
        : regions;

    const stat = (label: string, value: number | string, tone = 'bg-gray-50 text-gray-900') => (
        <div className={`rounded-xl p-5 ${tone}`}>
            <p className="text-3xl font-bold">{value ?? 0}</p>
            <p className="text-sm opacity-70 mt-1">{label}</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 flex">
            <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 min-w-0">
                <header className="bg-white border-b px-6 py-4 flex items-center gap-3">
                    <button className="lg:hidden text-gray-600" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
                        <Menu className="w-5 h-5" />
                    </button>

                    {level !== 'tiers' && (
                        <button onClick={back} className="text-gray-600 hover:text-gray-900" aria-label="Back">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}

                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold text-gray-900 truncate">
                            {level === 'tiers' && 'Hub'}
                            {level === 'regions' && `${TIERS.find(t => t.key === tier)?.plural}`}
                            {level === 'applications' && (region?.name || 'Applications')}
                        </h1>
                        <p className="text-sm text-gray-600 mt-0.5">
                            {level === 'tiers' && 'Browse applications by the region that owns them.'}
                            {level === 'regions' && 'Pick a region to see its applications.'}
                            {level === 'applications' && [region?.block, region?.district, region?.state]
                                .filter(Boolean).join(', ')}
                        </p>
                    </div>
                </header>

                <main className="p-6 space-y-5">
                    {/* ------------------------------------------------ tiers */}
                    {level === 'tiers' && (
                        <>
                            {overviewFailed && (
                                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200
                                                rounded-lg p-4">
                                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                    <p className="text-sm text-amber-900">
                                        The overview could not be loaded, so the figures below are not
                                        current. The drill-down still works.
                                    </p>
                                </div>
                            )}

                            {/* Platform totals, from `data.stats`. */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {stat('Total members', platform.totalMembers, 'bg-blue-600 text-white')}
                                {stat('Pending', platform.pendingApplications, 'bg-purple-600 text-white')}
                                {stat('Approved', platform.approvedApplications, 'bg-teal-600 text-white')}
                                {stat('Rejected', platform.rejectedApplications, 'bg-indigo-600 text-white')}
                            </div>

                            {/*
                              * One card per tier, each carrying its own four figures.
                              *
                              * This is what mobile shows and what the flat row above
                              * cannot: the same application counts differently at each
                              * level, because a file approved by the block is still
                              * pending for the district. One "pending" number for the
                              * whole platform answers no question a super admin has.
                              *
                              * The card IS the drill-down, as on mobile — the numbers
                              * and the way in are the same control.
                              */}
                            <div className="grid gap-4 md:grid-cols-3">
                                {TIERS.map(({ key, title, icon: Icon, accent }) => {
                                    const t = tierStats[key] || {};
                                    const figures = [
                                        { label: 'Total Members', value: t.total, tone: 'text-gray-900' },
                                        { label: 'Pending', value: t.pending, tone: 'text-amber-600' },
                                        { label: 'Approved', value: t.approved, tone: 'text-green-600' },
                                        { label: 'Rejected', value: t.rejected, tone: 'text-red-600' },
                                    ];

                                    return (
                                        <button
                                            key={key}
                                            onClick={() => openTier(key)}
                                            className="bg-white rounded-xl border text-left hover:shadow-md
                                                       transition-shadow overflow-hidden"
                                        >
                                            <div className="flex items-center gap-3 px-5 py-4 border-b">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent}`}>
                                                    <Icon className="w-5 h-5" />
                                                </div>
                                                <p className="font-semibold text-gray-900 flex-1">{title} Level</p>
                                                <ChevronRight className="w-5 h-5 text-gray-400" />
                                            </div>

                                            <div className="grid grid-cols-2 bg-gray-50/60">
                                                {figures.map((f, i) => (
                                                    <div
                                                        key={f.label}
                                                        className={`p-4 ${i < 2 ? 'border-b' : ''} ${i % 2 === 0 ? 'border-r' : ''}`}
                                                    >
                                                        <p className={`text-xl font-extrabold ${f.tone}`}>
                                                            {Number(f.value || 0)}
                                                        </p>
                                                        <p className="text-xs font-semibold text-gray-500 mt-0.5">
                                                            {f.label}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            <button
                                onClick={() => navigate('/super-admin/admins')}
                                className="w-full bg-white rounded-xl border p-6 text-left hover:shadow-md
                                           transition-shadow flex items-center justify-between"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                        <Users className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900">Staff a region</p>
                                        <p className="text-sm text-gray-500">
                                            Adding a block admin is what opens a region for registration.
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-gray-400" />
                            </button>
                        </>
                    )}

                    {/* ---------------------------------------------- regions */}
                    {level === 'regions' && (
                        <>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Filter regions"
                                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm
                                               focus:outline-none focus:ring-2 focus:ring-blue-600"
                                />
                            </div>

                            {loading ? (
                                <Busy />
                            ) : visibleRegions.length === 0 ? (
                                <Empty text="No regions at this level yet." />
                            ) : (
                                <div className="bg-white rounded-xl border divide-y">
                                    {visibleRegions.map(r => (
                                        <button
                                            key={r.id || r.name}
                                            onClick={() => openRegion(r)}
                                            className="w-full px-5 py-4 flex items-center justify-between
                                                       hover:bg-gray-50 text-left"
                                        >
                                            <div className="min-w-0">
                                                <p className="font-medium text-gray-900">{r.name}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    {[r.district, r.state].filter(Boolean).join(', ') || '—'}
                                                    {/* An unstaffed region is the one worth chasing:
                                                        its applications escalate to the tier above. */}
                                                    {r.admins === 0 && (
                                                        <span className="ml-2 text-amber-600">no admin</span>
                                                    )}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-4 shrink-0">
                                                <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                                                    {r.pending} pending
                                                </span>
                                                <span className="text-xs text-gray-500">{r.applications} total</span>
                                                <ChevronRight className="w-4 h-4 text-gray-400" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* ----------------------------------------- applications */}
                    {level === 'applications' && (
                        <>
                            <div className="flex gap-2">
                                {STATUSES.map(s => (
                                    <button
                                        key={s}
                                        onClick={() => region && openRegion(region, s)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                                            status === s
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>

                            {loading ? (
                                <Busy />
                            ) : applicants.length === 0 ? (
                                <Empty text={`No ${status === 'all' ? '' : status + ' '}applications in this region.`} />
                            ) : (
                                <div className="bg-white rounded-xl border divide-y">
                                    {applicants.map((a: any) => (
                                        <div key={a._id || a.id} className="px-5 py-4 flex items-center justify-between gap-4">
                                            <div className="min-w-0">
                                                <p className="font-medium text-gray-900 truncate">
                                                    {a.fullName || a.email || 'Applicant'}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-0.5 truncate">
                                                    {a.email}{a.phone ? ` · ${a.phone}` : ''}
                                                </p>
                                            </div>
                                            <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 shrink-0">
                                                {a.status || '—'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </main>
            </div>
        </div>
    );
}

const Busy = () => (
    <div className="flex items-center justify-center gap-3 py-16 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading…
    </div>
);

const Empty = ({ text }: { text: string }) => (
    <p className="text-center text-gray-500 py-16">{text}</p>
);
