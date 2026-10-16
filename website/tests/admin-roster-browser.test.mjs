import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import loadConfig from 'tailwindcss/loadConfig.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'activ-admin-roster-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const fontRoot=path.resolve(root,'../artifacts');
const layouts=[];
let bundle = '', css = '', chrome, ws;
const server = http.createServer(async (req, res) => {
  if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
  if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
  if(/^\/font-restore-poppins-[0-5]\.ttf$/.test(req.url)){res.setHeader('Content-Type','font/ttf');return res.end(await readFile(path.join(fontRoot,req.url.slice(1))));}
  res.end('<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  if(process.env.TEST_ARTIFACTS)await mkdir(process.env.TEST_ARTIFACTS,{recursive:true});
  if(process.env.TEST_CSS)css=await readFile(path.resolve(process.env.TEST_CSS),'utf8');
  else{
    let inputCss=await readFile(path.join(root,'src/index.css'),'utf8');
    for(const match of [...inputCss.matchAll(/@import ['"](.+?)['"];?/g)])inputCss=inputCss.replace(match[0],await readFile(path.resolve(root,'src',match[1]),'utf8'));
    const config=loadConfig(path.join(root,'tailwind.config.ts'));config.content=[path.join(root,'src/**/*.{ts,tsx}')];
    css=(await postcss([tailwind(config)]).process(inputCss,{from:path.join(root,'src/index.css')})).css;
  }
  for(let i=0;i<6;i++)css+=`\n@font-face{font-family:Poppins;font-style:normal;font-weight:${400+i*100};src:url('/font-restore-poppins-${i}.ttf') format('truetype');font-display:block}`;
  const fixturePlugin = { name: 'fixture-api', setup(b) {
    const names = ['@/services/activApi', './AdminSidebar'];
    b.onResolve({filter:/.*/}, args => names.includes(args.path) ? {path:args.path,namespace:'fixture'} : undefined);
    b.onLoad({filter:/.*/,namespace:'fixture'}, args => ({loader:'tsx',resolveDir:root,contents:
      args.path === './AdminSidebar' ? 'export default function Sidebar() {return <aside className="hidden lg:block lg:w-[17.5rem] xl:w-[20.5rem] 2xl:w-[22rem] shrink-0 bg-blue-950 text-white p-6 font-bold">ACTIV<br/>Super Admin</aside>}' : `
      window.rosterRequests=[];window.staffRequests=0;window.requestDelay=0;
      const roles=['state_admin','district_admin','block_admin'];
      const rows=Array.from({length:8184},(_,i)=>({id:String(i),fullName:'Regional '+String(i).padStart(5,'0'),email:'fixture-'+i+'@example.test',role:roles[i%3],active:true,state:i%2?'Tamil Nadu':'Kerala',district:i%2?'Chennai':'Kollam',block:'Guindy',region:i%2?'Guindy, Chennai, Tamil Nadu':'Kollam, Kerala',coAdmins:0}));
      export async function listAdmins(params,signal){
        window.rosterRequests.push({...params});
        if(window.requestDelay)await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,window.requestDelay);signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new Error('cancelled'))},{once:true});});
        let filtered=rows.filter(row=>(!params.state||row.state===params.state)&&(!params.district||row.district===params.district)&&(!params.block||row.block===params.block));
        const counts={all:filtered.length,state_admin:0,district_admin:0,block_admin:0};filtered.forEach(row=>counts[row.role]++);
        if(params.role)filtered=filtered.filter(row=>row.role===params.role);
        if(params.q)filtered=filtered.filter(row=>(row.fullName+' '+row.email+' '+row.region).toLowerCase().includes(params.q.toLowerCase()));
        const pages=Math.max(1,Math.ceil(filtered.length/params.limit)),page=Math.min(params.page,pages);
        return {admins:filtered.slice((page-1)*params.limit,page*params.limit),counts,total:filtered.length,pagination:{page,limit:params.limit,pages,total:filtered.length}};
      }
      export const listStaffAccounts=async()=>{window.staffRequests++;return[{id:'staff-1',fullName:'Content desk',email:'cms@example.test',role:'cms_admin',roleLabel:'CMS Administrator',active:true},{id:'staff-2',fullName:'Events desk',email:'events@example.test',role:'events_admin',roleLabel:'Events Administrator',active:true},{id:'staff-3',fullName:'Attendance desk',email:'attendance@example.test',role:'attendance_admin',roleLabel:'Attendance Administrator',active:true}]};
      export const getRegionTree=async()=>({states:[{name:'Tamil Nadu',districts:[{name:'Chennai',blocks:[{name:'Guindy'}]}]},{name:'Kerala',districts:[{name:'Kollam',blocks:[{name:'Guindy'}]}]}]});
      export const createAdmin=async()=>({}); export const updateAdmin=async()=>({}); export const deleteAdmin=async()=>({}); export const updateStaffAccount=async()=>({}); export const previewAdminRemoval=async()=>({}); export const suggestAdminRegions=async()=>({}); export const errorMessage=e=>e.message;
      `
    }));
  }};
  const built=await build({absWorkingDir:root,bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',plugins:[fixturePlugin],define:{'import.meta.env':'{"DEV":true}','process.env.NODE_ENV':'"test"'},stdin:{resolveDir:root,loader:'tsx',contents:`
    import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';
    import Screen from './src/features/admin/super-admin/pages/ManageAdmins';
    createRoot(document.getElementById('root')).render(<MemoryRouter><Screen/></MemoryRouter>);
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
  const click=label=>evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`);
  const search=value=>evaluate(`(()=>{const input=document.querySelector('[aria-label="Search admins"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}`});
  await until('document.querySelectorAll("tbody tr").length===25');
  await evaluate('document.fonts.ready');
  await pause(500);
  assert.equal(await evaluate('window.rosterRequests.length'),1,'one initial roster request');
  assert.equal(await evaluate('window.rosterRequests[0].limit'),25);
  assert.equal(await evaluate('window.rosterRequests[0].kind'),'regional');
  assert.equal(await evaluate('window.staffRequests'),1);
  assert(await evaluate('document.body.innerText.includes("8184 regional accounts")'),'pagination shows the total matches, not just the loaded rows');
  assert(await evaluate('Number(getComputedStyle(document.querySelector("[aria-label=\\"Search admins\\"]")).fontWeight)>=700'));
  assert(await evaluate('Number(getComputedStyle(document.querySelector("[aria-label=\\"Filter by state\\"]")).fontWeight)>=700'));
  await click('Next');await until('window.rosterRequests.at(-1).page===2 && document.body.innerText.includes("Regional 00025")');
  await search('Regional 08183');await until('document.querySelectorAll("tbody tr").length===1 && document.body.innerText.includes("Regional 08183")');
  assert.equal(await evaluate('window.rosterRequests.at(-1).page'),1,'search resets to the first page');
  await search('');await until('document.querySelectorAll("tbody tr").length===25');
  const calls=await evaluate('window.rosterRequests.length');
  await click('Staff (3)');await until('document.querySelectorAll("tbody tr").length===0 && document.body.innerText.includes("Content desk")');
  assert.equal(await evaluate('window.rosterRequests.length'),calls,'staff does not load the regional roster');
  assert(await evaluate('!document.querySelector("[aria-label=\\"Filter by state\\"]")'));
  await search('Attendance');await until('document.querySelectorAll("article").length===1 && document.body.innerText.includes("Attendance desk")');
  assert.equal(await evaluate('window.rosterRequests.length'),calls,'staff search stays in the small staff list');
  await search('');await until('document.querySelectorAll("article").length===3');
  await pause(200);
  if(process.env.TEST_ARTIFACTS){const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(path.join(process.env.TEST_ARTIFACTS,'admin-staff-desktop.png'),Buffer.from(shot.result.data,'base64'));}
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'mobile view fits');
  if(process.env.TEST_ARTIFACTS){const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(path.join(process.env.TEST_ARTIFACTS,'admin-staff-mobile.png'),Buffer.from(shot.result.data,'base64'));}
  await click('All (8187)');await until('document.querySelectorAll("tbody tr").length===25');
  await evaluate(`(()=>{const input=document.querySelector('[aria-label="Filter by state"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(input,'Tamil Nadu');input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await until('window.rosterRequests.at(-1).state==="Tamil Nadu" && document.querySelectorAll("tbody tr").length===25');
  assert(await evaluate('[...document.querySelectorAll("tbody tr")].every(row=>row.innerText.includes("Tamil Nadu"))'));
  assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'mobile table cards fit');
  for(const width of [1440,390,320]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:940,deviceScaleFactor:1,mobile:width<600});
    await evaluate('document.querySelector("table").scrollIntoView({block:"start"})');await pause(80);
    const result=await evaluate(`(()=>{const row=document.querySelector('tbody tr');return{width:innerWidth,scrollWidth:document.documentElement.scrollWidth,rootSize:parseFloat(getComputedStyle(document.documentElement).fontSize),bodySize:parseFloat(getComputedStyle(document.body).fontSize),bodyFont:getComputedStyle(document.body).fontFamily,poppinsLoaded:document.fonts.check('600 20px Poppins'),columns:getComputedStyle(row.cells[0]).gridTemplateColumns,cells:[...row.cells].map(el=>({text:el.textContent,clientWidth:el.clientWidth,scrollWidth:el.scrollWidth})),buttons:[...row.querySelectorAll('button')].map(el=>{const r=el.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,width:r.width,height:r.height}})}})()`);
    assert(result.scrollWidth<=width+1,'Roster page fits at '+width);
    assert(result.cells.every(cell=>cell.scrollWidth<=cell.clientWidth+1),'Roster values fit their cells at '+width);
    assert(result.buttons.every(button=>button.left>=-1&&button.right<=width+1),'Roster actions stay visible at '+width);
    if(width<420)assert.equal(result.columns.split(' ').length,1,'Phone roster fields stack above their values');
    assert.equal(result.buttons[0].top,result.buttons[1].top,'Edit and Delete stay side by side');
    assert(result.buttons.every(button=>button.width>=44&&button.height>=44),'Roster actions have comfortable touch targets');
    assert.equal(result.rootSize,width<640?14:16,'Original b0111a3 root scale');
    assert.equal(result.bodySize,width<640?14:16,'Body follows original root scale');
    assert(result.poppinsLoaded&&result.bodyFont.includes('Poppins'),'Actual original Poppins loaded');layouts.push(result);
    if(process.env.TEST_ARTIFACTS){const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(process.env.TEST_ARTIFACTS,'admin-roster-'+width+'.png'),Buffer.from(shot.result.data,'base64'));}
  }
  assert.deepEqual(errors,[]);
  if(process.env.TEST_ARTIFACTS)await writeFile(path.join(process.env.TEST_ARTIFACTS,'verification.json'),JSON.stringify({layouts,errors,checks:'bounded initial load, next page, full-roster search, first-page reset, staff shortcut/search, region filters',css:process.env.TEST_CSS||'generated from current source',fonts:'local Poppins'},null,2));
  console.log('PASS: bounded initial load, next page, full-roster search, first-page reset, Staff shortcut and search, region filters, original Poppins scale, 44px actions and desktop/mobile layout.');
  await send('Browser.close');
} finally {
  ws?.close();chrome?.kill();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  if(path.resolve(profile).startsWith(path.resolve(tmpdir())+path.sep+'activ-admin-roster-'))await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200}).catch(()=>{});
}
