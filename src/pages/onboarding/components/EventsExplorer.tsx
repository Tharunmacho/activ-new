import { PosterFrame } from '@/components/shared/PosterFrame';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Clock, CalendarDays, ArrowRight, X, Landmark, Video } from 'lucide-react';
import type { CmsEvent, EventsSettings } from '@/services/cmsApi';
import { CmsIcon } from '@/components/shared/CmsIcon';
import { Reveal } from '@/components/shared/Reveal';
import { sectionHidden, sectionFields } from '@/components/shared/cmsSections';
import { CmsExtraFields } from '@/components/shared/CmsExtraFields';
import { SectionFields } from '@/components/shared/SectionFields';
import { Tilt3D } from '@/components/shared/Tilt3D';
import { SCREEN_CONTAINER } from '@/components/layout/pageContainer';
import { CARD_TITLE, CARD_BODY, MICRO_LABEL } from '@/components/layout/typography';
import { eventPath } from '@/lib/eventPath';

/**
 * The Events page's search, filters and grid.
 *
 * Deliberately NOT built like the gallery, which is the other filterable grid
 * on the site. Sharing a component between them was the obvious move and the
 * wrong one: the two pages would then differ only by their data, and a visitor
 * moving from one to the other would see the same page twice with different
 * pictures in it. They are kept apart on purpose —
 *
 *   gallery : chips centred as free-standing pills, tiles four across, a photo
 *             with a caption under it, "view more" expands in place.
 *   events  : a toolbar lifted onto the hero's edge, chips as a segmented rail
 *             on one line, cards five across carrying a date block over the
 *             photograph, and a text link out of each one.
 *
 * All filtering is client-side over the list already fetched. The public events
 * list is small, bounded by what an editor publishes, and a round trip per
 * keystroke would be slower than the filter it replaced.
 */

/**
 * ==========================================================================
 * THIS PAGE IS UPCOMING EVENTS.
 * ==========================================================================
 *
 * There was a date-window filter here — Upcoming / Past / All dates — and a
 * past event reached this page whenever it was set to one of the last two.
 * Both are gone, and the removal is the FILTER and the EVENTS together:
 * leaving the filter while hiding the rows would be a control that can only
 * ever return nothing.
 *
 * The association's reasoning, and it is worth keeping: an events page is
 * something a visitor reads to decide what to attend. The home page's events
 * band shows exactly this same list (`EventsGrid`), so the two never disagree.
 *
 * EVENTS AND THE GALLERY ARE SEPARATE. There used to be a strip here sending
 * visitors to the gallery for past events, and a CMS button copying an event
 * into the gallery. Both are gone: the gallery holds photographs the editor
 * posts after an event, as albums of its own, and nothing links the two.
 *
 * So `upcomingOnly` below is not a default an editor can change — it is
 * what this page IS. An event with no date at all still shows: an unset
 * date is missing information, not a statement that it already happened.
 */

/**
 * How you attend it — a filter of its own, beside the category chips.
 *
 * NOT a chip in that rail, and that is the point. The chips are `category`:
 * what KIND of event it is, a list the CMS authors. This is `mode`: whether
 * there is a room to go to. They are independent — there are online workshops
 * and offline workshops — and folding one into the other is exactly what put
 * "ZOOM" and "Webinars" into the category list beside "Tea party".
 *
 * As a select rather than a third rail of pills because it is the coarsest and
 * least-used of the three, and the toolbar already carries a chip rail and four
 * dropdowns.
 */
const HOW = [
    { value: 'all', label: 'Online and in person' },
    { value: 'offline', label: 'In person' },
    { value: 'online', label: 'Online' },
] as const;

type How = (typeof HOW)[number]['value'];

const ALL = 'All';

/**
 * Region matching, in the browser, on the same terms the server uses.
 *
 * Region names are free text a Super Admin typed (see the admin-first region
 * architecture note in CLAUDE.md), so "Tamil Nadu" and "tamil  nadu" are one
 * place to a reader and two strings to `===`. `regionMatch.js` normalises
 * exactly this way — trim, collapse runs of whitespace, case-fold — and the two
 * have to agree or the public page's filter and the dashboards' filter would
 * disagree about which events belong to a district.
 */
const norm = (value?: string) => (value || '').trim().replace(/\s+/g, ' ').toLowerCase();

interface Region { state: string; district: string; block: string }

const LEVELS = ['state', 'district', 'block'] as const;

/**
 * Every region one event was aimed at, as a list.
 *
 * `targets` is the real answer; the legacy `state`/`district`/`block` trio is
 * the fallback for rows written before multi-targeting, which carry their one
 * region there. An empty list means the event was aimed at everybody — which is
 * why this returns `[]` rather than `[{'', '', ''}]`: the two are handled
 * differently by the filter below, and collapsing them would make "everywhere"
 * look like a region that matches nothing.
 */
const regionsOf = (event: CmsEvent): Region[] => {
    const list = Array.isArray(event?.targets) ? event.targets : [];
    if (list.length) {
        return list.map((t) => ({
            state: t?.state || '', district: t?.district || '', block: t?.block || '',
        }));
    }
    if (event?.state) {
        return [{ state: event.state, district: event.district || '', block: event.block || '' }];
    }
    return [];
};

/**
 * Does an event aimed at `target` belong in a visitor's view of `selection`?
 *
 * Yes when the two are on the SAME PATH — for each of state, district and block,
 * either side may be silent, but where both name something they must name the
 * same thing.
 *
 * That symmetry is the whole point, and neither "target contains selection" nor
 * "selection contains target" gets it right on its own:
 *
 *   picked Kalayarkoil, event aimed at Tamil Nadu     -> RELEVANT. A state-wide
 *      notice is for the people in that block as much as for anyone else.
 *   picked Sivaganga, event aimed at Kalayarkoil      -> RELEVANT. Narrowing to
 *      a district should surface what is happening inside it, not just what was
 *      addressed to the district as a whole.
 *   picked Sivaganga, event aimed at Chennai          -> NOT. Both named a
 *      district and they differ.
 */
const onSamePath = (target: Region, selection: Region) =>
    LEVELS.every((level) => {
        const a = norm(target[level]);
        const b = norm(selection[level]);
        return !a || !b || a === b;
    });

/** Split for the date block: the three lines are stacked, not one string. */
const splitDate = (iso: string | null) => {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return {
        day: date.toLocaleDateString('en-GB', { day: '2-digit' }),
        month: date.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase(),
        year: String(date.getFullYear()),
    };
};

/**
 * "– 12 OCT 2026" for an event that runs over more than one day, else ''.
 *
 * The date chip on the card holds ONE day and is three stacked lines, so a
 * range cannot go in it. This is the extra line under the time. It compares
 * the rendered days rather than the instants because `endAt` also carries the
 * finishing TIME of a single-day event, and comparing instants would print a
 * range on every event with a closing time.
 */
const lastDayLabel = (startAt: string | null, endAt: string | null) => {
    const day = (iso: string | null) => {
        if (!iso) return '';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '';
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            .toUpperCase();
    };
    const from = day(startAt);
    const to = day(endAt);
    return to && to !== from ? to : '';
};

/** "10:00 AM - 05:00 PM", or just the start when no end was set. */
const formatTimeRange = (startAt: string | null, endAt: string | null) => {
    const time = (iso: string | null) => {
        if (!iso) return '';
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })
            .toUpperCase();
    };
    const from = time(startAt);
    const to = time(endAt);
    if (!from) return '';
    return to ? `${from} - ${to}` : from;
};

interface Props {
    events: CmsEvent[];
    settings: EventsSettings | null;
}

/**
 * HOW WIDE THE EVENTS ROW RUNS, PER COUNT.
 *
 * Two things had to be true at once and only one of them was. Five fixed tracks
 * keeps every card the same size, and four events then stop a card's width short
 * of the right-hand edge — which reads as a card that failed rather than as a
 * month with four events in it. Tracks that narrow to the count fill the row,
 * and three events across a 1600px page become billboards.
 *
 * So the track count narrows AND the row is capped and centred with it, which
 * holds the card inside one narrow band of widths whatever the count. It is the
 * same rule, for the same reason, as the leadership benches — see `rowClass` in
 * `LeadershipSections`.
 */
const EVENT_GRID: Record<number, string> = {
    1: 'xl:grid-cols-1 xl:max-w-[26rem] xl:mx-auto',
    2: 'xl:grid-cols-2 xl:max-w-[54rem] xl:mx-auto',
    3: 'xl:grid-cols-3 xl:max-w-[82rem] xl:mx-auto',
    4: 'xl:grid-cols-4 xl:max-w-[110rem] xl:mx-auto',
    /*
     * Four abreast, and five only on a display wide enough for it.
     *
     * The caps above went up with the column: this page runs to the screen's
     * edge now (`SCREEN_CONTAINER`), so a row of three capped at 70rem sat in
     * the middle of a 1730px band with a third of it empty either side. Five
     * tracks at 1440 is a 250px card, which is where a real title starts
     * losing its last word to the ellipsis -- hence `2xl` for the fifth.
     */
    5: 'xl:grid-cols-4 2xl:grid-cols-5',
};

export function EventsExplorer({ events, settings }: Props) {
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<string>(ALL);
    const [location, setLocation] = useState<string>(ALL);

    const [how, setHow] = useState<How>('all');

    /*
     * The region filter, as three dependent choices rather than one flat list.
     *
     * State first, then the districts of that state, then the blocks of that
     * district — the same cascade the Super Admin fills in when they create an
     * admin, and the same order the region picker on the event form uses. A
     * single "All regions" dropdown was the obvious cheaper option and is the
     * wrong shape for this data: there are 38 districts in Tamil Nadu alone and
     * several thousand blocks under them, so one list is unreadable and one that
     * ignores the hierarchy puts "Chennai" and "Kalayarkoil" side by side with
     * nothing to say that one is inside the other.
     *
     * Held as three pieces of state and not one object because each has to be
     * cleared when the level above it changes, and that is a conditional per
     * level whichever way it is stored.
     */
    const [state, setState] = useState<string>(ALL);
    const [district, setDistrict] = useState<string>(ALL);
    const [block, setBlock] = useState<string>(ALL);

    /* The Search-and-chips card can be removed — see `cmsSections`. It takes
       the chips with it; the search box is not authored and stays. */
    const chips = sectionHidden(settings?.sections, 'events.filters')
        ? []
        : (settings?.categories || []);

    /**
     * The location options come from the events themselves, not the CMS.
     *
     * A hand-maintained list would go stale the moment an event moved venue,
     * and would offer cities with nothing in them. Derived, the dropdown can
     * only ever offer a filter that matches something.
     */
    const locations = useMemo(() => {
        const seen = new Set<string>();
        (events || []).forEach((e) => {
            const value = (e?.location || '').trim();
            if (value) seen.add(value);
        });
        return Array.from(seen).sort((a, b) => a.localeCompare(b));
    }, [events]);

    /**
     * Every region any event on this page was aimed at, flattened once.
     *
     * Derived from the events for the same reason the location list is: a
     * hand-kept list of regions would offer districts with nothing in them and
     * would go stale the moment a region was renamed in the admin collections.
     * Here, a region is offered exactly when something is happening in it.
     *
     * Recomputed only when the events change — the three dropdowns read slices
     * of this, so choosing a state does not rebuild the index.
     */
    const regionIndex = useMemo(
        () => (events || []).flatMap((event) => regionsOf(event)),
        [events],
    );

    /**
     * The options at each level, narrowed by the levels above.
     *
     * `uniq` keeps the first spelling it meets of each region and compares on
     * the normalised form, so two events whose editors typed "Tamil Nadu" and
     * "Tamil  Nadu" contribute ONE option rather than two that each hide half
     * the programme.
     */
    const uniq = (values: string[]) => {
        const seen = new Map<string, string>();
        values.forEach((value) => {
            const key = norm(value);
            if (key && !seen.has(key)) seen.set(key, (value || '').trim());
        });
        return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
    };

    const stateOptions = useMemo(
        () => uniq(regionIndex.map((r) => r.state)),
        [regionIndex],
    );

    const districtOptions = useMemo(() => {
        if (state === ALL) return [];
        return uniq(regionIndex.filter((r) => norm(r.state) === norm(state)).map((r) => r.district));
    }, [regionIndex, state]);

    const blockOptions = useMemo(() => {
        if (state === ALL || district === ALL) return [];
        return uniq(regionIndex
            .filter((r) => norm(r.state) === norm(state) && norm(r.district) === norm(district))
            .map((r) => r.block));
    }, [regionIndex, state, district]);

    /*
     * Choosing a wider region clears the narrower ones inside it.
     *
     * Without this, switching from Tamil Nadu to Kerala keeps "Sivaganga"
     * selected and the grid empties — a filter naming a district that is not in
     * the chosen state can never match anything, and the page gives the visitor
     * no clue why. Done in the handlers rather than in an effect so the reset is
     * part of the click that caused it.
     */
    const pickState = (value: string) => {
        setState(value);
        setDistrict(ALL);
        setBlock(ALL);
    };

    const pickDistrict = (value: string) => {
        setDistrict(value);
        setBlock(ALL);
    };

    const filtered = useMemo(() => {
        const needle = (query || '').trim().toLowerCase();
        const now = Date.now();
        const regionPicked = state !== ALL || district !== ALL || block !== ALL;
        const selection: Region = {
            state: state === ALL ? '' : state,
            district: district === ALL ? '' : district,
            block: block === ALL ? '' : block,
        };

        return (events || []).filter((event) => {
            if (category !== ALL && (event?.category || '') !== category) return false;
            if (location !== ALL && (event?.location || '') !== location) return false;

            /*
             * Online or in person.
             *
             * Anything that is not explicitly `online` is in person, which is
             * every event written before the field existed — so filtering to
             * "In person" shows the whole back catalogue rather than hiding it
             * behind a field those rows never had.
             */
            if (how !== 'all' && (event?.mode === 'online' ? 'online' : 'offline') !== how) return false;

            /*
             * Region.
             *
             * An UNTARGETED event passes every region filter, and that is not a
             * shortcut — empty means "the whole association", so a national
             * announcement is genuinely part of what is happening in Sivaganga.
             * Hiding it when a visitor narrows to their own district would make
             * the filter subtract the events that matter most.
             */
            if (regionPicked) {
                const regions = regionsOf(event);
                if (regions.length && !regions.some((target) => onSamePath(target, selection))) {
                    return false;
                }
            }

            /*
             * Upcoming only — see the note at the top of this file. An event
             * with no usable date is kept: an unset date is missing
             * information, not a statement that it already happened.
             *
             * THE END DATE DECIDES IT, where there is one. A three-day
             * conclave read as past from its second morning, because this
             * asked when it STARTED. An event is over when it is over.
             */
            const finish = event?.endAt || event?.startAt;
            const start = finish ? new Date(finish).getTime() : NaN;
            if (!Number.isNaN(start) && start < now) return false;

            if (needle) {
                const haystack = [event?.title, event?.description, event?.location, event?.category]
                    .map((v) => (v || '').toLowerCase())
                    .join(' ');
                if (!haystack.includes(needle)) return false;
            }
            return true;
        });
        /*
         * `how` IS IN HERE, and was not.
         *
         * The filter body has always read it, so the first render was
         * right and every change after it did nothing: picking “In person”
         * left the grid exactly as it was. A `useMemo` recomputes only
         * when something in this list changes, so a value used inside and
         * missing from it is a control wired to nothing.
         */
    }, [events, query, category, location, how, state, district, block]);

    const isFiltered = !!(query.trim()) || category !== ALL || location !== ALL
        || how !== 'all' || state !== ALL || district !== ALL || block !== ALL;

    const reset = () => {
        setQuery('');
        setCategory(ALL);
        setLocation(ALL);
        setHow('all');
        setState(ALL);
        setDistrict(ALL);
        setBlock(ALL);
    };

    /**
     * What the visitor narrowed by, for the empty-state sentence.
     *
     * Region is named before the coarser filters and from the NARROWEST level
     * chosen: someone who drilled to a block and found nothing is looking for
     * the block's name in that sentence, not their state's.
     */
    const describeFilter = () => {
        if (query.trim()) return `"${query.trim()}"`;
        if (block !== ALL) return block;
        if (district !== ALL) return district;
        if (state !== ALL) return state;
        if (category !== ALL) return category;
        if (location !== ALL) return location;
        return 'that filter';
    };

    const emptyFiltered = (settings?.emptyFilterText || 'No events match {query}.')
        .replace('{query}', describeFilter());

    const banner = sectionHidden(settings?.sections, 'events.banner') ? undefined : settings?.banner;
    /* The explorer's own type, handed down — see `SectionFields`. */
    const fieldsFor = (k: string) => (
        <SectionFields
            proseClass={`${CARD_BODY} text-gray-600`}
            sections={settings?.sections}
            sectionKey={k}
        />
    );
    const showBanner = !!(banner?.enabled && (banner.title || banner.ctaLabel));


    /* The editor's own rows, per card, then the page's own list. */
    const key = (k: string) => (sectionHidden(settings?.sections, k) ? [] : sectionFields(settings?.sections, k));
    /*
     * Each card's rows are drawn WITH that card now — see `SectionFields`.
     * They were pooled here and printed once under the grid, so a field added
     * to "Filters" appeared at the foot of the explorer instead of with the
     * filters. What is left is the list attached to the PAGE.
     */
    const ownRows = settings?.extraFields || [];

    const selectClass =
        'h-12 min-w-0 rounded-xl border border-brand-100 bg-white px-4 text-[1.25rem] font-semibold '
        + 'text-brand-800 outline-none transition-colors hover:border-brand-300 '
        + 'focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15';

    return (
        <section className="w-full dot-band font-sans">
            <div className={SCREEN_CONTAINER}>

                {/* ---------------------------------------------------- toolbar */}
                {/*
                  Lifted onto the hero's bottom edge. That overlap is what makes
                  the search read as belonging to the band above it rather than
                  as the first row of the grid below — and it is the single most
                  recognisable difference from the gallery, whose chips simply
                  start the content column.
                */}
                <div className="-mt-10 relative z-20 rounded-2xl bg-white p-3 md:p-4
                                shadow-[0_24px_60px_-24px_rgb(28_46_104/0.45)] ring-1 ring-brand-100">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">

                        <label className="relative flex-1 min-w-0">
                            <span className="sr-only">Search events</span>
                            <Search
                                size={19}
                                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400"
                            />
                            <input
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={settings?.searchPlaceholder || 'Search events...'}
                                className="h-12 w-full rounded-xl border border-brand-100 bg-white pl-11 pr-3.5
                                           text-[1.25rem] font-medium text-brand-800 placeholder:text-gray-400
                                           outline-none transition-colors hover:border-brand-300
                                           focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15"
                            />
                        </label>

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex lg:items-center">
                            {/* Offered only when the CMS has chips to offer. */}
                            {chips.length > 0 && (
                                <select
                                    aria-label="Category"
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className={selectClass}
                                >
                                    <option value={ALL}>All categories</option>
                                    {chips.map((c, i) => (
                                        <option key={i} value={c.label}>{c.label}</option>
                                    ))}
                                </select>
                            )}

                            {locations.length > 0 && (
                                <select
                                    aria-label="Location"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    className={selectClass}
                                >
                                    <option value={ALL}>All locations</option>
                                    {locations.map((l, i) => (
                                        <option key={i} value={l}>{l}</option>
                                    ))}
                                </select>
                            )}

                            {/*
                              STATE, THEN DISTRICT, THEN BLOCK -- in that order,
                              left to right, and each appearing only once the one
                              before it has been answered.

                              Progressive rather than three dropdowns always on
                              screen. On a page whose toolbar already holds a
                              search, a category and a date window, three more
                              permanently-visible selects would be six controls
                              for a visitor who wants "events near me", and two
                              of the three would be disabled and unexplained
                              until the state was chosen. Revealed in sequence,
                              the row grows by exactly as much as the visitor has
                              asked for.

                              Offered at all only when the events on this page
                              carry regions. An association posting everything
                              nationally never sees a region filter, rather than
                              seeing one with a single option in it.
                            */}
                            {stateOptions.length > 0 && (
                                <select
                                    aria-label="State"
                                    value={state}
                                    onChange={(e) => pickState(e.target.value)}
                                    className={selectClass}
                                >
                                    <option value={ALL}>All states</option>
                                    {stateOptions.map((s, i) => (
                                        <option key={i} value={s}>{s}</option>
                                    ))}
                                </select>
                            )}

                            {districtOptions.length > 0 && (
                                <select
                                    aria-label="District"
                                    value={district}
                                    onChange={(e) => pickDistrict(e.target.value)}
                                    className={selectClass}
                                >
                                    <option value={ALL}>All districts</option>
                                    {districtOptions.map((d, i) => (
                                        <option key={i} value={d}>{d}</option>
                                    ))}
                                </select>
                            )}

                            {blockOptions.length > 0 && (
                                <select
                                    aria-label="Block"
                                    value={block}
                                    onChange={(e) => setBlock(e.target.value)}
                                    className={selectClass}
                                >
                                    <option value={ALL}>All blocks</option>
                                    {blockOptions.map((b, i) => (
                                        <option key={i} value={b}>{b}</option>
                                    ))}
                                </select>
                            )}

                            {/* The date window used to sit here. See the note at
                                the top of this file: this page is upcoming events,
                                so there is no window left to choose. */}
                            <select
                                aria-label="Online or in person"
                                value={how}
                                onChange={(e) => setHow(e.target.value as How)}
                                className={selectClass}
                            >
                                {HOW.map((h) => (
                                    <option key={h.value} value={h.value}>{h.label}</option>
                                ))}
                            </select>

                            {/* Only offered once there is something to undo. */}
                            {isFiltered && (
                                <button
                                    type="button"
                                    onClick={reset}
                                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl
                                               border border-brand-100 px-5 text-[1.25rem] font-bold text-brand-700
                                               transition-colors hover:border-brand-600 hover:bg-brand-50"
                                >
                                    <X size={17} />
                                    Reset
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* This card's own rows, with the card — see `SectionFields`. */}
                {fieldsFor('events.filters')}

                {/* ------------------------------------------------ chip rail */}
                {chips.length > 0 && (
                    <div className="mt-8 -mx-4 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
                        {/*
                          A segmented rail — one inset track with the active chip
                          raised out of it in white. The gallery's chips are
                          free-standing outlined pills that fill solid when
                          active; this is the inverse, so the two filter rows do
                          not read as the same control.
                        */}
                        <div className="inline-flex min-w-full gap-1 rounded-2xl bg-brand-50 p-1.5 md:min-w-0">
                            {[{ label: ALL, icon: '' }, ...chips].map((chip, i) => {
                                const active = category === chip.label;
                                return (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => setCategory(chip.label)}
                                        className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl
                                                    px-5 py-3 text-[1.25rem] font-bold transition-all duration-200 ${
                                            active
                                                ? 'bg-white text-brand-800 shadow-[0_6px_16px_-6px_rgb(28_46_104/0.5)]'
                                                : 'text-brand-600/80 hover:text-brand-800'
                                        }`}
                                    >
                                        {chip.icon && (
                                            <CmsIcon
                                                name={chip.icon}
                                                size={18}
                                                className={active ? 'text-brand-600' : 'text-brand-400'}
                                                fallback="calendar-days"
                                            />
                                        )}
                                        {chip.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ----------------------------------------------------- grid */}
                {filtered.length === 0 ? (
                    <p className="py-20 text-center text-[1.375rem] font-semibold text-gray-500">
                        {isFiltered ? emptyFiltered : (settings?.emptyText || '')}
                    </p>
                ) : (
                    /*
                      * THE ROW FILLS, AND THE CARDS KEEP ONE SIZE.
                      *
                      * Five tracks and four events left a card's width of white
                      * at the right-hand end of the row, which reads as a card
                      * that failed to load rather than as a month with four
                      * events in it. The track count comes down to the number
                      * there are — and the ROW is capped and centred with it, so
                      * a grid of three does not blow each card up to a third of
                      * a 1600px page. Same rule, same reasons, as the leadership
                      * benches; see `rowClass` in `LeadershipSections`.
                      */
                    <div className={`mt-10 grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
                                     ${EVENT_GRID[Math.min(5, Math.max(1, filtered.length))]
                                        || EVENT_GRID[5]}`}>
                        {filtered.map((event, i) => {
                            const date = splitDate(event?.startAt);
                            const time = formatTimeRange(event?.startAt, event?.endAt);
                            const lastDay = lastDayLabel(event?.startAt, event?.endAt);

                            /*
                              WHO THE EVENT IS FOR, on the card.
                              
                              The venue line under it says where to turn up; this
                              says which part of the association it belongs to,
                              and they are routinely different — a state-level
                              conclave for Tamil Nadu held at a hall in Chennai.
                              Without it, a visitor who filtered to their district
                              has no way to tell whether a result is theirs or is
                              a national announcement that passes every region
                              filter.

                              The FIRST region as a breadcrumb, with a count for
                              the rest — not the server's `targetLabel`, which
                              joins every scope with commas. That reads well in a
                              table on an admin screen and not at all here: five
                              across, a card is about 220px wide, and an event
                              aimed at eight blocks would fill it with region
                              names and push the title out of the card. One
                              breadcrumb and "+7 more" says the same thing in the
                              space available.

                              Nothing is drawn for an untargeted event.
                              "Everyone" on every card is a badge carrying no
                              information.
                            */
                            const regions = regionsOf(event);
                            const reach = regions.length
                                ? LEVELS.map((level) => regions[0][level]).filter(Boolean).join(' › ')
                                : '';
                            const extraRegions = Math.max(regions.length - 1, 0);

                            return (
                                <Reveal
                                    key={event?.id || i}
                                    delay={Math.min(i % 5, 4) * 70}
                                    className="h-full"
                                >
                                    <Tilt3D className="h-full" intensity={8} lift={1.02} glare={false} perspective={850}>
                                        {/*
                                          * THE WHOLE CARD OPENS THE EVENT.
                                          *
                                          * Only the small "View Details" line was a
                                          * link, so a visitor who clicked the
                                          * photograph, the title or the price — which
                                          * is most of them — got nothing. The gallery
                                          * tiles have always opened from anywhere on
                                          * the tile, and an events card that looks the
                                          * same and behaves differently is the kind of
                                          * difference nobody learns, they just decide
                                          * the site is broken.
                                          *
                                          * A `relative` article with a stretched
                                          * overlay link rather than wrapping the card
                                          * in an `<a>`: wrapping would put the whole
                                          * card's text into the link's accessible
                                          * name, and a screen reader would read the
                                          * date, price, venue and blurb as one
                                          * enormous link label. The overlay carries
                                          * its own short name and the card keeps its
                                          * semantics.
                                          */}
                                        <article
                                            className="group relative flex h-full flex-col overflow-hidden rounded-2xl
                                                       border border-brand-100/80 bg-white
                                                       shadow-[0_10px_36px_-16px_rgb(28_46_104/0.22)]
                                                       transition-shadow duration-500
                                                       hover:shadow-[0_28px_60px_-20px_rgb(28_46_104/0.42)]
                                                       focus-within:ring-2 focus-within:ring-brand-500
                                                       focus-within:ring-offset-2"
                                        >
                                            <Link
                                                to={eventPath(event)}
                                                aria-label={`More about ${event?.title || 'this event'}`}
                                                /* `z-10` sits under nothing else on the card, and
                                                   `focus:outline-none` because the ring is drawn on
                                                   the article via `focus-within`. */
                                                className="absolute inset-0 z-10 focus:outline-none"
                                            />
                                            {/* No image is a valid event; a broken frame is not. */}
                                            {event?.media?.url && (
                                                /* The whole poster, filling the card — see PosterFrame. */
                                                <PosterFrame
                                                    media={event.media}
                                                    width={420}
                                                    imageClassName="transition-transform duration-700 group-hover:scale-105"
                                                >
                                                    {/* Keeps the badges legible over a bright photograph. */}
                                                    <div className="absolute inset-0 bg-gradient-to-t
                                                                    from-brand-900/45 via-transparent to-transparent" />

                                                    {event?.category && (
                                                        <span className="absolute left-3 top-3 rounded-md bg-brand-900/85
                                                                         px-3 py-1.5 text-[1rem] font-extrabold
                                                                         uppercase tracking-[0.08em] text-white
                                                                         ">
                                                            {event.category}
                                                        </span>
                                                    )}
                                                </PosterFrame>
                                            )}

                                            <div className="relative flex flex-grow flex-col p-5">
                                                {/*
                                                  The date block, lifted over the
                                                  photograph's lower edge. This is the
                                                  card's signature and the gallery tile
                                                  has no equivalent.
                                                */}
                                                {date && (
                                                    <div
                                                        /* Wider and larger on a phone, where the
                                                           card is one across; it steps back down
                                                           from `sm`, where five share a row. */
                                                        className={`absolute left-5 flex w-[4.5rem] flex-col
                                                                    items-center rounded-xl bg-white px-2 py-2
                                                                    text-center ring-1 ring-brand-100
                                                                    shadow-[0_8px_20px_-8px_rgb(28_46_104/0.5)]
                                                                    ${event?.media?.url ? '-top-9' : 'top-4'}`}
                                                        style={{ transform: 'translateZ(30px)' }}
                                                    >
                                                        <span className="text-[1.875rem] font-black leading-none
                                                                         text-brand-800">
                                                            {date.day}
                                                        </span>
                                                        <span className="mt-0.5 text-[1rem]
                                                                         font-extrabold uppercase tracking-[0.08em]
                                                                         text-brand-600">
                                                            {date.month}
                                                        </span>
                                                        <span className="text-[1rem]
                                                                         font-bold text-gray-400">
                                                            {date.year}
                                                        </span>
                                                    </div>
                                                )}

                                                {/*
                                                  CLEARS THE DATE CHIP, MEASURED.

                                                  The chip is 96px tall and hangs 36px
                                                  above this block, so 60px of it comes
                                                  down into the content. The clearance
                                                  was 24px, and the title's first line
                                                  sat under it — 16px of “Business
                                                  Integration Conclave” was behind the
                                                  date on every card in the row.

                                                  Without media the chip sits 16px INSIDE
                                                  the card instead of above it, so that
                                                  case needs the chip's whole height plus
                                                  its offset.
                                                */}
                                                <div className={date ? (event?.media?.url ? 'pt-16' : 'pt-28') : ''}>
                                                    {/*
                                                      * THREE LINES, AND ALWAYS THREE LINES' WORTH OF ROOM.
                                                      *
                                                      * Three because at five across a card
                                                      * is ~220px and a real title ("SC/ST
                                                      * Entrepreneurs Integration
                                                      * Conference") loses its last word to
                                                      * the ellipsis at two.
                                                      *
                                                      * `min-h` because the cards sit in a
                                                      * row: a one-line title and a
                                                      * three-line title beside it started
                                                      * their summaries two lines apart, and
                                                      * then their prices, their venues and
                                                      * their times — every row in the card
                                                      * out of step with its neighbour all
                                                      * the way down. Reserving the three
                                                      * lines costs a short title some white
                                                      * space and buys the whole row one set
                                                      * of baselines.
                                                      */}
                                                    <h3 className={`${CARD_TITLE} text-[1.25rem] leading-snug
                                                                    min-h-[5.1rem] text-brand-800 line-clamp-3
                                                                    transition-colors group-hover:text-brand-600`}>
                                                        {/* No field on the event form is
                                                            required, so a published event
                                                            can genuinely have no title.
                                                            A named placeholder beats an
                                                            empty heading, which reads as
                                                            a broken card. */}
                                                        {event?.title || 'Untitled event'}
                                                    </h3>

                                                    {event?.description && (
                                                        <p className={`${CARD_BODY} mt-2.5 line-clamp-2
                                                                       min-h-[3.4rem] text-[1.25rem]
                                                                       font-medium text-gray-500`}>
                                                            {event.description}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="mt-auto space-y-2 pt-5">
                                                    {/*
                                                      WHAT IT COSTS, above where it is
                                                      and who it is for.

                                                      Only when the event is taking
                                                      bookings: a price on an event
                                                      nobody can book is a number with
                                                      nothing behind it.
                                                    */}
                                                    {event?.registrationEnabled && (
                                                        <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                                                            {/*
                                                              * THE PRICE IS THE BIGGEST THING ON THE CARD
                                                              * AFTER THE TITLE.
                                                              *
                                                              * It was set at 1.0625rem — the size of the
                                                              * venue and the date beneath it — so the one
                                                              * figure a visitor is deciding on read as
                                                              * another line of small print. A price is not
                                                              * a detail; it is most of the decision.
                                                              *
                                                              * "Free" is drawn in green rather than in the
                                                              * brand navy, because it is not a number and
                                                              * reading it as one costs a second.
                                                              */}
                                                            <span className={`text-[1.625rem] font-black leading-none ${
                                                                Number(event?.registrationFee) > 0
                                                                    ? 'text-brand-800'
                                                                    : 'text-emerald-600'}`}>
                                                                {Number(event?.registrationFee) > 0
                                                                    ? `₹${Number(event.registrationFee).toLocaleString('en-IN')}`
                                                                    : 'Free'}
                                                            </span>
                                                            {Number(event?.registrationFee) > 0 && (
                                                                <span className="text-[1.0625rem] font-semibold text-gray-400">
                                                                    per seat
                                                                </span>
                                                            )}
                                                            {event?.hasMemberRate
                                                                && Number(event?.memberPrice) < Number(event?.registrationFee) && (
                                                                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5
                                                                                 text-[1.0625rem] font-bold text-emerald-700">
                                                                    Members ₹{Number(event.memberPrice).toLocaleString('en-IN')}
                                                                </span>
                                                            )}
                                                        </p>
                                                    )}

                                                    {reach && (
                                                        <p className="flex items-start gap-2 text-[1.125rem]
                                                                      font-bold text-brand-600">
                                                            <Landmark size={16} className="mt-0.5 shrink-0 text-brand-400" />
                                                            <span className="line-clamp-1">
                                                                {reach}
                                                                {extraRegions > 0 && (
                                                                    <span className="font-semibold text-gray-400">
                                                                        {' '}+{extraRegions} more
                                                                    </span>
                                                                )}
                                                            </span>
                                                        </p>
                                                    )}
                                                    {/*
                                                      * WHERE IT HAPPENS — a room or a link,
                                                      * never both.
                                                      *
                                                      * An online event is not allowed to print
                                                      * a venue here. A pin over "Chennai Trade
                                                      * Centre" on a video call is not a cosmetic
                                                      * slip: it is the card telling somebody to
                                                      * drive there. The venue stays on the
                                                      * record — an editor who switches an event
                                                      * back should not have to type it again —
                                                      * so the guard has to be on the READ, here,
                                                      * and not on the write.
                                                      *
                                                      * The joining link itself is never on this
                                                      * page. It reaches the people who book, on
                                                      * their confirmation.
                                                      */}
                                                    {event?.mode === 'online' ? (
                                                        <p className="flex items-start gap-2 text-[1.125rem]
                                                                      font-semibold text-gray-500">
                                                            <Video size={16} className="mt-0.5 shrink-0 text-brand-400" />
                                                            <span className="line-clamp-1">
                                                                Online{event?.onlinePlatform ? ` · ${event.onlinePlatform}` : ' event'}
                                                            </span>
                                                        </p>
                                                    ) : event?.location ? (
                                                        <p className="flex items-start gap-2 text-[1.125rem]
                                                                      font-semibold text-gray-500">
                                                            <MapPin size={16} className="mt-0.5 shrink-0 text-brand-400" />
                                                            <span className="line-clamp-1">{event.location}</span>
                                                        </p>
                                                    ) : null}
                                                    {time && (
                                                        <p className="flex items-center gap-2 text-[1.125rem]
                                                                      font-semibold text-gray-500">
                                                            <Clock size={16} className="shrink-0 text-brand-400" />
                                                            <span>{time}</span>
                                                        </p>
                                                    )}
                                                    {/* A multi-day event says when it
                                                        finishes. The chip above can hold
                                                        one day, and a conclave that runs
                                                        to Friday reading as a Wednesday
                                                        is somebody booking one night. */}
                                                    {lastDay && (
                                                        <p className="flex items-center gap-2 text-[1.125rem]
                                                                      font-semibold text-gray-500">
                                                            <CalendarDays size={16} className="shrink-0 text-brand-400" />
                                                            <span>Runs to {lastDay}</span>
                                                        </p>
                                                    )}
                                                    {/*
                                                      An undated event says so.
                                                      
                                                      The date block above is simply not
                                                      drawn when there is no date, which
                                                      leaves a card that looks like every
                                                      other one minus a corner — read as
                                                      a rendering fault rather than as
                                                      information. Since the date stopped
                                                      being a required field this is a
                                                      real state a visitor will meet.
                                                    */}
                                                    {!date && (
                                                        <p className="flex items-center gap-2 text-[1rem]
                                                                      font-semibold text-gray-400">
                                                            <Clock size={16} className="shrink-0 text-brand-300" />
                                                            <span>Date to be confirmed</span>
                                                        </p>
                                                    )}

                                                    {/* Its own page. This pointed back at the
                                                        list the card is already on, so "View
                                                        Details" showed no details. */}
                                                    {/*
                                                      * NOT A LINK ANY MORE — the whole card is
                                                      * one (see the overlay above). A second
                                                      * link to the same place inside the first
                                                      * is invalid markup and gives a keyboard
                                                      * user two stops that do the same thing.
                                                      * It stays as the visible affordance,
                                                      * because a card with nothing saying it
                                                      * can be opened does not look openable.
                                                      */}
                                                    <span
                                                        aria-hidden="true"
                                                        className={`${MICRO_LABEL} mt-1 inline-flex items-center gap-1.5
                                                                    py-3.5 text-brand-600 transition-colors
                                                                    group-hover:text-brand-800`}
                                                    >
                                                        View Details
                                                        <ArrowRight
                                                            size={13}
                                                            className="transition-transform duration-300
                                                                       group-hover:translate-x-1"
                                                        />
                                                    </span>
                                                </div>
                                            </div>
                                        </article>
                                    </Tilt3D>
                                </Reveal>
                            );
                        })}
                    </div>
                )}

                {/* --------------------------------------------------- banner */}
                {showBanner && (
                    <Reveal
                        variant="scale"
                        className="my-16 overflow-hidden rounded-3xl bg-brand-800 relative"
                    >
                        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                            <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-brand-600/40 blur-3xl transform-gpu" />
                        </div>

                        <div className="relative z-10 flex flex-col items-center gap-6 p-7 text-center
                                        md:flex-row md:justify-between md:p-9 md:text-left">
                            <div className="flex flex-col items-center gap-5 md:flex-row">
                                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl
                                                 bg-white/12 text-white ring-1 ring-white/20">
                                    <CmsIcon name={banner?.icon} size={24} fallback="calendar-days" />
                                </span>
                                <div>
                                    {banner?.title && (
                                        <p className="text-[1.5625rem] font-black tracking-tight text-white md:text-2xl">
                                            {banner.title}
                                        </p>
                                    )}
                                    {banner?.subtitle && (
                                        <p className="mt-1.5 text-[1.1875rem] font-medium text-white/70">{banner.subtitle}</p>
                                    )}
                                </div>
                            </div>

                            {banner?.ctaLabel && (
                                <Link
                                    to={banner.ctaHref || '/contact'}
                                    className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white
                                               px-7 py-3.5 text-[1.1875rem] font-extrabold text-brand-800
                                               transition-transform duration-300 hover:-translate-y-0.5
                                               shadow-[0_14px_30px_-12px_rgb(0,0,0,0.6)]"
                                >
                                    {banner.ctaLabel}
                                    <ArrowRight size={16} />
                                </Link>
                            )}
                        </div>
                    </Reveal>
                )}

                {/* The grid's own rows, then the banner's, then the PAGE's.
                    Each card's rows used to be pooled into one list printed
                    here, so a field added to the filters landed under the grid. */}
                {fieldsFor('events.grid')}
                {fieldsFor('events.banner')}
                {/* The "past events link" card offered the control and had
                    nothing drawing the answer. It belongs to this page's foot,
                    which is where that link sits. */}
                {fieldsFor('events.pastLink')}
                <div className={`${CARD_BODY} text-gray-600`}>
                    <CmsExtraFields fields={ownRows} className="mt-16" />
                </div>
            </div>
        </section>
    );
}

export default EventsExplorer;
