jest.mock('axios', () => ({ create: jest.fn(() => ({ get: jest.fn() })) }));
jest.mock('../src/config/api.config', () => ({ API_BASE_URL: 'https://api.example.test/api/v1' }));
jest.mock('../src/services/api', () => ({ getAuthToken: jest.fn(), getUserRole: jest.fn() }));
jest.mock('../src/services/session', () => ({ homeForRole: jest.fn().mockResolvedValue('MemberMain') }));
import axios from 'axios';
import { loadExploreContent, getPublicEvent, getPublicEventDetail, getPublicContactInfo } from '../src/services/publicContent';
import { publicActionFor, publicWebsitePath } from '../src/utils/publicBrowse';
import { clearPublicAction, openPublicAction, takePublicAction } from '../src/services/publicNavigation';
import { getAuthToken, getUserRole } from '../src/services/api';
import { homeForRole } from '../src/services/session';
import { WEBSITE_ORIGIN, publicWebsiteUrl } from '../src/config/website.config';

const get = (axios.create as jest.Mock).mock.results[0].value.get as jest.Mock;
beforeEach(() => { get.mockReset(); clearPublicAction(); jest.useRealTimers(); (getAuthToken as jest.Mock).mockClear().mockResolvedValue(null); (getUserRole as jest.Mock).mockClear().mockResolvedValue(null); });
test('anonymous browsing leaves every public content section accessible', () => {
  for (const path of ['/', '/events', '/events/conference', '/news', '/news/new-story', '/gallery/album-one', '/regions/south', '/states/tamil-nadu', '/schemes', '/membership', '/about', '/contact', '/delete-account']) {
    expect(publicWebsitePath(path)).toBe(path);
    expect(publicActionFor(path)).toBeNull();
  }
});
test('only protected local actions are handed to native membership', () => {
  expect(publicActionFor('/events/conference/book?ref=public')).toEqual({ kind: 'event', id: 'conference' });
  expect(publicActionFor('https://activ.org.in/login')).toEqual({ kind: 'login' });
  expect(publicActionFor('/register')).toEqual({ kind: 'register' });
  expect(publicActionFor('/payment/member-dashboard')).toEqual({ kind: 'membership' });
  expect(publicActionFor('/cms/events')).toEqual({ kind: 'account' });
  expect(publicActionFor('/news/%2e%2e/admin')).toEqual({ kind: 'account' });
  for (const path of ['https://activ.org.in.evil.test/login', 'https://evil.test/events/event/book', '//evil.test/login', 'javascript:alert(1)', '/bad%00path', '/bad\\path']) {
    expect(publicWebsitePath(path)).toBeNull();
    expect(publicActionFor(path)).toBeNull();
  }
});

test('public page entry preserves deep sections and filters without duplicating the app flag', () => {
  expect(publicWebsiteUrl('/membership#advantages')).toBe(WEBSITE_ORIGIN + '/membership?activApp=public#advantages');
  expect(publicWebsiteUrl('/schemes?state=Tamil%20Nadu#central')).toBe(WEBSITE_ORIGIN + '/schemes?state=Tamil%20Nadu&activApp=public#central');
  expect(publicWebsiteUrl('/contact?activApp=public&region=south#contact')).toBe(WEBSITE_ORIGIN + '/contact?region=south&activApp=public#contact');
  expect(publicWebsiteUrl('https://other.example/register')).toBe(WEBSITE_ORIGIN + '/?activApp=public');
});

test.each(['guest', 'unpaid', 'paid'])('membership invitation continues the existing %s account flow', async state => {
  const navigate = jest.fn();
  await openPublicAction({ navigate }, { kind: 'membership' });
  navigate.mockClear();
  if (state !== 'guest') {
    (getAuthToken as jest.Mock).mockResolvedValue('fixture-token');
    (getUserRole as jest.Mock).mockResolvedValue('member');
    (homeForRole as jest.Mock).mockResolvedValue(state === 'paid' ? 'PaidDashboard' : 'MemberMain');
  }
  await openPublicAction({ navigate }, { kind: 'register' });
  expect(navigate).toHaveBeenCalledWith(state === 'guest' ? 'RegistrationStep1' : state === 'paid' ? 'PaidDashboard' : 'MemberMain');
  if (state === 'guest') expect(takePublicAction()).toBeNull();
});

test.each([true, false])('website preview stays local only in development: %s', development => {
  const previous = (globalThis as any).__DEV__;
  (globalThis as any).__DEV__ = development;
  try {
    jest.isolateModules(() => {
      const config = require('../src/config/website.config');
      const browse = require('../src/utils/publicBrowse');
      const origin = development ? 'http://localhost:8080' : 'https://activ.org.in';
      expect(config.websiteUrl('/events')).toBe(origin + '/events');
      expect(config.websiteUrl('https://activ.org.in/news')).toBe(origin + '/news');
      expect(config.isWebsiteUrl('http://localhost:8080/events')).toBe(development);
      expect(browse.publicActionFor('http://localhost:8080/events/conference/book')).toEqual(development ? { kind: 'event', id: 'conference' } : null);
      for (const url of ['http://localhost:8080.evil.test/login', 'http://localhost:8080@evil.test/login', 'http://localhost:9090/login']) {
        expect(config.isWebsiteUrl(url)).toBe(false);
        expect(browse.publicActionFor(url)).toBeNull();
      }
    });
  } finally { (globalThis as any).__DEV__ = previous; }
});
test('visitor feeds use public requests without saved credentials and filter unpublished records', async () => {
  get.mockImplementation((path: string) => Promise.resolve({ data: { data: [
    { id: 'public', title: path, status: 'published' }, { id: 'draft', status: 'draft' },
    ...(path === '/cms/events' ? [
      { id: 'removed', status: 'published', archivedAt: '2026-10-12' },
      { id: 'completed', status: 'published', endAt: new Date(Date.now() - 1000).toISOString() },
    ] : []),
  ] } }));
  const content = await loadExploreContent('home');
  expect(content.events.map(e => e.id)).toEqual(['public']);
  expect(content.news.map(e => e.id)).toEqual(['public']);
  expect(content.gallery.map(e => e.id)).toEqual(['public']);
  expect(get.mock.calls.map(c => c[0])).toEqual(['/cms/events', '/cms/news', '/cms/gallery', '/cms/regions/map']);
  expect((axios.create as jest.Mock).mock.calls[0][0]).toMatchObject({ withCredentials: false });
  expect((axios.create as jest.Mock).mock.calls[0][0].headers?.Authorization).toBeUndefined();
  expect(get.mock.calls[0][1].params).toMatchObject({ scope: 'public', period: 'upcoming' });
  get.mockResolvedValue({ data: { data: [] } });
  await loadExploreContent('events');
  expect(get.mock.calls[4][1].params.period).toBe('upcoming');
  await getPublicContactInfo();
  expect(get.mock.calls[5][0]).toBe('/cms/contact-info');
  expect(get.mock.calls[5][1].params.scope).toBe('public');
  expect(getAuthToken).not.toHaveBeenCalled();
});
test('a guest booking opens the selected native booking without forcing sign-in', async () => {
  get.mockResolvedValue({ data: { data: { id: '507f1f77bcf86cd799439011' } } });
  const navigate = jest.fn();
  await openPublicAction({ navigate }, { kind: 'event', id: 'conference' });
  expect(get).toHaveBeenCalledWith('/cms/events/conference', expect.objectContaining({ params: { scope: 'public' } }));
  expect(navigate).toHaveBeenCalledWith('EventBooking', { eventId: '507f1f77bcf86cd799439011' });
  expect(getAuthToken).not.toHaveBeenCalled();
  expect(takePublicAction()).toBeNull();
});
test('signed-in members continue through the existing event screen and stale intent expires', async () => {
  get.mockResolvedValue({ data: { data: { id: '507f1f77bcf86cd799439011' } } });
  (getAuthToken as jest.Mock).mockResolvedValue('fixture-token');
  (getUserRole as jest.Mock).mockResolvedValue('member');
  const navigate = jest.fn();
  await openPublicAction({ navigate }, { kind: 'event', id: 'conference' });
  expect(navigate).toHaveBeenCalledWith('EventBooking', { eventId: '507f1f77bcf86cd799439011' });
  (getAuthToken as jest.Mock).mockResolvedValue(null);
  jest.useFakeTimers().setSystemTime(new Date('2026-10-12T10:00:00Z'));
  await openPublicAction({ navigate }, { kind: 'donate' });
  jest.setSystemTime(new Date('2026-10-12T10:31:00Z'));
  expect(takePublicAction()).toBeNull();
});
test('an unavailable event cannot become a resumable booking', async () => {
  get.mockResolvedValueOnce({ data: { data: { id: 'earlier-event' } } });
  await openPublicAction({ navigate: jest.fn() }, { kind: 'event', id: 'earlier-event' });
  get.mockResolvedValue({ data: { data: null } });
  const navigate = jest.fn();
  await expect(openPublicAction({ navigate }, { kind: 'event', id: 'removed' })).rejects.toThrow('no longer available');
  expect(navigate).not.toHaveBeenCalled();
  expect(takePublicAction()).toBeNull();
});

test('a completed event from an older API cannot open a public detail or booking', async () => {
  get.mockResolvedValue({ data: { data: { id: 'completed', endAt: new Date(Date.now() - 1000).toISOString() } } });
  expect(await getPublicEvent('completed')).toBeNull();
  const navigate = jest.fn();
  await expect(openPublicAction({ navigate }, { kind: 'event', id: 'completed' })).rejects.toThrow('no longer available');
  expect(navigate).not.toHaveBeenCalled();
  expect(takePublicAction()).toBeNull();
});

test('native public details use anonymous availability and the complete day-editor programme', async () => {
  get.mockImplementation((path: string) => Promise.resolve({ data: { data: path.startsWith('/cms/') ? {
    id: 'event-id', slug: 'public-event', status: 'published', registrationEnabled: true, registrationFee: 100,
    imageUrl: '/uploads/event.jpg', location: 'Chennai', days: [
      { date: '2099-01-01', agenda: [{ title: 'Introduction', startTime: '09:00' }] },
      { date: '2099-01-02', agenda: [{ title: 'Workshop', startTime: '10:00' }] },
    ],
  } : { amount: 100, capacity: 50, seatsLeft: 12, closed: false } } }));
  const event = await getPublicEventDetail('public-event');
  expect(event).toMatchObject({ id: 'event-id', bannerUrl: '/uploads/event.jpg', venue: 'Chennai', yourPrice: 100, myRegistration: null, publicAvailability: { seatsLeft: 12 } });
  expect(event?.agenda.map((row: any) => row.title)).toEqual(['Day 1 — Introduction', 'Day 2 — Workshop']);
  expect(get.mock.calls.map(call => call[0])).toEqual(['/cms/events/public-event', '/event-bookings/event/event-id']);
  expect(get.mock.calls.every(call => call[1].params.scope === 'public' && !call[1].headers?.Authorization)).toBe(true);
  expect(getAuthToken).not.toHaveBeenCalled();
});

test.each([{ status: 'draft' }, { audience: 'paid' }, { deletedAt: '2026-10-12' }, { archivedAt: '2026-10-12' }])('native guest details exclude unavailable events: %j', async hidden => {
  get.mockResolvedValue({ data: { data: { id: 'event-id', ...hidden } } });
  expect(await getPublicEventDetail('hidden')).toBeNull();
  expect(get).toHaveBeenCalledTimes(1);
});

test('an availability failure keeps public details readable without inventing a seat count', async () => {
  get.mockResolvedValueOnce({ data: { data: { id: 'event-id', registrationEnabled: true, registrationFee: 200 } } }).mockRejectedValueOnce(new Error('offline'));
  expect(await getPublicEventDetail('public-event')).toMatchObject({ id: 'event-id', yourPrice: 200, publicAvailability: null });
});
