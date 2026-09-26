import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Download, QrCode, Share2, X } from 'lucide-react';
import { eventPath } from '@/lib/eventPath';

/**
 * AN EVENT'S QR CODE — one implementation for the editor and the event page.
 *
 * It encodes the event's PUBLIC address (`/events/<slug>`, see lib/eventPath),
 * so a phone that scans it lands on that event's page, whoever made it (CMS,
 * Super Admin or Events Admin) and wherever it is printed. The address is fixed
 * once created, so a QR on a printed flyer keeps working when the event is
 * retitled.
 *
 * The DOWNLOAD is not the bare code: it is a ready-to-post card (title, date,
 * the code, the address) because a lone black square on a WhatsApp status says
 * nothing about what it opens.
 */

interface QrEvent {
    id?: string;
    slug?: string;
    title?: string;
    startAt?: string | null;
}

const NAVY = '#1e3a8a';

/** The address the code opens, on this site's own origin. */
export const eventPublicUrl = (event?: QrEvent | null): string =>
    `${window.location.origin}${eventPath(event)}`;

/** A data: URL of the bare code, regenerated when the address changes. */
export const useEventQr = (url: string, size = 640): string => {
    const [src, setSrc] = useState('');
    useEffect(() => {
        let live = true;
        if (!url) { setSrc(''); return undefined; }
        QRCode.toDataURL(url, { width: size, margin: 1, errorCorrectionLevel: 'M', color: { dark: NAVY, light: '#ffffff' } })
            .then((data) => { if (live) setSrc(data); })
            .catch(() => { if (live) setSrc(''); });
        return () => { live = false; };
    }, [url, size]);
    return src;
};

const dateLine = (startAt?: string | null): string => {
    const d = startAt ? new Date(startAt) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
    }) + ' IST';
};

/** Word-wrap for canvas text, at most `maxLines` lines. */
const wrap = (ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number): string[] => {
    const words = (text || '').split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
        const next = line ? `${line} ${w}` : w;
        if (ctx.measureText(next).width > width && line) {
            lines.push(line);
            line = w;
            if (lines.length === maxLines) break;
        } else {
            line = next;
        }
    }
    if (line && lines.length < maxLines) lines.push(line);
    return lines;
};

/** The ready-to-post card: 1080 x 1350 PNG with the title, date, code and address. */
const posterBlob = async (event: QrEvent, url: string): Promise<Blob | null> => {
    try {
        const qr = await QRCode.toDataURL(url, { width: 760, margin: 1, errorCorrectionLevel: 'M', color: { dark: NAVY, light: '#ffffff' } });
        const img = new Image();
        await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = () => fail(); img.src = qr; });

        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1350;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        const font = "'Poppins', 'Segoe UI', Arial, sans-serif";

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 1080, 1350);
        const grad = ctx.createLinearGradient(0, 0, 1080, 0);
        grad.addColorStop(0, '#172554');
        grad.addColorStop(1, '#2563eb');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1080, 150);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.font = `800 54px ${font}`;
        ctx.fillText('ACTIV', 540, 82);
        ctx.font = `500 22px ${font}`;
        ctx.fillText('Adidravidar Confederation of Trade & Industrial Vision', 540, 122);

        ctx.fillStyle = '#0f172a';
        ctx.font = `800 50px ${font}`;
        const titleLines = wrap(ctx, event.title || 'ACTIV event', 940, 3);
        titleLines.forEach((l, i) => ctx.fillText(l, 540, 235 + i * 62));
        let y = 235 + titleLines.length * 62;

        const when = dateLine(event.startAt);
        if (when) {
            ctx.fillStyle = '#475569';
            ctx.font = `500 30px ${font}`;
            ctx.fillText(when, 540, y + 6);
            y += 44;
        }

        const qrSize = Math.min(760, 1350 - y - 190);
        const qrX = (1080 - qrSize) / 2;
        const qrY = y + 20;
        ctx.strokeStyle = '#dbe4fb';
        ctx.lineWidth = 4;
        ctx.strokeRect(qrX - 22, qrY - 22, qrSize + 44, qrSize + 44);
        ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

        ctx.fillStyle = NAVY;
        ctx.font = `700 34px ${font}`;
        ctx.fillText('Scan to view details & book your seat', 540, qrY + qrSize + 80);
        ctx.fillStyle = '#64748b';
        ctx.font = `500 22px ${font}`;
        const shortUrl = url.replace(/^https?:\/\//, '');
        wrap(ctx, shortUrl.replace(/\//g, '/ '), 1000, 2)
            .forEach((l, i) => ctx.fillText(l.replace(/\/ /g, '/'), 540, qrY + qrSize + 122 + i * 30));

        return await new Promise<Blob | null>((ok) => canvas.toBlob((b) => ok(b), 'image/png'));
    } catch {
        return null;
    }
};

const fileNameOf = (event: QrEvent) => `${(event.slug || event.id || 'event').slice(0, 80)}-qr.png`;

const downloadPoster = async (event: QrEvent, url: string) => {
    const blob = await posterBlob(event, url);
    if (!blob) return;
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = fileNameOf(event);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 2000);
};

/**
 * Share the card where the device can (phones: WhatsApp, Instagram, …), the
 * link on WhatsApp otherwise.
 */
const sharePoster = async (event: QrEvent, url: string) => {
    const text = `${event.title || 'ACTIV event'} — ${url}`;
    try {
        const blob = await posterBlob(event, url);
        const file = blob ? new File([blob], fileNameOf(event), { type: 'image/png' }) : null;
        const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
        if (file && nav.share && nav.canShare?.({ files: [file] })) {
            await nav.share({ files: [file], title: event.title || 'ACTIV event', text });
            return;
        }
        if (nav.share) {
            await nav.share({ title: event.title || 'ACTIV event', text, url });
            return;
        }
    } catch {
        return; // cancelled by the user
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
};

const BTN = 'inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-[0.95rem] font-bold transition-colors';

/* ------------------------------------------------------------------------ */
/*  The card on the public event page                                        */
/* ------------------------------------------------------------------------ */
export function EventQrCard({ event }: { event: QrEvent }) {
    const url = eventPublicUrl(event);
    const src = useEventQr(url, 480);
    if (!src) return null;
    return (
        <div className="flex items-center gap-5 rounded-2xl border border-brand-100 bg-white p-5">
            <img src={src} alt={`QR code for ${event.title || 'this event'}`} width={132} height={132}
                 className="h-[132px] w-[132px] shrink-0 rounded-lg border border-slate-200 p-1.5" />
            <div className="min-w-0">
                <p className="text-[0.8rem] font-extrabold uppercase tracking-widest text-brand-700">Scan to open</p>
                <p className="mt-1 text-[1rem] font-semibold leading-snug text-slate-800">
                    Point your phone camera here to open this event and book on the go.
                </p>
                <button type="button" onClick={() => downloadPoster(event, url)}
                        className={`${BTN} mt-3 h-10 border border-brand-200 bg-white text-brand-800 hover:bg-brand-50`}>
                    <Download size={16} /> Download QR
                </button>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------------ */
/*  The panel in the editor (CMS, Super Admin, Events Admin)                 */
/* ------------------------------------------------------------------------ */
export function EventQrDialog({
    event, onClose, showOnPage, onToggleShowOnPage, justCreated = false,
}: {
    event: QrEvent;
    onClose: () => void;
    showOnPage: boolean;
    onToggleShowOnPage?: (next: boolean) => void | Promise<void>;
    justCreated?: boolean;
}) {
    const url = eventPublicUrl(event);
    const src = useEventQr(url, 640);
    const [copied, setCopied] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch { /* clipboard blocked */ }
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-4" role="dialog"
             aria-modal="true" aria-label="Event QR code" onClick={onClose}>
            <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl"
                 onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-4">
                    <div className="min-w-0">
                        <p className="flex items-center gap-2 text-[0.8rem] font-extrabold uppercase tracking-widest text-brand-700">
                            <QrCode size={15} /> {justCreated ? 'Event created — QR ready' : 'Event QR code'}
                        </p>
                        <p className="mt-1 truncate text-[1.05rem] font-bold text-slate-900">{event.title || 'Untitled event'}</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close"
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
                </div>

                <div className="px-6 py-5">
                    <div className="mx-auto w-fit rounded-xl border border-slate-200 p-3">
                        {src
                            ? <img src={src} alt="Event QR code" width={240} height={240} className="h-60 w-60" />
                            : <div className="h-60 w-60 animate-pulse rounded bg-slate-100" />}
                    </div>
                    <p className="mt-3 text-center text-[0.9rem] text-slate-600">
                        Scanning opens this event&apos;s page on the phone.
                    </p>
                    <p className="mt-1 break-all text-center text-[0.8rem] font-semibold text-slate-500">{url}</p>

                    <div className="mt-5 grid grid-cols-3 gap-2">
                        <button type="button" onClick={() => downloadPoster(event, url)}
                                className={`${BTN} bg-brand-800 text-white hover:bg-brand-900`}>
                            <Download size={16} /> Download
                        </button>
                        <button type="button" onClick={() => sharePoster(event, url)}
                                className={`${BTN} border border-brand-200 bg-white text-brand-800 hover:bg-brand-50`}>
                            <Share2 size={16} /> Share
                        </button>
                        <button type="button" onClick={copy}
                                className={`${BTN} border border-brand-200 bg-white text-brand-800 hover:bg-brand-50`}>
                            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy link'}
                        </button>
                    </div>

                    {onToggleShowOnPage && (
                        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <input type="checkbox" className="mt-1 h-4 w-4 accent-blue-800" checked={showOnPage} disabled={busy}
                                   onChange={async (e) => {
                                       setBusy(true);
                                       try { await onToggleShowOnPage(e.target.checked); } finally { setBusy(false); }
                                   }} />
                            <span>
                                <span className="block text-[0.95rem] font-bold text-slate-900">Show this QR on the event page</span>
                                <span className="block text-[0.85rem] text-slate-600">
                                    Visitors can scan it from a screen or projector, or download it.
                                </span>
                            </span>
                        </label>
                    )}
                </div>
            </div>
        </div>
    );
}
