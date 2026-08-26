import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { getCertificate, errorMessage, type Certificate } from '@/services/activApi';

/**
 * A member's certificate, laid out to be printed.
 *
 * The server returns the fields and nothing else — no PDF. Generating one
 * server-side would mean a rendering dependency and a font bundle to produce a
 * document whose only purpose is to be printed, when the browser already prints
 * and already offers "Save as PDF" in the same dialog.
 *
 * The `print:` classes are what make that work: the chrome around the
 * certificate — the back link, the button, the page background — is hidden on
 * paper, so what prints is the certificate alone rather than a screenshot of a
 * web page.
 */

const KINDS: Record<string, { heading: string; accent: string }> = {
    membership: { heading: 'Certificate of Membership', accent: '#1c2e68' },
    'tax-exemption': { heading: 'Tax Exemption Certificate', accent: '#166534' },
};

const formatDate = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? ''
        : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

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

    const style = KINDS[kind] || KINDS.membership;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center gap-3 text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin" />
                Preparing your certificate…
            </div>
        );
    }

    if (error || !cert) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
                <AlertCircle className="w-10 h-10 text-amber-500" />
                <p className="text-gray-700 max-w-md">{error || 'Nothing to show'}</p>
                <button
                    onClick={() => navigate(-1)}
                    className="text-blue-600 hover:underline flex items-center gap-1.5"
                >
                    <ArrowLeft className="w-4 h-4" /> Go back
                </button>
            </div>
        );
    }

    const { member } = cert;
    const region = [member.block, member.district, member.state].filter(Boolean).join(', ');

    return (
        <div className="min-h-screen bg-gray-100 py-10 px-4 print:bg-white print:p-0">
            {/* Chrome — on screen only. */}
            <div className="max-w-3xl mx-auto flex items-center justify-between mb-6 print:hidden">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                >
                    <ArrowLeft className="w-4 h-4" /> Back
                </button>

                <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 bg-[#1c2e68] hover:bg-blue-900 text-white
                               px-5 py-2.5 rounded-lg font-medium transition-colors"
                >
                    <Printer className="w-4 h-4" />
                    Print or save as PDF
                </button>
            </div>

            {/* The certificate itself. */}
            <div
                className="max-w-3xl mx-auto bg-white shadow-xl print:shadow-none p-10 md:p-16
                           border-[10px] print:border-[6px]"
                style={{ borderColor: style.accent }}
            >
                <div className="text-center border-b-2 pb-6 mb-10" style={{ borderColor: `${style.accent}22` }}>
                    <img
                        src="/logo_ACTIVian-removebg-preview.png"
                        alt=""
                        className="h-16 mx-auto mb-4 object-contain"
                    />
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500">
                        {cert.issuedBy}
                    </p>
                </div>

                <h1
                    className="text-3xl md:text-4xl font-serif text-center mb-10"
                    style={{ color: style.accent }}
                >
                    {cert.title || style.heading}
                </h1>

                <p className="text-center text-gray-500 mb-2">This is to certify that</p>

                <p className="text-3xl md:text-4xl font-serif text-center text-gray-900 mb-6">
                    {member.name || '—'}
                </p>

                <p className="text-center text-gray-600 leading-relaxed max-w-xl mx-auto mb-10">
                    {cert.body}
                </p>

                <div className="grid grid-cols-2 gap-6 text-sm border-t border-gray-200 pt-6">
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">
                            Membership number
                        </p>
                        <p className="font-semibold text-gray-900">{member.membershipNumber}</p>
                    </div>

                    {region && (
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Region</p>
                            <p className="font-semibold text-gray-900">{region}</p>
                        </div>
                    )}

                    {formatDate(cert.memberSince) && (
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">
                                Member since
                            </p>
                            <p className="font-semibold text-gray-900">{formatDate(cert.memberSince)}</p>
                        </div>
                    )}

                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Issued</p>
                        <p className="font-semibold text-gray-900">{formatDate(cert.issuedAt)}</p>
                    </div>
                </div>

                <p className="text-center text-[10px] text-gray-400 mt-10">
                    Issued electronically by {cert.issuedBy}. No signature is required.
                </p>
            </div>
        </div>
    );
}
