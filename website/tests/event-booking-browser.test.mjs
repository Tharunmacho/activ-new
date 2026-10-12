import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'activ-event-booking-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let bundle = '', css = '', chrome, ws;
const server = http.createServer((req, res) => {
    if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
    if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
    res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
    try { const assets = await readdir(path.join(root, 'dist/assets')); css = await readFile(path.join(root, 'dist/assets', assets.find(file => /^index-.*\.css$/.test(file))), 'utf8'); } catch {}
    const fixtures = { name: 'booking-fixtures', setup(b) {
        b.onResolve({ filter: /(?:services\/(?:api|activApi|eventBookingApi)|lib\/session|layout\/(?:HeaderSection|FooterSection))$/ }, args => ({ path: args.path, namespace: 'fixture' }));
        b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => {
            let contents = '';
            if (args.path.endsWith('/api')) contents = 'export const errorMessage=(e,f)=>e.message||f;export const unwrap=r=>r;export default {post:async()=>({})};';
            else if (args.path.endsWith('activApi')) contents = 'export const login=async()=>({});';
            else if (args.path.endsWith('session')) contents = 'export const isMemberSession=()=>true;';
            else if (args.path.endsWith('HeaderSection')) contents = 'export const HeaderSection=()=>null;';
            else if (args.path.endsWith('FooterSection')) contents = 'export const FooterSection=()=>null;';
            else contents = 'export const getBookableEvent=async()=>window.eventFixture;export const bookAndPay=async(id,body)=>{window.savedBody=body;return window.bookingFixture};export const getEventBooking=async()=>window.bookingFixture;export const resumeEventBookingPayment=async()=>window.bookingFixture;';
            return { loader: 'js', contents };
        });
    } };
    bundle = (await build({ absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', plugins: [fixtures], define: { 'import.meta.env': '{"DEV":true}', 'process.env.NODE_ENV': '"test"' }, stdin: { resolveDir: root, loader: 'tsx', contents: `
        import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,Routes,Route} from 'react-router-dom';
        import EventBookingPage from './src/pages/onboarding/EventBookingPage';
        window.eventFixture={id:'fixture',title:'Conference fixture',startAt:'2030-10-23T03:30:00Z',endAt:'2030-10-23T11:30:00Z',mode:'offline',venue:'Chennai',amount:0,price:0,capacity:100,seatsLeft:100,maxPerBooking:10,registrationFields:[{key:'meal',label:'Meal preference',type:'select',required:true,options:['Vegetarian','Other']},{key:'consent',label:'Confirm attendance',type:'checkbox',required:true}]};
        window.bookingFixture={bookingRef:'FIXTURE-REF',eventId:'fixture',eventTitle:'Conference fixture',eventStartAt:window.eventFixture.startAt,status:'active',payment:{status:'not_required'},bookedBy:{name:'Booker',email:'booker@example.test',phone:'9000000001'},participants:[{name:'Booker'}],noOfPersons:1,unitAmount:0,totalAmount:0,responses:[{key:'meal',label:'Meal preference',value:'Vegetarian'}],passes:[{index:0,name:'Booker',registrationNo:'FIXTURE-REF-P1',url:'https://example.test/checkin/'+('a'.repeat(40))}]};
        createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/events/fixture/book']}><Routes><Route path='/events/:id/book' element={<EventBookingPage chrome='member'/>}/></Routes></MemoryRouter>);
    ` } })).outputFiles[0].text;
    chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    let port;
    for (let i = 0; i < 100; i++) { try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch {} await pause(100); }
    assert(port, 'Chrome starts');
    const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
    ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise(resolve => ws.addEventListener('open', resolve));
    let seq = 0; const pending = new Map(), errors = [];
    ws.addEventListener('message', event => { const m = JSON.parse(event.data); if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); pending.get(m.id)?.(m); pending.delete(m.id); });
    const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq, timer = setTimeout(() => reject(Error(method)), 15000); pending.set(id, r => { clearTimeout(timer); resolve(r); }); ws.send(JSON.stringify({ id, method, params })); });
    const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw Error(r.result.exceptionDetails.exception?.description); return r.result?.result?.value; };
    const until = async expression => { for (let i = 0; i < 70; i++) { if (await evaluate(`Boolean(${expression})`)) return; await pause(100); } throw Error(expression + JSON.stringify(errors)); };
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}` });
    await until('document.querySelector("#registration-meal")');
    const fill = async (index, value) => evaluate(`(()=>{const input=document.querySelectorAll('input')[${index}];Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await fill(0, 'Booker'); await fill(1, 'booker@example.test'); await fill(2, '9000000001');
    const click = text => evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent.trim().startsWith(${JSON.stringify(text)})).click()`);
    await click('Continue');
    await until('document.body.textContent.includes("Meal preference is required")');
    assert.equal(await evaluate('window.savedBody'), undefined, 'required questions prevent booking');
    await evaluate(`(()=>{const select=document.querySelector('#registration-meal');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,'Vegetarian');select.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#registration-consent').click();})()`);
    await click('Continue');
    await until('document.body.textContent.includes("Review your booking")');
    assert.equal(await evaluate('window.savedBody'), undefined, 'review does not create or charge');
    await click('Edit details'); await until('document.querySelector("#registration-meal")');
    assert.equal(await evaluate('document.querySelector("#registration-meal").value'), 'Vegetarian');
    await click('Continue'); await until('document.body.textContent.includes("Review your booking")');
    await click('Confirm booking'); await until('document.body.textContent.includes("Entry passes")');
    assert.deepEqual(await evaluate('window.savedBody.responses'), { meal: 'Vegetarian', consent: true });
    assert.equal(await evaluate('window.savedBody.amount'), undefined);
    assert(await evaluate('document.body.textContent.includes("FIXTURE-REF-P1")'));
    if (css) assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'), 'mobile ticket fits viewport');
    assert.deepEqual(errors, []);
    console.log('PASS: website event questions, required validation, review/edit persistence, server-only amount, confirmed signed-pass presentation on mobile viewport.');
    await send('Browser.close');
} finally {
    ws?.close(); chrome?.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    if (path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep + 'activ-event-booking-')) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
