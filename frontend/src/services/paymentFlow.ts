import api, { getAuthToken } from './api';
import { unwrap, asArray } from '../ui';
import { isLifetimeTier, selectHeldMembershipPlan } from '../utils/heldMembershipPlan';

/**
 * ============================================================================
 * PAYMENTS — the website's exact flow, from the app
 * ============================================================================
 *
 * One backend, one database. Every call here is one the website makes
 * (website/src/services/paymentApi.ts + features/member/membershipPlans.ts):
 *
 *   GET  /membership/plans/mine        the plans THIS member is offered
 *   GET  /members/my-profile           `renewal` (canRenew …), membershipNumber
 *   GET  /payment/config               { mode: 'mock' | 'gateway', provider }
 *   POST /payment/create-request       gateway: { membershipType: planId, orderType:'membership' }
 *                                        or     { orderType:'event_booking', bookingRef }
 *                                      → { payment_url, payment_request_id, orderId, amount }
 *   POST /payment/order → /payment/mock-authorize → /payment/complete
 *                                      mock only (dev servers; refused in production)
 *   GET  /payment/return/:orderId      public; settles an event booking with Instamojo
 *   GET  /payment/order/:orderId       signed-in; the order's own state
 *
 * THE CLIENT NEVER SENDS AN AMOUNT. The server prices the plan (or reads the
 * booking's total) — there is no price anywhere in this app.
 */

export type PlanAudience = 'business' | 'aspirant' | 'student' | 'platinum';

export interface Plan {
  commencementYears?: string[];
  commencementYearLabel?: string;
  key: string;
  name: string;
  description: string;
  /** Rupees, from the server. */
  price: number;
  audience: PlanAudience;
  membershipType: 'annual' | 'lifetime' | string;
  minYears: number;
  maxYears: number | null;
  experience: string;
  features: string[];
  popular: boolean;
}

export interface MyPlans {
  kind?: string;
  currentPlanDetails?: Plan | null;
  canPurchase?: boolean;
  commencementYear?: string;
  plans: Plan[];
  /** The plan the server resolved for this member (band / kind). */
  matched: Plan | null;
  years: number | null;
  reason: string;
  showAllPlans: boolean;
  /** The request did not land — "could not load the prices", not "no plans". */
  failed: boolean;
}

export const toAudience = (v: unknown): PlanAudience => {
  const s = String(v || '').toLowerCase();
  return s === 'aspirant' || s === 'student' || s === 'platinum' ? s : 'business';
};

const toPlan = (row: any): Plan => ({
  commencementYears: asArray<string>(row?.commencementYears).map(String),
  commencementYearLabel: String(row?.commencementYearLabel || ""),
  key: String(row?.key || row?.id || ''),
  name: String(row?.name || ''),
  description: String(row?.description || ''),
  price: Number(row?.price ?? row?.amount ?? (row?.amountPaise != null ? row.amountPaise / 100 : NaN)),
  audience: toAudience(row?.audience),
  membershipType: String(row?.membershipType || row?.memberType || 'annual'),
  minYears: Number(row?.minYears || 0),
  maxYears: row?.maxYears === null || row?.maxYears === undefined ? null : Number(row.maxYears),
  experience: String(row?.experience || ''),
  features: asArray<string>(row?.features ?? row?.entitlements).map((f) => String(f || '')).filter(Boolean),
  popular: row?.popular === true,
});

/**
 * The plans this member is offered. Platinum is NEVER purchasable here — it is
 * a lifetime tier the Super Admin grants by hand (website does the same).
 */
export const getMyPlans = async (): Promise<MyPlans> => {
  try {
    const res = await api.get('/membership/plans/mine');
    const d = unwrap<any>(res, {});
    const plans = asArray(d?.plans).map(toPlan).filter((p) => p.key && p.audience !== 'platinum');
    const m = d?.matched ? toPlan(d.matched) : null;
    return {
      plans,
      matched: m && m.audience !== 'platinum' ? m : null,
      years: typeof d?.years === 'number' ? d.years : null,
      reason: String(d?.reason || ''),
      showAllPlans: d?.showAllPlans === true,
      failed: false,
    };
  } catch {
    return { plans: [], matched: null, years: null, reason: '', showAllPlans: false, failed: true };
  }
};

/** Display-only catalogue lookup for the membership already held, including office-issued lifetime memberships. */
export const getHeldMembershipPlan = async (profile: any): Promise<Plan | null> => {
  if (!profile) throw new Error('The membership record could not be loaded.');
  const [response, legacy] = await Promise.all([
    api.get('/membership/plans', { params: { include: 'platinum' } }),
    isLifetimeTier(profile) || profile.paidMembership?.planId ? Promise.resolve(null) : getMyPlans(),
  ]);
  const body = unwrap<any>(response, {});
  const rows = (Array.isArray(body) ? body : asArray<any>(body?.plans)).filter(row => row.active !== false && row.isActive !== false);
  const plan = selectHeldMembershipPlan(profile, rows.map(toPlan), legacy?.matched);
  if (plan && (!Number.isFinite(plan.price) || plan.price <= 0)) {
    throw new Error('The current membership price is unavailable. Please retry.');
  }
  return plan;
};

/** Re-priced upgrade choices for the caller's saved profile. */
export const getUpgradePlans = async (): Promise<MyPlans> => {
  const d = unwrap<any>(await api.get('/payment/upgrade/plans'), {});
  if (typeof d?.canPurchase !== 'boolean') throw new Error('Membership upgrade options are temporarily unavailable. Please try again later.');
  const plans = asArray(d?.plans).map(toPlan).filter((p) => p.key && p.audience !== 'platinum');
  return {
    plans, kind: d?.kind, currentPlanDetails: d?.currentPlanDetails ? toPlan(d.currentPlanDetails) : null,
    canPurchase: d?.canPurchase !== false, matched: null, years: null, commencementYear: String(d?.commencementYear || ''),
    reason: String(d?.reason || ''), showAllPlans: true, failed: false,
  };
};

/** "0–5 years", "10+ years" — the band a plan covers, for the card. */
export const bandLabel = (p: Plan): string => {
  if (p.audience !== 'business') return '';
  const min = Number(p.minYears || 0);
  if (p.maxYears === null) return `${min}+ years in business`;
  return `${min}–${p.maxYears} years in business`;
};

/* ------------------------------------------------------------------ renewal */

export interface RenewalInfo {
  state: string;
  lifetime: boolean;
  expiresAt: string | null;
  daysLeft: number | null;
  expiringSoon: boolean;
  canRenew: boolean;
  opensAt: string | null;
}

export const readRenewal = (profile: any): RenewalInfo | null => {
  const r = profile?.renewal;
  if (!r || typeof r !== 'object') return null;
  return {
    state: String(r.state || ''),
    lifetime: r.lifetime === true,
    expiresAt: r.expiresAt || null,
    daysLeft: typeof r.daysLeft === 'number' ? r.daysLeft : null,
    expiringSoon: r.expiringSoon === true,
    canRenew: r.canRenew === true,
    opensAt: r.opensAt || null,
  };
};

export const getMyProfile = async () => unwrap<any>(await api.get('/members/my-profile'), {});

/* ------------------------------------------------------------------ gateway */

export interface PaymentConfig {
  mode: 'mock' | 'gateway';
  provider: string;
  hosted: boolean;
  configured: boolean;
}

export const getPaymentConfig = async (): Promise<PaymentConfig> => {
  const d = unwrap<any>(await api.get('/payment/config'), {});
  /* No mode is NOT mock: guessing mock on a production server offers a
     checkout the server refuses. Fail loudly so the screen can retry. */
  if (d?.mode !== 'gateway' && d?.mode !== 'mock') {
    throw new Error('The payment service could not be reached. Please try again.');
  }
  return {
    mode: d.mode === 'gateway' ? 'gateway' : 'mock',
    provider: String(d?.provider || ''),
    hosted: d?.hosted === true,
    configured: d?.configured === true,
  };
};

export interface HostedStart {
  paymentUrl: string;
  paymentRequestId: string;
  orderId: string;
  amount: number | null;
}

/** Start an Instamojo payment. `planId` for a membership, `bookingRef` for seats. */
export const startHostedPayment = async (input: {
  upgrade?: boolean;
  commencementYear?: string;
  orderType: 'membership' | 'event_booking' | 'company_listing';
  companyId?: string;
  planId?: string;
  bookingRef?: string;
  /** The website's startHostedMembershipPayment also sends it, when known. */
  applicationId?: string;
}): Promise<HostedStart> => {
  const body = input.orderType === 'company_listing' ? { orderType: 'company_listing', companyId: input.companyId } : input.orderType === 'event_booking'
    ? { orderType: 'event_booking', bookingRef: input.bookingRef }
    : {
      orderType: 'membership',
      membershipType: input.planId,
      ...(input.upgrade ? { upgrade: true, commencementYear: input.commencementYear } : {}),
      ...(input.applicationId ? { applicationId: input.applicationId } : {}),
    };
  const d = unwrap<any>(await api.post('/payment/create-request', { ...body, client: 'app' }), {});
  const paymentUrl = String(d?.payment_url || d?.longurl || '');
  if (!/^https:\/\//i.test(paymentUrl) || !d?.orderId) throw new Error('The secure payment page could not be started. Please try again.');
  return {
    paymentUrl,
    paymentRequestId: String(d?.payment_request_id || ''),
    orderId: String(d?.orderId || ''),
    amount: typeof d?.amount === 'number' ? d.amount : null,
  };
};

/**
 * The MOCK membership purchase (dev servers only — the server refuses it in
 * production): order → mock-authorize → complete. Returns the order.
 */
export const payMembershipMock = async (planId: string, applicationId?: string, upgrade = false, commencementYear?: string, companyId?: string) => {
  const order = unwrap<any>(await api.post('/payment/order', { planId, ...(companyId ? { companyId } : {}), ...(upgrade ? { upgrade: true, commencementYear } : {}), ...(applicationId ? { applicationId } : {}) }), {});
  if (!order?.orderId) throw new Error('The payment could not be started');
  const auth = unwrap<any>(await api.post('/payment/mock-authorize', { orderId: order.orderId }), {});
  if (!auth?.signature) throw new Error('The payment was not authorised');
  await api.post('/payment/complete', {
    orderId: order.orderId,
    gatewayPaymentId: auth.gatewayPaymentId,
    signature: auth.signature,
    paymentMethod: 'mock',
  });
  return order as { orderId: string; amount?: number; planName?: string };
};

/** The MOCK event-booking payment: authorize → pay (dev only). */
export const payBookingMock = async (bookingRef: string) => {
  const ref = encodeURIComponent(bookingRef);
  const auth = unwrap<any>(await api.post(`/event-bookings/${ref}/authorize`, {}), {});
  if (!auth?.signature) throw new Error('The payment was not authorised');
  await api.post(`/event-bookings/${ref}/pay`, {
    gatewayPaymentId: auth.gatewayPaymentId,
    signature: auth.signature,
    mode: 'online',
  });
};

/* ------------------------------------------------------------------ return */

export interface ReturnResult {
  orderId: string;
  orderType: string;
  status: string;
  amount: number | null;
  bookingRef: string;
  eventId: string;
  eventSlug: string;
  companyId: string;
  planName: string;
  paymentId: string;
  paidAt: string | null;
}

const toReturnResult = (d: any, orderId: string): ReturnResult => ({
  orderId: String(d?.orderId || orderId),
  orderType: String(d?.orderType || ''),
  status: String(d?.status || '').toLowerCase(),
  amount: typeof d?.amount === 'number' && Number.isFinite(d.amount) ? d.amount : null,
  bookingRef: String(d?.bookingRef || ''),
  eventId: String(d?.eventId || ''),
  eventSlug: String(d?.eventSlug || ''),
  companyId: String(d?.companyId || ''),
  planName: String(d?.planName || ''),
  paymentId: String(d?.paymentId || d?.gatewayPaymentId || ''),
  paidAt: d?.paidAt ? String(d.paidAt) : null,
});

/** Public: what the server knows about the order (settles an event booking). */
export const resolveReturn = async (
  orderId: string,
  gateway: { paymentId?: string; paymentStatus?: string } = {},
): Promise<ReturnResult> => {
  const d = unwrap<any>(await api.get(`/payment/return/${encodeURIComponent(orderId)}`, {
    params: {
      ...(gateway.paymentId ? { payment_id: gateway.paymentId } : {}),
      ...(gateway.paymentStatus ? { payment_status: gateway.paymentStatus } : {}),
    },
  }), {});
  return toReturnResult(d, orderId);
};

/** Signed-in: the order record (status, amount, plan, paidAt). */
export const getOrder = async (orderId: string) =>
  unwrap<any>(await api.get(`/payment/order/${encodeURIComponent(orderId)}`), {});

/** Both paths are server records. URL status is only forwarded for verification. */
export async function checkPaymentOrder(orderId: string, gateway: { paymentId?: string; paymentStatus?: string } = {}): Promise<ReturnResult> {
  let found: ReturnResult | null = null;
  let failure: unknown;
  try { found = await resolveReturn(orderId, gateway); } catch (err) { failure = err; }
  if (found && (found.status === 'paid' || found.status === 'failed')) return found;
  if (await getAuthToken()) {
    try {
      const order = await getOrder(orderId);
      if (order?.status) return toReturnResult({ ...found, ...order }, orderId);
    } catch { /* Keep the public pending response when the private read is unavailable. */ }
  }
  if (found) return found;
  throw failure || new Error('The payment status is unavailable.');
}

/**
 * Is this URL the gateway's return to ACTIV? The server builds
 * `<site>/payment-success?orderId=…` (Instamojo appends payment_id and
 * payment_status). Matched on any host, so a staging/local site works too.
 */
export const parseReturnUrl = (url: string): { orderId: string; paymentId: string; paymentStatus: string } | null => {
  const u = String(url || '');
  if (!/\/payment-success(\?|$|#|\/)/i.test(u)) return null;
  const q = u.split('?')[1] || '';
  const get = (k: string) => {
    const m = new RegExp(`(?:^|&)${k}=([^&#]*)`).exec(q);
    if (!m) return '';
    try { return decodeURIComponent(m[1].replace(/\+/g, ' ')); } catch { return m[1]; }
  };
  return { orderId: get('orderId'), paymentId: get('payment_id'), paymentStatus: get('payment_status') };
};

/* ==========================================================================
 * DONATIONS — the website's donationsApi, call for call
 * ==========================================================================
 *
 *   POST /donations                         { amount, fullName, email, phone, pan?, donorType, address, message? }
 *                                           → { donationId, orderId, amount, paymentUrl, mock }
 *   POST /donations/mock-complete/:orderId  dev servers only (mock: true)
 *   GET  /donations/return/:orderId         { status, amount, receiptNumber, receiptToken, statementToken, … }
 *   GET  /donations/receipt/:token          one gift's 80G receipt
 *   GET  /donations/statement/:token?fy=    the financial year's consolidated certificate
 *
 * The amount is only what the donor CHOSE; the server validates it and builds
 * the gateway order. The gateway returns to `<site>/donate/thank-you?orderId=…`.
 */

export type DonorType = 'individual' | 'organisation';

export interface DonationInput {
  amount: number;
  fullName: string;
  email: string;
  phone: string;
  pan?: string;
  donorType: DonorType;
  address: { line1: string; city: string; district: string; state: string; pincode: string };
  message?: string;
}

export const createDonation = async (input: DonationInput) =>
  unwrap<any>(await api.post('/donations', { ...input, client: 'app' }), {}) as {
    donationId?: string; orderId?: string; amount?: number; paymentUrl?: string; mock?: boolean;
  };

export const mockCompleteDonation = async (orderId: string) =>
  unwrap<any>(await api.post(`/donations/mock-complete/${encodeURIComponent(orderId)}`), {});

export const getDonationReturn = async (orderId: string, query: { payment_id?: string; payment_status?: string } = {}) =>
  unwrap<any>(await api.get(`/donations/return/${encodeURIComponent(orderId)}`, {
    params: {
      ...(query.payment_id ? { payment_id: query.payment_id } : {}),
      ...(query.payment_status ? { payment_status: query.payment_status } : {}),
    },
  }), { status: 'pending' });

export const getDonationReceipt = async (token: string) =>
  unwrap<any>(await api.get(`/donations/receipt/${encodeURIComponent(token)}`), {});

export const getDonationStatement = async (token: string, fy?: string) =>
  unwrap<any>(await api.get(`/donations/statement/${encodeURIComponent(token)}`, { params: fy ? { fy } : {} }), {});

/** "2026-27" → "2026–2027" (website fyLabel). */
export const fyLabel = (fy?: string | null) => {
  const m = /^(\d{4})-(\d{2,4})$/.exec(String(fy || ''));
  if (!m) return String(fy || '');
  return `${m[1]}–${m[2].length === 2 ? `${m[1].slice(0, 2)}${m[2]}` : m[2]}`;
};

/**
 * Is this URL the gateway's return from a DONATION? The server builds
 * `<site>/donate/thank-you?orderId=…` (Instamojo appends payment_id and
 * payment_status). Matched on any host.
 */
export const parseDonationReturnUrl = (url: string): { orderId: string; paymentId: string; paymentStatus: string } | null => {
  const u = String(url || '');
  if (!/\/donate\/thank-you(\?|$|#|\/)/i.test(u)) return null;
  const q = u.split('?')[1] || '';
  const get = (k: string) => {
    const m = new RegExp(`(?:^|&)${k}=([^&#]*)`).exec(q);
    if (!m) return '';
    try { return decodeURIComponent(m[1].replace(/\+/g, ' ')); } catch { return m[1]; }
  };
  return { orderId: get('orderId'), paymentId: get('payment_id'), paymentStatus: get('payment_status') };
};
