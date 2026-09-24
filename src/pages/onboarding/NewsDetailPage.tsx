import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Calendar, MapPin, Newspaper, Share2 } from 'lucide-react';
import { HeaderSection } from '../../components/layout/HeaderSection';
import { FooterSection } from '../../components/layout/FooterSection';
import { CmsExtraFields } from '@/components/shared/CmsExtraFields';
import { Reveal } from '@/components/shared/Reveal';
import { sizedMediaUrl } from '@/config/api.config';
import { CARD_BODY, META_TEXT } from '@/components/layout/appTypography';
import { getArticle, type NewsArticle } from '@/services/cmsNewsApi';

/**
 * ============================================================================
 * ONE ARTICLE — `/news/:slug`
 * ============================================================================
 *
 * A single column of text at a readable measure, under a full-width
 * photograph. Everything else on this page is furniture around that column,
 * which is what a news page is.
 *
 * ------------------------------------------------------------- the measure
 *
 * `max-w-3xl` on the body and nothing wider. The rest of the site runs to
 * 90rem, and a paragraph set that wide is a paragraph a reader loses their
 * place in — a line they have to track back across the whole screen to find
 * the start of. The picture and the heading keep the full width; the prose
 * does not.
 *
 * ------------------------------------------------- an article that is a link
 *
 * An article with an `externalUrl` has no page here at all — the card opened
 * somebody else's site. Reaching this URL for one means a link was shared
 * before the editor added the URL, or somebody typed the slug, so the page
 * says where it went and offers the link rather than rendering a blank
 * article.
 */

const PARAGRAPH = 'text-[1.1875rem] sm:text-[1.25rem] leading-[1.75] text-gray-700';

/** The body, as paragraphs. Blank lines are the editor's own breaks. */
function Body({ text }: { text: string }) {
    const paragraphs = String(text || '')
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean);

    if (!paragraphs.length) return null;

    return (
        <div className="space-y-5">
            {paragraphs.map((p, i) => (
                /* `whitespace-pre-line`: a single newline inside a paragraph is
                   a line break the editor typed — an address, a list of names —
                   and collapsing it would run them together. */
                <p key={i} className={`${PARAGRAPH} whitespace-pre-line`}>{p}</p>
            ))}
        </div>
    );
}

export default function NewsDetailPage() {
    const { slug } = useParams();
    const [article, setArticle] = useState<NewsArticle | null>(null);
    const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

    useEffect(() => {
        let cancelled = false;
        setState('loading');

        getArticle(String(slug || ''))
            .then((row) => {
                if (cancelled) return;
                if (!row) { setState('missing'); return; }
                setArticle(row);
                setState('ready');
                window.scrollTo({ top: 0 });
            })
            .catch(() => { if (!cancelled) setState('missing'); });

        return () => { cancelled = true; };
    }, [slug]);

    const share = () => {
        const url = window.location.href;
        try {
            if (navigator.share) { navigator.share({ title: article?.title, url }); return; }
            navigator.clipboard?.writeText(url);
        } catch {
            /* No share sheet and no clipboard: the URL is in the address bar,
               which is where it was before this button existed. */
        }
    };

    const date = article?.displayDate || (article?.publishedAt
        ? new Date(article.publishedAt).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'long', year: 'numeric',
        })
        : '');

    /* A pasted link without a scheme ("thehindu.com/…") would resolve
       relative to this site; the host is printed under the button. */
    const sourceHref = article?.externalUrl
        ? (/^https?:\/\//i.test(article.externalUrl) ? article.externalUrl : `https://${article.externalUrl}`)
        : '';
    const sourceHost = (() => {
        try { return sourceHref ? new URL(sourceHref).hostname.replace(/^www\./, '') : ''; } catch { return ''; }
    })();

    return (
        <div className="flex min-h-screen flex-col bg-white font-sans">
            <HeaderSection />

            <main className="flex-grow">
                <div className="mx-auto w-full max-w-[90rem] px-6 py-8 lg:px-10">
                    <Link
                        to="/news"
                        className="inline-flex items-center gap-2 rounded-full border border-gray-200
                                   bg-white px-4 py-2 text-[1.0625rem] font-bold text-brand-700
                                   transition-colors hover:border-brand-200 hover:bg-brand-50"
                    >
                        <ArrowLeft size={15} /> All news
                    </Link>
                </div>

                {state === 'loading' && (
                    <div className="mx-auto w-full max-w-[90rem] px-6 pb-20 lg:px-10">
                        <div className="h-[22rem] animate-pulse rounded-2xl bg-gray-100 lg:w-2/3" />
                        <div className="mt-8 space-y-4 lg:w-2/3">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="h-5 animate-pulse rounded bg-gray-100" />
                            ))}
                        </div>
                    </div>
                )}

                {state === 'missing' && (
                    <div className="mx-auto w-full max-w-3xl px-6 pb-24 text-center lg:px-10">
                        <h1 className="text-[2.1875rem] font-black tracking-tight text-brand-900">
                            That article is not here
                        </h1>
                        <p className={`mt-3 ${CARD_BODY} text-gray-500`}>
                            It may have been unpublished, or the link may be for an article that
                            lives on another site.
                        </p>
                        <Link
                            to="/news"
                            className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand-800
                                       px-5 py-2.5 text-[1.0625rem] font-bold text-white
                                       transition-colors hover:bg-brand-700"
                        >
                            Back to the newsroom
                        </Link>
                    </div>
                )}

                {state === 'ready' && article && (
                    /*
                      * ONE GRID, ONE LEFT EDGE.
                      *
                      * This page drew a full-width photograph, then centred a
                      * narrower text column under it, so the headline started
                      * ~300px to the right of the picture above it and of the
                      * "All news" button above that — three left edges on one
                      * screen. Everything now hangs off the same column: the
                      * headline and the photograph span the story's width, and
                      * the source card sits beside the story, not under it.
                      */
                    <article className="mx-auto w-full max-w-[90rem] px-6 pb-20 lg:px-10">
                        <div className="grid gap-10 lg:grid-cols-12">
                            <div className="lg:col-span-8">
                                <Reveal as="header">
                                    {article.category && (
                                        <span className="inline-flex rounded-full bg-brand-50 px-3 py-1
                                                         text-[0.9375rem] font-bold uppercase
                                                         tracking-[0.14em] text-brand-600">
                                            {article.category}
                                        </span>
                                    )}

                                    <h1 className="mt-3 text-[2rem] sm:text-[2.5rem] lg:text-[2.75rem] font-black
                                                   leading-[1.12] tracking-tight text-brand-900">
                                        {article.title || 'Untitled article'}
                                    </h1>

                                    <div className={`mt-4 flex flex-wrap items-center gap-x-5 gap-y-2
                                                     ${META_TEXT} text-gray-500`}
                                    >
                                        {date && (
                                            <span className="inline-flex items-center gap-1.5">
                                                <Calendar size={15} className="text-brand-500" /> {date}
                                            </span>
                                        )}
                                        {article.location && (
                                            <span className="inline-flex items-center gap-1.5">
                                                <MapPin size={15} className="text-brand-500" />
                                                {article.location}
                                            </span>
                                        )}
                                        {article.externalUrl && (
                                            <span className="inline-flex items-center gap-1.5 font-semibold text-brand-600">
                                                <Newspaper size={15} /> {article.sourceName || 'Original source'}
                                            </span>
                                        )}
                                    </div>
                                </Reveal>

                                {article.image?.url && (
                                    <Reveal>
                                        <div className="mt-8 overflow-hidden rounded-2xl bg-brand-900/5">
                                            <img
                                                src={sizedMediaUrl(article.image.url, 1400)}
                                                alt={article.image.alt || article.title}
                                                className="aspect-[16/9] w-full object-cover"
                                            />
                                        </div>
                                    </Reveal>
                                )}

                                {article.summary && (
                                    <p className="mt-8 border-l-4 border-brand-200 pl-5 text-[1.25rem]
                                                  font-semibold leading-relaxed text-gray-700">
                                        {article.summary}
                                    </p>
                                )}

                                <div className="mt-8">
                                    <Body text={article.body} />
                                </div>

                                {/* The same button as the side card, at the foot of the
                                    story — where a reader who has just finished it is. */}
                                {article.externalUrl && (
                                    <div className="mt-10 flex flex-col items-start gap-4 rounded-2xl border border-gray-200
                                                    bg-gray-50 p-6 sm:flex-row sm:items-center sm:justify-between">
                                        <p className={`${CARD_BODY} text-gray-700`}>
                                            This story was first reported by{' '}
                                            <span className="font-bold">{article.sourceName || 'another publication'}</span>.
                                        </p>
                                        <a
                                            href={sourceHref}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-brand-800 px-5 py-2.5
                                                       text-[1.0625rem] font-bold text-white transition-colors hover:bg-brand-700"
                                        >
                                            Read the full story <ArrowUpRight size={16} />
                                        </a>
                                    </div>
                                )}

                                {/* In the article's own reading type. */}
                                <div className="text-[1.1875rem] leading-[1.8] text-slate-700">
                                    <CmsExtraFields
                                        fields={article.extraFields}
                                        variant="list"
                                        className="mt-10 border-t border-slate-200 pt-8"
                                    />
                                </div>

                                {article.photos?.length > 0 && (
                                    <div className="mt-12 grid gap-5 sm:grid-cols-2">
                                        {article.photos.map((photo, i) => (
                                            <Reveal key={i} delay={Math.min(i, 4) * 60}>
                                                <img
                                                    src={sizedMediaUrl(photo.url, 900)}
                                                    alt={photo.alt || `${article.title} — ${i + 1}`}
                                                    loading="lazy"
                                                    className="aspect-[4/3] w-full rounded-xl object-cover"
                                                />
                                            </Reveal>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* ------------------------------------ side card */}
                            <aside className="lg:col-span-4">
                                <div className="space-y-5 lg:sticky lg:top-28">
                                    {article.externalUrl && (
                                        <div className="rounded-2xl bg-brand-900 p-6 text-white">
                                            <p className="text-[0.9375rem] font-bold uppercase tracking-[0.14em] text-brand-300">
                                                Original source
                                            </p>
                                            <p className="mt-2 text-[1.375rem] font-extrabold leading-snug">
                                                {article.sourceName || 'Read it where it was published'}
                                            </p>
                                            <a
                                                href={sourceHref}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white
                                                           px-5 py-3 text-[1.0625rem] font-bold text-brand-900 transition-colors
                                                           hover:bg-brand-50"
                                            >
                                                Read the full story <ArrowUpRight size={17} />
                                            </a>
                                            <p className="mt-2 text-center text-[0.9375rem] text-white/60">
                                                Opens {sourceHost || 'the original site'} in a new tab
                                            </p>
                                        </div>
                                    )}

                                    <div className="rounded-2xl border border-gray-200 bg-white p-6">
                                        <dl className="space-y-4">
                                            {date && <Fact label="Published" value={date} />}
                                            {article.location && <Fact label="Place" value={article.location} />}
                                            <Fact
                                                label="Region"
                                                value={[article.district, article.state].filter(Boolean).join(', ') || 'National'}
                                            />
                                            {article.category && <Fact label="Category" value={article.category} />}
                                        </dl>
                                        <div className="mt-6 flex gap-3 border-t border-gray-100 pt-5">
                                            <button
                                                type="button"
                                                onClick={share}
                                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border
                                                           border-gray-200 px-4 py-2.5 text-[1.0625rem] font-bold text-brand-700
                                                           transition-colors hover:border-brand-300 hover:bg-brand-50"
                                            >
                                                <Share2 size={16} /> Share
                                            </button>
                                            <Link
                                                to="/news"
                                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border
                                                           border-gray-200 px-4 py-2.5 text-[1.0625rem] font-bold text-brand-700
                                                           transition-colors hover:border-brand-300 hover:bg-brand-50"
                                            >
                                                More news
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </aside>
                        </div>
                    </article>
                )}
            </main>

            <FooterSection />
        </div>
    );
}

function Fact({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt className="text-[0.9375rem] font-bold uppercase tracking-[0.1em] text-gray-400">{label}</dt>
            <dd className="mt-0.5 text-[1.0625rem] font-semibold text-gray-800">{value}</dd>
        </div>
    );
}
