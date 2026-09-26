/**
 * The page's SHARE TAGS — title, description and image a link preview uses.
 *
 * This is the browser half. Facebook, WhatsApp and LinkedIn do NOT run this
 * code: their crawlers read the HTML the server sends, which `server.mjs`
 * fills with the same tags for `/events/<slug>`. Setting them here as well
 * keeps the open tab honest (its title, and preview extensions that read the
 * live page) and matches what the crawlers are told.
 *
 * Returns a function that puts the previous values back, for the effect's
 * cleanup, so leaving the event page does not leave its poster on the next.
 */
export interface ShareMeta {
    title: string;
    description?: string;
    image?: string;
    url?: string;
    type?: string;
}

const upsert = (attr: 'property' | 'name', key: string, value: string): (() => void) => {
    let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
    const created = !el;
    const before = el?.getAttribute('content') ?? '';
    if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
    }
    el.setAttribute('content', value);
    return () => {
        if (!el) return;
        if (created) el.remove();
        else el.setAttribute('content', before);
    };
};

export const setShareMeta = (meta: ShareMeta): (() => void) => {
    try {
        const title = (meta.title || '').trim();
        const description = (meta.description || '').replace(/\s+/g, ' ').trim().slice(0, 200);
        const previousTitle = document.title;
        if (title) document.title = title;

        const rows: Array<['property' | 'name', string, string]> = [
            ['property', 'og:type', meta.type || 'website'],
            ['property', 'og:site_name', 'ACTIV'],
            ['property', 'og:title', title],
            ['property', 'og:description', description],
            ['property', 'og:image', meta.image || ''],
            ['property', 'og:url', meta.url || window.location.href],
            ['name', 'twitter:card', meta.image ? 'summary_large_image' : 'summary'],
            ['name', 'twitter:title', title],
            ['name', 'twitter:description', description],
            ['name', 'twitter:image', meta.image || ''],
            ['name', 'description', description],
        ];
        const undo = rows.filter(([, , v]) => v).map(([a, k, v]) => upsert(a, k, v));
        return () => {
            undo.forEach((fn) => fn());
            document.title = previousTitle;
        };
    } catch {
        return () => undefined;
    }
};
