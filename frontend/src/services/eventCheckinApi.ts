import { fetchSpreadsheet } from './spreadsheetDownload';
import { Platform } from 'react-native';
import api from './api';

/**
 * ============================================================================
 * EVENT CHECK-IN — the events staff's door, over /event-checkin
 * ============================================================================
 *
 * The attendee's confirmation email carries one QR per seat. The QR is a URL
 * (`https://activ.org.in/checkin/<token>`): an ordinary camera opens a
 * harmless website page; only this app, signed in as the events admin (or the
 * super admin), turns it into a name and lets the holder in.
 *
 *   lookup  -> never writes. What the staff see after a scan.
 *   admit   -> "Allow entry". Idempotent on the server: a second scan or a
 *              second gate answers `already_checked_in`, never a second row.
 *
 * Same endpoints as the website's Attendance screen. All calls go through the
 * shared axios instance (timeout, token) — CLAUDE.md Rule 3.
 */

export type CheckinReasonCode =
  | 'not_found' | 'cancelled' | 'waitlist' | 'expired' | 'unpaid' | 'no_seat' | 'wrong_event' | string;

export interface CheckinSeat {
  registrationNo: string;
  bookingRef: string;
  participantIndex: number;
  participantNumber: number;
  seats: number;
  attendee: { name: string; phoneMasked: string };
  bookedBy: { name: string };
  isGuest: boolean;
  event: { id: string; title: string; startAt: string | null; endAt: string | null; venue: string; mode: string; category: string };
  ticket: { category: string; label: string; unitAmount: number };
  payment: { status: string; label: string; mode: string };
  bookingStatus: string;
  admissible: boolean;
  reason: { code: CheckinReasonCode; message: string } | null;
  eventIsToday: boolean;
  checkedIn: boolean;
  checkin: {
    id: string;
    admittedAt: string | null;
    admittedAtLabel: string;
    admittedBy: { name: string; email: string; role: string };
    method: string;
  } | null;
}

export interface CheckinEvent {
  id: string;
  title: string;
  startAt: string | null;
  endAt: string | null;
  venue: string;
  mode: string;
  category: string;
  slug: string;
  isToday: boolean;
  registered: number;
  checkedIn: number;
}

export interface AttendanceRow {
  registrationNo: string;
  bookingRef: string;
  participantNumber: number;
  name: string;
  phoneMasked: string;
  bookedBy: string;
  payment: string;
  bookingStatus: string;
  checkedIn: boolean;
  admittedAt: string | null;
  admittedAtLabel: string;
  admittedBy: string;
  method: string;
  /** Super admin only — the server leaves these empty for the events admin. */
  email?: string;
  phone?: string;
  admittedByEmail?: string;
}

export interface Attendance {
  event: { id: string; title: string; startAt: string | null; venue: string };
  totals: { registered: number; checkedIn: number; notYet: number; percent: number };
  /** True only for the super admin: rows then carry email and phone. */
  includeContact?: boolean;
  rows: AttendanceRow[];
}

const payloadOf = (res: any) => res?.data?.data ?? res?.data ?? null;

/** The token out of a scanned string: the pass URL (any host) or a bare token. '' if it is not a pass. */
export const extractPassToken = (raw?: string | null): string => {
  const text = String(raw || '').trim();
  if (!text) return '';
  const m = text.match(/\/checkin\/([A-Za-z0-9_-]{40})(?:[/?#]|$)/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{40}$/.test(text) ? text : '';
};

/** A short description of this phone for the audit trail ("Android 15"). */
export const deviceLabel = (): string => {
  try {
    return `ACTIV app · ${Platform.OS === 'ios' ? 'iOS' : 'Android'} ${String(Platform.Version ?? '')}`.trim();
  } catch {
    return 'ACTIV app';
  }
};

/** Why a call failed, in the server's own words when it gave some. */
export const checkinErrorMessage = (err: any, fallback: string): string => {
  if (err?.response?.data?.message) return String(err.response.data.message);
  if (!err?.response) return 'Cannot reach the server. Check the internet connection and try again.';
  return fallback;
};

export const listCheckinEvents = async (scope: 'upcoming' | 'past' = 'upcoming'): Promise<CheckinEvent[]> => {
  const res = await api.get('/event-checkin/events', { params: { scope } });
  const data = payloadOf(res);
  return Array.isArray(data) ? data : [];
};

export interface LookupInput {
  /** The scanned text (pass URL or token). */
  token?: string;
  /** A registration no (`…-P2`) or a booking ID, as typed at the desk. */
  registrationNo?: string;
  bookingRef?: string;
  participantIndex?: number;
  /** The event the door is for — a pass for another event is refused. */
  eventId?: string;
}

export const lookupPass = async (input: LookupInput): Promise<{ method: string; bookingRef: string; seats: CheckinSeat[] }> => {
  const res = await api.post('/event-checkin/lookup', input || {});
  const data = payloadOf(res) || {};
  return {
    method: String(data?.method || ''),
    bookingRef: String(data?.bookingRef || ''),
    seats: Array.isArray(data?.seats) ? data.seats : [],
  };
};

export const admitSeat = async (
  input: LookupInput & { method?: 'qr' | 'manual' },
): Promise<{ outcome: 'admitted' | 'already_checked_in'; seat: CheckinSeat | null }> => {
  const res = await api.post('/event-checkin/admit', { ...(input || {}), device: deviceLabel() });
  const data = payloadOf(res) || {};
  return {
    outcome: data?.outcome === 'admitted' ? 'admitted' : 'already_checked_in',
    seat: data?.seat || null,
  };
};

export const getAttendance = async (eventId: string, params: { q?: string; status?: 'all' | 'in' | 'out' } = {}): Promise<Attendance> => {
  const res = await api.get(`/events/${encodeURIComponent(String(eventId || ''))}/attendance`, {
    params: {
      ...(params?.q ? { q: params.q } : {}),
      ...(params?.status && params.status !== 'all' ? { status: params.status } : {}),
    },
  });
  const data = payloadOf(res) || {};
  return {
    event: data?.event || { id: String(eventId || ''), title: '', startAt: null, venue: '' },
    totals: { registered: 0, checkedIn: 0, notYet: 0, percent: 0, ...(data?.totals || {}) },
    includeContact: !!data?.includeContact,
    rows: Array.isArray(data?.rows) ? data.rows : [],
  };
};

/* ============================================================================
 * ATTENDANCE EXPORT — GET /events/:id/attendance/export
 * ============================================================================
 * The same Excel workbook as the website, saved through the Files picker. The server decides
 * the columns by role: masked numbers for the events admin, email and phone
 * for the super admin.
 */
export const exportAttendanceCsv = async (eventId: string, _title = 'event') =>
  fetchSpreadsheet('/events/' + encodeURIComponent(String(eventId || '')) + '/attendance/export');


/* ============================================================================
 * THE PROGRAMME — GET /cms/events (the website editor's list)
 * ============================================================================
 * The events admin's dashboard counts: every event, drafts included (the
 * server shows this role drafts), the same list the website's Events
 * Dashboard reads. Only the fields a count needs are kept.
 */
export interface ProgrammeEvent {
  id: string;
  title: string;
  status: string;
  startAt: string | null;
  endAt: string | null;
  venue: string;
}

export const listProgrammeEvents = async (): Promise<ProgrammeEvent[]> => {
  const res = await api.get('/cms/events');
  const data = payloadOf(res);
  const list = Array.isArray(data) ? data : Array.isArray(data?.events) ? data.events : [];
  return list.map((e: any) => ({
    id: String(e?.id || e?._id || ''),
    title: String(e?.title || ''),
    status: String(e?.status || ''),
    startAt: e?.startAt || null,
    endAt: e?.endAt || null,
    venue: String(e?.venue || ''),
  }));
};

/** Undated events are not past — a missing date is missing information (CLAUDE.md). */
export const isUpcomingEvent = (
  e: { startAt?: string | null; endAt?: string | null } | null | undefined,
  now = Date.now(),
): boolean => {
  if (!e?.startAt) return true;
  const at = new Date(e?.endAt || e?.startAt || '').getTime();
  return Number.isNaN(at) ? true : at >= now;
};

export const programmeCounts = (list: ProgrammeEvent[] | null | undefined, now = Date.now()) => {
  const rows = Array.isArray(list) ? list : [];
  const published = rows.filter((e) => (e?.status || '') === 'published').length;
  return {
    all: rows.length,
    published,
    drafts: rows.length - published,
    upcoming: rows.filter((e) => isUpcomingEvent(e, now)).length,
  };
};

/* ============================================================================
 * DOOR BOOKINGS — the attendance rows, one card per booking
 * ============================================================================
 * The events admin is refused /events/:id/bookings (BOOKING_VIEWERS is the
 * super admin alone — the takings and every attendee's contact details). What
 * the door DOES get is the attendance list: every admissible seat with its
 * booking ID, booker and payment label. Grouping those seats by booking gives
 * the desk its "who is in this party" view without asking the server for
 * anything this role may not see. No amounts, no contact details.
 */
export interface DoorBooking {
  bookingRef: string;
  bookedBy: string;
  payment: string;
  bookingStatus: string;
  seats: number;
  checkedIn: number;
  names: string[];
  lastAdmittedAt: string | null;
}

export const groupDoorBookings = (rows: AttendanceRow[] | null | undefined): DoorBooking[] => {
  const map = new Map<string, DoorBooking>();
  (Array.isArray(rows) ? rows : []).forEach((r) => {
    const ref = String(r?.bookingRef || '').trim();
    if (!ref) return;
    const b: DoorBooking = map.get(ref) || {
      bookingRef: ref, bookedBy: '', payment: '', bookingStatus: '', seats: 0, checkedIn: 0, names: [], lastAdmittedAt: null,
    };
    b.seats += 1;
    if (r?.checkedIn) {
      b.checkedIn += 1;
      const at = r?.admittedAt || null;
      if (at && (!b.lastAdmittedAt || new Date(at).getTime() > new Date(b.lastAdmittedAt).getTime())) b.lastAdmittedAt = at;
    }
    if (!b.bookedBy && r?.bookedBy) b.bookedBy = String(r.bookedBy);
    if (!b.payment && r?.payment) b.payment = String(r.payment);
    // A live seat's status wins over a 'changed' (walked in, booking since altered) one.
    const st = String(r?.bookingStatus || '');
    if (!b.bookingStatus || (b.bookingStatus === 'changed' && st && st !== 'changed')) b.bookingStatus = st || 'active';
    if (r?.name) b.names.push(String(r.name));
    map.set(ref, b);
  });
  return Array.from(map.values())
    .sort((a, b) => String(a.bookedBy || a.bookingRef).localeCompare(String(b.bookedBy || b.bookingRef)));
};

export type DoorFilter = 'all' | 'waiting' | 'partial' | 'in';

export const doorStateOf = (b: DoorBooking | null | undefined): Exclude<DoorFilter, 'all'> => {
  const seats = Number(b?.seats || 0);
  const inside = Number(b?.checkedIn || 0);
  if (seats > 0 && inside >= seats) return 'in';
  return inside > 0 ? 'partial' : 'waiting';
};

export const filterDoorBookings = (
  list: DoorBooking[] | null | undefined,
  query: string,
  filter: DoorFilter,
): DoorBooking[] => {
  const needle = String(query || '').trim().toLowerCase();
  return (Array.isArray(list) ? list : []).filter((b) => {
    if (filter !== 'all' && doorStateOf(b) !== filter) return false;
    if (!needle) return true;
    return [b?.bookingRef, b?.bookedBy, ...(b?.names || [])].some((v) => String(v || '').toLowerCase().includes(needle));
  });
};

/** Every seat on one booking, with its check-in state — POST /event-checkin/lookup by booking ID. Never writes. */
export const lookupBooking = (bookingRef: string, eventId?: string) =>
  lookupPass({ bookingRef: String(bookingRef || '').trim(), ...(eventId ? { eventId } : {}) });
