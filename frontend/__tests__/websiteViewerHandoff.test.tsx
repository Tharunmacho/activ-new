import React from 'react';
import Renderer from 'react-test-renderer';
import { Linking } from 'react-native';
import WebsiteViewer from '../src/screens/member/website/WebsiteViewerScreen';
import MemberEventDetail from '../src/screens/member/events/MemberEventDetailScreen';
import { nativeContentRoute } from '../src/services/nativeContentRoute';
import { openWebsitePage } from '../src/services/websiteNavigation';
import { getAuthToken, getUserRole } from '../src/services/api';
import { clearPublicAction, takePublicAction } from '../src/services/publicNavigation';
import { readPublicCms, submitPublicCms } from '../src/services/publicContent';
import { getMemberEvent } from '../src/services/memberApi';

jest.mock('@react-navigation/native', () => ({ ...jest.requireActual('@react-navigation/native'), useFocusEffect: jest.fn() }));
jest.mock('../src/services/api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() }, getAuthToken: jest.fn(), getUserRole: jest.fn() }));
jest.mock('../src/services/memberApi', () => ({ ...jest.requireActual('../src/services/memberApi'), getMemberEvent: jest.fn().mockResolvedValue(null) }));
jest.mock('../src/services/session', () => ({ homeForRole: jest.fn().mockResolvedValue('PaidDashboard') }));
jest.mock('../src/services/publicContent', () => ({
  readPublicCms: jest.fn().mockResolvedValue([]), submitPublicCms: jest.fn(), getPublicEvent: jest.fn().mockResolvedValue({ id: 'event-123' }),
}));
let screen: Renderer.ReactTestRenderer;
const navigation = { navigate: jest.fn(), push: jest.fn(), reset: jest.fn(), goBack: jest.fn(), canGoBack: () => true };
beforeEach(() => { jest.clearAllMocks(); clearPublicAction(); (getAuthToken as jest.Mock).mockResolvedValue('fixture-token'); (getUserRole as jest.Mock).mockResolvedValue('member'); });
afterEach(async () => { await Renderer.act(async () => screen?.unmount()); });

test.each(['/gallery', '/gallery/album/photo/2', '/news', '/news/story', '/zones', '/regions/south', '/states/tamil-nadu', '/states/tamil-nadu/events', '/schemes', '/schemes/state/tamil-nadu', '/schemes/view/example'])('CMS content %s resolves to a native content screen', path => {
  expect(nativeContentRoute(path, 'Content')).toEqual({ name: 'PublicContent', params: { path, title: 'Content' } });
  openWebsitePage(navigation, 'https://activ.org.in' + path, 'Content');
  expect(navigation.push).toHaveBeenCalledWith('PublicContent', { path, title: 'Content' });
  expect(getAuthToken).not.toHaveBeenCalled();
});
test.each(['/about', '/membership', '/contact', '/privacy-policy', '/legal/privacy-policy', '/delete-account'])('information %s resolves to native content', path => {
  expect(nativeContentRoute(path, 'Information')).toEqual({ name: 'PublicInfo', params: { path, title: 'Information' } });
});
const noticeId = '607f1f77bcf86cd799439011';
test.each([
  '/notifications?notice=' + noticeId,
  '/notifications/?activApp=1&notice=' + noticeId + '&auth=private#other',
  '/?notifications=open&notice=' + noticeId,
  '/onboarding?notice=' + noticeId + '&notifications=open',
  'https://activ.org.in/notifications?notice=' + noticeId,
  'https://www.activ.org.in/?notifications=open&notice=' + noticeId,
])('shared notification %s opens the selected native header card', path => {
  const params = { notifications: 'open', noticeId };
  expect(nativeContentRoute(path, 'Update')).toEqual({ name: 'PublicExplore', params });
  openWebsitePage(navigation, path, 'Update');
  expect(navigation.navigate).toHaveBeenCalledWith('PublicExplore', params);
  expect(navigation.push).not.toHaveBeenCalled();
  expect(getAuthToken).not.toHaveBeenCalled();
});
test.each([
  '/notifications', '/notifications?notice=invalid', '/notifications?notice=%zz',
  '/notifications?notice=' + noticeId + '%0A', '/notifications#notice=' + noticeId,
  '/?notifications=open#notice=' + noticeId,
])('notification list links never forward an invalid or fragment identifier: %s', path => {
  expect(nativeContentRoute(path)).toEqual({ name: 'PublicExplore', params: { notifications: 'open' } });
});
test('home links require the explicit card-open flag and external links never become native notification commands', () => {
  expect(nativeContentRoute('/?notice=' + noticeId)).toEqual({ name: 'PublicExplore' });
  expect(nativeContentRoute('/?notifications=closed&notice=' + noticeId)).toEqual({ name: 'PublicExplore' });
  expect(nativeContentRoute('/#notifications=open&notice=' + noticeId)).toEqual({ name: 'PublicExplore' });
  expect(nativeContentRoute('https://evil.example/notifications?notice=' + noticeId)).toBeNull();
});
test('existing saved WebsiteViewer links show native content without loading an ACTIV website', async () => {
  await Renderer.act(async () => { screen = Renderer.create(<WebsiteViewer navigation={navigation} route={{ params: { path: '/news', title: 'News' } }} />); });
  expect(readPublicCms).toHaveBeenCalledWith('/cms/news', expect.anything(), undefined);
  expect(screen.root.findAll(node => !!node.props.source?.uri && /activ\.org\.in/.test(node.props.source.uri))).toHaveLength(0);
  expect(getAuthToken).not.toHaveBeenCalled();
  expect(submitPublicCms).not.toHaveBeenCalled();
});
test('contact links and official portals open their own services; internal source links stay native', async () => {
  const external = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  try {
    for (const href of ['tel:+919999999999', 'mailto:events@activ.org.in', 'https://government.example/scheme']) {
      openWebsitePage(navigation, href, 'Contact');
      expect(external).toHaveBeenLastCalledWith(href);
    }
    openWebsitePage(navigation, 'https://activ.org.in/news/story', 'Story');
    expect(navigation.push).toHaveBeenLastCalledWith('PublicContent', { path: '/news/story', title: 'Story' });
    for (const href of ['javascript:alert(1)', '//evil.example/path', '/bad%00path']) openWebsitePage(navigation, href);
    expect(external).toHaveBeenCalledTimes(3);
  } finally { external.mockRestore(); }
});
test('membership and booking actions continue native authentication and resume once', async () => {
  await Renderer.act(async () => openWebsitePage(navigation, '/events/event-123/book', 'Book'));
  expect(navigation.navigate).toHaveBeenCalledWith('EventBooking', { eventId: 'event-123' });
  expect(navigation.push).not.toHaveBeenCalled();
  (getAuthToken as jest.Mock).mockResolvedValue(null); (getUserRole as jest.Mock).mockResolvedValue(null);
  await Renderer.act(async () => openWebsitePage(navigation, '/membership/join', 'Join'));
  expect(navigation.navigate).toHaveBeenLastCalledWith('Login');
  expect(takePublicAction()).toEqual({ name: 'MembershipPlans' }); expect(takePublicAction()).toBeNull();
});
test.each([
  ['/member/updates/' + noticeId, 'UpdateDetail', { id: noticeId }],
  ['/member/events/' + noticeId, 'MemberEventDetail', { id: noticeId }],
] as const)('member share %s preserves the selected native detail before and after sign-in', async (path, name, params) => {
  await Renderer.act(async () => openWebsitePage(navigation, 'https://activ.org.in' + path + '?auth=discarded', 'Private title'));
  expect(navigation.navigate).toHaveBeenCalledWith(name, params);
  expect(takePublicAction()).toBeNull();
  expect(navigation.push).not.toHaveBeenCalled();

  navigation.navigate.mockClear();
  (getAuthToken as jest.Mock).mockResolvedValue(null); (getUserRole as jest.Mock).mockResolvedValue(null);
  await Renderer.act(async () => openWebsitePage(navigation, path, 'Private title'));
  expect(navigation.navigate).toHaveBeenCalledWith('Login');
  expect(navigation.navigate).not.toHaveBeenCalledWith(name, expect.anything());
  // Password, social sign-in and registration already consume this one-time
  // destination to append the detail after the appropriate member home.
  expect(takePublicAction()).toEqual({ name, params });
  expect(takePublicAction()).toBeNull();
  expect(readPublicCms).not.toHaveBeenCalled();
});
test('the resumed member event params reach the real screen and its authenticated detail request', async () => {
  (getAuthToken as jest.Mock).mockResolvedValue(null); (getUserRole as jest.Mock).mockResolvedValue(null);
  await Renderer.act(async () => openWebsitePage(navigation, '/member/events/' + noticeId));
  const destination = takePublicAction();
  expect(destination?.name).toBe('MemberEventDetail');
  await Renderer.act(async () => {
    screen = Renderer.create(<MemberEventDetail navigation={navigation} route={{ params: destination && 'params' in destination ? destination.params : undefined }} />);
  });
  expect(getMemberEvent).toHaveBeenCalledWith(noticeId);
});
