import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';

const source = await readFile(new URL('../src/lib/amountInWords.ts', import.meta.url), 'utf8');
const { code } = await transform(source, { loader: 'ts', format: 'esm' });
const { amountInWords } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

assert.equal(amountInWords(200000), 'Rupees Two Lakh Only');
assert.equal(amountInWords(10000), 'Rupees Ten Thousand Only');
assert.equal(amountInWords(1234567.89), 'Rupees Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven and Eighty Nine Paise Only');
assert.equal(amountInWords(10000000), 'Rupees One Crore Only');
assert.equal(amountInWords(0), 'Rupees Zero Only');
assert.equal(amountInWords(0.05), 'Rupees Zero and Five Paise Only');
assert.equal(amountInWords(1.005), 'Rupees One and One Paise Only');
assert.equal(amountInWords(9.995), 'Rupees Ten Only');
for (const value of [null, undefined, NaN, Infinity, -100, Number.MAX_SAFE_INTEGER]) assert.equal(amountInWords(value), '');
console.log('PASS: Indian rupee words, paise, display rounding, zero and missing/invalid amounts.');
