import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const compiled = await build({ absWorkingDir: root, entryPoints: ['src/lib/androidAppEntry.ts'], bundle: true, write: false, platform: 'node', format: 'cjs' });
const module = { exports: {} };new Function('module','exports',compiled.outputFiles[0].text)(module,module.exports);
const { androidAppTarget: target, androidAppIntent: intent, isAndroidBrowser, ACTIV_ANDROID_STORE_URL } = module.exports;
const accepted = ['/', '/onboarding', '/notifications', '/login', '/register', '/about', '/membership', '/contact', '/donate', '/privacy-policy', '/terms-and-conditions', '/refund-policy', '/cancellation-policy', '/delete-account', '/events', '/events/my-event', '/events/my-event/book', '/member/events', '/member/events/my-event/book', '/news/story', '/gallery/album/photo/2', '/schemes/central', '/schemes/state/tamil-nadu', '/schemes/view/123', '/states/tamil-nadu/events', '/regions/south/leaders', '/legal/privacy', '/member/forms/business', '/member/application-status', '/member/settings', '/member/documents', '/member/updates/123', '/member/certificate/membership', '/payment/membership-plans', '/payment/member-dashboard'];
for (const path of accepted) assert.equal(target(path),`https://activ.org.in${path}`,path);
assert.equal(target('/events/example/book?ref=ACTIV-EVT-001&utm_source=whatsapp'),'https://activ.org.in/events/example/book?ref=ACTIV-EVT-001');
assert.equal(target('/member/events/example/book?ref=ABCD_123'),'https://activ.org.in/member/events/example/book?ref=ABCD_123');
assert.equal(target('/contact?state=Tamil%20Nadu'),'https://activ.org.in/contact?state=Tamil+Nadu');
assert.equal(target('/?notifications=open&notice=0123456789abcdef01234567'),'https://activ.org.in/?notifications=open&notice=0123456789abcdef01234567');
assert.equal(target('/notifications?notice=0123456789abcdef01234567'),'https://activ.org.in/notifications?notice=0123456789abcdef01234567');
assert.equal(target('/payment/membership-plans?renew=true&upgrade=1'),'https://activ.org.in/payment/membership-plans?renew=true&upgrade=1');
for (const path of ['/admin','/super-admin/events','/events-admin','/auth/social','/auth/social?code=abc','/checkin/token','/donate/receipt/token','/donate/statement/token','/donate/thank-you','/member/payment','/member/payment-success?view=receipt','/payment-success','/payment/confirmation','/payment/gateway','/reset-password','/unknown','/business/settings','/events/example/book/extra']) assert.equal(target(path),null,path);
for (const bad of ['https://evil.test/events/a/book','https://activ.org.in.evil.test/events/a','https://activ.org.in@evil.test/events/a','https://user:pass@activ.org.in/events/a','https://www.activ.org.in/events/a','http://activ.org.in/events/a','//evil.test/events/a','/events/a#Intent;package=evil;end','/events/a%23Intent%3bpackage=evil','/events/a%3bpackage=evil','/events/../login','/events/%2e%2e/login','/events/a%2fbook','/events/a\\book','/events/a%0abook','/events/%ZZ','/events/a/book?ref=abc%3bpackage%3devil','/events/a/book?ref=abc&ref=other','/events/a/book?ref=abc%2523Intent','/events/a/book?token=secret','/login?access_token=secret','/events/a?orderId=123','/contact?state=Tamil%0aNadu','/member/documents?view=receipt']) assert.equal(target(bad),null,bad);
for (const key of ['manageToken','manage_token','manage','edit','token','MANAGE_TOKEN','%6DanageToken','%65dit']) {
  assert.equal(target('/events/example/book?ref=ACTIV-001&'+key+'=private-edit-token'),null,'Management capability stays on website: '+key);
  assert.equal(target('/member/events/example/book?ref=ACTIV-001&'+key+'=private-edit-token'),null);
}
const href=intent('/events/example/book?ref=ACTIV-001');
assert.equal(href,`intent://activ.org.in/events/example/book?ref=ACTIV-001#Intent;scheme=https;package=in.activ.membership;S.browser_fallback_url=${encodeURIComponent(ACTIV_ANDROID_STORE_URL)};end`);
assert.equal(href.split('#Intent;').length,2);
assert(!decodeURIComponent(href.split('S.browser_fallback_url=')[1]).includes('ref='),'Fallback contains only public Play listing');
assert(isAndroidBrowser('Mozilla/5.0 (Linux; Android 15) AppleWebKit Chrome Mobile'));
assert(!isAndroidBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)'));
assert(!isAndroidBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'));
console.log('PASS Android app entry: explicit route allowlist, booking reference, supported navigation queries, fixed package/Play fallback, callback exclusions and malicious URL rejection');
