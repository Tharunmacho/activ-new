import { type ReactNode, useId, useMemo } from 'react';

/**
 * ============================================================================
 * THE SHEET EVERY ACTIV CERTIFICATE IS PRINTED ON
 * ============================================================================
 *
 * The letterhead and the registration foot, typeset from the association's own
 * 80G document — the one issued against a ₹10,000 contribution — with its
 * wording kept and its parts lined up. Both are the same on every certificate
 * the association issues, which is why they live here and not inside any one
 * certificate's content.
 *
 * Poppins throughout: `font-sans` on this site IS Poppins (`tailwind.config.ts`),
 * so nothing here names a face. A certificate that picked its own font would
 * drift from the site the first time the site's changed.
 *
 * --------------------------------------------------------------- the frame
 *
 * `decorated` adds what makes a certificate look like a certificate rather than
 * like a form: a double rule around the sheet, an engraved corner ornament at
 * each of the four corners, and the mark set very faint behind the body as a
 * watermark.
 *
 * It is a PROP and not the default because the donation receipt is a tax
 * document a chartered accountant files, and an ornamented border on a receipt
 * reads as a diploma. The certificates a member frames get it; the receipt does
 * not.
 *
 * Every part of the decoration is drawn — SVG and a tint, no images beyond the
 * mark itself. A background photograph would be the first thing a printer
 * turns into a grey rectangle, and the second thing to make the text under it
 * unreadable.
 *
 * --------------------------------------------------------------- on paper
 *
 * Sized to A4 and printed from the browser. `print:` strips the screen chrome,
 * the shadow and the page tint; `print-color-adjust: exact` keeps the rules,
 * the tints and the seal, because a certificate that prints its ornament as
 * white is a certificate that prints as a draft.
 */

const CORPORATE_OFFICE =
    '6 & 7, Haygreeva Apartment, 121, Velacherry Main Road, Chennai — 600 032';
const PHONE = '+91 82201 12188';
const EMAIL = 'info@activ.org.in';
const WEBSITE = 'activ.org.in';

export const ASSOCIATION_NAME =
    'Adidravidar Confederation of Trade and Industrial Vision';

/* ------------------------------------------------------------- the ornament */

/**
 * One corner of the frame — a solid bracket that runs off the sheet edge.
 *
 * Drawn once for the top-left and rotated for the other three, so the four
 * cannot drift apart, which is what happens when a motif is drawn four times
 * and then one of them is adjusted.
 *
 * It replaced three nested arcs and a fleuron. Those were correct and
 * symmetrical and looked like every certificate template there has ever been;
 * the association asked for something that does not. A bracket that bleeds off
 * the edge reads as a frame the sheet was cut out of rather than as a box drawn
 * on top of it.
 */
function CornerBracket({ className }: { className: string }) {
    return (
        <svg viewBox="0 0 120 120" className={className} fill="none" aria-hidden="true">
            {/* The heavy L, hard against two edges. */}
            <path d="M0 0 H 74 V 9 H 9 V 74 H 0 Z" fill="currentColor" />
            {/* A short second rule inside it, and a square stop where they meet:
                two weights of the same ink is what makes a bracket read as
                drawn rather than as a crop mark. */}
            <path d="M20 20 H 58" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20 V 58" stroke="currentColor" strokeWidth="2" />
            <rect x="26" y="26" width="7" height="7" fill="currentColor" />
        </svg>
    );
}

/* ----------------------------------------------------------------- the seal */

/**
 * The association's seal, drawn rather than scanned.
 *
 * A round stamp is what a reader looks for before they read a word of a
 * certificate, and this document had none. It is drawn in SVG for two reasons:
 * an image of a real rubber stamp is a signature by another name, and a scan
 * at this size prints as a grey smudge.
 *
 * `useId` for the two text paths. Two seals on one page sharing an id makes the
 * second one's text follow the first one's circle, which is a silent and very
 * confusing failure.
 *
 * The ring text is split into a top arc and a bottom arc rather than run round
 * one circle: a single ring puts the bottom third of the words upside down.
 */
export function CertificateSeal({
    line,
    year,
}: {
    /** The short line across the middle — "Tax Exemption", "Membership". */
    line: string;
    /** The year under it, so the impression is dated as a real one would be. */
    year?: string;
}) {
    const uid = useId().replace(/:/g, '');
    const top = `seal-top-${uid}`;
    const bottom = `seal-bottom-${uid}`;

    /*
     * THE SCALLOPED RIM, COMPUTED.
     *
     * Forty-eight points at two alternating radii is what turns a circle into
     * the pressed edge of a stamp. It is a loop because it IS a loop — drawing
     * forty-eight points by hand is forty-eight chances to put one at the wrong
     * angle, and the one that is wrong is the one the eye goes to.
     */
    const scallops = useMemo(() => {
        const teeth = 48;
        const points: string[] = [];
        for (let i = 0; i < teeth * 2; i += 1) {
            const r = i % 2 === 0 ? 97 : 89;
            const a = (Math.PI * i) / teeth;
            points.push(`${(100 + r * Math.cos(a)).toFixed(2)},${(100 + r * Math.sin(a)).toFixed(2)}`);
        }
        return points.join(' ');
    }, []);

    return (
        <svg
            /* Taller than it is wide: the ribbon hangs below the medallion, and
               a square box would clip its tails. */
            viewBox="0 0 200 252"
            className="h-[10rem] w-[7.9rem] -rotate-[6deg] text-brand-800 opacity-95
                       sm:h-[11.5rem] sm:w-[9.1rem] print:h-[7rem] print:w-[5.55rem]"
            aria-label={`Seal of the ${ASSOCIATION_NAME}`}
            role="img"
        >
            <defs>
                {/* Clockwise over the top, so the upper words read left to right. */}
                <path id={top} d="M100,100 m-76,0 a76,76 0 1,1 152,0" fill="none" />
                {/* Anticlockwise under the bottom, for the same reason — run the
                    other way and the lower words print upside down. */}
                <path id={bottom} d="M100,100 m-64,0 a64,64 0 0,0 128,0" fill="none" />
            </defs>

            {/*
              THE RIBBON, BEHIND THE MEDALLION.

              Drawn first so the disc sits on top of where the tails begin — the
              tails have to start UNDER the seal or they read as two pennants
              parked next to it. The notch is the fold.
            */}
            <path
                d="M54 150 L54 248 L100 220 L146 248 L146 150 Z"
                fill="currentColor"
                opacity="0.92"
            />
            {/* The left tail a shade darker than the right: a ribbon is two
                lengths of cloth, and one flat silhouette reads as a pennant. */}
            <path d="M54 150 L54 248 L100 220 L100 150 Z" fill="currentColor" opacity="0.7" />

            {/* The disc, so the ribbon's head is hidden behind it. */}
            <circle cx="100" cy="100" r="98" fill="#fff" />

            <polygon points={scallops} fill="currentColor" opacity="0.18" />
            <circle cx="100" cy="100" r="89" fill="#fff" />

            <circle cx="100" cy="100" r="89" fill="none" stroke="currentColor" strokeWidth="3.5" />
            <circle cx="100" cy="100" r="81" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="100" cy="100" r="55" fill="none" stroke="currentColor" strokeWidth="1.4" />

            {/*
              THE TYPE IS SIZED TO THE ARC, not chosen and hoped for.

              A `textPath` that is longer than its path does not wrap and does not
              shrink — the overflow is simply not drawn. At 15pt the upper words
              ran past the end of their half-circle and the impression read
              “ADIDRAVIDAR CONFEDERATIO”. The budget is πr: 239 units up top and
              201 along the bottom, and both lines are set inside it.
            */}
            <text
                fontSize="13"
                fontWeight="700"
                letterSpacing="0.8"
                fill="currentColor"
                style={{ textTransform: 'uppercase' }}
            >
                <textPath href={`#${top}`} startOffset="50%" textAnchor="middle">
                    Adidravidar Confederation
                </textPath>
            </text>

            <text
                fontSize="10.5"
                fontWeight="700"
                letterSpacing="0.6"
                fill="currentColor"
                style={{ textTransform: 'uppercase' }}
            >
                <textPath href={`#${bottom}`} startOffset="50%" textAnchor="middle">
                    Trade &amp; Industrial Vision
                </textPath>
            </text>

            {/* The two stars separate the two arcs, which otherwise read as one
                broken sentence running round the ring. Inside the rules, not in
                the band between them, where they read as ink specks. */}
            <text fontSize="13" fill="currentColor" textAnchor="middle">
                <tspan x="32" y="105">★</tspan>
                <tspan x="168" y="105">★</tspan>
            </text>

            <text textAnchor="middle" fill="currentColor">
                <tspan x="100" y="90" fontSize="27" fontWeight="800" letterSpacing="2">ACTIV</tspan>
            </text>
            <path d="M62 99 H 138" stroke="currentColor" strokeWidth="1" />
            <text textAnchor="middle" fill="currentColor">
                <tspan
                    x="100"
                    y="117"
                    fontSize="11"
                    fontWeight="700"
                    letterSpacing="0.8"
                    style={{ textTransform: 'uppercase' }}
                >
                    {line}
                </tspan>
                {year ? (
                    <tspan x="100" y="133" fontSize="12" fontWeight="600" letterSpacing="1.4">
                        {year}
                    </tspan>
                ) : null}
            </text>
        </svg>
    );
}

/* ---------------------------------------------------------------- the sheet */

export function CertificateSheet({
    children,
    associationPan = 'AAITA2239D',
    registration80G = 'AAITA2239DF20210',
    decorated = false,
    footNote = 'Computer-generated receipt — does not require a signature',
}: {
    children: ReactNode;
    associationPan?: string;
    registration80G?: string;
    /** The engraved border, the corner ornaments and the watermark. */
    decorated?: boolean;
    /** The grey line above the registrations. */
    footNote?: ReactNode;
}) {
    return (
        <article
            className={`relative mx-auto w-full max-w-[210mm] overflow-hidden bg-white text-brand-900
                        shadow-[0_1px_2px_rgba(16,24,40,0.04),0_24px_60px_-30px_rgba(28,46,104,0.45)]
                        print:max-w-none print:shadow-none ${
                decorated ? 'border border-brand-800/40' : ''
            }`}
            style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
        >
            {decorated ? (
                /*
                  THE DECORATION IS BEHIND EVERYTHING AND CATCHES NOTHING.

                  `pointer-events-none` matters more than it looks: a watermark
                  stretched across the middle of the sheet would otherwise sit on
                  top of the text and swallow every selection and every click.
                */
                <div className="pointer-events-none absolute inset-0 select-none" aria-hidden="true">
                    {/* The palest possible wash, top and bottom, so the sheet is
                        not a flat white rectangle on a white page. */}
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(28,46,104,0.05)_0%,rgba(255,255,255,0)_22%,rgba(255,255,255,0)_78%,rgba(28,46,104,0.05)_100%)]" />

                    {/*
                      A GUILLOCHE, at two per cent.

                      Fine cross-hatched lines, the way security paper is printed.
                      It is not meant to be seen as a pattern — at this weight it
                      reads as the texture of the stock, and it is most of the
                      difference between a certificate and a screenshot of a web
                      page. Drawn, not photographed: a background image is the
                      first thing a printer turns into a grey rectangle.
                    */}
                    <svg className="absolute inset-0 h-full w-full text-brand-800" aria-hidden="true">
                        <defs>
                            <pattern
                                id="activ-guilloche"
                                width="14"
                                height="14"
                                patternUnits="userSpaceOnUse"
                                patternTransform="rotate(45)"
                            >
                                <path
                                    d="M0 0 V14 M7 0 V14"
                                    stroke="currentColor"
                                    strokeWidth="0.6"
                                    opacity="0.35"
                                />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#activ-guilloche)" opacity="0.09" />
                    </svg>

                    {/*
                      THE WEDGE — the reference's dark panel, cut to what a page
                      of text can carry and an office printer can lay down.

                      A solid field bleeding off ONE corner, with a paler one
                      offset behind it, is what stops a sheet reading as four
                      equal corners round a rectangle. Mirrored smaller at the
                      opposite corner so the page has a diagonal.
                    */}
                    <svg
                        className="absolute inset-0 h-full w-full"
                        viewBox="0 0 100 141"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                    >
                        {/*
                          Two weights, and the pale one is DELIBERATELY SMALL.

                          It began as a wedge reaching 42% across the sheet at
                          12%, which over a centred letterhead read as a grey
                          diagonal wash — a fold in the paper rather than a piece
                          of the design. Pulled back to a shadow just behind the
                          solid one, it does the only job it has: giving the
                          corner two planes instead of one.
                        */}
                        <polygon points="100,0 100,21 68,0" fill="hsl(var(--brand-800))" opacity="0.10" />
                        <polygon points="100,0 100,14 78,0" fill="hsl(var(--brand-800))" />
                        <polygon points="0,141 0,127 21,141" fill="hsl(var(--brand-800))" opacity="0.10" />
                        <polygon points="0,141 0,133 13,141" fill="hsl(var(--brand-800))" />
                    </svg>

                    {/* The hairline that floats inside the brackets, BROKEN at the
                        middle of the top and bottom by a diamond — the detail
                        that stops a rule reading as the edge of a table. */}
                    <div className="absolute inset-[10px] border border-brand-800/25" />
                    <span className="absolute left-1/2 top-[10px] h-2 w-2 -translate-x-1/2 -translate-y-1/2
                                     rotate-45 bg-white" />
                    <span className="absolute left-1/2 top-[10px] h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2
                                     rotate-45 bg-brand-800" />
                    <span className="absolute bottom-[10px] left-1/2 h-2 w-2 -translate-x-1/2 translate-y-1/2
                                     rotate-45 bg-white" />
                    <span className="absolute bottom-[10px] left-1/2 h-1.5 w-1.5 -translate-x-1/2 translate-y-1/2
                                     rotate-45 bg-brand-800" />

                    <CornerBracket className="absolute left-0 top-0 h-16 w-16 text-brand-800" />
                    <CornerBracket className="absolute right-0 top-0 h-16 w-16 rotate-90 text-brand-800" />
                    <CornerBracket className="absolute bottom-0 right-0 h-16 w-16 rotate-180 text-brand-800" />
                    <CornerBracket className="absolute bottom-0 left-0 h-16 w-16 -rotate-90 text-brand-800" />

                    {/*
                      NO LOGO WATERMARK, and the proof is why.

                      The mark was set very faint across the middle of the sheet,
                      which is where the facts panel sits — and that panel has to
                      be OPAQUE, or the mark shows through the middle of the table
                      and reads as a printing fault. So the watermark came out cut
                      in half by the panel's top edge: not a watermark, a stain.

                      A half-occluded watermark is worse than none, and the sheet
                      does not need it. The guilloche gives the paper its texture,
                      the engraved border and the seal say what kind of document
                      this is, and the mark itself is at full strength in the
                      letterhead where it is meant to be read.
                    */}
                </div>
            ) : null}

            <div className="relative">
                {/* ------------------------------------------------ letterhead */}
                <header
                    className={`px-10 pb-6 pt-10 text-center sm:px-14 print:pb-2.5 print:pt-4 ${
                        decorated ? 'border-b-2 border-brand-800/25' : 'border-b-4 border-brand-800'
                    }`}
                >
                    {/*
                      The mark at the size it is legible, not at the size that fits.
                      It carries the association's full name inside the artwork, so
                      the line under it repeats that name deliberately: a photocopy
                      of a photocopy loses the artwork long before it loses text.
                    */}
                    <img
                        src="/logo_ACTIVian-removebg-preview.png"
                        alt=""
                        className="mx-auto h-20 w-auto object-contain print:h-12"
                    />

                    {/* 16px in print, and the number is not arbitrary: at 18px
                        this 56-character line is 694px wide against the 653px a
                        sheet has inside its margins, so it wrapped to two lines
                        and took 24px of a page that had eleven to spare. */}
                    <h1 className="mt-4 text-[1.375rem] font-extrabold uppercase leading-tight
                                   tracking-[0.02em] text-brand-800 sm:text-[1.5rem]
                                   print:mt-1.5 print:text-[1rem]">
                        {ASSOCIATION_NAME}
                    </h1>

                    <p className="mt-2 text-[1.0625rem] font-medium leading-relaxed text-gray-600
                                  print:mt-1 print:text-[0.875rem]">
                        Corporate Office: {CORPORATE_OFFICE}
                    </p>

                    {/*
                      Three contact facts, separated by rules rather than by the
                      original's run of spaces — which collapsed at small sizes into
                      "…12188Email: info@…" with nothing between them.
                    */}
                    <p className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1
                                  text-[1.0625rem] font-medium text-gray-600 print:text-[0.875rem]">
                        <span>Phone: {PHONE}</span>
                        <span aria-hidden="true" className="text-gray-300">|</span>
                        <span>Email: {EMAIL}</span>
                        <span aria-hidden="true" className="text-gray-300">|</span>
                        <span>Website: {WEBSITE}</span>
                    </p>
                </header>

                <div className="px-10 py-9 sm:px-14 print:py-4">{children}</div>

                {/* ------------------------------------------------------ foot */}
                <footer
                    className={`px-10 pb-10 pt-5 text-center sm:px-14 print:pb-4 print:pt-2.5 ${
                        decorated ? 'border-t border-brand-800/20' : 'border-t border-gray-200'
                    }`}
                >
                    {/* Tighter tracking and a `balance` wrap: at 0.12em this broke
                        after "a", leaving "SIGNATURE" alone on the second line. */}
                    <p className="text-[1.0625rem] font-semibold uppercase tracking-[0.06em]
                                  text-gray-400 print:text-[0.875rem]"
                       style={{ textWrap: 'balance' }}>
                        {footNote}
                    </p>

                    {/*
                      THE TWO NUMBERS THAT MAKE IT A TAX DOCUMENT.

                      A certificate without the association's PAN and its 80G
                      registration is a thank-you letter. They sit in their own
                      band, spaced and labelled, rather than as two more sentences
                      in the same grey run as everything else.
                    */}
                    <dl className="mt-4 grid gap-x-8 gap-y-2 rounded-lg bg-gray-50 px-5 py-4 text-left
                                   sm:grid-cols-2 print:mt-2 print:py-2">
                        <div>
                            <dt className="text-[1rem] font-bold uppercase tracking-[0.08em] text-gray-500">
                                Association PAN
                            </dt>
                            <dd className="text-[1.1875rem] font-semibold tabular-nums text-brand-900">
                                {associationPan}
                            </dd>
                        </div>
                        <div>
                            {/* Shortened so it sets on ONE line like the label beside
                                it: wrapped, it pushed its value a line lower and the
                                two numbers stopped lining up. */}
                            <dt className="text-[1rem] font-bold uppercase tracking-[0.08em] text-gray-500">
                                80G registration no.
                            </dt>
                            <dd className="text-[1.1875rem] font-semibold tabular-nums text-brand-900">
                                {registration80G}
                            </dd>
                        </div>
                    </dl>
                </footer>
            </div>
        </article>
    );
}

export default CertificateSheet;
