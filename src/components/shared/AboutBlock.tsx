import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import { CmsIcon } from '@/components/shared/CmsIcon';
import { CmsExtraFields } from '@/components/shared/CmsExtraFields';
import { sectionHidden, sectionFields } from '@/components/shared/cmsSections';
import { CountUp } from '@/components/shared/CountUp';
import { Reveal } from '@/components/shared/Reveal';
import { Tilt3D } from '@/components/shared/Tilt3D';
import { MissionCarousel } from '@/components/shared/MissionCarousel';
import { sizedMediaUrl } from '@/config/api.config';
import type { CmsBullet, CmsMedia, CmsStat, CmsExtraField, CmsSectionOverride } from '@/services/cmsApi';
import { SCREEN_CONTAINER } from '@/components/layout/pageContainer';
import {
    SECTION_HEADING, SECTION_LEDE, EYEBROW, STAT_FIGURE, STAT_LABEL,
} from '@/components/layout/typography';

/**
 * The "About" split layout — copy on the left, media on the right, the mission
 * carousel across the full width beneath, and a figures bar at the foot.
 *
 * One component, two callers: the home page's About block and the dedicated
 * About page render exactly this, from two different CMS documents. They were
 * duplicated files before, which meant a fix to one silently left the other
 * behind.
 *
 * Every part is optional. A section with no bullets renders no carousel, and
 * one with no media renders no right-hand column and lets the copy use the full
 * width — an empty half is a layout hole, not absent content.
 *
 * The bullets moved OUT of the copy column and into `MissionCarousel`. Inside
 * the column they were five three-line entries stacked vertically, which pushed
 * the media beside them down by roughly 600px and left the last two below the
 * fold on a laptop. Across the full width, as a row that advances on its own,
 * the whole set is reachable without scrolling at all.
 */
/**
 * Column count for the figures bar, keyed by how many were authored.
 *
 * Spelled out rather than interpolated because Tailwind scans source text for
 * class names — a template literal like `lg:grid-cols-${n}` produces a class
 * that is never generated, and the row silently collapses to one column.
 */
const LG_COLUMNS: Record<number, string> = {
    0: '', 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3',
    4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6',
};

interface Props {
    badgeIcon?: string;
    badgeText?: string;
    heading?: string;
    headingHighlight?: string;
    /** Stored as HTML so an editor can bold a phrase mid-sentence. */
    body?: string;
    bullets?: CmsBullet[];
    media?: CmsMedia | null;
    logoOverlay?: CmsMedia | null;
    statsBar?: CmsStat[];
    /** The chairman’s words. Drawn first, above everything. */
    quote?: { text?: string; author?: string; role?: string; photo?: CmsMedia | null } | null;
    /** Fields the editor named themselves, under the figures bar. */
    extraFields?: CmsExtraField[];
    /**
     * Which of this block's parts the editor removed, and what they added
     * to each — see `cmsSections`.
     *
     * Passed IN rather than fetched here, because this block is rendered
     * from two different documents: the home page's About block and the
     * dedicated About page. They key their sections the same way and are
     * stored separately, so removing the badge on one must leave the other
     * alone. The caller knows which document it is holding; this does not.
     */
    sections?: CmsSectionOverride[];
}

export function AboutBlock({
    badgeIcon, badgeText, heading, headingHighlight,
    body, bullets = [], media, logoOverlay, statsBar = [], quote, extraFields = [],
    sections = [],
}: Props) {
    /* Each part answers to its own card on the CMS screen. */
    const showQuote = !sectionHidden(sections, 'about.quote');
    const showBadge = !sectionHidden(sections, 'about.badge');
    const showHeading = !sectionHidden(sections, 'about.heading');
    const showPoints = !sectionHidden(sections, 'about.points');
    const showImage = !sectionHidden(sections, 'about.image');
    const showStats = !sectionHidden(sections, 'about.statsBar');
    const hasMedia = showImage && !!media?.url;
    const hasCopy = !!((showBadge && badgeText) || (showHeading && (heading || headingHighlight || body)));

    const hasQuote = showQuote && !!(quote && String(quote.text || '').trim());

    const headingFields = showHeading ? sectionFields(sections, 'about.heading') : [];
    const pointsFields = showPoints ? sectionFields(sections, 'about.points') : [];
    const imageFields = showImage ? sectionFields(sections, 'about.image') : [];
    const statsFields = showStats ? sectionFields(sections, 'about.statsBar') : [];
    const badgeFields = showBadge ? sectionFields(sections, 'about.badge') : [];
    const quoteFields = hasQuote ? sectionFields(sections, 'about.quote') : [];

    const showBullets = showPoints && bullets.length > 0;
    const showStatsBar = showStats && statsBar.length > 0;

    if (!hasCopy && !hasMedia && !showBullets && !showStatsBar && !hasQuote
        && !extraFields.length && !badgeFields.length && !headingFields.length
        && !pointsFields.length && !imageFields.length && !statsFields.length
        && !quoteFields.length) return null;

    return (
        <section className="w-full py-20 dot-band flex flex-col items-center relative overflow-hidden font-sans">
            {/* Decorative only — no content, so it is not authored.
                `z-0`, not `-z-10`: a negative index puts this behind the
                section's own background colour, which is opaque, so the pattern
                was painted and then covered. The content above carries `z-10`. */}
            {/* The dot field is the PAGE's now (`.dot-band` in index.css),
                so this block no longer draws its own half-width copy at its own
                density on top of it — two grids at different pitches read as a
                printing fault. */}

            <div className={`${SCREEN_CONTAINER} relative z-10`}>

                <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-center">

                    {/* Copy — takes the full width when there is no media beside it. */}
                    {hasCopy && (
                        <Reveal variant="left" className={`w-full ${hasMedia ? 'lg:w-1/2' : ''}`}>

                            {showBadge && badgeText && (
                                <div className="inline-flex items-center space-x-2 bg-brand-50 text-brand-600 px-4 py-1.5
                                                rounded-full mb-6 border border-brand-100 shadow-sm">
                                    <CmsIcon name={badgeIcon} size={14} className="stroke-[3]" fallback="users" />
                                    <span className={EYEBROW}>{badgeText}</span>
                                </div>
                            )}

                            {showHeading && (heading || headingHighlight) && (
                                <h2 className={`${SECTION_HEADING} text-[#111827] mb-6`}>
                                    {heading}
                                    {heading && headingHighlight && <br />}
                                    {headingHighlight && <span className="text-brand-600">{headingHighlight}</span>}
                                </h2>
                            )}

                            {showHeading && body && (
                                // Authored HTML: the editor writes it, and only a
                                // signed-in super admin can. It is not visitor input.
                                <div
                                    className={`${SECTION_LEDE} text-gray-600
                                               [&_p]:mb-4 [&_p:last-child]:mb-0
                                               [&_strong]:text-brand-800 [&_strong]:font-extrabold`}
                                    dangerouslySetInnerHTML={{ __html: body }}
                                />
                            )}

                            {/* The editor's own rows on the badge and heading cards. */}
                            <CmsExtraFields
                                fields={[...badgeFields, ...headingFields]}
                                className="mt-10"
                            />
                        </Reveal>
                    )}

                    {/* Media */}
                    {hasMedia && (
                        <Reveal
                            variant="right"
                            delay={120}
                            className={`w-full ${hasCopy ? 'lg:w-1/2 lg:pl-8' : ''} relative`}
                        >
                            {/* Concentric rings, counter-rotating on two clocks. They
                                sit behind the frame and give the photograph something
                                to be in front of. */}
                            <div className="absolute -inset-10 z-0 hidden lg:block opacity-60 pointer-events-none">
                                <svg
                                    width="100%" height="100%" viewBox="0 0 500 500" fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="animate-activ-orbit origin-center"
                                >
                                    <circle cx="250" cy="250" r="150" className="stroke-brand-300" strokeWidth="1" />
                                    <circle cx="250" cy="250" r="210" className="stroke-brand-300" strokeWidth="1" />
                                </svg>
                                <svg
                                    width="100%" height="100%" viewBox="0 0 500 500" fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="absolute inset-0 animate-activ-orbit-reverse origin-center"
                                >
                                    <circle
                                        cx="250" cy="250" r="180"
                                        className="stroke-brand-400" strokeWidth="1" strokeDasharray="4 4"
                                    />
                                </svg>
                            </div>

                            {/* `relative z-10` so the frame sits above the rings
                                now that they are no longer behind the section. */}
                            <Tilt3D
                                className="relative z-10"
                                intensity={7} lift={1.02} glare={false} perspective={1100}
                            >
                                <div className="relative w-full rounded-[2.5rem] overflow-hidden
                                                shadow-[0_30px_70px_-20px_rgb(28_46_104/0.45)] bg-white p-2">
                                    <div className="rounded-[2rem] overflow-hidden relative h-[31.25rem] w-full">
                                        <CmsMediaFrame media={media} priority width={640} />

                                        {logoOverlay?.url && (
                                            <div
                                                className="absolute top-6 right-6 bg-white/95 backdrop-blur-md px-6 py-4
                                                           rounded-xl shadow-[0_10px_30px_rgb(0,0,0,0.15)] max-w-[12.5rem]"
                                                // Lifted off the card face so it parallaxes
                                                // against the photograph as the frame tilts.
                                                style={{ transform: 'translateZ(60px)' }}
                                            >
                                                <CmsMediaFrame
                                                    media={logoOverlay}
                                                    width={220}
                                                    className="w-full h-auto max-h-16 object-contain"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Tilt3D>

                            <CmsExtraFields fields={imageFields} className="mt-8" />
                        </Reveal>
                    )}
                </div>

                {/*
                  * ==========================================================
                  * THE CHAIRMAN’S WORDS, BETWEEN WHAT WE ARE AND WHAT WE DO
                  * ==========================================================
                  *
                  * Under the About block and over "Our Mission & Objectives",
                  * which is where the association asked for it and is also
                  * where it reads best: the badge, the heading and the prose
                  * above say what ACTIV is in the third person, and the
                  * objectives below say what it does. This is the one place
                  * it speaks in the first, and it belongs between the two
                  * rather than in front of them — a quotation before the
                  * page has said whose it is has nobody to attribute to yet.
                  *
                  * Drawn as a PULL-QUOTE and not as a card with a heading: the
                  * words are set large enough to be read before they are
                  * scrolled past, the attribution small under them, and there
                  * is no label saying "quote" because the mark and the scale
                  * already say it.
                  *
                  * The portrait is optional and the block does not reserve
                  * space for one — a quote with nobody’s face beside it is a
                  * quote, and an empty circle where a face should be is a
                  * page that looks broken.
                  */}
                {hasQuote && (
                    <Reveal className="mt-16 sm:mt-20">
                        <figure className="relative mx-auto max-w-4xl rounded-[1.75rem] border
                                           border-brand-100 bg-white/80 px-7 py-9 text-center
                                           shadow-[0_18px_50px_-30px_rgba(28,46,104,0.45)]
                                           sm:px-12 sm:py-12">
                            {/* The mark, behind the words rather than in the flow:
                                a glyph on its own line above a quotation is a
                                bullet point nobody can read. */}
                            <span
                                aria-hidden="true"
                                className="pointer-events-none absolute left-6 top-1 select-none
                                           font-serif text-[6rem] leading-none text-brand-100
                                           sm:left-10 sm:text-[8rem]"
                            >
                                “
                            </span>

                            <blockquote
                                className="relative text-[1.375rem] font-semibold leading-[1.6]
                                           text-brand-900 sm:text-[1.75rem] sm:leading-[1.55]
                                           [&_strong]:text-brand-600"
                                dangerouslySetInnerHTML={{ __html: quote!.text || '' }}
                            />

                            {/* A bigger portrait needs more room above it and beside
                                it, or the name sits hard against its edge. */}
                            {(quote!.author || quote!.role || quote!.photo?.url) && (
                                <figcaption className="relative mt-9 flex items-center justify-center
                                                       gap-5">
                                    {/*
                                      A PORTRAIT, not a favicon.

                                      56px under a 28px pull-quote read as an
                                      avatar beside a comment rather than as the
                                      face of the person the words belong to —
                                      and a quote's whole weight comes from who
                                      said it. 80px on a phone, 96px above it,
                                      and the file is fetched at 240 so it is
                                      still sharp on a retina screen.
                                    */}
                                    {quote!.photo?.url && (
                                        <img
                                            src={sizedMediaUrl(quote!.photo!.url, 240)}
                                            alt={quote!.author || ''}
                                            loading="lazy"
                                            className="h-20 w-20 shrink-0 rounded-full object-cover
                                                       ring-4 ring-brand-100 sm:h-24 sm:w-24"
                                        />
                                    )}
                                    <span className="text-left">
                                        {quote!.author && (
                                            <span className="block text-[1.1875rem] font-extrabold
                                                             text-brand-900">
                                                {quote!.author}
                                            </span>
                                        )}
                                        {quote!.role && (
                                            <span className="block text-[1.0625rem] font-semibold
                                                             text-brand-500">
                                                {quote!.role}
                                            </span>
                                        )}
                                    </span>
                                </figcaption>
                            )}
                        </figure>

                        {/* The editor's own rows on the quote card. */}
                        <CmsExtraFields fields={quoteFields} className="mt-8" />
                    </Reveal>
                )}
            </div>

            {/* Full width, so it breaks out of the content column above. */}
            {showPoints && (
                <div className="w-full">
                    <MissionCarousel bullets={bullets} />
                    <div className={`${SCREEN_CONTAINER} relative z-10`}>
                        <CmsExtraFields fields={pointsFields} className="mt-8" />
                    </div>
                </div>
            )}

            {/* Figures bar — column count follows the number authored, so three
                or five entries do not leave a hole in the row. */}
            {showStatsBar && (
                <div className={`${SCREEN_CONTAINER} relative z-10`}>
                    <Reveal
                        variant="scale"
                        className="bg-white rounded-3xl shadow-[0_20px_50px_rgb(0,0,0,0.06)] border border-gray-50
                                   py-8 px-6 md:px-12 w-full"
                    >
                        <div
                            className={`grid grid-cols-1 sm:grid-cols-2 gap-8 divide-y sm:divide-y-0
                                        sm:divide-x divide-gray-100 ${LG_COLUMNS[Math.min(statsBar.length, 6)]}`}
                        >
                            {statsBar.map((stat, i) => (
                                <div
                                    key={i}
                                    className="flex items-center space-x-5 justify-center pt-4 sm:pt-0"
                                >
                                    <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center shrink-0">
                                        <CmsIcon name={stat.icon} size={24} className="text-brand-600" fallback="users" />
                                    </div>
                                    <div>
                                        <p className={`${STAT_FIGURE} text-brand-800`}>
                                            <CountUp value={stat.value} />
                                        </p>
                                        <p className={`${STAT_LABEL} text-gray-500 mt-1`}>{stat.label}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Reveal>
                </div>
            )}

            {/* Whatever the editor added that this block does not know about.
                Renders nothing at all when the list is empty. */}
            <div className={`${SCREEN_CONTAINER} relative z-10`}>
                {/* The figures bar's own rows, then the page's. */}
                <CmsExtraFields fields={statsFields} className="mt-12" />
                <CmsExtraFields fields={extraFields} className="mt-12" />
            </div>
        </section>
    );
}

export default AboutBlock;
