import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import api from '../src/services/api';
import { clearSession } from '../src/services/session';
import { PremiumFooter, PremiumInput } from '../src/ui';
import RegistrationStep1Screen from '../src/screens/registration/RegistrationStep1Screen';
import RegistrationStep2Screen from '../src/screens/registration/RegistrationStep2Screen';

// The real registration shell and country selector are rendered in this test.
jest.setTimeout(30000);

jest.mock('../src/services/api', () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock('../src/services/session', () => ({ clearSession: jest.fn(), sanitizeUser: (value: any) => value }));
jest.mock('../src/stores/exampleStore', () => ({ useAuthStore: () => ({ login: jest.fn() }) }));
jest.mock('../src/services/publicNavigation', () => ({ takePublicAction: jest.fn() }));
jest.mock('../src/hooks/useRegionCascade', () => ({ __esModule: true, default: () => ({ states: [], districts: [], blocks: [], state: '', district: '', block: '', reload: jest.fn() }) }));
let screen: Renderer.ReactTestRenderer;
const navigation = { navigate: jest.fn(), goBack: jest.fn(), reset: jest.fn() };
const field = (label: string) => screen.root.findAllByType(PremiumInput).find(node => node.props.label === label);
const fill = async (label: string, value: string) => { await act(async () => field(label)?.props.onChangeText(value)); };
const next = async () => { await act(async () => { await screen.root.findByType(PremiumFooter).props.onPrimary(); }); };
beforeEach(() => { jest.clearAllMocks(); (api.post as jest.Mock).mockResolvedValue({ data: { data: {} } }); jest.spyOn(Alert, 'alert').mockImplementation(() => {}); });
afterEach(async () => { if (screen) await act(async () => { screen.unmount(); }); });

it.each(['', '   '])('blocks a blank full name before availability checks or navigation: %j', async name => {
  await act(async () => { screen = Renderer.create(<RegistrationStep1Screen navigation={navigation as any} route={{ params: {} } as any} />); });
  await fill('Full name', name); await fill('Phone number', '9123456780'); await fill('Email address', 'local@example.test'); await fill('Password', 'LocalOnly123!');
  await next();
  expect(field('Full name')?.props.error).toBe('Full name required');
  expect(api.post).not.toHaveBeenCalled();
  expect(navigation.navigate).not.toHaveBeenCalled();
  await fill('Full name', '  Asha Devi  ');
  expect(field('Full name')?.props.error).toBe('');
  await next();
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(navigation.navigate).toHaveBeenCalledWith('RegistrationStep2', expect.objectContaining({ fullName: 'Asha Devi' }));
});

it('allows a verified social name prefill without requiring the member to retype it', async () => {
  await act(async () => { screen = Renderer.create(<RegistrationStep1Screen navigation={navigation as any} route={{ params: { name: 'Asha Devi', email: 'local@example.test' } } as any} />); });
  await fill('Phone number', '9123456780'); await fill('Password', 'LocalOnly123!'); await next();
  expect(navigation.navigate).toHaveBeenCalledWith('RegistrationStep2', expect.objectContaining({ fullName: 'Asha Devi' }));
});

it('rejects a direct location-step entry without a name before clearing the existing session', async () => {
  await act(async () => { screen = Renderer.create(<RegistrationStep2Screen navigation={navigation as any} route={{ params: { fullName: '  ', email: 'local@example.test', password: 'LocalOnly123!', phoneNumber: '9123456780' } } as any} />); });
  await next();
  expect(Alert.alert).toHaveBeenCalledWith('Missing details', expect.stringContaining('Full name'), expect.any(Array));
  expect(clearSession).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
});
