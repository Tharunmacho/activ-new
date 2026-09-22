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
 * The whole purchase, for a caller that just wants it done.
 *
 * Order, authorise, complete. When a real gateway is connected the middle step
 * becomes its checkout and this helper is where that swap lands.
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

/** Poll a payment request created through the Instamojo path. */
export const checkPaymentRequestStatus = async (paymentRequestId: string) =>
    unwrap<any>(await api.get(ENDPOINTS.PAYMENT.STATUS(paymentRequestId)), {});
