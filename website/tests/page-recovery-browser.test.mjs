// Actual bootstrap, providers, role guard and recovery boundaries. Only page
// content is replaced with controlled failures; all HTTP stays on loopback.
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
const output = path.resolve(process.env.TEST_ARTIFACTS || path.join(root, '../artifacts/page-recovery-v25'));
const profile = await mkdtemp(path.join(tmpdir(), 'activ-page-recovery-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const checks = [], layouts = [], externalRequests = [], apiRequests = [], expectedErrors = [];
let bundle, css, chrome, ws, apiCrash = false, lazyFailure = false;
const pendingModules = new Set();
const entryHtml = await readFile(path.join(root, 'index.html'), 'utf8');
const startup = entryHtml.slice(entryHtml.indexOf('    <div id="root">'), entryHtml.indexOf('  </body>'))
  .replace('src="/src/main.tsx"', 'src="/bundle.js"');
assert(startup.includes('activ-startup-recovery') && startup.includes('MutationObserver'));
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/prepare') return res.end('<!doctype html><p>Fixture preparation</p>');
  if (url.pathname === '/bundle.js') {
    if (req.headers.referer?.includes('mode=bootstrap')) { res.statusCode = 503; return res.end('Unavailable fixture module'); }
    res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle);
  }
  if (url.pathname === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
  if (/^\/font-restore-poppins-[0-5]\.ttf$/.test(url.pathname)) {
    res.setHeader('Content-Type', 'font/ttf');
    return res.end(await readFile(path.join(root, '../artifacts', url.pathname.slice(1))));
  }
  if (url.pathname === '/api/fixture') {
    apiRequests.push({ method: req.method, path: url.pathname });
    res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ crash: apiCrash }));
  }
  if (url.pathname === '/fixture-page.js') {
    if (lazyFailure) { res.statusCode = 503; return res.end('Unavailable fixture chunk'); }
    const finish = () => {
      res.setHeader('Content-Type', 'text/javascript');
      res.end('export default function Page(){return window.fixtureReact.createElement("h1",null,"Loaded lazy page")}');
      pendingModules.delete(res);
    };
    if (url.searchParams.get('mode') === 'waiting') { pendingModules.add(res); return; }
    setTimeout(finish, 700); return;
  }
  if (url.pathname === '/logo_ACTIVian-removebg-preview.png') { res.setHeader('Content-Type', 'image/png'); return res.end(await readFile(path.join(root, 'public/logo_ACTIVian-removebg-preview.png'))); }
  if (url.pathname === '/favicon.ico') { res.statusCode = 204; return res.end(); }
  if (url.pathname.startsWith('/api/')) { apiRequests.push({ method: req.method, path: url.pathname }); res.statusCode = 404; return res.end('{}'); }
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'");
  const setup = `<script>
    window.fixtureStorageGet=Storage.prototype.getItem;window.fixtureStorageSet=Storage.prototype.setItem;
    const mode=new URLSearchParams(location.search).get('mode');
    if(mode==='blocked-storage') {
      Storage.prototype.getItem=function(key){if(['cartItems','unreadHelpMessages','userName'].includes(key))throw new DOMException('Fixture blocked storage','SecurityError');return window.fixtureStorageGet.call(this,key)};
      Storage.prototype.setItem=function(key,value){if(key==='cartItems')throw new DOMException('Fixture full storage','QuotaExceededError');return window.fixtureStorageSet.call(this,key,value)};
    }
    window.rootFault=mode==='root-failure';
  </script>`;
  res.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body>${setup}${startup}</body></html>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

try {
  await mkdir(output, { recursive: true });
  let inputCss = await readFile(path.join(root, 'src/index.css'), 'utf8');
  for (const match of [...inputCss.matchAll(/@import ['"](.+?)['"];?/g)]) inputCss = inputCss.replace(match[0], await readFile(path.resolve(root, 'src', match[1]), 'utf8'));
  const config = loadConfig(path.join(root, 'tailwind.config.ts'));
  config.content = [path.join(root, 'src/**/*.{ts,tsx}')];
  css = (await postcss([tailwind(config)]).process(inputCss, { from: path.join(root, 'src/index.css') })).css;
  for (let i = 0; i < 6; i++) css += `\n@font-face{font-family:Poppins;font-weight:${400 + i * 100};src:url('/font-restore-poppins-${i}.ttf') format('truetype');font-display:block}`;
  const fixtureApp = `
    import React,{useEffect,useState,lazy} from 'react';
    import {BrowserRouter,Routes,Route,useNavigate} from 'react-router-dom';
    import {CartProvider,useCart} from './contexts/CartContext';
    import {ProfileProvider,useProfile} from './contexts/ProfileContext';
    import {ActiveCompanyProvider} from './contexts/ActiveCompanyContext';
    import RoleGate from './components/layout/RoleGate';
    import RouteRecovery from './components/RouteRecovery';
    import {SESSION_EVENT} from './services/api';
    window.fixtureReact=React;
    const mode=new URLSearchParams(location.search).get('mode');
    const LazyPage=lazy(()=>import('/fixture-page.js?mode='+mode));
    function Dashboard(){
      const [data,setData]=useState(null);const cart=useCart();const profile=useProfile();
      const [query,setQuery]=useState('');const navigate=useNavigate();
      useEffect(()=>{const controller=new AbortController();fetch('/api/fixture',{signal:controller.signal}).then(r=>r.json()).then(setData).catch(()=>{});return()=>controller.abort()},[]);
      if(data?.crash)throw new Error('PRIVATE_FIXTURE_DIAGNOSTIC');
      return <><h1>{data?'Super Admin fixture dashboard':'Loading fixture data'}</h1><p>Cart: {cart.getCartCount()}</p><p>Unread: {profile.unreadHelpMessages}</p>
        <input aria-label='Search fixture' value={query} onChange={event=>{setQuery(event.target.value);navigate('?q='+encodeURIComponent(event.target.value),{replace:true})}}/>
      </>;
    }
    function Navigation(){const navigate=useNavigate();useEffect(()=>{window.fixtureNavigate=navigate;window.fixtureSessionEvent=SESSION_EVENT},[navigate]);return null}
    export default function App(){
      if(window.rootFault)throw new Error('PRIVATE_ROOT_DIAGNOSTIC');
      return <CartProvider><ProfileProvider><ActiveCompanyProvider><BrowserRouter><Navigation/><RouteRecovery><Routes>
        <Route element={<RoleGate area='admin' roles={['super_admin']}/> }>
          <Route path='/super-admin/dashboard' element={<Dashboard/>}/>
          <Route path='/super-admin/lazy' element={<LazyPage/>}/>
        </Route>
        <Route path='/admin/login' element={<h1>Admin sign in</h1>}/>
        <Route path='/events-admin/dashboard' element={<h1>Events Admin fixture dashboard</h1>}/>
        <Route path='/' element={<h1>Public home</h1>}/>
      </Routes></RouteRecovery></BrowserRouter></ActiveCompanyProvider></ProfileProvider></CartProvider>
    }
  `;
  const fixtures = { name: 'controlled-page-failures', setup(b) {
    b.onResolve({ filter: /^\.\/App\.tsx$/ }, args => args.importer.endsWith('main.tsx') ? { path: 'fixture-app', namespace: 'fixture' } : undefined);
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: fixtureApp, loader: 'tsx', resolveDir: path.join(root, 'src') }));
    b.onLoad({ filter: /\.css$/ }, () => ({ contents: '', loader: 'css' }));
  } };
  const built = await build({ absWorkingDir: root, entryPoints: ['src/main.tsx'], bundle: true, write: false, outdir: 'unused',
    format: 'iife', platform: 'browser', jsx: 'automatic', plugins: [fixtures],
    define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_API_URL: `${origin}/api/v1` }), 'process.env.NODE_ENV': '"production"' } });
  bundle = built.outputFiles.find(file => file.path.endsWith('.js')).text;
  chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let port;
  for (let i = 0; i < 100; i++) { try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch {} await pause(100); }
  assert(port, 'Isolated Chrome starts');
  const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
  ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve));
  let sequence = 0; const pending = new Map();
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') expectedErrors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === 'Network.requestWillBeSent' && !message.params.request.url.startsWith(origin + '/') && !message.params.request.url.startsWith('data:')) externalRequests.push(message.params.request.url);
    pending.get(message.id)?.(message); pending.delete(message.id);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence, timer = setTimeout(() => reject(Error(method)), 25000);
    pending.set(id, response => { clearTimeout(timer); if (response.error) reject(Error(JSON.stringify(response.error))); else resolve(response); });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.result?.exceptionDetails) throw Error(response.result.exceptionDetails.exception?.description);
    return response.result?.result?.value;
  };
  const until = async expression => { for (let i = 0; i < 180; i++) { if (await evaluate(`Boolean(${expression})`)) return; await pause(100); } throw Error(expression); };
  const textHas = text => `document.body.textContent.includes(${JSON.stringify(text)})`;
  const click = label => evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)} && b.getBoundingClientRect().width>0).click()`);
  const visit = async (route, { cart = '[]', guest = false, width = 320 } = {}) => {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: width < 600 });
    await send('Page.navigate', { url: origin + '/prepare' }); await until(textHas('Fixture preparation'));
    await evaluate(`localStorage.clear();localStorage.setItem('cartItems',${JSON.stringify(cart)});localStorage.setItem('unreadHelpMessages','NaN');${guest ? '' : "localStorage.setItem('token','isolated-test-session');localStorage.setItem('adminToken','isolated-test-session');localStorage.setItem('role','super_admin');"}`);
    await send('Page.navigate', { url: origin + route });
  };
  const sessionPreserved = async () => assert.equal(await evaluate("localStorage.getItem('token')"), 'isolated-test-session');
  const recoveryLayout = async name => {
    await evaluate('document.fonts.ready');
    const value = await evaluate(`(() => {const actions=[...document.querySelectorAll('button,a')].filter(el=>el.getBoundingClientRect().width>0).map(el=>{const r=el.getBoundingClientRect();return {label:el.textContent.trim(),left:r.left,right:r.right,height:r.height,clientWidth:el.clientWidth,scrollWidth:el.scrollWidth}});return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,actions,font:getComputedStyle(document.body).fontFamily,bodySize:parseFloat(getComputedStyle(document.body).fontSize)}})()`);
    assert(value.scrollWidth <= value.width + 1, 'Recovery page has no horizontal overflow');
    assert(value.actions.length >= 2);
    for (const action of value.actions) assert(action.left >= -1 && action.right <= value.width + 1 && action.height >= 44 && action.scrollWidth <= action.clientWidth + 1, JSON.stringify(action));
    assert(value.font.includes('Poppins') && value.bodySize === 20, 'Recovery uses readable Poppins scale');
    layouts.push({ name, ...value });
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(path.join(output, `${name}.png`), Buffer.from(shot.result.data, 'base64'));
  };
  await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['https://*'] });
  for (const cart of ['{', 'null', '{}', '[null,{"quantity":"bad"}]']) {
    await visit('/super-admin/dashboard', { cart }); await until(textHas('Super Admin fixture dashboard'));
    assert(await evaluate(textHas('Cart: 0'))); await sessionPreserved();
  }
  checks.push('Malformed/non-array/invalid cached carts recover without clearing the admin session');
  const validCart = { id: 17, name: 'Fixture product', price: 250, originalPrice: 300, quantity: 2, image: '/fixture.png', inStock: true, seller: 'Fixture seller' };
  await visit('/super-admin/dashboard', { cart: JSON.stringify([null, validCart, { quantity: 'bad' }]) });
  await until(textHas('Super Admin fixture dashboard')); assert(await evaluate(textHas('Cart: 2')));
  assert.deepEqual(await evaluate("JSON.parse(localStorage.getItem('cartItems'))"), [validCart]); await sessionPreserved();
  checks.push('Valid existing cart item, quantity and ID survive alongside invalid cached entries');
  await visit('/super-admin/dashboard?mode=blocked-storage'); await until(textHas('Super Admin fixture dashboard'));
  assert(await evaluate(textHas('Unread: 0'))); await sessionPreserved();
  checks.push('Blocked non-auth storage reads and cart writes do not crash providers');
  await visit('/super-admin/dashboard'); await until(textHas('Super Admin fixture dashboard'));
  const readsBeforeSearch = apiRequests.length;
  await evaluate("window.originalSearch=document.querySelector('input');window.originalSearch.focus()");
  await send('Input.insertText', { text: 'Pharma' });
  await until("location.search==='?q=Pharma'");
  assert(await evaluate("document.querySelector('input')===window.originalSearch && document.activeElement===window.originalSearch && window.originalSearch.value==='Pharma'"));
  await send('Input.insertText', { text: ' group' }); await until("location.search==='?q=Pharma%20group'");
  assert.equal(apiRequests.length, readsBeforeSearch, 'Healthy query navigation does not remount/refetch page');
  checks.push('Same-path search changes preserve input identity, focus and local state without a fresh page fetch');
  apiCrash = true;
  await visit('/super-admin/dashboard'); await until(textHas('Something went wrong on this page'));
  assert.equal(await evaluate(textHas('PRIVATE_FIXTURE_DIAGNOSTIC')), false); await sessionPreserved();
  await recoveryLayout('runtime-recovery-320');
  apiCrash = false; await click('Try again'); await until(textHas('Super Admin fixture dashboard')); await sessionPreserved();
  checks.push('Forced API-backed render failure is contained; Try again refetches and recovers without session loss/private diagnostics');
  apiCrash = true; await visit('/super-admin/dashboard'); await until(textHas('Something went wrong on this page'));
  apiCrash = false; await evaluate("window.fixtureNavigate('?q=recovered')"); await until(textHas('Super Admin fixture dashboard'));
  checks.push('Query changes reset an already-failed boundary while preserving healthy-page state');
  await visit('/super-admin/dashboard?mode=root-failure'); await until(textHas('Something went wrong on this page'));
  await evaluate('window.rootFault=false'); await click('Try again'); await until(textHas('Super Admin fixture dashboard'));
  checks.push('Actual main.tsx root boundary catches a failure outside route providers and remounts');
  await visit('/super-admin/lazy'); await until(textHas('Loading your page')); await until(textHas('Loaded lazy page'));
  checks.push('Pending route imports show readable loading and resolve normally');
  lazyFailure = true;
  await visit('/super-admin/lazy?mode=rejected'); await until(textHas('Something went wrong on this page'));
  const sameDocument = await evaluate('performance.timeOrigin');
  await pause(300); assert.equal(await evaluate('performance.timeOrigin'), sameDocument, 'Rejected chunk never auto-reloads');
  lazyFailure = false; await click('Reload page'); await until(textHas('Loaded lazy page')); await sessionPreserved();
  checks.push('Rejected route import shows recovery; explicit Reload fetches a fresh module without automatic reload loops');
  await visit('/super-admin/lazy?mode=waiting'); await until(textHas('This is taking longer than usual'));
  await recoveryLayout('slow-route-320');
  await evaluate("window.fixtureNavigate('/')"); await until(textHas('Public home'));
  checks.push('Unresolved route import reveals manual recovery after 12s; navigation can leave a suspended route');
  const readsBeforeGuest = apiRequests.length;
  await visit('/super-admin/dashboard', { guest: true }); await until(textHas('Admin sign in'));
  assert.equal(apiRequests.length, readsBeforeGuest, 'Guest never renders protected page or requests its API');
  await evaluate("localStorage.setItem('token','isolated-test-session');localStorage.setItem('role','super_admin');window.dispatchEvent(new Event(window.fixtureSessionEvent));window.fixtureNavigate('/super-admin/dashboard')");
  await until(textHas('Super Admin fixture dashboard'));
  await evaluate("localStorage.setItem('role','events_admin');window.dispatchEvent(new Event(window.fixtureSessionEvent))");
  await until(textHas('Events Admin fixture dashboard'));
  assert.equal(await evaluate(textHas('Super Admin fixture dashboard')), false);
  checks.push('Guest guard, in-tab sign-in and same-kind admin-role change correctly reroute and remove protected content');
  apiCrash = true; await visit('/super-admin/dashboard'); await until(textHas('Something went wrong on this page'));
  await evaluate("window.fixtureNavigate('/')"); await until(textHas('Public home')); apiCrash = false;
  checks.push('Route navigation resets a failed page boundary without changing the session');
  await visit('/super-admin/dashboard?mode=bootstrap'); await until("document.getElementById('activ-startup-recovery')?.hidden===false");
  await recoveryLayout('entry-module-unavailable-320'); await sessionPreserved();
  checks.push('Actual index.html exposes manual recovery when the entry module is unavailable');
  await visit('/super-admin/dashboard'); await until(textHas('Super Admin fixture dashboard'));
  await evaluate("window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection',{promise:Promise.resolve(),reason:'unrelated fixture rejection'}))");
  assert.equal(await evaluate("document.getElementById('activ-startup')!==null"), false);
  assert(await evaluate(textHas('Super Admin fixture dashboard')));
  checks.push('Startup watchdog is removed after mounting; unrelated rejection cannot replace healthy UI');
  assert.deepEqual(externalRequests, [], 'No production or third-party requests');
  assert(apiRequests.every(row => row.method === 'GET' && row.path === '/api/fixture'));
  await writeFile(path.join(output, 'verification.json'), JSON.stringify({ checkedAt: new Date().toISOString(), checks, layouts,
    apiRequests, externalRequests, expectedErrors, scope: 'Actual bootstrap/providers/role guard/recovery with controlled page components; screenshot cause remains unproven' }, null, 2));
  console.log(`PASS page recovery: ${checks.length} checks, three 320px Poppins recovery captures, loopback only.`);
  await send('Browser.close');
} finally {
  for (const response of pendingModules) response.destroy();
  ws?.close(); chrome?.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  if (path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep + 'activ-page-recovery-')) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
