import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const { completeBusiness, normalizeDeclaration } = require('../../backend/src/modules/applications/applicationCompleteness');
const compiled = await build({ absWorkingDir: root, entryPoints: { website: 'src/lib/applicationFormValidation.ts', native: '../frontend/src/utils/applicationFormValidation.ts' }, bundle: true, write: false, outdir: 'fixture-output', platform: 'node', format: 'cjs' });
const valid = (fn, value, options) => { try { fn(value, options); return true; } catch { return false; } };
for (const file of compiled.outputFiles) {
  const module = { exports: {} }; new Function('require', 'module', 'exports', file.text)(require, module, module.exports);
  const { businessFormError, declarationFormError } = module.exports;
  for (const input of [{}, { doingBusiness: null }, { doingBusiness: false }, { doingBusiness: false, registrationType: 'student' }, { doingBusiness: false, registrationType: 'aspirant' },
    ...['', '1799', '1800', '2020', '9999', '2020.5', 'no'].map(year => ({ doingBusiness: true, businessCommencementYear: year }))]) {
    assert.equal(!businessFormError(input), valid(completeBusiness, input), `${file.path}: ${JSON.stringify(input)}`);
  }
  for (const business of [true, false]) for (const input of [{}, { agreeToDeclaration: false }, { agreeToDeclaration: true },
    ...['', '0', '1.5', '-1', 'many', 0, 1, 2].map(count => ({ agreeToDeclaration: true, sisterConcerns: count, companyNames: ['One'] })),
    { agreeToDeclaration: true, sisterConcerns: 2, companyNames: ['One', ' Two '] }]) {
    assert.equal(!declarationFormError(input, business), valid(normalizeDeclaration, input, { business }), `${file.path}: ${JSON.stringify(input)}`);
  }
}
console.log('PASS website/native/API conditional Business and Declaration completeness parity');
