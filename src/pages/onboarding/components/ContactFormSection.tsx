import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, Clock, Loader2, MessageSquare, User, FileText, Send } from 'lucide-react';
import { getContactInfo, sendContactMessage, errorMessage, type ContactInfo } from '@/services/cmsApi';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import { CmsIcon } from '@/components/shared/CmsIcon';
import { PAGE_CONTAINER } from '@/components/layout/pageContainer';
import { SECTION_HEADING, SECTION_LEDE, EYEBROW } from '@/components/layout/typography';
import { Reveal } from '@/components/shared/Reveal';

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

    const addressLines = info?.addressLines || [];
    const workingHours = info?.workingHours || [];
    const heroMedia = info?.heroMedia || [];
    const phone = info?.phone || '';
    const email = info?.email || '';
    const formCard = info?.formCard;
    const infoCard = info?.infoCard;
    const banner = info?.banner;

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
        'w-full pl-11 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none ' +
        'focus:ring-2 focus:ring-brand-600 focus:border-transparent transition-all placeholder:text-gray-400';

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
                        {label && <h4 className="text-[0.9375rem] font-bold text-[#111827] mb-2">{label}</h4>}
                        {body}
                    </div>
                </div>
                {!last && <div className="h-px w-full border-t border-dashed border-gray-200" />}
            </>
        );
    };

    const hasIntro = !!(info?.badgeText || info?.heading || info?.description);
    const hasInfoCard = !!(addressLines.length || phone || email || workingHours.length || infoCard?.title);

    return (
        <section className="w-full py-20 bg-white relative font-sans overflow-hidden">

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

            <div className={`${PAGE_CONTAINER} relative z-10`}>

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
                                    <p className={`${SECTION_LEDE} text-gray-500 max-w-xl`}>
                                        {info.description}
                                    </p>
                                )}
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
                                    {heroMedia[1] && (
                                        <div className="absolute top-1/2 -translate-y-1/2 right-0 -mr-6 w-[45%] h-[55%]
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
                                        <h3 className="text-2xl font-bold text-[#111827]">{formCard.title}</h3>
                                    )}
                                    {formCard.subtitle && (
                                        <p className="text-sm text-gray-500 mt-1">{formCard.subtitle}</p>
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
                                    className="bg-brand-900 hover:bg-brand-900 text-white px-8 py-3.5 rounded-xl text-sm
                                               font-semibold transition-all inline-flex items-center gap-2 shadow-lg
                                               shadow-brand-900/20 disabled:opacity-70"
                                >
                                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                    {sending ? 'Sending…' : (formCard?.submitLabel || 'Send Message')}
                                </button>
                            </div>

                            {error && <p className="text-sm text-red-600 mt-2 font-medium">{error}</p>}
                            {sent && !error && (
                                <p className="text-sm text-green-600 mt-2 font-medium">
                                    {formCard?.successMessage || 'Thank you — your message has been sent.'}
                                </p>
                            )}
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
                                            <h3 className="text-2xl font-bold text-[#111827]">{infoCard.title}</h3>
                                        )}
                                        {infoCard.subtitle && (
                                            <p className="text-sm text-gray-500 mt-1">{infoCard.subtitle}</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-8 pl-1">
                                {detail(
                                    infoCard?.addressLabel || '',
                                    <MapPin size={18} />,
                                    <p className="text-base text-gray-500 leading-relaxed max-w-md">
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
                                    <div className="text-sm text-gray-500 space-y-1">
                                        {[phone, info?.alternatePhone].filter(Boolean).map((p, i) => (
                                            <p key={i}>
                                                <a href={`tel:${(p || '').replace(/\s+/g, '')}`} className="hover:text-brand-600 transition-colors">
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
                                    <a href={`mailto:${email}`} className="text-sm text-gray-500 hover:text-brand-600 transition-colors">
                                        {email}
                                    </a>,
                                    !!email,
                                )}

                                {detail(
                                    infoCard?.hoursLabel || '',
                                    <Clock size={18} />,
                                    <div className="text-sm text-gray-500 space-y-1">
                                        {workingHours.map((line, i) => <p key={i}>{line}</p>)}
                                    </div>,
                                    workingHours.length > 0,
                                    true,
                                )}
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
                                    <h3 className="text-lg md:text-xl font-bold text-[#111827]">{banner.title}</h3>
                                )}
                                {banner.subtitle && (
                                    <p className="text-sm text-gray-500 mt-1">{banner.subtitle}</p>
                                )}
                            </div>
                        </div>

                        {banner.ctaLabel && (
                            (banner.ctaHref || '').startsWith('/')
                                ? (
                                    <Link
                                        to={banner.ctaHref}
                                        className="bg-brand-900 hover:bg-brand-900 text-white px-6 py-3 rounded-xl text-sm
                                                   font-semibold transition-all whitespace-nowrap shrink-0 shadow-md"
                                    >
                                        {banner.ctaLabel}
                                    </Link>
                                ) : (
                                    <a
                                        href={banner.ctaHref || '#'}
                                        className="bg-brand-900 hover:bg-brand-900 text-white px-6 py-3 rounded-xl text-sm
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
