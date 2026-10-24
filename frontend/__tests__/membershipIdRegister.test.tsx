import React from 'react';
import Renderer from 'react-test-renderer';
import { Alert, StyleSheet } from 'react-native';
import WebsiteViewer from '../src/screens/member/website/WebsiteViewerScreen';
import Register from '../src/screens/admin/super/SuperMembershipIdsScreen';
import { readPublicCms } from '../src/services/publicContent';
import { getMembershipId, listMembershipIds, updateMembershipId, deleteMembershipId } from '../src/services/membershipIdApi';

const mockNavigation = { goBack: jest.fn(), navigate: jest.fn() };
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'), useNavigation: () => mockNavigation,
  useFocusEffect: (callback: () => any) => require('react').useEffect(callback, [callback]),
}));
jest.mock('../src/services/publicContent', () => ({ readPublicCms: jest.fn() }));
jest.mock('../src/services/membershipIdApi', () => ({
  ...jest.requireActual('../src/services/membershipIdApi'), getMembershipId: jest.fn(), listMembershipIds: jest.fn(), updateMembershipId: jest.fn(), deleteMembershipId: jest.fn(),
}));
jest.mock('../src/services/api', () => ({ __esModule: true, default: { get: jest.fn() } }));
let screen: Renderer.ReactTestRenderer;
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
const record = { id: 'fixture', membershipNumber: 'ACTIV-STU-20261012-001', fullName: 'Fixture Member', email: 'fixture@example.test', phoneNumber: '9173652408', whatsappNumber: '',
  state: 'Tamil Nadu', district: 'Chennai', block: '', city: '', place: '', educationalQualification: '', memberSince: '2026-10-12', validUntil: '2027-10-11', previousIds: [],
  history: [], planName: 'Student', categoryCode: 'STU', lifetime: false, editable: true, status: 'active', updatedAt: '2026-10-12T10:00:00.000Z' };
const press = (label: string) => {
  const node = screen.root.findAll(n => (n.props.label === label || n.props.accessibilityLabel === label) && typeof n.props.onPress === 'function')[0];
  expect(node).toBeTruthy(); return node.props.onPress();
};
const input = (label: string, value: string) => screen.root.findAll(n => n.props.label === label && typeof n.props.onChangeText === 'function')[0].props.onChangeText(value);
afterEach(async () => { await Renderer.act(async () => screen?.unmount()); jest.clearAllMocks(); jest.restoreAllMocks(); });
test.each([true, false])('news detail uses a full native letter before/after login (guest=%s)', async publicAccess => {
  (readPublicCms as jest.Mock).mockResolvedValue({ title: 'Official letter', body: 'Complete body', image: { url: 'https://example.test/letter.png', alt: 'Letter' }, photos: [] });
  await Renderer.act(async () => { screen = Renderer.create(<WebsiteViewer navigation={mockNavigation} route={{ params: { path: '/news/official-letter', publicAccess } }} />); await flush(); });
  expect(readPublicCms).toHaveBeenCalledWith('/cms/news/official-letter', expect.anything(), undefined);
  const letter = screen.root.findAll(n => n.props.source?.uri === 'https://example.test/letter.png' && n.props.onLoad)[0];
  expect(letter.props.resizeMode).toBe('contain');
  await Renderer.act(async () => { letter.props.onLoad({ nativeEvent: { source: { width: 700, height: 1400 } } }); });
  expect(StyleSheet.flatten(screen.root.findAll(n => n.props.source?.uri === 'https://example.test/letter.png' && n.props.onLoad)[0].props.style).aspectRatio).toBe(0.5);
  await Renderer.act(async () => { press('Enlarge image: Letter'); });
  const viewer = screen.root.findAll(n => n.props.source?.html)[0];
  expect(viewer.props.source.html).toContain('user-scalable=yes');
  expect(viewer.props.source.html).toContain('https://example.test/letter.png');
  expect(viewer.props.javaScriptEnabled).toBe(false);
  await Renderer.act(async () => { press('Close image'); });
  expect(screen.root.findAll(n => n.props.source?.html)).toHaveLength(0);
});
test('register submits corrections and keeps the form on duplicate-ID rejection', async () => {
  (listMembershipIds as jest.Mock).mockResolvedValue({ rows: [record], total: 1, limit: 20, page: 1 });
  (getMembershipId as jest.Mock).mockResolvedValue(record);
  (updateMembershipId as jest.Mock).mockRejectedValueOnce({ response: { data: { message: 'Membership ID already exists. Choose a different ID.' } } }).mockResolvedValue(record);
  await Renderer.act(async () => { screen = Renderer.create(<Register />); await flush(); });
  await Renderer.act(async () => { await press('Edit record'); });
  await Renderer.act(async () => { input('Membership ID', 'activ-stu-20261012-009'); input('Reason for this correction', 'Office correction checked'); });
  await Renderer.act(async () => { await press('Save changes'); });
  expect(JSON.stringify(screen.toJSON())).toContain('Membership ID already exists');
  expect(updateMembershipId).toHaveBeenCalledWith('fixture', expect.objectContaining({ membershipNumber: 'ACTIV-STU-20261012-009', note: 'Office correction checked', updatedAt: record.updatedAt }));
  await Renderer.act(async () => { input('Membership ID', 'ACTIV-STU-20261012-010'); });
  await Renderer.act(async () => { await press('Save changes'); });
  expect(screen.root.findAll(node => node.props.text === 'Membership record updated.').length).toBeGreaterThan(0);
  expect(listMembershipIds).toHaveBeenCalledTimes(2);
});

test('account deletion requires confirmation and refreshes the register', async () => {
  (listMembershipIds as jest.Mock).mockResolvedValue({ rows: [record], total: 1, limit: 20, page: 1 });
  (deleteMembershipId as jest.Mock).mockResolvedValue({ deleted: true });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await Renderer.act(async () => { screen = Renderer.create(<Register />); await flush(); });
  await Renderer.act(async () => { press('Delete account'); });
  expect(deleteMembershipId).not.toHaveBeenCalled();
  expect(alert.mock.calls[0][1]).toContain('fresh registration');
  const confirm = alert.mock.calls[0][2]!.find(action => action.style === 'destructive')!;
  (listMembershipIds as jest.Mock).mockResolvedValue({ rows: [], total: 0, limit: 20, page: 1 });
  await Renderer.act(async () => { await confirm.onPress!(); });
  expect(deleteMembershipId).toHaveBeenCalledWith(record.id);
  expect(screen.root.findAll(node => typeof node.props.text === 'string' && node.props.text.includes('new registration is required')).length).toBeGreaterThan(0);
  expect(screen.root.findAll(node => node.props.children === record.membershipNumber)).toHaveLength(0);
});

test('archived members from an older API cannot appear in the register', async () => {
  (listMembershipIds as jest.Mock).mockResolvedValue({ rows: [record, { ...record, id: 'old', fullName: 'Archived person', status: 'archived', editable: false }], total: 2, limit: 20, page: 1 });
  await Renderer.act(async () => { screen = Renderer.create(<Register />); await flush(); });
  expect(screen.root.findAll(node => node.props.children === 'Archived person')).toHaveLength(0);
  expect(screen.root.findAll(node => node.props.children === 'Fixture Member').length).toBeGreaterThan(0);
});
