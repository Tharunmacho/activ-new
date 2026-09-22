import api, { unwrap } from './api';
import { ENDPOINTS } from '@/config/api.config';
import type { EventBooking } from './eventBookingApi';

/**
 * The organiser's side of the public "Book Now" bookings.
 *
 * Separate from `eventBookingApi` because the two are separate on the server for
 * a reason worth keeping visible at the call site: taking a booking is something
 * a stranger does on an unauthenticated endpoint, and reading everybody's name,
 * mobile number and what they paid is super-admin only, behind a token, under
 * `/events`. One module holding both would make it easy to reach for an admin
 * call from a public page and only find out from a 401 in production.
 *
 * `EventBooking` itself IS shared — it is the same row, and two interfaces for
 * one document is how a field ends up rendered on one screen and missing on the
 * other.
 */

/** Whole-event totals. Computed over every booking, never over the page. */
export interface BookingSummary {
    /** Bookings, not seats. */
    bookings: number;
    /** Seats — the sum of `noOfPersons`, which is what fills the room. */
    seats: number;
    /** Rupees actually received. */
    collected: number;
    /** Rupees owed on bookings that were never completed. Not takings. */
    pending: number;
    paidBookings: number;
    pendingBookings: number;
}

export interface BookingPage {
    bookings: EventBooking[];
    summary: BookingSummary;
    pagination: { page: number; limit: number; total: number; pages: number };
}

const EMPTY_PAGE: BookingPage = {
    bookings: [],
    summary: {
        bookings: 0, seats: 0, collected: 0, pending: 0,
        paidBookings: 0, pendingBookings: 0,
    },
    pagination: { page: 1, limit: 10, total: 0, pages: 1 },
};

/** One page of an event's bookings, plus the whole event's totals. */
export const listEventBookings = async (
    eventId: string,
    params: {
        page?: number;
        limit?: number;
        search?: string;
        paymentStatus?: '' | 'paid' | 'pending' | 'not_required' | 'failed';
        status?: '' | 'active' | 'cancelled';
    } = {},
) =>
    unwrap<BookingPage>(
        await api.get(ENDPOINTS.EVENTS.BOOKINGS(eventId), {
            params: {
                page: params.page || 1,
                limit: params.limit || 10,
                // Empty strings are dropped rather than sent. The server reads
                // `paymentStatus=''` as a filter for the empty status and
                // returns nothing, which reads on screen as "no bookings" for
                // an event that has plenty.
                ...(params.search ? { search: params.search } : {}),
                ...(params.paymentStatus ? { paymentStatus: params.paymentStatus } : {}),
                ...(params.status ? { status: params.status } : {}),
            },
        }),
        EMPTY_PAGE,
    );

/** One booking in full, for the View Booking Details panel. */
export const getEventBookingAdmin = async (eventId: string, ref: string) =>
    unwrap<EventBooking>(
        await api.get(ENDPOINTS.EVENTS.BOOKING(eventId, ref)),
        {} as EventBooking,
    );

/**
 * Record money taken outside the gateway — cash at the door.
 *
 * The acting admin is NOT a parameter: the server stamps `recordedBy` from the
 * token. A name a client could choose is a name anybody could put against
 * anybody else's takings.
 */
export const recordBookingPayment = async (eventId: string, ref: string, mode = 'offline') =>
    unwrap<EventBooking>(
        await api.post(ENDPOINTS.EVENTS.RECORD_BOOKING_PAYMENT(eventId, ref), { mode }),
        {} as EventBooking,
    );

/** Free the seats without losing the record. */
export const cancelEventBooking = async (eventId: string, ref: string, reason = '') =>
    unwrap<EventBooking>(
        await api.post(ENDPOINTS.EVENTS.CANCEL_BOOKING(eventId, ref), { reason }),
        {} as EventBooking,
    );


/* ==================================================================
   The overview — every event, and how full it is
   ================================================================== */

/** One row of the Booking Events table. */
export interface BookingOverviewRow {
    id: string;
    title: string;
    startAt: string | null;
    endAt: string | null;
    venue: string;
    category: string;
    status: 'draft' | 'published' | string;
    bannerUrl: string;
    registrationEnabled: boolean;

    /** What a non-member pays, and what a paid-up member pays. */
    price: number;
    memberPrice: number;
    hasMemberRate: boolean;
    memberSaving: number;

    /** `0` means UNLIMITED, matching the schema. The table prints an em dash. */
    totalSeats: number;
    bookedSeats: number;
    /**
     * `null` on an uncapped event — there is no remaining figure to report.
     *
     * Not `0`: a cell reading "0 remaining" on an event with no seat limit
     * would stop an organiser taking bookings they can perfectly well take.
     */
    remainingSeats: number | null;
    waitlistedSeats: number;

    bookings: number;
    paidBookings: number;
    collected: number;
    pendingAmount: number;
}

export interface BookingOverview {
    events: BookingOverviewRow[];
    totals: {
        events: number; seats: number; capacity: number;
        bookings: number; collected: number; pending: number;
    };
}

const EMPTY_OVERVIEW: BookingOverview = {
    events: [],
    totals: { events: 0, seats: 0, capacity: 0, bookings: 0, collected: 0, pending: 0 },
};

/**
 * Every event with its seat figures, in one request.
 *
 * The server counts both collections in two aggregates rather than calling its
 * per-event seat count in a loop — see `bookingOverview` there. The figures are
 * therefore the same ones the individual event screen shows, which they would
 * not be if this page did its own arithmetic over a list of events.
 */
export const listBookingOverview = async (includeDrafts = false) =>
    unwrap<BookingOverview>(
        await api.get(ENDPOINTS.EVENTS.BOOKING_OVERVIEW, {
            params: includeDrafts ? { includeDrafts: 1 } : {},
        }),
        EMPTY_OVERVIEW,
    );

/* ==================================================================
   The door list — one row per PERSON
   ================================================================== */

/** One seat in the room. Not one booking — see `listAttendees` on the server. */
export interface EventAttendee {
    key: string;
    seatNo: number;
    /** The typed name, or "Guest 2 of 4" when the booker left it blank. */
    name: string;
    named: boolean;
    email: string;
    phone: string;

    bookingRef: string;
    bookedByName: string;
    bookedByEmail: string;
    bookedByPhone: string;
    isGuest: boolean;
    isMemberRate: boolean;

    paymentStatus: string;
    paymentMode: string;
    bookingTotal: number;
    seatAmount: number;

    status: string;
    bookedAt: string | null;
}

export const listEventAttendees = async (
    eventId: string,
    params: { search?: string; paymentStatus?: string } = {},
) =>
    unwrap<{ attendees: EventAttendee[]; total: number; seatsBooked: number }>(
        await api.get(ENDPOINTS.EVENTS.ATTENDEES(eventId), {
            params: {
                ...(params.search ? { search: params.search } : {}),
                ...(params.paymentStatus ? { paymentStatus: params.paymentStatus } : {}),
            },
        }),
        { attendees: [], total: 0, seatsBooked: 0 },
    );

/* ==================================================================
   Export
   ================================================================== */

/**
 * Download this event's bookings as a CSV.
 *
 * FETCHED, NOT LINKED. The route is behind the admin token, and a plain
 * `<a href>` sends no Authorization header — the browser would leave the admin
 * screen for a 401 JSON body. So the axios instance that holds the token
 * fetches it as a blob and an object URL stands in for the file.
 *
 * The object URL is revoked immediately after the click. It is a reference into
 * the page's memory that holds the whole file alive until the document unloads,
 * and an admin exporting a dozen events in a sitting would accumulate all of
 * them. Revoking after the synchronous `click()` is safe: the download has
 * already been handed to the browser by then.
 */
export const exportBookingsCsv = async (eventId: string, title = 'event') => {
    const response = await api.get(ENDPOINTS.EVENTS.EXPORT_BOOKINGS(eventId), {
        responseType: 'blob',
    });

    const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    /*
     * The server sets a filename in `Content-Disposition`, and a blob download
     * ignores it — the name comes from this attribute. Derived from the title
     * the same way the server derives it, so the two agree.
     */
    link.download = `${String(title || 'event')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60)
        .toLowerCase() || 'event'}-bookings.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};


/* ==================================================================
   The contact book — everyone who has booked anything
   ================================================================== */

/**
 * One person, across every event they have ever booked.
 *
 * ================================================================
 * THERE IS NO CREDENTIAL ON THIS TYPE, AND THAT IS THE POINT
 * ================================================================
 *
 * The screen this replaces printed members' passwords in a column. The server
 * does not read any credential field, so there is nothing here to render — and
 * a field added to this interface would have nothing to bind to. Identify a
 * person by their name, address and mobile; that is what those are for.
 */
export interface BookingPerson {
    /** The key. Most of these people are guests and have no member id. */
    email: string;
    /** As they last typed it — a corrected spelling wins over the first one. */
    name: string;
    phone: string;

    /** Their member id, when ANY of their bookings was made signed in. */
    userId: string;
    isMember: boolean;
    /** Whether the membership discount has ever been applied to them. */
    hasMemberRate: boolean;

    bookings: number;
    /** Seats across all their bookings — one booking may be four people. */
    seats: number;
    /** Distinct events, which is not the same as bookings. */
    events: number;
    cancelled: number;

    /** Rupees that actually arrived. */
    paid: number;
    /** Rupees owed on live, unpaid bookings. Not takings. */
    pending: number;

    firstBookedAt: string | null;
    lastBookedAt: string | null;
}

/** Everyone who has booked, newest booker first. */
export const listBookingPeople = async (search = '') =>
    unwrap<{ people: BookingPerson[]; total: number }>(
        await api.get(ENDPOINTS.EVENTS.BOOKING_PEOPLE, {
            params: search ? { search } : {},
        }),
        { people: [], total: 0 },
    );

/**
 * One person's whole history — what the View button opens.
 *
 * The address goes as a query parameter, which axios escapes. See the note on
 * the endpoint for why it is not a path segment.
 */
export const getBookingPerson = async (email: string) =>
    unwrap<{ person: BookingPerson; bookings: EventBooking[] }>(
        await api.get(ENDPOINTS.EVENTS.BOOKING_PERSON, { params: { email } }),
        { person: {} as BookingPerson, bookings: [] },
    );
