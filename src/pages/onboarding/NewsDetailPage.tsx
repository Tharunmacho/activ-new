import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Share2 } from 'lucide-react';
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
                        <div className="h-[22rem] animate-pulse rounded-2xl bg-gray-100" />
                        <div className="mx-auto mt-8 max-w-3xl space-y-4">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="h-5 animate-pulse rounded bg-gray-100" />
                            ))}
                        </div>
                    </div>
                )}

                {state === 'missing' && (
                    <div className="mx-auto w-full max-w-3xl px-6 pb-24 text-center lg:px-10">
                        <h1 className="text-3xl font-black tracking-tight text-brand-900">
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
                    <article className="pb-20">
                        <div className="mx-auto w-full max-w-[90rem] px-6 lg:px-10">
                            {article.image?.url && (
                                <Reveal>
                                    <div className="overflow-hidden rounded-2xl bg-brand-900/5">
                                        <img
                                            src={sizedMediaUrl(article.image.url, 1600)}
                                            alt={article.image.alt || article.title}
                                            className="h-auto max-h-[34rem] w-full object-cover"
                                        />
                                    </div>
                                </Reveal>
                            )}

                            <Reveal as="header" className="mx-auto mt-8 max-w-3xl">
                                {article.category && (
                                    <span className="inline-flex rounded-full bg-brand-50 px-3 py-1
                                                     text-[0.9375rem] font-bold uppercase
                                                     tracking-[0.14em] text-brand-600">
                                        {article.category}
                                    </span>
                                )}

                                <h1 className="mt-3 text-[2rem] sm:text-[2.5rem] font-black
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
                                    <button
                                        type="button"
                                        onClick={share}
                                        className="ml-auto inline-flex items-center gap-1.5 font-bold
                                                   text-brand-700 transition-colors
                                                   hover:text-brand-900"
                                    >
                                        <Share2 size={15} /> Share
                                    </button>
                                </div>

                                {article.summary && (
                                    <p className="mt-6 border-l-4 border-brand-200 pl-5 text-[1.25rem]
                                                  font-semibold leading-relaxed text-gray-700">
                                        {article.summary}
                                    </p>
                                )}
                            </Reveal>

                            <div className="mx-auto mt-8 max-w-3xl">
                                <Body text={article.body} />

                                {article.externalUrl && (
                                    <p className={`mt-8 rounded-xl bg-gray-50 px-5 py-4 ${CARD_BODY}
                                                   text-gray-600`}
                                    >
                                        This story was published by{' '}
                                        <span className="font-bold">
                                            {article.sourceName || 'another site'}
                                        </span>.{' '}
                                        <a
                                            href={article.externalUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-bold text-brand-700 underline
                                                       underline-offset-2"
                                        >
                                            Read it there
                                        </a>
                                    </p>
                                )}
                                {/* Under the story and above the photographs:
                                    a labelled list is a footnote to what was
                                    written, not an interruption of it. */}
                                <CmsExtraFields
                                    fields={article.extraFields}
                                    variant="list"
                                    className="mt-10 border-t border-slate-200 pt-8"
                                />
                            </div>

                            {article.photos?.length > 0 && (
                                <div className="mx-auto mt-12 grid max-w-5xl gap-5 sm:grid-cols-2">
                                    {article.photos.map((photo, i) => (
                                        <Reveal key={i} delay={Math.min(i, 4) * 60}>
                                            <img
                                                src={sizedMediaUrl(photo.url, 900)}
                                                alt={photo.alt || `${article.title} — ${i + 1}`}
                                                loading="lazy"
                                                className="h-full w-full rounded-xl object-cover"
                                            />
                                        </Reveal>
                                    ))}
                                </div>
                            )}
                        </div>
                    </article>
                )}
            </main>

            <FooterSection />
        </div>
    );
}
