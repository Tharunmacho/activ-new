import EventFilters from '@/components/shared/EventFilters';
import { EMPTY_EVENT_FILTERS, matchesEventFilters } from '@/lib/eventFilters';
import { useEventClock } from '@/lib/useEventClock';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Ticket } from 'lucide-react';
import MemberPageShell from '@/pages/member/MemberPageShell';
import { EmptyState, RowsSkeleton } from '@/features/member/components/MemberUI';
import EventRow from '@/features/member/components/EventRow';
import { isPast } from '@/features/member/components/eventFormat';
import { listMemberEvents, type MemberEvent } from '@/services/memberHubApi';
import { errorMessage } from '@/services/activApi';

/**
 * The member events programme (EVT-001).
 *
 * Three tabs, and the third is the reason this screen exists rather than a link
 * to the public events page: "My registrations" is a fact about this member
 * that the public page cannot know, and members-only events never appear there
 * at all — `cms.service.listEvents` filters `audience: 'paid'` out of the public
 * listing on purpose.
 *
 * Upcoming leads and is ordered soonest-first. The API returns newest-first,
 * which is right for an archive and exactly wrong for a programme: it puts next
 * year's conference above next week's meeting.
 */

type Tab = 'upcoming' | 'past' | 'mine';

export default function MemberEvents() {
    const now = useEventClock();
    const [events, setEvents] = useState<MemberEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [tab, setTab] = useState<Tab>('upcoming');
    const [filters, setFilters] = useState({ ...EMPTY_EVENT_FILTERS });

    useEffect(() => {
        let cancelled = false;

        listMemberEvents()
            .then((data) => { if (!cancelled) setEvents(data?.events || []); })
            .catch((err) => {
                if (!cancelled) setError(errorMessage(err, 'Could not load events'));
            })
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, []);

    const at = (event: MemberEvent) => (event.startAt ? new Date(event.startAt).getTime() : 0);

    const upcoming = useMemo(
        () => (events || []).filter((event) => !isPast(event, now)).sort((a, b) => at(a) - at(b)),
        [events, now],
    );

    const past = useMemo(
        () => (events || []).filter(event => isPast(event, now)).sort((a, b) => at(b) - at(a)),
        [events, now],
    );

    /**
     * The events this member holds a seat at.
     *
     * Derived from the list rather than fetched from `/events/my-registrations`:
     * every event in the list already carries `myRegistration`, so a second
     * request would be asking the server something it has just answered. A
     * cancelled seat is not a registration.
     */
    const mine = useMemo(
        () => (events || [])
            .filter((event) => event.myRegistration && event.myRegistration.status !== 'cancelled')
            .sort((a, b) => at(a) - at(b)),
        [events, now],
    );

    const TABS: { key: Tab; label: string; count: number }[] = [
        { key: 'upcoming', label: 'Upcoming', count: upcoming.length },
        { key: 'mine', label: 'My registrations', count: mine.length },
        { key: 'past', label: 'Past', count: past.length },
    ];

    const rows = (tab === 'upcoming' ? upcoming : tab === 'past' ? past : mine).filter(e => matchesEventFilters(e, filters));

    const EMPTY: Record<Tab, { title: string; detail: string }> = {
        upcoming: {
            title: 'Nothing scheduled',
            detail: 'Events published by the association will appear here, with the full programme.',
        },
        past: {
            title: 'No past events',
            detail: 'Events that have finished stay here so you can look back at the programme.',
        },
        mine: {
            title: 'You have not registered for any events yet',
            detail: 'Events you book — here or on the ACTIV website with this email — appear here with your ticket.',
        },
    };

    return (
        <MemberPageShell title="Events" subtitle="The association programme" width="standard">
            <div className="space-y-5">
                {/*
                  * A responsive flex row, not a scrolling strip: three tabs must
                  * fit side by side at every width the member area supports.
                  */}
                <div className="flex gap-1.5 bg-white rounded-2xl border border-slate-200 shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)] p-1.5">
                    {TABS.map(({ key, label, count }) => {
                        const active = tab === key;
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setTab(key)}
                                className={`flex-1 min-w-0 px-2 py-2.5 rounded-xl text-[1.0625rem] font-semibold
                                            transition-colors flex items-center justify-center gap-1.5 ${
                                    active
                                        ? 'bg-blue-600 text-white'
                                        : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                <span className="truncate">{label}</span>
                                {count > 0 ? (
                                    <span className={`shrink-0 text-[1.0625rem] font-bold px-1.5 rounded-full ${
                                        active ? 'bg-white/25' : 'bg-slate-200 text-slate-600'
                                    }`}>
                                        {count}
                                    </span>
                                ) : null}
                            </button>
                        );
                    })}
                </div>

                <EventFilters events={events} value={filters} onChange={setFilters} />
                {loading ? (
                    <RowsSkeleton rows={3} />
                ) : error ? (
                    <EmptyState
                        icon={<CalendarDays className="w-6 h-6" />}
                        title="Events could not be loaded"
                        detail={error}
                    />
                ) : rows.length === 0 ? (
                    <EmptyState
                        icon={tab === 'mine' ? <Ticket className="w-6 h-6" /> : <CalendarDays className="w-6 h-6" />}
                        title={Object.values(filters).some(Boolean) ? 'No matching events' : EMPTY[tab].title}
                        detail={Object.values(filters).some(Boolean) ? 'Try a wider date range or clear your filters.' : EMPTY[tab].detail}
                        action={tab === 'mine' && upcoming.length > 0 ? (
                            <button
                                type="button"
                                onClick={() => setTab('upcoming')}
                                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-blue-600 px-4 font-semibold text-white"
                            >
                                See all events
                            </button>
                        ) : tab === 'mine' ? (
                            <Link to="/events" className="font-semibold text-blue-700 hover:underline">Browse the events programme</Link>
                        ) : undefined}
                    />
                ) : (
                    /*
                     * Compact rows across the full width, like the paid
                     * dashboard's Upcoming Events — not a two-column grid of
                     * poster cards that showed three events a screen.
                     */
                    <div className="space-y-3">
                        {rows.map((event) => <EventRow key={event.id} event={event} />)}
                    </div>
                )}
            </div>
        </MemberPageShell>
    );
}
