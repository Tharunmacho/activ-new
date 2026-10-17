import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'activ-membership-confirm-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const screenshots = !process.argv.includes('--no-screenshots');
let bundle = '', css = '', chrome, ws;
const server = http.createServer((req, res) => {
  if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
  if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
  res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  const assets = await readdir(path.join(root, 'dist/assets'));
  css = await readFile(path.join(root, 'dist/assets', assets.find(f => /^index-.*\.css$/.test(f))), 'utf8');
  const sources = {
    '../member/MemberPageShell': 'export default ({children,title})=><main><h1>{title}</h1>{children}</main>;',
    '@/features/member/membershipPlans': 'export const resolvePlanEligibility=async()=>({plans:[]});',
    '@/services/api': `
      export const unwrap=(r,f)=>r?.data?.data??f;
      export default {get:async()=>{
        const automatic=location.search.includes('automatic=1'), year=new Date().getFullYear();
        return {data:{data:{kind:automatic?'business':'student',canPurchase:!automatic,currentPlan:automatic?'Intermediate':'Student',commencementYear:'',
          reason:automatic?'Congratulations! Your membership has advanced to Intermediate. Your paid validity is unchanged. The new fee applies at renewal.':'Start your business membership with Beginner.',
          plans:[{key:automatic?'intermediate':'basic',name:automatic?'Intermediate':'Beginner',price:automatic?22000:11000,audience:'business',minYears:automatic?5:0,maxYears:automatic?10:5,features:[],
          commencementYears:Array.from({length:5},(_,i)=>String(year-(automatic?5:0)-i)),commencementYearLabel:automatic?'2017–2021':'2022–2026'}]}}};
      }};
    `,
    './AdminSidebar': 'export default ()=>null;',
    '@/services/activApi': 'export const errorMessage=(e,f)=>e.message||f;',
    '@/features/admin/components/tierConfig': 'export const adminBasePath=()=>"/super-admin";',
    '@/services/membershipDashboardApi': `
      const unsubmitted=location.search.includes('unsubmitted=1');
      const member={id:'member-one',name:'Fixture Member',email:'fixture@example.test',phone:'9000000000',kind:'business',status:'pending',applicationStatus:unsubmitted?'Not submitted':'Pending',canConfirm:!unsubmitted,blockedReason:unsubmitted?'The member must submit their application first.':'',registeredAt:'2026-10-12',collected:0};
      export const loadMembershipDashboard=async()=>({rows:[member],payments:[],plans:[{id:'ideal',name:'Ideal',price:1000,membershipType:'annual'}],summary:{registered:1,submitted:1,active:0,awaiting:0,pendingReview:1,expired:0,collected:0,waived:0,openOrders:0}});
      export const loadMembershipDetail=async()=>({member,payments:[],confirmation:{kind:'business',commencementYear:'2012',plans:[{id:'ideal',key:'ideal',name:'Ideal',price:1000,audience:'business',commencementYears:['2016','2015','2014','2013','2012'],commencementYearLabel:'2016 or earlier'}]}});
      export const confirmMembership=async(id,body)=>{window.fixtureConfirmation={id,body};return{member:{...member,status:'active',memberNumber:body.membershipNumber,assignedMemberNumber:body.membershipNumber,canConfirm:false,expiresAt:'2027-10-11T18:30:00Z'},payments:[]}};
      export const deleteMembershipRegistration=async()=>{};export const deleteArchivedMembershipPayment=async()=>{};export const exportMembershipReport=async()=>{};
    `,
  };
  const result = await build({ absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    define: { 'import.meta.env': '{"DEV":true}', 'process.env.NODE_ENV': '"test"' },
    plugins: [{ name: 'booking-fixture', setup(b) {
      b.onResolve({ filter: /.*/ }, args => args.path in sources ? { path: args.path, namespace: 'fixture' } : undefined);
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: sources[args.path], loader: 'tsx', resolveDir: root }));
    } }], stdin: { resolveDir: root, loader: 'tsx', contents: `
      import React from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter,Routes,Route,useLocation}from'react-router-dom';
      import Bookings from './src/features/admin/super-admin/pages/MembershipRegistrations';
      import Plans from './src/pages/payment/MembershipPlans';
      function Target(){const at=useLocation();return <p data-target>{JSON.stringify({path:at.pathname,state:at.state})}</p>}
      createRoot(document.getElementById('root')).render(<BrowserRouter><Routes><Route path='/super-admin/membership/registrations' element={<Bookings/>}/><Route path='/member/membership-plans' element={<Plans/>}/><Route path='*' element={<Target/>}/></Routes></BrowserRouter>);
    ` } });
  bundle = result.outputFiles[0].text;
  chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new','--remote-debugging-port=0','--user-data-dir='+profile,'--no-first-run','about:blank'], { windowsHide: true, stdio: 'ignore' });
  let port;
  for (let n=0;n<100;n++){try{port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];if(port)break;}catch{}await pause(100);}
  const tabs=await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json());
  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>ws.addEventListener('open',resolve));
  let sequence=0;const pending=new Map(),errors=[];
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);pending.get(m.id)?.(m);pending.delete(m.id);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence,t=setTimeout(()=>reject(Error(method)),30000);pending.set(id,m=>{clearTimeout(t);resolve(m)});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)throw Error(r.result.exceptionDetails.exception?.description);return r.result?.result?.value;};
  const until=async expr=>{for(let n=0;n<120;n++){if(await evaluate('Boolean('+expr+')'))return;await pause(80);}throw Error(expr+' '+errors.join(';'));};
  const click=label=>evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith(${JSON.stringify(label)})).click()`);
  const select=(label,value)=>evaluate(`(()=>{const s=document.querySelector('select[aria-label=${JSON.stringify(label)}]');s.value=${JSON.stringify(value)};s.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await send('Runtime.enable');await send('Network.enable');await send('Network.setBlockedURLs',{urls:['https://*']});
  const fill=async(label,value)=>evaluate(`(()=>{const el=[...document.querySelectorAll('label')].find(l=>l.textContent.trim().startsWith(${JSON.stringify(label)}))?.querySelector('input,textarea');if(!el)throw Error('Missing input');const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  for(const width of [1440,390,320]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
    await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/super-admin/membership/registrations'});
    await until('document.body.innerText.includes("Fixture Member")');
    await click('Details');await until('document.body.innerText.includes("Confirm membership / record payment")');
    await click('Confirm membership / record payment');
    await select('Membership plan','ideal');
    assert.deepEqual(await evaluate(`[...document.querySelector('select[aria-label="Membership plan"]').options].map(o=>o.value).filter(Boolean)`), ['ideal']);
    assert.deepEqual(await evaluate(`[...document.querySelector('select[aria-label="Business commencement year"]').options].map(o=>o.value).filter(Boolean)`), ['2016','2015','2014','2013','2012']);
    await select('Business commencement year','2013');
    await fill('Membership ID','activ-20261012-099');
    await fill('Payment / confirmation notes','Cash received; office details checked');
    await evaluate(`document.querySelector('[role="dialog"] input[type="checkbox"]').click()`);
    await evaluate(`document.querySelector('input[aria-label="Membership ID"]').scrollIntoView({block:"center"})`);
    const bounds=await evaluate(`(()=>{const r=document.querySelector('input[aria-label="Membership ID"]').getBoundingClientRect();return{left:r.left,right:r.right}})()`);
    assert(bounds.left>=0&&bounds.right<=width,'ID field fits viewport');
    if (screenshots) { const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.resolve(root,'../artifacts/membership-confirm-'+width+'.png'),Buffer.from(shot.result.data,'base64')); }
    await click('Confirm membership');await until('window.fixtureConfirmation');
    const body=await evaluate('window.fixtureConfirmation.body');
    assert.equal(Object.hasOwn(body,'manualAdmission'),false,'office payment never sends a form-completion bypass');
    assert.equal(body.commencementYear,'2013');assert.equal(body.membershipNumber,'ACTIV-20261012-099');assert.equal(body.mode,'cash');assert.equal(body.amount,1000);
    await until('document.body.innerText.includes("11 Oct 2027")');
  }
  await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/super-admin/membership/registrations?unsubmitted=1'});
  await until('document.body.innerText.includes("Fixture Member")');
  await click('Details'); await until('document.body.innerText.includes("submit their application first")');
  assert.equal(await evaluate('[...document.querySelectorAll("button")].some(b=>b.textContent.includes("Confirm membership / record payment"))'),false);
  assert.equal(await evaluate('document.body.innerText.includes("authorise office admission")'),false);
  assert.equal(await evaluate('!!window.fixtureConfirmation'),false);
  for (const width of [390,1440]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
    await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/member/membership-plans?upgrade=1'});
    await until('document.querySelector("select")');
    const year = new Date().getFullYear();
    assert.deepEqual(await evaluate(`[...document.querySelector('select[aria-label="Business commencement year"]').options].map(o=>o.value).filter(Boolean)`),Array.from({length:5},(_,i)=>String(year-i)));
    assert.equal(await evaluate('document.body.innerText.includes("Intermediate")'),false);
    await select('Business commencement year',String(year-1)); await click('Pay');
    await until('document.querySelector("[data-target]")');
    const target=JSON.parse(await evaluate('document.querySelector("[data-target]").textContent'));
    assert.equal(target.path,'/payment/gateway'); assert.equal(target.state.planId,'basic'); assert.equal(target.state.commencementYear,String(year-1)); assert.equal(target.state.upgrade,true);
    await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/member/membership-plans?upgrade=1&automatic=1'});
    await until('document.body.innerText.includes("Congratulations!")');
    assert.equal(await evaluate('[...document.querySelectorAll("button")].some(b=>b.textContent.trim().startsWith("Pay"))'),false);
    assert.equal(await evaluate('document.body.innerText.includes("Beginner")'),false);
    assert.equal(await evaluate('document.body.innerText.includes("Fee at your next renewal")'),true);
    assert.equal(await evaluate('!!document.querySelector("select")'),false);
    if (screenshots) { const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.resolve(root,'../artifacts/membership-progression-'+width+'.png'),Buffer.from(shot.result.data,'base64')); }
  }
  assert.equal(errors.length,0,errors.join(';'));
  console.log('PASS office confirmation at 320/390/1440px; Student entry-only upgrade, bounded years, checkout payload and automatic progression without a payment button at 390/1440px.');
  await send('Browser.close');
}finally{
  ws?.close();chrome?.kill();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  if(path.resolve(profile).startsWith(path.resolve(tmpdir())+path.sep+'activ-membership-confirm-'))await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200}).catch(()=>{});
}
