import { useEffect, useMemo, useState } from 'react';
import { Calendar, MapPin, Grid3x3 } from 'lucide-react';
import {
    getGallery, getGallerySettings,
    type GalleryItem, type GallerySettings,
} from '@/services/cmsApi';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import { CmsIcon } from '@/components/shared/CmsIcon';

/**
 * The gallery page.
 *
 * Images, their captions, categories, dates and locations all come from the
 * CMS, as does the copy above them and the filter chips. Nothing is hardcoded:
 * an empty gallery renders no grid rather than stock photography an admin
 * cannot delete.
 *
 * The collage at the top draws from images flagged `featured`. Falling back to
 * "the first three" would mean an admin could never choose which three appear
 * there without reordering the whole grid.
 */
export function GallerySection() {
    const [images, setImages] = useState<GalleryItem[] | null>(null);
    const [settings, setSettings] = useState<GallerySettings | null>(null);
    const [activeFilter, setActiveFilter] = useState('All');
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        let cancelled = false;

        Promise.all([getGallery(), getGallerySettings()])
            .then(([items, config]) => {
                if (cancelled) return;
                setImages(items);
                setSettings(config);
            })
            .catch(() => {
                if (cancelled) return;
                setImages([]);
                setSettings(null);
            });

        return () => { cancelled = true; };
    }, []);

    const all = images || [];

    /** `featured` first; without any, the collage is simply not drawn. */
    const collage = useMemo(() => all.filter(i => i.featured).slice(0, 3), [all]);

    const filtered = useMemo(
        () => (activeFilter === 'All' ? all : all.filter(i => i.category === activeFilter)),
        [all, activeFilter],
    );

    const pageSize = settings?.pageSize ?? 8;
    const visible = expanded || pageSize <= 0 ? filtered : filtered.slice(0, pageSize);
    const hasMore = pageSize > 0 && filtered.length > pageSize;

    // Still loading — the skeletons below are for that; `null` means the request
    // has not resolved and the page has nothing to say yet.
    const loading = images === null;

    const categories = settings?.categories || [];
    const noteLines = settings?.noteLines || [];
    const hasIntro = !!(settings?.badgeText || settings?.heading || settings?.description);

    return (
        <section className="w-full py-16 md:py-24 bg-white relative overflow-hidden font-sans">

            {/* Decorative only — not authored. */}
            <div className="absolute top-0 right-0 w-1/3 h-full -z-10 opacity-30 pointer-events-none">
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id="dots-gallery" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                            <circle fill="#93c5fd" cx="2" cy="2" r="1.5" />
                        </pattern>
                    </defs>
                    <rect x="0" y="0" width="100%" height="100%" fill="url(#dots-gallery)" />
                </svg>
            </div>
            {/* Added transform-gpu to prevent heavy scrolling lag from blur-3xl */}
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-50/50 rounded-full blur-3xl -z-10 -translate-x-1/3 translate-y-1/3 transform-gpu will-change-transform pointer-events-none" />

            <div className="container mx-auto px-4 md:px-8 max-w-[1400px] relative z-10">

                {/* ---- intro and collage ---- */}
                {(hasIntro || collage.length > 0) && (
                    <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 items-center mb-24">

                        {hasIntro && (
                            <div className={`w-full ${collage.length ? 'lg:w-5/12' : ''} relative`}>
                                {settings?.badgeText && (
                                    <div className="inline-flex items-center space-x-2 bg-blue-50 text-blue-600 px-4 py-1.5
                                                    rounded-full mb-6 border border-blue-100 shadow-sm">
                                        <CmsIcon name={settings.badgeIcon} size={14} className="stroke-[3]" fallback="image" />
                                        <span className="text-[11px] font-extrabold uppercase tracking-widest">
                                            {settings.badgeText}
                                        </span>
                                    </div>
                                )}

                                {(settings?.heading || settings?.headingHighlight) && (
                                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-[#111827]
                                                   leading-[1.1] mb-6 font-serif">
                                        {settings.heading}
                                        {settings.headingHighlight && (
                                            <> <span className="text-[#2563eb]">{settings.headingHighlight}</span></>
                                        )}
                                    </h2>
                                )}

                                {settings?.description && (
                                    <p className="text-gray-500 text-base md:text-lg leading-relaxed max-w-md font-medium">
                                        {settings.description}
                                    </p>
                                )}

                                {noteLines.length > 0 && (
                                    <div className="hidden lg:block absolute -right-28 top-32 w-64 h-64 text-blue-600">
                                        <div className="relative w-full h-full">
                                            <p
                                                className="absolute top-0 left-0 text-2xl rotate-[-10deg] font-bold text-[#2563eb]"
                                                style={{ fontFamily: "'Caveat', cursive, serif" }}
                                            >
                                                {noteLines.map((line, i) => (
                                                    <span key={i} className="block">{line}</span>
                                                ))}
                                            </p>
                                            <svg
                                                className="absolute top-16 left-12 w-32 h-32"
                                                viewBox="0 0 100 100" fill="none" stroke="#2563eb"
                                                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                            >
                                                <path d="M10,20 Q40,60 80,40" />
                                                <path d="M70,30 L80,40 L70,50" />
                                            </svg>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {collage.length > 0 && (
                            <div className={`w-full ${hasIntro ? 'lg:w-7/12' : ''} mt-12 lg:mt-0 relative`}>
                                {/* Added isolate to prevent z-index issues with sticky header during scroll */}
                                <div className="relative h-[450px] md:h-[500px] w-full max-w-3xl mx-auto isolate">
                                    {/* Fixed positions rather than a loop: the three frames
                                        are deliberately different sizes and angles. */}
                                    {collage[0] && (
                                        <div className="absolute top-4 left-0 w-3/5 h-4/5 z-10 -rotate-2 group transform-gpu">
                                            <div className="w-full h-full rounded-3xl overflow-hidden border-[6px]
                                                            border-white shadow-xl bg-gray-100 transform-gpu">
                                                <CmsMediaFrame
                                                    media={collage[0].media}
                                                    className="group-hover:scale-105 transition-transform duration-700 transform-gpu"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    {collage[1] && (
                                        <div className="absolute -top-4 right-4 w-[42%] h-[45%] z-20 rotate-2 group transform-gpu">
                                            <div className="w-full h-full rounded-3xl overflow-hidden border-[6px]
                                                            border-white shadow-xl bg-gray-100 transform-gpu">
                                                <CmsMediaFrame
                                                    media={collage[1].media}
                                                    className="group-hover:scale-105 transition-transform duration-700 transform-gpu"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    {collage[2] && (
                                        <div className="absolute bottom-4 right-0 w-[45%] h-[45%] z-30 -rotate-1 group transform-gpu">
                                            <div className="w-full h-full rounded-3xl overflow-hidden border-[6px]
                                                            border-white shadow-xl bg-gray-100 transform-gpu">
                                                <CmsMediaFrame
                                                    media={collage[2].media}
                                                    className="group-hover:scale-105 transition-transform duration-700 transform-gpu"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ---- filter chips ---- */}
                {categories.length > 0 && (
                    <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
                        {[{ label: 'All', icon: '' }, ...categories].map((filter, index) => (
                            <button
                                key={index}
                                onClick={() => { setActiveFilter(filter.label); setExpanded(false); }}
                                className={`flex items-center space-x-2 px-6 py-2.5 rounded-full text-sm font-semibold
                                            transition-all duration-200 border ${
                                    activeFilter === filter.label
                                        ? 'bg-[#1c2e68] border-[#1c2e68] text-white shadow-md'
                                        : 'bg-white border-gray-200 text-[#1c2e68] hover:border-[#1c2e68] hover:bg-blue-50'
                                }`}
                            >
                                {filter.icon && (
                                    <CmsIcon
                                        name={filter.icon}
                                        size={16}
                                        className={activeFilter === filter.label ? 'text-white' : 'text-blue-600'}
                                        fallback="image"
                                    />
                                )}
                                <span>{filter.label}</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* ---- grid ---- */}
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="rounded-2xl h-72 bg-gray-100 animate-pulse border border-gray-200" />
                        ))}
                    </div>
                ) : visible.length === 0 ? (
                    <p className="text-center text-gray-500 py-12">
                        {activeFilter === 'All'
                            ? (settings?.emptyText || 'No photographs have been published yet.')
                            : ((settings?.emptyFilterText || 'Nothing in {category} yet.')
                                .replace('{category}', activeFilter))}
                    </p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                        {visible.map((card) => (
                            <div
                                key={card._id}
                                className="bg-white rounded-[1.25rem] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)]
                                           border border-gray-100 hover:shadow-xl transition-shadow duration-300
                                           flex flex-col group"
                            >
                                <div className="w-full h-48 relative overflow-hidden bg-gray-50 p-1">
                                    <div className="w-full h-full rounded-t-2xl overflow-hidden relative">
                                        <CmsMediaFrame
                                            media={card.media}
                                            className="group-hover:scale-105 transition-transform duration-500 transform-gpu"
                                        />

                                        {card.category && (
                                            <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm border
                                                            border-gray-100 text-blue-700 text-[10px] font-bold px-3 py-1.5
                                                            rounded-full flex items-center space-x-1.5 shadow-sm">
                                                <CmsIcon
                                                    name={categories.find(c => c.label === card.category)?.icon}
                                                    size={12}
                                                    className="text-blue-600"
                                                    fallback="image"
                                                />
                                                <span className="uppercase tracking-wider">{card.category}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="p-5 flex flex-col flex-grow">
                                    {card.title && (
                                        <h3 className="text-[15px] font-extrabold text-[#111827] mb-4 leading-snug
                                                       line-clamp-2 group-hover:text-blue-600 transition-colors">
                                            {card.title}
                                        </h3>
                                    )}

                                    {(card.eventDate || card.location) && (
                                        <div className="mt-auto flex items-center justify-between text-gray-500 text-xs
                                                        font-medium border-t border-gray-50 pt-4">
                                            {card.eventDate && (
                                                <div className="flex items-center space-x-1.5">
                                                    <Calendar size={14} className="text-gray-400" />
                                                    <span>{card.eventDate}</span>
                                                </div>
                                            )}
                                            {card.location && (
                                                <div className="flex items-center space-x-1.5">
                                                    <MapPin size={14} className="text-gray-400" />
                                                    <span className="truncate max-w-[90px]">{card.location}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Expands in place rather than navigating: there is no second page. */}
                {hasMore && !expanded && settings?.viewMoreLabel && (
                    <div className="flex justify-center mt-12">
                        <button
                            onClick={() => setExpanded(true)}
                            className="flex items-center space-x-2 bg-white border-2 border-blue-100 hover:border-blue-200
                                       text-blue-700 hover:bg-blue-50 px-8 py-3 rounded-full font-bold transition-all shadow-sm"
                        >
                            <Grid3x3 size={16} />
                            <span>{settings.viewMoreLabel}</span>
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}
