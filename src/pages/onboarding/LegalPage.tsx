import { useEffect, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';
import { CmsExtraFields } from '@/components/shared/CmsExtraFields';
import { HeaderSection } from '../../components/layout/HeaderSection';
import { FooterSection } from '../../components/layout/FooterSection';
import { SCREEN_CONTAINER } from '@/components/layout/pageContainer';
import {
    SECTION_HEADING, SECTION_LEDE, EYEBROW, MICRO_LABEL,
    PROSE_BODY, PROSE_HEADING,
} from '@/components/layout/typography';
import { Reveal } from '@/components/shared/Reveal';
import {
    getLegalDocument, getLegalLinks, type LegalDocument,
} from '@/services/cmsApi';

/**
 * One legal document — Privacy, Terms, Return, Cancellation, or a fifth the
 * Super Admin adds tomorrow.
 *
 * =========================================================================
 * THE TEXT COMES FROM THE CMS. THIS FILE CONTAINS NONE OF IT.
 * =========================================================================
 *
 * It used to be a TypeScript table compiled into the bundle. Two things were
 * wrong with that and only one of them was obvious: every wording change needed
 * a deploy, and — the one that matters — the browser held a copy that could
 * quietly disagree with what the server considered live. Now `/cms/legal/:slug`
 * is the only source, so an edit is on the public site at the next page load,
 * and adding a document is a row rather than a release.
 *
 * Version history moved WITH it. `web_legal_revisions` archives the previous
 * wording on every save, with the editor, the date and their note — which is
 * the question a CMS usually cannot answer about legal text and the reason this
 * was kept in code in the first place.
 *
 * =========================================================================
 * A FAILED LOAD RENDERS AN ERROR, NEVER A GUESS
 * =========================================================================
 *
 * Every other page on this site falls back to an empty shape when the CMS is
 * unreachable, and renders an unfinished page. That is right for a hero with no
 * headline. It is wrong here: a visitor cannot tell invented or stale terms
 * from real ones, and may act on them. So there is no fallback text anywhere in
 * this file, and an unreachable server produces a page that says so with a
 * retry — a different situation from a policy that does not exist, which is a
 * 404, and the two are worded differently because only one is worth retrying.
 *
 * ------------------------------------------------------------------ reading
 *
 * `max-w-3xl` on the prose column rather than the page's usual full width, and
 * `PROSE_BODY` rather than `CARD_BODY`. A legal document is read, not scanned:
 * 1280px at 16px is about 150 characters a line, roughly twice what anyone can
 * track back from. The typography note in `typography.ts` has the rest.
 */

const useSlug = (): string => {
    const { slug } = useParams<{ slug: string }>();
    const { pathname } = useLocation();
    // The literal-path form: `/privacy-policy` -> `privacy-policy`. Both are
    // routed, and the literal one is canonical — it is where a search engine
    // and a pasted link expect an association's Privacy Policy to be.
    const fromPath = pathname.replace(/^\/+|\/+$/g, '').split('/').pop() || '';
    return String(slug || fromPath);
};

/** "13 September 2026" — an effective date, when the editor gave one. */
const formatDate = (iso?: string | null): string => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

export default function LegalPage() {
    const slug = useSlug();
    const { pathname } = useLocation();

    const [doc, setDoc] = useState<LegalDocument | null>(null);
    const [links, setLinks] = useState<{ label: string; href: string }[]>([]);
    const [loading, setLoading] = useState(true);
    /** `'missing'` is a 404; `'failed'` is a server we could not reach. */
    const [problem, setProblem] = useState<'' | 'missing' | 'failed'>('');
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let cancelled = false;

        setLoading(true);
        setProblem('');
        setDoc(null);
        // Arriving from a footer link at the foot of a long page would otherwise
        // open this one already scrolled past its own heading.
        window.scrollTo({ top: 0, behavior: 'auto' });

        getLegalDocument(slug)
            .then((found) => {
                if (cancelled) return;
                setDoc(found);
                setLoading(false);
            })
            /* Typed to the one thing this reads. `any` here disables every
               check on the lines below it, on a path that only runs when
               something has already gone wrong. */
            .catch((error: { response?: { status?: number } } | null) => {
                if (cancelled) return;
                /*
                 * 404 and "could not reach the server" are different answers and
                 * get different pages. Collapsing them would tell somebody whose
                 * connection dropped that the association has no Privacy Policy.
                 */
                const status = error?.response?.status;
                setProblem(status === 404 ? 'missing' : 'failed');
                setLoading(false);
            });

        // The sidebar's other policies. Its failure is silent — the document is
        // the page, and a missing list of siblings is not worth an error state.
        getLegalLinks()
            .then((rows) => { if (!cancelled) setLinks(rows || []); })
            .catch(() => { /* the sidebar is simply not drawn */ });

        return () => { cancelled = true; };
    }, [slug, attempt]);

    useEffect(() => {
        if (doc?.title) document.title = `${doc.title} — ACTIV`;
    }, [doc?.title]);

    const shell = (children: React.ReactNode) => (
        <div className="flex flex-col min-h-screen font-sans dot-band">
            <HeaderSection />
            <main className="flex-grow">{children}</main>
            <FooterSection />
        </div>
    );

    /* ------------------------------------------------------------- loading */

    if (loading) {
        return shell(
            <div className={`${SCREEN_CONTAINER} py-20`}>
                <div className="max-w-3xl animate-pulse">
                    <div className="h-4 w-20 bg-slate-200 rounded mb-6" />
                    <div className="h-10 w-2/3 bg-slate-200 rounded mb-4" />
                    <div className="h-4 w-1/2 bg-slate-200 rounded mb-12" />
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-4 bg-slate-200 rounded mb-3" style={{ width: `${95 - i * 6}%` }} />
                    ))}
                </div>
            </div>,
        );
    }

    /* --------------------------------------------------- could not be read */

    if (problem === 'failed') {
        return shell(
            <div className={`${SCREEN_CONTAINER} py-24 text-center`}>
                <h1 className={`${SECTION_HEADING} text-brand-800 mb-4`}>This policy could not be loaded</h1>
                <p className={`${SECTION_LEDE} text-gray-500 mb-8 max-w-lg mx-auto`}>
                    We could not reach the server. Nothing is shown here rather than
                    something that might be out of date.
                </p>
                <button
                    type="button"
                    onClick={() => setAttempt((n) => n + 1)}
                    className="inline-flex items-center gap-2 bg-brand-800 hover:bg-brand-700 text-white
                               px-8 py-3.5 rounded-full font-bold text-[1rem] uppercase
                               tracking-[0.1em] transition-colors"
                >
                    <Loader2 size={15} /> Try again
                </button>
            </div>,
        );
    }

    if (problem === 'missing' || !doc) {
        return shell(
            <div className={`${SCREEN_CONTAINER} py-24 text-center`}>
                <h1 className={`${SECTION_HEADING} text-brand-800 mb-4`}>Not found</h1>
                <p className={`${SECTION_LEDE} text-gray-500 mb-8`}>That policy page does not exist.</p>
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 bg-brand-800 hover:bg-brand-700 text-white
                               px-8 py-3.5 rounded-full font-bold text-[1rem] uppercase
                               tracking-[0.1em] transition-colors"
                >
                    <ArrowLeft size={15} /> Back to home
                </Link>
            </div>,
        );
    }

    /* -------------------------------------------------------------- content */

    const effective = formatDate(doc.effectiveFrom);

    return shell(
        <>
            {/* ---- the title band ---- */}
            <div className="bg-brand-900 text-white">
                <div className={`${SCREEN_CONTAINER} py-14 md:py-20`}>
                    <Reveal>
                        <span className={`${EYEBROW} inline-block rounded-full bg-white/10 px-3.5 py-1.5
                                          text-white/80 mb-5`}>
                            Legal
                        </span>
                        <h1 className={`${SECTION_HEADING} mb-4`}>{doc.title || 'Policy'}</h1>
                        {doc.lede && (
                            <p className={`${SECTION_LEDE} text-white/70 max-w-2xl`}>{doc.lede}</p>
                        )}
                        {/*
                          Printed ONLY when the editor set one. A date invented
                          from `updatedAt` would say these terms took effect the
                          day somebody fixed a typo.
                        */}
                        {effective && (
                            <p className={`${MICRO_LABEL} text-white/50 mt-5`}>
                                In effect from {effective}
                            </p>
                        )}
                    </Reveal>
                </div>
            </div>

            <div className={`${SCREEN_CONTAINER} py-12 md:py-16`}>
                {/*
                  Capped and centred inside the page's full-width column. The
                  document keeps its reading measure, so on a 1920px display
                  the article and the policy rail would otherwise sit at
                  opposite ends of the screen with a lake of tint between them.
                */}
                <div className="mx-auto max-w-[72rem] lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-10">

                    {/* ---- the document ---- */}
                    {/* The prose keeps its 3xl measure — a policy is read, not
                        scanned — but it now sits on a white sheet, because the
                        page behind it is tinted like every other public screen
                        and unsheeted text on a tint reads as unfinished. */}
                    {/* FILLS ITS COLUMN. It was capped at `max-w-3xl` inside a
                        column half as wide again, so the sheet stopped a third
                        of the way across and left a band of tinted page between
                        it and the policy rail — which read as a layout fault
                        rather than as a reading measure. */}
                    <article className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-9 lg:p-12
                                        shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_30px_-12px_rgba(16,24,40,0.28)]">
                        {doc.sections.map((section, i) => (
                            <section key={`${section.heading || 'intro'}-${i}`} className="mb-9 last:mb-0">
                                {section.heading && (
                                    <h2 className={`${PROSE_HEADING} text-brand-800 mb-3 scroll-mt-28`}>
                                        {section.heading}
                                    </h2>
                                )}

                                {(section.body || []).map((paragraph, p) => (
                                    <p key={p} className={`${PROSE_BODY} text-gray-600 mb-3.5 last:mb-0`}>
                                        {paragraph}
                                    </p>
                                ))}

                                {!!(section.bullets || []).length && (
                                    <ul className="mt-3.5 space-y-2.5">
                                        {(section.bullets || []).map((item, b) => (
                                            <li key={b} className="flex gap-3">
                                                {/*
                                                  A drawn dot rather than `list-disc`. The browser's
                                                  marker sits on the first line's baseline and drifts
                                                  out of alignment as soon as an item wraps, which
                                                  most of these do.
                                                */}
                                                <span
                                                    aria-hidden="true"
                                                    className="mt-[0.5625rem] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400"
                                                />
                                                <span className={`${PROSE_BODY} text-gray-600`}>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                {!!(section.links || []).length && (
                                    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                                        {(section.links || []).map((link, l) => (
                                            link.href.startsWith('/')
                                                ? (
                                                    <Link
                                                        key={`${link.href}-${l}`}
                                                        to={link.href}
                                                        className="inline-flex items-center gap-1.5 text-brand-600
                                                                   hover:text-brand-800 text-[1.0625rem] font-bold
                                                                   transition-colors"
                                                    >
                                                        {link.label || link.href}
                                                    </Link>
                                                )
                                                : (
                                                    <a
                                                        key={`${link.href}-${l}`}
                                                        href={link.href}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1.5 text-brand-600
                                                                   hover:text-brand-800 text-[1.0625rem] font-bold
                                                                   transition-colors"
                                                    >
                                                        {link.label || link.href} <ExternalLink size={13} />
                                                    </a>
                                                )
                                        ))}
                                    </div>
                                )}
                            </section>
                        ))}

                        {/* A notice often carries one statutory line that is
                           not a clause — a governing law, a grievance officer,
                           a registered address. Printed after the sections and
                           before the “Questions” card. */}
                        <CmsExtraFields
                            fields={doc.extraFields}
                            variant="list"
                            className="mt-10 border-t border-slate-200 pt-8"
                        />

                        <div className="mt-12 rounded-2xl border border-brand-100 bg-brand-50/40 p-6">
                            <p className={`${MICRO_LABEL} text-gray-400 mb-1.5`}>Questions</p>
                            <p className={`${PROSE_BODY} text-gray-600`}>
                                If you need more information about this policy, write to{' '}
                                <a
                                    href="mailto:info@activ.org.in"
                                    className="font-bold text-brand-700 hover:text-brand-600 transition-colors"
                                >
                                    info@activ.org.in
                                </a>
                                .
                            </p>
                        </div>
                    </article>

                    {/* ---- the other policies, from the same CMS list ---- */}
                    {links.length > 1 && (
                        <aside className="mt-12 lg:mt-0">
                            <div className="lg:sticky lg:top-28 rounded-[1.25rem] border border-brand-100/70
                                            bg-[#fafbfc] p-5">
                                <p className={`${MICRO_LABEL} text-gray-400 mb-3`}>Policies</p>
                                <nav className="flex flex-col">
                                    {links.map((link) => {
                                        const current = pathname === link.href;
                                        return (
                                            <Link
                                                key={link.href}
                                                to={link.href}
                                                /*
                                                 * `aria-current`, not colour alone. The active item is
                                                 * distinguished by weight and a navy fill for a sighted
                                                 * reader, and a screen reader gets the same fact — which
                                                 * a background colour on its own does not carry.
                                                 */
                                                aria-current={current ? 'page' : undefined}
                                                className={
                                                    'rounded-xl px-3.5 py-2.5 text-[1.0625rem] transition-colors '
                                                    + (current
                                                        ? 'bg-brand-800 text-white font-extrabold'
                                                        : 'text-gray-600 font-bold hover:bg-white hover:text-brand-700')
                                                }
                                            >
                                                {link.label}
                                            </Link>
                                        );
                                    })}
                                </nav>
                            </div>
                        </aside>
                    )}
                </div>
            </div>
        </>,
    );
}
