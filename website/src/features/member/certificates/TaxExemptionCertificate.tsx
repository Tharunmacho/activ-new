import { useId, useLayoutEffect, useRef } from 'react';
import { MapPin, Phone, Mail, Globe } from 'lucide-react';
import { CertificateSheet, ASSOCIATION_NAME } from './CertificateSheet';
import { amountInWords as spellAmount } from '@/lib/amountInWords';
import type { Certificate } from '@/services/activApi';
import './tax-exemption-certificate.css';

const ADDRESS = '6&7, Hayagreeva Apartment, 121, Velachery Main Road, Chennai - 600032';
const PHONE = '+91-82201-12188';
const EMAIL = 'info@activ.org.in';
const WEB = 'https://activ.org.in';

const certificateDate = (iso?: string | null) => {
    if (!iso) return '';
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
};
const isAmount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const rupees = (value?: number | null) => isAmount(value)
    ? `₹\u00a0${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
const fullYear = (year: string) => {
    const match = /^(\d{4})-(\d{2,4})$/.exec(year || '');
    return match ? `${match[1]}–${match[2].length === 2 ? `${match[1].slice(0, 2)}${match[2]}` : match[2]}` : year;
};

/** Plain white paper with the reference's navy and gold right-hand corners. */
export function Frame() {
    const id = useId().replace(/:/g, '');
    return (
        <svg className="tax-certificate__frame" viewBox="0 0 794 1123" preserveAspectRatio="none" aria-hidden="true">
            <defs>
                <linearGradient id={`${id}-navy`} x1="0" y1="0" x2="1" y2="1">
                    <stop stopColor="#254875" /><stop offset="1" stopColor="#0e224a" />
                </linearGradient>
                <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
                    <stop stopColor="#dfc28c" /><stop offset=".5" stopColor="#efddbc" /><stop offset="1" stopColor="#d7b77f" />
                </linearGradient>
            </defs>
            <rect width="794" height="1123" fill="#ffffff" />
            <path d="M646 0 H794 V143 C764 134 743 106 716 76 Z" fill={`url(#${id}-gold)`} />
            <path d="M667 0 H794 V119 C769 111 748 83 725 60 Z" fill="#ffffff" />
            <path d="M680 0 H794 V111 C767 96 752 77 730 54 Z" fill={`url(#${id}-navy)`} />
            <path d="M794 976 V1123 H642 C691 1075 740 1027 794 976 Z" fill={`url(#${id}-gold)`} />
            <path d="M794 998 V1123 H664 Z" fill="#ffffff" />
            <path d="M794 1011 V1123 H676 Z" fill={`url(#${id}-navy)`} />
            <path d="M794 1034 V1123 H710 Z" fill="#24477a" opacity=".55" />
        </svg>
    );
}

/** Shared by member tax certificates, donation receipts and annual statements. */
export default function TaxExemptionCertificate({ cert, stamp = '', receiptColumn = false, amountInWords = '' }: {
    cert: Certificate; stamp?: string; receiptColumn?: boolean; amountInWords?: string;
}) {
    const member = cert.member || ({} as Certificate['member']);
    const contribution = cert.contribution;
    const payments = contribution?.payments?.length
        ? contribution.payments
        : contribution && (isAmount(contribution.amount) || contribution.receivedOn)
            ? [{ date: contribution.receivedOn, amount: contribution.amount, mode: '', reference: contribution.reference }]
            : [];
    const total = payments.length && payments.every(payment => isAmount(payment.amount))
        ? payments.reduce((sum, payment) => sum + (payment.amount ?? 0), 0)
        : isAmount(contribution?.amount) ? contribution.amount : null;
    const words = amountInWords || spellAmount(total);
    const issued = certificateDate(cert.issuedAt);
    const financialYear = fullYear(cert.financialYear || '');
    const flowRef = useRef<HTMLDivElement>(null);

    // Re-measure after fonts load and when switching to print dimensions.
    // Long names and annual payment lists must not hide the address or footer.
    useLayoutEffect(() => {
        const flow = flowRef.current;
        const sheet = flow?.parentElement;
        if (!flow || !sheet) return;
        let disposed = false;
        const fit = () => {
            if (disposed) return;
            flow.style.zoom = '1';
            for (let pass = 0; pass < 3; pass++) {
                if (flow.scrollHeight <= flow.clientHeight + 1 || !flow.clientHeight) break;
                const scale = Number(flow.style.zoom) * flow.clientHeight / flow.scrollHeight;
                flow.style.zoom = String(scale * .995);
            }
        };
        fit();
        const observer = new ResizeObserver(fit);
        observer.observe(sheet);
        document.fonts.ready.then(fit);
        window.addEventListener('beforeprint', fit);
        window.addEventListener('afterprint', fit);
        return () => {
            disposed = true;
            observer.disconnect();
            window.removeEventListener('beforeprint', fit);
            window.removeEventListener('afterprint', fit);
        };
    }, [cert, stamp, receiptColumn, amountInWords]);

    return (
        <CertificateSheet size="a4" bleed onePage letterhead={false} registrations={false} footNote={null}>
            <article className={`tax-certificate ${payments.length > 6 ? 'tax-certificate--dense' : ''}`} aria-label="Tax Exemption Certificate">
                <Frame />
                <div ref={flowRef} className="tax-certificate__flow">
                    <header className="tax-certificate__header">
                        <img className="tax-certificate__logo" src="/logo_ACTIVian-removebg-preview.png" alt={ASSOCIATION_NAME} />
                        <p className="tax-certificate__association">{ASSOCIATION_NAME}</p>
                        <h1>Tax Exemption Certificate</h1>
                        <p className="tax-certificate__section"><span />Under Section 80G - Income Tax Act, 1961<span /></p>
                        {stamp ? <p className="tax-certificate__stamp">{stamp}</p> : null}
                    </header>
                    <div className="tax-certificate__body">
                        <dl className="tax-certificate__details">
                            <div><dt>Certificate No. :</dt><dd>{cert.reference || '—'}</dd></div>
                            <div><dt>Date :</dt><dd>{issued || '—'}</dd></div>
                            {member.pan ? <div><dt>Donor PAN :</dt><dd>{member.pan}</dd></div> : null}
                        </dl>
                        <p className="tax-certificate__contribution">
                            This is to certify that <strong>{member.name || 'the donor'}</strong> has contributed
                            {total !== null ? <> a total amount of <strong>{rupees(total)}{words ? ` (${words})` : ''}</strong></> : null}
                            {' '}to the {ASSOCIATION_NAME} (ACTIV), and the contribution is eligible for exemption under Section 80G of the Income Tax Act, 1961.
                        </p>
                        {payments.length ? (
                            <table className="tax-certificate__payments" aria-label="Contribution payment details">
                                <colgroup><col className="tax-certificate__date-column" /><col className="tax-certificate__amount-column" /><col /></colgroup>
                                <thead><tr><th scope="col">Date</th><th scope="col">Amount</th><th scope="col">{receiptColumn ? 'Receipt No.' : 'Invoice / Payment ID'}</th></tr></thead>
                                <tbody>{payments.map((payment, index) => (
                                    <tr key={index}>
                                        <td>{certificateDate(payment.date) || '—'}</td>
                                        <td>{rupees(payment.amount)}{payment.mode ? <span className="tax-certificate__payment-mode">{payment.mode}</span> : null}</td>
                                        <td>{payment.reference || '—'}</td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        ) : null}
                        <p className="tax-certificate__thanks">
                            We thank you for your contribution to the {ASSOCIATION_NAME} and for supporting our work for community growth and empowerment.
                        </p>
                        <address className="tax-certificate__address">
                            6&amp;7, Hayagreeva Apartment,<br />
                            121, Velachery Main Road,<br />
                            Chennai - 600032, India<br />
                            Email: {EMAIL}
                        </address>
                    </div>
                    <div className="tax-certificate__closing">
                        <div className="tax-certificate__motto"><span /><p>Your support empowers communities and creates<br />opportunities for a better tomorrow.</p><span /></div>
                        <footer className="tax-certificate__footer">
                            <p className="tax-certificate__footer-name">{ASSOCIATION_NAME}</p>
                            <p className="tax-certificate__footer-address"><MapPin size={15} />{ADDRESS}</p>
                            <div className="tax-certificate__contacts">
                                <span><Phone size={14} />{PHONE}</span><i />
                                <span><Mail size={15} />{EMAIL}</span><i />
                                <span><Globe size={14} />{WEB}</span>
                            </div>
                            <div className="tax-certificate__reference">
                                <p><span>Certificate No: {cert.reference || '—'}</span><span>Date: {issued || '—'}</span></p>
                                <p><span>Issued By: {cert.issuedBy || 'ACTIV'}</span>{financialYear ? <span>Valid for Financial Year: {financialYear}</span> : null}</p>
                            </div>
                        </footer>
                    </div>
                </div>
            </article>
        </CertificateSheet>
    );
}
