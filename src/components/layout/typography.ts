/**
 * The public site's type scale. One definition per role, shared by every
 * onboarding section.
 *
 * This exists for the same reason `pageContainer.ts` does: the five screens had
 * already drifted apart and nothing made it visible. Before this file:
 *
 *   - About and Events capped their section heading at `md:text-5xl`, while
 *     Gallery and Contact ran on to `lg:text-6xl` — so on a wide display the
 *     same heading was two different sizes depending on which page you were on,
 *     and the Events grid on the home page sat directly beneath an About
 *     heading a full step larger than it.
 *   - The Events heading carried no weight class at all, so it rendered at 400
 *     next to About's 900.
 *   - Eyebrow labels were `text-[0.6875rem] font-extrabold` on two pages and
 *     `text-[0.8125rem] font-bold` on another.
 *   - The hero lede was `font-light` while every other lede on the site was
 *     `font-medium`, which read as the headline losing its footing.
 *
 * Importing these instead of retyping the classes is what keeps one voice down
 * the whole site. Change a value here and all five screens move together.
 */

/**
 * Section headings — the `<h2>` that opens About, Events, Gallery and Contact.
 *
 * `font-black` is a real 900 now. Two things were clamping it before: the
 * heading font was Plus Jakarta Sans, which stops at 800, and the stylesheet
 * requested weights 400-700 only, so the browser was synthesising both 800 and
 * 900 by smearing the 700 outlines. The site is Inter at 400-900 now and this
 * is an actual cut.
 *
 * `tracking-tight` on top of the -0.018em the base layer already applies to
 * headings: at 60px a geometric face needs noticeably more negative tracking
 * than it does at 24px, and a single global value cannot be right at both ends.
 */
export const SECTION_HEADING =
    'text-[1.875rem] sm:text-4xl md:text-5xl lg:text-6xl font-black leading-[1.08] md:leading-[1.05] tracking-tight';

/**
 * The hero `<h1>`. One step above a section heading, and the only 7xl on the site.
 *
 * The base step is 34px, not the 48px it started at. At 48px on a 390px phone
 * this headline ran to five lines and 245px tall, which pushed the two CTAs
 * below the hero's own bottom edge and straight under the statistics card —
 * the primary call to action on the site was covered up on every phone.
 */
export const HERO_HEADING =
    'text-[2.125rem] sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[1.06] md:leading-[1.02] tracking-tight';

/** The paragraph directly under a heading. */
export const SECTION_LEDE =
    'text-base md:text-xl leading-relaxed font-semibold';

/** The hero's lede, one step larger because it sits on a photograph. */
export const HERO_LEDE =
    'text-base sm:text-lg md:text-2xl leading-relaxed font-semibold';

/** The small capitalised label in a pill above a heading. */
/**
 * Sized UP on mobile, not down. 11px is legible on a desktop monitor at reading
 * distance and is not on a phone held at arm's length, so the small end of this
 * scale is the one that needs the floor.
 */
export const EYEBROW =
    'text-xs sm:text-[0.6875rem] font-extrabold uppercase tracking-[0.14em]';

/** Card titles — event cards, gallery tiles, the contact cards. */
export const CARD_TITLE =
    'text-xl sm:text-2xl font-black leading-snug tracking-tight';

/** A figure in a statistics row. */
export const STAT_FIGURE =
    'text-[1.75rem] sm:text-3xl md:text-4xl font-black tracking-tight';

/** The caption under a statistic. */
export const STAT_LABEL =
    'text-xs sm:text-[0.8125rem] font-extrabold uppercase tracking-[0.1em]';

/**
 * The smallest text the site uses — card dates, locations, captions.
 *
 * These were `text-[0.625rem]`, a flat 10px at every width. On a phone that is
 * below what most people can read without bringing the screen closer, and it
 * was being used for the date and venue of an event, which is the one thing on
 * that card somebody actually needs.
 */
export const MICRO_LABEL =
    'text-[0.6875rem] sm:text-[0.625rem] font-extrabold uppercase tracking-widest';

/** Body copy inside a card — one step down from a section lede. */
export const CARD_BODY =
    'text-[0.9375rem] md:text-base leading-relaxed font-semibold';
