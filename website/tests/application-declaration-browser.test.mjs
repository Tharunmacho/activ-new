import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const root = fileURLToPath(new URL('..', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'activ-declaration-'));
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
      b.onLoad({ filter: /.*/, namespace: 'fixtures' }, () => ({ contents: `
        export async function getMyProfile(){return {fullName:'Applicant',email:'local@example.test',phoneNumber:'9123456780',state:'Tamil Nadu',district:'Chennai',city:'Chennai',religion:'Hindu',socialCategory:'SC',gender:'Female'};}
        export async function getBusinessInfo(){if(window.failLoad)throw Error('Could not load saved forms');return window.business;}
        export async function getDeclarationInfo(){return window.declaration;}
        export async function getFinancialInfo(){return {};}
        export async function updateProfile(value){window.saves.push(value);window.declaration=value;return {};}
        export async function submitApplication(value){window.submits.push(value);if(window.failSubmit)throw Error('Final submission failed');return {_id:'saved-application'};}
        export function errorMessage(e,f){return e.message||f;}
      ` }));
    } }], stdin: { resolveDir: root, loader: 'tsx', contents: `
      import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter,Routes,Route} from 'react-router-dom';import Screen from './src/pages/member/DeclarationForm';import {Toaster} from 'sonner';
      localStorage.setItem('token','local-fixture');window.saves=[];window.submits=[];
      const c=new URLSearchParams(location.search).get('case');window.failLoad=c==='load-error';window.failSubmit=c==='submit-error';
      window.business=c==='missing-business'?{}:c==='business'?{doingBusiness:true,registrationType:'business',businessCommencementYear:'2020'}:{doingBusiness:false,registrationType:'student'};
      window.declaration={agreeToDeclaration:true,sisterConcerns:c==='business'?2:0,companyNames:c==='business'?['One']:[]};
      createRoot(document.getElementById('root')).render(<BrowserRouter><Routes><Route path="/member/application-submitted" element={<p>Application confirmation</p>}/><Route path="/member/forms/business" element={<p>Business form opened</p>}/><Route path="*" element={<Screen/>}/></Routes><Toaster/></BrowserRouter>);` }
  })).outputFiles[0].text;
  chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--disable-extensions', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let port; for (let i=0;i<150;i++) { try { port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]; if(port)break; } catch {} await pause(100); }
  assert(port, 'Chrome started');
  const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json(); ws=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
  await new Promise(resolve=>ws.addEventListener('open',resolve));
  let seq=0; const pending=new Map(), errors=[];
  ws.addEventListener('message',event=>{const v=JSON.parse(event.data);if(v.method==='Runtime.exceptionThrown')errors.push(v.params.exceptionDetails.text);pending.get(v.id)?.(v);pending.delete(v.id);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>reject(Error(method)),45000);pending.set(id,v=>{clearTimeout(timer);resolve(v);});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const v=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(v.result?.exceptionDetails)throw Error(v.result.exceptionDetails.text);return v.result?.result?.value;};
  const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(100);}throw Error(expression+' '+await evaluate('JSON.stringify({body:document.body.innerText,business:window.business,url:location.href})'));};
  const button=label=>`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)})`;
  const open=async test=>{await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/member/forms/declaration?case=${test}`});await until(`document.querySelector('form')&&!document.body.innerText.includes('Loading your saved forms')`);};
  await send('Runtime.enable');await send('Network.enable');await send('Network.setBlockedURLs',{urls:['https://*']});
  for(const width of [320,390,1440]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
    await open('missing-business'); await until(`document.body.innerText.includes('answer whether you are doing business')`);
    assert(await evaluate(`${button('Submit Application')}.disabled`));
    assert.match(await evaluate('document.body.innerText'), /answer whether you are doing business/);
    await evaluate(`${button('Open Business information')}.click()`); await until(`document.body.innerText.includes('Business form opened')`);
    await open('load-error');await until(`document.body.innerText.includes('Could not load saved forms')`);
    assert(await evaluate(`${button('Submit Application')}.disabled`));
    await evaluate(`window.failLoad=false;${button('Try again')}.click()`);await until(`!${button('Submit Application')}.disabled`);
    assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'), `Fits ${width}px`);
    await evaluate(`${button('Submit Application')}.click()`);await until(`document.body.innerText.includes('Application confirmation')`);
    const sent=await evaluate('window.submits');assert.equal(sent.length,1);assert.equal(sent[0].registrationType,'student');assert.equal(sent[0].data.declaration.agreeToDeclaration,true);
  }
  await open('business');await evaluate(`${button('Submit Application')}.click()`);await until(`document.body.innerText.includes('one company name')`);
  assert.deepEqual(await evaluate('window.saves'), []);assert.deepEqual(await evaluate('window.submits'), []);
  await open('submit-error');await evaluate(`${button('Submit Application')}.click()`);await until(`document.body.innerText.includes('Final submission failed')`);
  assert(!(await evaluate('document.body.innerText')).includes('submitted successfully'));
  assert.equal(await evaluate('window.submits.length'),1);assert.equal(await evaluate('location.pathname'),'/member/forms/declaration');
  assert.deepEqual(errors,[]);console.log('PASS Declaration required sections, read failure/retry, conditional company count, honest final failure and 320/390/1440px workflows; local API stubs only.');
  await send('Browser.close');
} finally {
  ws?.close();chrome?.kill();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  if(path.resolve(profile).startsWith(path.resolve(tmpdir())+path.sep+'activ-declaration-'))await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200}).catch(()=>{});
}
