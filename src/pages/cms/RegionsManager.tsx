import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    AlertTriangle, Plus, Trash2, ChevronUp, ChevronDown, Save, Check, Loader2, ExternalLink,
    MapPin, Users, Image as ImageIcon, Pencil, ArrowUpToLine, ArrowDownToLine, ArrowLeft, Mail,
} from 'lucide-react';
import { toast } from 'sonner';
import {
    CmsPage, CmsCard, CmsSection, CmsField, CmsInput, CmsTextarea, CmsButton,
    CmsLoading, CmsError, SaveNow, SaveNowProvider, CmsStep, CmsSteps,
} from './components/CmsUI';
import MediaPicker from './components/MediaPicker';
import { UploadField } from './components/UploadField';
import { LinkList, ExtraFieldsEditor } from './components/CmsEditors';
import { errorMessage } from '@/services/api';
import { resolveMediaUrl } from '@/config/api.config';
import { stateMaps } from '@/data/maps';
import { normaliseDistrict } from '@/data/maps/match';
import { CARD_TITLE } from '@/components/layout/appTypography';
import {
    uploadMedia, addGalleryItem, updateGalleryItem, deleteGalleryItem,
} from '@/services/cmsApi';
import {
    listRegionPagesAdmin, getRegionPageAdmin, getStatePageAdmin,
    type AdminRegionRow, type AdminStateRow,
    saveRegionPage, saveStatePage, listRegionGallery,
    STATE_LABELS, ZONE_LABELS, NATIONAL_LABELS,
    type GalleryPhoto,
    type RegionPage, type StatePage, type RegionLeader, type RegionFeedItem, type RegionSlide,
    type RegionContactPerson, type RegionContactGroup,
    type CustomSection, type RegionDistrict,
} from '@/services/cmsRegionsApi';

/**
 * Regions & States — the editor behind the public section.
 *
 * =========================================================================
 * THE SCREEN IS LAID OUT LIKE THE PAGE IT EDITS
 * =========================================================================
 *
 * Description, then carousel, then leadership, then the feeds, then contact —
 * the order a reader meets them in. An editor changing the leadership panel
 * should be able to find it by remembering where it sits on the site, not by
 * remembering where a form put it.
 *
 * ----------------------------------------------------- what a save sends
 *
 * ONLY THE SECTION BEING EDITED. The server treats an absent key as untouched,
 * so saving the leaders cannot blank the sector updates — and every panel here
 * sends its own key and nothing else. Sending the whole page on every save is
 * how one screen's stale copy overwrites another's edit.
 *
 * ------------------------------------------------------------- nothing is
 * ------------------------------------------------------------- required
 *
 * These pages are written over several sittings. A form that refuses to save
 * without a description is a form with "TBC" typed into it — the same rule the
 * event editor follows. `status` carries readiness; the fields carry what is
 * known so far.
 */

type Tab = 'regions' | 'states';

export default function RegionsManager() {
    const [tab, setTab] = useState<Tab>('regions');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    /* Summaries. The editor fetches the one page it opens — see `PageLoader`. */
    const [regions, setRegions] = useState<AdminRegionRow[]>([]);
    const [states, setStates] = useState<AdminStateRow[]>([]);
    const [allStates, setAllStates] = useState<{ name: string; slug: string; regionKey: string; regionLabel: string }[]>([]);
    /**
     * ==========================================================================
     * A STATE OPENS ON A SCREEN OF ITS OWN
     * ==========================================================================
     *
     * It used to expand INSIDE the list: press Tamil Nadu and four thousand
     * pixels of form unfolded between it and Telangana. Everything below the
     * open row was pushed off the bottom of the window, closing it threw you
     * back to a scroll position halfway down a page you were no longer on, and
     * the browser Back button did nothing at all because nothing had navigated.
     *
     * `?state=` / `?region=` in the address bar is the screen. It is a real
     * location, which buys three things an expander cannot:
     *
     *   - Back leaves the editor and returns to the list, because it IS a
     *     history entry
     *   - the URL can be bookmarked and sent to whoever edits that state
     *   - a reload comes back to the page being edited rather than the top of
     *     a list of thirty-six
     *
     * A query parameter rather than a route segment, deliberately: the CMS
     * mounts this manager at one path, and a nested route would mean
     * registering `/cms/regions/states/:slug` in the app router and keeping the
     * two in step. The parameter needs nothing outside this file.
     */
    const [params, setParams] = useSearchParams();
    const openState = params.get('state') || '';
    const openRegion = params.get('region') || '';

    const openPage = (next: { state?: string; region?: string }) => {
        const q = new URLSearchParams();
        if (next.state) q.set('state', next.state);
        if (next.region) q.set('region', next.region);
        setParams(q);
        /* The editor is a different screen, so it starts at ITS top rather than
           at whatever offset the list was left at. */
        window.scrollTo({ top: 0 });
    };

    const closePage = () => { setParams(new URLSearchParams()); window.scrollTo({ top: 0 }); };

    /* Zone key -> "South Zone", for the state rows' subtitle. */
    const regionLabels = useMemo(
        () => new Map(regions.filter((r) => !r.national)
            .map((r) => [r.key, `${r.label} Zone`])),
        [regions],
    );

    /** Which region's states are listed. Empty means all of them. */
    const [regionFilter, setRegionFilter] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = await listRegionPagesAdmin();
            setRegions(data.regions || []);
            setStates(data.states || []);
            setAllStates(data.allStates || []);
        } catch (err) {
            setError(errorMessage(err, 'The zone pages could not be loaded'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    /** States that have no page yet — what the "add" picker offers. */
    const unwritten = useMemo(() => {
        const have = new Set(states.map((s) => s.slug));
        const rest = allStates.filter((s) => !have.has(s.slug));
        /* The picker follows the filter too: with the South chosen, "add a
           state" offers the South's unwritten states rather than all of
           India's. */
        return regionFilter ? rest.filter((s) => s.regionKey === regionFilter) : rest;
    }, [states, allStates, regionFilter]);

    const shownStates = useMemo(() => (
        regionFilter ? states.filter((row) => row.regionKey === regionFilter) : states
    ), [states, regionFilter]);

    if (loading) return <CmsPage><CmsLoading label="Loading zone pages…" /></CmsPage>;
    if (error) return <CmsPage><CmsError message={error} onRetry={load} /></CmsPage>;

    /*
     * The editor screens. Rendered INSTEAD of the list — not above it, not in a
     * panel beside it — because a list of thirty-five other states underneath
     * the form is thirty-five rows of somewhere else to be.
     *
     * A slug in the address that matches nothing falls through to the list
     * rather than rendering an empty editor: a stale bookmark to a page since
     * deleted should land somewhere usable.
     */
    const statePage = openState ? states.find((row) => row.slug === openState) : undefined;
    if (statePage) {
        return (
            <CmsPage>
                <EditorScreen
                    title={statePage.stateName}
                    subtitle={statePage.regionKey
                        ? `${regionLabels.get(statePage.regionKey) || statePage.regionKey} Zone`
                        : 'State page'}
                    href={`/states/${statePage.slug}`}
                    status={statePage.status}
                    onBack={closePage}
                >
                    <PageLoader load={() => getStatePageAdmin(statePage.slug)}>
                        {(full) => (
                            <StateEditor
                                slug={statePage.slug}
                                page={full}
                                onSaved={load}
                            />
                        )}
                    </PageLoader>
                </EditorScreen>
            </CmsPage>
        );
    }

    const regionRow = openRegion ? regions.find((row) => row.key === openRegion) : undefined;
    if (regionRow) {
        return (
            <CmsPage>
                <EditorScreen
                    title={`${regionRow.label} Zone`}
                    subtitle={`${regionRow.stateCount} states`}
                    href={`/regions/${regionRow.key}`}
                    status={regionRow.page?.status}
                    onBack={closePage}
                >
                    <PageLoader load={() => getRegionPageAdmin(regionRow.key)}>
                        {(full) => (
                            <RegionEditor
                                slug={regionRow.key}
                                label={regionRow.label}
                                page={full}
                                onSaved={load}
                                /*
                                 * THE ROWS, NOT A RENDERED CARD.
                                 *
                                 * It used to be finished JSX. The editor could
                                 * then only print it, and the arrangement of
                                 * the tier below is a FIELD ON THE PAGE the
                                 * editor saves — so the editor has to be able
                                 * to sort these and hand an order back.
                                 */
                                tierRows={regionRow.national
                                    ? regions.filter((r) => !r.national).map((r) => ({
                                        key: r.key,
                                        label: `${r.label} Zone`,
                                        subtitle: `${r.stateCount} states`,
                                        status: r.page?.status,
                                        href: `/regions/${r.key}`,
                                        onOpen: () => openPage({ region: r.key }),
                                    }))
                                    : states.filter((st) => st.regionKey === regionRow.key)
                                        .map((st) => ({
                                            key: st.slug,
                                            label: st.stateName,
                                            subtitle: regionLabels.get(st.regionKey) || '',
                                            status: st.status,
                                            href: `/states/${st.slug}`,
                                            onOpen: () => openPage({ state: st.slug }),
                                        }))}
                                /*
                                 * CREATING A STATE HAPPENS WHERE THE STATES
                                 * ARE LISTED.
                                 *
                                 * The only way to open a state page was the
                                 * States tab, which is a different screen from
                                 * the one an editor is on when they notice a
                                 * state is missing — so a state got typed into
                                 * the hand-written boards below instead, and
                                 * came out with no Published badge, no Edit
                                 * button and no page behind it. Same picker,
                                 * same `saveStatePage` call, offered here.
                                 */
                                addTier={regionRow.national ? null : (
                                    <AddState
                                        options={allStates.filter((st) => (
                                            st.regionKey === regionRow.key
                                            && !states.some((row) => row.slug === st.slug)
                                        ))}
                                        onAdded={async (slug) => {
                                            await saveStatePage(slug, { status: 'draft' });
                                            toast.success('State page created as a draft');
                                            await load();
                                            openPage({ state: slug });
                                        }}
                                    />
                                )}
                            />
                        )}
                    </PageLoader>
                </EditorScreen>
            </CmsPage>
        );
    }

    return (
        <CmsPage>
            <CmsCard
                title="Zones & States"
                description="The zone and state pages on the public site — their leadership, photographs, updates and contact details. Everything here is written by hand; nothing is pulled from the events or member records."
            >
                <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-[#1f1f1f] mb-6">
                    {([['regions', 'Zones'], ['states', 'States']] as [Tab, string][]).map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => { setTab(key); }}
                            className={`-mb-px px-5 py-3 text-[1.25rem] font-semibold border-b-2 transition-colors ${
                                tab === key
                                    ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                                    : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-neutral-200'
                            }`}
                        >
                            {label}
                            <span className="ml-2 text-[1.1875rem] text-slate-400">
                                {key === 'regions' ? regions.length : states.length}
                            </span>
                        </button>
                    ))}
                </div>

                {tab === 'regions' && (
                    <div className="space-y-3">
                        {regions.map((row) => (
                            <PageRow
                                key={row.key}
                                /* "India Region" would be wrong twice over. */
                                title={row.national ? row.label : `${row.label} Zone`}
                                subtitle={row.national
                                    ? 'The national page — office-bearers, contacts and the map of India'
                                    : `${row.stateCount} states`}
                                status={row.page?.status}
                                href={`/regions/${row.key}`}
                                onToggle={() => openPage({ region: row.key })}
                                action={row.national ? null : (
                                    /* Straight to this region's states, filtered
                                       — which is what an editor working on the
                                       South actually wants next. */
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setRegionFilter(row.key);
                                            setTab('states');
                                           
                                        }}
                                        className="shrink-0 rounded-full px-3 py-1.5 text-[1.0625rem]
                                                   font-semibold text-blue-700 dark:text-blue-400
                                                   transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                    >
                                        Its {row.stateCount} states
                                    </button>
                                )}
                            >
                            </PageRow>
                        ))}
                    </div>
                )}

                {tab === 'states' && (
                    <div className="space-y-3">
                        {/*
                          * WHICH REGION'S STATES.
                          *
                          * Thirty-six rows in one list, when the work in front
                          * of an editor is always one region's — "the South's
                          * states" — or one state. The chips narrow it, and
                          * each carries the number of pages it holds so an
                          * empty region is visible without opening it.
                          */}
                        <div className="flex flex-wrap gap-2 pb-2">
                            {/*
                              * NO NATIONAL CHIP. The country is not one of the
                              * five, no state page hangs under it, and the chip
                              * therefore read “National Region 0” — a filter that
                              * can only ever empty the list, next to five that
                              * narrow it.
                              */}
                            {[{ key: '', label: 'All zones', count: states.length }]
                                .concat(regions.filter((r) => !r.national).map((r) => ({
                                    key: r.key,
                                    label: `${r.label} Zone`,
                                    count: states.filter((st) => st.regionKey === r.key).length,
                                })))
                                .map((chip) => (
                                    <button
                                        key={chip.key || 'all'}
                                        type="button"
                                        onClick={() => { setRegionFilter(chip.key); }}
                                        className={`inline-flex items-center gap-2 rounded-full px-4 py-2
                                                    text-[1.1875rem] font-semibold transition-colors ${
                                            regionFilter === chip.key
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-slate-100 dark:bg-[#141414] text-slate-600 '
                                                  + 'dark:text-neutral-300 hover:bg-slate-200'
                                        }`}
                                    >
                                        {chip.label}
                                        <span className={regionFilter === chip.key
                                            ? 'text-white/70' : 'text-slate-400'}>
                                            {chip.count}
                                        </span>
                                    </button>
                                ))}
                        </div>

                        {shownStates.map((row) => (
                            <PageRow
                                key={row.slug}
                                title={row.stateName}
                                /* From the MAP, not from the document: the list
                                   row no longer carries the page, and the region
                                   a state belongs to is the map's answer anyway. */
                                subtitle={regionLabels.get(row.regionKey) || ''}
                                status={row.status}
                                href={`/states/${row.slug}`}
                                onToggle={() => openPage({ state: row.slug })}
                            />
                        ))}

                        {/*
                          * ADDING A STATE IS PICKING ONE, not typing a name.
                          *
                          * The list comes from the server's region map, so a
                          * page cannot be created for a state that does not
                          * exist — and its region is derived rather than asked
                          * for, which is what stops a page appearing under one
                          * region and claiming another in its breadcrumb.
                          */}
                        <AddState
                            options={unwritten}
                            onAdded={async (slug) => {
                                await saveStatePage(slug, { status: 'draft' });
                                toast.success('State page created as a draft');
                                await load();
                                setTab('states');
                                /* Straight into the new page. It is a draft with nothing
                                   in it, and the next thing anybody does is fill it in. */
                                openPage({ state: slug });
                            }}
                        />
                    </div>
                )}
            </CmsCard>
        </CmsPage>
    );
}

/* ------------------------------------------------------------------- rows */

/**
 * A row in the list of pages. It OPENS one; it does not contain one.
 *
 * `children` and `open` are gone: the row used to unfold four thousand pixels
 * of editor between itself and the next state, and every page now opens on a
 * screen of its own — see the note on `?state=` in `RegionsManager`.
 *
 * `onToggle` keeps its name because that is what both call sites already
 * pass, and it still means the same thing to a reader: this is what the row
 * does when you press it.
 */
/**
 * The bar an editor screen opens with.
 *
 * A page reached by pressing a row in a list has to say three things before
 * anything else: which page this is, how to get back, and whether it is live.
 * The expander said none of them — you were simply somewhere in a very long
 * form, and "which state am I editing" was answered by scrolling up.
 *
 * Sticky, because the answer to "how do I get out of here" must not be four
 * thousand pixels away. Same reason the save moved into every section footer.
 */
function EditorScreen({ title, subtitle, href, status, onBack, children }: {
    title: string;
    subtitle?: string;
    href: string;
    status?: string;
    onBack: () => void;
    children: React.ReactNode;
}) {
    const live = String(status || '').toLowerCase() === 'published';
    return (
        <div>
            {/*
              * ONE HEADER ON THIS SCREEN, AND THIS IS IT.
              *
              * It was a STICKY, translucent, bordered bar — which gave the editor
              * screen two headers: the CMS panel's own chrome at the top of the
              * window, and this floating a few pixels under it, carrying its own
              * card edges and shadow as though it were a second application.
              *
              * It is a plain row now, ruled off at the bottom, sitting in the
              * normal flow above the first section card. It scrolls away with
              * everything else, which is right: the panel chrome above it does not
              * move, so there is always a fixed bar on screen and this one does not
              * need to be a second.
              *
              * The translucency went with it. `bg-white/95 backdrop-blur` reads as
              * frosted only while the blur actually runs, and a sticky element
              * inside a scrolling ancestor does not always get one — without it,
              * 95% white is just white you can see through, and the form fields
              * underneath showed straight through the title.
              *
              * The negative margins went too. `-mx-4 sm:-mx-6` pulled the bar
              * outside the column to bleed to the panel edges, but the column and
              * the cards below are padded differently, so it over-reached on the
              * left and lined up with nothing.
              */}
            <div className="mb-7 flex flex-wrap items-center gap-x-4 gap-y-3 border-b
                            border-slate-200 pb-5 dark:border-[#1F1F1F]">
                    {/*
                      * THE ARROW ALONE.
                      *
                      * It read "← All pages", which is a phrase where an icon does
                      * the whole job — and it cost enough width that the title
                      * started a third of the way across the row, leaving the back
                      * control, the name and the status on three different
                      * horizontal rhythms.
                      *
                      * A square button the same height as the title block puts all
                      * three on one centre line. The words are kept as the
                      * accessible name and the tooltip, so nothing is lost to a
                      * screen reader or to a reader who is unsure.
                      */}
                    <button
                        type="button"
                        onClick={onBack}
                        aria-label="Back to all pages"
                        title="All pages"
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border
                                   border-slate-200 text-slate-600 transition-colors
                                   hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900
                                   dark:border-[#2a2a2a] dark:text-neutral-300 dark:hover:bg-[#141414]"
                    >
                        <ArrowLeft className="h-[1.125rem] w-[1.125rem]" />
                    </button>

                    <div className="min-w-0 flex-1">
                        <h2 className={`${CARD_TITLE} truncate leading-tight text-slate-900 dark:text-white`}>
                            {title}
                        </h2>
                        {subtitle ? (
                            <p className="truncate text-[1.0625rem] leading-tight text-slate-500
                                          dark:text-neutral-400">
                                {subtitle}
                            </p>
                        ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                    <span className={`shrink-0 rounded-full px-3 py-1 text-[1.0625rem] font-semibold ${
                        live
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                    }`}>
                        {live ? 'Published' : 'Draft'}
                    </span>

                    <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2
                                   text-[1.0625rem] font-semibold text-blue-700 transition-colors
                                   hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
                    >
                        <ExternalLink className="h-4 w-4" /> View page
                    </a>
                    </div>
            </div>

            {children}
        </div>
    );
}

function PageRow({ title, subtitle, status, href, onToggle, action }: {
    title: string;
    subtitle?: string;
    status?: string;
    href: string;
    onToggle: () => void;
    /** A control for this row — e.g. a region's "Show its states". */
    action?: React.ReactNode;
}) {
    return (
        <div className="rounded-xl border border-slate-200 transition-colors hover:border-slate-300
                        dark:border-[#2a2a2a] overflow-hidden">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5 bg-slate-50/60 dark:bg-[#111]">
                <button
                    type="button"
                    onClick={onToggle}
                    className="flex-1 !min-w-[9rem] text-left"
                >
                    <p className="text-[1.25rem] font-bold text-slate-900 dark:text-neutral-100">
                        {title}
                    </p>
                    {subtitle && (
                        <p className="text-[1.0625rem] font-medium text-slate-500 dark:text-neutral-400 mt-0.5">
                            {subtitle}
                        </p>
                    )}
                </button>

                {action}

                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[1.0625rem] font-semibold ${
                    status === 'published'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                }`}>
                    {status === 'published' ? 'Published' : status ? 'Draft' : 'Not created'}
                </span>

                {status === 'published' && (
                    <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-slate-400 hover:text-blue-600 transition-colors"
                        aria-label="Open the live page"
                    >
                        <ExternalLink className="w-4 h-4" />
                    </a>
                )}

                {/* Says what the press does. A chevron said "unfold", which is no
                    longer what happens — the row navigates. */}
                <button
                    type="button"
                    onClick={onToggle}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5
                               text-[1.0625rem] font-semibold text-[#2563EB] transition-colors
                               hover:bg-blue-50 dark:hover:bg-blue-950/30"
                >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
            </div>
        </div>
    );
}

function AddState({ options, onAdded }: {
    options: { name: string; slug: string; regionLabel: string }[];
    onAdded: (slug: string) => Promise<void>;
}) {
    const [slug, setSlug] = useState('');
    const [busy, setBusy] = useState(false);

    if (!options.length) {
        return (
            <p className="text-[1.1875rem] text-slate-500 dark:text-neutral-400 pt-2">
                Every state in the map already has a page.
            </p>
        );
    }

    return (
        <div className="flex flex-wrap items-end gap-3 pt-2">
            <div className="min-w-[16rem] flex-1">
                <CmsField label="Add a state page">
                    <select
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        className="w-full h-12 px-4 rounded-lg border border-slate-300 dark:border-[#2a2a2a]
                                   bg-white dark:bg-[#0b0b0b] text-[1.25rem] text-slate-900 dark:text-neutral-100"
                    >
                        <option value="">Choose a state…</option>
                        {options.map((row) => (
                            <option key={row.slug} value={row.slug}>
                                {row.name} — {row.regionLabel}
                            </option>
                        ))}
                    </select>
                </CmsField>
            </div>
            <CmsButton
                disabled={!slug || busy}
                onClick={async () => {
                    if (!slug) return;
                    setBusy(true);
                    try { await onAdded(slug); setSlug(''); } finally { setBusy(false); }
                }}
            >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create page
            </CmsButton>
        </div>
    );
}

/* --------------------------------------------------------------- editors */

/**
 * The hero and the vision bands.
 *
 * Four features and four pillars, each a label and an icon name. The icon is
 * picked from the site's own set rather than typed or uploaded: a name can be
 * re-skinned when the site changes, and it cannot 404 the way a pasted URL can.
 */
/**
 * A HEADING THAT SAYS WHERE ON THE PAGE THE NEXT PANELS APPEAR.
 *
 * =========================================================================
 * THE EDITOR IS LAID OUT LIKE THE PAGE IT EDITS
 * =========================================================================
 *
 * It had drifted: the panels ran band, description, carousel, leadership,
 * districts, eight feeds, custom sections, rail, consulting, photos, contact —
 * an order that matched no version of the public page and gave an editor no way
 * to know which of them they were looking at the effect of. Somebody filling in
 * "Media Coverages" had no way to learn, from this screen, that the state page
 * stopped drawing it.
 *
 * So the panels are now in the page's own order, under numbered headings that
 * name the band they produce — and everything the page does NOT draw is below a
 * divider that says so. Typing into a field that changes nothing is the fault
 * this repository has been caught by four times; a heading that admits it is
 * the cheapest possible guard against the fifth.
 */
/*
 * `CmsStep` and `CmsSteps` moved to `components/CmsUI`.
 *
 * They were written here and the rest of the CMS was a single long card per
 * screen, which made this editor look like a different product from the one
 * beside it in the sidebar. One implementation, every screen — the note on
 * it there says what the card is for.
 */

/**
 * The line between what the page draws and what it merely stores.
 *
 * Everything under this is still saved, still served by the API and still
 * reachable at its own `/states/:slug/:type` screen — it is simply not on the
 * page any more. An editor deserves to be told which of the two they are
 * filling in BEFORE they spend twenty minutes on it.
 */
function CmsNotDrawn({ where }: { where: string }) {
    return (
        <div className="mt-12 rounded-xl border border-amber-300/70 bg-amber-50 p-4
                        dark:border-amber-500/30 dark:bg-amber-500/10">
            <p className="text-[1.0625rem] font-bold uppercase tracking-[0.16em] text-amber-700
                          dark:text-amber-400">
                Stored, but not shown on the {where} page
            </p>
            <p className="mt-1.5 text-[1.1875rem] text-slate-600 dark:text-neutral-300">
                The association asked for a {where} page that is the leadership and the contacts
                and nothing else, so the panels below are no longer drawn on it. What you write
                here is still saved and still served — each list has its own screen at
                <code className="mx-1 rounded bg-white/70 px-1 dark:bg-black/30">/{where}s/…</code>
                — and putting a section back on the page is a code change, not a re-typing of
                anything you enter now.
            </p>
        </div>
    );
}

/**
 * ==========================================================================
 * THE BAND, AND ONLY WHAT THE BAND DRAWS
 * ==========================================================================
 *
 * Read off `StateHeroBand` in `components/StateDashboard.tsx` rather than off
 * the model. Every `hero.*` the public components touch, anywhere:
 *
 *     backgroundUrl  headline  tagline  blurb  facts  glance  sideImageUrl
 *
 * TWO FIELDS WERE EDITABLE AND READ BY NOTHING:
 *
 *   `hero.eyebrow` — "Small line above the title". No component reads it. The
 *   band puts the back-link pill in that position instead, and that pill is
 *   built from `page.region`, not from anything typed here.
 *
 *   `hero.features` — a whole `BadgeRows` list, icons and all, read by
 *   nothing.
 *
 * TWO MORE ARE DRAWN ON A REGION PAGE AND NOT ON A STATE PAGE:
 *
 *   `hero.glance` and `hero.sideImageUrl` are the "At a Glance" card.
 *   `RegionPage` renders `<StateHeroBand hero={…} />` and gets the default
 *   `showGlance = true`; `StatePage` passes `showGlance={false}` explicitly,
 *   with a note saying the association asked for the card off. So they are
 *   real on one page and dead on the other, and `withGlance` is which.
 *
 * That is why this takes a prop rather than dropping them for everybody: the
 * two editors share this component and the two pages do not agree.
 */
function BandFields({ draft, set, withGlance = true }: {
    draft: Record<string, unknown>;
    set: (patch: Record<string, unknown>) => void;
    /** The "At a Glance" card. Drawn on region pages; off on state pages. */
    withGlance?: boolean;
}) {
    const hero = (draft.hero || {}) as Record<string, unknown>;
    const setHero = (patch: Record<string, unknown>) => set({ hero: { ...hero, ...patch } });

    return (
        <>
            <CmsSection
                title="Top band"
                hint="The picture, the title and the facts across the top of the page."
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                        <CmsField label="Page title" hint="The big heading on the band.">
                            <CmsInput
                                value={String(hero.headline || '')}
                                onChange={(e) => setHero({ headline: e.target.value })}
                            />
                        </CmsField>
                    </div>
                    <div className="sm:col-span-2">
                        <CmsField label="One-line description" hint="Printed under the title.">
                            <CmsInput
                                value={String(hero.tagline || '')}
                                onChange={(e) => setHero({ tagline: e.target.value })}
                            />
                        </CmsField>
                    </div>
                    <div className="sm:col-span-2">
                        <CmsField
                            label="Longer introduction"
                            hint="Optional. Printed in place of the one-line description when it is filled in."
                        >
                            <CmsTextarea
                                rows={3}
                                value={String(hero.blurb || '')}
                                onChange={(e) => setHero({ blurb: e.target.value })}
                            />
                        </CmsField>
                    </div>
                    <div className={withGlance ? '' : 'sm:col-span-2'}>
                        <UploadField
                            url={String(hero.backgroundUrl || '')}
                            onChange={(backgroundUrl) => setHero({ backgroundUrl })}
                            label="Background picture"
                            hint="Fills the band behind the title. A wide photograph works best."
                        />
                    </div>
                    {withGlance ? (
                        <UploadField
                            url={String(hero.sideImageUrl || '')}
                            onChange={(sideImageUrl) => setHero({ sideImageUrl })}
                            label="Picture beside the At a Glance card"
                            hint="Optional — a map or a crest."
                        />
                    ) : null}
                </div>

                <div className="mt-5 space-y-5">
                    <FactRows
                        rows={(hero.facts as Fact[]) || []}
                        onChange={(facts) => setHero({ facts })}
                    />
                    {withGlance ? (
                        <GlanceRows
                            rows={(hero.glance as Glance[]) || []}
                            onChange={(glance) => setHero({ glance })}
                        />
                    ) : null}
                </div>
            </CmsSection>

            {/*
              * NO VISION STATEMENT, AND NO PHOTO CAROUSEL.
              *
              * Both were edited here and neither is drawn. `StatePage.tsx` and
              * `RegionPage.tsx` never read `vision` or `heroCarousel` — the only
              * mention of either in those files is a comment listing what came
              * off the page. The carousel in particular asked an editor to
              * upload a photograph, write its alt text, choose how it crops and
              * set a focal point, per slide, for a component nothing renders.
              *
              * The fields are untouched in the API and in the documents, so
              * whatever was written is still there if either band comes back.
              */}
        </>
    );
}

interface Badge { icon: string; label: string }

/** A short list of label-and-icon pairs. Four is what the band was drawn for. */
function BadgeRows({ label, rows, onChange }: {
    label: string;
    rows: Badge[];
    onChange: (rows: Badge[]) => void;
}) {
    const patch = (i: number, next: Partial<Badge>) =>
        onChange(rows.map((row, index) => (index === i ? { ...row, ...next } : row)));

    return (
        <div>
            <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-[1.1875rem] font-semibold text-slate-700 dark:text-neutral-200">{label}</p>
                <AddRowButton
                    label="Add"
                    onClick={() => onChange([...rows, { icon: '', label: '' }])}
                />
            </div>

            {!rows.length ? (
                <p className="text-[1.25rem] text-slate-500 dark:text-neutral-400">
                    None yet - the band leaves this row out.
                </p>
            ) : (
                <div className="space-y-2">
                    {rows.map((row, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <select
                                value={row.icon}
                                onChange={(e) => patch(i, { icon: e.target.value })}
                                className="h-11 w-40 shrink-0 rounded-lg border border-slate-300
                                           dark:border-[#2a2a2a] bg-white dark:bg-[#0b0b0b] px-3
                                           text-[1.1875rem] text-slate-900 dark:text-neutral-100"
                            >
                                <option value="">No icon</option>
                                {BAND_ICONS.map((name) => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                            <CmsInput
                                value={row.label}
                                placeholder="Industrial Growth"
                                onChange={(e) => patch(i, { label: e.target.value })}
                            />
                            <button
                                type="button"
                                onClick={() => onChange(rows.filter((_, index) => index !== i))}
                                aria-label="Remove"
                                className="p-1.5 rounded text-red-500 hover:bg-red-500/10 shrink-0"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * The icons offered for a band or an achievement.
 *
 * A SHORT LIST, not the whole set. Forty names in a dropdown is a dropdown
 * nobody reads to the end of; these are the ones that mean something on a page
 * about a state's industry.
 */
const BAND_ICONS = [
    'factory', 'users', 'globe', 'leaf', 'graduation-cap', 'ship',
    'building', 'briefcase', 'handshake', 'scale', 'calendar', 'award',
    'trending-up', 'target', 'lightbulb', 'shield-check', 'book-open', 'map-pin',
];


/** Capital / Chennai — a label, a value and an icon. */
interface Fact { icon: string; label: string; value: string }

function FactRows({ rows, onChange }: { rows: Fact[]; onChange: (rows: Fact[]) => void }) {
    const patch = (i: number, next: Partial<Fact>) =>
        onChange(rows.map((row, index) => (index === i ? { ...row, ...next } : row)));

    return (
        <div>
            <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-[1.1875rem] font-semibold text-slate-700 dark:text-neutral-200">
                    Fact chips
                </p>
                <AddRowButton
                    label="Add"
                    onClick={() => onChange([...rows, { icon: '', label: '', value: '' }])}
                />
            </div>

            {!rows.length ? (
                <p className="text-[1.25rem] text-slate-500 dark:text-neutral-400">
                    None yet - the hero leaves this row out.
                </p>
            ) : (
                <div className="space-y-2">
                    {rows.map((row, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <select
                                value={row.icon}
                                onChange={(e) => patch(i, { icon: e.target.value })}
                                className="h-11 w-36 shrink-0 rounded-lg border border-slate-300
                                           dark:border-[#2a2a2a] bg-white dark:bg-[#0b0b0b] px-3
                                           text-[1.1875rem] text-slate-900 dark:text-neutral-100"
                            >
                                <option value="">No icon</option>
                                {BAND_ICONS.map((name) => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                            <CmsInput
                                value={row.label}
                                placeholder="Capital"
                                onChange={(e) => patch(i, { label: e.target.value })}
                            />
                            <CmsInput
                                value={row.value}
                                placeholder="Chennai"
                                onChange={(e) => patch(i, { value: e.target.value })}
                            />
                            <button
                                type="button"
                                onClick={() => onChange(rows.filter((_, index) => index !== i))}
                                aria-label="Remove"
                                className="p-1.5 rounded text-red-500 hover:bg-red-500/10 shrink-0"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/** "2nd Largest Economy" / "in India" — a claim and its qualifier. */
interface Glance { icon: string; title: string; subtitle: string }

function GlanceRows({ rows, onChange }: { rows: Glance[]; onChange: (rows: Glance[]) => void }) {
    const patch = (i: number, next: Partial<Glance>) =>
        onChange(rows.map((row, index) => (index === i ? { ...row, ...next } : row)));

    return (
        <div>
            <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-[1.1875rem] font-semibold text-slate-700 dark:text-neutral-200">
                    State at a Glance
                </p>
                <AddRowButton
                    label="Add"
                    onClick={() => onChange([...rows, { icon: '', title: '', subtitle: '' }])}
                />
            </div>

            {!rows.length ? (
                <p className="text-[1.25rem] text-slate-500 dark:text-neutral-400">
                    None yet - the card is left off.
                </p>
            ) : (
                <div className="space-y-2">
                    {rows.map((row, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <select
                                value={row.icon}
                                onChange={(e) => patch(i, { icon: e.target.value })}
                                className="h-11 w-36 shrink-0 rounded-lg border border-slate-300
                                           dark:border-[#2a2a2a] bg-white dark:bg-[#0b0b0b] px-3
                                           text-[1.1875rem] text-slate-900 dark:text-neutral-100"
                            >
                                <option value="">No icon</option>
                                {BAND_ICONS.map((name) => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                            <CmsInput
                                value={row.title}
                                placeholder="2nd Largest Economy"
                                onChange={(e) => patch(i, { title: e.target.value })}
                            />
                            <CmsInput
                                value={row.subtitle}
                                placeholder="in India"
                                onChange={(e) => patch(i, { subtitle: e.target.value })}
                            />
                            <button
                                type="button"
                                onClick={() => onChange(rows.filter((_, index) => index !== i))}
                                aria-label="Remove"
                                className="p-1.5 rounded text-red-500 hover:bg-red-500/10 shrink-0"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/** The rail's picture cards — the explore block and the promo banners. */
interface PicCard { imageUrl: string; title: string; subtitle: string; href: string }

function CardRows({ label, rows, onChange }: {
    label: string;
    rows: PicCard[];
    onChange: (rows: PicCard[]) => void;
}) {
    const patch = (i: number, next: Partial<PicCard>) =>
        onChange(rows.map((row, index) => (index === i ? { ...row, ...next } : row)));

    return (
        <div>
            <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-[1.1875rem] font-semibold text-slate-700 dark:text-neutral-200">{label}</p>
                <AddRowButton
                    label="Add"
                    onClick={() => onChange([...rows, { imageUrl: '', title: '', subtitle: '', href: '' }])}
                />
            </div>

            {!rows.length ? (
                <p className="text-[1.25rem] text-slate-500 dark:text-neutral-400">
                    None yet - nothing is drawn here.
                </p>
            ) : (
                <div className="space-y-3">
                    {rows.map((row, i) => (
                        <div key={i} className="rounded-lg border border-slate-200 dark:border-[#2a2a2a] p-3">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <CmsField label="Title">
                                    <CmsInput
                                        value={row.title}
                                        onChange={(e) => patch(i, { title: e.target.value })}
                                    />
                                </CmsField>
                                <CmsField label="Subtitle">
                                    <CmsInput
                                        value={row.subtitle}
                                        onChange={(e) => patch(i, { subtitle: e.target.value })}
                                    />
                                </CmsField>
                                <UploadField
                                    url={row.imageUrl}
                                    onChange={(imageUrl) => patch(i, { imageUrl })}
                                    label="Picture"
                                />
                                <CmsField label="Link">
                                    <CmsInput
                                        value={row.href}
                                        placeholder="/gallery"
                                        onChange={(e) => patch(i, { href: e.target.value })}
                                    />
                                </CmsField>
                            </div>
                            <button
                                type="button"
                                onClick={() => onChange(rows.filter((_, index) => index !== i))}
                                className="mt-2 inline-flex items-center gap-1.5 text-[1.1875rem] font-medium text-red-500"
                            >
                                <Trash2 className="w-4 h-4" /> Remove
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/** Everything both editors share: description, carousel, leaders, contact. */
function CommonFields({ draft, set }: {
    draft: Record<string, unknown>;
    set: (patch: Record<string, unknown>) => void;
}) {
    return (
        <>
            {/*
              * ONE DESCRIPTION, AND NO "READ MORE".
              *
              * The hint promised "the paragraph at the top of the page, and what
              * Read More opens". There is no Read More: `StatePage` and
              * `RegionPage` read `shortDescription` and pass it to the band as
              * the blurb, and neither reads `fullDescription` at all — it was
              * six rows of textarea for a control that does not exist.
              *
              * Where the short description actually SURFACES is worth saying,
              * because it is not obvious from the field: the band prints
              * `hero.blurb || shortDescription`, so a longer introduction typed
              * into the band above REPLACES this line rather than joining it.
              */}
            <CmsSection
                title="Description"
                hint="The paragraph printed in the band, under the title."
            >
                <CmsField
                    label="Short description"
                    hint="Used unless the band's own longer introduction is filled in."
                >
                    <CmsTextarea
                        rows={3}
                        value={String(draft.shortDescription || '')}
                        onChange={(e) => set({ shortDescription: e.target.value })}
                    />
                </CmsField>
            </CmsSection>

        </>
    );
}

/**
 * The bench — pulled out of `CommonFields` so it can sit where the page puts it.
 *
 * It used to be the third panel inside the shared block, between the photo
 * carousel and the feeds, which put the most-edited thing on the page below two
 * things almost nobody touches. It is section 2 on both editors now, directly
 * under the band, exactly as the public page has it.
 */
function LeadersSection({ draft, set }: {
    draft: Record<string, unknown>;
    set: (patch: Record<string, unknown>) => void;
}) {
    const rows = (draft.leaders as RegionLeader[]) || [];

    return (
        <>
            <AddRow>
                <AddRowButton
                    label="Add leader"
                    onClick={() => set({ leaders: withNewLeaderOnTop(rows) })}
                />
            </AddRow>
            <LeaderRows rows={rows} onChange={(leaders) => set({ leaders })} />
        </>
    );
}

/**
 * ==========================================================================
 * THE EDITOR FETCHES THE PAGE IT IS ABOUT TO EDIT
 * ==========================================================================
 *
 * The list screen used to carry every field of every page so that opening an
 * editor needed no second call. Six region pages and thirty-six state pages
 * — each with a bench, its districts, its contacts, a carousel and ten feed
 * lists — is 1.4MB off a remote cluster, and it took over a minute to draw
 * forty rows of name and status. The CMS gave up first and reported "The
 * server took too long to respond", which reads as an outage.
 *
 * One page is one document. The list is a list.
 *
 * `null` from the server is not an error: it is a region or a state nobody
 * has written yet, and the editor opens empty on it, which is how a new page
 * is created. An error IS reported, because a page that exists and failed to
 * load must never be presented as a blank form — saving that would write the
 * blank over the record.
 */
function PageLoader<T>({ load, children }: {
    load: () => Promise<T | null>;
    children: (page: T | null) => ReactNode;
}) {
    const [page, setPage] = useState<T | null>(null);
    const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
    const [message, setMessage] = useState('');

    const fetchIt = useCallback(() => {
        setState('loading');
        return load()
            .then((row) => { setPage(row); setState('ready'); })
            .catch((err) => {
                setMessage(errorMessage(err, 'This page could not be loaded'));
                setState('failed');
            });
    }, [load]);

    useEffect(() => { fetchIt(); }, [fetchIt]);

    if (state === 'loading') return <CmsLoading />;
    if (state === 'failed') return <CmsError message={message} onRetry={fetchIt} />;
    return <>{children(page)}</>;
}

/**
 * ==========================================================================
 * THE TIER BELOW, ON THE PAGE THAT SITS ABOVE IT
 * ==========================================================================
 *
 * A state editor holds its regions and its districts, because a state page
 * STORES them: they are rows on that document and there is nowhere else they
 * could be edited.
 *
 * A region does not store its states and the country does not store its
 * regions — each of those is a PAGE, with its own bench, its own contacts
 * and its own editor. Copying a state’s chairman onto the region above would
 * be a second copy of one person, and the second copy is the one that goes
 * stale silently. That is the rule, and it is the right rule.
 *
 * What was WRONG was leaving the region editor silent about it. An editor
 * opened the South and found a bench and a contacts card and nothing at all
 * about the eight states under it — which reads as a tier somebody forgot,
 * not as a tier kept somewhere better. It was reported exactly that way.
 *
 * So the tier below is LISTED here, with what each page holds and a way
 * straight into it. Nothing on this card is editable and nothing on it is
 * stored: it is the hierarchy, made visible, on the screen where somebody is
 * looking for it.
 */
/**
 * One row of the tier below, as the list screen hands it over.
 *
 * `key` is what `tierOrder` stores — a state's slug, a zone's region key.
 */
interface TierRow {
    key: string;
    label: string;
    subtitle: string;
    status?: string;
    onOpen: () => void;
    href: string;
}

/**
 * THE ORDER IS THE PAGE ABOVE'S TO CHOOSE, so the arrows live here.
 *
 * `order` is the editor's arrangement and `onOrder` writes it back into the
 * draft, which means it is saved by the section's own Save like every other
 * field on the card — not by a separate write nobody asked for.
 *
 * The arrows move a row within the rows THAT EXIST, and the order is then
 * stored as the full list of their keys. Storing only the moved key would
 * leave the rest to the alphabet, so one press would rearrange rows nobody
 * touched.
 */
function TierBelow({ title, hint, rows, emptyText, order, onOrder, children }: {
    title: string;
    hint: string;
    rows: TierRow[];
    emptyText: string;
    /** The keys, in the chosen order. Names a row that may no longer exist. */
    order?: string[];
    onOrder?: (next: string[]) => void;
    /** The "add one" control, printed under the list. */
    children?: React.ReactNode;
}) {
    /*
     * The same rule the server applies, applied again here so the screen and
     * the public page cannot disagree about the order: the named rows first
     * in the order named, then everything the order has never heard of, in
     * the order it arrived — which is alphabetical.
     */
    const shown = useMemo(() => {
        const wanted = (order || []).map((k) => String(k || '').toLowerCase()).filter(Boolean);
        if (!wanted.length) return rows;
        const rank = new Map(wanted.map((k, i) => [k, i]));
        const at = (row: TierRow) => {
            const found = rank.get(String(row.key || '').toLowerCase());
            return found === undefined ? Number.MAX_SAFE_INTEGER : found;
        };
        return rows
            .map((row, index) => ({ row, index, at: at(row) }))
            .sort((a, b) => (a.at - b.at) || (a.index - b.index))
            .map((entry) => entry.row);
    }, [rows, order]);

    const move = (from: number, to: number) => {
        if (!onOrder) return;
        if (to < 0 || to >= shown.length) return;
        const next = shown.map((row) => row.key);
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        onOrder(next);
    };

    return (
        <CmsSection title={title} hint={hint}>
            {!rows.length ? (
                <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center
                              text-[1.25rem] text-slate-500 dark:border-[#2a2a2a]">
                    {emptyText}
                </p>
            ) : (
                <div className="space-y-3">
                    {shown.map((row, index) => (
                        <div
                            key={row.key}
                            className="flex items-center gap-3 rounded-xl border border-slate-200
                                       bg-white p-3.5 transition-colors hover:border-slate-300
                                       dark:border-[#2a2a2a] dark:bg-[#0f0f0f]"
                        >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center
                                             rounded-lg bg-blue-50 text-[#2563EB]
                                             dark:bg-blue-950/40">
                                <MapPin className="h-4 w-4" />
                            </span>

                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[1.25rem] font-bold text-slate-900
                                              dark:text-white">
                                    {row.label}
                                </p>
                                <p className="truncate text-[1.0625rem] text-slate-500
                                              dark:text-neutral-400">
                                    {row.subtitle}
                                </p>
                            </div>

                            {row.status && (
                                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[1.0625rem]
                                                  font-bold ${row.status === 'published'
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                    : 'bg-slate-100 text-slate-500 dark:bg-[#161616] dark:text-neutral-400'}`}
                                >
                                    {row.status === 'published' ? 'Published' : 'Draft'}
                                </span>
                            )}

                            {/*
                              * UP AND DOWN, and disabled at the ends rather
                              * than hidden: a control that disappears on the
                              * first row reads as a row that cannot be moved
                              * at all, and the column stops lining up.
                              */}
                            {onOrder && shown.length > 1 && (
                                <div className="flex shrink-0 flex-col">
                                    <button
                                        type="button"
                                        disabled={index === 0}
                                        onClick={() => move(index, index - 1)}
                                        aria-label={`Move ${row.label} up`}
                                        title="Move up"
                                        className="rounded p-1 text-slate-400 transition-colors
                                                   hover:text-[#2563EB] disabled:cursor-not-allowed
                                                   disabled:text-slate-200 dark:disabled:text-[#2a2a2a]"
                                    >
                                        <ChevronUp className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        disabled={index === shown.length - 1}
                                        onClick={() => move(index, index + 1)}
                                        aria-label={`Move ${row.label} down`}
                                        title="Move down"
                                        className="rounded p-1 text-slate-400 transition-colors
                                                   hover:text-[#2563EB] disabled:cursor-not-allowed
                                                   disabled:text-slate-200 dark:disabled:text-[#2a2a2a]"
                                    >
                                        <ChevronDown className="h-4 w-4" />
                                    </button>
                                </div>
                            )}

                            <a
                                href={row.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Open ${row.label} on the site`}
                                className="shrink-0 rounded p-2 text-slate-400 transition-colors
                                           hover:text-[#2563EB]"
                            >
                                <ExternalLink className="h-4 w-4" />
                            </a>
                            <button
                                type="button"
                                onClick={row.onOpen}
                                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg
                                           px-3 py-1.5 text-[1.0625rem] font-semibold text-blue-700
                                           transition-colors hover:bg-blue-50 dark:text-blue-400
                                           dark:hover:bg-blue-950/40"
                            >
                                <Pencil className="h-3.5 w-3.5" /> Edit its page
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {children}
        </CmsSection>
    );
}

/**
 * ==========================================================================
 * HOW THE PAGE LOOKS WHEN IT IS SHARED, AND ANYTHING ELSE IT HOLDS
 * ==========================================================================
 *
 * `seo`, `relatedLinks` and `extraFields` have been on both page schemas,
 * accepted by the write path and served by the read path, since they were
 * written — and no screen in the CMS could set any of them. A field the API
 * serves and no editor can fill is permanently empty, which is the quiet
 * half of the strict-mode trap: the loud half drops a field on save, this
 * one never lets it be set at all.
 *
 * The SEO block is not decoration. A state page pasted into WhatsApp shows
 * whatever the meta title and the share image say, and with neither set it
 * shows the site’s defaults — so every one of thirty-six states shares as
 * the same card.
 *
 * One component, both editors, because it is the same three things on both.
 */
/**
 * ==========================================================================
 * THE PAGE'S OWN HEADINGS — the words the page says about itself
 * ==========================================================================
 *
 * "State / Tamil Nadu Leaders", "Districts / District-wise Leadership",
 * "Contact / Get in Touch". These were string literals in `RegionPage` and
 * `StatePage`, drawn on every zone and state page, and editable from nowhere.
 * An editor who wanted to call their benches something the association
 * actually uses had no way to say so.
 *
 * BLANK MEANS THE WORDING IN GREY, which is the wording the page has always
 * drawn. That has to be the rule rather than "blank means blank": every page
 * in the collection predates these fields, so an absent value must keep
 * drawing what it drew yesterday. The placeholders here are the same strings
 * the client falls back to, so the box and the page cannot disagree.
 *
 * THE TITLE UNDER "Leaders" IS NOT OFFERED, and that is deliberate. The page
 * builds it from the region's own name — "Tamil Nadu Leaders", "South Zone
 * Leaders" — so storing it would freeze one region's name onto a heading that
 * is supposed to follow the page it is on. Only the eyebrow above it is
 * authored, which is the part that is the same on every page.
 */
function SectionHeadingFields({ draft, set, kind }: {
    draft: Record<string, unknown>;
    set: (patch: Record<string, unknown>) => void;
    /** Which page this is — it decides the defaults AND which fields exist. */
    kind: 'state' | 'zone' | 'national';
}) {
    const labels = (draft.labels || {}) as Record<string, string>;
    const setLabel = (patch: Record<string, string>) => set({ labels: { ...labels, ...patch } });

    /* The same three tables the public pages fall back to. Imported rather
       than retyped, so a change to the shipped wording cannot leave this
       screen showing the old words as its placeholder. */
    const shipped = kind === 'state' ? STATE_LABELS
        : kind === 'national' ? NATIONAL_LABELS : ZONE_LABELS;

    /* A zone page has no districts band, so it is not asked about one. */
    const hasDistricts = kind === 'state';

    const field = (
        key: keyof typeof shipped,
        label: string,
        hint?: string,
    ) => (
        <CmsField label={label} hint={hint}>
            <CmsInput
                value={labels[key] || ''}
                placeholder={shipped[key]}
                onChange={(e) => setLabel({ [key]: e.target.value })}
            />
        </CmsField>
    );

    return (
        <>
            <CmsSection
                title="Over the bench on this page"
                hint={`The small label above "${kind === 'state' ? 'Tamil Nadu' : 'South Zone'} Leaders". The name itself follows the page, so it is not set here.`}
            >
                {field('ownTierEyebrow', 'Small label')}
            </CmsSection>

            <CmsSection
                title={hasDistricts ? 'Over the regions' : 'Over the tier below'}
                hint={hasDistricts
                    ? 'The band listing this state’s own regions. The small label is printed as “<label> of <state>”.'
                    : 'The band listing the pages under this one.'}
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    {field('tierBelowEyebrow', 'Small label')}
                    {field('tierBelowHeading', 'Heading')}
                </div>
            </CmsSection>

            {hasDistricts && (
                <CmsSection
                    title="Over the districts"
                    hint="The band listing this state’s districts."
                >
                    <div className="grid gap-4 sm:grid-cols-2">
                        {field('districtsEyebrow', 'Small label')}
                        {field('districtsHeading', 'Heading')}
                    </div>
                </CmsSection>
            )}

            <CmsSection
                title="Over Get in Touch"
                hint="The contact band at the foot of the page."
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    {field('contactEyebrow', 'Small label')}
                    {field('contactHeading', 'Heading')}
                </div>
            </CmsSection>
        </>
    );
}

function PageMetaFields({ draft, set, what }: {
    draft: Record<string, unknown>;
    set: (patch: Record<string, unknown>) => void;
    /** "state" / "region" — what one of these pages is called, in prose. */
    what: string;
}) {
    const seo = (draft.seo || {}) as Record<string, string>;
    const setSeo = (patch: Record<string, string>) => set({ seo: { ...seo, ...patch } });

    return (
        <>
            <CmsSection
                title="When the page is shared"
                hint={`What a link to this ${what} shows in a search result, in WhatsApp and on social media. Left blank, it falls back to the site’s defaults — which are the same for every page.`}
            >
                <CmsField
                    label="Title"
                    hint="Around sixty characters. Longer is cut off mid-word."
                >
                    <CmsInput
                        value={seo.metaTitle || ''}
                        placeholder={`ACTIV ${what === 'state' ? 'Tamil Nadu' : 'South Zone'}`}
                        onChange={(e) => setSeo({ metaTitle: e.target.value })}
                    />
                </CmsField>

                <CmsField
                    label="Description"
                    hint="Two lines. This is the sentence under the title in a search result."
                >
                    <CmsTextarea
                        rows={2}
                        value={seo.metaDescription || ''}
                        onChange={(e) => setSeo({ metaDescription: e.target.value })}
                    />
                </CmsField>

                <UploadField
                    label="Share image"
                    url={seo.ogImageUrl || ''}
                    onChange={(ogImageUrl) => setSeo({ ogImageUrl })}
                    hint="Shown when the link is pasted into a chat. Wide rather than square — 1200×630 is what every platform crops to."
                />
            </CmsSection>

            <CmsSection
                title="Related links"
                hint="Extra links stored with the page. Kept with the record and served by the API; not drawn on the page as it stands."
            >
                <LinkList
                    items={(draft.relatedLinks as { label: string; href: string }[]) || []}
                    onChange={(relatedLinks) => set({ relatedLinks })}
                    noun="link"
                />
            </CmsSection>

            <CmsSection
                title="Your own fields"
                hint={`Anything else this ${what} should record that the fields above do not cover.`}
            >
                {/* `bare`: the section above is already called “Your own
                    fields”, and without it the editor draws the same heading
                    again inside it. */}
                <ExtraFieldsEditor
                    bare
                    items={(draft.extraFields as { label: string; value: string }[]) || []}
                    onChange={(extraFields) => set({ extraFields })}
                />
            </CmsSection>
        </>
    );
}

function RegionEditor({ slug, label, page, onSaved, tierRows, addTier }: {
    slug: string;
    label: string;
    page: RegionPage | null;
    onSaved: () => Promise<void> | void;
    /**
     * The tier under this page — the real pages beneath it. Listed, never
     * stored here; see `TierBelow`.
     *
     * It is rendered INSIDE the tier-below step rather than being a step of
     * its own — see the note at that step.
     */
    tierRows: TierRow[];
    /** The picker that creates one. `null` on the national page: nobody
        creates a zone, the five are the map. */
    addTier: React.ReactNode;
}) {
    const [draft, setDraft] = useState<Record<string, unknown>>(() => ({
        regionName: page?.regionName || label,
        /* THE PAGE'S OWN HEADINGS. Loaded as well as saved — a draft that
           omits a field shows an empty editor for data that is on the record,
           and `EditorShell` sends the draft, so the next save would write the
           blank back over it. That is the `stateRegions` bug noted above,
           and it is why this line exists rather than being assumed. */
        labels: page?.labels || {},

        hero: page?.hero || {},
        vision: page?.vision || {},
        shortDescription: page?.shortDescription || '',
        fullDescription: page?.fullDescription || '',
        heroCarousel: page?.heroCarousel || [],
        leaders: page?.leaders || [],
        /*
         * THE BOARDS THIS PAGE OWNS — LOADED, and they were not.
         *
         * Every other field on this draft is read off `page`; this one was
         * simply missing, so Section 3 opened empty on a zone whose record
         * held boards, said “No states yet”, and the public page drew them
         * anyway. It was reported exactly that way: the state shows on the
         * site and not in the CMS. Same class of bug as the note further
         * down about `contacts`, which says so in as many words.
         *
         * Worse than a blank card, too. `EditorShell` sends the draft, so
         * saving any part of this section wrote the empty list back over the
         * boards — the data survived only because nobody pressed Save while
         * looking at the blank.
         */
        stateRegions: page?.stateRegions || [],
        /* Which order the tier below is drawn in — saved with this card,
           like every other field on it. */
        tierOrder: page?.tierOrder || [],
        achievements: page?.achievements || [],
        keyAchievements: page?.keyAchievements || [],
        explore: page?.explore || {},
        /* The region page draws everything a state page draws — see
           `RegionPage.tsx`. Anything missing from this draft is a field the
           editor cannot reach. */
        events: page?.events || [],
        projects: page?.projects || [],
        policyAdvocacy: page?.policyAdvocacy || [],
        consultingServices: page?.consultingServices || [],
        publications: page?.publications || [],
        mediaCoverages: page?.mediaCoverages || [],
        sectorUpdates: page?.sectorUpdates || [],
        newsUpdates: page?.newsUpdates || [],
        mediaReleases: page?.mediaReleases || [],
        speakInMedia: page?.speakInMedia || [],
        customSections: page?.customSections || [],
        promoCards: page?.promoCards || [],
        socialLinks: page?.socialLinks || [],
        consultingIntro: page?.consultingIntro || '',
        consultingCta: page?.consultingCta || { label: '', href: '' },
        contact: page?.contact || {},
        /* Loaded as well as saved. A draft that omits a field shows an empty
           editor for data that is on the record — the reverse of the strict-mode
           drop, and just as quiet. */
        contacts: page?.contacts || [],
        /* Loaded as well as saved — a draft that omits a field shows an
           empty editor for data that is on the record. */
        seo: page?.seo || {},
        relatedLinks: page?.relatedLinks || [],
        extraFields: page?.extraFields || [],
        regionContactGroups: page?.regionContactGroups || [],
        districtContactGroups: page?.districtContactGroups || [],
        feedbackEnabled: page?.feedbackEnabled !== false,
        status: page?.status || 'draft',
    }));

    const set = (patch: Record<string, unknown>) => setDraft((d) => ({ ...d, ...patch }));

    /*
     * The country, not one of the five regions.
     *
     * The same editor writes both, because the national page IS a region page
     * under a reserved key — see `cms.regionMap.js`. All this decides is the
     * wording: "National leadership" rather than "Zone leadership", and
     * "Zone-wise contacts" rather than "State-wise", because the tier below
     * the country is the ZONES and the tier below a zone is the states.
     *
     * "Region" is the word for the tier inside a STATE — a state’s own
     * regions, each covering a handful of its districts — and for nothing
     * else on these screens. The five above the states are ZONES.
     */
    const national = slug === 'national';

    return (
        <EditorShell
            draft={draft}
            set={set}
            save={(payload) => saveRegionPage(slug, payload as Partial<RegionPage>)}
            onSaved={onSaved}
        >
            {/*
              * The region page draws three bands: the top band, its own bench,
              * and the contact block. Its member STATES are read from their own
              * pages — see `statePanelsOf` on the server — so there is nothing
              * to edit for them here.
              */}
            <CmsStep
                step="Section 1"
                title="The band at the top"
                hint="The picture, the title, the description and the facts."
            >
                <BandFields draft={draft} set={set} />
                {/* Part of the band — see the note on the state editor. */}
                <CommonFields draft={draft} set={set} />
            </CmsStep>

            <CmsStep
                step="Section 2"
                title={national ? "National leadership" : "Zone leadership"}
                hint="The row of portraits under the band, with their photographs and contact details."
            >
                <LeadersSection draft={draft} set={set} />
            </CmsStep>

            {/*
              * ==================================================================
              * THE TIER BELOW, AND THEN THE CONTACTS — IN THAT ORDER
              * ==================================================================
              *
              * The state editor reads band → leadership → its regions → its
              * districts → CONTACTS, and contacts are last there because they
              * are last on the page: Get in Touch is the bottom of every one
              * of these screens. This editor had them third, which put the
              * one card an editor writes once above the two they come back
              * to, and read as a different product from the state editor.
              *
              * Same order here, at every tier. Nothing else moved.
              */}
            {/*
              * ==================================================================
              * ONE CARD FOR THE TIER BELOW, NOT TWO
              * ==================================================================
              *
              * This was two steps carrying the SAME heading — “State
              * leadership” listing the boards typed onto this page, and “State
              * leadership” again listing the real state pages underneath it.
              * Two cards with one name is a screen that cannot tell an editor
              * which one they are looking at, and the empty one read as the
              * tier being missing while the full one sat directly below it.
              *
              * They are the two halves of ONE answer — what the public page
              * draws — so they are one card, in the order the page draws them:
              * the pages that exist, then the boards written by hand here.
              * `RegionPage` ADDS them together now; it used to pick one list or
              * the other, which is how a single hand-written board hid eight
              * real state pages.
              */}
            <CmsStep
                step="Section 3"
                title={national ? "Zone leadership" : "State leadership"}
                hint={national
                    ? "The zones as the national page draws them — the zone pages themselves, plus any board written by hand on this page."
                    : `The states as the ${label} Zone page draws them — the state pages themselves, plus any board written by hand on this page.`}
            >
                <TierBelow
                    title={national ? 'Zone pages' : `State pages in the ${label} Zone`}
                    hint={national
                        ? "Each zone is its own page with its own bench and its own contacts — edited there, listed here, never copied onto this one. The arrows set the order the national page draws them in."
                        : "Each state is its own page with its own bench, its own districts and its own contacts — edited there, listed here, never copied onto this one. The arrows set the order this page draws them in; a state with neither a bench nor a contact is not drawn at all."}
                    emptyText={national
                        ? "No zone pages yet."
                        : "No state pages in this zone yet. Create one below and it appears here, with its own page behind it."}
                    rows={tierRows}
                    order={(draft.tierOrder as string[]) || []}
                    onOrder={(tierOrder) => set({ tierOrder })}
                >
                    {addTier}
                </TierBelow>

                <TierSection
                    field="stateRegions"
                    draft={draft}
                    set={set}
                    pageName={String(draft.regionName || label)}
                    title={national ? 'Zones written on this page' : 'States written on this page'}
                    hint={national
                        ? "For a zone that has no page of its own. Drawn after the zone pages above, never instead of them — and a board naming a zone that IS listed above is not drawn at all, because that zone’s own page is the one a reader should meet. A board here belongs to THIS page and never touches that zone’s."
                        : "For a state that has no page of its own. Drawn after the state pages above, never instead of them — and a board naming a state that IS listed above is not drawn at all, because that state’s own page is the one a reader should meet. A board here belongs to THIS page and never touches that state’s."}
                    nameLabel={national ? "Zone" : "State"}
                    namePlaceholder={national ? "South Zone" : "Tamil Nadu"}
                    addLabel={national ? "Add zone" : "Add state"}
                    emptyText={national
                        ? "Nothing written by hand — the zone pages above are what this page draws."
                        : "Nothing written by hand — the state pages above are what this page draws."}
                    coversLabel="What it covers"
                    coversPlaceholder={national ? "Eight states and union territories" : "Its districts"}
                />
            </CmsStep>

            {/*
              * ==================================================================
              * THE SAME CONTACTS CARD THE STATE EDITOR HAS, AND LAST
              * ==================================================================
              *
              * A state’s Get in Touch is its own contacts, then a group per
              * region, then a group per district. A region’s is its own
              * contacts and then a group per state; the country’s is its own
              * and then a group per region. One shape at three levels, with
              * only the word for the tier below changing.
              *
              * It writes the SAME field, `regionContactGroups`. A second
              * field per level would be three names for one idea and three
              * places to forget one; the tier a group belongs to is decided
              * by the page it is on.
              *
              * NOTHING HERE IS A LEADER. The bench is Section 2, the boards
              * are Section 3, and neither creates the other.
              */}
            <CmsStep
                step="Section 4"
                title="Contacts"
                hint={national
                    ? "Everything in Get in Touch on the national page. Nothing on this card is a leader."
                    : "Everything in Get in Touch on this zone page. Nothing on this card is a leader."}
            >
                <PageContacts
                    draft={draft}
                    set={set}
                    title={national ? "National contacts" : `${label} Zone contacts`}
                    where={national ? "national office" : "zone office"}
                    tier={national ? "ACTIV India" : `${label} Zone`}
                />

                <CmsSection
                    title={national ? "Zone-wise contacts" : "State-wise contacts"}
                    hint={national
                        ? "One group per heading, printed under the national contacts. A group here creates no board and no map marker."
                        : "One group per heading, printed under this zone’s contacts. A group here creates no board and no map marker. A state that publishes its own contact is listed automatically, from its own page."}
                >
                    <ContactGroups
                        field="regionContactGroups"
                        draft={draft}
                        set={set}
                        label={national ? "zone" : "state"}
                        placeholder={national ? "South Zone" : "Tamil Nadu"}
                    />
                </CmsSection>
            </CmsStep>
            {/*
              * LAST, because it is about the page rather than on it.
              *
              * Everything above writes something a reader sees. This writes how
              * the page looks when it is SHARED, plus anything the association
              * wants recorded that the fields above do not cover.
              */}
            <CmsStep
                step="Section 5"
                title="Section headings"
                hint="What this page calls its own bands. Leave one blank and the page uses the wording in grey."
            >
                <SectionHeadingFields
                    draft={draft}
                    set={set}
                    kind={national ? 'national' : 'zone'}
                />
            </CmsStep>

            <CmsStep
                step="Section 6"
                title="Sharing and extras"
                hint={`How a link to this ${national ? 'page' : 'zone'} appears in a search result or a chat, and any field you want to add of your own.`}
            >
                <PageMetaFields draft={draft} set={set} what={national ? 'page' : 'zone'} />
            </CmsStep>

            {/*
              * ONLY WHAT THE PAGE ACTUALLY DRAWS.
              *
              * Everything between the contact section and the end of this editor
              * used to be here: Highlights, Key Achievements, Events, Projects,
              * Policy Advocacy, Consulting Services, Publications, Media Releases,
              * Media Coverages, Sector and News Updates, custom sections,
              * promotional cards, social links, the consulting copy — and the
              * photographs. None of it is drawn.
              *
              * I read the public components rather than trusting the banner that
              * used to sit here. `StatePage.tsx` renders `hero`,
              * `shortDescription`, `leaders`, `stateRegions`, `districts` and
              * `contact`. `RegionPage.tsx` renders `hero`, `shortDescription`,
              * `leaders` and `contact`. Every other field appears in those files
              * only inside comments.
              *
              * The banner offered `/states/:slug/:type` as where that content
              * still surfaced. Those routes exist in `App.tsx` and NOTHING LINKS
              * TO THEM — reachable only by typing a URL.
              *
              * THE PHOTOGRAPHS WENT FOR A DIFFERENT REASON. They are real
              * content and they are reachable, but they are not this page: they
              * belong to the gallery, and the gallery has a CMS screen of its own
              * at `/cms/gallery`. Editing the same collection from two places is
              * how two screens end up disagreeing about what is in it.
              *
              * NO DATA WAS TOUCHED. Removing an editor removes no field — the API
              * still returns them and the documents still hold them, so restoring
              * a section is a code change with everything already typed intact.
              */}
        </EditorShell>
    );
}

function StateEditor({ slug, page, onSaved }: {
    slug: string;
    page: StatePage;
    onSaved: () => Promise<void> | void;
}) {
    const [draft, setDraft] = useState<Record<string, unknown>>(() => ({
        /* THE PAGE'S OWN HEADINGS. Loaded as well as saved — a draft that
           omits a field shows an empty editor for data that is on the record,
           and `EditorShell` sends the draft, so the next save would write the
           blank back over it. That is the `stateRegions` bug noted above,
           and it is why this line exists rather than being assumed. */
        labels: page.labels || {},
        hero: page.hero,
        vision: page.vision,
        explore: page.explore,
        promoCards: page.promoCards,
        socialLinks: page.socialLinks,
        consultingIntro: page.consultingIntro,
        consultingCta: page.consultingCta,
        shortDescription: page.shortDescription,
        fullDescription: page.fullDescription,
        heroCarousel: page.heroCarousel,
        leaders: page.leaders,
        /* The third tier of the public page's leadership board. Absent from
           this draft is a field the editor cannot reach — see the note at the
           head of `cms.regionPages.service.js`. */
        /* The state's OWN regions, and its districts. Two tiers, one shape —
           see `stateRegionSchema` on the server for why they are separate from
           the NATIONAL region this state belongs to. */
        stateRegions: page.stateRegions || [],
        districts: page.districts || [],
        achievements: page.achievements,
        keyAchievements: page.keyAchievements || [],
        events: page.events,
        projects: page.projects,
        policyAdvocacy: page.policyAdvocacy,
        consultingServices: page.consultingServices,
        publications: page.publications,
        mediaReleases: page.mediaReleases,
        mediaCoverages: page.mediaCoverages,
        customSections: page.customSections || [],
        contact: page.contact,
        contacts: page.contacts || [],
        /* Loaded as well as saved — a draft that omits a field shows an
           empty editor for data that is on the record. */
        seo: page.seo || {},
        relatedLinks: page.relatedLinks || [],
        extraFields: page.extraFields || [],
        regionContactGroups: page.regionContactGroups || [],
        districtContactGroups: page.districtContactGroups || [],
        feedbackEnabled: page.feedbackEnabled !== false,
        status: page.status,
    }));

    const set = (patch: Record<string, unknown>) => setDraft((d) => ({ ...d, ...patch }));
    const contact = (draft.contact || {}) as Record<string, unknown>;
    const setContact = (patch: Record<string, unknown>) => set({ contact: { ...contact, ...patch } });

    return (
        <EditorShell
            draft={draft}
            set={set}
            save={(payload) => saveStatePage(slug, payload as Partial<StatePage>)}
            onSaved={onSaved}
        >
            {/*
              * IN THE ORDER THE PAGE DRAWS THEM.
              *
              *   1  the band at the top
              *   2  the state council's bench
              *   3  the district chapters
              *   4  the contact block
              *
              * The REGION tier is deliberately absent: it is the region's own
              * bench, edited on the region's page, and read from there on every
              * request — see `regionPanelOf` on the server. A copy of it here
              * would be a second answer that goes stale the moment one of the
              * two is edited.
              */}
            <CmsStep
                step="Section 1"
                title="The band at the top"
                hint="The picture, the title, the description and the four facts."
            >
                <BandFields draft={draft} set={set} withGlance={false} />
                {/*
                  * THE DESCRIPTION IS PART OF THE BAND, so it is inside Section 1.
                  *
                  * It sat in a card of its own between Sections 1 and 2 — an
                  * unnumbered panel headed "Description" that an editor had to
                  * guess the place of. It is not a section of the page: it is the
                  * paragraph printed in the band, and the band is Section 1.
                  *
                  * It also reads in the right order now. The band's own "Longer
                  * introduction" REPLACES this line when it is filled in, and a
                  * field that overrides another belongs next to it, not a card
                  * away.
                  */}
                <CommonFields draft={draft} set={set} />
            </CmsStep>

            <CmsStep
                step="Section 2"
                title="State leadership"
                hint="The row of portraits under the band. Their photographs and contact details are here too."
            >
                <LeadersSection draft={draft} set={set} />
            </CmsStep>

            <CmsStep
                step="Section 3"
                title="Region leadership"
                hint="THIS STATE's own regions — its North, South, East and West. Not the national region the state belongs to, which is edited on that region's own page. Each region is a card: its office-bearers, its own contacts, and how many active members to show on the map."
            >
            <TierSection
                pageName={page.stateName}
                field="stateRegions"
                draft={draft}
                set={set}
                title="Regions of this state"
                hint="A zone inside the state, covering a group of its districts. Each one gets its own row of portraits on the page."
                addLabel="Add region"
                nameLabel="Region"
                namePlaceholder="South"
                coversLabel="Districts it covers"
                coversPlaceholder="Madurai, Tirunelveli, Thoothukudi and Virudhunagar"
                emptyText="No regions yet. The state page draws the state's bench and its districts until one is added."
            />
            </CmsStep>

            <CmsStep
                step="Section 4"
                title="District leadership"
                hint="One panel per district chapter, matched to the map by name. Each card holds its office-bearers, its own contacts, which region it sits in — which colours it on the map — and how many active members to show on its marker."
            >
            <TierSection
                pageName={page.stateName}
                /* Districts are checked against this state’s boundaries;
                   regions are not, having no dataset to be checked against. */
                stateSlug={page.slug}
                field="districts"
                draft={draft}
                set={set}
                title="District chapters"
                hint="One per district the association has a chapter in. Matched to the map by name."
                addLabel="Add district"
                nameLabel="District"
                namePlaceholder="Chennai"
                coversLabel="What the district makes"
                coversPlaceholder="Automotive assembly, electronics and industrial services"
                emptyText="No districts yet. The state page draws two benches until one is added."
            />
            </CmsStep>

            {/*
              * ==================================================================
              * ONE CARD FOR EVERY CONTACT ON THE PAGE
              * ==================================================================
              *
              * This was three numbered sections — 5 Contact, 6 Region contacts,
              * 7 District contacts — which split one question across three cards
              * and put two of them below the leadership boards, so an editor
              * adding a district contact scrolled past four benches to reach it.
              *
              * Get in Touch is ONE block on the page with three kinds of group in
              * it. The editor for it is one card with those three kinds in it, in
              * the order the page prints them: the state office, then the state,
              * then the regions, then the districts.
              *
              * NOTHING HERE TOUCHES THE LEADERSHIP. Sections 2, 3 and 4 are
              * benches — portraits, member counts, map markers. This is the
              * directory. The two share no field and neither creates the other.
              */}
            <CmsStep
                step="Section 5"
                title="Contacts"
                hint="Everything in Get in Touch, in the order the page prints it. Nothing on this card is a leader — the benches are in Sections 2, 3 and 4."
            >
                <PageContacts
                    draft={draft}
                    set={set}
                    title="State-wise contacts"
                    where="state office"
                    tier={`${page.stateName} State Council`}
                />

                <CmsSection
                    title="Region-wise contacts"
                    hint="One group per heading. A group here creates no bench, no map marker and no member count — and a region with a bench does not get a group until you add one."
                >
                    <ContactGroups
                        field="regionContactGroups"
                        draft={draft}
                        set={set}
                        label="region"
                        placeholder="North Region"
                    />
                </CmsSection>

                <CmsSection
                    title="District-wise contacts"
                    hint="One group per heading, on the same terms as the regions above."
                >
                    <ContactGroups
                        field="districtContactGroups"
                        draft={draft}
                        set={set}
                        label="district"
                        placeholder="Chennai District"
                    />
                </CmsSection>
            </CmsStep>
            {/*
              * LAST, because it is about the page rather than on it.
              *
              * Everything above writes something a reader sees. This writes how
              * the page looks when it is SHARED, plus anything the association
              * wants recorded that the fields above do not cover.
              */}
            <CmsStep
                step="Section 6"
                title="Section headings"
                hint="What this page calls its own bands. Leave one blank and the page uses the wording in grey."
            >
                <SectionHeadingFields draft={draft} set={set} kind="state" />
            </CmsStep>

            <CmsStep
                step="Section 7"
                title="Sharing and extras"
                hint="How a link to this state appears in a search result or a chat, and any field you want to add of your own."
            >
                <PageMetaFields draft={draft} set={set} what="state" />
            </CmsStep>
        </EditorShell>
    );
}

/**
 * The save bar every editor shares.
 *
 * `status` is the only control here that changes who can see the page, so it
 * sits beside the save button rather than in a section an editor has to scroll
 * to — publishing should never be something you have to go looking for.
 */
function EditorShell({ draft, set, save, onSaved, children }: {
    draft: Record<string, unknown>;
    set: (patch: Record<string, unknown>) => void;
    save: (payload: Record<string, unknown>) => Promise<unknown>;
    onSaved: () => Promise<void> | void;
    children: React.ReactNode;
}) {
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    /*
     * IS THERE ANYTHING TO SAVE?
     *
     * An editor uploaded a picture, watched it appear, and found the record
     * unchanged — because uploading fills the FORM and saving is what writes
     * it. The form never said so. `clean` is the draft as it was when this
     * editor opened or last saved; anything different from it is unsaved work,
     * and the bar says so until the write goes through.
     */
    const [clean, setClean] = useState(() => JSON.stringify(draft));
    const dirty = JSON.stringify(draft) !== clean;

    const submit = async () => {
        setSaving(true);
        try {
            await save(draft);
            setClean(JSON.stringify(draft));
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
            toast.success('Saved — the live page is updated');
            await onSaved();
        } catch (err) {
            toast.error(errorMessage(err, 'That could not be saved'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <SaveNowProvider value={{ save: submit, saving, dirty }}>
        {/*
          * THE GAP BETWEEN SECTION CARDS LIVES HERE, AND ONLY HERE.
          *
          * It was `space-y-0` on this wrapper and `mb-7` on each card — two
          * mechanisms for one measurement, and the one that lost was the one you
          * could see: the cards sat a few pixels apart, so the tinted footer band
          * of one and the tinted header band of the next read as a single strip
          * and the boundary between sections disappeared.
          *
          * `space-y-8` — 32px — set in one place, on the container that actually
          * owns the rhythm. The cards carry no bottom margin at all now, so there
          * is nothing left to disagree with.
          */}
        <div className="space-y-8">
            {children}

            <div className="flex flex-wrap items-center gap-3 pt-6 mt-6 border-t border-slate-200
                            dark:border-[#1f1f1f]">
                <select
                    value={String(draft.status || 'draft')}
                    onChange={(e) => set({ status: e.target.value })}
                    className="h-12 px-4 rounded-lg border border-slate-300 dark:border-[#2a2a2a]
                               bg-white dark:bg-[#0b0b0b] text-[1.25rem] font-medium
                               text-slate-900 dark:text-neutral-100"
                >
                    <option value="draft">Draft — not on the public site</option>
                    <option value="published">Published — live</option>
                </select>

                <CmsButton onClick={submit} disabled={saving} variant={dirty ? 'primary' : 'ghost'}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" />
                        : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Saving…' : saved ? 'Saved' : 'Save page'}
                </CmsButton>

                {dirty && !saving && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-amber-50
                                     dark:bg-amber-950/30 px-3.5 py-2 text-[1.0625rem] font-semibold
                                     text-amber-700 dark:text-amber-400">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        Unsaved changes — press Save page
                    </span>
                )}
            </div>
        </div>
        </SaveNowProvider>
    );
}

/* ------------------------------------------------------------------- rows */

function AddRowButton({ label, onClick }: { label: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[1.1875rem] font-medium
                       text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30
                       hover:bg-blue-500/10"
        >
            <Plus className="w-3.5 h-3.5" /> {label}
        </button>
    );
}

/** Move a row up or down, and delete it. Reordering is the common operation. */
function RowTools<T>({ rows, index, onChange }: {
    rows: T[]; index: number; onChange: (rows: T[]) => void;
}) {
    const move = (step: number) => {
        const next = [...rows];
        const target = index + step;
        if (target < 0 || target >= next.length) return;
        [next[index], next[target]] = [next[target], next[index]];
        /* The stored order is rewritten from the new positions — a list that
           looks right in the editor and comes back shuffled on the site is the
           bug this avoids. */
        onChange(next.map((row, i) => ({ ...row, displayOrder: i + 1 })));
    };

    return (
        <div className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={() => move(-1)} disabled={index === 0}
                aria-label="Move up"
                className="p-1.5 rounded text-slate-400 hover:bg-slate-100 disabled:opacity-30">
                <ChevronUp className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => move(1)} disabled={index === rows.length - 1}
                aria-label="Move down"
                className="p-1.5 rounded text-slate-400 hover:bg-slate-100 disabled:opacity-30">
                <ChevronDown className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => onChange(rows.filter((_, i) => i !== index))}
                aria-label="Remove"
                className="p-1.5 rounded text-red-500 hover:bg-red-500/10">
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
    );
}

function SlideRows({ rows, onChange }: { rows: RegionSlide[]; onChange: (rows: RegionSlide[]) => void }) {
    if (!rows.length) {
        return <p className="text-[1.25rem] text-slate-500 dark:text-neutral-400">No slides yet.</p>;
    }

    const patch = (i: number, next: Partial<RegionSlide>) =>
        onChange(rows.map((row, index) => (index === i ? { ...row, ...next } : row)));

    return (
        <div className="space-y-4">
            {rows.map((row, i) => (
                <div key={i} className="rounded-lg border border-slate-200 dark:border-[#2a2a2a] p-3">
                    <div className="flex items-start gap-3">
                        <ImageIcon className="w-4 h-4 text-neutral-400 mt-2.5 shrink-0" />
                        <div className="flex-1 min-w-0 space-y-3">
                            <MediaPicker
                                label="Photograph"
                                value={row.media}
                                onChange={(media) => patch(i, { media })}
                            />
                            <CmsField label="Caption">
                                <CmsInput
                                    value={row.caption}
                                    placeholder="Who is in the photograph, and when"
                                    onChange={(e) => patch(i, { caption: e.target.value })}
                                />
                            </CmsField>
                        </div>
                        <RowTools rows={rows} index={i} onChange={onChange} />
                    </div>
                </div>
            ))}
        </div>
    );
}

/* ---------------------------------------------------------------- districts */

const blankDistrict = (index: number): RegionDistrict => ({
    id: '', name: '', description: '', slug: '',
    leaders: [],
    contacts: [],
    activeMembers: 0,
    regionName: '',
    contact: {
        personName: '', photoUrl: '', designation: '', addressLines: [],
        city: '', state: '', country: 'India', pincode: '', email: '', phone: '', mapUrl: '',
    },
    displayOrder: index + 1,
    isHidden: false,
});

/**
 * ONE TIER OF THE LEADERSHIP BOARD — a state's regions, or its districts.
 *
 * =========================================================================
 * TWO TIERS, ONE EDITOR
 * =========================================================================
 *
 * A region of a state and a district of a state are the same object at two
 * scales: a name, a line saying what it covers, a bench, and a way to reach it.
 * Two editors would be two places to add the next field and one place to forget
 * it — which is exactly how the district editor came to have a contact and the
 * region tier had none.
 *
 * The WORDS differ, and they matter, so they are props: an editor filling in
 * "Districts it covers" for a region is being asked a different question from
 * one filling in "What the district makes", and a shared component that says
 * "Name" to both is a component that has saved itself effort at the editor's
 * expense.
 *
 * NEITHER of these is the national region. See `stateRegionSchema` on the
 * server: "South Region" on the Tamil Nadu page means the southern districts of
 * Tamil Nadu, and "South Region" in the menu means eight states.
 */
interface TierWords {
    title: string;
    hint: string;
    addLabel: string;
    nameLabel: string;
    namePlaceholder: string;
    coversLabel: string;
    coversPlaceholder: string;
    emptyText: string;
}

/**
 * ==========================================================================
 * ONE HEADING PER SECTION
 * ==========================================================================
 *
 * The card already has a header band — "SECTION 4 · District leadership" —
 * and these components then opened with a `CmsSection` of their own:
 *
 *     SECTION 4
 *     District leadership
 *     One panel per district chapter…
 *
 *     District chapters
 *     One per district the association has a chapter in…
 *
 * Two titles and two explanations, six lines apart, for one list. A reader
 * has to work out whether "District chapters" is a sub-part of "District
 * leadership" or another name for it — and it is another name for it.
 *
 * The card header is the heading now, and these render the Add button alone.
 * The same fault was in the leadership section ("Section 2 · State
 * leadership", then "Leadership") and is fixed the same way.
 */
function AddRow({ children }: { children: React.ReactNode }) {
    return <div className="mb-4 flex justify-end">{children}</div>;
}

/**
 * ==========================================================================
 * A DISTRICT DRAWS A MARKER BECAUSE ITS NAME MATCHES A BOUNDARY
 * ==========================================================================
 *
 * That is the whole of the link between this screen and the map, and until
 * now this screen said nothing about it. A district was entered as
 * "TIRUVANNAMALI" — one letter short of the census "Tiruvannamalai" — with
 * an office-bearer, five members and a region assigned, and it drew nothing
 * at all. Everything on the card looked saved, because everything on the
 * card WAS saved.
 *
 * So the name field is checked against the boundaries the map will actually
 * use, on `@/data/maps/match` — the same rule, not a copy of it — and the
 * closest spellings are offered as buttons that fill the field in.
 *
 * A WARNING, NEVER A BLOCK. The dataset is Census of India 2011 and the
 * association is not: six Tamil Nadu districts created since are aliased to
 * the district they were cut out of, and a genuinely new one that nothing
 * has heard of must still be publishable. The note says the marker will not
 * be drawn, which is a fact, and leaves the rest to the editor.
 *
 * The boundaries are LAZY-LOADED, exactly as the public map loads them, so
 * an editor who never opens a state page never fetches one. Until they
 * arrive nothing is claimed — a validator that reports every name as wrong
 * while it is still loading is a validator nobody reads twice.
 */
/**
 * One drawable district: what it is called, and which quarter of the state
 * it is in.
 *
 * The ZONE is the half that stops the second mistake. A district is coloured
 * on the map by the CMS region an editor picks for it, and the popover's
 * heading prints the geographic zone — so choosing the wrong one drew
 * Tiruvannamalai in the South’s green under a heading reading "NORTH · TAMIL
 * NADU", and nothing anywhere said which of the two was wrong.
 */
type DistrictShape = { name: string; zone?: string };

function useDistrictShapes(stateSlug?: string) {
    const [shapes, setShapes] = useState<DistrictShape[] | null>(null);

    useEffect(() => {
        const load = stateSlug ? stateMaps[stateSlug] : undefined;
        if (!load) { setShapes(null); return undefined; }

        let cancelled = false;
        load()
            .then((mod) => {
                if (cancelled) return;
                setShapes((mod.default.districts || [])
                    .map((d) => ({ name: d.name, zone: d.zone }))
                    .sort((a, b) => a.name.localeCompare(b.name)));
            })
            /* No map, or a failed chunk, means "cannot say" — not "wrong". */
            .catch(() => { if (!cancelled) setShapes(null); });

        return () => { cancelled = true; };
    }, [stateSlug]);

    return shapes;
}

/**
 * How far wrong a typed name may be and still be offered as the one meant.
 *
 * Proportional to length, because one wrong letter in "Erode" is a different
 * kind of mistake from one wrong letter in "Tiruchirappalli", and capped at
 * three so a long name cannot drag in half the state. The same budget
 * `RegionInput` uses on the admin screens, for the same reason.
 */
const nameBudget = (needle: string) => Math.min(3, Math.max(1, Math.floor(needle.length / 4)));

/** Levenshtein, abandoned the moment it cannot come in under `budget`. */
const nameDistance = (a: string, b: string, budget: number): number => {
    if (Math.abs(a.length - b.length) > budget) return budget + 1;

    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const row = new Array<number>(b.length + 1);
        row[0] = i;
        let best = row[0];
        for (let j = 1; j <= b.length; j++) {
            row[j] = Math.min(
                prev[j] + 1,
                row[j - 1] + 1,
                prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
            );
            if (row[j] < best) best = row[j];
        }
        if (best > budget) return budget + 1;
        prev = row;
    }
    return prev[b.length];
};

/**
 * The shapes a mistyped name was probably meant to be, nearest first.
 *
 * A substring pass runs first — half a name typed is not a typo, it is a
 * name half typed — and the edit-distance pass only when that finds nothing,
 * so the expensive comparison is off the common path entirely.
 */
const nearestShapes = (typed: string, shapes: DistrictShape[], limit = 4) => {
    const needle = normaliseDistrict(typed);
    if (!needle) return shapes.slice(0, limit);

    const substring = shapes.filter((s) => normaliseDistrict(s.name).includes(needle));
    if (substring.length) return substring.slice(0, limit);

    const budget = nameBudget(needle);
    return shapes
        .map((s) => ({ s, d: nameDistance(needle, normaliseDistrict(s.name), budget) }))
        .filter((x) => x.d <= budget)
        .sort((a, b) => a.d - b.d)
        .slice(0, limit)
        .map((x) => x.s);
};

/** The shape this name IS, exactly — the test the map itself applies. */
const exactShape = (typed: string, shapes: DistrictShape[] | null | undefined) =>
    (shapes || []).find((s) => normaliseDistrict(s.name) === normaliseDistrict(typed));

/**
 * The region a district belongs in, out of the ones this state has.
 *
 * The generated zone is a compass point — `north`, `east`, `south`, `west`.
 * An association names its own regions and usually names them the same way,
 * so "North" matches `north` and the field can fill itself. When it has
 * called them something else — Kongu, Cauvery Delta — nothing matches and
 * nothing is guessed: a region invented by the association is not derivable
 * from geometry, and filling it with the nearest compass point would be the
 * form making up an answer.
 */
const regionForZone = (zone: string | undefined, options: string[]) => {
    if (!zone) return '';
    const want = zone.toLowerCase().replace(/[^a-z]/g, '');
    return (options || []).find((o) => {
        const key = String(o || '').toLowerCase().replace(/\bregion\b/g, '')
            .replace(/[^a-z]/g, '');
        return key === want;
    }) || '';
};

/**
 * ==========================================================================
 * THE DISTRICT IS PICKED FROM THE MAP, NOT TYPED AT IT
 * ==========================================================================
 *
 * It was a plain text box with a warning under it, and the warning was doing
 * a job a warning cannot do. An editor typed "TIRUVANNAMALI", was told after
 * the fact that it would draw no marker, and had to read the message, find
 * the suggestion and click it — three steps to undo a mistake the field
 * should not have accepted quietly in the first place.
 *
 * Typing now offers the districts this state actually has. The list opens on
 * focus, narrows as the name is typed, and tolerates a misspelling: the same
 * bounded edit-distance pass the warning used, so "tiruvannamali" offers
 * Tiruvannamalai on the FIRST keystroke past the mistake rather than after
 * the save.
 *
 * ------------------------------------------- and the region fills itself in
 *
 * Choosing a district sets the region to the quarter of the state that
 * district is in. That was the second half of the same report: Tiruvannamalai
 * was saved under South, so the map drew it in South’s green while the
 * popover printed "NORTH · TAMIL NADU" over it, and neither screen said which
 * of the two was the mistake.
 *
 * The region stays a dropdown an editor can change afterwards. It is their
 * association and their regions — this only stops the field starting empty,
 * or worse, starting on whatever the last district was set to.
 *
 * FREE TEXT IS STILL ACCEPTED. A district the dataset has not caught up with
 * must remain publishable, so anything can be typed and nothing is refused;
 * what changes is that the right answer is now the easy one. The warning
 * stays below for a name that really is not on the map.
 */
function DistrictNameInput({ value, shapes, placeholder, onPick, onType }: {
    value: string;
    shapes: DistrictShape[];
    placeholder: string;
    /** A district chosen from the list — carries its zone, so the region can follow. */
    onPick: (shape: DistrictShape) => void;
    /** Anything else typed. Never refused. */
    onType: (name: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const box = useRef<HTMLDivElement | null>(null);

    /* A click anywhere else closes it. Without this the list stays open behind
       the next card an editor opens, over fields they are trying to read. */
    useEffect(() => {
        if (!open) return undefined;
        const away = (e: MouseEvent) => {
            if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', away);
        return () => document.removeEventListener('mousedown', away);
    }, [open]);

    const matches = useMemo(() => nearestShapes(value, shapes, 8), [value, shapes]);
    const exact = exactShape(value, shapes);

    return (
        <div ref={box} className="relative">
            <CmsInput
                value={value}
                placeholder={placeholder}
                onFocus={() => setOpen(true)}
                onChange={(e) => { onType(e.target.value); setOpen(true); }}
                onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
            />

            {open && matches.length > 0 && (
                <ul
                    role="listbox"
                    className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border
                               border-slate-200 bg-white py-1 shadow-lg dark:border-[#2a2a2a]
                               dark:bg-[#0b0b0b]"
                >
                    {matches.map((shape) => {
                        const chosen = exact && exact.name === shape.name;
                        return (
                            <li key={shape.name}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={!!chosen}
                                    onClick={() => { onPick(shape); setOpen(false); }}
                                    className={`flex w-full items-center justify-between gap-3 px-3 py-2
                                                text-left text-[1.1875rem] hover:bg-blue-50
                                                dark:hover:bg-blue-950/30 ${chosen
                                        ? 'font-bold text-[#2563EB]'
                                        : 'font-medium text-slate-700 dark:text-neutral-200'}`}
                                >
                                    <span className="truncate">{shape.name}</span>
                                    {/* The quarter of the state, so an editor can see the
                                        region is about to be set and to what. */}
                                    {shape.zone && (
                                        <span className="shrink-0 text-[1.0625rem] font-semibold uppercase
                                                         tracking-wide text-slate-400">
                                            {shape.zone}
                                        </span>
                                    )}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

function TierSection({ field, draft, set, pageName, stateSlug, ...words }: TierWords & {
    field: 'stateRegions' | 'districts';
    draft: Record<string, unknown>;
    set: (patch: Record<string, unknown>) => void;
    pageName?: string;
    /** Set on the DISTRICT list only: the state whose boundaries to check. */
    stateSlug?: string;
}) {
    const rows = (draft[field] as RegionDistrict[]) || [];

    /* Loaded once for the whole list, not once per card: thirty-eight
       districts on one screen would otherwise be thirty-eight subscriptions
       to the same import. */
    const shapes = useDistrictShapes(stateSlug);

    return (
        <>
            <AddRow>
                <AddRowButton
                    label={words.addLabel}
                    onClick={() => set({ [field]: resequenceTiers([blankDistrict(0), ...rows]) })}
                />
            </AddRow>
            <DistrictRows
                rows={rows}
                onChange={(next) => set({ [field]: next })}
                words={words}
                pageName={pageName}
                shapes={shapes}
                /* Districts choose a region; regions do not. */
                regionOptions={field === 'districts'
                    ? ((draft.stateRegions as RegionDistrict[]) || [])
                        .map((r) => r?.name)
                        .filter(Boolean) as string[]
                    : []}
            />
        </>
    );
}

/** Positions rewritten from the array, after any insert, move or delete. */
const resequenceTiers = (rows: RegionDistrict[]) =>
    rows.map((row, i) => ({ ...row, displayOrder: i + 1 }));

/**
 * ==========================================================================
 * ONE CARD PER REGION, ONE CARD PER DISTRICT
 * ==========================================================================
 *
 * A state has four regions and as many district chapters as it has chapters,
 * and each of those carries its own bench of five office-bearers. Rendered
 * open, that is four or five hundred inputs in one column: the Tamil Nadu page
 * ran to six district panels, every one of them showing every field of every
 * person, and finding "Madurai" meant scrolling past forty name boxes.
 *
 * Each tier is a CARD now, closed by default, showing the name, what it covers
 * and how many office-bearers it holds. Open the one you came for. It is the
 * same treatment as the office-bearer cards inside it, and the same as the
 * Home page editor the association pointed at as the one that works.
 *
 * ADDING ONE IN THE RIGHT PLACE, as with the leaders: "Add region" and "Add
 * district" put the new card at the TOP where the button is, and every card
 * carries "Add above" / "Add below" for an exact position. A new district
 * appended to the end of six was a card the editor had to go and find.
 *
 * `displayOrder` is rewritten from the array positions on every one of those
 * operations — it is what the public page sorts the benches by.
 */
function DistrictRows({ rows, onChange, words, regionOptions, pageName, shapes }: {
    rows: RegionDistrict[];
    onChange: (rows: RegionDistrict[]) => void;
    words: TierWords;
    /**
     * The state this page is for — used only to warn when a tier has been
     * given the state's own name. See the note on the warning below.
     */
    pageName?: string;
    /**
     * The names of the state's own regions, for the district dropdown.
     *
     * Passed in rather than read from a context because the SAME component
     * draws the regions themselves, and a region has no region to sit in —
     * the regions list gets an empty array and the control disappears.
     */
    regionOptions?: string[];
    /**
     * The district names the map can draw, or `null` for "cannot say" — a
     * state with no generated map, or one still loading. Null means the
     * warning is not shown, because an unknown is not a mistake.
     */
    shapes?: DistrictShape[] | null;
}) {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const patch = (i: number, next: Partial<RegionDistrict>) =>
        onChange(rows.map((row, index) => (index === i ? { ...row, ...next } : row)));

    const patchContact = (i: number, next: Record<string, unknown>) =>
        patch(i, { contact: { ...rows[i].contact, ...next } as RegionDistrict['contact'] });

    const insertAt = (at: number) => {
        const next = [...rows];
        next.splice(at, 0, blankDistrict(at));
        mine.current = true;
        onChange(resequenceTiers(next));
        setOpenIndex(at);
    };

    /* A card added from the SECTION heading — above this list, so it cannot
       reach `setOpenIndex` — still opens itself. See the same note on
       `LeaderRows`; `mine` is what tells the two sources apart. */
    const mine = useRef(false);
    const previousLength = useRef(rows.length);
    useEffect(() => {
        const grew = rows.length > previousLength.current;
        previousLength.current = rows.length;
        if (grew && !mine.current) setOpenIndex(0);
        mine.current = false;
    }, [rows.length]);

    if (!rows.length) {
        return (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-[#2a2a2a] p-6 text-center">
                <p className="text-[1.25rem] text-slate-500 dark:text-neutral-400">{words.emptyText}</p>
                <button
                    type="button"
                    onClick={() => insertAt(0)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 py-2
                               text-[1.0625rem] font-semibold text-white hover:bg-[#1d4ed8]"
                >
                    <Plus className="w-4 h-4" /> {words.addLabel}
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {rows.map((row, i) => {
                const open = openIndex === i;
                const bench = (row.leaders || []).length;
                return (
                    <div
                        key={i}
                        className={`rounded-xl border bg-white dark:bg-[#0f0f0f] transition-colors ${
                            open
                                ? 'border-[#2563EB] dark:border-[#2563EB]'
                                : 'border-slate-200 dark:border-[#2a2a2a] hover:border-slate-300'
                        }`}
                    >
                        {/* ------------- closed: which region or district this is ------------- */}
                        <div className="flex items-center gap-3 p-3.5">
                            <span className="w-10 h-10 shrink-0 rounded-lg bg-blue-50 dark:bg-blue-950/40
                                             flex items-center justify-center text-[#2563EB]">
                                <MapPin className="w-4 h-4" />
                            </span>

                            <div className="min-w-0 flex-1">
                                <p className="text-[1.25rem] font-bold text-slate-900 dark:text-white truncate">
                                    {row.name || `Untitled ${words.nameLabel.toLowerCase()}`}
                                </p>
                                <p className="text-[1.0625rem] text-slate-500 dark:text-neutral-400 truncate">
                                    {bench} office-bearer{bench === 1 ? '' : 's'}
                                    {row.activeMembers ? ` · ${row.activeMembers} members` : ''}
                                    {row.regionName ? ` · ${row.regionName}` : ''}
                                    {row.description ? ` · ${row.description}` : ''}
                                </p>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                                {open ? <SaveNow className="mr-1" /> : null}
                                <button
                                    type="button"
                                    onClick={() => setOpenIndex(open ? null : i)}
                                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5
                                                text-[1.0625rem] font-semibold transition-colors ${
                                        open
                                            ? 'bg-slate-100 dark:bg-[#1a1a1a] text-slate-700 dark:text-neutral-200'
                                            : 'text-[#2563EB] hover:bg-blue-50 dark:hover:bg-blue-950/30'
                                    }`}
                                >
                                    {open ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                                    {open ? 'Done' : 'Edit'}
                                </button>
                                <RowTools rows={rows} index={i} onChange={onChange} />
                            </div>
                        </div>

                        {/* ------------- where the next one goes ------------- */}
                        <div className="flex flex-wrap items-center gap-2 px-3.5 pb-3.5">
                            <button
                                type="button"
                                onClick={() => insertAt(i)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200
                                           dark:border-[#2a2a2a] px-2.5 py-1 text-[1.0625rem] font-semibold
                                           text-slate-600 dark:text-neutral-300 hover:border-[#2563EB]
                                           hover:text-[#2563EB] transition-colors"
                            >
                                <ArrowUpToLine className="w-3.5 h-3.5" /> Add above
                            </button>
                            <button
                                type="button"
                                onClick={() => insertAt(i + 1)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200
                                           dark:border-[#2a2a2a] px-2.5 py-1 text-[1.0625rem] font-semibold
                                           text-slate-600 dark:text-neutral-300 hover:border-[#2563EB]
                                           hover:text-[#2563EB] transition-colors"
                            >
                                <ArrowDownToLine className="w-3.5 h-3.5" /> Add below
                            </button>
                        </div>

                        {/* ------------- open: the record and its bench ------------- */}
                        {open ? (
                            <div className="border-t border-slate-100 dark:border-[#1f1f1f] p-4 space-y-5">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <CmsField
                                        label={words.nameLabel}
                                        hint={shapes
                                            ? 'Pick the district — the map draws it, and the region fills itself in.'
                                            : 'Printed as the heading over this bench.'}
                                    >
                                        {shapes ? (
                                            <DistrictNameInput
                                                value={row.name}
                                                shapes={shapes}
                                                placeholder={words.namePlaceholder}
                                                onType={(name) => patch(i, { name })}
                                                onPick={(shape) => {
                                                    /* One patch, not two: the name and the region
                                                       are one decision, and two calls would have
                                                       the second read a `rows` the first replaced. */
                                                    const region = regionForZone(shape.zone, regionOptions || []);
                                                    patch(i, region
                                                        ? { name: shape.name, regionName: region }
                                                        : { name: shape.name });
                                                }}
                                            />
                                        ) : (
                                            /* A state with no generated map: nothing to pick from,
                                               so the plain field it always was. */
                                            <CmsInput
                                                value={row.name}
                                                placeholder={words.namePlaceholder}
                                                onChange={(e) => patch(i, { name: e.target.value })}
                                            />
                                        )}
                                        </CmsField>

                                        {/*
                                          * A REGION INSIDE TAMIL NADU IS NOT CALLED "TAMIL NADU".
                                          *
                                          * One was. Its districts were Chennai, Cuddalore,
                                          * Dharmapuri and the rest of the north, so it was plainly
                                          * the North region with the state's name typed over it —
                                          * and the page then printed "Tamilnadu Region — Tamil
                                          * Nadu" as a heading, under a band already titled Tamil
                                          * Nadu.
                                          *
                                          * A WARNING, NOT A BLOCK. This is free text on purpose —
                                          * an association may legitimately name a zone something a
                                          * validator would not predict — and refusing the save
                                          * would be the form arguing with an editor who may be
                                          * right. It says what the page will read like and leaves
                                          * the decision.
                                          */}
                                    {/*
                                      * ------------------------------------------------
                                      * A NAME THE MAP CANNOT FIND DRAWS NOTHING
                                      * ------------------------------------------------
                                      *
                                      * The marker is matched by NAME and by nothing
                                      * else, so "TIRUVANNAMALI" for "Tiruvannamalai" is
                                      * not a cosmetic difference — it is a district with
                                      * a bench, a member count and a region that does
                                      * not appear on the map, on a card where every
                                      * field saved correctly and nothing looked wrong.
                                      *
                                      * Only on the DISTRICT list. A region is a name the
                                      * association invents — North, South, Kongu — and
                                      * there is no dataset it could be checked against.
                                      */}
                                    {shapes && row.name && !exactShape(row.name, shapes) ? (
                                            <div className="sm:col-span-2 -mt-1 space-y-2">
                                                <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2
                                                              text-[1.0625rem] font-medium text-amber-800
                                                              dark:bg-amber-950/30 dark:text-amber-300">
                                                    <AlertTriangle className="mt-1 h-4 w-4 shrink-0" />
                                                    <span>
                                                        No district of this name on the map, so
                                                        {' '}<strong>{row.name}</strong> will draw no marker.
                                                        Everything else on this card still saves and still
                                                        shows on the page.
                                                    </span>
                                                </p>

                                                {/* The spellings it probably meant, as buttons: an
                                                    editor who has just been told a name is wrong
                                                    should not then have to guess the right one. */}
                                                {nearestShapes(row.name, shapes).length > 0 && (
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="text-[1.0625rem] font-medium text-slate-500
                                                                         dark:text-neutral-400">
                                                            Did you mean
                                                        </span>
                                                        {nearestShapes(row.name, shapes).map((shape) => (
                                                            <button
                                                                key={shape.name}
                                                                type="button"
                                                                onClick={() => {
                                                                    const region = regionForZone(
                                                                        shape.zone, regionOptions || [],
                                                                    );
                                                                    patch(i, region
                                                                        ? { name: shape.name, regionName: region }
                                                                        : { name: shape.name });
                                                                }}
                                                                className="rounded-lg border border-amber-300 bg-white px-2.5 py-1
                                                                           text-[1.0625rem] font-semibold text-amber-800
                                                                           hover:bg-amber-50 dark:border-amber-800
                                                                           dark:bg-transparent dark:text-amber-300"
                                                            >
                                                                {shape.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ) : null}

                                    {pageName && row.name
                                        && row.name.replace(/\s+/g, '').toLowerCase()
                                           === pageName.replace(/\s+/g, '').toLowerCase() ? (
                                            <div className="sm:col-span-2 -mt-1">
                                                <p className="rounded-lg bg-amber-50 px-3 py-2 text-[1.0625rem]
                                                              font-medium text-amber-800 dark:bg-amber-950/30
                                                              dark:text-amber-300">
                                                    This {words.nameLabel.toLowerCase()} has the same name as the
                                                    state, so the page will print “{row.name} — {pageName}”. A
                                                    {' '}{words.nameLabel.toLowerCase()} is a zone INSIDE the
                                                    state — North, East, South, West.
                                                </p>
                                            </div>
                                        ) : null}

                                    {/*
                                      * THE FIGURE ON THE MAP MARKER.
                                      *
                                      * Every ring on the map used to say the same thing —
                                      * "there is a chapter here" — so six identical rings
                                      * could not tell a district of four hundred members
                                      * from one of nine. Type a number and that marker
                                      * carries it; the map redraws from this list on the
                                      * next load with nothing else to change.
                                      *
                                      * Blank or 0 means "no figure published" and draws the
                                      * plain ring, which is what every district shows today.
                                      */}
                                    {/*
                                      * WHICH REGION THIS DISTRICT IS IN — and the map
                                      * colours from it.
                                      *
                                      * A plain `<select>` of the regions that exist on this
                                      * page, so a district cannot be assigned to a region
                                      * nobody has created. It is on the DISTRICT rather than
                                      * a checklist on the region because a district belongs
                                      * to exactly one — a list on the other side would let
                                      * the same district appear in two and leave the map to
                                      * decide which colour wins.
                                      *
                                      * Hidden until at least one region exists: a dropdown
                                      * whose only option is "not assigned" is a control that
                                      * asks a question with no answers.
                                      */}
                                    {regionOptions && regionOptions.length ? (
                                        <CmsField
                                            label="Which region"
                                            hint="Colours this district on the map."
                                        >
                                            <select
                                                value={row.regionName || ''}
                                                onChange={(e) => patch(i, { regionName: e.target.value })}
                                                className="mt-1.5 h-12 w-full rounded-lg border border-slate-300
                                                           bg-white px-3 text-[1.1875rem] text-slate-900
                                                           dark:border-[#2a2a2a] dark:bg-[#0b0b0b]
                                                           dark:text-neutral-100"
                                            >
                                                <option value="">Not assigned</option>
                                                {regionOptions.map((name) => (
                                                    <option key={name} value={name}>{name}</option>
                                                ))}
                                            </select>
                                        </CmsField>
                                    ) : null}

                                    <CmsField
                                        label="Active members"
                                        hint="Shown on this place's marker on the map. Leave blank for none."
                                    >
                                        <CmsInput
                                            type="number"
                                            min={0}
                                            value={row.activeMembers ? String(row.activeMembers) : ''}
                                            placeholder="0"
                                            onChange={(e) => patch(i, {
                                                activeMembers: Math.max(0, Number(e.target.value) || 0),
                                            })}
                                        />
                                    </CmsField>

                                    <div className="sm:col-span-2">
                                        <CmsField
                                            label={words.coversLabel}
                                            hint="Kept with the record. Not drawn on the page at present — the association asked for a centred name and nothing beside it."
                                        >
                                            <CmsInput
                                                value={row.description || ''}
                                                placeholder={words.coversPlaceholder}
                                                onChange={(e) => patch(i, { description: e.target.value })}
                                            />
                                        </CmsField>
                                    </div>
                                    {/*
                                      * NO OFFICE BLOCK ON A TIER.
                                      *
                                      * A region and a district each carried an `officeSchema`
                                      * — name, designation, phone, email, address, city,
                                      * pincode — beside a list of named contacts that holds
                                      * the same information. Two places to put a telephone
                                      * number on one card, and an editor adding somebody had
                                      * to decide which was the right one.
                                      *
                                      * There is one place now, and it is the contacts list
                                      * below. LEADERS AND CONTACTS ARE SEPARATE THINGS: a
                                      * leader is a portrait on the board, a contact is a line
                                      * in Get in Touch, and neither is a way of entering the
                                      * other.
                                      *
                                      * The STATE office went the same way, and for the same
                                      * reason. Section 5 is one card — state-wise, then
                                      * region-wise, then district-wise contacts — and a block
                                      * of office fields above it was a second shape for the
                                      * same answer.
                                      *
                                      * `contact` is untouched on every record and still comes
                                      * down in the payload; the page no longer reads it. A
                                      * field with no editor is an address that can only get
                                      * older, so it is better not drawn than drawn wrong.
                                      */}
                                </div>

                                <div className="border-t border-slate-100 dark:border-[#1f1f1f] pt-4">
                                    <div className="flex items-center justify-between gap-3 mb-3">
                                        <p className="text-[1.1875rem] font-semibold text-slate-600 dark:text-neutral-300">
                                            {row.name
                                                ? `${row.name} — office bearers`
                                                : `${words.nameLabel} — office bearers`}
                                        </p>
                                        <AddRowButton
                                            label="Add leader"
                                            onClick={() => patch(i, { leaders: withNewLeaderOnTop(row.leaders) })}
                                        />
                                    </div>
                                    <LeaderRows
                                        rows={row.leaders || []}
                                        onChange={(leaders) => patch(i, { leaders })}
                                    />
                                </div>

                                {/*
                                  * NO CONTACTS ON THIS CARD.
                                  *
                                  * They were here, under the bench, and that is what kept
                                  * making the two look like one thing with two halves. They
                                  * have their own section now — "Section 6 · Region contacts"
                                  * and "Section 7 · District contacts" — at the same level as
                                  * the state's own contacts card, which is what an editor was
                                  * already looking at when they asked for these.
                                  *
                                  * A LEADER IS A PORTRAIT ON THE BOARD. A CONTACT IS A LINE IN
                                  * GET IN TOUCH. Two lists, two sections, neither entered
                                  * through the other.
                                  */}
                            </div>
                        ) : null}
                    </div>
                );
            })}
        </div>
    );
}

/**
 * The page's OWN named contacts — the state office's, or the region page's.
 *
 * The same list a region or district card carries, one level up. Kept as its
 * own component rather than inlined twice because the two editors would
 * otherwise drift, which is how the district office ended up with three of its
 * eleven fields.
 */
/**
 * ==========================================================================
 * THE PAGE’S OWN CONTACTS — the first of the three lists, not a card of
 * their own
 * ==========================================================================
 *
 * The heading here was `Contacts — Tamil Nadu State Council`, sitting
 * directly under a card already headed **Contacts**. The word twice in two
 * lines read as two different things when it is one, and it broke the
 * parallel with the two lists below it — "Region-wise", "District-wise" —
 * which is the shape the association asked for.
 *
 * `title` is the caller’s now, so a state reads "State-wise contacts" beside
 * its siblings and a region page, where there is nothing to be parallel to,
 * simply says whose contacts these are.
 *
 * `tier` stays, and it is not decoration: it is the heading the PAGE prints
 * over this list, and an editor filling a form should be told where its
 * contents come out.
 */
function PageContacts({ draft, set, where, tier, title }: {
    draft: Record<string, unknown>;
    set: (patch: Record<string, unknown>) => void;
    where: string;
    /** The group these appear under on the page — "Tamil Nadu State Council". */
    tier: string;
    /** What this list is called on THIS screen. */
    title: string;
}) {
    const rows = (draft.contacts as RegionContactPerson[]) || [];
    return (
        <CmsSection
            title={title}
            hint={`Printed under “${tier}” in Get in Touch. Anyone at the ${where} `
                + 'a visitor should be able to write to.'}
            actions={(
                <AddRowButton
                    label="Add contact"
                    onClick={() => set({ contacts: withNewContactOnTop(rows) })}
                />
            )}
        >
            <ContactRows rows={rows} onChange={(contacts) => set({ contacts })} />
        </CmsSection>
    );
}

const blankGroup = (): RegionContactGroup => ({
    id: '', name: '', contacts: [], displayOrder: 0, isHidden: false,
} as RegionContactGroup);

const resequenceGroups = (rows: RegionContactGroup[]) =>
    rows.map((row, i) => ({ ...row, displayOrder: i + 1 }));

/**
 * ==========================================================================
 * THE GET IN TOUCH GROUPS — their own list, not the leadership tiers
 * ==========================================================================
 *
 * This read `stateRegions` and `districts` and offered to add to them, which
 * made the two inseparable: naming a contact group for Tiruvannamalai created
 * an empty district chapter on the leadership board, with a marker waiting on
 * the map for a bench that did not exist.
 *
 * They are different things. A leadership tier is portraits, a member count
 * and a shape on the map. A group here is a heading and some people to write
 * to. The association may want a contact for a district it has no chapter in,
 * and a chapter it publishes no contact for — and now both are possible.
 *
 * NOTHING ON THIS SCREEN TOUCHES SECTION 3 OR 4, and nothing there creates a
 * group here. The two lists are only related by the words an editor types
 * into both, which is exactly as much relation as the association asked for.
 */
function ContactGroups({ field, draft, set, label, placeholder }: {
    field: 'regionContactGroups' | 'districtContactGroups';
    draft: Record<string, unknown>;
    set: (patch: Record<string, unknown>) => void;
    /** "region" / "district" — what one group is called, in prose. */
    label: string;
    placeholder: string;
}) {
    const rows = (draft[field] as RegionContactGroup[]) || [];

    const patch = (i: number, next: Partial<RegionContactGroup>) =>
        set({ [field]: rows.map((row, index) => (index === i ? { ...row, ...next } : row)) });

    const addGroup = () => set({ [field]: resequenceGroups([blankGroup(), ...rows]) });
    const removeGroup = (i: number) =>
        set({ [field]: resequenceGroups(rows.filter((_, index) => index !== i)) });

    return (
        <>
            <AddRow>
                <AddRowButton label={`Add ${label}`} onClick={addGroup} />
            </AddRow>

            {!rows.length ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center
                                dark:border-[#2a2a2a]">
                    <p className="text-[1.25rem] text-slate-500 dark:text-neutral-400">
                        No {label} groups yet.
                    </p>
                    <button
                        type="button"
                        onClick={addGroup}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 py-2
                                   text-[1.0625rem] font-semibold text-white hover:bg-[#1d4ed8]"
                    >
                        <Plus className="w-4 h-4" /> Add a {label}
                    </button>
                </div>
            ) : (
                <div className="space-y-6">
                    {rows.map((row, i) => (
                        <div
                            key={i}
                            className="rounded-xl border border-slate-200 p-4 dark:border-[#2a2a2a]"
                        >
                            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <CmsField
                                        label="Heading"
                                        hint="Printed over this group in Get in Touch."
                                    >
                                        <CmsInput
                                            value={row.name || ''}
                                            placeholder={placeholder}
                                            onChange={(e) => patch(i, { name: e.target.value })}
                                        />
                                    </CmsField>
                                </div>
                                <AddRowButton
                                    label="Add contact"
                                    onClick={() => patch(i, { contacts: withNewContactOnTop(row.contacts) })}
                                />
                                <button
                                    type="button"
                                    onClick={() => removeGroup(i)}
                                    aria-label={`Remove this ${label} group`}
                                    className="p-2 rounded text-red-500 hover:bg-red-500/10"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            <ContactRows
                                rows={row.contacts || []}
                                onChange={(contacts) => patch(i, { contacts })}
                            />
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

/** A fresh, empty named contact. */
const blankContact = (): RegionContactPerson => ({
    id: '', name: '', designation: '', organisation: '', photoUrl: '',
    email: '', phone: '', address: '', displayOrder: 0, isHidden: false,
} as RegionContactPerson);

const resequenceContacts = (rows: RegionContactPerson[]) =>
    rows.map((row, i) => ({ ...row, displayOrder: i + 1 }));

const withNewContactOnTop = (rows: RegionContactPerson[] | undefined) =>
    resequenceContacts([blankContact(), ...(rows || [])]);

/**
 * ==========================================================================
 * NAMED CONTACTS ON A TIER — one card each, like the office-bearers
 * ==========================================================================
 *
 * Get in Touch was built from two things: ONE office per tier, and whichever
 * office-bearers happened to have published an email or a telephone. A
 * person who should be reachable but is NOT on the leadership bench — a
 * membership registrar, an events coordinator — had nowhere to go. Adding
 * them as a "leader" to get them into the list also put their portrait in
 * the leadership grid, which says something untrue about who runs the
 * council.
 *
 * So every tier — the page itself, each region, each district — carries its
 * own list, and it is edited exactly the way the bench is: a card per person,
 * closed by default, with Add above / Add below, Edit, move and delete.
 * Same component shape on purpose. An editor who has learned one has learned
 * the other, and the two lists sit a few inches apart.
 *
 * FEWER FIELDS THAN A LEADER, and the difference is the point: no role badge
 * and no biography, because neither is ever drawn — a contact is a line in a
 * list, not a portrait. Offering them would invite an editor to write a
 * paragraph nothing will print.
 */
function ContactRows({ rows, onChange }: {
    rows: RegionContactPerson[];
    onChange: (rows: RegionContactPerson[]) => void;
}) {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const patch = (i: number, next: Partial<RegionContactPerson>) =>
        onChange(rows.map((row, index) => (index === i ? { ...row, ...next } : row)));

    const insertAt = (at: number) => {
        const next = [...rows];
        next.splice(at, 0, blankContact());
        mine.current = true;
        onChange(resequenceContacts(next));
        setOpenIndex(at);
    };

    /* A card added from the section heading opens itself — see `LeaderRows`. */
    const mine = useRef(false);
    const previousLength = useRef(rows.length);
    useEffect(() => {
        const grew = rows.length > previousLength.current;
        previousLength.current = rows.length;
        if (grew && !mine.current) setOpenIndex(0);
        mine.current = false;
    }, [rows.length]);

    if (!rows.length) {
        return (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-[#2a2a2a] p-5 text-center">
                {/* It said "the office above and any office-bearer with their own
                    details are listed already", which described the leadership list to
                    somebody looking at the contacts list. The two are separate and the
                    copy here should not imply one stands in for the other. */}
                <p className="text-[1.1875rem] text-slate-500 dark:text-neutral-400">
                    No contacts yet.
                </p>
                <button
                    type="button"
                    onClick={() => insertAt(0)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 py-2
                               text-[1.0625rem] font-semibold text-white hover:bg-[#1d4ed8]"
                >
                    <Plus className="w-4 h-4" /> Add a contact
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {rows.map((row, i) => {
                const open = openIndex === i;
                return (
                    <div
                        key={i}
                        className={`rounded-xl border bg-white dark:bg-[#0f0f0f] transition-colors ${
                            open
                                ? 'border-[#2563EB] dark:border-[#2563EB]'
                                : 'border-slate-200 dark:border-[#2a2a2a] hover:border-slate-300'
                        }`}
                    >
                        <div className="flex items-center gap-3 p-3">
                            <span className="w-10 h-10 shrink-0 rounded-lg bg-slate-100 dark:bg-[#141414]
                                             flex items-center justify-center text-neutral-400">
                                <Mail className="w-4 h-4" />
                            </span>

                            <div className="min-w-0 flex-1">
                                <p className="text-[1.1875rem] font-bold text-slate-900 dark:text-white truncate">
                                    {row.name || 'Untitled contact'}
                                </p>
                                <p className="text-[1.0625rem] text-slate-500 dark:text-neutral-400 truncate">
                                    {[row.designation, row.organisation, row.email || row.phone]
                                        .filter(Boolean).join(' · ')
                                        || 'Empty — anything you type here will be published'}
                                </p>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                                {open ? <SaveNow className="mr-1" /> : null}
                                <button
                                    type="button"
                                    onClick={() => setOpenIndex(open ? null : i)}
                                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5
                                                text-[1.0625rem] font-semibold transition-colors ${
                                        open
                                            ? 'bg-slate-100 dark:bg-[#1a1a1a] text-slate-700 dark:text-neutral-200'
                                            : 'text-[#2563EB] hover:bg-blue-50 dark:hover:bg-blue-950/30'
                                    }`}
                                >
                                    {open ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                                    {open ? 'Done' : 'Edit'}
                                </button>
                                <RowTools rows={rows} index={i} onChange={onChange} />
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 px-3 pb-3">
                            <button
                                type="button"
                                onClick={() => insertAt(i)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200
                                           dark:border-[#2a2a2a] px-2.5 py-1 text-[1.0625rem] font-semibold
                                           text-slate-600 dark:text-neutral-300 hover:border-[#2563EB]
                                           hover:text-[#2563EB] transition-colors"
                            >
                                <ArrowUpToLine className="w-3.5 h-3.5" /> Add above
                            </button>
                            <button
                                type="button"
                                onClick={() => insertAt(i + 1)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200
                                           dark:border-[#2a2a2a] px-2.5 py-1 text-[1.0625rem] font-semibold
                                           text-slate-600 dark:text-neutral-300 hover:border-[#2563EB]
                                           hover:text-[#2563EB] transition-colors"
                            >
                                <ArrowDownToLine className="w-3.5 h-3.5" /> Add below
                            </button>
                        </div>

                        {open ? (
                            <div className="border-t border-slate-100 dark:border-[#1f1f1f] p-4">
                                <div className="flex items-start gap-3">
                                {/*
                                  * NO PHOTOGRAPH ON A CONTACT.
                                  *
                                  * There was an uploader here, copied from the leader card.
                                  * A leader needs one — their card IS a portrait. A contact is
                                  * a name, a role and a way to reach them, and the card that
                                  * draws it has never printed a face, so the control asked an
                                  * editor to find, crop and upload a photograph nothing would
                                  * ever show.
                                  *
                                  * `photoUrl` stays on the model. Removing a field is the one
                                  * change that loses data, and it costs nothing to keep — it
                                  * simply has no editor any more.
                                  */}
                                    <div className="grid gap-3 sm:grid-cols-2 flex-1 min-w-0">
                                        <CmsField label="Name">
                                            <CmsInput value={row.name} onChange={(e) => patch(i, { name: e.target.value })} />
                                        </CmsField>
                                        <CmsField label="Designation" hint="The line under the name.">
                                            <CmsInput
                                                value={row.designation}
                                                placeholder="Membership Registrar"
                                                onChange={(e) => patch(i, { designation: e.target.value })}
                                            />
                                        </CmsField>
                                        <div className="sm:col-span-2">
                                            <CmsField label="Organisation">
                                                <CmsInput
                                                    value={row.organisation}
                                                    placeholder="ACTIV Tamil Nadu State Council"
                                                    onChange={(e) => patch(i, { organisation: e.target.value })}
                                                />
                                            </CmsField>
                                        </div>
                                        {/* A contact with a name and no way to reach them is
                                            dropped on save by `contactPersonIsEmpty` — the
                                            server will not store a row that reaches nobody. */}
                                        <CmsField label="Email">
                                            <CmsInput
                                                value={row.email || ''}
                                                placeholder="registrar@activ.org.in"
                                                onChange={(e) => patch(i, { email: e.target.value })}
                                            />
                                        </CmsField>
                                        <CmsField label="Phone">
                                            <CmsInput
                                                value={row.phone || ''}
                                                placeholder="+91 44 2345 1115"
                                                onChange={(e) => patch(i, { phone: e.target.value })}
                                            />
                                        </CmsField>
                                        <div className="sm:col-span-2">
                                            <CmsField label="Address" hint="Optional. Line breaks are kept.">
                                                <CmsTextarea
                                                    rows={2}
                                                    value={row.address || ''}
                                                    onChange={(e) => patch(i, { address: e.target.value })}
                                                />
                                            </CmsField>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>
                );
            })}
        </div>
    );
}

/** A fresh, empty office-bearer. One definition, so every insertion point agrees. */
const blankLeader = (): RegionLeader => ({
    id: '', name: '', role: '', designation: '', organisation: '', bio: '', photoUrl: '',
    email: '', phone: '', address: '', displayOrder: 0, isHidden: false,
} as RegionLeader);

/**
 * ADD AT THE TOP, NOT THE BOTTOM.
 *
 * The section's own "Add leader" did `[...rows, blank]`. On a bench of five
 * that puts the new card below the Treasurer and a screen further down than
 * the button that made it, so the press appeared to do nothing and the
 * position then had to be corrected with the move arrows, one step at a time.
 *
 * The top is the only position this button can pick that the editor can SEE.
 * Exact placement is what the per-card "Add above" / "Add below" are for, and
 * they read better anyway: the position is chosen relative to a person you
 * are looking at, rather than guessed from a list you have scrolled past.
 */
const withNewLeaderOnTop = (rows: RegionLeader[] | undefined) =>
    resequence([blankLeader(), ...(rows || [])]);

/** Rewrite `displayOrder` from the array positions, after any insert or move. */
const resequence = (rows: RegionLeader[]) => rows.map((row, i) => ({ ...row, displayOrder: i + 1 }));

/**
 * ==========================================================================
 * ONE CARD PER OFFICE-BEARER
 * ==========================================================================
 *
 * This was a flat list of open forms: every leader showing all ten of its
 * fields at once, so a bench of five was fifty inputs and the next bench began
 * somewhere below the fold. Nothing on screen said where one person ended and
 * the next began except a hairline, and the only way to find "Mr A Murugan"
 * was to read every Name box on the way down.
 *
 * Each one is a card now, CLOSED by default, showing the photograph, the name,
 * the role and nothing else. Open the one you came to change; the other four
 * stay out of the way. That is the whole of the difference, and it is what
 * turns a bench of five from fifty inputs into five lines.
 *
 * ADDING SOMEBODY IN THE RIGHT PLACE. "Add leader" appended to the end, so a
 * new Vice Chairman arrived below the Treasurer and had to be walked up the
 * list one press at a time. Every card carries its own "Add above" and "Add
 * below", which splice at that index — the position is chosen when the person
 * is created rather than corrected afterwards.
 *
 * `displayOrder` is rewritten from the array positions on every insert, move
 * and delete (`resequence`). It is what the public page sorts on, and a list
 * that looks right in the editor and comes back shuffled on the site is the
 * bug that costs an afternoon.
 *
 * THE KEY IS THE INDEX, deliberately, and it is the one thing here to be
 * careful with. These rows have no id of their own. An index key means React
 * reuses a card when the list is reordered, so the OPEN/CLOSED state belongs
 * to the position rather than to the person — move a card and the card that
 * lands in its place is the one left open. Reordering is rare and the cost is
 * cosmetic; inventing an id here would write a field the API does not have.
 */
function LeaderRows({ rows, onChange }: { rows: RegionLeader[]; onChange: (rows: RegionLeader[]) => void }) {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const patch = (i: number, next: Partial<RegionLeader>) =>
        onChange(rows.map((row, index) => (index === i ? { ...row, ...next } : row)));

    const insertAt = (at: number) => {
        const next = [...rows];
        next.splice(at, 0, blankLeader());
        mine.current = true;
        onChange(resequence(next));
        /* Open the one just added. It is empty, and an empty card that has to be
           opened by hand is an empty card an editor scrolls straight past. */
        setOpenIndex(at);
    };

    /*
     * A CARD ADDED FROM OUTSIDE THIS COMPONENT STILL OPENS ITSELF.
     *
     * "Add leader" lives in the SECTION heading, above this list, so it adds a
     * row by calling `onChange` — it cannot reach `setOpenIndex`. Without this
     * the press produced a new closed card that looked exactly like the four
     * already there, and the editor had to work out which one was new.
     *
     * `mine` distinguishes the two sources. `insertAt` already opened the card
     * it made and knows where it put it; only a growth this component did NOT
     * cause is assumed to be a top insert.
     */
    const mine = useRef(false);
    const previousLength = useRef(rows.length);
    useEffect(() => {
        const grew = rows.length > previousLength.current;
        previousLength.current = rows.length;
        if (grew && !mine.current) setOpenIndex(0);
        mine.current = false;
    }, [rows.length]);

    if (!rows.length) {
        return (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-[#2a2a2a] p-6 text-center">
                <p className="text-[1.25rem] text-slate-500 dark:text-neutral-400">No office-bearers yet.</p>
                <button
                    type="button"
                    onClick={() => insertAt(0)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 py-2
                               text-[1.0625rem] font-semibold text-white hover:bg-[#1d4ed8]"
                >
                    <Plus className="w-4 h-4" /> Add the first leader
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {rows.map((row, i) => {
                const open = openIndex === i;
                return (
                    <div
                        key={i}
                        className={`rounded-xl border bg-white dark:bg-[#0f0f0f] transition-colors ${
                            open
                                ? 'border-[#2563EB] dark:border-[#2563EB]'
                                : 'border-slate-200 dark:border-[#2a2a2a] hover:border-slate-300'
                        }`}
                    >
                        {/* ---------------- the closed card: who this is ---------------- */}
                        <div className="flex items-center gap-3 p-3">
                            <span className="w-11 h-12 shrink-0 rounded-lg overflow-hidden bg-slate-100
                                             dark:bg-[#141414] flex items-center justify-center text-neutral-400">
                                {row.photoUrl
                                    ? <img src={resolveMediaUrl(row.photoUrl)} alt="" className="w-full h-full object-cover" />
                                    : <Users className="w-4 h-4" />}
                            </span>

                            <div className="min-w-0 flex-1">
                                <p className="text-[1.1875rem] font-bold text-slate-900 dark:text-white truncate">
                                    {row.name || 'Untitled leader'}
                                </p>
                                {row.role ? (
                                    <span className="inline-block mt-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40
                                                     px-2 py-0.5 text-[1.0625rem] font-semibold text-blue-700
                                                     dark:text-blue-300">
                                        {row.role}
                                    </span>
                                ) : null}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                                {open ? <SaveNow className="mr-1" /> : null}

                                <button
                                    type="button"
                                    onClick={() => setOpenIndex(open ? null : i)}
                                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5
                                                text-[1.0625rem] font-semibold transition-colors ${
                                        open
                                            ? 'bg-slate-100 dark:bg-[#1a1a1a] text-slate-700 dark:text-neutral-200'
                                            : 'text-[#2563EB] hover:bg-blue-50 dark:hover:bg-blue-950/30'
                                    }`}
                                >
                                    {open ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                                    {open ? 'Done' : 'Edit'}
                                </button>

                                <RowTools rows={rows} index={i} onChange={onChange} />
                            </div>
                        </div>

                        {/* ---------------- where the next person goes ---------------- */}
                        <div className="flex flex-wrap items-center gap-2 px-3 pb-3">
                            <button
                                type="button"
                                onClick={() => insertAt(i)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200
                                           dark:border-[#2a2a2a] px-2.5 py-1 text-[1.0625rem] font-semibold
                                           text-slate-600 dark:text-neutral-300 hover:border-[#2563EB]
                                           hover:text-[#2563EB] transition-colors"
                            >
                                <ArrowUpToLine className="w-3.5 h-3.5" /> Add above
                            </button>
                            <button
                                type="button"
                                onClick={() => insertAt(i + 1)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200
                                           dark:border-[#2a2a2a] px-2.5 py-1 text-[1.0625rem] font-semibold
                                           text-slate-600 dark:text-neutral-300 hover:border-[#2563EB]
                                           hover:text-[#2563EB] transition-colors"
                            >
                                <ArrowDownToLine className="w-3.5 h-3.5" /> Add below
                            </button>
                        </div>

                        {/* ---------------- the open card: the record ---------------- */}
                        {open ? (
                            <div className="border-t border-slate-100 dark:border-[#1f1f1f] p-4">
                                <div className="flex items-start gap-3">
                                    <LeaderPhoto url={row.photoUrl} onChange={(photoUrl) => patch(i, { photoUrl })} />

                                    <div className="grid gap-3 sm:grid-cols-2 flex-1 min-w-0">
                                        <CmsField label="Name">
                                            <CmsInput value={row.name} onChange={(e) => patch(i, { name: e.target.value })} />
                                        </CmsField>
                                        <CmsField label="Role badge" hint="One or two words - Chairman, Vice Chairman.">
                                            <CmsInput
                                                value={row.role}
                                                placeholder="Chairman"
                                                onChange={(e) => patch(i, { role: e.target.value })}
                                            />
                                        </CmsField>
                                        <CmsField label="Designation">
                                            <CmsInput
                                                value={row.designation}
                                                placeholder="Chairman, ACTIV South Zone"
                                                onChange={(e) => patch(i, { designation: e.target.value })}
                                            />
                                        </CmsField>
                                        <div className="sm:col-span-2">
                                            <CmsField label="Organisation">
                                                <CmsInput
                                                    value={row.organisation}
                                                    placeholder="Managing Director, Example Industries Pvt Ltd"
                                                    onChange={(e) => patch(i, { organisation: e.target.value })}
                                                />
                                            </CmsField>
                                        </div>
                                        <div className="sm:col-span-2">
                                            <CmsField label="Short bio">
                                                <CmsInput value={row.bio} onChange={(e) => patch(i, { bio: e.target.value })} />
                                            </CmsField>
                                        </div>

                                        {/*
                                          * THIS PERSON's contact, not the office's.
                                          *
                                          * All three optional. Anyone with at least one of
                                          * them gets an entry in the page's contact
                                          * directory; anyone with none is simply not listed
                                          * there, so a council that publishes one shared
                                          * address is unchanged.
                                          */}
                                        <CmsField label="Email" hint="Printed in the contact directory.">
                                            <CmsInput
                                                value={row.email || ''}
                                                placeholder="chairman@activ.org.in"
                                                onChange={(e) => patch(i, { email: e.target.value })}
                                            />
                                        </CmsField>
                                        <CmsField label="Phone">
                                            <CmsInput
                                                value={row.phone || ''}
                                                placeholder="+91 44 2345 1115"
                                                onChange={(e) => patch(i, { phone: e.target.value })}
                                            />
                                        </CmsField>
                                        <div className="sm:col-span-2">
                                            <CmsField label="Address" hint="Optional. Line breaks are kept.">
                                                <CmsTextarea
                                                    rows={2}
                                                    value={row.address || ''}
                                                    onChange={(e) => patch(i, { address: e.target.value })}
                                                />
                                            </CmsField>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>
                );
            })}
        </div>
    );
}

/** Uploaded, like every other image on this site — never a pasted URL. */
function LeaderPhoto({ url, onChange }: { url: string; onChange: (url: string) => void }) {
    const [busy, setBusy] = useState(false);

    const pick = async (file?: File | null) => {
        if (!file) return;
        setBusy(true);
        try {
            const { url: uploaded } = await uploadMedia(file);
            onChange(uploaded);
        } catch (err) {
            toast.error(errorMessage(err, 'That image could not be uploaded'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="shrink-0 w-20">
            <label className="block cursor-pointer">
                <span className="w-20 h-24 rounded-lg overflow-hidden border border-slate-200
                                 dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#141414] flex items-center
                                 justify-center text-neutral-400 hover:border-blue-300 transition-colors">
                    {busy ? <Loader2 className="w-5 h-5 animate-spin" />
                        /* `resolveMediaUrl`: an upload is stored as a relative
                           `/uploads/…` path and the CMS is not served from the
                           API's origin, so the raw value previews as a broken
                           frame for a file that uploaded perfectly. */
                        : url ? <img src={resolveMediaUrl(url)} alt="" className="w-full h-full object-cover" />
                            : <Users className="w-5 h-5" />}
                </span>
                <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { pick(e.target.files && e.target.files[0]); e.target.value = ''; }}
                />
                <span className="mt-1.5 block text-center text-[1.0625rem] font-semibold text-blue-600
                                 dark:text-blue-400">
                    {url ? 'Change' : 'Photo'}
                </span>
            </label>

            {/* The address the upload saved, as everywhere else in this panel. */}
            {url && (
                <code
                    title={url}
                    className="mt-1.5 block w-20 truncate rounded bg-slate-100 dark:bg-[#141414] px-1.5
                               py-1 text-[1.0625rem] font-mono text-slate-500 dark:text-neutral-400
                               select-all"
                >
                    {url}
                </code>
            )}
        </div>
    );
}

/**
 * One section of feed rows, bound to a named field on the draft.
 *
 * A thin wrapper: the rows themselves are `FeedRows`, which the custom-section
 * editor also uses. Two copies of a row editor is two places to forget a field.
 */
function FeedSection({ title, field, draft, set, withDate = false, figures = false, hint }: {
    title: string;
    field: string;
    draft: Record<string, unknown>;
    set: (patch: Record<string, unknown>) => void;
    withDate?: boolean;
    /**
     * The achievements band, where the two fields mean something different:
     * the title IS the figure and the summary says what it counts. Same shape,
     * different labels — relabelling costs a prop, and a second component would
     * be a second place to fix everything else.
     */
    figures?: boolean;
    hint?: string;
}) {
    const rows = (draft[field] as RegionFeedItem[]) || [];
    return (
        <CmsSection
            title={title}
            hint={hint}
            actions={<AddRowButton label="Add item" onClick={() => set({ [field]: [...rows, blankRow(rows.length)] })} />}
        >
            <FeedRows
                rows={rows}
                onChange={(next) => set({ [field]: next })}
                withDate={withDate}
                figures={figures}
            />
        </CmsSection>
    );
}

/** A new, empty row. One definition, so every "Add item" produces the same shape. */
const blankRow = (index: number): RegionFeedItem => ({
    id: '', title: '', summary: '', body: '', date: '', location: '',
    href: '', imageUrl: '', fileUrl: '', category: '', sector: '', icon: '',
    displayOrder: index + 1, isFeatured: false, isHidden: false,
} as RegionFeedItem);

/**
 * The rows of a feed, with EVERY field the public cards can print.
 *
 * The card shows title, summary and — on the detail screen — the body; the
 * tile shows the image; publications offer the file; the chips are category and
 * sector; the icon is what an icon list draws. All of them were writable by the
 * seed scripts and none of them by an editor, which is the same fault as not
 * having the field at all.
 *
 * The secondary fields sit behind "More fields" so the common case stays a
 * two-field form.
 */
function FeedRows({ rows, onChange, withDate = false, figures = false }: {
    rows: RegionFeedItem[];
    onChange: (rows: RegionFeedItem[]) => void;
    withDate?: boolean;
    figures?: boolean;
}) {
    const patch = (i: number, next: Partial<RegionFeedItem>) =>
        onChange(rows.map((row, index) => (index === i ? { ...row, ...next } : row)));

    /*
     * A FIGURE IS A NUMBER AND A CAPTION. NOTHING ELSE IS DRAWN.
     *
     * The Statistics band prints the number, what it counts and a symbol. The
     * form was also offering a date, a location, a link and a drawer of
     * pictures and files — every one of them saved to the database and shown
     * nowhere. An editor fills those in, looks at the live page, and concludes
     * the CMS does not work.
     */
    const full = !figures;

    if (!rows.length) {
        return (
            <p className="text-[1.25rem] text-slate-500 dark:text-neutral-400">
                Nothing here yet. This section is left off the public page until it has something in it.
            </p>
        );
    }

    return (
        <div className="space-y-3">
            {rows.map((row, i) => (
                <div key={i} className="rounded-lg border border-slate-200 dark:border-[#2a2a2a] p-3">
                    <div className="flex items-start gap-3">
                        <div className="grid gap-3 sm:grid-cols-2 flex-1 min-w-0">
                            <div className={figures ? '' : 'sm:col-span-2'}>
                                <CmsField
                                    label={figures ? 'The number' : 'Title'}
                                    hint={figures ? 'Shown large — for example 250+' : undefined}
                                >
                                    <CmsInput
                                        value={row.title}
                                        onChange={(e) => patch(i, { title: e.target.value })}
                                    />
                                </CmsField>
                            </div>
                            <div className={figures ? '' : 'sm:col-span-2'}>
                                <CmsField
                                    label={figures ? 'What the number means' : 'Short description'}
                                    hint={figures ? undefined : 'One or two lines. Shown on the card.'}
                                >
                                    <CmsTextarea
                                        rows={2}
                                        value={row.summary}
                                        onChange={(e) => patch(i, { summary: e.target.value })}
                                    />
                                </CmsField>
                            </div>

                            {full && (
                                <>
                                    <CmsField
                                        label="Date"
                                        hint="Printed exactly as you type it — for example Oct 08, 2026."
                                    >
                                        <CmsInput
                                            value={row.date}
                                            placeholder="Oct 08, 2026"
                                            onChange={(e) => patch(i, { date: e.target.value })}
                                        />
                                    </CmsField>
                                    <CmsField label="Location">
                                        <CmsInput
                                            value={row.location}
                                            onChange={(e) => patch(i, { location: e.target.value })}
                                        />
                                    </CmsField>
                                </>
                            )}

                            {figures && (
                                <div className="sm:col-span-2">
                                    <CmsField label="Symbol" hint="Drawn beside the number.">
                                        <IconSelect
                                            value={row.icon}
                                            onChange={(icon) => patch(i, { icon })}
                                        />
                                    </CmsField>
                                </div>
                            )}

                            <div className={full ? 'sm:col-span-2' : 'hidden'}>
                                <details className="rounded-lg bg-slate-50 dark:bg-[#141414] px-3 py-2">
                                    <summary className="cursor-pointer text-[1.1875rem] font-semibold
                                                        text-slate-700 dark:text-neutral-200">
                                        More details — long text, picture, tags
                                    </summary>
                                    <div className="grid gap-3 sm:grid-cols-2 pt-3">
                                        <div className="sm:col-span-2">
                                            <CmsField
                                                label="Full text"
                                                hint="Printed in full when a reader opens this item."
                                            >
                                                <CmsTextarea
                                                    rows={4}
                                                    value={row.body}
                                                    onChange={(e) => patch(i, { body: e.target.value })}
                                                />
                                            </CmsField>
                                        </div>
                                        <div className="sm:col-span-2">
                                            <UploadField
                                                url={row.imageUrl}
                                                onChange={(imageUrl) => patch(i, { imageUrl })}
                                                label="Picture"
                                                hint="Shown on the card and on the item's own screen."
                                            />
                                        </div>
                                        {/* No file upload. Pictures only, on
                                            request — `fileUrl` stays on the
                                            record so anything already attached
                                            still works, and nothing here
                                            writes it. */}

                                        {/*
                                          * NO LINK FIELD.
                                          *
                                          * It was read as "the picture's
                                          * address" — which is stored by the
                                          * upload and printed under the frame —
                                          * and asking for a second address next
                                          * to one that fills itself is a
                                          * question with no good answer. An
                                          * item without one opens its own
                                          * screen, which is what every item
                                          * here wants anyway. `href` stays on
                                          * the record, so anything already
                                          * pointed somewhere still goes there.
                                          */}
                                        <CmsField label="Category" hint="A short tag, e.g. Skills.">
                                            <CmsInput
                                                value={row.category}
                                                onChange={(e) => patch(i, { category: e.target.value })}
                                            />
                                        </CmsField>
                                        <CmsField label="Sector" hint="A short tag, e.g. Exports.">
                                            <CmsInput
                                                value={row.sector}
                                                onChange={(e) => patch(i, { sector: e.target.value })}
                                            />
                                        </CmsField>
                                        <CmsField label="Symbol" hint="Drawn beside this row.">
                                            <IconSelect
                                                value={row.icon}
                                                onChange={(icon) => patch(i, { icon })}
                                            />
                                        </CmsField>
                                    </div>
                                </details>
                            </div>


                        </div>

                        <RowTools rows={rows} index={i} onChange={onChange} />
                    </div>
                </div>
            ))}
        </div>
    );
}

/** The icon list, in one place, so every icon field offers the same names. */
function IconSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
    return (
        <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="h-12 w-full rounded-lg border border-slate-300 dark:border-[#2a2a2a]
                       bg-white dark:bg-[#0b0b0b] px-3 text-[1.25rem] text-slate-900 dark:text-neutral-100"
        >
            <option value="">No icon</option>
            {BAND_ICONS.map((name) => (
                <option key={name} value={name}>{name}</option>
            ))}
        </select>
    );
}

/* ------------------------------------------------------------ shared blocks */

/**
 * The banners and the social links.
 *
 * `explore` is a state-only card, so it is a prop rather than an assumption —
 * a region has no "Explore" picture card and should not be offered one.
 */
function RailFields({ draft, set, withExplore }: {
    draft: Record<string, unknown>;
    set: (patch: Record<string, unknown>) => void;
    withExplore: boolean;
}) {
    return (
        <CmsSection
            title="Picture cards and social links"
            hint="The banner cards on the page, and where the social icons point."
        >
            <div className="space-y-5">
                {withExplore && (
                    <CardRows
                        label="Picture card"
                        rows={draft.explore ? [draft.explore as PicCard] : []}
                        onChange={(rows) => set({ explore: rows[0] || {} })}
                    />
                )}
                <CardRows
                    label="Banner cards"
                    rows={(draft.promoCards as PicCard[]) || []}
                    onChange={(promoCards) => set({ promoCards })}
                />
                <BadgeRows
                    label="Social media links"
                    rows={((draft.socialLinks as { icon: string; href: string }[]) || [])
                        .map((row) => ({ icon: row.icon, label: row.href }))}
                    onChange={(rows) => set({
                        /* `BadgeRows` edits a label; here the label IS the
                           address. Mapped at the boundary rather than given its
                           own near-identical component. */
                        socialLinks: rows.map((row) => ({ icon: row.icon, href: row.label })),
                    })}
                />
            </div>
        </CmsSection>
    );
}

/** The line above the consulting icons, and the button under them. */
function ConsultingCopy({ draft, set }: {
    draft: Record<string, unknown>;
    set: (patch: Record<string, unknown>) => void;
}) {
    const cta = (draft.consultingCta || {}) as { label?: string; href?: string };
    return (
        <CmsSection
            title="Consulting section text"
            hint="The line above the consulting list, and the button under it."
        >
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                    <CmsField label="Introduction line">
                        <CmsInput
                            value={String(draft.consultingIntro || '')}
                            onChange={(e) => set({ consultingIntro: e.target.value })}
                        />
                    </CmsField>
                </div>
                <CmsField label="Button text">
                    <CmsInput
                        value={String(cta.label || '')}
                        onChange={(e) => set({ consultingCta: { ...cta, label: e.target.value } })}
                    />
                </CmsField>
                <CmsField label="Where the button goes">
                    <CmsInput
                        value={String(cta.href || '')}
                        placeholder="/contact"
                        onChange={(e) => set({ consultingCta: { ...cta, href: e.target.value } })}
                    />
                </CmsField>
            </div>
        </CmsSection>
    );
}

/*
 * ==========================================================================
 * THERE IS NO OFFICE BLOCK, AND NO MESSAGE-FORM SWITCH, ON A CONTACTS CARD
 * ==========================================================================
 *
 * `ContactFields` stood at the top of both contact cards and held a second
 * way to publish a person — name, designation, photograph, postal address,
 * city, pincode, email, telephone, map link — beside a contacts list that
 * holds all of it and holds MANY of them, in an order the editor sets.
 *
 * Two shapes for one answer meant an editor adding somebody had to work out
 * which of them the page would print first. The association asked for one
 * card, state-wise then region-wise then district-wise, and that is the list.
 *
 * The message-form switch went with it. It is not a contact — it is whether
 * the page offers a Write to Us box — and it was on this card only because
 * the office block was its neighbour.
 *
 * NO FIELD WAS DROPPED FROM THE RECORD. `contact` and `feedbackEnabled` are
 * still read into the draft and written back untouched, so every page keeps
 * the form it has today and nothing published changes. What went is the pair
 * of editors, and with them the second place to type a telephone number.
 */


/* ---------------------------------------------------------- custom sections */

/** What the site knows how to draw. Each one IS a card already on the page. */
const SECTION_LAYOUTS: { value: CustomSection['layout']; label: string; hint: string }[] = [
    { value: 'list', label: 'Icon list', hint: 'An icon, a title and a line of summary — like Policy Advocacy.' },
    { value: 'tiles', label: 'List with photographs', hint: 'A thumbnail per row — like Projects.' },
    { value: 'dated', label: 'Dated list', hint: 'A date chip per row — like Events.' },
    { value: 'figures', label: 'Figures', hint: 'A large number and what it counts — like Statistics.' },
    { value: 'text', label: 'Paragraph', hint: 'One block of writing, no list.' },
];

/**
 * Sections the association adds itself.
 *
 * =========================================================================
 * THE LAYOUT IS A CHOICE FROM A LIST, NOT A FREE FIELD
 * =========================================================================
 *
 * Whatever is chosen here, the public page draws the section with a card it
 * already uses — so a section created in this panel lines up with the sections
 * that shipped, at the same heights and the same type scale, without anybody
 * having to match them by hand. A free-text layout field would let an editor
 * save something the site cannot draw and see an empty space instead.
 *
 * The address of its "View All" screen is derived from the title
 * (`/states/tamil-nadu/section-scholarships`) and shown, because an editor
 * renaming a section is changing a link somebody may have shared.
 */
function CustomSections({ draft, set, basePath }: {
    draft: Record<string, unknown>;
    set: (patch: Record<string, unknown>) => void;
    basePath: string;
}) {
    const rows = (draft.customSections as CustomSection[]) || [];

    const patch = (i: number, next: Partial<CustomSection>) => set({
        customSections: rows.map((row, index) => (index === i ? { ...row, ...next } : row)),
    });

    const keyOf = (row: CustomSection) => (row.key || row.title || '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    return (
        <CmsSection
            title="Your own sections"
            hint="Anything the page does not already have. Added here, it appears on the live page in the same layout as the sections around it."
            actions={
                <AddRowButton
                    label="Add a section"
                    onClick={() => set({
                        customSections: [...rows, {
                            key: '', title: '', icon: 'grid', layout: 'list',
                            intro: '', text: '', items: [],
                            displayOrder: rows.length + 1,
                        } as CustomSection],
                    })}
                />
            }
        >
            {!rows.length ? (
                <p className="text-[1.25rem] text-slate-500 dark:text-neutral-400">
                    No sections of your own yet. Add one for anything this page does not already
                    cover — scholarships, trade delegations, a member directory — and choose how it
                    should be drawn.
                </p>
            ) : (
                <div className="space-y-4">
                    {rows.map((row, i) => (
                        <div
                            key={i}
                            className="rounded-xl border border-slate-300 dark:border-[#2a2a2a] p-4"
                        >
                            <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-0 space-y-4">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <CmsField label="Section name" hint="The heading readers see.">
                                            <CmsInput
                                                value={row.title}
                                                placeholder="Scholarships"
                                                onChange={(e) => patch(i, { title: e.target.value })}
                                            />
                                        </CmsField>
                                        <CmsField label="Symbol" hint="Drawn beside the heading.">
                                            <IconSelect
                                                value={row.icon}
                                                onChange={(icon) => patch(i, { icon })}
                                            />
                                        </CmsField>
                                        <div className="sm:col-span-2">
                                            <CmsField
                                                label="Layout"
                                                hint={SECTION_LAYOUTS.find((l) => l.value === row.layout)?.hint}
                                            >
                                                <select
                                                    value={row.layout}
                                                    onChange={(e) => patch(i, {
                                                        layout: e.target.value as CustomSection['layout'],
                                                    })}
                                                    className="h-12 w-full rounded-lg border border-slate-300
                                                               dark:border-[#2a2a2a] bg-white dark:bg-[#0b0b0b]
                                                               px-3 text-[1.25rem] text-slate-900
                                                               dark:text-neutral-100"
                                                >
                                                    {SECTION_LAYOUTS.map((layout) => (
                                                        <option key={layout.value} value={layout.value}>
                                                            {layout.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </CmsField>
                                        </div>
                                        <div className="sm:col-span-2">
                                            <CmsField
                                                label="Introduction line"
                                                hint="Optional. Shown under the heading on this section's own screen."
                                            >
                                                <CmsInput
                                                    value={row.intro}
                                                    onChange={(e) => patch(i, { intro: e.target.value })}
                                                />
                                            </CmsField>
                                        </div>
                                    </div>

                                    {row.layout === 'text' ? (
                                        <CmsField
                                            label="The text"
                                            hint="Shown on the card, and in full on its own screen when it is long."
                                        >
                                            <CmsTextarea
                                                rows={6}
                                                value={row.text}
                                                onChange={(e) => patch(i, { text: e.target.value })}
                                            />
                                        </CmsField>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-[1.1875rem] font-semibold text-slate-700
                                                              dark:text-neutral-200">
                                                    Items
                                                </p>
                                                <AddRowButton
                                                    label="Add item"
                                                    onClick={() => patch(i, {
                                                        items: [...row.items, blankRow(row.items.length)],
                                                    })}
                                                />
                                            </div>
                                            <FeedRows
                                                rows={row.items}
                                                onChange={(items) => patch(i, { items })}
                                                withDate={row.layout === 'dated'}
                                                figures={row.layout === 'figures'}
                                            />
                                        </div>
                                    )}

                                    {keyOf(row) && (
                                        <p className="text-[1.0625rem] font-semibold text-slate-500
                                                      dark:text-neutral-400">
                                            Its own screen:{' '}
                                            <code className="rounded bg-slate-100 dark:bg-[#141414] px-1.5 py-0.5">
                                                {basePath}/section-{keyOf(row)}
                                            </code>
                                        </p>
                                    )}
                                </div>

                                <RowTools
                                    rows={rows}
                                    index={i}
                                    onChange={(customSections) => set({ customSections })}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </CmsSection>
    );
}

/* ------------------------------------------------------------- photographs */

/**
 * The photographs on THIS page, managed from this page.
 *
 * =========================================================================
 * WHY THEY ARE HERE AND NOT ONLY IN THE GALLERY SCREEN
 * =========================================================================
 *
 * A state page's strip is the site gallery filtered by state. Until now the
 * only way to add to it was the site-wide Gallery screen — which could not tag
 * a photograph with a state at all (the field was dropped on write), so in
 * practice the strip could only be filled by a script. An editor looking at
 * Tamil Nadu could see photographs on the live page and find no control for
 * them anywhere.
 *
 * Everything added here is a normal gallery item, tagged with this state and
 * its region. It appears in the Gallery screen too — one collection, two ways
 * in — so nothing is hidden from the editor who goes looking in the other
 * place.
 */
function PagePhotos({ state, region, label }: {
    state?: string;
    region?: string;
    label: string;
}) {
    const [rows, setRows] = useState<GalleryPhoto[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    /**
     * `quiet` refetches WITHOUT blanking the rail.
     *
     * The loading flag swaps the strip for a spinner. On first open that is
     * right; after adding or removing a photograph it throws the editor back
     * up a very long page, because the page briefly becomes short enough for
     * the browser to clamp the scroll.
     */
    const load = useCallback(async ({ quiet = false } = {}) => {
        if (!quiet) setLoading(true);
        try {
            const result = await listRegionGallery({ state, region, limit: 60 });
            setRows(result.items || []);
        } catch {
            setRows([]);
        } finally {
            if (!quiet) setLoading(false);
        }
    }, [state, region]);

    useEffect(() => { load(); }, [load]);

    const add = async (file?: File | null) => {
        if (!file) return;
        setBusy(true);
        try {
            await addGalleryItem({
                title: file.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 80),
                caption: '',
                state: state || '',
                region: region || '',
                visible: true,
                showOnHome: false,
            }, file);
            toast.success('Photograph added');
            await load({ quiet: true });
        } catch (err) {
            toast.error(errorMessage(err, 'That photograph could not be added'));
        } finally {
            setBusy(false);
        }
    };

    const remove = async (photo: GalleryPhoto) => {
        setBusy(true);
        try {
            await deleteGalleryItem(photo.id);
            toast.success('Photograph removed');
            await load({ quiet: true });
        } catch (err) {
            toast.error(errorMessage(err, 'That photograph could not be removed'));
        } finally {
            setBusy(false);
        }
    };

    const rename = async (photo: GalleryPhoto, title: string) => {
        if (title === photo.title) return;
        try {
            await updateGalleryItem(photo.id, { title });
            setRows((list) => list.map((row) => (row.id === photo.id ? { ...row, title } : row)));
        } catch (err) {
            toast.error(errorMessage(err, 'That caption could not be saved'));
        }
    };

    return (
        <CmsSection
            title="Photographs"
            hint={`The photo gallery on the ${label} page. Added here, a photograph is tagged to this ${label} and appears in its strip straight away.`}
            actions={
                <>
                    <CmsButton
                        variant="ghost"
                        loading={busy}
                        onClick={() => fileRef.current?.click()}
                    >
                        <Plus className="w-4 h-4" /> Add a photograph
                    </CmsButton>
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => { add(e.target.files && e.target.files[0]); e.target.value = ''; }}
                    />
                </>
            }
        >
            {loading ? (
                <p className="text-[1.25rem] text-slate-500 dark:text-neutral-400">Loading photographs…</p>
            ) : !rows.length ? (
                <p className="text-[1.25rem] text-slate-500 dark:text-neutral-400">
                    No photographs yet. The Photo Gallery card is left off the page until there is one.
                </p>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {rows.map((photo) => (
                        <div
                            key={photo.id}
                            className="rounded-xl border border-slate-200 dark:border-[#2a2a2a] overflow-hidden"
                        >
                            <div className="aspect-[4/3] bg-slate-100 dark:bg-[#141414] overflow-hidden">
                                <img
                                    src={resolveMediaUrl(photo.media.url)}
                                    alt=""
                                    className="h-full w-full object-cover"
                                />
                            </div>
                            <div className="p-3 space-y-2">
                                <CmsInput
                                    defaultValue={photo.title}
                                    onBlur={(e) => rename(photo, e.target.value)}
                                    placeholder="Caption"
                                />
                                <button
                                    type="button"
                                    onClick={() => remove(photo)}
                                    disabled={busy}
                                    className="inline-flex items-center gap-1.5 text-[1.0625rem] font-bold
                                               text-slate-500 transition-colors hover:text-red-600
                                               disabled:opacity-50"
                                >
                                    <Trash2 size={14} /> Remove
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </CmsSection>
    );
}
