import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import loadConfig from 'tailwindcss/loadConfig.js';

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
    // Compile only test styles so responsive assertions use the current classes.
    css = (await postcss([tailwind(loadConfig(path.join(root, 'tailwind.config.ts')))])
        .process(await readFile(path.join(root, 'src/index.css'), 'utf8'), { from: path.join(root, 'src/index.css') })).css;
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
        createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/events?period=past']}><div id="hero"><CarouselSection/></div><div id="explorer"><EventsExplorer events={window.events} settings={{categories:['Conference','Workshops','Networking','Exhibitions','Training','Webinars','Medical','Food Processing'].map(label=>({label,icon:''}))}}/></div></MemoryRouter>);
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
    assert.equal(await evaluate('document.querySelector("#explorer").textContent.includes("Past Events")'), false, 'no public past-events control, even with an old period=past link');
    await evaluate('document.querySelector("button[aria-controls=event-filter-fields]").click()');
    await until('document.querySelector("button[aria-controls=event-filter-fields]").getAttribute("aria-expanded")==="true"');
    await evaluate('document.querySelector("select[aria-label=\\"Online or in person\\"]").value="online";document.querySelector("select[aria-label=\\"Online or in person\\"]").dispatchEvent(new Event("change",{bubbles:true}))');
    await until('!document.querySelector("#explorer").textContent.includes("Future fixture")');
    await evaluate('[...document.querySelectorAll("#explorer button")].find(b=>b.textContent.trim()==="Reset").click()');
    await until('document.querySelector("#explorer").textContent.includes("Future fixture")');
    await evaluate('window.clock=Date.parse("2026-10-12T11:00:00+05:30");window.dispatchEvent(new Event("focus"))');
    await until('!document.querySelector("#hero").textContent.includes("Running fixture")');
    assert.equal(await evaluate('document.querySelector("#explorer").textContent.includes("Running fixture")'), false, 'clock expiry updates the open page without refetching');
    assert(await evaluate('document.querySelector("#hero").textContent.includes("Future fixture")'));
    if (css) assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'), 'mobile fits viewport');
    if (process.env.TEST_ARTIFACTS) { const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); await writeFile(path.join(process.env.TEST_ARTIFACTS, 'event-lifecycle-mobile.png'), Buffer.from(shot.result.data, 'base64')); }
    for (const width of [320, 360, 390, 768, 1024, 1440]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 640 });
        await pause(100);
        assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'), 'no horizontal page overflow at ' + width);
        const controls = await evaluate('[...document.querySelectorAll("#explorer select,#explorer input,#explorer button")].filter(e=>e.offsetWidth&&e.closest("#event-filter-fields, [role=group]")||e.matches("input[type=search]")).map(e=>({font:getComputedStyle(e).fontSize,height:e.getBoundingClientRect().height}))');
        assert(controls.length >= 3);
        assert(controls.every(c => c.font === '16px' && c.height >= 44), 'consistent readable controls and tap targets at ' + width + ': ' + JSON.stringify(controls));
        assert(await evaluate('document.querySelector("#explorer input").clientWidth>200'), 'search never squeezed by dropdowns');
    }
    assert.deepEqual(errors, []);
    console.log('PASS: completed events hidden including old past-event links, ongoing events shown, clock expiry, working filters/reset, and matching controls without overflow at 320/360/390/768/1024/1440px.');
    await send('Browser.close');
} finally {
    ws?.close(); chrome?.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    if (path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep + 'activ-event-lifecycle-')) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
