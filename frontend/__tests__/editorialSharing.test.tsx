import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Share } from 'react-native';
import { PublicContentCard } from '../src/screens/public/PublicExploreCards';
import PublicContentScreen from '../src/screens/public/PublicContentScreen';
import PublicNewsArticleScreen from '../src/screens/public/PublicNewsArticleScreen';
import UpdateDetailScreen from '../src/screens/member/updates/UpdateDetailScreen';
import AssociationUpdatesScreen from '../src/screens/member/updates/AssociationUpdatesScreen';
import ExploreActiv from '../src/screens/member/dashboard/ExploreActiv';
import { eventShareContent } from '../src/screens/member/events/eventFormat';
import { usePublicResource } from '../src/services/usePublicResource';
import { useLoad } from '../src/screens/member/useLoad';

jest.mock('../src/services/usePublicResource', () => ({ usePublicResource: jest.fn() }));
jest.mock('../src/screens/member/useLoad', () => ({ useLoad: jest.fn() }));
jest.mock('../src/services/publicContent', () => ({ readPublicCms: jest.fn(async () => []) }));
jest.mock('../src/services/memberApi', () => ({ getAnnouncement: jest.fn() }));

let screen: Renderer.ReactTestRenderer | undefined;
const navigation = { navigate: jest.fn(), push: jest.fn(), goBack: jest.fn() };
const button = (label: string) => screen?.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
const resource = (data: any) => (usePublicResource as jest.Mock).mockReturnValue({ data, loading: false, refreshing: false, error: '', reload: jest.fn() });
const sharePayload = () => JSON.stringify((Share.share as jest.Mock).mock.calls.at(-1)?.[0]);
const expectIndependentShare = (label: string) => {
  const target = button(label);
  expect(target).toBeDefined();
  // Accessible pressable parents group descendants on VoiceOver/TalkBack.
  // A sibling action remains a separate focus target without opening the card.
  for (let parent = target?.parent; parent; parent = parent.parent) {
    expect(parent.props.accessible).not.toBe(true);
    expect(parent.props.accessibilityRole === 'button' && typeof parent.props.onPress === 'function').toBe(false);
  }
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
});
afterEach(async () => {
  await act(async () => screen?.unmount()); screen = undefined;
  jest.restoreAllMocks();
});

test.each(['events', 'news', 'gallery'] as const)('%s listing opens its detail and does not show an outside share action', async kind => {
  const open = jest.fn();
  await act(async () => { screen = Renderer.create(<PublicContentCard kind={kind} item={{ slug: 'community-story', title: 'Community story' }} openPage={open} />); });
  expect(Share.share).not.toHaveBeenCalled();
  expect(button('Share Community story')).toBeUndefined();
  await act(async () => button('Community story')?.props.onPress());
  expect(open).toHaveBeenCalledWith('/' + kind + '/community-story', 'Community story');
  expect(Share.share).not.toHaveBeenCalled();
});

test.each([
  ['/gallery/community-album', { kind: 'album', title: 'Community album', item: { slug: 'community-album', title: 'Community album', media: { url: '/cover.jpg' } } }],
  ['/gallery/community-album/photo/1', { kind: 'album', title: 'Community album', photo: 1, item: { slug: 'community-album', title: 'Community album', media: { url: '/cover.jpg' }, photos: [{ url: '/photo.jpg', title: 'Opening ceremony' }] } }],
  ['/schemes/view/grant', { kind: 'scheme', title: 'Enterprise grant', item: { slug: 'grant', title: 'Enterprise grant' } }],
  ['/states/tamil-nadu', { kind: 'region', title: 'Tamil Nadu', page: { stateName: 'Tamil Nadu' }, scope: 'states' }],
] as const)('detail shares the exact public route %s', async (path, data) => {
  resource(data);
  await act(async () => { screen = Renderer.create(<PublicContentScreen navigation={navigation} route={{ params: { path } }} />); });
  await act(async () => button('Share ' + data.title)?.props.onPress());
  expect(sharePayload()).toContain('https://activ.org.in' + path);
  expect(sharePayload()).not.toMatch(/localhost|activApp|cover\.jpg|photo\.jpg/);
  expect(navigation.navigate).not.toHaveBeenCalled();
});

test('scheme listing opens details while the native article keeps its header share action', async () => {
  resource({ kind: 'schemes', title: 'Central schemes', items: [{ slug: 'enterprise-grant', title: 'Enterprise grant' }] });
  await act(async () => { screen = Renderer.create(<PublicContentScreen navigation={navigation} route={{ params: { path: '/schemes/central' } }} />); });
  expect(button('Share Enterprise grant')).toBeUndefined();
  expect(button('Share Central schemes')).toBeUndefined();
  await act(async () => button('View scheme: Enterprise grant')?.props.onPress());
  expect(navigation.push).toHaveBeenCalledWith('PublicContent', { path: '/schemes/view/enterprise-grant', title: 'Enterprise grant' });
  expect(Share.share).not.toHaveBeenCalled();
  resource({ title: 'Industry news', slug: 'industry-news' });
  await act(async () => { screen?.update(<PublicNewsArticleScreen navigation={navigation} slug="legacy-id" />); });
  expectIndependentShare('Share Industry news');
  await act(async () => button('Share Industry news')?.props.onPress());
  expect(sharePayload()).toContain('https://activ.org.in/news/industry-news');
});

test('personalized member update shares only a neutral gated address', async () => {
  (useLoad as jest.Mock).mockReturnValue({ data: { id: 'private-update', title: 'Dear Jane Doe', summary: 'Member account 1234', body: 'Private membership details' }, loading: false, error: '', reload: jest.fn() });
  await act(async () => { screen = Renderer.create(<UpdateDetailScreen navigation={navigation} route={{ params: { id: 'private-update' } }} />); });
  await act(async () => button('Share update')?.props.onPress());
  expect(sharePayload()).toContain('https://activ.org.in/member/updates/private-update');
  expect(sharePayload()).not.toMatch(/Jane|1234|Private membership/);
});

test('association update cards open details without an outside share control', async () => {
  (useLoad as jest.Mock).mockReturnValue({ data: { announcements: [{ id: 'private-update', title: 'Regional circular', summary: 'Member account 1234' }] }, loading: false, error: '', reload: jest.fn() });
  await act(async () => { screen = Renderer.create(<AssociationUpdatesScreen navigation={navigation} />); });
  expect(button('Share ACTIV member update')).toBeUndefined();
  expect(Share.share).not.toHaveBeenCalled();
  expect(navigation.navigate).not.toHaveBeenCalled();
  const open = screen?.root.findAll(node => typeof node.props.onPress === 'function' && String(node.props.accessibilityLabel || '').endsWith(': Regional circular'))[0];
  expect(open).toBeDefined();
  await act(async () => open?.props.onPress());
  expect(navigation.navigate).toHaveBeenCalledWith('UpdateDetail', { id: 'private-update' });
});

test('event shares distinguish public pages from protected member programmes', () => {
  const privateEvent = { id: 'member-event', slug: 'special-programme', title: 'Private programme', status: 'published', audience: 'paid', channel: 'public', showOnOnboarding: true };
  expect(eventShareContent(privateEvent)).toEqual({ path: '/member/events/member-event', title: 'ACTIV member event' });
  expect(eventShareContent({ ...privateEvent, audience: 'all', channel: 'members', showOnOnboarding: false })).toEqual({ path: '/member/events/member-event', title: 'ACTIV member event' });
  expect(eventShareContent({ ...privateEvent, audience: 'all' })).toEqual({ path: '/events/special-programme', title: 'Private programme' });
  expect(eventShareContent({ id: 'confirmed-public', title: 'Public programme' }, true)).toEqual({ path: '/events/confirmed-public', title: 'Public programme' });
  expect(eventShareContent({})).toEqual({ path: '', title: 'ACTIV member event' });
});

test('past public events from member history share a working gated event link', () => {
  const event = { id: 'past-event', slug: 'past-public-event', title: 'Previous public programme', status: 'published',
    audience: 'all', channel: 'public', showOnOnboarding: true, startAt: '2020-01-01T10:00:00Z', endAt: '2020-01-01T12:00:00Z' };
  expect(eventShareContent(event)).toEqual({ path: '/member/events/past-event', title: 'ACTIV member event' });
  expect(eventShareContent({ ...event, startAt: '2099-01-01T10:00:00Z', endAt: '2099-01-01T12:00:00Z' }))
    .toEqual({ path: '/events/past-public-event', title: 'Previous public programme' });
});

test('home dashboard previews open their event, news and gallery details without share controls', async () => {
  const content = { events: [{ id: 'preview-event', title: 'Preview event', startAt: '2099-01-01T10:00:00Z' }],
    news: [{ slug: 'preview-news', title: 'Preview news' }], gallery: [{ slug: 'preview-album', title: 'Preview album', media: { url: '/cover.jpg' } }], zones: [] };
  await act(async () => { screen = Renderer.create(<ExploreActiv navigation={navigation} content={content} publicAccess sections={['events', 'news', 'gallery']} />); });
  for (const title of ['Preview event', 'Preview news', 'Preview album']) {
    expect(button('Share ' + title)).toBeUndefined();
    const open = screen?.root.findAll(node => typeof node.props.onPress === 'function' && String(node.props.accessibilityLabel || '').startsWith(title + '.'))[0];
    expect(open).toBeDefined();
    await act(async () => open?.props.onPress());
  }
  expect(Share.share).not.toHaveBeenCalled();
  expect(navigation.navigate).toHaveBeenCalledWith('PublicEventDetail', { id: 'preview-event' });
  expect(navigation.push).toHaveBeenCalledTimes(2);
});
