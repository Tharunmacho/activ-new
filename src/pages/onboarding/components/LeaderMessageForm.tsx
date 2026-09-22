import { useEffect, useState } from 'react';
import { Check, Loader2, MessageSquare, Phone, ShieldCheck } from 'lucide-react';
import { errorMessage } from '@/services/cmsApi';
import {
    getLeaderMessagePurposes, sendLeaderMessage,
    type LeaderContext, type LeaderMessagePurpose,
} from '@/services/cmsLeaderMessagesApi';
import type { RegionLeader } from '@/services/cmsRegionsApi';

/**
 * ============================================================================
 * ASKING TO BE PUT IN TOUCH WITH AN OFFICE-BEARER
 * ============================================================================
 *
 * The association's ask: a member in Tiruvannamalai opens their district's
 * leaders, picks one, and asks to be contacted. The super admin sees who wrote
 * and whom they were reading about, and takes that district's schemes and
 * events to them personally.
 *
 * ---------------------------------------------------------------------------
 * WHY THERE IS NO MESSAGE BOX
 * ---------------------------------------------------------------------------
 *
 * This form has a purpose, a name and a telephone number, and no field that
 * reaches the stored message. The SERVER composes the sentence from the
 * purpose — see `cms.leaderMessages.service`.
 *
 * That is not a simplification, it is the requirement. An open box addressed to
 * a named state chairman collects "hi", "bye" and worse, and every one of those
 * is a real person's enquiry an administrator has to open to discover is not
 * one. A fixed purpose makes every message in the inbox actionable, and it
 * makes the telephone number the thing being collected — which is what the
 * association actually replies to.
 *
 * `note` is the single free field: one or two lines, capped by the server,
 * and stored apart from the composed message so anybody reading it knows it
 * is the visitor's own typing.
 *
 * ONE OPTION MAKES IT THE MESSAGE. “Something else — I will write it” is
 * last in the list, is never the default, and is the only purpose whose
 * composed sentence quotes the box. Five fixed reasons cannot be complete,
 * and a visitor whose reason is not among them picking the nearest wrong one
 * puts a mislabelled enquiry in the inbox — which is worse than their own
 * sentence, honestly quoted. The box is REQUIRED for that option, because
 * “something else” with nothing after it is the empty enquiry the fixed list
 * exists to prevent.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE VISITOR IS PROMISED
 * ---------------------------------------------------------------------------
 *
 * That somebody will ring the number they gave. Nothing here reaches the
 * leader's own mailbox, and the form says so rather than implying a private
 * channel to a named person that does not exist. Anybody who wants to write
 * directly still has that leader's email and telephone on the panel above.
 */

type Sent = { purposeLabel: string } | null;

export function LeaderMessageForm({ person, context, onDone }: {
    person: RegionLeader;
    context: LeaderContext;
    /** Called after a successful send, once the visitor dismisses the receipt. */
    onDone?: () => void;
}) {
    const [purposes, setPurposes] = useState<LeaderMessagePurpose[]>([]);
    const [purpose, setPurpose] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [organisation, setOrganisation] = useState('');
    const [note, setNote] = useState('');

    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [sent, setSent] = useState<Sent>(null);

    useEffect(() => {
        let cancelled = false;
        getLeaderMessagePurposes().then((rows) => {
            if (cancelled) return;
            setPurposes(rows || []);
            // The first is the callback, which is the common case and the one
            // the association's standard reply is written for.
            if ((rows || []).length) setPurpose((p) => p || rows[0].key);
        });
        return () => { cancelled = true; };
    }, []);

    /*
     * Is the box the MESSAGE, or an afterthought?
     *
     * Read off the chosen option rather than hardcoded against the key:
     * the list is the server's, and a second copy of which entry is the
     * free one is a copy that goes stale the moment the list changes.
     */
    const writesOwn = purposes.some(
        (p) => p.key === purpose && p.requiresNote === true,
    );

    const submit = async () => {
        setError('');

        if (!name.trim()) { setError('Please give your name.'); return; }
        if (!phone.trim()) { setError('Please give a telephone number we can call you on.'); return; }
        /* Checked here as well as on the server, so the visitor is told
           before their typing makes a round trip and comes back rejected. */
        if (writesOwn && !note.trim()) {
            setError('Please say in a line or two what it is about.');
            return;
        }

        setSending(true);
        try {
            const result = await sendLeaderMessage({
                leader: {
                    id: person.id,
                    name: person.name,
                    role: person.role,
                    designation: person.designation,
                    organisation: person.organisation,
                },
                context,
                // Where they were reading, so a reply can start where they were.
                pagePath: typeof window !== 'undefined' ? window.location.pathname : '',
                sender: {
                    name: name.trim(),
                    phone: phone.trim(),
                    email: email.trim(),
                    organisation: organisation.trim(),
                    // Their own district if they gave one, otherwise the district
                    // whose page they are standing on — which is the case the
                    // association described.
                    district: context.district || '',
                },
                purpose,
                note: note.trim(),
            });
            setSent({ purposeLabel: result.purposeLabel || '' });
        } catch (err) {
            setError(errorMessage(err, 'Could not send that just now. Please try again.'));
        } finally {
            setSending(false);
        }
    };

    /* ------------------------------------------------------------ the receipt */

    if (sent) {
        return (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 text-left">
                <p className="flex items-center gap-2 text-[1.1875rem] font-extrabold text-emerald-800">
                    <Check size={18} className="shrink-0" /> Recorded
                </p>
                <p className="mt-2 text-[1.0625rem] font-medium leading-relaxed text-emerald-900/80">
                    Your request has been passed to the association, who will be in touch on{' '}
                    <span className="font-bold">{phone.trim()}</span>.
                    {sent.purposeLabel && (
                        <> It was recorded as <span className="font-bold">{sent.purposeLabel.toLowerCase()}</span>.</>
                    )}
                </p>
                <button
                    type="button"
                    onClick={onDone}
                    className="mt-4 inline-flex items-center rounded-full border border-emerald-300
                               bg-white px-5 py-2 text-[1.0625rem] font-bold text-emerald-800
                               transition-colors hover:bg-emerald-50"
                >
                    Close
                </button>
            </div>
        );
    }

    /* --------------------------------------------------------------- the form */

    const field = 'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-[1.0625rem] '
        + 'font-medium text-brand-800 outline-none transition-colors placeholder:text-gray-400 '
        + 'hover:border-brand-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15';

    return (
        <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50/70 p-5 text-left">
            <p className="flex items-center gap-2 text-[1.1875rem] font-extrabold text-brand-900">
                <MessageSquare size={17} className="shrink-0 text-brand-600" />
                Ask to be contacted
            </p>

            {/*
              * Said plainly, because the alternative is implied.
              *
              * A "Message" button under a named person's photograph reads as a
              * private line to them. It is not one — the association holds
              * these and decides what is passed on — and a visitor who learns
              * that after writing has been misled by the button.
              */}
            <p className="mt-1.5 text-[1rem] font-medium leading-relaxed text-gray-500">
                This goes to the ACTIV office, not to {person.name || 'this office-bearer'}'s
                own inbox. They will pass it on and somebody will ring you.
            </p>

            {/* ---- what they want ---- */}
            <fieldset className="mt-4">
                <legend className="mb-2 text-[1rem] font-bold uppercase tracking-wider text-gray-500">
                    What is it about?
                </legend>

                <div className="space-y-2">
                    {purposes.map((p) => (
                        <label
                            key={p.key}
                            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3
                                        transition-colors ${purpose === p.key
                                    ? 'border-brand-600 bg-white ring-2 ring-brand-600/15'
                                    : 'border-gray-200 bg-white hover:border-brand-300'}`}
                        >
                            <input
                                type="radio"
                                name="leader-message-purpose"
                                value={p.key}
                                checked={purpose === p.key}
                                onChange={() => setPurpose(p.key)}
                                className="mt-1 shrink-0 accent-brand-600"
                            />
                            <span className="min-w-0">
                                <span className="block text-[1.0625rem] font-bold text-brand-800">
                                    {p.label}
                                </span>
                                {p.hint && (
                                    <span className="block text-[1rem] font-medium text-gray-500">
                                        {p.hint}
                                    </span>
                                )}
                            </span>
                        </label>
                    ))}

                    {purposes.length === 0 && (
                        <p className="text-[1.0625rem] font-medium text-gray-400">
                            Loading the options…
                        </p>
                    )}
                </div>
            </fieldset>

            {/* ---- who they are ---- */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block">
                    <span className="mb-1 block text-[1rem] font-bold text-gray-600">Your name</span>
                    <input
                        className={field}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Full name"
                        autoComplete="name"
                    />
                </label>

                <label className="block">
                    <span className="mb-1 flex items-center gap-1.5 text-[1rem] font-bold text-gray-600">
                        <Phone size={13} className="text-brand-500" /> Telephone
                    </span>
                    <input
                        className={field}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 …"
                        inputMode="tel"
                        autoComplete="tel"
                    />
                </label>

                <label className="block">
                    <span className="mb-1 block text-[1rem] font-bold text-gray-600">
                        Email <span className="font-medium text-gray-400">(optional)</span>
                    </span>
                    <input
                        className={field}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        inputMode="email"
                        autoComplete="email"
                    />
                </label>

                <label className="block">
                    <span className="mb-1 block text-[1rem] font-bold text-gray-600">
                        Your firm <span className="font-medium text-gray-400">(optional)</span>
                    </span>
                    <input
                        className={field}
                        value={organisation}
                        onChange={(e) => setOrganisation(e.target.value)}
                        placeholder="Company or trade"
                    />
                </label>
            </div>

            {/*
              The one free field — and the MESSAGE itself when the visitor
              picked “something else”. Its label, its placeholder and whether
              it is optional all follow that, because a box that is doing a
              different job should not be captioned the same way.
            */}
            <label className="mt-3 block">
                <span className="mb-1 block text-[1rem] font-bold text-gray-600">
                    {writesOwn ? 'What is it about?' : 'Anything else we should know'}{' '}
                    {writesOwn
                        ? <span className="font-medium text-brand-600">(required)</span>
                        : <span className="font-medium text-gray-400">(optional)</span>}
                </span>
                <textarea
                    className={`${field} resize-y`}
                    rows={writesOwn ? 4 : 2}
                    maxLength={300}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={writesOwn
                        ? 'Tell us in a line or two what you would like to discuss'
                        : 'One or two lines'}
                />
                {writesOwn && (
                    <span className="mt-1 block text-[1rem] text-gray-500">
                        This is passed on in your own words, with your number.
                        {' '}{300 - note.length} characters left.
                    </span>
                )}
            </label>

            {error && (
                <p className="mt-3 text-[1.0625rem] font-semibold text-red-600">{error}</p>
            )}

            <button
                type="button"
                onClick={submit}
                disabled={sending}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full
                           bg-brand-600 px-6 py-3 text-[1.125rem] font-bold text-white
                           transition-colors hover:bg-brand-700 disabled:opacity-60"
            >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <MessageSquare size={16} />}
                {sending ? 'Sending…' : 'Send this request'}
            </button>

            <p className="mt-3 flex items-start gap-1.5 text-[1rem] font-medium leading-relaxed text-gray-400">
                <ShieldCheck size={13} className="mt-0.5 shrink-0" />
                Your number is shown only to the ACTIV office and to the office-bearer
                it is about.
            </p>
        </div>
    );
}
