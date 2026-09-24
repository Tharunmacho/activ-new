import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
    ArrowLeft, ArrowRight, Calendar, MapPin, Check,
} from 'lucide-react';
import {
    getGalleryItem, getGallery, getGallerySettings,
    type GalleryItem, type GallerySettings,
} from '@/services/cmsApi';
import { HeaderSection } from '../../components/layout/HeaderSection';
import { FooterSection } from '../../components/layout/FooterSection';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import { CmsIcon } from '@/components/shared/CmsIcon';
import { SectionFields } from '@/components/shared/SectionFields';
import { SCREEN_CONTAINER } from '@/components/layout/pageContainer';
import { isNotFound } from '@/services/api';
import { SECTION_HEADING, SECTION_LEDE, EYEBROW, CARD_BODY, MICRO_LABEL } from '@/components/layout/typography';
import { Reveal } from '@/components/shared/Reveal';

/**
 * One gallery item, in full.
 *
 * This is where a poster goes when it is clicked — from the landing page's
 * strip or from the gallery grid, both of which link here by id. Everything on
 * it is authored in the CMS: the write-up, the bullet points, the extra
 * photographs and every label around them.
 *
 * TWO REQUESTS, DELIBERATELY. The item is fetched on its own so a deep link
 * works — somebody arriving from a shared URL has no list in memory — and the
 * list is fetched behind it only to fill the "more from the gallery" row. The
 * second is cached and shared with the gallery page, so navigating on from here
 * costs nothing.
 *
 * A MISSING ITEM IS NOT AN ERROR PAGE. Links outlive content: an item an
 * administrator deleted or hid leaves the visitor on a page that says so and
 * offers the gallery, rather than a 404 with nowhere to go.
 */
/** The side card's button, shared by its internal and external forms. */
const CTA_CLASS =
    'mt-6 w-full inline-flex items-center justify-center gap-2 bg-brand-800 hover:bg-brand-700 ' +
    'text-white px-6 py-3.5 rounded-full font-bold text-[1rem] uppercase tracking-[0.1em] transition-colors';

export default function GalleryDetailPage() {
    const { id } = useParams<{ id: string }>();

    const [item, setItem] = useState<GalleryItem | null>(null);
    const [related, setRelated] = useState<GalleryItem[]>([]);
    const [settings, setSettings] = useState<GallerySettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [missing, setMissing] = useState(false);
    /*
     * "GONE" AND "COULD NOT BE LOADED" ARE DIFFERENT ANSWERS.
     *
     * Every failure used to print "Not found", so a rate limit, a restarted
     * server or a dropped connection told the visitor their link was dead —
     * with nothing to press. A 404 is the only one that means the photograph
     * is gone; the rest are worth retrying, and now say so.
     */
    const [failed, setFailed] = useState(false);
    /** Bumped by "Try again", which is the whole of what a retry needs to be. */
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;

        setLoading(true);
        setMissing(false);
        setFailed(false);
        setItem(null);
        // Arriving from a card lower down the previous page would otherwise
        // open this one already scrolled past its own photograph.
        window.scrollTo({ top: 0, behavior: 'auto' });

        getGallerySettings()
            .then(config => { if (!cancelled) setSettings(config); })
            .catch(() => { /* the labels fall back to their defaults */ });

        getGalleryItem(String(id || ''))
            .then((found) => {
                if (cancelled) return;
                setItem(found);
                setLoading(false);
            })
            .catch((err) => {
                if (cancelled) return;
                if (isNotFound(err)) setMissing(true); else setFailed(true);
                setLoading(false);
            });

        // Only for the row at the foot of the page, so its failure is silent.
        getGallery()
            .then((list) => { if (!cancelled) setRelated(list || []); })
            .catch(() => { /* the row is simply not drawn */ });

        return () => { cancelled = true; };
    }, [id, reloadKey]);

    const copy = settings?.detail;
    const backLabel = copy?.backLabel || 'Back to Gallery';

    // ---------------------------------------------------------------- states

    if (loading) {
        return (
            <div className="flex flex-col min-h-screen font-sans dot-band">
                <HeaderSection />
                <div className={`${SCREEN_CONTAINER} py-20 animate-pulse flex-grow`}>
                    <div className="h-4 w-32 bg-slate-200 rounded mb-10" />
                    <div className="h-[22rem] md:h-[30rem] bg-slate-200 rounded-3xl mb-10" />
                    <div className="h-8 w-2/3 bg-slate-200 rounded mb-4" />
                    <div className="h-4 w-full bg-slate-200 rounded mb-2" />
                    <div className="h-4 w-5/6 bg-slate-200 rounded" />
                </div>
                <FooterSection />
            </div>
        );
    }

    if (failed) {
        return (
            <div className="flex flex-col min-h-screen font-sans dot-band">
                <HeaderSection />
                <div className={`${SCREEN_CONTAINER} py-24 flex-grow text-center`}>
                    <h1 className={`${SECTION_HEADING} text-brand-800 mb-4`}>
                        This photograph could not be loaded
                    </h1>
                    <p className={`${SECTION_LEDE} text-gray-500 mb-8`}>
                        The link is fine — the server did not answer. Please try again.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <button
                            type="button"
                            onClick={() => setReloadKey((n) => n + 1)}
                            className="inline-flex items-center gap-2 bg-brand-800 hover:bg-brand-700 text-white
                                       px-8 py-3.5 rounded-full font-bold text-[1rem] uppercase
                                       tracking-[0.1em] transition-colors"
                        >
                            Try again
                        </button>
                        <Link
                            to="/gallery"
                            className="inline-flex items-center gap-2 border border-brand-200 text-brand-700
                                       px-8 py-3.5 rounded-full font-bold text-[1rem] uppercase
                                       tracking-[0.1em] transition-colors hover:bg-brand-50"
                        >
                            <ArrowLeft size={15} /> {backLabel}
                        </Link>
                    </div>
                </div>
                <FooterSection />
            </div>
        );
    }

    if (missing || !item) {
        return (
            <div className="flex flex-col min-h-screen font-sans dot-band">
                <HeaderSection />
                <div className={`${SCREEN_CONTAINER} py-24 flex-grow text-center`}>
                    <h1 className={`${SECTION_HEADING} text-brand-800 mb-4`}>Not found</h1>
                    <p className={`${SECTION_LEDE} text-gray-500 mb-8`}>
                        {copy?.missingText || 'This item is no longer available.'}
                    </p>
                    <Link
                        to="/gallery"
                        className="inline-flex items-center gap-2 bg-brand-800 hover:bg-brand-700 text-white
                                   px-8 py-3.5 rounded-full font-bold text-[1rem] uppercase tracking-[0.1em]
                                   transition-colors"
                    >
                        <ArrowLeft size={15} /> {backLabel}
                    </Link>
                </div>
                <FooterSection />
            </div>
        );
    }

    // ---------------------------------------------------------------- content

    const highlights = (item.highlights || []).filter(Boolean);
    const photos = (item.photos || []).filter(p => p && p.url);
    /*
     * WHERE EACH PHOTOGRAPH SITS IN THE ALBUM.
     *
     * The album is the cover followed by the editor's extra photographs, so
     * the cover is 0 and the first extra one is 1. That is the number this
     * page puts in the links it builds and the number `GalleryPhotoPage`
     * reads back out of the address; both pages number it the same way, or a
     * link from here lands on a different picture there.
     *
     * This used to be a full `LightboxPhoto[]`, for a full-screen overlay
     * that opened above this page. The overlay is gone — a photograph has a
     * page of its own now — so all that survives of it is the offset.
     */
    const coverOffset = item.media?.url ? 1 : 0;
    const description = (item.description || '').trim();
    /*
     * The side card: what this schema knows, then what the editor named.
     *
     * The editor's own CARD fields sit in the same list as the built-in two,
     * because to a reader "Chief Guest" is exactly the same kind of fact as
     * "Location" — the difference is only which of them this codebase happened
     * to anticipate.
     *
     * They carry an ICON NOW, and it is the editor's. They used to carry none,
     * on the reasoning that a glyph cannot be guessed from a label somebody
     * typed — which is true, and the conclusion was wrong: this card draws a
     * ring beside every row, so a field without one got an empty circle rather
     * than no circle. The answer is to ask for the mark, not to leave a hole.
     *
     * A field the editor marked `content` is NOT here. It is a section of the
     * write-up; see `sections` below.
     */
    const custom = (item.customFields || []).filter(f => f && (f.label || f.value));
    const facts = [
        item.eventDate ? { icon: <Calendar size={16} />, label: 'Date', value: item.eventDate } : null,
        item.location ? { icon: <MapPin size={16} />, label: 'Location', value: item.location } : null,
        ...custom
            .filter(f => f.placement !== 'content')
            .map(f => ({
                icon: <CmsIcon name={f.icon} size={16} fallback="info" />,
                label: f.label || '—',
                value: f.value,
            })),
    ].filter(Boolean) as { icon: React.ReactNode; label: string; value: string }[];

    /* The editor's own SECTIONS — a named field they put in the body rather
       than in the card. Their label is the heading, their value is the prose. */
    const sections = custom.filter(f => f.placement === 'content' && String(f.value || '').trim());

    /* Same category first, then anything else — and never this item itself. */
    const others = (related || []).filter(r => r._id !== item._id);
    const sameCategory = item.category ? others.filter(r => r.category === item.category) : [];
    const moreFromGallery = [...sameCategory, ...others.filter(r => !sameCategory.includes(r))].slice(0, 4);

    return (
        <div className="flex flex-col min-h-screen font-sans dot-band">
            <HeaderSection />

            <main className="flex-grow">
                <section className="w-full pt-10 pb-16 md:pt-14 md:pb-24 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-brand-50/60 rounded-full blur-3xl transform-gpu
                                    -z-10 translate-x-1/3 -translate-y-1/3 transform-gpu pointer-events-none" />

                    <div className={`${SCREEN_CONTAINER} relative z-10`}>

                        <Link
                            to="/gallery"
                            className="inline-flex items-center gap-2 text-gray-500 hover:text-brand-700
                                       font-bold text-[1rem] uppercase tracking-[0.1em] transition-colors mb-8"
                        >
                            <ArrowLeft size={15} /> {backLabel}
                        </Link>

                        {/*
                          * ---- the poster ----
                          *
                          * ONE PICTURE, AND IT DOES NOT MOVE.
                          *
                          * It was briefly the album's own viewer — an arrow on
                          * each side stepping through the photographs in place.
                          * That was the wrong shape for this page: the frame is
                          * the event's cover, the thing the card promised, and a
                          * reader who has just arrived should meet it rather than
                          * a control.
                          *
                          * Looking at one photograph is a PAGE now, not a state
                          * of this one — `/gallery/:id/photo/:n`. Pressing this
                          * picture goes to photograph 0's page; pressing one in
                          * the row below goes to its own.
                          *
                          * A tall frame, because this is the one place the whole
                          * poster has to be readable. The fit is the editor's —
                          * `CmsMediaFrame` honours what they set — so an item
                          * stored as `contain` is shown whole here and the plate
                          * behind fills what it pads.
                          */}
                        <Reveal>
                            <div className="rounded-[1.75rem] overflow-hidden border border-brand-100/70 bg-gray-50
                                            shadow-[0_18px_60px_-24px_rgb(28_46_104/0.35)]">
                                {/*
                                  * The cover is photograph 0, and pressing it goes
                                  * to its page like every other photograph in the
                                  * album. One rule for the whole album rather than
                                  * an overlay for this one and a page for the rest.
                                  */}
                                <Link
                                    to={`/gallery/${item._id}/photo/0`}
                                    aria-label="Open this photograph"
                                    className="group relative block w-full h-[22rem] sm:h-[28rem] lg:h-[34rem]"
                                >
                                    <CmsMediaFrame media={item.media} priority width={1100} />
                                </Link>
                            </div>
                        </Reveal>

                        {/* ---- title and facts ---- */}
                        {/* `minmax(0, …)`: a bare `1.6fr` cannot shrink below
                            its own min-content — see the note on the same grid in
                            `GalleryPhotoPage`, where it collapsed the side card. */}
                        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-start">

                            <div>
                                {item.category && (
                                    <div className="inline-flex items-center space-x-2 bg-brand-50 text-brand-600 px-4 py-1.5
                                                    rounded-full mb-5 border border-brand-100">
                                        <span className={EYEBROW}>{item.category}</span>
                                    </div>
                                )}

                                {item.title && (
                                    <h1 className={`${SECTION_HEADING} text-brand-800 mb-5`}>{item.title}</h1>
                                )}

                                {item.caption && (
                                    <p className={`${SECTION_LEDE} text-gray-500 mb-8`}>{item.caption}</p>
                                )}

                                {description && (
                                    <div className="mb-8">
                                        {copy?.aboutHeading && (
                                            <h2 className="text-[1.375rem] font-black text-brand-800 mb-3">{copy.aboutHeading}</h2>
                                        )}
                                        {/*
                                          `whitespace-pre-line`, because the
                                          paragraph breaks an editor typed are
                                          the only structure this field has. The
                                          text is printed by React, so it is
                                          escaped — no markup is interpreted.
                                        */}
                                        <p className={`${CARD_BODY} text-gray-600 whitespace-pre-line`}>{description}</p>
                                    </div>
                                )}

                                {highlights.length > 0 && (
                                    <div className="mb-8">
                                        {copy?.highlightsHeading && (
                                            <h2 className="text-[1.375rem] font-black text-brand-800 mb-4">{copy.highlightsHeading}</h2>
                                        )}
                                        <ul className="space-y-3">
                                            {highlights.map((line, i) => (
                                                <li key={i} className="flex items-start gap-3">
                                                    <span className="mt-0.5 w-5 h-5 rounded-full bg-brand-50 text-brand-600
                                                                     flex items-center justify-center shrink-0">
                                                        <Check size={12} className="stroke-[3]" />
                                                    </span>
                                                    <span className={`${CARD_BODY} text-gray-600`}>{line}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            {/* ---- the side card ---- */}
                            {(facts.length > 0 || (copy?.ctaLabel && copy?.ctaHref)) && (
                                <aside className="rounded-[1.5rem] border border-brand-100/70 bg-[#fafbfc] p-6 sm:p-8
                                                  shadow-[0_10px_36px_-18px_rgb(28_46_104/0.25)] lg:sticky lg:top-28">
                                    {facts.map((fact, i) => (
                                        /* Keyed by position: two of the editor's
                                           own fields may share a label, and a
                                           duplicate key silently drops one. */
                                        <div key={`${fact.label}-${i}`} className="flex items-start gap-3 mb-5 last:mb-0">
                                            {/* An icon where there is one, and the same
                                                indent where there is not — otherwise the
                                                editor's fields hang out of the column the
                                                two built-in ones establish. */}
                                            <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0
                                                              ${fact.icon
                                                                ? 'bg-white border border-brand-100 text-brand-600'
                                                                : 'bg-brand-50/60'}`}>
                                                {fact.icon}
                                            </span>
                                            <div className="min-w-0">
                                                <p className={`${MICRO_LABEL} text-gray-400`}>{fact.label}</p>
                                                {/* `whitespace-pre-line`: an editor may put
                                                    three sponsors on three lines. */}
                                                <p className="text-[1.125rem] font-extrabold text-brand-800
                                                              break-words whitespace-pre-line">
                                                    {fact.value}
                                                </p>
                                            </div>
                                        </div>
                                    ))}

                                    {/*
                                      An external destination is an anchor, not a
                                      <Link>. Handing "https://…" to the router
                                      makes it a path on this site, so the button
                                      would navigate to a 404 on our own domain.
                                    */}
                                    {copy?.ctaLabel && copy?.ctaHref && (
                                        /^https?:\/\//i.test(copy.ctaHref) ? (
                                            <a
                                                href={copy.ctaHref}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={CTA_CLASS}
                                            >
                                                {copy.ctaLabel} <ArrowRight size={15} />
                                            </a>
                                        ) : (
                                            <Link to={copy.ctaHref} className={CTA_CLASS}>
                                                {copy.ctaLabel} <ArrowRight size={15} />
                                            </Link>
                                        )
                                    )}
                                </aside>
                            )}
                        </div>

                        {/*
                          * THE EDITOR'S OWN SECTIONS, under their own headings.
                          *
                          * Every named field used to land in the side card, so an
                          * editor with a paragraph to write had only a box built
                          * for one-line facts to put it in. A field marked
                          * `content` is a part of the page the association added,
                          * and it is set like "About this event" above it — the
                          * same kind of thing, differing only in who named it.
                          */}
                        {sections.map((field, i) => (
                            <section key={`${field.label}-${i}`} className="mt-12 border-t border-gray-100 pt-10">
                                {field.label && (
                                    <h2 className="mb-4 text-[1.5rem] font-black tracking-tight text-brand-900">
                                        {field.label}
                                    </h2>
                                )}
                                <div className="max-w-[62rem] space-y-5">
                                    {String(field.value).split(/\n{2,}/).map((para, j) => (
                                        <p
                                            key={j}
                                            className="text-[1.125rem] sm:text-[1.1875rem] leading-[1.75]
                                                       text-gray-700 whitespace-pre-line"
                                        >
                                            {para.trim()}
                                        </p>
                                    ))}
                                </div>
                            </section>
                        ))}

                        {/*
                          * The "Photograph page" card's own rows, on the page
                          * that card is about.
                          *
                          * They were never drawn anywhere. The gallery GRID
                          * pooled `gallery.detail`'s rows with its own and
                          * printed them under the grid — on the page that
                          * merely links here — so a field an editor added to
                          * the card headed "the page a visitor lands on after
                          * clicking a photograph" appeared on every page
                          * except that one.
                          */}
                        <SectionFields
                            proseClass={`${CARD_BODY} text-gray-600`}
                            sections={settings?.sections}
                            sectionKey="gallery.detail"
                            className="mt-12"
                        />

                        {/*
                          * ---- the rest of the photographs ----
                          *
                          * Every one of these is a LINK to that photograph's own
                          * page. It has been three things in turn — an overlay,
                          * then a control driving the frame above — and both
                          * shared one fault: there was no address for a
                          * photograph, so there was nothing to send anybody and
                          * no way to arrive at one from outside.
                          *
                          * Nothing is ringed any more. Nothing on this page is
                          * showing one of these; pressing one leaves for its page.
                          */}
                        {photos.length > 0 && (
                            <div className="mt-16">
                                {copy?.photosHeading && (
                                    <h2 className="text-[1.5625rem] font-black text-brand-800 mb-6">{copy.photosHeading}</h2>
                                )}
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                                    {photos.map((photo, i) => (
                                        <Reveal key={i} delay={Math.min(i % 3, 2) * 80}>
                                            {/*
                                              * A LINK TO THAT PHOTOGRAPH'S OWN PAGE,
                                              * not a button that opens an overlay.
                                              *
                                              * An overlay had nothing to send
                                              * anybody: no address, no back button
                                              * that meant anything, and no way to
                                              * arrive at one photograph from
                                              * outside. A captioned photograph is a
                                              * record with its own description and
                                              * its own place in the album, so it
                                              * gets a page — laid out the way this
                                              * one is. See `GalleryPhotoPage`.
                                              *
                                              * `+ coverOffset` because the cover is
                                              * photograph 0 of the album and these
                                              * are the ones after it. Both pages
                                              * number the album the same way, or a
                                              * link from here lands on a different
                                              * picture there.
                                              */}
                                            <Link
                                                to={`/gallery/${item._id}/photo/${i + coverOffset}`}
                                                className="group block w-full text-left"
                                                aria-label={photo.title || photo.caption
                                                    ? `Open: ${photo.title || photo.caption}`
                                                    : `Open photograph ${i + 1}`}
                                            >
                                                <div className="rounded-2xl overflow-hidden bg-gray-50 border border-brand-100/70
                                                                h-44 sm:h-56 shadow-[0_10px_30px_-16px_rgb(28_46_104/0.3)]
                                                                transition group-hover:shadow-[0_18px_40px_-16px_rgb(28_46_104/0.45)]">
                                                    <CmsMediaFrame media={photo} width={420} />
                                                </div>
                                                {/* Its NAME where it has one — the
                                                    description belongs on its own
                                                    page, which this opens. */}
                                                {(photo.title || photo.caption) && (
                                                    <p className="mt-2 px-1 text-[1rem] font-semibold leading-snug
                                                                  text-gray-700 line-clamp-2">
                                                        {photo.title || photo.caption}
                                                    </p>
                                                )}
                                            </Link>
                                        </Reveal>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ---- more from the gallery ----
                            Pulled up when the item carries no write-up: the left
                            column is then a title and nothing else, and the full
                            spacing leaves a band of empty page under it. */}
                        {moreFromGallery.length > 0 && (
                            <div className={`${description || highlights.length || photos.length ? 'mt-20 pt-12' : 'mt-10 pt-10'}
                                             border-t border-gray-100`}>
                                {copy?.relatedHeading && (
                                    <h2 className="text-[1.5625rem] font-black text-brand-800 mb-6">{copy.relatedHeading}</h2>
                                )}
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                                    {moreFromGallery.map(other => (
                                        <Link
                                            key={other._id}
                                            to={`/gallery/${other._id}`}
                                            className="group block rounded-2xl overflow-hidden bg-white border border-brand-100/70
                                                       shadow-[0_10px_30px_-16px_rgb(28_46_104/0.25)]
                                                       hover:shadow-[0_22px_48px_-20px_rgb(28_46_104/0.4)]
                                                       transition-shadow duration-500"
                                        >
                                            <div className="w-full h-40 overflow-hidden bg-gray-50">
                                                <CmsMediaFrame
                                                    media={other.media}
                                                    width={340}
                                                    className="group-hover:scale-105 transition-transform duration-700 transform-gpu"
                                                />
                                            </div>
                                            <div className="p-4">
                                                <p className="text-[1rem] font-extrabold text-brand-800 line-clamp-2
                                                              group-hover:text-brand-600 transition-colors">
                                                    {other.title || 'Untitled'}
                                                </p>
                                                {other.eventDate && (
                                                    <p className={`${MICRO_LABEL} text-gray-400 mt-2`}>{other.eventDate}</p>
                                                )}
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </main>

            <FooterSection />
        </div>
    );
}
