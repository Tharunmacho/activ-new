import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { resolveMediaUrl, sizedMediaUrl } from '@/config/api.config';

export interface LightboxPhoto {
    url: string;
    type?: 'image' | 'video';
    alt?: string;
    caption?: string;
}

/** Full-screen album using the shared dialog's focus trap and Escape handling. */
export function PhotoLightbox({ photos, index, onIndex, onClose, title }: {
    photos: LightboxPhoto[];
    index: number;
    onIndex: (next: number) => void;
    onClose: () => void;
    title?: string;
}) {
    const returnFocus = useRef<HTMLElement | null>(null);
    const stripRef = useRef<HTMLDivElement>(null);
    const open = index >= 0 && index < photos.length;
    const photo = photos[index];
    const go = (step: number) => onIndex((index + step + photos.length) % photos.length);

    useEffect(() => {
        if (open) stripRef.current?.querySelector<HTMLElement>(`[data-thumb="${index}"]`)
            ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }, [open, index]);

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
            {open && <DialogContent
                style={{ animation: 'none' }}
                className="z-[1000] flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 rounded-none border-0 bg-slate-950 p-0 text-white sm:rounded-none [&>button]:z-10 [&>button]:rounded-full [&>button]:bg-slate-800 [&>button]:p-3 [&>button]:opacity-100 [&>button]:!text-white"
                onOpenAutoFocus={() => { returnFocus.current = document.activeElement as HTMLElement; }}
                onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    if (returnFocus.current?.isConnected) returnFocus.current.focus();
                }}
                onKeyDown={(event) => {
                    if (event.key === 'ArrowRight' && photos.length > 1) { event.preventDefault(); go(1); }
                    if (event.key === 'ArrowLeft' && photos.length > 1) { event.preventDefault(); go(-1); }
                }}
            >
                <div className="shrink-0 border-b border-white/20 px-4 py-3 pr-16 sm:px-6 sm:pr-16 [@media(max-height:480px)]:py-2">
                    <DialogTitle className="truncate text-lg">{title || 'Photo album'}</DialogTitle>
                    <DialogDescription className="mt-1 text-sm text-slate-300 [@media(max-height:480px)]:sr-only">
                        Use the arrows to browse. Zoom in, then drag or scroll to move around the photo.
                    </DialogDescription>
                </div>
                <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-2">
                    <button type="button" disabled={photos.length < 2} onClick={() => go(-1)} aria-label="Previous photo"
                        className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40">
                        <ChevronLeft size={24} />
                    </button>
                    <p aria-live="polite" aria-atomic="true" className="text-sm text-slate-200">Photo {index + 1} of {photos.length}</p>
                    <button type="button" disabled={photos.length < 2} onClick={() => go(1)} aria-label="Next photo"
                        className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40">
                        <ChevronRight size={24} />
                    </button>
                </div>
                {photo.type === 'video'
                    ? <div className="flex min-h-0 flex-1 items-center justify-center"><video key={photo.url} src={resolveMediaUrl(photo.url)} controls className="max-h-full max-w-full" /></div>
                    : <ZoomablePhoto key={`${index}:${photo.url}`} photo={photo} title={title} />}
                {photo.caption && <p className="max-h-[15dvh] shrink-0 overflow-y-auto whitespace-pre-line break-words px-4 py-2 text-center text-sm text-slate-200 [@media(max-height:480px)]:max-h-8 [@media(max-height:480px)]:py-1">{photo.caption}</p>}
                {photos.length > 1 && <div ref={stripRef} aria-label="Album thumbnails" className="flex shrink-0 gap-2 overflow-x-auto px-4 py-3 [@media(max-height:480px)]:py-2">
                    {photos.map((item, position) => <button key={`${item.url}-${position}`} type="button"
                        data-thumb={position} onClick={() => onIndex(position)} aria-label={`View photo ${position + 1}: ${item.alt || 'Photograph'}`}
                        aria-current={position === index ? 'true' : undefined}
                        className={`h-14 w-16 shrink-0 overflow-hidden rounded-md border-2 sm:h-16 sm:w-20 [@media(max-height:480px)]:h-10 [@media(max-height:480px)]:w-12 ${position === index ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                        {item.type === 'video' ? <span className="text-sm">Video</span> : <img src={sizedMediaUrl(item.url, 200)} alt="" loading="lazy" className="h-full w-full object-cover" />}
                    </button>)}
                </div>}
            </DialogContent>}
        </Dialog>
    );
}

function ZoomablePhoto({ photo, title }: { photo: LightboxPhoto; title?: string }) {
    const [zoom, setZoom] = useState(1);
    const [failed, setFailed] = useState(false);
    const [natural, setNatural] = useState({ width: 0, height: 0 });
    const [viewport, setViewport] = useState({ width: 0, height: 0 });
    const area = useRef<HTMLDivElement>(null);
    const previousZoom = useRef(1);
    const drag = useRef<{ id: number; x: number; y: number; left: number; top: number } | null>(null);
    const fit = natural.width && viewport.width
        ? Math.min(viewport.width / natural.width, viewport.height / natural.height) : 0;
    const width = natural.width * fit * zoom;
    const height = natural.height * fit * zoom;

    useLayoutEffect(() => {
        const element = area.current;
        if (!element) return;
        const measure = () => setViewport({ width: element.clientWidth, height: element.clientHeight });
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    // Keep the middle of the viewed image in place when changing magnification.
    useLayoutEffect(() => {
        const element = area.current;
        if (!element) return;
        const ratio = zoom / previousZoom.current;
        element.scrollLeft = zoom === 1 ? 0 : (element.scrollLeft + element.clientWidth / 2) * ratio - element.clientWidth / 2;
        element.scrollTop = zoom === 1 ? 0 : (element.scrollTop + element.clientHeight / 2) * ratio - element.clientHeight / 2;
        previousZoom.current = zoom;
    }, [zoom]);

    const changeZoom = (step: number) => setZoom(value => Math.max(1, Math.min(4, value + step)));
    useEffect(() => {
        const handleKey = (event: KeyboardEvent) => {
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoom(value => Math.min(4, value + 0.5)); }
            if (event.key === '-') { event.preventDefault(); setZoom(value => Math.max(1, value - 0.5)); }
            if (event.key === '0') { event.preventDefault(); setZoom(1); }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, []);
    return <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-center gap-2 border-b border-white/20 px-3 pb-2 text-sm">
            <button type="button" aria-label="Zoom out" disabled={zoom <= 1 || failed} onClick={() => changeZoom(-0.5)} className="rounded-lg bg-white/10 p-3 disabled:opacity-40"><ZoomOut size={20} /></button>
            <output aria-label="Zoom level" className="min-w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</output>
            <button type="button" aria-label="Zoom in" disabled={zoom >= 4 || failed} onClick={() => changeZoom(0.5)} className="rounded-lg bg-white/10 p-3 disabled:opacity-40"><ZoomIn size={20} /></button>
            <button type="button" onClick={() => setZoom(1)} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-3"><RotateCcw size={16} />Fit photo</button>
        </div>
        <div ref={area} tabIndex={0} aria-label="Image viewing area" className="min-h-0 flex-1 overflow-auto overscroll-contain outline-offset-[-3px]"
            style={{ cursor: zoom > 1 ? 'grab' : 'zoom-in' }}
            onDoubleClick={() => setZoom(value => value === 1 ? 2 : 1)}
            onPointerDown={(event) => {
                if (zoom <= 1 || event.pointerType !== 'mouse' || event.button !== 0) return;
                event.preventDefault();
                event.currentTarget.focus();
                drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop };
                event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
                if (!drag.current || drag.current.id !== event.pointerId) return;
                event.currentTarget.scrollLeft = drag.current.left - event.clientX + drag.current.x;
                event.currentTarget.scrollTop = drag.current.top - event.clientY + drag.current.y;
            }}
            onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
            {failed ? <p role="alert" className="p-6 text-center">This photo could not be loaded. Choose another photo or try again later.</p>
                : <div className="flex items-center justify-center" style={{ width: Math.max(viewport.width, width), height: Math.max(viewport.height, height) }}>
                    <img src={resolveMediaUrl(photo.url)} alt={photo.alt || photo.caption || title || 'Photograph'} draggable={false}
                        onLoad={(event) => setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
                        onError={() => setFailed(true)} className="block max-w-none select-none object-contain"
                        style={{ width: width || undefined, height: height || undefined, visibility: fit ? 'visible' : 'hidden' }} />
                </div>}
        </div>
    </div>;
}

export default PhotoLightbox;
