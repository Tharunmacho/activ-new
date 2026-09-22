import { CertificateSeal, CertificateSheet, ASSOCIATION_NAME } from './CertificateSheet';
import type { Certificate } from '@/services/activApi';

/**
 * ============================================================================
 * THE TAX EXEMPTION AND MEMBERSHIP CERTIFICATES
 * ============================================================================
 *
 * Both print on `CertificateSheet`, the sheet typeset from the association's own
 * 80G document: the mark, the full name, the corporate office, the three
 * contact facts, and the PAN and 80G registration in the foot. The association
 * asked for exactly that — “see the content, how the tax certificate is there”
 * — and it is the right answer for a second reason: a certificate that does not
 * carry the association's registrations is a decorated letter, and this one is
 * handed to a tax officer.
 *
 * ---------------------------------------------------- what was wrong before
 *
 * The old sheet was a green 10px border round a white page. Everything a reader
 * looks for before reading a word of a certificate was missing from it: no
 * letterhead beyond the mark, no address, no registrations, no seal, and a
 * body that ran from edge to edge with nothing marking it as a document rather
 * than a printed screen. It also carried an empty ruled line labelled
 * “Authorised Signatory”, which on a document nobody signs is an invitation to
 * sign it by hand.
 *
 * What replaces the ruled line is the SEAL, and the sentence beside it. A seal
 * is the mark of the issuing body and is not a person's assent, so a drawn one
 * is honest where a scanned signature would not be.
 *
 * ---------------------------------------------------------------- the facts
 *
 * Nine of them, and the region is THREE of the nine rather than one.
 * “Ariyalur, Ariyalur, Tamil Nadu” repeats a word and labels nothing — a reader
 * cannot tell which is the block and which the district, and in this
 * association they are very often the same word.
 *
 * VALID UNTIL comes from the server. A lifetime membership prints “Lifetime”,
 * never an invented date, and a claim about status with no end on it reads as a
 * permanent one — which an annual membership is not.
 */

const KINDS: Record<string, { heading: string; seal: string }> = {
    membership: { heading: 'Certificate of Membership', seal: 'Membership' },
    'tax-exemption': { heading: 'Tax Exemption Certificate', seal: 'Tax Exemption' },
};

const formatDate = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? ''
        : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

const yearOf = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : String(d.getFullYear());
};

export default function MemberCertificate({ cert }: { cert: Certificate }) {
    const kind = KINDS[cert.kind] || KINDS.membership;
    const { member } = cert;

    /*
     * “Lifetime” ONLY WHEN THE SERVER GAVE NO END DATE.
     *
     * It used to read `membershipType` alone, which is right for the membership
     * certificate and wrong for the tax one: a lifetime member's exemption is
     * still claimed one financial year at a time, so the server sends a real 31
     * March date for it. Printing “Lifetime” over the top of that would put a
     * claim nobody made on a document a tax officer reads.
     */
    const lifetime = cert.membershipType === 'lifetime' && !cert.validUntil;
    const validUntil = lifetime ? 'Lifetime' : formatDate(cert.validUntil);

    /*
     * Every cell the certificate can carry, in reading order, with the empty
     * ones dropped. Built as data so the grid is not a wall of conditional JSX
     * — which is how the region ended up collapsed into one string before.
     */
    const facts: { label: string; value: string; wide?: boolean }[] = [
        /* “Membership no.”, not “Membership number”: the long form wrapped in
           a third of the panel's width and pushed its value onto a third line,
           so the first cell of the table stood two lines taller than the two
           beside it. */
        { label: 'Membership no.', value: member.membershipNumber || '' },
        {
            label: 'Membership type',
            value: cert.membershipType
                ? `${cert.membershipType[0].toUpperCase()}${cert.membershipType.slice(1)}`
                : '',
        },
        { label: 'Member since', value: formatDate(cert.memberSince) },
        { label: 'Block', value: member.block || '' },
        { label: 'District', value: member.district || '' },
        { label: 'State', value: member.state || '' },
        { label: 'Issued on', value: formatDate(cert.issuedAt) },
        { label: lifetime ? 'Validity' : 'Valid until', value: validUntil },
        /* Only the tax certificate carries one, and it is the form the year is
           actually quoted in — “Valid until 31 March 2027” is the date, and
           “2026-27” is what goes on the return. */
        { label: 'Financial year', value: cert.financialYear || '' },
        { label: 'Reference', value: cert.reference || '', wide: true },
    ].filter((f) => !!f.value);

    return (
        <CertificateSheet
            decorated
            footNote={
                <>
                    Issued electronically — valid without a signature, and verifiable
                    against the reference above
                </>
            }
        >
            {/* ------------------------------------------------------- title */}
            <div className="text-center">
                {/*
                  A rule, the words, a rule — the oldest way of setting a
                  certificate's title and still the one that reads as one. The
                  diamond between the rule and the words stops the two hairlines
                  looking like the top and bottom of a table.
                */}
                <div className="flex items-center justify-center gap-3">
                    <span aria-hidden="true" className="h-px w-12 bg-brand-800/35 sm:w-20" />
                    <span aria-hidden="true" className="text-[0.75rem] text-brand-800/50">◆</span>
                    {/* The short name. It printed the FIRST WORD of the full
                        one — “Adidravidar”, alone, which is not a thing anybody
                        calls the association. */}
                    <p className="text-[1.0625rem] font-bold uppercase tracking-[0.3em] text-brand-800/70">
                        ACTIV
                    </p>
                    <span aria-hidden="true" className="text-[0.75rem] text-brand-800/50">◆</span>
                    <span aria-hidden="true" className="h-px w-12 bg-brand-800/35 sm:w-20" />
                </div>

                {/* `font-display`, which on this site IS Poppins — the face the
                    association chose for the whole product. `font-serif` named no
                    key in the config and so resolved to Tailwind's stock Georgia
                    stack: a document in a face that appears nowhere else. */}
                <h2 className="mt-4 font-display text-[2.125rem] leading-tight tracking-tight
                               text-brand-800 sm:text-[2.625rem] print:mt-2 print:text-[1.875rem]">
                    {cert.title || kind.heading}
                </h2>
            </div>

            {/* -------------------------------------------------- the holder */}
            <p className="mt-9 text-center text-[1.25rem] text-gray-500 print:mt-4 print:text-[1.125rem]">
                This is to certify that
            </p>

            {/*
              The holder's name is the largest thing on the page and the reason
              it exists. It takes the display face and a letterspace, and it
              sits on its own rule rather than floating in the middle of the
              sheet — a name with nothing under it reads as a heading.
            */}
            <p className="mt-2 text-center font-display text-[2.375rem] font-semibold
                          leading-tight text-brand-900 sm:text-[3rem] print:text-[2rem]">
                {member.name || '—'}
            </p>

            {member.membershipNumber ? (
                <p className="mt-2 text-center text-[1.125rem] font-semibold uppercase
                              tracking-[0.18em] text-gray-400">
                    {member.membershipNumber}
                </p>
            ) : null}

            <div className="mx-auto mt-5 flex max-w-sm items-center gap-3 print:mt-2">
                <span aria-hidden="true" className="h-px flex-1 bg-brand-800/20" />
                <span aria-hidden="true" className="text-[0.625rem] text-brand-800/40">❖</span>
                <span aria-hidden="true" className="h-px flex-1 bg-brand-800/20" />
            </div>

            {/* ---------------------------------------------------- the claim */}
            <p className="mx-auto mt-6 max-w-xl text-center text-[1.25rem] leading-[1.85] text-gray-700
                          print:mt-3 print:max-w-2xl print:text-[1.0625rem]
                          print:leading-[1.55]">
                {cert.body}
            </p>

            {/*
              THREE TO A ROW, on a ruled panel.

              Two columns left half the width empty on a document whose whole
              lower third is these nine facts, and put Block and District on a
              different row from State. Three columns fit the region triplet on
              one line where it reads as one answer, and the tinted panel makes
              the block a table rather than a scatter of labels.
            */}
            {/*
              A SPINE DOWN THE LEFT EDGE, and square corners on that side.

              It was a rounded box with a hairline all the way round, which is a
              UI component — the same shape as every card on every screen in
              this product. A solid bar of the association's ink down one edge
              makes it part of the DOCUMENT, and it is the one place on the sheet
              where the navy sits against the facts a reader is checking.

              OPAQUE, and that part is load-bearing: at `bg-brand-50/50` the
              sheet's own background came through the middle of the table and
              read as a printing fault across “Membership type / Annual”.
            */}
            <dl className="mt-9 grid grid-cols-2 gap-x-5 gap-y-6 rounded-r-xl border-y border-r
                           border-brand-800/15 border-l-[5px] border-l-brand-800
                           bg-brand-50 px-6 py-6 sm:grid-cols-3 sm:px-8
                           print:mt-4 print:gap-x-4 print:gap-y-3 print:py-3">
                {facts.map((fact) => (
                    <div key={fact.label} className={fact.wide ? 'col-span-2 sm:col-span-3' : ''}>
                        <dt className="text-[1rem] font-bold uppercase tracking-[0.08em] text-gray-500
                                       print:text-[0.875rem]">
                            {fact.label}
                        </dt>
                        {/*
                          THE MEMBERSHIP NUMBER IS THE LONGEST THING IN A THIRD OF
                          A PANEL, and every size here is set against it measured
                          rather than guessed.

                            on screen   cell 193px, “ACTIV-2026-203092” wants 181
                            in print    cell 186px, and it wants 151 at 15px

                          It has been two lines twice: at 19px, and then again at
                          16px, where the cell came out at 162px and the text
                          wanted 161 — one pixel of headroom, which sub-pixel
                          rounding is enough to take away. A cell that wraps
                          stands two lines taller than the two beside it and the
                          row is visibly out of level, which is the whole reason
                          this is written down.
                        */}
                        <dd className={`mt-1 text-[1.125rem] font-semibold tabular-nums text-brand-900
                                       print:mt-0.5 print:text-[0.9375rem] ${
                            fact.wide ? 'break-words' : ''
                        }`}>
                            {fact.value}
                        </dd>
                    </div>
                ))}
            </dl>

            {/* ----------------------------------------------- seal and issuer */}
            <div className="mt-9 flex flex-wrap items-center justify-between gap-6 print:mt-4">
                <CertificateSeal line={kind.seal} year={yearOf(cert.issuedAt)} />

                {/*
                  WHAT THE OLD SHEET GOT WRONG, and the reason there is no ruled
                  line here.

                  It printed an empty rule labelled “Authorised Signatory”. On a
                  document nobody signs, a blank line under that label is an
                  invitation to sign it by hand — and a certificate a member can
                  complete themselves is not a certificate. The seal is the mark
                  of the issuing body, which is what this document actually has,
                  and the lines beside it say who issued it and how to check it.
                */}
                <div className="min-w-0 max-w-sm text-right">
                    <p className="text-[1.0625rem] font-bold uppercase tracking-[0.12em] text-gray-400
                                  print:text-[0.875rem]">
                        Issued by
                    </p>
                    <p className="mt-1 text-[1.1875rem] font-semibold leading-snug text-brand-900
                                  print:text-[1.0625rem]">
                        {cert.issuedBy || ASSOCIATION_NAME}
                    </p>
                    <p className="mt-2 text-[1.0625rem] leading-relaxed text-gray-500
                                  print:mt-1 print:text-[0.875rem]">
                        Issued under the seal of the association.
                    </p>
                </div>
            </div>
        </CertificateSheet>
    );
}
