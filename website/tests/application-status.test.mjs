import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const compiled = await build({ absWorkingDir: root, entryPoints: ['src/lib/applicationStatus.ts'], bundle: true, write: false, platform: 'node', format: 'cjs' });
const module = { exports: {} }; new Function('module', 'exports', compiled.outputFiles[0].text)(module, module.exports);
const { pickCurrentApplication: pick, normaliseApplicationStatus: status, applicationSubmissionMode: mode } = module.exports;
const row = (id, status, createdAt = '2026-11-07') => ({ _id: id, status, createdAt });
assert.equal(pick([]), null);
assert.equal(pick(null), null);
const pending = row('03', 'Pending-Block', '2026-11-07');
const rejected = row('02', 'Rejected', '2026-11-06');
const approved = row('01', 'state_approved', '2026-11-01');
for (const rows of [[rejected, pending], [pending, rejected]]) assert.equal(pick(rows), pending, 'current reapplication beats rejected history');
for (const rows of [[pending, approved, rejected], [rejected, approved, pending]]) assert.equal(pick(rows), approved, 'approval remains authoritative');
assert.equal(pick([row('02', 'Approved'), row('01', 'approved')])._id, '01', 'oldest stable approval');
assert.equal(pick([row('01', 'Rejected'), row('02', 'declined')])._id, '02', 'latest stable rejection');
assert.equal(pick([row('01', 'pending', 'invalid'), row('02', 'Pending', '2026-11-06')])._id, '02');
assert.equal(pick([row('03', 'Pending', '2026-11-03'), row('02', 'Pending', '2026-11-06')])._id, '02', 'date precedes ID');
assert.equal(pick([null, pending]), pending);
for (const legacy of ['approved', 'STATE-APPROVED', 'complete', 'completed']) {
  assert.equal(status(legacy), 'Approved'); assert.equal(mode({}, row('a', legacy)), 'save');
}
for (const membershipStatus of ['active', 'completed', ' ACTIVE ']) assert.equal(mode({ membershipStatus }, rejected), 'save');
assert.equal(mode({ applicationId: 'old-rejected-id' }, rejected), 'resubmit');
assert.equal(mode({}, pending), 'update');
assert.equal(mode({}, null), 'submit');
assert.equal(mode({ membershipNumber: 'derived-id' }, null), 'submit');
console.log('PASS current application selection, historical rejection, legacy states, stable tie-breaks and submission eligibility');
