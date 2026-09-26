/**
 * The website's production server: the built SPA, plus LINK PREVIEWS.
 *
 * WHY THIS EXISTS. Facebook, WhatsApp, LinkedIn, X and Telegram never run the
 * site's JavaScript. They fetch the URL, read the <meta property="og:*"> tags
 * in the HTML that comes back, and build the card from those. A static host
 * sends every URL the same index.html, so every event shared anywhere
 * previewed as "Actv Portal - Member & Admin Management" with no image.
 *
 * So for `/events/<slug>` (and `/events/<slug>/book`) this reads the event
 * from the API and writes ITS title, description and poster into the page
 * before sending it. People get the same SPA as before; crawlers get a card
 * with the event's banner. Everything else is served untouched.
 *
 * No dependencies — Node's own http/fs — so it adds nothing to install.
 *
 *   npm run build && npm start          (PORT, default 8080)
 *
 * Environment:
 *   API_URL / VITE_API_URL   the API base, e.g. https://api.example.com/api/v1
 *   SITE_URL                 the public origin, for og:url (default: request host)
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const PORT = Number(process.env.PORT || 8080);
const API = String(process.env.API_URL || process.env.VITE_API_URL || '').replace(/\/+$/, '');
const API_ORIGIN = API.replace(/\/api\/v\d+$/, '');
const SITE_URL = String(process.env.SITE_URL || '').replace(/\/+$/, '');
const SITE_NAME = 'ACTIV - Adidravidar Confederation of Trade & Industrial Vision';

const TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
    '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
    '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain',
    '.xml': 'application/xml', '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.webmanifest': 'application/manifest+json'
};

let indexHtml = '';
const index = () => {
    if (!indexHtml) indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    return indexHtml;
};

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const absolute = (url) => {
    const u = String(url || '').trim();
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    return API_ORIGIN ? `${API_ORIGIN}${u.startsWith('/') ? '' : '/'}${u}` : '';
};

/** "Sunday, 27 September 2026 · 3:00 pm IST · Online on Zoom" */
const whenWhere = (e) => {
    const parts = [];
    const d = e.startAt ? new Date(e.startAt) : null;
    if (d && !Number.isNaN(d.getTime())) {
        parts.push(d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
        parts.push(`${d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })} IST`);
    }
    if (e.mode === 'online') parts.push(`Online${e.onlinePlatform ? ` on ${e.onlinePlatform}` : ''}`);
    else if (e.location) parts.push(e.location);
    return parts.join(' · ');
};

/**
 * One public CMS record — `events` or `gallery` — by slug or id. Up to 120,
 * cached 60 s: a post going viral must not hammer the API.
 */
const cache = new Map();
const fetchPublic = async(kind, slug) => {
    if (!API) return null;
    const key = `${kind}:${slug}`;
    const hit = cache.get(key);
    if (hit && hit.at > Date.now() - 60_000) return hit.record;
    try {
        const res = await fetch(`${API}/cms/${kind}/${encodeURIComponent(slug)}`, { signal: AbortSignal.timeout(4000) });
        const body = res.ok ? await res.json() : null;
        const record = body && (body.data || body);
        const found = record && (record.id || record._id) ? record : null;
        if (cache.size > 120) cache.delete(cache.keys().next().value);
        cache.set(key, { at: Date.now(), record: found });
        return found;
    } catch {
        return null;
    }
};
const fetchEvent = (slug) => fetchPublic('events', slug);

/** index.html with this event's title, description and poster in its <head>. */
const eventPage = (event, pageUrl) => {
    const title = event.title || 'ACTIV event';
    const summary = String(event.description || '').replace(/\s+/g, ' ').trim();
    const line = whenWhere(event);
    const description = [line, summary].filter(Boolean).join(' — ').slice(0, 300);
    const image = absolute(event.imageUrl || (event.media && event.media.url));
    const tags = [
        ['property', 'og:type', 'article'],
        ['property', 'og:site_name', SITE_NAME],
        ['property', 'og:title', title],
        ['property', 'og:description', description],
        ['property', 'og:url', pageUrl],
        ['property', 'og:image', image],
        ['property', 'og:image:secure_url', image.startsWith('https://') ? image : ''],
        ['property', 'og:image:alt', title],
        ['name', 'twitter:card', image ? 'summary_large_image' : 'summary'],
        ['name', 'twitter:title', title],
        ['name', 'twitter:description', description],
        ['name', 'twitter:image', image],
        ['name', 'description', description]
    ].filter(([, , v]) => v)
        .map(([a, k, v]) => `<meta ${a}="${k}" content="${esc(v)}" />`).join('\n    ');

    return index()
        .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)} | ACTIV</title>`)
        .replace(/<meta\s+name="description"[^>]*>/i, '')
        .replace(/<meta\s+(property|name)="(og|twitter):[^"]*"[^>]*>/gi, '')
        .replace('</head>', `    <link rel="canonical" href="${esc(pageUrl)}" />\n    ${tags}\n  </head>`);
};

const send = (res, status, body, type, cacheControl = 'no-cache') => {
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': cacheControl });
    res.end(body);
};

const server = http.createServer(async(req, res) => {
    try {
        const url = new URL(req.url || '/', 'http://local');
        const pathname = decodeURIComponent(url.pathname);

        // A real file in dist: assets, images, robots.txt …
        const file = path.normalize(path.join(ROOT, pathname));
        if (file.startsWith(ROOT) && pathname !== '/' && fs.existsSync(file) && fs.statSync(file).isFile()) {
            const hashed = pathname.startsWith('/assets/');
            res.writeHead(200, {
                'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
                'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'public, max-age=3600'
            });
            fs.createReadStream(file).pipe(res);
            return;
        }

        // An event page: fill in its share tags.
        const match = pathname.match(/^\/(?:member\/)?events\/([^/]+)(?:\/book)?\/?$/);
        if (match && req.method === 'GET') {
            const event = await fetchEvent(match[1]);
            if (event) {
                const origin = SITE_URL || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
                const pageUrl = `${origin}/events/${encodeURIComponent(event.slug || event.id)}`;
                send(res, 200, eventPage(event, pageUrl), TYPES['.html']);
                return;
            }
        }

        // A gallery item (and any photo in it): its title, caption and cover.
        const gallery = pathname.match(/^\/gallery\/([^/]+)(?:\/photo\/\d+)?\/?$/);
        if (gallery && req.method === 'GET') {
            const item = await fetchPublic('gallery', gallery[1]);
            if (item) {
                const origin = SITE_URL || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
                const pageUrl = `${origin}/gallery/${encodeURIComponent(item.slug || item._id)}`;
                send(res, 200, eventPage({
                    title: item.title || 'ACTIV gallery',
                    description: item.caption || '',
                    imageUrl: (item.media && item.media.url) || ''
                }, pageUrl), TYPES['.html']);
                return;
            }
        }

        // Every other route belongs to the SPA.
        send(res, 200, index(), TYPES['.html']);
    } catch (error) {
        console.error('server error', error);
        send(res, 500, 'Server error', 'text/plain');
    }
});

server.listen(PORT, () => {
    console.log(`ACTIV website on :${PORT}${API ? ` (event previews from ${API})` : ' (API_URL unset: no event previews)'}`);
});
