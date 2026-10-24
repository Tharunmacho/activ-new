/**
 * Events Admin (QR event check-in): the three screens mount with data and with
 * every call failing, the events admin is routed to its own home, a scanned
 * pass URL yields its token, and the scanner's manual path looks a booking up
 * and lets one person in with an inline result card (no native Modal).
 *
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

declare const __dirname: string;

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const ReactLib = require('react');
  return {
    ...actual,
    useFocusEffect: (cb: () => any) => ReactLib.useEffect(() => cb(), [cb]),
  };
});

let mockFailAll = false;
const mockCalls: { method: string; url: string; body: any }[] = [];
let mockLookupBody: any = null;
const ATTENDANCE_REPORT = {
  filename: 'attendance-business-conclave.xlsx',
  base64: 'UEsDBAoAAAA=',
  contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const SEAT = {
  registrationNo: 'ACTIVB-MF3K2L-1234-P2', bookingRef: 'ACTIVB-MF3K2L-1234', participantIndex: 1, participantNumber: 2, seats: 2,
  attendee: { name: 'Ravi Kumar', phoneMasked: '•••• 6789' }, bookedBy: { name: 'Priya' }, isGuest: true,
  event: { id: 'e1', title: 'Business Conclave', startAt: '2026-10-10T04:30:00.000Z', endAt: null, venue: 'Chennai', mode: 'offline', category: 'Conference' },
  ticket: { category: 'Conference', label: 'Standard ticket', unitAmount: 500 },
  payment: { status: 'paid', label: 'Paid', mode: 'upi' }, bookingStatus: 'active',
  admissible: true, reason: null, eventIsToday: true, checkedIn: false, checkin: null,
};
const ADMITTED = {
  ...SEAT, checkedIn: true,
  checkin: { id: 'c1', admittedAt: '2026-10-10T04:40:00.000Z', admittedAtLabel: '10 Oct 2026, 10:10 am', admittedBy: { name: 'Gate One', email: 'event@gmail.com', role: 'events_admin' }, method: 'manual' },
};

const mockByUrl = (method: string, url: string): any => {
  if (url.includes('/event-checkin/events')) {
    return [
      { id: 'e1', title: 'Business Conclave', startAt: '2026-10-10T04:30:00.000Z', endAt: null, venue: 'Chennai', mode: 'offline', category: 'Conference', slug: 'x', isToday: true, registered: 40, checkedIn: 12 },
      { id: 'e2', title: '', startAt: null, endAt: null, venue: '', mode: 'online', category: '', slug: '', isToday: false, registered: 0, checkedIn: 0 },
    ];
  }
  if (url.includes('/cms/events')) {
    return [
      { id: 'e1', title: 'Business Conclave', status: 'published', startAt: '2099-10-10T04:30:00.000Z' },
      { id: 'e3', title: 'Draft meet', status: 'draft', startAt: null },
      { id: 'e4', title: 'Old meet', status: 'published', startAt: '2020-01-01T04:30:00.000Z' },
    ];
  }
  if (url.includes('/attendance/export')) return ATTENDANCE_REPORT;
  if (url.includes('/event-checkin/lookup')) {
    return mockLookupBody?.bookingRef && !mockLookupBody?.registrationNo
      ? { method: 'manual', bookingRef: SEAT.bookingRef, seats: [{ ...SEAT, participantIndex: 0, participantNumber: 1, registrationNo: 'ACTIVB-MF3K2L-1234-P1', attendee: { name: 'Priya', phoneMasked: '' } }, SEAT] }
      : { method: 'manual', bookingRef: SEAT.bookingRef, seats: [SEAT] };
  }
  if (url.includes('/event-checkin/admit')) return { outcome: 'admitted', seat: ADMITTED };
  if (url.includes('/attendance')) {
    return {
      event: { id: 'e1', title: 'Business Conclave', startAt: null, venue: 'Chennai' },
      totals: { registered: 2, checkedIn: 1, notYet: 1, percent: 50 },
      rows: [
        { registrationNo: 'R-P1', bookingRef: 'R', participantNumber: 1, name: 'Priya', phoneMasked: '', bookedBy: 'Priya', payment: 'Paid', bookingStatus: 'active', checkedIn: true, admittedAt: '2026-10-10T04:40:00.000Z', admittedAtLabel: '10 Oct, 10:10 am', admittedBy: 'Gate One', method: 'qr' },
        { registrationNo: 'R-P2', bookingRef: 'R', participantNumber: 2, name: '', phoneMasked: '', bookedBy: '', payment: '', bookingStatus: 'active', checkedIn: false, admittedAt: null, admittedAtLabel: '', admittedBy: '', method: '' },
      ],
    };
  }
  return {};
};

jest.mock('../src/services/api', () => {
  const respond = (method: string, url: string, body?: any) => {
    mockCalls.push({ method, url: String(url || ''), body });
    mockLookupBody = body;
    if (mockFailAll) return Promise.reject(Object.assign(new Error('offline'), { response: undefined }));
    return Promise.resolve({ data: { success: true, data: mockByUrl(method, String(url || '')) } });
  };
  const inst = {
    get: jest.fn((url: string, config?: any) => respond('get', url, config)),
    post: jest.fn((url: string, body: any) => respond('post', url, body)),
    put: jest.fn((url: string, body: any) => respond('put', url, body)),
    delete: jest.fn((url: string) => respond('delete', url)),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  };
  return {
    __esModule: true,
    default: inst,
    STORAGE_KEYS: { AUTH_TOKEN: 't', USER_DATA: 'u', USER_ROLE: 'r' },
    getUserData: jest.fn(() => Promise.resolve({ fullName: 'Events', email: 'event@gmail.com' })),
    setUserData: jest.fn(() => Promise.resolve()),
    setAuthToken: jest.fn(() => Promise.resolve()),
    setUserRole: jest.fn(() => Promise.resolve()),
    getAuthToken: jest.fn(() => Promise.resolve(null)),
    getUserRole: jest.fn(() => Promise.resolve(null)),
  };
});

const nav = () => ({
  navigate: jest.fn(), goBack: jest.fn(), reset: jest.fn(), replace: jest.fn(), canGoBack: () => true,
  setOptions: jest.fn(), addListener: jest.fn(() => () => {}), getParent: () => undefined,
});
const flush = () => new Promise<void>((r) => { setTimeout(() => r(), 0); });

/** Every string rendered, joined — safe where a prop holds a circular object. */
const textOf = (tree: any) => {
  const out: string[] = [];
  const walk = (node: any) => {
    if (node === null || node === undefined || typeof node === 'boolean') return;
    if (typeof node === 'string' || typeof node === 'number') { out.push(String(node)); return; }
    if (Array.isArray(node)) { node.forEach(walk); return; }
    (node.children || []).forEach(walk);
  };
  walk(tree.toJSON());
  return out.join(' ');
};

const press = async (tree: any, label: string) => {
  const hit = tree.root.findAll((n: any) => n.props?.accessibilityLabel === label && typeof n.props?.onPress === 'function')[0];
  if (!hit) return false;
  await ReactTestRenderer.act(async () => { hit.props.onPress(); await flush(); await flush(); });
  return true;
};

const screens: [string, () => React.ComponentType<any>, any][] = [
  ['Events home', () => require('../src/screens/eventsAdmin/EventsCheckinHomeScreen').default, {}],
  ['Scanner (event)', () => require('../src/screens/eventsAdmin/EventScannerScreen').default, { params: { eventId: 'e1', eventTitle: 'Business Conclave' } }],
  ['Scanner (any event)', () => require('../src/screens/eventsAdmin/EventScannerScreen').default, {}],
  ['Attendance', () => require('../src/screens/eventsAdmin/EventAttendanceScreen').default, { params: { eventId: 'e1' } }],
  ['Attendance (no event)', () => require('../src/screens/eventsAdmin/EventAttendanceScreen').default, {}],
  ['Attendance (super admin, read-only)', () => require('../src/screens/eventsAdmin/EventAttendanceScreen').default, { params: { eventId: 'e1', readOnly: true } }],
  ['Dashboard', () => require('../src/screens/eventsAdmin/EventsAdminDashboardScreen').default, {}],
  ['Account', () => require('../src/screens/eventsAdmin/EventsAdminAccountScreen').default, {}],
  ['Door bookings', () => require('../src/screens/eventsAdmin/EventDoorBookingsScreen').default, { params: { eventId: 'e1', eventTitle: 'Business Conclave' } }],
  ['Door bookings (no event)', () => require('../src/screens/eventsAdmin/EventDoorBookingsScreen').default, {}],
  ['Booking detail', () => require('../src/screens/eventsAdmin/EventBookingDetailScreen').default, { params: { eventId: 'e1', bookingRef: 'ACTIVB-MF3K2L-1234' } }],
  ['Booking detail (read-only)', () => require('../src/screens/eventsAdmin/EventBookingDetailScreen').default, { params: { eventId: 'e1', bookingRef: 'ACTIVB-MF3K2L-1234', readOnly: true } }],
  ['Booking detail (no booking)', () => require('../src/screens/eventsAdmin/EventBookingDetailScreen').default, {}],
  ['Super admin event attendance', () => require('../src/screens/admin/super/SuperEventAttendanceScreen').default, {}],
];

describe.each([false, true])('events admin screens (api failing: %s)', (failing) => {
  beforeAll(() => { mockFailAll = failing; });
  test.each(screens)('%s renders', async (_name, load, route) => {
    const Screen = load();
    let tree: any;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<Screen navigation={nav()} route={route} />);
      await flush(); await flush();
    });
    expect(tree.toJSON()).toBeTruthy();
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });
});

describe('events admin behaviour', () => {
  beforeAll(() => { mockFailAll = false; });

  test('attendance admin opens the mobile door console; website staff stay on the website', () => {
    const { ADMIN_HOME, isAdminRole } = require('../src/services/session');
    expect(ADMIN_HOME.attendance_admin).toBe('EventsAdminHome');
    expect(isAdminRole('attendance_admin')).toBe(true);
    expect(ADMIN_HOME.events_admin).toBeUndefined();
    expect(ADMIN_HOME.cms_admin).toBeUndefined();
  });

  test('a scanned pass URL yields its token; anything else yields nothing', () => {
    const { extractPassToken } = require('../src/services/eventCheckinApi');
    const token = 'AQ'.padEnd(40, 'x');
    expect(extractPassToken(`https://activ.org.in/checkin/${token}`)).toBe(token);
    expect(extractPassToken(`https://activ.org.in/checkin/${token}?a=1`)).toBe(token);
    expect(extractPassToken(token)).toBe(token);
    expect(extractPassToken('upi://pay?pa=x@y')).toBe('');
    expect(extractPassToken(null)).toBe('');
  });

  test('manual entry finds the booking and Allow entry admits once, inline', async () => {
    const Screen = require('../src/screens/eventsAdmin/EventScannerScreen').default;
    let tree: any;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<Screen navigation={nav()} route={{ params: { eventId: 'e1', eventTitle: 'Business Conclave' } }} />);
      await flush();
    });
    // Open manual entry and type a registration number.
    const input = tree.root.findAll((n: any) => n.props?.label === 'Booking ID or registration no.' && typeof n.props?.onChangeText === 'function')[0];
    if (!input) {
      // Manual entry starts closed while the camera is available: open it.
      let open: any = tree.root.findAll((n: any) => n.props?.children === 'Open')[0];
      while (open && typeof open.props?.onPress !== 'function') open = open.parent;
      await ReactTestRenderer.act(async () => { open?.props?.onPress(); await flush(); });
    }
    const field = tree.root.findAll((n: any) => n.props?.label === 'Booking ID or registration no.' && typeof n.props?.onChangeText === 'function')[0];
    expect(field).toBeTruthy();
    await ReactTestRenderer.act(async () => { field.props.onChangeText('ACTIVB-MF3K2L-1234-P2'); await flush(); });
    expect(await press(tree, 'Find booking')).toBe(true);
    const lookup = mockCalls.filter((c) => c.url.includes('/event-checkin/lookup')).pop();
    expect(lookup?.body).toEqual({ registrationNo: 'ACTIVB-MF3K2L-1234-P2', eventId: 'e1' });
    expect(textOf(tree)).toContain('Ravi Kumar');
    expect(textOf(tree)).toContain('Valid pass');

    const admitsBefore = mockCalls.filter((c) => c.url.includes('/event-checkin/admit')).length;
    expect(await press(tree, 'Allow entry')).toBe(true);
    const admits = mockCalls.filter((c) => c.url.includes('/event-checkin/admit'));
    expect(admits.length).toBe(admitsBefore + 1);
    expect(admits[admits.length - 1].body).toMatchObject({ registrationNo: 'ACTIVB-MF3K2L-1234-P2', eventId: 'e1', method: 'manual' });
    expect(textOf(tree)).toContain('Entry allowed');
    // Once in, the button is gone — a second press cannot send a second admit.
    expect(tree.root.findAll((n: any) => n.props?.accessibilityLabel === 'Allow entry').length).toBe(0);
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });
});

describe('events admin console', () => {
  beforeAll(() => { mockFailAll = false; });

  const mount = async (load: () => React.ComponentType<any>, route: any = {}, navigation: any = nav()) => {
    const Screen = load();
    let tree: any;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<Screen navigation={navigation} route={route} />);
      await flush(); await flush();
    });
    return tree;
  };

  test('attendance rows group into door bookings, filter by door state and search', () => {
    const { groupDoorBookings, filterDoorBookings, doorStateOf } = require('../src/services/eventCheckinApi');
    const row = (ref: string, n: number, name: string, inside: boolean) => ({
      registrationNo: `${ref}-P${n}`, bookingRef: ref, participantNumber: n, name, phoneMasked: '', bookedBy: `Booker ${ref}`,
      payment: 'Paid', bookingStatus: 'active', checkedIn: inside, admittedAt: inside ? `2026-10-10T0${n}:00:00.000Z` : null,
      admittedAtLabel: '', admittedBy: '', method: '',
    });
    const list = groupDoorBookings([
      row('A', 1, 'Asha', true), row('A', 2, 'Arun', false),
      row('B', 1, 'Bala', true),
      row('C', 1, 'Chitra', false),
      row('', 1, 'No ref', false),
      null,
    ]);
    expect(list.map((b: any) => b.bookingRef)).toEqual(['A', 'B', 'C']);
    const a = list.find((b: any) => b.bookingRef === 'A');
    expect(a).toMatchObject({ seats: 2, checkedIn: 1, bookedBy: 'Booker A', payment: 'Paid', names: ['Asha', 'Arun'] });
    expect(doorStateOf(a)).toBe('partial');
    expect(doorStateOf(list.find((b: any) => b.bookingRef === 'B'))).toBe('in');
    expect(filterDoorBookings(list, '', 'waiting').map((b: any) => b.bookingRef)).toEqual(['C']);
    expect(filterDoorBookings(list, 'arun', 'all').map((b: any) => b.bookingRef)).toEqual(['A']);
    expect(filterDoorBookings(null, 'x', 'all')).toEqual([]);
    expect(groupDoorBookings(undefined)).toEqual([]);
  });

  test('programme counts: undated events are upcoming, drafts counted', () => {
    const { programmeCounts, isUpcomingEvent } = require('../src/services/eventCheckinApi');
    const now = new Date('2026-09-30T00:00:00.000Z').getTime();
    expect(isUpcomingEvent({ startAt: null }, now)).toBe(true);
    expect(isUpcomingEvent({ startAt: '2020-01-01T00:00:00.000Z' }, now)).toBe(false);
    expect(isUpcomingEvent(null, now)).toBe(true);
    expect(programmeCounts([
      { id: '1', title: '', status: 'published', startAt: '2099-01-01T00:00:00.000Z', endAt: null, venue: '' },
      { id: '2', title: '', status: 'draft', startAt: null, endAt: null, venue: '' },
      { id: '3', title: '', status: 'published', startAt: '2020-01-01T00:00:00.000Z', endAt: null, venue: '' },
    ], now)).toEqual({ all: 3, published: 2, drafts: 1, upcoming: 2 });
    expect(programmeCounts(null, now)).toEqual({ all: 0, published: 0, drafts: 0, upcoming: 0 });
  });

  test('the dashboard reads only endpoints the events admin is allowed', async () => {
    mockCalls.length = 0;
    const tree = await mount(() => require('../src/screens/eventsAdmin/EventsAdminDashboardScreen').default);
    const urls = mockCalls.map((c) => c.url);
    expect(urls.some((u) => u.includes('/event-checkin/events'))).toBe(true);
    expect(urls.some((u) => u.includes('/cms/events'))).toBe(true);
    // BOOKING_VIEWERS is the super admin alone — never asked from this role.
    expect(urls.some((u) => /\/bookings|\/attendees|record-payment|\/cancel/.test(u))).toBe(false);
    expect(textOf(tree)).toContain('Today at the door');
    expect(textOf(tree)).toContain('Business Conclave');
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });

  test('door bookings group the attendance list and open a booking', async () => {
    mockCalls.length = 0;
    const navigation = nav();
    const tree = await mount(() => require('../src/screens/eventsAdmin/EventDoorBookingsScreen').default, { params: { eventId: 'e1' } }, navigation);
    expect(mockCalls.some((c) => c.url.includes('/events/e1/attendance'))).toBe(true);
    expect(mockCalls.some((c) => /\/bookings/.test(c.url))).toBe(false);
    expect(await press(tree, 'Booking R, 1 of 2 checked in')).toBe(true);
    expect(navigation.navigate).toHaveBeenCalledWith('EventBookingDetail', expect.objectContaining({ eventId: 'e1', bookingRef: 'R' }));
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });

  test('booking detail lists every seat and admits one by booking ID + seat', async () => {
    mockCalls.length = 0;
    const tree = await mount(
      () => require('../src/screens/eventsAdmin/EventBookingDetailScreen').default,
      { params: { eventId: 'e1', bookingRef: 'ACTIVB-MF3K2L-1234' } },
    );
    const lookup = mockCalls.find((c) => c.url.includes('/event-checkin/lookup'));
    expect(lookup?.body).toEqual({ bookingRef: 'ACTIVB-MF3K2L-1234', eventId: 'e1' });
    expect(textOf(tree)).toContain('Priya');
    expect(textOf(tree)).toContain('Ravi Kumar');
    expect(await press(tree, 'Admit Ravi Kumar')).toBe(true);
    const admit = mockCalls.filter((c) => c.url.includes('/event-checkin/admit')).pop();
    expect(admit?.body).toMatchObject({ bookingRef: 'ACTIVB-MF3K2L-1234', participantIndex: 1, eventId: 'e1', method: 'manual' });
    expect(textOf(tree)).toContain('Admitted');
    expect(tree.root.findAll((n: any) => n.props?.accessibilityLabel === 'Admit Ravi Kumar').length).toBe(0);
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });

  test('read-only booking detail and attendance offer no admit and no scanner', async () => {
    const detail = await mount(
      () => require('../src/screens/eventsAdmin/EventBookingDetailScreen').default,
      { params: { eventId: 'e1', bookingRef: 'ACTIVB-MF3K2L-1234', readOnly: true } },
    );
    expect(detail.root.findAll((n: any) => String(n.props?.accessibilityLabel || '').startsWith('Admit')).length).toBe(0);
    await ReactTestRenderer.act(async () => { detail.unmount(); });

    const att = await mount(() => require('../src/screens/eventsAdmin/EventAttendanceScreen').default, { params: { eventId: 'e1', readOnly: true } });
    expect(att.root.findAll((n: any) => n.props?.accessibilityLabel === 'Scan passes').length).toBe(0);
    expect(textOf(att)).toContain('Read-only');
    await ReactTestRenderer.act(async () => { att.unmount(); });
  });

  test('attendance export downloads and saves the server Excel workbook', async () => {
    const save = jest.spyOn(require('../src/services/reportExport'), 'saveSpreadsheetReport').mockResolvedValue(true);
    mockCalls.length = 0;
    const tree = await mount(() => require('../src/screens/eventsAdmin/EventAttendanceScreen').default, { params: { eventId: 'e1', eventTitle: 'Business Conclave' } });
    expect(await press(tree, 'Export attendance Excel report')).toBe(true);
    expect(mockCalls).toContainEqual(expect.objectContaining({
      method: 'get', url: '/events/e1/attendance/export',
      body: expect.objectContaining({ params: { format: 'xlsx', encoding: 'base64' } }),
    }));
    expect(save).toHaveBeenCalledWith(ATTENDANCE_REPORT);
    save.mockRestore();
    await ReactTestRenderer.act(async () => { tree.unmount(); });
  });

  test('super admin: More has Event attendance, which opens the read-only list', async () => {
    const navigation = nav();
    const tree = await mount(() => require('../src/screens/admin/super/SuperEventAttendanceScreen').default, {}, navigation);
    expect(await press(tree, 'Business Conclave, 12 of 40 checked in')).toBe(true);
    expect(navigation.navigate).toHaveBeenCalledWith('EventAttendance', expect.objectContaining({ eventId: 'e1', readOnly: true }));
    await ReactTestRenderer.act(async () => { tree.unmount(); });

    const fs = require('fs');
    const path = require('path');
    const menu = fs.readFileSync(path.join(__dirname, '../src/screens/admin/super/SuperMenuScreen.tsx'), 'utf8');
    expect(menu).toContain("stack('SuperEventAttendance')");
    const routes = fs.readFileSync(path.join(__dirname, '../src/navigation/routes/superRoutes.tsx'), 'utf8');
    expect(routes).toContain('name="SuperEventAttendance"');
  });
});
