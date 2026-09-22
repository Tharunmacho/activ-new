/*
 * The letterhead and the registration foot moved to `CertificateSheet`.
 *
 * They were written here first, against this one document, with a note saying
 * the association's next words were “once that is good we will do the other
 * certificates”. That has now happened — the tax exemption and membership
 * certificates print on the same sheet — so it is a file of its own rather
 * than something a second certificate has to import out of the first.
 */
import CertificateSheet from './CertificateSheet';

export { CertificateSheet };

/**
 * ============================================================================
 * THE 80G DONATION CERTIFICATE
 * ============================================================================
 *
 * Typeset from the association's own document — the one issued to a member
 * against a ₹10,000 contribution — with its wording kept exactly and its
 * layout rebuilt so the parts line up.
 *
 * Poppins throughout: `font-sans` on this site IS Poppins (see
 * `tailwind.config.ts`), so nothing here names a face. A certificate that
 * picked its own font would drift from the site the first time the site's
 * changed.
 *
 * ------------------------------------------------------------------- shape
 *
 * Three bands, because a certificate is read in three passes:
 *
 *   the LETTERHEAD   who issued it — logo, name, address, how to reach them
 *   the BODY         what it certifies, and the payments behind the figure
 *   the FOOT         the registrations that make it worth anything to a tax
 *                    officer: the association's PAN and its 80G number
 *
 * `CertificateSheet` holds the first and third, because they are the same on
 * every certificate this association issues. The association's next words on
 * the subject were "once that is good we will do the other certificates", so
 * the shell is separate from the day it is written rather than extracted later
 * from two copies that have already drifted.
 *
 * --------------------------------------------------------------- on paper
 *
 * Sized to A4 and printable from the browser: `print:` strips the screen
 * chrome, the shadow and the page tint, and `print-color-adjust` keeps the
 * header band's fill — a certificate that prints its rules and tints as white
 * reads as a draft.
 */

/* -------------------------------------------------------------- the data */

export interface CertificatePayment {
    /** As it should be PRINTED — "02-05-2025". Never an ISO string. */
    date: string;
    /** In rupees. Formatted here, so every row is formatted the same way. */
    amount: number;
    /** "NEFT", "UPI", "Cheque", "Cash". */
    mode: string;
}

export interface DonationCertificateData {
    /** "ACTIV-80G-2025-05-001" */
    certificateNo: string;
    /** The date on the certificate, as printed. */
    issuedOn: string;
    /** "2025-2026" */
    financialCycle: string;

    donorName: string;
    /** The donor's own PAN. Omitted from the sentence when absent. */
    donorPan?: string;

    payments: CertificatePayment[];

    /** The association's registrations. Defaulted, because they rarely change. */
    associationPan?: string;
    registration80G?: string;
}

/* ------------------------------------------------------------- formatting */

/**
 * `₹ 10,000.00`.
 *
 * Two decimals always. A receipt that prints "₹ 10,000" beside one that prints
 * "₹ 10,000.50" reads as two different kinds of figure, and this column is
 * added up by somebody.
 */
const rupees = (value: number) =>
    `₹ ${Number(value || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

/* ------------------------------------------------------------- the content */

export function DonationCertificate({ data }: { data: DonationCertificateData }) {
    const total = (data.payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);

    return (
        <CertificateSheet
            associationPan={data.associationPan}
            registration80G={data.registration80G}
        >
            {/* ----------------------------------------------------- title */}
            <div className="text-center">
                <h2 className="text-[1.75rem] font-extrabold tracking-tight text-brand-800
                               sm:text-[2rem]">
                    Member’s Donation Certificate
                </h2>
                <p className="mt-1 text-[1.1875rem] font-semibold text-gray-500">
                    Financial cycle {data.financialCycle}
                </p>
            </div>

            {/*
              THE REFERENCE AND THE DATE, on one rule.

              In the original these were two loose lines. They are the two
              things quoted back when somebody rings about this certificate, so
              they are given a band of their own, apart and labelled.
            */}
            <div className="mt-7 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2
                            border-y border-gray-200 py-3.5">
                <p className="text-[1.1875rem]">
                    <span className="font-bold uppercase tracking-[0.08em] text-gray-500">
                        Certificate no.
                    </span>{' '}
                    <span className="font-semibold tabular-nums text-brand-900">
                        {data.certificateNo}
                    </span>
                </p>
                <p className="text-[1.1875rem]">
                    <span className="font-bold uppercase tracking-[0.08em] text-gray-500">
                        Date
                    </span>{' '}
                    <span className="font-semibold tabular-nums text-brand-900">
                        {data.issuedOn}
                    </span>
                </p>
            </div>

            {/* ------------------------------------------------ the sentence */}
            <p className="mt-7 text-[1.25rem] leading-[1.75] text-brand-900">
                This is to certify that the{' '}
                <span className="font-semibold">
                    Adidravidar Confederation of Trade and Industrial Vision (ACTIV)
                </span>{' '}
                has received{' '}
                {/* The figure set apart from the sentence it sits in: it is the
                    one thing on this page a reader is looking for. */}
                <span className="font-extrabold tabular-nums text-brand-800">{rupees(total)}</span>{' '}
                from <span className="font-semibold">{data.donorName}</span>
                {data.donorPan ? (
                    <>
                        {' '}(PAN{' '}
                        <span className="font-semibold tabular-nums">{data.donorPan}</span>)
                    </>
                ) : null}
                , as per the payments below.
            </p>

            {/* -------------------------------------------------- the table */}
            <table className="mt-6 w-full border-collapse text-[1.1875rem]">
                <thead>
                    <tr className="bg-brand-800 text-white print:bg-brand-800">
                        {/* `whitespace-nowrap`: "S. no." broke after the full
                            stop and made the header band two lines tall for one
                            line of text. */}
                        <th className="w-20 whitespace-nowrap px-4 py-2.5 text-left font-bold
                                       uppercase tracking-[0.06em]">
                            S. no.
                        </th>
                        <th className="px-4 py-2.5 text-left font-bold uppercase tracking-[0.06em]">
                            Date
                        </th>
                        <th className="px-4 py-2.5 text-right font-bold uppercase tracking-[0.06em]">
                            Amount
                        </th>
                        <th className="px-4 py-2.5 text-left font-bold uppercase tracking-[0.06em]">
                            Mode
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {(data.payments || []).map((payment, i) => (
                        <tr
                            key={`${payment.date}-${i}`}
                            className="border-b border-gray-200 last:border-b-0"
                        >
                            <td className="px-4 py-3 tabular-nums text-gray-500">{i + 1}</td>
                            <td className="px-4 py-3 tabular-nums font-medium">{payment.date}</td>
                            <td className="px-4 py-3 text-right font-semibold tabular-nums">
                                {rupees(payment.amount)}
                            </td>
                            <td className="px-4 py-3 font-medium">{payment.mode}</td>
                        </tr>
                    ))}
                </tbody>

                {/*
                  A TOTAL ROW, and it is not in the original.

                  With one payment the figure in the sentence and the figure in
                  the table are the same number printed twice; with three they
                  are not, and a reader has to add the column up to check the
                  sentence. The row does that where the eye already is.
                */}
                {(data.payments || []).length > 1 && (
                    <tfoot>
                        <tr className="border-t-2 border-brand-800">
                            <td colSpan={2} className="px-4 py-3 text-right font-bold
                                                       uppercase tracking-[0.06em] text-gray-500">
                                Total
                            </td>
                            <td className="px-4 py-3 text-right text-[1.3125rem] font-extrabold
                                           tabular-nums text-brand-800">
                                {rupees(total)}
                            </td>
                            <td />
                        </tr>
                    </tfoot>
                )}
            </table>

            {/* ------------------------------------------------- the thanks */}
            <p className="mt-8 text-[1.25rem] leading-[1.75] text-gray-600">
                We thank you for contributing to the Adidravidar Confederation of Trade and
                Industrial Vision and for supporting our work.
            </p>
        </CertificateSheet>
    );
}

export default DonationCertificate;
