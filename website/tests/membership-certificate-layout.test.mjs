// Actual membership certificate and responsive preview, isolated to localhost.
// Uses current CSS and optional local fonts; never fetches accounts or remote APIs.
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
const output = path.resolve(process.env.TEST_ARTIFACTS || path.join(artifacts, 'membership-certificate-layout'));
const nativePreview = process.env.TEST_NATIVE_PREVIEW ? path.resolve(process.env.TEST_NATIVE_PREVIEW) : null;
const profile = await mkdtemp(path.join(tmpdir(), 'activ-certificate-layout-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const base = { kind: 'membership', member: { name: 'Example Member', companyName: 'Example Industries Private Limited',
  membershipNumber: 'ACTIV-BEG-20261015-001', block: 'Example Block', district: 'Chennai', state: 'Tamil Nadu',
  businessSector: 'Manufacturing', udyamNumber: 'UDYAM-TN-02-1234567', gstNumber: '33ABCDE1234F1Z9' },
  membershipType: 'annual', memberSince: '2026-10-15', activatedAt: '2026-10-15', validUntil: '2027-10-14',
  reference: 'ACTIV-MEM-BEG-20261015-001-20261015', issuedAt: '2026-10-15' };
const fixtures = {
  annual: base,
  lifetime: { ...base, membershipTier: 'platinum', membershipType: 'lifetime', validUntil: null,
    member: { ...base.member, companyName: 'Example Online Pvt Ltd', udyamNumber: '', gstNumber: '' } },
  personal: { ...base, member: { name: 'Personal Member', membershipNumber: 'ACTIV-STU-20261015-001', block: 'Example Block', district: 'Chennai', state: 'Tamil Nadu' } },
  long: { ...base, membershipTier: 'platinum', membershipType: 'lifetime', validUntil: null,
    reference: 'ACTIV-MEM-LIF-20261015-001-20261015-EXTENDED-REFERENCE-FOR-LAYOUT-VERIFICATION',
    member: { ...base.member, name: 'A Registered Member With A Long Representative Name For Layout Verification',
      companyName: 'South India Manufacturing and International Industrial Trading Private Limited',
      businessSector: 'Manufacturing, industrial services and international technology consulting',
      isInternational: true, place: 'A long international city and district address for the certificate', country: 'United Kingdom' } },
};
let bundle = '', css = '', chrome, ws, localPoppins = false;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
  if (url.pathname === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
  if (url.pathname === '/native-preview' && nativePreview) { res.setHeader('Content-Type', 'text/html'); return res.end(await readFile(nativePreview, 'utf8')); }
  if (/^\/font-restore-poppins-[0-5]\.ttf$/.test(url.pathname)) { res.setHeader('Content-Type', 'font/ttf'); return res.end(await readFile(path.join(fontsDirectory, url.pathname.slice(1)))); }
  if (['/logo_ACTIVian-removebg-preview.png', '/chairman-signature.png'].includes(url.pathname)) {
    res.setHeader('Content-Type', 'image/png'); return res.end(await readFile(path.join(root, 'public', url.pathname.slice(1))));
  }
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'");
  res.setHeader('Content-Type', 'text/html');
  res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  await mkdir(output, { recursive: true });
  let inputCss = await readFile(path.join(root, 'src/index.css'), 'utf8');
  for (const match of [...inputCss.matchAll(/@import ['"](.+?)['"];?/g)]) inputCss = inputCss.replace(match[0], await readFile(path.resolve(root, 'src', match[1]), 'utf8'));
  const config = loadConfig(path.join(root, 'tailwind.config.ts')); config.content = [path.join(root, 'src/**/*.{ts,tsx}')];
  css = (await postcss([tailwind(config)]).process(inputCss, { from: path.join(root, 'src/index.css') })).css;
  localPoppins = await Promise.all(Array.from({ length: 6 }, (_, i) => readFile(path.join(fontsDirectory, `font-restore-poppins-${i}.ttf`)))).then(() => true, () => false);
  if (process.env.TEST_FONTS_DIR) assert(localPoppins, 'Explicit font fixture directory must contain all six local Poppins files');
  if (localPoppins) for (let i = 0; i < 6; i++) css += `\n@font-face{font-family:Poppins;font-style:normal;font-weight:${400 + i * 100};src:url('/font-restore-poppins-${i}.ttf') format('truetype');font-display:block}`;
  bundle = (await build({ absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"test"' }, stdin: { resolveDir: root, loader: 'tsx', contents: `
      import React from 'react';import {createRoot} from 'react-dom/client';
      import Certificate from './src/features/member/certificates/MembershipCertificate';import Preview from './src/features/member/certificates/CertificatePreview';
      const root=createRoot(document.getElementById('root'));
      window.renderFixture=cert=>root.render(<main className="p-4 print:p-0"><Preview widthMm={297}><Certificate cert={cert}/></Preview></main>);
      window.renderFixture(${JSON.stringify(base)});
    ` } })).outputFiles[0].text;
  chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let port;
  for (let i = 0; i < 100; i++) { try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch {} await pause(100); }
  assert(port, 'Chrome starts');
  const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
  ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve));
  let seq = 0; const pending = new Map(), errors = [], remoteRequests = [];
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === 'Network.requestWillBeSent' && !message.params.request.url.startsWith(`http://127.0.0.1:${server.address().port}/`) && !message.params.request.url.startsWith('data:')) remoteRequests.push(message.params.request.url);
    pending.get(message.id)?.(message); pending.delete(message.id);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq, timer = setTimeout(() => reject(Error(method)), 25000); pending.set(id, response => { clearTimeout(timer); response.error ? reject(Error(JSON.stringify(response.error))) : resolve(response); }); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (response.result?.exceptionDetails) throw Error(response.result.exceptionDetails.exception?.description); return response.result?.result?.value; };
  const until = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(`Boolean(${expression})`)) return; await pause(100); } throw Error(expression + errors.join('\n')); };
  const metrics = () => evaluate(`(() => {
    const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
    const select=id=>document.querySelector('[data-testid="'+id+'"]');
    const sheet=document.querySelector('.activ-sheet'),sign=select('membership-signature-block'),seal=select('membership-seal-block'),issue=select('membership-issue-block'),ref=select('membership-reference');
    const facts=[...document.querySelectorAll('[data-certificate-fact]')].map(e=>({label:e.dataset.certificateFact,rect:rect(e),value:rect(e.lastElementChild),clipped:e.lastElementChild.scrollWidth>e.lastElementChild.clientWidth+1}));
    const pairs=[...document.querySelectorAll('[data-testid="membership-fact-row"]')].map(e=>{const cells=[...e.querySelectorAll('[data-certificate-fact]')];return {row:rect(e),cells:cells.map(rect)}});
    return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,paper:rect(sheet),flow:rect(select('membership-content-block')),signature:rect(sign),seal:rect(seal),issue:rect(issue),reference:rect(ref),referenceText:rect(ref.querySelector('p')),facts,pairs,text:sheet.innerText,poppinsLoaded:document.fonts.check('600 15px Poppins')};
  })()`);
  await send('Runtime.enable'); await send('Network.enable'); await send('Network.setBlockedURLs', { urls: ['https://*'] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
  await until('document.querySelector(".activ-sheet") && [...document.images].every(i=>i.complete&&i.naturalWidth>0)');
  await evaluate('document.fonts.ready');
  const reports = [];
  for (const [name, fixture] of Object.entries(fixtures)) {
    await evaluate(`window.renderFixture(${JSON.stringify(fixture)})`); await pause(200);
    for (const width of [1200, 390, 320]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 }); await pause(150);
      const m = await metrics(); reports.push({ fixture: name, ...m });
      assert(m.poppinsLoaded, 'Local Poppins rendered');
      assert(m.scrollWidth <= width + 1 && m.paper.x >= -1 && m.paper.right <= width + 1, `${name}/${width}: full paper fits viewport`);
      assert(Math.abs(m.paper.width / m.paper.height - 297 / 210) < 0.005, `${name}/${width}: A4 landscape retained`);
      assert(m.flow.bottom <= m.signature.y + 1, `${name}/${width}: content clears signature row`);
      assert(m.signature.right <= m.seal.x + 1 && m.seal.right <= m.issue.x + 1, `${name}/${width}: signatories do not overlap`);
      assert(Math.abs(m.seal.x + m.seal.width / 2 - m.paper.x - m.paper.width / 2) < 1, 'Seal centered');
      assert(m.signature.bottom <= m.reference.y + 1 && m.issue.bottom <= m.reference.y + 1, 'Signature/date clear footer');
      assert(m.referenceText.x >= m.reference.x - 1 && m.referenceText.right <= m.reference.right + 1 && m.referenceText.bottom <= m.reference.bottom + 1, `${name}/${width}: full reference fits`);
      for (const pair of m.pairs) if (pair.cells.length === 2) assert(Math.abs(pair.cells[0].y - pair.cells[1].y) < 1 && Math.abs(pair.cells[0].height - pair.cells[1].height) < 1, 'Paired facts share row height');
      for (const fact of m.facts) assert(!fact.clipped && fact.value.right <= m.paper.right + 1 && fact.value.bottom <= m.signature.y + 1, `${name}/${width}: ${fact.label} retained within paper`);
      for (const value of Object.values(fixture.member).filter(v => typeof v === 'string' && v)) {
        if (fixture.member.isInternational && [fixture.member.block, fixture.member.district, fixture.member.state].includes(value)) continue;
        assert(m.text.includes(value), `${name}: all supplied certificate facts remain visible: ${value}`);
      }
      assert(m.text.includes(fixture.reference), 'Reference complete');
      if (name === 'personal') assert(!m.text.includes('Company Name'), 'No invented company');
      if (['lifetime', 'long'].includes(name)) assert(m.text.includes('Lifetime Member'), 'Lifetime wording retained');
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: m.paper.x, y: m.paper.y, width: m.paper.width, height: m.paper.height, scale: 1 } });
      await writeFile(path.join(output, `${name}-${width}.png`), Buffer.from(shot.result.data, 'base64'));
      if (width === 320) {
        const result = await send('Page.printToPDF', { preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
        const bytes = Buffer.from(result.result.data, 'base64');
        assert.equal((bytes.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length, 1, `${name}: mobile prints one full A4 page`);
        await writeFile(path.join(output, `${name}.pdf`), bytes);
      }
    }
  }
  const nativeReports = [];
  if (nativePreview) {
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/native-preview` });
    await until('typeof window.renderNativeCertificate === "function"'); await evaluate('document.fonts.ready');
    for (const kind of ['normal', 'long']) for (const [viewportWidth, paperWidth] of [[1200, 1123], [390, 366], [320, 296]]) {
      await send('Emulation.setDeviceMetricsOverride', { width: viewportWidth, height: 1000, deviceScaleFactor: 1, mobile: viewportWidth < 600 });
      const render = await evaluate(`window.renderNativeCertificate(${JSON.stringify(kind)},${paperWidth})`); await pause(100);
      const m = await evaluate(`(() => {
        const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
        const stage=document.getElementById('stage');return {stage:rect(stage),flow:rect(stage.querySelector('[data-testid="membership-content-block"]')),signatories:rect(stage.querySelector('[data-testid="membership-signatories"]')),width:innerWidth,scrollWidth:document.documentElement.scrollWidth};
      })()`);
      nativeReports.push({ kind, paperWidth, approximation: true, ...render, ...m });
      assert(m.flow.bottom <= m.signatories.y + 1, `Native approximation ${kind}/${paperWidth}: facts clear signatories`);
      assert(m.stage.right <= viewportWidth + 1, 'Native approximation fits viewport');
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: m.stage.x, y: m.stage.y, width: m.stage.width, height: m.stage.height, scale: 1 } });
      await writeFile(path.join(output, `native-approx-${kind}-${paperWidth}.png`), Buffer.from(shot.result.data, 'base64'));
    }
  }
  assert.deepEqual(errors, []); assert.deepEqual(remoteRequests, []);
  await writeFile(path.join(output, 'verification.json'), JSON.stringify({ checkedAt: new Date().toISOString(), reports, nativeReports, errors, remoteRequests, font: localPoppins ? 'Local Poppins 400–900; certificate display font uses Poppins fallback if Playfair Display is not installed' : 'System fallback fonts (local Poppins unavailable; Poppins layout not verified)', nativeLimitations: 'Native preview is a browser flexbox/font approximation of actual JSX, not an Android screenshot or native bounds test.' }, null, 2));
  console.log(`PASS real membership certificate: paired rows, full fact retention, balanced signatories, footer fit, annual/lifetime/personal/long data, full A4 +390/320 previews and one-page PDFs with ${localPoppins ? 'local Poppins' : 'system fallback fonts (Poppins not verified)'}.`);
  await send('Browser.close');
} finally {
  ws?.close(); chrome?.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  if (path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep + 'activ-certificate-layout-')) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
