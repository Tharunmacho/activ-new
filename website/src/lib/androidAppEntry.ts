export const ACTIV_ANDROID_PACKAGE = 'in.activ.membership';
export const ACTIV_ANDROID_STORE_URL = `https://play.google.com/store/apps/details?id=${ACTIV_ANDROID_PACKAGE}`;
export const ANDROID_ENTRY_DISMISSED = 'activ-android-entry-dismissed';

// Keep this explicit list aligned with the native app-link contract. Payment
// callbacks, tokenized documents, admin and OAuth routes remain in the browser.
const exactPaths = new Set([
  '/', '/onboarding', '/notifications', '/login', '/register', '/about', '/membership', '/contact', '/donate',
  '/privacy-policy', '/terms-and-conditions', '/refund-policy', '/cancellation-policy', '/delete-account',
  '/events', '/news', '/gallery', '/schemes', '/schemes/central', '/schemes/state', '/schemes/states',
  '/zones', '/regions', '/states',
  '/member/forms/personal', '/member/forms/business', '/member/forms/financial', '/member/forms/declaration',
  '/member/application-status', '/member/profile', '/member/profile-view', '/member/settings', '/member/documents', '/member/plan',
  '/member/certificate/membership', '/member/certificate/tax-exemption',
  '/payment/membership-plans', '/payment/member-dashboard', '/member/events', '/member/updates',
]);
const slug = '[A-Za-z0-9_-]{1,160}';
const section = '(?:about|leaders|keyAchievements|sectorUpdates|newsUpdates|speakInMedia|achievements|events|projects|policyAdvocacy|consultingServices|publications|mediaReleases|mediaCoverages|gallery)';
const pathPatterns = [
  new RegExp(`^/(?:member/)?events/${slug}(?:/book)?$`),
  new RegExp(`^/news/${slug}$`),
  new RegExp(`^/gallery/${slug}(?:/photo/[0-9]{1,6})?$`),
  new RegExp(`^/schemes/(?:states?|view)/${slug}$`),
  new RegExp(`^/(?:regions|states)/${slug}(?:/${section})?$`),
  new RegExp(`^/legal/${slug}$`),
  new RegExp(`^/member/updates/${slug}$`),
];

/** Canonical HTTPS target with only navigation inputs understood by the app. */
export function androidAppTarget(value: string): string | null {
  if (!value || value.length > 2048 || /[\s\\;#\u0000-\u001f]/.test(value)) return null;
  // Decode once to reject concealed intent delimiters and traversal before URL
  // normalization can erase them. Query values are encoded again below.
  let decoded: string;
  try { decoded = decodeURIComponent(value); } catch { return null; }
  if (/[\\;#\u0000-\u001f]/.test(decoded) || /(?:^|\/)\.\.?(?:\/|\?|$)/.test(decoded)) return null;
  let url: URL;
  try { url = new URL(value, 'https://activ.org.in'); } catch { return null; }
  if (url.origin !== 'https://activ.org.in' || url.username || url.password || url.port || url.hash) return null;
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (!exactPaths.has(path) && !pathPatterns.some(pattern => pattern.test(path))) return null;
  const keys = [...url.searchParams.keys()];
  if (keys.some(key => /^(?:token|access_token|id_token|code|payment|payment_id|payment_request_id|orderId|order_id|amount|activApp|manageToken|manage_token|manage|edit)$/i.test(key))) return null;
  if (url.searchParams.get('view') === 'receipt') return null;
  const params = new URLSearchParams();
  const keep = (key: string, valid: (value: string) => boolean) => {
    if (!url.searchParams.has(key)) return true;
    const values = url.searchParams.getAll(key);
    if (values.length !== 1 || !valid(values[0])) return false;
    params.set(key, values[0]); return true;
  };
  const booking = /^\/(?:member\/)?events\/[A-Za-z0-9_-]+\/book$/.test(path);
  if (url.searchParams.has('ref') && !booking) return null;
  if (booking && !keep('ref', value => /^[a-z0-9_-]{1,160}$/i.test(value))) return null;
  if (path === '/contact' && !keep('state', value => value.length <= 100 && /^[\p{L}\p{N} _-]+$/u.test(value))) return null;
  if (path === '/' || path === '/onboarding' || path === '/notifications') {
    if (!keep('notifications', value => value === 'open') || !keep('notice', value => /^[a-f0-9]{24}$/i.test(value))) return null;
  }
  if (path === '/payment/membership-plans') {
    if (!keep('renew', value => /^(?:true|false|1|0)$/.test(value)) || !keep('upgrade', value => /^(?:true|false|1|0)$/.test(value))) return null;
  }
  const search = params.toString();
  return `https://activ.org.in${path}${search ? `?${search}` : ''}`;
}

export function androidAppIntent(value: string): string | null {
  const target = androidAppTarget(value);
  if (!target) return null;
  return `intent://${target.slice('https://'.length)}#Intent;scheme=https;package=${ACTIV_ANDROID_PACKAGE};S.browser_fallback_url=${encodeURIComponent(ACTIV_ANDROID_STORE_URL)};end`;
}

export const isAndroidBrowser = (userAgent: string): boolean => /\bAndroid\b/i.test(userAgent);
