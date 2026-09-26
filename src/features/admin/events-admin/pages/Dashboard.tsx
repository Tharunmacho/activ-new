import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CalendarDays, CalendarPlus, CalendarClock, History, RefreshCw, Loader2,
    MapPin, ArrowRight, Tags, FileEdit, CheckCircle2, Images, Newspaper, Landmark, Settings as SettingsIcon, FilePen,
} from 'lucide-react';
import AdminSidebar from '@/features/admin/components/AdminSidebar';
import {
    AdminPageHeader, AdminStat, ADMIN_BG, ADMIN_PAGE, ADMIN_CARD, ADMIN_SECONDARY_BTN,
} from '@/features/admin/components/AdminUI';
import { AdminChip } from '@/features/admin/components/AdminTable';
import { errorMessage } from '@/services/api';
import { getGallery, getCmsEventsForEditor, type CmsEvent } from '@/services/cmsApi';
import { listNewsAdmin } from '@/services/cmsNewsApi';
import { listSchemesAdmin } from '@/services/cmsSchemesApi';
import { CARD_TITLE } from '@/components/layout/appTypography';

/**
 * The Events Admin's landing page.
 *
 * NO BOOKINGS AND NO MONEY. Attendees and takings are the super admin's alone
 * (`BOOKING_VIEWERS` in the server's event.routes.js), so every figure here
 * comes from the events themselves — `getCmsEventsForEditor`, the same list
 * the event editor reads, drafts included because this person writes them.
 *
 * The screens it links to are the super admin's own (All events, Categories),
 * mounted under `/events-admin`, and the CMS's own Gallery, News and Schemes
 * editors, mounted the same way.
 *
 * The content counts come from those editors' own list endpoints and load
 * separately: a gallery that fails to answer must not blank the event figures,
 * so each count shows a dash on its own failure instead.
 */

const formatDay = (iso: string | null) => {
    if (!iso) return '';
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return '';
    return at.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTime = (iso: string | null) => {
    if (!iso) return '';
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return '';
    return at.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
};

/** Undated events are not past — a missing date is missing information. */
const isUpcoming = (row: CmsEvent) =>
    !row?.startAt || new Date(row.endAt || row.startAt).getTime() >= Date.now();

/** Opens that event's form in the editor — `EventsManager` reads `?event=`. */
const editLink = (id: string) => `/events-admin/events?event=${encodeURIComponent(id)}`;

/** One content collection's tallies; `null` while loading or when it failed. */
type ContentCount = { total: number; live: number; other: number } | null;

const tally = (rows: Array<{ status?: string }> | undefined): ContentCount => {
    const list = rows || [];
    const live = list.filter((r) => (r?.status || '') === 'published').length;
    return { total: list.length, live, other: list.length - live };
};


export default function EventsAdminDashboard() {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [events, setEvents] = useState<CmsEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [gallery, setGallery] = useState<ContentCount>(null);
    const [news, setNews] = useState<ContentCount>(null);
    const [schemes, setSchemes] = useState<ContentCount>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            setEvents((await getCmsEventsForEditor()) || []);
        } catch (err) {
            setError(errorMessage(err, 'Could not load the events'));
        } finally {
            setLoading(false);
        }
    }, []);

    const loadContent = useCallback(async () => {
        const [g, n, sc] = await Promise.allSettled([getGallery(true), listNewsAdmin(), listSchemesAdmin()]);
        if (g.status === 'fulfilled') {
            const items = g.value || [];
            const shown = items.filter((i) => i?.visible !== false).length;
            setGallery({ total: items.length, live: shown, other: items.length - shown });
        }
        if (n.status === 'fulfilled') setNews(tally(n.value?.news));
        if (sc.status === 'fulfilled') setSchemes(tally(sc.value?.schemes));
    }, []);

    const refresh = useCallback(() => { load(); loadContent(); }, [load, loadContent]);

    useEffect(() => { load(); loadContent(); }, [load, loadContent]);

    const counts = useMemo(() => {
        const list = events || [];
        return {
            all: list.length,
            published: list.filter((e) => e.status === 'published').length,
            drafts: list.filter((e) => e.status !== 'published').length,
            upcoming: list.filter(isUpcoming).length,
            past: list.filter((e) => !isUpcoming(e)).length,
        };
    }, [events]);

    /* The next events, soonest first; undated ones lead, as on every events list. */
    const upcoming = useMemo(() => (events || [])
        .filter(isUpcoming)
        .sort((a, b) => {
            if (!a.startAt) return -1;
            if (!b.startAt) return 1;
            return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
        })
        .slice(0, 6), [events]);

    /* Written but not yet public — what this person still has to finish. */
    const drafts = useMemo(() => (events || []).filter((e) => e?.status !== 'published').slice(0, 5), [events]);

    const shortcuts = [
        { label: 'Create an event', hint: 'Write, schedule and publish', icon: <CalendarPlus className="w-5 h-5" />, to: '/events-admin/events' },
        { label: 'Manage categories', hint: 'The chips events are filed under', icon: <Tags className="w-5 h-5" />, to: '/events-admin/events/categories' },
        { label: 'Post to the gallery', hint: 'Albums and photographs', icon: <Images className="w-5 h-5" />, to: '/events-admin/gallery' },
        { label: 'Write news', hint: 'National, state and district stories', icon: <Newspaper className="w-5 h-5" />, to: '/events-admin/news' },
        { label: 'Add a scheme', hint: 'Central, state and district schemes', icon: <Landmark className="w-5 h-5" />, to: '/events-admin/schemes' },
        { label: 'Account settings', hint: 'Your profile and password', icon: <SettingsIcon className="w-5 h-5" />, to: '/events-admin/settings' },
    ];

    const countValue = (c: ContentCount) => (c ? String(c.total) : '–');

    return (
        <div className={`flex h-screen ${ADMIN_BG}`}>
            <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <AdminPageHeader
                    title="Events Dashboard"
                    subtitle="The programme at a glance — your events, and the gallery, news and schemes you publish."
                    onMenu={() => setSidebarOpen(true)}
                    actions={
                        <button type="button" onClick={refresh} className={ADMIN_SECONDARY_BTN} disabled={loading}>
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            Refresh
                        </button>
                    }
                />

                <div className={`flex-1 overflow-y-auto ${ADMIN_PAGE}`}>
                    {error && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4
                                        text-[1.25rem] font-semibold text-rose-700">
                            {error}
                        </div>
                    )}

                    {/* ------------------------------------------------ figures */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <AdminStat
                            icon={<CalendarDays className="w-5 h-5" />}
                            label="Events"
                            value={String(counts.all)}
                            hint={`${counts.published} published · ${counts.drafts} draft${counts.drafts === 1 ? '' : 's'}`}
                            tone="blue"
                            primary
                            onClick={() => navigate('/events-admin/events')}
                        />
                        <AdminStat
                            icon={<CalendarClock className="w-5 h-5" />}
                            label="Upcoming"
                            value={String(counts.upcoming)}
                            hint="still to happen, undated included"
                            tone="violet"
                            onClick={() => navigate('/events-admin/events')}
                        />
                        <AdminStat
                            icon={<History className="w-5 h-5" />}
                            label="Past"
                            value={String(counts.past)}
                            hint="already held"
                            tone="emerald"
                            onClick={() => navigate('/events-admin/events')}
                        />
                        <AdminStat
                            icon={<FilePen className="w-5 h-5" />}
                            label="Drafts"
                            value={String(counts.drafts)}
                            hint="not yet on the site"
                            tone="amber"
                            onClick={() => navigate('/events-admin/events')}
                        />
                    </div>

                    {/* ----------------------------------------- website content */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <AdminStat
                            icon={<Images className="w-5 h-5" />}
                            label="Gallery albums"
                            value={countValue(gallery)}
                            hint={gallery ? `${gallery.live} on the site · ${gallery.other} hidden` : 'loading…'}
                            tone="violet"
                            onClick={() => navigate('/events-admin/gallery')}
                        />
                        <AdminStat
                            icon={<Newspaper className="w-5 h-5" />}
                            label="News articles"
                            value={countValue(news)}
                            hint={news ? `${news.live} published · ${news.other} draft${news.other === 1 ? '' : 's'}` : 'loading…'}
                            tone="blue"
                            onClick={() => navigate('/events-admin/news')}
                        />
                        <AdminStat
                            icon={<Landmark className="w-5 h-5" />}
                            label="Schemes"
                            value={countValue(schemes)}
                            hint={schemes ? `${schemes.live} published · ${schemes.other} draft${schemes.other === 1 ? '' : 's'}` : 'loading…'}
                            tone="emerald"
                            onClick={() => navigate('/events-admin/schemes')}
                        />
                    </div>

                    {/* ---------------------------------------------- shortcuts
                        Six, three to a row — two even rows on a desktop, one
                        column on a phone. */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {shortcuts.map((s) => (
                            <button
                                key={s.to}
                                type="button"
                                onClick={() => navigate(s.to)}
                                className={`${ADMIN_CARD} p-5 text-left flex items-center gap-4
                                            hover:border-blue-300 hover:shadow-md transition-all group`}
                            >
                                <span className="w-12 h-12 shrink-0 rounded-xl bg-blue-50 text-blue-600
                                                 flex items-center justify-center">
                                    {s.icon}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[1.25rem] font-semibold text-slate-900">{s.label}</span>
                                    <span className="block text-[1.125rem] leading-snug text-slate-500 mt-0.5">{s.hint}</span>
                                </span>
                                <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 shrink-0" />
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        {/* ------------------------------------------ upcoming */}
                        <section className={`${ADMIN_CARD} xl:col-span-2 min-w-0`}>
                            <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-100">
                                <h2 className={CARD_TITLE}>Upcoming events</h2>
                                <button
                                    type="button"
                                    onClick={() => navigate('/events-admin/events')}
                                    className="text-[1.125rem] font-semibold text-blue-600 hover:text-blue-700
                                               inline-flex items-center gap-1"
                                >
                                    All events <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>

                            {loading ? (
                                <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
                            ) : upcoming.length === 0 ? (
                                <p className="px-6 py-8 text-[1.25rem] text-slate-500">
                                    Nothing upcoming. Create an event under <strong className="text-slate-700">All events</strong>.
                                </p>
                            ) : (
                                <ul className="divide-y divide-slate-100">
                                    {upcoming.map((e) => (
                                        <li key={e.id}>
                                            <button
                                                type="button"
                                                onClick={() => navigate(editLink(e.id))}
                                                className="w-full text-left px-5 sm:px-6 py-4 hover:bg-slate-50
                                                           flex items-center gap-4 min-w-0"
                                            >
                                                <div className="w-14 shrink-0 rounded-xl bg-blue-50 text-blue-700 text-center py-2">
                                                    <div className="text-[1.375rem] font-bold leading-none">
                                                        {e.startAt ? new Date(e.startAt).getDate() : '–'}
                                                    </div>
                                                    <div className="text-[0.9375rem] font-semibold uppercase mt-1">
                                                        {e.startAt ? new Date(e.startAt).toLocaleDateString('en-IN', { month: 'short' }) : 'TBC'}
                                                    </div>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-[1.25rem] font-semibold text-slate-900 truncate">
                                                        {e.title || 'Untitled event'}
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[1.125rem] text-slate-500">
                                                        <span>
                                                            {formatDay(e.startAt) || 'Date to be confirmed'}
                                                            {e.startAt && formatTime(e.startAt) ? ` · ${formatTime(e.startAt)}` : ''}
                                                        </span>
                                                        {!!e.venue && (
                                                            <span className="inline-flex items-center gap-1 truncate max-w-[14rem]">
                                                                <MapPin className="w-4 h-4 shrink-0" />
                                                                <span className="truncate">{e.venue}</span>
                                                            </span>
                                                        )}
                                                        {e.status !== 'published'
                                                            ? <AdminChip tone="slate">Draft</AdminChip>
                                                            : <AdminChip tone="emerald">Published</AdminChip>}
                                                    </div>
                                                </div>
                                                <ArrowRight className="hidden sm:block w-5 h-5 text-slate-300 shrink-0" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        {/* ------------------------------------------- drafts */}
                        <section className={`${ADMIN_CARD} min-w-0`}>
                            <div className="px-5 sm:px-6 py-4 border-b border-slate-100">
                                <h2 className={CARD_TITLE}>Drafts to finish</h2>
                            </div>
                            {loading ? (
                                <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
                            ) : drafts.length === 0 ? (
                                <div className="px-6 py-8 flex items-start gap-3 text-[1.1875rem] text-slate-500">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                    No drafts — every event you have written is published.
                                </div>
                            ) : (
                                <ul className="divide-y divide-slate-100">
                                    {drafts.map((e) => (
                                        <li key={e.id}>
                                            <button
                                                type="button"
                                                onClick={() => navigate(editLink(e.id))}
                                                className="w-full text-left px-5 sm:px-6 py-4 hover:bg-slate-50"
                                            >
                                                <div className="text-[1.1875rem] font-semibold text-slate-900 truncate">
                                                    {e.title || 'Untitled event'}
                                                </div>
                                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[1.125rem] text-slate-500">
                                                    <AdminChip tone="slate">Draft</AdminChip>
                                                    <span>{formatDay(e.startAt) || 'Date to be confirmed'}</span>
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <div className="px-5 sm:px-6 py-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => navigate('/events-admin/events')}
                                    className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl
                                               bg-blue-600 text-white text-[1.1875rem] font-semibold hover:bg-blue-700"
                                >
                                    <FileEdit className="w-4 h-4" /> Open the event editor
                                </button>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
