import { useId } from 'react';
import { GOLD, GOLD_LIGHT, GOLD_PALE } from './CertificateMedallion';

/**
 * ============================================================================
 * THE ANGULAR FRAME — corners, a gold rule, and a skyline
 * ============================================================================
 *
 * Drawn to the template the association supplied: four geometric corners of
 * navy and gold that bleed off the paper, a thin gold rectangle inside them,
 * and a faint industrial skyline along the foot.
 *
 * ------------------------------------------------ what this replaced, and why
 *
 * Layered ROUND ribbons — three arcs per corner sweeping along both edges. They
 * were right for the sheet they were drawn for and wrong for this one: the
 * template's corners are straight-edged wedges cut on the diagonal, and a
 * curve next to a chevron reads as two designs on one page.
 *
 * ------------------------------------------------------------- the geometry
 *
 * One corner is drawn, at the origin, facing down and right. The other three
 * are the same path mirrored — `scale(-1,1)`, `scale(-1,-1)`, `scale(1,-1)`
 * about the corner they belong to. Four hand-drawn corners is four chances to
 * adjust one and not the others, and the one that is wrong is the only one
 * anybody sees.
 *
 * The bands run at four distances from each corner, and those four numbers are
 * what the certificate's padding has to clear:
 *
 *     the solid wedge     0 -> 68
 *     a gold diagonal     96
 *     a thin navy band    116 -> 132
 *
 * A point is inside a corner when `x + y <= d` for the top left, and the mirror
 * of that for the other three. 132 is the number every margin on the sheet is
 * placed against:
 *
 *     the mark          (96, 44)   -> 140
 *     the strapline     (128, 54)  -> 182
 *     the code          (128, 54)  -> 182
 *
 * The first cut ran these bands out to 224 and they cut straight through the
 * strapline and through "SCAN TO VERIFY". Widen one and redo those three sums.
 *
 * ---------------------------------------------------------------- one svg
 *
 * The viewBox is the sheet — 1123 x 794, A4 landscape at 96dpi — so every
 * coordinate here is a real pixel on the real page, and the corners are placed
 * against each other rather than against four separate boxes.
 *
 * It is positioned with an INLINE STYLE and not `absolute inset-0`. Without
 * those classes the SVG drops into the flow at its natural size and shoves the
 * whole sheet down the page, which is what happened the last time a border on
 * this product depended on a utility class resolving.
 */
export function CertificateFrame({ navy, deep }: { navy: string; deep: string }) {
    const uid = useId().replace(/:/g, '');
    const gNavy = `fr-navy-${uid}`;
    const gSoft = `fr-soft-${uid}`;

    /** One corner, at the origin, facing down and right. */
    const Corner = ({ sx, sy, x, y }: { sx: number; sy: number; x: number; y: number }) => (
        <g transform={`translate(${x},${y}) scale(${sx},${sy})`}>
            <path d="M0 0 L68 0 L0 68 Z" fill={`url(#${gNavy})`} />
            <path d="M96 0 L0 96" stroke={GOLD} strokeWidth="2.2" fill="none" />
            <path d="M132 0 L0 132 L0 116 L116 0 Z" fill={`url(#${gSoft})`} />
        </g>
    );

    return (
        <svg
            viewBox="0 0 1123 794"
            aria-hidden="true"
            style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                userSelect: 'none',
            }}
        >
            <defs>
                <linearGradient id={gNavy} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={navy} />
                    <stop offset="60%" stopColor={deep} />
                    <stop offset="100%" stopColor="#050C24" />
                </linearGradient>
                <linearGradient id={gSoft} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={navy} />
                    <stop offset="100%" stopColor={deep} />
                </linearGradient>
            </defs>

            {/* The rule the corners cross. Thin and half strength: at full
                weight a rectangle round a certificate is a box, and the
                association has said so. Crossed by four wedges it reads as the
                frame's inner edge instead. */}
            <rect x="15" y="15" width="1093" height="764" fill="none"
                  stroke={GOLD} strokeWidth="1.4" opacity="0.55" />

            {/*
              THE SKYLINE, at four per cent, along the foot.

              The association is a confederation of TRADE AND INDUSTRY and the
              template puts its works along the bottom of the sheet. Drawn, not
              photographed: a background image is the first thing a printer
              turns into a grey rectangle and the second thing to make the type
              over it unreadable.
            */}
            <g stroke={navy} strokeWidth="1.6" fill="none" opacity="0.05"
               strokeLinejoin="round">
                <path d="M330 772 H1000" />
                <path d="M356 772 V722 H400 V772 M356 722 L378 704 L400 722" />
                <path d="M416 772 V688 H468 V772" />
                <path d="M428 704 h11 v12 h-11 z M448 704 h11 v12 h-11 z M428 728 h11 v12 h-11 z M448 728 h11 v12 h-11 z M428 752 h11 v12 h-11 z M448 752 h11 v12 h-11 z" />
                <path d="M484 772 V734 H522 V772" />
                <path d="M538 772 V698 H586 V772 M548 714 h11 v12 h-11 z M566 714 h11 v12 h-11 z M548 738 h11 v12 h-11 z M566 738 h11 v12 h-11 z" />
                <path d="M602 772 V672 H622 V772 M612 672 V652" />
                <path d="M638 772 V720 H700 V772 M638 720 L669 700 L700 720" />
                <path d="M716 772 V692 H766 V772 M726 708 h11 v12 h-11 z M744 708 h11 v12 h-11 z M726 732 h11 v12 h-11 z M744 732 h11 v12 h-11 z" />
                <path d="M782 772 V736 H822 V772" />
                {/* A gear, because the works are the point. */}
                <circle cx="888" cy="726" r="15" />
                <circle cx="888" cy="726" r="30" />
                {Array.from({ length: 12 }, (_, i) => {
                    const a = (i * Math.PI) / 6;
                    return (
                        <path
                            key={i}
                            d={`M${888 + 30 * Math.cos(a)} ${726 + 30 * Math.sin(a)} `
                                + `L${888 + 39 * Math.cos(a)} ${726 + 39 * Math.sin(a)}`}
                            strokeWidth="5"
                        />
                    );
                })}
            </g>

            <Corner x={0} y={0} sx={1} sy={1} />
            <Corner x={1123} y={0} sx={-1} sy={1} />
            <Corner x={1123} y={794} sx={-1} sy={-1} />
            <Corner x={0} y={794} sx={1} sy={-1} />
        </svg>
    );
}

export default CertificateFrame;
