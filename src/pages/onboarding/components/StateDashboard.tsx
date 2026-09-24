import { BAND_MEASURE } from '@/components/layout/typography';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight, ChevronRight, ChevronLeft, MapPin, Mail, Phone, Globe, User,
    Loader2, CheckCircle2, Send, X,
} from 'lucide-react';
import { CmsIcon } from '@/components/shared/CmsIcon';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import { resolveMediaUrl, sizedMediaUrl } from '@/config/api.config';
import { sendContactMessage } from '@/services/cmsApi';
import { errorMessage } from '@/services/api';
import { PersonPhoto } from './PersonPhoto';
import {
    listRegionGallery,
    type RegionFeedItem, type RegionLeader, type RegionOffice,
    type RegionHero, type GalleryPhoto, type CustomSection,
} from '@/services/cmsRegionsApi';

/**
 * The state page, as the association's design lays it out.
 *
 * =========================================================================
 * A DASHBOARD, NOT AN ARTICLE
 * =========================================================================
 *
 * The supplied design puts eleven blocks on one screen — about, leaders,
 * gallery, statistics, events, projects, consulting, publications, quick links,
 * promos and contact — so a visitor sees the whole of what a state council is in
 * one view rather than scrolling through it. Everything is a card, every card
 * has a heading with a "View All" beside it, and the detail lives one click
 * away.
 *
 * ------------------------------------------------------------ our own logic
 *
 * The design is theirs; nothing else is. Every word, figure, photograph and link
 * comes from `web_state_pages`, which the CMS writes — including the two rail
 * banners, which in the reference are that organisation's own products and here
 * are whatever the association chooses to put there.
 *
 * ------------------------------------------------------------ what is drawn
 *
 * Every block returns `null` when it has nothing. A state whose editor has
 * filled in four sections has a four-section page, not eleven boxes of
 * apology — and the grid closes up behind the ones that are missing.
 */

/* ------------------------------------------------------------------ shared */

/**
 * `h-full` IS LOAD-BEARING.
 *
 * A grid row stretches its items by default, but only the grid ITEM — the card
 * inside it still sizes to its own content and leaves a gap under the shorter
 * one. Two cards side by side that stop at different heights read as a broken
 * grid however carefully their tops line up, so every card fills its row and
 * the row's height is set by the tallest thing in it.
 */
export const CARD_SURFACE =
    'rounded-2xl border border-gray-200 bg-white '
    + 'shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_28px_-20px_rgba(28,46,104,0.3)]';

export const DASH_CARD = `h-full ${CARD_SURFACE}`;

/**
 * Every card's heading: an icon, a title, and the way to the full list.
 *
 * One component because eleven cards share it, and because "View All" has to
 * mean the same thing and sit in the same place on all of them.
 */
function CardHead({ icon, title, viewAllHref, onViewAll, viewAllLabel = 'View All' }: {
    icon: string;
    title: string;
    /** Where the full list lives, when it is a page. */
    viewAllHref?: string;
    /**
     * What to open, when the whole thing is already on this page.
     *
     * Both forms exist because both are honest: a feed of forty media releases
     * belongs on its own paged URL, and a description already in the payload
     * belongs in a dialog. What must never happen is a control that links to a
     * route the server has no list for — which is what About and Leaders were
     * doing.
     */
    onViewAll?: () => void;
    viewAllLabel?: string;
}) {
    return (
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
            <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                                 bg-brand-50 text-brand-600">
                    <CmsIcon name={icon} size={16} fallback="grid" />
                </span>
                {/* 22px, the size every card heading on the platform is set
                    at — the business-account screens included. */}
                <h2 className="text-[1.0625rem] sm:text-[1.1875rem] font-extrabold text-brand-800
                               leading-tight">
                    {title}
                </h2>
            </div>
            {viewAllHref ? (
                <Link
                    to={viewAllHref}
                    className="inline-flex shrink-0 items-center gap-1.5 text-[1.25rem] font-bold
                               text-brand-600 hover:text-brand-800 transition-colors"
                >
                    {viewAllLabel} <ArrowRight size={14} />
                </Link>
            ) : onViewAll ? (
                <button
                    type="button"
                    onClick={onViewAll}
                    className="inline-flex shrink-0 items-center gap-1.5 text-[1.0625rem] font-bold
                               text-brand-600 hover:text-brand-800 transition-colors"
                >
                    {viewAllLabel} <ArrowRight size={15} />
                </button>
            ) : null}
        </div>
    );
}

/**
 * A panel for the things a card could not fit.
 *
 * Escape closes, the backdrop closes, and the page behind it stops scrolling —
 * all three, because a dialog that can only be dismissed one way is a trap for
 * whoever cannot use that way.
 */
export function DetailDialog({ title, onClose, children }: {
    title: string;
    onClose: () => void;
    children: React.ReactNode;
}) {
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

    return (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 sm:p-6">
            <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="absolute inset-0 bg-slate-900/50"
            />
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="relative w-full sm:max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white
                           shadow-2xl border border-gray-200 flex flex-col"
            >
                <header className="shrink-0 flex items-start gap-4 border-b border-gray-200 px-6 py-4">
                    <h2 className="flex-1 min-w-0 text-[1.5625rem] font-extrabold text-brand-800">{title}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg
                                   border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50"
                    >
                        <X size={16} />
                    </button>
                </header>

                <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">{children}</div>
            </div>
        </div>
    );
}

/** Every leader, with the biography the card had no room for. */
export function AllLeaders({ leaders }: { leaders: RegionLeader[] }) {
    return (
        <ul className="space-y-6">
            {leaders.map((person, i) => (
                <li key={person.id || i} className="flex items-start gap-4">
                    {/* A PORTRAIT FRAME, 3:4, holding the whole photograph. */}
                    <span className="w-28 aspect-[3/4] shrink-0 overflow-hidden rounded-xl bg-gray-100
                                     border border-gray-200">
                        <PersonPhoto url={person.photoUrl} name={person.name} width={200} fallbackSize={24} />
                    </span>

                    <div className="min-w-0">
                        <p className="text-[1.0625rem] font-extrabold text-brand-900">{person.name}</p>
                        {person.role && (
                            <span className="mt-1 inline-block rounded-full bg-brand-700 px-2.5 py-0.5
                                             text-[1rem] font-bold uppercase tracking-wide text-white">
                                {person.role}
                            </span>
                        )}
                        {person.designation && (
                            <p className="mt-1.5 text-[1.25rem] font-semibold text-gray-600">
                                {person.designation}
                            </p>
                        )}
                        {person.organisation && (
                            <p className="text-[1.25rem] font-semibold text-gray-600">
                                {person.organisation}
                            </p>
                        )}
                        {person.bio && (
                            <p className="mt-2 text-[1.25rem] leading-relaxed font-semibold text-gray-500">
                                {person.bio}
                            </p>
                        )}
                    </div>
                </li>
            ))}
        </ul>
    );
}

/* -------------------------------------------------------------------- hero */

/**
 * The band across the top: photograph, name, four facts, and the glance card.
 *
 * The photograph is washed over from the left rather than simply darkened,
 * because the words sit on the left and the map card on the right — a flat
 * overlay would dim the photograph everywhere to protect text that is only on
 * one side of it.
 */
export function StateHeroBand({
    hero, title, blurb, backLabel, backHref, glanceTitle = 'State at a Glance', aside,
    showGlance = true,
}: {
    hero: RegionHero;
    title: string;
    /**
     * The paragraph under the headline.
     *
     * The state page has no About card any more — the design puts the state's
     * description here, in the band, and the caller passes whichever of the two
     * fields it wants printed. Absent, the band falls back to `hero.tagline`,
     * which is what the region pages still use and what this band has always
     * drawn.
     */
    blurb?: string;
    backLabel?: string;
    backHref?: string;
    /** "Region at a Glance" on a region page. The card is otherwise identical. */
    glanceTitle?: string;
    /**
     * WHAT STANDS IN THE RIGHT-HAND COLUMN.
     *
     * The state page puts its map there — the association asked for the map to
     * be in the band rather than further down the page, and the band is the one
     * place on the page with a column free. Given one, the Glance card moves to
     * a slim row directly under the band: it is CMS content and is not lost, it
     * simply stops competing with the map for the same 20rem.
     *
     * Absent — which is every page but this one — the column holds the Glance
     * card exactly as it always has.
     */
    aside?: React.ReactNode;
    /**
     * Draw the Glance card at all.
     *
     * The state page asked for it off. `aside` alone could not express that —
     * an absent aside means "nothing displaced it", which is exactly when the
     * Glance card SHOULD appear, so removing the map silently brought the card
     * back. Two different questions needed two different answers.
     *
     * The field stays in the CMS and the region pages still draw it; this is
     * one page choosing not to.
     */
    showGlance?: boolean;
}) {
    const headline = hero.headline || title;
    const lede = blurb || hero.tagline;

    return (
        <section className="relative overflow-hidden rounded-[1.5rem]">
            <div className="absolute inset-0 bg-brand-900">
                {hero.backgroundUrl && (
                    <img
                        src={sizedMediaUrl(hero.backgroundUrl, 1600)}
                        alt=""
                        aria-hidden="true"
                        /* Above the fold, so eager — but decoded off the main
                           thread, which keeps a large photograph from blocking
                           the first paint. */
                        decoding="async"
                        className="h-full w-full object-cover"
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-brand-900 via-brand-900/90
                                to-brand-900/30" />
            </div>

            {/*
              * ==================================================================
              * THE BAND HAS TO LEAVE ROOM FOR THE THING THE PAGE IS FOR
              * ==================================================================
              *
              * A reader opening a region or a state page should see the
              * leadership. They were opening on this band alone: forty pixels of
              * padding, a 48px headline, six lines of description and two rows
              * of fact chips came to about 480px, and with the header and the
              * section heading above them the first portrait started below the
              * fold on a laptop.
              *
              * Every measurement below is a step down from what it was — the
              * padding, the headline, the chips — and the description is
              * clamped to three lines. None of it is removed: the band still
              * carries the name, the introduction and the figures, and it now
              * does it in a little over three hundred pixels, which is what
              * leaves the bench on screen.
              */}
            <div className="relative z-10 grid gap-6 px-6 py-6 sm:px-8 sm:py-7
                            lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-center">
                <div className="min-w-0">
                    {backHref && (
                        <Link
                            to={backHref}
                            /* No `backdrop-blur`: five blurred surfaces over a
                                full-bleed photograph make the compositor
                                re-sample the image on every frame of a scroll,
                                which is the judder that was reported. A solid
                                translucent fill looks the same at this opacity. */
                            className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3.5 py-1.5
                                       text-[1.0625rem] font-bold text-white ring-1 ring-white/25
                                       transition-colors hover:bg-white/30"
                        >
                            <MapPin size={12} /> {backLabel} <ChevronRight size={12} />
                        </Link>
                    )}

                    <h1 className="mt-3 text-[2.1875rem] sm:text-4xl font-black tracking-tight text-white
                                   leading-[1.05]">
                        {headline}
                    </h1>

                    {/*
                      * `max-w-2xl`, not `max-w-xl`: this is a paragraph of
                      * description rather than a one-line tagline, and at the
                      * narrower measure the state descriptions ran to seven lines
                      * against a photograph, which is a wall rather than an
                      * introduction.
                      *
                      * AND CLAMPED TO THREE LINES. The South’s runs to six, which
                      * is an article in a space meant for an opening sentence.
                      * Clamped rather than cut: the whole paragraph is still in
                      * the page, still selectable, still read aloud and still
                      * found by a search — only its height is capped. Trimming
                      * the string would lose what an editor wrote, and that is
                      * not this component’s to lose.
                      */}
                    {lede && (
                        <p className={`mt-3 ${BAND_MEASURE} text-[1.0625rem] sm:text-[1.1875rem] font-semibold
                                      leading-relaxed text-white/80 line-clamp-3`}>
                            {lede}
                        </p>
                    )}

                    {hero.facts.length > 0 && (
                        /*
                         * ON ONE LINE, AND SO ON ONE ROW.
                         *
                         * The label sat ABOVE the figure, which made each chip 64px
                         * tall; four of them then wrapped to two rows and the four
                         * facts alone were 138px of the band — a third of it, spent
                         * on four short phrases.
                         *
                         * The label is still there, and it still has to be: "8" with
                         * nothing beside it is a number with no question attached.
                         * It is simply beside the figure now rather than over it, at
                         * 36px a chip, and the four fit one row.
                         */
                        <ul className="mt-4 flex flex-wrap gap-2">
                            {hero.facts.map((fact, i) => (
                                <li
                                    key={i}
                                    className="flex items-center gap-2 rounded-lg bg-white/15 px-3 py-1.5
                                               ring-1 ring-white/20"
                                >
                                    <CmsIcon
                                        name={fact.icon}
                                        size={14}
                                        fallback="map-pin"
                                        className="shrink-0 text-white/70"
                                    />
                                    {fact.label && (
                                        <span className="text-[1rem] font-semibold text-white/60">
                                            {fact.label}
                                        </span>
                                    )}
                                    <span className="text-[1rem] font-bold text-white">
                                        {fact.value}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* ---- state at a glance ---- */}
                {/*
                  * `CARD_SURFACE`, NOT `DASH_CARD` — the one card on the site
                  * that must NOT fill its row.
                  *
                  * `h-full` on a grid item resolves against the ROW, and the row
                  * here is as tall as the headline, the paragraph and four fact
                  * chips beside it. `items-start` keeps the item from stretching
                  * but does nothing about a height of 100% declared on the item
                  * itself — so three claims sat at the top of a card with a
                  * hundred pixels of white under them, which reads as a list
                  * that failed to finish loading.
                  */}
                {/* ---- whatever the page puts in this column ---- */}
                {aside}

                {/* ---- state at a glance, when nothing displaced it ---- */}
                {!aside && showGlance && (hero.glance.length > 0 || hero.sideImageUrl) && (
                    <div className={`${CARD_SURFACE} p-4 sm:p-5`}>
                        <div className="flex items-start gap-4">
                            {hero.sideImageUrl && (
                                <img
                                    src={sizedMediaUrl(hero.sideImageUrl, 320)}
                                    alt=""
                                    aria-hidden="true"
                                    className="hidden sm:block h-28 w-auto object-contain shrink-0"
                                loading="lazy"
                            decoding="async"
                        />
                            )}

                            <div className="min-w-0 flex-1">
                                {/* A RULE UNDER THE HEADING, AND BETWEEN THE
                                    ROWS — as the design draws them. Three
                                    claims with nothing between them read as one
                                    paragraph broken oddly; the rules are what
                                    make them three answers. */}
                                <h2 className="text-[1.1875rem] font-extrabold text-brand-800 pb-3
                                               mb-3 border-b border-gray-200">
                                    {glanceTitle}
                                </h2>
                                <ul className="divide-y divide-gray-100">
                                    {hero.glance.map((row, i) => (
                                        <li key={i} className="flex items-start gap-2.5 py-2.5
                                                               first:pt-0 last:pb-0">
                                            <span className="flex h-8 w-8 shrink-0 items-center justify-center
                                                             rounded-lg bg-brand-50 text-brand-600">
                                                <CmsIcon name={row.icon} size={15} fallback="trending-up" />
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block text-[1.0625rem] font-extrabold
                                                                 text-brand-900 leading-snug">
                                                    {row.title}
                                                </span>
                                                {row.subtitle && (
                                                    <span className="block text-[1.25rem] font-semibold
                                                                     text-gray-500">
                                                        {row.subtitle}
                                                    </span>
                                                )}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}

/**
 * THE GLANCE ROWS, ON THEIR OWN, ACROSS THE PAGE.
 *
 * The band's right-hand column is one column, and the state page now puts its
 * map in it. These three claims are CMS content and had to go somewhere; across
 * the width, directly under the band, they read as a continuation of it rather
 * than as a card that lost its place — and at three abreast they are shorter
 * than they were stacked in the corner.
 */
export function GlanceRow({ items, title = 'State at a Glance' }: {
    items: { icon: string; title: string; subtitle: string }[];
    title?: string;
}) {
    const rows = (items || []).filter((row) => row.title);
    if (!rows.length) return null;

    return (
        <section className={`${CARD_SURFACE} px-5 py-5 sm:px-6`}>
            <p className="mb-4 text-center text-[1.0625rem] font-bold uppercase tracking-[0.16em]
                          text-brand-500">
                {title}
            </p>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((row, i) => (
                    <li key={i} className="flex items-start justify-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg
                                         bg-brand-50 text-brand-600">
                            <CmsIcon name={row.icon} size={16} fallback="trending-up" />
                        </span>
                        <span className="min-w-0">
                            <span className="block text-[1.0625rem] font-extrabold leading-snug
                                             text-brand-900">
                                {row.title}
                            </span>
                            {row.subtitle && (
                                <span className="block text-[1.25rem] font-semibold text-gray-500">
                                    {row.subtitle}
                                </span>
                            )}
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}

/* ------------------------------------------------------------------- about */

export function AboutCard({ title, text, features, viewAllHref, places, placesLabel }: {
    title: string;
    text: string;
    features: { icon: string; label: string }[];
    /** The full description, on its own screen. */
    viewAllHref?: string;
    /**
     * The states a region is made of, under the paragraph.
     *
     * They had a card of their own — eight rows and eight chevrons — to say
     * what this paragraph says in its first sentence. As chips they belong to
     * the text that introduces them, and the grid row they were occupying went
     * back to the feeds.
     */
    places?: { name: string; slug: string; hasPage: boolean }[];
    placesLabel?: string;
}) {
    const rows = (places || []).filter((row) => row.name);
    if (!text && !features.length && !rows.length) return null;

    return (
        /*
          * A COLUMN, with the feature tiles pinned to the foot.
          *
          * `CARD_SURFACE`, NOT `DASH_CARD`: this card no longer shares a row
          * with anything it has to match. It runs the full width of the page
          * above the leadership bands, and `h-full` there resolves against a
          * row nothing else is in — which is how six hundred pixels of white
          * ended up between the paragraph and the feature tiles.
          *
          * `mt-auto` stays. It costs nothing at natural height and it is what
          * keeps the tiles on the bottom edge if this card is ever put beside
          * something taller again.
          */
        <section className={`${CARD_SURFACE} flex flex-col`}>
            <CardHead icon="user" title={title} viewAllHref={viewAllHref} viewAllLabel="View More" />

            {text && (
                <p className="px-5 pb-4 text-[1.0625rem] leading-relaxed font-semibold
                              text-gray-600 whitespace-pre-line">
                    {text}
                </p>
            )}

            {rows.length > 0 && (
                <div className="px-5 pb-5">
                    {placesLabel && (
                        <p className="text-[1rem] font-bold uppercase tracking-[0.12em]
                                      text-gray-400 mb-2.5">
                            {placesLabel}
                        </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                        {rows.map((row) => (row.hasPage ? (
                            <Link
                                key={row.slug || row.name}
                                to={`/states/${row.slug}`}
                                className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5
                                           text-[1.0625rem] font-bold text-brand-700 transition-colors
                                           hover:bg-brand-100 hover:text-brand-800"
                            >
                                <MapPin size={12} className="shrink-0 text-brand-400" />
                                {row.name}
                            </Link>
                        ) : (
                            /* Listed, not linked: a state whose page is not
                               written yet is still part of the region, and a
                               link to a 404 reads as a broken site. */
                            <span
                                key={row.slug || row.name}
                                className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5
                                           text-[1.0625rem] font-bold text-gray-400"
                            >
                                <MapPin size={12} className="shrink-0" />
                                {row.name}
                            </span>
                        )))}
                    </div>
                </div>
            )}

            {features.length > 0 && (
                <div className="mt-auto grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-100
                                border-t border-gray-100">
                    {features.map((feature, i) => (
                        <div key={i} className="bg-[#f7f9fc] px-3 py-4 text-center">
                            <span className="mx-auto mb-2 flex h-9 w-9 items-center justify-center
                                             rounded-lg bg-white text-brand-600 border border-brand-100">
                                <CmsIcon name={feature.icon} size={16} fallback="star" />
                            </span>
                            <span className="block text-[1.25rem] font-bold text-brand-800 leading-snug">
                                {feature.label}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

/* ----------------------------------------------------------------- leaders */

export function LeadersCard({ leaders, title, viewAllHref, onViewAll, onOpen }: {
    leaders: RegionLeader[];
    title: string;
    viewAllHref?: string;
    onViewAll?: () => void;
    onOpen: (leader: RegionLeader) => void;
}) {
    const people = (leaders || []).filter((p) => p.name || p.designation);
    if (!people.length) return null;

    return (
        <section className={DASH_CARD}>
            <CardHead icon="users" title={title} viewAllHref={viewAllHref} onViewAll={onViewAll} />

            {/*
              * A ROW EACH, NOT TWO LARGE PORTRAITS SIDE BY SIDE.
              *
              * Two things were wrong with the pair of big pictures. The frame
              * was as wide as half the card and only 13rem tall, so
              * `object-cover` cropped a head-and-shoulders photograph through
              * the forehead — and a tall frame, which fixes that, made this
              * card half again the height of the About card beside it, leaving
              * the extra height in THAT card as a band of white.
              *
              * A row is short, so the two cards finish within twenty pixels of
              * each other, and the thumbnail keeps a portrait's own 3/4 shape,
              * so nothing is cropped off the face.
              */}
            {/* TWO ROWS. A third pushed this card past the About card beside
                it — the region page, with a chairman, a vice chairman and a
                secretary, was showing a 103px band of white in About. The rest
                of the bench is one click away. */}
            <ul className="divide-y divide-gray-100 border-t border-gray-100">
                {people.slice(0, 2).map((person, i) => (
                    <li key={person.id || i}>
                        <button
                            type="button"
                            onClick={() => onOpen(person)}
                            className="group flex w-full items-center gap-3.5 px-5 py-3 text-left
                                       transition-colors hover:bg-brand-50/40"
                        >
                            {/* 4rem, and `py-3`: this card must come out SHORTER
                                than the About card beside it at every width, or
                                the row stretches to this one and the difference
                                lands in About as a band of white under its
                                text. Measured: 270px here against About's 294
                                at the widest the site is read at. */}
                            <span className="w-16 shrink-0 aspect-[3/4] overflow-hidden rounded-xl
                                             bg-gray-100 border border-gray-200">
                                <PersonPhoto url={person.photoUrl} name={person.name} width={200} fallbackSize={24} />
                            </span>

                            {/*
                              * THREE LINES, NEVER FOUR.
                              *
                              * The name and the role share a line and the two
                              * lines under them are single-line, because THIS
                              * card's height is what decides whether the About
                              * card beside it ends with a band of white. A
                              * leader whose designation wrapped to two lines
                              * pushed this card past the About card and the
                              * difference landed there — which is what the
                              * shorter state descriptions were showing. The
                              * whole text is in the profile this row opens.
                              */}
                            <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2 min-w-0">
                                    <span className="truncate text-[1.0625rem] sm:text-[1.25rem] font-extrabold
                                                     text-brand-900 group-hover:text-brand-600
                                                     transition-colors">
                                        {person.name}
                                    </span>
                                    {person.role && (
                                        <span className="shrink-0 rounded-full bg-brand-700 px-2 py-0.5
                                                         text-[0.9375rem] font-bold uppercase tracking-wide
                                                         text-white">
                                            {person.role}
                                        </span>
                                    )}
                                </span>
                                {person.designation && (
                                    <span className="mt-1 block truncate text-[1.0625rem] font-semibold
                                                     text-gray-600">
                                        {person.designation}
                                    </span>
                                )}
                                {person.organisation && (
                                    <span className="block truncate text-[1.0625rem] font-semibold
                                                     text-gray-600">
                                        {person.organisation}
                                    </span>
                                )}
                            </span>

                            <ChevronRight size={15} className="shrink-0 text-gray-300" />
                        </button>
                    </li>
                ))}
            </ul>
        </section>
    );
}

/* ------------------------------------------------------- the leadership board */

/**
 * ONE TIER OF THE LEADERSHIP BOARD — a row of portraits with names under them.
 *
 * =========================================================================
 * THREE TIERS, STACKED, WITH NO FILTER BETWEEN THEM
 * =========================================================================
 *
 * The state page shows State, then Region, then District, one board under the
 * next. It used to show the state's bench in a card beside About and nothing
 * else, and the association's design puts all three on the page at once —
 * because a visitor looking for who to speak to does not know which tier the
 * person they want sits on, and a control that hides two thirds of the answer
 * behind a pair of pills is a control they have to guess at.
 *
 * There is deliberately NO region/district switch. It was drawn as one and
 * taken out: two tab strips over one board meant the district bench could only
 * be reached by finding a tab, and on a phone the second strip scrolled off the
 * side of the screen. Stacked, everything is on the page and the scroll bar is
 * the only control.
 *
 * ---------------------------------------------------------------- one board
 *
 * The same component draws all three, because they are the same list of the
 * same people under three headings. Three components would be three places to
 * fix the next thing and three chances for one tier to look unlike the others.
 *
 * ------------------------------------------------------------ what is drawn
 *
 * `null` when the tier has nobody. A state with no district bench entered yet
 * has a two-tier board, not a heading over an empty white box — the rule every
 * card on this page follows.
 */
export function LeadershipBoard({
    title, leaders, icon = 'users', eyebrow, viewAllHref, onViewAll, onOpen, columns = 5,
}: {
    title: string;
    leaders: RegionLeader[];
    icon?: string;
    /** "District" / "Region" — which tier this is, above the heading. */
    eyebrow?: string;
    viewAllHref?: string;
    onViewAll?: () => void;
    onOpen: (leader: RegionLeader) => void;
    /**
     * How many portraits fit across at the widest.
     *
     * Five is the design's own, for a board that has the width of the page.
     * TWO is for a board sharing a row with another board — a district bench
     * four across inside half a column is a 105px card, which cuts "Mr S
     * Balamurugan" to "Mr S Balamurugan" on two lines and every designation to
     * "District Chairman,…". The count is passed in because the board cannot
     * measure the box it has been put in: Tailwind's breakpoints are the
     * VIEWPORT's, and at 1440px the viewport is wide while this particular card
     * is not.
     */
    columns?: 2 | 3 | 4 | 5;
}) {
    const people = (leaders || []).filter((p) => p?.name || p?.designation);
    if (!people.length) return null;

    /*
     * THE ROW NARROWS TO THE BENCH, AND STOPS AT THREE.
     *
     * Five columns is what the design draws and what a full council fills. A
     * council of two in a five-column grid is two cards and three columns of
     * white, which reads as photographs that failed to load — so the track
     * count comes down to the number of people there actually are.
     *
     * It stops at three because the alternative is worse in the other
     * direction: two cards across the whole width of the page are two
     * portraits the height of a laptop screen, which makes a bench of two look
     * like the most important thing on the page. Three keeps the card roughly
     * the size it is on every other tier — unless the caller has asked for
     * fewer than three, which a board sharing a row does, and then that is the
     * ceiling.
     *
     * The classes are WRITTEN OUT, one complete string per track count.
     * `xl:grid-cols-${n}` is a string Tailwind's scanner never sees, so the
     * rule is never generated and the board falls back to one column at the
     * width it matters most — silently, which is why this is a lookup and not
     * a template.
     */
    const fits = Math.min(columns, Math.max(Math.min(columns, 3), people.length));

    /*
     * NEVER LEAVE ONE PORTRAIT ALONE ON THE LAST ROW.
     *
     * A bench of five in a four-column grid is a full row and then a single
     * card against three columns of white, which reads as a photograph that
     * failed rather than as the fifth member of a council. One column narrower
     * puts three and two, which reads as a list that wrapped.
     *
     * Only when there is a column to give up: at two tracks a remainder of one
     * is unavoidable, and dropping to one would make every card the width of
     * the card.
     */
    const tracks = (fits > 2 && people.length % fits === 1) ? fits - 1 : fits;
    /*
     * THE BREAKPOINTS ARE THE MAIN COLUMN'S, NOT THE SCREEN'S.
     *
     * This board stands in a column with a 20rem rail beside it, so the width
     * it actually has is roughly the viewport less 21rem — and the naive ramp
     * (four across from `lg`) put four 130px cards in a 588px column at 1024px
     * wide, with every name broken over three lines and the fifth portrait
     * alone on a row of its own.
     *
     * Measured against `SCREEN_CONTAINER`'s gutters (64px at `lg`, 112px at
     * `xl`, 144px from `2xl`) and that rail, the main column is about 560px at
     * `lg`, 790px at `xl` and 1010px at `2xl` — which is three, four and five
     * cards of a size a name fits on. The numbers moved when the page moved
     * off the header bar's 48px gutter; the ramp did not have to.
     */
    const GRID: Record<number, string> = {
        2: 'grid-cols-2',
        3: 'grid-cols-2 sm:grid-cols-3',
        4: 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4',
        /* Straight from three to five, with no four in between: a bench of
           five in a four-column grid is one row of four and a fifth portrait
           alone on a row of its own, beside three columns of white. The five
           are 168px wide at the narrowest this applies at, which a name and
           two clamped lines fit. */
        5: 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-5',
    };
    const grid = GRID[tracks] || GRID[3];

    return (
        <section className={DASH_CARD}>
            {eyebrow && (
                <p className="px-5 pt-4 text-[1rem] font-bold uppercase tracking-[0.14em]
                              text-brand-400">
                    {eyebrow}
                </p>
            )}
            <div className={eyebrow ? '-mt-2' : ''}>
                <CardHead icon={icon} title={title} viewAllHref={viewAllHref} onViewAll={onViewAll} />
            </div>

            <div className="border-t border-gray-100 p-5">
                <ul className={`grid gap-4 ${grid}`}>
                    {people.slice(0, Math.max(columns, 4) * 2).map((person, i) => (
                        <li key={person.id || i}>
                            <button
                                type="button"
                                onClick={() => onOpen(person)}
                                className="group flex h-full w-full flex-col overflow-hidden rounded-xl
                                           border border-gray-200 bg-white text-left transition-all
                                           hover:border-brand-200
                                           hover:shadow-[0_12px_28px_-18px_rgba(28,46,104,0.55)]"
                            >
                                {/*
                                  * `object-top`, and a landscape frame.
                                  *
                                  * A formal portrait has the head in the top
                                  * third; a centred crop of one takes the face
                                  * off and leaves a tie. The frame is the
                                  * design's own 4/3 so five sit across a
                                  * desktop row without each card becoming a
                                  * column of its own.
                                  */}
                                <span className="relative block w-full aspect-[4/3] overflow-hidden
                                                 bg-gradient-to-b from-gray-100 to-gray-200">
                                    {person.photoUrl ? (
                                        <PersonPhoto
                                            url={person.photoUrl}
                                            name={person.name}
                                            width={400}
                                            imgClassName="transition-transform duration-500
                                                          group-hover:scale-[1.04]"
                                        />
                                    ) : (
                                        <span className="flex h-full w-full items-center justify-center
                                                         text-gray-300">
                                            <User size={28} />
                                        </span>
                                    )}

                                    {person.role && (
                                        <span className="absolute bottom-0 left-0 max-w-full truncate
                                                         rounded-tr-lg bg-brand-800/95 px-2.5 py-1
                                                         text-[0.9375rem] font-bold uppercase
                                                         tracking-wide text-white">
                                            {person.role}
                                        </span>
                                    )}
                                </span>

                                <span className="flex flex-1 flex-col gap-0.5 px-3 py-3">
                                    <span className="text-[1.25rem] font-extrabold leading-snug
                                                     text-brand-900 transition-colors
                                                     group-hover:text-brand-600">
                                        {person.name || 'Name to be confirmed'}
                                    </span>
                                    {/*
                                      * Clamped, not truncated. A designation
                                      * reading "Chairman, ACTIV Tamil Nadu
                                      * State Council" is two lines of useful
                                      * text; cut at one it reads "Chairman,
                                      * ACTIV Tamil…" and says nothing the badge
                                      * has not already said. The whole of it is
                                      * in the profile this card opens.
                                      */}
                                    {/* Two lines RESERVED, not merely allowed. A
                                        one-line designation beside a two-line
                                        one starts the firm under it a line
                                        higher, and in a row of five that is
                                        four different baselines. `em`, so the
                                        reservation follows the type size. */}
                                    {person.designation && (
                                        <span className="line-clamp-2 min-h-[2.6em] text-balance
                                                         text-[1.0625rem] font-semibold leading-snug text-gray-600">
                                            {person.designation}
                                        </span>
                                    )}
                                    {person.organisation && (
                                        <span className="line-clamp-2 min-h-[2.6em] text-balance
                                                         text-[1.0625rem] font-semibold leading-snug text-gray-500">
                                            {person.organisation}
                                        </span>
                                    )}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}

/**
 * A whole list, in a panel, for the lists that are too short to deserve a page.
 *
 * Everything a card clips — the summary in full, the body, the date and place,
 * the link and the file. The dashboard card shows four rows of title; this is
 * what "View All" means when there is nothing on the other side of a link worth
 * loading a screen for.
 */
export function FeedDetails({ items }: { items: RegionFeedItem[] }) {
    const rows = (items || []).filter((row) => row.title);
    if (!rows.length) {
        return (
            <p className="text-[1.0625rem] font-semibold text-gray-500">
                Nothing has been published here yet.
            </p>
        );
    }

    return (
        <ul className="space-y-4">
            {rows.map((row, i) => (
                <li key={row.id || i} className="rounded-xl border border-gray-200 bg-[#f7f9fc] p-4">
                    <div className="flex items-start gap-4">
                        {row.imageUrl && (
                            <span className="hidden sm:block w-28 shrink-0 aspect-[4/3] overflow-hidden
                                             rounded-lg bg-gray-100">
                                <img
                                    src={sizedMediaUrl(row.imageUrl, 160)}
                                    alt=""
                                    aria-hidden="true"
                                    loading="lazy"
                                    className="h-full w-full object-cover"
                                />
                            </span>
                        )}

                        <div className="min-w-0 flex-1">
                            {(row.date || row.location) && (
                                <p className="text-[1rem] font-bold uppercase tracking-wider
                                              text-brand-500 mb-1">
                                    {[row.date, row.location].filter(Boolean).join(' \u00b7 ')}
                                </p>
                            )}

                            <p className="text-[1.25rem] font-extrabold text-brand-900 leading-snug">
                                {row.title}
                            </p>

                            {row.summary && (
                                <p className="mt-1.5 text-[1.0625rem] font-semibold leading-relaxed
                                              text-gray-600">
                                    {row.summary}
                                </p>
                            )}
                            {row.body && (
                                <p className="mt-2 text-[1.25rem] font-semibold leading-relaxed text-gray-500
                                              whitespace-pre-line">
                                    {row.body}
                                </p>
                            )}

                            {(row.href || row.fileUrl) && (
                                <div className="mt-3 flex flex-wrap gap-4">
                                    {row.href && (
                                        row.href.startsWith('/') ? (
                                            <Link to={row.href} className={PANEL_LINK}>
                                                Read more <ChevronRight size={13} />
                                            </Link>
                                        ) : (
                                            <a
                                                href={row.href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={PANEL_LINK}
                                            >
                                                Read more <ArrowRight size={13} />
                                            </a>
                                        )
                                    )}
                                    {row.fileUrl && (
                                        <a
                                            href={resolveMediaUrl(row.fileUrl)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={PANEL_LINK}
                                        >
                                            Download <ArrowRight size={13} />
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </li>
            ))}
        </ul>
    );
}

const PANEL_LINK =
    'inline-flex items-center gap-1.5 text-[1.25rem] font-bold text-brand-600 '
    + 'hover:text-brand-800 transition-colors';

/* ----------------------------------------------------------------- gallery */

/**
 * The photograph strip, with its own pager.
 *
 * Four at a time and a circular arrow, as the design has it. Not a marquee
 * here: this sits between two dense cards, and something moving of its own
 * accord in the middle of a page of figures pulls the eye off them.
 */
export function GalleryCard({ state, region, href, photos }: {
    state?: string;
    region?: string;
    href: string;
    photos?: GalleryPhoto[];
}) {
    const [rows, setRows] = useState<GalleryPhoto[]>(photos || []);
    const [page, setPage] = useState(0);
    const [open, setOpen] = useState<number | null>(null);

    useEffect(() => {
        if (photos) { setRows(photos); return undefined; }
        let cancelled = false;
        listRegionGallery({ state, region, limit: 24 })
            .then((result) => { if (!cancelled) setRows(result.items || []); })
            .catch(() => { /* the card is simply not drawn */ });
        return () => { cancelled = true; };
    }, [state, region, photos]);

    if (!rows.length) return null;

    const PER = 4;
    const pages = Math.ceil(rows.length / PER);
    const shown = rows.slice(page * PER, page * PER + PER);

    return (
        <section className={`${DASH_CARD} relative`}>
            {/*
              * "View All" ONLY WHEN THERE IS MORE THAN THIS.
              *
              * The card holds four and pages through the rest; a state with
              * exactly four photographs was offering a screen that repeated
              * what was already on it. With four or fewer the photographs open
              * in the lightbox where they were clicked.
              */}
            <CardHead
                icon="images"
                title="Photo Gallery"
                viewAllHref={rows.length > PER ? href : undefined}
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-5 pb-5">
                {shown.map((photo, i) => (
                    <button
                        key={photo.id}
                        type="button"
                        onClick={() => setOpen(page * PER + i)}
                        className="group text-left"
                    >
                        <div className="w-full aspect-[4/3] overflow-hidden rounded-lg bg-gray-100">
                            <CmsMediaFrame
                                media={photo.media}
                                width={340}
                                className="group-hover:scale-105 transition-transform duration-500 transform-gpu"
                            />
                        </div>
                        <p className="mt-2.5 text-[1.0625rem] font-bold text-brand-800 leading-snug
                                      line-clamp-2 group-hover:text-brand-600 transition-colors">
                            {photo.title}
                        </p>
                        {(photo.location || photo.eventDate) && (
                            <p className="mt-1 flex items-center gap-1 text-[1rem] font-semibold
                                          text-gray-400">
                                <MapPin size={10} className="shrink-0" />
                                <span className="truncate">
                                    {[photo.location, photo.eventDate].filter(Boolean).join(' · ')}
                                </span>
                            </p>
                        )}
                    </button>
                ))}
            </div>

            {pages > 1 && (
                <button
                    type="button"
                    aria-label="Next photographs"
                    onClick={() => setPage((p) => (p + 1) % pages)}
                    className="absolute right-3 top-1/2 flex h-9 w-9 items-center justify-center
                               rounded-full bg-white text-brand-700 shadow-lg border border-gray-200
                               transition-colors hover:bg-brand-50"
                >
                    <ChevronRight size={17} />
                </button>
            )}

            {open !== null && (
                <PhotoLightbox
                    photos={rows}
                    index={open}
                    onIndex={setOpen}
                    onClose={() => setOpen(null)}
                />
            )}
        </section>
    );
}

/** One photograph, large, with the whole set reachable from it. */
export function PhotoLightbox({ photos, index, onIndex, onClose }: {
    photos: GalleryPhoto[];
    index: number;
    onIndex: (i: number) => void;
    onClose: () => void;
}) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') onIndex((index + 1) % photos.length);
            if (e.key === 'ArrowLeft') onIndex((index - 1 + photos.length) % photos.length);
        };
        document.addEventListener('keydown', onKey);
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = previous;
        };
    }, [index, photos.length, onIndex, onClose]);

    const photo = photos[index];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
            <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="absolute inset-0 bg-slate-900/85 backdrop-blur-sm"
            />
            <div
                role="dialog"
                aria-modal="true"
                aria-label={photo.title || 'Photograph'}
                className="relative z-10 w-full max-w-4xl"
            >
                <div className="rounded-2xl overflow-hidden bg-black">
                    <img
                        src={sizedMediaUrl(photo.media.url, 1400)}
                        alt={photo.media.alt || photo.title}
                        className="w-full max-h-[70vh] object-contain"
                    loading="lazy"
                            decoding="async"
                        />
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-[1.375rem] font-extrabold text-white">{photo.title}</p>
                        {(photo.category || photo.state) && (
                            <p className="mt-0.5 text-[1.25rem] font-semibold text-white/60">
                                {[photo.category, photo.state].filter(Boolean).join(' · ')}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[1.0625rem] font-bold text-white/60 tabular-nums">
                            {index + 1} / {photos.length}
                        </span>
                        <button type="button" aria-label="Previous"
                            onClick={() => onIndex((index - 1 + photos.length) % photos.length)}
                            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10
                                       text-white transition-colors hover:bg-white/20">
                            <ChevronLeft size={18} />
                        </button>
                        <button type="button" aria-label="Next"
                            onClick={() => onIndex((index + 1) % photos.length)}
                            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10
                                       text-white transition-colors hover:bg-white/20">
                            <ChevronRight size={18} />
                        </button>
                        <button type="button" aria-label="Close" onClick={onClose}
                            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10
                                       text-white transition-colors hover:bg-white/20">
                            <X size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* -------------------------------------------------------------- statistics */

export function StatisticsCard({ items, title = 'Statistics', icon = 'trending-up',
    viewAllHref, onViewAll }: {
    items: RegionFeedItem[];
    title?: string;
    /** A custom section drawn as figures chooses its own. */
    icon?: string;
    viewAllHref?: string;
    onViewAll?: () => void;
}) {
    const rows = (items || []).filter((row) => row.title);
    if (!rows.length) return null;

    return (
        <section className={DASH_CARD}>
            <CardHead icon={icon} title={title} viewAllHref={viewAllHref} onViewAll={onViewAll} />
            <ul className="px-5 pb-5 space-y-4">
                {rows.slice(0, 5).map((row, i) => (
                    <li key={row.id || i} className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg
                                         bg-brand-50 text-brand-600">
                            <CmsIcon name={row.icon} size={17} fallback="award" />
                        </span>
                        <span className="min-w-0">
                            {/*
                              * THE FIGURE SETS ITSELF.
                              *
                              * This field is not always a number. "Automotive |
                              * Textiles | Leather | Electronics" is a perfectly
                              * good answer to "major sectors", and at the size
                              * a figure is set it wrapped to two lines of
                              * display type and pushed the row below it off the
                              * card. Past about twenty characters it is prose,
                              * not a number, and is set as prose — still bold,
                              * still the loud half of the row, but at a size a
                              * sentence survives.
                              */}
                            <span className={(row.title || '').length > 20
                                ? 'block text-[1.1875rem] font-black tracking-tight text-brand-800 leading-snug'
                                : 'block text-[1.5625rem] font-black tracking-tight text-brand-800 leading-none'}
                            >
                                {row.title}
                            </span>
                            {row.summary && (
                                <span className="block mt-1.5 text-[1.0625rem] font-semibold text-gray-500">
                                    {row.summary}
                                </span>
                            )}
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}

/* ------------------------------------------------------------------ events */

/**
 * `Sep` / `16` from whatever the editor typed.
 *
 * `date` is free text on purpose — "Nov 12, 2026 to Nov 13, 2026" is a real
 * answer and no date picker produces it. So this PARSES rather than assumes: a
 * string a browser can read becomes a month-and-day chip, and anything else is
 * printed as it was written. Never a guess, and never 1970.
 */
const dateChip = (value: string): { top: string; bottom: string } | null => {
    const raw = String(value || '').trim();
    if (!raw) return null;

    const parsed = new Date(raw.split(/\s+to\s+/i)[0]);
    if (Number.isNaN(parsed.getTime())) return null;

    return {
        top: parsed.toLocaleDateString('en-GB', { month: 'short' }),
        bottom: String(parsed.getDate()),
    };
};

export function EventsCard({ items, viewAllHref, onViewAll, title = 'Events',
    icon = 'calendar' }: {
    items: RegionFeedItem[];
    viewAllHref?: string;
    onViewAll?: () => void;
    title?: string;
    icon?: string;
}) {
    const rows = (items || []).filter((row) => row.title);
    if (!rows.length) return null;

    return (
        <section className={DASH_CARD}>
            <CardHead icon={icon} title={title} viewAllHref={viewAllHref} onViewAll={onViewAll} />

            <ul className="divide-y divide-gray-100 border-t border-gray-100">
                {rows.slice(0, 4).map((row, i) => {
                    const chip = dateChip(row.date);
                    const body = (
                        <>
                            {chip ? (
                                <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center
                                                 rounded-lg bg-brand-50 leading-none">
                                    <span className="text-[1rem] font-bold uppercase text-brand-500">
                                        {chip.top}
                                    </span>
                                    <span className="text-[1.0625rem] font-black text-brand-800">
                                        {chip.bottom}
                                    </span>
                                </span>
                            ) : (
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center
                                                 rounded-lg bg-brand-50 text-brand-500">
                                    <CmsIcon name="calendar" size={16} />
                                </span>
                            )}

                            <span className="min-w-0 flex-1">
                                <span className="block text-[1.0625rem] font-bold text-brand-900
                                                 leading-snug line-clamp-2">
                                    {row.title}
                                </span>
                                {row.location && (
                                    <span className="mt-1 block text-[1.25rem] font-semibold text-gray-500
                                                     truncate">
                                        {row.location}
                                    </span>
                                )}
                                {/* The raw date, when it was not a date a
                                    browser could read — "every second Tuesday"
                                    is still worth printing. */}
                                {!chip && row.date && (
                                    <span className="mt-0.5 block text-[1.0625rem] font-semibold text-gray-500">
                                        {row.date}
                                    </span>
                                )}
                            </span>

                            <ChevronRight size={15} className="shrink-0 text-gray-300" />
                        </>
                    );

                    const cls = 'flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-brand-50/40';
                    return (
                        <li key={row.id || i}>
                            {row.href
                                ? <Link to={row.href} className={cls}>{body}</Link>
                                : viewAllHref
                                    ? <Link to={viewAllHref} className={cls}>{body}</Link>
                                    : <div className={cls}>{body}</div>}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

/* ------------------------------------------------- projects and consulting */

/** A row list with a thumbnail — Projects. */
export function ThumbListCard({ icon, title, items, viewAllHref, onViewAll }: {
    icon: string;
    title: string;
    items: RegionFeedItem[];
    viewAllHref?: string;
    onViewAll?: () => void;
}) {
    const rows = (items || []).filter((row) => row.title);
    if (!rows.length) return null;

    return (
        <section className={DASH_CARD}>
            <CardHead icon={icon} title={title} viewAllHref={viewAllHref} onViewAll={onViewAll} />

            <ul className="divide-y divide-gray-100 border-t border-gray-100">
                {rows.slice(0, 4).map((row, i) => {
                    const body = (
                        <>
                            <span className="h-11 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                                {row.imageUrl ? (
                                    <img
                                        src={sizedMediaUrl(row.imageUrl, 160)}
                                        alt=""
                                        aria-hidden="true"
                                        className="h-full w-full object-cover"
                                    loading="lazy"
                            decoding="async"
                        />
                                ) : (
                                    <span className="flex h-full w-full items-center justify-center
                                                     text-brand-200">
                                        <CmsIcon name={row.icon} size={16} fallback="image" />
                                    </span>
                                )}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-[1.0625rem] font-bold text-brand-700
                                                 leading-snug line-clamp-1">
                                    {row.title}
                                </span>
                                {row.summary && (
                                    <span className="mt-1 block text-[1.25rem] font-semibold text-gray-500
                                                     line-clamp-2 leading-snug">
                                        {row.summary}
                                    </span>
                                )}
                            </span>
                            <ChevronRight size={15} className="shrink-0 text-gray-300" />
                        </>
                    );

                    const cls = 'flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-brand-50/40';
                    return (
                        <li key={row.id || i}>
                            {row.href
                                ? <Link to={row.href} className={cls}>{body}</Link>
                                : viewAllHref
                                    ? <Link to={viewAllHref} className={cls}>{body}</Link>
                                    : <div className={cls}>{body}</div>}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

/** A row list with an icon — Consulting Services. */
export function IconListCard({ icon, title, items, viewAllHref, onViewAll, limit = 4 }: {
    icon: string;
    title: string;
    items: RegionFeedItem[];
    viewAllHref?: string;
    onViewAll?: () => void;
    /**
     * Four in the grid, because four rows is the height that keeps this card
     * level with the cards beside it. In the RAIL there is nothing beside it,
     * so the cap is the caller's — and the design's rail card carries five.
     */
    limit?: number;
}) {
    const rows = (items || []).filter((row) => row.title);
    if (!rows.length) return null;

    return (
        <section className={DASH_CARD}>
            <CardHead icon={icon} title={title} viewAllHref={viewAllHref} onViewAll={onViewAll} />

            <ul className="divide-y divide-gray-100 border-t border-gray-100">
                {rows.slice(0, limit).map((row, i) => (
                    <li key={row.id || i}>
                        <div className="flex items-center gap-3 px-5 py-3.5 transition-colors
                                        hover:bg-brand-50/40">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg
                                             bg-brand-50 text-brand-600">
                                <CmsIcon name={row.icon} size={17} fallback="briefcase" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-[1.0625rem] font-bold text-brand-700
                                                 leading-snug">
                                    {row.title}
                                </span>
                                {row.summary && (
                                    <span className="mt-1 block text-[1.25rem] font-semibold text-gray-500
                                                     line-clamp-2 leading-snug">
                                        {row.summary}
                                    </span>
                                )}
                            </span>
                            <ChevronRight size={15} className="shrink-0 text-gray-300" />
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}

/* -------------------------------------------------------------------- rail */

export function ExploreCard({ card }: {
    card: { imageUrl: string; title: string; subtitle: string; href: string };
}) {
    if (!card?.title && !card?.imageUrl) return null;

    /* `h-full` with a floor: this card now shares a row with two lists whose
       height is set by their content, and a fixed 14rem picture beside a 20rem
       list is a card that stops two thirds of the way down the row. The floor
       is what it used to be, for the case where it stands alone. */
    const inner = (
        <div className="relative h-full min-h-[14rem] overflow-hidden rounded-2xl">
            {card.imageUrl ? (
                <img
                    src={sizedMediaUrl(card.imageUrl, 640)}
                    alt=""
                    aria-hidden="true"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
                            decoding="async"
                        />
            ) : (
                <div className="h-full w-full bg-brand-800" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-brand-900/90 via-brand-900/40 to-transparent" />

            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5">
                <div className="min-w-0">
                    <p className="text-[1.0625rem] font-bold uppercase tracking-wider text-white/70">
                        Explore
                    </p>
                    <p className="text-[1.5625rem] font-black tracking-tight text-white leading-tight">
                        {card.title}
                    </p>
                    {card.subtitle && (
                        <p className="mt-1 text-[1.0625rem] font-semibold text-white/80 leading-snug">
                            {card.subtitle}
                        </p>
                    )}
                </div>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white
                                 text-brand-800 shadow-lg">
                    <ArrowRight size={16} />
                </span>
            </div>
        </div>
    );

    return card.href
        ? <Link to={card.href} className="group block h-full">{inner}</Link>
        : <div className="group block h-full">{inner}</div>;
}

export function QuickLinksCard({ links, title = 'Quick Links' }: {
    links: { label: string; href: string }[];
    title?: string;
}) {
    const rows = (links || []).filter((row) => row.label);
    if (!rows.length) return null;

    return (
        <section className={DASH_CARD}>
            <CardHead icon="grid" title={title} />
            <ul className="divide-y divide-gray-100 border-t border-gray-100">
                {rows.map((row, i) => {
                    const body = (
                        <>
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md
                                             bg-brand-50 text-brand-600">
                                <ChevronRight size={13} />
                            </span>
                            <span className="min-w-0 flex-1 text-[1.25rem] font-bold text-brand-700 truncate">
                                {row.label}
                            </span>
                            <ChevronRight size={14} className="shrink-0 text-gray-300" />
                        </>
                    );
                    const cls = 'flex items-center gap-2.5 px-5 py-3 transition-colors hover:bg-brand-50/40';
                    return (
                        <li key={i}>
                            {/* An internal path routes; anything else is a real
                                anchor with the safety attributes. */}
                            {row.href?.startsWith('/')
                                ? <Link to={row.href} className={cls}>{body}</Link>
                                : row.href
                                    ? <a href={row.href} target="_blank" rel="noopener noreferrer" className={cls}>{body}</a>
                                    : <div className={cls}>{body}</div>}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

/**
 * The association's own banners in the rail.
 *
 * The reference has two of that organisation's products here. Ours are whatever
 * an editor puts in `promoCards` — which is why this is a list and not two
 * blocks written into the page.
 */
export function PromoCards({ cards }: {
    cards: { imageUrl: string; title: string; subtitle: string; href: string }[];
}) {
    const rows = (cards || []).filter((row) => row.title || row.imageUrl);
    if (!rows.length) return null;

    return (
        <>
            {rows.map((card, i) => {
                const inner = (
                    <div className={`${DASH_CARD} overflow-hidden`}>
                        {card.imageUrl && (
                            <img
                                src={sizedMediaUrl(card.imageUrl, 640)}
                                alt=""
                                aria-hidden="true"
                                className="h-28 w-full object-cover"
                            loading="lazy"
                            decoding="async"
                        />
                        )}
                        {(card.title || card.subtitle) && (
                            <div className="px-5 py-4">
                                {card.title && (
                                    <p className="text-[1.0625rem] font-extrabold text-brand-800">
                                        {card.title}
                                    </p>
                                )}
                                {card.subtitle && (
                                    <p className="mt-0.5 text-[1.0625rem] font-semibold text-gray-500">
                                        {card.subtitle}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                );
                return card.href
                    ? <Link key={i} to={card.href} className="block">{inner}</Link>
                    : <div key={i}>{inner}</div>;
            })}
        </>
    );
}

export function PublicationsRail({ items, viewAllHref, onViewAll, title = 'Publications' }: {
    items: RegionFeedItem[];
    viewAllHref?: string;
    onViewAll?: () => void;
    title?: string;
}) {
    const rows = (items || []).filter((row) => row.title);
    if (!rows.length) return null;

    return (
        <section className={DASH_CARD}>
            <CardHead icon="book-open" title={title} viewAllHref={viewAllHref} onViewAll={onViewAll} />
            <ul className="divide-y divide-gray-100 border-t border-gray-100">
                {rows.slice(0, 4).map((row, i) => (
                    <li key={row.id || i} className="flex items-start gap-3 px-5 py-3">
                        <span className="h-12 w-10 shrink-0 overflow-hidden rounded bg-gray-100">
                            {row.imageUrl ? (
                                <img
                                    src={sizedMediaUrl(row.imageUrl, 160)}
                                    alt=""
                                    aria-hidden="true"
                                    className="h-full w-full object-cover"
                                loading="lazy"
                            decoding="async"
                        />
                            ) : (
                                <span className="flex h-full w-full items-center justify-center text-brand-200">
                                    <CmsIcon name="file-text" size={15} />
                                </span>
                            )}
                        </span>
                        <span className="min-w-0">
                            <span className="block text-[1.0625rem] font-bold text-brand-800 leading-snug
                                             line-clamp-2">
                                {row.title}
                            </span>
                            {(row.summary || row.date) && (
                                <span className="mt-1 block text-[1.0625rem] font-semibold text-gray-400
                                                 line-clamp-1">
                                    {[row.summary, row.date].filter(Boolean).join(' · ')}
                                </span>
                            )}
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}

/* --------------------------------------------------------- custom sections */

/** A section that is a paragraph rather than a list. */
export function TextCard({ title, icon, text, viewAllHref, onViewAll }: {
    title: string;
    icon: string;
    text: string;
    viewAllHref?: string;
    onViewAll?: () => void;
}) {
    if (!text) return null;
    return (
        <section className={`${DASH_CARD} flex flex-col`}>
            <CardHead
                icon={icon || 'file-text'}
                title={title}
                viewAllHref={viewAllHref}
                onViewAll={onViewAll}
                viewAllLabel="View More"
            />
            <p className="px-5 pb-5 text-[1.0625rem] leading-relaxed font-semibold text-gray-600
                          whitespace-pre-line">
                {text}
            </p>
        </section>
    );
}

/**
 * A section the association invented, drawn by the card its layout names.
 *
 * =========================================================================
 * NO NEW STYLING PATH
 * =========================================================================
 *
 * Every branch here returns a card this page already uses. That is what makes a
 * section created in the CMS at four o'clock line up with the sections that
 * shipped — same heading, same height rule, same "View All", same type scale.
 * A bespoke renderer for custom sections would be a second design to keep in
 * step with the first, and it would fall behind on the first change.
 */
export function CustomSectionCard({ section, viewAllHref, onViewAll }: {
    section: CustomSection;
    viewAllHref?: string;
    onViewAll?: () => void;
}) {
    const { title, icon, layout, items } = section;
    if (!title) return null;

    if (layout === 'text') {
        return (
            <TextCard
                title={title}
                icon={icon}
                text={section.text || section.intro}
                viewAllHref={viewAllHref}
                onViewAll={onViewAll}
            />
        );
    }

    if (!items.length) return null;

    if (layout === 'figures') {
        return (
            <StatisticsCard
                items={items}
                title={title}
                icon={icon || 'trending-up'}
                viewAllHref={viewAllHref}
                onViewAll={onViewAll}
            />
        );
    }

    if (layout === 'dated') {
        return (
            <EventsCard
                items={items}
                title={title}
                icon={icon || 'calendar'}
                viewAllHref={viewAllHref}
                onViewAll={onViewAll}
            />
        );
    }

    if (layout === 'tiles') {
        return (
            <ThumbListCard
                icon={icon || 'image'}
                title={title}
                items={items}
                viewAllHref={viewAllHref}
                onViewAll={onViewAll}
            />
        );
    }

    return (
        <IconListCard
            icon={icon || 'grid'}
            title={title}
            items={items}
            viewAllHref={viewAllHref}
            onViewAll={onViewAll}
        />
    );
}

/* ----------------------------------------------------------------- contact */

export function ContactCard({ contact, stateName, showForm, officeLabel = 'State Office' }: {
    contact: RegionOffice;
    stateName: string;
    showForm: boolean;
    /** "Regional Office" on a region page. */
    officeLabel?: string;
}) {
    const has = !!(contact.personName || contact.email || contact.phone
        || contact.addressLines.length);
    if (!has) return null;

    return (
        <section className={DASH_CARD}>
            <CardHead icon="phone" title="Contact Us" />

            {/*
              * THREE COLUMNS THAT READ AS THREE COLUMNS.
              *
              * They were a photograph, a form and a pair of headed lists, set
              * side by side with nothing to say they belonged to one another —
              * so only the right-hand column appeared to have a heading, and
              * the other two looked like things that had come to rest there.
              *
              * One label at the top of each, all three on the same line, and a
              * rule between them. The rule turns horizontal when they stack,
              * because a vertical divider between stacked blocks divides
              * nothing.
              */}
            <div className="grid border-t border-gray-100 divide-y divide-gray-100
                            lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,0.75fr)]
                            lg:divide-y-0 lg:divide-x">

                {/* ---- who ---- */}
                <div className="p-5">
                    <p className={COL_LABEL}>{officeLabel}</p>
                    <div className="flex items-start gap-4">
                        <span className="w-20 shrink-0 aspect-[3/4] overflow-hidden rounded-xl bg-gray-100
                                         border border-gray-200">
                            <PersonPhoto url={contact.photoUrl} name={contact.personName}
                                width={240} fallbackSize={22} />
                        </span>

                        <div className="min-w-0 text-[1.0625rem] leading-relaxed">
                            {contact.personName && (
                                <p className="text-[1.25rem] font-extrabold text-brand-900 leading-snug">
                                    {contact.personName}
                                </p>
                            )}
                            {contact.designation && (
                                <p className="font-semibold text-gray-500">{contact.designation}</p>
                            )}
                            {contact.addressLines.length > 0 && (
                                <address className="not-italic mt-2 font-semibold text-gray-600">
                                    {contact.addressLines.map((line, i) => (
                                        <span key={i} className="block">{line}</span>
                                    ))}
                                    {[contact.city, contact.state].filter(Boolean).length > 0 && (
                                        <span className="block">
                                            {[contact.city, contact.state].filter(Boolean).join(', ')}
                                            {contact.pincode ? ` - ${contact.pincode}` : ''}
                                        </span>
                                    )}
                                </address>
                            )}
                        </div>
                    </div>
                </div>

                {/* ---- the form ---- */}
                {showForm && (
                    <div className="p-5">
                        <p className={COL_LABEL}>Write to Us</p>
                        <WriteToUs state={stateName} />
                    </div>
                )}

                {/* ---- reach us ---- */}
                <div className="p-5">
                    <p className={COL_LABEL}>Reach Us</p>

                    <ul className="space-y-2.5 text-[1.0625rem] font-semibold text-gray-600">
                        {contact.phone && (
                            <li>
                                <a href={`tel:${contact.phone}`} className={REACH_LINK}>
                                    <Phone size={13} className="shrink-0 text-brand-500" /> {contact.phone}
                                </a>
                            </li>
                        )}
                        {contact.email && (
                            <li>
                                <a href={`mailto:${contact.email}`} className={`${REACH_LINK} break-all`}>
                                    <Mail size={13} className="shrink-0 text-brand-500" /> {contact.email}
                                </a>
                            </li>
                        )}
                        {contact.mapUrl && (
                            <li>
                                <a
                                    href={contact.mapUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={REACH_LINK}
                                >
                                    <Globe size={13} className="shrink-0 text-brand-500" />
                                    Find us on the map
                                </a>
                            </li>
                        )}
                    </ul>

                    {/* No "Follow Us" here. The footer carries the
                        association's social links on every page; a second set
                        of them halfway up this one was one block too many, and
                        it was the block that never lined up with the two
                        columns beside it. `socialLinks` stays in the CMS. */}
                </div>
            </div>
        </section>
    );
}

/* --------------------------------------------------------- the contact strip */

/** One line in the region or district contact column. */
export interface ReachRow {
    label: string;
    /** Where that place's own page is, when it has one. */
    href?: string;
    phone: string;
    email: string;
}

/**
 * THE THREE TIERS AGAIN, AS PLACES TO RING.
 *
 * =========================================================================
 * THE SAME ANSWER THE BOARD GIVES, IN THE FORM A VISITOR CAN ACT ON
 * =========================================================================
 *
 * The board above says who; this says how to reach them, at the same three
 * levels and in the same order — the state office in full, then the region's
 * places, then the state's districts. The association asked for the region and
 * the district to be presented "the same way Tamil Nadu's contact is", and a
 * strip that gave the state a photograph and an address while the other two
 * tiers had nowhere to appear at all was the thing being complained about.
 *
 * ------------------------------------------------ why the columns differ
 *
 * The first column is ONE office, so it is drawn as one: a photograph, a name,
 * a designation and an address. The other two are LISTS of places, so they are
 * drawn as lists: a name, a telephone number and an email address per row. Two
 * lists forced into the first column's shape would be a page of repeated
 * photographs of nobody; one office forced into a row would throw its address
 * away.
 *
 * ------------------------------------------------------------- empty tiers
 *
 * A column with nothing in it is not drawn, and the grid closes up behind it —
 * a region whose states have entered no telephone numbers yet leaves a
 * two-column strip, not a headed empty third. Nothing at all returns `null`.
 *
 * ---------------------------------------------------------------- the form
 *
 * Under all three, across the full width, rather than as a fourth column. It is
 * the only block here a reader types into, the columns are a reference and it
 * is an action, and squeezing a name, an email and a message box into a third
 * of a column is what made it unusable on a laptop.
 */
export function ContactStrip({
    contact, stateName, showForm, regionLabel, regionContacts, districtContacts,
    officeLabel, regionColumnLabel = 'Region Contacts',
}: {
    contact: RegionOffice;
    /** The place this strip belongs to — a state, or a region. */
    stateName: string;
    showForm: boolean;
    /** "South Region" — printed in brackets after the middle column's heading. */
    regionLabel: string;
    regionContacts: ReachRow[];
    districtContacts: ReachRow[];
    /**
     * The first column's heading. Defaults to "<name> State Contact", which is
     * what the design prints on a state page; a region passes its own, because
     * "South Region State Contact" is not a thing.
     */
    officeLabel?: string;
    /**
     * The middle column's heading, WITHOUT the bracketed place.
     *
     * "Region Contacts" on a state page, where the column lists the region's
     * other states. "State Contacts" on a region page, where it lists the
     * region's states. Same column, same shape, and the heading has to say
     * which of the two it is — a region page headed "Region Contacts (South
     * Region)" claims to be listing regions and is listing states.
     */
    regionColumnLabel?: string;
}) {
    const office = contact || ({} as RegionOffice);
    const hasOffice = !!(office.personName || office.email || office.phone
        || (office.addressLines || []).length);
    const region = (regionContacts || []).filter((row) => row?.label);
    const districts = (districtContacts || []).filter((row) => row?.label);

    if (!hasOffice && !region.length && !districts.length && !showForm) return null;

    /*
     * THE COLUMN COUNT FOLLOWS WHAT THERE IS TO SHOW.
     *
     * Fixed at three, a strip with only the state office filled in put that
     * office in the left third and left two thirds of the card empty — which
     * reads as content that failed to load rather than as content nobody has
     * written yet.
     */
    const columns = [hasOffice, region.length > 0, districts.length > 0]
        .filter(Boolean).length;
    const grid = columns >= 3
        ? 'lg:grid-cols-3'
        : columns === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-1';

    return (
        <section className={DASH_CARD}>
            <CardHead icon="phone" title="Contact Us" />

            <div className={`grid border-t border-gray-100 divide-y divide-gray-100
                             ${grid} lg:divide-y-0 lg:divide-x`}>

                {/* ---- the state office, in full ---- */}
                {hasOffice && (
                    <div className="p-5">
                        <p className={COL_LABEL}>
                            {officeLabel || `${stateName} State Contact`}
                        </p>

                        <div className="flex items-start gap-4">
                            <span className="w-20 shrink-0 aspect-[3/4] overflow-hidden rounded-xl
                                             bg-gray-100 border border-gray-200">
                                <PersonPhoto url={office.photoUrl} name={office.personName}
                                    width={240} fallbackSize={22} />
                            </span>

                            <div className="min-w-0 text-[1.25rem] leading-relaxed">
                                {office.personName && (
                                    <p className="text-[1.0625rem] font-extrabold text-brand-900
                                                  leading-snug">
                                        {office.personName}
                                    </p>
                                )}
                                {office.designation && (
                                    <p className="font-semibold text-gray-500">{office.designation}</p>
                                )}

                                <ul className="mt-2 space-y-1.5 font-semibold text-gray-600">
                                    {office.phone && (
                                        <li>
                                            <a href={`tel:${office.phone}`} className={REACH_LINK}>
                                                <Phone size={13} className="shrink-0 text-brand-500" />
                                                {office.phone}
                                            </a>
                                        </li>
                                    )}
                                    {office.email && (
                                        <li>
                                            <a
                                                href={`mailto:${office.email}`}
                                                className={`${REACH_LINK} break-all`}
                                            >
                                                <Mail size={13} className="shrink-0 text-brand-500" />
                                                {office.email}
                                            </a>
                                        </li>
                                    )}
                                    {office.mapUrl && (
                                        <li>
                                            <a
                                                href={office.mapUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={REACH_LINK}
                                            >
                                                <Globe size={13} className="shrink-0 text-brand-500" />
                                                Find us on the map
                                            </a>
                                        </li>
                                    )}
                                </ul>

                                {(office.addressLines || []).length > 0 && (
                                    <address className="not-italic mt-2 flex items-start gap-2
                                                        font-semibold text-gray-600">
                                        <MapPin size={13} className="mt-1 shrink-0 text-brand-500" />
                                        <span>
                                            {(office.addressLines || []).map((line, i) => (
                                                <span key={i} className="block">{line}</span>
                                            ))}
                                            {[office.city, office.state].filter(Boolean).length > 0 && (
                                                <span className="block">
                                                    {[office.city, office.state].filter(Boolean).join(', ')}
                                                    {office.pincode ? ` - ${office.pincode}` : ''}
                                                </span>
                                            )}
                                        </span>
                                    </address>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ---- the region's places ---- */}
                {region.length > 0 && (
                    <div className="p-5">
                        <p className={COL_LABEL}>
                            {regionColumnLabel}{regionLabel ? ` (${regionLabel})` : ''}
                        </p>
                        <ReachList rows={region} />
                    </div>
                )}

                {/* ---- the state's districts ---- */}
                {districts.length > 0 && (
                    <div className="p-5">
                        <p className={COL_LABEL}>
                            District Contacts{stateName ? ` (${stateName})` : ''}
                        </p>
                        <ReachList rows={districts} />
                    </div>
                )}
            </div>

            {showForm && (
                <div className="border-t border-gray-100 p-5">
                    <p className={COL_LABEL}>Write to Us</p>
                    <WriteToUs state={stateName} />
                </div>
            )}
        </section>
    );
}

/**
 * A column of places, each with the ways to reach it.
 *
 * ONE ROW PER PLACE, AND THE ROW WRAPS RATHER THAN TRUNCATES. A three-column
 * table of name / telephone / email is what the design draws and what fits a
 * desktop; at the width of a phone the same three set side by side cut an email
 * address to "chennai@…", which is not an email address. So the row is a flex
 * that wraps, and a long address takes a second line instead of losing its end.
 */
function ReachList({ rows }: { rows: ReachRow[] }) {
    return (
        <ul className="divide-y divide-gray-100 -my-2">
            {rows.map((row, i) => (
                <li key={`${row.label}-${i}`} className="py-2.5">
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                        <span className="min-w-[7rem] flex-1 text-[1.25rem] font-bold text-brand-900">
                            {row.href ? (
                                <Link to={row.href} className="transition-colors hover:text-brand-600">
                                    {row.label}
                                </Link>
                            ) : row.label}
                        </span>

                        <span className="flex flex-wrap items-center gap-x-4 gap-y-1
                                         text-[1.0625rem] font-semibold text-gray-600">
                            {row.phone && (
                                <a href={`tel:${row.phone}`} className={REACH_LINK}>
                                    <Phone size={12} className="shrink-0 text-brand-500" />
                                    {row.phone}
                                </a>
                            )}
                            {row.email && (
                                <a
                                    href={`mailto:${row.email}`}
                                    className={`${REACH_LINK} break-all`}
                                >
                                    <Mail size={12} className="shrink-0 text-brand-500" />
                                    {row.email}
                                </a>
                            )}
                        </span>
                    </div>
                </li>
            ))}
        </ul>
    );
}

/** One label, so all three columns start on the same line. */
const COL_LABEL =
    'text-[1rem] font-bold uppercase tracking-[0.12em] text-gray-400 mb-3';

const REACH_LINK =
    'flex items-center gap-2 transition-colors hover:text-brand-700';

/**
 * The message form.
 *
 * NO IMAGE CAPTCHA. The reference has one; an image-only challenge locks out
 * every reader using a screen reader, and the endpoint is already rate-limited.
 * A honeypot catches the bots that matter.
 */
function WriteToUs({ state }: { state: string }) {
    const [form, setForm] = useState({ name: '', email: '', message: '' });
    const [trap, setTrap] = useState('');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    const field = 'w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-[1.0625rem] '
        + 'font-semibold text-brand-900 hover:border-gray-400 focus:outline-none focus:ring-2 '
        + 'focus:ring-brand-600 focus:border-transparent transition-colors '
        + 'placeholder:font-medium placeholder:text-gray-500';

    if (sent) {
        return (
            <div className="flex items-start gap-2.5 rounded-lg bg-emerald-50 px-4 py-4">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                <p className="text-[1.0625rem] font-semibold text-emerald-900">
                    Thank you — your message has been sent. The {state} office will be in touch.
                </p>
            </div>
        );
    }

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');
        if (trap) { setSent(true); return; }
        if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
            setError('Your name, email address and message are needed.');
            return;
        }
        setSending(true);
        try {
            await sendContactMessage({
                name: form.name,
                email: form.email,
                subject: `Write to us — ACTIV ${state}`,
                message: form.message,
            });
            setSent(true);
        } catch (err) {
            setError(errorMessage(err, 'Your message could not be sent. Please try again.'));
        } finally {
            setSending(false);
        }
    };

    return (
        <form onSubmit={submit} className="space-y-2.5">
            <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={trap}
                onChange={(e) => setTrap(e.target.value)}
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
            />

            <div className="grid gap-2.5 sm:grid-cols-2">
                <input
                    className={field}
                    placeholder="Your name *"
                    aria-label="Your name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <input
                    type="email"
                    className={field}
                    placeholder="Your email *"
                    aria-label="Your email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
            </div>
            <textarea
                rows={3}
                className={field}
                placeholder="Your message *"
                aria-label="Your message"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
            />

            {error && <p className="text-[1.0625rem] font-bold text-red-600">{error}</p>}

            <button
                type="submit"
                disabled={sending}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-5 py-2.5
                           text-[1.0625rem] font-bold text-white transition-colors
                           hover:bg-brand-800 disabled:opacity-60"
            >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {sending ? 'Sending…' : 'Send Message'}
            </button>
        </form>
    );
}
