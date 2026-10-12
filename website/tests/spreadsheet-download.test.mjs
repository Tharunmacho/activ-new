import assert from 'node:assert/strict';
import vm from 'node:vm';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/services/spreadsheetDownload.ts'], bundle: true, write: false,
  format: 'cjs', platform: 'node', plugins: [{ name: 'authenticated-download-fixture', setup(b) {
    b.onResolve({ filter: /^\.\/api$/ }, () => ({ path: 'api', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export default {get:(...args)=>globalThis.fixture.get(...args)};', loader: 'js' }));
  } }] });
const calls = [], downloads = [], revoked = [], timers = [];
const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const fixture = { response: { headers: { 'content-type': mime, 'content-disposition': 'attachment; filename="membership-active.xlsx"' }, data: new Blob(['PK-workbook-fixture']) },
  async get(...args) { calls.push(args); return this.response; } };
const context = vm.createContext({ fixture, module: { exports: {} }, Blob, console,
  URL: { createObjectURL(blob) { assert.equal(blob.type, mime); return 'blob:private-report'; }, revokeObjectURL: value => revoked.push(value) },
  window: { setTimeout: fn => timers.push(fn) },
  document: { body: { appendChild() {} }, createElement() { return { href: '', download: '', click() { downloads.push({ href: this.href, name: this.download }); }, remove() {} }; } }
});
vm.runInContext(bundle.outputFiles[0].text, context);
const download = context.module.exports.downloadSpreadsheet;
await download('/admin/super/membership/registrations/export', 'fallback.xlsx', { tab: 'members', filter: 'active' });
assert.equal(calls[0][0], '/admin/super/membership/registrations/export');
assert.equal(calls[0][1].params.format, 'xlsx');
assert.equal(calls[0][1].params.filter, 'active');
assert.equal(calls[0][1].responseType, 'blob');
assert.equal(downloads[0].name, 'membership-active.xlsx');
assert.equal(downloads[0].href, 'blob:private-report');
assert.equal(revoked.length, 0);
timers.shift()();
assert.deepEqual(revoked, ['blob:private-report']);
fixture.response = { headers: { 'content-type': 'text/csv' }, data: new Blob(['not-a-workbook']) };
await assert.rejects(download('/events/test/bookings/export', 'report.xlsx'), /could not be downloaded/);
assert.equal(downloads.length, 1, 'an old CSV/error response is not saved with a misleading xlsx extension');
fixture.response = { headers: { 'content-type': mime, 'content-disposition': 'attachment; filename="../private/report.xlsx"' }, data: new Blob(['PK-fixture']) };
await download('/events/test/bookings/export', 'fallback.xlsx');
assert.equal(downloads[1].name, '-private-report.xlsx');
console.log('Authenticated XLSX downloads, safe filenames, correct MIME, delayed cleanup and invalid-response handling passed.');
