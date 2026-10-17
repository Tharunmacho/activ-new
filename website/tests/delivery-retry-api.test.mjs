// Exercise the real GET cache with an in-memory Axios adapter; no network or sends.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = await build({
  absWorkingDir: root, bundle: true, write: false, platform: 'node', format: 'cjs', external: ['axios'],
  stdin: { resolveDir: root, loader: 'ts', contents: `
    export * from './src/services/deliveryReportApi';
    export { default as api } from './src/services/api';
  ` },
  plugins: [{ name: 'isolated-dependencies', setup(builder) {
    builder.onResolve({ filter: /^(?:@\/lib\/analytics|\.\/browserPush|@\/config\/api\.config)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents:
      args.path.includes('api.config')
        ? `export const API_BASE_URL='http://fixture.invalid/api/v1';export const API_TIMEOUT=30000;export const STORAGE_KEYS={AUTH_TOKEN:'token'};`
        : `export const analyticsLogout=()=>{};export const clearBrowserPushSession=async()=>{};`,
    }));
  } }],
});
const module = { exports: {} };
new Function('module', 'exports', 'require', output.outputFiles[0].text)(module, module.exports, createRequire(import.meta.url));
const { api, getDeliveryRetryStatus, previewDeliveryRetry, retryDeliveryReport } = module.exports;
const calls = [];
let processing = true;
api.defaults.adapter = async config => {
  calls.push(config);
  const token = config.headers.get('X-Delivery-Retry-Token');
  return { config, status: 200, statusText: 'OK', headers: {}, data: { data: {
    found: true, processing, sent: token === 'batch-b' ? 7 : 2,
  } } };
};
await api.get('/control');
await api.get('/control');
assert.equal(calls.length, 1, 'The real shared GET cache is active for ordinary reads');
assert.equal((await getDeliveryRetryStatus('batch-a')).processing, true);
processing = false;
assert.equal((await getDeliveryRetryStatus('batch-a')).processing, false, 'The next status lookup sees batch progress immediately');
const [first, second] = await Promise.all([getDeliveryRetryStatus('batch-a'), getDeliveryRetryStatus('batch-b')]);
assert.equal(first.sent, 2);
assert.equal(second.sent, 7, 'Concurrent batch headers never reuse another batch response');
const statusCalls = calls.filter(call => call.url.endsWith('/retry-status'));
assert.equal(statusCalls.length, 4);
for (const call of statusCalls) {
  assert.equal(call.method, 'get');
  assert.equal(call.url, '/notifications/reports/retry-status');
  assert.equal(call.params, undefined, 'The review token is never put in URLs');
  assert(call.signal instanceof AbortSignal, 'Status reads opt out of generic GET deduplication');
  assert.equal(call.timeout, 30000);
}
const selection = { filters: { group: 'automation', status: 'failed', from: '2026-10-01' } };
await previewDeliveryRetry(selection);
assert.deepEqual(JSON.parse(calls.at(-1).data), selection);
assert.equal(calls.at(-1).timeout, 120000);
const confirmation = { ids: ['log:fixture'], token: 'batch-a' };
await retryDeliveryReport(confirmation);
assert.deepEqual(JSON.parse(calls.at(-1).data), confirmation);
assert.equal(calls.at(-1).timeout, 120000);
console.log('PASS: real GET-cache bypass for fresh and separate retry batches, signed token headers, frozen confirmation body and bounded timeouts. In-memory adapter only.');
