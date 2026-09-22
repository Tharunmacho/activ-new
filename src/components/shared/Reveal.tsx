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

/* ----------------------------------------------- what is already on screen */

/**
 * ==========================================================================
 * IF IT IS ALREADY ON SCREEN WHEN IT APPEARS, IT DOES NOT ANIMATE IN
 * ==========================================================================
 *
 * An entrance effect is for something a reader ARRIVES AT. Run it on what is
 * already in front of them and it is not an entrance — it is the page
 * assembling itself in front of somebody who has not asked for anything.
 *
 * ------------------------------------------------- and the timer was wrong
 *
 * This was a module-level "we are still opening" flag that a scroll, or two
 * and a half seconds, turned off. Both were the wrong question.
 *
 * These pages FETCH. The band paints immediately and the leadership board
 * mounts when the API answers, which on a slow link is well past any timer —
 * so by the time the portraits existed the flag said "not opening any more",
 * the block was handed to the observer, and the observer’s root is
 * deliberately 28% shorter than the viewport. At about 600px of an 830px
 * window the board was BELOW that line and above the fold at the same time:
 * no entry, no reveal, four hundred pixels of nothing under a heading. That
 * is what "I only get the leaders when I scroll down" was.
 *
 * There is no flag and no timer now. Each block asks one question about
 * ITSELF, when it mounts, against the REAL viewport: am I on screen? If yes
 * it is simply there, whenever it arrives and whatever the rest of the page
 * is doing. If no, it waits for the observer and animates on the way in,
 * which is the case the effect was written for.
 */

type Fire = (instant: boolean) => void;

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

                const fire = callbacks.get(entry.target);
                callbacks.delete(entry.target);
                observer?.unobserve(entry.target);
                if (!fire) continue;

                /*
                 * An entry means the block crossed into view, which is the
                 * case the effect exists for. The on-screen-at-mount case is
                 * settled before the observer is ever reached.
                 */
                fire(false);
            }
        },
        {
            /*
             * TOP: +9999px. BOTTOM: -14%.
             *
             * The bottom margin is the effect itself — a block counts as "in
             * view" only once it is properly on screen rather than one pixel
             * past the fold, so the animation is something the visitor watches
             * happen instead of something already finished by the time they get
             * there.
             *
             * IT IS -28%, NOT -14%. At fourteen per cent a section heading whose
             * first line had just cleared the fold was already released, so on a
             * tall window the heading under the hero — "STATE / Tamil Nadu
             * Leaders" — fired during the page load and a reader scrolling down
             * to it found it already there. Twenty-eight is a little over a
             * quarter of the window: enough that a block has to be properly
             * arrived at, and still short of the half that would make a reader
             * scroll past something before it appears.
             *
             * THE TOP MARGIN IS THE FIX FOR THE SKIP. An
             * IntersectionObserver reports threshold CROSSINGS, and a scroll can
             * move a block from below the fold to above the viewport inside a
             * single frame — End, a jump to an anchor, a restored scroll
             * position on reload, a hard flick on a trackpad. It never
             * intersects on either sample, so no entry is ever delivered and the
             * block stays at `opacity: 0` for the rest of the visit. Scrolling
             * back up then shows a hole where a section should be. (The
             * `bottom <= 0` branch above cannot save it: that runs on an entry,
             * and the whole problem is that there is no entry.)
             *
             * Extending the root far above the viewport means anything the
             * visitor has already scrolled PAST is intersecting, so the observer
             * does deliver an entry and the block is shown outright — which is
             * what they would want on the way back up anyway. Blocks still below
             * the fold are unaffected: the bottom edge is where it always was.
             */
            rootMargin: '9999px 0px -28% 0px',
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
    /**
     * An anchor on the rendered element.
     *
     * Forwarded rather than left to a wrapper: this component owns the element,
     * and a `<div id>` wrapped around a revealed `<section>` is an extra box in
     * every grid it is dropped into — one of which is a `grid` whose children
     * are its tracks.
     */
    id?: string;
}

export function Reveal({
    children,
    variant = 'up',
    delay = 0,
    duration = 820,
    className = '',
    as: Tag = 'div',
    id,
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

    /*
     * Shown WITHOUT an entrance — the opening screen, and the reduced-motion
     * setting, which has always worked this way and is the same requirement:
     * be there, do not perform.
     */
    const [instant, setInstant] = useState<boolean>(reduced);

    useEffect(() => {
        if (shown) return;
        const el = ref.current;
        if (!el) return;

        /*
         * ON SCREEN ALREADY? THEN IT IS SIMPLY THERE.
         *
         * Measured against the real viewport, in an effect, after layout —
         * not asked of the observer, whose root is 28% shorter and which
         * therefore reports nothing about a block sitting just below that
         * line and just above the fold. See the note at the head of the file.
         *
         * `bottom > 0` as well as `top < innerHeight`: a block the reader has
         * already scrolled past has no entrance left to play either, and
         * fading it in behind them is worse than not animating it at all.
         */
        try {
            const box = el.getBoundingClientRect();
            if (box.top < window.innerHeight && box.bottom > 0) {
                setInstant(true);
                setShown(true);
                return;
            }
        } catch {
            /* No layout to measure: fall through to the observer. */
        }

        const io = getObserver();
        // No IntersectionObserver (very old browser): show it rather than
        // leaving the page permanently blank below the fold.
        if (!io) { setShown(true); return; }

        callbacks.set(el, (instant) => { setInstant(instant); setShown(true); });
        io.observe(el);

        return () => {
            callbacks.delete(el);
            io.unobserve(el);
        };
    }, [shown]);

    return (
        <Tag
            ref={ref as never}
            id={id}
            className={className}
            style={{
                opacity: shown ? 1 : 0,
                transform: shown ? 'none' : (narrow ? NARROW_OFFSETS : OFFSETS)[variant],
                transition: reduced || instant
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
