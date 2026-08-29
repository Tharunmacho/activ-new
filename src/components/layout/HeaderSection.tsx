import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { getSiteSettings, type SiteSettings } from '@/services/cmsApi';
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
    const navLinks = site?.header?.navLinks || [];
    const ctaLabel = site?.header?.ctaLabel || '';
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
    const background = site?.header?.background || '#ffffff';
    const accent = site?.header?.textColor || '#1c2e68';

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
                                <CmsMediaFrame media={brand.logo} className="object-contain object-left" />
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
                                className="hidden md:block h-8 lg:h-9 w-px shrink-0"
                                style={{ backgroundColor: `${accent}33` }}
                            />
                        )}

                        {brand?.fullName && (
                            <span
                                className="hidden md:block text-[0.7rem] lg:text-xs font-bold uppercase
                                           leading-[1.35] tracking-[0.06em] max-w-[17rem]"
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
                            <nav className="hidden lg:flex items-center gap-7 xl:gap-9" aria-label="Main">
                                {navLinks.map((item, i) => (
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
                                        className={`text-[0.9375rem] pt-1.5 pb-1 border-b-2 transition ${
                                            isActive(item.href)
                                                ? 'font-semibold'
                                                : 'font-medium opacity-70 hover:opacity-100'
                                        }`}
                                        style={navItemStyle(item.href)}
                                    >
                                        {item.label}
                                    </Link>
                                ))}
                            </nav>
                        )}

                        <div className="flex items-center gap-2">
                            {ctaLabel && (
                                <Link
                                    to={ctaHref}
                                    className="inline-flex items-center justify-center h-11 px-7 rounded-full
                                               text-white text-[0.9375rem] font-semibold whitespace-nowrap shadow-sm
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
                        {navLinks.map((item, i) => (
                            <Link
                                key={`m-${item.href}-${i}`}
                                to={item.href || '/'}
                                aria-current={isActive(item.href) ? 'page' : undefined}
                                className={`px-3 py-2.5 rounded-lg text-sm transition-colors hover:bg-black/5 ${
                                    isActive(item.href) ? 'font-semibold bg-black/5' : 'font-medium'
                                }`}
                                style={{ color: accent }}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                )}
            </div>
        </header>
    );
}
