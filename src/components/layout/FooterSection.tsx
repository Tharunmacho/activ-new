import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, Mail } from 'lucide-react';
import { getSiteSettings, type SiteSettings } from '@/services/cmsApi';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import { CmsIcon } from '@/components/shared/CmsIcon';
import { BAR_CONTAINER } from './pageContainer';

/**
 * The public site's footer.
 *
 * Every column, link, phone number and social button is authored in the CMS.
 * Sections with nothing in them are not rendered at all — an empty column would
 * leave a gap in the grid that reads as a layout bug rather than as absent
 * content.
 */
export function FooterSection() {
    const [site, setSite] = useState<SiteSettings | null>(null);

    useEffect(() => {
        let cancelled = false;
        getSiteSettings()
            .then((data) => { if (!cancelled) setSite(data); })
            .catch(() => { if (!cancelled) setSite(null); });
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

    const addressLines = footer?.addressLines || [];
    const phones = footer?.phones || [];

    // Columns are filtered link-by-link, then any column left with nothing is
    // dropped outright — an empty heading would leave a hole in the grid.
    const linkColumns = (footer?.linkColumns || [])
        .map((column) => ({ ...column, links: (column.links || []).filter((l) => isLive(l?.href)) }))
        .filter((column) => column.links.length > 0);

    const socials = (footer?.socials || []).filter((s) => isLive(s?.href));
    const legalLinks = (footer?.legalLinks || []).filter((l) => isLive(l?.href));

    // `{year}` rather than a literal, so the notice never has to be re-edited.
    const copyright = (footer?.copyright || '').replace('{year}', String(new Date().getFullYear()));

    const hasContactColumn = !!(footer?.contactHeading || phones.length || footer?.email || socials.length);
    const hasBottomBar = !!(copyright || legalLinks.length || footer?.note);

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
        <footer className="w-full bg-[#f8fafc] text-gray-700 pt-16 pb-8 border-t border-gray-200 font-sans">
            <div className={BAR_CONTAINER}>
                {/*
                  Brand on the left, the columns to its right, all on one row.

                  A flex row rather than a fixed `grid-cols-4`: the number of
                  columns depends entirely on what the CMS holds, and a fixed
                  four left an empty cell whenever it held three — which is why
                  the whole right-hand third of the footer was blank. Every
                  column takes `flex-1`, the brand takes half again as much, so
                  they fill the width at any count.
                */}
                <div className="flex flex-wrap lg:flex-nowrap items-start
                                gap-x-8 xl:gap-x-14 gap-y-10 border-b border-gray-200 pb-12">

                    {/* ------------------------------------------------ brand */}
                    {(brand?.logo?.url || brand?.fullName || brand?.tagline) && (
                        <div className="w-full lg:w-auto lg:flex-[1.6_1_0%] min-w-0">
                            {/* Sized by the wrapper — see the note in HeaderSection. */}
                            {brand?.logo?.url && (
                                <span className="block h-14 w-auto max-w-[12.5rem]">
                                    <CmsMediaFrame media={brand.logo} className="object-contain object-left" />
                                </span>
                            )}

                            {brand?.fullName && (
                                <p className="font-bold text-[#1c2e68] text-[0.8125rem] uppercase
                                              tracking-[0.06em] leading-[1.45] mt-4 max-w-[22rem]">
                                    {brand.fullName}
                                </p>
                            )}

                            {brand?.tagline && (
                                <p className="text-gray-500 text-sm font-medium mt-2">{brand.tagline}</p>
                            )}
                        </div>
                    )}

                    {/* ---------------------------------------------- address */}
                    {addressLines.length > 0 && (
                        <div className="w-1/2 lg:w-auto lg:flex-1 min-w-0">
                            <ColumnHeading>Address</ColumnHeading>
                            <address className="not-italic text-sm text-gray-500 leading-relaxed">
                                {addressLines.map((line, i) => (
                                    <span key={i} className="block">{line}</span>
                                ))}
                            </address>
                        </div>
                    )}

                    {/* ----------------------------------------- link columns */}
                    {linkColumns.map((column, ci) => (
                        <div key={ci} className="w-1/2 lg:w-auto lg:flex-1 min-w-0">
                            {/*
                              A column the CMS gave no heading still reserves the
                              heading's height. Without this its first link sat
                              on the same line as its neighbours' HEADINGS, one
                              row above their content — which is exactly what put
                              "Home" level with "ADDRESS" and "CONTACT" instead of
                              with the address itself.
                            */}
                            {column.heading
                                ? <ColumnHeading>{column.heading}</ColumnHeading>
                                : <div aria-hidden="true" className="h-4 mb-4" />}

                            <ul className="space-y-3 text-sm font-medium text-[#1c2e68]">
                                {(column.links || []).map((item, li) => (
                                    <li key={li}>
                                        {renderLink(
                                            item.label,
                                            item.href,
                                            'hover:text-[#31417F] transition-colors',
                                            `${ci}-${li}`,
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}

                    {/* --------------------------------------- contact and socials */}
                    {hasContactColumn && (
                        <div className="w-1/2 lg:w-auto lg:flex-1 min-w-0">
                            {footer?.contactHeading && <ColumnHeading>{footer.contactHeading}</ColumnHeading>}

                            <div className="space-y-3 text-sm text-gray-600">
                                {phones.length > 0 && (
                                    <div className="flex items-start gap-3">
                                        <Phone size={17} className="text-gray-400 mt-[3px] shrink-0" />
                                        <div className="space-y-1">
                                            {phones.map((p, i) => (
                                                <a
                                                    key={i}
                                                    href={`tel:${p.replace(/\s+/g, '')}`}
                                                    className="block hover:text-[#31417F] transition-colors"
                                                >
                                                    {p}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {footer?.email && (
                                    <div className="flex items-start gap-3">
                                        <Mail size={17} className="text-gray-400 mt-[3px] shrink-0" />
                                        <a
                                            href={`mailto:${footer.email}`}
                                            className="hover:text-[#31417F] transition-colors break-all"
                                        >
                                            {footer.email}
                                        </a>
                                    </div>
                                )}
                            </div>

                            {socials.length > 0 && (
                                <div className="flex flex-wrap gap-2.5 mt-6">
                                    {socials.map((s, i) => (
                                        <a
                                            key={i}
                                            href={s.href}
                                            target={s.href?.startsWith('http') ? '_blank' : undefined}
                                            rel="noreferrer"
                                            aria-label={s.icon}
                                            /* The mark's navy, not slate-900 — a
                                               near-black circle was one more
                                               colour that answered to nothing. */
                                            className="w-9 h-9 bg-[#1c2e68] rounded-full flex items-center justify-center
                                                       text-white hover:bg-[#31417F] transition-colors"
                                        >
                                            <CmsIcon name={s.icon} size={16} fallback="globe" />
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {hasBottomBar && (
                    <div className="pt-6 flex flex-col md:flex-row md:justify-between md:items-center
                                    gap-3 text-xs text-gray-500">
                        {copyright && <p className="text-center md:text-left">{copyright}</p>}

                        {(legalLinks.length > 0 || footer?.note) && (
                            <div className="flex flex-wrap justify-center md:justify-end gap-x-6 gap-y-2">
                                {legalLinks.map((item, i) =>
                                    renderLink(
                                        item.label,
                                        item.href,
                                        'hover:text-[#1c2e68] transition-colors',
                                        `legal-${i}`,
                                    ),
                                )}
                                {footer?.note && <span>{footer.note}</span>}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </footer>
    );
}

/**
 * One heading treatment for all three columns.
 *
 * They were three different things: the link columns used a bold `<h4>` nested
 * inside an `<li>` (a heading is not a list item), the contact column used the
 * same tag at `text-base`, and the brand column had none at all. Sized and
 * spaced once here, the columns start on the same line.
 */
function ColumnHeading({ children }: { children: React.ReactNode }) {
    return (
        <h4 className="text-[0.6875rem] font-bold uppercase tracking-[0.09em] text-[#1c2e68] mb-4">
            {children}
        </h4>
    );
}
