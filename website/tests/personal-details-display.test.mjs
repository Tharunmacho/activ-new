// Render the actual application detail rows; only portal primitives are replaced
// for server rendering. No live API, user data or browser session is accessed.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const result = await build({ absWorkingDir: root, entryPoints: ['src/components/ui/profile-view-modal.tsx'],
    bundle: true, write: false, platform: 'node', format: 'cjs', external: ['react', 'react-dom', 'react/jsx-runtime'],
    jsx: 'automatic', plugins: [{ name: 'server-portal', setup(build) {
        build.onResolve({ filter: /^@\/components\/ui\/dialog$/ }, () => ({ path: 'dialog', namespace: 'fixture' }));
        build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `import React from 'react';
            const Element = ({children}) => React.createElement('div', null, children);
            export const Dialog = Element, DialogContent = Element, DialogDescription = Element,
            DialogHeader = Element, DialogTitle = Element;` }));
    } }],
});
const module = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports);
const Modal = module.exports.default;
const render = profile => renderToStaticMarkup(React.createElement(Modal, { open: true, onClose() {}, profile }));
const legacy = render({ fullName: 'Local Applicant', memberType: 'aspirant', doingBusiness: false });
for (const field of ['Religion', 'Social Category', 'Gender']) assert(legacy.includes(`<dt class="text-ui-small font-semibold text-slate-500">${field}</dt>`));
assert.equal((legacy.match(/Not provided/g) || []).length, 3);
for (const memberType of ['aspirant', 'student', 'business']) {
    const html = render({ fullName: 'Local Applicant', memberType, registrationType: memberType, doingBusiness: memberType === 'business', religion: 'Hindu', socialCategory: 'SC', gender: 'Male' });
    for (const value of ['Hindu', 'SC', 'Male']) assert(html.includes(`>${value}</dd>`), `${memberType}: ${value}`);
    assert(!html.includes('Not provided'));
}
console.log('PASS: website application details retain religion/social category/gender for all member types and explicitly show missing legacy answers.');
