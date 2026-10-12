import { downloadSpreadsheet } from './spreadsheetDownload';
import api, { unwrap } from './api';
import { API_BASE_URL } from '@/config/api.config';

/**
 * Event check-in — entry passes and who came through the door.
 *
 * Two audiences, deliberately in one module because they read the same pass:
 *
 *   - the PUBLIC pass page (`/checkin/:token`), opened by any phone camera.
 *     It learns only that the pass is ACTIV's, for which event, and whether it
 *     is still valid. It never marks attendance.
 *   - the super admin / events admin ATTENDANCE screens.
 *
 * Marking attendance happens only in the ACTIV mobile app, by signed-in events
 * staff (POST /event-checkin/admit). Nothing on the website writes a check-in.
 */

export interface PublicPass {
    valid: boolean;
    event: { title: string; startAt: string | null; endAt: string | null; venue: string; mode: string };
}

export const getPublicPass = async (token: string) =>
    unwrap<PublicPass | null>(await api.get(`/event-checkin/pass/${encodeURIComponent(token)}`), null);

/** The QR image for a pass — an <img src>, no token needed (the pass IS the token). */
export const passQrImageUrl = (token: string) =>
    `${API_BASE_URL}/event-checkin/qr/${encodeURIComponent(token)}.png`;

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

export const listCheckinEvents = async (scope: 'upcoming' | 'past' = 'upcoming') =>
    unwrap<CheckinEvent[]>(await api.get('/event-checkin/events', { params: { scope } }), []);

export interface AttendanceRow {
    registrationNo: string;
    bookingRef: string;
    participantNumber: number;
    name: string;
    /** Super admin only; empty for the events admin. */
    email: string;
    phone: string;
    phoneMasked: string;
    bookedBy: string;
    payment: string;
    /** 'changed' = checked in, and the booking was cancelled or edited afterwards. */
    bookingStatus: string;
    checkedIn: boolean;
    admittedAt: string | null;
    admittedAtLabel: string;
    admittedBy: string;
    admittedByEmail: string;
    method: '' | 'qr' | 'manual';
}

export interface Attendance {
    event: { id: string; title: string; startAt: string | null; endAt: string | null; venue: string; mode: string; category: string };
    totals: { registered: number; checkedIn: number; notYet: number; percent: number };
    includeContact: boolean;
    rows: AttendanceRow[];
}

const EMPTY_ATTENDANCE: Attendance = {
    event: { id: '', title: '', startAt: null, endAt: null, venue: '', mode: 'offline', category: '' },
    totals: { registered: 0, checkedIn: 0, notYet: 0, percent: 0 },
    includeContact: false,
    rows: [],
};

export const getAttendance = async (eventId: string, params: { q?: string; status?: 'all' | 'in' | 'out' } = {}) =>
    unwrap<Attendance>(
        await api.get(`/events/${encodeURIComponent(eventId)}/attendance`, {
            params: {
                ...(params.q ? { q: params.q } : {}),
                ...(params.status && params.status !== 'all' ? { status: params.status } : {}),
            },
        }),
        EMPTY_ATTENDANCE,
    );

/** Download the role-filtered attendance workbook. */
export const exportAttendanceCsv = async (eventId: string, title = 'event') =>
    downloadSpreadsheet('/events/' + encodeURIComponent(eventId) + '/attendance/export', title + '-attendance.xlsx');
