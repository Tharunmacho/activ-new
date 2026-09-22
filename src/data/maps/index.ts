/**
 * Every state map the site can draw. GENERATED — do not edit by hand.
 *
 *   node scripts/build-state-map.mjs <dists11.geojson>
 *
 * Keyed by the state's slug, which is the slug the CMS and the URL use. A state
 * that is not here simply has no map, and the page draws the rest of itself —
 * see `StateDistrictMap`.
 *
 * Dynamic imports on purpose: one reader opens one state, and eight states of
 * boundaries in the main bundle is seven maps nobody asked for on every page of
 * the site.
 */
import type { StateMap, RegionMapData } from './types';

export type { StateMap, RegionMapData, DistrictShape, ZoneKey } from './types';

export const stateMaps: Record<string, () => Promise<{ default: StateMap }>> = {
    "tamil-nadu": () => import('./tamil-nadu'),
    "andhra-pradesh": () => import('./andhra-pradesh'),
    "telangana": () => import('./telangana'),
    "karnataka": () => import('./karnataka'),
    "kerala": () => import('./kerala'),
    "puducherry": () => import('./puducherry'),
    "lakshadweep": () => import('./lakshadweep'),
    "andaman-and-nicobar-islands": () => import('./andaman-and-nicobar-islands'),
    "delhi": () => import('./delhi'),
    "haryana": () => import('./haryana'),
    "punjab": () => import('./punjab'),
    "rajasthan": () => import('./rajasthan'),
    "uttar-pradesh": () => import('./uttar-pradesh'),
    "uttarakhand": () => import('./uttarakhand'),
    "himachal-pradesh": () => import('./himachal-pradesh'),
    "jammu-and-kashmir": () => import('./jammu-and-kashmir'),
    "ladakh": () => import('./ladakh'),
    "chandigarh": () => import('./chandigarh'),
    "bihar": () => import('./bihar'),
    "jharkhand": () => import('./jharkhand'),
    "odisha": () => import('./odisha'),
    "west-bengal": () => import('./west-bengal'),
    "goa": () => import('./goa'),
    "gujarat": () => import('./gujarat'),
    "maharashtra": () => import('./maharashtra'),
    "madhya-pradesh": () => import('./madhya-pradesh'),
    "chhattisgarh": () => import('./chhattisgarh'),
    "dadra-and-nagar-haveli-and-daman-and-diu": () => import('./dadra-and-nagar-haveli-and-daman-and-diu'),
    "assam": () => import('./assam'),
    "arunachal-pradesh": () => import('./arunachal-pradesh'),
    "manipur": () => import('./manipur'),
    "meghalaya": () => import('./meghalaya'),
    "mizoram": () => import('./mizoram'),
    "nagaland": () => import('./nagaland'),
    "sikkim": () => import('./sikkim'),
    "tripura": () => import('./tripura'),
};

export const regionMaps: Record<string, () => Promise<{ default: RegionMapData }>> = {
    "national": () => import('./region-national'),
    "south": () => import('./region-south'),
    "north": () => import('./region-north'),
    "east": () => import('./region-east'),
    "west": () => import('./region-west'),
    "north-east": () => import('./region-north-east'),
};

export const hasStateMap = (slug: string) => !!stateMaps[String(slug || '').toLowerCase()];
