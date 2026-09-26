import { Download, FileText, PlayCircle } from 'lucide-react';
import { resolveMediaUrl } from '@/config/api.config';
import type { EventAttachment } from '@/services/cmsApi';

/** "https://youtu.be/abc" / "…watch?v=abc" / "…/shorts/abc" → the embeddable address, or '' */
export const youtubeEmbed = (url?: string): string => {
    const u = String(url || '').trim();
    const m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
    return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : '';
};

const sizeLabel = (bytes?: number) => {
    const n = Number(bytes) || 0;
    if (!n) return '';
    return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
};

const kindOf = (a: EventAttachment) => {
    const t = `${a.type || ''} ${a.url || ''}`.toLowerCase();
    if (t.includes('pdf')) return 'PDF';
    if (/word|\.docx?/.test(t)) return 'Word';
    if (/sheet|excel|\.xlsx?|csv/.test(t)) return 'Excel';
    if (/presentation|powerpoint|\.pptx?/.test(t)) return 'Slides';
    if (/image\//.test(t)) return 'Image';
    if (/zip/.test(t)) return 'ZIP';
    return 'File';
};

/**
 * The event's video and documents, on the event page. Nothing is drawn when
 * the event has neither. A YouTube link plays in place; any other video link
 * is offered as a button.
 */
export function EventMediaFiles({ videoUrl, attachments }: { videoUrl?: string; attachments?: EventAttachment[] }) {
    const files = (Array.isArray(attachments) ? attachments : []).filter((a) => a && a.url);
    const embed = youtubeEmbed(videoUrl);
    if (!files.length && !videoUrl) return null;

    return (
        <section aria-label="Event video and documents" className="space-y-5">
            {videoUrl && (embed ? (
                <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-black shadow-sm">
                    <div className="aspect-video">
                        <iframe
                            src={embed}
                            title="Event video"
                            loading="lazy"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="h-full w-full"
                        />
                    </div>
                </div>
            ) : (
                <a href={videoUrl} target="_blank" rel="noopener noreferrer"
                   className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 font-bold text-blue-700 hover:bg-blue-50">
                    <PlayCircle className="h-6 w-6" /> Watch the event video
                </a>
            ))}

            {files.length > 0 && (
                <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 sm:p-7">
                    <h2 className="text-[1.35rem] font-extrabold text-slate-900">Agenda &amp; documents</h2>
                    <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                        {files.map((a, i) => (
                            <li key={`${a.url}-${i}`}>
                                <a
                                    href={resolveMediaUrl(a.url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download={a.name || true}
                                    className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4
                                               transition hover:border-blue-300 hover:bg-blue-50 active:scale-[0.99]"
                                >
                                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-blue-600 ring-1 ring-slate-200">
                                        <FileText className="h-5 w-5" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[1.05rem] font-bold text-slate-900">{a.name || 'Document'}</span>
                                        <span className="block text-[0.9rem] text-slate-500">
                                            {[kindOf(a), sizeLabel(a.size)].filter(Boolean).join(' · ')}
                                        </span>
                                    </span>
                                    <Download className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:text-blue-600" />
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}

export default EventMediaFiles;
