import { Plus, Trash2, Clock } from 'lucide-react';
import { CmsField, CmsInput } from './CmsUI';
import TimeField from './TimeField';
import type { CmsEventDay, CmsAgendaItem } from '@/services/cmsApi';

/**
 * ==========================================================================
 * THE PROGRAMME, DAY BY DAY
 * ==========================================================================
 *
 * Shown only when the event runs over more than one day. A one-day event has
 * one set of hours and one list of sessions, which the fields above already
 * carry — giving it a "Day 1" heading would be furniture describing nothing,
 * and that is exactly what the association asked not to see.
 *
 * THE DAYS ARE DERIVED FROM THE DATES, never typed. The editor already said
 * when the event starts and when it ends; asking them to list the days in
 * between is asking the same question twice and inviting the two answers to
 * disagree. Change the last day and the list grows or shrinks to match.
 *
 * WHAT WAS ALREADY TYPED SURVIVES THAT. Times and sessions are keyed by the
 * DATE, so extending a two-day event to three leaves days one and two exactly
 * as they were and adds an empty third. Shortening it hides the last day's
 * rows rather than deleting them — a date typed by mistake and corrected does
 * not take an afternoon's programme with it. Only what is still in range is
 * saved, so nothing stale reaches the page.
 */

/** Every date from `from` to `to` inclusive, as `yyyy-mm-dd`. */
export const datesBetween = (from: string, to: string): string[] => {
    if (!from) return [];
    const start = new Date(`${from}T00:00:00`);
    const end = new Date(`${(to || from)}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
    if (end.getTime() < start.getTime()) return [];

    const out: string[] = [];
    const cursor = new Date(start);
    /*
     * A HARD STOP AT 60. The dates come from two text inputs, and a typo in
     * the year ("2206") would otherwise ask this to build seventy thousand
     * days and hang the browser on a keystroke. No real event reaches it.
     */
    while (cursor.getTime() <= end.getTime() && out.length < 60) {
        const y = cursor.getFullYear();
        const m = String(cursor.getMonth() + 1).padStart(2, '0');
        const d = String(cursor.getDate()).padStart(2, '0');
        out.push(`${y}-${m}-${d}`);
        cursor.setDate(cursor.getDate() + 1);
    }
    return out;
};

/** "Sat, 10 Oct 2026" — the same wording the public page prints. */
/** "2026-09-24" moved by `delta` whole days, in local time. */
export const addDays = (iso: string, delta: number): string => {
    const d = new Date(`${String(iso || '').slice(0, 10)}T00:00:00`);
    if (Number.isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + delta);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Whole calendar days from `from` to `to`, or NaN if either is not a date. */
export const dayDelta = (from: string, to: string): number => {
    const a = new Date(`${String(from || '').slice(0, 10)}T00:00:00`);
    const b = new Date(`${String(to || '').slice(0, 10)}T00:00:00`);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return NaN;
    return Math.round((b.getTime() - a.getTime()) / 86_400_000);
};

/**
 * MOVING THE EVENT MOVES ITS DAYS.
 *
 * Days are stored against their calendar date, so changing the start date
 * from the 24th to the 25th left every day's hours and sessions filed under
 * dates the event no longer covered: the editor showed blank days, and the
 * save still sent the old ones, so the event page kept printing the old
 * dates and times. "Day 1" is day one of the event wherever it lands.
 */
export const shiftDays = (days: CmsEventDay[], delta: number): CmsEventDay[] => {
    if (!delta || !Number.isFinite(delta)) return days || [];
    return (days || []).map((d) => ({ ...d, date: addDays(String(d?.date || ''), delta) }));
};

/**
 * ONLY THE DAYS THE EVENT ACTUALLY COVERS — what a save sends.
 *
 * A day outside the range is one the editor can no longer see and cannot
 * edit or delete; saving it would put a programme on the event page for a
 * date the event does not run on. A single-day event has no per-day rows.
 */
export const daysInRange = (days: CmsEventDay[], startDate: string, endDate: string): CmsEventDay[] => {
    const dates = datesBetween(startDate, endDate);
    if (dates.length < 2) return [];
    const wanted = new Set(dates);
    return (days || []).filter((d) => wanted.has(String(d?.date || '').slice(0, 10)));
};

const dayLabel = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
};

const BLANK_SESSION: CmsAgendaItem = {
    startTime: '', endTime: '', title: '', description: '', speaker: '', location: '',
};

export function EventDaysEditor({ startDate, endDate, days, onChange }: {
    /** `yyyy-mm-dd` from the Date field. */
    startDate: string;
    /** `yyyy-mm-dd` from the Last day field. Blank means a one-day event. */
    endDate: string;
    days: CmsEventDay[];
    onChange: (next: CmsEventDay[]) => void;
}) {
    const dates = datesBetween(startDate, endDate);

    /* One day is not a programme — see the note at the top. */
    if (dates.length < 2) return null;

    const byDate = new Map((days || []).map((d) => [String(d.date || '').slice(0, 10), d]));
    const dayFor = (iso: string): CmsEventDay =>
        byDate.get(iso) || { date: iso, startTime: '', endTime: '', agenda: [] };

    /** Write one day back, keeping the others and the order of the dates. */
    const setDay = (iso: string, patch: Partial<CmsEventDay>) => {
        const next = dates.map((d) => {
            const existing = dayFor(d);
            return d === iso ? { ...existing, ...patch, date: d } : existing;
        });
        onChange(next);
    };

    const setSessions = (iso: string, agenda: CmsAgendaItem[]) => setDay(iso, { agenda });

    return (
        <div className="mt-6 rounded-xl border border-slate-200 p-4 dark:border-[#2a2a2a]">
            <div className="mb-1">
                <p className="text-[1.25rem] font-bold text-slate-800 dark:text-neutral-100">
                    Each day’s hours and programme
                </p>
                <p className="text-[1.0625rem] text-slate-500 dark:text-neutral-400">
                    {dates.length} days, taken from the dates above. Leave a day’s
                    times blank and the page shows the event’s own hours for it.
                </p>
            </div>

            <div className="mt-4 space-y-4">
                {dates.map((iso, i) => {
                    const day = dayFor(iso);
                    const sessions = day.agenda || [];

                    return (
                        <div
                            key={iso}
                            className="rounded-xl border border-slate-200 bg-slate-50/60 p-4
                                       dark:border-[#232323] dark:bg-[#0d0d0d]"
                        >
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                                <span className="inline-flex h-7 items-center rounded-lg bg-blue-50 px-2.5
                                                 text-[1.0625rem] font-bold text-[#2563EB]
                                                 dark:bg-blue-950/40 dark:text-blue-300">
                                    Day {i + 1}
                                </span>
                                <span className="text-[1.1875rem] font-semibold text-slate-700 dark:text-neutral-200">
                                    {dayLabel(iso)}
                                </span>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <CmsField label="Starts">
                                    <TimeField
                                        label={`Day ${i + 1} start`}
                                        value={day.startTime || ''}
                                        onChange={(startTime) => setDay(iso, { startTime })}
                                    />
                                </CmsField>
                                <CmsField label="Ends">
                                    <TimeField
                                        label={`Day ${i + 1} end`}
                                        value={day.endTime || ''}
                                        onChange={(endTime) => setDay(iso, { endTime })}
                                    />
                                </CmsField>
                            </div>

                            {/* ------------------------------ this day's sessions */}
                            <div className="mt-4 border-t border-dashed border-slate-200 pt-3
                                            dark:border-[#232323]">
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <p className="text-[1.0625rem] font-semibold text-slate-600
                                                  dark:text-neutral-300">
                                        Sessions on this day
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setSessions(iso, [...sessions, { ...BLANK_SESSION }])}
                                        className="inline-flex items-center gap-1.5 rounded-lg border
                                                   border-blue-200 px-2.5 py-1.5 text-[1.0625rem]
                                                   font-semibold text-blue-700 transition-colors
                                                   hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300"
                                    >
                                        <Plus className="h-3.5 w-3.5" /> Add session
                                    </button>
                                </div>

                                {sessions.length === 0 ? (
                                    <p className="text-[1.0625rem] text-slate-400 dark:text-neutral-500">
                                        No sessions listed for this day.
                                    </p>
                                ) : (
                                    <div className="space-y-2.5">
                                        {sessions.map((row, k) => (
                                            <div
                                                key={k}
                                                className="rounded-lg border border-slate-200 bg-white p-3
                                                           dark:border-[#2a2a2a] dark:bg-black"
                                            >
                                                <div className="flex items-start gap-2">
                                                    <Clock className="mt-2.5 h-4 w-4 shrink-0 text-slate-400" />
                                                    <div className="min-w-0 flex-1 space-y-3">
                                                        <div className="grid gap-3 sm:grid-cols-2">
                                                            <CmsField label="Starts">
                                                                <TimeField
                                                                    label="Session start"
                                                                    value={row.startTime}
                                                                    onChange={(startTime) => setSessions(iso,
                                                                        sessions.map((r, j) => (j === k ? { ...r, startTime } : r)))}
                                                                />
                                                            </CmsField>
                                                            <CmsField label="Ends">
                                                                <TimeField
                                                                    label="Session end"
                                                                    value={row.endTime}
                                                                    onChange={(endTime) => setSessions(iso,
                                                                        sessions.map((r, j) => (j === k ? { ...r, endTime } : r)))}
                                                                />
                                                            </CmsField>
                                                        </div>
                                                        <CmsField label="Session">
                                                            <CmsInput
                                                                value={row.title}
                                                                placeholder="Inaugural address"
                                                                onChange={(e) => setSessions(iso,
                                                                    sessions.map((r, j) => (j === k ? { ...r, title: e.target.value } : r)))}
                                                            />
                                                        </CmsField>
                                                        <div className="grid gap-3 sm:grid-cols-2">
                                                            <CmsField label="Speaker">
                                                                <CmsInput
                                                                    value={row.speaker}
                                                                    placeholder="Optional"
                                                                    onChange={(e) => setSessions(iso,
                                                                        sessions.map((r, j) => (j === k ? { ...r, speaker: e.target.value } : r)))}
                                                                />
                                                            </CmsField>
                                                            <CmsField label="Where">
                                                                <CmsInput
                                                                    value={row.location}
                                                                    placeholder="Optional — hall or room"
                                                                    onChange={(e) => setSessions(iso,
                                                                        sessions.map((r, j) => (j === k ? { ...r, location: e.target.value } : r)))}
                                                                />
                                                            </CmsField>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSessions(iso, sessions.filter((_, j) => j !== k))}
                                                        title="Delete this session"
                                                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg
                                                                   border border-red-200 px-2.5 py-1.5 text-[1.0625rem]
                                                                   font-semibold text-red-600 transition-colors
                                                                   hover:bg-red-50 dark:border-red-500/30
                                                                   dark:text-red-400"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default EventDaysEditor;
