import api from './api';

/**
 * ============================================================================
 * SUPER ADMIN — every endpoint the website's Super Admin pages call, 1:1
 * ============================================================================
 *
 * Same backend, same database, same parameters as `website/src/services/*`
 * (activApi, adminMembersApi, platinumApi, donationsApi, eventBookingAdminApi,
 * eventCategoryApi, announcements, notifications). Paths confirmed against
 * `backend/src/modules/**` routes. Money is in RUPEES here — the server stores
 * paise and converts at its edge (membershipplan.service).
 */

const unwrap = <T = any>(res: any, fallback: T): T => {
  const d = res?.data;
  if (d === undefined || d === null) return fallback;
  if (typeof d === 'object' && 'data' in d && d.data !== undefined && d.data !== null) return d.data as T;
  return (d as T) ?? fallback;
};
const enc = encodeURIComponent;
/** Drop empty params: the server reads `status=''` as a filter for the empty value. */
const clean = (p: Record<string, any> = {}) => {
  const out: Record<string, any> = {};
  Object.keys(p || {}).forEach((k) => {
    const v = p[k];
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  });
  return out;
};

/* =============================================================== APPROVALS */
/**
 * Every application on the platform with THIS caller's verdict state: the
 * Super Admin fills the State seat, so `level: 'state'`; the server decorates
 * each row with `canAct` / `decidesOutcome` — never re-derived here.
 */
export const getSuperApplications = async (params: { level?: string; status?: string; q?: string; page?: number; limit?: number; state?: string; district?: string; block?: string } = {}) =>
  unwrap<{ applicants: any[]; pagination: any }>(await api.get('/admin/super/applications', { params: clean(params) }), { applicants: [], pagination: {} });

/** The generic aliases the website uses: the caller's role selects the seat. */
export const approveApplication = async (id: string) => {
  const res = await api.post(`/applications/${enc(id)}/approve`, {});
  return { ...unwrap<any>(res, {}), message: res?.data?.message || '' };
};
export const rejectApplication = async (id: string, rejectionReason: string) => {
  const res = await api.post(`/applications/${enc(id)}/reject`, { rejectionReason });
  return { ...unwrap<any>(res, {}), message: res?.data?.message || '' };
};

/* ================================================================= MEMBERS */
export type MembersTab = 'active' | 'expiring' | 'expired' | 'awaiting' | 'all';
export interface AdminMember {
  id: string; applicationId: string; applicationRef: string; name: string; email: string; phone: string; photo: string;
  block: string; district: string; state: string; memberNumber: string; kind: string; kindLabel: string;
  platinum: boolean; lifetime: boolean; planName: string; activatedAt: string | null; expiresAt: string | null;
  daysLeft: number | null; status: 'active' | 'expired' | 'awaiting_payment'; expiringSoon: boolean; blocked: boolean;
  reminders: boolean; remindersChangedBy: string; remindersChangedAt: string | null; lastReminderAt: string | null;
}
export interface AdminMembersPayload {
  rows: AdminMember[];
  counts: Record<MembersTab, number>;
  summary: { active: number; expiringSoon: number; expired: number; awaitingPayment: number; platinum: number; renewedThisMonth: number };
  canManageReminders: boolean;
  scopeUnresolved: boolean;
}
export const EMPTY_MEMBERS: AdminMembersPayload = {
  rows: [], counts: { active: 0, expiring: 0, expired: 0, awaiting: 0, all: 0 },
  summary: { active: 0, expiringSoon: 0, expired: 0, awaitingPayment: 0, platinum: 0, renewedThisMonth: 0 },
  canManageReminders: false, scopeUnresolved: false,
};
export const listAdminMembers = async (params: { tab?: MembersTab; q?: string; type?: string } = {}) =>
  unwrap<AdminMembersPayload>(await api.get('/admin/members', { params: clean(params) }), EMPTY_MEMBERS);
export const setMemberReminders = async (id: string, enabled: boolean) =>
  unwrap<any>(await api.patch(`/admin/members/${enc(id)}/reminders`, { enabled }), null);
export const remindMemberNow = async (id: string) =>
  unwrap<{ sent: boolean; at: string }>(await api.post(`/admin/members/${enc(id)}/remind`), { sent: false, at: '' });
export const remindAllExpired = async () =>
  unwrap<{ sent: number; skipped: number }>(await api.post('/admin/members/remind-expired'), { sent: 0, skipped: 0 });
/** Block / unblock / delete — keyed by the APPLICATION id, as on the website. */
export const memberAction = async (applicationId: string, action: 'activate' | 'suspend' | 'delete') =>
  unwrap<any>(await api.post(`/admin/users/${enc(applicationId)}/${action}`, {}), {});

/* ============================================================== MEMBERSHIP */
export type PlanAudience = 'business' | 'aspirant' | 'student' | 'platinum';
export interface MembershipPlanRow {
  key: string; name: string; description: string; price: number; audience: PlanAudience;
  minYears: number; maxYears: number | null; experience: string; features: string[];
  popular: boolean; active: boolean; order: number;
}
export const listMembershipPlans = async () =>
  unwrap<{ plans: MembershipPlanRow[]; settings: { showAllPlans: boolean } }>(
    await api.get('/admin/super/membership/plans'), { plans: [], settings: { showAllPlans: false } });
export const createMembershipPlan = async (payload: Partial<MembershipPlanRow>) =>
  unwrap<MembershipPlanRow>(await api.post('/admin/super/membership/plans', payload), {} as MembershipPlanRow);
export const updateMembershipPlan = async (key: string, payload: Partial<MembershipPlanRow>) =>
  unwrap<MembershipPlanRow>(await api.put(`/admin/super/membership/plans/${enc(key)}`, payload), {} as MembershipPlanRow);
/** Retire, never delete — a paid membership still points at the plan. */
export const retireMembershipPlan = async (key: string) =>
  unwrap<MembershipPlanRow>(await api.post(`/admin/super/membership/plans/${enc(key)}/retire`, {}), {} as MembershipPlanRow);
/**
 * Permanently delete a plan (website `deleteMembershipPlan`). The server refuses
 * with "… cannot be deleted …" when payments reference it — the caller then
 * offers `retireMembershipPlan`, as the website's Membership screen does.
 */
export const deleteMembershipPlan = async (key: string) =>
  unwrap<{ deleted: boolean; key: string; name: string; orders: number }>(
    await api.delete(`/admin/super/membership/plans/${enc(key)}`), { deleted: false, key, name: '', orders: 0 });
export const updateMembershipSettings = async (settings: { showAllPlans: boolean }) =>
  unwrap<{ showAllPlans: boolean }>(await api.put('/admin/super/membership/settings', settings), { showAllPlans: false });
export const alignMembershipBands = async () =>
  unwrap<{ changed: number }>(await api.post('/admin/super/membership/plans/align', {}), { changed: 0 });

/* ================================================================ PLATINUM */
export type PlatinumPaymentMode = 'cash' | 'cheque' | 'bank_transfer' | 'upi_offline' | 'other';
export const PAYMENT_MODE_LABEL: Record<PlatinumPaymentMode, string> = {
  cash: 'Cash', cheque: 'Cheque / DD', bank_transfer: 'Bank transfer', upi_offline: 'UPI to office', other: 'Other',
};
export type PlatinumRequestStatus = 'new' | 'contacted' | 'converted' | 'declined';
const PBASE = '/admin/super/membership/platinum';
export const getPlatinumOverview = async () =>
  unwrap<{ plan: { name: string; price: number; active: boolean }; members: any[] }>(
    await api.get(PBASE), { plan: { name: 'Platinum Lifetime', price: 0, active: true }, members: [] });
export const searchPlatinumCandidates = async (q: string) =>
  unwrap<any[]>(await api.get(`${PBASE}/search`, { params: { q } }), []);
export const grantPlatinum = async (memberId: string, body: {
  amount: number; paymentMode: PlatinumPaymentMode; receiptNumber?: string; receivedOn?: string; note?: string;
}) => unwrap<any>(await api.post(`${PBASE}/${enc(memberId)}`, body), null);
export const revokePlatinum = async (memberId: string) =>
  unwrap<any>(await api.delete(`${PBASE}/${enc(memberId)}`), null);
export const listPlatinumRequests = async (status?: string) =>
  unwrap<{ requests: any[]; counts: Record<string, number> }>(
    await api.get(`${PBASE}/requests`, { params: status ? { status } : {} }),
    { requests: [], counts: { new: 0, contacted: 0, converted: 0, declined: 0, all: 0 } });
export const getPlatinumRequestDetail = async (id: string) =>
  unwrap<any>(await api.get(`${PBASE}/requests/${enc(id)}`), null);
export const updatePlatinumRequest = async (id: string, body: { status?: PlatinumRequestStatus; notes?: string }) =>
  unwrap<any>(await api.patch(`${PBASE}/requests/${enc(id)}`, body), null);

/* =============================================================== DONATIONS */
export const getDonationSummary = async (fy?: string) =>
  unwrap<{ financialYears: string[]; fy: string; totalAmount: number; donationCount: number; donorCount: number; thisMonthAmount: number }>(
    await api.get('/admin/super/donations/summary', { params: clean({ fy }) }),
    { financialYears: [], fy: '', totalAmount: 0, donationCount: 0, donorCount: 0, thisMonthAmount: 0 });
export const listDonors = async (params: { fy?: string; q?: string; page?: number; limit?: number } = {}) =>
  unwrap<{ rows: any[]; total: number }>(await api.get('/admin/super/donations/donors', { params: clean(params) }), { rows: [], total: 0 });
export const getDonor = async (id: string) =>
  unwrap<{ donor: any; donations: any[]; byYear: { financialYear: string; total: number; count: number }[] }>(
    await api.get(`/admin/super/donations/donors/${enc(id)}`), { donor: null, donations: [], byYear: [] });
export const listDonations = async (params: { fy?: string; status?: string; page?: number; limit?: number } = {}) =>
  unwrap<{ rows: any[]; total: number }>(await api.get('/admin/super/donations', { params: clean(params) }), { rows: [], total: 0 });
export const resendDonationReceipt = async (id: string) =>
  unwrap<any>(await api.post(`/admin/super/donations/${enc(id)}/resend`, {}), {});
/** The donor documents are public web pages keyed by an unguessable token. */
export const WEB_ORIGIN = 'https://activ.org.in';
export const receiptUrl = (token?: string) => (token ? `${WEB_ORIGIN}/donate/receipt/${enc(token)}` : '');
export const statementUrl = (token?: string, fy?: string) =>
  (token ? `${WEB_ORIGIN}/donate/statement/${enc(token)}${fy ? `?fy=${enc(fy)}` : ''}` : '');
/** "2026-27" → "2026–27" */
export const fyLabel = (fy?: string) => String(fy || '').replace('-', '–');

/* ================================================================ BOOKINGS */
export const listBookingOverview = async (includeDrafts = false) =>
  unwrap<{ events: any[]; totals: any }>(
    await api.get('/events/bookings/overview', { params: includeDrafts ? { includeDrafts: 1 } : {} }),
    { events: [], totals: { events: 0, seats: 0, capacity: 0, bookings: 0, collected: 0, pending: 0 } });
export const listEventBookings = async (eventId: string, params: { page?: number; limit?: number; search?: string; paymentStatus?: string; status?: string } = {}) =>
  unwrap<{ bookings: any[]; summary: any; pagination: any }>(
    await api.get(`/events/${enc(eventId)}/bookings`, { params: clean({ page: params.page || 1, limit: params.limit || 50, ...params }) }),
    { bookings: [], summary: {}, pagination: {} });
export const listEventAttendees = async (eventId: string, params: { search?: string; paymentStatus?: string } = {}) =>
  unwrap<{ attendees: any[]; total: number; seatsBooked: number }>(
    await api.get(`/events/${enc(eventId)}/attendees`, { params: clean(params) }), { attendees: [], total: 0, seatsBooked: 0 });
export const recordBookingPayment = async (eventId: string, ref: string, mode = 'offline') =>
  unwrap<any>(await api.post(`/events/${enc(eventId)}/bookings/${enc(ref)}/record-payment`, { mode }), {});
export const cancelEventBooking = async (eventId: string, ref: string, reason = '') =>
  unwrap<any>(await api.post(`/events/${enc(eventId)}/bookings/${enc(ref)}/cancel`, { reason }), {});
/**
 * GET /events/:id/bookings/export — the same CSV the website downloads.
 * Fetched through the token-carrying instance (the route is admin-only) and
 * returned as TEXT, so the caller can hand it to the system share sheet
 * without a file-system native module. The name is derived like the website's.
 */
export const exportBookingsCsv = async (eventId: string, title = 'event') => {
  const res = await api.get(`/events/${enc(eventId)}/bookings/export`, {
    responseType: 'text',
    transformResponse: (raw: any) => raw,
  });
  const csv = typeof res?.data === 'string' ? res.data : String(res?.data ?? '');
  const filename = `${String(title || 'event')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .toLowerCase() || 'event'}-bookings.csv`;
  return { csv, filename };
};
export const listBookingPeople = async (search = '') =>
  unwrap<{ people: any[]; total: number }>(await api.get('/events/bookings/people', { params: search ? { search } : {} }), { people: [], total: 0 });
/**
 * The Event Bookings screen's event picker — the website's `listEvents({ limit: 200 })`
 * (GET /events). The server answers either a bare list or `{ events }`.
 */
export const listEventsForPicker = async () => {
  const data = unwrap<any>(await api.get('/events', { params: { limit: 200 } }), []);
  const rows: any[] = Array.isArray(data) ? data : (Array.isArray(data?.events) ? data.events : []);
  return rows
    .map((e) => ({
      id: String(e?.id || e?._id || ''),
      title: String(e?.title || '') || 'Untitled event',
      startAt: (e?.startAt || null) as string | null,
      registrationFee: Number(e?.registrationFee || 0),
      capacity: Number(e?.capacity || 0),
    }))
    .filter((e) => !!e.id);
};
export const getBookingPerson = async (email: string) =>
  unwrap<{ person: any; bookings: any[] }>(await api.get('/events/bookings/person', { params: { email } }), { person: null, bookings: [] });

/* ======================================================= EVENT CATEGORIES */
export type CategoryMode = 'both' | 'online' | 'offline';
export interface EventCategory { id: string; label: string; icon: string; mode: CategoryMode; order: number; managed: boolean; eventCount: number }
/** `moved` (rename: events re-filed) and `added` (standard list) come back on those writes only. */
export interface EventCategoryList { categories: EventCategory[]; missingStandard: string[]; standard: string[]; moved?: number; added?: string[] }
const EMPTY_CATS: EventCategoryList = { categories: [], missingStandard: [], standard: [] };
export const listEventCategories = async () => unwrap<EventCategoryList>(await api.get('/events/categories'), EMPTY_CATS);
export const addEventCategory = async (label: string, mode: CategoryMode = 'both', icon = '') =>
  unwrap<EventCategoryList>(await api.post('/events/categories', { label, icon, mode }), EMPTY_CATS);
/** An absent `mode` means "leave it alone" on the server. */
export const renameEventCategory = async (id: string, label: string, mode?: CategoryMode) =>
  unwrap<EventCategoryList>(await api.put(`/events/categories/${enc(id)}`, { label, ...(mode ? { mode } : {}) }), EMPTY_CATS);
export const deleteEventCategory = async (id: string) =>
  unwrap<EventCategoryList>(await api.delete(`/events/categories/${enc(id)}`), EMPTY_CATS);
export const moveEventCategory = async (id: string, direction: 'up' | 'down') =>
  unwrap<EventCategoryList>(await api.post(`/events/categories/${enc(id)}/move`, { direction }), EMPTY_CATS);
export const addStandardEventCategories = async () =>
  unwrap<EventCategoryList>(await api.post('/events/categories/standard', {}), EMPTY_CATS);

/* ================================================================= UPDATES */
export type UpdateCategory = 'general' | 'notice' | 'policy' | 'scheme' | 'achievement' | 'urgent';
export const listAnnouncementsAdmin = async () =>
  unwrap<{ announcements: any[]; total: number }>(await api.get('/announcements/admin'), { announcements: [], total: 0 });
export const createAnnouncement = async (payload: Record<string, any>) =>
  unwrap<any>(await api.post('/announcements', payload), {});
export const updateAnnouncement = async (id: string, payload: Record<string, any>) =>
  unwrap<any>(await api.put(`/announcements/${enc(id)}`, payload), {});
export const setAnnouncementStatus = async (id: string, status: 'draft' | 'published') =>
  unwrap<any>(await api.patch(`/announcements/${enc(id)}/status`, { status }), {});
export const deleteAnnouncement = async (id: string) =>
  unwrap<any>(await api.delete(`/announcements/${enc(id)}`), {});

/* =========================================================== NOTIFICATIONS */
export const listNotificationLogs = async (params: { page?: number; limit?: number; channel?: string; status?: string; event?: string; search?: string } = {}) =>
  unwrap<{ logs: any[]; health: { sent: number; failed: number; queued: number; mock: number; total: number }; pagination: any }>(
    await api.get('/notifications/logs', { params: clean(params) }),
    { logs: [], health: { sent: 0, failed: 0, queued: 0, mock: 0, total: 0 }, pagination: {} });
export const getDeliveryStatus = async () =>
  unwrap<{ email: any; whatsapp: any }>(await api.get('/notifications/delivery-status'), { email: {}, whatsapp: {} });
export const retryNotification = async (id: string) =>
  unwrap<any>(await api.post(`/notifications/retry/${enc(id)}`, {}), {});
export const testSendNotification = async (channel: 'email' | 'whatsapp', to: string) =>
  unwrap<any>(await api.post('/notifications/test-send', { channel, to }), {});
export const getRoutingPreview = async (region: { state?: string; district?: string; block?: string }) =>
  unwrap<any>(await api.get('/notifications/routing-preview', { params: clean(region) }), {});

/* ================================================================== EVENTS */
/** How many members a target list reaches (same query the website's editor runs). */
export const getEventReach = async (targets: { state: string; district: string; block: string }[], audience: 'all' | 'paid' = 'all') =>
  unwrap<{ members: number; excludedByAudience: number }>(
    await api.get('/events/reach', { params: { targets: JSON.stringify(targets || []), audience } }),
    { members: 0, excludedByAudience: 0 });

/* ============================================================ CMS EVENTS */
/**
 * Super Admin → Events is the website's `EventsManager` mounted with
 * `channel="members"`: the SAME endpoints the CMS uses — GET/POST /cms/events,
 * PUT/DELETE /cms/events/:id — with the banner and speaker photos uploaded
 * first through POST /cms/media and documents through POST /cms/attachments,
 * exactly as the website's MediaPicker / EventFilesEditor do. The event body
 * itself is JSON (the website passes no `image` file on this surface), with
 * `targets`, `days`, `agenda`, `speakers`, `attachments`, `registrationFields`
 * and `reminderOffsetsHours` JSON-encoded as the website sends them.
 */
export interface EventTarget { state: string; district: string; block: string }
export interface EventAgendaItem { startTime: string; endTime: string; title: string; description: string; speaker: string; location: string }
export interface EventDay { date: string; startTime: string; endTime: string; agenda: EventAgendaItem[] }
export interface EventSpeaker { name: string; role: string; organization: string; bio: string; photoUrl: string }
export interface EventAttachment { name: string; url: string; type?: string; size?: number }
export interface CmsEventMedia { url: string; type: 'image' | 'video'; alt: string; fit: 'cover' | 'contain'; position: string }
export interface CmsEventRow {
  id: string; slug?: string; title: string; description: string; startAt: string | null; endAt: string | null;
  location: string; venue?: string; state?: string; district?: string; block?: string;
  targets?: EventTarget[]; targetLabel?: string; reachEveryone?: boolean; showOnOnboarding?: boolean; showQrOnPage?: boolean;
  channel?: 'public' | 'members'; audience?: 'all' | 'paid'; imageUrl?: string; media?: CmsEventMedia;
  status?: 'draft' | 'published'; category?: string; mode?: 'online' | 'offline'; onlinePlatform?: string; onlineUrl?: string;
  agenda?: EventAgendaItem[]; days?: EventDay[]; speakers?: EventSpeaker[]; venueAddress?: string; venueMapUrl?: string;
  contactName?: string; contactPhone?: string; contactEmail?: string; registrationEnabled?: boolean;
  registrationDeadline?: string | null; capacity?: number; registrationFee?: number; memberFee?: number | null;
  registrationNote?: string; topic?: string; language?: string; registrationFields?: any[]; reminderOffsetsHours?: number[];
  attachments?: EventAttachment[]; videoUrl?: string; whatsappChannelUrl?: string;
}
export const EMPTY_EVENT_MEDIA: CmsEventMedia = { url: '', type: 'image', alt: '', fit: 'cover', position: 'center' };

/** EVERY event, for the editor: drafts, members-only, targeted. Throws on failure. */
export const listCmsEventsForEditor = async (): Promise<CmsEventRow[]> => {
  const list = unwrap<any>(await api.get('/cms/events'), []);
  return Array.isArray(list) ? list : [];
};
export const createCmsEvent = async (payload: Record<string, any>) =>
  unwrap<any>(await api.post('/cms/events', payload), null);
export const updateCmsEvent = async (id: string, payload: Record<string, any>) =>
  unwrap<any>(await api.put(`/cms/events/${enc(id)}`, payload), null);
export const deleteCmsEvent = async (id: string) =>
  unwrap<any>(await api.delete(`/cms/events/${enc(id)}`), null);

/** The category list the website's event form offers (with online/offline `mode`). */
export const getEventsSettingsCategories = async () => {
  const data = unwrap<any>(await api.get('/cms/events-settings'), {});
  const list = Array.isArray(data?.categories) ? data.categories : [];
  return list
    .map((c: any) => ({ label: String(c?.label || ''), mode: (String(c?.mode || 'both') as CategoryMode) }))
    .filter((c: { label: string }) => !!c.label);
};

/** A picked file as React Native's FormData expects it. */
const filePart = (asset: { uri?: string; type?: string; fileName?: string; name?: string }, fallbackName: string) => ({
  uri: String(asset?.uri || ''),
  type: String(asset?.type || 'application/octet-stream'),
  name: String(asset?.fileName || asset?.name || fallbackName),
} as any);

/** POST /cms/media — the banner and speaker photos. Returns the site-relative url. */
export const uploadCmsMedia = async (asset: { uri?: string; type?: string; fileName?: string }) => {
  const form = new FormData();
  form.append('file', filePart({ type: 'image/jpeg', ...asset }, 'image.jpg'));
  const data = unwrap<any>(await api.post('/cms/media', form, { headers: { 'Content-Type': 'multipart/form-data' } }), {});
  return { url: String(data?.url || ''), type: (data?.type === 'video' ? 'video' : 'image') as 'image' | 'video' };
};

/** POST /cms/attachments — an event document (sent to the people who book). */
export const uploadEventAttachment = async (asset: { uri?: string; type?: string; fileName?: string; fileSize?: number }) => {
  const form = new FormData();
  form.append('file', filePart(asset, 'document'));
  const data = unwrap<any>(await api.post('/cms/attachments', form, { headers: { 'Content-Type': 'multipart/form-data' } }), {});
  return {
    url: String(data?.url || ''),
    name: String(data?.name || asset?.fileName || 'Document'),
    type: String(data?.type || asset?.type || ''),
    size: Number(data?.size || asset?.fileSize || 0),
  } as EventAttachment;
};

/** The event's public address, built like the website's `eventPath`. */
export const eventPublicUrl = (e?: { id?: string; slug?: string } | null) =>
  `${WEB_ORIGIN}/events/${enc(String(e?.slug || e?.id || ''))}`;

export const errorText = (err: any, fallback = 'Something went wrong. Please try again.') => {
  if (!err?.response) return 'Cannot reach the server. Check your internet connection.';
  return String(err?.response?.data?.message || err?.message || fallback);
};

/* ======================================================= SITE STAFF ACCOUNTS */
/**
 * The CMS admin and the events admin. The Super Admin maintains their
 * credentials — name, email, phone, active, and a new password. The server
 * refuses super admin and tier-admin records on this path whatever id is sent.
 * Same endpoints as the website's `listStaffAccounts` / `updateStaffAccount`.
 */
export interface StaffAccount {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: string;
  roleLabel: string;
  active: boolean;
  lastLoginAt: string | null;
  updatedAt: string | null;
}

/** GET /admin/super/staff-accounts */
export const listStaffAccounts = async (): Promise<StaffAccount[]> => {
  const data = unwrap<any>(await api.get('/admin/super/staff-accounts'), {});
  return Array.isArray(data?.accounts) ? data.accounts : [];
};

/** PUT /admin/super/staff-accounts/:id — `password` only when setting a new one. */
export const updateStaffAccount = async (
  id: string,
  payload: { fullName?: string; email?: string; phoneNumber?: string; active?: boolean; password?: string },
) => unwrap<{ account?: StaffAccount; changed?: string[] }>(
  await api.put(`/admin/super/staff-accounts/${enc(String(id || ''))}`, payload),
  {},
);
