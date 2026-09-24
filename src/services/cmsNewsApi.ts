import api, { unwrap } from './api';
import { cached, invalidateCmsCache, type CmsSectionOverride, type CmsExtraField } from './cmsApi';

/**
 * ============================================================================
 * THE NEWSROOM — articles, and the schemes under them
 * ============================================================================
 *
 * Two lists, one page. They are separate on the server for the reason given at
 * the head of `newsArticleSchema`: an article ages and a scheme does not, and
 * the question a reader asks of a scheme is not "what is new" but "which of
 * these apply to me".
 */

export interface NewsMedia {
    url: string;
    type: 'image' | 'video';
    alt: string;
    fit: 'cover' | 'contain';
    position: string;
}

export interface NewsArticle {
    id: string;
    /** The URL segment. Derived from the title on the server. */
    slug: string;
    title: string;
    /** The standfirst — printed on the card AND at the top of the article. */
    summary: string;
    body: string;
    image: NewsMedia;
    photos: NewsMedia[];
    /**
     * A link off the site.
     *
     * An article that has one OPENS IT, in a new tab, and has no detail page of
     * its own — see the note on the schema. `sourceName` is printed on the card
     * so the reader knows where they are about to land.
     */
    externalUrl: string;
    sourceName: string;
    /** Free text: "20 Jan 2026". Printed. */
    displayDate: string;
    /** The real date, and what the list is ordered by. `null` leads the list. */
    publishedAt: string | null;
    category: string;
    location: string;
    /** Blank on both means national — news for the whole association. */
    state: string;
    district: string;
    featured: boolean;
    /**
     * Fields the editor named themselves, printed as labelled rows.
     *
     * Optional because rows written before the field existed do not carry
     * it, and every reader has to cope with that rather than assume an
     * array is there.
     */
    extraFields?: CmsExtraField[];
    status: string;
    sortOrder: number;
}

export interface Scheme {
    id: string;
    slug: string;
    title: string;
    summary: string;
    body: string;
    tier: 'national' | 'state' | 'district';
    state: string;
    district: string;
    authority: string;
    eligibility: string;
    /** Free text: "Open", "Closes 31 Mar 2026". */
    deadline: string;
    applyUrl: string;
    documentUrl: string;
    icon: string;
    /**
     * Fields the editor named themselves, printed as labelled rows.
     *
     * Optional because rows written before the field existed do not carry
     * it, and every reader has to cope with that rather than assume an
     * array is there.
     */
    extraFields?: CmsExtraField[];
    status: string;
    sortOrder: number;
}

/** Grouped on the server, because the grouping is the answer. */
export interface SchemeGroups {
    national: Scheme[];
    state: Scheme[];
    district: Scheme[];
}

export interface NewsSettings {
    badgeIcon: string;
    badgeText: string;
    heading: string;
    headingHighlight: string;
    description: string;
    heroImage: NewsMedia;
    categories: string[];
    schemesHeading: string;
    schemesDescription: string;
    /** Cards the editor removed, and the rows they added to each. */
    sections: CmsSectionOverride[];
}

const EMPTY_SCHEMES: SchemeGroups = { national: [], state: [], district: [] };

const query = (params: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) search.set(k, v); });
    const s = search.toString();
    return s ? `?${s}` : '';
};

/* ------------------------------------------------------------------ public */

/**
 * Cached, on the same terms as the region pages: stale-while-revalidate with
 * in-flight de-duplication. The key carries the FILTER, so `/news?state=Kerala`
 * and the unfiltered list are two entries — one slot for both would serve a
 * reader whichever they asked for second.
 */
export const getNews = async (
    filter: { state?: string; district?: string; category?: string } = {},
): Promise<NewsArticle[]> => cached(
    `news:list${query(filter)}`,
    async () => {
        const res = await api.get(`/cms/news${query(filter)}`);
        return unwrap<NewsArticle[]>(res, []);
    },
);

export const getArticle = async (slug: string): Promise<NewsArticle | null> => cached(
    `news:article:${slug}`,
    async () => {
        const res = await api.get(`/cms/news/${encodeURIComponent(slug)}`);
        return unwrap<NewsArticle | null>(res, null);
    },
);

export const getSchemes = async (
    filter: { state?: string; district?: string } = {},
): Promise<SchemeGroups> => cached(
    `news:schemes${query(filter)}`,
    async () => {
        const res = await api.get(`/cms/news/schemes${query(filter)}`);
        return unwrap<SchemeGroups>(res, EMPTY_SCHEMES);
    },
);

export const getNewsSettings = async (): Promise<NewsSettings | null> => cached(
    'news:settings',
    async () => {
        const res = await api.get('/cms/news/settings');
        return unwrap<NewsSettings | null>(res, null);
    },
);

/* ------------------------------------------------------------------- admin */

export interface NewsAdminData {
    news: NewsArticle[];
    schemes: Scheme[];
    settings: NewsSettings;
}

export const listNewsAdmin = async (): Promise<NewsAdminData> => {
    const res = await api.get('/cms/news-admin');
    return unwrap<NewsAdminData>(res, {
        news: [], schemes: [], settings: null as unknown as NewsSettings,
    });
};

/**
 * Every write clears the public cache.
 *
 * The CMS and the public site are ONE bundle sharing ONE cache, so an editor
 * who saves an article and opens the newsroom would otherwise be handed the
 * copy from before the save — the bug the region pages had, and the reason
 * this is here rather than remembered at each call site.
 *
 * All of the newsroom's keys go, not just the one that changed: a filtered
 * list, the schemes and the settings can all be affected by one save, and
 * working out which is more ways to be wrong than clearing four entries costs.
 */
const dropNewsCache = () => {
    invalidateCmsCache();
};

export const saveArticle = async (id: string | null, payload: Partial<NewsArticle>) => {
    const res = id
        ? await api.put(`/cms/news-admin/articles/${id}`, payload)
        : await api.post('/cms/news-admin/articles', payload);
    dropNewsCache();
    return unwrap<NewsArticle>(res, null as unknown as NewsArticle);
};

export const deleteArticle = async (id: string) => {
    const res = await api.delete(`/cms/news-admin/articles/${id}`);
    dropNewsCache();
    return unwrap(res, { deleted: false });
};

export const saveScheme = async (id: string | null, payload: Partial<Scheme>) => {
    const res = id
        ? await api.put(`/cms/news-admin/schemes/${id}`, payload)
        : await api.post('/cms/news-admin/schemes', payload);
    dropNewsCache();
    return unwrap<Scheme>(res, null as unknown as Scheme);
};

export const deleteScheme = async (id: string) => {
    const res = await api.delete(`/cms/news-admin/schemes/${id}`);
    dropNewsCache();
    return unwrap(res, { deleted: false });
};

export const saveNewsSettings = async (payload: Partial<NewsSettings>) => {
    const res = await api.put('/cms/news-admin/settings', payload);
    dropNewsCache();
    return unwrap<NewsSettings>(res, null as unknown as NewsSettings);
};
