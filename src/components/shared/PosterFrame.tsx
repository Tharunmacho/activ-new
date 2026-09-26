import type { CmsMedia } from '@/services/cmsApi';
import { resolveMediaUrl } from '@/config/api.config';
import { CmsMediaFrame } from './CmsMediaFrame';

/**
 * AN EVENT POSTER IN A CARD — whole, and filling the card.
 *
 * Every event card used a fixed-height strip and the editor's per-event `fit`:
 * a poster set to "contain" shrank and left white bands either side, one set
 * to "cover" lost its top and bottom (the logo, the date line). Both read as a
 * broken card.
 *
 * Here the frame is the banner shape (16:9 by default), so a standard
 * 1600 x 900 poster fills it exactly. The poster is always drawn WHOLE
 * (`contain`); when its shape differs, the space around it is the same poster,
 * blurred and enlarged — never an empty plate. Cards in a row stay one height.
 */
export function PosterFrame({
    media, width = 480, aspect = 'aspect-[16/9]', className = '', imageClassName = '', children,
}: {
    media?: Partial<CmsMedia> | null;
    width?: number;
    /** Tailwind aspect class for the frame. */
    aspect?: string;
    className?: string;
    /** Extra classes on the poster itself (e.g. a hover zoom). */
    imageClassName?: string;
    /** Overlays (badges, gradients) drawn above the poster. */
    children?: React.ReactNode;
}) {
    const url = media?.url || '';
    const isVideo = media?.type === 'video';
    return (
        <div className={`relative w-full overflow-hidden bg-slate-100 ${aspect} ${className}`}>
            {url && !isVideo && (
                <img
                    src={resolveMediaUrl(url)}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full scale-110 object-cover opacity-80 blur-xl"
                />
            )}
            <div className="absolute inset-0">
                <CmsMediaFrame
                    media={{ ...(media || {}), fit: 'contain', position: 'center' }}
                    width={width}
                    transparent
                    className={imageClassName}
                />
            </div>
            {children}
        </div>
    );
}

export default PosterFrame;
