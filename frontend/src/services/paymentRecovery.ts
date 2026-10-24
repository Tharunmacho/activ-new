import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserData } from './api';

export type PaymentKind = 'payment' | 'donation';
export type CheckoutContext = {
  orderType: 'membership' | 'event_booking' | 'company_listing';
  planId?: string;
  companyId?: string;
  bookingRef?: string;
  eventId?: string;
  applicationId?: string;
  upgrade?: boolean;
  renew?: boolean;
  commencementYear?: string;
};
export type PendingPayment = Omit<CheckoutContext, 'orderType'> & {
  orderType: CheckoutContext['orderType'] | 'donation';
  orderId: string;
  paymentUrl?: string;
  amount?: number | null;
  createdAt?: string;
};

// Keep only order/retry identifiers, never card, bank, PAN or donor details.
// An unfinished checkout survives a browser handoff or process restart, as the
// website's last-order storage does. It is isolated by the signed-in account.
const PREFIX = '@activ_pending_payments_v1';
const queues = new Map<string, Promise<unknown>>();
const kindOf = (record: PendingPayment): PaymentKind => record.orderType === 'donation' ? 'donation' : 'payment';
export const getPaymentStorageOwner = async (): Promise<string> => {
  const user = await getUserData();
  const id = user?._id || user?.id || user?.userId || user?.email;
  return id ? `user:${String(id).toLowerCase()}` : 'guest';
};
const keyFor = async (kind: PaymentKind, owner?: string) => `${PREFIX}:${owner || await getPaymentStorageOwner()}:${kind}`;
const read = async (key: string): Promise<PendingPayment[]> => {
  try {
    const rows = JSON.parse((await AsyncStorage.getItem(key)) || '[]');
    return Array.isArray(rows) ? rows.filter(row => row && typeof row.orderId === 'string' && row.orderId
      && ['membership', 'event_booking', 'company_listing', 'donation'].includes(row.orderType)) : [];
  } catch { return []; }
};

/** Latest order, or an exact retained order for a browser return. */
export async function getPendingPayment(kind: PaymentKind = 'payment', orderId?: string): Promise<PendingPayment | null> {
  try {
    const key = await keyFor(kind);
    await queues.get(key);
    const rows = await read(key);
    return (orderId ? rows.find(row => row.orderId === orderId) : rows[0]) || null;
  } catch { return null; }
}

const update = async (kind: PaymentKind, change: (rows: PendingPayment[]) => PendingPayment[], owner?: string) => {
  try {
    const key = await keyFor(kind, owner);
    const task = (queues.get(key) || Promise.resolve()).catch(() => undefined).then(async () => {
      const rows = change(await read(key));
      if (rows.length) await AsyncStorage.setItem(key, JSON.stringify(rows));
      else await AsyncStorage.removeItem(key);
    });
    queues.set(key, task);
    try { await task; } finally { if (queues.get(key) === task) queues.delete(key); }
  } catch { /* The current screen retains the order if device storage is unavailable. */ }
};

export const setPendingPayment = async (record: PendingPayment, owner?: string) => {
  if (!record.orderId) return;
  const safe: PendingPayment = {
    orderId: record.orderId, orderType: record.orderType,
    paymentUrl: record.paymentUrl, amount: record.amount,
    planId: record.planId, companyId: record.companyId, bookingRef: record.bookingRef,
    eventId: record.eventId, applicationId: record.applicationId,
    upgrade: record.upgrade, renew: record.renew, commencementYear: record.commencementYear,
    createdAt: record.createdAt || new Date().toISOString(),
  };
  await update(kindOf(record), rows => [safe, ...rows.filter(row => row.orderId !== safe.orderId)], owner);
};

/** A late result must not erase a newer or unrelated checkout. */
export const clearPendingPayment = (orderId: string, kind: PaymentKind = 'payment') =>
  update(kind, rows => rows.filter(row => row.orderId !== orderId));

export const sameCheckout = (pending: PendingPayment, context: CheckoutContext) => {
  if (pending.orderType !== context.orderType) return false;
  if (context.orderType === 'company_listing') return pending.companyId === context.companyId;
  if (context.orderType === 'event_booking') return pending.bookingRef === context.bookingRef;
  return pending.planId === context.planId && !!pending.upgrade === !!context.upgrade
    && !!pending.renew === !!context.renew && (pending.applicationId || '') === (context.applicationId || '')
    && (pending.commencementYear || '') === (context.commencementYear || '');
};

export async function findPendingCheckout(context: CheckoutContext): Promise<PendingPayment | null> {
  try {
    const key = await keyFor('payment');
    await queues.get(key);
    return (await read(key)).find(row => sameCheckout(row, context)) || null;
  } catch { return null; }
}
