import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft } from 'lucide-react';

/**
 * The way out of a full-screen page — an arrow, in the corner.
 *
 * =========================================================================
 * WHY IT IS AN ICON, AND WHY IT IS IN THE CORNER
 * =========================================================================
 *
 * It began as a labelled pill in the flow of the form column, and the column's
 * logo, heading, step counter and card are all centred — so the one left-aligned
 * thing on the screen lined up with the card beneath it and with nothing else.
 * It read as stranded however correct its margins were. A corner has nothing to
 * align against, and is where a reader already looks for this control.
 *
 * Anchored to the PAGE rather than to the scrolling column: a back control that
 * scrolls away is a back control that gets reported missing, which is exactly
 * what happened.
 *
 * The label survives as the tooltip and the accessible name. Sighted readers get
 * the arrow; nobody using a screen reader loses the wording.
 *
 * ------------------------------------------------------------- where it goes
 *
 * Three answers, in order:
 *
 *   1. `location.state.from` — set by the link that sent the reader here (the
 *      membership offer on an event page sends the event's own path). It lives
 *      in the history entry rather than in `?next=`, so the address stays
 *      `/register` and `/login`: that URL is what a member copies and pastes,
 *      and half of it should not be machinery.
 *   2. the previous history entry, when there is a real one.
 *   3. `fallback`, for a pasted URL or a fresh tab where going "back" would
 *      leave the site altogether.
 *
 * Only a same-site path is honoured. A full or protocol-relative URL in that
 * state would be an open redirect wearing a Back label.
 */

export interface BackArrowProps {
    /** Where to go when there is no state and no history. */
    fallback?: string;
    /** Extra classes for the button — positioning is already handled. */
    className?: string;
    /**
     * Which corner. `left` for a page that opens on a photograph or a coloured
     * panel; `right` where the left corner belongs to something else — the
     * sign-in screen's blue welcome panel, for instance.
     */
    placement?: 'left' | 'right';
    /**
     * What it is drawn on. `onDark` is the translucent white ring for a
     * coloured background; `onLight` is a bordered white button for a pale one,
     * at every width rather than only on a phone.
     */
    tone?: 'onDark' | 'onLight';
    /**
     * How it is drawn.
     *
     * `corner` is the round icon pinned to a corner of the page — right for a
     * full-screen form that opens on a photograph. `link` is an arrow and the
     * word Back, sitting in the flow wherever the page puts it: right where
     * there IS a top-left to put it in, such as the sign-in screen's white
     * column, and what the association asked for there.
     */
    shape?: 'corner' | 'link';
    /**
     * Whether the previous history entry is an acceptable answer.
     *
     * `false` on the sign-in screen: a visitor who arrived there because a
     * session expired has the page that bounced them in their history, and
     * "back" would bounce them straight back to sign in. With it off, this goes
     * where the link said, or to the site's own front door.
     */
    useHistory?: boolean;
}

export function BackArrow({
    fallback = '/',
    className = '',
    placement = 'left',
    tone = 'onDark',
    shape = 'corner',
    useHistory = true,
}: BackArrowProps) {
    const navigate = useNavigate();
    const location = useLocation();

    const from = (location.state as { from?: string } | null)?.from || '';
    const backTo = from.startsWith('/') && !from.startsWith('//') ? from : '';

    const goBack = () => {
        if (backTo) {
            navigate(backTo);
            return;
        }
        // `length > 1` is the only way to tell a navigation from a pasted URL
        // or a fresh tab, where navigate(-1) walks off the site.
        if (useHistory && typeof window !== 'undefined' && window.history.length > 1) {
            navigate(-1);
            return;
        }
        navigate(fallback);
    };

    const label = backTo ? 'Back to where you were' : 'Go back';

    if (shape === 'link') {
        return (
            <button
                type="button"
                onClick={goBack}
                title={label}
                aria-label={label}
                className={`inline-flex items-center gap-2 text-[1.25rem] font-medium text-slate-600
                            transition-colors hover:text-slate-900 ${className}`}
            >
                <ArrowLeft className="h-4 w-4" /> Back
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={goBack}
            title={label}
            aria-label={label}
            className={`absolute top-5 z-30 flex h-10 w-10 items-center justify-center rounded-full
                        transition-colors
                        ${placement === 'right' ? 'right-5' : 'left-5'}
                        ${tone === 'onLight'
                            ? 'border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50'
                            : 'border border-white/40 bg-white/15 text-white backdrop-blur-sm '
                              + 'hover:bg-white/25 max-md:border-slate-200 max-md:bg-white '
                              + 'max-md:text-slate-700 max-md:shadow-sm max-md:hover:bg-slate-50'}
                        ${className}`}
        >
            <ChevronLeft className="h-5 w-5" />
        </button>
    );
}

export default BackArrow;
