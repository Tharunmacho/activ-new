import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin } from 'lucide-react';
import { CmsIcon } from '@/components/shared/CmsIcon';
import { getGalleryItem, type GalleryItem } from '@/services/cmsApi';
import { HeaderSection } from '../../components/layout/HeaderSection';
import { FooterSection } from '../../components/layout/FooterSection';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import { SCREEN_CONTAINER } from '@/components/layout/pageContainer';
import { isNotFound } from '@/services/api';
import { EYEBROW, MICRO_LABEL } from '@/components/layout/typography';
import { Reveal } from '@/components/shared/Reveal';

/**
 * ============================================================================
 * ONE PHOTOGRAPH, ON A PAGE OF ITS OWN — `/gallery/:id/photo/:n`
 * ============================================================================
 *
 * A photograph used to be reachable only as an overlay above the album: it
 * opened, it closed, and there was nothing to link to, nothing to send
 * somebody, and no back button that meant anything. A photograph an
 * association has captioned is a thing with its own description, its own date
 * and its own place — the same shape of record as the album above it — so it
 * is a PAGE, laid out the way the album page is laid out.
 *
 *   ← Back to the album
 *   [ the photograph, large ]
 *   Category · what this photograph is    |  Date
 *   its description                       |  Location
 *                                         |  which album it belongs to
 *   ‹ Previous          Next ›
 *   The rest of the album — each one its own page
 *
 * -----------------------------------------------------------------------------
 * `n` INDEXES THE ALBUM, AND THE ALBUM INCLUDES THE COVER
 * -----------------------------------------------------------------------------
 *
 * The cover is photograph 0 and the editor's extra photographs follow it. That
 * is the same numbering `GalleryDetailPage` builds for the viewer and the same
 * one the row beneath it links with, so a number in the address means the same
 * photograph everywhere and there is no offset to keep in step.
 *
 * A number that is not a number, or is past the end, is a 404 rather than a
 * silent clamp to the first photograph: a stale link should say it is stale,
 * not quietly show somebody a different picture and let them believe it is the
 * one they were sent.
 */

export default function GalleryPhotoPage() {
    const { id = '', n = '0' } = useParams();

    const [item, setItem] = useState<GalleryItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [missing, setMissing] = useState(false);
    const [failed, setFailed] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setMissing(false);
        setFailed(false);
        setItem(null);
        /* A new photograph is a new page: the reader should meet it at the top,
           not half way down the album row they pressed it from. */
        window.scrollTo({ top: 0 });

        getGalleryItem(id)
            .then((row) => {
                if (cancelled) return;
                if (!row) setMissing(true); else setItem(row);
            })
            .catch((err) => {
                if (cancelled) return;
                /* A 404 is gone; anything else is worth retrying, and says so. */
                if (isNotFound(err)) setMissing(true); else setFailed(true);
            })
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [id, n, reloadKey]);

    const shell = (children: React.ReactNode) => (
        <div className="flex flex-col min-h-screen font-sans dot-band">
            <HeaderSection />
            <main className="flex-grow">
                <section className={`${SCREEN_CONTAINER} py-20 text-center`}>{children}</section>
            </main>
            <FooterSection />
        </div>
    );

    if (loading) {
        return shell(
            <div className="mx-auto max-w-3xl">
                <div className="h-[22rem] animate-pulse rounded-[1.75rem] bg-gray-100" />
                <div className="mx-auto mt-6 h-6 w-2/3 animate-pulse rounded bg-gray-100" />
            </div>,
        );
    }

    if (failed) {
        return shell(
            <>
                <h1 className="text-[2.1875rem] font-black tracking-tight text-brand-900">
                    This photograph could not be loaded
                </h1>
                <p className="mt-3 text-[1.1875rem] text-gray-500">
                    The link is fine — the server did not answer. Please try again.
                </p>
                <button
                    type="button"
                    onClick={() => setReloadKey((k) => k + 1)}
                    className="mt-6 inline-flex rounded-full bg-brand-800 px-5 py-2.5 text-[1.0625rem] font-bold text-white hover:bg-brand-700"
                >
                    Try again
                </button>
            </>,
        );
    }

    /*
     * THE ALBUM, BUILT EXACTLY AS THE ALBUM PAGE BUILDS IT.
     *
     * Cover first under the album's own caption, then each extra photograph
     * under its own. Both pages must agree about what photograph 3 is, or a
     * link from one lands on a different picture on the other.
     */
    const photos = (item?.photos || []).filter((p) => p && p.url);
    const album = item
        ? [
            /*
             * The cover is photograph 0, and what it is called is the ALBUM's
             * name: it is the picture chosen to stand for the whole event, so
             * that is the honest heading for it. Its description is the
             * album's caption.
             */
            ...(item.media?.url
                ? [{
                    media: item.media,
                    title: item.title || '',
                    caption: item.caption || '',
                    /* The cover's write-up is the ALBUM's: it is the picture
                       chosen to stand for the whole event, so the event's
                       write-up is the honest body for it. */
                    body: item.description || '',
                    fields: [] as { label: string; value: string; icon?: string; placement?: string }[],
                }]
                : []),
            ...photos.map((p) => ({
                media: p,
                title: p.title || '',
                caption: p.caption || '',
                body: p.description || '',
                fields: (p.customFields || []).filter((f) => f && (f.label || f.value)),
            })),
        ]
        : [];

    const index = Number(n);
    const valid = Number.isInteger(index) && index >= 0 && index < album.length;

    if (missing || !item || !valid) {
        return shell(
            <>
                <h1 className="text-[2.1875rem] font-black tracking-tight text-brand-900">
                    That photograph is not here
                </h1>
                <p className="mt-3 text-[1.1875rem] text-gray-500">
                    It may have been removed, or the link may be out of date.
                </p>
                <Link
                    to={item ? `/gallery/${id}` : '/gallery'}
                    className="mt-6 inline-flex rounded-full bg-brand-800 px-5 py-2.5 text-[1.0625rem] font-bold text-white hover:bg-brand-700"
                >
                    {item ? 'Back to the album' : 'The gallery'}
                </Link>
            </>,
        );
    }

    const current = album[index];

    /*
     * WHERE EACH NAMED FIELD GOES — the editor's answer, not a guess.
     *
     * `card` is a labelled fact beside the picture; `content` is a section of
     * its own in the body. A field written before the choice existed has no
     * `placement`, and the server serves those as `card`, which is where they
     * already appeared.
     */
    const cardFields = current.fields.filter((f) => f.placement !== 'content');
    const sections = current.fields.filter((f) => f.placement === 'content' && f.value.trim());

    /*
     * The facts belong to the EVENT, not to the photograph.
     *
     * A photograph has no date of its own on this schema and inventing one
     * would be a date nobody typed. What the side card answers is "when and
     * where was this taken", and the album is what knows — so it is labelled
     * with the album's name, and the album's name is a link back to it.
     */
    const facts = [
        item.eventDate ? { icon: <Calendar size={17} />, label: 'Date', value: item.eventDate } : null,
        item.location ? { icon: <MapPin size={17} />, label: 'Location', value: item.location } : null,
    ].filter(Boolean) as { icon: React.ReactNode; label: string; value: string }[];

    /* The others, each with the index it has in the album, so the links are
       right after the current one is filtered out of the row. */
    const rest = album
        .map((photo, i) => ({ photo, i }))
        .filter((row) => row.i !== index);

    return (
        <div className="flex flex-col min-h-screen font-sans dot-band">
            <HeaderSection />

            <main className="flex-grow">
                <section className="w-full pt-10 pb-16 md:pt-14 md:pb-24 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-brand-50/60 rounded-full blur-3xl
                                    -z-10 translate-x-1/3 -translate-y-1/3 transform-gpu pointer-events-none" />

                    <div className={`${SCREEN_CONTAINER} relative z-10`}>
                        <Link
                            to={`/gallery/${id}`}
                            className="inline-flex items-center gap-2 text-gray-500 hover:text-brand-700
                                       font-bold text-[1rem] uppercase tracking-[0.1em] transition-colors mb-8"
                        >
                            <ArrowLeft size={15} /> Back to {item.title || 'the album'}
                        </Link>

                        {/* ---- the photograph ---- */}
                        <Reveal>
                            <div className="rounded-[1.75rem] overflow-hidden border border-brand-100/70 bg-gray-50
                                            shadow-[0_18px_60px_-24px_rgb(28_46_104/0.35)]">
                                <div className="w-full h-[22rem] sm:h-[28rem] lg:h-[34rem]">
                                    <CmsMediaFrame media={current.media} priority width={1400} />
                                </div>
                            </div>
                        </Reveal>

                        {/* ---- what it is, and the event it belongs to ---- */}
                        {/*
                              * `minmax(0, …)` AND NOT A BARE `1.6fr`.
                              *
                              * A bare `1.6fr` is `minmax(auto, 1.6fr)`, so the
                              * column may not shrink below its own min-content
                              * — and the Previous/Next links in this column
                              * carry a whole caption each. Measured, the track
                              * came out 1392px against the side card's 209px,
                              * which squeezed "20 Jan 2024" onto two lines and
                              * read as a broken card rather than as a grid that
                              * had given up. `minmax(0, …)` lets the track take
                              * the share it was asked for and leaves the
                              * truncation to the `truncate` that is already on
                              * the captions.
                              */}
                        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-start">
                            <div>
                                {/*
                                  * NO "Photograph 2 of 6".
                                  *
                                  * It was a position in a list, printed above the
                                  * name of the thing — which is what the album's
                                  * row underneath shows, with the pictures, far
                                  * better than a number can. A reader wants to know
                                  * WHAT this photograph is, and the heading is
                                  * directly below.
                                  */}
                                {item.category && (
                                    <div className="mb-5 inline-flex items-center bg-brand-50 text-brand-600 px-4 py-1.5
                                                    rounded-full border border-brand-100">
                                        <span className={EYEBROW}>{item.category}</span>
                                    </div>
                                )}

                                {/*
                                  * THE NAME, AND THEN WHAT IT SAYS — two fields,
                                  * not one.
                                  *
                                  * The heading used to BE the description, so a
                                  * page whose editor had written one sentence
                                  * showed that sentence as a headline and then
                                  * had nothing left to print under it. It read as
                                  * a page that had failed to load its body.
                                  *
                                  * `title` is the heading; `caption` is the
                                  * paragraph. An album written before `title`
                                  * existed has only the caption, so that stands
                                  * in as the heading and the paragraph is then
                                  * omitted rather than printed twice.
                                  */}
                                <h1 className="text-[2rem] sm:text-[2.5rem] font-black leading-[1.12] tracking-tight text-brand-900">
                                    {current.title || current.caption || 'Untitled photograph'}
                                </h1>

                                {current.title && current.caption && (
                                    <p className="mt-5 text-[1.1875rem] sm:text-[1.25rem] leading-[1.75] text-gray-700
                                                  whitespace-pre-line">
                                        {current.caption}
                                    </p>
                                )}

                                {/*
                                  * "About this photograph" — the band the page was
                                  * missing, and the reason it read as a heading with
                                  * nothing under it. Same treatment as "About this
                                  * event" on the album page, blank lines and all:
                                  * an editor who typed three paragraphs meant three.
                                  */}
                                {current.body.trim() && (
                                    <section className="mt-8 border-t border-gray-100 pt-8">
                                        <h2 className="mb-4 text-[1.5rem] font-black tracking-tight text-brand-900">
                                            About this photograph
                                        </h2>
                                        <div className="space-y-5">
                                            {current.body.split(/\n{2,}/).map((para, i) => (
                                                <p
                                                    key={i}
                                                    className="text-[1.125rem] sm:text-[1.1875rem] leading-[1.75]
                                                               text-gray-700 whitespace-pre-line"
                                                >
                                                    {para.trim()}
                                                </p>
                                            ))}
                                        </div>
                                    </section>
                                )}

{/*
                                  * THE EDITOR'S OWN SECTIONS.
                                  *
                                  * A named field marked `content` is a part of
                                  * the page the association added: its label is
                                  * the heading and its value is the prose. Every
                                  * named field used to land in the side card, so
                                  * an editor with a paragraph to write had only a
                                  * box built for one-line facts to put it in.
                                  *
                                  * Set exactly like "About this photograph" above
                                  * — it is the same kind of thing, and the only
                                  * difference is who named it.
                                  */}
                                {sections.map((field, i) => (
                                    <section key={`${field.label}-${i}`} className="mt-8 border-t border-gray-100 pt-8">
                                        {field.label && (
                                            <h2 className="mb-4 text-[1.5rem] font-black tracking-tight text-brand-900">
                                                {field.label}
                                            </h2>
                                        )}
                                        <div className="space-y-5">
                                            {field.value.split(/\n{2,}/).map((para, j) => (
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

                                <p className="mt-8 text-[1.1875rem] text-gray-500">
                                    From{' '}
                                    <Link to={`/gallery/${id}`} className="font-bold text-brand-700 hover:text-brand-900">
                                        {item.title || 'this album'}
                                    </Link>
                                </p>

                                {/*
                                  * NO PREVIOUS / NEXT PAIR.
                                  *
                                  * It sat here as two cards carrying the
                                  * neighbouring captions, and it was one photograph
                                  * in each direction out of an album of six — while
                                  * "More from this album" directly below already
                                  * lists every one of them, with its picture. Two
                                  * ways to reach the next photograph, one of them
                                  * showing two of the options and the other showing
                                  * all of them, is a choice a reader has to make
                                  * before they can move.
                                  */}
                            </div>

                            {/* ---- the side card: this photograph, then the event ---- */}
                            {(cardFields.length > 0 || facts.length > 0) && (
                                <aside className="rounded-[1.5rem] border border-brand-100/70 bg-[#fafbfc] p-6 sm:p-8
                                                  shadow-[0_10px_36px_-18px_rgb(28_46_104/0.25)] lg:sticky lg:top-28">
                                    {/*
                                      * THIS PHOTOGRAPH'S OWN FIELDS COME FIRST, and
                                      * under the labels the editor typed.
                                      *
                                      * They are the most specific thing on the page
                                      * — the date and the place below them belong to
                                      * the whole event and repeat on every photograph
                                      * of it.
                                      */}
                                    {cardFields.map((field, i) => (
                                        /* Keyed by position: two fields may share a
                                           label, and a duplicate key drops one. */
                                        <div key={`${field.label}-${i}`} className="flex items-start gap-3 mb-5 last:mb-0">
                                            {/* The icon the EDITOR picked, in the same
                                                ring Date and Location sit in. It used
                                                to be an empty circle — the page drew
                                                the ring and had nothing to put in it,
                                                which is the gap that was reported.
                                                `info` is the fallback, so a field
                                                saved before the picker existed still
                                                gets a mark rather than a hole. */}
                                            <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0
                                                             bg-white border border-brand-100 text-brand-600">
                                                <CmsIcon name={field.icon} size={17} fallback="info" />
                                            </span>
                                            <div className="min-w-0">
                                                <p className={`${MICRO_LABEL} text-gray-400`}>{field.label}</p>
                                                <p className="text-[1.125rem] font-extrabold text-brand-800
                                                              break-words whitespace-pre-line">
                                                    {field.value}
                                                </p>
                                            </div>
                                        </div>
                                    ))}

                                    {/* A rule only where both halves exist — this
                                        photograph's facts above it, the event's
                                        below, and nothing to separate when there is
                                        only one of the two. */}
                                    {cardFields.length > 0 && facts.length > 0 && (
                                        <div className="my-5 border-t border-brand-100/70" />
                                    )}

                                    {facts.map((fact) => (
                                        <div key={fact.label} className="flex items-start gap-3 mb-5 last:mb-0">
                                            <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0
                                                             bg-white border border-brand-100 text-brand-600">
                                                {fact.icon}
                                            </span>
                                            <div className="min-w-0">
                                                <p className={`${MICRO_LABEL} text-gray-400`}>{fact.label}</p>
                                                <p className="text-[1.125rem] font-extrabold text-brand-800 break-words">
                                                    {fact.value}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </aside>
                            )}
                        </div>

                        {/* ---- the rest of the album ---- */}
                        {rest.length > 0 && (
                            <div className="mt-16">
                                <h2 className="text-[1.5625rem] font-black text-brand-800 mb-6">
                                    More from this album
                                </h2>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                                    {rest.map(({ photo, i }) => (
                                        <Reveal key={i} delay={Math.min(i % 3, 2) * 80}>
                                            <Link
                                                to={`/gallery/${id}/photo/${i}`}
                                                className="group block w-full text-left"
                                                aria-label={photo.title || photo.caption
                                                    ? `Open: ${photo.title || photo.caption}`
                                                    : `Open photograph ${i + 1}`}
                                            >
                                                <div className="rounded-2xl overflow-hidden bg-gray-50 border border-brand-100/70
                                                                h-44 sm:h-56 shadow-[0_10px_30px_-16px_rgb(28_46_104/0.3)]
                                                                transition group-hover:shadow-[0_18px_40px_-16px_rgb(28_46_104/0.45)]">
                                                    <CmsMediaFrame media={photo.media} width={420} />
                                                </div>
                                                {/* Its NAME, not its description — a
                                                    row of five paragraphs is a row
                                                    nobody reads. The description is
                                                    on the photograph's own page,
                                                    which this opens. */}
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
                    </div>
                </section>
            </main>

            <FooterSection />
        </div>
    );
}
