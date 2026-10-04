import { useEffect, useRef, useState } from 'react';
import { Share2, MessageCircle, Link2, Check, Mail } from 'lucide-react';
import { usePublicSharePreview } from './PublicSharePreview';

/**
 * The event page's Share popover, for every other public page that is worth
 * sending on — a gallery album, a news article, a zone or state page.
 *
 * Same four entries as `EventActions`, in the same order: the phone's own
 * share sheet when there is one, then WhatsApp and Email for the desktop where
 * no sheet exists, then Copy link. One control that looks and behaves the same
 * on every page, instead of a per-page button that did something different on
 * each (see `lib/share.ts` for the history).
 *
 * The preview a friend sees when the link lands in WhatsApp or Facebook is not
 * drawn here — crawlers never run this code. It comes from the backend's
 * `/api/v1/share/*` pages, which `deploy/share-previews.htaccess` hands them.
 */

export interface ShareMenuProps {
    /** Absolute link to the page being shared. */
    url: string;
    /** Subject line for email and the share sheet's title. */
    title: string;
    /** One line sent with the link to WhatsApp / email. Defaults to the title. */
    text?: string;
    /** `onDark` for a button sitting on a photograph or a navy band. */
    tone?: 'light' | 'onDark';
    /** Extra classes for the button (e.g. `w-full justify-center`). */
    buttonClassName?: string;
    className?: string;
    /** Which edge the popover lines up with. */
    align?: 'left' | 'right';
}

const BTN_LIGHT =
    'inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-100 bg-white px-4 py-2.5 ' +
    'text-[1rem] font-bold text-brand-800 transition-colors hover:border-brand-200 ' +
    'hover:bg-brand-50/60 hover:text-brand-700';

const BTN_DARK =
    'inline-flex min-h-11 items-center gap-2 rounded-full bg-white/20 px-4 py-2.5 text-[1rem] font-bold ' +
    'text-white ring-1 ring-white/25 transition-colors hover:bg-white/30';

const MENU_ITEM =
    'flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[1.1875rem] font-semibold ' +
    'text-brand-800 transition-colors hover:bg-brand-50';

const MENU =
    'absolute top-[calc(100%+0.5rem)] z-30 w-60 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border ' +
    'border-brand-100 bg-white py-1 shadow-[0_18px_50px_-18px_rgb(28_46_104/0.45)]';

export function ShareMenu({
    url, title, text, tone = 'light', buttonClassName = '', className = '', align = 'left',
}: ShareMenuProps) {
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const holder = useRef<HTMLDivElement | null>(null);

    /* Outside click AND Escape — the key is the only way out on a keyboard. */
    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e: MouseEvent) => {
            if (holder.current && !holder.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const preview = usePublicSharePreview();
    let matches = false;
    try {
        const path = decodeURIComponent(new URL(url, window.location.href).pathname).replace(/\/+$/, '') || '/';
        matches = !!preview && (path === preview.path || path === preview.canonicalPath);
    } catch { /* An external or malformed link keeps its supplied share text. */ }
    const subject = (matches ? preview?.title : title)?.trim() || 'ACTIV';
    const line = (matches ? preview?.shareText || text : text)?.trim() || subject;

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            /* Clipboard refused (plain http, locked-down browser): hand it over to copy by hand. */
            window.prompt('Copy this link', url);
        }
        setOpen(false);
    };

    const nativeShare = async () => {
        try {
            await navigator.share({ title: subject, text: line, url });
            setOpen(false);
        } catch {
            /* Dismissed, or unsupported — the menu stays open and offers the rest. */
        }
    };

    const hasNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
    const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${line}\n\n${url}`)}`;
    const mailHref = `mailto:?subject=${encodeURIComponent(subject)}`
        + `&body=${encodeURIComponent(`${line}\n\n${url}`)}`;

    return (
        <div ref={holder} className={`relative ${className}`}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={open}
                className={`${tone === 'onDark' ? BTN_DARK : BTN_LIGHT} ${buttonClassName}`}
            >
                {copied
                    ? <Check size={15} className={tone === 'onDark' ? 'text-emerald-300' : 'text-emerald-600'} />
                    : <Share2 size={15} />}
                {copied ? 'Link copied' : 'Share'}
            </button>

            {open && (
                <div className={`${MENU} ${align === 'right' ? 'right-0' : 'left-0'}`} role="menu">
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
                        onClick={() => setOpen(false)}
                    >
                        <MessageCircle size={15} className="text-emerald-600" /> WhatsApp
                    </a>
                    <a href={mailHref} role="menuitem" className={MENU_ITEM} onClick={() => setOpen(false)}>
                        <Mail size={15} className="text-brand-500" /> Email
                    </a>
                    <button type="button" role="menuitem" className={MENU_ITEM} onClick={copyLink}>
                        <Link2 size={15} className="text-brand-500" /> Copy link
                    </button>
                </div>
            )}
        </div>
    );
}
