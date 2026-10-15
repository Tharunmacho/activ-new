import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'activ-booking-filters-'));
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
  css = await readFile(path.join(root, 'dist/assets', assets.find(f => /^index-.*\.css$/.test(f))), 'utf8');
  const sources = {
    './AdminSidebar': 'export default ()=>null;',
    '@/services/api': 'export const errorMessage=(e,f)=>e.message||f;',
    '@/features/admin/components/tierConfig': 'export const adminBasePath=()=>"/super-admin";',
    '@/services/spreadsheetDownload': 'export const downloadSpreadsheet=async(path,name,filters)=>{window.fixtureExport={path,filters}};',
    '@/services/eventBookingAdminApi': `
      window.fixtureRequests=[];
      const totals={events:1,seats:4,capacity:100,bookings:4,collected:0,pending:0};
      const row={title:'Training programme',id:'event-one',category:'Training',venue:'Chennai',startAt:'2026-10-30T03:30:00Z',price:0,totalSeats:100,bookedSeats:4,remainingSeats:96,collected:0,bookings:4,status:'published',registrationEnabled:true};
      export const listBookingOverview=async(drafts,filters={})=>{window.fixtureRequests.push({kind:'overview',filters});return {
        events:[{...row,historyCategory:filters.history||'current',title:(filters.history||'current')+' training'}],
        totals,historyTotals:{current:totals,past:totals,deleted:totals},
        filterOptions:{categories:['Training','Conference'],languages:['Tamil','English'],states:['Tamil Nadu','Karnataka'],
          districts:[{state:'Tamil Nadu',name:'Chennai'},{state:'Karnataka',name:'Bengaluru'}],cities:['Chennai','Madurai'],attendeeStates:['Tamil Nadu'],questions:[{key:'business-1',label:'Business activity'}]}}};
      export const listBookingPeople=async(search,filters)=>{window.fixtureRequests.push({kind:'people',filters});return {people:[],total:0}};
      export const getBookingPerson=async()=>({bookings:[]});
    `,
  };
  const result = await build({ absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    define: { 'import.meta.env': '{"DEV":true}', 'process.env.NODE_ENV': '"test"' },
    plugins: [{ name: 'booking-fixture', setup(b) {
      b.onResolve({ filter: /.*/ }, args => args.path in sources ? { path: args.path, namespace: 'fixture' } : undefined);
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: sources[args.path], loader: 'tsx', resolveDir: root }));
    } }], stdin: { resolveDir: root, loader: 'tsx', contents: `
      import React from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter,Routes,Route,useLocation}from'react-router-dom';
      import Bookings from './src/features/admin/super-admin/pages/BookingEvents';
      function Target(){const at=useLocation();return <p data-target>{at.pathname+at.search}</p>}
      createRoot(document.getElementById('root')).render(<BrowserRouter><Routes><Route path='/super-admin/bookings' element={<Bookings/>}/><Route path='*' element={<Target/>}/></Routes></BrowserRouter>);
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
  for(const width of [1440,390,320]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
    await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/super-admin/bookings'});
    await until('document.body.innerText.includes("current training")');
    await click('Past');await until('document.body.innerText.includes("past training")');
    assert(!(await evaluate('document.body.innerText.includes("current training")')));
    await evaluate('document.querySelector("summary").click()');
    await select('Category','Training');await select('Event language','Tamil');await select('Attendance mode','offline');
    await select('Event state / region','Tamil Nadu');await select('Event district','Chennai');await select('City / town (registration)','Chennai');
    await click('Apply filters');
    await until('window.fixtureRequests.at(-1)?.filters.city==="Chennai"');
    const applied=await evaluate('window.fixtureRequests.at(-1).filters');
    assert.equal(applied.history,'past');assert.equal(applied.category,'Training');assert.equal(applied.language,'Tamil');assert.equal(applied.district,'Chennai');
    const bounds=await evaluate('[...document.querySelectorAll("details input,details select")].map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right}})');
    assert(bounds.every(r=>r.left>=0&&r.right<=width),'all filter controls fit '+width);
    assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
    await click('Download filtered Excel');
    assert.deepEqual((await evaluate('window.fixtureExport')).filters,applied,'Excel uses the applied criteria');
    await click('People');await until('window.fixtureRequests.some(r=>r.kind==="people")');
    assert.deepEqual(await evaluate('window.fixtureRequests.filter(r=>r.kind==="people").at(-1).filters'),applied,'People respects history and filters');
    await click('Old');await until('window.fixtureRequests.filter(r=>r.kind==="people").at(-1)?.filters.history==="deleted"');
    if(process.env.TEST_ARTIFACTS){const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(process.env.TEST_ARTIFACTS,'booking-filters-'+width+'.png'),Buffer.from(shot.result.data,'base64'));}
    await click('Clear filters');await until('Object.keys(window.fixtureRequests.filter(r=>r.kind==="people").at(-1)?.filters||{}).length===1');
  }
  assert.deepEqual(errors,[]);console.log('PASS real booking screen at 320/390/1440px: history switching, dependent region selectors, filters, people scope and matching Excel requests.');
  await send('Browser.close');
}finally{
  ws?.close();chrome?.kill();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  if(path.resolve(profile).startsWith(path.resolve(tmpdir())+path.sep+'activ-booking-filters-'))await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200}).catch(()=>{});
}
