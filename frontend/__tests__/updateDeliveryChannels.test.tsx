import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import api from '../src/services/api';
import { createAnnouncement, updateAnnouncement, setAnnouncementStatus } from '../src/services/superApi';
import { resolveUpdateDeliveryChannels } from '../src/utils/updateDeliveryChannels';
import SuperUpdatesScreen from '../src/screens/admin/super/SuperUpdatesScreen';
import { MiniAction } from '../src/screens/admin/super/superKit';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));
jest.mock('../src/services/api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() } }));

const allOff = { email: false, whatsapp: false, push: false };
const allOn = { email: true, whatsapp: true, push: true };
const combinations = Array.from({ length: 8 }, (_, mask) => ({ email: !!(mask & 1), whatsapp: !!(mask & 2), push: !!(mask & 4) }));
let screen: Renderer.ReactTestRenderer | undefined;

beforeEach(() => {
  jest.clearAllMocks();
  for (const method of ['post', 'put', 'patch'] as const) (api[method] as jest.Mock).mockResolvedValue({ data: { data: { id: 'saved' } } });
});
afterEach(async () => { if (screen) await act(async () => { screen?.unmount(); }); screen = undefined; });

it('defaults new updates off and resolves only missing legacy settings to all channels', () => {
  expect(resolveUpdateDeliveryChannels(undefined)).toEqual(allOff);
  expect(resolveUpdateDeliveryChannels(undefined, true)).toEqual(allOn);
  expect(resolveUpdateDeliveryChannels(allOff, true)).toEqual(allOff);
  for (const malformed of [null, false, 'true', [], { email: 'false', whatsapp: 1, push: 'true' },
    { email: true }, { email: true, whatsapp: false }, { ...allOn, sms: true },
    { email: true, whatsapp: false, push: 'false' }, Object.assign(Object.create({ email: true }), { whatsapp: true, push: true })]) {
    expect(resolveUpdateDeliveryChannels(malformed, true)).toEqual(allOff);
  }
});

it.each(combinations)('sends the full boolean channel object unchanged through create and edit APIs %j', async deliveryChannels => {
  await createAnnouncement({ title: 'Draft', status: 'draft', deliveryChannels });
  expect(api.post).toHaveBeenLastCalledWith('/announcements', { title: 'Draft', status: 'draft', deliveryChannels });
  await updateAnnouncement('existing/id', { status: 'published', deliveryChannels });
  expect(api.put).toHaveBeenLastCalledWith('/announcements/existing%2Fid', { status: 'published', deliveryChannels });
});

it('leaves existing delivery settings untouched for status-only changes', async () => {
  await setAnnouncementStatus('saved', 'draft');
  expect(api.patch).toHaveBeenCalledWith('/announcements/saved/status', { status: 'draft' });
  await updateAnnouncement('saved', { title: 'New title' });
  expect(api.put).toHaveBeenCalledWith('/announcements/saved', { title: 'New title' });
});

it.each([
  { deliveryChannels: { email: false, whatsapp: true, push: false }, summary: 'Selected channels: WhatsApp' },
  { deliveryChannels: allOff, summary: 'In ACTIV only: no email, WhatsApp or push notifications.' },
  { deliveryChannels: undefined, summary: 'Selected channels: Email, WhatsApp, Push notifications' },
])('shows saved delivery choices in the list and opens review without sending: $summary', async ({ deliveryChannels, summary }) => {
  const announcement = { id: 'saved', title: 'Meeting', body: 'Notice', status: 'draft', deliveryChannels };
  (api.get as jest.Mock).mockResolvedValue({ data: { data: { announcements: [announcement], total: 1 } } });
  await act(async () => { screen = Renderer.create(<SuperUpdatesScreen />); });
  expect(screen?.root.findAllByType(Text).some(node => node.props.children === summary)).toBe(true);
  const review = screen?.root.findAllByType(MiniAction).find(node => node.props.label === 'Review & publish');
  expect(review).toBeDefined();
  await act(async () => { review?.props.onPress(); });
  expect(mockNavigate).toHaveBeenCalledWith('SuperUpdateEditor', { announcement });
  expect(api.post).not.toHaveBeenCalled(); expect(api.put).not.toHaveBeenCalled(); expect(api.patch).not.toHaveBeenCalled();
});
