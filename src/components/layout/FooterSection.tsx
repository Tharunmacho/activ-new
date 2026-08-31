import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin } from 'lucide-react';
import { getSiteSettings, type SiteSettings } from '@/services/cmsApi';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import { CmsIcon } from '@/components/shared/CmsIcon';
import { FOOTER_CONTAINER } from './pageContainer';

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
    const socials = (footer?.socials || []).filter((s) => isLive(s?.href));
    const legalLinks = (footer?.legalLinks || []).filter((l) => isLive(l?.href));

    /**
     * The navigation rule.
     *
     * Flattened from every authored column rather than taken from the first:
     * the footer's link columns are "the site's own pages" and "News", and only
     * the ones pointing somewhere real belong on a single centred row.
     */
    const navLinks = (footer?.linkColumns || [])
        .flatMap((column) => column?.links || [])
        .filter((link) => isLive(link?.href));

    // `{year}` rather than a literal, so the notice never has to be re-edited.
    const copyright = (footer?.copyright || '').replace('{year}', String(new Date().getFullYear()));

    const hasContact = !!(phones.length || footer?.email || socials.length);
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
        <footer className="relative w-full overflow-hidden bg-brand-900 text-white font-sans">
            {/*
              Depth, not decoration for its own sake: a flat fill this large
              reads as a block of colour dropped under the page. Two very soft
              brand blooms and a hairline of light along the top edge give it a
              surface. `pointer-events-none` throughout — none of it is content.
            */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                <div className="absolute -top-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-brand-700/40 blur-3xl" />
                <div className="absolute -bottom-48 -right-24 h-[32rem] w-[32rem] rounded-full bg-brand-600/25 blur-3xl" />
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            </div>

            <div className={`${FOOTER_CONTAINER} relative z-10 pt-16 pb-8`}>

                <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_auto_1fr] lg:gap-10 lg:items-start">

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
                                                    className="block text-[0.9375rem] font-medium text-white/85
                                                               hover:text-white transition-colors"
                                                >
                                                    {p}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {footer?.email && (
                                    <div className="flex items-start gap-3.5">
                                        <IconPlate><Mail size={15} /></IconPlate>
                                        <a
                                            href={`mailto:${footer.email}`}
                                            className="pt-1.5 text-[0.9375rem] font-medium text-white/85
                                                       hover:text-white transition-colors break-all"
                                        >
                                            {footer.email}
                                        </a>
                                    </div>
                                )}
                            </div>

                            {socials.length > 0 && (
                                <div className="flex flex-wrap gap-2.5 mt-7">
                                    {socials.map((s, i) => (
                                        <a
                                            key={i}
                                            href={s.href}
                                            target={s.href?.startsWith('http') ? '_blank' : undefined}
                                            rel="noreferrer"
                                            aria-label={s.icon}
                                            className="w-10 h-10 rounded-full bg-white/10 ring-1 ring-white/15
                                                       flex items-center justify-center text-white
                                                       hover:bg-white hover:text-brand-800 hover:-translate-y-0.5
                                                       transition-all duration-300"
                                        >
                                            <CmsIcon name={s.icon} size={16} fallback="globe" />
                                        </a>
                                    ))}
                                </div>
                            )}
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
                                     * `!bg-transparent` is load-bearing. The
                                     * frame paints a light backdrop behind any
                                     * media set to `contain`, so that padding
                                     * does not show the page through — and the
                                     * filter below whitened THAT, turning the
                                     * mark into a solid white rectangle. The
                                     * logo carries its own alpha, so it needs
                                     * no backdrop here.
                                     */
                                    className="object-contain brightness-0 invert !bg-transparent"
                                />
                            </span>
                        )}

                        {brand?.tagline && (
                            <p className="mt-5 text-[0.9375rem] font-semibold tracking-wide text-white/90">
                                {brand.tagline}
                            </p>
                        )}

                        {brand?.fullName && (
                            <p className="mt-5 text-[0.9375rem] leading-relaxed font-medium text-white/65">
                                {brand.fullName}
                            </p>
                        )}
                    </div>

                    {/* ------------------------------------------- address */}
                    {addressLines.length > 0 ? (
                        <div className="min-w-0 lg:justify-self-end lg:text-left">
                            <ColumnHeading>Address</ColumnHeading>
                            <div className="flex items-start gap-3.5">
                                <IconPlate><MapPin size={15} /></IconPlate>
                                <address className="not-italic pt-1.5 text-[0.9375rem] font-medium
                                                    leading-relaxed text-white/85">
                                    {addressLines.map((line, i) => (
                                        <span key={i} className="block">{line}</span>
                                    ))}
                                </address>
                            </div>
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
                                        'px-5 text-[0.9375rem] font-medium text-white/80 hover:text-white transition-colors',
                                        `nav-${i}`,
                                    )}
                                    {/* Separators between, never after the last. */}
                                    {i < navLinks.length - 1 && (
                                        <span aria-hidden="true" className="h-4 w-px bg-white/25" />
                                    )}
                                </li>
                            ))}
                        </ul>
                    </nav>
                )}

                {hasBottomBar && (
                    <div className="mt-6 border-t border-white/10 pt-5 flex flex-col md:flex-row
                                    md:justify-between md:items-center gap-3 text-xs text-white/55">
                        {copyright && <p className="text-center md:text-left">{copyright}</p>}

                        {(legalLinks.length > 0 || footer?.note) && (
                            <div className="flex flex-wrap justify-center md:justify-end gap-x-6 gap-y-2">
                                {legalLinks.map((item, i) =>
                                    renderLink(
                                        item.label,
                                        item.href,
                                        'hover:text-white transition-colors',
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
 * One heading treatment for both outer columns — small, heavy, wide-tracked,
 * over a short accent rule. The rule is what stops an 11px label from
 * disappearing into a large field of navy.
 */
function ColumnHeading({ children }: { children: React.ReactNode }) {
    return (
        <h4 className="text-[0.6875rem] font-extrabold uppercase tracking-[0.16em] text-white mb-5">
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
