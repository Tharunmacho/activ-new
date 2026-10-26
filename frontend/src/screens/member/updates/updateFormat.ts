import { PALETTE } from '../../../ui';
import { useLegacyAppearance } from '../../../ui/legacyAppearance';

/** The website's UpdateCard CATEGORY_STYLE, in the app's palette. */
export const CATEGORY_STYLE: Record<string, { label: string; fg: string; bg: string }> = {
  general: { label: 'Update', fg: PALETTE.textSoft, bg: PALETTE.field },
  notice: { label: 'Notice', fg: PALETTE.blueDark, bg: PALETTE.blueSoft },
  policy: { label: 'Policy', fg: PALETTE.infoText, bg: PALETTE.infoSoft },
  scheme: { label: 'Scheme', fg: PALETTE.successText, bg: PALETTE.successSoft },
  achievement: { label: 'Achievement', fg: PALETTE.warningText, bg: PALETTE.warningSoft },
  urgent: { label: 'Urgent', fg: PALETTE.dangerText, bg: PALETTE.dangerSoft },
};

export const CATEGORIES = ['all', 'urgent', 'notice', 'policy', 'scheme', 'achievement', 'general'];

export const categoryStyle = (c?: string | null) => CATEGORY_STYLE[String(c || 'general')] || CATEGORY_STYLE.general;

export const useCategoryStyle = () => {
  const styles = useLegacyAppearance(CATEGORY_STYLE);
  return (category?: string | null) => styles[String(category || 'general')] || styles.general;
};

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ',
  '&rsquo;': '’', '&lsquo;': '‘', '&rdquo;': '”', '&ldquo;': '“', '&mdash;': '—', '&ndash;': '–', '&hellip;': '…', '&bull;': '•',
};

/**
 * The update body is sanitised HTML (server `richText.js`). The app has no
 * HTML renderer, so it is read as text: block ends become paragraph breaks,
 * list items become bullets, every other tag is dropped.
 */
export const htmlToText = (html?: string | null): string => {
  const raw = String(html || '');
  if (!raw) return '';
  return raw
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n• ')
    .replace(/<\/\s*(p|div|h[1-6]|li|ul|ol|blockquote|tr)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? (/^&#(\d+);$/.test(m) ? String.fromCharCode(Number(m.slice(2, -1))) : m))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/** A glyph per category for the premium cards (visual only). Tone names are memberBlocks GLYPH_COLORS keys. */
export const CATEGORY_GLYPH: Record<string, { icon: string; tone: 'red' | 'blue' | 'sky' | 'green' | 'amber' | 'slate' }> = {
  urgent: { icon: 'priority-high', tone: 'red' },
  notice: { icon: 'campaign', tone: 'blue' },
  policy: { icon: 'gavel', tone: 'sky' },
  scheme: { icon: 'savings', tone: 'green' },
  achievement: { icon: 'emoji-events', tone: 'amber' },
  general: { icon: 'article', tone: 'slate' },
};

export const categoryGlyph = (c?: string | null) => CATEGORY_GLYPH[String(c || 'general')] || CATEGORY_GLYPH.general;
