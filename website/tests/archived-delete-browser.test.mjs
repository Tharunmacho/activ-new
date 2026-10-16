// Real pages, API client, confirmation branch and toast UI against loopback-only
// HTTP fixtures. No production requests, credentials, or database operations.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import loadConfig from 'tailwindcss/loadConfig.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const artifacts = path.resolve(root, '../artifacts');
const fontsDirectory = process.env.TEST_FONTS_DIR ? path.resolve(process.env.TEST_FONTS_DIR) : artifacts;
const output = process.env.TEST_ARTIFACTS ? path.resolve(process.env.TEST_ARTIFACTS) : null;
const profile = await mkdtemp(path.join(tmpdir(), 'activ-archived-delete-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const paymentId = '670000000000000000000001', eventId = '670000000000000000000002';
const livePayment = { id: '670000000000000000000003', memberId: 'member-live', registrationDeleted: false,
  name: 'Live Member', email: 'live@example.test', orderId: 'ORDER-LIVE', paymentId: 'RECEIPT-LIVE',
  planId: 'business', planName: 'Business', amount: 1000, status: 'paid', provider: 'offline', mode: 'cash', createdAt: '2026-10-01', paidAt: '2026-10-01', expiresAt: '2027-10-01', manual: null };
const archivedPayment = { ...livePayment, id: paymentId, memberId: '', registrationDeleted: true,
  name: 'Deleted account', email: '192424050.long.member.identifier@saveetha.example.test',
  orderId: 'ord_6f0fd6164f191956c1d5357fdd42d5ea', paymentId: '053bff5901a442f69e2fccc3d85b2236',
  planName: 'Student', mode: 'instamojo', status: 'created', amount: 500 };
const archivedSortRows = [
  { ...archivedPayment, id: '670000000000000000000006', name: 'Archived business member', email: 'business@example.test', planName: 'Business', orderId: 'ord_200', paymentId: 'pay_100', amount: 1500, status: 'paid', mode: 'bank_transfer', paidAt: '2026-09-28', createdAt: '2026-09-28' },
  { ...archivedPayment, id: '670000000000000000000007', name: 'Archived lifetime member', email: 'lifetime@example.test', planName: 'Lifetime', orderId: 'ord_100', paymentId: 'pay_200', amount: 10, status: 'paid', mode: 'card', paidAt: '2026-10-12', createdAt: '2026-10-12' },
];
const baseEvent = { title: 'Current workshop', id: '670000000000000000000004', historyCategory: 'current',
  category: 'Training', venue: 'Chennai', startAt: '2026-10-30T03:30:00Z', price: 500, totalSeats: 100,
  bookedSeats: 1, remainingSeats: 99, collected: 500, bookings: 1, pendingAmount: 0, status: 'published', registrationEnabled: true };
const events = [baseEvent, { ...baseEvent, id: '670000000000000000000005', title: 'Past workshop', historyCategory: 'past' },
  { ...baseEvent, id: eventId, title: 'Archived workshop', historyCategory: 'deleted', status: 'deleted', bookingHistoryOnly: true }];
const summary = { registered: 1, submitted: 1, active: 1, awaiting: 0, pendingReview: 0, expired: 0, collected: 2000, waived: 0, openOrders: 0 };
const totals = { events: 1, seats: 1, bookings: 1, capacity: 100, collected: 500, pending: 0 };
const donor = { id: 'donor-fixture', fullName: 'Community Development Organisation', email: 'long.donor.contact.address@organisation.example.test', phone: '9000000000', pan: 'ABCDE1234F', donorType: 'organisation', city: 'Chennai', district: 'Chennai', state: 'Tamil Nadu', address: { line1: 'Community office, main road', city: 'Chennai', district: 'Chennai', state: 'Tamil Nadu', pincode: '600001' }, donationCount: 2, totalAmount: 15000, allTimeAmount: 15000, lastDonationAt: '2026-10-10', statementToken: 'fixture-statement' };
const donorDonation = { id: 'donation-fixture', donorId: donor.id, donorName: donor.fullName, donorEmail: donor.email, amount: 15000, status: 'paid', paidAt: '2026-10-10', createdAt: '2026-10-10', financialYear: '2026-2027', receiptNumber: 'ACTIV-DON-20261010-000001', receiptToken: 'fixture-receipt', message: 'For community skills development and entrepreneurship training.' };
let archivedPaymentPresent = true, archivedEventPresent = true, failDelete = false;
let bundle = '', css = '', chrome, ws, localPoppins = false;
const requests = [], failures = [], checks = [], layouts = [], unexpectedRequests = [];
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
    if (url.pathname === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
    if (url.pathname === '/logo_ACTIVian-removebg-preview.png') { res.setHeader('Content-Type', 'image/png'); return res.end(await readFile(path.join(root, 'public', url.pathname.slice(1)))); }
    if (/^\/font-restore-poppins-[0-5]\.ttf$/.test(url.pathname)) {
      res.setHeader('Content-Type', 'font/ttf'); return res.end(await readFile(path.join(fontsDirectory, url.pathname.slice(1))));
    }
    if (url.pathname.startsWith('/api/')) {
      let raw = ''; for await (const part of req) raw += part;
      const body = raw ? JSON.parse(raw) : null;
      requests.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), body });
      res.setHeader('Content-Type', 'application/json');
      if (req.method === 'GET' && url.pathname === '/api/v1/admin/profile') return res.end(JSON.stringify({ success: true, data: { fullName: 'Super Admin', email: 'admin@example.test' } }));
      if (req.method === 'GET' && url.pathname === '/api/v1/admin/super/donations/summary') return res.end(JSON.stringify({ success: true, data: { financialYears: ['2026-2027'], totalAmount: 15000, donationCount: 2, donorCount: 1, thisMonthAmount: 15000 } }));
      if (req.method === 'GET' && url.pathname === '/api/v1/admin/super/donations/donors') return res.end(JSON.stringify({ success: true, data: { rows: [donor], total: 1 } }));
      if (req.method === 'GET' && url.pathname === '/api/v1/admin/super/donations/donors/donor-fixture') return res.end(JSON.stringify({ success: true, data: { donor, donations: [donorDonation], byYear: [{ financialYear: '2026-2027', total: 15000, count: 2 }] } }));
      if (req.method === 'GET' && url.pathname === '/api/v1/admin/super/donations') return res.end(JSON.stringify({ success: true, data: { rows: [donorDonation], total: 1 } }));
      const membershipPath = '/api/v1/admin/super/membership/registrations';
      if (req.method === 'GET' && url.pathname === membershipPath) return res.end(JSON.stringify({ success: true, data: {
        rows: [{ id: 'member-live', name: 'Live Member', email: 'live@example.test', phone: '+919000000000', kind: 'business', memberNumber: 'ACTIV-TEST', applicationId: 'app-live', applicationStatus: 'Approved', status: 'active', planName: 'Business', confirmation: 'Paid', collected: 1000, registeredAt: '2026-10-01' }],
        payments: [livePayment, ...(archivedPaymentPresent ? [archivedPayment] : []), ...archivedSortRows], plans: [], summary,
      } }));
      if (req.method === 'GET' && url.pathname === '/api/v1/events/bookings/overview') return res.end(JSON.stringify({ success: true, data: {
        events: events.filter(row => row.id !== eventId || archivedEventPresent), totals,
        historyTotals: { current: totals, past: totals, deleted: { ...totals, events: archivedEventPresent ? 1 : 0 } }, filterOptions: {},
      } }));
      const paymentDelete = `/api/v1/admin/super/membership/payments/${paymentId}/archived`;
      const eventDelete = `/api/v1/events/${eventId}/bookings/history`;
      if (req.method === 'DELETE' && [paymentDelete, eventDelete].includes(url.pathname)) {
        assert.deepEqual(body, { recordId: url.pathname === paymentDelete ? paymentId : eventId, confirmation: 'DELETE' });
        if (failDelete) { res.statusCode = 409; return res.end(JSON.stringify({ success: false, message: 'Fixture deletion refused; record retained.' })); }
        if (url.pathname === paymentDelete) archivedPaymentPresent = false; else archivedEventPresent = false;
        return res.end(JSON.stringify({ success: true, data: { deleted: true } }));
      }
      unexpectedRequests.push({ method: req.method, path: url.pathname }); res.statusCode = 404;
      return res.end(JSON.stringify({ success: false, message: 'Unexpected fixture request' }));
    }
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'");
    res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  } catch (error) { failures.push(error.message); res.statusCode = 500; res.end(JSON.stringify({ success: false, message: error.message })); }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  if (output) await mkdir(output, { recursive: true });
  // Prefer the explicitly selected production stylesheet for release verification.
  if (process.env.TEST_CSS) css = await readFile(path.resolve(process.env.TEST_CSS), 'utf8');
  else {
  // Generate current CSS directly when no production build is provided.
  let inputCss = await readFile(path.join(root, 'src/index.css'), 'utf8');
  for (const match of [...inputCss.matchAll(/@import ['"](.+?)['"];?/g)]) inputCss = inputCss.replace(match[0], await readFile(path.resolve(root, 'src', match[1]), 'utf8'));
  const config = loadConfig(path.join(root, 'tailwind.config.ts'));
  config.content = [path.join(root, 'src/**/*.{ts,tsx}')];
  css = (await postcss([tailwind(config)]).process(inputCss, { from: path.join(root, 'src/index.css') })).css;
  }
  localPoppins = await Promise.all(Array.from({ length: 6 }, (_, i) => readFile(path.join(fontsDirectory, `font-restore-poppins-${i}.ttf`)))).then(() => true, () => false);
  if (process.env.TEST_FONTS_DIR) assert(localPoppins, 'Explicit font fixture directory must contain all six local Poppins files');
  if (localPoppins) for (let i = 0; i < 6; i++) css += `\n@font-face{font-family:Poppins;font-style:normal;font-weight:${400 + i * 100};src:url('/font-restore-poppins-${i}.ttf') format('truetype');font-display:block}`;
  const fixtures = { name: 'unrelated-shell-only', setup(b) {
    b.onResolve({ filter: /\/BookingPeople$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export default function Empty(){return null}', loader: 'js' }));
  } };
  const built = await build({ absWorkingDir: root, bundle: true, write: false, outfile: path.join(profile, 'bundle.js'), format: 'iife', platform: 'browser', jsx: 'automatic', plugins: [fixtures],
    define: { 'import.meta.env': JSON.stringify({ DEV: true, VITE_API_URL: `http://127.0.0.1:${server.address().port}/api/v1` }), 'process.env.NODE_ENV': '"test"' },
    stdin: { resolveDir: root, loader: 'tsx', contents: `
      import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter,Routes,Route} from 'react-router-dom';
      import Membership from './src/features/admin/super-admin/pages/MembershipRegistrations';
      import Donations from './src/features/admin/super-admin/pages/Donations';import DonorDetail from './src/features/admin/super-admin/pages/DonorDetail';
      import Bookings from './src/features/admin/super-admin/pages/BookingEvents';import {Toaster} from './src/components/ui/sonner';
      localStorage.setItem('role',location.pathname.startsWith('/events-admin')?'events_admin':'super_admin');localStorage.setItem('token','local-fixture-token');
      window.confirmations=[];window.confirmResult=false;window.confirm=message=>{window.confirmations.push(message);return window.confirmResult};
      createRoot(document.getElementById('root')).render(<BrowserRouter><Routes><Route path='/super-admin/membership' element={<Membership/>}/><Route path='/super-admin/donations' element={<Donations/>}/><Route path='/super-admin/donations/:id' element={<DonorDetail/>}/><Route path='*' element={<Bookings/>}/></Routes><Toaster duration={20000}/></BrowserRouter>);
    ` } });
  bundle = built.outputFiles.find(file=>file.path.endsWith('.js')).text;
  // Lazy route CSS is emitted separately from the production index stylesheet.
  // Include the imported component CSS just as route navigation does in Vite.
  css += '\n' + built.outputFiles.filter(file=>file.path.endsWith('.css')).map(file=>file.text).join('\n');
  console.log(`Prepared current source and Tailwind CSS with ${localPoppins ? 'local Poppins' : 'system fallback fonts'}; launching one isolated Chromium.`);
  chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let port;
  for (let i = 0; i < 100; i++) { try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch {} await pause(100); }
  assert(port, 'Chrome starts');
  const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
  ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve));
  let sequence = 0; const pending = new Map(), errors = [], remoteRequests = [];
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === 'Network.requestWillBeSent' && !message.params.request.url.startsWith(`http://127.0.0.1:${server.address().port}/`) && !message.params.request.url.startsWith('data:')) remoteRequests.push(message.params.request.url);
    pending.get(message.id)?.(message); pending.delete(message.id);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence, timer = setTimeout(() => reject(Error(method)), 20000);
    pending.set(id, response => { clearTimeout(timer); if (response.error) reject(Error(JSON.stringify(response.error))); else resolve(response); });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.result?.exceptionDetails) throw Error(response.result.exceptionDetails.exception?.description);
    return response.result?.result?.value;
  };
  const until = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(`Boolean(${expression})`)) return; await pause(100); } throw Error(expression + '\n' + errors.join('\n')); };
  const visibleButton = label => `[...document.querySelectorAll('button')].find(b=>b.getBoundingClientRect().width>0&&b.textContent.trim().startsWith(${JSON.stringify(label)}))`;
  const click = label => evaluate(`${visibleButton(label)}.click()`);
  const deleteCount = () => requests.filter(row => row.method === 'DELETE').length;
  const visit = async (screen, width) => {
    archivedPaymentPresent = true; archivedEventPresent = true; failDelete = false;
    await send('Emulation.setDeviceMetricsOverride', { width, height: 940, deviceScaleFactor: 1, mobile: width < 600 });
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}${screen}` });
    await until(screen.includes('membership') ? 'document.body.textContent.includes("Live Member")' : screen.includes('donations') ? 'document.body.textContent.includes("Community Development Organisation")' : 'document.body.textContent.includes("Current workshop")');
    await evaluate('document.fonts.ready');
  };
  const layout = async (screen, width) => {
    await evaluate(`${visibleButton('Delete permanently')}.scrollIntoView({block:'center'})`);
    await pause(100);
    const result = await evaluate(`(() => {
      const button=${visibleButton('Delete permanently')}, r=button.getBoundingClientRect();
      const words=[];const tree=document.createTreeWalker(button,NodeFilter.SHOW_TEXT);let n;while(n=tree.nextNode()){for(const m of n.textContent.matchAll(/\\S+/g)){const range=document.createRange();range.setStart(n,m.index);range.setEnd(n,m.index+m[0].length);for(const rect of range.getClientRects())words.push({word:m[0],left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom});}}
      const textRect=words.length?{left:Math.min(...words.map(x=>x.left)),right:Math.max(...words.map(x=>x.right)),top:Math.min(...words.map(x=>x.top)),bottom:Math.max(...words.map(x=>x.bottom))}:r;
      const ordinaryWords=[];const row=button.closest('tr,li');if(row){const nodes=document.createTreeWalker(row,NodeFilter.SHOW_TEXT);while(n=nodes.nextNode()){for(const m of n.textContent.matchAll(/\\S+/g)){if(!['Deleted','account','Student','Instamojo','Created','Delete','permanently'].includes(m[0]))continue;const range=document.createRange();range.setStart(n,m.index);range.setEnd(n,m.index+m[0].length);const rects=[...range.getClientRects()].filter(x=>x.width>0&&x.height>0);ordinaryWords.push({word:m[0],lines:rects.length});}}}
      return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,button:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,clientWidth:button.clientWidth,scrollWidth:button.scrollWidth,clientHeight:button.clientHeight,scrollHeight:button.scrollHeight},text:{left:textRect.left,right:textRect.right,top:textRect.top,bottom:textRect.bottom},buttonLines:new Set(words.map(x=>Math.round(x.top))).size,ordinaryWords,font:getComputedStyle(button).fontFamily,fontSize:parseFloat(getComputedStyle(button).fontSize),bodySize:parseFloat(getComputedStyle(document.body).fontSize),poppinsLoaded:document.fonts.check('600 20px Poppins'),sidebarWidth:document.querySelector('aside')?.getBoundingClientRect().width||0};
    })()`);
    layouts.push({ screen, ...result });
    if (output) { const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(path.join(output, `${screen}-${width}.png`), Buffer.from(shot.result.data, 'base64')); }
    if (output) {
      const fullHeight=await evaluate('Math.min(6000,Math.max(940,...[...document.querySelectorAll("main")].map(el=>el.scrollHeight+el.getBoundingClientRect().top+40)))');
      await send('Emulation.setDeviceMetricsOverride', { width, height: Math.ceil(fullHeight), deviceScaleFactor: 1, mobile: width < 600 });
      await evaluate('document.querySelectorAll("main").forEach(el=>el.scrollTop=0)');await pause(100);
      const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(path.join(output,`${screen}-${width}-full.png`),Buffer.from(shot.result.data,'base64'));
      await send('Emulation.setDeviceMetricsOverride', { width, height: 940, deviceScaleFactor: 1, mobile: width < 600 });
      await evaluate(`${visibleButton('Delete permanently')}.scrollIntoView({block:'center'})`);
    }
    if (result.scrollWidth > width + 1 || result.button.left < -1 || result.button.right > width + 1
      || result.button.scrollWidth > result.button.clientWidth + 1 || result.button.scrollHeight > result.button.clientHeight + 1
      || result.text.left < result.button.left - 1 || result.text.right > result.button.right + 1
      || result.text.top < result.button.top - 1 || result.text.bottom > result.button.bottom + 1) failures.push(`${screen} ${width}px: clipped delete control ${JSON.stringify(result)}`);
    const expectedRoot=width<640?14:16;
    assert.equal(result.bodySize,expectedRoot,'Original b0111a3 body follows 14px phone / 16px desktop root');
    assert(result.buttonLines <= 2, 'Delete action fits within two natural lines');
    assert(result.ordinaryWords.every(word=>word.lines<=1), 'Ordinary payment words remain whole');
    assert(result.font.includes('Poppins'),'Original Poppins delete action');
    assert(Math.abs(result.fontSize-expectedRoot*1.25)<.02,'Delete action retains the original 1.25rem admin-button size');
    if (localPoppins) assert(result.poppinsLoaded, 'Local Poppins loaded');
  };
  const exerciseDelete = async (kind, width) => {
    const text = kind === 'membership' ? 'Deleted account' : 'Archived workshop';
    await layout(kind, width);
    let count = deleteCount();
    await click('Delete permanently'); await pause(100);
    assert.equal(deleteCount(), count, `${kind}: cancel sends no DELETE`);
    assert(await evaluate(`document.body.textContent.includes(${JSON.stringify(text)})`), 'cancel preserves row');
    assert(await evaluate('window.confirmations.at(-1).includes("cannot be undone")'), 'confirmation explains permanence');
    await evaluate('window.confirmResult=true'); failDelete = true;
    await click('Delete permanently');
    await until('document.body.textContent.includes("Fixture deletion refused; record retained.")');
    assert.equal(deleteCount(), count + 1, `${kind}: exactly one failed DELETE`);
    assert(await evaluate(`document.body.textContent.includes(${JSON.stringify(text)})`), 'failed delete preserves row');
    assert(await evaluate(`!${visibleButton('Delete permanently')}.disabled`), 'failed delete permits retry');
    failDelete = false;
    const reads = requests.filter(row => row.method === 'GET').length;
    await click('Delete permanently');
    await until(`!document.body.textContent.includes(${JSON.stringify(text)})`);
    await until('document.body.textContent.includes("permanently deleted.")');
    assert.equal(deleteCount(), count + 2, `${kind}: exactly one successful retry`);
    assert(requests.filter(row => row.method === 'GET').length > reads, 'success refreshes list');
    checks.push(`${kind} ${width}px: cancel, failure retains row/error, correct DELETE body, success refresh/removal`);
  };
  const exercisePaymentSorting = async () => {
    const visibleNames = `Array.from(document.querySelectorAll('main tr,main li')).filter(el=>el.getBoundingClientRect().width>0&&Array.from(el.querySelectorAll('button')).some(b=>b.textContent.trim()==='Delete permanently')).map(el=>['Deleted account','Archived business member','Archived lifetime member'].find(name=>el.textContent.includes(name)))`;
    const selectSort = async value => { await evaluate(`(()=>{const select=document.querySelector('select[aria-label="Sort payments"]');select.value=${JSON.stringify(value)};select.dispatchEvent(new Event('change',{bubbles:true}));})()`);await pause(80);return evaluate(visibleNames); };
    assert.deepEqual(await selectSort('amount:asc'), ['Archived lifetime member','Deleted account','Archived business member'], 'Amounts sort numerically ascending');
    assert.deepEqual(await selectSort('amount:desc'), ['Archived business member','Deleted account','Archived lifetime member'], 'Amounts sort numerically descending');
    assert.deepEqual(await selectSort('date:asc'), ['Archived business member','Deleted account','Archived lifetime member'], 'Oldest first uses payment date');
    assert.deepEqual(await selectSort('date:desc'), ['Archived lifetime member','Deleted account','Archived business member'], 'Newest first uses payment date');
    assert.deepEqual(await selectSort('mode:asc'), ['Archived business member','Archived lifetime member','Deleted account'], 'Payment methods remain independently sortable');
    assert.deepEqual(await selectSort('status:asc'), ['Deleted account','Archived business member','Archived lifetime member'], 'Statuses remain independently sortable');
    assert.deepEqual(await selectSort('receipt:desc'), ['Archived lifetime member','Archived business member','Deleted account'], 'Payment references remain independently sortable');
    assert.deepEqual(await selectSort(''), ['Deleted account','Archived business member','Archived lifetime member'], 'Default order restored');
    const searchExpression=`document.querySelector('input[aria-label="Name, email, order or payment reference"]')`;
    const searchFor=async text=>{await evaluate(`(()=>{const input=${searchExpression};Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(text)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`);await pause(80);};
    await searchFor('archived');
    assert.deepEqual(await selectSort('amount:asc'), ['Archived lifetime member','Archived business member'], 'Sorting retains filtered results');
    assert.equal(await evaluate(`${searchExpression}.value`),'archived','Sorting retains the search text');
    await searchFor('');await selectSort('');
    checks.push('Payment sorting: numeric amounts both directions; chronological dates both directions; method/status/payment reference independently; default restored; search text/results preserved');
  };
  const captureDonationLayout = async (screen, width) => {
    await until('document.querySelector(".donation-records td[data-label]")');
    await evaluate('document.querySelector(".donation-records").scrollIntoView({block:"center"})');await pause(80);
    const result=await evaluate(`(()=>{
      const record=document.querySelector('.donation-records'),cells=Array.from(record.querySelectorAll('td')),rect=record.getBoundingClientRect();
      const badCells=cells.filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>({text:el.textContent,width:el.clientWidth,scrollWidth:el.scrollWidth}));
      const links=Array.from(record.querySelectorAll('a,button')).map(el=>{const r=el.getBoundingClientRect();return{text:el.textContent,left:r.left,right:r.right,width:r.width,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,height:r.height,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight}});
      return{width:innerWidth,scrollWidth:document.documentElement.scrollWidth,recordWidth:rect.width,columns:getComputedStyle(cells[0]).gridTemplateColumns,tableDisplay:getComputedStyle(record.querySelector('table')).display,badCells,links};
    })()`);
    assert(result.scrollWidth<=width+1,'Donor page has no horizontal overflow');
    assert.deepEqual(result.badCells,[],'Donor values fit their cells');
    assert(result.links.every(link=>link.left>=-1&&link.right<=width+1&&link.scrollWidth<=link.clientWidth+1&&link.scrollHeight<=link.clientHeight+1),'Donor action labels fit: '+JSON.stringify({screen,...result}));
    if(width===320)assert.equal(result.columns.split(' ').length,1,'Narrow donor labels stack above values');
    layouts.push({screen,...result});checks.push(screen+' '+width+'px: current donation CSS, actual sidebar, readable records and controls, no overflow');
    if(output){
      const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(output,screen+'-'+width+'.png'),Buffer.from(shot.result.data,'base64'));
      await evaluate('window.scrollTo(0,0)');await pause(80);
      const full=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(path.join(output,screen+'-'+width+'-full.png'),Buffer.from(full.result.data,'base64'));
    }
  };
  await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['https://*'] });
  for (const width of process.env.TEST_DONATIONS_ONLY?[]:[1558, 1440, 768, 390, 320]) {
    await visit('/super-admin/membership', width);
    assert.equal(await evaluate(`Boolean(${visibleButton('Delete permanently')})`), false, 'members list has no archived-payment delete');
    await click('Payments'); await until('document.body.textContent.includes("RECEIPT-LIVE")');
    assert.equal(await evaluate(`Boolean(${visibleButton('Delete permanently')})`), false, 'live payments have no permanent delete');
    await click('Archived payments'); await until('document.body.textContent.includes("Deleted account")');
    assert.equal(await evaluate('document.body.textContent.includes("RECEIPT-LIVE")'), false, 'archived tab excludes live payments');
    if (width===1558) await exercisePaymentSorting();
    await exerciseDelete('membership', width);

    await visit('/super-admin/bookings', width);
    assert.equal(await evaluate(`Boolean(${visibleButton('Delete permanently')})`), false, 'current events have no permanent delete');
    await click('Past'); await until('document.body.textContent.includes("Past workshop")');
    assert.equal(await evaluate(`Boolean(${visibleButton('Delete permanently')})`), false, 'past events have no permanent delete');
    await click('Old'); await until('document.body.textContent.includes("Archived workshop")');
    await exerciseDelete('events', width);

    const beforeRole = deleteCount();
    await visit('/events-admin/bookings', width);
    await click('Old'); await until('document.body.textContent.includes("Archived workshop")');
    assert.equal(await evaluate(`Boolean(${visibleButton('Delete permanently')})`), false, 'events admin has no history-delete action');
    assert.equal(deleteCount(), beforeRole);
    checks.push(`events_admin ${width}px: archived history visible; permanent delete absent`);
  }
  for(const width of [1440,320]){
    await visit('/super-admin/donations',width);await captureDonationLayout('donors',width);
    await click('All donations');await until('document.body.textContent.includes("ACTIV-DON-20261010-000001")');await captureDonationLayout('donations',width);
    await visit('/super-admin/donations/donor-fixture',width);await captureDonationLayout('donor-detail',width);
  }
  assert.deepEqual(unexpectedRequests, []); assert.deepEqual(remoteRequests, []); assert.deepEqual(errors, []);
  if (output) await writeFile(path.join(output, 'verification.json'), JSON.stringify({ checkedAt: new Date().toISOString(), checks, layouts, failures, requests, remoteRequests, errors, css: process.env.TEST_CSS || 'generated from current source', fonts: localPoppins ? 'local Poppins 400–900' : 'system fallback (local Poppins unavailable)' }, null, 2));
  assert.deepEqual(failures, [], 'No clipped controls or fixture failures');
  console.log(`PASS archived delete browser: real sidebar, long payment IDs, whole payment words, two-line actions, local HTTP API paths/bodies, cancel/failure/success, live/current/past and role guards, ${localPoppins ? 'Poppins' : 'system fallback font'} layout at 1558/1440/768/390/320px.`);
  await send('Browser.close');
} finally {
  ws?.close(); chrome?.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  const resolvedProfile = path.resolve(profile), allowedPrefix = path.resolve(tmpdir()) + path.sep + 'activ-archived-delete-';
  if (resolvedProfile.startsWith(allowedPrefix)) await rm(resolvedProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
