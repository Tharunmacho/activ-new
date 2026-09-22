import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { HeaderSection } from '@/components/layout/HeaderSection';
import { FooterSection } from '@/components/layout/FooterSection';
import { SCREEN_CONTAINER } from '@/components/layout/pageContainer';
import { SECTION_HEADING } from '@/components/layout/typography';
import {
    getRegionPage, type RegionPage as RegionPageData, type RegionLeader,
} from '@/services/cmsRegionsApi';
import { LeaderProfileDialog } from './components/RegionUI';
import type { LeaderContext } from '@/services/cmsLeaderMessagesApi';
import { StateHeroBand } from './components/StateDashboard';
import {
    SectionHead, LeaderGrid, TierPanel, ContactGroup, contactEntries,
} from './components/LeadershipSections';
import { RegionStateMap } from './components/RegionStateMap';

/**
 * One region — `/regions/south`.
 *
 * =========================================================================
 * THE SAME PAGE AS A STATE, BECAUSE IT IS THE SAME KIND OF THING
 * =========================================================================
 *
 * Four bands, full width — the state page's layout, one tier up:
 *
 *     the hero, with the description and Region at a Glance
 *     REGION      — the regional board's bench
 *     STATES      — a panel per state council in the region
 *     CONTACT     — the regional office, and every state's
 *
 * Every part of it is shared code with `StatePage`, cell for cell, so the two
 * cannot drift apart by being edited separately. A reader moving from South to
 * Tamil Nadu meets one design, not two that resemble each other.
 *
 * ------------------------------------------- the tiers a region actually has
 *
 * A state page shows state, region and district. A region has two tiers, not
 * three: itself, and the states beneath it — so the page reads region, then a
 * panel per state, and there is no third band to leave empty. `statePanels` is
 * read from the state pages by the server, never copied onto the region: a
 * chairman is one record, and a second copy of them goes stale silently.
 *
 * ------------------------------------------------- WHAT IS NOT DRAWN HERE
 *
 * As on the state page: About, the photo gallery, events, projects, consulting,
 * policy advocacy, media releases and coverage, sector updates, news, in the
 * media, publications, the custom sections, the promotional banners, the vision
 * band, the Explore picture, the Highlights figures and the Key Achievements
 * list. NONE OF IT WAS DELETED — every list is still on the record, still edited
 * in CMS -> Regions & States, still served, and still reachable at
 * `/regions/:slug/:type`. What is gone is the cards on this page that linked to
 * them.
 *
 * The region's description is the paragraph in the hero. The "States in this
 * region" card went too — the states are now on the page as benches with names
 * and faces, which is more than a row of pills said.
 */
export default function RegionPage() {
    const { slug } = useParams<{ slug: string }>();
    const [page, setPage] = useState<RegionPageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [missing, setMissing] = useState('');
    /* Every bench is printed in full, so the only thing behind a card is one
       person. See the state page's note. */
    /*
     * The open profile panel, and WHERE the face that opened it came from.
     *
     * Both, because this page draws leaders at two levels — the region's own
     * council and each state's beneath it — and the panel is one component.
     * A message addressed from the wrong level is filed under the wrong
     * geography, which is the one thing the leader inbox exists to get right.
     */
    const [leader, setLeader] = useState<
        { person: RegionLeader; context: LeaderContext } | null
    >(null);

    const openLeader = (person: RegionLeader, context?: LeaderContext) =>
        setLeader({ person, context: context || { tier: 'region' } });

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setMissing('');
        setPage(null);
        window.scrollTo({ top: 0, behavior: 'auto' });

        getRegionPage(String(slug || ''))
            .then((data) => { if (!cancelled) { setPage(data); setLoading(false); } })
            .catch(() => {
                if (cancelled) return;
                setMissing('This region page has not been published yet.');
                setLoading(false);
            });

        return () => { cancelled = true; };
    }, [slug]);

    if (loading) {
        return (
            <div className="flex flex-col min-h-screen font-sans dot-band">
                <HeaderSection />
                <div className={`${SCREEN_CONTAINER} py-10 animate-pulse flex-grow`}>
                    <div className="h-56 bg-slate-200 rounded-[1.5rem] mb-8" />
                    <div className="h-8 w-64 bg-slate-200 rounded mb-6" />
                    <div className="grid gap-5 grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
                        {[0, 1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-80 bg-slate-200 rounded-2xl" />
                        ))}
                    </div>
                </div>
                <FooterSection />
            </div>
        );
    }

    if (missing || !page) {
        return (
            <div className="flex flex-col min-h-screen font-sans dot-band">
                <HeaderSection />
                <div className={`${SCREEN_CONTAINER} py-24 flex-grow text-center`}>
                    <h1 className={`${SECTION_HEADING} text-brand-800 mb-4`}>Not published yet</h1>
                    <p className="text-[1.25rem] sm:text-[1.0625rem] font-semibold text-gray-500 mb-8">
                        {missing || 'This region page could not be loaded.'}
                    </p>
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 bg-brand-800 hover:bg-brand-700 text-white
                                   px-8 py-3.5 rounded-full font-bold text-[1.0625rem] uppercase
                                   tracking-[0.1em] transition-colors"
                    >
                        <ArrowLeft size={15} /> Back to home
                    </Link>
                </div>
                <FooterSection />
            </div>
        );
    }

    /* "South" is the key; "South Region" is the name. See `StatePage`. */
    /*
     * ======================================================================
     * THE SAME PAGE SERVES THE COUNTRY, AND HAS TO SAY SO IN ITS OWN WORDS
     * ======================================================================
     *
     * Every heading on this page was written for a region, and read on the
     * national one as "India Region Leaders" over "STATES / State-wise
     * Leadership" — a region that is not a region, above a tier that is the
     * five regions and not the states.
     *
     * One flag, and the words follow it. Nothing else about the page
     * changes, because nothing else needs to: the structure really is the
     * same at both levels and that is the point of sharing the component.
     */
    const national = (page.regionKey || page.slug) === 'national';

    const regionTitle = (value: string) => (
        /\bregion\b/i.test(value || '') ? (value || '') : `${value || ''} Region`.trim()
    );
    /* "National", not "National Region". The country is not one of them. */
    const label = national ? (page.regionName || 'National') : regionTitle(page.regionName);

    /*
     * ======================================================================
     * THE TIER BELOW: THIS PAGE’S OWN BOARDS FIRST
     * ======================================================================
     *
     * `stateRegions` is what an editor typed into THIS page — the states of
     * a region, the regions of the country — and it is what the page draws
     * when it has any. Editing the South on the national page and editing
     * the South’s own page are two different acts on two different records,
     * which is what the association asked for.
     *
     * `statePanels` is the DERIVED list, read off the pages underneath. It
     * is the fallback and nothing more: without it, adding the owned field
     * would have blanked every region page in the site until somebody
     * retyped eight states into each of them.
     *
     * Never both. Two boards for one state, one of them stale, is worse
     * than either alone.
     */
    const ownBoards = (page.stateRegions || [])
        .filter((r) => r && (r.leaders || []).length);
    const derived = (page.statePanels || []).filter((s) => s && (s.leaders || []).length);
    const statePanels = ownBoards.length ? ownBoards : derived;

    /* One entry per PERSON, not one per office — see the state page's note. */
    const regionContacts = contactEntries(page.contacts);

    /*
     * ======================================================================
     * GET IN TOUCH IS BUILT THE WAY THE STATE PAGE BUILDS IT
     * ======================================================================
     *
     * Two sources, in this order, and they answer different questions.
     *
     * The GROUPS on this page’s own record come first — `regionContactGroups`,
     * the same field and the same editor the state page uses for its
     * region-wise list. Somebody typed them here, for this page, and they
     * are the association’s own answer to "who do I write to in this tier".
     *
     * Then each tier below that publishes a contact of its own. That half is
     * DERIVED and never copied: a state’s contact belongs to the state page,
     * and a copy of it here goes stale the moment the state edits theirs.
     *
     * A name appearing in both is not deduplicated, because they are not the
     * same claim: one says the region publishes this person, the other says
     * the state does.
     */
    const ownGroups = (page.regionContactGroups || [])
        .map((g) => ({ name: g?.name || '', entries: contactEntries(g?.contacts) }))
        .filter((g) => g.name && g.entries.length);

    const stateContacts = [
        ...ownGroups,
        /* The boards this page draws, whichever source they came from — so a
           board with a contact on it is reachable from Get in Touch too, and
           the two halves of the page cannot disagree about which tiers exist. */
        ...statePanels
            .map((row) => ({ name: row?.name || '', entries: contactEntries(row?.contacts) }))
            .filter((g) => g.name && g.entries.length),
    ];

    return (
        <div className="flex flex-col min-h-screen font-sans dot-band">
            <HeaderSection />

            <main className="flex-grow">
                <div className={`${SCREEN_CONTAINER} py-5 sm:py-6 space-y-8 sm:space-y-10`}>

                    {/* No back link: a region has no parent page. */}
                    <StateHeroBand
                        hero={page.hero}
                        title={page.regionName}
                        blurb={page.hero.blurb || page.shortDescription}
                        /*
                         * NO "REGION AT A GLANCE", for the same reason the state
                         * page has no "State at a Glance": the association asked
                         * for these pages to be the leadership and the contacts
                         * and nothing beside them. It was still here because the
                         * instruction was given while looking at a state page,
                         * and the two are the same card.
                         *
                         * The list is not deleted — it is still on the document,
                         * still edited in CMS -> Regions & States, and still
                         * served by the API.
                         */
                        showGlance={false}
                    />

                    {/* ---- region ---- */}
                    {(page.leaders || []).length > 0 && (
                        <section>
                            <SectionHead
                                eyebrow={national ? 'National' : 'Region'}
                                title={`${label} Leaders`}
                            />
                            <LeaderGrid
                                leaders={page.leaders}
                                onOpen={openLeader}
                                context={{
                                    tier: national ? 'national' : 'region',
                                    region: national ? '' : label,
                                }}
                            />
                        </section>
                    )}

                    {/* ---- states ---- */}
                    {statePanels.length > 0 && (
                        <section>
                            {/* The tier below: a region’s states, the country’s regions. */}
                            <SectionHead
                                eyebrow={national ? 'Regions' : 'States'}
                                title={national ? 'Region-wise Leadership' : 'State-wise Leadership'}
                            />
                            {/* : with the panels gone there is no
                                box edge between one group and the next, so the
                                gap is the only thing separating them. At 20px
                                a district heading sat closer to the row above
                                it than to its own faces. */}
                            <div className="space-y-10 sm:space-y-12">
                                {statePanels.map((state) => (
                                    <TierPanel
                                        key={state.slug || state.name}
                                        variant="bar"
                                        /* Named only while there is more than
                                           one to tell apart — a lone panel is
                                           already named by the heading above. */
                                        showName={statePanels.length > 1}
                                        name={state.name}
                                        leaders={state.leaders}
                                        onOpen={openLeader}
                                        /* On the national page this tier is the
                                           REGIONS; on a region page it is the
                                           states. Same grid, two geographies. */
                                        context={national
                                            ? { tier: 'region', region: state.name }
                                            : { tier: 'state', region: label, state: state.name }}
                                    />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* ---- contact ---- */}
                    <section>
                        <SectionHead eyebrow="Contact" title="Get in Touch" />

                        {/*
                          * THE MAP ON THE LEFT, THE PEOPLE ON THE RIGHT — the
                          * state page's arrangement, one level up. The map is
                          * how a reader finds WHICH council they want; the list
                          * is how they reach it. `lg:sticky` because the list
                          * runs to several screens and a map that scrolls away
                          * cannot be used to navigate the thing beside it.
                          */}
                        {/* Wider than the state page's 22rem: a region is a
                            landscape shape — the South runs from Kerala to the
                            Andamans — where a state is portrait, and the same
                            column renders it a third of the size. */}
                        <div className="grid items-start gap-8 lg:gap-12
                                        lg:grid-cols-[minmax(0,27rem)_minmax(0,1fr)]">
                            <div className="lg:sticky lg:top-24">
                                {/* `mapPanels` where the boards and the map are
                                    different lists — see the note on the field. */}
                                <RegionStateMap
                                    regionKey={page.regionKey || page.slug}
                                    regionLabel={label}
                                    statePanels={page.mapPanels || page.statePanels || []}
                                />
                            </div>

                            <div className="min-w-0 space-y-10">
                                <ContactGroup label={label} entries={regionContacts} />

                                {stateContacts.map((group) => (
                                    <ContactGroup
                                        key={group.name}
                                        label={group.name}
                                        entries={group.entries}
                                    />
                                ))}
                            </div>
                        </div>
                    </section>
                </div>
            </main>

            {leader && (
                <LeaderProfileDialog
                    person={leader.person}
                    context={leader.context}
                    onClose={() => setLeader(null)}
                />
            )}

            <FooterSection />
        </div>
    );
}
