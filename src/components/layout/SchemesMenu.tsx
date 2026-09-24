import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Landmark, MapPin } from 'lucide-react';
import { getRegionMap, type RegionMapEntry } from '@/services/cmsRegionsApi';
import { getSchemeStateCounts, normRegion, type SchemeStateCount } from '@/services/cmsSchemesApi';

/**
 * ============================================================================
 * THE SCHEMES MENU — the header's way into /schemes
 * ============================================================================
 *
 * The same two-column flyout as the Regions menu beside it, on purpose: a
 * visitor who has used one has already learned the other. Its left column is
 * only Central and States — a scheme is central or it belongs to a state, and
 * sorting the states by region first was a step nobody asked to take.
 *
 *     Central     >  |  All central schemes
 *     States      >  |  Karnataka
 *                    |  Tamil Nadu           (only states with schemes, A to Z)
 *
 * It replaces a landing page of two cards and a grid of thirty-six states.
 * That page was a menu drawn as a page — a click to arrive, a click to choose,
 * a click to choose again — and the header can do the choosing in one move.
 *
 * A state is listed once it holds a published scheme, whether or not it has
 * a region page — a scheme page does not depend on the Regions screen. No
 * count is printed beside it: the menu is for choosing, not for statistics.
 *
 * Built from the region map (which states exist) and the scheme counts. If
 * either call fails the menu still draws what it can: without counts the
 * states are simply unnumbered, and Central always works.
 */

const useSchemeMenuData = () => {
    const [regions, setRegions] = useState<RegionMapEntry[]>([]);
    const [counts, setCounts] = useState<SchemeStateCount[]>([]);

    useEffect(() => {
        let cancelled = false;
        getRegionMap().then((rows) => { if (!cancelled) setRegions(rows || []); }).catch(() => {});
        getSchemeStateCounts().then((rows) => { if (!cancelled) setCounts(rows || []); }).catch(() => {});
        return () => { cancelled = true; };
    }, []);

    const byState = useMemo(
        () => new Map(counts.map((c) => [normRegion(c.state), c.total])),
        [counts],
    );
    /*
     * ONLY THE STATES THAT HAVE SCHEMES, alphabetically.
     *
     * Listing all thirty-six put a column of greyed-out names in front of the
     * two or three a reader could actually open. The slug comes from the
     * region map where the state is on it; a scheme filed under a state the
     * map does not name still gets a row, with a slug made from its name.
     */
    const states = useMemo(() => {
        const slugs = new Map<string, string>();
        regions.forEach((r) => (r.states || []).forEach((s) => slugs.set(normRegion(s.name), s.slug)));
        const slugify = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        return counts
            .filter((c) => c.total > 0 && c.state)
            .map((c) => ({ name: c.state, slug: slugs.get(normRegion(c.state)) || slugify(c.state) }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [regions, counts]);

    return { states, countOf: (name: string) => byState.get(normRegion(name)) || 0 };
};

const stateHref = (slug: string) => `/schemes/state/${slug}`;

export function SchemesMenu({ accent, label, active }: { accent: string; label: string; active: boolean }) {
    const { states, countOf } = useSchemeMenuData();
    const [open, setOpen] = useState(false);
    /* Which row's contents the right column shows. */
    const [current, setCurrent] = useState<'central' | 'states'>('central');
    const holder = useRef<HTMLDivElement | null>(null);
    const trigger = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e: MouseEvent) => {
            if (holder.current && !holder.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            setOpen(false);
            trigger.current?.focus();
        };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const row = (on: boolean) => `flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left
        text-[1.0625rem] font-bold transition-colors ${on ? 'bg-brand-50 text-brand-800' : 'text-brand-700 hover:bg-brand-50/60'}`;

    return (
        <div ref={holder} className="relative">
            <button
                ref={trigger}
                type="button"
                aria-haspopup="true"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                /* The same box as the plain links beside it — see `HeaderSection`:
                   the 2px rule is always drawn, transparent unless this page is
                   under /schemes, so the row does not shift between pages. */
                className={`whitespace-nowrap text-[1.0625rem] pt-1.5 pb-1 border-b-2 transition inline-flex
                            items-center gap-1.5 ${active || open ? 'font-semibold' : 'font-medium opacity-70 hover:opacity-100'}`}
                style={{ color: accent, borderColor: active ? accent : 'transparent' }}
            >
                {label}
                <ChevronDown size={14} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>

            {open && (
                <div className="absolute left-1/2 top-[calc(100%+0.75rem)] z-50 flex -translate-x-1/2 overflow-hidden
                                rounded-2xl border border-gray-200 bg-white shadow-[0_18px_50px_-18px_rgba(28,46,104,0.45)]">
                    {/* ---- central, then states ---- */}
                    <ul className="w-48 border-r border-gray-100 py-2">
                        <li className="mb-1 border-b border-gray-100 pb-1">
                            <Link
                                to="/schemes/central"
                                onMouseEnter={() => setCurrent('central')}
                                onFocus={() => setCurrent('central')}
                                onClick={() => setOpen(false)}
                                className={`${row(current === 'central')} font-extrabold`}
                            >
                                <span className="inline-flex items-center gap-2">
                                    <Landmark size={15} className="shrink-0 text-brand-500" /> Central
                                </span>
                                <ChevronRight size={14} className="text-gray-400" />
                            </Link>
                        </li>
                        <li>
                            <button
                                type="button"
                                onMouseEnter={() => setCurrent('states')}
                                onFocus={() => setCurrent('states')}
                                onClick={() => setCurrent('states')}
                                className={row(current === 'states')}
                            >
                                <span className="inline-flex items-center gap-2">
                                    <MapPin size={15} className="shrink-0 text-brand-500" /> States
                                </span>
                                <ChevronRight size={14} className="text-gray-400" />
                            </button>
                        </li>
                    </ul>

                    {/* ---- what is inside it ---- */}
                    <div className="max-h-[26rem] w-64 overflow-y-auto py-2">
                        <p className="px-4 pb-2 text-[1rem] font-bold uppercase tracking-wider text-gray-400">
                            {current === 'central' ? 'Government of India' : 'States with schemes'}
                        </p>

                        {current === 'central' ? (
                            <Link
                                to="/schemes/central"
                                onClick={() => setOpen(false)}
                                className="block px-4 py-2.5 text-[1.0625rem] font-semibold text-brand-700
                                           transition-colors hover:bg-brand-50/60"
                            >
                                All central schemes
                            </Link>
                        ) : states.length === 0 ? (
                            <p className="px-4 py-2.5 text-[1.0625rem] font-semibold text-gray-400">
                                No state schemes yet.
                            </p>
                        ) : (
                            <ul>
                                {states.map((s) => {
                                    const n = countOf(s.name);
                                    return (
                                        <li key={s.slug || s.name}>
                                            <Link
                                                to={stateHref(s.slug)}
                                                onClick={() => setOpen(false)}
                                                className={`flex items-center justify-between gap-3 px-4 py-2.5 text-[1.0625rem]
                                                            font-semibold transition-colors hover:bg-brand-50/60 ${n ? 'text-brand-700' : 'text-gray-400'}`}
                                            >
                                                <span className="truncate">{s.name}</span>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * The same menu for the phone drawer, as an accordion — a flyout's first tap
 * on a touch screen is a hover, which is the reason `RegionsAccordion` exists.
 */
export function SchemesAccordion({ accent, label, onNavigate }: {
    accent: string;
    label: string;
    onNavigate: () => void;
}) {
    const { states, countOf } = useSchemeMenuData();
    const [open, setOpen] = useState(false);
    const [statesOpen, setStatesOpen] = useState(false);

    return (
        <div>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[1.0625rem]
                           font-medium transition-colors hover:bg-black/5"
                style={{ color: accent }}
            >
                {label}
                <ChevronDown size={14} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>

            {open && (
                <div className="pb-2 pl-6 pr-3">
                    <Link
                        to="/schemes/central"
                        onClick={onNavigate}
                        className="flex items-center gap-2 border-b border-gray-100 py-2.5 text-[1.0625rem] font-extrabold"
                        style={{ color: accent }}
                    >
                        <Landmark size={15} className="shrink-0 opacity-60" /> Central schemes
                    </Link>
                    <button
                        type="button"
                        onClick={() => setStatesOpen((v) => !v)}
                        aria-expanded={statesOpen}
                        className="flex w-full items-center justify-between py-2.5 text-left text-[1.0625rem] font-bold"
                        style={{ color: accent }}
                    >
                        <span className="inline-flex items-center gap-2">
                            <MapPin size={15} className="shrink-0 opacity-60" /> States
                        </span>
                        <ChevronDown size={14} className={statesOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
                    </button>
                    {statesOpen && states.length === 0 && (
                        <p className="pb-2 pl-3 text-[1.0625rem] font-semibold text-gray-400">No state schemes yet.</p>
                    )}
                    {statesOpen && states.length > 0 && (
                        <div className="space-y-1 pb-2 pl-3">
                            {states.map((st) => {
                                const n = countOf(st.name);
                                return (
                                    <Link
                                        key={st.slug || st.name}
                                        to={stateHref(st.slug)}
                                        onClick={onNavigate}
                                        className={`flex items-center justify-between py-2 text-[1.0625rem] font-semibold
                                                    ${n ? 'text-gray-700' : 'text-gray-400'}`}
                                    >
                                        {st.name}
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default SchemesMenu;
