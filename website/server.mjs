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
 *   VITE_GA_MEASUREMENT_ID    public Analytics ID; overrides the compiled value
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { brotliCompress, gzip, constants as zlibConstants } from 'node:zlib';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { fetchPagePreview, mergePagePreview, isPublicPreviewPath } from './share-preview.mjs';
import { resolveApiBase } from './api-base.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const PORT = Number(process.env.PORT || 8080);
const builtConfig = (() => {
    try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'site-config.json'), 'utf8')); }
    catch { return {}; }
})();
const API = resolveApiBase(process.env.API_URL || process.env.VITE_API_URL || builtConfig.apiUrl);
const API_ORIGIN = API.replace(/\/api\/v\d+$/, '');
const SITE_URL = String(process.env.SITE_URL || builtConfig.siteUrl || '').replace(/\/+$/, '');
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
    if (!indexHtml) {
        indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
        // Dokploy can supply this after Vite has built the assets. Expose only
        // this validated public ID, before the browser executes its modules.
        // An explicit blank/invalid value disables Analytics; an unset value
        // preserves the build-time fallback used by static hosts and Vite.
        if (process.env.VITE_GA_MEASUREMENT_ID !== undefined) {
            const value = String(process.env.VITE_GA_MEASUREMENT_ID).trim();
            const id = /^G-[A-Z0-9]+$/.test(value) ? value : '';
            indexHtml = indexHtml.replace(/<head\b[^>]*>/i, head =>
                `${head}\n    <meta name="activ-ga-measurement-id" content="${id}" />`);
        }
    }
    return indexHtml;
};

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const absolute = (url) => {
    let u = String(url || '').trim();
    u = u.replace(/^https?:\/\/[^/]+(\/uploads\/.*)$/i, '$1');
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    return API_ORIGIN ? `${API_ORIGIN}${u.startsWith('/') ? '' : '/'}${u}` : '';
};

const previewImage = (raw) => {
    const image = absolute(raw);
    if (!image) return '';
    const url = new URL(image);
    if (/^\/uploads\/.+\.(jpe?g|png|webp)$/i.test(url.pathname) && !url.searchParams.has('w')) {
        url.searchParams.set('w', '1200');
    }
    return url.toString();
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
    const date = event.startAt ? new Date(event.startAt) : null;
    const day = date && !Number.isNaN(date.getTime())
        ? date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' }) : '';
    const venue = event.mode === 'online'
        ? `Online${event.onlinePlatform ? ` (${event.onlinePlatform})` : ''}`
        : (event.venue || event.location || '');
    const title = event.share?.title || [event.title || 'ACTIV event', day && `on ${day}`, venue && `at ${venue}`].filter(Boolean).join(' ');
    const summary = String(event.description || '').replace(/\s+/g, ' ').trim();
    const line = whenWhere(event);
    const description = event.share?.description || [line, summary].filter(Boolean).join(' — ').slice(0, 700);
    const banner = String(event.imageUrl || event.media?.url || '').replace(/^https?:\/\/[^/?#]+(\/uploads\/[^?#]+)(?:[?#].*)?$/i, '$1');
    const image = event.share?.image || (banner && API_ORIGIN
        ? `${API_ORIGIN}/api/v1/share/events/${encodeURIComponent(event.slug || event.id)}/preview/${crypto.createHash('sha256').update(banner).digest('hex').slice(0,20)}.jpg` : '');
    const tags = [
        ['property', 'og:type', 'article'],
        ['property', 'og:site_name', SITE_NAME],
        ['property', 'og:title', title],
        ['property', 'og:description', description],
        ['property', 'og:url', pageUrl],
        ['property', 'og:image', image],
        ['property', 'og:image:secure_url', image.startsWith('https://') ? image : ''],
        ['property', 'og:image:alt', title],
        ['property', 'og:image:type', image ? 'image/jpeg' : ''],
        ['property', 'og:image:width', image ? '1200' : ''],
        ['property', 'og:image:height', image ? '630' : ''],
        ['property', 'fb:app_id', /^\d+$/.test(process.env.META_APP_ID || '') ? process.env.META_APP_ID : '654787660325955'],
        ['name', 'twitter:card', image ? 'summary_large_image' : 'summary'],
        ['name', 'twitter:title', title],
        ['name', 'twitter:description', description],
        ['name', 'twitter:image', image],
        ['name', 'twitter:url', pageUrl],
        ['name', 'description', description]
    ].filter(([, , v]) => v)
        .map(([a, k, v]) => `<meta ${a}="${k}" content="${esc(v)}" />`).join('\n    ');

    return mergePagePreview(index(), `<head>
        <title>${esc(title)} | ACTIV</title>
        <link rel="canonical" href="${esc(pageUrl)}" />
        ${tags}
    </head>`);
};

const brotli = promisify(brotliCompress);
const gzipAsync = promisify(gzip);
const compressible = type => /^(?:text\/|application\/(?:json|javascript|xml)|image\/svg\+xml)/i.test(type);

// Keep the compressed versions between requests. The byte and entry limits also
// bound dynamic share-preview variants, and in-flight work is shared by callers.
const representations = new Map();
const pendingRepresentations = new Map();
let representationBytes = 0;
const MAX_REPRESENTATION_BYTES = 16 * 1024 * 1024;
const MAX_REPRESENTATIONS = 128;

const acceptedEncoding = (header, canCompress) => {
    const weights = new Map();
    for (const part of String(header || '').toLowerCase().split(',')) {
        const [name, ...parameters] = part.trim().split(';');
        if (!name) continue;
        const quality = parameters.find(value => value.trim().startsWith('q='));
        const q = quality ? Number(quality.trim().slice(2)) : 1;
        weights.set(name, Number.isFinite(q) && q >= 0 && q <= 1 ? q : 0);
    }
    if (canCompress) {
        const weight = name => weights.get(name) ?? weights.get('*') ?? 0;
        const br = weight('br'), gz = weight('gzip');
        if ((weights.get('identity') || 0) > Math.max(br, gz)) return 'identity';
        if (br > 0 || gz > 0) return br >= gz ? 'br' : 'gzip';
    }
    const identity = weights.get('identity') ?? (weights.get('*') === 0 ? 0 : 1);
    return identity > 0 ? 'identity' : null;
};

const representation = async (key, encoding, load) => {
    const cacheKey = `${key}:${encoding}`;
    const hit = representations.get(cacheKey);
    if (hit) {
        representations.delete(cacheKey);
        representations.set(cacheKey, hit);
        return hit;
    }
    if (pendingRepresentations.has(cacheKey)) return pendingRepresentations.get(cacheKey);
    const pending = (async () => {
        const original = await load();
        const body = encoding === 'br'
            ? await brotli(original, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 } })
            : encoding === 'gzip' ? await gzipAsync(original, { level: 6 }) : original;
        const result = { body, etag: `"${encoding}-${crypto.createHash('sha256').update(body).digest('hex').slice(0, 32)}"` };
        if (body.length <= MAX_REPRESENTATION_BYTES) {
            while (representations.size >= MAX_REPRESENTATIONS || representationBytes + body.length > MAX_REPRESENTATION_BYTES) {
                const oldest = representations.keys().next().value;
                representationBytes -= representations.get(oldest).body.length;
                representations.delete(oldest);
            }
            representations.set(cacheKey, result);
            representationBytes += body.length;
        }
        return result;
    })();
    pendingRepresentations.set(cacheKey, pending);
    try { return await pending; }
    finally { pendingRepresentations.delete(cacheKey); }
};

const send = async (req, res, status, body, type, cacheControl = 'no-cache', fileKey = '') => {
    const canCompress = compressible(type);
    const encoding = acceptedEncoding(req.headers['accept-encoding'], canCompress);
    const headers = { 'Content-Type': type, 'Cache-Control': cacheControl };
    if (canCompress) headers.Vary = 'Accept-Encoding';
    if (!encoding) {
        res.writeHead(406, { ...headers, 'Content-Length': 0 });
        res.end();
        return;
    }
    const original = typeof body === 'function' ? null : Buffer.from(body);
    const key = fileKey || crypto.createHash('sha256').update(original).digest('hex');
    const encoded = await representation(key, encoding, typeof body === 'function' ? body : () => original);
    if (encoding !== 'identity') headers['Content-Encoding'] = encoding;
    headers.ETag = encoded.etag;
    const matches = String(req.headers['if-none-match'] || '').split(',')
        .some(value => value.trim() === '*' || value.trim().replace(/^W\//, '') === encoded.etag);
    if (status === 200 && ['GET', 'HEAD'].includes(req.method) && matches) {
        res.writeHead(304, headers);
        res.end();
        return;
    }
    headers['Content-Length'] = encoded.body.length;
    res.writeHead(status, headers);
    res.end(req.method === 'HEAD' ? undefined : encoded.body);
};

const server = http.createServer(async(req, res) => {
    try {
        const url = new URL(req.url || '/', 'http://local');
        const pathname = decodeURIComponent(url.pathname);

        // A real file in dist: assets, images, robots.txt …
        const file = path.normalize(path.join(ROOT, pathname));
        if (file.startsWith(ROOT) && pathname !== '/' && fs.existsSync(file) && fs.statSync(file).isFile()) {
            if (file === path.join(ROOT, 'index.html')) {
                await send(req, res, 200, index(), TYPES['.html']);
                return;
            }
            const hashed = pathname.startsWith('/assets/');
            const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
            const cacheControl = pathname === '/firebase-messaging-sw.js' ? 'no-cache' : hashed ? 'public, max-age=31536000, immutable' : 'public, max-age=3600';
            const stat = fs.statSync(file);
            if (compressible(type)) {
                await send(req, res, 200, () => fs.promises.readFile(file), type, cacheControl, `${file}:${stat.mtimeMs}:${stat.size}`);
            } else {
                // Images, fonts and video are already compressed. Keep streaming
                // them without retaining media in the text representation cache.
                if (!acceptedEncoding(req.headers['accept-encoding'], false)) {
                    res.writeHead(406, { Vary: 'Accept-Encoding', 'Content-Length': 0 });
                    res.end();
                    return;
                }
                res.writeHead(200, { 'Content-Type': type, 'Cache-Control': cacheControl, 'Content-Length': stat.size });
                if (req.method === 'HEAD') res.end();
                else fs.createReadStream(file).pipe(res);
            }
            return;
        }

        // Every public route gets the saved CMS preview in its initial HTML.
        // No metadata cache: the next fetch after a CMS save reads its image.
        if ((req.method === 'GET' || req.method === 'HEAD') && url.searchParams.get('ref') !== 'share' && isPublicPreviewPath(pathname)) {
            const preview = await fetchPagePreview(API, pathname);
            if (preview) {
                const origin = SITE_URL || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
                await send(req, res, 200, mergePagePreview(index(), preview, origin), TYPES['.html']);
                return;
            }
        }

        // Older backends still provide event metadata through the public API.
        const match = pathname.match(/^\/(?:member\/)?events\/([^/]+)(?:\/book)?\/?$/);
        if (match && req.method === 'GET') {
            const event = await fetchEvent(match[1]);
            if (event) {
                const origin = SITE_URL || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
                const pageUrl = `${origin}/events/${encodeURIComponent(event.slug || event.id)}`;
                await send(req, res, 200, eventPage(event, pageUrl), TYPES['.html']);
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
                await send(req, res, 200, eventPage({
                    title: item.title || 'ACTIV gallery',
                    description: item.caption || '',
                    imageUrl: (item.media && item.media.url) || ''
                }, pageUrl), TYPES['.html']);
                return;
            }
        }

        // Every other route belongs to the SPA.
        await send(req, res, 200, index(), TYPES['.html']);
    } catch (error) {
        console.error('server error', error);
        await send(req, res, 500, 'Server error', 'text/plain');
    }
});

server.listen(PORT, () => {
    console.log(`ACTIV website on :${server.address().port}${API ? ` (event previews from ${API})` : ' (API_URL unset: no event previews)'}`);
});
