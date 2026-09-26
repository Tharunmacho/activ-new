import { useCardTable } from '@/lib/useCardTable';
import { useEffect, useState } from 'react';
import { ArrowLeft,
    Plus, Pencil, Trash2, X, Save, Check, Loader2, QrCode,
    Lock, Globe, Building2, MapPin, Shield, Video, Home, Eye, EyeOff, Images, Search,
} from 'lucide-react';
import {
    getCmsEventsForEditor, createCmsEvent, updateCmsEvent, deleteCmsEvent, invalidateCmsCache,
    getEventsSettings, updateEventsSettings,
    errorMessage, EMPTY_MEDIA,
    type CmsEvent, type EventsSettings, type CmsMedia, type CmsEventDay,
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
    cmsDone,
    cmsFailed,
    cmsDeleted,
    CmsPage,
    CmsSection,
    CmsStep,
    CmsSteps,
    SaveNowProvider,
    SectionToolsProvider,
    CmsChoice,
    CmsCheck,
} from './components/CmsUI';
import MediaPicker from './components/MediaPicker';
import TimeField from './components/TimeField';
import EventDaysEditor, { addDays, dayDelta, shiftDays, daysInRange } from './components/EventDaysEditor';
import RegionTargetPicker from './components/RegionTargetPicker';
import { StatList, IconPicker, RepeatableList , ExtraFieldsEditor } from './components/CmsEditors';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import { EventQrDialog } from '@/components/shared/EventQr';
import { CARD_TITLE } from '@/components/layout/appTypography';
import EventDetailFields, {
    BLANK_DETAIL, toLocalDateTimeInput, type EventDetail,
} from './components/EventDetailFields';

/**
 * Events.
 *
 * These are the platform's events, not a CMS-only copy: the same records the
 * member app reads. The draft/published control is what separates "written"
 * from "announced".
 *
 * Two props make one component serve two surfaces:
 *
 *   `channel`  WHICH SITE the event belongs to. **CMS -> Events** posts the
 *              onboarding programme; **Super Admin -> Events** posts the
 *              association's own, which never appears on the public pages.
 *              This used to be inferred from `audience: paid`, which held only
 *              while an event was also restricted to paying members — the
 *              moment one was opened to everyone in a block it appeared on a
 *              national marketing page.
 *
 *   `defaultAudience`  WHO may see it, within that site. Both surfaces open at
 *              `all` now: an event aimed at a block is for everyone standing
 *              in that block, paid or not. The members-only switch stays on
 *              the form for events that are genuinely a membership benefit.
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
    /*
     * A CONFERENCE RUNS FOR THREE DAYS, and the form could only say one.
     *
     * There was an end TIME and no end DATE, so a three-day conclave was
     * stored as finishing at 5pm on its first evening. Two things read that:
     * the public events page, which drops an event once it is over and was
     * therefore dropping day-one-of-three at teatime, and the card, which
     * could only print one date for something the visitor has to book three
     * days off for.
     *
     * Blank means a single-day event, which is most of them — the end date
     * is not required and an absent one still reads as `date`.
     */
    endDate: '',
    endTime: '',
    /* The per-day programme. Empty for a one-day event — the editor for it is
       not even drawn until the Last day makes the event longer than a day. */
    days: [] as CmsEventDay[],
    location: '',
    category: '',
    /*
     * Who the event is aimed at. Empty means everyone.
     *
     * The fields have been on the Event model since it was written and the
     * form never offered them, so every event ever created here was national.
     */
    /*
     * A LIST of regions, not one.
     *
     * The single state/district/block trio could express exactly one region, so
     * an event for eight blocks had to be posted eight times — eight records,
     * eight registration lists, eight things to correct when the venue moved.
     * The server still stores those three fields, mirrored from the first entry
     * for the mobile app's benefit, and derives them itself; nothing here has
     * to send them.
     */
    targets: [] as { state: string; district: string; block: string }[],
    /*
     * Whether this event is advertised on the onboarding site's events section.
     *
     * The blank value is the safe one; the real default comes from the surface
     * — see `openNew`, which sets it from `channel` the same way it sets the
     * audience. An admin-area event is internal until somebody says otherwise,
     * and a CMS event is onboarding content by definition.
     */
    showOnOnboarding: false,
    // The QR card on the event page; on for every new event (see EventQr).
    showQrOnPage: true,
    /*
     * "Everyone in the association" — the first of the two audience cards.
     *
     * Held beside `targets`, not derived from it, so both cards survive a save.
     * `true` on a blank form: a new event goes to the whole association until
     * someone narrows it, which is the safer default of the two and the one the
     * form has always opened on.
     */
    reachEveryone: true,
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

/**
 * Is this event aimed at particular regions?
 *
 * Both representations are consulted, the same way the server does it: the
 * `targets` list is the real answer, and the legacy `state`/`district`/`block`
 * trio carries the one region of any row written before multi-targeting.
 */
/** The two filters above the list, styled as one control rather than two. */
const FILTER_SELECT =
    'min-w-0 max-w-full h-11 rounded-lg border border-slate-200 dark:border-[#2a2a2a] '
    + 'bg-white dark:bg-black px-3 text-[1.25rem] font-medium text-slate-900 dark:text-neutral-100 '
    + 'hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors';

const hasTargets = (e: CmsEvent) =>
    (Array.isArray(e?.targets) && e.targets.length > 0)
    || !!(e?.state || e?.district || e?.block);

/**
 * Is this event on the onboarding site right now?
 *
 * The browser's copy of `onboardingVisibility.isOnboardingContent`, and it has
 * to stay the browser's copy of it: the form shows this back as a chosen
 * option, so a form that computed it differently from the server would tell an
 * editor their event is public when it is not, or the reverse.
 *
 * Read from the EVENT's own channel rather than from the surface the editor
 * happens to be standing on. The same event is reachable from both screens, and
 * "is the public reading this" is a fact about the event.
 */
const isOnPublicSite = (e: CmsEvent) =>
    e?.showOnOnboarding === true
    || ((e?.channel || 'public') === 'public' && !hasTargets(e));

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
/**
 * "10 Oct 2026, 09:00 AM" — the WHEN column of the events table.
 *
 * 12-hour with the meridiem, like every time on the public site, and no
 * seconds: an event is scheduled to the minute and the ":00" on the end was
 * being read as something broken.
 */
const listWhen = (iso: string): string => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    /* Only the meridiem is upper-cased. Upper-casing the whole string gave
       "10 OCT 2026", which shouts in a table cell whose neighbours are
       sentence case. */
    return d.toLocaleString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
    }).replace(/\b(am|pm)\b/i, (m) => m.toUpperCase());
};

const toInstant = (date: string, time: string): string => {
    if (!date) return '';
    const [h, m] = (time || '00:00').split(':').map(Number);
    const d = new Date(date + 'T00:00:00');
    d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
    return d.toISOString();
};

/**
 * Has this event already happened?
 *
 * Module level, because the filtered list is built near the top of the
 * component and this used to be a `const` four hundred lines below it —
 * which is a temporal-dead-zone throw the moment the list asks.
 *
 * An event with NO date has not been held. It is an announcement waiting
 * for a date, and filing it under “already held” would archive something
 * that has not happened.
 */
const hasBeenHeld = (e: CmsEvent) => {
    /* The END, falling back to the start. A three-day conclave is not a past
       event on its second morning, and reading `startAt` alone said it was. */
    const when = e?.endAt || e?.startAt;
    if (!when) return false;
    const t = new Date(when).getTime();
    return !Number.isNaN(t) && t < Date.now();
};

export default function EventsManager({
    defaultAudience = 'all',
    channel = 'public',
    showSectionCopy = channel === 'public',
}: {
    defaultAudience?: EventAudienceDefault;
    /**
     * Whether to render the section-copy panel above the list.
     *
     * That panel edits the ONBOARDING PAGE's furniture — the eyebrow, heading
     * and blurb above the public events grid, the category chips, the
     * empty-state sentence. It is website copy, it belongs to the CMS, and it
     * was the first thing the super admin saw on a screen whose whole job is
     * posting the association's own programme: five cards of wording for a page
     * they were not editing, above the one control they came for.
     *
     * Defaulted from `channel` rather than passed everywhere, because the two
     * answers have never differed: the surface that posts onboarding content is
     * the surface that owns the onboarding page's copy.
     */
    showSectionCopy?: boolean;
    /**
     * WHICH SITE an event posted from this screen belongs to.
     *
     * The CMS posts the onboarding site's programme; the super admin's Events
     * screen posts the association's own, for member dashboards and the app.
     * Declared by the screen rather than inferred from the role, because the
     * same super admin uses both and the answer is about where they are
     * standing, not who they are.
     */
    channel?: 'public' | 'members';
} = {}) {
    const cardTableRef = useCardTable();
    const [events, setEvents] = useState<CmsEvent[]>([]);
    /*
     * ==================================================================
     * A SAVE IN EVERY SECTION'S FOOTER, like the rest of the CMS
     * ==================================================================
     *
     * There was ONE save, in a band under the last card, so an editor who
     * changed the heading in Section 1 scrolled past five cards to find a
     * button, and nothing in Sections 1 to 4 said their work was unsaved.
     * Home, About, Membership, Contact and Regions have carried a Save in
     * each card's footer for a while; this screen had not been brought
     * across, and neither had the gallery, the news, the schemes or the
     * legal pages. They all have one now.
     *
     * The WRITE is unchanged — the endpoint takes the whole document, so
     * every one of those buttons saves the page. That is what it says.
     *
     * `setSettings` is a wrapper rather than the raw setter so that the
     * ~thirty call sites below all mark the page dirty without each one
     * having to remember to. The two places that must NOT — the load and
     * the server's copy back after a save — use `setSettingsClean`.
     */
    const [settings, setSettingsClean] = useState<EventsSettings | null>(null);
    const [copyDirty, setCopyDirty] = useState(false);
    const setSettings = (next: EventsSettings | null) => {
        setSettingsClean(next);
        setCopyDirty(true);
    };
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [savingCopy, setSavingCopy] = useState(false);
    const [savedCopy, setSavedCopy] = useState(false);

    const [editing, setEditing] = useState<string | null>(null);
    const [form, setForm] = useState<typeof BLANK>({ ...BLANK });
    const [showForm, setShowForm] = useState(false);
    // The QR panel: opened for a just-created event, or from a row's QR button.
    const [qrFor, setQrFor] = useState<{ event: CmsEvent; justCreated: boolean } | null>(null);
    /**
     * Which audience the list is showing.
     *
     * The programme is one list of everything ever posted, and the question
     * an administrator actually arrives with is "what did we send to
     * Ariyalur". Built from the events themselves rather than from the region
     * tree: only targets in use are worth offering, and the tree has 6,966
     * blocks.
     */
    const [targetFilter, setTargetFilter] = useState('all');

    /*
     * WHERE A ROW CAME FROM.
     *
     * The CMS list holds the programme written here AND whatever the super
     * admin posted to the onboarding site from their own screen — the panel
     * maintains those pages, so it has to show both. They are told apart by the
     * EVENT's own channel, never by the surface being viewed: the same event
     * opens from both screens, and "who wrote this" is a fact about the event.
     */
    const [originFilter, setOriginFilter] = useState<'all' | 'cms' | 'admin'>('all');

    /*
     * WHAT AN EDITOR ARRIVES LOOKING FOR.
     *
     * The two filters above both answer “who is this for”. Neither answers
     * “which of these is still to come” or “where is the Coimbatore one”,
     * and those are the two questions a list of events is actually opened
     * with — the public page shows what is upcoming, so an editor comparing
     * the two needs to see the same slice here.
     */
    /*
     * THE TABS, like Regions & States: Upcoming, Past, and the page's wording.
     * `when` is what the list filters on; the wording tab shows the section
     * copy in place of the list.
     */
    const [when, setWhen] = useState<'all' | 'upcoming' | 'past'>('upcoming');
    const [wordingTab, setWordingTab] = useState(false);
    const [query, setQuery] = useState('');
    const originOf = (e: CmsEvent) => ((e.channel || 'public') === 'public' ? 'cms' : 'admin');
    const adminPosted = events.filter((e) => originOf(e) === 'admin').length;
    const [saving, setSaving] = useState(false);

    const targetOf = (e: CmsEvent) => e.targetLabel || 'Everyone';

    const targetOptions = Array.from(new Set(events.map(targetOf)))
        .sort((a, b) => (a === 'Everyone' ? -1 : b === 'Everyone' ? 1 : a.localeCompare(b)));

    const upcomingCount = events.filter((e) => !hasBeenHeld(e)).length;

    const visibleEvents = events
        .filter((e) => targetFilter === 'all' || targetOf(e) === targetFilter)
        .filter((e) => originFilter === 'all' || originOf(e) === originFilter)
        .filter((e) => when === 'all' || (when === 'past' ? hasBeenHeld(e) : !hasBeenHeld(e)))
        .filter((e) => {
            const needle = query.trim().toLowerCase();
            if (!needle) return true;
            /* Everything a person might recognise it by — the title is
               often the one thing they do NOT remember. */
            return [e.title, e.venue, e.category, e.state, e.district, e.block,
                e.description, e.targetLabel]
                .filter(Boolean).join(' ').toLowerCase().includes(needle);
        });

    /** `quiet` refetches without blanking the screen — see `GalleryManager`. */
    const load = async ({ quiet = false } = {}) => {
        if (!quiet) setLoading(true);
        setError('');
        try {
            // Together: the list and the copy around it are independent, and
            // waiting for one before asking for the other doubles the delay.
            const [list, config] = await Promise.all([getCmsEventsForEditor(), getEventsSettings()]);
            setEvents(list);
            setSettingsClean(config);
            return list;
        } catch (err) {
            setError(errorMessage(err, 'Could not load events'));
        } finally {
            if (!quiet) setLoading(false);
        }
    };

    /*
     * ======================================================================
     * ?event=<id> OPENS THAT EVENT'S FORM, ?new=1 OPENS A BLANK ONE
     * ======================================================================
     *
     * The Home screen's events picker links here to change an event's
     * picture or its details. Landing on the LIST and asking the editor to
     * find the row they just clicked is the kind of small failure that
     * makes a link not worth following — so the link names the event and
     * this opens it.
     *
     * Run once, after the first load, and the parameter is cleared so a
     * refresh or a back-button does not reopen a form the editor closed.
     * An id that no longer exists is ignored rather than reported: the
     * event was deleted, which is not an error worth a banner.
     */
    useEffect(() => {
        let cancelled = false;
        load().then((list) => {
            if (cancelled || !list) return;

            const params = new URLSearchParams(window.location.search);
            const wanted = params.get('event');
            const blank = params.get('new');

            if (!wanted && !blank) return;

            if (blank) {
                /*
                 * `?new=1` OPENS THE BLANK FORM.
                 *
                 * The Home screen's picker links here to add one. Landing on
                 * this screen's first card — the section WORDING — and
                 * leaving the editor to find the New event button is how a
                 * button called 'Add an event' ends up not adding an event.
                 */
                openNew();
            } else {
                const found = list.find((e) => e.id === wanted);
                if (found) openEdit(found);
            }

            window.history.replaceState({}, '', window.location.pathname);
        });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const saveCopy = async () => {
        if (!settings) return;
        setSavingCopy(true);
        setSavedCopy(false);
        setError('');
        try {
            setSettingsClean(await updateEventsSettings(settings));
            setCopyDirty(false);
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
        // The audience this surface opens at. See the note at the top.
        setForm({
            ...BLANK,
            /*
             * The onboarding answer a new event opens at: ON, on every surface.
             *
             * The association wants every event it posts — from the CMS, the
             * Super Admin or the Events Admin — on the onboarding site and in
             * the CMS alike. It used to be `false` in the admin area, so an
             * event posted there stayed off the public site unless the poster
             * remembered a checkbox. The box is still on the form for the
             * rare event that must stay inside the association.
             */
            showOnOnboarding: true,
            reachEveryone: true,
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
            /* Only a DIFFERENT day is an end date. An event that starts and
               finishes on one day has an `endAt` carrying the end time and the
               same date, and echoing that back into the field would show every
               single-day event as a two-day one. */
            endDate: toDateInput(e.endAt) === toDateInput(e.startAt) ? '' : toDateInput(e.endAt),
            endTime: toTimeInput(e.endAt),
            /* Loaded as well as saved: a draft that omits a field shows an
               empty editor for data that is on the record, and the next save
               writes the blank back over it. */
            days: (e.days || []).map((d) => ({
                date: String(d.date || '').slice(0, 10),
                startTime: d.startTime || '',
                endTime: d.endTime || '',
                agenda: d.agenda || [],
            })),
            location: e.location || '',
            category: e.category || '',
            /*
             * The list, with the legacy fields as the fallback.
             *
             * A row written before multi-targeting has no `targets` and carries
             * its one region in the three old fields. Reading it back as a
             * one-entry list is what lets an editor open such an event, add a
             * second block and save it without losing the first.
             */
            targets: Array.isArray(e.targets) && e.targets.length
                /* Typed to what a target IS, not `any`: these three names
                   are the whole shape, and `any` switched off the one check
                   that catches a fourth being misspelled into existence. */
                ? e.targets.map((t: { state?: string; district?: string; block?: string }) => ({
                    state: t.state || '', district: t.district || '', block: t.block || '',
                }))
                : (e.state
                    ? [{ state: e.state, district: e.district || '', block: e.block || '' }]
                    : []),
            /*
             * WHERE THIS EVENT IS *CURRENTLY* PUBLISHED, not just the flag.
             *
             * Derived the way `onboardingVisibility.isOnboardingContent` derives
             * it on the server, because a bare `e.showOnOnboarding === true`
             * misreads the whole existing programme. The flag postdates every
             * event in the collection, so an untargeted CMS event — which IS on
             * the public site, via the channel — comes back with it `false`, and
             * the form would show "keep it inside the association" for an event
             * anyone can already read. Adding a region to it and saving would
             * then take it off the public site, and the editor's own screen
             * would have told them that was the state it was already in.
             */
            showOnOnboarding: isOnPublicSite(e),
            showQrOnPage: e.showQrOnPage !== false,
            // `!== false`: the field postdates every event in the
            // collection, and those belong on the home page as before.
            /*
             * Restored from the event, with a fallback for every row written
             * before the field existed: those express "everyone" as an empty
             * target list, so an empty list still means the first card is on.
             */
            reachEveryone: e.reachEveryone === true || !hasTargets(e),
            media: { ...EMPTY_MEDIA, ...(e.media || {}) },
            status: (e.status || 'published') as 'published' | 'draft',
            detail: {
                // Every one of these is optional on the wire: a row written
                // before these fields existed comes back without them, so each
                // falls back to the blank rather than to `undefined`.
                audience: e.audience === 'paid' ? 'paid' : 'all',
                /*
                 * Anything but an explicit `online` is offline — which is every
                 * row written before this field existed, and is what they all
                 * actually were.
                 */
                mode: e.mode === 'online' ? 'online' : 'offline',
                onlinePlatform: e.onlinePlatform || '',
                /*
                 * The server sends this back ONLY to a signed-in content admin
                 * (see `withJoinLink`), which is who is looking at this form.
                 * Blank for anyone else — and blank is also what a save would
                 * then send, so a public read could never blank a link it was
                 * never shown.
                 */
                onlineUrl: e.onlineUrl || '',
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
                // Blank, not "0", for a free event: an empty box reads as "no
                // fee" where a typed zero reads as a price somebody set.
                registrationFee: e.registrationFee ? String(e.registrationFee) : '',
                /*
                 * `null` AND `undefined` BOTH BECOME BLANK, and a numeric 0
                 * survives as "0".
                 *
                 * `e.memberFee ? ... : ''` would be wrong here in the one case
                 * that matters: a member rate of zero — an event members attend
                 * free — is falsy, so reopening that event would show an empty
                 * box and the next save would clear the offer. `== null` is the
                 * check that separates "not set" from "set to nothing".
                 */
                memberFee: e.memberFee == null ? '' : String(e.memberFee),
                registrationNote: e.registrationNote || '',
                topic: e.topic || '',
                language: e.language || '',
                registrationFields: Array.isArray(e.registrationFields) ? e.registrationFields : [],
                reminderOffsetsHours: Array.isArray(e.reminderOffsetsHours) ? e.reminderOffsetsHours : [],
            },
        });
        setShowForm(true);
    };


    /**
     * Escape closes the dialog, and the page behind it stops scrolling.
     *
     * Both are what separates a dialog from a div on top of the page: without
     * the first it can only be dismissed by finding a small ×, and without the
     * second a wheel gesture over the backdrop scrolls the event list
     * underneath, which reads as the dialog having come loose from the page.
     *
     * The previous `overflow` is restored rather than assumed to be `''`, so a
     * screen that locks scrolling for its own reasons is not unlocked by
     * closing this.
     */
    /* The form opens as its own screen (see the render), so it starts at the
       top of the page rather than wherever the table was scrolled to. */
    useEffect(() => {
        if (showForm) window.scrollTo({ top: 0 });
    }, [showForm]);

    const handleSubmit = async (ev: React.FormEvent) => {
        ev.preventDefault();
        setSaving(true);
        setError('');
        try {
            const payload = {
                title: form.title,
                description: form.description,
                startAt: toInstant(form.date, form.time),
                /*
                 * THE END, from whichever of the two fields was given.
                 *
                 * A date with no time finishes at the end of that day — not
                 * at midnight its morning, which would make a three-day event
                 * read as finishing before its second day began. A time with
                 * no date finishes that same evening, which is the
                 * single-day case and the only one this form used to have.
                 * Neither given, and there is no end: optional, like
                 * everything else on this form.
                 */
                endAt: (form.endDate || form.endTime)
                    ? toInstant(form.endDate || form.date, form.endTime || '23:59')
                    : '',
                /*
                 * JSON-encoded for the reason the agenda and the targets are:
                 * this payload becomes `FormData` whenever there is a banner,
                 * and `FormData.append` stringifies an array of objects to
                 * "[object Object]" — losing every day with no error anywhere.
                 * The server's `parseArray` reads it back on both transports.
                 */
                days: JSON.stringify(daysInRange(form.days || [], form.date, form.endDate)),
                location: form.location,
                category: form.category,
                /*
                 * Region targeting, as a list. An empty list is everyone.
                 *
                 * JSON-encoded for the same reason the agenda is: this payload
                 * becomes `FormData` whenever there is an image, and
                 * `FormData.append` stringifies an array of objects to
                 * "[object Object]" — losing every target with no error
                 * anywhere. The server's `parseArray` reads it back on both
                 * transports.
                 *
                 * The legacy `state`/`district`/`block` are NOT sent: the
                 * server mirrors them from the first entry, and sending both
                 * would let a stale trio here overwrite the mirror it just
                 * derived.
                 */
                targets: JSON.stringify(form.targets),
                imageUrl: form.media.url,
                bannerAlt: form.media.alt,
                bannerFit: form.media.fit,
                bannerPosition: form.media.position,
                status: form.status,

                audience: form.detail.audience,
                channel,
                /*
                 * Sent from BOTH surfaces, and deliberately so.
                 *
                 * The CMS does not render the switch, but it does send the
                 * value it read back — otherwise re-saving a super admin's
                 * event from the CMS would leave the field absent, the server
                 * would leave the stored value alone, and the two screens would
                 * be showing an event whose public visibility neither of them
                 * could account for. Sending what was loaded keeps one answer.
                 */
                showOnOnboarding: form.showOnOnboarding,
                showQrOnPage: form.showQrOnPage,
                // Sent alongside `targets`, never instead of it — the pair is
                // what lets a reopened event show back both cards.
                reachEveryone: form.reachEveryone,
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

                /*
                 * HOW IT IS ATTENDED. These three were loaded into the form
                 * and never sent back, so "Online" and the joining link were
                 * dropped on every save — the event reopened as "In person"
                 * with the Zoom link gone. The server has always stored them.
                 */
                mode: form.detail.mode,
                onlinePlatform: form.detail.onlinePlatform,
                onlineUrl: form.detail.onlineUrl,
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
                registrationFee: Number(form.detail.registrationFee) || 0,
                /*
                 * Sent as `''` when blank, so the server clears the rate, and as
                 * a NUMBER otherwise — including 0. `Number('') || 0` would send
                 * zero for a blank box, which is "free for every member" written
                 * by an editor who typed nothing.
                 */
                memberFee: String(form.detail.memberFee ?? '').trim() === ''
                    ? ''
                    : Number(form.detail.memberFee) || 0,
                registrationNote: form.detail.registrationNote,
                // Printed in the booking email and WhatsApp message.
                topic: form.detail.topic,
                language: form.detail.language,
                // JSON-encoded for the same reason the agenda is: this payload
                // becomes `FormData` whenever there is an image, and
                // `FormData.append` would stringify the array to
                // "[object Object]" — losing the whole form with no error.
                registrationFields: JSON.stringify(form.detail.registrationFields),
            };

            if (editing) {
                await updateCmsEvent(editing, payload);
            } else {
                /*
                 * A NEW EVENT OPENS ITS QR straight away — the moment somebody
                 * posts an event is the moment they want the flyer code. The
                 * server answers with the stored row, slug included.
                 */
                const created = await createCmsEvent(payload);
                const newId = String(created?.id || created?._id || '');
                if (newId) {
                    setQrFor({
                        event: {
                            id: newId, slug: created?.slug || '', title: form.title,
                            startAt: created?.startAt || null, showQrOnPage: form.showQrOnPage,
                        } as CmsEvent,
                        justCreated: true,
                    });
                }
            }
            cmsSaved(editing ? 'Event' : 'New event');
            setShowForm(false);
            await load({ quiet: true });
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

    /*
     * Already held.
     *
     * An event with NO date is not past: an unset date is missing
     * information, not a statement that it already happened.
     */
    const isPastEvent = hasBeenHeld;

    const handleDelete = async (e: CmsEvent) => {
        if (!window.confirm(`Delete "${e.title || 'Untitled event'}"? This removes it from the public site and from the member app.`)) return;
        try {
            await deleteCmsEvent(e.id);
            cmsDeleted(e.title || 'Event');
            await load({ quiet: true });
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

            {/* The wording around the onboarding page's grid -- CMS only. The
                grid itself is the list below, the same events the member app
                shows, so publishing once is enough for both. */}
            {/* The tabs — hidden while an event is open, which is its own screen. */}
            {!showForm && (
                <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 dark:border-[#1f1f1f]">
                    {([
                        ['upcoming', 'Upcoming', upcomingCount],
                        ['past', 'Past', events.length - upcomingCount],
                        ...(showSectionCopy ? [['wording', 'Page wording', null]] : []),
                    ] as [string, string, number | null][]).map(([key, label, count]) => {
                        const on = key === 'wording' ? wordingTab : (!wordingTab && when === key);
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => {
                                    if (key === 'wording') { setWordingTab(true); return; }
                                    setWordingTab(false);
                                    setWhen(key as 'upcoming' | 'past');
                                }}
                                className={`-mb-px border-b-2 px-5 py-3 text-[1.25rem] font-semibold transition-colors ${on
                                    ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                                    : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-neutral-200'}`}
                            >
                                {label}
                                {count !== null && <span className="ml-2 text-[1.1875rem] text-slate-400">{count}</span>}
                            </button>
                        );
                    })}
                </div>
            )}

            {!showForm && wordingTab && showSectionCopy && settings && (
                <CmsCard
                    title="Section copy"
                    description="The heading above the events grid, on the home page and on /events."
                >
                    <SectionToolsProvider
                        value={{
                            sections: settings.sections || [],
                            onChange: (sections) => setSettings({ ...settings, sections }),
                        }}
                    >
                    {/* 32px between the cards, like Home and the gallery.
                        At zero, one card's last field and the next card's
                        heading read as one continuous column. */}
                    <SaveNowProvider value={{ save: saveCopy, saving: savingCopy, dirty: copyDirty }}>
                    <CmsSteps>
                        <CmsStep sectionKey="events.header" fieldMode="content" step="Section 1" title="Heading">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <CmsField label="Eyebrow">
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
                        >
                            <CmsTextarea
                                rows={3}
                                value={settings.lede}
                                onChange={(e) => setSettings({ ...settings, lede: e.target.value })}
                                placeholder="Discover impactful events, conclaves and programs..."
                            />
                        </CmsField>

                        <CmsField label="Subtitle">
                            <CmsInput
                                value={settings.subtitle}
                                onChange={(e) => setSettings({ ...settings, subtitle: e.target.value })}
                                placeholder="join the network"
                            />
                        </CmsField>

                        <CmsField label="Empty message">
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
                        </CmsStep>

                        {/* ----------------------------------------- hero band */}
                        <CmsStep
                            sectionKey="events.hero"
                            /* Words over a photograph; no details card. */
                            fieldMode="content"
                            step="Section 2"
                            title="Hero band"
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
                                    <CmsField label="Badge title">
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
                                <CmsField label="Figures">
                                    <StatList
                                        items={settings.stats}
                                        onChange={(stats) => setSettings({ ...settings, stats })}
                                        noun="figure"
                                        max={4}
                                    />
                                </CmsField>
                            </div>
                        </CmsStep>

                        {/* ------------------------------------ search and chips */}
                        <CmsStep
                            sectionKey="events.filters"
                            /*
                             * THIS CARD'S LOGIC IS CHIPS, so its extra rows
                             * are shaped like a chip: a mark and a name, with
                             * what it says beside them. No "show it as" pair
                             * — a rail of pills has no write-up to put a
                             * paragraph in, so the question has one answer.
                             */
                            fieldMode="card"
                            fieldNoun="label"
                            step="Section 3"
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
                                    /*
                                     * A CHIP IS NAMED BY `label`, NOT `title`.
                                     *
                                     * Without this the collapsed row fell back
                                     * to "Untitled chip" on every row, so a
                                     * list of six filters read as six blanks
                                     * and the only way to tell them apart was
                                     * to open each one. The row HAD a name the
                                     * whole time — the list was reading a
                                     * field this shape does not have.
                                     */
                                    summary={(chip) => ({ title: chip.label, subtitle: chip.icon })}
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
                        </CmsStep>

                        {/* ------------------------------------------ cta strip */}
                        <CmsStep
                            sectionKey="events.banner"
                            step="Section 4"
                            title="Call-to-action strip"
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
                                        <CmsField label="Button label">
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
                        </CmsStep>

                        <CmsStep sectionKey="events.grid" ownFields={false} step="Section 5" title="Grid and button">
                        {/*
                          * The home-page picker used to sit here, and does not
                          * any more: the TABLE below has a Home page column with
                          * a switch on every row, so this card was asking the
                          * same question about the same events a few hundred
                          * pixels from where it is already answered.
                          *
                          * The picker lives on the Home screen, where the
                          * question belongs to the page being edited.
                          */}
                        {/* “Events on the home page” used to lead this row. The
                            switches above decide now — see `EventsGrid`. */}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <CmsField label="Button label">
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
                        <ExtraFieldsEditor
                            items={settings.extraFields || []}
                            onChange={extraFields => setSettings({ ...settings, extraFields })}

                        />
                        </CmsStep>

                    </CmsSteps>
                    </SaveNowProvider>
                    </SectionToolsProvider>

                    {/*
                      * NO SAVE BAND UNDER THE LAST CARD.
                      *
                      * There was one here, and the moment every card grew a
                      * Save in its footer it became a SECOND full-width blue
                      * button stacked directly under the first — same colour,
                      * same width, same action, four pixels apart. Two buttons
                      * that do one thing is a question the editor has to stop
                      * and answer, and it was reported as exactly that.
                      *
                      * The card footers are the save now, on every card, which
                      * is what the rest of the CMS does. Nothing is lost: each
                      * of them calls `saveCopy`, and this button called the
                      * same function.
                      */}
                </CmsCard>
            )}

            {showForm && (
                /*
                 * AN EVENT OPENS ON A SCREEN OF ITS OWN, the way a state page
                 * does in Regions & States. It was a dialog over the table — a
                 * scroll inside a scroll, with the page locked behind it.
                 */
                <div aria-label={editing ? 'Edit event' : 'New event'}>
                    <button
                        type="button"
                        onClick={() => setShowForm(false)}
                        className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3.5 py-2
                                   text-[1.0625rem] font-semibold text-slate-600 transition-colors hover:border-[#2563EB]
                                   hover:text-[#2563EB] dark:border-[#2a2a2a] dark:text-neutral-300"
                    >
                        <ArrowLeft className="h-4 w-4" /> Back to the events
                    </button>

                    {/*
                      * `max-h` and a THREE-PART COLUMN: header, scrolling body,
                      * footer. Letting the whole dialog scroll would take the
                      * Create button off screen on a long form, which is the
                      * fault this change exists to fix.
                      */}
                    {/*
                      * A CARD, AND IT HAS TO READ AS ONE.
                      *
                      * It was `max-w-4xl` - 896px - which is a card on a wide
                      * monitor and the whole screen on a laptop running at 150%
                      * or 200%, where the CSS viewport is around 950px. At that
                      * width the backdrop is a 20px margin, the rounded corners
                      * are off the edge of the glass, and what is technically a
                      * dialog reads as a page that has replaced the events
                      * table. Reported exactly that way: "where is the box".
                      *
                      * 2xl (672px) stays a card at every width anybody uses,
                      * and the form inside it is two columns at that size. The
                      * border is there for the same reason: on a light
                      * background a shadow alone does not draw an edge.
                      */}
                    <div className="relative w-full bg-white dark:bg-[#0b0b0b] rounded-2xl
                                    border border-slate-200 dark:border-[#1f1f1f] flex flex-col">

                        <header className="shrink-0 flex items-start gap-4 px-5 sm:px-7 py-5
                                           border-b border-slate-200 dark:border-[#1f1f1f]">
                            <div className="min-w-0 flex-1">
                                <h2 className={`${CARD_TITLE} text-slate-900 dark:text-neutral-100`}>
                                    {editing ? 'Edit event' : 'New event'}
                                </h2>
                                <p className="text-[1.25rem] text-slate-500 dark:text-[#A1A1AA] mt-1">
                                    Published events appear on the public site and to signed-in members.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                aria-label="Close"
                                className="shrink-0 w-10 h-10 rounded-xl border border-slate-200
                                           dark:border-[#2a2a2a] flex items-center justify-center
                                           text-slate-500 hover:bg-slate-50 dark:hover:bg-[#141414]"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </header>

                    <form id="event-form" onSubmit={handleSubmit}
                          className="px-5 sm:px-7 py-6
                                     grid gap-4 sm:grid-cols-2 content-start">
                        <div className="sm:col-span-2">
                            {/*
                              NOT `required` — no field on this form is.
                              
                              An event is written over several sittings, and a
                              form that refuses to save without a title is a form
                              that gets "TBC" typed into it. The draft/published
                              control is what says whether it is ready; the
                              fields say what is known so far. The server stores
                              a blank the same way, and every reader falls back —
                              see the note at the top of the event schema.
                            */}
                            <CmsField label="Title">
                                <CmsInput value={form.title} placeholder="Untitled event"
                                    onChange={(e) => setForm({ ...form, title: e.target.value })} />
                            </CmsField>

                            {/* Straight under the title, which is how an event
                                is written: the name, then what it is about. It
                                sat below the banner and the category, four
                                fields away from the sentence it continues. */}
                            <CmsField label="Description">
                                <CmsTextarea rows={4} value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })} />
                            </CmsField>
                        </div>

                        <CmsField label="Date">
                            {/* MOVING THE START MOVES THE EVENT: the last day
                                and every day's hours and sessions go with it
                                (see `shiftDays`), the way a calendar moves a
                                multi-day booking. Moving only the first day
                                left the programme filed under dates the event
                                no longer ran on. */}
                            <CmsInput type="date" value={form.date}
                                onChange={(e) => {
                                    const next = e.target.value;
                                    const delta = dayDelta(form.date, next);
                                    if (!next || !Number.isFinite(delta) || delta === 0) {
                                        setForm({ ...form, date: next });
                                        return;
                                    }
                                    setForm({
                                        ...form,
                                        date: next,
                                        endDate: form.endDate
                                            ? addDays(form.endDate, delta) || form.endDate
                                            : form.endDate,
                                        days: shiftDays(form.days || [], delta),
                                    });
                                }} />
                        </CmsField>

                        <div className="grid grid-cols-1 gap-3">
                            {/*
                              * `TimeField`, NOT a native time input.
                              *
                              * `<input type="time">` renders in the BROWSER's
                              * locale and nothing in the page overrides that —
                              * `lang="en-US"` was tried here and an en-GB
                              * browser still showed a 24-hour clock, so
                              * "10:00" gave no way to tell a morning session
                              * from an evening one. The replacement always
                              * shows AM/PM and stores the same "HH:MM" string,
                              * so nothing downstream changes.
                              */}
                            <CmsField label="Starts">
                                <TimeField
                                    label="Start time"
                                    value={form.time}
                                    onChange={(time) => setForm({ ...form, time })}
                                />
                            </CmsField>
                            <CmsField label="Ends">
                                <TimeField
                                    label="End time"
                                    value={form.endTime}
                                    onChange={(endTime) => setForm({ ...form, endTime })}
                                />
                            </CmsField>
                        </div>

                        <CmsField
                            label="Last day"
                            hint="Only for an event that runs over more than one day. Leave it blank and the event is on the date above."
                        >
                            <CmsInput
                                type="date"
                                value={form.endDate}
                                min={form.date || undefined}
                                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                            />
                        </CmsField>

                        {/*
                          * THE PER-DAY PROGRAMME, and it draws itself only when
                          * the event actually runs over more than one day — see
                          * `EventDaysEditor`. A one-day event keeps the single
                          * Starts/Ends pair above and gains no furniture.
                          */}
                        <div className="sm:col-span-2">
                            <EventDaysEditor
                                startDate={form.date}
                                endDate={form.endDate}
                                days={form.days}
                                onChange={(days) => setForm({ ...form, days })}
                            />
                        </div>


                        {/*
                          * ONE COLUMN OR TWO, DEPENDING ON WHETHER THE VENUE
                          * FIELD IS THERE.
                          *
                          * A fixed two-column row leaves Category stranded in
                          * the left half of an online event's form with a
                          * column of nothing beside it, which reads as a field
                          * that failed to render rather than as a field that
                          * does not apply. With the venue gone, Category takes
                          * the width — the same thing Title and Description do,
                          * so the form still reads as one ruled edge down each
                          * side.
                          */}
                        <div className={`sm:col-span-2 grid gap-4 ${
                            form.detail.mode === 'online' ? '' : 'sm:grid-cols-2'
                        }`}>
                            {/*
                              * THE VENUE FIELD IS FOR EVENTS THAT HAVE ONE.
                              *
                              * An online event has no room, and asking for one
                              * anyway is how "Location: Chennai Trade Centre"
                              * ends up on the card of a Zoom call. The address
                              * and map that DO belong to a physical event are in
                              * the "How it is attended" section below; this is
                              * the short line the cards print, so it follows the
                              * same rule.
                              *
                              * Hidden, not cleared. A venue typed before the
                              * event was switched to online is kept on the
                              * record, so switching back does not ask for it a
                              * second time — the same thing the platform and
                              * link do in the other direction.
                              */}
                            {form.detail.mode !== 'online' && (
                                <CmsField label="Location / venue">
                                    <CmsInput value={form.location}
                                        onChange={(e) => setForm({ ...form, location: e.target.value })}
                                        placeholder="Chennai Trade Centre" />
                                </CmsField>
                            )}

                            {/*
                              A datalist rather than a select: the chip list
                              below is free text an editor can add to, and a
                              closed dropdown would make an event uncategorisable
                              until someone had also edited the chips. This
                              suggests the existing chips and still accepts a new
                              word — which then shows on the card as a badge and
                              is matched by a chip the moment one is added.
                            */}
                            {/*
                              * A REAL SELECT, not a `<datalist>`.
                              *
                              * The datalist's popup is drawn by the browser, not
                              * by us — Chrome renders it from the input's own
                              * `color-scheme`, and this input carries a
                              * `dark:bg-black` variant, so the suggestions came
                              * up as white text on a black panel in the middle
                              * of a light form. Nothing in our stylesheet can
                              * reach inside that popup to correct it.
                              *
                              * A select is ours to style, and the free-text the
                              * datalist bought is no longer worth its cost:
                              * categories are a managed list with its own screen
                              * now, so "add it under Events → Categories" is a
                              * real answer rather than a dead end.
                              */}
                            <CmsField
                                label="Category"
                            >
                                <select
                                    value={form.category}
                                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                                    className="w-full h-12 rounded-xl border border-slate-200 bg-white px-3.5
                                               text-[1.25rem] text-slate-900 outline-none transition-colors
                                               focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                                >
                                    <option value="">No category</option>
                                    {/*
                                      * A category this event already carries but
                                      * the list no longer offers is kept as an
                                      * option, or opening an old event would
                                      * silently reset it to "No category" and
                                      * saving would make that true.
                                      */}
                                    {form.category
                                        && !(settings?.categories || []).some(c => c.label === form.category)
                                        ? <option value={form.category}>{form.category} (not listed)</option>
                                        : null}
                                    {/*
                                      * ONLY THE CATEGORIES THIS KIND OF EVENT
                                      * CAN BE FILED UNDER.
                                      *
                                      * A category is marked online-only,
                                      * in-person-only, or both, on Events →
                                      * Categories. This is where that earns its
                                      * keep: "ZOOM" and "Webinars" stop being
                                      * offered on an event people are driving
                                      * to, and "Tea party" and "Club House"
                                      * stop being offered on a video call.
                                      *
                                      * A row with no `mode` is treated as
                                      * `both` — every category written before
                                      * the field existed, and what they have
                                      * always meant. The event's own category,
                                      * whatever its mode, is kept by the branch
                                      * above, so switching an event to online
                                      * never silently drops the label it
                                      * already carries.
                                      */}
                                    {(settings?.categories || [])
                                        .filter(c => {
                                            const mode = (c as { mode?: string }).mode || 'both';
                                            return mode === 'both' || mode === form.detail.mode;
                                        })
                                        .map((c, i) => (
                                            <option key={i} value={c.label}>{c.label}</option>
                                        ))}
                                </select>
                            </CmsField>

                            {/* WHAT IT IS ABOUT, AND IN WHICH LANGUAGE — both go
                                into the booking email and WhatsApp message. */}
                            <CmsField label="Topic" hint="The subject in a few words, e.g. “Government procurement for MSMEs”.">
                                <CmsInput
                                    value={form.detail.topic}
                                    maxLength={120}
                                    onChange={(e) => setForm({ ...form, detail: { ...form.detail, topic: e.target.value } })}
                                    placeholder="What the event is about"
                                />
                            </CmsField>
                            <CmsField label="Language" hint="The language it is held in, e.g. Tamil, English, or Tamil & English.">
                                <CmsInput
                                    value={form.detail.language}
                                    maxLength={60}
                                    onChange={(e) => setForm({ ...form, detail: { ...form.detail, language: e.target.value } })}
                                    placeholder="Tamil & English"
                                />
                            </CmsField>
                        </div>

                        {/* ===================== 2b · HOW IT IS ATTENDED
                          *
                          * BESIDE THE CATEGORY, because it is decided at the
                          * same moment. "What kind of event" and "is there a
                          * room to come to" are the two things an editor knows
                          * before they know anything else, and they are two
                          * different questions — which is the whole reason this
                          * exists. With no field for it, editors put "ZOOM" and
                          * "Webinars" into the category list, where they sit
                          * beside "Tea party" and "Exhibitions" describing a
                          * platform rather than a kind of event.
                          *
                          * It was first written into the collapsible detail
                          * panel below, four screens down under a heading that
                          * says "Programme, speakers and registration". An
                          * editor creating an event never got there. Reported
                          * as "still not shows categorised online or offline".
                          */}
                        <div className="sm:col-span-2">
                            {/*
                              * A VISIBLE CAPTION, in the same type as Title,
                              * Date and Category.
                              *
                              * `CmsChoice` takes its `label` as an aria-label
                              * only — every other call site sits under a section
                              * heading that already says what the group is for.
                              * This one sits in the middle of a plain field
                              * stack, and without a caption the two cards read
                              * as an unlabelled pair of boxes that have drifted
                              * under the Category select. The caption is what
                              * puts them on the same left edge as every other
                              * field's name.
                              */}
                            <span className="block mb-2 text-[1.25rem] font-semibold
                                             text-slate-800 dark:text-neutral-100">
                                How this event is attended
                            </span>
                            <CmsChoice
                                label="How this event is attended"
                                value={form.detail.mode}
                                onChange={(mode) => setForm({
                                    ...form,
                                    detail: { ...form.detail, mode },
                                })}
                                options={[
                                    {
                                        value: 'offline' as const,
                                        icon: <MapPin className="h-4 w-4" />,
                                        title: 'In person',
                                        detail: 'People come to a venue. The page shows the address and a Directions button.',
                                    },
                                    {
                                        value: 'online' as const,
                                        icon: <Video className="h-4 w-4" />,
                                        title: 'Online',
                                        detail: 'People join on a link. The page names the platform; the link itself goes only to those who book.',
                                    },
                                ]}
                            />

                            {/*
                              * The fields that follow from the answer, in the
                              * same block rather than in a section of their own:
                              * they ARE the answer, and an editor who has just
                              * picked Online is looking for the link box now.
                              */}
                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                {form.detail.mode === 'online' ? (
                                    <>
                                        <CmsField
                                            label="Platform"
                                            hint="Zoom, Google Meet, Microsoft Teams — whatever people will need open."
                                        >
                                            <CmsInput
                                                value={form.detail.onlinePlatform}
                                                placeholder="Zoom"
                                                onChange={(e) => setForm({
                                                    ...form,
                                                    detail: { ...form.detail, onlinePlatform: e.target.value },
                                                })}
                                            />
                                        </CmsField>
                                        <CmsField
                                            label="Registration link"
                                            hint="The Zoom (or other) registration form. Not shown publicly — it is sent to the people who book, and the platform then emails each of them their joining link."
                                        >
                                            <CmsInput
                                                value={form.detail.onlineUrl}
                                                placeholder="https://zoom.us/meeting/register/…"
                                                onChange={(e) => setForm({
                                                    ...form,
                                                    detail: { ...form.detail, onlineUrl: e.target.value },
                                                })}
                                            />
                                        </CmsField>
                                    </>
                                ) : (
                                    <>
                                        <CmsField label="Venue address">
                                            <CmsInput
                                                value={form.detail.venueAddress}
                                                onChange={(e) => setForm({
                                                    ...form,
                                                    detail: { ...form.detail, venueAddress: e.target.value },
                                                })}
                                            />
                                        </CmsField>
                                        <CmsField label="Map link">
                                            <CmsInput
                                                value={form.detail.venueMapUrl}
                                                placeholder="https://maps.app.goo.gl/…"
                                                onChange={(e) => setForm({
                                                    ...form,
                                                    detail: { ...form.detail, venueMapUrl: e.target.value },
                                                })}
                                            />
                                        </CmsField>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="sm:col-span-2">
                            {/*
                              * 16/9 — the shape of the banner on an event card.
                              *
                              * THE SIZE IS PRINTED, because an editor cannot
                              * guess it and a poster that is the wrong shape is
                              * either cropped or padded on the live page. The
                              * numbers are the real ones: the event page draws
                              * this frame at up to 1600px wide, so 1600 x 900
                              * is one pixel per pixel on a laptop and still
                              * sharp on a retina screen at the width the card
                              * uses.
                              */}
                            <MediaPicker
                                label="Banner"
                                aspect="16 / 9"
                                hint={'Best at 1600 × 900 pixels (16:9, landscape) — that is the shape '
                                    + 'and size the event page and the event cards draw. Up to about 2MB. '
                                    + 'A picture of a different shape is not rejected: it is shown whole, '
                                    + 'with the frame padded either side, unless you set Fit to "Fill frame".'}
                                value={form.media}
                                onChange={(media) => setForm({ ...form, media })}
                            />
                        </div>

                        {/* ============================== 3 · WHO IT REACHES

                          AFTER the event exists, not before it.

                          This used to be the SECOND thing on the form — the
                          hardest decision on it, asked before the editor had
                          said what the event was or when it was. An editor
                          cannot sensibly choose an audience for something they
                          have not described yet, and several simply scrolled
                          past it.

                          It still comes before the programme and the ticketing,
                          because it is the decision that determines whether any
                          of that is ever seen. WHERE THE EVENT IS HELD and WHO
                          IT IS FOR remain different questions — the venue is a
                          line on a card, this decides whose dashboard the card
                          appears on at all.
                        */}

                        <div className="sm:col-span-2">
                            <RegionTargetPicker
                                targets={form.targets}
                                onChange={targets => setForm({ ...form, targets })}
                                reachEveryone={form.reachEveryone}
                                onReachEveryoneChange={reachEveryone =>
                                    setForm({ ...form, reachEveryone })}
                                // Feeds the reach count: the members-only switch
                                // narrows the audience further, and its effect is
                                // invisible from the section it is set in.
                                audience={form.detail.audience}
                                title="Who sees this event"
                                hint={'Members, block admins, district admins and state admins only see events aimed '
                                    + 'at where they are. Choose one of the two below.'}
                            />
                        </div>

                        {/*
                          THE SECOND QUESTION, AND ONLY ON THIS SURFACE.

                          The picker above decides whose DASHBOARD this appears
                          on. This decides whether the same event is also
                          advertised on the onboarding website, where the reader
                          is an anonymous visitor rather than a member in a
                          region.

                          Asked as a question rather than assumed either way,
                          because both answers are normal and neither is safe to
                          guess: a district's internal training day must not
                          reach a marketing page, and the same district's trade
                          expo exists precisely to be found by people who are not
                          members yet.

                          ALWAYS ON THIS SURFACE, AND IN THE CMS ONLY ONCE
                          REGIONS ARE SET.

                          An untargeted CMS event is onboarding content by
                          definition, so the control there would be a choice
                          that could only have one answer — noise on every form.
                          The moment an editor picks a region it stops being
                          obvious: a targeted event that is NOT on the onboarding
                          site simply disappears from the public grid, and
                          without this it disappeared silently, from a screen
                          whose only visible effect was three ticked boxes.
                        */}
                        {(channel === 'members' || form.targets.length > 0) && (
                            <div className="sm:col-span-2">
                                <div>
                                    {/*
                                      A CHECKBOX, NOT A THIRD RADIO OPTION.

                                      Posting to the onboarding site is not an
                                      alternative to the two cards above it:
                                      `event.service.listEvents` never reads
                                      `showOnOnboarding`, so members in the
                                      chosen regions receive the event either
                                      way. Rendering it inside that radio group
                                      would claim that ticking it takes the
                                      event off the member dashboards, which is
                                      untrue — and was the framing this control
                                      already had removed once.

                                      The two paragraphs that used to stand above
                                      it said as much in prose. One line on the
                                      card says it where it is read.
                                    */}
                                    <CmsCheck
                                        checked={form.showOnOnboarding}
                                        onChange={(showOnOnboarding) => setForm({ ...form, showOnOnboarding })}
                                        icon={<Globe className="w-4 h-4" />}
                                        title="Also post it in the onboarding events section"
                                        detail="Members see it either way. This adds it to the public site too."
                                    />

                                    {/*
                                      Shown only when both are true, because that
                                      is the combination whose consequence is not
                                      obvious from either control on its own: the
                                      event is aimed at a few regions AND is going
                                      on a page that anyone, anywhere, can read.
                                      Nothing is being overridden — the regions
                                      still govern the dashboards — but the editor
                                      should know the notice is now readable
                                      outside them.
                                    */}
                                    {form.showOnOnboarding && form.targets.length > 0 && (
                                        <p className="mt-3 flex items-start gap-2 rounded-lg border border-blue-200
                                                      dark:border-blue-900/60 bg-blue-500/5 px-3 py-2 text-[1.1875rem]
                                                      text-blue-700 dark:text-blue-300">
                                            <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                            <span>
                                                Aimed at {form.targets.length === 1
                                                    ? '1 region'
                                                    : `${form.targets.length} regions`}, and now readable by
                                                anyone on the public site. Visitors can filter the events page down
                                                to a state, district or block, so it stays findable by the people
                                                it is for.
                                            </span>
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        <CmsCheck
                            checked={form.showQrOnPage}
                            onChange={(showQrOnPage) => setForm({ ...form, showQrOnPage })}
                            icon={<QrCode className="w-4 h-4" />}
                            title="Show the event's QR code on its page"
                            detail="Scanning it opens this event on a phone. The code itself is always available from the QR button."
                        />

                        <EventDetailFields
                            value={form.detail}
                            onChange={(detail) => setForm({ ...form, detail })}
                            eventId={editing}
                            /*
                             * Decided from the DATES, which live on this form
                             * rather than inside that component. A multi-day
                             * event hides the flat agenda there, because its
                             * programme is written day by day above — two
                             * programme editors on one screen is how half the
                             * sessions end up in the list the page never
                             * prints.
                             */
                            multiDay={!!form.endDate && form.endDate !== form.date}
                        />

                        <CmsField label="Visibility">
                            <select
                                value={form.status}
                                onChange={(e) => setForm({ ...form, status: e.target.value as 'published' | 'draft' })}
                                className={`w-full ${FILTER_SELECT}`}
                            >
                                <option value="published">Published</option>
                                <option value="draft">Draft</option>
                            </select>
                        </CmsField>

                    </form>

                        {/*
                          * OUTSIDE the scrolling body, so Cancel and Create are
                          * where they were when the dialog opened however far
                          * down the form has been scrolled.
                          *
                          * `form="event-form"` is what still submits it from out
                          * here — a submit button outside its form needs the id,
                          * or the button does nothing and nothing says why.
                          */}
                        <footer className="sticky bottom-0 z-10 flex flex-wrap justify-end gap-3 rounded-b-2xl px-5 sm:px-7 py-4
                                           border-t border-slate-200 dark:border-[#1f1f1f]
                                           bg-slate-50/95 backdrop-blur dark:bg-[#0d0d0d]/95">
                            <CmsButton type="button" variant="ghost" onClick={() => setShowForm(false)}>
                                Cancel
                            </CmsButton>
                            <CmsButton type="submit" form="event-form" loading={saving}>
                                {editing ? 'Save event' : 'Create event'}
                            </CmsButton>
                        </footer>
                    </div>
                </div>
            )}

            {!showForm && !wordingTab && (
            <CmsCard
                /* “3 of 8” whenever ANY filter is narrowing. The old count
                   watched the target filter alone, so a search or a date
                   filter showed a bare “Events (3)” on a screen holding
                   eight — which is the number the association reported. */
                title={`Events (${visibleEvents.length}`
                    + `${visibleEvents.length === events.length ? '' : ' of ' + events.length})`}
                description={channel === 'public'
                    ? 'Everything on the onboarding site — the programme written here and every event posted from the admin portal.'
                    : 'Aim an event at a region when you create it.'}
                actions={
                    /* ONE control in the header, and it is the one that
                       creates something. The three filters narrow the table
                       and belong over the table — up here they took their own
                       width out of the row and left the description reading
                       as a narrow column with an empty card beside it. */
                    <CmsButton type="button" onClick={openNew}>
                        <Plus className="w-4 h-4" /> Add event
                    </CmsButton>
                }
            >
                {events.length === 0 ? (
                    <CmsEmpty title="No events yet" />
                ) : (
                  <>
                    {/*
                      WHY THE PUBLIC PAGE SHOWS FEWER THAN THIS LIST.

                      `/events` and the home page carry what is still to come.
                      Eight here and three there is the rule working — but no
                      screen said so, so it read as a fault. It is stated where
                      the question gets asked.
                    */}
                    {events.length > upcomingCount && (
                        <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg
                                      border border-slate-200 bg-slate-50 px-3 py-2.5
                                      text-[1.1875rem] text-slate-600 dark:border-[#2a2a2a]
                                      dark:bg-[#0f0f0f] dark:text-neutral-300">
                            <span>
                                <strong className="font-semibold text-slate-900 dark:text-white">
                                    {upcomingCount} of these {upcomingCount === 1 ? 'is' : 'are'} on the
                                    events page and the home page.
                                </strong>{' '}
                                The other {events.length - upcomingCount} have already been held —
                                the events page and the home page show what is still to come.
                            </span>
                            <button
                                type="button"
                                onClick={() => setWhen('past')}
                                className="font-semibold text-blue-700 underline underline-offset-2
                                           dark:text-blue-400"
                            >
                                Show the ones already held
                            </button>
                        </p>
                    )}

                    {/*
                      THE FILTERS, over the table they narrow.

                      They were in the card header, where they took their own
                      width out of the title row. Here they sit with the search
                      box, which is the other control that narrows this list.
                    */}
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                        {/* Only on the CMS surface, and only once there is
                            something to separate: on the admin screen every row
                            is the admin's, so the control would be a filter with
                            one answer. */}
                        {channel === 'public' && adminPosted > 0 && (
                            <select
                                value={originFilter}
                                onChange={(e) => setOriginFilter(e.target.value as 'all' | 'cms' | 'admin')}
                                aria-label="Filter events by where they came from"
                                className={FILTER_SELECT}
                            >
                                <option value="all">Everything on the site</option>
                                <option value="cms">Written here</option>
                                <option value="admin">Posted from the admin portal ({adminPosted})</option>
                            </select>
                        )}


                        {/* Only targets actually in use. Offering the whole
                            region tree here would be 6,966 blocks, nearly all
                            of them matching nothing. */}
                        {targetOptions.length > 1 && (
                            <select
                                value={targetFilter}
                                onChange={(e) => setTargetFilter(e.target.value)}
                                aria-label="Filter events by who sees them"
                                className={FILTER_SELECT}
                            >
                                <option value="all">Every audience</option>
                                {targetOptions.map(t => (
                                    <option key={t} value={t}>{t === 'Everyone' ? 'Everyone (no target)' : t}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Full width and above the table. */}
                    <div className="relative mb-4">
                        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2
                                           w-4 h-4 text-neutral-400" />
                        <input
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search by title, venue, category or region…"
                            aria-label="Search events"
                            className="w-full bg-slate-50 dark:bg-black border border-slate-300
                                       dark:border-[#2a2a2a] rounded-lg pl-10 pr-3 py-2.5
                                       text-[1.1875rem] text-slate-900 dark:text-neutral-100"
                        />
                    </div>

                    {visibleEvents.length === 0 ? (
                        <CmsEmpty
                            title="Nothing matches"
                            hint="No event answers all of the filters above. Clear one of them."
                        />
                    ) : (
                    <div ref={cardTableRef} className="overflow-x-auto card-table">
                        <table className="w-full text-[1.25rem]">
                            <thead>
                                <tr className="text-left text-neutral-500 dark:text-neutral-400 border-b border-slate-200 dark:border-[#1f1f1f]">
                                    <th className="pb-4 pr-4 text-[1.1875rem] sm:text-[1.0625rem] font-semibold uppercase tracking-wider w-16">Banner</th>
                                    <th className="pb-4 pr-4 text-[1.1875rem] sm:text-[1.0625rem] font-semibold uppercase tracking-wider">Title</th>
                                    <th className="pb-4 pr-4 text-[1.1875rem] sm:text-[1.0625rem] font-semibold uppercase tracking-wider">When</th>
                                    <th className="pb-4 pr-4 text-[1.1875rem] sm:text-[1.0625rem] font-semibold uppercase tracking-wider">Where</th>
                                    <th className="pb-4 pr-4 text-[1.1875rem] sm:text-[1.0625rem] font-semibold uppercase tracking-wider">Status</th>
                                    <th className="pb-4 text-[1.1875rem] sm:text-[1.0625rem] font-semibold uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* The row rule was `border-slate-800/60` — a DARK
                                    border on a table that is white in light mode, so
                                    every row was separated by a near-black line while
                                    the header a few lines up used `slate-200`. Matched
                                    to the header, plus a hover tint to make a long row
                                    readable across its whole width. */}
                                {visibleEvents.map((e) => (
                                    <tr
                                        key={e.id}
                                        className="border-b border-slate-200 transition-colors
                                                   hover:bg-slate-50/70 dark:border-[#1f1f1f]
                                                   dark:hover:bg-[#101010]"
                                    >
                                        <td className="py-4 pr-4">
                                            {/*
                                              TWO PLACES AN EVENT'S PICTURE CAN LIVE.

                                              `media` is the shape every other CMS section
                                              uses and carries the fit and the focal point;
                                              `imageUrl` is the older field the mobile app
                                              reads. Today the server fills both from
                                              `bannerUrl`, so either would do.

                                              Reading both anyway, because that is what
                                              every public page does: a row whose picture
                                              reached only one of them draws a grey box
                                              here and a photograph on the live site, and
                                              an editor trusting this column would add a
                                              second picture to an event that has one.
                                            */}
                                            <div className="w-14 h-10 rounded overflow-hidden
                                                            bg-slate-100 dark:bg-[#161616]">
                                                {(e.media?.url || e.imageUrl) ? (
                                                    <CmsMediaFrame
                                                        media={e.media?.url ? e.media : {
                                                            url: e.imageUrl,
                                                            type: 'image',
                                                            alt: e.title || '',
                                                            fit: 'cover',
                                                            position: 'center',
                                                        }}
                                                        width={160}
                                                    />
                                                ) : null}
                                            </div>
                                        </td>
                                        <td className="py-4 pr-4 text-slate-800 dark:text-neutral-200">
                                            {/* Named, not dashed. A row reading "—"
                                                is indistinguishable from a row that
                                                failed to load, and an untitled event
                                                is a normal thing to have half-written
                                                now that no field is required. */}
                                            <span className="block font-semibold leading-snug">
                                                {e.title || (
                                                    <span className="italic font-normal text-neutral-400">
                                                        Untitled event
                                                    </span>
                                                )}
                                            </span>

                                            {/*
                                              THE BADGES, ON THEIR OWN LINE.

                                              Each carried `ml-2` and sat inline after
                                              the title, so a long title and three
                                              badges ran together on one baseline and
                                              the row read as one unbroken string. A
                                              wrapped flex row with a real gap puts the
                                              title first and everything said ABOUT it
                                              underneath.
                                            */}
                                            <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                            {/* The audience is a fact about the row that
                                                the status column cannot carry: a published
                                                members-only event and a published open one
                                                both read "published". */}
                                            {e.audience === 'paid' ? (
                                                <span className="inline-flex items-center gap-1 text-[1.0625rem]
                                                                 font-bold uppercase tracking-wide px-1.5 py-0.5
                                                                 rounded-full bg-blue-100 dark:bg-blue-950
                                                                 text-blue-700 dark:text-blue-400">
                                                    <Lock className="w-2.5 h-2.5" /> Members
                                                </span>
                                            ) : null}
                                            {/*
                                              WHETHER THE PUBLIC CAN READ IT — the other
                                              fact the status column cannot carry, and
                                              the alternative to opening every event to
                                              find out.

                                              EACH SURFACE SHOWS THE UNUSUAL ANSWER, not
                                              the same badge twice. In the admin area
                                              almost nothing is public, so "Onboarding"
                                              is the row worth marking; in the CMS almost
                                              everything is, so the same badge would land
                                              on every line and carry no information —
                                              there it is the targeted event that has
                                              dropped OFF the public grid that the editor
                                              needs to see. Same rule as the
                                              registration badge below, and for the same
                                              reason.
                                            */}
                                            {channel === 'members' && isOnPublicSite(e) ? (
                                                <span className="inline-flex items-center gap-1 text-[1.0625rem]
                                                                 font-bold uppercase tracking-wide px-1.5 py-0.5
                                                                 rounded-full bg-emerald-100 dark:bg-emerald-950
                                                                 text-emerald-700 dark:text-emerald-400">
                                                    <Globe className="w-2.5 h-2.5" /> Onboarding
                                                </span>
                                            ) : null}
                                            {/* The other answer, said out loud. Without
                                                it a members-only row looked like every
                                                other row, and the first sign it was not
                                                public was a visitor's "Not found". */}
                                            {channel === 'members' && !isOnPublicSite(e) ? (
                                                <span className="inline-flex items-center gap-1 text-[1.0625rem]
                                                                 font-bold uppercase tracking-wide px-1.5 py-0.5
                                                                 rounded-full bg-slate-100 dark:bg-[#1a1a1a]
                                                                 text-slate-600 dark:text-neutral-400"
                                                    title="Members only — not on the public site. Tick “Also post it in the onboarding events section” to publish it there.">
                                                    <Lock className="w-2.5 h-2.5" /> Members only
                                                </span>
                                            ) : null}
                                            {/* WHOSE EVENT THIS IS. On the CMS
                                                surface a members-channel row is
                                                the super admin's, posted to the
                                                onboarding site from their own
                                                screen — worth marking, because
                                                it is the row an editor did not
                                                write and may not expect to
                                                find. */}
                                            {channel === 'public' && (e.channel || 'public') !== 'public' ? (
                                                <span className="inline-flex items-center gap-1 text-[1.0625rem]
                                                                 font-bold uppercase tracking-wide px-1.5 py-0.5
                                                                 rounded-full bg-violet-100 dark:bg-violet-950
                                                                 text-violet-700 dark:text-violet-400 align-middle"
                                                    title="Posted from the admin portal (Super Admin or Events Admin). Editable here as well.">
                                                    <Shield className="w-2.5 h-2.5" /> Admin portal
                                                </span>
                                            ) : null}
                                            {channel === 'public' && !isOnPublicSite(e) ? (
                                                <span className="inline-flex items-center gap-1 text-[1.0625rem]
                                                                 font-bold uppercase tracking-wide px-1.5 py-0.5
                                                                 rounded-full bg-amber-100 dark:bg-amber-950/60
                                                                 text-amber-700 dark:text-amber-400 align-middle"
                                                    title="Not listed on the public events page — either aimed at chosen regions, or posted from the admin area.">
                                                    <Building2 className="w-2.5 h-2.5" /> Off public site
                                                </span>
                                            ) : null}
                                            {/*
                                              Registration OFF is the state worth
                                              showing, and it was the one that was
                                              invisible.

                                              This printed "registration open" when
                                              on and nothing at all when off — so a
                                              list of seven events with registration
                                              off looked identical to a list of
                                              seven perfectly normal ones, and the
                                              first anybody knew was a member asking
                                              why there was no Register button.
                                              Measured against the live database:
                                              that is exactly what had happened.

                                              An announcement nobody registers for is
                                              a real thing to publish, so this is a
                                              label and not a warning — but it is a
                                              label you can see.
                                            */}
                                            {e.registrationEnabled ? (
                                                <span className="text-[1.0625rem] font-medium
                                                                 text-emerald-600">
                                                    registration open
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1
                                                                 text-[1.0625rem] font-semibold uppercase
                                                                 tracking-wide px-1.5 py-0.5 rounded-full
                                                                 bg-amber-100 dark:bg-amber-950
                                                                 text-amber-700 dark:text-amber-400">
                                                    No registration
                                                </span>
                                            )}
                                            </span>
                                        </td>
                                        <td className="py-4 pr-4 text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                                            {/*
                                              * NO SECONDS.
                                              *
                                              * `toLocaleString()` with no options prints
                                              * them — "10/10/2026, 9:00:00 AM" — and an
                                              * event does not start at a second. The
                                              * trailing ":00" read as a fault in the
                                              * table. Spelt out instead: "10 Oct 2026,
                                              * 09:00 AM", which is the wording the public
                                              * page uses, so the same event does not look
                                              * like two different things in two places.
                                              */}
                                            {e.startAt ? listWhen(e.startAt) : '—'}
                                        </td>
                                        <td className="py-4 pr-4 text-neutral-500 dark:text-neutral-400">
                                            {/*
                                              An online event reads as "Online", or
                                              "Online · Zoom" when the platform is
                                              known — never as its old venue, which is
                                              kept on the record but describes a room
                                              nobody is going to.
                                            */}
                                            {e.mode === 'online'
                                                ? `Online${e.onlinePlatform ? ` · ${e.onlinePlatform}` : ''}`
                                                : (e.location || '—')}
                                            {/*
                                              Who it reaches, under where it is held.
                                              An event aimed at one block is invisible
                                              to everyone else, and that is not
                                              something to have to open the form to
                                              find out.
                                            */}
                                            {/* A pill rather than a line of text: this is the
                                                column an administrator scans to answer "which
                                                of these went to Ariyalur", and a targeted
                                                event has to stand out from a national one. */}
                                            <span className={`inline-block text-[1.1875rem] mt-1 px-2 py-0.5 rounded-full ${
                                                e.targetLabel
                                                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                                                    : 'bg-slate-100 dark:bg-[#161616] text-neutral-500 dark:text-neutral-400'
                                            }`}>
                                                {e.targetLabel ? `${e.targetLabel} only` : 'Everyone'}
                                            </span>
                                        </td>
                                        <td className="py-4 pr-4">
                                            <span className={`text-[1.1875rem] px-2 py-0.5 rounded-full ${
                                                e.status === 'published'
                                                    ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400'
                                                    : 'bg-slate-100 dark:bg-[#161616] text-neutral-500 dark:text-neutral-400'
                                            }`}>
                                                {e.status}
                                            </span>
                                        </td>

                                        {/* A flex row with a real gap. The three
                                            controls were `mr-1`/`ml-1` siblings, so
                                            "Update copy" and "Delete" met with two
                                            pixels between them. */}
                                        <td className="py-4 text-right">
                                            <div className="flex flex-wrap items-center justify-end gap-2">
                                            {/* The same 36px box as the delete beside
                                                it, so the two icons line up. */}
                                            <button
                                                type="button"
                                                onClick={() => setQrFor({ event: e, justCreated: false })}
                                                title={`QR code for “${e.title || 'this event'}”`}
                                                aria-label={`QR code for ${e.title || 'this event'}`}
                                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg
                                                           border border-slate-300 text-neutral-500 transition-colors
                                                           hover:bg-slate-100 dark:border-[#2a2a2a]
                                                           dark:text-neutral-400 dark:hover:bg-[#161616]"
                                            >
                                                <QrCode className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => openEdit(e)}
                                                title={`Edit “${e.title || 'this event'}”`}
                                                aria-label={`Edit ${e.title || 'this event'}`}
                                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg
                                                           border border-slate-300 text-neutral-500 transition-colors
                                                           hover:bg-slate-100 dark:border-[#2a2a2a]
                                                           dark:text-neutral-400 dark:hover:bg-[#161616]"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            {/*
                                              AN ICON, as asked — the row already
                                              carries two worded buttons and a third
                                              made it unreadable.

                                              It keeps what the word was there for: a
                                              red bordered box it cannot be mistaken
                                              for the pencil in, a tooltip, and an
                                              `aria-label` naming the event — so a
                                              screen reader still hears "Delete
                                              <title>" rather than "button".
                                            */}
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(e)}
                                                title={`Delete “${e.title || 'this event'}”`}
                                                aria-label={`Delete ${e.title || 'this event'}`}
                                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg
                                                           border border-red-200 text-red-600 transition-colors
                                                           hover:bg-red-500/10 dark:border-red-500/30
                                                           dark:text-red-400"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    )}
                  </>
                )}
            </CmsCard>
            )}

            {qrFor && (
                <EventQrDialog
                    event={qrFor.event}
                    justCreated={qrFor.justCreated}
                    showOnPage={qrFor.event.showQrOnPage !== false}
                    onClose={() => setQrFor(null)}
                    onToggleShowOnPage={async (next) => {
                        try {
                            // Only this field: the server leaves every absent one untouched.
                            await updateCmsEvent(qrFor.event.id, { showQrOnPage: next });
                            setQrFor({ ...qrFor, event: { ...qrFor.event, showQrOnPage: next } });
                            cmsSaved(next ? 'QR shown on the event page' : 'QR hidden from the event page');
                            await load({ quiet: true });
                        } catch (err) {
                            cmsFailed('the QR setting', errorMessage(err, 'Could not save'));
                        }
                    }}
                />
            )}
        </CmsPage>
    );
}
