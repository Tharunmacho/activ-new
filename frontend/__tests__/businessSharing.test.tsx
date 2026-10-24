import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Share } from 'react-native';
import { companyShareContent, productShareContent } from '../src/services/businessShareContent';
import { PublicShareButton } from '../src/components/PublicShareButton';
import CompanyPublicScreen from '../src/screens/business/CompanyPublicScreen';
import ManageCompaniesScreen from '../src/screens/business/ManageCompaniesScreen';
import ProductsServicesScreen from '../src/screens/business/ProductsServicesScreen';
import TrustListScreen from '../src/screens/business/TrustListScreen';
import DiscoverScreen from '../src/screens/business/DiscoverScreen';
import ViewCompanyScreen from '../src/screens/business/ViewCompanyScreen';
import SettingsScreen from '../src/screens/business/SettingsScreen';
import api from '../src/services/api';
import { recordProductView } from '../src/services/memberApi';

let mockCompany: any, mockProducts: any[], mockStore: any;
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
  useRoute: () => ({ params: {} }),
}));
jest.mock('../src/stores/activeCompanyStore', () => ({
  useActiveCompany: () => mockCompany,
  useActiveCompanyStore: (selector: (state: any) => any) => selector(mockStore),
}));
jest.mock('../src/services/businessApi', () => ({
  getPublicCompany: jest.fn(async () => mockCompany),
  getCompany: jest.fn(async () => mockCompany),
  getProductStats: jest.fn(async () => ({})),
  getTrustList: jest.fn(async () => [mockCompany]),
  getTrustListIds: jest.fn(async () => []),
  getMyCompanies: jest.fn(async () => []),
  addToTrustList: jest.fn(), removeFromTrustList: jest.fn(),
  errorMessage: jest.fn(() => 'Unable to load'),
}));
jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(async (path: string) => ({ data: { data: path === '/business-profiles/discover' ? [mockCompany] : mockProducts } })) },
}));
jest.mock('../src/services/memberApi', () => ({
  getMyProfile: jest.fn(async () => ({})), recordProductView: jest.fn(),
}));
jest.mock('../src/services/regions', () => ({ getGeography: jest.fn(async () => []) }));
jest.mock('../src/screens/business/MembershipGate', () => ({ useMembershipPaid: () => true }));
jest.mock('../src/stores/exampleStore', () => ({ useAuthStore: () => ({ logout: jest.fn() }) }));

const publicCompany = { _id: '1234567890abcdef12345678', businessName: 'Public Tools', isActive: true, status: 'active' };
const product = { _id: 'product-one', name: 'Workbench', isActive: true, companyId: '1234567890abcdef12345678' };
const navigation = { navigate: jest.fn(), goBack: jest.fn() };
let tree: Renderer.ReactTestRenderer | undefined;
let share: jest.SpyInstance;
beforeEach(() => {
  mockProducts = [{ ...product, sku: 'PRIVATE-SKU', stock: 47, price: 9999 }];
  mockCompany = { ...publicCompany, products: mockProducts, note: 'PRIVATE-TRUST-NOTE', gstin: 'PRIVATE-TAX-ID', email: 'private@example.test', mobileNumber: '9999999999' };
  mockStore = { companies: [mockCompany], activeCompanyId: mockCompany._id, setActiveCompany: jest.fn(), loadCompanies: jest.fn(async () => [mockCompany]) };
  (api.get as jest.Mock).mockImplementation(async (path: string) => ({ data: { data: path === '/business-profiles/discover' ? [mockCompany] : mockProducts } }));
  share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  jest.clearAllMocks();
});
afterEach(async () => {
  if (tree) await act(async () => tree?.unmount());
  tree = undefined;
  share.mockRestore();
});

test('company and product payloads contain only public names and the canonical company route', () => {
  expect(companyShareContent(mockCompany)).toEqual({ path: '/network/company/1234567890abcdef12345678', title: 'Public Tools' });
  expect(productShareContent(mockProducts[0], mockCompany)).toEqual({ path: '/network/company/1234567890abcdef12345678', title: 'Workbench at Public Tools' });
  expect(companyShareContent({ _id: 'company/encoded', isActive: true, status: 'active' })).toBeNull();
});

test.each([
  { ...publicCompany, isActive: false },
  { ...publicCompany, publication: { published: false } },
  { ...publicCompany, status: 'pending' },
  { _id: '1234567890abcdef12345678', businessName: 'Unknown publication' },
  { ...publicCompany, _id: '' },
])('owner records need positive publication evidence: %j', company => {
  expect(companyShareContent(company)).toBeNull();
  expect(productShareContent(product, company)).toBeNull();
});

test('public owner previews still need active publication; filtered public records may omit publication fields', () => {
  expect(companyShareContent({ ...publicCompany, isOwner: true, status: 'inactive' }, 'public')).toBeNull();
  expect(companyShareContent({ _id: '1234567890abcdef12345678', businessName: 'Public Tools' }, 'public')).not.toBeNull();
});

test('hidden, unpublished and mismatched products cannot share another company catalogue', () => {
  expect(productShareContent({ ...product, isActive: false }, publicCompany)).toBeNull();
  expect(productShareContent({ ...product, isActive: undefined }, publicCompany)).toBeNull();
  expect(productShareContent({ ...product, companyId: { _id: 'another-company' } }, publicCompany, 'public')).toBeNull();
  expect(productShareContent({ _id: 'public-product', name: 'Public item' }, publicCompany, 'public')).not.toBeNull();
});

const mount = async (Screen: any) => act(async () => {
  tree = Renderer.create(<Screen navigation={navigation} route={{ params: { companyId: '1234567890abcdef12345678' } }} />);
});
const buttons = () => tree!.root.findAllByType(PublicShareButton);
const pressShare = async (title: string) => {
  const control = buttons().find(button => button.props.title === title);
  expect(control).toBeDefined();
  // An accessible card parent combines its descendants into one screen-reader
  // target. Share must be a sibling of navigation/edit actions, not their child.
  let ancestor = control!.parent;
  while (ancestor) {
    expect(ancestor.props.accessible).not.toBe(true);
    expect(typeof ancestor.props.onPress).not.toBe('function');
    expect(ancestor.props.accessibilityElementsHidden).not.toBe(true);
    expect(ancestor.props.importantForAccessibility).not.toBe('no-hide-descendants');
    ancestor = ancestor.parent;
  }
  const button = tree!.root.findAll(node => node.props.accessibilityLabel === `Share ${title}` && typeof node.props.onPress === 'function')[0];
  expect(button).toBeDefined();
  const stopPropagation = jest.fn();
  await act(async () => button.props.onPress({ stopPropagation }));
  expect(stopPropagation).toHaveBeenCalledTimes(1);
  const payload = JSON.stringify(share.mock.calls.at(-1)?.[0]);
  expect(payload).toContain('https://activ.org.in/network/company/1234567890abcdef12345678');
  expect(payload).not.toMatch(/PRIVATE|private@example|9999999999|9999|stock|sku|gstin/i);
};

test('company public detail has one compact header share and no product-card sharing', async () => {
  await mount(CompanyPublicScreen);
  expect(buttons().map(button => button.props.title)).toEqual(['Public Tools']);
  expect(buttons()[0].props.compact).toBe(true);
  await pressShare('Public Tools');
});

test('unpublished owner previews show neither company nor product sharing', async () => {
  mockCompany.isOwner = true;
  mockCompany.status = 'inactive';
  await mount(CompanyPublicScreen);
  expect(buttons()).toHaveLength(0);
});

test('owner company detail preserves the compact public share action', async () => {
  await mount(ViewCompanyScreen);
  expect(buttons()).toHaveLength(1);
  expect(buttons()[0].props.compact).toBe(true);
  await pressShare('Public Tools');
});

test('Manage Companies has no share controls on company cards', async () => {
  await mount(ManageCompaniesScreen);
  expect(buttons()).toHaveLength(0);
  expect(share).not.toHaveBeenCalled();
});

test('owner catalogue has no header or product-card sharing and still opens the editor', async () => {
  mockProducts.push({ ...product, _id: 'draft-product', name: 'Secret prototype', isActive: false });
  await mount(ProductsServicesScreen);
  expect(buttons()).toHaveLength(0);
  expect(share).not.toHaveBeenCalled();
  expect(navigation.navigate).not.toHaveBeenCalled();
  const edit = tree!.root.findAll(node => node.props.accessibilityLabel === 'Edit Workbench' && typeof node.props.onPress === 'function')[0];
  await act(async () => edit.props.onPress());
  expect(navigation.navigate).toHaveBeenCalledWith('EditProduct', { productId: 'product-one' });
});

test('catalogue sharing remains absent after the active company changes and requests finish', async () => {
  let resolveOld: (value: any) => void = () => {};
  const oldResponse = new Promise(resolve => { resolveOld = resolve; });
  (api.get as jest.Mock).mockImplementation((_path, config) => config?.params?.companyId === '1234567890abcdef12345678'
    ? oldResponse : Promise.resolve({ data: { data: [] } }));
  await mount(ProductsServicesScreen);
  mockCompany = { ...publicCompany, _id: 'abcdef1234567890abcdef12', businessName: 'Second Company' };
  await act(async () => tree!.update(<ProductsServicesScreen navigation={navigation as any} />));
  await act(async () => resolveOld({ data: { data: [{ _id: 'old-product', name: 'Old private prototype', isActive: true }] } }));
  expect(buttons()).toHaveLength(0);
  expect(share).not.toHaveBeenCalled();
});

test('Trust List cards have no share and still open company details', async () => {
  await mount(TrustListScreen);
  expect(buttons()).toHaveLength(0);
  const open = tree!.root.findAll(node => node.props.accessibilityLabel === 'Open Public Tools' && typeof node.props.onPress === 'function')[0];
  await act(async () => open.props.onPress());
  expect(navigation.navigate).toHaveBeenCalledWith('CompanyPublic', { companyId: '1234567890abcdef12345678' });
  expect(share).not.toHaveBeenCalled();
});

test('Discover cards have no company or product share and retain product view tracking', async () => {
  await mount(DiscoverScreen);
  expect(buttons()).toHaveLength(0);
  expect(share).not.toHaveBeenCalled();
  expect(navigation.navigate).not.toHaveBeenCalled();
  expect(recordProductView).not.toHaveBeenCalled();
  const productAction = tree!.root.findAll(node => node.props.accessibilityLabel === 'Workbench' && typeof node.props.onPress === 'function')[0];
  await act(async () => productAction.props.onPress());
  expect(recordProductView).toHaveBeenCalledWith('product-one');
});

test('Discover list has no sharing and still opens company details', async () => {
  await mount(DiscoverScreen);
  const listMode = tree!.root.findAll(node => node.props.accessibilityLabel === 'List view' && typeof node.props.onPress === 'function')[0];
  await act(async () => listMode.props.onPress());
  expect(buttons()).toHaveLength(0);
  expect(share).not.toHaveBeenCalled();
  expect(navigation.navigate).not.toHaveBeenCalled();
  const open = tree!.root.findAll(node => node.props.accessibilityLabel === 'Open Public Tools' && typeof node.props.onPress === 'function')[0];
  await act(async () => open.props.onPress());
  expect(navigation.navigate).toHaveBeenCalledWith('CompanyPublic', { companyId: '1234567890abcdef12345678' });
});

test('business settings directs to the public detail page without a separate share row', async () => {
  await mount(SettingsScreen);
  expect(buttons()).toHaveLength(0);
  expect(tree!.root.findAll(node => node.props.title === 'Share company profile')).toHaveLength(0);
  const row = tree!.root.findAll(node => node.props.title === 'View public page' && typeof node.props.onPress === 'function')[0];
  await act(async () => row.props.onPress());
  expect(navigation.navigate).toHaveBeenCalledWith('CompanyPublic', { companyId: '1234567890abcdef12345678' });
  expect(share).not.toHaveBeenCalled();
});
