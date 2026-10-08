import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'activ-held-plan-'));
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
  const fixturePlugin = { name: 'fixture-api', setup(b) {
    const names = ['@/services/activApi', '@/services/memberHubApi', '@/lib/session', './BusinessPageShell'];
    b.onResolve({filter:/.*/}, args => names.includes(args.path) ? {path:args.path,namespace:'fixture'} : undefined);
    b.onLoad({filter:/.*/,namespace:'fixture'}, args => ({loader:'tsx',resolveDir:root,contents:
      args.path==='./BusinessPageShell' ? 'export default function Shell({children,title}) {return <main style={{maxWidth:1080,margin:"auto",padding:16}}><h1>{title}</h1>{children}</main>}' :
      args.path==='@/lib/session' ? 'export const isMemberSession=()=>false;' :
      args.path==='@/services/memberHubApi' ? 'export const recordProductView=async()=>{};' :
      'export const getPublicCompany=async()=>window.fixture; export const addToTrustList=async()=>({}); export const removeFromTrustList=async()=>({}); export const errorMessage=e=>e.message;'
    }));
  }};
  const built=await build({absWorkingDir:root,bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',plugins:[fixturePlugin],define:{'import.meta.env':'{"DEV":true}','process.env.NODE_ENV':'"test"'},stdin:{resolveDir:root,loader:'tsx',contents:`
    import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,Routes,Route} from 'react-router-dom';
    import Screen from './src/pages/business/CompanyPublicView';
    const banner='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="260"><rect width="1000" height="260" fill="#eee6ff"/><text x="500" y="140" text-anchor="middle" font-size="42" font-family="Arial" fill="#50248b">Company banner - full image</text></svg>');
    window.fixture={_id:'111111111111111111111111',businessName:'Sample Engineering and Services',businessType:'Manufacturing',description:'Engineering products and dependable services for growing businesses.',area:'Guindy',location:'Chennai',mobileNumber:'9000000000',email:'sample@example.test',banner,govtRegistrations:['MSME / Udyam'],govtSchemes:['None'],products:[],isOwner:false,isActive:true,status:'active'};
    Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.shared=data}});
    createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/network/company/'+window.fixture._id]}><Routes><Route path="/network/company/:id" element={<Screen/>}/></Routes></MemoryRouter>);
  `}});
  bundle = built.outputFiles[0].text;
  chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let port;
  for (let i=0;i<100;i++) { try { port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];if(port)break; } catch {} await pause(100); }
  assert(port, 'Chrome starts');
  const tabs=await fetch(`http://127.0.0.1:${port}/json/list`).then(r=>r.json());
  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>ws.addEventListener('open',resolve));
  let seq=0;const pending=new Map(), errors=[];
  ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);pending.get(m.id)?.(m);pending.delete(m.id);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>reject(Error(method)),15000);pending.set(id,r=>{clearTimeout(timer);resolve(r)});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)throw Error(r.result.exceptionDetails.exception?.description);return r.result?.result?.value;};
  const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(`Boolean(${expression})`))return;await pause(100);}throw Error(expression)};
  await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}`});
  await until('document.body.innerText.includes("Engineering products and dependable")');
  assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  assert(await evaluate('document.querySelector("img").getBoundingClientRect().width<=innerWidth'));
  assert(await evaluate('getComputedStyle(document.querySelector("img")).objectFit==="contain"'));
  await evaluate('[...document.querySelectorAll("button")].find(button=>button.getAttribute("aria-label")==="Copy a link to this company").click()');
  await until('window.shared');
  assert((await evaluate('window.shared.url')).endsWith('/network/company/111111111111111111111111'));
  if(process.env.TEST_ARTIFACTS){const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(path.join(process.env.TEST_ARTIFACTS,'website-business-public-mobile.png'),Buffer.from(shot.result.data,'base64'));}
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  if(process.env.TEST_ARTIFACTS){const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(path.join(process.env.TEST_ARTIFACTS,'website-business-public-desktop.png'),Buffer.from(shot.result.data,'base64'));}
  assert.deepEqual(errors,[]);
  console.log('PASS: public company details, complete banner, mobile/desktop alignment and public social share URL.');
  await send('Browser.close');
} finally {
  ws?.close();chrome?.kill();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  if(path.resolve(profile).startsWith(path.resolve(tmpdir())+path.sep+'activ-held-plan-'))await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200}).catch(()=>{});
}
