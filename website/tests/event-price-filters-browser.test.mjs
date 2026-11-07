// Real event list components, local fixtures and headless Chrome only.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'activ-event-price-filters-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let bundle = '', css = '', chrome, ws;
const server = http.createServer((req, res) => {
  if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
  if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
  res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
try {
  const assets = await readdir(path.join(root, 'dist/assets'));
  css = await readFile(path.join(root, 'dist/assets', assets.find(f => /^index-.*\.css$/.test(f))), 'utf8');
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString();
  const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString();
  const common = { startAt: nextWeek, mode: 'online', category: 'Training', language: 'Tamil', audience: 'public', targets: [], registrationEnabled: true };
  const publicEvents = [
    { ...common, id: 'public-free', title: 'Free Tamil workshop', registrationFee: 0 },
    { ...common, id: 'public-paid', title: 'Paid Tamil workshop', registrationFee: 500 },
    { ...common, id: 'public-member-offer', title: 'Public fee member offer', registrationFee: 250, memberPrice: 0, hasMemberRate: true },
    { ...common, id: 'public-english', title: 'Paid English meeting', registrationFee: 75, language: 'English', mode: 'offline' },
    { ...common, id: 'public-legacy', title: 'Legacy free event', language: 'English' },
  ];
  const memberEvents = [
    { ...common, id: 'member-free', title: 'Standard free event', registrationFee: 0 },
    { ...common, id: 'member-zero', title: 'Eligible member free event', registrationFee: 500, yourPrice: 0, myRegistration: { status: 'confirmed', seats: 1 } },
    { ...common, id: 'member-discount', title: 'Discounted paid event', registrationFee: 500, yourPrice: 125, myRegistration: { status: 'confirmed', seats: 1 } },
    { ...common, id: 'member-legacy', title: 'Legacy paid event', registrationFee: 80 },
    { ...common, id: 'member-null', title: 'Fallback paid event', registrationFee: 100, yourPrice: null },
    { ...common, id: 'member-past', title: 'Past free event', startAt: lastWeek, registrationFee: 0 },
  ];
  const sources = {
    '@/services/activApi': 'export const getRegionTree=async()=>({states:[]});export const errorMessage=(e,f)=>e.message||f;',
    '@/services/memberHubApi': `export const listMemberEvents=async()=>({events:${JSON.stringify(memberEvents)}});export const registrationHref=(id)=>'/member/events/'+id;`,
    '@/pages/member/MemberPageShell': 'export default function Shell({children}){return <main className="mx-auto w-full max-w-5xl px-4 py-8">{children}</main>}',
  };
  const built = await build({
    absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    alias: { '@': path.join(root, 'src') },
    define: { 'import.meta.env': '{"DEV":true}', 'process.env.NODE_ENV': '"test"' },
    plugins: [{ name: 'event-price-fixtures', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => args.path in sources ? { path: args.path, namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: sources[args.path], loader: 'tsx', resolveDir: root }));
    } }],
    stdin: { resolveDir: root, loader: 'tsx', contents: `
      import React from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter,Routes,Route}from'react-router-dom';
      import{EventsExplorer}from'./src/pages/onboarding/components/EventsExplorer';
      import MemberEvents from'./src/features/member/pages/MemberEvents';
      import{matchesEventPrice}from'./src/lib/eventFilters';
      window.matchesEventPrice=matchesEventPrice;
      createRoot(document.getElementById('root')).render(<BrowserRouter><Routes>
        <Route path='/events' element={<main className="pt-12"><EventsExplorer events={${JSON.stringify(publicEvents)}} settings={{categories:[{label:'Training'}]}}/></main>}/>
        <Route path='/member/events' element={<MemberEvents/>}/>
      </Routes></BrowserRouter>);
    ` },
  });
  bundle = built.outputFiles[0].text;
  chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--no-first-run', 'about:blank',
  ], { windowsHide: true, stdio: 'ignore' });
  let port;
  for (let n = 0; n < 100; n++) { try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch {} await pause(100); }
  assert(port, 'Chrome starts');
  const tabs = await fetch('http://127.0.0.1:' + port + '/json/list').then(r => r.json());
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve));
  let sequence = 0;
  const pending = new Map(), errors = [];
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    pending.get(message.id)?.(message); pending.delete(message.id);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(Error(method)); }, 30000);
    pending.set(id, result => { clearTimeout(timer); resolve(result); });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.result?.exceptionDetails) throw Error(result.result.exceptionDetails.exception?.description);
    return result.result?.result?.value;
  };
  const until = async expression => {
    for (let n = 0; n < 120; n++) { if (await evaluate('Boolean(' + expression + ')')) return; await pause(80); }
    throw Error(expression + '; ' + errors.join(';'));
  };
  const select = (label, value) => evaluate(`(()=>{const control=document.querySelector('select[aria-label=${JSON.stringify(label)}]');control.value=${JSON.stringify(value)};control.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const click = label => evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent.trim().startsWith(${JSON.stringify(label)})).click()`);
  const has = title => evaluate(`document.body.innerText.includes(${JSON.stringify(title)})`);
  const waitTitle = title => until(`document.body.innerText.includes(${JSON.stringify(title)})`);
  const fits = async width => {
    const bounds = await evaluate(`(()=>{const r=document.querySelector('select[aria-label="Ticket price"]').getBoundingClientRect();return{left:r.left,right:r.right,height:r.height};})()`);
    assert(bounds.left >= 0 && bounds.right <= width && bounds.height >= 44, 'Ticket price fits and has a 44px tap target at ' + width + ': ' + JSON.stringify(bounds));
    assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'), 'No horizontal overflow at ' + width);
  };
  await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['https://*'] });
  for (const width of [320, 390, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
    await send('Page.navigate', { url: base + '/events?price=paid' });
    await waitTitle('Paid Tamil workshop');
    assert(!(await has('Free Tamil workshop')));
    assert(!(await has('Legacy free event')));
    assert(await has('Public fee member offer'), 'Public pricing does not assume member eligibility');
    assert.equal(await evaluate('document.querySelector(\'select[aria-label="Ticket price"]\').value'), 'paid');
    await fits(width);
    await select('Ticket price', 'free'); await waitTitle('Free Tamil workshop');
    assert(await has('Legacy free event'), 'Missing fee follows the booking zero default');
    assert(!(await has('Paid Tamil workshop')));
    assert(!(await has('Public fee member offer')));
    await until('new URLSearchParams(location.search).get("price")==="free"');
    await select('Language', 'Tamil'); await until('!document.body.innerText.includes("Legacy free event")');
    await click('Reset'); await waitTitle('Paid English meeting');
    assert.equal(await evaluate('location.search'), '', 'Reset clears price and other URL filters');
    assert.equal(await evaluate('document.querySelector(\'select[aria-label="Ticket price"]\').value'), '');
    await select('Ticket price', 'paid'); await select('Language', 'English'); await waitTitle('Paid English meeting');
    await until('!document.body.innerText.includes("Paid Tamil workshop")');
    await send('Page.reload'); await waitTitle('Paid English meeting');
    assert(!(await has('Paid Tamil workshop')), 'Shared URL/reload retains the combined filters');
    await fits(width);
    if (process.env.TEST_ARTIFACTS) {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      await writeFile(path.join(process.env.TEST_ARTIFACTS, 'public-event-price-' + width + '.png'), Buffer.from(shot.result.data, 'base64'));
    }

    await send('Page.navigate', { url: base + '/member/events' });
    await waitTitle('Eligible member free event');
    await evaluate('document.querySelector("summary").click()');
    await select('Ticket price', 'free'); await until('!document.body.innerText.includes("Discounted paid event")');
    assert(await has('Standard free event'));
    assert(await has('Eligible member free event'), 'yourPrice=0 takes precedence over positive registrationFee');
    assert(!(await has('Legacy paid event')));
    await fits(width);
    await select('Ticket price', 'paid'); await waitTitle('Discounted paid event');
    assert(await has('Legacy paid event'));
    assert(await has('Fallback paid event'), 'Null/absent yourPrice falls back to the standard fee');
    assert(!(await has('Eligible member free event')));
    await click('My registrations'); await until('!document.body.innerText.includes("Legacy paid event")');
    assert(await has('Discounted paid event'), 'Ticket price applies to the selected member tab');
    await click('Clear all filters'); await waitTitle('Eligible member free event');
    assert.equal(await evaluate('document.querySelector(\'select[aria-label="Ticket price"]\').value'), '');
    await click('Past'); await waitTitle('Past free event');
    await select('Ticket price', 'paid'); await waitTitle('No matching events');
    await select('Ticket price', 'free'); await waitTitle('Past free event');
    await fits(width);
  }
  assert.deepEqual(await evaluate(`['paid','free'].map(price=>window.matchesEventPrice({registrationFee:'invalid'},price))`), [false, false], 'Malformed prices are not advertised as free');
  assert.deepEqual(errors, []);
  console.log('PASS public/member event Paid/Free filters at 320/390/1440px: common and eligible zero prices, fallback fees, combined filters, URL/reload, reset, member tabs and mobile bounds.');
  await send('Browser.close');
} finally {
  ws?.close(); chrome?.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  if (path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep + 'activ-event-price-filters-')) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
