// Local browser + mock API only. No credentials or production uploads.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'activ-media-browser-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let bundle = '', uploadBytes = 0, failUpload = false;
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
    if (!url.pathname.startsWith('/api/')) { res.setHeader('Content-Type', 'text/html'); return res.end('<html><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>'); }
    res.setHeader('Content-Type', 'application/json');
    let data = {};
    if (url.pathname.endsWith('/cms/media')) {
        uploadBytes = 0;
        for await (const chunk of req) uploadBytes += chunk.length;
        await pause(700);
        if (failUpload) { res.statusCode = 500; return res.end(JSON.stringify({ message: 'Test upload failed' })); }
        data = { url: '/uploads/media/test-version/south-zone-banner.jpg', type: 'image' };
    } else if (url.pathname.endsWith('/cms/schemes/states')) data = [{ state: 'Tamil Nadu', total: 2 }, { state: 'Kerala', total: 0 }];
    else if (url.pathname.endsWith('/cms/regions/map')) data = { regions: [{ label: 'South', states: [{ name: 'Tamil Nadu', slug: 'tamil-nadu' }] }] };
    else if (url.pathname.endsWith('/cms/schemes/settings')) data = { stateLabel: 'State schemes', stateDescription: 'Explore schemes in your state', centralLabel: 'Central schemes' };
    else if (url.pathname.endsWith('/cms/share-previews')) data = { routes: ['/schemes/central', '/schemes/state', '/states/tamil-nadu'].map(route => ({ path: route, label: route, group: 'Pages' })) };
    else if (url.pathname.endsWith('/cms/share-previews/resolve')) data = { path: url.searchParams.get('path'), label: 'Preview', title: 'Preview', image: { url: '' }, overrides: { title: '', description: '', image: null } };
    res.end(JSON.stringify({ data }));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let chrome, ws;
try {
    const built = await build({
        absWorkingDir: root, bundle: true, write: false, format: 'esm', jsx: 'automatic',
        alias: { '@': path.join(root, 'src') },
        define: { 'import.meta.env': JSON.stringify({ DEV: true, VITE_API_URL: `${base}/api/v1` }), 'process.env.NODE_ENV': '"production"' },
        stdin: { resolveDir: root, loader: 'tsx', contents: `
            import React, { useState } from 'react';
            import { createRoot } from 'react-dom/client';
            import { MemoryRouter } from 'react-router-dom';
            import { UploadField } from './src/pages/cms/components/UploadField';
            import MediaPicker from './src/pages/cms/components/MediaPicker';
            import SharePreviewsManager from './src/pages/cms/SharePreviewsManager';
            import SchemesPage from './src/pages/onboarding/SchemesPage';
            import { prepareImage, mediaDisplayName } from './src/lib/prepareImage';
            const root = createRoot(document.getElementById('root'));
            function UploadHarness({ picker = false }) {
                const [media, setMedia] = useState({ url: '/uploads/cms-1791179725295-668962339.png', type: 'image', alt: '', fit: 'contain' });
                return picker ? <MediaPicker value={media} onChange={setMedia} imagesOnly /> : <UploadField label="Background image" url={media.url} onChange={url => setMedia({ ...media, url })} />;
            }
            window.prepareImage = prepareImage; window.mediaDisplayName = mediaDisplayName;
            window.mount = kind => root.render(kind === 'schemes' ? <MemoryRouter><SchemesPage view="states" /></MemoryRouter> : kind === 'previews' ? <SharePreviewsManager /> : <UploadHarness key={kind} picker={kind === 'picker'} />);
            window.mount('upload'); window.ready = true;
        ` },
    });
    bundle = built.outputFiles[0].text;
    console.log('Browser fixtures bundled; starting Chrome');
    const port = 9700 + Math.floor(Math.random() * 200);
    chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
        '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank',
    ], { windowsHide: true, stdio: 'ignore' });
    chrome.on('error', error => { console.error(error.message); });
    let tabs;
    for (let i = 0; i < 80; i++) {
        try { tabs = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1000) }).then(r => r.json()); if (tabs.some(t => t.type === 'page')) break; } catch { /* starting */ }
        await pause(100);
    }
    assert.ok(tabs?.some(t => t.type === 'page'), 'Chrome starts');
    ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise(resolve => ws.addEventListener('open', resolve));
    let id = 0;
    const pending = new Map();
    ws.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        if (message.method === 'Runtime.exceptionThrown') console.error(message.params.exceptionDetails?.exception?.description || message.params.exceptionDetails?.text);
        pending.get(message.id)?.(message); pending.delete(message.id);
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
        const key = ++id;
        const timer = setTimeout(() => { pending.delete(key); reject(new Error(`CDP timeout: ${method}`)); }, 20000);
        pending.set(key, result => { clearTimeout(timer); resolve(result); });
        ws.send(JSON.stringify({ id: key, method, params }));
    });
    const evaluate = async expression => {
        const message = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (message.result?.exceptionDetails) throw new Error(message.result.exceptionDetails.exception?.description || 'Browser exception');
        return message.result?.result?.value;
    };
    const until = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(`Boolean(${expression})`)) return; await pause(100); } throw new Error(`Timed out: ${expression}; page: ${await evaluate('location.href + " " + document.body.innerText.slice(0,500)')}`); };
    await send('Runtime.enable');
    await send('Page.navigate', { url: base });
    await until('window.ready && document.querySelector("input[type=file]")');
    console.log('Checking image preparation and upload controls');
    const sizes = await evaluate(`(async () => {
        const canvas = document.createElement('canvas'); canvas.width = 3600; canvas.height = 1800;
        const ctx = canvas.getContext('2d'); const pixels = ctx.createImageData(3600, 1800);
        let seed = 42; for (let i = 0; i < pixels.data.length; i += 4) {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            pixels.data[i] = seed & 255; pixels.data[i+1] = (seed >>> 8) & 255; pixels.data[i+2] = (seed >>> 16) & 255; pixels.data[i+3] = 255;
        } ctx.putImageData(pixels, 0, 0);
        const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.98));
        window.testFile = new File([blob], 'South Zone Banner.jpg', { type: 'image/jpeg' });
        const prepared = await prepareImage(testFile); const bitmap = await createImageBitmap(prepared);
        const small = new File(['tiny'], 'tiny.png', { type: 'image/png' });
        const gif = new File(['gif'], 'animated.gif', { type: 'image/gif' });
        ctx.clearRect(0, 0, 200, 200);
        const png = await new Promise(r => canvas.toBlob(r, 'image/png'));
        const transparent = await prepareImage(new File([png], 'Transparent.png', { type: 'image/png' }));
        const alphaBitmap = await createImageBitmap(transparent);
        ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(alphaBitmap, 0, 0);
        const alpha = ctx.getImageData(0, 0, 1, 1).data[3];
        return { before: testFile.size, after: prepared.size, width: bitmap.width, height: bitmap.height,
            alpha, smallUnchanged: await prepareImage(small) === small, gifUnchanged: await prepareImage(gif) === gif };
    })()`);
    assert.ok(sizes.after < sizes.before);
    assert.equal(sizes.width, 2560); assert.equal(sizes.height, 1280);
    assert.ok(sizes.smallUnchanged && sizes.gifUnchanged);
    assert.equal(sizes.alpha, 0, 'PNG transparency survives optimization');
    assert.ok(!(await evaluate('document.body.innerText')).includes('1791179725295'));
    for (const kind of ['upload', 'picker']) {
        await evaluate(`window.mount('${kind}')`);
        await until('document.querySelector("input[type=file]")');
        await evaluate(`{ const input = document.querySelector('input[type=file]'); const transfer = new DataTransfer(); transfer.items.add(testFile); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); }`);
        await until('document.querySelector("img")?.src.startsWith("blob:") && /Preparing|Uploading|Saving/.test(document.body.innerText)');
        await until('document.body.innerText.includes("south-zone-banner.jpg")');
        assert.ok(uploadBytes < sizes.before, 'The optimized image is transferred');
        assert.ok(!(await evaluate('document.body.innerText')).includes('/uploads/'));
    }
    failUpload = true;
    await evaluate(`{ const input = document.querySelector('input[type=file]'); input.dispatchEvent(new Event('change', { bubbles: true })); }`);
    // File inputs are cleared after upload; populate again for the failure case.
    await evaluate(`{ const input = document.querySelector('input[type=file]'); const transfer = new DataTransfer(); transfer.items.add(testFile); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); }`);
    await until('document.body.innerText.includes("Test upload failed")');
    assert.ok(await evaluate('document.body.innerText.includes("south-zone-banner.jpg")'), 'Failure preserves the previously saved image');
    await evaluate('window.mount("schemes")');
    await until(`document.querySelector('a[href="/schemes/state/tamil-nadu"]')`);
    assert.ok((await evaluate('document.body.innerText')).includes('State schemes'));
    await evaluate('window.mount("previews")');
    await until(`document.querySelector('select[aria-label="Website route"]')`);
    const routes = await evaluate(`[...document.querySelectorAll('select[aria-label="Website route"] option')].map(option => option.value)`);
    for (const route of ['/schemes/central', '/schemes/state', '/states/tamil-nadu']) assert.ok(routes.includes(route));
    console.log(`PASS: real-browser upload previews, progress, readable filenames, failed upload preservation, state schemes and CMS selectors. Test image ${sizes.before} -> ${sizes.after} bytes (${Math.round(100 * (1 - sizes.after / sizes.before))}% smaller).`);
    await send('Browser.close');
} finally {
    ws?.close(); chrome?.kill();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    if (path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep + 'activ-media-browser-')) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
