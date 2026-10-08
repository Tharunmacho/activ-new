import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isPublicPreviewPath, mergePagePreview } from '../share-preview.mjs';

let aboutImage = 'https://api.activ.org.in/uploads/about-first.jpg';
const escapes = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const preview = (path, image) => `<!doctype html><html><head><title>${escapes(path)} | ACTIV</title><meta property="og:title" content="${escapes(`ACTIV ${path}`)}"><meta property="og:description" content="CMS description"><meta name="description" content="CMS description"><meta property="og:url" content="https://configured.example${path}"><meta property="og:image" content="${escapes(image)}"><meta property="og:image:type" content="image/jpeg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:image" content="${escapes(image)}"><link rel="canonical" href="https://configured.example${path}"></head><body><script>location.replace('https://configured.example')</script></body></html>`;
const hits = [];
const canonical = path => ({ '/onboarding': '/' })[path] || path;
const api = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/api/v1/share/companies/507f1f77bcf86cd799439011') {
        hits.push('/network/company/507f1f77bcf86cd799439011');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.end(preview('/network/company/507f1f77bcf86cd799439011', 'https://api.activ.org.in/share/companies/507f1f77bcf86cd799439011/preview/test.jpg'));
    }
    if (url.pathname === '/api/v1/share/page') {
        const path = canonical(url.searchParams.get('path'));
        hits.push(path);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.end(preview(path, path === '/about' ? aboutImage : path === '/' ? 'https://api.activ.org.in/share/activ-conference.jpg' : 'https://api.activ.org.in/share/preview-placeholder.jpg'));
    }
    res.writeHead(404); res.end('{}');
});
await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
const child = spawn(process.execPath, [fileURLToPath(new URL('../server.mjs', import.meta.url))], {
    env: { ...process.env, PORT: '0', API_URL: `http://127.0.0.1:${api.address().port}`, SITE_URL: 'https://activ.org.in' },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
});
try {
    const port = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Website failed to start')), 10000);
        child.stdout.on('data', data => {
            const match = String(data).match(/ACTIV website on :(\d+)/);
            if (match) { clearTimeout(timeout); resolve(match[1]); }
        });
        child.once('error', err => { clearTimeout(timeout); reject(err); });
        child.once('exit', () => { clearTimeout(timeout); reject(new Error('Website exited before startup')); });
    });
    for (const path of ['/', '/onboarding', '/about', '/membership', '/contact', '/events', '/gallery', '/news', '/news/chapter-news', '/schemes', '/schemes/central', '/schemes/state', '/register', '/states/tamil-nadu/newsUpdates', '/states/tamil-nadu/leaders', '/states/tamil-nadu/keyAchievements', '/regions/national', '/regions/south', '/regions/south/leaders', '/regions/south/about', '/regions/south/section-business-support', '/gallery/album/photo/1']) {
        for (const agent of ['Mozilla/5.0', 'facebookexternalhit/1.1', 'WhatsApp', 'LinkedInBot/1.0']) {
            const response = await fetch(`http://127.0.0.1:${port}${path}`, { headers: { 'user-agent': agent } });
            const html = await response.text();
            assert.equal(response.status, 200);
            assert.ok(html.includes(`property="og:title" content="ACTIV ${canonical(path)}"`));
            assert.ok(html.includes(`property="og:url" content="https://activ.org.in${canonical(path)}"`));
            assert.equal((html.match(/property="og:image"/g) || []).length, 1);
            assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
            assert.ok(html.includes('id="root"') && html.includes('/assets/'), 'SPA remains intact');
            assert.ok(!html.includes("location.replace('https://configured.example')"), 'Only metadata is merged');
        }
    }
    for (const agent of ['Mozilla/5.0', 'facebookexternalhit/1.1', 'WhatsApp', 'LinkedInBot/1.0']) {
        const companyPath = '/network/company/507f1f77bcf86cd799439011';
        const response = await fetch(`http://127.0.0.1:${port}${companyPath}`, { headers: { 'user-agent': agent } });
        const html = await response.text();
        assert.equal(response.status, 200);
        assert.ok(html.includes(`property="og:title" content="ACTIV ${companyPath}"`));
        assert.ok(html.includes(`property="og:url" content="https://activ.org.in${companyPath}"`));
        assert.ok(html.includes('companies/507f1f77bcf86cd799439011/preview/test.jpg'));
        assert.ok(html.includes('id="root"') && html.includes('/assets/'));
        assert.equal((html.match(/property="og:image"/g) || []).length, 1);
    }
    assert.equal(isPublicPreviewPath('/network/company/not-an-id'), false);
    aboutImage = 'https://api.activ.org.in/uploads/about-replacement.jpg';
    const changed = await fetch(`http://127.0.0.1:${port}/about`).then(response => response.text());
    assert.ok(changed.includes('content="https://api.activ.org.in/uploads/about-replacement.jpg"'));
    assert.ok(!changed.includes('about-first.jpg'), 'The next fetch sees the CMS replacement');
    const membership = await fetch(`http://127.0.0.1:${port}/membership`).then(response => response.text());
    assert.ok(membership.includes('preview-placeholder.jpg'), 'Replacement is isolated to About');
    const before = hits.length;
    await fetch(`http://127.0.0.1:${port}/payment/member-dashboard`);
    await fetch(`http://127.0.0.1:${port}/cms/social-previews`);
    await fetch(`http://127.0.0.1:${port}/?ref=share`);
    assert.equal(hits.length, before, 'Private and shell-bypass routes do not request previews');
    assert.equal(isPublicPreviewPath('/reset-password'), false);
    assert.equal(isPublicPreviewPath('/events/../login'), false);
    const merged = mergePagePreview('<html><head><meta content="old" property="og:image"><meta property="og:image" content="old"><meta name="description" content="old"><title>old</title></head><body id="root"></body></html>', preview('/about', aboutImage));
    assert.equal((merged.match(/property="og:image"/g) || []).length, 1, 'Duplicate old tags are removed');
    console.log('PASS: every public page serves CMS metadata to browsers/crawlers; next fetch sees replacement; isolated routes, SPA, canonical and private exclusions preserved');
} finally {
    child.kill();
    await new Promise(resolve => api.close(resolve));
}
