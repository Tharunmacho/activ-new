import type { EventsSettings } from '@/services/cmsApi';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import { CmsIcon } from '@/components/shared/CmsIcon';
import { CountUp } from '@/components/shared/CountUp';
import { Reveal } from '@/components/shared/Reveal';
import { PAGE_CONTAINER } from '@/components/layout/pageContainer';
import { HERO_HEADING, HERO_LEDE, EYEBROW } from '@/components/layout/typography';

/**
 * The Events page's opening band.
 *
 * This is the piece that has to make Events read as a different page from
 * Gallery, which is otherwise its closest relative — both are "a filterable
 * grid of cards". Gallery opens on a light split with a handwritten note beside
 * it; Events opens on a full-bleed navy band with the figures set into it and
 * the photograph carried in a circle rather than a rectangle. Nothing else on
 * the site uses a circular frame, and nothing else opens dark, so the two pages
 * are told apart before a single card has loaded.
 *
 * Everything here is authored. With no `heroMedia` the right-hand side is not
 * rendered and the copy takes the full width; with no `stats` the figure row is
 * absent rather than an empty strip. An unauthored hero collapses to a heading.
 */
interface Props {
    settings: EventsSettings | null;
}

export function EventsHero({ settings }: Props) {
    const badge = settings?.badgeText || '';
    const heading = settings?.heading || '';
    const highlight = settings?.headingHighlight || '';
    const lede = settings?.lede || '';
    const stats = settings?.stats || [];
    const media = settings?.heroMedia;
    const heroBadge = settings?.heroBadge;

    const hasMedia = !!media?.url;
    const showBadge = !!(heroBadge?.enabled && (heroBadge.title || heroBadge.subtitle));

    if (!badge && !heading && !highlight && !lede && !stats.length && !hasMedia) return null;

    return (
        <section className="relative w-full overflow-hidden bg-brand-900 text-white font-sans">
            {/*
              The band's own weather. A soft brand bloom behind the photograph
              and a second, cooler one behind the copy, plus a dot field — all
              composited, none of it content.
            */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                <div className="absolute -top-40 right-0 h-[34rem] w-[34rem] rounded-full bg-brand-600/30 blur-3xl" />
                <div className="absolute -bottom-52 -left-24 h-[30rem] w-[30rem] rounded-full bg-brand-700/40 blur-3xl" />
                <svg className="absolute inset-0 h-full w-full opacity-[0.15]" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id="events-dots" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
                            <circle className="fill-white" cx="2" cy="2" r="1.2" />
                        </pattern>
                    </defs>
                    <rect x="0" y="0" width="100%" height="100%" fill="url(#events-dots)" />
                </svg>
            </div>

            <div className={`${PAGE_CONTAINER} relative z-10 pt-16 pb-20 md:pt-20 md:pb-24`}>
                <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">

                    {/* ------------------------------------------------ copy */}
                    <Reveal variant="left" className="min-w-0">
                        {badge && (
                            <div className="inline-flex items-center gap-2 rounded-full bg-white/10
                                            px-4 py-1.5 ring-1 ring-white/20 mb-6">
                                <span className={`${EYEBROW} text-white/90`}>{badge}</span>
                            </div>
                        )}

                        {(heading || highlight) && (
                            <h1 className={HERO_HEADING}>
                                {heading}
                                {heading && highlight && ' '}
                                {highlight && <span className="text-brand-accent">{highlight}</span>}
                            </h1>
                        )}

                        {lede && (
                            <p className={`${HERO_LEDE} mt-6 max-w-xl text-white/70`}>{lede}</p>
                        )}

                        {stats.length > 0 && (
                            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                                {stats.map((stat, i) => (
                                    <div
                                        key={i}
                                        className="rounded-2xl bg-white/[0.07] px-4 py-4 ring-1 ring-white/15
                                                   backdrop-blur-sm transition-colors duration-300
                                                   hover:bg-white/[0.12]"
                                    >
                                        <CmsIcon
                                            name={stat.icon}
                                            size={20}
                                            className="text-brand-300 mb-2.5"
                                            fallback="calendar-days"
                                        />
                                        <p className="text-2xl font-black tracking-tight tabular-nums">
                                            <CountUp value={stat.value} />
                                        </p>
                                        <p className="mt-0.5 text-[0.6875rem] font-bold uppercase
                                                      tracking-[0.08em] text-white/55">
                                            {stat.label}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Reveal>

                    {/* --------------------------------------------- picture */}
                    {hasMedia && (
                        <Reveal variant="right" delay={120} className="relative hidden lg:block">
                            {/*
                              A circle, not a card. The rest of the site frames
                              photographs in rounded rectangles; this is the one
                              place that does not, which is most of what makes
                              the page recognisable at a glance.
                            */}
                            <div className="relative mx-auto aspect-square w-full max-w-[26rem]">
                                <div
                                    aria-hidden="true"
                                    className="absolute -inset-6 rounded-full border border-white/15
                                               animate-activ-orbit"
                                />
                                <div
                                    aria-hidden="true"
                                    className="absolute -inset-12 rounded-full border border-dashed border-white/10
                                               animate-activ-orbit-reverse"
                                />
                                <div className="relative h-full w-full overflow-hidden rounded-full
                                                ring-1 ring-white/20 shadow-[0_40px_90px_-30px_rgb(0,0,0,0.75)]">
                                    <CmsMediaFrame media={media} priority width={440} />
                                </div>

                                {showBadge && (
                                    <div
                                        className="absolute -bottom-2 -left-4 w-40 rounded-full bg-brand-700/95
                                                   px-5 py-5 text-center ring-1 ring-white/20 backdrop-blur-sm
                                                   shadow-[0_20px_40px_-16px_rgb(0,0,0,0.8)] animate-activ-float"
                                    >
                                        <CmsIcon
                                            name={heroBadge?.icon}
                                            size={20}
                                            className="mx-auto mb-2 text-brand-200"
                                            fallback="calendar-days"
                                        />
                                        {heroBadge?.title && (
                                            <p className="text-sm font-extrabold leading-tight">{heroBadge.title}</p>
                                        )}
                                        {heroBadge?.subtitle && (
                                            <p className="mt-1 text-[0.6875rem] leading-snug text-white/70">
                                                {heroBadge.subtitle}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </Reveal>
                    )}
                </div>
            </div>
        </section>
    );
}

export default EventsHero;
