import React from 'react';
import Renderer from 'react-test-renderer';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppThemeProvider, useAppTheme, THEME_STORAGE_KEY } from '../src/ui/AppTheme';
import type { AppTheme } from '../src/ui/AppTheme';
import { PALETTE } from '../src/ui/tokens';
import CompanyForm from '../src/screens/business/companyForm/CompanyForm';
import { CategoryPicker, ChipChoice } from '../src/screens/business/companyForm/controls';
import { PhotoWell, SoftAction, ToolTile } from '../src/screens/business/businessKit';
import ProductsServicesScreen from '../src/screens/business/ProductsServicesScreen';
import CompanyPublicScreen from '../src/screens/business/CompanyPublicScreen';
import api from '../src/services/api';
import { businessPhotoItems } from '../src/utils/businessPhotos';

jest.setTimeout(30000);

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useFocusEffect: (cb: () => any) => require('react').useEffect(cb, [cb]),
    useRoute: () => ({ params: { companyId: 'company-1' } }),
  };
});
jest.mock('../src/stores/activeCompanyStore', () => {
  const company = { _id: 'company-1', businessName: 'Test company' };
  const store = { loadCompanies: jest.fn(), setActiveCompany: jest.fn() };
  return { useActiveCompany: () => company, useActiveCompanyStore: (selector: any) => selector(store) };
});
jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(async () => ({ data: { data: [
      { _id: 'in', name: 'In stock item', price: 100, stock: 12, minStock: 2, companyId: 'company-1' },
      { _id: 'low', name: 'Low stock item', price: 200, stock: 1, minStock: 2, companyId: 'company-1' },
      { _id: 'out', name: 'Empty item', price: 300, stock: 0, minStock: 2, companyId: 'company-1' },
    ] } })),
    post: jest.fn(), put: jest.fn(), delete: jest.fn(),
  },
}));

let screen: Renderer.ReactTestRenderer | undefined;
let theme: AppTheme;
function CaptureTheme() { theme = useAppTheme(); return null; }
const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));
async function mount(children: React.ReactNode) {
  await Renderer.act(async () => {
    screen = Renderer.create(<AppThemeProvider><CaptureTheme />{children}</AppThemeProvider>);
    await flush();
  });
}
async function appearance(value: 'light' | 'dark') {
  await Renderer.act(async () => { theme.setPreference(value); await flush(); });
}
const input = (label: string) => screen!.root.findAllByType(TextInput).find(node => node.props.accessibilityLabel === label)!;
const button = (label: string) => screen!.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
const text = (value: string) => screen!.root.findAllByType(Text).find(node => node.props.children === value)!;
const color = (node: Renderer.ReactTestInstance) => StyleSheet.flatten(node.props.style)?.color;
function ancestorFill(node: Renderer.ReactTestInstance): string | undefined {
  for (let parent = node.parent; parent; parent = parent.parent) {
    const fill = StyleSheet.flatten(parent.props.style)?.backgroundColor;
    if (fill) return fill;
  }
  return undefined;
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.setItem(THEME_STORAGE_KEY, 'light');
});
afterEach(async () => {
  await Renderer.act(async () => screen?.unmount());
  screen = undefined;
});

test('company form changes appearance without remounting inputs or losing step and entered values', async () => {
  await mount(<CompanyForm title="Add company" onBack={jest.fn()} onSaved={jest.fn()} />);
  await Renderer.act(async () => {
    input('Business name').props.onChangeText('Acme workshop');
    input('Mobile number').props.onChangeText('9840212857');
  });
  const before = input('Business name');
  expect(color(before)).toBe(PALETTE.text);
  await appearance('dark');
  expect(input('Business name')).toBe(before);
  expect(input('Business name').props.value).toBe('Acme workshop');
  expect(input('Mobile number').props.value).toBe('9840212857');
  expect(color(input('Business name'))).toBe(theme.palette.text);
  expect(ancestorFill(input('Business name'))).toBe(theme.palette.fieldBg);
  expect(ancestorFill(text('Manufacturing'))).toBe(theme.palette.fieldBg);
  await Renderer.act(async () => button('Next section').props.onPress());
  expect(text('Business details')).toBeDefined();
  await appearance('light');
  expect(text('Business details')).toBeDefined();
  await Renderer.act(async () => button('Previous section').props.onPress());
  expect(input('Business name').props.value).toBe('Acme workshop');
  expect(color(input('Business name'))).toBe(PALETTE.text);
});

test('category search preserves local text and selection state while all picker surfaces change', async () => {
  const changed = jest.fn();
  await mount(<><CategoryPicker value={[]} onChange={changed} /><ChipChoice options={['Selected', 'Unselected']} value="Selected" onChange={jest.fn()} /></>);
  const search = () => screen!.root.findAllByType(TextInput).find(node => node.props.placeholder === 'Search a product, service or NIC code')!;
  await Renderer.act(async () => search().props.onChangeText('Precision consulting'));
  const original = search();
  await appearance('dark');
  expect(search()).toBe(original);
  expect(search().props.value).toBe('Precision consulting');
  expect(color(search())).toBe(theme.palette.text);
  expect(search().props.placeholderTextColor).toBe(theme.palette.textFaint);
  expect(ancestorFill(search())).toBe(theme.palette.fieldBg);
  expect(color(text('Selected'))).toBe(PALETTE.white);
  expect(color(text('Unselected'))).toBe(theme.palette.textSoft);
  expect(ancestorFill(text('Unselected'))).toBe(theme.palette.fieldBg);
  expect(button('Selected').props.accessibilityState.checked).toBe(true);
  expect(changed).not.toHaveBeenCalled();
});

test('business shortcuts and photo wells update readable surfaces while gradient action text stays white', async () => {
  await mount(<>
    <ToolTile icon="inventory" label="Catalogue" colors={['#8B5CF6', '#5B21B6']} onPress={jest.fn()} />
    <PhotoWell onPress={jest.fn()} />
    <SoftAction icon="delete" label="Delete item" danger onPress={jest.fn()} />
    <SoftAction icon="add" label="Add item" primary onPress={jest.fn()} />
  </>);
  expect(ancestorFill(text('Catalogue'))).toBe(PALETTE.card);
  await appearance('dark');
  expect(ancestorFill(text('Catalogue'))).toBe(theme.palette.card);
  expect(color(text('Catalogue'))).toBe(theme.palette.text);
  expect(color(text('Add a product photo'))).toBe(theme.palette.violetDark);
  expect(ancestorFill(text('Delete item'))).toBe(theme.palette.dangerSoft);
  expect(color(text('Delete item'))).toBe(theme.palette.redDark);
  expect(color(text('Add item'))).toBe(PALETTE.white);
  await appearance('light');
  expect(ancestorFill(text('Catalogue'))).toBe(PALETTE.card);
});

test('catalogue cards update stock status colours in place for available, low and empty stock', async () => {
  await mount(<ProductsServicesScreen navigation={{ navigate: jest.fn(), goBack: jest.fn() } as any} />);
  expect(text('In stock item')).toBeDefined();
  await appearance('dark');
  for (const [label, fg, bg] of [
    ['12 in stock', theme.palette.greenDark, theme.palette.greenSoft],
    ['1 left', theme.palette.amberDark, theme.palette.amberSoft],
    ['Out of stock', theme.palette.redDark, theme.palette.redSoft],
  ]) {
    expect(color(text(label))).toBe(fg);
    expect(ancestorFill(text(label))).toBe(bg);
  }
  expect(color(text('In stock item'))).toBe(theme.palette.text);
  expect(screen!.root.findAllByType(View).some(node => StyleSheet.flatten(node.props.style)?.backgroundColor === theme.palette.card)).toBe(true);
});

test('company photo album uses existing cover, logo and product images once and omits absent images', () => {
  const items = businessPhotoItems({ _id: 'c', banner: '/cover.jpg', logo: '/logo.jpg', products: [
    { _id: 'p', name: 'Lathe', imageUrl: '/lathe.jpg', images: ['/lathe.jpg', { url: '/detail.jpg' }, null], gallery: ['/detail.jpg', '/cover.jpg'] },
    { _id: 'no-image', name: 'Consulting' }, null,
  ] });
  expect(items.map(item => item._id)).toEqual(['company-cover:c', 'company-logo:c', 'p']);
  expect(items.map(item => item.images.length)).toEqual([1, 1, 2]);
  expect(items[0].showPrice).toBe(false);
  expect(items[1].showPrice).toBe(false);
  expect(items[2].name).toBe('Lathe');
  expect(businessPhotoItems(null)).toEqual([]);
  expect(businessPhotoItems({ products: 'invalid', banner: {} })).toEqual([]);
});

test('public company Photos opens cover/logo and product album with zoom without recording a cover as a product', async () => {
  (api.get as jest.Mock).mockResolvedValueOnce({ data: { data: {
    _id: 'company-1', businessName: 'Workshop', banner: '/cover.jpg', logo: '/logo.jpg',
    trustedBy: 2, products: [{ _id: 'lathe', name: 'Lathe', imageUrl: '/lathe.jpg', price: 500, stock: 3 }],
  } } });
  await mount(<CompanyPublicScreen navigation={{ navigate: jest.fn(), goBack: jest.fn() } as any} route={{ params: { companyId: 'company-1' } } as any} />);
  expect(text('Photos (3)')).toBeDefined();
  await Renderer.act(async () => button('Open photo: Company cover').props.onPress());
  expect(button('Enlarge Company cover, photo 1')).toBeDefined();
  expect(screen!.root.findAllByType(Text).some(node => node.props.children === '₹0')).toBe(false);
  expect(api.post).not.toHaveBeenCalled();
  await Renderer.act(async () => button('Next photo').props.onPress());
  expect(button('Enlarge Company logo, photo 1')).toBeDefined();
  expect(api.post).not.toHaveBeenCalled();
  await Renderer.act(async () => button('Next photo').props.onPress());
  expect(button('Enlarge Lathe, photo 1')).toBeDefined();
  expect(api.post).toHaveBeenCalledTimes(1);
  await appearance('dark');
  expect(text('3 / 3')).toBeDefined();
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(button('Close catalogue')).toBeDefined();
  await Renderer.act(async () => button('Close catalogue').props.onPress());
  expect(button('Close catalogue')).toBeUndefined();
  expect(text('Photos (3)')).toBeDefined();
});
