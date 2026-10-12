import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'activ-event-lifecycle-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let bundle = '', css = '', chrome, ws;
const server = http.createServer((req, res) => {
    if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
    if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
    res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
    try {
        const assets = await readdir(path.join(root, 'dist/assets'));
        css = await readFile(path.join(root, 'dist/assets', assets.find(file => /^index-.*\.css$/.test(file))), 'utf8');
    } catch { /* Functional verification does not require an existing build. */ }
    const fixtures = { name: 'fixture-api', setup(b) {
        b.onResolve({ filter: /^@\/services\/(cmsApi|activApi)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
        b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'js', contents: args.path.endsWith('activApi')
            ? 'export const getRegionTree=async()=>({states:[]});'
            : 'export const EMPTY_MEDIA={url:"",type:"image",fit:"cover",position:"center"};export const peekCmsCache=key=>key==="home"?window.home:key==="events"?window.events:[]; export const getHome=async()=>window.home;export const getHomeGallery=async()=>[];export const getCmsEvents=async()=>window.events;' }));
    } };
    const built = await build({ absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', plugins: [fixtures], define: { 'import.meta.env': '{"DEV":true}', 'process.env.NODE_ENV': '"test"' }, stdin: { resolveDir: root, loader: 'tsx', contents: `
        import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';
        import {CarouselSection} from './src/pages/onboarding/components/CarouselSection';
        import {EventsExplorer} from './src/pages/onboarding/components/EventsExplorer';
        window.clock=Date.parse('2026-10-12T10:00:00+05:30');Date.now=()=>window.clock;
        const image='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="450"><rect width="1000" height="450" fill="#17336c"/></svg>');
        const event=(id,title,startAt,endAt)=>({id,slug:id,title,startAt,endAt,status:'published',category:'Conference',showInBanner:true,registrationEnabled:true,bannerHeadline:title,media:{url:image,type:'image',fit:'contain'},imageUrl:image});
        window.events=[event('ended','Already ended fixture','2026-10-10T09:00:00+05:30','2026-10-10T17:00:00+05:30'),event('live','Running fixture','2026-10-12T09:00:00+05:30','2026-10-12T11:00:00+05:30'),event('future','Future fixture','2026-10-23T09:00:00+05:30','2026-10-23T17:00:00+05:30')];
        window.home={carousel:{slides:[],galleryPosters:{enabled:false},highlightCard:{enabled:false}},sections:[]};
        createRoot(document.getElementById('root')).render(<MemoryRouter><div id="hero"><CarouselSection/></div><div id="explorer"><EventsExplorer events={window.events} settings={{categories:[]}}/></div></MemoryRouter>);
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
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}` });
    await until('document.querySelector("#hero")?.textContent.includes("Running fixture")');
    assert.equal(await evaluate('document.body.textContent.includes("Already ended fixture")'), false, 'stale cached completed event never appears in hero or upcoming list');
    assert(await evaluate('document.querySelector("#explorer").textContent.includes("Running fixture")'), 'ongoing event stays visible');
    await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="Past Events").click()');
    await until('document.querySelector("#explorer").textContent.includes("Already ended fixture")');
    assert.equal(await evaluate('document.querySelector("#explorer").textContent.includes("Future fixture")'), false);
    await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="Upcoming Events").click()');
    await until('document.querySelector("#explorer").textContent.includes("Future fixture")');
    await evaluate('window.clock=Date.parse("2026-10-12T11:00:00+05:30");window.dispatchEvent(new Event("focus"))');
    await until('!document.querySelector("#hero").textContent.includes("Running fixture")');
    assert.equal(await evaluate('document.querySelector("#explorer").textContent.includes("Running fixture")'), false, 'clock expiry updates the open page without refetching');
    assert(await evaluate('document.querySelector("#hero").textContent.includes("Future fixture")'));
    if (css) assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'), 'mobile fits viewport');
    if (process.env.TEST_ARTIFACTS) { const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); await writeFile(path.join(process.env.TEST_ARTIFACTS, 'event-lifecycle-mobile.png'), Buffer.from(shot.result.data, 'base64')); }
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    assert.deepEqual(errors, []);
    console.log('PASS: cached completed banner hidden, ongoing shown, explicit Past Events only, and clock-based expiry on an open mobile/desktop page.');
    await send('Browser.close');
} finally {
    ws?.close(); chrome?.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    if (path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep + 'activ-event-lifecycle-')) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
