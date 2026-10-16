import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Mail, Phone, IdCard, MapPin, CalendarRange, FileCheck2, Send, User } from 'lucide-react';
import { toast } from 'sonner';
import AdminSidebar from './AdminSidebar';
import { useCardTable } from '@/lib/useCardTable';
import { ADMIN_PAGE, ADMIN_CARD, AdminPageHeader } from '@/features/admin/components/AdminUI';
import { CARD_TITLE } from '@/components/layout/appTypography';
import { errorMessage } from '@/services/api';
import {
    getDonor, resendDonationReceipt, inr, shortDate, fyLabel, receiptPath, statementPath,
    type DonorDetailResponse,
} from '@/services/donationsApi';
import { StatusBadge } from './Donations';
import './donation-records.css';

/**
 * SUPER ADMIN → DONORS → one donor.
 *
 * Their details as last given, what they gave in each financial year (with the
 * year certificate for each), and EVERY gift as its own row — its receipt, its
 * status and its message in full. A dedicated route rather than a modal
 * (CLAUDE.md RULE 2).
 */

const LINK_BTN = 'inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-lg px-2.5 py-2 text-[1rem] font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50 break-normal [overflow-wrap:normal] [&>svg]:shrink-0';

function Detail({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
    if (!value) return null;
    return (
        <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600"><Icon className="h-5 w-5" /></span>
            <span className="min-w-0">
                <span className="block text-[0.9375rem] text-slate-500">{label}</span>
                <span className="block break-words text-ui-caption font-semibold text-slate-900">{value}</span>
            </span>
        </div>
    );
}

export default function DonorDetail() {
    const { id = '' } = useParams();
    const tableRef = useCardTable();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [data, setData] = useState<DonorDetailResponse | null>(null);
    const [error, setError] = useState('');
    const [sending, setSending] = useState('');

    const load = useCallback(async () => {
        setError('');
        try {
            setData(await getDonor(id));
        } catch (err) {
            setError(errorMessage(err, 'Could not load this donor.'));
        }
    }, [id]);

    useEffect(() => { void load(); }, [load]);

    const resend = async (donationId: string) => {
        setSending(donationId);
        try {
            await resendDonationReceipt(donationId);
            toast.success('Receipt sent to the donor again.');
        } catch (err) {
            toast.error(errorMessage(err, 'Could not resend the receipt.'));
        } finally {
            setSending('');
        }
    };

    const donor = data?.donor || {};
    const a = donor.address || {};
    const donations = Array.isArray(data?.donations) ? data?.donations || [] : [];
    const byYear = Array.isArray(data?.byYear) ? data?.byYear || [] : [];

    return (
        <div className="flex min-h-screen bg-white">
            <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <div className="min-w-0 flex-1">
                <AdminPageHeader
                    title={donor.fullName || 'Donor'}
                    subtitle={donor.email || 'Every gift, receipt and year certificate for this donor.'}
                    onMenu={() => setSidebarOpen(true)}
                    backTo="/super-admin/donations"
                />

                <main className={ADMIN_PAGE}>
                    {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-[1rem] text-red-700">{error}</p> : null}
                    {!data && !error ? (
                        <div className="flex items-center justify-center gap-2 py-16 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>
                    ) : null}

                    {data ? (
                        <>
                            <section className={`${ADMIN_CARD} p-4 sm:p-6`}>
                                <h2 className={`${CARD_TITLE} text-slate-900`}>Donor details</h2>
                                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                                    <Detail icon={User} label={donor.donorType === 'organisation' ? 'Organisation' : 'Name'} value={donor.fullName || ''} />
                                    <Detail icon={Mail} label="Email" value={donor.email || ''} />
                                    <Detail icon={Phone} label="Mobile" value={donor.phone || ''} />
                                    <Detail icon={IdCard} label="PAN" value={donor.pan || ''} />
                                    <Detail icon={MapPin} label="Address" value={a.line1 || ''} />
                                    <Detail icon={MapPin} label="City" value={a.city || ''} />
                                    <Detail icon={MapPin} label="District" value={a.district || ''} />
                                    <Detail icon={MapPin} label="State" value={a.state || ''} />
                                    <Detail icon={MapPin} label="PIN code" value={a.pincode || ''} />
                                </div>
                            </section>

                            <section className={`${ADMIN_CARD} p-4 sm:p-6`}>
                                <h2 className={`${CARD_TITLE} text-slate-900`}>By financial year</h2>
                                {byYear.length === 0 ? (
                                    <p className="mt-3 text-ui-caption text-slate-500">No completed donations yet.</p>
                                ) : (
                                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                                        {byYear.map((y) => (
                                            <div key={y.financialYear} className="flex min-w-0 flex-col gap-2 rounded-xl border border-slate-200 p-4">
                                                <p className="text-[1rem] font-semibold text-slate-500">FY {fyLabel(y.financialYear)}</p>
                                                <p className="text-[1.75rem] font-extrabold tabular-nums text-slate-900">{inr(y.total || 0)}</p>
                                                <p className="text-[0.9375rem] text-slate-500">{y.count || 0} gift{(y.count || 0) === 1 ? '' : 's'}</p>
                                                {donor.statementToken ? (
                                                    <a href={statementPath(donor.statementToken, y.financialYear)} target="_blank" rel="noopener noreferrer" className={LINK_BTN}>
                                                        <CalendarRange className="h-4 w-4" /> Year certificate
                                                    </a>
                                                ) : null}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>

                            <section className={`${ADMIN_CARD} p-4 sm:p-6`}>
                                <h2 className={`${CARD_TITLE} text-slate-900`}>Every donation</h2>
                                {donations.length === 0 ? (
                                    <p className="mt-3 text-ui-caption text-slate-500">No donations recorded.</p>
                                ) : (
                                    <div ref={tableRef} className="donation-records card-table mt-4 overflow-x-auto">
                                        <table className="w-full text-left text-ui-caption sm:min-w-[80rem] sm:table-fixed [&_td]:break-words">
                                            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                                                <tr>
                                                    <th className="w-[11%] px-3 py-3 font-semibold">Date</th>
                                                    <th className="w-[18%] px-3 py-3 font-semibold">Receipt</th>
                                                    <th className="w-[9%] px-3 py-3 font-semibold">FY</th>
                                                    <th className="w-[11%] px-3 py-3 text-right font-semibold">Amount</th>
                                                    <th className="w-[11%] px-3 py-3 font-semibold">Status</th>
                                                    <th className="w-[25%] px-3 py-3 font-semibold">Message</th>
                                                    <th className="w-[15%] px-3 py-3 font-semibold">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {donations.map((r) => {
                                                    const paid = String(r.status || '').toLowerCase() === 'paid';
                                                    return (
                                                        <tr key={r.id} className="align-top">
                                                            <td className="px-3 py-3 text-[0.9375rem] text-slate-600">{shortDate(r.paidAt || r.createdAt) || '—'}</td>
                                                            <td className="break-all px-3 py-3 text-[0.9375rem]">{r.receiptNumber || '—'}</td>
                                                            <td className="px-3 py-3 text-[0.9375rem]">{fyLabel(r.financialYear) || '—'}</td>
                                                            <td className="px-3 py-3 text-right font-bold tabular-nums whitespace-nowrap">{inr(r.amount || 0)}</td>
                                                            <td className="px-3 py-3"><StatusBadge status={r.status} /></td>
                                                            <td className="whitespace-pre-line break-words px-3 py-3 text-[0.9375rem] text-slate-700">{r.message || '—'}</td>
                                                            <td className="px-3 py-3">
                                                                {paid ? (
                                                                    <div className="flex flex-col items-start gap-1">
                                                                        {r.receiptToken ? (
                                                                            <a href={receiptPath(r.receiptToken)} target="_blank" rel="noopener noreferrer" className={LINK_BTN}>
                                                                                <FileCheck2 className="h-4 w-4" /> Receipt
                                                                            </a>
                                                                        ) : null}
                                                                        <button type="button" onClick={() => void resend(r.id)} disabled={sending === r.id} className={LINK_BTN}>
                                                                            {sending === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Resend
                                                                        </button>
                                                                    </div>
                                                                ) : <span className="text-slate-400">—</span>}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </section>
                        </>
                    ) : null}
                </main>
            </div>
        </div>
    );
}
