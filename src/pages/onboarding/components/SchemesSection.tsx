import { CmsExtraFields } from '@/components/shared/CmsExtraFields';
import { ArrowUpRight, Download } from 'lucide-react';
import { Reveal } from '@/components/shared/Reveal';
import { CmsIcon } from '@/components/shared/CmsIcon';
import { CARD_BODY, META_TEXT } from '@/components/layout/appTypography';
import type { Scheme, SchemeGroups } from '@/services/cmsNewsApi';

/**
 * ============================================================================
 * SCHEMES, IN THREE TIERS — national, state, district
 * ============================================================================
 *
 * The question a member asks here is not "what is new" but "which of these
 * apply to ME", and that is a question about where they are. So the tier is
 * the organising idea and it is visible: three labelled bands, in the order
 * they narrow, so a reader can stop reading as soon as they are past their own
 * level.
 *
 * NOT TABS. A tab hides two thirds of the answer behind a control, and the
 * national schemes apply to somebody in a district as much as the district's
 * own do — they are not alternatives to one another. Three bands down the
 * page, all of them readable, is the shape that says so.
 *
 * A tier with nothing in it is DRAWN, with a line saying so, rather than
 * silently dropped. An association that has published nothing for districts
 * yet has told the reader something true; a page that renders two bands where
 * another reader saw three is a page whose structure changes under them.
 */

const TIERS: { key: keyof SchemeGroups; label: string; note: string }[] = [
    {
        key: 'national',
        label: 'National schemes',
        note: 'Open to every member of the association, wherever they are.',
    },
    {
        key: 'state',
        label: 'State schemes',
        note: 'Run by a state council, for members in that state.',
    },
    {
        key: 'district',
        label: 'District schemes',
        note: 'Run by a district chapter, for members in that district.',
    },
];

function SchemeCard({ scheme }: { scheme: Scheme }) {
    /* Where it says the scheme belongs, when that is narrower than the tier. */
    const where = [scheme.district, scheme.state].filter(Boolean).join(', ');

    return (
        <article className="group flex h-full flex-col rounded-2xl border border-gray-200/80 bg-white
                            p-6 transition-all duration-300 hover:-translate-y-1
                            hover:border-brand-200
                            hover:shadow-[0_18px_40px_-20px_rgba(28,46,104,0.35)]">
            <div className="mb-4 flex items-start justify-between gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl
                                 bg-brand-50 text-brand-600">
                    <CmsIcon name={scheme.icon} size={20} fallback="file-text" />
                </span>

                {/* The closing date is the one fact that changes what a reader
                    does next, so it is the one thing beside the icon. */}
                {scheme.deadline && (
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-[0.9375rem] font-bold
                                     text-amber-700">
                        {scheme.deadline}
                    </span>
                )}
            </div>

            <h3 className="text-[1.25rem] font-extrabold leading-snug tracking-tight text-brand-900">
                {scheme.title || 'Untitled scheme'}
            </h3>

            {where && (
                <p className={`mt-1 ${META_TEXT} font-semibold text-brand-500`}>{where}</p>
            )}

            {scheme.summary && (
                <p className="mt-3 text-[1.0625rem] leading-relaxed text-gray-600 line-clamp-4">
                    {scheme.summary}
                </p>
            )}

            {scheme.eligibility && (
                <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-[1rem] leading-relaxed
                              text-gray-600">
                    <span className="font-bold text-gray-700">Who it is for: </span>
                    {scheme.eligibility}
                </p>
            )}

            {/* Whatever the department calls the things this scheme has that
               the card has no column for — a circular number, a subsidy
               rate. Above the actions, because they are part of reading it. */}
            <CmsExtraFields
                fields={scheme.extraFields}
                variant="list"
                className="mt-3"
            />

            <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 pt-5">
                {scheme.applyUrl && (
                    <a
                        href={scheme.applyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[1.0625rem] font-bold
                                   text-brand-700 transition-colors hover:text-brand-900"
                    >
                        Apply <ArrowUpRight size={15} className="shrink-0" />
                    </a>
                )}
                {scheme.documentUrl && (
                    <a
                        href={scheme.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[1.0625rem] font-semibold
                                   text-gray-500 transition-colors hover:text-brand-700"
                    >
                        <Download size={15} className="shrink-0" /> Notification
                    </a>
                )}
                {scheme.authority && (
                    <span className={`${META_TEXT} ml-auto text-gray-400`}>{scheme.authority}</span>
                )}
            </div>
        </article>
    );
}

export function SchemesSection({ groups, heading, description }: {
    groups: SchemeGroups;
    heading?: string;
    description?: string;
}) {
    const total = TIERS.reduce((n, t) => n + (groups[t.key] || []).length, 0);

    return (
        <section className="w-full bg-gray-50/70 py-16 md:py-24">
            <div className="mx-auto w-full max-w-[90rem] px-6 lg:px-10">
                <Reveal as="header" className="mb-12 text-center">
                    <p className="text-[1.0625rem] font-bold uppercase tracking-[0.18em]
                                  text-brand-500">
                        Member benefits
                    </p>
                    <h2 className="mt-1.5 text-[2.1875rem] sm:text-4xl md:text-5xl font-black
                                   leading-[1.08] tracking-tight text-brand-900">
                        {heading || 'Schemes & Benefits'}
                    </h2>
                    {description && (
                        <p className={`mx-auto mt-4 max-w-3xl ${CARD_BODY} text-gray-600`}>
                            {description}
                        </p>
                    )}
                    <span
                        aria-hidden="true"
                        className="mt-5 mx-auto block h-[3px] w-14 rounded-full bg-brand-700"
                    />
                </Reveal>

                {total === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6
                                    py-16 text-center">
                        <p className={`${CARD_BODY} text-gray-500`}>
                            No schemes have been published yet.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-14">
                        {TIERS.map((tier) => {
                            const rows = groups[tier.key] || [];
                            return (
                                <div key={tier.key}>
                                    <Reveal as="div" className="mb-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                                        <h3 className="text-[1.5625rem] font-black tracking-tight
                                                       text-brand-900">
                                            {tier.label}
                                        </h3>
                                        {/* No count beside the heading. It counted the
                                            cards printed directly underneath it, so it
                                            told a reader nothing they could not see —
                                            and it read as part of the heading, "National
                                            schemes 4". An empty tier still says so in
                                            words below, which is the only thing the
                                            number was answering. */}
                                        <p className={`${META_TEXT} text-gray-500`}>{tier.note}</p>
                                    </Reveal>

                                    {rows.length ? (
                                        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                                            {rows.map((scheme, i) => (
                                                <Reveal key={scheme.id || i} delay={Math.min(i, 5) * 60}>
                                                    <SchemeCard scheme={scheme} />
                                                </Reveal>
                                            ))}
                                        </div>
                                    ) : (
                                        /* Said plainly. See the note at the head of this file. */
                                        <p className={`rounded-xl border border-dashed border-gray-300
                                                       bg-white px-5 py-6 ${CARD_BODY} text-gray-400`}
                                        >
                                            Nothing published at this level yet.
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
}

export default SchemesSection;
