import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'activ-payment-return-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let bundle = '', css = '', chrome, ws;
const server = http.createServer((req, res) => {
  if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
  if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
  res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  const assets = await readdir(path.join(root, 'dist/assets'));
  css = await readFile(path.join(root, 'dist/assets', assets.find(file => /^index-.*\.css$/.test(file))), 'utf8');
  const sources = {
    './MemberSidebar': 'export default ()=>null;',
    '@/features/member/components/MemberTopBar': 'export default ()=>null;',
    '@/components/layout/HeaderSection': 'export function HeaderSection(){return <header className="bg-white p-4 font-bold text-blue-950">ACTIV</header>}',
    '@/components/layout/FooterSection': 'export function FooterSection(){return <footer className="p-4 text-center text-slate-600">ACTIV · Contact the association</footer>}',
    '@/lib/session': 'export const isMemberSession=()=>window.fixtureMember;',
    '@/services/api': `
      const fixture=new URLSearchParams(location.search);window.fixtureMember=fixture.get('session')==='member';window.fixtureRequests=[];
      const originalNow=Date.now;let elapsed=0;Date.now=()=>originalNow()+elapsed;
      const api={get:async(url,options)=>{
        window.fixtureRequests.push({url,options});
        const id=url.split('/').pop();
        const type=fixture.get('type')||'membership',status=fixture.get('status')||'paid';
        if(status==='created')elapsed+=31000;
        if(url.includes('/return/')&&fixture.get('publicError')==='1')throw Error('Fixture public read unavailable');
        const data=url.includes('donations')?{status,amount:1000,receiptNumber:'ACTIV-DONATION-2026-0000000001',receiptToken:'fixture-receipt',statementToken:'fixture-statement',financialYear:'2026-27',donorName:id==='late-old'?'Old Donor':id==='new-order'?'New Donor':'Test Donor'}:
          {orderId:id,orderType:type,status,amount:type==='event_booking'?1000:5000,planName:id==='late-old'?'Old Business':id==='new-order'?'New Business':type==='company_listing'?'Additional company':type==='membership'?'Business Annual':'Conference seats',paymentId:'BANK-VERIFIED',gatewayPaymentId:'BANK-VERIFIED',paidAt:'2026-10-12T06:00:00Z',companyId:type==='company_listing'?'company-one':'',bookingRef:type==='event_booking'?'BOOK-1':'',eventId:type==='event_booking'?'event-one':'',eventSlug:type==='event_booking'?'conference':''};
        if(id==='late-old')return new Promise(resolve=>{window.deliverLateOrder=()=>resolve({data:{data}})});
        return {data:{data}};
      }};export default api;export const unwrap=(response,fallback)=>response?.data?.data??response?.data??fallback;
    `,
  };
  const result = await build({ absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    define: { 'import.meta.env': '{"DEV":true}', 'process.env.NODE_ENV': '"test"' },
    plugins: [{ name: 'payment-return-fixture', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => args.path === './api' && /[\\/]services[\\/]/.test(args.importer)
        ? { path: '@/services/api', namespace: 'fixture' } : args.path in sources ? { path: args.path, namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: sources[args.path], loader: 'tsx', resolveDir: root }));
    } }],
    stdin: { resolveDir: root, loader: 'tsx', contents: `
      import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter,Routes,Route,useLocation,useNavigate} from 'react-router-dom';
      import PaymentReturn from './src/pages/payment/PaymentReturn';import DonateThankYou from './src/pages/donate/DonateThankYou';
      function Target(){const location=useLocation();return <p data-target>{location.pathname+location.search}</p>}
      function Controls(){window.fixtureNavigate=useNavigate();return null}
      createRoot(document.getElementById('root')).render(<BrowserRouter><Controls/><Routes><Route path="/payment-success" element={<PaymentReturn/>}/><Route path="/donate/thank-you" element={<DonateThankYou/>}/><Route path="*" element={<Target/>}/></Routes></BrowserRouter>);
    ` },
  });
  bundle = result.outputFiles[0].text;
  chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let port;
  for (let i = 0; i < 100; i++) { try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch {} await pause(100); }
  assert(port, 'Chrome starts');
  const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
  ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve));
  let seq = 0; const pending = new Map(), errors = [];
  ws.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text); pending.get(message.id)?.(message); pending.delete(message.id); });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq, timer = setTimeout(() => reject(Error(method)), method === 'Page.captureScreenshot' ? 45000 : 15000); pending.set(id, result => { clearTimeout(timer); resolve(result); }); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (response.result?.exceptionDetails) throw Error(response.result.exceptionDetails.exception?.description); return response.result?.result?.value; };
  const until = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(`Boolean(${expression})`)) return; await pause(60); } throw Error(expression + ': ' + (await evaluate('document.body.innerText')).slice(0, 600) + ' ' + errors.join(';')); };
  const origin = `http://127.0.0.1:${server.address().port}`;
  const load = async (pathname, query) => {
    const url = origin + pathname + '?' + new URLSearchParams({ orderId: 'ord_fixture', ...query });
    await send('Page.navigate', { url });
    await until(`location.href===${JSON.stringify(url)} && document.readyState==='complete' && Array.isArray(window.fixtureRequests)`);
  };
  const fits = async width => {
    await send('Emulation.setDeviceMetricsOverride', { width, height: width === 1440 ? 1000 : 844, deviceScaleFactor: 1, mobile: width < 600 });
    await pause(80);
    assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'), `return page fits ${width}px`);
    const bounds = await evaluate(`(()=>{const a=document.querySelector('a[href^="activ:"]'),r=a?.getBoundingClientRect();return r?{left:r.left,right:r.right,height:r.height,width:innerWidth}:null})()`);
    if (bounds) { assert(bounds.left >= 0 && bounds.right <= bounds.width, 'app-return action is fully visible'); assert(bounds.height >= 44, `app return is a usable touch target: ${JSON.stringify(bounds)}`); }
  };
  const link = () => evaluate(`document.querySelector('a[href^="activ:"]')?.getAttribute('href')`);
  const click = label => evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===${JSON.stringify(label)}).click()`);
  await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['https://*'] });
  for (const width of [1440, 390, 320]) {
    await load('/payment-success', { client: 'app', type: 'membership', session: 'member', payment_id: 'UNTRUSTED-HINT', payment_status: 'Failed' });
    await until('document.body.innerText.includes("Payment received")'); await fits(width);
    assert(await evaluate('document.body.innerText.includes("Business Annual") && document.body.innerText.includes("BANK-VERIFIED") && document.body.innerText.includes("11:30")'), 'membership receipt uses server amount/plan/reference and IST');
    assert(!(await evaluate('document.querySelector("dl").innerText.includes("UNTRUSTED-HINT")')), 'URL payment ID is not printed as verified');
    assert.equal(await link(), 'activ://payment-success?orderId=ord_fixture&payment_id=UNTRUSTED-HINT&payment_status=Failed');
    if (process.env.TEST_ARTIFACTS && width !== 320) { const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 75, captureBeyondViewport: false }); await writeFile(path.join(process.env.TEST_ARTIFACTS, `payment-return-${width}.jpg`), Buffer.from(shot.result.data, 'base64')); }
  }
  await load('/payment-success', { client: 'app', type: 'company_listing', session: 'member', publicError: '1' });
  await until('document.body.innerText.includes("Company settings")'); await fits(390);
  assert(await evaluate('document.body.innerText.includes("additional company publishing payment is confirmed")'));
  await click('Company settings'); await until('document.querySelector("[data-target]")?.textContent==="/business/settings"');
  for (const session of ['guest', 'member']) {
    await load('/payment-success', { client: 'app', type: 'event_booking', session });
    await until('document.body.innerText.includes("Your event booking is confirmed")'); await fits(390);
    assert(await link(), 'app booking keeps app-return action');
    if (session === 'guest') assert(await evaluate('!window.fixtureRequests.some(request=>request.url.includes("/payment/order/"))'), 'guest does not trigger protected order reads');
    await click('View my booking');
    const target = `${session === 'member' ? '/member' : ''}/events/conference/book?ref=BOOK-1`;
    await until(`document.querySelector('[data-target]')?.textContent===${JSON.stringify(target)}`);
  }
  await load('/payment-success', { client: 'app', type: 'company_listing', status: 'created', payment_status: 'Failed' });
  await until('document.body.innerText.includes("We are still confirming")'); await fits(320);
  assert(!(await evaluate('document.body.innerText.includes("The payment did not go through")')), 'pending server result beats failed query hint');
  assert(await link(), 'unconfirmed result retains app return');
  await load('/payment-success', { type: 'membership' }); await until('document.body.innerText.includes("Payment received")');
  assert.equal(await link(), undefined, 'website-only payment has no app handoff');
  await load('/donate/thank-you', { client: 'app', payment_id: 'GIFT-HINT', payment_status: 'Credit' });
  await until('document.body.innerText.includes("Thank you, Test Donor")');
  for (const width of [1440, 390, 320]) await fits(width);
  assert.equal(await link(), 'activ://donate/thank-you?orderId=ord_fixture&payment_id=GIFT-HINT&payment_status=Credit');
  assert(await evaluate('!!document.querySelector("a[href*=fixture-receipt]") && !!document.querySelector("a[href*=fixture-statement]")'), 'donation receipt and yearly certificate use server tokens');
  if (process.env.TEST_ARTIFACTS) { const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 75, captureBeyondViewport: false }); await writeFile(path.join(process.env.TEST_ARTIFACTS, 'donation-return-mobile.jpg'), Buffer.from(shot.result.data, 'base64')); }
  for (const pathname of ['/payment-success', '/donate/thank-you']) {
    await load(pathname, { client: 'app', orderId: 'late-old' });
    await until('typeof window.deliverLateOrder==="function"');
    await evaluate(`window.fixtureNavigate(${JSON.stringify(pathname + '?client=app&orderId=new-order')})`);
    const newer = pathname === '/payment-success' ? 'New Business' : 'New Donor';
    await until(`document.body.innerText.includes(${JSON.stringify(newer)})`);
    await evaluate('window.deliverLateOrder()'); await pause(100);
    assert(await evaluate(`document.body.innerText.includes(${JSON.stringify(newer)}) && !document.body.innerText.includes('Old Donor') && !document.body.innerText.includes('Old Business')`), 'late old response cannot replace a new order receipt');
    assert((await link()).includes('orderId=new-order'), 'app return follows the currently displayed order');
  }
  assert.deepEqual(errors, []);
  console.log('PASS: real payment and donation return components at 320/390/1440px; verified membership receipt; company fallback/destination; public/member event destinations; pending query hints; safe native links; donation receipt/certificate actions.');
  await send('Browser.close');
} finally {
  ws?.close(); chrome?.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  if (path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep + 'activ-payment-return-')) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
