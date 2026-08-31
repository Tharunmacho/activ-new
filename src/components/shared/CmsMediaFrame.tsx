import { useEffect, useState } from 'react';
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
 *
 * ---------------------------------------------------------------- loading
 *
 * Three things below are about how the picture ARRIVES, which on this site is
 * most of what "the images do not load properly" means. The media is whatever
 * URL an editor pasted, and several of the seeded ones are original camera
 * files — one is 5472px wide — so the gap between "the markup is right" and
 * "there is a photograph on screen" is measured in seconds.
 *
 * `priority` TURNS LAZY-LOADING OFF. Every image here used to carry
 * `loading="lazy"`, including the one at the top of the page. A lazy image is
 * fetched at low priority and only once layout has decided it is near the
 * viewport, which is precisely the wrong treatment for the first thing a
 * visitor looks at: the hero photograph queued behind the fonts, the scripts,
 * and the cards below it. Anything above the fold passes `priority` and is
 * fetched eagerly at high priority. Everything else keeps the lazy default,
 * which is still right for a grid of twenty gallery tiles.
 *
 * EVERY FRAME CARRIES A PLATE. The neutral background is on the image element
 * itself rather than in a layer behind it — deliberately, because several
 * callers (both logos, the CMS sidebar) put this in a parent with no
 * positioning, and an absolutely positioned sibling would escape to whatever
 * distant ancestor happened to be relative and paint grey across it. As a
 * background it costs no DOM, makes no assumption about the parent, and is
 * simply covered when the photograph paints. Before it, a frame was transparent
 * while the file was in flight, so an event card drew its own gradient over
 * nothing and read as broken rather than as loading.
 *
 * A BROKEN URL IS NOT A BROKEN ICON. A 404 leaves most browsers drawing their
 * own torn-page glyph next to the alt text, mid-layout. `onError` swaps in the
 * same plate at the same size, so a dead link degrades to an empty frame: the
 * layout holds, and nothing claims to be a photograph that is not one.
 */
/**
 * Hosts that resize from a `w` query parameter.
 *
 * This list is the whole of the mechanism below, and it is short on purpose.
 * Appending `w=` to an arbitrary URL does nothing at best and breaks a signed
 * one at worst, so a host has to be known to honour it before it is touched.
 * Anything not listed is requested byte-for-byte as authored.
 */
const RESIZABLE_HOSTS = ['images.unsplash.com'];

/**
 * Ask the CDN for the size actually being drawn.
 *
 * The seeded media are original camera files — one of them is 5472px wide and
 * several megabytes — and they were being downloaded in full to be painted into
 * a 222px card. That is the real reason the pictures "do not load properly":
 * not the markup, the payload. Requesting a sized rendition cuts these by more
 * than an order of magnitude.
 *
 * The stored content is NOT modified. This rewrites the request at render time
 * only, so what the CMS holds stays exactly what the editor pasted, and an
 * editor who has already sized a URL themselves (`w` is present) is left alone.
 */
const sizedSrc = (url: string, width: number): string => {
    try {
        const u = new URL(url, window.location.origin);
        if (!RESIZABLE_HOSTS.includes(u.hostname)) return url;
        if (u.searchParams.has('w')) return url;
        u.searchParams.set('w', String(Math.round(width)));
        return u.toString();
    } catch {
        // A relative path, or something unparseable: leave it exactly as it is.
        return url;
    }
};

/** Is this a host we can ask for a second density from? */
const isResizable = (url: string): boolean => {
    try {
        const u = new URL(url, window.location.origin);
        return RESIZABLE_HOSTS.includes(u.hostname) && !u.searchParams.has('w');
    } catch {
        return false;
    }
};

interface Props {
    media?: Partial<CmsMedia> | null;
    className?: string;
    /** Rendered when there is no media — keeps the layout from collapsing. */
    fallback?: React.ReactNode;
    /**
     * Above the fold: fetch eagerly and at high priority rather than lazily.
     * For hero and banner media only — marking everything priority is the same
     * as marking nothing.
     */
    priority?: boolean;
    /**
     * Roughly how wide this frame is drawn, in CSS pixels. Used to ask a
     * resizing CDN for a rendition instead of the original; a second density is
     * offered at twice it. Only a hint — too small and a retina screen softens,
     * too large and the saving is lost, so pass the frame's real width.
     */
    width?: number;
}

export function CmsMediaFrame({
    media, className = '', fallback = null, priority = false, width = 900,
}: Props) {
    const m = { ...EMPTY_MEDIA, ...(media || {}) };

    const [failed, setFailed] = useState(false);

    /*
     * Reset when the source changes. Without this a frame that has failed once
     * — a carousel slide, say — keeps showing the plate after the editor points
     * it at a working URL, because `failed` is still true from the old src.
     */
    useEffect(() => { setFailed(false); }, [m.url]);

    if (!m.url) return <>{fallback}</>;

    const style: React.CSSProperties = {
        objectFit: m.fit,
        objectPosition: m.position || 'center',
    };

    if (m.type === 'video') {
        return (
            <video
                src={m.url}
                className={`w-full h-full bg-slate-100 ${className}`}
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

    // Same box, same classes, no image — so a dead URL cannot change the layout
    // around it.
    if (failed) {
        return <div aria-hidden="true" className={`w-full h-full bg-slate-100 ${className}`} />;
    }

    return (
        <img
            src={sizedSrc(m.url, width)}
            // Two densities where the host can serve them, so a retina display
            // gets a sharp image and everyone else does not pay for one.
            srcSet={isResizable(m.url)
                ? `${sizedSrc(m.url, width)} 1x, ${sizedSrc(m.url, width * 2)} 2x`
                : undefined}
            alt={m.alt || ''}
            loading={priority ? 'eager' : 'lazy'}
            /*
             * Spread lower-cased: `fetchPriority` is not in React 18's DOM
             * typings, so writing it as a normal prop is a type error, while an
             * unrecognised lower-case attribute is passed straight through to
             * the element. `undefined` omits it entirely rather than emitting
             * `fetchpriority="undefined"`.
             */
            {...{ fetchpriority: priority ? 'high' : undefined }}
            decoding="async"
            onError={() => setFailed(true)}
            className={`w-full h-full bg-slate-100 ${className}`}
            style={style}
        />
    );
}

export default CmsMediaFrame;
