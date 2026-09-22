import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { ChevronLeft, ChevronRight, ArrowRight, Calendar, MapPin } from 'lucide-react';
import {
    getHome, getHomeGallery,
    type HomeCarousel, type CmsMedia, type GalleryItem, type CmsSectionOverride,
} from '@/services/cmsApi';
import { CmsExtraFields } from '@/components/shared/CmsExtraFields';
import { sectionHidden, sectionFields } from '@/components/shared/cmsSections';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import { CmsIcon } from '@/components/shared/CmsIcon';
import { SCREEN_CONTAINER } from '@/components/layout/pageContainer';
import { CountUp } from '@/components/shared/CountUp';
import { Tilt3D } from '@/components/shared/Tilt3D';
import {
    HERO_HEADING, HERO_LEDE, EYEBROW, STAT_FIGURE, STAT_LABEL, MICRO_LABEL,
} from '@/components/layout/typography';

/**
 * The landing banner.
 *
 * Slides, headline, both buttons and the card overlapping the bottom edge are
 * all authored in the CMS. Nothing is hardcoded: with no slides the banner is
 * not rendered at all, rather than showing stock photography an admin cannot
 * remove.
 *
 * The carousel is only mounted once slides exist. Embla measures its container
 * on mount, and initialising it against an empty list leaves it unable to
 * scroll when the slides arrive a moment later.
 *
 * ---------------------------------------------------------------- posters
 *
 * The banner ALSO carries the recent gallery posters, and each of those slides
 * is a link to that event's own page. This is the thing a visitor actually
 * clicks — it is the first and largest image on the site — so a poster that
 * only appears in the strip further down is a poster most people never reach.
 *
 * Those slides are not stored in the home document. They are the gallery's own
 * items, read at render time, so posting an event to the gallery puts it in the
 * banner and deleting it there takes it out. There is no second copy to keep in
 * step. An authored slide, which is a message rather than an event, has no link
 * and behaves exactly as it always did.
 */

/**
 * A slide, whichever of the two sources it came from.
 *
 * One shape rather than a union with a discriminant: everything below either
 * has an `href` or does not, and that single field is the whole difference
 * between a banner image and a poster you can click.
 */
interface BannerSlide {
    media: CmsMedia;
    caption: string;
    /** Set only on a gallery poster: where clicking it goes. */
    href?: string;
    title?: string;
    eventDate?: string;
    location?: string;
    category?: string;
}

export function CarouselSection() {
    const [carousel, setCarousel] = useState<HomeCarousel | null>(null);
    /* Which of this banner's cards the editor removed, and what they added to each — see `cmsSections`. */
    const [sections, setSections] = useState<CmsSectionOverride[]>([]);
    const [posters, setPosters] = useState<GalleryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [emblaRef, emblaApi] = useEmblaCarousel(
        { loop: true, duration: 40 },
        [Autoplay({ delay: 3000, stopOnInteraction: false })],
    );

    const scrollPrev = useCallback(() => { if (emblaApi) emblaApi.scrollPrev(); }, [emblaApi]);
    const scrollNext = useCallback(() => { if (emblaApi) emblaApi.scrollNext(); }, [emblaApi]);

    useEffect(() => {
        let cancelled = false;

        // Both in flight together. The banner cannot paint without the home
        // document, and waiting for it before asking for the posters would put
        // two round trips in front of the first thing on the page.
        Promise.all([getHome(), getHomeGallery()])
            .then(([home, gallery]) => {
                if (cancelled) return;
                setCarousel(home.carousel);
                setSections(home.sections || []);
                setPosters(gallery || []);
                setIsLoading(false);
            })
            .catch(() => { if (!cancelled) { setCarousel(null); setSections([]); setIsLoading(false); } });

        return () => { cancelled = true; };
    }, []);

    /**
     * The authored slides and the gallery posters, in the order the CMS asks for.
     *
     * Memoised because it is the dependency of the `reInit` below: a new array
     * on every render would re-measure the carousel on every render.
     */
    const slides = useMemo<BannerSlide[]>(() => {
        // A removed Slides card means the authored slides are off the page.
        // The posters are a separate card and can outlive them — a banner of
        // nothing but recent events is a reasonable thing to ask for.
        const authored: BannerSlide[] = sectionHidden(sections, 'carousel.slides')
            ? []
            : (carousel?.slides || []).map(s => ({ media: s.media, caption: s.caption || '' }));

        const config = carousel?.galleryPosters;
        if (!config || config.enabled === false) return authored;
        if (sectionHidden(sections, 'carousel.galleryPosters')) return authored;

        /*
         * EVERY poster switched on, however many that is.
         *
         * There was a `limit` here capping it at six. The per-image switch
         * on the gallery item says which images belong in the banner, and a
         * number on another card quietly overruling it meant an editor who
         * turned nine on got six. One control, one answer — the same change
         * the events strip got.
         */
        const fromGallery: BannerSlide[] = posters
            .filter(item => item?.media?.url)
            .map(item => ({
                media: item.media,
                caption: item.caption || '',
                href: `/gallery/${item._id}`,
                title: item.title || '',
                eventDate: item.eventDate || '',
                location: item.location || '',
                category: item.category || '',
            }));

        return config.position === 'before'
            ? [...fromGallery, ...authored]
            : [...authored, ...fromGallery];
    }, [carousel, posters, sections]);

    // Embla caches slide measurements; without this the arrows do nothing on a
    // list that arrived after mount.
    useEffect(() => {
        if (emblaApi) emblaApi.reInit();
    }, [emblaApi, slides.length]);
    const card = carousel?.highlightCard;
    const cardFields = sectionFields(sections, 'carousel.highlightCard');
    const showCard = !sectionHidden(sections, 'carousel.highlightCard')
        && !!(card?.enabled && (card.value || card.eyebrow || (card.stats || []).length || cardFields.length));

    // Render skeleton while loading
    if (isLoading) {
        return (
            <div className="w-full mb-12">
                <div className="relative w-full h-[85vh] min-h-[37.5rem] bg-slate-200 animate-pulse" />
            </div>
        );
    }

    // Nothing authored yet: render nothing rather than an empty dark band.
    if (!carousel || (!slides.length && !carousel.headline)) return null;

    /*
     * The words over the banner, and the rows the editor added to them.
     *
     * ONLY the Headline card's rows. The other three banner cards — Slides,
     * Posters, Buttons — decide what appears rather than what it says, so
     * they no longer offer the control at all: a labelled line dropped into
     * the hero from a card called "Slides" is an answer to a question
     * nobody asked. See `ownFields` on `CmsStep`.
     */
    const showHeadline = !sectionHidden(sections, 'carousel.headline');
    const overlayFields = showHeadline
        ? sectionFields(sections, 'carousel.headline')
        : [];

    const hasOverlay = overlayFields.length > 0
        || (showHeadline && !!(carousel.headline || carousel.subheadline))
        || !!carousel.ctaLabel;

    /**
     * Whether the banner has any buttons at all.
     *
     * Both labels are blank by default now — the association is not running an
     * appeal, and the one thing a visitor is asked to do (Login) is in the
     * header. Everything the buttons used to affect has to answer to this or
     * the layout keeps their space: the row itself, the gap under the lede that
     * separated it from them, and the bottom padding that lifted a wrapped
     * second button clear of the statistics card.
     */
    const hasButtons = !sectionHidden(sections, 'carousel.buttons')
        && !!(carousel.ctaLabel || carousel.secondaryCtaLabel);

    /** Internal paths route; anything else is a plain anchor. */
    const button = (label: string, href: string, icon: string, primary: boolean) => {
        if (!label) return null;
        const className = primary
            ? 'bg-brand-600 hover:bg-brand-700 text-white px-6 sm:px-8 py-3.5 rounded-full font-bold transition-all shadow-lg flex items-center space-x-2 transform hover:scale-105 transform-gpu'
            : 'border-2 border-white hover:bg-white/10 text-white px-6 sm:px-8 py-3.5 rounded-full font-medium transition-all flex items-center space-x-2';

        const inner = (
            <>
                <CmsIcon name={icon} size={18} fallback={primary ? 'heart' : 'play'} />
                <span>{label}</span>
            </>
        );

        return (href || '').startsWith('/')
            ? <Link to={href} className={className}>{inner}</Link>
            : <a href={href || '#'} className={className}>{inner}</a>;
    };

    return (
        <div className={`w-full ${showCard ? 'mb-32' : 'mb-12'}`}>
            <div className="relative w-full h-[85vh] min-h-[37.5rem] bg-slate-900 overflow-visible">

                {slides.length > 0 && (
                    <div className="absolute inset-0 overflow-hidden" ref={emblaRef}>
                        <div className="flex h-full">
                            {slides.map((slide, i) => {
                                /* The picture and the shade over it. On a poster
                                   this whole block becomes the link, so that the
                                   thing a visitor points at is the thing that
                                   takes them somewhere. */
                                const picture = (
                                    <>
                                        {/* The frame honours the fit and focal point chosen in the
                                            CMS, so a portrait upload is not cropped to a sliver in a
                                            banner this wide, and a video renders as a video. */}
                                        <div className="absolute inset-0">
                                            <CmsMediaFrame
                                                media={slide.media}
                                                priority={i === 0}
                                                width={1600}
                                                className={slide.href
                                                    ? 'group-hover:scale-[1.03] transition-transform duration-[1200ms] transform-gpu'
                                                    : ''}
                                            />
                                        </div>

                                        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50
                                                        to-transparent z-10 pointer-events-none" />

                                    </>
                                );

                                return (
                                    <div key={slide.href || i} className="flex-[0_0_100%] min-w-0 h-full relative">
                                        {slide.href ? (
                                            /*
                                              Embla registers its own capture-phase
                                              click handler and swallows the click
                                              that ends a drag, so swiping the
                                              banner on a phone does not navigate.
                                              Nothing extra is needed here.
                                            */
                                            <Link
                                                to={slide.href}
                                                aria-label={slide.title ? `View details of ${slide.title}` : 'View gallery item'}
                                                className="group absolute inset-0 block"
                                            >
                                                {picture}
                                            </Link>
                                        ) : picture}

                                        {slide.caption && !slide.href && (
                                            <div className="absolute inset-x-0 bottom-24 z-20 flex justify-center px-6">
                                                <p className="text-white/90 text-[1.375rem] md:text-[1.5625rem] text-center max-w-3xl drop-shadow">
                                                    {slide.caption}
                                                </p>
                                            </div>
                                        )}

                                        {/*
                                          A poster says what it is, and says that it
                                          can be opened.

                                          ITS OWN PANEL, not text on the photograph.
                                          The banner's shade runs left to right, for
                                          the headline, so the far side of the frame
                                          is at full brightness — and a lit hall or a
                                          white marquee leaves white text there
                                          unreadable. A translucent plate is legible
                                          over anything, at any width.

                                          IT MOVES. On a phone the bottom of this
                                          banner belongs to the two buttons and to
                                          the statistics card that crosses its
                                          bottom edge, so a block pinned there
                                          collides with both — it sits high instead,
                                          under the header. From `lg`, where the
                                          headline occupies the left half and the
                                          card is clear of the corner, it takes the
                                          bottom right.

                                          `pointer-events-none` throughout: it must
                                          never intercept the click meant for the
                                          link underneath it.
                                        */}
                                        {slide.href && (slide.title || slide.eventDate || slide.location) && (
                                            <div className="absolute right-3 sm:right-4 lg:right-8
                                                            top-6 sm:top-8 lg:top-auto lg:bottom-24 z-20
                                                            max-w-[min(20rem,72%)] text-right pointer-events-none
                                                            /* No `backdrop-blur`: this sits over a
                                                               full-bleed photograph, so the compositor
                                                               re-blurs the whole image on every frame of
                                                               a scroll. Measured at 167ms frames on the
                                                               home page. A solid translucent fill looks
                                                               the same at this opacity. */
                                                            bg-black/55 border border-white/15
                                                            rounded-2xl px-4 py-3 sm:px-5 sm:py-4">
                                                {slide.category && (
                                                    <span className="inline-block bg-white/95 text-brand-700 text-[0.75rem] font-bold
                                                                     px-3 py-1 rounded-full uppercase tracking-wider mb-2">
                                                        {slide.category}
                                                    </span>
                                                )}

                                                {slide.title && (
                                                    <p className="text-white text-[1.25rem] sm:text-[1.375rem] lg:text-2xl font-extrabold
                                                                  leading-snug line-clamp-2">
                                                        {slide.title}
                                                    </p>
                                                )}

                                                {(slide.eventDate || slide.location) && (
                                                    <div className="mt-2 flex flex-wrap items-center justify-end gap-x-3 gap-y-1
                                                                    text-white/90">
                                                        {slide.eventDate && (
                                                            <span className={`${MICRO_LABEL} flex items-center gap-1.5`}>
                                                                <Calendar size={12} /> {slide.eventDate}
                                                            </span>
                                                        )}
                                                        {slide.location && (
                                                            <span className={`${MICRO_LABEL} hidden sm:flex items-center gap-1.5 min-w-0`}>
                                                                <MapPin size={12} className="shrink-0" />
                                                                <span className="truncate">{slide.location}</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {/*
                                                  Desktop only. On a phone this
                                                  panel sits over the headline's
                                                  first line if it runs to four
                                                  rows — and the affordance is
                                                  redundant there anyway: the whole
                                                  image is the tap target, and a
                                                  phone has no hover to reveal it.
                                                */}
                                                <span className="mt-3 hidden lg:inline-flex items-center gap-1.5 border border-white/40
                                                                 text-white text-[0.8125rem] font-extrabold uppercase
                                                                 tracking-widest px-3.5 py-1.5 rounded-full">
                                                    View details <ArrowRight size={13} />
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/*
                  Arrows are pointless with one slide and misleading with none.
                  Below `sm` they are pointless for a second reason: the overlay
                  headline is centred in the banner and wraps to three or four
                  lines on a 390px screen, so a pair of 48px discs pinned at 40%
                  of the height land ON the words — "Better Future" was sitting
                  behind the left arrow. The carousel is a swipe on a touch
                  screen, so nothing is lost by taking them off it; from `sm`
                  there is width for them beside the text and they come back.
                */}
                {slides.length > 1 && (
                    <>
                        <button
                            onClick={scrollPrev}
                            aria-label="Previous slide"
                            className="hidden sm:flex absolute left-4 md:left-8 top-[40%] -translate-y-1/2 w-12 h-12 items-center
                                       justify-center rounded-full bg-white/20 hover:bg-white/30 text-white
                                       ring-1 ring-white/25 transition-colors z-30"
                        >
                            <ChevronLeft size={28} />
                        </button>
                        <button
                            onClick={scrollNext}
                            aria-label="Next slide"
                            className="hidden sm:flex absolute right-4 md:right-8 top-[40%] -translate-y-1/2 w-12 h-12 items-center
                                       justify-center rounded-full bg-white/20 hover:bg-white/30 text-white
                                       ring-1 ring-white/25 transition-colors z-30"
                        >
                            <ChevronRight size={28} />
                        </button>
                    </>
                )}

                {/* Headline and buttons */}
                {/*
                  `pb-28` on a phone, none from `sm`. The overlay centres its
                  content in the banner's full height, but the statistics card is
                  absolutely positioned across the bottom edge of it — so on a
                  390px screen, where the two buttons wrap onto separate lines,
                  the second one landed underneath the card and could not be
                  tapped at all. Padding the flex container shifts the centre up
                  by the height of the overlap.
                */}
                {hasOverlay && (
                    <div className={`absolute inset-0 z-20 flex items-center pointer-events-none
                                     ${hasButtons ? 'pb-28 sm:pb-32 lg:pb-0' : 'pb-20 sm:pb-24 lg:pb-0'}`}>
                        <div className={SCREEN_CONTAINER}>
                            <div className="max-w-3xl text-white pointer-events-auto">
                                {showHeadline && (carousel.headline || carousel.headlineHighlight) && (
                                    <h1 className={`${HERO_HEADING} mb-6`}>
                                        {carousel.headline}
                                        {carousel.headlineHighlight && (
                                            <> <span className="text-brand-300">{carousel.headlineHighlight}</span></>
                                        )}
                                    </h1>
                                )}

                                {showHeadline && carousel.subheadline && (
                                    <p className={`${HERO_LEDE} text-gray-200 max-w-2xl
                                                   ${hasButtons ? 'mb-10' : 'mb-0'}`}>
                                        {carousel.subheadline}
                                    </p>
                                )}

                                {/* Not rendered at all when both labels are blank —
                                    an empty flex row still occupies the gap above
                                    it, which reads as a button that failed to
                                    paint rather than as one that is not there. */}
                                {hasButtons && (
                                    <div className="flex flex-wrap items-center gap-4">
                                        {button(carousel.ctaLabel, carousel.ctaHref, carousel.ctaIcon, true)}
                                        {button(carousel.secondaryCtaLabel, carousel.secondaryCtaHref, carousel.secondaryCtaIcon, false)}
                                    </div>
                                )}

                                {/* The editor's own rows on this banner — see `overlayFields`. */}
                                <CmsExtraFields
                                    fields={overlayFields}
                                    tone="dark"
                                    className={hasButtons ? 'mt-10' : 'mt-8'}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* The card overlapping the bottom edge */}
                {showCard && (
                    /* A wide, shallow tilt on a long card: the same degrees that
                       look right on a 320px tile shear a 1024px one. The long
                       perspective and the small intensity are what keep this
                       reading as a plate lifting off the banner rather than as a
                       skew. */
                    <Tilt3D
                        /* `-bottom-16`, not `-bottom-20`. The card is anchored by its
                           bottom edge, so every pixel it grows is a pixel its TOP rises
                           into the banner — and the banner has a paragraph there. Less
                           overhang leaves the same plate-lifting-off effect with the
                           text clear behind it. */
                        className="absolute left-1/2 -translate-x-1/2 -bottom-16 w-[90%] max-w-5xl z-30"
                        intensity={4}
                        lift={1.01}
                        perspective={1600}
                        glare={false}
                    >
                    <div className="bg-white rounded-3xl shadow-[0_30px_70px_-24px_rgb(28_46_104/0.5)]
                                    p-6 md:p-8 lg:p-10 border border-brand-100">
                    <div className="flex flex-col md:flex-row items-center
                                    justify-between gap-6 md:gap-0">

                        {(card!.value || card!.eyebrow) && (
                            <div className="flex items-center space-x-6 w-full md:w-auto">
                                <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center
                                                text-brand-600 shrink-0">
                                    <CmsIcon name={card!.icon} size={32} fallback="users" />
                                </div>
                                <div>
                                    {card!.eyebrow && (
                                        <p className={`${EYEBROW} text-brand-500 mb-1.5`}>
                                            {card!.eyebrow}
                                        </p>
                                    )}
                                    <p className={`${STAT_FIGURE} text-brand-800`}>
                                        <CountUp value={card!.value} />
                                        {card!.caption && (
                                            <span className="text-[1.25rem] font-medium text-gray-500 ml-2">{card!.caption}</span>
                                        )}
                                    </p>
                                </div>
                            </div>
                        )}

                        {(card!.value || card!.eyebrow) && (card!.stats || []).length > 0 && (
                            <div className="w-px h-20 bg-gray-200 mx-4 lg:mx-8 hidden md:block" />
                        )}

                        {(card!.stats || []).length > 0 && (
                            /*
                             * A GRID, NOT A WRAPPING FLEX ROW.
                             *
                             * `flex-wrap` with `justify-between` put three figures on
                             * a row that fitted two: DISTRICTS and BLOCKS side by side,
                             * then EVENTS alone on a second row, left-aligned under the
                             * first — an orphan that reads as a fourth thing that did
                             * not fit rather than as one of three.
                             *
                             * It also doubled the card's height, and the card is
                             * positioned by its BOTTOM edge — so the extra row pushed
                             * its top up through the hero paragraph behind it. The
                             * overlap in the screenshot is this wrap, not the offset.
                             *
                             * `auto-cols-fr` with `grid-flow-col` from `md` puts every
                             * figure in an equal column on one row, whatever the CMS
                             * has been given — three today, five tomorrow. Below `md`
                             * they stack two-up, which is deliberate: on a phone the
                             * card is already full width and a single row of five would
                             * be five unreadable columns.
                             */
                            <div className="grid w-full md:w-auto grid-cols-2 gap-x-6 gap-y-6
                                            md:grid-flow-col md:auto-cols-fr sm:gap-x-8 lg:gap-x-16">
                                {card!.stats.map((stat, i) => (
                                    <div key={i} className="flex flex-col items-center text-center min-w-0">
                                        <CmsIcon name={stat.icon} size={28} className="text-brand-600 mb-3" fallback="users" />
                                        <p className={`${STAT_FIGURE} text-brand-800`}>
                                            <CountUp value={stat.value} />
                                        </p>
                                        <p className={`${STAT_LABEL} text-gray-500 mt-1.5`}>
                                            {stat.label}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* The editor's own rows on this card, under the figures. */}
                    <CmsExtraFields
                        fields={cardFields}
                        className="mt-8 border-t border-brand-100 pt-6"
                    />
                    </div>
                    </Tilt3D>
                )}
            </div>
        </div>
    );
}
