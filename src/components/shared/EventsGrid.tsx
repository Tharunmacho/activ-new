import { eventPath } from '@/lib/eventPath';
import { useEffect, useState } from 'react';
import { MapPin, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCmsEvents, getEventsSettings, type CmsEvent, type EventsSettings } from '@/services/cmsApi';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import { Reveal } from '@/components/shared/Reveal';
import { Tilt3D } from '@/components/shared/Tilt3D';
import { SCREEN_CONTAINER } from '@/components/layout/pageContainer';
import {
    SECTION_HEADING, CARD_TITLE, CARD_BODY, MICRO_LABEL, EYEBROW,
} from '@/components/layout/typography';

/**
 * The events grid, shown on the home page and on `/events`.
 *
 * Events come from the platform's own `Event` collection via `/cms/events`, so
 * what the public site shows and what the member app shows are the same list —
 * publishing once is enough. The copy around the grid is authored separately in
 * `/cms/events-settings`.
 *
 * `limit` is what distinguishes the two callers: the home page shows the first
 * few and links onward, the Events page shows everything.
 */
interface Props {
    /** Cap the number rendered. Omit on the Events page to show them all. */
    limit?: number;
    /** The home page links to /events; the Events page has nowhere to go. */
    showViewAll?: boolean;
}

const formatDate = (iso: string | null) => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date
        .toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })
        .toUpperCase();
};

export function EventsGrid({ limit, showViewAll = false }: Props) {
    const [events, setEvents] = useState<CmsEvent[] | null>(null);
    const [settings, setSettings] = useState<EventsSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        // Both in flight together: the copy and the list are independent, and
        // waiting for one before asking for the other doubles the delay.
        Promise.all([getCmsEvents(), getEventsSettings()])
            .then(([list, config]) => {
                if (cancelled) return;
                setEvents(list);
                setSettings(config);
                setIsLoading(false);
            })
            .catch(() => {
                if (cancelled) return;
                setEvents([]);
                setSettings(null);
                setIsLoading(false);
            });

        return () => { cancelled = true; };
    }, []);

    if (isLoading) {
        return (
            <section className="w-full py-24 dot-band">
                <div className={`${SCREEN_CONTAINER} animate-pulse`}>
                    <div className="flex flex-col items-center text-center mb-16 space-y-6">
                        <div className="h-6 bg-slate-200 rounded w-24"></div>
                        <div className="h-10 bg-slate-200 rounded w-1/2"></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-white rounded-[2rem] flex flex-col shadow-sm h-96 overflow-hidden">
                                <div className="w-full h-48 bg-slate-200"></div>
                                <div className="p-8 flex flex-col flex-grow space-y-4">
                                    <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                                    <div className="h-6 bg-slate-200 rounded w-3/4"></div>
                                    <div className="h-4 bg-slate-200 rounded w-full mt-auto"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    // Still loading. Rendering the empty state here would flash "no events" on
    // every page load before the real list arrives.
    if (events === null) return null;

    /*
     * ======================================================================
     * THE SAME EVENTS AS /events — NO SWITCH, NO SEPARATE LIST
     * ======================================================================
     *
     * Every event on the events page is on the home page, and nothing else is.
     * There used to be a per-event "home page" switch, set from two CMS
     * screens, which let the two pages disagree about what is happening. It is
     * gone: posting an event in the CMS puts it on both, and the rule here is
     * the events page's own — upcoming only, with an undated event kept,
     * because an unset date is missing information rather than a statement
     * that it already happened (see `EventsExplorer`).
     *
     * The list is already the public one: `getCmsEvents` returns only
     * published events the onboarding site may show.
     */
    const now = Date.now();
    const forHome = events.filter((e) => {
        /* The END, where one was given: a multi-day event belongs on the home
           page until its last day is over, not until its first is. */
        const finish = e?.endAt || e?.startAt;
        const start = finish ? new Date(finish).getTime() : NaN;
        return Number.isNaN(start) || start >= now;
    });

    /*
     * EVERY ONE THAT IS SWITCHED ON, however many that is.
     *
     * There was a `homeLimit` here, capping this at three. An editor who
     * switched five events on got three of them and nothing anywhere said
     * which two had been dropped — the switch they were using was being
     * overruled by a number on another card. One control, one answer.
     *
     * `limit` survives as a PROP because a caller may still ask for a
     * short strip in a narrow place; nothing passes it today.
     */
    const visible = limit && limit > 0 ? forHome.slice(0, limit) : forHome;

    /*
     * "See all events" counts against the WHOLE list, not the home list.
     *
     * An editor who puts three events on the home page out of nine has nine
     * to see on /events, and hiding the button because the strip is full
     * would be the CMS deciding there is nothing more to show.
     */
    const hasMore = events.length > visible.length;

    const heading = settings?.heading || '';
    // The heading is stored in two halves so the Events page's hero can set the
    // tail in the accent colour. The home grid renders both, or it would show
    // "Our" on its own.
    const headingHighlight = settings?.headingHighlight || '';
    const badge = settings?.badgeText || '';
    const subtitle = settings?.subtitle || '';

    // Nothing to show and nothing to say about it: render nothing rather than an
    // empty band with a heading over it.
    if (!visible.length && !heading && !headingHighlight && !settings?.emptyText) return null;

    return (
        <section className="w-full py-24 dot-band">
            <div className={SCREEN_CONTAINER}>

                {(badge || heading || headingHighlight || subtitle) && (
                    <Reveal className="flex flex-col items-center text-center mb-16">
                        {badge && (
                            <div className="inline-flex items-center space-x-2 bg-brand-50 border border-brand-100
                                            rounded-full px-4 py-1.5 mb-6">
                                <span className={`${EYEBROW} text-brand-600`}>{badge}</span>
                            </div>
                        )}

                        {(heading || headingHighlight) && (
                            <h2 className={`${SECTION_HEADING} text-brand-800 mb-6`}>
                                {heading}
                                {heading && headingHighlight && ' '}
                                {headingHighlight && <span className="text-brand-600">{headingHighlight}</span>}
                            </h2>
                        )}

                        {subtitle && (
                            <div className="flex items-center space-x-4">
                                <div className="h-px w-10 bg-brand-300" />
                                <span className="text-[1.25rem] font-semibold text-gray-500 lowercase tracking-wider">
                                    {subtitle}
                                </span>
                                <div className="h-px w-10 bg-brand-300" />
                            </div>
                        )}
                    </Reveal>
                )}

                {visible.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">{settings?.emptyText}</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
                        {visible.map((event, i) => (
                            /* Staggered so the row assembles left to right rather than
                               all at once. Capped: past ~360ms the last card in a long
                               list reads as having failed to load. */
                            <Reveal key={event.id} delay={Math.min(i, 4) * 90} className="h-full">
                                <Tilt3D className="h-full" intensity={7} lift={1.02} glare={false}>
                                    {/* THE WHOLE CARD opens the event. Only the small
                                        arrow in its corner used to, so a visitor
                                        clicking the banner or the title — which is
                                        what people click — got nothing. A stretched
                                        overlay link, as on the /events cards (see
                                        `EventsExplorer`), so the link's accessible
                                        name stays short. */}
                                    <article
                                        className="group/card relative bg-white rounded-[2rem] flex flex-col h-full overflow-hidden
                                                   focus-within:ring-4 focus-within:ring-brand-300
                                                   border border-brand-100/70
                                                   shadow-[0_10px_40px_-14px_rgb(28_46_104/0.18)]
                                                   transition-shadow duration-500
                                                   hover:shadow-[0_30px_64px_-20px_rgb(28_46_104/0.38)]"
                                    >
                                <Link
                                    to={eventPath(event)}
                                    aria-label={`More about ${event.title || 'this event'}`}
                                    className="absolute inset-0 z-10 focus:outline-none"
                                />
                                {/* No image is a valid event; a broken frame is not. */}
                                {event.media?.url && (
                                    <div className="w-full h-56 overflow-hidden">
                                        {/* Honours the fit and focal point set in the CMS, so a
                                            portrait upload is not cropped to a strip here. */}
                                        <CmsMediaFrame
                                            media={event.media}
                                            width={420}
                                            className="hover:scale-105 transition-transform duration-700"
                                        />
                                    </div>
                                )}

                                <div className="p-8 flex flex-col flex-grow">
                                    {/*
                                      * ALWAYS DRAWN, even with no date on the
                                      * event.
                                      *
                                      * Two reasons, and they agree. A card that
                                      * omits the line starts its title where its
                                      * neighbour's date sits, so a row of three
                                      * has three different first baselines. And
                                      * an undated event is a real thing here —
                                      * no field on the event form is required —
                                      * so the card says which it is rather than
                                      * leaving a corner missing, which reads as
                                      * a render fault.
                                      */}
                                    <p className={`${MICRO_LABEL} text-brand-500 mb-4`}>
                                        {formatDate(event.startAt) || 'Date to be confirmed'}
                                    </p>

                                    <h3 className={`${CARD_TITLE} text-balance line-clamp-2 min-h-[2.4em]
                                                    text-brand-800 ${
                                        event.description ? 'mb-3' : 'mb-8 flex-grow'
                                    }`}>
                                        {event.title || 'Untitled event'}
                                    </h3>

                                    {/* Was captured in the CMS and rendered nowhere, which made it
                                        a field that quietly did nothing. */}
                                    {event.description && (
                                        <p className={`${CARD_BODY} text-gray-500 mb-8 flex-grow line-clamp-3
                                                       min-h-[4.9em]`}>
                                            {event.description}
                                        </p>
                                    )}

                                    <div className="flex items-center justify-between pt-6 border-t border-gray-100 mt-auto">
                                        <div className="flex items-center space-x-3 w-3/4">
                                            <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center
                                                            justify-center shrink-0">
                                                <MapPin size={18} className="text-brand-600" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[1rem] font-bold text-brand-800 truncate pr-2">Location</p>
                                                <p className={`${MICRO_LABEL} text-gray-500 truncate pr-2`}>
                                                    {event.location || '—'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* A cue, not a second link — the card is the link. */}
                                        <span
                                            aria-hidden="true"
                                            className="w-11 h-11 rounded-full bg-gray-50 group-hover/card:bg-brand-800
                                                       flex items-center justify-center transition-colors shrink-0"
                                        >
                                            <ArrowRight size={18} className="text-gray-400 group-hover/card:text-white transition-colors" />
                                        </span>
                                    </div>
                                    </div>
                                </article>
                                </Tilt3D>
                            </Reveal>
                        ))}
                    </div>
                )}

                {/* Only offered when there is genuinely more to see. */}
                {showViewAll && hasMore && settings?.viewAllLabel && (
                    <div className="flex justify-center">
                        <Link
                            to={settings.viewAllHref || '/events'}
                            className="border-2 border-gray-200 hover:border-brand-800 text-gray-600 hover:text-brand-800
                                       px-8 py-3.5 rounded-full font-bold text-[1rem] uppercase tracking-[0.1em] transition-colors"
                        >
                            {settings.viewAllLabel}
                        </Link>
                    </div>
                )}
            </div>
        </section>
    );
}
