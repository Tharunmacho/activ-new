// Real settings component, built CSS, and loopback-only API fixtures.
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
const artifacts = path.resolve(root, '../artifacts/app-update-settings');
const fonts = await localTypographyFonts(root);
const profile = await mkdtemp(path.join(tmpdir(), 'activ-app-settings-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let policy = { enabled: true, requireLatestAvailable: true, minimumVersionCode: 1, message: 'Please update ACTIV to continue.' };
let bundle = '', css = '', chrome, ws, failRead = true, failWrite = false, holdWrite = false, held;
const writes = [], exceptions = [];
const reply = (res, data) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: true, data })); };
const fail = (res, message) => { res.statusCode = 500; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: false, message })); };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (fonts.serve(url, res)) return;
  if (url.pathname === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
  if (url.pathname === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
  if (url.pathname === '/api/v1/app-updates/admin') {
    if (req.method === 'GET') { if (failRead) { failRead = false; return fail(res, 'Settings are temporarily unavailable'); } return reply(res, policy); }
    if (req.method === 'PUT') {
      let raw = ''; for await (const chunk of req) raw += chunk;
      const value = JSON.parse(raw); writes.push(value);
      if (failWrite) { failWrite = false; return fail(res, 'Could not save this policy'); }
      policy = value;
      if (holdWrite) { held = res; return; }
      return reply(res, policy);
    }
  }
  res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
try {
  const assets = await readdir(path.join(root, 'dist/assets'));
  css = await readFile(path.join(root, 'dist/assets', assets.find(file => /^index-.*\.css$/.test(file))), 'utf8');
  css += '\n' + fonts.css;
  const result = await build({ absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    define: { 'import.meta.env': JSON.stringify({ DEV: true, VITE_API_URL: `${base}/api/v1` }), 'process.env.NODE_ENV': '"test"' },
    stdin: { resolveDir: root, loader: 'tsx', contents: `import React from 'react';import {createRoot} from 'react-dom/client';import AppUpdateSettings from './src/features/admin/super-admin/components/AppUpdateSettings';createRoot(document.getElementById('root')).render(<main style={{maxWidth:820,padding:16,margin:'0 auto'}}><AppUpdateSettings/></main>);` } });
  bundle = result.outputFiles[0].text;
  chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let port;
  for (let i = 0; i < 100; i++) { try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch {} await pause(100); }
  assert(port, 'Chrome starts');
  const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
  ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve));
  let sequence = 0; const pending = new Map();
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    pending.get(message.id)?.(message); pending.delete(message.id);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence, timer = setTimeout(() => reject(Error(method)), 30000);
    pending.set(id, response => { clearTimeout(timer); response.error ? reject(Error(JSON.stringify(response.error))) : resolve(response); });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.result?.exceptionDetails) throw Error(response.result.exceptionDetails.exception?.description);
    return response.result?.result?.value;
  };
  const until = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(`Boolean(${expression})`)) return; await pause(50); } throw Error(expression); };
  const click = text => evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===${JSON.stringify(text)}).click()`);
  const fill = (label, value) => evaluate(`{const field=document.querySelector('[aria-label="${label}"]');Object.getOwnPropertyDescriptor(field.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(field,${JSON.stringify(value)});field.dispatchEvent(new Event('input',{bubbles:true}));}`);
  const acknowledge = () => evaluate(`document.querySelector('[aria-label="Required release is available in Google Play"]').click()`);
  const switchAt = index => evaluate(`document.querySelectorAll('fieldset input[type="checkbox"]')[${index}].click()`);
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['https://*'] });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: base });
  await until(`document.querySelector('[role="alert"]')?.textContent.includes('temporarily unavailable')`);
  assert.equal(await evaluate(`document.querySelectorAll('fieldset').length`), 0, 'No write controls after failed load');
  await click('Retry'); await until(`document.querySelector('fieldset')`);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('fieldset input[type="checkbox"]')].map(input=>input.checked)`), [true, true, false]);
  assert(await evaluate(`document.querySelector('fieldset button').disabled`), 'Enabled policy needs acknowledgement');
  await acknowledge(); await fill('Minimum Android build number', '42');
  assert(await evaluate(`document.querySelector('fieldset button').disabled`), 'Changing minimum clears acknowledgement');
  await acknowledge(); await switchAt(1);
  assert(await evaluate(`document.querySelector('fieldset button').disabled`), 'Changing automatic rule clears acknowledgement');
  await fill('App update message', '  Install the latest ACTIV release.  '); await acknowledge();
  holdWrite = true; await click('Save update settings');
  await until(`document.querySelector('fieldset')?.disabled`);
  for (let i = 0; i < 100 && !held; i++) await pause(25);
  assert(held); assert.equal(writes.length, 1);
  assert.deepEqual(writes[0], { enabled: true, requireLatestAvailable: false, minimumVersionCode: 42, message: 'Install the latest ACTIV release.', productionAvailableConfirmed: true });
  reply(held, policy); held = null; holdWrite = false;
  await until(`document.querySelector('[role="status"]')?.textContent.includes('saved')`);
  assert(await evaluate(`document.querySelector('fieldset button').disabled`), 'Successful write clears acknowledgement');
  await fill('Minimum Android build number', '0'); await acknowledge(); await click('Save update settings');
  await until(`document.querySelector('[role="alert"]')?.textContent.includes('positive Android build')`);
  assert.equal(writes.length, 1, 'Invalid minimum never reaches API');
  await fill('Minimum Android build number', '1'); await switchAt(0);
  assert.equal(await evaluate(`document.querySelectorAll('[aria-label="Required release is available in Google Play"]').length`), 0);
  failWrite = true; await click('Save update settings');
  await until(`document.querySelector('[role="alert"]')?.textContent.includes('Could not save this policy')`);
  assert(!await evaluate(`document.querySelector('fieldset button').disabled`));
  await click('Save update settings');
  await until(`document.querySelector('[role="status"]')?.textContent.includes('saved')`);
  assert.equal(writes.length, 3); assert.equal(writes[2].enabled, false); assert.equal(writes[2].productionAvailableConfirmed, false);
  await mkdir(artifacts, { recursive: true });
  for (const width of [320, 390, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 500 });
    await evaluate('document.fonts.ready'); await pause(50);
    assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'), `No horizontal overflow at ${width}`);
    assert(await evaluate(`[...document.querySelectorAll('textarea,input:not([type="checkbox"])')].every(input=>parseFloat(getComputedStyle(input).fontSize)>=16)`), 'Readable input fonts');
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    await writeFile(path.join(artifacts, `settings-${width}.png`), Buffer.from(shot.result.data, 'base64'));
  }
  assert.deepEqual(exceptions, []);
  console.log('PASS web Android settings: read/retry, enabled/latest defaults, explicit acknowledgement/reset, exact save payload, validation, busy locking, disable/retry, 320/390/1440 layout and 16px input text. Loopback fixture only.');
  await send('Browser.close');
} finally {
  held?.destroy(); ws?.close(); chrome?.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  const resolved = path.resolve(profile);
  if (resolved.startsWith(path.resolve(tmpdir()) + path.sep + 'activ-app-settings-')) await rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
