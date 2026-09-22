import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { getCertificate, errorMessage, type Certificate } from '@/services/activApi';
import MemberCertificate from '@/features/member/certificates/MemberCertificate';

/**
 * A member's certificate, laid out to be printed.
 *
 * THE PAGE IS THE CHROME AND NOTHING ELSE. The certificate itself is
 * `MemberCertificate`, printed on the shared `CertificateSheet` — the same
 * letterhead and registration foot the association's own 80G document carries,
 * so the three certificates cannot drift apart. This file fetches, handles the
 * two failures, and puts a Print button above it.
 *
 * The server returns the fields and no PDF. Generating one server-side would
 * mean a rendering dependency and a font bundle, to produce a document whose
 * only purpose is to be printed — when the browser already prints and already
 * offers “Save as PDF” in the same dialog.
 *
 * The `print:` classes are what make that work: the back link, the button and
 * the page tint are hidden on paper, so what prints is the certificate alone
 * rather than a screenshot of a web page.
 */

export default function CertificatePage() {
    const { kind = 'membership' } = useParams();
    const navigate = useNavigate();

    const [cert, setCert] = useState<Certificate | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError('');

        getCertificate(kind as 'membership' | 'tax-exemption')
            .then((data) => { if (!cancelled) setCert(data); })
            .catch((err) => {
                // The server refuses with 403 when the membership is not active,
                // and that refusal is the answer the member needs — showing a
                // blank certificate instead would hide the reason.
                if (!cancelled) setError(errorMessage(err, 'This certificate could not be issued'));
            })
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [kind]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center gap-3 text-[1.25rem] text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Preparing your certificate…
            </div>
        );
    }

    if (error || !cert) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
                <AlertCircle className="h-10 w-10 text-amber-500" />
                <p className="max-w-md text-[1.25rem] text-gray-700">{error || 'Nothing to show'}</p>
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-1.5 text-[1.25rem] font-semibold text-brand-800 hover:underline"
                >
                    <ArrowLeft className="h-4 w-4" /> Go back
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#eef1f8] px-4 py-10 print:bg-white print:p-0">
            {/* Chrome — on screen only. */}
            <div className="mx-auto mb-6 flex max-w-[210mm] items-center justify-between print:hidden">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-[1.25rem] font-semibold text-gray-500
                               transition-colors hover:text-brand-900"
                >
                    <ArrowLeft className="h-4 w-4" /> Back
                </button>

                <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 rounded-xl bg-brand-800 px-5 py-2.5 text-[1.25rem]
                               font-semibold text-white transition-colors hover:bg-brand-900"
                >
                    <Printer className="h-4 w-4" />
                    Print or save as PDF
                </button>
            </div>

            <MemberCertificate cert={cert} />
        </div>
    );
}
