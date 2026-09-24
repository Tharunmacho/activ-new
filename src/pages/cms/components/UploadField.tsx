import { useRef, useState } from 'react';
import { Upload, Loader2, Trash2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { uploadMedia, errorMessage } from '@/services/cmsApi';
import { resolveMediaUrl } from '@/config/api.config';

/**
 * Choose a picture. Never type an address, and never a file.
 *
 * Pictures only, on request: there is no document upload here. `fileUrl` stays
 * on the record so anything already attached to a publication still offers its
 * Download button, and nothing in this editor writes it.
 *
 * =========================================================================
 * THE FIELD WAS A URL BOX, AND THAT IS THE WRONG QUESTION
 * =========================================================================
 *
 * Every image on a region or state page was edited as a text field holding a
 * web address. An editor with a photograph on their desk has no address to
 * type — they had to upload it somewhere else first, copy the link, and paste
 * it in, and nothing on the form said so. A paste of the wrong thing failed
 * silently, with a broken frame on the live page as the only feedback.
 *
 * So the control is the upload. The address is what it PRODUCES: the file goes
 * to the media store, the returned path is written to the same field the text
 * box used to write, and the editor sees the picture rather than a string.
 *
 * ------------------------------------------------------------- the preview
 *
 * `resolveMediaUrl`, not the raw value. An upload is stored as `/uploads/<file>`
 * — deliberately relative, so the record does not pin itself to whichever host
 * uploaded it — and the CMS runs on the website's origin, which does not serve
 * the backend's upload directory. Previewing the raw path shows a broken image
 * for a file that uploaded perfectly.
 */
export function UploadField({ url, onChange, label, hint, aspect = 'aspect-[16/9]', shape = 'image' }: {
    url: string;
    onChange: (url: string) => void;
    label?: string;
    hint?: string;
    /** The shape of the frame, matching the slot this picture fills. */
    aspect?: string;
    shape?: 'image' | 'portrait';
}) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);

    const pick = async (file?: File | null) => {
        if (!file) return;
        setBusy(true);
        try {
            const { url: uploaded } = await uploadMedia(file);
            onChange(uploaded);
            /* An upload writes the FILE; the record is written by Save. Saying
               so here is the difference between an editor who saves and one who
               reports that the link did not update. */
            toast.success('Picture uploaded — press Save page to keep it');
        } catch (err) {
            toast.error(errorMessage(err, 'That picture could not be uploaded'));
        } finally {
            setBusy(false);
        }
    };

    const frame = shape === 'portrait' ? 'w-28 aspect-[3/4]' : `w-full max-w-xs ${aspect}`;

    return (
        <div className="block">
            {label && (
                <span className="block text-[1.1875rem] font-semibold text-slate-800 dark:text-neutral-100 mb-1.5">
                    {label}
                </span>
            )}

            <div className="flex flex-wrap items-start gap-4">
                <div
                    className={`${frame} shrink-0 overflow-hidden rounded-xl border border-slate-300
                                dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#141414] flex items-center
                                justify-center text-slate-300`}
                >
                    {busy ? (
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    ) : url ? (
                        /*
                         * CONTAIN, not cover — the preview has to be the
                         * picture, not a crop of it.
                         *
                         * Cropping here made the preview agree with the site
                         * only while the site cropped the same way, and the
                         * site does not any more: every photograph of a person
                         * is now drawn whole (`PersonPhoto`). A preview that
                         * still cut the chin off would be telling the editor
                         * their upload was wrong when the page was about to
                         * show it correctly.
                         */
                        <img
                            src={resolveMediaUrl(url)}
                            alt=""
                            className="h-full w-full object-contain"
                        />
                    ) : (
                        <ImageIcon className="w-7 h-7" />
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        disabled={busy}
                        className="inline-flex items-center gap-2 rounded-lg border border-blue-200
                                   dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 px-4 py-2.5
                                   text-[1.1875rem] font-semibold text-blue-700 dark:text-blue-300
                                   transition-colors hover:bg-blue-100 disabled:opacity-50"
                    >
                        <Upload size={15} /> {url ? 'Choose a different picture' : 'Upload a picture'}
                    </button>

                    {url && (
                        <button
                            type="button"
                            onClick={() => onChange('')}
                            className="inline-flex items-center gap-2 rounded-lg px-4 py-2
                                       text-[1.0625rem] font-semibold text-slate-500 dark:text-neutral-400
                                       transition-colors hover:text-red-600"
                        >
                            <Trash2 size={14} /> Remove this picture
                        </button>
                    )}

                    <span className="text-[1.0625rem] font-medium text-slate-500 dark:text-neutral-400">
                        {hint || 'JPG or PNG. It is uploaded and used straight away.'}
                    </span>

                    {/*
                      * THE STORED ADDRESS, AS A FACT RATHER THAN A FIELD.
                      *
                      * This used to be a box to type into. Uploading writes it,
                      * so what an editor needs is to SEE what was saved — to
                      * check it went in, and to copy it if the same picture is
                      * wanted elsewhere. Read-only, small, and selectable.
                      */}
                    {url && (
                        <span className="text-[1.0625rem] font-semibold uppercase tracking-wide
                                         text-slate-400 dark:text-neutral-500">
                            Picture address, saved with the page
                        </span>
                    )}
                    {url && (
                        <code
                            title={url}
                            className="block max-w-md truncate rounded bg-slate-100 dark:bg-[#141414]
                                       px-2 py-1 text-[1.0625rem] font-mono text-slate-500
                                       dark:text-neutral-400 select-all"
                        >
                            {url}
                        </code>
                    )}
                </div>
            </div>

            <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { pick(e.target.files && e.target.files[0]); e.target.value = ''; }}
            />
        </div>
    );
}
