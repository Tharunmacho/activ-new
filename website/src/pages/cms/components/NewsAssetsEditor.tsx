import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, FileText, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { uploadEventAttachment, uploadMedia } from '@/services/cmsApi';
import { errorMessage } from '@/services/api';
import type { NewsArticle, NewsMedia } from '@/services/cmsNewsApi';
import { resolveMediaUrl, sizedMediaUrl } from '@/config/api.config';
import { NEWS_ATTACHMENT_LIMIT, NEWS_DOCUMENT_ACCEPT, NEWS_LINK_LIMIT, NEWS_PHOTO_LIMIT, newsDocumentHref, newsFileSize } from '@/lib/newsContent';
import { CmsButton, CmsField, CmsInput } from './CmsUI';

const image = (url: string, alt = ''): NewsMedia => ({ url, alt, type: 'image', fit: 'contain', position: 'center' });
const actionClass = 'inline-flex min-h-12 min-w-12 max-w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-ui-small font-semibold leading-snug text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800';
const groupClass = 'min-w-0 space-y-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-6 dark:border-neutral-700 dark:bg-neutral-950/40';
const legendClass = 'px-2 text-[1.375rem] font-bold leading-snug text-slate-900 dark:text-white';
const hintClass = 'text-ui-small leading-relaxed text-slate-600 dark:text-neutral-300';
const itemClass = 'min-w-0 space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900';

/** Files upload first; Save article commits their ordered URLs and labels. */
export function NewsAssetsEditor({ article, onChange, onBusyChange, disabled = false }: {
    article: Partial<NewsArticle>;
    onChange: (patch: Partial<NewsArticle>) => void;
    onBusyChange: (busy: boolean) => void;
    disabled?: boolean;
}) {
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState('');
    const [errors, setErrors] = useState<string[]>([]);
    const latest = useRef({ article, onChange, onBusyChange });
    latest.current = { article, onChange, onBusyChange };
    const alive = useRef(true), working = useRef(false);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const photos = Array.isArray(article.photos) ? article.photos : [];
    const attachments = Array.isArray(article.attachments) ? article.attachments : [];
    const links = Array.isArray(article.links) ? article.links : [];
    const locked = disabled || busy;

    const upload = async (files: File[], kind: 'cover' | 'photos' | 'documents') => {
        if (!files.length || working.current || disabled) return;
        const limit = kind === 'photos' ? NEWS_PHOTO_LIMIT - photos.length : kind === 'documents' ? NEWS_ATTACHMENT_LIMIT - attachments.length : 1;
        if (files.length > limit) {
            setErrors([`There is room for ${Math.max(0, limit)} more ${kind === 'documents' ? 'documents' : 'photos'}. Choose fewer files or remove an existing item.`]);
            return;
        }
        working.current = true; setBusy(true); setErrors([]);
        latest.current.onBusyChange(true);
        const failures: string[] = [];
        let completed = 0;
        try {
            for (const [index, file] of files.entries()) {
                if (!alive.current) break;
                const prefix = `${file.name} (${index + 1}/${files.length})`;
                setStatus(`Uploading ${prefix}`);
                try {
                    if (kind === 'documents') {
                        const extension = '.' + (file.name.split('.').pop() || '').toLowerCase();
                        if (!NEWS_DOCUMENT_ACCEPT.split(',').includes(extension)) throw new Error('Choose a PDF, Office document, text file or ZIP.');
                        if (file.size > 20 * 1024 * 1024) throw new Error('Documents must be 20 MB or smaller.');
                        const saved = await uploadEventAttachment(file);
                        if (!saved.url) throw new Error('The upload did not return a file address. Please try again.');
                        if (!alive.current) break;
                        const next = { url: saved.url, label: saved.name || file.name, filename: saved.name || file.name, mimeType: saved.type || file.type, size: saved.size || file.size };
                        const current = latest.current.article.attachments || [];
                        latest.current.article = { ...latest.current.article, attachments: [...current, next] };
                        latest.current.onChange({ attachments: [...current, next] });
                    } else {
                        if (!file.type.startsWith('image/')) throw new Error('Choose a photo file.');
                        const saved = await uploadMedia(file, progress => { if (alive.current) setStatus(`${prefix}: ${progress}`); });
                        if (!saved.url) throw new Error('The upload did not return a photo address. Please try again.');
                        if (!alive.current) break;
                        if (kind === 'cover') {
                            latest.current.onChange({ image: { ...image(saved.url), ...(latest.current.article.image || {}), url: saved.url, type: 'image' } });
                        } else {
                            const current = latest.current.article.photos || [];
                            const next = [...current, image(saved.url)];
                            latest.current.article = { ...latest.current.article, photos: next };
                            latest.current.onChange({ photos: next });
                        }
                    }
                    completed++;
                } catch (error) {
                    failures.push(`${file.name}: ${errorMessage(error, 'Upload failed. Choose this file again to retry.')}`);
                }
            }
        } finally {
            working.current = false;
            if (alive.current) {
                setBusy(false); latest.current.onBusyChange(false); setErrors(failures);
                setStatus(completed ? `${completed} ${completed === 1 ? 'file uploaded' : 'files uploaded'}. Save article to keep these changes.` : 'No new files uploaded. Existing files are unchanged.');
            }
        }
    };

    const movePhoto = (from: number, offset: number) => {
        const next = [...photos], to = from + offset;
        if (to < 0 || to >= next.length) return;
        [next[from], next[to]] = [next[to], next[from]];
        onChange({ photos: next });
    };
    const filePicker = (kind: 'cover' | 'photos' | 'documents', title: string) => (
        <label className={`relative inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-ui-small font-semibold leading-snug text-blue-800 transition-colors hover:bg-blue-100 focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-2 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200 dark:hover:bg-blue-900/60 ${locked ? 'cursor-not-allowed opacity-50' : ''}`}>
            <Upload size={20} className="shrink-0" /> {title}
            <input aria-label={title} className="sr-only" type="file" disabled={locked}
                accept={kind === 'documents' ? NEWS_DOCUMENT_ACCEPT : 'image/*'} multiple={kind !== 'cover'}
                onChange={event => { const files = Array.from(event.currentTarget.files || []); event.currentTarget.value = ''; void upload(files, kind); }} />
        </label>
    );

    return <div className="min-w-0 space-y-7">
        <p className={hintClass}>Add files and links below, then choose <strong className="font-semibold text-slate-900 dark:text-white">Save article</strong> to keep your changes. They will appear with the published article.</p>
        {status && <p role="status" aria-live="polite" className="flex items-start gap-2 rounded-xl bg-blue-50 p-4 text-ui-small leading-relaxed text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">{busy && <Loader2 size={20} className="mt-1 shrink-0 animate-spin" />}<span className="min-w-0 break-words">{status}</span></p>}
        {errors.length > 0 && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-ui-small leading-relaxed text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"><p className="font-bold">Some files could not be added</p><ul className="mt-2 list-disc space-y-2 pl-5">{errors.map((error, index) => <li key={index} className="break-words">{error}</li>)}</ul></div>}
        <fieldset disabled={locked} className={groupClass}>
            <legend className={legendClass}>Cover photo</legend>
            <p className={hintClass}>The main picture shown on the news card and at the top of the article.</p>
            {article.image?.url && <img src={sizedMediaUrl(article.image.url, 640)} alt={article.image.alt || 'Cover preview'} loading="lazy" className="max-h-64 max-w-full rounded-xl border border-slate-200 bg-white object-contain dark:border-neutral-700" />}
            <div className="flex flex-wrap gap-3">{filePicker('cover', article.image?.url ? 'Replace cover photo' : 'Upload cover photo')}
                {article.image?.url && <button type="button" className={actionClass} onClick={() => onChange({ image: image('') })}><Trash2 size={20} className="shrink-0" /> Remove cover</button>}
            </div>
            <CmsField label="Cover description" hint="Describes the picture for readers who use a screen reader."><CmsInput aria-label="Cover description" value={article.image?.alt || ''} onChange={event => onChange({ image: { ...image(article.image?.url || ''), ...(article.image || {}), alt: event.target.value } })} /></CmsField>
        </fieldset>
        <fieldset disabled={locked} className={groupClass}>
            <legend className={legendClass}>Article photos <span className="whitespace-nowrap font-medium text-slate-500 dark:text-neutral-400">({photos.length}/{NEWS_PHOTO_LIMIT})</span></legend>
            <p className={hintClass}>Select several photos together. Move them into reading order and add captions.</p>
            {filePicker('photos', 'Add article photos')}
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                {photos.map((photo, index) => <div key={`${photo.url}-${index}`} className={itemClass}>
                    {photo.type === 'video' ? <video src={resolveMediaUrl(photo.url)} controls preload="metadata" className="h-40 w-full rounded-lg object-contain" /> : <img src={sizedMediaUrl(photo.url, 480)} alt={photo.alt || `Photo ${index + 1}`} loading="lazy" className="h-40 w-full rounded-lg object-contain" />}
                    <CmsField label={`Photo ${index + 1} caption`}><CmsInput aria-label={`Photo ${index + 1} caption`} value={photo.alt || ''} onChange={event => onChange({ photos: photos.map((row, i) => i === index ? { ...row, alt: event.target.value } : row) })} /></CmsField>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" className={actionClass} disabled={index === 0} aria-label={`Move photo ${index + 1} up`} onClick={() => movePhoto(index, -1)}><ArrowUp size={16} /></button>
                        <button type="button" className={actionClass} disabled={index === photos.length - 1} aria-label={`Move photo ${index + 1} down`} onClick={() => movePhoto(index, 1)}><ArrowDown size={16} /></button>
                        <button type="button" className={actionClass} aria-label={`Remove photo ${index + 1}`} onClick={() => onChange({ photos: photos.filter((_, i) => i !== index) })}><Trash2 size={16} /> Remove</button>
                    </div>
                </div>)}
            </div>
        </fieldset>
        <fieldset disabled={locked} className={groupClass}>
            <legend className={legendClass}>Documents <span className="whitespace-nowrap font-medium text-slate-500 dark:text-neutral-400">({attachments.length}/{NEWS_ATTACHMENT_LIMIT})</span></legend>
            <p className={hintClass}>PDF, Word, Excel, slides, OpenDocument, text, CSV, RTF or ZIP. Up to 20 MB each.</p>
            {filePicker('documents', 'Add news documents')}
            {attachments.map((file, index) => <div key={`${file.url}-${index}`} className={itemClass}>
                <div className="flex min-w-0 flex-wrap items-center gap-3 text-ui-small"><FileText size={22} className="shrink-0 text-blue-600 dark:text-blue-300" /><a href={newsDocumentHref(file.url) || undefined} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 break-all font-medium text-blue-700 underline underline-offset-4 dark:text-blue-300">{file.filename || file.label || `Document ${index + 1}`}</a><span className="text-slate-500 dark:text-neutral-400">{newsFileSize(file.size)}</span></div>
                <CmsField label={`Document ${index + 1} label`}><CmsInput aria-label={`Document ${index + 1} label`} value={file.label || ''} onChange={event => onChange({ attachments: attachments.map((row, i) => i === index ? { ...row, label: event.target.value } : row) })} /></CmsField>
                <button type="button" className={actionClass} aria-label={`Remove document ${index + 1}`} onClick={() => onChange({ attachments: attachments.filter((_, i) => i !== index) })}><Trash2 size={16} /> Remove</button>
            </div>)}
        </fieldset>
        <fieldset disabled={locked} className={groupClass}>
            <legend className={legendClass}>Related links <span className="whitespace-nowrap font-medium text-slate-500 dark:text-neutral-400">({links.length}/{NEWS_LINK_LIMIT})</span></legend>
            <p className={hintClass}>Add a WhatsApp group or channel, YouTube video, or another useful webpage. Use a complete https:// link.</p>
            {links.map((link, index) => <div key={index} className={itemClass}>
                <CmsField label={`Link ${index + 1} label`}><CmsInput aria-label={`Link ${index + 1} label`} value={link.label || ''} placeholder="Join our WhatsApp group" onChange={event => onChange({ links: links.map((row, i) => i === index ? { ...row, label: event.target.value } : row) })} /></CmsField>
                <CmsField label={`Link ${index + 1} URL`}><CmsInput aria-label={`Link ${index + 1} URL`} type="url" value={link.url || ''} placeholder="https://chat.whatsapp.com/… or https://youtu.be/…" onChange={event => onChange({ links: links.map((row, i) => i === index ? { ...row, url: event.target.value } : row) })} /></CmsField>
                <button type="button" className={actionClass} aria-label={`Remove link ${index + 1}`} onClick={() => onChange({ links: links.filter((_, i) => i !== index) })}><Trash2 size={16} /> Remove</button>
            </div>)}
            <CmsButton variant="ghost" disabled={links.length >= NEWS_LINK_LIMIT} onClick={() => onChange({ links: [...links, { url: '', label: '' }] })}><Plus size={20} className="shrink-0" /> Add related link</CmsButton>
        </fieldset>
    </div>;
}
