import { useEffect, useState } from 'react';
import { getContactInfo } from '@/services/cmsApi';
import { useSocialLinks, SocialButtons } from '@/components/shared/SocialLinks';
import { RegionsMenu, RegionsAccordion } from './RegionsMenu';
import { SchemesMenu, SchemesAccordion } from './SchemesMenu';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, LogIn, Mail, Phone, X } from 'lucide-react';
import { getSiteSettings, peekCmsCache, type SiteSettings } from '@/services/cmsApi';
import { sectionHidden } from '@/components/shared/cmsSections';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import { BAR_CONTAINER } from './pageContainer';
import { useFluidScale } from './useFluidScale';
import { headerNavigationLinks, isZonesNavLink } from '@/components/shared/headerNavigation';

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

    // The last copy this browser saw, so the header draws on the first frame
    // instead of an empty bar; replaced by the live answer below.
    const [site, setSite] = useState<SiteSettings | null>(() => peekCmsCache<SiteSettings>('site'));
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getSiteSettings()
            .then((data) => { if (!cancelled) setSite(data); })
            // `getSiteSettings` already resolves to an empty shape on failure;
            // this catches only the unexpected. The page still renders.
            // Keep the copy on screen rather than blanking the header.
            .catch(() => { /* `getSiteSettings` already resolves on failure */ });
        return () => { cancelled = true; };
    }, []);

    // Collapse the drawer on navigation, or it stays open over the new page.
    useEffect(() => { setMenuOpen(false); }, [pathname]);

    // Release the drawer's scroll lock when a resized window uses desktop navigation.
    useEffect(() => {
        const desktop = window.matchMedia('(min-width: 1280px)');
        const closeOnDesktop = () => { if (desktop.matches) setMenuOpen(false); };
        desktop.addEventListener('change', closeOnDesktop);
        return () => desktop.removeEventListener('change', closeOnDesktop);
    }, []);

    /*
     * While the phone menu is open the page behind it must not scroll, and
     * Escape closes it. Restored on close, and on unmount.
     */
    useEffect(() => {
        if (!menuOpen) return undefined;
        const before = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = before;
            window.removeEventListener('keydown', onKey);
        };
    }, [menuOpen]);

    const brand = site?.brand;
    /*
     * Each card on the Header & Footer screen can be removed — see
     * `cmsSections`. Removing one empties what it controls here rather
     * than being checked at every use: `navLinks.length > 0` already
     * guards the desktop row, the mobile row and the burger, and three
     * separate `hidden` checks would be three chances to miss one.
     */
    const removed = (key: string) => sectionHidden(site?.sections, key);

    const navLinks = removed('header.navLinks') ? [] : headerNavigationLinks(site?.header?.navLinks);
    const ctaLabel = removed('header.cta') ? '' : (site?.header?.ctaLabel || '');
    const ctaHref = site?.header?.ctaHref || '/login';
    // One-tap contact in the phone menu, from the footer's own contact card.
    /* The site's own phone/email first; the Contact page's HEAD OFFICE when those
       are blank — never an assumed state. */
    const socialLinks = useSocialLinks();
    const [headOffice, setHeadOffice] = useState<{ phone: string; email: string }>({ phone: '', email: '' });
    useEffect(() => {
        let cancelled = false;
        getContactInfo()
            .then((c) => {
                if (cancelled) return;
                const head = (c?.offices || []).find((o) => o.isHeadOffice) || null;
                setHeadOffice({ phone: head?.phone || c?.phone || '', email: head?.email || c?.email || '' });
            })
            .catch(() => { /* the site's own values still apply */ });
        return () => { cancelled = true; };
    }, []);
    const phone = String((site?.footer?.phones || [])[0] || headOffice.phone || '').trim();
    const email = String(site?.footer?.email || headOffice.email || '').trim();

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
                <div className="flex h-[4.5rem] sm:h-[5.5rem] items-center gap-3 sm:gap-5 xl:gap-9">

                    {/*
                      * THE MENU BUTTON — on the LEFT, before the mark, the way
                      * phone sites are read: menu, brand, action. Three bars in
                      * a soft tile that fold into a cross when the menu opens.
                      * Keep the drawer through tablet widths so the full navigation fits.
                      */}
                    {navLinks.length > 0 && (
                        <button
                            type="button"
                            className="xl:hidden relative inline-flex shrink-0 items-center justify-center
                                       h-10 w-10 min-h-[44px] min-w-[44px] sm:h-11 sm:w-11 rounded-2xl border
                                       transition-all duration-200 active:scale-90"
                            style={{
                                color: accent,
                                borderColor: `${accent}26`,
                                backgroundColor: menuOpen ? `${accent}14` : `${accent}08`
                            }}
                            onClick={() => setMenuOpen(v => !v)}
                            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                            aria-expanded={menuOpen}
                        >
                            <span aria-hidden="true" className="relative block h-3.5 w-5">
                                <span className={`absolute left-0 h-[2px] rounded-full bg-current transition-all duration-300
                                    ${menuOpen ? 'top-1/2 w-5 -translate-y-1/2 rotate-45' : 'top-0 w-5'}`} />
                                <span className={`absolute left-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-current transition-all duration-300
                                    ${menuOpen ? 'w-0 opacity-0' : 'w-3.5 opacity-100'}`} />
                                <span className={`absolute left-0 h-[2px] rounded-full bg-current transition-all duration-300
                                    ${menuOpen ? 'top-1/2 w-5 -translate-y-1/2 -rotate-45' : 'bottom-0 w-4'}`} />
                            </span>
                        </button>
                    )}

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
                            <span className="block h-11 lg:h-12 w-[7rem] min-[360px]:w-auto max-w-[7rem] min-[360px]:max-w-[9rem] sm:max-w-[11.5rem] shrink-0">
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
                                className="hidden lg:block xl:hidden min-[1700px]:block h-8 lg:h-9 w-px shrink-0"
                                style={{ backgroundColor: `${accent}33` }}
                            />
                        )}

                        {/*
                          * THE FULL NAME YIELDS TO THE MENU.
                          *
                          * Shown from 1024px, where the menu is behind the
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
                                className="hidden lg:block xl:hidden min-[1700px]:block shrink-0
                                           text-[1rem] lg:text-ui-caption font-bold uppercase
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
                    <div className="ml-auto flex items-center gap-5 xl:gap-8">
                        {navLinks.length > 0 && (
                            <nav className="hidden xl:flex shrink-0 items-center gap-5 xl:gap-7 2xl:gap-8" aria-label="Main">
                                {navLinks.map((item, i) => isZonesNavLink(item.href) ? (
                                    <RegionsMenu key={`${item.href}-${i}`} accent={accent} label={item.label} />
                                ) : isSchemes(item.href) ? (
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
                                        className={`whitespace-nowrap text-ui-caption pt-1.5 pb-1 border-b-2 transition ${
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

                        <div className="flex items-center gap-2 sm:gap-3">
                            {ctaLabel && (
                                /*
                                 * THE LOGIN PILL. A gradient in the header's own
                                 * accent with a light sweep across it on hover or
                                 * tap (`.btn-shine` in index.css), and a pressed
                                 * state — the one button on every page, so it is
                                 * the one that should feel alive.
                                 */
                                <Link
                                    to={ctaHref}
                                    className="btn-shine group relative inline-flex items-center justify-center gap-2
                                               h-10 min-h-[44px] sm:h-11 px-4 sm:px-7 rounded-full overflow-hidden
                                               text-white text-[0.95rem] sm:text-ui-caption font-semibold whitespace-nowrap
                                               shadow-[0_8px_20px_-8px_rgb(28_46_104/0.7)]
                                               transition-transform duration-200 active:scale-95 hover:-translate-y-0.5"
                                    style={{ backgroundImage: `linear-gradient(135deg, ${accent} 0%, #2563eb 100%)` }}
                                >
                                    <LogIn size={17} className="shrink-0 transition-transform duration-300 group-hover:translate-x-0.5" />
                                    {ctaLabel}
                                </Link>
                            )}

                        </div>
                    </div>
                </div>

            </div>

            {/*
              * THE PHONE MENU — a panel that slides in from the right over a
              * blurred page, rather than a list pushed under the bar. Links
              * arrive one after another; the current page is a filled row;
              * the foot carries one-tap Call / Email and the login button, so
              * the actions a phone visitor came for are a thumb away.
              */}
            {menuOpen && navLinks.length > 0 && (
                <div className="xl:hidden fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Menu">
                    <button
                        type="button"
                        aria-label="Close menu"
                        onClick={() => setMenuOpen(false)}
                        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[3px] animate-in fade-in duration-300"
                    />
                    <div
                        /* From the LEFT — the side the menu button is on. */
                        data-mobile-menu-scroll
                        className="absolute left-0 top-0 flex h-full w-[88%] max-w-sm flex-col overflow-y-auto overflow-x-hidden overscroll-contain
                                   rounded-r-[2rem] bg-white shadow-2xl animate-in slide-in-from-left duration-300"
                    >
                        {/* Head: brand + close */}
                        <div className="relative shrink-0 overflow-hidden px-5 pb-5 pt-[max(1.5rem,env(safe-area-inset-top))] text-white"
                             style={{ backgroundImage: `linear-gradient(140deg, ${accent} 0%, #2563eb 100%)` }}>
                            <div aria-hidden="true" className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10" />
                            <div aria-hidden="true" className="absolute -bottom-16 right-16 h-32 w-32 rounded-full bg-white/10" />
                            <div className="relative flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    {/* The mark itself, on a white tile so the navy logo
                                        reads on the blue — the menu says whose it is. */}
                                    {brand?.logo?.url ? (
                                        <span className="inline-flex h-12 items-center rounded-xl bg-white px-3 py-1.5 shadow-sm">
                                            <span className="block h-full w-auto max-w-[9rem]">
                                                <CmsMediaFrame media={brand.logo} transparent className="object-contain object-left" />
                                            </span>
                                        </span>
                                    ) : (
                                        <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-white/70">Menu</p>
                                    )}
                                    <p className="mt-3 text-[1rem] font-bold leading-snug">
                                        {brand?.fullName || 'ACTIV'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setMenuOpen(false)}
                                    aria-label="Close menu"
                                    className="grid h-10 w-10 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-2xl bg-white/15
                                               transition active:scale-90 hover:bg-white/25"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Links */}
                        <nav className="flex-none px-4 py-4" aria-label="Main">
                            {navLinks.map((item, i) => (
                                <div
                                    key={`m-${item.href}-${i}`}
                                    className="animate-in fade-in slide-in-from-left-4 fill-mode-both"
                                    style={{ animationDelay: `${60 + i * 40}ms`, animationDuration: '380ms' }}
                                >
                                    {isZonesNavLink(item.href) ? (
                                        <RegionsAccordion accent={accent} label={item.label} onNavigate={() => setMenuOpen(false)} />
                                    ) : isSchemes(item.href) ? (
                                        <SchemesAccordion
                                            accent={accent}
                                            label={item.label}
                                            onNavigate={() => setMenuOpen(false)}
                                        />
                                    ) : (
                                        <Link
                                            to={item.href || '/'}
                                            aria-current={isActive(item.href) ? 'page' : undefined}
                                            className={`group flex min-h-[44px] items-center justify-between gap-2 rounded-2xl px-4 py-3.5
                                                        text-ui-caption transition-all active:scale-[0.98] ${
                                                isActive(item.href) ? 'font-bold text-white shadow-md' : 'font-semibold hover:bg-slate-50'
                                            }`}
                                            style={isActive(item.href)
                                                ? { backgroundImage: `linear-gradient(135deg, ${accent}, #2563eb)` }
                                                : { color: accent }}
                                        >
                                            {item.label}
                                            <ChevronRight
                                                size={18}
                                                className={`shrink-0 transition-transform duration-200 group-hover:translate-x-1 ${
                                                    isActive(item.href) ? 'opacity-90' : 'opacity-40'
                                                }`}
                                            />
                                        </Link>
                                    )}
                                </div>
                            ))}

                        </nav>

                        {/* Foot: one-tap contact + login */}
                        <div className="mt-auto shrink-0 border-t border-slate-100 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
                            {socialLinks.length > 0 && (
                                <div className="mb-3">
                                    <p className="mb-2 text-[0.8125rem] font-bold uppercase tracking-[0.14em] text-slate-400">Follow us</p>
                                    <SocialButtons links={socialLinks} size="sm" className="[&_a]:min-h-[44px] [&_a]:min-w-[44px]" />
                                </div>
                            )}
                            {(phone || email) && (
                                <div className="mb-3 grid grid-cols-2 gap-2">
                                    {phone && (
                                        <a href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                                           className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-slate-200
                                                      py-3 text-[0.95rem] font-semibold transition active:scale-95 hover:bg-slate-50"
                                           style={{ color: accent }}>
                                            <Phone size={16} /> Call
                                        </a>
                                    )}
                                    {email && (
                                        <a href={`mailto:${email}`}
                                           className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-slate-200
                                                      py-3 text-[0.95rem] font-semibold transition active:scale-95 hover:bg-slate-50"
                                           style={{ color: accent }}>
                                            <Mail size={16} /> Email
                                        </a>
                                    )}
                                </div>
                            )}
                            {ctaLabel && (
                                <Link
                                    to={ctaHref}
                                    className="btn-shine relative flex min-h-[44px] items-center justify-center gap-2 overflow-hidden rounded-2xl
                                               py-3.5 text-ui-caption font-bold text-white shadow-lg transition active:scale-[0.97]"
                                    style={{ backgroundImage: `linear-gradient(135deg, ${accent} 0%, #2563eb 100%)` }}
                                >
                                    <LogIn size={18} /> {ctaLabel}
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}
