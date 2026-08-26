import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import { CmsIcon } from '@/components/shared/CmsIcon';
import type { CmsBullet, CmsMedia, CmsStat } from '@/services/cmsApi';

/**
 * The "About" split layout — copy and icon bullets on the left, media on the
 * right, a figures bar beneath.
 *
 * One component, two callers: the home page's About block and the dedicated
 * About page render exactly this, from two different CMS documents. They were
 * duplicated files before, which meant a fix to one silently left the other
 * behind.
 *
 * Every part is optional. A section with no bullets renders no list, and one
 * with no media renders no right-hand column and lets the copy use the full
 * width — an empty half is a layout hole, not absent content.
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
    const hasCopy = !!(badgeText || heading || headingHighlight || body || bullets.length);

    if (!hasCopy && !hasMedia && !statsBar.length) return null;

    return (
        <section className="w-full py-20 bg-[#fbfcff] flex justify-center relative overflow-hidden font-sans">
            {/* Decorative only — no content, so it is not authored. */}
            <div className="absolute top-10 right-0 w-1/2 h-full -z-10 opacity-30 pointer-events-none">
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id="about-dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                            <circle fill="#93c5fd" cx="2" cy="2" r="1.5" />
                        </pattern>
                    </defs>
                    <rect x="0" y="0" width="100%" height="100%" fill="url(#about-dots)" />
                </svg>
            </div>

            <div className="container mx-auto px-4 md:px-8 max-w-7xl relative z-10">

                <div className={`flex flex-col lg:flex-row gap-12 lg:gap-16 items-center ${statsBar.length ? 'mb-24' : ''}`}>

                    {/* Copy — takes the full width when there is no media beside it. */}
                    {hasCopy && (
                        <div className={`w-full ${hasMedia ? 'lg:w-1/2' : ''}`}>

                            {badgeText && (
                                <div className="inline-flex items-center space-x-2 bg-blue-50 text-blue-600 px-4 py-1.5
                                                rounded-full mb-6 border border-blue-100 shadow-sm">
                                    <CmsIcon name={badgeIcon} size={14} className="stroke-[3]" fallback="users" />
                                    <span className="text-[11px] font-extrabold uppercase tracking-widest">{badgeText}</span>
                                </div>
                            )}

                            {(heading || headingHighlight) && (
                                <h2 className="text-4xl md:text-5xl font-black text-[#111827] leading-tight mb-6 font-serif">
                                    {heading}
                                    {heading && headingHighlight && <br />}
                                    {headingHighlight && <span className="text-[#2563eb]">{headingHighlight}</span>}
                                </h2>
                            )}

                            {body && (
                                // Authored HTML: the editor writes it, and only a
                                // signed-in super admin can. It is not visitor input.
                                <div
                                    className="text-gray-600 text-base md:text-lg leading-relaxed mb-10 font-medium
                                               [&_strong]:text-gray-900 [&_strong]:font-bold"
                                    dangerouslySetInnerHTML={{ __html: body }}
                                />
                            )}

                            {bullets.length > 0 && (
                                <div className="space-y-0">
                                    {bullets.map((bullet, i) => (
                                        <div
                                            key={i}
                                            className={`flex items-start space-x-4 py-4 ${
                                                i < bullets.length - 1 ? 'border-b border-dashed border-gray-200' : ''
                                            }`}
                                        >
                                            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center
                                                            justify-center shrink-0">
                                                <CmsIcon name={bullet.icon} size={18} className="text-blue-600" fallback="users" />
                                            </div>
                                            <div
                                                className="text-gray-600 text-sm leading-relaxed pt-0.5
                                                           [&_strong]:text-gray-800"
                                                dangerouslySetInnerHTML={{ __html: bullet.text || '' }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Media */}
                    {hasMedia && (
                        <div className={`w-full ${hasCopy ? 'lg:w-1/2 lg:pl-8' : ''} relative`}>
                            <div className="absolute -inset-10 -z-10 hidden lg:block opacity-40">
                                <svg width="100%" height="100%" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="250" cy="250" r="150" stroke="#93c5fd" strokeWidth="1" />
                                    <circle cx="250" cy="250" r="180" stroke="#93c5fd" strokeWidth="1" strokeDasharray="4 4" />
                                    <circle cx="250" cy="250" r="210" stroke="#93c5fd" strokeWidth="1" />
                                </svg>
                            </div>

                            <div className="relative w-full rounded-[2.5rem] overflow-hidden shadow-2xl bg-white p-2">
                                <div className="rounded-[2rem] overflow-hidden relative h-[500px] w-full">
                                    <CmsMediaFrame media={media} />

                                    {logoOverlay?.url && (
                                        <div className="absolute top-6 right-6 bg-white/95 backdrop-blur-md px-6 py-4
                                                        rounded-xl shadow-[0_10px_30px_rgb(0,0,0,0.15)] max-w-[200px]">
                                            <CmsMediaFrame
                                                media={logoOverlay}
                                                className="w-full h-auto max-h-16 object-contain"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Figures bar — column count follows the number authored, so three
                    or five entries do not leave a hole in the row. */}
                {statsBar.length > 0 && (
                    <div className="bg-white rounded-3xl shadow-[0_20px_50px_rgb(0,0,0,0.06)] border border-gray-50
                                    py-8 px-6 md:px-12 w-full mt-10">
                        <div
                            className={`grid grid-cols-1 sm:grid-cols-2 gap-8 divide-y sm:divide-y-0
                                        sm:divide-x divide-gray-100 ${LG_COLUMNS[Math.min(statsBar.length, 6)]}`}
                        >
                            {statsBar.map((stat, i) => (
                                <div
                                    key={i}
                                    className="flex items-center space-x-5 justify-center pt-4 sm:pt-0"
                                >
                                    <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                                        <CmsIcon name={stat.icon} size={24} className="text-blue-600" fallback="users" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-black text-[#1c2e68]">{stat.value}</p>
                                        <p className="text-xs font-bold text-gray-500 mt-1">{stat.label}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}

export default AboutBlock;
