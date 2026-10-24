/**
 * Stack routes owned by the PAYMENT area. Declared up front because other
 * areas navigate to them (the member area opens checkout for an event booking
 * and for a renewal):
 *
 *   navigation.navigate('MembershipPlans', { renew: true })
 *   navigation.navigate('PaymentCheckout', { orderType: 'event_booking', bookingRef, eventId })
 *
 * The payment area implements them (server-priced plans, Instamojo checkout
 * through POST /payment/create-request, confirmation via
 * GET /payment/return/:orderId) — same endpoints as the website.
 */
export type PaymentRoutes = {
  /** Plans the signed-in member is offered (GET /membership/plans/mine). `renew` = renewal. */
  MembershipPlans: { renew?: boolean; upgrade?: boolean } | undefined;
  /** Opens the gateway for one order and waits for the result. Never takes an amount. */
  PaymentCheckout: {
    upgrade?: boolean;
    commencementYear?: string;
    orderType: 'membership' | 'event_booking' | 'company_listing';
    companyId?: string;
    /** membership: the plan key from /membership/plans/mine */
    planId?: string;
    /** event_booking: the booking reference from POST /event-bookings/event/:eventId */
    bookingRef?: string;
    eventId?: string;
    renew?: boolean;
    applicationId?: string;
    /** Resume a retained order; never create another charge for a pending order. */
    resumeOrderId?: string;
  };
  /** Result after the gateway (GET /payment/return/:orderId). */
  PaymentResult: {
    orderId: string;
    /** Browser Dashboard action; applied only after server confirmation. */
    returnToDashboard?: boolean;
    orderType?: 'membership' | 'event_booking' | 'company_listing';
    bookingRef?: string;
    eventId?: string;
    companyId?: string;
    planId?: string;
    applicationId?: string;
    upgrade?: boolean;
    renew?: boolean;
    commencementYear?: string;
    /** From the gateway's return URL — passed to /payment/return, never trusted on its own. */
    paymentId?: string;
    paymentStatus?: string;
  };
  /** The donation form (POST /donations). The amount is the donor's choice; the server validates it. */
  Donate: undefined;
  /** After the gateway (GET /donations/return/:orderId). */
  DonationResult: { orderId: string; paymentId?: string; paymentStatus?: string };
  /** An 80G receipt (one gift) or the year's consolidated statement, by its token. */
  DonationDocument: { kind: 'receipt' | 'statement'; token: string; fy?: string };
};
