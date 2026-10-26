import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Share } from 'react-native';
import MemberCertificateScreen from '../src/screens/member/certificates/MemberCertificateScreen';
import { useActiveCompanyStore } from '../src/stores/activeCompanyStore';
import { getCertificate } from '../src/services/memberApi';
import { GlassIconButton, PillTabs, StateView, CompanyChip } from '../src/ui';
import { MembershipCertificateView } from '../src/screens/member/certificates/CertificateViews';

jest.mock('../src/services/memberApi', () => ({ getCertificate: jest.fn() }));
jest.mock('../src/services/api', () => ({ __esModule: true, default: { get: jest.fn() } }));
const companies = [
  { _id: 'company-a', businessName: 'Company Alpha', publication: { unlimited: true } },
  { _id: 'company-b', businessName: 'Company Beta', publication: { unlimited: true } },
];
const certificate = (id: string) => ({ companyId: id, membershipTier: 'platinum', reference: 'CERT-ONE',
  member: { name: 'Test Member', companyName: id === 'company-a' ? 'Company Alpha' : 'Company Beta', membershipNumber: 'ACTIV-SHARED-ID' } });
let screen: Renderer.ReactTestRenderer;
const navigation = { goBack: jest.fn(), navigate: jest.fn(), addListener: jest.fn(() => jest.fn()) };
beforeEach(() => {
  jest.clearAllMocks();
  useActiveCompanyStore.setState({ companies: companies as any, activeCompanyId: 'company-a',
    loadCompanies: jest.fn().mockResolvedValue(companies), hasLoaded: true });
  (getCertificate as jest.Mock).mockImplementation(async (_kind, id) => certificate(id));
});
afterEach(async () => { if (screen) await act(async () => screen.unmount()); jest.restoreAllMocks(); });
const mount = async () => { await act(async () => { screen = Renderer.create(<MemberCertificateScreen navigation={navigation} route={{ params: { kind: 'membership' } }} />); }); };

test('company switches refresh the name while retaining the server-issued shared ID and scoped share link', async () => {
  await mount();
  expect(getCertificate).toHaveBeenLastCalledWith('membership', 'company-a');
  expect(screen.root.findByType(MembershipCertificateView).props.cert.member.companyName).toBe('Company Alpha');
  await act(async () => screen.root.findAllByType(CompanyChip).find(node => node.props.name === 'Company Beta')?.props.onPress());
  expect(getCertificate).toHaveBeenLastCalledWith('membership', 'company-b');
  const cert = screen.root.findByType(MembershipCertificateView).props.cert;
  expect(cert.member.companyName).toBe('Company Beta');
  expect(cert.member.membershipNumber).toBe('ACTIV-SHARED-ID');
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  await act(async () => screen.root.findAllByType(GlassIconButton).find(node => node.props.accessibilityLabel === 'Share certificate')?.props.onPress());
  expect(share).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('membership?companyId=company-b') }));
});

test('an older company response cannot replace the certificate after switching', async () => {
  let finishA: (value: any) => void = () => {};
  (getCertificate as jest.Mock).mockImplementation((_kind, id) => id === 'company-a'
    ? new Promise(resolve => { finishA = resolve; }) : Promise.resolve(certificate(id)));
  await mount();
  await act(async () => useActiveCompanyStore.getState().setActiveCompany('company-b'));
  expect(screen.root.findByType(MembershipCertificateView).props.cert.companyId).toBe('company-b');
  await act(async () => finishA(certificate('company-a')));
  expect(screen.root.findByType(MembershipCertificateView).props.cert.companyId).toBe('company-b');
});

test('rejects an unscoped server response rather than printing the wrong company', async () => {
  (getCertificate as jest.Mock).mockResolvedValue({ ...certificate('company-a'), companyId: undefined });
  await mount();
  expect(screen.root.findAllByType(MembershipCertificateView)).toHaveLength(0);
  expect(screen.root.findByType(StateView).props.message).toContain('selected company certificate could not be loaded');
});

test('an unpaid additional company exposes a publishing action without a certificate', async () => {
  useActiveCompanyStore.setState({ companies: [{ ...companies[0], publication: { ...companies[0].publication, unlimited: false, paymentRequired: true } }] as any });
  (getCertificate as jest.Mock).mockRejectedValue({ response: { status: 403, data: { message: 'Company membership payment required' } } });
  await mount();
  expect(screen.root.findAllByType(MembershipCertificateView)).toHaveLength(0);
  expect(screen.root.findByType(StateView).props.title).toContain('Activate this company');
  await act(async () => screen.root.findByType(StateView).props.onAction());
  expect(navigation.navigate).toHaveBeenCalledWith('Settings');
});

test('tax certificates stay member-scoped when switching tabs', async () => {
  await mount();
  await act(async () => screen.root.findByType(PillTabs).props.onChange('tax-exemption'));
  expect(getCertificate).toHaveBeenLastCalledWith('tax-exemption', undefined);
});
