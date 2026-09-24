import { useId, useMemo } from 'react';
import { GOLD, GOLD_LIGHT, GOLD_PALE, GOLD_DEEP } from './CertificateMedallion';

/**
 * ============================================================================
 * THE ROSETTE — the seal on the association's own template
 * ============================================================================
 *
 * A navy disc inside a gold starburst, with laurel up both sides, the mark
 * reversed out at the top, a gold banner across the middle, three stars under
 * it, and two ribbon tails hanging below.
 *
 * ------------------------------------------------ what this replaced, and why
 *
 * `CertificateMedallion` — a struck medal with the association's full name and
 * its motto set round a navy BAND. That seal is correct and it is still on the
 * tax certificate, but it was designed to be read: two rings of type at 9px,
 * which want 168px of sheet to be legible at all.
 *
 * The template's seal is not read, it is RECOGNISED. It carries the mark, a
 * banner of two words and nothing else, so it works at 150px where the
 * medallion turns to noise — and it hangs at the top right of the sheet rather
 * than sitting in the foot row, which is where the association put it.
 *
 * ------------------------------------------------------------ the geometry
 *
 *     ribbon tails    behind everything, from y=196 down
 *     starburst       32 points, r 96 -> 112
 *     the disc        r 96
 *     the gold ring   r 86
 *     the laurel      r 70, seven leaves a side, upper half only
 *     the mark        y 52 -> 96, reversed out
 *     the banner      y 124 -> 154
 *     three stars     y 176
 *
 * The banner is the only thing here with a variable width, so it is the only
 * thing that can collide. Its type steps down when `line` runs long.
 *
 * `useId` for every gradient. Two rosettes on one page sharing an id makes the
 * second reference the first one's definition, which is invisible until two
 * certificates render side by side and then baffling.
 */
export function CertificateRosette({
    line,
    navy,
    deep,
    className,
    style,
}: {
    /** The banner across the middle — "Member", "80G Approved". */
    line: string;
    navy: string;
    deep: string;
    className?: string;
    style?: React.CSSProperties;
}) {
    const uid = useId().replace(/:/g, '');
    const gGold = `rs-gold-${uid}`;
    const gFace = `rs-face-${uid}`;
    const gBand = `rs-band-${uid}`;

    /**
     * THE STARBURST, COMPUTED.
     *
     * Thirty-two points at two alternating radii. It is a loop because it IS a
     * loop — sixty-four coordinates placed by hand is sixty-four chances to put
     * one at the wrong angle, and the one that is wrong is the only one anybody
     * sees.
     */
    const burst = useMemo(() => {
        const teeth = 32;
        const pts: string[] = [];
        for (let i = 0; i < teeth * 2; i += 1) {
            const r = i % 2 === 0 ? 112 : 97;
            const a = (Math.PI * i) / teeth;
            pts.push(`${(120 + r * Math.cos(a)).toFixed(2)},${(120 + r * Math.sin(a)).toFixed(2)}`);
        }
        return pts.join(' ');
    }, []);

    /** Seven leaves up each side, on the tangent of their branch. */
    const leaves = useMemo(() => {
        const out: { x: number; y: number; rot: number }[] = [];
        for (const side of [-1, 1]) {
            for (let i = 0; i < 7; i += 1) {
                const deg = side < 0 ? 196 - i * 13 : -16 + i * 13;
                const a = (deg * Math.PI) / 180;
                out.push({
                    x: 120 + 70 * Math.cos(a),
                    y: 122 - 70 * Math.sin(a),
                    /* In SVG, where rotation is clockwise and y runs down, a
                       math-convention tangent at `deg + 90` is a rotation of
                       `-(deg + 90)`. Set to `deg` the spray fans like cards. */
                    rot: -(deg + 90),
                });
            }
        }
        return out;
    }, []);

    return (
        <svg
            viewBox="0 0 240 300"
            className={className}
            style={style}
            role="img"
            aria-label={`Seal of the association — ${line}`}
        >
            <defs>
                <linearGradient id={gGold} x1="0.1" y1="0" x2="0.9" y2="1">
                    <stop offset="0%" stopColor="#F8E4A6" />
                    <stop offset="34%" stopColor={GOLD_LIGHT} />
                    <stop offset="64%" stopColor={GOLD} />
                    <stop offset="100%" stopColor={GOLD_DEEP} />
                </linearGradient>
                <radialGradient id={gFace} cx="0.36" cy="0.3" r="0.8">
                    <stop offset="0%" stopColor={navy} />
                    <stop offset="62%" stopColor={deep} />
                    <stop offset="100%" stopColor="#050C24" />
                </radialGradient>
                <linearGradient id={gBand} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GOLD_PALE} />
                    <stop offset="55%" stopColor={GOLD} />
                    <stop offset="100%" stopColor={GOLD_DEEP} />
                </linearGradient>
            </defs>

            {/*
              THE TAILS, BEHIND EVERYTHING.

              Drawn first so the disc covers where they begin — a tail that
              starts outside the seal reads as a pennant parked next to it. The
              left one is a shade darker: a ribbon is two lengths of cloth, and
              one flat silhouette is a cut-out.
            */}
            <path d="M84 190 L44 292 L86 276 L104 296 L132 196 Z" fill={deep} />
            <path d="M156 190 L196 292 L154 276 L136 296 L108 196 Z" fill={navy} />
            <path d="M84 190 L44 292 L86 276 L104 296 L132 196 Z" fill="none"
                  stroke={GOLD} strokeWidth="1.6" opacity="0.8" />
            <path d="M156 190 L196 292 L154 276 L136 296 L108 196 Z" fill="none"
                  stroke={GOLD} strokeWidth="1.6" opacity="0.8" />

            <polygon points={burst} fill={`url(#${gGold})`} />
            <circle cx="120" cy="120" r="97" fill={`url(#${gGold})`} />
            <circle cx="120" cy="120" r="90" fill={`url(#${gFace})`} />
            <circle cx="120" cy="120" r="82" fill="none" stroke={GOLD} strokeWidth="1.6" />

            {/* The laurel. */}
            {leaves.map((leaf, i) => (
                <ellipse
                    key={i}
                    cx={leaf.x}
                    cy={leaf.y}
                    rx="11"
                    ry="4.6"
                    fill={`url(#${gGold})`}
                    transform={`rotate(${leaf.rot} ${leaf.x} ${leaf.y})`}
                />
            ))}

            {/*
              THE MARK, reversed out.

              The association's own artwork rather than its initials set in
              type: this seal carries no ring text, so the mark is the only
              thing on it that says whose seal it is.
            */}
            <image
                href="/logo_ACTIVian-removebg-preview.png"
                x="52"
                y="50"
                width="136"
                height="48"
                preserveAspectRatio="xMidYMid meet"
                style={{ filter: 'brightness(0) invert(1)' }}
            />

            {/* The banner. Its ends are cut on the diagonal, which is what makes
                a gold rectangle read as a ribbon rather than as a highlight. */}
            <path d="M26 124 L214 124 L200 139 L214 154 L26 154 L40 139 Z"
                  fill={`url(#${gBand})`} />
            <text
                x="120"
                y="145"
                fontSize={line.length > 10 ? 13 : 17}
                fontWeight="800"
                letterSpacing={line.length > 10 ? 0.8 : 2}
                textAnchor="middle"
                fill={deep}
                style={{ textTransform: 'uppercase' }}
            >
                {line}
            </text>

            {/* Three stars under the banner, on an arc. On a straight line they
                read as three specks of ink the press left behind. */}
            {[-18, 0, 18].map((deg) => {
                const a = ((deg - 90) * Math.PI) / 180;
                return (
                    <text
                        key={deg}
                        x={120 + 58 * Math.cos(a)}
                        y={120 - 58 * Math.sin(a) + 5}
                        fontSize="14"
                        fill={GOLD_LIGHT}
                        textAnchor="middle"
                    >
                        ★
                    </text>
                );
            })}
        </svg>
    );
}

export default CertificateRosette;
