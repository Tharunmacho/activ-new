import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const root = fileURLToPath(new URL('..', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'activ-social-recovery-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let chrome, ws, bundle = '', css = '';
const requests = [];
const bodies = [];
const delayed = new Map();
const server = http.createServer((req, res) => {
  if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
  if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
  if (req.url.startsWith('/api/')) {
    requests.push(req.url); let raw = '';
    req.on('data', chunk => { raw += chunk; }); req.on('end', () => {
      let body = {}; try { body = JSON.parse(raw || '{}'); } catch {}
      bodies.push({ url: req.url, body }); res.setHeader('Content-Type', 'application/json');
      const profile = { _id: 'existing-member', fullName: 'Existing Member', membershipStatus: 'pending', registrationIncomplete: true };
      const session = id => ({ token: 'fixture-session', role: 'member', user: { id, fullName: 'Fixture Member', email: 'existing@example.test', role: 'member' }, memberDetails: { ...profile, _id: id } });
      if (req.url.endsWith('/auth/oauth/exchange')) {
        if (body.code === 'cancel-initial' || (body.code === 'cancel-verification' && body.verificationCode)) {
          delayed.set(body.code, () => res.end(JSON.stringify({ data: session('stale-account') })));
          return;
        }
        if (body.code === 'new-google') return res.end(JSON.stringify({ data: session('new-member') }));
        if (!body.verificationCode) return res.end(JSON.stringify({ data: { requiresEmailVerification: true, email: 'existing@example.test', provider: 'facebook' } }));
        if (body.verificationCode !== '123456') { res.statusCode = 400; return res.end(JSON.stringify({ message: 'That verification code is incorrect or expired.' })); }
        return res.end(JSON.stringify({ data: session('existing-member') }));
      }
      if (req.url.endsWith('/auth/oauth/verify-email')) return res.end(JSON.stringify({ data: { sent: true, email: body.email } }));
      if (req.url.endsWith('/members/my-profile')) return res.end(JSON.stringify({ data: profile }));
      res.end(JSON.stringify({ data: {} }));
    }); return;
  }
  res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body style="margin:0"><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  const assets = await readdir(path.join(root, 'dist/assets'));
  css = await readFile(path.join(root, 'dist/assets', assets.find(file => /^index-.*\.css$/.test(file))), 'utf8');
  const built = await build({ absWorkingDir: root, bundle: true, write: false, outfile: 'social-recovery-fixture.js', format: 'iife', platform: 'browser', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"test"', 'import.meta.env': JSON.stringify({ DEV: true, VITE_API_URL: `http://127.0.0.1:${server.address().port}/api/v1` }) },
    stdin: { resolveDir: root, loader: 'tsx', contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter,Routes,Route,useNavigate} from 'react-router-dom';import Screen from './src/pages/auth/SocialSignIn';import FloatingLaunchers from './src/components/layout/FloatingLaunchers';function Fixture(){const navigate=useNavigate();window.fixtureNavigate=navigate;return <><Routes><Route path='/auth/social' element={<Screen/>}/><Route path='*' element={<p>Fixture destination</p>}/></Routes><FloatingLaunchers/></>}createRoot(document.getElementById('root')).render(<BrowserRouter><Fixture/></BrowserRouter>);` }
  });
  bundle = built.outputFiles.find(file => file.path.endsWith('.js')).text;
  css += built.outputFiles.find(file => file.path.endsWith('.css'))?.text || '';
  chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--disable-extensions', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let port; for (let i = 0; i < 150; i++) { try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch {} await pause(100); }
  assert(port, 'Chrome started');
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve));
  let seq = 0; const pending = new Map(), errors = [];
  ws.addEventListener('message', event => { const value = JSON.parse(event.data); if (value.method === 'Runtime.exceptionThrown') errors.push(value.params.exceptionDetails.text); pending.get(value.id)?.(value); pending.delete(value.id); });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq, timer = setTimeout(() => reject(Error(method)), 45000); pending.set(id, value => { clearTimeout(timer); resolve(value); }); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const value = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (value.result?.exceptionDetails) throw Error(value.result.exceptionDetails.text); return value.result?.result?.value; };
  const until = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(`Boolean(${expression})`)) return; await pause(100); } throw Error(`${expression}\n${await evaluate('document.body.innerText')}\nRequests: ${JSON.stringify(bodies)}`); };
  await send('Runtime.enable'); await send('Network.enable'); await send('Network.setBlockedURLs', { urls: ['https://*'] });
  for (const width of [320, 390, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
    for (const error of ['no_email', 'email_permission', 'facebook_no_email']) {
      await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/auth/social?case=${width}-${error}#provider=facebook&error=${error}` });
      await until(`location.hash==='' && document.body.innerText.includes('Try Facebook again')`);
      assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'), `Fits ${width}px`);
      assert.equal(await evaluate('location.hash'), '', 'callback details removed from history');
      assert(await evaluate(`[...document.querySelectorAll('a')].some(a=>a.textContent.trim()==='Try Facebook again'&&a.pathname==='/api/v1/auth/oauth/facebook/start')`));
      assert(await evaluate(`[...document.querySelectorAll('a')].some(a=>a.textContent.trim()==='Use email and password'&&a.pathname==='/login')`));
      assert(await evaluate(`!document.body.innerText.includes('WhatsApp')&&!document.body.innerText.includes('Donate')&&!document.body.innerText.includes('Chat with us')`), 'floating widgets never cover authentication');
    }
    if (process.env.TEST_ARTIFACTS) {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      await writeFile(path.join(process.env.TEST_ARTIFACTS, `facebook-recovery-${width}.png`), Buffer.from(shot.result.data, 'base64'));
    }
  }
  await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/auth/social?case=linkedin#provider=linkedin&error=no_email` });
  await until(`document.body.innerText.includes('verified email')`);
  assert(await evaluate(`!document.body.innerText.includes('Try Facebook again')`));
  assert.deepEqual(requests, [], 'no session is requested when Facebook supplies no email');
  const input = async (id, value) => evaluate(`(()=>{const element=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,${JSON.stringify(value)});element.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);
  const click = async label => evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===${JSON.stringify(label)}).click()`);
  for (const width of [320, 390, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/auth/social?verification=${width}#provider=facebook&code=confirm-facebook` });
    await until(`document.body.innerText.includes('Confirm your email') && document.getElementById('social-email')`);
    assert.equal(await evaluate(`localStorage.getItem('userId')`), null, 'no account before verification');
    assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'), `Email challenge fits ${width}px`);
    await click('Send verification code');
    await until(`document.getElementById('social-code')`);
    await input('social-code', '000000'); await click('Verify and open dashboard');
    await until(`document.body.innerText.includes('incorrect or expired')`);
    assert.equal(await evaluate(`localStorage.getItem('userId')`), null);
    await input('social-code', '123456');
    if (process.env.TEST_ARTIFACTS) {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      await writeFile(path.join(process.env.TEST_ARTIFACTS, `social-email-verification-${width}.png`), Buffer.from(shot.result.data, 'base64'));
    }
    await click('Verify and open dashboard');
    await until(`location.pathname==='/member/unpaid-dashboard'`);
    assert.equal(await evaluate(`localStorage.getItem('userId')`), 'existing-member', 'same identity reaches dashboard before application completion');
    assert.equal(await evaluate(`localStorage.getItem('role')`), 'member');
  }
  await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/auth/social?new-account#provider=google&code=new-google` });
  await until(`location.pathname==='/member/unpaid-dashboard'`);
  assert.equal(await evaluate(`localStorage.getItem('userId')`), 'new-member', 'new verified social account goes directly to dashboard');
  for (const code of ['cancel-initial', 'cancel-verification']) {
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/auth/social#provider=facebook&code=${code}` });
    if (code === 'cancel-verification') {
      await until(`document.getElementById('social-email')`);
      await click('Send verification code');
      await until(`document.getElementById('social-code')`);
      await input('social-code', '123456');
      await click('Verify and open dashboard');
    }
    for (let i = 0; i < 100 && !delayed.has(code); i++) await pause(25);
    assert(delayed.has(code), `${code} response is pending`);
    if (code === 'cancel-verification') await evaluate(`[...document.querySelectorAll('a')].find(a=>a.textContent.trim()==='Back to sign in').click()`);
    else await evaluate(`window.fixtureNavigate('/login')`);
    await until(`location.pathname==='/login' && document.body.innerText.includes('Fixture destination')`);
    await evaluate(`localStorage.setItem('userId','newer-login');localStorage.setItem('token','newer-token')`);
    delayed.get(code)(); delayed.delete(code);
    await pause(500);
    assert.equal(await evaluate(`localStorage.getItem('userId')`), 'newer-login', `${code} cannot replace a newer session after leaving`);
    assert.equal(await evaluate(`location.pathname`), '/login', `${code} cannot navigate after leaving`);
  }
  assert(bodies.some(row => row.url.endsWith('/auth/oauth/verify-email') && row.body.email === 'existing@example.test'));
  assert.deepEqual(errors, []);
  console.log('PASS social sign-in: legacy recovery, private email challenge, wrong-code retry, same-account recovery, new-account dashboard, no session before verification, cancelled direct/OTP responses preserve newer sessions, and 320/390/1440px.');
  await send('Browser.close');
} finally {
  ws?.close(); chrome?.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  if (path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep + 'activ-social-recovery-')) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
