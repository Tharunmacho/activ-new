import { EMPTY_MEDIA, type CmsMedia } from '@/services/cmsApi';

/**
 * Render CMS media inside a fixed frame, honouring how the editor said it
 * should sit there.
 *
 * The frame's shape is decided by the page — a banner is wide, a portrait slot
 * is tall — and the media almost never matches it. Rather than letting the
 * browser squash or crop arbitrarily, the editor's `fit` and `position` are
 * applied: `cover` fills and crops from the chosen focal point, `contain` shows
 * the whole thing and pads. That pairing is what stops an uploaded portrait
 * photograph appearing as a cropped sliver in a wide banner.
 *
 * A video is rendered as a video. Putting one in an `<img>` shows nothing at
 * all and raises no error, which is a particularly quiet way to lose content.
 */
interface Props {
    media?: Partial<CmsMedia> | null;
    className?: string;
    /** Rendered when there is no media — keeps the layout from collapsing. */
    fallback?: React.ReactNode;
}

export function CmsMediaFrame({ media, className = '', fallback = null }: Props) {
    const m = { ...EMPTY_MEDIA, ...(media || {}) };

    if (!m.url) return <>{fallback}</>;

    // `contain` needs a backdrop: the padding it creates would otherwise show
    // whatever is behind the frame, which rarely looks deliberate.
    const style: React.CSSProperties = {
        objectFit: m.fit,
        objectPosition: m.position || 'center',
    };

    if (m.type === 'video') {
        return (
            <video
                src={m.url}
                className={`w-full h-full ${m.fit === 'contain' ? 'bg-slate-100' : ''} ${className}`}
                style={style}
                autoPlay
                muted
                loop
                playsInline
                // No controls: this is decorative background media, and a
                // control bar over a banner reads as a broken embed.
                aria-label={m.alt || undefined}
            />
        );
    }

    return (
        <img
            src={m.url}
            alt={m.alt || ''}
            loading="lazy"
            className={`w-full h-full ${m.fit === 'contain' ? 'bg-slate-100' : ''} ${className}`}
            style={style}
        />
    );
}

export default CmsMediaFrame;
