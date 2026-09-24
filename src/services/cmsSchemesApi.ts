import api, { unwrap } from './api';
import { cached, invalidateCmsCache, type CmsSectionOverride, type CmsExtraField } from './cmsApi';
import type { NewsMedia } from './cmsNewsApi';

/**
 * ============================================================================
 * GOVERNMENT SCHEMES — `/schemes` and the CMS screen behind it
 * ============================================================================
 *
 * The schemes left the newsroom for a page of their own:
 *
 *     /schemes                    Central or State
 *     /schemes/central            every national scheme
 *     /schemes/state              every state, grouped by region
 *     /schemes/state/:slug        that state's schemes, then its districts'
 *     /schemes/view/:slug         one scheme, with the Apply button
 *
 * See `cms.schemes.service.js` for the rules the server applies.
 */

export type SchemeTier = 'national' | 'state' | 'district';

export interface SchemeRecord {
    id: string;
    slug: string;
    title: string;
    /** Two or three lines, printed on the card. */
    summary: string;
    /** The full description on the detail page. Blank lines separate paragraphs. */
    body: string;
    tier: SchemeTier;
    state: string;
    district: string;
    /** The ministry, department or council that runs it. */
    authority: string;
    eligibility: string;
    /** Free text: "Open", "Closes 31 Mar 2026". */
    deadline: string;
    /** "Click to apply" — the official portal. Opens in a new tab. */
    applyUrl: string;
    /** A notification or form to download. */
    documentUrl: string;
    icon: string;
    category: string;
    benefits: string;
    /** One step per line. */
    howToApply: string;
    documentsRequired: string[];
    helpline: string;
    image: NewsMedia;
    featured: boolean;
    extraFields?: CmsExtraField[];
    status: string;
    sortOrder: number;
}

export interface SchemeStateCount {
    state: string;
    stateSchemes: number;
    districtSchemes: number;
    total: number;
}

export interface SchemeSettings {
    badgeIcon: string;
    badgeText: string;
    heading: string;
    headingHighlight: string;
    description: string;
    heroImage: NewsMedia;
    centralLabel: string;
    centralDescription: string;
    stateLabel: string;
    stateDescription: string;
    emptyMessage: string;
    sections: CmsSectionOverride[];
}

const query = (params: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) search.set(k, v); });
    const s = search.toString();
    return s ? `?${s}` : '';
};

/**
 * The same comparison the server makes — case-insensitive, whitespace
 * collapsed — so the page and the API agree about which state a scheme is in.
 */
export const normRegion = (value?: string | null) =>
    String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

/* ------------------------------------------------------------------ public */

export const getSchemes = async (
    filter: { tier?: SchemeTier | ''; state?: string; district?: string } = {},
): Promise<SchemeRecord[]> => cached(
    `schemes:list${query(filter)}`,
    async () => {
        const res = await api.get(`/cms/schemes${query(filter)}`);
        const rows = unwrap<SchemeRecord[]>(res, []);
        return Array.isArray(rows) ? rows : [];
    },
);

export const getSchemeStateCounts = async (): Promise<SchemeStateCount[]> => cached(
    'schemes:states',
    async () => {
        const res = await api.get('/cms/schemes/states');
        const rows = unwrap<SchemeStateCount[]>(res, []);
        return Array.isArray(rows) ? rows : [];
    },
);

export const getScheme = async (slug: string): Promise<SchemeRecord | null> => cached(
    `schemes:one:${slug}`,
    async () => {
        const res = await api.get(`/cms/schemes/${encodeURIComponent(slug)}`);
        return unwrap<SchemeRecord | null>(res, null);
    },
);

export const getSchemeSettings = async (): Promise<SchemeSettings | null> => cached(
    'schemes:settings',
    async () => {
        const res = await api.get('/cms/schemes/settings');
        return unwrap<SchemeSettings | null>(res, null);
    },
);

/* ------------------------------------------------------------------- admin */

export interface SchemesAdminData {
    schemes: SchemeRecord[];
    settings: SchemeSettings;
}

export const listSchemesAdmin = async (): Promise<SchemesAdminData> => {
    const res = await api.get('/cms/schemes-admin');
    return unwrap<SchemesAdminData>(res, {
        schemes: [], settings: null as unknown as SchemeSettings,
    });
};

/* Every write clears the public cache — the CMS and the site share one bundle
   and one cache, so an editor opening /schemes after a save would otherwise be
   handed the copy from before it. */
export const saveSchemeRecord = async (id: string | null, payload: Partial<SchemeRecord>) => {
    const res = id
        ? await api.put(`/cms/schemes-admin/schemes/${id}`, payload)
        : await api.post('/cms/schemes-admin/schemes', payload);
    invalidateCmsCache();
    return unwrap<SchemeRecord>(res, null as unknown as SchemeRecord);
};

export const deleteSchemeRecord = async (id: string) => {
    const res = await api.delete(`/cms/schemes-admin/schemes/${id}`);
    invalidateCmsCache();
    return unwrap(res, { deleted: false });
};

export const saveSchemeSettings = async (payload: Partial<SchemeSettings>) => {
    const res = await api.put('/cms/schemes-admin/settings', payload);
    invalidateCmsCache();
    return unwrap<SchemeSettings>(res, null as unknown as SchemeSettings);
};
