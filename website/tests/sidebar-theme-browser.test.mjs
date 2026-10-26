import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.resolve(process.env.TEST_ARTIFACTS || '../artifacts/sidebar-theme-20261026');
const profile = await mkdtemp(path.join(tmpdir(), 'activ-sidebar-theme-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const contrastOn = (foreground, background, surface) => {
  const rgba = value => value.match(/[\d.]+/g).map(Number);
  const fg = rgba(foreground), bg = rgba(background), base = rgba(surface);
  const alpha = bg[3] ?? 1;
  const luminance = rgb => rgb.slice(0, 3).map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const values = [luminance(fg), luminance(bg.map((v, i) => v * alpha + base[i] * (1 - alpha)))].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
};
let bundle = '', css = '', chrome, ws;
const errors = [], reports = [];
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
  if (pathname === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
  if (pathname === '/logo_ACTIVian-removebg-preview.png') {
    res.setHeader('Content-Type', 'image/png'); return res.end(await readFile(path.join(root, 'public', pathname)));
  }
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'");
  res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
try {
  await mkdir(output, { recursive: true });
  let sourceCss = await readFile(path.join(root, 'src/index.css'), 'utf8');
  for (const file of ['mobile-styles.css', 'background.css']) sourceCss = sourceCss.replace(`@import './components/ui/${file}';`, await readFile(path.join(root, 'src/components/ui', file), 'utf8'));
  css = (await postcss([tailwindcss({ config: path.join(root, 'tailwind.config.ts') })]).process(sourceCss, { from: path.join(root, 'src/index.css') })).css;
  css += '\n' + await readFile(path.join(root, 'src/styles/app-dark.css'), 'utf8');
  const mocks = {
    '@/services/activApi': 'export const apiFetch=async()=>({ok:true,json:async()=>({data:{fullName:"Sample Admin"}})});export const getPaymentStatus=async()=>"completed";export const logout=async()=>{};',
    '@/config/api.config': 'export const resolveMediaUrl=()=>"";',
    '@/contexts/ActiveCompanyContext': 'const loadCompanies=async()=>[];export const useActiveCompanyStore=()=>({activeCompany:{businessName:"Sample Engineering",mobileNumber:"9000000000"},loadCompanies});',
    '@/lib/session': 'export const storedRole=()=>"super_admin";',
  };
  const fixture = { name: 'local-sidebar-fixture', setup(b) {
    b.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, namespace: 'fixture' } : undefined);
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'tsx', contents: mocks[args.path] }));
  } };
  bundle = (await build({ absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', plugins: [fixture],
    define: { 'import.meta.env': '{"DEV":true}', 'process.env.NODE_ENV': '"test"' },
    stdin: { resolveDir: root, loader: 'tsx', contents: `
      import React from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';
      import BusinessShell from './src/pages/business/BusinessPageShell';
      import AdminSidebar from './src/features/admin/components/AdminSidebar';
      import ThemeToggle from './src/components/shared/ThemeToggle';
      import ForceLightTheme from './src/components/shared/ForceLightTheme';
      import{useAppThemeScope}from'./src/lib/appTheme';
      const params=new URLSearchParams(location.search),tier=params.get('tier')||'super';
      function SignedIn(){useAppThemeScope();const[open,setOpen]=React.useState(false);const[paper,setPaper]=React.useState(false);window.paper=setPaper;
        const card=<section data-fixture-card className="bg-white text-slate-900 border border-slate-200 p-6"><h2>Workspace content</h2><p className="text-slate-600">Theme follows your choice.</p></section>;
        return <>{paper&&<ForceLightTheme/>}{params.has('admin')?<div className="min-h-screen flex bg-slate-100"><AdminSidebar tier={tier} isOpen={open} onClose={()=>setOpen(false)}/><main className="min-w-0 flex-1 p-4"><button aria-label="Open menu" onClick={()=>setOpen(true)}>Menu</button><ThemeToggle/>{card}</main></div>:<BusinessShell title="Business">{card}</BusinessShell>}</>;}
      function Fixture(){const[publicPage,setPublicPage]=React.useState(false);window.showPublic=setPublicPage;return publicPage?<main data-public className="bg-white text-slate-900">Public page</main>:<SignedIn/>;}
      createRoot(document.getElementById('root')).render(<BrowserRouter><Fixture/></BrowserRouter>);
    ` } })).outputFiles[0].text;
  chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    ['--headless=new', '--disable-gpu', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let port;
  for (let i = 0; i < 100; i++) { try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch {} await pause(100); }
  assert(port, 'Chrome starts');
  const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve));
  let sequence = 0; const pending = new Map();
  ws.addEventListener('message', event => { const m = JSON.parse(event.data); if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); pending.get(m.id)?.(m); pending.delete(m.id); });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence, timer = setTimeout(() => reject(Error(method)), 20000); pending.set(id, r => { clearTimeout(timer); r.error ? reject(Error(JSON.stringify(r.error))) : resolve(r); }); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw Error(r.result.exceptionDetails.exception?.description); return r.result?.result?.value; };
  const until = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(`Boolean(${expression})`)) return; await pause(50); } throw Error(expression + errors.join('\n')); };
  const click = async selector => evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.getBoundingClientRect().width>0);if(!e)throw Error('Visible control missing');e.click();})()`);
  const snapshot = () => evaluate(`(()=>{const visible=e=>e.getBoundingClientRect().width>0;const rail=[...document.querySelectorAll('aside[aria-label="Business navigation"],.app-sidebar-rail')].find(visible);const active=[...rail.querySelectorAll('[aria-current="page"]')].find(visible);return{theme:document.documentElement.dataset.appTheme||'light',rail:getComputedStyle(rail).backgroundColor,gradient:getComputedStyle(rail).backgroundImage,active:active&&{background:getComputedStyle(active).backgroundColor,color:getComputedStyle(active).color},card:getComputedStyle(document.querySelector('[data-fixture-card]')).backgroundColor,pressed:[...rail.querySelectorAll('button[aria-pressed]')].filter(visible).map(e=>({label:e.textContent||e.getAttribute('aria-label'),pressed:e.getAttribute('aria-pressed')})),viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth};})()`);
  await send('Runtime.enable');
  for (const scenario of [{ area: 'business', width: 1440 }, { area: 'business', width: 390 },
    ...['super', 'state', 'district', 'block', 'events'].map(tier => ({ area: 'admin', tier, width: 1440 })),
    { area: 'admin', tier: 'super', width: 1440, pathname: '/super-admin/events/categories' },
    { area: 'admin', tier: 'super', width: 390 }]) {
    const admin = scenario.area === 'admin';
    const route = admin ? `${scenario.pathname || `/${scenario.tier}-admin/dashboard`}?admin=1&tier=${scenario.tier}` : '/business/dashboard';
    await send('Emulation.setDeviceMetricsOverride', { width: scenario.width, height: 1000, deviceScaleFactor: 1, mobile: scenario.width < 600 });
    await send('Page.navigate', { url: base + route });
    await until('document.querySelector("[data-fixture-card]")');
    if (scenario.width < 600) await click('[aria-label="Open menu"]');
    await click('[role="group"][aria-label="Colour theme"] button:first-child');
    await until('!document.documentElement.hasAttribute("data-app-theme")');
    await pause(250); // Allow the real controls' colour transitions to settle.
    const light = await snapshot();
    assert.equal(light.card, 'rgb(255, 255, 255)');
    if (admin) assert(light.gradient.includes('linear-gradient'), 'Light admin rail retains its branded gradient');
    else assert.equal(light.rail, 'rgb(255, 255, 255)');
    await click('[role="group"][aria-label="Colour theme"] button:last-child');
    await until('document.documentElement.dataset.appTheme==="dark"');
    await pause(250);
    const dark = await snapshot();
    assert.equal(dark.rail, 'rgb(18, 18, 18)', 'Entire navigation surface follows dark mode');
    assert.equal(dark.card, 'rgb(18, 18, 18)', 'Page content and navigation share dark surfaces');
    assert.equal(dark.gradient, 'none', 'No blue gradient remains in the dark sidebar');
    assert(dark.active, 'Current navigation destination remains identified');
    assert.notEqual(dark.active.background, 'rgb(255, 255, 255)', 'Active navigation does not remain a white patch');
    assert(contrastOn(dark.active.color, dark.active.background, dark.rail) >= 4.5, 'Active navigation text retains readable contrast');
    assert(dark.pressed.some(x => x.label.trim() === 'Dark' && x.pressed === 'true'));
    assert(dark.scrollWidth <= scenario.width, 'Sidebar fits the viewport');
    await writeFile(path.join(output, `${scenario.area}-${scenario.tier || 'member'}-${scenario.width}-dark.png`), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));
    reports.push({ ...scenario, light, dark });
    await send('Page.reload');
    await until('document.querySelector("[data-fixture-card]")&&document.documentElement.dataset.appTheme==="dark"');
    assert.equal(await evaluate('localStorage.getItem("cms_theme_v2")'), 'dark', 'Choice survives reload');
    if (!admin && scenario.width === 1440) {
      await click('[aria-label="Collapse the sidebar"]');
      await until(`document.querySelector('[aria-label="Expand the sidebar"]')`);
      const controls = await snapshot();
      assert(controls.pressed.some(x => x.label === 'Dark mode' && x.pressed === 'true'), 'Collapsed rail retains working theme control');
      await click('[aria-label="Expand the sidebar"]');
    }
  }
  await evaluate('window.dispatchEvent(new Event("beforeprint"))');
  await until('!document.documentElement.hasAttribute("data-app-theme")');
  await evaluate('window.dispatchEvent(new Event("afterprint"))');
  await until('document.documentElement.dataset.appTheme==="dark"');
  await evaluate('window.paper(true)');
  await until('!document.documentElement.hasAttribute("data-app-theme")');
  assert.equal(await evaluate('document.querySelectorAll("button[aria-pressed]").length'), 0, 'Document-only screens hide the inactive theme controls');
  await evaluate('window.paper(false)');
  await until('document.documentElement.dataset.appTheme==="dark"');
  await evaluate('window.showPublic(true)');
  await until('document.querySelector("[data-public]")&&!document.documentElement.hasAttribute("data-app-theme")');
  assert.equal(await evaluate('localStorage.getItem("cms_theme_v2")'), 'dark', 'Leaving signed-in screens preserves preference without darkening public pages');
  await evaluate('window.showPublic(false)');
  await until('document.documentElement.dataset.appTheme==="dark"');
  await evaluate('localStorage.setItem("cms_theme_v2","light");window.dispatchEvent(new StorageEvent("storage",{key:"cms_theme_v2",newValue:"light"}))');
  await until('!document.documentElement.hasAttribute("data-app-theme")');
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'verification.json'), JSON.stringify({ reports, persistence: true, printAndDocumentScopes: true, publicScopeCleanup: true, storageSync: true, errors, requests: 'Loopback fixture with mocked data only' }, null, 2));
  console.log('PASS sidebar theme: business desktop/mobile/collapsed, all five admin tiers, nested active link, mobile admin drawer, persistence, print/document/public scopes and storage sync.');
  await send('Browser.close');
} finally {
  ws?.close(); chrome?.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  if (path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep + 'activ-sidebar-theme-')) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
