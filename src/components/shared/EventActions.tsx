import { useEffect, useRef, useState } from 'react';
import {
    CalendarPlus, Share2, MessageCircle, Link2, Check, Navigation, Mail,
} from 'lucide-react';
import {
    downloadIcs, googleCalendarUrl, directionsUrl, eventPageUrl, shareLine, eventPhase,
    type CalendarEventLike,
} from '@/lib/eventCalendar';

/**
 * The row of things a reader can do with an event OTHER than book it now.
 *
 * =========================================================================
 * WHY THIS IS NOT THREE ICONS IN A CORNER
 * =========================================================================
 *
 * Add-to-calendar and share are usually decorative — a tray of social icons
 * nobody presses. They are load-bearing here for one reason: this association's
 * events are attended by companies, and the person reading the page is very
 * often not the person who will come. "Send it to my partner" and "put it in my
 * diary so I remember to book" are the two most common intentions on the page
 * after booking itself, and until now the page served neither.
 *
 * So each control is a labelled button, not a glyph, and the calendar and share
 * menus open as small popovers rather than immediately doing something — a
 * reader with Outlook and a reader with Google Calendar want different files,
 * and guessing wrong gives them a download they cannot open.
 *
 * --------------------------------------------------------------- what is drawn
 *
 * Every control hides itself when the event cannot support it. An undated event
 * gets no calendar button (an entry with no date imports as 1970), an event
 * with no venue gets no directions button. A disabled control that explains
 * nothing is worse than an absent one — the reader assumes the page is broken.
 */

export interface EventActionsProps {
    event: CalendarEventLike;
    /** `row` sits under the title; `stack` fills a sidebar column. */
    layout?: 'row' | 'stack';
    className?: string;
}

/** One control. Same paint for all of them, so the row reads as a set. */
const BTN =
    'inline-flex items-center gap-2 rounded-full border border-brand-100 bg-white px-4 py-2.5 ' +
    'text-[1rem] font-bold text-brand-800 transition-colors hover:border-brand-200 ' +
    'hover:bg-brand-50/60 hover:text-brand-700';

/** A line inside one of the popovers. */
const MENU_ITEM =
    'flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[1.1875rem] font-semibold ' +
    'text-brand-800 transition-colors hover:bg-brand-50';

const MENU =
    'absolute left-0 top-[calc(100%+0.5rem)] z-30 w-60 overflow-hidden rounded-2xl border ' +
    'border-brand-100 bg-white py-1 shadow-[0_18px_50px_-18px_rgb(28_46_104/0.45)]';

export function EventActions({ event, layout = 'row', className = '' }: EventActionsProps) {
    const [openMenu, setOpenMenu] = useState<'calendar' | 'share' | null>(null);
    const [copied, setCopied] = useState(false);
    const holder = useRef<HTMLDivElement | null>(null);

    /*
     * A popover closes on an outside click and on Escape.
     *
     * Both, not one. The pointer case is what a mouse user expects and the key
     * is the only way out for somebody on a keyboard — a menu that can only be
     * dismissed by clicking elsewhere is a keyboard trap.
     */
    useEffect(() => {
        if (!openMenu) return undefined;
        const onDown = (e: MouseEvent) => {
            if (holder.current && !holder.current.contains(e.target as Node)) setOpenMenu(null);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenMenu(null); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [openMenu]);

    const url = eventPageUrl(event);
    const line = shareLine(event);
    /*
     * No diary entry for an event that has already happened - it would be filed
     * in the past, where the reader will never see it, and the button reads as
     * the page not knowing what day it is. Share and Directions stay: a past
     * event is still worth sending on and still has an address.
     */
    const calendarHref = eventPhase(event) === 'past' ? '' : googleCalendarUrl(event);
    const directions = directionsUrl(event);

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            // The tick is the whole confirmation, so it has to last long enough
            // to be noticed and short enough that the button is usable again.
            setTimeout(() => setCopied(false), 2000);
        } catch {
            /*
             * The clipboard API is refused outright in some browsers and on any
             * page not served over https. Selecting the link for the reader is
             * the honest fallback — it leaves them one keystroke from a copy
             * instead of a button that silently did nothing.
             */
            window.prompt('Copy this link', url);
        }
        setOpenMenu(null);
    };

    /*
     * The phone's own share sheet when there is one — it reaches WhatsApp,
     * Telegram, Mail, AirDrop and everything else the reader has installed,
     * which is a better list than any we could hardcode. The explicit WhatsApp
     * and email entries stay for desktop, where no such sheet exists.
     */
    const nativeShare = async () => {
        try {
            await navigator.share({ title: event.title || 'ACTIV event', text: line, url });
            setOpenMenu(null);
        } catch {
            /* Dismissed, or unsupported — the menu stays open and offers the rest. */
        }
    };

    const hasNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
    const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${line}\n\n${url}`)}`;
    const mailHref = `mailto:?subject=${encodeURIComponent(event.title || 'ACTIV event')}`
        + `&body=${encodeURIComponent(`${line}\n\n${url}`)}`;

    const wrap = layout === 'stack'
        ? 'flex flex-col items-stretch gap-2'
        : 'flex flex-wrap items-center gap-2.5';

    return (
        <div ref={holder} className={`relative ${wrap} ${className}`}>

            {/* ---------------------------------------------------- calendar */}
            {calendarHref && (
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setOpenMenu(openMenu === 'calendar' ? null : 'calendar')}
                        aria-haspopup="menu"
                        aria-expanded={openMenu === 'calendar'}
                        className={`${BTN} ${layout === 'stack' ? 'w-full justify-center' : ''}`}
                    >
                        <CalendarPlus size={15} /> Add to calendar
                    </button>

                    {openMenu === 'calendar' && (
                        <div className={MENU} role="menu">
                            <a
                                href={calendarHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                role="menuitem"
                                className={MENU_ITEM}
                                onClick={() => setOpenMenu(null)}
                            >
                                <CalendarPlus size={15} className="text-brand-500" /> Google Calendar
                            </a>
                            <button
                                type="button"
                                role="menuitem"
                                className={MENU_ITEM}
                                onClick={() => { downloadIcs(event); setOpenMenu(null); }}
                            >
                                <CalendarPlus size={15} className="text-brand-500" />
                                {/* Named by what it opens, not by its file
                                    extension — ".ics" means nothing to most
                                    readers, "Apple / Outlook" means the app
                                    they already use. */}
                                Apple / Outlook (.ics)
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ------------------------------------------------------- share */}
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setOpenMenu(openMenu === 'share' ? null : 'share')}
                    aria-haspopup="menu"
                    aria-expanded={openMenu === 'share'}
                    className={`${BTN} ${layout === 'stack' ? 'w-full justify-center' : ''}`}
                >
                    {copied ? <Check size={15} className="text-emerald-600" /> : <Share2 size={15} />}
                    {copied ? 'Link copied' : 'Share'}
                </button>

                {openMenu === 'share' && (
                    <div className={MENU} role="menu">
                        {hasNativeShare && (
                            <button type="button" role="menuitem" className={MENU_ITEM} onClick={nativeShare}>
                                <Share2 size={15} className="text-brand-500" /> Share…
                            </button>
                        )}
                        <a
                            href={whatsappHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            role="menuitem"
                            className={MENU_ITEM}
                            onClick={() => setOpenMenu(null)}
                        >
                            <MessageCircle size={15} className="text-emerald-600" /> WhatsApp
                        </a>
                        <a
                            href={mailHref}
                            role="menuitem"
                            className={MENU_ITEM}
                            onClick={() => setOpenMenu(null)}
                        >
                            <Mail size={15} className="text-brand-500" /> Email
                        </a>
                        <button type="button" role="menuitem" className={MENU_ITEM} onClick={copyLink}>
                            <Link2 size={15} className="text-brand-500" /> Copy link
                        </button>
                    </div>
                )}
            </div>

            {/* -------------------------------------------------- directions */}
            {directions && (
                <a
                    href={directions}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${BTN} ${layout === 'stack' ? 'w-full justify-center' : ''}`}
                >
                    <Navigation size={15} /> Directions
                </a>
            )}
        </div>
    );
}

export default EventActions;
