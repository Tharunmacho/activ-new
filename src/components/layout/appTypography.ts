/**
 * The IN-APP type scale — member and admin screens.
 *
 * `typography.ts` beside this file is the PUBLIC site's scale. This is its
 * counterpart for the signed-in product, and the two are deliberately separate:
 * a marketing page is one column of prose with a 60px headline at the top of
 * it, and a dashboard is thirty labelled facts in a grid. The same numbers
 * cannot be right for both.
 *
 * ==========================================================================
 * THE REFERENCE IS THE SIGN-IN SCREEN
 * ==========================================================================
 *
 * `AuthSplitLayout` is the one surface in the product whose typography the
 * association signed off on: `text-[3.125rem] font-black tracking-tight` for the
 * title, `text-[1.5625rem] font-medium` for the line under it, `font-bold` at
 * 18px for a field label. Heavy, and a step larger than a default Tailwind
 * scale — `text-[1.1875rem]` body copy and `font-bold` headings read as grey and flat
 * beside it, which is what the dashboard was.
 *
 * So every value below is that screen's voice, brought down to the density a
 * dashboard needs:
 *
 *   - WEIGHT. This was raised a full step and then taken back down again, and
 *     the round trip is the useful part of the record.
 *
 *     It went up first — 400 body to 500, `font-bold` headings to
 *     `font-extrabold`, the page title to `font-black` — against faces that
 *     STOPPED AT 800 (Plus Jakarta Sans, then Manrope), so `font-black` was
 *     quietly rendering at 800 and the whole scale sat a step below what it
 *     said. Poppins carries a real 900. The same classes against the new face
 *     put the entire screen in heavy type, headings and captions alike, and the
 *     association's reading of it was immediate: too much bold.
 *
 *     So: headings are 700, sub-heads and labels 600, and BODY COPY IS BACK AT
 *     400. Nothing here is 800 or 900 any more.
 *
 *     What that buys is contrast. Bolding everything is the same as bolding
 *     nothing — when a caption, a body line and a card title are all heavy, the
 *     only thing left separating them is size. A 700 title over 400 body says
 *     which is which on its own.
 *
 *     Before raising a weight here again, check what the current face's ceiling
 *     actually is. Twice now a weight class has meant something different from
 *     what it rendered.
 *   - SIZE goes up roughly a quarter. It was raised in two passes: an eighth
 *     first (the 90/80 ratio the public scale was raised by), and then a second
 *     step of the same size, because on a 1920px monitor the first pass still
 *     read small beside the sign-in screen it was copied from. `text-[1.1875rem]` (14px)
 *     card copy is 17px; a `text-[1.0625rem]` (12px) caption is 15px; a card heading is
 *     24px where it was 16-18px.
 *
 * If a screen needs it smaller again, the numbers move HERE, not on the screen.
 * A one-off `text-[1.1875rem]` on a card is how the product drifted apart the first time.
 *
 * ==========================================================================
 * THE FACE
 * ==========================================================================
 *
 * The product is ONE family now — Poppins, headings and body both. A heading
 * constant therefore carries no family, and `font-display` on a `<p>` or
 * `<span>` that should read as a heading resolves to the same face the
 * paragraph beside it is set in. Keep writing it anyway: it is what those
 * elements would need the moment a second family comes back, and the `h1..h4`
 * rule in `index.css` reaches the tags but not them.
 *
 * Poppins carries a REAL 900, so `font-black` here is an actual cut. Two of the
 * faces tried before it — Plus Jakarta Sans and Manrope — stop at 800 and were
 * clamping every one of these constants a weight short of what it asks for.
 *
 * ONE FAMILY MAKES THE SIZE STEPS LOAD-BEARING. With a display face over a
 * text face, a heading and the line under it differed in SHAPE as well as size
 * and weight, and a small step still read as a heading. Here there is no shape
 * difference left — 24px `font-black` over 17px `font-medium` is the whole of
 * what says "this is a title". Narrow those steps and a card title starts
 * reading as bigger body text, which is the exact fault this scale was written
 * to fix.
 *
 * Change a value here and every screen that imports it moves together. That is
 * the whole point — the dashboard is the first screen on this scale, and the
 * rest of the member and admin area follows by importing, not by retyping.
 */

/**
 * The greeting / page title in the white header band.
 *
 * 40px — the HEADER of the three sizes the association settled on. It has to
 * fit the white header band with the subheading under it:
 *
 *     40px title       x leading-[1.1]   = 44px
 *     20px description x leading-snug    = 28px
 *     mt-0.5                             =  2px
 *                                        ------
 *                                          74px
 *
 * THE BAND IS `h-[5.5rem]` — 88px — and it tracks this number. It has been 88,
 * 100 and 110 as the scale moved, and it is back at 88 because the description
 * under the title is content-sized again. Thirteen bands across the member,
 * business, admin and CMS shells carry that height, and the SIDEBAR RAIL'S LOGO
 * BAND IS AMONG THEM: the rail's bottom rule and the header's bottom rule are
 * the same line across the top of the window, and they only look like one line
 * while the two heights agree. Change one without the other and the product has
 * a step in it.
 *
 * `leading-[1.1]` rather than `leading-tight` (1.25) buys six of those pixels
 * back, and a 40px line carries the tighter leading without the descenders of
 * one line touching the ascenders of the next.
 *
 * The PHONE step is 32px.
 */
export const PAGE_TITLE =
    'text-[2rem] sm:text-[2.5rem] font-semibold tracking-tight leading-[1.1]';

/**
 * The line under a page title — "Everything you have submitted, in one place".
 *
 * IT IS CONTENT, NOT A HEADING, and that is the whole point of this comment.
 *
 * It was briefly set to 30px, on a reading of the three sizes that made it the
 * middle rank. The association corrected it: the HEADER is "My Profile" and
 * nothing else; everything below the header — the description included — is
 * content. So it is 20px, the same as `CARD_BODY`, because it is the same
 * thing.
 *
 * That leaves the middle size to what actually earns it: `CARD_TITLE`, at 30px.
 * A card title opens a block of its own and has content beneath it. A page's
 * description has nothing beneath it; it IS the beneath.
 *
 *     header      40px   the page title, alone
 *     subheading  30px   a card or section title
 *     content     20px   everything else, this line included
 *
 * The earlier complaint still stands and is still fixed, but by the other end:
 * this line reading the same size as body copy was never the fault. The fault
 * was body copy at 19px under a 20px line that was TRYING to be a heading. Now
 * it is not trying, and the 30px step belongs to something that is.
 */
export const PAGE_SUBTITLE =
    'text-[1.25rem] font-normal leading-snug';

/** The `<h2>`/`<h3>` that names a card — the biggest thing inside one. */
export const CARD_TITLE =
    'text-[2.1875rem] font-bold tracking-tight leading-snug';

/** The explanatory line under a card title. */
export const CARD_SUBTITLE =
    'text-[1.25rem] font-normal leading-relaxed';

/**
 * A sub-head INSIDE a card — "Timeline", "Overall Progress", "What's Next?".
 *
 * Carries `font-display` because these are written as `<p>` and `<span>`, which
 * the base layer's `h1..h4` rule does not reach.
 */
export const SECTION_TITLE =
    'font-display text-[1.5625rem] font-semibold tracking-tight leading-snug';

/** Body copy inside a card. Never `text-[1.1875rem]` at 400 again. */
export const CARD_BODY =
    'text-[1.25rem] font-normal leading-relaxed';

/** The title of a row in a list — a benefit, a timeline step, an update. */
export const ITEM_TITLE =
    'text-[1.375rem] font-semibold leading-tight';

/** The supporting line under a row title. */
export const ITEM_BODY =
    'text-[1.1875rem] font-normal leading-snug';

/** A date, a count, a caption — the smallest text a signed-in screen uses. */
export const META_TEXT =
    'text-[1.0625rem] font-normal';

/** A big number: a completion percentage, a total. `tabular` so it cannot jitter. */
export const STAT_FIGURE =
    'font-display text-[2.5rem] font-bold tracking-tight leading-none tabular';

/** The small capitalised label above a value, or on a status pill. */
export const EYEBROW =
    'text-[1.1875rem] font-medium uppercase tracking-[0.08em]';

/** The text inside a status chip or badge. */
export const CHIP_TEXT =
    'text-[1.0625rem] font-semibold';

/** A text button or an inline link. */
export const ACTION_TEXT =
    'text-[1.25rem] font-semibold';
