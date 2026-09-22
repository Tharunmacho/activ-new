import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Grid3x3, ArrowRight } from 'lucide-react';
import {
    getGallery, getGallerySettings,
    type GalleryItem, type GallerySettings,
} from '@/services/cmsApi';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import { CmsIcon } from '@/components/shared/CmsIcon';
import { SCREEN_CONTAINER } from '@/components/layout/pageContainer';
import { SECTION_HEADING, SECTION_LEDE, EYEBROW } from '@/components/layout/typography';
import { Reveal } from '@/components/shared/Reveal';
import { sectionHidden, sectionFields } from '@/components/shared/cmsSections';
import { CmsExtraFields } from '@/components/shared/CmsExtraFields';
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

    /*
     * THE BAND SAYING WHAT THIS PAGE IS.
     *
     * `/events` is upcoming events only, and it points here for the rest.
     * A visitor who follows that link arrives at a grid of photographs with
     * nothing confirming they are in the right place — so the page says so,
     * in the editor's words, and the card can be removed like any other.
     */
    const past = settings?.pastEvents;
    const showPast = !sectionHidden(settings?.sections, 'gallery.pastEvents')
        && !!(past?.enabled && (past.title || past.subtitle));

    /* A card's rows go with the card: removing it takes them off the page
       too, which is what the collapsed strip in the CMS says it will do. */
    const rowsOf = (key: string) =>
        (sectionHidden(settings?.sections, key) ? [] : sectionFields(settings?.sections, key));

    const ownRows = [
        ...rowsOf('gallery.categories'),
        ...rowsOf('gallery.paging'),
        ...rowsOf('gallery.detail'),
        ...rowsOf('gallery.pastEvents'),
        ...(settings?.extraFields || []),
    ];
    const noteLines = settings?.noteLines || [];
    const hasIntro = !!(settings?.badgeText || settings?.heading || settings?.description);

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
                                    <p className={`${SECTION_LEDE} text-gray-500 max-w-xl`}>
                                        {settings.description}
                                    </p>
                                )}

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
                                            <p
                                                className="absolute top-0 left-0 text-2xl rotate-[-10deg] font-bold text-brand-600"
                                                style={{ fontFamily: "'Caveat', cursive, serif" }}
                                            >
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

                {/* ---- the past-events band ---- */}
                {showPast && (
                    <Reveal>
                        <div className="mb-10 flex flex-col gap-4 rounded-2xl border border-brand-100
                                        bg-white/80 px-6 py-5 shadow-[0_18px_46px_-30px_rgb(28_46_104/0.45)]
                                        sm:flex-row sm:items-center sm:gap-5">
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center
                                             rounded-full bg-brand-50 text-brand-600">
                                <CmsIcon name={past?.icon} size={22} fallback="calendar-days" />
                            </span>

                            <div className="min-w-0">
                                {past?.title && (
                                    <p className="text-[1.375rem] font-extrabold text-brand-800">
                                        {past.title}
                                    </p>
                                )}
                                {past?.subtitle && (
                                    <p className="mt-1 text-[1.125rem] font-medium leading-relaxed text-gray-600">
                                        {past.subtitle}
                                    </p>
                                )}
                            </div>
                        </div>
                    </Reveal>
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
                                <div className="w-full h-48 relative overflow-hidden bg-gray-50 p-1">
                                    <div className="w-full h-full rounded-t-2xl overflow-hidden relative">
                                        <CmsMediaFrame
                                            media={card.media}
                                            width={340}
                                            className="group-hover:scale-105 transition-transform duration-500 transform-gpu"
                                        />

                                        {/* NO CATEGORY CHIP.

                                            It printed a word over the middle of
                                            somebody's photograph — the thing the
                                            card is actually for. The categories
                                            are still how the gallery filters,
                                            which is where they belong. */}
                                    </div>
                                </div>

                                <div className="p-5 flex flex-col flex-grow">
                                    {card.title && (
                                        <h3 className="text-[1.3125rem] font-extrabold text-[#111827] mb-4 leading-snug
                                                       line-clamp-2 group-hover:text-brand-600 transition-colors">
                                            {card.title}
                                        </h3>
                                    )}

                                    {(card.eventDate || card.location) && (
                                        <div className="mt-auto flex items-center justify-between text-gray-500 text-[1.0625rem]
                                                        font-medium border-t border-gray-50 pt-4">
                                            {card.eventDate && (
                                                <div className="flex items-center space-x-1.5">
                                                    <Calendar size={16} className="text-gray-400" />
                                                    <span>{card.eventDate}</span>
                                                </div>
                                            )}
                                            {card.location && (
                                                <div className="flex items-center space-x-1.5">
                                                    <MapPin size={16} className="text-gray-400" />
                                                    <span className="truncate max-w-[5.625rem]">{card.location}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* `mt-auto` on this rather than on the row above
                                        when there are no details, so a card with
                                        neither date nor location still puts the cue
                                        at its foot and the grid stays even. */}
                                    <span className={`${!card.eventDate && !card.location ? 'mt-auto pt-4' : 'mt-3'}
                                                     inline-flex items-center gap-1.5 text-brand-600
                                                     text-[1rem] font-extrabold uppercase tracking-widest
                                                     opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100
                                                     transition-opacity duration-300`}>
                                        View details <ArrowRight size={15} />
                                    </span>
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

                {/* Fields the editor added to this page. Nothing is drawn
                    when the list is empty. */}
                {/* The editor's own rows, per card, then the page's own list. */}
                <CmsExtraFields fields={ownRows} className="mt-16" />
            </div>
        </section>
    );
}
