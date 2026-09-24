import { useMemo } from 'react';
import QRCode from 'qrcode';

/**
 * ============================================================================
 * THE MARKS EVERY ACTIV CERTIFICATE CARRIES
 * ============================================================================
 *
 * The medallion is in `CertificateMedallion`; this file holds the QR and is the
 * one import a certificate needs for either.
 *
 * Both are DRAWN, not fetched and not rasterised. A certificate is a print
 * artifact: an <img> of a seal at 300dpi is a large asset that still prints
 * soft, and a QR served as a PNG is a QR that fails to scan the first time a
 * printer decides to dither it. Vector modules stay square at any size.
 */

/* The golds live with the medallion, which is what defines them; re-exported
   here so the certificates have one import for their marks. */
export { GOLD, GOLD_LIGHT, GOLD_PALE, GOLD_DEEP, CREAM, CertificateMedallion } from './CertificateMedallion';

/* -------------------------------------------------------------------- the QR */

/**
 * What the QR carries.
 *
 * IT IS THE CERTIFICATE'S OWN FACTS AS TEXT, not a URL, and that is a
 * deliberate limit rather than an oversight. A URL would have to point at a
 * public verification page, and there is no such route on this site and no such
 * endpoint on the API — a "SCAN TO VERIFY" square that resolves to a 404 is
 * worse than no square, because it turns a reader's doubt into a confirmed
 * failure.
 *
 * What a scan gives today is the reference and the holder in machine-readable
 * form, so an officer can quote them back to the association without
 * transcribing a twenty-five character string by eye.
 *
 * WHEN A VERIFY PAGE EXISTS this becomes a URL and nothing else changes: the
 * caller passes a different string.
 */
export function verificationPayload(fields: {
    reference: string;
    name: string;
    membershipNumber: string;
    validUntil: string;
}) {
    return [
        'ACTIV MEMBERSHIP CERTIFICATE',
        `Ref: ${fields.reference || '—'}`,
        `Name: ${fields.name || '—'}`,
        `Member no: ${fields.membershipNumber || '—'}`,
        `Valid: ${fields.validUntil || '—'}`,
        'Verify: info@activ.org.in',
    ].join('\n');
}

/**
 * A QR drawn as ONE SVG path.
 *
 * `QRCode.create` is the synchronous half of the library — it returns the
 * module matrix and nothing else, so there is no canvas, no data URL and no
 * promise to await before the sheet can lay out. A certificate that renders its
 * QR one frame late is a certificate whose print dialog can open without it.
 *
 * One path rather than a rect per module: a 25x25 code is three hundred-odd
 * dark modules, and three hundred SVG nodes inside a component that re-renders
 * is the difference between a print preview opening instantly and visibly
 * building.
 *
 * `shapeRendering="crispEdges"` because the modules ARE the data. Anti-aliased
 * edges at 20mm are what makes a scanner hunt.
 */
export function CertificateQr({
    value,
    color = 'hsl(var(--brand-900))',
    className = 'h-20 w-20',
}: {
    value: string;
    /**
     * The modules' ink.
     *
     * The tax certificate is struck in forest green and a navy code on it was
     * the one element still wearing the other document's livery. It stays a
     * prop rather than becoming a token, because the only thing that must be
     * true of it is CONTRAST against white — a scanner reads dark against
     * light, not a hue.
     */
    color?: string;
    className?: string;
}) {
    const { path, size } = useMemo(() => {
        try {
            /* 'M' — 15% recovery. A certificate gets folded and photocopied and
               'L' survives neither; 'H' would push a payload this long onto a
               denser grid than an office printer resolves at this size. */
            const qr = QRCode.create(value || ' ', { errorCorrectionLevel: 'M' });
            const n = qr.modules.size;
            const data = qr.modules.data;
            let d = '';
            for (let y = 0; y < n; y += 1) {
                for (let x = 0; x < n; x += 1) {
                    if (data[y * n + x]) d += `M${x} ${y}h1v1h-1z`;
                }
            }
            return { path: d, size: n };
        } catch {
            /* A certificate must still print if the encoder refuses the string.
               An empty square is a missing QR; a throw is a missing document. */
            return { path: '', size: 1 };
        }
    }, [value]);

    return (
        <svg
            viewBox={`0 0 ${size} ${size}`}
            className={`select-none ${className}`}
            shapeRendering="crispEdges"
            role="img"
            aria-label="Certificate verification code"
        >
            <rect width={size} height={size} fill="#fff" />
            <path d={path} fill={color} />
        </svg>
    );
}
