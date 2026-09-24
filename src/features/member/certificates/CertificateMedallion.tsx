import { useId, useMemo } from 'react';

export const GOLD = '#C8992F';
export const GOLD_LIGHT = '#E6C878';
export const GOLD_PALE = '#F7E3A6';
export const GOLD_DEEP = '#8A6518';
export const CREAM = '#F7F1E1';

/** Where a point sits on a circle, in SVG coordinates (y down). */
const at = (cx: number, cy: number, r: number, deg: number) => {
    const a = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
};

/**
 * ============================================================================
 * THE ASSOCIATION'S MEDALLION — struck, not stamped
 * ============================================================================
 *
 * Drawn to the emblem the association supplied, part for part:
 *
 *     a heavy gold torus with a bevel                 the rim
 *     a royal band carrying the name over the top     and the motto under the
 *                                                     foot, both in gold
 *     a cream face                                    the field
 *     a laurel wreath up both sides                   gold and royal leaves,
 *                                                     alternating, with berries
 *     three stars                                     over the mark
 *     the mark, extruded and gold-edged               the centre
 *     a banner across the foot                        crossing the rim
 *
 * ------------------------------------------------------- what this replaced
 *
 * Twice. First a white disc with navy type on it, which read as a rubber stamp
 * — and on a pale certificate a white disc on white paper is an outline. Then a
 * flat version of this one whose centre was the word ACTIV set plain, which the
 * association rejected on sight: on their emblem the centre is a MODELLED
 * object with a lit edge and a shadow under it, and a word typed in the middle
 * of a circle is not that however good the circle is.
 *
 * So the mark is extruded here — four offset copies in deep gold under a navy
 * face with a gold edge — which is the whole of what makes it read as raised.
 * Four and not six, stepped 1.2 apart and not 1: at the 0.65 scale this renders
 * at, a deep step reads as depth and a shallow one reads as blur.
 *
 * ---------------------------------------------------------- how the text fits
 *
 * A `textPath` longer than its path does not wrap and does not shrink: the
 * overflow is simply NOT DRAWN, silently. A ring on an earlier seal read
 * "ADIDRAVIDAR CONFEDERATIO", and a later one "NISE FOR ECONOMIC LIB". So both
 * arcs are budgeted, and both sums are measured rather than guessed:
 *
 *     top arc    220 deg at r=110 = 422 units;  53 characters at 9.5px need ~330
 *     foot arc   110 deg at r=110 = 211 units;  29 characters at 8.5px need ~157
 *
 * Change the name or the motto and check those two sums before anything else.
 *
 * The two arcs run in OPPOSITE directions — the top clockwise, the foot
 * anticlockwise. Run the same way, the foot's words print upside down.
 *
 * ------------------------------------------------------------ the clearances
 *
 * Everything in the face is placed against the banner, which is the one element
 * that crosses other things:
 *
 *     stars          y 78
 *     the mark       baseline 134, cap top 106
 *     the banner     152 .. 186          <- clears the mark by 18
 *     the foot arc   ends at y 193       <- clears the banner by 7
 *
 * `useId` for every gradient, filter and path id. Two medallions on one page
 * sharing an id makes the second reference the first one's definition, which is
 * invisible until two certificates render side by side and then baffling.
 */
export function CertificateMedallion({
    line,
    tone = 'navy',
    className = 'h-[10rem] w-[10rem]',
}: {
    /** The banner across the foot — "Membership", "80G Approved". */
    line: string;
    /**
     * Which field the medal is struck on.
     *
     * The association keeps two documents in two liveries — the membership
     * certificate in its navy, the tax certificate in forest green — and one
     * seal in the wrong colour on the other sheet is the detail that makes a
     * pair look assembled rather than designed. The GOLD is the same in both,
     * because gold is the association's and not the document's.
     */
    tone?: 'navy' | 'green';
    className?: string;
}) {
    const FIELD = tone === 'green'
        ? { a: '#2E6B52', b: '#143A2B', c: '#072116', leaf: '#2E6B52', star: '#1C4D3A', mark: '#143A2B' }
        : {
            a: 'hsl(var(--brand-700))', b: 'hsl(var(--brand-900))', c: '#040B26',
            leaf: 'hsl(var(--brand-800))', star: 'hsl(var(--brand-700))', mark: 'hsl(var(--brand-800))',
        };
    const uid = useId().replace(/:/g, '');
    const rim = `md-rim-${uid}`;
    const bevel = `md-bevel-${uid}`;
    const royal = `md-royal-${uid}`;
    const face = `md-face-${uid}`;
    const leafGold = `md-leafgold-${uid}`;
    const leafRoyal = `md-leafroyal-${uid}`;
    const sheen = `md-sheen-${uid}`;
    const lift = `md-lift-${uid}`;
    const topArc = `md-top-${uid}`;
    const footArc = `md-foot-${uid}`;
    const word = `md-word-${uid}`;

    /*
     * THE WREATH, COMPUTED.
     *
     * Seven leaves up each side with a berry between every pair, alternating
     * gold and royal exactly as the emblem does, each leaf rotated onto the
     * tangent of its branch so the spray curves instead of fanning.
     *
     * It is a loop because it IS a loop — fourteen leaves and twelve berries
     * placed by hand is twenty-six chances to put one at the wrong angle, and
     * the wrong one is the only one anybody sees.
     */
    const wreath = useMemo(() => {
        const leaves: { x: number; y: number; rot: number; gold: boolean }[] = [];
        const berries: { x: number; y: number }[] = [];
        for (const side of [-1, 1]) {
            for (let i = 0; i < 7; i += 1) {
                const deg = side < 0 ? 188 - i * 12 : -8 + i * 12;
                const p = at(130, 132, 76, deg);
                /* A leaf lies on the TANGENT. In SVG, where rotation is
                   clockwise and y runs down, a math-convention tangent at
                   `deg + 90` is a rotation of `-(deg + 90)`. Set to `deg`
                   itself the spray fans out like a hand of cards. */
                leaves.push({ x: p.x, y: p.y, rot: -(deg + 90), gold: i % 2 === 0 });
                if (i < 6) {
                    const b = at(130, 132, 62, deg + (side < 0 ? -6 : 6));
                    berries.push(b);
                }
            }
        }
        return { leaves, berries };
    }, []);

    const t1 = at(130, 130, 110, 200);
    const t2 = at(130, 130, 110, -20);
    const f1 = at(130, 130, 110, 215);
    const f2 = at(130, 130, 110, 325);
    const arc = (a: { x: number; y: number }, b: { x: number; y: number }, large: number, sweep: number) =>
        `M${a.x.toFixed(2)},${a.y.toFixed(2)} A110,110 0 ${large},${sweep} ${b.x.toFixed(2)},${b.y.toFixed(2)}`;

    return (
        <svg
            viewBox="0 0 260 260"
            /*
             * `select-none`: the extrusion is four offset copies of the mark
             * under a fifth, and every one is a real <text> node. Selecting the
             * certificate and copying it returned "ACTIV ACTIV ACTIV ACTIV
             * ACTIV Membership". `role="img"` keeps those out of the
             * accessibility tree — which is why it went unnoticed — but does
             * nothing for selection. The medal is one image; none of it is text
             * a reader should be able to pick up.
             */
            className={`select-none ${className}`}
            role="img"
            aria-label={`Seal of the association — ${line}`}
        >
            <defs>
                {/* The rim reads as metal because the light crosses it once:
                    pale at the top left, deep at the bottom right, with a bright
                    band a third of the way through. A two-stop gold is a flat
                    yellow ring. */}
                <linearGradient id={rim} x1="0.12" y1="0" x2="0.88" y2="1">
                    <stop offset="0%" stopColor={GOLD_PALE} />
                    <stop offset="28%" stopColor={GOLD_LIGHT} />
                    <stop offset="55%" stopColor={GOLD} />
                    <stop offset="100%" stopColor={GOLD_DEEP} />
                </linearGradient>
                <linearGradient id={bevel} x1="0.9" y1="0" x2="0.1" y2="1">
                    <stop offset="0%" stopColor={GOLD_DEEP} />
                    <stop offset="50%" stopColor={GOLD} />
                    <stop offset="100%" stopColor={GOLD_PALE} />
                </linearGradient>
                <linearGradient id={royal} x1="0.15" y1="0" x2="0.85" y2="1">
                    <stop offset="0%" stopColor={FIELD.a} />
                    <stop offset="50%" stopColor={FIELD.b} />
                    <stop offset="100%" stopColor={FIELD.c} />
                </linearGradient>
                <radialGradient id={face} cx="0.36" cy="0.28" r="0.82">
                    <stop offset="0%" stopColor="#FFFFFA" />
                    <stop offset="58%" stopColor="#FCF7EA" />
                    <stop offset="100%" stopColor="#E6DBBE" />
                </radialGradient>
                <linearGradient id={leafGold} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={GOLD_PALE} />
                    <stop offset="100%" stopColor={GOLD} />
                </linearGradient>
                <linearGradient id={leafRoyal} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={tone === 'green' ? '#4A8F70' : 'hsl(var(--brand-500))'} />
                    <stop offset="100%" stopColor={FIELD.leaf} />
                </linearGradient>

                {/* ONE shadow over the whole medal. A shadow per circle stacks
                    into five of them and the ring edges go muddy where they
                    overlap. */}
                <filter id={lift} x="-20%" y="-20%" width="145%" height="150%">
                    <feDropShadow dx="1" dy="4" stdDeviation="4.5"
                                  floodColor="#0A1738" floodOpacity="0.34" />
                </filter>

                {/* The lit quarter, laid over the finished medal. Inside the
                    shadow filter it would be blurred along with everything
                    else, and a blurred highlight is no highlight. */}
                <radialGradient id={sheen} cx="0.3" cy="0.24" r="0.62">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
                    <stop offset="58%" stopColor="#FFFFFF" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#000000" stopOpacity="0.16" />
                </radialGradient>

                <path id={topArc} d={arc(t1, t2, 1, 1)} fill="none" />
                <path id={footArc} d={arc(f1, f2, 0, 0)} fill="none" />

                {/* The mark, once. Carries no `fill`: see the note at the
                    call site. */}
                <text
                    id={word}
                    x="130"
                    y="134"
                    fontSize="40"
                    fontWeight="800"
                    letterSpacing="1.2"
                    textAnchor="middle"
                >
                    ACTIV
                </text>
            </defs>

            <g filter={`url(#${lift})`}>
                {/* Rim, bevel, band, inner gold ring, face — five discs rather
                    than five strokes, because a stroked ring cannot carry a
                    gradient across its width and the width is where the metal
                    is. The bevel disc is lit from the OPPOSITE side of the rim,
                    which is what turns one gold ring into a rounded edge. */}
                <circle cx="130" cy="130" r="129" fill={`url(#${rim})`} />
                <circle cx="130" cy="130" r="122" fill={`url(#${bevel})`} />
                <circle cx="130" cy="130" r="120" fill={`url(#${royal})`} />
                <circle cx="130" cy="130" r="120" fill="none" stroke={GOLD_PALE} strokeWidth="1" />
                <circle cx="130" cy="130" r="99" fill="none" stroke={`url(#${rim})`} strokeWidth="6" />
                <circle cx="130" cy="130" r="95" fill={`url(#${face})`} />
            </g>

            {/* The band's two legends. Gold on royal blue — the emblem's own
                pairing, and the only one that survives a photocopy. */}
            <text fill={GOLD_PALE} fontSize="9.5" fontWeight="700" letterSpacing="0.5"
                  style={{ textTransform: 'uppercase' }}>
                <textPath href={`#${topArc}`} startOffset="50%" textAnchor="middle">
                    Adidravidar Confederation of Trade &amp; Industrial Vision
                </textPath>
            </text>
            <text fill={GOLD_PALE} fontSize="8.5" fontWeight="700" letterSpacing="0.4"
                  style={{ textTransform: 'uppercase' }}>
                <textPath href={`#${footArc}`} startOffset="50%" textAnchor="middle">
                    Organise for Economic Liberty
                </textPath>
            </text>

            {/* A bead where each run of band text stops, so the gap between them
                reads as a join rather than as a dropout. */}
            {[180, 0].map((deg) => {
                const p = at(130, 130, 110, deg);
                return (
                    <g key={deg}>
                        <circle cx={p.x} cy={p.y} r="5" fill={`url(#${rim})`} />
                        <circle cx={p.x - 1.2} cy={p.y - 1.2} r="1.6" fill={GOLD_PALE} opacity="0.8" />
                    </g>
                );
            })}

            {/* The wreath. */}
            {wreath.berries.map((b, i) => (
                <circle key={`b${i}`} cx={b.x} cy={b.y} r="2.6" fill={`url(#${leafGold})`} />
            ))}
            {wreath.leaves.map((leaf, i) => (
                <g key={`l${i}`} transform={`rotate(${leaf.rot} ${leaf.x} ${leaf.y})`}>
                    <ellipse cx={leaf.x} cy={leaf.y} rx="12.5" ry="5.2"
                             fill={leaf.gold ? `url(#${leafGold})` : `url(#${leafRoyal})`} />
                    {/* The midrib. One line down a leaf is the difference
                        between a leaf and a lozenge — but only on the GOLD ones:
                        on a royal leaf a dark rib over a dark fill is mud at
                        this scale. */}
                    {leaf.gold ? (
                        <path d={`M${leaf.x - 10} ${leaf.y} H${leaf.x + 10}`}
                              stroke={GOLD_DEEP} strokeWidth="0.8" opacity="0.55" />
                    ) : null}
                </g>
            ))}

            {/* Three stars over the mark, on an arc. On a straight line they
                read as three specks of ink the press left behind. */}
            {[-24, 0, 24].map((deg) => {
                const p = at(130, 134, 56, 90 + deg);
                return (
                    <text key={deg} x={p.x} y={p.y + 5} fontSize="14"
                          fill={FIELD.star} textAnchor="middle">
                        ★
                    </text>
                );
            })}

            {/*
              THE MARK, EXTRUDED.

              Six copies stepped a pixel apart in deep gold, then the face on
              top with a gold edge. That stack IS the third dimension: the
              association looked at a flat version of this medal and said the
              centre did not suit, and a word typed in the middle of a circle is
              what they were looking at.

              `paintOrder="stroke"` keeps the gold edge outside the letterforms
              rather than eating half of each stem.
            */}
            {/*
              FIVE DRAWN COPIES, ONE TEXT NODE.

              The extrusion is four offset copies of the mark under a fifth, and
              written as five <text> elements it put five of them in the
              document. Selecting the certificate and copying it returned
              "ACTIV ACTIV ACTIV ACTIV ACTIV Membership" — reported from a real
              paste, invisible in every screenshot.

              The word now lives ONCE, in <defs>, and every copy is a <use>.
              `defs` content is not rendered and a `use` clone lives in a shadow
              tree, so the five copies contribute nothing to the text layer at
              all — which is right, because the medal is an image and its
              `aria-label` already says what it is.

              `fill` is set on each `use` and NOT on the text, because a
              presentation attribute on the referenced element wins over the
              one on the clone: give the text a fill and all five come out the
              same colour and the extrusion disappears.
            */}
            {[4, 3, 2, 1].map((d) => (
                <use
                    key={d}
                    href={`#${word}`}
                    y={d * 1.2}
                    fill={GOLD_DEEP}
                    opacity={0.45 + d * 0.13}
                />
            ))}
            <use
                href={`#${word}`}
                fill={FIELD.mark}
                stroke={`url(#${rim})`}
                strokeWidth="2.2"
                paintOrder="stroke"
            />

            {/*
              THE BANNER, and it runs WIDER THAN THE MEDAL on purpose.

              Its folded ends cross the torus exactly as the emblem's do. That
              overhang is what stops the medallion reading as a badge printed on
              a disc: a ribbon that stops at the rim is a label, and one that
              crosses it is a ribbon.
            */}
            <path d="M4 160 L30 151 L30 193 L4 202 L13 181 Z" fill={FIELD.c} />
            <path d="M256 160 L230 151 L230 193 L256 202 L247 181 Z" fill={FIELD.c} />
            <rect x="26" y="152" width="208" height="34" rx="2" fill={`url(#${royal})`} />
            <rect x="26" y="152" width="208" height="34" rx="2"
                  fill="none" stroke={`url(#${rim})`} strokeWidth="2.4" />
            {/* A lit top edge on the banner, so it reads as folded silk rather
                than as a painted rectangle. */}
            <path d="M28 155 H232" stroke={GOLD_PALE} strokeWidth="0.9" opacity="0.5" />

            <text
                x="130"
                y="176"
                fontSize={line.length > 12 ? 15 : 19}
                fontWeight="800"
                letterSpacing={line.length > 12 ? 1 : 2.4}
                textAnchor="middle"
                fill={GOLD_PALE}
                style={{ textTransform: 'uppercase' }}
            >
                {line}
            </text>

            <circle cx="130" cy="130" r="129" fill={`url(#${sheen})`} />
        </svg>
    );
}

export default CertificateMedallion;
