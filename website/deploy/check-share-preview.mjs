// Checks the HTML social platforms actually receive, against the current CMS.
// Usage: node deploy/check-share-preview.mjs https://activ.org.in/news
// Omit URLs to check all general pages. API_URL may override the API base.
import { isPublicPreviewPath } from '../share-preview.mjs';

const urls = process.argv.slice(2);
if (!urls.length) urls.push(...['/', '/about', '/membership', '/events', '/gallery', '/news', '/schemes'].map(path => `https://activ.org.in${path}`));
const decode = value => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const metadata = html => Object.fromEntries((html.match(/<meta\b[^>]*>/gi) || []).map(tag => {
    const attrs = Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)].map(match => [match[1].toLowerCase(), decode(match[3])]));
    return [attrs.property || attrs.name || '', attrs.content || ''];
}));
const agents = ['Mozilla/5.0', 'facebookexternalhit/1.1', 'meta-externalfetcher/1.1', 'WhatsApp', 'Twitterbot/1.0', 'LinkedInBot/1.0'];
let failed = false;
for (const input of urls) {
    try {
        const target = new URL(input);
        if (!/^https?:$/.test(target.protocol) || !isPublicPreviewPath(target.pathname)) throw new Error('Provide a public website page URL');
        const configured = process.env.API_URL || (/^(www\.)?activ\.org\.in$/i.test(target.hostname) ? 'https://api.activ.org.in/api/v1' : '');
        if (!configured) throw new Error('Set API_URL for this website');
        const api = configured.replace(/\/+$/, '').replace(/(?:\/api\/v\d+)?$/, '/api/v1');
        const reference = await fetch(`${api}/share/page?path=${encodeURIComponent(target.pathname)}`, { signal: AbortSignal.timeout(15000) });
        if (!reference.ok) throw new Error(`Public preview API returned ${reference.status}`);
        const expected = metadata(await reference.text());
        for (const key of ['og:title', 'og:description', 'og:url', 'og:image']) if (!expected[key]) throw new Error(`API preview missing ${key}`);
        // The website may use its configured public origin, but must retain the
        // API's canonical path (including Home / Schemes aliases).
        expected['og:url'] = target.origin + new URL(expected['og:url']).pathname;
        const checkedImages = new Set();
        for (const agent of agents) {
            const response = await fetch(target, { headers: { 'user-agent': agent }, signal: AbortSignal.timeout(15000) });
            const actual = metadata(await response.text());
            const mismatches = ['og:title', 'og:description', 'og:url', 'og:image'].filter(key => actual[key] !== expected[key]);
            if (!response.ok || mismatches.length) {
                failed = true;
                console.log(`FAIL ${target.pathname} ${agent}: HTTP ${response.status}; mismatched ${mismatches.join(', ')}`);
                continue;
            }
            if (!checkedImages.has(actual['og:image'])) {
                const image = await fetch(actual['og:image'], { signal: AbortSignal.timeout(15000) });
                const bytes = await image.arrayBuffer();
                if (!image.ok || !/^image\//i.test(image.headers.get('content-type') || '') || !bytes.byteLength) throw new Error(`Preview image failed: HTTP ${image.status}`);
                checkedImages.add(actual['og:image']);
            }
            console.log(`PASS ${target.pathname} ${agent}: current title, description, canonical URL and image`);
        }
    } catch (error) {
        failed = true;
        console.log(`FAIL ${input}: ${error.message}`);
    }
}
if (failed) console.log('Website HTML differs from the current public preview. Check frontend deployment, share routing and caches before requesting a social-platform refresh.');
process.exitCode = failed ? 1 : 0;
