import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'activ-public-browse-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let bundle = '', css = '', chrome, ws;
const server = http.createServer((req, res) => {
  if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
  if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
  res.setHeader('Content-Type', 'text/html');
  res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  const assets = await readdir(path.join(root, 'dist/assets'));
  css = await readFile(path.join(root, 'dist/assets', assets.find(f => /^index-.*\.css$/.test(f))), 'utf8');
  const built = await build({
    absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"test"' },
    stdin: { resolveDir: root, loader: 'tsx', contents: [
      "import React from 'react'; import {createRoot} from 'react-dom/client';",
      "import {BrowserRouter, Routes, Route, Link} from 'react-router-dom';",
      "import Gate from './src/components/NativePublicAppGate';",
      "import {nativePublicActionPath, requestNativeMemberAction} from './src/lib/nativePublicApp';",
      "window.messages=[]; window.privateMounts=0; window.classify=nativePublicActionPath; window.requestAction=requestNativeMemberAction;",
      "if(new URLSearchParams(location.search).get('activApp')==='public') window.ReactNativeWebView={postMessage:m=>window.messages.push(JSON.parse(m))};",
      "function Private(){window.privateMounts++; return <h1>Existing website checkout</h1>}",
      "function Public(){return <main style={{padding:20}}><h1>Public ACTIV event</h1><p>All event details are available without an account.</p><Link id='book' to='/events/sample-conference/book'>Book this event</Link><br/><Link id='news' to='/news'>Latest news</Link></main>}",
      "createRoot(document.getElementById('root')).render(<BrowserRouter><Gate><Routes><Route path='/events/:slug/book' element={<Private/>}/><Route path='/news' element={<main><h1>Published news</h1><Link id='event' to='/'>Events</Link></main>}/><Route path='*' element={<Public/>}/></Routes></Gate></BrowserRouter>);",
    ].join('\n') },
  });
  bundle = built.outputFiles[0].text;
  chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--no-first-run', 'about:blank'],
    { windowsHide: true, stdio: 'ignore' });
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch {}
    await pause(100);
  }
  assert(port, 'Chrome starts');
  const tabs = await fetch('http://127.0.0.1:' + port + '/json/list').then(r => r.json());
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve));
  let seq = 0; const pending = new Map(), errors = [];
  ws.addEventListener('message', event => {
    const m = JSON.parse(event.data);
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);
    pending.get(m.id)?.(m); pending.delete(m.id);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq, timer = setTimeout(() => reject(Error(method)), 15000);
    pending.set(id, result => { clearTimeout(timer); resolve(result); });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw Error(r.result.exceptionDetails.exception?.description);
    return r.result?.result?.value;
  };
  const until = async expression => {
    for (let i = 0; i < 100; i++) { if (await evaluate('Boolean(' + expression + ')')) return; await pause(100); }
    throw Error(expression);
  };
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const origin = 'http://127.0.0.1:' + server.address().port;
  await send('Page.navigate', { url: origin + '/?activApp=public' });
  await until('document.body.innerText.includes("Public ACTIV event")');
  assert.equal(await evaluate('window.privateMounts'), 0);
  await evaluate('document.getElementById("news").click()');
  await until('document.body.innerText.includes("Published news")');
  assert.deepEqual(await evaluate('window.messages'), []);
  await evaluate('document.getElementById("event").click()');
  await until('document.getElementById("book")');
  await evaluate('document.getElementById("book").click()');
  await until('document.body.innerText.includes("Continue in the ACTIV app") && window.messages.length === 1');
  assert.equal(await evaluate('window.privateMounts'), 0, 'SPA checkout never mounts or sends private requests');
  assert.deepEqual(await evaluate('window.messages'), [{ type: 'ACTIV_MEMBER_ACTION', path: '/events/sample-conference/book' }]);
  assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Mobile layout does not overflow');
  if (process.env.TEST_ARTIFACTS) {
    const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    await writeFile(path.join(process.env.TEST_ARTIFACTS, 'website-public-native-sign-in.png'), Buffer.from(screenshot.result.data, 'base64'));
  }
  assert.deepEqual(await evaluate('["/", "/events", "/events/sample", "/news", "/gallery", "/regions/south", "/membership"].map(window.classify)'), Array(7).fill(null));
  assert.deepEqual(await evaluate('["https://evil.test/login", "//evil.test/login", "javascript:alert(1)", "/bad%00path"].map(window.classify)'), Array(4).fill(null));
  await evaluate('window.requestAction("https://evil.test/login")');
  assert.equal(await evaluate('window.messages.length'), 1, 'External URLs never become native commands');
  await evaluate('[...document.querySelectorAll("button")].find(b => b.textContent === "Back to browsing").click()');
  await until('document.getElementById("book")');
  await send('Page.navigate', { url: origin + '/' });
  await until('document.getElementById("book")');
  await evaluate('document.getElementById("book").click()');
  await until('document.body.innerText.includes("Existing website checkout")');
  assert.equal(await evaluate('window.privateMounts'), 1, 'Ordinary website keeps its current booking flow');
  assert.deepEqual(await evaluate('window.messages'), []);
  assert.deepEqual(errors, []);
  console.log('PASS: anonymous content, SPA/native sign-in handoff, no private mount, back to browsing, mobile layout and ordinary website checkout.');
  await send('Browser.close');
} finally {
  ws?.close(); chrome?.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  if (path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep + 'activ-public-browse-')) {
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
  }
}
