import { AlignLeft, AlignRight } from 'lucide-react';
import { CmsField, CmsInput, CmsTextarea, CmsChoice } from './CmsUI';
import type { BannerAlign } from '@/services/cmsApi';

/**
 * The words a home-banner image carries, and which side they sit on.
 *
 * ONE editor for both places an image reaches the banner — an authored slide
 * (Home Page -> Slides) and a gallery image switched into the banner (Gallery)
 * — so the two cannot drift into asking different questions.
 *
 * Every field is optional. Left blank, the image shows the banner's shared
 * headline, which is exactly what it showed before these fields existed.
 *
 * LEFT / RIGHT is a `CmsChoice` — exactly one of the two, a radio group (see
 * CLAUDE.md). It exists because the subject of a photograph is often on one
 * side: words printed over a speaker's face hide the thing the photo is of.
 */
export interface BannerWords {
    headline: string;
    highlight: string;
    subheadline: string;
    align: BannerAlign;
}

export default function BannerWordsFields({ value, onChange, preview, whenBlank, fallback }: {
    value: BannerWords;
    onChange: (next: Partial<BannerWords>) => void;
    /** The image, for the small position preview. Optional. */
    preview?: string;
    /** What the banner shows if every field is left blank — said to the editor. */
    whenBlank?: string;
    /** The words the preview shows while every field is blank. */
    fallback?: { headline: string; subheadline: string };
}) {
    const align: BannerAlign = value.align === 'right' ? 'right' : 'left';

    return (
        <div className="space-y-3 rounded-lg border border-slate-200 dark:border-[#2a2a2a] p-4">
            <div>
                <p className="text-[1.0625rem] font-semibold uppercase tracking-wider text-neutral-400">
                    Banner words for this image
                </p>
                <p className="text-[1.0625rem] text-neutral-500 mt-1">
                    Written for this picture only. {whenBlank
                        || "Leave them all blank and the banner's shared heading is shown."}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <CmsField label="Heading" hint="The large line, e.g. “6th Anniversary Conference”.">
                    <CmsInput
                        value={value.headline}
                        onChange={(e) => onChange({ headline: e.target.value })}
                        maxLength={120}
                        placeholder="Heading for this image"
                    />
                </CmsField>
                <CmsField label="Highlighted words" hint="Shown after the heading in the accent colour.">
                    <CmsInput
                        value={value.highlight}
                        onChange={(e) => onChange({ highlight: e.target.value })}
                        maxLength={60}
                        placeholder="Optional"
                    />
                </CmsField>
            </div>

            <CmsField label="Subheading" hint="One or two sentences about what is in this picture.">
                <CmsTextarea
                    rows={2}
                    value={value.subheadline}
                    onChange={(e) => onChange({ subheadline: e.target.value })}
                    maxLength={280}
                    placeholder="What happened here, who was there, why it matters"
                />
            </CmsField>

            <CmsField label="Position" hint="Move the words to the side the photograph's subject is NOT on.">
                <CmsChoice<BannerAlign>
                    label="Which side the words sit on"
                    value={align}
                    onChange={(next) => onChange({ align: next })}
                    options={[
                        { value: 'left', icon: <AlignLeft className="h-4 w-4" />, title: 'Left', detail: 'Words on the left, picture visible on the right.' },
                        { value: 'right', icon: <AlignRight className="h-4 w-4" />, title: 'Right', detail: 'Words on the right, picture visible on the left.' },
                    ]}
                />
            </CmsField>

            {/* A small picture of where the words will land, over this image. */}
            {preview ? (
                <div className="relative w-full max-w-md aspect-[21/9] rounded-lg overflow-hidden bg-slate-800">
                    <img src={preview} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    <div className={`absolute inset-0 ${align === 'right'
                        ? 'bg-gradient-to-l' : 'bg-gradient-to-r'} from-black/80 via-black/40 to-transparent`} />
                    <div className={`absolute inset-y-0 w-3/5 flex flex-col justify-center px-3
                                     ${align === 'right' ? 'right-0 items-end text-right' : 'left-0 items-start text-left'}`}>
                        <span className="text-white font-black text-[0.9375rem] leading-tight line-clamp-2">
                            {value.headline || (value.highlight || value.subheadline ? '' : (fallback?.headline || 'Shared heading'))}
                            {value.highlight ? <span className="text-sky-300"> {value.highlight}</span> : null}
                        </span>
                        <span className="text-white/80 text-[0.75rem] mt-1 line-clamp-2">
                            {value.subheadline || (value.headline || value.highlight ? '' : (fallback?.subheadline || 'Shared subheading'))}
                        </span>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
