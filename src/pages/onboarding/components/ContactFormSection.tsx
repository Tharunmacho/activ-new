import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, Clock, Loader2, MessageSquare, User, FileText, Send } from 'lucide-react';
import { getContactInfo, sendContactMessage, errorMessage, type ContactInfo } from '@/services/cmsApi';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import { CmsIcon } from '@/components/shared/CmsIcon';
import { SCREEN_CONTAINER } from '@/components/layout/pageContainer';
import { SECTION_HEADING, SECTION_LEDE, EYEBROW } from '@/components/layout/typography';
import { Reveal } from '@/components/shared/Reveal';
import { sectionHidden, sectionFields } from '@/components/shared/cmsSections';
import { CmsExtraFields } from '@/components/shared/CmsExtraFields';

/**
 * The contact page.
 *
 * Every heading, label, image and the strip at the foot are authored in the
 * CMS. The form itself is not: its fields are what the API accepts, so making
 * them editable would let an admin build a form the backend rejects.
 *
 * A detail with nothing behind it is not rendered — an "Email Address" heading
 * over a blank line looks like a bug rather than like an unset field.
 */
export function ContactFormSection() {
    const [info, setInfo] = useState<ContactInfo | null>(null);

    const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [sent, setSent] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getContactInfo()
            .then((data) => { if (!cancelled) setInfo(data); })
            .catch(() => { if (!cancelled) setInfo(null); });
        return () => { cancelled = true; };
    }, []);

    /* Each card on the Contact screen can be removed — see `cmsSections`. */
    const removed = (key: string) => sectionHidden(info?.sections, key);

    const addressLines = removed('contact.info') ? [] : (info?.addressLines || []);
    const workingHours = removed('contact.info') ? [] : (info?.workingHours || []);
    const heroMedia = removed('contact.header') ? [] : (info?.heroMedia || []);
    const phone = removed('contact.info') ? '' : (info?.phone || '');
    const email = removed('contact.info') ? '' : (info?.email || '');
    const formCard = info?.formCard;
    const infoCard = removed('contact.info') ? undefined : info?.infoCard;
    const banner = removed('contact.banner') ? undefined : info?.banner;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
            setError(formCard?.validationMessage || 'Please fill in your name, email and message.');
            return;
        }

        setSending(true);
        try {
            await sendContactMessage({
                name: form.name.trim(),
                email: form.email.trim(),
                phone: form.phone.trim(),
                // Sent as its own field rather than pasted into the message, so
                // the inbox can show and sort by it.
                subject: form.subject.trim(),
                message: form.message.trim(),
            });
            setSent(true);
            setForm({ name: '', email: '', phone: '', subject: '', message: '' });
        } catch (err) {
            setError(errorMessage(err, formCard?.failureMessage
                || 'Your message could not be sent. Please try again.'));
        } finally {
            setSending(false);
        }
    };

    const inputClass =
        'w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-xl text-[1.25rem] focus:outline-none ' +
        'focus:ring-2 focus:ring-brand-600 focus:border-transparent transition-all '
        + 'font-semibold text-[#111827] placeholder:font-medium placeholder:text-gray-500';

    /** One detail in the right-hand card. Renders nothing when unset. */
    const detail = (label: string, icon: React.ReactNode, body: React.ReactNode, show: boolean, last = false) => {
        if (!show) return null;
        return (
            <>
                <div className="flex gap-5 group">
                    <div className="w-10 h-10 bg-brand-50 rounded-full flex items-center justify-center shrink-0
                                    text-brand-600 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                        {icon}
                    </div>
                    <div className="min-w-0">
                        {label && (
                            <h4 className="text-[1.0625rem] font-bold text-[#111827] mb-1.5">{label}</h4>
                        )}
                        {body}
                    </div>
                </div>
                {!last && <div className="h-px w-full border-t border-dashed border-gray-200" />}
            </>
        );
    };

    const headerFields = removed('contact.header') ? [] : sectionFields(info?.sections, 'contact.header');
    const formFields = removed('contact.form') ? [] : sectionFields(info?.sections, 'contact.form');
    const infoFields = removed('contact.info') ? [] : sectionFields(info?.sections, 'contact.info');

    const hasIntro = !removed('contact.header')
        && !!(info?.badgeText || info?.heading || info?.description || headerFields.length);
    const hasInfoCard = !!(addressLines.length || phone || email || workingHours.length
        || infoCard?.title || infoFields.length);

    return (
        <section className="w-full py-20 dot-band relative font-sans overflow-hidden">

            {/* Decorative only — not authored. */}
            <div className="absolute top-0 right-0 w-1/3 h-full -z-10 opacity-30 pointer-events-none">
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id="dots-contact" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                            <circle className="fill-brand-300" cx="2" cy="2" r="1.5" />
                        </pattern>
                    </defs>
                    <rect x="0" y="0" width="100%" height="100%" fill="url(#dots-contact)" />
                </svg>
            </div>
            <div className="absolute top-20 right-10 w-64 h-64 bg-brand-50/80 rounded-full blur-3xl -z-10 transform-gpu will-change-transform pointer-events-none" />

            <div className={`${SCREEN_CONTAINER} relative z-10`}>

                {/* ---- heading and collage ---- */}
                {(hasIntro || heroMedia.length > 0) && (
                    <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-8 mb-20 relative">

                        {hasIntro && (
                            <div className={`w-full ${heroMedia.length ? 'lg:w-5/12' : ''} z-10`}>
                                {info?.badgeText && (
                                    <div className="inline-flex items-center space-x-2 bg-brand-50 text-brand-600 px-4 py-1.5
                                                    rounded-full mb-6 border border-brand-100 shadow-sm">
                                        <CmsIcon name={info.badgeIcon} size={14} className="stroke-[3]" fallback="users" />
                                        <span className={EYEBROW}>{info.badgeText}</span>
                                    </div>
                                )}

                                {(info?.heading || info?.headingHighlight) && (
                                    <h2 className={`${SECTION_HEADING} text-[#111827] mb-6`}>
                                        {info.heading}
                                        {info.headingHighlight && (
                                            <> <span className="text-brand-600">{info.headingHighlight}</span></>
                                        )}
                                    </h2>
                                )}

                                {info?.description && (
                                    <p className={`${SECTION_LEDE} font-medium text-gray-600 max-w-xl`}>
                                        {info.description}
                                    </p>
                                )}

                                {/* The editor's own rows on this card. */}
                                <CmsExtraFields fields={headerFields} className="mt-8" />
                            </div>
                        )}

                        {heroMedia.length > 0 && hasIntro && (
                            <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                                            z-20 flex-col items-center">
                                <div className="w-14 h-14 bg-brand-600 rounded-full flex items-center justify-center
                                                shadow-lg shadow-brand-600/30">
                                    <MessageSquare size={24} className="text-white" />
                                </div>
                            </div>
                        )}

                        {heroMedia.length > 0 && (
                            <div className={`w-full ${hasIntro ? 'lg:w-7/12' : ''} relative mt-8 lg:mt-0`}>
                                <div className="relative h-[18.75rem] md:h-[25rem] w-full max-w-2xl ml-auto">
                                    {heroMedia[0] && (
                                        <div className="absolute top-0 right-10 w-[70%] h-full z-10">
                                            <div className="w-full h-full rounded-3xl overflow-hidden border-[6px]
                                                            border-white shadow-xl bg-gray-100">
                                                <CmsMediaFrame media={heroMedia[0]} priority width={560} />
                                            </div>
                                        </div>
                                    )}
                                    {/* The overhang below is a desktop flourish. On a phone the
                                        content column is only 16px from the screen edge, so 24px
                                        of it fell off the side and the photograph was sliced down
                                        its right edge. */}
                                    {heroMedia[1] && (
                                        <div className="absolute top-1/2 -translate-y-1/2 right-0 mr-0 sm:-mr-6
                                                        w-[45%] h-[55%]
                                                        z-20 rotate-3 shadow-2xl rounded-2xl bg-white p-1">
                                            <div className="w-full h-full rounded-[14px] overflow-hidden relative">
                                                <CmsMediaFrame media={heroMedia[1]} width={360} />
                                                <div className="absolute inset-0 bg-gradient-to-tr from-black/40 to-transparent" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ---- the two cards ---- */}
                <div className={`grid grid-cols-1 ${hasInfoCard ? 'lg:grid-cols-2' : ''} gap-8 mb-10`}>

                    {/* Form. Revealed but never tilted: a panel that shifts under the
                        pointer while somebody is filling in a field is an obstacle,
                        not an effect. */}
                    <Reveal
                        variant="left"
                        className="bg-white rounded-[2rem] border border-brand-100/70
                                   shadow-[0_14px_46px_-16px_rgb(28_46_104/0.22)]
                                   p-8 md:p-10 flex flex-col"
                    >

                        {(formCard?.title || formCard?.subtitle) && (
                            <div className="flex items-start gap-4 mb-8">
                                <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-xl flex items-center
                                                justify-center shrink-0">
                                    <CmsIcon name={formCard.icon} size={24} fallback="send" />
                                </div>
                                <div>
                                    {formCard.title && (
                                        <h3 className="text-2xl font-extrabold tracking-tight text-[#111827]">
                                            {formCard.title}
                                        </h3>
                                    )}
                                    {formCard.subtitle && (
                                        <p className="text-[1.125rem] font-medium text-gray-600 mt-1">
                                            {formCard.subtitle}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="flex flex-col gap-5 flex-grow">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <User size={18} className="text-gray-400" />
                                    </div>
                                    <input
                                        type="text" placeholder={formCard?.namePlaceholder || 'Your Name'} value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>

                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Mail size={18} className="text-gray-400" />
                                    </div>
                                    <input
                                        type="email" placeholder={formCard?.emailPlaceholder || 'Email Address'} value={form.email}
                                        onChange={e => setForm({ ...form, email: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Phone size={18} className="text-gray-400" />
                                    </div>
                                    <input
                                        type="tel" placeholder={formCard?.phonePlaceholder || 'Mobile Number'} value={form.phone}
                                        onChange={e => setForm({ ...form, phone: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>

                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <FileText size={18} className="text-gray-400" />
                                    </div>
                                    <input
                                        type="text" placeholder={formCard?.subjectPlaceholder || 'Subject'} value={form.subject}
                                        onChange={e => setForm({ ...form, subject: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>
                            </div>

                            <div className="relative flex-grow">
                                <div className="absolute top-4 left-4 flex items-start pointer-events-none">
                                    <MessageSquare size={18} className="text-gray-400" />
                                </div>
                                <textarea
                                    placeholder={formCard?.messagePlaceholder || 'Your Message'} rows={5} value={form.message}
                                    onChange={e => setForm({ ...form, message: e.target.value })}
                                    className={`${inputClass} resize-none h-full min-h-[8.75rem]`}
                                />
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit" disabled={sending}
                                    className="bg-brand-900 hover:bg-brand-900 text-white px-9 py-4 rounded-xl text-[1.25rem]
                                               font-semibold transition-all inline-flex items-center gap-2 shadow-lg
                                               shadow-brand-900/20 disabled:opacity-70"
                                >
                                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                    {sending ? 'Sending…' : (formCard?.submitLabel || 'Send Message')}
                                </button>
                            </div>

                            {error && <p className="text-[1.25rem] text-red-600 mt-2 font-medium">{error}</p>}
                            {sent && !error && (
                                <p className="text-[1.25rem] text-green-600 mt-2 font-medium">
                                    {formCard?.successMessage || 'Thank you — your message has been sent.'}
                                </p>
                            )}

                            {/* The editor's own rows on the form card. */}
                            <CmsExtraFields fields={formFields} variant="list" className="pt-2" />
                        </form>
                    </Reveal>

                    {/* Details */}
                    {hasInfoCard && (
                        <Reveal
                            variant="right"
                            delay={120}
                            className="bg-white rounded-[2rem] border border-brand-100/70
                                       shadow-[0_14px_46px_-16px_rgb(28_46_104/0.22)]
                                       p-8 md:p-10 flex flex-col"
                        >

                            {(infoCard?.title || infoCard?.subtitle) && (
                                <div className="flex items-start gap-4 mb-10">
                                    <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-xl flex items-center
                                                    justify-center shrink-0">
                                        <CmsIcon name={infoCard.icon} size={24} fallback="users" />
                                    </div>
                                    <div>
                                        {infoCard.title && (
                                            <h3 className="text-2xl font-extrabold tracking-tight text-[#111827]">
                                                {infoCard.title}
                                            </h3>
                                        )}
                                        {infoCard.subtitle && (
                                            <p className="text-[1.125rem] font-medium text-gray-600 mt-1">
                                                {infoCard.subtitle}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-8 pl-1">
                                {detail(
                                    infoCard?.addressLabel || '',
                                    <MapPin size={18} />,
                                    <p className="text-[1.25rem] font-semibold text-gray-700 leading-relaxed
                                                  max-w-md">
                                        {addressLines.map((line, i) => (
                                            <React.Fragment key={i}>
                                                {line}
                                                {i < addressLines.length - 1 && <br />}
                                            </React.Fragment>
                                        ))}
                                    </p>,
                                    addressLines.length > 0,
                                )}

                                {detail(
                                    infoCard?.phoneLabel || '',
                                    <Phone size={18} />,
                                    <div className="text-[1.125rem] font-semibold text-gray-700 space-y-1">
                                        {[phone, info?.alternatePhone].filter(Boolean).map((p, i) => (
                                            <p key={i}>
                                                <a
                                                    href={`tel:${(p || '').replace(/\s+/g, '')}`}
                                                    className="block py-3 -my-1.5 hover:text-brand-600 transition-colors"
                                                >
                                                    {p}
                                                </a>
                                            </p>
                                        ))}
                                    </div>,
                                    !!phone,
                                )}

                                {detail(
                                    infoCard?.emailLabel || '',
                                    <Mail size={18} />,
                                    <a
                                        href={`mailto:${email}`}
                                        className="block py-3 -my-1.5 text-[1.125rem] font-semibold text-gray-700
                                                   hover:text-brand-600 transition-colors"
                                    >
                                        {email}
                                    </a>,
                                    !!email,
                                )}

                                {detail(
                                    infoCard?.hoursLabel || '',
                                    <Clock size={18} />,
                                    <div className="text-[1.125rem] font-semibold text-gray-700 space-y-1">
                                        {workingHours.map((line, i) => <p key={i}>{line}</p>)}
                                    </div>,
                                    workingHours.length > 0,
                                    true,
                                )}

                                {/* Rows the editor named themselves — a WhatsApp
                                    number, a registration desk, whatever this
                                    association needs that the four above do not
                                    cover. Nothing is drawn when none are set. */}
                                <CmsExtraFields
                                    fields={[...infoFields, ...(info?.extraFields || [])]}
                                    variant="list"
                                    className="pt-2"
                                />
                            </div>

                            {info?.mapEmbedUrl && (
                                <div className="mt-8 rounded-2xl overflow-hidden border border-gray-100 h-56">
                                    <iframe
                                        src={info.mapEmbedUrl}
                                        title="Head office location"
                                        className="w-full h-full border-0"
                                        loading="lazy"
                                        referrerPolicy="no-referrer-when-downgrade"
                                    />
                                </div>
                            )}
                        </Reveal>
                    )}
                </div>

                {/* ---- the strip at the foot ---- */}
                {banner?.enabled && (banner.title || banner.ctaLabel) && (
                    <div className="bg-[#f8fafc] rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center
                                    justify-between gap-6 border border-gray-100">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 bg-brand-100 text-brand-600 rounded-2xl flex items-center
                                            justify-center shrink-0">
                                <CmsIcon name={banner.icon} size={28} fallback="users" />
                            </div>
                            <div>
                                {banner.title && (
                                    <h3 className="text-[1.375rem] md:text-[1.5625rem] font-bold text-[#111827]">{banner.title}</h3>
                                )}
                                {banner.subtitle && (
                                    <p className="text-[1.125rem] font-medium text-gray-600 mt-1">
                                        {banner.subtitle}
                                    </p>
                                )}
                            </div>
                        </div>

                        {banner.ctaLabel && (
                            (banner.ctaHref || '').startsWith('/')
                                ? (
                                    <Link
                                        to={banner.ctaHref}
                                        className="bg-brand-900 hover:bg-brand-900 text-white px-7 py-3.5 rounded-xl text-[1.25rem]
                                                   font-semibold transition-all whitespace-nowrap shrink-0 shadow-md"
                                    >
                                        {banner.ctaLabel}
                                    </Link>
                                ) : (
                                    <a
                                        href={banner.ctaHref || '#'}
                                        className="bg-brand-900 hover:bg-brand-900 text-white px-7 py-3.5 rounded-xl text-[1.25rem]
                                                   font-semibold transition-all whitespace-nowrap shrink-0 shadow-md"
                                    >
                                        {banner.ctaLabel}
                                    </a>
                                )
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
