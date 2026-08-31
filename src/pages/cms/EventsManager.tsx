import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Save, Check, Loader2 } from 'lucide-react';
import {
    getCmsEvents, createCmsEvent, updateCmsEvent, deleteCmsEvent,
    getEventsSettings, updateEventsSettings,
    errorMessage, EMPTY_MEDIA,
    type CmsEvent, type EventsSettings, type CmsMedia,
} from '@/services/cmsApi';
import {
    CmsCard,
    CmsField,
    CmsInput,
    CmsTextarea,
    CmsButton,
    CmsLoading,
    CmsError,
    CmsEmpty,
    cmsSaved,
    cmsFailed,
    cmsDeleted,
    CmsPage,
    CmsSection,
} from './components/CmsUI';
import MediaPicker from './components/MediaPicker';
import { StatList, IconPicker, RepeatableList } from './components/CmsEditors';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import EventDetailFields, {
    BLANK_DETAIL, toLocalDateTimeInput, type EventDetail,
} from './components/EventDetailFields';
import { Lock } from 'lucide-react';

/**
 * Events.
 *
 * These are the platform's events, not a CMS-only copy: the same records the
 * member app reads. The draft/published control is what separates "written"
 * from "announced".
 *
 * `defaultAudience` is what makes one component serve two surfaces:
 *
 *   - **Super Admin -> Events** opens every new event as `paid`. Those are for
 *     members who have paid, and they never reach the public site — the public
 *     listing in `cms.service.listEvents` filters `audience: 'paid'` out.
 *   - **CMS -> Events** opens every new event as `all`, which is what the
 *     onboarding and public pages render.
 *
 * The audience is still editable in either place; this only decides where the
 * switch starts, so the common case needs no thought and the uncommon one is
 * still one click away.
 */

export type EventAudienceDefault = 'all' | 'paid';

/** Hints long enough that inlining them buries the markup they sit in. */
const NO_MATCH_HINT =
    'Shown when a search or filter finds nothing. {query} is replaced with what was searched for.';

const CHIP_HINT =
    'An "All" chip is always shown first. A chip label is what the category on an event '
    + 'must match to appear under that filter.';

const BLANK = {
    title: '',
    description: '',
    date: '',
    time: '',
    endTime: '',
    location: '',
    category: '',
    media: { ...EMPTY_MEDIA } as CmsMedia,
    status: 'published' as 'published' | 'draft',
    /*
     * Agenda, speakers, audience and registration (EVT-001, EVT-002).
     *
     * Nested rather than flattened into this object so that the whole advanced
     * panel can be handed to one component and read back as one value. It also
     * keeps the two halves separable at save time: everything above is what an
     * event has always had, everything in here is additive.
     */
    detail: { ...BLANK_DETAIL } as EventDetail,
};

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Read a stored instant back into the two form inputs, in LOCAL time.
 *
 * Both halves must use the same clock. Taking the date from `toISOString()` and
 * the time from `getHours()` mixes UTC with local, so an event at 01:30 local
 * on the 7th shows as the 6th at 01:30 — the right time on the wrong day.
 */
const toDateInput = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const toTimeInput = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Turn the date and time inputs into an unambiguous instant.
 *
 * Sent as `startAt` rather than as a `date` + `time` pair, because the server
 * would otherwise parse the pair in ITS OWN timezone. In development that is
 * the same clock as the editor and looks correct; on a UTC host an event
 * entered as 2.30pm is stored as 2.30pm UTC and shown to visitors in Chennai as
 * 8pm. Building the instant here — where the editor's timezone IS the intended
 * one — removes the guess.
 */
const toInstant = (date: string, time: string): string => {
    if (!date) return '';
    const [h, m] = (time || '00:00').split(':').map(Number);
    const d = new Date(date + 'T00:00:00');
    d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
    return d.toISOString();
};

export default function EventsManager({
    defaultAudience = 'all',
}: { defaultAudience?: EventAudienceDefault } = {}) {
    const [events, setEvents] = useState<CmsEvent[]>([]);
    const [settings, setSettings] = useState<EventsSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [savingCopy, setSavingCopy] = useState(false);
    const [savedCopy, setSavedCopy] = useState(false);

    const [editing, setEditing] = useState<string | null>(null);
    const [form, setForm] = useState<typeof BLANK>({ ...BLANK });
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            // Together: the list and the copy around it are independent, and
            // waiting for one before asking for the other doubles the delay.
            const [list, config] = await Promise.all([getCmsEvents(), getEventsSettings()]);
            setEvents(list);
            setSettings(config);
        } catch (err) {
            setError(errorMessage(err, 'Could not load events'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const saveCopy = async () => {
        if (!settings) return;
        setSavingCopy(true);
        setSavedCopy(false);
        setError('');
        try {
            setSettings(await updateEventsSettings(settings));
            setSavedCopy(true);
            cmsSaved('Section copy');
            setTimeout(() => setSavedCopy(false), 2500);
        } catch (err) {
            setError(errorMessage(err, 'Could not save the section copy'));
        } finally {
            setSavingCopy(false);
        }
    };

    const openNew = () => {
        setEditing(null);
        // The audience the surface is for — paid-only under Super Admin, public
        // under the CMS. See the note at the top of this file.
        setForm({
            ...BLANK,
            detail: { ...BLANK.detail, audience: defaultAudience },
        });
        setShowForm(true);
    };

    const openEdit = (e: CmsEvent) => {
        setEditing(e.id);
        setForm({
            title: e.title || '',
            description: e.description || '',
            date: toDateInput(e.startAt),
            time: toTimeInput(e.startAt),
            endTime: toTimeInput(e.endAt),
            location: e.location || '',
            category: e.category || '',
            media: { ...EMPTY_MEDIA, ...(e.media || {}) },
            status: (e.status || 'published') as 'published' | 'draft',
            detail: {
                // Every one of these is optional on the wire: a row written
                // before these fields existed comes back without them, so each
                // falls back to the blank rather than to `undefined`.
                audience: e.audience === 'paid' ? 'paid' : 'all',
                agenda: Array.isArray(e.agenda) ? e.agenda : [],
                speakers: Array.isArray(e.speakers) ? e.speakers : [],
                venueAddress: e.venueAddress || '',
                venueMapUrl: e.venueMapUrl || '',
                contactName: e.contactName || '',
                contactPhone: e.contactPhone || '',
                contactEmail: e.contactEmail || '',
                registrationEnabled: !!e.registrationEnabled,
                registrationDeadline: toLocalDateTimeInput(e.registrationDeadline),
                capacity: e.capacity ? String(e.capacity) : '',
                registrationNote: e.registrationNote || '',
                reminderOffsetsHours: Array.isArray(e.reminderOffsetsHours) ? e.reminderOffsetsHours : [],
            },
        });
        setShowForm(true);
    };

    const handleSubmit = async (ev: React.FormEvent) => {
        ev.preventDefault();
        setSaving(true);
        setError('');
        try {
            const payload = {
                title: form.title,
                description: form.description,
                startAt: toInstant(form.date, form.time),
                // An end time is optional, and only means anything with a start.
                endAt: form.endTime ? toInstant(form.date, form.endTime) : '',
                location: form.location,
                category: form.category,
                imageUrl: form.media.url,
                bannerAlt: form.media.alt,
                bannerFit: form.media.fit,
                bannerPosition: form.media.position,
                status: form.status,

                audience: form.detail.audience,
                /*
                 * Arrays are JSON-encoded here, not passed as arrays.
                 *
                 * `createCmsEvent` builds a `FormData` whenever there is an
                 * image, and `FormData.append` stringifies whatever it is
                 * given — an array of objects becomes "[object Object]" and the
                 * whole agenda is lost with no error anywhere. The server's
                 * `parseArray` reads the JSON back for both transports.
                 */
                agenda: JSON.stringify(form.detail.agenda),
                speakers: JSON.stringify(form.detail.speakers),
                reminderOffsetsHours: JSON.stringify(form.detail.reminderOffsetsHours),

                venueAddress: form.detail.venueAddress,
                venueMapUrl: form.detail.venueMapUrl,
                contactName: form.detail.contactName,
                contactPhone: form.detail.contactPhone,
                contactEmail: form.detail.contactEmail,

                registrationEnabled: form.detail.registrationEnabled,
                // A `datetime-local` value carries no offset, so it is read in
                // the editor's own timezone here — where that IS the intended
                // one — rather than left for the server to guess.
                registrationDeadline: form.detail.registrationDeadline
                    ? new Date(form.detail.registrationDeadline).toISOString()
                    : '',
                capacity: Number(form.detail.capacity) || 0,
                registrationNote: form.detail.registrationNote,
            };

            if (editing) await updateCmsEvent(editing, payload);
            else await createCmsEvent(payload);
            cmsSaved(editing ? 'Event' : 'New event');
            setShowForm(false);
            await load();
        } catch (err) {
            // The server rejects a missing title or an unparseable date with a
            // specific message; showing it verbatim is more use than a generic one.
            const message = errorMessage(err, 'Could not save the event');
            setError(message);
            cmsFailed('the event', message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (e: CmsEvent) => {
        if (!window.confirm(`Delete "${e.title}"? This removes it from the public site and from the member app.`)) return;
        try {
            await deleteCmsEvent(e.id);
            cmsDeleted(e.title || 'Event');
            await load();
        } catch (err) {
            const message = errorMessage(err, 'Could not delete the event');
            setError(message);
            cmsFailed('the deletion', message);
        }
    };

    if (loading) return <CmsLoading label="Loading events…" />;

    return (
        <CmsPage>
            <CmsError message={error} onRetry={load} />

            {/* The wording around the grid. The grid itself is the list below --
                the same events the member app shows, so publishing once is
                enough for both. */}
            {settings && (
                <CmsCard
                    title="Section copy"
                    description="The heading above the events grid, on the home page and on /events."
                >
                    <div className="space-y-0">
                        <CmsSection title="Heading" hint="The wording above the events grid.">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <CmsField label="Eyebrow" hint="The small pill above the heading.">
                                <CmsInput
                                    value={settings.badgeText}
                                    onChange={(e) => setSettings({ ...settings, badgeText: e.target.value })}
                                    placeholder="Upcoming Events"
                                />
                            </CmsField>
                            <CmsField label="Heading">
                                <CmsInput
                                    value={settings.heading}
                                    onChange={(e) => setSettings({ ...settings, heading: e.target.value })}
                                    placeholder="Our"
                                />
                            </CmsField>
                        </div>

                        <div className="mt-4">
                            <CmsField
                                label="Heading highlight"
                                hint="The tail of the heading, shown in the accent colour."
                            >
                                <CmsInput
                                    value={settings.headingHighlight}
                                    onChange={(e) => setSettings({ ...settings, headingHighlight: e.target.value })}
                                    placeholder="Events & Conclaves"
                                />
                            </CmsField>
                        </div>

                        <div className="mt-4 space-y-4">
                        <CmsField
                            label="Hero paragraph"
                            hint="Under the heading on the /events band. Not shown on the home page."
                        >
                            <CmsTextarea
                                rows={3}
                                value={settings.lede}
                                onChange={(e) => setSettings({ ...settings, lede: e.target.value })}
                                placeholder="Discover impactful events, conclaves and programs..."
                            />
                        </CmsField>

                        <CmsField label="Subtitle" hint="Between two rules under the heading. Home page only.">
                            <CmsInput
                                value={settings.subtitle}
                                onChange={(e) => setSettings({ ...settings, subtitle: e.target.value })}
                                placeholder="join the network"
                            />
                        </CmsField>

                        <CmsField label="Empty message" hint="Shown in place of the grid when nothing is published.">
                            <CmsInput
                                value={settings.emptyText}
                                onChange={(e) => setSettings({ ...settings, emptyText: e.target.value })}
                                placeholder="No events are scheduled at the moment."
                            />
                        </CmsField>

                        <CmsField
                            label="No-match message"
                            hint={NO_MATCH_HINT}
                        >
                            <CmsInput
                                value={settings.emptyFilterText}
                                onChange={(e) => setSettings({ ...settings, emptyFilterText: e.target.value })}
                                placeholder="No events match {query}. Try another filter."
                            />
                        </CmsField>
                        </div>
                        </CmsSection>

                        {/* ----------------------------------------- hero band */}
                        <CmsSection
                            title="Hero band"
                            hint="The navy band at the top of /events. Every part is optional, and an empty one is not drawn."
                        >
                            <MediaPicker
                                label="Hero photograph"
                                aspect="1 / 1"
                                value={settings.heroMedia}
                                onChange={(heroMedia) => setSettings({ ...settings, heroMedia })}
                            />

                            <div className="mt-4 grid gap-4 sm:grid-cols-[200px_1fr]">
                                <IconPicker
                                    value={settings.heroBadge.icon}
                                    onChange={(icon) => setSettings({
                                        ...settings,
                                        heroBadge: { ...settings.heroBadge, icon },
                                    })}
                                    label="Badge icon"
                                />
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <CmsField label="Badge title" hint="Blank hides the badge.">
                                        <CmsInput
                                            value={settings.heroBadge.title}
                                            onChange={(e) => setSettings({
                                                ...settings,
                                                heroBadge: { ...settings.heroBadge, title: e.target.value },
                                            })}
                                            placeholder="Do not miss out"
                                        />
                                    </CmsField>
                                    <CmsField label="Badge subtitle">
                                        <CmsInput
                                            value={settings.heroBadge.subtitle}
                                            onChange={(e) => setSettings({
                                                ...settings,
                                                heroBadge: { ...settings.heroBadge, subtitle: e.target.value },
                                            })}
                                            placeholder="Be part of our next big event."
                                        />
                                    </CmsField>
                                </div>
                            </div>

                            <div className="mt-6">
                                <CmsField label="Figures" hint="The tiles across the band. Four fit a row.">
                                    <StatList
                                        items={settings.stats}
                                        onChange={(stats) => setSettings({ ...settings, stats })}
                                        noun="figure"
                                        max={4}
                                    />
                                </CmsField>
                            </div>
                        </CmsSection>

                        {/* ------------------------------------ search and chips */}
                        <CmsSection
                            title="Search and filter chips"
                            hint={CHIP_HINT}
                        >
                            <CmsField label="Search placeholder">
                                <CmsInput
                                    value={settings.searchPlaceholder}
                                    onChange={(e) => setSettings({ ...settings, searchPlaceholder: e.target.value })}
                                    placeholder="Search events..."
                                />
                            </CmsField>

                            <div className="mt-4">
                                <RepeatableList<{ label: string; icon: string }>
                                    items={settings.categories}
                                    onChange={(categories) => setSettings({ ...settings, categories })}
                                    noun="chip"
                                    blank={() => ({ label: '', icon: 'calendar-days' })}
                                    row={(chip, update) => (
                                        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-3">
                                            <IconPicker value={chip.icon} onChange={(icon) => update({ icon })} />
                                            <CmsField label="Label">
                                                <CmsInput
                                                    value={chip.label}
                                                    onChange={(e) => update({ label: e.target.value })}
                                                    placeholder="Conferences"
                                                />
                                            </CmsField>
                                        </div>
                                    )}
                                />
                            </div>
                        </CmsSection>

                        {/* ------------------------------------------ cta strip */}
                        <CmsSection
                            title="Call-to-action strip"
                            hint="The navy strip under the grid on /events. A blank title and label hide it."
                        >
                            <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
                                <IconPicker
                                    value={settings.banner.icon}
                                    onChange={(icon) => setSettings({
                                        ...settings, banner: { ...settings.banner, icon },
                                    })}
                                    label="Icon"
                                />
                                <div className="space-y-4">
                                    <CmsField label="Title">
                                        <CmsInput
                                            value={settings.banner.title}
                                            onChange={(e) => setSettings({
                                                ...settings, banner: { ...settings.banner, title: e.target.value },
                                            })}
                                            placeholder="Have an Event to Share?"
                                        />
                                    </CmsField>
                                    <CmsField label="Subtitle">
                                        <CmsInput
                                            value={settings.banner.subtitle}
                                            onChange={(e) => setSettings({
                                                ...settings, banner: { ...settings.banner, subtitle: e.target.value },
                                            })}
                                            placeholder="Partner with us to create impactful experiences."
                                        />
                                    </CmsField>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <CmsField label="Button label" hint="Blank hides the button.">
                                            <CmsInput
                                                value={settings.banner.ctaLabel}
                                                onChange={(e) => setSettings({
                                                    ...settings, banner: { ...settings.banner, ctaLabel: e.target.value },
                                                })}
                                                placeholder="Partner With Us"
                                            />
                                        </CmsField>
                                        <CmsField label="Button link">
                                            <CmsInput
                                                value={settings.banner.ctaHref}
                                                onChange={(e) => setSettings({
                                                    ...settings, banner: { ...settings.banner, ctaHref: e.target.value },
                                                })}
                                                placeholder="/contact"
                                            />
                                        </CmsField>
                                    </div>
                                </div>
                            </div>
                        </CmsSection>

                        <CmsSection title="Grid and button" hint="How many events the home page shows, and where the button goes.">
                        <div className="grid gap-4 sm:grid-cols-3">
                            <CmsField label="Events on the home page" hint="The rest are reached via the button.">
                                <CmsInput
                                    type="number" min={1} max={24}
                                    value={String(settings.homeLimit)}
                                    onChange={(e) => setSettings({ ...settings, homeLimit: Number(e.target.value) || 3 })}
                                />
                            </CmsField>
                            <CmsField label="Button label" hint="Blank hides the button.">
                                <CmsInput
                                    value={settings.viewAllLabel}
                                    onChange={(e) => setSettings({ ...settings, viewAllLabel: e.target.value })}
                                    placeholder="See All Events"
                                />
                            </CmsField>
                            <CmsField label="Button link">
                                <CmsInput
                                    value={settings.viewAllHref}
                                    onChange={(e) => setSettings({ ...settings, viewAllHref: e.target.value })}
                                    placeholder="/events"
                                />
                            </CmsField>
                        </div>
                        </CmsSection>
                    </div>

                    <div className="mt-6">
                        <button
                            type="button"
                            disabled={savingCopy}
                            onClick={saveCopy}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500
                                       text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {savingCopy ? <Loader2 size={16} className="animate-spin" />
                                : savedCopy ? <Check size={16} /> : <Save size={16} />}
                            {savingCopy ? 'Saving...' : savedCopy ? 'Saved -- live page updated' : 'Save section copy'}
                        </button>
                    </div>
                </CmsCard>
            )}

            {showForm && (
                <CmsCard
                    title={editing ? 'Edit event' : 'New event'}
                    description="Published events appear on the public site and to signed-in members."
                    actions={
                        <button type="button" onClick={() => setShowForm(false)}
                            className="text-neutral-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-neutral-100" aria-label="Close">
                            <X className="w-5 h-5" />
                        </button>
                    }
                >
                    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <CmsField label="Title">
                                <CmsInput required value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })} />
                            </CmsField>
                        </div>

                        <CmsField label="Date">
                            <CmsInput type="date" required value={form.date}
                                onChange={(e) => setForm({ ...form, date: e.target.value })} />
                        </CmsField>

                        <div className="grid grid-cols-2 gap-3">
                            <CmsField label="Starts" hint="In your own timezone.">
                                <CmsInput type="time" value={form.time}
                                    onChange={(e) => setForm({ ...form, time: e.target.value })} />
                            </CmsField>
                            <CmsField label="Ends" hint="Optional.">
                                <CmsInput type="time" value={form.endTime}
                                    onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
                            </CmsField>
                        </div>

                        <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
                            <CmsField label="Location / venue">
                                <CmsInput value={form.location}
                                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                                    placeholder="Chennai Trade Centre, Nandambakkam" />
                            </CmsField>

                            {/*
                              A datalist rather than a select: the chip list
                              below is free text an editor can add to, and a
                              closed dropdown would make an event uncategorisable
                              until someone had also edited the chips. This
                              suggests the existing chips and still accepts a new
                              word — which then shows on the card as a badge and
                              is matched by a chip the moment one is added.
                            */}
                            <CmsField
                                label="Category"
                                hint="Matches a filter chip on /events. Blank shows no badge."
                            >
                                <CmsInput
                                    list="event-category-options"
                                    value={form.category}
                                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                                    placeholder="Conferences"
                                />
                                <datalist id="event-category-options">
                                    {(settings?.categories || []).map((c, i) => (
                                        <option key={i} value={c.label} />
                                    ))}
                                </datalist>
                            </CmsField>
                        </div>

                        <div className="sm:col-span-2">
                            {/* 16/9 — the shape of the banner on an event card. */}
                            <MediaPicker
                                label="Banner"
                                aspect="16 / 9"
                                value={form.media}
                                onChange={(media) => setForm({ ...form, media })}
                                hint="Upload a file or paste a URL. Blank means the card renders without an image."
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <CmsField label="Description">
                                <CmsTextarea rows={4} value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })} />
                            </CmsField>
                        </div>

                        <EventDetailFields
                            value={form.detail}
                            onChange={(detail) => setForm({ ...form, detail })}
                            eventId={editing}
                        />

                        <CmsField label="Visibility" hint="A draft is stored but shown to nobody.">
                            <select
                                value={form.status}
                                onChange={(e) => setForm({ ...form, status: e.target.value as 'published' | 'draft' })}
                                className="w-full bg-slate-50 dark:bg-black border border-slate-300 dark:border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-neutral-100"
                            >
                                <option value="published">Published</option>
                                <option value="draft">Draft</option>
                            </select>
                        </CmsField>

                        <div className="sm:col-span-2 flex gap-2">
                            <CmsButton type="submit" loading={saving}>
                                {editing ? 'Save event' : 'Create event'}
                            </CmsButton>
                            <CmsButton type="button" variant="ghost" onClick={() => setShowForm(false)}>
                                Cancel
                            </CmsButton>
                        </div>
                    </form>
                </CmsCard>
            )}

            <CmsCard
                title={`Events (${events.length})`}
                actions={<CmsButton type="button" onClick={openNew}><Plus className="w-4 h-4" /> Add event</CmsButton>}
            >
                {events.length === 0 ? (
                    <CmsEmpty title="No events yet" hint="Add one and it appears on the public site straight away." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-neutral-500 dark:text-neutral-400 border-b border-slate-200 dark:border-[#1f1f1f]">
                                    <th className="pb-2 pr-4 font-medium w-16">Banner</th>
                                    <th className="pb-2 pr-4 font-medium">Title</th>
                                    <th className="pb-2 pr-4 font-medium">When</th>
                                    <th className="pb-2 pr-4 font-medium">Where</th>
                                    <th className="pb-2 pr-4 font-medium">Status</th>
                                    <th className="pb-2 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {events.map((e) => (
                                    <tr key={e.id} className="border-b border-slate-800/60">
                                        <td className="py-3 pr-4">
                                            {e.media?.url ? (
                                                <div className="w-14 h-10 rounded overflow-hidden bg-slate-100 dark:bg-[#161616]">
                                                    <CmsMediaFrame media={e.media} />
                                                </div>
                                            ) : (
                                                <div className="w-14 h-10 rounded bg-slate-100 dark:bg-[#161616]" />
                                            )}
                                        </td>
                                        <td className="py-3 pr-4 text-slate-800 dark:text-neutral-200">
                                            {e.title || '—'}
                                            {/* The audience is a fact about the row that
                                                the status column cannot carry: a published
                                                members-only event and a published open one
                                                both read "published". */}
                                            {e.audience === 'paid' ? (
                                                <span className="ml-2 inline-flex items-center gap-1 text-[0.625rem]
                                                                 font-bold uppercase tracking-wide px-1.5 py-0.5
                                                                 rounded-full bg-blue-100 dark:bg-blue-950
                                                                 text-blue-700 dark:text-blue-400 align-middle">
                                                    <Lock className="w-2.5 h-2.5" /> Members
                                                </span>
                                            ) : null}
                                            {e.registrationEnabled ? (
                                                <span className="ml-1.5 text-[0.625rem] font-medium text-neutral-500
                                                                 align-middle">
                                                    registration open
                                                </span>
                                            ) : null}
                                        </td>
                                        <td className="py-3 pr-4 text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                                            {e.startAt ? new Date(e.startAt).toLocaleString() : '—'}
                                        </td>
                                        <td className="py-3 pr-4 text-neutral-500 dark:text-neutral-400">{e.location || '—'}</td>
                                        <td className="py-3 pr-4">
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                e.status === 'published'
                                                    ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400'
                                                    : 'bg-slate-100 dark:bg-[#161616] text-neutral-500 dark:text-neutral-400'
                                            }`}>
                                                {e.status}
                                            </span>
                                        </td>
                                        <td className="py-3 text-right whitespace-nowrap">
                                            <button onClick={() => openEdit(e)}
                                                className="p-1.5 rounded text-neutral-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-[#161616]" aria-label="Edit">
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            {/* Labelled, so it is not mistaken for the
                                                pencil beside it. Both were 14px icons
                                                two pixels apart; one is reversible. */}
                                            <button onClick={() => handleDelete(e)}
                                                className="ml-1 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                                                           text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30
                                                           hover:bg-red-500/10 transition-colors"
                                                aria-label={`Delete ${e.title}`}>
                                                <Trash2 className="w-3.5 h-3.5" /> Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CmsCard>
        </CmsPage>
    );
}
