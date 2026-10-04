import assert from 'node:assert/strict';
import { PRODUCTION_API, resolveApiBase } from '../api-base.mjs';

for (const input of [undefined, '', 'https://activ.org.in', 'https://activ.org.in/api/v1', 'https://www.activ.org.in/api/v1/', '/api/v1', '/api', PRODUCTION_API]) {
    assert.equal(resolveApiBase(input), PRODUCTION_API, `Retired/same-origin production API: ${input}`);
}
assert.equal(resolveApiBase(undefined, { development: true }), 'http://localhost:5000/api/v1');
assert.equal(resolveApiBase('/api/v1', { development: true }), '/api/v1');
for (const base of ['http://localhost:5057', 'https://staging.example.test']) {
    assert.equal(resolveApiBase(base), `${base}/api/v1`);
    assert.equal(resolveApiBase(`${base}/api/v1/`), `${base}/api/v1`);
}
assert.equal(resolveApiBase('https://api.activ.org.in/api/v1'), PRODUCTION_API);
console.log('PASS: website/API host migration, production defaults, development proxies and explicit staging URLs');
