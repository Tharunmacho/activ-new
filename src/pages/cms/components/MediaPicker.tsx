import { useRef, useState } from 'react';
import { Upload, Loader2, Trash2, Image as ImageIcon, Film } from 'lucide-react';
import { uploadMedia, errorMessage, EMPTY_MEDIA, type CmsMedia } from '@/services/cmsApi';
import { resolveMediaUrl } from '@/config/api.config';
import { CmsInput, CmsField } from './CmsUI';

/**
 * Pick an image or a video, and say how it should sit in its frame.
 *
 * The fit control is the point of this component. Uploaded media is almost
 * never the shape of the slot it lands in, and without a choice a portrait
 * photo dropped into a wide banner gets cropped to a sliver with no way to say
 * otherwise. `cover` fills and crops; `contain` shows all of it and pads. The
 * focal point then decides *which* part a crop keeps.
 *
 * The preview is rendered at the real aspect ratio of the slot, with the chosen
 * fit applied, so what the editor sees is what the page will do.
 */

const FITS = [
    { key: 'cover' as const, label: 'Fill frame', hint: 'Crops the edges' },
    { key: 'contain' as const, label: 'Fit whole', hint: 'Pads the sides' },
];

const POSITIONS = ['center', 'top', 'bottom', 'left', 'right'];

interface Props {
    value: CmsMedia;
    onChange: (media: CmsMedia) => void;
    label?: string;
    /** Aspect ratio of the slot this media fills on the public page. */
    aspect?: string;
    /** Guidance for this particular slot, e.g. which fit suits it. */
    hint?: string;
}

export default function MediaPicker({ value, onChange, label = 'Media', aspect = '16 / 9', hint }: Props) {
    const media = { ...EMPTY_MEDIA, ...(value || {}) };

    /**
     * What the PREVIEW loads — not what is stored.
     *
     * An upload is stored as `/uploads/<file>`, deliberately relative so the
     * record does not pin itself to whichever host happened to upload it. The
     * browser then resolves that against the page it is on, which for this
     * editor is the website's own origin — and the website does not serve the
     * backend's upload directory. So the file uploaded fine, the record was
     * correct, and the editor showed a broken frame.
     *
     * `resolveMediaUrl` re-anchors it to the API origin, exactly as every
     * public page already does on read. Remote URLs and `data:`/`blob:` values
     * pass through untouched.
     */
    const previewSrc = resolveMediaUrl(media.url);

    const fileRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');

    const set = (patch: Partial<CmsMedia>) => onChange({ ...media, ...patch });

    const handleFile = async (file: File | null) => {
        if (!file) return;
        setError('');
        setUploading(true);
        try {
            const { url, type } = await uploadMedia(file);
            // The server decides the type from the real mimetype, not from the
            // filename — a `.mp4` served as an image would render as nothing.
            set({ url, type });
        } catch (err) {
            setError(errorMessage(err, 'Upload failed'));
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    return (
        <div className="space-y-4">
            {/* Nothing to say, nothing drawn. `label=""` is how a caller says
                the section heading above already names this picker — and it was
                still emitting an empty paragraph, which is a blank line of
                space that reads as a missing field. */}
            {(label || hint) && (
                <div>
                    {label && (
                        <p className="text-[1.25rem] font-medium text-slate-700 dark:text-neutral-300">
                            {label}
                        </p>
                    )}
                    {hint && <p className="text-[1.1875rem] text-neutral-500 mt-0.5">{hint}</p>}
                </div>
            )}

            {/*
                The preview and the upload buttons share one row; every field
                below spans the full width.

                This was a two-column grid holding the preview on the left and
                ALL the controls on the right, so "Or paste a URL", the fit
                buttons and the alt text began 220px in from the card's edge
                while every other field in the card began at the edge. Two
                different left margins in one form is what made the card read as
                misaligned, and it left the space under the preview empty.
            */}
            <div className="flex flex-wrap items-start gap-4">
                {/* Preview at the real slot ratio, with the real fit applied. */}
                <div
                    className="bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-[#262626]
                               rounded-lg overflow-hidden flex items-center justify-center
                               w-full sm:w-[13.75rem] shrink-0"
                    style={{ aspectRatio: aspect }}
                >
                    {!media.url ? (
                        <div className="text-center text-neutral-400 dark:text-neutral-600 px-3">
                            <ImageIcon className="w-6 h-6 mx-auto mb-1" />
                            <span className="text-[1.1875rem]">Nothing selected</span>
                        </div>
                    ) : media.type === 'video' ? (
                        <video
                            src={previewSrc}
                            className="w-full h-full"
                            style={{ objectFit: media.fit, objectPosition: media.position }}
                            muted
                            loop
                            playsInline
                            autoPlay
                        />
                    ) : (
                        <img
                            src={previewSrc}
                            alt={media.alt || ''}
                            className="w-full h-full"
                            style={{ objectFit: media.fit, objectPosition: media.position }}
                        />
                    )}
                </div>

                <div className="flex-1 min-w-[15rem] space-y-2">
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            disabled={uploading}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[1.25rem] bg-slate-100 dark:bg-[#1A1A1A]
                                       hover:bg-slate-200 dark:hover:bg-[#262626] text-slate-800 dark:text-[#E4E4E7] disabled:opacity-50"
                        >
                            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            {uploading ? 'Uploading…' : 'Upload image or video'}
                        </button>

                        {media.url && (
                            <button
                                type="button"
                                onClick={() => set({ ...EMPTY_MEDIA })}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[1.25rem]
                                           text-red-600 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-[#1A1A1A]"
                            >
                                <Trash2 className="w-4 h-4" /> Remove
                            </button>
                        )}

                        {media.url && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-2 text-[1.1875rem] text-slate-500 dark:text-[#A1A1AA]">
                                {media.type === 'video' ? <Film className="w-3.5 h-3.5" /> : <ImageIcon className="w-3.5 h-3.5" />}
                                {media.type}
                            </span>
                        )}
                    </div>

                    {/* WHAT WAS SAVED. The upload writes this address; showing
                        it is how an editor checks it went in, and how they copy
                        it when the same picture is wanted elsewhere. */}
                    {media.url && (
                        <div className="w-full">
                            <span className="block text-[1.0625rem] font-bold uppercase tracking-wide
                                             text-slate-400 dark:text-neutral-500">
                                Picture address, saved with the page
                            </span>
                            <code
                                title={media.url}
                                className="mt-1 block max-w-lg truncate rounded bg-slate-100 dark:bg-[#141414]
                                           px-2 py-1 text-[1.0625rem] font-mono text-slate-500
                                           dark:text-neutral-400 select-all"
                            >
                                {media.url}
                            </code>
                        </div>
                    )}


                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={(e) => handleFile(e.target.files?.[0] || null)}
                    />

                    {error && <p className="text-[1.1875rem] text-red-600 dark:text-red-400">{error}</p>}
                </div>
            </div>

            {/* Full width from here down, so these align with the card's other
                fields rather than with the preview's right edge. */}
            <div className="space-y-4">
                {/*
                  * NO "PASTE A URL" BOX.
                  *
                  * Uploading is the path that works: it puts the file on this
                  * server, under this domain, and it cannot rot. A pasted
                  * address is somebody else's server — it breaks when they
                  * reorganise, and it was the field most likely to be filled in
                  * with something that 404s on the public site a month later.
                  *
                  * `media.url` is UNTOUCHED as a field: every banner already
                  * stored is still read and still rendered, including ones that
                  * were pasted. Only the box for typing a new one is gone.
                  */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <CmsField label="How it fills the space">
                        <div className="flex gap-2">
                            {FITS.map((f) => (
                                <button
                                    key={f.key}
                                    type="button"
                                    onClick={() => set({ fit: f.key })}
                                    title={f.hint}
                                    className={`flex-1 px-3 py-2.5 rounded-lg text-[1.1875rem] border transition-colors ${
                                        media.fit === f.key
                                            ? 'bg-blue-600 border-blue-600 text-white'
                                            : 'bg-slate-50 dark:bg-[#050505] border-slate-300 dark:border-[#262626] text-slate-700 dark:text-[#D4D4D8] hover:bg-slate-100 dark:hover:bg-[#1A1A1A]'
                                    }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </CmsField>

                    <CmsField
                        label="Focal point"
                        hint={media.fit === 'contain' ? 'Only applies when filling the frame.' : 'Which part a crop keeps.'}
                    >
                        <select
                            value={media.position}
                            onChange={(e) => set({ position: e.target.value })}
                            disabled={media.fit === 'contain'}
                            className="w-full bg-slate-50 dark:bg-[#050505] border border-slate-300 dark:border-[#262626]
                                       rounded-lg px-3 py-2.5 text-[1.25rem] text-slate-900 dark:text-white disabled:opacity-40"
                        >
                            {POSITIONS.map((p) => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </CmsField>
                </div>

                <CmsField label="Alt text" hint="Describes the media to screen readers and to search engines.">
                    <CmsInput value={media.alt} onChange={(e) => set({ alt: e.target.value })} />
                </CmsField>
            </div>
        </div>
    );
}
