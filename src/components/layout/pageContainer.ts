/**
 * The public site's content column. Every block on every public page uses it.
 *
 * One string, shared, because three separate places had already drifted off it
 * and nothing made that visible:
 *
 *   - the header omitted `max-w-7xl` entirely,
 *   - the hero carousel's caption block omitted it too,
 *   - the gallery pinned itself to `max-w-[1400px]`.
 *
 * Tailwind's `container` is configured to 1400px at `2xl` (tailwind.config), so
 * all three rendered a 1400px column while the footer, the About block, the
 * events grid and the contact form rendered 1280px. On a wide screen that put
 * the hero headline and the logo on two different left edges — 60px apart — and
 * the logo looked indented from the page it sat above.
 *
 * Importing this instead of retyping the classes is what keeps one left edge
 * down the whole page.
 */
export const PAGE_CONTAINER = 'mx-auto w-full max-w-7xl px-4 md:px-8';

/**
 * The column for the DASHBOARD pages — the regional and state screens.
 *
 * =========================================================================
 * IT SHARES THE HEADER'S GUTTER, EXACTLY
 * =========================================================================
 *
 * `BAR_CONTAINER` puts the ACTIV mark 48px from the left edge and the Login
 * button 48px from the right. A centred 1440px column on an 1867px display
 * starts at 246px — so the hero band began 198px inboard of the logo sitting
 * directly above it, and the page read as a narrow card floating under a
 * full-width bar. Measured, reported, and the reason this is not
 * `PAGE_CONTAINER`.
 *
 * The dashboards are the pages where that matters. They are a grid of eleven
 * cards two and three abreast — the same shape as the admin screens, which are
 * also full-bleed — and the whole point of the layout is that the grid fills
 * the screen. A page of body copy is different and keeps its narrow measure;
 * see `PAGE_CONTAINER` above.
 *
 * No `max-w`: a cap would re-open the same gap the moment a display is wider
 * than it. Matching the bar means matching the bar at every size.
 */
export const WIDE_CONTAINER = 'w-full px-5 sm:px-8 lg:px-12';

/**
 * The gutter for the site's header bar.
 *
 * Deliberately NOT `PAGE_CONTAINER`. The bar spans the whole viewport, so the
 * mark sits against the left edge of the screen and the nav against the right,
 * instead of both being tucked into the centred 1280px column with ~270px of
 * empty white either side of them on a wide display.
 *
 * The trade-off is real and chosen: the logo does not start on the same line as
 * the hero headline beneath it. A full-bleed bar over a contained page is a
 * common pattern precisely because the bar then reads as chrome rather than as
 * the first row of the content.
 */
export const BAR_CONTAINER = 'w-full px-5 sm:px-8 lg:px-12';

/**
 * The footer's content column.
 *
 * The footer used to share `BAR_CONTAINER` with the header, and the reason it
 * did no longer applies. That reason was "the mark sits against the left edge
 * of the screen" — but the footer's mark is centred now, and full-bleed only
 * flung the two outer columns into the corners: "Contact" started 48px from the
 * left edge of a 1440px display and the address ended 48px from the right, with
 * a lake of empty navy between each of them and the centred logo.
 *
 * Narrower than `PAGE_CONTAINER` on purpose, not merely centred. Three columns
 * of short lines want to sit closer together than a page of body copy does; at
 * the full 1280px the phone number and the address still read as two unrelated
 * blocks rather than as one row.
 */
export const FOOTER_CONTAINER = 'mx-auto w-full max-w-6xl px-6 sm:px-8 lg:px-10';

/**
 * The column for a page that should FILL the screen but still breathe.
 *
 * Sits between the other two, and exists because neither was right for the
 * membership prospectus or the events explorer:
 *
 *   - `PAGE_CONTAINER`'s centred 1280px left 320px of empty white down each
 *     side of a 1920px display, under a header and above a footer that both
 *     run edge to edge. The page read as a narrow strip pasted onto the site.
 *   - `WIDE_CONTAINER` is the header BAR's gutter exactly, which is right for
 *     chrome — a logo against the edge of the screen reads as correct — and
 *     too tight for a wall of body copy or a card, which then read as about
 *     to fall off the page.
 *
 * So: a gutter that OPENS with the display — 40px on a phone, 64px at `lg`,
 * 112px at `xl`, 144px from `1536px` up — capped at 1920px so a 2560px monitor
 * centres the page rather than stretching a card to 600px. One class sets BOTH
 * sides, which is what keeps the left edge of the prose and the right edge of
 * the last card the same distance in at every width; two numbers maintained
 * separately drift.
 *
 * The numbers went up once already. The first attempt reused the bar's 48px
 * and every one of these pages read as content jammed into the corners of the
 * screen — the gutter has to grow with the display, not stay at the value that
 * suits a 1280px laptop.
 *
 * A page of pure body copy still wants `PAGE_CONTAINER`, or a `max-w` cap on
 * the prose inside this one: 1,700px of 18px text is 190 characters a line.
 */
export const SCREEN_CONTAINER =
    'mx-auto w-full max-w-[120rem] px-5 sm:px-10 lg:px-16 xl:px-28 2xl:px-36';
