import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Mail, Phone, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Reveal } from '@/components/shared/Reveal';
import type { StatePanel } from '@/services/cmsRegionsApi';
import { regionMaps } from '@/data/maps';
import { STATE_PALETTE, type RegionMapData } from '@/data/maps/types';

/**
 * THE REGION, DRAWN AS ITS STATES.
 *
 * =========================================================================
 * THE STATE MAP, ONE LEVEL UP
 * =========================================================================
 *
 * A state page draws districts coloured by zone, because the thing a reader
 * picks there is a district. A region page draws the same boundaries coloured
 * by STATE, because the thing a reader picks here is a state — and then hands
 * them the link to that state's own page, which is the whole point of a region
 * page existing.
 *
 * Both maps come out of one generator over one set of boundaries, so they use
 * the same projection, the same simplification and the same behaviour: the map
 * alone until it is clicked, a card that closes with its ×, and no library.
 *
 * The district lines INSIDE each state are drawn, not dissolved away — each
 * state is one path holding its districts as subpaths, so the white stroke
 * picks them out. A region of eight solid blobs says less than a region you can
 * see the grain of.
 *
 * ---------------------------------------------------------------- the data
 *
 * Boundaries are lazy-loaded: the South's are 233KB, and a reader who never
 * opens a region page should never fetch them.
 *
 * The COUNCILS come from the CMS — `statePanels`, the same list the benches
 * above are drawn from. A state the association has not written a page for is
 * still on the map, still clickable, and says so.
 */

const normalise = (value: string) => String(value || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

export function RegionStateMap({ regionKey, regionLabel, statePanels }: {
    regionKey: string;
    regionLabel: string;
    statePanels: StatePanel[];
}) {
    const [map, setMap] = useState<RegionMapData | null>(null);

    useEffect(() => {
        const load = regionMaps[String(regionKey || '').toLowerCase()];
        setMap(null);
        if (!load) return undefined;

        let cancelled = false;
        load()
            .then((mod) => { if (!cancelled) setMap(mod.default); })
            .catch(() => { if (!cancelled) setMap(null); });

        return () => { cancelled = true; };
    }, [regionKey]);

    /** Which CMS council, if any, belongs to each drawn state. */
    const byShape = useMemo(() => {
        const found = new Map<string, StatePanel>();
        if (!map) return found;
        (statePanels || []).filter((s) => s?.name).forEach((panel) => {
            const shape = map.states.find((s) => normalise(s.name) === normalise(panel.name));
            if (shape) found.set(shape.slug, panel);
        });
        return found;
    }, [statePanels, map]);

    const [selected, setSelected] = useState<string | null>(null);
    useEffect(() => { setSelected(null); }, [regionKey]);

    if (!map) return null;

    /*
     * "STATES OF THE NATIONAL" is what this printed on the country's page.
     *
     * The caption was built as `States of the {regionLabel}`, which reads
     * correctly at every level except the one above them all: on a zone page
     * `regionLabel` is "South Zone" and the line is right, and on the
     * national page it is "National" — a word that is not a place and does
     * not take "the".
     *
     * The map itself is unchanged and needs no change: even on the national
     * page it is drawn STATE BY STATE, because that is what a map of India
     * is and because a reader picks a state off it. Only the sentence over
     * it was wrong.
     */
    const caption = regionKey === 'national' ? 'States of India' : `States of the ${regionLabel}`;

    const shape = selected ? map.states.find((s) => s.slug === selected) || null : null;
    const council = selected ? byShape.get(selected) || null : null;

    return (
        <Reveal as="div" className="min-w-0">
            <p className="mb-3 text-[1.25rem] font-bold uppercase tracking-[0.16em] text-brand-500">
                {caption}
            </p>

            <div className="rounded-[1.25rem] border border-gray-200/70 bg-white/70 p-5">
                <svg
                    viewBox={map.viewBox}
                    role="img"
                    aria-label={caption}
                    className="mx-auto block h-auto w-full max-h-[26rem]"
                >
                    {map.states.map((row, i) => {
                        const style = STATE_PALETTE[i % STATE_PALETTE.length];
                        const isSelected = selected === row.slug;
                        const has = byShape.get(row.slug);

                        return (
                            <path
                                key={row.slug}
                                d={row.d}
                                role="button"
                                tabIndex={0}
                                aria-label={has
                                    ? `${row.name}, state council`
                                    : `${row.name}, no council page`}
                                aria-pressed={isSelected}
                                onClick={() => setSelected(isSelected ? null : row.slug)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setSelected(isSelected ? null : row.slug);
                                    }
                                }}
                                className={`cursor-pointer stroke-white outline-none transition-colors
                                            duration-200 focus-visible:stroke-brand-900
                                            ${isSelected ? style.active : `${style.fill} ${style.hover}`}`}
                                strokeWidth={isSelected ? 2 : 0.8}
                            >
                                <title>{row.name}</title>
                            </path>
                        );
                    })}

                    {/* A pin on every state with a council, for the same reason
                        the district maps have one: Lakshadweep and Puducherry
                        are a few pixels across and nobody can aim at them. */}
                    {map.states.map((row) => {
                        const has = byShape.get(row.slug);
                        if (!has) return null;
                        const isSelected = selected === row.slug;

                        return (
                            <g
                                key={`pin-${row.slug}`}
                                role="button"
                                tabIndex={0}
                                aria-label={`${row.name} state council`}
                                aria-pressed={isSelected}
                                onClick={() => setSelected(isSelected ? null : row.slug)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setSelected(isSelected ? null : row.slug);
                                    }
                                }}
                                className="cursor-pointer outline-none
                                           [&:focus-visible>circle]:stroke-brand-900"
                            >
                                <circle
                                    cx={row.cx}
                                    cy={row.cy}
                                    r={isSelected ? 11 : 8}
                                    className={`transition-all duration-200 ${isSelected
                                        ? 'fill-brand-900 stroke-white'
                                        : 'fill-white stroke-brand-800'}`}
                                    strokeWidth={2.5}
                                />
                            </g>
                        );
                    })}
                </svg>

                <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[1.0625rem]
                               font-semibold text-gray-600">
                    {map.states.map((row, i) => (
                        <li key={row.slug} className="flex items-center gap-2">
                            <span className={`h-3 w-3 shrink-0 rounded-full
                                              ${STATE_PALETTE[i % STATE_PALETTE.length].swatch}`} />
                            <span className="truncate" title={row.name}>{row.name}</span>
                        </li>
                    ))}
                </ul>

                <p className="mt-3 flex items-center gap-2 border-t border-gray-200/80 pt-3
                              text-[1.0625rem] font-semibold text-gray-500">
                    <span className="h-3 w-3 shrink-0 rounded-full border-2 border-brand-800 bg-white" />
                    State with a council
                </p>

                {shape && (
                    <div
                        role="status"
                        className="relative mt-4 rounded-xl border border-gray-200 bg-white p-4
                                   pt-5 text-center"
                    >
                        <button
                            type="button"
                            onClick={() => setSelected(null)}
                            aria-label="Close"
                            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center
                                       rounded-full text-gray-400 transition-colors
                                       hover:bg-gray-100 hover:text-gray-600"
                        >
                            <X size={14} />
                        </button>

                        <p className="text-[1.25rem] font-bold uppercase tracking-[0.16em]
                                      text-brand-500">
                            {regionLabel}
                        </p>
                        <h3 className="mt-1 text-[1.5625rem] font-black tracking-tight text-brand-900">
                            {shape.name}
                        </h3>

                        {council ? (
                            <>
                                {/*
                                  * THE CONTACTS, NOT A COUNT OF THE BENCH.
                                  *
                                  * This led with "N office-bearers" over the state
                                  * office. The same two problems as the district
                                  * panel: a state that publishes contacts but no
                                  * bench opened with a ZERO, and the office beneath
                                  * it has no editor anywhere in the CMS any more.
                                  *
                                  * `contacts` is the state page’s own list — what
                                  * somebody typed into Section 5 of that state — so
                                  * the panel says what the state itself says.
                                  *
                                  * THE DISTRICT COUNT STAYS. It is a fact about the
                                  * map, not about the association, and it is the one
                                  * number on this card that cannot go stale.
                                  */}
                                <p className="mt-3 text-[1.0625rem] font-medium text-gray-500">
                                    {shape.districts} districts
                                </p>

                                <ul className="mt-3 space-y-3 text-[1.0625rem] font-medium
                                               text-gray-600">
                                    {(council.contacts || [])
                                        .filter((c) => c && (c.name || c.designation
                                            || c.organisation || c.email || c.phone))
                                        .map((c, k) => (
                                            <li key={c.id || k} className="space-y-1">
                                                {(c.name || c.designation || c.organisation) && (
                                                    <p className="font-bold text-brand-900">
                                                        {c.name || c.designation || c.organisation}
                                                    </p>
                                                )}
                                                {c.phone && (
                                                    <p className="flex items-center justify-center gap-2.5">
                                                        <Phone size={14} className="shrink-0 text-brand-500" />
                                                        <a
                                                            href={`tel:${c.phone}`}
                                                            className="transition-colors hover:text-brand-700"
                                                        >
                                                            {c.phone}
                                                        </a>
                                                    </p>
                                                )}
                                                {c.email && (
                                                    <p className="flex items-center justify-center gap-2.5">
                                                        <Mail size={14} className="shrink-0 text-brand-500" />
                                                        <a
                                                            href={`mailto:${c.email}`}
                                                            className="break-all transition-colors hover:text-brand-700"
                                                        >
                                                            {c.email}
                                                        </a>
                                                    </p>
                                                )}
                                            </li>
                                        ))}
                                </ul>

                                {council.slug && (
                                    <Link
                                        to={`/states/${council.slug}`}
                                        className="mt-4 inline-flex items-center gap-2 rounded-full
                                                   bg-brand-800 px-4 py-2 text-[1.0625rem] font-bold
                                                   text-white transition-colors hover:bg-brand-700"
                                    >
                                        Open the {shape.name} page
                                        <ArrowRight size={14} />
                                    </Link>
                                )}
                            </>
                        ) : (
                            <p className="mt-2 text-[1.0625rem] font-semibold text-gray-500">
                                {shape.districts} districts. No council page published yet.
                            </p>
                        )}
                    </div>
                )}
            </div>
        </Reveal>
    );
}
