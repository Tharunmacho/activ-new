import { useId } from 'react';
import { GOLD, GOLD_LIGHT } from './CertificateMedallion';

/**
 * ============================================================================
 * THE WAVE FRAME — the tax certificate's border
 * ============================================================================
 *
 * Three groups of layered ribbons: one hugging the top left, one sweeping in
 * from the top right, and a band across the foot that the strapline sits in.
 * Drawn to the template the association supplied.
 *
 * ---------------------------------------------------------------- the depth
 *
 * Each group is THREE LAYERS at increasing weight — pale, mid, navy — and that
 * order is what makes them read as overlapping material rather than as three
 * printed shapes:
 *
 *   - the PALEST is the widest and goes down first, so the others lie on it.
 *     It is also the FAINTEST, at half opacity, because the logo and the three
 *     promise lines sit on top of it — at full strength the first cut of this
 *     put navy type on a navy ground and the promises could not be read;
 *   - each layer carries a GRADIENT across its sweep, so the curve has a lit
 *     side and a shaded one;
 *   - a gold hairline runs along the leading edge of the deepest layer. It is
 *     the cheapest 3D trick there is and it is most of why the navy reads as an
 *     edge rather than as a silhouette.
 *
 * ------------------------------------------------- why it is ONE svg, not three
 *
 * The viewBox is the sheet — 794 x 1123, which is A4 portrait at 96dpi — so
 * every coordinate in here is a real pixel on the real page and the three
 * groups are positioned against each other rather than against three separate
 * boxes. Three absolutely-positioned SVGs would each need their own size and
 * offset, and the first time one moved the others would not.
 *
 * `preserveAspectRatio` is left at its default for the same reason: the box and
 * the viewBox are the same shape, so nothing is being stretched and the curves
 * keep the radii they were drawn with.
 *
 * `useId` for every gradient. Two sheets on one page sharing an id makes the
 * second reference the first one's definition, which is invisible until two
 * certificates render side by side and then baffling.
 */
export function CertificateWaves({ navy, deep }: { navy: string; deep: string }) {
    const uid = useId().replace(/:/g, '');
    const gNavy = `wv-navy-${uid}`;
    const gMid = `wv-mid-${uid}`;
    const gPale = `wv-pale-${uid}`;

    return (
        <svg
            viewBox="0 0 794 1123"
            aria-hidden="true"
            /* Inline, not `absolute inset-0 h-full w-full`: without those the
               SVG drops into the flow at its natural size and pushes the whole
               sheet down. A border cannot depend on a class being present. */
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
                    <stop offset="55%" stopColor={deep} />
                    <stop offset="100%" stopColor="#060F30" />
                </linearGradient>
                <linearGradient id={gMid} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#4E7ACB" />
                    <stop offset="100%" stopColor="#2D4E96" />
                </linearGradient>
                <linearGradient id={gPale} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#E3ECFA" />
                    <stop offset="100%" stopColor="#C3D6F1" />
                </linearGradient>
            </defs>

            {/* ------------------------------------------------- the top left */}
            <path d="M0 0 H208 C160 44 128 32 86 76 C56 108 26 126 0 136 Z"
                  fill={`url(#${gPale})`} opacity="0.5" />
            <path d="M0 0 H158 C122 34 98 24 64 58 C42 82 18 98 0 106 Z"
                  fill={`url(#${gMid})`} opacity="0.32" />
            <path d="M0 0 H112 C86 24 70 17 46 42 C30 59 14 71 0 78 Z"
                  fill={`url(#${gNavy})`} />
            <path d="M112 0 C86 24 70 17 46 42 C30 59 14 71 0 78"
                  fill="none" stroke={GOLD} strokeWidth="1.6" opacity="0.8" />

            {/* ------------------------------------------------ the top right */}
            <g transform="translate(794,0) scale(-1,1)">
                <path d="M0 0 H246 C190 52 154 38 104 90 C68 128 32 150 0 162 Z"
                      fill={`url(#${gPale})`} opacity="0.45" />
                <path d="M0 0 H188 C146 40 118 28 78 68 C52 96 24 114 0 124 Z"
                      fill={`url(#${gMid})`} opacity="0.3" />
                <path d="M0 0 H134 C104 28 84 20 56 50 C36 72 16 86 0 92 Z"
                      fill={`url(#${gNavy})`} />
                <path d="M134 0 C104 28 84 20 56 50 C36 72 16 86 0 92"
                      fill="none" stroke={GOLD} strokeWidth="1.6" opacity="0.8" />
            </g>

            {/* ----------------------------------------------------- the foot */}
            {/*
              The band the strapline sits in. Its top edge is the wave; the
              trough is kept off-centre so the curve reads as a sweep rather
              than as a symmetrical scallop.
            */}
            <path d="M0 1123 H794 V916 C700 948 634 916 510 948 C382 980 252 1012 142 996
                     C84 987 32 964 0 948 Z"
                  fill={`url(#${gPale})`} opacity="0.5" />
            <path d="M0 1123 H794 V956 C702 984 642 956 522 985 C398 1015 268 1044 160 1030
                     C98 1021 34 998 0 982 Z"
                  fill={`url(#${gMid})`} opacity="0.34" />
            <path d="M0 1123 H794 V996 C706 1020 646 996 530 1022 C410 1049 284 1076 180 1064
                     C114 1056 38 1034 0 1018 Z"
                  fill={`url(#${gNavy})`} />
            <path d="M794 996 C706 1020 646 996 530 1022 C410 1049 284 1076 180 1064
                     C114 1056 38 1034 0 1018"
                  fill="none" stroke={GOLD_LIGHT} strokeWidth="2" opacity="0.85" />
        </svg>
    );
}

export default CertificateWaves;
