// Real Attendance page/table/stats and API client, with loopback-only data.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { localTypographyFonts } from './browserTypographyFixtures.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = process.env.TEST_ARTIFACTS ? path.resolve(process.env.TEST_ARTIFACTS) : null;
const fonts = await localTypographyFonts(root);
const profile = await mkdtemp(path.join(tmpdir(), 'activ-attendance-layout-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const event = { id: 'attendance-fixture', title: 'Entrepreneurship Awareness and Business Development Programme',
  startAt: '2026-10-15T03:30:00Z', endAt: '2026-10-15T13:00:00Z', venue: 'Chennai International Convention Centre',
  mode: 'offline', category: 'Training', slug: 'local-fixture', isToday: true, registered: 100000, checkedIn: 12345 };
const row = { registrationNo: 'ACTIV-2026-TEST-000001', bookingRef: 'ACTIVB-TEST-000001', participantNumber: 1,
  name: 'Alexandra Prakash', email: 'alexandra@example.test', phone: '+919000000000', phoneMasked: '******0000',
  bookedBy: 'A long but readable booking contact name', payment: 'paid', bookingStatus: 'active', checkedIn: true,
  admittedAt: '2026-10-15T05:30:00Z', admittedAtLabel: '15 Oct 2026, 11:00 am', admittedBy: 'ACTIV event support team', method: 'qr' };
const rows = [row, { ...row, registrationNo: 'ACTIV-2026-TEST-000002', name: 'Priya Kumar', checkedIn: false, admittedAt: null, admittedAtLabel: '', method: '' }];
const requests = [], failures = [], reports = [], errors = [], remoteRequests = [];
let bundle = '', css = '', chrome, ws;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (fonts.serve(url, res)) return;
  if (url.pathname === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
  if (url.pathname === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
  if (url.pathname.startsWith('/api/')) {
    requests.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams) });
    res.setHeader('Content-Type', 'application/json');
    if (req.method !== 'GET') { res.statusCode = 405; return res.end(JSON.stringify({ success: false })); }
    if (url.pathname === '/api/v1/event-checkin/events') return res.end(JSON.stringify({ success: true, data: [{ ...event,
      title: url.searchParams.get('scope') === 'past' ? 'Past training programme' : event.title }] }));
    if (url.pathname === '/api/v1/events/attendance-fixture/attendance') return res.end(JSON.stringify({ success: true, data: {
      event, totals: { registered: 100000, checkedIn: 12345, notYet: 87655, percent: 12.3 }, includeContact: true,
      rows: rows.filter(r => url.searchParams.get('status') === 'in' ? r.checkedIn : url.searchParams.get('status') === 'out' ? !r.checkedIn : true),
    } }));
    failures.push(`Unexpected request: ${req.method} ${url.pathname}`); res.statusCode = 404;
    return res.end(JSON.stringify({ success: false }));
  }
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'");
  res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
try {
  if (output) await mkdir(output, { recursive: true });
  const assets = await readdir(path.join(root, 'dist/assets'));
  const cssPath = process.env.TEST_CSS || path.join(root, 'dist/assets', assets.find(f => /^index-.*\.css$/.test(f)));
  css = await readFile(cssPath, 'utf8') + '\n' + fonts.css;
  const compiled = await build({ absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    define: { 'import.meta.env': JSON.stringify({ DEV: true, VITE_API_URL: `${base}/api/v1` }), 'process.env.NODE_ENV': '"test"' },
    plugins: [{ name: 'unrelated-sidebar', setup(b) {
      b.onResolve({ filter: /AdminSidebar$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ resolveDir: root, contents: 'export default function Sidebar(){return <aside data-fixture-sidebar className="hidden lg:block shrink-0 lg:w-[17.5rem] xl:w-[20.5rem] 2xl:w-[22rem] bg-blue-900"/>}', loader: 'jsx' }));
    } }], stdin: { resolveDir: root, loader: 'tsx', contents: `
      import React from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter,Routes,Route}from'react-router-dom';
      import Attendance from './src/features/admin/super-admin/pages/Attendance';
      localStorage.setItem('role','super_admin');localStorage.setItem('token','local-fixture-token');
      createRoot(document.getElementById('root')).render(<BrowserRouter><Routes>
        <Route path='/super-admin/attendance' element={<Attendance/>}/><Route path='/super-admin/attendance/:eventId' element={<Attendance/>}/>
      </Routes></BrowserRouter>);` } });
  bundle = compiled.outputFiles[0].text;
  chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    ['--headless=new', '--disable-gpu', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'],
    { windowsHide: true, stdio: 'ignore' });
  let port;
  for (let i = 0; i < 100; i++) { try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch {} await pause(100); }
  assert(port, 'Chrome starts');
  const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve));
  let sequence = 0; const pending = new Map();
  ws.addEventListener('message', event => {
    const m = JSON.parse(event.data);
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Network.requestWillBeSent' && !m.params.request.url.startsWith(base + '/') && !m.params.request.url.startsWith('data:')) remoteRequests.push(m.params.request.url);
    pending.get(m.id)?.(m); pending.delete(m.id);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence, timer = setTimeout(() => reject(Error(method)), 20000);
    pending.set(id, r => { clearTimeout(timer); r.error ? reject(Error(JSON.stringify(r.error))) : resolve(r); });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw Error(r.result.exceptionDetails.exception?.description);
    return r.result?.result?.value;
  };
  const until = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(`Boolean(${expression})`)) return; await pause(60); } throw Error(expression + errors.join('\n')); };
  const click = label => evaluate(`[...document.querySelectorAll('button')].find(b=>b.getBoundingClientRect().width&&b.textContent.trim()===${JSON.stringify(label)}).click()`);
  const inspect = async (screen, width) => {
    const result = await evaluate(`(() => {
      const pane=document.querySelector('[data-attendance-pane]'),content=document.querySelector('[data-attendance-content]');
      const shape=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {text:e.textContent.trim(),left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,fontSize:parseFloat(s.fontSize),fontFamily:s.fontFamily}};
      const visible=e=>e.getBoundingClientRect().width>0;
      const wordsFit=e=>{const node=e.firstChild;if(!node||node.nodeType!==Node.TEXT_NODE)return true;let match;const words=/\\S+/g;while(match=words.exec(node.textContent)){const lines=new Set();for(let i=match.index;i<match.index+match[0].length;i++){const range=document.createRange();range.setStart(node,i);range.setEnd(node,i+1);lines.add(Math.round(range.getBoundingClientRect().top));}if(lines.size>1)return false;}return true;};
      return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,paneOverflow:pane.scrollWidth>pane.clientWidth+1,contentOverflow:content.scrollWidth>content.clientWidth+1,
        cards:[...document.querySelectorAll('[data-admin-stat]')].map(shape),
        labels:[...document.querySelectorAll('[data-admin-stat-label]')].map(e=>({...shape(e),wordsFit:wordsFit(e)})),
        hints:[...document.querySelectorAll('[data-admin-stat-hint]')].map(e=>({...shape(e),clamp:getComputedStyle(e).webkitLineClamp,clipped:e.scrollHeight>e.clientHeight+1})),
        controls:[...document.querySelectorAll('button,input,select')].filter(visible).map(e=>({...shape(e),label:e.getAttribute('aria-label')||e.getAttribute('placeholder')||e.textContent.trim(),clipped:e.tagName==='BUTTON'&&(e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1)})),
        poppinsLoaded:document.fonts.check('600 20px Poppins')};
    })()`);
    reports.push({ screen, ...result });
    if (output) { const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(path.join(output, `${screen}-${width}.png`), Buffer.from(shot.result.data, 'base64')); }
    assert.equal(result.scrollWidth, width, `${screen}/${width}: page fits viewport`);
    assert(!result.paneOverflow && !result.contentOverflow, `${screen}/${width}: pane fits`);
    assert.equal(result.cards.length, screen === 'events' ? 2 : 4);
    assert(result.labels.every(r => r.fontSize === (width < 640 ? 14 : 20) && r.fontFamily.includes('Poppins') && r.wordsFit), `${screen}/${width}: historical stat typography keeps words intact`);
    assert(result.hints.every(r => !r.clipped && r.clamp === 'none'), `${screen}/${width}: complete stat descriptions`);
    assert(result.controls.every(r => r.left >= -1 && r.right <= width + 1 && !r.clipped), `${screen}/${width}: controls fit ${JSON.stringify(result.controls.filter(r=>r.left< -1||r.right>width+1||r.clipped))}`);
    if (width < 640) assert(result.cards.every(r => Math.abs(r.width - result.cards[0].width) < 1 && r.width >= width - 34), 'Mobile stats use the full content width');
    if (fonts.loaded) assert(result.poppinsLoaded);
    if (output && width <= 768) {
      await evaluate('document.querySelector("input").scrollIntoView({block:"start"})'); await pause(50);
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      await writeFile(path.join(output, `${screen}-controls-${width}.png`), Buffer.from(shot.result.data, 'base64'));
      await evaluate('document.querySelector("[data-attendance-pane]").scrollTop=0;document.querySelector("[data-attendance-content]").scrollTop=0');
    }
  };
  await send('Runtime.enable'); await send('Network.enable'); await send('Network.setBlockedURLs', { urls: ['https://*'] });
  for (const width of [320, 390, 768, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
    await send('Page.navigate', { url: base + '/super-admin/attendance' });
    await until('document.body.textContent.includes("Entrepreneurship Awareness")'); await evaluate('document.fonts.ready');
    await inspect('events', width);
    const headerScroll = await evaluate(`(() => { const pane=document.querySelector('[data-attendance-pane]'),content=document.querySelector('[data-attendance-content]');const before=document.querySelector('header').getBoundingClientRect().top;(innerWidth<640?pane:content).scrollTop=160;return before;})()`);
    await pause(50);
    const after = await evaluate('document.querySelector("header").getBoundingClientRect().top');
    assert(width < 640 ? after <= headerScroll - 100 : Math.abs(after - headerScroll) < 1, `${width}: mobile header scrolls, desktop header remains available`);
    await click('Past'); await until('document.body.textContent.includes("Past training programme")');
    await click('Today & upcoming'); await until('document.body.textContent.includes("Entrepreneurship Awareness")');
    await click('Attendance'); await until('document.body.textContent.includes("Alexandra Prakash")');
    await evaluate('document.querySelector("[data-attendance-pane]").scrollTop=0'); await inspect('detail', width);
    await click('Checked in'); await until('!document.body.textContent.includes("Priya Kumar")');
    await click('Not yet'); await until('document.body.textContent.includes("Priya Kumar")&&!document.body.textContent.includes("Alexandra Prakash")');
    await click('All'); await until('document.body.textContent.includes("Alexandra Prakash")');
    await evaluate(`(()=>{const input=document.querySelector('input[placeholder="Search attendees"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Alexandra');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await until('!document.body.textContent.includes("Priya Kumar")');
  }
  assert(requests.every(r => r.method === 'GET'), 'Attendance fixture makes no writes');
  assert.deepEqual(remoteRequests, []); assert.deepEqual(errors, []); assert.deepEqual(failures, []);
  if (output) await writeFile(path.join(output, 'verification.json'), JSON.stringify({ checkedAt: new Date().toISOString(), cssPath, reports, requests, remoteRequests, errors, failures }, null, 2));
  console.log('PASS Attendance real component: 320/390/768/1440px, intact stat labels/full descriptions, responsive controls, mobile header scroll, current/past/detail/status/search; local GET requests only.');
  await send('Browser.close');
} finally {
  if (output && reports.length) await writeFile(path.join(output, 'layouts.json'), JSON.stringify(reports, null, 2));
  ws?.close(); chrome?.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  if (path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep + 'activ-attendance-layout-')) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
