import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const root = fileURLToPath(new URL('..', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'activ-application-status-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let chrome, ws, bundle = '', css = '';
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
    define: { 'process.env.NODE_ENV': '"test"', 'import.meta.env': '{}' }, plugins: [{ name: 'local-fixtures', setup(b) {
      b.onResolve({ filter: /^@\/services\/activApi$/ }, () => ({ path: 'api', namespace: 'fixtures' }));
      b.onResolve({ filter: /(?:MemberPageShell|SocialAccountSecurity)$/ }, () => ({ path: 'shell', namespace: 'fixtures' }));
      b.onLoad({ filter: /^shell$/, namespace: 'fixtures' }, () => ({ contents: 'export default function Shell({children}) { return children || null; }' }));
      b.onLoad({ filter: /^api$/, namespace: 'fixtures' }, () => ({ resolveDir: root, contents: `
        import {pickCurrentApplication} from './src/lib/applicationStatus';
        const wait=()=>new Promise(resolve=>setTimeout(resolve,75));
        let cachedProfile, cachedApplication;
        export function clearApiCache(){cachedProfile=undefined;cachedApplication=undefined;window.cacheClears++;}
        export async function getMyProfile(){if(window.failProfile)throw Error('Profile unavailable');return cachedProfile ||= structuredClone(window.profile);}
        export async function getMyApplication(){if(window.failStatus)throw Object.assign(Error('Application status unavailable'),{response:{status:429}});if(cachedApplication===undefined)cachedApplication=structuredClone(pickCurrentApplication(window.applications));return cachedApplication;}
        export async function getBusinessInfo(){return window.business;}
        export async function getDeclarationInfo(){return window.declaration;}
        export async function getFinancialInfo(){if(window.failFinancial)throw Error('Saved financial details unavailable');return {retained:'saved financial answer'};}
        export async function updateProfile(value){window.saves.push(value);await wait();window.declaration=value;return {};}
        export async function apiFetch(url,options={}){
          if(options.method==='PUT'){await updateProfile(JSON.parse(options.body));return new Response(JSON.stringify({data:{}}));}
          const data=url.includes('business-info')?window.business:url.includes('declaration-info')?window.declaration:window.profile;
          return new Response(JSON.stringify({data}));
        }
        export async function getStates(){return {states:[{name:'Tamil Nadu'}]};}
        export async function getDistricts(){return {districts:[{name:'Chennai'}]};}
        export async function getBlocks(){return {blocks:[{name:'Chennai'}]};}
        export async function submitApplication(value){
          window.submits.push(value);await wait();
          if(window.conflict){window.applications=[{_id:'existing-approved',status:'Approved'}];if(window.conflictReadFailure)window.failStatus=true;throw Object.assign(Error('Your application changed during submission. Refresh its status before trying again.'),{response:{status:409}});}
          const existing=pickCurrentApplication(window.applications);
          const id=existing?.status==='Pending'?'existing-pending':'new-submission';
          window.applications=[{_id:id,status:'Pending',createdAt:'2026-11-07'},...window.applications.filter(a=>a.status==='Rejected')];return {_id:id};
        }
        export function errorMessage(e,f){return e.message||f;}
      ` }));
    } }], stdin: { resolveDir: root, loader: 'tsx', contents: `
      import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter,Routes,Route} from 'react-router-dom';
      import Declaration from './src/pages/member/DeclarationForm';import Profile from './src/pages/member/Profile';import {Toaster} from 'sonner';
      localStorage.setItem('token','local-fixture');localStorage.removeItem('applicationId');window.saves=[];window.submits=[];window.cacheClears=0;
      const c=new URLSearchParams(location.search).get('case');
      window.profile={fullName:'Applicant',email:'local@example.test',phoneNumber:'9123456780',state:'Tamil Nadu',district:'Chennai',block:'Chennai',city:'Chennai',religion:'Hindu',socialCategory:'SC',gender:'Female',membershipStatus:'pending'};
      window.business={doingBusiness:false,registrationType:'student'};window.declaration={agreeToDeclaration:true,sisterConcerns:0,companyNames:[]};
      window.applications=c==='rejected'?[{_id:'old-rejection',status:'Rejected',createdAt:'2026-11-06'}]:c==='approved'?[{_id:'existing-approved',status:'state_approved'}]:c==='new'?[]:[{_id:'old-rejection',status:'Rejected',createdAt:'2026-11-08'},{_id:'existing-pending',status:'Pending',createdAt:'2026-11-07'}];
      if(c==='rejected')window.profile.applicationId='old-rejection';
      if(c==='active'||c==='completed'){window.profile.membershipStatus=c;window.applications=[];}
      window.failStatus=c==='load-failure';
      createRoot(document.getElementById('root')).render(<BrowserRouter><Routes>
        <Route path="/member/application-submitted" element={<p>Application confirmation</p>}/><Route path="/member/profile-view" element={<p>Saved profile</p>}/>
        <Route path="/member/profile" element={<Profile/>}/><Route path="*" element={<Declaration/>}/>
      </Routes><Toaster/></BrowserRouter>);` }
  })).outputFiles[0].text;
  chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--disable-extensions', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let port; for (let i=0;i<150;i++) { try { port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]; if(port)break; } catch {} await pause(100); }
  assert(port, 'Chrome started');
  const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();ws=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
  await new Promise(resolve=>ws.addEventListener('open',resolve));let seq=0;const pending=new Map(), errors=[];
  ws.addEventListener('message',event=>{const v=JSON.parse(event.data);if(v.method==='Runtime.exceptionThrown')errors.push(v.params.exceptionDetails.text);pending.get(v.id)?.(v);pending.delete(v.id);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>reject(Error(method)),45000);pending.set(id,v=>{clearTimeout(timer);resolve(v);});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const v=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(v.result?.exceptionDetails)throw Error(v.result.exceptionDetails.text);return v.result?.result?.value;};
  const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(100);}throw Error(expression+' '+await evaluate('document.body.innerText'));};
  const button=label=>`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)})`;
  const open=async(form,test,label)=>{await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/member/${form==='profile'?'profile':'forms/declaration'}?step=3&case=${test}`});await until(label?`${button(label)}&&!${button(label)}.disabled`:`document.body.innerText.includes('could not load your profile')||document.body.innerText.includes('Application status unavailable')`);};
  await send('Runtime.enable');await send('Network.enable');await send('Network.setBlockedURLs',{urls:['https://*']});
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:true});
  let cases=0;
  for(const form of ['declaration','profile']) {
    for(const test of ['approved','active','completed']) {
      await open(form,test,'Save changes');await evaluate(`${button('Save changes')}.click()`);await until(`document.body.innerText.includes('Saved profile')`);
      assert.equal(await evaluate('window.saves.length'),1);assert.equal(await evaluate('window.submits.length'),0);cases++;
    }
    for(const [test,label,id] of [['new','Submit Application','new-submission'],['rejected','Resubmit application','new-submission'],['pending','Update application','existing-pending']]) {
      await open(form,test,label);await evaluate(form==='declaration' ? `(()=>{const form=document.querySelector('form');form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));})()` : `(()=>{const action=${button(label)};action.click();action.click();})()`);await until(`document.body.innerText.includes('Application confirmation')`);
      assert.equal(await evaluate('window.submits.length'),1);assert.equal(await evaluate('window.saves.length'),1);
      assert.equal(await evaluate(`localStorage.getItem('applicationId')`),id);
      assert.equal(await evaluate('window.submits[0].data.financialInfo.retained'),'saved financial answer');cases++;
    }
    await open(form,'pending','Update application');await evaluate(`window.applications=[{_id:'now-approved',status:'Approved'}];${button('Update application')}.click()`);await until(`document.body.innerText.includes('Saved profile')`);
    assert.equal(await evaluate('window.submits.length'),0,'fresh approval skips POST');cases++;
    await open(form,'approved','Save changes');await evaluate(`window.applications=[{_id:'now-rejected',status:'Rejected'}];${button('Save changes')}.click()`);await until(`document.body.innerText.includes('Application confirmation')`);
    assert.equal(await evaluate('window.submits.length'),1,'fresh rejection permits resubmission');cases++;
    for(const [flag,message] of [['failStatus','Application status unavailable'],['failProfile','Profile unavailable'],['failFinancial','Saved financial details unavailable']]) {
      await open(form,'pending','Update application');await evaluate(`window.${flag}=true;${button('Update application')}.click()`);await until(`document.body.innerText.includes(${JSON.stringify(message)})`);
      assert.equal(await evaluate('window.submits.length'),0);assert(!(await evaluate('document.body.innerText')).includes('submitted successfully'));cases++;
    }
    await open(form,'pending','Update application');await evaluate(`window.conflict=true;${button('Update application')}.click()`);await until(`${button('Save changes')}&&!${button('Save changes')}.disabled`);
    assert.match(await evaluate('document.body.innerText'),/changed during submission/);assert.equal(await evaluate('window.submits.length'),1);assert(await evaluate('window.cacheClears>=2'));assert(!(await evaluate('document.body.innerText')).includes('submitted successfully'));cases++;
    await open(form,'pending','Update application');await evaluate(`window.conflict=true;window.conflictReadFailure=true;${button('Update application')}.click()`);await until(`${button('Update application')}&&!${button('Update application')}.disabled&&document.body.innerText.includes('changed during submission')`);
    assert.equal(await evaluate('window.submits.length'),1);assert(!(await evaluate('document.body.innerText')).includes('Saved profile'));cases++;
    await open(form,'load-failure');assert.equal(await evaluate('window.submits.length'),0);assert(!(await evaluate('document.body.innerText')).includes('Submit Application')||await evaluate(`${button('Submit Application')}.disabled`));cases++;
  }
  assert.deepEqual(errors,[]);console.log(`PASS ${cases} actual Profile/Declaration browser workflows: pending same-ID updates, rejected reapply, approved/paid saves, fresh-state races, double clicks, failed reads, conflict refresh. Local API fixtures only.`);
  await send('Browser.close');
} finally {
  ws?.close();chrome?.kill();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  if(path.resolve(profile).startsWith(path.resolve(tmpdir())+path.sep+'activ-application-status-'))await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200}).catch(()=>{});
}
