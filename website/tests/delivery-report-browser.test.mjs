// Real Chrome layout and interactions; reporting data is an isolated fixture.
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, stop } from "esbuild";
import postcss from "postcss";
import tailwind from "tailwindcss";
import loadConfig from "tailwindcss/loadConfig.js";
const root = fileURLToPath(new URL("..", import.meta.url));
const artifacts = process.env.TEST_ARTIFACTS ? path.resolve(process.env.TEST_ARTIFACTS) : path.join(root, "../artifacts/delivery-report");
const profile = await mkdtemp(path.join(tmpdir(), "activ-delivery-report-"));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let bundle = "",
  css = "",
  chrome,
  ws;
const server = http.createServer((req, res) => {
  if (req.url === "/bundle.js") {
    res.setHeader("Content-Type", "text/javascript");
    return res.end(bundle);
  }
  if (req.url === "/style.css") {
    res.setHeader("Content-Type", "text/css");
    return res.end(css);
  }
  res.end(
    '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><main id="root" style="padding:16px;max-width:1440px;margin:auto"></main><script src="/bundle.js"></script></body></html>'
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const counts = {
  records: 80,
  accepted: 60,
  delivered: 13,
  opened: 12,
  failed: 4,
  queued: 8,
  skipped: 8,
  unconfirmed: 68,
};
const fixture = {
  summary: { ...counts, recipients: 20 },
  channels: ["email", "whatsapp", "push", "in_app"].map((_id) => ({
    ...counts,
    _id,
    records: 20,
    accepted: 15,
    delivered: _id === "whatsapp" ? 13 : 0,
    opened: _id === "email" ? 0 : 4,
  })),
  campaigns: [
    {
      ...counts,
      _id: "publication:announcement:fixture:v1",
      kind: "announcement",
      title: "Regional association update",
      currentAudience: "lifetime",
      createdAt: "2026-10-16T10:00:00Z",
      lastAt: "2026-10-16T10:00:00Z",
    },
  ],
  rows: [
    {
      _id: "wa:fixture",
      channel: "whatsapp",
      recipientName: "Asha Test",
      recipient: "+919123456780",
      title: "Regional association update",
      campaignKey: "publication:announcement:fixture:v1",
      status: "read",
      createdAt: "2026-10-16T10:00:00Z",
      openedAt: "2026-10-16T10:04:00Z",
      deliveredAt: "2026-10-16T10:01:00Z",
      history: [
        { status: "accepted", at: "2026-10-16T10:00:01Z" },
        { status: "read", at: "2026-10-16T10:04:00Z" },
      ],
    },
    {
      _id: "push:fixture",
      channel: "push",
      recipientName: "Very Long Member Name For A Narrow Screen",
      recipient: "long-member-email-address@example.test",
      title: "Regional association update",
      campaignKey: "publication:announcement:fixture:v1",
      status: "failed",
      error: "This recipient has no enabled push device.",
      createdAt: "2026-10-16T10:00:00Z",
    },
    ...[
      ["email", "accepted", "Email Member"],
      ["email", "failed", "Refused Email Member"],
      ["whatsapp", "delivered", "Delivered Member"],
      ["whatsapp", "sent", "Handset Member"],
      ["in_app", "marked_read", "Read-inbox Member"],
      ["push", "queued", "Queued Member"],
      ...Array.from({ length: 22 }, () => ["email", "accepted", "Email Member"]),
    ].map(([channel, status, recipientName], index) => ({
      _id: `extra:${index}`,
      channel,
      status,
      recipientName,
      recipient: `${recipientName.replaceAll(" ", "-").toLowerCase()}@example.test`,
      title: index === 0 ? "A very long notification subject that must wrap without moving the outcome column or hiding its final words" : "Regional association update",
      campaignKey: "publication:announcement:fixture:v1",
      createdAt: "2026-10-16T10:00:00Z",
    })),
  ],
  pagination: { page: 1, limit: 25, total: 2, pages: 1 },
  campaignPagination: { page: 1, total: 1, pages: 1 },
  generatedAt: "2026-10-16T12:00:00Z",
};
try {
  const config = loadConfig(path.join(root, "tailwind.config.ts"));
  config.content = [path.join(root, "src/**/*.{ts,tsx}")];
  css = (await postcss([tailwind(config)]).process(
    await readFile(path.join(root, "src/index.css"), "utf8"),
    { from: path.join(root, "src/index.css") },
  )).css;
  const built = await build({
    bundle: true,
    write: false,
    format: "iife",
    jsx: "automatic",
    absWorkingDir: root,
    define: { "process.env.NODE_ENV": '"test"' },
    plugins: [
      {
        name: "isolated-report",
        setup(b) {
          b.onResolve({filter:/^(?:@\/services\/api|\.\/api)$/},()=>({path:'api',namespace:'isolated-api'}));
          b.onLoad({filter:/.*/,namespace:'isolated-api'},()=>({contents:`
            const unexpected=()=>{throw Error('Unexpected live API request in local fixture')};
            export default {get:unexpected,post:unexpected,put:unexpected,patch:unexpected};
            export const unwrap=(value)=>value;
            export const errorMessage=(e,f)=>e.message||f;
          `}));
          b.onResolve({filter:/^sonner$/},()=>({path:'toast',namespace:'isolated-toast'}));
          b.onLoad({filter:/.*/,namespace:'isolated-toast'},()=>({contents:`export const toast=Object.fromEntries(['success','error','info'].map(kind=>[kind,(title,options)=>window.legacyToasts.push({kind,title,...options})]));`}));
          b.onResolve({filter:/^@\/services\/notificationDeliveryApi$/},()=>({path:'legacy',namespace:'isolated-legacy'}));
          b.onLoad({filter:/.*/,namespace:'isolated-legacy'},()=>({contents:`
            export const getBookingDelivery=async()=>({});
            export const resendNotification=async id=>{window.legacyRetryCalls.push(id);await new Promise(resolve=>window.finishLegacyRetry=resolve);if(window.legacyRetryError)throw Error(window.legacyRetryError);return window.legacyRetryResult};
          `}));
          b.onResolve(
            { filter: /^@\/services\/(deliveryReportApi|activApi)$/ },
            (args) => ({ path: args.path, namespace: "fixture" })
          );
          b.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
            resolveDir: root,
            contents: args.path.endsWith("activApi")
              ? "export const errorMessage=(e,f)=>e.message || f;"
              : `
        import {CHANNEL_LABELS,statusLabel} from ${JSON.stringify(path.join(root,'src/services/deliveryReportApi.ts'))};
        export {CHANNEL_LABELS,statusLabel};
        const fixture=${JSON.stringify(fixture)};
        window.useLargeFailureFixture=()=>{fixture.rows=Array.from({length:105},(_,index)=>({
          _id:'failure-'+index,channel:index<100?'push':'email',status:'failed',recipientName:'Failed recipient '+index,
          recipient:'fixture@example.test',title:'Regional association update',campaignKey:'automation:fixture',createdAt:'2026-10-16T10:00:00Z'
        }))};
        window.useRowActionsFixture=()=>{fixture.rows=[
          ...['email','whatsapp','push','visitor-push'].map(channel=>({_id:channel+':resend',channel:channel==='visitor-push'?'push':channel,status:'failed',recipientName:channel+' recipient',recipient:'fixture@example.test',title:channel==='whatsapp'?'event_reminder_photo_v4':'Fixture message',templateId:channel==='whatsapp'?'event_reminder_photo_v4':undefined,event:'EVENT_BOOKING_REMINDER',createdAt:'2026-10-16T10:00:00Z',error:channel==='whatsapp'?'Media upload error: Downloading media from weblink failed with http code503, status message Service Unavailable (code131053)':''})),
          ...['accepted','sent','delivered','read','queued','skipped','unknown'].map(status=>({_id:'email:'+status,channel:'email',status,recipientName:status+' recipient',title:'Fixture message'})),
          {_id:'in_app:failed',channel:'in_app',status:'failed',recipientName:'In-app recipient',title:'Fixture message'},
          {_id:'in_app:accepted',channel:'in_app',status:'accepted',recipientName:'In-app accepted',title:'Fixture message'}
        ]};
        window.retryPreviewCalls=[];window.retryCalls=[];window.reportReads=0;
        export const getDeliveryRetryStatus=async()=>({found:false,processing:false});
        export const previewDeliveryRetry=async selection=>{
          window.retryPreviewCalls.push(selection);
          const filters=selection.filters||{};
          const rows=fixture.rows.filter(r=>r.status==='failed'&&(!selection.ids||selection.ids.includes(r._id))&&(!filters.channel||r.channel===filters.channel));
          const reviewed=selection.ids?rows:rows.slice(0,100);
          const eligible=reviewed.filter(r=>r.channel!=='push');
          return {matched:rows.length,reviewed:reviewed.length,remaining:rows.length-reviewed.length,eligible:eligible.length,skipped:reviewed.length-eligible.length,ids:eligible.map(r=>r._id),token:eligible.length?'review-fixture':'',truncated:rows.length>reviewed.length,reasons:reviewed.length>eligible.length?[{reason:'Current delivery or recipient eligibility could not be verified.',count:reviewed.length-eligible.length}]:[]};
        };
        export const retryDeliveryReport=async confirmation=>{
          window.retryCalls.push(confirmation);
          await new Promise(resolve=>window.finishRetry=resolve);
          fixture.rows.forEach(r=>{if(confirmation.ids.includes(r._id))r.status='accepted'});
          return {attempted:confirmation.ids.length,sent:confirmation.ids.length,queued:0,failed:0,skipped:0,reasons:[]};
        };
        const accepted=['accepted','sent','delivered','read','marked_read'];
        const counts=rows=>({records:rows.length,accepted:rows.filter(r=>accepted.includes(r.status)).length,opened:rows.filter(r=>r.status==='read').length,delivered:rows.filter(r=>r.channel==='whatsapp'&&['delivered','read'].includes(r.status)).length,failed:rows.filter(r=>r.status==='failed').length,queued:rows.filter(r=>r.status==='queued').length,skipped:rows.filter(r=>['skipped','mock'].includes(r.status)).length,unconfirmed:rows.filter(r=>r.status!=='read').length});
        export const getDeliveryReport=async filters=>{
          window.reportReads++;
          window.lastFilters=filters;
          let base=fixture.rows.filter(r=>!filters.channel||r.channel===filters.channel);
          if(filters.campaignKey)base=base.filter(r=>r.campaignKey===filters.campaignKey);
          if(filters.search)base=base.filter(r=>(r.recipientName+r.recipient).toLowerCase().includes(filters.search.toLowerCase()));
          let rows=base;
          if(filters.status==='accepted_any')rows=rows.filter(r=>accepted.includes(r.status));
          else if(filters.status==='unconfirmed')rows=rows.filter(r=>r.status!=='read');
          else if(filters.status==='delivered')rows=rows.filter(r=>r.channel==='whatsapp'&&['delivered','read'].includes(r.status));
          else if(filters.status)rows=rows.filter(r=>r.status===filters.status);
          const page=filters.page||1,limit=filters.limit||25;
          const report={...fixture,summary:{...counts(base),recipients:new Set(base.map(r=>r.recipientName)).size},channels:Object.keys(CHANNEL_LABELS).map(_id=>({_id,...counts(base.filter(r=>r.channel===_id))})),rows:rows.slice((page-1)*limit,page*limit),pagination:{page,limit,total:rows.length,pages:Math.max(1,Math.ceil(rows.length/limit))}};
          window.lastReport=report;return report;
        };
      `,
          }));
        },
      },
    ],
    stdin: {
      resolveDir: root,
      loader: "tsx",
      contents: `import React from 'react';import{createRoot}from'react-dom/client';import Report from './src/features/admin/super-admin/pages/NotificationReports';import{notificationReason,notificationTemplatePath}from'./src/utils/notificationCopy';window.notificationCopy={notificationReason,notificationTemplatePath};import{ResendButton,DeliveryBadge}from'./src/features/admin/components/DeliveryUI';window.legacyRetryCalls=[];window.legacyToasts=[];window.legacyRetryResult={row:{effectiveStatus:'accepted'},message:'Re-sent'};window.renderLegacyRows=()=>{const node=document.createElement('section');node.id='legacy-fixture';document.body.append(node);createRoot(node).render(<>{['accepted','sent','delivered','read','queued','resent','mock','failed'].map(state=><div data-legacy-state={state} key={state}><DeliveryBadge state={state}/><ResendButton row={{_id:state,event:'EVENT_BOOKING_REMINDER',channel:'whatsapp',status:'failed',effectiveStatus:state,recipient:'fixture@example.test'}}/></div>)}{['PASSWORD_RESET','ADMIN_WELCOME'].map(event=><div data-legacy-state={event} key={event}><ResendButton row={{_id:event,event,channel:'email',status:'failed',effectiveStatus:'failed',recipient:'fixture@example.test'}}/></div>)}<div data-legacy-state="in_app"><ResendButton row={{_id:'in_app',event:'ASSOCIATION_UPDATE',channel:'in_app',status:'failed',effectiveStatus:'failed'}}/></div></>)};createRoot(document.getElementById('root')).render(<Report/>);`,
    },
  });
  bundle = built.outputFiles[0].text;
  chrome = spawn(
    process.env.CHROME ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    [
      "--headless=new",
      "--disable-gpu",
      "--disable-background-networking",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "about:blank",
    ],
    { windowsHide: true, stdio: "ignore" }
  );
  let port;
  for (let i = 0; i < 150; i++) {
    try {
      port = (
        await readFile(path.join(profile, "DevToolsActivePort"), "utf8")
      ).split("\n")[0];
      if (port) break;
    } catch {}
    await pause(100);
  }
  assert(port, "Chrome starts");
  const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) =>
    r.json()
  );
  ws = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener("open", resolve));
  let seq = 0;
  const pending = new Map(),
    errors = [];
  ws.addEventListener("message", (event) => {
    const m = JSON.parse(event.data);
    if (m.method === "Runtime.exceptionThrown")
      errors.push(
        m.params.exceptionDetails.exception?.description ||
          m.params.exceptionDetails.text
      );
    pending.get(m.id)?.(m);
    pending.delete(m.id);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++seq,
        timer = setTimeout(() => reject(Error(method)), 45000);
      pending.set(id, (r) => {
        clearTimeout(timer);
        resolve(r);
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.result?.exceptionDetails)
      throw Error(r.result.exceptionDetails.exception?.description);
    return r.result?.result?.value;
  };
  const until = async (expression) => {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(`Boolean(${expression})`)) return;
      await pause(100);
    }
    throw Error(expression + "\n" + errors.join("\n"));
  };
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Network.setBlockedURLs", { urls: ["https://*"] });
  await send("Page.navigate", { url: origin });
  await until('document.body.textContent.includes("Asha Test")');
  const unknownReasons = [
    'Email address is too long', 'Email marketing policy refused this message',
    'Email was undeliverable', 'Email message reference 132005 and batch 535 failed',
    'SMTP configuration has an invalid port number.',
    'Media upload error: Unsupported media format (code131053)', 'Email reference 131053 is unknown',
    'Unknown sending service response: route Q7', 'Sent on "backup" after "original": (#132005) too long',
  ];
  for (const reason of unknownReasons) {
    assert.equal(await evaluate(`window.notificationCopy.notificationReason(${JSON.stringify(reason)})`), reason, 'unknown/provider diagnostic text is preserved');
  }
  assert.equal(await evaluate('window.notificationCopy.notificationReason("(#132005) Translated text too long")'), 'The message was too long for WhatsApp.');
  assert.equal(await evaluate('window.notificationCopy.notificationTemplatePath("photo template skipped: no image | sent on backup")'), 'photo template not used: no image | sent using backup');
  for (const width of [320, 390, 768, 1440]) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });
    await pause(200);
    assert(
      await evaluate("document.documentElement.scrollWidth <= innerWidth"),
      `report fits ${width}px`
    );
    if (width >= 640) {
      assert(await evaluate(`(() => {
        const rows=[...document.querySelectorAll('[data-report-row]')];
        return ['recipient','notification','outcome'].every(column=>{
          const lefts=rows.map(row=>row.querySelector('[data-report-column="'+column+'"]').getBoundingClientRect().left);
          return Math.max(...lefts)-Math.min(...lefts)<1;
        }) && Math.max(...rows.map(row=>row.lastElementChild.lastElementChild.getBoundingClientRect().right))
          -Math.min(...rows.map(row=>row.lastElementChild.lastElementChild.getBoundingClientRect().right))<1;
      })()`), `recipient, notification, outcome columns and chevrons align at ${width}px`);
    } else {
      assert(await evaluate(`(() => {
        const row=document.querySelector('[data-report-row]');
        const recipient=row.children[0].getBoundingClientRect(),notification=row.children[1].getBoundingClientRect();
        return notification.top>=recipient.bottom && Math.abs(notification.left-recipient.left)<1;
      })()`), `recipient rows stack on ${width}px`);
    }
    await evaluate("window.scrollTo(0,0)");
    const screenshot = await send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    const dir = artifacts;
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, `report-${width}.png`),
      Buffer.from(screenshot.result.data, "base64")
    );
    await evaluate('document.getElementById("delivery-report-recipient-heading").scrollIntoView()');
    const recipients = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    await writeFile(path.join(dir, `report-recipients-${width}.png`), Buffer.from(recipients.result.data, "base64"));
  }
  const initialFrom = await evaluate("window.lastFilters.from");
  await evaluate(
    '[...document.querySelectorAll("button")].find(b=>b.textContent.includes("Regional association update")).click()'
  );
  await until("window.lastFilters.campaignKey");
  const campaignKey = await evaluate("window.lastFilters.campaignKey");
  await evaluate('document.querySelector("[aria-label=\\"Next people and messages\\"]").click()');
  await until("window.lastFilters.page === 2");
  await evaluate('document.querySelector("[aria-label=\\"Show sent / in activ\\"]").click()');
  await until('window.lastFilters.status === "accepted_any" && window.lastFilters.page === 1');
  await until('document.body.textContent.includes("Read-inbox Member")');
  assert(await evaluate('document.body.textContent.includes("Delivered Member") && document.body.textContent.includes("Handset Member")'));
  assert(await evaluate('window.lastReport.pagination.total === window.lastReport.summary.accepted'));
  assert.equal(await evaluate('document.activeElement.id'), "delivery-report-recipient-heading", "summary card reveals and focuses details");
  assert.equal(await evaluate('document.querySelector("[aria-label=\\"Show sent / in activ\\"]").getAttribute("aria-pressed")'), "true");
  await evaluate('document.querySelector("[aria-label=\\"Report delivery outcome\\"]").value="accepted";document.querySelector("[aria-label=\\"Report delivery outcome\\"]").dispatchEvent(new Event("change",{bubbles:true}))');
  await until('window.lastFilters.status === "accepted"');
  await until('!document.body.textContent.includes("Delivered Member")');
  assert(await evaluate('window.lastReport.rows.every(r=>r.status === "accepted")'), "existing exact accepted filter remains available");

  await send("Page.bringToFront");
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await evaluate('document.querySelector("[aria-label=\\"Show seen\\"]").focus()');
  assert.equal(await evaluate('document.activeElement.getAttribute("aria-label")'), "Show seen");
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", text: "\r", windowsVirtualKeyCode: 13 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await until('window.lastFilters.status === "read"');
  await until('document.querySelectorAll("[data-report-row]").length === 1');
  assert(await evaluate('document.body.textContent.includes("Asha Test")'), "keyboard opens confirmed recipient records");
  await evaluate('document.querySelector("[aria-label=\\"Filter delivery records by WhatsApp\\"]").click()');
  await until('window.lastFilters.channel === "whatsapp"');
  assert.equal(await evaluate('window.lastFilters.status'), "read", "channel cards preserve selected outcome");
  assert.equal(await evaluate('window.lastFilters.campaignKey'), campaignKey, "cards preserve selected campaign");
  assert.equal(await evaluate('window.lastFilters.from'), initialFrom, "cards preserve date range");
  assert.equal(await evaluate('document.querySelector("[aria-label=\\"Filter delivery records by WhatsApp\\"]").getAttribute("aria-pressed")'), "true");
  await evaluate('document.querySelector("[aria-label=\\"Filter delivery records by WhatsApp\\"]").click()');
  await until('window.lastFilters.channel === ""');
  await evaluate('document.querySelector("[aria-label=\\"Show failed\\"]").click()');
  await until('window.lastFilters.status === "failed"');
  await until('document.querySelectorAll("[data-report-row]").length === 2');
  await evaluate('document.querySelector("[aria-label=\\"Filter delivery records by Email\\"]").click()');
  await until('window.lastFilters.channel === "email"');
  await until('document.querySelectorAll("[data-report-row]").length === 1');
  assert(await evaluate('document.body.textContent.includes("Refused Email Member")'));
  await evaluate('document.querySelector("[aria-label=\\"Show people and contacts\\"]").click()');
  await until('window.lastFilters.status === ""');
  assert.equal(await evaluate('window.lastFilters.channel'), "email", "recipient card retains channel scope");
  await until('document.querySelectorAll("[data-report-row]").length > 1');
  assert(await evaluate('window.lastReport.summary.recipients < window.lastReport.pagination.total'), "identity count is distinct from delivery records");
  assert(await evaluate('document.body.textContent.includes("The same person can appear more than once")'));
  await evaluate('document.querySelector("[aria-label=\\"Filter delivery records by Email\\"]").click()');
  await until('window.lastFilters.channel === ""');
  await evaluate(
    'document.querySelector("[aria-label=\\"Report delivery outcome\\"]").value="unconfirmed";document.querySelector("[aria-label=\\"Report delivery outcome\\"]").dispatchEvent(new Event("change",{bubbles:true}))'
  );
  await until('window.lastFilters.status === "unconfirmed"');
  await until('!document.body.textContent.includes("Asha Test")');
  await evaluate(
    '[...document.querySelectorAll("button")].find(b=>b.textContent.includes("Very Long Member Name")).click()'
  );
  await until(
    'document.body.textContent.includes("No phone or browser is currently set up to receive notifications for this person.")'
  );
  assert(
    await evaluate(
      'document.body.textContent.includes("Email opens are not tracked")'
    )
  );
  await send("Emulation.setDeviceMetricsOverride", { width: 320, height: 1000, deviceScaleFactor: 1, mobile: true });
  await pause(200);
  assert(await evaluate("document.documentElement.scrollWidth <= innerWidth"), "expanded recipient contact, error and timeline fit a narrow screen");
  await evaluate('document.querySelector("[aria-label=\\"Resend Push notifications message to Very Long Member Name For A Narrow Screen\\"]").click()');
  await until('document.body.textContent.includes("0 ready to resend")');
  assert(await evaluate('document.body.textContent.includes("We could not check whether this message can be sent again. Please try again.")'), 'stored/API retry reason is explained in plain words');
  assert.equal(await evaluate('window.lastReport.rows.find(r=>r._id==="push:fixture").error'), 'This recipient has no enabled push device.', 'display wording leaves the raw stored reason unchanged');
  assert.equal(await evaluate('window.lastReport.rows.find(r=>r._id==="push:fixture").status'), 'failed', 'retry gating continues to receive raw status values');
  assert.deepEqual(await evaluate('window.retryPreviewCalls.at(-1)'), { ids: ['push:fixture'] }, 'individual review sends only the selected report ID');
  assert(await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="Confirm resend (0)").disabled'), 'ineligible deliveries cannot be resent');
  assert.equal(await evaluate('window.retryCalls.length'), 0, 'reviewing a failure performs no send');
  assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'), 'confirmation fits 320px');
  await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="Cancel resend").click()');
  await until('!document.querySelector("[aria-label=\\"Review failed delivery resend\\"]")');
  await evaluate('document.querySelector("[aria-label=\\"Report activity\\"]").value="automation";document.querySelector("[aria-label=\\"Report activity\\"]").dispatchEvent(new Event("change",{bubbles:true}))');
  await until('window.lastFilters.group==="automation"');
  await evaluate('document.querySelector("[aria-label=\\"Filter delivery records by Email\\"]").click()');
  await until('window.lastFilters.channel==="email"');
  await until('!document.querySelector("[aria-busy=\\"true\\"]")');
  await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="Review failed deliveries").click()');
  await until('document.body.textContent.includes("1 ready to resend")');
  const previewFilters = await evaluate('window.retryPreviewCalls.at(-1).filters');
  assert.equal(previewFilters.group, 'automation');
  assert.equal(previewFilters.channel, 'email');
  assert.equal(previewFilters.from, initialFrom);
  assert.equal(previewFilters.status, 'failed', 'review overrides non-failure outcome without dropping activity/date/channel filters');
  assert.equal(await evaluate('window.retryCalls.length'), 0);
  const readsBeforeRetry = await evaluate('window.reportReads');
  await evaluate('(()=>{const b=[...document.querySelectorAll("button")].find(b=>b.textContent==="Confirm resend (1)");b.click();b.click()})()');
  await until('window.retryCalls.length===1');
  assert.deepEqual(await evaluate('window.retryCalls[0]'), { ids: ['extra:1'], token: 'review-fixture' }, 'confirmation sends the frozen eligible IDs and review token');
  assert(await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="Resending…").disabled'), 'repeat clicks are disabled');
  await evaluate('window.finishRetry()');
  await until('document.body.textContent.includes("1 tried · 1 sent · 0 waiting to send · 0 failed · 0 not sent")');
  await until(`window.reportReads>${readsBeforeRetry}`);
  assert.equal(await evaluate('window.retryCalls.length'), 1);
  await evaluate('window.useLargeFailureFixture();document.querySelector("[aria-label=\\"Report activity\\"]").value="";document.querySelector("[aria-label=\\"Report activity\\"]").dispatchEvent(new Event("change",{bubbles:true}));document.querySelector("[aria-label=\\"Report channel\\"]").value="";document.querySelector("[aria-label=\\"Report channel\\"]").dispatchEvent(new Event("change",{bubbles:true}));document.querySelector("[aria-label=\\"Report delivery outcome\\"]").value="failed";document.querySelector("[aria-label=\\"Report delivery outcome\\"]").dispatchEvent(new Event("change",{bubbles:true}))');
  await until('window.lastReport.pagination.total===105 && !document.querySelector("[aria-busy=\\"true\\"]")');
  await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="Review failed deliveries").click()');
  await until('document.body.textContent.includes("100 not sent")');
  assert(await evaluate('document.body.textContent.includes("Batch review starts with the newest 100 failures") && document.body.textContent.includes("go through the pages of people and messages")'), 'capped review explains how to reach later failures');
  assert(await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="Confirm resend (0)").disabled'));
  assert.equal(await evaluate('window.retryCalls.length'), 1, 'initial ineligible batch does not send');
  for (let page = 2; page <= 5; page++) {
    await evaluate('document.querySelector("[aria-label=\\"Next people and messages\\"]").click()');
    await until(`window.lastFilters.page===${page} && !document.querySelector('[aria-busy="true"]')`);
  }
  await evaluate('document.querySelector("[aria-label=\\"Review failed deliveries on this page\\"]").click()');
  await until('document.body.textContent.includes("5 ready to resend")');
  const laterIds = Array.from({ length: 5 }, (_, index) => `failure-${index + 100}`);
  assert.deepEqual(await evaluate('window.retryPreviewCalls.at(-1)'), { ids: laterIds }, 'page five reviews its exact visible failures instead of restarting at the first 100');
  assert(await evaluate('document.body.textContent.includes("Failed deliveries on page 5")'));
  assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'), 'page-review actions and guidance fit 320px');
  await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="Confirm resend (5)").click()');
  await until('window.retryCalls.length===2');
  assert.deepEqual(await evaluate('window.retryCalls.at(-1)'), { ids: laterIds, token: 'review-fixture' });
  await evaluate('window.finishRetry()');
  await until('document.body.textContent.includes("5 tried · 5 sent")');
  // Failed rows expose their own action even while history is collapsed.
  await evaluate('window.useRowActionsFixture();document.querySelector("[aria-label=\\"Show people and contacts\\"]").click()');
  await until('window.lastReport.pagination.total===13 && !document.querySelector("[aria-busy=\\"true\\"]")');
  assert.equal(await evaluate('document.querySelectorAll("[data-delivery-id] button[aria-label^=Resend]").length'),4);
  for(const id of ['email:resend','whatsapp:resend','push:resend','visitor-push:resend']) {
    const wrapper=`document.querySelector('[data-delivery-id="${id}"]')`;
    assert.equal(await evaluate(`${wrapper}.querySelector('[data-report-row]').getAttribute('aria-expanded')`),'false');
    assert(await evaluate(`${wrapper}.querySelector('button[aria-label^=Resend]').getBoundingClientRect().height>=44`),'Resend has a usable target');
    const sendsBefore=await evaluate('window.retryCalls.length');
    await evaluate(`${wrapper}.querySelector('button[aria-label^=Resend]').click()`);
    await until('document.querySelector("[aria-label=\\"Review failed delivery resend\\"]")');
    assert.deepEqual(await evaluate('window.retryPreviewCalls.at(-1)'),{ids:[id]});
    assert.equal(await evaluate('window.retryCalls.length'),sendsBefore,'A row action reviews only and cannot send without confirmation');
    await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="Cancel resend").click()');
  }
  for(const status of ['accepted','sent','delivered','read','queued','skipped','unknown']) assert.equal(await evaluate(`document.querySelector('[data-delivery-id="email:${status}"] button[aria-label^=Resend]')===null`),true,`${status} is not retryable`);
  assert.equal(await evaluate(`document.querySelector('[data-delivery-id="in_app:failed"] button[aria-label^=Resend]')===null`),true);
  assert(await evaluate(`document.querySelector('[data-delivery-id="email:read"] [data-report-column="outcome"]').textContent.trim()==='Seen'`),'Actual status helper says Seen only for recorded read');
  assert(await evaluate(`document.querySelector('[data-delivery-id="in_app:accepted"]').textContent.includes('In the app')`));
  assert(await evaluate(`document.querySelector('[data-delivery-id="whatsapp:resend"]').textContent.includes('WhatsApp could not download the image or document. Check that the file opens, then try Resend.')`));
  assert(await evaluate(`document.querySelector('[data-delivery-id="whatsapp:resend"] [data-report-column="notification"]').textContent.includes('Booking reminder')`),'Message type replaces technical template name in the main row');
  await evaluate(`document.querySelector('[data-delivery-id="whatsapp:resend"] [data-report-row]').click()`);
  await until(`document.querySelector('[data-delivery-id="whatsapp:resend"] details')`);
  assert.equal(await evaluate(`document.querySelector('[data-delivery-id="whatsapp:resend"] details').open`),false,'Raw provider details start collapsed');
  await evaluate(`document.querySelector('[data-delivery-id="whatsapp:resend"] details summary').click()`);
  assert(await evaluate(`document.querySelector('[data-delivery-id="whatsapp:resend"] details').innerText.includes('http code503')`),'Original provider error is still available');
  assert.equal(await evaluate(`window.notificationCopy.notificationReason("Not sent: this is ACTIV's own WhatsApp number ? save the person's own mobile number on their record")`),'WhatsApp cannot send to its own sending number. Use a different recipient number.');
  for(const width of [320,390,1440]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
    assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),`Visible row actions and raw details fit ${width}px`);
    await evaluate(`document.querySelector('[data-delivery-id="whatsapp:resend"]').scrollIntoView()`);
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await mkdir(artifacts,{recursive:true});await writeFile(path.join(artifacts,`row-resend-${width}.png`),Buffer.from(shot.result.data,'base64'));
  }
  await evaluate('window.renderLegacyRows()');
  await until('document.querySelector("[data-legacy-state=failed] button")');
  assert.equal(await evaluate('document.querySelectorAll("#legacy-fixture button").length'),1,'Legacy resend appears only for a confirmed failed external message');
  assert.equal(await evaluate('document.querySelector("[data-legacy-state=read]").textContent'),'Seen');
  await evaluate('document.querySelector("[data-legacy-state=failed] button").click()');
  assert.equal(await evaluate('window.legacyRetryCalls.length'),0,'Legacy row also requires explicit confirmation');
  await evaluate(`[...document.querySelectorAll('[data-legacy-state=failed] button')].find(button=>button.textContent==='Cancel').click()`);
  assert.equal(await evaluate('window.legacyRetryCalls.length'),0,'Cancel performs no legacy request');
  const legacyCases=[
    {response:{row:{effectiveStatus:'accepted'},message:'Re-sent'},kind:'success',title:'Sent'},
    {response:{row:{effectiveStatus:'accepted'},message:'This message is already accepted; no new message was sent.'},kind:'info',title:'Resend result'},
    {response:{row:{effectiveStatus:'skipped'},message:'This message cannot be sent again.'},kind:'info',title:'Resend result'},
    {response:{row:null,message:''},kind:'info',title:'Resend result'},
    {response:{row:{effectiveStatus:'unknown'},message:'Re-sent'},kind:'info',title:'Resend result'},
    {response:{row:{effectiveStatus:'failed'},message:'Still failing: Media upload error: Downloading media from weblink failed with http code503'},kind:'error',title:'Failed',description:'WhatsApp could not download the image or document. Check that the file opens, then try Resend.'},
    {error:'This report row cannot be retried.',kind:'error',title:'This message cannot be sent again.'},
  ];
  for(const testCase of legacyCases) {
    await evaluate(`window.legacyRetryResult=${JSON.stringify(testCase.response||null)};window.legacyRetryError=${JSON.stringify(testCase.error||'')};document.querySelector('[data-legacy-state=failed] button').click()`);
    await until(`document.querySelector('[data-legacy-state=failed]').textContent.includes('Confirm resend')`);
    const before=await evaluate('window.legacyRetryCalls.length');
    await evaluate(`{const confirm=[...document.querySelectorAll('[data-legacy-state=failed] button')].find(button=>button.textContent==='Confirm resend');confirm.click();confirm.click();}`);
    assert.equal(await evaluate('window.legacyRetryCalls.length'),before+1,'Immediate ref lock prevents two same-tick requests');
    assert(await evaluate(`[...document.querySelectorAll('[data-legacy-state=failed] button')].every(button=>button.disabled)`),'Confirm and cancel lock during a request');
    await evaluate('window.finishLegacyRetry()');
    await until(`document.querySelector('[data-legacy-state=failed] button')?.textContent.trim()==='Resend'`);
    const toast=await evaluate('window.legacyToasts.at(-1)');
    assert.equal(toast.kind,testCase.kind);assert.equal(toast.title,testCase.title);
    if(testCase.description)assert.equal(toast.description,testCase.description);
    if(testCase.kind==='info')assert(!/^(?:sent again|re-sent)\b/i.test(toast.title) && !/^(?:sent again|re-sent)\b/i.test(toast.description),'Skipped or unknown results never claim a new send');
  }
  console.log('PASS: legacy rapid-double-confirm lock, cancel, accepted retry vs accepted no-op, skipped/unknown outcomes and known failure/error copy.');
  console.log('PASS: collapsed-row Resend for email/WhatsApp/member and visitor push; confirmed statuses and in-app cannot resend; raw details retained; legacy safety and 320/390/1440 layouts.');
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    "PASS: report filters/layout and failed-delivery review, per-recipient eligibility, cancel, automation filters, frozen confirmation, duplicate-click protection, status refresh and later-page retries beyond 100 ineligible failures. All deliveries are mocked; no external requests."
  );
} finally {
  // Let Chrome close its DevTools socket before the process fallback. Killing
  // it mid-close can leave Node's WebSocket/child handles alive after PASS.
  if (ws?.readyState === WebSocket.OPEN) {
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 2000);
      ws.addEventListener('close', () => { clearTimeout(timer); resolve(); }, { once: true });
      try { ws.send(JSON.stringify({ id: 1000000, method: 'Browser.close' })); }
      catch { clearTimeout(timer); resolve(); }
    });
  }
  ws?.close();
  if (chrome?.exitCode == null) chrome?.kill();
  chrome?.unref();
  stop();
  const serverClosed = new Promise(resolve => server.close(resolve));
  server.closeAllConnections();
  await serverClosed;
}
