import { Alert, Platform, Share } from 'react-native';
import { publicPlainText } from '../utils/publicRichText';

const ORIGIN = 'https://activ.org.in';
const PUBLIC_PAGE = /^\/(?:|(?:onboarding|about|membership|contact|donate|notifications|privacy-policy|terms-and-conditions|refund-policy|cancellation-policy)\/?|legal\/[^/?#]+\/?|events(?:\/[^/?#]+(?:\/book)?)?\/?|news(?:\/[^/?#]+)?\/?|gallery(?:\/[^/?#]+(?:\/photo\/\d+)?)?\/?|schemes(?:\/(?:central|state(?:\/[^/?#]+)?|view\/[^/?#]+))?\/?|(?:regions|states)\/[^/?#]+(?:\/[^/?#]+)?\/?|network\/company\/[a-fA-F\d]{24}\/?|member\/(?:updates|events)\/[^/?#]+\/?)$/;

/** Share recipient-facing links, never localhost, API URLs or session parameters. */
export function publicShareUrl(pathOrUrl?: string | null): string {
  let raw = String(pathOrUrl || '').trim();
  if (!raw || /[\u0000-\u0020\\]/.test(raw)) return '';
  if (/^https?:\/\//i.test(raw)) {
    const own = /^https?:\/\/(?:www\.)?activ\.org\.in(?=\/|[?#]|$)|^http:\/\/localhost:8080(?=\/|[?#]|$)/i.exec(raw);
    if (!own) return '';
    raw = raw.slice(own[0].length) || '/';
    if (/^[?#]/.test(raw)) raw = '/' + raw;
  }
  if (!raw.startsWith('/') || raw.startsWith('//')) return '';
  const page = raw.split(/[?#]/, 1)[0];
  if (!PUBLIC_PAGE.test(page)) return '';
  // Validate each decoded segment before a recipient's browser can normalize
  // it. Ordinary escaped names remain valid; traversal and nested URLs do not.
  try {
    if (page.split('/').some(segment => {
      const decoded = decodeURIComponent(segment);
      return decoded === '.' || decoded === '..' || /[\u0000-\u001f\u007f/\\?#%]/.test(decoded);
    })) return '';
  } catch { return ''; }
  let query = '';
  if (/^\/notifications\/?$/.test(page)) {
    const parameters = raw.split('#', 1)[0].split('?')[1] || '';
    const found = /(?:^|&)notice=([^&]*)/.exec(parameters) || /(?:^|&)id=([^&]*)/.exec(parameters);
    if (found) {
      let id = '';
      try { id = decodeURIComponent(found[1]); } catch { return ''; }
      if (!/^[a-f\d]{24}$/i.test(id)) return '';
      query = '?notice=' + encodeURIComponent(id);
    }
  }
  return ORIGIN + page + query;
}

let sharing = false;
export async function sharePublicPage({ path, title }: { path: string; title?: string | null }): Promise<boolean> {
  const url = publicShareUrl(path);
  if (!url || sharing) return false;
  // Member links retain the website's sign-in/audience checks. Do not copy a
  // personalized notice or restricted event title into the system share sheet.
  const label = /\/member\/updates\//.test(url) ? 'ACTIV association update'
    : /\/member\/events\//.test(url) ? 'ACTIV member event'
      : publicPlainText(title || 'ACTIV').slice(0, 200) || 'ACTIV';
  sharing = true;
  try {
    if (typeof Share.share !== 'function') throw new Error('Share unavailable');
    const result = await Share.share(Platform.OS === 'ios'
      ? { title: label, message: label, url }
      : { title: label, message: `${label}\n${url}` }, { dialogTitle: 'Share ' + label });
    return result.action !== Share.dismissedAction;
  } catch (error: any) {
    if (!/cancel|dismiss/i.test(`${error?.code || ''} ${error?.message || ''}`)) {
      Alert.alert('Could not share', 'Please try again to open your phone’s share options.');
    }
    return false;
  } finally { sharing = false; }
}
