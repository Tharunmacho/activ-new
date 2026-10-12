import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'activ-news-image-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let bundle = '', css = '', chrome, ws;
const imageRequests = [];
const server = http.createServer((req, res) => {
    if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
    if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
    if (req.url.startsWith('/uploads/')) {
        imageRequests.push(req.url); res.setHeader('Content-Type', 'image/svg+xml');
        return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="700" height="1400"><rect width="700" height="1400" fill="white"/><text x="50" y="100" font-size="32">OFFICIAL LETTER</text><text x="50" y="700" font-size="24">The complete document remains readable.</text><text x="50" y="1340" font-size="24">SIGNATURE AT THE BOTTOM</text></svg>');
    }
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
    const files = await readdir(path.join(root, 'dist/assets'));
    css = await readFile(path.join(root, 'dist/assets', files.find(file => /^index-.*\.css$/.test(file))), 'utf8');
    const fixtures = { name: 'news-fixtures', setup(b) {
        b.onResolve({ filter: /cmsNewsApi|HeaderSection|FooterSection|ShareMenu$/ }, args => ({ path: args.path, namespace: 'fixture' }));
        b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'js', contents: args.path.includes('cmsNewsApi')
            ? 'export const getArticle=async()=>({title:"Letter fixture",body:"Full letter below",image:{url:window.location.origin+"/uploads/letter.svg",alt:"Official letter"},photos:[{url:window.location.origin+"/uploads/second.svg",alt:"Second letter"}],extraFields:[]});'
            : 'export const HeaderSection=()=>null;export const FooterSection=()=>null;export const ShareMenu=()=>null;' }));
    } };
    const built = await build({ absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', plugins: [fixtures], define: { 'import.meta.env': JSON.stringify({ DEV: true, VITE_API_URL: `http://127.0.0.1:${server.address().port}/api/v1` }), 'process.env.NODE_ENV': '"test"' }, stdin: { resolveDir: root, loader: 'tsx', contents: `
        import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,Routes,Route} from 'react-router-dom';
        import NewsDetailPage from './src/pages/onboarding/NewsDetailPage';
        createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/news/letter']}><Routes><Route path="/news/:slug" element={<NewsDetailPage/>}/></Routes></MemoryRouter>);
    ` } });
    bundle = built.outputFiles[0].text;
    chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    let port;
    for (let i = 0; i < 100; i++) { try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch {} await pause(100); }
    assert(port, 'Chrome starts');
    const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
    ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise(resolve => ws.addEventListener('open', resolve));
    let seq = 0; const pending = new Map(), errors = [];
    ws.addEventListener('message', event => { const m = JSON.parse(event.data); if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text); pending.get(m.id)?.(m); pending.delete(m.id); });
    const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq, timer = setTimeout(() => reject(Error(method)), 15000); pending.set(id, r => { clearTimeout(timer); resolve(r); }); ws.send(JSON.stringify({ id, method, params })); });
    const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw Error(r.result.exceptionDetails.exception?.description); return r.result?.result?.value; };
    const until = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(`Boolean(${expression})`)) return; await pause(100); } throw Error(expression); };
    await send('Runtime.enable');
    for (const width of [390, 1440]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 600 });
        await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}` });
        await until('document.querySelector("button[aria-label^=Enlarge] img")?.naturalWidth===700');
        await evaluate('[...document.querySelectorAll("button[aria-label^=Enlarge] img")].forEach(i=>i.loading="eager")');
        await until('[...document.querySelectorAll("button[aria-label^=Enlarge] img")].every(i=>i.naturalWidth===700)');
        assert(await evaluate('[...document.querySelectorAll("button[aria-label^=Enlarge] img")].every(i=>Math.abs(i.getBoundingClientRect().height/i.getBoundingClientRect().width-2)<0.01)'), 'hero and secondary letters retain portrait proportions');
        assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'), 'page fits mobile/desktop viewport');
        await evaluate('document.querySelector("button[aria-label^=Enlarge]").click()');
        await until('document.querySelector("[role=dialog] img")?.naturalWidth===700');
        assert(await evaluate('!new URL(document.querySelector("[role=dialog] img").src).searchParams.has("w")'), 'viewer loads original, not thumbnail');
        const originalWidth = await evaluate('document.querySelector("[role=dialog] img").getBoundingClientRect().width');
        await evaluate(`document.querySelector('button[aria-label="Zoom in"]').click()`);
        await until('document.querySelector("[aria-live=polite]")?.textContent==="150%"');
        assert((await evaluate('document.querySelector("[role=dialog] img").getBoundingClientRect().width')) > originalWidth * 1.4, 'zoom changes actual image size');
        assert(await evaluate(`document.querySelector('[aria-label="Image viewing area"]').scrollWidth>document.querySelector('[aria-label="Image viewing area"]').clientWidth`), 'enlarged image can be panned');
        await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="Fit width").click()');
        await until('document.querySelector("[aria-live=polite]")?.textContent==="100%"');
        if (process.env.TEST_ARTIFACTS) { const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(path.join(process.env.TEST_ARTIFACTS, `news-letter-${width}.png`), Buffer.from(shot.result.data, 'base64')); }
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        await until('!document.querySelector("[role=dialog]")');
        assert(await evaluate('document.activeElement?.getAttribute("aria-label")?.startsWith("Enlarge")'), 'focus returns to image trigger');
    }
    assert.deepEqual(errors, []);
    assert(imageRequests.includes('/uploads/letter.svg'));
    console.log('PASS: full portrait letters, original source, zoom/scroll/reset, Escape/focus return, mobile and desktop layouts.');
    await send('Browser.close');
} finally {
    ws?.close(); chrome?.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    if (path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep + 'activ-news-image-')) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
