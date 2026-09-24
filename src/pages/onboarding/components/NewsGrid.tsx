import { Link } from 'react-router-dom';
import { ArrowUpRight, Calendar, MapPin } from 'lucide-react';
import { Reveal } from '@/components/shared/Reveal';
import { sizedMediaUrl } from '@/config/api.config';
import { CARD_TITLE, CARD_BODY, META_TEXT } from '@/components/layout/appTypography';
import type { NewsArticle } from '@/services/cmsNewsApi';

/**
 * ============================================================================
 * THE NEWSROOM GRID — a lead story, then the rest
 * ============================================================================
 *
 * The shape a newspaper front page has, because it is the shape that answers
 * the reader's first question: which of these is the one I should read. A grid
 * of identical cards answers it with "all of them equally", and a reader then
 * scans twelve headlines at the same weight and picks none.
 *
 * So the first article gets a wide card with a large picture and its
 * standfirst, and everything after it a column card. That is the whole of the
 * hierarchy — no second tier, no "also in the news" — because two levels is
 * what a person can hold and three is a layout.
 *
 * ------------------------------------------------------ what a card can do
 *
 * A card either opens an article on this site or opens somebody else's page,
 * and it says which BEFORE it is clicked: an external card carries the source
 * and an arrow leaving the box. A link that silently leaves the site is the
 * one thing a reader cannot undo with the back button on a phone.
 */

/** Printed under the headline. `displayDate` is the editor's own wording. */
const dateOf = (article: NewsArticle) => {
    if (article.displayDate) return article.displayDate;
    if (!article.publishedAt) return '';
    try {
        return new Date(article.publishedAt).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric',
        });
    } catch {
        return '';
    }
};

/**
 * Where a card goes, and whether it leaves the site. One decision, taken once.
 *
 * A story the editor WROTE UP — a summary or a body — opens its page here,
 * even when it came from a newspaper: that page carries the editor's account
 * and a "Read the full story" button to the original. Only a bare link, with
 * nothing written about it, goes straight to the other site; an article page
 * with nothing on it but a button is a click wasted.
 */
const destinationOf = (article: NewsArticle) => {
    const written = !!(String(article.summary || '').trim() || String(article.body || '').trim());
    return article.externalUrl && !written
        ? { external: true as const, href: article.externalUrl }
        : { external: false as const, href: `/news/${article.slug}` };
};

function CardShell({ article, className = '', children }: {
    article: NewsArticle;
    className?: string;
    children: React.ReactNode;
}) {
    const to = destinationOf(article);
    const shell = 'group flex h-full flex-col overflow-hidden rounded-2xl border '
        + 'border-gray-200/80 bg-white transition-all duration-300 '
        + 'hover:-translate-y-1 hover:border-brand-200 '
        + 'hover:shadow-[0_18px_40px_-20px_rgba(28,46,104,0.35)] '
        + `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${className}`;

    if (to.external) {
        return (
            <a
                href={to.href}
                target="_blank"
                /* `noreferrer` as well as `noopener`: these are somebody else's
                   pages and the association's traffic is not theirs to read. */
                rel="noopener noreferrer"
                className={shell}
            >
                {children}
            </a>
        );
    }
    return <Link to={to.href} className={shell}>{children}</Link>;
}

/** The picture, or the brand block when an editor has not supplied one. */
function Picture({ article, tall = false }: { article: NewsArticle; tall?: boolean }) {
    const ratio = tall ? 'aspect-[16/10] lg:aspect-auto lg:h-full' : 'aspect-[16/10]';

    return (
        <div className={`relative w-full overflow-hidden bg-brand-900/5 ${ratio}`}>
            {article.image?.url ? (
                <img
                    src={sizedMediaUrl(article.image.url, tall ? 1100 : 640)}
                    alt={article.image.alt || article.title || 'News'}
                    loading="lazy"
                    decoding="async"
                    /* `cover` and not `contain`, unlike a portrait: a news
                       photograph is a scene, it is cropped in every newspaper
                       that has ever printed one, and letterboxing a landscape
                       shot into a 16:10 card leaves two grey bars per card
                       down the whole page. */
                    className="h-full w-full object-cover transition-transform duration-500
                               group-hover:scale-[1.03]"
                />
            ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br
                                from-brand-50 to-brand-100">
                    <span className="text-[1.0625rem] font-bold uppercase tracking-[0.18em]
                                     text-brand-300">
                        ACTIV
                    </span>
                </div>
            )}

            {article.category && (
                <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1
                                 text-[0.9375rem] font-bold uppercase tracking-wide text-brand-700
                                 shadow-sm">
                    {article.category}
                </span>
            )}
        </div>
    );
}

/** The line under a headline: date, place, and where the link goes. */
function Meta({ article }: { article: NewsArticle }) {
    const date = dateOf(article);
    const to = destinationOf(article);

    return (
        <div className={`mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-4 ${META_TEXT}
                         text-gray-500`}
        >
            {date && (
                <span className="inline-flex items-center gap-1.5">
                    <Calendar size={14} className="shrink-0 text-brand-500" />
                    {date}
                </span>
            )}
            {article.location && (
                <span className="inline-flex items-center gap-1.5">
                    <MapPin size={14} className="shrink-0 text-brand-500" />
                    {article.location}
                </span>
            )}
            {/* The source, on every card that has one — "via The Hindu" —
                so a reader knows whose reporting this is before clicking. */}
            {article.externalUrl && (
                <span className="inline-flex items-center gap-1 font-semibold text-brand-600">
                    {to.external ? (article.sourceName || 'Read at source') : `via ${article.sourceName || 'the original source'}`}
                    {to.external && <ArrowUpRight size={14} className="shrink-0" />}
                </span>
            )}
        </div>
    );
}

export function NewsGrid({ articles }: { articles: NewsArticle[] }) {
    if (!articles.length) {
        return (
            <div className="rounded-2xl border border-dashed border-gray-300 px-6 py-16 text-center">
                <p className={`${CARD_TITLE} text-gray-400`}>No news yet</p>
                <p className={`mt-2 ${CARD_BODY} text-gray-500`}>
                    Nothing has been posted for this filter. Try another region, or clear it.
                </p>
            </div>
        );
    }

    /*
     * The LEAD is the first article the list hands over, which is the newest —
     * or the one an editor marked featured, since the service sorts those to
     * the front. Not chosen here: a grid that picked its own lead would
     * disagree with the same list drawn anywhere else on the site.
     */
    const [lead, ...rest] = articles;

    return (
        <div className="space-y-8">
            <Reveal>
                <CardShell article={lead} className="lg:flex-row">
                    <div className="lg:w-[58%]">
                        <Picture article={lead} tall />
                    </div>

                    <div className="flex flex-1 flex-col p-6 sm:p-8 lg:p-10">
                        <span className="mb-3 inline-flex w-fit items-center rounded-full bg-brand-50
                                         px-3 py-1 text-[0.9375rem] font-bold uppercase
                                         tracking-[0.14em] text-brand-600">
                            Latest
                        </span>

                        <h3 className="text-[1.75rem] sm:text-[2.125rem] font-black leading-[1.15]
                                       tracking-tight text-brand-900 transition-colors
                                       group-hover:text-brand-700">
                            {lead.title || 'Untitled article'}
                        </h3>

                        {lead.summary && (
                            <p className={`mt-4 ${CARD_BODY} text-gray-600 line-clamp-4`}>
                                {lead.summary}
                            </p>
                        )}

                        <Meta article={lead} />
                    </div>
                </CardShell>
            </Reveal>

            {rest.length > 0 && (
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {rest.map((article, i) => (
                        <Reveal key={article.id || i} delay={Math.min(i, 5) * 60}>
                            <CardShell article={article}>
                                <Picture article={article} />

                                <div className="flex flex-1 flex-col p-5 sm:p-6">
                                    <h3 className="text-[1.3125rem] font-extrabold leading-snug
                                                   tracking-tight text-brand-900 line-clamp-3
                                                   transition-colors group-hover:text-brand-700">
                                        {article.title || 'Untitled article'}
                                    </h3>

                                    {article.summary && (
                                        <p className="mt-2.5 text-[1.0625rem] leading-relaxed
                                                      text-gray-600 line-clamp-3">
                                            {article.summary}
                                        </p>
                                    )}

                                    <Meta article={article} />
                                </div>
                            </CardShell>
                        </Reveal>
                    ))}
                </div>
            )}
        </div>
    );
}

export default NewsGrid;
