/**
 * Smoke tests for the premium admin console (Block · District · State · Super):
 * every screen mounts, resolves its data and renders without throwing — with a
 * full data set, and with every call failing (null-safety). A few presses walk
 * the drill-downs and open the inline reject form (never a native Modal).
 *
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, View, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { AppThemeProvider, DARK_PALETTE, THEME_STORAGE_KEY } from '../src/ui/AppTheme';
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

const REVIEWS = {
  block: { decision: 'approved', adminType: 'BlockAdmin', decidedAt: '2026-09-02T00:00:00.000Z', auto: false },
  district: { decision: 'pending' },
  state: { decision: 'pending' },
};
const APPLICANT = {
  id: '6ab00d7f8b1d16637b4c7a1b', applicationId: '6ab00d7f8b1d16637b4c7a1b', fullName: 'Asha Devi', email: 'asha@example.com',
  phone: '9876543210', role: 'member', memberType: 'business', block: 'Ariyalur', district: 'Ariyalur', state: 'Tamil Nadu',
  status: 'Pending', stage: 'pending', statusLabel: 'Pending', canAct: true, decidesOutcome: false,
  endorsementLine: 'Block approved', tierReviews: REVIEWS, submittedAt: '2026-09-01T00:00:00.000Z', profilePhoto: '/uploads/a.jpg',
};
const DECIDED = { ...APPLICANT, id: 'x2', applicationId: 'x2', fullName: 'Ravi', stage: 'rejected', statusLabel: 'Rejected', canAct: false, rejectionReason: 'Duplicate' };
const BUCKETS = { pending: [APPLICANT], approved: [], rejected: [DECIDED], all: [APPLICANT, DECIDED] };
const MEMBERS = {
  rows: [
    { id: 'm1', applicationId: 'a1', name: 'Active One', status: 'active', expiresAt: '2027-06-01T00:00:00.000Z', daysLeft: 240, kind: 'business', kindLabel: 'Business', reminders: true },
    { id: 'm2', applicationId: 'a2', name: 'Soon Two', status: 'active', expiringSoon: true, daysLeft: 5, kind: 'aspirant', kindLabel: 'Aspirant' },
    { id: 'm3', applicationId: 'a3', name: 'Lapsed Three', status: 'expired', expiresAt: '2026-01-01T00:00:00.000Z', daysLeft: -30, blocked: true },
    { id: 'm4', applicationId: 'a4', name: 'Unpaid Four', status: 'awaiting_payment' },
    { id: 'm5', applicationId: 'a5', name: 'Life Five', status: 'active', lifetime: true, platinum: true },
  ],
  counts: { active: 3, expiring: 1, expired: 1, awaiting: 1, all: 5 },
  summary: { active: 3, expiringSoon: 1, expired: 1, awaitingPayment: 1, platinum: 1, renewedThisMonth: 2 },
  canManageReminders: true,
};
const REGION = { id: 'Ariyalur', name: 'Ariyalur', state: 'Tamil Nadu', district: 'Ariyalur', block: 'Ariyalur', applications: 2, pending: 1, approved: 0, rejected: 1, admins: 1 };

const mockByUrl = (url: string): any => {
  if (/\/admin\/(block|district|state)\/dashboard/.test(url)) {
    return { stats: { pendingApplications: 1, approvedApplications: 0, rejectedApplications: 1, totalApplications: 2, blockName: 'Ariyalur', districtName: 'Ariyalur', stateName: 'Tamil Nadu' }, applicants: BUCKETS, members: [] };
  }
  if (url.includes('/admin/profile')) return { fullName: 'Ariyalur Block Admin', email: 'a@activ.org.in', phoneNumber: '', state: 'Tamil Nadu', district: 'Ariyalur', block: 'Ariyalur' };
  if (url.includes('/admin/members')) return MEMBERS;
  if (url.includes('/admin/team/directory')) return { regions: [REGION, { ...REGION, id: 'Sendurai', name: 'Sendurai', admins: 0 }] };
  if (url.includes('/admin/team/applications')) return { applicants: [APPLICANT, DECIDED] };
  if (url.includes('/admin/super/overview')) {
    return {
      stats: { totalMembers: 14, totalApplications: 14, pendingApplications: 11, approvedApplications: 3, rejectedApplications: 0, totalAdmins: 710 },
      tierStats: { block: { total: 14, pending: 11, approved: 3, rejected: 0 }, district: { total: 14, pending: 11, approved: 3, rejected: 0 }, state: { total: 14, pending: 11, approved: 3, rejected: 0 } },
      bottlenecks: [APPLICANT], bottleneckAfterDays: 3,
      coverageGaps: [{ id: 'g1', region: 'Sendurai, Ariyalur', missingTierLabel: 'Block', escalatedToLabel: 'District', pending: 2 }],
    };
  }
  if (url.includes('/admin/super/directory')) return { summary: { states: 3, districts: 69, blocks: 636 }, regions: [REGION] };
  if (url.includes('/admin/super/applications')) return { applicants: [APPLICANT, DECIDED], pagination: { pages: 1 } };
  if (url.includes('/admin/super/admins/regions')) return { states: ['Tamil Nadu'], referenceStates: ['Kerala'] };
  if (url.includes('/admin/super/admins')) {
    return {
      admins: [
        { id: 'ad1', fullName: 'Block One', email: 'b1@activ.org.in', role: 'block_admin', roleLabel: 'Block Admin', state: 'Tamil Nadu', district: 'Ariyalur', block: 'Ariyalur', active: true, coAdmins: 1, lastLoginAt: '2026-09-20T00:00:00.000Z' },
        { id: 'ad2', fullName: 'State One', email: 's1@activ.org.in', role: 'state_admin', roleLabel: 'State Admin', state: 'Tamil Nadu', active: false },
      ],
      counts: { all: 2, block_admin: 1, district_admin: 0, state_admin: 1 },
    };
  }
  if (url.includes('/audit/counts')) return { all: 2, application: 1, admin: 1, event: 0 };
  if (url.includes('/audit')) {
    return {
      entries: [
        { id: 'e1', action: 'application.approved', summary: 'Approved Asha', actorName: 'Super', actorRoleLabel: 'Super Admin', createdAt: '2026-09-29T10:00:00.000Z' },
        { id: 'e2', action: 'admin.created', summary: 'Created an admin', actorName: 'Super', proxy: true, createdAt: '2026-09-28T10:00:00.000Z' },
      ],
      pagination: { page: 1, pages: 2, total: 2 },
    };
  }
  if (url.includes('/applications/')) {
    return {
      _id: APPLICANT.id, fullName: 'Asha Devi', email: 'asha@example.com', status: 'Pending', reviews: REVIEWS,
      documents: [{ name: 'Udyam.pdf', url: '/uploads/u.pdf', type: 'application/pdf', uploadedAt: '2026-09-01T00:00:00.000Z' }],
      data: { personalDetails: { gender: 'Female', city: 'Ariyalur' }, businessInfo: { doingBusiness: true, organizationName: 'Asha Stores' }, financialInfo: { panNumber: 'ABCDE1234F' } },
      createdAt: '2026-09-01T00:00:00.000Z',
    };
  }
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
  return {
    __esModule: true,
    default: inst,
    STORAGE_KEYS: { AUTH_TOKEN: 't', USER_DATA: 'u', USER_ROLE: 'r' },
    getUserData: jest.fn(() => Promise.resolve({ fullName: 'Admin', email: 'a@activ.org.in' })),
    setUserData: jest.fn(() => Promise.resolve()),
  };
});

const nav = () => ({
  navigate: jest.fn(), goBack: jest.fn(), reset: jest.fn(), replace: jest.fn(), canGoBack: () => true,
  setOptions: jest.fn(), addListener: jest.fn(() => () => {}), getParent: () => undefined,
});

const flush = () => new Promise<void>((r) => { setTimeout(() => r(), 0); });

const Block = () => require('../src/screens/admin/block/context/BlockAdminContext').BlockAdminProvider;
const District = () => require('../src/screens/admin/district/context/DistrictAdminContext').DistrictAdminProvider;
const State = () => require('../src/screens/admin/state/context/StateAdminContext').StateAdminProvider;
const Super = () => require('../src/screens/admin/super/context/SuperAdminContext').SuperAdminProvider;

const screens: [string, () => React.ComponentType<any>, () => React.ComponentType<any>, any][] = [
  ['Block dashboard', () => require('../src/screens/admin/block/BlockDashboardScreen').default, Block, {}],
  ['Block approvals', () => require('../src/screens/admin/block/BlockApprovalsScreen').default, Block, {}],
  ['Block members', () => require('../src/screens/admin/block/BlockMembersScreen').default, Block, {}],
  ['Block settings', () => require('../src/screens/admin/block/BlockSettingsScreen').default, Block, {}],
  ['District dashboard', () => require('../src/screens/admin/district/DistrictDashboardScreen').default, District, {}],
  ['District approvals', () => require('../src/screens/admin/district/DistrictApprovalsScreen').default, District, {}],
  ['District hub', () => require('../src/screens/admin/district/DistrictHubScreen').default, District, {}],
  ['District settings', () => require('../src/screens/admin/district/DistrictSettingsScreen').default, District, {}],
  ['State dashboard', () => require('../src/screens/admin/state/StateDashboardScreen').default, State, {}],
  ['State members', () => require('../src/screens/admin/state/StateMembersScreen').default, State, {}],
  ['State hub', () => require('../src/screens/admin/state/StateHubScreen').default, State, {}],
  ['State settings', () => require('../src/screens/admin/state/StateSettingsScreen').default, State, {}],
  ['Super hub', () => require('../src/screens/admin/super/SuperAdminActionHubScreen').default, Super, {}],
  ['Super admins', () => require('../src/screens/admin/super/ManageAdminsScreen').default, Super, { params: {} }],
  ['Super settings', () => require('../src/screens/admin/super/SystemScreen').default, Super, {}],
  ['Super more', () => require('../src/screens/admin/super/SuperMenuScreen').default, Super, {}],
  ['Super approvals', () => require('../src/screens/admin/super/SuperApprovalsScreen').default, Super, {}],
  ['Super members', () => require('../src/screens/admin/super/SuperMembersScreen').default, Super, {}],
  ['Applicant dossier', () => require('../src/screens/admin/ApplicantDetailScreen').default, () => React.Fragment, { params: { applicant: APPLICANT } }],
];

test.each(screens.filter(([name]) => /dashboard|Super hub/.test(name)))('%s uses neutral dark surfaces and switches back immediately', async (_name, load, provider, route) => {
  mockFailAll = false;
  await AsyncStorage.setItem(THEME_STORAGE_KEY, 'light');
  const Screen = load(), Provider = provider();
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  try {
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<AppThemeProvider><Provider><Screen navigation={nav()} route={route} /></Provider></AppThemeProvider>);
      await flush(); await flush();
    });
    const choose = async (value: 'light' | 'dark') => {
      const button = tree?.root.findAll(node => node.props.accessibilityLabel === `Use ${value} appearance` && typeof node.props.onPress === 'function')[0];
      expect(button).toBeDefined();
      await ReactTestRenderer.act(async () => { button?.props.onPress(); await flush(); });
    };
    await choose('dark');
    const fills = tree?.root.findAllByType(View).map(node => StyleSheet.flatten(node.props.style)?.backgroundColor) || [];
    expect(fills).toContain(DARK_PALETTE.canvasAdmin);
    expect(fills).toContain(DARK_PALETTE.card);
    expect(tree?.root.findAllByType(LinearGradient).some(node => node.props.colors?.[0] === '#111214')).toBe(true);
    const bodyText = tree?.root.findAllByType(Text).filter(node => StyleSheet.flatten(node.props.style)?.color === DARK_PALETTE.text) || [];
    expect(bodyText.length).toBeGreaterThan(0);
    await choose('light');
    expect(tree?.root.findAllByType(View).some(node => StyleSheet.flatten(node.props.style)?.backgroundColor === '#FAFAFA')).toBe(true);
  } finally { await ReactTestRenderer.act(async () => tree?.unmount()); }
}, 30000);

/** Press the first node carrying this accessibility label and an onPress. */
const press = async (tree: any, label: string) => {
  const hit = tree.root.findAll((n: any) => n.props?.accessibilityLabel === label && typeof n.props?.onPress === 'function')[0];
  if (!hit) return false;
  await ReactTestRenderer.act(async () => { hit.props.onPress(); await flush(); await flush(); });
  return true;
};

describe.each([false, true])('premium admin screens (api failing: %s)', (failing) => {
  beforeAll(() => { mockFailAll = failing; });
  test.each(screens)('%s renders', async (_name, load, provider, route) => {
    const Screen = load();
    const Provider = provider();
    let tree: any;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<Provider><Screen navigation={nav()} route={route} /></Provider>);
      await flush();
      await flush();
    });
    expect(tree.toJSON()).toBeTruthy();
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });
});

describe('premium admin interactions', () => {
  beforeAll(() => { mockFailAll = false; });

  test('approval queue opens the inline reject form', async () => {
    const Provider = Block();
    const Screen = require('../src/screens/admin/block/BlockApprovalsScreen').default;
    let tree: any;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<Provider><Screen navigation={nav()} /></Provider>);
      await flush(); await flush();
    });
    expect(await press(tree, 'Reject')).toBe(true);
    expect(tree.root.findAll((n: any) => n.props?.label === 'Reason for rejection').length).toBeGreaterThan(0);
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });

  test('district hub drills level → region → applications', async () => {
    const Provider = District();
    const Screen = require('../src/screens/admin/district/DistrictHubScreen').default;
    let tree: any;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<Provider><Screen navigation={nav()} /></Provider>);
      await flush(); await flush();
    });
    expect(await press(tree, 'Blocks: 2')).toBe(true);
    expect(await press(tree, 'Ariyalur, 1 pending')).toBe(true);
    expect(tree.root.findAll((n: any) => n.props?.accessibilityLabel === 'Asha Devi').length).toBeGreaterThan(0);
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });

  test('members card expands with its actions', async () => {
    const Provider = State();
    const Screen = require('../src/screens/admin/state/StateMembersScreen').default;
    let tree: any;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<Provider><Screen navigation={nav()} /></Provider>);
      await flush(); await flush();
    });
    expect(await press(tree, 'Active One, Active')).toBe(true);
    expect(tree.root.findAll((n: any) => n.props?.accessibilityLabel === 'View application').length).toBeGreaterThan(0);
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });

  test('tier menu drawer opens', async () => {
    const { TierMenuProvider, TierMenuDrawer, MenuButton } = require('../src/screens/admin/shared/TierMenu');
    let tree: any;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <TierMenuProvider>
          <MenuButton />
          <TierMenuDrawer tier="district" adminName="D Admin" roleTitle="District Admin" region="Ariyalur" rootNavigation={nav()} stackRoute="DistrictDashboard" />
        </TierMenuProvider>,
      );
    });
    expect(await press(tree, 'Open menu')).toBe(true);
    expect(tree.root.findAll((n: any) => n.props?.accessibilityLabel === 'Hub, Every block of your district').length).toBeGreaterThan(0);
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });

  test('the four admin tab navigators mount', async () => {
    const { NavigationContainer } = require('@react-navigation/native');
    for (const path of ['BlockAdminBottomTabs', 'DistrictAdminBottomTabs', 'StateAdminBottomTabs', 'SuperAdminBottomTabs']) {
      const Tabs = require(`../src/navigation/${path}`).default;
      let tree: any;
      await ReactTestRenderer.act(async () => {
        tree = ReactTestRenderer.create(<NavigationContainer><Tabs navigation={nav()} /></NavigationContainer>);
        await flush(); await flush();
      });
      expect(tree.toJSON()).toBeTruthy();
      await ReactTestRenderer.act(async () => { tree.unmount(); });
    }
  });
});
