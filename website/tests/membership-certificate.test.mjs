// Render the real certificate without a browser, network, or private records.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const result = await build({ absWorkingDir: root,
    entryPoints: ['src/features/member/certificates/MembershipCertificate.tsx'],
    bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
    external: ['react', 'react-dom', 'react/jsx-runtime'],
});
const module = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports);
const Certificate = module.exports.default;
const render = cert => renderToStaticMarkup(React.createElement(Certificate, { cert }));
const base = { kind: 'membership', membershipType: 'annual', member: { name: 'Personal Member', membershipNumber: 'ACTIV-TEST' } };
for (const companyName of ['Approved Registration Company', 'Legacy Company Profile']) {
    const html = render({ ...base, member: { ...base.member, companyName } });
    assert.equal((html.match(new RegExp(companyName, 'g')) || []).length, 2, 'Company appears as holder and company fact');
    assert(html.includes('Company Name'));
    assert(html.includes('Personal Member'));
}
for (const memberType of ['student', 'aspirant']) {
    const html = render({ ...base, member: { ...base.member, memberType, companyName: '' } });
    assert(html.includes('Personal Member'));
    assert(!html.includes('Company Name'));
    assert(!html.includes('Lifetime Member'));
}
assert(render({ ...base, membershipType: 'lifetime', membershipTier: 'platinum' }).includes('Lifetime Member'));
console.log('PASS website membership certificate: supplied company as holder and fact, personal-name fallback, and lifetime wording.');
