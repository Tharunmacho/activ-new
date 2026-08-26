import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
    getContactInfo, updateContactInfo, errorMessage,
    EMPTY_MEDIA, type ContactInfo, type CmsMedia,
} from '@/services/cmsApi';
import { CmsCard, CmsField, CmsInput, CmsTextarea, SaveButton, CmsLoading, CmsError } from './components/CmsUI';
import { LineList, IconPicker } from './components/CmsEditors';
import MediaPicker from './components/MediaPicker';

/**
 * The contact page.
 *
 * One document, one save button: unlike the home page these blocks are short
 * and are naturally reviewed together, and splitting them would be five buttons
 * for what is one sitting's work.
 *
 * The details themselves — the number a visitor rings, the address they travel
 * to — are never defaulted or guessed. An empty field renders as nothing on the
 * page rather than as a placeholder that looks real.
 */
export default function ContactManager() {
    const [info, setInfo] = useState<ContactInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            setInfo(await getContactInfo());
        } catch (err) {
            setError(errorMessage(err, 'Could not load the contact details'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!info) return;
        setSaving(true);
        setError('');
        setSaved('');
        try {
            // Take the server's copy back: it lowercases the email and drops
            // media with no URL, and the editor should show what was stored.
            setInfo(await updateContactInfo(info));
            setSaved('Contact page saved — the live page is updated.');
            setTimeout(() => setSaved(''), 3000);
        } catch (err) {
            setError(errorMessage(err, 'Could not save the contact page'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <CmsLoading label="Loading contact page…" />;
    if (!info) return <CmsError message={error || 'No content'} onRetry={load} />;

    const set = (patch: Partial<ContactInfo>) => setInfo({ ...info, ...patch });
    const setForm = (patch: Partial<ContactInfo['formCard']>) => set({ formCard: { ...info.formCard, ...patch } });
    const setInfoCard = (patch: Partial<ContactInfo['infoCard']>) => set({ infoCard: { ...info.infoCard, ...patch } });
    const setBanner = (patch: Partial<ContactInfo['banner']>) => set({ banner: { ...info.banner, ...patch } });

    const setHeroMedia = (index: number, media: CmsMedia) =>
        set({ heroMedia: info.heroMedia.map((m, i) => (i === index ? media : m)) });

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl pb-12">
            <CmsError message={error} onRetry={load} />
            {saved && (
                <p className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40
                              border border-green-200 dark:border-green-900 rounded-lg px-4 py-2">
                    {saved}
                </p>
            )}

            {/* ============================================== page heading */}
            <CmsCard title="Page heading" description="The badge, title and paragraph at the top of /contact.">
                <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                        <IconPicker value={info.badgeIcon} onChange={badgeIcon => set({ badgeIcon })} label="Badge icon" />
                        <CmsField label="Badge text" hint="The small pill above the heading.">
                            <CmsInput
                                value={info.badgeText}
                                onChange={e => set({ badgeText: e.target.value })}
                                placeholder="Get In Touch"
                            />
                        </CmsField>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <CmsField label="Heading">
                            <CmsInput
                                value={info.heading}
                                onChange={e => set({ heading: e.target.value })}
                                placeholder="We'd Love to Hear From"
                            />
                        </CmsField>
                        <CmsField label="Highlighted word" hint="Rendered in blue at the end of the heading.">
                            <CmsInput
                                value={info.headingHighlight}
                                onChange={e => set({ headingHighlight: e.target.value })}
                                placeholder="You!"
                            />
                        </CmsField>
                    </div>

                    <CmsField label="Description">
                        <CmsTextarea
                            rows={3}
                            value={info.description}
                            onChange={e => set({ description: e.target.value })}
                        />
                    </CmsField>

                    <div className="border-t border-slate-200 dark:border-slate-800 pt-5">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                    Images beside the heading
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Two overlapping frames. The first is the large one behind.
                                </p>
                            </div>
                            {info.heroMedia.length < 2 && (
                                <button
                                    type="button"
                                    onClick={() => set({ heroMedia: [...info.heroMedia, { ...EMPTY_MEDIA }] })}
                                    className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400"
                                >
                                    <Plus size={14} /> Add image
                                </button>
                            )}
                        </div>

                        {info.heroMedia.length === 0 ? (
                            <p className="text-sm text-slate-500 py-4 text-center border border-dashed
                                          border-slate-300 dark:border-slate-700 rounded-lg">
                                No images — the heading uses the full width.
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {info.heroMedia.map((media, i) => (
                                    <div key={i} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                                {i === 0 ? 'Large frame' : 'Small frame'}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => set({ heroMedia: info.heroMedia.filter((_, x) => x !== i) })}
                                                className="p-1.5 rounded text-red-500 hover:bg-red-500/10"
                                                aria-label="Remove image"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        <MediaPicker
                                            label=""
                                            aspect={i === 0 ? '4 / 3' : '1 / 1'}
                                            value={media}
                                            onChange={m => setHeroMedia(i, m)}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </CmsCard>

            {/* ============================================== form card */}
            <CmsCard title="Message form" description="The wording on the form card. The fields themselves are fixed — they are what the API accepts.">
                <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                        <IconPicker value={info.formCard.icon} onChange={icon => setForm({ icon })} />
                        <CmsField label="Card title">
                            <CmsInput
                                value={info.formCard.title}
                                onChange={e => setForm({ title: e.target.value })}
                                placeholder="Send us a Message"
                            />
                        </CmsField>
                    </div>

                    <CmsField label="Card subtitle">
                        <CmsInput
                            value={info.formCard.subtitle}
                            onChange={e => setForm({ subtitle: e.target.value })}
                            placeholder="Fill in the details below and we will get back to you."
                        />
                    </CmsField>

                    <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                            Field wording
                        </p>
                        <p className="text-xs text-slate-500 mb-3">
                            What each box is called. Which boxes exist is fixed — they are what the
                            API accepts, so adding one here would build a form the server rejects.
                        </p>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <CmsField label="Name box">
                                <CmsInput
                                    value={info.formCard.namePlaceholder}
                                    onChange={e => setForm({ namePlaceholder: e.target.value })}
                                    placeholder="Your Name"
                                />
                            </CmsField>
                            <CmsField label="Email box">
                                <CmsInput
                                    value={info.formCard.emailPlaceholder}
                                    onChange={e => setForm({ emailPlaceholder: e.target.value })}
                                    placeholder="Email Address"
                                />
                            </CmsField>
                            <CmsField label="Phone box">
                                <CmsInput
                                    value={info.formCard.phonePlaceholder}
                                    onChange={e => setForm({ phonePlaceholder: e.target.value })}
                                    placeholder="Mobile Number"
                                />
                            </CmsField>
                            <CmsField label="Subject box">
                                <CmsInput
                                    value={info.formCard.subjectPlaceholder}
                                    onChange={e => setForm({ subjectPlaceholder: e.target.value })}
                                    placeholder="Subject"
                                />
                            </CmsField>
                            <div className="sm:col-span-2">
                                <CmsField label="Message box">
                                    <CmsInput
                                        value={info.formCard.messagePlaceholder}
                                        onChange={e => setForm({ messagePlaceholder: e.target.value })}
                                        placeholder="Your Message"
                                    />
                                </CmsField>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">
                            Messages
                        </p>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <CmsField label="Something missing" hint="Shown before sending, when a required box is empty.">
                                <CmsInput
                                    value={info.formCard.validationMessage}
                                    onChange={e => setForm({ validationMessage: e.target.value })}
                                    placeholder="Please fill in your name, email and message."
                                />
                            </CmsField>
                            <CmsField label="Sending failed" hint="Shown when the message could not be delivered.">
                                <CmsInput
                                    value={info.formCard.failureMessage}
                                    onChange={e => setForm({ failureMessage: e.target.value })}
                                    placeholder="Your message could not be sent. Please try again."
                                />
                            </CmsField>
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <CmsField label="Submit button label">
                            <CmsInput
                                value={info.formCard.submitLabel}
                                onChange={e => setForm({ submitLabel: e.target.value })}
                                placeholder="Send Message"
                            />
                        </CmsField>
                        <CmsField label="Confirmation message" hint="Shown once a message is sent.">
                            <CmsInput
                                value={info.formCard.successMessage}
                                onChange={e => setForm({ successMessage: e.target.value })}
                                placeholder="Thank you! Your message has been sent."
                            />
                        </CmsField>
                    </div>
                </div>
            </CmsCard>

            {/* ============================================== details card */}
            <CmsCard title="Contact details" description="The card beside the form. A detail left blank is not shown at all.">
                <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                        <IconPicker value={info.infoCard.icon} onChange={icon => setInfoCard({ icon })} />
                        <CmsField label="Card title">
                            <CmsInput
                                value={info.infoCard.title}
                                onChange={e => setInfoCard({ title: e.target.value })}
                                placeholder="Contact Information"
                            />
                        </CmsField>
                    </div>

                    <CmsField label="Card subtitle">
                        <CmsInput
                            value={info.infoCard.subtitle}
                            onChange={e => setInfoCard({ subtitle: e.target.value })}
                            placeholder="Reach out through any of the following channels."
                        />
                    </CmsField>

                    <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <CmsField label="Address heading">
                                <CmsInput
                                    value={info.infoCard.addressLabel}
                                    onChange={e => setInfoCard({ addressLabel: e.target.value })}
                                    placeholder="Head Office Address"
                                />
                            </CmsField>
                            <LineList
                                label="Address"
                                hint="One line per row, as it should appear."
                                value={info.addressLines}
                                onChange={addressLines => set({ addressLines })}
                            />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-3">
                            <CmsField label="Phone heading">
                                <CmsInput
                                    value={info.infoCard.phoneLabel}
                                    onChange={e => setInfoCard({ phoneLabel: e.target.value })}
                                    placeholder="Phone Number"
                                />
                            </CmsField>
                            <CmsField label="Primary phone">
                                <CmsInput
                                    value={info.phone}
                                    onChange={e => set({ phone: e.target.value })}
                                    placeholder="+91 8220012188"
                                />
                            </CmsField>
                            <CmsField label="Alternate phone" hint="Optional.">
                                <CmsInput
                                    value={info.alternatePhone}
                                    onChange={e => set({ alternatePhone: e.target.value })}
                                />
                            </CmsField>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <CmsField label="Email heading">
                                <CmsInput
                                    value={info.infoCard.emailLabel}
                                    onChange={e => setInfoCard({ emailLabel: e.target.value })}
                                    placeholder="Email Address"
                                />
                            </CmsField>
                            <CmsField label="Email">
                                <CmsInput
                                    type="email"
                                    value={info.email}
                                    onChange={e => set({ email: e.target.value })}
                                    placeholder="info@activ.org.in"
                                />
                            </CmsField>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <CmsField label="Hours heading">
                                <CmsInput
                                    value={info.infoCard.hoursLabel}
                                    onChange={e => setInfoCard({ hoursLabel: e.target.value })}
                                    placeholder="Working Hours"
                                />
                            </CmsField>
                            <LineList
                                label="Working hours"
                                value={info.workingHours}
                                onChange={workingHours => set({ workingHours })}
                                rows={3}
                                placeholder={'Mon - Sat : 9.00 AM - 6.00 PM\nSunday : Closed'}
                            />
                        </div>

                        <CmsField label="Map embed URL" hint="The src of a Google Maps embed. Blank hides the map.">
                            <CmsInput
                                value={info.mapEmbedUrl}
                                onChange={e => set({ mapEmbedUrl: e.target.value })}
                            />
                        </CmsField>
                    </div>
                </div>
            </CmsCard>

            {/* ============================================== bottom banner */}
            <CmsCard title="Bottom banner" description="The strip at the foot of the contact page.">
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 mb-5">
                    <input
                        type="checkbox"
                        checked={info.banner.enabled}
                        onChange={e => setBanner({ enabled: e.target.checked })}
                        className="rounded border-slate-400"
                    />
                    Show the banner
                </label>

                {info.banner.enabled && (
                    <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                            <IconPicker value={info.banner.icon} onChange={icon => setBanner({ icon })} />
                            <CmsField label="Title">
                                <CmsInput
                                    value={info.banner.title}
                                    onChange={e => setBanner({ title: e.target.value })}
                                    placeholder="Let's Build a Stronger Community Together"
                                />
                            </CmsField>
                        </div>

                        <CmsField label="Subtitle">
                            <CmsInput
                                value={info.banner.subtitle}
                                onChange={e => setBanner({ subtitle: e.target.value })}
                                placeholder="Join hands with ACTIV to empower entrepreneurs."
                            />
                        </CmsField>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <CmsField label="Button label" hint="Blank hides the button.">
                                <CmsInput
                                    value={info.banner.ctaLabel}
                                    onChange={e => setBanner({ ctaLabel: e.target.value })}
                                    placeholder="Become a Member"
                                />
                            </CmsField>
                            <CmsField label="Button link">
                                <CmsInput
                                    value={info.banner.ctaHref}
                                    onChange={e => setBanner({ ctaHref: e.target.value })}
                                    placeholder="/register"
                                />
                            </CmsField>
                        </div>
                    </div>
                )}
            </CmsCard>

            {/* ============================================== socials */}
            <CmsCard
                title="Social links"
                description="Used elsewhere on the site. The footer's own social buttons are under Header & Footer."
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    {(['facebook', 'instagram', 'linkedin', 'youtube'] as const).map((key) => (
                        <CmsField key={key} label={key[0].toUpperCase() + key.slice(1)}>
                            <CmsInput
                                value={info.social[key]}
                                onChange={e => set({ social: { ...info.social, [key]: e.target.value } })}
                                placeholder={`https://${key}.com/…`}
                            />
                        </CmsField>
                    ))}
                </div>
            </CmsCard>

            <SaveButton loading={saving} label="Save contact page" />
        </form>
    );
}
