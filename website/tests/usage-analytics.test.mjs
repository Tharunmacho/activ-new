import assert from 'node:assert/strict';
import vm from 'node:vm';
import { build } from 'esbuild';
const bundle = await build({ entryPoints: ['src/lib/analytics.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', define: { 'import.meta.env.VITE_GA_MEASUREMENT_ID': '"G-LOCALTEST"' } });
function fixture(source, runtimeId = null) {
  const values = new Map(); const scripts = [];
  const sandbox = { exports: {}, module: { exports: {} }, window: { location: { origin: 'https://example.test' } },
    localStorage: { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v) },
    document: {
      querySelector: () => runtimeId === null ? null : { getAttribute: () => runtimeId },
      createElement: () => ({}), head: { appendChild: el => scripts.push(el) },
    } };
  vm.runInNewContext(source, sandbox);
  return { sandbox, scripts, analytics: sandbox.module.exports };
}
const { sandbox, scripts, analytics } = fixture(bundle.outputFiles[0].text);
assert.equal(analytics.analyticsConfigured(), true, 'static hosts retain the compiled ID');
analytics.analyticsPage('/events/private-booking?ref=SECRET');
assert.equal(scripts.length, 0, 'no Google script before consent');
analytics.setAnalyticsConsent(true);
analytics.analyticsPage('/events/private-booking?ref=SECRET');
analytics.analyticsLogin({ id: 'a'.repeat(24), email: 'private@example.test', fullName: 'Private Person', phone: '9123456780', loginMethod: 'google' });
assert.equal(scripts.length, 1);
const calls = sandbox.window.dataLayer.map(args => Array.from(args));
const page = calls.find(([command, event]) => command === 'event' && event === 'page_view');
assert.equal(page[2].page_location, 'https://example.test/events');
const serialised = JSON.stringify(calls);
for (const forbidden of ['private@example.test', 'Private Person', '9123456780', 'SECRET', 'private-booking']) assert(!serialised.includes(forbidden));
const login = calls.find(([command, event]) => command === 'event' && event === 'login');
assert.equal(login[2].method, 'google');
analytics.setAnalyticsConsent(false);
const length = sandbox.window.dataLayer.length;
analytics.analyticsPage('/news'); analytics.analyticsLogin({ id: 'b'.repeat(24) });
assert.equal(sandbox.window.dataLayer.length, length, 'revoked consent stops events');
assert.equal(sandbox.window['ga-disable-G-LOCALTEST'], true);
analytics.setAnalyticsConsent(true); analytics.analyticsPage('/news');
assert.equal(scripts.length, 1, 'reconsenting does not inject a second script');
assert.equal(sandbox.window['ga-disable-G-LOCALTEST'], false);
assert(sandbox.window.dataLayer.some(args => args[0] === 'consent' && args[1] === 'update' && args[2].analytics_storage === 'granted'));

const missingBuildId = await build({ entryPoints: ['src/lib/analytics.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', define: { 'import.meta.env.VITE_GA_MEASUREMENT_ID': '""' } });
for (const source of [bundle, missingBuildId]) {
  const runtime = fixture(source.outputFiles[0].text, ' G-RUNTIME123 ');
  assert.equal(runtime.analytics.analyticsConfigured(), true, 'runtime ID overrides either a missing or different compiled ID');
  runtime.analytics.analyticsPage('/news/private?token=SECRET');
  assert.equal(runtime.scripts.length, 0, 'runtime configuration does not bypass consent');
  runtime.analytics.setAnalyticsConsent(true);
  runtime.analytics.analyticsPage('/news/private?token=SECRET');
  assert.equal(runtime.scripts.length, 1);
  assert.equal(runtime.scripts[0].src, 'https://www.googletagmanager.com/gtag/js?id=G-RUNTIME123');
  const calls = runtime.sandbox.window.dataLayer.map(args => Array.from(args));
  assert(calls.some(args => args[0] === 'config' && args[1] === 'G-RUNTIME123'));
  assert(!JSON.stringify(calls).includes('SECRET'));
  runtime.analytics.setAnalyticsConsent(false);
  const count = runtime.sandbox.window.dataLayer.length;
  runtime.analytics.analyticsPage('/events');
  assert.equal(runtime.sandbox.window.dataLayer.length, count);
  assert.equal(runtime.sandbox.window['ga-disable-G-RUNTIME123'], true);
}
for (const value of ['', ' ', 'invalid', 'G-"><script>bad()</script>']) {
  const disabled = fixture(bundle.outputFiles[0].text, value);
  assert.equal(disabled.analytics.analyticsConfigured(), false, 'invalid or blank runtime value disables the compiled ID');
  disabled.analytics.setAnalyticsConsent(true);
  disabled.analytics.analyticsPage('/');
  assert.equal(disabled.scripts.length, 0);
  assert.equal(disabled.sandbox.window.dataLayer, undefined);
}
assert.equal(fixture(missingBuildId.outputFiles[0].text).analytics.analyticsConfigured(), false);
console.log('PASS: Runtime/build ID selection, disabled overrides, consent/re-consent, sanitised routes and exclusion of member PII. No Google requests made.');
