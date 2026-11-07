import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { build } from 'vite';

// This is the verified LOCAL release APK certificate, used only in a disposable
// fixture. It makes no claim about Google Play's separate app-signing key.
const fixture = [{ relation: ['delegate_permission/common.handle_all_urls'], target: {
  namespace: 'android_app', package_name: 'in.activ.membership',
  sha256_cert_fingerprints: ['DC:26:04:33:75:F2:8F:21:B0:AD:8A:4F:80:24:3B:17:00:0A:18:FD:2B:CA:8E:87:B2:4E:FA:4E:91:73:B8:E7'],
} }];
const website = fileURLToPath(new URL('..', import.meta.url));
const directory = await mkdtemp(path.join(tmpdir(), 'activ-app-links-serving-'));
const fixtureBytes = JSON.stringify(fixture, null, 2) + '\n';
let child;
let apiCalls = 0;
const api = http.createServer((req, res) => { apiCalls++; res.writeHead(404); res.end('{}'); });
await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
try {
  await mkdir(path.join(directory, 'public', '.well-known'), { recursive: true });
  await writeFile(path.join(directory, 'public', '.well-known', 'assetlinks.json'), fixtureBytes);
  await writeFile(path.join(directory, 'index.html'), '<!doctype html><html><head><title>Local fixture</title></head><body><div id="root">Website fallback fixture</div></body></html>');
  // Exercise Vite's real release public-file copy, with no source/config/env
  // from the live website and no modifications to website/public or dist.
  await build({ root: directory, configFile: false, envFile: false, logLevel: 'silent', publicDir: 'public', build: { outDir: 'dist', emptyOutDir: true } });
  assert.equal(await readFile(path.join(directory, 'dist', '.well-known', 'assetlinks.json'), 'utf8'), fixtureBytes, 'Vite preserves the hidden directory and exact JSON bytes');
  for (const name of ['server.mjs', 'share-preview.mjs', 'api-base.mjs']) await copyFile(path.join(website, name), path.join(directory, name));
  child = spawn(process.execPath, [path.join(directory, 'server.mjs')], {
    env: { ...process.env, PORT: '0', API_URL: `http://127.0.0.1:${api.address().port}`, SITE_URL: 'https://activ.org.in' },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Local website failed to start')), 10000);
    child.stdout.on('data', data => { const match = String(data).match(/ACTIV website on :(\d+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', () => { clearTimeout(timer); reject(new Error('Local website exited before startup')); });
  });
  const origin = `http://127.0.0.1:${port}`;
  for (const encoding of ['identity', 'gzip', 'br']) {
    const response = await fetch(origin + '/.well-known/assetlinks.json', { redirect: 'manual', headers: { 'accept-encoding': encoding } });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /^application\/json(?:;|$)/);
    assert.equal(response.headers.get('location'), null);
    assert.equal(response.redirected, false);
    const body = await response.text();
    assert.equal(body, fixtureBytes);
    assert.deepEqual(JSON.parse(body), fixture);
    assert(!body.includes('<html'), 'Association must not be the SPA fallback');
  }
  const head = await fetch(origin + '/.well-known/assetlinks.json', { method: 'HEAD', redirect: 'manual' });
  assert.equal(head.status, 200); assert.match(head.headers.get('content-type'), /^application\/json/); assert.equal(await head.text(), '');
  assert.equal(apiCalls, 0, 'Association serving does not query any API');
  const fallback = await fetch(origin + '/events/local-fixture/book', { redirect: 'manual' });
  assert.equal(fallback.status, 200); assert.match(await fallback.text(), /Website fallback fixture/);
  console.log('PASS Android association fixture: Vite copies .well-known; Node serves exact JSON with200/no redirect for identity/gzip/br/HEAD; event booking keeps website fallback. No production files changed; network requests use localhost only.');
} finally {
  if (child && child.exitCode === null) { child.kill(); await new Promise(resolve => child.once('exit', resolve)); }
  api.closeAllConnections(); await new Promise(resolve => api.close(resolve));
  if (path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep + 'activ-app-links-serving-')) await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
