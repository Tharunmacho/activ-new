// Real certificate page, API client, and company context against loopback fixtures.
// No live account, payment, or membership records are read or changed.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import loadConfig from 'tailwindcss/loadConfig.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.resolve(root, '../artifacts/company-certificate-web-20261026');
const profile = await mkdtemp(path.join(tmpdir(), 'activ-company-certificate-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const ids = ['111111111111111111111111', '222222222222222222222222', '333333333333333333333333'];
const names = ['Alpha Engineering', 'Beta Manufacturing', 'Private Workshop'];
let mode = 'platinum', delay = 0, bundle = '', css = '', chrome, ws;
const requests = [], errors = [], remoteRequests = [];
const companies = () => ids.map((id, i) => ({ _id: id, businessName: names[i], isActive: i !== 2,
  publication: { published: i !== 2, unlimited: mode === 'platinum', included: i === 0,
    paymentRequired: mode !== 'platinum' && i === 2, certificateAvailable: mode === 'platinum' || i !== 2,
    membershipNumber: mode === 'platinum' || i === 0 ? 'ACTIV-OWNER-001' : i === 1 ? 'ACTIV-COMPANY-002' : '' } }));
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
  if (url.pathname === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
  if (['/logo_ACTIVian-removebg-preview.png', '/chairman-signature.png'].includes(url.pathname)) {
    res.setHeader('Content-Type', 'image/png'); return res.end(await readFile(path.join(root, 'public', url.pathname.slice(1))));
  }
  if (url.pathname.startsWith('/api/')) {
    requests.push(url.pathname + url.search);
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname.endsWith('/business-profiles/all')) return res.end(JSON.stringify({ success: true, data: companies() }));
    if (url.pathname.includes('/certificate/')) {
      const kind = url.pathname.split('/').at(-1), id = url.searchParams.get('companyId');
      const company = companies().find(c => c._id === id);
      if (kind === 'membership' && !company?.publication.certificateAvailable) {
        res.statusCode = 403;
        return res.end(JSON.stringify({ success: false, message: 'Pay this company plan before requesting its certificate.' }));
      }
      const response = { success: true, data: { kind, companyId: id, companyMembership: !!id,
        member: { name: 'Fixture Member', companyName: company?.businessName || '', membershipNumber: company?.publication.membershipNumber || 'ACTIV-OWNER-001', email: 'fixture@example.test' },
        membershipType: mode === 'platinum' ? 'lifetime' : 'annual', membershipTier: mode === 'platinum' ? 'platinum' : 'standard',
        reference: 'TEST-REFERENCE', memberSince: '2026-10-26', activatedAt: '2026-10-26', issuedAt: '2026-10-26',
        validUntil: mode === 'platinum' ? null : '2027-10-25', contribution: null } };
      if (id === ids[1] && delay) await pause(delay);
      return res.end(JSON.stringify(response));
    }
    return res.end(JSON.stringify({ success: true, data: {} }));
  }
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'");
  res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
try {
  await mkdir(output, { recursive: true });
  let source = await readFile(path.join(root, 'src/index.css'), 'utf8');
  for (const match of [...source.matchAll(/@import ['"](.+?)['"];?/g)]) source = source.replace(match[0], await readFile(path.resolve(root, 'src', match[1]), 'utf8'));
  const config = loadConfig(path.join(root, 'tailwind.config.ts')); config.content = [path.join(root, 'src/**/*.{ts,tsx}')];
  css = (await postcss([tailwind(config)]).process(source, { from: path.join(root, 'src/index.css') })).css;
  css += '\n' + await readFile(path.join(root, 'src/styles/app-dark.css'), 'utf8');
  const built = await build({ absWorkingDir: root, bundle: true, write: false, outfile: 'fixture.js', format: 'iife', platform: 'browser', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"test"', 'import.meta.env': JSON.stringify({ DEV: true, VITE_API_URL: `${base}/api/v1` }) },
    stdin: { resolveDir: root, loader: 'tsx', contents: `
      import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter,Routes,Route} from 'react-router-dom';
      import Page from './src/features/member/pages/CertificatePage';import {ActiveCompanyProvider} from './src/contexts/ActiveCompanyContext';
      import MyCompanies from './src/pages/business/MyCompanies';import Settings from './src/pages/business/Settings';
      import MemberShell from './src/pages/member/MemberPageShell';import PlatinumWelcome from './src/features/member/components/PlatinumWelcome';
      import {useAppThemeScope} from './src/lib/appTheme';
      function Lifetime(){useAppThemeScope();return <MemberShell title="Lifetime Membership" appearance="gold" sidebar={false}><div className="platinum-dashboard"><PlatinumWelcome name="Fixture Member" greeting="Hello" memberId="ACTIV-OWNER-001" memberSince="26 Oct 2026" region="Chennai" active onPlan={()=>{}} onBusiness={()=>{}} onDocuments={()=>{}} onReceipt={()=>{}}/></div></MemberShell>}
      localStorage.setItem('token','local-test-token');
      createRoot(document.getElementById('root')).render(<BrowserRouter><ActiveCompanyProvider><Routes><Route path="/member/certificate/:kind" element={<Page/>}/><Route path="/business/companies" element={<MyCompanies/>}/><Route path="/business/settings" element={<Settings/>}/><Route path="/lifetime" element={<Lifetime/>}/></Routes></ActiveCompanyProvider></BrowserRouter>);
    ` } });
  bundle = built.outputFiles.find(file => file.path.endsWith('.js')).text;
  css += '\n' + (built.outputFiles.find(file => file.path.endsWith('.css'))?.text || '');
  chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let port;
  for (let i = 0; i < 100; i++) { try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch {} await pause(100); }
  assert(port, 'Chrome starts');
  const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
  ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve));
  let seq = 0; const pending = new Map();
  ws.addEventListener('message', event => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    if (msg.method === 'Network.requestWillBeSent' && !msg.params.request.url.startsWith(base) && !msg.params.request.url.startsWith('data:')) remoteRequests.push(msg.params.request.url);
    pending.get(msg.id)?.(msg); pending.delete(msg.id);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq, timer = setTimeout(() => reject(Error(method + ' timed out')), 20000);
    pending.set(id, msg => { clearTimeout(timer); msg.error ? reject(Error(JSON.stringify(msg.error))) : resolve(msg); });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw Error(r.result.exceptionDetails.exception?.description); return r.result?.result?.value; };
  const until = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(`Boolean(${expression})`)) return; await pause(50); } throw Error(expression + errors.join('\n')); };
  const paper = 'document.querySelector(".certificate-preview__scale")';
  const printDisabled = '[...document.querySelectorAll("button")].find(b=>b.textContent.includes("Print or save")).disabled';
  const choose = id => evaluate(`{const select=document.querySelector('#certificate-company');select.value=${JSON.stringify(id)};select.dispatchEvent(new Event('change',{bubbles:true}));}`);
  await send('Runtime.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: base + '/member/certificate/membership' });
  await until(`${paper}?.textContent.includes('Alpha Engineering')`);
  assert(requests.some(url => url.endsWith('companyId=' + ids[0])));
  assert.equal(await evaluate(printDisabled), false);
  delay = 500;
  await choose(ids[1]);
  await until(printDisabled);
  assert.equal(await evaluate(`Boolean(${paper})`), false, 'Old company paper removed while new company loads');
  await until(`${paper}?.textContent.includes('Beta Manufacturing')`);
  assert(await evaluate(`${paper}.textContent.includes('ACTIV-OWNER-001')`), '₹2 lakh companies retain shared membership ID');
  assert.equal(await evaluate(`localStorage.getItem('activ:activeCompanyId')`), ids[1]);
  assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Certificate selector and paper fit mobile');
  await writeFile(path.join(output, 'company-certificate-mobile.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));
  await send('Page.reload');
  await until(`${paper}?.textContent.includes('Beta Manufacturing')`);
  await choose(ids[0]);
  await until(`${paper}?.textContent.includes('Alpha Engineering')`);
  // Reload empties the API cache, then race a slow Beta request against Alpha.
  await send('Page.reload');
  await until(`${paper}?.textContent.includes('Alpha Engineering')`);
  await choose(ids[1]); await until(printDisabled); await choose(ids[0]);
  await until(`${paper}?.textContent.includes('Alpha Engineering')`);
  await pause(700);
  assert(!(await evaluate(`${paper}.textContent`)).includes('Beta Manufacturing'), 'Late response cannot replace current company certificate');
  mode = 'standard'; delay = 0;
  await send('Page.reload');
  await until(`${paper}?.textContent.includes('Alpha Engineering')`);
  await choose(ids[1]);
  await until(`${paper}?.textContent.includes('ACTIV-COMPANY-002')`);
  await choose(ids[2]);
  await until('document.querySelector("[role=alert]")');
  assert(await evaluate('document.body.textContent.includes("Pay this company plan")'));
  assert.equal(await evaluate(`Boolean(${paper})`), false, 'Unpaid private company never displays previous paid certificate');
  assert.equal(await evaluate(printDisabled), true);
  assert(await evaluate('Boolean(document.querySelector("#certificate-company"))'), 'Company selection stays available after denial');
  await choose(ids[0]);
  await until(`${paper}?.textContent.includes('Alpha Engineering')`);
  const beforeTax = requests.length;
  await send('Page.navigate', { url: base + '/member/certificate/tax-exemption' });
  await until(`${paper}`);
  assert.equal(await evaluate('Boolean(document.querySelector("#certificate-company"))'), false);
  assert.deepEqual(requests.slice(beforeTax), ['/api/v1/members/certificate/tax-exemption'], 'Tax certificate stays member-scoped');
  await send('Page.navigate', { url: base + '/business/companies' });
  await until('document.body.textContent.includes("Private Workshop")&&document.body.textContent.includes("View promotion plan")');
  const privateCard = `[...document.querySelectorAll('h3')].find(e=>e.textContent==='Private Workshop').closest('section')`;
  assert(await evaluate(`${privateCard}.textContent.includes('Private — only you')`));
  assert(!(await evaluate(`${privateCard}.textContent`)).includes('ACTIV-COMPANY-002'), 'Private draft has no paid company identity');
  assert.equal(await evaluate(`[...${privateCard}.querySelectorAll('button')].some(b=>b.textContent.includes('Membership certificate'))`), false);
  await evaluate(`[...${privateCard}.querySelectorAll('button')].find(b=>b.textContent.includes('View promotion plan')).click()`);
  await until(`location.pathname==='/business/settings'&&document.querySelector('[aria-label="List this company in ACTIV Network"]')`);
  assert.equal(await evaluate('localStorage.getItem("activ:activeCompanyId")'), ids[2], 'Promotion action selects the company being paid for');
  assert.equal(await evaluate(`document.querySelector('[aria-label="List this company in ACTIV Network"]').getAttribute('aria-checked')`), 'false');
  assert(await evaluate('document.body.textContent.includes("Only you can see this company")'));
  await send('Page.navigate', { url: base + '/lifetime' });
  await until('document.querySelector(".platinum-welcome")');
  await evaluate(`document.querySelector('[aria-label="Dark mode"]').click()`);
  await until('document.documentElement.dataset.appTheme==="dark"');
  await pause(250);
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".member-shell--gold main")).backgroundColor'), 'rgb(10, 10, 10)');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".platinum-workspace")).backgroundColor'), 'rgb(21, 21, 21)');
  const contrast = await evaluate(`(()=>{const fg=getComputedStyle(document.querySelector('.platinum-action__detail')).color.match(/[\\d.]+/g).map(Number);const bg=getComputedStyle(document.querySelector('.platinum-action')).backgroundColor.match(/[\\d.]+/g).map(Number);const l=rgb=>rgb.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);return (l(fg)+.05)/(l(bg)+.05)})()`);
  assert(contrast >= 4.5, 'Lifetime dashboard body copy has readable contrast');
  assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Lifetime dark dashboard fits mobile');
  await writeFile(path.join(output, 'lifetime-dashboard-dark.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));
  await send('Page.reload');
  await until('document.querySelector(".platinum-welcome")&&document.documentElement.dataset.appTheme==="dark"');
  await evaluate(`document.querySelector('[aria-label="Dark mode"]').click()`);
  await until('!document.documentElement.hasAttribute("data-app-theme")');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".member-shell--gold main")).backgroundColor'), 'rgb(247, 245, 239)');
  assert.deepEqual(errors, []); assert.deepEqual(remoteRequests, []);
  await writeFile(path.join(output, 'verification.json'), JSON.stringify({ passed: true, lifetimeDarkTextContrast: contrast, cases: ['selected company request', 'shared platinum ID', 'separate paid company ID', 'private company denied', 'stale response protection', 'selection persistence', 'mobile layout', 'tax unchanged', 'private company visibility', 'promotion action selects correct company', 'lifetime light/dark preference'], requests, errors }, null, 2));
  console.log('PASS company certificate: selected company, shared/individual IDs, private denial, print guard, stale-response guard, persistence, mobile layout, tax unchanged, private visibility, correct promotion target, lifetime light/dark preference.');
  await send('Browser.close');
} finally {
  ws?.close(); chrome?.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  if (path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep + 'activ-company-certificate-')) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
