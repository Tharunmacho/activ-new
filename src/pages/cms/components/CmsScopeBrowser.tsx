import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, ExternalLink, MapPin, Plus } from 'lucide-react';
import { CmsButton } from './CmsUI';
import { CARD_TITLE } from '@/components/layout/appTypography';
import { getRegionMap, type RegionMapEntry } from '@/services/cmsRegionsApi';
import { getRegionTree } from '@/services/activApi';

/**
 * ============================================================================
 * CENTRAL · STATES · A STATE — the Regions & States layout, for content
 * ============================================================================
 *
 * The News and Schemes screens list their items the way the Regions & States
 * screen lists pages, so an editor who knows one knows all three:
 *
 *     [ Central | States ]                       tabs
 *     States:  [All] [South] [North] …           region chips
 *              Tamil Nadu   2 state · 2 district   Open
 *     A state: ← All states
 *              Tamil Nadu                         its own screen
 *              State items         + Add
 *              District items      + Add
 *                Coimbatore …
 *
 * WHERE AN ITEM LIVES IS DECIDED BY ITS FIELDS, not by where it was added:
 * `scopeOf` reads the item's own tier / state / district. Adding from a
 * state's screen only PRE-FILLS the state, so an item can never sit on one
 * state's screen while its fields say another.
 *
 * Every state the Regions screen knows is listed — with nothing yet, it says
 * so — plus any state an item names that the region map does not, so a
 * misspelt state is visible here rather than silently lost.
 */

export type ScopeTier = 'national' | 'state' | 'district';
export interface Scope { tier: ScopeTier; state: string; district: string }

export const normRegion = (v?: string | null) => String(v || '').trim().replace(/\s+/g, ' ').toLowerCase();

/** Region-map states and admin-tree districts, for the forms' suggestion lists. */
export function useRegionOptions() {
    const [regionMap, setRegionMap] = useState<RegionMapEntry[]>([]);
    const [tree, setTree] = useState<any[]>([]);

    useEffect(() => {
        getRegionMap().then((rows) => setRegionMap(rows || [])).catch(() => {});
        getRegionTree(false, 'all').then((t) => setTree(t?.states || [])).catch(() => {});
    }, []);

    const stateOptions = useMemo(() => {
        const names = new Map<string, string>();
        regionMap.forEach((r) => (r.states || []).forEach((s) => names.set(normRegion(s.name), s.name)));
        tree.forEach((s: any) => {
            const name = String(s?.name || '');
            if (name && !names.has(normRegion(name))) names.set(normRegion(name), name);
        });
        return [...names.values()].sort((a, b) => a.localeCompare(b));
    }, [regionMap, tree]);

    const districtsOf = (state?: string) => {
        const node = tree.find((s: any) => normRegion(s?.name) === normRegion(state));
        return ((node?.districts || []) as any[])
            .map((d) => String(d?.name || d || '')).filter(Boolean)
            .sort((a, b) => a.localeCompare(b));
    };

    return { regionMap, stateOptions, districtsOf };
}

interface StateRow { name: string; slug: string; regionKey: string; regionLabel: string }

const slugify = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function CmsScopeBrowser<T>({
    view, items, scopeOf, renderRow, onAdd, regionMap,
    nationalLabel, noun, publicHref, openState, onOpenState,
}: {
    view: 'national' | 'states';
    items: T[];
    scopeOf: (item: T) => Scope;
    renderRow: (item: T) => ReactNode;
    onAdd: (prefill: Scope) => void;
    regionMap: RegionMapEntry[];
    /** "Central" for schemes, "National" for news. */
    nationalLabel: string;
    /** "scheme", "article" — lower case, singular. */
    noun: string;
    /** Where a state's items are on the public site, for the Open link. */
    publicHref?: (state: { name: string; slug: string }) => string;
    /*
     * The open state's slug, HELD BY THE PARENT. Opening an item replaces this
     * browser with the item's form; state kept in here would be lost with it,
     * and Back would land on the full list instead of the state the editor
     * was working in.
     */
    openState: string;
    onOpenState: (slug: string) => void;
}) {
    const [regionFilter, setRegionFilter] = useState('');
    const setOpenState = onOpenState;

    const national = items.filter((i) => scopeOf(i).tier === 'national');

    /* Every state: the region map's, then any a stored item names that the map lacks. */
    const states = useMemo<StateRow[]>(() => {
        const out = new Map<string, StateRow>();
        regionMap.filter((r) => !r.national).forEach((r) => (r.states || []).forEach((s) => {
            out.set(normRegion(s.name), { name: s.name, slug: s.slug, regionKey: r.key, regionLabel: r.label });
        }));
        items.forEach((i) => {
            const sc = scopeOf(i);
            if (sc.tier !== 'national' && sc.state && !out.has(normRegion(sc.state))) {
                out.set(normRegion(sc.state), { name: sc.state, slug: slugify(sc.state), regionKey: 'other', regionLabel: 'Not on the region map' });
            }
        });
        return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [regionMap, items, scopeOf]);

    const inState = (name: string) => items.filter((i) => {
        const sc = scopeOf(i);
        return sc.tier !== 'national' && normRegion(sc.state) === normRegion(name);
    });

    const plural = `${noun}s`;
    const count = (n: number, word = noun) => `${n} ${word}${n === 1 ? '' : 's'}`;

    const addButton = (label: string, prefill: Scope) => (
        <CmsButton onClick={() => onAdd(prefill)}>
            <Plus className="h-4 w-4" /> {label}
        </CmsButton>
    );

    const emptyLine = (text: string) => (
        <p className="rounded-xl border border-dashed border-slate-300 p-5 text-[1.1875rem] text-slate-400 dark:border-[#2a2a2a]">
            {text}
        </p>
    );

    /* ------------------------------------------------------ national tab */
    if (view === 'national') {
        return (
            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[1.125rem] text-slate-500 dark:text-neutral-400">
                        {nationalLabel} {plural} appear for everybody, in every state.
                    </p>
                    {addButton(`New ${nationalLabel.toLowerCase()} ${noun}`, { tier: 'national', state: '', district: '' })}
                </div>
                {national.length ? <div className="space-y-3">{national.map(renderRow)}</div>
                    : emptyLine(`No ${nationalLabel.toLowerCase()} ${plural} yet.`)}
            </div>
        );
    }

    /* ----------------------------------------------------- one state open */
    const current = states.find((s) => s.slug === openState);
    if (current) {
        const rows = inState(current.name);
        const own = rows.filter((i) => scopeOf(i).tier === 'state');
        const groups = new Map<string, { name: string; rows: T[] }>();
        rows.filter((i) => scopeOf(i).tier === 'district').forEach((i) => {
            const d = scopeOf(i).district;
            const key = normRegion(d) || 'none';
            const g = groups.get(key) || { name: d || 'No district set', rows: [] };
            g.rows.push(i);
            groups.set(key, g);
        });
        const districtGroups = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));

        return (
            <div className="space-y-8">
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setOpenState('')}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3.5 py-2 text-[1.0625rem]
                                   font-semibold text-slate-600 transition-colors hover:border-[#2563EB] hover:text-[#2563EB]
                                   dark:border-[#2a2a2a] dark:text-neutral-300"
                    >
                        <ArrowLeft className="h-4 w-4" /> All states
                    </button>
                    <div className="min-w-0 flex-1">
                        <p className="text-[1.5rem] font-bold text-slate-900 dark:text-white">{current.name}</p>
                        <p className="text-[1.0625rem] text-slate-500 dark:text-neutral-400">{current.regionLabel}</p>
                    </div>
                    {publicHref && rows.length > 0 && (
                        <a href={publicHref(current)} target="_blank" rel="noopener noreferrer"
                           className="inline-flex items-center gap-1.5 text-[1.0625rem] font-semibold text-blue-700 dark:text-blue-400">
                            View on the site <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                    )}
                </div>

                <section className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className={`${CARD_TITLE} text-slate-900 dark:text-white`}>State {plural}</h3>
                        {addButton(`Add a state ${noun}`, { tier: 'state', state: current.name, district: '' })}
                    </div>
                    {own.length ? own.map(renderRow) : emptyLine(`No ${current.name} state ${plural} yet.`)}
                </section>

                <section className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className={`${CARD_TITLE} text-slate-900 dark:text-white`}>District {plural}</h3>
                        {addButton(`Add a district ${noun}`, { tier: 'district', state: current.name, district: '' })}
                    </div>
                    {districtGroups.length ? districtGroups.map((g) => (
                        <div key={g.name} className="space-y-3">
                            <p className="pt-2 text-[1rem] font-bold uppercase tracking-[0.14em] text-slate-500">{g.name}</p>
                            {g.rows.map(renderRow)}
                        </div>
                    )) : emptyLine(`No district ${plural} in ${current.name} yet.`)}
                </section>
            </div>
        );
    }

    /* ------------------------------------------------------ states list */
    const regions = regionMap.filter((r) => !r.national);
    const shown = states.filter((s) => !regionFilter || s.regionKey === regionFilter);

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2 pb-2">
                {[{ key: '', label: 'All regions', n: states.length }]
                    .concat(regions.map((r) => ({ key: r.key, label: r.label, n: states.filter((s) => s.regionKey === r.key).length })))
                    .concat(states.some((s) => s.regionKey === 'other')
                        ? [{ key: 'other', label: 'Not on the map', n: states.filter((s) => s.regionKey === 'other').length }] : [])
                    .map((chip) => (
                        <button
                            key={chip.key || 'all'}
                            type="button"
                            onClick={() => setRegionFilter(chip.key)}
                            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[1.1875rem] font-semibold transition-colors ${regionFilter === chip.key
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-[#141414] dark:text-neutral-300'}`}
                        >
                            {chip.label}
                            <span className={regionFilter === chip.key ? 'text-white/70' : 'text-slate-400'}>{chip.n}</span>
                        </button>
                    ))}
            </div>

            {shown.map((st) => {
                const rows = inState(st.name);
                const own = rows.filter((i) => scopeOf(i).tier === 'state').length;
                const district = rows.length - own;
                return (
                    <div key={st.slug}
                         className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3.5
                                    transition-colors hover:border-slate-300 dark:border-[#2a2a2a] dark:bg-[#111]">
                        <MapPin className={`h-4 w-4 shrink-0 ${rows.length ? 'text-blue-600' : 'text-slate-300'}`} />
                        <button type="button" onClick={() => setOpenState(st.slug)} className="min-w-0 flex-1 text-left">
                            <p className="text-[1.25rem] font-bold text-slate-900 dark:text-neutral-100">{st.name}</p>
                            <p className="mt-0.5 text-[1.0625rem] font-medium text-slate-500 dark:text-neutral-400">
                                {rows.length
                                    ? `${count(own, `state ${noun}`)} · ${count(district, `district ${noun}`)}`
                                    : `No ${plural} yet`}
                                {' · '}{st.regionLabel}
                            </p>
                        </button>
                        <button
                            type="button"
                            onClick={() => setOpenState(st.slug)}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[1.0625rem]
                                       font-semibold text-[#2563EB] transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/30"
                        >
                            Open
                        </button>
                    </div>
                );
            })}
            {!shown.length && emptyLine('No states here.')}
        </div>
    );
}
