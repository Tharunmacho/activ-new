// Local mock API + real editor/public components. No production content writes.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, stop } from 'esbuild';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import loadConfig from 'tailwindcss/loadConfig.js';
import { localTypographyFonts } from './browserTypographyFixtures.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const fonts = await localTypographyFonts(root);
const profile = await mkdtemp(path.join(tmpdir(), 'activ-news-assets-'));
const artifacts = path.resolve(process.env.TEST_ARTIFACTS || path.join(root, '../artifacts/news-assets-browser'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const image = url => ({ url, type: 'image', alt: '', fit: 'contain', position: 'center' });
let article = { id: 'news-fixture', slug: 'community-news', title: 'Community news', summary: '', body: '', status: 'published',
    image: image('/uploads/cover.png'), photos: [image('/uploads/old-photo.png')],
    attachments: [{ url: '/uploads/existing.pdf', filename: 'existing.pdf', label: 'Existing notice', mimeType: 'application/pdf', size: 88 }], links: [],
    externalUrl: 'https://example.test/source', sourceName: 'Original report', extraFields: [{ label: 'Photographer', value: 'News desk' }] };
let bundle = '', css = '', failSave = false, writes = [], uploadRequests = [];
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4XcAAAAASUVORK5CYII=', 'base64');
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (fonts.serve(url, res)) return;
    if (url.pathname === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
    if (url.pathname === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
    if (url.pathname.startsWith('/uploads/')) { res.setHeader('Content-Type', 'image/png'); return res.end(png); }
    if (!url.pathname.startsWith('/api/')) { res.setHeader('Content-Type', 'text/html'); return res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>'); }
    res.setHeader('Content-Type', 'application/json');
    let data = {};
    if (/\/cms\/(media|attachments)$/.test(url.pathname)) {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const filename = /filename="([^"]+)"/.exec(Buffer.concat(chunks).toString())?.[1] || 'unknown';
        uploadRequests.push(filename);
        await pause(200);
        if (filename.startsWith('fail')) { res.statusCode = 500; return res.end(JSON.stringify({ message: 'Fixture upload failure' })); }
        data = { url: `/uploads/${filename}`, name: filename, type: url.pathname.endsWith('/media') ? 'image' : 'application/pdf', size: 128 };
    } else if (/\/cms\/news-admin\/articles\//.test(url.pathname)) {
        let body = ''; for await (const chunk of req) body += chunk;
        const payload = JSON.parse(body);
        if (failSave) { res.statusCode = 500; return res.end(JSON.stringify({ message: 'Fixture save failure. Please retry.' })); }
        writes.push(payload); article = { ...article, ...payload }; data = article;
    } else if (url.pathname.endsWith('/cms/news-admin')) data = { news: [article], settings: {}, schemes: [] };
    else if (url.pathname.endsWith('/cms/news/community-news')) data = article;
    else if (url.pathname.endsWith('/cms/regions/map')) data = { regions: [] };
    else if (url.pathname.includes('/regions')) data = { states: [] };
    res.end(JSON.stringify({ data }));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let chrome, ws;
try {
    await mkdir(artifacts, { recursive: true });
    let inputCss = await readFile(path.join(root, 'src/index.css'), 'utf8');
    for (const match of [...inputCss.matchAll(/@import ['"](.+?)['"];?/g)]) inputCss = inputCss.replace(match[0], await readFile(path.resolve(root, 'src', match[1]), 'utf8'));
    const config = loadConfig(path.join(root, 'tailwind.config.ts')); config.content = [path.join(root, 'src/**/*.{ts,tsx}')];
    css = (await postcss([tailwind(config)]).process(inputCss, { from: path.join(root, 'src/index.css') })).css + '\n' + fonts.css;
    const chromeOnly = { name: 'local-layout', setup(b) {
        b.onResolve({ filter: /(?:HeaderSection|FooterSection|AdminSidebar)$/ }, args => ({ path: args.path, namespace: 'fixture-layout' }));
        b.onLoad({ filter: /.*/, namespace: 'fixture-layout' }, args => ({ loader: 'tsx', resolveDir: root, contents: args.path.endsWith('AdminSidebar')
            ? 'export default function Sidebar(){return null}'
            : `export function ${args.path.endsWith('HeaderSection') ? 'HeaderSection' : 'FooterSection'}(){return <div className="p-4 text-blue-900">ACTIV news</div>}` }));
    } };
    const built = await build({ absWorkingDir: root, bundle: true, write: false, format: 'iife', jsx: 'automatic', plugins: [chromeOnly],
        alias: { '@': path.join(root, 'src') }, define: { 'import.meta.env': JSON.stringify({ DEV: true, VITE_API_URL: `${base}/api/v1`, VITE_PUBLIC_SITE_URL: 'https://activ.org.in' }), 'process.env.NODE_ENV': '"production"' },
        stdin: { resolveDir: root, loader: 'tsx', contents: `
            import React from 'react'; import {createRoot} from 'react-dom/client'; import {MemoryRouter, Routes, Route} from 'react-router-dom';
            import NewsManager from './src/pages/cms/NewsManager';
            import CmsLayout from './src/pages/cms/CmsLayout';
            import {STORAGE_KEYS} from './src/config/api.config';
            import AdminNews from './src/features/admin/events-admin/pages/News';
            import NewsDetail from './src/pages/onboarding/NewsDetailPage';
            import {NewsGrid} from './src/pages/onboarding/components/NewsGrid';
            import {NewsBody} from './src/components/shared/NewsBody';
            import {hasNewsContent,newsDocumentHref,newsLinkHref,newsAssetsError} from './src/lib/newsContent';
            import {newsBodyHtml,newsTextNodes} from './src/lib/newsRichText';
            const root=createRoot(document.getElementById('root'));
            localStorage.setItem(STORAGE_KEYS.USER_ROLE,'cms_admin');
            localStorage.setItem(STORAGE_KEYS.USER_NAME,'CMS Admin');
            window.rules={hasNewsContent,newsDocumentHref,newsLinkHref,newsAssetsError,newsBodyHtml,newsTextNodes};
            window.mount=(kind, rows=[])=>root.render(<MemoryRouter key={kind} initialEntries={[kind==='cms'?'/cms/news':'/news/community-news']}>
                {kind==='cms'?<Routes><Route path="/cms" element={<CmsLayout/>}><Route path="news" element={<NewsManager/>}/></Route></Routes>:kind==='admin'?<AdminNews/>:kind==='grid'?<div className="mx-auto max-w-6xl p-4"><NewsGrid articles={rows}/></div>:kind==='body'?<NewsBody text={rows}/>:<Routes><Route path="/news/:slug" element={<NewsDetail/>}/></Routes>}
            </MemoryRouter>); window.mount('cms'); window.ready=true;
        ` } });
    bundle = built.outputFiles[0].text;
    chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    let port;
    for (let i = 0; i < 100; i++) { try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch {} await pause(100); }
    assert.ok(port, 'Chrome starts');
    const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
    ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
    await new Promise(resolve => ws.addEventListener('open', resolve));
    let seq = 0; const pending = new Map(), errors = [];
    ws.addEventListener('message', event => { const result = JSON.parse(event.data); if (result.method === 'Runtime.exceptionThrown') errors.push(result.params.exceptionDetails.exception?.description || result.params.exceptionDetails.text); pending.get(result.id)?.(result); pending.delete(result.id); });
    const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq, timer = setTimeout(() => reject(Error(method)), 45000); pending.set(id, result => { clearTimeout(timer); resolve(result); }); ws.send(JSON.stringify({ id, method, params })); });
    const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.result?.exceptionDetails) throw Error(result.result.exceptionDetails.exception?.description); return result.result?.result?.value; };
    const until = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(`Boolean(${expression})`)) return; await pause(100); } throw Error(`Timed out: ${expression}\n${await evaluate('document.body.innerText.slice(0,1500)')}`); };
    const click = label => evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===${JSON.stringify(label)}).click()`);
    const input = (label, value) => evaluate(`{const input=document.querySelector('[aria-label=${JSON.stringify(label)}]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));}`);
    const ariaClick = label => evaluate(`document.querySelector(${JSON.stringify(`[aria-label="${label}"]`)}).click()`);
    const selectText = value => evaluate(`(()=>{
        const box=document.querySelector('[aria-label="Article body"]');box.focus();
        const text=box.textContent, start=text.indexOf(${JSON.stringify(value)}), end=start+${value.length};
        if(start<0)throw Error('Selection text missing');
        const range=document.createRange(), walker=document.createTreeWalker(box,NodeFilter.SHOW_TEXT);let offset=0,node,started=false;
        while(node=walker.nextNode()){const next=offset+node.textContent.length;if(!started&&start<next){range.setStart(node,start-offset);started=true;}if(started&&end<=next){range.setEnd(node,end-offset);break;}offset=next;}
        const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);box.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
    })()`);
    const fontSize = size => evaluate(`{const input=document.querySelector('[aria-label="Article text size"]');input.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));input.focus();Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(input,${JSON.stringify(size)});input.dispatchEvent(new Event('change',{bubbles:true}));}`);
    const screenshot = async name => { const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await writeFile(path.join(artifacts, name + '.png'), Buffer.from(result.result.data, 'base64')); };
    const upload = (label, files, sameTickSave = false) => evaluate(`(async()=>{
        const input=document.querySelector('[aria-label=${JSON.stringify(label)}]');const transfer=new DataTransfer();
        for(const file of ${JSON.stringify(files)}){const canvas=document.createElement('canvas');canvas.width=160;canvas.height=100;const ctx=canvas.getContext('2d');ctx.fillStyle='#4169e1';ctx.fillRect(0,0,160,100);const blob=file.endsWith('.png')?await new Promise(resolve=>canvas.toBlob(resolve,'image/png')):new Blob(['%PDF fixture'],{type:'application/pdf'});transfer.items.add(new File([blob],file,{type:file.endsWith('.png')?'image/png':'application/pdf'}));}
        const button=[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Save article');
        const props=button&&button[Object.keys(button).find(key=>key.startsWith('__reactProps'))];
        input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
        ${sameTickSave ? 'props.onClick();' : ''}
    })()`);
    await send('Runtime.enable'); await send('Network.enable'); await send('Network.setBlockedURLs', { urls: ['https://*'] });
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: base }); await until('document.body.innerText.includes("Community news")'); await click('Edit');
    await evaluate('document.fonts.ready');
    const shellMetrics = () => evaluate(`(()=>{const main=document.querySelector('main');return {windowScroll:window.scrollY,documentHeight:document.documentElement.scrollHeight,viewport:innerHeight,mainBottom:main.getBoundingClientRect().bottom,mainHeight:main.clientHeight,mainScrollHeight:main.scrollHeight}})()`);
    const initialShell = await shellMetrics();
    assert.ok(initialShell.documentHeight <= initialShell.viewport + 1, 'CMS opens without a second document scrollbar');
    console.log('Checking editor formatting and selection preservation');
    await until('document.querySelector("[contenteditable=true]")');
    await evaluate(`{const box=document.querySelector('[aria-label="Article body"]');box.focus();const transfer=new DataTransfer();transfer.setData('text/html','<p style="font-size:22px" onclick="alert(1)">Pasted <strong>safe</strong><img src=x onerror="alert(2)"><script>alert(3)</script><a href="javascript:alert(4)">unsafe</a></p>');box.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:transfer}));}`);
    const pasted = await evaluate(`document.querySelector('[aria-label="Article body"]').innerHTML`);
    assert.ok(!/onclick|onerror|<script|<img|javascript:/i.test(pasted), 'rich paste removes active content');
    assert.match(pasted, /<strong>safe/); assert.match(pasted, /font-size:\s*22px/);
    await evaluate(`{const box=document.querySelector('[aria-label="Article body"]');box.textContent='Bold phrase, italic phrase, linked phrase, large phrase and extra large phrase.';box.dispatchEvent(new Event('input',{bubbles:true}));}`);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('[aria-label="Article body"]')).fontSize`), '18px');
    await selectText('Bold phrase'); await ariaClick('Bold');
    await selectText('italic phrase'); await ariaClick('Italic');
    await selectText('linked phrase'); await ariaClick('Underline');
    await evaluate(`document.querySelector('[aria-label="Article body"]').scrollIntoView({block:'center'})`);
    const bodyTop = await evaluate(`document.querySelector('[aria-label="Article body"]').getBoundingClientRect().top`);
    await click('Link');
    await until(`document.querySelector('[aria-label="Article link URL"]')===document.activeElement`);
    assert.equal(await evaluate(`document.querySelector('[data-link-selection]').textContent`), 'linked phrase', 'link editor identifies selected text');
    assert.equal(await evaluate(`document.querySelector('[aria-label="Article body"]').getBoundingClientRect().top`), bodyTop, 'opening link editor does not move article');
    assert.ok(await evaluate(`document.querySelector('[role="dialog"]').getBoundingClientRect().width<=370`), 'link editor is compact');
    await pause(200);
    assert.ok(await evaluate(`document.querySelector('[role="dialog"]').getBoundingClientRect().left>=document.querySelector('main').getBoundingClientRect().left`), 'desktop link editor anchors within the article column');
    await screenshot('article-hyperlink-desktop');
    await input('Article link URL', 'javascript:alert(1)'); await click('Insert link');
    assert.ok(await evaluate(`document.querySelector('[aria-label="Article link URL"]').getAttribute('aria-invalid')==='true'`), 'invalid links keep editor open');
    assert.equal(await evaluate(`document.querySelector('[aria-label="Article body"] a')`), null);
    await evaluate(`document.querySelector('[aria-label="Article link URL"]').focus()`);
    await input('Article link URL', 'https://activ.org.in/news?from=article&view=full'); await click('Insert link');
    await evaluate(`document.querySelector('[aria-label="Article body"] a').click()`);
    await until(`document.querySelector('[aria-label="Article link URL"]')`);
    assert.equal(await evaluate(`document.querySelector('[aria-label="Article link URL"]').value`), 'https://activ.org.in/news?from=article&view=full', 'clicking an existing link opens its editor');
    await ariaClick('Close link editor');
    await selectText('linked'); await click('Link');
    assert.equal(await evaluate(`document.querySelector('[aria-label="Article link URL"]').value`), 'https://activ.org.in/news?from=article&view=full', 'editing an existing link prefills its URL');
    assert.equal(await evaluate(`document.querySelector('[data-link-selection]').textContent`), 'linked phrase', 'partial selection edits the whole existing link');
    await input('Article link URL', 'https://activ.org.in/updated'); await click('Save link');
    assert.equal(await evaluate(`document.querySelector('[aria-label="Article body"] a').textContent`), 'linked phrase');
    assert.equal(await evaluate(`document.querySelectorAll('[aria-label="Article body"] a').length`), 1, 'editing does not split or nest links');
    await selectText('linked phrase'); await click('Link'); await click('Remove link');
    assert.equal(await evaluate(`document.querySelector('[aria-label="Article body"] a')`), null, 'remove link keeps its label as article text');
    assert.ok(await evaluate(`document.querySelector('[aria-label="Article body"] u').textContent==='linked phrase'`), 'remove link preserves other formatting');
    await selectText('linked phrase');
    await evaluate(`document.querySelector('[aria-label="Article body"]').dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true,cancelable:true}))`);
    await until(`document.querySelector('[aria-label="Article link URL"]')`);
    await input('Article link URL', 'https://activ.org.in/news?from=article&view=full');
    await evaluate(`document.querySelector('[aria-label="Article link URL"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}))`);
    await until(`!document.querySelector('[aria-label="Article link URL"]')`);
    await selectText('linked phrase'); await click('Link');
    await input('Article link URL', 'https://activ.org.in/not-saved');
    await ariaClick('Close link editor');
    assert.equal(await evaluate(`window.getSelection().toString()`), 'linked phrase', 'cancel restores selected article text');
    assert.equal(await evaluate(`document.querySelector('[aria-label="Article body"] a').href`), 'https://activ.org.in/news?from=article&view=full', 'cancel leaves saved URL unchanged');
    await evaluate(`{const box=document.querySelector('[aria-label="Article body"]');box.focus();const range=document.createRange();range.selectNodeContents(box);range.collapse(false);const selected=window.getSelection();selected.removeAllRanges();selected.addRange(range);box.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));}`);
    await click('Link'); await input('Article link text', 'More information'); await input('Article link URL', 'https://activ.org.in/info'); await click('Insert link');
    assert.equal(await evaluate(`document.querySelector('[aria-label="Article body"] a[href="https://activ.org.in/info"]').textContent`), 'More information', 'with no selection, custom link text is inserted at the caret');
    await selectText('More information'); await click('Link'); await click('Remove link');
    await selectText('large phrase'); await fontSize('22');
    await selectText('extra large phrase'); await fontSize('28');
    const formatted = await evaluate(`document.querySelector('[aria-label="Article body"]').innerHTML`);
    assert.match(formatted, /<(b|strong)>Bold phrase/); assert.match(formatted, /<(i|em)>italic phrase/);
    assert.ok(await evaluate(`document.querySelector('[aria-label="Article body"] a').textContent==='linked phrase'`));
    assert.ok(await evaluate(`[...document.querySelectorAll('[aria-label="Article body"] span')].some(node=>node.textContent==='large phrase'&&node.style.fontSize==='22px')`), 'font selection survives toolbar focus');
    assert.ok(await evaluate(`[...document.querySelectorAll('[aria-label="Article body"] span')].some(node=>node.textContent==='extra large phrase'&&node.style.fontSize==='28px')`));
    console.log('Checking batch uploads and save guard');
    await until('document.querySelector("input[aria-label=\\\"Add article photos\\\"]")');
    await upload('Add article photos', ['first.png', 'fail-photo.png', 'second.png'], true);
    assert.equal(writes.length, 0, 'same-tick Save handler cannot omit in-flight uploads');
    await until('document.body.innerText.includes("Fixture upload failure") && !document.querySelector("input[aria-label=\\\"Add article photos\\\"]").disabled');
    assert.equal(writes.length, 0);
    assert.equal(await evaluate('document.querySelectorAll("input[aria-label$=caption]").length'), 3, 'successful uploads survive a partial failure');
    await evaluate('document.querySelector("button[aria-label=\\\"Remove photo 1\\\"]").click()');
    await input('Photo 1 caption', 'Opening ceremony'); await input('Photo 2 caption', 'Community gathering');
    await evaluate('document.querySelector("button[aria-label=\\\"Move photo 2 up\\\"]").click()');
    await upload('Add news documents', ['agenda.pdf', 'fail-document.pdf']);
    await until('document.body.innerText.includes("fail-document.pdf: Fixture upload failure")');
    await input('Document 2 label', 'Meeting agenda');
    await click('Add related link'); await input('Link 1 label', 'Join the WhatsApp group'); await input('Link 1 URL', 'javascript:alert(1)');
    await click('Save article'); await until('document.body.innerText.includes("complete http:// or https://")'); assert.equal(writes.length, 0);
    await input('Link 1 URL', 'https://chat.whatsapp.com/FixtureInvite?mode=join');
    await click('Add related link'); await input('Link 2 label', 'Watch the announcement'); await input('Link 2 URL', 'https://youtu.be/fixture?si=abc&feature=shared');
    await evaluate('document.querySelector("input[aria-label=\\\"Add article photos\\\"]").closest("fieldset").scrollIntoView()'); await screenshot('editor-desktop');
    const scrolledShell = await shellMetrics();
    assert.equal(scrolledShell.windowScroll, 0, 'editing and scrollIntoView keep the CMS header on screen');
    assert.ok(scrolledShell.documentHeight <= scrolledShell.viewport + 1, 'uploads do not enlarge the document behind the CMS');
    assert.ok(scrolledShell.mainScrollHeight > scrolledShell.mainHeight, 'the editor remains independently scrollable');
    await evaluate('window.scrollTo(0,document.documentElement.scrollHeight)');
    assert.equal(await evaluate('window.scrollY'), 0, 'the page cannot scroll down into a blank background');
    await evaluate('document.querySelector("input[aria-label=\\\"Add news documents\\\"]").focus()');
    assert.equal(await evaluate('window.scrollY'), 0, 'focusing a hidden upload input stays inside the CMS');
    await screenshot('documents-desktop');
    await ariaClick('Switch to dark theme'); await screenshot('documents-dark'); await ariaClick('Switch to light theme');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await pause(250); // Let the responsive sidebar's transform finish before capturing.
    await screenshot('editor-mobile');
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'), 'mobile editor has no horizontal overflow');
    await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 760, deviceScaleFactor: 1, mobile: true });
    await pause(250);
    await evaluate(`document.querySelector('[aria-label="Article body"] a').scrollIntoView({block:'center'})`);
    await selectText('linked phrase'); await click('Link');
    await until(`document.querySelector('[role="dialog"]')`);
    await pause(200);
    const mobileLink = await evaluate(`(()=>{const rect=document.querySelector('[role="dialog"]').getBoundingClientRect();return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,width:rect.width}})()`);
    assert.ok(mobileLink.width>250&&mobileLink.left>=0&&mobileLink.right<=320&&mobileLink.top>=0&&mobileLink.bottom<=760, 'link editor stays visible within 320px viewport');
    await screenshot('article-hyperlink-small-mobile');
    await ariaClick('Close link editor');
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'), '320px editor has no horizontal overflow');
    assert.equal(await evaluate('window.scrollY'), 0, 'mobile CMS stays in the viewport');
    assert.ok((await shellMetrics()).documentHeight <= 761, 'mobile CMS has no extra document scrollbar');
    await screenshot('editor-small-mobile');
    failSave = true; await click('Save article'); await until('document.body.innerText.includes("Fixture save failure")');
    assert.equal(await evaluate('document.querySelector("input[aria-label=\\\"Document 2 label\\\"]").value'), 'Meeting agenda', 'failed save retains edited assets');
    failSave = false; await click('Save article'); await until('document.body.innerText.includes("National") && !document.querySelector("input[aria-label=\\\"Add article photos\\\"]")');
    assert.equal(writes.length, 1); assert.deepEqual(article.photos.map(photo => photo.alt), ['Community gathering', 'Opening ceremony']);
    assert.deepEqual(article.attachments.map(file => file.label), ['Existing notice', 'Meeting agenda']); assert.equal(article.links.length, 2);
    assert.equal(article.links[1].url, 'https://youtu.be/fixture?si=abc&feature=shared'); assert.equal(article.extraFields[0].value, 'News desk');
    assert.match(article.body, /<strong>Bold phrase/); assert.match(article.body, /<em>italic phrase/); assert.match(article.body, /<u>/);
    assert.match(article.body, /font-size:22px/); assert.match(article.body, /font-size:28px/);
    await click('Edit'); await until('document.querySelector("input[aria-label=\\\"Document 2 label\\\"]")');
    assert.equal(await evaluate('document.querySelector("input[aria-label=\\\"Photo 1 caption\\\"]").value'), 'Community gathering', 'saved order and captions reopen');
    assert.equal(await evaluate(`document.querySelector('[aria-label="Article body"] strong').textContent`), 'Bold phrase', 'formatting survives save and reopen');
    assert.equal(await evaluate(`document.querySelector('[aria-label="Article body"] a').href`), 'https://activ.org.in/news?from=article&view=full');
    await evaluate('window.mount("admin")'); await until('document.body.innerText.includes("Community news")'); await click('Edit'); await until('document.querySelector("input[aria-label=\\\"Add news documents\\\"]")');
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'), 'Events Admin uses the same mobile-safe editor');
    console.log('Checking public article, cards and mobile layouts');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await evaluate('window.mount("detail")'); await until('document.querySelector("section[aria-label=\\\"News documents\\\"]")');
    assert.equal(await evaluate(`document.querySelector('[data-news-body] strong').textContent`), 'Bold phrase');
    assert.equal(await evaluate(`document.querySelector('[data-news-body] em').textContent`), 'italic phrase');
    assert.equal(await evaluate(`document.querySelector('[data-news-body] u').textContent`), 'linked phrase');
    assert.equal(await evaluate(`getComputedStyle([...document.querySelectorAll('[data-news-body] span')].find(node=>node.textContent==='extra large phrase')).fontSize`), '28px');
    assert.equal(await evaluate(`document.querySelector('[data-news-body] a').rel`), 'noopener noreferrer');
    assert.equal(await evaluate('document.querySelectorAll("section[aria-label=\\\"News documents\\\"] a").length'), 2);
    assert.equal(await evaluate('document.querySelectorAll("section[aria-label=\\\"News related links\\\"] a").length'), 2);
    assert.equal(await evaluate('document.querySelectorAll("button[aria-label^=\\\"Enlarge image\\\"]").length'), 3);
    assert.ok(await evaluate('document.body.innerText.includes("Community gathering")'));
    await evaluate('window.scrollTo(0,0)'); await screenshot('detail-mobile');
    assert.ok(await evaluate('[...document.querySelectorAll("button")].some(button=>button.textContent.trim()==="Share"&&button.getBoundingClientRect().top<innerHeight)'), 'article Share is visible near the headline on mobile');
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'), 'mobile article has no horizontal overflow');
    await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 760, deviceScaleFactor: 1, mobile: true });
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'), '320px article has no horizontal overflow');
    await screenshot('detail-small-mobile');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }); await screenshot('detail-desktop');
    const bare = { ...article, id: 'bare', slug: 'bare-source', title: 'Bare source', summary: '', body: '', photos: [], attachments: [], links: [], extraFields: [] };
    await evaluate(`window.mount('grid', ${JSON.stringify([article, bare])})`); await until('document.querySelector("a[href=\\\"/news/community-news\\\"]")');
    assert.ok(await evaluate('document.querySelector("a[href=\\\"https://example.test/source\\\"]")?.target==="_blank"'), 'bare source-only cards retain external navigation');
    assert.equal(await evaluate('[...document.querySelectorAll("button")].filter(button=>button.textContent.trim()==="Share").length'), 2);
    assert.ok(await evaluate('[...document.querySelectorAll("button")].filter(button=>button.textContent.trim()==="Share").every(button=>!button.closest("a"))'), 'card Share is independent of article links');
    await click('Share'); await until('document.querySelector("[role=menu]")');
    assert.ok(await evaluate('document.querySelector("[role=menu] a[href^=\\\"https://wa.me/\\\"]").href.includes(encodeURIComponent("https://activ.org.in/news/community-news"))'), 'share uses the canonical article URL');
    const limits = await evaluate(`({ photos:rules.newsAssetsError({photos:Array(21).fill({url:'/uploads/a.png'})}), docs:rules.newsAssetsError({attachments:Array(11).fill({url:'/uploads/a.pdf'})}), links:rules.newsAssetsError({links:Array(11).fill({url:'https://example.test'})}), badLink:rules.newsLinkHref('javascript:alert(1)'), badDocument:rules.newsDocumentHref('data:text/html,bad'), insecureDocument:rules.newsDocumentHref('http://example.test/file.pdf') })`);
    assert.ok(limits.photos && limits.docs && limits.links); assert.equal(limits.badLink, ''); assert.equal(limits.badDocument, ''); assert.equal(limits.insecureDocument, '');
    const unsafe = '<p onclick="alert(1)">Safe <strong>bold</strong><img src=x onerror="alert(2)"><script>alert(3)</script><iframe src="https://example.test"></iframe><svg><text>bad</text></svg><a href="javascript:alert(4)">unsafe link</a><a href="https://activ.org.in" onclick="alert(5)">safe link</a><span style="font-size:999px;color:red">bounded</span><span style="font-size:22px;background-image:url(https://example.test)">large</span></p>';
    const sanitized = await evaluate(`rules.newsBodyHtml(${JSON.stringify(unsafe)})`);
    assert.ok(!/onclick|onerror|<script|<img|<iframe|<svg|javascript:|999px|color:|background/i.test(sanitized)); assert.match(sanitized, /font-size:22px/);
    await evaluate(`window.mount('body',${JSON.stringify(unsafe)})`); await until('document.querySelector("[data-news-body]")');
    assert.equal(await evaluate('document.querySelectorAll("[data-news-body] a").length'), 1);
    assert.equal(await evaluate('document.querySelectorAll("[data-news-body] [onclick], [data-news-body] iframe, [data-news-body] img").length'), 0);
    const plain = await evaluate(`rules.newsBodyHtml('Legacy first line\\nSecond line\\n\\nNext paragraph < 5 & 6 > 4')`);
    assert.equal(plain, '<p>Legacy first line<br>Second line</p><p>Next paragraph &lt; 5 &amp; 6 &gt; 4</p>');
    assert.equal(await evaluate(`rules.newsBodyHtml('<p style="font-size:28px">Pasted heading</p>')`), '<p><span style="font-size:28px">Pasted heading</span></p>', 'pasted size uses native-compatible spans');
    assert.deepEqual(errors, []);
    console.log(`PASS: news CMS + Events Admin batch uploads, partial upload/save failure preservation, ordering/captions, same-tick upload guard, document/link persistence, partial-selection bold/italic/underline/link/font sizes, save/reopen, public resources and safe formatted/plain text, independent card Share, limits and 320/390/1440px layouts. ${uploadRequests.length} local uploads; ${writes.length} local saves. Screenshots: ${artifacts}`);
} finally {
    if (ws?.readyState === WebSocket.OPEN) await new Promise(resolve => {
        const timer = setTimeout(resolve, 2000);
        ws.addEventListener('close', () => { clearTimeout(timer); resolve(); }, { once: true });
        try { ws.send(JSON.stringify({ id: 1000000, method: 'Browser.close' })); } catch { clearTimeout(timer); resolve(); }
    });
    ws?.close(); if (chrome?.exitCode == null) chrome?.kill(); chrome?.unref(); stop();
    const serverClosed = new Promise(resolve => server.close(resolve)); server.closeAllConnections(); await serverClosed;
    if (path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep + 'activ-news-assets-')) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
