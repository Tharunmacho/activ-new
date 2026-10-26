/**
 * Smoke tests for the premium business area: every screen mounts, resolves
 * its data and renders without throwing — with a full data set, and with
 * every call failing (null-safety). Plus the round trip the business area
 * exists for: create a company → add a product → it appears in Discover →
 * trust it → analytics reads it.
 *
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

/* ---- navigation: focus effects run like mount effects ---------------------- */
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const ReactLib = require('react');
  return {
    ...actual,
    useFocusEffect: (cb: () => any) => ReactLib.useEffect(() => cb(), [cb]),
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), reset: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
    useRoute: () => ({ params: { companyId: 'c1' } }),
  };
});

/* ---- the api: canned answers by URL, or everything failing ------------------ */
let mockFailAll = false;
let mockTrustedBy: number | null = 2;
const COMPANY = {
  _id: 'c1', businessName: 'Sri Lakshmi Engineering', businessType: 'Manufacturing', mobileNumber: '9876543210',
  email: 'hello@slengg.in', area: 'Guindy', location: 'Chennai', logo: '/uploads/logo.png', banner: '/uploads/banner.jpg',
  status: 'active', isActive: true, description: 'Precision parts.', constitutionType: 'Private Limited',
  numberOfEmployees: '25', productCategories: [{ code: '2599', description: 'Fabricated metal products', industryType: 'Manufacturing' }],
  govtRegistrations: ['MSME / Udyam'], govtSchemes: ['None'], createdAt: '2026-01-01T00:00:00.000Z',
};
const OTHER = {
  _id: 'c2', businessName: 'Kaveri Traders', businessType: 'Trader', mobileNumber: '9123456780', location: 'Madurai',
  trustedBy: 3, ownerIsMember: true, note: 'Pays on time',
  products: [{ _id: 'p9', name: 'Steel chairs', price: 1800, stock: 40, category: 'Furniture' }],
  matchedProducts: [{ _id: 'p9', name: 'Steel chairs', price: 1800, stock: 40, category: 'Furniture' }],
};
const PRODUCT = {
  _id: 'p1', name: 'CNC bracket', price: 450, stock: 3, minStock: 5, category: 'Hardware', sku: 'BR-1',
  isActive: true, isFeatured: false, views: 12, companyId: 'c1', imageUrl: '/uploads/p1.jpg',
};
const mockByUrl = (url: string): any => {
  if (url.includes('/members/my-profile')) return { fullName: 'Tharun', state: 'Tamil Nadu', district: 'Chennai', block: 'Guindy', membershipStatus: 'active', renewal: { state: 'active' } };
  if (url.includes('/auth/me')) return { details: { fullName: 'Tharun Kumar' }, email: 't@example.com', phoneNumber: '9876543210' };
  if (url.includes('/regions/geography')) return ['Tamil Nadu', 'Kerala'];
  if (url.includes('/business-profiles/trust-list/ids')) return ['c2'];
  if (url.includes('/business-profiles/trust-list')) return [OTHER];
  if (url.includes('/business-profiles/discover')) return [OTHER, COMPANY];
  if (url.includes('/business-profiles/public/')) return { ...COMPANY, products: [PRODUCT], trustedBy: 2, isTrusted: false, isOwner: false };
  if (url.includes('/business-profiles/all')) return [COMPANY, { ...COMPANY, _id: 'c3', businessName: 'SL Exports', logo: '' }];
  if (url.includes('/business-profiles/me')) return null;
  if (url.includes('/business-profiles')) return COMPANY;
  if (url.includes('/products/discover')) return [{ ...OTHER.products[0], companyId: { _id: 'c2', businessName: 'Kaveri Traders' } }];
  if (url.includes('/products/stats')) return { total: 3, active: 2, featured: 1, views: 40, trustedBy: mockTrustedBy, topViewed: [{ name: 'CNC bracket', views: 30 }, { name: 'Flange', views: 10 }] };
  if (url.includes('/products/activities')) return [{ productId: 'p1', label: 'Product created', description: 'CNC bracket', time: '2026-09-29T10:00:00.000Z' }];
  if (url.includes('/products/stock-movements')) return [{ id: 'm1', productId: 'p1', productName: 'CNC bracket', delta: 5, reason: 'restock', at: '2026-09-29T10:00:00.000Z' }, { id: 'm2', productId: 'zz', productName: 'Other company item', delta: -1, reason: 'sale' }];
  if (url.includes('/products/p1')) return PRODUCT;
  if (url.includes('/products')) return [PRODUCT, { ...PRODUCT, _id: 'p2', name: 'Flange', stock: 0, isActive: false }];
  return {};
};
const mockCalls: { method: string; url: string; body: any }[] = [];
jest.mock('../src/services/api', () => {
  const respond = (method: string, url: string, body?: any) => {
    mockCalls.push({ method, url: String(url || ''), body });
    return mockFailAll
      ? Promise.reject(Object.assign(new Error('offline'), { response: undefined }))
      : Promise.resolve({ data: { success: true, data: mockByUrl(String(url || '')) } });
  };
  const inst = {
    get: jest.fn((url: string) => respond('get', url)),
    post: jest.fn((url: string, body?: any) => respond('post', url, body)),
    put: jest.fn((url: string, body?: any) => respond('put', url, body)),
    patch: jest.fn((url: string, body?: any) => respond('patch', url, body)),
    delete: jest.fn((url: string) => respond('delete', url)),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  };
  return {
    __esModule: true,
    default: inst,
    getUserData: jest.fn(() => Promise.resolve({ fullName: 'Tharun' })),
    STORAGE_KEYS: { AUTH_TOKEN: 't', USER_DATA: 'u', USER_ROLE: 'r' },
  };
});

const nav = () => ({
  navigate: jest.fn(), goBack: jest.fn(), reset: jest.fn(), replace: jest.fn(), canGoBack: () => true,
  setOptions: jest.fn(), addListener: jest.fn(() => () => {}),
});

const screens: [string, () => React.ComponentType<any>, any][] = [
  ['Business dashboard', () => require('../src/screens/business/BusinessDashboardScreen').default, {}],
  ['Manage companies', () => require('../src/screens/business/ManageCompaniesScreen').default, {}],
  ['View company', () => require('../src/screens/business/ViewCompanyScreen').default, { params: { companyId: 'c1' } }],
  ['Company public page', () => require('../src/screens/business/CompanyPublicScreen').default, { params: { companyId: 'c1' } }],
  ['Business profile (first company)', () => require('../src/screens/business/BusinessProfileScreen').default, {}],
  ['Business profile view (legacy)', () => require('../src/screens/business/BusinessProfileViewScreen').default, { params: { companyId: 'c1' } }],
  ['Add company', () => require('../src/screens/business/AddCompanyScreen').default, {}],
  ['Edit company', () => require('../src/screens/business/EditCompanyScreen').default, { params: { companyId: 'c1' } }],
  ['Edit company (no id)', () => require('../src/screens/business/EditCompanyScreen').default, { params: {} }],
  ['Products & services', () => require('../src/screens/business/ProductsServicesScreen').default, { params: { companyId: 'c1' } }],
  ['Add product', () => require('../src/screens/business/AddProductScreen').default, { params: { companyId: 'c1' } }],
  ['Edit product', () => require('../src/screens/business/EditProductScreen').default, { params: { productId: 'p1' } }],
  ['Stock centre', () => require('../src/screens/business/StockCentreScreen').default, { params: { productId: 'p1' } }],
  ['Discover', () => require('../src/screens/business/DiscoverScreen').default, {}],
  ['Trust list', () => require('../src/screens/business/TrustListScreen').default, {}],
  ['Analytics', () => require('../src/screens/business/AnalyticsScreen').default, {}],
  ['Settings', () => require('../src/screens/business/SettingsScreen').default, {}],
];

const flush = () => new Promise<void>((r) => { setTimeout(() => r(), 0); });

async function mount(Screen: React.ComponentType<any>, route: any) {
  let tree: any;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<Screen navigation={nav()} route={route} />);
    await flush();
    await flush();
    await flush();
  });
  return tree;
}

describe.each([false, true])('premium business screens (api failing: %s)', (failing) => {
  beforeAll(() => { mockFailAll = failing; });
  test.each(screens)('%s renders', async (_name, load, route) => {
    const tree = await mount(load(), route);
    expect(tree.toJSON()).toBeTruthy();
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });
});

/** Every Text string in a rendered tree, joined — for "is it on screen". */
const textOf = (tree: any) => {
  const out: string[] = [];
  const walk = (n: any) => {
    if (!n) return;
    if (typeof n === 'string') { out.push(n); return; }
    if (Array.isArray(n)) { n.forEach(walk); return; }
    (n.children || []).forEach(walk);
  };
  walk(tree.toJSON());
  return out.join(' ');
};

describe('business owner trust count', () => {
  beforeEach(() => { mockFailAll = false; });
  afterEach(() => { mockTrustedBy = 2; });
  test.each([0, 1, 8, null])('dashboard shows the server count %s', async (count) => {
    mockTrustedBy = count;
    const Screen = require('../src/screens/business/BusinessDashboardScreen').default;
    const tree = await mount(Screen, {});
    const expected = count === null ? 'Count unavailable' : `${count} ${count === 1 ? 'member' : 'members'}`;
    expect(textOf(tree)).toContain(`Trusted by ${expected}`);
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });
  test('company details do not turn an unavailable count into zero', async () => {
    mockTrustedBy = null;
    const Screen = require('../src/screens/business/ViewCompanyScreen').default;
    const tree = await mount(Screen, { params: { companyId: 'c1' } });
    expect(textOf(tree)).toContain('Trusted by Count unavailable');
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });
  test('refresh follows a company switched while the profile request is pending', async () => {
    const api = require('../src/services/api').default;
    const { useActiveCompanyStore } = require('../src/stores/activeCompanyStore');
    const { BrandScrollPage } = require('../src/ui');
    const Screen = require('../src/screens/business/BusinessDashboardScreen').default;
    const tree = await mount(Screen, {});
    await ReactTestRenderer.act(async () => { useActiveCompanyStore.getState().setActiveCompany('c1'); await flush(); });
    const originalGet = api.get.getMockImplementation();
    let release: (() => void) | undefined;
    api.get.mockImplementation((url: string, options: any) => {
      if (url.includes('/auth/me')) return new Promise(resolve => {
        release = () => resolve({ data: { data: { fullName: 'Tharun' } } });
      });
      return originalGet(url, options);
    });
    let refreshing: Promise<void> | undefined;
    try {
      await ReactTestRenderer.act(async () => {
        refreshing = tree.root.findByType(BrandScrollPage).props.onRefresh();
        await flush(); await flush();
      });
      expect(release).toBeDefined();
      await ReactTestRenderer.act(async () => {
        useActiveCompanyStore.getState().setActiveCompany('c3');
        await flush();
      });
      await ReactTestRenderer.act(async () => { release?.(); await refreshing; await flush(); });
      const requests = api.get.mock.calls.filter((call: any[]) => call[0].includes('/products/stats'));
      expect(requests.at(-1)?.[1]?.params.companyId).toBe('c3');
      expect(textOf(tree)).toContain('SL Exports');
    } finally {
      api.get.mockImplementation(originalGet);
      await ReactTestRenderer.act(async () => { tree.unmount(); });
    }
  });
});

describe('the business round trip', () => {
  beforeAll(() => { mockFailAll = false; });

  const input = (tree: any, label: string) =>
    tree.root.findAll((n: any) => n.props?.accessibilityLabel === label && typeof n.props?.onChangeText === 'function')[0];
  const button = (tree: any, label: string) =>
    tree.root.findAll((n: any) => n.props?.accessibilityLabel === label && typeof n.props?.onPress === 'function')[0];

  test('the company form posts the company', async () => {
    mockCalls.length = 0;
    const CompanyForm = require('../src/screens/business/companyForm/CompanyForm').default;
    const onSaved = jest.fn();
    const tree = await mount(() => (
      <CompanyForm title="Add new company" createLabel="Create company" onBack={jest.fn()} onSaved={onSaved} />
    ), {});
    await ReactTestRenderer.act(async () => {
      input(tree, 'Business name').props.onChangeText('Sri Lakshmi Engineering');
      input(tree, 'Mobile number').props.onChangeText('9840212857');
      input(tree, 'City / location').props.onChangeText('Chennai');
    });
    await ReactTestRenderer.act(async () => { button(tree, 'Manufacturing').props.onPress(); });
    expect(textOf(tree)).toContain('Sri Lakshmi Engineering');
    // The stepper moves between sections and keeps what was typed.
    await ReactTestRenderer.act(async () => { button(tree, 'Next section').props.onPress(); });
    expect(textOf(tree)).toContain('Business details');
    await ReactTestRenderer.act(async () => { button(tree, 'Next section').props.onPress(); });
    expect(textOf(tree)).toContain('Financial information');
    await ReactTestRenderer.act(async () => { button(tree, 'Next section').props.onPress(); });
    expect(textOf(tree)).toContain('Government registrations');
    await ReactTestRenderer.act(async () => { button(tree, 'Create company').props.onPress(); await flush(); await flush(); });
    const post = mockCalls.find((c) => c.method === 'post' && c.url === '/business-profiles');
    expect(post?.body).toMatchObject({ businessName: 'Sri Lakshmi Engineering', businessType: 'Manufacturing', mobileNumber: '9840212857', location: 'Chennai' });
    expect(onSaved).toHaveBeenCalled();
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });

  test('a product added under the active company carries its companyId', async () => {
    mockCalls.length = 0;
    const AddProduct = require('../src/screens/business/AddProductScreen').default;
    const tree = await mount(AddProduct, { params: { companyId: 'c1' } });
    const name = tree.root.findAll((n: any) => n.props?.accessibilityLabel === 'Product / service name' && typeof n.props?.onChangeText === 'function')[0];
    const price = tree.root.findAll((n: any) => n.props?.accessibilityLabel === 'Price (₹)' && typeof n.props?.onChangeText === 'function')[0];
    await ReactTestRenderer.act(async () => { name.props.onChangeText('CNC bracket'); price.props.onChangeText('450'); });
    const publish = tree.root.findAll((n: any) => n.props?.accessibilityLabel === 'Publish product' && typeof n.props?.onPress === 'function')[0];
    await ReactTestRenderer.act(async () => { publish.props.onPress(); await flush(); });
    const post = mockCalls.find((c) => c.method === 'post' && c.url === '/products');
    expect(post).toBeTruthy();
    const parts: any[] = (post?.body as any)?._parts || [];
    if (parts.length) {
      expect(parts).toEqual(expect.arrayContaining([['companyId', 'c1'], ['name', 'CNC bracket'], ['price', '450']]));
    }
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });

  test('Discover lists the other company and trusting it posts to the trust list', async () => {
    mockCalls.length = 0;
    const Discover = require('../src/screens/business/DiscoverScreen').default;
    const tree = await mount(Discover, {});
    expect(textOf(tree)).toContain('Kaveri Traders');
    expect(mockCalls.some((c) => c.url.includes('/business-profiles/discover'))).toBe(true);
    // Kaveri starts trusted (trust-list/ids) — the card's trust action removes it.
    const untrust = button(tree, 'Trusted — remove from your trust list');
    expect(untrust).toBeTruthy();
    await ReactTestRenderer.act(async () => { untrust.props.onPress(); await flush(); });
    expect(mockCalls.some((c) => c.method === 'delete' && c.url.includes('/business-profiles/trust-list/c2'))).toBe(true);
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });

  test('the trust list writes a private note through the same endpoint', async () => {
    mockCalls.length = 0;
    const svc = require('../src/services/businessApi');
    await svc.addToTrustList('c2', 'Pays on time');
    const call = mockCalls.find((c) => c.method === 'post' && c.url.includes('/business-profiles/trust-list/c2'));
    expect(call?.body).toEqual({ note: 'Pays on time' });
  });

  test('analytics reads the company figures', async () => {
    mockCalls.length = 0;
    const Analytics = require('../src/screens/business/AnalyticsScreen').default;
    const tree = await mount(Analytics, {});
    expect(mockCalls.some((c) => c.url.includes('/products/stats'))).toBe(true);
    expect(textOf(tree)).toContain('CNC bracket');
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });
});
