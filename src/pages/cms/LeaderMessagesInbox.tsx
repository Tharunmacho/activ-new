import { useEffect, useMemo, useState } from 'react';
import {
    Phone, Mail, MapPin, Trash2, Check, Loader2, MessageSquare,
    CalendarDays, Newspaper, ExternalLink,
} from 'lucide-react';
import {
    listLeaderMessages, updateLeaderMessage, deleteLeaderMessage,
    type LeaderMessage,
} from '@/services/cmsLeaderMessagesApi';
import { errorMessage } from '@/services/cmsApi';
import { CmsCard, CmsButton, CmsLoading, CmsError, CmsEmpty, cmsSaved, cmsFailed } from './components/CmsUI';

/**
 * ============================================================================
 * PEOPLE ASKING TO BE PUT IN TOUCH WITH AN OFFICE-BEARER
 * ============================================================================
 *
 * The association's own description of what this screen is for: a member in
 * Tiruvannamalai opens the leaders their district actually has, picks one, and
 * asks to be contacted. This is where that lands. The super admin sees who
 * wrote and whom they were reading about, rings them, and takes that district's
 * schemes and events to them personally rather than replying with pleasantries.
 *
 * So the row leads with the PAIR and the GEOGRAPHY, not with the message. The
 * message says the same thing on every row of a given purpose — it is composed
 * by the server from a fixed list, which is what stops "hi" reaching a state
 * chairman — so it is the least informative thing on the card. What differs
 * from row to row is who, where, and what they want.
 *
 * ---------------------------------------------------------------------------
 * WHAT AN ADMINISTRATOR CAN AND CANNOT CHANGE
 * ---------------------------------------------------------------------------
 *
 * The status and their own note. Not the message, the sender or the addressee:
 * those are a record of what a member of the public sent, and a record an
 * administrator can edit is not a record. The server refuses it too.
 *
 * Everything a visitor typed — their name, their note — renders as PLAIN TEXT.
 * Anyone on the internet can write to this endpoint, and the one thing that
 * must not happen is a stranger's input executing inside an admin's session.
 */

const STATUSES = [
    { key: 'all', label: 'All' },
    { key: 'new', label: 'New' },
    { key: 'read', label: 'Read' },
    { key: 'contacted', label: 'Contacted' },
    { key: 'closed', label: 'Closed' },
] as const;

const TIERS = [
    { key: 'all', label: 'Every tier' },
    { key: 'national', label: 'National' },
    { key: 'region', label: 'Region' },
    { key: 'state', label: 'State' },
    { key: 'district', label: 'District' },
] as const;

const STATUS_STYLE: Record<LeaderMessage['status'], string> = {
    new: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
    read: 'bg-slate-100 text-slate-700 dark:bg-[#1a1a1a] dark:text-neutral-300',
    contacted: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
    closed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
};

/** "Tamil Nadu › Tiruvannamalai", or as much of it as the message carries. */
const placeOf = (m: LeaderMessage) =>
    [m.region, m.state, m.district].filter(Boolean).join(' › ');

const whenOf = (iso: string | null) => {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: 'numeric', minute: '2-digit',
        });
    } catch {
        return '';
    }
};

/** Digits only — what a `tel:` or a WhatsApp link needs. */
const dialable = (phone: string) => (phone || '').replace(/[^\d+]/g, '');

export default function LeaderMessagesInbox() {
    const [rows, setRows] = useState<LeaderMessage[]>([]);
    const [unread, setUnread] = useState(0);
    const [status, setStatus] = useState<string>('all');
    const [tier, setTier] = useState<string>('all');
    const [place, setPlace] = useState('');

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    const [notes, setNotes] = useState<Record<string, string>>({});

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const result = await listLeaderMessages({ status, tier, limit: 300 });
            setRows(result.messages || []);
            setUnread(result.unread || 0);
        } catch (err) {
            setError(errorMessage(err, 'Could not load the leader enquiries'));
        } finally {
            setLoading(false);
        }
    };

    /*
     * Refetches when the filter changes, and only then. `load` is
     * rebuilt every render, so listing it would refetch forever.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { load(); }, [status, tier]);

    /*
     * The place filter is applied HERE rather than by the server.
     *
     * The server takes exact `state` and `district` values, which is the right
     * shape for a query and the wrong shape for the question an administrator
     * has — they are looking for "anything around Tiruvannamalai" and they are
     * typing, not choosing. The list is a few hundred rows at most.
     */
    const shown = useMemo(() => {
        const needle = place.trim().toLowerCase();
        if (!needle) return rows;
        return rows.filter((m) => {
            const hay = [m.region, m.state, m.district, m.sender.district, m.leader.name]
                .map((v) => (v || '').toLowerCase()).join(' ');
            return hay.includes(needle);
        });
    }, [rows, place]);

    const patch = async (m: LeaderMessage, body: { status?: LeaderMessage['status']; adminNote?: string }) => {
        setBusy(m._id);
        try {
            const saved = await updateLeaderMessage(m._id, body);
            setRows((list) => list.map((r) => (r._id === m._id ? { ...r, ...saved } : r)));
            if (body.status) {
                setUnread((n) => (m.status === 'new' && body.status !== 'new' ? Math.max(0, n - 1) : n));
            }
            cmsSaved('Enquiry');
        } catch (err) {
            const message = errorMessage(err, 'Could not update that enquiry');
            setError(message);
            cmsFailed('the enquiry', message);
        } finally {
            setBusy(null);
        }
    };

    const remove = async (m: LeaderMessage) => {
        if (!window.confirm(
            `Delete the enquiry from ${m.sender.name || 'this person'}? `
            + 'Their name and number go with it, and nothing else holds a copy.',
        )) return;

        setBusy(m._id);
        try {
            await deleteLeaderMessage(m._id);
            setRows((list) => list.filter((r) => r._id !== m._id));
        } catch (err) {
            setError(errorMessage(err, 'Could not delete that enquiry'));
        } finally {
            setBusy(null);
        }
    };

    if (loading) return <CmsLoading label="Loading leader enquiries…" />;

    const chip = (active: boolean) =>
        `rounded-full px-4 py-1.5 text-[1.0625rem] font-semibold transition-colors ${active
            ? 'bg-[#2563EB] text-white'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-[#1a1a1a] dark:text-neutral-300'}`;

    return (
        <div className="w-full space-y-6 pb-12">
            <CmsError message={error} onRetry={load} />

            <CmsCard
                title="Leader enquiries"
                description={
                    'People who opened an office-bearer on a region, state or district page and asked '
                    + 'to be contacted. Every one carries a telephone number and the place it came from.'
                }
                actions={
                    unread > 0 ? (
                        <span className="rounded-full bg-blue-100 px-4 py-1.5 text-[1.0625rem]
                                         font-bold text-blue-800 dark:bg-blue-950/50 dark:text-blue-300">
                            {unread} new
                        </span>
                    ) : undefined
                }
            >
                {/* ---------------------------------------------------- filters */}
                <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                        {STATUSES.map((f) => (
                            <button
                                key={f.key}
                                type="button"
                                onClick={() => setStatus(f.key)}
                                className={chip(status === f.key)}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {TIERS.map((f) => (
                            <button
                                key={f.key}
                                type="button"
                                onClick={() => setTier(f.key)}
                                className={chip(tier === f.key)}
                            >
                                {f.label}
                            </button>
                        ))}

                        <input
                            value={place}
                            onChange={(e) => setPlace(e.target.value)}
                            placeholder="Filter by place or leader…"
                            className="ml-auto w-full max-w-xs rounded-lg border border-slate-300 bg-white
                                       px-3 py-2 text-[1.0625rem] text-slate-900 outline-none
                                       dark:border-[#2a2a2a] dark:bg-black dark:text-neutral-100"
                        />
                    </div>
                </div>

                {/* ------------------------------------------------------ rows */}
                {shown.length === 0 ? (
                    <CmsEmpty
                        title="Nothing here yet"
                        hint={
                            'An enquiry appears the moment somebody opens an office-bearer on a public '
                            + 'page and asks to be contacted.'
                        }
                    />
                ) : (
                    <div className="mt-6 space-y-4">
                        {shown.map((m) => (
                            <article
                                key={m._id}
                                className="rounded-2xl border border-slate-200 bg-white p-5
                                           dark:border-[#1f1f1f] dark:bg-[#0A0A0A]"
                            >
                                {/* ---- who wrote, and to whom ---- */}
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-[1.375rem] font-extrabold text-slate-900 dark:text-white">
                                            {m.sender.name || 'Someone'}
                                            <span className="mx-2 font-medium text-slate-400">wrote to</span>
                                            {m.leader.name || 'an office-bearer'}
                                        </p>

                                        <p className="mt-1 text-[1.0625rem] font-semibold text-slate-500
                                                      dark:text-neutral-400">
                                            {m.leader.role && <span>{m.leader.role}</span>}
                                            {m.leader.role && placeOf(m) && <span className="mx-1.5">·</span>}
                                            {placeOf(m) && (
                                                <span className="inline-flex items-center gap-1">
                                                    <MapPin size={13} className="shrink-0" /> {placeOf(m)}
                                                </span>
                                            )}
                                        </p>
                                    </div>

                                    <div className="flex shrink-0 items-center gap-2">
                                        <span className={`rounded-full px-3 py-1 text-[1rem] font-bold
                                                          ${STATUS_STYLE[m.status]}`}>
                                            {m.status}
                                        </span>
                                        <span className="text-[1rem] font-medium text-slate-400">
                                            {whenOf(m.createdAt)}
                                        </span>
                                    </div>
                                </div>

                                {/* ---- what they want ---- */}
                                <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-100
                                              px-3 py-1.5 text-[1.0625rem] font-bold text-slate-700
                                              dark:bg-[#141414] dark:text-neutral-200">
                                    <MessageSquare size={14} className="shrink-0" />
                                    {m.purposeLabel || m.purpose}
                                </p>

                                {/* The composed sentence. Same on every row of a
                                    purpose, so it is set quietly. */}
                                {m.body && (
                                    <p className="mt-2 text-[1.0625rem] leading-relaxed text-slate-600
                                                  dark:text-neutral-300">
                                        {m.body}
                                    </p>
                                )}

                                {/* Their own words, marked as theirs. */}
                                {m.note && (
                                    <p className="mt-2 border-l-2 border-slate-300 pl-3 text-[1.0625rem]
                                                  italic leading-relaxed text-slate-500
                                                  dark:border-[#2a2a2a] dark:text-neutral-400">
                                        “{m.note}”
                                    </p>
                                )}

                                {/* ---- how to reach them ---- */}
                                <div className="mt-4 flex flex-wrap items-center gap-2">
                                    {m.sender.phone && (
                                        <>
                                            <a
                                                href={`tel:${dialable(m.sender.phone)}`}
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50
                                                           px-3 py-1.5 text-[1.0625rem] font-bold text-emerald-800
                                                           transition-colors hover:bg-emerald-100
                                                           dark:bg-emerald-950/40 dark:text-emerald-300"
                                            >
                                                <Phone size={14} /> {m.sender.phone}
                                            </a>

                                            {/*
                                              * WhatsApp, pre-filled with the standard opening.
                                              *
                                              * The association's instruction was that a reply
                                              * should not be "hi" either — so the link carries
                                              * the sentence, naming the office-bearer the
                                              * person asked about and what they asked for.
                                              */}
                                            <a
                                                href={`https://wa.me/${dialable(m.sender.phone).replace(/^\+/, '')}`
                                                    + `?text=${encodeURIComponent(
                                                        `Namaste ${m.sender.name || ''}, this is the ACTIV office. `
                                                        + `You asked to be put in touch with `
                                                        + `${m.leader.name || 'our office-bearer'}`
                                                        + `${placeOf(m) ? ` (${placeOf(m)})` : ''} about `
                                                        + `${(m.purposeLabel || 'your enquiry').toLowerCase()}. `
                                                        + 'May we call you now?',
                                                    )}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100
                                                           px-3 py-1.5 text-[1.0625rem] font-bold text-slate-700
                                                           transition-colors hover:bg-slate-200
                                                           dark:bg-[#1a1a1a] dark:text-neutral-300"
                                            >
                                                WhatsApp <ExternalLink size={12} />
                                            </a>
                                        </>
                                    )}

                                    {m.sender.email && (
                                        <a
                                            href={`mailto:${m.sender.email}`}
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100
                                                       px-3 py-1.5 text-[1.0625rem] font-bold text-slate-700
                                                       transition-colors hover:bg-slate-200
                                                       dark:bg-[#1a1a1a] dark:text-neutral-300"
                                        >
                                            <Mail size={14} /> {m.sender.email}
                                        </a>
                                    )}

                                    {m.sender.organisation && (
                                        <span className="text-[1.0625rem] font-medium text-slate-500">
                                            {m.sender.organisation}
                                        </span>
                                    )}
                                </div>

                                {/*
                                  * What the association actually wants to send them.
                                  *
                                  * The enquiry names a district; the schemes and the
                                  * events are edited elsewhere in this CMS. Two links
                                  * rather than a composer: posting a scheme is a real
                                  * piece of work with its own screen, and a shortcut
                                  * that half-did it here would be a second place to
                                  * maintain the same thing.
                                  */}
                                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100
                                                pt-3 dark:border-[#1a1a1a]">
                                    <span className="text-[1rem] font-semibold text-slate-400">
                                        Take them something:
                                    </span>
                                    <a
                                        href="/cms/news"
                                        className="inline-flex items-center gap-1.5 text-[1.0625rem] font-bold
                                                   text-blue-700 dark:text-blue-400"
                                    >
                                        <Newspaper size={14} /> Post a scheme
                                    </a>
                                    <a
                                        href="/cms/events"
                                        className="inline-flex items-center gap-1.5 text-[1.0625rem] font-bold
                                                   text-blue-700 dark:text-blue-400"
                                    >
                                        <CalendarDays size={14} /> Post an event
                                    </a>
                                    {m.pagePath && (
                                        <a
                                            href={m.pagePath}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 text-[1.0625rem]
                                                       font-bold text-slate-500 dark:text-neutral-400"
                                        >
                                            The page they were on <ExternalLink size={12} />
                                        </a>
                                    )}
                                </div>

                                {/* ---- what happened ---- */}
                                <div className="mt-4 flex flex-wrap items-center gap-2">
                                    {(['read', 'contacted', 'closed'] as const).map((next) => (
                                        <button
                                            key={next}
                                            type="button"
                                            disabled={busy === m._id || m.status === next}
                                            onClick={() => patch(m, { status: next })}
                                            className="rounded-lg border border-slate-300 px-3 py-1.5
                                                       text-[1.0625rem] font-semibold text-slate-700
                                                       transition-colors hover:bg-slate-100 disabled:opacity-40
                                                       dark:border-[#2a2a2a] dark:text-neutral-300
                                                       dark:hover:bg-[#1a1a1a]"
                                        >
                                            {busy === m._id
                                                ? <Loader2 size={13} className="inline animate-spin" />
                                                : m.status === next ? <Check size={13} className="inline" /> : null}
                                            {' '}Mark {next}
                                        </button>
                                    ))}

                                    <button
                                        type="button"
                                        onClick={() => remove(m)}
                                        disabled={busy === m._id}
                                        className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5
                                                   text-[1.0625rem] font-semibold text-red-600 transition-colors
                                                   hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-950/40"
                                    >
                                        <Trash2 size={14} /> Delete
                                    </button>
                                </div>

                                {/* ---- the admin's own note ---- */}
                                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                                    <label className="min-w-0 flex-1">
                                        <span className="mb-1 block text-[1rem] font-semibold text-slate-500">
                                            Your note — what was said, what was promised
                                        </span>
                                        <textarea
                                            rows={2}
                                            value={notes[m._id] ?? m.adminNote}
                                            onChange={(e) => setNotes((n) => ({ ...n, [m._id]: e.target.value }))}
                                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2
                                                       text-[1.0625rem] text-slate-900 outline-none
                                                       dark:border-[#2a2a2a] dark:bg-black dark:text-neutral-100"
                                        />
                                    </label>
                                    <CmsButton
                                        variant="ghost"
                                        disabled={busy === m._id || (notes[m._id] ?? m.adminNote) === m.adminNote}
                                        onClick={() => patch(m, { adminNote: notes[m._id] ?? m.adminNote })}
                                    >
                                        Save note
                                    </CmsButton>
                                </div>

                                {m.handledBy?.email && (
                                    <p className="mt-2 text-[1rem] font-medium text-slate-400">
                                        Last touched by {m.handledBy.email}
                                    </p>
                                )}
                            </article>
                        ))}
                    </div>
                )}
            </CmsCard>
        </div>
    );
}
