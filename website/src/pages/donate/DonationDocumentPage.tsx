import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Printer, Loader2, AlertCircle, CalendarRange } from 'lucide-react';
import TaxExemptionCertificate from '@/features/member/certificates/TaxExemptionCertificate';
import CertificatePreview from '@/features/member/certificates/CertificatePreview';
import type { Certificate } from '@/services/activApi';
import { errorMessage } from '@/services/api';
import {
    getDonationReceipt, getDonationStatement, fyLabel, statementPath,
    type DonationReceipt, type DonationStatement,
} from '@/services/donationsApi';

/**
 * A donor's 80G documents, on screen and on paper — no account needed.
 *
 *   /donate/receipt/:token          one gift
 *   /donate/statement/:token?fy=    every gift of one financial year, totalled
 *
 * The token is the unguessable key from the emailed link. The chrome (back,
 * year switcher, print) is `print:hidden`, so the printer gets the sheet only.
 * The A4 sheet is zoomed down to fit a phone and printed at its real size
 * (CLAUDE.md, THE WEBSITE ON A PHONE, rule 9).
 */

/*
 * ONE DESIGN FOR EVERY 80G PAPER.
 *
 * Both donor documents are the association's Tax Exemption certificate itself
 * (`TaxExemptionCertificate`), fed with the donation's data:
 *
 *   receipt    — one gift: one payment row, its receipt number, its date.
 *   statement  — the financial year: every gift as its own row (date, receipt
 *                no., amount, mode), the total, and the total in words — the
 *                paper a donor files to claim the deduction for the year.
 */
const modeLabel = (m?: string) => {
    const v = String(m || '').toLowerCase();
    if (v === 'mock') return 'Test';
    if (v === 'online' || !v) return 'Online';
    return v.charAt(0).toUpperCase() + v.slice(1);
};

const blankMember = (name: string, pan: string): Certificate['member'] => ({
    name, membershipNumber: '', email: '', block: '', district: '', state: '', pan,
});

const receiptToCertificate = (d: DonationReceipt): Certificate => ({
    kind: 'tax-exemption',
    title: 'Tax Exemption Certificate',
    body: '',
    member: blankMember(d?.donor?.fullName || '', d?.donor?.pan || ''),
    membershipType: '',
    memberSince: null,
    activatedAt: null,
    validUntil: null,
    financialYear: d?.financialYear || '',
    contribution: {
        amount: typeof d?.amount === 'number' ? d.amount : null,
        reference: d?.receiptNumber || '',
        receivedOn: d?.paidAt || null,
        payments: [{
            date: d?.paidAt || null,
            amount: typeof d?.amount === 'number' ? d.amount : null,
            mode: modeLabel(d?.paymentMode),
            reference: d?.receiptNumber || '',
        }],
    },
    reference: d?.receiptNumber || '',
    issuedAt: d?.paidAt || new Date().toISOString(),
    issuedBy: 'ACTIV',
});

const statementToCertificate = (d: DonationStatement): Certificate => {
    const rows = (d?.donations || []).map((g) => ({
        date: g?.paidAt || null,
        amount: typeof g?.amount === 'number' ? g.amount : null,
        mode: modeLabel(g?.paymentMode),
        reference: g?.receiptNumber || '',
    }));
    return {
        kind: 'tax-exemption',
        title: 'Tax Exemption Certificate',
        body: '',
        member: blankMember(d?.donor?.fullName || '', d?.donor?.pan || ''),
        membershipType: '',
        memberSince: null,
        activatedAt: null,
        validUntil: null,
        financialYear: d?.financialYear || '',
        contribution: {
            amount: typeof d?.total === 'number' ? d.total : null,
            reference: d?.statementNumber || '',
            receivedOn: rows.length ? rows[rows.length - 1].date : null,
            payments: rows,
        },
        reference: d?.statementNumber || '',
        issuedAt: d?.generatedAt || new Date().toISOString(),
        issuedBy: 'ACTIV',
    };
};

const BTN = 'inline-flex min-h-[2.75rem] items-center gap-2 rounded-full px-4 font-bold transition-colors';

function Toolbar({ children }: { children: React.ReactNode }) {
    return (
        <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 print:hidden sm:mb-6">
            <Link to="/donate" className="inline-flex min-h-[2.75rem] items-center gap-1.5 font-semibold text-blue-700 hover:underline">
                <ArrowLeft className="h-4 w-4" /> Donate again
            </Link>
            <div className="flex flex-wrap items-center gap-2">{children}</div>
        </div>
    );
}

function State({ loading, error }: { loading: boolean; error: string }) {
    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
            {loading ? <Loader2 className="h-9 w-9 animate-spin text-blue-600" /> : <AlertCircle className="h-10 w-10 text-amber-500" />}
            <p className="max-w-md text-[1.0625rem] text-slate-600">{loading ? 'Loading your document…' : error}</p>
            {!loading ? (
                <Link to="/donate" className="mt-2 inline-flex h-11 items-center rounded-xl bg-blue-600 px-5 font-bold text-white hover:bg-blue-700">
                    Go to donations
                </Link>
            ) : null}
        </div>
    );
}

function Sheet({ children }: { children: React.ReactNode }) {
    return (
        <CertificatePreview>{children}</CertificatePreview>
    );
}

export function DonationReceiptPage() {
    const { token = '' } = useParams();
    const [data, setData] = useState<DonationReceipt | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        setData(null);
        setError('');
        getDonationReceipt(token)
            .then((d) => { if (!cancelled) { if (d && d.receiptNumber) setData(d); else setError('This receipt link is not valid.'); } })
            .catch((err) => { if (!cancelled) setError(errorMessage(err, 'This receipt could not be loaded.')); });
        return () => { cancelled = true; };
    }, [token]);

    return (
        <div className="min-h-screen overflow-x-hidden bg-[#f3f6fb] px-4 py-6 sm:py-10 print:bg-white print:p-0">
            {!data ? <State loading={!error} error={error} /> : (
                <>
                    <Toolbar>
                        {data.statementToken ? (
                            <Link to={statementPath(data.statementToken, data.financialYear)}
                                className={`${BTN} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>
                                <CalendarRange className="h-4 w-4" /> Year certificate
                            </Link>
                        ) : null}
                        <button type="button" onClick={() => window.print()} className={`${BTN} bg-blue-600 text-white hover:bg-blue-700`}>
                            <Printer className="h-4 w-4" /> Print or save as PDF
                        </button>
                    </Toolbar>
                    <Sheet>
                        <TaxExemptionCertificate
                            cert={receiptToCertificate(data)}
                            amountInWords={data.amountInWords || ''}
                        />
                    </Sheet>
                </>
            )}
        </div>
    );
}

export function DonationStatementPage() {
    const { token = '' } = useParams();
    const [params, setParams] = useSearchParams();
    const fy = params.get('fy') || '';
    const [data, setData] = useState<DonationStatement | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        setData(null);
        setError('');
        getDonationStatement(token, fy || undefined)
            .then((d) => { if (!cancelled) { if (d && d.financialYear) setData(d); else setError('This certificate link is not valid.'); } })
            .catch((err) => { if (!cancelled) setError(errorMessage(err, 'This certificate could not be loaded.')); });
        return () => { cancelled = true; };
    }, [token, fy]);

    const years = Array.isArray(data?.availableYears) ? data?.availableYears || [] : [];

    return (
        <div className="min-h-screen overflow-x-hidden bg-[#f3f6fb] px-4 py-6 sm:py-10 print:bg-white print:p-0">
            {!data ? <State loading={!error} error={error} /> : (
                <>
                    <Toolbar>
                        {years.length > 1 ? (
                            <label className="inline-flex items-center gap-2 text-[0.9375rem] font-semibold text-slate-700">
                                Year
                                <select
                                    value={data.financialYear || ''}
                                    onChange={(e) => setParams({ fy: e.target.value })}
                                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-[1rem] font-semibold text-slate-800"
                                >
                                    {years.map((y) => <option key={y} value={y}>{fyLabel(y)}</option>)}
                                </select>
                            </label>
                        ) : null}
                        <button type="button" onClick={() => window.print()} className={`${BTN} bg-blue-600 text-white hover:bg-blue-700`}>
                            <Printer className="h-4 w-4" /> Print or save as PDF
                        </button>
                    </Toolbar>
                    {data.isFinal === false ? (
                        <p className="mx-auto mb-4 max-w-[210mm] rounded-xl bg-amber-50 px-4 py-3 text-[0.9375rem] font-medium text-amber-800 ring-1 ring-amber-200 print:hidden">
                            Provisional — the financial year is still running. Any gift you make before 31 March is added here,
                            and the final certificate is issued after the year closes.
                        </p>
                    ) : null}
                    <Sheet>
                        <TaxExemptionCertificate
                            cert={statementToCertificate(data)}
                            receiptColumn
                            amountInWords={data.totalInWords || ''}
                            stamp={data.isFinal === false
                                ? `Provisional — FY ${fyLabel(data.financialYear)} in progress · final after 31 March`
                                : `Consolidated certificate · FY ${fyLabel(data.financialYear)}`}
                        />
                    </Sheet>
                </>
            )}
        </div>
    );
}

export default DonationReceiptPage;
