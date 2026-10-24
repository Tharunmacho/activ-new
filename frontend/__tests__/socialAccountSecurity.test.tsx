import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import AccountSettings from '../src/screens/member/settings/AccountSettingsScreen';
import ForgotPassword from '../src/screens/auth/ForgotPasswordScreen';
import { PremiumInput } from '../src/ui';
import { changePassword, getMyProfile } from '../src/services/memberApi';
import api from '../src/services/api';
import { accountPasswordStatus, linkedProviderNames } from '../src/utils/authCapabilities';

jest.mock('@react-navigation/native', () => ({ ...jest.requireActual('@react-navigation/native'), useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]) }));
jest.mock('../src/services/memberApi', () => ({ getMyProfile: jest.fn(), getMyApplications: jest.fn(async () => []), changePassword: jest.fn(async () => ({})), isPaidMember: () => false, uploadProfilePhoto: jest.fn(), logoutOnServer: jest.fn() }));
jest.mock('../src/services/api', () => ({ __esModule: true, default: { post: jest.fn(async () => ({})) } }));
jest.mock('../src/components/NotificationPreferences', () => () => null);
jest.mock('../src/components/AssociationUpdatePreferences', () => () => null);
jest.mock('../src/stores/exampleStore', () => ({ useAuthStore: () => ({ logout: jest.fn() }) }));

let screen: Renderer.ReactTestRenderer | undefined;
const navigation = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() };
const texts = () => screen!.root.findAllByType(Text).map(node => node.props.children).join(' ');
const button = (label: string) => screen!.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
const fields = () => screen!.root.findAllByType(PremiumInput);
const field = (label: string) => fields().find(node => node.props.label === label);
const mount = async (capabilities: any) => {
  (getMyProfile as jest.Mock).mockResolvedValue({ fullName: 'Fixture member', email: 'fixture@example.test', ...capabilities });
  await act(async () => { screen = Renderer.create(<AccountSettings navigation={navigation} />); });
};
beforeEach(() => jest.clearAllMocks());
afterEach(async () => { await act(async () => screen?.unmount()); screen = undefined; });

test.each([['google', 'Google'], ['linkedin', 'LinkedIn'], ['facebook', 'Facebook']])('%s-only accounts need no current ACTIV password', async (provider, name) => {
  await mount({ hasPassword: false, passwordStatus: 'not_set', linkedProviders: [provider] });
  expect(texts()).toContain(name);
  expect(texts()).toContain('No ACTIV password is needed');
  expect(field('Current password')).toBeUndefined();
  expect(field('New password')).toBeUndefined();
  expect(button('Update password')).toBeUndefined();
  expect(button('I know my ACTIV password')).toBeUndefined();
  await act(async () => button('Set an ACTIV password (optional)').props.onPress());
  expect(navigation.navigate).toHaveBeenCalledWith('ForgotPassword', { portal: 'member' });
  expect(changePassword).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
});

test('ambiguous legacy provider accounts start with provider sign-in and allow a known password explicitly', async () => {
  await mount({ hasPassword: true, passwordStatus: 'legacy_unknown', linkedProviders: ['google', 'facebook'] });
  expect(field('Current password')).toBeUndefined();
  expect(texts()).toContain('Google, Facebook');
  expect(texts()).not.toContain('This account does not have an ACTIV password.');
  expect(button('Set or reset an ACTIV password (optional)')).toBeDefined();
  await act(async () => button('I know my ACTIV password').props.onPress());
  expect(field('Current password')).toBeDefined();
  await act(async () => button('Update password').props.onPress());
  expect(texts()).toContain('Enter your current password');
  expect(changePassword).not.toHaveBeenCalled();
});

test.each(['set', 'legacy_unknown'])('%s password accounts still send the current password when changing it', async passwordStatus => {
  await mount({ hasPassword: true, passwordStatus, linkedProviders: ['linkedin'] });
  if (passwordStatus === 'legacy_unknown') await act(async () => button('I know my ACTIV password').props.onPress());
  await act(async () => {
    field('Current password')!.props.onChangeText('Existing-password-1');
    field('New password')!.props.onChangeText('New-password-2');
    field('Confirm new password')!.props.onChangeText('New-password-2');
  });
  await act(async () => button('Update password').props.onPress());
  expect(changePassword).toHaveBeenCalledWith('Existing-password-1', 'New-password-2');
  expect(texts()).toContain('Your password has been changed');
  expect(field('Current password')!.props.value).toBe('');
});

test('missing capabilities and the most recent login method never imply a social-only account', async () => {
  await mount({ loginMethod: 'google', linkedProviders: ['google'] });
  expect(field('Current password')).toBeDefined();
  await act(async () => button('Update password').props.onPress());
  expect(changePassword).not.toHaveBeenCalled();
  expect(accountPasswordStatus({ hasPassword: true, linkedProviders: ['google'] })).toBe('set');
  expect(linkedProviderNames({ linkedProviders: ['google', '__proto__', 'google', 'linkedin', { name: 'facebook' }] })).toEqual(['Google', 'LinkedIn']);
});

test('optional password setup uses the existing verified-email flow only after explicit submission', async () => {
  await act(async () => { screen = Renderer.create(<ForgotPassword navigation={navigation as any} route={{ params: { portal: 'member' } } as any} />); });
  expect(texts()).toContain('Set or reset your ACTIV password');
  expect(texts()).toContain('An ACTIV password is optional');
  expect(api.post).not.toHaveBeenCalled();
  await act(async () => field('Email address')!.props.onChangeText('fixture@example.test'));
  await act(async () => button('Send reset link').props.onPress());
  expect(api.post).toHaveBeenCalledWith('/auth/forgot-password', { email: 'fixture@example.test', portal: 'member' });
  expect(texts()).toContain('Check your email');
  expect(field('Current password')).toBeUndefined();
});
