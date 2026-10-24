import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Alert, Platform, Share, StyleSheet } from 'react-native';
import { PublicShareButton } from '../src/components/PublicShareButton';
import { publicShareUrl, sharePublicPage } from '../src/services/contentShare';

const origin = 'https://activ.org.in';
const notice = '607f1f77bcf86cd799439011';
const otherNotice = '607f1f77bcf86cd799439012';
const setPlatform = (value: 'ios' | 'android') => Object.defineProperty(Platform, 'OS', { configurable: true, value });
let screen: Renderer.ReactTestRenderer | undefined;
let nativeShare: jest.SpyInstance;
let alert: jest.SpyInstance;
const button = () => screen!.root.findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')[0];
const deferredShare = () => {
  let finish!: (result: { action: string }) => void;
  nativeShare.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  return () => finish({ action: Share.sharedAction });
};

beforeEach(() => {
  setPlatform('android');
  nativeShare = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(async () => {
  if (screen) await act(async () => screen!.unmount());
  screen = undefined;
  jest.restoreAllMocks();
});

test.each([
  '/', '/onboarding', '/about', '/membership', '/contact', '/donate', '/notifications',
  '/events', '/events/community-day', '/events/community-day/book',
  '/news', '/news/community-day', '/news/community%20day', '/news/%E0%AE%A4%E0%AE%AE%E0%AE%BF%E0%AE%B4%E0%AF%8D',
  '/gallery', '/gallery/community-day', '/gallery/community-day/photo/0',
  '/schemes', '/schemes/central', '/schemes/state', '/schemes/state/tamil-nadu', '/schemes/view/industry-scheme',
  '/regions/south', '/regions/south/events', '/states/tamil-nadu', '/states/tamil-nadu/sectorUpdates',
  '/privacy-policy', '/terms-and-conditions', '/refund-policy', '/cancellation-policy', '/legal/privacy-policy',
  '/network/company/' + notice, '/member/updates/' + notice, '/member/events/' + notice,
])('shares a supported recipient-facing route: %s', path => {
  expect(publicShareUrl(path)).toBe(origin + path);
});

test('uses the production HTTPS origin even in development and discards session/app/tracking parameters', () => {
  expect(__DEV__).toBe(true);
  for (const source of ['', 'http://activ.org.in', 'https://www.activ.org.in', 'http://localhost:8080']) {
    expect(publicShareUrl(source + '/events/community-day?activApp=1&token=secret&auth=secret&utm_source=app#private'))
      .toBe(origin + '/events/community-day');
  }
  expect(publicShareUrl('https://activ.org.in?access_token=secret')).toBe(origin + '/');
});

test.each([
  '', 'news/item', '//evil.example/events/id', 'https://evil.example/events/id',
  'https://activ.org.in.evil.example/events/id', 'https://activ.org.in@evil.example/events/id',
  'https://user:password@activ.org.in/events/id', 'https://activ.org.in:8080/events/id',
  'https://api.activ.org.in/events/id', 'http://localhost:5000/events/id',
  'file:///storage/private.pdf', 'content://private/document', 'javascript:alert(1)',
  '/api/events', '/admin/events', '/super-admin/updates', '/member/dashboard', '/member/company',
  '/login', '/reset-password?token=secret', '/checkin/secret', '/donate/receipt/secret', '/donate/statement/secret',
  '/uploads/private.pdf', '/assets/private.pdf', '/zones', '/network/company/secret',
  '/news/id/book', '/news/id/photo/0', '/gallery/id/book', '/events/id/photo/0',
  '/member/events/id/book', '/member/events/id/register', '/events/id/extra',
  '/news/..', '/news/.', '/news/%2e%2e', '/news/%2E', '/news/%252e%252e',
  '/news/%2fadmin', '/news/%5cadmin', '/news/%3freset', '/news/%23private',
  '/news/%00', '/news/%0A', '/news/%7F', '/news/%zz', '/news/%E0%A4',
  '/news/a\\b', '/news/a\nb',
])('rejects external, private, nonexistent, or unsafe routes: %s', path => {
  expect(publicShareUrl(path)).toBe('');
});

test('keeps the website notice identifier while removing all other query data', () => {
  expect(publicShareUrl('/notifications?activApp=1&notice=' + notice + '&token=secret&utm_medium=app#private'))
    .toBe(origin + '/notifications?notice=' + notice);
  expect(publicShareUrl('/notifications?id=' + notice)).toBe(origin + '/notifications?notice=' + notice);
  expect(publicShareUrl('/notifications?id=' + otherNotice + '&notice=' + notice)).toBe(origin + '/notifications?notice=' + notice);
  expect(publicShareUrl('/notifications#fragment?notice=' + notice)).toBe(origin + '/notifications');
  expect(publicShareUrl('/notifications?notice=' + notice + '#fragment?id=' + otherNotice)).toBe(origin + '/notifications?notice=' + notice);
  expect(publicShareUrl('/events/id?notice=' + notice)).toBe(origin + '/events/id');
});

test.each(['', 'secret', '607f1f77bcf86cd79943901', notice + 'x', '%zz', '%2fprivate', notice + '%0A'])('rejects malformed public notice identifiers: %s', id => {
  expect(publicShareUrl('/notifications?notice=' + id)).toBe('');
});

test('Android puts the canonical URL exactly once in the message and converts CMS markup to plain text', async () => {
  expect(await sharePublicPage({ path: '/news/community?activApp=1', title: '<b>Community</b> &amp; **industry** <script>secret()</script>' })).toBe(true);
  expect(nativeShare).toHaveBeenCalledWith({ title: 'Community & industry', message: 'Community & industry\n' + origin + '/news/community' }, { dialogTitle: 'Share Community & industry' });
});

test('iOS gives the native sheet a URL without duplicating it in the message', async () => {
  setPlatform('ios');
  expect(await sharePublicPage({ path: '/gallery/community', title: 'Community photos' })).toBe(true);
  expect(nativeShare).toHaveBeenCalledWith({ title: 'Community photos', message: 'Community photos', url: origin + '/gallery/community' }, { dialogTitle: 'Share Community photos' });
});

test.each(['ios', 'android'] as const)('neutralizes restricted member titles on %s', async platform => {
  setPlatform(platform);
  await sharePublicPage({ path: '/member/updates/' + notice + '?auth=secret', title: 'Dear Jane, your private business update' });
  await sharePublicPage({ path: '/member/events/' + notice, title: 'Private board event for Jane' });
  const payloads = nativeShare.mock.calls.map(call => call[0]);
  expect(payloads[0].title).toBe('ACTIV association update');
  expect(payloads[1].title).toBe('ACTIV member event');
  expect(JSON.stringify(nativeShare.mock.calls)).not.toMatch(/Jane|private|board|auth=|secret/);
  expect(JSON.stringify(payloads)).toContain('/member/updates/' + notice);
  expect(JSON.stringify(payloads)).toContain('/member/events/' + notice);
});

test('uses a readable fallback and bounds long share titles', async () => {
  await sharePublicPage({ path: '/about', title: '<script>secret()</script>' });
  expect(nativeShare.mock.calls[0][0].title).toBe('ACTIV');
  await sharePublicPage({ path: '/about', title: 'A'.repeat(250) });
  expect(nativeShare.mock.calls[1][0].title).toHaveLength(200);
});

test('invalid targets never open a native sheet or error alert', async () => {
  expect(await sharePublicPage({ path: '/donate/receipt/private', title: 'Receipt' })).toBe(false);
  expect(nativeShare).not.toHaveBeenCalled();
  expect(alert).not.toHaveBeenCalled();
});

test('native dismissal and cancellation are quiet and permit another attempt', async () => {
  nativeShare.mockResolvedValueOnce({ action: Share.dismissedAction });
  nativeShare.mockRejectedValueOnce(new Error('User cancelled share'));
  nativeShare.mockRejectedValueOnce({ code: 'ERR_CANCELED' });
  for (let attempt = 0; attempt < 3; attempt++) expect(await sharePublicPage({ path: '/about' })).toBe(false);
  expect(alert).not.toHaveBeenCalled();
  expect(await sharePublicPage({ path: '/about' })).toBe(true);
  expect(nativeShare).toHaveBeenCalledTimes(4);
});

test('native failures show a useful error and release the sharing guard', async () => {
  nativeShare.mockRejectedValueOnce(new Error('Native activity unavailable'));
  expect(await sharePublicPage({ path: '/about' })).toBe(false);
  expect(alert).toHaveBeenCalledWith('Could not share', expect.stringContaining('try again'));
  expect(await sharePublicPage({ path: '/about' })).toBe(true);
});

test('synchronous native failures also release the sharing guard', async () => {
  nativeShare.mockImplementationOnce(() => { throw new Error('Native bridge missing'); });
  expect(await sharePublicPage({ path: '/about' })).toBe(false);
  expect(alert).toHaveBeenCalledTimes(1);
  expect(await sharePublicPage({ path: '/about' })).toBe(true);
});

test('concurrent calls across different cards open one sheet, then allow another after it closes', async () => {
  const finish = deferredShare();
  const first = sharePublicPage({ path: '/about' });
  const second = await sharePublicPage({ path: '/events' });
  finish();
  expect(await first).toBe(true);
  expect(second).toBe(false);
  expect(nativeShare).toHaveBeenCalledTimes(1);
  expect(await sharePublicPage({ path: '/events' })).toBe(true);
});

test.each(['surface', 'glass'] as const)('%s button suppresses card navigation and rapid double taps while exposing its busy state', async appearance => {
  const finish = deferredShare();
  const stopPropagation = jest.fn();
  await act(async () => { screen = Renderer.create(<PublicShareButton path="/events/community" title="Community" appearance={appearance} />); });
  const press = button().props.onPress;
  await act(async () => { press({ stopPropagation }); press({ stopPropagation }); });
  expect(stopPropagation).toHaveBeenCalledTimes(2);
  expect(nativeShare).toHaveBeenCalledTimes(1);
  expect(button().props.disabled).toBe(true);
  expect(button().props.accessibilityState).toEqual({ disabled: true });
  await act(async () => { finish(); });
  expect(button().props.disabled).toBe(false);
  await act(async () => { button().props.onPress({ stopPropagation }); });
  expect(nativeShare).toHaveBeenCalledTimes(2);
});

test('compact buttons retain an accessible name and a 44px touch target', async () => {
  await act(async () => { screen = Renderer.create(<PublicShareButton path="/about" title="About ACTIV" compact />); });
  expect(button().props.accessibilityRole).toBe('button');
  expect(button().props.accessibilityLabel).toBe('Share About ACTIV');
  const style = button().props.style;
  expect(StyleSheet.flatten(typeof style === 'function' ? style({ pressed: false }) : style)).toMatchObject({ minWidth: 44, minHeight: 44 });
});

test('invalid paths hide the share action', async () => {
  await act(async () => { screen = Renderer.create(<PublicShareButton path="/admin/updates" title="Private" />); });
  expect(screen!.toJSON()).toBeNull();
});

test('an in-flight sheet can finish safely after its card unmounts', async () => {
  const finish = deferredShare();
  await act(async () => { screen = Renderer.create(<PublicShareButton path="/about" title="About" />); });
  await act(async () => { button().props.onPress({ stopPropagation: jest.fn() }); });
  await act(async () => { screen!.unmount(); });
  screen = undefined;
  await act(async () => { finish(); });
  expect(await sharePublicPage({ path: '/events' })).toBe(true);
  expect(alert).not.toHaveBeenCalled();
});
