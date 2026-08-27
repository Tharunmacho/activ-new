import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getHome, type HomeCarousel } from '@/services/cmsApi';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import { CmsIcon } from '@/components/shared/CmsIcon';

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
 */
export function CarouselSection() {
    const [carousel, setCarousel] = useState<HomeCarousel | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [emblaRef, emblaApi] = useEmblaCarousel(
        { loop: true, duration: 40 },
        [Autoplay({ delay: 3000, stopOnInteraction: false })],
    );

    const scrollPrev = useCallback(() => { if (emblaApi) emblaApi.scrollPrev(); }, [emblaApi]);
    const scrollNext = useCallback(() => { if (emblaApi) emblaApi.scrollNext(); }, [emblaApi]);

    useEffect(() => {
        let cancelled = false;
        getHome()
            .then((home) => { if (!cancelled) { setCarousel(home.carousel); setIsLoading(false); } })
            .catch(() => { if (!cancelled) { setCarousel(null); setIsLoading(false); } });
        return () => { cancelled = true; };
    }, []);

    // Embla caches slide measurements; without this the arrows do nothing on a
    // list that arrived after mount.
    useEffect(() => {
        if (emblaApi) emblaApi.reInit();
    }, [emblaApi, carousel?.slides?.length]);

    const slides = carousel?.slides || [];
    const card = carousel?.highlightCard;
    const showCard = !!(card?.enabled && (card.value || card.eyebrow || (card.stats || []).length));

    // Render skeleton while loading
    if (isLoading) {
        return (
            <div className="w-full mb-12">
                <div className="relative w-full h-[85vh] min-h-[600px] bg-slate-200 animate-pulse" />
            </div>
        );
    }

    // Nothing authored yet: render nothing rather than an empty dark band.
    if (!carousel || (!slides.length && !carousel.headline)) return null;

    const hasOverlay = !!(carousel.headline || carousel.subheadline || carousel.ctaLabel);

    /** Internal paths route; anything else is a plain anchor. */
    const button = (label: string, href: string, icon: string, primary: boolean) => {
        if (!label) return null;
        const className = primary
            ? 'bg-[#2563eb] hover:bg-blue-700 text-white px-8 py-3.5 rounded-full font-bold transition-all shadow-lg flex items-center space-x-2 transform hover:scale-105 transform-gpu'
            : 'border-2 border-white hover:bg-white/10 text-white px-8 py-3.5 rounded-full font-medium transition-all flex items-center space-x-2';

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
            <div className="relative w-full h-[85vh] min-h-[600px] bg-slate-900 overflow-visible">

                {slides.length > 0 && (
                    <div className="absolute inset-0 overflow-hidden" ref={emblaRef}>
                        <div className="flex h-full">
                            {slides.map((slide, i) => (
                                <div key={i} className="flex-[0_0_100%] min-w-0 h-full relative">
                                    {/* The frame honours the fit and focal point chosen in the
                                        CMS, so a portrait upload is not cropped to a sliver in a
                                        banner this wide, and a video renders as a video. */}
                                    <div className="absolute inset-0">
                                        <CmsMediaFrame media={slide.media} />
                                    </div>

                                    <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent z-10" />

                                    {slide.caption && (
                                        <div className="absolute inset-x-0 bottom-24 z-20 flex justify-center px-6">
                                            <p className="text-white/90 text-base md:text-lg text-center max-w-3xl drop-shadow">
                                                {slide.caption}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Arrows are pointless with one slide and misleading with none. */}
                {slides.length > 1 && (
                    <>
                        <button
                            onClick={scrollPrev}
                            aria-label="Previous slide"
                            className="absolute left-4 md:left-8 top-[40%] -translate-y-1/2 w-12 h-12 flex items-center
                                       justify-center rounded-full bg-white/10 hover:bg-white/30 text-white
                                       backdrop-blur-md transition-colors z-30"
                        >
                            <ChevronLeft size={28} />
                        </button>
                        <button
                            onClick={scrollNext}
                            aria-label="Next slide"
                            className="absolute right-4 md:right-8 top-[40%] -translate-y-1/2 w-12 h-12 flex items-center
                                       justify-center rounded-full bg-white/10 hover:bg-white/30 text-white
                                       backdrop-blur-md transition-colors z-30"
                        >
                            <ChevronRight size={28} />
                        </button>
                    </>
                )}

                {/* Headline and buttons */}
                {hasOverlay && (
                    <div className="absolute inset-0 z-20 flex items-center pointer-events-none">
                        <div className="container mx-auto px-4 md:px-8">
                            <div className="max-w-3xl text-white pointer-events-auto">
                                {(carousel.headline || carousel.headlineHighlight) && (
                                    <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] mb-6 font-serif">
                                        {carousel.headline}
                                        {carousel.headlineHighlight && (
                                            <> <span className="text-[#60a5fa]">{carousel.headlineHighlight}</span></>
                                        )}
                                    </h1>
                                )}

                                {carousel.subheadline && (
                                    <p className="text-lg md:text-xl text-gray-200 mb-10 max-w-xl font-light leading-relaxed">
                                        {carousel.subheadline}
                                    </p>
                                )}

                                <div className="flex flex-wrap items-center gap-4">
                                    {button(carousel.ctaLabel, carousel.ctaHref, carousel.ctaIcon, true)}
                                    {button(carousel.secondaryCtaLabel, carousel.secondaryCtaHref, carousel.secondaryCtaIcon, false)}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* The card overlapping the bottom edge */}
                {showCard && (
                    <div className="absolute left-1/2 -translate-x-1/2 -bottom-20 w-[90%] max-w-5xl bg-white
                                    rounded-3xl shadow-2xl z-30 p-6 md:p-10 flex flex-col md:flex-row items-center
                                    justify-between border border-gray-100">

                        {(card!.value || card!.eyebrow) && (
                            <div className="flex items-center space-x-6 w-full md:w-auto mb-8 md:mb-0">
                                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center
                                                text-[#2563eb] shrink-0">
                                    <CmsIcon name={card!.icon} size={32} fallback="users" />
                                </div>
                                <div>
                                    {card!.eyebrow && (
                                        <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">
                                            {card!.eyebrow}
                                        </p>
                                    )}
                                    <p className="text-3xl font-black text-[#1c2e68]">
                                        {card!.value}
                                        {card!.caption && (
                                            <span className="text-sm font-medium text-gray-500 ml-2">{card!.caption}</span>
                                        )}
                                    </p>
                                </div>
                            </div>
                        )}

                        {(card!.value || card!.eyebrow) && (card!.stats || []).length > 0 && (
                            <div className="w-full md:w-px md:h-20 bg-gray-200 mx-8 hidden md:block" />
                        )}

                        {(card!.stats || []).length > 0 && (
                            <div className="flex w-full md:w-auto justify-between md:space-x-16">
                                {card!.stats.map((stat, i) => (
                                    <div key={i} className="text-center flex flex-col items-center">
                                        <CmsIcon name={stat.icon} size={28} className="text-[#2563eb] mb-3" fallback="users" />
                                        <p className="font-black text-[#1c2e68] text-2xl">{stat.value}</p>
                                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mt-1">
                                            {stat.label}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
