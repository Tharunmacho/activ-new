// Actual settings component + API adapter, local transport and sample data only.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const root = fileURLToPath(new URL('..', import.meta.url)), artifacts = path.resolve(root, '../artifacts');
const profile = await mkdtemp(path.join(tmpdir(), 'activ-update-preferences-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let bundle = '', css = '', chrome, ws;
const server = http.createServer((req, res) => {
    if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
    if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body style="margin:0;background:#f8fafc"><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
    const assets = await readdir(path.join(root, 'dist/assets'));
    css = await readFile(path.join(root, 'dist/assets', assets.find(file => /^index-.*\.css$/.test(file))), 'utf8');
    const sources = {
        '@/services/activApi': 'export const errorMessage=(error,fallback)=>error?.response?.data?.message||error?.message||fallback;',
        './api': `window.preferences={email:true,whatsapp:false,whatsappNumber:'9123456780'};window.calls=[];window.failLoad=location.search.includes('fail=1');
            export default {get:async path=>{window.calls.push({method:'GET',path});if(window.failLoad)throw new Error('Could not load test preferences');return {data:{data:window.preferences}}},
            patch:async(path,body)=>{window.calls.push({method:'PATCH',path,body});if(window.failSave)throw {response:{data:{message:'Your contact details changed. Please refresh.'}}};
                return new Promise(resolve=>{window.finishSave=value=>{window.preferences=value||{...window.preferences,...body};resolve({data:{data:window.preferences}})}})}};`,
    };
    bundle = (await build({ absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
        define: { 'process.env.NODE_ENV': '"test"' }, plugins: [{ name: 'preferences-transport', setup(build) {
            build.onResolve({ filter: /.*/ }, args => args.path in sources ? { path: args.path, namespace: 'fixture' } : undefined);
            build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: sources[args.path], loader: 'tsx', resolveDir: root }));
        } }], stdin: { resolveDir: root, loader: 'tsx', contents: `import React from 'react';import{createRoot}from'react-dom/client';
            import Preferences from './src/features/member/components/AssociationUpdatePreferences';
            createRoot(document.getElementById('root')).render(<main style={{maxWidth:640,margin:'0 auto',padding:16}}><Preferences/></main>);` } })).outputFiles[0].text;
    chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    let port;
    for (let n = 0; n < 100; n++) { try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch {} await pause(100); }
    assert(port, 'Chrome starts');
    const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
    ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
    await new Promise(resolve => ws.addEventListener('open', resolve));
    let seq = 0; const pending = new Map(), errors = [];
    ws.addEventListener('message', event => { const msg = JSON.parse(event.data); if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.text); pending.get(msg.id)?.(msg); pending.delete(msg.id); });
    const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq, timer = setTimeout(() => reject(Error(method)), 30000); pending.set(id, msg => { clearTimeout(timer); msg.error ? reject(Error(JSON.stringify(msg.error))) : resolve(msg); }); ws.send(JSON.stringify({ id, method, params })); });
    const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.result?.exceptionDetails) throw Error(result.result.exceptionDetails.exception?.description); return result.result?.result?.value; };
    const until = async expression => { for (let n = 0; n < 100; n++) { if (await evaluate(expression)) return; await pause(75); } throw Error(expression + errors.join(';')); };
    const input = channel => `document.querySelector('[aria-label="${channel} association updates"]')`;
    const open = async query => { await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/${query || ''}` }); await until("!!document.querySelector('section')"); };
    await send('Runtime.enable'); await send('Network.enable'); await send('Network.setBlockedURLs', { urls: ['https://*'] });
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
    await open('?fail=1'); await until("!!document.querySelector('[role=alert]')");
    assert.equal(await evaluate("document.querySelectorAll('[role=switch]').length"), 0, 'Failed load cannot opt in');
    await evaluate("window.failLoad=false;document.querySelector('button').click()"); await until(`!!${input('Email')}`);
    assert.equal(await evaluate(`${input('Email')}.checked`), true);
    assert.equal(await evaluate(`${input('WhatsApp')}.checked`), false);
    assert(await evaluate("document.body.innerText.includes('WhatsApp at 9123456780')"));
    assert.equal(await evaluate("window.calls.filter(call=>call.method==='PATCH').length"), 0);
    await evaluate(`${input('WhatsApp')}.click()`); await until("window.calls.some(call=>call.method==='PATCH')");
    assert.deepEqual(await evaluate('window.calls.at(-1)'), { method: 'PATCH', path: '/notifications/update-preferences', body: { whatsapp: true } });
    assert(await evaluate("[...document.querySelectorAll('[role=switch]')].every(el=>el.disabled)"));
    assert.equal(await evaluate(`${input('WhatsApp')}.checked`), false, 'Waits for authoritative response');
    await evaluate(`${input('Email')}.click()`);
    assert.equal(await evaluate("window.calls.filter(call=>call.method==='PATCH').length"), 1);
    await evaluate("window.finishSave({email:false,whatsapp:true,whatsappNumber:'+919123456780'})"); await until(`${input('WhatsApp')}.checked`);
    assert.equal(await evaluate(`${input('Email')}.checked`), false);
    assert(await evaluate("document.body.innerText.includes('+919123456780')"));
    await evaluate("window.failSave=true"); await evaluate(`${input('WhatsApp')}.click()`); await until("!!document.querySelector('[role=alert]')");
    assert.equal(await evaluate(`${input('WhatsApp')}.checked`), true, 'Failed save preserves confirmed choice');
    assert(await evaluate("[...document.querySelectorAll('[role=switch]')].every(el=>el.disabled)"));
    await evaluate("window.failSave=false;window.preferences={email:true,whatsapp:false,whatsappNumber:''};document.querySelector('button').click()"); await until(`!!${input('WhatsApp')}&&${input('WhatsApp')}.checked===false`);
    assert.equal(await evaluate(`${input('WhatsApp')}.disabled`), true, 'No phone cannot grant WhatsApp consent');
    for (const width of [320, 390, 1440]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 }); await open(); await until(`!!${input('Email')}`);
        assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'), `No overflow ${width}px`);
        assert.equal(await evaluate("parseFloat(getComputedStyle(document.querySelector('label span span')).fontSize)"), 16);
        const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
        await writeFile(path.join(artifacts, `association-update-preferences-${width}.png`), Buffer.from(shot.result.data, 'base64'));
    }
    assert.deepEqual(errors, []);
    console.log('PASS: web preference load/retry, explicit single-channel consent, pending lock, authoritative save, failure preservation/reload, missing phone and 320/390/1440 layouts. No external delivery.');
    await send('Browser.close');
} finally {
    ws?.close(); chrome?.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    if (path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep + 'activ-update-preferences-')) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
