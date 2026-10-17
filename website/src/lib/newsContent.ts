import { resolveMediaUrl } from '@/config/api.config';
import type { NewsArticle } from '@/services/cmsNewsApi';

export const NEWS_PHOTO_LIMIT = 20;
export const NEWS_ATTACHMENT_LIMIT = 10;
export const NEWS_LINK_LIMIT = 10;
export const NEWS_DOCUMENT_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.txt,.csv,.rtf,.zip';

export function newsLinkHref(value?: string, allowBareHost = false): string {
    let raw = String(value || '').trim();
    if (!raw || /[\u0000-\u0020\\]/.test(raw)) return '';
    if (allowBareHost && !/^[a-z][a-z\d+.-]*:/i.test(raw)) raw = `https://${raw}`;
    try {
        const url = new URL(raw);
        return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
}

export function newsDocumentHref(value?: string): string {
    const raw = String(value || '').trim();
    if (/^\/uploads\/[^\s\\]+$/i.test(raw) && !raw.split('/').includes('..')) return resolveMediaUrl(raw);
    const external = newsLinkHref(raw);
    return external.startsWith('https://') ? external : '';
}

export function hasNewsContent(article: Partial<NewsArticle>): boolean {
    return !!(String(article.summary || '').trim() || String(article.body || '').trim()
        || article.photos?.some(photo => photo?.url)
        || article.attachments?.some(file => file?.url)
        || article.links?.some(link => link?.url)
        || article.extraFields?.length);
}

export function newsAssetsError(article: Partial<NewsArticle>): string {
    if ((article.photos || []).length > NEWS_PHOTO_LIMIT) return `Keep up to ${NEWS_PHOTO_LIMIT} article photos.`;
    if ((article.attachments || []).length > NEWS_ATTACHMENT_LIMIT) return `Keep up to ${NEWS_ATTACHMENT_LIMIT} documents.`;
    if ((article.links || []).length > NEWS_LINK_LIMIT) return `Keep up to ${NEWS_LINK_LIMIT} related links.`;
    const invalid = (article.links || []).findIndex(link => !newsLinkHref(link?.url));
    if (invalid >= 0) return `Enter a complete http:// or https:// address for link ${invalid + 1}, or remove that link.`;
    return '';
}

export function newsFileSize(bytes?: number): string {
    const size = Number(bytes) || 0;
    return size > 0 ? size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(size / 1024)} KB` : '';
}
