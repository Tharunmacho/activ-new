import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Mail, MessageSquare, Loader2, RotateCcw, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage } from '@/services/api';
import {
    getBookingDelivery, resendNotification,
    type DeliveryLogRow, type DeliveryState, type BookingDelivery, type BookingDeliverySummary, type ChannelSummary,
} from '@/services/notificationDeliveryApi';

/**
 * The pieces every "did the message arrive?" surface shares: the status badge,
 * the human name of each automated message, the inline-confirmed Resend, and
 * the side panels. The Notifications "Automation" view and the Messages column
 * on the event bookings table must say the same word for the same state, so
 * both draw from here.
 */

/* ----------------------------------------------------------------- states */

export const STATE_META: Record<string, { label: string; className: string; hint: string }> = {
    resent: {
        label: 'Re-sent',
        className: 'bg-slate-100 text-slate-700 border-slate-300',
        hint: 'This message was sent again. The newer entry in the list shows how that went.',
    },
    failed: {
        label: 'Failed',
        className: 'bg-rose-50 text-rose-700 border-rose-200',
        hint: 'The provider refused it or could not deliver it. The reason is shown with it.',
    },
    read: {
        label: 'Read',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        hint: 'WhatsApp reports the recipient opened it.',
    },
    delivered: {
        label: 'Delivered',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        hint: 'WhatsApp reports it reached the phone.',
    },
    sent: {
        label: 'Sent',
        className: 'bg-blue-50 text-blue-700 border-blue-200',
        hint: 'WhatsApp sent it towards the handset; delivery not yet confirmed.',
    },
    accepted: {
        label: 'Sent',
        className: 'bg-blue-50 text-blue-700 border-blue-200',
        hint: 'The provider (Meta or the mail server) accepted it. Not yet confirmed delivered.',
    },
    mock: {
        label: 'Not sent',
        className: 'bg-slate-100 text-slate-600 border-slate-200',
        hint: 'No provider is configured, so nothing left the server.',
    },
    queued: {
        label: 'Queued',
        className: 'bg-slate-100 text-slate-600 border-slate-200',
        hint: 'Not attempted yet.',
    },
};

/** The state a badge shows — the server's `effectiveStatus`, with a safe fallback for older rows. */
export const stateOf = (row: Partial<DeliveryLogRow> | null | undefined): DeliveryState | string => {
    if (!row) return 'queued';
    if (row.effectiveStatus) return row.effectiveStatus;
    if (row.mock) return 'mock';
    if ((row as { resentAs?: string }).resentAs) return 'resent';
    if (row.status === 'failed') return 'failed';
    if (row.status === 'sent') return 'accepted';
    return 'queued';
};

export function DeliveryBadge({ state, compact = false }: { state: string; compact?: boolean }) {
    const meta = STATE_META[state] || STATE_META.queued;
    return (
        <span
            title={meta.hint}
            className={`inline-flex items-center rounded-full border font-semibold whitespace-nowrap
                        ${compact ? 'px-2 py-0.5 text-[1rem]' : 'px-2.5 py-1 text-ui-caption'} ${meta.className}`}
        >
            {meta.label}
        </span>
    );
}

/* --------------------------------------------------------- message names */

const MESSAGE_LABELS: Record<string, string> = {
    ASSOCIATION_UPDATE: 'Association update',
    EVENT_BOOKING_CONFIRMED: 'Booking confirmation',
    EVENT_BOOKING_REMINDER: 'Booking reminder',
    EVENT_BOOKING_CANCELLED: 'Booking cancellation',
    EVENT_BOOKING_WAITLISTED: 'Waitlist notice',
    EVENT_PARTICIPANT_CONFIRMED: 'Participant confirmation',
    EVENT_PARTICIPANT_REMINDER: 'Participant reminder',
    EVENT_PARTICIPANT_CANCELLED: 'Participant cancellation',
    EVENT_DOCUMENT_CONFIRMED: 'Event document',
    EVENT_DOCUMENT_REMINDER: 'Event document (reminder)',
    EVENT_CHANNEL_CONFIRMED: 'Event WhatsApp link',
    EVENT_CHANNEL_REMINDER: 'Event WhatsApp link (reminder)',
    EVENT_UPDATED: 'Event details changed',
    EVENT_CANCELLED: 'Event cancelled',
    EVENT_PAYMENT_FAILED: 'Event payment unsuccessful',
    EVENT_REGISTERED: 'Event registration',
    EVENT_REMINDER: 'Event reminder',
    ACCOUNT_REGISTERED: 'Membership · account created',
    APPLICATION_SUBMITTED: 'Membership · application received',
    APPLICATION_ENDORSED: 'Membership · application endorsed',
    CORRECTION_REQUESTED: 'Membership · correction requested',
    APPLICATION_APPROVED: 'Membership · application approved',
    PAYMENT_REQUIRED: 'Membership · payment pending',
    PAYMENT_SUCCESS: 'Membership · payment received',
    MEMBERSHIP_ACTIVATED: 'Membership · activated',
    MEMBERSHIP_RENEWAL_DUE: 'Membership · renewal due',
    MEMBERSHIP_PLAN_ADVANCED: 'Membership · plan advanced',
    MEMBERSHIP_STATUS_CHANGED: 'Membership · status changed',
    COMPANY_PAYMENT_CONFIRMED: 'Business publishing · payment confirmed',
    PAYMENT_FAILED: 'Membership · payment unsuccessful',
    PLATINUM_REQUESTED: 'Membership · platinum requested',
    ADMIN_NEW_APPLICATION: 'Admin · new application',
    ADMIN_PLATINUM_REQUEST: 'Admin · platinum request',
    ADMIN_QUEUE_ALERT: 'Admin · queue alert',
    PASSWORD_RESET: 'Account · password reset link',
    ADMIN_WELCOME: 'Admin · welcome & credentials',
    DONATION_RECEIPT: 'Donation · 80G receipt',
    DONATION_STATEMENT: 'Donation · year-end statement',
    STAGE_CHANGED: 'Membership · stage changed',
};

/** The message-type filter, in the order a booker and then a member meet them. */
export const MESSAGE_TYPES: [string, string][] = Object.entries(MESSAGE_LABELS);

/**
 * A reset link is single-use and a welcome email carried a one-time password;
 * neither is stored, so neither can be replayed (the server refuses too).
 */
const NO_RESEND = new Set(['PASSWORD_RESET', 'ADMIN_WELCOME']);
export const canResend = (row: { event?: string } | null | undefined) => !NO_RESEND.has(String(row?.event || ''));

export const messageLabel = (event: string) =>
    MESSAGE_LABELS[event]
    || String(event || '').toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

export const whenLabel = (value?: string) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export const reasonOf = (row: Partial<DeliveryLogRow> | null | undefined) =>
    String(row?.failureReason || row?.lastError || '');

/**
 * The reason in plain words, for the Automation view. Provider errors arrive
 * as codes ("(#132005) Translated text too long"); a Super Admin needs to know
 * what happened, not the code. A message that WENT OUT on a backup template
 * also carries a note in `lastError` — that is not a failure, and is said so.
 */
export const plainReason = (row: Partial<DeliveryLogRow> | null | undefined): { text: string; failed: boolean } => {
    if (stateOf(row) === 'resent') return { text: 'Sent again — the newer entry shows the result', failed: false };
    const raw = reasonOf(row);
    if (!raw) return { text: '', failed: false };
    const failed = stateOf(row) === 'failed';
    if (!failed && /^Sent on /i.test(raw)) return { text: 'Sent using the backup WhatsApp message', failed: false };
    const rules: [RegExp, string][] = [
        [/132005|too long/i, 'Message was too long for WhatsApp'],
        [/132001|does not exist/i, 'WhatsApp template not found'],
        [/131026|not.*whatsapp|undeliverable/i, 'This number is not on WhatsApp'],
        [/131049|marketing|ecosystem/i, 'WhatsApp blocked it (too many promotional messages to this number)'],
        [/131047|24 hours|re-engagement/i, 'WhatsApp needs an approved template outside the 24-hour window'],
        [/535|Invalid login|authentication/i, 'Email server login failed'],
        [/invalid.*(phone|number)|phone.*invalid/i, 'Phone number is not valid'],
        [/no (email|address)|missing email/i, 'No email address'],
        [/ETIMEDOUT|ECONNREFUSED|timeout/i, 'Could not reach the provider'],
    ];
    const hit = rules.find(([rx]) => rx.test(raw));
    return { text: hit ? hit[1] : raw, failed };
};

export const ChannelIcon = ({ channel, className = 'w-4 h-4' }: { channel: string; className?: string }) =>
    channel === 'whatsapp'
        ? <MessageSquare className={`${className} text-emerald-600`} aria-label="WhatsApp" />
        : <Mail className={`${className} text-blue-600`} aria-label="Email" />;

/* ---------------------------------------------------------------- resend */

/**
 * Resend, confirmed INLINE. It messages a real person, so the first press only
 * asks; the second sends. No native dialog (see the admin area's panel rule).
 */
export function ResendButton({ row, onDone, size = 'sm' }: {
    row: DeliveryLogRow;
    onDone?: () => void;
    size?: 'sm' | 'md';
}) {
    const [asking, setAsking] = useState(false);
    const [busy, setBusy] = useState(false);
    // A re-sent row's newer entry carries its own Resend; one button per message.
    if (!row?._id || row.channel === 'in_app' || !canResend(row) || stateOf(row) === 'resent') return null;

    const h = size === 'md' ? 'h-10 px-4' : 'h-9 px-3';

    const send = async () => {
        setBusy(true);
        try {
            const { row: next, message } = await resendNotification(row._id);
            const failed = /still failing|fail/i.test(message) || stateOf(next) === 'failed';
            if (failed) toast.error(message || 'Still failing');
            else toast.success(message || 'Re-sent');
            onDone?.();
        } catch (err) {
            toast.error(errorMessage(err, 'Could not resend that message'));
        } finally {
            setBusy(false);
            setAsking(false);
        }
    };

    if (asking) {
        return (
            <span className="inline-flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    onClick={send}
                    disabled={busy}
                    className={`inline-flex items-center gap-1.5 rounded-lg bg-blue-600 ${h} text-ui-caption
                                font-semibold text-white hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap`}
                >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    Confirm resend
                </button>
                <button
                    type="button"
                    onClick={() => setAsking(false)}
                    disabled={busy}
                    className={`inline-flex items-center rounded-lg border border-slate-200 bg-white ${h}
                                text-ui-caption font-semibold text-slate-600 hover:bg-slate-50 whitespace-nowrap`}
                >
                    Cancel
                </button>
            </span>
        );
    }

    return (
        <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setAsking(true); }}
            title={`Send this ${row.channel === 'whatsapp' ? 'WhatsApp message' : 'email'} again to ${row.recipient}`}
            className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white ${h}
                        text-ui-caption font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap`}
        >
            <RotateCcw className="w-3.5 h-3.5" /> Resend
        </button>
    );
}

/* ------------------------------------------------------------ side panel */

/** A right-hand panel over the page — full width on a phone, 40rem on a desktop. */
export function SidePanel({ title, subtitle, onClose, children, footer }: {
    title: ReactNode;
    subtitle?: ReactNode;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
}) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            />
            <aside
                role="dialog"
                aria-modal="true"
                className="relative h-full w-full sm:max-w-[40rem] bg-slate-50 border-l border-slate-200 shadow-2xl
                           flex flex-col overflow-hidden"
            >
                <header className="shrink-0 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4
                                   flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="text-[1.375rem] font-bold text-slate-900 [overflow-wrap:anywhere]">{title}</h2>
                        {subtitle ? (
                            <div className="text-[1.125rem] text-slate-500 mt-0.5 [overflow-wrap:anywhere]">{subtitle}</div>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="shrink-0 -mr-2 grid h-10 w-10 place-items-center rounded-lg text-slate-400 hover:text-slate-700"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </header>
                <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4">{children}</div>
                {footer ? (
                    <footer className="shrink-0 border-t border-slate-200 bg-white px-4 sm:px-6 py-3">{footer}</footer>
                ) : null}
            </aside>
        </div>
    );
}

/* ---------------------------------------------------------- row details */

const Field = ({ label, children }: { label: string; children: ReactNode }) => {
    if (children === null || children === undefined || children === '') return null;
    return (
        <div className="py-2.5 border-b border-slate-100 last:border-0">
            <dt className="text-[1rem] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">{label}</dt>
            <dd className="text-ui-small text-slate-800 [overflow-wrap:anywhere] min-w-0">{children}</dd>
        </div>
    );
};

/**
 * Everything known about one message: who, what, which template (and why a
 * richer one was skipped), the provider's id, the delivery timeline and the
 * full failure reason.
 */
export function DeliveryDetail({ row }: { row: DeliveryLogRow }) {
    const state = stateOf(row);
    const reason = reasonOf(row);
    const history = Array.isArray(row?.statusHistory) ? row.statusHistory : [];

    return (
        <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                    <ChannelIcon channel={row.channel} />
                    <span className="text-ui-small font-semibold text-slate-900">{messageLabel(row.event)}</span>
                    <DeliveryBadge state={state} />
                </div>
                <p className="text-ui-caption text-slate-500 mt-2">{(STATE_META[state] || STATE_META.queued).hint}</p>
                {row.channel === 'email' ? (
                    <p className="text-ui-caption text-slate-500 mt-1">
                        Email has no delivery receipts: the furthest an email can be shown is "accepted" by the mail
                        server, or "failed" with the server's reason.
                    </p>
                ) : null}
                {reason ? (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <p className="text-[1.125rem] text-rose-800 [overflow-wrap:anywhere] min-w-0">
                            {row.failureCode ? <strong>{String(row.failureCode)} · </strong> : null}
                            {reason}
                        </p>
                    </div>
                ) : null}
            </div>

            <dl className="bg-white border border-slate-200 rounded-xl px-4 shadow-sm">
                <Field label="To">{[row.recipientName, row.recipient].filter(Boolean).join(' · ')}</Field>
                <Field label="Booking">{row.bookingRef}</Field>
                <Field label="Event">{row.eventTitle}</Field>
                <Field label="Subject / template">{row.subject || row.templateId}</Field>
                <Field label="Template used">{row.templatePath || row.templateId}</Field>
                <Field label="Provider">
                    {row.provider === 'meta' ? 'Meta WhatsApp Cloud API'
                        : row.provider === 'botbee' ? 'BotBee'
                            : row.provider === 'smtp' ? 'SMTP mail server' : row.provider}
                </Field>
                <Field label="Provider message id">
                    {row.providerMessageId ? <span className="font-mono text-ui-caption">{row.providerMessageId}</span> : null}
                </Field>
                <Field label="First attempted">{whenLabel(row.createdAt)}</Field>
                <Field label="Attempts">{row.attempts ? String(row.attempts) : ''}</Field>
                <Field label="Resent as">{row.resentAs ? <span className="font-mono text-ui-caption">{row.resentAs}</span> : null}</Field>
                <Field label="Resend of">{row.resendOf ? <span className="font-mono text-ui-caption">{row.resendOf}</span> : null}</Field>
            </dl>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <h3 className="text-ui-caption font-semibold uppercase tracking-wider text-slate-500 mb-3">Timeline</h3>
                {history.length ? (
                    <ol className="space-y-3">
                        {history.map((h, i) => (
                            <li key={`${h?.status}-${h?.at}-${i}`} className="flex items-start gap-3">
                                <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${
                                    h?.status === 'failed' ? 'bg-rose-500'
                                        : h?.status === 'read' || h?.status === 'delivered' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                                <div className="min-w-0">
                                    <p className="text-[1.125rem] font-semibold text-slate-800">
                                        {(STATE_META[h?.status || ''] || { label: h?.status || '' }).label}
                                        <span className="ml-2 font-normal text-slate-500">{whenLabel(h?.at)}</span>
                                    </p>
                                    {h?.code || h?.title || h?.detail ? (
                                        <p className="text-ui-caption text-slate-600 [overflow-wrap:anywhere]">
                                            {[h?.code, h?.title, h?.detail].filter(Boolean).join(' · ')}
                                        </p>
                                    ) : null}
                                </div>
                            </li>
                        ))}
                    </ol>
                ) : (
                    <p className="text-[1.125rem] text-slate-500">
                        No delivery reports recorded for this message yet
                        {row.channel === 'whatsapp' ? ' — WhatsApp reports arrive through the provider webhook.' : '.'}
                    </p>
                )}
            </div>
        </div>
    );
}

/* ----------------------------------------------- per-booking chips/panel */

function Chip({ channel, summary }: { channel: 'email' | 'whatsapp'; summary?: ChannelSummary }) {
    const state = summary?.status || '';
    const meta = STATE_META[state];
    return (
        <span
            title={summary
                ? `${channel === 'email' ? 'Email' : 'WhatsApp'}: ${meta?.label || state}${summary.reason ? ` — ${summary.reason}` : ''}`
                : `No ${channel === 'email' ? 'email' : 'WhatsApp message'} sent`}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[1rem] font-semibold whitespace-nowrap
                        ${meta ? meta.className : 'bg-white text-slate-400 border-slate-200'}`}
        >
            <ChannelIcon channel={channel} className="w-3.5 h-3.5" />
            {meta ? meta.label : '—'}
        </span>
    );
}

/** The Messages cell: latest email and WhatsApp state, as one button. */
export function DeliveryChips({ summary, loading, onOpen }: {
    summary?: BookingDeliverySummary | null;
    loading?: boolean;
    onOpen: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onOpen}
            className="inline-flex flex-wrap items-center gap-1.5 rounded-lg px-1 py-1 -mx-1 hover:bg-slate-100 text-left"
            aria-label="Show message delivery for this booking"
        >
            {loading ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : (
                <>
                    <Chip channel="email" summary={summary?.email} />
                    <Chip channel="whatsapp" summary={summary?.whatsapp} />
                </>
            )}
        </button>
    );
}

/**
 * Every automated message about one booking — to the booker, each participant
 * and each event document — with status, reason, timeline and Resend.
 */
export function BookingDeliveryPanel({ bookingRef, title, onClose, onChanged }: {
    bookingRef: string;
    title?: string;
    onClose: () => void;
    onChanged?: () => void;
}) {
    const [data, setData] = useState<BookingDelivery | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [openId, setOpenId] = useState('');

    const load = useCallback(async () => {
        if (!bookingRef) return;
        setLoading(true);
        setError('');
        try {
            setData(await getBookingDelivery(bookingRef));
        } catch (err) {
            setError(errorMessage(err, 'The message history could not be loaded'));
        } finally {
            setLoading(false);
        }
    }, [bookingRef]);

    useEffect(() => { load(); }, [load]);

    const rows = data?.rows || [];

    return (
        <SidePanel
            title="Messages for this booking"
            subtitle={<><span className="font-mono">{bookingRef}</span>{title ? ` · ${title}` : ''}</>}
            onClose={onClose}
        >
            {loading && !data ? (
                <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin" /> Loading…
                </div>
            ) : error ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[1.125rem] font-semibold text-rose-700">{error}</p>
            ) : !rows.length ? (
                <p className="bg-white border border-slate-200 rounded-xl px-4 py-8 text-center text-[1.125rem] text-slate-500">
                    No email or WhatsApp message has been recorded for this booking.
                </p>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-2">
                        {(['email', 'whatsapp'] as const).map((ch) => {
                            const s = data?.summary?.[ch];
                            return (
                                <div key={ch} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm min-w-0">
                                    <div className="flex items-center gap-1.5 text-ui-caption font-semibold text-slate-600">
                                        <ChannelIcon channel={ch} /> {ch === 'email' ? 'Email' : 'WhatsApp'}
                                    </div>
                                    <div className="mt-2">
                                        {s ? <DeliveryBadge state={String(s.status)} /> : <span className="text-slate-400">Nothing sent</span>}
                                    </div>
                                    {s?.reason ? (
                                        <p className="mt-1.5 text-[1rem] text-rose-700 [overflow-wrap:anywhere]">{s.reason}</p>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>

                    <ul className="space-y-2">
                        {rows.map((row) => {
                            const open = openId === row._id;
                            const reason = reasonOf(row);
                            return (
                                <li key={row._id} className="bg-white border border-slate-200 rounded-xl shadow-sm">
                                    <button
                                        type="button"
                                        onClick={() => setOpenId(open ? '' : row._id)}
                                        aria-expanded={open}
                                        className="w-full text-left px-4 py-3 flex items-start gap-3"
                                    >
                                        <ChannelIcon channel={row.channel} className="w-4 h-4 mt-1 shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[1.125rem] font-semibold text-slate-900 [overflow-wrap:anywhere]">
                                                {messageLabel(row.event)}
                                            </p>
                                            <p className="text-ui-caption text-slate-500 [overflow-wrap:anywhere]">
                                                {[row.recipientName, row.recipient].filter(Boolean).join(' · ')} · {whenLabel(row.createdAt)}
                                            </p>
                                            {reason ? (
                                                <p className="text-ui-caption text-rose-700 mt-0.5 [overflow-wrap:anywhere]">{reason}</p>
                                            ) : null}
                                        </div>
                                        <DeliveryBadge state={stateOf(row)} compact />
                                    </button>
                                    {open ? (
                                        <div className="border-t border-slate-100 px-4 py-3 space-y-3">
                                            <DeliveryDetail row={row} />
                                            <div className="flex justify-end">
                                                <ResendButton row={row} size="md" onDone={() => { load(); onChanged?.(); }} />
                                            </div>
                                        </div>
                                    ) : null}
                                </li>
                            );
                        })}
                    </ul>
                    <p className="flex items-start gap-2 text-ui-caption text-slate-500">
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
                        Resend rebuilds the message from the booking as it stands now and sends it only to that
                        recipient, on that channel.
                    </p>
                </>
            )}
        </SidePanel>
    );
}
