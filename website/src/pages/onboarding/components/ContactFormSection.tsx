import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MapPin, Phone, Mail, Clock, Loader2, MessageSquare, User, FileText, Send, Navigation, ExternalLink, ChevronDown } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa6';
import { getContactInfo, sendContactMessage, errorMessage, EMPTY_OFFICE, type ContactInfo, type ContactOffice } from '@/services/cmsApi';
import SocialLinks from '@/components/shared/SocialLinks';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import { CmsIcon } from '@/components/shared/CmsIcon';
import { SCREEN_CONTAINER } from '@/components/layout/pageContainer';
import { SECTION_HEADING, SECTION_LEDE, EYEBROW, BAND_MEASURE } from '@/components/layout/typography';

/** The information column's own type, for the rows added to its cards. */
const INFO_PROSE = 'text-[1.125rem] font-medium leading-relaxed text-gray-600';
import { Reveal } from '@/components/shared/Reveal';
import { sectionHidden, sectionFields } from '@/components/shared/cmsSections';
import { CmsExtraFields } from '@/components/shared/CmsExtraFields';
import { SectionFields } from '@/components/shared/SectionFields';

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

    /*
     * STATE-WISE OFFICES. The head office is first and selected by default; the
     * switcher changes every detail and the map below. `?state=Kerala` opens
     * that state's office directly. A page with no offices stored gets one built
     * from the legacy fields, so nothing that was there disappears.
     */
    const offices: ContactOffice[] = useMemo(() => {
        const list = (info?.offices || []).filter((o) => o.isActive !== false);
        if (list.length) return list;
        if (!info) return [];
        const has = (info.addressLines || []).length || info.phone || info.email;
        return has ? [{
            ...EMPTY_OFFICE, id: 'head-office', label: 'Head Office', isHeadOffice: true,
            addressLines: info.addressLines || [], phone: info.phone || '', alternatePhone: info.alternatePhone || '',
            email: info.email || '', workingHours: info.workingHours || [],
            mapEmbedUrl: info.mapEmbedUrl || '', mapLink: info.mapLink || '',
        }] : [];
    }, [info]);
    const [params, setParams] = useSearchParams();
    const wanted = (params.get('state') || '').trim().toLowerCase();
    const [officeId, setOfficeId] = useState('');
    const office: ContactOffice | null = offices.find((o) => o.id === officeId)
        || (wanted ? offices.find((o) => (o.state || '').toLowerCase() === wanted) : undefined)
        || offices.find((o) => o.isHeadOffice) || offices[0] || null;
    const chooseOffice = (o: ContactOffice) => {
        setOfficeId(o.id);
        const next = new URLSearchParams(params);
        if (o.isHeadOffice || !o.state) next.delete('state'); else next.set('state', o.state);
        setParams(next, { replace: true });
    };
    const officeName = (o: ContactOffice) => (o.isHeadOffice ? (o.label || 'Head Office') : (o.label || o.state || 'Office'));

    const addressLines = removed('contact.info') ? [] : (office?.addressLines || []);
    const workingHours = removed('contact.info') ? [] : (office?.workingHours || []);
    const heroMedia = removed('contact.header') ? [] : (info?.heroMedia || []);
    const phone = removed('contact.info') ? '' : (office?.phone || '');
    const alternatePhone = removed('contact.info') ? '' : (office?.alternatePhone || '');
    const email = removed('contact.info') ? '' : (office?.email || '');
    const whatsapp = removed('contact.info') ? '' : (office?.whatsapp || '');
    const whatsappHref = (() => {
        let d = whatsapp.replace(/\D/g, '');
        if (d.length === 10) d = `91${d}`;
        return d.length >= 11 ? `https://wa.me/${d}` : '';
    })();
    const [mapFailed, setMapFailed] = useState(false);
    const [mapReady, setMapReady] = useState(false);
    useEffect(() => { setMapFailed(false); setMapReady(false); }, [office?.id]);

    /*
     * WARM THE MAP'S CONNECTIONS BEFORE THE FRAME ASKS FOR THEM.
     *
     * The embed is three origins deep (the frame, its script host, its tile
     * host) and each costs a DNS + TLS handshake — on a phone that was most of
     * the wait. Opening them while the contact details are still being fetched
     * means the iframe starts with the sockets already up.
     */
    useEffect(() => {
        const added: HTMLLinkElement[] = [];
        for (const href of ['https://www.google.com', 'https://maps.gstatic.com', 'https://maps.googleapis.com', 'https://khms0.googleapis.com']) {
            if (document.head.querySelector(`link[rel="preconnect"][href="${href}"]`)) continue;
            const link = document.createElement('link');
            link.rel = 'preconnect';
            link.href = href;
            link.crossOrigin = '';
            document.head.appendChild(link);
            added.push(link);
        }
        return () => { added.forEach((l) => l.remove()); };
    }, []);
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
                <div className="flex gap-3 sm:gap-5 group">
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
        || infoCard?.title || infoFields.length || offices.length);

    return (
        <section className="w-full py-10 sm:py-20 dot-band relative font-sans overflow-hidden">

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
                    <div className="flex flex-col lg:flex-row items-center gap-8 sm:gap-10 lg:gap-8 mb-10 sm:mb-20 relative">

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
                                    <h2 className={`${SECTION_HEADING} text-[#111827] mb-4 sm:mb-6 break-words`}>
                                        {info.heading}
                                        {info.headingHighlight && (
                                            <> <span className="text-brand-600">{info.headingHighlight}</span></>
                                        )}
                                    </h2>
                                )}

                                {info?.description && (
                                    <p className={`${SECTION_LEDE} font-medium text-gray-600 ${BAND_MEASURE}`}>
                                        {info.description}
                                    </p>
                                )}

                                {/* The editor's own rows on this card. */}
                                <div className={`${SECTION_LEDE} font-medium text-gray-600`}>
                                    <CmsExtraFields fields={headerFields} className="mt-8" />
                                </div>
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
                                {/* Phones: the first photograph alone, at its own shape and
                                    whole — the overlapping collage crops people at 360px. */}
                                <div className="relative h-auto sm:h-[18.75rem] md:h-[25rem] w-full max-w-2xl ml-auto">
                                    {heroMedia[0] && (
                                        <div className="relative sm:absolute sm:top-0 sm:right-10 w-full sm:w-[70%] h-auto sm:h-full z-10">
                                            {/* `sm:` on the offset: `right-10` on a relatively-positioned
                                                box shifted the photo 40px off the left edge on phones. */}
                                            <div className="w-full h-auto sm:h-full rounded-3xl overflow-hidden border-4 sm:border-[6px]
                                                            border-white shadow-xl bg-gray-100">
                                                <CmsMediaFrame
                                                    media={heroMedia[0]}
                                                    priority
                                                    width={560}
                                                    className="max-sm:!h-auto max-sm:max-h-[70vh] max-sm:!object-contain"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    {/* The overhang below is a desktop flourish. On a phone the
                                        content column is only 16px from the screen edge, so 24px
                                        of it fell off the side and the photograph was sliced down
                                        its right edge. */}
                                    {heroMedia[1] && (
                                        <div className="hidden sm:block absolute top-1/2 -translate-y-1/2 right-0 mr-0 sm:-mr-6
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
                <div className={`grid grid-cols-1 ${hasInfoCard ? 'lg:grid-cols-2' : ''} gap-5 sm:gap-8 mb-8 sm:mb-10`}>

                    {/* Form. Revealed but never tilted: a panel that shifts under the
                        pointer while somebody is filling in a field is an obstacle,
                        not an effect. */}
                    <Reveal
                        variant="left"
                        className="bg-white rounded-[2rem] border border-brand-100/70
                                   shadow-[0_14px_46px_-16px_rgb(28_46_104/0.22)]
                                   p-4 sm:p-8 md:p-10 flex flex-col lg:self-start lg:sticky lg:top-28"
                    >

                        {(formCard?.title || formCard?.subtitle) && (
                            <div className="flex items-start gap-3 sm:gap-4 mb-6 sm:mb-8">
                                <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-xl flex items-center
                                                justify-center shrink-0">
                                    <CmsIcon name={formCard.icon} size={24} fallback="send" />
                                </div>
                                <div>
                                    {formCard.title && (
                                        <h3 className="text-[1.375rem] sm:text-[1.5625rem] font-extrabold tracking-tight text-[#111827]">
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

                        {/* Natural height: the form no longer stretches to the office card's
                            height (that left a tall empty message box), and stays in view
                            beside it while the office details scroll. */}
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:gap-5">
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

                            <div className="relative">
                                <div className="absolute top-4 left-4 flex items-start pointer-events-none">
                                    <MessageSquare size={18} className="text-gray-400" />
                                </div>
                                <textarea
                                    placeholder={formCard?.messagePlaceholder || 'Your Message'} rows={6} value={form.message}
                                    onChange={e => setForm({ ...form, message: e.target.value })}
                                    className={`${inputClass} resize-y min-h-[10rem]`}
                                />
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit" disabled={sending}
                                    className="bg-brand-900 hover:bg-brand-900 text-white px-6 sm:px-9 py-3.5 sm:py-4 rounded-xl text-[1.25rem]
                                               font-semibold transition-all inline-flex w-full sm:w-auto justify-center items-center gap-2 shadow-lg
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

                            {/* The editor's own rows on the form card, in the
                                form's own type. */}
                            <div className="text-[1.0625rem] font-medium leading-relaxed text-gray-600">
                                <CmsExtraFields fields={formFields} variant="list" className="pt-2" />
                            </div>
                        </form>
                    </Reveal>

                    {/* Details */}
                    {hasInfoCard && (
                        <Reveal
                            variant="right"
                            delay={120}
                            className="bg-white rounded-[2rem] border border-brand-100/70
                                       shadow-[0_14px_46px_-16px_rgb(28_46_104/0.22)]
                                       p-4 sm:p-8 md:p-10 flex flex-col"
                        >

                            {(infoCard?.title || infoCard?.subtitle) && (
                                <div className="flex items-start gap-3 sm:gap-4 mb-6 sm:mb-10">
                                    <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-xl flex items-center
                                                    justify-center shrink-0">
                                        <CmsIcon name={infoCard.icon} size={24} fallback="users" />
                                    </div>
                                    <div>
                                        {infoCard.title && (
                                            <h3 className="text-[1.375rem] sm:text-[1.5625rem] font-extrabold tracking-tight text-[#111827]">
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

                            {offices.length > 1 && (
                                <div className="mb-6 sm:mb-8">
                                    <label className="block max-w-lg">
                                        <span className="mb-2 block text-sm font-semibold text-gray-600">Choose an office</span>
                                        <span className="relative block">
                                        <MapPin size={19} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-600" />
                                        <select
                                            value={office?.id || ''}
                                            onChange={(e) => { const o = offices.find((x) => x.id === e.target.value); if (o) chooseOffice(o); }}
                                            className="min-h-14 w-full appearance-none rounded-2xl border border-brand-100 bg-white py-3 pl-12 pr-11 text-base font-semibold text-brand-900 shadow-sm transition-shadow
                                                       hover:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2"
                                        >
                                            {offices.map((o) => (
                                                <option key={o.id} value={o.id}>
                                                    {officeName(o)}{o.isHeadOffice && o.state ? ` · ${o.state}` : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown size={20} aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-brand-600" />
                                        </span>
                                    </label>
                                </div>
                            )}

                            <div className="space-y-6 sm:space-y-8 pl-1">
                                {detail(
                                    offices.length > 1 && office ? officeName(office) : (infoCard?.addressLabel || ''),
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
                                        {[phone, alternatePhone].filter(Boolean).map((p, i) => (
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
                                        className="block py-3 -my-1.5 text-[1.125rem] font-semibold text-gray-700 break-all
                                                   hover:text-brand-600 transition-colors"
                                    >
                                        {email}
                                    </a>,
                                    !!email,
                                )}

                                {detail(
                                    'WhatsApp',
                                    <FaWhatsapp size={18} />,
                                    <a
                                        href={whatsappHref}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block py-3 -my-1.5 text-[1.125rem] font-semibold text-gray-700 hover:text-brand-600 transition-colors"
                                    >
                                        {whatsapp}
                                    </a>,
                                    !!whatsappHref,
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
                                {/* The Banner and Social cards each offered the
                                    control and had nothing drawing the answer —
                                    a field added to either was saved and never
                                    seen. Both are parts of this column. */}
                                <SectionFields proseClass={INFO_PROSE} sections={info?.sections} sectionKey="contact.banner" />
                                <SectionFields proseClass={INFO_PROSE} sections={info?.sections} sectionKey="contact.social" />
                                <CmsExtraFields
                                    fields={[...infoFields, ...(info?.extraFields || [])]}
                                    variant="list"
                                    className="pt-2"
                                />
                            </div>

                            {/*
                              THE MAP — the chosen office's. `mapEmbedUrl` is always a
                              frameable Google URL (the server turns a pasted share link,
                              embed code or address into one). If it cannot load, the
                              address and the buttons below still get the visitor there.
                            */}
                            {office && (office.mapEmbedUrl || office.mapLink) && (
                                <div className="mt-8">
                                    {office.mapEmbedUrl && !mapFailed ? (
                                        <div className="relative w-full overflow-hidden rounded-2xl border border-gray-100 bg-brand-50 aspect-[16/10]">
                                            {/* Until the frame reports in: a calm placeholder
                                                rather than a blank tile, gone the moment it loads. */}
                                            {!mapReady && (
                                                <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-brand-50 animate-pulse">
                                                    <MapPin size={28} className="text-brand-400" />
                                                    <span className="text-[0.9375rem] font-semibold text-brand-700/70">Loading map…</span>
                                                </div>
                                            )}
                                            {/* Eager, not lazy: the map is what this page is for,
                                                and `lazy` held the request back until the visitor
                                                had already scrolled to an empty box. The referrer
                                                policy is the one Google's own embed code carries. */}
                                            <iframe
                                                key={office.id}
                                                src={office.mapEmbedUrl}
                                                title={`Map — ${officeName(office)}${office.state ? `, ${office.state}` : ''}`}
                                                className={`absolute inset-0 h-full w-full border-0 transition-opacity duration-300 ${mapReady ? 'opacity-100' : 'opacity-0'}`}
                                                loading="eager"
                                                allowFullScreen
                                                referrerPolicy="strict-origin-when-cross-origin"
                                                onLoad={() => setMapReady(true)}
                                                onError={() => setMapFailed(true)}
                                            />
                                            {/* Tapping the map opens Google Maps directions FROM the
                                                visitor's current location to this office. */}
                                            <a
                                                href={office.directionsUrl
                                                    || `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addressLines.join(', '))}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                aria-label={`Directions to ${officeName(office)} from your location`}
                                                className="group absolute inset-0 z-10 flex items-end justify-center p-3"
                                            >
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-2 text-[0.9375rem]
                                                                 font-semibold text-brand-800 shadow-md ring-1 ring-brand-100 transition group-hover:bg-brand-900 group-hover:text-white">
                                                    <Navigation size={15} /> Tap for directions from your location
                                                </span>
                                            </a>
                                        </div>
                                    ) : (
                                        <div className="flex items-start gap-3 rounded-2xl border border-dashed border-brand-200 bg-brand-50/60 p-4">
                                            <MapPin size={18} className="mt-1 shrink-0 text-brand-600" />
                                            <p className="text-[1.0625rem] font-semibold text-gray-700">{addressLines.join(', ') || 'Location'}</p>
                                        </div>
                                    )}
                                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                        {office.mapLink && (
                                            <a
                                                href={office.mapLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-brand-200
                                                           bg-white px-4 text-[1.0625rem] font-semibold text-brand-700 hover:bg-brand-50 transition-colors"
                                            >
                                                <ExternalLink size={16} /> Open in Google Maps
                                            </a>
                                        )}
                                        {/* Directions start from the visitor's CURRENT location: a
                                            /maps/dir link with a destination and NO origin. Built from
                                            the address when the office carries no saved link. */}
                                        {(office.directionsUrl || addressLines.length > 0) && (
                                            <a
                                                href={office.directionsUrl
                                                    || `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addressLines.join(', '))}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-900 px-4
                                                           text-[1.0625rem] font-semibold text-white shadow-md hover:brightness-110 transition"
                                            >
                                                <Navigation size={16} /> Get directions
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* The association's social profiles — only those that are set. */}
                            <div className="mt-8 border-t border-dashed border-gray-200 pt-6 empty:hidden">
                                <SocialLinks />
                            </div>
                        </Reveal>
                    )}
                </div>

                {/* ---- the strip at the foot ---- */}
                {banner?.enabled && (banner.title || banner.ctaLabel) && (
                    /* A real card: the pale-grey strip sat on a pale-grey page and read as
                       faded. The brand navy -> blue gradient, like the site's other calls to action. */
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0b1f5c] via-[#1e3a8a] to-[#2563eb]
                                    p-5 sm:p-7 md:p-9 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6
                                    text-white shadow-[0_18px_44px_-18px_rgba(30,58,138,0.65)]">
                        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-sky-300/20 blur-3xl" />
                        <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-blue-400/20 blur-3xl" />
                        <div className="relative flex items-center gap-3 sm:gap-5 min-w-0">
                            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/15 text-white ring-1 ring-white/25 rounded-2xl flex items-center
                                            justify-center shrink-0">
                                <CmsIcon name={banner.icon} size={28} fallback="users" />
                            </div>
                            <div>
                                {banner.title && (
                                    <h3 className="text-[1.375rem] md:text-[1.75rem] font-bold text-white">{banner.title}</h3>
                                )}
                                {banner.subtitle && (
                                    <p className="text-[1.125rem] font-medium text-blue-100 mt-1">
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
                                        className="relative bg-white text-brand-900 hover:bg-blue-50 px-7 py-3.5 rounded-xl text-[1.25rem] text-center
                                                   font-bold transition-all hover:-translate-y-0.5 sm:whitespace-nowrap shrink-0 shadow-lg"
                                    >
                                        {banner.ctaLabel}
                                    </Link>
                                ) : (
                                    <a
                                        href={banner.ctaHref || '#'}
                                        className="relative bg-white text-brand-900 hover:bg-blue-50 px-7 py-3.5 rounded-xl text-[1.25rem] text-center
                                                   font-bold transition-all hover:-translate-y-0.5 sm:whitespace-nowrap shrink-0 shadow-lg"
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
