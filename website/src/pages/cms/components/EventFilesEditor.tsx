import { useEffect, useRef, useState } from 'react';
import { FileText, Loader2, Paperclip, Trash2, Upload, Youtube } from 'lucide-react';
import { uploadEventAttachment, type EventAttachment } from '@/services/cmsApi';
import { resolveMediaUrl } from '@/config/api.config';
import { isWhatsAppEventLink, normalizeWhatsAppEventLink, whatsappEventLinkFromClipboard } from '@/lib/whatsappEventLink';

/**
 * THE EVENT'S DOCUMENTS AND VIDEO — on the event form (CMS, Super Admin,
 * Events Admin alike).
 *
 * Any common file (PDF agenda, Word, Excel, slides, image, ZIP, up to 20 MB)
 * and one YouTube / video link. What is saved here reaches ONLY the people who
 * book — never the public event page or the public API (`withJoinLink` in
 * cms.service strips both, like the joining link):
 *   - the booking email (links, and files up to 8 MB attached)
 *   - WhatsApp (each PDF / office document sent as a file after the confirmation)
 */
export const sizeLabel = (bytes?: number) => {
    const n = Number(bytes) || 0;
    if (!n) return '';
    return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
};

export default function EventFilesEditor({
    attachments, videoUrl, whatsappChannelUrl = '', onChange,
}: {
    attachments: EventAttachment[];
    videoUrl: string;
    whatsappChannelUrl?: string;
    onChange: (next: { attachments?: EventAttachment[]; videoUrl?: string; whatsappChannelUrl?: string }) => void;
}) {
    const input = useRef<HTMLInputElement | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [linkTouched, setLinkTouched] = useState(false);
    const list = Array.isArray(attachments) ? attachments : [];
    const latest = useRef({ list, onChange });
    latest.current = { list, onChange };
    const alive = useRef(true);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const linkError = isWhatsAppEventLink(whatsappChannelUrl) ? ''
        : 'Paste a WhatsApp group invite (https://chat.whatsapp.com/...) or channel link.';

    const pick = async (files: FileList | null) => {
        const chosen = Array.from(files || []);
        if (!chosen.length) return;
        setBusy(true);
        setError('');
        const added: EventAttachment[] = [];
        for (const file of chosen.slice(0, 10 - list.length)) {
            if (file.size > 20 * 1024 * 1024) { setError(`${file.name} is larger than 20 MB.`); continue; }
            try {
                const up = await uploadEventAttachment(file);
                if (!alive.current) return;
                if (up.url) added.push(up);
            } catch (e: any) {
                if (!alive.current) return;
                setError(e?.response?.data?.message || e?.message || `Could not upload ${file.name}`);
            }
        }
        // A slow upload must not restore an old link, video, or event form.
        if (!alive.current) return;
        latest.current.onChange({ attachments: [...latest.current.list, ...added] });
        setBusy(false);
        if (input.current) input.current.value = '';
    };

    const rename = (i: number, name: string) =>
        onChange({ attachments: list.map((a, n) => (n === i ? { ...a, name } : a)) });
    const remove = (i: number) =>
        onChange({ attachments: list.filter((_, n) => n !== i) });

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-[#1F1F1F] dark:bg-[#0A0A0A]">
            <h3 className="flex items-center gap-2 text-[1.25rem] font-extrabold text-slate-900 dark:text-white">
                <Paperclip className="h-5 w-5 text-blue-600" /> WhatsApp group, documents &amp; video
            </h3>
            <p className="mt-1 text-[1.05rem] text-slate-500 dark:text-neutral-400">
                Upload the agenda or any file (PDF, Word, Excel, slides, image, ZIP — up to 20 MB) and add a YouTube link.
                They go to the people who register: linked (and small files attached) in the booking email, and
                optional supporting PDFs/documents sent after the main WhatsApp confirmation. The event banner stays on the main message.
                They are not shown on the public event page.
            </p>

            <label className="mt-4 block">
                <span className="mb-1.5 block text-[1.05rem] font-bold text-slate-700 dark:text-neutral-200">WhatsApp group or channel link</span>
                <input
                    type="text"
                    inputMode="url"
                    autoCapitalize="none"
                    spellCheck={false}
                    name="whatsappChannelUrl"
                    aria-describedby="event-whatsapp-link-hint"
                    aria-invalid={linkTouched && !!linkError}
                    ref={(element) => { element?.setCustomValidity(linkError); }}
                    value={whatsappChannelUrl}
                    onChange={(e) => onChange({ whatsappChannelUrl: e.target.value })}
                    onBlur={() => {
                        setLinkTouched(true);
                        onChange({ whatsappChannelUrl: normalizeWhatsAppEventLink(whatsappChannelUrl) });
                    }}
                    onInvalid={() => setLinkTouched(true)}
                    onPaste={(e) => {
                        const link = whatsappEventLinkFromClipboard(e.clipboardData.getData('text'));
                        if (link) {
                            e.preventDefault();
                            onChange({ whatsappChannelUrl: link });
                        }
                        setLinkTouched(true);
                    }}
                    placeholder="https://chat.whatsapp.com/..."
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[1.1rem] outline-none focus:border-blue-500 dark:border-[#262626] dark:bg-[#0b0b0b] dark:text-white"
                />
                <span id="event-whatsapp-link-hint" className={`mt-1 block text-sm ${linkTouched && linkError ? 'text-red-600' : 'text-slate-500'}`}>
                    {linkTouched && linkError ? linkError : 'Optional. Paste the invite link, then save the event. Included in booking confirmations and reminders.'}
                </span>
            </label>

            {/* Video */}
            <label className="mt-4 block">
                <span className="mb-1.5 flex items-center gap-2 text-[1.05rem] font-bold text-slate-700 dark:text-neutral-200">
                    <Youtube className="h-4 w-4 text-red-600" /> YouTube or video link
                </span>
                <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => onChange({ videoUrl: e.target.value })}
                    placeholder="https://www.youtube.com/watch?v=…"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 sm:px-4 text-[1.1rem] outline-none
                               focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10
                               dark:border-[#262626] dark:bg-[#0b0b0b] dark:text-white"
                />
            </label>

            {/* Files */}
            <div className="mt-5">
                <input
                    ref={input}
                    type="file"
                    multiple
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.rtf,.txt,.csv,.zip,image/*"
                    onChange={(e) => pick(e.target.files)}
                />
                <button
                    type="button"
                    disabled={busy || list.length >= 10}
                    onClick={() => input.current?.click()}
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50/60
                               px-5 text-[1.05rem] font-bold text-blue-700 transition hover:bg-blue-50 disabled:opacity-50
                               dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300"
                >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {busy ? 'Uploading…' : 'Upload files'}
                </button>
                {error && <p className="mt-2 text-[1rem] font-semibold text-red-600">{error}</p>}

                {list.length > 0 && (
                    <ul className="mt-4 space-y-2">
                        {list.map((a, i) => (
                            <li key={`${a.url}-${i}`}
                                className="flex flex-wrap items-center gap-2 sm:gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3
                                           dark:border-[#2a2a2a] dark:bg-[#0f0f0f]">
                                <FileText className="h-5 w-5 shrink-0 text-blue-600" />
                                <input
                                    value={a.name}
                                    onChange={(e) => rename(i, e.target.value)}
                                    aria-label="Document name"
                                    className="!min-w-[10rem] flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1
                                               text-[1.05rem] font-semibold text-slate-800 hover:border-slate-200 focus:border-blue-400 focus:bg-white outline-none
                                               dark:text-neutral-100 dark:hover:border-[#2a2a2a] dark:focus:bg-black"
                                />
                                <span className="text-[0.95rem] text-slate-500">{sizeLabel(a.size)}</span>
                                <a href={resolveMediaUrl(a.url)} target="_blank" rel="noopener noreferrer"
                                   className="px-1 py-2 text-[0.95rem] font-bold text-blue-700 hover:underline dark:text-blue-400">Open</a>
                                <button type="button" onClick={() => remove(i)} aria-label={`Remove ${a.name}`}
                                        className="rounded-lg p-2.5 sm:p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40">
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}
