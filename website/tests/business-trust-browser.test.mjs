import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'activ-business-trust-'));
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
  css = await readFile(process.env.TEST_CSS || path.join(root, 'dist/assets', assets.find(file => /^index-.*\.css$/.test(file))), 'utf8');
  const fixturePlugin = { name: 'fixture-api', setup(b) {
    const names = ['@/services/activApi', '@/contexts/ActiveCompanyContext', './BusinessPageShell'];
    b.onResolve({filter:/.*/}, args => names.includes(args.path) ? {path:args.path,namespace:'fixture'} : undefined);
    b.onLoad({filter:/.*/,namespace:'fixture'}, args => ({loader:'tsx',resolveDir:root,contents:
      args.path==='./BusinessPageShell' ? 'export default function Shell({children,title}) {return <main><h1>{title}</h1>{children}</main>}' :
      args.path==='@/contexts/ActiveCompanyContext' ? `
        import {useSyncExternalStore} from 'react';
        const companies=[{_id:'one',businessName:'One'}, {_id:'two',businessName:'Two'}, {_id:'three',businessName:'Three'}, {_id:'failed',businessName:'Offline'}];
        const listeners=new Set();const loadCompanies=()=>{};
        let state={activeCompany:companies[0],companies,hasLoaded:true,loadCompanies};
        window.choose=id=>{state={...state,activeCompany:companies.find(c=>c._id===id)};listeners.forEach(fn=>fn())};
        export const useActiveCompanyStore=()=>useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn)},()=>state);
      ` : `
        export const apiFetch=async path=>{
          const id=new URL(path,'http://fixture').searchParams.get('companyId');
          window.calls.push(path);
          if(path.includes('/activities'))return {ok:true,json:async()=>({data:[]})};
          if(window.slow===id) await new Promise(resolve=>{window.releaseSlow=resolve});
          return {ok:id!=='failed',json:async()=>({data:{total:3,active:2,featured:1,trustedBy:{one:7,two:0,three:1}[id]}})};
        };
      `
    }));
  }};
  const built=await build({absWorkingDir:root,bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',plugins:[fixturePlugin],define:{'import.meta.env':'{"DEV":true}','process.env.NODE_ENV':'"test"'},stdin:{resolveDir:root,loader:'tsx',contents:`
    import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';
    import Screen from './src/pages/business/Dashboard';
    window.calls=[];
    createRoot(document.getElementById('root')).render(<MemoryRouter><Screen/></MemoryRouter>);
  `}});
  bundle = built.outputFiles[0].text;
  chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let port;
  for (let i=0;i<100;i++) { try { port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];if(port)break; } catch {} await pause(100); }
  assert(port, 'Chrome starts');
  const tabs=await fetch(`http://127.0.0.1:${port}/json/list`).then(r=>r.json());
  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>ws.addEventListener('open',resolve));
  let seq=0;const pending=new Map(), errors=[];
  ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);pending.get(m.id)?.(m);pending.delete(m.id);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>reject(Error(method)),method === 'Page.captureScreenshot' ? 45000 : 15000);pending.set(id,r=>{clearTimeout(timer);resolve(r)});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)throw Error(r.result.exceptionDetails.exception?.description);return r.result?.result?.value;};
  const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(`Boolean(${expression})`))return;await pause(100);}throw Error(expression)};
  await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}`});
  const countCard='[...document.querySelectorAll("span")].find(e=>e.textContent==="Trusted by")?.parentElement.parentElement.innerText';
  await until('document.body.innerText.includes("Trusted by")');
  assert.match(await evaluate(countCard), /7[\s\S]*Members/i);
  await evaluate('window.choose("two")');
  await until('document.body.innerText.includes("Trusted by")');
  assert.match(await evaluate(countCard), /0[\s\S]*Members/i, 'zero is a genuine count');
  await evaluate('window.choose("three")');
  await until('document.body.innerText.includes("Trusted by")');
  assert.match(await evaluate(countCard), /1[\s\S]*Member/i, 'singular count');
  await evaluate('window.slow="one"; window.choose("one")');
  await until('window.releaseSlow');
  await evaluate('window.choose("two")');
  await until('document.body.innerText.includes("Trusted by")');
  await evaluate('window.releaseSlow()');
  await pause(150);
  assert.match(await evaluate(countCard), /0[\s\S]*Members/i, 'late previous company response is ignored');
  await evaluate('window.choose("failed")');
  await until('document.body.innerText.toLowerCase().includes("count unavailable")');
  assert.match(await evaluate(countCard), /Count unavailable/i, 'failed API is not a zero count');
  assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'), 'mobile fits viewport');
  assert.deepEqual(errors,[]);
  console.log('PASS: owner trust counts, zero/singular, failed request, and company-switch race.');
  await send('Browser.close');
} finally {
  ws?.close();chrome?.kill();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  if(path.resolve(profile).startsWith(path.resolve(tmpdir())+path.sep+'activ-business-trust-'))await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200}).catch(()=>{});
}
