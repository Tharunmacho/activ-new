import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { build } from 'esbuild';

const root = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
// Read the committed default directly so ignored local env files cannot mask it.
const productionEnv = await readFile(new URL('.env.production', root), 'utf8');
const measurementId = productionEnv.match(/^VITE_GA_MEASUREMENT_ID=(\S+)$/m)?.[1];
assert.equal(measurementId, 'G-SVTY6PH9ZX');
const bundle = await build({
  stdin: {
    contents: await readFile(new URL('src/lib/analytics.ts', root), 'utf8'),
    sourcefile: 'analytics.ts', loader: 'ts',
  },
  bundle: true, write: false, platform: 'browser', format: 'cjs',
  define: { 'import.meta.env.VITE_GA_MEASUREMENT_ID': JSON.stringify(measurementId) },
});

const elements = [];
const listeners = new Map();
const idle = [];
const values = new Map();
const sandbox = {
  module: { exports: {} }, exports: {},
  location: { origin: 'https://example.test', pathname: '/' },
  localStorage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) },
  document: {
    readyState: 'loading',
    querySelector: () => null,
    createElement: tagName => ({ tagName }),
    head: { appendChild: element => elements.push(element) },
  },
  addEventListener: (event, handler) => listeners.set(event, handler),
  requestIdleCallback: handler => idle.push(handler),
  setTimeout: handler => idle.push(handler),
  fetch: () => { throw Error('Bootstrap test must not make network requests'); },
};
sandbox.window = sandbox;
const context = vm.createContext(sandbox);
for (const [, attributes, source] of html.split('</head>')[0].matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  const src = attributes.match(/\bsrc=["']([^"']+)["']/i)?.[1];
  if (src) elements.push({ tagName: 'script', src });
  else vm.runInContext(source, context, { filename: 'index.html' });
}
vm.runInContext(bundle.outputFiles[0].text, context, { filename: 'analytics.cjs' });
const analytics = sandbox.module.exports;
const googleScripts = () => elements.filter(element =>
  element.tagName.toLowerCase() === 'script' && /https:\/\/(?:www\.)?(?:googletagmanager|google-analytics)\.com\//.test(element.src || ''));
const calls = () => [...(sandbox.dataLayer || [])].map(args => [...args]);

assert.equal(analytics.analyticsConfigured(), true);
analytics.analyticsPage('/events/private-booking?ref=SECRET');
sandbox.document.readyState = 'complete';
listeners.get('load')?.();
while (idle.length) idle.shift()();
assert.equal(googleScripts().length, 0, 'The actual HTML must not load Google before consent, including idle callbacks');
assert.equal(calls().filter(args => args[0] === 'config').length, 0, 'The HTML must not configure a legacy GA stream');

analytics.setAnalyticsConsent(true);
analytics.analyticsPage('/events/private-booking?ref=SECRET');
assert.equal(googleScripts().length, 1, 'Opting in loads Google exactly once');
assert.equal(googleScripts()[0].src, `https://www.googletagmanager.com/gtag/js?id=${measurementId}`);
const configs = calls().filter(args => args[0] === 'config');
assert.equal(configs.length, 1);
assert.equal(configs[0][1], measurementId);
const page = calls().find(args => args[0] === 'event' && args[1] === 'page_view');
assert.equal(page[2].page_location, 'https://example.test/events');
assert.ok(!JSON.stringify(calls()).includes('private-booking'));
assert.ok(!JSON.stringify(calls()).includes('SECRET'));

analytics.setAnalyticsConsent(false);
const count = calls().length;
analytics.analyticsPage('/news');
assert.equal(calls().length, count, 'Revoking consent stops subsequent page events');
assert.equal(sandbox[`ga-disable-${measurementId}`], true);
analytics.setAnalyticsConsent(true);
analytics.analyticsPage('/news');
assert.equal(googleScripts().length, 1, 'Reconsenting does not add another loader');
assert.equal(calls().filter(args => args[0] === 'config').length, 1);
assert.equal(sandbox[`ga-disable-${measurementId}`], false);
console.log('PASS: Actual HTML bootstrap, production GA default, consent, sanitised page views, revoke and reconsent. No network requests made.');
