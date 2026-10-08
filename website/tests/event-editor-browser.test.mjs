// Exercise the real CMS and public event page with local HTTP fixtures only.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'activ-event-editor-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const guests = ['A', 'B', 'C'].map(letter => ({ name: `Guest ${letter}`, role: `Role ${letter}`,
  organization: `Organisation ${letter}`, bio: `Bio ${letter}`, photoUrl: `/uploads/${letter}.png` }));
let saved = { id: 'event-fixture', slug: 'event-fixture', title: 'Event editor fixture', description: '',
  status: 'published', channel: 'public', showOnOnboarding: true, showQrOnPage: false, reachEveryone: true,
  startAt: '2099-10-10T09:00:00+05:30', endAt: '2099-10-10T17:00:00+05:30',
  location: 'Chennai', category: 'Business', mode: 'offline', audience: 'all',
  speakers: guests, agenda: [], days: [], targets: [], registrationEnabled: false,
  attachments: [{ name: 'Original agenda.pdf', url: '/uploads/original.pdf', type: 'application/pdf', size: 100 }],
  videoUrl: '', whatsappChannelUrl: '', media: { url: '', alt: '', fit: 'contain', position: 'center' } };
let bundle = '', css = '', chrome, ws, pendingDocument, pendingPhoto;
const requests = [], exceptions = [];
const publicEvent = () => { const { whatsappChannelUrl, videoUrl, attachments, ...event } = saved; return event; };
const reply = (res, data) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: true, data })); };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
  if (url.pathname === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
  if (url.pathname.startsWith('/uploads/')) {
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40"><rect width="30" height="40" fill="#bccbdc"/></svg>');
  }
  if (!url.pathname.startsWith('/api/')) return res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  if (url.pathname === '/api/v1/cms/events/event-fixture' && req.method === 'PUT') {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw); requests.push(body);
    saved = { ...saved, ...body };
    for (const key of ['speakers', 'agenda', 'days', 'targets', 'attachments', 'registrationFields', 'reminderOffsetsHours'])
      if (typeof saved[key] === 'string') saved[key] = JSON.parse(saved[key]);
    return reply(res, saved);
  }
  if (req.method === 'POST' && ['/api/v1/cms/attachments', '/api/v1/cms/media'].includes(url.pathname)) {
    for await (const chunk of req) { /* Drain the test upload. */ }
    if (url.pathname.endsWith('/attachments')) pendingDocument = res;
    else pendingPhoto = res;
    return;
  }
  if (url.pathname === '/api/v1/cms/events') return reply(res, [saved]);
  if (url.pathname === '/api/v1/cms/events/event-fixture') return reply(res, publicEvent());
  if (url.pathname.includes('regions') || url.pathname.includes('states')) return reply(res, []);
  return reply(res, {});
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
try {
  const assets = await readdir(path.join(root, 'dist/assets'));
  css = await readFile(path.join(root, 'dist/assets', assets.find(file => /^index-.*\.css$/.test(file))), 'utf8');
  const result = await build({ absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    define: { 'import.meta.env': JSON.stringify({ DEV: true, VITE_API_URL: `${base}/api/v1` }), 'process.env.NODE_ENV': '"test"' },
    stdin: { resolveDir: root, loader: 'tsx', contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {BrowserRouter,Routes,Route} from 'react-router-dom'; import {Toaster} from 'sonner'; import EventsManager from './src/pages/cms/EventsManager'; import EventDetailPage from './src/pages/onboarding/EventDetailPage'; createRoot(document.getElementById('root')).render(<BrowserRouter><Routes><Route path='/cms/events' element={<EventsManager/>}/><Route path='/events/:id' element={<EventDetailPage/>}/></Routes><Toaster/></BrowserRouter>);` } });
  bundle = result.outputFiles[0].text;
  chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let port;
  for (let i = 0; i < 100; i++) { try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch {} await pause(100); }
  assert(port, 'Chrome starts');
  const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve));
  let seq = 0; const pending = new Map();
  ws.addEventListener('message', event => { const msg = JSON.parse(event.data); if (msg.method === 'Runtime.exceptionThrown') exceptions.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text); pending.get(msg.id)?.(msg); pending.delete(msg.id); });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; const timer = setTimeout(() => reject(Error(method)), 15000); pending.set(id, r => { clearTimeout(timer); r.error ? reject(Error(JSON.stringify(r.error))) : resolve(r); }); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw Error(r.result.exceptionDetails.exception?.description); return r.result?.result?.value; };
  const until = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(`Boolean(${expression})`)) return; await pause(100); } throw Error(`${expression}: ${exceptions.join('\n')}`); };
  const click = label => evaluate(`[...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === ${JSON.stringify(label)} || b.textContent.trim() === ${JSON.stringify(label)}).click()`);
  const fill = (selector, value) => evaluate(`{ const input = ${selector}; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event('input', {bubbles:true})); }`);
  const row = name => `[...document.querySelectorAll('input[placeholder="As it should be printed"]')].find(input => input.value === ${JSON.stringify(name)}).closest('div.rounded-lg')`;
  const names = () => evaluate(`[...document.querySelectorAll('input[placeholder="As it should be printed"]')].map(input => input.value)`);
  const linkInput = `document.querySelector('input[name="whatsappChannelUrl"]')`;
  const paste = text => evaluate(`{ const input = ${linkInput}; const clipboardData = new DataTransfer(); clipboardData.setData('text/plain', ${JSON.stringify(text)}); input.dispatchEvent(new ClipboardEvent('paste', {clipboardData, bubbles:true, cancelable:true})); }`);
  const upload = (selector, name, type, contents) => evaluate(`{ const input = ${selector}; const data = new DataTransfer(); data.items.add(new File([${JSON.stringify(contents)}], ${JSON.stringify(name)}, {type:${JSON.stringify(type)}})); input.files = data.files; input.dispatchEvent(new Event('change', {bubbles:true})); }`);
  const openEditor = async () => { await send('Page.navigate', { url: `${base}/cms/events?event=event-fixture` }); await until(`document.querySelector('#event-form') && document.querySelector('input[name="whatsappChannelUrl"]')`); };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await openEditor();
  assert.deepEqual(await names(), ['Guest A', 'Guest B', 'Guest C']);
  assert(await evaluate(`document.querySelector('button[aria-label="Move Guest A up"]').disabled`));
  assert(await evaluate(`document.querySelector('button[aria-label="Move Guest C down"]').disabled`));
  await upload(`document.querySelector('input[type="file"][accept^=".pdf"]')`, 'New agenda.pdf', 'application/pdf', '%PDF-test');
  await upload(`${row('Guest B')}.querySelector('input[type="file"]')`, 'Guest B.svg', 'image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40"/>');
  for (let i = 0; i < 100 && (!pendingDocument || !pendingPhoto); i++) await pause(100);
  assert(pendingDocument && pendingPhoto, 'Both uploads are waiting for the test server');
  await fill(`${row('Guest B')}.querySelector('input[placeholder="As it should be printed"]')`, 'Guest B updated');
  await click('Move Guest B updated up');
  await click('Move Guest A down');
  await click('Move Guest A up');
  await click('Remove Guest C');
  assert.deepEqual(await names(), ['Guest B updated', 'Guest A']);
  await fill(`${row('Guest B updated')}.querySelector('input[placeholder="Managing Director"]')`, 'Chief guest');
  await fill(`document.querySelector('input[aria-label="Document name"]')`, 'Renamed agenda.pdf');
  const group = 'https://chat.whatsapp.com/ExampleInviteCode123?mode=ems_copy_c';
  await paste(`Follow this link to join my WhatsApp group:\n${group}\n`);
  assert.equal(await evaluate(`${linkInput}.value`), group);
  await fill(`document.querySelector('input[placeholder="https://www.youtube.com/watch?v=…"]')`, 'https://youtu.be/example');
  reply(pendingDocument, { name: 'New agenda.pdf', url: '/uploads/new.pdf', type: 'application/pdf', size: 9 }); pendingDocument = null;
  reply(pendingPhoto, { url: '/uploads/new-guest-b.png', type: 'image' }); pendingPhoto = null;
  await until(`document.querySelectorAll('input[aria-label="Document name"]').length === 2 && !document.body.innerText.includes('Uploading…')`);
  assert.equal(await evaluate(`${linkInput}.value`), group, 'Document upload preserves the pasted invite');
  assert.equal(await evaluate(`document.querySelector('input[aria-label="Document name"]').value`), 'Renamed agenda.pdf');
  assert.deepEqual(await names(), ['Guest B updated', 'Guest A'], 'Photo upload preserves guest edits and order');
  await click('Save event');
  await until(`!document.querySelector('#event-form')`);
  assert.equal(requests.length, 1);
  assert.equal(saved.whatsappChannelUrl, group);
  assert.equal(saved.videoUrl, 'https://youtu.be/example');
  assert.deepEqual(saved.speakers, [ { ...guests[1], name: 'Guest B updated', role: 'Chief guest', photoUrl: '/uploads/new-guest-b.png' }, guests[0] ]);
  assert.deepEqual(saved.attachments.map(item => item.name), ['Renamed agenda.pdf', 'New agenda.pdf']);
  await openEditor();
  assert.deepEqual(await names(), ['Guest B updated', 'Guest A']);
  assert.equal(await evaluate(`${linkInput}.value`), group);
  console.log('PASS: guest moves, full-record persistence, save/reopen, and photo/document upload races preserve all edits.');

  await paste('  CHAT.WHATSAPP.COM/AbC123?mode=ems_copy_c  ');
  assert.equal(await evaluate(`${linkInput}.value`), 'https://chat.whatsapp.com/AbC123?mode=ems_copy_c');
  await paste('https://www.whatsapp.com/channel/0029Example123');
  assert.equal(await evaluate(`${linkInput}.value`), 'https://www.whatsapp.com/channel/0029Example123');
  await fill(linkInput, 'https://chat.whatsapp.com.evil.test/abc');
  await click('Save event');
  await pause(100);
  assert.equal(requests.length, 1, 'Invalid host cannot be submitted');
  assert(await evaluate(`${linkInput}.validationMessage.includes('WhatsApp group invite')`));
  await fill(linkInput, '');
  await click('Save event');
  await until(`!document.querySelector('#event-form')`);
  assert.equal(requests.length, 2);
  assert.equal(saved.whatsappChannelUrl, '');
  console.log('PASS: shared text, trimmed links, omitted HTTPS, query strings, channel compatibility, invalid-link feedback and clearing.');

  await openEditor();
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate(`${row('Guest B updated')}.scrollIntoView({block:'start'})`);
  await pause(200);
  assert(await evaluate(`${row('Guest B updated')}.getBoundingClientRect().right <= innerWidth`), 'Guest controls fit mobile');
  assert(await evaluate(`${row('Guest B updated')}.getBoundingClientRect().left >= 0`), 'Guest controls stay on screen');
  if (process.env.SCREENSHOT_DIR) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(path.join(process.env.SCREENSHOT_DIR, 'event-guest-order-mobile.png'), Buffer.from(shot.result.data, 'base64'));
  }
  await send('Page.navigate', { url: `${base}/events/event-fixture` });
  await until(`document.querySelector('h1')?.textContent === 'Event editor fixture' && document.body.innerText.includes('Guest B updated')`);
  const text = await evaluate('document.body.innerText');
  assert(text.indexOf('Guest B updated') < text.indexOf('Guest A'), 'Public page uses the saved guest order');
  assert(!text.includes('Guest C'));
  assert.deepEqual(exceptions, []);
  console.log('PASS: mobile guest controls fit the screen, public event cards follow saved order, and no browser exceptions.');
  await send('Browser.close');
} finally {
  pendingDocument?.destroy(); pendingPhoto?.destroy(); ws?.close(); chrome?.kill();
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  const resolved = path.resolve(profile);
  if (resolved.startsWith(path.resolve(tmpdir()) + path.sep + 'activ-event-editor-')) await rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
