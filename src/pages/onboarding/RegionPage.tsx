import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { HeaderSection } from '@/components/layout/HeaderSection';
import { FooterSection } from '@/components/layout/FooterSection';
import { SCREEN_CONTAINER } from '@/components/layout/pageContainer';
import { SECTION_HEADING } from '@/components/layout/typography';
import {
    getRegionPage, dashboardLabels, ZONE_LABELS, NATIONAL_LABELS,
    type RegionPage as RegionPageData, type RegionLeader,
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
                setMissing('This zone page has not been published yet.');
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
                        {missing || 'This zone page could not be loaded.'}
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
        /\b(region|zone)\b/i.test(value || '') ? (value || '') : `${value || ''} Zone`.trim()
    );
    /* "National", not "National Region". The country is not one of them. */
    const label = national ? (page.regionName || 'National') : regionTitle(page.regionName);

    /*
     * THE PAGE'S OWN HEADINGS, from the CMS, with the shipped wording under
     * anything the editor left blank.
     *
     * The national page and a zone page disagree about what their bands are
     * called — "National / Zones" against "Zone / States" — so the default
     * table is chosen on the same `national` flag everything else here uses.
     * A blank stored field falls back to that table, which is what every page
     * written before these fields existed carries.
     */
    const labels = dashboardLabels(page.labels, national ? NATIONAL_LABELS : ZONE_LABELS);

    /*
     * ======================================================================
     * THE TIER BELOW: THIS PAGE’S OWN BOARDS, THEN THE REAL PAGES
     * ======================================================================
     *
     * `stateRegions` is what an editor typed into THIS page — the states of
     * a region, the regions of the country. Editing the South on the national
     * page and editing the South’s own page are two different acts on two
     * different records, which is what the association asked for.
     *
     * `statePanels` is the DERIVED list, read off the pages underneath — a
     * board per state that has published a bench of its own.
     *
     * THEY ARE ADDED, NOT CHOSEN BETWEEN. This was written as
     * `ownBoards.length ? ownBoards : derived`, and the word "fallback" hid
     * what that does: typing ONE board onto a zone page silently took every
     * real state page out of the zone. Eight states became one, with nothing
     * on the CMS screen to say the seven had been dropped — and they came
     * back only if that single row was deleted again. An editor adding a
     * state cannot have meant "and remove the other seven".
     *
     * ---------------------------------------------------------------------
     * ON A CLASH OF NAMES, THE STATE’S OWN PAGE WINS
     * ---------------------------------------------------------------------
     *
     * A state page is a record with its own editor, its own Published badge
     * and a public URL. A board typed onto the zone above it is a copy of
     * the same tier with none of those. When both name the same state, the
     * page is the one a reader should meet, and the copy is the one that
     * goes stale — which is the rule this file already states in the other
     * direction for contacts.
     *
     * It reached the site as a board headed "TAMILNADU" carrying one
     * placeholder leader, printed above nothing, while Tamil Nadu’s own
     * published page sat underneath it unused.
     *
     * `norm` throws away EVERYTHING that is not a letter or a digit, so
     * "TAMILNADU", "Tamil Nadu" and "tamil  nadu" are one state. Case and
     * runs of whitespace alone were not enough: the clash that reached a
     * reader differed by a single space. This is deliberately looser than
     * `regionMatch` on the server — that one decides who may SEE a file and
     * must not over-match; this one decides which of two boards for the same
     * place to draw, where over-matching costs a duplicate and under-matching
     * costs the reader the real page.
     */
    const norm = (value: string) => (value || '').replace(/[^a-z0-9]+/gi, '').toLowerCase();

    /*
     * ON THE NATIONAL PAGE THE TIER BELOW IS THE ZONES, AND IT HAS TO SAY SO.
     *
     * `regionPanelsOf` returns each zone under its stored `regionName` —
     * "South", "North East" — because that is the name on the record. Every
     * other surface prints it with the tier: the header menu, the footer, the
     * CMS, the zone page's own bench ("South Zone Leaders"). Only these
     * boards and their contact headings read "SOUTH", which on a page whose
     * tier below is the five zones and whose OTHER tier is thirty-six states
     * is the one place a reader cannot tell which of the two they are looking
     * at.
     *
     * `regionTitle` is the same function the bench heading already uses, so a
     * zone an editor has named "North Eastern Region" is not re-suffixed. On
     * a zone page the tier below is the STATES and nothing is appended —
     * "Tamil Nadu Zone" would be a lie about the tier.
     */
    const tierName = (value: string) => (national ? regionTitle(value) : (value || ''));

    const derived = (page.statePanels || [])
        .filter((s) => s && s.name)
        .map((s) => ({ ...s, name: tierName(s.name) }));
    const havePage = new Set(derived.map((s) => norm(s?.name || '')));
    const ownBoards = (page.stateRegions || [])
        .filter((r) => r && r.name)
        .map((r) => ({ ...r, name: tierName(r.name) }))
        .filter((r) => !havePage.has(norm(r?.name || '')));

    /*
     * EVERY tier below this page, drawn or not — a bench, a contact, or
     * both. `statePanelsOf` on the server keeps a state that publishes a
     * telephone number and no portraits, for the reason its own note gives,
     * and this page then threw that state away again on the way to the
     * screen. A filter that contradicts the one that built the list is a
     * state missing from Get in Touch with nothing to say it was dropped.
     *
     * The real pages lead, in the order the zone’s editor arranged them
     * (`tierOrder`, applied server-side — see `getRegionPage`). The boards
     * written by hand follow, in their own stored order.
     */
    const allPanels = [...derived, ...ownBoards];

    /* The BOARDS: a heading over no faces is a heading over nothing. */
    const statePanels = allPanels.filter((row) => (row.leaders || []).length);

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
        /* The tiers below this page, whichever source they came from — so a
           board with a contact on it is reachable from Get in Touch too, and
           the two halves of the page cannot disagree about which tiers exist. */
        /* From ALL of them, not only the ones with a bench: a state whose
           entry here is a telephone number and nothing else is exactly the
           state this list exists for. */
        ...allPanels
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
                        /*
                         * "South Zone", as everything else on the site calls
                         * it — not the bare "South" on the record. The band
                         * sat directly above a heading reading "South Zone
                         * Leaders", which is two names for one place, a
                         * hand's width apart. `regionTitle` is what keeps the
                         * country "National" rather than "National Zone".
                         */
                        title={label}
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
                                eyebrow={labels.ownTierEyebrow}
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
                                eyebrow={labels.tierBelowEyebrow}
                                title={labels.tierBelowHeading}
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

                    {/* ---- contact ----
                        `id="contact"` is where the Contact page's region tiles
                        land (`/states/<slug>#contact`); `scroll-mt` keeps the
                        heading clear of the sticky header. */}
                    <section id="contact" className="scroll-mt-32">
                        <SectionHead eyebrow={labels.contactEyebrow} title={labels.contactHeading} />

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
