import { useEffect, useState } from 'react';
import { HeaderSection } from '../../components/layout/HeaderSection';
import { FooterSection } from '../../components/layout/FooterSection';
import { EventsHero } from './components/EventsHero';
import { EventsExplorer } from './components/EventsExplorer';
import { PAGE_CONTAINER } from '../../components/layout/pageContainer';
import {
    getCmsEvents, getEventsSettings, type CmsEvent, type EventsSettings,
} from '../../services/cmsApi';

/**
 * The dedicated Events page.
 *
 * The list and the copy are fetched once, here, and handed to both children.
 * The hero needs the settings and the explorer needs both, and letting each
 * fetch for itself would mean two requests for the same document and a hero
 * that pops in a beat after the grid it sits above.
 *
 * The home page does NOT render these. It keeps `EventsGrid` — three cards and
 * a link onward — because a hero band, a search toolbar and a filter rail are a
 * page, not a section, and the home page already has its own.
 */
export default function EventsPage() {
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

    return (
        <div className="flex min-h-screen flex-col bg-white font-sans">
            <HeaderSection />

            {isLoading ? (
                /* Shaped like what is coming — a dark band with a light card
                   lifted onto its edge — so the page does not jump when it
                   arrives. */
                <>
                    <div className="h-[26rem] w-full animate-pulse bg-brand-900" />
                    <div className={PAGE_CONTAINER}>
                        <div className="-mt-10 h-20 animate-pulse rounded-2xl bg-white shadow-lg ring-1 ring-brand-100" />
                        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="h-80 animate-pulse rounded-2xl bg-slate-100" />
                            ))}
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <EventsHero settings={settings} />
                    <EventsExplorer events={events || []} settings={settings} />
                </>
            )}

            <FooterSection />
        </div>
    );
}
