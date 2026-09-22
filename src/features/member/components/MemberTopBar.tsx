import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bell, MessageSquare, CalendarDays, Megaphone, CheckCheck, Check, Inbox, ChevronRight,
} from 'lucide-react';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '@/services/activApi';
import { listAnnouncements, listMemberEvents } from '@/services/memberHubApi';

/**
 * The member area's icon strip: messages and alerts.
 *
 * Neither belongs in the sidebar. The rail is for places a member navigates TO
 * and stays — the dashboard, their profile, the events programme. Messages and
 * alerts are things checked in passing, from wherever they happen to be, and a
 * rail entry makes checking them a departure from the screen they were working
 * on. So they sit in the header, on every member screen, at a fixed position
 * the eye learns once.
 *
 * ---
 *
 * WHAT THE BELL COUNTS, and why it is assembled here rather than fetched.
 *
 * Three things reach a member, and only one of them is a stored notification:
 *
 *   1. `/notifications` — rows written for this member specifically. An
 *      approval, a rejection, a recorded payment. These carry their own
 *      `isRead` flag on the server.
 *   2. Events the association has published.
 *   3. Association updates it has published.
 *
 * The obvious implementation of 2 and 3 is a fan-out: when a super admin
 * publishes, write one Notification row per targeted member. That is thousands
 * of writes for one publish, it duplicates the region-targeting rules that
 * already exist in `event.service` and `announcement.service`, and the copies
 * go stale the moment an event is edited or unpublished — a member would be
 * alerted about a programme item that no longer says what the alert said.
 *
 * So the bell merges the three at read time. `listMemberEvents` and
 * `listAnnouncements` already return exactly what THIS member is entitled to
 * see, targeting and paid-audience rules included, so a derived alert cannot
 * announce something they are not allowed to open. Both calls are ones the
 * member area makes anyway, and `api.ts` de-duplicates identical GETs.
 *
 * "New" for a derived item means published since this member last opened the
 * bell. That mark is per-account in local storage rather than on the member
 * record: it is a badge, worth no schema change and no write on every glance,
 * and the worst a lost mark can do is show a member their own programme again.
 * Keyed by account, because one browser is often several people's.
 */

type FeedKind = 'notification' | 'event' | 'update';

interface FeedItem {
    id: string;
    kind: FeedKind;
    title: string;
    detail: string;
    /** ISO timestamp, or empty when the source carried none. */
    at: string;
    unread: boolean;
    to: string;
}

const SEEN_KEY = 'activ:memberFeedSeenAt';

/** One mark per account: a shared browser must not inherit a stranger's. */
const seenKey = (): string => {
    try {
        return `${SEEN_KEY}:${localStorage.getItem('userEmail') || 'anon'}`;
    } catch {
        return `${SEEN_KEY}:anon`;
    }
};

const readSeenAt = (): number => {
    try {
        const stored = Number(localStorage.getItem(seenKey()) || 0);
        return Number.isFinite(stored) ? stored : 0;
    } catch {
        return 0;
    }
};

const writeSeenAt = (value: number): void => {
    try { localStorage.setItem(seenKey(), String(value)); } catch { /* storage unavailable */ }
};

/**
 * HOW FAR BACK THE BELL LOOKS: twenty-four hours.
 *
 * It was showing whatever the three endpoints returned, which meant a panel led
 * by items from a week ago. A notification bell is a "what happened since I last
 * looked" surface, and a week-old conclave sitting at the top of it trains
 * people to stop opening it. Anything older is still on `/member/events` and
 * `/member/updates`, which the two links at the foot of the panel go to — this
 * drops nothing, it only stops the bell answering a question nobody asked it.
 */
const FEED_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * The rows this member has dismissed by hand, as ids.
 *
 * Kept ALONGSIDE `seenAt`, not instead of it, because the two answer different
 * questions. `seenAt` is "everything before this moment is old news" — one
 * value, set by opening the panel. This is "I have dealt with THIS one", which
 * has to survive a newer item arriving and pushing the timestamp forward.
 *
 * Local, and per account. Events and updates have no per-member row on the
 * server to mark — they are one record read by thousands — so there is nowhere
 * else to put this. Stored notifications are marked on the server as well, and
 * that is the copy that matters for them; this only keeps the panel honest
 * between the click and the next reload.
 */
const READ_KEY = 'activ:memberFeedRead';

const readKey = (): string => {
    try {
        return `${READ_KEY}:${localStorage.getItem('userEmail') || 'anon'}`;
    } catch {
        return `${READ_KEY}:anon`;
    }
};

const readDismissed = (): Set<string> => {
    try {
        const raw = JSON.parse(localStorage.getItem(readKey()) || '[]');
        return new Set(Array.isArray(raw) ? raw.map(String) : []);
    } catch {
        return new Set();
    }
};

const writeDismissed = (ids: Set<string>): void => {
    try {
        /*
         * Capped, and newest-first.
         *
         * Ids accumulate forever otherwise, and `localStorage` is a few
         * megabytes shared with everything else this origin stores. Two hundred
         * is far more than a 24-hour window can hold, so the cap can only ever
         * discard ids for items that have already aged out of the panel.
         */
        localStorage.setItem(readKey(), JSON.stringify([...ids].slice(-200)));
    } catch { /* storage unavailable */ }
};

const time = (value?: string | null): number => {
    if (!value) return 0;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
};

/** "3h ago", "2 Sept". Relative while it is still news, dated once it is not. */
const when = (value: string): string => {
    const at = time(value);
    if (!at) return '';

    const mins = Math.round((Date.now() - at) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
    if (mins < 10080) return `${Math.round(mins / 1440)}d ago`;

    return new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const ICONS: Record<FeedKind, typeof Bell> = {
    notification: Bell,
    event: CalendarDays,
    update: Megaphone,
};

export default function MemberTopBar({ className = '' }: { className?: string }) {
    const navigate = useNavigate();

    const [items, setItems] = useState<FeedItem[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const panelRef = useRef<HTMLDivElement | null>(null);

    const load = useCallback(async () => {
        const seenAt = readSeenAt();

        /*
         * `allSettled`, and every branch degrades to nothing.
         *
         * A bell that throws takes the header down with it, and the header is
         * on every member screen. An empty bell is a bell with no news; a
         * broken one is a broken member area.
         */
        const [personal, events, updates] = await Promise.allSettled([
            getNotifications(1, 10),
            listMemberEvents(),
            listAnnouncements({ limit: 10 }),
        ]);

        const rows: FeedItem[] = [];

        if (personal.status === 'fulfilled') {
            (personal.value?.notifications || []).forEach((row: any) => {
                const id = String(row?._id || row?.id || '');
                if (!id) return;

                rows.push({
                    id: `n:${id}`,
                    kind: 'notification',
                    title: String(row?.title || 'Update'),
                    detail: String(row?.message || ''),
                    at: row?.createdAt || '',
                    unread: row?.isRead !== true,
                    // Nearly every stored notification is about the application.
                    to: '/member/application-status',
                });
            });
        }

        if (events.status === 'fulfilled') {
            (events.value?.events || []).forEach((event) => {
                // The moment the association told members about it. Falls back to
                // the event's own start so an item is never sorted to 1970.
                const at = (event as any).publishedAt || (event as any).createdAt || event.startAt || '';

                rows.push({
                    id: `e:${event.id}`,
                    kind: 'event',
                    title: event.title || 'New event',
                    detail: [event.venue, event.district].filter(Boolean).join(' · ')
                        || 'A new event has been published',
                    at,
                    unread: time(at) > seenAt,
                    to: `/member/events/${event.id}`,
                });
            });
        }

        if (updates.status === 'fulfilled') {
            (updates.value?.announcements || []).forEach((update) => {
                const at = update.publishedAt || '';

                rows.push({
                    id: `u:${update.id}`,
                    kind: 'update',
                    title: update.title || 'Association update',
                    detail: update.summary || update.targetLabel || 'A new notice has been published',
                    at,
                    unread: time(at) > seenAt,
                    to: `/member/updates/${update.id}`,
                });
            });
        }

        /*
         * The last twenty-four hours, and nothing older.
         *
         * An item with NO usable date is kept. A missing timestamp is missing
         * information, not proof of age, and dropping those would silently hide
         * a stored notification whose `createdAt` failed to parse — the one kind
         * of row that is written for this member specifically.
         */
        const cutoff = Date.now() - FEED_WINDOW_MS;
        const recent = rows.filter((row) => !row.at || time(row.at) >= cutoff);

        // Dismissed by hand beats every other signal: a row the member has
        // ticked off stays ticked off even if it is newer than `seenAt`.
        const dismissed = readDismissed();
        recent.forEach((row) => { if (dismissed.has(row.id)) row.unread = false; });

        recent.sort((a, b) => time(b.at) - time(a.at));
        setItems(recent.slice(0, 20));
        setLoading(false);
    }, []);

    useEffect(() => {
        load();

        /*
         * The same three events the rest of the member area listens to. A
         * recorded payment changes which updates and events this member may
         * see, so the bell has to be rebuilt rather than left holding the
         * applicant's answer.
         */
        window.addEventListener('paymentCompleted', load);
        window.addEventListener('formSubmitted', load);
        window.addEventListener('profileUpdated', load);

        return () => {
            window.removeEventListener('paymentCompleted', load);
            window.removeEventListener('formSubmitted', load);
            window.removeEventListener('profileUpdated', load);
        };
    }, [load]);

    /** Close on an outside click and on Escape — a panel, not a page. */
    useEffect(() => {
        if (!open) return undefined;

        const onDown = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };

        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);

        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const unreadCount = useMemo(() => items.filter((item) => item.unread).length, [items]);

    /**
     * Reading the panel is what marks it read — of the derived items.
     *
     * The stored notifications are marked on the server in the same gesture, so
     * the count agrees with itself on the next load. It is fire-and-forget: a
     * failed mark means the badge comes back, which is recoverable, whereas
     * blocking the panel on a network call is not what a bell is for.
     */
    const markRead = useCallback(() => {
        writeSeenAt(Date.now());

        /*
         * THE IDS ARE RECORDED TOO, not just the timestamp.
         *
         * `seenAt` alone says "anything dated before this moment is old news",
         * and that is one date comparison away from being wrong. An event with
         * no `publishedAt` and no `createdAt` falls back to its own `startAt`,
         * which is in the FUTURE — so `time(at) > seenAt` stayed true forever
         * and the badge came straight back on the next load, however many times
         * the member pressed this. Dismissed ids beat every other signal (see
         * the merge in `load`), so recording them is what makes "mark all read"
         * actually stay read.
         *
         * This is `markOne` applied to every unread row, which is exactly what
         * the control claims to do.
         */
        const dismissed = readDismissed();
        items.forEach((item) => { if (item.unread) dismissed.add(item.id); });
        writeDismissed(dismissed);

        setItems((current) => current.map((item) => ({ ...item, unread: false })));

        if (items.some((item) => item.kind === 'notification' && item.unread)) {
            markAllNotificationsRead().catch(() => { /* the badge returning is the fallback */ });
        }
    }, [items]);

    /**
     * One row, marked read on its own.
     *
     * A stored notification has a row of its own on the server and is marked
     * there. An event or an update does not — one record is read by thousands of
     * members — so the only place to record "I have dealt with this one" is
     * locally, which is what `dismissed` is for.
     *
     * Fire-and-forget for the same reason `markRead` is: a failed call means the
     * dot comes back on the next load, which is recoverable and quiet. Blocking
     * a tick on the network is not what a bell is for.
     */
    const markOne = useCallback((item: FeedItem) => {
        const dismissed = readDismissed();
        dismissed.add(item.id);
        writeDismissed(dismissed);

        setItems((current) => current.map((row) => (
            row.id === item.id ? { ...row, unread: false } : row
        )));

        if (item.kind === 'notification') {
            // `n:` is this component's own prefix — the server knows the bare id.
            markNotificationRead(item.id.replace(/^n:/, ''))
                .catch(() => { /* the dot returning is the fallback */ });
        }
    }, []);

    /*
     * OPENING THE PANEL NO LONGER MARKS EVERYTHING READ.
     *
     * It used to, which made the unread dots decorative: they were gone by the
     * time anyone could look at them, and there was nothing left for a per-row
     * control to do. Marking is now something the member does — one row at a
     * time, or all of them with the button in the header.
     */
    const openPanel = () => setOpen((current) => !current);

    const go = (to: string) => {
        setOpen(false);
        navigate(to);
    };

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            {/* ---------------------------------------------- messages ---------- */}
            <button
                type="button"
                onClick={() => navigate('/member/messages')}
                aria-label="Messages"
                title="Messages"
                className="w-[3.25rem] h-[3.25rem] rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm
                           hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50
                           flex items-center justify-center transition-colors shrink-0"
            >
                {/* 24px, not 20px — these two are the only controls in the
                    header and they were reading as decoration beside a
                    40px page title. */}
                <MessageSquare className="w-6 h-6" />
            </button>

            {/* ---------------------------------------------- alerts ------------ */}
            <div className="relative" ref={panelRef}>
                <button
                    type="button"
                    onClick={openPanel}
                    aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} new` : 'Notifications'}
                    aria-expanded={open}
                    title="Notifications"
                    className={`w-[3.25rem] h-[3.25rem] rounded-xl border shadow-sm flex items-center justify-center
                                transition-colors shrink-0 relative ${
                        open
                            ? 'border-blue-400 bg-blue-50 text-blue-600'
                            : 'border-slate-200 bg-white text-slate-600 hover:text-blue-600 '
                              + 'hover:border-blue-400 hover:bg-blue-50'
                    }`}
                >
                    <Bell className="w-6 h-6" />

                    {unreadCount > 0 ? (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[1.25rem] h-5 px-1.5
                                         rounded-full bg-red-500 text-white text-[0.8125rem] font-bold
                                         ring-2 ring-white
                                         flex items-center justify-center tabular-nums">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    ) : null}
                </button>

                {open ? (
                    <div
                        className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))]
                                   rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden"
                    >
                        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b
                                        border-slate-100">
                            <p className="text-[1.1875rem] font-bold text-slate-900">Notifications</p>

                            {/*
                              MARK EVERYTHING READ — a real control.

                              This was a <span>: a tick, the words "All read", and
                              no handler. It looked exactly like the button it was
                              pretending to be, sat where that button belongs, and
                              did nothing when pressed — so the only way to clear
                              the badge was to tick every row individually, and a
                              member who pressed the obvious thing was left with
                              the number still on the bell.

                              Shown only while something IS unread. Offering "mark
                              all read" over a panel with nothing unread in it is a
                              control whose only possible effect is nothing.
                            */}
                            {unreadCount > 0 ? (
                                <button
                                    type="button"
                                    onClick={markRead}
                                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1
                                               text-[0.8125rem] font-semibold text-blue-600
                                               transition-colors hover:bg-blue-50 hover:text-blue-700
                                               focus-visible:outline focus-visible:outline-2
                                               focus-visible:outline-offset-1 focus-visible:outline-blue-500"
                                >
                                    <CheckCheck className="w-3.5 h-3.5" />
                                    Mark all read
                                </button>
                            ) : null}
                        </div>

                        <div className="max-h-[24rem] overflow-y-auto">
                            {loading ? (
                                <div className="p-4 space-y-3" aria-hidden>
                                    {[0, 1, 2].map((i) => (
                                        <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />
                                    ))}
                                </div>
                            ) : items.length === 0 ? (
                                <div className="py-10 px-5 text-center">
                                    <span className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-400 mx-auto
                                                     mb-3 flex items-center justify-center">
                                        <Inbox className="w-5 h-5" />
                                    </span>
                                    <p className="text-[1rem] font-semibold text-slate-700">
                                        Nothing in the last 24 hours
                                    </p>
                                    {/* The window is named, because an empty bell
                                        beside a full events page otherwise reads
                                        as a bell that has stopped working. The two
                                        links below reach everything older. */}
                                    <p className="text-[1.0625rem] text-slate-500 mt-1">
                                        New events and association notices appear here for a day.
                                        Everything else is under All events and All updates.
                                    </p>
                                </div>
                            ) : (
                                <ul className="divide-y divide-slate-100">
                                    {items.map((item) => {
                                        const Icon = ICONS[item.kind];

                                        return (
                                            /*
                                              `group` and `relative`: the tick sits
                                              over the row rather than inside it.
                                              Nesting a button in a button is
                                              invalid HTML and the inner click
                                              would fire the outer one too — which
                                              here means marking a row read
                                              navigates away from the panel.
                                            */
                                            <li key={item.id} className="relative group">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        // Opening a row IS reading
                                                        // it. The tick beside it is
                                                        // for clearing something
                                                        // without going to it.
                                                        if (item.unread) markOne(item);
                                                        go(item.to);
                                                    }}
                                                    className={`w-full flex items-start gap-3 py-3 pl-4 text-left
                                                                hover:bg-slate-50 transition-colors ${
                                                        item.unread ? 'pr-12' : 'pr-4'
                                                    }`}
                                                >
                                                    <span className={`w-9 h-9 rounded-xl flex items-center
                                                                      justify-center shrink-0 ${
                                                        item.kind === 'event'
                                                            ? 'bg-emerald-50 text-emerald-600'
                                                            : item.kind === 'update'
                                                                ? 'bg-amber-50 text-amber-600'
                                                                : 'bg-blue-50 text-blue-600'
                                                    }`}>
                                                        <Icon className="w-4 h-4" />
                                                    </span>

                                                    <span className="min-w-0 flex-1">
                                                        <span className="flex items-center gap-1.5">
                                                            <span className="text-[1rem] font-semibold
                                                                             text-slate-900 truncate">
                                                                {item.title}
                                                            </span>
                                                            {item.unread ? (
                                                                <span className="w-1.5 h-1.5 rounded-full
                                                                                 bg-blue-600 shrink-0" />
                                                            ) : null}
                                                        </span>
                                                        <span className="block text-[1.0625rem] text-slate-500
                                                                         mt-0.5 line-clamp-2 leading-snug">
                                                            {item.detail}
                                                        </span>
                                                        <span className="block text-[0.8125rem] text-slate-400
                                                                         mt-1">
                                                            {when(item.at)}
                                                        </span>
                                                    </span>
                                                </button>

                                                {/*
                                                  Mark this one read, without
                                                  opening it.

                                                  Only on unread rows — a tick on
                                                  something already read does
                                                  nothing and reads as a control
                                                  that is broken. Always visible on
                                                  touch, where there is no hover to
                                                  reveal it with; the `sm:` pair
                                                  fades it in on a pointer device
                                                  so a quiet panel stays quiet.
                                                */}
                                                {item.unread && (
                                                    <button
                                                        type="button"
                                                        onClick={() => markOne(item)}
                                                        aria-label={`Mark "${item.title}" as read`}
                                                        title="Mark as read"
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5
                                                                   rounded-lg text-slate-400 hover:text-blue-600
                                                                   hover:bg-blue-50 transition-all
                                                                   sm:opacity-0 sm:group-hover:opacity-100
                                                                   sm:focus-visible:opacity-100"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>

                        <div className="border-t border-slate-100 grid grid-cols-2 divide-x divide-slate-100">
                            <button
                                type="button"
                                onClick={() => go('/member/events')}
                                className="px-4 py-3 text-[1.0625rem] font-semibold text-blue-600
                                           hover:bg-blue-50 transition-colors inline-flex items-center
                                           justify-center gap-1"
                            >
                                All events <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => go('/member/updates')}
                                className="px-4 py-3 text-[1.0625rem] font-semibold text-blue-600
                                           hover:bg-blue-50 transition-colors inline-flex items-center
                                           justify-center gap-1"
                            >
                                All updates <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
