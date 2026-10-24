import { API_ORIGIN } from '../config/api.config';
import { WEBSITE_ORIGIN } from '../config/website.config';
import { getPendingPayment } from '../services/paymentRecovery';
import type { PaymentRoutes } from '../types/routes/payment';

type PaymentLink = { kind: 'payment' | 'donation'; orderId: string; paymentId: string; paymentStatus: string; returnToDashboard: boolean };
export type PaymentLinkTarget =
  | { name: 'PaymentResult'; params: PaymentRoutes['PaymentResult'] }
  | { name: 'DonationResult'; params: PaymentRoutes['DonationResult'] };

/** Only our callback paths and origins can request a native payment check. */
export function parsePaymentLink(url?: string | null): PaymentLink | null {
  const raw = String(url || '').trim();
  if (!raw || /[\u0000-\u0020\\]/.test(raw)) return null;
  let path = '';
  if (/^activ:\/\//i.test(raw)) path = '/' + raw.slice('activ://'.length).replace(/^\/+/, '');
  else {
    const match = /^(https?:\/\/[^/?#]+)(\/.*)?$/i.exec(raw);
    const origins = [WEBSITE_ORIGIN, API_ORIGIN, 'https://activ.org.in', 'https://www.activ.org.in', 'https://api.activ.org.in'];
    if (!match || !origins.includes(match[1].toLowerCase())) return null;
    path = match[2] || '/';
  }
  const match = /^\/(payment-success|donate\/thank-you)\/?\?([^#]*)(?:#.*)?$/i.exec(path);
  if (!match) return null;
  const values: Record<string, string> = Object.create(null);
  try {
    for (const part of match[2].split('&')) {
      const [key, ...rest] = part.split('=');
      const name = decodeURIComponent(key.replace(/\+/g, ' '));
      if (!['orderId', 'payment_id', 'payment_status', 'next'].includes(name)) continue;
      if (Object.prototype.hasOwnProperty.call(values, name)) return null;
      values[name] = decodeURIComponent(rest.join('=').replace(/\+/g, ' '));
    }
  } catch { return null; }
  if (!/^[a-z0-9_-]{1,160}$/i.test(values.orderId || '')) return null;
  if ([values.payment_id, values.payment_status].some(v => v && (v.length > 256 || /[\u0000-\u001f]/.test(v)))) return null;
  return {
    kind: match[1].toLowerCase() === 'payment-success' ? 'payment' : 'donation',
    orderId: values.orderId, paymentId: values.payment_id || '', paymentStatus: values.payment_status || '',
    returnToDashboard: values.next === 'dashboard',
  };
}

/** A callback may resume only a checkout retained for this device's account. */
export async function resolvePaymentLink(url?: string | null): Promise<PaymentLinkTarget | null> {
  const link = parsePaymentLink(url);
  if (!link) return null;
  const stored = await getPendingPayment(link.kind, link.orderId);
  if (!stored || stored.orderId !== link.orderId) return null;
  const callback = { orderId: link.orderId, paymentId: link.paymentId, paymentStatus: link.paymentStatus };
  if (link.kind === 'donation') {
    return stored.orderType === 'donation' ? { name: 'DonationResult', params: callback } : null;
  }
  if (stored.orderType === 'donation') return null;
  return {
    name: 'PaymentResult',
    params: {
      ...callback, orderType: stored.orderType, bookingRef: stored.bookingRef,
      eventId: stored.eventId, companyId: stored.companyId, planId: stored.planId,
      applicationId: stored.applicationId, renew: stored.renew, upgrade: stored.upgrade,
      commencementYear: stored.commencementYear,
      returnToDashboard: stored.orderType === 'membership' && link.returnToDashboard,
    },
  };
}
