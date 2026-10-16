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
      return res.end(JSON.stringify({ data: id === 'public-notifications' ? notices : notices.find(row => row.id === id) }));
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
      import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter} from 'react-router-dom';
      import Prompt from './src/components/BrowserNotificationPrompt';
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
      window.mountPrompt=()=>root.render(<BrowserRouter><Prompt key={++revision}/></BrowserRouter>);window.mountPrompt();
      window.mountPublic=url=>{history.replaceState({},'',url);root.render(<BrowserRouter key={++revision}><Lifecycle/><PublicPage/></BrowserRouter>);};
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
  const reset = async () => {
    rejectDelete = false; expireNext = false;
    await evaluate(`(async()=>{await push.disableBrowserPush();localStorage.clear();await identity.writePushIdentity(null);window.permission='default';window.nextPermission='granted';window.tokenFailure=false;window.holdToken=false;window.releaseToken=null;window.holdPermission=false;window.releasePermission=null;window.mountPrompt();})()`);
  };
  await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['https://*'] });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: origin }); await until('window.push');
  await evaluate('push.syncBrowserPush()');
  assert.equal(calls.length, 0, 'first visit does not silently create an installation');
  assert.equal(await evaluate('window.permissionRequests'), 0, 'passive sync never prompts the browser');
  await until('document.querySelector("aside")');
  await evaluate('document.fonts.ready');
  for (const width of [320, 390, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
    assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), `welcome prompt fits ${width}px`);
    assert(await evaluate('document.querySelector("aside").getBoundingClientRect().width>250'), 'prompt receives its shared layout CSS');
    await screenshot('prompt-' + width);
  }
  await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="Later").click()');
  assert.equal(await evaluate('localStorage.getItem("activ:notification-prompt-dismissed")'), 'true');
  await evaluate('window.mountPrompt()'); await pause(1700);
  assert.equal(await evaluate('!!document.querySelector("aside")'), false, 'Later is persisted across remounts');
  assert.equal(calls.length, 0);

  await reset(); await until('document.querySelector("aside")');
  await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="Allow notifications").click()');
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

  await reset(); const deniedCount = visitorPuts().length;
  await evaluate('window.nextPermission="denied";push.enableBrowserPush().catch(error=>window.lastError=error.message)');
  assert.equal(visitorPuts().length, deniedCount, 'denying permission cannot enroll a guest');
  assert.equal(await evaluate('visitor.visitorIdentity()'), null);
  assert.equal(await evaluate('identity.readPushIdentity()'), null);

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
  assert.equal(new URL(opened[0]).pathname, '/notifications');
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
  // Public screen uses its real header/footer and API clients, with localhost content.
  await evaluate('window.mountPublic("/notifications")');
  await until('document.querySelector("main") && document.body.textContent.includes("Dear ACTIVian, discover")');
  await evaluate('document.fonts.ready');
  assert.equal(await evaluate('document.querySelector("header a[aria-label=Notifications]").getAttribute("href")'), '/notifications');
  for (const width of [320, 390, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1050, deviceScaleFactor: 1, mobile: width < 600 });
    await pause(100);
    assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), `public notifications fit ${width}px`);
    assert(await evaluate('getComputedStyle(document.querySelector("h1")).fontFamily.includes("Poppins")'), 'page preserves shared website typography');
    await screenshot('public-feed-' + width);
  }
  await evaluate(`document.querySelector('a[href="/notifications?notice=${noticeId}"]').click()`);
  await until('document.querySelector("article img")?.complete && document.querySelector("article img").naturalWidth>0');
  assert.equal(await evaluate('document.querySelector("article p").textContent'), 'Welcome ACTIVian. Meet members and explore the latest community updates.');
  assert.equal(await evaluate('document.querySelector("article p strong")'), null, 'public body uses the plain-text API contract');
  for (const width of [320, 390, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1050, deviceScaleFactor: 1, mobile: width < 600 });
    const dimensions = await evaluate('(()=>{const r=document.querySelector("article img").getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,right:r.right}})()');
    assert(dimensions.width > 150 && dimensions.height > 40 && dimensions.left >= 0 && dimensions.right <= width, `notice image remains visible within ${width}px`);
    assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
  }
  await screenshot('public-notice-1440');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 1050, deviceScaleFactor: 1, mobile: true });
  await screenshot('public-notice-390');
  await evaluate(`window.mountPublic('/notifications?notice=${eventNoticeId}')`);
  await until('document.querySelector("article a[href^=\\"/events/\\"]")');
  assert.equal(await evaluate('document.querySelector("article a[href^=\\"/events/\\"]").getAttribute("href")'), '/events/' + eventId);
  const beforeReceipt = calls.filter(c => c.method === 'PATCH' && c.path.endsWith('/' + noticeId + '/open')).length;
  await evaluate(`window.mountPublic('/notifications?notice=${noticeId}&notificationSource=push')`);
  await until('!new URL(location.href).searchParams.has("notificationSource")');
  const ownKey = await evaluate('visitor.visitorIdentity().key');
  const opens = () => calls.filter(c => c.method === 'PATCH' && c.path.endsWith('/' + noticeId + '/open'));
  assert.equal(opens().length, beforeReceipt + 1, 'actual push URL is acknowledged once');
  assert.equal(opens().at(-1).key, ownKey, 'push receipt uses the current installation owner');
  assert.equal(opens().at(-1).body.channel, 'push');
  await evaluate('window.dispatchEvent(new Event("focus"));window.dispatchEvent(new Event("online"))');
  await pause(500);
  assert.equal(opens().length, beforeReceipt + 1, 'repeated lifecycle focus does not count another click');
  console.log('PASS: browser visitor first-use Allow/Later, deny, existing permission, offline opt-in/opt-out retry, installation expiry, late-permission race, login/logout ownership, real IndexedDB/service worker registration, public worker routing, responsive public screen/image/header and one-time owned click attribution. No external delivery.');
} finally {
  ws?.close(); chrome?.kill(); server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
