import React from 'react';
import Renderer from 'react-test-renderer';
import { PremiumInput, PremiumSelect, ConsoleButton } from '../src/ui';
import api from '../src/services/api';
import ManageAdmins from '../src/screens/admin/super/ManageAdminsScreen';

jest.mock('@react-navigation/native', () => {
  const ReactLib = require('react');
  return { useFocusEffect: (callback: () => any) => ReactLib.useEffect(callback, [callback]) };
});
jest.mock('../src/screens/admin/super/useSuperAdminBack', () => ({ useSuperAdminBack: () => jest.fn() }));
jest.mock('../src/screens/admin/shared/TierMenu', () => ({ MenuButton: () => null }));
jest.mock('../src/hooks/useRegionCascade', () => {
  const ReactLib = require('react');
  return { useRegionCascade: () => {
    const [state, setState] = ReactLib.useState('');
    const [district, setDistrict] = ReactLib.useState('');
    const [block, setBlock] = ReactLib.useState('');
    return { state, district, block, setState, setDistrict, setBlock, error: '',
      states: [{ name: 'Tamil Nadu' }], districts: [{ name: 'Chennai' }], blocks: [{ name: 'Guindy' }] };
  } };
});
jest.mock('../src/services/superApi', () => ({
  listStaffAccounts: jest.fn(async () => [{ id: 'staff-fixture', role: 'cms_admin', roleLabel: 'CMS Administrator', fullName: 'Content desk', email: 'content@example.test', active: true }]),
  updateStaffAccount: jest.fn(), errorText: (error: any) => error.message
}));
jest.mock('../src/services/api', () => ({ __esModule: true, default: { get: jest.fn() } }));

const get = api.get as jest.Mock;
const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
let screen: Renderer.ReactTestRenderer;
const settle = async () => { await Renderer.act(async () => { await pause(20); }); };
const chooseTab = async (label: string) => {
  const node = screen.root.findAll(node => node.props.accessibilityRole === 'radio' &&
    String(node.props.accessibilityLabel || '').startsWith(label + ',') && typeof node.props.onPress === 'function')[0];
  expect(node).toBeDefined();
  await Renderer.act(async () => node.props.onPress());
  await settle();
};

beforeEach(async () => {
  get.mockReset().mockImplementation(async (_url: string, options: any) => {
    const params = options?.params || {};
    const total = params.q || params.state ? 1 : 75;
    const page = Math.min(params.page || 1, Math.ceil(total / 25));
    return { data: { data: {
      admins: Array.from({ length: Math.min(25, total) }, (_, i) => ({ id: String((page - 1) * 25 + i),
        role: 'block_admin', fullName: `Regional ${String((page - 1) * 25 + i).padStart(3, '0')}`,
        email: `fixture-${i}@example.test`, active: true, state: 'Tamil Nadu', district: 'Chennai', block: 'Guindy', coAdmins: 0 })),
      counts: { all: params.state ? 1 : 75, block_admin: params.state ? 1 : 75, state_admin: 0, district_admin: 0 }, total,
      pagination: { page, limit: 25, total, pages: Math.ceil(total / 25) }
    } } };
  });
  await Renderer.act(async () => { screen = Renderer.create(<ManageAdmins route={{ params: {} }} />); });
  await settle();
});
afterEach(async () => { await Renderer.act(async () => screen?.unmount()); });

test('loads one bounded page on focus, supports the next page and resets after region filtering', async () => {
  await Renderer.act(async () => { await pause(450); });
  expect(get).toHaveBeenCalledTimes(1);
  expect(get.mock.calls[0][1].params).toMatchObject({ page: 1, limit: 25, kind: 'regional' });
  const next = screen.root.findAllByType(ConsoleButton).find(node => node.props.label === 'Next');
  await Renderer.act(async () => next!.props.onPress());
  await settle();
  expect(get.mock.calls.at(-1)?.[1].params.page).toBe(2);
  const state = screen.root.findAllByType(PremiumSelect).find(node => node.props.label === 'State');
  expect(state?.props.strong).toBe(true);
  await Renderer.act(async () => state!.props.onChange('Tamil Nadu'));
  await settle();
  expect(get.mock.calls.at(-1)?.[1].params).toMatchObject({ page: 1, state: 'Tamil Nadu' });
});

test('Staff tab displays the staff editor immediately without requesting thousands of regional accounts', async () => {
  const initialCalls = get.mock.calls.length;
  await chooseTab('Staff');
  expect(get).toHaveBeenCalledTimes(initialCalls);
  expect(screen.root.findAll(node => node.props.children === 'Content desk').length).toBeGreaterThan(0);
  expect(screen.root.findAllByType(PremiumSelect).filter(node => ['State', 'District', 'Block'].includes(node.props.label))).toHaveLength(0);
  const search = screen.root.findAllByType(PremiumInput).find(node => node.props.label === 'Search admins');
  await Renderer.act(async () => search!.props.onChangeText('Content'));
  await Renderer.act(async () => { await pause(450); });
  expect(get).toHaveBeenCalledTimes(initialCalls);
  expect(screen.root.findAll(node => node.props.children === 'Content desk').length).toBeGreaterThan(0);
});

test('search is debounced, resets pagination and sends the full query to the server', async () => {
  const search = screen.root.findAllByType(PremiumInput).find(node => node.props.label === 'Search admins');
  const initialCalls = get.mock.calls.length;
  await Renderer.act(async () => { search!.props.onChangeText('Reg'); search!.props.onChangeText('Regional 074'); });
  expect(get).toHaveBeenCalledTimes(initialCalls);
  await Renderer.act(async () => { await pause(450); });
  expect(get.mock.calls.at(-1)?.[1].params).toMatchObject({ page: 1, q: 'Regional 074' });
});
