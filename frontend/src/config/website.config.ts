/**
 * ============================================================================
 * THE PUBLIC WEBSITE — where "Explore ACTIV" opens pages
 * ============================================================================
 *
 * Development previews use the local website on port 8080 (USB adb reverse).
 * Release builds use the live website. The API uses its own port 5000.
 *
 * Paths are the website's own routes (website/src/App.tsx). Build every link
 * through `websiteUrl()` so a slug is encoded once and a stray absolute URL is
 * never re-prefixed.
 */

export const WEBSITE_ORIGIN = __DEV__ ? 'http://localhost:8080' : 'https://activ.org.in';

/** The host, for "is this link one of ours?" checks in the in-app viewer. */
export const WEBSITE_HOST = 'activ.org.in';

export const WEBSITE_PATHS = {
  home: '/',
  about: '/about',
  membership: '/membership',
  events: '/events',
  event: (slugOrId: string) => `/events/${encodeURIComponent(String(slugOrId || ''))}`,
  news: '/news',
  article: (slug: string) => `/news/${encodeURIComponent(String(slug || ''))}`,
  schemes: '/schemes',
  gallery: '/gallery',
  galleryItem: (slugOrId: string) => `/gallery/${encodeURIComponent(String(slugOrId || ''))}`,
  zones: '/zones',
  region: (slug: string) => `/regions/${encodeURIComponent(String(slug || ''))}`,
  state: (slug: string) => `/states/${encodeURIComponent(String(slug || ''))}`,
  contact: '/contact',
  donate: '/donate',
  privacy: '/privacy-policy',
  terms: '/terms-and-conditions',
  refund: '/refund-policy',
  cancellation: '/cancellation-policy',
  deleteAccount: '/delete-account',
};

/** Website paths use the current environment; external URLs are left alone. */
export const websiteUrl = (pathOrUrl?: string | null): string => {
  const raw = String(pathOrUrl || '').trim();
  if (!raw) return `${WEBSITE_ORIGIN}/`;
  if (__DEV__ && /^https:\/\/(?:www\.)?activ\.org\.in(?=[/?#]|$)/i.test(raw)) {
    return raw.replace(/^https:\/\/(?:www\.)?activ\.org\.in/i, WEBSITE_ORIGIN);
  }
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${WEBSITE_ORIGIN}/${raw.replace(/^\/+/, '')}`;
};

/** True for a URL on the association's own website (any subdomain). */
export const isWebsiteUrl = (url?: string | null): boolean => {
  const raw = String(url || '').trim().toLowerCase();
  if (__DEV__ && /^http:\/\/localhost:8080(?:[/?#]|$)/.test(raw)) return true;
  const m = /^https?:\/\/([^/?#:]+)/.exec(raw);
  if (!m) return false;
  const host = m[1] || '';
  return host === WEBSITE_HOST || host.endsWith(`.${WEBSITE_HOST}`);
};

/** Keep page anchors and filters intact when entering the app's public browser. */
export const publicWebsiteUrl = (pathOrUrl?: string | null): string => {
  const candidate = websiteUrl(pathOrUrl);
  const base = isWebsiteUrl(candidate) ? candidate : `${WEBSITE_ORIGIN}/`;
  const hashIndex = base.indexOf('#');
  const hash = hashIndex < 0 ? '' : base.slice(hashIndex);
  const page = hashIndex < 0 ? base : base.slice(0, hashIndex);
  const queryIndex = page.indexOf('?');
  const path = queryIndex < 0 ? page : page.slice(0, queryIndex);
  const query = queryIndex < 0 ? [] : page.slice(queryIndex + 1).split('&').filter(part => part && !/^activApp(?:=|$)/.test(part));
  return `${path}?${[...query, 'activApp=public'].join('&')}${hash}`;
};
