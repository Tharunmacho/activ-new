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
 * The gutter for the site's chrome — the header bar and the footer.
 *
 * Deliberately NOT `PAGE_CONTAINER`. These two span the whole viewport, so the
 * mark sits against the left edge of the screen and the nav against the right,
 * instead of both being tucked into the centred 1280px column with ~270px of
 * empty white either side of them on a wide display. Header and footer share
 * this one value, so the logo at the top of the page and the logo at the bottom
 * start on the same vertical line.
 *
 * The trade-off is real and chosen: neither logo starts on the same line as the
 * hero headline or the section headings between them. A full-bleed bar over a
 * contained page is a common pattern precisely because the bar then reads as
 * chrome rather than as the first row of the content.
 */
export const BAR_CONTAINER = 'w-full px-5 sm:px-8 lg:px-12';
