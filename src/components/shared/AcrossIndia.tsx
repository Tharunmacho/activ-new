import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, Globe2, MapPin } from 'lucide-react';
import { Reveal } from '@/components/shared/Reveal';
import { getRegionMap, type RegionMapEntry } from '@/services/cmsRegionsApi';
import { getSiteSettings, EMPTY_SITE, type SiteSettings } from '@/services/cmsApi';

/**
 * ============================================================================
 * ACTIV ACROSS INDIA — the association's geography, on every page
 * ============================================================================
 *
 * A reader on the Membership page, or the newsroom, or the gallery, should be
 * able to see that the association has a national council and five regions,
 * open one, and land on its page. Today the only way through is the Regions
 * menu in the header, which a visitor has to know is there.
 *
 * ----------------------------------------------------------- NOT a nav bar
 *
 * The obvious answer is a second row of links under the header, which is what
 * a lot of association sites do. It was explicitly not wanted, and it is the
 * wrong answer anyway: a second bar competes with the first, it is the same
 * furniture on every page whether or not the page has anything to do with it,
 * and it pushes the thing the reader came for further down.
 *
 * This is a BAND AT THE FOOT OF THE PAGE, above the footer. By the time a
 * reader reaches it they have finished what they came for, which is exactly
 * when "where else can I go" is the useful question. It reads as part of the
 * page rather than as chrome bolted over it.
 *
 * -------------------------------------------------------- two levels, in place
 *
 * Six cards: the country, then the five regions. Clicking a region's CHEVRON
 * opens its states underneath, in the same band; clicking the card itself goes
 * to that region's page. One region open at a time, so the band never grows
 * past a couple of rows.
 *
 * The states are the reason this exists — a reader who wants Tamil Nadu should
 * not have to go via the South — and they are one click away without leaving
 * the page they are on.
 *
 * ------------------------------------------------------------- it is content
 *
 * Built from `GET /cms/regions/map`, like the header menu: publishing a state
 * page puts it here, and a region with no page is shown but is not a link. A
 * link to a 404 is worse than an absent link.
 *
 * It renders NOTHING while the call is in flight and nothing if it fails. A
 * band that appears late at the bottom of a page is a layout shift nobody
 * asked for, and a band that says "could not load the regions" is an apology
 * for something the reader was not waiting on.
 */
export function AcrossIndia() {
    const [regions, setRegions] = useState<RegionMapEntry[] | null>(null);
    const [openKey, setOpenKey] = useState('');

    /*
     * THE WORDING IS CONTENT TOO, AND IT WAS NOT.
     *
     * "Across India" and "Find ACTIV where you are" were two string
     * literals here, rendered on seven pages, unreachable from the CMS. The
     * tiles under them have always been content; the sentence over them
     * being hardcoded made this the one band on the site an editor could
     * not touch.
     *
     * It is on the SITE settings, not the home page: About, Membership,
     * Events, News, Gallery, Contact and Home all draw it. Editing it on the
     * Header & Footer screen changes it everywhere, which is what an editor
     * changing site furniture means.
     */
    const [band, setBand] = useState<SiteSettings['acrossIndia']>(EMPTY_SITE.acrossIndia);

    useEffect(() => {
        let cancelled = false;
        getRegionMap()
            .then((rows) => { if (!cancelled) setRegions(rows || []); })
            .catch(() => { /* the band is simply not drawn */ });

        // Cached and de-duplicated in `cmsApi`, and the header has already
        // asked for it on every page this renders on — a cache read, not a
        // request. A failure leaves the shipped wording rather than a band
        // of tiles with no heading.
        getSiteSettings()
            .then((site) => { if (!cancelled && site?.acrossIndia) setBand(site.acrossIndia); })
            .catch(() => { /* the shipped wording stands */ });

        return () => { cancelled = true; };
    }, []);

    /*
     * Regions the editor left out of this BAND.
     *
     * A deny list, so a region published tomorrow appears here with no
     * second step — see the schema. Leaving one out takes away the TILE and
     * nothing else: the page, the menu entry and the leadership all stand.
     */
    const hidden = useMemo(
        () => new Set((band?.hidden || []).map((k) => String(k || '').toLowerCase())),
        [band],
    );
    const shown = useMemo(
        () => (regions || []).filter((r) => !hidden.has(String(r.key || '').toLowerCase())),
        [regions, hidden],
    );

    const national = useMemo(
        () => shown.find((r) => r.national && r.hasPage),
        [shown],
    );
    const rest = useMemo(() => shown.filter((r) => !r.national), [shown]);

    // Turned off in the CMS, or nothing to point at.
    if (band?.enabled === false) return null;
    if (!regions || !rest.length) return null;

    const open = rest.find((r) => r.key === openKey);
    const openStates = (open?.states || []).filter((s) => s.hasPage);

    return (
        <section className="w-full border-t border-gray-100 bg-gray-50/60 py-14 md:py-16">
            <div className="mx-auto w-full max-w-[90rem] px-6 lg:px-10">
                <Reveal as="header" className="mb-8 text-center">
                    {band?.eyebrow && (
                        <p className="text-[1.0625rem] font-bold uppercase tracking-[0.18em] text-brand-500">
                            {band.eyebrow}
                        </p>
                    )}
                    {band?.heading && (
                        <h2 className="mt-1.5 text-[1.875rem] sm:text-[2.25rem] font-black tracking-tight
                                       text-brand-900">
                            {band.heading}
                        </h2>
                    )}
                    {band?.subtitle && (
                        <p className="mx-auto mt-3 max-w-2xl text-[1.125rem] font-medium
                                      leading-relaxed text-gray-600">
                            {band.subtitle}
                        </p>
                    )}
                </Reveal>

                <Reveal>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                        {/*
                          * THE COUNTRY FIRST, and drawn as the tier above rather
                          * than as a sixth region — solid where the others are
                          * outlined. It has no states of its own, so it has no
                          * chevron: the whole card is the link.
                          */}
                        {national && (
                            <Link
                                to={`/regions/${national.slug}`}
                                className="group flex items-center gap-3 rounded-2xl bg-brand-900 px-5 py-4
                                           text-white transition-all duration-300 hover:-translate-y-1
                                           hover:shadow-[0_18px_40px_-20px_rgba(28,46,104,0.6)]
                                           xl:col-span-1"
                            >
                                <Globe2 size={20} className="shrink-0 text-brand-300" />
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[1.1875rem] font-extrabold leading-tight">
                                        {national.label}
                                    </span>
                                    <span className="block text-[1rem] text-white/60">
                                        The whole country
                                    </span>
                                </span>
                                <ArrowRight
                                    size={16}
                                    className="shrink-0 transition-transform group-hover:translate-x-0.5"
                                />
                            </Link>
                        )}

                        {rest.map((region) => {
                            const states = (region.states || []).filter((s) => s.hasPage);
                            const isOpen = openKey === region.key;

                            return (
                                <div
                                    key={region.key}
                                    className={`flex items-center gap-2 rounded-2xl border bg-white pl-4 pr-2
                                                py-4 transition-all duration-300 ${isOpen
                                        ? 'border-brand-300 shadow-[0_14px_30px_-20px_rgba(28,46,104,0.5)]'
                                        : 'border-gray-200/80 hover:-translate-y-1 hover:border-brand-200'}`}
                                >
                                    {/*
                                      * The NAME goes to the region and the CHEVRON
                                      * opens its states. One control doing both
                                      * makes the region page unreachable from a
                                      * band whose purpose is reaching pages.
                                      */}
                                    {region.hasPage ? (
                                        <Link
                                            to={`/regions/${region.slug}`}
                                            className="group min-w-0 flex-1"
                                        >
                                            <span className="flex items-center gap-2">
                                                <MapPin size={15} className="shrink-0 text-brand-400" />
                                                <span className="truncate text-[1.1875rem] font-extrabold
                                                                 text-brand-900 transition-colors
                                                                 group-hover:text-brand-600">
                                                    {region.label}
                                                </span>
                                            </span>
                                            <span className="mt-0.5 block pl-[1.4rem] text-[1rem] text-gray-500">
                                                {states.length} {states.length === 1 ? 'state' : 'states'}
                                            </span>
                                        </Link>
                                    ) : (
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-center gap-2">
                                                <MapPin size={15} className="shrink-0 text-gray-300" />
                                                <span className="truncate text-[1.1875rem] font-extrabold
                                                                 text-gray-400">
                                                    {region.label}
                                                </span>
                                            </span>
                                            <span className="mt-0.5 block pl-[1.4rem] text-[1rem] text-gray-400">
                                                {states.length} {states.length === 1 ? 'state' : 'states'}
                                            </span>
                                        </span>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => setOpenKey(isOpen ? '' : region.key)}
                                        disabled={!states.length}
                                        aria-expanded={isOpen}
                                        aria-label={`${isOpen ? 'Hide' : 'Show'} the states of the ${region.label}`}
                                        className="shrink-0 rounded-lg p-2 text-gray-400 transition-colors
                                                   hover:bg-brand-50 hover:text-brand-700
                                                   disabled:opacity-30 disabled:hover:bg-transparent"
                                    >
                                        <ChevronDown
                                            size={16}
                                            className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                        />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </Reveal>

                {/*
                  * The states of the open region, in the same band.
                  *
                  * Under the whole row rather than under one card: six cards on
                  * a desktop row and a list dropped beneath one of them would
                  * push the other five around every time a reader changed their
                  * mind. Here the row is still, and only this strip changes.
                  */}
                {open && openStates.length > 0 && (
                    <div className="mt-4 rounded-2xl border border-brand-100 bg-white p-5">
                        <p className="mb-3 text-[1rem] font-bold uppercase tracking-[0.14em] text-brand-500">
                            {open.label} · states
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {openStates.map((state) => (
                                <Link
                                    key={state.slug}
                                    to={`/states/${state.slug}`}
                                    className="rounded-full border border-gray-200 px-4 py-2 text-[1.0625rem]
                                               font-semibold text-brand-700 transition-colors
                                               hover:border-brand-300 hover:bg-brand-50"
                                >
                                    {state.name}
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}

export default AcrossIndia;
