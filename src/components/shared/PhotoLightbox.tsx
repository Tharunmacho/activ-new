import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { sizedMediaUrl } from '@/config/api.config';

/**
 * ============================================================================
 * THE PHOTO VIEWER — one photograph large, its description, and the rest
 * ============================================================================
 *
 * Opened from an album on `/gallery/:id`. It shows the chosen photograph as
 * large as the screen allows, its description underneath, a counter, arrows
 * to step through the album, and a strip of thumbnails to jump anywhere in it.
 *
 * Keyboard: ← and → step, Esc closes. The page behind does not scroll while it
 * is open, and focus goes to the close button so a keyboard user is inside it.
 *
 * A portal on <body>, so no card with `overflow: hidden` can clip it — the
 * fault the phone-number country list had.
 */

export interface LightboxPhoto {
    url: string;
    type?: 'image' | 'video';
    alt?: string;
    caption?: string;
}

export function PhotoLightbox({ photos, index, onIndex, onClose, title }: {
    photos: LightboxPhoto[];
    /** The photo showing, or -1 when the viewer is closed. */
    index: number;
    onIndex: (next: number) => void;
    onClose: () => void;
    /** The album's name, printed above the counter. */
    title?: string;
}) {
    const closeRef = useRef<HTMLButtonElement | null>(null);
    const stripRef = useRef<HTMLDivElement | null>(null);
    const open = index >= 0 && index < photos.length;
    const count = photos.length;

    const go = (step: number) => {
        if (!count) return;
        onIndex((index + step + count) % count);
    };

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowRight') go(1);
            else if (e.key === 'ArrowLeft') go(-1);
        };
        window.addEventListener('keydown', onKey);
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = previous;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, index, count]);

    useEffect(() => { if (open) closeRef.current?.focus(); }, [open]);

    /* Keep the current thumbnail in view as the reader steps through. */
    useEffect(() => {
        if (!open) return;
        const thumb = stripRef.current?.querySelector<HTMLElement>(`[data-thumb="${index}"]`);
        thumb?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }, [open, index]);

    if (!open || typeof document === 'undefined') return null;
    const photo = photos[index];

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-label={title ? `${title} — photo ${index + 1} of ${count}` : `Photo ${index + 1} of ${count}`}
            /*
              * OPAQUE, not 95%.
              *
              * Five per cent of a near-white page is enough to read the
              * headline and the navigation straight through the backdrop,
              * which is what this screen is for getting AWAY from — the
              * photograph is meant to be the only thing on the screen. The
              * translucency bought nothing: there is no depth to suggest,
              * because nothing behind it is part of the same view.
              */
            className="fixed inset-0 z-[1000] flex flex-col bg-slate-950 text-white"
        >
            {/* ---- top bar ---- */}
            <div className="flex items-center gap-4 px-4 py-3 sm:px-6">
                <div className="min-w-0 flex-1">
                    {title && <p className="truncate text-[1.125rem] font-bold">{title}</p>}
                    <p className="text-[1rem] text-white/60">{index + 1} of {count}</p>
                </div>
                <button
                    ref={closeRef}
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
                >
                    <X size={22} />
                </button>
            </div>

            {/* ---- the photograph ---- */}
            <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 sm:px-20">
                {photo.type === 'video' ? (
                    <video key={photo.url} src={sizedMediaUrl(photo.url, 1600)} controls
                           className="max-h-full max-w-full rounded-lg" />
                ) : (
                    <img
                        key={photo.url}
                        src={sizedMediaUrl(photo.url, 1600)}
                        alt={photo.alt || photo.caption || title || 'Photograph'}
                        className="max-h-full max-w-full rounded-lg object-contain"
                    />
                )}

                {count > 1 && (
                    <>
                        <button type="button" onClick={() => go(-1)} aria-label="Previous photo"
                                className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center
                                           rounded-full bg-white/10 transition-colors hover:bg-white/25 sm:left-5">
                            <ChevronLeft size={26} />
                        </button>
                        <button type="button" onClick={() => go(1)} aria-label="Next photo"
                                className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center
                                           rounded-full bg-white/10 transition-colors hover:bg-white/25 sm:right-5">
                            <ChevronRight size={26} />
                        </button>
                    </>
                )}
            </div>

            {/* ---- its description ---- */}
            <div className="mx-auto w-full max-w-3xl px-5 pt-4 text-center">
                {photo.caption ? (
                    <p className="whitespace-pre-line text-[1.125rem] leading-relaxed text-white/90">{photo.caption}</p>
                ) : null}
            </div>

            {/* ---- the rest of the album ---- */}
            {count > 1 && (
                <div ref={stripRef} className="flex gap-2 overflow-x-auto px-4 py-4 sm:justify-center sm:px-6">
                    {photos.map((p, i) => (
                        <button
                            key={`${p.url}-${i}`}
                            type="button"
                            data-thumb={i}
                            onClick={() => onIndex(i)}
                            aria-label={`Photo ${i + 1}`}
                            aria-current={i === index ? 'true' : undefined}
                            className={`h-16 w-20 shrink-0 overflow-hidden rounded-md ring-2 transition ${i === index
                                ? 'ring-white opacity-100'
                                : 'ring-transparent opacity-50 hover:opacity-90'}`}
                        >
                            {p.type === 'video'
                                ? <span className="flex h-full w-full items-center justify-center bg-white/10 text-[0.875rem]">Video</span>
                                : <img src={sizedMediaUrl(p.url, 200)} alt="" className="h-full w-full object-cover" />}
                        </button>
                    ))}
                </div>
            )}
        </div>,
        document.body,
    );
}

export default PhotoLightbox;
