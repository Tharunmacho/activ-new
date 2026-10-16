// Actual public/member components and current production CSS, served only from
// loopback with synthetic CMS/member records. This is a browser layout check.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const artifacts = path.resolve(root, '../artifacts');
const output = process.env.TEST_ARTIFACTS ? path.resolve(process.env.TEST_ARTIFACTS) : null;
const fontsDirectory = process.env.TEST_FONTS_DIR ? path.resolve(process.env.TEST_FONTS_DIR) : artifacts;
const profile = await mkdtemp(path.join(tmpdir(), 'activ-website-type-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
// Immutable source reference: b0111a3, 15 Oct 2026 12:11 IST, before the
// typography replacements. Px declarations stay px; rem declarations follow
// that version's 14px phone root and 16px ordinary desktop root.
const baseline = 'b0111a3';
const expectedRoot = width => width < 640 ? 14 : 16;
const rem = (width, value) => expectedRoot(width) * value;
const expectations = (kind, width) => kind.endsWith('-dialog') ? {
  '[data-baseline-dialog-title]': [rem(width, 1.375), 600],
  '[role="dialog"] label': [rem(width, 1.1875), 500],
  '[role="dialog"] input': [width < 640 ? 16 : width >= 768 ? 19 : 20, 400],
  '[data-baseline-dialog-action]': [rem(width, 1.1875), 500],
} : kind === 'public' ? {
  'section.dot-band h2': [Math.max(rem(width,2.1875),Math.min(rem(width,3.75),rem(width,1.35)+width*.037)), 900],
  'section.dot-band .text-gray-600': [rem(width,width>=768?1.75:1.3125), 600],
  '.activ-app-promo p': [17, 400],
  '.activ-app-promo__features': [14, 500],
  '.activ-play-button small': [11, 600],
  '.activ-app-promo__switcher button': [width < 640 ? 12 : 13, 600],
} : kind === 'public-menu' ? {
  '[aria-label="Menu"] nav a': [rem(width, 1.0625), 700],
  '[aria-label="Menu"] a[href^="mailto:"]': [rem(width, .95), 600],
} : kind === 'member' ? {
  '.dashboard-welcome__message': [width <= 480 ? 16 : 17, 400],
  '.dashboard-member-card__dates strong': [width <= 380 ? 14 : 15, 600],
  '.dashboard-membership__facts dd': [15, 600],
  '.dashboard-membership__details': [15, 600],
} : kind === 'lifetime' ? {
  '.platinum-welcome__copy': [rem(width, width < 640 ? 1 : 1.0625), 400],
  '.platinum-card__holder': [rem(width, .8125), 600],
  '.platinum-action__label': [rem(width, .9375), 600],
  '.platinum-action__detail': [rem(width, .8125), 400],
} : {
  '[data-baseline-admin] h1': [rem(width, width < 640 ? 1.5 : 2.5), 600],
  '[data-admin-stat-label]': [rem(width,width<640?1:1.25), 800],
  '[data-admin-stat-hint]': [rem(width,width<640?.875:1.1875), 400],
  '[data-baseline-admin] p.tabular-nums': [rem(width,width<640?1.625:3.375), 800],
  '[data-baseline-admin-action]': [rem(width, 1.25), 700],
  '[data-baseline-admin-input]': [width < 640 ? 16 : 20, 400],
};
const publicFiles = new Set(['/logo_ACTIVian-removebg-preview.png', ...['home', 'events', 'gallery', 'news', 'zones'].map(key => `/app/activ-android-${key}.png`)]);
const site = { brand: { fullName: 'Adidravidar Confederation of Trade and Industrial Vision', logo: { url: '/logo_ACTIVian-removebg-preview.png', type: 'image', alt: 'ACTIV', fit: 'contain' } },
  header: { navLinks: [['Home', '/'], ['About', '/about'], ['Membership', '/membership'], ['Events', '/events'], ['News', '/news'], ['Gallery', '/gallery'], ['Schemes', '/schemes'], ['Contact', '/contact']].map(([label, href]) => ({ label, href })), ctaLabel: 'Login', ctaHref: '/login' },
  footer: { phones: ['+919000000000'], email: 'fixture@example.test', socialLinks: [] }, sections: [] };
let chrome, ws, bundle = '', css = '', localPoppins = false;
const errors = [], unexpectedRequests = [], remoteRequests = [], layouts = [], failures = [];
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
    if (url.pathname === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
    if (/^\/font-restore-poppins-[0-5]\.ttf$/.test(url.pathname)) { res.setHeader('Content-Type', 'font/ttf'); return res.end(await readFile(path.join(fontsDirectory, url.pathname.slice(1)))); }
    if (publicFiles.has(url.pathname)) { res.setHeader('Content-Type', 'image/png'); return res.end(await readFile(path.join(root, 'public', url.pathname.slice(1)))); }
    if (url.pathname.startsWith('/api/')) {
      res.setHeader('Content-Type', 'application/json');
      const data = url.pathname.endsWith('/cms/site') ? site
        : url.pathname.endsWith('/cms/contact-info') ? { phone: '+919000000000', email: 'fixture@example.test', social: {}, offices: [] }
        : url.pathname.endsWith('/cms/regions/map') ? { regions: [{ slug: 'south', name: 'Southern Region', zone: 'south', published: true, states: [{ name: 'Tamil Nadu', slug: 'tamil-nadu', published: true }] }] }
        : url.pathname.endsWith('/cms/schemes/states') ? [{ state: 'Tamil Nadu', total: 2 }] : undefined;
      if (data === undefined) { unexpectedRequests.push(req.url); res.statusCode = 404; }
      return res.end(JSON.stringify({ success: data !== undefined, data }));
    }
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'");
    res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  } catch (error) { errors.push(error.message); res.statusCode = 500; res.end(error.message); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  if (output) await mkdir(output, { recursive: true });
  const assets = process.env.TEST_CSS ? [] : await readdir(path.join(root, 'dist/assets'));
  const cssFile = process.env.TEST_CSS ? path.resolve(process.env.TEST_CSS) : assets.find(file => /^index-.*\.css$/.test(file));
  assert(cssFile, 'Run the production website build before the layout fixture');
  css = await readFile(process.env.TEST_CSS ? cssFile : path.join(root, 'dist/assets', cssFile), 'utf8');
  localPoppins = await Promise.all(Array.from({ length: 6 }, (_, i) => readFile(path.join(fontsDirectory, `font-restore-poppins-${i}.ttf`)))).then(() => true, () => false);
  if (process.env.TEST_FONTS_DIR) assert(localPoppins, 'Explicit font directory must contain all six Poppins files');
  if (localPoppins) for (let i = 0; i < 6; i++) css += `\n@font-face{font-family:Poppins;font-style:normal;font-weight:${400 + i * 100};src:url('/font-restore-poppins-${i}.ttf') format('truetype');font-display:block}`;
  const built = await build({ absWorkingDir: root, bundle: true, write: false, outdir: 'typography-fixture', format: 'iife', platform: 'browser', jsx: 'automatic', loader: { '.svg': 'dataurl' },
    define: { 'import.meta.env': JSON.stringify({ DEV: true, VITE_API_URL: `http://127.0.0.1:${server.address().port}/api/v1` }), 'process.env.NODE_ENV': '"test"' },
    stdin: { resolveDir: root, loader: 'tsx', contents: `
      import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter} from 'react-router-dom';
      import {HeaderSection} from './src/components/layout/HeaderSection';import {AboutBlock} from './src/components/shared/AboutBlock';import AppDownloadPromotion from './src/components/shared/AppDownloadPromotion';
      import DashboardWelcome from './src/features/member/components/DashboardWelcome';import DashboardMembership,{DashboardMembershipReview} from './src/features/member/components/DashboardMembership';import PlatinumWelcome from './src/features/member/components/PlatinumWelcome';
      import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter,DialogClose} from './src/components/ui/dialog';import {Button} from './src/components/ui/button';import {Input} from './src/components/ui/input';import {Label} from './src/components/ui/label';
      import {AdminPageHeader,AdminStat,ADMIN_PRIMARY_BTN,ADMIN_INPUT} from './src/features/admin/components/AdminUI';
      const member=location.pathname==='/member',lifetime=location.pathname==='/lifetime',admin=location.pathname==='/admin';
      function Fixture(){const [open,setOpen]=useState(false);const onPlan=()=>setOpen(true);return <><HeaderSection/><main data-mounted style={{maxWidth:1440,margin:'auto',padding:16,display:'grid',gap:24}}>
        {member?<><div className='dashboard-overview'><div className='dashboard-overview__cards'><DashboardWelcome name='Alexandra Krishnamurthy' greeting='Good evening' date='15 October 2026' day='Thursday' plan='Business Membership' applicationRef='ACTIV-APPLICATION-2026-123456' memberSince='15 October 2026' region='Chennai, Tamil Nadu' lifetime={false} avatar={<span aria-hidden style={{width:56,height:56,borderRadius:28,background:'#dbeafe',flexShrink:0}}/>}/><DashboardMembership name='Alexandra Krishnamurthy' plan='Business Membership' membershipLabel='Annual membership' memberId='ACTIV/TN/2026/123456789' since='15/10/2026' validUntil='15/10/2027' active status='Active' lifetime={false} details={[{label:'Member',value:'Alexandra Krishnamurthy'},{label:'Region',value:'Chennai, Tamil Nadu'}]} onPlan={onPlan}/></div></div><DashboardMembershipReview lifetime={false} onPlan={onPlan} onUpgrade={onPlan}/></>
        :lifetime?<PlatinumWelcome name='Alexandra Krishnamurthy' greeting='Good evening' memberId='ACTIV/TN/LIFE/123456789' memberSince='15 October 2026' region='Chennai, Tamil Nadu' active onPlan={onPlan} onBusiness={onPlan} onDocuments={onPlan} onReceipt={onPlan}/>
        :admin?<section data-baseline-admin><AdminPageHeader title='Membership registrations' subtitle='Registered accounts and membership payments.' actions={<button data-baseline-admin-action className={ADMIN_PRIMARY_BTN} onClick={onPlan}>View membership</button>}/><div style={{padding:16,display:'grid',gap:16}}><AdminStat label='Registered' value='24' hint='Applications submitted'/><input data-baseline-admin-input aria-label='Search membership' className={ADMIN_INPUT} placeholder='Search members'/></div></section>
        :<><AboutBlock badgeText='Our association' heading='Opportunity through' headingHighlight='community' body='<p>Connect with members, discover events and build lasting business relationships across India.</p><p>Membership brings our community closer through shared knowledge and opportunity.</p>'/><AppDownloadPromotion/></>}
        <section data-type-probes aria-label='Typography reference' style={{display:'flex',flexWrap:'wrap',gap:12}}><span data-type='xs' className='text-xs'>Caption</span><span data-type='sm' className='text-sm'>Small</span><span data-type='base' className='text-base'>Body</span><span data-type='lg' className='text-lg'>Large</span><span data-type='xl' className='text-xl'>Title</span><span data-type='2xl' className='text-2xl'>Heading</span></section>
        </main><Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle data-baseline-dialog-title>Membership details</DialogTitle><DialogDescription>Review your contact information and membership preferences.</DialogDescription></DialogHeader><Label htmlFor='fixture-name'>Full name</Label><Input id='fixture-name' defaultValue='Alexandra Krishnamurthy'/><DialogFooter><DialogClose asChild><Button data-baseline-dialog-action variant='outline'>Close details</Button></DialogClose><Button onClick={()=>setOpen(false)}>Save preferences</Button></DialogFooter></DialogContent></Dialog></>}
      createRoot(document.getElementById('root')).render(<BrowserRouter><Fixture/></BrowserRouter>);
    ` } });
  bundle = built.outputFiles.find(file => file.path.endsWith('.js')).text;
  css += '\n' + built.outputFiles.filter(file => file.path.endsWith('.css')).map(file => file.text).join('\n');
  chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--disable-extensions', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let port; for (let i = 0; i < 150; i++) { try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch {} await pause(100); }
  assert(port, 'Chrome started');
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve));
  let seq = 0; const pending = new Map();
  ws.addEventListener('message', event => { const value = JSON.parse(event.data); if (value.method === 'Runtime.exceptionThrown') errors.push(value.params.exceptionDetails.text); if (value.method === 'Network.requestWillBeSent' && /^https?:/.test(value.params.request.url) && !value.params.request.url.startsWith(`http://127.0.0.1:${server.address().port}/`)) remoteRequests.push(value.params.request.url); pending.get(value.id)?.(value); pending.delete(value.id); });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq, timer = setTimeout(() => {pending.delete(id);reject(Error(method));}, 20000); pending.set(id, value => { clearTimeout(timer); value.error ? reject(Error(value.error.message)) : resolve(value); }); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const value = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (value.result?.exceptionDetails) throw Error(value.result.exceptionDetails.text); return value.result?.result?.value; };
  const until = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await pause(80); } throw Error(expression); };
  const visibleButton = text => `[...document.querySelectorAll('button')].find(e=>e.getBoundingClientRect().width>0&&e.textContent.trim()===${JSON.stringify(text)})`;
  await send('Runtime.enable'); await send('Network.enable');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  const record = async (kind, width) => {
    const expected=expectations(kind,width),selectors=Object.keys(expected);
    const result = await evaluate(`(()=>{const box=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};return {scrollWidth:document.documentElement.scrollWidth,width:innerWidth,rootSize:parseFloat(getComputedStyle(document.documentElement).fontSize),bodySize:parseFloat(getComputedStyle(document.body).fontSize),bodyFamily:getComputedStyle(document.body).fontFamily,poppinsLoaded:document.fonts.check('400 16px Poppins'),probes:[...document.querySelectorAll('[data-type]')].map(e=>({type:e.dataset.type,size:parseFloat(getComputedStyle(e).fontSize)})),fonts:${JSON.stringify(selectors)}.map(s=>{const e=document.querySelector(s);return {selector:s,size:e?parseFloat(getComputedStyle(e).fontSize):null,weight:e?Number(getComputedStyle(e).fontWeight):null,family:e?getComputedStyle(e).fontFamily:null,bounds:e?box(e):null,clientWidth:e?.clientWidth,scrollWidth:e?.scrollWidth}}),controls:[...document.querySelectorAll('button,a,input')].filter(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().height&&!e.closest('[aria-hidden="true"]')).filter(e=>e.getBoundingClientRect().left < -1||e.getBoundingClientRect().right > innerWidth+1).map(e=>({text:e.textContent?.trim().slice(0,80),...box(e)}))}})()`);
    layouts.push({kind,width,expectedFonts:expected,...result});
    result.header = await evaluate(`(()=>{const home=document.querySelector('header a[aria-label="ACTIV home"]'),logo=home?.querySelector('img'),name=home&&[...home.children].find(e=>e.textContent.trim()),login=document.querySelector('header a[href="/login"]'),toggle=document.querySelector('header button[aria-expanded]');if(!logo||!login)return null;const a=logo.getBoundingClientRect(),b=login.getBoundingClientRect(),c=toggle?.getBoundingClientRect(),d=name?.getBoundingClientRect(),brandRight=d?.width?Math.max(a.right,d.right):a.right;return {logoLeft:a.left,logoRight:a.right,nameRight:d?.width?d.right:null,loginLeft:b.left,gap:b.left-brandRight,menuWidth:c?.width||0,menuHeight:c?.height||0}})()`);
    layouts[layouts.length-1].header = result.header;
    if(result.header&&result.header.gap<4)failures.push(`${kind} ${width}: brand/Login gap ${result.header.gap}`);
    if(result.header?.menuWidth&&(result.header.menuWidth<44||result.header.menuHeight<44))failures.push(`${kind} ${width}: menu touch target below44px`);
    if(result.scrollWidth>width+1)failures.push(`${kind} ${width}: document width ${result.scrollWidth}`);
    if(result.controls.length)failures.push(`${kind} ${width}: controls outside viewport ${JSON.stringify(result.controls)}`);
    if(result.rootSize!==expectedRoot(width)||result.bodySize!==expectedRoot(width))failures.push(`${kind} ${width}: root/body ${result.rootSize}/${result.bodySize}; ${baseline} expects ${expectedRoot(width)}`);
    if(!result.bodyFamily.includes('Poppins')||!result.poppinsLoaded)failures.push(`${kind} ${width}: original Poppins not loaded`);
    const scale={xs:.75,sm:.875,base:1,lg:1.125,xl:1.25,'2xl':1.5};
    for(const probe of result.probes)if(Math.abs(probe.size-rem(width,scale[probe.type]))>.02)failures.push(`${kind} ${width}: text-${probe.type} ${probe.size}; original scale expects ${rem(width,scale[probe.type])}`);
    for(const font of result.fonts){
      const [size,weight]=expected[font.selector];
      if(font.size===null||Math.abs(font.size-size)>.02||font.weight!==weight||!font.family?.includes('Poppins'))failures.push(`${kind} ${width}: ${font.selector} = ${font.size}px/${font.weight}/${font.family}; ${baseline} expects ${size}px/${weight}/Poppins`);
      if(font.clientWidth&&font.scrollWidth>font.clientWidth+1&&!font.selector.endsWith('input'))failures.push(`${kind} ${width}: text overflows ${font.selector}`);
    }
    if(output){const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(path.join(output,`${kind}-${width}.png`),Buffer.from(shot.result.data,'base64'));}
  };
  for (const width of [320,390,768,1024,1440]) for(const kind of [768,1024].includes(width)?['public']:['public','member','lifetime','admin']){
    await send('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:width<600});
    await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/${kind==='public'?'':kind}`});
    await until(`Boolean(document.querySelector('[data-mounted]'))&&document.body.innerText.includes('Login')`);
    await evaluate('document.fonts.ready');await pause(100);
    if(kind==='public'){
      await until(`document.querySelector('.activ-app-promo__qr img')?.complete`);
      await evaluate(`document.querySelectorAll('.activ-app-phone img').forEach(image=>image.loading='eager')`);
      await until(`[...document.querySelectorAll('.activ-app-phone img')].every(image=>image.naturalWidth>0)`);
      await record(kind,width);
      if(width<1280){
        await evaluate(`document.querySelector('[aria-label="Open menu"]').click()`);await until(`Boolean(document.querySelector('[aria-label="Menu"]'))`);await pause(450);
        await record('public-menu',width);
        await evaluate(`document.querySelector('[aria-label="Menu"] button[aria-label="Close menu"]').click()`);
        await until(`!document.querySelector('[aria-label="Menu"]')`);
      }
    }else{
      await record(kind,width);
      await evaluate(`${visibleButton(kind==='member'?'View plan details':kind==='admin'?'View membership':'Explore your membership')}.click()`);await until(`Boolean(document.querySelector('[role="dialog"] input'))`);await pause(220);
      await record(`${kind}-dialog`,width);
      await evaluate(`${visibleButton('Close details')}.click()`);await until(`!document.querySelector('[role="dialog"] input')`);
    }
  }
  if(output)await writeFile(path.join(output,'verification.json'),JSON.stringify({checkedAt:new Date().toISOString(),baseline,css:cssFile,fonts:localPoppins?'local Poppins 400–900':'system fallback; Poppins not verified',layouts,failures,errors,unexpectedRequests,remoteRequests},null,2));
  assert.deepEqual(errors,[]);assert.deepEqual(unexpectedRequests,[]);assert.deepEqual(remoteRequests,[]);assert.deepEqual(failures,[]);
  console.log('PASS original b0111a3 typography: exact Poppins family/sizes/weights, normal Tailwind scale, root16desktop/14phone; public content/menu, member/lifetime cards, admin controls and dialogs; no overflow; loopback only.');
  await send('Browser.close');
}catch(error){
  if(output)await writeFile(path.join(output,'failure.json'),JSON.stringify({checkedAt:new Date().toISOString(),message:error.message,layouts,failures,errors,unexpectedRequests,remoteRequests},null,2));
  throw error;
}finally{
  ws?.close();chrome?.kill();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  if(path.resolve(profile).startsWith(path.resolve(tmpdir())+path.sep+'activ-website-type-'))await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200}).catch(()=>{});
}
