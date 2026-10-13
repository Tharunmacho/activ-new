import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const root = fileURLToPath(new URL('..', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'activ-id-register-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let bundle = '', css = '', chrome, ws;
const payloads = [];
const original = { id: 'fixture-member', membershipNumber: 'ACTIV-STU-20261012-001', previousIds: ['ACTIV-2026-006'], fullName: 'Fixture Member', email: 'fixture@example.test', phoneNumber: '9173652408', whatsappNumber: '', state: 'Tamil Nadu', district: 'Chennai', block: 'Kodambakkam', city: 'Chennai', place: '', educationalQualification: '', memberSince: '2026-10-12', validUntil: '2027-10-11', planName: 'Student', categoryCode: 'STU', lifetime: false, status: 'active', updatedAt: '2026-10-12T10:00:00.000Z', editable: true, history: [] };
let record = { ...original }, deleted = false;
const archived = { ...original, id: 'old-deleted-member', fullName: 'Archived person', status: 'archived', editable: false };
const deletions = [];
const server = http.createServer(async (req, res) => {
  if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
  if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
  if (req.url.startsWith('/api/v1/admin/super/membership/ids')) {
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'DELETE') {
      assert.equal(req.url, '/api/v1/admin/super/membership/ids/fixture-member');
      deleted = true; deletions.push(req.url);
      return res.end(JSON.stringify({ success: true, data: { deleted: true } }));
    }
    if (req.method === 'PATCH') {
      let input = ''; for await (const chunk of req) input += chunk;
      const body = JSON.parse(input); payloads.push(body);
      if (body.membershipNumber.endsWith('-999')) { res.statusCode = 409; return res.end(JSON.stringify({ success: false, message: 'Membership ID already exists. Choose a different ID.' })); }
      record = { ...record, ...body, updatedAt: new Date().toISOString() };
      return res.end(JSON.stringify({ success: true, data: record }));
    }
    const detail = req.url.split('?')[0].endsWith('/fixture-member');
    const search = new URL(req.url, 'http://localhost').searchParams.get('search') || '';
    const matches = !deleted && (!search || JSON.stringify(record).includes(search));
    // Simulate an older API during rollout: archived accounts must stay hidden.
    return res.end(JSON.stringify({ success: true, data: detail ? record : { rows: matches ? [archived, record] : [archived], total: matches ? 2 : 1, page: 1, limit: 20 } }));
  }
  res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  const files = await readdir(path.join(root, 'dist/assets'));
  css = await readFile(path.join(root, 'dist/assets', files.find(f => /^index-.*\.css$/.test(f))), 'utf8');
  const built = await build({ absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    plugins: [{ name: 'sidebar-fixture', setup(b) { b.onResolve({ filter: /\/AdminSidebar$/ }, () => ({ path: 'sidebar', namespace: 'fixture' })); b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'js', contents: 'export default ()=>null;' })); } }],
    define: { 'import.meta.env': JSON.stringify({ DEV: true, VITE_API_URL: `http://127.0.0.1:${server.address().port}/api/v1` }), 'process.env.NODE_ENV': '"test"' },
    stdin: { resolveDir: root, loader: 'tsx', contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';import MembershipIds from './src/features/admin/super-admin/pages/MembershipIds';createRoot(document.getElementById('root')).render(<MemoryRouter><MembershipIds/></MemoryRouter>);` }
  }); bundle = built.outputFiles[0].text;
  chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let port; for (let i = 0; i < 100; i++) { try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch {} await pause(100); }
  assert(port, 'fixture Chrome starts');
  const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json()); ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(resolve => ws.addEventListener('open', resolve));
  let seq = 0; const pending = new Map(), errors = [];
  ws.addEventListener('message', event => { const m = JSON.parse(event.data); if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text); pending.get(m.id)?.(m); pending.delete(m.id); });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq, timer = setTimeout(() => reject(Error(method)), 15000); pending.set(id, r => { clearTimeout(timer); resolve(r); }); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw Error(r.result.exceptionDetails.exception?.description); return r.result?.result?.value; };
  const until = async expression => { for (let i = 0; i < 120; i++) { if (await evaluate(`Boolean(${expression})`)) return; await pause(100); } throw Error(expression); };
  const fill = (selector, value) => evaluate(`(async()=>{const input=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));})()`);
  await send('Runtime.enable');
  await send('Network.enable'); await send('Network.setBlockedURLs', { urls: ['https://*'] });
  for (const width of [320, 390, 768, 1440]) {
    record = { ...original }; deleted = false;
    await send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 600 });
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/?width=${width}` });
    await until('document.querySelector("article")?.textContent.includes("ACTIV-STU-20261012-001")');
    assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'), 'register fits the viewport');
    assert(await evaluate('!document.body.innerText.includes("Archived person")'), 'archived records never appear');
    assert.equal(await evaluate('document.querySelectorAll("article").length'), 1);
    assert(await evaluate(`(()=>{const buttons=[...document.querySelectorAll('.membership-id-actions button')].map(b=>b.getBoundingClientRect());return buttons.length===2 && Math.abs(buttons[0].width-buttons[1].width)<1 && Math.abs(buttons[0].height-buttons[1].height)<1 && buttons.every(b=>b.left>=0&&b.right<=innerWidth)})()`), 'edit/delete buttons have equal dimensions and fit the viewport');
    if (process.env.TEST_ARTIFACTS) { const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(path.join(process.env.TEST_ARTIFACTS, `membership-id-actions-${width}.png`), Buffer.from(shot.result.data, 'base64')); }
    await evaluate('document.querySelector("article button").click()');
    await until(`document.querySelector('[role="dialog"] input[aria-label="Membership ID"]')`);
    assert(await evaluate('document.querySelector("[role=dialog]").getBoundingClientRect().width<=innerWidth'), 'editor fits the viewport');
    await fill('input[aria-label="Membership ID"]', 'ACTIV-STU-20261012-999');
    await fill('textarea', 'Checked against the office record');
    await evaluate('document.querySelector("button[type=submit]").click()');
    await until('document.querySelector("[role=alert]")?.textContent.includes("already exists")');
    assert(await evaluate('(()=>{const r=document.querySelector("[role=alert]").getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight})()'), 'duplicate ID message is visible without scrolling');
    assert.equal(await evaluate(`document.querySelector('input[aria-label="Membership ID"]').value`), 'ACTIV-STU-20261012-999', 'duplicate rejection keeps the correction available');
    if (process.env.TEST_ARTIFACTS) { const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(path.join(process.env.TEST_ARTIFACTS, `membership-id-editor-${width}.png`), Buffer.from(shot.result.data, 'base64')); }
    await fill('input[aria-label="Membership ID"]', 'ACTIV-STU-20261012-010');
    await until('!document.querySelector("button[type=submit]").disabled');
    await evaluate('document.querySelector("button[type=submit]").click()');
    await until('!document.querySelector("[role=dialog]") && document.querySelector("article")?.textContent.includes("ACTIV-STU-20261012-010")');
    await evaluate(`Array.from(document.querySelectorAll('article button')).find(b=>b.textContent.includes('Delete account')).click()`);
    await until(`document.querySelector('[role="dialog"]')?.textContent.includes('fresh registration') || document.querySelector('[role="dialog"]')?.textContent.includes('registering again')`);
    assert.equal(deleted, false, 'opening the confirmation does not delete');
    await evaluate(`Array.from(document.querySelectorAll('[role="dialog"] button')).find(b=>b.textContent==='Keep account').click()`);
    await until(`!document.querySelector('[role="dialog"]')`);
    assert.equal(deleted, false, 'cancel preserves the account');
    await evaluate(`Array.from(document.querySelectorAll('article button')).find(b=>b.textContent.includes('Delete account')).click()`);
    await until(`document.querySelector('[role="dialog"]')`);
    await evaluate(`Array.from(document.querySelectorAll('[role="dialog"] button')).find(b=>b.textContent==='Delete account').click()`);
    await until(`!document.querySelector('[role="dialog"]') && !document.querySelector('article')`);
    assert.equal(deleted, true);
  }
  assert.deepEqual(errors, []); assert.equal(payloads.length, 8);
  assert.equal(deletions.length, 4);
  assert(payloads.every(p => p.updatedAt && p.note && !('membershipStatus' in p)), 'writes carry the loaded revision and correction note, not entitlement changes');
  console.log('PASS: Membership IDs at 320/390/768/1440px; aligned buttons, archived rows hidden, deletion confirmation/refresh, duplicate-ID rejection and saved corrections.');
  await send('Browser.close');
} finally {
  ws?.close(); chrome?.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  if (path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep + 'activ-id-register-')) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
