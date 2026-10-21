import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'activ-account-security-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const mutations = [], errors = [];
let bundle = '', css = '', chrome, ws;
let capabilities = { hasPassword: false, passwordStatus: 'not_set', linkedProviders: ['google'] };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
  if (url.pathname === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
  if (!url.pathname.startsWith('/api/')) return res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  let body = ''; for await (const chunk of req) body += chunk;
  if (req.method !== 'GET') mutations.push({ url: url.pathname, method: req.method, body: JSON.parse(body || '{}') });
  res.setHeader('Content-Type', 'application/json');
  let data = {};
  if (url.pathname.endsWith('/members/my-profile')) data = { id: 'fixture-member', fullName: 'Fixture member', name: 'Fixture member', email: 'fixture@example.test', phoneNumber: '9123456780', membershipStatus: 'pending', personalDetailsComplete: false, ...capabilities };
  else if (url.pathname.endsWith('/business-info') || url.pathname.endsWith('/declaration-info')) { res.statusCode = 404; data = null; }
  else if (/\/regions\/|\/applications\//.test(url.pathname)) data = [];
  else if (url.pathname.endsWith('/auth/forgot-password')) data = { sent: true };
  res.end(JSON.stringify({ success: true, data }));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
try {
  const assets = await readdir(path.join(root, 'dist/assets'));
  css = await readFile(path.join(root, 'dist/assets', assets.find(file => /^index-.*\.css$/.test(file))), 'utf8');
  const result = await build({ absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"test"', 'import.meta.env': JSON.stringify({ DEV: true, VITE_API_URL: `${base}/api/v1` }) },
    plugins: [{ name: 'isolated-account-chrome', setup(builder) {
      builder.onResolve({ filter: /(?:MemberPageShell|AssociationUpdatePreferences|BrowserPushSettings|useMembershipGate)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'tsx', resolveDir: root, contents: args.path.endsWith('useMembershipGate')
        ? 'export const useMembershipGate=()=>({isPaid:false});'
        : args.path.endsWith('MemberPageShell') ? 'import React from "react";export default function Shell({children}){return <main style={{maxWidth:1000,margin:"auto",padding:16}}>{children}</main>}'
          : 'export default function Stub(){return null}' }));
    } }],
    stdin: { resolveDir: root, loader: 'tsx', contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter,Routes,Route} from 'react-router-dom';import {Toaster} from 'sonner';import Settings from './src/features/member/pages/AccountSettings';import Profile from './src/pages/member/Profile';import Forgot from './src/pages/auth/ForgotPassword';localStorage.setItem('token','fixture-only');localStorage.setItem('role','member');createRoot(document.getElementById('root')).render(<BrowserRouter><Routes><Route path='/settings' element={<Settings/>}/><Route path='/profile' element={<Profile/>}/><Route path='/forgot-password' element={<Forgot/>}/></Routes><Toaster/></BrowserRouter>);` }
  });
  bundle = result.outputFiles[0].text;
  chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--disable-extensions', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let port; for (let i = 0; i < 150; i++) { try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch {} await pause(100); }
  assert(port, 'Chrome starts');
  const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(res => res.json());
  ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve));
  let seq = 0; const pending = new Map();
  ws.addEventListener('message', event => { const value = JSON.parse(event.data); if (value.method === 'Runtime.exceptionThrown') errors.push(value.params.exceptionDetails.exception?.description || value.params.exceptionDetails.text); pending.get(value.id)?.(value); pending.delete(value.id); });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq, timer = setTimeout(() => { pending.delete(id); reject(Error(method + ' timed out')); }, 20000);
    pending.set(id, result => { clearTimeout(timer); result.error ? reject(Error(result.error.message)) : resolve(result); });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => { const value = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (value.result?.exceptionDetails) throw Error(value.result.exceptionDetails.exception?.description || value.result.exceptionDetails.text); return value.result?.result?.value; };
  const until = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(`Boolean(${expression})`)) return; await pause(75); } throw Error(`${expression}\n${await evaluate('document.body.innerText')}`); };
  const click = label => evaluate(`[...document.querySelectorAll('button,a')].find(node=>node.textContent.trim()===${JSON.stringify(label)}).click()`);
  const currentInputs = 'document.querySelectorAll("input[autocomplete=current-password]").length';
  const open = async route => { await send('Page.navigate', { url: base + route + '?step=1&case=' + Date.now() }); await until('document.body.innerText.includes("Sign-in methods") || document.body.innerText.includes("Set your ACTIV password") || document.querySelector("input[autocomplete=current-password]")'); };
  await send('Runtime.enable'); await send('Network.enable'); await send('Network.setBlockedURLs', { urls: ['https://*'] });
  for (const width of [320, 390, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 950, deviceScaleFactor: 1, mobile: width < 600 });
    for (const route of ['/settings', '/profile']) {
      capabilities = { hasPassword: false, passwordStatus: 'not_set', linkedProviders: ['google', 'linkedin', 'facebook'] };
      await open(route);
      assert.equal(await evaluate(currentInputs), 0, `${route}: provider-only has no current-password field`);
      if (route === '/profile') {
        assert.equal(await evaluate('document.querySelectorAll("input[autocomplete=new-password]").length'), 2);
        assert(await evaluate('document.body.innerText.includes("Your social sign-in will keep working")'));
      } else assert(await evaluate('document.body.innerText.includes("Google, LinkedIn, Facebook") && document.body.innerText.includes("No ACTIV password is needed")'));
      assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), `${route}: no overflow at ${width}px`);
      if (process.env.TEST_ARTIFACTS) { await mkdir(process.env.TEST_ARTIFACTS, { recursive: true }); const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); await writeFile(path.join(process.env.TEST_ARTIFACTS, `${route.slice(1)}-${width}.png`), Buffer.from(shot.result.data, 'base64')); }
      if (route === '/profile') continue;
      await click('Set an ACTIV password (optional)');
      await until('location.pathname === "/forgot-password" && document.querySelector("#fp-email")');
      assert(await evaluate('document.body.innerText.includes("An ACTIV password is optional")'));
      assert.equal(mutations.length, 0, 'opening setup never sends an email or changes a password');
    }
  }
  for (const route of ['/settings', '/profile']) {
    capabilities = { hasPassword: true, passwordStatus: 'legacy_unknown', linkedProviders: ['google'] };
    await open(route); assert.equal(await evaluate(currentInputs), 0);
    assert(!(await evaluate('document.body.innerText')).includes('This account does not have an ACTIV password.'));
    await click('I know my ACTIV password'); await until('document.querySelector("input[autocomplete=current-password]")');
    assert.equal(await evaluate(currentInputs), 1, `${route}: legacy known-password option still exists`);
    capabilities = { hasPassword: true, passwordStatus: 'set', linkedProviders: ['google'] };
    await open(route); assert.equal(await evaluate(currentInputs), 1, `${route}: linked password account retains validation`);
  }
  await open('/settings');
  await click('Update password'); await until('document.body.innerText.includes("Enter your current password")');
  assert.equal(mutations.length, 0);
  const fill = async (autocomplete, value) => evaluate(`{const input=document.querySelector('input[autocomplete=${autocomplete}]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));}`);
  await fill('current-password', 'Existing-password-1');
  await evaluate(`{const inputs=document.querySelectorAll('input[autocomplete=new-password]');for(const input of inputs){Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'New-password-2');input.dispatchEvent(new Event('input',{bubbles:true}));}}`);
  await click('Update password'); await until('document.body.innerText.includes("Your password has been changed")');
  assert.deepEqual(mutations[0], { url: '/api/v1/auth/change-password', method: 'POST', body: { oldPassword: 'Existing-password-1', newPassword: 'New-password-2' } });
  await send('Page.navigate', { url: base + '/forgot-password' }); await until('document.querySelector("#fp-email")');
  await evaluate(`{const input=document.querySelector('#fp-email');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'fixture@example.test');input.dispatchEvent(new Event('input',{bubbles:true}));}`);
  await click('Send reset link'); await until('document.body.innerText.includes("Check your email")');
  assert.deepEqual(mutations[1], { url: '/api/v1/auth/forgot-password', method: 'POST', body: { email: 'fixture@example.test', portal: 'member' } });
  assert.deepEqual(errors, []);
  console.log('PASS: social-only and legacy account/profile forms, provider labels, verified-email setup intent, existing-password validation, and 320/390/1440px layout. All requests stayed on the local mock server.');
  await send('Browser.close');
} finally {
  ws?.close(); chrome?.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  const resolved = path.resolve(profile);
  if (resolved.startsWith(path.resolve(tmpdir()) + path.sep + 'activ-account-security-')) await rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
