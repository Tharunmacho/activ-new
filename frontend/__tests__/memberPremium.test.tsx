/**
 * Smoke tests for the premium member screens (dashboards, menu, application
 * forms, application status, recovery / social sign-in, the website viewer):
 * each one mounts, resolves its data and renders without throwing — with a
 * full data set, and with every call failing (null-safety).
 *
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { StyleSheet, Text, TextInput } from 'react-native';
import { AppThemeProvider, DARK_PALETTE } from '../src/ui/AppTheme';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* ---- navigation: focus effects run like mount effects ---------------------- */
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const ReactLib = require('react');
  return {
    ...actual,
    useFocusEffect: (cb: () => any) => ReactLib.useEffect(() => cb(), [cb]),
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), reset: jest.fn(), canGoBack: () => true }),
  };
});

/* ---- the api: canned answers by URL, or everything failing ------------------ */
let mockFailAll = false;
let mockPaid = false;
let mockWebsiteEmpty = false;
const MOCK_PROFILE = {
  fullName: 'Tharun Kumar', email: 'm@example.com', phoneNumber: '9876543210', state: 'Tamil Nadu', district: 'Chennai',
  block: 'Guindy', city: 'Chennai', membershipStatus: 'active', membershipNumber: 'ACTIV-2026-001',
  membershipType: 'annual', membershipActivatedAt: '2026-01-10T00:00:00.000Z', renewal: { canRenew: false },
};
const MOCK_APPLICATION = {
  _id: '6ab00d7f8b1d16637b4c7a1b', status: 'Pending-District', createdAt: '2026-09-01T00:00:00.000Z',
  block: 'Guindy', district: 'Chennai', state: 'Tamil Nadu', registrationType: 'business',
  tierReviews: { block: { status: 'approved', at: '2026-09-02T00:00:00.000Z', by: 'Block Admin' } },
};
const mockByUrl = (url: string): any => {
  if (mockWebsiteEmpty && /\/cms\/(news|gallery|events)/.test(url)) return [];
  if (url.includes('/members/my-profile')) return { ...MOCK_PROFILE, membershipStatus: mockPaid ? 'active' : 'pending' };
  if (url.includes('/applications/my-applications')) return [MOCK_APPLICATION];
  if (url.includes('/members/recent-activity')) return { activities: [{ id: 'a1', description: 'Profile updated', at: '2026-09-20T00:00:00.000Z', type: 'profile' }] };
  if (url.includes('/cms/site')) return { header: { navLinks: [{ label: 'Home', href: '/' }, { label: 'About', href: '/about' }, { label: 'Login', href: '/login' }] } };
  if (url.includes('/cms/legal/links')) return [{ label: 'Privacy Policy', href: '/privacy-policy' }];
  if (url.includes('/cms/regions/map')) return { regions: [{ slug: 'south', label: 'South', states: [{ name: 'Kerala', slug: 'kerala' }] }] };
  if (url.includes('/cms/news')) return [{ slug: 'n1', title: 'News one', status: 'published', publishedAt: '2026-09-18T00:00:00.000Z', image: { url: '/uploads/a.jpg' } }, { slug: 'draft', title: 'Draft', status: 'draft' }];
  if (url.includes('/cms/gallery')) return [{ _id: 'g1', slug: 'g1', title: 'Photo', media: { url: '/uploads/b.jpg', type: 'image' } }];
  if (url.includes('/cms/events')) return [{ id: 'e1', slug: 'public-meet', title: 'Meet', status: 'published', startAt: '2099-01-01T10:00:00.000Z', mode: 'online' }];
  if (/^\/events\/(e1|m1)$/.test(url)) return { id: url.split('/').at(-1), title: 'Bookable event', status: 'published', startAt: '2099-01-01T10:00:00.000Z', registrationEnabled: true, yourPrice: 0, registrationFee: 0, capacity: 100, showQrOnPage: false };
  if (/^\/event-bookings\/event\/(e1|m1)$/.test(url)) return { id: url.split('/').at(-1), title: 'Bookable event', startAt: '2099-01-01T10:00:00.000Z', amount: 0, capacity: 100, seatsLeft: 90, seatsTaken: 10, maxPerBooking: 5 };
  if (url.includes('/events')) return { events: mockWebsiteEmpty ? [] : [{ id: 'm1', title: 'Members meet', startAt: '2099-02-01T10:00:00.000Z', venue: 'Hall', district: 'Chennai' }] };
  if (url.includes('/announcements')) return { announcements: [{ id: 'u1', title: 'Update', pinned: true }] };
  if (url.includes('/cms/contact-info')) return { email: 'info@activ.org.in', phone: '+91 82201 12188', workingHours: ['Mon–Fri 10–6'] };
  return {};
};
jest.mock('../src/services/api', () => {
  const respond = (url: string) => (mockFailAll
    ? Promise.reject(Object.assign(new Error('offline'), { response: undefined }))
    : Promise.resolve({ data: { success: true, data: mockByUrl(String(url || '')) } }));
  const inst = {
    get: jest.fn((url: string) => respond(url)),
    post: jest.fn((url: string) => respond(url)),
    put: jest.fn((url: string) => respond(url)),
    delete: jest.fn((url: string) => respond(url)),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  };
  return { __esModule: true, default: inst, getAuthToken: jest.fn().mockResolvedValue('member-token'), getUserRole: jest.fn().mockResolvedValue('member'), STORAGE_KEYS: { AUTH_TOKEN: 't', USER_DATA: 'u', USER_ROLE: 'r' } };
});

jest.mock('../src/services/publicContent', () => ({
  ...jest.requireActual('../src/services/publicContent'),
  getPublicContactInfo: jest.fn(() => mockFailAll ? Promise.reject(new Error('offline')) : Promise.resolve(mockByUrl('/cms/contact-info'))),
  readPublicCms: jest.fn((path: string) => mockFailAll ? Promise.reject(new Error('offline')) : Promise.resolve(mockByUrl(path))),
}));

const nav = () => ({
  navigate: jest.fn(), goBack: jest.fn(), reset: jest.fn(), replace: jest.fn(), canGoBack: () => true,
  setOptions: jest.fn(), addListener: jest.fn(() => () => {}),
});

const screens: [string, () => React.ComponentType<any>, any][] = [
  ['Unpaid dashboard', () => require('../src/screens/member/dashboard/DashboardScreen').default, {}],
  ['Paid dashboard', () => require('../src/screens/member/paidDashboard/PaidDashboardScreen').default, {}],
  ['Member menu', () => require('../src/screens/member/MemberMenuScreen').default, {}],
  ['Personal details', () => require('../src/screens/profile/PersonalDetailsFormScreen').default, { params: {} }],
  ['Business information', () => require('../src/screens/profile/BusinessInformationFormScreen').default, { params: {} }],
  ['Declaration', () => require('../src/screens/profile/DeclarationFormScreen').default, { params: {} }],
  ['Financial', () => require('../src/screens/profile/FinancialComplianceFormScreen').default, { params: {} }],
  ['Application submitted', () => require('../src/screens/application/ApplicationSubmittedScreen').default, {}],
  ['Application status', () => require('../src/screens/application/ApplicationStatusScreen').default, {}],
  ['Forgot password', () => require('../src/screens/auth/ForgotPasswordScreen').default, { params: { portal: 'admin' } }],
  ['Reset password', () => require('../src/screens/auth/ResetPasswordScreen').default, { params: {} }],
  ['Social sign-in (no account)', () => require('../src/screens/auth/SocialSignInScreen').default, { params: { error: 'no_account', provider: 'google', email: 'a@b.c' } }],
  ['Social sign-in (error)', () => require('../src/screens/auth/SocialSignInScreen').default, { params: { error: 'cancelled' } }],
  ['Welcome', () => require('../src/screens/auth/WelcomeScreen').default, {}],
  ['Website viewer', () => require('../src/screens/member/website/WebsiteViewerScreen').default, { params: { path: '/news', title: 'News' } }],
];

const flush = () => new Promise<void>((r) => { setTimeout(() => r(), 0); });
const mountedScreens = new Set<ReactTestRenderer.ReactTestRenderer>();
const renderScreen = (element: React.ReactElement) => {
  const tree = ReactTestRenderer.create(element);
  mountedScreens.add(tree);
  return tree;
};
const unmountScreen = async (tree?: ReactTestRenderer.ReactTestRenderer) => {
  if (!tree || !mountedScreens.delete(tree)) return;
  await ReactTestRenderer.act(async () => { tree.unmount(); });
};

test('paid dashboard updates and event headings follow the sun/moon choice without remounting', async () => {
  mockPaid = true; mockFailAll = false; mockWebsiteEmpty = false;
  await AsyncStorage.clear();
  const Dashboard = require('../src/screens/member/paidDashboard/PaidDashboardScreen').default;
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    tree = renderScreen(<AppThemeProvider><Dashboard navigation={nav()} /></AppThemeProvider>);
    await flush(); await flush();
  });
  const label = (value: string) => tree?.root.findAllByType(Text).find(node => node.props.children === value);
  const originalUpdate = label('Update');
  expect(originalUpdate).toBeDefined();
  const select = async (value: 'dark' | 'light') => {
    const control = tree?.root.findAll(node => node.props.accessibilityLabel === `Use ${value} appearance` && typeof node.props.onPress === 'function')[0];
    await ReactTestRenderer.act(async () => { control?.props.onPress(); await flush(); });
  };
  await select('dark');
  expect(label('Update')).toBe(originalUpdate);
  expect(StyleSheet.flatten(label('Update')?.props.style)?.color).toBe(DARK_PALETTE.text);
  expect(StyleSheet.flatten(label('Members meet')?.props.style)?.color).toBe(DARK_PALETTE.text);
  expect(StyleSheet.flatten(label('UPDATE')?.props.style)?.color).toBe(DARK_PALETTE.textSoft);
  await select('light');
  expect(StyleSheet.flatten(label('Update')?.props.style)?.color).toBe('#0F172A');
  await unmountScreen(tree);
}, 30000);
// Assertion failures must still run focus-effect and event-clock cleanup.
afterEach(async () => {
  for (const tree of mountedScreens) await unmountScreen(tree);
  mockWebsiteEmpty = false;
});

describe.each([false, true])('premium member screens (api failing: %s)', (failing) => {
  beforeAll(() => { mockFailAll = failing; });
  test.each(screens)('%s renders', async (name, load, route) => {
    mockPaid = name === 'Paid dashboard';
    const Screen = load();
    let tree: any;
    await ReactTestRenderer.act(async () => {
      tree = renderScreen(<Screen navigation={nav()} route={route} />);
      await flush();
      await flush();
    });
    expect(tree.toJSON()).toBeTruthy();
    await unmountScreen(tree);
  });
});

test('Member locked card renders', async () => {
  const MemberLocked = require('../src/screens/member/MemberLocked').default;
  let tree: any;
  await ReactTestRenderer.act(async () => {
    tree = renderScreen(
      <MemberLocked feature="Directory" onActivate={jest.fn()} benefits={[{ icon: 'chat', title: 'Message', detail: 'Reach members', open: true }]} />,
    );
  });
  expect(tree.toJSON()).toBeTruthy();
});

test('website content keeps only published news and public pages', async () => {
  mockFailAll = false;
  const svc = require('../src/services/websiteContent');
  svc.invalidateWebsiteContent();
  const news = await svc.getLatestNews(3, true);
  expect(news.map((n: any) => n.title)).toEqual(['News one']);
  const nav = await svc.getSiteNav(true);
  expect(nav.map((l: any) => l.path)).toEqual(['/', '/about']);
  const zones = await svc.getZones(true);
  expect(zones[0].states[0].slug).toBe('kerala');
});

test('member policy links include the public deletion request form even when it is absent from CMS policies', async () => {
  mockFailAll = false;
  const svc = require('../src/services/websiteContent');
  svc.invalidateWebsiteContent();
  const links = await svc.getLegalLinks(true);
  expect(links.map((link: any) => link.path)).toContain('/privacy-policy');
  expect(links.filter((link: any) => link.path === '/delete-account')).toEqual([{ label: 'Delete account', path: '/delete-account' }]);
  svc.invalidateWebsiteContent();
  mockFailAll = true;
  expect(await svc.getLegalLinks(true)).toContainEqual({ label: 'Delete account', path: '/delete-account' });
  mockFailAll = false;
});


describe.each([[false, false], [false, true], [true, false], [true, true]])('dashboard content order (paid: %s, empty: %s)', (paid, empty) => {
  test('keeps events, actions, gallery and news visible and refreshable', async () => {
    mockPaid = paid; mockFailAll = false; mockWebsiteEmpty = empty;
    require('../src/services/websiteContent').invalidateWebsiteContent();
    const Screen = paid ? require('../src/screens/member/paidDashboard/PaidDashboardScreen').default : require('../src/screens/member/dashboard/DashboardScreen').default;
    const navigation = nav();
    let tree: any;
    await ReactTestRenderer.act(async () => {
      tree = renderScreen(<Screen navigation={navigation} route={{}} />);
      await flush(); await flush();
    });
    const expected = ['upcoming events', ...(paid ? ['association updates'] : []), 'quick actions', 'from the gallery', 'latest news', 'schemes', 'activ near you', 'my documents', 'contact us'];
    const headings = () => tree.root.findAllByType(Text).filter((node: any) => !['Schemes', 'Contact us'].includes(node.props.children) || node.props.accessibilityRole === 'header')
      .map((node: any) => String(node.props.children).toLowerCase())
      .filter((label: string) => expected.includes(label));
    expect(headings()).toEqual(expected);
    for (const [title, path] of [['About ACTIV', '/about'], ['Membership', '/membership'], ['Schemes', '/schemes'], ['Contact us', '/contact'], ['Zones & States', '/zones']]) {
      const destination = tree.root.findAll((node: any) => (node.props.accessibilityLabel === title || String(node.props.accessibilityLabel).startsWith(title + '.')) && typeof node.props.onPress === 'function')[0];
      expect(destination).toBeTruthy();
      await ReactTestRenderer.act(async () => destination.props.onPress());
      expect(navigation.navigate).toHaveBeenLastCalledWith(['/schemes', '/zones'].includes(path) ? 'PublicContent' : 'PublicInfo', { path, title });
    }
    const refresh = tree.root.findAll((node: any) => typeof node.props.onRefresh === 'function')[0].props.onRefresh;
    await ReactTestRenderer.act(async () => { await refresh(); await flush(); await flush(); });
    expect(headings()).toEqual(expected);
    const allEvents = tree.root.findAll((node: any) => node.props.accessibilityLabel === (paid ? 'See all: Upcoming Events' : 'All events') && typeof node.props.onPress === 'function')[0];
    expect(allEvents).toBeTruthy();
    await ReactTestRenderer.act(async () => allEvents.props.onPress());
    expect(navigation.navigate).toHaveBeenLastCalledWith('MemberEvents');
    const documents = tree.root.findAll((node: any) => node.props.accessibilityLabel === (paid ? 'View all: My Documents' : 'View documents') && typeof node.props.onPress === 'function')[0];
    await ReactTestRenderer.act(async () => { documents.props.onPress(); });
    expect(navigation.navigate).toHaveBeenCalledWith('MemberDocuments');
    if (paid) {
      const labels = tree.root.findAllByType(Text).map((node: any) => String(node.props.children));
      for (const label of ['Events booked', 'Unread messages', 'New alerts']) {
        expect(labels.filter((text: string) => text === label)).toHaveLength(1);
        expect(labels.indexOf(label)).toBeLessThan(labels.indexOf('Upcoming Events'));
      }
      const { PremiumCard, GradientButton, SPACE, PALETTE } = require('../src/ui');
      const upgrade = tree.root.findAllByType(PremiumCard).find((card: any) => card.findAllByType(Text).some((n: any) => n.props.children === 'Upgrade your membership'));
      expect(StyleSheet.flatten(upgrade.props.style).marginHorizontal).toBe(SPACE.lg);
      const title = upgrade.findAllByType(Text).find((n: any) => n.props.children === 'Upgrade your membership');
      expect(StyleSheet.flatten(title.props.style).color).not.toBe(PALETTE.white);
      await ReactTestRenderer.act(async () => { upgrade.findByType(GradientButton).props.onPress(); });
      expect(navigation.navigate).toHaveBeenCalledWith('MembershipPlans', { upgrade: true });
    }
    await unmountScreen(tree);
    mockWebsiteEmpty = false;
  });
});

test.each([false, true])('upcoming event opens native details and the booking form (paid: %s)', async paid => {
  mockPaid = paid; mockFailAll = false; mockWebsiteEmpty = false;
  require('../src/services/websiteContent').invalidateWebsiteContent();
  const Dashboard = paid ? require('../src/screens/member/paidDashboard/PaidDashboardScreen').default : require('../src/screens/member/dashboard/DashboardScreen').default;
  const Detail = require('../src/screens/member/events/MemberEventDetailScreen').default;
  const Booking = require('../src/screens/member/events/EventBookingScreen').default;
  const navigation = nav(), id = paid ? 'm1' : 'e1';
  let tree: any;
  try {
    await ReactTestRenderer.act(async () => { tree = renderScreen(<Dashboard navigation={navigation} />); await flush(); await flush(); });
    const card = tree.root.findAll((node: any) => typeof node.props.onPress === 'function'
      && String(node.props.accessibilityLabel || '').startsWith(paid ? 'Members meet,' : 'Meet.'))[0];
    expect(card).toBeTruthy();
    await ReactTestRenderer.act(async () => card.props.onPress());
    expect(navigation.navigate).toHaveBeenLastCalledWith('MemberEventDetail', { id });
    await ReactTestRenderer.act(async () => { tree.update(<Detail navigation={navigation} route={{ params: { id } }} />); await flush(); await flush(); });
    const book = tree.root.findAll((node: any) => node.props.accessibilityLabel === 'Book Now' && typeof node.props.onPress === 'function')[0];
    expect(book).toBeTruthy();
    await ReactTestRenderer.act(async () => book.props.onPress());
    expect(navigation.navigate).toHaveBeenLastCalledWith('EventBooking', { eventId: id });
    await ReactTestRenderer.act(async () => { tree.update(<Booking navigation={navigation} route={{ params: { eventId: id } }} />); await flush(); await flush(); });
    expect(tree.root.findAllByType(TextInput).some((node: any) => node.props.value === MOCK_PROFILE.fullName)).toBe(true);
    expect(tree.root.findAll((node: any) => node.props.accessibilityLabel === 'Review booking')).not.toHaveLength(0);
    expect(navigation.navigate.mock.calls.some(([name]: [string]) => name === 'WebsiteViewer')).toBe(false);
  } finally { await unmountScreen(tree); }
});

test('paid membership card shows the last valid day before the anniversary', async () => {
  mockPaid = true; mockFailAll = false;
  const Screen = require('../src/screens/member/paidDashboard/PaidDashboardScreen').default;
  const { MembershipCard3D } = require('../src/screens/member/dashboard/DashboardPremium');
  let tree: any;
  try {
    await ReactTestRenderer.act(async () => { tree = renderScreen(<Screen navigation={nav()} />); await flush(); await flush(); });
    expect(tree.root.findByType(MembershipCard3D).props.validValue).toBe('9 Jan 2027');
  } finally { await unmountScreen(tree); }
});

test('paid dashboard displays the server progression without changing validity', async () => {
  mockPaid = true; mockFailAll = false;
  (MOCK_PROFILE as any).currentMembership = { planId: 'intermediate', planName: 'Intermediate', kind: 'business', message: 'Congratulations! Your membership has advanced to Intermediate. The new fee applies at renewal.' };
  const Screen = require('../src/screens/member/paidDashboard/PaidDashboardScreen').default;
  const { MembershipCard3D } = require('../src/screens/member/dashboard/DashboardPremium');
  let tree: any;
  try {
    await ReactTestRenderer.act(async () => { tree = renderScreen(<Screen navigation={nav()} />); await flush(); await flush(); });
    expect(tree.root.findByType(MembershipCard3D).props.planTitle).toBe('Intermediate');
    expect(tree.root.findByType(MembershipCard3D).props.validValue).toBe('9 Jan 2027');
    expect(tree.root.findAllByType(Text).some((node: any) => String(node.props.children).includes('Congratulations!'))).toBe(true);
  } finally { delete (MOCK_PROFILE as any).currentMembership; await unmountScreen(tree); }
});

test('unpaid documents expose application records while certificates remain locked', async () => {
  mockPaid = false; mockFailAll = false;
  const Screen = require('../src/screens/member/documents/MemberDocumentsScreen').default;
  let tree: any;
  await ReactTestRenderer.act(async () => { tree = renderScreen(<Screen navigation={nav()} />); await flush(); await flush(); });
  const labels = tree.root.findAll((n: any) => typeof n.props.accessibilityLabel === 'string').map((n: any) => n.props.accessibilityLabel);
  for (const name of ['Membership Certificate', 'Tax Exemption Certificate', 'Payment Receipt']) {
    expect(labels).toContain(`${name}, locked until your membership is active`);
    expect(labels).not.toContain(`Open ${name}`);
  }
  await unmountScreen(tree);
});
