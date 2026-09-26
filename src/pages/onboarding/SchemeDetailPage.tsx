import { publicUrl, shareLink } from '@/lib/share';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, ArrowRight, ArrowUpRight, Building2, CalendarClock, CheckCircle2, Download,
    Globe, MapPin, Phone, Share2, Users,
} from 'lucide-react';
import { HeaderSection } from '../../components/layout/HeaderSection';
import { FooterSection } from '../../components/layout/FooterSection';
import { CmsIcon } from '@/components/shared/CmsIcon';
import { Reveal } from '@/components/shared/Reveal';
import { sizedMediaUrl } from '@/config/api.config';
import { CARD_BODY, META_TEXT } from '@/components/layout/appTypography';
import { getScheme, getSchemes, type SchemeRecord } from '@/services/cmsSchemesApi';
import { SCHEME_COLUMN, SchemeCard, externalHref, schemeWhere, slugifyRegion } from './components/SchemeUI';

/**
 * ============================================================================
 * ONE SCHEME — `/schemes/view/:slug`, where "View more" lands
 * ============================================================================
 *
 *   ← Back to Central schemes
 *
 *   [badge] Title                               |  Side card (sticky)
 *   summary                                     |   status, run by, where,
 *   [ level ][ run by ][ status ][ category ]   |   helpline, official site,
 *   About · Benefits · Who can apply ·          |   notification, share,
 *                                               |   Click to apply (last)
 *   How to apply · Documents · More details     |
 *
 *   More schemes like this — three cards from the same list
 *
 * ONE apply button, in the side card. It is sticky on a desktop and sits
 * under the title on a phone, so it is always in reach; a second copy at the
 * foot of the page was the same link twice.
 *
 * NOTHING EMPTY IS DRAWN. A section, a fact tile or the apply button appears
 * only when the editor filled it in; the page closes up around what is
 * missing rather than printing a heading over nothing, a dash, or a sentence
 * apologising for a link that has not been published. What the reader sees
 * is exactly what the editor wrote.
 */

const PARAGRAPH = 'text-[1.125rem] sm:text-[1.1875rem] leading-[1.75] text-gray-700';

const paragraphs = (text?: string) => String(text || '')
    .split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

const lines = (text?: string) => String(text || '')
    .split(/\n+/).map((p) => p.replace(/^\s*(\d+[.)]|[-•*])\s*/, '').trim()).filter(Boolean);

const hostOf = (url: string) => {
    try { return url ? new URL(url).hostname.replace(/^www\./, '') : ''; } catch { return ''; }
};

const TIER_LABEL: Record<string, string> = { national: 'Central', state: 'State', district: 'District' };

/**
 * One band of the scheme.
 *
 * An EMPTY title draws no heading at all — not an empty `h2`, which is a
 * 24px gap where a heading should be and reads as a section that failed to
 * load. The custom fields below can arrive with a value and no title, and a
 * heading is the one thing this page must not invent for them.
 */
function Block({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
    return (
        <section id={id} className="scroll-mt-28 border-t border-gray-100 pt-8 first:border-t-0 first:pt-0">
            {String(title || '').trim() && (
                <h2 className="mb-4 text-[1.5rem] font-black tracking-tight text-brand-900">{title}</h2>
            )}
            {children}
        </section>
    );
}

export default function SchemeDetailPage() {
    const { slug = '' } = useParams();
    const navigate = useNavigate();
    const [scheme, setScheme] = useState<SchemeRecord | null>(null);
    const [related, setRelated] = useState<SchemeRecord[]>([]);
    const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

    useEffect(() => {
        let cancelled = false;
        setState('loading');
        setRelated([]);
        getScheme(slug)
            .then((row) => {
                if (cancelled) return;
                if (!row) { setState('missing'); return; }
                setScheme(row);
                setState('ready');
                /* More from the same list: central with central, a state's with that state's. */
                const list = row.tier === 'national' ? getSchemes({ tier: 'national' }) : getSchemes({ state: row.state });
                list.then((rows) => {
                    if (!cancelled) setRelated((rows || []).filter((r) => r.id !== row.id).slice(0, 3));
                }).catch(() => {});
            })
            .catch(() => { if (!cancelled) setState('missing'); });
        return () => { cancelled = true; };
    }, [slug]);

    // One share behaviour site-wide — see lib/share.
    const share = () => shareLink({ title: scheme?.title, url: publicUrl(window.location.pathname) });

    const apply = externalHref(scheme?.applyUrl);
    const docUrl = externalHref(scheme?.documentUrl);
    const applyHost = hostOf(apply);

    /* The list this scheme belongs to — where the back button and the breadcrumb go. */
    const parent = useMemo(() => {
        if (!scheme || scheme.tier === 'national' || !scheme.state) {
            return { label: 'Central schemes', to: '/schemes/central' };
        }
        return { label: `${scheme.state} schemes`, to: `/schemes/state/${slugifyRegion(scheme.state)}` };
    }, [scheme]);

    /* Back to wherever the reader came from when that was on this site; to
       the scheme's own list when the page was opened directly. */
    const goBack = () => {
        const cameFromSite = (window.history.state?.idx ?? 0) > 0;
        if (cameFromSite) navigate(-1); else navigate(parent.to);
    };

    /* The editor's own fields, split by where they said each one goes. */
    const ownFacts = (scheme?.extraFields || [])
        .filter((f) => f && f.placement !== 'content' && (f.label || f.value));

    const steps = lines(scheme?.howToApply);
    const docs = (scheme?.documentsRequired || []).filter(Boolean);
    const about = paragraphs(scheme?.body);
    const benefits = paragraphs(scheme?.benefits);

    /*
     * ======================================================================
     * THE FACTS ARE IN ONE PLACE, AND IT IS THE CARD
     * ======================================================================
     *
     * A row of five tiles used to sit under the summary: Scheme level,
     * Where, Run by, Status, Category. Every one of them was already on the
     * screen — Where, Run by and Status in the glance card a few
     * centimetres to the right, Scheme level and Category as the two pills
     * above the title. Nothing in the row was new.
     *
     * What it cost was not only repetition. Five tiles across an eight-column
     * measure are ~150px wide, so "Scheme level" broke over two lines, a
     * one-word authority broke mid-word, and the reader met the same date
     * three times before the first sentence of the scheme. Deleting the row
     * is what makes the page read.
     *
     * The card is the one that stayed because it is the one that is STICKY
     * and carries the apply button: the facts a reader checks and the step
     * they take once they have belong together.
     */

    return (
        <div className="flex min-h-screen flex-col bg-white font-sans">
            <HeaderSection />

            <main className="flex-grow">
                {/* ------------------------------------------ back + breadcrumb */}
                <div className={`${SCHEME_COLUMN} flex flex-wrap items-center gap-x-5 gap-y-3 pt-8`}>
                    <button
                        type="button"
                        onClick={goBack}
                        className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2
                                   text-[1.0625rem] font-bold text-brand-700 transition-colors hover:border-brand-200
                                   hover:bg-brand-50"
                    >
                        <ArrowLeft size={16} /> Back
                    </button>
                    <nav aria-label="Breadcrumb" className={`${META_TEXT} text-gray-500`}>
                        <Link to={parent.to} className="font-semibold text-brand-700 hover:text-brand-900">{parent.label}</Link>
                        {scheme?.title && <span className="mx-2 text-gray-300">/</span>}
                        {scheme?.title && <span className="font-semibold text-gray-700">{scheme.title}</span>}
                    </nav>
                </div>

                {state === 'loading' && (
                    <div className={`${SCHEME_COLUMN} grid gap-8 py-10 lg:grid-cols-12`}>
                        <div className="space-y-4 lg:col-span-8">
                            <div className="h-10 w-2/3 animate-pulse rounded bg-gray-100" />
                            {[1, 2, 3, 4].map((i) => <div key={i} className="h-5 animate-pulse rounded bg-gray-100" />)}
                        </div>
                        <div className="h-64 animate-pulse rounded-2xl bg-gray-100 lg:col-span-4" />
                    </div>
                )}

                {state === 'missing' && (
                    <div className={`${SCHEME_COLUMN} py-20 text-center`}>
                        <h1 className="text-[2.1875rem] font-black tracking-tight text-brand-900">That scheme is not here</h1>
                        <p className={`mt-3 ${CARD_BODY} text-gray-500`}>
                            It may have been withdrawn, or the link may be out of date.
                        </p>
                        <Link to="/schemes/central"
                              className="mt-6 inline-flex rounded-full bg-brand-800 px-5 py-2.5 text-[1.0625rem] font-bold text-white hover:bg-brand-700">
                            Central schemes
                        </Link>
                    </div>
                )}

                {state === 'ready' && scheme && (
                    <>
                        {/*
                          * ONE GRID for the title, the Apply card and the content,
                          * so the card's top edge meets the headline's. DOM order —
                          * title, card, content — is also the phone order.
                          */}
                        <article className={`${SCHEME_COLUMN} grid gap-x-10 gap-y-8 pb-16 pt-6 lg:grid-cols-12`}>
                            {/* -------------------------------------------- header */}
                            <Reveal as="header" className="max-w-[62rem] lg:col-span-8">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-900 px-3 py-1
                                                     text-[0.9375rem] font-bold uppercase tracking-[0.12em] text-white">
                                        <CmsIcon name={scheme.tier === 'national' ? 'landmark' : 'map-pin'} size={13} fallback="landmark" />
                                        {TIER_LABEL[scheme.tier] || 'Central'}
                                    </span>
                                    {scheme.category && (
                                        <span className="rounded-full bg-brand-50 px-3 py-1 text-[0.9375rem] font-bold text-brand-700">
                                            {scheme.category}
                                        </span>
                                    )}
                                    {/*
                                      * The deadline pill stays although the card
                                      * also carries it, and this is the one
                                      * repetition worth keeping: on a phone the
                                      * card is BELOW the whole article, so
                                      * without it "when does this close" is a
                                      * scroll away. On a desktop the two sit at
                                      * the same height, which reads as emphasis
                                      * rather than as a second answer.
                                      */}
                                    {scheme.deadline && (
                                        <span className="rounded-full bg-amber-50 px-3 py-1 text-[0.9375rem] font-bold text-amber-700">
                                            {scheme.deadline}
                                        </span>
                                    )}
                                </div>

                                <h1 className="mt-4 text-[2rem] sm:text-[2.5rem] font-black leading-[1.12] tracking-tight text-brand-900">
                                    {scheme.title || 'Untitled scheme'}
                                </h1>

                                {scheme.summary && (
                                    <p className="mt-5 border-l-4 border-brand-200 pl-5 text-[1.1875rem] sm:text-[1.25rem]
                                                  font-semibold leading-relaxed text-gray-700">
                                        {scheme.summary}
                                    </p>
                                )}

                            </Reveal>

                            {/* ---------------------------------------- apply card */}
                            <aside className="lg:col-span-4 lg:col-start-9 lg:row-span-2 lg:row-start-1">
                                {/*
                                  * CAPPED AND PUSHED RIGHT.
                                  *
                                  * A third of the site's widest column is ~530px,
                                  * and this card is eight short facts and two
                                  * buttons — stretched to 530px the labels sit on
                                  * one side of an empty band and their values on
                                  * the other, and the apply button reads as a
                                  * banner. `ml-auto` keeps it on the page's right
                                  * edge, in line with the footer above it, rather
                                  * than floating in the middle of its column.
                                  */}
                                <div className="ml-auto max-w-[27rem] rounded-2xl border border-gray-200 bg-white p-6
                                                shadow-[0_18px_40px_-28px_rgba(28,46,104,0.45)] lg:sticky lg:top-28">
                                    <p className="mb-4 text-[0.9375rem] font-bold uppercase tracking-[0.14em] text-brand-500">
                                        Scheme at a glance
                                    </p>
                                    <dl className="space-y-4">
                                        {scheme.deadline && <Fact icon={<CalendarClock size={17} />} label="Status" value={scheme.deadline} />}
                                        {scheme.authority && <Fact icon={<Building2 size={17} />} label="Run by" value={scheme.authority} />}
                                        <Fact icon={<MapPin size={17} />} label="Where" value={schemeWhere(scheme)} />
                                        {scheme.helpline && <Fact icon={<Phone size={17} />} label="Helpline" value={scheme.helpline} />}
                                        {applyHost && <Fact icon={<Globe size={17} />} label="Official website" value={applyHost} />}

                                        {/* The editor's own facts, under the
                                            labels and the marks they chose. */}
                                        {ownFacts.map((field, i) => (
                                            <Fact
                                                key={`${field.label}-${i}`}
                                                icon={<CmsIcon name={field.icon} size={17} fallback="info" />}
                                                label={field.label || '—'}
                                                value={field.value}
                                            />
                                        ))}
                                    </dl>

                                    <div className="mt-6 grid gap-2.5">
                                        {docUrl && (
                                            <a href={docUrl} target="_blank" rel="noopener noreferrer"
                                               className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5
                                                          text-[1.0625rem] font-bold text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-50">
                                                <Download size={16} /> Notification / guidelines
                                            </a>
                                        )}
                                        <button type="button" onClick={share}
                                                className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5
                                                           text-[1.0625rem] font-bold text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-50">
                                            <Share2 size={16} /> Share this scheme
                                        </button>
                                    </div>

                                    {/* Click to apply LAST: the facts above are what a
                                        reader checks first, and this is the step they
                                        take once they have. No link, no button — and no
                                        sentence apologising for the missing link. */}
                                    {apply && (
                                        <div className="mt-6 border-t border-gray-100 pt-6">
                                            <a href={apply} target="_blank" rel="noopener noreferrer"
                                               className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-800 px-5 py-3.5
                                                          text-[1.125rem] font-bold text-white transition-colors hover:bg-brand-700">
                                                Click to apply <ArrowUpRight size={18} />
                                            </a>
                                            <p className={`mt-2 text-center ${META_TEXT} text-gray-400`}>
                                                Opens {applyHost || 'the official website'} in a new tab
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </aside>

                            {/*
                              * --------------------------------------- the scheme
                              *
                              * `max-w-[62rem]`: eight columns of the site's widest
                              * container is ~1,100px, and 1,100px of 19px text is
                              * about 150 characters a line — twice what anybody
                              * reads comfortably. The cap holds the measure without
                              * narrowing the page, which is the trade `SCREEN_CONTAINER`
                              * asks every prose caller to make.
                              */}
                            <div className="max-w-[62rem] space-y-8 lg:col-span-8">
                                {scheme.image?.url && (
                                    <div className="overflow-hidden rounded-2xl bg-brand-900/5">
                                        <img src={sizedMediaUrl(scheme.image.url, 1200)} alt={scheme.image.alt || scheme.title}
                                             className="aspect-[16/9] w-full object-cover" />
                                    </div>
                                )}

                                {about.length > 0 && (
                                    <Block title="About the scheme">
                                        <div className="space-y-5">
                                            {about.map((p, i) => (
                                                <p key={i} className={`${PARAGRAPH} whitespace-pre-line`}>{p}</p>
                                            ))}
                                        </div>
                                    </Block>
                                )}

                                {benefits.length > 0 && (
                                    <Block title="Benefits">
                                        <div className="space-y-4">
                                            {benefits.map((p, i) => (
                                                <p key={i} className={`${PARAGRAPH} whitespace-pre-line`}>{p}</p>
                                            ))}
                                        </div>
                                    </Block>
                                )}

                                {String(scheme.eligibility || '').trim() && (
                                    <Block title="Who can apply">
                                        <p className="flex gap-3 rounded-xl bg-brand-50/60 px-5 py-4 text-[1.125rem] leading-relaxed text-gray-700">
                                            <Users size={20} className="mt-0.5 shrink-0 text-brand-600" />
                                            <span className="whitespace-pre-line">{scheme.eligibility}</span>
                                        </p>
                                    </Block>
                                )}

                                {steps.length > 0 && (
                                    <Block title="How to apply">
                                        <ol className="space-y-3">
                                            {steps.map((step, i) => (
                                                <li key={i} className="flex gap-4">
                                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-800
                                                                     text-[1rem] font-bold text-white">
                                                        {i + 1}
                                                    </span>
                                                    <span className={`${PARAGRAPH} pt-0.5`}>{step}</span>
                                                </li>
                                            ))}
                                        </ol>
                                    </Block>
                                )}

                                {docs.length > 0 && (
                                    <Block title="Documents required">
                                        <ul className="grid gap-3 sm:grid-cols-2">
                                            {docs.map((doc, i) => (
                                                <li key={i} className="flex items-start gap-2.5 rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3">
                                                    <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                                                    <span className="text-[1.0625rem] leading-relaxed text-gray-700">{doc}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </Block>
                                )}

                                {/*
                                  * ==================================================
                                  * A FIELD AN EDITOR NAMED IS A SECTION THEY NAMED
                                  * ==================================================
                                  *
                                  * These were printed as a labelled list under a
                                  * fixed heading, "More details". The editor typed
                                  * "Sanctioned by" as the title of the thing they
                                  * were adding and the page answered with a heading
                                  * they had not written, with their own title
                                  * demoted to a grey caption underneath it — which
                                  * is the CMS overruling the one field on the form
                                  * whose entire purpose is that the association
                                  * decides what it says.
                                  *
                                  * Each one is its own section now, set exactly like
                                  * "About the scheme" and "Benefits" above it,
                                  * because that is what it is: a part of the page
                                  * the association added. Blank lines are kept, as
                                  * everywhere else an editor types prose.
                                  *
                                  * A value with no label still prints — the words
                                  * are the content and a missing title is no reason
                                  * to withhold them — it simply gets no heading,
                                  * since inventing one is the bug this fixes.
                                  */}
                                {(scheme.extraFields || [])
                                    /* Only the ones the editor put IN THE
                                       WRITE-UP. The rest are facts, and they
                                       belong in the glance card beside this
                                       column — see `ownFacts` above. A field
                                       written before the choice existed has no
                                       `placement`; the server serves those as
                                       `card`, which is where a scheme's named
                                       fields used to go before this page
                                       started printing them as sections. */
                                    .filter((f) => f && f.placement === 'content')
                                    .filter((f) => f && String(f.value || '').trim())
                                    .map((field, i) => (
                                        <Block key={`${field.label}-${i}`} title={String(field.label || '').trim()}>
                                            <div className="space-y-5">
                                                {paragraphs(field.value).map((p, j) => (
                                                    <p key={j} className={`${PARAGRAPH} whitespace-pre-line`}>{p}</p>
                                                ))}
                                            </div>
                                        </Block>
                                    ))}

                            </div>
                        </article>

                        {/* ------------------------------------------ related */}
                        {related.length > 0 && (
                            <section className="border-t border-gray-100 bg-gray-50/60 py-14">
                                <div className={SCHEME_COLUMN}>
                                    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                                        <h2 className="text-[1.75rem] font-black tracking-tight text-brand-900">More schemes like this</h2>
                                        <Link to={parent.to}
                                              className="inline-flex items-center gap-1.5 text-[1.0625rem] font-bold text-brand-700 hover:text-brand-900">
                                            All {parent.label.toLowerCase()} <ArrowRight size={15} />
                                        </Link>
                                    </div>
                                    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                                        {related.map((r) => <SchemeCard key={r.id} scheme={r} showWhere={r.tier === 'district'} />)}
                                    </div>
                                </div>
                            </section>
                        )}
                    </>
                )}
            </main>

            <FooterSection />
        </div>
    );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex gap-3">
            <span className="mt-0.5 shrink-0 text-brand-500">{icon}</span>
            <div className="min-w-0">
                <dt className="text-[0.9375rem] font-bold uppercase tracking-[0.1em] text-gray-400">{label}</dt>
                <dd className="mt-0.5 whitespace-pre-line break-words text-[1.0625rem] font-semibold text-gray-800">{value}</dd>
            </div>
        </div>
    );
}
