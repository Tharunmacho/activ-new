/**
 * `npx tsx src/lib/sisterConcerns.test.ts` from `website/`.
 *
 * Plain `node:test`, run directly — the website has no test runner configured
 * and adding one to cover two pure functions would be a larger change than the
 * thing it tests. The shrinking rule is the part with a decision in it, so it
 * is the part worth pinning down.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { resizeCompanyNames, toCount } from './sisterConcerns';

test('a number builds that many boxes', () => {
    assert.deepEqual(resizeCompanyNames([''], 3), ['', '', '']);
    assert.deepEqual(resizeCompanyNames([], 2), ['', '']);
    assert.deepEqual(resizeCompanyNames(['a'], 1), ['a']);
});

test('none means no boxes at all, not one empty box', () => {
    assert.deepEqual(resizeCompanyNames(['a', 'b'], 0), []);
    assert.deepEqual(resizeCompanyNames([''], 0), []);
});

test('growing keeps what was already typed', () => {
    assert.deepEqual(resizeCompanyNames(['Acme'], 3), ['Acme', '', '']);
});

test('SHRINKING DROPS THE BLANK ROW, NOT THE TYPED NAME', () => {
    // The case the rule exists for: Baker is last but it is the blank in the
    // middle that carries nothing.
    assert.deepEqual(resizeCompanyNames(['Acme', '', 'Baker'], 2), ['Acme', 'Baker']);
    assert.deepEqual(resizeCompanyNames(['', 'Acme', ''], 1), ['Acme']);
    // Whitespace is blank.
    assert.deepEqual(resizeCompanyNames(['Acme', '   ', 'Baker'], 2), ['Acme', 'Baker']);
});

test('with no blanks left, the trailing name goes — the honest consequence', () => {
    assert.deepEqual(resizeCompanyNames(['Acme', 'Baker', 'Crown'], 2), ['Acme', 'Baker']);
    assert.deepEqual(resizeCompanyNames(['Acme', 'Baker'], 1), ['Acme']);
});

test('a malformed count or list never throws', () => {
    assert.deepEqual(resizeCompanyNames(['a'], Number.NaN), []);
    assert.deepEqual(resizeCompanyNames(['a'], -2), []);
    assert.deepEqual(resizeCompanyNames(null as unknown as string[], 2), ['', '']);
});

test('the count field accepts digits and nothing else', () => {
    assert.equal(toCount('3'), '3');
    assert.equal(toCount('-3'), '3');
    assert.equal(toCount('2.5'), '25');
    assert.equal(toCount('1e5'), '15');
    assert.equal(toCount('abc'), '');
    // Empty is NOT zero — it is "no answer yet", and the caller must not
    // resize on it.
    assert.equal(toCount(''), '');
});
