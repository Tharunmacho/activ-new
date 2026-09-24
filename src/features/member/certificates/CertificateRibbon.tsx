import { useId } from 'react';
import { GOLD_LIGHT } from './CertificateMarks';

/**
 * ============================================================================
 * THE CORNER RIBBONS — the certificate's border, and the only one it has
 * ============================================================================
 *
 * WHAT THIS REPLACED, and why the replacement is not a smaller version of it.
 *
 * The first attempt at a border was a solid navy MAT: four bars round the paper
 * edge with a gold hairline and a bracket at each inner corner. It was a box.
 * The association's template has no box — its border is four flowing ribbons
 * that sweep in from the corners and bleed off two edges each, and the white in
 * the middle is left completely alone. A rectangle round a certificate frames
 * it; a ribbon through the corner gives it movement, and movement is the whole
 * difference between the two sheets side by side.
 *
 * -------------------------------------------------------------- the depth
 *
 * Each corner is THREE BANDS at different radii, and they are what make it read
 * as folded material rather than as three printed arcs:
 *
 *   - each band carries a GRADIENT across its width, light at the outer edge
 *     and deep at the inner one, so the curve has a lit side and a shaded one;
 *   - the bands are NOT CONCENTRIC. Their centres are offset a few units from
 *     each other, so the gaps between them open and close along the sweep the
 *     way real overlapping ribbon does. Perfectly concentric arcs read as a
 *     target;
 *   - the group takes a single `feDropShadow`, so the whole corner lifts off
 *     the paper as one object. A shadow per band shows three shadows;
 *   - a hairline of gold runs along the outer edge of the deepest shape — the
 *     specular edge, and the cheapest 3D trick there is.
 *
 * THE DEEPEST LAYER IS A FILLED QUARTER DISC and not a band, because a border
 * has to reach the edge it is a border of. As a band it left the 120 units
 * nearest the corner open, and the paper showed through as a white bite ringed
 * in navy.
 *
 * ONE SHADOW FILTER PER INSTANCE, keyed by `useId`. Four ribbons sharing a
 * filter id is three of them referencing the first one's definition — which
 * works until the first unmounts and then silently flattens the rest.
 *
 * -------------------------------------------------------------- on paper
 *
 * `feDropShadow` prints. The sheet sets `print-color-adjust: exact`, so Chrome
 * lays the shadow down rather than dropping it as decoration — which is what
 * happens to a CSS `box-shadow` on a print stylesheet that forgets it.
 */
/**
 * Where a ribbon sits, and how far it bleeds off the two edges it meets.
 *
 * `rotate` is about the element's own centre, which is what the shape expects:
 * it is drawn for the top-left corner and turned a quarter at a time.
 */
const CORNERS = {
    tl: { top: -12, left: -12, rotate: 0 },
    tr: { top: -12, right: -12, rotate: 90 },
    br: { bottom: -12, right: -12, rotate: 180 },
    bl: { bottom: -12, left: -12, rotate: 270 },
} as const;

export function CertificateRibbon({
    corner,
    size,
}: {
    corner: keyof typeof CORNERS;
    /**
     * The box, in pixels.
     *
     * The filled disc's radius is `size * 118/380` and the outermost band
     * reaches `size * 278/380`, so the box governs how far the sweep runs along
     * the two edges while the corner stays comparatively small. That ratio is
     * the whole reason the border could be enlarged without the navy reaching
     * further into the page — scale them together and the corner eats the
     * content long before the sweep looks like a frame.
     */
    size: number;
}) {
    const { rotate, ...offset } = CORNERS[corner];
    const uid = useId().replace(/:/g, '');
    const deep = `rb-deep-${uid}`;
    const mid = `rb-mid-${uid}`;
    const pale = `rb-pale-${uid}`;
    const shadow = `rb-shadow-${uid}`;

    /**
     * A quarter band anchored at the top-left corner of the box.
     *
     * `cx`/`cy` move the band's centre, which is what breaks the concentric
     * look: two bands sharing a centre are a target, two offset by six units
     * are ribbon.
     */
    const band = (r1: number, r2: number, cx = 0, cy = 0) =>
        `M${cx},${cy + r1} A${r1},${r1} 0 0 1 ${cx + r1},${cy} `
        + `L${cx + r2},${cy} A${r2},${r2} 0 0 0 ${cx},${cy + r2} Z`;

    return (
        <svg
            viewBox="0 0 380 380"
            aria-hidden="true"
            /*
             * INLINE, not utility classes. As `absolute -left-3 -top-3 h-52 w-52
             * rotate-90` this collapsed the moment the stylesheet was a build
             * behind: `absolute` resolved, the offsets and the size did not, and
             * all four ribbons landed in one corner at their natural size. A
             * border cannot depend on a class being present.
             */
            style={{
                position: 'absolute',
                width: size,
                height: size,
                transform: `rotate(${rotate}deg)`,
                pointerEvents: 'none',
                userSelect: 'none',
                ...offset,
            }}
        >
            <defs>
                {/* Each gradient runs ACROSS the sweep, not along it: the light
                    is coming from the top left of the sheet, so the outer edge
                    of every band is the lit one. */}
                <linearGradient id={deep} x1="0.05" y1="0" x2="0.85" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--brand-500))" />
                    <stop offset="32%" stopColor="hsl(var(--brand-700))" />
                    <stop offset="72%" stopColor="hsl(var(--brand-900))" />
                    <stop offset="100%" stopColor="#060F30" />
                </linearGradient>
                <linearGradient id={mid} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--brand-300))" />
                    <stop offset="100%" stopColor="hsl(var(--brand-500))" />
                </linearGradient>
                <linearGradient id={pale} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--brand-100))" />
                    <stop offset="100%" stopColor="hsl(var(--brand-200))" />
                </linearGradient>

                <filter id={shadow} x="-25%" y="-25%" width="160%" height="160%">
                    <feDropShadow dx="1.5" dy="3" stdDeviation="5"
                                  floodColor="#0A1738" floodOpacity="0.28" />
                </filter>
            </defs>

            {/* Palest and widest first, so the deep shape lies on top of them
                the way the outer fold of a ribbon lies under the inner one. */}
            <g filter={`url(#${shadow})`}>
                <path d={band(236, 278, 0, -12)} fill={`url(#${pale})`} opacity="0.7" />
                <path d={band(176, 218, -8, -5)} fill={`url(#${mid})`} opacity="0.62" />
                {/*
                  A FILLED QUARTER DISC, not a band.

                  It was `band(120, 262)` — an arc with its inner 120 units left
                  open, so the corner of the paper showed through as a white
                  bite ringed in navy. A border has to reach the edge it is a
                  border of.
                */}
                <path d="M0 0 L0 118 A118 118 0 0 0 118 0 Z" fill={`url(#${deep})`} />
            </g>

            {/* The specular edge — a hairline of gold light along the OUTER
                curve of the deep shape, which is the edge the eye reads.
                Without it the corner is a flat silhouette however good the
                gradient underneath is. */}
            <path
                d="M0 118 A118 118 0 0 0 118 0"
                fill="none"
                stroke={GOLD_LIGHT}
                strokeWidth="3"
                opacity="0.85"
            />
        </svg>
    );
}

export default CertificateRibbon;
