import { useEffect, useState } from 'react';
import { MapPin, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCmsEvents, getEventsSettings, type CmsEvent, type EventsSettings } from '@/services/cmsApi';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import { Reveal } from '@/components/shared/Reveal';
import { Tilt3D } from '@/components/shared/Tilt3D';
import { PAGE_CONTAINER } from '@/components/layout/pageContainer';
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
            <section className="w-full py-24 bg-[#fafbfc]">
                <div className={`${PAGE_CONTAINER} animate-pulse`}>
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

    const cap = limit ?? settings?.homeLimit ?? 0;
    const visible = cap > 0 ? events.slice(0, cap) : events;
    const hasMore = cap > 0 && events.length > cap;

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
        <section className="w-full py-24 bg-[#fafbfc]">
            <div className={PAGE_CONTAINER}>

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
                                <span className="text-base font-semibold text-gray-500 lowercase tracking-wider">
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
                                    <div
                                        className="bg-white rounded-[2rem] flex flex-col h-full overflow-hidden
                                                   border border-brand-100/70
                                                   shadow-[0_10px_40px_-14px_rgb(28_46_104/0.18)]
                                                   transition-shadow duration-500
                                                   hover:shadow-[0_30px_64px_-20px_rgb(28_46_104/0.38)]"
                                    >
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
                                    {formatDate(event.startAt) && (
                                        <p className={`${MICRO_LABEL} text-brand-500 mb-4`}>
                                            {formatDate(event.startAt)}
                                        </p>
                                    )}

                                    <h3 className={`${CARD_TITLE} text-brand-800 ${
                                        event.description ? 'mb-3' : 'mb-8 flex-grow'
                                    }`}>
                                        {event.title}
                                    </h3>

                                    {/* Was captured in the CMS and rendered nowhere, which made it
                                        a field that quietly did nothing. */}
                                    {event.description && (
                                        <p className={`${CARD_BODY} text-gray-500 mb-8 flex-grow line-clamp-3`}>
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
                                                <p className="text-[0.8125rem] font-bold text-brand-800 truncate pr-2">Location</p>
                                                <p className={`${MICRO_LABEL} text-gray-500 truncate pr-2`}>
                                                    {event.location || '—'}
                                                </p>
                                            </div>
                                        </div>

                                        <Link
                                            to="/events"
                                            aria-label={`More about ${event.title}`}
                                            className="w-10 h-10 rounded-full bg-gray-50 hover:bg-brand-800 hover:text-white
                                                       flex items-center justify-center transition-colors shrink-0 group"
                                        >
                                            <ArrowRight size={18} className="text-gray-400 group-hover:text-white transition-colors" />
                                        </Link>
                                    </div>
                                    </div>
                                </div>
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
                                       px-8 py-3.5 rounded-full font-bold text-[0.8125rem] uppercase tracking-[0.1em] transition-colors"
                        >
                            {settings.viewAllLabel}
                        </Link>
                    </div>
                )}
            </div>
        </section>
    );
}
