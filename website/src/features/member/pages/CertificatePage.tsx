import { useForceLightTheme } from '@/lib/appTheme';
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft, Loader2, AlertCircle, Building2 } from 'lucide-react';
import { getCertificate, errorMessage, type Certificate } from '@/services/activApi';
import MemberCertificate from '@/features/member/certificates/MemberCertificate';
import CertificatePreview from '@/features/member/certificates/CertificatePreview';
import { useActiveCompanyStore } from '@/contexts/ActiveCompanyContext';

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
    /* A certificate is a printed document: it stays light on screen as on paper. */
    useForceLightTheme();
    const { kind = 'membership' } = useParams();
    const navigate = useNavigate();
    const { companies, activeCompanyId, activeCompany, hasLoaded, loadCompanies, setActiveCompany } = useActiveCompanyStore();
    const isMembership = kind === 'membership';
    const companyId = isMembership ? activeCompanyId : null;
    const requestKey = `${kind}:${companyId || ''}`;

    const [cert, setCert] = useState<Certificate | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [loadedFor, setLoadedFor] = useState('');

    useEffect(() => {
        if (isMembership) void loadCompanies();
    }, [isMembership, loadCompanies]);

    useEffect(() => {
        if (isMembership && !hasLoaded) return;
        let cancelled = false;
        setLoading(true);
        setError('');
        setCert(null);

        getCertificate(kind as 'membership' | 'tax-exemption', companyId)
            .then((data) => { if (!cancelled) setCert(data); })
            .catch((err) => {
                // The server refuses with 403 when the membership is not active,
                // and that refusal is the answer the member needs — showing a
                // blank certificate instead would hide the reason.
                if (!cancelled) setError(errorMessage(err, 'This certificate could not be issued'));
            })
            .finally(() => {
                if (!cancelled) {
                    setLoadedFor(requestKey);
                    setLoading(false);
                }
            });

        return () => { cancelled = true; };
    }, [kind, companyId, hasLoaded, isMembership, requestKey]);

    const preparing = loading || loadedFor !== requestKey || (isMembership && !hasLoaded);
    const ready = !preparing && !error && !!cert;

    // The toolbar follows the paper width: A4 portrait for tax, landscape for membership.
    const sheetWidth = isMembership ? '297mm' : '210mm';

    return (
        <div className="min-h-screen overflow-x-auto bg-[#eef1f8] px-4 py-6 sm:py-10 print:overflow-visible
                        print:bg-white print:p-0">
            {/* Chrome — on screen only. */}
            <div
                className="mx-auto mb-4 sm:mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden"
                style={{ maxWidth: sheetWidth }}
            >
                <button
                    onClick={() => navigate(-1)}
                    className="flex min-h-[2.75rem] items-center gap-2 text-ui-body font-semibold text-gray-500
                               transition-colors hover:text-brand-900"
                >
                    <ArrowLeft className="h-4 w-4" /> Back
                </button>

                <button
                    onClick={() => window.print()}
                    disabled={!ready}
                    className="flex items-center gap-2 rounded-xl bg-brand-800 px-4 sm:px-5 py-2.5 text-base sm:text-ui-body
                               font-semibold text-white transition-colors hover:bg-brand-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Printer className="h-4 w-4" />
                    Print or save as PDF
                </button>
            </div>

            {isMembership && companies.length > 0 && (
                <div className="mx-auto mb-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 print:hidden" style={{ maxWidth: sheetWidth }}>
                    <label htmlFor="certificate-company" className="mb-2 flex items-center gap-2 text-ui-body font-semibold text-slate-900">
                        <Building2 className="h-5 w-5 text-blue-600" /> Company on this certificate
                    </label>
                    <select id="certificate-company" value={companyId || ''} onChange={event => setActiveCompany(event.target.value)}
                        className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-ui-body text-slate-900 sm:max-w-xl">
                        {companies.map(company => <option key={company._id} value={company._id}>{company.businessName || 'Untitled company'}</option>)}
                    </select>
                    <p className="mt-2 text-ui-small text-slate-600">
                        {activeCompany?.publication?.unlimited
                            ? 'Your ₹2 lakh membership keeps the same membership ID when you switch companies.'
                            : activeCompany?.publication?.paymentRequired
                                ? 'This additional company stays private until its plan is paid. Its own membership ID and certificate become available after payment.'
                                : 'The certificate uses the membership ID assigned to the selected company.'}
                    </p>
                </div>
            )}

            {preparing ? (
                <div className="flex min-h-[45vh] items-center justify-center gap-3 text-ui-body text-slate-600" role="status">
                    <Loader2 className="h-5 w-5 animate-spin" /> Preparing your certificate…
                </div>
            ) : error || !cert ? (
                <div className="flex min-h-[45vh] flex-col items-center justify-center gap-4 px-6 text-center" role="alert">
                    <AlertCircle className="h-10 w-10 text-amber-600" />
                    <p className="max-w-lg text-ui-body text-slate-700">{error || 'This certificate could not be issued'}</p>
                    {isMembership && activeCompany?.publication?.paymentRequired && (
                        <button onClick={() => navigate('/business/settings')} className="min-h-[44px] rounded-xl bg-blue-600 px-5 py-2 font-semibold text-white">
                            View company plan
                        </button>
                    )}
                </div>
            ) : (
                <CertificatePreview widthMm={cert.kind === 'tax-exemption' ? 210 : 297}>
                    <MemberCertificate cert={cert} />
                </CertificatePreview>
            )}
        </div>
    );
}
