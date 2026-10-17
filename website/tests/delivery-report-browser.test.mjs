// Real Chrome layout and interactions; reporting data is an isolated fixture.
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "tailwindcss";
import loadConfig from "tailwindcss/loadConfig.js";
const root = fileURLToPath(new URL("..", import.meta.url));
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
      error: "The device registration expired. Enable notifications again.",
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
          b.onResolve(
            { filter: /^@\/services\/(deliveryReportApi|activApi)$/ },
            (args) => ({ path: args.path, namespace: "fixture" })
          );
          b.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
            contents: args.path.endsWith("activApi")
              ? "export const errorMessage=(e,f)=>e.message || f;"
              : `
        export const CHANNEL_LABELS={email:'Email',whatsapp:'WhatsApp',push:'Push notifications',in_app:'In-app notifications'};
        export const statusLabel=r=>({read:'Read on WhatsApp',failed:'Failed',accepted:'Provider accepted',delivered:'Delivered',sent:'Sent to handset',marked_read:'Marked as read',queued:'Queued'}[r.status]||r.status);
        const fixture=${JSON.stringify(fixture)};
        window.useLargeFailureFixture=()=>{fixture.rows=Array.from({length:105},(_,index)=>({
          _id:'failure-'+index,channel:index<100?'push':'email',status:'failed',recipientName:'Failed recipient '+index,
          recipient:'fixture@example.test',title:'Regional association update',campaignKey:'automation:fixture',createdAt:'2026-10-16T10:00:00Z'
        }))};
        window.retryPreviewCalls=[];window.retryCalls=[];window.reportReads=0;
        export const getDeliveryRetryStatus=async()=>({found:false,processing:false});
        export const previewDeliveryRetry=async selection=>{
          window.retryPreviewCalls.push(selection);
          const filters=selection.filters||{};
          const rows=fixture.rows.filter(r=>r.status==='failed'&&(!selection.ids||selection.ids.includes(r._id))&&(!filters.channel||r.channel===filters.channel));
          const reviewed=selection.ids?rows:rows.slice(0,100);
          const eligible=reviewed.filter(r=>r.channel!=='push');
          return {matched:rows.length,reviewed:reviewed.length,remaining:rows.length-reviewed.length,eligible:eligible.length,skipped:reviewed.length-eligible.length,ids:eligible.map(r=>r._id),token:eligible.length?'review-fixture':'',truncated:rows.length>reviewed.length,reasons:reviewed.length>eligible.length?[{reason:'Device registration expired',count:reviewed.length-eligible.length}]:[]};
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
      contents: `import React from 'react';import{createRoot}from'react-dom/client';import Report from './src/features/admin/super-admin/pages/NotificationReports';createRoot(document.getElementById('root')).render(<Report/>);`,
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
        timer = setTimeout(() => reject(Error(method)), 20000);
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
    const dir = path.join(root, "../artifacts/delivery-report");
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
  await evaluate('document.querySelector("[aria-label=\\"Next recipients\\"]").click()');
  await until("window.lastFilters.page === 2");
  await evaluate('document.querySelector("[aria-label=\\"Show accepted / in inbox\\"]").click()');
  await until('window.lastFilters.status === "accepted_any" && window.lastFilters.page === 1');
  await until('document.body.textContent.includes("Read-inbox Member")');
  assert(await evaluate('document.body.textContent.includes("Delivered Member") && document.body.textContent.includes("Handset Member")'));
  assert(await evaluate('window.lastReport.pagination.total === window.lastReport.summary.accepted'));
  assert.equal(await evaluate('document.activeElement.id'), "delivery-report-recipient-heading", "summary card reveals and focuses details");
  assert.equal(await evaluate('document.querySelector("[aria-label=\\"Show accepted / in inbox\\"]").getAttribute("aria-pressed")'), "true");
  await evaluate('document.querySelector("[aria-label=\\"Report delivery outcome\\"]").value="accepted";document.querySelector("[aria-label=\\"Report delivery outcome\\"]").dispatchEvent(new Event("change",{bubbles:true}))');
  await until('window.lastFilters.status === "accepted"');
  await until('!document.body.textContent.includes("Delivered Member")');
  assert(await evaluate('window.lastReport.rows.every(r=>r.status === "accepted")'), "existing exact accepted filter remains available");

  await send("Page.bringToFront");
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await evaluate('document.querySelector("[aria-label=\\"Show confirmed opens\\"]").focus()');
  assert.equal(await evaluate('document.activeElement.getAttribute("aria-label")'), "Show confirmed opens");
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
  await evaluate('document.querySelector("[aria-label=\\"Show recipient identities\\"]").click()');
  await until('window.lastFilters.status === ""');
  assert.equal(await evaluate('window.lastFilters.channel'), "email", "recipient card retains channel scope");
  await until('document.querySelectorAll("[data-report-row]").length > 1');
  assert(await evaluate('window.lastReport.summary.recipients < window.lastReport.pagination.total'), "identity count is distinct from delivery records");
  assert(await evaluate('document.body.textContent.includes("the same recipient can appear more than once")'));
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
    'document.body.textContent.includes("device registration expired")'
  );
  assert(
    await evaluate(
      'document.body.textContent.includes("Email opens are not measured")'
    )
  );
  await send("Emulation.setDeviceMetricsOverride", { width: 320, height: 1000, deviceScaleFactor: 1, mobile: true });
  await pause(200);
  assert(await evaluate("document.documentElement.scrollWidth <= innerWidth"), "expanded recipient contact, error and timeline fit a narrow screen");
  await evaluate('document.querySelector("[aria-label=\\"Review resend for Very Long Member Name For A Narrow Screen\\"]").click()');
  await until('document.body.textContent.includes("0 eligible")');
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
  await until('document.body.textContent.includes("1 eligible")');
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
  await until('document.body.textContent.includes("1 attempted · 1 sent · 0 queued · 0 failed · 0 skipped")');
  await until(`window.reportReads>${readsBeforeRetry}`);
  assert.equal(await evaluate('window.retryCalls.length'), 1);
  await evaluate('window.useLargeFailureFixture();document.querySelector("[aria-label=\\"Report activity\\"]").value="";document.querySelector("[aria-label=\\"Report activity\\"]").dispatchEvent(new Event("change",{bubbles:true}));document.querySelector("[aria-label=\\"Report channel\\"]").value="";document.querySelector("[aria-label=\\"Report channel\\"]").dispatchEvent(new Event("change",{bubbles:true}));document.querySelector("[aria-label=\\"Report delivery outcome\\"]").value="failed";document.querySelector("[aria-label=\\"Report delivery outcome\\"]").dispatchEvent(new Event("change",{bubbles:true}))');
  await until('window.lastReport.pagination.total===105 && !document.querySelector("[aria-busy=\\"true\\"]")');
  await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="Review failed deliveries").click()');
  await until('document.body.textContent.includes("100 skipped")');
  assert(await evaluate('document.body.textContent.includes("Batch review starts with the newest 100 failures") && document.body.textContent.includes("use the recipient pages")'), 'capped review explains how to reach later failures');
  assert(await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="Confirm resend (0)").disabled'));
  assert.equal(await evaluate('window.retryCalls.length'), 1, 'initial ineligible batch does not send');
  for (let page = 2; page <= 5; page++) {
    await evaluate('document.querySelector("[aria-label=\\"Next recipients\\"]").click()');
    await until(`window.lastFilters.page===${page} && !document.querySelector('[aria-busy="true"]')`);
  }
  await evaluate('document.querySelector("[aria-label=\\"Review failed deliveries on this page\\"]").click()');
  await until('document.body.textContent.includes("5 eligible")');
  const laterIds = Array.from({ length: 5 }, (_, index) => `failure-${index + 100}`);
  assert.deepEqual(await evaluate('window.retryPreviewCalls.at(-1)'), { ids: laterIds }, 'page five reviews its exact visible failures instead of restarting at the first 100');
  assert(await evaluate('document.body.textContent.includes("Failed deliveries on recipient page 5")'));
  assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'), 'page-review actions and guidance fit 320px');
  await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="Confirm resend (5)").click()');
  await until('window.retryCalls.length===2');
  assert.deepEqual(await evaluate('window.retryCalls.at(-1)'), { ids: laterIds, token: 'review-fixture' });
  await evaluate('window.finishRetry()');
  await until('document.body.textContent.includes("5 attempted · 5 sent")');
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    "PASS: report filters/layout and failed-delivery review, per-recipient eligibility, cancel, automation filters, frozen confirmation, duplicate-click protection, status refresh and later-page retries beyond 100 ineligible failures. All deliveries are mocked; no external requests."
  );
} finally {
  ws?.close();
  chrome?.kill();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
