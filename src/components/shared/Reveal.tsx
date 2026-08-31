import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';

/**
 * Reveal a block the first time it scrolls into view.
 *
 * The public pages were entirely static: every section was painted at full
 * opacity before the visitor had scrolled to it, so arriving at one felt like
 * loading a document rather than moving through a page. This is the motion
 * primitive the five onboarding screens share, so a section animates the same
 * way wherever it appears instead of each component inventing its own timing.
 *
 * Three properties matter more than the effect itself:
 *
 * ONE OBSERVER, not one per element. A page like the gallery mounts thirty of
 * these; thirty `IntersectionObserver`s each with their own callback is thirty
 * times the bookkeeping for an identical threshold. They share the singleton
 * below and each element unregisters the moment it has fired.
 *
 * IT ONLY EVER FIRES ONCE. A section that re-hides when it leaves the viewport
 * and re-animates on the way back turns an ordinary scroll upward into a
 * flicker. `unobserve` on first intersection is what makes the cost of this
 * whole system approximately zero after first paint.
 *
 * REDUCED MOTION IS NOT A DEGRADED PATH. Someone who has asked their OS for
 * less motion gets the content at full opacity, immediately, with no transform
 * — not a shorter animation. The check is a media query rather than a CSS
 * `@media` block because the initial state lives in inline styles: CSS could
 * un-hide it a frame later, and a frame of hidden content is exactly what that
 * setting exists to prevent.
 *
 * Only `opacity` and `transform` are animated. Both are composited, so none of
 * this touches layout or triggers a repaint of the section underneath.
 */

export type RevealVariant = 'up' | 'left' | 'right' | 'scale' | 'fade';

/**
 * Where the element starts, before it settles to `none`.
 *
 * Two sets, because an 88px sideways offset is a quarter of a 360px phone
 * screen. At that size a horizontal reveal is not a flourish — it starts the
 * block most of the way off the edge, and on a browser that does not clip it
 * the page gains a horizontal scrollbar for the length of the animation. The
 * narrow set also drops `left`/`right` to a shorter travel and leans on the
 * vertical rise instead, which is the motion that actually reads on a phone.
 */
const OFFSETS: Record<RevealVariant, string> = {
    up: 'translate3d(0, 64px, 0) scale(0.97)',
    left: 'translate3d(-88px, 0, 0) scale(0.97)',
    right: 'translate3d(88px, 0, 0) scale(0.97)',
    scale: 'scale(0.86)',
    fade: 'none',
};

const NARROW_OFFSETS: Record<RevealVariant, string> = {
    up: 'translate3d(0, 40px, 0) scale(0.98)',
    left: 'translate3d(-26px, 14px, 0) scale(0.98)',
    right: 'translate3d(26px, 14px, 0) scale(0.98)',
    scale: 'scale(0.92)',
    fade: 'none',
};

/** Tailwind's `sm`. Below it, the page is one column and offsets must be small. */
const NARROW_MAX = 640;

const isNarrow = (): boolean => {
    try {
        return window.innerWidth < NARROW_MAX;
    } catch {
        return false;
    }
};

const prefersReducedMotion = (): boolean => {
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        // Older browsers and non-DOM environments: animate, it is the common case.
        return false;
    }
};

/* ----------------------------------------------------------- shared observer */

type Fire = () => void;

let observer: IntersectionObserver | null = null;
const callbacks = new WeakMap<Element, Fire>();

const getObserver = (): IntersectionObserver | null => {
    if (typeof IntersectionObserver === 'undefined') return null;
    if (observer) return observer;

    observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                /*
                 * Intersecting, OR already gone past.
                 *
                 * The second half is not a nicety. An IntersectionObserver only
                 * reports what crosses the viewport, and a scroll can skip a
                 * block entirely rather than move through it: End, a jump to an
                 * anchor, a restored scroll position on reload, a flick on a
                 * trackpad. The block is then below the fold on one frame and
                 * above the viewport on the next, never intersecting either
                 * time — so it stays at `opacity: 0` for the rest of the visit,
                 * and scrolling back up reveals a hole where a section should
                 * be. It is reproducible on the About page: jump straight to the
                 * bottom and "Our Mission & Objectives" is simply absent.
                 *
                 * `boundingClientRect.bottom <= 0` is "entirely above the top of
                 * the root", i.e. the visitor is already past it. There is no
                 * entrance left to animate at that point, so it is shown
                 * outright — which is also what they would want on the way back
                 * up.
                 */
                if (!entry.isIntersecting && entry.boundingClientRect.bottom > 0) continue;
                callbacks.get(entry.target)?.();
                callbacks.delete(entry.target);
                observer?.unobserve(entry.target);
            }
        },
        {
            /*
             * A negative bottom margin means a block is considered "in view"
             * only once it is properly on screen rather than one pixel past the
             * fold, so the animation is something the visitor watches happen
             * instead of something already finished by the time they get there.
             */
            rootMargin: '0px 0px -14% 0px',
            threshold: 0.06,
        },
    );
    return observer;
};

interface Props {
    children: ReactNode;
    /** Direction of travel. Default `up`. */
    variant?: RevealVariant;
    /** Milliseconds, for staggering siblings. Keep under ~400 or it reads as lag. */
    delay?: number;
    /** Milliseconds. Default 820. */
    duration?: number;
    className?: string;
    /** Rendered element. `div` unless a section or list item is what belongs here. */
    as?: ElementType;
}

export function Reveal({
    children,
    variant = 'up',
    delay = 0,
    duration = 820,
    className = '',
    as: Tag = 'div',
}: Props) {
    const ref = useRef<HTMLElement | null>(null);

    /*
     * Read once, on first render. Re-reading per render would be a layout query
     * in the render path, and the setting does not meaningfully change mid-visit.
     */
    const [reduced] = useState<boolean>(prefersReducedMotion);

    /*
     * Read once alongside the motion preference. A visitor rotating a phone
     * mid-scroll is not worth a resize listener on every revealed block, and the
     * offset only matters for the one transition each element ever runs.
     */
    const [narrow] = useState<boolean>(isNarrow);

    /*
     * Start visible when motion is reduced, so the element is never hidden even
     * for the one frame before the effect runs. Everyone else starts hidden and
     * is released by the observer.
     */
    const [shown, setShown] = useState<boolean>(reduced);

    useEffect(() => {
        if (shown) return;
        const el = ref.current;
        if (!el) return;

        const io = getObserver();
        // No IntersectionObserver (very old browser): show it rather than
        // leaving the page permanently blank below the fold.
        if (!io) { setShown(true); return; }

        callbacks.set(el, () => setShown(true));
        io.observe(el);

        return () => {
            callbacks.delete(el);
            io.unobserve(el);
        };
    }, [shown]);

    return (
        <Tag
            ref={ref as never}
            className={className}
            style={{
                opacity: shown ? 1 : 0,
                transform: shown ? 'none' : (narrow ? NARROW_OFFSETS : OFFSETS)[variant],
                transition: reduced
                    ? undefined
                    : `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, ` +
                      `transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
                // Promote only while animating: a permanently promoted layer on
                // every section is memory the page does not get back.
                willChange: shown ? undefined : 'opacity, transform',
            }}
        >
            {children}
        </Tag>
    );
}

export default Reveal;
