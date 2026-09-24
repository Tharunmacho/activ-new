import { CertificateSheet, SignatureInk, SIGNATORY, ASSOCIATION_NAME } from './CertificateSheet';
import { CertificateMedallion, GOLD, GOLD_LIGHT, GOLD_PALE } from './CertificateMedallion';
import { CertificateQr, verificationPayload } from './CertificateMarks';
import { CertificateWaves } from './CertificateWaves';
import type { Certificate } from '@/services/activApi';

/**
 * ============================================================================
 * THE TAX EXEMPTION CERTIFICATE — A4 PORTRAIT, NAVY, WAVE FRAME
 * ============================================================================
 *
 *   +--------------------------------------+
 *   | ~~wave                       wave~~  |
 *   |  [MARK]        Empowering ...        |
 *   |                                      |
 *   |        CERTIFICATE OF                |
 *   |        TAX EXEMPTION                 |
 *   |   --- UNDER SECTION 80G ---          |
 *   |                                      |
 *   |      This is to certify that         |
 *   |            Tharun .v                 |
 *   |       (o) Ariyalur, Tamil Nadu       |
 *   |   ...has contributed to ACTIV and    |
 *   |   the contribution is eligible...    |
 *   |                                      |
 *   |   +------------------------------+   |
 *   |   | Certificate no.   ACTIV-...  |   |
 *   |   | Financial year    2026-27    |   |
 *   |   | Membership no.    ACTIV-...  |   |
 *   |   | Amount            Rs 5,000   |   |
 *   |   +------------------------------+   |
 *   |   [ PAN ]            [ 80G reg. ]    |
 *   |                                      |
 *   |  ISSUE DATE   [ink]   [QR]   (SEAL)  |
 *   | ~~ TOGETHER FOR A STRONGER TOMORROW  |
 *   +--------------------------------------+
 *
 * -------------------------------------------- what came off, and why
 *
 * The sheet this replaced carried FOURTEEN rows and the association's verdict
 * was that most of them were not doing anything. They were right, and the test
 * that removed each one is the same: does the reader need it, given everything
 * else on the page.
 *
 *   NAME OF THE REPORTING ENTITY      the mark is at the top of the sheet
 *   ADDRESS OF THE REPORTING ENTITY   likewise, and it ran to two lines
 *   ADDRESS OF THE MEMBER             their region is under their name already
 *   IDENTIFICATION CODE               it only ever said what the row above it
 *                                     obviously was
 *   TYPE OF CONTRIBUTION              the document says what it certifies in
 *                                     its own title
 *   SECTION UNDER WHICH ISSUED        the title says "under Section 80G", and
 *                                     so does the sentence
 *
 * What is left is what a reader actually checks: the certificate number, the
 * year, who it is for, how much, and the association's two registrations. Five
 * rows and a registration band.
 *
 * THE PAN AND THE 80G NUMBER ARE NOT ROWS. They are the association's standing
 * credentials rather than facts about this certificate, so they sit in their own
 * band under the schedule — which is also where the association's own paper
 * receipt puts them.
 *
 * ------------------------------------------------ THERE IS NO "VALID TILL"
 *
 * It has come off three times now and the reason has not changed: an exemption
 * is claimed against a FINANCIAL YEAR, and the year is in the schedule. "Valid
 * till 17 September 2027" beside "Financial year 2026-27" is one fact written
 * twice, and the first spelling reads as an expiry on the exemption itself,
 * which is not a thing that expires on a date the association chose. The
 * membership certificate keeps its expiry, because there the date answers a
 * real question.
 *
 * ---------------------------------------------- the pair, side by side
 *
 *     MEMBERSHIP                      TAX EXEMPTION
 *     A4 landscape                    A4 portrait
 *     layered corner ribbons          wave frame, weighted to the foot
 *     one name, very large            a name and then five facts
 *     issue + expiry                  issue only
 *
 * Both are navy and gold and both carry the mark, the medallion and the ink.
 * The ORIENTATION is what tells them apart at arm's length, which is the
 * distance at which somebody picks up the wrong one.
 *
 * ---------------------------------------------------------- what is on it
 *
 * Every row is a fact the server sent. NOTHING HERE IS INVENTED:
 *
 *   AMOUNT is dropped when the platform has no record of it. `paymentAmount`
 *   was undeclared on the member schema for a long window and Mongoose strict
 *   mode dropped it on every payment in that window, so a member activated then
 *   has a paid membership and no sum on file. A plausible figure on a tax
 *   document is worse than a missing row: the row can be asked about, the
 *   figure gets reconciled against books it was never in.
 *
 * ---------------------------------------------------------------- on paper
 *
 * 210 x 297mm, and `CertificateSheet` emits the matching `@page`. `bleed`, so
 * the waves reach the paper edges; the content takes its own padding.
 *
 * 210mm is 794px at 96dpi and that is what the browser lays out, so screen and
 * paper are the same size and nothing here carries a `print:` type size. The
 * height budget is at the foot of the file.
 */

const NAVY = 'hsl(var(--brand-800))';
const NAVY_DEEP = '#0E1F4D';
const INK = 'hsl(var(--brand-900))';
const MUTED = '#6B7A9C';
const PAPER = '#FCFDFF';

const ASSOCIATION_PAN = 'AAITA2239D';
const REGISTRATION_80G = 'AAITA2239DF20210';
const SHORT_NAME = 'ACTIV';
const PROMISE = ['Empowering Communities', 'Building Opportunities', 'Growing Together'];
const STRAPLINE = 'Together for a stronger tomorrow';

const formatDate = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? ''
        : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

/**
 * Rupees, grouped the Indian way.
 *
 * `en-IN` puts the separators at 1,00,000 rather than 100,000 — the only
 * grouping that reads as a sum of money to the person handed this document.
 */
const rupees = (amount: number) =>
    `₹ ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ------------------------------------------------------------- the furniture */

/** One fact of the schedule. Label left, value right, on an alternating band. */
function Row({ label, value, tint }: { label: string; value: string; tint: boolean }) {
    return (
        <div className="grid grid-cols-[11.5rem_1fr] gap-4 px-5 py-2.5"
             style={tint ? { background: 'rgba(28,46,104,0.04)' } : undefined}>
            <dt className="text-[0.8125rem] leading-snug" style={{ color: MUTED }}>{label}</dt>
            <dd className="text-[0.8125rem] font-bold leading-snug" style={{ color: INK }}>{value}</dd>
        </div>
    );
}

/** One of the association's standing registrations, in the band under the schedule. */
function Credential({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex-1 text-center">
            <p className="text-[0.625rem] font-bold uppercase tracking-[0.16em]" style={{ color: MUTED }}>
                {label}
            </p>
            <p className="mt-1 text-[0.9375rem] font-extrabold tabular-nums" style={{ color: INK }}>
                {value}
            </p>
        </div>
    );
}

export default function TaxExemptionCertificate({ cert }: { cert: Certificate }) {
    const member = cert.member || ({} as Certificate['member']);
    const contribution = cert.contribution || null;

    /* The member's region, with a repeated level dropped: the block and the
       district are very often the same word here, and "Ariyalur, Ariyalur,
       Tamil Nadu" reads as a typesetting fault rather than as two answers. */
    const address = (member?.isInternational
        /* Outside India: the place the member gave, then the country. */
        ? [member?.place, member?.country]
        : [member?.block, member?.district, member?.state])
        .filter((part, i, all) => !!part && all.indexOf(part) === i)
        .join(', ');

    /* Five facts, and an empty one is dropped rather than printing a label with
       nothing beside it. */
    const facts = [
        { label: 'Certificate number', value: cert.reference || '' },
        { label: 'Date of issue', value: formatDate(cert.issuedAt) },
        { label: 'Financial year', value: cert.financialYear || '' },
        { label: 'Membership number', value: member.membershipNumber || '' },
        {
            label: 'Amount of contribution',
            value: typeof contribution?.amount === 'number' ? rupees(contribution.amount) : '',
        },
    ].filter((r) => !!r.value);

    return (
        <CertificateSheet size="a4" bleed onePage letterhead={false} registrations={false} footNote={null}>
            <div className="relative flex w-full flex-1 flex-col overflow-hidden"
                 style={{ background: PAPER, color: INK }}>

                <CertificateWaves navy={NAVY} deep={NAVY_DEEP} />

                {/* ================================================== the head */}
                <header className="relative z-10 flex items-start justify-between gap-6 px-14 pt-14">
                    <img
                        src="/logo_ACTIVian-removebg-preview.png"
                        alt={ASSOCIATION_NAME}
                        className="h-[3.5rem] w-auto shrink-0 object-contain"
                    />
                    <div className="shrink-0 pt-1 text-right">
                        {PROMISE.map((line) => (
                            <p key={line} className="text-[0.8125rem] font-semibold leading-[1.5]"
                               style={{ color: NAVY }}>
                                {line}
                            </p>
                        ))}
                    </div>
                </header>

                {/* ================================================== the body */}
                <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-14 py-4
                                text-center">

                    <p className="text-[1.25rem] font-semibold uppercase tracking-[0.36em]"
                       style={{ color: INK }}>
                        Certificate of
                    </p>

                    {/* The one gold-filled line on the sheet, and the reason the
                        rest of the title is navy: two gold headings compete and
                        neither wins. */}
                    <h2 className="mt-0.5 font-certificate text-[2.875rem] font-bold leading-[1.08]"
                        style={{
                            background: `linear-gradient(180deg, ${GOLD_PALE} 0%, ${GOLD} 55%, #9A7220 100%)`,
                            WebkitBackgroundClip: 'text',
                            backgroundClip: 'text',
                            color: 'transparent',
                        }}>
                        Tax Exemption
                    </h2>

                    <p className="mt-2 flex items-center justify-center gap-3 text-[0.75rem] font-bold
                                  uppercase tracking-[0.26em]" style={{ color: NAVY }}>
                        <span aria-hidden="true" className="h-px w-12"
                              style={{ background: `linear-gradient(90deg, transparent, ${GOLD})` }} />
                        Under Section 80G · Income Tax Act, 1961
                        <span aria-hidden="true" className="h-px w-12"
                              style={{ background: `linear-gradient(90deg, ${GOLD}, transparent)` }} />
                    </p>

                    {/* ----------------------------------------------- the holder */}
                    <p className="mt-8 text-[0.9375rem]" style={{ color: MUTED }}>
                        This is to certify that
                    </p>

                    {/*
                      The member's name, in the serif. `break-words` because a
                      name is free text and one long enough to overrun would
                      otherwise push the schedule off its measure.
                    */}
                    <p className="mt-1 break-words font-certificate text-[2.5rem] font-bold
                                  leading-tight" style={{ color: INK }}>
                        {member.name || '—'}
                    </p>

                    {address ? (
                        <p className="mt-1 flex items-center justify-center gap-1.5 text-[0.9375rem]
                                      font-semibold" style={{ color: NAVY }}>
                            <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill={GOLD}
                                 aria-hidden="true">
                                <path d="M8 1a5 5 0 0 0-5 5c0 3.6 5 9 5 9s5-5.4 5-9a5 5 0 0 0-5-5zm0 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" />
                            </svg>
                            {address}
                        </p>
                    ) : null}

                    <p className="mx-auto mt-4 max-w-[30rem] text-[0.9375rem] leading-[1.75]"
                       style={{ color: MUTED }}>
                        has contributed to the {ASSOCIATION_NAME} ({SHORT_NAME}), and the contribution
                        is eligible for exemption under Section 80G of the Income Tax Act, 1961.
                    </p>

                    {/* ---------------------------------------------- the schedule */}
                    <dl className="mt-7 w-full overflow-hidden rounded-lg border text-left"
                        style={{ borderColor: 'rgba(28,46,104,0.15)' }}>
                        {facts.map((r, i) => (
                            <Row key={r.label} label={r.label} value={r.value} tint={i % 2 === 0} />
                        ))}
                    </dl>

                    {/*
                      THE REGISTRATIONS, in a band of their own.

                      They are the association's standing credentials rather than
                      facts about this certificate, and a reader checks them
                      first — so they are set apart from the schedule rather than
                      buried as two more rows in it. It is also where the
                      association's own paper receipt puts them.
                    */}
                    <div className="mt-4 flex w-full items-stretch gap-4 rounded-lg px-5 py-3"
                         style={{ background: 'rgba(28,46,104,0.05)' }}>
                        <Credential label={`${SHORT_NAME} PAN`} value={ASSOCIATION_PAN} />
                        <span className="w-px shrink-0"
                              style={{ background: `linear-gradient(180deg, transparent, ${GOLD}, transparent)` }}
                              aria-hidden="true" />
                        <Credential label="80G registration number" value={REGISTRATION_80G} />
                    </div>
                </div>

                {/* ================================================== the foot */}
                {/*
                  `items-end` on one baseline, the seal `shrink-0` so a long
                  signature block cannot squeeze it. The row sits above the wave
                  band, which carries the strapline and nothing else.
                */}
                <div className="relative z-10 flex items-end justify-between gap-6 px-14">
                    <div className="w-[12rem]">
                        <SignatureInk className="h-11" />
                        <span className="-mt-1 block h-px w-full" style={{ background: `${MUTED}` }}
                              aria-hidden="true" />
                        <p className="mt-1.5 whitespace-nowrap text-center text-[0.6875rem] font-bold
                                      uppercase tracking-[0.16em]" style={{ color: INK }}>
                            Authorised signatory
                        </p>
                        <p className="text-center text-[0.625rem] font-semibold uppercase
                                      tracking-[0.14em]" style={{ color: MUTED }}>
                            {SIGNATORY.title ? `${SIGNATORY.title}, ` : ''}{SHORT_NAME}
                        </p>
                    </div>

                    <div className="shrink-0 text-center">
                        <CertificateQr
                            className="h-[4.5rem] w-[4.5rem] rounded-[3px]"
                            color={NAVY_DEEP}
                            value={verificationPayload({
                                reference: cert.reference || '',
                                name: member.name || '',
                                membershipNumber: member.membershipNumber || '',
                                validUntil: cert.financialYear || '',
                            })}
                        />
                        <p className="mt-1.5 text-[0.5625rem] font-bold uppercase tracking-[0.14em]"
                           style={{ color: MUTED }}>
                            Scan to verify
                        </p>
                    </div>

                    <div className="shrink-0">
                        <CertificateMedallion line="80G Approved" className="h-[8rem] w-[8rem]" />
                    </div>
                </div>

                {/* ------------------------------------------------ the strapline */}
                {/* Inside the wave band, so it reads as printed on the ribbon
                    rather than as a line that happens to sit over it. */}
                <div className="relative z-10 flex h-[8rem] shrink-0 items-end justify-center px-14 pb-7">
                    <p className="text-[0.6875rem] font-bold uppercase tracking-[0.3em]"
                       style={{ color: GOLD_LIGHT }}>
                        {STRAPLINE}
                    </p>
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
 * A4 portrait is 1123px at 96dpi and `onePage` pins the printed height to it.
 * An overflow therefore does NOT show on screen — it shows as a second sheet
 * coming out of the printer carrying the overflow and nothing else.
 *
 * `CertificateWaves` is drawn against a 794 x 1123 viewBox, so its coordinates
 * are page pixels, and FOUR NUMBERS IN THIS FILE ARE TIED TO THEM:
 *
 *     the head's `pt-14`        clears the top waves, which stop at y=78/92
 *     the foot band `h-[8rem]`  owns the space below the trough at y=996
 *     the foot row's height     has to finish above that trough
 *     the sheet's 1123          is the viewBox itself
 *
 * Change the sheet's height and the waves no longer meet their text — they are
 * two halves of one number.
 *
 * The check is that the rendered article measures 794 x 1123px, or that a
 * `Page.printToPDF` comes back one page. `npx vite build` will not tell you.
 */
