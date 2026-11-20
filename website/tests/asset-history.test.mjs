import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { archiveAssets } from '../asset-history.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'activ-asset-releases-'));
const archive = path.join(root, 'history');
const website = fileURLToPath(new URL('../', import.meta.url));
const processes = [];
async function start(name) {
    const directory = path.join(root, name);
    fs.mkdirSync(path.join(directory, 'dist/assets'), { recursive: true });
    for (const file of ['server.mjs', 'api-base.mjs', 'share-preview.mjs', 'asset-history.mjs']) {
        fs.copyFileSync(path.join(website, file), path.join(directory, file));
    }
    fs.writeFileSync(path.join(directory, 'dist/index.html'), '<html></html>');
    fs.writeFileSync(path.join(directory, 'dist/assets', name + '.js'), name);
    const child = spawn(process.execPath, [path.join(directory, 'server.mjs')], {
        env: { ...process.env, PORT: '0', WEBSITE_ASSET_HISTORY: archive }, windowsHide: true
    });
    processes.push(child);
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Error('Website startup timed out')), 8000);
        child.stdout.on('data', chunk => {
            const match = String(chunk).match(/ACTIV website on :(\d+)/);
            if (match) { clearTimeout(timer); resolve('http://127.0.0.1:' + match[1]); }
        });
        child.once('exit', code => { clearTimeout(timer); reject(Error('Website exited: ' + code)); });
        child.once('error', reject);
    });
}
try {
    const old = await start('previous-hash');
    const next = await start('current-hash');
    for (const origin of [old, next]) {
        for (const version of ['previous-hash', 'current-hash']) {
            const response = await fetch(origin + '/assets/' + version + '.js');
            assert.equal(response.status, 200);
            assert.match(response.headers.get('content-type'), /javascript/);
            assert.match(response.headers.get('cache-control'), /immutable/);
            assert.equal(await response.text(), version);
        }
    }
    const collected = path.join(root, 'extra');
    fs.mkdirSync(collected);
    for (let n = 0; n < 36; n++) {
        fs.writeFileSync(path.join(collected, 'sample.js'), String(n));
        archiveAssets(collected, archive);
    }
    assert.equal(fs.readdirSync(archive).length, 32);
    console.log('Both running website generations served original and new assets, and the archive stayed bounded.');
} finally {
    await Promise.all(processes.map(async child => {
        if (child.exitCode === null) { const ended = once(child, 'exit'); child.kill(); await ended; }
    }));
    fs.rmSync(root, { recursive: true, force: true });
}
