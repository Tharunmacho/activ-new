#!/usr/bin/env node
'use strict';

// Check actual DEX definitions, not string references or ProGuard configuration.
// RN 0.82 loads react_devsupportjni in release too: its JNI registration needs
// these Java names even when R8 finds no reachable Java calls to the connection.
const fs = require('node:fs');
const path = require('node:path');
const {inflateRawSync} = require('node:zlib');

const connection = 'com.facebook.react.devsupport.CxxInspectorPackagerConnection';
const required = new Map([
  [connection, ['initHybrid', 'connect', 'closeQuietly', 'sendEventToAllConnections']],
  [connection + '$DelegateImpl', ['connectWebSocket', 'scheduleCallback']],
  [connection + '$WebSocketDelegate', ['didFailWithError', 'didReceiveMessage', 'didOpen', 'didClose']],
  [connection + '$IWebSocket', ['send', 'close']],
  ['com.facebook.react.devsupport.InspectorFlags', ['getFuseboxEnabled', 'getIsProfilingBuild']],
  ['com.facebook.react.modules.network.InspectorNetworkReporter', ['isDebuggingEnabled']],
]);

function* dexFiles(archive) {
  // APK signing blocks precede the central directory and need no special handling.
  let end = archive.length - 22;
  const earliest = Math.max(0, end - 0xffff);
  while (end >= earliest && archive.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < earliest) throw new Error('Missing ZIP central directory');
  const count = archive.readUInt16LE(end + 10);
  let offset = archive.readUInt32LE(end + 16);
  for (let i = 0; i < count; i++) {
    if (archive.readUInt32LE(offset) !== 0x02014b50) throw new Error('Invalid ZIP entry');
    const method = archive.readUInt16LE(offset + 10);
    const size = archive.readUInt32LE(offset + 20);
    const nameLength = archive.readUInt16LE(offset + 28);
    const name = archive.toString('utf8', offset + 46, offset + 46 + nameLength);
    const local = archive.readUInt32LE(offset + 42);
    offset += 46 + nameLength + archive.readUInt16LE(offset + 30) + archive.readUInt16LE(offset + 32);
    if (!/^(?:base\/dex\/)?classes\d*\.dex$/.test(name)) continue;
    const start = local + 30 + archive.readUInt16LE(local + 26) + archive.readUInt16LE(local + 28);
    const data = archive.subarray(start, start + size);
    if (method !== 0 && method !== 8) throw new Error('Unsupported ZIP compression');
    yield method === 8 ? inflateRawSync(data) : data;
  }
}

function definitions(dex) {
  if (dex.toString('ascii', 0, 4) !== 'dex\n') throw new Error('Invalid DEX header');
  const u32 = offset => dex.readUInt32LE(offset);
  const stringIds = u32(60);
  const typeIds = u32(68);
  const methodIds = u32(92);
  const classes = u32(96);
  const classDefs = u32(100);
  const uleb = cursor => {
    let result = 0;
    for (let shift = 0; shift < 35; shift += 7) {
      const byte = dex[cursor.offset++];
      if (byte === undefined) throw new Error('Truncated DEX data');
      result |= (byte & 0x7f) << shift;
      if (!(byte & 0x80)) return result >>> 0;
    }
    throw new Error('Invalid DEX integer');
  };
  const string = index => {
    const cursor = {offset: u32(stringIds + index * 4)};
    uleb(cursor); // String length is ULEB128; class/method names here are ASCII.
    return dex.toString('utf8', cursor.offset, dex.indexOf(0, cursor.offset));
  };
  const result = new Map();
  for (let i = 0; i < classes; i++) {
    const entry = classDefs + i * 32;
    const name = string(u32(typeIds + u32(entry) * 4)).slice(1, -1).replaceAll('/', '.');
    if (!required.has(name)) continue;
    const methods = new Set();
    const cursor = {offset: u32(entry + 24)};
    if (cursor.offset) {
      const staticFields = uleb(cursor), instanceFields = uleb(cursor);
      const directMethods = uleb(cursor), virtualMethods = uleb(cursor);
      for (let f = 0; f < staticFields + instanceFields; f++) { uleb(cursor); uleb(cursor); }
      for (const count of [directMethods, virtualMethods]) {
        let index = 0;
        for (let m = 0; m < count; m++) {
          index += uleb(cursor);
          uleb(cursor); // Access flags.
          uleb(cursor); // Code offset (zero for native or abstract methods).
          methods.add(string(u32(methodIds + index * 8 + 4)));
        }
      }
    }
    result.set(name, methods);
  }
  return result;
}

function verify(file) {
  const found = new Map();
  let dexCount = 0;
  for (const dex of dexFiles(fs.readFileSync(file))) {
    dexCount++;
    for (const [name, methods] of definitions(dex)) found.set(name, methods);
  }
  if (!dexCount) throw new Error('No release DEX files found');
  const missing = [];
  for (const [name, methods] of required) {
    if (!found.has(name)) { missing.push(name); continue; }
    for (const method of methods) {
      if (!found.get(name).has(method)) missing.push(`${name}.${method}`);
    }
  }
  if (missing.length) throw new Error('Release JNI bindings removed or renamed:\n' + missing.join('\n'));
  console.log(`PASS: ${required.size} React Native JNI classes and their required methods survive release optimization in ${path.basename(file)}.`);
}

try {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: node scripts/verify-release-jni.cjs <release.aab|release.apk>');
  verify(path.resolve(file));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
