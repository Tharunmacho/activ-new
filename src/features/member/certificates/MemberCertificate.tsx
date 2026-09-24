import MembershipCertificate from './MembershipCertificate';
import TaxExemptionCertificate from './TaxExemptionCertificate';
import type { Certificate } from '@/services/activApi';

/**
 * Which certificate to draw.
 *
 * ============================================================================
 * THE TWO ARE SEPARATE DOCUMENTS NOW, AND THIS FILE IS ALL THAT IS LEFT OF
 * THEIR HAVING BEEN ONE
 * ============================================================================
 *
 * It used to render both from one layout with a swapped heading and seal
 * caption, and everything the association objected to followed from that:
 *
 *   - the tax certificate carried the member's BLOCK, DISTRICT and STATE, three
 *     facts a tax officer has no use for, two of which are usually the same
 *     word in this association;
 *   - it carried "Valid until 31 March 2027" beside "Financial year 2026-27",
 *     which is one fact printed twice, and the first spelling reads as an
 *     expiry on the exemption rather than as the year it is claimed against;
 *   - and the membership certificate — a statement about who somebody is, with
 *     no money in it anywhere — carried the association's PAN and 80G
 *     registration in its foot.
 *
 * A shared layout could not fix any of that, because every one of them is a
 * question of what the document is FOR. So there are two now:
 *
 *              MEMBERSHIP                     TAX EXEMPTION
 *     paper    A4 landscape                   A5 portrait
 *     frame    rosette band, gold + navy      none
 *     head     mark and name, one line        mark, name, office, PAN, 80G
 *     body     the holder, very large         seven labelled facts
 *     foot     cert no / issued / valid       statement, seal, signature
 *     signed   chairman                       chairman
 *
 * They share the mark, the seal, the signature and the association's name, and
 * nothing else. `CertificateSheet` still holds those, the paper sizes and the
 * `@page` rules.
 *
 * ---------------------------------------------------------------- the default
 *
 * An unknown kind draws the MEMBERSHIP certificate. The route's own default is
 * `membership`, and of the two this is the one that states nothing to a tax
 * authority — so a kind nobody anticipated produces a document that over-claims
 * the least.
 */
export default function MemberCertificate({ cert }: { cert: Certificate }) {
    return cert?.kind === 'tax-exemption'
        ? <TaxExemptionCertificate cert={cert} />
        : <MembershipCertificate cert={cert} />;
}
