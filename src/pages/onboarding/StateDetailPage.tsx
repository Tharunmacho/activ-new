import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft, ChevronRight, ChevronLeft, MapPin, Download, ExternalLink, User,
} from 'lucide-react';
import { HeaderSection } from '@/components/layout/HeaderSection';
import { FooterSection } from '@/components/layout/FooterSection';
import { SCREEN_CONTAINER } from '@/components/layout/pageContainer';
import { SECTION_HEADING, MICRO_LABEL } from '@/components/layout/typography';
import { CmsIcon } from '@/components/shared/CmsIcon';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import { resolveMediaUrl, sizedMediaUrl } from '@/config/api.config';
import {
    getStatePage, getRegionPage, listRegionGallery,
    type StatePage, type RegionPage, type RegionFeedItem, type RegionLeader,
    type GalleryPhoto,
} from '@/services/cmsRegionsApi';
import { DASH_CARD, PhotoLightbox } from './components/StateDashboard';
import { PersonPhoto } from './components/PersonPhoto';

/**
 * What "View All" opens — one list, in full, on its own screen.
 *
 * =========================================================================
 * A SCREEN, NOT A DIALOG
 * =========================================================================
 *
 * These were a dialog, and before that a feed page that 404'd on two of the
 * types. Both were wrong for the same reason: the association asked for the
 * detail to be a PAGE — something with the site's header and footer, a
 * breadcrumb that says where you are, a heading, and room for the pictures and
 * paragraphs a card had to clip. That is what a reader means by "show me
 * everything".
 *
 * ---------------------------------------------------------------- one page
 *
 * One component serves every list on both the state and the region pages —
 * events, projects, policy, publications, media, achievements, the leadership,
 * and the full description. They are the same object under different headings,
 * so writing nine pages would be writing the empty state and the breadcrumb
 * nine times and getting one of them wrong.
 *
 * The page it belongs to is fetched whole, because it already is: no endpoint
 * returns just one list, and asking for the page gives the breadcrumb and the
 * neighbouring lists for free.
 */

/** The heading each list is known by. The key is what the URL and API use. */
const TITLES: Record<string, string> = {
    about: 'About',
    gallery: 'Photo Gallery',
    leaders: 'Leadership',
    achievements: 'Highlights',
    keyAchievements: 'Key Achievements',
    events: 'Events',
    projects: 'Projects',
    policyAdvocacy: 'Policy Advocacy',
    consultingServices: 'Consulting Services',
    publications: 'Publications',
    mediaReleases: 'Media Releases',
    mediaCoverages: 'Media Coverages',
    sectorUpdates: 'Sector Update',
    newsUpdates: 'News Update',
    speakInMedia: 'In the Media',
};

const PER_PAGE = 12;

/** Photographs to a page. Two full rows of four on a wide screen, three on a laptop. */
const GALLERY_PER = 24;

/**
 * The lists whose rows are a cover, a title and a date — drawn as tiles.
 *
 * Everything else is a row card: a picture beside a summary and a body. The
 * distinction is what the ROWS hold, so it is named here rather than guessed
 * from whichever page happens to be loaded.
 */
const TILE_LISTS = new Set([
    'publications', 'mediaReleases', 'mediaCoverages', 'newsUpdates',
    'sectorUpdates', 'speakInMedia', 'achievements',
]);

export default function StateDetailPage({ scope }: { scope: 'state' | 'region' }) {
    const { slug, type } = useParams<{ slug: string; type: string }>();
    const [params, setParams] = useSearchParams();
    const [page, setPage] = useState<StatePage | RegionPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);

    const offset = Math.max(0, Number(params.get('offset') || 0));

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setFailed(false);
        window.scrollTo({ top: 0, behavior: 'auto' });

        const fetcher = scope === 'state' ? getStatePage : getRegionPage;
        fetcher(String(slug || ''))
            .then((data) => { if (!cancelled) { setPage(data as StatePage); setLoading(false); } })
            .catch(() => { if (!cancelled) { setFailed(true); setLoading(false); } });

        return () => { cancelled = true; };
    }, [scope, slug]);

    const key = String(type || '');
    const heading = TITLES[key] || 'Details';

    /** The pager, for both the feed lists and the gallery. */
    const goToOffset = (next: number) => {
        const nextParams = new URLSearchParams(params);
        if (next <= 0) nextParams.delete('offset'); else nextParams.set('offset', String(next));
        setParams(nextParams);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    /*
     * THE PHOTOGRAPHS, WHEN THIS IS THE GALLERY.
     *
     * They are not on the page document — the gallery is its own collection,
     * filtered by state or region — so this is a second fetch. It is declared
     * here, above every early return, because a hook that runs on some renders
     * and not others is a hook whose order changes.
     */
    const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
    const [photoTotal, setPhotoTotal] = useState(0);
    const [lightbox, setLightbox] = useState<number | null>(null);

    useEffect(() => {
        if (key !== 'gallery' || !page) return undefined;
        let cancelled = false;
        const filter = scope === 'state'
            ? { state: (page as StatePage).stateName }
            : { region: (page as RegionPage).regionKey };
        /*
         * A PAGE AT A TIME, from the server.
         *
         * An association with sixty photographs of a state is the case this
         * screen exists for, and fetching all sixty to lay them out in one
         * scroll is the case it handled worst — sixty images decoding at once
         * on a connection that has just loaded the page.
         */
        listRegionGallery({ ...filter, limit: GALLERY_PER, offset })
            .then((result) => {
                if (cancelled) return;
                setPhotos(result.items || []);
                setPhotoTotal(result.total || (result.items || []).length);
            })
            .catch(() => { if (!cancelled) { setPhotos([]); setPhotoTotal(0); } });
        return () => { cancelled = true; };
    }, [key, page, scope, offset]);

    /* ------------------------------------------------------------- states */

    if (loading) {
        return (
            <Shell>
                <div className={`${SCREEN_CONTAINER} py-10 animate-pulse`}>
                    <div className="h-5 w-48 bg-slate-200 rounded mb-6" />
                    <div className="h-10 w-72 bg-slate-200 rounded mb-10" />
                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="h-56 bg-slate-200 rounded-2xl" />
                        ))}
                    </div>
                </div>
            </Shell>
        );
    }

    if (failed || !page) {
        return (
            <Shell>
                <div className={`${SCREEN_CONTAINER} py-24 text-center`}>
                    <h1 className={`${SECTION_HEADING} text-brand-800 mb-4`}>Not published yet</h1>
                    <p className="text-[1.25rem] sm:text-[1.0625rem] font-semibold text-gray-500 mb-8">
                        This page has not been published.
                    </p>
                    <Link to="/" className={BACK_BTN}><ArrowLeft size={15} /> Back to home</Link>
                </div>
            </Shell>
        );
    }

    const isState = scope === 'state';
    const parentHref = isState ? `/states/${page.slug}` : `/regions/${page.slug}`;
    const parentName = isState ? (page as StatePage).stateName : (page as RegionPage).regionName;

    /*
     * ONE WAY BACK, AT THE TOP.
     *
     * This was a four-link breadcrumb — Home, the region, the state, the list —
     * and the only one anybody ever pressed was the state. Four links to say
     * one thing is four chances to press the wrong one; the page title and the
     * state name above it already say where you are.
     */
    const crumbs = (
        <Link
            to={parentHref}
            className="inline-flex items-center gap-2 text-[1.0625rem] font-bold uppercase
                       tracking-[0.1em] text-gray-500 hover:text-brand-700 transition-colors mb-6"
        >
            <ArrowLeft size={14} /> Back to {parentName}
        </Link>
    );

    /* ------------------------------------------------------- the two odd ones */

    if (key === 'about') {
        const full = page.fullDescription || page.shortDescription;
        return (
            <Shell>
                <div className={`${SCREEN_CONTAINER} py-8 sm:py-10`}>
                    {crumbs}
                    <Heading heading={`About ${parentName}`} />

                    {/*
                      * THE PHOTOGRAPH BESIDE THE TEXT, NOT ABOVE IT.
                      *
                      * A full-width band 1800px across and 190px tall is a crop
                      * of a photograph rather than a photograph — the subject
                      * was cut off top and bottom and there was nothing to see.
                      * Its own column at 4/3 shows the whole of it, and the
                      * paragraph beside it keeps a measure a reader can track a
                      * line of without the `max-w` that used to leave half the
                      * card empty.
                      */}
                    <div className={`${DASH_CARD} overflow-hidden`}>
                        <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                            <div className="order-2 lg:order-1 p-6 sm:p-8">
                                <p className="text-[1.0625rem] sm:text-[1.25rem] leading-relaxed font-semibold
                                              text-gray-700 whitespace-pre-line">
                                    {full}
                                </p>

                                {page.hero.facts.length > 0 && (
                                    <dl className="mt-7 grid gap-3.5 sm:grid-cols-2">
                                        {page.hero.facts.map((fact, i) => (
                                            <div
                                                key={i}
                                                className="rounded-xl border border-gray-200 bg-[#f7f9fc]
                                                           px-4 py-3.5"
                                            >
                                                <dt className="flex items-center gap-2 text-[1.0625rem] font-bold
                                                               uppercase tracking-wider text-gray-500">
                                                    <CmsIcon name={fact.icon} size={13} fallback="map-pin" />
                                                    {fact.label}
                                                </dt>
                                                <dd className="mt-1 text-[1.0625rem] font-extrabold
                                                               text-brand-900">
                                                    {fact.value}
                                                </dd>
                                            </div>
                                        ))}
                                    </dl>
                                )}

                                {page.hero.features.length > 0 && (
                                    <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
                                        {page.hero.features.map((feature, i) => (
                                            <div
                                                key={i}
                                                className="flex items-center gap-3 rounded-xl border
                                                           border-brand-100 bg-[#f7f9fc] px-4 py-3.5"
                                            >
                                                <span className="flex h-9 w-9 shrink-0 items-center
                                                                 justify-center rounded-lg bg-white
                                                                 text-brand-600 border border-brand-100">
                                                    <CmsIcon name={feature.icon} size={16} fallback="star" />
                                                </span>
                                                <span className="text-[1.0625rem] font-bold text-brand-800
                                                                 leading-snug">
                                                    {feature.label}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {page.hero.backgroundUrl && (
                                <div className="order-1 lg:order-2 p-6 sm:p-8 lg:pl-0">
                                    {/* 4/3 on a phone, the height of the text
                                        column on a desktop — so the card has no
                                        band of empty white under the picture. */}
                                    <div className="relative h-full overflow-hidden rounded-xl aspect-[4/3]
                                                    lg:aspect-auto lg:min-h-[22rem] bg-brand-900">
                                        <img
                                            src={sizedMediaUrl(page.hero.backgroundUrl, 1200)}
                                            alt={parentName}
                                            className="h-full w-full object-cover"
                                        />
                                        {page.hero.tagline && (
                                            <>
                                                <div className="absolute inset-x-0 bottom-0 h-2/5
                                                                bg-gradient-to-t from-brand-900/85
                                                                to-transparent" />
                                                <p className="absolute inset-x-0 bottom-0 p-5 text-[1.0625rem]
                                                              sm:text-[1.25rem] font-bold text-white leading-snug">
                                                    {page.hero.tagline}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Shell>
        );
    }

    if (key === 'gallery') {
        return (
            <Shell>
                <div className={`${SCREEN_CONTAINER} py-8 sm:py-10`}>
                    {crumbs}
                    <Heading heading="Photo Gallery" />

                    {/*
                      * THE STATE'S OWN SHELL, NOT `/gallery?state=`.
                      *
                      * That link opened the association's gallery with a filter
                      * chip on it — a different gutter, a different heading and
                      * a set of dropdowns, which is why it read as landing
                      * somewhere else. This is the same page furniture as every
                      * other list a state card opens.
                      */}
                    {photos.length ? (
                        <div className="grid gap-5 grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                            {photos.map((photo, i) => (
                                <button
                                    key={photo.id}
                                    type="button"
                                    onClick={() => setLightbox(i)}
                                    className={`${DASH_CARD} group block overflow-hidden text-left
                                                transition-shadow
                                                hover:shadow-[0_22px_48px_-20px_rgb(28_46_104/0.4)]`}
                                >
                                    <div className="w-full aspect-[4/3] overflow-hidden bg-gray-50">
                                        <CmsMediaFrame
                                            media={photo.media}
                                            width={480}
                                            className="group-hover:scale-105 transition-transform
                                                       duration-500 transform-gpu"
                                        />
                                    </div>
                                    <div className="px-4 py-3.5">
                                        <p className="text-[1.0625rem] font-extrabold text-brand-900
                                                      line-clamp-2 leading-snug">
                                            {photo.title || 'Untitled'}
                                        </p>
                                        {(photo.location || photo.eventDate) && (
                                            <p className="mt-1 flex items-center gap-1 text-[1.0625rem]
                                                          font-semibold text-gray-500">
                                                <MapPin size={11} className="shrink-0 text-brand-400" />
                                                <span className="truncate">
                                                    {[photo.location, photo.eventDate]
                                                        .filter(Boolean).join(' \u00b7 ')}
                                                </span>
                                            </p>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <Empty />
                    )}

                    {photoTotal > GALLERY_PER && (
                        <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
                            <p className="text-[1.0625rem] font-semibold text-gray-500">
                                Showing{' '}
                                <span className="font-extrabold text-brand-800">
                                    {photos.length ? offset + 1 : 0}&ndash;{offset + photos.length}
                                </span>
                                {' '}of <span className="font-extrabold text-brand-800">{photoTotal}</span>
                            </p>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    disabled={offset <= 0}
                                    onClick={() => goToOffset(Math.max(0, offset - GALLERY_PER))}
                                    className={PAGE_BTN_GHOST}
                                >
                                    <ChevronLeft size={15} /> Back
                                </button>
                                <button
                                    type="button"
                                    disabled={offset + photos.length >= photoTotal}
                                    onClick={() => goToOffset(offset + GALLERY_PER)}
                                    className={PAGE_BTN}
                                >
                                    Next <ChevronRight size={15} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {lightbox !== null && (
                    <PhotoLightbox
                        photos={photos}
                        index={lightbox}
                        onIndex={setLightbox}
                        onClose={() => setLightbox(null)}
                    />
                )}
            </Shell>
        );
    }

    if (key === 'leaders') {
        const leaders = page.leaders as RegionLeader[];
        return (
            <Shell>
                <div className={`${SCREEN_CONTAINER} py-8 sm:py-10`}>
                    {crumbs}
                    <Heading heading={`ACTIV ${parentName} Leadership`} />

                    {leaders.length ? (
                        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                            {leaders.map((person, i) => (
                                <article key={person.id || i} className={`${DASH_CARD} overflow-hidden`}>
                                    <div className="w-full aspect-[4/3] max-h-56 bg-gray-100 overflow-hidden">
                                        <PersonPhoto url={person.photoUrl} name={person.name}
                                            width={640} fallbackSize={32} />
                                    </div>

                                    <div className="p-5">
                                        {person.role && (
                                            <span className="inline-block rounded-full bg-brand-700 px-2.5 py-1
                                                             text-[1rem] font-bold uppercase tracking-wide
                                                             text-white mb-2">
                                                {person.role}
                                            </span>
                                        )}
                                        <p className="text-[1.0625rem] sm:text-[1.25rem] font-extrabold
                                                      text-brand-900">
                                            {person.name}
                                        </p>
                                        {person.designation && (
                                            <p className="mt-1 text-[1.25rem] font-semibold text-gray-600">
                                                {person.designation}
                                            </p>
                                        )}
                                        {person.organisation && (
                                            <p className="text-[1.25rem] font-semibold text-gray-600">
                                                {person.organisation}
                                            </p>
                                        )}
                                        {person.bio && (
                                            <p className="mt-2.5 text-[1.25rem] leading-relaxed font-semibold
                                                          text-gray-500">
                                                {person.bio}
                                            </p>
                                        )}
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <Empty />
                    )}


                </div>
            </Shell>
        );
    }

    /* ------------------------------------------------------------ the lists */

    /*
     * A SECTION THE ASSOCIATION INVENTED.
     *
     * `/states/tamil-nadu/section-scholarships` is a custom section's screen.
     * It is resolved from the page document rather than from a feed endpoint,
     * because the page already carries it — and it is drawn by the same two
     * card shapes every built-in list uses, so a section created this morning
     * gets the layout the shipped ones have.
     */
    const custom = key.startsWith('section-')
        ? (page.customSections || []).find((row) => `section-${row.key}` === key)
        : undefined;

    if (key.startsWith('section-') && !custom) {
        return (
            <Shell>
                <div className={`${SCREEN_CONTAINER} py-8 sm:py-10`}>
                    {crumbs}
                    <Heading heading="Not published yet" />
                    <Empty />
                </div>
            </Shell>
        );
    }

    if (custom && custom.layout === 'text') {
        return (
            <Shell>
                <div className={`${SCREEN_CONTAINER} py-8 sm:py-10`}>
                    {crumbs}
                    <Heading heading={custom.title} />
                    <div className={`${DASH_CARD} p-6 sm:p-8`}>
                        {custom.intro && (
                            <p className="text-[1.25rem] sm:text-[1.0625rem] font-bold text-brand-800 mb-4">
                                {custom.intro}
                            </p>
                        )}
                        <p className="max-w-4xl text-[1.0625rem] sm:text-[1.25rem] leading-relaxed
                                      font-semibold text-gray-700 whitespace-pre-line">
                            {custom.text}
                        </p>
                    </div>
                </div>
            </Shell>
        );
    }

    const all = custom
        ? custom.items
        : ((page as unknown as Record<string, RegionFeedItem[]>)[key] || []);
    const shown = all.slice(offset, offset + PER_PAGE);
    /* Does this list illustrate itself? Policy notes and media releases do not,
       and a column of grey placeholders is worse than no column. */
    const hasMedia = all.some((row) => !!row.imageUrl);
    /*
     * TILES, OR ROWS.
     *
     * A publication is a cover, a title and a date. In the wide row card the
     * words ran out a third of the way down and the other two thirds were
     * white — which is exactly what was reported. Those lists are tiles, the
     * same shape as the photo gallery. Events and projects keep the row, whose
     * width is what their summary and body need.
     */
    const isTiles = custom
        ? (custom.layout === 'tiles' || custom.layout === 'figures')
        : TILE_LISTS.has(key);
    const from = all.length ? offset + 1 : 0;
    const to = offset + shown.length;

    const goTo = goToOffset;

    return (
        <Shell>
            <div className={`${SCREEN_CONTAINER} py-8 sm:py-10`}>
                {crumbs}
                <Heading heading={custom ? custom.title : heading} />

                {custom && custom.intro && (
                    <p className="-mt-4 mb-7 max-w-3xl text-[1.25rem] font-semibold text-gray-600">
                        {custom.intro}
                    </p>
                )}

                {/* TWO ACROSS, THE PICTURE BESIDE THE TEXT.
                    Four columns of stacked cards gave every row a wide
                    letterbox photograph over three lines of type, so the screen
                    read as a contact sheet and the writing had nowhere to go.
                    Two across is the About screen's proportion — picture left,
                    words right, at a measure a reader can follow.

                    `hasMedia` is decided for the LIST, not the row: one row
                    without a photograph in a list that has them gets a quiet
                    placeholder, but a list with no photographs at all drops the
                    column rather than printing a row of empty grey.

                    The comment sits OUTSIDE the ternary: a JSX comment is an
                    expression container, and an expression slot can hold exactly
                    one, so putting it inside the branch is a syntax error. */}
                {shown.length ? (
                    <div
                        className={`grid gap-5 items-stretch ${isTiles
                            ? 'sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'
                            : 'xl:grid-cols-2'}`}
                    >
                        {shown.map((row, i) => (isTiles
                            ? <TileCard key={row.id || i} row={row} hasMedia={hasMedia} />
                            : <DetailCard key={row.id || i} row={row} hasMedia={hasMedia} />
                        ))}
                    </div>
                ) : (
                    <Empty />
                )}

                {all.length > PER_PAGE && (
                    <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
                        <p className="text-[1.0625rem] font-semibold text-gray-500">
                            Showing <span className="font-extrabold text-brand-800">{from}–{to}</span>
                            {' '}of <span className="font-extrabold text-brand-800">{all.length}</span>
                        </p>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                disabled={offset <= 0}
                                onClick={() => goTo(Math.max(0, offset - PER_PAGE))}
                                className={PAGE_BTN_GHOST}
                            >
                                <ChevronLeft size={15} /> Back
                            </button>
                            <button
                                type="button"
                                disabled={to >= all.length}
                                onClick={() => goTo(offset + PER_PAGE)}
                                className={PAGE_BTN}
                            >
                                Next <ChevronRight size={15} />
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </Shell>
    );
}

/* ------------------------------------------------------------------ pieces */

const BACK_BTN =
    'inline-flex items-center gap-2 bg-brand-800 hover:bg-brand-700 text-white px-8 py-3.5 '
    + 'rounded-full font-bold text-[1.0625rem] uppercase tracking-[0.1em] transition-colors';

const PAGE_BTN =
    'inline-flex items-center gap-2 rounded-full bg-brand-800 px-5 py-2.5 text-[1.0625rem] font-bold '
    + 'uppercase tracking-[0.1em] text-white transition-colors hover:bg-brand-700 '
    + 'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-brand-800';

const PAGE_BTN_GHOST =
    'inline-flex items-center gap-2 rounded-full border border-brand-200 px-5 py-2.5 text-[1.0625rem] '
    + 'font-bold uppercase tracking-[0.1em] text-brand-700 transition-colors hover:bg-brand-50 '
    + 'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent';

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col min-h-screen font-sans dot-band">
            <HeaderSection />
            <main className="flex-grow">{children}</main>
            <FooterSection />
        </div>
    );
}

/**
 * The page title. One line, and nothing else.
 *
 * It carried an eyebrow with the state's name and a count beside the title.
 * The eyebrow repeated the back link directly above it — BACK TO TAMIL NADU —
 * and the count was a number a reader had not asked for standing where a
 * subtitle would be. `SECTION_HEADING` is the site's hero size and was four
 * times the eyebrow; 30px is the size a list page is titled at.
 */
function Heading({ heading }: { heading: string }) {
    return (
        <h1 className="mb-7 text-2xl sm:text-[2.1875rem] font-black tracking-tight text-brand-800">
            {heading}
        </h1>
    );
}

function Empty() {
    return (
        <div className={`${DASH_CARD} px-6 py-16 text-center`}>
            <p className="text-[1.25rem] sm:text-[1.0625rem] font-extrabold text-brand-900">
                Nothing has been published here yet
            </p>
            <p className="mt-2 text-[1.0625rem] font-semibold text-gray-500">
                This list is written in the CMS and will appear as soon as it has something in it.
            </p>
        </div>
    );
}

/**
 * One item, whole.
 *
 * The card on the dashboard clips the summary to two lines and drops the body
 * entirely; this is where they are printed. A picture when there is one, the
 * date and place when there are, and the link or the file when the editor set
 * either.
 */
function DetailCard({ row, hasMedia }: { row: RegionFeedItem; hasMedia: boolean }) {
    return (
        <article className={`${DASH_CARD} overflow-hidden flex flex-col sm:flex-row`}>
            {hasMedia && (
                /*
                  * A COLUMN, not a band across the top.
                  *
                  * 4/3 on a phone where it stacks, and the full height of the
                  * card once there is room beside the text — which is what the
                  * About screen does with the state photograph, and the reason
                  * that screen reads as finished.
                  */
                <div className="relative w-full sm:w-52 lg:w-60 shrink-0 aspect-[4/3] sm:aspect-auto
                                sm:min-h-[13rem] overflow-hidden bg-brand-50">
                    {row.imageUrl ? (
                        <img
                            src={sizedMediaUrl(row.imageUrl, 640)}
                            alt=""
                            aria-hidden="true"
                            loading="lazy"
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        /* Quiet, and clearly deliberate: a row in an
                           illustrated list that has no photograph yet. */
                        <span className="flex h-full w-full items-center justify-center text-brand-200">
                            <CmsIcon name={row.icon} size={26} fallback="image" />
                        </span>
                    )}
                </div>
            )}

            <div className="flex flex-1 min-w-0 flex-col p-5 sm:p-6">
                {(row.date || row.location) && (
                    <p className={MICRO_LABEL + ' text-brand-500 mb-1.5'}>
                        {[row.date, row.location].filter(Boolean).join(' \u00b7 ')}
                    </p>
                )}

                <h2 className="text-[1.25rem] sm:text-[1.0625rem] font-extrabold text-brand-900 leading-snug">
                    {row.title}
                </h2>

                {row.summary && (
                    <p className="mt-2 text-[1.0625rem] leading-relaxed font-semibold text-gray-600">
                        {row.summary}
                    </p>
                )}

                {row.body && (
                    <p className="mt-2 text-[1.25rem] leading-relaxed font-semibold text-gray-500
                                  whitespace-pre-line">
                        {row.body}
                    </p>
                )}

                {(row.category || row.sector) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {[row.category, row.sector].filter(Boolean).map((tag) => (
                            <span
                                key={tag}
                                className="rounded-full bg-brand-50 px-2.5 py-1 text-[1rem] font-bold
                                           text-brand-700"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}

                {/* `mt-auto` so every card's link sits on the same line, whatever
                    length the summary above it happens to be. */}
                {(row.href || row.fileUrl) && (
                    <div className="mt-auto pt-4 flex flex-wrap gap-4">
                        {row.href && (
                            row.href.startsWith('/') ? (
                                <Link to={row.href} className={DETAIL_LINK}>
                                    Read more <ChevronRight size={14} />
                                </Link>
                            ) : (
                                <a href={row.href} target="_blank" rel="noopener noreferrer" className={DETAIL_LINK}>
                                    Read more <ExternalLink size={13} />
                                </a>
                            )
                        )}
                        {row.fileUrl && (
                            <a
                                href={resolveMediaUrl(row.fileUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={DETAIL_LINK}
                            >
                                Download <Download size={14} />
                            </a>
                        )}
                    </div>
                )}
            </div>
        </article>
    );
}

/**
 * One item as a tile — a cover, a title, a date, and the file if there is one.
 *
 * Deliberately plain. A publication card that tries to be a feature card is a
 * feature card with nothing in it.
 */
function TileCard({ row, hasMedia }: { row: RegionFeedItem; hasMedia: boolean }) {
    return (
        <article className={`${DASH_CARD} overflow-hidden flex flex-col`}>
            {hasMedia && (
                <div className="w-full aspect-[4/3] max-h-52 overflow-hidden bg-brand-50">
                    {row.imageUrl ? (
                        <img
                            src={sizedMediaUrl(row.imageUrl, 640)}
                            alt=""
                            aria-hidden="true"
                            loading="lazy"
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <span className="flex h-full w-full items-center justify-center text-brand-200">
                            <CmsIcon name={row.icon} size={24} fallback="file-text" />
                        </span>
                    )}
                </div>
            )}

            <div className="flex flex-1 flex-col p-4 sm:p-5">
                {(row.date || row.location) && (
                    <p className={MICRO_LABEL + ' text-brand-500 mb-1.5'}>
                        {[row.date, row.location].filter(Boolean).join(' \u00b7 ')}
                    </p>
                )}

                <h2 className="text-[1.0625rem] sm:text-[1.25rem] font-extrabold text-brand-900 leading-snug">
                    {row.title}
                </h2>

                {row.summary && (
                    <p className="mt-1.5 text-[1.25rem] leading-relaxed font-semibold text-gray-600
                                  line-clamp-3">
                        {row.summary}
                    </p>
                )}

                {(row.href || row.fileUrl) && (
                    <div className="mt-auto pt-3 flex flex-wrap gap-4">
                        {row.href && (
                            row.href.startsWith('/') ? (
                                <Link to={row.href} className={DETAIL_LINK}>
                                    Read more <ChevronRight size={14} />
                                </Link>
                            ) : (
                                <a href={row.href} target="_blank" rel="noopener noreferrer" className={DETAIL_LINK}>
                                    Read more <ExternalLink size={13} />
                                </a>
                            )
                        )}
                        {row.fileUrl && (
                            <a
                                href={resolveMediaUrl(row.fileUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={DETAIL_LINK}
                            >
                                Download <Download size={14} />
                            </a>
                        )}
                    </div>
                )}
            </div>
        </article>
    );
}

const DETAIL_LINK =
    'inline-flex items-center gap-1.5 text-[1.25rem] font-bold text-brand-600 '
    + 'hover:text-brand-800 transition-colors';
