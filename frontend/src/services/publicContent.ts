import visitorApi from './publicApi';
import { isUpcomingEvent } from '../utils/eventLifecycle';
import { withEventAgenda } from '../utils/eventAgenda';
import { publishedExploreZones } from '../utils/exploreRegions';

// Public browsing never reads a saved token or calls a member/admin endpoint.
export type ExploreSection = 'home' | 'events' | 'news' | 'gallery' | 'zones';
export type ExploreContent = { events: any[]; news: any[]; gallery: any[]; zones: any[] };
const rows = (value: any): any[] => Array.isArray(value) ? value : [];
export async function readPublicCms(path: string, signal?: AbortSignal, params?: Record<string, any>) {
  const response = await visitorApi.get(path, { signal, params: { scope: 'public', ...params } });
  return response.data?.data ?? response.data;
}
const read = readPublicCms;
export async function submitPublicCms(path: '/cms/contact-messages' | '/cms/leader-messages', data: any) {
  const response = await visitorApi.post(path, data);
  return response.data?.data ?? response.data;
}
export async function loadExploreContent(section: ExploreSection, signal?: AbortSignal): Promise<ExploreContent> {
  const result: ExploreContent = { events: [], news: [], gallery: [], zones: [] };
  const jobs: Promise<void>[] = [];
  if (section === 'home' || section === 'events') jobs.push(read('/cms/events', signal, { period: 'upcoming' }).then(data => { result.events = rows(data).filter(e => isUpcomingEvent(e) && !e.deletedAt && (!e.status || e.status === 'published')); }));
  if (section === 'home' || section === 'news') jobs.push(read('/cms/news', signal).then(data => { result.news = rows(data).filter(n => !n.status || n.status === 'published'); }));
  if (section === 'home' || section === 'gallery') jobs.push(read('/cms/gallery', signal, { limit: section === 'home' ? 6 : 60 }).then(data => { result.gallery = rows(data).filter(g => g.visible !== false && (!g.status || g.status === 'published')); }));
  if (section === 'home' || section === 'zones') jobs.push(read('/cms/regions/map', signal).then(data => { result.zones = publishedExploreZones(data?.regions); }));
  await Promise.all(jobs);
  return result;
}
export const getPublicEvent = async (slug: string) => {
  const event = await read('/cms/events/' + encodeURIComponent(slug));
  return event && isUpcomingEvent(event) && !event.deletedAt && event.audience !== 'paid'
    && (!event.status || event.status === 'published') ? event : null;
};
/** Native guest details use only anonymous public reads, including live seat availability. */
export const getPublicEventDetail = async (key: string) => {
  const event = await getPublicEvent(key);
  const id = String(event?.id || event?._id || '');
  if (!event || !id) return null;
  const availability = event.registrationEnabled
    ? await read('/event-bookings/event/' + encodeURIComponent(id)).catch(() => null) : null;
  return withEventAgenda({
    ...event, id, myRegistration: null, publicAvailability: availability,
    bannerUrl: event.bannerUrl || event.imageUrl || event.media?.url || '',
    bannerAlt: event.bannerAlt || event.media?.alt || '',
    venue: event.venue || event.location || '',
    yourPrice: availability?.amount ?? event.registrationFee ?? 0,
  });
};
export const getPublicContactInfo = (signal?: AbortSignal) => read('/cms/contact-info', signal);
export const getPublicNewsArticle = async (slug: string, signal?: AbortSignal) => {
  const article = await read('/cms/news/' + encodeURIComponent(slug), signal);
  return article && (!article.status || article.status === 'published') ? article : null;
};
