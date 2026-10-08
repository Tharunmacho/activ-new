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
    b.onResolve({ filter: /^@\/services\/(activApi|api)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    b.onResolve({ filter: /^@\/pages\/member\/MemberPageShell$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'tsx', resolveDir: root, contents: args.path.endsWith('MemberPageShell')
      ? 'export default function Shell({children,title}) {return <main style={{maxWidth:1080,margin:"auto",padding:16}}><h1>{title}</h1>{children}</main>}'
      : args.path.endsWith('activApi')
        ? `export const getMyProfile=async()=>window.fixture.profile; export const getMyApplication=async()=>({memberType:'business'}); export const getMyMembershipPlans=async()=>({matched:window.fixture.business,plans:[window.fixture.business]}); export const toPlanAudience=x=>x;`
        : `export const SESSION_EVENT='fixture-session'; export const unwrap=(r,f)=>r?.data?.data??f; export default {get:async(url,options)=>{window.calls.push({url,options});if(window.fixture.fail)throw Error('Offline');return {data:{data:{plans:window.fixture.plans}}}}};` }));
  } };
  const built = await build({ absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', plugins: [fixturePlugin],
    define: { 'import.meta.env': '{"DEV":true}', 'process.env.NODE_ENV': '"test"' },
    stdin: { resolveDir: root, loader: 'tsx', contents: `
      import React from 'react'; import {createRoot} from 'react-dom/client'; import {BrowserRouter} from 'react-router-dom';
      import Screen from './src/features/member/pages/MembershipPlanDetails';
      import {governmentSchemes} from './src/lib/governmentSchemes';
      const business={key:'ideal',name:'Business',audience:'business',membershipType:'annual',price:10000,features:['Business benefit'],popular:true};
      const basic={...business,key:'basic',name:'Starter',price:5000};
      const lifetime={key:'platinum',name:'Platinum Lifetime',audience:'platinum',memberType:'lifetime',amount:200000,amountPaise:20000000,entitlements:['Lifetime membership — never renew']};
      window.calls=[]; window.fixture={business,plans:[business,basic,lifetime],profile:{membershipTier:'platinum',membershipType:'lifetime',fullName:'Sample Member',membershipNumber:'ACTIV-SAMPLE',membershipStatus:'active',lastPaymentAmount:200000,paidMembership:{planId:'basic'},block:'Kodambakkam',district:'Chennai'}};
      window.schemeLabels=governmentSchemes;
      const root=createRoot(document.getElementById('root'));let sequence=0;
      window.show=()=>root.render(<BrowserRouter><Screen key={++sequence}/></BrowserRouter>);window.show();` } });
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
  await until('document.body.innerText.includes("one-time · lifetime")');
  const content=()=>evaluate('document.body.innerText');
  assert((await content()).includes('₹2,00,000'));assert(!(await content()).includes('₹10,000'));assert(!(await content()).includes('Platinum'));assert(!(await content()).includes('per term'));
  assert((await content()).includes('No renewal needed'));assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
  assert(await evaluate('[...document.querySelectorAll("div")].some(e=>e.style.background.includes("linear-gradient") && getComputedStyle(e).color==="rgb(62, 44, 14)")'));
  assert(await evaluate('window.calls.some(c=>c.url==="/membership/plans"&&c.options.params.include==="platinum")'));
  if(process.env.TEST_ARTIFACTS){const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(path.join(process.env.TEST_ARTIFACTS,'website-lifetime-plan.png'),Buffer.from(shot.result.data,'base64'));}
  await evaluate('window.fixture.plans[2].amount=225000;window.show()');await until('document.body.innerText.includes("₹2,25,000")');assert((await content()).includes('₹2,00,000'),'Historical payment remains unchanged');
  await evaluate('window.fixture.plans[2].amount=0;window.fixture.plans[2].amountPaise=0;window.show()');await until('document.body.innerText.includes("current rate could not be loaded")');assert(!(await content()).includes('₹0'));
  await evaluate('window.fixture.plans.pop();window.show()');await until('document.body.innerText.includes("current rate could not be loaded")');assert(!(await content()).includes('₹10,000'));
  await evaluate('window.fixture.profile.membershipTier="standard";window.fixture.profile.membershipType="annual";window.show()');await until('document.body.innerText.includes("₹5,000")');assert(!(await content()).includes('₹10,000'));
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  await evaluate('window.fixture.fail=true;window.show()');await until('document.body.innerText.includes("current rate could not be loaded")');
  assert.deepEqual(await evaluate('window.schemeLabels(["None"])'),{schemes:[],explicitlyNone:true});
  assert.deepEqual(await evaluate('window.schemeLabels(["None","PMEGP","PMEGP","MUDRA"])'),{schemes:['PMEGP','MUDRA'],explicitlyNone:false});
  assert.deepEqual(errors,[]);
  console.log('PASS: lifetime price and benefits, gold header, historical payments, CMS price change, retired/missing plan, held annual plan, network failure, mobile/desktop layout and scheme labels.');
  await send('Browser.close');
} finally {
  ws?.close();chrome?.kill();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  if(path.resolve(profile).startsWith(path.resolve(tmpdir())+path.sep+'activ-held-plan-'))await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200}).catch(()=>{});
}
