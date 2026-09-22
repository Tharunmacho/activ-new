/**
 * Lakshadweep's districts, as SVG paths. GENERATED — do not edit by hand.
 *
 *   node scripts/build-state-map.mjs <dists11.geojson> "Lakshadweep"
 *
 * Boundaries: Census of India 2011, via datameet/maps (MIT licence).
 * https://github.com/datameet/maps
 *
 * Projected equirectangular with the longitude scaled by cos(mean latitude),
 * simplified to 0.004° (~400m, under half a pixel at the size this is
 * drawn), islands under 0.0009 square degrees dropped. Zones are worked out
 * from each district's position; see the script for both.
 */
import type { StateMap } from './types';

const map: StateMap = {
    label: "Lakshadweep",
    slug: "lakshadweep",
    viewBox: '0 0 520 174',
    zones: [],
    districts: [
        {
            "name": "Lakshadweep",
            "slug": "lakshadweep",
            "d": "M108.5 0L23.4 8.3L0 70.6L52.9 154.5L226.8 173.6L514.2 75.9L520 16.4L108.5 0Z",
            "cx": 194.3,
            "cy": 62.4
        }
    ],
};

export default map;
