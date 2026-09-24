import { useCallback, useEffect, useState } from 'react';
import {
    Mail, MessageSquare, Bell, RefreshCw, Loader2, Send, AlertTriangle,
    CheckCircle2, XCircle, Search, RotateCcw, Webhook, Info,
} from 'lucide-react';
import { toast } from 'sonner';
import AdminSidebar from './AdminSidebar';
import { AdminPageHeader, AdminStat, ADMIN_PAGE, ADMIN_BG, ADMIN_SECONDARY_BTN } from '@/features/admin/components/AdminUI';
import { CARD_TITLE } from '@/components/layout/appTypography';
import {
    getNotificationLogs, getDeliveryStatus, retryNotification, sendTestNotification,
    errorMessage,
    type NotificationLogRow, type NotificationHealth, type DeliveryStatus,
} from '@/services/activApi';

/**
 * Delivery oversight — is the platform actually reaching anybody?
 *
 * WHY THIS SCREEN EXISTS AT ALL. Every send in this system is non-blocking by
 * design: with no credentials configured it logs what it would have sent and
 * reports success, so that a mail host being down can never fail a member's
 * registration. That is right in production and it is exactly what makes a
 * misconfiguration invisible — a deployment that has never had an SMTP password
 * behaves, from every other screen, identically to one that is delivering. The
 * banner at the top of this page is the answer to "why is nobody getting
 * emails", and it is the first thing on the page for that reason.
 *
 * MOCK IS ITS OWN COUNT, NOT A KIND OF SENT. A row that was never handed to a
 * provider is a successful no-op, and folding it into "sent" would report that
 * eight hundred members were emailed by a server with no mail configuration.
 * Folding it into "failed" would fill a staging box with alarms. It is a third
 * number, labelled "not sent".
 */

const CHANNEL_META: Record<string, { label: string; icon: typeof Mail; tone: string }> = {
    email: { label: 'Email', icon: Mail, tone: 'text-blue-600 bg-blue-50' },
    whatsapp: { label: 'WhatsApp', icon: MessageSquare, tone: 'text-emerald-600 bg-emerald-50' },
    in_app: { label: 'In-app', icon: Bell, tone: 'text-slate-600 bg-slate-100' },
};

/** The events a filter can name, in the order they happen to a member. */
const EVENTS = [
    'ACCOUNT_REGISTERED', 'APPLICATION_SUBMITTED', 'STAGE_CHANGED', 'CORRECTION_REQUESTED',
    'APPLICATION_APPROVED', 'PAYMENT_REQUIRED', 'PAYMENT_SUCCESS', 'MEMBERSHIP_ACTIVATED',
    'EVENT_REGISTERED', 'EVENT_REMINDER', 'BOT_REPLY', 'CUSTOM',
];

const humanEvent = (value: string) =>
    String(value || '').toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

const when = (value: string) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-IN', {
        day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
    });
};

export default function Notifications() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const [status, setStatus] = useState<DeliveryStatus | null>(null);
    const [logs, setLogs] = useState<NotificationLogRow[]>([]);
    const [health, setHealth] = useState<NotificationHealth>({
        sent: 0, failed: 0, queued: 0, mock: 0, total: 0,
    });
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);

    const [channel, setChannel] = useState('');
    const [rowStatus, setRowStatus] = useState('');
    const [event, setEvent] = useState('');
    const [search, setSearch] = useState('');

    const [retrying, setRetrying] = useState<string | null>(null);
    const [testChannel, setTestChannel] = useState<'email' | 'whatsapp'>('email');
    const [testTo, setTestTo] = useState('');
    const [testing, setTesting] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            /*
             * `allSettled`: the configuration banner and the log are two
             * independent questions, and an empty log must not hide the banner
             * that explains why it is empty.
             */
            const [statusResult, logsResult] = await Promise.allSettled([
                getDeliveryStatus(),
                getNotificationLogs({
                    limit: 100,
                    ...(channel ? { channel } : {}),
                    ...(rowStatus ? { status: rowStatus } : {}),
                    ...(event ? { event } : {}),
                    ...(search.trim().length >= 2 ? { search: search.trim() } : {}),
                }),
            ]);

            if (statusResult.status === 'fulfilled') setStatus(statusResult.value);

            if (logsResult.status === 'fulfilled') {
                setLogs(logsResult.value?.logs || []);
                setHealth(logsResult.value?.health || health);
                setFailed(false);
            } else {
                setFailed(true);
            }
        } finally {
            setLoading(false);
        }
        // `health` is written here, not read — including it would re-run on
        // every load and loop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channel, rowStatus, event, search]);

    useEffect(() => {
        // Debounced, so typing into the recipient box does not fire a request
        // per keystroke against a collection that grows with every message sent.
        const timer = setTimeout(load, 300);
        return () => clearTimeout(timer);
    }, [load]);

    const retry = async (id: string) => {
        setRetrying(id);
        try {
            const row = await retryNotification(id);
            toast.success(row?.status === 'sent' ? 'Re-sent' : `Still failing: ${row?.lastError || 'unknown error'}`);
            await load();
        } catch (err) {
            toast.error(errorMessage(err, 'Could not re-send that message'));
        } finally {
            setRetrying(null);
        }
    };

    const runTest = async () => {
        const target = testTo.trim();
        if (!target) {
            toast.error(testChannel === 'email' ? 'Enter an email address' : 'Enter a phone number');
            return;
        }
        setTesting(true);
        try {
            const result = await sendTestNotification(testChannel, target);
            if (result?.mock) toast.warning('Nothing was sent — that channel has no credentials configured');
            else if (result?.success) toast.success('Sent — check the inbox or handset');
            else toast.error(result?.error || 'Send failed');
            await load();
        } catch (err) {
            toast.error(errorMessage(err, 'Test send failed'));
        } finally {
            setTesting(false);
        }
    };

    const emailOff = status && !status.email.configured;
    const waOff = status && !status.whatsapp.configured;

    return (
        <div className={`min-h-screen flex ${ADMIN_BG}`}>
            <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 min-w-0">
                <AdminPageHeader
                    title="Notifications"
                    subtitle="Every email and WhatsApp message the platform has attempted, and whether it arrived."
                    onMenu={() => setSidebarOpen(true)}
                    actions={
                        <button
                            type="button"
                            onClick={load}
                            disabled={loading}
                            className={ADMIN_SECONDARY_BTN}
                        >
                            {loading
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <RefreshCw className="w-4 h-4" />}
                            Refresh
                        </button>
                    }
                />

                {/*
                  * `ADMIN_PAGE`, not a hand-written `max-w-[90rem]`.
                  *
                  * That string capped the width and never centred it — no
                  * `mx-auto` — so past 1440px the content stayed pinned to the
                  * rail and the whole surplus piled up on the right: a thin
                  * gutter on one side and a band of empty page on the other.
                  * The shared token puts the cap on each CHILD and centres it,
                  * which is also what keeps the scroll bar at the window edge.
                  */}
                <main className={ADMIN_PAGE}>

                    {/* ==================================== configuration banner */}
                    {/*
                      * FIRST ON THE PAGE, because it is the answer to the
                      * question that brings a Super Admin here. An unconfigured
                      * channel silently succeeds everywhere else in the product.
                      */}
                    {(emailOff || waOff) && (
                        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div className="min-w-0 text-[1.25rem] text-amber-900">
                                <p className="font-semibold">
                                    {emailOff && waOff
                                        ? 'Neither email nor WhatsApp is configured.'
                                        : emailOff ? 'Email is not configured.' : 'WhatsApp is not configured.'}
                                </p>
                                <p className="mt-1">
                                    Messages on {emailOff && waOff ? 'those channels' : 'that channel'} are recorded
                                    below as <strong>not sent</strong> and nothing leaves the server. Add the
                                    credentials to <code className="font-mono text-[1.1875rem]">backend/.env</code> and
                                    restart — {emailOff ? <><code className="font-mono text-[1.1875rem]">EMAIL_USER</code> and <code className="font-mono text-[1.1875rem]">EMAIL_PASS</code></> : null}
                                    {emailOff && waOff ? ', ' : null}
                                    {waOff ? <><code className="font-mono text-[1.1875rem]">BOTBEE_API_TOKEN</code> and <code className="font-mono text-[1.1875rem]">BOTBEE_PHONE_NUMBER_ID</code></> : null}.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ================================================ health */}
                    {/*
                      * `AdminStat`, not a local `Stat`.
                      *
                      * This screen carried its own: a 30px figure with no icon
                      * tile, against the 48px figure in a tinted tile that
                      * Bookings and Categories show one click away. Two stat
                      * rows for one idea is the drift `AdminUI` exists to stop.
                      */}
                    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                        <AdminStat
                            icon={<CheckCircle2 className="w-5 h-5" />}
                            label="Delivered"
                            value={String(health.sent || 0)}
                            hint="reached the recipient"
                            tone="emerald"
                            primary
                        />
                        <AdminStat
                            icon={<XCircle className="w-5 h-5" />}
                            label="Failed"
                            value={String(health.failed || 0)}
                            hint="the provider refused it"
                            tone="rose"
                        />
                        <AdminStat
                            icon={<AlertTriangle className="w-5 h-5" />}
                            label="Not sent"
                            value={String(health.mock || 0)}
                            hint="no credentials configured"
                            tone="amber"
                        />
                        <AdminStat
                            icon={<Send className="w-5 h-5" />}
                            label="Total attempts"
                            value={String(health.total || 0)}
                            hint="every message, however it ended"
                            tone="slate"
                        />
                    </div>

                    {/* ========================================= channel cards */}
                    <div className="grid gap-5 lg:grid-cols-2">
                        <ChannelCard
                            icon={<Mail className="w-5 h-5" />}
                            title="Email"
                            configured={!!status?.email.configured}
                            rows={[
                                ['Host', status?.email.host || '—'],
                                ['Account', status?.email.user || '—'],
                                ['From address', status?.email.from || '—'],
                                ['Regional From', status?.email.regionalFrom ? 'On' : 'Off — region is in the display name'],
                                ['Fallback Reply-To', status?.email.supportAddress || '—'],
                            ]}
                            note="Application emails are sent from the verified address with the applicant's
                                  region in the display name, and Reply-To set to their own Block, District or
                                  State admin's registered address."
                        />
                        <ChannelCard
                            icon={<MessageSquare className="w-5 h-5" />}
                            title="WhatsApp (BotBee)"
                            configured={!!status?.whatsapp.configured}
                            rows={[
                                ['Base URL', status?.whatsapp.baseUrl || '—'],
                                ['Template endpoint', status?.whatsapp.templateEndpoint || '—'],
                                ['Auth style', status?.whatsapp.authStyle || '—'],
                                ['Webhook secret', status?.whatsapp.webhookConfigured ? 'Set' : 'Not set — inbound bot disabled'],
                            ]}
                            note={status?.whatsapp.webhookUrl
                                ? `Register this webhook URL on BotBee: ${status.whatsapp.webhookUrl}`
                                : undefined}
                            noteIcon={<Webhook className="w-3.5 h-3.5" />}
                        />
                    </div>

                    {/* ============================================= test send */}
                    <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6
                                        shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)]">
                        <h2 className={`${CARD_TITLE} text-slate-900`}>Send a test message</h2>
                        <p className="text-[1.25rem] text-slate-500 mt-1">
                            The difference between "the credentials are saved" and "it arrives".
                        </p>

                        <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
                            <select
                                value={testChannel}
                                onChange={(e) => setTestChannel(e.target.value as 'email' | 'whatsapp')}
                                className="h-11 px-3 rounded-xl border border-slate-200 text-[1.25rem] bg-white
                                           outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                            >
                                <option value="email">Email</option>
                                <option value="whatsapp">WhatsApp</option>
                            </select>
                            <input
                                value={testTo}
                                onChange={(e) => setTestTo(e.target.value)}
                                placeholder={testChannel === 'email' ? 'you@example.com' : '9876543210'}
                                className="flex-1 min-w-0 h-11 px-3.5 rounded-xl border border-slate-200 text-[1.25rem]
                                           outline-none transition-colors focus:border-blue-500
                                           focus:ring-4 focus:ring-blue-500/10"
                            />
                            <button
                                type="button"
                                onClick={runTest}
                                disabled={testing}
                                className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl
                                           bg-blue-600 text-white text-[1.25rem] font-semibold hover:bg-blue-700
                                           transition-colors disabled:opacity-60"
                            >
                                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                Send test
                            </button>
                        </div>
                    </section>

                    {/* ================================================ filters */}
                    <div className="flex flex-col sm:flex-row flex-wrap gap-2.5">
                        <div className="relative flex-1 min-w-0 sm:min-w-[14rem]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Filter by email or phone number"
                                className="h-11 w-full pl-9 pr-3.5 rounded-xl border border-slate-200 text-[1.25rem]
                                           outline-none transition-colors focus:border-blue-500
                                           focus:ring-4 focus:ring-blue-500/10"
                            />
                        </div>
                        <Select value={channel} onChange={setChannel} label="Every channel" options={[
                            ['email', 'Email'], ['whatsapp', 'WhatsApp'], ['in_app', 'In-app'],
                        ]} />
                        <Select value={rowStatus} onChange={setRowStatus} label="Every status" options={[
                            ['sent', 'Delivered'], ['failed', 'Failed'], ['queued', 'Queued'],
                        ]} />
                        <Select value={event} onChange={setEvent} label="Every event"
                            options={EVENTS.map((e) => [e, humanEvent(e)] as [string, string])} />
                    </div>

                    {/* ==================================================== log */}
                    {loading && !logs.length ? (
                        <Busy />
                    ) : failed ? (
                        <Empty text="The delivery log could not be loaded." />
                    ) : !logs.length ? (
                        <Empty text="Nothing has been sent yet." />
                    ) : (
                        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100
                                        shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)]">
                            {logs.map((row) => {
                                const meta = CHANNEL_META[row.channel] || CHANNEL_META.in_app;
                                const Icon = meta.icon;
                                // `mock` outranks `status`: the row says "sent"
                                // because nothing failed, but nothing was sent.
                                const state = row.mock ? 'mock' : row.status;

                                return (
                                    <div key={row._id} className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row
                                                                  sm:items-center gap-3">
                                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center
                                                          shrink-0 ${meta.tone}`}>
                                            <Icon className="w-5 h-5" />
                                        </span>

                                        <div className="min-w-0 flex-1">
                                            <p className="text-[1.25rem] font-semibold text-slate-900 break-words">
                                                {row.subject || humanEvent(row.event)}
                                            </p>
                                            <p className="text-[1.1875rem] text-slate-500 mt-0.5 break-words">
                                                {humanEvent(row.event)} · to <span className="font-medium">{row.recipient}</span>
                                                {row.replyTo ? <> · reply-to {row.replyTo}</> : null}
                                            </p>
                                            {/* The provider's own words. This is the
                                                only place the reason a message failed
                                                is visible at all. */}
                                            {row.lastError ? (
                                                <p className="text-[1.1875rem] text-rose-600 mt-1 break-words">{row.lastError}</p>
                                            ) : null}
                                        </div>

                                        <div className="flex items-center gap-3 shrink-0">
                                            <span className="text-[1.1875rem] text-slate-400 tabular-nums whitespace-nowrap">
                                                {when(row.createdAt)}
                                            </span>
                                            <StatePill state={state} />
                                            {state === 'failed' && row.channel !== 'in_app' ? (
                                                <button
                                                    type="button"
                                                    onClick={() => retry(row._id)}
                                                    disabled={retrying === row._id}
                                                    title="Send again"
                                                    aria-label="Send again"
                                                    className="w-9 h-9 rounded-lg border border-slate-200 flex items-center
                                                               justify-center text-slate-600 hover:bg-slate-50
                                                               transition-colors disabled:opacity-60"
                                                >
                                                    {retrying === row._id
                                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                                        : <RotateCcw className="w-4 h-4" />}
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ pieces */

function ChannelCard({ icon, title, configured, rows, note, noteIcon }: {
    icon: React.ReactNode; title: string; configured: boolean;
    rows: [string, string][]; note?: string; noteIcon?: React.ReactNode;
}) {
    return (
        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6
                            shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)]">
            <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    {icon}
                </span>
                <h2 className={`${CARD_TITLE} text-slate-900 flex-1 min-w-0`}>{title}</h2>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[1.0625rem]
                                  font-bold uppercase tracking-wide shrink-0 ${configured
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'}`}>
                    {configured ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {configured ? 'Configured' : 'Not configured'}
                </span>
            </div>

            <dl className="mt-4 space-y-2">
                {rows.map(([label, value]) => (
                    <div key={label} className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3">
                        <dt className="text-[1.1875rem] text-slate-500 sm:w-40 shrink-0">{label}</dt>
                        {/*
                          * `break-words`, NOT `break-all`.
                          *
                          * `break-all` breaks between any two characters, so
                          * ordinary prose came apart mid-word — "the applicant's
                          * regi / on in the display name" was on screen.
                          * `break-words` breaks only a token that cannot fit on a
                          * line by itself, which is what a webhook URL is and
                          * what a sentence is not.
                          */}
                        <dd className="text-[1.25rem] text-slate-900 font-medium break-words min-w-0">{value}</dd>
                    </div>
                ))}
            </dl>

            {note ? (
                <p className="mt-4 pt-4 border-t border-slate-100 text-[1.1875rem] text-slate-500 leading-relaxed
                              flex items-start gap-2 break-words">
                    <span className="shrink-0 mt-0.5 text-slate-400">{noteIcon || <Info className="w-3.5 h-3.5" />}</span>
                    <span className="min-w-0">{note}</span>
                </p>
            ) : null}
        </section>
    );
}

function StatePill({ state }: { state: string }) {
    const MAP: Record<string, { label: string; className: string }> = {
        sent: { label: 'Delivered', className: 'bg-emerald-50 text-emerald-700' },
        failed: { label: 'Failed', className: 'bg-rose-50 text-rose-700' },
        queued: { label: 'Queued', className: 'bg-slate-100 text-slate-600' },
        mock: { label: 'Not sent', className: 'bg-amber-50 text-amber-700' },
    };
    const pill = MAP[state] || MAP.queued;
    return (
        <span className={`px-2.5 py-1 rounded-full text-[1.0625rem] font-bold uppercase tracking-wide
                          whitespace-nowrap ${pill.className}`}>
            {pill.label}
        </span>
    );
}

function Select({ value, onChange, label, options }: {
    value: string; onChange: (v: string) => void; label: string; options: [string, string][];
}) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={label}
            className="h-11 px-3 rounded-xl border border-slate-200 text-[1.25rem] bg-white text-slate-700
                       outline-none transition-colors focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
        >
            <option value="">{label}</option>
            {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
    );
}

const Busy = () => (
    <div className="bg-white border border-slate-200 rounded-2xl flex items-center justify-center gap-3 py-16
                    text-slate-500 shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)]">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading…
    </div>
);

const Empty = ({ text }: { text: string }) => (
    <p className="bg-white border border-slate-200 rounded-2xl text-center text-slate-500 py-16
                  shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)]">
        {text}
    </p>
);
