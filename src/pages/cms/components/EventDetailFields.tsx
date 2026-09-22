import { useMemo, useState } from 'react';
import { Plus, Trash2, Users, Clock, ChevronDown, ChevronUp, Loader2, User, MapPin, Video } from 'lucide-react';
// `RegistrationFormBuilder` itself is no longer rendered — the per-event
// question builder was removed from the form. The TYPE stays: every saved
// event still carries `registrationFields`, and dropping it from the shape
// would silently discard the questions those events already ask.
import { type RegistrationField } from './RegistrationFormBuilder';
import { CmsField, CmsInput, CmsTextarea, CmsSection, CmsChoice } from './CmsUI';
import { listEventRegistrations, type EventRegistration } from '@/services/memberHubApi';
import { errorMessage } from '@/services/activApi';
import type { CmsAgendaItem, CmsSpeaker } from '@/services/cmsApi';
import { uploadMedia } from '@/services/cmsApi';
import { resolveMediaUrl } from '@/config/api.config';

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
    /**
     * HOW you attend it — in a room, or on a link.
     *
     * A different question from `category`, which says WHAT kind of event it is
     * ("Workshops", "Conferences"). They are independent: there are online
     * workshops and offline workshops. Collapsing them is what put "ZOOM" and
     * "Webinars" into the category list beside "Tea party" — an editor with no
     * field for "this one is online" reached for the only list on the form.
     */
    mode: 'offline' | 'online';
    /** "Zoom", "Google Meet" — free text, like `category`. Online only. */
    onlinePlatform: string;
    /** The join link. Never public; see the model's note. Online only. */
    onlineUrl: string;
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
    /** Rupees, as typed. Blank and "0" both mean a free event. */
    registrationFee: string;
    /**
     * WHAT A MEMBER PAYS INSTEAD. Rupees, as typed.
     *
     * BLANK IS NOT ZERO HERE, and that is the whole reason this is a string
     * rather than a number. Blank means "no member rate — one price for
     * everybody"; a typed `0` means members attend free, which is a real and
     * deliberate offer. A numeric field could not tell the two apart, and
     * collapsing them would make an editor who typed nothing at all give the
     * entire association free seats.
     *
     * `''` is sent to the server as "clear it" and only a real number sets a
     * rate — see `sanitize` in `event.service.js`, which carries the same note
     * from the other side.
     */
    memberFee: string;
    registrationNote: string;
    /** The questions THIS event asks, on top of the four standing ones. */
    registrationFields: RegistrationField[];
    reminderOffsetsHours: number[];
}

export const BLANK_DETAIL: EventDetail = {
    audience: 'all',
    // Offline, because that is what the association mostly runs and what every
    // event written before this field existed actually was.
    mode: 'offline',
    onlinePlatform: '',
    onlineUrl: '',
    agenda: [],
    speakers: [],
    venueAddress: '',
    venueMapUrl: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    /*
     * NEW EVENTS ACCEPT REGISTRATIONS.
     *
     * This defaulted to `false`, which is the wrong way round for an
     * association: an event is posted so that members attend it, and one nobody
     * can register for is the exception rather than the rule. The whole
     * registration block — capacity, fee, deadline, the form builder — is hidden
     * behind this one tick, so an editor who never found it published seven
     * events in a row with no way to attend any of them and nothing on any
     * screen saying why. Measured against the live database: seven events, all
     * seven with registration off.
     *
     * Only the DEFAULT for a new event changes. Opening an existing event still
     * shows whatever it was saved with, and the tick still turns it off for the
     * events that genuinely are announcements.
     */
    registrationEnabled: true,
    registrationDeadline: '',
    capacity: '',
    registrationFee: '',
    // Blank: a new event charges one price until somebody sets a member rate.
    memberFee: '',
    registrationNote: '',
    registrationFields: [],
    reminderOffsetsHours: [],
};

/**
 * The saving, computed and said out loud under the member-price box.
 *
 * The single most valuable thing this form can print, because it is the answer
 * to the question the field is asking and the editor would otherwise work it
 * out on paper — and because the three ways of getting it wrong all look fine
 * in an empty input: a member price ABOVE the public one, a member price equal
 * to it, and a blank that the editor believes means free.
 *
 * Each of those gets its own sentence rather than a shared "check this value".
 * A warning that does not say what is wrong is a warning that gets dismissed.
 */
function MemberPriceHint({ price, member }: { price: string; member: string }) {
    const full = Math.max(0, Math.round(Number(price) || 0));
    // Blank is NOT zero — the one distinction this whole field turns on.
    const hasRate = String(member ?? '').trim() !== '';
    // `null` when there is no rate, and every branch below that reads it is
    // behind the `!hasRate` early return — so it is a plain number by then
    // without a `!` anywhere. See the field's own note on why blank is not zero.
    const rate = hasRate ? Math.max(0, Math.round(Number(member) || 0)) : 0;

    if (!hasRate) {
        return <>Leave blank and everyone pays the same. Fill it in and members with an
            active membership pay this instead — which is what makes joining worth it.</>;
    }

    if (full <= 0) {
        return <span className="text-amber-600 font-semibold">
            The event is free for everyone, so a member price changes nothing.
        </span>;
    }

    if (rate > full) {
        return <span className="text-rose-600 font-semibold">
            That is more than the price above. Members are never charged more than
            everybody else — this will be ignored and they will pay ₹{full.toLocaleString('en-IN')}.
        </span>;
    }

    if (rate === full) {
        return <span className="text-amber-600 font-semibold">
            The same as the price above, so members save nothing. Lower it to
            advertise a discount, or clear it to charge one price.
        </span>;
    }

    const saving = full - rate;
    return <span className="text-emerald-600 font-semibold">
        Members save ₹{saving.toLocaleString('en-IN')} ({Math.round((saving / full) * 100)}% off).
        Shown on the booking page beside the full price.
    </span>;
}

const BLANK_AGENDA: CmsAgendaItem = {
    startTime: '', endTime: '', title: '', description: '', speaker: '', location: '',
};

const BLANK_SPEAKER: CmsSpeaker = {
    name: '', role: '', organization: '', bio: '', photoUrl: '',
};

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

/**
 * One speaker's photograph: a round preview that IS the upload button.
 *
 * Uploaded rather than pasted as a URL, like every other image on this form -
 * asking for a URL would make this the one field that needs the editor to have
 * hosted the file somewhere else first.
 *
 * Its own component so the failure state (a rejected file, a dead connection)
 * belongs to the one row it happened on, rather than to a shared flag that
 * would show the error under every speaker at once.
 */
function SpeakerPhoto({ url, onChange }: { url: string; onChange: (url: string) => void }) {
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState('');

    const pick = async (file?: File | null) => {
        if (!file) return;
        setBusy(true);
        setFailed('');
        try {
            const { url: uploaded } = await uploadMedia(file);
            onChange(uploaded);
        } catch (error) {
            setFailed(errorMessage(error));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="shrink-0 w-20">
            <label className="block cursor-pointer">
                <span className="w-20 h-20 rounded-full overflow-hidden border border-slate-200
                                 dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#141414] flex items-center
                                 justify-center text-neutral-400 hover:border-blue-300 transition-colors">
                    {busy ? <Loader2 className="w-5 h-5 animate-spin" />
                        : url ? (
                            <img
                                src={resolveMediaUrl(url)}
                                alt=""
                                className="w-full h-full object-cover"
                            />
                        ) : <User className="w-6 h-6" />}
                </span>
                <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { pick(e.target.files && e.target.files[0]); e.target.value = ''; }}
                />
                <span className="mt-1.5 block text-center text-[1.0625rem] font-medium text-blue-600
                                 dark:text-blue-400">
                    {url ? 'Change' : 'Photo'}
                </span>
            </label>

            {url && (
                <button
                    type="button"
                    onClick={() => onChange('')}
                    className="mt-0.5 w-full text-center text-[1.0625rem] text-neutral-500 hover:text-red-500"
                >
                    Remove
                </button>
            )}
            {failed && <p className="mt-1 text-[1.0625rem] text-red-500 break-words">{failed}</p>}
        </div>
    );
}

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
    /*
     * OPEN BY DEFAULT.
     *
     * This panel holds the audience cards, the capacity, the fee and the
     * registration form builder — and it was collapsed, so an editor filling in
     * a new event saw a title, a date and a banner and reasonably concluded that
     * was the whole form. Reported as "I am not satisfied with the event fields"
     * and "customise fields should be there": they were there, behind a chevron
     * nothing drew the eye to.
     *
     * It still collapses, because an editor who only wants to fix a typo in the
     * title should be able to fold away four screens of programme detail. The
     * default is what changed, and it is the right way round: everything the
     * form can do is visible until someone chooses otherwise.
     */
    const [open, setOpen] = useState(true);
    const set = (patch: Partial<EventDetail>) => onChange({ ...value, ...patch });

    const updateAgenda = (index: number, patch: Partial<CmsAgendaItem>) => {
        const agenda = value.agenda.map((row, i) => (i === index ? { ...row, ...patch } : row));
        set({ agenda });
    };

    const updateSpeaker = (index: number, patch: Partial<CmsSpeaker>) => {
        const speakers = value.speakers.map((row, i) => (i === index ? { ...row, ...patch } : row));
        set({ speakers });
    };

    return (
        <div className="sm:col-span-2 border-t border-slate-200 dark:border-[#1f1f1f] pt-4">
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                className="w-full flex items-center justify-between gap-3 text-left"
            >
                <span className="min-w-0">
                    <span className="block text-[1.25rem] font-semibold text-slate-900 dark:text-neutral-100">
                        Programme, speakers and registration
                    </span>
                    <span className="block text-[1.1875rem] text-neutral-500 dark:text-neutral-400 mt-0.5">
                        {summarise(value)}
                    </span>
                </span>
                {open
                    ? <ChevronUp className="w-4 h-4 text-neutral-500 shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-neutral-500 shrink-0" />}
            </button>

            {open ? (
                <div className="mt-4 space-y-0">
                    {/*
                      * THE "EVERYONE / MEMBERS ONLY" CHOICE IS GONE FROM THE FORM.
                      *
                      * Who receives an event is decided by the regions above and
                      * by the onboarding tick beside them; a third audience
                      * control asked a fourth time and was the one editors read
                      * as contradicting the others.
                      *
                      * `audience` REMAINS on the schema and on every saved event
                      * — `event.service.listEvents` still withholds a `paid`
                      * event from members without an active membership, and any
                      * event already set that way still behaves that way. Only
                      * the control is gone.
                      */}

                    {/* ---------------------------------------------- agenda */}
                    <CmsSection
                        title="Agenda"

                        actions={
                            <button
                                type="button"
                                onClick={() => set({ agenda: [...value.agenda, { ...BLANK_AGENDA }] })}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[1.1875rem]
                                           font-medium text-blue-600 dark:text-blue-400 border
                                           border-blue-200 dark:border-blue-500/30 hover:bg-blue-500/10"
                            >
                                <Plus className="w-3.5 h-3.5" /> Add session
                            </button>
                        }
                    >
                        {value.agenda.length === 0 ? (
                            <p className="text-[1.25rem] text-neutral-500 dark:text-neutral-400">
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
                                                {/*
                                                  * "Room / hall" and "Notes"
                                                  * removed.
                                                  *
                                                  * An agenda line is a time, a
                                                  * title and who is speaking.
                                                  * The other two turned every
                                                  * row into a four-field form
                                                  * and were, on the events in
                                                  * this database, never filled
                                                  * in. The FIELDS stay on the
                                                  * schema — a session that
                                                  * already carries a room or a
                                                  * note still shows it on the
                                                  * event page.
                                                  */}
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

                    {/* -------------------------------------------- speakers */}
                    {/*
                      * WHO IS SPEAKING - name, designation, organisation, photo.
                      *
                      * Not a duplicate of the name on an agenda line. That line
                      * says who is taking a session; this is the person, with
                      * the photograph and the designation the event page prints
                      * on their card. An agenda entry cannot carry either, and
                      * these are the fields the association specified.
                      *
                      * Nothing here is required. A speaker announced before
                      * their designation is confirmed is a normal state, and
                      * the event page prints whichever parts exist.
                      */}
                    <CmsSection
                        title="Speakers"
                        hint="Shown as cards on the event page. Add as many as you need."
                        actions={
                            <button
                                type="button"
                                onClick={() => set({ speakers: [...value.speakers, { ...BLANK_SPEAKER }] })}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[1.1875rem]
                                           font-medium text-blue-600 dark:text-blue-400 border
                                           border-blue-200 dark:border-blue-500/30 hover:bg-blue-500/10"
                            >
                                <Plus className="w-3.5 h-3.5" /> Add speaker
                            </button>
                        }
                    >
                        {value.speakers.length === 0 ? (
                            <p className="text-[1.25rem] text-neutral-500 dark:text-neutral-400">
                                No speakers yet. The event page simply leaves the section out.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {value.speakers.map((row, index) => (
                                    <div
                                        key={index}
                                        className="rounded-lg border border-slate-200 dark:border-[#2a2a2a] p-3"
                                    >
                                        <div className="flex items-start gap-3">
                                            <SpeakerPhoto
                                                url={row.photoUrl}
                                                onChange={(photoUrl) => updateSpeaker(index, { photoUrl })}
                                            />

                                            <div className="grid gap-3 sm:grid-cols-2 flex-1 min-w-0">
                                                <CmsField label="Name">
                                                    <CmsInput
                                                        value={row.name}
                                                        placeholder="As it should be printed"
                                                        onChange={(e) => updateSpeaker(index, { name: e.target.value })}
                                                    />
                                                </CmsField>
                                                <CmsField label="Designation">
                                                    <CmsInput
                                                        value={row.role}
                                                        placeholder="Managing Director"
                                                        onChange={(e) => updateSpeaker(index, { role: e.target.value })}
                                                    />
                                                </CmsField>
                                                <div className="sm:col-span-2">
                                                    <CmsField label="Organisation">
                                                        <CmsInput
                                                            value={row.organization}
                                                            placeholder="Company or department"
                                                            onChange={(e) => updateSpeaker(index, { organization: e.target.value })}
                                                        />
                                                    </CmsField>
                                                </div>
                                                <div className="sm:col-span-2">
                                                    <CmsField label="Short bio">
                                                        <CmsInput
                                                            value={row.bio}
                                                            placeholder="One line, optional"
                                                            onChange={(e) => updateSpeaker(index, { bio: e.target.value })}
                                                        />
                                                    </CmsField>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                aria-label="Remove speaker"
                                                onClick={() => set({
                                                    speakers: value.speakers.filter((_, i) => i !== index),
                                                })}
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

                    {/* --------------------------------------------- contact
                      *
                      * "Where it happens" — the In person / Online choice and
                      * the venue or joining fields that follow from it — is NOT
                      * here any more. It sits beside Category on the basics
                      * form, because it is decided at the same moment as the
                      * date and the kind of event, and burying it four screens
                      * down inside a panel headed "Programme, speakers and
                      * registration" meant an editor creating an event never
                      * met it. Reported as exactly that.
                      */}
                    <CmsSection title="Contact">
                        <div className="grid gap-4 sm:grid-cols-2">
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
                    >
                        <label className="flex items-center gap-2.5 mb-4 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={value.registrationEnabled}
                                onChange={(e) => set({ registrationEnabled: e.target.checked })}
                                className="w-4 h-4 rounded border-slate-300 text-blue-600"
                            />
                            <span className="text-[1.25rem] text-slate-800 dark:text-neutral-200">
                                Members can register for this event
                            </span>
                        </label>

                        {value.registrationEnabled ? (
                            <div className="grid gap-4 sm:grid-cols-2">
                                <CmsField
                                    label="Capacity"
                                >
                                    <CmsInput
                                        type="number"
                                        min={0}
                                        value={value.capacity}
                                        onChange={(e) => set({ capacity: e.target.value })}
                                    />
                                </CmsField>

                                {/*
                                  * The fee, beside the capacity it interacts with.
                                  *
                                  * A priced event takes registration in two steps:
                                  * the seat is held, then paid for. A waitlisted
                                  * member is never charged — there is no seat yet
                                  * to charge for — which is decided on the server,
                                  * not here.
                                  */}
                                <CmsField
                                    label="Price (₹)"
                                >
                                    <CmsInput
                                        type="number"
                                        min={0}
                                        step={1}
                                        placeholder="0"
                                        value={value.registrationFee}
                                        onChange={(e) => set({ registrationFee: e.target.value })}
                                    />
                                </CmsField>

                                {/*
                                  * THE MEMBERSHIP DISCOUNT, TYPED AS A PRICE.
                                  *
                                  * "Discount: 1000" against "Price: 1000" reads
                                  * two ways — free for members, or no discount at
                                  * all — and the two readings differ by the whole
                                  * ticket. A price has one reading, so the editor
                                  * types what will be charged and the line beneath
                                  * computes the saving. Nobody has to hold the
                                  * distinction in their head, and nothing that
                                  * charges money has to guess.
                                  *
                                  * BLANK AND ZERO ARE DIFFERENT ANSWERS. See the
                                  * note on the field's type.
                                  */}
                                <CmsField
                                    label="Member price (₹)"
                                    hint={<MemberPriceHint
                                        price={value.registrationFee}
                                        member={value.memberFee}
                                    />}
                                >
                                    <CmsInput
                                        type="number"
                                        min={0}
                                        step={1}
                                        placeholder="Same as the price above"
                                        value={value.memberFee}
                                        onChange={(e) => set({ memberFee: e.target.value })}
                                    />
                                </CmsField>

                                <CmsField
                                    label="Registration closes"
                                >
                                    {/*
                                      * A DATE, not a date AND a time.
                                      *
                                      * `datetime-local` puts six fields in one
                                      * box — day, month, year, hour, minute,
                                      * meridiem — to answer a question nobody
                                      * has ever answered to the minute. The
                                      * stored value keeps its time component:
                                      * a date alone is normalised to the end of
                                      * that day on save, so "closes on the 17th"
                                      * means the whole of the 17th rather than
                                      * midnight at the start of it.
                                      */}
                                    <CmsInput
                                        type="date"
                                        value={(value.registrationDeadline || '').slice(0, 10)}
                                        onChange={(e) => set({
                                            registrationDeadline: e.target.value
                                                ? `${e.target.value}T23:59`
                                                : '',
                                        })}
                                    />
                                </CmsField>

                            </div>
                        ) : (
                            /*
                             * SAY WHAT IS BEHIND THE TICK.
                             *
                             * This branch rendered `null`, so an editor opening
                             * an event with registration switched off saw one
                             * lonely checkbox and no price, no seat count and no
                             * member rate anywhere on the form — which reads as
                             * "those fields do not exist" rather than as "this
                             * event is an announcement". It was reported exactly
                             * that way.
                             *
                             * Naming the hidden fields costs one line and turns a
                             * missing-feature bug report into a tick.
                             */
                            <p className="text-[1.25rem] text-slate-500 dark:text-[#A1A1AA] leading-relaxed">
                                This event is an announcement — nobody can book a seat on it.
                                Tick the box above to set the{' '}
                                <strong className="font-semibold text-slate-700 dark:text-neutral-300">
                                    number of seats, the price, the member price
                                </strong>{' '}
                                and the registration form.
                            </p>
                        )}

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
        // The member rate belongs on the summary too: an event carrying one and
        // not showing it makes the editor open the form to find out whether
        // they ever set it.
        if (String(detail.memberFee ?? '').trim() !== ''
            && Number(detail.memberFee) < Number(detail.registrationFee)) {
            parts.push(`members ₹${Number(detail.memberFee).toLocaleString('en-IN')}`);
        }
    }

    return parts.join(' · ');
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

    /**
     * One column per question anyone has actually answered.
     *
     * Derived from the ANSWERS, not from the event's current form. The organiser
     * can add, rename or delete a question after people have registered, and
     * every one of those cases breaks a table whose headings come from the live
     * form: a deleted question silently drops a column of real data, and a
     * renamed one relabels answers that were given under the old wording.
     *
     * Each answer carries the label it was captured under (see `responses` in
     * the registration model), so the first row to mention a key names the
     * column — and a question renamed halfway through keeps both spellings
     * visible rather than pretending everyone answered the new one.
     */
    const answerColumns = useMemo(() => {
        const seen = new Map<string, string>();

        (rows || []).forEach((row) => {
            (row.responses || []).forEach((answer) => {
                if (answer.key && !seen.has(answer.key)) seen.set(answer.key, answer.label || answer.key);
            });
        });

        return [...seen].map(([key, label]) => ({ key, label }));
    }, [rows]);
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
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[1.1875rem] font-medium
                               text-slate-700 dark:text-neutral-200 border border-slate-200
                               dark:border-[#2a2a2a] hover:bg-slate-100 dark:hover:bg-[#161616]
                               disabled:opacity-60"
                >
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                    Show who has registered
                </button>
            ) : (
                <>
                    <p className="text-[1.1875rem] text-neutral-500 dark:text-neutral-400 mb-3">
                        {counts.registered || 0} registered
                        {counts.waitlist ? ` · ${counts.waitlist} waiting` : ''}
                        {counts.cancelled ? ` · ${counts.cancelled} cancelled` : ''}
                    </p>

                    {rows.length === 0 ? (
                        <p className="text-[1.25rem] text-neutral-500 dark:text-neutral-400">Nobody yet.</p>
                    ) : (
                        <div className="max-h-72 overflow-y-auto">
                            <table className="w-full text-[1.1875rem]">
                                <thead>
                                    <tr className="text-left text-neutral-500 border-b border-slate-200 dark:border-[#1f1f1f]">
                                        <th className="pb-2 pr-3 font-medium">Name</th>
                                        <th className="pb-2 pr-3 font-medium">Phone</th>
                                        <th className="pb-2 pr-3 font-medium">Region</th>
                                        {/*
                                          One column per question, from the
                                          ANSWERS rather than from the current
                                          form. The organiser can delete a
                                          question after people have answered it,
                                          and those answers still have to appear
                                          — reading the headings from the live
                                          form would silently drop a column of
                                          data that exists.
                                        */}
                                        {answerColumns.map((column) => (
                                            <th key={column.key} className="pb-2 pr-3 font-medium">
                                                {column.label}
                                            </th>
                                        ))}
                                        <th className="pb-2 pr-3 font-medium">Paid</th>
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

                                            {answerColumns.map((column) => (
                                                <td key={column.key} className="py-2 pr-3 text-neutral-500">
                                                    {(row.responses || [])
                                                        .find((r) => r.key === column.key)?.value || '—'}
                                                </td>
                                            ))}

                                            {/*
                                              A seat can be held and unpaid, and
                                              on the day that is the difference
                                              between letting someone in and not.
                                            */}
                                            <td className="py-2 pr-3">
                                                {row.payment?.status === 'paid' ? (
                                                    <span className="text-emerald-600 font-medium">
                                                        ₹{row.payment.amount}
                                                    </span>
                                                ) : row.payment?.status === 'pending' ? (
                                                    <span className="text-amber-600 font-medium">Unpaid</span>
                                                ) : (
                                                    <span className="text-neutral-400">Free</span>
                                                )}
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

            {error ? <p className="text-[1.1875rem] text-red-500 mt-2">{error}</p> : null}
        </div>
    );
}
