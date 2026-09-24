import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Images, MapPin, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { CmsIcon } from '@/components/shared/CmsIcon';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import { resolveMediaUrl, sizedMediaUrl } from '@/config/api.config';
import {
    listRegionGallery, type RegionFeedItem, type GalleryPhoto,
} from '@/services/cmsRegionsApi';
import { CARD, PANEL_HEADING } from './RegionUI';

/**
 * The blocks the state and region pages are assembled from.
 *
 * =========================================================================
 * THE DESIGN IS FIXED; THE CONTENT IS NOT
 * =========================================================================
 *
 * The association supplied a design — a hero band, a row of event cards, a
 * panel of key figures, a projects row, a publications row, a consulting grid
 * and a closing vision band. What makes it worth building rather than
 * hand-cutting for one state is that every one of these draws whatever the CMS
 * holds, for any of the thirty-six states, and disappears entirely when that
 * list is empty.
 *
 * NOTHING HERE INVENTS ANYTHING. No "coming soon", no placeholder tile, no
 * fabricated date. A block with no content is not drawn, and a page with three
 * empty sections is three sections shorter rather than three boxes of apology.
 */

/* ------------------------------------------------------------------- hero */

export interface HeroContent {
    eyebrow: string;
    headline: string;
    tagline: string;
    blurb: string;
    backgroundUrl: string;
    sideImageUrl: string;
    features: { icon: string; label: string }[];
}

/**
 * The band across the top.
 *
 * A photograph is darkened behind the words rather than sitting beside them,
 * because the words have to be legible over WHATEVER an editor uploads — and
 * the one thing you cannot know about an editor's photograph is how bright the
 * top-left corner is. The gradient is doing accessibility work, not decoration.
 *
 * Not drawn without a headline: a blue rectangle with nothing in it is worse
 * than the plain page heading it would replace.
 */
export function StateHero({ hero, fallbackTitle }: {
    hero: HeroContent;
    fallbackTitle: string;
}) {
    const headline = hero.headline || fallbackTitle;
    if (!headline) return null;

    return (
        <section className="relative overflow-hidden rounded-[1.75rem] border border-brand-900/10
                            shadow-[0_20px_60px_-30px_rgba(28,46,104,0.6)]">
            {/* The photograph, and then the wash that makes text possible on it. */}
            <div className="absolute inset-0 bg-brand-900">
                {hero.backgroundUrl && (
                    <img
                        src={sizedMediaUrl(hero.backgroundUrl, 900)}
                        alt=""
                        aria-hidden="true"
                        className="h-full w-full object-cover opacity-55"
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-brand-900 via-brand-900/85
                                to-brand-900/40" />
            </div>

            <div className="relative z-10 px-6 py-10 sm:px-10 sm:py-14 lg:px-14 lg:py-16">
                <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-center">
                    <div className="max-w-2xl">
                        {hero.eyebrow && (
                            <p className="text-[1rem] sm:text-[1.0625rem] font-bold uppercase
                                          tracking-[0.2em] text-white/70 mb-4">
                                {hero.eyebrow}
                            </p>
                        )}

                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight
                                       text-white leading-[1.05]">
                            {headline}
                        </h1>

                        {hero.tagline && (
                            <p className="mt-4 text-[1.375rem] sm:text-[1.5625rem] font-bold text-white/90 leading-snug">
                                {hero.tagline}
                            </p>
                        )}

                        {/*
                          * THE BAND IS AN INTRODUCTION, NOT THE ARTICLE.
                          *
                          * Tamil Nadu’s ran to six lines of where the state is
                          * bordered and by what, which pushed the leadership — the
                          * thing the page is FOR — entirely below the fold. A
                          * reader opening a state page met a geography lesson and
                          * had to scroll to find a single face.
                          *
                          * Clamped rather than truncated: the full text is still
                          * in the DOM, still selectable, still read by a screen
                          * reader and still searchable — only the height is
                          * capped. Cutting the string would lose it, and an
                          * editor’s writing is not the page’s to discard.
                          *
                          * Three lines on a phone and four on a desktop: enough
                          * for what the place is, not enough to be an article.
                          * The same clamp on the national, region and state
                          * bands, because they are the same band.
                          */}
                        {hero.blurb && (
                            <p className="mt-4 text-[1.0625rem] sm:text-[1.25rem] font-semibold leading-relaxed
                                          text-white/75 whitespace-pre-line line-clamp-3 sm:line-clamp-4">
                                {hero.blurb}
                            </p>
                        )}

                        {hero.features.length > 0 && (
                            <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-5">
                                {hero.features.map((feature, i) => (
                                    <li key={i} className="flex items-center gap-2.5">
                                        <span className="flex h-10 w-10 items-center justify-center rounded-xl
                                                         bg-white/10 text-white ring-1 ring-white/20">
                                            <CmsIcon name={feature.icon} size={18} />
                                        </span>
                                        <span className="text-[1.0625rem] font-bold text-white/90">
                                            {feature.label}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {hero.sideImageUrl && (
                        <div className="hidden lg:block">
                            <img
                                src={sizedMediaUrl(hero.sideImageUrl, 900)}
                                alt=""
                                aria-hidden="true"
                                className="mx-auto max-h-64 w-auto object-contain drop-shadow-2xl"
                            loading="lazy"
                            decoding="async"
                        />
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

/* --------------------------------------------------------- key achievements */

/**
 * The figures, as a column beside the events rather than a band across the page.
 *
 * A number with an icon and a caption. `title` carries the figure because half
 * of these are not numbers — "First council to publish a skills charter" is an
 * achievement too, and it has to be able to live in the same list.
 */
export function KeyAchievements({ items, title = 'Key Achievements' }: {
    items: RegionFeedItem[];
    title?: string;
}) {
    const rows = (items || []).filter((row) => row.title || row.summary);
    if (!rows.length) return null;

    return (
        <div className={`${CARD} p-5 sm:p-6`}>
            <h2 className="text-[1.25rem] sm:text-[1.0625rem] font-extrabold text-brand-800 mb-5">
                {title}
            </h2>
            <ul className="space-y-5">
                {rows.slice(0, 6).map((row, i) => (
                    <li key={row.id || i} className="flex items-start gap-3.5">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl
                                         bg-brand-50 text-brand-600">
                            <CmsIcon name={row.icon} size={19} fallback="award" />
                        </span>
                        <div className="min-w-0">
                            <p className="text-[1.5625rem] font-black tracking-tight text-brand-800 leading-none">
                                {row.title}
                            </p>
                            {row.summary && (
                                <p className="mt-1 text-[1.25rem] font-semibold text-gray-500 leading-snug">
                                    {row.summary}
                                </p>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/* ---------------------------------------------------------------- card row */

/**
 * A row of picture cards — Events, Projects, Publications.
 *
 * ONE COMPONENT, because the three are the same object drawn the same way.
 * They differ in their heading and their aspect ratio, which is two props.
 *
 * NO DATES. The association asked for these to read as what the council does
 * rather than as a diary: a date on a card invites the reader to work out
 * whether it has already happened, and an undated card invites them to read the
 * title. `View All` opens the full list, where the dates live.
 */
export function CardRow({ title, items, viewAllHref, viewAllLabel, ratio = 'landscape', limit = 4 }: {
    title: string;
    items: RegionFeedItem[];
    viewAllHref?: string;
    viewAllLabel?: string;
    /** `portrait` for publication covers, `landscape` for everything else. */
    ratio?: 'landscape' | 'portrait';
    limit?: number;
}) {
    const rows = (items || []).filter((row) => row.title);
    if (!rows.length) return null;

    return (
        <section className={`${CARD} p-5 sm:p-6`}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <h2 className="text-[1.25rem] sm:text-[1.0625rem] font-extrabold text-brand-800">{title}</h2>
                {viewAllHref && (
                    <Link
                        to={viewAllHref}
                        className="inline-flex items-center gap-1.5 text-[1.0625rem] font-bold
                                   text-brand-600 hover:text-brand-800 transition-colors"
                    >
                        {viewAllLabel || `View all ${title.toLowerCase()}`}
                        <ArrowRight size={14} />
                    </Link>
                )}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {rows.slice(0, limit).map((row, i) => {
                    const body = (
                        <>
                            <div className={`w-full overflow-hidden rounded-xl bg-gray-100 ${
                                ratio === 'portrait' ? 'aspect-[3/4]' : 'aspect-[4/3]'
                            }`}>
                                {row.imageUrl ? (
                                    <CmsMediaFrame
                                        media={{
                                            url: row.imageUrl, type: 'image', alt: row.title,
                                            fit: 'cover', position: 'center',
                                        }}
                                        width={400}
                                        className="group-hover:scale-105 transition-transform duration-700 transform-gpu"
                                    />
                                ) : (
                                    /* An entry with no picture yet still belongs in
                                       the row — the tile carries a monogram rather
                                       than dropping the item or showing a torn
                                       image frame. */
                                    <div className="flex h-full w-full items-center justify-center
                                                    bg-brand-50 text-brand-200">
                                        <CmsIcon name={row.icon} size={26} fallback="image" />
                                    </div>
                                )}
                            </div>

                            <p className="mt-3 text-[1.25rem] font-extrabold text-brand-900 leading-snug
                                          line-clamp-2 group-hover:text-brand-600 transition-colors">
                                {row.title}
                            </p>
                            {row.location && (
                                <p className="mt-1 flex items-start gap-1 text-[1.0625rem] font-semibold
                                              text-gray-500">
                                    <MapPin size={11} className="mt-0.5 shrink-0" />
                                    <span className="line-clamp-1">{row.location}</span>
                                </p>
                            )}
                            {row.category && (
                                <span className="mt-2 inline-block rounded-full bg-brand-50 px-2.5 py-1
                                                 text-[1rem] font-bold text-brand-700">
                                    {row.category}
                                </span>
                            )}
                        </>
                    );

                    return row.href ? (
                        <Link key={row.id || i} to={row.href} className="group block">{body}</Link>
                    ) : viewAllHref ? (
                        /* No link of its own, but the list it lives in has one —
                           so the tile opens the list rather than being dead. */
                        <Link key={row.id || i} to={viewAllHref} className="group block">{body}</Link>
                    ) : (
                        <div key={row.id || i} className="group block">{body}</div>
                    );
                })}
            </div>
        </section>
    );
}

/* ------------------------------------------------------ consulting services */

export function ConsultingGrid({ items, intro, cta, title = 'Consulting Services' }: {
    items: RegionFeedItem[];
    intro?: string;
    cta?: { label: string; href: string };
    title?: string;
}) {
    const rows = (items || []).filter((row) => row.title);
    if (!rows.length) return null;

    return (
        <section className={`${CARD} p-5 sm:p-6`}>
            <h2 className="text-[1.25rem] sm:text-[1.0625rem] font-extrabold text-brand-800">{title}</h2>
            {intro && (
                <p className="mt-1.5 text-[1.25rem] font-semibold text-gray-500">{intro}</p>
            )}

            <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
                {rows.slice(0, 8).map((row, i) => (
                    <div
                        key={row.id || i}
                        className="rounded-xl border border-brand-100 bg-[#fafbfc] p-4 text-center"
                    >
                        <span className="mx-auto mb-2.5 flex h-11 w-11 items-center justify-center
                                         rounded-xl bg-white text-brand-600 border border-brand-100">
                            <CmsIcon name={row.icon} size={19} fallback="briefcase" />
                        </span>
                        <p className="text-[1.0625rem] font-bold text-brand-800 leading-snug">
                            {row.title}
                        </p>
                    </div>
                ))}
            </div>

            {cta?.label && cta.href && (
                <Link
                    to={cta.href}
                    className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-800 px-6 py-3
                               text-[1.0625rem] font-bold uppercase tracking-[0.1em] text-white
                               transition-colors hover:bg-brand-700"
                >
                    {cta.label} <ArrowRight size={14} />
                </Link>
            )}
        </section>
    );
}

/* ------------------------------------------------------------------ vision */

export function VisionBand({ vision }: {
    vision: { title: string; text: string; pillars: { icon: string; label: string }[] };
}) {
    if (!vision?.title && !vision?.text) return null;

    return (
        <section className="rounded-[1.5rem] bg-gradient-to-r from-brand-900 to-brand-800
                            px-6 py-8 sm:px-10 sm:py-10">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-center">
                <div>
                    {vision.title && (
                        <h2 className="text-[1.375rem] sm:text-[1.75rem] font-extrabold text-white">
                            {vision.title}
                        </h2>
                    )}
                    {vision.text && (
                        <p className="mt-2.5 text-[1.0625rem] font-semibold leading-relaxed text-white/75
                                      whitespace-pre-line">
                            {vision.text}
                        </p>
                    )}
                </div>

                {vision.pillars.length > 0 && (
                    <ul className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {vision.pillars.map((pillar, i) => (
                            <li key={i} className="text-center">
                                <span className="mx-auto mb-2 flex h-11 w-11 items-center justify-center
                                                 rounded-xl bg-white/10 text-white ring-1 ring-white/20">
                                    <CmsIcon name={pillar.icon} size={18} />
                                </span>
                                <span className="block text-[1.0625rem] font-bold text-white/85 leading-snug">
                                    {pillar.label}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}

/* ---------------------------------------------------------------- gallery */

/**
 * The photographs, moving.
 *
 * =========================================================================
 * A MARQUEE, NOT A TIMER
 * =========================================================================
 *
 * The association asked for the gallery to move "every 0.1 seconds". Taken
 * literally — a new photograph ten times a second — that is a strobe: nothing
 * is legible and a reader cannot click anything. What it describes is
 * CONTINUOUS motion rather than a slideshow that jumps.
 *
 * So it scrolls smoothly and never stops, which is the same thing to look at
 * and is readable. It pauses on hover and on keyboard focus so a photograph can
 * actually be clicked, and it does not move at all for a reader who has asked
 * their system for reduced motion — a strip that cannot be stopped is a
 * genuine accessibility failure, not a style choice.
 *
 * The track is rendered TWICE and translated by exactly half its width, which
 * is what makes the loop seamless: at 100% the second copy sits exactly where
 * the first began, so the reset is invisible.
 */
export function GalleryMarquee({ state, region, href, title = 'Photo Gallery' }: {
    state?: string;
    region?: string;
    href: string;
    title?: string;
}) {
    const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
    const [lightbox, setLightbox] = useState<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        listRegionGallery({ state, region, limit: 18 })
            .then((result) => { if (!cancelled) setPhotos(result.items || []); })
            .catch(() => { /* the strip is simply not drawn */ });
        return () => { cancelled = true; };
    }, [state, region]);

    if (!photos.length) return null;

    /* Duplicated for the seamless loop — see the note above. */
    const track = [...photos, ...photos];

    return (
        <section className={`${CARD} p-5 sm:p-6 overflow-hidden`}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <h2 className="text-[1.25rem] sm:text-[1.0625rem] font-extrabold text-brand-800">{title}</h2>
                <Link
                    to={href}
                    className="inline-flex items-center gap-1.5 text-[1.0625rem] font-bold
                               text-brand-600 hover:text-brand-800 transition-colors"
                >
                    <Images size={14} /> View all photographs
                </Link>
            </div>

            <div className="group relative -mx-5 sm:-mx-6 overflow-hidden">
                <div
                    className="flex w-max gap-4 px-5 sm:px-6 animate-region-marquee
                               group-hover:[animation-play-state:paused]
                               focus-within:[animation-play-state:paused]
                               motion-reduce:animate-none motion-reduce:overflow-x-auto"
                >
                    {track.map((photo, i) => (
                        <button
                            key={`${photo.id}-${i}`}
                            type="button"
                            onClick={() => setLightbox(i % photos.length)}
                            className="w-52 sm:w-60 shrink-0 text-left rounded-xl overflow-hidden
                                       border border-gray-200 bg-white transition-shadow
                                       hover:shadow-[0_18px_40px_-20px_rgba(28,46,104,0.5)]
                                       focus:outline-none focus:ring-2 focus:ring-brand-600"
                            /* The clone is decorative — a screen reader hearing
                               eighteen photographs announced twice would have no
                               way to tell it had already heard them. */
                            aria-hidden={i >= photos.length}
                            tabIndex={i >= photos.length ? -1 : 0}
                        >
                            <div className="w-full aspect-[4/3] overflow-hidden bg-gray-50">
                                {/*
                                  * EAGER, in a strip that moves.
                                  *
                                  * A lazy image is fetched only once layout
                                  * decides it is near the viewport — and every
                                  * tile in this track starts far off to the
                                  * right, so by the time the animation carries
                                  * one into view it has never been asked for and
                                  * the reader watches an empty box slide past.
                                  * Eighteen thumbnails is a cost worth paying to
                                  * avoid that.
                                  */}
                                <CmsMediaFrame media={photo.media} width={320} priority />
                            </div>
                            {photo.title && (
                                <p className="px-3 py-2.5 text-[1.0625rem] font-bold text-brand-900
                                              line-clamp-1">
                                    {photo.title}
                                </p>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {lightbox !== null && (
                <Lightbox
                    photos={photos}
                    index={lightbox}
                    onIndex={setLightbox}
                    onClose={() => setLightbox(null)}
                />
            )}
        </section>
    );
}

/**
 * One photograph, large, with the rest reachable from it.
 *
 * "When I click, I should see all the images" — so the arrows and the left and
 * right keys move through the whole set without closing and reopening.
 */
function Lightbox({ photos, index, onIndex, onClose }: {
    photos: GalleryPhoto[];
    index: number;
    onIndex: (i: number) => void;
    onClose: () => void;
}) {
    const holder = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') onIndex((index + 1) % photos.length);
            if (e.key === 'ArrowLeft') onIndex((index - 1 + photos.length) % photos.length);
        };
        document.addEventListener('keydown', onKey);
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        holder.current?.focus();
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = previous;
        };
    }, [index, photos.length, onIndex, onClose]);

    const photo = photos[index];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
            <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="absolute inset-0 bg-slate-900/85 backdrop-blur-sm"
            />

            <div
                ref={holder}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label={photo.title || 'Photograph'}
                className="relative z-10 w-full max-w-4xl outline-none"
            >
                <div className="rounded-2xl overflow-hidden bg-black">
                    <img
                        src={sizedMediaUrl(photo.media.url, 1400)}
                        alt={photo.media.alt || photo.title}
                        className="w-full max-h-[70vh] object-contain"
                    loading="lazy"
                            decoding="async"
                        />
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-[1.375rem] font-extrabold text-white">{photo.title}</p>
                        {(photo.category || photo.state) && (
                            <p className="text-[1.25rem] font-semibold text-white/60 mt-0.5">
                                {[photo.category, photo.state].filter(Boolean).join(' · ')}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-[1.0625rem] font-bold text-white/60 tabular-nums">
                            {index + 1} / {photos.length}
                        </span>
                        <button
                            type="button"
                            aria-label="Previous"
                            onClick={() => onIndex((index - 1 + photos.length) % photos.length)}
                            className="flex h-11 w-11 items-center justify-center rounded-full
                                       bg-white/10 text-white transition-colors hover:bg-white/20"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <button
                            type="button"
                            aria-label="Next"
                            onClick={() => onIndex((index + 1) % photos.length)}
                            className="flex h-11 w-11 items-center justify-center rounded-full
                                       bg-white/10 text-white transition-colors hover:bg-white/20"
                        >
                            <ChevronRight size={18} />
                        </button>
                        <button
                            type="button"
                            aria-label="Close"
                            onClick={onClose}
                            className="flex h-11 w-11 items-center justify-center rounded-full
                                       bg-white/10 text-white transition-colors hover:bg-white/20"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
