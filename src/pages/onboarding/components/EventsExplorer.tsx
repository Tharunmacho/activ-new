import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Clock, ArrowRight, X } from 'lucide-react';
import type { CmsEvent, EventsSettings } from '@/services/cmsApi';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import { CmsIcon } from '@/components/shared/CmsIcon';
import { Reveal } from '@/components/shared/Reveal';
import { Tilt3D } from '@/components/shared/Tilt3D';
import { PAGE_CONTAINER } from '@/components/layout/pageContainer';
import { CARD_TITLE, CARD_BODY, MICRO_LABEL } from '@/components/layout/typography';

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

/** The time windows. `all` is offered so a filter can be undone. */
const WHEN = [
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'past', label: 'Past' },
    { value: 'all', label: 'All dates' },
] as const;

type When = (typeof WHEN)[number]['value'];

const ALL = 'All';

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

export function EventsExplorer({ events, settings }: Props) {
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<string>(ALL);
    const [location, setLocation] = useState<string>(ALL);
    const [when, setWhen] = useState<When>('upcoming');

    const chips = settings?.categories || [];

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

    const filtered = useMemo(() => {
        const needle = (query || '').trim().toLowerCase();
        const now = Date.now();

        return (events || []).filter((event) => {
            if (category !== ALL && (event?.category || '') !== category) return false;
            if (location !== ALL && (event?.location || '') !== location) return false;

            if (when !== 'all') {
                const start = event?.startAt ? new Date(event.startAt).getTime() : NaN;
                // An event with no usable date is shown in every window rather
                // than hidden from all of them — an unset date is missing
                // information, not a statement that it already happened.
                if (!Number.isNaN(start)) {
                    if (when === 'upcoming' && start < now) return false;
                    if (when === 'past' && start >= now) return false;
                }
            }

            if (needle) {
                const haystack = [event?.title, event?.description, event?.location, event?.category]
                    .map((v) => (v || '').toLowerCase())
                    .join(' ');
                if (!haystack.includes(needle)) return false;
            }
            return true;
        });
    }, [events, query, category, location, when]);

    const isFiltered = !!(query.trim()) || category !== ALL || location !== ALL || when !== 'upcoming';

    const reset = () => {
        setQuery('');
        setCategory(ALL);
        setLocation(ALL);
        setWhen('upcoming');
    };

    /** What the visitor narrowed by, for the empty-state sentence. */
    const describeFilter = () => {
        if (query.trim()) return `"${query.trim()}"`;
        if (category !== ALL) return category;
        if (location !== ALL) return location;
        return WHEN.find((w) => w.value === when)?.label || 'that filter';
    };

    const emptyFiltered = (settings?.emptyFilterText || 'No events match {query}.')
        .replace('{query}', describeFilter());

    const banner = settings?.banner;
    const showBanner = !!(banner?.enabled && (banner.title || banner.ctaLabel));

    const selectClass =
        'h-11 min-w-0 rounded-xl border border-brand-100 bg-white px-3.5 text-sm font-semibold '
        + 'text-brand-800 outline-none transition-colors hover:border-brand-300 '
        + 'focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15';

    return (
        <section className="w-full bg-white font-sans">
            <div className={PAGE_CONTAINER}>

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
                                size={17}
                                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400"
                            />
                            <input
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={settings?.searchPlaceholder || 'Search events...'}
                                className="h-11 w-full rounded-xl border border-brand-100 bg-white pl-10 pr-3
                                           text-sm font-medium text-brand-800 placeholder:text-gray-400
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

                            <select
                                aria-label="When"
                                value={when}
                                onChange={(e) => setWhen(e.target.value as When)}
                                className={selectClass}
                            >
                                {WHEN.map((w) => (
                                    <option key={w.value} value={w.value}>{w.label}</option>
                                ))}
                            </select>

                            {/* Only offered once there is something to undo. */}
                            {isFiltered && (
                                <button
                                    type="button"
                                    onClick={reset}
                                    className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl
                                               border border-brand-100 px-4 text-sm font-bold text-brand-700
                                               transition-colors hover:border-brand-600 hover:bg-brand-50"
                                >
                                    <X size={15} />
                                    Reset
                                </button>
                            )}
                        </div>
                    </div>
                </div>

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
                                        className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl
                                                    px-4 py-2 text-sm font-bold transition-all duration-200 ${
                                            active
                                                ? 'bg-white text-brand-800 shadow-[0_6px_16px_-6px_rgb(28_46_104/0.5)]'
                                                : 'text-brand-600/80 hover:text-brand-800'
                                        }`}
                                    >
                                        {chip.icon && (
                                            <CmsIcon
                                                name={chip.icon}
                                                size={15}
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
                    <p className="py-20 text-center text-base font-semibold text-gray-500">
                        {isFiltered ? emptyFiltered : (settings?.emptyText || '')}
                    </p>
                ) : (
                    <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        {filtered.map((event, i) => {
                            const date = splitDate(event?.startAt);
                            const time = formatTimeRange(event?.startAt, event?.endAt);

                            return (
                                <Reveal
                                    key={event?.id || i}
                                    delay={Math.min(i % 5, 4) * 70}
                                    className="h-full"
                                >
                                    <Tilt3D className="h-full" intensity={8} lift={1.02} glare={false} perspective={850}>
                                        <article
                                            className="group flex h-full flex-col overflow-hidden rounded-2xl
                                                       border border-brand-100/80 bg-white
                                                       shadow-[0_10px_36px_-16px_rgb(28_46_104/0.22)]
                                                       transition-shadow duration-500
                                                       hover:shadow-[0_28px_60px_-20px_rgb(28_46_104/0.42)]"
                                        >
                                            {/* No image is a valid event; a broken frame is not. */}
                                            {event?.media?.url && (
                                                <div className="relative h-40 w-full overflow-hidden">
                                                    <CmsMediaFrame
                                                        media={event.media}
                                                        width={320}
                                                        className="transition-transform duration-700 group-hover:scale-105"
                                                    />
                                                    {/* Keeps the badges legible over a bright photograph. */}
                                                    <div className="absolute inset-0 bg-gradient-to-t
                                                                    from-brand-900/70 via-brand-900/10 to-transparent" />

                                                    {event?.category && (
                                                        <span className="absolute left-3 top-3 rounded-md bg-brand-900/85
                                                                         px-2.5 py-1 text-[0.625rem] font-extrabold
                                                                         uppercase tracking-[0.08em] text-white
                                                                         backdrop-blur-sm">
                                                            {event.category}
                                                        </span>
                                                    )}
                                                </div>
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
                                                        className={`absolute left-5 flex w-14 flex-col items-center
                                                                    rounded-xl bg-white px-2 py-2 text-center
                                                                    ring-1 ring-brand-100
                                                                    shadow-[0_8px_20px_-8px_rgb(28_46_104/0.5)]
                                                                    ${event?.media?.url ? '-top-9' : 'top-4'}`}
                                                        style={{ transform: 'translateZ(30px)' }}
                                                    >
                                                        <span className="text-lg font-black leading-none text-brand-800">
                                                            {date.day}
                                                        </span>
                                                        <span className="mt-0.5 text-[0.5625rem] font-extrabold
                                                                         uppercase tracking-[0.1em] text-brand-600">
                                                            {date.month}
                                                        </span>
                                                        <span className="text-[0.5625rem] font-bold text-gray-400">
                                                            {date.year}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Clears the date block where one is drawn. */}
                                                <div className={date ? (event?.media?.url ? 'pt-6' : 'pt-20') : ''}>
                                                    {/* Three lines, not two: at five
                                                        across a card is ~220px, and a
                                                        real event title ("SC/ST
                                                        Entrepreneurs Integration
                                                        Conference") loses its last word
                                                        to the ellipsis at two. */}
                                                    <h3 className={`${CARD_TITLE} text-[0.9375rem] leading-snug
                                                                    text-brand-800 line-clamp-3 transition-colors
                                                                    group-hover:text-brand-600`}>
                                                        {event?.title || ''}
                                                    </h3>

                                                    {event?.description && (
                                                        <p className={`${CARD_BODY} mt-2 line-clamp-3 text-[0.8125rem]
                                                                       text-gray-500`}>
                                                            {event.description}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="mt-auto space-y-2 pt-5">
                                                    {event?.location && (
                                                        <p className="flex items-start gap-2 text-[0.75rem]
                                                                      font-semibold text-gray-500">
                                                            <MapPin size={13} className="mt-0.5 shrink-0 text-brand-400" />
                                                            <span className="line-clamp-1">{event.location}</span>
                                                        </p>
                                                    )}
                                                    {time && (
                                                        <p className="flex items-center gap-2 text-[0.75rem]
                                                                      font-semibold text-gray-500">
                                                            <Clock size={13} className="shrink-0 text-brand-400" />
                                                            <span>{time}</span>
                                                        </p>
                                                    )}

                                                    <Link
                                                        to="/events"
                                                        aria-label={`More about ${event?.title || 'this event'}`}
                                                        className={`${MICRO_LABEL} mt-3 inline-flex items-center gap-1.5
                                                                    text-brand-600 transition-colors hover:text-brand-800`}
                                                    >
                                                        View Details
                                                        <ArrowRight
                                                            size={13}
                                                            className="transition-transform duration-300
                                                                       group-hover:translate-x-1"
                                                        />
                                                    </Link>
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
                            <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-brand-600/40 blur-3xl" />
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
                                        <p className="text-xl font-black tracking-tight text-white md:text-2xl">
                                            {banner.title}
                                        </p>
                                    )}
                                    {banner?.subtitle && (
                                        <p className="mt-1.5 text-sm font-medium text-white/70">{banner.subtitle}</p>
                                    )}
                                </div>
                            </div>

                            {banner?.ctaLabel && (
                                <Link
                                    to={banner.ctaHref || '/contact'}
                                    className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white
                                               px-7 py-3.5 text-sm font-extrabold text-brand-800
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
            </div>
        </section>
    );
}

export default EventsExplorer;
