import { toast } from 'sonner';

/**
 * SHARING, ONE WAY EVERYWHERE — events, gallery, news, schemes.
 *
 * The share buttons were written per page, and two of them failed quietly: on
 * a desktop (no share sheet) they copied the link with no sign anything had
 * happened, so the button read as broken; and a share sheet that failed threw
 * an unhandled rejection. This is the one implementation:
 *
 *   1. the device's own share sheet when there is one (phones: WhatsApp,
 *      Telegram, Instagram, Mail …) — dismissing it is not an error;
 *   2. otherwise the link is copied, and a toast SAYS so;
 *   3. if even the clipboard is refused (plain http, locked-down browser),
 *      the link is put in front of the reader to copy by hand.
 */

/** The public site's origin: pinned by VITE_PUBLIC_SITE_URL, else this tab's. */
export const publicOrigin = (): string => {
    const pinned = String(import.meta.env.VITE_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
    return pinned || (typeof window !== 'undefined' ? window.location.origin : '');
};

/** An absolute public link for a site path ("/gallery/abc" -> "https://…/gallery/abc"). */
export const publicUrl = (path: string): string =>
    `${publicOrigin()}${path.startsWith('/') ? '' : '/'}${path}`;

export type ShareOutcome = 'shared' | 'cancelled' | 'copied' | 'prompted';

export async function shareLink({ title, text, url }: { title?: string; text?: string; url: string }): Promise<ShareOutcome> {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav && typeof nav.share === 'function') {
        try {
            await nav.share({ title: title || 'ACTIV', text, url });
            return 'shared';
        } catch (error) {
            // Closing the sheet is a choice, not a failure: say nothing.
            if ((error as DOMException)?.name === 'AbortError') return 'cancelled';
            // Anything else (no user gesture, unsupported data): fall through to copy.
        }
    }
    try {
        await nav?.clipboard?.writeText(url);
        if (!nav?.clipboard) throw new Error('no clipboard');
        toast.success('Link copied', { description: 'Paste it into WhatsApp, Facebook or anywhere to share.' });
        return 'copied';
    } catch {
        window.prompt('Copy this link to share it', url);
        return 'prompted';
    }
}
