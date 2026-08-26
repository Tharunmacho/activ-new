import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, Mail } from 'lucide-react';
import { getSiteSettings, type SiteSettings } from '@/services/cmsApi';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import { CmsIcon } from '@/components/shared/CmsIcon';

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
        <footer className="w-full bg-[#f8fafc] text-gray-700 pt-20 pb-10 border-t border-gray-200 font-sans">
            <div className="container mx-auto px-4 md:px-8 max-w-7xl">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-12 border-b border-gray-200 pb-16">

                    {/* Brand and address */}
                    <div className="space-y-6 md:col-span-4">
                        {(brand?.logo?.url || brand?.tagline) && (
                            <div>
                                {brand?.logo?.url && (
                                    <CmsMediaFrame
                                        media={brand.logo}
                                        className="h-16 w-auto max-w-[220px] object-contain mb-3"
                                    />
                                )}
                                {brand?.tagline && (
                                    <p className="text-gray-500 text-sm font-medium">{brand.tagline}</p>
                                )}
                            </div>
                        )}

                        {brand?.fullName && (
                            <h3 className="font-bold text-[#1c2e68] text-sm">{brand.fullName}</h3>
                        )}

                        {addressLines.length > 0 && (
                            <address className="not-italic text-sm text-gray-500 leading-relaxed">
                                {addressLines.map((line, i) => (
                                    <span key={i} className="block">{line}</span>
                                ))}
                            </address>
                        )}
                    </div>

                    {/* Link columns — count follows the CMS, so a third can be added */}
                    {linkColumns.length > 0 && (
                        <div
                            className="md:col-span-4 grid gap-8"
                            style={{ gridTemplateColumns: `repeat(${Math.min(linkColumns.length, 3)}, minmax(0, 1fr))` }}
                        >
                            {linkColumns.map((column, ci) => (
                                <ul key={ci} className="space-y-4 text-sm font-medium text-[#1c2e68]">
                                    {column.heading && (
                                        <li><h4 className="font-bold text-[#1c2e68] mb-4">{column.heading}</h4></li>
                                    )}
                                    {(column.links || []).map((item, li) => (
                                        <li key={li}>
                                            {renderLink(
                                                item.label,
                                                item.href,
                                                'hover:text-[#2563eb] transition-colors',
                                                `${ci}-${li}`,
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            ))}
                        </div>
                    )}

                    {/* Contact and socials */}
                    {hasContactColumn && (
                        <div className="space-y-6 md:col-span-4">
                            {footer?.contactHeading && (
                                <h4 className="font-bold text-[#1c2e68] text-base mb-4">{footer.contactHeading}</h4>
                            )}

                            <div className="space-y-3 text-sm text-gray-600">
                                {phones.length > 0 && (
                                    <div className="flex items-start space-x-3">
                                        <Phone size={18} className="text-gray-400 mt-0.5 shrink-0" />
                                        <div>
                                            {phones.map((p, i) => (
                                                <p key={i}>
                                                    <a href={`tel:${p.replace(/\s+/g, '')}`} className="hover:text-[#2563eb]">{p}</a>
                                                </p>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {footer?.email && (
                                    <div className="flex items-center space-x-3">
                                        <Mail size={18} className="text-gray-400 shrink-0" />
                                        <a href={`mailto:${footer.email}`} className="hover:text-[#2563eb]">{footer.email}</a>
                                    </div>
                                )}
                            </div>

                            {socials.length > 0 && (
                                <div className="flex flex-wrap gap-3 pt-4">
                                    {socials.map((s, i) => (
                                        <a
                                            key={i}
                                            href={s.href}
                                            target={s.href?.startsWith('http') ? '_blank' : undefined}
                                            rel="noreferrer"
                                            aria-label={s.icon}
                                            className="w-9 h-9 bg-[#0f172a] rounded-full flex items-center justify-center
                                                       text-white hover:bg-[#2563eb] transition-colors"
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
                    <div className="pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-400">
                        {copyright && <p className="text-center md:text-left">{copyright}</p>}

                        {(legalLinks.length > 0 || footer?.note) && (
                            <div className="flex flex-wrap justify-center gap-x-8 gap-y-2">
                                {legalLinks.map((item, i) =>
                                    renderLink(item.label, item.href, 'hover:text-[#1c2e68]', `legal-${i}`),
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
