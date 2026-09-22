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
 * A hash change alone does not fire it either — `pathname` is what it watches —
 * so an in-page anchor still works.
 */
export function ScrollToTop() {
    const { pathname } = useLocation();
    const navigationType = useNavigationType();

    useEffect(() => {
        if (navigationType === 'POP') return;
        /* `auto`, never `smooth`: a smooth scroll on a route change animates
           the new page rushing past under the reader, and on a long page it is
           still travelling when they start to read. */
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, [pathname, navigationType]);

    return null;
}

export default ScrollToTop;
