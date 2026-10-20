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
const fonts = await localTypographyFonts(root);
const layouts = [];
const profile = await mkdtemp(path.join(tmpdir(), 'activ-booking-history-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const deletedId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const booking = { id: 'booking1', bookingRef: 'ACTIVB-HISTORY-1', eventId: deletedId, eventTitle: 'Deleted workshop', eventStartAt: '2026-10-04', status: 'active', noOfPersons: 1, unitAmount: 500, totalAmount: 500, payment: { status: 'paid', mode: 'online' }, bookedBy: { name: 'Retained Contact', email: 'contact@example.test', phone: '+919876543210' }, participants: [{ name: 'Retained Attendee', email: 'attendee@example.test', phone: '+919000000000' }] };
const bookings = Array.from({ length: 40 }, (_, i) => ({ ...booking, id: `booking${i + 1}`, bookingRef: `ACTIVB-HISTORY-${i + 1}`,
    bookedBy: { ...booking.bookedBy, name: i === 0 ? 'Retained Contact' : i === 1 ? 'A very long participant name that must remain fully readable' : `Sample Contact ${i + 1}`,
        email: i === 1 ? 'long.unbroken.address.for.layout.checking@example.test' : booking.bookedBy.email } }));
const event = { id: deletedId, title: booking.eventTitle, startAt: booking.eventStartAt, status: 'deleted', historyCategory: 'deleted', bookingHistoryOnly: true, registrationEnabled: false, totalSeats: 0, bookedSeats: 1, remainingSeats: null, bookings: 40, collected: 20000, price: 0, pendingAmount: 0 };
const events = [event,
    { ...event, id: 'cccccccccccccccccccccccc', title: 'Current workshop', historyCategory: 'current', status: 'published', bookingHistoryOnly: false },
    { ...event, id: 'aaaaaaaaaaaaaaaaaaaaaaaa', title: 'Completed workshop', historyCategory: 'past', status: 'published', bookingHistoryOnly: false },
];
const historyTotals = Object.fromEntries(['current', 'past', 'deleted'].map(key => [key, { events: 1, seats: 40, bookings: 40, capacity: 0, collected: 20000, pending: 0 }]));
const requests = [];
let bundle = '', css = '', chrome, ws;
const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (fonts.serve(url, res)) return;
    if (url.pathname === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
    if (url.pathname === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
    if (url.pathname.startsWith('/api/')) {
        requests.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams) });
        res.setHeader('Content-Type', 'application/json');
        let data = {};
        if (url.pathname.endsWith('/bookings/overview')) data = { events, historyTotals, totals: { events: 3, seats: 120, bookings: 120, capacity: 0, collected: 60000, pending: 0 } };
        if (url.pathname.endsWith(`/${deletedId}/bookings`)) {
            const page = Number(url.searchParams.get('page') || 1);
            data = { bookings: bookings.slice((page - 1) * 10, page * 10), summary: { bookings: 40, seats: 40, collected: 20000, pending: 0, paidBookings: 40, pendingBookings: 0 }, pagination: { page, limit: 10, total: 40, pages: 4 } };
        }
        if (url.pathname.endsWith('/bookings/export')) { res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); return res.end(Buffer.from('PK\x03\x04fixture')); }
        return res.end(JSON.stringify({ success: true, data }));
    }
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
    if (process.env.TEST_ARTIFACTS) await mkdir(process.env.TEST_ARTIFACTS, { recursive: true });
    const files = await readdir(path.join(root, 'dist/assets'));
    css = await readFile(process.env.TEST_CSS || path.join(root, 'dist/assets', files.find(file => /^index-.*\.css$/.test(file))), 'utf8');
    css += '\n' + fonts.css;
    const fixtures = { name: 'unrelated-shell-fixtures', setup(b) {
        b.onResolve({ filter: /AdminSidebar$|\/BookingPeople$|\/notificationDeliveryApi$/ }, args => ({ path: args.path, namespace: 'fixture' }));
        b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => args.path.endsWith('AdminSidebar')
            ? ({ resolveDir: root, loader: 'jsx', contents: 'export default function Sidebar(){return <aside data-fixture-sidebar className="hidden lg:block shrink-0 lg:w-[17.5rem] xl:w-[20.5rem] 2xl:w-[22rem] bg-blue-900"/>}' })
            : ({ loader: 'js', contents: 'export default function Empty(){return null};export const getDeliverySummaries=async()=>({});export const getBookingDelivery=async()=>({rows:[]});export const resendNotification=async()=>{throw Error("Read-only fixture");};' }));
    } };
    const built = await build({ absWorkingDir: root, bundle: true, write: false, outdir: profile, format: 'iife', platform: 'browser', jsx: 'automatic', plugins: [fixtures], define: { 'import.meta.env': JSON.stringify({ DEV: true, VITE_API_URL: `http://127.0.0.1:${server.address().port}/api/v1` }), 'process.env.NODE_ENV': '"test"' }, stdin: { resolveDir: root, loader: 'tsx', contents: `
        import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,Routes,Route} from 'react-router-dom';
        import BookingEvents from './src/features/admin/super-admin/pages/BookingEvents';import Bookings from './src/features/admin/super-admin/pages/Bookings';
        localStorage.setItem('role','super_admin');localStorage.setItem('token','fixture-token');
        createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/super-admin/bookings']}><Routes><Route path="/super-admin/bookings" element={<BookingEvents/>}/><Route path="/super-admin/bookings/:eventId" element={<Bookings/>}/></Routes></MemoryRouter>);
    ` } });
    bundle = built.outputFiles.find(file => file.path.endsWith('.js')).text;
    css += '\n' + (built.outputFiles.find(file => file.path.endsWith('.css'))?.text || '');
    chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    let port;
    for (let i = 0; i < 100; i++) { try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch {} await pause(100); }
    assert(port, 'Chrome starts');
    const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
    ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise(resolve => ws.addEventListener('open', resolve));
    let seq = 0; const pending = new Map(), errors = [];
    ws.addEventListener('message', event => { const m = JSON.parse(event.data); if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text); pending.get(m.id)?.(m); pending.delete(m.id); });
    const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq, timer = setTimeout(() => reject(Error(method)), method === 'Page.captureScreenshot' ? 45000 : 15000); pending.set(id, r => { clearTimeout(timer); resolve(r); }); ws.send(JSON.stringify({ id, method, params })); });
    const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw Error(r.result.exceptionDetails.exception?.description); return r.result?.result?.value; };
    const until = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(`Boolean(${expression})`)) return; await pause(100); } throw Error(expression); };
    await send('Runtime.enable');
    await send('Network.enable');
    await send('Network.setBlockedURLs', {urls:['https://*']});
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}` });
    await until('document.body.textContent.includes("Current workshop")');
    await evaluate('document.fonts.ready');
    if(fonts.loaded) assert(await evaluate("document.fonts.check('600 20px Poppins')"),'Local Poppins loaded');
    const typography = [];
    for (const width of [1440, 390, 320]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
        await pause(100);
        const measured = await evaluate(`(() => {
            const style = element => ({ size: getComputedStyle(element).fontSize, family: getComputedStyle(element).fontFamily });
            return { width: innerWidth, body: style(document.body), title: style(document.querySelector('h1')),
                subtitle: style(document.querySelector('h1 + p')),
                control: style(document.querySelector('input[aria-label="Event name or venue"]')),
                metrics: [...document.querySelectorAll('p.tabular-nums')].map(style),
                overflows: document.documentElement.scrollWidth > innerWidth };
        })()`);
        const originalRoot = width >= 640 ? 16 : 14;
        assert.equal(measured.title.size, width >= 640 ? '40px' : '21px', `${width}: historical shared page heading size`);
        assert.equal(measured.body.size, `${originalRoot}px`, `${width}: historical base size`);
        assert.equal(measured.subtitle.size, `${originalRoot * 1.25}px`, `${width}: historical description size`);
        assert(parseFloat(measured.control.size) >= 16, `${width}: input avoids mobile focus zoom`);
        assert(measured.body.family.includes('Poppins'), `${width}: shared UI font family`);
        assert(measured.metrics.length === 4 && measured.metrics.every(metric => metric.size === (width >= 640 ? '54px' : '22.75px')), `${width}: historical metric sizes`);
        assert.equal(measured.overflows, false, `${width}: overview fits viewport`);
        await evaluate('document.querySelector("details").open=true');
        const filters=await evaluate(`(() => {
            const elements=[...document.querySelectorAll('details input,details select,details button')].filter(e=>e.getBoundingClientRect().width>0);
            return {count:elements.length,fields:elements.map(e=>{const r=e.getBoundingClientRect();return {tag:e.tagName,name:e.getAttribute('aria-label')||e.textContent.trim(),size:parseFloat(getComputedStyle(e).fontSize),left:r.left,right:r.right}}),labels:[...document.querySelectorAll('details label')].map(e=>parseFloat(getComputedStyle(e).fontSize))};
        })()`);
        assert(filters.count>10,'Expanded filter fixture has actual controls');
        assert(filters.fields.every(e=>e.left>=-1&&e.right<=width+1&&e.size>0),`${width}: filters fit ${JSON.stringify(filters)}`);
        if (width < 640) assert(filters.fields.filter(e=>e.tag==='INPUT'||e.tag==='SELECT').every(e=>e.size>=16),'Phone fields avoid focus zoom');
        assert(filters.labels.length>0&&filters.labels.every(size=>size>0),'Expanded labels are visible');
        assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),`${width}: expanded filter fits viewport`);
        typography.push({...measured,filters});
        if (process.env.TEST_ARTIFACTS) {
            const shot = await send('Page.captureScreenshot', { format: 'png' });
            await writeFile(path.join(process.env.TEST_ARTIFACTS, `booking-overview-${width}.png`), Buffer.from(shot.result.data, 'base64'));
        }
        await evaluate('document.querySelector("details").open=false');
    }
    if (process.env.TEST_ARTIFACTS) await writeFile(path.join(process.env.TEST_ARTIFACTS, 'booking-typography.json'), JSON.stringify(typography, null, 2));
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    assert.equal(await evaluate('document.body.textContent.includes("Deleted workshop")'), false);
    await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent.startsWith("Past")).click()');
    await until('document.body.textContent.includes("Completed workshop")');
    assert.equal(await evaluate('document.body.textContent.includes("Current workshop")'), false);
    await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent.startsWith("Deleted")).click()');
    await until('document.body.textContent.includes("Deleted workshop")');
    assert(await evaluate('document.body.textContent.includes("Deleted event · bookings retained")'));
    await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="Booking Details").click()');
    await until('document.body.textContent.includes("Retained Contact")');
    assert(await evaluate('document.body.textContent.includes("contact@example.test")'), 'booker contact is visible');
    assert(await evaluate('document.querySelector("select")?.selectedOptions[0].textContent.includes("bookings retained")'), 'deleted event remains selected in picker');
    assert.equal(await evaluate('[...document.querySelectorAll("button")].some(b=>b.textContent.trim()==="Attendance")'), false, 'no broken attendance action for a physically deleted event');
    await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent.includes("Excel Report")).click()');
    for (let i = 0; i < 50 && !requests.some(r => r.path.endsWith('/bookings/export')); i++) await pause(100);
    assert(requests.some(r => r.path.endsWith(`/${deletedId}/bookings/export`) && r.query.format === 'xlsx'));
    for (const width of [1440, 1024, 768, 640, 390, 320]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 940, deviceScaleFactor: 1, mobile: width < 600 });
        await pause(150);
        await evaluate('document.querySelector(".booking-records").scrollIntoView({block:"start"})');
        assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'), `${width}: page fits viewport`);
        const layout = await evaluate(`(() => {
            const card = document.querySelector('.booking-records');
            const elements = [card, ...card.querySelectorAll('table, tr, td, button')];
            const size=e=>parseFloat(getComputedStyle(e).fontSize);
            return {width:innerWidth,font:getComputedStyle(card).fontFamily,nameSize:size(card.querySelector('.booking-records-name')),tableSize:size(card.querySelector('table')),actionSize:size(card.querySelector('.booking-records-details')),captionSize:parseFloat(getComputedStyle(card.querySelector('.booking-records-contact'),'::before').fontSize),overflow: elements.filter(e => e.clientWidth && e.scrollWidth > e.clientWidth + 1).map(e => e.className),
                actionsFit: [...card.querySelectorAll('.booking-records-details')].every(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; })};
        })()`);
        layouts.push(layout);
        if(process.env.TEST_ARTIFACTS) await writeFile(path.join(process.env.TEST_ARTIFACTS,'booking-list-typography.json'),JSON.stringify({fonts:fonts.loaded?'local Poppins':'system fallback',layouts},null,2));
        const originalRoot = width >= 640 ? 16 : 14;
        assert(layout.font.includes('Poppins')); assert.equal(layout.nameSize, originalRoot); assert.equal(layout.actionSize, originalRoot * .875);
        assert.equal(layout.tableSize, originalRoot); if(width<=768) assert.equal(layout.captionSize, originalRoot * .75);
        assert.deepEqual(layout.overflow, [], `${width}: no clipped cells or sideways scrolling`);
        assert(layout.actionsFit, `${width}: every Details button stays within the viewport`);
        if (process.env.TEST_ARTIFACTS && [1440, 768, 390, 320].includes(width)) {
            const shot = await send('Page.captureScreenshot', { format: 'png' });
            await writeFile(path.join(process.env.TEST_ARTIFACTS, `booking-layout-${width}.png`), Buffer.from(shot.result.data, 'base64'));
        }
    }
    await evaluate('document.querySelector(".booking-records-details").click()');
    await until('document.querySelector("[role=dialog]")');
    assert(await evaluate('document.querySelector("[role=dialog]").textContent.includes("contact@example.test")'), 'Details still opens the retained contact');
    assert.equal(await evaluate('document.querySelector("[role=dialog]").textContent.includes("Delete booking")'), false, 'booking deletion is not offered');
    await evaluate('window.dispatchEvent(new KeyboardEvent("keydown", {key:"Escape"}))');
    await until('!document.querySelector("[role=dialog]")');
    await evaluate(`document.querySelector('button[aria-label="Next page"]').click()`);
    await until('document.body.textContent.includes("Showing 11 to 20 of 40")');
    assert.equal(await evaluate('document.querySelector(".booking-records-number").textContent.trim()'), '11', 'numbering continues on page two');
    await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent.includes("All events")).click()');
    await until('document.body.textContent.includes("Deleted workshop")');
    assert(await evaluate('[...document.querySelectorAll("button[aria-pressed=true]")].some(b=>b.textContent.startsWith("Deleted"))'), 'back returns to Deleted history');
    assert(requests.every(r => r.method === 'GET'), 'viewing history does not write any data');
    assert(!requests.some(r => r.path === '/api/v1/events'), 'history does not depend on the deleted event list');
    assert.deepEqual(errors, []);
    console.log('PASS: retained contacts, history picker, Excel, details, pagination and no horizontal overflow at 1440/1024/768/640/390/320px; shared UI typography verified; no writes.');
    await send('Browser.close');
} finally {
    ws?.close(); chrome?.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    if (path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep + 'activ-booking-history-')) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
