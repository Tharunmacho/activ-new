import { CertificateSheet, SignatureInk, SIGNATORY, ASSOCIATION_NAME } from './CertificateSheet';
import { GOLD, GOLD_LIGHT, GOLD_PALE } from './CertificateMedallion';
import { CertificateQr, verificationPayload } from './CertificateMarks';
import { CertificateFrame } from './CertificateFrame';
import { CertificateRosette } from './CertificateRosette';
import type { Certificate } from '@/services/activApi';

/**
 * ============================================================================
 * THE MEMBERSHIP CERTIFICATE — A4 LANDSCAPE
 * ============================================================================
 *
 *   +---------------------------------------------------------+
 *   |◤navy                                             navy◥   |
 *   |  [MARK]        |  Empowering Communities                 |
 *   |                |  Building Opportunities                 |
 *   |                |  Growing Together                       |
 *   |        --- CERTIFICATE OF ---           .-------.        |
 *   |            Membership                  ( ROSETTE )       |
 *   |     --- PROUD MEMBER OF ACTIV ---       `-------'        |
 *   |                                                          |
 *   |             This is to certify that                      |
 *   |                 Tharun .V                                |
 *   |          (o) Ariyalur, Ariyalur, Tamil Nadu              |
 *   |     is a registered MEMBER of the Adidravidar            |
 *   |     Confederation of Trade and Industrial Vision.        |
 *   |   +-------------------------+----------------------+     |
 *   |   | Certificate number      | Membership number    |     |
 *   |   | Issue date              | Expiry date          |     |
 *   |   +-------------------------+----------------------+     |
 *   |   [ BLOCK | DISTRICT | STATE ]                           |
 *   |   -- strapline        [ink]  CHAIRMAN     [QR]           |
 *   |◣navy      ~~~ skyline ~~~                        navy◢   |
 *   +---------------------------------------------------------+
 *
 * ------------------------------------------- what changed, and what did not
 *
 * The CONTENT is the content it has always had — the association was explicit
 * that the fields were right. What moved is the furniture:
 *
 *   THE BORDER      round ribbons -> angular wedges (`CertificateFrame`). The
 *                   template's corners are straight-edged and cut on the
 *                   diagonal, and a curve beside a chevron is two designs on
 *                   one page.
 *
 *   THE SEAL        the struck medallion -> `CertificateRosette`, hanging at
 *                   the top right rather than standing in the foot row. The
 *                   medallion carries the association's full name and its motto
 *                   as ring type and wants 168px to be legible; the rosette
 *                   carries the mark and two words and works at 150. The
 *                   medallion is still on the tax certificate, where it has the
 *                   room.
 *
 *   THE FACTS       four cells in one panel, two columns — the template's
 *                   arrangement. They were a row of five along the foot.
 *
 * THE REGION KEEPS ITS OWN BAND. Block, district and state under three separate
 * headings, because in this association the block and the district are very
 * often the same word and one line of "Ariyalur, Ariyalur, Tamil Nadu" reads as
 * a stutter in the typesetting rather than as two answers that happen to match.
 *
 * ------------------------------------------------------- clearing the frame
 *
 * `CertificateFrame`'s corner bands reach 132 units, measured as `x + y` from
 * the corner. Every margin on this sheet is placed against that number:
 *
 *     the head    px-24 pt-10 -> the mark at (96, 40) = 136
 *     the foot    px-32 -> the strapline (128, 54) = 182, and the code likewise
 *     the body    px-[4.5rem]  — its panels span the full measure, and the
 *                 corner bands do not reach the middle of an edge
 *
 * Move a padding or widen a band and redo those sums.
 *
 * ---------------------------------------------------------------- on paper
 *
 * 297 x 210mm, and `CertificateSheet` emits the matching `@page`. A 297mm sheet
 * sent to a portrait page is CUT, not scaled.
 *
 * 297mm is 1122.5px at 96dpi and that is what the browser lays out, so screen
 * and paper are the same size and nothing here carries a `print:` type size.
 * `CertificateFrame` is drawn against that exact box, so the sheet's dimensions
 * and the frame's coordinates are two halves of one number.
 */

const NAVY = 'hsl(var(--brand-800))';
const NAVY_DEEP = '#0E1F4D';
const INK = 'hsl(var(--brand-900))';
const MUTED = '#6B7A9C';
const PAPER = '#FCFBF7';

const PROMISE = ['Empowering Communities', 'Building Opportunities', 'Growing Together'];
const KICKER = 'Proud member of ACTIV';
const STRAPLINE = ['Stronger members and', 'a brighter future'];

/**
 * The association's name, broken where it should break.
 *
 * Left to wrap it came out over three lines with "Adidravidar" alone on the
 * first — a body's name divided by whatever width the column happened to be.
 * `ASSOCIATION_NAME` is still the single string everywhere it is read rather
 * than set, so nothing downstream has to know about this.
 */
const ASSOCIATION_LINES = ['Adidravidar Confederation of', 'Trade and Industrial Vision'];

const formatDate = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? ''
        : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

/**
 * THE REGION IS THREE LABELLED CELLS, not one sentence.
 *
 * "Ariyalur Block, Ariyalur District, Tamil Nadu" on one line is accurate and
 * reads as a stutter: in this association the block and the district are very
 * often the same word, so the line printed one name twice with two different
 * nouns after it and the eye took it for a typesetting fault.
 *
 * Three cells, each under its own heading, say the same thing and say WHICH IS
 * WHICH by position rather than by grammar. A level the server sent empty is
 * dropped, so a member with no block recorded gets two cells and not a heading
 * over a blank.
 */
const placeCells = (member: Certificate['member']) =>
    (member?.isInternational
        /* Outside India there is no block, district or state — the place the
           member gave, and the country their number is from. */
        ? [
            { label: 'Place', value: member?.place || '' },
            { label: 'Country', value: member?.country || '' },
        ]
        : [
            { label: 'Block', value: member?.block || '' },
            { label: 'District', value: member?.district || '' },
            { label: 'State', value: member?.state || '' },
        ]).filter((c) => !!c.value);

/* ------------------------------------------------------------- the furniture */

/** One fact in the panel — a caption over a value, on its own quarter. */
function Fact({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0 px-6 py-3">
            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.16em]"
               style={{ color: MUTED }}>
                {label}
            </p>
            <p className="mt-1 truncate text-[1rem] font-bold" style={{ color: INK }}>
                {value}
            </p>
        </div>
    );
}

export default function MembershipCertificate({ cert }: { cert: Certificate }) {
    const member = cert.member || ({} as Certificate['member']);

    /* A lifetime membership is the one with NO end date. Reading
       `membershipType` alone printed "Lifetime" over a real expiry the server
       had sent. */
    const lifetime = cert.membershipType === 'lifetime' && !cert.validUntil;
    const validUntil = lifetime ? 'Lifetime' : formatDate(cert.validUntil);
    const place = placeCells(member);

    /* Four, in reading order down then across, and an empty one is dropped
       rather than printing a caption with nothing under it. */
    const facts = [
        { label: 'Certificate number', value: cert.reference || '' },
        { label: 'Membership number', value: member.membershipNumber || '' },
        { label: 'Issue date', value: formatDate(cert.issuedAt) },
        { label: lifetime ? 'Validity' : 'Expiry date', value: validUntil },
    ].filter((f) => !!f.value);

    return (
        <CertificateSheet
            size="a4-landscape"
            bleed
            onePage
            letterhead={false}
            registrations={false}
            footNote={null}
        >
            <div className="relative flex w-full flex-1 flex-col overflow-hidden"
                 style={{ background: PAPER, color: INK }}>

                <CertificateFrame navy={NAVY} deep={NAVY_DEEP} />

                {/* The palest wash. Paper is never one value, and a flat fill is
                    what makes a printed sheet read as a screen. */}
                <div aria-hidden="true"
                     style={{
                         position: 'absolute',
                         inset: 0,
                         background: 'radial-gradient(120% 100% at 50% 34%, #FFFFFF 0%, #FDFCF8 56%, #F2EFE4 100%)',
                         mixBlendMode: 'multiply',
                     }} />

                {/* ================================================== the head */}
                <header className="relative z-10 flex items-start gap-7 px-24 pt-10">
                    <img
                        src="/logo_ACTIVian-removebg-preview.png"
                        alt={ASSOCIATION_NAME}
                        className="h-[3.5rem] w-auto shrink-0 object-contain"
                    />
                    <span className="h-14 w-px shrink-0"
                          style={{ background: `linear-gradient(180deg, transparent, ${GOLD}, transparent)` }}
                          aria-hidden="true" />
                    <div className="shrink-0">
                        {PROMISE.map((line) => (
                            <p key={line} className="text-[0.8125rem] font-semibold leading-[1.5]"
                               style={{ color: NAVY }}>
                                {line}
                            </p>
                        ))}
                    </div>
                </header>

                {/*
                  THE ROSETTE HANGS AT THE TOP RIGHT, placed absolutely.

                  It is out of the flow on purpose: in the flow it would have to
                  belong either to the head or to the title block, and it belongs
                  to the SHEET — it sits across both, which is what the template
                  does and what stops the top of the page reading as three
                  stacked rows.

                  Inline positioning, like everything else structural on this
                  sheet. Its left edge is at 1123-72-160 = 891, and the title
                  block's widest line finishes near 760, so they cannot meet.
                */}
                <CertificateRosette
                    line="Member"
                    navy={NAVY}
                    deep={NAVY_DEEP}
                    style={{ position: 'absolute', right: 72, top: 96, width: 160, height: 200, zIndex: 20 }}
                />

                {/* ================================================== the body */}
                <div className="relative z-10 flex flex-1 flex-col items-center px-[4.5rem] pt-3
                                text-center">

                    <p className="flex items-center gap-3 text-[1rem] font-semibold uppercase
                                  tracking-[0.34em]" style={{ color: NAVY }}>
                        <span aria-hidden="true" className="h-px w-8"
                              style={{ background: `linear-gradient(90deg, transparent, ${GOLD})` }} />
                        Certificate of
                        <span aria-hidden="true" className="h-px w-8"
                              style={{ background: `linear-gradient(90deg, ${GOLD}, transparent)` }} />
                    </p>

                    {/* The one gold-filled line, and the reason the rest of the
                        title is navy: two gold headings compete and neither
                        wins. */}
                    <h2 className="mt-0.5 font-certificate text-[3.25rem] font-bold leading-[1.1]"
                        style={{
                            background: `linear-gradient(180deg, ${GOLD_PALE} 0%, ${GOLD} 55%, #9A7220 100%)`,
                            WebkitBackgroundClip: 'text',
                            backgroundClip: 'text',
                            color: 'transparent',
                        }}>
                        Membership
                    </h2>

                    <p className="mt-1 flex items-center gap-3 text-[0.75rem] font-bold uppercase
                                  tracking-[0.3em]" style={{ color: NAVY }}>
                        <span aria-hidden="true" className="h-px w-12"
                              style={{ background: `linear-gradient(90deg, transparent, ${GOLD})` }} />
                        {KICKER}
                        <span aria-hidden="true" className="h-px w-12"
                              style={{ background: `linear-gradient(90deg, ${GOLD}, transparent)` }} />
                    </p>

                    {/* ----------------------------------------------- the holder */}
                    <p className="mt-5 text-[0.9375rem]" style={{ color: MUTED }}>
                        This is to certify that
                    </p>

                    {/* The largest thing on the sheet and the reason it exists.
                        `break-words` because a member name is free text and one
                        long enough to overrun would otherwise push the panel off
                        its measure. */}
                    <p className="mt-0.5 break-words font-certificate text-[2.625rem] font-bold
                                  leading-tight" style={{ color: INK }}>
                        {member.name || '—'}
                    </p>

                    <p className="mx-auto mt-3 max-w-[34rem] text-[0.9375rem] leading-[1.7]"
                       style={{ color: MUTED }}>
                        is a registered{' '}
                        <span className="font-extrabold uppercase tracking-[0.14em]"
                              style={{ color: NAVY }}>
                            member
                        </span>{' '}
                        of the {ASSOCIATION_NAME}.
                    </p>

                    {/* ------------------------------------------- the facts panel */}
                    {/*
                      TWO COLUMNS, not a row of five along the foot.

                      `divide-*` rather than a border on each cell: per-cell
                      borders double up at every join, so the rule between two
                      cells prints at twice the weight of the ones at the ends.
                    */}
                    <dl className="mt-5 grid w-full grid-cols-2 divide-x divide-y overflow-hidden
                                   rounded-lg border text-left"
                        style={{ borderColor: 'rgba(28,46,104,0.14)', ['--tw-divide-opacity' as never]: 1 }}>
                        {facts.map((f) => (
                            <div key={f.label} style={{ borderColor: 'rgba(28,46,104,0.14)' }}>
                                <Fact label={f.label} value={f.value} />
                            </div>
                        ))}
                    </dl>

                    {/* ------------------------------------------- the region band */}
                    {place.length ? (
                        <div className="mt-3 flex w-full items-stretch rounded-lg"
                             style={{ background: 'rgba(28,46,104,0.05)' }}>
                            {place.map((cell, i) => (
                                <div key={cell.label} className="flex flex-1 items-stretch">
                                    {i > 0 ? (
                                        <span className="w-px shrink-0"
                                              style={{ background: `linear-gradient(180deg, transparent, ${GOLD}, transparent)` }}
                                              aria-hidden="true" />
                                    ) : null}
                                    <div className="flex-1 px-4 py-2.5 text-center">
                                        <p className="text-[0.625rem] font-bold uppercase tracking-[0.18em]"
                                           style={{ color: GOLD }}>
                                            {cell.label}
                                        </p>
                                        <p className="mt-0.5 truncate text-[1rem] font-bold"
                                           style={{ color: INK }}>
                                            {cell.value}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>

                {/* ================================================== the foot */}
                {/*
                  The strapline on the left, as the template has it; the
                  signature and the code on the right, on one baseline.
                */}
                <div className="relative z-10 flex items-end justify-between gap-8 px-32 pb-7 pt-4">
                    <div className="shrink-0">
                        <span className="mb-2 block h-px w-14"
                              style={{ background: `linear-gradient(90deg, ${GOLD}, transparent)` }}
                              aria-hidden="true" />
                        {STRAPLINE.map((line) => (
                            <p key={line} className="font-certificate text-[0.9375rem] italic leading-[1.45]"
                               style={{ color: NAVY }}>
                                {line}
                            </p>
                        ))}
                    </div>

                    <div className="flex items-end gap-8">
                        <div className="w-44">
                            <SignatureInk className="h-10" />
                            <span className="-mt-1 block h-px w-full" style={{ background: MUTED }}
                                  aria-hidden="true" />
                            <p className="mt-1.5 whitespace-nowrap text-center text-[0.6875rem]
                                          font-bold uppercase tracking-[0.16em]" style={{ color: INK }}>
                                {SIGNATORY.title || 'Authorised signatory'}
                            </p>
                            <p className="text-center text-[0.625rem] font-semibold uppercase
                                          tracking-[0.14em]" style={{ color: MUTED }}>
                                ACTIV
                            </p>
                        </div>

                        <div className="shrink-0 text-center">
                            <CertificateQr
                                className="h-[3.75rem] w-[3.75rem] rounded-[3px]"
                                color={NAVY_DEEP}
                                value={verificationPayload({
                                    reference: cert.reference || '',
                                    name: member.name || '',
                                    membershipNumber: member.membershipNumber || '',
                                    validUntil,
                                })}
                            />
                            <p className="mt-1.5 text-[0.5625rem] font-bold uppercase tracking-[0.14em]"
                               style={{ color: MUTED }}>
                                Scan to verify
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </CertificateSheet>
    );
}

/*
 * ============================================================================
 * THE HEIGHT BUDGET
 * ============================================================================
 *
 * A4 landscape is 793.7px at 96dpi and `onePage` pins the printed height to it.
 * An overflow does NOT show on screen — it shows as a second sheet coming out
 * of the printer carrying the overflow and nothing else.
 *
 * `CertificateFrame` is drawn against a 1123 x 794 viewBox, so its coordinates
 * are page pixels and the frame and the sheet are two halves of one number.
 *
 * The check is that the rendered article measures 1122.5 x 793.7px, or that a
 * `Page.printToPDF` comes back one page. `npx vite build` will not tell you.
 */
