import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'activ-personal-contact-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let chrome, ws, bundle = '', css = '';
const fixture = { fullName: 'New Member', email: 'new@example.test', phoneNumber: '', religion: 'Hindu', socialCategory: 'SC', gender: 'Female',
  hasPassword: false, passwordStatus: 'not_set', linkedProviders: ['google'] };
const server = http.createServer((req, res) => {
  if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
  if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
  res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body style="margin:0"><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  const assets = await readdir(path.join(root, 'dist/assets'));
  css = await readFile(path.join(root, 'dist/assets', assets.find(file => /^index-.*\.css$/.test(file))), 'utf8');
  bundle = (await build({ absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"test"', 'import.meta.env': '{}' },
    plugins: [{ name: 'local-fixtures', setup(b) {
      b.onResolve({ filter: /^@\/services\/activApi$/ }, () => ({ path: 'api', namespace: 'fixtures' }));
      b.onLoad({ filter: /.*/, namespace: 'fixtures' }, () => ({ contents: `
        export async function getMyProfile(){ if(window.fixtureFail)throw Error('Could not load saved details'); return window.fixture; }
        export async function updateProfile(value){window.saves.push(value);return {};}
        export async function setFirstPassword(newPassword,confirmPassword){window.passwordSaves.push({newPassword,confirmPassword});return {hasPassword:true,passwordStatus:'set'};}
        export async function getStates(){return {states:[]};} export async function getDistricts(){return {districts:[]};}
        export async function getBlocks(){return {blocks:[]};} export function errorMessage(e,f){return e.message||f;}
      ` }));
    } }],
    stdin: { resolveDir: root, loader: 'tsx', contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter,Routes,Route} from 'react-router-dom';import Screen from './src/pages/member/PersonalForm';import {Toaster} from 'sonner';
      window.fixture=${JSON.stringify(fixture)};window.saves=[];window.passwordSaves=[];localStorage.setItem('token','local-fixture');
      const c=new URLSearchParams(location.search).get('case');window.fixtureFail=c==='failure';
      if(c==='locked')Object.assign(window.fixture,{phoneNumber:'9123456780',state:'Tamil Nadu',district:'Chennai',city:'Chennai',isLocked:true,personalDetailsComplete:true});
      createRoot(document.getElementById('root')).render(<BrowserRouter><Routes><Route path="/member/forms/business" element={<p>Business step opened</p>}/><Route path="*" element={<Screen/>}/></Routes><Toaster/></BrowserRouter>);` }
  })).outputFiles[0].text;
  chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--disable-extensions', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let port;
  for (let i = 0; i < 150; i++) { try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch {} await pause(100); }
  assert(port, 'Chrome started');
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve));
  let seq = 0; const pending = new Map(), errors = [];
  ws.addEventListener('message', event => { const v = JSON.parse(event.data); if (v.method === 'Runtime.exceptionThrown') errors.push(v.params.exceptionDetails.text); pending.get(v.id)?.(v); pending.delete(v.id); });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq, timer = setTimeout(() => reject(Error(method)), 45000); pending.set(id, v => { clearTimeout(timer); resolve(v); }); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const v = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (v.result?.exceptionDetails) throw Error(v.result.exceptionDetails.text); return v.result?.result?.value; };
  const until = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(`!!(${expression})`)) return; await pause(100); } throw Error(expression + '\n' + JSON.stringify({ errors, body: await evaluate('document.body.innerText.slice(0,1500)') })); };
  const field = label => `[...document.querySelectorAll('label')].find(l=>l.textContent.startsWith(${JSON.stringify(label)}))?.parentElement.querySelector('input')`;
  const fill = async (label, value) => { await evaluate(`(()=>{const input=${field(label)};if(!input)throw Error('Missing field');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`); await pause(80); };
  const button = label => `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)})`;
  const open = async test => { await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/member/forms/personal?case=${test}` }); await until(`!document.body.innerText.includes('Loading your saved details')&&document.querySelector('form')`); };
  await send('Runtime.enable'); await send('Network.enable'); await send('Network.setBlockedURLs', { urls: ['https://*'] });
  for (const width of [320, 390, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
    await open('social');
    await fill('Phone Number', '+447911123456');
    await until(`${field('Place')}`);
    await fill('Place', 'London');
    assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'), `Fits ${width}px`);
    await evaluate(`${button('Next')}.click()`);
    await until(`document.body.innerText.includes('Business step opened')`);
    const saved = await evaluate('window.saves');
    assert.equal(saved.length, 1); assert.equal(saved[0].phoneNumber, '+447911123456'); assert.equal(saved[0].place, 'London'); assert(!saved[0].state);
    assert.deepEqual(await evaluate('window.passwordSaves'), [], 'Social-only completion stays optional');

    await open('social-password');
    await fill('Phone Number', '+447911123456'); await until(`${field('Place')}`); await fill('Place', 'London');
    await fill('New Password', 'Fixture-password-2026'); await fill('Confirm Password', 'Wrong-confirmation');
    assert.equal(await evaluate('document.querySelectorAll("input[autocomplete=current-password]").length'), 0);
    assert.equal(await evaluate('document.querySelectorAll("input[autocomplete=new-password][type=password]").length'), 2);
    assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'), `Password fields fit ${width}px`);
    await evaluate(`${button('Next')}.click()`);
    await until(`document.body.innerText.includes('do not match')`);
    assert.deepEqual(await evaluate('window.saves'), []);
    assert.deepEqual(await evaluate('window.passwordSaves'), []);
    await fill('Confirm Password', 'Fixture-password-2026');
    await evaluate(`${button('Next')}.click()`); await until(`document.body.innerText.includes('Business step opened')`);
    assert.deepEqual(await evaluate('window.passwordSaves'), [{newPassword:'Fixture-password-2026',confirmPassword:'Fixture-password-2026'}]);
    assert(!(await evaluate('JSON.stringify(window.saves)')).includes('Fixture-password-2026'));
    assert(!(await evaluate('JSON.stringify(localStorage)')).includes('Fixture-password-2026'));

    await open('failure');
    await until(`document.querySelector('[role="alert"]')`);
    assert(await evaluate(`${button('Next')}.disabled`));
    assert.deepEqual(await evaluate('window.saves'), []);
    await evaluate(`window.fixtureFail=false;${button('Try again')}.click()`);
    await until(`${field('Full Name')}?.value==='New Member'&&!${button('Next')}.disabled`);

    await open('locked');
    await until(`${button('Continue')}`);
    assert(await evaluate('document.querySelector("fieldset").disabled'));
    await evaluate(`${button('Continue')}.click()`);
    await until(`document.body.innerText.includes('Business step opened')`);
    assert.deepEqual(await evaluate('window.saves'), []);
  }
  assert.deepEqual(errors, []);
  console.log('PASS: first social phone/location/password, matching confirmation, separate credential save, no password in profile/storage, load failure/retry, locked-step continuation, and 320/390/1440px layout; local API stubs only.');
  await send('Browser.close');
} finally {
  ws?.close(); chrome?.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  if (path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep + 'activ-personal-contact-')) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
