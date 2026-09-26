import { galleryPath } from '@/lib/eventPath';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, X, ChevronLeft, ChevronRight, Images } from 'lucide-react';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import { SCREEN_CONTAINER } from '@/components/layout/pageContainer';
import { SECTION_HEADING } from '@/components/layout/typography';
import {
    listRegionGallery, getGalleryFilters, type GalleryPhoto,
} from '@/services/cmsRegionsApi';
import { CARD, ROW_LABEL } from './RegionUI';

/**
 * The photo gallery, filtered and paged.
 *
 * =========================================================================
 * THE FILTERS LIVE IN THE URL, NOT IN REACT STATE
 * =========================================================================
 *
 * Every control here writes to the query string and reads back from it. That is
 * what makes a filtered view a thing somebody can bookmark, send to a colleague
 * and come back to with the browser's Back button — and it is what lets a state
 * page link straight to `?state=Andhra Pradesh` and have the grid arrive already
 * filtered, which is precisely what the association asked for.
 *
 * Filters held only in component state look identical on screen and lose all
 * three of those properties silently.
 *
 * ------------------------------------------------------------ what is shown
 *
 * The dropdowns are built from `GET /cms/regions/gallery/filters`, which returns
 * the categories and sectors that photographs ACTUALLY carry. A dropdown
 * offering a category nothing is tagged with returns an empty grid, and a
 * visitor reads that as a broken page rather than as an empty category.
 */

const PAGE_SIZE = 12;

export function RegionGallery() {
    const [params, setParams] = useSearchParams();

    const state = params.get('state') || '';
    const region = params.get('region') || '';
    const category = params.get('category') || '';
    const sector = params.get('sector') || '';
    const q = params.get('q') || '';
    const offset = Math.max(0, Number(params.get('offset') || 0));

    /* The search box is typed into before it is submitted, so it needs its own
       state — but the URL stays the source of truth for what is displayed. */
    const [search, setSearch] = useState(q);
    useEffect(() => { setSearch(q); }, [q]);

    const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState<{ categories: string[]; sectors: string[] }>({
        categories: [], sectors: [],
    });

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        listRegionGallery({ state, region, category, sector, q, offset, limit: PAGE_SIZE })
            .then((result) => {
                if (cancelled) return;
                setPhotos(result.items || []);
                setTotal(result.total || 0);
                setLoading(false);
            })
            .catch(() => { if (!cancelled) { setPhotos([]); setTotal(0); setLoading(false); } });
        return () => { cancelled = true; };
    }, [state, region, category, sector, q, offset]);

    useEffect(() => {
        let cancelled = false;
        getGalleryFilters({ state, region })
            .then((result) => {
                if (!cancelled) setFilters({ categories: result.categories, sectors: result.sectors });
            })
            .catch(() => { /* the dropdowns simply do not appear */ });
        return () => { cancelled = true; };
    }, [state, region]);

    /** Writes one filter and always resets the page — see the note below. */
    const setFilter = (key: string, value: string) => {
        const next = new URLSearchParams(params);
        if (value) next.set(key, value); else next.delete(key);
        /*
         * PAGE 3 OF THE OLD FILTER IS NOT PAGE 3 OF THE NEW ONE.
         *
         * Changing a filter without clearing the offset lands the reader on an
         * empty page of a shorter result set, which reads as "no photographs"
         * when there are plenty on page one.
         */
        next.delete('offset');
        setParams(next);
    };

    const clearAll = () => setParams(new URLSearchParams());

    const chips = useMemo(() => {
        const rows: { label: string; key: string }[] = [];
        if (state) rows.push({ label: state, key: 'state' });
        if (region) rows.push({ label: `${region} region`, key: 'region' });
        if (category) rows.push({ label: category, key: 'category' });
        if (sector) rows.push({ label: sector, key: 'sector' });
        if (q) rows.push({ label: `“${q}”`, key: 'q' });
        return rows;
    }, [state, region, category, sector, q]);

    const from = total ? offset + 1 : 0;
    const to = offset + photos.length;

    const select = 'h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-[1.0625rem] '
        + 'font-semibold text-brand-900 hover:border-gray-400 focus:outline-none focus:ring-2 '
        + 'focus:ring-brand-600 focus:border-transparent transition-colors';

    return (
        <main className="flex-grow">
            <div className={`${SCREEN_CONTAINER} py-10 md:py-14`}>
                <h1 className={`${SECTION_HEADING} text-brand-800 mb-2`}>Photo Gallery</h1>
                <p className="text-[1.25rem] sm:text-[1.0625rem] font-semibold text-gray-600 mb-8">
                    Photographs from ACTIV events, meetings and programmes.
                </p>

                {/* ------------------------------------------------ filters */}
                <div className={`${CARD} p-5 sm:p-6 mb-8`}>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
                        <div>
                            <label htmlFor="g-category" className={`${ROW_LABEL} block mb-1.5`}>
                                Category
                            </label>
                            <select
                                id="g-category"
                                className={select}
                                value={category}
                                onChange={(e) => setFilter('category', e.target.value)}
                            >
                                <option value="">All categories</option>
                                {filters.categories.map((row) => (
                                    <option key={row} value={row}>{row}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label htmlFor="g-sector" className={`${ROW_LABEL} block mb-1.5`}>
                                Sector
                            </label>
                            <select
                                id="g-sector"
                                className={select}
                                value={sector}
                                onChange={(e) => setFilter('sector', e.target.value)}
                            >
                                <option value="">All sectors</option>
                                {filters.sectors.map((row) => (
                                    <option key={row} value={row}>{row}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label htmlFor="g-search" className={`${ROW_LABEL} block mb-1.5`}>
                                Title or description
                            </label>
                            <form
                                onSubmit={(e) => { e.preventDefault(); setFilter('q', search.trim()); }}
                                className="flex gap-2"
                            >
                                <input
                                    id="g-search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search the photographs"
                                    className="h-12 flex-1 min-w-0 rounded-xl border border-gray-300 bg-white px-4
                                               text-[1.0625rem] font-semibold text-brand-900 hover:border-gray-400
                                               focus:outline-none focus:ring-2 focus:ring-brand-600
                                               focus:border-transparent transition-colors
                                               placeholder:font-medium placeholder:text-gray-500"
                                />
                                <button
                                    type="submit"
                                    className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand-800 px-5
                                               text-[1.0625rem] font-bold uppercase tracking-[0.1em] text-white
                                               transition-colors hover:bg-brand-700"
                                >
                                    <Search size={15} /> Search
                                </button>
                            </form>
                        </div>
                    </div>

                    {/*
                      * THE ACTIVE FILTERS, SHOWN AND REMOVABLE.
                      *
                      * A visitor arriving from a state page is looking at a
                      * subset and has been told nothing about it. A chip saying
                      * "Andhra Pradesh ×" is the difference between a filtered
                      * gallery and a gallery that appears to be missing most of
                      * its photographs.
                      */}
                    {chips.length > 0 && (
                        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
                            <span className={`${ROW_LABEL} text-gray-400`}>Showing</span>
                            {chips.map((chip) => (
                                <button
                                    key={chip.key}
                                    type="button"
                                    onClick={() => setFilter(chip.key, '')}
                                    className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5
                                               text-[1.0625rem] font-bold text-brand-700 transition-colors
                                               hover:bg-brand-100"
                                >
                                    {chip.label}
                                    <X size={12} />
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={clearAll}
                                className="text-[1.0625rem] font-bold text-gray-500 hover:text-brand-700
                                           transition-colors ml-1"
                            >
                                Clear all
                            </button>
                        </div>
                    )}
                </div>

                {/* -------------------------------------------------- grid */}
                {loading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 animate-pulse">
                        {Array.from({ length: 8 }, (_, i) => (
                            <div key={i} className="aspect-[4/3] rounded-2xl bg-slate-100" />
                        ))}
                    </div>
                ) : photos.length ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                        {photos.map((photo) => (
                            <Link
                                key={photo.id}
                                to={galleryPath(photo)}
                                className={`${CARD} group block overflow-hidden transition-shadow
                                            hover:shadow-[0_22px_48px_-20px_rgb(28_46_104/0.4)]`}
                            >
                                <div className="w-full aspect-[4/3] overflow-hidden bg-gray-50">
                                    <CmsMediaFrame
                                        media={photo.media}
                                        width={480}
                                        className="group-hover:scale-105 transition-transform duration-700 transform-gpu"
                                    />
                                </div>
                                <div className="px-4 py-3.5">
                                    {/* Title only, as the reference prints it.
                                        The rest is on the photograph's own page. */}
                                    <p className="text-[1.0625rem] font-extrabold text-brand-900 line-clamp-2">
                                        {photo.title || 'Untitled'}
                                    </p>
                                    {/* The state, not the category — see the note
                                        in `GallerySection`. */}
                                    {photo.state && (
                                        <p className="mt-1 text-[1.0625rem] font-semibold text-gray-500">
                                            {photo.state}
                                        </p>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className={`${CARD} px-6 py-16 text-center`}>
                        <Images size={28} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-[1.25rem] sm:text-[1.0625rem] font-extrabold text-brand-900">
                            No photographs match these filters
                        </p>
                        {chips.length > 0 && (
                            <button
                                type="button"
                                onClick={clearAll}
                                className="mt-4 inline-flex items-center gap-2 rounded-full border border-brand-200
                                           px-6 py-3 text-[1.0625rem] font-bold uppercase tracking-[0.1em]
                                           text-brand-700 transition-colors hover:bg-brand-50"
                            >
                                Clear the filters
                            </button>
                        )}
                    </div>
                )}

                {/* ---------------------------------------------- paging */}
                {total > PAGE_SIZE && (
                    <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
                        <p className="text-[1.0625rem] font-semibold text-gray-500">
                            Showing <span className="font-extrabold text-brand-800">{from}–{to}</span>
                            {' '}of <span className="font-extrabold text-brand-800">{total}</span>
                        </p>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                disabled={offset <= 0}
                                onClick={() => {
                                    const next = new URLSearchParams(params);
                                    const back = Math.max(0, offset - PAGE_SIZE);
                                    if (back) next.set('offset', String(back)); else next.delete('offset');
                                    setParams(next);
                                }}
                                className="inline-flex items-center gap-2 rounded-full border border-brand-200 px-5
                                           py-2.5 text-[1.0625rem] font-bold uppercase tracking-[0.1em]
                                           text-brand-700 transition-colors hover:bg-brand-50
                                           disabled:opacity-40 disabled:cursor-not-allowed
                                           disabled:hover:bg-transparent"
                            >
                                <ChevronLeft size={15} /> Back
                            </button>
                            <button
                                type="button"
                                disabled={to >= total}
                                onClick={() => {
                                    const next = new URLSearchParams(params);
                                    next.set('offset', String(offset + PAGE_SIZE));
                                    setParams(next);
                                }}
                                className="inline-flex items-center gap-2 rounded-full bg-brand-800 px-5 py-2.5
                                           text-[1.0625rem] font-bold uppercase tracking-[0.1em] text-white
                                           transition-colors hover:bg-brand-700 disabled:opacity-40
                                           disabled:cursor-not-allowed disabled:hover:bg-brand-800"
                            >
                                Next <ChevronRight size={15} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}

export default RegionGallery;
