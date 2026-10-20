import api, { unwrap } from './api';
import { ENDPOINTS } from '@/config/api.config';
import type { NotificationLogRow, NotificationHealth } from './activApi';

/**
 * Automation delivery — did each automated email and WhatsApp message reach
 * the person it was for, and if not, why.
 *
 * Super admin only on the server. Separate from the general notification calls
 * in `activApi` because these carry the DELIVERY lifecycle the backend now
 * records (provider accepted -> sent -> delivered -> read, or failed with the
 * provider's own reason), and the screens that read it — the Notifications
 * "Automation" view and the per-booking Messages column — share these types.
 */

/**
 * Where a message got to. `effectiveStatus` on every row is one of these and
 * is what a badge shows; the server derives it (mock outranks everything,
 * then the provider's latest delivery report, then the send outcome).
 */
export type DeliveryState = 'accepted' | 'sent' | 'delivered' | 'read' | 'failed' | 'mock' | 'queued';

export interface DeliveryEvent {
    status: string;
    at: string;
    code?: string | number;
    title?: string;
    detail?: string;
}

export interface DeliveryLogRow extends NotificationLogRow {
    updatedAt?: string;
    bookingRef?: string;
    eventId?: string;
    eventTitle?: string;
    recipientName?: string;
    provider?: 'meta' | 'botbee' | 'smtp' | string;
    deliveryStatus?: string;
    effectiveStatus?: DeliveryState;
    statusHistory?: DeliveryEvent[];
    deliveredAt?: string;
    readAt?: string;
    failedAt?: string;
    failureReason?: string;
    failureCode?: string | number;
    resentAs?: string;
    resendOf?: string;
    templatePath?: string;
}

export interface DeliveryCounts {
    total: number;
    accepted: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    mock: number;
}

export interface AutomationCounts {
    total: number;
    delivery: Omit<DeliveryCounts, 'total'>;
    byChannel: { email: DeliveryCounts; whatsapp: DeliveryCounts };
}

export interface AutomationEventOption {
    eventId: string;
    title: string;
    count: number;
}

export interface AutomationPage {
    logs: DeliveryLogRow[];
    health: NotificationHealth;
    counts: AutomationCounts;
    events: AutomationEventOption[];
    pagination: { page: number; limit: number; total: number; pages: number };
}

export interface AutomationFilters {
    page?: number;
    limit?: number;
    channel?: string;
    delivery?: string;
    event?: string;
    group?: 'automation' | 'booking' | 'membership' | 'account';
    eventId?: string;
    bookingRef?: string;
    from?: string;
    to?: string;
    search?: string;
}

/** The latest message on one channel for one booking. */
export interface ChannelSummary {
    status: DeliveryState | string;
    at?: string;
    reason?: string;
    count?: number;
}

export interface BookingDeliverySummary {
    email?: ChannelSummary;
    whatsapp?: ChannelSummary;
}

export interface BookingDelivery {
    bookingRef: string;
    rows: DeliveryLogRow[];
    summary: BookingDeliverySummary;
}

const EMPTY_COUNTS: DeliveryCounts = { total: 0, accepted: 0, sent: 0, delivered: 0, read: 0, failed: 0, mock: 0 };

export const EMPTY_AUTOMATION: AutomationPage = {
    logs: [],
    health: { sent: 0, failed: 0, queued: 0, mock: 0, total: 0 },
    counts: {
        total: 0,
        delivery: { accepted: 0, sent: 0, delivered: 0, read: 0, failed: 0, mock: 0 },
        byChannel: { email: { ...EMPTY_COUNTS }, whatsapp: { ...EMPTY_COUNTS } },
    },
    events: [],
    pagination: { page: 1, limit: 25, total: 0, pages: 1 },
};

/** Drop empty filters, so the query string carries only what was chosen. */
const clean = (params: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null));

/** One page of the automation log, the filtered counts, and the event list. */
export const getAutomationLogs = async (filters: AutomationFilters = {}): Promise<AutomationPage> => {
    const page = unwrap<Partial<AutomationPage>>(
        await api.get(ENDPOINTS.NOTIFICATIONS.LOGS, { params: clean({ group: 'automation', ...filters }) }),
        {},
    ) || {};
    return {
        logs: Array.isArray(page.logs) ? page.logs : [],
        health: page.health || EMPTY_AUTOMATION.health,
        counts: {
            total: Number(page.counts?.total || 0),
            delivery: { ...EMPTY_AUTOMATION.counts.delivery, ...(page.counts?.delivery || {}) },
            byChannel: {
                email: { ...EMPTY_COUNTS, ...(page.counts?.byChannel?.email || {}) },
                whatsapp: { ...EMPTY_COUNTS, ...(page.counts?.byChannel?.whatsapp || {}) },
            },
        },
        events: Array.isArray(page.events) ? page.events : [],
        pagination: page.pagination || EMPTY_AUTOMATION.pagination,
    };
};

/** Every message sent about one booking — booker, participants and documents. */
export const getBookingDelivery = async (bookingRef: string): Promise<BookingDelivery> => {
    const ref = String(bookingRef || '').trim();
    const body = unwrap<Partial<BookingDelivery>>(
        await api.get(ENDPOINTS.NOTIFICATIONS.BOOKING_LOGS(ref)),
        {},
    ) || {};
    return {
        bookingRef: body.bookingRef || ref,
        rows: Array.isArray(body.rows) ? body.rows : [],
        summary: body.summary || {},
    };
};

/** Latest email / WhatsApp state for up to 200 bookings, keyed by reference. */
export const getDeliverySummaries = async (bookingRefs: string[]): Promise<Record<string, BookingDeliverySummary>> => {
    const refs = Array.from(new Set((bookingRefs || []).map((r) => String(r || '').trim()).filter(Boolean))).slice(0, 200);
    if (!refs.length) return {};
    const body = unwrap<{ summaries?: Record<string, BookingDeliverySummary> }>(
        await api.get(ENDPOINTS.NOTIFICATIONS.DELIVERY_SUMMARY, { params: { bookingRefs: refs.join(',') } }),
        {},
    ) || {};
    return body.summaries || {};
};

/**
 * Send a logged message again. Returns the row AND the server's sentence,
 * because the sentence is the result: "Re-sent", "Still failing: <reason>",
 * or why it was skipped. `unwrap` alone would throw that away.
 */
export const resendNotification = async (id: string): Promise<{ row: DeliveryLogRow | null; message: string }> => {
    const response = await api.post(ENDPOINTS.NOTIFICATIONS.RETRY(id), {});
    const body = response?.data || {};
    return {
        row: (body?.data as DeliveryLogRow) || null,
        message: String(body?.message || ''),
    };
};

/* ==========================================================================
 * DELIVERY GUARD — is email going out, and the "Retry all failed" button
 * (backend notifications/deliveryGuard.js)
 * ========================================================================== */

export interface DeliveryGuardHealth {
    email: {
        ok: boolean | null; configured: boolean | null; checkedAt: string | null; error: string;
        accounts?: Array<{ category: 'events' | 'membership'; ok: boolean | null; configured: boolean | null; checkedAt: string | null; error: string }>;
    };
    autoRetry: { enabled: boolean; everyMinutes: number; maxTries: number; windowHours: number };
}

export interface RetryAllSummary {
    checked: number;
    retried: number;
    sent: number;
    stillFailed: number;
    skipped: number;
    permanent: number;
    waitingForEmail: number;
}

export const getDeliveryGuardHealth = async (refresh = false): Promise<DeliveryGuardHealth | null> =>
    unwrap<DeliveryGuardHealth | null>(
        await api.get('/notifications/health', { params: refresh ? { refresh: 1 } : {}, ...(refresh ? { timeout: 60000 } : {}) }),
        null,
    );

/** Every failed message from the last `sinceHours` whose cause can heal, sent again. */
export const retryAllFailed = async (sinceHours = 168): Promise<RetryAllSummary> =>
    unwrap<RetryAllSummary>(
        await api.post('/notifications/retry-failed', { sinceHours }, { timeout: 180000 }),
        { checked: 0, retried: 0, sent: 0, stillFailed: 0, skipped: 0, permanent: 0, waitingForEmail: 0 },
    );
