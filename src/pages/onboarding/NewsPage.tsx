import { BAND_MEASURE } from '@/components/layout/typography';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HeaderSection } from '../../components/layout/HeaderSection';
import { FooterSection } from '../../components/layout/FooterSection';
import { NewsGrid } from './components/NewsGrid';
import { CmsExtraFields } from '@/components/shared/CmsExtraFields';
import { sectionHidden, sectionFields } from '@/components/shared/cmsSections';
import { Reveal } from '@/components/shared/Reveal';
import { CmsIcon } from '@/components/shared/CmsIcon';
import { sizedMediaUrl } from '@/config/api.config';
import { AcrossIndia } from '@/components/shared/AcrossIndia';
import {
    getNews, getNewsSettings,
    type NewsArticle, type NewsSettings,
} from '@/services/cmsNewsApi';

/**
 * ============================================================================
 * THE NEWSROOM — `/news`
 * ============================================================================
 *
 * A band, then the articles. The schemes that used to follow them have their
 * own page at /schemes — a scheme does not age like news, and the question a
 * reader brings to one is "which apply to me", not "what is new".
 *
 * ------------------------------------------------------------ the filter
 *
 * `?state=` and `?district=` narrow the list, and they live in the
 * URL rather than in component state so that a link to a state's news is a
 * link somebody can send. It is the same decision the gallery took, for the
 * same reason, and the two pages behave alike because of it.
 *
 * A NATIONAL ARTICLE IS IN EVERY FILTER. The server decides that — see
 * `listNews` — and the page does not second-guess it: a reader filtering to
 * Tamil Nadu has not asked to stop hearing about the association as a whole.
 *
 * ------------------------------------------------------- one load, not two
 *
 * The two calls go together. The band needs the settings and the grid the
 * articles; fetching them in sequence would stack two round trips on a page
 * that is one screen.
 */
export default function NewsPage() {
    const [params, setParams] = useSearchParams();
    const state = params.get('state') || '';
    const district = params.get('district') || '';
    const category = params.get('category') || '';

    const [articles, setArticles] = useState<NewsArticle[] | null>(null);
    const [settings, setSettings] = useState<NewsSettings | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        Promise.all([
            getNews({ state, district, category }),
            getNewsSettings(),
        ])
            .then(([list, config]) => {
                if (cancelled) return;
                setArticles(list);
                setSettings(config);
                setLoading(false);
            })
            /* A failed newsroom is an empty newsroom, not a white screen. The
               header and the footer still render. */
            .catch(() => {
                if (cancelled) return;
                setArticles([]);
                setLoading(false);
            });

        return () => { cancelled = true; };
    }, [state, district, category]);

    /*
     * The chips over the grid.
     *
     * From the SETTINGS where an editor has named them, and otherwise from the
     * categories the articles actually carry — so a newsroom that nobody has
     * configured still filters, and one that has been configured shows the
     * association's own words in the association's own order.
     */
    const categories = useMemo(() => {
        const named = (settings?.categories || []).filter(Boolean);
        if (named.length) return named;
        return [...new Set((articles || []).map((a) => a.category).filter(Boolean))];
    }, [settings, articles]);

    const setFilter = (key: string, value: string) => {
        const next = new URLSearchParams(params);
        if (value) next.set(key, value); else next.delete(key);
        setParams(next);
    };

    const where = [district, state].filter(Boolean).join(', ');
    /* The band is a card on the News settings tab — see `cmsSections`.
       Removing it leaves the articles, which is still a newsroom. The
       ARTICLES are not a card and cannot be removed. */
    const showBand = !sectionHidden(settings?.sections, 'news.header');

    const hero = showBand ? settings?.heroImage?.url : undefined;
    const bandRows = showBand ? sectionFields(settings?.sections, 'news.header') : [];

    return (
        <div className="flex min-h-screen flex-col bg-white font-sans">
            <HeaderSection />

            <main className="flex-grow">
                {/* ------------------------------------------------ the band */}
                {showBand && (
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
                            <div className="absolute inset-0 bg-gradient-to-r from-brand-900
                                            via-brand-900/92 to-brand-900/45" />
                        </>
                    )}

                    <div className="relative z-10 mx-auto w-full max-w-[90rem] px-6 py-14 md:py-20
                                    lg:px-10">
                        <Reveal>
                            <span className="inline-flex items-center gap-2 rounded-full bg-white/15
                                             px-4 py-1.5 ring-1 ring-white/25">
                                <CmsIcon
                                    name={settings?.badgeIcon || 'newspaper'}
                                    size={14}
                                    fallback="newspaper"
                                    className="text-white"
                                />
                                <span className="text-[1rem] font-bold uppercase tracking-[0.16em]
                                                 text-white">
                                    {settings?.badgeText || 'Newsroom'}
                                </span>
                            </span>

                            <h1 className="mt-4 text-[2.1875rem] sm:text-4xl md:text-5xl font-black
                                           leading-[1.06] tracking-tight text-white">
                                {settings?.heading || 'What is happening at'}
                                {settings?.headingHighlight && (
                                    <> <span className="text-brand-300">{settings.headingHighlight}</span></>
                                )}
                            </h1>

                            {settings?.description && (
                                <p className={`mt-4 ${BAND_MEASURE} text-[1.0625rem] sm:text-[1.1875rem]
                                              font-semibold leading-relaxed text-white/80
                                              line-clamp-3`}>
                                    {settings.description}
                                </p>
                            )}

                            {where && (
                                <p className="mt-4 inline-flex items-center gap-2 rounded-lg
                                              bg-white/15 px-3 py-1.5 text-[1rem] font-bold text-white
                                              ring-1 ring-white/20">
                                    Filtered to {where}
                                    <button
                                        type="button"
                                        onClick={() => setParams(new URLSearchParams())}
                                        className="underline underline-offset-2 opacity-80
                                                   transition-opacity hover:opacity-100"
                                    >
                                        clear
                                    </button>
                                </p>
                            )}
                        </Reveal>
                    </div>
                </section>
                )}

                {/* ------------------------------------------- the articles */}
                <section className="w-full py-14 md:py-20">
                    <div className="mx-auto w-full max-w-[90rem] px-6 lg:px-10">
                        {categories.length > 0 && (
                            <div className="mb-8 flex flex-wrap gap-2.5">
                                {/* "All" is a chip and not the absence of one: a row
                                    of chips with none lit reads as a filter that has
                                    failed rather than as no filter. */}
                                <button
                                    type="button"
                                    onClick={() => setFilter('category', '')}
                                    className={`rounded-full px-4 py-2 text-[1.0625rem] font-bold
                                                transition-colors ${!category
                                        ? 'bg-brand-800 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                >
                                    All news
                                </button>
                                {categories.map((name) => (
                                    <button
                                        key={name}
                                        type="button"
                                        onClick={() => setFilter('category', name)}
                                        className={`rounded-full px-4 py-2 text-[1.0625rem] font-bold
                                                    transition-colors ${category === name
                                            ? 'bg-brand-800 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                    >
                                        {name}
                                    </button>
                                ))}
                            </div>
                        )}

                        {loading ? (
                            /* Shaped like what is coming, so the page does not
                               jump when it arrives. */
                            <div className="space-y-8">
                                <div className="h-80 animate-pulse rounded-2xl bg-gray-100" />
                                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="h-80 animate-pulse rounded-2xl bg-gray-100" />
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <NewsGrid articles={articles || []} />
                        )}
                    </div>
                </section>

                {/* The editor's own rows on these two cards. */}
                {bandRows.length > 0 && (
                    <div className="mx-auto w-full max-w-[90rem] px-6 pb-16 lg:px-10
                                    text-[1.125rem] font-medium leading-relaxed text-gray-600">
                        <CmsExtraFields fields={bandRows} force="content" />
                    </div>
                )}

            </main>

            {/* Above the footer, on every content page — see `AcrossIndia`. */}
            <AcrossIndia />

            <FooterSection />
        </div>
    );
}
