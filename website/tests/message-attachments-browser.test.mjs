// Exercise real chat UI/API clients with loopback fixtures only; never send a live message.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import loadConfig from 'tailwindcss/loadConfig.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'activ-chat-files-'));
const output = process.env.TEST_ARTIFACTS ? path.resolve(process.env.TEST_ARTIFACTS) : null;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const peer = { id: 'member-two', fullName: 'Fixture Member', state: 'Tamil Nadu' };
const conversation = { id: 'thread-one', withMember: peer, unread: 0, lastMessageText: 'A conversation', lastMessageMine: false };
const attachment = { id: 'attachment-one', url: '/api/v1/messages/attachments/attachment-one', name: 'quotation.pdf', mimeType: 'application/pdf', size: 20, kind: 'file' };
const messages = [{ id: 'first', body: 'Existing message', attachmentUrl: '', mine: false, at: '2026-10-15T10:00:00Z' }];
let bundle = '', css = '', chrome, ws, failSend = true;
const requests = [], errors = [], checks = [];
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
    if (url.pathname === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
    if (url.pathname.startsWith('/api/')) {
      let raw = ''; for await (const chunk of req) raw += chunk;
      const multipart = String(req.headers['content-type']).startsWith('multipart/form-data; boundary=');
      const body = raw && !multipart ? JSON.parse(raw) : null;
      requests.push({ method: req.method, path: url.pathname, body, multipart, authorization: !!req.headers.authorization });
      res.setHeader('Content-Type', 'application/json');
      const send = data => res.end(JSON.stringify({ success: true, data }));
      if (url.pathname === '/api/v1/messages' && req.method === 'GET') return send({ conversations: [conversation], unreadTotal: 0 });
      if (url.pathname === '/api/v1/messages/thread-one/read') return send({ ok: true });
      if (url.pathname === '/api/v1/messages/thread-one' && req.method === 'GET') return send({ conversation, messages, hasMore: false });
      if (url.pathname === '/api/v1/messages/attachment' && req.method === 'POST') {
        assert(multipart, 'Upload preserves browser-generated multipart boundary');
        assert(raw.includes('name="file"; filename="quotation.pdf"'), 'Expected named file uploaded');
        return send({ ...attachment, token: 'signed-fixture-upload' });
      }
      if (url.pathname === '/api/v1/messages/thread-one' && req.method === 'POST') {
        assert.deepEqual(body.attachment, { token: 'signed-fixture-upload' });
        if (failSend) { res.statusCode = 409; return res.end(JSON.stringify({ success: false, message: 'Fixture send refused; please retry.' })); }
        const message = { id: `sent-${messages.length}`, body: body.body, attachmentUrl: attachment.url, attachment, mine: true, at: '2026-10-15T11:00:00Z' };
        messages.push(message); return send(message);
      }
      if (url.pathname === '/api/v1/messages/attachments/attachment-one' && req.method === 'GET') {
        assert(req.headers.authorization, 'Download remains authenticated');
        res.setHeader('Content-Type', 'application/pdf'); return res.end('%PDF-1.4\nfixture');
      }
      throw new Error(`Unexpected fixture request ${req.method} ${url.pathname}`);
    }
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'");
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  } catch (error) { errors.push(error.message); res.statusCode = 500; res.end(JSON.stringify({ success: false, message: error.message })); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  if (output) await mkdir(output, { recursive: true });
  let input = await readFile(path.join(root, 'src/index.css'), 'utf8');
  for (const match of [...input.matchAll(/@import ['"](.+?)['"];?/g)]) input = input.replace(match[0], await readFile(path.resolve(root, 'src', match[1]), 'utf8'));
  const config = loadConfig(path.join(root, 'tailwind.config.ts')); config.content = [path.join(root, 'src/**/*.{ts,tsx}')];
  css = (await postcss([tailwind(config)]).process(input, { from: path.join(root, 'src/index.css') })).css;
  const result = await build({ absWorkingDir: root, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
    define: { 'import.meta.env': JSON.stringify({ DEV: true, VITE_API_URL: `http://127.0.0.1:${server.address().port}/api/v1` }), 'process.env.NODE_ENV': '"test"' },
    stdin: { resolveDir: root, loader: 'tsx', contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter} from 'react-router-dom';import Inbox from './src/features/member/pages/MemberInbox';localStorage.setItem('token','fixture-token');createRoot(document.getElementById('root')).render(<BrowserRouter><Inbox/></BrowserRouter>);` } });
  bundle = result.outputFiles[0].text;
  chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let port;
  for (let attempt = 0; attempt < 100; attempt++) { try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch {} await pause(100); }
  assert(port, 'Chrome starts');
  const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
  ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve));
  let serial = 0; const pending = new Map();
  ws.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text); pending.get(message.id)?.(message); pending.delete(message.id); });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++serial; const timer = setTimeout(() => reject(Error(method)), 30000); pending.set(id, response => { clearTimeout(timer); response.error ? reject(Error(response.error.message)) : resolve(response.result); }); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description); return result.result?.value; };
  const until = async expression => { for (let attempt = 0; attempt < 100; attempt++) { if (await evaluate(expression)) return; await pause(100); } throw Error(expression); };
  const selectFile = (name, type, content = 'quotation content') => evaluate(`(() => {const transfer=new DataTransfer();transfer.items.add(new File([${JSON.stringify(content)}],${JSON.stringify(name)},{type:${JSON.stringify(type)}}));const input=document.querySelector('input[type=file]');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const submit = () => evaluate(`document.querySelector('button[aria-label="Send message"]').click()`);
  await send('Runtime.enable');
  await send('Page.setDownloadBehavior', { behavior: 'deny' });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/member/messages?c=thread-one` });
  await until('document.body.textContent.includes("Existing message")');
  await selectFile('program.exe', 'application/octet-stream');
  await until('document.body.textContent.includes("Choose a photo, PDF")');
  assert.equal(requests.filter(request => request.path.endsWith('/attachment')).length, 0);
  await selectFile('quotation.pdf', 'application/pdf', '%PDF-1.4 fixture');
  await until('document.body.textContent.includes("quotation.pdf")');
  assert.equal(await evaluate('document.querySelectorAll("img").length'), 0, 'Document preview is not an image');
  await evaluate(`document.querySelector('button[aria-label="Remove attachment"]').click()`);
  assert.equal(requests.filter(request => request.path.endsWith('/attachment')).length, 0, 'Removing a file before Send never uploads it');
  await selectFile('quotation.pdf', 'application/pdf', '%PDF-1.4 fixture');
  await submit();
  await until('document.body.textContent.includes("Fixture send refused")');
  assert(await evaluate(`Boolean(document.querySelector('button[aria-label="Remove attachment"]'))`), 'Failure preserves file for retry');
  failSend = false;
  await submit();
  await until(`Boolean(document.querySelector('button[aria-label="Download quotation.pdf"]'))`);
  assert.equal(requests.filter(request => request.path.endsWith('/attachment')).length, 1, 'Retry reuses verified upload');
  assert.equal(await evaluate('document.querySelectorAll("img").length'), 0, 'Received PDF is not rendered as an image');
  await evaluate(`document.querySelector('button[aria-label="Download quotation.pdf"]').click()`);
  for (let attempt = 0; attempt < 50 && !requests.some(request => request.path.includes('/attachments/attachment-one')); attempt++) await pause(100);
  assert(requests.some(request => request.path.includes('/attachments/attachment-one') && request.authorization));
  for (const width of [390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: true });
    await evaluate('document.querySelector("textarea").scrollIntoView({block:"center"})');
    assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'), `${width}: chat fits viewport`);
    const fit = await evaluate(`(() => {const element=document.querySelector('button[aria-label="Download quotation.pdf"]');return element.scrollWidth<=element.clientWidth+1})()`);
    assert(fit, `${width}: attachment card fits`);
    if (output) { const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(path.join(output, `chat-files-${width}.png`), Buffer.from(shot.data, 'base64')); }
  }
  checks.push('Unsupported file rejected before upload', 'Remove/cancel sends nothing', 'Document-only message uploads once and retries without reupload', 'Private download uses signed-in API', 'File cards and composer fit 390/320px');
  assert.deepEqual(errors, []);
  if (output) await writeFile(path.join(output, 'verification.json'), JSON.stringify({ checkedAt: new Date().toISOString(), checks, requests, errors, productionMessagesSent: false }, null, 2));
  console.log('PASS: chat document selection, safe preview, upload/send/retry, authenticated download and mobile layout.');
  await send('Browser.close');
} finally {
  ws?.close(); chrome?.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  if (path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep + 'activ-chat-files-')) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
