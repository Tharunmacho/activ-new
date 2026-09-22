/**
 * Dadra and Nagar Haveli and Daman and Diu's districts, as SVG paths. GENERATED — do not edit by hand.
 *
 *   node scripts/build-state-map.mjs <dists11.geojson> "Dadra and Nagar Haveli and Daman and Diu"
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
    label: "Dadra and Nagar Haveli and Daman and Diu",
    slug: "dadra-and-nagar-haveli-and-daman-and-diu",
    viewBox: '0 0 520 165',
    zones: [],
    districts: [
        {
            "name": "Dadra and Nagar Haveli",
            "slug": "dadra-and-nagar-haveli",
            "d": "M463.3 126L463.3 132.3L466.6 133.4L466.1 137.8L463.2 143.3L463.7 145.9L466.7 149L469.9 147.8L471.2 141.9L474.2 143.8L474.6 145.2L471.7 146.6L471.9 149.1L480.7 160L483 160.6L484 152.1L485.9 152.1L490.3 154.1L494.4 154.1L495.3 158.1L496.6 158.8L502 155.2L502.1 157L506 157.8L508.3 162.6L511.2 164.5L514.1 163.9L513.5 157.2L515.4 157.7L518.2 155.6L519.2 147.5L513.2 145.1L512.8 138.8L513.8 136.8L517.3 136.9L519.2 135.1L520 131.7L514.2 129L511.2 130.1L509 126.4L506.6 128.8L502.2 126.6L501.1 130.3L503.2 133.7L501.9 135.5L500.2 134.7L498.2 135.9L497.4 139.7L491.8 137.8L491 135.4L489.3 134.7L488.1 138.9L485.1 137.4L484.9 129.8L482.6 128.2L485.9 121.8L487.4 120.8L493.4 121.5L493.3 119.2L495.5 116.4L499.7 114L500.8 110.7L502.8 110.9L504.1 107.4L505.4 106.6L506.8 109.2L508.6 107.6L508.5 102.3L507.1 102.7L505.2 100.4L500.4 100.4L499.9 103.4L494.5 104.3L496.4 95.8L493 90.2L491.5 90.9L491.8 94.4L488.9 99.2L486.5 97.6L481 98.6L479.4 106.7L475.2 106.2L475.5 102.3L473.1 101.7L474 106.8L467.6 107.3L467.8 110.5L465.4 112.1L458 106.1L452.3 110.6L456.4 117.9L461.6 119.3L464 122.1L463.3 126Z",
            "cx": 490.7,
            "cy": 128.6
        },
        {
            "name": "Daman",
            "slug": "daman",
            "d": "M432.7 88.9L428.6 86.8L430.4 83.4L431.9 73.1L437.7 62.7L440.7 65.8L446.6 66.4L448.6 70.6L446.9 72.1L444 70.3L440.1 76.6L443.3 77.8L448.1 76L450.5 77.6L450.2 79.7L445.8 81.6L448.7 86.1L444.5 88.2L437.2 87L432.7 88.9Z",
            "cx": 441.5,
            "cy": 78
        },
        {
            "name": "Diu",
            "slug": "diu",
            "d": "M29.8 0.9L27.2 3.6L28.2 6.5L24.1 8.8L18.3 9.3L12.7 7.3L10.8 7.7L9.4 10.3L6.3 10.3L3.7 8L0 8.4L1.6 3.4L10.8 0L15 2.5L19.7 1.5L24.3 4.8L25 2.9L29.8 0.9Z",
            "cx": 16.5,
            "cy": 5.4
        }
    ],
};

export default map;
