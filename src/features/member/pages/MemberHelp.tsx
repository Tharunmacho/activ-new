import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
    LifeBuoy, Mail, Phone, Clock, MapPin, Send, ChevronRight, ChevronDown,
    ClipboardList, CreditCard, CalendarDays, UserCog,
} from 'lucide-react';
import MemberPageShell from '@/pages/member/MemberPageShell';
import { SectionCard } from '@/features/member/components/MemberUI';
import { getContactInfo, sendContactMessage } from '@/services/cmsApi';
import { getMyProfile, getMyApplication, errorMessage } from '@/services/activApi';
import { formatApplicationRef } from '@/features/member/memberAccess';

/**
 * Help & Support, inside the member area.
 *
 * The rail used to list this as an upcoming feature with no screen, and its
 * only real alternative was `/contact` — a marketing page carrying the public
 * header, the onboarding navigation and a "Register" call to action aimed at
 * someone who does not have an account. Sending a signed-in member there drops
 * them out of the member area to be invited to sign up again.
 *
 * This is not member-to-member messaging and is not gated by it. Writing to the
 * association's own support team is something an applicant needs MORE than a
 * paid member does — they are the ones with a question about an application in
 * review — and it goes to the same `/cms/contact-messages` inbox the public
 * form does, so the team reads one queue rather than two.
 *
 * The message carries the member's application reference automatically. A
 * support request that does not say which application it is about costs one
 * round trip before anything can be looked at.
 */

const FAQ = [
    {
        icon: ClipboardList,
        question: 'How long does the review take?',
        answer:
            'Your application passes through three reviews — Block, then District, then State. '
            + 'Each one is carried out by the admin for your own region, and the Application '
            + 'Status screen shows exactly which stage your file is at and when each approval '
            + 'was recorded.',
    },
    {
        icon: CreditCard,
        question: 'When do I pay, and what does it unlock?',
        answer:
            'Payment opens once the State Admin has approved your application — not before. '
            + 'Activating unlocks direct messages and member connections, members-only notices, '
            + 'and your membership and tax exemption certificates.',
    },
    {
        icon: CalendarDays,
        question: 'Can I attend events before my membership is active?',
        answer:
            'Yes. The events programme is open to you now and you can register for a seat from '
            + 'any event page. Events the association marks as members-only are the exception, '
            + 'and those appear once your membership is active.',
    },
    {
        icon: UserCog,
        question: 'Can I still change my details?',
        answer:
            'Your contact details can be updated at any time from Settings. The four application '
            + 'forms lock when you submit them, so a correction to those needs the review team — '
            + 'send the change below with your application reference and they will action it.',
    },
];

export default function MemberHelp() {
    const [contact, setContact] = useState<any>(null);
    const [application, setApplication] = useState<any>(null);
    const [open, setOpen] = useState<string>('');

    const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
    const [sending, setSending] = useState(false);

    useEffect(() => {
        let cancelled = false;

        Promise.allSettled([getContactInfo(), getMyProfile(), getMyApplication()])
            .then(([info, profile, app]) => {
                if (cancelled) return;

                if (info.status === 'fulfilled') setContact(info.value);
                if (app.status === 'fulfilled') setApplication(app.value);

                /*
                 * The form starts filled in.
                 *
                 * The association already knows who this is — they are signed
                 * in. Asking a member to retype their own name and email before
                 * they can ask a question is friction with nothing behind it,
                 * and a mistyped address is a reply that never arrives.
                 */
                if (profile.status === 'fulfilled' && profile.value) {
                    const me: any = profile.value;
                    setForm((current) => ({
                        ...current,
                        name: current.name || me.fullName || '',
                        email: current.email || me.email || '',
                        phone: current.phone || me.phoneNumber || me.phone || '',
                    }));
                }
            });

        return () => { cancelled = true; };
    }, []);

    const appRef = useMemo(() => formatApplicationRef(application), [application]);

    const hours = (contact?.workingHours || []).filter(Boolean) as string[];
    const address = (contact?.addressLines || []).filter(Boolean) as string[];
    const email = contact?.email || '';
    const phone = contact?.phone || '';

    const set = (key: keyof typeof form) => (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => setForm((current) => ({ ...current, [key]: e.target.value }));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();

        const name = (form.name || '').trim();
        const mail = (form.email || '').trim();
        const message = (form.message || '').trim();

        if (!name || !mail || !message) {
            toast.error('Your name, email and a message are needed');
            return;
        }

        setSending(true);
        try {
            await sendContactMessage({
                name,
                email: mail,
                phone: (form.phone || '').trim(),
                // The reference goes in the subject so the team can find the
                // application without asking for it.
                subject: [(form.subject || '').trim() || 'Member support request',
                    appRef.full ? `(Application ${appRef.full})` : ''].filter(Boolean).join(' '),
                message,
            });

            toast.success('Your message has been sent. The team will be in touch.');
            setForm((current) => ({ ...current, subject: '', message: '' }));
        } catch (err) {
            toast.error(errorMessage(err, 'Your message could not be sent'));
        } finally {
            setSending(false);
        }
    };

    return (
        <MemberPageShell title="Help & Support" subtitle="Questions about your membership" width="standard">
            <div className="grid gap-5 lg:grid-cols-12 items-start">
                {/* ---------------------------------------------- ask ---------- */}
                <div className="lg:col-span-7 space-y-5">
                    <SectionCard
                        title="Send us a message"
                        subtitle={appRef.full
                            ? `Sent with your application reference ${appRef.full}`
                            : 'The support team reads every message'}
                        icon={<Send className="w-5 h-5" />}
                    >
                        <form onSubmit={submit} className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field label="Your name" required>
                                    <input
                                        value={form.name}
                                        onChange={set('name')}
                                        className={INPUT}
                                        placeholder="Full name"
                                    />
                                </Field>
                                <Field label="Email" required>
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={set('email')}
                                        className={INPUT}
                                        placeholder="you@example.com"
                                    />
                                </Field>
                                <Field label="Phone">
                                    <input
                                        value={form.phone}
                                        onChange={set('phone')}
                                        className={INPUT}
                                        placeholder="Optional"
                                    />
                                </Field>
                                <Field label="Subject">
                                    <input
                                        value={form.subject}
                                        onChange={set('subject')}
                                        className={INPUT}
                                        placeholder="What is this about?"
                                    />
                                </Field>
                            </div>

                            <Field label="Message" required>
                                <textarea
                                    value={form.message}
                                    onChange={set('message')}
                                    rows={5}
                                    className={`${INPUT} resize-y`}
                                    placeholder="Tell us what you need help with"
                                />
                            </Field>

                            <button
                                type="submit"
                                disabled={sending}
                                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700
                                           disabled:opacity-60 text-white text-[1.1875rem] font-bold px-5 py-2.5
                                           rounded-xl shadow-sm transition-colors"
                            >
                                {sending ? 'Sending…' : 'Send message'}
                                <Send className="w-4 h-4" />
                            </button>
                        </form>
                    </SectionCard>

                    {/* ---------------------------------------------- faq ------ */}
                    <SectionCard
                        title="Common questions"
                        subtitle="The four things support is asked most"
                        icon={<LifeBuoy className="w-5 h-5" />}
                    >
                        <ul className="divide-y divide-slate-100 -my-1">
                            {FAQ.map(({ icon: Icon, question, answer }) => {
                                const expanded = open === question;

                                return (
                                    <li key={question} className="py-1">
                                        <button
                                            type="button"
                                            onClick={() => setOpen(expanded ? '' : question)}
                                            aria-expanded={expanded}
                                            className="w-full flex items-start gap-3 py-3 text-left"
                                        >
                                            <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600
                                                             flex items-center justify-center shrink-0">
                                                <Icon className="w-4 h-4" />
                                            </span>
                                            <span className="min-w-0 flex-1 text-[1.1875rem] font-semibold
                                                             text-slate-900 pt-1.5">
                                                {question}
                                            </span>
                                            <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 mt-2
                                                                     transition-transform ${
                                                expanded ? 'rotate-180' : ''
                                            }`} />
                                        </button>

                                        {expanded ? (
                                            <p className="text-[1rem] text-slate-600 leading-relaxed
                                                          pl-12 pr-2 pb-4">
                                                {answer}
                                            </p>
                                        ) : null}
                                    </li>
                                );
                            })}
                        </ul>
                    </SectionCard>
                </div>

                {/* ---------------------------------------------- reach --------- */}
                <div className="lg:col-span-5 space-y-5">
                    <SectionCard
                        title="Contact the association"
                        subtitle="The same details as the public office"
                        icon={<LifeBuoy className="w-5 h-5" />}
                    >
                        {/*
                          * Each row is omitted when the CMS has not been given
                          * that value. A phone number that does not answer is
                          * worse than no phone number.
                          */}
                        <ul className="space-y-4">
                            {hours.length > 0 ? (
                                <Detail icon={<Clock className="w-4 h-4" />} label="Working hours">
                                    {hours.map((line) => <span key={line} className="block">{line}</span>)}
                                </Detail>
                            ) : null}

                            {email ? (
                                <Detail icon={<Mail className="w-4 h-4" />} label="Email">
                                    <a href={`mailto:${email}`} className="text-blue-600 hover:underline break-all">
                                        {email}
                                    </a>
                                </Detail>
                            ) : null}

                            {phone ? (
                                <Detail icon={<Phone className="w-4 h-4" />} label="Phone">
                                    <a href={`tel:${phone}`} className="text-blue-600 hover:underline">
                                        {phone}
                                    </a>
                                </Detail>
                            ) : null}

                            {address.length > 0 ? (
                                <Detail icon={<MapPin className="w-4 h-4" />} label="Office">
                                    {address.map((line) => <span key={line} className="block">{line}</span>)}
                                </Detail>
                            ) : null}

                            {hours.length === 0 && !email && !phone && address.length === 0 ? (
                                <li className="text-[1rem] text-slate-500">
                                    Send a message using the form and the team will get back to you.
                                </li>
                            ) : null}
                        </ul>
                    </SectionCard>

                    <SectionCard title="Where to look first" icon={<ClipboardList className="w-5 h-5" />}>
                        <ul className="space-y-2">
                            {[
                                { label: 'Application status and timeline', to: '/member/application-status' },
                                { label: 'Your documents and certificates', to: '/member/documents' },
                                { label: 'Events programme', to: '/member/events' },
                                { label: 'Account settings', to: '/member/settings' },
                            ].map(({ label, to }) => (
                                <li key={to}>
                                    <Link
                                        to={to}
                                        className="flex items-center justify-between gap-3 p-3 rounded-xl
                                                   border border-slate-200 hover:border-blue-400 hover:bg-blue-50
                                                   transition-colors text-[1rem] font-semibold text-slate-800"
                                    >
                                        {label}
                                        <ChevronRight className="w-4 h-4 text-blue-500 shrink-0" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </SectionCard>
                </div>
            </div>
        </MemberPageShell>
    );
}

const INPUT =
    'w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-[1.1875rem] text-slate-900 '
    + 'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

function Field({
    label,
    required = false,
    children,
}: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    return (
        <label className="block">
            <span className="block text-[0.8125rem] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                {label}{required ? <span className="text-red-500"> *</span> : null}
            </span>
            {children}
        </label>
    );
}

function Detail({
    icon,
    label,
    children,
}: {
    icon: React.ReactNode;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <li className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center
                             justify-center shrink-0">
                {icon}
            </span>
            <span className="min-w-0">
                <span className="block text-[0.8125rem] font-bold uppercase tracking-wide text-slate-500">
                    {label}
                </span>
                <span className="block text-[1rem] text-slate-700 mt-0.5 leading-snug">{children}</span>
            </span>
        </li>
    );
}
