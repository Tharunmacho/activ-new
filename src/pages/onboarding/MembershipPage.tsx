import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight, Award, Check, ChevronDown, Mail, Globe2,
} from 'lucide-react';
import { HeaderSection } from '../../components/layout/HeaderSection';
import { FooterSection } from '../../components/layout/FooterSection';
import { SCREEN_CONTAINER } from '@/components/layout/pageContainer';
import {
    SECTION_HEADING, SECTION_LEDE, EYEBROW, MICRO_LABEL, HERO_HEADING, HERO_LEDE, BAND_MEASURE } from '@/components/layout/typography';
import { BIZ_CARD } from '@/components/layout/surface';
import { Reveal } from '@/components/shared/Reveal';
import { AcrossIndia } from '@/components/shared/AcrossIndia';
import { CmsIcon } from '@/components/shared/CmsIcon';
import { CmsExtraFields } from '@/components/shared/CmsExtraFields';
import { sectionHidden } from '@/components/shared/cmsSections';
import { SectionFields } from '@/components/shared/SectionFields';
import {
    getMembership, EMPTY_MEMBERSHIP,
    type MembershipContent, type MembershipAdvantage, type MembershipStep,
} from '@/services/cmsMembershipApi';
import {
    MEMBERSHIP_INTRO, WHY_JOIN, ADVANTAGES, JOURNEY, JOURNEY_INTRO,
    WHO_SHOULD_JOIN, WHY_IT_MATTERS, MATTERS_INTRO, CLOSING,
} from './membershipContent';

/**
 * ==========================================================================
 * THE COPY COMES FROM THE CMS, AND THE TABLE IS THE FALLBACK
 * ==========================================================================
 *
 * The prospectus is a CMS document now — `GET /cms/membership` — so the
 * association can revise its own wording without a deploy, which is what
 * every other page on this site has always been able to do.
 *
 * The bundled table STAYS, as the fallback, and that is not laziness. This
 * is approved copy on the page that asks people to join: a failed request
 * must not empty it. While the call is in flight, and if it fails, the page
 * renders exactly what it rendered before any of this — and the reader
 * cannot tell the difference, because the two are the same words.
 *
 * `fromTable` is that fallback in the API’s own shape, so the page has ONE
 * shape to render and no branch anywhere in the layout.
 */
const iconName = (icon: { displayName?: string; name?: string }) => String(
    icon?.displayName || icon?.name || 'award',
).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const fromTable = (): MembershipContent => ({
    ...EMPTY_MEMBERSHIP,
    ...MEMBERSHIP_INTRO,
    whyJoin: {
        heading: WHY_JOIN.heading,
        subtitle: WHY_JOIN.subtitle,
        lead: WHY_JOIN.lead,
        bullets: WHY_JOIN.bullets,
    },
    whoShouldJoin: {
        heading: WHO_SHOULD_JOIN.heading,
        subtitle: '',
        lead: WHO_SHOULD_JOIN.lead,
        bullets: WHO_SHOULD_JOIN.items,
    },
    advantages: ADVANTAGES.map((a) => ({
        slug: a.id,
        number: a.number,
        icon: iconName(a.icon),
        title: a.title,
        subtitle: a.subtitle,
        body: a.body,
        listLead: a.listLead,
        bullets: a.bullets,
        closing: a.closing,
        after: a.after,
    })),
    journeyEyebrow: JOURNEY_INTRO.eyebrow,
    journeyHeading: JOURNEY_INTRO.heading,
    journey: JOURNEY.map((j) => ({
        step: j.step, icon: iconName(j.icon), title: j.title, text: j.body,
    })),
    mattersHeading: MATTERS_INTRO.heading,
    mattersSubtitle: MATTERS_INTRO.subtitle,
    whyItMatters: WHY_IT_MATTERS.map((m) => ({
        step: '', icon: iconName(m.icon), title: m.title, text: m.body,
    })),
    closingHeading: CLOSING.heading,
    closingHeadingHighlight: CLOSING.headingHighlight,
    closingBody: CLOSING.body,
    closingNote: CLOSING.note,
    callHeading: CLOSING.callHeading,
    callLines: CLOSING.callLines,
    statement: CLOSING.statement,
    invitation: CLOSING.invitation,
    enquiriesHeading: CLOSING.enquiriesHeading,
    website: CLOSING.website,
    email: CLOSING.email,
});

/**
 * `/membership` — the association's membership prospectus as a page.
 *
 * The copy is the approved "ACTIV Membership Advantage" document in full and
 * lives in `membershipContent.ts`. This file is layout only.
 *
 * =========================================================================
 * IT USES `SCREEN_CONTAINER`, NOT THE CENTRED PROSE COLUMN
 * =========================================================================
 *
 * Not the centred 1280px one: under a header and footer that run edge to
 * edge, that left 320px of empty white down each side of a 1920px screen and
 * the page read as a narrow strip. Not the header BAR's 48px gutter either —
 * right for chrome, where a logo against the edge of the screen reads as
 * correct, too tight for a wall of body copy and a card, which then read as
 * about to fall off the page.
 *
 * `SCREEN_CONTAINER` is the bar's gutter at small sizes opening to 96px on a wide
 * screen, capped at 1920px. Where there IS body copy — the opening
 * paragraphs, the closing — the measure is capped again inside it
 * (`max-w-[34rem]`, `max-w-[44rem]`), because 1,700px of 18px text is 190
 * characters a line and nobody tracks back from that.
 *
 * =========================================================================
 * THE CARDS AND THE TYPE ARE THE BUSINESS AREA'S, ONE STEP UP
 * =========================================================================
 *
 * `BIZ_CARD` is `pages/business/BusinessUI.tsx`'s card, to the class — the
 * screen a member enters their company details on, and the place the house
 * style has been argued all the way through.
 *
 * The SIZES are its sizes taken up one step, which is what the wide column
 * pays for: a 24px extrabold card heading against its 22px, 17/18px body
 * against its 16px, 17px bold for the line that introduces a list. An early
 * draft of this page ran at 15px to fit more of the document on screen, which
 * is the wrong trade — a prospectus nobody can read comfortably is not
 * shorter, it is unread.
 *
 * =========================================================================
 * A SHUT CARD IS A FIXED SHAPE — THAT IS WHAT CLOSES THE GAPS
 * =========================================================================
 *
 * Grid rows take the height of their tallest cell, so one card whose title
 * wrapped to two lines and whose opening sentence ran to three left the card
 * beside it — "Exhibitions & Business Events. Visibility matters." — with 130
 * pixels of nothing above its button. Eight of the fifteen looked half empty.
 *
 * The three variable blocks therefore reserve their space: the title two
 * lines, the sub-heading two, the teaser three (`line-clamp-3`). Every shut
 * card is then the same height by construction and the grid has no holes in
 * it, at any width. `min-h` in `em` rather than `px`, so it still holds when
 * the root size grows on a monitor wider than 1920 (`html.fluid-scale`).
 *
 * =========================================================================
 * THE WHOLE DOCUMENT IS HERE. IT IS NOT ALL ON SCREEN AT ONCE.
 * =========================================================================
 *
 *   1. THE SHUT CARD IS WORTH READING BY ITSELF — title, the section's own
 *      sub-heading and its opening sentence. A card that only says "Business
 *      Networking ▾" is a filing cabinet, not a page.
 *   2. THE PANEL STAYS IN THE DOM, hidden by a `grid-rows-[0fr]` → `[1fr]`
 *      transition rather than unmounted, so Ctrl+F, printing and search
 *      engines get the whole document.
 *   3. OPEN ALL is one button, for the reader who does want all of it.
 *   4. A LINK TO A CARD OPENS IT — `#procurement`, or a chip in the contents
 *      strip. A shared link that lands on a folded answer has not answered.
 *
 * Rows WRAP and are CENTRED rather than being grid columns, so the fifteen
 * cards (four abreast at `xl`) end in a centred row of three instead of a
 * card-shaped hole on the right. Same reason the journey does it.
 *
 * =========================================================================
 * WHITE CARDS NEED A PAGE THAT IS NOT WHITE
 * =========================================================================
 *
 * Every band on this page is `#f3f6fb` — the paid member dashboard's page
 * colour (`MemberPageShell`'s `<main>`), under the same white `slate-200`
 * card. That pairing is the whole reason a card on those screens reads as a
 * card.
 *
 * Here the bands were white, or `#fbfcff` which is white with a rumour of
 * blue in it, and a white card on a white page has only a hairline to say
 * where it stops. The shadow cannot do the job on its own: it is a soft drop
 * against a background of the same value, so at a glance the grid looked like
 * text with rounded rectangles drawn faintly around it.
 *
 * The navy bands (the hero, the journey) are what break the tint into
 * sections, which is also why the closing band is a touch deeper again.
 *
 * =========================================================================
 * NO TWO NAVY BANDS MAY TOUCH
 * =========================================================================
 *
 * `FooterSection` is `bg-brand-900`. The closing section was too, so the page
 * ended in one continuous field of navy with no edge between the content and
 * the site furniture. The closing band is tinted and its CTA panel carries the
 * navy instead — which also makes the panel the thing the eye lands on.
 */

/* ------------------------------------------------------------------ pieces */


/**
 * `BusinessUI.Card`, WEIGHTED UP for a page that stands on a dotted band.
 *
 * The business screens put their card on a plain `#f3f6fb` page, where a
 * hairline and a soft drop are enough. Here the page carries a dot field, and
 * a texture behind a card eats a 1px border and a 4%-opacity shadow — the
 * cards read as panels printed onto the background rather than as objects on
 * top of it.
 *
 * So: a second hairline (`ring-1`) doubling the edge, a contact shadow at
 * three times the opacity, and a wider, deeper drop. The card is the same
 * card; it is turned up enough to survive what is behind it.
 */
const CARD =
    'group flex h-full flex-col rounded-2xl bg-white border border-slate-200 ring-1 ring-slate-900/[0.04] ' +
    'shadow-[0_2px_4px_rgba(16,24,40,0.06),0_20px_44px_-18px_rgba(16,24,40,0.40)] ' +
    'transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 ' +
    'hover:shadow-[0_4px_8px_rgba(16,24,40,0.08),0_32px_64px_-20px_rgba(16,24,40,0.50)]';

/** The same weight, for a pill: the contents strip and the eligibility list. */
const PILL =
    'rounded-full bg-white border border-slate-200 ring-1 ring-slate-900/[0.04] ' +
    'shadow-[0_2px_4px_rgba(16,24,40,0.06),0_12px_26px_-14px_rgba(16,24,40,0.40)] ' +
    'transition-all duration-200 hover:-translate-y-0.5';

/** The business screen's tinted icon square, in the brand's colour. */
const PLATE =
    'flex items-center justify-center rounded-xl bg-brand-50 ring-1 ring-brand-100 ' +
    'text-brand-600 transition-transform duration-300 group-hover:scale-110';

/** The same square on a navy panel, where a `brand-50` fill would vanish. */
const PLATE_DARK =
    'flex items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 text-white ' +
    'transition-transform duration-300 group-hover:scale-110';

/** A card's heading — `BusinessUI`'s 22px taken up a step. */
const CARD_HEADING = 'text-[1.875rem] font-extrabold leading-[1.2] tracking-tight text-slate-900';

/** Body copy inside a card. */
const CARD_TEXT = 'text-[1.3125rem] xl:text-[1.1875rem] leading-relaxed font-medium text-slate-600';

/** `BusinessUI.Field`'s label — the line that introduces a list. */
const CARD_LEAD = 'text-[1.3125rem] xl:text-[1.1875rem] font-bold text-slate-800';

/**
 * What a band's own added fields are set in.
 *
 * The second and later paragraphs of the opening column, which is the page's
 * ordinary body copy — not the first, which is a lead-in set larger. A field
 * an editor adds is a continuation of the band's prose, so it reads at the
 * size that prose reads at rather than at the browser's default.
 */
const BAND_PROSE = 'text-[1.3125rem] md:text-[1.5625rem] font-bold leading-relaxed tracking-tight text-slate-700';

/** A card's sub-heading — the document's own line under each title. */
const CARD_SUB = 'text-[1.1875rem] font-bold leading-snug text-brand-600';

/**
 * `AboutBlock`'s dot field. Decorative, so it is not authored and carries no
 * text. `z-0` rather than `-z-10`: a negative index puts it behind the band's
 * own opaque background, where it is painted and then covered.
 */
function DotField({ id }: { id: string }) {
    return (
        <div aria-hidden="true" className="absolute top-10 right-0 w-1/2 h-full z-0 opacity-40 pointer-events-none">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id={id} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                        <circle className="fill-brand-300" cx="2" cy="2" r="1.5" />
                    </pattern>
                </defs>
                <rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
            </svg>
        </div>
    );
}

/**
 * `MissionCarousel`'s centred heading block — rule, eyebrow, rule, heading.
 *
 * `heading` is a node rather than a string so a two-tone heading can be passed
 * in. Every section uses this, the opening one included: a heading set inside
 * a half-width column runs to four lines at this size, and the fix is to give
 * it the width rather than to shrink the type.
 */
function SectionHead({
    eyebrow, heading, subtitle, dark = false, children,
}: {
    eyebrow?: string; heading: React.ReactNode; subtitle?: string; dark?: boolean;
    children?: React.ReactNode;
}) {
    return (
        <Reveal className="mx-auto mb-10 flex max-w-5xl flex-col items-center text-center md:mb-12">
            {eyebrow && (
                <div className="flex items-center gap-4 mb-5">
                    <span className={`h-px w-10 ${dark ? 'bg-white/30' : 'bg-brand-300'}`} />
                    <span className={`${EYEBROW} ${dark ? 'text-white/70' : 'text-brand-600'}`}>{eyebrow}</span>
                    <span className={`h-px w-10 ${dark ? 'bg-white/30' : 'bg-brand-300'}`} />
                </div>
            )}
            <h2 className={`${SECTION_HEADING} ${dark ? 'text-white' : 'text-brand-800'}`}>{heading}</h2>
            {subtitle && (
                <p className={`${SECTION_LEDE} mt-4 ${BAND_MEASURE} ${dark ? 'text-white/70' : 'text-brand-600'}`}>
                    {subtitle}
                </p>
            )}
            {children}
        </Reveal>
    );
}

/** A drawn dot, as `LegalPage` uses: the browser's marker drifts when an item wraps. */
function Bullet({ children }: { children: React.ReactNode }) {
    return (
        <li className="mb-2.5 flex break-inside-avoid gap-3">
            <span
                aria-hidden="true"
                className="mt-[0.5625rem] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400"
            />
            <span className={CARD_TEXT}>{children}</span>
        </li>
    );
}

/** A ticked point — where the document makes a promise rather than lists a thing. */
function Ticked({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
    return (
        <li className="mb-3 flex break-inside-avoid gap-3">
            <span
                aria-hidden="true"
                className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full
                            ${dark ? 'bg-white/15 text-white' : 'bg-brand-800 text-white'}`}
            >
                <Check size={13} strokeWidth={3} />
            </span>
            <span
                className={dark
                    ? 'text-[1.3125rem] xl:text-[1.1875rem] leading-relaxed font-medium text-white/85'
                    : CARD_TEXT}
            >
                {children}
            </span>
        </li>
    );
}

/* ------------------------------------------------------- an advantage card */

function AdvantageCard({
    advantage, open, onToggle,
}: { advantage: MembershipAdvantage; open: boolean; onToggle: (slug: string) => void }) {
    /* A NAME now, not a component — the CMS stores what it can store. */
    const icon = advantage.icon;

    /*
     * The opening sentence is the teaser, clamped while the card is shut and
     * released when it opens — rather than repeated inside the panel, which
     * would print it twice to anyone who expanded the card.
     */
    const [lede, ...rest] = advantage.body;
    const panelId = `${advantage.slug}-panel`;

    return (
        <article id={advantage.slug} className={`${CARD} scroll-mt-28 p-6 sm:p-7`}>

            <div className="mb-5 flex items-start justify-between gap-3">
                <span aria-hidden="true" className={`${PLATE} h-[3.25rem] w-[3.25rem]`}>
                    <CmsIcon name={icon} size={24} />
                </span>
                <span className={`${MICRO_LABEL} mt-1 text-brand-300`}>{advantage.number}</span>
            </div>

            {/*
              The title and its sub-heading are NOT given a reserved height.
              Padding a one-line title out to two opens a visible hole between
              it and the line beneath it — the heading stops reading as a pair.
              Only the TEASER reserves space (below), which is where most of
              the variation was, and whatever slack is left collects above the
              button, where `mt-auto` was already putting it.
            */}
            <h3 className={CARD_HEADING}>{advantage.title}</h3>
            <p className={`${CARD_SUB} mt-2`}>{advantage.subtitle}</p>

            {lede && (
                <p className={`mt-3 ${CARD_TEXT} ${open ? '' : 'line-clamp-3 min-h-[4.9em]'}`}>{lede}</p>
            )}

            {/*
              The panel. A row track animated from `0fr` to `1fr` keeps the
              content mounted, and only the track is interpolated — so nothing
              here costs a layout pass the way an animated `height: auto`
              workaround would.
            */}
            <div
                id={panelId}
                className={`grid transition-[grid-template-rows] duration-500 ease-out
                            ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
            >
                <div className="overflow-hidden">
                    <div className="pt-3">
                        {rest.map((paragraph, i) => (
                            <p key={i} className={`mt-3 ${CARD_TEXT}`}>{paragraph}</p>
                        ))}

                        {advantage.listLead && (
                            <p className={`mt-5 ${CARD_LEAD}`}>{advantage.listLead}</p>
                        )}

                        <ul className="mt-3">
                            {advantage.bullets.map((item, i) => (
                                <Bullet key={i}>{item}</Bullet>
                            ))}
                        </ul>

                        {/* The document's own pull quote, where it has one. Set
                            as body copy it disappears. */}
                        {advantage.closing && (
                            <p className="mt-5 rounded-xl border border-brand-100 bg-brand-50/70 px-4 py-4
                                          text-[1.5625rem] font-extrabold leading-snug tracking-tight text-brand-700">
                                {advantage.closing}
                            </p>
                        )}

                        {advantage.after.map((paragraph, i) => (
                            <p key={i} className={`mt-4 ${CARD_TEXT}`}>{paragraph}</p>
                        ))}
                    </div>
                </div>
            </div>

            {/*
              The card's footer: a hairline, the label hard left, the chevron
              hard right. `mt-auto` pins it to the floor of the card, so every
              card in a row ends on the same line and the whole grid reads as
              one row of controls rather than as text that happens to end.

              No count beside the label. It was there to say what opening the
              card was worth, and on a wall of fifteen cards fifteen little
              numbered pills read as data the reader has to take in.
            */}
            <button
                type="button"
                onClick={() => onToggle(advantage.slug)}
                aria-expanded={open}
                aria-controls={panelId}
                className="group/btn mt-auto flex w-full items-center justify-between gap-3 border-t
                           border-slate-100 pt-5 text-[1.1875rem] font-extrabold text-brand-700
                           transition-colors hover:text-brand-900"
            >
                {open ? 'Show less' : "What's included"}
                <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50
                               ring-1 ring-brand-100 transition-colors group-hover/btn:bg-brand-800
                               group-hover/btn:text-white"
                >
                    <ChevronDown
                        size={18}
                        className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
                    />
                </span>
            </button>
        </article>
    );
}

/* -------------------------------------------------------------------- page */

export default function MembershipPage() {
    /*
     * The prospectus, from the CMS, with the bundled table underneath it.
     * See the note on `fromTable`: this page must never be empty.
     */
    const [copy, setCopy] = useState<MembershipContent>(fromTable);

    useEffect(() => {
        let cancelled = false;
        getMembership()
            .then((doc) => {
                /* A document nobody has written yet answers with empty fields;
                   the table is a better page than a blank one. */
                if (!cancelled && doc && doc.advantages?.length) setCopy(doc);
            })
            .catch(() => { /* the table stays */ });
        return () => { cancelled = true; };
    }, []);

    const intro = copy;
    const advantages = copy.advantages;
    const journey = copy.journey;

    /*
     * The seven cards on the Membership screen, one per band on this page
     * — see `cmsSections`. Each band is wrapped rather than each field
     * inside it: removing 'The journey' means the journey band is not on
     * the page, not that it renders empty with its heading still on it.
     */
    const show = (key: string) => !sectionHidden(copy.sections, key);

    /** Which advantages are open, by slug. Shut is the default for all fifteen. */
    const [opened, setOpened] = useState<Record<string, boolean>>({});

    const allOpen = advantages.every((a) => opened[a.slug]);

    const toggle = useCallback((id: string) => {
        setOpened((current) => ({ ...current, [id]: !current[id] }));
    }, []);

    const toggleAll = useCallback(() => {
        setOpened((current) => {
            const everyOpen = advantages.every((a) => current[a.slug]);
            if (everyOpen) return {};
            return Object.fromEntries(advantages.map((a) => [a.slug, true]));
        });
    }, [advantages]);

    /** A chip, or a pasted `#procurement`, opens the card it points at. */
    const reveal = useCallback((id: string) => {
        setOpened((current) => ({ ...current, [id]: true }));
    }, []);

    useEffect(() => {
        document.title = `${intro.title} — ACTIV`;

        const hash = (window.location.hash || '').replace('#', '');
        if (!hash) return;
        if (!advantages.some((a) => a.slug === hash)) return;

        reveal(hash);
        // After the panel has been given its row track, or the browser scrolls
        // to where the card was while it was still shut.
        const timer = window.setTimeout(() => {
            document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
        return () => window.clearTimeout(timer);
    /* `advantages` and the title are read inside, so the effect re-runs when
       the CMS copy arrives — a `#link` opened before the fetch landed would
       otherwise find no card of that name and do nothing. */
    }, [reveal, advantages, intro.title]);

    return (
        <div className="flex flex-col min-h-screen font-sans bg-white">
            <HeaderSection />

            <main className="flex-grow">

                {/* ==================================================== hero
                    ITS OWN SHAPE, DELIBERATELY NOT THE EVENTS BAND.

                    The first attempt at this was `EventsHero` with membership
                    copy in it — left column, circular photo frame, four stat
                    tiles — and it worked, which was the problem: two pages
                    that open identically are two pages a visitor cannot tell
                    apart from the top of the screen. Events already owns the
                    circle-and-figures opening.

                    What this page has that no other page does is a MEMBERSHIP,
                    so the artwork is the card itself: two stacked, tilted
                    cards, the front one carrying the mark, the tier line and
                    the association's promise. Under the copy, instead of stat
                    tiles, the six opening advantages run as a rail of chips
                    that jump into the grid below — the hero previews the
                    document rather than counting it.

                    Shared with Events on purpose: the navy, the dot field and
                    the type scale. Those are the site. The composition is not. */}
                {show('membership.opening') && (
                <section className="relative w-full overflow-hidden bg-brand-900 text-white">
                    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                        {/* A single diagonal sweep rather than Events' two
                            blooms — the band reads as lit from one side, which
                            is what makes the tilted cards sit in it. */}
                        <div className="absolute -right-40 -top-40 h-[46rem] w-[46rem] rotate-12 rounded-[8rem]
                                        bg-gradient-to-br from-brand-600/40 via-brand-700/20 to-transparent blur-3xl" />
                        <div className="absolute -bottom-40 left-1/4 h-[26rem] w-[26rem] rounded-full
                                        bg-brand-500/20 blur-3xl" />
                        <svg className="absolute inset-0 h-full w-full opacity-[0.13]" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <pattern id="membership-hero-dots" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
                                    <circle className="fill-white" cx="2" cy="2" r="1.2" />
                                </pattern>
                            </defs>
                            <rect x="0" y="0" width="100%" height="100%" fill="url(#membership-hero-dots)" />
                        </svg>
                    </div>

                    <div className={`${SCREEN_CONTAINER} relative z-10 pt-16 pb-16 md:pt-20 md:pb-20`}>
                        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">

                            {/* ---------------------------------------- copy */}
                            <Reveal variant="left" className="min-w-0">
                                <div className="mb-6 inline-flex items-center gap-2.5 rounded-full bg-white/10
                                                px-4 py-1.5 ring-1 ring-white/20">
                                    <Award size={15} className="text-brand-300" />
                                    <span className={`${EYEBROW} text-white/90`}>
                                        {intro.eyebrow}
                                    </span>
                                </div>

                                <h1 className={HERO_HEADING}>
                                    ACTIV{' '}
                                    <span className="text-brand-accent">Membership Advantage</span>
                                </h1>

                                <p className={`${HERO_LEDE} mt-6 max-w-xl text-white/70`}>
                                    {intro.tagline}
                                </p>

                                {/*
                                  ONE LINE OF FACTS, not a row of tiles. The
                                  figures matter to somebody deciding whether to
                                  read on, and they are worth exactly one line —
                                  four boxed tiles gave them the visual weight
                                  of the headline.
                                */}
                                <p className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2 text-[1.0625rem]
                                              font-bold text-white/75">
                                    <span className="text-white">{advantages.length} advantages</span>
                                    <span aria-hidden="true" className="h-1 w-1 rounded-full bg-white/30" />
                                    <span className="text-white">{journey.length}-step journey</span>
                                    <span aria-hidden="true" className="h-1 w-1 rounded-full bg-white/30" />
                                    <span>Open to SC/ST and women entrepreneurs</span>
                                </p>

                                <div className="mt-9 flex flex-wrap gap-3">
                                    <Link
                                        to="/register"
                                        className="inline-flex items-center gap-2 rounded-full bg-white px-9 py-4
                                                   text-[1.25rem] font-bold uppercase tracking-[0.1em] text-brand-900
                                                   shadow-lg transition-opacity hover:opacity-90"
                                    >
                                        Become a member <ArrowRight size={17} />
                                    </Link>
                                    <a
                                        href="#advantages"
                                        className="inline-flex items-center gap-2 rounded-full border border-white/30
                                                   px-9 py-4 text-[1.25rem] font-bold uppercase tracking-[0.1em]
                                                   text-white transition-colors hover:bg-white/10"
                                    >
                                        See what is included
                                    </a>
                                </div>
                            </Reveal>

                            {/* ----------------------------------- the card */}
                            <Reveal variant="right" delay={120} className="relative hidden lg:block">
                                <div className="relative mx-auto aspect-[1.6/1] w-full max-w-[30rem]">
                                    {/* The one behind, to say there is more than
                                        one membership and to give the front card
                                        an edge to sit against. */}
                                    <div
                                        aria-hidden="true"
                                        className="absolute inset-0 translate-x-6 translate-y-6 rotate-6 rounded-[1.75rem]
                                                   bg-white/[0.07] ring-1 ring-white/15"
                                    />

                                    <div className="absolute inset-0 -rotate-3 rounded-[1.75rem] bg-gradient-to-br
                                                    from-brand-700 via-brand-800 to-brand-900 p-7 ring-1 ring-white/25
                                                    shadow-[0_40px_80px_-30px_rgb(0,0,0,0.85)]">
                                        {/* the sheen across a physical card */}
                                        <div
                                            aria-hidden="true"
                                            className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.75rem]"
                                        >
                                            <div className="absolute -left-1/3 top-0 h-full w-1/2 rotate-12
                                                            bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                                        </div>

                                        <div className="relative flex h-full flex-col justify-between">
                                            <div className="flex items-start justify-between gap-4">
                                                <img
                                                    src="/logo_ACTIVian-removebg-preview.png"
                                                    alt=""
                                                    aria-hidden="true"
                                                    className="h-9 w-auto object-contain brightness-0 invert"
                                                />
                                                <span className={`${MICRO_LABEL} rounded-full bg-white/15 px-3 py-1
                                                                  text-white/80`}>
                                                    Member
                                                </span>
                                            </div>

                                            <div>
                                                <p className={`${MICRO_LABEL} text-brand-300`}>
                                                    {intro.subtitleLead}
                                                </p>
                                                <p className="mt-2 text-[1.75rem] font-extrabold leading-tight tracking-tight">
                                                    {intro.subtitleRest}
                                                </p>
                                            </div>

                                            <div className="flex items-end justify-between gap-4 border-t
                                                            border-white/15 pt-4">
                                                <div>
                                                    <p className={`${MICRO_LABEL} text-white/40`}>Chamber of commerce</p>
                                                    <p className="mt-1 text-[1.0625rem] font-bold">
                                                        SC/ST &amp; Women Entrepreneurs
                                                    </p>
                                                </div>
                                                <Award size={26} className="shrink-0 text-brand-300" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Reveal>
                        </div>

                        {/* --------------------------------------- the rail
                            The document's own first six headings, as a way in.
                            Events counts things in its hero; this one shows
                            what is actually inside. */}
                        <Reveal delay={200} className="mt-14 border-t border-white/10 pt-7">
                            <p className={`${MICRO_LABEL} mb-4 text-white/40`}>What a membership carries</p>
                            <div className="flex flex-wrap gap-2.5">
                                {advantages.slice(0, 6).map((advantage) => (
                                    <a
                                        key={advantage.slug}
                                        href={`#${advantage.slug}`}
                                        onClick={() => reveal(advantage.slug)}
                                        className="rounded-full bg-white/[0.07] px-4 py-2 text-[1.1875rem] font-bold
                                                   text-white/80 ring-1 ring-white/15 transition-colors
                                                   hover:bg-white hover:text-brand-900"
                                    >
                                        {advantage.title}
                                    </a>
                                ))}
                                <a
                                    href="#advantages"
                                    className="rounded-full px-4 py-2 text-[1.1875rem] font-bold text-brand-300
                                               transition-colors hover:text-white"
                                >
                                    +{advantages.length - 6} more
                                </a>
                            </div>
                        </Reveal>
                    </div>

                    {/* This card's own fields, inside this card — see
                        `SectionFields`. They used to be pooled with every
                        other band's and printed at the foot of the page. */}
                    <div className={SCREEN_CONTAINER}>
                        <SectionFields proseClass={BAND_PROSE} sections={copy.sections} sectionKey="membership.opening" />
                    </div>
                </section>
                )}

                {/* ============================== the opening, and why join
                    The paragraph column is capped at a readable measure and the
                    card takes the rest of the width, so the wide column is
                    filled without setting body copy 1,800px wide. */}
                {show('membership.why') && (
                <section className="relative overflow-hidden dot-band py-14 md:py-20">
                    <DotField id="membership-dots-intro" />

                    <div className={`${SCREEN_CONTAINER} relative z-10`}>
                        <SectionHead
                            eyebrow={intro.eyebrow}
                            heading={
                                <>
                                    {intro.subtitleLead}{' '}
                                    <span className="text-brand-600">{intro.subtitleRest}</span>
                                </>
                            }
                        />

                        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]
                                        lg:gap-12 xl:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] xl:gap-16">

                            <Reveal variant="left">
                                {/*
                                  THE PAGE'S OPENING CLAIM, set to be read as
                                  one — the same weight and colour the closing
                                  band uses for its own.
                                  
                                  These three paragraphs say what ACTIV is, who
                                  a member is and what the membership is for. At
                                  `SECTION_LEDE`'s semibold grey they sat a
                                  shade under the heading above them and read as
                                  a caption to it; the FIRST is the sentence the
                                  whole page rests on, so it takes the size as
                                  well as the weight.
                                */}
                                {intro.body.map((paragraph, i) => (
                                    <p
                                        key={i}
                                        className={`mb-6 leading-relaxed tracking-tight last:mb-0 ${
                                            i === 0
                                                ? 'text-[1.25rem] md:text-[1.75rem] font-extrabold text-brand-900'
                                                : 'text-[1.3125rem] md:text-[1.5625rem] font-bold text-slate-700'
                                        }`}
                                    >
                                        {paragraph}
                                    </p>
                                ))}
                            </Reveal>

                            <Reveal variant="right" delay={120}>
                                <div className={`${CARD} p-6 sm:p-8`}>
                                    <h3 className={CARD_HEADING}>{copy.whyJoin.heading}</h3>
                                    <p className={`${CARD_SUB} mt-2`}>{copy.whyJoin.subtitle}</p>
                                    <p className={`mt-4 ${CARD_LEAD}`}>{copy.whyJoin.lead}</p>

                                    {/* Two columns from `md` up: twelve points down one
                                        side of a wide card is a column of ticks with a
                                        field of white beside it. */}
                                    <ul className="mt-5 gap-x-10 md:columns-2 xl:columns-3">
                                        {copy.whyJoin.bullets.map((item, i) => (
                                            <Ticked key={i}>{item}</Ticked>
                                        ))}
                                    </ul>
                                </div>
                            </Reveal>
                        </div>
                    </div>

                    {/* This card's own fields, inside this card — see
                        `SectionFields`. They used to be pooled with every
                        other band's and printed at the foot of the page. */}
                    <div className={SCREEN_CONTAINER}>
                        <SectionFields proseClass={BAND_PROSE} sections={copy.sections} sectionKey="membership.why" />
                    </div>
                </section>
                )}

                {/* ======================================= the fifteen parts */}
                {show('membership.advantages') && (
                <section id="advantages" className="relative overflow-hidden scroll-mt-24 dot-band py-14 md:py-20">
                    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
                        <div className="absolute -top-24 -left-20 h-80 w-80 rounded-full bg-brand-200/40 blur-3xl animate-activ-float-slow" />
                        <div className="absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-brand-100/60 blur-3xl animate-activ-float" />
                    </div>

                    <div className={SCREEN_CONTAINER}>
                        {/* No subtitle: the document has no line under this
                            heading, and a written-to-fit sentence here would be
                            the one piece of copy on the page that is not the
                            association's. */}
                        <SectionHead eyebrow="Fifteen parts" heading={intro.title}>
                            <button
                                type="button"
                                onClick={toggleAll}
                                aria-pressed={allOpen}
                                className="mt-7 inline-flex items-center gap-2 rounded-full border border-brand-200
                                           bg-white px-7 py-3.5 text-[1.25rem] font-extrabold uppercase
                                           tracking-[0.1em] text-brand-700 shadow-sm transition-colors
                                           hover:border-brand-800 hover:bg-brand-800 hover:text-white"
                            >
                                {allOpen ? 'Close all' : 'Open all fifteen'}
                                <ChevronDown
                                    size={17}
                                    aria-hidden="true"
                                    className={`transition-transform duration-300 ${allOpen ? 'rotate-180' : ''}`}
                                />
                            </button>
                        </SectionHead>

                        {/* ---- the contents strip ----
                            A jump list AND a way in: the chip opens the card it
                            names, because a link that lands on a folded answer
                            has not answered anything.

                            A GRID, not a centred wrap. Fifteen pills of fifteen
                            different lengths wrapped and centred make a ragged
                            pyramid — every row a different width, indented by a
                            different amount, and no edge anywhere for the eye to
                            follow. Equal cells give both edges and every column
                            a line. Three across and five across, because 15
                            divides by both, so no breakpoint leaves a half-empty
                            last row.

                            No number on the chip either. It duplicated the one
                            already on the card it points at, and fifteen of them
                            down the left of the block read as a second thing to
                            take in before the labels. */}
                        <Reveal className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
                            {advantages.map((item) => (
                                <a
                                    key={item.slug}
                                    href={`#${item.slug}`}
                                    onClick={() => reveal(item.slug)}
                                    className={`${PILL} flex items-center justify-center px-5 py-4 text-center
                                                text-[1.0625rem] font-bold leading-snug text-brand-700
                                                hover:border-brand-800 hover:bg-brand-800 hover:text-white`}
                                >
                                    {item.title}
                                </a>
                            ))}
                        </Reveal>

                        {/* ---- the cards ----
                            A centred wrap, not a grid: fifteen cards four
                            abreast end in a row of three, and centring it is
                            what keeps that from reading as a missing card. */}
                        {/*
                          ONE gap value at every breakpoint, and the widths are
                          calculated against it: `calc(33.333% - 0.834rem)` is
                          three cards with two 20px gaps, `calc(25% - 0.9375rem)`
                          is four with three. Changing the gap per breakpoint
                          without changing the widths to match overflows the row
                          by a few pixels and drops a card to the next line.

                          Four abreast only from `2xl`. At 1440 four cards are
                          330px each and every second title wraps to three
                          lines; three keeps a card at ~430px, which is the
                          width the 1920 layout gives it too.
                        */}
                        <div className="flex flex-wrap justify-center gap-5">
                            {advantages.map((advantage, i) => (
                                <Reveal
                                    key={advantage.slug}
                                    delay={(i % 4) * 60}
                                    className="w-full sm:w-[calc(50%-0.625rem)] lg:w-[calc(33.333%-0.834rem)]
                                               2xl:w-[calc(25%-0.9375rem)]"
                                >
                                    <AdvantageCard
                                        advantage={advantage}
                                        open={!!opened[advantage.slug]}
                                        onToggle={toggle}
                                    />
                                </Reveal>
                            ))}
                        </div>
                    </div>

                    {/* This card's own fields, inside this card — see
                        `SectionFields`. They used to be pooled with every
                        other band's and printed at the foot of the page. */}
                    <div className={SCREEN_CONTAINER}>
                        <SectionFields proseClass={BAND_PROSE} sections={copy.sections} sectionKey="membership.advantages" />
                    </div>
                </section>
                )}

                {/* ============================================== the journey */}
                {show('membership.journey') && (
                <section className="relative overflow-hidden bg-brand-900 text-white py-14 md:py-20">
                    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
                        <div className="absolute -top-24 right-0 h-96 w-96 rounded-full bg-brand-600/25 blur-3xl animate-activ-float" />
                    </div>

                    <div className={`${SCREEN_CONTAINER} relative z-10`}>
                        <SectionHead eyebrow={copy.journeyEyebrow} heading={copy.journeyHeading} dark />

                        {/* Four abreast, then three centred beneath — the same
                            wrap the advantages use, for the same reason. */}
                        <div className="flex flex-wrap justify-center gap-5">
                            {journey.map((step, i) => {
                                const icon = step.icon;
                                return (
                                    <Reveal
                                        key={step.step}
                                        delay={i * 60}
                                        className="w-full sm:w-[calc(50%-0.625rem)] lg:w-[calc(25%-0.9375rem)]"
                                    >
                                        <div className="group flex h-full flex-col rounded-2xl border
                                                        border-white/15 bg-white/[0.06] p-6
                                                        transition-colors hover:bg-white/[0.1]">
                                            <div className="mb-5 flex items-center justify-between">
                                                <span
                                                    aria-hidden="true"
                                                    className={`${PLATE_DARK} h-[3.25rem] w-[3.25rem]`}
                                                >
                                                    <CmsIcon name={icon} size={24} />
                                                </span>
                                                <span className={`${MICRO_LABEL} text-white/40`}>{step.step}</span>
                                            </div>
                                            <h3 className="text-[1.875rem] font-extrabold tracking-tight">
                                                {step.title}
                                            </h3>
                                            <p className="mt-2 text-[1.3125rem] xl:text-[1.1875rem] leading-relaxed
                                                          font-medium text-white/70">
                                                {step.text}
                                            </p>
                                        </div>
                                    </Reveal>
                                );
                            })}
                        </div>
                    </div>

                    {/* This card's own fields, inside this card — see
                        `SectionFields`. They used to be pooled with every
                        other band's and printed at the foot of the page. */}
                    <div className={SCREEN_CONTAINER}>
                        <SectionFields proseClass={BAND_PROSE} sections={copy.sections} sectionKey="membership.journey" />
                    </div>
                </section>
                )}

                {/* ========================================= who should join */}
                {show('membership.who') && (
                <section className="relative overflow-hidden dot-band py-14 md:py-20">
                    <DotField id="membership-dots-who" />

                    <div className={`${SCREEN_CONTAINER} relative z-10`}>
                        <SectionHead
                            eyebrow="Eligibility"
                            heading={copy.whoShouldJoin.heading}
                            subtitle={copy.whoShouldJoin.lead}
                        />

                        {/* The same grid as the contents strip above, for the
                            same reason and with the same count — fifteen, which
                            divides by three and by five. */}
                        {/* On a phone, compact chips that wrap several to a row —
                            sixteen full-width pills were a very long column. */}
                        <Reveal className="flex flex-wrap justify-center gap-2 sm:grid sm:gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
                            {copy.whoShouldJoin.bullets.map((item, i) => (
                                <span
                                    key={i}
                                    className={`${PILL} flex items-center justify-center gap-2 sm:gap-2.5 px-3.5 py-2.5 sm:px-5 sm:py-4
                                                text-center text-[0.95rem] sm:text-[1.0625rem] font-bold leading-snug
                                                text-slate-800`}
                                >
                                    <span aria-hidden="true"
                                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                                    {item}
                                </span>
                            ))}
                        </Reveal>
                    </div>

                    {/* This card's own fields, inside this card — see
                        `SectionFields`. They used to be pooled with every
                        other band's and printed at the foot of the page. */}
                    <div className={SCREEN_CONTAINER}>
                        <SectionFields proseClass={BAND_PROSE} sections={copy.sections} sectionKey="membership.who" />
                    </div>
                </section>
                )}

                {/* ==================================== why membership matters */}
                {show('membership.matters') && (
                <section className="dot-band py-14 md:py-20">
                    <div className={SCREEN_CONTAINER}>
                        <SectionHead
                            eyebrow="The short answer"
                            heading={copy.mattersHeading}
                            subtitle={copy.mattersSubtitle}
                        />

                        {/* Eight cards, four abreast: two full rows and no hole. */}
                        <div className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:gap-6">
                            {copy.whyItMatters.map((item, i) => {
                                const icon = item.icon;
                                return (
                                    <Reveal key={item.title} delay={(i % 4) * 70} className="h-full">
                                        <div className={`${CARD} p-6 sm:p-7`}>
                                            <span
                                                aria-hidden="true"
                                                className={`${PLATE} mb-5 h-[3.25rem] w-[3.25rem]`}
                                            >
                                                <CmsIcon name={icon} size={24} />
                                            </span>
                                            <h3 className={CARD_HEADING}>{item.title}</h3>
                                            <p className={`mt-2.5 ${CARD_TEXT}`}>{item.text}</p>
                                        </div>
                                    </Reveal>
                                );
                            })}
                        </div>
                    </div>

                    {/* This card's own fields, inside this card — see
                        `SectionFields`. They used to be pooled with every
                        other band's and printed at the foot of the page. */}
                    <div className={SCREEN_CONTAINER}>
                        <SectionFields proseClass={BAND_PROSE} sections={copy.sections} sectionKey="membership.matters" />
                    </div>
                </section>
                )}

                {/* ============================================== the closing */}
                {show('membership.closing') && (
                <section className="relative overflow-hidden bg-[#eef2f9] py-14 md:py-20">
                    <DotField id="membership-dots-closing" />

                    <div className={`${SCREEN_CONTAINER} relative z-10`}>
                        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]
                                        lg:gap-16 xl:grid-cols-[minmax(0,1fr)_minmax(0,34rem)]">

                            <Reveal>
                                <h2 className={`${SECTION_HEADING} text-brand-800 mb-5 max-w-[20ch]`}>
                                    {copy.closingHeading}{' '}
                                    <span className="text-brand-500">{copy.closingHeadingHighlight}</span>
                                </h2>

                                <div className="max-w-[44rem]">
                                    {/* The two lines the document closes its claim
                                        with. They were `slate-700` at the lede's
                                        weight — a shade and a step lighter than
                                        the heading they answer, so they read as a
                                        caption under it rather than as the point
                                        being made. */}
                                    {copy.closingBody.map((line, i) => (
                                        <p
                                            key={i}
                                            className="text-[1.375rem] md:text-[1.875rem] font-extrabold
                                                       leading-snug tracking-tight text-brand-900"
                                        >
                                            {line}
                                        </p>
                                    ))}

                                    <p className="mt-6 text-[1.1875rem] xl:text-[1.25rem] leading-[1.7]
                                                  font-semibold text-slate-700">
                                        {copy.closingNote}
                                    </p>
                                    <p className="mt-5 text-[1.3125rem] xl:text-[1.1875rem] leading-[1.7]
                                                  font-bold text-brand-700">
                                        {copy.statement}
                                    </p>
                                </div>
                            </Reveal>

                            {/* ---- join ACTIV today ---- */}
                            <Reveal delay={90}>
                                <div className="rounded-2xl bg-brand-900 text-white p-7 md:p-9
                                                shadow-[0_18px_50px_-18px_rgb(28_46_104/0.55)]">
                                    <h3 className="text-[1.875rem] font-extrabold tracking-tight mb-6">
                                        {copy.callHeading}
                                    </h3>

                                    <ul>
                                        {copy.callLines.map((line, i) => (
                                            <Ticked key={i} dark>{line}</Ticked>
                                        ))}
                                    </ul>

                                    <p className="mt-5 text-[1.3125rem] xl:text-[1.1875rem] leading-relaxed
                                                  font-medium text-white/70">
                                        {copy.invitation}
                                    </p>

                                    <Link
                                        to="/register"
                                        className="mt-6 inline-flex w-full items-center justify-center gap-2
                                                   rounded-full bg-white px-9 py-4 font-bold text-[1.25rem]
                                                   uppercase tracking-[0.1em] text-brand-900 shadow-lg
                                                   transition-opacity hover:opacity-90"
                                    >
                                        Become a member <ArrowRight size={17} />
                                    </Link>

                                    {/* ---- membership enquiries ---- */}
                                    <div className="mt-7 border-t border-white/15 pt-5">
                                        <p className={`${MICRO_LABEL} text-white/40 mb-3`}>
                                            {copy.enquiriesHeading}
                                        </p>

                                        <div className="flex flex-wrap items-center gap-x-8 gap-y-2.5">
                                            <a
                                                href={`https://${copy.website}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2.5 text-[1.3125rem]
                                                           font-bold text-white/85 transition-colors hover:text-white"
                                            >
                                                <Globe2 size={17} className="shrink-0 opacity-60" />
                                                {copy.website}
                                            </a>
                                            <a
                                                href={`mailto:${copy.email}`}
                                                className="inline-flex items-center gap-2.5 text-[1.3125rem]
                                                           font-bold text-white/85 transition-colors hover:text-white"
                                            >
                                                <Mail size={17} className="shrink-0 opacity-60" />
                                                {copy.email}
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </Reveal>
                        </div>
                    </div>

                    {/* This card's own fields, inside this card — see
                        `SectionFields`. They used to be pooled with every
                        other band's and printed at the foot of the page. */}
                    <div className={SCREEN_CONTAINER}>
                        <SectionFields proseClass={BAND_PROSE} sections={copy.sections} sectionKey="membership.closing" />
                    </div>
                </section>
                )}

                {/*
                  * THE PAGE'S OWN FIELDS — and only the page's.
                  *
                  * Every band's rows were pooled into this one list and printed
                  * here, so a field added to "Why join" appeared at the foot of
                  * the page in the page's type rather than inside that card in
                  * the card's. Each band draws its own now; what is left here is
                  * the list attached to the PAGE, which has always belonged at
                  * the end of it.
                  */}
                {(copy.extraFields || []).length > 0 && (
                    <div className={`${SCREEN_CONTAINER} py-12 ${BAND_PROSE}`}>
                        <CmsExtraFields fields={copy.extraFields} />
                    </div>
                )}
            </main>

            {/* Above the footer, on every content page — see `AcrossIndia`. */}
            <AcrossIndia />

            <FooterSection />
        </div>
    );
}
