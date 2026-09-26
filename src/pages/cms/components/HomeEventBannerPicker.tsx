import { useEffect, useState } from 'react';
import {
    Loader2, ExternalLink, CalendarDays, Eye, EyeOff, Pencil, Type, Check, X, MapPin,
} from 'lucide-react';
import {
    getCmsEventsForEditor, updateCmsEvent, invalidateCmsCache, errorMessage,
    type CmsEvent,
} from '@/services/cmsApi';
import { CmsEmpty, CmsError, cmsSaved, cmsFailed } from './CmsUI';
import BannerWordsFields, { type BannerWords } from './BannerWordsFields';
import { resolveMediaUrl } from '@/config/api.config';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';

/**
 * ============================================================================
 * WHICH EVENTS RIDE THE HOME PAGE BANNER
 * ============================================================================
 *
 * `HomeGalleryPicker`, for events: the same rows, the same On / Off, the same
 * Banner words, the same rule that a switch writes the ITEM straight away.
 * Whoever posted the event — the CMS, the Super Admin or the Events Admin —
 * it is listed here, because the CMS maintains the onboarding site and the
 * banner is the top of it.
 *
 * `showInBanner` is its own field and NOT `showOnHome`, which is the events
 * strip further down the page (`HomeEventsPicker`). One switch per surface.
 *
 * ON BY DEFAULT, like a gallery image: posting an event puts it in the
 * banner, and there is no checkbox on the event form. This switch is the
 * one place it is taken out (or put back).
 *
 * AN EVENT THE PUBLIC CANNOT READ CANNOT BE IN THE BANNER. A draft, a
 * members-only event, or one not posted to the onboarding site is not on the
 * public event list the slideshow is built from. Its switch is disabled and
 * says why, as a hidden gallery image's is — a switch that turns on and
 * changes nothing would be a lie.
 */

const dayOf = (iso: string | null) => {
    if (!iso) return '';
    const at = new Date(iso);
    return Number.isNaN(at.getTime())
        ? ''
        : at.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const hasTargets = (e: CmsEvent) =>
    (Array.isArray(e?.targets) && e.targets.length > 0)
    || !!(e?.state || e?.district || e?.block);

/** The server's `isOnboardingContent`, plus the two gates its callers add. */
const whyNotPublic = (e: CmsEvent): string => {
    if (e?.status !== 'published') return 'a draft';
    if (e?.audience === 'paid') return 'members-only';
    const onSite = e?.showOnOnboarding === true
        || ((e?.channel || 'public') === 'public' && !hasTargets(e));
    return onSite ? '' : 'not on the onboarding site';
};

const hasImage = (e: CmsEvent) => !!(e?.media?.url || e?.imageUrl);

export function HomeEventBannerPicker({ onChanged }: { onChanged?: () => void }) {
    const [events, setEvents] = useState<CmsEvent[] | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    const [openId, setOpenId] = useState<string | null>(null);
    const [words, setWords] = useState<BannerWords>({ headline: '', highlight: '', subheadline: '', align: 'left' });

    const load = async () => {
        setError('');
        try {
            setEvents(await getCmsEventsForEditor());
        } catch (err) {
            setError(errorMessage(err, 'Could not load the events'));
            setEvents([]);
        }
    };

    /* Once, on mount. */
    useEffect(() => { load(); }, []);

    const patchRow = (id: string, fields: Partial<CmsEvent>) =>
        setEvents((list) => (list || []).map((e) => (e.id === id ? { ...e, ...fields } : e)));

    const toggle = async (event: CmsEvent, next: boolean) => {
        setBusy(event.id);
        setError('');
        try {
            const back = await updateCmsEvent(event.id, { showInBanner: next });
            if (!back || (back.showInBanner === true) !== next) {
                const message = 'The server did not store this switch. Your backend is running an older build — '
                    + 'restart it (npm run dev), then try again.';
                setError(message);
                cmsFailed('the banner switch', message);
                return;
            }
            patchRow(event.id, { showInBanner: next });
            invalidateCmsCache();
            cmsSaved(next ? 'Added to the banner' : 'Taken off the banner');
            onChanged?.();
        } catch (err) {
            setError(errorMessage(err, 'Could not change that event'));
        } finally {
            setBusy(null);
        }
    };

    const openWords = (event: CmsEvent) => {
        if (openId === event.id) { setOpenId(null); return; }
        setOpenId(event.id);
        setWords({
            headline: event.bannerHeadline || '',
            highlight: event.bannerHighlight || '',
            subheadline: event.bannerSubheadline || '',
            align: event.bannerAlign === 'right' ? 'right' : 'left',
        });
    };

    const saveWords = async (event: CmsEvent) => {
        setBusy(event.id);
        setError('');
        const next = {
            bannerHeadline: words.headline.trim(),
            bannerHighlight: words.highlight.trim(),
            bannerSubheadline: words.subheadline.trim(),
            bannerAlign: words.align,
        };
        try {
            const back = await updateCmsEvent(event.id, next);
            /* An older backend answers 200 and drops these — say so. */
            const lost = (!!next.bannerHeadline && !back?.bannerHeadline)
                || (!!next.bannerSubheadline && !back?.bannerSubheadline)
                || (next.bannerAlign === 'right' && back?.bannerAlign !== 'right');
            if (lost) {
                const message = 'The server did not store these words. Your backend is running an older build — '
                    + 'restart it (npm run dev), then save again.';
                setError(message);
                cmsFailed('the banner words', message);
                return;
            }
            patchRow(event.id, next);
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

    if (events === null) {
        return (
            <p className="flex items-center gap-2 py-6 text-[1.0625rem] font-medium text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading the events…
            </p>
        );
    }

    /* A switched-on event only reaches the banner while the public can read it. */
    // `=== true` for the reason CarouselSection gives: a missing value is an old backend, not On.
    const isOn = (e: CmsEvent) => e.showInBanner === true;
    const isLive = (e: CmsEvent) => isOn(e) && !whyNotPublic(e) && hasImage(e);
    const onCount = events.filter(isOn).length;
    const liveCount = events.filter(isLive).length;
    const ordered = [...events].sort((a, b) => Number(isOn(b)) - Number(isOn(a)));
    const shown = ordered.slice(0, Math.max(onCount + 4, 12));

    return (
        <div>
            <CmsError message={error} />

            {events.length === 0 ? (
                <CmsEmpty
                    title="No events yet"
                    hint="Post an event under Events and it appears here, ready to switch into the banner."
                />
            ) : (
                <>
                    <p className="mb-3 text-[1.0625rem] font-semibold text-slate-500 dark:text-neutral-400">
                        {onCount} of {events.length} events are switched on.
                        {liveCount > 0 && <span>{' '}{liveCount} ride the banner now.</span>}
                        {onCount === 0 && (
                            <span className="text-slate-400">{' '}Switch one on to put it in the slideshow.</span>
                        )}
                    </p>

                    <ul className="space-y-2.5">
                        {shown.map((event) => {
                            const on = isOn(event);
                            const blocked = whyNotPublic(event);
                            const live = isLive(event);

                            return (
                                <li
                                    key={event.id}
                                    className={`rounded-xl border p-3 transition-colors
                                                ${live
                                            ? 'border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20'
                                            : 'border-slate-200 bg-white dark:border-[#232323] dark:bg-[#0d0d0d]'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="h-14 w-20 shrink-0 overflow-hidden rounded-lg
                                                         bg-slate-100 dark:bg-[#161616]">
                                            {hasImage(event) ? (
                                                <CmsMediaFrame
                                                    media={event.media?.url ? event.media : { ...event.media, url: event.imageUrl }}
                                                    width={160}
                                                />
                                            ) : (
                                                <span className="flex h-full w-full items-center justify-center
                                                                 text-slate-300 dark:text-neutral-700">
                                                    <CalendarDays className="h-5 w-5" />
                                                </span>
                                            )}
                                        </span>

                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-[1.1875rem] font-bold text-slate-900 dark:text-white">
                                                {event.title || 'Untitled event'}
                                            </p>
                                            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5
                                                          text-[1.0625rem] font-medium text-slate-500 dark:text-neutral-400">
                                                <span className="inline-flex items-center gap-1">
                                                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                                                    {dayOf(event.startAt) || 'Date to be confirmed'}
                                                </span>
                                                {!!(event.venue || event.location) && (
                                                    <span className="inline-flex min-w-0 max-w-[16rem] items-center gap-1">
                                                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                                                        <span className="truncate">{event.venue || event.location}</span>
                                                    </span>
                                                )}
                                                {blocked && (
                                                    <span className="font-bold text-amber-700 dark:text-amber-400">{blocked}</span>
                                                )}
                                                {!blocked && !hasImage(event) && (
                                                    <span className="font-bold text-amber-700 dark:text-amber-400">no picture yet</span>
                                                )}
                                                {live && (
                                                    <span className="font-bold text-blue-700 dark:text-blue-400">in the banner now</span>
                                                )}
                                                {live && (event.bannerHeadline || event.bannerHighlight || event.bannerSubheadline ? (
                                                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                                        own words · {event.bannerAlign === 'right' ? 'right' : 'left'}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400">shows its event title</span>
                                                ))}
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => openWords(event)}
                                            aria-expanded={openId === event.id}
                                            title="The heading, subheading and side shown over this event in the banner"
                                            className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5
                                                        text-[1.0625rem] font-semibold transition-colors
                                                        ${openId === event.id
                                                ? 'bg-blue-600 text-white'
                                                : 'text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40'}`}
                                        >
                                            <Type className="h-3.5 w-3.5" /> Banner words
                                        </button>

                                        <a
                                            href={`/cms/events?event=${encodeURIComponent(event.id)}`}
                                            title="Open this event on the Events screen to change its picture or details"
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
                                            onClick={() => toggle(event, !on)}
                                            disabled={busy === event.id || (!on && (!!blocked || !hasImage(event)))}
                                            title={blocked
                                                ? `This event is ${blocked}, so it cannot be in the banner`
                                                : !hasImage(event)
                                                    ? 'Add a picture to this event first — the banner is a picture'
                                                    : on ? 'Take it out of the banner' : 'Put it in the banner'}
                                            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border
                                                        px-3 py-1.5 text-[1.0625rem] font-bold transition-colors
                                                        disabled:opacity-40 ${on
                                                    ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                                                        + ' dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300'
                                                    : 'border-slate-300 bg-white text-slate-500 hover:bg-slate-100'
                                                        + ' dark:border-[#2a2a2a] dark:bg-[#111] dark:text-neutral-400'}`}
                                        >
                                            {busy === event.id
                                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                                : on ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                            {on ? 'On' : 'Off'}
                                        </button>
                                    </div>

                                    {/* Inline, not a dialog — see CLAUDE.md on native modals. */}
                                    {openId === event.id && (
                                        <div className="mt-3 space-y-3">
                                            <BannerWordsFields
                                                value={words}
                                                onChange={(next) => setWords((w) => ({ ...w, ...next }))}
                                                preview={resolveMediaUrl(event.media?.url || event.imageUrl || '')}
                                                whenBlank={`Leave them all blank and the event's own title and summary are shown instead ("${event.title || 'Untitled event'}").`}
                                                fallback={{ headline: event.title || '', subheadline: '' }}
                                            />
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setOpenId(null)}
                                                    disabled={busy === event.id}
                                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5
                                                               text-[1.0625rem] font-semibold text-slate-600 hover:bg-slate-100
                                                               dark:border-[#2a2a2a] dark:text-neutral-300"
                                                >
                                                    <X className="h-4 w-4" /> Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => saveWords(event)}
                                                    disabled={busy === event.id}
                                                    className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3.5 py-1.5
                                                               text-[1.0625rem] font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                                                >
                                                    {busy === event.id
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

                    <p className="mt-4 text-[1.0625rem] font-medium text-slate-400">
                        {ordered.length > shown.length
                            ? `Showing the switched-on events and a few more, of ${events.length}. `
                            : ''}
                        A switch saves on its own, straight away — it writes the event, not
                        this card. Off takes it out of the banner and leaves it on the events
                        page; to change its picture or details, open it with Edit.
                    </p>
                </>
            )}
        </div>
    );
}
