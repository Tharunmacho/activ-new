import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const year = 365 * 86400 * 1000;
const budget = 512 * 1024 * 1024;
const releaseName = /^[a-f0-9]{64}$/;
const assetName = /^[A-Za-z0-9_][A-Za-z0-9._+-]*$/;

function releases(directory) {
    return fs.readdirSync(directory, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && releaseName.test(entry.name))
        .flatMap(entry => {
            const folder = path.join(directory, entry.name);
            try {
                return [{ folder, mtime: fs.statSync(folder).mtimeMs, bytes: Number(fs.readFileSync(path.join(folder, '.size'), 'utf8')) }];
            } catch (err) {
                if (err.code === 'ENOENT') return [];
                throw err;
            }
        })
        .sort((a, b) => b.mtime - a.mtime);
}

export function archiveAssets(source, directory) {
    fs.mkdirSync(directory, { recursive: true });
    const entries = fs.readdirSync(source, { withFileTypes: true })
        .filter(entry => entry.isFile() && assetName.test(entry.name)).map(entry => entry.name).sort();
    if (!entries.length) throw Error('Website build contains no static assets');
    const digest = crypto.createHash('sha256');
    let bytes = 0;
    for (const name of entries) {
        const data = fs.readFileSync(path.join(source, name));
        bytes += data.length;
        if (bytes > budget) throw Error('Website asset build exceeds its storage budget');
        digest.update(name).update('\0').update(crypto.createHash('sha256').update(data).digest());
    }
    const destination = path.join(directory, digest.digest('hex'));
    if (!fs.existsSync(destination)) {
        const temporary = fs.mkdtempSync(path.join(directory, '.writing-'));
        try {
            for (const name of entries) fs.copyFileSync(path.join(source, name), path.join(temporary, name));
            fs.writeFileSync(path.join(temporary, '.size'), String(bytes));
            try { fs.renameSync(temporary, destination); }
            catch (err) { if (!['EEXIST', 'ENOTEMPTY'].includes(err.code)) throw err; }
        } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
    }
    const now = new Date();
    fs.utimesSync(destination, now, now);
    let retained = bytes;
    let count = 1;
    for (const release of releases(directory)) {
        if (release.folder === destination) continue;
        if (count >= 32 || now.getTime() - release.mtime > year || retained + release.bytes > budget) {
            fs.rmSync(release.folder, { recursive: true, force: true });
        } else { retained += release.bytes; count++; }
    }
}

// Query the shared directory on a miss so an older running task also sees
// chunks published by a newer task during a start-first rollout.
export function previousAsset(directory, pathname) {
    if (!pathname.startsWith('/assets/')) return;
    const name = pathname.slice('/assets/'.length);
    if (!assetName.test(name)) return;
    for (const { folder } of releases(directory)) {
        const file = path.join(folder, name);
        if (fs.existsSync(file)) return file;
    }
}
