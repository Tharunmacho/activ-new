import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Globe2 } from 'lucide-react';
import { getRegionMap, type RegionMapEntry } from '@/services/cmsRegionsApi';

/**
 * The Regions menu in the header.
 *
 * =========================================================================
 * BUILT FROM THE API, NEVER FROM A LIST IN THIS FILE
 * =========================================================================
 *
 * `GET /cms/regions/map` says which regions exist, which states sit under each,
 * and which of them have a published page. Publishing a state page therefore
 * puts it in this menu with no deploy — which is the whole point of a CMS, and
 * the thing a hardcoded array would quietly take away.
 *
 * It also means the menu cannot offer a page the API will not serve: a state
 * with no published page is NOT LISTED, and a region with none is shown but is
 * not a link. A link to a 404 is worse than an absent link, because the visitor
 * concludes the site is broken rather than that the page is unwritten.
 *
 * --------------------------------------------------------------- behaviour
 *
 * Desktop: the trigger opens a panel of regions; hovering or focusing one
 * reveals its states in a second column. Escape closes and returns focus to the
 * trigger, and a click outside closes — both, because a menu dismissable only
 * by pointer is a keyboard trap.
 *
 * Touch and narrow screens get the accordion in `RegionsAccordion` instead: a
 * hover flyout on a phone opens on the tap that was meant to navigate.
 */

const useRegionMap = () => {
    const [regions, setRegions] = useState<RegionMapEntry[]>([]);

    useEffect(() => {
        let cancelled = false;
        getRegionMap()
            .then((rows) => { if (!cancelled) setRegions(rows || []); })
            /* Silent: the header must render with or without this. A failed
               menu call must never take the rest of the site's navigation
               down with it. */
            .catch(() => { /* the menu is simply not drawn */ });
        return () => { cancelled = true; };
    }, []);

    return regions;
};

/**
 * ==========================================================================
 * THE TWO COLUMNS ARE BACK. INDIA IS THE ROW ABOVE THE FIVE.
 * ==========================================================================
 *
 * This was briefly rebuilt as an accordion to make room for the national
 * page. It did not need rebuilding: the panel already has a column for "the
 * thing" and a column for "what is inside it", and the country is simply one
 * more thing with something inside it.
 *
 * INDIA’S RIGHT-HAND COLUMN IS THE FIVE REGIONS, not a list of states and not
 * an empty box. A region contains its states; the country contains the
 * regions. Listing all thirty-six states under India would repeat every state
 * in the menu twice and say nothing true about the association’s structure —
 * a state belongs to its region, and the region belongs to the country.
 *
 * The row itself still links to the national page, exactly as a region row
 * links to its region page, so the tier is reachable and not merely a heading
 * over other people’s links.
 *
 * --------------------------------------------------------------- behaviour
 *
 * Desktop: the trigger opens a panel of regions; hovering or focusing one
 * reveals its contents in the second column. Escape closes and returns focus
 * to the trigger, and a click outside closes — both, because a menu
 * dismissable only by pointer is a keyboard trap.
 *
 * Touch and narrow screens get the accordion in `RegionsAccordion` instead: a
 * hover flyout on a phone opens on the tap that was meant to navigate.
 */
export function RegionsMenu({ accent }: { accent: string }) {
    const regions = useRegionMap();
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState<string>('');
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

    /* Nothing to show is nothing to draw — not an empty dropdown. */
    if (!regions.length) return null;

    const current = regions.find((r) => r.key === active) || regions[0];
    const linkableStates = (current?.states || []).filter((s) => s.hasPage);

    /* What the right column holds for the row being hovered. India has the
       five regions under it; everything else has its own states. */
    const underNational = regions.filter((r) => !r.national && r.hasPage);

    return (
        <div ref={holder} className="relative">
            <button
                ref={trigger}
                type="button"
                aria-haspopup="true"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                /* 1.0625rem, because this sits IN the nav row beside About,
                   Events and Gallery — see `HeaderSection`. It was left at the
                   old 0.9375rem when those were raised, and one link a step
                   smaller than its neighbours is the first thing the eye finds
                   in a row of six. */
                className={`text-[1.0625rem] pt-1.5 pb-1 border-b-2 border-transparent transition
                            inline-flex items-center gap-1.5 ${
                    open ? 'font-semibold' : 'font-medium opacity-70 hover:opacity-100'
                }`}
                style={{ color: accent }}
            >
                Regions
                <ChevronDown size={14} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>

            {open && (
                <div
                    className="absolute right-0 top-[calc(100%+0.75rem)] z-50 flex overflow-hidden
                               rounded-2xl border border-gray-200 bg-white
                               shadow-[0_18px_50px_-18px_rgba(28,46,104,0.45)]"
                >
                    {/* ---- the regions ---- */}
                    <ul className="w-44 py-2 border-r border-gray-100">
                        {regions.map((region) => {
                            /* The national row is hidden until its page exists.
                               Drawn as a dead row it would be a tier the visitor
                               can see and cannot reach, which reads as broken
                               rather than as unwritten. */
                            if (region.national && !region.hasPage) return null;

                            const on = region.key === current?.key;
                            return (
                                <li
                                    key={region.key}
                                    className={region.national ? 'border-b border-gray-100 pb-1 mb-1' : ''}
                                >
                                    {/*
                                      * The row is a LINK when the region has a
                                      * page and a plain button when it does not
                                      * — either way it reveals what is under it,
                                      * because that is the reason most people
                                      * open this menu.
                                      */}
                                    {region.hasPage ? (
                                        <Link
                                            to={`/regions/${region.slug}`}
                                            onMouseEnter={() => setActive(region.key)}
                                            onFocus={() => setActive(region.key)}
                                            onClick={() => setOpen(false)}
                                            className={`flex items-center justify-between gap-2 px-4 py-2.5
                                                        text-[1.0625rem] transition-colors ${
                                                region.national ? 'font-extrabold' : 'font-bold'
                                            } ${
                                                on ? 'bg-brand-50 text-brand-800' : 'text-brand-700 hover:bg-brand-50/60'
                                            }`}
                                        >
                                            <span className="inline-flex items-center gap-2">
                                                {region.national && (
                                                    <Globe2 size={15} className="shrink-0 text-brand-500" />
                                                )}
                                                {region.label}
                                            </span>
                                            <ChevronRight size={14} className="text-gray-400" />
                                        </Link>
                                    ) : (
                                        <button
                                            type="button"
                                            onMouseEnter={() => setActive(region.key)}
                                            onFocus={() => setActive(region.key)}
                                            className={`flex w-full items-center justify-between gap-2 px-4 py-2.5
                                                        text-left text-[1.0625rem] font-bold transition-colors ${
                                                on ? 'bg-brand-50 text-gray-500' : 'text-gray-500 hover:bg-brand-50/60'
                                            }`}
                                        >
                                            {region.label}
                                            <ChevronRight size={14} className="text-gray-300" />
                                        </button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>

                    {/* ---- what is inside it ---- */}
                    <div className="w-56 py-2">
                        <p className="px-4 pb-2 text-[1rem] font-bold uppercase tracking-wider text-gray-400">
                            {current?.national ? 'The five regions' : `${current?.label} states`}
                        </p>

                        {current?.national ? (
                            <ul>
                                {underNational.map((region) => (
                                    <li key={region.key}>
                                        <Link
                                            to={`/regions/${region.slug}`}
                                            onClick={() => setOpen(false)}
                                            className="block px-4 py-2.5 text-[1.0625rem] font-semibold
                                                       text-brand-700 transition-colors hover:bg-brand-50/60"
                                        >
                                            {region.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        ) : linkableStates.length ? (
                            <ul>
                                {linkableStates.map((state) => (
                                    <li key={state.slug}>
                                        <Link
                                            to={`/states/${state.slug}`}
                                            onClick={() => setOpen(false)}
                                            className="block px-4 py-2.5 text-[1.0625rem] font-semibold
                                                       text-brand-700 transition-colors hover:bg-brand-50/60"
                                        >
                                            {state.name}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            /* Said plainly rather than left blank. An empty
                               column reads as a menu that failed to load. */
                            <p className="px-4 py-2 text-[1.0625rem] font-semibold text-gray-400">
                                No state pages yet.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * The same menu for the mobile drawer — an accordion, not a flyout.
 *
 * A hover flyout on a touch screen opens on the tap that was meant to navigate,
 * so the first tap appears to do nothing and the second one leaves the page.
 */
export function RegionsAccordion({ accent, onNavigate }: {
    accent: string;
    onNavigate: () => void;
}) {
    const regions = useRegionMap();
    const [openKey, setOpenKey] = useState('');

    if (!regions.length) return null;

    return (
        <div className="px-3 py-2">
            <p className="text-[1rem] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Regions
            </p>
            {regions.map((region) => {
                const on = openKey === region.key;
                const states = region.states.filter((s) => s.hasPage);

                /*
                 * INDIA IS A LINK HERE, NOT A DRAWER.
                 *
                 * On the desktop panel its second column holds the five
                 * regions, which are already the next five rows of THIS list —
                 * a drawer repeating them under the country would be the same
                 * five links twice on one screen.
                 *
                 * Hidden until its page exists, on the same rule as the panel:
                 * a tier a visitor can see and cannot reach reads as broken
                 * rather than as unwritten.
                 */
                if (region.national) {
                    if (!region.hasPage) return null;
                    return (
                        <Link
                            key={region.key}
                            to={`/regions/${region.slug}`}
                            onClick={onNavigate}
                            className="flex items-center gap-2 border-b border-gray-100 py-2.5
                                       text-[1.0625rem] font-extrabold"
                            style={{ color: accent }}
                        >
                            <Globe2 size={15} className="shrink-0 opacity-60" />
                            {region.label}
                        </Link>
                    );
                }

                return (
                    <div key={region.key}>
                        <button
                            type="button"
                            onClick={() => setOpenKey(on ? '' : region.key)}
                            className="flex w-full items-center justify-between gap-2 py-2.5 text-left
                                       text-[1.0625rem] font-bold"
                            style={{ color: accent }}
                            aria-expanded={on}
                        >
                            {region.label}
                            <ChevronDown
                                size={14}
                                className={on ? 'rotate-180 transition-transform' : 'transition-transform'}
                            />
                        </button>

                        {on && (
                            <div className="pl-3 pb-2 space-y-1">
                                {region.hasPage && (
                                    <Link
                                        to={`/regions/${region.slug}`}
                                        onClick={onNavigate}
                                        className="block py-2 text-[1.0625rem] font-bold text-brand-700"
                                    >
                                        {region.label} Region overview
                                    </Link>
                                )}
                                {states.map((state) => (
                                    <Link
                                        key={state.slug}
                                        to={`/states/${state.slug}`}
                                        onClick={onNavigate}
                                        className="block py-2 text-[1.0625rem] font-semibold text-gray-600"
                                    >
                                        {state.name}
                                    </Link>
                                ))}
                                {!region.hasPage && !states.length && (
                                    <p className="py-2 text-[1.0625rem] font-semibold text-gray-400">
                                        Nothing published yet.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export default RegionsMenu;
