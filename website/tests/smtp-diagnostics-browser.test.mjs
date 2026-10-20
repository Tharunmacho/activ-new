// Real notification screens with fixture APIs; network is restricted to loopback.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'activ-smtp-diagnostics-'));
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
    css = await readFile(path.join(root, 'dist/assets', assets.find(file => /^index-.*\.css$/.test(file))), 'utf8');
    const sources = {
        './AdminSidebar': 'export default ()=>null;',
        './NotificationReports': 'export default ()=>null;',
        '@/features/admin/components/HistoryDeleteButton': 'export default ()=>null;',
        '@/services/api': 'export const errorMessage=(e,f)=>e.message||f;',
        'sonner': `window.fixtureToasts=[];export const toast=Object.fromEntries(['success','error','warning'].map(kind=>[kind,text=>window.fixtureToasts.push({kind,text})]));`,
        '@/services/activApi': `
            window.fixtureSends=[];window.fixtureVerifications=0;window.fixtureFailure=false;window.fixtureRecovered=false;
            export const errorMessage=(e,f)=>e.message||f;
            export const getDeliveryStatus=async(verify=false)=>{
                if(verify){window.fixtureVerifications++;if(window.fixtureFailure)throw Error('Fixture diagnostic request failed');}
                return {email:{configured:true,accounts:['events','membership'].map(category=>({
                    category,from:(category==='events'?'events':'member')+'@activ.org.in',host:'mail.activ.org.in',port:465,
                    configured:true,transport:window.fixtureShared?'shared':'separate',
                    ...(verify?{verification:{configured:true,ok:category==='events'||window.fixtureRecovered,
                        error:category==='membership'&&!window.fixtureRecovered?'535 Fixture authentication rejected':''}}:{})
                }))},whatsapp:{configured:true}}
            };
            export const getNotificationLogs=async()=>({logs:[],health:{sent:0,failed:0,queued:0,mock:0,total:0}});
            export const retryNotification=async()=>{throw Error('Unexpected retry');};
            export const sendTestNotification=async(channel,to,category)=>{window.fixtureSends.push({channel,to,category});return {success:true}};
        `,
        '@/services/notificationDeliveryApi': `
            const counts={total:0,accepted:0,sent:0,delivered:0,read:0,failed:0,mock:0};
            export const EMPTY_AUTOMATION={logs:[],health:{sent:0,failed:0,queued:0,mock:0,total:0},events:[],
                counts:{total:0,delivery:counts,byChannel:{email:counts,whatsapp:counts}},pagination:{page:1,limit:25,total:0,pages:1}};
            export const getAutomationLogs=async()=>EMPTY_AUTOMATION;
            export const getDeliveryGuardHealth=async()=>({email:{ok:window.fixtureRecovered,configured:true,error:'Fixture authentication rejected',
                accounts:['events','membership'].map(category=>({category,ok:category==='events'||window.fixtureRecovered,configured:true,error:'535 Fixture authentication rejected'}))},
                autoRetry:{enabled:true,everyMinutes:10}});
            export const retryAllFailed=async()=>{throw Error('Unexpected retry');};
        `,
        '@/features/admin/components/DeliveryUI': `
            export const MESSAGE_TYPES=[];
            export const messageLabel=v=>v,plainReason=v=>v,reasonOf=()=>'',stateOf=()=>'',whenLabel=()=>'';
            export const ResendButton=()=>null,DeliveryBadge=()=>null,DeliveryDetail=()=>null,SidePanel=()=>null,ChannelIcon=()=>null;
        `,
    };
    const result = await build({ absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
        define: { 'import.meta.env': '{"DEV":true}', 'process.env.NODE_ENV': '"test"' },
        plugins: [{ name: 'smtp-fixture', setup(builder) {
            builder.onResolve({ filter: /.*/ }, args => args.path in sources ? { path: args.path, namespace: 'fixture' } : undefined);
            builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: sources[args.path], loader: 'tsx', resolveDir: root }));
        } }], stdin: { resolveDir: root, loader: 'tsx', contents: `
            import React from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';
            import Notifications from './src/features/admin/super-admin/pages/Notifications';
            createRoot(document.getElementById('root')).render(<BrowserRouter><Notifications/></BrowserRouter>);
        ` } });
    bundle = result.outputFiles[0].text;
    chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        ['--headless=new', '--disable-gpu', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--no-first-run', 'about:blank'],
        { windowsHide: true, stdio: 'ignore' });
    let port;
    for (let i = 0; i < 100; i++) { try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch {} await pause(100); }
    assert(port, 'Chrome exposes a debugging port');
    const tabs = await fetch('http://127.0.0.1:' + port + '/json/list').then(response => response.json());
    ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
    await new Promise(resolve => ws.addEventListener('open', resolve));
    let sequence = 0; const pending = new Map(), errors = [];
    ws.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text); pending.get(message.id)?.(message); pending.delete(message.id); });
    const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence, timer = setTimeout(() => reject(Error(method)), 30000); pending.set(id, message => { clearTimeout(timer); resolve(message); }); ws.send(JSON.stringify({ id, method, params })); });
    const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.result?.exceptionDetails) throw Error(result.result.exceptionDetails.exception?.description); return result.result?.result?.value; };
    const until = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate('Boolean(' + expression + ')')) return; await pause(80); } throw Error(expression + ' ' + errors.join(';')); };
    const click = label => evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent.includes(${JSON.stringify(label)})).click()`);
    const select = (label, value) => evaluate(`(()=>{const element=document.querySelector('select[aria-label=${JSON.stringify(label)}]');element.value=${JSON.stringify(value)};element.dispatchEvent(new Event('change',{bubbles:true}))})()`);
    await send('Runtime.enable'); await send('Network.enable'); await send('Network.setBlockedURLs', { urls: ['https://*'] });
    for (const width of [1440, 390, 320]) {
        console.log('Checking SMTP diagnostics at width', width);
        await send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: width < 600 });
        await send('Page.navigate', { url: 'http://127.0.0.1:' + server.address().port + '/super-admin/notifications' });
        await until('document.body.innerText.includes("Notifications")');
        await click('Delivery log');
        await until('document.body.innerText.includes("Check SMTP login")');
        console.log('Login form rendered');
        assert.equal(await evaluate('window.fixtureVerifications'), 0);
        await click('Check SMTP login');
        await until('document.body.innerText.includes("SMTP login failed")');
        assert.equal(await evaluate('window.fixtureSends.length'), 0, 'login checks never send mail');
        let text = await evaluate('document.body.innerText');
        assert(text.includes('Events (events@activ.org.in) — SMTP login succeeded'));
        assert(text.includes('Membership (member@activ.org.in) — SMTP login failed'));
        assert(text.includes('MEMBER_EMAIL_HOST'));
        await evaluate('window.fixtureShared=true');
        await click('Check SMTP login');
        await until('document.body.innerText.includes("Check EMAIL_HOST")');
        await evaluate('window.fixtureFailure=true');
        await click('Check SMTP login');
        await until('document.body.innerText.includes("Fixture diagnostic request failed")');
        assert(!(await evaluate('document.body.innerText')).includes('SMTP login succeeded'), 'failed refresh clears previous success');
        await evaluate('window.fixtureFailure=false;window.fixtureRecovered=true');
        await click('Check SMTP login');
        await until('document.body.innerText.includes("Membership (member@activ.org.in) — SMTP login succeeded")');
        await evaluate(`(()=>{const input=document.querySelector('input[aria-label="Test recipient"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'admin@example.test');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
        await click('Send test');
        await until('window.fixtureSends.length===1');
        await select('Test email sender', 'events');
        await click('Send test');
        await until('window.fixtureSends.length===2');
        assert.deepEqual(await evaluate('window.fixtureSends.map(item=>item.category)'), ['membership', 'events']);
        assert((await evaluate('window.fixtureToasts.at(-1).text')).includes('Accepted by SMTP'));
        console.log('Login checks and sender selection passed');
        assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'), 'screen fits width ' + width);
        await evaluate('window.fixtureRecovered=false');
        await click('Automatic messages');
        await until('document.body.innerText.includes("One or more email senders need attention")');
        text = await evaluate('document.body.innerText');
        assert(text.includes('Events: SMTP login succeeded'));
        assert(text.includes('Membership: 535 Fixture authentication rejected'));
        assert(text.includes('Only eligible confirmed failures'));
        assert(!text.includes('Email is not being sent right now'));
    }
    assert.deepEqual(errors, []);
    console.log('PASS real SMTP diagnostic screens at 320/390/1440px: no-send login checks, sender-specific results and settings, failure/recovery, both test senders, SMTP acceptance copy and mixed automation health.');
    await send('Browser.close');
} finally {
    ws?.close(); chrome?.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    if (path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep + 'activ-smtp-diagnostics-')) {
        await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
    }
}
