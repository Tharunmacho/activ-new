import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { HeaderSection } from '@/components/layout/HeaderSection';
import { FooterSection } from '@/components/layout/FooterSection';
import { SCREEN_CONTAINER } from '@/components/layout/pageContainer';
import { SECTION_HEADING } from '@/components/layout/typography';
import {
    getStatePage, dashboardLabels, STATE_LABELS,
    type StatePage as StatePageData, type RegionLeader,
} from '@/services/cmsRegionsApi';
import { LeaderProfileDialog } from './components/RegionUI';
import type { LeaderContext } from '@/services/cmsLeaderMessagesApi';
import { StateHeroBand } from './components/StateDashboard';
import {
    SectionHead, LeaderGrid, TierPanel, ContactGroup, contactEntries,
} from './components/LeadershipSections';
import { StateDistrictMap } from './components/StateDistrictMap';

/**
 * One state — `/states/tamil-nadu`.
 *
 * =========================================================================
 * A LEADERSHIP SCREEN. NOTHING ELSE IS ON IT.
 * =========================================================================
 *
 * Five bands, full width, in this order:
 *
 *     the hero, with the description and the facts
 *     STATE            — the state council's bench
 *     NATIONAL REGION  — the region this state reports into
 *     REGIONS OF <the state> — the state's own zones, one bench each
 *     DISTRICTS        — a panel per district chapter
 *     CONTACT          — the map of the state, and one entry per office-bearer
 *
 * ------------------------------------------------- WHAT IS NOT DRAWN HERE
 *
 * About, the photo gallery, events, projects, consulting services, policy
 * advocacy, media releases, publications, the custom sections, the promotional
 * banners, the vision band, the Explore picture, the Highlights figures and the
 * Key Achievements list. The association asked, specifically, for a page that is
 * the leadership and the contacts and nothing beside them.
 *
 * NONE OF THAT CONTENT WAS DELETED. Every list is still on the document, still
 * edited in CMS -> Regions & States, still served by the API, and still
 * reachable at `/states/:slug/:type` — `…/events`, `…/projects`, `…/gallery`,
 * `…/about`, `…/achievements` and the rest all answer exactly as before. What is
 * gone is the cards on THIS page that linked to them, so nothing on the site
 * points at those screens any more. They go back here if they are wanted; the
 * git history of this file has the rows as they stood.
 *
 * The state's description did not disappear with the About card — it is the
 * paragraph under the headline in the hero.
 *
 * --------------------------------------------------------------- the motion
 *
 * Every band arrives on scroll through the same `Reveal` the home page's blocks
 * use, and every portrait tilts under the pointer through the same `Tilt3D` the
 * events grid uses. Both live in `LeadershipSections`, so this file contains no
 * animation of its own and the two pages cannot drift apart.
 *
 * ------------------------------------------------------ the leadership bands
 *
 * State, then region, then districts, with NO region/district switch. The
 * supplied design has a pair of pills and a row of region names above the lower
 * two benches; the association asked for them to come off, so every tier is on
 * the page at once.
 *
 * --------------------------------------------- TWO THINGS CALLED A REGION,
 * --------------------------------------------- AND ONLY ONE BELONGS HERE
 *
 *   REGIONS OF THIS STATE — Tamil Nadu's own North, West, Central and South.
 *   Each one CONTAINS a handful of the state's districts, which is the whole
 *   hierarchy this page is about: a state, its regions, and the districts
 *   inside them. Stored on this page, edited on this state's CMS screen.
 *
 *   THE NATIONAL REGION — South: eight states, its own page at
 *   `/regions/south`, the body Tamil Nadu reports INTO. It is one level ABOVE
 *   the state and so it is NOT a tier on a state page. It appears here only as
 *   the pill at the top of the band, which is a way out of this page rather
 *   than a section of it.
 *
 * Both were drawn for a version and that was wrong: two bands both headed with
 * a region called "South", one of them describing eight states and the other
 * four districts, is a page that teaches a reader the word means nothing.
 */
export default function StatePage() {
    const { slug } = useParams<{ slug: string }>();
    const [page, setPage] = useState<StatePageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [missing, setMissing] = useState('');
    /**
     * The one thing that opens over this page.
     *
     * Every bench is printed in full, so there is no "all leaders" panel left to
     * open — the only thing behind a card is ONE person, and this is them.
     */
    /*
     * The open profile panel, and WHERE the face that opened it came from.
     *
     * This page draws leaders at THREE levels — the state council, the
     * state's own regions, and its districts — through one panel component.
     * The association's example is a member in Tiruvannamalai messaging
     * their district's chairman, and the district is what makes that
     * enquiry worth anything to the super admin. Only the grid that drew
     * the face knows which level it was.
     */
    const [leader, setLeader] = useState<
        { person: RegionLeader; context: LeaderContext } | null
    >(null);

    const openLeader = (person: RegionLeader, context?: LeaderContext) =>
        setLeader({ person, context: context || { tier: 'state' } });

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setMissing('');
        setPage(null);
        window.scrollTo({ top: 0, behavior: 'auto' });

        getStatePage(String(slug || ''))
            .then((data) => { if (!cancelled) { setPage(data); setLoading(false); } })
            .catch(() => {
                if (cancelled) return;
                setMissing('This state page has not been published yet.');
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
                        {missing || 'This state page could not be loaded.'}
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

    /*
     * ================================================================
     * THE THREE TIERS, READ DEFENSIVELY
     * ================================================================
     *
     * `stateRegions` and `districts` postdate every page in the collection and a
     * server that predates them answers without either. `|| []` throughout is
     * what keeps this page a page rather than a white screen when it is served
     * by a build older than itself.
     *
     * `page.regionPanel` — the NATIONAL region this state sits in — is still on
     * the payload and is still used, but ONLY for the pill at the top of the
     * band. It is not a tier on this page; see the note in the header.
     */
    /*
     * "South" IS THE KEY; "South Region" IS THE NAME.
     *
     * The map stores the short form and the back link at the top of this page
     * has always printed it with "Region" after it. A band headed "South
     * Leadership" under a breadcrumb reading "South Region" is two names for one
     * thing on one screen. The conditional is what keeps a region an editor has
     * already named "North Eastern Region" from becoming "North Eastern Region
     * Region".
     */
    const regionTitle = (label: string) => (
        /\bregion\b/i.test(label || '') ? (label || '') : `${label || ''} Region`.trim()
    );

    /*
     * ================================================================
     * THIS STATE's REGIONS — NOT THE NATIONAL ONE IT BELONGS TO
     * ================================================================
     *
     * The band used to draw `regionPanel`, which is the national region the
     * state sits in: eight states, its own page at `/regions/south`, its own
     * bench. Under a heading reading "Region-wise Leadership" on the Tamil Nadu
     * page that is the wrong answer — a reader there means Tamil Nadu's own
     * North, South, East and West, each covering a handful of its districts.
     *
     * Two different things share the word. The national one is still reachable,
     * from the pill at the top of the band; this tier is the state's own, and
     * is edited on this state's CMS page.
     */
    /* The page's own headings, from the CMS, with the shipped wording under
       anything left blank — see `dashboardLabels`. */
    const labels = dashboardLabels(page.labels, STATE_LABELS);

    const stateRegions = (page.stateRegions || []).filter((r) => r && (r.leaders || []).length);
    const districts = (page.districts || []).filter((d) => d && (d.leaders || []).length);

    /*
     * THE CONTACT DIRECTORY — one entry per PERSON, not one per office.
     *
     * `contactEntries` puts the office first, because "Director, state office"
     * is the general enquiry address and a reader scanning for one should not
     * have to know a name to find it, then adds every office-bearer who has a
     * contact of their own. Anyone with none is not listed, so a council that
     * publishes one shared address looks exactly as it did.
     *
     * A group with nobody in it draws nothing, which is why these are built
     * here and merely handed over below.
     */
    /*
     * THE STATE OFFICE, AND WHAT SOMEBODY TYPED INTO A CONTACTS LIST.
     *
     * The benches are not here any more — see the note on `contactEntries`. A
     * leader is a portrait on the board above, and their own details open with
     * their panel; the directory is what an editor put in a contacts list.
     *
     * The region and district OFFICES are not passed either. Their editor was
     * removed when contacts became the single place a telephone number goes,
     * and a field nobody can edit has no business on a public page.
     */
    const stateContacts = contactEntries(page.contacts);
    /*
     * THE GROUPS COME FROM THEIR OWN LISTS, not from the leadership tiers.
     *
     * They used to be read off `stateRegions` and `districts`, which tied a
     * contact heading to the existence of a bench: the association could not
     * publish a contact for a district it had no chapter in, and adding one
     * from the contacts screen created an empty chapter on the leadership
     * board. Two lists now, and neither creates the other.
     */
    const regionGroups = (page.regionContactGroups || [])
        .map((g) => ({ name: g?.name || '', entries: contactEntries(g?.contacts) }))
        .filter((g) => g.name && g.entries.length);
    const districtContacts = (page.districtContactGroups || [])
        .map((g) => ({ name: g?.name || '', entries: contactEntries(g?.contacts) }))
        .filter((g) => g.name && g.entries.length);

    return (
        <div className="flex flex-col min-h-screen font-sans dot-band">
            <HeaderSection />

            <main className="flex-grow">
                {/*
                  * `space-y-14`, not `space-y-5`.
                  *
                  * These are BANDS, not cards in a grid: each one is a heading,
                  * a rule and a row of people. Set five apart they read as one
                  * continuous strip of faces with captions dropped into it, and
                  * the headings stop doing the only job they have.
                  */}
                <div className={`${SCREEN_CONTAINER} py-5 sm:py-6 space-y-8 sm:space-y-10`}>

                    {/* The paragraph comes from the page's own description,
                        which is where the design puts it. `blurb` first, so an
                        editor who has written a shorter line specifically for
                        the band still gets it. */}
                    {/*
                      * The band carries the description and the facts, and
                      * NOTHING in its right-hand column.
                      *
                      * It held the map for a version and State at a Glance
                      * before that; both were asked for and both have now been
                      * taken off. A band is an introduction, and an
                      * introduction with a control in it is a band a reader has
                      * to work rather than read. The map opens the contact
                      * block instead, where a map answers a question somebody
                      * actually has.
                      */}
                    <StateHeroBand
                        hero={page.hero}
                        title={page.stateName}
                        blurb={page.hero.blurb || page.shortDescription}
                        backLabel={page.region ? `${page.region.label} Zone` : 'Zones'}
                        backHref={page.region ? `/regions/${page.region.slug}` : undefined}
                        showGlance={false}
                    />


                    {/* ---- state ---- */}
                    {(page.leaders || []).length > 0 && (
                        <section>
                            <SectionHead
                                /* The heading keeps the state's NAME, which is
                                   why only the eyebrow is authored: a stored
                                   title would freeze one state's name onto
                                   every other state's page. */
                                eyebrow={labels.ownTierEyebrow}
                                title={`${page.stateName} Leaders`}
                            />
                            <LeaderGrid
                                leaders={page.leaders}
                                onOpen={openLeader}
                                context={{ tier: 'state', state: page.stateName }}
                            />
                        </section>
                    )}

                    {/* ---- this state's own regions ---- */}
                    {stateRegions.length > 0 && (
                        <section>
                            <SectionHead
                                eyebrow={`${labels.tierBelowEyebrow} of ${page.stateName}`}
                                title={labels.tierBelowHeading}
                            />
                            <div className="space-y-10 sm:space-y-12">
                                {stateRegions.map((region) => (
                                    <TierPanel
                                        key={region.id || region.slug || region.name}
                                        id={`region-${region.slug || region.name}`}
                                        variant="bar"
                                        /* Named only while there is more than
                                           one to tell apart. */
                                        showName={stateRegions.length > 1}
                                        name={regionTitle(region.name)}
                                        leaders={region.leaders}
                                        onOpen={openLeader}
                                        context={{
                                            tier: 'region',
                                            state: page.stateName,
                                            region: region.name,
                                        }}
                                    />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* ---- districts ---- */}
                    {districts.length > 0 && (
                        <section>
                            <SectionHead
                                eyebrow={labels.districtsEyebrow}
                                title={labels.districtsHeading}
                            />
                            {/* `space-y-10`: with the panels gone there is no
                                box edge between one group and the next, so the
                                gap is the only thing separating them. */}
                            <div className="space-y-10 sm:space-y-12">
                                {districts.map((district) => (
                                    <TierPanel
                                        key={district.id || district.slug || district.name}
                                        id={`district-${district.slug || district.name}`}
                                        variant="rule"
                                        showName={districts.length > 1}
                                        name={`${district.name} District`}
                                        leaders={district.leaders}
                                        onOpen={openLeader}
                                        /* The case the association described:
                                           a member in Tiruvannamalai messaging
                                           Tiruvannamalai's own office-bearer. */
                                        context={{
                                            tier: 'district',
                                            state: page.stateName,
                                            district: district.name,
                                        }}
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
                          * THE MAP ON THE LEFT, THE PEOPLE ON THE RIGHT.
                          *
                          * They belong to each other: the map is how a reader
                          * finds WHICH office they want, the list is how they
                          * reach it. Stacked, the map was a picture at the top
                          * of a long list and the two never looked related.
                          *
                          * `lg:sticky` on the map column, because the list of
                          * offices is several screens long and a map that
                          * scrolls away is a map you cannot use to navigate the
                          * thing beside it. `items-start` is what lets the
                          * sticky take effect at all — a stretched grid item
                          * has no room to move within.
                          */}
                        <div className="grid items-start gap-8 lg:gap-12
                                        lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
                            <div className="lg:sticky lg:top-24">
                                <StateDistrictMap
                                    stateName={page.stateName}
                                    stateSlug={page.slug}
                                    districts={districts}
                                    /* The state’s own regions, so the shapes can be coloured by
                                       the CMS rather than by geometry. All of them, not just the
                                       staffed ones: the palette is keyed by position in this list
                                       and filtering it here would shift every colour whenever a
                                       region lost its last office-bearer. */
                                    regions={page.stateRegions || []}
                                    /* What a clicked district says. Section 5’s district-wise
                                       groups — the one place a district contact is editable — and
                                       so the one thing the panel can promise is current. */
                                    contactGroups={page.districtContactGroups || []}
                                />
                            </div>

                            <div className="min-w-0 space-y-10">
                                <ContactGroup
                                    label={`${page.stateName} State Council`}
                                    entries={stateContacts}
                                />

                                {regionGroups.map((group) => (
                                    <ContactGroup
                                        key={group.name}
                                        label={`${regionTitle(group.name)} — ${page.stateName}`}
                                        entries={group.entries}
                                    />
                                ))}

                                {districtContacts.map((group) => (
                                    <ContactGroup
                                        key={group.name}
                                        label={`${group.name} District`}
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
