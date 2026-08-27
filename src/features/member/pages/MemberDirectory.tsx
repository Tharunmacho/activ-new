import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Building2, Package, Users, X, SlidersHorizontal } from 'lucide-react';
import MemberPageShell from '@/pages/member/MemberPageShell';
import { EmptyState, RowsSkeleton } from '@/features/member/components/MemberUI';
import {
    searchDirectory, listDirectorySectors,
    type DirectoryEntry, type DirectoryFilters,
} from '@/services/memberHubApi';
import { getStates, getDistricts, getBlocks, errorMessage } from '@/services/activApi';
import { resolveMediaUrl } from '@/config/api.config';

/**
 * The member directory (DIR-001).
 *
 * Replaces `/explore`, which loaded the first fifty members the API would
 * return and filtered that array in the browser. Two things were wrong with it:
 * the "search" reached only those fifty rows, so a member in the fifty-first was
 * unfindable by name; and it had no way to ask for a district or a sector at
 * all, because neither can be answered from a page of already-loaded rows.
 *
 * Every filter here is sent to the server and applied against the whole
 * membership. The region dropdowns are fed from `/regions`, the same live tree
 * the registration forms use — never a bundled list, per the admin-first region
 * rule: the regions that exist are the ones the admin database says exist.
 */

const PAGE_SIZE = 20;

const emptyFilters: DirectoryFilters = {
    q: '', state: '', district: '', block: '', sector: '', memberType: '',
};

export default function MemberDirectory() {
    const [filters, setFilters] = useState<DirectoryFilters>(emptyFilters);
    const [page, setPage] = useState(1);

    const [members, setMembers] = useState<DirectoryEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [pages, setPages] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    const [states, setStates] = useState<string[]>([]);
    const [districts, setDistricts] = useState<string[]>([]);
    const [blocks, setBlocks] = useState<string[]>([]);
    const [sectors, setSectors] = useState<string[]>([]);

    /**
     * The search box is debounced; the dropdowns are not.
     *
     * Typing is a stream of intentions and only the last one is meant, so a
     * request per keystroke is six wasted round trips per word. Choosing a
     * district is a single deliberate act, and delaying it by a third of a
     * second only makes the screen feel slow.
     */
    const [term, setTerm] = useState('');

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setFilters((current) => (current.q === term ? current : { ...current, q: term }));
            setPage(1);
        }, 350);

        return () => window.clearTimeout(timer);
    }, [term]);

    // ---------------------------------------------------------------- lookups

    useEffect(() => {
        let cancelled = false;

        Promise.allSettled([getStates(), listDirectorySectors()]).then(([stateResult, sectorResult]) => {
            if (cancelled) return;

            if (stateResult.status === 'fulfilled') {
                setStates((stateResult.value?.states || []).map((s: any) => s.name).filter(Boolean));
            }
            if (sectorResult.status === 'fulfilled') {
                setSectors(sectorResult.value?.sectors || []);
            }
        });

        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        let cancelled = false;

        if (!filters.state) {
            setDistricts([]);
            setBlocks([]);
            return;
        }

        getDistricts(filters.state)
            .then((data) => {
                if (!cancelled) setDistricts((data?.districts || []).map((d: any) => d.name).filter(Boolean));
            })
            .catch(() => { if (!cancelled) setDistricts([]); });

        return () => { cancelled = true; };
    }, [filters.state]);

    useEffect(() => {
        let cancelled = false;

        if (!filters.state || !filters.district) {
            setBlocks([]);
            return;
        }

        getBlocks(filters.state, filters.district)
            .then((data) => {
                if (!cancelled) setBlocks((data?.blocks || []).map((b: any) => b.name).filter(Boolean));
            })
            .catch(() => { if (!cancelled) setBlocks([]); });

        return () => { cancelled = true; };
    }, [filters.state, filters.district]);

    // ---------------------------------------------------------------- search

    /**
     * Guard against an out-of-order response.
     *
     * Two searches in flight can come back in either order, and the slower one
     * arriving last would overwrite the newer results with the older ones. The
     * counter means only the most recent request is allowed to write state —
     * the same reason every effect in this file carries a `cancelled` flag.
     */
    const requestId = useRef(0);

    const runSearch = useCallback(async () => {
        const id = requestId.current + 1;
        requestId.current = id;

        setLoading(true);
        try {
            const data = await searchDirectory({ ...filters, page, limit: PAGE_SIZE });
            if (requestId.current !== id) return;

            setMembers(data?.members || []);
            setTotal(data?.pagination?.total || 0);
            setPages(data?.pagination?.pages || 0);
            setError('');
        } catch (err) {
            if (requestId.current !== id) return;
            setError(errorMessage(err, 'Could not search the directory'));
            setMembers([]);
        } finally {
            if (requestId.current === id) setLoading(false);
        }
    }, [filters, page]);

    useEffect(() => { runSearch(); }, [runSearch]);

    const set = (patch: Partial<DirectoryFilters>) => {
        setFilters((current) => {
            const next = { ...current, ...patch };

            // Clearing the parent has to clear what hangs off it, or a stale
            // district silently filters a search the member thinks is national.
            if (patch.state !== undefined) { next.district = ''; next.block = ''; }
            if (patch.district !== undefined) { next.block = ''; }

            return next;
        });
        setPage(1);
    };

    const activeCount = useMemo(
        () => (['state', 'district', 'block', 'sector', 'memberType'] as const)
            .filter((key) => !!filters[key]).length,
        [filters],
    );

    const clearAll = () => {
        setTerm('');
        setFilters(emptyFilters);
        setPage(1);
    };

    return (
        <MemberPageShell
            title="Member Directory"
            subtitle="Find members and businesses across the association"
            width="standard"
        >
            <div className="space-y-5">
                {/* ---------- search and filters ---------- */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
                    <div className="flex gap-2">
                        <div className="relative flex-1 min-w-0">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="search"
                                value={term}
                                onChange={(e) => setTerm(e.target.value)}
                                placeholder="Search by name or business"
                                className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-200 text-sm
                                           focus:outline-none focus:ring-2 focus:ring-blue-500/30
                                           focus:border-blue-400"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowFilters((open) => !open)}
                            className={`shrink-0 h-11 px-3.5 rounded-xl border text-[13px] font-semibold
                                        inline-flex items-center gap-1.5 transition-colors ${
                                activeCount > 0
                                    ? 'border-blue-400 bg-blue-50 text-blue-700'
                                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <SlidersHorizontal className="w-4 h-4" />
                            <span className="hidden sm:inline">Filters</span>
                            {activeCount > 0 ? (
                                <span className="bg-blue-600 text-white text-[10.5px] font-bold w-4 h-4
                                                 rounded-full flex items-center justify-center">
                                    {activeCount}
                                </span>
                            ) : null}
                        </button>
                    </div>

                    {showFilters ? (
                        /*
                         * An inline expandable panel, not a dialog. The member
                         * area's rule throughout: an in-screen popup is an
                         * expandable card, so the two clients behave the same
                         * way and neither depends on a modal host.
                         */
                        <div className="pt-1 space-y-3">
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                <Select
                                    label="State"
                                    value={filters.state || ''}
                                    options={states}
                                    onChange={(value) => set({ state: value })}
                                />
                                <Select
                                    label="District"
                                    value={filters.district || ''}
                                    options={districts}
                                    onChange={(value) => set({ district: value })}
                                    disabled={!filters.state}
                                    disabledHint="Pick a state first"
                                />
                                <Select
                                    label="Block"
                                    value={filters.block || ''}
                                    options={blocks}
                                    onChange={(value) => set({ block: value })}
                                    disabled={!filters.district}
                                    disabledHint="Pick a district first"
                                />
                                <Select
                                    label="Sector"
                                    value={filters.sector || ''}
                                    options={sectors}
                                    onChange={(value) => set({ sector: value })}
                                />
                            </div>

                            {activeCount > 0 || term ? (
                                <button
                                    type="button"
                                    onClick={clearAll}
                                    className="inline-flex items-center gap-1 text-[12.5px] font-semibold
                                               text-slate-500 hover:text-slate-700"
                                >
                                    <X className="w-3.5 h-3.5" /> Clear all filters
                                </button>
                            ) : null}
                        </div>
                    ) : null}
                </div>

                {/* ---------- results ---------- */}
                {loading ? (
                    <RowsSkeleton rows={4} />
                ) : error ? (
                    <EmptyState
                        icon={<Users className="w-6 h-6" />}
                        title="The directory could not be searched"
                        detail={error}
                    />
                ) : members.length === 0 ? (
                    <EmptyState
                        icon={<Users className="w-6 h-6" />}
                        title="No members found"
                        detail={
                            activeCount > 0 || term
                                ? 'Try widening the filters, or searching for a different name.'
                                : 'Members appear here once their membership is active.'
                        }
                    />
                ) : (
                    <>
                        <p className="text-[12.5px] text-slate-500 px-1">
                            {total} {total === 1 ? 'member' : 'members'}
                            {activeCount > 0 || term ? ' matching' : ''}
                        </p>

                        <div className="grid gap-3 sm:grid-cols-2">
                            {members.map((member) => <DirectoryRow key={member.id} member={member} />)}
                        </div>

                        {pages > 1 ? (
                            <div className="flex items-center justify-between gap-3 pt-1">
                                <button
                                    type="button"
                                    disabled={page <= 1}
                                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                                    className="h-10 px-4 rounded-xl border border-slate-200 text-[13px]
                                               font-semibold text-slate-600 hover:bg-slate-50
                                               disabled:opacity-40 disabled:hover:bg-transparent"
                                >
                                    Previous
                                </button>

                                <span className="text-[12.5px] text-slate-500 tabular-nums">
                                    Page {page} of {pages}
                                </span>

                                <button
                                    type="button"
                                    disabled={page >= pages}
                                    onClick={() => setPage((current) => current + 1)}
                                    className="h-10 px-4 rounded-xl border border-slate-200 text-[13px]
                                               font-semibold text-slate-600 hover:bg-slate-50
                                               disabled:opacity-40 disabled:hover:bg-transparent"
                                >
                                    Next
                                </button>
                            </div>
                        ) : null}
                    </>
                )}
            </div>
        </MemberPageShell>
    );
}

// ---------------------------------------------------------------- row

function DirectoryRow({ member }: { member: DirectoryEntry }) {
    const photo = resolveMediaUrl(member.profilePhoto);
    const where = [member.block, member.district, member.state].filter(Boolean).join(', ');
    const primary = member.companies[0];

    return (
        <Link
            to={`/member/directory/${member.id}`}
            className="group bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex gap-3
                       hover:border-blue-400 hover:shadow-md transition-all"
        >
            {photo ? (
                <img
                    src={photo}
                    alt=""
                    loading="lazy"
                    className="w-12 h-12 rounded-full object-cover shrink-0 ring-2 ring-blue-50"
                />
            ) : (
                <span className="w-12 h-12 rounded-full bg-blue-600 text-white shrink-0
                                 flex items-center justify-center text-sm font-bold">
                    {(member.fullName || '?').split(' ').filter(Boolean).slice(0, 2)
                        .map((part) => part[0]).join('').toUpperCase()}
                </span>
            )}

            <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-bold text-slate-900 truncate
                              group-hover:text-blue-700 transition-colors">
                    {member.fullName}
                </p>

                {primary ? (
                    <p className="text-[12.5px] text-slate-600 truncate flex items-center gap-1.5 mt-0.5">
                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                        {primary.businessName}
                    </p>
                ) : null}

                {where ? (
                    <p className="text-[12px] text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {where}
                    </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {member.sectors.map((sector) => (
                        <span
                            key={sector}
                            className="text-[10.5px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full"
                        >
                            {sector}
                        </span>
                    ))}

                    {member.productCount > 0 ? (
                        <span className="text-[10.5px] text-slate-500 inline-flex items-center gap-1">
                            <Package className="w-3 h-3" />
                            {member.productCount} listed
                        </span>
                    ) : null}
                </div>
            </div>
        </Link>
    );
}

// ---------------------------------------------------------------- select

function Select({
    label,
    value,
    options,
    onChange,
    disabled,
    disabledHint,
}: {
    label: string;
    value: string;
    options: string[];
    onChange: (value: string) => void;
    disabled?: boolean;
    disabledHint?: string;
}) {
    return (
        <label className="block min-w-0">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                {label}
            </span>
            <select
                value={value}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white
                           focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
                           disabled:bg-slate-50 disabled:text-slate-400"
            >
                <option value="">{disabled ? (disabledHint || 'Not available') : `All ${label.toLowerCase()}s`}</option>
                {options.map((option) => (
                    <option key={option} value={option}>{option}</option>
                ))}
            </select>
        </label>
    );
}
