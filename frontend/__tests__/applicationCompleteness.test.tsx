import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import DeclarationFormScreen from '../src/screens/profile/DeclarationFormScreen';
import BusinessScreen from '../src/screens/profile/BusinessInformationFormScreen';
import { FormFooter } from '../src/screens/profile/formKit';
import * as member from '../src/services/memberApi';
import api from '../src/services/api';

jest.mock('../src/services/memberApi', () => ({
  getMyProfile: jest.fn(), getBusinessInfo: jest.fn(), getFinancialInfo: jest.fn(),
  getDeclarationInfo: jest.fn(), getMyApplications: jest.fn(), updateProfile: jest.fn(),
}));
jest.mock('../src/services/api', () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock('../src/screens/profile/PlatinumApplicationCard', () => () => null);
const mocked = member as jest.Mocked<typeof member>;
const nav: any = { navigate: jest.fn(), goBack: jest.fn(), reset: jest.fn(), canGoBack: () => true };
let screen: Renderer.ReactTestRenderer;
const profile = { fullName: 'Complete Member', email: 'complete@example.test', phoneNumber: '9123456780', state: 'Tamil Nadu', district: 'Chennai', city: 'Chennai', religion: 'Hindu', socialCategory: 'SC', gender: 'Female' };
beforeEach(() => {
  jest.clearAllMocks(); jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mocked.getMyProfile.mockResolvedValue(profile as any);
  mocked.getBusinessInfo.mockResolvedValue({ doingBusiness: false, registrationType: 'student' } as any);
  mocked.getFinancialInfo.mockResolvedValue({} as any);
  mocked.getDeclarationInfo.mockResolvedValue({ agreeToDeclaration: true, sisterConcerns: 0, companyNames: [] } as any);
  mocked.getMyApplications.mockResolvedValue([]);
  mocked.updateProfile.mockResolvedValue({} as any);
  (api.post as jest.Mock).mockResolvedValue({ data: { data: { _id: 'existing-pending' } } });
});
afterEach(async () => { if (screen) await act(async () => screen.unmount()); });
const renderDeclaration = async () => { await act(async () => { screen = Renderer.create(<DeclarationFormScreen navigation={nav} route={{ params: {} } as any} />); }); };
const submit = async () => { await act(async () => { await screen.root.findByType(FormFooter).props.onPrimary(); }); };

it.each([{}, { doingBusiness: null }, { doingBusiness: false }, { doingBusiness: true }, { doingBusiness: true, businessCommencementYear: '9999' }])('blocks final submit when Business is incomplete: %j', async business => {
  mocked.getBusinessInfo.mockResolvedValue(business as any);
  await renderDeclaration();
  expect(screen.root.findByType(FormFooter).props.disabled).toBe(true);
  await submit();
  expect(member.updateProfile).not.toHaveBeenCalled(); expect(api.post).not.toHaveBeenCalled();
});
it('keeps business loading failures from saving or navigating', async () => {
  mocked.getBusinessInfo.mockRejectedValueOnce(Error('Temporary failure'));
  await act(async () => { screen = Renderer.create(<BusinessScreen navigation={nav} route={{ params: {} } as any} />); });
  expect(screen.root.findByType(FormFooter).props.disabled).toBe(true);
  await submit(); expect(member.updateProfile).not.toHaveBeenCalled(); expect(nav.navigate).not.toHaveBeenCalled();
});
it('requires every named sister concern when a business declares a positive count', async () => {
  mocked.getBusinessInfo.mockResolvedValue({ doingBusiness: true, registrationType: 'business', businessCommencementYear: '2020' } as any);
  mocked.getDeclarationInfo.mockResolvedValue({ agreeToDeclaration: true, sisterConcerns: 2, companyNames: ['Only one'] } as any);
  await renderDeclaration(); await submit();
  expect(member.updateProfile).not.toHaveBeenCalled(); expect(api.post).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith('Declaration needed', expect.stringContaining('one company name'));
});
it.each(['student', 'aspirant'])('ignores inapplicable company questions for %s', async registrationType => {
  mocked.getBusinessInfo.mockResolvedValue({ doingBusiness: false, registrationType } as any);
  mocked.getDeclarationInfo.mockResolvedValue({ agreeToDeclaration: true, sisterConcerns: 2, companyNames: ['Old business'] } as any);
  await renderDeclaration(); await submit();
  expect(member.updateProfile).toHaveBeenCalledWith({ agreeToDeclaration: true, sisterConcerns: 0, companyNames: [] });
  expect(api.post).toHaveBeenCalledWith('/applications', expect.objectContaining({ registrationType }));
});
it('resubmits the complete pending application instead of only saving its declaration', async () => {
  mocked.getMyApplications.mockResolvedValue([{ _id: 'existing-pending', status: 'Pending' }] as any);
  await renderDeclaration();
  expect(screen.root.findByType(FormFooter).props.primaryLabel).toBe('Submit application');
  await submit(); expect(api.post).toHaveBeenCalledTimes(1); expect(nav.reset).toHaveBeenCalled();
});
it('saves an approved member’s declaration without creating another application', async () => {
  mocked.getMyApplications.mockResolvedValue([{ status: 'Approved' }] as any);
  await renderDeclaration(); await submit();
  expect(member.updateProfile).toHaveBeenCalledTimes(1); expect(api.post).not.toHaveBeenCalled();
});
it('fails closed when a required section cannot be read back after saving', async () => {
  mocked.getBusinessInfo.mockResolvedValueOnce({ doingBusiness: false, registrationType: 'student' } as any).mockRejectedValueOnce(Error('Cannot read saved business'));
  await renderDeclaration(); await submit();
  expect(member.updateProfile).toHaveBeenCalledTimes(1); expect(api.post).not.toHaveBeenCalled(); expect(nav.reset).not.toHaveBeenCalled();
});
it('leaves the form open if final submission fails', async () => {
  (api.post as jest.Mock).mockRejectedValueOnce({ response: { status: 400, data: { message: 'Please complete Business information' } } });
  await renderDeclaration(); await submit();
  expect(nav.reset).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith('Could not submit', expect.stringContaining('Business information'));
});
