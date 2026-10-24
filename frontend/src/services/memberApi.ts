import { isPastEvent } from '../utils/eventLifecycle';
import { withEventAgenda } from '../utils/eventAgenda';
import api from './api';
import publicApi from './publicApi';
import { unwrap, asArray } from '../ui';

/**
 * ============================================================================
 * MEMBER AREA — every call the member screens make, in one place
 * ============================================================================
 *
 * Same backend, same endpoints, same bodies as the website
 * (website/src/services/memberHubApi.ts, activApi.ts, eventBookingApi.ts).
 * Nothing here sends a price: the server prices every booking and payment.
 */

/* ------------------------------------------------------------------ profile */

export const getMyProfile = async () => unwrap<any>(await api.get('/members/my-profile'), {});
export const getBusinessInfo = async () => unwrap<any>(await api.get('/members/business-info'), {});
export const getFinancialInfo = async () => unwrap<any>(await api.get('/members/financial-info'), {});
export const getDeclarationInfo = async () => unwrap<any>(await api.get('/members/declaration-info'), {});
export const updateProfile = async (fields: Record<string, any>) => unwrap<any>(await api.put('/members/profile', fields), {});

/**
 * Profile photo — the website's uploadProfilePhoto exactly: multipart field
 * `profilePhoto` to POST /members/profile-photo. The server stores it and
 * answers `{ profilePhoto }` (the stored `/uploads/…` path) — that path, never
 * the phone's local file URI, is what the profile holds.
 */
export const uploadProfilePhoto = async (uri: string, type = 'image/jpeg', name = 'profile.jpg'): Promise<string> => {
  const form = new FormData();
  form.append('profilePhoto', { uri, type: type || 'image/jpeg', name: name || 'profile.jpg' } as any);
  const d = unwrap<any>(await api.post('/members/profile-photo', form, { headers: { 'Content-Type': 'multipart/form-data' } }), {});
  const value = String(d?.profilePhoto || d?.url || '');
  if (!value) throw new Error('The photo could not be saved. Please try again.');
  return value;
};

export const changePassword = async (oldPassword: string, newPassword: string) =>
  unwrap<any>(await api.post('/auth/change-password', { oldPassword, newPassword }), {});

export const setFirstPassword = async (newPassword: string, confirmPassword: string) =>
  unwrap<any>(await api.post('/auth/set-password', { newPassword, confirmPassword }), {});

export const logoutOnServer = async () => {
  try { await api.post('/auth/logout'); } catch { /* signing out locally is what matters */ }
};

/** The member's own feed — application, approval and payment events. */
export const getRecentActivity = async (limit = 8) =>
  asArray<any>(unwrap<any>(await api.get('/members/recent-activity', { params: { limit } }), {})?.activities);

/** The member's applications, newest first (each with `tierReviews`, `outcome`). */
export const getMyApplications = async () => {
  const d = unwrap<any>(await api.get('/applications/my-applications'), []);
  return Array.isArray(d) ? d : asArray<any>(d?.applications);
};

/** ACTIV-APP-2026-3F9A21 — the website's formatApplicationRef, exactly. */
export const formatApplicationRef = (application: any): string => {
  const full = String(application?._id || application?.applicationId || application?.id || '');
  if (!full) return '';
  const assigned = String(application?.applicationNumber || '').trim();
  if (assigned) return assigned;
  let year = 0;
  for (const v of [application?.submittedAt, application?.createdAt, application?.appliedAt]) {
    if (!v) continue;
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) { year = d.getFullYear(); break; }
  }
  if (!year && /^[0-9a-f]{24}$/i.test(full)) {
    const seconds = parseInt(full.slice(0, 8), 16);
    if (seconds > 0) year = new Date(seconds * 1000).getFullYear();
  }
  if (!year) year = new Date().getFullYear();
  return `ACTIV-APP-${year}-${full.slice(-6).toUpperCase()}`;
};

/** Paid by the website's rule: active/completed and the renewal not expired. */
export const isPaidMember = (profile: any) => {
  const status = String(profile?.membershipStatus || '').toLowerCase();
  if (String(profile?.renewal?.state || '') === 'expired') return false;
  return status === 'active' || status === 'completed';
};

/* ------------------------------------------------------------------ plans / platinum */

/** { plans, matched, years, reason, showAllPlans } for THIS member. */
export const getMyPlans = async () =>
  unwrap<any>(await api.get('/membership/plans/mine'), { plans: [], matched: null });

export const getPlatinumRequest = async () =>
  unwrap<any>(await api.get('/membership/platinum/request'), { request: null, isPlatinum: false });

export const requestPlatinum = async (body: { preferredContact: 'call' | 'whatsapp' | 'email'; preferredTime?: string; message?: string }) =>
  unwrap<any>(await api.post('/membership/platinum/request', body), {});

/**
 * The Platinum price, from the plan the Super Admin keeps (the website's
 * usePlatinumPrice: GET /membership/plans?include=platinum). Null when the plan
 * is retired or unpriced — the offer is then not shown at all.
 */
export const getPlatinumPrice = async (): Promise<number | null> => {
  const body = unwrap<any>(await api.get('/membership/plans', { params: { include: 'platinum' } }), {});
  const rows: any[] = Array.isArray(body) ? body : asArray<any>(body?.plans);
  const row = rows.find((r) => r && (r.audience === 'platinum' || r.key === 'platinum' || r.id === 'platinum')
    && r.active !== false && r.isActive !== false);
  const value = row ? Number(row.price ?? row.amount ?? (row.amountPaise ? row.amountPaise / 100 : 0)) : 0;
  return value > 0 ? value : null;
};

/* ------------------------------------------------------------------ directory */

export const searchDirectory = async (filters: Record<string, any> = {}) =>
  unwrap<any>(await api.get('/members/directory', { params: filters }), { members: [], pagination: { total: 0, pages: 0 } });

export const getDirectorySectors = async () =>
  asArray<string>(unwrap<any>(await api.get('/members/directory/sectors'), {})?.sectors);

export const getDirectoryEntry = async (id: string) =>
  unwrap<any>(await api.get(`/members/directory/${encodeURIComponent(id)}`), null);

/* ------------------------------------------------------------------ messages */

export const listConversations = async () =>
  unwrap<any>(await api.get('/messages'), { conversations: [], unreadTotal: 0 });

export const getUnreadMessages = async () =>
  Number(unwrap<any>(await api.get('/messages/unread-count'), {})?.unread || 0);

/** Open (or create) the thread with another member → the conversation. */
export const openConversationWith = async (memberId: string) =>
  unwrap<any>(await api.post(`/messages/with/${encodeURIComponent(memberId)}`), {});

export const getThread = async (conversationId: string, before?: string) =>
  unwrap<any>(await api.get(`/messages/${encodeURIComponent(conversationId)}`, { params: before ? { before } : {} }),
    { conversation: null, messages: [], hasMore: false });

export const sendMessage = async (conversationId: string, body: string, attachmentUrl = '', attachment?: { token?: string }) =>
  unwrap<any>(await api.post(`/messages/${encodeURIComponent(conversationId)}`, { body, attachmentUrl, ...(attachment?.token ? { attachment: { token: attachment.token } } : {}) }), {});

export const deleteMessage = async (conversationId: string, messageId: string, scope: 'me' | 'everyone') =>
  unwrap<any>(await api.delete(`/messages/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`, { data: { scope } }), {});

export const getMessageStatuses = async (conversationId: string, ids: string[]) => {
  const result: Array<{ id: string; hidden: boolean; deleted: boolean; readAt: string | null }> = [];
  for (let offset = 0; offset < ids.length; offset += 500) {
    result.push(...unwrap<any[]>(await api.post(`/messages/${encodeURIComponent(conversationId)}/message-status`, { ids: ids.slice(offset, offset + 500) }), []));
  }
  return result;
};

export const markConversationRead = async (conversationId: string) => {
  try { await api.post(`/messages/${encodeURIComponent(conversationId)}/read`); } catch { /* best effort */ }
};

/** Upload a picture for a message (field `image`) → { url }. Sends nothing by itself. */
export const uploadMessageImage = async (uri: string, type = 'image/jpeg', name = 'photo.jpg') => {
  const form = new FormData();
  form.append('image', { uri, type, name } as any);
  return unwrap<any>(await api.post('/messages/attachment', form, { headers: { 'Content-Type': 'multipart/form-data' } }), {});
};

export const uploadMessageAttachment = async (file: { uri: string; type: string; name: string }, onProgress?: (percent: number) => void) => {
  const form = new FormData();
  form.append('file', file as any);
  return unwrap<any>(await api.post('/messages/attachment', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: event => { if (event.total) onProgress?.(Math.min(99, Math.round(event.loaded * 100 / event.total))); },
  }), {});
};

/* ------------------------------------------------------------------ events */

export const listMemberEvents = async (params: Record<string, any> = {}) =>
  unwrap<any>(await api.get('/events', { params }), { events: [], total: 0 });

export const getMemberEvent = async (id: string) => {
  const event = unwrap<any>(await api.get(`/events/${encodeURIComponent(id)}`), null);
  return withEventAgenda(event);
};

export const listMyEventRegistrations = async () => {
  const d = unwrap<any>(await api.get('/events/my-registrations'), []);
  return Array.isArray(d) ? d : asArray<any>(d?.registrations);
};

/** Register for a FREE event (the website's legacy /register path). */
export const registerForEvent = async (id: string, details: Record<string, any> = {}) =>
  unwrap<any>(await api.post(`/events/${encodeURIComponent(id)}/register`, details), {});

export const cancelEventRegistration = async (id: string) =>
  unwrap<any>(await api.delete(`/events/${encodeURIComponent(id)}/register`), {});

/**
 * Settle the fee on a HELD legacy seat (website payForEvent →
 * POST /events/:id/register/pay { method }). Sends no amount: the server reads
 * the figure it copied onto the seat when it was held. Idempotent.
 */
export const payForEvent = async (id: string, details: { method: 'upi' | 'card' | 'netbanking' }) =>
  unwrap<any>(await api.post(`/events/${encodeURIComponent(id)}/register/pay`, details), {});

/** A product looked at in the directory (website recordProductView). Never throws. */
export const recordProductView = async (id: string): Promise<void> => {
  try { await api.post(`/products/${encodeURIComponent(id)}/view`, {}); } catch { /* a missed view is not worth a message */ }
};

/** The event as the booking page needs it: price for THIS caller, seats left, closed. */
export const getBookableEvent = async (eventId: string, guest = false) =>
  unwrap<any>(await (guest ? publicApi : api).get(`/event-bookings/event/${encodeURIComponent(eventId)}`), null);

/** "Already booked / entered twice" check without writing anything. */
export const checkEventBooking = async (eventId: string, body: Record<string, any>, guest = false) =>
  unwrap<any>(await (guest ? publicApi : api).post(`/event-bookings/event/${encodeURIComponent(eventId)}/check`, body), {});

/** Take a booking. Sends NO amount — the server prices it. */
export const createEventBooking = async (eventId: string, body: {
  name: string; email: string; phone: string; noOfPersons: number;
  participants: { name: string; email: string; phone: string }[]; note?: string; useBookerForFirstParticipant?: boolean;
  responses?: Record<string, string | boolean>;
}, guest = false) => unwrap<any>(await (guest ? publicApi : api).post(`/event-bookings/event/${encodeURIComponent(eventId)}`, body), {});

export const getEventBooking = async (ref: string) =>
  unwrap<any>(await api.get(`/event-bookings/${encodeURIComponent(ref)}`), null);

/** Registration gate — the website's eventFormat.registrationGate. */
export const registrationGate = (event: any): { open: boolean; reason: string } => {
  if (!event?.registrationEnabled) return { open: false, reason: 'Registration is not open for this event' };
  if (event?.archivedAt || isPastEvent(event)) return { open: false, reason: 'This event has finished' };
  const closes = event?.registrationClosesAt ? new Date(event.registrationClosesAt) : null;
  if (closes && !Number.isNaN(closes.getTime()) && closes.getTime() <= Date.now()) {
    return { open: false, reason: 'Registration has closed' };
  }
  return { open: true, reason: '' };
};

/*
 * Seats left: NOT computed here. `registeredCount` on /events counts only the
 * legacy one-seat registrations and misses every /event-bookings booking, so
 * `capacity - registeredCount` printed "500 of 500 left" on a booked event.
 * Read seats through screens/member/events/eventSeats.ts (the booking system).
 */

/* ------------------------------------------------------------------ updates, notifications */

export const listAnnouncements = async (params: Record<string, any> = {}) =>
  unwrap<any>(await api.get('/announcements', { params }), { announcements: [], total: 0 });

export const getAnnouncement = async (id: string) =>
  unwrap<any>(await api.get(`/announcements/${encodeURIComponent(id)}`), null);

export const listNotifications = async (params: Record<string, any> = {}) => {
  const d = unwrap<any>(await api.get('/notifications', { params }), []);
  return Array.isArray(d) ? d : asArray<any>(d?.notifications);
};

export const markNotificationRead = async (id: string) => {
  try { await api.patch(`/notifications/${encodeURIComponent(id)}/read`); } catch { /* best effort */ }
};

export const markAllNotificationsRead = async () =>
  unwrap<any>(await api.patch('/notifications/read-all'), {});

/* ------------------------------------------------------------------ certificates, help */

/** kind: 'membership' | 'tax-exemption'. Throws 403 until the membership is active. */
export const getCertificate = async (kind: 'membership' | 'tax-exemption') =>
  unwrap<any>(await api.get(`/members/certificate/${kind}`), null);

/** The association's public contact details (GET /cms/contact-info). */
export const getContactInfo = async () => unwrap<any>(await api.get('/cms/contact-info'), {});

/** Help & Support → the CMS inbox, marked as coming from the member dashboard (by token). */
export const sendHelpMessage = async (body: {
  name: string; email: string; phone?: string; subject: string; message: string; applicationRef?: string;
}) => unwrap<any>(await api.post('/cms/contact-messages', body), {});

/* ------------------------------------------------------------------ business (for dashboards only) */

export const listMyCompanies = async () => {
  const d = unwrap<any>(await api.get('/business-profiles/all'), []);
  return Array.isArray(d) ? d : asArray<any>(d?.companies || d?.profiles);
};
