import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Images, Calendar, MapPin, Grid3x3, ArrowRight } from 'lucide-react';
import {
    getGallery, getGallerySettings,
    type GalleryItem, type GallerySettings,
} from '@/services/cmsApi';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import { CmsIcon } from '@/components/shared/CmsIcon';
import { SCREEN_CONTAINER } from '@/components/layout/pageContainer';
import { SECTION_HEADING, SECTION_LEDE, EYEBROW, BAND_MEASURE } from '@/components/layout/typography';
import { Reveal } from '@/components/shared/Reveal';
import { sectionHidden, sectionFields } from '@/components/shared/cmsSections';
import { CmsExtraFields } from '@/components/shared/CmsExtraFields';
import { SectionFields } from '@/components/shared/SectionFields';

/** The gallery band's own type, for the rows added to its cards. */
const GRID_PROSE = 'text-[1.125rem] font-medium leading-relaxed text-gray-500';
import { Tilt3D } from '@/components/shared/Tilt3D';

/**
 * The gallery page.
 *
 * Images, their captions, categories, dates and locations all come from the
 * CMS, as does the copy above them and the filter chips. Nothing is hardcoded:
 * an empty gallery renders no grid rather than stock photography an admin
 * cannot delete.
 *
 * The collage at the top draws from images flagged `featured`. Falling back to
 * "the first three" would mean an admin could never choose which three appear
 * there without reordering the whole grid.
 */
export function GallerySection() {
    const [images, setImages] = useState<GalleryItem[] | null>(null);
    const [settings, setSettings] = useState<GallerySettings | null>(null);
    const [activeFilter, setActiveFilter] = useState('All');
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        let cancelled = false;

        Promise.all([getGallery(), getGallerySettings()])
            .then(([items, config]) => {
                if (cancelled) return;
                setImages(items);
                setSettings(config);
            })
            .catch(() => {
                if (cancelled) return;
                setImages([]);
                setSettings(null);
            });

        return () => { cancelled = true; };
    }, []);

    /*
     * Memoised, because two `useMemo`s below depend on it.
     *
     * `images || []` builds a NEW array on every render whenever `images`
     * is null, so both of those recomputed every time and the memo bought
     * nothing. Harmless here — the lists are short — but it is the same
     * shape as a dependency that is wrong rather than merely unstable, and
     * leaving it warning makes the rule unreadable for the one that matters.
     */
    const all = useMemo(() => images || [], [images]);

    /** `featured` first; without any, the collage is simply not drawn. */
    const collage = useMemo(() => all.filter(i => i.featured).slice(0, 3), [all]);

    const filtered = useMemo(
        () => (activeFilter === 'All' ? all : all.filter(i => i.category === activeFilter)),
        [all, activeFilter],
    );

    /* A removed Paging card means no paging: every image at once, which is
       what `pageSize: 0` has always meant here. */
    const pageSize = sectionHidden(settings?.sections, 'gallery.paging')
        ? 0
        : (settings?.pageSize ?? 8);
    const visible = expanded || pageSize <= 0 ? filtered : filtered.slice(0, pageSize);
    const hasMore = pageSize > 0 && filtered.length > pageSize;

    // Still loading — the skeletons below are for that; `null` means the request
    // has not resolved and the page has nothing to say yet.
    const loading = images === null;

    const categories = sectionHidden(settings?.sections, 'gallery.categories')
        ? []
        : (settings?.categories || []);


    /* A card's rows go with the card: removing it takes them off the page
       too, which is what the collapsed strip in the CMS says it will do. */
    const rowsOf = (key: string) =>
        (sectionHidden(settings?.sections, key) ? [] : sectionFields(settings?.sections, key));

    /*
     * Each card's rows are drawn WITH that card now — see `SectionFields`.
     * They were pooled here and printed once under the grid, so a field added
     * to "Categories" appeared beneath everything instead of with the chips.
     * What is left is the list attached to the PAGE.
     */
    const ownRows = settings?.extraFields || [];
    const noteLines = settings?.noteLines || [];
    /*
     * THE THREE INTRO CARDS DRAW THEIR OWN ROWS, and did not.
     *
     * `gallery.badge`, `gallery.heading` and `gallery.note` each offered
     * "Your own fields in this section" in the CMS and nothing on this page
     * read them. An editor typed a field into the heading card, saved it, was
     * told it had saved — and it had, the server has it — and then found
     * nothing on the gallery. Offered, stored, served, and on no page.
     *
     * They are counted into `hasIntro` as well, for the same reason the
     * contact section counts its rows: a card whose heading was never filled
     * in still has content once an editor has added a row to it, and dropping
     * the column would take the rows down with it.
     */
    const badgeRows = rowsOf('gallery.badge');
    const headingRows = rowsOf('gallery.heading');
    const noteRows = rowsOf('gallery.note');

    const hasIntro = !!(settings?.badgeText || settings?.heading || settings?.description)
        || badgeRows.length > 0 || headingRows.length > 0 || noteRows.length > 0;

    return (
        <section className="w-full py-16 md:py-24 dot-band relative overflow-hidden font-sans">

            {/* Decorative only — not authored. */}
            <div className="absolute top-0 right-0 w-1/3 h-full -z-10 opacity-30 pointer-events-none">
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id="dots-gallery" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                            <circle className="fill-brand-300" cx="2" cy="2" r="1.5" />
                        </pattern>
                    </defs>
                    <rect x="0" y="0" width="100%" height="100%" fill="url(#dots-gallery)" />
                </svg>
            </div>
            {/* Added transform-gpu to prevent heavy scrolling lag from blur-3xl */}
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-50/50 rounded-full blur-3xl -z-10 -translate-x-1/3 translate-y-1/3 transform-gpu will-change-transform pointer-events-none" />

            <div className={`${SCREEN_CONTAINER} relative z-10`}>

                {/* ---- intro and collage ---- */}
                {(hasIntro || collage.length > 0) && (
                    <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 items-center mb-24">

                        {hasIntro && (
                            <div className={`w-full ${collage.length ? 'lg:w-5/12' : ''} relative`}>
                                {settings?.badgeText && (
                                    <div className="inline-flex items-center space-x-2 bg-brand-50 text-brand-600 px-4 py-1.5
                                                    rounded-full mb-6 border border-brand-100 shadow-sm">
                                        <CmsIcon name={settings.badgeIcon} size={14} className="stroke-[3]" fallback="image" />
                                        <span className={EYEBROW}>{settings.badgeText}</span>
                                    </div>
                                )}

                                {(settings?.heading || settings?.headingHighlight) && (
                                    <h2 className={`${SECTION_HEADING} text-[#111827] mb-6`}>
                                        {settings.heading}
                                        {settings.headingHighlight && (
                                            <> <span className="text-brand-600">{settings.headingHighlight}</span></>
                                        )}
                                    </h2>
                                )}

                                {settings?.description && (
                                    <p className={`${SECTION_LEDE} text-gray-500 ${BAND_MEASURE}`}>
                                        {settings.description}
                                    </p>
                                )}

                                {/* Each card's rows, with that card — the badge's
                                    under the badge, the heading's under the lede.
                                    `proseClass` because the type on this column
                                    lives on the siblings above, not on an
                                    ancestor, so there is nothing to inherit. */}
                                {(['gallery.badge', 'gallery.heading', 'gallery.note'] as const).map(key => (
                                    <SectionFields
                                        key={key}
                                        sections={settings?.sections}
                                        sectionKey={key}
                                        proseClass={`${SECTION_LEDE} text-gray-500`}
                                        className={`${BAND_MEASURE} mt-6`}
                                    />
                                ))}

                                {noteLines.length > 0 && (
                                    /*
                                      Anchored to `left-full` — the outside edge of
                                      the copy column — rather than pulled back in
                                      with a negative `right`. At `-right-28` a 256px
                                      note started 144px INSIDE the column, so the
                                      handwriting and its arrow were drawn straight
                                      over the paragraph they were meant to point
                                      away from. It now sits in the gutter beside the
                                      collage, which is where it points.

                                      `z-20` because the collage is a later sibling
                                      and would otherwise paint over it; `xl` because
                                      below that width there is no gutter to sit in.
                                    */
                                    <div className="hidden xl:block absolute left-full ml-2 top-[13.5rem]
                                                    w-56 h-56 z-20 text-brand-600 pointer-events-none">
                                        <div className="relative w-full h-full">
                                            {/*
                                              * No `fontFamily`. It named Caveat, which this
                                              * site never loads — `index.html` requests Poppins
                                              * and Inter and nothing else — so the declaration
                                              * fell straight through to `cursive` and painted
                                              * this note in Comic Sans on Windows. One family,
                                              * Poppins, so the rotation and the weight carry
                                              * the handwritten feel instead.
                                              */}
                                            <p className="absolute top-0 left-0 text-[1.5625rem] rotate-[-10deg] font-bold text-brand-600">
                                                {noteLines.map((line, i) => (
                                                    <span key={i} className="block">{line}</span>
                                                ))}
                                            </p>
                                            <svg
                                                className="absolute top-16 left-12 w-32 h-32 stroke-brand-600"
                                                viewBox="0 0 100 100" fill="none"
                                                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                            >
                                                <path d="M10,20 Q40,60 80,40" />
                                                <path d="M70,30 L80,40 L70,50" />
                                            </svg>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {collage.length > 0 && (
                            <div className={`w-full ${hasIntro ? 'lg:w-7/12' : ''} mt-12 lg:mt-0 relative`}>
                                {/* Added isolate to prevent z-index issues with sticky header during scroll */}
                                <div className="relative h-[28.125rem] md:h-[31.25rem] w-full max-w-3xl mx-auto isolate">
                                    {/* Fixed positions rather than a loop: the three frames
                                        are deliberately different sizes and angles. */}
                                    {/* Each frame links to its own item, like every other
                                        picture on the site now — a visitor who clicks
                                        the biggest photograph on the page expects it to
                                        do what the small ones below it do. */}
                                    {collage[0] && (
                                        <div className="absolute top-4 left-0 w-3/5 h-4/5 z-10 -rotate-2 group transform-gpu">
                                            <Link
                                                to={`/gallery/${collage[0]._id}`}
                                                aria-label={collage[0].title ? `View details of ${collage[0].title}` : 'View gallery item'}
                                                className="block w-full h-full rounded-3xl overflow-hidden border-[6px]
                                                           border-white shadow-xl bg-gray-100 transform-gpu"
                                            >
                                                <CmsMediaFrame
                                                    media={collage[0].media}
                                                    priority
                                                    width={520}
                                                    className="group-hover:scale-105 transition-transform duration-700 transform-gpu"
                                                />
                                            </Link>
                                        </div>
                                    )}
                                    {collage[1] && (
                                        <div className="absolute -top-4 right-4 w-[42%] h-[45%] z-20 rotate-2 group transform-gpu">
                                            <Link
                                                to={`/gallery/${collage[1]._id}`}
                                                aria-label={collage[1].title ? `View details of ${collage[1].title}` : 'View gallery item'}
                                                className="block w-full h-full rounded-3xl overflow-hidden border-[6px]
                                                           border-white shadow-xl bg-gray-100 transform-gpu"
                                            >
                                                <CmsMediaFrame
                                                    media={collage[1].media}
                                                    width={380}
                                                    className="group-hover:scale-105 transition-transform duration-700 transform-gpu"
                                                />
                                            </Link>
                                        </div>
                                    )}
                                    {collage[2] && (
                                        <div className="absolute bottom-4 right-0 w-[45%] h-[45%] z-30 -rotate-1 group transform-gpu">
                                            <Link
                                                to={`/gallery/${collage[2]._id}`}
                                                aria-label={collage[2].title ? `View details of ${collage[2].title}` : 'View gallery item'}
                                                className="block w-full h-full rounded-3xl overflow-hidden border-[6px]
                                                           border-white shadow-xl bg-gray-100 transform-gpu"
                                            >
                                                <CmsMediaFrame
                                                    media={collage[2].media}
                                                    width={380}
                                                    className="group-hover:scale-105 transition-transform duration-700 transform-gpu"
                                                />
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ---- filter chips ---- */}
                {categories.length > 0 && (
                    <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
                        {[{ label: 'All', icon: '' }, ...categories].map((filter, index) => (
                            <button
                                key={index}
                                onClick={() => { setActiveFilter(filter.label); setExpanded(false); }}
                                className={`flex items-center space-x-2.5 px-7 py-3 rounded-full text-[1.25rem] font-semibold
                                            transition-all duration-200 border ${
                                    activeFilter === filter.label
                                        ? 'bg-brand-800 border-brand-800 text-white shadow-md'
                                        : 'bg-white border-gray-200 text-brand-800 hover:border-brand-800 hover:bg-brand-50'
                                }`}
                            >
                                {filter.icon && (
                                    <CmsIcon
                                        name={filter.icon}
                                        size={16}
                                        className={activeFilter === filter.label ? 'text-white' : 'text-brand-600'}
                                        fallback="image"
                                    />
                                )}
                                <span>{filter.label}</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* The chips' own rows, with the chips — see `SectionFields`.

                    `align="center"` because the rail above them is centred, and
                    a row inherits its section's type but not its alignment:
                    that is set on an ancestor and these rows are their own
                    block. Left as it was, a field added to this card printed
                    hard against the left margin under eight centred pills. */}
                <SectionFields
                    proseClass={GRID_PROSE}
                    sections={settings?.sections}
                    sectionKey="gallery.categories"
                    className="mb-12"
                    align="center"
                />

                {/* ---- grid ---- */}
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="rounded-2xl h-72 bg-gray-100 animate-pulse border border-gray-200" />
                        ))}
                    </div>
                ) : visible.length === 0 ? (
                    <p className="text-center text-gray-500 py-12">
                        {activeFilter === 'All'
                            ? (settings?.emptyText || 'No photographs have been published yet.')
                            : ((settings?.emptyFilterText || 'Nothing in {category} yet.')
                                .replace('{category}', activeFilter))}
                    </p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                        {visible.map((card, i) => (
                            /* Staggered across the row, capped so the last tile of a
                               long gallery never looks like it failed to load. */
                            <Reveal key={card._id} delay={Math.min(i % 4, 3) * 80} className="h-full">
                                <Tilt3D className="h-full" intensity={9} lift={1.03} glare={false} perspective={800}>
                                    {/*
                                      The whole card is the link to this item's
                                      own page. A "details" button in the corner
                                      would be the smallest target on a tile
                                      whose picture is what everyone taps.
                                    */}
                                    <Link
                                        to={`/gallery/${card._id}`}
                                        aria-label={card.title ? `View details of ${card.title}` : 'View gallery item'}
                                        className="bg-white rounded-[1.25rem] overflow-hidden h-full
                                                   border border-brand-100/70
                                                   shadow-[0_10px_36px_-14px_rgb(28_46_104/0.18)]
                                                   transition-shadow duration-500
                                                   hover:shadow-[0_26px_56px_-18px_rgb(28_46_104/0.38)]
                                                   focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600
                                                   focus-visible:ring-offset-2
                                                   flex flex-col group"
                                    >
                                {/*
                                  * ONE SHAPE FOR EVERY COVER.
                                  *
                                  * `h-48` is a fixed 192px whatever the column is
                                  * worth, so the same card was a different shape on
                                  * a phone, a laptop and a wide display — and at
                                  * four across it cropped a landscape photograph to
                                  * a letterbox. `aspect-[4/3]` is the shape the
                                  * pictures are, and it scales with the column, so
                                  * a row of four covers reads as a row rather than
                                  * as four unrelated crops.
                                  */}
                                <div className="w-full aspect-[4/3] relative overflow-hidden bg-gray-50 p-1">
                                    <div className="w-full h-full rounded-t-2xl overflow-hidden relative">
                                        <CmsMediaFrame
                                            media={card.media}
                                            width={340}
                                            className="group-hover:scale-105 transition-transform duration-500 transform-gpu"
                                        />

                                        {/* How many photographs are inside the album —
                                            the cover plus its photos. Only when there
                                            is more than the cover to open. */}
                                        {/*
                                          * THE COUNT IS THE REASON TO PRESS THE CARD.
                                          *
                                          * The cover is the one picture chosen to
                                          * draw somebody in; what is behind it is a
                                          * whole afternoon. Without this the card
                                          * offers no reason to believe there is
                                          * anything more than the picture already on
                                          * screen, and the album nobody opens may as
                                          * well not have been posted.
                                          *
                                          * Only when there IS more than the cover —
                                          * "1 photo" on a single-picture post is a
                                          * promise of nothing.
                                          */}
                                        {(card.photos || []).filter((ph) => ph && ph.url).length > 0 && (
                                            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-full
                                                             bg-black/65 px-3 py-1 text-[0.9375rem] font-bold text-white
                                                             shadow-sm backdrop-blur-sm">
                                                <Images size={14} /> {(card.photos || []).filter((ph) => ph && ph.url).length + 1} photos
                                            </span>
                                        )}

                                        {/* NO CATEGORY CHIP.

                                            It printed a word over the middle of
                                            somebody's photograph — the thing the
                                            card is actually for. The categories
                                            are still how the gallery filters,
                                            which is where they belong. */}
                                    </div>
                                </div>

                                <div className="p-5 flex flex-col flex-grow">
                                    {/*
                                      * A HEADING ON EVERY CARD, even an untitled one.
                                      *
                                      * The heading used to be dropped entirely when
                                      * the title was blank, so that card's date row
                                      * rode up to meet the picture and sat at a
                                      * different height from the three beside it.
                                      * "Untitled" is the same answer the scheme page
                                      * and the events list already give, for the same
                                      * reason: a missing name is information, and a
                                      * hole where a name goes reads as a broken card.
                                      */}
                                    <h3 className="text-[1.3125rem] font-extrabold text-[#111827] leading-snug
                                                   line-clamp-2 group-hover:text-brand-600 transition-colors">
                                        {card.title || 'Untitled album'}
                                    </h3>

                                    {/*
                                      * ==================================================
                                      * ONE FOOT, ALWAYS DRAWN
                                      * ==================================================
                                      *
                                      * This was two blocks, each conditional, and
                                      * between them they left the bottom half of a card
                                      * empty whenever an item had no date and no place
                                      * — which is most of them. "State council meeting,
                                      * Chennai" was a picture, a line of text and four
                                      * centimetres of nothing, beside three cards that
                                      * were full.
                                      *
                                      * And "View details" was `opacity-0` until the
                                      * pointer was over the card, so in any screenshot
                                      * — and to anybody on a touch screen, which has
                                      * no hover — exactly one card in the grid had a
                                      * call to action and the rest looked inert.
                                      *
                                      * One row now, pinned to the foot by `mt-auto`,
                                      * always present: what is known about the event on
                                      * the left, the way in on the right. A card with
                                      * nothing known still has a foot, so the grid lines
                                      * up whatever the editor filled in.
                                      */}
                                    <div className="mt-auto flex items-end justify-between gap-3 border-t border-gray-100 pt-4">
                                        <div className="min-w-0 flex flex-col gap-1.5 text-gray-500 text-[1.0625rem] font-medium">
                                            {card.eventDate && (
                                                <span className="flex items-center gap-1.5">
                                                    <Calendar size={15} className="shrink-0 text-gray-400" />
                                                    <span className="truncate">{card.eventDate}</span>
                                                </span>
                                            )}
                                            {card.location && (
                                                <span className="flex items-center gap-1.5">
                                                    <MapPin size={15} className="shrink-0 text-gray-400" />
                                                    <span className="truncate">{card.location}</span>
                                                </span>
                                            )}
                                        </div>

                                        <span className="shrink-0 inline-flex items-center gap-1.5 text-brand-600
                                                         text-[1rem] font-extrabold uppercase tracking-widest
                                                         opacity-70 transition-all duration-300
                                                         group-hover:opacity-100 group-hover:gap-2.5
                                                         group-focus-visible:opacity-100">
                                            View <ArrowRight size={15} />
                                        </span>
                                    </div>
                                        </div>
                                    </Link>
                                </Tilt3D>
                            </Reveal>
                        ))}
                    </div>
                )}

                {/* Expands in place rather than navigating: there is no second page. */}
                {hasMore && !expanded && settings?.viewMoreLabel && (
                    <div className="flex justify-center mt-12">
                        <button
                            onClick={() => setExpanded(true)}
                            className="flex items-center space-x-2 bg-white border-2 border-brand-100 hover:border-brand-200
                                       text-brand-700 hover:bg-brand-50 px-8 py-3 rounded-full font-bold transition-all shadow-sm"
                        >
                            <Grid3x3 size={16} />
                            <span>{settings.viewMoreLabel}</span>
                        </button>
                    </div>
                )}

                {/* The paging card's own rows, then the PAGE's. Each card's
                    rows used to be pooled into one list printed here, so a field
                    added to the categories landed under the grid.

                    `gallery.detail` is NOT drawn here: that card is the
                    furniture of the photograph's own page, and its rows belong
                    on that page rather than on the grid that links to it. */}
                {/* Both of these sit under the grid, where the paging control
                    and the past-events band are centred, so their rows are too. */}
                <SectionFields
                    proseClass={GRID_PROSE}
                    sections={settings?.sections}
                    sectionKey="gallery.paging"
                    align="center"
                />
                {/* Same as the paging card: offered, never drawn. */}
                <SectionFields
                    proseClass={GRID_PROSE}
                    sections={settings?.sections}
                    sectionKey="gallery.pastEvents"
                    align="center"
                />
                <div className={GRID_PROSE}>
                    <CmsExtraFields fields={ownRows} className="mt-16" />
                </div>
            </div>
        </section>
    );
}
