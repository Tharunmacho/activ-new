import { useState } from 'react';
import { ExternalLink, ZoomIn, ZoomOut } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { resolveMediaUrl, sizedMediaUrl } from '@/config/api.config';

/** Letters keep their page proportions; the viewer loads the original upload. */
export function NewsImage({ url, alt, lazy = false }: { url: string; alt: string; lazy?: boolean }) {
    const [zoom, setZoom] = useState(1);
    const [failed, setFailed] = useState(false);
    const original = resolveMediaUrl(url);
    return (
        <Dialog onOpenChange={() => { setZoom(1); setFailed(false); }}>
            <DialogTrigger asChild>
                <button type="button" className="block w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
                    aria-label={`Enlarge image: ${alt}`}>
                    <img src={sizedMediaUrl(url, 1600)} alt={alt} loading={lazy ? 'lazy' : 'eager'}
                        className="block h-auto w-full object-contain" />
                    <span className="flex items-center justify-center gap-2 border-t border-slate-100 px-3 py-3 text-base font-semibold text-brand-700">
                        <ZoomIn size={18} /> Tap to enlarge and zoom
                    </span>
                </button>
            </DialogTrigger>
            <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 rounded-none border-0 bg-slate-950 p-0 text-white sm:rounded-none [&>button]:z-10 [&>button]:rounded-full [&>button]:bg-slate-800 [&>button]:p-3 [&>button]:opacity-100">
                <div className="shrink-0 border-b border-white/20 px-4 py-4 pr-16">
                    <DialogTitle className="truncate text-lg">{alt || 'News image'}</DialogTitle>
                    <DialogDescription className="mt-1 text-sm text-slate-300">Zoom in to read. Scroll to move around the image.</DialogDescription>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/20 px-4 py-2 text-sm">
                    <button type="button" aria-label="Zoom out" disabled={zoom <= 1} onClick={() => setZoom(value => Math.max(1, value - 0.5))}
                        className="rounded-lg bg-white/10 p-3 disabled:opacity-40"><ZoomOut size={20} /></button>
                    <span aria-live="polite" className="min-w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
                    <button type="button" aria-label="Zoom in" disabled={zoom >= 4} onClick={() => setZoom(value => Math.min(4, value + 0.5))}
                        className="rounded-lg bg-white/10 p-3 disabled:opacity-40"><ZoomIn size={20} /></button>
                    <button type="button" onClick={() => setZoom(1)} className="rounded-lg bg-white/10 px-3 py-3">Fit width</button>
                    <a href={original} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-3">
                        <ExternalLink size={16} /> Original
                    </a>
                </div>
                <div className="min-h-0 flex-1 overflow-auto overscroll-contain" tabIndex={0} aria-label="Image viewing area">
                    {failed ? <p role="alert" className="p-6">The image could not be loaded. Try opening the original above.</p> :
                        <img src={original} alt={alt} onError={() => setFailed(true)}
                            className="block h-auto max-w-none bg-white" style={{ width: `${zoom * 100}%` }} />}
                </div>
            </DialogContent>
        </Dialog>
    );
}
