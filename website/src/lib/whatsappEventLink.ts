/** Keep invite codes and query parameters intact when accepting copied links. */
function parseWhatsAppEventLink(value: string): URL | null {
    const text = value.trim();
    const candidate = /^(?:chat\.whatsapp\.com\/|(?:www\.)?whatsapp\.com\/channel\/)/i.test(text)
        ? `https://${text}` : text;
    if (/[\s\\]/.test(candidate)) return null;
    try {
        const url = new URL(candidate);
        if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
        const group = url.hostname === 'chat.whatsapp.com' && /^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname);
        const channel = ['whatsapp.com', 'www.whatsapp.com'].includes(url.hostname)
            && /^\/channel\/[A-Za-z0-9_-]+\/?$/.test(url.pathname);
        return group || channel ? url : null;
    } catch {
        return null;
    }
}

export const normalizeWhatsAppEventLink = (value: string): string =>
    parseWhatsAppEventLink(value)?.href || value.trim();

export const isWhatsAppEventLink = (value: string): boolean =>
    !value.trim() || !!parseWhatsAppEventLink(value);

/** WhatsApp's Share action can copy a sentence followed by the invite URL. */
export function whatsappEventLinkFromClipboard(text: string): string | null {
    if (text.trim() && isWhatsAppEventLink(text)) return normalizeWhatsAppEventLink(text);
    const links = Array.from(text.matchAll(/(?:^|\s)(https:\/\/[^\s<>]+)/gi), match => match[1])
        .filter(isWhatsAppEventLink);
    return links.length === 1 ? normalizeWhatsAppEventLink(links[0]) : null;
}
