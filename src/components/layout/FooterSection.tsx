import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin } from 'lucide-react';
import { sectionHidden } from '@/components/shared/cmsSections';
import { SectionFields } from '@/components/shared/SectionFields';
import { CmsExtraFields } from '@/components/shared/CmsExtraFields';
import { getSiteSettings, getLegalLinks, type SiteSettings } from '@/services/cmsApi';
import { zoneName, getRegionMap } from '@/services/cmsRegionsApi';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import { CmsIcon } from '@/components/shared/CmsIcon';
import { SCREEN_CONTAINER } from './pageContainer';

/**
 * The public site's footer — the brand mark centred on the navy, contact on one
 * side, address on the other, and the site's own navigation on a rule beneath.
 *
 * Every column, link, phone number and social button is authored in the CMS.
 * Sections with nothing in them are not rendered at all — an empty column would
 * leave a gap in the grid that reads as a layout bug rather than as absent
 * content.
 *
 * The centre column is the reason this is a three-column grid rather than the
 * flex row it used to be. A `flex-1` on each of three children centres the
 * middle one only when the two outer ones happen to be the same width, and
 * "Contact" and "Address" never are — the mark drifted left or right depending
 * on how many phone numbers were authored. `1fr auto 1fr` pins the centre to
 * the page's centre and lets the outer two take what is left, so the logo sits
 * on the same vertical line as the heading above it on every page.
 */
export function FooterSection() {
    const [site, setSite] = useState<SiteSettings | null>(null);
    /**
     * The published legal documents, as label and href.
     *
     * A second request rather than reading them off `site`, because they are a
     * different collection with a different editor and a different lifecycle —
     * and because `/cms/legal/links` returns four short strings while the
     * documents themselves run to thousands of words. The footer is on every
     * page; it must not carry the text of the Terms to draw a link to them.
     *
     * Its failure is silent and leaves the row empty. A footer that fails to
     * render is a worse outcome than a footer missing its legal links, and the
     * pages themselves stay reachable by URL either way.
     */
    const [policyLinks, setPolicyLinks] = useState<{ label: string; href: string }[]>([]);

    useEffect(() => {
        let cancelled = false;

        getSiteSettings()
            .then((data) => { if (!cancelled) setSite(data); })
            .catch(() => { if (!cancelled) setSite(null); });

        getLegalLinks()
            .then((rows) => { if (!cancelled) setPolicyLinks(rows || []); })
            .catch(() => { if (!cancelled) setPolicyLinks([]); });

        return () => { cancelled = true; };
    }, []);

    const brand = site?.brand;
    const footer = site?.footer;

    /**
     * A link that goes nowhere is not content.
     *
     * The seeded footer carries placeholders — a "News" column, five social
     * buttons and both legal links all point at `#`. Rendered, they are
     * clickable things that do nothing, which reads as a broken site rather
     * than as an unfinished one. Filtering on the href rather than deleting the
     * rows keeps this honest to the CMS: the moment an editor puts a real URL
     * on one, it comes back on its own.
     */
    const isLive = (href?: string) => {
        const value = (href || '').trim();
        return !!value && value !== '#' && !value.startsWith('#');
    };

    /*
     * Each card on the Header & Footer screen can be removed — see
     * `cmsSections`. Removing one empties what it feeds rather than being
     * asked again at every use: `addressLines.length` and `hasContact`
     * already decide whether those blocks are drawn, and a second
     * condition beside each is a second chance to miss one.
     */
    const removed = (key: string) => sectionHidden(site?.sections, key);

    const addressLines = removed('footer.address') ? [] : (footer?.addressLines || []);
    const phones = removed('footer.contact') ? [] : (footer?.phones || []);
    const socials = removed('footer.socials')
        ? []
        : (footer?.socials || []).filter((s) => isLive(s?.href));

    /**
     * The legal row — the association's actual policy documents, live.
     *
     * TWO SOURCES, AND NEITHER IS HARDCODED. `policyLinks` is
     * `/cms/legal/links`: one row per published document in
     * `web_legal_documents`, labelled and ordered by the editor. A fifth policy
     * appears here the moment it is published, and an unpublished one
     * disappears — no deploy either way.
     *
     * `footer.legalLinks` stays because it is a different thing: free links an
     * editor put on the footer's legal rule, which may point anywhere at all
     * (an external regulator, a parent body). It is filtered by `isLive` like
     * every other authored link, because a footer link pointing at `#` is a
     * clickable thing that does nothing.
     *
     * De-duplicated on HREF, not on label: "Terms & Conditions" and "Terms and
     * Conditions" are the same page under two spellings, and the destination is
     * what catches that. The authored row wins when both name the same page —
     * an editor who deliberately overrode a label meant it.
     */
    const authoredLegal = removed('footer.bottomBar')
        ? []
        : (footer?.legalLinks || []).filter((l) => isLive(l?.href));
    const authoredHrefs = new Set(authoredLegal.map((l) => (l.href || '').replace(/\/+$/, '')));
    const legalLinks = removed('footer.bottomBar') ? [] : [
        ...authoredLegal,
        ...policyLinks.filter((l) => !authoredHrefs.has(l.href.replace(/\/+$/, ''))),
    ];

    /**
     * The navigation rule.
     *
     * Flattened from every authored column rather than taken from the first:
     * the footer's link columns are "the site's own pages" and "News", and only
     * the ones pointing somewhere real belong on a single centred row.
     */
    const navLinks = removed('footer.linkColumns') ? [] : (footer?.linkColumns || [])
        .flatMap((column) => column?.links || [])
        .filter((link) => isLive(link?.href));

    /*
     * The regions, for the row below the nav.
     *
     * `getRegionMap` is cached and de-duplicated in `cmsApi`, and the header
     * menu has already asked for it on every page this footer renders on — so
     * this costs a cache read, not a request.
     */
    const [regionLinks, setRegionLinks] = useState<{ label: string; href: string }[]>([]);

    useEffect(() => {
        let cancelled = false;
        getRegionMap()
            .then((rows) => {
                if (cancelled) return;
                setRegionLinks((rows || [])
                    .filter((r) => r.hasPage)
                    .map((r) => ({ label: zoneName(r.label, r.national), href: `/regions/${r.slug}` })));
            })
            /* Silent: a footer must render with or without this. */
            .catch(() => { /* the row is simply not drawn */ });
        return () => { cancelled = true; };
    }, []);

    // `{year}` rather than a literal, so the notice never has to be re-edited.
    const copyright = removed('footer.bottomBar')
        ? ''
        : (footer?.copyright || '').replace('{year}', String(new Date().getFullYear()));

    const email = removed('footer.contact') ? '' : (footer?.email || '');
    const note = removed('footer.bottomBar') ? '' : (footer?.note || '');

    /*
     * The editor's own rows, per card, then the footer's own list.
     *
     * All of them render in one place — above the bottom bar — because the
     * footer's parts are columns of links rather than prose sections, and a
     * labelled line dropped into the middle of a link column would read as
     * a link that lost its href.
     */
    /*
     * Each card's rows are drawn IN THAT COLUMN now — see `SectionFields`.
     *
     * They were pooled here into one strip above the bottom bar, so a field
     * added to Contact and a field added to Brand landed in the same place,
     * and neither sat with the thing it was about. What is left is the list
     * attached to the SITE, which is not a column and belongs across the foot.
     */
    const ownRows = site?.extraFields || [];

    /* The footer's ground is dark, and the columns are narrow. */
    const columnFields = (key: string) => (
        <SectionFields
            /* The footer's column copy — the size its addresses and phone
               numbers are set at, so an added row sits in the same column
               rhythm rather than at the browser's default. */
            proseClass="text-[1.125rem] font-medium leading-relaxed"
            sections={site?.sections}
            sectionKey={key}
            /* A footer column is labelled lines and nothing else — see
               `fieldMode` on the six CMS steps. */
            force="card"
            tone="dark"
            className="mt-7"
        />
    );

    const hasContact = !!(phones.length || email || socials.length);
    const hasBottomBar = !!(copyright || legalLinks.length || note);

    // An internal path routes; an absolute URL or a placeholder must not.
    const renderLink = (label: string, href: string, className: string, key: string) => (
        href.startsWith('/')
            ? <Link key={key} to={href} className={className}>{label}</Link>
            : <a
                key={key}
                href={href}
                target={href.startsWith('http') ? '_blank' : undefined}
                rel={href.startsWith('http') ? 'noreferrer' : undefined}
                className={className}
              >{label}</a>
    );

    return (
        <footer className="relative w-full overflow-hidden bg-brand-900 text-white font-sans">
            {/*
              Depth, not decoration for its own sake: a flat fill this large
              reads as a block of colour dropped under the page. Two very soft
              brand blooms and a hairline of light along the top edge give it a
              surface. `pointer-events-none` throughout — none of it is content.
            */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                <div className="absolute -top-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-brand-700/40 blur-3xl transform-gpu" />
                <div className="absolute -bottom-48 -right-24 h-[32rem] w-[32rem] rounded-full bg-brand-600/25 blur-3xl transform-gpu" />
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            </div>

            {/*
              THE SAME COLUMN AS THE PAGE ABOVE IT.

              The footer kept its own narrower `FOOTER_CONTAINER` while every
              public band moved to `SCREEN_CONTAINER`, so "CONTACT" started
              ~180px inboard of the section above it and the whole strip read
              as a different page stitched on at the bottom. One column, one
              left edge, all the way down.
            */}
            <div className={`${SCREEN_CONTAINER} relative z-10 pt-16 pb-8`}>

                <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-10 lg:items-start">

                    {/* ------------------------------------------- contact */}
                    {hasContact ? (
                        <div className="min-w-0">
                            <ColumnHeading>{footer?.contactHeading || 'Contact Us'}</ColumnHeading>

                            <div className="space-y-4">
                                {phones.length > 0 && (
                                    <div className="flex items-start gap-3.5">
                                        <IconPlate><Phone size={15} /></IconPlate>
                                        <div className="space-y-1 pt-1.5">
                                            {phones.map((p, i) => (
                                                <a
                                                    key={i}
                                                    href={`tel:${p.replace(/\s+/g, '')}`}
                                                    /*
                                                      `py-2 -my-1` grows the touch area to
                                                      ~40px without opening a gap between the
                                                      two numbers: the padding is what a finger
                                                      hits, the negative margin pulls the line
                                                      box back to where the design had it.
                                                    */
                                                    className="block py-2.5 -my-1.5 text-[1.125rem] font-medium
                                                               text-white/85 hover:text-white transition-colors"
                                                >
                                                    {p}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {email && (
                                    <div className="flex items-start gap-3.5">
                                        <IconPlate><Mail size={15} /></IconPlate>
                                        <a
                                            href={`mailto:${email}`}
                                            className="block py-2.5 -my-1 text-[1.125rem] font-medium text-white/85
                                                       hover:text-white transition-colors break-all"
                                        >
                                            {email}
                                        </a>
                                    </div>
                                )}
                            </div>

                            {columnFields('footer.contact')}

                            {socials.length > 0 && (
                                <div className="flex flex-wrap gap-2.5 mt-7">
                                    {socials.map((s, i) => (
                                        <a
                                            key={i}
                                            href={s.href}
                                            target={s.href?.startsWith('http') ? '_blank' : undefined}
                                            rel="noreferrer"
                                            aria-label={s.icon}
                                            className="w-11 h-11 rounded-full bg-white/10 ring-1 ring-white/15
                                                       flex items-center justify-center text-white
                                                       hover:bg-white hover:text-brand-800 hover:-translate-y-0.5
                                                       transition-all duration-300"
                                        >
                                            <CmsIcon name={s.icon} size={16} fallback="globe" />
                                        </a>
                                    ))}
                                </div>
                            )}

                            {columnFields('footer.socials')}
                        </div>
                    ) : <div />}

                    {/* --------------------------------------------- brand */}
                    <div className="min-w-0 text-center lg:px-10 lg:max-w-md">
                        {brand?.logo?.url && (
                            /*
                             * `brightness-0 invert` paints the mark white.
                             * The CMS holds one logo, drawn in the navy, and it
                             * is the same asset the header uses on white — on
                             * this background it was navy on navy and all but
                             * invisible. Filtering rather than asking for a
                             * second upload keeps it to one asset to maintain,
                             * and works because the mark is a single flat
                             * colour on transparency.
                             */
                            <span className="mx-auto block h-16 w-auto max-w-[15rem]">
                                <CmsMediaFrame
                                    media={brand.logo}
                                    /*
                                     * `transparent` is load-bearing. The frame
                                     * paints a light plate behind any media set
                                     * to `contain`, so that padding does not
                                     * show the page through — and the filter
                                     * below whitened THAT, turning the mark
                                     * into a solid white rectangle. The logo
                                     * carries its own alpha, so it needs no
                                     * plate here. (This used to be an
                                     * `!bg-transparent` override on the class;
                                     * the prop says the same thing in the one
                                     * place the plate is decided.)
                                     */
                                    transparent
                                    className="object-contain brightness-0 invert"
                                />
                            </span>
                        )}

                        {brand?.tagline && (
                            <p className="mt-5 text-[1.125rem] font-semibold tracking-wide text-white/90">
                                {brand.tagline}
                            </p>
                        )}

                        {brand?.fullName && (
                            <p className="mt-5 text-[1.125rem] leading-relaxed font-medium text-white/65">
                                {brand.fullName}
                            </p>
                        )}

                        {columnFields('footer.brand')}
                    </div>

                    {/* ------------------------------------------- address */}
                    {addressLines.length > 0 ? (
                        <div className="min-w-0 lg:justify-self-end lg:text-left">
                            <ColumnHeading>Address</ColumnHeading>
                            <div className="flex items-start gap-3.5">
                                <IconPlate><MapPin size={15} /></IconPlate>
                                <address className="not-italic pt-1.5 text-[1.125rem] font-medium
                                                    leading-relaxed text-white/85">
                                    {addressLines.map((line, i) => (
                                        <span key={i} className="block">{line}</span>
                                    ))}
                                </address>
                            </div>

                            {columnFields('footer.address')}
                        </div>
                    ) : <div />}
                </div>

                {/* ----------------------------------------- navigation rule */}
                {navLinks.length > 0 && (
                    <nav className="mt-12 border-t border-white/15 pt-6">
                        <ul className="flex flex-wrap items-center justify-center gap-y-3">
                            {navLinks.map((item, i) => (
                                <li key={i} className="flex items-center">
                                    {renderLink(
                                        item.label,
                                        item.href,
                                        'px-5 py-2.5 text-[1.125rem] font-medium text-white/80 '
                                        + 'hover:text-white transition-colors',
                                        `nav-${i}`,
                                    )}
                                    {/*
                                      Separators between, never after the last —
                                      and never on a phone at all. The row wraps
                                      to two lines there, and a rule drawn
                                      between items in DOM order then dangles off
                                      the end of the first line with nothing
                                      after it. The links carry their own padding,
                                      so spacing alone reads fine at that size.
                                    */}
                                    {i < navLinks.length - 1 && (
                                        <span aria-hidden="true" className="hidden sm:block h-4 w-px bg-white/25" />
                                    )}
                                </li>
                            ))}
                        </ul>
                    </nav>
                )}

                {/* The navigation card's own rows, under the row it is about. */}
                {columnFields('footer.linkColumns')}

                {/*
                  * ------------------------------------------------------------
                  * THE REGIONS, AS A SECOND ROW
                  * ------------------------------------------------------------
                  *
                  * A reader at the very bottom of a page should be able to reach
                  * the national council and the five regions without scrolling
                  * back up to the header menu — and the footer is where people
                  * look for a site map.
                  *
                  * NOT TYPED INTO THE CMS. These come from `/cms/regions/map`,
                  * the same call the header menu and the Across India band read,
                  * so publishing a region page puts it in the footer with no
                  * second thing to remember — and a region with no page is left
                  * out rather than linked to a 404.
                  *
                  * The STATES are deliberately not here. Thirty-six more links
                  * in a footer is a site map nobody reads; the band directly
                  * above this one opens them a click away.
                  */}
                {regionLinks.length > 0 && (
                    <nav
                        aria-label="Zones"
                        className={navLinks.length > 0
                            ? 'mt-1'
                            : 'mt-12 border-t border-white/15 pt-6'}
                    >
                        <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
                            {regionLinks.map((item) => (
                                <li key={item.href}>
                                    {renderLink(
                                        item.label,
                                        item.href,
                                        'text-[1.0625rem] font-semibold text-white/55 '
                                        + 'hover:text-white transition-colors',
                                        `region-${item.href}`,
                                    )}
                                </li>
                            ))}
                        </ul>
                    </nav>
                )}

                {/* The bottom bar's own rows, with the bottom bar. */}
                {columnFields('footer.bottomBar')}

                {/*
                  * THE SITE'S OWN ROWS — and only the site's.
                  *
                  * Every column's rows were pooled into this one strip, so a
                  * field added to Contact and one added to Brand landed in the
                  * same place and neither sat with the thing it was about. Each
                  * column draws its own now; what is left here is the list
                  * attached to the SITE, which is not a column and belongs
                  * across the foot of all of them.
                  */}
                {ownRows.length > 0 && (
                    <div className="mt-8 border-t border-white/10 pt-6
                                    text-[1.125rem] font-medium leading-relaxed">
                        <CmsExtraFields fields={ownRows} tone="dark" />
                    </div>
                )}

                {hasBottomBar && (
                    <div className="mt-6 border-t border-white/10 pt-5 flex flex-col md:flex-row
                                    md:justify-between md:items-center gap-3 text-[1.0625rem] text-white/55">
                        {copyright && <p className="text-center md:text-left">{copyright}</p>}

                        {(legalLinks.length > 0 || note) && (
                            <div className="flex flex-wrap justify-center md:justify-end gap-x-6 gap-y-2">
                                {legalLinks.map((item, i) =>
                                    renderLink(
                                        item.label,
                                        item.href,
                                        'hover:text-white transition-colors',
                                        `legal-${i}`,
                                    ),
                                )}
                                {note && <span>{note}</span>}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </footer>
    );
}

/**
 * One heading treatment for both outer columns — small, heavy, wide-tracked,
 * over a short accent rule. The rule is what stops an 11px label from
 * disappearing into a large field of navy.
 */
function ColumnHeading({ children }: { children: React.ReactNode }) {
    return (
        <h4 className="text-[1.0625rem] sm:text-[0.8125rem] font-extrabold uppercase tracking-[0.16em]
                       text-white mb-5">
            {children}
            <span className="mt-2.5 block h-0.5 w-9 rounded-full bg-white/40" />
        </h4>
    );
}

/** The circular plate behind a contact or address icon. */
function IconPlate({ children }: { children: React.ReactNode }) {
    return (
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full
                         bg-white/10 ring-1 ring-white/15 text-white">
            {children}
        </span>
    );
}
