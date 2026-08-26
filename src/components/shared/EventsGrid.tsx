import { useEffect, useState } from 'react';
import { MapPin, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCmsEvents, getEventsSettings, type CmsEvent, type EventsSettings } from '@/services/cmsApi';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';

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

    useEffect(() => {
        let cancelled = false;

        // Both in flight together: the copy and the list are independent, and
        // waiting for one before asking for the other doubles the delay.
        Promise.all([getCmsEvents(), getEventsSettings()])
            .then(([list, config]) => {
                if (cancelled) return;
                setEvents(list);
                setSettings(config);
            })
            .catch(() => {
                if (cancelled) return;
                setEvents([]);
                setSettings(null);
            });

        return () => { cancelled = true; };
    }, []);

    // Still loading. Rendering the empty state here would flash "no events" on
    // every page load before the real list arrives.
    if (events === null) return null;

    const cap = limit ?? settings?.homeLimit ?? 0;
    const visible = cap > 0 ? events.slice(0, cap) : events;
    const hasMore = cap > 0 && events.length > cap;

    const heading = settings?.heading || '';
    const badge = settings?.badgeText || '';
    const subtitle = settings?.subtitle || '';

    // Nothing to show and nothing to say about it: render nothing rather than an
    // empty band with a heading over it.
    if (!visible.length && !heading && !settings?.emptyText) return null;

    return (
        <section className="w-full py-24 bg-[#fafbfc]">
            <div className="container mx-auto px-4 md:px-8 max-w-7xl">

                {(badge || heading || subtitle) && (
                    <div className="flex flex-col items-center text-center mb-16">
                        {badge && (
                            <div className="inline-flex items-center space-x-2 bg-gray-100 rounded-full px-4 py-1.5 mb-6">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{badge}</span>
                            </div>
                        )}

                        {heading && (
                            <h2 className="text-4xl md:text-5xl font-serif text-[#1c2e68] mb-6">{heading}</h2>
                        )}

                        {subtitle && (
                            <div className="flex items-center space-x-4">
                                <div className="h-px w-10 bg-gray-400" />
                                <span className="text-sm font-medium text-gray-500 lowercase tracking-wider">
                                    {subtitle}
                                </span>
                                <div className="h-px w-10 bg-gray-400" />
                            </div>
                        )}
                    </div>
                )}

                {visible.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">{settings?.emptyText}</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
                        {visible.map((event) => (
                            <div
                                key={event.id}
                                className="bg-white rounded-[2rem] flex flex-col shadow-[0_8px_30px_rgb(0,0,0,0.04)]
                                           hover:shadow-xl transition-all duration-300 overflow-hidden"
                            >
                                {/* No image is a valid event; a broken frame is not. */}
                                {event.media?.url && (
                                    <div className="w-full h-56 overflow-hidden">
                                        {/* Honours the fit and focal point set in the CMS, so a
                                            portrait upload is not cropped to a strip here. */}
                                        <CmsMediaFrame
                                            media={event.media}
                                            className="hover:scale-105 transition-transform duration-700"
                                        />
                                    </div>
                                )}

                                <div className="p-8 flex flex-col flex-grow">
                                    {formatDate(event.startAt) && (
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">
                                            {formatDate(event.startAt)}
                                        </p>
                                    )}

                                    <h3 className={`text-2xl font-serif text-[#1c2e68] leading-snug ${
                                        event.description ? 'mb-3' : 'mb-8 flex-grow'
                                    }`}>
                                        {event.title}
                                    </h3>

                                    {/* Was captured in the CMS and rendered nowhere, which made it
                                        a field that quietly did nothing. */}
                                    {event.description && (
                                        <p className="text-sm text-gray-500 leading-relaxed mb-8 flex-grow line-clamp-3">
                                            {event.description}
                                        </p>
                                    )}

                                    <div className="flex items-center justify-between pt-6 border-t border-gray-100 mt-auto">
                                        <div className="flex items-center space-x-3 w-3/4">
                                            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center
                                                            justify-center shrink-0">
                                                <MapPin size={18} className="text-[#2563eb]" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-[#1c2e68] truncate pr-2">Location</p>
                                                <p className="text-[10px] text-gray-500 uppercase tracking-wide truncate pr-2">
                                                    {event.location || '—'}
                                                </p>
                                            </div>
                                        </div>

                                        <Link
                                            to="/events"
                                            aria-label={`More about ${event.title}`}
                                            className="w-10 h-10 rounded-full bg-gray-50 hover:bg-[#1c2e68] hover:text-white
                                                       flex items-center justify-center transition-colors shrink-0 group"
                                        >
                                            <ArrowRight size={18} className="text-gray-400 group-hover:text-white transition-colors" />
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Only offered when there is genuinely more to see. */}
                {showViewAll && hasMore && settings?.viewAllLabel && (
                    <div className="flex justify-center">
                        <Link
                            to={settings.viewAllHref || '/events'}
                            className="border-2 border-gray-200 hover:border-[#1c2e68] text-gray-600 hover:text-[#1c2e68]
                                       px-8 py-3 rounded-full font-bold text-xs uppercase tracking-widest transition-colors"
                        >
                            {settings.viewAllLabel}
                        </Link>
                    </div>
                )}
            </div>
        </section>
    );
}
