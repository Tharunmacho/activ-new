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
 *   - Eyebrow labels were `text-[0.8125rem] font-extrabold` on two pages and
 *     `text-[1rem] font-bold` on another.
 *   - The hero lede was `font-light` while every other lede on the site was
 *     `font-medium`, which read as the headline losing its footing.
 *
 * Importing these instead of retyping the classes is what keeps one voice down
 * the whole site. Change a value here and all five screens move together.
 *
 * =========================================================================
 * ONE STEP UP, THROUGHOUT — 2026
 * =========================================================================
 *
 * Every size below the headings was raised by about an eighth. The association
 * asked for the site at 80% browser zoom to read the way it did at 90%, which
 * is exactly that ratio (90/80 = 1.125), and the request is a fair one: the
 * body sizes here were set against a 1440px laptop and the site is read on
 * 1920px monitors, where 13px of card copy is small.
 *
 * The HEADINGS were left alone. They are already 30-60px and scale with the
 * viewport; taking them up another eighth would have the hero headline wrapping
 * on a laptop, which is the fault this scale was written to fix in the first
 * place. What was small is bigger; what was big is unchanged.
 */

/**
 * Section headings — the `<h2>` that opens About, Events, Gallery and Contact.
 *
 * `font-black` is a real 900 now. Two things were clamping it before: the
 * heading font was Plus Jakarta Sans, which stops at 800, and the stylesheet
 * requested weights 400-700 only, so the browser was synthesising both 800 and
 * 900 by smearing the 700 outlines. The product is Poppins throughout now,
 * served at 400-900, so nothing here is synthesised and `font-black` is a real
 * 900.
 *
 * `tracking-tight` on top of the -0.018em the base layer already applies to
 * headings: at 60px a geometric face needs noticeably more negative tracking
 * than it does at 24px, and a single global value cannot be right at both ends.
 */
export const SECTION_HEADING =
    'text-[2.1875rem] sm:text-4xl md:text-5xl lg:text-6xl font-black leading-[1.08] md:leading-[1.05] tracking-tight';

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
    'text-[1.3125rem] md:text-[1.75rem] leading-relaxed font-semibold';

/** The hero's lede, one step larger because it sits on a photograph. */
export const HERO_LEDE =
    'text-[1.3125rem] sm:text-[1.375rem] md:text-[2.0625rem] leading-relaxed font-semibold';

/** The small capitalised label in a pill above a heading. */
/**
 * Sized UP on mobile, not down. 11px is legible on a desktop monitor at reading
 * distance and is not on a phone held at arm's length, so the small end of this
 * scale is the one that needs the floor.
 */
export const EYEBROW =
    'text-[1.0625rem] sm:text-[1rem] font-extrabold uppercase tracking-[0.14em]';

/** Card titles — event cards, gallery tiles, the contact cards. */
export const CARD_TITLE =
    'text-[1.75rem] sm:text-[2.0625rem] font-black leading-snug tracking-tight';

/** A figure in a statistics row. */
export const STAT_FIGURE =
    'text-[2.1875rem] sm:text-4xl md:text-5xl font-black tracking-tight';

/** The caption under a statistic. */
export const STAT_LABEL =
    'text-[1.0625rem] sm:text-[1.125rem] font-extrabold uppercase tracking-[0.1em]';

/**
 * The smallest text the site uses — card dates, locations, captions.
 *
 * These were `text-[0.75rem]`, a flat 10px at every width. On a phone that is
 * below what most people can read without bringing the screen closer, and it
 * was being used for the date and venue of an event, which is the one thing on
 * that card somebody actually needs.
 */
export const MICRO_LABEL =
    'text-[1rem] sm:text-[0.9375rem] font-extrabold uppercase tracking-widest';

/** Body copy inside a card — one step down from a section lede. */
export const CARD_BODY =
    'text-[1.3125rem] md:text-[1.1875rem] leading-relaxed font-semibold';

/**
 * Long-form reading — the legal notices, and anything else that is a wall of
 * text rather than a card.
 *
 * ========================================================================
 * WHY THIS IS NOT `CARD_BODY`
 * ========================================================================
 *
 * `CARD_BODY` is `font-semibold` at `leading-relaxed`, and both are right for
 * what it does: two or three lines inside a bordered card, where the weight
 * holds its own against a heading an inch away and the measure is short enough
 * that 1.625 never loses the reader.
 *
 * A Privacy Policy is fourteen sections and 1,200 words. At `font-semibold` a
 * page of that reads as shouting — Inter's 600 was drawn to be picked out of a
 * layout, not to be read for four minutes — and at 1.625 on a 65-character
 * measure the eye starts dropping a line on the return sweep. So: 450-ish
 * weight, and 1.75 leading, which is the ratio typeset books have used for a
 * century at this measure.
 *
 * The FACE is the same. This product is Inter everywhere — `sans`, `display`
 * and `serif` all resolve to it in `tailwind.config` — so long-form text is not
 * a second family, it is the same family used at the weight and leading the job
 * actually needs. A serif here would be a second typeface on a site that has
 * exactly one.
 */
export const PROSE_BODY =
    'text-[1.3125rem] md:text-[1.1875rem] leading-[1.75] font-medium';

/**
 * A heading inside long-form prose — a clause heading, not a section heading.
 *
 * A step below `CARD_TITLE` and two below `SECTION_HEADING`, because it appears
 * fifteen times on one page. At `SECTION_HEADING`'s weight and size the page
 * would read as fifteen new sections rather than as one document with parts,
 * and the reader would lose which of them they were inside.
 *
 * Headings take `fontFamily.display` automatically from the base layer, so this
 * carries no family of its own — see the `h1, h2, h3, h4` rule in `index.css`.
 */
export const PROSE_HEADING =
    'text-[1.375rem] sm:text-[1.875rem] font-black tracking-tight leading-snug';

/**
 * The label in a label/value pair — a receipt row, a detail table.
 *
 * `MICRO_LABEL` in weight and tracking, and NOT uppercased at this size when it
 * carries a proper noun: "Event Name" and "No Of Person" are read as words, and
 * small caps at 11px turn a two-word label into a shape the eye has to decode.
 * Pair it with `tabular-nums` on the value whenever the value is a number, so a
 * column of amounts lines up on the decimal.
 */
export const DETAIL_LABEL =
    'text-[1rem] sm:text-[0.9375rem] font-extrabold uppercase tracking-widest';
