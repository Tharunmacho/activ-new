// Deterministic upload contract using real File/FormData and a local transport fixture.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const root = fileURLToPath(new URL('..', import.meta.url));
const calls = [];
let result = { data: { data: { profilePhoto: '/uploads/confirmed.png' } } }, failure;
globalThis.__adminPhotoTransport = async (...args) => {
    calls.push(args);
    if (failure) throw failure;
    return result;
};
try {
    const output = await build({ absWorkingDir: root, entryPoints: ['src/services/adminProfilePhoto.ts'], bundle: true, write: false, platform: 'node', format: 'cjs',
        plugins: [{ name: 'local-transport', setup(build) {
            build.onResolve({ filter: /^\.\/api$/ }, () => ({ path: 'transport', namespace: 'fixture' }));
            build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export default {post: (...args) => globalThis.__adminPhotoTransport(...args)};' }));
        } }],
    });
    const module = { exports: {} };
    new Function('module', 'exports', output.outputFiles[0].text)(module, module.exports);
    const upload = module.exports.uploadAdminProfilePhoto;
    const file = new File(['image fixture'], 'avatar.png', { type: 'image/png' });
    assert.equal(await upload(file), '/uploads/confirmed.png');
    assert.equal(calls[0][0], '/admin/profile/photo');
    assert(calls[0][1] instanceof FormData);
    assert.deepEqual([...calls[0][1].keys()], ['photo'], 'The client cannot select somebody else’s account.');
    assert.equal(calls[0][1].get('photo').name, 'avatar.png');
    const encoded = new Request('https://fixture.invalid/admin/profile/photo', { method: 'POST', body: calls[0][1] });
    assert.match(encoded.headers.get('Content-Type'), /^multipart\/form-data; boundary=/);
    assert.match(await encoded.text(), /name="photo"; filename="avatar.png"/);
    await assert.rejects(upload(new File(['document'], 'report.pdf', { type: 'application/pdf' })), /image/);
    await assert.rejects(upload(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })), /5 MB/);
    assert.equal(calls.length, 1, 'Invalid files do not reach transport.');
    failure = new Error('Upload unavailable');
    await assert.rejects(upload(file), /Upload unavailable/);
    failure = null; result = { data: { data: {} } };
    await assert.rejects(upload(file), /did not confirm/);
    console.log('Web admin photo: own-account multipart field, confirmed server URL, image/size validation and error propagation passed.');
} finally { delete globalThis.__adminPhotoTransport; }
