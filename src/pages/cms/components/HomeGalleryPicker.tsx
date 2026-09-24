import { useEffect, useState } from 'react';
import {
    Loader2, ExternalLink, Images, CalendarDays, Eye, EyeOff, Pencil, Type, Check, X,
} from 'lucide-react';
import {
    getGallery, updateGalleryItem, invalidateCmsCache, errorMessage,
    type GalleryItem,
} from '@/services/cmsApi';
import { CmsEmpty, CmsError, cmsSaved, cmsFailed } from './CmsUI';
import BannerWordsFields, { type BannerWords } from './BannerWordsFields';
import { resolveMediaUrl } from '@/config/api.config';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';

/**
 * ============================================================================
 * WHICH GALLERY IMAGES RIDE THE HOME PAGE BANNER
 * ============================================================================
 *
 * The banner carries the recent gallery posters alongside the authored slides,
 * and clicking one opens that event's page. The card that controls it offered
 * a NUMBER and a dropdown: "6 posters, after the slides". An editor could not
 * see which six, could not take one off, and could not tell from this screen
 * that the banner had any pictures in it at all.
 *
 * This is the same treatment the events picker got, for the same reason: the
 * home page is made of things that live somewhere else, and a CMS that only
 * describes them in the abstract sends the editor to the live site to find out
 * what it did.
 *
 * ---------------------------------------------------------------------------
 * `showOnHome` ALREADY EXISTED
 * ---------------------------------------------------------------------------
 *
 * It is on the gallery item and the Gallery screen has always had a button for
 * it. Nothing new is stored here — this is the same field, on the screen where
 * the question is actually being asked. Two screens, one answer.
 *
 * A switch writes the ITEM, immediately, and says so: the card around this
 * saves the home page's own settings, and one button writing a dozen
 * documents is a failure nobody can unpick.
 *
 * ---------------------------------------------------------------------------
 * NOTHING HERE DELETES A RECORD
 * ---------------------------------------------------------------------------
 *
 * There was a bin on every row and it deleted the real image — from the
 * banner, from the gallery grid and from its own page. On a card whose only
 * question is “does this belong in the banner”, that is a destructive action
 * sitting a few pixels from a switch answering the same question harmlessly.
 * Somebody tidying a landing page would eventually destroy something with it.
 *
 * Taking it OUT is the switch. Deleting it is on the Gallery screen, which
 * the Edit link on every row reaches.
 */

const dayOf = (iso: string) => {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric',
        });
    } catch {
        return '';
    }
};

export function HomeGalleryPicker({ onChanged }: {
    /** Something here wrote an item — see `HomeEventsPicker`. */
    onChanged?: () => void;
}) {
    const [items, setItems] = useState<GalleryItem[] | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState<string | null>(null);

    /*
     * THE WORDS OVER EACH POSTER, EDITED RIGHT HERE.
     *
     * This card is where an editor thinks about the banner, so this is where
     * a poster's heading, subheading and Left / Right belong — not only on the
     * Gallery screen three clicks away. One row open at a time; `words` is the
     * draft for that row until Save.
     */
    const [openId, setOpenId] = useState<string | null>(null);
    const [words, setWords] = useState<BannerWords>({ headline: '', highlight: '', subheadline: '', align: 'left' });

    const openWords = (item: GalleryItem) => {
        if (openId === item._id) { setOpenId(null); return; }
        setOpenId(item._id);
        setWords({
            headline: item.bannerHeadline || '',
            highlight: item.bannerHighlight || '',
            subheadline: item.bannerSubheadline || '',
            align: item.bannerAlign === 'right' ? 'right' : 'left',
        });
    };

    const saveWords = async (item: GalleryItem) => {
        setBusy(item._id);
        setError('');
        try {
            const back = await updateGalleryItem(item._id, {
                bannerHeadline: words.headline.trim(),
                bannerHighlight: words.highlight.trim(),
                bannerSubheadline: words.subheadline.trim(),
                bannerAlign: words.align,
            });
            /* A backend on an older build answers 200 and drops these fields.
               Keep the editor's text and say so, rather than a green toast. */
            const lost = (!!words.headline.trim() && !back?.bannerHeadline)
                || (!!words.subheadline.trim() && !back?.bannerSubheadline)
                || (words.align === 'right' && back?.bannerAlign !== 'right');
            if (lost) {
                const message = 'The server did not store these words. Your backend is running an older build — '
                    + 'restart it (npm run dev), then save again.';
                setError(message);
                cmsFailed('the banner words', message);
                return;
            }
            setItems((list) => (list || []).map((i) => (i._id === item._id ? {
                ...i,
                bannerHeadline: words.headline.trim(),
                bannerHighlight: words.highlight.trim(),
                bannerSubheadline: words.subheadline.trim(),
                bannerAlign: words.align,
            } : i)));
            invalidateCmsCache();
            cmsSaved('Banner words');
            setOpenId(null);
            onChanged?.();
        } catch (err) {
            setError(errorMessage(err, 'Could not save the banner words'));
        } finally {
            setBusy(null);
        }
    };

    const load = async () => {
        setError('');
        try {
            // Hidden items included: an editor taking one off the banner should
            // see it is hidden from the gallery too, not lose the row entirely.
            setItems(await getGallery(true));
        } catch (err) {
            setError(errorMessage(err, 'Could not load the gallery'));
            setItems([]);
        }
    };

    /* Once, on mount. */
    useEffect(() => { load(); }, []);

    const toggle = async (item: GalleryItem, next: boolean) => {
        setBusy(item._id);
        setError('');
        try {
            await updateGalleryItem(item._id, { showOnHome: next });
            setItems((list) => (list || []).map((i) =>
                (i._id === item._id ? { ...i, showOnHome: next } : i)));
            invalidateCmsCache();
            cmsSaved(next ? 'Added to the banner' : 'Taken off the banner');
            onChanged?.();
        } catch (err) {
            setError(errorMessage(err, 'Could not change that image'));
        } finally {
            setBusy(null);
        }
    };

    if (items === null) {
        return (
            <p className="flex items-center gap-2 py-6 text-[1.0625rem] font-medium text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading the gallery…
            </p>
        );
    }

    /*
     * ON FIRST, and everything on is in the banner.
     *
     * There was a cap here — the first six of the eligible ones — so an
     * editor who switched nine on got six and no row said which three were
     * dropped. The switch is the whole answer now, on this screen and on
     * the page: see `CarouselSection`.
     *
     * Sorted so the ones that ARE in the banner lead the list. With 69
     * images and twelve rows on screen, a switched-on image sitting at
     * number forty is one the editor cannot see or turn off from here.
     */
    const isOn = (i: GalleryItem) => i.visible !== false && i.showOnHome !== false;
    const eligible = items.filter(isOn);
    const ordered = [...items].sort((a, b) => Number(isOn(b)) - Number(isOn(a)));

    return (
        <div>
            <CmsError message={error} />

            {items.length === 0 ? (
                <CmsEmpty
                    title="Nothing in the gallery yet"
                    hint="Post an image under Gallery and it appears here and in the banner."
                />
            ) : (
                <>
                    <p className="mb-3 text-[1.0625rem] font-semibold text-slate-500 dark:text-neutral-400">
                        {eligible.length} of {items.length} images are switched on.
                        {eligible.length > 0 && (
                            <span>
                                {' '}All {eligible.length} ride the banner, pinned images first.
                            </span>
                        )}
                        {eligible.length === 0 && (
                            <span className="text-amber-700 dark:text-amber-400">
                                {' '}The banner carries the authored slides only.
                            </span>
                        )}
                    </p>

                    {/*
                      * Every switched-on image, plus a few of the rest.
                      *
                      * Sixty-nine rows in a card inside a card is a scroll an
                      * editor gives up on — but every image that IS in the
                      * banner has to be reachable, or it cannot be turned off
                      * from the screen that shows it. So the list is as long as
                      * it needs to be for those, and stops shortly after.
                      */}
                    <ul className="space-y-2.5">
                        {ordered.slice(0, Math.max(eligible.length + 4, 12)).map((item) => {
                            const on = isOn(item);
                            const live = on;

                            return (
                                <li
                                    key={item._id}
                                    className={`rounded-xl border p-3 transition-colors
                                                ${live
                                            ? 'border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20'
                                            : 'border-slate-200 bg-white dark:border-[#232323] dark:bg-[#0d0d0d]'}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="h-14 w-20 shrink-0 overflow-hidden rounded-lg
                                                     bg-slate-100 dark:bg-[#161616]">
                                        {item.media?.url ? (
                                            <CmsMediaFrame media={item.media} width={160} />
                                        ) : (
                                            <span className="flex h-full w-full items-center justify-center
                                                             text-slate-300 dark:text-neutral-700">
                                                <Images className="h-5 w-5" />
                                            </span>
                                        )}
                                    </span>

                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-[1.1875rem] font-bold text-slate-900 dark:text-white">
                                            {item.title || 'Untitled image'}
                                        </p>
                                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5
                                                      text-[1.0625rem] font-medium text-slate-500 dark:text-neutral-400">
                                            {item.eventDate && (
                                                <span className="inline-flex items-center gap-1">
                                                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                                                    {dayOf(item.eventDate)}
                                                </span>
                                            )}
                                            {item.category && <span>{item.category}</span>}
                                            {item.pinned && (
                                                <span className="font-bold text-amber-700 dark:text-amber-400">
                                                    pinned
                                                </span>
                                            )}
                                            {item.visible === false && (
                                                <span className="font-bold text-amber-700 dark:text-amber-400">
                                                    hidden from the gallery
                                                </span>
                                            )}
                                            {live && (
                                                <span className="font-bold text-blue-700 dark:text-blue-400">
                                                    in the banner now
                                                </span>
                                            )}
                                            {/* What this poster says over itself in the banner. */}
                                            {live && (item.bannerHeadline || item.bannerHighlight || item.bannerSubheadline ? (
                                                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                                    own words · {item.bannerAlign === 'right' ? 'right' : 'left'}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">
                                                    {item.title ? 'shows its album title' : 'shows the default heading'}
                                                </span>
                                            ))}
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => openWords(item)}
                                        aria-expanded={openId === item._id}
                                        title="The heading, subheading and side shown over this photo in the banner"
                                        className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5
                                                    text-[1.0625rem] font-semibold transition-colors
                                                    ${openId === item._id
                                            ? 'bg-blue-600 text-white'
                                            : 'text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40'}`}
                                    >
                                        <Type className="h-3.5 w-3.5" /> Banner words
                                    </button>

                                    <a
                                        href="/cms/gallery"
                                        title="Open the Gallery screen to change the picture or its details"
                                        className="hidden shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5
                                                   text-[1.0625rem] font-semibold text-blue-700 transition-colors
                                                   hover:bg-blue-50 sm:inline-flex
                                                   dark:text-blue-400 dark:hover:bg-blue-950/40"
                                    >
                                        <Pencil className="h-3.5 w-3.5" /> Edit
                                        <ExternalLink className="h-3 w-3" />
                                    </a>

                                    <button
                                        type="button"
                                        onClick={() => toggle(item, !(item.showOnHome !== false))}
                                        disabled={busy === item._id || item.visible === false}
                                        title={item.visible === false
                                            ? 'Hidden from the gallery, so it cannot be in the banner'
                                            : on ? 'Take it out of the banner' : 'Allow it in the banner'}
                                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border
                                                    px-3 py-1.5 text-[1.0625rem] font-bold transition-colors
                                                    disabled:opacity-40 ${on
                                                ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                                                    + ' dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300'
                                                : 'border-slate-300 bg-white text-slate-500 hover:bg-slate-100'
                                                    + ' dark:border-[#2a2a2a] dark:bg-[#111] dark:text-neutral-400'}`}
                                    >
                                        {busy === item._id
                                            ? <Loader2 className="h-4 w-4 animate-spin" />
                                            : on ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                        {on ? 'On' : 'Off'}
                                    </button>
                                  </div>

                                  {/* Inline, not a dialog — see CLAUDE.md on native modals. */}
                                  {openId === item._id && (
                                      <div className="mt-3 space-y-3">
                                          <BannerWordsFields
                                              value={words}
                                              onChange={(next) => setWords((w) => ({ ...w, ...next }))}
                                              preview={item.media?.url ? resolveMediaUrl(item.media.url) : ''}
                                              whenBlank={item.title
                                                  ? `Leave them all blank and this album's own title and caption are shown instead ("${item.title}").`
                                                  : "Leave them all blank and the banner's default heading is shown."}
                                              fallback={{ headline: item.title || '', subheadline: item.caption || '' }}
                                          />
                                          <div className="flex items-center justify-end gap-2">
                                              <button
                                                  type="button"
                                                  onClick={() => setOpenId(null)}
                                                  disabled={busy === item._id}
                                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5
                                                             text-[1.0625rem] font-semibold text-slate-600 hover:bg-slate-100
                                                             dark:border-[#2a2a2a] dark:text-neutral-300"
                                              >
                                                  <X className="h-4 w-4" /> Cancel
                                              </button>
                                              <button
                                                  type="button"
                                                  onClick={() => saveWords(item)}
                                                  disabled={busy === item._id}
                                                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3.5 py-1.5
                                                             text-[1.0625rem] font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                                              >
                                                  {busy === item._id
                                                      ? <Loader2 className="h-4 w-4 animate-spin" />
                                                      : <Check className="h-4 w-4" />}
                                                  Save banner words
                                              </button>
                                          </div>
                                      </div>
                                  )}
                                </li>
                            );
                        })}
                    </ul>

                    {/*
                      * No “Add an image” here, for the reason the events picker
                      * has no “Add an event”: this card answers which of the
                      * images that exist belong in the banner, and the switch is
                      * the whole of that answer. Posting a new one is a
                      * different job, on the Gallery screen, which the Edit link
                      * on every row already reaches.
                      */}
                    <p className="mt-4 text-[1.0625rem] font-medium text-slate-400">
                        {ordered.length > Math.max(eligible.length + 4, 12)
                            ? `Showing the switched-on images and a few more, of ${items.length}. `
                            : ''}
                        A switch saves on its own, straight away — it writes the image, not
                        this card. Off takes it out of the banner and leaves it in the
                        gallery; to delete one, open it with Edit.
                    </p>
                </>
            )}
        </div>
    );
}
