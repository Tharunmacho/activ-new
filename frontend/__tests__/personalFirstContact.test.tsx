import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import PersonalDetailsFormScreen from '../src/screens/profile/PersonalDetailsFormScreen';
import { PremiumInput, Notice } from '../src/ui';
import { FormFooter, SelectField } from '../src/screens/profile/formKit';
import { getMyProfile, updateProfile, setFirstPassword } from '../src/services/memberApi';

jest.mock('../src/services/memberApi', () => ({ getMyProfile: jest.fn(), updateProfile: jest.fn(), setFirstPassword: jest.fn() }));
jest.mock('../src/services/regions', () => ({
  getStates: jest.fn().mockResolvedValue([]), getDistricts: jest.fn().mockResolvedValue([]),
  getBlocks: jest.fn().mockResolvedValue([]), fetchRegionTree: jest.fn().mockResolvedValue([]),
}));
const navigation: any = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true };
const profile = { fullName: 'New Member', email: 'new@example.test', phoneNumber: '',
  religion: 'Hindu', socialCategory: 'SC', gender: 'Female', registrationIncomplete: true };
let screen: Renderer.ReactTestRenderer;
const mount = async () => { await act(async () => { screen = Renderer.create(<PersonalDetailsFormScreen navigation={navigation} route={{ params: {} } as any} />); }); };
const input = (label: string) => {
  const node = screen.root.findAllByType(PremiumInput).find(item => item.props.label === label);
  if (!node) throw new Error(`Missing input ${label}`);
  return node;
};
const fill = async (label: string, value: string) => { await act(async () => { input(label).props.onChangeText(value); }); };
beforeEach(() => {
  jest.clearAllMocks();
  (getMyProfile as jest.Mock).mockResolvedValue(profile);
  (updateProfile as jest.Mock).mockResolvedValue({});
  (setFirstPassword as jest.Mock).mockResolvedValue({ hasPassword: true, passwordStatus: 'set' });
});
afterEach(async () => { if (screen) await act(async () => { screen.unmount(); }); });

it('lets a new social member enter an overseas phone and required place before continuing', async () => {
  await mount();
  expect(input('Phone number').props.maxLength).toBeGreaterThan(15);
  await fill('Phone number', '+447911123456');
  expect(screen.root.findAllByType(SelectField).some(node => node.props.label === 'State')).toBe(false);
  await fill('Place', 'London');
  await act(async () => { await screen.root.findByType(FormFooter).props.onPrimary(); });
  expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ phoneNumber: '+447911123456', place: 'London', city: 'London', state: undefined }));
  expect(navigation.navigate).toHaveBeenCalledWith('BusinessInformationForm', expect.any(Object));
});

it('restores Indian location fields when a first phone is corrected back to India', async () => {
  await mount();
  await fill('Phone number', '+447911123456');
  await fill('Phone number', '9842175630');
  expect(screen.root.findAllByType(PremiumInput).some(node => node.props.label === 'Place')).toBe(false);
  expect(screen.root.findAllByType(SelectField).some(node => node.props.label === 'State')).toBe(true);
});

it('blocks saving after profile read failure and resumes after retry', async () => {
  (getMyProfile as jest.Mock).mockRejectedValueOnce(new Error('Offline'));
  await mount();
  expect(screen.root.findByType(FormFooter).props.disabled).toBe(true);
  await act(async () => { await screen.root.findByType(FormFooter).props.onPrimary(); });
  expect(updateProfile).not.toHaveBeenCalled();
  const retry = screen.root.findAllByType(Notice).find(node => node.props.action === 'Retry');
  if (!retry) throw new Error('Retry is missing');
  await act(async () => { await retry.props.onAction(); });
  expect(screen.root.findByType(FormFooter).props.disabled).toBe(false);
  expect(input('Full name').props.value).toBe(profile.fullName);
});

it('preserves an existing overseas member location policy when editing the contact number', async () => {
  (getMyProfile as jest.Mock).mockResolvedValue({ ...profile, phoneNumber: '+447911123456', isInternational: true, country: 'United Kingdom', place: 'London' });
  await mount(); await fill('Phone number', '9123456780');
  expect(input('Place').props.value).toBe('London');
});

const socialProfile = { ...profile, phoneNumber: '+447911123456', isInternational: true, country: 'United Kingdom', place: 'London',
  hasPassword: false, passwordStatus: 'not_set', linkedProviders: ['google'] };
it('sets the first social-account password separately while completing the profile', async () => {
  (getMyProfile as jest.Mock).mockResolvedValue(socialProfile);
  await mount();
  expect(input('New password').props.secureTextEntry).toBe(true);
  await fill('New password', 'Fixture-password-123');
  await fill('Confirm password', 'Fixture-password-123');
  await act(async () => { await screen.root.findByType(FormFooter).props.onPrimary(); });
  expect(setFirstPassword).toHaveBeenCalledWith('Fixture-password-123', 'Fixture-password-123');
  expect(updateProfile).toHaveBeenCalledTimes(1);
  expect(JSON.stringify((updateProfile as jest.Mock).mock.calls)).not.toContain('Fixture-password-123');
  expect(JSON.stringify(navigation.navigate.mock.calls)).not.toContain('Fixture-password-123');
});
it('rejects mismatched passwords without saving or leaving the form', async () => {
  (getMyProfile as jest.Mock).mockResolvedValue(socialProfile);
  await mount(); await fill('New password', 'Fixture-password-123'); await fill('Confirm password', 'Different-password');
  await act(async () => { await screen.root.findByType(FormFooter).props.onPrimary(); });
  expect(input('Confirm password').props.error).toContain('do not match');
  expect(setFirstPassword).not.toHaveBeenCalled(); expect(updateProfile).not.toHaveBeenCalled();
});
it('leaves social-only login available when both optional password fields are blank', async () => {
  (getMyProfile as jest.Mock).mockResolvedValue(socialProfile);
  await mount(); await act(async () => { await screen.root.findByType(FormFooter).props.onPrimary(); });
  expect(setFirstPassword).not.toHaveBeenCalled(); expect(updateProfile).toHaveBeenCalledTimes(1);
});
it('does not save the profile if first-password setup fails', async () => {
  (getMyProfile as jest.Mock).mockResolvedValue(socialProfile);
  (setFirstPassword as jest.Mock).mockRejectedValueOnce(new Error('Sign in again'));
  await mount(); await fill('New password', 'Fixture-password-123'); await fill('Confirm password', 'Fixture-password-123');
  await act(async () => { await screen.root.findByType(FormFooter).props.onPrimary(); });
  expect(updateProfile).not.toHaveBeenCalled(); expect(navigation.navigate).not.toHaveBeenCalled();
});
