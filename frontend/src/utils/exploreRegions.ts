export type ExploreState = { slug: string; name: string };
export type ExploreZone = { slug: string; label: string; national: boolean; hasPage: boolean; states: ExploreState[] };

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const visible = (item: any) => !!item && typeof item === 'object' && item.visible !== false && item.isHidden !== true;
export const hasPublishedPage = (item: any) => visible(item) && item.hasPage !== false
  && (!item.status || item.status === 'published');

/** The public CMS map is the authority for both membership of a zone and
 * published destinations. A state can be published before its zone overview. */
export function publishedExploreZones(input: unknown): ExploreZone[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  return input.filter(visible).sort((left, right) => Number(left.order || 0) - Number(right.order || 0)).map(zone => {
    const stateSlugs = new Set<string>();
    const states = (Array.isArray(zone.states) ? zone.states : []).filter(hasPublishedPage)
      .map((state: any) => ({ slug: text(state.slug), name: text(state.name) }))
      .filter((state: ExploreState) => {
        if (!state.slug || !state.name || stateSlugs.has(state.slug)) return false;
        stateSlugs.add(state.slug); return true;
      });
    const slug = text(zone.slug) || text(zone.key);
    return { ...zone, slug, label: text(zone.label) || text(zone.name) || slug,
      national: zone.national === true || slug === 'national', hasPage: hasPublishedPage(zone), states };
  }).filter(zone => {
    if (!zone.slug || seen.has(zone.slug) || (!zone.hasPage && !zone.states.length)) return false;
    seen.add(zone.slug); return true;
  });
}

export function exploreStateChoices(zones: ExploreZone[], zoneSlug = ''): (ExploreState & { zoneSlug: string; zoneLabel: string })[] {
  const seen = new Set<string>();
  return zones.filter(zone => !zone.national && (!zoneSlug || zone.slug === zoneSlug))
    .flatMap(zone => zone.states.map(state => ({ ...state, zoneSlug: zone.slug, zoneLabel: zone.label })))
    .filter(state => {
      if (seen.has(state.slug)) return false;
      seen.add(state.slug); return true;
    }).sort((left, right) => left.name.localeCompare(right.name));
}
