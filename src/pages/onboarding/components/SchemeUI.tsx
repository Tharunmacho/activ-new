import { BAND_MEASURE } from '@/components/layout/typography';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, ChevronRight } from 'lucide-react';
import { Reveal } from '@/components/shared/Reveal';
import { CmsIcon } from '@/components/shared/CmsIcon';
import { sizedMediaUrl } from '@/config/api.config';
import { CARD_BODY, META_TEXT } from '@/components/layout/appTypography';
import { SCREEN_CONTAINER } from '@/components/layout/pageContainer';
import type { SchemeRecord, SchemeSettings } from '@/services/cmsSchemesApi';

/**
 * ============================================================================
 * THE PIECES EVERY SCHEMES PAGE SHARES
 * ============================================================================
 *
 * One card, one band, one breadcrumb, one content column. Three routes draw
 * schemes — Central, one state, one scheme — and they read as one section of
 * the site only because they are built from the same parts at the same width.
 */

/**
 * The column every schemes page sits in — THE SITE'S, not one of its own.
 *
 * It was `max-w-[90rem] px-6 lg:px-10`: a 1440px column with a 40px gutter,
 * while the events explorer, the membership pages and the zone pages next
 * door all run in `SCREEN_CONTAINER`. Under a full-bleed header and above a
 * full-bleed footer, that put the scheme's title 230px inboard of the logo
 * directly above it on a 1900px display, and the page read as a narrow strip
 * pasted onto the site — which is the exact failure `pageContainer.ts`
 * already describes twice, arrived at a third time.
 *
 * Re-exported rather than deleted: three scheme routes and a dozen call
 * sites name it, and the name says which pages share the column. What it
 * must never go back to being is a SECOND value.
 */
export const SCHEME_COLUMN = SCREEN_CONTAINER;

/** `https://` added when an editor pasted a bare domain. */
export const externalHref = (url?: string | null) => {
    const raw = String(url || '').trim();
    if (!raw) return '';
    return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
};

/** A URL segment for a state name, the way the region pages build theirs. */
export const slugifyRegion = (value?: string | null) => String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Where a scheme belongs, in words: "Central", "Tamil Nadu", "Coimbatore, Tamil Nadu". */
export const schemeWhere = (scheme: Pick<SchemeRecord, 'tier' | 'state' | 'district'>) => {
    if (scheme.tier === 'national') return 'Central scheme';
    if (scheme.tier === 'district') return [scheme.district, scheme.state].filter(Boolean).join(', ');
    return scheme.state || 'State scheme';
};

/* ------------------------------------------------------------------ band */

/**
 * The band at the top of every schemes page: the page's own title, with the
 * editor's badge above it so the section still announces itself.
 */
export function SchemesBand({ settings, title, highlight, description }: {
    settings: SchemeSettings | null;
    title?: string;
    highlight?: string;
    description?: string;
}) {
    const hero = settings?.heroImage?.url;
    const heading = title ?? settings?.heading ?? 'Government schemes for';
    const accent = title !== undefined ? highlight : (settings?.headingHighlight ?? '');
    const blurb = description ?? settings?.description ?? '';

    return (
        <section className="relative overflow-hidden bg-brand-900">
            {hero && (
                <>
                    <img
                        src={sizedMediaUrl(hero, 1600)}
                        alt=""
                        aria-hidden="true"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-brand-900 via-brand-900/92
                                    to-brand-900/45" />
                </>
            )}

            <div className={`relative z-10 ${SCHEME_COLUMN} py-12 md:py-16`}>
                <Reveal>
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5
                                     ring-1 ring-white/25">
                        <CmsIcon name={settings?.badgeIcon || 'landmark'} size={14} fallback="landmark"
                                 className="text-white" />
                        <span className="text-[1rem] font-bold uppercase tracking-[0.16em] text-white">
                            {settings?.badgeText || 'Schemes'}
                        </span>
                    </span>

                    <h1 className="mt-4 text-[2.1875rem] sm:text-4xl md:text-5xl font-black leading-[1.06]
                                   tracking-tight text-white">
                        {heading}
                        {accent && <> <span className="text-brand-300">{accent}</span></>}
                    </h1>

                    {blurb && (
                        <p className={`mt-4 ${BAND_MEASURE} text-[1.0625rem] sm:text-[1.1875rem] font-semibold
                                      leading-relaxed text-white/80 line-clamp-3`}>
                            {blurb}
                        </p>
                    )}
                </Reveal>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------ breadcrumb */

export function Crumbs({ trail }: { trail: { label: string; to?: string }[] }) {
    return (
        <nav aria-label="Breadcrumb" className={`${SCHEME_COLUMN} pt-8`}>
            <ol className={`flex flex-wrap items-center gap-1.5 ${META_TEXT} text-gray-500`}>
                {trail.map((step, i) => (
                    <li key={`${step.label}-${i}`} className="inline-flex items-center gap-1.5">
                        {i > 0 && <ChevronRight size={14} className="shrink-0 text-gray-300" />}
                        {step.to ? (
                            <Link to={step.to} className="font-semibold text-brand-700 hover:text-brand-900">
                                {step.label}
                            </Link>
                        ) : (
                            <span className="font-semibold text-gray-700">{step.label}</span>
                        )}
                    </li>
                ))}
            </ol>
        </nav>
    );
}

/* ------------------------------------------------------------------ card */

/**
 * One scheme, as a card.
 *
 * TWO ACTIONS, and they are different kinds of thing. "View more" stays on
 * this site and opens the scheme's own page; "Click to apply" LEAVES it, for
 * the official portal, in a new tab. The second is drawn solid because it is
 * the one a reader came for; the first is outlined so the two never read as
 * the same button twice.
 */
export function SchemeCard({ scheme, showWhere = true }: { scheme: SchemeRecord; showWhere?: boolean }) {
    const detail = `/schemes/view/${scheme.slug}`;
    const apply = externalHref(scheme.applyUrl);

    return (
        <article className="group flex h-full flex-col rounded-2xl border border-gray-200/80 bg-white p-6
                            transition-all duration-300 hover:-translate-y-1 hover:border-brand-200
                            hover:shadow-[0_18px_40px_-20px_rgba(28,46,104,0.35)]">
            <div className="flex items-start justify-between gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50
                                 text-brand-600">
                    <CmsIcon name={scheme.icon} size={20} fallback="file-text" />
                </span>
                <div className="flex flex-wrap justify-end gap-1.5">
                    {scheme.category && (
                        <span className="rounded-full bg-brand-50 px-3 py-1 text-[0.9375rem] font-bold
                                         text-brand-700">
                            {scheme.category}
                        </span>
                    )}
                    {scheme.deadline && (
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-[0.9375rem] font-bold
                                         text-amber-700">
                            {scheme.deadline}
                        </span>
                    )}
                </div>
            </div>

            <Link to={detail} className="mt-4 block">
                <h3 className="text-[1.3125rem] font-extrabold leading-snug tracking-tight text-brand-900
                               transition-colors group-hover:text-brand-700 line-clamp-3">
                    {scheme.title || 'Untitled scheme'}
                </h3>
            </Link>

            {(showWhere || scheme.authority) && (
                <p className={`mt-1.5 ${META_TEXT} font-semibold text-brand-500`}>
                    {[showWhere ? schemeWhere(scheme) : '', scheme.authority].filter(Boolean).join(' · ')}
                </p>
            )}

            {scheme.summary && (
                <p className="mt-3 text-[1.0625rem] leading-relaxed text-gray-600 line-clamp-3">
                    {scheme.summary}
                </p>
            )}

            {scheme.eligibility && (
                <p className="mt-4 rounded-lg bg-gray-50 px-3.5 py-2.5 text-[1rem] leading-relaxed text-gray-600
                              line-clamp-3">
                    <span className="font-bold text-gray-700">Who it is for: </span>
                    {scheme.eligibility}
                </p>
            )}

            <div className="mt-auto flex flex-wrap items-center gap-2.5 pt-6">
                <Link
                    to={detail}
                    className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 px-4 py-2
                               text-[1rem] font-bold text-brand-700 transition-colors hover:border-brand-400
                               hover:bg-brand-50"
                >
                    View more <ArrowRight size={15} className="shrink-0" />
                </Link>
                {apply && (
                    <a
                        href={apply}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full bg-brand-800 px-4 py-2
                                   text-[1rem] font-bold text-white transition-colors hover:bg-brand-700"
                    >
                        Click to apply <ArrowUpRight size={15} className="shrink-0" />
                    </a>
                )}
            </div>
        </article>
    );
}

/** A grid of cards, or a sentence saying there is nothing here yet. */
export function SchemeGrid({ schemes, empty, showWhere = true }: {
    schemes: SchemeRecord[];
    empty: string;
    showWhere?: boolean;
}) {
    if (!schemes.length) {
        return (
            <p className={`rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center
                           ${CARD_BODY} text-gray-500`}>
                {empty}
            </p>
        );
    }
    return (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {schemes.map((scheme, i) => (
                <Reveal key={scheme.id || i} delay={Math.min(i, 5) * 60}>
                    <SchemeCard scheme={scheme} showWhere={showWhere} />
                </Reveal>
            ))}
        </div>
    );
}
