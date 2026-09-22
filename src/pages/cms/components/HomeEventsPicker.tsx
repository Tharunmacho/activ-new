import { useEffect, useState } from 'react';
import {
    Loader2, ExternalLink, CalendarDays, MapPin, Eye, EyeOff, Pencil,
} from 'lucide-react';
import {
    getCmsEvents, updateCmsEvent, invalidateCmsCache, errorMessage,
    type CmsEvent,
} from '@/services/cmsApi';
import { CmsEmpty, CmsError } from './CmsUI';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';

/**
 * ============================================================================
 * WHICH EVENTS THE HOME PAGE SHOWS
 * ============================================================================
 *
 * The strip on the landing page carries three events out of however many are
 * published, and which three used to be decided entirely by the sort — soonest
 * first. The person maintaining the site had no say in it, and no way to see
 * what was up there without opening the live page in another tab.
 *
 * This is both halves of that: the events, with their posters, as the home page
 * would order them, and a switch per row. `showOnHome` on the event is where
 * the answer lives, so it is the same answer whichever screen sets it.
 *
 * ---------------------------------------------------------------------------
 * IT SAVES ON THE SWITCH, NOT ON THE CARD'S SAVE BUTTON
 * ---------------------------------------------------------------------------
 *
 * The card around it writes the events SETTINGS — the heading, the caption, how
 * many. These rows write the EVENTS, one document each. Folding them into the
 * card's save would mean one button writing a dozen documents, and a failure
 * half way through leaving an editor with no idea which half landed.
 *
 * So a switch is its own write, the row shows it working, and a failure names
 * the row it happened on. The trade is that there is no undo — which is the
 * right trade for a flag whose effect is visible on the next page load.
 *
 * ---------------------------------------------------------------------------
 * NOTHING HERE DELETES A RECORD
 * ---------------------------------------------------------------------------
 *
 * There was a bin on every row and it deleted the real thing — from the home
 * page, from its own screen, from its URL and from the member app. On a card
 * whose only question is "does this belong on the home page", that is a
 * destructive action sitting a few pixels from a switch that answers the same
 * question harmlessly. Somebody tidying a landing page would eventually
 * destroy something with it.
 *
 * Taking it OFF is the switch. Deleting it is on the screen that owns it,
 * which the Edit link on every row reaches.
 *
 * ---------------------------------------------------------------------------
 * EVERY EVENT IS LISTED, SWITCHED-ON ONES FIRST
 * ---------------------------------------------------------------------------
 *
 * Every event is listed and every switch works. An event already held is
 * labelled as such on its row, because putting one on the landing page is a
 * choice worth making deliberately — but it is a label, not a block. The
 * band's heading is editable; whether something held in July belongs under it
 * is the association's call and not this component's.
 *
 * The switch shows what is STORED. It briefly showed a derived value that
 * also required the event to be upcoming, so two events stored as on were
 * drawn as off and no amount of clicking changed them.
 */

/** "3 Oct 2026", or nothing when the event has no date yet. */
const dayOf = (iso: string | null) => {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric',
        });
    } catch {
        return '';
    }
};

export function HomeEventsPicker({ onChanged }: {
    /**
     * Something here wrote an event.
     *
     * The Events screen renders this ABOVE its own table of the same events.
     * Without telling it, a switch flipped here would leave the row below
     * reading the opposite — two lists of one collection disagreeing on one
     * screen, which is the failure this whole feature was built to avoid.
     */
    onChanged?: () => void;
}) {
    const [events, setEvents] = useState<CmsEvent[] | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState<string | null>(null);

    const load = async () => {
        setError('');
        try {
            setEvents(await getCmsEvents());
        } catch (err) {
            setError(errorMessage(err, 'Could not load the events'));
            setEvents([]);
        }
    };

    /* Once, on mount. */
    useEffect(() => { load(); }, []);

    const toggle = async (event: CmsEvent, next: boolean) => {
        setBusy(event.id);
        setError('');
        try {
            await updateCmsEvent(event.id, { showOnHome: next });
            setEvents((list) => (list || []).map((e) =>
                (e.id === event.id ? { ...e, showOnHome: next } : e)));
            // The public strip reads the same cached list.
            invalidateCmsCache('events');
            onChanged?.();
        } catch (err) {
            setError(errorMessage(
                err,
                `Could not change "${event.title || 'that event'}"`,
            ));
        } finally {
            setBusy(null);
        }
    };

    if (events === null) {
        return (
            <p className="flex items-center gap-2 py-6 text-[1.0625rem] font-medium text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading the events…
            </p>
        );
    }

    /*
     * ON FIRST, and only an upcoming event can be on.
     *
     * `!== false` so an event saved before the flag existed counts as on.
     * An event with NO date is upcoming: an unset date is missing
     * information, not a statement that it already happened.
     *
     * Exactly the shape `HomeGalleryPicker` uses — see the note there.
     */
    const isPast = (e: CmsEvent) => {
        if (!e?.startAt) return false;
        const t = new Date(e.startAt).getTime();
        return !Number.isNaN(t) && t < Date.now();
    };
    const isOn = (e: CmsEvent) => e.showOnHome !== false;

    const on = events.filter(isOn);
    const ordered = [...events].sort((a, b) => Number(isOn(b)) - Number(isOn(a)));

    return (
        <div>
            <CmsError message={error} />

            {events.length === 0 ? (
                <CmsEmpty
                    title="No upcoming events"
                    hint="Post one under Events and it appears here, on the home page and on /events."
                />
            ) : (
                <>
                    {/*
                      * The count, said before the list.
                      *
                      * "Six ticked, three shown" is the thing an editor needs to
                      * know and the one thing a column of switches cannot say.
                      */}
                    <p className="mb-3 text-[1.0625rem] font-semibold text-slate-500 dark:text-neutral-400">
                        {on.length} of {events.length} events are switched on.
                        {on.length > 0 && (
                            <span>
                                {' '}All {on.length} {on.length === 1 ? 'appears' : 'appear'}
                                {' '}on the home page, soonest first.
                            </span>
                        )}
                        {on.length === 0 && (
                            <span className="text-amber-700 dark:text-amber-400">
                                {' '}The strip is empty on the home page.
                            </span>
                        )}
                    </p>

                    {/*
                      * Every switched-on event, plus a few of the rest — the
                      * cap `HomeGalleryPicker` uses, for the same reason: every
                      * event that IS on the page has to be reachable here, or
                      * it cannot be switched off from the screen showing it.
                      */}
                    <ul className="space-y-2.5">
                        {ordered.slice(0, Math.max(on.length + 4, 12)).map((event) => {
                            const past = isPast(event);
                            const shown = event.showOnHome !== false;
                            const live = isOn(event);

                            return (
                                <li
                                    key={event.id}
                                    className={`flex items-center gap-3 rounded-xl border p-3 transition-colors
                                                ${live
                                            ? 'border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20'
                                            : 'border-slate-200 bg-white dark:border-[#232323] dark:bg-[#0d0d0d]'}`}
                                >
                                    {/* The poster, at the shape the home card uses. */}
                                    <span className="h-14 w-20 shrink-0 overflow-hidden rounded-lg
                                                     bg-slate-100 dark:bg-[#161616]">
                                        {(event.media?.url || event.imageUrl) ? (
                                            <CmsMediaFrame
                                                media={event.media?.url
                                                    ? event.media
                                                    : { url: event.imageUrl, type: 'image', alt: '', fit: 'cover', position: 'center' }}
                                                width={160}
                                            />
                                        ) : (
                                            <span className="flex h-full w-full items-center justify-center
                                                             text-slate-300 dark:text-neutral-700">
                                                <CalendarDays className="h-5 w-5" />
                                            </span>
                                        )}
                                    </span>

                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-[1.125rem] font-bold text-slate-900 dark:text-white">
                                            {event.title || 'Untitled event'}
                                        </p>
                                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5
                                                      text-[1rem] font-medium text-slate-500 dark:text-neutral-400">
                                            <span className="inline-flex items-center gap-1">
                                                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                                                {dayOf(event.startAt) || 'Date to be confirmed'}
                                            </span>
                                            {event.location && (
                                                <span className="inline-flex min-w-0 items-center gap-1">
                                                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                                                    <span className="truncate">{event.location}</span>
                                                </span>
                                            )}
                                            {live && (
                                                <span className="font-bold text-blue-700 dark:text-blue-400">
                                                    on the home page now
                                                </span>
                                            )}
                                            {past && (
                                                <span className="font-bold text-amber-700 dark:text-amber-400">
                                                    already held
                                                </span>
                                            )}
                                        </p>
                                    </div>

                                    {/*
                                      Opens THIS event's form on the Events screen —
                                      see the `?event=` note there. The picture is
                                      changed on that form, which is where it was set;
                                      a second uploader here would be a second place to
                                      maintain the same thing.
                                    */}
                                    <a
                                        href={`/cms/events?event=${encodeURIComponent(event.id)}`}
                                        title="Open this event — its picture, date, venue and the rest"
                                        className="hidden shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5
                                                   text-[1rem] font-semibold text-blue-700 transition-colors
                                                   hover:bg-blue-50 sm:inline-flex
                                                   dark:text-blue-400 dark:hover:bg-blue-950/40"
                                    >
                                        <Pencil className="h-3.5 w-3.5" /> Edit
                                        <ExternalLink className="h-3 w-3" />
                                    </a>

                                    <button
                                        type="button"
                                        onClick={() => toggle(event, !shown)}
                                        disabled={busy === event.id}
                                        title={shown
                                            ? 'Take it off the home page'
                                            : 'Put it on the home page'}
                                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border
                                                    px-3 py-1.5 text-[1rem] font-bold transition-colors
                                                    disabled:opacity-40 ${live
                                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                                    + ' hover:bg-blue-100 dark:border-blue-900'
                                                    + ' dark:bg-blue-950/30 dark:text-blue-300'
                                                : 'border-slate-300 bg-white text-slate-500 hover:bg-slate-100'
                                                    + ' dark:border-[#2a2a2a] dark:bg-[#111] dark:text-neutral-400'}`}
                                    >
                                        {busy === event.id
                                            ? <Loader2 className="h-4 w-4 animate-spin" />
                                            : live ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                        {live ? 'On' : 'Off'}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>

                    {/*
                      * No “Add an event” here.
                      *
                      * This card answers one question — which of the events
                      * that exist belong on the home page — and the switch is
                      * the whole of the answer. A button that navigated away to
                      * a blank form made adding an event look like part of
                      * choosing one, which is a different job on a different
                      * screen. “Manage the events” in the card header goes there.
                      */}
                    <p className="mt-4 text-[1rem] font-medium text-slate-400">
                        {ordered.length > Math.max(on.length + 4, 12)
                            ? `Showing the switched-on events and a few more, of ${events.length}. `
                            : ''}
                        A switch saves on its own, straight away — it writes the event, not
                        this card. Off takes it off the home page and leaves it on /events;
                        to delete one, open it with Edit.
                    </p>
                </>
            )}
        </div>
    );
}
