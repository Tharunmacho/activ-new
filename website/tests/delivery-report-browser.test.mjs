// Real Chrome layout and interactions; reporting data is an isolated fixture.
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
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
  ],
  pagination: { page: 1, limit: 25, total: 2, pages: 1 },
  campaignPagination: { page: 1, total: 1, pages: 1 },
  generatedAt: "2026-10-16T12:00:00Z",
};
try {
  const assets = await readdir(path.join(root, "dist/assets"));
  css = await readFile(
    path.join(
      root,
      "dist/assets",
      assets.find((name) => /^index-.*\.css$/.test(name))
    ),
    "utf8"
  );
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
        export const statusLabel=r=>r.status==='read'?'Read on WhatsApp':r.status==='failed'?'Failed':r.status;
        const fixture=${JSON.stringify(fixture)};
        export const getDeliveryReport=async filters=>{window.lastFilters=filters;let rows=fixture.rows;if(filters.status==='unconfirmed')rows=rows.filter(r=>r.status!=='read');if(filters.search)rows=rows.filter(r=>(r.recipientName+r.recipient).toLowerCase().includes(filters.search.toLowerCase()));return {...fixture,rows,pagination:{...fixture.pagination,total:rows.length}};};
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
  for (const width of [320, 390, 1440]) {
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
  }
  await evaluate(
    '[...document.querySelectorAll("button")].find(b=>b.textContent.includes("Regional association update")).click()'
  );
  await until("window.lastFilters.campaignKey");
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
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    "PASS: responsive report at 320/390/1440, publication drill-down, no-confirmed-open filter, recipient timeline/error details. No external requests or deliveries."
  );
} finally {
  ws?.close();
  chrome?.kill();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
