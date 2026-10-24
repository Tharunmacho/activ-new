import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { FlatList, RefreshControl, Share, Text, TextInput } from 'react-native';
import MemberEventsScreen from '../src/screens/member/events/MemberEventsScreen';
import { listMemberEvents } from '../src/services/memberApi';

// Keep the screen, filters, controls, list, lifecycle rules and useLoad real.
// Only the network, focus boundary and decorative header are replaced.
const mockFocus = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => {
    mockFocus.mockImplementation(callback);
    require('react').useEffect(callback, [callback]);
  },
}));
jest.mock('../src/services/memberApi', () => ({ listMemberEvents: jest.fn() }));
jest.mock('../src/screens/member/events/eventSeats', () => ({
  ...jest.requireActual('../src/screens/member/events/eventSeats'),
  useEventSeats: () => ({}),
}));
jest.mock('../src/ui', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    ...jest.requireActual('../src/ui'),
    PremiumPageHeader: ({ children }: any) => <View>{children}</View>,
    EventTicket3D: () => null,
    EventCalendar3D: () => null,
  };
});

const events = [
  { id: 'cancelled', title: 'Community meet', startAt: '2026-10-23T04:30:00Z', category: 'Community', venue: 'Chennai', myRegistration: { source: 'booking', bookingRef: 'CANCELLED-REF', status: 'cancelled' } },
  { id: 'past-ticket', title: 'Previous members summit', startAt: '2026-10-12T04:30:00Z', endAt: '2026-10-12T10:00:00Z', category: 'Conference', myRegistration: { source: 'booking', bookingRef: 'PAST-REF', status: 'active', payment: { status: 'paid' } } },
  { id: 'workshop', title: 'Export workshop', startAt: '2026-10-21T04:30:00Z', category: 'Training', language: 'English', mode: 'online', onlinePlatform: 'Meet', myRegistration: { source: 'booking', bookingRef: 'WORKSHOP-REF', status: 'active', seats: 2, payment: { status: 'paid' } } },
  { id: 'summit', title: 'Business summit', startAt: '2026-10-20T04:30:00Z', category: 'Conference', language: 'Tamil', mode: 'offline', venue: 'Hyderabad', registrationFee: 500 },
  { id: 'live', title: 'Three day programme', startAt: '2026-10-14T04:30:00Z', endAt: '2026-10-17T13:00:00Z', category: 'Training', language: 'Tamil / English', mode: 'offline', venue: 'Chennai' },
  { id: 'past-open', title: 'Earlier public meeting', startAt: '2026-10-10T04:30:00Z', endAt: '2026-10-10T10:00:00Z', category: 'Community' },
  { id: 'payment', title: 'Industry conference', startAt: '2026-10-22T04:30:00Z', category: 'Conference', myRegistration: { source: 'booking', bookingRef: 'PAYMENT-REF', status: 'active', payment: { status: 'pending' } } },
];
const navigation = { navigate: jest.fn(), goBack: jest.fn() };
let tree: Renderer.ReactTestRenderer | undefined;
const root = () => {
  if (!tree) throw new Error('Screen is not mounted');
  return tree.root;
};
const textOf = (node: Renderer.ReactTestInstance) => node.findAllByType(Text)
  .map(text => React.Children.toArray(text.props.children).filter(value => typeof value === 'string' || typeof value === 'number').join(''))
  .join('\n');
const screenText = () => textOf(root());
const carousel = () => root().findAllByType(FlatList).find(node => node.props.horizontal);
const shownIds = () => (carousel()?.props.data || []).map((event: any) => event.id);
const pressLabel = async (label: string) => {
  const button = root().findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
  if (!button) throw new Error(`Missing button: ${label}`);
  await act(async () => { button.props.onPress(); });
};
const pressText = async (text: string, role = 'button') => {
  const button = root().findAll(node => node.props.accessibilityRole === role && typeof node.props.onPress === 'function' && textOf(node).split('\n').includes(text))[0];
  if (!button) throw new Error(`Missing ${role}: ${text}`);
  await act(async () => { button.props.onPress(); });
};
const openFilters = async () => {
  const button = root().findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function' && textOf(node).startsWith('Filters'))[0];
  await act(async () => { button.props.onPress(); });
};
const edit = async (label: string, value: string) => {
  const input = root().findAllByType(TextInput).find(node => node.props.accessibilityLabel === label);
  if (!input) throw new Error(`Missing input: ${label}`);
  await act(async () => { input.props.onChangeText(value); });
};
const select = async (label: string, placeholder: string, option: string) => {
  await pressLabel(`${label}: ${placeholder}`);
  await pressText(option, 'radio');
};
const render = async () => {
  await act(async () => { tree = Renderer.create(<MemberEventsScreen navigation={navigation} />); });
};
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-15T06:00:00Z'));
  jest.clearAllMocks();
  (listMemberEvents as jest.Mock).mockReset().mockResolvedValue({ events });
});
afterEach(async () => {
  if (tree) await act(async () => { tree!.unmount(); });
  tree = undefined;
  jest.clearAllTimers();
  jest.useRealTimers();
});

test('Upcoming, Registered and Past retain chronological order and exclude cancelled registrations', async () => {
  await render();
  expect(listMemberEvents).toHaveBeenCalledTimes(1);
  expect(shownIds()).toEqual(['live', 'summit', 'workshop', 'payment', 'cancelled']);
  expect(screenText()).toContain('Happening now');
  await pressLabel('Registered, 3');
  expect(shownIds()).toEqual(['past-ticket', 'workshop', 'payment']);
  await pressLabel('Past, 2');
  expect(shownIds()).toEqual(['past-ticket', 'past-open']);
  await pressLabel('Upcoming, 5');
  expect(shownIds()).toEqual(['live', 'summit', 'workshop', 'payment', 'cancelled']);
  expect(listMemberEvents).toHaveBeenCalledTimes(1);
});

test('event listing has no outside share action and still opens event details', async () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  try {
    await render();
    await edit('Search events', 'Business summit');
    const target = root().findAll(node => node.props.accessibilityLabel === 'Share ACTIV member event' && typeof node.props.onPress === 'function')[0];
    expect(target).toBeUndefined();
    expect(share).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
    await pressLabel('View details: Business summit');
    expect(navigation.navigate).toHaveBeenCalledWith('MemberEventDetail', { id: 'summit' });
  } finally { share.mockRestore(); }
});

test('search matches venue, keeps tab totals, and clear restores the current tab', async () => {
  await render();
  await edit('Search events', '  HYDERABAD  ');
  expect(shownIds()).toEqual(['summit']);
  await pressLabel('Registered, 3');
  expect(shownIds()).toEqual([]);
  expect(screenText()).toContain('No matching events');
  await pressText('Clear all');
  expect(shownIds()).toEqual(['past-ticket', 'workshop', 'payment']);
  expect(root().findAllByType(TextInput)[0].props.value).toBe('');
});

test('category and inclusive date filters combine and retain programmes spanning the chosen dates', async () => {
  await render();
  await openFilters();
  await select('Category', 'All categories', 'Training');
  expect(shownIds()).toEqual(['live', 'workshop']);
  await edit('From date', '2026-10-16');
  await edit('To date', '2026-10-17');
  expect(shownIds()).toEqual(['live']);
  await edit('From date', '2026-10-18');
  await edit('To date', '2026-10-19');
  expect(shownIds()).toEqual([]);
  expect(screenText()).toContain('Try a wider date range or clear your filters.');
  await pressText('Clear all');
  expect(shownIds()).toHaveLength(5);
  for (const input of root().findAllByType(TextInput)) expect(input.props.value).toBe('');
  expect(root().findAll(node => node.props.accessibilityLabel === 'Category: All categories').length).toBeGreaterThan(0);
});

test('language, area and attendance selections use the visible filter controls together', async () => {
  await render();
  await openFilters();
  await select('Language', 'All languages', 'English');
  expect(shownIds()).toEqual(['live', 'workshop']);
  await select('Attendance', 'All formats', 'In person');
  expect(shownIds()).toEqual(['live']);
  await select('Area / venue', 'All areas', 'Chennai');
  expect(shownIds()).toEqual(['live']);
  await pressText('Clear all');
  expect(shownIds()).toHaveLength(5);
});

test('invalid and reversed date ranges show actionable feedback and can be cleared', async () => {
  await render();
  await openFilters();
  await edit('From date', '2026-02-30');
  expect(screenText()).toContain('Enter dates as YYYY-MM-DD.');
  await edit('From date', '2026-10-22');
  await edit('To date', '2026-10-20');
  expect(screenText()).toContain('The end date must be on or after the start date.');
  await pressText('Clear all');
  expect(screenText()).not.toContain('The end date must be on or after the start date.');
  expect(shownIds()).toHaveLength(5);
});

test('cards open the correct detail or ticket, including pending payment and cancelled registrations', async () => {
  await render();
  await pressLabel('Business summit, View details');
  expect(navigation.navigate).toHaveBeenLastCalledWith('MemberEventDetail', { id: 'summit' });
  await pressLabel('Registered, 3');
  await pressLabel('Export workshop, View ticket');
  expect(navigation.navigate).toHaveBeenLastCalledWith('EventBooking', { eventId: 'workshop', ref: 'WORKSHOP-REF' });
  await pressLabel('Industry conference, Complete payment');
  expect(navigation.navigate).toHaveBeenLastCalledWith('EventBooking', { eventId: 'payment', ref: 'PAYMENT-REF' });
  await pressLabel('Upcoming, 5');
  await edit('Search events', 'Community meet');
  await pressLabel('Community meet, View details');
  expect(navigation.navigate).toHaveBeenLastCalledWith('MemberEventDetail', { id: 'cancelled' });
  await pressText('Clear all');
  await pressLabel('Past, 2');
  await pressLabel('Earlier public meeting, View event');
  expect(navigation.navigate).toHaveBeenLastCalledWith('MemberEventDetail', { id: 'past-open' });
});

test('initial loading, API failure and retry use the real loading lifecycle', async () => {
  const request = deferred<any>();
  (listMemberEvents as jest.Mock).mockReturnValueOnce(request.promise);
  await render();
  expect(root().findAll(node => node.props.accessibilityRole === 'progressbar' && node.props.accessibilityLabel === 'Loading').length).toBeGreaterThan(0);
  expect(carousel()).toBeUndefined();
  await act(async () => { request.reject(new Error('Connection unavailable')); });
  expect(screenText()).toContain('Events could not be loaded');
  expect(screenText()).toContain('Cannot reach the server. Check your internet connection.');
  await pressLabel('Try again');
  expect(listMemberEvents).toHaveBeenCalledTimes(2);
  expect(shownIds()).toHaveLength(5);
  expect(screenText()).not.toContain('Events could not be loaded');
});

test('pull refresh retains readable results until replacement arrives and return focus refreshes quietly', async () => {
  await render();
  const request = deferred<any>();
  (listMemberEvents as jest.Mock).mockReturnValueOnce(request.promise);
  await act(async () => { root().findByType(RefreshControl).props.onRefresh(); });
  expect(root().findByType(RefreshControl).props.refreshing).toBe(true);
  expect(shownIds()).toHaveLength(5);
  await act(async () => { request.resolve({ events: [events.find(event => event.id === 'summit')] }); });
  expect(root().findByType(RefreshControl).props.refreshing).toBe(false);
  expect(shownIds()).toEqual(['summit']);
  await act(async () => { mockFocus(); });
  expect(listMemberEvents).toHaveBeenCalledTimes(3);
  expect(shownIds()).toHaveLength(5);
});

test('an empty Registered tab offers the upcoming programme without an extra request', async () => {
  (listMemberEvents as jest.Mock).mockResolvedValue({ events: [events.find(event => event.id === 'summit')] });
  await render();
  await pressLabel('Registered, 0');
  expect(screenText()).toContain('You have not registered for any events yet');
  await pressLabel('See all events');
  expect(shownIds()).toEqual(['summit']);
  expect(listMemberEvents).toHaveBeenCalledTimes(1);
});
