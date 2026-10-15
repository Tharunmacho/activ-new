import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    CalendarDays, MapPin, RefreshCw, Loader2, UserCheck, Users, Clock, Percent,
    FileSpreadsheet, ArrowLeft, QrCode, Keyboard, Smartphone,
} from 'lucide-react';
import AdminSidebar from './AdminSidebar';
import {
    AdminPageHeader, AdminStat, ADMIN_BG, ADMIN_PAGE, ADMIN_SECONDARY_BTN,
} from '@/features/admin/components/AdminUI';
import { AdminTable, AdminChip, AdminCount, type AdminColumn }
    from '@/features/admin/components/AdminTable';
import {
    listCheckinEvents, getAttendance, exportAttendanceCsv,
    type CheckinEvent, type Attendance, type AttendanceRow,
} from '@/services/eventCheckinApi';
import { errorMessage } from '@/services/api';
import { adminBasePath } from '@/features/admin/components/tierConfig';

/**
 * ATTENDANCE — who came through the door, per event.
 *
 * The other end of the QR entry passes. Every participant on a confirmed
 * booking gets a pass in their confirmation email; the events staff scan it in
 * the ACTIV app and press "Allow entry", which writes one check-in record
 * (event-checkin). This screen reads those records back against every seat
 * that was entitled to enter.
 *
 * NOTHING HERE MARKS ATTENDANCE. The door is the app, where a signed-in staff
 * member is standing in front of the attendee and their ID. A "mark present"
 * button on a desk screen would be attendance nobody witnessed.
 *
 * Shared by both portals through `adminBasePath()`. The server decides what
 * each sees: the super admin's rows and Excel report carry email and mobile; the events
 * admin gets names and a masked number only (event.routes, ATTENDANCE_VIEWERS).
 */

const formatDay = (iso: string | null) => {
    if (!iso) return 'Date to be confirmed';
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return 'Date to be confirmed';
    return at.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
};

/* ================================================================ event list */

function AttendanceEvents() {
    const navigate = useNavigate();
    const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');
    const [rows, setRows] = useState<CheckinEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = await listCheckinEvents(scope);
            setRows(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(errorMessage(err, 'The events could not be loaded'));
        } finally {
            setLoading(false);
        }
    }, [scope]);

    useEffect(() => { load(); }, [load]);

    const open = useCallback(
        (row: CheckinEvent) => navigate(`${adminBasePath()}/attendance/${row.id}`),
        [navigate],
    );

    const totals = useMemo(() => (rows || []).reduce(
        (t, r) => ({ registered: t.registered + Number(r.registered || 0), checkedIn: t.checkedIn + Number(r.checkedIn || 0) }),
        { registered: 0, checkedIn: 0 },
    ), [rows]);

    const columns: AdminColumn<CheckinEvent>[] = useMemo(() => [
        {
            key: 'title',
            header: 'Event',
            sortValue: (r) => r.title || '',
            render: (r) => (
                <div className="min-w-0">
                    <div className="text-ui-body font-semibold tracking-tight text-slate-900 break-words">
                        {r.title || 'Untitled event'}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-ui-small text-slate-500">
                        <span className="inline-flex items-center gap-1">
                            <CalendarDays className="w-4 h-4" />{formatDay(r.startAt)}
                        </span>
                        {!!r.venue && (
                            <span className="inline-flex items-center gap-1 min-w-0 max-w-[16rem]">
                                <MapPin className="w-4 h-4 shrink-0" /><span className="break-words">{r.venue}</span>
                            </span>
                        )}
                        {r.isToday && <AdminChip tone="emerald">Today</AdminChip>}
                        {r.mode === 'online' && <AdminChip tone="slate">Online</AdminChip>}
                    </div>
                </div>
            ),
        },
        {
            key: 'registered',
            header: 'Registered',
            align: 'center',
            width: 'w-32',
            sortValue: (r) => r.registered,
            render: (r) => <AdminCount tone="blue">{r.registered}</AdminCount>,
        },
        {
            key: 'checkedIn',
            header: 'Checked in',
            align: 'center',
            width: 'w-40',
            sortValue: (r) => r.checkedIn,
            render: (r) => {
                const share = r.registered > 0 ? Math.min(1, r.checkedIn / r.registered) : 0;
                return (
                    <div className="flex flex-col items-center gap-1.5">
                        <AdminCount tone="emerald">{r.checkedIn}</AdminCount>
                        {r.registered > 0 && (
                            <div className="w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round(share * 100)}%` }} />
                            </div>
                        )}
                    </div>
                );
            },
        },
        {
            key: 'action',
            header: 'Action',
            align: 'right',
            sticky: 'right',
            width: 'w-44',
            render: (r) => (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); open(r); }}
                    className="inline-flex max-w-full items-center justify-center gap-1.5 min-h-11 px-4 py-2 rounded-xl bg-blue-600 text-ui-small
                               font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors whitespace-normal"
                >
                    <UserCheck className="w-4 h-4 shrink-0" /> Attendance
                </button>
            ),
        },
    ], [open]);

    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4" data-attendance-stats>
                <AdminStat icon={<Users className="w-5 h-5" />} label="Registered" value={String(totals.registered)}
                    hint={`seats on ${rows.length} ${scope === 'past' ? 'past' : 'current'} events`} tone="blue" primary />
                <AdminStat icon={<UserCheck className="w-5 h-5" />} label="Checked in" value={String(totals.checkedIn)}
                    hint="let in at the door with the ACTIV app" tone="emerald" />
            </div>

            {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 sm:px-5 py-3 sm:py-4 break-words text-ui-body font-semibold text-rose-700">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-1 p-1 rounded-xl bg-slate-100 w-full sm:w-auto sm:inline-flex" aria-label="Event period">
                {([['upcoming', 'Today & upcoming'], ['past', 'Past']] as const).map(([value, label]) => (
                    <button
                        key={value}
                        type="button"
                        onClick={() => setScope(value)}
                        aria-pressed={scope === value}
                        className={`min-w-0 min-h-11 sm:min-h-12 px-3 sm:px-6 py-2 rounded-xl text-ui-caption sm:text-ui-body font-semibold whitespace-normal transition-colors
                                    ${scope === value ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <AdminTable
                rows={rows}
                columns={columns}
                rowKey={(r, i) => String(r?.id || i)}
                loading={loading}
                onRowClick={open}
                searchable
                searchPlaceholder="Search events"
                minWidth="52rem"
                cardBreakpoint={832}
                empty={scope === 'past' ? 'No past events.' : 'No published events from the last two days onward.'}
            />

            <p className="text-ui-body text-slate-500 leading-relaxed max-w-3xl">
                <strong className="font-semibold text-slate-700">Registered</strong> counts seats on paid or free
                confirmed bookings — the people entitled to walk in. Unpaid, cancelled and waitlisted bookings are
                not counted, and their passes are refused at the door.
            </p>
        </>
    );
}

/* ================================================================ one event */

function AttendanceDetail({ eventId }: { eventId: string }) {
    const [data, setData] = useState<Attendance | null>(null);
    const [status, setStatus] = useState<'all' | 'in' | 'out'>('all');
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            setData(await getAttendance(eventId, { status }));
        } catch (err) {
            setError(errorMessage(err, 'The attendance could not be loaded'));
        } finally {
            setLoading(false);
        }
    }, [eventId, status]);

    useEffect(() => { load(); }, [load]);

    // A door that is open fills this list by the minute: refresh while the page is visible.
    useEffect(() => {
        const timer = window.setInterval(() => {
            if (document.visibilityState === 'visible') load();
        }, 60000);
        return () => window.clearInterval(timer);
    }, [load]);

    const onExport = async () => {
        setExporting(true);
        try {
            await exportAttendanceCsv(eventId, data?.event?.title || 'event');
        } catch (err) {
            setError(errorMessage(err, 'The export failed'));
        } finally {
            setExporting(false);
        }
    };

    const withContact = !!data?.includeContact;
    const columns: AdminColumn<AttendanceRow>[] = useMemo(() => [
        {
            key: 'name',
            header: 'Attendee',
            sortValue: (r) => r.name || '',
            render: (r) => (
                <div className="min-w-0">
                    <div className="text-ui-body font-semibold text-slate-900 break-words">{r.name || 'Attendee'}</div>
                    <div className="mt-1 text-ui-small text-slate-500 font-mono break-all">{r.registrationNo}</div>
                    {withContact && (r.email || r.phone) ? (
                        <div className="mt-1 text-ui-small text-slate-500 break-words">
                            {[r.phone, r.email].filter(Boolean).join(' · ')}
                        </div>
                    ) : (!!r.phoneMasked && <div className="mt-1 text-ui-small text-slate-400">{r.phoneMasked}</div>)}
                </div>
            ),
        },
        {
            key: 'bookedBy',
            header: 'Booked by',
            hideOnMobile: true,
            width: 'w-56',
            sortValue: (r) => r.bookedBy || '',
            render: (r) => (
                <div className="min-w-0">
                    <div className="text-ui-small text-slate-700 break-words">{r.bookedBy || '—'}</div>
                    <div className="mt-1 text-ui-caption text-slate-400">Seat {r.participantNumber}{r.payment ? ` · ${r.payment}` : ''}</div>
                </div>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            width: 'w-40',
            sortValue: (r) => (r.checkedIn ? 1 : 0),
            render: (r) => (r.checkedIn
                ? <AdminChip tone="emerald" title={r.bookingStatus === 'changed' ? 'Checked in; the booking was cancelled or changed afterwards' : undefined}>
                    Checked in{r.bookingStatus === 'changed' ? ' *' : ''}
                </AdminChip>
                : <AdminChip tone="slate">Not yet</AdminChip>),
        },
        {
            key: 'admittedAt',
            header: 'Entry',
            width: 'w-64',
            sortValue: (r) => (r.admittedAt ? new Date(r.admittedAt).getTime() : 0),
            render: (r) => (r.checkedIn ? (
                <div className="min-w-0">
                    <div className="text-ui-small font-semibold text-slate-800 tabular-nums">{r.admittedAtLabel}</div>
                    <div className="mt-1 inline-flex items-center gap-1 text-ui-caption text-slate-500 min-w-0">
                        {r.method === 'manual' ? <Keyboard className="w-3.5 h-3.5 shrink-0" /> : <QrCode className="w-3.5 h-3.5 shrink-0" />}
                        <span className="break-words">by {r.admittedBy || 'events staff'}</span>
                    </div>
                </div>
            ) : <span className="text-slate-300 font-semibold">—</span>),
        },
    ], [withContact]);

    const t = data?.totals || { registered: 0, checkedIn: 0, notYet: 0, percent: 0 };

    return (
        <>
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 sm:p-6 min-w-0">
                <div className="text-[1.5rem] font-semibold tracking-tight text-slate-900 break-words">
                    {data?.event?.title || (loading ? 'Loading…' : 'Untitled event')}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-ui-small text-slate-500">
                    <span className="inline-flex items-center gap-1"><CalendarDays className="w-4 h-4" />{formatDay(data?.event?.startAt || null)}</span>
                    {!!data?.event?.venue && (
                        <span className="inline-flex items-center gap-1 min-w-0"><MapPin className="w-4 h-4 shrink-0" />
                            <span className="break-words">{data.event.venue}</span></span>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4" data-attendance-stats>
                <AdminStat icon={<UserCheck className="w-5 h-5" />} label="Checked in" value={String(t.checkedIn)}
                    hint={`of ${t.registered} registered`} tone="blue" primary />
                <AdminStat icon={<Users className="w-5 h-5" />} label="Registered" value={String(t.registered)}
                    hint="paid or free confirmed seats" tone="slate" />
                <AdminStat icon={<Clock className="w-5 h-5" />} label="Not yet in" value={String(t.notYet)} tone="amber" />
                <AdminStat icon={<Percent className="w-5 h-5" />} label="Turnout" value={`${t.percent}%`} tone="emerald" />
            </div>

            {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 sm:px-5 py-3 sm:py-4 break-words text-ui-body font-semibold text-rose-700">
                    {error}
                </div>
            )}

            <AdminTable
                rows={data?.rows || []}
                columns={columns}
                rowKey={(r, i) => `${r?.registrationNo || ''}-${i}`}
                loading={loading}
                searchable
                searchPlaceholder="Search attendees"
                minWidth="60rem"
                cardBreakpoint={960}
                empty="Nobody is registered for this event yet."
                emptyFiltered="No attendee matches."
                toolbar={
                    <div className="flex w-full max-w-full flex-wrap gap-1 p-1 rounded-xl bg-slate-100" aria-label="Attendance status">
                        {([['all', 'All'], ['in', 'Checked in'], ['out', 'Not yet']] as const).map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setStatus(value)}
                                aria-pressed={status === value}
                                className={`flex-auto min-w-0 min-h-11 px-3 py-2 rounded-lg text-ui-small font-semibold whitespace-normal transition-colors
                                            ${status === value ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                }
            />

            <p className="text-ui-body text-slate-500 leading-relaxed max-w-3xl">
                <Smartphone className="inline w-4 h-4 mr-1 -mt-0.5" />
                Entry is recorded only by events staff scanning passes in the ACTIV app. Times are IST.
                {' '}A <strong className="font-semibold text-slate-700">*</strong> marks someone who was let in on a
                booking that was cancelled or changed afterwards — they did attend, so the record is kept.
                {!withContact && ' Contact details are visible to the Super Admin only.'}
            </p>

            <div className="flex">
                <button type="button" onClick={onExport} disabled={exporting || loading} className={ADMIN_SECONDARY_BTN}>
                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                    Export Excel
                </button>
            </div>
        </>
    );
}

/* ================================================================ page */

export default function AttendancePage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { eventId = '' } = useParams();
    const navigate = useNavigate();
    const [nonce, setNonce] = useState(0);

    return (
        <div className={`flex h-screen ${ADMIN_BG}`}>
            <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <div className="flex-1 flex flex-col min-w-0 overflow-y-auto sm:overflow-hidden" data-attendance-pane>
                <AdminPageHeader
                    title="Attendance"
                    subtitle={eventId
                        ? 'Who has been let in, when, and by whom'
                        : 'Registered against checked in, for every event'}
                    onMenu={() => setSidebarOpen(true)}
                    backTo={eventId ? `${adminBasePath()}/attendance` : undefined}
                    actions={
                        <>
                            {!!eventId && (
                                <button type="button" onClick={() => navigate(`${adminBasePath()}/attendance`)} className={ADMIN_SECONDARY_BTN}>
                                    <ArrowLeft className="w-4 h-4" /> All events
                                </button>
                            )}
                            <button type="button" onClick={() => setNonce((n) => n + 1)} className={ADMIN_SECONDARY_BTN}>
                                <RefreshCw className="w-4 h-4" /> Refresh
                            </button>
                        </>
                    }
                />
                <div key={`${eventId}-${nonce}`} className={`shrink-0 sm:flex-1 sm:overflow-y-auto max-sm:[&_dl]:grid-cols-1 max-sm:[&_dt]:pt-2 ${ADMIN_PAGE}`} data-attendance-content>
                    {eventId ? <AttendanceDetail eventId={eventId} /> : <AttendanceEvents />}
                </div>
            </div>
        </div>
    );
}
