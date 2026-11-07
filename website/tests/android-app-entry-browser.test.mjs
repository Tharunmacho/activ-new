import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const root=fileURLToPath(new URL('..',import.meta.url));
const profile=await mkdtemp(path.join(tmpdir(),'activ-app-entry-'));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));let chrome,ws,bundle='',css='';
const server=http.createServer((req,res)=>{
  if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');return res.end(bundle);}
  if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');return res.end(css);}
  res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body style="margin:0"><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try {
  const assets=await readdir(path.join(root,'dist/assets'));css=await readFile(path.join(root,'dist/assets',assets.find(file=>/^index-.*\.css$/.test(file))),'utf8');
  css+=await readFile(path.join(root,'src/components/androidAppEntry.css'),'utf8');
  bundle=(await build({absWorkingDir:root,bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"test"','import.meta.env.VITE_CHAT_WHATSAPP':'""'},stdin:{resolveDir:root,loader:'tsx',contents:`
    import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,Link} from 'react-router-dom';
    import Entry from './src/components/AndroidAppEntry';import Floating from './src/components/layout/FloatingLaunchers';
    const query=new URLSearchParams(location.search);if(query.has('native'))window.ReactNativeWebView={};
    if(query.has('storage-fails')){Storage.prototype.getItem=function(){throw Error('Unavailable')};Storage.prototype.setItem=function(){throw Error('Unavailable')}}
    document.addEventListener('click',event=>{const link=event.target.closest('a');if(link?.getAttribute('href')?.startsWith('intent:')){event.preventDefault();window.intentClick=link.getAttribute('href')}});
    createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={[query.get('path')||'/events/demo/book?ref=ACTIV-TEST-001']}><Entry><Floating/><main data-page style={{minHeight:1200,padding:16}}><h1>ACTIV website</h1><p>Your page remains available.</p><Link data-route to="/news">News</Link><Link data-sensitive to="/payment-success">Payment return</Link></main></Entry></MemoryRouter>);
  `}})).outputFiles[0].text;
  chrome=spawn(process.env.CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--disable-extensions','about:blank'],{windowsHide:true,stdio:'ignore'});
  let port;for(let i=0;i<150;i++){try{port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];if(port)break;}catch{}await pause(100);}assert(port,'Chrome started');
  const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();ws=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>ws.addEventListener('open',resolve));
  let seq=0;const pending=new Map(),errors=[];ws.addEventListener('message',event=>{const v=JSON.parse(event.data);if(v.method==='Runtime.exceptionThrown')errors.push(v.params.exceptionDetails.text);pending.get(v.id)?.(v);pending.delete(v.id);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>reject(Error(method)),45000);pending.set(id,v=>{clearTimeout(timer);resolve(v);});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const v=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(v.result?.exceptionDetails)throw Error(v.result.exceptionDetails.text);return v.result?.result?.value;};
  const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(100);}throw Error(expression+' '+await evaluate('document.body.innerText'));};
  const uaAndroid='Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36';
  const open=async(query='')=>{await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/${query}`});await until(`!!document.querySelector('[data-page]')`);};
  await send('Runtime.enable');await send('Network.enable');await send('Network.setBlockedURLs',{urls:['https://*']});
  await send('Network.setUserAgentOverride',{userAgent:uaAndroid});
  for(const width of [320,390,768]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:true});await open();
    await until(`!!document.querySelector('.activ-android-entry__primary')`);
    assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),`Fits ${width}px`);
    assert(await evaluate(`(()=>{const banner=document.querySelector('.activ-android-entry').getBoundingClientRect(),page=document.querySelector('[data-page]').getBoundingClientRect();return page.top>=banner.bottom})()`),'Banner is in document flow');
    assert(await evaluate(`[...document.querySelectorAll('.activ-android-entry a,.activ-android-entry button')].every(el=>el.getBoundingClientRect().height>=44)`),'All controls have44px targets');
    assert.equal(await evaluate(`!!document.querySelector('.activ-app-launcher')`),false,'No duplicate Android floating Get app');
    const href=await evaluate(`document.querySelector('.activ-android-entry__primary').getAttribute('href')`);
    assert.match(href,/^intent:\/\/activ\.org\.in\/events\/demo\/book\?ref=ACTIV-TEST-001#Intent;/);
    assert.equal(await evaluate(`document.querySelector('.activ-android-entry__store').href`),'https://play.google.com/store/apps/details?id=in.activ.membership');
    await evaluate(`document.querySelector('.activ-android-entry__primary').click()`);assert.equal(await evaluate('window.intentClick'),href,'Only the explicit tap activates the intent');
    if(process.env.TEST_ARTIFACTS&&[320,390].includes(width)){await mkdir(process.env.TEST_ARTIFACTS,{recursive:true});const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(process.env.TEST_ARTIFACTS,`android-app-entry-${width}.png`),Buffer.from(shot.result.data,'base64'));}
  }
  const initial=await evaluate('location.href');await pause(1800);assert.equal(await evaluate('location.href'),initial,'No automatic redirect/timer');
  await evaluate(`document.querySelector('.activ-android-entry__secondary').click()`);await until(`!document.querySelector('.activ-android-entry')`);
  assert.equal(await evaluate(`sessionStorage.getItem('activ-android-entry-dismissed')`),'true');
  await evaluate(`document.querySelector('[data-route]').click()`);assert.equal(await evaluate(`!!document.querySelector('.activ-android-entry')`),false);
  await open();assert.equal(await evaluate(`!!document.querySelector('.activ-android-entry')`),false,'Session dismissal survives reload');
  assert.equal(await evaluate(`!!document.querySelector('.activ-app-launcher')`),false,'No alternate floating prompt after continue');
  await evaluate(`sessionStorage.clear()`);
  for(const route of ['/auth/social?code=secret','/payment-success','/member/payment-success?view=receipt','/payment/gateway','/super-admin/events','/checkin/token','/donate/receipt/token','/unmapped']) {
    await open('?path='+encodeURIComponent(route));assert.equal(await evaluate(`!!document.querySelector('.activ-android-entry')`),false,route);assert.equal(await evaluate(`!!document.querySelector('.activ-app-launcher')`),false,route+' has no competing Android app prompt');
  }
  await open('?native');assert.equal(await evaluate(`!!document.querySelector('.activ-android-entry')`),false,'No promotion inside app');
  await open('?path='+encodeURIComponent('/events/demo/book?ref=secret%3Bpackage%3Devil'));assert.equal(await evaluate(`!!document.querySelector('.activ-android-entry')`),false,'Unsafe intent query rejected');
  await open('?storage-fails');await until(`!!document.querySelector('.activ-android-entry')`);await evaluate(`document.querySelector('.activ-android-entry__secondary').click()`);await until(`!document.querySelector('.activ-android-entry')`);
  for(const userAgent of ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit Safari','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit Chrome/131.0.0.0 Safari']) {
    await send('Network.setUserAgentOverride',{userAgent});await open();assert.equal(await evaluate(`!!document.querySelector('.activ-android-entry')`),false);assert(await evaluate(`!!document.querySelector('.activ-app-launcher')`),'Existing non-Android Get app remains');
  }
  assert.deepEqual(errors,[]);console.log('PASS Android app-entry browser:320/390/768px flow/touch targets,intent/ref/direct Play link,session dismissal/reload,storage failure,WebView+callback exclusions,desktop/iOS unchanged,no automatic launch. HTTPS blocked.');
  await send('Browser.close');
}finally{ws?.close();chrome?.kill();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));if(path.resolve(profile).startsWith(path.resolve(tmpdir())+path.sep+'activ-app-entry-'))await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100}).catch(()=>{});}
