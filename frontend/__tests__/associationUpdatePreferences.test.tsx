import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Switch, Text, TouchableOpacity } from 'react-native';
import AssociationUpdatePreferences from '../src/components/AssociationUpdatePreferences';
import api from '../src/services/api';

jest.mock('../src/services/api', () => ({ __esModule: true, default: { get: jest.fn(), patch: jest.fn() } }));
const initial = { email: true, whatsapp: false, whatsappNumber: '9092317264' };
const response = (data: any) => ({ data: { data } });
let screen: Renderer.ReactTestRenderer;
const switches = () => screen.root.findAllByType(Switch);
const toggle = (label: string) => switches().find(node => node.props.accessibilityLabel === label);
const copy = () => screen.root.findAllByType(Text).map(node => String(node.props.children || '')).join(' ');
const mount = async () => { await act(async () => { screen = Renderer.create(<AssociationUpdatePreferences />); }); };
beforeEach(() => { jest.clearAllMocks(); (api.get as jest.Mock).mockResolvedValue(response(initial)); });
afterEach(async () => { if (screen) await act(async () => { screen.unmount(); }); });

it('loads server settings and displays the consent phone without opting in', async () => {
  await mount();
  expect(api.get).toHaveBeenCalledWith('/notifications/update-preferences');
  expect(toggle('Email association updates')?.props.value).toBe(true);
  expect(toggle('WhatsApp association updates')?.props.value).toBe(false);
  expect(copy()).toContain('agree to receive association updates on WhatsApp at 9092317264');
  expect(api.patch).not.toHaveBeenCalled();
});

it('sends only the changed channel, blocks repeat taps and trusts the server response', async () => {
  let finish: (value: any) => void = () => {};
  (api.patch as jest.Mock).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await mount();
  await act(async () => { void toggle('WhatsApp association updates')?.props.onValueChange(true); });
  expect(api.patch).toHaveBeenCalledWith('/notifications/update-preferences', { whatsapp: true });
  expect(switches().every(node => node.props.disabled)).toBe(true);
  expect(toggle('WhatsApp association updates')?.props.value).toBe(false);
  await act(async () => { void toggle('Email association updates')?.props.onValueChange(false); });
  expect(api.patch).toHaveBeenCalledTimes(1);
  await act(async () => { finish(response({ email: false, whatsapp: true, whatsappNumber: '+919092317264' })); });
  expect(toggle('Email association updates')?.props.value).toBe(false);
  expect(toggle('WhatsApp association updates')?.props.value).toBe(true);
  expect(copy()).toContain('+919092317264');
  (api.patch as jest.Mock).mockResolvedValue(response({ ...initial, email: false }));
  await act(async () => { await toggle('WhatsApp association updates')?.props.onValueChange(false); });
  expect(api.patch).toHaveBeenLastCalledWith('/notifications/update-preferences', { whatsapp: false });
});

it('preserves confirmed values after save failure and reloads before another consent attempt', async () => {
  (api.patch as jest.Mock).mockRejectedValue(Object.assign(new Error('Request failed'), { response: { data: { message: 'Your contact details changed. Please refresh.' } } }));
  await mount();
  await act(async () => { await toggle('WhatsApp association updates')?.props.onValueChange(true); });
  expect(toggle('WhatsApp association updates')?.props.value).toBe(false);
  expect(copy()).toContain('Your contact details changed');
  expect(switches().every(node => node.props.disabled)).toBe(true);
  (api.get as jest.Mock).mockResolvedValue(response({ ...initial, whatsappNumber: '9123456780' }));
  await act(async () => { await screen.root.findByType(TouchableOpacity).props.onPress(); });
  expect(copy()).toContain('9123456780');
  expect(switches().every(node => !node.props.disabled)).toBe(true);
});

it('offers retry on malformed/failed load and prevents WhatsApp consent without a number', async () => {
  (api.get as jest.Mock).mockResolvedValue(response({}));
  await mount();
  expect(switches()).toHaveLength(0);
  expect(copy()).toContain('could not be confirmed');
  (api.get as jest.Mock).mockResolvedValue(response({ ...initial, whatsappNumber: '' }));
  await act(async () => { await screen.root.findByType(TouchableOpacity).props.onPress(); });
  expect(toggle('WhatsApp association updates')?.props.disabled).toBe(true);
  await act(async () => { await toggle('WhatsApp association updates')?.props.onValueChange(true); });
  expect(api.patch).not.toHaveBeenCalled();
});
