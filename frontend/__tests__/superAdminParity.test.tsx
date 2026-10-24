/**
 * Super Admin — full website parity (2026-09-30). Every screen registered in
 * navigation/routes/superRoutes.tsx mounts, resolves its data and renders
 * without throwing — with a full data set, and with every call failing
 * (null-safety). Plus: the Automation delivery view (filters, a message
 * expanding in place, the inline resend confirmation), the booking Messages
 * screen, the More menu reaching every section, and the five-tab navigator.
 *
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

/* ---- navigation: focus effects run like mount effects; params per test ---- */
let mockParams: any = {};
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const ReactLib = require('react');
  return {
    ...actual,
    useFocusEffect: (cb: () => any) => ReactLib.useEffect(() => cb(), [cb]),
    useNavigation: () => ({
      navigate: mockNavigate, goBack: jest.fn(), reset: jest.fn(), replace: mockReplace, setParams: jest.fn(),
      canGoBack: () => true, setOptions: jest.fn(), addListener: jest.fn(() => () => {}),
    }),
    useRoute: () => ({ key: 'k', name: 'Test', params: mockParams }),
  };
});

/* ---- the api: canned answers by URL, or everything failing ------------------ */
let mockFailAll = false;

const EVENT_ID = '6ab4ce651129156b1152db0e';
const BOOKING = {
  bookingRef: 'ACTIVB-MUNPL8RY-69C9', status: 'confirmed', noOfPersons: 2, totalAmount: 1000, memberRateApplied: true, memberSaving: 200,
  bookedBy: { name: 'Tharun V', email: 't@example.com', phone: '9092317264' },
  payment: { status: 'pending', mode: '' }, attendees: [{ name: 'Tharun V' }, { name: 'Guest' }], createdAt: '2026-09-30T06:06:42.584Z',
};
const LOG = {
  _id: 'log1', event: 'EVENT_BOOKING_CONFIRMED', channel: 'whatsapp', recipient: '9092317264', recipientName: 'Tharun V',
  status: 'failed', effectiveStatus: 'failed', failureReason: 'Recipient phone number not in allowed list', failureCode: 131030,
  bookingRef: BOOKING.bookingRef, eventId: EVENT_ID, eventTitle: 'Entrepreneurship Awareness Programme', provider: 'meta', attempts: 2,
  templatePath: 'event_reminder skipped: meeting_url not on the event | sent on "booking_notice"',
  statusHistory: [{ status: 'accepted', at: '2026-09-30T12:31:39.066Z' }, { status: 'failed', at: '2026-09-30T12:31:45.000Z', code: 131030, title: 'Not allowed' }],
  createdAt: '2026-09-30T12:31:39.069Z',
};
const LOG2 = { ...LOG, _id: 'log2', channel: 'email', recipient: 't@example.com', status: 'sent', effectiveStatus: 'accepted', failureReason: '', failureCode: undefined, statusHistory: [] };
const COUNTS = { total: 2, accepted: 1, sent: 0, delivered: 0, read: 0, failed: 1, mock: 0 };
const CMS_EVENT = {
  id: EVENT_ID, slug: 'eap', title: 'Entrepreneurship Awareness Programme', description: 'About', startAt: '2026-10-23T03:30:00.000Z',
  endAt: '2026-10-23T11:30:00.000Z', venue: 'Annamalai University', status: 'published', category: 'Awareness', mode: 'offline',
  media: { url: '', type: 'image', alt: '', fit: 'cover', position: 'center' }, targets: [{ state: 'Tamil Nadu', district: 'Cuddalore', block: '' }],
  reachEveryone: false, showOnOnboarding: true, channel: 'members', audience: 'all', registrationEnabled: true, capacity: 500,
  registrationFee: 0, agenda: [], days: [], speakers: [], attachments: [],
};
const PLAN = { id: 'p1', key: 'basic', name: 'Beginner', description: '', price: 10000, audience: 'business', membershipType: 'annual', minYears: 0, maxYears: 5, features: ['A'], popular: false, active: true, order: 1 };
const MEMBERSHIP_REPORT = { filename: 'membership-members.xlsx', base64: 'UEsDBAoAAAA=', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
const BOOKING_REPORT = { ...MEMBERSHIP_REPORT, filename: 'event-bookings.xlsx' };

const mockByUrl = (url: string): any => {
  if (url.endsWith('/membership/registrations/export')) return MEMBERSHIP_REPORT;
  if (url.endsWith('/membership/platinum/accounts')) return { id: 'm1', fullName: 'Office Member', email: 'office@example.com', blockedReason: 'Application not submitted', canAdmitManually: false };
  if (/\/membership\/registrations\/[^/]+/.test(url)) return { member: { id: 'm1', name: 'Office Member', email: 'office@example.com', phone: '9000000000', applicationStatus: 'Pending', status: 'pending', canConfirm: true, collected: 0 }, payments: [], confirmation: { kind: 'student', commencementYear: '', plans: [{ id: 'student', key: 'student', name: 'Student', price: 10, audience: 'student', commencementYears: [] }] } };
  if (url.includes('/membership/registrations')) return { rows: [{ id: 'm1', name: 'Office Member', email: 'office@example.com', status: 'pending', applicationStatus: 'Pending', collected: 0 }], payments: [], plans: [{ id: 'student', name: 'Student', price: 10 }], summary: { registered: 1, submitted: 1, active: 0, collected: 0, awaiting: 0, pendingReview: 1 } };
  if (url.includes('/notifications/logs/booking/')) {
    return { bookingRef: BOOKING.bookingRef, rows: [LOG, LOG2], summary: { email: { status: 'accepted' }, whatsapp: { status: 'failed', reason: 'Not allowed' } } };
  }
  if (url.includes('/notifications/delivery-summary')) {
    return { summaries: { [BOOKING.bookingRef]: { email: { status: 'accepted' }, whatsapp: { status: 'failed', reason: 'Not allowed' } } } };
  }
  if (url.includes('/notifications/logs')) {
    return {
      logs: [LOG, LOG2], health: { sent: 1, failed: 1, queued: 0, mock: 0, total: 2 },
      counts: { total: 2, delivery: COUNTS, byChannel: { email: { ...COUNTS, total: 1, failed: 0 }, whatsapp: { ...COUNTS, total: 1, accepted: 0 } } },
      events: [{ eventId: EVENT_ID, title: 'Entrepreneurship Awareness Programme', count: 2 }],
      pagination: { page: 1, limit: 25, total: 2, pages: 1 },
    };
  }
  if (url.includes('/notifications/delivery-status')) {
    return { email: { configured: true, host: 'smtp.example.com', user: 'u', from: 'ACTIV', regionalFrom: false, supportAddress: 's@a' }, whatsapp: { configured: false, baseUrl: 'x', webhookConfigured: false, webhookUrl: 'https://x/hook' } };
  }
  if (url.includes('/events/bookings/overview')) {
    return {
      events: [{ id: EVENT_ID, historyCategory: 'current', title: CMS_EVENT.title, startAt: CMS_EVENT.startAt, venue: 'Annamalai University', category: 'Awareness', status: 'published', registrationEnabled: true, price: 500, memberPrice: 400, hasMemberRate: true, totalSeats: 500, bookedSeats: 3, remainingSeats: 497, waitlistedSeats: 1, bookings: 3, paidBookings: 1, collected: 1010, pendingAmount: 500 },
        { id: 'past-event', title: 'Completed workshop', historyCategory: 'past', status: 'published' },
        { id: 'deleted-event', title: 'Removed workshop', historyCategory: 'deleted', bookingHistoryOnly: true, status: 'deleted' }],
      historyTotals: { current: { events: 1, seats: 3, capacity: 500, bookings: 3, collected: 1010, pending: 500 }, past: { events: 1 }, deleted: { events: 1 } },
      totals: { events: 1, seats: 3, capacity: 500, bookings: 3, collected: 1010, pending: 500 },
    };
  }
  if (url.includes('/events/bookings/people')) {
    return { people: [{ email: 't@example.com', name: 'Tharun V', phone: '9092317264', isMember: true, bookings: 2, seats: 2, events: 2, cancelled: 0, paid: 1, pending: 1, lastBookedAt: '2026-09-30T06:13:03.792Z' }], total: 1 };
  }
  if (url.includes('/events/bookings/person')) return { person: { email: 't@example.com', name: 'Tharun V' }, bookings: [{ ...BOOKING, event: { id: EVENT_ID, title: CMS_EVENT.title } }] };
  if (/\/events\/[^/]+\/bookings\/export/.test(url)) return BOOKING_REPORT;
  if (/\/events\/[^/]+\/bookings/.test(url)) {
    return { bookings: [BOOKING], summary: { bookings: 1, paidBookings: 0, seats: 2, collected: 0, pending: 1000, pendingBookings: 1 }, pagination: { page: 1, limit: 10, total: 1, pages: 1 } };
  }
  if (/\/events\/[^/]+\/attendees/.test(url)) {
    return { attendees: [{ key: 'a1', name: 'Tharun V', email: 't@example.com', bookingRef: BOOKING.bookingRef, paymentStatus: 'pending', status: 'confirmed', isGuest: false }], total: 1, seatsBooked: 2 };
  }
  if (url.includes('/events/categories')) {
    return { categories: [{ id: 'c1', label: 'Workshops', icon: 'book-open', mode: 'both', order: 0, managed: true, eventCount: 2 }], missingStandard: ['Medical'], standard: ['Medical'] };
  }
  if (url.includes('/events/reach')) return { members: 12, total: 12 };
  if (url.includes('/cms/events-settings')) return { categories: [{ label: 'Awareness', mode: 'both' }] };
  if (url.includes('/cms/events')) return [CMS_EVENT, { ...CMS_EVENT, id: 'e2', title: '', startAt: null, status: 'draft', targets: [], reachEveryone: true }];
  if (url.startsWith('/events')) return { events: [{ id: EVENT_ID, title: CMS_EVENT.title, startAt: CMS_EVENT.startAt, registrationFee: 500, capacity: 500 }], total: 1 };
  if (url.includes('/regions/tree')) return { states: [{ name: 'Tamil Nadu', districts: [{ name: 'Cuddalore', blocks: [{ name: 'Chidambaram' }] }] }] };
  if (url.includes('/membership/platinum/requests/')) {
    return { request: { id: 'r1', name: 'Asha', email: 'a@x.in', phone: '98', status: 'new', createdAt: '2026-09-01T00:00:00.000Z' }, member: { id: 'm1', fullName: 'Asha' } };
  }
  if (url.includes('/membership/platinum/requests')) return { requests: [{ id: 'r1', name: 'Asha', status: 'new', memberId: 'm1', createdAt: '2026-09-01T00:00:00.000Z' }], counts: { new: 1 } };
  if (url.includes('/membership/platinum/search')) return [];
  if (url.includes('/membership/platinum')) return { plan: { name: 'Platinum Lifetime', price: 200000, active: true }, members: [{ id: 'm1', fullName: 'Life Member', platinumSince: '2026-01-01T00:00:00.000Z' }] };
  if (url.includes('/membership/plans')) return { plans: [PLAN, { ...PLAN, id: 'p2', key: 'growth', name: 'Growth', minYears: 5, maxYears: null, price: 20000 }], settings: { showAllPlans: false } };
  if (url.includes('/donations/summary')) return { financialYears: ['2026-27', '2025-26'], fy: '', totalAmount: 1000, donationCount: 1, donorCount: 1, thisMonthAmount: 1000 };
  if (/\/donations\/donors\/[^/]+/.test(url)) {
    return { donor: { id: 'd1', fullName: 'K C Chellapandiyan', email: 'c@x.in', phone: '94', statementToken: 'tok' }, donations: [{ id: 'dn1', amount: 1000, status: 'paid', receiptNumber: 'R1', receiptToken: 'rt', paidAt: '2026-09-30T05:22:07.904Z', fy: '2026-27' }], byYear: [{ fy: '2026-27', amount: 1000, count: 1 }] };
  }
  if (url.includes('/donations/donors')) return { rows: [{ id: 'd1', fullName: 'K C Chellapandiyan', email: 'c@x.in', phone: '94', city: 'Dharmapuri', state: 'Tamilnadu', donationCount: 1, totalAmount: 1000, allTimeAmount: 1000, lastDonationAt: '2026-09-30T05:22:07.904Z', statementToken: 'tok' }], total: 1 };
  if (url.includes('/donations')) return { rows: [], total: 0 };
  if (url.includes('/announcements/admin')) {
    return { announcements: [{ id: 'u1', _id: 'u1', title: 'AGM on Sunday', body: 'Details', category: 'notice', status: 'published', createdAt: '2026-09-29T00:00:00.000Z', targets: [] }], total: 1 };
  }
  return {};
};

jest.mock('../src/services/api', () => {
  const respond = (url: string) => (mockFailAll
    ? Promise.reject(Object.assign(new Error('offline'), { response: undefined }))
    : Promise.resolve({ data: { success: true, message: 'Re-sent', data: mockByUrl(String(url || '')) } }));
  const inst = {
    get: jest.fn((url: string) => respond(url)),
    post: jest.fn((url: string) => respond(url)),
    put: jest.fn((url: string) => respond(url)),
    patch: jest.fn((url: string) => respond(url)),
    delete: jest.fn((url: string) => respond(url)),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  };
  return {
    __esModule: true,
    default: inst,
    STORAGE_KEYS: { AUTH_TOKEN: 't', USER_DATA: 'u', USER_ROLE: 'r' },
    getUserData: jest.fn(() => Promise.resolve({ fullName: 'Super Admin', email: 'super@activ.org.in' })),
    setUserData: jest.fn(() => Promise.resolve()),
  };
});

const nav = () => ({
  navigate: mockNavigate, goBack: jest.fn(), reset: jest.fn(), replace: jest.fn(), setParams: jest.fn(), canGoBack: () => true,
  setOptions: jest.fn(), addListener: jest.fn(() => () => {}), getParent: () => undefined,
});

/* Debounced loads (300–400 ms) need real time to pass. */
const flush = () => new Promise<void>((r) => { setTimeout(() => r(), 0); });
const wait = (ms: number) => new Promise<void>((r) => { setTimeout(() => r(), ms); });
const settle = async () => { await flush(); await flush(); };
/** Effects (and the debounce timers they start) run when an act() scope closes — so wait in a second one. */
const drain = async () => {
  for (let i = 0; i < 2; i += 1) {
    await ReactTestRenderer.act(async () => { await wait(450); await flush(); await flush(); });
  }
};

const Super = () => require('../src/screens/admin/super/context/SuperAdminContext').SuperAdminProvider;
const S = (file: string) => () => require(`../src/screens/admin/super/${file}`).default;

const screens: [string, () => React.ComponentType<any>, any][] = [
  ['Membership registrations', S('SuperMembershipRegistrationsScreen'), {}],
  ['Member account for Platinum', S('SuperOfficeAccountScreen'), {}],
  ['Lifetime grant requires a submitted application', S('SuperPlatinumGrantScreen'), { member: { id: 'm1', fullName: 'Office Member', blockedReason: 'Application not submitted', canAdmitManually: false }, price: 200000 }],
  ['Events (tab)', S('ManageEventsScreen'), {}],
  ['Event editor · new', S('SuperEventEditorScreen'), {}],
  ['Event editor · edit', S('SuperEventEditorScreen'), { event: CMS_EVENT }],
  ['Event QR', S('SuperEventQrScreen'), { event: CMS_EVENT, justCreated: true }],
  ['Event categories', S('SuperEventCategoriesScreen'), {}],
  ['Bookings & revenue', S('SuperBookingsScreen'), {}],
  ['Event bookings', S('SuperEventBookingsScreen'), { eventId: EVENT_ID, title: CMS_EVENT.title, capacity: 500 }],
  ['Booking people', S('SuperBookingPeopleScreen'), {}],
  ['Booking detail', S('SuperBookingDetailScreen'), { eventId: EVENT_ID, booking: BOOKING, event: { title: CMS_EVENT.title, capacity: 500 } }],
  ['Booking messages', S('SuperBookingMessagesScreen'), { bookingRef: BOOKING.bookingRef, title: CMS_EVENT.title }],
  ['Donors', S('SuperDonorsScreen'), {}],
  ['Donor detail', S('SuperDonorDetailScreen'), { id: 'd1', name: 'K C Chellapandiyan' }],
  ['Membership · plans', S('SuperMembershipScreen'), { tab: 'plans' }],
  ['Membership · platinum', S('SuperMembershipScreen'), { tab: 'platinum' }],
  ['Membership · requests', S('SuperMembershipScreen'), { tab: 'requests' }],
  ['Plan editor · new', S('SuperPlanEditorScreen'), {}],
  ['Plan editor · edit', S('SuperPlanEditorScreen'), { planKey: 'basic', plan: PLAN }],
  ['Platinum grant', S('SuperPlatinumGrantScreen'), { member: { id: 'm1', fullName: 'Asha', email: 'a@x.in' }, price: 200000 }],
  ['Platinum request', S('SuperPlatinumRequestScreen'), { id: 'r1' }],
  ['Member updates', S('SuperUpdatesScreen'), {}],
  ['Update editor · new', S('SuperUpdateEditorScreen'), {}],
  ['Update editor · edit', S('SuperUpdateEditorScreen'), { announcement: { id: 'u1', title: 'AGM', body: 'x', category: 'notice', status: 'draft' } }],
  ['Notifications · automation', S('SuperNotificationsScreen'), { view: 'automation' }],
  ['Notifications · log', S('SuperNotificationsScreen'), { view: 'log' }],
  ['Notifications · setup', S('SuperNotificationsScreen'), { view: 'delivery' }],
  ['Notifications · routing', S('SuperNotificationsScreen'), { view: 'routing' }],
  ['Event attendance', S('SuperEventAttendanceScreen'), {}],
  ['More menu', S('SuperMenuScreen'), {}],
];

const texts = (tree: any): string => tree.root.findAll((n: any) => typeof n.type === 'string' && n.type === 'Text' || n.type?.displayName === 'Text')
  .map((n: any) => (Array.isArray(n.props?.children) ? n.props.children.join('') : String(n.props?.children ?? ''))).join(' | ');

const mount = async (Screen: React.ComponentType<any>, params: any) => {
  mockParams = params || {};
  const Provider = Super();
  let tree: any;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<Provider><Screen navigation={nav()} route={{ params: mockParams }} /></Provider>);
    await settle();
  });
  await drain();
  return tree;
};

/** Press the first node carrying this accessibility label and an onPress. */
const press = async (tree: any, label: string | RegExp) => {
  const hit = tree.root.findAll((n: any) => {
    const l = n.props?.accessibilityLabel;
    return typeof n.props?.onPress === 'function' && (typeof label === 'string' ? l === label : label.test(String(l || '')));
  })[0];
  if (!hit) return false;
  await ReactTestRenderer.act(async () => { hit.props.onPress(); await flush(); await flush(); });
  return true;
};

jest.setTimeout(60000);

describe.each([false, true])('super admin parity screens (api failing: %s)', (failing) => {
  beforeAll(() => { mockFailAll = failing; });
  test.each(screens)('%s renders', async (_name, load, params) => {
    const tree = await mount(load(), params);
    expect(tree.toJSON()).toBeTruthy();
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });
});

describe('super admin parity interactions', () => {
  beforeAll(() => { mockFailAll = false; });
  beforeEach(() => { mockNavigate.mockClear(); });
  test('membership and booking exports download and save the server Excel workbooks', async () => {
    const api = require('../src/services/api').default;
    const save = jest.spyOn(require('../src/services/reportExport'), 'saveSpreadsheetReport').mockResolvedValue(true);
    const memberships = await mount(S('SuperMembershipRegistrationsScreen')(), {});
    expect(await press(memberships, 'Export Excel report')).toBe(true);
    expect(api.get).toHaveBeenCalledWith('/admin/super/membership/registrations/export', expect.objectContaining({ params: { tab: 'members', filter: 'all', search: '', format: 'xlsx', encoding: 'base64' } }));
    expect(save).toHaveBeenCalledWith(MEMBERSHIP_REPORT);
    await ReactTestRenderer.act(async () => { memberships.unmount(); });
    const bookings = await mount(S('SuperEventBookingsScreen')(), { eventId: EVENT_ID, title: CMS_EVENT.title });
    expect(await press(bookings, 'Excel report')).toBe(true);
    expect(api.get).toHaveBeenCalledWith(`/events/${EVENT_ID}/bookings/export`, expect.objectContaining({ params: { format: 'xlsx', encoding: 'base64' } }));
    expect(save).toHaveBeenCalledWith(BOOKING_REPORT);
    await ReactTestRenderer.act(async () => { bookings.unmount(); });
    save.mockRestore();
  });
  test('membership details include the real confirmation choices and receipts', async () => {
    const tree = await mount(S('SuperMembershipRegistrationsScreen')(), {});
    expect(texts(tree)).toContain('Registered');
    expect(await press(tree, 'Open membership Office Member')).toBe(true);
    expect(texts(tree)).toContain('Payment history');
    expect(texts(tree)).toContain('Member type');
    expect(texts(tree)).toContain('Confirmation');
    expect(await press(tree, 'Confirm membership / record payment')).toBe(true);
    expect(texts(tree)).toContain('Fee waiver');
    expect(texts(tree)).toContain('Cash');
    expect(texts(tree)).toContain('Super Admin review workflow');
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });
  test('fee waiver confirmation records zero collected and its reason', async () => {
    const kit = require('../src/screens/admin/super/superKit');
    const confirmation = jest.spyOn(kit, 'confirm').mockResolvedValue(true);
    const api = require('../src/services/api').default;
    api.post.mockClear();
    const tree = await mount(S('SuperMembershipRegistrationsScreen')(), {});
    await press(tree, 'Open membership Office Member');
    await press(tree, 'Confirm membership / record payment');
    const ChipRow = kit.ChipRow;
    const ToggleRow = kit.ToggleRow;
    const { PremiumInput, ConsoleButton } = require('../src/ui');
    await ReactTestRenderer.act(async () => { tree.root.findAllByType(ChipRow).find((n: any) => n.props.options.some((p: any) => p.value === 'waived')).props.onChange('waived'); });
    await ReactTestRenderer.act(async () => {
      tree.root.findAllByType(ChipRow).find((n: any) => n.props.options.some((p: any) => p.value === 'student')).props.onChange('student');
      tree.root.findAllByType(PremiumInput).find((n: any) => n.props.label === 'Reason for fee waiver').props.onChangeText('Approved student fee waiver');
      tree.root.findByType(ToggleRow).props.onChange(true);
    });
    await ReactTestRenderer.act(async () => { await tree.root.findAllByType(ConsoleButton).find((n: any) => n.props.label === 'Confirm membership').props.onPress(); });
    expect(api.post).toHaveBeenCalledWith('/admin/super/membership/registrations/m1/confirm', expect.objectContaining({ planId: 'student', mode: 'waived', amount: 0, note: 'Approved student fee waiver' }));
    confirmation.mockRestore();
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });
  test('membership summary cards filter members and paid receipts', async () => {
    const tree = await mount(S('SuperMembershipRegistrationsScreen')(), {});
    const { ConsoleStatTile } = require('../src/ui');
    const kit = require('../src/screens/admin/super/superKit');
    await ReactTestRenderer.act(async () => { tree.root.findAllByType(ConsoleStatTile).find((n: any) => n.props.label === 'Active members').props.onPress(); });
    expect(texts(tree)).not.toContain('Office Member');
    expect(tree.root.findByType(kit.ChipRow).props.value).toBe('active');
    await ReactTestRenderer.act(async () => { tree.root.findAllByType(ConsoleStatTile).find((n: any) => n.props.label === 'Registered').props.onPress(); });
    expect(texts(tree)).toContain('Office Member');
    await ReactTestRenderer.act(async () => { tree.root.findAllByType(ConsoleStatTile).find((n: any) => n.props.label === 'Collected').props.onPress(); });
    expect(tree.root.findByType(kit.ChipRow).props.value).toBe('paid');
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });
  test('membership office payment follows the submitted application and never sends a bypass flag', async () => {
    const api = require('../src/services/api').default;
    const kit = require('../src/screens/admin/super/superKit');
    const confirmation = jest.spyOn(kit, 'confirm').mockResolvedValue(true);
    const tree = await mount(S('SuperMembershipRegistrationsScreen')(), {});
    api.get.mockImplementationOnce(() => Promise.resolve({ data: { success: true, data: { member: { id: 'm1', name: 'Office Member', canConfirm: true, applicationStatus: 'Approved' }, payments: [], confirmation: { kind: 'student', commencementYear: '', plans: [{id:'student',key:'student',name:'Student',price:10,audience:'student',commencementYears:[]}] } } } }));
    await press(tree, 'Open membership Office Member');
    await press(tree, 'Confirm membership / record payment');
    const { PremiumInput, ConsoleButton } = require('../src/ui');
    await ReactTestRenderer.act(async () => {
      tree.root.findAllByType(kit.ChipRow).find((n: any) => n.props.options.some((p: any) => p.value === 'student')).props.onChange('student');
      tree.root.findAllByType(PremiumInput).find((n: any) => n.props.label === 'Payment / confirmation notes').props.onChangeText('Cash received; details verified');
      tree.root.findAllByType(PremiumInput).find((n: any) => n.props.label === 'Membership ID').props.onChangeText('ACTIV-20261012-099');
      tree.root.findByType(kit.ToggleRow).props.onChange(true);
    });
    await ReactTestRenderer.act(async () => { await tree.root.findAllByType(ConsoleButton).find((n: any) => n.props.label === 'Confirm membership').props.onPress(); });
    expect(api.post).toHaveBeenCalledWith('/admin/super/membership/registrations/m1/confirm', expect.objectContaining({ mode: 'cash', amount: 10, membershipNumber: 'ACTIV-20261012-099' }));
    expect(api.post.mock.calls.find((call: any[]) => call[0].endsWith('/registrations/m1/confirm'))[1]).not.toHaveProperty('manualAdmission');
    confirmation.mockRestore();
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });
  test('office business confirmation uses only the eligible plan and its commencement years', async () => {
    const api = require('../src/services/api').default;
    const kit = require('../src/screens/admin/super/superKit');
    const confirmation = jest.spyOn(kit, 'confirm').mockResolvedValue(true);
    const tree = await mount(S('SuperMembershipRegistrationsScreen')(), {});
    api.get.mockImplementationOnce(() => Promise.resolve({ data: { data: {
      member: { id: 'm1', name: 'Office Member', canConfirm: true, applicationStatus: 'Approved' }, payments: [],
      confirmation: { kind: 'business', commencementYear: '2012', plans: [{ id: 'ideal', key: 'ideal', name: 'Ideal', audience: 'business', price: 33000, commencementYears: ['2016','2015','2014','2013','2012'], commencementYearLabel: '2016 or earlier' }] }
    } } }));
    await press(tree, 'Open membership Office Member'); await press(tree, 'Confirm membership / record payment');
    const { PremiumSelect, PremiumInput, ConsoleButton } = require('../src/ui');
    const picker = tree.root.findAllByType(PremiumSelect).find((n: any) => n.props.label === 'Business commencement year');
    expect(picker.props.options).toEqual(['2016','2015','2014','2013','2012']);
    const choices = tree.root.findAllByType(kit.ChipRow).find((n: any) => n.props.options.some((p: any) => p.value === 'ideal'));
    expect(choices.props.options.map((p: any) => p.value)).toEqual(['ideal']);
    await ReactTestRenderer.act(async () => {
      picker.props.onChange('2013');
      tree.root.findAllByType(PremiumInput).find((n: any) => n.props.label === 'Payment / confirmation notes').props.onChangeText('Office business details checked');
      tree.root.findByType(kit.ToggleRow).props.onChange(true);
    });
    await ReactTestRenderer.act(async () => { await tree.root.findAllByType(ConsoleButton).find((n: any) => n.props.label === 'Confirm membership').props.onPress(); });
    expect(api.post).toHaveBeenCalledWith('/admin/super/membership/registrations/m1/confirm', expect.objectContaining({ planId: 'ideal', amount: 33000, commencementYear: '2013' }));
    confirmation.mockRestore(); await ReactTestRenderer.act(async () => tree.unmount());
  });
  test('submitted application filtering and application review keep the selected member reference', async () => {
    const api = require('../src/services/api').default;
    const tree = await mount(S('SuperMembershipRegistrationsScreen')(), {});
    const kit = require('../src/screens/admin/super/superKit');
    const filters = tree.root.findByType(kit.ChipRow);
    expect(filters.props.options).toContainEqual({ value: 'submitted', label: 'Applications submitted' });
    await ReactTestRenderer.act(async () => { filters.props.onChange('submitted'); });
    expect(texts(tree)).not.toContain('Office Member');
    await ReactTestRenderer.act(async () => { tree.root.findByType(kit.ChipRow).props.onChange('all'); });
    api.get.mockImplementationOnce(() => Promise.resolve({ data: { data: { member: { id: 'm1', name: 'Office Member', applicationId: 'app-selected', applicationStatus: 'Pending' }, payments: [] } } }));
    await press(tree, 'Open membership Office Member');
    expect(await press(tree, 'Open application review')).toBe(true);
    expect(mockNavigate).toHaveBeenCalledWith('ApplicantDetail', expect.objectContaining({ applicant: expect.objectContaining({ id: 'app-selected', applicationId: 'app-selected' }) }));
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });
  test('a PDF uploaded on the phone is retained in the event save payload', async () => {
    const api = require('../src/services/api').default;
    const picker = require('@react-native-documents/picker');
    const { ConsoleButton } = require('../src/ui');
    picker.pick.mockResolvedValueOnce([{ uri: 'content://files/agenda', name: 'Agenda.pdf', type: 'application/pdf', size: 512, hasRequestedType: true }]);
    picker.keepLocalCopy.mockResolvedValueOnce([{ status: 'success', localUri: 'file:///cache/Agenda.pdf' }]);
    const tree = await mount(S('SuperEventEditorScreen')(), { event: CMS_EVENT });
    api.post.mockResolvedValueOnce({ data: { data: { url: '/uploads/agenda.pdf', name: 'Agenda.pdf', type: 'application/pdf', size: 512 } } });
    await ReactTestRenderer.act(async () => { await tree.root.findAllByType(ConsoleButton).find((n: any) => n.props.label === 'Upload document').props.onPress(); });
    expect(api.post).toHaveBeenCalledWith('/cms/attachments', expect.any(FormData), expect.any(Object));
    expect(tree.root.findAll((n: any) => n.props.accessibilityLabel === 'Document name').some((n: any) => n.props.value === 'Agenda.pdf')).toBe(true);
    await ReactTestRenderer.act(async () => { await tree.root.findAllByType(ConsoleButton).find((n: any) => /Save/.test(n.props.label)).props.onPress(); });
    expect(api.put).toHaveBeenCalledWith(`/cms/events/${EVENT_ID}`, expect.objectContaining({ attachments: expect.stringContaining('/uploads/agenda.pdf') }));
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });
  test('membership deletion calls the archive endpoint after confirmation', async () => {
    const kit = require('../src/screens/admin/super/superKit');
    const confirmation = jest.spyOn(kit, 'confirm').mockResolvedValue(true);
    const api = require('../src/services/api').default;
    api.delete.mockClear();
    const tree = await mount(S('SuperMembershipRegistrationsScreen')(), {});
    await press(tree, 'Open membership Office Member');
    const { ConsoleButton } = require('../src/ui');
    await ReactTestRenderer.act(async () => { await tree.root.findAllByType(ConsoleButton).find((n: any) => n.props.label === 'Delete registration').props.onPress(); });
    expect(api.delete).toHaveBeenCalledWith('/admin/super/membership/registrations/m1');
    confirmation.mockRestore();
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });
  test('booking history switches between server-defined current, past and deleted groups', async () => {
    const tree = await mount(S('SuperBookingsScreen')(), {});
    const { ConsoleTabs } = require('../src/ui');
    const categoryTabs = () => tree.root.findAllByType(ConsoleTabs).find((node: any) => node.props.options.some((option: any) => option.value === 'deleted'));
    expect(texts(tree)).toContain(CMS_EVENT.title);
    expect(texts(tree)).not.toContain('Completed workshop');
    await ReactTestRenderer.act(async () => { categoryTabs().props.onChange('past'); });
    expect(texts(tree)).toContain('Completed workshop');
    expect(texts(tree)).not.toContain(CMS_EVENT.title);
    await ReactTestRenderer.act(async () => { categoryTabs().props.onChange('deleted'); });
    expect(texts(tree)).toContain('Removed workshop');
    expect(texts(tree)).not.toContain('Completed workshop');
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });
  test('booking details keep cancellation but never offer deletion', async () => {
    const api = require('../src/services/api').default;
    api.delete.mockClear();
    const tree = await mount(S('SuperBookingDetailScreen')(), { eventId: EVENT_ID, booking: { ...BOOKING, status: 'active' } });
    const { ConsoleButton } = require('../src/ui');
    expect(tree.root.findAllByType(ConsoleButton).some((n: any) => n.props.label === 'Delete booking')).toBe(false);
    expect(tree.root.findAllByType(ConsoleButton).some((n: any) => n.props.label === 'Cancel booking')).toBe(true);
    expect(api.delete).not.toHaveBeenCalled();
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });
  test('office account requires completed application before Lifetime receipt entry', async () => {
    const api = require('../src/services/api').default;
    api.post.mockClear();
    mockReplace.mockClear();
    const tree = await mount(S('SuperOfficeAccountScreen')(), {});
    const { PremiumInput, PremiumSelect, ConsoleButton } = require('../src/ui');
    await ReactTestRenderer.act(async () => { tree.root.findAllByType(ConsoleButton).find((n: any) => n.props.label === 'Create a new member instead').props.onPress(); });
    const values: Record<string, string> = { 'Full name': 'Office Member', Email: 'office@example.com', Password: 'test-password', Mobile: '9000000000', 'WhatsApp number': '9000000000' };
    await ReactTestRenderer.act(async () => { tree.root.findAllByType(PremiumInput).forEach((n: any) => n.props.onChangeText(values[n.props.label])); });
    const select = (label: string) => tree.root.findAllByType(PremiumSelect).find((n: any) => n.props.label === label);
    await ReactTestRenderer.act(async () => { select('State').props.onChange('Tamil Nadu'); });
    expect(select('District').props.options).toContain('Cuddalore');
    await ReactTestRenderer.act(async () => { select('District').props.onChange('Cuddalore'); });
    expect(select('Block').props.options).toContain('Chidambaram');
    await ReactTestRenderer.act(async () => { select('Block').props.onChange('Chidambaram'); });
    const password = tree.root.findAllByType(PremiumInput).find((n: any) => n.props.label === 'Password');
    expect(password.props.secureTextEntry).toBe(true);
    await ReactTestRenderer.act(async () => { await tree.root.findAllByType(ConsoleButton).find((n: any) => n.props.label === 'Create or select account').props.onPress(); });
    expect(api.post).toHaveBeenCalledWith('/admin/super/membership/platinum/accounts', expect.objectContaining({ email: 'office@example.com', state: 'Tamil Nadu' }));
    expect(mockReplace).not.toHaveBeenCalled();
    expect(tree.root.findAllByType(PremiumInput).find((n: any) => n.props.label === 'Password').props.value).toBe('');
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });

  test('Lifetime grant cannot bypass a missing application even with a legacy manual-admission flag', async () => {
    const api = require('../src/services/api').default;
    api.post.mockClear();
    const tree = await mount(S('SuperPlatinumGrantScreen')(), { member: { id: 'm1', fullName: 'Office Member', blockedReason: 'Complete and submit the application first.', canAdmitManually: true }, price: 200000 });
    const { ConsoleButton } = require('../src/ui');
    const kit = require('../src/screens/admin/super/superKit');
    expect(tree.root.findAllByType(ConsoleButton).find((node: any) => node.props.label === 'Grant Lifetime').props.disabled).toBe(true);
    expect(tree.root.findAllByType(kit.ToggleRow).some((node: any) => node.props.label === 'Admit this member directly as Super Admin')).toBe(false);
    await ReactTestRenderer.act(async () => { await tree.root.findAllByType(ConsoleButton).find((node: any) => node.props.label === 'Grant Lifetime').props.onPress(); });
    expect(api.post).not.toHaveBeenCalled();
    expect(texts(tree)).toContain('Complete and submit the application first.');
    await ReactTestRenderer.act(async () => tree.unmount());
  });

  test('every registered super route has a component', () => {
    const { superScreens } = require('../src/navigation/routes/superRoutes');
    const names: string[] = [];
    const Stack = { Screen: (p: any) => { names.push(p.name); return null; } };
    const el = superScreens(Stack);
    React.Children.forEach(el.props.children, (c: any) => { names.push(c.props.name); expect(c.props.component).toBeTruthy(); });
    for (const n of ['SuperBookings', 'SuperEventBookings', 'SuperBookingDetail', 'SuperBookingMessages', 'SuperDonors', 'SuperDonorDetail',
      'SuperMembership', 'SuperPlanEditor', 'SuperPlatinumGrant', 'SuperPlatinumRequest', 'SuperEventEditor', 'SuperEventQr',
      'SuperEventCategories', 'SuperUpdates', 'SuperUpdateEditor', 'SuperNotifications', 'SuperBookingPeople', 'SuperEventAttendance']) {
      expect(names).toContain(n);
    }
  });

  test('automation view: counts, a failed message expands in place, resend asks first', async () => {
    const tree = await mount(S('SuperNotificationsScreen')(), { view: 'automation' });
    const all = texts(tree);
    expect(all).toContain('Email');
    expect(all).toContain('WhatsApp');
    expect(all).toContain('Booking confirmation');
    expect(all).toContain('Recipient phone number not in allowed list');
    // Expand the failed WhatsApp message: its timeline and provider appear.
    expect(await press(tree, /^Booking confirmation to Tharun V, WhatsApp, Failed$/)).toBe(true);
    const opened = texts(tree);
    expect(opened).toContain('TIMELINE');
    expect(opened).toContain('WhatsApp (Meta)');
    expect(opened).toContain('event_reminder not used: meeting_url not on the event | sent on "booking_notice"');
    expect(LOG.templatePath).toBe('event_reminder skipped: meeting_url not on the event | sent on "booking_notice"');
    const { plainReason } = require('../src/screens/admin/super/delivery/deliveryKit');
    const unknownReason = 'Email marketing log 131026: subject too long';
    expect(plainReason({ ...LOG, failureReason: unknownReason })).toEqual({ text: unknownReason, failed: true });
    // Resend is confirmed inline: the first press only asks.
    expect(await press(tree, /^Resend WhatsApp to/)).toBe(true);
    expect(tree.root.findAll((n: any) => n.props?.accessibilityLabel === 'Confirm resend').length).toBeGreaterThan(0);
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });

  test('automation view sends its filters to /notifications/logs?group=automation', async () => {
    const api = require('../src/services/api').default;
    api.get.mockClear();
    const tree = await mount(S('SuperNotificationsScreen')(), { view: 'automation' });
    const call = api.get.mock.calls.find((c: any[]) => String(c[0]) === '/notifications/logs');
    expect(call?.[1]?.params?.group).toBe('automation');
    expect(call?.[1]?.params?.limit).toBe(25);
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });

  test.each(['automation', 'log'])('%s history cleanup reviews only its selected log scope', async view => {
    const api = require('../src/services/api').default;
    const { HistoryDeleteControl } = require('../src/screens/admin/super/delivery/HistoryDeleteControl');
    const tree = await mount(S('SuperNotificationsScreen')(), { view });
    const controls = tree.root.findAllByType(HistoryDeleteControl);
    const clear = controls.find((node: any) => node.props.label !== 'Delete');
    expect(clear?.props.selection.view).toBe('logs');
    if (view === 'automation') expect(clear?.props.selection.filters.group).toBe('automation');
    else expect(clear?.props.selection.filters).toEqual({ status: '', channel: '', event: '', search: '' });
    expect(controls.filter((node: any) => node.props.label === 'Delete').map((node: any) => node.props.selection.ids)).toEqual([['log1'], ['log2']]);
    api.post.mockClear();
    expect(clear?.props.selection.all).toBe(true);
    expect(await press(tree, 'Clear logs')).toBe(true);
    expect(api.post.mock.calls[0][0]).toBe('/notifications/history/delete-preview');
    expect(api.post.mock.calls.some((call: any[]) => call[0] === '/notifications/history/delete')).toBe(false);
    await ReactTestRenderer.act(async () => tree.unmount());
  });

  test('booking history cleanup reviews the complete booking scope and reloads it', async () => {
    const api = require('../src/services/api').default;
    const { HistoryDeleteControl } = require('../src/screens/admin/super/delivery/HistoryDeleteControl');
    const tree = await mount(S('SuperBookingMessagesScreen')(), { bookingRef: BOOKING.bookingRef });
    const controls = tree.root.findAllByType(HistoryDeleteControl);
    const clear = controls.find((node: any) => node.props.label === 'Clear logs');
    expect(clear?.props.selection).toEqual({ view: 'logs', all: true, filters: { bookingRef: BOOKING.bookingRef } });
    expect(controls.filter((node: any) => node.props.label === 'Delete').map((node: any) => node.props.selection.ids)).toEqual([['log1'], ['log2']]);
    api.get.mockClear();
    await ReactTestRenderer.act(async () => { clear?.props.onDone(); await settle(); });
    expect(api.get).toHaveBeenCalledWith(`/notifications/logs/booking/${BOOKING.bookingRef}`);
    await ReactTestRenderer.act(async () => tree.unmount());
  });

  test.each([true, false])('booking clear reviews the full booking even when501 visible rows are waiting (completed entries: %s)', async includeCompleted => {
    const api = require('../src/services/api').default;
    const delivery = require('../src/services/notificationDeliveryApi');
    const { HistoryDeleteControl } = require('../src/screens/admin/super/delivery/HistoryDeleteControl');
    const { FlatList } = require('react-native');
    const waiting = Array.from({ length: 501 }, (_, index) => ({ ...LOG, _id: `pending-${index}`, status: 'queued', effectiveStatus: 'queued' }));
    const allRows = [...waiting, ...(includeCompleted ? [LOG, LOG2] : [])];
    const fetch = jest.spyOn(delivery, 'getBookingDelivery').mockResolvedValueOnce({ bookingRef: BOOKING.bookingRef, rows: allRows, summary: {} });
    const tree = await mount(S('SuperBookingMessagesScreen')(), { bookingRef: BOOKING.bookingRef });
    try {
      const clear = tree.root.findAllByType(HistoryDeleteControl).find((node: any) => node.props.label === 'Clear logs');
      expect(clear?.props.selection).toEqual({ view: 'logs', all: true, filters: { bookingRef: BOOKING.bookingRef } });
      expect(clear?.props.disabled).toBe(false);
      expect(tree.root.findByType(FlatList).props.data).toHaveLength(allRows.length);
      expect(texts(tree)).toContain('501 messages waiting to send will stay in this history.');
      api.post.mockClear();
      expect(await press(tree, 'Clear logs')).toBe(true);
      expect(api.post).toHaveBeenCalledWith('/notifications/history/delete-preview', { view: 'logs', all: true, filters: { bookingRef: BOOKING.bookingRef } }, { timeout: 120000 });
    } finally {
      await ReactTestRenderer.act(async () => tree.unmount());
      fetch.mockRestore();
    }
  });

  test('log Resend requires confirmation, allows cancel, and suppresses duplicate sends', async () => {
    const api = require('../src/services/api').default;
    const { ConsoleButton } = require('../src/ui');
    const { Alert } = require('react-native');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const tree = await mount(S('SuperNotificationsScreen')(), { view: 'log' });
    api.post.mockClear();
    expect(await press(tree, /^Resend WhatsApp to/)).toBe(true);
    expect(api.post).not.toHaveBeenCalled();
    expect(await press(tree, 'Cancel')).toBe(true);
    expect(api.post).not.toHaveBeenCalled();
    expect(await press(tree, /^Resend WhatsApp to/)).toBe(true);
    const confirm = tree.root.findAllByType(ConsoleButton).find((node: any) => node.props.label === 'Confirm resend');
    if (!confirm) throw new Error('Resend confirmation missing');
    let finish: ((value: unknown) => void) | undefined;
    api.post.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await ReactTestRenderer.act(async () => { confirm.props.onPress(); confirm.props.onPress(); });
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith('/notifications/retry/log1', {});
    await ReactTestRenderer.act(async () => { finish?.({ data: { data: { ...LOG, status: 'sent', effectiveStatus: 'accepted' }, message: 'Passed to the sending service.' } }); });
    expect(alert).toHaveBeenCalledWith('Sent', 'Passed to the sending service.');
    await ReactTestRenderer.act(async () => { tree.unmount(); });
    alert.mockRestore();
  });

  test.each(['accepted', 'sent', 'delivered', 'read', 'queued', 'mock', 'resent'])('shared resend rejects %s rows', async state => {
    const { ResendButton } = require('../src/screens/admin/super/delivery/deliveryKit');
    let tree: any;
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<ResendButton row={{ ...LOG, effectiveStatus: state }} />); });
    expect(tree.toJSON()).toBeNull();
    await ReactTestRenderer.act(async () => tree.unmount());
  });

  test('message titles replace internal template identifiers but retain real subjects', () => {
    const { deliveryTitle } = require('../src/screens/admin/super/delivery/deliveryKit');
    expect(deliveryTitle({ event: 'EVENT_BOOKING_REMINDER', subject: 'event_reminder_v2', templateId: 'event_reminder_v2' })).toBe('Booking reminder');
    expect(deliveryTitle({ campaignKey: 'automation:EVENT_BOOKING_REMINDER', title: 'EVENT_BOOKING_REMINDER' })).toBe('Booking reminder');
    expect(deliveryTitle({ event: 'EVENT_BOOKING_REMINDER', subject: 'Your Chennai workshop starts tomorrow', templateId: 'event_reminder_v2' })).toBe('Your Chennai workshop starts tomorrow');
    expect(deliveryTitle(null)).toBe('Notification');
  });

  test('booking messages screen shows both channels and each message', async () => {
    const tree = await mount(S('SuperBookingMessagesScreen')(), { bookingRef: BOOKING.bookingRef, title: CMS_EVENT.title });
    const all = texts(tree);
    expect(all).toContain('Messages for this booking');
    expect(all).toContain('Booking confirmation');
    expect(all).toContain('WhatsApp');
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });

  test('event bookings show the Messages chips and open the booking messages', async () => {
    const tree = await mount(S('SuperEventBookingsScreen')(), { eventId: EVENT_ID, title: CMS_EVENT.title, capacity: 500 });
    expect(await press(tree, /^Messages: /)).toBe(true);
    expect(mockNavigate).toHaveBeenCalledWith('SuperBookingMessages', expect.objectContaining({ bookingRef: BOOKING.bookingRef }));
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });

  test('the More menu reaches every section', async () => {
    const tree = await mount(S('SuperMenuScreen')(), {});
    const labels = tree.root.findAll((n: any) => typeof n.props?.onPress === 'function' && n.props?.accessibilityLabel)
      .map((n: any) => String(n.props.accessibilityLabel));
    for (const l of ['Membership plans', 'Lifetime', 'Bookings & revenue', 'Donations', 'Events', 'Event categories', 'Event attendance', 'Member updates', 'Message delivery', 'Notifications']) {
      expect(labels.some((x: string) => x.startsWith(`${l},`))).toBe(true);
    }
    expect(await press(tree, /^Bookings & revenue,/)).toBe(true);
    expect(mockNavigate).toHaveBeenCalledWith('SuperBookings', undefined);
    expect(await press(tree, /^Message delivery,/)).toBe(true);
    expect(mockNavigate).toHaveBeenCalledWith('SuperNotifications', { view: 'automation' });
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });

  test('the Super Admin tabs mount with five tabs including Events', async () => {
    const { NavigationContainer } = require('@react-navigation/native');
    const Tabs = require('../src/navigation/SuperAdminBottomTabs').default;
    let tree: any;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<NavigationContainer><Tabs navigation={nav()} /></NavigationContainer>);
      await settle();
    });
    await drain();
    const all = texts(tree);
    for (const t of ['Hub', 'Admins', 'Events', 'Settings', 'More']) expect(all).toContain(t);
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });
});
