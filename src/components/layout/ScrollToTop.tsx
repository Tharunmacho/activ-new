import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * A new page opens at its top.
 *
 * =========================================================================
 * WHY A SINGLE-PAGE APP NEEDS THIS AND A NORMAL SITE DOES NOT
 * =========================================================================
 *
 * A browser resets the scroll position when it loads a document. A router does
 * not: it swaps the tree under a window that stays exactly where it was. So a
 * visitor who scrolled to the bottom of the home page and pressed "See events"
 * got the events page ALREADY SCROLLED to that offset — which, on a shorter
 * page, is the footer. It reads as a broken link, and it was reported as one.
 *
 * ------------------------------------------------------------- except back
 *
 * `POP` is the back and forward buttons, and there the browser's own scroll
 * restoration is right: someone returning to a list wants the row they were
 * reading, not the top of it. Forcing the top on a POP is the other half of
 * this bug, so this stays out of the way for those.
 *
 * A hash is watched too, for the case below.
 */
/*
 * ------------------------------------------------------ except an anchor
 *
 * A link WITH a hash — the Contact page's region tiles go to
 * `/states/tamil-nadu#contact` — means "open that page AT that section". The
 * browser cannot do it on its own here: the section does not exist yet when
 * the route changes, because the page renders it only once its content has
 * loaded. So the target is looked for on each animation frame for a few
 * seconds and scrolled to the moment it appears; if it never does, the page
 * simply stays at its top, which is what it would have done anyway.
 */
const ANCHOR_WAIT_MS = 15000;

export function ScrollToTop() {
    const { pathname, hash } = useLocation();
    const navigationType = useNavigationType();

    useEffect(() => {
        const id = decodeURIComponent(String(hash || '').replace(/^#/, ''));

        /* A POP with no anchor is back/forward: the browser restores. A POP
           WITH one is also a fresh load of a shared `…#contact` link, where the
           browser's own anchor jump has already missed (the section did not
           exist yet), so the search below still runs. */
        if (navigationType === 'POP' && !id) return undefined;

        /* `auto`, never `smooth`: a smooth scroll on a route change animates
           the new page rushing past under the reader, and on a long page it is
           still travelling when they start to read. */
        if (navigationType !== 'POP') window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

        if (!id) return undefined;

        let frame = 0;
        const timers: number[] = [];
        const started = Date.now();

        /* Photographs above the section finish loading after the first scroll
           and push it down the page. Re-aligned twice more — unless the reader
           has started scrolling themselves, which always wins. */
        let userMoved = false;
        const stop = () => { userMoved = true; };
        window.addEventListener('wheel', stop, { passive: true });
        window.addEventListener('touchmove', stop, { passive: true });
        window.addEventListener('keydown', stop);

        const seek = () => {
            let target: HTMLElement | null = null;
            try { target = document.getElementById(id); } catch { target = null; }
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                [900, 2000].forEach((ms) => timers.push(window.setTimeout(() => {
                    if (!userMoved) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, ms)));
                return;
            }
            if (Date.now() - started < ANCHOR_WAIT_MS) frame = window.requestAnimationFrame(seek);
        };
        frame = window.requestAnimationFrame(seek);
        return () => {
            window.cancelAnimationFrame(frame);
            timers.forEach((t) => window.clearTimeout(t));
            window.removeEventListener('wheel', stop);
            window.removeEventListener('touchmove', stop);
            window.removeEventListener('keydown', stop);
        };
    }, [pathname, hash, navigationType]);

    return null;
}

export default ScrollToTop;
