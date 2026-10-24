import { isUpcomingEvent } from '../utils/eventLifecycle';
import api from './api';
import { resolveMediaUrl } from '../config/api.config';
import { WEBSITE_PATHS } from '../config/website.config';
import { publishedExploreZones } from '../utils/exploreRegions';
import { newsArticlePath, newsMedia } from '../utils/newsContent';

/**
 * ============================================================================
 * WEBSITE CONTENT — the public CMS, read for "Explore ACTIV"
 * ============================================================================
 *
 * Read-only, public endpoints (all through the shared axios instance, so the
 * mandatory timeout applies):
 *
 *   GET /cms/site             data.header.navLinks [{ label, href }]
 *   GET /cms/regions/map      data.regions [{ slug, label, national, states [{ name, slug }] }]
 *   GET /cms/news             data [{ slug, title, summary, image.url, category,
 *                                     publishedAt, externalUrl, status }]
 *   GET /cms/gallery?limit=n  data [{ _id, slug, title, media { url, type } }]
 *   GET /cms/events?scope=public
 *                             data [{ id, slug, title, startAt, mode, category,
 *                                     imageUrl, media.url, status }]
 *   GET /cms/legal/links      data [{ label, href }]
 *
 * Every reader is null-safe, cached for ten minutes in memory, and on any
 * failure answers with a FIXED fallback (empty for the teasers, the website's
 * own menu for the navigation) — a dashboard section never throws.
 *
 * The api instance attaches the member's token. `/cms/news` treats any signed
 * in caller as an editor and would include drafts, so only `published` rows
 * are kept here; `/cms/events` is asked the visitor's question with
 * `scope=public` for the same reason.
 */

export interface SiteLink { label: string; path: string }
export interface Zone { slug: string; label: string; national: boolean; hasPage?: boolean; states: { name: string; slug: string }[] }
export interface NewsTeaser { key: string; title: string; summary: string; image: string; category: string; date: string; path: string; external: string }
export interface GalleryThumb { key: string; title: string; image: string; path: string }
export interface EventTeaser { id: string; endAt?: string; days?: { date?: string }[]; key: string; title: string; startAt: string; mode: string; category: string; place: string; image: string; path: string }

const TTL_MS = 10 * 60 * 1000;
const cache: Record<string, { at: number; value: any }> = {};

async function cached<T>(key: string, fallback: T, read: () => Promise<T>, force = false): Promise<T> {
  const hit = cache[key];
  if (!force && hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  try {
    const value = await read();
    cache[key] = { at: Date.now(), value };
    return value;
  } catch {
    // A stale answer beats the fallback when we have one.
    return hit ? (hit.value as T) : fallback;
  }
}

/** Drop every cached answer (pull-to-refresh on a dashboard). */
export const invalidateWebsiteContent = () => {
  Object.keys(cache).forEach((k) => { delete cache[k]; });
};

const payloadOf = (res: any) => res?.data?.data ?? res?.data ?? null;
const arr = (v: any): any[] => (Array.isArray(v) ? v : []);
const str = (v: any) => String(v ?? '').trim();

/** An internal website path, or '' for anything that is not one. */
const internalPath = (href: any): string => {
  const raw = str(href);
  if (!raw || raw === '#') return '';
  if (/^https?:\/\//i.test(raw)) {
    const m = /^https?:\/\/(?:www\.)?activ\.org\.in(\/[^#]*)?/i.exec(raw);
    return m ? (m[1] || '/') : '';
  }
  if (!raw.startsWith('/')) return '';
  // Sign-in and account pages belong to the app, not a browser tab.
  if (/^\/(login|register|admin|member|payment|forgot-password|reset-password|auth)\b/i.test(raw)) return '';
  return raw;
};

/* ------------------------------------------------------------------ nav */

/** The website's own menu, used whenever /cms/site cannot be read. */
export const FALLBACK_NAV: SiteLink[] = [
  { label: 'Home', path: WEBSITE_PATHS.home },
  { label: 'About', path: WEBSITE_PATHS.about },
  { label: 'Membership', path: WEBSITE_PATHS.membership },
  { label: 'Events', path: WEBSITE_PATHS.events },
  { label: 'News', path: WEBSITE_PATHS.news },
  { label: 'Schemes', path: WEBSITE_PATHS.schemes },
  { label: 'Gallery', path: WEBSITE_PATHS.gallery },
  { label: 'Contact Us', path: WEBSITE_PATHS.contact },
];

export const FALLBACK_LEGAL: SiteLink[] = [
  { label: 'Privacy Policy', path: WEBSITE_PATHS.privacy },
  { label: 'Terms & Conditions', path: WEBSITE_PATHS.terms },
  { label: 'Refund Policy', path: WEBSITE_PATHS.refund },
  { label: 'Cancellation', path: WEBSITE_PATHS.cancellation },
  { label: 'Delete account', path: WEBSITE_PATHS.deleteAccount },
];

const toLinks = (rows: any[]): SiteLink[] => {
  const seen = new Set<string>();
  const out: SiteLink[] = [];
  arr(rows).forEach((row) => {
    const path = internalPath(row?.href);
    const label = str(row?.label);
    if (!path || !label || seen.has(path)) return;
    seen.add(path);
    out.push({ label, path });
  });
  return out;
};

export const getSiteNav = (force = false) => cached<SiteLink[]>('nav', FALLBACK_NAV, async () => {
  const data = payloadOf(await api.get('/cms/site')) || {};
  const links = toLinks(data?.header?.navLinks);
  return links.length ? links : FALLBACK_NAV;
}, force);

export const getLegalLinks = (force = false) => cached<SiteLink[]>('legal', FALLBACK_LEGAL, async () => {
  const links = toLinks(payloadOf(await api.get('/cms/legal/links')));
  if (!links.length) return FALLBACK_LEGAL;
  // Account deletion is a public request form, not a CMS policy document.
  return links.some(link => link.path.replace(/\/+$/, '') === WEBSITE_PATHS.deleteAccount)
    ? links
    : [...links, { label: 'Delete account', path: WEBSITE_PATHS.deleteAccount }];
}, force);

/* ------------------------------------------------------------------ zones */

export const toExploreZones = (regions: any[]): Zone[] => publishedExploreZones(regions);
export const getZones = (force = false) => cached<Zone[]>('zones', [], async () =>
  toExploreZones((payloadOf(await api.get('/cms/regions/map')) || {}).regions), force);

/* ------------------------------------------------------------------ teasers */

const time = (iso: any) => {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isNaN(t) ? 0 : t;
};

export const toExploreNews = (rows: any[], count = 3): NewsTeaser[] => arr(rows)
    .filter((n) => str(n?.title) && (!n?.status || n?.status === 'published'))
    .sort((a, b) => time(b?.publishedAt || b?.createdAt) - time(a?.publishedAt || a?.createdAt))
    .slice(0, Math.max(1, count))
    .map((n, i) => {
      const slug = str(n?.slug);
      const external = /^https?:\/\//i.test(str(n?.externalUrl)) ? str(n?.externalUrl) : '';
      return {
        key: slug || str(n?.id) || String(i),
        title: str(n?.title),
        summary: str(n?.summary),
        image: newsMedia(n).find(media => media.type === 'image')?.url || '',
        category: str(n?.category),
        date: str(n?.displayDate) || str(n?.publishedAt),
        path: newsArticlePath(n) || WEBSITE_PATHS.news,
        external,
      };
    });
export const getLatestNews = (count = 3, force = false) => cached<NewsTeaser[]>(`news:${count}`, [], async () =>
  toExploreNews(payloadOf(await api.get('/cms/news')), count), force);

export const toExploreGallery = (rows: any[], count = 8): GalleryThumb[] => arr(rows)
    .filter((g) => g?.visible !== false && (!g?.status || g.status === 'published') && (g?.media?.type || 'image') === 'image' && str(g?.media?.url))
    .slice(0, Math.max(1, count))
    .map((g, i) => {
      const id = str(g?.slug) || str(g?._id) || str(g?.id);
      return {
        key: id || String(i),
        title: str(g?.title) || str(g?.caption),
        image: resolveMediaUrl(g?.media?.url),
        path: id ? WEBSITE_PATHS.galleryItem(id) : WEBSITE_PATHS.gallery,
      };
    });
export const getGalleryStrip = (count = 8, force = false) => cached<GalleryThumb[]>(`gallery:${count}`, [], async () =>
  toExploreGallery(payloadOf(await api.get('/cms/gallery', { params: { limit: count } })), count), force);

export const toExploreEvents = (rows: any[], count = 3): EventTeaser[] => {
  const now = Date.now();
  return arr(rows)
    .filter((e) => (!e?.status || e?.status === 'published') && e?.audience !== 'paid')
    // Upcoming or still running; undated events lead (not happened yet).
    .filter((e) => isUpcomingEvent(e, now))
    .sort((a, b) => (time(a?.startAt) || 0) - (time(b?.startAt) || 0))
    .slice(0, Math.max(1, count))
    .map((e, i) => {
      const id = str(e?.slug) || str(e?.id) || str(e?._id);
      return {
        id: str(e?.id) || str(e?._id),
        key: id || String(i),
        title: str(e?.title) || 'Untitled event',
        startAt: str(e?.startAt),
        endAt: str(e?.endAt),
        days: e?.days || [],
        mode: str(e?.mode),
        category: str(e?.category),
        place: [str(e?.venue), str(e?.district), str(e?.state)].filter(Boolean).join(', ') || str(e?.location),
        image: resolveMediaUrl(e?.imageUrl || e?.bannerUrl || e?.media?.url || ''),
        path: id ? WEBSITE_PATHS.event(id) : WEBSITE_PATHS.events,
      };
    });
};
export const getPublicEvents = async (count = 3, force = false) => (await cached<EventTeaser[]>(`events:${count}`, [], async () =>
  toExploreEvents(payloadOf(await api.get('/cms/events', { params: { scope: 'public' } })), count), force)).filter(e => isUpcomingEvent(e));
