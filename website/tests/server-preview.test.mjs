import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const slug = 'scst-economic-liberty-conference-2026-10-10';
const event = {
    id: '0123456789abcdef01234567', slug,
    title: 'SCST Economic Liberty Conference', startAt: '2026-10-10T04:30:00Z',
    venue: 'DNC VIJAY MAHAL', description: 'Event description & registration.',
    imageUrl: `/uploads/events/version/${slug}.png`,
};
let apiCalls = 0;
const api = http.createServer((req, res) => {
    if (req.url === `/api/v1/cms/events/${slug}`) {
        apiCalls++;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ data: event }));
    } else { res.writeHead(404); res.end('{}'); }
});
await new Promise((resolve) => api.listen(0, '127.0.0.1', resolve));
const child = spawn(process.execPath, [fileURLToPath(new URL('../server.mjs', import.meta.url))], {
    env: { ...process.env, PORT: '0', API_URL: `http://127.0.0.1:${api.address().port}`, SITE_URL: 'https://activ.org.in', META_APP_ID: '123456789' },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
});
try {
    const port = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Website failed to start')), 10000);
        child.stdout.on('data', (data) => {
            const match = String(data).match(/ACTIV website on :(\d+)/);
            if (match) { clearTimeout(timeout); resolve(match[1]); }
        });
        child.once('error', (err) => { clearTimeout(timeout); reject(err); });
        child.once('exit', () => { clearTimeout(timeout); reject(new Error('Website exited before startup')); });
    });
    for (const agent of ['Mozilla/5.0', 'facebookexternalhit/1.1', 'meta-externalfetcher/1.1', 'WhatsApp', 'Twitterbot/1.0', 'LinkedInBot/1.0']) {
        const response = await fetch(`http://127.0.0.1:${port}/events/${slug}`, { headers: { 'user-agent': agent } });
        assert.equal(response.status, 200);
        const html = await response.text();
        assert.ok(html.includes('SCST Economic Liberty Conference on 10 October 2026 at DNC VIJAY MAHAL'));
        assert.ok(html.includes('Event description &amp; registration.'));
        assert.match(html,new RegExp(`/api/v1/share/events/${slug}/preview/[a-f0-9]{20}\\.jpg`));
        assert.ok(html.includes('property="og:image:type" content="image/jpeg"'));
        assert.ok(html.includes(`property="og:url" content="https://activ.org.in/events/${slug}"`));
        assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
        assert.ok(!html.includes('property="og:image" content="https://activ.org.in/logo_'));
        assert.ok(html.includes('id="root"') && html.includes('/assets/'));
        assert.ok(html.includes('property="fb:app_id" content="123456789"'));
    }
    const book = await fetch(`http://127.0.0.1:${port}/events/${slug}/book`);
    assert.ok((await book.text()).includes(`property="og:url" content="https://activ.org.in/events/${slug}"`));
    assert.equal(apiCalls, 1, 'API record is reused across crawler identities');
    console.log('PASS: Dokploy Node server returns event title, banner, description, one canonical, and SPA for six user agents and booking links');
} finally {
    child.kill();
    await new Promise((resolve) => api.close(resolve));
}
