// Real browser, loopback fixtures only: no CMS or storage writes.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import loadConfig from 'tailwindcss/loadConfig.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'activ-hero-media-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const requests = [], held = new Set();
let bundle = '', css = '', chrome, ws, failSlow = false;
const image = res => { res.setHeader('Content-Type', 'image/svg+xml'); res.end('<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#2266aa"/></svg>'); };
const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
    if (url.pathname === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
    if (url.pathname.startsWith('/uploads/')) {
        requests.push(req.url);
        if (url.pathname.includes('slow') && !failSlow) { held.add(res); return; }
        if (url.pathname.includes('slow') && failSlow) { res.statusCode = 503; return res.end(); }
        if (url.pathname.includes('unavailable') || url.searchParams.has('w')) { res.statusCode = 503; return res.end(); }
        return image(res);
    }
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
    css = (await postcss([tailwind(loadConfig(path.join(root, 'tailwind.config.ts')))]).process(await readFile(path.join(root, 'src/index.css'), 'utf8'), { from: path.join(root, 'src/index.css') })).css;
    const fixtures = { name: 'hero-fixtures', setup(b) {
        b.onResolve({ filter: /^@\/services\/cmsApi$/ }, args => ({ path: args.path, namespace: 'fixture' }));
        b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'js', contents: 'export const EMPTY_MEDIA={url:"",type:"image",fit:"cover",position:"center"};export const peekCmsCache=key=>key==="home"?window.home:[];export const getHome=async()=>window.home;export const getHomeGallery=async()=>[];export const getCmsEvents=async()=>[];' }));
    } };
    bundle = (await build({ absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', plugins: [fixtures], define: { 'import.meta.env': JSON.stringify({ DEV: true, VITE_API_URL: `http://127.0.0.1:${server.address().port}/api/v1` }), 'process.env.NODE_ENV': '"test"' }, stdin: { resolveDir: root, loader: 'tsx', contents: `
        import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';
        import {CarouselSection} from './src/pages/onboarding/components/CarouselSection';
        const root=createRoot(document.getElementById('root'));
        window.mount=(kind='slow')=>{window.home={carousel:{slides:[{media:{url:'/uploads/'+kind+'.png',type:'image',fit:'contain',alt:'First banner'}},{media:{url:'/uploads/original.png',type:'image',fit:'contain',alt:'Second banner'}}],galleryPosters:{enabled:false},highlightCard:{enabled:false}},sections:[]};root.render(<MemoryRouter><CarouselSection key={kind}/></MemoryRouter>)};
        window.mount();
    ` } })).outputFiles[0].text;
    chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=0', '--no-first-run', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
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
    const until = async expression => { for (let i = 0; i < 120; i++) { if (await evaluate(`Boolean(${expression})`)) return; await pause(100); } throw Error(expression); };
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}` });
    await until('document.querySelector("[role=status]")?.textContent.includes("Loading image")');
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 120, y: 200, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 120, y: 200, button: 'left', clickCount: 1 });
    await until('document.querySelector("[role=status]")?.textContent.includes("taking longer")');
    assert.equal(await evaluate('document.querySelector("button[aria-current=true]").getAttribute("aria-label")'), 'Slide 1 of 2', 'autoplay waits beyond six seconds for the pending first image');
    assert.equal(requests.some(url => url.includes('w=320')), false, 'no competing blurred-background rendition requested');
    for (const response of held) image(response); held.clear();
    await until('document.querySelector("img[alt^=First]")?.naturalWidth>0 && !document.querySelector("[role=status]")');
    const sources = await evaluate('[...document.querySelectorAll("img")].map(i=>i.currentSrc)');
    assert(sources.filter(url => url.includes('slow.png')).length === 2, 'loaded mobile background reuses the selected source');
    assert.equal(requests.filter(url => url.includes('slow.png')).length, 1, 'only one network download for foreground and blur');
    failSlow = true;
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 844, deviceScaleFactor: 1, mobile: false });
    // The SVG fixture is resolution-independent, so Chrome can retain it when
    // resized. Deliver the late rendition error explicitly; its original-file
    // retry still goes through the loopback server and receives a real 503.
    await evaluate('document.querySelector("img[alt^=First]").dispatchEvent(new Event("error"))');
    await until('document.querySelector("[role=status]")?.textContent.includes("temporarily unavailable")');
    assert.equal(await evaluate('document.querySelectorAll("img[alt^=First]").length'), 0, 'a later responsive-source failure clears the previous success state');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await evaluate('document.querySelectorAll("button[aria-label^=Slide]")[1].click()');
    await until('document.querySelector("button[aria-current=true]").getAttribute("aria-label")==="Slide 2 of 2"');
    await until('document.querySelector("img[alt^=Second]")?.naturalWidth>0');
    assert(requests.some(url => url.startsWith('/uploads/original.png?w=')) && requests.includes('/uploads/original.png'), 'failed resize retries the original');
    assert.equal(await evaluate('document.querySelector("img[alt^=Second]").getAttribute("fetchpriority")'), 'high', 'current original fallback retains high priority');
    await evaluate('window.mount("unavailable")');
    await until('document.querySelector("[role=status]")?.textContent.includes("temporarily unavailable")');
    for (const width of [320, 390, 768, 1440]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 640 });
        await pause(100);
        assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'), 'no horizontal overflow at ' + width);
        assert(await evaluate('document.querySelector("[role=status]").getBoundingClientRect().height>0'), 'failure text visible at ' + width);
    }
    assert.deepEqual(errors, []);
    console.log('PASS: stalled hero is explained; autoplay waits; recovered image paints; single foreground/background download; resize-to-original recovery and priority; visible failure at 320/390/768/1440px.');
    await send('Browser.close');
} finally {
    ws?.close(); chrome?.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    if (path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep + 'activ-hero-media-')) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
