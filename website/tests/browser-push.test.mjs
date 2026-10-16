// Real Chrome + IndexedDB + service worker registration, with a fake FCM adapter.
// No Firebase requests or member notifications are sent.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'activ-push-test-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const env = Object.fromEntries(['API_KEY', 'PROJECT_ID', 'MESSAGING_SENDER_ID', 'APP_ID', 'VAPID_KEY'].map(k => ['VITE_FIREBASE_' + k, 'fixture']));
const calls = [];
let bundle = '', css = '', chrome, ws;
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
    res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ data: { configured: true } }));
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
           export const getToken=async()=>{if(window.holdToken)await new Promise(r=>window.releaseToken=r);return 'test-browser-device-token-123456789';};
           export const deleteToken=async()=>{window.deleted=true;return true;};
           export const onMessage=(m,fn)=>{window.receivePush=fn;return ()=>window.receivePush=null;};` }));
    } }],
    stdin: { resolveDir: root, loader: 'tsx', contents: `
      import React from 'react';import {createRoot} from 'react-dom/client';
      import Settings from './src/components/BrowserPushSettings';
      import * as push from './src/services/browserPush';
      import * as identity from './src/lib/pushIdentity';
      import {clearSession} from './src/services/api';
      import {logout} from './src/services/activApi';
      Object.assign(window,{push,identity,clearSession,logout});
      window.permission='granted';
      Object.defineProperty(Notification,'permission',{get:()=>window.permission});
      Notification.requestPermission=async()=>window.permission;
      window.signIn=id=>localStorage.setItem('token','x.'+btoa(JSON.stringify({userId:id,exp:Math.floor(Date.now()/1000)+3600}))+'.x');
      window.signIn('member-a');
      createRoot(document.getElementById('root')).render(<Settings/>);
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
  await evaluate('document.querySelector("button").click()');
  await until('document.body.textContent.includes("enabled for this account")');
  assert.equal((await evaluate('identity.readPushIdentity()')).userId, 'member-a');
  assert.equal(calls[0].body.platform, 'web');
  assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'settings fit a narrow phone');
  for (const width of [320, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
    assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), `settings fit at ${width}px`);
  }
  await evaluate('push.clearBrowserPushSession()');
  assert.equal(await evaluate('identity.readPushIdentity()'), null, 'logout clears persisted worker identity');
  assert.equal(calls.at(-1).method, 'DELETE');
  await evaluate("signIn('member-b');push.syncBrowserPush()");
  assert.equal((await evaluate('identity.readPushIdentity()')).userId, 'member-b');
  assert.equal(await evaluate("(async()=>identity.ownsPush(await identity.readPushIdentity(), {userId:'member-a'}))()"), false);
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
  assert.match(await evaluate('window.registrationError'), /timed out/);
  await evaluate('window.releaseToken();window.holdToken=false;');
  await pause(100);
  assert.equal(calls.length, count, 'late SDK result after timeout cannot register a signed-out account');
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
  const handlers = {}, displayed = [], opened = [];
  const context = vm.createContext({ URL, Date, identity: { userId: 'member-b', expiresAt: Date.now() + 60000 },
    self: { addEventListener: (name, fn) => handlers[name] = fn, location: { origin },
      registration: { showNotification: async (title, options) => displayed.push({ title, ...options }) },
      clients: { matchAll: async () => [], openWindow: async url => opened.push(url) } } });
  vm.runInContext(worker.outputFiles[0].text, context);
  await context.background({ data: { userId: 'member-a', notificationId: 'old' } });
  assert.equal(displayed.length, 0, 'worker ignores a previous account');
  await context.background({ data: { userId: 'member-b', kind: 'announcement', sourceId: 'notice-1' } });
  assert.equal(displayed.length, 1);
  let clicked;
  handlers.notificationclick({ notification: { ...displayed[0], close() {} }, stopImmediatePropagation() {}, waitUntil: p => clicked = p });
  await clicked;
  assert.equal(opened[0], origin + '/member/updates/notice-1');
  context.identity = null;
  handlers.notificationclick({ notification: { ...displayed[0], close() {} }, stopImmediatePropagation() {}, waitUntil: p => clicked = p });
  await clicked;
  assert.equal(opened.length, 1, 'old notification cannot open after logout');
  console.log('PASS: browser opt-in/denial, real worker registration and IndexedDB, shared logout, account switching, late-token race and deadline, responsive controls, background ownership and notification clicks. No external delivery.');
} finally {
  ws?.close(); chrome?.kill();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
