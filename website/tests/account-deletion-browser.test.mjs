// Exercise the public deletion page with the real API client and a local inbox fixture.
// No production messages are sent and no accounts are deleted.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'activ-deletion-browser-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const requests = [];
let bundle = '', css = '', responseMode = 'failure', chrome, ws;
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
    if (url.pathname === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
    if (!url.pathname.startsWith('/api/')) {
        res.setHeader('Content-Type', 'text/html');
        return res.end('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
    }
    res.setHeader('Content-Type', 'application/json');
    let data = {};
    if (url.pathname.endsWith('/cms/contact-messages') && req.method === 'POST') {
        let body = '';
        for await (const chunk of req) body += chunk;
        requests.push({ body: JSON.parse(body), authorization: req.headers.authorization });
        await pause(250);
        if (responseMode === 'failure') { res.statusCode = 500; return res.end(JSON.stringify({ message: 'Request service unavailable. Please try again.' })); }
        if (responseMode === 'rate-limit') { res.statusCode = 429; return res.end(JSON.stringify({ message: 'Too many requests. Please try again later.' })); }
        if (responseMode === 'success') data = { id: 'deletion-request-test-123', receivedAt: new Date().toISOString() };
    } else if (url.pathname.endsWith('/cms/legal/links')) data = [];
    else if (url.pathname.endsWith('/cms/regions/map')) data = { regions: [] };
    else if (url.pathname.endsWith('/cms/site-settings')) data = { sections: [] };
    res.end(JSON.stringify({ success: true, data }));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

try {
    const cssFile = (await readdir(path.join(root, 'dist/assets'))).find(name => /^index-.*\.css$/.test(name));
    css = await readFile(path.join(root, 'dist/assets', cssFile), 'utf8');
    const built = await build({
        absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
        define: { 'import.meta.env': JSON.stringify({ DEV: true, VITE_API_URL: `${base}/api/v1` }), 'process.env.NODE_ENV': '"test"' },
        stdin: { resolveDir: root, loader: 'tsx', contents: `
            import React from 'react'; import { createRoot } from 'react-dom/client';
            import { BrowserRouter } from 'react-router-dom';
            import DeleteAccountPage from './src/pages/onboarding/DeleteAccountPage';
            createRoot(document.getElementById('root')).render(<BrowserRouter><DeleteAccountPage /></BrowserRouter>);
        ` },
    });
    bundle = built.outputFiles[0].text;
    chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
        '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank',
    ], { windowsHide: true, stdio: 'ignore' });
    chrome.on('error', error => console.error(error.message));
    let port;
    for (let i = 0; i < 100; i++) {
        try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch { /* Chrome is starting. */ }
        await pause(100);
    }
    assert.ok(port, 'Chrome starts');
    const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
    ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
    await new Promise(resolve => ws.addEventListener('open', resolve));
    let sequence = 0;
    const pending = new Map(), exceptions = [];
    ws.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text);
        pending.get(message.id)?.(message); pending.delete(message.id);
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP timeout: ${method}`)); }, 15000);
        pending.set(id, result => { clearTimeout(timer); resolve(result); });
        ws.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
        const reply = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (reply.result?.exceptionDetails) throw Error(reply.result.exceptionDetails.exception?.description || 'Browser exception');
        return reply.result?.result?.value;
    };
    const until = async expression => {
        for (let i = 0; i < 100; i++) { if (await evaluate(`Boolean(${expression})`)) return; await pause(100); }
        throw Error(`Timed out: ${expression}`);
    };
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await send('Page.navigate', { url: `${base}/delete-account` });
    await until('document.querySelector("#deletion-name")');
    assert.equal(await evaluate('document.title'), 'Delete your account | ACTIV');
    assert.ok(await evaluate(`document.querySelector('footer a[href="/delete-account"]') !== null`), 'Footer works without CMS data');
    assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'No phone-width overflow');
    await evaluate('document.querySelector("button[type=submit]").click()');
    assert.equal(requests.length, 0, 'Required fields prevent empty requests');
    const fill = async (id, value) => {
        await evaluate(`{ const el = document.getElementById(${JSON.stringify(id)}); const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); }`);
    };
    await fill('deletion-name', 'Test Member');
    await fill('deletion-email', 'member@example.test');
    await fill('deletion-member', 'ACTIV-TEST-123');
    await fill('deletion-note', 'Please contact me to verify this request.');
    await evaluate('document.querySelector("button[type=submit]").click()');
    assert.equal(requests.length, 0, 'Confirmation is required');
    await evaluate('document.querySelector("input[type=checkbox]").click()');
    await evaluate('document.querySelector("button[type=submit]").click(); document.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));');
    await until('document.querySelector("[role=alert]")');
    assert.equal(requests.length, 1, 'Duplicate submits are blocked');
    assert.equal(requests[0].authorization, undefined, 'Signed-out visitors can request deletion');
    assert.equal(requests[0].body.subject, 'ACTIV account and data deletion request');
    assert.ok(requests[0].body.message.includes('ACTIV-TEST-123'));
    assert.equal(await evaluate('document.getElementById("deletion-email").value'), 'member@example.test', 'Failure preserves fields');
    assert.ok(!(await evaluate('document.body.innerText')).includes('Deletion request received'));
    responseMode = 'rate-limit';
    await evaluate('document.querySelector("button[type=submit]").click()');
    await until('document.body.innerText.includes("Too many requests")');
    responseMode = 'empty';
    await evaluate('document.querySelector("button[type=submit]").click()');
    await until('document.body.innerText.includes("We could not confirm receipt")');
    responseMode = 'success';
    await evaluate('document.querySelector("button[type=submit]").click()');
    await until('document.body.innerText.includes("Deletion request received")');
    assert.ok(await evaluate('document.body.innerText.includes("deletion-request-test-123")'));
    assert.ok(await evaluate('document.body.innerText.includes("Your account has not been deleted yet")'));
    assert.equal(await evaluate('document.querySelector("form")'), null);
    assert.ok(await evaluate('document.activeElement.getAttribute("role") === "status"'), 'Confirmation receives keyboard focus');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'No desktop overflow');
    assert.deepEqual(exceptions, [], 'No uncaught browser errors');
    console.log('PASS: public deletion form, validation, confirmation, duplicate guard, failure preservation, rate limiting, missing receipt, success reference, footer and responsive layout.');
    await send('Browser.close');
} finally {
    ws?.close(); chrome?.kill(); server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    const resolved = path.resolve(profile);
    if (resolved.startsWith(path.resolve(tmpdir()) + path.sep + 'activ-deletion-browser-')) {
        await rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
    }
}
