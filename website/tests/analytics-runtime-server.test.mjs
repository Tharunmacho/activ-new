import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';

const root = fileURLToPath(new URL('..', import.meta.url));
const fixture = await mkdtemp(path.join(tmpdir(), 'activ-analytics-runtime-'));
const html = '<html><head><title>ACTIV</title><script type="module" src="/assets/main-test.js"></script></head><body><div id="root">Loading ACTIV</div></body></html>';
const script = 'export const buildMeasurementId = "";';
const secret = 'SERVER_ONLY_SECRET_MUST_NOT_REACH_HTML';
const children = new Set();
const api = http.createServer((req, res) => {
    const route = new URL(req.url, 'http://localhost');
    if (route.pathname === '/api/v1/share/page' && route.searchParams.get('path') === '/about') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><head><title>About preview</title><meta property="og:title" content="About preview"></head></html>');
    } else {
        res.writeHead(404);
        res.end();
    }
});

const start = async measurementId => {
    const env = {
        ...process.env,
        PORT: '0',
        API_URL: `http://127.0.0.1:${api.address().port}/api/v1`,
        SITE_URL: 'https://example.test',
        PRIVATE_SERVER_SECRET: secret,
        VITE_UNRELATED_TEST_VALUE: secret,
    };
    delete env.VITE_GA_MEASUREMENT_ID;
    if (measurementId !== undefined) env.VITE_GA_MEASUREMENT_ID = measurementId;
    const child = spawn(process.execPath, [path.join(fixture, 'server.mjs')], {
        env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    children.add(child);
    const port = await new Promise((resolve, reject) => {
        let output = '';
        const timeout = setTimeout(() => reject(Error('Website did not start')), 10000);
        child.stdout.on('data', chunk => {
            output += String(chunk);
            const match = output.match(/ACTIV website on :(\d+)/);
            if (match) { clearTimeout(timeout); resolve(Number(match[1])); }
        });
        child.once('error', error => { clearTimeout(timeout); reject(error); });
        child.once('exit', code => { clearTimeout(timeout); reject(Error(`Website exited: ${code}`)); });
        child.stderr.resume();
    });
    const request = (url, headers = {}, method = 'GET') => new Promise((resolve, reject) => {
        const req = http.request({ hostname: '127.0.0.1', port, path: url, headers, method }, res => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
        });
        req.setTimeout(10000, () => req.destroy(Error('Request timed out')));
        req.on('error', reject);
        req.end();
    });
    return { child, request };
};

const stop = async child => {
    if (child.exitCode === null && child.signalCode === null) {
        const stopped = new Promise(resolve => child.once('exit', resolve));
        child.kill();
        await stopped;
    }
    children.delete(child);
};

const decoded = response => {
    const encoding = response.headers['content-encoding'];
    return (encoding === 'br' ? brotliDecompressSync(response.body)
        : encoding === 'gzip' ? gunzipSync(response.body) : response.body).toString();
};
const measurementTag = body => {
    const tags = body.match(/<meta\b[^>]*\bname=["']activ-ga-measurement-id["'][^>]*>/gi) || [];
    assert.ok(tags.length <= 1, 'Each HTML response has at most one runtime measurement ID');
    return tags.length ? tags[0].match(/\bcontent=["']([^"']*)["']/)?.[1] : undefined;
};
const assertHtml = (response, expectedId) => {
    assert.equal(response.status, 200);
    assert.match(response.headers['content-type'], /^text\/html/);
    assert.equal(response.headers['cache-control'], 'no-cache', 'Runtime HTML must be revalidated');
    const body = decoded(response);
    assert.equal(measurementTag(body), expectedId);
    assert.ok(!body.includes(secret), 'Only the measurement ID may be exposed from the environment');
    assert.ok(!body.includes('PRIVATE_SERVER_SECRET'));
    assert.ok(!body.includes('VITE_UNRELATED_TEST_VALUE'));
    return body;
};

try {
    await mkdir(path.join(fixture, 'dist/assets'), { recursive: true });
    for (const file of ['server.mjs', 'share-preview.mjs', 'api-base.mjs']) {
        await copyFile(path.join(root, file), path.join(fixture, file));
    }
    await writeFile(path.join(fixture, 'dist/index.html'), html);
    await writeFile(path.join(fixture, 'dist/assets/main-test.js'), script);
    await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));

    const configured = await start('  G-RUNTIME123  ');
    for (const route of ['/index.html', '/login', '/super-admin/updates']) {
        assertHtml(await configured.request(route), 'G-RUNTIME123');
    }
    const preview = assertHtml(await configured.request('/about'), 'G-RUNTIME123');
    assert.match(preview, /<title>About preview<\/title>/);
    assert.match(preview, /property="og:title" content="About preview"/);

    const old = await configured.request('/super-admin/updates');
    for (const encoding of ['br', 'gzip']) {
        const compressed = await configured.request('/index.html', { 'accept-encoding': encoding });
        assertHtml(compressed, 'G-RUNTIME123');
        assert.equal(compressed.headers['content-encoding'], encoding);
        assert.equal(compressed.headers.vary, 'Accept-Encoding');
        const head = await configured.request('/index.html', { 'accept-encoding': encoding }, 'HEAD');
        assert.equal(head.status, 200);
        assert.equal(head.body.length, 0);
        assert.equal(head.headers['content-length'], compressed.headers['content-length']);
        assert.equal(head.headers.etag, compressed.headers.etag);
        assert.equal(head.headers['cache-control'], 'no-cache');
        const unchanged = await configured.request('/index.html', {
            'accept-encoding': encoding, 'if-none-match': compressed.headers.etag,
        });
        assert.equal(unchanged.status, 304);
        assert.equal(unchanged.body.length, 0);
    }
    const asset = await configured.request('/assets/main-test.js');
    assert.equal(asset.body.toString(), script, 'The compiled bundle stays unchanged');
    assert.equal(asset.headers['cache-control'], 'public, max-age=31536000, immutable');
    await stop(configured.child);

    const changed = await start('G-RESTART456');
    const restarted = await changed.request('/super-admin/updates', { 'if-none-match': old.headers.etag });
    assertHtml(restarted, 'G-RESTART456');
    assert.notEqual(restarted.headers.etag, old.headers.etag, 'A restarted server serves the new runtime ID');
    await stop(changed.child);

    const unset = await start(undefined);
    assertHtml(await unset.request('/index.html'), undefined);
    await stop(unset.child);

    for (const value of ['', '   ', 'G-INVALID"><script>alert("injected")</script>']) {
        const disabled = await start(value);
        const body = assertHtml(await disabled.request('/index.html'), '');
        assert.ok(!body.includes('injected'), 'Invalid values cannot insert HTML');
        await stop(disabled.child);
    }
    assert.equal(await readFile(path.join(fixture, 'dist/index.html'), 'utf8'), html, 'Runtime configuration does not rewrite built files');
    console.log('PASS: runtime GA ID, unset fallback, explicit disable, safe HTML, preview merge, direct index, compression, HEAD, caching and restart. All requests used loopback; no Analytics events sent.');
} finally {
    for (const child of children) await stop(child);
    api.closeAllConnections();
    if (api.listening) await new Promise(resolve => api.close(resolve));
    const resolved = path.resolve(fixture);
    if (resolved.startsWith(path.resolve(tmpdir()) + path.sep + 'activ-analytics-runtime-')) {
        await rm(resolved, { recursive: true, force: true });
    }
}
