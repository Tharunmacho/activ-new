import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ChevronLeft, ChevronRight, User, ArrowRight, ExternalLink, X, Images, Mail, Phone,
    MessageSquare,
} from 'lucide-react';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import { resolveMediaUrl, sizedMediaUrl } from '@/config/api.config';
import { MICRO_LABEL } from '@/components/layout/typography';
import type { RegionSlide, RegionLeader, RegionFeedItem, GalleryPhoto } from '@/services/cmsRegionsApi';
import { listRegionGallery } from '@/services/cmsRegionsApi';
import { PersonPhoto } from './PersonPhoto';
import { LeaderMessageForm } from './LeaderMessageForm';
import type { LeaderContext } from '@/services/cmsLeaderMessagesApi';

/**
 * The pieces the Region and State pages are both built from.
 *
 * =========================================================================
 * ONE SET OF PARTS, TWO PAGES
 * =========================================================================
 *
 * A region page and a state page are the same page with different feeds in it:
 * a heading with a Read More, a carousel beside a leadership panel, a right
 * rail, and a column of lists. Written twice they would drift — and the first
 * thing to drift is always the empty state, because that is the half nobody
 * looks at while building.
 *
 * -------------------------------------------------------- what is NOT drawn
 *
 * Every component here renders nothing at all when it has nothing to say. No
 * empty card, no dash, no "coming soon". These pages are written over weeks and
 * a half-filled one must look deliberate rather than broken — the same rule the
 * booking screens follow.
 */

/* The house scale, matched to the business-account and booking screens. */
export const PANEL_HEADING = 'text-[1.375rem] sm:text-[1.75rem] font-extrabold tracking-tight text-brand-800';
export const ROW_LABEL = 'text-[1.0625rem] font-bold uppercase tracking-wider text-gray-600';
export const CARD =
    'rounded-2xl border border-gray-200 bg-white '
    + 'shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_28px_-18px_rgba(28,46,104,0.28)]';

/* ------------------------------------------------------------- Read More */

/**
 * A description that opens in place.
 *
 * In place and not on another page: the long version is three paragraphs, and
 * sending somebody to a second URL to read three paragraphs loses them the
 * carousel, the leadership and the rest of the page they were looking at.
 *
 * Renders nothing when there is no short description — a heading with a bare
 * "Read More" under it and nothing between them is the shape of a broken page.
 */
export function ReadMore({ short, full }: { short: string; full: string }) {
    const [open, setOpen] = useState(false);
    if (!short && !full) return null;

    const hasMore = !!full && full.trim() !== short.trim();

    return (
        <div className="max-w-4xl">
            <p className="text-[1.25rem] sm:text-[1.0625rem] leading-relaxed font-semibold text-gray-600
                          whitespace-pre-line">
                {open && hasMore ? full : short || full}
            </p>
            {hasMore && (
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    className="mt-3 inline-flex items-center gap-2 text-[1.0625rem] font-bold
                               text-brand-600 hover:text-brand-800 transition-colors"
                >
                    {open ? 'Read Less' : 'Read More'}
                    <ArrowRight size={15} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
                </button>
            )}
        </div>
    );
}

/* ------------------------------------------------------------- carousel */

/**
 * The hero carousel, with its caption beneath.
 *
 * THE CAPTION IS PART OF THE COMPONENT, not an afterthought. On the reference
 * layout it names who is in the photograph and when it was taken, and it is the
 * most-read text on the page — a carousel that drops it is a slideshow of
 * strangers.
 *
 * Auto-advance pauses on hover and on focus and does not run at all for a
 * reader who has asked for reduced motion. A single slide draws no controls:
 * arrows that cannot go anywhere read as broken.
 */
export function HeroCarousel({ slides }: { slides: RegionSlide[] }) {
    const usable = (slides || []).filter((s) => s.media?.url || s.caption);
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);

    useEffect(() => { setIndex(0); }, [usable.length]);

    useEffect(() => {
        if (usable.length < 2 || paused) return undefined;
        const reduced = typeof window !== 'undefined'
            && window.matchMedia
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduced) return undefined;

        const timer = setInterval(() => {
            setIndex((i) => (i + 1) % usable.length);
        }, 6000);
        return () => clearInterval(timer);
    }, [usable.length, paused]);

    if (!usable.length) return null;

    const slide = usable[Math.min(index, usable.length - 1)];
    const go = (step: number) => setIndex((i) => (i + step + usable.length) % usable.length);

    return (
        <div
            className={`${CARD} overflow-hidden`}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={() => setPaused(false)}
        >
            <div className="relative w-full aspect-[16/10] bg-gray-50">
                {slide.media?.url ? (
                    <CmsMediaFrame media={slide.media} width={900} priority />
                ) : (
                    /* A slot an editor has created but not filled. Saying so is
                       more useful than a blank rectangle that reads as a failed
                       image. */
                    <div className="absolute inset-0 flex items-center justify-center
                                    text-[1.25rem] font-semibold text-gray-400 px-6 text-center">
                        No photograph has been added to this slide yet.
                    </div>
                )}

                {usable.length > 1 && (
                    <>
                        <button
                            type="button"
                            aria-label="Previous photograph"
                            onClick={() => go(-1)}
                            className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center
                                       justify-center rounded-full bg-white/90 text-brand-800 shadow-md
                                       transition-colors hover:bg-white"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <button
                            type="button"
                            aria-label="Next photograph"
                            onClick={() => go(1)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center
                                       justify-center rounded-full bg-white/90 text-brand-800 shadow-md
                                       transition-colors hover:bg-white"
                        >
                            <ChevronRight size={18} />
                        </button>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                            {usable.map((s, i) => (
                                <button
                                    key={s.id || i}
                                    type="button"
                                    aria-label={`Photograph ${i + 1} of ${usable.length}`}
                                    aria-current={i === index}
                                    onClick={() => setIndex(i)}
                                    className={`h-2 rounded-full transition-all ${
                                        i === index ? 'w-6 bg-white' : 'w-2 bg-white/60 hover:bg-white/90'
                                    }`}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>

            {slide.caption && (
                <p className="px-5 py-4 text-[1.0625rem] leading-relaxed font-semibold text-gray-600
                              border-t border-gray-100">
                    {slide.caption}
                </p>
            )}
        </div>
    );
}

/* ------------------------------------------------------------ leadership */

/**
 * The leadership panel — the whole reason these pages exist.
 *
 * Designation and organisation are printed as two lines joined by "and",
 * exactly as the association writes them on paper. A leader with only a name
 * prints only a name; nothing invents a title.
 */
export function LeadershipPanel({ title, leaders }: { title: string; leaders: RegionLeader[] }) {
    const [open, setOpen] = useState<RegionLeader | null>(null);
    const people = (leaders || []).filter((p) => p.name || p.designation);
    if (!people.length) return null;

    return (
        <div className={`${CARD} p-6 sm:p-7`}>
            <h2 className={`${PANEL_HEADING} mb-6`}>{title}</h2>

            {/*
              * ONE PER ROW, photograph beside the words.
              *
              * Two abreast is what the reference shows, and it works there
              * because that panel is half a page wide. Here the panel is the
              * middle of three columns — around 260px on a laptop — and two
              * columns of that break "Mr P Ravichandran" across two lines and
              * "Managing Director" across three. A row per person reads at
              * every width and needs no breakpoint to be got right.
              */}
            <div className="space-y-6 divide-y divide-gray-100">
                {people.map((person, i) => (
                    /*
                      * A CARD THAT OPENS when there is more to read.
                      *
                      * The panel prints a name, a designation and an
                      * organisation; a biography does not fit beside two of
                      * those without turning the panel into a wall. So the card
                      * becomes a button ONLY when a bio exists — a control that
                      * opens an empty dialog is worse than no control.
                      */
                    <div
                        key={person.id || i}
                        role={person.bio ? 'button' : undefined}
                        tabIndex={person.bio ? 0 : undefined}
                        onClick={person.bio ? () => setOpen(person) : undefined}
                        onKeyDown={person.bio
                            ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(person); } }
                            : undefined}
                        className={`flex items-start gap-4 rounded-xl ${i > 0 ? 'pt-6' : ''} ${
                            person.bio ? 'cursor-pointer transition-colors hover:bg-brand-50/40 -mx-2 px-2' : ''
                        }`}
                    >
                        {/*
                          * A monogram, never a broken frame.
                          *
                          * Photographs arrive over weeks and a leader announced
                          * before their picture does is normal. An <img> with
                          * no src draws the browser's torn-page icon, which
                          * reads as a fault rather than as a gap.
                          */}
                        <div className="w-24 h-28 shrink-0 rounded-xl overflow-hidden bg-gray-100
                                        border border-gray-200 flex items-center justify-center">
                            {person.photoUrl ? (
                                <img
                                    src={sizedMediaUrl(person.photoUrl, 480)}
                                    alt={person.name || 'Leader'}
                                    className="w-full h-full object-cover"
                                loading="lazy"
                            decoding="async"
                        />
                            ) : (
                                <User size={28} className="text-gray-300" />
                            )}
                        </div>

                        <div className="min-w-0">
                        {person.name && (
                            <p className="text-[1.25rem] sm:text-[1.0625rem] font-extrabold text-brand-900">
                                {person.name}
                            </p>
                        )}
                        {/*
                          * THE ROLE, AS A BADGE.
                          *
                          * "Chairman" in a pill under the name, which is how the
                          * design reads at a glance — the full designation line
                          * below it is for somebody who has stopped to read.
                          * Its own field rather than the designation cut at its
                          * first comma, which works until somebody writes
                          * "Chairman and Convenor, Skills Panel".
                          */}
                        {person.role && (
                            <span className="mt-1.5 inline-block rounded-full bg-brand-700 px-2.5 py-1
                                             text-[1rem] font-bold uppercase tracking-wide text-white">
                                {person.role}
                            </span>
                        )}
                        {person.designation && (
                            <p className="text-[1.0625rem] font-semibold text-gray-600 mt-1">
                                {person.designation}
                            </p>
                        )}
                        {person.organisation && (
                            <p className="text-[1.0625rem] font-semibold text-gray-600">
                                {/* "and" on its own line, the way the association
                                    prints it — the designation and the day job
                                    are two facts, not one sentence. */}
                                <span className="text-gray-400">and</span><br />
                                {person.organisation}
                            </p>
                        )}
                        {person.bio && (
                            <p className="text-[1.25rem] text-gray-500 mt-2 leading-relaxed line-clamp-2">
                                {person.bio}
                            </p>
                        )}
                        {person.bio && (
                            <span className="mt-1.5 inline-block text-[1.0625rem] font-bold text-brand-600">
                                Read profile
                            </span>
                        )}
                        </div>
                    </div>
                ))}
            </div>

            {open && <LeaderProfileDialog person={open} onClose={() => setOpen(null)} />}
        </div>
    );
}

/**
 * One leader in full.
 *
 * A dialog rather than a page: it is two paragraphs, and sending somebody to
 * another URL for two paragraphs loses them the panel they were reading.
 * Escape closes and the backdrop closes — both, because a dialog dismissable
 * only by pointer is a keyboard trap.
 */
/**
 * ONE PERSON, opened from their portrait.
 *
 * =========================================================================
 * WHAT WAS WRONG WITH IT
 * =========================================================================
 *
 * Four things, and all four were visible the moment a card was clicked:
 *
 *   the portrait was a 112x128 box, so a 4:5 photograph was squeezed into
 *   something nearly square and `object-cover` took the crop out of the MIDDLE
 *   — which on a head-and-shoulders picture is the chest;
 *
 *   everything was ranged left in a panel opened from a page on which every
 *   other thing is centred;
 *
 *   the close button sat at `right-4 top-4` over content that started at the
 *   same corner, so on a long designation the two overlapped;
 *
 *   and the panel showed no way to reach the person it was about, which is the
 *   one thing somebody who has just clicked a leader's face wants.
 *
 * It is a centred column now: the portrait at the shape it was taken at, the
 * name, the role as a badge, the designation, the firm, then the contact, then
 * the biography. The close button has a row of its own above all of it.
 */
export function LeaderProfileDialog({ person, context, onClose }: {
    person: RegionLeader;
    /**
     * Where this leader sits, for a message addressed to them.
     *
     * Passed in rather than read from the URL: the state page draws THREE
     * groups of leaders — the state council, its regions and its districts —
     * off one route, and a district office-bearer's enquiry filed under the
     * state is the one thing this feature exists to avoid. The panel cannot
     * work out which group a face came from; the grid that drew it can.
     *
     * Absent, the Message button is not offered at all. An enquiry with no
     * geography on it is one the super admin cannot route, and a button that
     * silently files it wrongly is worse than no button.
     */
    context?: LeaderContext;
    onClose: () => void;
}) {
    const [messaging, setMessaging] = useState(false);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = previous;
        };
    }, [onClose]);

    const reach = [person.email, person.phone].filter(Boolean);

    return (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 sm:p-6">
            <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]"
            />

            <div
                role="dialog"
                aria-modal="true"
                aria-label={person.name || 'Leader'}
                /* 42rem, not 28rem. At `max-w-md` the photograph, the name,
                   the designation, the contact lines and a five-option form
                   were stacked in a 448px column, so the card was mostly
                   scrollbar — the association asked for it bigger. */
                className={`relative w-full sm:max-w-2xl ${CARD} max-h-[90vh] overflow-y-auto
                            text-center`}
            >
                {/* A ROW OF ITS OWN. Floated over the content it collided with a
                    long designation; here it can never overlap anything. */}
                <div className="flex justify-end px-4 pt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="flex h-9 w-9 items-center justify-center rounded-full
                                   border border-gray-200 text-gray-500 transition-colors
                                   hover:bg-gray-50"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="px-6 pb-8 sm:px-10 md:px-14">
                    {/* 4:5, and the whole photograph inside it — see `PersonPhoto`. */}
                    {/* Bigger with the card. A 160px portrait in a 672px card
                        reads as a thumbnail somebody forgot to replace. */}
                    <span className="mx-auto block w-44 sm:w-52 aspect-[4/5] overflow-hidden rounded-2xl
                                     bg-gradient-to-b from-gray-100 to-gray-200
                                     shadow-[0_2px_6px_rgba(16,24,40,0.08),0_16px_36px_-24px_rgba(28,46,104,0.55)]">
                        <PersonPhoto url={person.photoUrl} name={person.name} width={520} fallbackSize={34} />
                    </span>

                    {person.name && (
                        <p className="mt-5 text-[1.5625rem] font-extrabold leading-snug text-brand-900">
                            {person.name}
                        </p>
                    )}

                    {person.role && (
                        <p className="mt-2">
                            <span className="inline-block rounded-full bg-brand-800 px-3 py-1
                                             text-[1rem] font-bold uppercase tracking-wide
                                             text-white">
                                {person.role}
                            </span>
                        </p>
                    )}

                    {person.designation && (
                        <p className="mt-2.5 text-[1.0625rem] font-semibold leading-snug text-brand-600">
                            {person.designation}
                        </p>
                    )}
                    {person.organisation && (
                        <p className="mt-1 text-[1.0625rem] font-medium leading-snug text-gray-500">
                            {person.organisation}
                        </p>
                    )}

                    {/* The one thing somebody who has just clicked a face wants,
                        and the panel used not to carry at all. */}
                    {(reach.length > 0 || person.address) && (
                        <div className="mt-5 border-t border-gray-100 pt-4 space-y-2">
                            {person.email && (
                                <p>
                                    <a
                                        href={`mailto:${person.email}`}
                                        className="inline-flex items-center gap-2 break-all text-[1.0625rem]
                                                   font-semibold text-gray-600 transition-colors
                                                   hover:text-brand-700"
                                    >
                                        <Mail size={15} className="shrink-0 text-brand-500" />
                                        {person.email}
                                    </a>
                                </p>
                            )}
                            {person.phone && (
                                <p>
                                    <a
                                        href={`tel:${person.phone}`}
                                        className="inline-flex items-center gap-2 text-[1.0625rem]
                                                   font-semibold text-gray-600 transition-colors
                                                   hover:text-brand-700"
                                    >
                                        <Phone size={15} className="shrink-0 text-brand-500" />
                                        {person.phone}
                                    </a>
                                </p>
                            )}
                            {person.address && (
                                <p className="text-[1.25rem] font-medium leading-relaxed text-gray-500
                                              whitespace-pre-line">
                                    {person.address}
                                </p>
                            )}
                        </div>
                    )}

                    {person.bio && (
                        <p className="mt-5 border-t border-gray-100 pt-4 text-[1.0625rem]
                                      leading-relaxed font-medium text-gray-600 whitespace-pre-line">
                            {person.bio}
                        </p>
                    )}

                    {/*
                      * ==================================================
                      * ASK TO BE CONTACTED
                      * ==================================================
                      *
                      * Below the biography, because it is what somebody does
                      * AFTER reading who this person is — and above nothing,
                      * because it is the last thing on the panel.
                      *
                      * Offered only with a `context`. See the prop's note:
                      * an enquiry with no geography cannot be routed, and
                      * routing it wrongly is worse than not offering it.
                      */}
                    {context && !messaging && (
                        <button
                            type="button"
                            onClick={() => setMessaging(true)}
                            className="mt-6 inline-flex w-full items-center justify-center gap-2
                                       rounded-full bg-brand-600 px-6 py-3 text-[1.125rem]
                                       font-bold text-white transition-colors hover:bg-brand-700"
                        >
                            <MessageSquare size={16} />
                            Message {person.name ? person.name.split(' ').slice(-1)[0] : 'this office-bearer'}
                        </button>
                    )}

                    {context && messaging && (
                        <LeaderMessageForm
                            person={person}
                            context={context}
                            onDone={onClose}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

/* ----------------------------------------------------------- achievements */

/**
 * What the region or state has actually done, as a band of figures.
 *
 * =========================================================================
 * THE MOST PERSUASIVE BLOCK ON THE PAGE, AND THE CHEAPEST TO FILL
 * =========================================================================
 *
 * A visitor scrolling a regional page is deciding whether this association does
 * anything. Four numbers answer that in two seconds — "250+ member companies",
 * "40 events last year" — where four paragraphs do not get read at all.
 *
 * `title` carries the figure and `summary` says what it counts, which is why
 * both are text: "First council to publish a skills charter" is an achievement
 * with no number in it, and a numeric field would have nowhere to put it.
 */
export function AchievementBand({ items, title = 'Achievements' }: {
    items: RegionFeedItem[];
    title?: string;
}) {
    const rows = (items || []).filter((row) => row.title || row.summary);
    if (!rows.length) return null;

    return (
        <section>
            <h2 className={`${PANEL_HEADING} mb-4`}>{title}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {rows.slice(0, 8).map((row, i) => (
                    <div
                        key={row.id || i}
                        className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/80
                                   to-white p-5 sm:p-6
                                   shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_28px_-20px_rgba(28,46,104,0.35)]"
                    >
                        {/* The figure leads. It is the reason the card exists. */}
                        <p className="text-[2.1875rem] sm:text-4xl font-black tracking-tight text-brand-800
                                      leading-none">
                            {row.title}
                        </p>
                        {row.summary && (
                            <p className="mt-2.5 text-[1.0625rem] font-semibold leading-relaxed text-gray-600">
                                {row.summary}
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
}

/* --------------------------------------------------------------- gallery */

/**
 * Photographs from this region or state, on the page itself.
 *
 * The association asked for the gallery to be visible here and not only behind
 * a link: photographs are what makes a page of committee names look like an
 * organisation that meets. The strip shows a handful and hands the rest to the
 * full gallery, already filtered.
 *
 * Its failure is SILENT. The page was complete before this existed, and an
 * untagged gallery — which is what every gallery starts as — must leave no gap
 * on the page rather than an empty box asking to be filled.
 */
export function GalleryStrip({ state, region, title = 'Photo Gallery', href }: {
    state?: string;
    region?: string;
    title?: string;
    href: string;
}) {
    const [photos, setPhotos] = useState<GalleryPhoto[]>([]);

    useEffect(() => {
        let cancelled = false;
        listRegionGallery({ state, region, limit: 8 })
            .then((result) => { if (!cancelled) setPhotos(result.items || []); })
            .catch(() => { /* the strip is simply not drawn */ });
        return () => { cancelled = true; };
    }, [state, region]);

    if (!photos.length) return null;

    return (
        <section>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className={PANEL_HEADING}>{title}</h2>
                <Link
                    to={href}
                    className="inline-flex items-center gap-2 text-[1.0625rem] font-bold
                               text-brand-600 hover:text-brand-800 transition-colors"
                >
                    <Images size={15} /> See all photographs
                </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {photos.map((photo) => (
                    <Link
                        key={photo.id}
                        to={`/gallery/${photo.id}`}
                        className={`${CARD} group block overflow-hidden transition-shadow
                                    hover:shadow-[0_22px_48px_-20px_rgb(28_46_104/0.4)]`}
                    >
                        <div className="w-full aspect-[4/3] overflow-hidden bg-gray-50">
                            <CmsMediaFrame
                                media={photo.media}
                                width={420}
                                className="group-hover:scale-105 transition-transform duration-700 transform-gpu"
                            />
                        </div>
                        {photo.title && (
                            <p className="px-4 py-3 text-[1.25rem] font-bold text-brand-800 line-clamp-2">
                                {photo.title}
                            </p>
                        )}
                    </Link>
                ))}
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ feeds */

/** An internal path renders as a router link; anything else as an anchor. */
function FeedLink({ href, children, className }: {
    href: string; children: React.ReactNode; className: string;
}) {
    if (!href) return <div className={className}>{children}</div>;
    if (href.startsWith('/')) return <Link to={href} className={className}>{children}</Link>;
    return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
            {children}
        </a>
    );
}

/**
 * One list — sector updates, news, events, projects, publications.
 *
 * `limit` is what makes the landing page a summary: the association asked for
 * "less on the front screen, more on its own page", so a feed shows a handful
 * and hands the rest to Read All.
 */
export function FeedList({
    title, items, limit = 5, readAllHref, emptyNote,
}: {
    title?: string;
    items: RegionFeedItem[];
    limit?: number;
    readAllHref?: string;
    /** Shown INSTEAD of the list when empty. Omit it and the block disappears. */
    emptyNote?: string;
}) {
    const rows = (items || []).filter((row) => row.title || row.summary);
    if (!rows.length && !emptyNote) return null;

    const shown = limit > 0 ? rows.slice(0, limit) : rows;
    const hasMore = rows.length > shown.length;

    return (
        <section>
            {title && <h2 className={`${PANEL_HEADING} mb-4`}>{title}</h2>}

            {!rows.length ? (
                <p className="text-[1.0625rem] font-semibold text-gray-500">{emptyNote}</p>
            ) : (
                <ul className={`${CARD} divide-y divide-gray-100 overflow-hidden`}>
                    {shown.map((row, i) => (
                        <li key={row.id || i}>
                            <FeedLink
                                href={row.href}
                                className={`block px-5 sm:px-6 py-4 sm:py-5 transition-colors ${
                                    row.href ? 'hover:bg-brand-50/40' : ''
                                }`}
                            >
                                {(row.date || row.location) && (
                                    <p className={`${MICRO_LABEL} text-brand-500 mb-1.5`}>
                                        {[row.date, row.location].filter(Boolean).join(' · ')}
                                    </p>
                                )}
                                <p className="text-[1.25rem] sm:text-[1.0625rem] font-extrabold text-brand-900
                                              leading-snug flex items-start gap-2">
                                    <span>{row.title}</span>
                                    {row.href && !row.href.startsWith('/') && (
                                        <ExternalLink size={13} className="mt-1.5 shrink-0 text-gray-400" />
                                    )}
                                </p>
                                {row.summary && (
                                    <p className="mt-1.5 text-[1.0625rem] leading-relaxed font-semibold
                                                  text-gray-600 line-clamp-3">
                                        {row.summary}
                                    </p>
                                )}
                            </FeedLink>
                        </li>
                    ))}
                </ul>
            )}

            {readAllHref && (hasMore || rows.length > 0) && (
                <Link
                    to={readAllHref}
                    className="mt-3 inline-flex items-center gap-2 text-[1.0625rem] font-bold
                               text-brand-600 hover:text-brand-800 transition-colors"
                >
                    Read All <ArrowRight size={15} />
                </Link>
            )}
        </section>
    );
}

/**
 * A dated one-line list — media releases and press mentions.
 *
 * The reference prints these as "Sep 11, 2026 : headline", which is a different
 * thing from a card with a summary: it is an index, scanned rather than read.
 */
export function DatedList({ title, items, limit = 6, readAllHref }: {
    title: string;
    items: RegionFeedItem[];
    limit?: number;
    readAllHref?: string;
}) {
    const rows = (items || []).filter((row) => row.title);
    if (!rows.length) return null;

    return (
        <section>
            <h2 className={`${PANEL_HEADING} mb-4`}>{title}</h2>
            <ul className={`${CARD} divide-y divide-gray-100 overflow-hidden`}>
                {rows.slice(0, limit).map((row, i) => (
                    <li key={row.id || i}>
                        <FeedLink
                            href={row.href}
                            className={`block px-5 py-3.5 text-[1.0625rem] font-semibold text-gray-700
                                        transition-colors ${row.href ? 'hover:bg-brand-50/40' : ''}`}
                        >
                            {row.date && <span className="text-gray-400">{row.date} : </span>}
                            <span className="font-bold text-brand-900">{row.title}</span>
                        </FeedLink>
                    </li>
                ))}
            </ul>
            {readAllHref && (
                <Link
                    to={readAllHref}
                    className="mt-3 inline-flex items-center gap-2 text-[1.0625rem] font-bold
                               text-brand-600 hover:text-brand-800 transition-colors"
                >
                    Read All <ArrowRight size={15} />
                </Link>
            )}
        </section>
    );
}

/* ------------------------------------------------------------------- rail */

/** A right-rail block. Draws nothing when it has no children worth drawing. */
export function RailCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className={`${CARD} overflow-hidden`}>
            <p className={`${ROW_LABEL} bg-[#f7f8fa] px-5 py-3.5 border-b border-gray-200`}>
                {title}
            </p>
            <div className="px-5 py-4">{children}</div>
        </div>
    );
}
