import { useEffect, useState } from 'react';
import { Mail, MailOpen, Archive, Trash2 } from 'lucide-react';
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

    useEffect(() => { load(filter); /* eslint-disable-next-line */ }, [filter]);

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

    const archive = async (m: ContactMessage) => {
        try {
            await setMessageStatus(m._id, 'archived');
            await load(filter);
        } catch (err) {
            setError(errorMessage(err, 'Could not archive the message'));
        }
    };

    const remove = async (m: ContactMessage) => {
        if (!window.confirm(`Delete the message from ${m.name}? This cannot be undone.`)) return;
        try {
            await deleteContactMessage(m._id);
            await load(filter);
        } catch (err) {
            setError(errorMessage(err, 'Could not delete the message'));
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
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            filter === f.key ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-[#161616] text-slate-700 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-[#242424]'
                        }`}
                    >
                        {f.label}
                        {f.key === 'new' && unread > 0 && (
                            <span className="ml-2 text-xs bg-red-500 text-white rounded-full px-1.5">{unread}</span>
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
                                            <span className="text-xs text-neutral-500 truncate">{m.email}</span>
                                        </div>
                                        <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate">
                                            {m.subject || m.message}
                                        </p>
                                    </div>

                                    <span className="text-xs text-neutral-500 shrink-0 whitespace-nowrap">
                                        {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : ''}
                                    </span>
                                </button>

                                {open === m._id && (
                                    <div className="mt-3 ml-7 bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#1f1f1f] rounded-lg p-4">
                                        <dl className="grid gap-2 sm:grid-cols-2 text-sm mb-3">
                                            <div><dt className="text-neutral-500 inline">Email: </dt>
                                                <dd className="text-slate-700 dark:text-neutral-300 inline">{m.email}</dd></div>
                                            {m.phone && <div><dt className="text-neutral-500 inline">Phone: </dt>
                                                <dd className="text-slate-700 dark:text-neutral-300 inline">{m.phone}</dd></div>}
                                            {m.subject && <div className="sm:col-span-2"><dt className="text-neutral-500 inline">Subject: </dt>
                                                <dd className="text-slate-700 dark:text-neutral-300 inline">{m.subject}</dd></div>}
                                        </dl>

                                        {/* Plain text, deliberately. This is untrusted input. */}
                                        <p className="text-sm text-slate-800 dark:text-neutral-200 whitespace-pre-wrap break-words">
                                            {m.message}
                                        </p>

                                        <div className="flex flex-wrap gap-2 mt-4">
                                            <a href={`mailto:${m.email}?subject=${encodeURIComponent('Re: ' + (m.subject || 'Your message'))}`}>
                                                <CmsButton type="button" variant="ghost">Reply by email</CmsButton>
                                            </a>
                                            {m.status !== 'archived' && (
                                                <CmsButton type="button" variant="ghost" onClick={() => archive(m)}>
                                                    <Archive className="w-4 h-4" /> Archive
                                                </CmsButton>
                                            )}
                                            <CmsButton type="button" variant="danger" onClick={() => remove(m)}>
                                                <Trash2 className="w-4 h-4" /> Delete
                                            </CmsButton>
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
