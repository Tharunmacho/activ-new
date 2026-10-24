export type RegionScope = 'national' | 'region' | 'state';
export type RegionLeaderContext = { tier: RegionScope | 'district'; region: string; state: string; district: string };

export const visibleRegionItems = (value: any): any[] => (Array.isArray(value) ? value : [])
  .filter(item => item && typeof item === 'object' && !item.isHidden && item.visible !== false && (!item.status || item.status === 'published'));

export const regionScope = (record: any, scope?: string): RegionScope => scope === 'states' ? 'state'
  : (record.regionKey || record.slug) === 'national' ? 'national' : 'region';

export const zoneTitle = (name: string) => /\b(region|zone)\b/i.test(name || '') ? name : `${name || ''} Zone`.trim();

export const regionTitle = (record: any, scope: RegionScope) => scope === 'state' ? record.stateName || 'State'
  : scope === 'national' ? record.regionName || 'National' : zoneTitle(record.regionName || record.regionKey || record.slug);

export function regionLabels(record: any, scope: RegionScope) {
  const labels = {
    ownTierEyebrow: scope === 'state' ? 'State' : scope === 'national' ? 'National' : 'Zone',
    tierBelowEyebrow: scope === 'state' ? 'Regions' : scope === 'national' ? 'Zones' : 'States',
    tierBelowHeading: scope === 'state' ? 'Region-wise Leadership' : scope === 'national' ? 'Zone-wise Leadership' : 'State-wise Leadership',
    districtsEyebrow: 'Districts', districtsHeading: 'District-wise Leadership',
    contactEyebrow: 'Contact', contactHeading: 'Get in Touch',
  };
  (Object.keys(labels) as (keyof typeof labels)[]).forEach(key => {
    const authored = String(record.labels?.[key] || '').trim();
    if (authored) labels[key] = authored;
  });
  return labels;
}

/** Match the website: published child pages lead and replace stale manually
 * entered copies, while other authored boards keep their stored order. */
export function regionPanels(record: any, scope: RegionScope): any[] {
  const own = visibleRegionItems(record.stateRegions).filter(row => row.name);
  if (scope === 'state') return own;
  const tierName = (name: string) => scope === 'national' ? zoneTitle(name) : name;
  const normal = (name: string) => (scope === 'national' ? name.replace(/\b(region|zone)\b/gi, '') : name)
    .replace(/[^a-z0-9]+/gi, '').toLowerCase();
  const derived = visibleRegionItems(record.statePanels).filter(row => row.name && row.hasPage !== false);
  const havePage = new Set(derived.map(row => normal(row.name)));
  return [...derived, ...own.filter(row => !havePage.has(normal(row.name)))]
    .map(row => ({ ...row, name: tierName(row.name) }));
}

export function regionLeaderContext(record: any, scope: RegionScope, board?: any, district = false): RegionLeaderContext {
  const context: RegionLeaderContext = { tier: scope, region: scope === 'region' ? regionTitle(record, scope) : '', state: scope === 'state' ? record.stateName || '' : '', district: '' };
  if (!board) return context;
  if (district) return { ...context, tier: 'district', district: board.name || '' };
  if (scope === 'national') return { ...context, tier: 'region', region: zoneTitle(board.name) };
  if (scope === 'state') return { ...context, tier: 'region', region: board.name || '' };
  return { ...context, tier: 'state', state: board.name || '' };
}

/** CMS contacts may be published before their telephone number is supplied. */
export const hasRegionContact = (contact: any) => !!contact && [contact.name, contact.personName, contact.designation,
  contact.organisation, contact.email, contact.phone, contact.address, ...(Array.isArray(contact.addressLines) ? contact.addressLines : []), contact.mapUrl]
  .some(value => String(value || '').trim());

export function regionContacts(record: any): any[] {
  return visibleRegionItems([record.contact, ...visibleRegionItems(record.contacts)]).filter(hasRegionContact);
}
