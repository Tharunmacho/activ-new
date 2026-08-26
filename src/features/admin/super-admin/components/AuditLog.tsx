import { useEffect, useState } from 'react';
import { Loader2, ShieldAlert, Search } from 'lucide-react';
import { apiFetch } from '@/services/activApi';

/**
 * The audit stream — who did what, across the whole platform.
 *
 * Mobile's `SystemScreen` carries this beside the profile card; the website's
 * Settings page had a "Security & Privacy" heading and no audit log at all,
 * which is the wrong way round: the heading promises oversight and the record
 * that provides it was the missing part.
 *
 * Paged rather than scrolled to the end. The stream grows for the life of the
 * platform, and a screen that loads all of it gets slower every week.
 */

interface Entry {
    id: string;
    action: string;
    summary: string;
    category: string;
    actorName: string;
    actorEmail: string;
    actorRoleLabel: string;
    targetLabel: string;
    location: string;
    proxy: boolean;
    createdAt: string;
}

const PAGE = 25;

const when = (iso: string) => {
    const d = new Date(iso);
    // The time matters here, not just the day: two approvals a minute apart is
    // a different story from two on the same afternoon.
    return Number.isNaN(d.getTime())
        ? ''
        : d.toLocaleString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
};

export default function AuditLog() {
    const [entries, setEntries] = useState<Entry[]>([]);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [page, setPage] = useState(1);
    const [more, setMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('all');

    const load = async (nextPage: number, replace: boolean) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(nextPage), limit: String(PAGE) });
            if (category !== 'all') params.set('category', category);
            if (query.trim().length >= 2) params.set('q', query.trim());

            const res = await apiFetch(`/audit?${params}`);
            const body = res.ok ? await res.json() : {};
            const data = body.data || {};
            const rows: Entry[] = data.entries || [];

            setEntries(replace ? rows : [...entries, ...rows]);
            // A short page means the end; asking again would return nothing.
            setMore(rows.length === PAGE);
            setPage(nextPage);

            if (nextPage === 1) {
                const c = await apiFetch('/audit/counts');
                if (c.ok) setCounts(((await c.json()).data) || {});
            }
        } catch {
            // An audit log that fails to load must not take the settings page
            // with it — the profile card beside it still works.
            if (replace) setEntries([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(1, true); }, [category]);

    useEffect(() => {
        const t = setTimeout(() => load(1, true), 350);
        return () => clearTimeout(t);
    }, [query]);

    /**
     * The four categories the server actually records.
     *
     * Checked against `/audit/counts`, which answers exactly these keys. A
     * previous "Sign-ins" chip filtered on `auth` — a category no row carries —
     * so it would have shown an empty list for ever and looked like a quiet
     * platform rather than a wrong query.
     */
    const categories = [
        { key: 'all', label: 'All' },
        { key: 'application', label: 'Apps' },
        { key: 'admin', label: 'Admins' },
        { key: 'event', label: 'Events' },
    ];

    return (
        <div className="bg-white rounded-xl border">
            <header className="px-6 py-5 border-b">
                <h2 className="text-lg font-bold text-gray-900">Audit log</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                    {counts.all !== undefined
                        ? `${counts.all} recorded action(s) — every approval, rejection and admin change.`
                        : 'Every approval, rejection and admin change, with who did it.'}
                </p>
            </header>

            <div className="px-6 py-4 border-b flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Who did what — name, email or applicant"
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm
                                   focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                </div>

                <div className="flex gap-2">
                    {categories.map(c => (
                        <button
                            key={c.key}
                            onClick={() => setCategory(c.key)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                category === c.key
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            {c.label}
                            {counts[c.key] !== undefined && c.key !== 'all' && (
                                <span className="ml-1.5 opacity-70">{counts[c.key]}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="divide-y max-h-[520px] overflow-y-auto">
                {entries.length === 0 && !loading ? (
                    <p className="text-center text-gray-500 py-12">
                        {query || category !== 'all' ? 'Nothing matches that filter.' : 'No activity recorded yet.'}
                    </p>
                ) : (
                    entries.map(e => (
                        <div key={e.id} className="px-6 py-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <p className="text-sm text-gray-900">{e.summary || e.action}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {e.actorName || e.actorEmail}
                                        {e.actorRoleLabel && ` · ${e.actorRoleLabel}`}
                                        {e.location && ` · ${e.location}`}
                                    </p>
                                </div>

                                <div className="text-right shrink-0">
                                    <p className="text-xs text-gray-400 whitespace-nowrap">{when(e.createdAt)}</p>
                                    {/* A super admin acting on a tier's behalf is worth
                                        marking: the decision was not the region's own. */}
                                    {e.proxy && (
                                        <span className="inline-flex items-center gap-1 mt-1 text-[10px]
                                                         bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                                            <ShieldAlert className="w-3 h-3" /> proxy
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {(more || loading) && (
                <div className="px-6 py-4 border-t">
                    <button
                        onClick={() => load(page + 1, false)}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg
                                   border border-gray-200 text-sm font-medium disabled:opacity-60"
                    >
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {loading ? 'Loading…' : 'Load more'}
                    </button>
                </div>
            )}
        </div>
    );
}
