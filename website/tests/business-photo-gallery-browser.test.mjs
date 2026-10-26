import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'activ-business-photos-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let bundle = '', css = '', chrome, ws;
const server = http.createServer((req, res) => {
    if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
    if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
    if (req.url.startsWith('/uploads/')) {
        if (req.url.includes('broken')) { res.statusCode = 404; return res.end(); }
        const portrait = req.url.includes('portrait');
        res.setHeader('Content-Type', 'image/svg+xml');
        return res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="${portrait ? 700 : 1200}" height="${portrait ? 1400 : 500}"><rect width="100%" height="100%" fill="${portrait ? '#daf1ff' : '#eedbfa'}"/><text x="40" y="80" font-size="36">Business photo</text><text x="40" y="${portrait ? 1350 : 450}" font-size="28">Bottom of complete photo</text></svg>`);
    }
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
    const assets = await readdir(path.join(root, 'dist/assets'));
    css = await readFile(process.env.TEST_CSS || path.join(root, 'dist/assets', assets.find(file => /^index-.*\.css$/.test(file))), 'utf8');
    const fixtures = { name: 'business-photo-fixtures', setup(b) {
        const names = ['@/services/activApi', '@/services/memberHubApi', '@/lib/session', './BusinessPageShell', '@/contexts/ActiveCompanyContext'];
        b.onResolve({ filter: /.*/ }, args => names.includes(args.path) ? { path: args.path, namespace: 'fixture' } : undefined);
        b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'tsx', resolveDir: root, contents:
            args.path === './BusinessPageShell' ? 'export default function Shell({children,title,actions}) {return <main style={{maxWidth:1080,margin:"auto",padding:16}}><h1>{title}</h1>{actions}{children}</main>}' :
            args.path === '@/lib/session' ? 'export const isMemberSession=()=>true;' :
            args.path === '@/services/memberHubApi' ? 'export const recordProductView=async id=>{window.views.push(id)};' :
            args.path === '@/contexts/ActiveCompanyContext' ? 'const loadCompanies=()=>{};export const useActiveCompanyStore=()=>({activeCompany:window.fixture,activeCompanyId:window.fixture._id,hasLoaded:true,loadCompanies,setActiveCompany:()=>{}});' :
            `export const getPublicCompany=async()=>window.fixture; export const addToTrustList=async()=>({});export const removeFromTrustList=async()=>({});export const errorMessage=e=>e.message;
             export const apiFetch=async url=>{
                 if(url.startsWith('/products/stats')){
                     if(window.statsFailure)throw Error('Offline fixture');
                     const id=new URL(url,window.location.origin).searchParams.get('companyId');
                     const data=window.companyStats?.[id]||{total:4,active:4,featured:0,trustedBy:7};
                     if(window.deferStatsFor===id){
                         await new Promise(resolve=>{window.deferredStatsPending=id;window.releaseDeferredStats=resolve;});
                         window.deferredStatsReturned=id;
                     }
                     return {json:async()=>({success:true,data})};
                 }
                 const company=window.companyFixtures?.[url.split('/').pop()]||window.fixture;
                 return {json:async()=>({success:true,data:url.startsWith('/products?')?window.fixture.products:company})};
             };`
        }));
    } };
    const built = await build({ absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', plugins: [fixtures], define: {
        'import.meta.env': JSON.stringify({ DEV: true, VITE_API_URL: `http://127.0.0.1:${server.address().port}/api/v1` }), 'process.env.NODE_ENV': '"test"',
    }, stdin: { resolveDir: root, loader: 'tsx', contents: `
        import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,Routes,Route,useNavigate} from 'react-router-dom';
        import Public from './src/pages/business/CompanyPublicView';import Products from './src/pages/business/Products';import Details from './src/pages/business/CompanyDetails';
        const media=name=>window.location.origin+'/uploads/'+name+'.svg';window.views=[];
        window.fixture={_id:'company-one',businessName:'Example Engineering',businessType:'Manufacturing',description:'Product catalogue',logo:media('logo'),banner:media('banner'),isOwner:false,isActive:true,status:'active',products:[
            {_id:'portrait',name:'Portrait catalogue',imageUrl:media('portrait'),description:'A complete product sheet',companyId:'company-one',price:100},
            {_id:'wide',name:'Wide product',imageUrl:media('wide'),description:'Landscape photo',companyId:'company-one',price:200},
            {_id:'no-photo',name:'Consulting',companyId:'company-one'},
            {_id:'broken',name:'Unavailable photo',imageUrl:media('broken'),companyId:'company-one'}]};
        const app=createRoot(document.getElementById('root'));let revision=0;
        function NavigationProbe(){const navigate=useNavigate();React.useEffect(()=>{window.navigateInPlace=navigate},[navigate]);return null}
        function DetailsProbe(){React.useEffect(()=>{window.detailsMountCount=(window.detailsMountCount||0)+1},[]);return <Details/>}
        window.showPage=page=>app.render(<MemoryRouter key={++revision} initialEntries={[page]}><NavigationProbe/><Routes>
            <Route path="/network/company/:id" element={<Public/>}/><Route path="/business/products" element={<Products/>}/><Route path="/business/companies/:id" element={<DetailsProbe/>}/>
        </Routes></MemoryRouter>);window.showPage('/network/company/company-one');
    ` } });
    bundle = built.outputFiles[0].text;
    chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    let port;
    for (let i = 0; i < 100; i++) { try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch {} await pause(100); }
    assert(port, 'Chrome starts');
    const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
    ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise(resolve => ws.addEventListener('open', resolve));
    let seq = 0; const pending = new Map(), errors = [];
    ws.addEventListener('message', event => { const m = JSON.parse(event.data); if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text); pending.get(m.id)?.(m); pending.delete(m.id); });
    const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq, timer = setTimeout(() => reject(Error(method)), 20000); pending.set(id, r => { clearTimeout(timer); if(r.error) reject(Error(method + ": " + JSON.stringify(r.error))); else resolve(r); }); ws.send(JSON.stringify({ id, method, params })); });
    const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw Error(r.result.exceptionDetails.exception?.description); return r.result?.result?.value; };
    const until = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(`Boolean(${expression})`)) return; await pause(100); } throw Error(expression + "\n" + await evaluate("document.body.innerText.slice(0,1500)") + "\n" + JSON.stringify(errors)); };
    const click = label => evaluate(`{const b=document.querySelector('button[aria-label=${JSON.stringify(label)}]');b.focus();b.click()}`);
    const key = async (key, code, windowsVirtualKeyCode, modifiers = 0) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode, modifiers }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode, modifiers }); };
    const close = async () => { await key('Escape', 'Escape', 27); await until('!document.querySelector("[role=dialog]")'); };
    await send('Runtime.enable');
    for (const width of [1440, 390]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 600 });
        await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}` });
        await until('document.querySelector("button[aria-label=\\\"Open photo: Portrait catalogue\\\"]")');
        await click('Open photo: Portrait catalogue');
        await until('document.querySelector("[aria-label=\\\"Image viewing area\\\"] img")?.naturalWidth===700');
        await pause(250);
        assert(await evaluate('document.querySelector("[role=dialog]").innerText.includes("Photo 3 of 5")'), 'selected product opens correct position including company photos');
        const bounds = await evaluate(`(()=>{const img=document.querySelector('[aria-label="Image viewing area"] img'),a=img.closest('[aria-label="Image viewing area"]');return {w:img.getBoundingClientRect().width,h:img.getBoundingClientRect().height,aw:a.clientWidth,ah:a.clientHeight,src:img.src}})()`);
        assert(Math.abs(bounds.h / bounds.w - 2) < 0.01, 'original portrait proportions');
        assert(bounds.h <= bounds.ah + 1 && bounds.w <= bounds.aw + 1, 'entire photo fits before zoom');
        assert(!new URL(bounds.src).searchParams.has('w'), 'viewer uses original upload');
        await click('Zoom in');
        await until('document.querySelector("[aria-label=\\\"Zoom level\\\"]").textContent==="150%"');
        assert((await evaluate('document.querySelector("[aria-label=\\\"Image viewing area\\\"] img").getBoundingClientRect().height')) > bounds.h * 1.4, 'zoom changes image size');
        assert(await evaluate(`(()=>{const a=document.querySelector('[aria-label="Image viewing area"]');return a.scrollHeight>a.clientHeight})()`), 'zoomed photo scrolls');
        await evaluate('window.dispatchEvent(new Event("focus"))');
        assert.equal(await evaluate('document.querySelector("output").textContent'), '150%', 'background refresh preserves open album and zoom');
        const point = await evaluate(`(()=>{const a=document.querySelector('[aria-label="Image viewing area"]');a.scrollTop=0;const r=a.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
        await send('Page.bringToFront');
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', buttons: 1, clickCount: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y - 80, button: 'left', buttons: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y - 80, button: 'left', clickCount: 1 });
        assert((await evaluate('document.querySelector("[aria-label=\\\"Image viewing area\\\"]").scrollTop')) > 50, 'drag actually pans zoomed image');
        await click('Zoom out');
        await until('document.querySelector("[aria-label=\\\"Zoom level\\\"]").textContent==="100%"');
        assert(await evaluate('document.querySelector("button[aria-label=\\\"Zoom out\\\"]").disabled'), 'zoom has lower bound');
        await click('Zoom in');
        await key('ArrowRight', 'ArrowRight', 39);
        await until('document.querySelector("[aria-label=\\\"Image viewing area\\\"] img")?.alt==="Wide product"');
        assert.equal(await evaluate('document.querySelector("[aria-label=\\\"Zoom level\\\"]").textContent'), '100%', 'navigation resets zoom');
        assert.deepEqual(await evaluate('window.views'), ['portrait', 'wide'], 'view analytics records products, once per visit');
        await click('View photo 5: Unavailable photo');
        await until('document.querySelector("[role=alert]")');
        await click('Next photo');
        await until('document.querySelector("[aria-label=\\\"Image viewing area\\\"] img")?.alt==="Example Engineering cover"');
        assert(await evaluate('!document.querySelector("[role=alert]")'), 'navigation recovers from missing photo and wraps');
        await key('Tab', 'Tab', 9);
        assert(await evaluate('document.querySelector("[role=dialog]").contains(document.activeElement)'), 'Tab focus remains inside viewer');
        await close();
        await until('document.activeElement.getAttribute("aria-label")==="Open photo: Portrait catalogue"');
        assert.equal(await evaluate('document.activeElement.getAttribute("aria-label")'), 'Open photo: Portrait catalogue', 'focus returns to exact trigger');
        await evaluate('[...document.querySelectorAll("nav[aria-label=\\\"Company sections\\\"] button")].find(b=>b.textContent.startsWith("Photos")).click()');
        await until('document.querySelectorAll("button[aria-label^=\\\"Open photo:\\\"]").length===5');
        assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'), 'album grid fits viewport');
        await click('Open photo: Portrait catalogue');
        await until('document.querySelector("[role=dialog]")');
        if (process.env.TEST_ARTIFACTS) { const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(path.join(process.env.TEST_ARTIFACTS, `business-album-${width}.png`), Buffer.from(shot.result.data, 'base64')); }
        await close();
    }

    await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: true });
    await click('Open photo: Portrait catalogue');
    await until('document.querySelector("[aria-label=\\\"Image viewing area\\\"] img")?.naturalWidth===700');
    assert((await evaluate('document.querySelector("[aria-label=\\\"Image viewing area\\\"]").clientHeight')) >= 140, 'landscape leaves usable space for the image');
    assert(await evaluate('document.querySelector("[role=dialog]").scrollHeight <= innerHeight'), 'landscape controls stay within screen');
    if (process.env.TEST_ARTIFACTS) { const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(path.join(process.env.TEST_ARTIFACTS, 'business-album-landscape.png'), Buffer.from(shot.result.data, 'base64')); }
    await close();
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 844, deviceScaleFactor: 1, mobile: false });
    await evaluate('window.showPage("/business/products")');
    await until('document.querySelector("button[aria-label=\\\"Open photo: Wide product\\\"]")');
    for (const mode of ['Grid view', 'List view']) {
        await click(mode);
        await until(mode === 'List view' ? 'document.querySelector("table")' : '!document.querySelector("table")');
        await click('Open photo: Wide product');
        await until('document.querySelector("[role=dialog]")');
        assert(await evaluate('document.querySelector("[role=dialog]").innerText.includes("Photo 2 of 3")'), `${mode} uses catalogue-only album`);
        await close();
    }
    await evaluate('window.showPage("/business/companies/company-one")');
    await until('document.body.innerText.includes("Trusted by") && document.body.innerText.toLowerCase().includes("members")');
    assert(await evaluate('[...document.querySelectorAll("span")].find(e=>e.textContent==="Trusted by").parentElement.parentElement.innerText.includes("7")'), 'owner company displays API trust count');
    await click('Open company logo photo');
    await until('document.querySelector("[aria-label=\\\"Image viewing area\\\"] img")?.alt==="Example Engineering logo"');
    await close();
    await evaluate('window.statsFailure=true;window.showPage("/business/companies/company-one")');
    await until('document.body.innerText.toLowerCase().includes("unavailable")');
    assert(await evaluate('[...document.querySelectorAll("span")].find(e=>e.textContent==="Trusted by").parentElement.parentElement.innerText.includes("—")'), 'failed stats never fabricate zero trust');

    // Navigate within the mounted details route while the previous stats are in flight.
    // A keyed remount would hide the stale-response bug this regression exercises.
    await evaluate(`window.statsFailure=false;
        window.companyFixtures={
            'company-alpha':{...window.fixture,_id:'company-alpha',businessName:'Alpha Engineering'},
            'company-beta':{...window.fixture,_id:'company-beta',businessName:'Beta Engineering'}
        };
        window.companyStats={
            'company-alpha':{total:98,active:98,featured:0,trustedBy:99},
            'company-beta':{total:21,active:21,featured:0,trustedBy:2}
        };
        window.readStat=label=>[...document.querySelectorAll('span')].find(e=>e.textContent===label)?.parentElement.nextElementSibling?.textContent;
        window.deferStatsFor='company-alpha';window.showPage('/business/companies/company-alpha');`);
    await until('window.deferredStatsPending==="company-alpha" && document.body.innerText.includes("Alpha Engineering")');
    const detailsMountCount = await evaluate('window.detailsMountCount');
    await evaluate('window.navigateInPlace("/business/companies/company-beta")');
    await until('document.body.innerText.includes("Beta Engineering") && window.readStat("Trusted by")==="2"');
    assert.equal(await evaluate('window.detailsMountCount'), detailsMountCount, 'company ID changes reuse the mounted details route');
    await evaluate('window.releaseDeferredStats(); void 0');
    await until('window.deferredStatsReturned==="company-alpha"');
    await pause(100);
    assert.equal(await evaluate('window.readStat("Trusted by")'), '2', 'late Alpha stats cannot replace Beta trust count');
    assert.equal(await evaluate('window.readStat("Catalog Products")'), '21', 'late Alpha stats cannot replace Beta catalogue count');
    assert(await evaluate('document.body.innerText.includes("Beta Engineering") && !document.body.innerText.includes("Alpha Engineering")'), 'company identity remains Beta after the late response');

    await evaluate('window.fixture={...window.fixture,banner:"",products:[]};window.showPage("/network/company/company-one")');
    await until('document.querySelector("button[aria-label=\\\"Open company logo photo\\\"]")');
    await click('Open company logo photo');
    await until('document.querySelector("[role=dialog]")');
    assert(await evaluate('document.querySelector("button[aria-label=\\\"Next photo\\\"]").disabled && document.querySelector("button[aria-label=\\\"Previous photo\\\"]").disabled'), 'single-photo album disables navigation');
    await key('+', 'Equal', 187, 8);
    await until('document.querySelector("output").textContent==="150%"');
    await key('0', 'Digit0', 48);
    await until('document.querySelector("output").textContent==="100%"');
    await close();
    await evaluate('window.fixture={...window.fixture,logo:""};window.showPage("/network/company/company-one")');
    await until('document.querySelector("nav[aria-label=\\\"Company sections\\\"]")');
    await evaluate('[...document.querySelectorAll("nav button")].find(b=>b.textContent.startsWith("Photos")).click()');
    await until('document.body.innerText.includes("No photos have been added yet.")');
    assert(await evaluate('!document.querySelector("[role=dialog]")'), 'empty album does not open an invalid viewer');
    assert.deepEqual(errors, []);
    console.log('PASS: business photo album, original portrait fit, zoom/pan/reset, keyboard navigation, missing photo recovery, focus return, responsive grid, owner catalogue grid/list, trust count/failure and stale company stats isolation.');
    await send('Browser.close');
} finally {
    ws?.close(); chrome?.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    if (path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep + 'activ-business-photos-')) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
