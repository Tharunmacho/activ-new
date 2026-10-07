import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const root = fileURLToPath(new URL('..', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'activ-lifetime-browser-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let bundle = '', css = '', chrome, ws;
const requests = [];
let member = { id: 'account-test', fullName: 'Test Lifetime Member', email: 'member@example.test', phoneNumber: '9123456780', whatsappNumber: '9234567801', membershipTier: 'platinum', membershipType: 'lifetime', membershipStatus: 'active', platinumGrant: null };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
  if (url.pathname === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
  if (!url.pathname.startsWith('/api/')) return res.end('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  res.setHeader('Content-Type', 'application/json');
  let data = {};
  if (url.pathname.endsWith('/platinum')) data = { plan: { name: 'Lifetime membership', price: 200000 }, members: [member] };
  if (url.pathname.endsWith('/requests')) data = { requests: [], counts: { new: 0, contacted: 0, all: 0 } };
  if (url.pathname.endsWith('/account') && req.method === 'PATCH') {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw); requests.push(body);
    const { password, ...contact } = body; member = { ...member, ...contact }; data = member;
  }
  res.end(JSON.stringify({ success: true, data }));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
try {
  const files = await readdir(path.join(root, 'dist/assets'));
  css = await readFile(path.join(root, 'dist/assets', files.find(file => /^index-.*\.css$/.test(file))), 'utf8');
  const built = await build({ absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    define: { 'import.meta.env': JSON.stringify({ DEV: true, VITE_API_URL: `${base}/api/v1` }), 'process.env.NODE_ENV': '"test"' },
    stdin: { resolveDir: root, loader: 'tsx', contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {BrowserRouter} from 'react-router-dom'; import {Toaster} from 'sonner'; import PlatinumMembers from './src/features/admin/super-admin/components/PlatinumMembers'; createRoot(document.getElementById('root')).render(<BrowserRouter><PlatinumMembers/><Toaster/></BrowserRouter>);` } });
  bundle = built.outputFiles[0].text;
  chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let port;
  for (let i = 0; i < 100; i++) { try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch {} await pause(100); }
  assert(port, 'Chrome starts');
  const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve));
  let seq = 0; const pending = new Map(), exceptions = [];
  ws.addEventListener('message', event => { const msg = JSON.parse(event.data); if (msg.method === 'Runtime.exceptionThrown') exceptions.push(msg.params.exceptionDetails.text); pending.get(msg.id)?.(msg); pending.delete(msg.id); });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; const timer = setTimeout(() => reject(Error(method)), 15000); pending.set(id, r => { clearTimeout(timer); resolve(r); }); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw Error(r.result.exceptionDetails.exception?.description); return r.result?.result?.value; };
  const until = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(`Boolean(${expression})`)) return; await pause(100); } throw Error(expression); };
  const click = label => evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === ${JSON.stringify(label)}).click()`);
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: base });
  await until('document.body.innerText.includes("Test Lifetime Member")');
  assert(!(await evaluate('document.body.innerText')).includes('Platinum'));
  await click('Edit login and contact details');
  await until('document.querySelector("input[type=password]")');
  const fill = async (label, value) => evaluate(`{ const label = [...document.querySelectorAll('label')].find(l => l.textContent.trim() === ${JSON.stringify(label)}); const input = label.querySelector('input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event('input', {bubbles:true})); }`);
  await fill('Login email', 'updated@example.test'); await fill('Mobile number', '9345678012'); await fill('WhatsApp number', '9456780123'); await fill('New password', 'Browser-test-2026');
  await click('Save account details');
  await until('document.body.innerText.includes("Login and contact details saved")');
  assert.equal(requests.length, 1); assert.deepEqual(requests[0], { email: 'updated@example.test', phoneNumber: '9345678012', whatsappNumber: '9456780123', password: 'Browser-test-2026' });
  await click('Edit login and contact details');
  assert.equal(await evaluate('document.querySelector("input[type=password]").value'), '');
  assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'No mobile overflow');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'No desktop overflow');
  await click('Save account details'); await pause(350);
  assert.equal(requests[1].password, undefined, 'Blank password preserves the existing password');
  assert.deepEqual(exceptions, []);
  console.log('PASS: lifetime labels, account editor, email/mobile/WhatsApp/password request, saved state, password clearing, blank-password preservation, mobile and desktop layout.');
  await send('Browser.close');
} finally {
  ws?.close(); chrome?.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  const resolved = path.resolve(profile);
  if (resolved.startsWith(path.resolve(tmpdir()) + path.sep + 'activ-lifetime-browser-')) await rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
