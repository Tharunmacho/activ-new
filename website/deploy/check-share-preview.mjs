// Run after deploying BOTH the backend and the Apache website rules.
// node deploy/check-share-preview.mjs https://activ.org.in/events/<slug>
const target = process.argv[2];
if (!target) throw new Error('Provide an absolute event URL');
const targetUrl = new URL(target);
if (!/^\/events\/[^/]+\/?$/.test(targetUrl.pathname)) throw new Error('Provide a public event detail URL');
const expected = targetUrl.origin + targetUrl.pathname.replace(/\/$/, '');
let failed = false;
for (const agent of ['Mozilla/5.0', 'facebookexternalhit/1.1', 'meta-externalfetcher/1.1', 'WhatsApp', 'Twitterbot/1.0', 'LinkedInBot/1.0']) {
    const response = await fetch(target, { headers: { 'user-agent': agent }, signal: AbortSignal.timeout(15000) });
    const html = await response.text();
    const meta = (key) => html.match(new RegExp(`<meta\\s+(?:property|name)=["']${key}["']\\s+content=["']([^"']*)`, 'i'))?.[1] || '';
    const url = meta('og:url');
    const title = meta('og:title');
    const image = meta('og:image').replace(/&amp;/g, '&');
    const description = meta('og:description');
    const ok = response.ok && url === expected && / on .+ at /.test(title) && !!description && /^https:\/\//.test(image) && !/logo_ACTIVian|activss\.jpg/.test(image);
    console.log(`${ok ? 'PASS' : 'FAIL'} ${agent}: ${JSON.stringify({ status: response.status, url, title, image })}`);
    failed ||= !ok;
    if (ok) {
        const picture = await fetch(image, { headers: { 'user-agent': agent }, signal: AbortSignal.timeout(15000) });
        const validImage = picture.ok && /^image\//i.test(picture.headers.get('content-type') || '');
        await picture.body?.cancel();
        if (!validImage) { failed = true; console.log(`FAIL image Content-Type for ${agent}`); }
    }
}
process.exitCode = failed ? 1 : 0;
