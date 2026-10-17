// Real Chrome, IndexedDB and service worker registration; local fake FCM/API only.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import vm from 'node:vm';
import { localTypographyFonts } from './browserTypographyFixtures.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const fonts = await localTypographyFonts(root);
const profile = await mkdtemp(path.join(tmpdir(), 'activ-visitor-push-test-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const env = Object.fromEntries(['API_KEY', 'PROJECT_ID', 'MESSAGING_SENDER_ID', 'APP_ID', 'VAPID_KEY'].map(k => ['VITE_FIREBASE_' + k, 'fixture']));
const calls = [];
const noticeId = 'd'.repeat(24), eventNoticeId = 'e'.repeat(24), eventId = 'f'.repeat(24);
const receipts = new Set();
let bundle = '', css = '', chrome, ws, installations = 0, rejectDelete = false, expireNext = false;
let feedMode = 'normal', rejectDetail = false;
const server = http.createServer(async (req, res) => {
  if (fonts.serve(new URL(req.url, 'http://localhost'), res)) return;
  if (req.url === '/logo_ACTIVian-removebg-preview.png') { res.setHeader('Content-Type', 'image/png'); return res.end(await readFile(path.join(root, 'public/logo_ACTIVian-removebg-preview.png'))); }
  if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
  if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
  if (req.url === '/fixture.svg') { res.setHeader('Content-Type', 'image/svg+xml'); return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="#1d4ed8"/><text x="50" y="220" font-size="55" fill="white">ACTIV public update</text></svg>'); }
  if (req.url === '/firebase-messaging-sw.js') {
    res.setHeader('Content-Type', 'text/javascript');
    return res.end(`self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));`);
  }
  if (req.url.startsWith('/api/v1/')) {
    let body = ''; for await (const chunk of req) body += chunk;
    calls.push({ path: req.url, method: req.method, auth: req.headers.authorization, key: req.headers['x-activ-visitor-key'], body: body ? JSON.parse(body) : undefined });
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/v1/cms/site') return res.end(JSON.stringify({ data: { brand: { fullName: 'Adidravidar Confederation of Trade and Industrial Vision', logo: { url: '/logo_ACTIVian-removebg-preview.png', type: 'image', fit: 'contain' }, tagline: '' }, header: { navLinks: [{ label: 'Home', href: '/' }, { label: 'Events', href: '/events' }], ctaLabel: 'Sign in', ctaHref: '/login' }, footer: { email: 'member@activ.org.in', phones: ['8220112188'], addressLines: ['Tamil Nadu, India'] } } }));
    if (req.url.startsWith('/api/v1/cms/')) return res.end(JSON.stringify({ data: req.url.endsWith('/contact-info') ? { offices: [], social: {} } : [] }));
    const notices = [{ id: noticeId, kind: 'announcement', sourceId: 'c'.repeat(24), title: 'Dear ACTIVian, discover new opportunities', summary: 'Meet members and explore the latest community updates.', body: 'Welcome ACTIVian. Meet members and explore the latest community updates.', imageUrl: origin + '/fixture.svg', createdAt: '2026-10-16T09:00:00Z' },
      { id: eventNoticeId, kind: 'event', sourceId: eventId, title: 'Scale your business with ACTIV', summary: 'Join our upcoming public community event.', body: 'Explore opportunities with the ACTIV community.', imageUrl: origin + '/fixture.svg', createdAt: '2026-10-15T09:00:00Z' }];
    if (req.method === 'GET' && req.url.startsWith('/api/v1/public-notifications')) {
      const id = req.url.split('/').at(-1);
      if ((id === 'public-notifications' && feedMode === 'error') || (id !== 'public-notifications' && rejectDetail)) { res.statusCode = 503; return res.end('{}'); }
      return res.end(JSON.stringify({ data: id === 'public-notifications' ? feedMode === 'empty' ? [] : notices : notices.find(row => row.id === id) }));
    }
    if (req.method === 'PATCH' && req.url.endsWith('/open')) {
      const key = req.headers['x-activ-visitor-key'] + ':' + req.url + ':' + JSON.parse(body).channel;
      const recorded = !receipts.has(key); receipts.add(key);
      return res.end(JSON.stringify({ data: { recorded } }));
    }
    if (req.url.endsWith('/public-notifications/installations')) {
      installations++;
      return res.end(JSON.stringify({ data: { id: installations.toString(16).padStart(24, '0'), key: String(installations).padStart(64, '0') } }));
    }
    if (req.url.endsWith('/public-notifications/devices')) {
      if (req.method === 'DELETE' && rejectDelete) { res.statusCode = 503; return res.end('{}'); }
      if (req.method === 'PUT' && expireNext) { expireNext = false; res.statusCode = 401; return res.end('{}'); }
    }
    return res.end(JSON.stringify({ data: { configured: true } }));
  }
  res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
env.VITE_API_URL = origin + '/api/v1';
const visitorPuts = () => calls.filter(c => c.path.endsWith('/public-notifications/devices') && c.method === 'PUT');
try {
  if (process.env.TEST_CSS) css = await readFile(process.env.TEST_CSS, 'utf8');
  else {
    const assets = await readdir(path.join(root, 'dist/assets'));
    css = await readFile(path.join(root, 'dist/assets', assets.find(name => /^index-.*\.css$/.test(name))), 'utf8');
  }
  const built = await build({ bundle: true, write: false, outdir: path.join(profile, 'bundle'), format: 'iife', jsx: 'automatic', absWorkingDir: root,
    define: { 'import.meta.env': JSON.stringify(env), 'process.env.NODE_ENV': '"test"' },
    plugins: [{ name: 'fake-fcm', setup(b) {
      b.onResolve({ filter: /^firebase\/(app|messaging)$/ }, args => ({ path: args.path, namespace: 'fake' }));
      b.onLoad({ filter: /.*/, namespace: 'fake' }, args => ({ contents: args.path.endsWith('/app')
        ? 'export const getApps=()=>[];export const initializeApp=()=>({});'
        : `export const isSupported=async()=>true;export const getMessaging=()=>({});
           export const getToken=async()=>{window.tokenRequests++;if(window.tokenFailure)throw Error('Offline fixture');if(window.holdToken)await new Promise(r=>window.releaseToken=r);return 'visitor-browser-token-1234567890';};
           export const deleteToken=async()=>{window.deleted=true;return true;};
           export const onMessage=(m,fn)=>{window.receivePush=fn;return ()=>window.receivePush=null;};` }));
    } }],
    stdin: { resolveDir: root, loader: 'tsx', contents: `
      import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter,Routes,Route} from 'react-router-dom';
      import {HeaderSection} from './src/components/layout/HeaderSection';
      import PublicPage from './src/pages/onboarding/PublicNotificationsPage';
      import Lifecycle from './src/components/BrowserPushLifecycle';
      import * as push from './src/services/browserPush';import * as identity from './src/lib/pushIdentity';
      import * as visitor from './src/services/visitorBrowserPush';import {clearSession} from './src/services/api';
      Object.assign(window,{push,identity,visitor,clearSession});
      window.permission='default';window.nextPermission='granted';window.permissionRequests=0;window.tokenRequests=0;
      Object.defineProperty(Notification,'permission',{get:()=>window.permission});
      Notification.requestPermission=async()=>{window.permissionRequests++;if(window.holdPermission)await new Promise(r=>window.releasePermission=r);window.permission=window.nextPermission;return window.permission;};
      window.signIn=id=>localStorage.setItem('token','x.'+btoa(JSON.stringify({userId:id,exp:Math.floor(Date.now()/1000)+3600}))+'.x');
      const root=createRoot(document.getElementById('root'));let revision=0;
      function CurrentPage(){return <><HeaderSection/><main id="current-page" style={{minHeight:'1200px',padding:'32px'}}><h1>Current ACTIV page</h1><button id="outside-control">Page content action</button></main></>;}
      window.mountPublic=(url,withLifecycle=true)=>{history.replaceState({},'',url);root.render(<BrowserRouter key={++revision}>{withLifecycle&&<Lifecycle/>}<Routes><Route path="/notifications" element={<PublicPage/>}/><Route path="*" element={<CurrentPage/>}/></Routes></BrowserRouter>);};
      window.mountPublic('/events?view=upcoming',false);
    ` } });
  bundle = built.outputFiles.find(file => file.path.endsWith('.js')).text;
  css += '\n' + built.outputFiles.filter(file => file.path.endsWith('.css')).map(file => file.text).join('\n');
  css += '\n' + fonts.css;
  chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let port;
  for (let i = 0; i < 100; i++) { try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch {} await pause(100); }
  assert(port, 'Chrome starts');
  const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve));
  let seq = 0; const pending = new Map(), errors = [];
  ws.addEventListener('message', event => { const m = JSON.parse(event.data); if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); pending.get(m.id)?.(m); pending.delete(m.id); });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq, timer = setTimeout(() => { pending.delete(id); reject(Error(method)); }, 15000);
    pending.set(id, r => { clearTimeout(timer); resolve(r); }); ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw Error(r.result.exceptionDetails.exception?.description);
    return r.result?.result?.value;
  };
  const until = async expression => { for (let i = 0; i < 80; i++) { if (await evaluate(`(async()=>Boolean(${expression}))()`)) return; await pause(100); } throw Error(expression + '\n' + errors.join('\n')); };
  const screenshots = path.join(root, '..', 'artifacts', 'browser-visitor-push');
  await mkdir(screenshots, { recursive: true });
  const screenshot = async name => { const result = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(path.join(screenshots, name + '.png'), Buffer.from(result.result.data, 'base64')); };
  const dialog = 'document.querySelector(\'[role="dialog"][aria-label="Notifications"]\')';
  const bell = 'document.querySelector(\'header button[aria-label="Notifications"]\')';
  const openBell = async () => {
    await until(bell);
    await evaluate(`${bell}.click()`);
    await until(dialog);
  };
  const closeBell = async () => {
    await evaluate('document.querySelector(\'button[aria-label="Close notifications"]\').click()');
    await until(`!${dialog}`);
  };
  const chooseNotice = async title => {
    await evaluate(`[...${dialog}.querySelectorAll('button')].find(button=>button.textContent.includes(${JSON.stringify(title)})).click()`);
  };
  const reset = async () => {
    rejectDelete = false; expireNext = false; feedMode = 'normal'; rejectDetail = false;
    await evaluate(`(async()=>{await push.disableBrowserPush();localStorage.clear();sessionStorage.clear();await identity.writePushIdentity(null);window.permission='default';window.nextPermission='granted';window.tokenFailure=false;window.holdToken=false;window.releaseToken=null;window.holdPermission=false;window.releasePermission=null;window.mountPublic('/events?view=upcoming',false);})()`);
    await until(bell);
  };
  await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['https://*'] });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: origin }); await until('window.push');
  await evaluate('push.syncBrowserPush()');
  assert.equal(installations, 0, 'first visit does not silently create an installation');
  assert.equal(await evaluate('window.permissionRequests'), 0, 'passive sync never prompts the browser');
  await until(bell);
  await pause(1700);
  assert.equal(await evaluate('!!document.querySelector(\'aside[aria-label="Enable ACTIV notifications"]\')'), false, 'no floating ACTIV permission prompt appears');
  assert.equal(await evaluate(`!!${dialog}`), false, 'notifications stay closed until requested');
  await evaluate('document.fonts.ready');
  const originalLocation = await evaluate('location.pathname+location.search+location.hash');
  const beforePermission = await evaluate('window.permissionRequests');
  await openBell();
  assert.equal(await evaluate('window.permissionRequests'), beforePermission + 1, 'explicit bell opening invokes the native permission request once');
  assert.equal(await evaluate('location.pathname+location.search+location.hash'), originalLocation, 'bell opens a card without navigating away');
  await until('(await identity.readPushIdentity())?.visitorId');
  const firstIdentity = await evaluate('identity.readPushIdentity()');
  const stored = await evaluate('visitor.visitorIdentity()');
  assert.equal(firstIdentity.visitorId, stored.id);
  assert.equal(firstIdentity.userId, undefined);
  assert.equal(visitorPuts().at(-1).key, stored.key, 'guest API uses its installation credential');
  assert.equal(visitorPuts().at(-1).auth, undefined, 'guest API does not use a member access token');
  assert.deepEqual(visitorPuts().at(-1).body, { token: 'visitor-browser-token-1234567890', platform: 'web' });
  assert.equal(await evaluate('push.browserPushStatus()'), 'Public notifications are enabled on this browser.');
  assert.equal(await evaluate('(async()=>(await identity.readPushIdentity()).expiresAt>Date.now())()'), true);
  await closeBell(); await openBell();
  assert.equal(await evaluate('window.permissionRequests'), beforePermission + 1, 'already granted permission is not requested again');
  await closeBell();

  await reset(); const deniedCount = visitorPuts().length;
  const beforeDeniedPrompt = await evaluate('window.permissionRequests');
  await evaluate('window.nextPermission="denied"'); await openBell();
  await until('window.permission === "denied"');
  assert.equal(visitorPuts().length, deniedCount, 'denying permission cannot enroll a guest');
  assert.equal(await evaluate('visitor.visitorIdentity()'), null);
  assert.equal(await evaluate('identity.readPushIdentity()'), null);
  await until(`${dialog}?.textContent.includes('Dear ACTIVian, discover')`);
  assert.match(await evaluate(`${dialog}.textContent`), /settings|blocked|not allowed/i, 'blocked browser permission has a local explanation');
  await closeBell(); await openBell();
  assert.equal(await evaluate('window.permissionRequests'), beforeDeniedPrompt + 1, 'blocked permission is never requested again by opening the card');
  await closeBell();

  await reset(); await evaluate('window.nextPermission="default"');
  const beforeDismissedPrompt = await evaluate('window.permissionRequests');
  await openBell(); await pause(200);
  assert.equal(await evaluate('window.permissionRequests'), beforeDismissedPrompt + 1);
  await evaluate('window.dispatchEvent(new Event("focus"))'); await pause(200);
  assert.equal(await evaluate('window.permissionRequests'), beforeDismissedPrompt + 1, 'dismissed native permission does not reappear from rerenders or focus');
  await closeBell(); await openBell();
  assert.equal(await evaluate('window.permissionRequests'), beforeDismissedPrompt + 1, 'a dismissed native request is not repeated by reopening the bell');
  await evaluate(`${dialog}.querySelector('button[aria-label="Enable browser notifications"]').click()`);
  assert.equal(await evaluate('window.permissionRequests'), beforeDismissedPrompt + 2, 'the explicit inline enable action can retry an undecided permission');
  await closeBell();

  await reset(); const permissionCount = await evaluate('window.permissionRequests');
  await evaluate('window.permission="granted";push.syncBrowserPush()');
  assert((await evaluate('identity.readPushIdentity()')).visitorId, 'previously granted OS permission syncs on return');
  assert.equal(await evaluate('window.permissionRequests'), permissionCount);

  await reset();
  await evaluate('window.tokenFailure=true;push.enableBrowserPush().catch(error=>window.lastError=error.message)');
  assert.equal(await evaluate('push.pushEnabled()'), true, 'offline token request retains the explicit consent');
  assert.equal(await evaluate('identity.readPushIdentity()'), null);
  await evaluate('window.tokenFailure=false;push.syncBrowserPush()');
  assert((await evaluate('identity.readPushIdentity()')).visitorId, 'next sync retries first offline opt-in');

  const beforeExpiry = installations;
  expireNext = true;
  await evaluate('push.syncBrowserPush()');
  assert.equal(installations, beforeExpiry + 1, 'expired installation is replaced once during the same sync');
  assert.equal((await evaluate('identity.readPushIdentity()')).visitorId, await evaluate('visitor.visitorIdentity().id'));

  rejectDelete = true;
  await evaluate('push.disableBrowserPush()');
  assert.equal(await evaluate('push.pushEnabled()'), false);
  assert.equal(await evaluate('identity.readPushIdentity()'), null, 'offline disable immediately closes worker display');
  assert.equal(await evaluate('window.deleted'), true, 'offline disable invalidates the FCM token');
  assert(await evaluate('localStorage.getItem("activ:visitor-push-revoke")'), 'failed server detach is durable');
  const optedOutCount = visitorPuts().length;
  rejectDelete = false; await evaluate('push.syncBrowserPush()');
  assert.equal(await evaluate('localStorage.getItem("activ:visitor-push-revoke")'), null);
  assert.equal(visitorPuts().length, optedOutCount, 'retrying detach does not opt the visitor back in');

  await reset();
  const raceCount = visitorPuts().length;
  await evaluate('window.holdPermission=true;window.latePermission=push.enableBrowserPush();void 0');
  await until('window.releasePermission');
  await evaluate('push.disableBrowserPush()');
  await evaluate('window.releasePermission();window.holdPermission=false;window.latePermission');
  assert.equal(await evaluate('push.pushEnabled()'), false, 'late permission result cannot reverse a newer opt-out');
  assert.equal(visitorPuts().length, raceCount);

  await reset();
  const beforeLogin = visitorPuts().length;
  await evaluate('window.holdToken=true;window.pendingGuest=push.enableBrowserPush();void 0');
  await until('window.releaseToken');
  await evaluate('signIn("member-fixture");window.pendingMember=push.syncBrowserPush();window.holdToken=false;window.releaseToken();void 0');
  await evaluate('Promise.all([window.pendingGuest,window.pendingMember])');
  assert.equal(visitorPuts().length, beforeLogin, 'late guest token cannot register after login');
  assert.equal((await evaluate('identity.readPushIdentity()')).userId, 'member-fixture');
  await evaluate('clearSession()');
  assert.equal(await evaluate('identity.readPushIdentity()'), null, 'logout revokes the member worker identity');
  assert.equal(await evaluate('localStorage.getItem("token")'), null);
  await evaluate('push.syncBrowserPush()');
  assert((await evaluate('identity.readPushIdentity()')).visitorId, 'consenting signed-out visitor receives only the public identity');

  // Execute real worker handlers, injecting only FCM and persisted-identity transport.
  const worker = await build({ entryPoints: [path.join(root, 'src/firebaseMessagingWorker.ts')], bundle: true, write: false, format: 'iife',
    define: { 'import.meta.env': JSON.stringify(env) }, plugins: [{ name: 'worker-fixtures', setup(b) {
      b.onResolve({ filter: /^firebase\// }, args => ({ path: args.path, namespace: 'fake' }));
      b.onLoad({ filter: /.*/, namespace: 'fake' }, args => ({ contents: args.path.endsWith('/app') ? 'export const initializeApp=()=>({});'
        : 'export const getMessaging=()=>({});export const onBackgroundMessage=(m,fn)=>globalThis.background=fn;' }));
      b.onResolve({ filter: /\/lib\/pushIdentity$/ }, () => ({ path: 'identity', namespace: 'identity' }));
      b.onLoad({ filter: /.*/, namespace: 'identity' }, () => ({ contents: `export const readPushIdentity=async()=>globalThis.identity;export {ownsPush} from ${JSON.stringify(path.join(root, 'src/lib/pushIdentity.ts'))};`, resolveDir: root }));
    } }] });
  const handlers = {}, displayed = [], opened = [];
  const guest = { visitorId: 'a'.repeat(24), expiresAt: Date.now() + 60000 };
  const data = { audience: 'visitor', visitorId: guest.visitorId, publicNotificationId: 'b'.repeat(24), url: 'https://untrusted.example' };
  const context = vm.createContext({ URL, Date, identity: guest,
    self: { addEventListener: (name, fn) => handlers[name] = fn, location: { origin },
      registration: { showNotification: async (title, options) => displayed.push({ title, ...options }) },
      clients: { matchAll: async () => [], openWindow: async url => opened.push(url) } } });
  vm.runInContext(worker.outputFiles[0].text, context);
  await context.background({ data });
  assert.equal(displayed.length, 1, 'matching visitor may receive public push');
  assert.equal(displayed[0].tag, data.publicNotificationId);
  let clicked;
  const click = async notification => { handlers.notificationclick({ notification: { ...notification, close() {} }, stopImmediatePropagation() {}, waitUntil: p => clicked = p }); await clicked; };
  await click(displayed[0]);
  assert.equal(new URL(opened[0]).pathname, '/');
  assert.equal(new URL(opened[0]).searchParams.get('notifications'), 'open');
  assert.equal(new URL(opened[0]).searchParams.get('notice'), data.publicNotificationId);
  assert.equal(new URL(opened[0]).searchParams.get('notificationSource'), 'push');
  assert.equal(new URL(opened[0]).origin, origin, 'payload URLs never control the destination');
  await context.background({ data: { ...data, visitorId: 'c'.repeat(24) } });
  await context.background({ data: { userId: 'member-fixture', notificationId: 'member-message' } });
  await context.background({ data: { ...data, publicNotificationId: 'invalid' } });
  assert.equal(displayed.length, 1, 'guest cannot display another visitor, member or malformed alert');
  context.identity = { userId: 'member-fixture', expiresAt: Date.now() + 60000 };
  await context.background({ data }); await click(displayed[0]);
  assert.equal(displayed.length, 1, 'member identity rejects old guest pushes');
  assert.equal(opened.length, 1, 'old guest notification does not open after login');
  context.identity = { ...guest, expiresAt: Date.now() - 1 };
  await context.background({ data }); await click(displayed[0]);
  context.identity = null; await context.background({ data }); await click(displayed[0]);
  assert.equal(displayed.length, 1, 'expired and revoked identities cannot display');
  assert.equal(opened.length, 1, 'expired and revoked identities cannot open');
  // The card uses the real public header and API clients, with localhost content.
  await evaluate('window.mountPublic("/events?view=upcoming",false)');
  await openBell();
  await until(`${dialog}?.textContent.includes('Dear ACTIVian, discover')`);
  await evaluate('document.fonts.ready');
  assert.equal(await evaluate(`${bell}.getAttribute('aria-expanded')`), 'true');
  assert.equal(await evaluate('location.pathname+location.search'), '/events?view=upcoming');
  for (const width of [320, 390, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
    await pause(100);
    const bounds = await evaluate(`(()=>{const r=${dialog}.getBoundingClientRect();return {width:r.width,left:r.left,right:r.right,top:r.top,bottom:r.bottom}})()`);
    assert(bounds.width > 240 && bounds.width <= 440 && bounds.left >= 0 && bounds.right <= width, `compact card stays within ${width}px viewport`);
    assert(bounds.top >= 0 && bounds.bottom <= 900, `card stays within the viewport height at ${width}px`);
    assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), `notification card does not add horizontal scroll at ${width}px`);
    assert(await evaluate(`getComputedStyle(${dialog}).fontFamily.includes('Poppins')`), 'card preserves shared website typography');
    await screenshot('public-card-' + width);
  }
  const inAppOpens = () => calls.filter(c => c.method === 'PATCH' && c.path.endsWith('/' + noticeId + '/open') && c.body?.channel === 'in_app');
  const beforeSelection = inAppOpens().length;
  await chooseNotice('Dear ACTIVian, discover');
  await until(`${dialog}?.querySelector('article img')?.complete && ${dialog}.querySelector('article img').naturalWidth>0`);
  await until(`${dialog}?.querySelector('article')?.textContent.includes('Welcome ACTIVian. Meet members and explore the latest community updates.')`);
  assert.equal(await evaluate(`${dialog}.querySelector('article p strong')`), null, 'public body uses the plain-text API contract');
  assert.equal(inAppOpens().length, beforeSelection + 1, 'successful user selection records one in-app open');
  assert.equal(await evaluate('location.pathname+location.search'), '/events?view=upcoming', 'notice details remain inside the current-page card');
  for (const width of [320, 390, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
    await pause(100);
    const dimensions = await evaluate(`(()=>{const r=${dialog}.querySelector('article img').getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,right:r.right}})()`);
    assert(dimensions.width > 150 && dimensions.height > 40 && dimensions.left >= 0 && dimensions.right <= width, `notice image remains visible within ${width}px`);
    assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
    await screenshot('public-card-detail-' + width);
  }
  await evaluate('document.querySelector(\'button[aria-label="Back to notifications"]\').click()');
  await until(`${dialog}?.textContent.includes('Dear ACTIVian, discover') && !${dialog}.querySelector('article')`);
  await chooseNotice('Scale your business');
  await until(`${dialog}?.querySelector('article a[href^="/events/"]')`);
  assert.equal(await evaluate(`${dialog}.querySelector('article a[href^="/events/"]').getAttribute('href')`), '/events/' + eventId);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await until(`!${dialog}`);
  assert.equal(await evaluate(`document.activeElement === ${bell}`), true, 'Escape returns keyboard focus to the bell');
  assert.equal(await evaluate(`${bell}.getAttribute('aria-expanded')`), 'false');
  await openBell();
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 3, y: 895, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 3, y: 895, button: 'left', clickCount: 1 });
  await until(`!${dialog}`);
  assert.equal(await evaluate('location.pathname+location.search'), '/events?view=upcoming', 'outside dismissal preserves the current page');

  // Permission preferences remain available inside the card and opt-out survives reopening.
  await openBell();
  await evaluate(`[...${dialog}.querySelectorAll('button')].find(button=>button.getAttribute('aria-label')==='Disable browser notifications'||button.textContent.trim()==='Disable browser notifications').click()`);
  await until('!push.pushEnabled() && !(await identity.readPushIdentity())');
  const afterOptOut = visitorPuts().length;
  await closeBell(); await openBell(); await pause(200);
  assert.equal(visitorPuts().length, afterOptOut, 'viewing the card does not undo explicit browser opt-out');
  await evaluate(`[...${dialog}.querySelectorAll('button')].find(button=>button.getAttribute('aria-label')==='Enable browser notifications'||button.textContent.trim()==='Enable browser notifications').click()`);
  await until('(await identity.readPushIdentity())?.visitorId');
  await closeBell();

  feedMode = 'empty';
  await evaluate('window.mountPublic("/events?view=empty",false)'); await openBell();
  await until(`${dialog} && /all caught up|no (public )?(updates|notifications)|updates will appear|nothing new/i.test(${dialog}.textContent)`);
  assert.equal(await evaluate('location.pathname+location.search'), '/events?view=empty');
  await closeBell();

  feedMode = 'error';
  await evaluate('window.mountPublic("/events?view=retry",false)'); await openBell();
  await until(`${dialog}?.querySelector('[role="alert"]')`);
  feedMode = 'normal';
  await evaluate(`[...${dialog}.querySelectorAll('button')].find(button=>/retry|try again/i.test(button.textContent)).click()`);
  await until(`${dialog}?.textContent.includes('Dear ACTIVian, discover')`);
  assert.equal(await evaluate('location.pathname+location.search'), '/events?view=retry', 'retry refreshes the card without a page navigation');
  rejectDetail = true;
  const beforeFailedSelection = inAppOpens().length;
  await chooseNotice('Dear ACTIVian, discover');
  await until(`${dialog}?.querySelector('[role="alert"]')`);
  assert.equal(inAppOpens().length, beforeFailedSelection, 'a failed detail request never records an in-app open');
  rejectDetail = false;
  await evaluate(`[...${dialog}.querySelectorAll('button')].find(button=>/retry|try again/i.test(button.textContent)).click()`);
  await until(`${dialog}?.querySelector('article')?.textContent.includes('Welcome ACTIVian.')`);
  assert.equal(inAppOpens().length, beforeFailedSelection + 1, 'successful retry of a user selection records the open once');
  await closeBell();

  // Compatibility and actual push links open the same card, without fabricating in-app reads.
  const beforePlainLink = calls.filter(c => c.method === 'PATCH' && c.path.endsWith('/open')).length;
  await evaluate(`window.mountPublic('/?notifications=open&notice=${eventNoticeId}')`);
  await until(`${dialog}?.querySelector('article a[href^="/events/"]')`);
  assert.equal(calls.filter(c => c.method === 'PATCH' && c.path.endsWith('/open')).length, beforePlainLink, 'plain deep links do not invent push or in-app receipts');
  await closeBell();
  assert.equal(await evaluate('new URL(location.href).searchParams.has("notifications")'), false, 'closing a query-opened card clears its open trigger');

  const opens = () => calls.filter(c => c.method === 'PATCH' && c.path.endsWith('/' + noticeId + '/open'));
  const beforeReceipt = opens().length;
  const beforePushInApp = inAppOpens().length;
  await evaluate(`window.mountPublic('/?notifications=open&notice=${noticeId}&notificationSource=push')`);
  await until(`${dialog}?.querySelector('article')?.textContent.includes('Welcome ACTIVian.')`);
  await until('!new URL(location.href).searchParams.has("notificationSource")');
  const ownKey = await evaluate('visitor.visitorIdentity().key');
  assert.equal(opens().length, beforeReceipt + 1, 'actual push URL is acknowledged once');
  assert.equal(opens().at(-1).key, ownKey, 'push receipt uses the current installation owner');
  assert.equal(opens().at(-1).body.channel, 'push');
  assert.equal(inAppOpens().length, beforePushInApp, 'opening a push deep link does not also record an in-app read');
  await evaluate('window.dispatchEvent(new Event("focus"));window.dispatchEvent(new Event("online"))');
  await pause(500);
  assert.equal(opens().length, beforeReceipt + 1, 'repeated lifecycle focus does not count another click');
  await closeBell();
  const beforeLegacy = opens().length;
  await evaluate(`window.mountPublic('/notifications?notice=${noticeId}&notificationSource=push')`);
  await until(`${dialog}?.querySelector('article')?.textContent.includes('Welcome ACTIVian.')`);
  await until('location.pathname === "/" && !new URL(location.href).searchParams.has("notificationSource")');
  assert.equal(opens().length, beforeLegacy + 1, 'legacy push links preserve and acknowledge their original attribution once');
  assert.equal(opens().at(-1).body.channel, 'push');
  assert.equal(inAppOpens().length, beforePushInApp, 'legacy redirects do not invent an in-app receipt');
  await closeBell();
  const beforeLegacyFeed = opens().length;
  await evaluate('window.mountPublic("/notifications")');
  await until(`location.pathname === '/' && ${dialog}?.textContent.includes('Dear ACTIVian, discover')`);
  assert.equal(opens().length, beforeLegacyFeed, 'legacy feed redirect alone does not record any read');
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('PASS: no floating prompt or passive permission request; native permission on explicit bell; same-page accessible responsive notification card/detail, block/dismiss/opt-out, empty/error/retry, Escape/outside close; existing ownership/race/offline registration coverage; new and legacy worker/deep-link routes with owned, one-time push attribution and no false in-app receipts. No external delivery.');
} finally {
  ws?.close(); chrome?.kill(); server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
