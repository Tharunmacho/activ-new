import { useEffect, useState } from 'react';
import { HeaderSection } from '../../components/layout/HeaderSection';
import { CarouselSection } from './components/CarouselSection';
import { AboutSection } from './components/AboutSection';
import { EventsGrid } from '../../components/shared/EventsGrid';
import { FooterSection } from '../../components/layout/FooterSection';
import { AcrossIndia } from '@/components/shared/AcrossIndia';
import { getHome, type CmsSectionOverride } from '@/services/cmsApi';
import { sectionHidden } from '@/components/shared/cmsSections';
import { SectionFields } from '@/components/shared/SectionFields';
import { SCREEN_CONTAINER } from '@/components/layout/pageContainer';

/** The home page's band copy, for the rows added to those bands. */
const BAND_PROSE = 'text-[1.125rem] sm:text-[1.25rem] font-medium leading-relaxed text-gray-600';

/**
 * The home page.
 *
 * Four bands: the banner, the About block, the upcoming events and the region
 * tiles above the footer. Every one of them is on the Home Page screen in the
 * CMS, and every one can be removed there — see `cmsSections`.
 *
 * TWO OF THEM BELONG TO ANOTHER DOCUMENT, and that is why the removals are
 * read HERE rather than inside the bands themselves. The events strip is the
 * Events settings and the tiles are the Site settings, both drawn on other
 * pages too; `home.sections` is the home page's own answer about its own
 * layout, so removing a band here takes it off this page and leaves it on the
 * others. A flag inside `EventsGrid` would take the strip off the events page
 * as well, which is not what an editor tidying the home page asked for.
 */
export default function Hero() {
    /* Which of this page's bands the editor removed. */
    const [sections, setSections] = useState<CmsSectionOverride[]>([]);

    /*
     * Whether the site could be READ at all.
     *
     * Every band below catches its own failure and renders nothing, which
     * is right one band at a time and produces a blank white page when the
     * API is unreachable — indistinguishable from a broken deployment, and
     * exactly what a backend restart looks like to whoever is watching.
     *
     * Said once, here, with a retry. Not once per band: six apologies down
     * a page is worse than one.
     */
    const [unreachable, setUnreachable] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getHome()
            .then((home) => {
                if (cancelled) return;
                setSections(home.sections || []);
                setUnreachable(home.failed === true);
            })
            .catch(() => { if (!cancelled) setUnreachable(true); });
        return () => { cancelled = true; };
    }, []);

    return (
        <div className="flex flex-col min-h-screen font-sans bg-white">
            {/* 0. Header Navigation */}
            <HeaderSection />

            {/*
              * The site is up; the content service is not.
              *
              * Deliberately a band and not a full-page state: the header,
              * the footer and anything already cached still render, and
              * replacing a partly-working page with an error screen would
              * take away more than it explains.
              */}
            {unreachable && (
                <div className="w-full border-b border-amber-200 bg-amber-50">
                    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-3 px-6 py-4
                                    sm:flex-row sm:items-center sm:justify-between lg:px-10">
                        <p className="text-[1.0625rem] font-semibold text-amber-900">
                            The page content could not be loaded just now — the site is up but
                            its content service did not answer.
                        </p>
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="shrink-0 rounded-full bg-amber-900 px-5 py-2 text-[1.0625rem]
                                       font-bold text-white transition-colors hover:bg-amber-800"
                        >
                            Try again
                        </button>
                    </div>
                </div>
            )}

            {/* 1. Landing Area (Carousel).
                   It carries the recent gallery posters as well as the authored
                   slides, and each poster links to that event's own page — which is
                   why there is no separate gallery strip further down this page.

                   Its own cards are read inside it, because they are the home
                   document's and nothing else draws them. */}
            <CarouselSection />

            {/* 2. About Card Section */}
            <AboutSection />

            {/* 3. Upcoming Events Section */}
            {!sectionHidden(sections, 'home.eventsBand') && (
                <>
                    <EventsGrid showViewAll />
                    {/* This band's own rows, inside the band. They were never
                        drawn anywhere: the card offered the control and the
                        page had nowhere to put the answer. */}
                    <div className={SCREEN_CONTAINER}>
                        <SectionFields proseClass={BAND_PROSE} sections={sections} sectionKey="home.eventsBand" />
                    </div>
                </>
            )}

            {/* 4. Footer */}
            {/* Above the footer, as on every other page — see `AcrossIndia`. On the
                home page it is the last thing a reader passes, which is where
                "where else can I go" is the useful question. */}
            {!sectionHidden(sections, 'home.acrossIndia') && (
                <>
                    <AcrossIndia />
                    <div className={SCREEN_CONTAINER}>
                        <SectionFields proseClass={BAND_PROSE} sections={sections} sectionKey="home.acrossIndia" />
                    </div>
                </>
            )}

            <FooterSection />
        </div>
    );
}
