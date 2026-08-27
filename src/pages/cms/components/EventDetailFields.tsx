import { useState } from 'react';
import { Plus, Trash2, Users, Clock, Lock, Globe, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { CmsField, CmsInput, CmsTextarea, CmsSection } from './CmsUI';
import { listEventRegistrations, type EventRegistration } from '@/services/memberHubApi';
import { errorMessage } from '@/services/activApi';
import type { CmsAgendaItem, CmsSpeaker } from '@/services/cmsApi';

/**
 * The advanced half of the event editor (EVT-001, EVT-002).
 *
 * Split out of `EventsManager` rather than added to it. That file already
 * carries the events-section copy, the basics form and the listing; the agenda
 * builder alone is an array editor with add, remove and six fields per row, and
 * inlining it would have doubled the length of a component that is already the
 * longest in the CMS.
 *
 * Everything here is optional. An event announced with a title, a date and a
 * poster is a complete event — the association publishes plenty of them — so
 * none of these fields is required and none of them renders an empty row when
 * unused.
 */

export interface EventDetail {
    audience: 'all' | 'paid';
    agenda: CmsAgendaItem[];
    speakers: CmsSpeaker[];
    venueAddress: string;
    venueMapUrl: string;
    contactName: string;
    contactPhone: string;
    contactEmail: string;
    registrationEnabled: boolean;
    registrationDeadline: string;
    capacity: string;
    registrationNote: string;
    reminderOffsetsHours: number[];
}

export const BLANK_DETAIL: EventDetail = {
    audience: 'all',
    agenda: [],
    speakers: [],
    venueAddress: '',
    venueMapUrl: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    registrationEnabled: false,
    registrationDeadline: '',
    capacity: '',
    registrationNote: '',
    reminderOffsetsHours: [],
};

const BLANK_AGENDA: CmsAgendaItem = {
    startTime: '', endTime: '', title: '', description: '', speaker: '', location: '',
};

const BLANK_SPEAKER: CmsSpeaker = {
    name: '', role: '', organization: '', bio: '', photoUrl: '',
};

/** The reminder offsets an editor can pick, in hours before the start. */
const REMINDERS: { hours: number; label: string }[] = [
    { hours: 168, label: '1 week' },
    { hours: 48, label: '2 days' },
    { hours: 24, label: '1 day' },
    { hours: 2, label: '2 hours' },
];

/**
 * A `datetime-local` value from a stored instant, in LOCAL time.
 *
 * Not `toISOString().slice(0, 16)`, which is the same trap `toDateInput` in
 * `EventsManager` documents: that produces UTC, so a deadline of 23:59 on the
 * 10th displays as 18:29 on the 10th to an editor in India and is silently
 * moved five and a half hours earlier the moment they press save.
 */
export const toLocalDateTimeInput = (value?: string | null): string => {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
        `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export default function EventDetailFields({
    value,
    onChange,
    eventId,
}: {
    value: EventDetail;
    onChange: (detail: EventDetail) => void;
    /** Present only when editing — there are no registrations for a draft row. */
    eventId?: string | null;
}) {
    const [open, setOpen] = useState(false);
    const set = (patch: Partial<EventDetail>) => onChange({ ...value, ...patch });

    const updateAgenda = (index: number, patch: Partial<CmsAgendaItem>) => {
        const agenda = value.agenda.map((row, i) => (i === index ? { ...row, ...patch } : row));
        set({ agenda });
    };

    const updateSpeaker = (index: number, patch: Partial<CmsSpeaker>) => {
        const speakers = value.speakers.map((row, i) => (i === index ? { ...row, ...patch } : row));
        set({ speakers });
    };

    const toggleReminder = (hours: number) => {
        const current = value.reminderOffsetsHours || [];
        set({
            reminderOffsetsHours: current.includes(hours)
                ? current.filter((h) => h !== hours)
                : [...current, hours].sort((a, b) => b - a),
        });
    };

    return (
        <div className="sm:col-span-2 border-t border-slate-200 dark:border-[#1f1f1f] pt-4">
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                className="w-full flex items-center justify-between gap-3 text-left"
            >
                <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900 dark:text-neutral-100">
                        Programme, speakers and registration
                    </span>
                    <span className="block text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                        {summarise(value)}
                    </span>
                </span>
                {open
                    ? <ChevronUp className="w-4 h-4 text-neutral-500 shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-neutral-500 shrink-0" />}
            </button>

            {open ? (
                <div className="mt-4 space-y-0">
                    {/* ---------------------------------------------- audience */}
                    <CmsSection
                        title="Who can see it"
                        hint="Separate from the draft/published control: that is whether it is ready, this is who it is for."
                    >
                        <div className="grid gap-3 sm:grid-cols-2">
                            <AudienceOption
                                selected={value.audience === 'all'}
                                onSelect={() => set({ audience: 'all' })}
                                icon={<Globe className="w-4 h-4" />}
                                title="Everyone"
                                detail="On the public site and visible to every signed-in member."
                            />
                            <AudienceOption
                                selected={value.audience === 'paid'}
                                onSelect={() => set({ audience: 'paid' })}
                                icon={<Lock className="w-4 h-4" />}
                                title="Members only"
                                detail="Only members with an active membership. Kept off the public site entirely."
                            />
                        </div>
                    </CmsSection>

                    {/* ---------------------------------------------- agenda */}
                    <CmsSection
                        title="Agenda"
                        hint="Times are on the event's own day. Rows are sorted by start time when saved, so they can be added in any order."
                        actions={
                            <button
                                type="button"
                                onClick={() => set({ agenda: [...value.agenda, { ...BLANK_AGENDA }] })}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs
                                           font-medium text-blue-600 dark:text-blue-400 border
                                           border-blue-200 dark:border-blue-500/30 hover:bg-blue-500/10"
                            >
                                <Plus className="w-3.5 h-3.5" /> Add session
                            </button>
                        }
                    >
                        {value.agenda.length === 0 ? (
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                No agenda. The event page shows its description instead.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {value.agenda.map((row, index) => (
                                    <div
                                        key={index}
                                        className="rounded-lg border border-slate-200 dark:border-[#2a2a2a] p-3"
                                    >
                                        <div className="flex items-start gap-2">
                                            <Clock className="w-4 h-4 text-neutral-400 mt-2.5 shrink-0" />

                                            <div className="grid gap-3 sm:grid-cols-4 flex-1 min-w-0">
                                                <CmsField label="Starts">
                                                    <CmsInput
                                                        type="time"
                                                        value={row.startTime}
                                                        onChange={(e) => updateAgenda(index, { startTime: e.target.value })}
                                                    />
                                                </CmsField>
                                                <CmsField label="Ends">
                                                    <CmsInput
                                                        type="time"
                                                        value={row.endTime}
                                                        onChange={(e) => updateAgenda(index, { endTime: e.target.value })}
                                                    />
                                                </CmsField>
                                                <div className="sm:col-span-2">
                                                    <CmsField label="Session">
                                                        <CmsInput
                                                            value={row.title}
                                                            placeholder="Inaugural address"
                                                            onChange={(e) => updateAgenda(index, { title: e.target.value })}
                                                        />
                                                    </CmsField>
                                                </div>
                                                <div className="sm:col-span-2">
                                                    <CmsField label="Speaker">
                                                        <CmsInput
                                                            value={row.speaker}
                                                            placeholder="Name as it should be printed"
                                                            onChange={(e) => updateAgenda(index, { speaker: e.target.value })}
                                                        />
                                                    </CmsField>
                                                </div>
                                                <div className="sm:col-span-2">
                                                    <CmsField label="Room / hall">
                                                        <CmsInput
                                                            value={row.location}
                                                            onChange={(e) => updateAgenda(index, { location: e.target.value })}
                                                        />
                                                    </CmsField>
                                                </div>
                                                <div className="sm:col-span-4">
                                                    <CmsField label="Notes">
                                                        <CmsInput
                                                            value={row.description}
                                                            onChange={(e) => updateAgenda(index, { description: e.target.value })}
                                                        />
                                                    </CmsField>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                aria-label="Remove session"
                                                onClick={() => set({ agenda: value.agenda.filter((_, i) => i !== index) })}
                                                className="p-1.5 mt-2 rounded text-red-500 hover:bg-red-500/10 shrink-0"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CmsSection>

                    {/* ---------------------------------------------- speakers */}
                    <CmsSection
                        title="Speakers"
                        hint="Listed on the event page. A session can name a speaker who is not listed here."
                        actions={
                            <button
                                type="button"
                                onClick={() => set({ speakers: [...value.speakers, { ...BLANK_SPEAKER }] })}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs
                                           font-medium text-blue-600 dark:text-blue-400 border
                                           border-blue-200 dark:border-blue-500/30 hover:bg-blue-500/10"
                            >
                                <Plus className="w-3.5 h-3.5" /> Add speaker
                            </button>
                        }
                    >
                        {value.speakers.length === 0 ? (
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                No speakers listed.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {value.speakers.map((row, index) => (
                                    <div
                                        key={index}
                                        className="rounded-lg border border-slate-200 dark:border-[#2a2a2a] p-3
                                                   flex items-start gap-2"
                                    >
                                        <div className="grid gap-3 sm:grid-cols-2 flex-1 min-w-0">
                                            <CmsField label="Name">
                                                <CmsInput
                                                    value={row.name}
                                                    onChange={(e) => updateSpeaker(index, { name: e.target.value })}
                                                />
                                            </CmsField>
                                            <CmsField label="Role">
                                                <CmsInput
                                                    value={row.role}
                                                    placeholder="Chief Guest"
                                                    onChange={(e) => updateSpeaker(index, { role: e.target.value })}
                                                />
                                            </CmsField>
                                            <CmsField label="Organisation">
                                                <CmsInput
                                                    value={row.organization}
                                                    onChange={(e) => updateSpeaker(index, { organization: e.target.value })}
                                                />
                                            </CmsField>
                                            <CmsField label="Photo URL" hint="Optional. Initials are shown without one.">
                                                <CmsInput
                                                    value={row.photoUrl}
                                                    onChange={(e) => updateSpeaker(index, { photoUrl: e.target.value })}
                                                />
                                            </CmsField>
                                            <div className="sm:col-span-2">
                                                <CmsField label="Short bio">
                                                    <CmsTextarea
                                                        rows={2}
                                                        value={row.bio}
                                                        onChange={(e) => updateSpeaker(index, { bio: e.target.value })}
                                                    />
                                                </CmsField>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            aria-label="Remove speaker"
                                            onClick={() => set({ speakers: value.speakers.filter((_, i) => i !== index) })}
                                            className="p-1.5 mt-2 rounded text-red-500 hover:bg-red-500/10 shrink-0"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CmsSection>

                    {/* ---------------------------------------------- venue */}
                    <CmsSection title="Venue and contact" hint="Shown beside the agenda on the member event page.">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <CmsField label="Full address" hint="Under the venue name.">
                                    <CmsInput
                                        value={value.venueAddress}
                                        onChange={(e) => set({ venueAddress: e.target.value })}
                                    />
                                </CmsField>
                            </div>
                            <div className="sm:col-span-2">
                                <CmsField label="Map link" hint="Opens in a new tab.">
                                    <CmsInput
                                        value={value.venueMapUrl}
                                        placeholder="https://maps.app.goo.gl/…"
                                        onChange={(e) => set({ venueMapUrl: e.target.value })}
                                    />
                                </CmsField>
                            </div>
                            <CmsField label="Contact name">
                                <CmsInput
                                    value={value.contactName}
                                    onChange={(e) => set({ contactName: e.target.value })}
                                />
                            </CmsField>
                            <CmsField label="Contact phone">
                                <CmsInput
                                    value={value.contactPhone}
                                    onChange={(e) => set({ contactPhone: e.target.value })}
                                />
                            </CmsField>
                            <div className="sm:col-span-2">
                                <CmsField label="Contact email">
                                    <CmsInput
                                        type="email"
                                        value={value.contactEmail}
                                        onChange={(e) => set({ contactEmail: e.target.value })}
                                    />
                                </CmsField>
                            </div>
                        </div>
                    </CmsSection>

                    {/* ---------------------------------------------- registration */}
                    <CmsSection
                        title="Registration"
                        hint="Members take a seat from their dashboard. Leaving this off simply announces the event."
                    >
                        <label className="flex items-center gap-2.5 mb-4 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={value.registrationEnabled}
                                onChange={(e) => set({ registrationEnabled: e.target.checked })}
                                className="w-4 h-4 rounded border-slate-300 text-blue-600"
                            />
                            <span className="text-sm text-slate-800 dark:text-neutral-200">
                                Members can register for this event
                            </span>
                        </label>

                        {value.registrationEnabled ? (
                            <div className="grid gap-4 sm:grid-cols-2">
                                <CmsField
                                    label="Capacity"
                                    hint="Blank or zero means unlimited. Beyond it, members join a waiting list."
                                >
                                    <CmsInput
                                        type="number"
                                        min={0}
                                        value={value.capacity}
                                        onChange={(e) => set({ capacity: e.target.value })}
                                    />
                                </CmsField>

                                <CmsField
                                    label="Registration closes"
                                    hint="Blank closes it when the event starts."
                                >
                                    <CmsInput
                                        type="datetime-local"
                                        value={value.registrationDeadline}
                                        onChange={(e) => set({ registrationDeadline: e.target.value })}
                                    />
                                </CmsField>

                                <div className="sm:col-span-2">
                                    <CmsField label="Note for registrants" hint="Shown above the register button.">
                                        <CmsInput
                                            value={value.registrationNote}
                                            placeholder="Please bring your membership certificate."
                                            onChange={(e) => set({ registrationNote: e.target.value })}
                                        />
                                    </CmsField>
                                </div>

                                <div className="sm:col-span-2">
                                    <CmsField
                                        label="Remind registrants"
                                        hint="Shown on the event page. Delivery is not wired up yet."
                                    >
                                        <div className="flex flex-wrap gap-2">
                                            {REMINDERS.map(({ hours, label }) => {
                                                const on = (value.reminderOffsetsHours || []).includes(hours);
                                                return (
                                                    <button
                                                        key={hours}
                                                        type="button"
                                                        onClick={() => toggleReminder(hours)}
                                                        className={`px-3 py-1.5 rounded-full text-xs font-medium
                                                                    transition-colors ${
                                                            on
                                                                ? 'bg-blue-600 text-white'
                                                                : 'bg-slate-100 dark:bg-[#161616] text-neutral-500'
                                                        }`}
                                                    >
                                                        {label} before
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </CmsField>
                                </div>
                            </div>
                        ) : null}

                        {eventId ? <RegistrationList eventId={eventId} /> : null}
                    </CmsSection>
                </div>
            ) : null}
        </div>
    );
}

/** A one-line summary so the collapsed panel says what is inside it. */
function summarise(detail: EventDetail): string {
    const parts: string[] = [];

    parts.push(detail.audience === 'paid' ? 'Members only' : 'Open to everyone');
    if (detail.agenda.length) parts.push(`${detail.agenda.length} sessions`);
    if (detail.speakers.length) parts.push(`${detail.speakers.length} speakers`);
    if (detail.registrationEnabled) {
        parts.push(Number(detail.capacity) > 0 ? `${detail.capacity} seats` : 'registration open');
    }

    return parts.join(' · ');
}

// ---------------------------------------------------------------- audience

function AudienceOption({
    selected, onSelect, icon, title, detail,
}: {
    selected: boolean;
    onSelect: () => void;
    icon: React.ReactNode;
    title: string;
    detail: string;
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={`text-left rounded-lg border p-3 transition-colors ${
                selected
                    ? 'border-blue-500 bg-blue-500/5'
                    : 'border-slate-200 dark:border-[#2a2a2a] hover:border-slate-300'
            }`}
        >
            <span className={`inline-flex items-center gap-2 text-sm font-semibold ${
                selected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-neutral-200'
            }`}>
                {icon} {title}
            </span>
            <span className="block text-xs text-neutral-500 dark:text-neutral-400 mt-1">{detail}</span>
        </button>
    );
}

// ---------------------------------------------------------------- attendees

/**
 * Who has registered.
 *
 * Loaded on demand rather than with the form. An attendee list is the one thing
 * on this screen that can be thousands of rows, and an editor changing a
 * session's start time has no reason to download it.
 */
function RegistrationList({ eventId }: { eventId: string }) {
    const [rows, setRows] = useState<EventRegistration[]>([]);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [loaded, setLoaded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await listEventRegistrations(eventId);
            setRows(data?.registrations || []);
            setCounts(data?.counts || {});
            setLoaded(true);
        } catch (err) {
            setError(errorMessage(err, 'Could not load the attendee list'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mt-5 pt-4 border-t border-slate-200 dark:border-[#1f1f1f]">
            {!loaded ? (
                <button
                    type="button"
                    onClick={load}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                               text-slate-700 dark:text-neutral-200 border border-slate-200
                               dark:border-[#2a2a2a] hover:bg-slate-100 dark:hover:bg-[#161616]
                               disabled:opacity-60"
                >
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                    Show who has registered
                </button>
            ) : (
                <>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
                        {counts.registered || 0} registered
                        {counts.waitlist ? ` · ${counts.waitlist} waiting` : ''}
                        {counts.cancelled ? ` · ${counts.cancelled} cancelled` : ''}
                    </p>

                    {rows.length === 0 ? (
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">Nobody yet.</p>
                    ) : (
                        <div className="max-h-72 overflow-y-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="text-left text-neutral-500 border-b border-slate-200 dark:border-[#1f1f1f]">
                                        <th className="pb-2 pr-3 font-medium">Name</th>
                                        <th className="pb-2 pr-3 font-medium">Phone</th>
                                        <th className="pb-2 pr-3 font-medium">Region</th>
                                        <th className="pb-2 font-medium">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => (
                                        <tr key={row.id} className="border-b border-slate-100 dark:border-[#161616]">
                                            <td className="py-2 pr-3 text-slate-800 dark:text-neutral-200">
                                                {row.memberName || '—'}
                                            </td>
                                            <td className="py-2 pr-3 text-neutral-500">{row.phone || '—'}</td>
                                            <td className="py-2 pr-3 text-neutral-500">
                                                {[row.block, row.district].filter(Boolean).join(', ') || '—'}
                                            </td>
                                            <td className="py-2 text-neutral-500 capitalize">{row.status}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {error ? <p className="text-xs text-red-500 mt-2">{error}</p> : null}
        </div>
    );
}
