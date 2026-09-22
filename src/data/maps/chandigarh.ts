/**
 * Chandigarh's districts, as SVG paths. GENERATED — do not edit by hand.
 *
 *   node scripts/build-state-map.mjs <dists11.geojson> "Chandigarh"
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
    label: "Chandigarh",
    slug: "chandigarh",
    viewBox: '0 0 500 520',
    zones: [],
    districts: [
        {
            "name": "Chandigarh",
            "slug": "chandigarh",
            "d": "M462.3 166.9L446.9 229.4L490.8 258.2L500.4 328.3L431.3 408.9L433.2 464.6L362 520L321.1 519.2L297 486.4L250.6 507.7L206.6 442.6L166.3 450.2L146.7 405.4L119.3 416.2L118.6 363.7L86.8 359.4L85.2 291.6L0 212.6L19.5 139.2L134.8 103.1L162.6 44.6L231.8 0L271.2 24.5L287 66.1L260 71.2L273.6 100.2L325.6 98L378.6 61.2L394.7 97.2L350.2 122.9L385.9 172.8L423.5 129.7L462.3 166.9Z",
            "cx": 281.4,
            "cy": 249.4
        }
    ],
};

export default map;
