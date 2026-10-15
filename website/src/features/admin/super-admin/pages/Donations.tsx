import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { IndianRupee, HeartHandshake, Users, CalendarDays, Search, Loader2, Eye, CalendarRange, FileCheck2 } from 'lucide-react';
import AdminSidebar from './AdminSidebar';
import { useCardTable } from '@/lib/useCardTable';
import { ADMIN_PAGE, ADMIN_CARD, AdminPageHeader, AdminStat, AdminSegmented } from '@/features/admin/components/AdminUI';
import { errorMessage } from '@/services/api';
import {
    getDonationSummary, listDonors, listDonations, inr, shortDate, fyLabel, receiptPath, statementPath,
    type DonationSummary, type DonorRow, type DonationRow,
} from '@/services/donationsApi';

/**
 * SUPER ADMIN → DONORS.
 *
 * Everyone who has given to ACTIV, how much, and their 80G documents. A donor
 * is one record however many times they give (matched by email); every gift is
 * its own row with its own receipt and message. The financial-year selector
 * drives every figure on the page, because the year is what a donor's tax
 * certificate — and the association's own 80G return — are counted in.
 */

type Tab = 'donors' | 'donations';

const STATUS_TONE: Record<string, string> = {
    paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    pending: 'bg-amber-50 text-amber-700 ring-amber-200',
    failed: 'bg-red-50 text-red-700 ring-red-200',
};

export function StatusBadge({ status }: { status?: string }) {
    const s = String(status || 'pending').toLowerCase();
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.875rem] font-semibold capitalize ring-1 ${STATUS_TONE[s] || STATUS_TONE.pending}`}>
            {s}
        </span>
    );
}

const LINK_BTN = 'inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-[1rem] font-semibold text-blue-700 hover:bg-blue-50';

export default function SuperDonations() {
    const donorsRef = useCardTable();
    const donationsRef = useCardTable();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [tab, setTab] = useState<Tab>('donors');
    const [fy, setFy] = useState('');
    const [query, setQuery] = useState('');
    const [search, setSearch] = useState('');
    const [summary, setSummary] = useState<DonationSummary>({});
    const [donors, setDonors] = useState<DonorRow[]>([]);
    const [donations, setDonations] = useState<DonationRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Search is applied after a short pause, not on every keystroke.
    useEffect(() => {
        const t = window.setTimeout(() => setSearch(query.trim()), 350);
        return () => window.clearTimeout(t);
    }, [query]);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [s, d, all] = await Promise.all([
                getDonationSummary(fy || undefined),
                listDonors({ fy: fy || undefined, q: search || undefined, limit: 200 }),
                listDonations({ fy: fy || undefined, limit: 200 }),
            ]);
            setSummary(s || {});
            setDonors(Array.isArray(d?.rows) ? d.rows : []);
            setDonations(Array.isArray(all?.rows) ? all.rows : []);
        } catch (err) {
            setError(errorMessage(err, 'Could not load donations.'));
        } finally {
            setLoading(false);
        }
    }, [fy, search]);

    useEffect(() => { void load(); }, [load]);

    const years = useMemo(() => (Array.isArray(summary.financialYears) ? summary.financialYears : []), [summary.financialYears]);

    const filteredDonations = useMemo(() => {
        const q = (search || '').toLowerCase();
        if (!q) return donations;
        return (donations || []).filter((r) =>
            [r.donorName, r.donorEmail, r.receiptNumber, r.message].some((v) => (v || '').toLowerCase().includes(q)));
    }, [donations, search]);

    return (
        <div className="flex min-h-screen bg-white">
            <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <div className="min-w-0 flex-1">
                <AdminPageHeader
                    title="Donors"
                    subtitle="Everyone who has donated to ACTIV, every gift, and their 80G receipts and year certificates."
                    onMenu={() => setSidebarOpen(true)}
                    actions={
                        <select
                            aria-label="Financial year"
                            value={fy}
                            onChange={(e) => setFy(e.target.value)}
                            className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-[1.125rem] font-semibold text-slate-800"
                        >
                            <option value="">All years</option>
                            {years.map((y) => <option key={y} value={y}>FY {fyLabel(y)}</option>)}
                        </select>
                    }
                />

                <main className={ADMIN_PAGE}>
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                        <AdminStat primary icon={<IndianRupee className="h-5 w-5" />} label="Total donated"
                            hint={fy ? `FY ${fyLabel(fy)}` : 'All years'} value={inr(summary.totalAmount || 0)} />
                        <AdminStat icon={<HeartHandshake className="h-5 w-5" />} tone="amber" label="Donations"
                            value={Number(summary.donationCount || 0).toLocaleString('en-IN')} />
                        <AdminStat icon={<Users className="h-5 w-5" />} tone="emerald" label="Donors"
                            value={Number(summary.donorCount || 0).toLocaleString('en-IN')} />
                        <AdminStat icon={<CalendarDays className="h-5 w-5" />} tone="blue" label="This month"
                            value={inr(summary.thisMonthAmount || 0)} />
                    </div>

                    <section className={`${ADMIN_CARD} p-4 sm:p-6`}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <AdminSegmented<Tab>
                                label="View"
                                value={tab}
                                onChange={setTab}
                                options={[{ value: 'donors', label: 'Donors' }, { value: 'donations', label: 'All donations' }]}
                            />
                            <div className="relative w-full sm:max-w-md">
                                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search name, email, phone, PAN or receipt"
                                    className="h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-ui-caption
                                               focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                                />
                            </div>
                        </div>

                        {error ? <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-[1rem] text-red-700">{error}</p> : null}

                        {loading ? (
                            <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
                                <Loader2 className="h-5 w-5 animate-spin" /> Loading…
                            </div>
                        ) : tab === 'donors' ? (
                            donors.length === 0 ? (
                                <p className="py-12 text-center text-ui-caption text-slate-500">
                                    No donors {fy ? `in FY ${fyLabel(fy)}` : 'yet'}{search ? ' match that search' : ''}.
                                </p>
                            ) : (
                                <div ref={donorsRef} className="card-table mt-4">
                                    <table className="w-full text-left text-ui-caption sm:table-fixed [&_td]:break-words">
                                        <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                                            <tr>
                                                <th className="w-[28%] px-3 py-3 font-semibold">Donor</th>
                                                <th className="w-[16%] px-3 py-3 font-semibold">Place</th>
                                                <th className="w-[7%] px-3 py-3 text-right font-semibold">Gifts</th>
                                                <th className="w-[11%] px-3 py-3 text-right font-semibold">{fy ? `FY ${fyLabel(fy)}` : 'Total'}</th>
                                                <th className="w-[11%] px-3 py-3 text-right font-semibold">All time</th>
                                                <th className="w-[11%] px-3 py-3 font-semibold">Last gift</th>
                                                <th className="w-[16%] px-3 py-3 font-semibold">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {donors.map((d) => (
                                                <tr key={d.id} className="align-top hover:bg-slate-50/60">
                                                    <td className="min-w-0 px-3 py-3">
                                                        <Link to={`/super-admin/donations/${encodeURIComponent(d.id)}`} className="block truncate font-bold text-slate-900 hover:text-blue-700">
                                                            {d.fullName || '—'}
                                                        </Link>
                                                        <span className="block break-all text-[0.9375rem] text-slate-500">{d.email || ''}</span>
                                                        {d.phone ? <span className="block text-[0.9375rem] text-slate-500">{d.phone}</span> : null}
                                                        {d.pan ? <span className="block font-mono text-[0.875rem] text-slate-500">PAN {d.pan}</span> : null}
                                                    </td>
                                                    <td className="px-3 py-3 text-[0.9375rem] text-slate-600">
                                                        {[d.city, d.district, d.state].filter(Boolean).join(', ') || '—'}
                                                    </td>
                                                    <td className="px-3 py-3 text-right tabular-nums">{d.donationCount || 0}</td>
                                                    <td className="px-3 py-3 text-right font-bold tabular-nums">{inr(d.totalAmount || 0)}</td>
                                                    <td className="px-3 py-3 text-right tabular-nums text-slate-600">{inr(d.allTimeAmount || 0)}</td>
                                                    <td className="px-3 py-3 text-[0.9375rem] text-slate-600">{shortDate(d.lastDonationAt) || '—'}</td>
                                                    <td className="px-3 py-3">
                                                        <div className="flex flex-col items-start gap-1">
                                                            <Link to={`/super-admin/donations/${encodeURIComponent(d.id)}`} className={LINK_BTN}>
                                                                <Eye className="h-4 w-4" /> View
                                                            </Link>
                                                            {d.statementToken ? (
                                                                <a href={statementPath(d.statementToken, fy || undefined)} target="_blank" rel="noopener noreferrer" className={LINK_BTN}>
                                                                    <CalendarRange className="h-4 w-4" /> Year certificate
                                                                </a>
                                                            ) : null}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )
                        ) : filteredDonations.length === 0 ? (
                            <p className="py-12 text-center text-ui-caption text-slate-500">No donations {fy ? `in FY ${fyLabel(fy)}` : 'yet'}.</p>
                        ) : (
                            <div ref={donationsRef} className="card-table mt-4">
                                <table className="w-full text-left text-ui-caption sm:table-fixed [&_td]:break-words">
                                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                                        <tr>
                                            <th className="w-[11%] px-3 py-3 font-semibold">Date</th>
                                            <th className="w-[22%] px-3 py-3 font-semibold">Donor</th>
                                            <th className="w-[16%] px-3 py-3 font-semibold">Receipt</th>
                                            <th className="w-[10%] px-3 py-3 text-right font-semibold">Amount</th>
                                            <th className="w-[10%] px-3 py-3 font-semibold">Status</th>
                                            <th className="w-[19%] px-3 py-3 font-semibold">Message</th>
                                            <th className="w-[12%] px-3 py-3 font-semibold">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredDonations.map((r) => (
                                            <tr key={r.id} className="align-top">
                                                <td className="px-3 py-3 text-[0.9375rem] text-slate-600">{shortDate(r.paidAt || r.createdAt) || '—'}</td>
                                                <td className="min-w-0 px-3 py-3">
                                                    {r.donorId ? (
                                                        <Link to={`/super-admin/donations/${encodeURIComponent(r.donorId)}`} className="block truncate font-bold text-slate-900 hover:text-blue-700">
                                                            {r.donorName || '—'}
                                                        </Link>
                                                    ) : <span className="block font-bold">{r.donorName || '—'}</span>}
                                                    <span className="block break-all text-[0.9375rem] text-slate-500">{r.donorEmail || ''}</span>
                                                </td>
                                                <td className="break-all px-3 py-3 text-[0.9375rem]">{r.receiptNumber || '—'}</td>
                                                <td className="px-3 py-3 text-right font-bold tabular-nums">{inr(r.amount || 0)}</td>
                                                <td className="px-3 py-3"><StatusBadge status={r.status} /></td>
                                                <td className="whitespace-pre-line break-words px-3 py-3 text-[0.9375rem] text-slate-600">{r.message || '—'}</td>
                                                <td className="px-3 py-3">
                                                    {r.receiptToken && String(r.status).toLowerCase() === 'paid' ? (
                                                        <a href={receiptPath(r.receiptToken)} target="_blank" rel="noopener noreferrer" className={LINK_BTN}>
                                                            <FileCheck2 className="h-4 w-4" /> Receipt
                                                        </a>
                                                    ) : <span className="text-slate-400">—</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </main>
            </div>
        </div>
    );
}
