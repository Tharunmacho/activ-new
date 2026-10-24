import React from 'react';
import Renderer from 'react-test-renderer';
import { Modal, Text, TextInput } from 'react-native';
import PublicExplore from '../src/screens/public/PublicExploreScreen';
import { loadExploreContent } from '../src/services/publicContent';
import { clearPublicAction } from '../src/services/publicNavigation';
import { PremiumSelect } from '../src/ui';
jest.mock('../src/services/publicContent', () => ({ loadExploreContent: jest.fn(), getPublicContactInfo: jest.fn().mockResolvedValue({}) }));
jest.mock('../src/services/publicNavigation', () => ({ clearPublicAction: jest.fn() }));
jest.mock('../src/services/visitorNotifications', () => ({
  getPublicNotices: jest.fn().mockResolvedValue([]),
  getPublicNotice: jest.fn(async id => ({ id, kind: 'announcement', title: 'Linked notification', body: 'Notification detail', createdAt: '2026-10-17' })),
  visitorPushEnabled: jest.fn().mockResolvedValue(false), recordVisitorOpen: jest.fn(),
}));

const load = loadExploreContent as jest.Mock;
const now = Date.now();
const data = {
  events: [
    { id: 'future', slug: 'future-conference', title: 'Future conference', bannerUrl: 'https://example.test/event-banner.jpg', startAt: new Date(now + 86400000).toISOString(), endAt: new Date(now + 90000000).toISOString() },
    { id: 'past', title: 'Finished conference', endAt: new Date(now - 1000).toISOString() },
  ],
  news: [{ id: 'story', title: 'Community news' }],
  gallery: [{ id: 'photo', title: 'Community moments', media: { type: 'video', url: 'https://example.test/video.mp4' } }],
  zones: [{ slug: 'south', label: 'Southern region', states: [{ slug: 'tamil-nadu', name: 'Tamil Nadu' }] }],
};
let screen: Renderer.ReactTestRenderer;
const navigation = { navigate: jest.fn() };
const button = (label: string) => screen.root.findAll(node => (node.props.accessibilityLabel === label || node.props.accessibilityLabel?.startsWith(label + '.')) && typeof node.props.onPress === 'function')[0];
beforeEach(() => { jest.clearAllMocks(); load.mockReset().mockResolvedValue(data); });
afterEach(async () => { await Renderer.act(async () => screen?.unmount()); });

test('public bell opens and closes its card without navigating away from the home screen', async () => {
  await Renderer.act(async () => { screen = Renderer.create(<PublicExplore navigation={navigation} route={{ params: {} }} />); });
  expect(button('Share ACTIV')).toBeUndefined();
  expect(button('Sign in')).toBeDefined();
  await Renderer.act(async () => button('Notifications').props.onPress());
  expect(button('Close notifications')).toBeDefined();
  expect(screen.root.findAllByType(Modal).some(node => node.props.visible)).toBe(true);
  expect(navigation.navigate).not.toHaveBeenCalled();
  await Renderer.act(async () => button('Close notifications').props.onPress());
  expect(button('Close notifications')).toBeUndefined();
});

test('a delivered notification opens inside the public home card and consumes its route request', async () => {
  const setParams = jest.fn();
  await Renderer.act(async () => { screen = Renderer.create(<PublicExplore navigation={{ ...navigation, setParams }} route={{ params: { notifications: 'open', noticeId: 'notice-id' } }} />); });
  expect(setParams).toHaveBeenCalledWith({ notifications: undefined, noticeId: undefined });
  expect(screen.root.findAllByType(Text).some(node => node.props.children === 'Linked notification')).toBe(true);
  expect(button('Back to notifications')).toBeDefined();
  expect(navigation.navigate).not.toHaveBeenCalled();
});

test('guest home shows public content, excludes finished events and opens native guest details', async () => {
  await Renderer.act(async () => { screen = Renderer.create(<PublicExplore navigation={navigation} route={{ params: {} }} />); });
  expect(load.mock.calls[0][0]).toBe('home');
  expect(button('Future conference')).toBeDefined();
  expect(screen.root.findAllByType(require('../src/ui').FitImage).some(node => node.props.uri === 'https://example.test/event-banner.jpg')).toBe(true);
  expect(button('Finished conference')).toBeUndefined();
  const order = ['Upcoming events', 'From the gallery', 'Latest news', 'Schemes', 'ACTIV near you', 'Contact us'];
  expect(screen.root.findAllByType(Text).filter(node => node.props.accessibilityRole === 'header').map(node => node.props.children)
    .filter(label => order.includes(label))).toEqual(order);
  expect(navigation.navigate).not.toHaveBeenCalled();
  await Renderer.act(async () => button('Future conference').props.onPress());
  expect(navigation.navigate).toHaveBeenCalledWith('PublicEventDetail', { id: 'future' });
  await Renderer.act(async () => button('All events').props.onPress());
  expect(navigation.navigate).toHaveBeenLastCalledWith('PublicExplore', { section: 'events' });
});

test.each([false, true])('all four public destinations and membership registration stay accessible (offline: %s)', async offline => {
  if (offline) load.mockRejectedValueOnce(new Error('offline'));
  await Renderer.act(async () => { screen = Renderer.create(<PublicExplore navigation={navigation} route={{ params: {} }} />); });
  for (const [title, path] of [['About ACTIV', '/about'], ['Membership', '/membership'], ['Schemes', '/schemes'], ['Contact us', '/contact']]) {
    await Renderer.act(async () => button(title).props.onPress());
    expect(navigation.navigate).toHaveBeenLastCalledWith(path === '/schemes' ? 'PublicContent' : 'PublicInfo', { path, title });
  }
  await Renderer.act(async () => button('Discover membership benefits').props.onPress());
  expect(navigation.navigate).toHaveBeenLastCalledWith('PublicInfo', { path: '/membership', title: 'Membership' });
  await Renderer.act(async () => button('Become a member').props.onPress());
  expect(clearPublicAction).toHaveBeenCalledTimes(1);
  expect(navigation.navigate).toHaveBeenLastCalledWith('RegistrationStep1');
});

test('public tabs and search remain usable with only current events and no Past Events tab', async () => {
  await Renderer.act(async () => { screen = Renderer.create(<PublicExplore navigation={navigation} route={{ params: {} }} />); });
  for (const name of ['News', 'Gallery', 'Zones', 'Events']) {
    await Renderer.act(async () => button(name).props.onPress());
    expect(load.mock.calls.at(-1)?.[0]).toBe(name.toLowerCase());
    expect(button('Privacy policy')).toBeUndefined();
    expect(button('Terms of use')).toBeUndefined();
    expect(button('Delete account')).toBeUndefined();
  }
  const periods = screen.root.findAll(node => node.props.accessibilityRole === 'tab' && !node.props.accessibilityLabel && typeof node.props.onPress === 'function');
  expect(periods).toHaveLength(0);
  expect(load.mock.calls.at(-1)?.[0]).toBe('events');
  expect(button('Finished conference')).toBeUndefined();
  expect(button('Future conference')).toBeDefined();
  await Renderer.act(async () => screen.root.findByType(TextInput).props.onChangeText('does not match'));
  expect(button('Future conference')).toBeUndefined();
  await Renderer.act(async () => button('Clear search').props.onPress());
  expect(button('Future conference')).toBeDefined();
  expect(navigation.navigate).not.toHaveBeenCalled();
  await Renderer.act(async () => button('Future conference').props.onPress());
  expect(navigation.navigate).toHaveBeenLastCalledWith('PublicEventDetail', { id: 'future-conference' });
});

test('returning from event details opens the native Events tab and consumes its section request', async () => {
  const setParams = jest.fn();
  const nav = { ...navigation, setParams };
  await Renderer.act(async () => { screen = Renderer.create(<PublicExplore navigation={nav} route={{ params: {} }} />); });
  await Renderer.act(async () => screen.update(<PublicExplore navigation={nav} route={{ params: { section: 'events' } }} />));
  expect(load.mock.calls.at(-1)?.[0]).toBe('events');
  expect(setParams).toHaveBeenCalledWith({ section: undefined });
  expect(button('Events').props.accessibilityState.selected).toBe(true);
});

test('the Zones tab selects a published state and opens its native state page', async () => {
  await Renderer.act(async () => { screen = Renderer.create(<PublicExplore navigation={navigation} route={{ params: { section: 'zones' } }} />); });
  const picker = screen.root.findAllByType(PremiumSelect).find(node => node.props.label === 'Find your state');
  expect(picker?.props.options).toEqual(['Tamil Nadu']);
  await Renderer.act(async () => picker?.props.onChange('Tamil Nadu'));
  await Renderer.act(async () => button('Explore Tamil Nadu').props.onPress());
  expect(navigation.navigate).toHaveBeenCalledWith('PublicContent', { path: '/states/tamil-nadu', title: 'Tamil Nadu' });
});

test('failed content can be retried and a late response cannot replace another tab', async () => {
  load.mockRejectedValueOnce(new Error('offline'));
  await Renderer.act(async () => { screen = Renderer.create(<PublicExplore navigation={navigation} route={{ params: { section: 'events' } }} />); });
  expect(button('Future conference')).toBeUndefined();
  await Renderer.act(async () => button('Try again').props.onPress());
  expect(button('Future conference')).toBeDefined();
  let finish: (value: typeof data) => void = () => {};
  load.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await Renderer.act(async () => button('News').props.onPress());
  const cancelledSignal = load.mock.calls.at(-1)?.[1];
  expect(button('Community news')).toBeUndefined();
  await Renderer.act(async () => button('Events').props.onPress());
  expect(cancelledSignal.aborted).toBe(true);
  await Renderer.act(async () => finish({ ...data, events: [] }));
  expect(button('Future conference')).toBeDefined();
});

test('unknown entry tabs open home and sign-in clears abandoned booking intent', async () => {
  await Renderer.act(async () => { screen = Renderer.create(<PublicExplore navigation={navigation} route={{ params: { section: 'invalid' } }} />); });
  expect(load.mock.calls[0][0]).toBe('home');
  await Renderer.act(async () => button('Sign in').props.onPress());
  expect(clearPublicAction).toHaveBeenCalledTimes(1);
  expect(navigation.navigate).toHaveBeenCalledWith('Login');
});

test('the public footer opens the account deletion request form without requiring sign-in', async () => {
  await Renderer.act(async () => { screen = Renderer.create(<PublicExplore navigation={navigation} route={{ params: {} }} />); });
  await Renderer.act(async () => button('Delete account').props.onPress());
  expect(navigation.navigate).toHaveBeenCalledTimes(1);
  expect(navigation.navigate).toHaveBeenCalledWith('PublicInfo', {
    path: '/delete-account', title: 'Delete account',
  });
});
