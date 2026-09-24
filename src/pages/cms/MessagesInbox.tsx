import { useEffect, useState } from 'react';
import { Mail, MailOpen, Archive, Trash2, Check, Undo2, Loader2 } from 'lucide-react';
import {
    listContactMessages, setMessageStatus, deleteContactMessage,
    errorMessage, type ContactMessage,
} from '@/services/cmsApi';
import { CmsCard, CmsButton, CmsLoading, CmsError, CmsEmpty } from './components/CmsUI';

/**
 * Messages from the public contact form.
 *
 * Message text is rendered as plain text, never as markup. Anyone on the
 * internet can submit this form, so the one thing that must not happen is a
 * visitor's input executing inside an admin's session.
 */

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'new', label: 'Unread' },
    { key: 'read', label: 'Read' },
    { key: 'archived', label: 'Archived' },
] as const;

export default function MessagesInbox() {
    const [messages, setMessages] = useState<ContactMessage[]>([]);
    const [unread, setUnread] = useState(0);
    const [filter, setFilter] = useState<string>('all');
    const [open, setOpen] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = async (status = filter) => {
        setLoading(true);
        setError('');
        try {
            const result = await listContactMessages({ status, limit: 100 });
            setMessages(result.messages || []);
            setUnread(result.unread || 0);
        } catch (err) {
            setError(errorMessage(err, 'Could not load messages'));
        } finally {
            setLoading(false);
        }
    };

    /*
     * Refetches when the filter changes, and only then. `load` is
     * rebuilt every render, so listing it would refetch forever.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { load(filter); }, [filter]);

    /**
     * Opening a message marks it read.
     *
     * Only on the way in, and only when it is currently unread — re-marking on
     * every expand would make "unread" meaningless.
     */
    const toggleOpen = async (m: ContactMessage) => {
        const next = open === m._id ? null : m._id;
        setOpen(next);

        if (next && m.status === 'new') {
            try {
                await setMessageStatus(m._id, 'read');
                setMessages((c) => c.map((x) => (x._id === m._id ? { ...x, status: 'read' } : x)));
                setUnread((u) => Math.max(0, u - 1));
            } catch {
                /* the message is still readable; the flag can wait */
            }
        }
    };

    /**
     * ======================================================================
     * MARK IT READ, OR PUT IT BACK TO UNREAD, DELIBERATELY
     * ======================================================================
     *
     * Opening a message already marks it read, which is right for the common
     * case and wrong for two others an administrator hits constantly:
     *
     *   - a row that has been dealt with elsewhere — rung back, forwarded —
     *     and does not need opening at all. Opening one to clear its dot is a
     *     control doing its job by a side effect;
     *   - a row opened to see what it was, that still needs answering. Once
     *     the dot is gone there was no way to put it back, so the unread
     *     count could only ever fall.
     *
     * The row carries both directions, and which one it offers follows its
     * current state. `archived` is left alone: it is a third state, not a
     * read/unread one, and the Archive button is what moves a row into it.
     */
    const [marking, setMarking] = useState<string | null>(null);

    const markAs = async (m: ContactMessage, status: 'new' | 'read') => {
        setMarking(m._id);
        try {
            await setMessageStatus(m._id, status);
            setMessages((c) => c.map((x) => (x._id === m._id ? { ...x, status } : x)));
            /* Adjusted here rather than refetched: a reload would re-apply the
               filter and pull the row out from under the cursor that is still
               on it — on the Unread tab, marking one read would make it
               vanish mid-click. */
            setUnread((u) => Math.max(0, status === 'new' ? u + 1 : u - 1));
        } catch (err) {
            setError(errorMessage(err, 'Could not change that message'));
        } finally {
            setMarking(null);
        }
    };

    const archive = async (m: ContactMessage) => {
        try {
            await setMessageStatus(m._id, 'archived');
            await load(filter);
        } catch (err) {
            setError(errorMessage(err, 'Could not archive the message'));
        }
    };

    /**
     * Deleting is confirmed, and the row is held while it happens.
     *
     * `removing` is not decoration: the list reloads afterwards, and without
     * it a second press before the reload lands fires a second DELETE against
     * an id that is already gone — which comes back as an error about a
     * message the administrator has successfully deleted.
     */
    const [removing, setRemoving] = useState<string | null>(null);

    const remove = async (m: ContactMessage) => {
        if (!window.confirm(`Delete the message from ${m.name}? This cannot be undone.`)) return;
        setRemoving(m._id);
        try {
            await deleteContactMessage(m._id);
            /* Closed first. The panel is keyed on the id, and leaving it open
               on a row that no longer exists renders an empty box. */
            if (open === m._id) setOpen(null);
            await load(filter);
        } catch (err) {
            setError(errorMessage(err, 'Could not delete the message'));
        } finally {
            setRemoving(null);
        }
    };

    return (
        <div className="space-y-5 w-full">
            <CmsError message={error} onRetry={() => load(filter)} />

            <div className="flex flex-wrap gap-2">
                {FILTERS.map((f) => (
                    <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        className={`px-3 py-1.5 rounded-lg text-[1.1875rem] transition-colors ${
                            filter === f.key ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-[#161616] text-slate-700 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-[#242424]'
                        }`}
                    >
                        {f.label}
                        {f.key === 'new' && unread > 0 && (
                            <span className="ml-2 text-[1.0625rem] bg-red-500 text-white rounded-full px-1.5">{unread}</span>
                        )}
                    </button>
                ))}
            </div>

            <CmsCard title={`Messages (${messages.length})`} description={`${unread} unread.`}>
                {loading ? (
                    <CmsLoading label="Loading messages…" />
                ) : messages.length === 0 ? (
                    <CmsEmpty title="No messages" hint="Submissions from the public contact form appear here." />
                ) : (
                    <div className="divide-y divide-slate-800">
                        {messages.map((m) => (
                            <div key={m._id} className="py-3">
                                <button
                                    onClick={() => toggleOpen(m)}
                                    className="w-full text-left flex items-start gap-3"
                                >
                                    {m.status === 'new'
                                        ? <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-1" />
                                        : <MailOpen className="w-4 h-4 text-neutral-500 shrink-0 mt-1" />}

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-baseline gap-2">
                                            <p className={`truncate ${m.status === 'new' ? 'font-semibold text-slate-900 dark:text-neutral-100' : 'text-slate-700 dark:text-neutral-300'}`}>
                                                {m.name}
                                            </p>
                                            <span className="text-[1.0625rem] text-neutral-500 truncate">{m.email}</span>
                                        </div>
                                        <p className="text-[1.1875rem] text-neutral-500 dark:text-neutral-400 truncate">
                                            {m.subject || m.message}
                                        </p>
                                    </div>

                                    <span className="text-[1.0625rem] text-neutral-500 shrink-0 whitespace-nowrap">
                                        {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : ''}
                                    </span>
                                </button>

                                {/*
                                  OUTSIDE the row button, not inside it: a button
                                  within a button is invalid markup, and the
                                  browser's recovery is to drop one of them.
                                */}
                                {/*
                                  * ==================================================
                                  * DELETE IS ON THE ROW, as it is on Leader enquiries
                                  * ==================================================
                                  *
                                  * It used to live only inside the expanded panel, so
                                  * clearing an obvious piece of spam meant OPENING it
                                  * first — which marks it read, counts it, and puts
                                  * the thing you are about to throw away through the
                                  * whole handling flow on the way to the bin.
                                  *
                                  * Same treatment as the enquiries screen: red, the
                                  * bin icon, pushed to the far end of the strip with
                                  * `ml-auto` so it is never the button next to the one
                                  * you meant to press. It is offered on EVERY row,
                                  * archived included — archiving is where things go
                                  * to be kept, and an archive you cannot clear out is
                                  * the reason people stop archiving.
                                  */}
                                <div className="ml-7 mt-1.5 flex flex-wrap items-center gap-2">
                                    {m.status !== 'archived' && (
                                        <button
                                            type="button"
                                            disabled={marking === m._id}
                                            onClick={() => markAs(m, m.status === 'new' ? 'read' : 'new')}
                                            className="inline-flex items-center gap-1.5 rounded-lg border
                                                       border-slate-300 px-2.5 py-1 text-[1.0625rem]
                                                       font-semibold text-slate-600 transition-colors
                                                       hover:border-blue-600 hover:text-blue-700
                                                       disabled:opacity-50 dark:border-[#2a2a2a]
                                                       dark:text-neutral-300"
                                        >
                                            {m.status === 'new'
                                                ? <><Check className="w-3.5 h-3.5" /> Mark as read</>
                                                : <><Undo2 className="w-3.5 h-3.5" /> Mark as unread</>}
                                        </button>
                                    )}

                                    {m.status !== 'archived' && (
                                        <button
                                            type="button"
                                            disabled={removing === m._id}
                                            onClick={() => archive(m)}
                                            className="inline-flex items-center gap-1.5 rounded-lg border
                                                       border-slate-300 px-2.5 py-1 text-[1.0625rem]
                                                       font-semibold text-slate-600 transition-colors
                                                       hover:border-blue-600 hover:text-blue-700
                                                       disabled:opacity-50 dark:border-[#2a2a2a]
                                                       dark:text-neutral-300"
                                        >
                                            <Archive className="w-3.5 h-3.5" /> Archive
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        disabled={removing === m._id}
                                        onClick={() => remove(m)}
                                        aria-label={`Delete the message from ${m.name}`}
                                        className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1
                                                   text-[1.0625rem] font-semibold text-red-600 transition-colors
                                                   hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-950/40"
                                    >
                                        {removing === m._id
                                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            : <Trash2 className="w-3.5 h-3.5" />} Delete
                                    </button>
                                </div>

                                {open === m._id && (
                                    <div className="mt-3 ml-7 bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#1f1f1f] rounded-lg p-4">
                                        <dl className="grid gap-2 sm:grid-cols-2 text-[1.1875rem] mb-3">
                                            <div><dt className="text-neutral-500 inline">Email: </dt>
                                                <dd className="text-slate-700 dark:text-neutral-300 inline">{m.email}</dd></div>
                                            {m.phone && <div><dt className="text-neutral-500 inline">Phone: </dt>
                                                <dd className="text-slate-700 dark:text-neutral-300 inline">{m.phone}</dd></div>}
                                            {m.subject && <div className="sm:col-span-2"><dt className="text-neutral-500 inline">Subject: </dt>
                                                <dd className="text-slate-700 dark:text-neutral-300 inline">{m.subject}</dd></div>}
                                        </dl>

                                        {/* Plain text, deliberately. This is untrusted input. */}
                                        <p className="text-[1.1875rem] text-slate-800 dark:text-neutral-200 whitespace-pre-wrap break-words">
                                            {m.message}
                                        </p>

                                        {/* Reply only. Archive and Delete moved up to
                                            the row, where they are reachable without
                                            opening the message — two copies of a
                                            delete a few centimetres apart is one of
                                            them pressed by accident. */}
                                        <div className="flex flex-wrap gap-2 mt-4">
                                            <a href={`mailto:${m.email}?subject=${encodeURIComponent('Re: ' + (m.subject || 'Your message'))}`}>
                                                <CmsButton type="button" variant="ghost">Reply by email</CmsButton>
                                            </a>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </CmsCard>
        </div>
    );
}
