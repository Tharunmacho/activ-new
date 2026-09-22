import api, { unwrap } from './api';
import { ENDPOINTS } from '@/config/api.config';

/**
 * "Book Now" — seats at an event, bought by a guest or by a signed-in member.
 *
 * =========================================================================
 * NO AMOUNT IS EVER SENT FROM HERE
 * =========================================================================
 *
 * `createEventBooking` takes an event id, the booker's details and a number of
 * people. It does not take a price, a unit amount or a total, and there is
 * deliberately no parameter for one. The server reads the fee off the event and
 * multiplies; what comes back on the booking is what will be charged.
 *
 * This is the same rule the membership path carries — the price SHOWN and the
 * price CHARGED are one lookup — and it binds harder here, because these
 * endpoints are unauthenticated. A total sent from an anonymous browser is a
 * price chosen by the buyer.
 *
 * The `price` and `seatsLeft` on `BookableEvent` are for DISPLAY, and they are
 * fetched fresh rather than read off the event payload the page already holds:
 * both move while somebody is filling the form in, and a page that priced
 * itself from a stale payload would show a total the server then refuses.
 *
 * =========================================================================
 * THE REFERENCE IS THE GUEST'S ONLY HANDLE
 * =========================================================================
 *
 * A guest has no account and no list of bookings. `bookingRef` is what the
 * confirmation page, the receipt and any later lookup are keyed on, so it is
 * put in the URL of the confirmation page — a guest who closes the tab can get
 * back to their booking from their browser history, and from nowhere else.
 */

/** One person attending. The booker may or may not be among them. */
export interface BookingParticipant {
    name: string;
    email: string;
    phone: string;
}

/** The event, priced and counted, as the booking page renders it. */
export interface BookableEvent {
    /**
     * In a room or on a link. The booking flow stops asking somebody to find a
     * venue that does not exist, and the confirmation says how to join instead.
     *
     * The join link itself is NOT in this payload — it is what an anonymous
     * visitor reads BEFORE deciding to book, and handing it over at that point
     * would make the booking optional.
     */
    mode?: 'offline' | 'online';
    onlinePlatform?: string;
    id: string;
    title: string;
    description: string;
    startAt: string | null;
    endAt: string | null;
    venue: string;
    venueAddress: string;
    venueMapUrl: string;
    bannerUrl: string;
    contactName: string;
    contactPhone: string;
    contactEmail: string;
    registrationNote: string;
    registrationClosesAt: string | null;

    /**
     * The COMMON price per seat — what a visitor and a member without an active
     * membership pay. `0` is a free event, not a missing price.
     */
    price: number;

    /**
     * What a member with an active membership pays. Equals `price` when the
     * event carries no member rate.
     */
    memberPrice: number;
    /** Whether a real member rate exists — a lower number, deliberately set. */
    hasMemberRate: boolean;
    /** Rupees a member keeps per seat, and the same as a whole percent. */
    memberSaving: number;
    memberSavingPercent: number;

    /**
     * THE NUMBER TO SHOW AND THE NUMBER THAT WILL BE CHARGED — one field.
     *
     * Resolved SERVER-SIDE from whoever is asking: `price` for a guest or a
     * lapsed member, `memberPrice` for an active one. The page multiplies this
     * by the seat count and nothing else, so the total on screen cannot
     * disagree with the total the checkout takes.
     *
     * Never compute it here from `isMember && memberPrice`. That is a second
     * copy of the rule, and the first time the two disagree a member is shown
     * ₹600 and debited ₹1,000 with nothing reporting it.
     */
    amount: number;
    /** Whether `amount` IS the member rate — i.e. this viewer is getting it. */
    memberRateApplied: boolean;
    /** Whether this viewer is an active member at all. */
    isMember: boolean;
    /** `0` means uncapped — the same meaning the event schema gives it. */
    capacity: number;
    seatsTaken: number;
    /**
     * `Number.MAX_SAFE_INTEGER` on an uncapped event. Check `capacity > 0`
     * before printing this: rendering it raw puts 9007199254740991 on the page.
     */
    seatsLeft: number;
    maxPerBooking: number;
    /** The deadline has passed. Bookings are refused. */
    closed: boolean;
}

export interface EventBooking {
    bookingRef: string;
    eventId: string;
    eventTitle: string;
    eventStartAt: string | null;
    eventVenue: string;
    eventMapUrl: string;

    /**
     * WHERE TO JOIN, for an online event.
     *
     * Only ever populated on a single-booking read, where the caller holds the
     * reference — which is the proof of booking a guest has. It is absent from
     * every public event payload on purpose: a join link on a public page is a
     * seat given away, and the reason an online event takes bookings at all is
     * that the people who join are the people who registered.
     *
     * Read live off the event rather than copied onto the booking, so changing
     * a link that has leaked changes it for everyone at once.
     */
    mode?: 'offline' | 'online';
    onlinePlatform?: string;
    onlineUrl?: string;

    bookedBy: BookingParticipant;
    isGuest: boolean;

    noOfPersons: number;
    participants: BookingParticipant[];

    /** Rupees. The event's fee as it stood when the booking was taken. */
    unitAmount: number;
    /** `unitAmount * noOfPersons`, computed and stored by the server. */
    totalAmount: number;

    /**
     * Whether `unitAmount` is the event's MEMBER rate rather than its common
     * price — READ OFF THE BOOKING, never recomputed.
     *
     * The one input to this that changes on its own is the booker's membership,
     * so a receipt that re-derived the rate today would reprint last spring's
     * discounted booking at the full price and disagree with the money that
     * actually moved.
     */
    memberRateApplied: boolean;
    /** The common price at the time of booking. Only interesting beside the above. */
    listAmount: number;
    /** Rupees the member kept across the whole booking. `0` when no rate applied. */
    memberSaving: number;

    payment: {
        status: 'not_required' | 'pending' | 'paid' | 'failed';
        mode: string;
        reference: string;
        paidAt: string | null;
    };

    /**
     * ALL FOUR of the values the schema stores, not the two a client happens to
     * render most.
     *
     * This said `'active' | 'cancelled'` while the server had written
     * `'waitlist'` and `'expired'` since the collection was created — so a
     * screen that wanted to mark a waitlisted booking as holding no seat was
     * told by the compiler that the comparison could never be true, and the
     * honest fix looked like deleting the check. A type narrower than the data
     * does not prevent the value arriving; it only prevents handling it.
     *
     *   active    holding its seats
     *   waitlist  the event was full — NO seat is held, and none is charged
     *   expired   an unpaid hold that lapsed after thirty minutes
     *   cancelled withdrawn, by the booker or by an administrator
     */
    status: 'active' | 'waitlist' | 'expired' | 'cancelled';
    note: string;
    createdAt: string | null;
}

/** What the booking form collects. Note the absence of any money field. */
export interface BookingRequest {
    name: string;
    email: string;
    phone: string;
    noOfPersons: number;
    participants: BookingParticipant[];
    note?: string;
}

/** The event, priced and counted. Throws for an event the public may not book. */
export const getBookableEvent = async (eventId: string) =>
    unwrap<BookableEvent>(
        await api.get(ENDPOINTS.EVENT_BOOKINGS.EVENT(eventId)),
        {} as BookableEvent,
    );

/**
 * Take a booking.
 *
 * Comes back `payment.status: 'pending'` on a paid event — the seats are held
 * and the money is owed — or `'not_required'` on a free one, which is confirmed
 * on the spot.
 */
export const createEventBooking = async (eventId: string, input: BookingRequest) =>
    unwrap<EventBooking>(
        await api.post(ENDPOINTS.EVENT_BOOKINGS.CREATE(eventId), {
            name: input.name,
            email: input.email,
            phone: input.phone,
            noOfPersons: input.noOfPersons,
            participants: input.participants,
            ...(input.note ? { note: input.note } : {}),
        }),
        {} as EventBooking,
    );

/** One booking by its reference. */
export const getEventBooking = async (ref: string) =>
    unwrap<EventBooking>(await api.get(ENDPOINTS.EVENT_BOOKINGS.BY_REF(ref)), {} as EventBooking);

/**
 * Ask the server to authorise the booking in place of a gateway.
 *
 * The one call a real integration deletes. It exists so the flow is complete
 * with no provider account, and it is honest about being a simulation: the
 * server logs a warning on every use and refuses the request entirely when
 * `NODE_ENV=production`.
 */
export const authorizeEventBooking = async (ref: string) =>
    unwrap<{ bookingRef: string; gatewayPaymentId: string; signature: string; mockMode: boolean }>(
        await api.post(ENDPOINTS.EVENT_BOOKINGS.AUTHORIZE(ref)),
        {} as any,
    );

/** Verify the payment and confirm the seats. The amount comes from the booking. */
export const payEventBooking = async (input: {
    ref: string;
    gatewayPaymentId: string;
    signature: string;
    mode?: string;
}) =>
    unwrap<EventBooking>(
        await api.post(ENDPOINTS.EVENT_BOOKINGS.PAY(input.ref), {
            gatewayPaymentId: input.gatewayPaymentId,
            signature: input.signature,
            ...(input.mode ? { mode: input.mode } : {}),
        }),
        {} as EventBooking,
    );

/**
 * Book and pay, for a caller that just wants it done.
 *
 * Take the booking, authorise it, settle it. When a real gateway is connected
 * the middle step becomes its checkout and this helper is where that swap lands
 * — exactly as `payForMembership` is for memberships.
 *
 * A FREE EVENT NEVER REACHES THE GATEWAY. `payment.status` comes back
 * `not_required` and the booking is already confirmed; running it through the
 * payment steps would ask the server to verify a signature over a zero-rupee
 * order that was never created.
 */
export const bookAndPay = async (eventId: string, input: BookingRequest) => {
    const booking = await createEventBooking(eventId, input);
    if (!booking?.bookingRef) throw new Error('The booking could not be started');

    if (booking.payment.status !== 'pending') return booking;

    const authorized = await authorizeEventBooking(booking.bookingRef);
    if (!authorized?.signature) throw new Error('The payment was not authorised');

    return payEventBooking({
        ref: booking.bookingRef,
        gatewayPaymentId: authorized.gatewayPaymentId,
        signature: authorized.signature,
        mode: 'online',
    });
};
