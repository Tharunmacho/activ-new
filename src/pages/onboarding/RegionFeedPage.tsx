import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { HeaderSection } from '@/components/layout/HeaderSection';
import { FooterSection } from '@/components/layout/FooterSection';
import { SCREEN_CONTAINER } from '@/components/layout/pageContainer';
import { SECTION_HEADING, MICRO_LABEL } from '@/components/layout/typography';
import { getRegionFeed, getStateFeed, type FeedPage } from '@/services/cmsRegionsApi';
import { FeedList } from './components/RegionUI';

/**
 * One list in full — what "Read All" opens.
 *
 * =========================================================================
 * THE PAGE THE ASSOCIATION ASKED FOR IN SO MANY WORDS
 * =========================================================================
 *
 * "In the front screen it will show less; if they want more they will go to a
 * particular page." This is that page: the same rows, none of them trimmed
 * away, paged in the server's copy rather than the browser's.
 *
 * `scope` is a prop and not a guess from the URL, because a state and a region
 * can both own a list called `mediaReleases` and reading the wrong one returns
 * somebody else's press releases with no error anywhere.
 */

/** The label a reader sees. The key is what the API knows it by. */
const TITLES: Record<string, string> = {
    sectorUpdates: 'Sector Update',
    newsUpdates: 'News Update',
    mediaReleases: 'Media Releases',
    speakInMedia: 'ACTIV in the Media',
    events: 'Events',
    projects: 'Projects',
    policyAdvocacy: 'Policy Advocacy',
    consultingServices: 'Consulting Services',
    publications: 'Publications',
    mediaCoverages: 'Media Coverages',
};

const PAGE_SIZE = 20;

export default function RegionFeedPage({ scope }: { scope: 'region' | 'state' }) {
    const { slug, type } = useParams<{ slug: string; type: string }>();
    const [params, setParams] = useSearchParams();
    const [data, setData] = useState<FeedPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);

    /* Paging lives in the URL: page three has to be a link somebody can send. */
    const offset = Math.max(0, Number(params.get('offset') || 0));

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setFailed(false);
        window.scrollTo({ top: 0, behavior: 'auto' });

        const fetcher = scope === 'region' ? getRegionFeed : getStateFeed;
        fetcher(String(slug || ''), String(type || ''), { offset, limit: PAGE_SIZE })
            .then((result) => { if (!cancelled) { setData(result); setLoading(false); } })
            .catch(() => { if (!cancelled) { setFailed(true); setLoading(false); } });

        return () => { cancelled = true; };
    }, [scope, slug, type, offset]);

    const backTo = scope === 'region' ? `/regions/${slug}` : `/states/${slug}`;
    const heading = TITLES[String(type || '')] || 'Updates';

    const total = data?.total || 0;
    const shown = data?.items.length || 0;
    const from = total ? offset + 1 : 0;
    const to = offset + shown;

    const goTo = (next: number) => {
        const params2 = new URLSearchParams(params);
        if (next <= 0) params2.delete('offset');
        else params2.set('offset', String(next));
        setParams(params2);
    };

    return (
        <div className="flex flex-col min-h-screen font-sans dot-band">
            <HeaderSection />

            <main className="flex-grow">
                <div className={`${SCREEN_CONTAINER} py-10 md:py-14`}>
                    <Link
                        to={backTo}
                        className="inline-flex items-center gap-2 text-gray-500 hover:text-brand-700
                                   font-bold text-[1rem] uppercase tracking-[0.1em]
                                   transition-colors mb-8"
                    >
                        <ArrowLeft size={15} /> Back
                    </Link>

                    {data?.title && (
                        <p className={`${MICRO_LABEL} text-gray-400 mb-2`}>{data.title}</p>
                    )}
                    <h1 className={`${SECTION_HEADING} text-brand-800 mb-8`}>{heading}</h1>

                    {loading && (
                        <div className="animate-pulse space-y-3">
                            {[0, 1, 2, 3, 4].map((i) => (
                                <div key={i} className="h-24 bg-slate-100 rounded-2xl" />
                            ))}
                        </div>
                    )}

                    {!loading && failed && (
                        <p className="text-[1.25rem] font-semibold text-gray-500">
                            This list could not be loaded.
                        </p>
                    )}

                    {!loading && !failed && (
                        <>
                            <FeedList
                                items={data?.items || []}
                                limit={0}
                                emptyNote="Nothing has been published here yet."
                            />

                            {total > PAGE_SIZE && (
                                <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                                    <p className="text-[1.125rem] font-semibold text-gray-500">
                                        Showing <span className="font-extrabold text-brand-800">{from}–{to}</span>
                                        {' '}of <span className="font-extrabold text-brand-800">{total}</span>
                                    </p>
                                    <div className="flex items-center gap-3">
                                        {/*
                                          * Disabled at the ends rather than
                                          * hidden: a control that vanishes moves
                                          * the other one under the cursor, and
                                          * the reader presses the wrong thing.
                                          */}
                                        <button
                                            type="button"
                                            disabled={offset <= 0}
                                            onClick={() => goTo(Math.max(0, offset - PAGE_SIZE))}
                                            className="inline-flex items-center gap-2 rounded-full border
                                                       border-brand-200 px-5 py-2.5 text-[1rem] font-bold
                                                       uppercase tracking-[0.1em] text-brand-700 transition-colors
                                                       hover:bg-brand-50 disabled:opacity-40
                                                       disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                        >
                                            <ChevronLeft size={15} /> Back
                                        </button>
                                        <button
                                            type="button"
                                            disabled={to >= total}
                                            onClick={() => goTo(offset + PAGE_SIZE)}
                                            className="inline-flex items-center gap-2 rounded-full bg-brand-800
                                                       px-5 py-2.5 text-[1rem] font-bold uppercase
                                                       tracking-[0.1em] text-white transition-colors
                                                       hover:bg-brand-700 disabled:opacity-40
                                                       disabled:cursor-not-allowed disabled:hover:bg-brand-800"
                                        >
                                            Next <ChevronRight size={15} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>

            <FooterSection />
        </div>
    );
}
