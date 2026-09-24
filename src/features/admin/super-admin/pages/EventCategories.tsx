import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Tags, Plus, Pencil, Trash2, Check, X, ArrowUp, ArrowDown,
    CalendarDays, AlertTriangle, Sparkles, RefreshCw, Loader2,
} from 'lucide-react';
import AdminSidebar from './AdminSidebar';
import {
    AdminPageHeader, AdminStat, AdminCard, ADMIN_BG, ADMIN_PAGE,
    ADMIN_INPUT, ADMIN_PRIMARY_BTN, ADMIN_SECONDARY_BTN,
} from '@/features/admin/components/AdminUI';
import { AdminTable, AdminChip, AdminIconButton, type AdminColumn }
    from '@/features/admin/components/AdminTable';
import {
    listEventCategories, addEventCategory, renameEventCategory,
    deleteEventCategory, moveEventCategory, addStandardEventCategories,
    type EventCategory,
    type EventCategoryMode,
} from '@/services/eventCategoryApi';
import { errorMessage } from '@/services/api';
import { adminBasePath } from '@/features/admin/components/tierConfig';

/**
 * Event categories — Medical, Awareness, Export, Coffee Meet.
 *
 * =========================================================================
 * THIS SCREEN AND THE PUBLIC FILTER CHIPS EDIT THE SAME ROWS
 * =========================================================================
 *
 * The list lives in the CMS's events settings, where the chips above the public
 * `/events` grid have always lived, and the server's own note explains why a
 * second collection was rejected. The consequence for whoever is standing here:
 * **renaming a category renames it on the public site**, and re-files every
 * event wearing the old label so none of them drops out of every filter at
 * once. The screen says so, and reports how many events moved.
 *
 * ------------------------------------------------- unlisted rows are not a bug
 *
 * A row marked "not listed" is a label events carry that no chip offers — one
 * written before this screen existed, or one whose chip was deleted. Showing
 * them is the point: a list of SOME of the categories in use is the least
 * useful thing this page could be, and the alternative is an editor deleting a
 * chip and losing all trace of the twelve events still filed under it.
 *
 * ------------------------------------------------------------- no native modal
 *
 * Adding and editing happen INLINE — an expandable card above the table, and an
 * input that replaces the cell in the row being renamed. Nothing here opens a
 * dialog. The admin area's own convention, and it means the rename is read
 * beside the event count it affects rather than on top of it.
 */

/** A category as this screen sorts them: listed first, then by the editor's order. */
const compare = (a: EventCategory, b: EventCategory) => {
    if (a.managed !== b.managed) return a.managed ? -1 : 1;
    return a.order - b.order;
};

/**
 * The three answers, and the words each surface uses for them.
 *
 * One table rather than three inline ternaries: the picker, the row select and
 * the toast all name the same three things, and three copies is how one of them
 * ends up saying "offline" where the others say "in person".
 */
const MODE_META: Record<EventCategoryMode, { pick: string; short: string; noun: string }> = {
    both: { pick: 'For both kinds of event', short: 'Both', noun: 'both kinds of' },
    offline: { pick: 'In-person events only', short: 'In person', noun: 'in-person' },
    online: { pick: 'Online events only', short: 'Online', noun: 'online' },
};

const MODE_ORDER: EventCategoryMode[] = ['both', 'offline', 'online'];

export default function SuperAdminEventCategories() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const [categories, setCategories] = useState<EventCategory[]>([]);
    const [missingStandard, setMissingStandard] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    /** The row being renamed, by id. Empty means none — only one at a time. */
    const [editingId, setEditingId] = useState('');
    const [draft, setDraft] = useState('');

    const [adding, setAdding] = useState(false);
    const [newLabel, setNewLabel] = useState('');
    /*
     * WHICH KIND OF EVENT THE NEW CATEGORY IS FOR.
     *
     * `both` to start with, which is the honest default and what almost every
     * category on the live list is: a Workshop or a Conference happens in a
     * room or on a link. The two narrower answers are for the handful that are
     * genuinely one or the other — "ZOOM" and "Webinars" against "Tea party"
     * and "Club House" — and they are what stop the event form offering a
     * video-call label on an event people are driving to.
     */
    const [newMode, setNewMode] = useState<EventCategoryMode>('both');

    /**
     * Narrows the TABLE, not the data.
     *
     * The four figures above it keep counting the whole list: an editor
     * filtering to "Online only" is looking for a handful of rows, not asking
     * how many categories the association has.
     */
    const [modeFilter, setModeFilter] = useState<'all' | EventCategoryMode>('all');

    /** The id of whatever write is in flight, so only that row shows a spinner. */
    const [busy, setBusy] = useState('');

    /* ------------------------------------------------------------- loading */

    const load = useCallback(async (quiet = false) => {
        if (!quiet) setLoading(true);
        setError('');
        try {
            const data = await listEventCategories();
            setCategories([...(data.categories || [])].sort(compare));
            setMissingStandard(data.missingStandard || []);
        } catch (err) {
            setError(errorMessage(err, 'The categories could not be loaded'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    /*
     * A confirmation clears itself after a few seconds.
     *
     * "Renamed, and moved 12 events onto it" is worth reading once; left on
     * screen it becomes furniture, and the next rename's message is
     * indistinguishable from the stale one still sitting there.
     */
    useEffect(() => {
        if (!notice) return;
        const timer = window.setTimeout(() => setNotice(''), 6000);
        return () => window.clearTimeout(timer);
    }, [notice]);

    /* -------------------------------------------------------------- writes */

    /**
     * Every write goes through here.
     *
     * One place that sets the busy flag, replaces the list from the server's
     * answer and turns a failure into a sentence. The server returns the WHOLE
     * list from every mutation, so nothing here patches the array by hand —
     * a local edit plus a server edit is two ideas of the order, and they
     * diverge the first time two writes land out of sequence.
     */
    const run = async (
        key: string,
        action: () => Promise<{ categories: EventCategory[]; missingStandard: string[] }>,
        message?: (result: any) => string,
    ) => {
        setBusy(key);
        setError('');
        try {
            const data = await action();
            setCategories([...(data.categories || [])].sort(compare));
            setMissingStandard(data.missingStandard || []);
            if (message) setNotice(message(data));
            return true;
        } catch (err) {
            setError(errorMessage(err, 'That change could not be saved'));
            return false;
        } finally {
            setBusy('');
        }
    };

    /*
     * An unlisted label has no mode, so it belongs to no narrowed view. It is
     * still the row most worth acting on, so it is kept under "All" — which is
     * where an editor scanning the whole list is.
     */
    const visibleCategories = modeFilter === 'all'
        ? categories
        : categories.filter((row) => row.managed && row.mode === modeFilter);

    const submitNew = async () => {
        const label = newLabel.trim();
        if (!label) return;
        const ok = await run(
            'new',
            () => addEventCategory(label, newMode),
            () => `“${label}” added${newMode === 'both' ? '' : ` for ${MODE_META[newMode].noun} events`}`,
        );
        if (ok) { setNewLabel(''); setNewMode('both'); setAdding(false); }
    };

    /**
     * Change which kind of event a category is for, from its own row.
     *
     * Posted as a rename carrying the same label, because a category's label
     * and its mode live on one row and the server already re-stamps events on a
     * label change — sending the unchanged label means it has nothing to
     * re-stamp and the write is the mode alone.
     */
    const setRowMode = async (row: EventCategory, mode: EventCategoryMode) => {
        if (!row.managed || row.mode === mode) return;
        await run(
            row.id,
            () => renameEventCategory(row.id, row.label, mode),
            () => `“${row.label}” is now for ${MODE_META[mode].noun} events`,
        );
    };

    const submitRename = async (row: EventCategory) => {
        const label = draft.trim();
        // Unchanged, or emptied: close the editor rather than posting a write
        // that either does nothing or fails validation on the server.
        if (!label || label === row.label) { setEditingId(''); return; }

        const ok = await run(
            row.id,
            () => renameEventCategory(row.id, label),
            (data) => (data.moved
                ? `Renamed to “${label}”, and moved ${data.moved} event${data.moved === 1 ? '' : 's'} onto it`
                : `Renamed to “${label}”`),
        );
        if (ok) setEditingId('');
    };

    const remove = async (row: EventCategory) => {
        /*
         * The count is in the question, not only in the table.
         *
         * "Remove Awareness?" and "Remove Awareness? 12 events are filed under
         * it" are different questions, and only the second one can be answered.
         */
        const warning = row.eventCount
            ? `\n\n${row.eventCount} event${row.eventCount === 1 ? ' is' : 's are'} filed under it. `
            + 'They keep the label and will show here as “not listed”, but the public events '
            + 'page will no longer offer it as a filter.'
            : '';

        if (!window.confirm(`Remove “${row.label}” from the category list?${warning}`)) return;
        await run(row.id, () => deleteEventCategory(row.id), () => `“${row.label}” removed`);
    };

    /* -------------------------------------------------------------- totals */

    const stats = useMemo(() => {
        const listed = categories.filter((c) => c.managed);
        return {
            listed: listed.length,
            unlisted: categories.length - listed.length,
            used: categories.filter((c) => c.eventCount > 0).length,
            events: categories.reduce((sum, c) => sum + c.eventCount, 0),
        };
    }, [categories]);

    /* ------------------------------------------------------------- columns */

    const columns: AdminColumn<EventCategory>[] = useMemo(() => [
        {
            key: 'sno',
            header: 'S.No',
            width: 'w-16',
            render: (_row, index) => (
                <span className="font-semibold text-slate-400 tabular-nums">{index + 1}</span>
            ),
        },
        {
            key: 'label',
            header: 'Category',
            sortValue: (row) => row.label,
            render: (row) => {
                if (editingId === row.id && row.managed) {
                    return (
                        <div className="flex items-center gap-2">
                            <input
                                autoFocus
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') submitRename(row);
                                    if (e.key === 'Escape') setEditingId('');
                                }}
                                className={`${ADMIN_INPUT} h-10 max-w-xs`}
                                aria-label={`Rename ${row.label}`}
                            />
                            <AdminIconButton tone="emerald" title="Save" onClick={() => submitRename(row)}>
                                {busy === row.id
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <Check className="w-4 h-4" />}
                            </AdminIconButton>
                            <AdminIconButton tone="slate" title="Cancel" onClick={() => setEditingId('')}>
                                <X className="w-4 h-4" />
                            </AdminIconButton>
                        </div>
                    );
                }

                return (
                    <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600
                                         flex items-center justify-center shrink-0">
                            <CalendarDays className="w-5 h-5" />
                        </span>
                        <span className="text-[1.25rem] font-semibold tracking-tight
                                         text-slate-900 truncate">{row.label}</span>
                        {!row.managed && (
                            <AdminChip
                                tone="amber"
                                title="Events carry this label but no chip offers it on the public events page."
                            >
                                Not listed
                            </AdminChip>
                        )}
                    </div>
                );
            },
        },
        {
            key: 'mode',
            header: 'For',
            align: 'center',
            width: 'w-44',
            sortValue: (row) => row.mode,
            render: (row) => (row.managed ? (
                /*
                 * Editable in place, because it is one of two things this
                 * screen exists to set and sending an editor into a rename
                 * dialog to change it would hide it exactly the way the event
                 * form did.
                 */
                <select
                    value={row.mode}
                    disabled={busy === row.id}
                    onChange={(e) => setRowMode(row, e.target.value as EventCategoryMode)}
                    aria-label={`Which kind of event “${row.label}” is for`}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[1.1875rem]
                               font-semibold text-slate-700 outline-none transition-colors
                               hover:border-slate-300 focus:border-blue-500
                               disabled:opacity-50"
                >
                    {MODE_ORDER.map(m => (
                        <option key={m} value={m}>{MODE_META[m].short}</option>
                    ))}
                </select>
            ) : (
                // An unlisted label has no row to carry a mode. A dash, for the
                // same reason the Events column uses one.
                <span className="text-slate-300 font-semibold text-[1.375rem]">—</span>
            )),
        },
        {
            key: 'events',
            header: 'Events',
            align: 'center',
            width: 'w-28',
            sortValue: (row) => row.eventCount,
            render: (row) => (row.eventCount
                ? <AdminChip tone="blue">{row.eventCount}</AdminChip>
                // A dash, not a zero. "0" in a column of counts reads as a
                // measurement; a dash reads as "none yet", which is the fact.
                : <span className="text-slate-300 font-semibold text-[1.375rem]">—</span>),
        },
        {
            key: 'order',
            header: 'Order',
            align: 'center',
            width: 'w-32',
            hideOnMobile: true,
            render: (row) => {
                // Only listed chips have an order, and only within their own
                // run — an unlisted row is not in the list to be moved.
                if (!row.managed) return <span className="text-slate-300">—</span>;
                const listed = categories.filter((c) => c.managed);
                const at = listed.findIndex((c) => c.id === row.id);

                return (
                    <div className="flex items-center justify-center gap-1">
                        <AdminIconButton
                            tone="slate"
                            title="Move up"
                            disabled={at <= 0 || !!busy}
                            onClick={() => run(row.id, () => moveEventCategory(row.id, 'up'))}
                        >
                            <ArrowUp className="w-3.5 h-3.5" />
                        </AdminIconButton>
                        <AdminIconButton
                            tone="slate"
                            title="Move down"
                            disabled={at < 0 || at >= listed.length - 1 || !!busy}
                            onClick={() => run(row.id, () => moveEventCategory(row.id, 'down'))}
                        >
                            <ArrowDown className="w-3.5 h-3.5" />
                        </AdminIconButton>
                    </div>
                );
            },
        },
        {
            key: 'action',
            header: 'Action',
            align: 'right',
            // Pinned: on a table this wide the Action button is the first thing
            // to fall off the right edge, and it is the reason the row is here.
            sticky: 'right',
            width: 'w-40',
            render: (row) => (
                <div className="flex items-center justify-end gap-1.5">
                    {row.managed ? (
                        <>
                            <AdminIconButton
                                tone="blue"
                                title="Rename"
                                disabled={!!busy}
                                onClick={() => { setEditingId(row.id); setDraft(row.label); }}
                            >
                                <Pencil className="w-4 h-4" />
                            </AdminIconButton>
                            <AdminIconButton
                                tone="rose"
                                title="Remove from the list"
                                disabled={!!busy}
                                onClick={() => remove(row)}
                            >
                                <Trash2 className="w-4 h-4" />
                            </AdminIconButton>
                        </>
                    ) : (
                        /*
                         * The one action an unlisted row offers: adopt it.
                         *
                         * It has no id, so it is added by label — which also
                         * makes it a normal add, spelled exactly as the events
                         * carrying it are spelled.
                         */
                        <button
                            type="button"
                            disabled={!!busy}
                            onClick={() => run(
                                row.label,
                                () => addEventCategory(row.label),
                                () => `“${row.label}” added to the list`,
                            )}
                            className="inline-flex items-center gap-1.5 h-11 px-4 rounded-xl border
                                       border-blue-100 bg-blue-50 text-[1.1875rem] font-semibold text-blue-700
                                       hover:bg-blue-100 transition-colors disabled:opacity-40"
                        >
                            <Plus className="w-4 h-4" /> Add to list
                        </button>
                    )}
                </div>
            ),
        },
    ], [editingId, draft, busy, categories]);

    /* -------------------------------------------------------------- render */

    return (
        <div className={`flex h-screen ${ADMIN_BG}`}>
            <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <AdminPageHeader
                    title="Event Categories"
                    subtitle={<>
                        The list an event is filed under — and the filter chips above the
                        public events page. They are the same rows.
                    </>}
                    onMenu={() => setSidebarOpen(true)}
                    backTo={`${adminBasePath()}/events`}
                    actions={
                        <>
                            <button
                                type="button"
                                onClick={() => load(true)}
                                className={ADMIN_SECONDARY_BTN}
                                disabled={loading || !!busy}
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                            </button>
                            <button
                                type="button"
                                onClick={() => { setAdding(true); setEditingId(''); }}
                                className={ADMIN_PRIMARY_BTN}
                            >
                                <Plus className="w-4 h-4" /> Add category
                            </button>
                        </>
                    }
                />

                <div className={`flex-1 overflow-y-auto ${ADMIN_PAGE}`}>

                    {/* ---------------------------------------------- totals */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <AdminStat
                            icon={<Tags className="w-5 h-5" />}
                            label="Categories"
                            value={String(stats.listed)}
                            hint="on the public filter bar"
                            tone="blue"
                            primary
                        />
                        <AdminStat
                            icon={<CalendarDays className="w-5 h-5" />}
                            label="Events filed"
                            value={String(stats.events)}
                            hint={`${stats.used} categor${stats.used === 1 ? 'y' : 'ies'} in use`}
                            tone="violet"
                        />
                        <AdminStat
                            icon={<AlertTriangle className="w-5 h-5" />}
                            label="Not listed"
                            value={String(stats.unlisted)}
                            hint="labels events carry, with no chip"
                            tone={stats.unlisted ? 'amber' : 'slate'}
                        />
                        <AdminStat
                            icon={<Sparkles className="w-5 h-5" />}
                            label="Standard missing"
                            value={String(missingStandard.length)}
                            hint="of the association's 13"
                            tone="emerald"
                        />
                    </div>

                    {/* ------------------------------------------- messages */}
                    {error && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4
                                        text-[1.25rem] font-semibold text-rose-700">
                            {error}
                        </div>
                    )}
                    {notice && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4
                                        text-[1.25rem] font-semibold text-emerald-700">
                            {notice}
                        </div>
                    )}

                    {/* ------------------------------------------ add, inline */}
                    {adding && (
                        <AdminCard
                            icon={<Plus className="w-5 h-5" />}
                            title="Add a category"
                            subtitle="It appears in the event form straight away, and as a filter chip on the public events page."
                        >
                            <div className="flex flex-col sm:flex-row gap-3">
                                <input
                                    autoFocus
                                    value={newLabel}
                                    onChange={(e) => setNewLabel(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') submitNew();
                                        if (e.key === 'Escape') { setAdding(false); setNewLabel(''); }
                                    }}
                                    placeholder="Medical, Awareness, Coffee Meet…"
                                    className={`${ADMIN_INPUT} flex-1`}
                                    aria-label="New category name"
                                />
                                {/*
                                  * Asked at the same moment as the name, because
                                  * it is part of what the category IS. Offered
                                  * as a select rather than three cards: `both`
                                  * is the answer most of the time and a
                                  * three-card row would give the exception the
                                  * weight of the rule.
                                  */}
                                <select
                                    value={newMode}
                                    onChange={(e) => setNewMode(e.target.value as EventCategoryMode)}
                                    className={`${ADMIN_INPUT} sm:w-60`}
                                    aria-label="Which kind of event this category is for"
                                >
                                    {MODE_ORDER.map(m => (
                                        <option key={m} value={m}>{MODE_META[m].pick}</option>
                                    ))}
                                </select>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={submitNew}
                                        disabled={!newLabel.trim() || busy === 'new'}
                                        className={ADMIN_PRIMARY_BTN}
                                    >
                                        {busy === 'new'
                                            ? <Loader2 className="w-4 h-4 animate-spin" />
                                            : <Check className="w-4 h-4" />}
                                        Add
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setAdding(false); setNewLabel(''); }}
                                        className={ADMIN_SECONDARY_BTN}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </AdminCard>
                    )}

                    {/* ------------------------------- the standard list offer */}
                    {!!missingStandard.length && (
                        <AdminCard
                            tone="amber"
                            icon={<Sparkles className="w-5 h-5" />}
                            title={`${missingStandard.length} of the standard categories are not listed`}
                            subtitle={<>
                                {missingStandard.join(' · ')}.
                                {' '}Adding them changes nothing that is already here — it only fills the gaps.
                            </>}
                            actions={
                                <button
                                    type="button"
                                    onClick={() => run(
                                        'standard',
                                        addStandardEventCategories,
                                        (data) => `${(data.added || []).length} categories added`,
                                    )}
                                    disabled={!!busy}
                                    className={ADMIN_PRIMARY_BTN}
                                >
                                    {busy === 'standard'
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <Plus className="w-4 h-4" />}
                                    Add the missing ones
                                </button>
                            }
                        />
                    )}

                    {/* ------------------------------------ narrow the list */}
                    {/*
                      * Above the table, because it changes what the table is
                      * showing. Four buttons rather than a select: there are
                      * only four answers, this is the screen's own axis, and a
                      * pressed button says which one is active without being
                      * opened.
                      */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[1.1875rem] font-bold uppercase tracking-widest text-slate-400 mr-1">
                            Show
                        </span>
                        {(['all', ...MODE_ORDER] as const).map((m) => {
                            const active = modeFilter === m;
                            const count = m === 'all'
                                ? categories.length
                                : categories.filter(r => r.managed && r.mode === m).length;
                            return (
                                <button
                                    key={m}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => setModeFilter(m)}
                                    className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3.5
                                                text-[1.1875rem] font-bold transition-colors ${active
                                        ? 'border-blue-600 bg-blue-600 text-white'
                                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                                >
                                    {m === 'all' ? 'All' : MODE_META[m].short}
                                    <span className={active ? 'text-blue-100' : 'text-slate-400'}>{count}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* ------------------------------------------------ table */}
                    <AdminTable
                        rows={visibleCategories}
                        columns={columns}
                        rowKey={(row) => row.id || `unlisted:${row.label}`}
                        loading={loading}
                        searchable
                        searchPlaceholder="Search a category"
                        minWidth="56rem"
                        empty={<>
                            No categories yet. Add one above, or take the association's standard list.
                        </>}
                    />

                    <p className="text-[1.25rem] text-slate-500 leading-relaxed max-w-3xl">
                        <strong className="font-semibold text-slate-700">Renaming is not cosmetic.</strong>{' '}
                        A category is stored on an event as its name, so renaming one here also re-files
                        every event carrying the old name — the screen says how many moved. Removing one
                        leaves those events alone; they keep the label and reappear above as
                        “not listed”, and the public events page stops offering it as a filter.
                    </p>
                </div>
            </div>
        </div>
    );
}
