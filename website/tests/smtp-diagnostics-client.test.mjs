// Compile the real clients against a recording transport; no HTTP requests.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const fixtures = {
    './api': `
        export default {get:async(url,options)=>{calls.push({method:'get',url,options});return {}},
            post:async(url,body,options)=>{calls.push({method:'post',url,body,options});return {}}};
        export const unwrap=value=>value,setAuthToken=()=>{},clearSession=()=>{},errorMessage=()=>'',clearRequestCache=()=>{},registerCacheClearer=()=>{};
    `,
    '@/lib/analytics': 'export const analyticsLogin=()=>{};',
    './browserPush': 'export const clearBrowserPushSession=()=>{};',
    '@/config/api.config': `
        export const API_BASE_URL='https://api.example.test',STORAGE_KEYS={},HOME_FOR_ROLE={},DASHBOARD_FOR_ROLE={};
        export const ENDPOINTS={NOTIFICATIONS:{DELIVERY_STATUS:'/notifications/delivery-status',TEST_SEND:'/notifications/test-send'}};
    `,
};
const compiled = await build({ absWorkingDir: root, write: false, bundle: true, format: 'iife', platform: 'node',
    plugins: [{ name: 'recording-client', setup(builder) {
        builder.onResolve({ filter: /.*/ }, args => args.path in fixtures ? { path: args.path, namespace: 'fixture' } : undefined);
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: fixtures[args.path], loader: 'ts', resolveDir: root }));
    } }], stdin: { resolveDir: root, loader: 'ts', contents: `
        import{getDeliveryStatus,sendTestNotification}from'./src/services/activApi';
        import{getDeliveryGuardHealth}from'./src/services/notificationDeliveryApi';
        globalThis.subject={getDeliveryStatus,sendTestNotification,getDeliveryGuardHealth};
    ` } });
const context = { calls: [] };
vm.runInNewContext(compiled.outputFiles[0].text, context);
const { getDeliveryStatus, sendTestNotification, getDeliveryGuardHealth } = context.subject;
await getDeliveryStatus();
assert.equal(context.calls.at(-1).options.timeout, undefined, 'normal page loading keeps the standard timeout');
await getDeliveryStatus(true);
assert.equal(context.calls.at(-1).options.timeout, 60000, 'both SMTP handshakes can finish before the client times out');
assert.equal(context.calls.at(-1).options.params.verifyEmail, '1');
await getDeliveryGuardHealth(true);
assert.equal(context.calls.at(-1).options.timeout, 60000, 'automation refresh waits for the same SMTP check');
await getDeliveryGuardHealth();
assert.equal(context.calls.at(-1).options.timeout, undefined);
await sendTestNotification('email', 'admin@example.test', 'events');
assert.equal(context.calls.at(-1).body.category, 'events');
assert.equal(context.calls.at(-1).options.timeout, 60000, 'email tests wait for a bounded SMTP attempt');
await sendTestNotification('email', 'admin@example.test');
assert.equal(context.calls.at(-1).body.category, 'membership');
await sendTestNotification('whatsapp', 'fixture-phone', 'events');
assert.equal(context.calls.at(-1).body.category, undefined);
assert.equal(context.calls.at(-1).options, undefined);
console.log('PASS real SMTP clients: bounded handshake/test timeouts, normal request defaults, separate sender request body and backwards-compatible membership default. No network.');
