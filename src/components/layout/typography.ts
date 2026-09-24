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
/*
 * FLUID, for the reason `HERO_HEADING` is — see the note there.
 *
 * Four fixed steps each chosen against a heading of a particular length, so a
 * longer one ran to more lines and pushed the band below it down. `clamp` is
 * one continuous curve from 35px to 60px against the viewport, meeting the
 * screen it is on rather than the nearest breakpoint.
 *
 * Floor and ceiling are the old mobile and `lg` sizes, so nothing on the site
 * gets smaller or larger than it was — only the steps between are smoothed.
 */
export const SECTION_HEADING =
    'text-[clamp(2.1875rem,1.35rem+3.7vw,3.75rem)] font-black leading-[1.08] md:leading-[1.05] tracking-tight';

/**
 * The hero `<h1>`. One step above a section heading, and the only 7xl on the site.
 *
 * The base step is 34px, not the 48px it started at. At 48px on a 390px phone
 * this headline ran to five lines and 245px tall, which pushed the two CTAs
 * below the hero's own bottom edge and straight under the statistics card —
 * the primary call to action on the site was covered up on every phone.
 */
/*
 * FLUID, not four fixed steps.
 *
 * The four breakpoints jumped between sizes and each one was chosen against a
 * headline of a particular length, so a longer one simply ran to more lines
 * and pushed everything under it down — which is what put a banner's added
 * fields under the statistics card. `clamp` gives one continuous curve from
 * 34px to 72px against the viewport, so the headline meets the screen it is on
 * rather than the nearest breakpoint, and the band around it is free to grow
 * for whatever is left.
 *
 * The floor is the old mobile size and the ceiling the old `lg` size, so
 * nothing gets smaller or larger than it was — only the steps between are
 * smoothed.
 */
export const HERO_HEADING =
    'text-[clamp(2.125rem,1.1rem+4.6vw,4.5rem)] font-black leading-[1.06] md:leading-[1.02] tracking-tight';

/** The paragraph directly under a heading. */
export const SECTION_LEDE =
    'text-[1.3125rem] md:text-[1.75rem] leading-relaxed font-semibold';

/**
 * ============================================================================
 * A BAND'S MEASURE OPENS WITH THE DISPLAY
 * ============================================================================
 *
 * Every hero on the site capped its words at `max-w-xl` or `max-w-2xl` — 576
 * or 672px — inside a column that is 1676px wide at 1900. So two thirds of
 * the room sat empty while the copy wrapped early, and the moment an editor
 * added anything the band either grew or ran its words under whatever sat
 * below it. That is what "the page does not adapt" means in practice: there
 * was room, and nothing used it.
 *
 * One constant rather than a number retyped in seven files, so the bands stay
 * in step and a change is made once.
 *
 * Capped rather than full width. 1024px of 20px type is about 110 characters a
 * line, which is already past comfortable; and on a hero the words sit on a
 * photograph whose gradient fades out around 60%, so white type beyond that is
 * unreadable whatever its size.
 */
export const BAND_MEASURE = 'max-w-2xl lg:max-w-3xl xl:max-w-4xl';

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
