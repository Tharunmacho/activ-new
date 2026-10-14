// Local album and upload fixtures only; never connects to production.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

const root = fileURLToPath(new URL('..', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'activ-album-editor-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const image = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="4" height="3"%3E%3C/svg%3E';
const album = { _id: 'album-test', title: 'Conference album', media: { url: image, type: 'image' },
  photos: Array.from({ length: 60 }, (_, i) => ({ url: image, title: `Existing photo ${i + 1}`, type: 'image' })) };
let chrome, ws, bundle = '', css = '', saved, uploadRelease, failUpload = false;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
  if (url.pathname === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
  if (!url.pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'text/html');
    return res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  }
  res.setHeader('Content-Type', 'application/json');
  let data = {};
  if (url.pathname.endsWith('/cms/gallery')) data = [album];
  if (url.pathname.endsWith('/cms/gallery/album-test') && req.method === 'PUT') {
    let body = ''; for await (const chunk of req) body += chunk;
    saved = JSON.parse(body); data = { ...album, ...saved };
  }
  if (url.pathname.endsWith('/cms/media')) {
    for await (const _ of req) { /* consume the local upload */ }
    await new Promise(resolve => { uploadRelease = resolve; });
    if (failUpload) { res.statusCode = 500; return res.end(JSON.stringify({ message: 'Test upload failed' })); }
    data = { url: image, type: 'image' };
  }
  res.end(JSON.stringify({ data }));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
try {
  css = (await postcss([tailwindcss({ config: path.join(root, 'tailwind.config.ts'), content: [path.join(root, 'src/**/*.{ts,tsx}')] })])
    .process('@tailwind base; @tailwind components; @tailwind utilities;', { from: path.join(root, 'src/index.css') })).css;
  bundle = (await build({ absWorkingDir: root, bundle: true, write: false, format: 'iife', jsx: 'automatic',
    alias: { '@': path.join(root, 'src') },
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': JSON.stringify({ DEV: true, VITE_API_URL: `${base}/api/v1` }) },
    stdin: { resolveDir: root, loader: 'tsx', contents: `import React from 'react';import {createRoot} from 'react-dom/client';import GalleryManager from './src/pages/cms/GalleryManager';createRoot(document.getElementById('root')).render(<main style={{padding:16,maxWidth:1000,margin:'auto'}}><GalleryManager/></main>);` },
  })).outputFiles[0].text;
  chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--disable-extensions', 'about:blank',
  ], { windowsHide: true, stdio: 'ignore' });
  let port;
  for (let i = 0; i < 150; i++) { try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch {} await pause(100); }
  assert(port, 'Chrome starts');
  const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
  ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve));
  let sequence = 0; const pending = new Map(), errors = [];
  ws.addEventListener('message', event => {
    const result = JSON.parse(event.data);
    if (result.method === 'Runtime.exceptionThrown') errors.push(result.params.exceptionDetails.text);
    pending.get(result.id)?.(result); pending.delete(result.id);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence, timer = setTimeout(() => reject(Error(method)), 45000);
    pending.set(id, value => { clearTimeout(timer); resolve(value); }); ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.result?.exceptionDetails) throw Error(result.result.exceptionDetails.exception?.description || expression);
    return result.result?.result?.value;
  };
  const until = async expression => { for (let i = 0; i < 120; i++) { if (await evaluate(expression)) return; await pause(100); } throw Error(`Timed out: ${expression}`); };
  const clickText = (text, selector = 'button') => evaluate(`[...document.querySelectorAll(${JSON.stringify(selector)})].find(el=>el.textContent.trim()===${JSON.stringify(text)}).click()`);
  await send('Runtime.enable');
  for (const width of [390, 320, 1440]) {
    saved = undefined;
    await send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 600 });
    await send('Page.navigate', { url: base });
    await until(`document.body.innerText.includes('Conference album')`);
    await clickText('Edit');
    await until(`document.body.innerText.includes('Existing photo 60')`);
    await evaluate(`window.addPhoto=[...document.querySelectorAll('button')].find(el=>el.textContent.trim()==='Add photo');addPhoto.scrollIntoView({block:'start'});addPhoto.focus();window.startScroll=scrollY`);
    await clickText('Add photo');
    await until(`document.querySelector('[role=dialog]')?.textContent.includes('photo 61')`);
    await pause(200);
    assert(await evaluate(`(()=>{const d=document.querySelector('[role=dialog]'),b=d.getBoundingClientRect();return b.top>=0&&b.bottom<=innerHeight+1&&b.left>=0&&b.right<=innerWidth+1&&d.contains(document.activeElement)})()`), `Editor visible and focused at ${width}px`);
    assert(await evaluate(`Math.abs(scrollY-startScroll)<2`), 'Adding does not jump below sixty existing photos');
    assert(await evaluate(`document.documentElement.scrollWidth<=innerWidth`), `No horizontal overflow at ${width}px`);
    await evaluate(`(()=>{const input=document.querySelector('[role=dialog] input[placeholder="The chief guest opens the exhibition hall"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'New photograph');input.dispatchEvent(new Event('input',{bubbles:true}));const textarea=document.querySelector('[role=dialog] textarea[rows="6"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(textarea,'Keep this photo description');textarea.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    const beginUpload = () => evaluate(`(()=>{const file=new File(['local test image'],'photo.png',{type:'image/png'}),transfer=new DataTransfer();transfer.items.add(file);const input=document.querySelector('[role=dialog] input[type=file]');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await beginUpload();
    await until(`document.querySelector('[role=dialog][aria-busy=true]')!==null`);
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    assert(await evaluate(`!!document.querySelector('[role=dialog]')&&[...document.querySelectorAll('[role=dialog] button')].find(el=>el.textContent.trim()==='Done').disabled`), 'Escape/Done cannot discard an in-progress upload');
    for (let i = 0; !uploadRelease && i < 100; i++) await pause(50);
    assert(uploadRelease); uploadRelease(); uploadRelease = null;
    await until(`document.querySelector('[role=dialog][aria-busy=false]')!==null`);
    failUpload = true;
    await beginUpload();
    for (let i = 0; !uploadRelease && i < 100; i++) await pause(50);
    assert(uploadRelease); uploadRelease(); uploadRelease = null;
    await until(`document.querySelector('[role=dialog]')?.textContent.includes('Test upload failed')`);
    failUpload = false;
    await clickText('Done', '[role=dialog] button');
    await until(`!document.querySelector('[role=dialog]')`);
    assert(await evaluate('document.activeElement===window.addPhoto'), 'Focus returns to Add photo');
    assert(await evaluate('Math.abs(scrollY-startScroll)<2'), 'Editor returns to the original list position');
    await clickText('Save the album');
    await until(`document.body.innerText.includes('Albums (1)')`);
    assert.equal(saved.photos.length, 61, 'Saved album includes the uploaded photo');
    assert.deepEqual(saved.photos.slice(0, 60).map(p => p.title), album.photos.map(p => p.title), 'Existing photo order is unchanged');
    assert.equal(saved.photos[60].title, 'New photograph');
    assert.equal(saved.photos[60].description, 'Keep this photo description');
    assert.equal(saved.photos[60].url, image, 'Failed replacement preserves the successful upload');
  }
  assert.deepEqual(errors, []);
  console.log('PASS album photo editor: visible dialog above a 60-photo list at 320/390/1440px, keyboard focus restored, bounded scrolling, upload dismissal guard, failed upload recovery, and final album save preserves photo order and metadata.');
  await send('Browser.close');
} finally {
  uploadRelease?.(); ws?.close(); chrome?.kill(); server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  if (path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep + 'activ-album-editor-')) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
