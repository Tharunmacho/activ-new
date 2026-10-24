import React from 'react';
import Renderer from 'react-test-renderer';
import { Alert } from 'react-native';
import Memberships from '../src/screens/admin/super/SuperMembershipRegistrationsScreen';
import Bookings from '../src/screens/admin/super/SuperBookingsScreen';
import * as api from '../src/services/superApi';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useFocusEffect: (callback: () => any) => require('react').useEffect(callback, [callback]),
}));
jest.mock('../src/services/superApi', () => ({
  getMembershipRegistrations: jest.fn(), deleteArchivedMembershipPayment: jest.fn(),
  listBookingOverview: jest.fn(), deleteArchivedEventHistory: jest.fn(),
  errorText: (error: Error) => error.message,
}));
jest.mock('../src/screens/admin/super/BookingFilters', () => () => null);
jest.mock('../src/screens/admin/super/SuperBookingPeopleScreen', () => ({ BookingPeoplePane: () => null }));

let screen: Renderer.ReactTestRenderer;
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
const payment = { id: 'archived-order', memberId: 'deleted-member', registrationDeleted: true, name: 'Deleted account', email: 'archive@example.test', planName: 'Student', orderId: 'ORDER-ARCHIVE', status: 'paid', amount: 500 };
const event = { id: 'old-event', title: 'Old workshop', historyCategory: 'deleted', startAt: '2026-10-01', totalSeats: 0, bookings: 1 };
const button = (label: string) => screen.root.findAll(node => node.props.label === label && typeof node.props.onPress === 'function')[0];
const changeTab = async (value: string, option: string) => {
  const tab = screen.root.findAll(node => node.props.options?.some((item: any) => item.value === option) && typeof node.props.onChange === 'function')[0];
  await Renderer.act(async () => { tab.props.onChange(value); await flush(); });
};
const confirmLast = async (proceed: boolean) => {
  const calls = (Alert.alert as jest.Mock).mock.calls;
  const actions = calls[calls.length - 1][2];
  const action = actions.find((item: any) => item.style === (proceed ? 'destructive' : 'cancel'));
  await Renderer.act(async () => { action.onPress(); await flush(); });
};
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  (api.getMembershipRegistrations as jest.Mock).mockResolvedValue({ summary: {}, rows: [], payments: [payment, { ...payment, id: 'live-order', registrationDeleted: false, memberId: 'live-member' }] });
  (api.listBookingOverview as jest.Mock).mockResolvedValue({ events: [event, { ...event, id: 'past-event', historyCategory: 'past' }, { ...event, id: 'current-event', historyCategory: 'current' }], historyTotals: {} });
});
afterEach(async () => { await Renderer.act(async () => screen?.unmount()); jest.restoreAllMocks(); });

test('archived payment deletion requires confirmation, blocks duplicate taps and refreshes only after success', async () => {
  await Renderer.act(async () => { screen = Renderer.create(<Memberships />); await flush(); });
  await changeTab('payments', 'archived');
  expect(button('Delete permanently')).toBeUndefined();
  await changeTab('archived', 'archived');
  await Renderer.act(async () => { button('Delete permanently').props.onPress(); await flush(); });
  expect(api.deleteArchivedMembershipPayment).not.toHaveBeenCalled();
  expect((Alert.alert as jest.Mock).mock.calls.at(-1)[1]).toContain('ORDER-ARCHIVE');
  await confirmLast(false);
  expect(api.deleteArchivedMembershipPayment).not.toHaveBeenCalled();
  let finish: (value: any) => void = () => {};
  (api.deleteArchivedMembershipPayment as jest.Mock).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  await Renderer.act(async () => { button('Delete permanently').props.onPress(); await flush(); });
  await confirmLast(true);
  expect(api.deleteArchivedMembershipPayment).toHaveBeenCalledWith('archived-order');
  await Renderer.act(async () => { button('Delete permanently').props.onPress(); await flush(); });
  expect(api.deleteArchivedMembershipPayment).toHaveBeenCalledTimes(1);
  (api.getMembershipRegistrations as jest.Mock).mockResolvedValue({ summary: {}, rows: [], payments: [] });
  await Renderer.act(async () => { finish({ deleted: true }); await flush(); });
  expect(button('Delete permanently')).toBeUndefined();
  expect(api.getMembershipRegistrations).toHaveBeenCalledTimes(2);
});

test('failed payment deletion keeps the archived row available and shows the server error', async () => {
  (api.deleteArchivedMembershipPayment as jest.Mock).mockRejectedValue(new Error('Payment settlement in progress'));
  await Renderer.act(async () => { screen = Renderer.create(<Memberships />); await flush(); });
  await changeTab('archived', 'archived');
  await Renderer.act(async () => { button('Delete permanently').props.onPress(); await flush(); });
  await confirmLast(true);
  expect(button('Delete permanently').props.disabled).toBe(false);
  expect(Alert.alert).toHaveBeenCalledWith('Could not delete archived payment', 'Payment settlement in progress');
  expect(api.getMembershipRegistrations).toHaveBeenCalledTimes(1);
});

test('event history deletion is offered only for Old and cancelled confirmation never calls the API', async () => {
  await Renderer.act(async () => { screen = Renderer.create(<Bookings />); await flush(); });
  expect(button('Delete old history permanently')).toBeUndefined();
  await changeTab('past', 'deleted');
  expect(button('Delete old history permanently')).toBeUndefined();
  await changeTab('deleted', 'deleted');
  await Renderer.act(async () => { button('Delete old history permanently').props.onPress(); await flush(); });
  expect((Alert.alert as jest.Mock).mock.calls.at(-1)[1]).toContain('Old workshop');
  expect(api.deleteArchivedEventHistory).not.toHaveBeenCalled();
  await confirmLast(false);
  expect(api.deleteArchivedEventHistory).not.toHaveBeenCalled();
  (api.deleteArchivedEventHistory as jest.Mock).mockResolvedValue({ deleted: true });
  await Renderer.act(async () => { button('Delete old history permanently').props.onPress(); await flush(); });
  (api.listBookingOverview as jest.Mock).mockResolvedValue({ events: [], historyTotals: {} });
  await confirmLast(true);
  expect(api.deleteArchivedEventHistory).toHaveBeenCalledWith('old-event');
  expect(button('Delete old history permanently')).toBeUndefined();
});
