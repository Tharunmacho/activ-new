// Real Chrome + IndexedDB + service worker registration, with a fake FCM adapter.
// No Firebase requests or member notifications are sent.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, stop } from 'esbuild';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'activ-push-test-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const env = Object.fromEntries(['API_KEY', 'PROJECT_ID', 'MESSAGING_SENDER_ID', 'APP_ID', 'VAPID_KEY'].map(k => ['VITE_FIREBASE_' + k, 'fixture']));
const calls = [];
let bundle = '', css = '', chrome, ws, rejectRegistration = false, providerReady = true, workerReady = true;
const server = http.createServer(async (req, res) => {
  if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
  if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
  if (req.url === '/firebase-messaging-sw.js') {
    res.setHeader('Content-Type', 'text/javascript');
    return res.end(`self.addEventListener('install',e=>e.waitUntil(self.skipWaiting())); self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));`);
  }
  if (req.url === '/api/v1/notifications/push/devices') {
    let body = ''; for await (const chunk of req) body += chunk;
    calls.push({ method: req.method, auth: req.headers.authorization, body: JSON.parse(body) });
    if (req.method === 'POST' && rejectRegistration) { res.statusCode = 503; return res.end('{}'); }
    res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ data: { configured: providerReady, ready: providerReady && workerReady } }));
  }
  if (req.url === '/api/v1/auth/logout') {
    res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ data: {} }));
  }
  res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
env.VITE_API_URL = origin + '/api/v1';
try {
  const assets = await readdir(path.join(root, 'dist/assets'));
  css = await readFile(path.join(root, 'dist/assets', assets.find(name => /^index-.*\.css$/.test(name))), 'utf8');
  const built = await build({ bundle: true, write: false, format: 'iife', jsx: 'automatic', absWorkingDir: root,
    define: { 'import.meta.env': JSON.stringify(env), 'process.env.NODE_ENV': '"test"' },
    plugins: [{ name: 'fake-fcm', setup(b) {
      b.onResolve({ filter: /^firebase\/(app|messaging)$/ }, args => ({ path: args.path, namespace: 'fake' }));
      b.onLoad({ filter: /.*/, namespace: 'fake' }, args => ({ contents: args.path.endsWith('/app')
        ? 'export const getApps=()=>[];export const initializeApp=()=>({});'
        : `export const isSupported=async()=>true;export const getMessaging=()=>({});
           export const getToken=async()=>{if(window.holdToken)await new Promise(r=>window.releaseToken=r);return window.fcmToken || 'test-browser-device-token-123456789';};
           export const deleteToken=async()=>{window.deleted=true;return true;};
           export const onMessage=(m,fn)=>{window.receivePush=fn;return ()=>window.receivePush=null;};` }));
    } }],
    stdin: { resolveDir: root, loader: 'tsx', contents: `
      import React from 'react';import {createRoot} from 'react-dom/client';
      import Settings from './src/components/BrowserPushSettings';
      import {Toaster,toast} from 'sonner';
      import * as push from './src/services/browserPush';
      import * as identity from './src/lib/pushIdentity';
      import {clearSession} from './src/services/api';
      import {logout} from './src/services/activApi';
      Object.assign(window,{push,identity,clearSession,logout,toast});
      window.permission='granted';
      Object.defineProperty(Notification,'permission',{get:()=>window.permission});
      Notification.requestPermission=async()=>window.permission;
      window.trayNotifications=[];
      ServiceWorkerRegistration.prototype.showNotification=async function(title,options){
        if(window.rejectTray)throw Error('OS display unavailable');
        window.trayNotifications.push({title,options});
      };
      window.signIn=id=>localStorage.setItem('token','x.'+btoa(JSON.stringify({userId:id,exp:Math.floor(Date.now()/1000)+3600}))+'.x');
      window.signIn('member-a');
      createRoot(document.getElementById('root')).render(<><Settings/><Toaster/></>);
    ` } });
  bundle = built.outputFiles[0].text;
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
    const id = ++seq, timer = setTimeout(() => reject(Error(method)), 15000);
    pending.set(id, r => { clearTimeout(timer); resolve(r); }); ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw Error(r.result.exceptionDetails.exception?.description);
    return r.result?.result?.value;
  };
  const until = async expression => { for (let i = 0; i < 80; i++) { if (await evaluate(`(async()=>Boolean(${expression}))()`)) return; await pause(100); } throw Error(expression + '\n' + errors.join('\n')); };
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['https://*'] });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: origin });
  await until('window.push && document.querySelector("button")');
  rejectRegistration = true;
  await evaluate('document.querySelector("button").click();document.querySelector("button").click()');
  await until('document.body.textContent.includes("Could not register this browser") && !document.querySelector("button").disabled');
  assert.equal(calls.length, 1, 'Rapid enable clicks make one registration request');
  assert.equal(await evaluate('push.browserPushRegistered()'), false, 'Permission and opt-in cannot claim a failed registration succeeded');
  assert.equal(await evaluate('push.pushEnabled()'), true, 'The opt-in remains available for a later retry');
  assert.equal(await evaluate('document.querySelector("button").textContent'), 'Enable notifications');
  assert.equal(await evaluate('document.body.textContent.includes("Turn off for this browser")'), false);
  assert.match(await evaluate('push.browserPushStatus()'), /not connected yet/);
  rejectRegistration = false;
  providerReady = false;
  await evaluate('document.querySelector("button").click()');
  await until('document.body.textContent.includes("still being configured") && !document.querySelector("button").disabled');
  assert.equal(await evaluate('push.browserPushRegistered()'), false, 'Saved device cannot claim enabled while server authentication is unavailable');
  assert.equal((await evaluate('identity.readPushIdentity()')).configured, false);
  assert.match(await evaluate('push.browserPushStatus()'), /not ready on the server/);
  assert.equal(await evaluate('push.browserPushSubscribed()'), true, 'Saved consent remains separate from delivery readiness');
  assert.equal(await evaluate('document.body.textContent.includes("Turn off for this browser")'), true, 'An outage never hides the saved-registration revoke control');
  await evaluate('[...document.querySelectorAll("button")].find(button=>button.textContent==="Turn off for this browser").click()');
  await until('!(await identity.readPushIdentity()) && !document.querySelector("button").disabled');
  assert.equal(await evaluate('push.browserPushSubscribed()'), false, 'Turn off revokes consent while the provider is unavailable');
  providerReady = true;
  workerReady = false;
  await evaluate('push.enableBrowserPush().catch(()=>{})');
  assert.equal(await evaluate('push.browserPushRegistered()'), false, 'A paused delivery worker cannot be shown as enabled');
  workerReady = true;
  await evaluate('document.querySelector("button").click()');
  await until('document.body.textContent.includes("enabled for this account")');
  assert.equal((await evaluate('identity.readPushIdentity()')).userId, 'member-a');
  assert.equal(await evaluate('push.browserPushRegistered()'), true);
  await evaluate('window.savedIdentity=identity.readPushIdentity();');
  await evaluate('(async()=>identity.writePushIdentity({...await window.savedIdentity,expiresAt:Date.now()-1}))()');
  assert.equal(await evaluate('push.browserPushRegistered()'), false, 'Expired registration is not shown as enabled');
  await evaluate('(async()=>identity.writePushIdentity(await window.savedIdentity))()');
  await evaluate('signIn("different-member");window.dispatchEvent(new Event("focus"))');
  assert.equal(await evaluate('push.browserPushRegistered()'), false, 'A different account cannot inherit the enabled badge');
  await until('document.querySelector("button").textContent === "Enable notifications" && !document.body.textContent.includes("Turn off for this browser")');
  await evaluate('signIn("member-a");push.syncBrowserPush()');
  assert.equal(calls[0].body.platform, 'web');
  const workerRegistration = await evaluate(`(async()=>{const registration=await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');return {scope:registration.scope,scriptURL:registration.active.scriptURL,updateViaCache:registration.updateViaCache}})()`);
  assert.deepEqual(workerRegistration, {scope:origin+'/',scriptURL:origin+'/firebase-messaging-sw.js',updateViaCache:'none'}, 'Worker controls the site root and bypasses cached update scripts');
  await evaluate(`window.receivePush({data:{userId:'member-a',kind:'announcement',sourceId:'foreground-notice',notificationId:'abcdef0123456789abcdef01',title:'Private member title'}})`);
  await until('document.querySelector("[data-sonner-toast]")');
  assert(await evaluate('document.querySelector("[data-sonner-toast]").textContent.includes("You have an update from ACTIV.")'));
  assert(!await evaluate('document.querySelector("[data-sonner-toast]").textContent.includes("Private member title")'), 'Foreground push uses a generic notice');
  const tray = await evaluate('window.trayNotifications');
  assert.equal(tray.length, 1, 'An enabled foreground page also posts a system-tray notification');
  assert.equal(tray[0].title, 'ACTIV');
  assert.equal(tray[0].options.data.activPush, true, 'Tray click uses the same ownership-checked worker route');
  assert.equal(tray[0].options.tag, 'abcdef0123456789abcdef01');
  assert(!(tray[0].title + tray[0].options.body).includes('Private member title'), 'Private title must not appear in system notification text');
  await evaluate(`window.receivePush({data:{userId:'member-other',notificationId:'wrong-account'}})`);
  assert.equal(await evaluate('document.querySelectorAll("[data-sonner-toast]").length'), 1, 'Foreground ignores another account');
  assert.equal(await evaluate('window.trayNotifications.length'), 1, 'Another account cannot create a tray notification');
  await evaluate(`Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});window.receivePush({data:{userId:'member-a',notificationId:'hidden-window'}})`);
  assert.equal(await evaluate('document.querySelectorAll("[data-sonner-toast]").length'), 1, 'Hidden pages do not duplicate background notifications');
  assert.equal(await evaluate('window.trayNotifications.length'), 1, 'Hidden page leaves background display to the worker');
  await evaluate(`Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});toast.dismiss()`);
  assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'settings fit a narrow phone');
  for (const width of [320, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
    assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), `settings fit at ${width}px`);
  }
  await evaluate('window.fcmToken="refreshed-browser-device-token-123456789";push.syncBrowserPush()');
  assert.equal(calls.at(-2).method, 'DELETE', 'token refresh removes the previous registration');
  assert.equal(calls.at(-1).body.token, 'refreshed-browser-device-token-123456789');
  await evaluate('window.permission="denied";push.syncBrowserPush()');
  assert.equal(await evaluate('identity.readPushIdentity()'), null, 'revoked permission clears the worker identity');
  assert.equal(calls.at(-1).method, 'DELETE', 'revoked permission unregisters the browser');
  assert.equal(await evaluate('window.receivePush'), null, 'revoked permission removes the foreground listener');
  await evaluate('window.permission="granted";push.syncBrowserPush()');
  await evaluate('push.clearBrowserPushSession()');
  assert.equal(await evaluate('identity.readPushIdentity()'), null, 'logout clears persisted worker identity');
  assert.equal(calls.at(-1).method, 'DELETE');
  await evaluate("signIn('member-b');push.syncBrowserPush()");
  assert.equal((await evaluate('identity.readPushIdentity()')).userId, 'member-b');
  assert.equal(await evaluate("(async()=>identity.ownsPush(await identity.readPushIdentity(), {userId:'member-a'}))()"), false);
  // A direct account switch must revoke the old worker identity before Firebase finishes.
  await evaluate("signIn('member-c');window.holdToken=true;window.switching=push.syncBrowserPush();void 0");
  await until('window.releaseToken');
  assert.equal(await evaluate('identity.readPushIdentity()'), null);

  await evaluate('window.releaseToken();window.holdToken=false;window.switching');
  assert.equal((await evaluate('identity.readPushIdentity()')).userId, 'member-c');
  await evaluate('window.releaseToken=null');
  await evaluate('logout()');
  assert.equal(await evaluate('identity.readPushIdentity()'), null, 'shared logout waits for worker identity removal');
  assert.equal(await evaluate('localStorage.getItem("token")'), null, 'shared logout clears the session');
  assert.equal(calls.at(-1).method, 'DELETE', 'shared logout unregisters the browser');
  await evaluate("signIn('member-b');push.syncBrowserPush()");
  await evaluate('push.disableBrowserPush()');
  assert.equal(await evaluate('identity.readPushIdentity()'), null);
  assert.equal(await evaluate('window.deleted'), true);
  const count = calls.length;
  await evaluate('window.permission="denied";document.querySelector("button").click()');
  await until('document.body.textContent.includes("not allowed")');
  assert.equal(calls.length, count, 'denied permission does not register a device');
  await evaluate('window.permission="granted";localStorage.removeItem("token");window.dispatchEvent(new Event("focus"))');
  await until('document.body.textContent.includes("Sign in again to connect notifications to your account")');
  await evaluate('document.querySelector("button").click()');
  await until('!document.querySelector("button").disabled');
  assert.equal(calls.length, count, 'An expired settings session cannot silently register public visitor notifications');
  assert.equal(await evaluate('push.browserPushRegistered(true)'), false);
  await evaluate('signIn("member-b")');
  // Logout while FCM is obtaining a token must not register the previous account.
  await evaluate('window.permission="granted";window.holdToken=true;window.enabling=push.enableBrowserPush();void 0');
  await until('window.releaseToken');
  await evaluate('identity.writePushIdentity({userId:"member-b",expiresAt:Date.now()+60000})');
  await evaluate('window.clearing=clearSession();void 0');
  await until('(await identity.readPushIdentity()) === null');
  assert.equal(await evaluate('localStorage.getItem("token")'), null, 'session token is removed before waiting on Firebase');
  await evaluate('window.releaseToken();window.holdToken=false;');
  await evaluate('Promise.all([window.enabling,window.clearing])');
  assert.equal(await evaluate('identity.readPushIdentity()'), null);
  assert.equal(calls.length, count, 'late token result cannot re-register a logged-out account');

  // A disconnected Firebase request must not hold logout indefinitely.
  await evaluate('signIn("member-b");window.holdToken=true;window.releaseToken=null;window.registrationError=null;window.stalled=push.enableBrowserPush().catch(error=>window.registrationError=error.message);void 0');
  await until('window.releaseToken');
  await evaluate('clearSession()');
  assert.equal(await evaluate('window.registrationError'), null, 'logout cancels pending SDK work without showing a connection error');
  await evaluate('window.releaseToken();window.holdToken=false;');
  await pause(100);
  assert.equal(calls.length, count, 'late SDK result after timeout cannot register a signed-out account');
  assert.equal(await evaluate('identity.readPushIdentity()'), null);

  // Revocation while Firebase obtains a token must prevent a late registration.
  await evaluate('signIn("member-b");window.permission="granted";window.holdToken=true;window.releaseToken=null;window.revoking=push.enableBrowserPush();void 0');
  await until('window.releaseToken');
  const registrationsBeforeRevocation = calls.length;
  await evaluate('window.permission="denied";window.releaseToken();window.holdToken=false;window.revoking');
  assert.equal(calls.length, registrationsBeforeRevocation, 'Permission revoked during token retrieval cannot register the browser');
  assert.equal(await evaluate('identity.readPushIdentity()'), null);

  // Exercise the actual worker's background and click handlers with a fake Firebase adapter.
  const worker = await build({ entryPoints: [path.join(root, 'src/firebaseMessagingWorker.ts')], bundle: true, write: false, format: 'iife',
    define: { 'import.meta.env': JSON.stringify(env) }, plugins: [{ name: 'worker-fixtures', setup(b) {
      b.onResolve({ filter: /^firebase\// }, args => ({ path: args.path, namespace: 'fake' }));
      b.onLoad({ filter: /.*/, namespace: 'fake' }, args => ({ contents: args.path.endsWith('/app') ? 'export const initializeApp=()=>({});'
        : 'export const getMessaging=()=>({});export const onBackgroundMessage=(m,fn)=>globalThis.background=fn;' }));
      b.onResolve({ filter: /\/lib\/pushIdentity$/ }, () => ({ path: 'identity', namespace: 'identity' }));
      b.onLoad({ filter: /.*/, namespace: 'identity' }, () => ({ contents: `export const readPushIdentity=async()=>globalThis.identity;
        export {ownsPush} from ${JSON.stringify(path.join(root, 'src/lib/pushIdentity.ts'))};`, resolveDir: root }));
    } }] });
  const handlers = {}, displayed = [], opened = [], navigated = [];
  let focused = 0, activated = 0, installed = 0;
  const context = vm.createContext({ URL, Date, identity: { userId: 'member-b', expiresAt: Date.now() + 60000 },
    self: { addEventListener: (name, fn) => handlers[name] = fn, location: { origin }, skipWaiting:async()=>{installed++;},
      registration: { showNotification: async (title, options) => displayed.push({ title, ...options }) },
      clients: { claim:async()=>{activated++;},matchAll: async () => [], openWindow: async url => opened.push(url) } } });
  vm.runInContext(worker.outputFiles[0].text, context);
  let lifecycle; handlers.install({waitUntil:promise=>lifecycle=promise}); await lifecycle; handlers.activate({waitUntil:promise=>lifecycle=promise}); await lifecycle;
  assert.equal(installed,1); assert.equal(activated,1,'Updated worker activates and claims clients');
  await context.background({ data: { userId: 'member-a', notificationId: 'old' } });
  assert.equal(displayed.length, 0, 'worker ignores a previous account');
  await context.background({ data: { userId: 'member-b', kind: 'announcement', sourceId: 'notice-1' } });
  assert.equal(displayed.length, 1);
  let clicked;
  handlers.notificationclick({ notification: { ...displayed[0], close() {} }, stopImmediatePropagation() {}, waitUntil: p => clicked = p });
  await clicked;
  assert.equal(opened[0], origin + '/member/updates/notice-1');
  context.self.clients.matchAll = async()=>[{url:origin+'/news',navigate:async url=>{navigated.push(url);},focus:async()=>{focused++;}}];
  handlers.notificationclick({ notification:{...displayed[0],close(){}},stopImmediatePropagation(){},waitUntil:promise=>clicked=promise }); await clicked;
  assert.equal(navigated[0],origin+'/member/updates/notice-1'); assert.equal(focused,1,'Background click reuses and focuses the existing tab');
  context.self.clients.matchAll = async()=>[];
  for (const [data, destination] of [
    [{ kind: 'event', eventId: 'event-1', slug: 'annual-meeting' }, '/member/events/annual-meeting'],
    [{ event: 'EVENT_BOOKING_CONFIRMED', eventId: 'event-1', bookingRef: 'ACT 123' }, '/member/events/event-1/book?ref=ACT%20123'],
    [{ kind: 'message', conversationId: 'chat-1' }, '/member/messages?c=chat-1'],
    [{ event: 'MEMBERSHIP_ACTIVATED' }, '/member/plan'],
    [{ event: 'MEMBERSHIP_RENEWAL_DUE' }, '/member/plan'],
    [{ event: 'PAYMENT_FAILED', orderId: 'order/1' }, '/payment-success?orderId=order%2F1'],
    [{ event: 'DONATION_RECEIPT' }, '/member/donation-certificate'],
    [{ kind: 'news', slug: 'notice-1' }, '/news/notice-1'],
    [{ kind: 'gallery', slug: 'gallery-1' }, '/gallery/gallery-1'],
    [{ kind: 'scheme', slug: 'scheme-1' }, '/schemes/view/scheme-1'],
    [{ kind: 'test' }, '/super-admin/notifications'],
  ]) {
    await context.background({ data: { userId: 'member-b', ...data } });
    handlers.notificationclick({ notification: { ...displayed.at(-1), close() {} }, stopImmediatePropagation() {}, waitUntil: p => clicked = p });
    await clicked;
    assert.equal(opened.at(-1), origin + destination, `opens the correct destination for ${data.kind || data.event}`);
  }
  await context.background({ data: { userId: 'member-b', kind: 'announcement', sourceId: 'notice-1', notificationId: 'abcdef0123456789abcdef01' } });
  handlers.notificationclick({ notification: { ...displayed.at(-1), close() {} }, stopImmediatePropagation() {}, waitUntil: p => clicked = p });
  await clicked;
  const tracked = new URL(opened.at(-1));
  assert.equal(tracked.pathname, '/member/updates/notice-1');
  assert.equal(tracked.searchParams.get('notificationId'), 'abcdef0123456789abcdef01');
  assert.equal(tracked.searchParams.get('notificationSource'), 'push', 'only an actual notification click supplies open attribution');
  const openedCount = opened.length;
  context.identity = null;
  handlers.notificationclick({ notification: { ...displayed[0], close() {} }, stopImmediatePropagation() {}, waitUntil: p => clicked = p });
  await clicked;
  assert.equal(opened.length, openedCount, 'old notification cannot open after logout');
  context.identity = { userId: 'member-b', expiresAt: Date.now() - 1000 };
  const displayCount = displayed.length;
  await context.background({ data: { userId: 'member-b', kind: 'announcement', sourceId: 'expired' } });
  assert.equal(displayed.length, displayCount, 'expired sessions cannot display alerts');
  await evaluate('window.permission="granted";signIn("member-b");push.enableBrowserPush()');
  await evaluate(`window.receivePush({data:{userId:'member-b',kind:'announcement',sourceId:'foreground-notice',notificationId:'abcdef0123456789abcdef02'}})`);
  await until(`document.querySelector('[data-sonner-toast] button')`);
  await evaluate(`document.querySelector('[data-sonner-toast] button').click()`);
  await until(`location.pathname==='/member/updates/foreground-notice'`);
  assert.equal(await evaluate(`new URL(location.href).searchParams.get('notificationSource')`),'push','Foreground Open carries click attribution');
  console.log('PASS: browser opt-in/denial/revocation including late permission changes, token refresh, root worker scope/update lifecycle and IndexedDB, foreground generic display/ownership/visibility/Open navigation, shared logout, account switching, late-token race and deadline, responsive controls, background ownership, existing-tab focus and all notification destinations. No external delivery.');
} finally {
  if(ws?.readyState===WebSocket.OPEN)await new Promise(resolve=>{const timer=setTimeout(resolve,2000);ws.addEventListener('close',()=>{clearTimeout(timer);resolve();},{once:true});try{ws.send(JSON.stringify({id:1000000,method:'Browser.close'}));}catch{clearTimeout(timer);resolve();}});
  ws?.close(); if(chrome?.exitCode==null)chrome?.kill();chrome?.unref();stop();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  if(path.resolve(profile).startsWith(path.resolve(tmpdir())+path.sep+'activ-push-test-'))await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200}).catch(()=>{});
}
