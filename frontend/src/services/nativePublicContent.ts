import { readPublicCms } from './publicContent';
import { publicWebsitePath } from '../utils/publicBrowse';
import { publishedExploreZones } from '../utils/exploreRegions';

export type PublicPageData = { kind: string; title: string; item?: any; items?: any[]; page?: any; section?: string; scope?: string; photo?: number; total?: number };
const published = (value: any) => value && typeof value === 'object' && !Array.isArray(value) && value.visible !== false && !value.isHidden && (!value.status || value.status === 'published') ? value : null;
const rows = (value: any) => Array.isArray(value) ? value.filter(row => published(row)) : [];
const stateName = (slug: string) => slug.split('-').map(word => word[0]?.toUpperCase() + word.slice(1)).join(' ');
export const REGION_SECTIONS: Record<string, string> = {
  about: 'About', gallery: 'Photo gallery', leaders: 'Leadership', achievements: 'Highlights', keyAchievements: 'Key achievements', events: 'Events', projects: 'Projects',
  policyAdvocacy: 'Policy advocacy', consultingServices: 'Consulting services', publications: 'Publications', mediaReleases: 'Media releases', mediaCoverages: 'Media coverage', sectorUpdates: 'Sector updates', newsUpdates: 'News updates', speakInMedia: 'In the media',
};

export async function loadNativePublicPage(value: string, signal: AbortSignal, offset = 0): Promise<PublicPageData | null> {
  const path = publicWebsitePath(value);
  if (!path) return null;
  const read = (endpoint: string, params?: any) => readPublicCms(endpoint, signal, params);
  if (path === '/gallery' || path === '/news') {
    const kind = path.slice(1);
    return { kind, title: kind === 'news' ? 'ACTIV News' : 'Community gallery', items: rows(await read('/cms/' + kind)) };
  }
  const gallery = /^\/gallery\/([^/]+)(?:\/photo\/(\d+))?$/.exec(path);
  if (gallery) {
    const item = published(await read('/cms/gallery/' + encodeURIComponent(gallery[1])));
    if (!item) return null;
    const photo = gallery[2] === undefined ? undefined : Number(gallery[2]);
    return { kind: 'album', title: item.title || item.caption || 'Community album', item, photo };
  }
  const article = /^\/news\/([^/]+)$/.exec(path);
  if (article) {
    const item = published(await read('/cms/news/' + encodeURIComponent(article[1])));
    return item ? { kind: 'article', title: item.title || 'ACTIV News', item } : null;
  }
  if (['/zones', '/regions', '/states'].includes(path)) return { kind: 'zones', title: 'Zones & states', items: publishedExploreZones((await read('/cms/regions/map'))?.regions) };
  const scheme = /^\/schemes\/view\/([^/]+)$/.exec(path);
  if (scheme) {
    const item = published(await read('/cms/schemes/' + encodeURIComponent(scheme[1])));
    return item ? { kind: 'scheme', title: item.title || 'Scheme details', item } : null;
  }
  if (['/schemes/state', '/schemes/states'].includes(path)) {
    const items = await read('/cms/schemes/states');
    return { kind: 'schemeStates', title: 'State schemes', items: rows(items).filter(row => row.state && Number(row.total) > 0) };
  }
  const state = /^\/schemes\/states?\/([^/]+)$/.exec(path);
  if (path === '/schemes' || path === '/schemes/central' || state) {
    let name = '';
    if (state) {
      const map = await read('/cms/regions/map');
      name = rows(map?.regions).flatMap((region: any) => rows(region.states)).find((row: any) => row.slug === state[1])?.name || stateName(state[1]);
    }
    return { kind: 'schemes', title: name ? name + ' schemes' : 'Central schemes', items: rows(await read('/cms/schemes', name ? { state: name } : { tier: 'national' })) };
  }
  const region = /^\/(regions|states)\/([^/]+)(?:\/([^/]+))?$/.exec(path);
  if (region) {
    const page = published(await read(`/cms/${region[1]}/${encodeURIComponent(region[2])}`));
    if (!page) return null;
    const section = region[3];
    let items: any[] = [];
    let total = 0;
    if (section === 'gallery') {
      const photos = await read('/cms/regions/gallery', { ...(region[1] === 'states' ? { state: page.stateName } : { region: page.regionKey }), limit: 24, offset });
      items = rows(photos?.items); total = Number(photos?.total || items.length);
    }
    return { kind: 'region', title: page.stateName || page.regionName || stateName(region[2]), page, section, scope: region[1], items, total };
  }
  return null;
}
