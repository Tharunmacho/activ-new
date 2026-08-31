import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CmsBullet } from '@/services/cmsApi';
import { CmsIcon } from '@/components/shared/CmsIcon';
import { PAGE_CONTAINER } from '@/components/layout/pageContainer';
import { Tilt3D } from '@/components/shared/Tilt3D';
import { Reveal } from '@/components/shared/Reveal';
import { SECTION_HEADING, EYEBROW, CARD_BODY } from '@/components/layout/typography';

/**
 * "Our Mission & Objectives" — the association's aims as a row of cards that
 * advances on its own.
 *
 * These are the `about.bullets` documents. They used to render as a static
 * vertical list stacked inside the left-hand copy column, where five
 * three-line entries pushed the media beside them down by roughly 600px and
 * the last two sat below the fold on every laptop. As a moving row they get
 * the full page width, the whole set is reachable without scrolling, and each
 * one is a card rather than a line item.
 *
 * Same carousel engine as the home banner, deliberately: Embla with the
 * autoplay plugin, so the two behave identically and there is one library to
 * reason about rather than a bespoke `setInterval` here and Embla there.
 */

/**
 * One second, as specified.
 *
 * This is fast — the scroll animation itself is most of the interval, so the
 * row reads as a continuous conveyor rather than as discrete slides. That is
 * the intent, and it is also exactly why `stopOnMouseEnter` below is not
 * optional: at this cadence a card is gone before it can be read, so the row
 * has to hold still the moment someone actually looks at one.
 */
const AUTOPLAY_DELAY_MS = 1000;

const prefersReducedMotion = (): boolean => {
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
};

interface Props {
    bullets: CmsBullet[];
    /** The small label above the heading. */
    eyebrow?: string;
    heading?: string;
}

export function MissionCarousel({
    bullets,
    eyebrow = 'Who We Are',
    heading = 'Our Mission & Objectives',
}: Props) {
    /*
     * Read once. Someone who has asked their OS for less motion gets the cards
     * as a plain scrollable row — still swipeable, never moving on its own.
     * Building the plugin array conditionally is the only way to express that:
     * Embla has no way to disable a plugin after the fact.
     */
    const [reduced] = useState<boolean>(prefersReducedMotion);

    const [emblaRef, emblaApi] = useEmblaCarousel(
        { loop: true, align: 'start', duration: 26, dragFree: false },
        reduced
            ? []
            : [
                  Autoplay({
                      delay: AUTOPLAY_DELAY_MS,
                      // Keep going after a drag: the visitor swiping one card
                      // along is not a request to stop the row forever.
                      stopOnInteraction: false,
                      // But do stop while the pointer is on it — see above.
                      stopOnMouseEnter: true,
                  }),
              ],
    );

    const scrollPrev = useCallback(() => { if (emblaApi) emblaApi.scrollPrev(); }, [emblaApi]);
    const scrollNext = useCallback(() => { if (emblaApi) emblaApi.scrollNext(); }, [emblaApi]);

    // Embla caches slide measurements on mount; the bullets arrive from the CMS
    // a moment later, and without this the row cannot scroll at all.
    useEffect(() => {
        if (emblaApi) emblaApi.reInit();
    }, [emblaApi, bullets?.length]);

    const items = bullets || [];
    if (!items.length) return null;

    return (
        <section className="w-full py-20 md:py-24 relative overflow-hidden font-sans">
            {/*
              Decorative depth. Two out-of-focus brand blooms drifting on
              different clocks, so the band behind the cards is never quite
              static. `blur-3xl` on a plain div is far cheaper than an image and
              scales to any viewport.
            */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute -top-24 -left-20 h-80 w-80 rounded-full bg-brand-200/40 blur-3xl animate-activ-float-slow" />
                <div className="absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-brand-100/60 blur-3xl animate-activ-float" />
            </div>

            <div className={PAGE_CONTAINER}>
                <Reveal className="flex flex-col items-center text-center mb-12 md:mb-16">
                    {eyebrow && (
                        <div className="flex items-center gap-4 mb-5">
                            <span className="h-px w-10 bg-brand-300" />
                            <span className={`${EYEBROW} text-brand-600`}>{eyebrow}</span>
                            <span className="h-px w-10 bg-brand-300" />
                        </div>
                    )}
                    {heading && (
                        <h2 className={`${SECTION_HEADING} text-brand-800`}>{heading}</h2>
                    )}
                </Reveal>

                <div className="relative">
                    <div className="overflow-hidden" ref={emblaRef}>
                        {/* `items-stretch` so every card in view is the height of
                            the tallest, whatever the length of its sentence. */}
                        <div className="flex items-stretch -ml-5">
                            {items.map((bullet, i) => (
                                <div
                                    key={i}
                                    className="pl-5 min-w-0 flex-[0_0_82%] sm:flex-[0_0_46%] lg:flex-[0_0_31%]"
                                >
                                    <Tilt3D className="h-full" intensity={8} lift={1.02}>
                                        <div
                                            className="group h-full flex flex-col rounded-[1.75rem] bg-white
                                                       border border-brand-100 p-7 md:p-8 text-center
                                                       shadow-[0_10px_40px_-12px_rgb(28_46_104/0.18)]
                                                       transition-shadow duration-500
                                                       hover:shadow-[0_28px_60px_-18px_rgb(28_46_104/0.35)]"
                                        >
                                            {/* Icon plate. `translateZ` is what makes the
                                                tilt read as depth rather than as a skew —
                                                the plate sits physically above the card
                                                face and parallaxes against it. */}
                                            <div
                                                className="mx-auto mb-6 flex h-16 w-16 items-center justify-center
                                                           rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100
                                                           ring-1 ring-brand-200/60 transition-transform duration-500
                                                           group-hover:scale-110"
                                                style={{ transform: 'translateZ(38px)' }}
                                            >
                                                <CmsIcon
                                                    name={bullet?.icon}
                                                    size={26}
                                                    className="text-brand-600"
                                                    fallback="users"
                                                />
                                            </div>

                                            {/*
                                              Authored HTML: written in the CMS by a
                                              signed-in super admin, never by a visitor.
                                            */}
                                            <div
                                                className={`${CARD_BODY} text-gray-600 flex-grow
                                                            [&_strong]:text-brand-800 [&_strong]:font-extrabold`}
                                                style={{ transform: 'translateZ(18px)' }}
                                                dangerouslySetInnerHTML={{ __html: bullet?.text || '' }}
                                            />

                                            {/* The accent rule that grows on hover. */}
                                            <span
                                                className="mx-auto mt-7 h-1 w-10 rounded-full bg-brand-600
                                                           transition-all duration-500 group-hover:w-20"
                                            />
                                        </div>
                                    </Tilt3D>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Arrows are pointless with a single card. */}
                    {items.length > 1 && (
                        <>
                            <button
                                type="button"
                                onClick={scrollPrev}
                                aria-label="Previous objective"
                                className="absolute -left-2 lg:-left-8 xl:-left-14 top-1/2 -translate-y-1/2 z-10 hidden sm:flex
                                           h-11 w-11 items-center justify-center rounded-full bg-white
                                           text-brand-700 shadow-lg ring-1 ring-brand-100
                                           hover:bg-brand-800 hover:text-white transition-colors"
                            >
                                <ChevronLeft size={22} />
                            </button>
                            <button
                                type="button"
                                onClick={scrollNext}
                                aria-label="Next objective"
                                className="absolute -right-2 lg:-right-8 xl:-right-14 top-1/2 -translate-y-1/2 z-10 hidden sm:flex
                                           h-11 w-11 items-center justify-center rounded-full bg-white
                                           text-brand-700 shadow-lg ring-1 ring-brand-100
                                           hover:bg-brand-800 hover:text-white transition-colors"
                            >
                                <ChevronRight size={22} />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </section>
    );
}

export default MissionCarousel;
