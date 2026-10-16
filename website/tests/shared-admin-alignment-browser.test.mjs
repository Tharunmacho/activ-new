import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { localTypographyFonts } from './browserTypographyFixtures.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.resolve(process.env.TEST_ARTIFACTS || '../artifacts/shared-admin-alignment-20261015');
const fonts = await localTypographyFonts(root);
const profile = await mkdtemp(path.join(tmpdir(), 'activ-admin-alignment-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let bundle = '', css = '', chrome, ws;
const reports = [], errors = [], flows = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (fonts.serve(url, res)) return;
  if (url.pathname === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
  if (url.pathname === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'");
  res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
try {
  await mkdir(output, { recursive: true });
  let sourceCss = await readFile(path.join(root, 'src/index.css'), 'utf8');
  for (const file of ['mobile-styles.css', 'background.css']) sourceCss = sourceCss.replace(`@import './components/ui/${file}';`, await readFile(path.join(root, 'src/components/ui', file), 'utf8'));
  css = (await postcss([tailwindcss({ config: path.join(root, 'tailwind.config.ts') })]).process(sourceCss, { from: path.join(root, 'src/index.css') })).css + '\n' + fonts.css;
  const compiled = await build({ absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    define: { 'import.meta.env': JSON.stringify({ DEV: true }), 'process.env.NODE_ENV': '"test"' },
    stdin: { resolveDir: root, loader: 'tsx', contents: `
      import React from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';
      import{Trash2,Download,RefreshCw}from'lucide-react';
      import{AdminTable,AdminChip}from'./src/features/admin/components/AdminTable';
      import{AdminPageHeader,ADMIN_SECONDARY_BTN}from'./src/features/admin/components/AdminUI';
      import ProfileViewModal from './src/components/ui/profile-view-modal';
      localStorage.setItem('role','super_admin');window.fixtureClicks=0;
      const rows=Array.from({length:12},(_,i)=>({id:i,name:i===1?'Alexandra Prakash':'Deleted account',email:'192424050.simats@saveetha.example.test',plan:'Student',mode:'Instamojo',status:i===1?'Paid':'Created',reference:'ord_6f0fd6164f191956c1d5357fdd42d5ea',amount:'₹500 due'}));
      const columns=[
        {key:'member',header:'Member',width:'min-w-[14rem]',sortValue:r=>r.name+' '+r.email,render:r=><div style={{maxWidth:240}}><p data-wordcheck className='font-bold'>{r.name}</p><p style={{overflowWrap:'anywhere'}}>{r.email}</p></div>},
        {key:'membership',header:'Membership',width:'min-w-[10rem]',render:r=><div><p data-wordcheck>{r.plan}</p><p data-wordcheck className='text-sm'>{r.mode}</p></div>},
        {key:'reference',header:'References',width:'min-w-[16rem]',render:r=><div style={{maxWidth:280,overflowWrap:'anywhere'}}>{r.reference}</div>},
        {key:'status',header:'Status',render:r=><AdminChip tone='amber'><span data-wordcheck>{r.status}</span></AdminChip>},
        {key:'amount',header:'Amount received',render:r=><span data-wordcheck>{r.amount}</span>},
        {key:'action',header:'Action',sticky:'right',width:'min-w-[15rem]',render:r=><button data-wordcheck className={ADMIN_SECONDARY_BTN} onClick={()=>window.fixtureClicks++}><Trash2 className='h-4 w-4'/>Delete permanently</button>}
      ];
      function FixtureTable(){const[sort,setSort]=React.useState(0);window.changeFixtureSort=()=>setSort(value=>value+1);return <AdminTable rows={sort%2?[...rows].reverse():rows} columns={columns} pageResetKey={sort} rowKey={r=>String(r.id)} searchable cardBreakpoint={1000} minWidth='1200px' searchPlaceholder='Name, email, order or payment reference'/>;}
      const compact=new URLSearchParams(location.search).has('sidebar');
      const modalProfile={fullName:'Alexandra Prakash Business Representative',email:'alexandra.prakash.long.company.reference@example.test',phoneNumber:'9000000000',block:'Anna Nagar',district:'Chennai',state:'Tamil Nadu',city:'Chennai',doingBusiness:true,memberType:'business',stage:'approved',statusLabel:'Approved',agreeToTerms:true,submittedAt:'2026-10-15T12:00:00Z'};
      createRoot(document.getElementById('root')).render(new URLSearchParams(location.search).has('profile')?<ProfileViewModal open profile={modalProfile} onClose={()=>{}}/>:<BrowserRouter><div style={{display:'flex',minHeight:'100vh'}}>
        {compact&&<aside style={{width:innerWidth>=1536?352:328,flexShrink:0,background:'#1c2e68',color:'white',padding:24}}>ACTIV<br/>Super Admin</aside>}
        <div style={{minWidth:0,flex:1}}><AdminPageHeader back={false} title='Membership registrations' subtitle='Registered accounts, applications and membership payments.' actions={<><button className={ADMIN_SECONDARY_BTN}><Download className='h-4 w-4'/>Export Excel</button><button className={ADMIN_SECONDARY_BTN}><RefreshCw className='h-4 w-4'/>Refresh</button></>}/>
        <main style={{padding:innerWidth<640?16:32}}><FixtureTable/></main></div>
      </div></BrowserRouter>);` } });
  bundle = compiled.outputFiles[0].text;
  chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    ['--headless=new', '--disable-gpu', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let port;
  for (let i = 0; i < 100; i++) { try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch {} await pause(100); }
  assert(port, 'Chrome starts');
  const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve));
  let sequence = 0; const pending = new Map();
  ws.addEventListener('message', event => { const m=JSON.parse(event.data); if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text); pending.get(m.id)?.(m); pending.delete(m.id); });
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>reject(Error(method)),20000);pending.set(id,r=>{clearTimeout(timer);r.error?reject(Error(JSON.stringify(r.error))):resolve(r)});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)throw Error(r.result.exceptionDetails.exception?.description);return r.result?.result?.value;};
  const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(`Boolean(${expression})`))return;await pause(60)}throw Error(expression+errors.join('\n'));};
  await send('Runtime.enable');
  for(const scenario of process.env.TEST_PROFILE_ONLY?[]:[{width:320},{width:390},{width:768},{width:1440,sidebar:true},{width:1558}]) {
    const {width,sidebar}=scenario;
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
    await send('Page.navigate',{url:base+'/super-admin/memberships'+(sidebar?'?sidebar=1':'')});
    await until('document.querySelector("[data-admin-table]")&&document.querySelectorAll("[data-wordcheck]").length>5');
    await evaluate('document.fonts.ready');await pause(80);
    const result=await evaluate(`(()=>{
      const visible=e=>e.getBoundingClientRect().width>0;
      const wordsFit=e=>{const walk=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let node;while(node=walk.nextNode()){let match;const words=/\\S+/g;while(match=words.exec(node.textContent)){const lines=new Set();for(let i=match.index;i<match.index+match[0].length;i++){const range=document.createRange();range.setStart(node,i);range.setEnd(node,i+1);lines.add(Math.round(range.getBoundingClientRect().top));}if(lines.size>1)return false;}}return true;};
      const shell=document.querySelector('[data-admin-table]'),scroll=document.querySelector('[data-admin-table-scroll]');
      const bad=[...document.querySelectorAll('[data-wordcheck]')].filter(visible).filter(e=>!wordsFit(e)).map(e=>e.textContent);
      const controls=[...document.querySelectorAll('button,input,select')].filter(visible).map(e=>{const r=e.getBoundingClientRect();return{text:e.textContent.trim(),left:r.left,right:r.right,height:r.height,clipped:e.tagName==='BUTTON'&&(e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1)}});
      return{width:innerWidth,scrollWidth:document.documentElement.scrollWidth,tableWidth:shell.clientWidth,mode:getComputedStyle(scroll).display==='none'?'cards':'table',tableLayout:getComputedStyle(document.querySelector('table')).tableLayout,tableScroll:scroll.scrollWidth>scroll.clientWidth,brokenWords:bad,controls,poppins:document.fonts.check('600 20px Poppins')};
    })()`);
    reports.push({...scenario,...result});
    await writeFile(path.join(output,`shared-${width}${sidebar?'-sidebar':''}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
    assert(result.scrollWidth<=width,'Page stays within viewport');assert.deepEqual(result.brokenWords,[],'Ordinary words never split');
    assert(result.controls.every(c=>!c.clipped),'Controls are not clipped');assert(result.poppins,'Poppins loads');
    assert.equal(result.tableLayout,'auto');
    if(width<1000)assert.equal(result.mode,'cards');
    const expected=await evaluate('window.fixtureClicks');
    await evaluate(`[...document.querySelectorAll('button')].find(e=>e.getBoundingClientRect().width&&e.textContent.includes('Delete permanently')).click()`);
    assert.equal(await evaluate('window.fixtureClicks'),expected+1,'Action remains functional (local counter only)');
    await evaluate(`(()=>{const e=document.querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'Alexandra');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await until('document.querySelector("[data-admin-table]").textContent.includes("1 entry")');
    assert.equal(await evaluate(`[...document.querySelectorAll('[data-wordcheck]')].filter(e=>e.getBoundingClientRect().width&&e.textContent==='Alexandra Prakash').length`),1);
    if(width===1558){
      await evaluate(`(()=>{const e=document.querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'example');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
      await until('document.querySelector("[data-admin-table]").textContent.includes("12 entries")');
      await evaluate(`[...document.querySelectorAll('button')].find(e=>e.getAttribute('aria-current')===null&&e.textContent.trim()==='2').click()`);
      await until('document.querySelector("[aria-current=page]").textContent.trim()==="2"');
      await evaluate('window.changeFixtureSort()');
      await until('document.querySelector("[aria-current=page]").textContent.trim()==="1"');
      assert.equal(await evaluate('document.querySelector("input").value'),'example','External sorting keeps the active search');
      flows.push({name:'Page-owned sorting resets page2 to page1 and retains search',passed:true});
    }
  }
  for(const width of [320,390,768]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
    await send('Page.navigate',{url:base+'/super-admin/memberships?profile=1'});
    await until('document.querySelector("[role=dialog]")&&document.body.textContent.includes("Personal details need completing")');
    await evaluate('document.fonts.ready');await pause(180);
    const result=await evaluate(`(()=>{const dialog=document.querySelector('[role=dialog]'),r=dialog.getBoundingClientRect();const controls=[...dialog.querySelectorAll('button')].map(e=>{const b=e.getBoundingClientRect();return{left:b.left,right:b.right,clipped:e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1}});return{screen:'profile',width:innerWidth,scrollWidth:document.documentElement.scrollWidth,dialog:{left:r.left,right:r.right,height:r.height},text:dialog.textContent,controls,poppins:document.fonts.check('600 20px Poppins')};})()`);
    reports.push(result);
    await writeFile(path.join(output,`profile-${width}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
    assert(result.dialog.left>=0&&result.dialog.right<=width,'Application dialog fits viewport');assert(result.dialog.height<=901,'Application dialog fits available height');
    assert(result.poppins);assert(result.controls.every(c=>c.left>=0&&c.right<=width&&!c.clipped),'Application controls fit');
    assert(result.text.includes('Not recorded: Gender, Religion, Social category.'),'Missing data is explained honestly');
    assert(result.text.includes('Approved')&&result.text.includes('Business Member'),'Existing identity and approval remain visible');
    assert.equal((result.text.match(/Not provided/g)||[]).length,3,'All three missing values stay distinguishable');
    await evaluate(`(()=>{const row=[...document.querySelectorAll('dt')].find(e=>e.textContent==='Gender');row?.scrollIntoView({block:'center'});})()`);
    await pause(50);await writeFile(path.join(output,`profile-fields-${width}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
  }
  assert.deepEqual(errors,[]);
  await writeFile(path.join(output,'verification.json'),JSON.stringify({checkedAt:new Date().toISOString(),reports,flows,errors,requests:'Loopback fixture only; delete is a local counter'},null,2));
  console.log('PASS shared AdminTable/AdminUI and profile details: responsive Poppins layouts; whole words, responsive cards, local action/search; missing demographics notice and approved identity fit320/390/768.');
  await send('Browser.close');
} finally {
  await writeFile(path.join(output,'layouts.json'),JSON.stringify(reports,null,2)).catch(()=>{});
  ws?.close();chrome?.kill();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  if(path.resolve(profile).startsWith(path.resolve(tmpdir())+path.sep+'activ-admin-alignment-'))await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200}).catch(()=>{});
}
