// Real composer, upload clients and built CSS; all API traffic stays on this fixture server.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { localTypographyFonts } from './browserTypographyFixtures.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const artifacts = process.env.TEST_ARTIFACTS ? path.resolve(process.env.TEST_ARTIFACTS) : path.resolve(root, '..', 'artifacts');
const fonts = await localTypographyFonts(root);
const layouts = [];
const profile = await mkdtemp(path.join(tmpdir(), 'activ-update-composer-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const plans = [
  { key: 'business-growth', name: 'Business Growth', audience: 'business', active: true },
  { key: 'aspirant', name: 'Aspirant', audience: 'aspirant', active: true },
  { key: 'student', name: 'Student', audience: 'student', active: true },
  { key: 'platinum', name: 'Platinum Lifetime', audience: 'platinum', active: true },
  { key: 'business-legacy', name: 'Legacy Business', audience: 'business', active: false },
];
const original = {
  id: 'update-fixture', title: 'New membership benefits',
  summary: 'Explore the support available with your ACTIV membership.',
  body: 'Dear members,\n\nDiscover upcoming learning programmes and member benefits in the attached guide.\n\nThank you for being part of ACTIV.',
  category: 'notice', state: 'Tamil Nadu', district: 'Chennai', block: 'Central',
  audience: 'plans', planKeys: ['business-growth', 'business-legacy'],
  bannerUrl: '/uploads/original.png', bannerAlt: 'ACTIV membership benefits poster',
  attachmentUrl: '/uploads/original.pdf', attachmentLabel: 'Membership guide',
  pinned: true, expiresAt: '2099-12-31T18:29:59.000Z', status: 'published',
};
let bundle = '', css = '', chrome, ws, pendingPoster, pendingDocument;
const saves = [], exceptions = [];
const reply = (res, data) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: true, data })); };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (fonts.serve(url, res)) return;
  if (url.pathname === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
  if (url.pathname === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
  if (url.pathname.startsWith('/uploads/')) {
    if (url.pathname.endsWith('.pdf')) { res.setHeader('Content-Type', 'application/pdf'); return res.end('%PDF-fixture'); }
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="780"><rect width="600" height="780" fill="#173477"/><rect x="28" y="28" width="544" height="724" rx="20" fill="#eef5ff"/><text x="300" y="160" text-anchor="middle" font-family="sans-serif" font-size="50" font-weight="bold" fill="#173477">ACTIV</text><text x="300" y="245" text-anchor="middle" font-family="sans-serif" font-size="32" fill="#173477">Membership benefits</text><path d="M100 290h400" stroke="#83a8e6" stroke-width="3"/><text x="80" y="370" font-family="sans-serif" font-size="25" fill="#334155">Learning programmes</text><text x="80" y="435" font-family="sans-serif" font-size="25" fill="#334155">Business opportunities</text><text x="80" y="500" font-family="sans-serif" font-size="25" fill="#334155">A growing community</text><text x="300" y="665" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#173477">Connect. Empower. Grow.</text></svg>');
  }
  if (!url.pathname.startsWith('/api/')) return res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  if (url.pathname.startsWith('/api/v1/announcements') && ['POST', 'PUT'].includes(req.method)) {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const payload = JSON.parse(raw); saves.push({ method: req.method, payload });
    return reply(res, { id: 'update-fixture', ...payload });
  }
  if (req.method === 'POST' && ['/api/v1/cms/media', '/api/v1/cms/attachments'].includes(url.pathname)) {
    for await (const chunk of req) { /* Drain the multipart upload before holding its response. */ }
    if (url.pathname.endsWith('/media')) pendingPoster = res; else pendingDocument = res;
    return;
  }
  if (url.pathname === '/api/v1/admin/super/membership/plans') return reply(res, { plans, settings: { showAllPlans: false } });
  if (url.pathname.includes('regions')) return reply(res, { states: [{ name: 'Tamil Nadu', districts: [{ name: 'Chennai', blocks: [{ name: 'Central' }] }] }] });
  return reply(res, {});
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

try {
  const assets = await readdir(path.join(root, 'dist/assets'));
  css = await readFile(process.env.TEST_CSS || path.join(root, 'dist/assets', assets.find(file => /^index-.*\.css$/.test(file))), 'utf8');
  css += '\n' + fonts.css;
  const result = await build({ absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    define: { 'import.meta.env': JSON.stringify({ DEV: true, VITE_API_URL: `${base}/api/v1` }), 'process.env.NODE_ENV': '"test"' },
    stdin: { resolveDir: root, loader: 'tsx', contents: `
      import React from 'react'; import {createRoot} from 'react-dom/client';
      import UpdateComposer from './src/features/admin/super-admin/components/UpdateComposer';
      const root=createRoot(document.getElementById('root')); let version=0; window.savedCount=0;
      window.renderComposer=(initial=null)=>root.render(<main style={{maxWidth:1400,margin:'0 auto',padding:16}}>
        <UpdateComposer key={++version} initial={initial} onClose={()=>{window.closed=true}} onSaved={()=>{window.savedCount++}}/></main>);
      window.renderComposer();` } });
  bundle = result.outputFiles[0].text;
  chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    ['--headless=new', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let port;
  for (let i = 0; i < 100; i++) { try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch {} await pause(100); }
  assert(port, 'Chrome starts');
  const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
  ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve));
  let seq = 0; const pending = new Map();
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    pending.get(message.id)?.(message); pending.delete(message.id);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq; const timer = setTimeout(() => reject(Error(`${method}: ${String(params.expression || '').slice(0, 300)}`)), 30000);
    pending.set(id, response => { clearTimeout(timer); response.error ? reject(Error(JSON.stringify(response.error))) : resolve(response); });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.result?.exceptionDetails) throw Error(response.result.exceptionDetails.exception?.description);
    return response.result?.result?.value;
  };
  const until = async expression => {
    for (let i = 0; i < 100; i++) { if (await evaluate(`Boolean(${expression})`)) return; await pause(50); }
    throw Error(`${expression}: ${exceptions.join('\n')}`);
  };
  const click = label => evaluate(`[...document.querySelectorAll('button')].find(button => button.getAttribute('aria-label') === ${JSON.stringify(label)} || button.textContent.trim() === ${JSON.stringify(label)}).click()`);
  const fill = (name, value) => evaluate(`{
    const input=document.querySelector('[name="${name}"]');
    const proto=input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:input.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto,'value').set.call(input,${JSON.stringify(value)});
    input.dispatchEvent(new Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}));
  }`);
  const remount = async initial => {
    await evaluate(`window.renderComposer(${JSON.stringify(initial || null)})`);
    await until(`document.querySelector('[name="title"]')?.value===${JSON.stringify(initial?.title || '')}`);
    if (initial?.audience === 'plans') await until(`document.querySelectorAll('[name="planKeys"]').length===5`);
  };
  const upload = (kind, name) => evaluate(`(()=>{
    const input=document.querySelector('input[aria-label="Upload update ${kind}"]'); const transfer=new DataTransfer();
    ${kind === 'image' ? `const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2XcAAAAASUVORK5CYII='),letter=>letter.charCodeAt(0));const file=new File([bytes],${JSON.stringify(name)},{type:'image/png'});` : `const file=new File(['%PDF-fixture'],${JSON.stringify(name)},{type:'application/pdf'});`}
    transfer.items.add(file);input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
  })()`);
  const waitUpload = async kind => { for (let i = 0; i < 100 && !(kind === 'image' ? pendingPoster : pendingDocument); i++) await pause(50); assert(kind === 'image' ? pendingPoster : pendingDocument, `${kind} reaches fixture API`); };
  const waitSaved = async count => { await until(`window.savedCount===${count}`); assert.equal(saves.length, count); };

  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['https://*'] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: base });
  await until(`document.querySelector('form[aria-label="Update composer"]')`);
  await evaluate('document.fonts.ready');
  assert.equal(await evaluate(`document.querySelectorAll('input[type="url"], input[name="bannerUrl"], input[name="attachmentUrl"]').length`), 0, 'No raw URL inputs');

  await fill('title', 'Draft membership notice'); await click('Publish update');
  await until(`document.querySelector('[role="alert"]')?.textContent.includes('Write a message')`);
  assert.equal(saves.length, 0, 'Title alone cannot be published');
  await click('Save as draft'); await waitSaved(1);
  assert.equal(saves[0].payload.status, 'draft'); assert.equal(saves[0].payload.body, '');

  await remount(); await fill('title', 'New business membership benefits'); await fill('body', 'Dear members, please explore your benefits. Thank you.');
  await fill('audience', 'plans'); await until(`document.querySelectorAll('[name="planKeys"]').length===5`);
  assert(await evaluate(`document.body.textContent.includes('Retired plan')`), 'Retired plans remain identifiable');
  await click('Publish update'); await until(`document.querySelector('[role="alert"]')?.textContent.includes('Choose at least one')`);
  assert.equal(saves.length, 1, 'Specific plans needs at least one selected plan');
  await click('Select all except student plans');
  const selected = await evaluate(`[...document.querySelectorAll('[name="planKeys"]:checked')].map(input=>input.value)`);
  assert.deepEqual(selected, ['business-growth', 'aspirant', 'platinum', 'business-legacy']);
  await click('Publish update'); await waitSaved(2);
  assert.deepEqual(saves[1].payload.planKeys, selected); assert.equal(saves[1].payload.audience, 'plans');
  await fill('audience', 'paid_non_student'); await click('Publish update'); await waitSaved(3);
  assert.equal(saves[2].payload.audience, 'paid_non_student'); assert.deepEqual(saves[2].payload.planKeys, [], 'Other audiences clear stale plan keys');
  console.log('PASS: draft/publication validation, live plan catalogue including retired plans, non-student selection and exact targeting payloads.');

  await remount(original); await until(`document.querySelector('[name="block"]').value==='Central'`);
  await click('Save published update'); await waitSaved(4);
  for (const key of ['title', 'summary', 'body', 'category', 'audience', 'state', 'district', 'block', 'bannerUrl', 'bannerAlt', 'attachmentUrl', 'attachmentLabel', 'pinned']) assert.deepEqual(saves[3].payload[key], original[key], `${key} survives edit/save`);
  assert.deepEqual(saves[3].payload.planKeys, original.planKeys);

  await upload('image', 'replacement.png'); await waitUpload('image');
  assert(await evaluate(`[...document.querySelectorAll('button[type="submit"],input[type="file"]')].every(control=>control.disabled)`), 'Save, publish and upload controls lock during upload');
  await evaluate(`document.querySelector('form').dispatchEvent(new SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:document.querySelector('button[value="published"]')}))`);
  assert.equal(saves.length, 4, 'Synthetic submission cannot bypass upload guard');
  pendingPoster.statusCode = 500; pendingPoster.setHeader('Content-Type', 'application/json'); pendingPoster.end(JSON.stringify({ success: false, message: 'Fixture upload failed' })); pendingPoster = null;
  await until(`document.querySelector('[role="alert"]')?.textContent.includes('Fixture upload failed')`);
  assert(await evaluate(`[...document.querySelectorAll('img')].every(image=>image.src.endsWith('/uploads/original.png'))`), 'Failed replacement preserves existing poster');

  await upload('image', 'replacement.png'); await waitUpload('image');
  await fill('body', 'Dear members, the updated benefits guide is ready. Thank you.');
  reply(pendingPoster, { url: '/uploads/replacement.png', type: 'image' }); pendingPoster = null;
  await until(`document.querySelector('img')?.src.endsWith('/uploads/replacement.png') && !document.querySelector('button[value="published"]').disabled`);
  assert(await evaluate(`[...document.querySelectorAll('img')].every(image=>getComputedStyle(image).objectFit==='contain')`), 'Poster and member preview preserve the complete image');
  await upload('document', 'Updated membership guide.pdf'); await waitUpload('document');
  assert(await evaluate(`document.querySelector('button[value="draft"]').disabled`));
  reply(pendingDocument, { url: '/uploads/updated.pdf', name: 'Updated membership guide.pdf', type: 'application/pdf' }); pendingDocument = null;
  await until(`document.querySelector('[name="attachmentLabel"]').value==='Updated membership guide.pdf'`);
  await click('Save published update'); await waitSaved(5);
  assert.equal(saves[4].payload.bannerUrl, '/uploads/replacement.png');
  assert.equal(saves[4].payload.attachmentUrl, '/uploads/updated.pdf');
  assert.equal(saves[4].payload.body, 'Dear members, the updated benefits guide is ready. Thank you.', 'Upload response preserves concurrent message edits');
  await click('Remove image'); await click('Remove document'); await click('Save published update'); await waitSaved(6);
  for (const key of ['bannerUrl', 'bannerAlt', 'attachmentUrl', 'attachmentLabel']) assert.equal(saves[5].payload[key], '', `${key} is cleared when media is removed`);

  await remount(); await fill('title', 'Membership poster'); await upload('image', 'poster.png'); await waitUpload('image');
  reply(pendingPoster, { url: '/uploads/poster.png', type: 'image' }); pendingPoster = null;
  await until(`!document.querySelector('button[value="published"]').disabled`);
  await click('Publish update'); await waitSaved(7);
  assert.equal(saves[6].payload.body, ''); assert.equal(saves[6].payload.bannerUrl, '/uploads/poster.png');
  console.log('PASS: preserved edit data, upload locking, failed replacement, full-image previews, document uploads, concurrent edits and explicit media removal.');

  await remount(original); await mkdir(artifacts, { recursive: true });
  for (const width of [320, 390, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: width < 500 ? 844 : 1100, deviceScaleFactor: 1, mobile: width < 500 });
    await evaluate('window.scrollTo(0,0)'); await pause(100);
    assert(await evaluate(`document.documentElement.scrollWidth<=innerWidth`), `No horizontal overflow at ${width}px`);
    const textFields = await evaluate(`[...document.querySelectorAll('input:not([type="file"]):not([type="checkbox"]),textarea,select')].map(input=>({name:input.name,size:getComputedStyle(input).fontSize}))`);
    const measured = await evaluate(`(() => {
      const visible=e=>e.getBoundingClientRect().width>0;
      const style=e=>({size:parseFloat(getComputedStyle(e).fontSize),family:getComputedStyle(e).fontFamily});
      return {width:innerWidth,body:style(document.body),poppinsLoaded:document.fonts.check('600 20px Poppins'),
        labels:[...document.querySelectorAll('label > span:first-child')].filter(visible).map(style),
        preview:style(document.querySelector('[aria-label="Member preview"] p.text-base')),
        caption:style(document.querySelector('[aria-label="Member preview"] .text-xs')),
        overflow:[...document.querySelectorAll('input:not([type=file]),select,textarea,button')].filter(visible).filter(e=>{const r=e.getBoundingClientRect();return r.left< -1||r.right>innerWidth+1||e.scrollWidth>e.clientWidth+1&&e.tagName==='BUTTON'}).map(e=>({tag:e.tagName,label:e.getAttribute('aria-label')||e.name||e.textContent.trim()}))};
    })()`);
    layouts.push({...measured,textFields});
    await writeFile(path.join(artifacts,'update-composer-typography.json'),JSON.stringify({fonts:fonts.loaded?'local Poppins':'system fallback',layouts},null,2));
    assert(textFields.every(field => field.size === '20px'), `Inputs stay 20px at ${width}px: ${JSON.stringify(textFields)}`);
    assert.equal(measured.body.size,20); assert.equal(measured.preview.size,20); assert.equal(measured.caption.size,16);
    assert(measured.labels.length>0&&measured.labels.every(label=>label.size>=18&&label.family.includes('Poppins')),'Readable Poppins labels');
    if(fonts.loaded) assert(measured.poppinsLoaded,'Local Poppins loaded');
    assert.deepEqual(measured.overflow,[],`${width}: controls stay inside the viewport`);
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    await writeFile(path.join(artifacts, `update-composer-${width}.png`), Buffer.from(shot.result.data, 'base64'));
  }
  assert.deepEqual(exceptions, []);
  console.log('PASS: responsive 320/390/1440 layouts, Poppins 20px form fields, 18px labels and 16px captions and no browser exceptions. Screenshots saved in artifacts/update-composer-*.png.');
  await send('Browser.close');
} finally {
  pendingPoster?.destroy(); pendingDocument?.destroy(); ws?.close(); chrome?.kill();
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  const resolved = path.resolve(profile);
  if (resolved.startsWith(path.resolve(tmpdir()) + path.sep + 'activ-update-composer-')) await rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
