// Shared by Vite in local development and the production Node server. Social
// crawlers read this HTML without running React.
const fixed = new Set(['/', '/onboarding', '/about', '/membership', '/events', '/gallery', '/news', '/schemes', '/schemes/central', '/schemes/state', '/contact', '/donate', '/login', '/register', '/forgot-password', '/privacy-policy', '/terms-and-conditions', '/refund-policy', '/cancellation-policy']);
const feed = 'about|leaders|keyAchievements|sectorUpdates|newsUpdates|speakInMedia|achievements|events|projects|policyAdvocacy|consultingServices|publications|mediaReleases|mediaCoverages|gallery|section-[^/]+';
const dynamic = new RegExp(`^/(?:(?:events/[^/]+(?:/book)?)|(?:gallery/[^/]+(?:/photo/\\d+)?)|(?:news/[^/]+)|(?:schemes/(?:view|state)/[^/]+)|(?:(?:states|regions)/[^/]+(?:/(?:${feed}))?)|(?:legal/[^/]+))$`);

export const isPublicPreviewPath = raw => {
    if (typeof raw !== 'string' || raw.length > 400 || /[\\<>\x00-\x20]/.test(raw) || raw.includes('//') || raw.split('/').some(part => ['.', '..', '__proto__', 'constructor', 'prototype'].includes(part))) return false;
    const path = raw.replace(/\/+$/, '') || '/';
    return fixed.has(path) || dynamic.test(path) || /^\/network\/company\/[a-f0-9]{24}$/i.test(path);
};

export const fetchPagePreview = async(api, route) => {
    if (!api || !isPublicPreviewPath(route)) return null;
    try {
        const company = route.match(/^\/network\/company\/([a-f0-9]{24})\/?$/i);
        const endpoint = company ? `/share/companies/${company[1]}` : `/share/page?path=${encodeURIComponent(route)}`;
        const response = await fetch(`${api.replace(/\/+$/, '')}${endpoint}`, { signal: AbortSignal.timeout(4500) });
        if (!response.ok || !/text\/html/i.test(response.headers.get('content-type') || '')) return null;
        const html = await response.text();
        return html.length < 100000 && /property="og:title"/.test(html) ? html : null;
    } catch { return null; }
};

export const mergePagePreview = (shell, preview, origin = '') => {
    try {
        const parsed = new URL(origin);
        origin = /^https?:$/.test(parsed.protocol) ? parsed.origin : '';
    } catch { origin = ''; }
    const head = preview.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '';
    const tags = head.match(/<(?:title|meta|link)\b[^>]*(?:>[\s\S]*?<\/title>|>)/gi) || [];
    const metadata = tags.filter(tag => /<title|(?:og:|twitter:|fb:app_id)|name="description"|rel="canonical"/i.test(tag)).map(tag => {
        if (!origin || !/(?:og:url|twitter:url|rel="canonical")/.test(tag)) return tag;
        return tag.replace(/(content|href)="([^"]+)"/, (match, attr, url) => {
            try { return `${attr}="${origin}${new URL(url.replace(/&amp;/g, '&')).pathname}"`; } catch { return match; }
        });
    });
    return shell
        .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
        .replace(/<meta\b[^>]*(?:property|name)=["'](?:og:|twitter:|fb:)[^"']*["'][^>]*>/gi, '')
        .replace(/<meta\b[^>]*name=["']description["'][^>]*>/gi, '')
        .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, '')
        .replace(/<\/head>/i, `${metadata.join('\n')}\n</head>`);
};
