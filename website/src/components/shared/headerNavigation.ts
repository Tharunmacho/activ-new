import type { CmsLink } from '@/services/cmsApi';

/** A stored position for the automatic zone menu; its children still come from the region map. */
export const ZONES_NAV_HREF = '/regions';
export const isZonesNavLink = (href?: string) => String(href || '').trim().replace(/\/+$/, '') === ZONES_NAV_HREF;

/** Older site settings did not store Zones, which was appended by the header. */
export function headerNavigationLinks(links: CmsLink[] = [], includeEmpty = false): CmsLink[] {
    if (!links.length && !includeEmpty) return [];
    let found = false;
    const result = links.filter(link => {
        if (!isZonesNavLink(link.href)) return true;
        if (found) return false;
        found = true;
        return true;
    }).map(link => isZonesNavLink(link.href)
        ? { ...link, label: String(link.label || '').trim() || 'Zones', href: ZONES_NAV_HREF }
        : link);
    return found ? result : [...result, { label: 'Zones', href: ZONES_NAV_HREF }];
}
