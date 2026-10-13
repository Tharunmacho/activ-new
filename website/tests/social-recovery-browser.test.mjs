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
const server = http.createServer((req, res) => {
  if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
  if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
  if (req.url.startsWith('/api/')) { requests.push(req.url); res.statusCode = 400; return res.end('{}'); }
  res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body style="margin:0"><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  const assets = await readdir(path.join(root, 'dist/assets'));
  css = await readFile(path.join(root, 'dist/assets', assets.find(file => /^index-.*\.css$/.test(file))), 'utf8');
  bundle = (await build({ absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"test"', 'import.meta.env': JSON.stringify({ DEV: true, VITE_API_URL: `http://127.0.0.1:${server.address().port}/api/v1` }) },
    stdin: { resolveDir: root, loader: 'tsx', contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter} from 'react-router-dom';import Screen from './src/pages/auth/SocialSignIn';import FloatingLaunchers from './src/components/layout/FloatingLaunchers';createRoot(document.getElementById('root')).render(<BrowserRouter><Screen/><FloatingLaunchers/></BrowserRouter>);` }
  })).outputFiles[0].text;
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
  const until = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await pause(100); } throw Error(expression); };
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
  assert.deepEqual(errors, []);
  console.log('PASS Facebook recovery: missing email, declined permission, email-login fallback, safe retry target, no unauthenticated session, no overlapping widgets, 320/390/1440px.');
  await send('Browser.close');
} finally {
  ws?.close(); chrome?.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  if (path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep + 'activ-social-recovery-')) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
