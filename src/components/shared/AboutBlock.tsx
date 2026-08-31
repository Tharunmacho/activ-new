import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import { CmsIcon } from '@/components/shared/CmsIcon';
import { CountUp } from '@/components/shared/CountUp';
import { Reveal } from '@/components/shared/Reveal';
import { Tilt3D } from '@/components/shared/Tilt3D';
import { MissionCarousel } from '@/components/shared/MissionCarousel';
import type { CmsBullet, CmsMedia, CmsStat } from '@/services/cmsApi';
import { PAGE_CONTAINER } from '@/components/layout/pageContainer';
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
}

export function AboutBlock({
    badgeIcon, badgeText, heading, headingHighlight,
    body, bullets = [], media, logoOverlay, statsBar = [],
}: Props) {
    const hasMedia = !!media?.url;
    const hasCopy = !!(badgeText || heading || headingHighlight || body);

    if (!hasCopy && !hasMedia && !bullets.length && !statsBar.length) return null;

    return (
        <section className="w-full py-20 bg-[#fbfcff] flex flex-col items-center relative overflow-hidden font-sans">
            {/* Decorative only — no content, so it is not authored.
                `z-0`, not `-z-10`: a negative index puts this behind the
                section's own background colour, which is opaque, so the pattern
                was painted and then covered. The content above carries `z-10`. */}
            <div className="absolute top-10 right-0 w-1/2 h-full z-0 opacity-40 pointer-events-none">
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id="about-dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                            <circle className="fill-brand-300" cx="2" cy="2" r="1.5" />
                        </pattern>
                    </defs>
                    <rect x="0" y="0" width="100%" height="100%" fill="url(#about-dots)" />
                </svg>
            </div>

            <div className={`${PAGE_CONTAINER} relative z-10`}>

                <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-center">

                    {/* Copy — takes the full width when there is no media beside it. */}
                    {hasCopy && (
                        <Reveal variant="left" className={`w-full ${hasMedia ? 'lg:w-1/2' : ''}`}>

                            {badgeText && (
                                <div className="inline-flex items-center space-x-2 bg-brand-50 text-brand-600 px-4 py-1.5
                                                rounded-full mb-6 border border-brand-100 shadow-sm">
                                    <CmsIcon name={badgeIcon} size={14} className="stroke-[3]" fallback="users" />
                                    <span className={EYEBROW}>{badgeText}</span>
                                </div>
                            )}

                            {(heading || headingHighlight) && (
                                <h2 className={`${SECTION_HEADING} text-[#111827] mb-6`}>
                                    {heading}
                                    {heading && headingHighlight && <br />}
                                    {headingHighlight && <span className="text-brand-600">{headingHighlight}</span>}
                                </h2>
                            )}

                            {body && (
                                // Authored HTML: the editor writes it, and only a
                                // signed-in super admin can. It is not visitor input.
                                <div
                                    className={`${SECTION_LEDE} text-gray-600
                                               [&_p]:mb-4 [&_p:last-child]:mb-0
                                               [&_strong]:text-brand-800 [&_strong]:font-extrabold`}
                                    dangerouslySetInnerHTML={{ __html: body }}
                                />
                            )}
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
                        </Reveal>
                    )}
                </div>
            </div>

            {/* Full width, so it breaks out of the content column above. */}
            <div className="w-full">
                <MissionCarousel bullets={bullets} />
            </div>

            {/* Figures bar — column count follows the number authored, so three
                or five entries do not leave a hole in the row. */}
            {statsBar.length > 0 && (
                <div className={`${PAGE_CONTAINER} relative z-10`}>
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
        </section>
    );
}

export default AboutBlock;
