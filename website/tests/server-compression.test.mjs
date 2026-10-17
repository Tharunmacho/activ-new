import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';

const root = fileURLToPath(new URL('..', import.meta.url));
const fixture = await mkdtemp(path.join(tmpdir(), 'activ-server-compression-'));
const js = Buffer.from('export const values = [' + Array.from({ length: 8000 }, (_, i) => JSON.stringify(`ACTIV item ${i}`)).join(',') + '];');
const css = Buffer.from('.activ-card{padding:16px;color:#1c2e68;background:white;}\n'.repeat(1500));
const html = '<html><head><title>ACTIV</title></head><body><div id="root">Loading ACTIV</div></body></html>';
const image = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 255, 1, 2]);
let apiCalls = 0, title = 'First preview';
const api = http.createServer((req, res) => {
    apiCalls++;
    res.setHeader('Content-Type', 'text/html');
    res.end(`<html><head><title>${title}</title><meta property="og:title" content="${title}"></head></html>`);
});
let child;
try {
    await mkdir(path.join(fixture, 'dist/assets'), { recursive: true });
    for (const file of ['server.mjs', 'share-preview.mjs', 'api-base.mjs']) await copyFile(path.join(root, file), path.join(fixture, file));
    await writeFile(path.join(fixture, 'dist/index.html'), html);
    await writeFile(path.join(fixture, 'dist/assets/main-test.js'), js);
    await writeFile(path.join(fixture, 'dist/assets/main-test.css'), css);
    await writeFile(path.join(fixture, 'dist/image.png'), image);
    await writeFile(path.join(fixture, 'dist/firebase-messaging-sw.js'), js);
    await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
    child = spawn(process.execPath, [path.join(fixture, 'server.mjs')], {
        env: { ...process.env, PORT: '0', API_URL: `http://127.0.0.1:${api.address().port}`, SITE_URL: 'https://activ.org.in' },
        stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    const port = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(Error('Website did not start')), 10000);
        child.stdout.on('data', chunk => {
            const match = String(chunk).match(/ACTIV website on :(\d+)/);
            if (match) { clearTimeout(timeout); resolve(Number(match[1])); }
        });
        child.once('error', error => { clearTimeout(timeout); reject(error); });
        child.once('exit', code => { clearTimeout(timeout); reject(Error(`Website exited: ${code}`)); });
    });
    const request = (url, headers = {}, method = 'GET') => new Promise((resolve, reject) => {
        const req = http.request({ hostname: '127.0.0.1', port, path: url, headers, method }, res => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
        });
        req.setTimeout(10000, () => req.destroy(Error('Request timed out')));
        req.on('error', reject); req.end();
    });
    const identity = await request('/assets/main-test.js');
    assert.deepEqual(identity.body, js);
    assert.equal(identity.headers['content-encoding'], undefined);
    assert.equal(identity.headers.vary, 'Accept-Encoding');
    assert.equal(identity.headers['cache-control'], 'public, max-age=31536000, immutable');
    const br = await request('/assets/main-test.js', { 'accept-encoding': 'gzip, br' });
    assert.equal(br.headers['content-encoding'], 'br');
    assert.deepEqual(brotliDecompressSync(br.body), js);
    assert.equal(Number(br.headers['content-length']), br.body.length);
    assert.ok(br.body.length < js.length / 3);
    const gzip = await request('/assets/main-test.js', { 'accept-encoding': 'br;q=0.5, gzip;q=1' });
    assert.equal(gzip.headers['content-encoding'], 'gzip');
    assert.deepEqual(gunzipSync(gzip.body), js);
    assert.notEqual(br.headers.etag, gzip.headers.etag);
    assert.notEqual(identity.headers.etag, br.headers.etag);
    assert.equal((await request('/assets/main-test.js', { 'accept-encoding': 'br;q=0, gzip;q=0' })).headers['content-encoding'], undefined);
    assert.equal((await request('/assets/main-test.js', { 'accept-encoding': 'gzip;q=0.3, identity;q=1' })).headers['content-encoding'], undefined);
    assert.equal((await request('/assets/main-test.js', { 'accept-encoding': 'gzip;q=0.2, *;q=0' })).headers['content-encoding'], 'gzip');
    assert.equal((await request('/assets/main-test.js', { 'accept-encoding': '*;q=0' })).status, 406);
    assert.equal((await request('/assets/main-test.js', { 'accept-encoding': 'zstd' })).status, 200);
    const head = await request('/assets/main-test.js', { 'accept-encoding': 'br' }, 'HEAD');
    assert.equal(head.body.length, 0);
    assert.equal(head.headers['content-length'], br.headers['content-length']);
    assert.equal(head.headers.etag, br.headers.etag);
    const revalidated = await request('/assets/main-test.js', { 'accept-encoding': 'br', 'if-none-match': `"unrelated", W/${br.headers.etag}` });
    assert.equal(revalidated.status, 304);
    assert.equal(revalidated.body.length, 0);
    assert.equal(revalidated.headers.vary, 'Accept-Encoding');
    assert.equal(revalidated.headers.etag, br.headers.etag);
    assert.equal((await request('/assets/main-test.js', { 'accept-encoding': 'gzip', 'if-none-match': br.headers.etag })).status, 200);
    const simultaneous = await Promise.all(Array.from({ length: 6 }, () => request('/assets/main-test.css', { 'accept-encoding': 'br' })));
    for (const response of simultaneous) assert.deepEqual(brotliDecompressSync(response.body), css);
    const changed = Buffer.concat([css, Buffer.from('\n.changed{display:block;}')]);
    await writeFile(path.join(fixture, 'dist/assets/main-test.css'), changed);
    const updated = await request('/assets/main-test.css', { 'accept-encoding': 'br' });
    assert.deepEqual(brotliDecompressSync(updated.body), changed);
    assert.notEqual(updated.headers.etag, simultaneous[0].headers.etag);
    const admin = await request('/super-admin/updates', { 'accept-encoding': 'br' });
    assert.equal(apiCalls, 0, 'Private routes do not request public preview metadata');
    assert.equal(brotliDecompressSync(admin.body).toString(), html);
    assert.equal(admin.headers['cache-control'], 'no-cache');
    const preview = await request('/about', { 'accept-encoding': 'br' });
    assert.match(brotliDecompressSync(preview.body).toString(), /First preview/);
    title = 'Changed preview';
    const changedPreview = await request('/about', { 'accept-encoding': 'br', 'if-none-match': preview.headers.etag });
    assert.equal(changedPreview.status, 200);
    assert.match(brotliDecompressSync(changedPreview.body).toString(), /Changed preview/);
    const previewHead = await request('/about', { 'accept-encoding': 'br' }, 'HEAD');
    assert.equal(previewHead.body.length, 0);
    assert.equal(previewHead.headers.etag, changedPreview.headers.etag);
    const png = await request('/image.png', { 'accept-encoding': 'br,gzip' });
    assert.deepEqual(png.body, image, 'Already compressed media is untouched');
    assert.equal(png.headers['content-encoding'], undefined);
    assert.equal((await request('/image.png', {}, 'HEAD')).body.length, 0);
    assert.equal((await request('/firebase-messaging-sw.js', { 'accept-encoding': 'gzip' })).headers['cache-control'], 'no-cache');
    console.log('PASS: Brotli/gzip/identity negotiation, byte-accurate GET/HEAD, encoding-specific ETags and 304s, concurrent reads, changed assets, fresh public previews, private startup and unmodified media.');
} finally {
    if (child && child.exitCode === null) {
        const stopped = new Promise(resolve => child.once('exit', resolve));
        child.kill(); await stopped;
    }
    api.closeAllConnections(); await new Promise(resolve => api.close(resolve));
    const resolved = path.resolve(fixture);
    if (resolved.startsWith(path.resolve(tmpdir()) + path.sep + 'activ-server-compression-')) await rm(resolved, { recursive: true, force: true });
}
