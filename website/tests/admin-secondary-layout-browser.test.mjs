// Actual Updates/Notifications screens and API clients; all responses are local fixtures.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { localTypographyFonts } from './browserTypographyFixtures.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const out=process.env.TEST_ARTIFACTS?path.resolve(process.env.TEST_ARTIFACTS):null;
const fonts=await localTypographyFonts(root),profile=await mkdtemp(path.join(tmpdir(),'activ-admin-secondary-'));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const messages=[{_id:'message-fixture',event:'EVENT_BOOKING_CONFIRMED',channel:'email',status:'failed',effectiveStatus:'failed',recipientName:'Alexandra Prakash',recipient:'long.membership.contact@example.test',subject:'Event booking confirmation',eventTitle:'Entrepreneurship Awareness and Business Development Programme',createdAt:'2026-10-15T12:00:00Z',lastError:'The recipient email address could not be reached'}];
const counts={total:503,accepted:314,sent:0,delivered:0,read:0,failed:189,mock:0};
const requests=[],errors=[],reports=[];let bundle='',css='',chrome,ws;
const reply=(res,data)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({success:true,data}));};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');if(fonts.serve(url,res))return;
 if(url.pathname==='/bundle.js'){res.setHeader('Content-Type','text/javascript');return res.end(bundle);}
 if(url.pathname==='/style.css'){res.setHeader('Content-Type','text/css');return res.end(css);}
 if(url.pathname.startsWith('/api/')){
  requests.push({method:req.method,path:url.pathname});if(req.method!=='GET'){res.statusCode=405;return reply(res,{});}
  if(url.pathname==='/api/v1/announcements/admin')return reply(res,{announcements:[{id:'update-one',title:'Membership benefits and business development programmes across Tamil Nadu',category:'notice',audience:'all',targetLabel:'Tamil Nadu, Chennai',pinned:true,status:'published',publishedAt:'2026-10-15T12:00:00Z'},{id:'update-two',title:'Regional business opportunities for members',category:'general',audience:'plans',planKeys:['student','business'],targetLabel:'All regions',status:'draft'}]});
  if(url.pathname==='/api/v1/notifications/push/status')return reply(res,{configured:false,workerEnabled:true,devices:0,queued:38,broadcasts:0,failed:0});
  if(url.pathname==='/api/v1/notifications/delivery-status')return reply(res,{email:{configured:true,host:'smtp.example.test',user:'membership@example.test',from:'ACTIV Membership <membership@example.test>'},whatsapp:{configured:true,providerLabel:'WhatsApp',baseUrl:'https://graph.facebook.com/v22.0',templateEndpoint:'/messages',authStyle:'Bearer',webhookConfigured:true}});
  if(url.pathname==='/api/v1/notifications/health')return reply(res,{email:{ok:true},autoRetry:{enabled:true,everyMinutes:10}});
  if(url.pathname==='/api/v1/notifications/logs')return reply(res,{logs:messages,health:{sent:314,failed:189,queued:0,mock:0,total:503},counts:{total:503,delivery:counts,byChannel:{email:counts,whatsapp:{...counts,accepted:134,failed:173}}},events:[{eventId:'event-fixture',title:'Business Development Programme',count:503}],pagination:{page:1,pages:1,limit:25,total:1}});
  res.statusCode=404;return reply(res,{});
 }
 res.setHeader('Content-Type','text/html');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'");
 res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
try{
 if(out)await mkdir(out,{recursive:true});
 const assets=await readdir(path.join(root,'dist/assets'));css=await readFile(process.env.TEST_CSS||path.join(root,'dist/assets',assets.find(n=>/^index-.*\.css$/.test(n))),'utf8')+'\n'+fonts.css;
 const built=await build({absWorkingDir:root,bundle:true,write:false,outdir:profile,format:'iife',platform:'browser',jsx:'automatic',define:{'import.meta.env':JSON.stringify({DEV:true,VITE_API_URL:`${base}/api/v1`}), 'process.env.NODE_ENV':'"test"'},plugins:[{name:'sidebar-pane-fixture',setup(b){b.onResolve({filter:/AdminSidebar$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({resolveDir:root,loader:'jsx',contents:'export default function Sidebar(){return <aside data-fixture-sidebar className="hidden lg:block shrink-0 lg:w-[17.5rem] xl:w-[20.5rem] 2xl:w-[22rem] bg-blue-900"/>}'}));}}],stdin:{resolveDir:root,loader:'tsx',contents:`import React from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter,Routes,Route}from'react-router-dom';import Updates from './src/features/admin/super-admin/pages/Updates';import Notifications from './src/features/admin/super-admin/pages/Notifications';localStorage.setItem('role','super_admin');localStorage.setItem('token','fixture-token');createRoot(document.getElementById('root')).render(<BrowserRouter><Routes><Route path='/updates' element={<Updates/>}/><Route path='/notifications' element={<Notifications/>}/></Routes></BrowserRouter>);`}});
 bundle=built.outputFiles.find(f=>f.path.endsWith('.js')).text;css+='\n'+(built.outputFiles.find(f=>f.path.endsWith('.css'))?.text||'');
 chrome=spawn(process.env.CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--disable-background-networking','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','about:blank'],{windowsHide:true,stdio:'ignore'});
 let port;for(let i=0;i<100;i++){try{port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];if(port)break;}catch{}await pause(100);}assert(port,'Chrome starts');
 const tabs=await fetch(`http://127.0.0.1:${port}/json/list`).then(r=>r.json());ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>ws.addEventListener('open',resolve));let seq=0;const pending=new Map();
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);pending.get(m.id)?.(m);pending.delete(m.id);});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>reject(Error(method)),30000);pending.set(id,r=>{clearTimeout(timer);r.error?reject(Error(JSON.stringify(r.error))):resolve(r)});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)throw Error(r.result.exceptionDetails.exception?.description);return r.result?.result?.value;};
 const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(`Boolean(${expression})`))return;await pause(80)}throw Error(expression);};
 const click=text=>evaluate(`[...document.querySelectorAll('button')].find(b=>b.getBoundingClientRect().width&&b.textContent.trim()===${JSON.stringify(text)}).click()`);
 const inspect=async(name,width,selector)=>{
  const result=await evaluate(`(()=>{const target=document.querySelector(${JSON.stringify(selector)});const wordFits=e=>{let split=false;const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode()){const words=node.textContent.matchAll(/\\S+/g);for(const match of words){const lines=new Set();for(let i=match.index;i<match.index+match[0].length;i++){const r=document.createRange();r.setStart(node,i);r.setEnd(node,i+1);lines.add(Math.round(r.getBoundingClientRect().top));}if(lines.size>1)split=true;}}return !split;};const shape=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{text:e.textContent.trim(),width:r.width,height:r.height,left:r.left,right:r.right,fontSize:s.fontSize}};return{width:innerWidth,pane:target.getBoundingClientRect().width,pageOverflow:document.documentElement.scrollWidth>innerWidth+1,controls:[...document.querySelectorAll('button,input,select')].filter(e=>e.getBoundingClientRect().width).map(e=>({...shape(e),clipped:e.tagName==='BUTTON'&&(e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1)})),poppins:document.fonts.check('600 20px Poppins'),headings:[...document.querySelectorAll('h2')].map(e=>({text:e.textContent.trim(),wordsFit:wordFits(e)})),layout:getComputedStyle(target.querySelector('table')||target).display}})()`);
  reports.push({name,...result});if(out)await writeFile(path.join(out,'verification.json'),JSON.stringify({reports,errors,requests},null,2));
  assert(!result.pageOverflow,`${name}/${width}: no page overflow`);assert(result.poppins,'Poppins loads');assert(result.headings.every(h=>h.wordsFit),`${name}/${width}: headings retain whole words ${JSON.stringify(result.headings)}`);assert.deepEqual(result.controls.filter(c=>c.clipped),[],`${name}/${width}: buttons fit`);
  if(out){await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'start'})`);await pause(70);const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,`${name}-${width}.png`),Buffer.from(shot.result.data,'base64'));}
 };
 await send('Runtime.enable');await send('Network.enable');await send('Network.setBlockedURLs',{urls:['https://*']});
 for(const width of [320,390,768,1024,1440,1920]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:width<600});await send('Page.navigate',{url:base+'/updates'});await until('document.querySelector(".admin-updates-records tbody tr")');await evaluate('document.fonts.ready');await pause(80);
  await inspect('updates',width,'.admin-updates-records');
  const actions=await evaluate(`(()=>{const boxes=[...document.querySelector('.admin-update-actions').children].map(e=>e.getBoundingClientRect());const size=2.75*parseFloat(getComputedStyle(document.documentElement).fontSize);return boxes.every(r=>Math.abs(r.width-size)<1&&Math.abs(r.height-size)<1)&&boxes.every(r=>r.top===boxes[0].top)})()`);assert(actions,`${width}: three update actions remain aligned at the historical page scale`);
  await send('Page.navigate',{url:base+'/notifications'});await until('document.body.textContent.includes("Alexandra Prakash")');await evaluate('document.fonts.ready');await pause(80);
  const notificationType=await evaluate(`(()=>{const size=e=>parseFloat(getComputedStyle(e).fontSize);const label=[...document.querySelectorAll('button span')].find(e=>e.textContent==='Sent'&&!e.children.length);return{root:size(document.documentElement),pushStatus:size(document.querySelector('section[aria-label="Mobile push notifications"] p')),label:size(label),figure:size(label.closest('button').querySelector('.tabular-nums'))}})()`);
  assert.equal(notificationType.root,width<640?14:16,`${width}: historical root scale`);assert.equal(notificationType.pushStatus,width<640?12.25:14,`${width}: original push status text`);assert.equal(notificationType.label,width<640?13.125:18,`${width}: original automation stat labels`);assert.equal(notificationType.figure,width<640?21:34,`${width}: original automation stat values`);
  await inspect('notifications-automation',width,'[aria-label="Message category"]');await click('Retry all failed');await inspect('notifications-retry',width,'[aria-label="Message category"]');await click('Cancel');
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.getBoundingClientRect().width&&b.textContent.includes('Delivery log')).click()`);await until('document.querySelector("[data-admin-stat]")');await inspect('notifications-log',width,'[data-admin-stat]');
 }
 assert(requests.every(r=>r.method==='GET'),'Read-only fixtures never send/delete');assert.deepEqual(errors,[]);if(out)await writeFile(path.join(out,'verification.json'),JSON.stringify({passed:true,reports,errors,requests},null,2));
 console.log(`PASS: ${reports.length} Updates/Notifications layouts including sidebar pane widths; Poppins, aligned controls, local GET-only fixtures.`);await send('Browser.close');
}finally{ws?.close();chrome?.kill();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));if(path.resolve(profile).startsWith(path.resolve(tmpdir())+path.sep+'activ-admin-secondary-'))await rm(profile,{recursive:true,force:true,maxRetries:4,retryDelay:200}).catch(()=>{});}
