import api, { unwrap } from './api';
import { ENDPOINTS } from '@/config/api.config';

/**
 * Payments, against a server that verifies them.
 *
 * Two rewrites are folded in here. The first pointed this file at the routes
 * that exist: it used to call `/payment/initiate`, `/payment/verify` and
 * `/payment/history`, none of which the backend declares, so the Pay button
 * answered 404.
 *
 * The second closed the hole underneath that. `POST /payment/complete` took the
 * client's word for everything — an authenticated request with an **empty body**
 * set `membershipStatus` to `approved` — so any member who could sign in could
 * grant themselves a paid membership with one request and no card.
 *
 * The flow is now the one every real gateway uses, in three steps:
 *
 *   1. `createPaymentOrder(planId)` — the server creates an order and decides
 *      the amount from its own price table. Nothing sent from here can change
 *      what is charged.
 *   2. the gateway authorises it and returns an id and a signature. Until a
 *      provider is connected, `authorizeMockPayment` asks the server to stand in
 *      — a step that exists only while `PAYMENT_MODE=mock` and is refused
 *      outright in production.
 *   3. `completeMembershipPayment` sends those back; the server verifies the
 *      signature, checks the order is the caller's and unused, and only then
 *      activates the membership.
 *
 * Integrating a real provider replaces step 2 and nothing else — step 3 already
 * verifies Razorpay's signature scheme, unmodified.
 */

export interface PaymentOrder {
    orderId: string;
    /** Decided by the server from `planId`. Display only; never sent back. */
    amount: number;
    currency: string;
    planId: string;
    planName: string;
    membershipType: string;
    provider: string;
    expiresAt: string;
    /** True while the server is standing in for a gateway. */
    mockMode: boolean;
}

export interface AuthorizedPayment {
    orderId: string;
    gatewayPaymentId: string;
    signature: string;
}

/** The plans and prices the server holds. */
export const getMembershipPlans = async () =>
    unwrap<{ plans: any[]; mockMode: boolean }>(
        await api.get(ENDPOINTS.PAYMENT.PLANS),
        { plans: [], mockMode: false },
    );

/**
 * Begin a payment.
 *
 * Only the plan key is sent. The amount is deliberately not a parameter: a
 * client-supplied amount is a client-chosen price, and the endpoint this
 * replaces accepted one implicitly by accepting none.
 */
export const createPaymentOrder = async (planId: string, applicationId?: string) =>
    unwrap<PaymentOrder>(
        await api.post(ENDPOINTS.PAYMENT.ORDER, {
            planId,
            ...(applicationId ? { applicationId } : {}),
        }),
        {} as PaymentOrder,
    );

/** The caller's own order. Another member's answers 403. */
export const getPaymentOrder = async (orderId: string) =>
    unwrap<any>(await api.get(ENDPOINTS.PAYMENT.ORDER_BY_ID(orderId)), {});

/**
 * Ask the server to authorise the order in place of a gateway.
 *
 * The one call a real integration deletes. It exists so the flow is complete
 * with no provider account, and it is honest about being a simulation: the
 * server logs a warning on every use, stamps the order `provider: 'mock'`, and
 * refuses the request entirely when `NODE_ENV=production`.
 */
export const authorizeMockPayment = async (orderId: string) =>
    unwrap<AuthorizedPayment & { mockMode: boolean }>(
        await api.post(ENDPOINTS.PAYMENT.MOCK_AUTHORIZE, { orderId }),
        {} as AuthorizedPayment & { mockMode: boolean },
    );

/**
 * Verify the payment and activate the membership.
 *
 * Three identifiers, all of them issued by the gateway; the amount and the plan
 * come from the stored order. The server rejects an order that is not the
 * caller's, one already paid, one expired, and any signature that does not
 * verify.
 */
export const completeMembershipPayment = async (input: {
    orderId: string;
    gatewayPaymentId: string;
    signature: string;
    paymentMethod?: string;
}) =>
    unwrap<any>(
        await api.post(ENDPOINTS.PAYMENT.COMPLETE, {
            orderId: input.orderId,
            gatewayPaymentId: input.gatewayPaymentId,
            signature: input.signature,
            ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
        }),
        {},
    );

/**
 * ==========================================================================
 * WHICH CHECKOUT IS LIVE — the server's answer, not this file's guess
 * ==========================================================================
 *
 * `payForMembership` below always called `/payment/mock-authorize`, so the
 * moment a real gateway was switched on the Pay button would have gone on
 * asking for a mock authorisation and getting a 403, with nothing a member
 * could act on. The server decides; this reads the decision.
 */
export interface PaymentConfig {
    mode: 'mock' | 'gateway';
    provider: string;
    /** True when checkout happens on the provider's own page, not on this site. */
    hosted: boolean;
    configured: boolean;
}

export const getPaymentConfig = async () =>
    unwrap<PaymentConfig>(
        await api.get(ENDPOINTS.PAYMENT.CONFIG),
        { mode: 'mock', provider: 'mock', hosted: false, configured: false },
    );

/**
 * ==========================================================================
 * START A HOSTED PAYMENT — Instamojo
 * ==========================================================================
 *
 * The server prices the plan, creates the payment request on Instamojo and
 * records an order keyed by the request id. What comes back is the URL to
 * send the member to; the payment itself happens on Instamojo's page, and
 * the MEMBERSHIP IS ACTIVATED BY THE WEBHOOK, never by this client.
 *
 * That last part is the whole reason the flow is shaped this way. The member
 * comes back to `/payment-success?payment_status=Credit&…`, and every one of
 * those query values is in their own address bar — editable. If the success
 * page activated anything, "Credit" typed into a URL would be a free
 * membership. It asks the server what happened instead.
 */
export interface HostedPaymentStart {
    payment_url: string;
    payment_request_id: string;
    orderId: string;
    amount: number;
}

export const startHostedMembershipPayment = async (
    planId: string,
    applicationId?: string,
) =>
    unwrap<HostedPaymentStart>(
        await api.post(ENDPOINTS.PAYMENT.CREATE_REQUEST, {
            /* No amount. The server prices it — see the route's own note. */
            membershipType: planId,
            orderType: 'membership',
            ...(applicationId ? { applicationId } : {}),
        }),
        {} as HostedPaymentStart,
    );

/**
 * The same thing for SEATS AT AN EVENT.
 *
 * The booking already exists and already carries its own total, so the only
 * thing sent is its reference — the server reads `totalAmount` off the
 * booking, exactly as it reads a membership price off the plan. A price has
 * never been sendable from a client on this flow and still is not.
 *
 * The webhook settles it: `processPaymentWebhook` sees `orderType:
 * 'event_booking'` on the order and calls `eventBookingService.completePayment`
 * with the booking reference. Nothing here confirms a seat.
 */
export const startHostedBookingPayment = async (bookingRef: string) =>
    unwrap<HostedPaymentStart>(
        await api.post(ENDPOINTS.PAYMENT.CREATE_REQUEST, {
            orderType: 'event_booking',
            bookingRef,
        }),
        {} as HostedPaymentStart,
    );

/**
 * The whole purchase, for a caller that just wants it done.
 *
 * Order, authorise, complete. This is the MOCK path — it is only reached when
 * the server reports `mode: 'mock'`; with a gateway connected the caller uses
 * `startHostedMembershipPayment` and leaves the site.
 */
export const payForMembership = async (
    planId: string,
    options: { applicationId?: string; paymentMethod?: string } = {},
) => {
    const order = await createPaymentOrder(planId, options.applicationId);
    if (!order?.orderId) throw new Error('The payment could not be started');

    const authorized = await authorizeMockPayment(order.orderId);
    if (!authorized?.signature) throw new Error('The payment was not authorised');

    await completeMembershipPayment({
        orderId: order.orderId,
        gatewayPaymentId: authorized.gatewayPaymentId,
        signature: authorized.signature,
        paymentMethod: options.paymentMethod,
    });

    return order;
};

/** What the return page learns about an order — public, works for a guest. */
export interface PaymentReturnResult {
    orderId: string;
    orderType: 'membership' | 'event_booking' | string;
    status: 'created' | 'paid' | 'failed' | string;
    amount?: number;
    bookingRef: string;
    eventId: string;
    /** The event's readable address, for the booking link (lib/eventPath). */
    eventSlug?: string;
}

/**
 * Ask the server about the order the buyer is returning from.
 *
 * Public on purpose: a GUEST who paid for event seats has no token, and the
 * signed-in `getPaymentOrder` answered them 401 — which the axios interceptor
 * turns into a trip to the login screen. For an event booking the server also
 * verifies the payment with Instamojo and confirms the booking.
 */
export const resolvePaymentReturn = async (
    orderId: string,
    gateway: { paymentId?: string; paymentStatus?: string } = {},
) =>
    unwrap<PaymentReturnResult>(
        await api.get(ENDPOINTS.PAYMENT.RETURN(orderId), {
            params: {
                ...(gateway.paymentId ? { payment_id: gateway.paymentId } : {}),
                ...(gateway.paymentStatus ? { payment_status: gateway.paymentStatus } : {}),
            },
        }),
        {} as PaymentReturnResult,
    );

/** Poll a payment request created through the Instamojo path. */
export const checkPaymentRequestStatus = async (paymentRequestId: string) =>
    unwrap<any>(await api.get(ENDPOINTS.PAYMENT.STATUS(paymentRequestId)), {});
