import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { HeaderSection } from '@/components/layout/HeaderSection';
import { FooterSection } from '@/components/layout/FooterSection';
import { SCREEN_CONTAINER } from '@/components/layout/pageContainer';
import { SECTION_HEADING, SECTION_LEDE, EYEBROW } from '@/components/layout/typography';
import { errorMessage, sendContactMessage } from '@/services/cmsApi';
import { setShareMeta } from '@/lib/shareMeta';

const EMPTY_FORM = { name: '', email: '', phone: '', memberId: '', note: '' };
const INPUT = 'mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-600';

/** Public requests use the existing CMS inbox; account ownership is verified by staff. */
export default function DeleteAccountPage() {
    const [form, setForm] = useState(EMPTY_FORM);
    const [confirmed, setConfirmed] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [reference, setReference] = useState('');
    const submitting = useRef(false);
    const resultRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'auto' });
        return setShareMeta({
            title: 'Delete your account | ACTIV',
            description: 'Request deletion of your ACTIV account and associated personal data. No sign-in or app installation is required.',
            url: `${window.location.origin}/delete-account`,
        });
    }, []);

    useEffect(() => {
        if (reference) resultRef.current?.focus();
    }, [reference]);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (submitting.current) return;
        setError('');
        const name = (form.name || '').trim();
        const email = (form.email || '').trim();
        if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !confirmed) {
            setError('Enter your name and a valid email address, and confirm that you want to request deletion.');
            return;
        }

        submitting.current = true;
        setSending(true);
        try {
            const receipt = await sendContactMessage({
                name,
                email,
                phone: (form.phone || '').trim(),
                subject: 'ACTIV account and data deletion request',
                message: [
                    'I request deletion of my ACTIV account and associated personal data.',
                    'Please verify my account ownership before processing this request.',
                    `Member ID (if known): ${(form.memberId || '').trim() || 'Not provided'}`,
                    `Additional information: ${(form.note || '').trim() || 'None'}`,
                    'Submitted from /delete-account. The requester confirmed that this is their account.',
                    'Please reply with the next steps, expected completion date, and any records that must be retained with the reason and retention period.',
                ].join('\n'),
            });
            if (!receipt?.id) throw new Error('We could not confirm receipt of your request. Please contact ACTIV before submitting it again.');
            setReference(receipt.id);
            setForm(EMPTY_FORM);
            setConfirmed(false);
        } catch (err) {
            const failure = err as { request?: unknown; response?: unknown } | null;
            setError(failure?.request && !failure.response
                ? 'We could not reach ACTIV to confirm receipt. Check your connection and try again, or use the Contact page for help.'
                : errorMessage(err, 'We could not confirm receipt of your request. Please try again or contact ACTIV through the Contact page.'));
        } finally {
            submitting.current = false;
            setSending(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col bg-slate-50 font-sans">
            <HeaderSection />
            <main className="flex-grow">
                <div className="bg-brand-900 text-white">
                    <div className={`${SCREEN_CONTAINER} py-12 sm:py-16`}>
                        <span className={`${EYEBROW} mb-4 inline-block text-white/75`}>Account &amp; privacy</span>
                        <h1 className={`${SECTION_HEADING} mb-4`}>Delete your ACTIV account</h1>
                        <p className={`${SECTION_LEDE} max-w-3xl text-white/80`}>
                            Request deletion of your account and associated personal data from the ACTIV app and website.
                            You do not need to sign in or reinstall the app.
                        </p>
                    </div>
                </div>

                <div className={`${SCREEN_CONTAINER} grid gap-8 py-10 sm:py-14 lg:grid-cols-2 lg:gap-12`}>
                    <section aria-labelledby="deletion-details" className="space-y-7 text-base leading-relaxed text-slate-600">
                        <div>
                            <h2 id="deletion-details" className="mb-3 text-2xl font-bold text-slate-900">What happens next</h2>
                            <ol className="list-decimal space-y-3 pl-5">
                                <li>Send the form with the email address used for your ACTIV account. If you no longer have access to it, provide a reachable email and explain this in the optional note.</li>
                                <li>ACTIV will contact you to verify ownership before processing deletion. Submitting the form does not immediately delete an account.</li>
                                <li>The team will confirm the expected completion date after verification and notify you when the request has been processed.</li>
                            </ol>
                        </div>
                        <div>
                            <h2 className="mb-3 text-xl font-bold text-slate-900">Data covered by your request</h2>
                            <p>Your request covers your login account, personal and membership profile, business profile information, and personal documents or images associated with the account.</p>
                            <p className="mt-3">Once deletion is completed, you will lose access to the account and its member services. Uninstalling the app alone does not delete your account.</p>
                        </div>
                        <div>
                            <h2 className="mb-3 text-xl font-bold text-slate-900">Records that may need to be retained</h2>
                            <p>Payment, invoice, donation and transaction records, and limited records needed for legal obligations, fraud prevention or dispute resolution, may need to be retained. The team will explain any applicable retention reason and period when handling your request.</p>
                            <p className="mt-3">Account deletion does not automatically request a refund. For payment questions, contact ACTIV separately.</p>
                        </div>
                        <div className="flex gap-3 rounded-2xl border border-brand-100 bg-white p-5">
                            <ShieldCheck className="mt-1 shrink-0 text-brand-700" size={22} aria-hidden="true" />
                            <p>Do not include passwords, OTPs, Aadhaar or PAN numbers, or payment card details in this form.</p>
                        </div>
                        <p>
                            Read our <Link to="/privacy-policy" className="font-semibold text-brand-700 underline">Privacy Policy</Link>
                            {' '}and <Link to="/terms-and-conditions" className="font-semibold text-brand-700 underline">Terms and Conditions</Link>.
                            {' '}For assistance, visit <Link to="/contact" className="font-semibold text-brand-700 underline">Contact ACTIV</Link>.
                        </p>
                    </section>

                    <section aria-labelledby="request-heading" className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
                        {reference ? (
                            <div ref={resultRef} tabIndex={-1} role="status" className="space-y-4 outline-none">
                                <CheckCircle2 size={36} className="text-emerald-600" aria-hidden="true" />
                                <h2 id="request-heading" className="text-2xl font-bold text-slate-900">Deletion request received</h2>
                                <p className="leading-relaxed text-slate-600">Your request has been recorded for the ACTIV team. Your account has not been deleted yet. The team will contact you to verify ownership and explain the next steps.</p>
                                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">Request reference: <strong className="break-all">{reference}</strong></p>
                                <p className="text-sm text-slate-600">Save this reference and quote it when contacting ACTIV about your request.</p>
                                <Link to="/contact" className="inline-flex min-h-11 items-center font-semibold text-brand-700 underline">Contact ACTIV</Link>
                            </div>
                        ) : (
                            <form onSubmit={submit} aria-busy={sending}>
                                <h2 id="request-heading" className="text-2xl font-bold text-slate-900">Request account deletion</h2>
                                <p className="mt-2 text-sm leading-relaxed text-slate-600">Fields marked * are required. This request is for your own account.</p>
                                <fieldset disabled={sending} className="mt-6 space-y-5">
                                    <div>
                                        <label htmlFor="deletion-name" className="font-semibold text-slate-800">Full name *</label>
                                        <input id="deletion-name" name="name" autoComplete="name" required maxLength={120} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={INPUT} />
                                    </div>
                                    <div>
                                        <label htmlFor="deletion-email" className="font-semibold text-slate-800">Account email address *</label>
                                        <input id="deletion-email" name="email" type="email" autoComplete="email" required maxLength={200} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={INPUT} aria-describedby="deletion-email-help" />
                                        <p id="deletion-email-help" className="mt-2 text-sm text-slate-500">Use a reachable email and explain in the note if you cannot access your account email.</p>
                                    </div>
                                    <div>
                                        <label htmlFor="deletion-phone" className="font-semibold text-slate-800">Registered phone number <span className="font-normal text-slate-500">(optional)</span></label>
                                        <input id="deletion-phone" name="phone" type="tel" autoComplete="tel" maxLength={30} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={INPUT} />
                                    </div>
                                    <div>
                                        <label htmlFor="deletion-member" className="font-semibold text-slate-800">Member ID <span className="font-normal text-slate-500">(optional)</span></label>
                                        <input id="deletion-member" name="memberId" maxLength={80} value={form.memberId} onChange={e => setForm({ ...form, memberId: e.target.value })} className={INPUT} />
                                    </div>
                                    <div>
                                        <label htmlFor="deletion-note" className="font-semibold text-slate-800">Additional information <span className="font-normal text-slate-500">(optional)</span></label>
                                        <textarea id="deletion-note" name="note" rows={3} maxLength={1500} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} className={INPUT} />
                                    </div>
                                    <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-slate-700">
                                        <input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-brand-700" />
                                        <span>I am requesting deletion of my own ACTIV account and associated personal data. I understand that ACTIV must verify my identity before processing the request. *</span>
                                    </label>
                                    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
                                    <button type="submit" disabled={sending} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-800 px-5 py-3 font-bold text-white transition-colors hover:bg-brand-700 disabled:cursor-wait disabled:opacity-70">
                                        {sending && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
                                        {sending ? 'Submitting request…' : 'Submit deletion request'}
                                    </button>
                                </fieldset>
                            </form>
                        )}
                    </section>
                </div>
            </main>
            <FooterSection />
        </div>
    );
}
