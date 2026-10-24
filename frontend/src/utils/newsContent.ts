import { resolveMediaUrl } from '../config/api.config';
import { publicPlainText } from './publicRichText';

const visible = (value: any) => value && value.isHidden !== true && value.visible !== false;
const text = (value: unknown) => publicPlainText(typeof value === 'string' ? value : '').trim();

/** Published resource links use web URLs, without credentials or app schemes. */
export function newsWebUrl(value: unknown, httpsOnly = false): string {
  if (typeof value !== 'string') return '';
  const url = value.trim();
  if (!url || /[\u0000-\u0020\u007f\\]/.test(url)) return '';
  const match = /^(https?):\/\/([a-z\d](?:[a-z\d.-]*[a-z\d])?)(?::(\d{1,5}))?(?:[/?#][^\s]*)?$/i.exec(url);
  if (!match || httpsOnly && match[1].toLowerCase() !== 'https' || match[3] && (Number(match[3]) < 1 || Number(match[3]) > 65535)) return '';
  try { if (/[\u0000-\u001f\u007f\\]/.test(decodeURIComponent(url))) return ''; } catch { return ''; }
  return url;
}

function mediaUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || /[\u0000-\u0020\u007f\\]/.test(value)) return '';
  const raw = value.trim();
  if (/^[a-z][a-z\d+.-]*:/i.test(raw)) return newsWebUrl(raw);
  try { if (raw.startsWith('//') || /(?:^|\/)\.{1,2}(?:\/|$)/.test(decodeURIComponent(raw))) return ''; } catch { return ''; }
  return newsWebUrl(resolveMediaUrl(raw));
}

export type NewsMedia = { url: string; type: 'image' | 'video'; alt: string; caption: string };
export function newsMedia(article: any): NewsMedia[] {
  const cover = typeof article?.image === 'string' ? { url: article.image || article?.imageUrl }
    : { ...article?.image, url: article?.image?.url || article?.imageUrl };
  const candidates = [cover, ...(Array.isArray(article?.photos) ? article.photos.slice(0, 20) : [])];
  const seen = new Set<string>();
  return candidates.flatMap((value, index) => {
    if (!visible(value)) return [];
    const item = typeof value === 'string' ? { url: value } : value;
    const url = mediaUrl(item.url);
    if (!url || seen.has(url)) return [];
    seen.add(url);
    return [{ url, type: item.type === 'video' ? 'video' as const : 'image' as const, alt: text(item.alt || article?.title), caption: text(item.caption || (index > 0 ? item.alt : '')) }];
  });
}

export function newsAttachments(article: any): { url: string; label: string; filename: string }[] {
  const seen = new Set<string>();
  return (Array.isArray(article?.attachments) ? article.attachments : []).slice(0, 10).flatMap((item: any) => {
    if (!visible(item) || typeof item.url !== 'string') return [];
    const raw = item.url.trim();
    const url = /^\/?uploads\//.test(raw) ? newsWebUrl(mediaUrl(raw), true) : newsWebUrl(raw, true);
    const filename = text(item.filename);
    const extension = /\.(pdf|docx?|xlsx?|pptx?|odt|ods|odp|txt|csv|rtf|zip)$/i;
    const mime = /^(?:application\/(?:pdf|msword|rtf|zip|vnd\.(?:ms-(?:excel|powerpoint)|openxmlformats-officedocument\.(?:wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation)|oasis\.opendocument\.(?:text|spreadsheet|presentation)))|text\/(?:plain|csv|rtf))$/i;
    let pathname = '';
    try { pathname = decodeURIComponent(url.split(/[?#]/, 1)[0]); } catch { return []; }
    if (!url || !(extension.test(filename || pathname) || mime.test(String(item.mimeType || ''))) || Number(item.size || 0) > 20 * 1024 * 1024 || seen.has(url)) return [];
    seen.add(url);
    return [{ url, label: text(item.label) || filename || 'Download document', filename }];
  });
}

export function newsLinks(article: any): { url: string; label: string }[] {
  const seen = new Set<string>();
  return (Array.isArray(article?.links) ? article.links : []).slice(0, 10).flatMap((item: any) => {
    if (!visible(item)) return [];
    const url = newsWebUrl(item.url);
    if (!url || seen.has(url)) return [];
    seen.add(url);
    const fallback = /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)(?:[/?#]|$)/i.test(url) ? 'Watch on YouTube'
      : /^https?:\/\/(?:wa\.me|(?:api\.|chat\.|www\.)?whatsapp\.com)(?:[/?#]|$)/i.test(url) ? 'Open WhatsApp' : 'Open related link';
    return [{ url, label: text(item.label) || fallback }];
  });
}

export const newsArticlePath = (article: any): string => {
  const key = article?.slug || article?.id || article?._id;
  return typeof key === 'string' && key.trim() ? '/news/' + encodeURIComponent(key.trim()) : '';
};
