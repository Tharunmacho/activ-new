/**
 * The shape of a generated state map, and the four zones every state is cut
 * into.
 *
 * Hand-written; everything beside it in this folder is generated. The palette
 * lives here rather than in the generator because a colour is a design decision
 * and a boundary is not — re-skinning the maps should never mean re-running a
 * script over 28MB of GeoJSON.
 */

export type ZoneKey = 'north' | 'east' | 'south' | 'west';

export interface DistrictShape {
    /** The census spelling — matched against the CMS's district names. */
    name: string;
    slug: string;
    /** The `d` of one `<path>`, every ring of the district in one string. */
    d: string;
    /** A point inside the district, for its marker. */
    cx: number;
    cy: number;
    /** Absent on a state too small to be worth cutting into four. */
    zone?: ZoneKey;
}

export interface StateMap {
    label: string;
    slug: string;
    viewBox: string;
    /** In drawing order; empty when the state is not zoned. */
    zones: ZoneKey[];
    districts: DistrictShape[];
}

/**
 * FOUR HUES THAT READ AS FOUR GROUPS AND STILL SIT INSIDE THE SITE'S NAVY.
 *
 * The reference the association supplied uses saturated purple, blue, green and
 * orange on a sand background, which would fight everything else on these
 * pages. These are the same four families pulled toward the page's own
 * light-blue ground.
 *
 * `active` is one step deeper than `hover` so that a click reads as a different
 * thing from a pointer passing over.
 */
export interface ZoneStyle {
    label: string;
    fill: string;
    hover: string;
    active: string;
    swatch: string;
}

export const ZONE_STYLES: Record<ZoneKey, ZoneStyle> = {
    north: {
        label: 'North',
        fill: 'fill-violet-300',
        hover: 'hover:fill-violet-400',
        active: 'fill-violet-500',
        swatch: 'bg-violet-400',
    },
    west: {
        label: 'West',
        fill: 'fill-sky-300',
        hover: 'hover:fill-sky-400',
        active: 'fill-sky-500',
        swatch: 'bg-sky-400',
    },
    east: {
        label: 'East',
        fill: 'fill-emerald-300',
        hover: 'hover:fill-emerald-400',
        active: 'fill-emerald-500',
        swatch: 'bg-emerald-400',
    },
    south: {
        label: 'South',
        fill: 'fill-amber-300',
        hover: 'hover:fill-amber-400',
        active: 'fill-amber-500',
        swatch: 'bg-amber-400',
    },
};

/* ------------------------------------------------------------------ regions */

/** One member state of a region, as one shape on the region's map. */
export interface RegionStateShape {
    name: string;
    slug: string;
    /** Every district of the state, as subpaths of one `d`. */
    d: string;
    cx: number;
    cy: number;
    districts: number;
}

export interface RegionMapData {
    key: string;
    label: string;
    viewBox: string;
    states: RegionStateShape[];
}

/**
 * A COLOUR PER STATE, cycled.
 *
 * A region has as many states as it has — ten in the North, eight in the South
 * and the North East, four in the East — and four zone hues will not tell ten
 * apart. These are the four zone families plus eight more, ordered so that two
 * of the same family are never adjacent in the list; since the generator emits
 * member states in the association's own order, adjacent entries are usually
 * adjacent on the map too.
 *
 * TWELVE, because the largest region has ten and a region gaining a state
 * should not immediately start repeating. Cycled rather than exhaustive all the
 * same: a thirteenth state repeats a colour, which is a legible map with two
 * similar blues in it — not a crash, and not a state drawn in `undefined`.
 */
export const STATE_PALETTE = [
    { fill: 'fill-violet-300', hover: 'hover:fill-violet-400', active: 'fill-violet-500', swatch: 'bg-violet-400' },
    { fill: 'fill-amber-300', hover: 'hover:fill-amber-400', active: 'fill-amber-500', swatch: 'bg-amber-400' },
    { fill: 'fill-sky-300', hover: 'hover:fill-sky-400', active: 'fill-sky-500', swatch: 'bg-sky-400' },
    { fill: 'fill-emerald-300', hover: 'hover:fill-emerald-400', active: 'fill-emerald-500', swatch: 'bg-emerald-400' },
    { fill: 'fill-rose-300', hover: 'hover:fill-rose-400', active: 'fill-rose-500', swatch: 'bg-rose-400' },
    { fill: 'fill-teal-300', hover: 'hover:fill-teal-400', active: 'fill-teal-500', swatch: 'bg-teal-400' },
    { fill: 'fill-indigo-300', hover: 'hover:fill-indigo-400', active: 'fill-indigo-500', swatch: 'bg-indigo-400' },
    { fill: 'fill-orange-300', hover: 'hover:fill-orange-400', active: 'fill-orange-500', swatch: 'bg-orange-400' },
    { fill: 'fill-cyan-300', hover: 'hover:fill-cyan-400', active: 'fill-cyan-500', swatch: 'bg-cyan-400' },
    { fill: 'fill-fuchsia-300', hover: 'hover:fill-fuchsia-400', active: 'fill-fuchsia-500', swatch: 'bg-fuchsia-400' },
    { fill: 'fill-lime-300', hover: 'hover:fill-lime-400', active: 'fill-lime-500', swatch: 'bg-lime-400' },
    { fill: 'fill-pink-300', hover: 'hover:fill-pink-400', active: 'fill-pink-500', swatch: 'bg-pink-400' },
];
