import { useEffect, useState } from 'react';
import { RegionsMenu, RegionsAccordion } from './RegionsMenu';
import { SchemesMenu, SchemesAccordion } from './SchemesMenu';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { getSiteSettings, type SiteSettings } from '@/services/cmsApi';
import { sectionHidden } from '@/components/shared/cmsSections';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import { BAR_CONTAINER } from './pageContainer';
import { useFluidScale } from './useFluidScale';

/**
 * The public site's header.
 *
 * Everything visible here — the mark, the lockup beside it, each nav entry and
 * the button on the right — comes from `/cms/site`. Nothing is hardcoded, so
 * removing a nav link in the CMS removes it from the site rather than appearing
 * to do nothing.
 *
 * The header is fetched per page rather than lifted to a shared provider. It is
 * one small cached GET, and threading it through would couple every public page
 * to a context that exists for one component.
 */
export function HeaderSection() {
    // Fluid page scaling, on for the public pages and off everywhere else.
    useFluidScale();

    const location = useLocation();
    const pathname = location.pathname;

    const [site, setSite] = useState<SiteSettings | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getSiteSettings()
            .then((data) => { if (!cancelled) setSite(data); })
            // `getSiteSettings` already resolves to an empty shape on failure;
            // this catches only the unexpected. The page still renders.
            .catch(() => { if (!cancelled) setSite(null); });
        return () => { cancelled = true; };
    }, []);

    // Collapse the drawer on navigation, or it stays open over the new page.
    useEffect(() => { setMenuOpen(false); }, [pathname]);

    const brand = site?.brand;
    /*
     * Each card on the Header & Footer screen can be removed — see
     * `cmsSections`. Removing one empties what it controls here rather
     * than being checked at every use: `navLinks.length > 0` already
     * guards the desktop row, the mobile row and the burger, and three
     * separate `hidden` checks would be three chances to miss one.
     */
    const removed = (key: string) => sectionHidden(site?.sections, key);

    const navLinks = removed('header.navLinks') ? [] : (site?.header?.navLinks || []);
    const ctaLabel = removed('header.cta') ? '' : (site?.header?.ctaLabel || '');
    const ctaHref = site?.header?.ctaHref || '/login';

    /**
     * The bar's colours, from the CMS.
     *
     * These were `bg-white` and `#1c2e68`, written into eight class names here,
     * so recolouring the header meant editing this file and deploying. They are
     * now editable in Site settings, which is what a CMS is for. The fallbacks
     * are the previous values, so a site that has never set them looks exactly
     * as it did.
     *
     * Applied inline rather than through Tailwind classes because Tailwind
     * compiles the classes it can see in the source — a colour that only exists
     * in the database at runtime produces no CSS at all.
     */
    /* A removed Colours card falls back to the defaults the header shipped
       with, which is what 'not set' has always meant here. */
    const background = (removed('header.colours') ? '' : site?.header?.background) || '#ffffff';
    const accent = (removed('header.colours') ? '' : site?.header?.textColor) || '#1c2e68';

    // '/' and '/onboarding' are the same page, so both light the Home link.
    const isActive = (href: string) =>
        pathname === href || (href === '/' && pathname === '/onboarding');

    /**
     * The underline is always drawn — transparent when the link is not current.
     *
     * It used to be added by `border-b-2` on the active item only, so that one
     * item was two pixels taller than its neighbours and the whole row of
     * labels shifted up by a pixel as you moved between pages. Reserving the
     * space means the baseline never moves.
     */
    /* The menu link that becomes the Schemes dropdown — see `SchemesMenu`. */
    const isSchemes = (href?: string) => String(href || '').replace(/\/+$/, '') === '/schemes';

    const navItemStyle = (href: string) =>
        isActive(href)
            ? { color: accent, borderColor: accent }
            : { color: accent, borderColor: 'transparent' };

    return (
        <header
            className="w-full font-sans sticky top-0 z-50 border-b shadow-sm"
            style={{ backgroundColor: background, borderColor: `${accent}1A` }}
        >
            <div className={BAR_CONTAINER}>
                {/*
                  A fixed bar height rather than `py-4`, so the bar does not
                  resize when an editor uploads a taller mark and the sticky
                  offset below it is a known number.

                  5.5rem — 88px at the default root size, between the 80 it
                  started at and the 104 it briefly grew to.

                  `rem`, not `px`, and that matters more than the number. Every
                  size in this bar used to be a literal pixel value: `h-[104px]`,
                  `text-[17px]`, `max-w-[170px]`. Those do not answer to the
                  fluid root font size, so at 90% zoom the hero, the sections and
                  the footer all scaled up around a header that stayed exactly
                  where it was — the one strip on the page that ignored the zoom
                  fix. Everything here is now rem-based and scales with the rest.
                */}
                <div className="flex h-[5.5rem] items-center gap-5 lg:gap-9">

                    {/* ---------------------------------------------- brand */}
                    <Link to="/" className="flex items-center gap-3 min-w-0" aria-label="ACTIV home">
                        {/*
                          The wrapper is what sizes the mark, not the class on
                          `CmsMediaFrame`. That component prepends `w-full h-full`
                          to whatever it is given, and Tailwind emits `h-full`
                          after `h-11`, so a height passed straight to it loses.
                          A box with a definite height is what `h-full` then
                          resolves against.
                        */}
                        {brand?.logo?.url && (
                            <span className="block h-11 lg:h-12 w-auto max-w-[9rem] sm:max-w-[11.5rem] shrink-0">
                                <CmsMediaFrame
                                    media={brand.logo}
                                    /*
                                      The mark is a transparent PNG, so it must
                                      not be given the frame's loading plate:
                                      nothing ever paints over it, and it stayed
                                      on screen as a grey card behind the logo.
                                    */
                                    transparent
                                    className="object-contain object-left"
                                />
                            </span>
                        )}

                        {/*
                          The rule is its own element at a fixed height.
                          It was a `border-l-2` on the text, so it grew and shrank
                          with the two lines of the lockup and sat visibly shorter
                          than the mark beside it.
                        */}
                        {brand?.logo?.url && brand?.fullName && (
                            <span
                                aria-hidden="true"
                                /* The same widths as the name it divides —
                                   see the threshold note below. A rule with
                                   nothing on its right is a stray line. */
                                className="hidden md:block lg:hidden min-[1700px]:block h-8 lg:h-9 w-px shrink-0"
                                style={{ backgroundColor: `${accent}33` }}
                            />
                        )}

                        {/*
                          * THE FULL NAME YIELDS TO THE MENU.
                          *
                          * Shown on a tablet, where the menu is behind the
                          * hamburger, and on a wide desktop; hidden between
                          * 1024px and 1536px, where eight links and Regions
                          * need the room. With both drawn there, the name ran
                          * into "Home" and "Contact Us" broke over two lines.
                          * The logo still names the association at every width.
                          */}
                        {brand?.fullName && (
                            <span
                                /*
                                 * TWO LINES, NOT THREE.
                                 *
                                 * At `max-w-[17rem]` the name broke as
                                 * ADIDRAVIDAR / CONFEDERATION OF TRADE / AND
                                 * INDUSTRIAL VISION — three short lines in a
                                 * 5.5rem bar, so the lockup was taller than the
                                 * mark beside it and the first line was one
                                 * word on its own.
                                 *
                                 * THE MEASURE IS WHAT PUTS "TRADE" ON THE
                                 * SECOND LINE, and it is a measured number.
                                 *
                                 * At 17px with 1.02px of tracking the three
                                 * candidate first lines are:
                                 *
                                 *     ADIDRAVIDAR CONFEDERATION          292px
                                 *     ADIDRAVIDAR CONFEDERATION OF       322px
                                 *     ADIDRAVIDAR CONFEDERATION OF TRADE 387px
                                 *
                                 * so any cap between 322 and 386 breaks after
                                 * OF and gives "TRADE AND INDUSTRIAL VISION"
                                 * as the second line.
                                 *
                                 * `em`, NOT `rem`, AND THAT IS THE WHOLE
                                 * POINT. This type is 16px below `lg` and
                                 * 17px above it, so a fixed 23rem cap sat
                                 * inside the window at 17px and OUTSIDE it at
                                 * 16px — at 900px wide the whole line was ~6%
                                 * narrower, "… OF TRADE" fitted in 368px, and
                                 * the break moved back a word. An `em` cap is
                                 * a multiple of this element's own size, so
                                 * the ratio between the words and the measure
                                 * is the same at both, and so is the break.
                                 * 21.6em is 367px at 17px and 346px at 16px,
                                 * inside the window at each.
                                 *
                                 * `text-wrap: balance` WAS TRIED AND REMOVED.
                                 * It works, and it chooses the other split:
                                 * balancing minimises the WIDEST line, and
                                 * "OF TRADE AND INDUSTRIAL VISION" is 319px
                                 * against 322 for the line above, so it wins
                                 * by three pixels and carries OF down with it.
                                 * More even, and not the reading the
                                 * association wants.
                                 *
                                 * `shrink-0`, AND THE DESKTOP THRESHOLD IS
                                 * 1700px RATHER THAN 2xl. At exactly 1536 the
                                 * nav and the name both wanted the row, the
                                 * name lost (it is the flexible item) and was
                                 * squeezed to 190px — FOUR lines, one word
                                 * each. A max-width only caps a box; it does
                                 * not stop flex taking the room back. So the
                                 * name refuses to shrink, and it is simply not
                                 * drawn until there is room for it, which is
                                 * the rule this header already had — the
                                 * threshold was just set a breakpoint too low.
                                 * Below it the mark still names the
                                 * association, as it does from 1024 to 1700.
                                 *
                                 * No `<br>`, because this string is CMS
                                 * content (Header & footer -> Brand -> Full
                                 * name). A hand-placed break would survive a
                                 * rename and sit in the middle of the wrong
                                 * word; a measure just wraps the new words.
                                 */
                                className="hidden md:block lg:hidden min-[1700px]:block shrink-0
                                           text-[1rem] lg:text-[1.0625rem] font-bold uppercase
                                           leading-[1.35] tracking-[0.06em] max-w-[21.6em]"
                                style={{ color: accent }}
                            >
                                {brand.fullName}
                            </span>
                        )}
                    </Link>

                    {/* ------------------------------------- nav + action
                        One right-hand group, so the spacing between the last
                        link and the button is set here and not left to whatever
                        `justify-between` happened to produce at a given width. */}
                    <div className="ml-auto flex items-center gap-5 lg:gap-8">
                        {navLinks.length > 0 && (
                            <nav className="hidden lg:flex shrink-0 items-center gap-5 xl:gap-7 2xl:gap-8" aria-label="Main">
                                {navLinks.map((item, i) => isSchemes(item.href) ? (
                                    /* The CMS's "Schemes" link opens a dropdown like
                                       Regions — Central, then each region's states. */
                                    <SchemesMenu
                                        key={`${item.href}-${i}`}
                                        accent={accent}
                                        label={item.label}
                                        active={pathname.startsWith('/schemes')}
                                    />
                                ) : (
                                    <Link
                                        key={`${item.href}-${i}`}
                                        to={item.href || '/'}
                                        aria-current={isActive(item.href) ? 'page' : undefined}
                                        /*
                                          `pt-1.5` balances the 4px of bottom
                                          padding plus the 2px rule, so the box
                                          is symmetric about the text and
                                          `items-center` puts the label on the
                                          same centre line as the logo and the
                                          button. With bottom padding only, the
                                          whole nav rode 3px high.
                                        */
                                        className={`whitespace-nowrap text-[1.0625rem] pt-1.5 pb-1 border-b-2 transition ${
                                            isActive(item.href)
                                                ? 'font-semibold'
                                                : 'font-medium opacity-70 hover:opacity-100'
                                        }`}
                                        style={navItemStyle(item.href)}
                                    >
                                        {item.label}
                                    </Link>
                                ))}

                                {/*
                                  * REGIONS, after the CMS's own links.
                                  *
                                  * Not one of `navLinks`: those are single
                                  * links an editor types, and this is a
                                  * two-level menu built from
                                  * `/cms/regions/map`. Putting it last keeps
                                  * the editor in charge of everything before
                                  * it.
                                  */}
                                <RegionsMenu accent={accent} />
                            </nav>
                        )}

                        <div className="flex items-center gap-2">
                            {ctaLabel && (
                                <Link
                                    to={ctaHref}
                                    className="inline-flex items-center justify-center h-11 px-7 rounded-full
                                               text-white text-[1.0625rem] font-semibold whitespace-nowrap shadow-sm
                                               transition-opacity hover:opacity-90"
                                    style={{ backgroundColor: accent }}
                                >
                                    {ctaLabel}
                                </Link>
                            )}

                            {/* The nav collapses below `lg`; without this it is unreachable. */}
                            {navLinks.length > 0 && (
                                <button
                                    type="button"
                                    className="lg:hidden inline-flex items-center justify-center
                                               h-11 w-11 rounded-full transition-colors hover:bg-black/5"
                                    style={{ color: accent }}
                                    onClick={() => setMenuOpen(v => !v)}
                                    aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                                    aria-expanded={menuOpen}
                                >
                                    {menuOpen ? <X size={24} /> : <Menu size={24} />}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {menuOpen && navLinks.length > 0 && (
                    <nav
                        className="lg:hidden flex flex-col gap-1 pb-4 pt-3 border-t"
                        style={{ borderColor: `${accent}1A` }}
                        aria-label="Main"
                    >
                        {navLinks.map((item, i) => isSchemes(item.href) ? (
                            <SchemesAccordion
                                key={`m-${item.href}-${i}`}
                                accent={accent}
                                label={item.label}
                                onNavigate={() => setMenuOpen(false)}
                            />
                        ) : (
                            <Link
                                key={`m-${item.href}-${i}`}
                                to={item.href || '/'}
                                aria-current={isActive(item.href) ? 'page' : undefined}
                                className={`px-3 py-2.5 rounded-lg text-[1.0625rem] transition-colors hover:bg-black/5 ${
                                    isActive(item.href) ? 'font-semibold bg-black/5' : 'font-medium'
                                }`}
                                style={{ color: accent }}
                            >
                                {item.label}
                            </Link>
                        ))}

                        {/* An accordion here, not the flyout — see the note in
                            RegionsMenu about the first tap on a touch screen. */}
                        <RegionsAccordion accent={accent} onNavigate={() => setMenuOpen(false)} />
                    </nav>
                )}
            </div>
        </header>
    );
}
