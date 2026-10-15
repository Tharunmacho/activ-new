// Exercise the website and native completion rules against the API contract.
// Pure local fixtures; no browser session, database or external API is used.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const { missingPersonalFields } = require('../../backend/src/modules/members/personalDetails');
const compiled = await build({ absWorkingDir: root, entryPoints: {
  website: 'src/lib/personalDetailsValidation.ts',
  native: '../frontend/src/screens/profile/personalDetailsValidation.ts',
}, bundle: true, write: false, outdir: 'fixture-output', platform: 'node', format: 'cjs' });
const validators = compiled.outputFiles.map(file => {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', file.text)(require, module, module.exports);
  return { name: file.path, errors: module.exports.personalDetailsErrors };
});
const full = { fullName: 'Local Applicant', email: 'applicant@example.test', phoneNumber: '9123456780',
  state: 'Tamil Nadu', district: 'Krishnagiri', block: 'Hosur', city: 'Hosur',
  religion: 'Hindu', socialCategory: 'SC', gender: 'Female', personalDetailsBlockRequired: true };
const fields = ['fullName', 'email', 'phoneNumber', 'state', 'district', 'block', 'city', 'religion', 'socialCategory', 'gender'];
const variants = [full,
  ...fields.flatMap(field => ['', '   ', null, undefined, {}].map(value => ({ ...full, [field]: value }))),
  { ...full, email: 'not-an-email' }, { ...full, phoneNumber: '123' },
  { ...full, socialCategory: 'made-up' }, { ...full, gender: 'made-up' },
  { ...full, religion: 'made-up' }, { ...full, religion: 'Christian' },
  { ...full, religion: 'Hinduism', gender: 'female' },
  { ...full, district: 'Chennai', block: '', personalDetailsBlockRequired: false },
  { ...full, isInternational: true, phoneNumber: '+447911123456', place: 'London', state: '', district: '', block: '', city: '' },
  { ...full, isInternational: true, phoneNumber: '+447911123456', place: '' },
];
for (const validator of validators) {
  for (const data of variants) {
    assert.deepEqual(Object.keys(validator.errors(data)).sort(), missingPersonalFields(data, { international: data.isInternational === true }).sort(), validator.name);
  }
  assert.deepEqual(validator.errors(full), {});
  assert(Object.keys(validator.errors(null)).length > 0);
}
console.log(`PASS: website and native personal-detail validation match the API for ${variants.length} complete, missing, invalid and conditional-location fixtures each.`);
