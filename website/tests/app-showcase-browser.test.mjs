import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const root = fileURLToPath(new URL('..', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'activ-showcase-test-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let chrome, ws, bundle = '', css = '';
const server = http.createServer(async (req, res) => {
  if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
  if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
  if (['home', 'events', 'gallery', 'news', 'zones'].some(screen => req.url === `/app/activ-android-${screen}.png`)) {
    res.setHeader('Content-Type', 'image/png'); return res.end(await readFile(path.join(root, 'public', req.url)));
  }
  res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet"><link rel="stylesheet" href="/style.css"></head><body style="margin:0;background:#f3f6fc"><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  const assets = await readdir(path.join(root, 'dist/assets'));
  css = await readFile(path.join(root, 'dist/assets', assets.find(file => /^index-.*\.css$/.test(file))), 'utf8');
  css += await readFile(path.join(root, 'src/components/shared/appDownloadPromotion.css'), 'utf8');
  bundle = (await build({ absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', loader: { '.css': 'empty' }, define: { 'process.env.NODE_ENV': '"test"', 'import.meta.env.VITE_CHAT_WHATSAPP': '""' },
    stdin: { resolveDir: root, loader: 'tsx', contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';import AppDownloadPromotion from './src/components/shared/AppDownloadPromotion';import FloatingLaunchers from './src/components/layout/FloatingLaunchers';const params=new URLSearchParams(location.search);if(params.has('native'))window.ReactNativeWebView={};createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={[params.has('checkout')?'/payment/instamojo':params.has('member')?'/member/dashboard':'/']}><main data-mounted style={{maxWidth:1440,margin:'auto',padding:16}}><AppDownloadPromotion member={params.has('member')}/></main><FloatingLaunchers/></MemoryRouter>);` }
  })).outputFiles[0].text;
  chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--disable-extensions', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let port; for (let i = 0; i < 200; i++) { try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch {} await pause(100); }
  assert(port, 'Chrome started');
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve));
  let seq = 0; const pending = new Map(), errors = [];
  ws.addEventListener('message', event => { const value = JSON.parse(event.data); if (value.method === 'Runtime.exceptionThrown') errors.push(value.params.exceptionDetails.text); pending.get(value.id)?.(value); pending.delete(value.id); });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq, timer = setTimeout(() => reject(Error(method)), 45000); pending.set(id, value => { clearTimeout(timer); resolve(value); }); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const value = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (value.result?.exceptionDetails) throw Error(value.result.exceptionDetails.text); return value.result?.result?.value; };
  const until = async expression => { for (let i = 0; i < 150; i++) { if (await evaluate(expression)) return; await pause(100); } throw Error(expression); };
  await send('Runtime.enable');
  for (const width of [320, 390, 768, 1024, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 950, deviceScaleFactor: 1, mobile: width < 600 });
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
    await until(`document.querySelector('.activ-app-promo__qr img')?.complete`);
      await evaluate(`document.querySelectorAll('.activ-app-phone img').forEach(image=>image.loading='eager');document.fonts.ready`);
      await until(`[...document.querySelectorAll('.activ-app-phone img')].every(image=>image.naturalWidth>0)`);
      assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'), `Fits ${width}px`);
      assert.equal(await evaluate(`[...document.querySelectorAll('.activ-app-phone img')].filter(image=>image.getBoundingClientRect().width>=75).length`), 5, 'Five real screens stay in the showcase');
      assert.equal(await evaluate(`new Set([...document.querySelectorAll('.activ-app-phone img')].map(image=>image.src)).size`), 5);
      for (let index = 0; index < 5; index++) {
        await evaluate(`document.querySelectorAll('.activ-app-promo__switcher button')[${index}].click()`);
        await until(`document.querySelectorAll('.activ-app-promo__screen')[${index}].dataset.position==='0'`);
        assert.equal(await evaluate(`document.querySelectorAll('.activ-app-promo__switcher button[aria-pressed="true"]').length`), 1, 'Only the selected screen control is active');
        assert(await evaluate(`document.querySelector('.activ-app-promo__caption').textContent.length>20`), 'Every screen has its own caption');
      }
      await evaluate(`document.querySelectorAll('.activ-app-promo__switcher button')[0].click()`);
      await pause(450);
      assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'), `Switching all screens still fits ${width}px`);
      assert(await evaluate(`document.querySelector('.activ-app-promo__qr img').getBoundingClientRect().width>=110`), 'QR remains usable on narrow screens');
      assert.equal(await evaluate(`document.querySelector('.activ-app-launcher').href`), 'https://play.google.com/store/apps/details?id=in.activ.membership');
      assert(await evaluate(`document.querySelector('.activ-app-launcher span').getBoundingClientRect().width>0`), 'Download label is visible on phones');
      assert(await evaluate(`(()=>{const a=document.querySelector('.activ-app-launcher').getBoundingClientRect(),b=document.querySelector('[aria-label="Chat on WhatsApp"]').getBoundingClientRect();return a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top})()`), 'Download and support buttons do not overlap');
      if (width === 1440) assert(await evaluate(`document.querySelector('.activ-app-promo').getBoundingClientRect().height<580`), 'Desktop promotion remains compact');
      if (process.env.TEST_ARTIFACTS && [390, 1440].includes(width)) {
        const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
        await writeFile(path.join(process.env.TEST_ARTIFACTS, `app-showcase-five-${width}.png`), Buffer.from(shot.result.data, 'base64'));
      }
    assert(await evaluate(`[...document.querySelectorAll('.activ-app-promo a')].every(a=>a.href==='https://play.google.com/store/apps/details?id=in.activ.membership')`));
  }
  await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/?member` });
  await until(`document.body.innerText.includes('Sign in with the same account')`);
  assert(await evaluate(`!!document.querySelector('.activ-app-launcher')&&!document.querySelector('[aria-label="Donate to ACTIV"]')`), 'Download button also available to members');
  await evaluate(`document.querySelector('[aria-label="Close app download button"]').click()`);
  await until(`!document.querySelector('.activ-app-launcher')`);
  assert(await evaluate(`!!document.querySelector('[aria-label="Chat on WhatsApp"]')`), 'Closing app promotion leaves support available');
  await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
  await until(`!!document.querySelector('[data-mounted]')`);
  assert(await evaluate(`!document.querySelector('.activ-app-launcher')`), 'Dismissal lasts for this browser session');
  await evaluate(`sessionStorage.removeItem('activ-download-closed')`);
  await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/?checkout` });
  await until(`!!document.querySelector('[data-mounted]')`);
  assert(await evaluate(`!document.querySelector('.activ-app-launcher')`), 'No floating promotion covers checkout');
  await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/?native` });
  await until(`!!document.querySelector('[data-mounted]')`);
  assert(await evaluate(`!document.querySelector('.activ-app-promo')&&!document.querySelector('.activ-app-launcher')`), 'Never advertise the app inside itself');
  assert.deepEqual(errors, []);
  console.log('PASS app showcase: five distinct interactive screens, QR/store links, 320/390/768/1024/1440px, separate download launcher, mobile label, member/public visibility, dismissal, checkout and WebView suppression.');
  await send('Browser.close');
} finally {
  ws?.close(); chrome?.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  if (path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep + 'activ-showcase-test-')) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
