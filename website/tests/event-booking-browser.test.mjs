import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'activ-event-booking-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const output = process.env.TEST_ARTIFACTS ? path.resolve(process.env.TEST_ARTIFACTS) : null;
const layouts = [];
let bundle = '', css = '', chrome, ws;
const server = http.createServer(async (req, res) => {
    if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
    if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
    if (/^\/font-restore-poppins-[0-5]\.ttf$/.test(req.url)) { res.setHeader('Content-Type','font/ttf'); return res.end(await readFile(path.join(root,'../artifacts',req.url.slice(1)))); }
    res.end('<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
    if (output) await mkdir(output, { recursive: true });
    try { const assets = await readdir(path.join(root, 'dist/assets')); css = await readFile(path.join(root, 'dist/assets', assets.find(file => /^index-.*\.css$/.test(file))), 'utf8'); } catch {}
    for (let i=0;i<6;i++) css += `\n@font-face{font-family:Poppins;font-style:normal;font-weight:${400+i*100};src:url('/font-restore-poppins-${i}.ttf') format('truetype');font-display:block}`;
    const fixtures = { name: 'booking-fixtures', setup(b) {
        b.onResolve({ filter: /(?:services\/(?:api|activApi|eventBookingApi|cmsApi)|lib\/session|layout\/(?:HeaderSection|FooterSection))$/ }, args => ({ path: args.path, namespace: 'fixture' }));
        b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => {
            let contents = '';
            if (args.path.endsWith('/api')) contents = 'export const errorMessage=(e,f)=>e.message||f;export const unwrap=r=>r;export default {post:async()=>({})};';
            else if (args.path.endsWith('activApi')) contents = 'export const login=async()=>({});export const getRegionTree=async()=>({states:[]});';
            else if (args.path.endsWith('cmsApi')) contents = 'export const EMPTY_MEDIA={url:"",type:"image",fit:"cover"};export const getCmsEvent=async()=>window.eventFixture;export const getCmsEvents=async()=>[window.eventFixture];export const getEventsSettings=async()=>({categories:[]});';
            else if (args.path.endsWith('session')) contents = 'export const isMemberSession=()=>true;';
            else if (args.path.endsWith('HeaderSection')) contents = 'export const HeaderSection=()=>null;';
            else if (args.path.endsWith('FooterSection')) contents = 'export const FooterSection=()=>null;';
            else contents = 'export const getBookableEvent=async()=>window.eventFixture;export const bookAndPay=async(id,body)=>{window.savedBody=body;return window.bookingFixture};export const getEventBooking=async()=>window.bookingFixture;export const resumeEventBookingPayment=async()=>window.bookingFixture;';
            return { loader: 'js', contents };
        });
    } };
    const built = await build({ absWorkingDir: root, bundle: true, write: false, outdir:'event-booking-fixture', format: 'iife', platform: 'browser', jsx: 'automatic', plugins: [fixtures], define: { 'import.meta.env': '{"DEV":true}', 'process.env.NODE_ENV': '"test"' }, stdin: { resolveDir: root, loader: 'tsx', contents: `
        import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,Routes,Route} from 'react-router-dom';
        import EventBookingPage from './src/pages/onboarding/EventBookingPage';
        import EventDetailPage from './src/pages/onboarding/EventDetailPage';import {EventsExplorer} from './src/pages/onboarding/components/EventsExplorer';
        import {eventWhere} from './src/lib/eventWhere';window.eventLocation=eventWhere;
        import {eventPlace,googleCalendarUrl} from './src/lib/eventCalendar';window.calendarPlace=eventPlace;window.calendarUrl=googleCalendarUrl;
        window.eventFixture={id:'fixture',title:'Conference fixture',startAt:'2030-10-23T03:30:00Z',endAt:'2030-10-23T11:30:00Z',mode:'offline',venue:'Chennai',amount:0,price:0,capacity:100,seatsLeft:100,maxPerBooking:10,registrationFields:[{key:'meal',label:'Meal preference',type:'select',required:true,options:['Vegetarian','Other']},{key:'consent',label:'Confirm attendance',type:'checkbox',required:true}]};
        window.bookingFixture={bookingRef:'FIXTURE-REF',eventId:'fixture',eventTitle:'Conference fixture',eventStartAt:window.eventFixture.startAt,status:'active',payment:{status:'not_required'},bookedBy:{name:'Booker',email:'booker@example.test',phone:'9000000001'},participants:[{name:'Booker'}],noOfPersons:1,unitAmount:0,totalAmount:0,responses:[{key:'meal',label:'Meal preference',value:'Vegetarian'}],passes:[{index:0,name:'Booker',registrationNo:'FIXTURE-REF-P1',url:'https://example.test/checkin/'+('a'.repeat(40))}]};
        const root=createRoot(document.getElementById('root'));let version=0;window.mountBooking=(ref='',forOthers=false)=>root.render(<MemoryRouter key={++version} initialEntries={['/events/fixture/book'+(ref?'?ref='+ref:forOthers?'?forOthers=1':'')]}><Routes><Route path='/events/:id/book' element={<EventBookingPage chrome='member'/>}/></Routes></MemoryRouter>);window.mountBooking();
        window.mountDetail=()=>root.render(<MemoryRouter key={++version} initialEntries={['/events/fixture']}><Routes><Route path='/events/:id' element={<EventDetailPage/>}/></Routes></MemoryRouter>);
        window.mountExplorer=()=>root.render(<MemoryRouter key={++version}><div id='explorer'><EventsExplorer events={[window.eventFixture]} settings={{categories:[]}}/></div></MemoryRouter>);
    ` } });
    bundle = built.outputFiles.find(file=>file.path.endsWith('.js')).text;
    css += '\n' + built.outputFiles.filter(file=>file.path.endsWith('.css')).map(file=>file.text).join('\n');
    chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    let port;
    for (let i = 0; i < 100; i++) { try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch {} await pause(100); }
    assert(port, 'Chrome starts');
    const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
    ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise(resolve => ws.addEventListener('open', resolve));
    let seq = 0; const pending = new Map(), errors = [];
    ws.addEventListener('message', event => { const m = JSON.parse(event.data); if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); pending.get(m.id)?.(m); pending.delete(m.id); });
    const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq, timer = setTimeout(() => reject(Error(method)), 15000); pending.set(id, r => { clearTimeout(timer); resolve(r); }); ws.send(JSON.stringify({ id, method, params })); });
    const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw Error(r.result.exceptionDetails.exception?.description); return r.result?.result?.value; };
    const until = async expression => { for (let i = 0; i < 70; i++) { if (await evaluate(`Boolean(${expression})`)) return; await pause(100); } throw Error(expression + JSON.stringify(errors)); };
    await send('Runtime.enable');
    await send('Network.enable');
    await send('Network.setBlockedURLs', { urls: ['https://*'] });
    await send('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}` });
    await until('document.querySelector("#registration-meal")');
    assert.deepEqual(await evaluate(`window.eventLocation({mode:'online',onlinePlatform:' Zoom ',venue:'Old venue'})`),{online:true,label:'Location',value:'Online'},'Public location shows only the attendance mode even when a platform is saved');
    assert.deepEqual(await evaluate(`window.eventLocation({mode:'online',onlinePlatform:'',venue:'Old venue'})`),{online:true,label:'Location',value:'Online'},'Unset platform also shows Online');
    assert.deepEqual(await evaluate(`window.eventLocation({mode:'offline',onlinePlatform:'Zoom',venue:'Chennai'})`),{online:false,label:'Location',value:'Chennai'},'Offline venues remain unchanged');
    assert.equal(await evaluate(`window.calendarPlace({mode:'online',onlinePlatform:'Zoom',venue:'Old venue',venueAddress:'Old address'})`),'Online','Online calendar exports suppress stale physical venues and platform names');
    assert.equal(await evaluate(`new URL(window.calendarUrl({...window.eventFixture,mode:'online',onlinePlatform:'Google Meet'})).searchParams.get('location')`),'Online','Calendar location is Online');
    assert.equal(await evaluate(`window.calendarPlace({mode:'offline',venue:'Chennai',venueAddress:'Hall A'})`),'Chennai, Hall A','Physical calendar locations stay intact');
    const fill = async (index, value) => evaluate(`(()=>{const input=document.querySelectorAll('input')[${index}];Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await fill(0, 'Booker'); await fill(1, 'booker@example.test'); await fill(2, '9000000001');
    assert.equal(await evaluate("document.querySelectorAll('input')[4].value"), 'Booker', 'Participant 1 visibly mirrors booking contact');
    await fill(0, 'Updated Booker');
    assert.equal(await evaluate("document.querySelectorAll('input')[4].value"), 'Updated Booker');
    await fill(0, 'Booker');
    const click = text => evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent.trim().startsWith(${JSON.stringify(text)})).click()`);
    await click('Continue');
    await until('document.body.textContent.includes("Meal preference is required")');
    assert.equal(await evaluate('window.savedBody'), undefined, 'required questions prevent booking');
    await evaluate(`(()=>{const select=document.querySelector('#registration-meal');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,'Vegetarian');select.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#registration-consent').click();})()`);
    await fill(3, '10');
    await until("document.querySelectorAll('input[type=email]').length===11");
    await click('Continue');
    await until("document.querySelectorAll('[data-invalid=true]').length>=27");
    assert.equal(await evaluate('window.savedBody'), undefined, 'nine missing attendees block continuation');
    for (let index = 1; index < 10; index++) {
        await fill(4 + index * 3, 'Delegate ' + index);
        await fill(5 + index * 3, `delegate${index}@example.test`);
        await fill(6 + index * 3, '91736524' + String(index).padStart(2, '0'));
    }
    await click('Continue');
    await until('document.body.textContent.includes("Review your booking")');
    assert.equal(await evaluate('window.savedBody'), undefined, 'review does not create or charge');
    await click('Edit details'); await until('document.querySelector("#registration-meal")');
    assert.equal(await evaluate('document.querySelector("#registration-meal").value'), 'Vegetarian');
    await click('Continue'); await until('document.body.textContent.includes("Review your booking")');
    await click('Confirm booking'); await until('document.body.textContent.includes("Entry passes")');
    assert.deepEqual(await evaluate('window.savedBody.responses'), { meal: 'Vegetarian', consent: true });
    assert.equal(await evaluate('window.savedBody.amount'), undefined);
    assert.equal(await evaluate('window.savedBody.noOfPersons'), 10);
    assert.equal(await evaluate('window.savedBody.participants.length'), 10);
    assert(await evaluate('window.savedBody.participants.every(p=>p.name&&p.email&&p.phone)'));
    assert(await evaluate('document.body.textContent.includes("FIXTURE-REF-P1")'));
    if (css) assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'), 'mobile ticket fits viewport');
    await evaluate("delete window.savedBody;window.eventFixture={...window.eventFixture,memberRateApplied:true,price:1000,memberPrice:0,amount:0}");
    await click('Book for someone else'); await until('document.querySelector("#registration-meal")');
    assert.equal(await evaluate("document.querySelectorAll('input')[0].value"), 'Booker', 'receipt contact remains the booking contact');
    assert.equal(await evaluate("document.querySelectorAll('input')[4].value"), '', 'another booking starts with an empty attendee');
    assert(await evaluate('document.body.textContent.includes("Your member rate applies to each seat")'));
    await click('Continue');
    await until("document.querySelectorAll('[data-invalid=true]').length>=3");
    assert.equal(await evaluate('window.savedBody'), undefined, 'empty friend cannot create a booking for the booker');
    await fill(4, 'Friend'); await fill(5, 'friend@example.test'); await fill(6, '9000000001');
    await evaluate(`(()=>{const select=document.querySelector('#registration-meal');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,'Vegetarian');select.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#registration-consent').click();})()`);
    await click('Continue'); await until('document.body.textContent.includes("Review your booking")');
    await click('Confirm booking'); await until('document.body.textContent.includes("Entry passes")');
    assert.equal(await evaluate('window.savedBody.useBookerForFirstParticipant'), false);
    assert.deepEqual(await evaluate('window.savedBody.participants'), [{ name: 'Friend', email: 'friend@example.test', phone: '9000000001' }]);
    await evaluate("window.mountBooking('',true)"); await until('document.querySelector("#registration-meal")');
    await fill(0, 'Booker'); await fill(1, 'booker@example.test'); await fill(2, '9000000001');
    assert.equal(await evaluate("document.querySelectorAll('input')[4].value"), '', 'forOthers entry never mirrors the booking contact');
    await evaluate("window.eventFixture={...window.eventFixture,mode:'online',onlinePlatform:'Google Meet',venue:''};window.mountBooking()");
    await until('document.body.textContent.includes("Location") && document.body.textContent.includes("Online")');
    assert(!(await evaluate('document.body.textContent.includes("Google Meet")')));
    assert(!(await evaluate('document.body.textContent.includes("Joining details are provided with your confirmed booking")')));
    assert(!(await evaluate('document.body.textContent.includes("To be announced")')));
    await evaluate("window.bookingFixture={...window.bookingFixture,mode:'online',onlinePlatform:'Google Meet',onlineUrl:'https://meet.google.com/aaa-bbbb-ccc'};window.mountBooking('FIXTURE-REF')");
    await until('document.body.textContent.includes("Join online event")');
    assert(!(await evaluate('document.body.textContent.includes("Google Meet")')),'Confirmed booking uses Online without the saved platform');
    assert.equal(await evaluate(`[...document.querySelectorAll('a')].find(a=>a.textContent.includes('Join online event'))?.href`),'https://meet.google.com/aaa-bbbb-ccc','Confirmed meeting action retains organiser URL');
    assert(!(await evaluate('document.body.textContent.includes("personal joining link is emailed")')));
    await evaluate("window.bookingFixture={...window.bookingFixture,onlinePlatform:'Zoom',onlineUrl:'https://zoom.us/meeting/register/example'};window.mountBooking('FIXTURE-REF')");
    await until('document.body.textContent.includes("Complete platform registration")');
    assert(!(await evaluate('document.body.textContent.includes("Zoom")')),'Registration action does not show a platform label');
    assert.equal(await evaluate(`[...document.querySelectorAll('a')].find(a=>a.textContent.includes('Complete platform registration'))?.href`),'https://zoom.us/meeting/register/example','Confirmed registration action retains organiser URL');
    await evaluate("window.bookingFixture={...window.bookingFixture,onlineUrl:''};window.mountBooking('FIXTURE-REF')");
    await until('document.body.textContent.includes("organiser has not added the joining details")');
    for (const width of [390,1440]) for (const view of ['booking','detail','explorer']) {
        await send('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:width<640});
        await evaluate(`window.eventFixture={...window.eventFixture,mode:'online',onlinePlatform:' Zoom ',venue:'Old venue should not appear',slug:'fixture',status:'published',registrationEnabled:true};window.mount${view==='booking'?'Booking':view==='detail'?'Detail':'Explorer'}()`);
        const platformExpression=view==='explorer'
            ? `document.querySelector('#explorer svg.lucide-video')?.parentElement.querySelector('span')`
            : `[...document.querySelectorAll('p')].find(p=>p.textContent.trim()==='Location')?.nextElementSibling`;
        await until(`${platformExpression}?.textContent.trim()==='Online'`);
        await evaluate('document.fonts.ready');
        await evaluate(`${platformExpression}.scrollIntoView({block:'center'})`);await pause(100);
        const result=await evaluate(`(()=>{const el=${platformExpression},r=el.getBoundingClientRect();return{view:${JSON.stringify(view)},width:innerWidth,scrollWidth:document.documentElement.scrollWidth,platform:el.textContent.trim(),left:r.left,right:r.right,font:getComputedStyle(el).fontFamily,oldLabel:/Online\\s*[·]\\s*Zoom|Joining link on|Joining details are provided with your confirmed booking/.test(document.body.textContent),oldVenue:document.body.textContent.includes('Old venue should not appear')}})()`);
        assert.equal(result.platform,'Online','Public attendance value stays Online');
        assert(!(await evaluate('document.body.textContent.includes("Zoom")')),'Saved platform is not displayed publicly');
        assert.equal(result.oldLabel,false,'No redundant online/joining label remains');
        assert.equal(result.oldVenue,false,'Online event never shows stale offline venue');
        assert(result.scrollWidth<=width+1&&result.left>=-1&&result.right<=width+1,'Platform summary fits '+view+' at '+width);
        assert(result.font.includes('Poppins'),'Current platform summary uses Poppins');
        layouts.push(result);
        if(output){const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(output,view+'-'+width+'.png'),Buffer.from(shot.result.data,'base64'));}
    }
    assert.deepEqual(errors, []);
    if(output)await writeFile(path.join(output,'verification.json'),JSON.stringify({checkedAt:new Date().toISOString(),layouts,errors,checks:'Required questions and attendees, review/edit, server-only amount, confirmed passes, meeting/registration hrefs, missing-link guidance; Online labels across booking/detail/explorer and calendars on phone and desktop'},null,2));
    await evaluate("window.bookingFixture={...window.bookingFixture,status:'waitlist',payment:{...window.bookingFixture.payment,status:'paid',reconciliationRequired:true,reconciliationReason:'An attendee email is already registered.'}};window.mountBooking('FIXTURE-REF')");
    await until("document.body.textContent.includes('Payment received — organiser review needed')");
    assert(await evaluate("document.body.textContent.includes('Please do not pay again')"));
    assert(!(await evaluate("document.body.textContent.includes('Booking confirmed')")));
    assert(!(await evaluate("document.body.textContent.includes('nothing has been charged')")));
    assert.equal(await evaluate("document.querySelectorAll('img[alt^=\"Entry pass\"]').length"), 0);
    console.log('PASS: event questions/attendees, friend-mode validation and receipt rebooking, paid review without false passes, review/edit, confirmed passes, meeting/registration links; platform labels and layout at390/1440px.');
    await send('Browser.close');
} finally {
    ws?.close(); chrome?.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    if (path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep + 'activ-event-booking-')) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
