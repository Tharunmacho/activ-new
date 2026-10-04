import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Search, Loader2, ChevronLeft, ChevronRight, Mail, MessageSquare, CalendarDays, IdCard,
    KeyRound, Layers, CheckCircle2, AlertTriangle, CircleSlash, X,
} from 'lucide-react';
import { useCardTable } from '@/lib/useCardTable';
import { errorMessage } from '@/services/api';
import { ADMIN_CARD, ADMIN_INPUT } from '@/features/admin/components/AdminUI';
import {
    getAutomationLogs, EMPTY_AUTOMATION, getDeliveryGuardHealth, retryAllFailed,
    type AutomationPage, type DeliveryCounts, type DeliveryLogRow, type DeliveryGuardHealth, type RetryAllSummary,
} from '@/services/notificationDeliveryApi';
import {
    DeliveryBadge, DeliveryDetail, ResendButton, SidePanel, ChannelIcon,
    MESSAGE_TYPES, messageLabel, plainReason, reasonOf, stateOf, whenLabel,
} from '@/features/admin/components/DeliveryUI';

/**
 * AUTOMATION — every message the platform sent on its own, kept deliberately
 * simple: three tiles (Sent / Failed / Not sent, each a filter), one list
 * (to whom, what, the result in plain words), and resend. Provider error codes
 * are translated by `plainReason`; the raw text is on hover and in the panel.
 *
 * Organised by WHAT the message was about, because that is the question a Super
 * Admin arrives with ("did the booking confirmations go out?"), and it opens on
 * Events — the busiest and most time-sensitive traffic. The figures are for the
 * filtered set, so narrowing to one event answers "how many of its
 * confirmations failed". Whole-log health stays on the Delivery log view.
 */

const PAGE_SIZE = 25;

type Group = 'booking' | 'membership' | 'account' | 'automation';

const GROUPS: { key: Group; label: string; short: string; hint: string; icon: typeof CalendarDays }[] = [
    { key: 'booking', label: 'Events', short: 'Events', hint: 'Booking confirmations, reminders, cancellations, documents', icon: CalendarDays },
    { key: 'membership', label: 'Membership', short: 'Membership', hint: 'Applications, approvals, payments, renewals', icon: IdCard },
    { key: 'account', label: 'Account & donations', short: 'Accounts', hint: 'Password resets, admin welcomes, 80G receipts', icon: KeyRound },
    { key: 'automation', label: 'Everything', short: 'All', hint: 'Every automated email and WhatsApp message', icon: Layers },
];

const ACCOUNT_TYPES = new Set(['PASSWORD_RESET', 'ADMIN_WELCOME', 'DONATION_RECEIPT', 'DONATION_STATEMENT']);
const isBookingType = (event: string) => /^EVENT_(BOOKING|PARTICIPANT|DOCUMENT)_/.test(event);

/** The message types that belong in the tab on screen, so the list is short and relevant. */
const typesFor = (group: Group) => MESSAGE_TYPES.filter(([value]) => {
    if (group === 'booking') return isBookingType(value);
    if (group === 'account') return ACCOUNT_TYPES.has(value);
    if (group === 'membership') return !value.startsWith('EVENT_') && !ACCOUNT_TYPES.has(value);
    return true;
});

const SELECT = 'h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-[1.125rem] text-slate-700 '
    + 'outline-none transition-colors focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10';
const FIELD_LABEL = 'block text-[0.9375rem] font-semibold text-slate-500 mb-1.5';

const n = (value: unknown) => Number(value || 0);
const fmt = (value: number) => value.toLocaleString('en-IN');

/* ------------------------------------------------------------ summary */

/**
 * THREE NUMBERS, each one answer: how many went out, how many failed, how many
 * never left the server. Tapping one filters the list to it.
 */
function Tile({ icon: Icon, label, value, note, tone, active, onClick }: {
    icon: typeof CheckCircle2;
    label: string;
    value: number;
    note: string;
    tone: 'green' | 'rose' | 'slate';
    active: boolean;
    onClick: () => void;
}) {
    const tones = {
        green: { chip: 'bg-emerald-50 text-emerald-700', ring: 'border-emerald-500 ring-4 ring-emerald-500/10' },
        rose: { chip: 'bg-rose-50 text-rose-700', ring: 'border-rose-500 ring-4 ring-rose-500/10' },
        slate: { chip: 'bg-slate-100 text-slate-600', ring: 'border-slate-500 ring-4 ring-slate-500/10' },
    }[tone];
    const valueTone = tone === 'rose' && value > 0 ? 'text-rose-700' : 'text-slate-900';
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`${ADMIN_CARD} p-3 sm:p-5 min-w-0 text-left transition-colors hover:border-blue-300 ${active ? tones.ring : ''}`}
        >
            {/* Phone: three tiles share 390 px, so no icon chip and nothing
                truncated — the label and the note wrap instead. */}
            <span className="flex items-center gap-2.5 min-w-0">
                <span className={`hidden sm:grid w-9 h-9 shrink-0 rounded-xl place-items-center ${tones.chip}`}>
                    <Icon className="w-[1.125rem] h-[1.125rem]" />
                </span>
                <span className="text-[0.9375rem] sm:text-[1.125rem] font-semibold text-slate-700 leading-tight">{label}</span>
            </span>
            <span className={`block mt-1.5 sm:mt-3 text-[1.5rem] sm:text-[2.125rem] font-extrabold tabular-nums leading-none ${valueTone}`}>
                {fmt(value)}
            </span>
            <span className="block mt-1.5 text-[0.8125rem] sm:text-[1rem] text-slate-500 leading-snug break-words">{note}</span>
        </button>
    );
}

/* ------------------------------------------------------------------ page */

export default function NotificationsAutomation({ refreshKey = 0 }: { refreshKey?: number }) {
    const tableRef = useCardTable();
    const [data, setData] = useState<AutomationPage>(EMPTY_AUTOMATION);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Events first: the busiest, most time-sensitive traffic.
    const [group, setGroup] = useState<Group>('booking');
    const [eventId, setEventId] = useState('');
    const [channel, setChannel] = useState('');
    const [delivery, setDelivery] = useState('');
    const [type, setType] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [search, setSearch] = useState('');
    const [more, setMore] = useState(false);
    const [page, setPage] = useState(1);
    const [open, setOpen] = useState<DeliveryLogRow | null>(null);

    /* Is email going out? (deliveryGuard) — and the "Retry all failed" button. */
    const [health, setHealth] = useState<DeliveryGuardHealth | null>(null);
    const [retryAsk, setRetryAsk] = useState(false);
    const [retrying, setRetrying] = useState(false);
    const [retryResult, setRetryResult] = useState<RetryAllSummary | null>(null);

    const types = useMemo(() => typesFor(group), [group]);
    const eventFilter = group === 'booking' || group === 'automation';

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const result = await getAutomationLogs({
                page,
                limit: PAGE_SIZE,
                group,
                eventId: eventFilter ? eventId : '',
                channel,
                delivery,
                event: type,
                from,
                to,
                search: search.trim().length >= 2 ? search.trim() : '',
            });
            setData(result);
            // Keep an open panel in step with a refreshed row (after a resend).
            setOpen((current) => (current ? result.logs.find((r) => r._id === current._id) || current : current));
        } catch (err) {
            setError(errorMessage(err, 'The automation log could not be loaded'));
        } finally {
            setLoading(false);
        }
    // `refreshKey` is the page header's Refresh button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, group, eventId, channel, delivery, type, from, to, search, refreshKey]);

    useEffect(() => {
        const timer = setTimeout(load, 300);
        return () => clearTimeout(timer);
    }, [load]);

    useEffect(() => {
        let alive = true;
        getDeliveryGuardHealth(refreshKey > 0)
            .then((h) => { if (alive) setHealth(h); })
            .catch(() => { if (alive) setHealth(null); });
        return () => { alive = false; };
    }, [refreshKey]);

    const runRetryAll = async () => {
        setRetrying(true);
        setRetryResult(null);
        try {
            const summary = await retryAllFailed(168);
            setRetryResult(summary);
            getDeliveryGuardHealth().then(setHealth).catch(() => null);
            load();
        } catch (err) {
            setError(errorMessage(err, 'The failed messages could not be retried'));
        } finally {
            setRetrying(false);
            setRetryAsk(false);
        }
    };

    // Any filter change starts again at page one.
    useEffect(() => { setPage(1); }, [group, eventId, channel, delivery, type, from, to, search]);

    // A message type from another tab would silently match nothing.
    const switchGroup = (next: Group) => {
        setGroup(next);
        setType('');
        if (next === 'membership' || next === 'account') setEventId('');
    };

    const clearFilters = () => {
        setEventId(''); setChannel(''); setDelivery(''); setType('');
        setFrom(''); setTo(''); setSearch('');
    };

    /*
     * The tiles count the FILTERED set without the status filter's effect
     * mattering to the user: tapping a tile is the status filter. Tapping the
     * active one again clears it.
     */
    const toggleDelivery = (value: string) => setDelivery((d) => (d === value ? '' : value));

    const rows = data.logs || [];
    const pagination = data.pagination || EMPTY_AUTOMATION.pagination;
    const filtered = !!(eventId || channel || delivery || type || from || to || search.trim());
    const current = GROUPS.find((g) => g.key === group) || GROUPS[0];

    const email = data.counts.byChannel.email;
    const whatsapp = data.counts.byChannel.whatsapp;
    const reached = (c: DeliveryCounts) => n(c.accepted) + n(c.sent) + n(c.delivered) + n(c.read);
    // "WA 3 · Email 1" fits a phone-width tile; the long form wraps on larger screens anyway.
    const split = (e: number, w: number) => `WA ${fmt(w)} · Email ${fmt(e)}`;

    return (
        <>
            {/* ----------------------------------------------------- categories */}
            <div role="tablist" aria-label="Message category" className="flex flex-wrap gap-2">
                {GROUPS.map(({ key, label, short, icon: Icon }) => {
                    const on = key === group;
                    return (
                        <button
                            key={key}
                            type="button"
                            role="tab"
                            aria-selected={on}
                            onClick={() => switchGroup(key)}
                            className={`inline-flex items-center gap-2 h-11 px-4 rounded-xl border text-[1.0625rem] sm:text-[1.125rem] font-semibold transition-colors ${on
                                ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/40'}`}
                        >
                            <Icon className={`w-[1.125rem] h-[1.125rem] shrink-0 ${on ? 'text-white' : 'text-blue-600'}`} />
                            <span className="sm:hidden">{short}</span>
                            <span className="hidden sm:inline">{label}</span>
                        </button>
                    );
                })}
            </div>

            {/* ------------------------------------------- is email going out? */}
            {health?.email?.ok === false ? (
                <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3.5 text-rose-800">
                    <p className="flex items-center gap-2 text-[1.125rem] font-bold">
                        <AlertTriangle className="w-5 h-5 shrink-0" /> Email is not being sent right now
                    </p>
                    <p className="mt-1 text-[1rem] break-words">
                        {health.email.configured === false
                            ? 'No email server is set up on the server.'
                            : `The mail server refused the connection or login${health.email.error ? ` (${health.email.error})` : ''}.`}
                        {' '}Correct EMAIL_HOST / EMAIL_USER / EMAIL_PASS in the server settings. Failed emails are sent again automatically once it works.
                    </p>
                </div>
            ) : health?.email?.ok ? (
                <p className="flex items-center gap-2 text-[1rem] text-emerald-700">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Email server connected
                    {health.autoRetry?.enabled ? ` · failed messages are retried automatically every ${health.autoRetry.everyMinutes} min` : ''}
                </p>
            ) : null}

            {/* ---------------------------------------------------- the answer */}
            <div className="grid gap-2.5 sm:gap-4 grid-cols-3">
                <Tile
                    icon={CheckCircle2}
                    label="Sent"
                    value={reached(email) + reached(whatsapp)}
                    note={split(reached(email), reached(whatsapp))}
                    tone="green"
                    active={delivery === 'reached'}
                    onClick={() => toggleDelivery('reached')}
                />
                <Tile
                    icon={AlertTriangle}
                    label="Failed"
                    value={n(email.failed) + n(whatsapp.failed)}
                    note={n(email.failed) + n(whatsapp.failed) ? split(n(email.failed), n(whatsapp.failed)) : 'Nothing failed'}
                    tone="rose"
                    active={delivery === 'failed'}
                    onClick={() => toggleDelivery('failed')}
                />
                <Tile
                    icon={CircleSlash}
                    label="Not sent"
                    value={n(email.mock) + n(whatsapp.mock)}
                    note={n(email.mock) + n(whatsapp.mock) ? 'Email/WhatsApp was switched off' : 'None'}
                    tone="slate"
                    active={delivery === 'mock'}
                    onClick={() => toggleDelivery('mock')}
                />
            </div>

            {/* ------------------------------------------------- retry all failed */}
            {n(email.failed) + n(whatsapp.failed) > 0 || retryResult ? (
                <div className={`${ADMIN_CARD} px-4 py-3 flex flex-wrap items-center gap-3`}>
                    {retryResult ? (
                        <p className="flex-1 min-w-0 text-[1rem] text-slate-700">
                            Retried {fmt(retryResult.retried)}: <strong className="text-emerald-700">{fmt(retryResult.sent)} sent</strong>
                            {retryResult.stillFailed ? <>, <strong className="text-rose-700">{fmt(retryResult.stillFailed)} still failing</strong></> : null}
                            {retryResult.permanent ? `, ${fmt(retryResult.permanent)} cannot be fixed by retrying (wrong number or address)` : ''}
                            {retryResult.waitingForEmail ? `, ${fmt(retryResult.waitingForEmail)} waiting for the email server` : ''}
                            {retryResult.skipped ? `, ${fmt(retryResult.skipped)} skipped` : ''}.
                        </p>
                    ) : (
                        <p className="flex-1 min-w-0 text-[1rem] text-slate-600">
                            Send every failed message from the last 7 days again — those a retry can fix.
                        </p>
                    )}
                    {retryAsk ? (
                        <span className="flex items-center gap-2">
                            <span className="text-[1rem] font-semibold text-slate-700">Message these people again?</span>
                            <button type="button" onClick={runRetryAll} disabled={retrying}
                                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-60">
                                {retrying ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Yes, send
                            </button>
                            <button type="button" onClick={() => setRetryAsk(false)} disabled={retrying}
                                className="h-10 px-3 rounded-lg border border-slate-200 bg-white font-semibold text-slate-600">Cancel</button>
                        </span>
                    ) : (
                        <button type="button" onClick={() => setRetryAsk(true)}
                            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100">
                            Retry all failed
                        </button>
                    )}
                </div>
            ) : null}

            {/* -------------------------------------------------------- filters */}
            <div className={`${ADMIN_CARD} p-4 sm:p-5 space-y-3`}>
                <div className="flex flex-col lg:flex-row gap-3">
                    <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search name, phone, email or booking ID"
                            aria-label="Search messages"
                            className={`${ADMIN_INPUT} pl-10`}
                        />
                    </div>
                    {eventFilter ? (
                        <select
                            value={eventId}
                            onChange={(e) => setEventId(e.target.value)}
                            aria-label="Event"
                            className={`${SELECT} lg:w-[18rem]`}
                        >
                            <option value="">All events</option>
                            {(data.events || []).map((ev) => (
                                <option key={ev.eventId} value={ev.eventId}>
                                    {ev.title || 'Untitled event'} ({ev.count || 0})
                                </option>
                            ))}
                        </select>
                    ) : null}
                    <div role="radiogroup" aria-label="Channel" className="flex w-full lg:w-auto lg:inline-flex shrink-0 self-start rounded-xl border border-slate-200 bg-slate-50 p-1">
                        {[
                            { value: '', label: 'Both', icon: null },
                            { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
                            { value: 'email', label: 'Email', icon: Mail },
                        ].map(({ value, label, icon: Icon }) => {
                            const on = channel === value;
                            return (
                                <button
                                    key={label}
                                    type="button"
                                    role="radio"
                                    aria-checked={on}
                                    onClick={() => setChannel(value)}
                                    className={`flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg text-[1.0625rem] font-semibold whitespace-nowrap transition-colors ${on
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                    {Icon ? <Icon className="w-4 h-4" /> : null}
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {more ? (
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                        <label className="min-w-0">
                            <span className={FIELD_LABEL}>Message</span>
                            <select value={type} onChange={(e) => setType(e.target.value)} className={SELECT}>
                                <option value="">All messages</option>
                                {types.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                        </label>
                        <label className="min-w-0">
                            <span className={FIELD_LABEL}>From date</span>
                            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={SELECT} />
                        </label>
                        <label className="min-w-0">
                            <span className={FIELD_LABEL}>To date</span>
                            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={SELECT} />
                        </label>
                    </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                        type="button"
                        onClick={() => setMore((m) => !m)}
                        aria-expanded={more}
                        className="text-[1rem] font-semibold text-blue-700 hover:text-blue-800"
                    >
                        {more ? 'Fewer filters' : 'More filters (message type, dates)'}
                    </button>
                    {filtered ? (
                        <span className="flex items-center gap-3">
                            <span className="text-[1rem] text-slate-500">
                                {loading ? 'Filtering…' : `${fmt(pagination.total || 0)} ${pagination.total === 1 ? 'message' : 'messages'}`}
                            </span>
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white
                                           text-[1rem] font-semibold text-slate-600 hover:bg-slate-50"
                            >
                                <X className="w-4 h-4" /> Clear
                            </button>
                        </span>
                    ) : null}
                </div>
            </div>

            {error ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[1.1875rem] font-semibold text-rose-700 break-words">
                    {error}
                </div>
            ) : null}

            {/* ---------------------------------------------------------- list */}
            <div className={`${ADMIN_CARD} overflow-hidden`}>
                <div ref={tableRef} className="relative min-w-0 max-w-full overflow-x-auto card-table">
                    <table className="w-full text-left border-collapse min-w-[56rem]">
                        <colgroup>
                            <col className="w-[18rem]" />
                            <col />
                            <col className="w-[17rem]" />
                            <col className="w-[8rem]" />
                        </colgroup>
                        <thead>
                            <tr className="bg-slate-50">
                                {['To', 'Message', 'Result', ''].map((head, i) => (
                                    <th key={head || i} className="px-4 py-3 text-[1rem] font-semibold uppercase tracking-wider
                                                                   text-slate-500 border-b border-slate-200 whitespace-nowrap">
                                        {head || <span className="sr-only">Action</span>}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading && !rows.length ? (
                                <tr><td colSpan={4} className="px-4 py-14 text-center text-slate-400">
                                    <Loader2 className="w-5 h-5 animate-spin inline" />
                                </td></tr>
                            ) : null}
                            {!loading && !rows.length ? (
                                <tr><td colSpan={4} className="px-4 py-14 text-center">
                                    <p className="text-[1.1875rem] font-semibold text-slate-600">
                                        {filtered ? 'No messages match these filters.' : 'No messages here yet.'}
                                    </p>
                                </td></tr>
                            ) : null}
                            {rows.map((row) => {
                                const reason = plainReason(row);
                                return (
                                    <tr
                                        key={row._id}
                                        onClick={() => setOpen(row)}
                                        className="border-b border-slate-100 last:border-0 hover:bg-blue-50/30 cursor-pointer align-top"
                                    >
                                        <td className="px-4 py-3.5 min-w-0">
                                            <p className="text-[1.125rem] font-semibold text-slate-900 truncate" title={row.recipientName || ''}>
                                                {row.recipientName || 'No name'}
                                            </p>
                                            <p className="text-[1rem] text-slate-500 truncate" title={row.recipient}>{row.recipient}</p>
                                        </td>
                                        <td className="px-4 py-3.5 min-w-0">
                                            <p className="flex items-center gap-1.5 text-[1.125rem] font-semibold text-slate-800">
                                                <ChannelIcon channel={row.channel} className="w-4 h-4 shrink-0" />
                                                {messageLabel(row.event)}
                                            </p>
                                            {row.eventTitle ? (
                                                <p className="text-[1rem] text-slate-500 line-clamp-1" title={row.eventTitle}>{row.eventTitle}</p>
                                            ) : null}
                                            <p className="text-[0.9375rem] text-slate-400 tabular-nums">{whenLabel(row.createdAt)}</p>
                                        </td>
                                        <td className="px-4 py-3.5 min-w-0">
                                            <DeliveryBadge state={stateOf(row)} />
                                            {reason.text ? (
                                                <p
                                                    className={`mt-1.5 text-[1rem] line-clamp-2 ${reason.failed ? 'text-rose-700' : 'text-slate-500'}`}
                                                    title={reasonOf(row)}
                                                >
                                                    {reason.text}
                                                </p>
                                            ) : null}
                                        </td>
                                        <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                                            <ResendButton row={row} onDone={load} />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-200 px-4 py-3.5">
                    <p className="text-[1.0625rem] text-slate-500">
                        {pagination.total
                            ? `Showing ${(pagination.page - 1) * pagination.limit + 1}–${Math.min(pagination.page * pagination.limit, pagination.total)} of ${fmt(pagination.total)}`
                            : 'No entries'}
                    </p>
                    {pagination.pages > 1 ? (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={pagination.page <= 1 || loading}
                                aria-label="Previous page"
                                className="h-10 w-10 inline-flex items-center justify-center rounded-xl border border-slate-200
                                           text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-[1.125rem] font-semibold text-slate-600 tabular-nums">
                                {pagination.page} / {pagination.pages}
                            </span>
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                                disabled={pagination.page >= pagination.pages || loading}
                                aria-label="Next page"
                                className="h-10 w-10 inline-flex items-center justify-center rounded-xl border border-slate-200
                                           text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>

            {open ? (
                <SidePanel
                    title={messageLabel(open.event)}
                    subtitle={[open.recipientName, open.recipient].filter(Boolean).join(' · ')}
                    onClose={() => setOpen(null)}
                    footer={<div className="flex justify-end"><ResendButton row={open} size="md" onDone={load} /></div>}
                >
                    <DeliveryDetail row={open} />
                </SidePanel>
            ) : null}
        </>
    );
}
