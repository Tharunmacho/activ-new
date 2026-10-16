// Actual CMS editor/API client and public header; all writes use a loopback fixture.
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
const output = path.resolve(process.env.TEST_ARTIFACTS || '../artifacts/header-navigation-20261016');
const fonts = await localTypographyFonts(root);
const profile = await mkdtemp(path.join(tmpdir(), 'activ-header-navigation-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const original = [['Home','/'],['About','/about'],['Membership','/membership'],['Events','/events'],['News','/news'],['Schemes','/schemes'],['Gallery','/gallery'],['Contact Us','/contact']].map(([label,href])=>({label,href}));
let site = { brand:{ fullName:'Adidravidar Confederation of Trade and Industrial Vision',logo:{url:'/logo_ACTIVian-removebg-preview.png',type:'image',fit:'contain'},tagline:'' },
  header:{navLinks:original,ctaLabel:'Login',ctaHref:'/login',background:'#ffffff',textColor:'#1c2e68'},
  footer:{phones:['+919000000000'],email:'fixture@example.test',socials:[],addressLines:[],linkColumns:[],legalLinks:[]},sections:[],extraFields:[] };
const social = { facebook:'https://facebook.com/fixture',instagram:'https://instagram.com/fixture',x:'https://x.com/fixture',linkedin:'https://linkedin.com/company/fixture',youtube:'https://youtube.com/@fixture',whatsapp:'https://wa.me/919000000000',telegram:'https://t.me/fixture',threads:'https://threads.com/@fixture' };
const regions = [{key:'national',label:'National',slug:'national',national:true,hasPage:true,states:[]},
  {key:'south',label:'South',slug:'south',hasPage:true,states:[{name:'Tamil Nadu',slug:'tamil-nadu',hasPage:true},{name:'Unpublished',slug:'unpublished',hasPage:false}]}];
let bundle='',css='',chrome,ws;
const writes=[],errors=[],layouts=[];
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    if(fonts.serve(url,res))return;
    if(url.pathname==='/bundle.js'){res.setHeader('Content-Type','text/javascript');return res.end(bundle);}
    if(url.pathname==='/style.css'){res.setHeader('Content-Type','text/css');return res.end(css);}
    if(url.pathname==='/logo_ACTIVian-removebg-preview.png'){res.setHeader('Content-Type','image/png');return res.end(await readFile(path.join(root,'public',url.pathname.slice(1))));}
    if(url.pathname.startsWith('/api/')){
      res.setHeader('Content-Type','application/json');
      let data;
      if(url.pathname.endsWith('/cms/site')){
        if(req.method==='PUT'){
          let body='';for await(const chunk of req)body+=chunk;
          const payload=JSON.parse(body);writes.push(payload);
          site={...site,...payload,header:payload.header?{...site.header,...payload.header}:site.header};
        }
        data=site;
      }else if(url.pathname.endsWith('/cms/contact-info'))data={phone:'+919000000000',email:'fixture@example.test',social,offices:[]};
      else if(url.pathname.endsWith('/cms/regions/map'))data={regions};
      else if(url.pathname.endsWith('/cms/legal/links'))data=[];
      else if(url.pathname.endsWith('/cms/schemes/states'))data=[{state:'Tamil Nadu',total:1}];
      else {errors.push(`Unexpected API ${req.method} ${url.pathname}`);res.statusCode=404;}
      return res.end(JSON.stringify({success:data!==undefined,data}));
    }
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'");
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  }catch(error){errors.push(error.message);res.statusCode=500;res.end(error.message);}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
try{
  await mkdir(output,{recursive:true});
  let source=await readFile(path.join(root,'src/index.css'),'utf8');
  for(const file of ['mobile-styles.css','background.css'])source=source.replace(`@import './components/ui/${file}';`,await readFile(path.join(root,'src/components/ui',file),'utf8'));
  css=(process.env.TEST_CSS
    ? await readFile(path.resolve(process.env.TEST_CSS),'utf8')
    : (await postcss([tailwindcss({config:path.join(root,'tailwind.config.ts')})]).process(source,{from:path.join(root,'src/index.css')})).css)+'\n'+fonts.css;
  await writeFile(path.join(output,'current.css'),css);
  const compiled=await build({absWorkingDir:root,bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',loader:{'.svg':'dataurl'},
    define:{'import.meta.env':JSON.stringify({DEV:true,VITE_API_URL:base+'/api/v1'}),'process.env.NODE_ENV':'"test"'},
    stdin:{resolveDir:root,loader:'tsx',contents:`import React from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';import SiteSettingsManager from './src/pages/cms/SiteSettingsManager';import{HeaderSection}from'./src/components/layout/HeaderSection';import{headerNavigationLinks}from'./src/components/shared/headerNavigation';window.normalizeNavigation=headerNavigationLinks;createRoot(document.getElementById('root')).render(<BrowserRouter>{location.pathname.startsWith('/cms/')?<SiteSettingsManager/>:<><HeaderSection/><main style={{padding:24}}>Public page fixture</main></>}</BrowserRouter>);`}});
  bundle=compiled.outputFiles[0].text;
  chrome=spawn(process.env.CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--disable-background-networking','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','about:blank'],{windowsHide:true,stdio:'ignore'});
  let port;for(let i=0;i<100;i++){try{port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];if(port)break;}catch{}await pause(100);}
  assert(port,'Chrome starts');
  const tabs=await fetch(`http://127.0.0.1:${port}/json/list`).then(r=>r.json());
  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>ws.addEventListener('open',resolve));
  let sequence=0;const pending=new Map();
  ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);pending.get(m.id)?.(m);pending.delete(m.id);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>reject(Error(method)),20000);pending.set(id,r=>{clearTimeout(timer);r.error?reject(Error(JSON.stringify(r.error))):resolve(r);});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)throw Error(r.result.exceptionDetails.exception?.description);return r.result?.result?.value;};
  const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(`Boolean(${expression})`))return;await pause(60);}throw Error(expression+errors.join('\n'));};
  const navigate=async(url,width,height=900)=>{await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});await send('Page.navigate',{url:base+url});};
  const screenshot=async name=>writeFile(path.join(output,name+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
  const inspectClosedHeader=async(width,height)=>{
    await evaluate('document.fonts.ready');
    const layout=await evaluate(`(()=>{
      const rect=e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,width:r.width,height:r.height,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth};};
      const header=document.querySelector('header'),bell=header.querySelector('a[aria-label="Notifications"]'),login=header.querySelector('a[href="/login"]'),brand=header.querySelector('a[aria-label="ACTIV home"]'),menu=header.querySelector('button[aria-label="Open menu"]');
      return{kind:'closed-header',width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,bell:rect(bell),login:rect(login),brand:rect(brand),logo:rect(brand.querySelector('img')),menu:menu?rect(menu):null};
    })()`);
    layouts.push(layout);
    await screenshot(`closed-header-${width}-${height}`);
    assert(layout.scrollWidth<=width,'Closed header fits viewport');
    assert(layout.bell.width>=44&&layout.bell.height>=44,'Notification bell has44px touch target');
    assert(layout.bell.left>=layout.logo.right,'Bell does not overlap logo');
    assert(layout.login.left>=layout.bell.right&&layout.login.right<=width,'Bell and login do not overlap or overflow');
    assert(layout.login.scrollWidth<=layout.login.clientWidth+1,'Login label is not clipped');
  };
  await send('Runtime.enable');
  await navigate('/cms/site',1440);
  await until('document.querySelector("[data-navigation-entry=zones]")');
  assert.deepEqual(await evaluate('window.normalizeNavigation([])'),[],'Empty legacy navigation remains empty');
  assert.deepEqual(await evaluate('window.normalizeNavigation([{label:null,href:"/regions/"},{label:"Duplicate",href:"/regions"}])'),[{label:'Zones',href:'/regions'}],'Legacy label and duplicate menu handled');
  assert.equal(await evaluate('document.querySelectorAll("[data-navigation-entry]").length'),9,'Legacy Zones entry joins the CMS list');
  for(let i=0;i<8;i++){await evaluate('document.querySelector("button[aria-label=\\"Move Zones up\\"]").click()');await pause(30);}
  assert.equal(await evaluate('document.querySelector("[data-navigation-entry]").dataset.navigationEntry'),'zones');
  await evaluate('[...document.querySelectorAll("button")].find(e=>!e.disabled&&e.textContent.trim()==="Save page").click()');
  await until('!document.body.textContent.includes("Saving…")');
  for(let i=0;i<50&&!writes.length;i++)await pause(50);
  assert.equal(writes.length,1,'CMS save performs one write');
  assert.equal(writes[0].header.navLinks[0].href,'/regions','Saved payload puts Zones first');
  await navigate('/cms/site',390);
  await until('document.querySelector("[data-navigation-entry=zones]")');
  assert.equal(await evaluate('document.querySelector("[data-navigation-entry]").dataset.navigationEntry'),'zones','CMS reload retains saved order');
  await evaluate('document.fonts.ready');
  await evaluate('document.querySelector("[data-navigation-editor]").scrollIntoView({block:"start"})');
  await pause(80);
  assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'CMS editor fits mobile width');
  await screenshot('cms-zones-first-390');
  for(const width of [1280,1440]){
    await navigate('/',width);await until('document.querySelector("[data-zones-menu]")');await evaluate('document.fonts.ready');
    await inspectClosedHeader(width,900);
    assert(await evaluate('document.querySelector("nav[aria-label=Main]").firstElementChild.hasAttribute("data-zones-menu")'),'Desktop renders stored order');
    await evaluate('document.querySelector("[data-zones-menu] > button").click()');await pause(120);
    const layout=await evaluate('(()=>{const menu=document.querySelector("[data-zones-menu] > div"),r=menu.getBoundingClientRect();return{width:innerWidth,scrollWidth:document.documentElement.scrollWidth,menuLeft:r.left,menuRight:r.right,text:menu.textContent};})()');
    layouts.push(layout);assert(layout.scrollWidth<=width);assert(layout.menuLeft>=0&&layout.menuRight<=width,'Moved dropdown fits viewport');assert(layout.text.includes('South'));
    await screenshot('desktop-zones-first-'+width);
  }
  for(const [width,height] of [[320,568],[390,600],[390,844],[768,700]]){
    await navigate('/',width,height);await until('document.querySelector("button[aria-label=\\"Open menu\\"]")');
    await inspectClosedHeader(width,height);
    await evaluate('document.querySelector("button[aria-label=\\"Open menu\\"]").click()');
    await until('document.querySelectorAll("[aria-label=Menu] a[aria-label^=\\"ACTIV on\\"]").length===8');await evaluate('document.fonts.ready');await pause(500);
    assert(await evaluate('document.querySelector("[aria-label=Menu] nav").firstElementChild.querySelector("[data-zones-accordion]")!==null'),'Mobile renders stored Zones order');
    const layout=await evaluate('(()=>{const pane=document.querySelector("[data-mobile-menu-scroll]"),nav=pane.querySelector("nav"),r=pane.getBoundingClientRect();return{width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,paneWidth:r.width,paneHeight:r.height,scrollHeight:pane.scrollHeight,navOverflow:getComputedStyle(nav).overflowY,rootSize:getComputedStyle(document.documentElement).fontSize,fonts:getComputedStyle(nav).fontFamily,socialCount:pane.querySelectorAll("a[aria-label^=\\"ACTIV on\\"]").length,bodyLocked:document.body.style.overflow,closeHeight:pane.querySelector("button[aria-label=\\"Close menu\\"]").getBoundingClientRect().height};})()');
    layouts.push(layout);assert(layout.scrollWidth<=width);assert.equal(layout.navOverflow,'visible');assert(layout.scrollHeight>layout.paneHeight,'One pane scrolls all content');assert.equal(layout.socialCount,8);assert.equal(layout.bodyLocked,'hidden');assert(layout.closeHeight>=44);assert(layout.fonts.includes('Poppins'));
    await screenshot(`mobile-menu-${width}-${height}-top`);
    await evaluate('document.querySelector("[data-mobile-menu-scroll]").scrollTop=99999');await pause(80);
    const foot=await evaluate('(()=>{const pane=document.querySelector("[data-mobile-menu-scroll]"),links=[...pane.querySelectorAll("a")].filter(e=>e.getAttribute("href")==="/login"||/^tel:|^mailto:/.test(e.getAttribute("href")));return links.map(e=>{const r=e.getBoundingClientRect();return{label:e.textContent.trim(),top:r.top,bottom:r.bottom,height:r.height};});})()');
    assert.equal(foot.length,3);assert(foot.every(x=>x.height>=44&&x.top>=0&&x.bottom<=height),'Contact/login are reachable and at least44px');
    await screenshot(`mobile-menu-${width}-${height}-bottom`);
    await evaluate('document.querySelector("[data-mobile-menu-scroll]").scrollTop=0');
    await evaluate('[...document.querySelectorAll("[data-zones-accordion] button")].find(e=>e.textContent.includes("South")).click()');
    await until('document.querySelector("[aria-label=Menu] a[href=\\"/states/tamil-nadu\\"]")');
    assert.equal(await evaluate('document.querySelector("[aria-label=Menu] a[href=\\"/states/unpublished\\"]")'),null,'Unpublished children stay hidden');
    await evaluate('document.querySelector("[aria-label=Menu] a[href=\\"/states/tamil-nadu\\"]").click()');
    await until('!document.querySelector("[aria-label=Menu]")');
    assert.equal(await evaluate('location.pathname'),'/states/tamil-nadu');assert.equal(await evaluate('document.body.style.overflow'),'','Navigation releases page scroll');
  }
  assert.deepEqual(errors,[]);
  await writeFile(path.join(output,'verification.json'),JSON.stringify({checkedAt:new Date().toISOString(),writes,layouts,errors,requests:'Loopback only; no production data changed'},null,2));
  console.log('PASS: actual CMS Zones reorder/save/reload, desktop/mobile order and generated children, short-phone single-scroll drawer with eight social icons and44px controls.');
  await send('Browser.close');
}finally{
  await writeFile(path.join(output,'layouts.json'),JSON.stringify({layouts,errors,writes},null,2)).catch(()=>{});
  ws?.close();chrome?.kill();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  if(path.resolve(profile).startsWith(path.resolve(tmpdir())+path.sep+'activ-header-navigation-'))await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200}).catch(()=>{});
}
