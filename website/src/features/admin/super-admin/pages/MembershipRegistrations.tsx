import { membershipValidityLabel } from '@/lib/membershipDates';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Users, BadgeCheck, IndianRupee, Clock, RefreshCw, Download, Eye, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import AdminSidebar from './AdminSidebar';
import { AdminPageHeader, AdminStat, ADMIN_BG, ADMIN_PAGE, ADMIN_CARD, ADMIN_INPUT, ADMIN_PRIMARY_BTN, ADMIN_SECONDARY_BTN, rupees } from '@/features/admin/components/AdminUI';
import { SECTION_TITLE } from '@/components/layout/appTypography';
import { AdminTable, type AdminColumn } from '@/features/admin/components/AdminTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { loadMembershipDashboard, exportMembershipReport, loadMembershipDetail, confirmMembership, deleteMembershipRegistration, deleteArchivedMembershipPayment, type MembershipDashboard, type MembershipRegistration, type MembershipPayment, type MembershipDetail } from '@/services/membershipDashboardApi';
import { errorMessage } from '@/services/activApi';

const date = (v: string | null) => v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const label = (v: string) => v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const Status = ({ value }: { value: string }) => <span className={`inline-flex max-w-full whitespace-normal break-normal rounded-full px-3 py-1 text-ui-caption font-semibold [overflow-wrap:normal] ${['active', 'paid', 'Approved'].includes(value) ? 'bg-emerald-50 text-emerald-700' : ['failed', 'rejected', 'Rejected', 'blocked', 'cancelled'].includes(value) ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>{label(value)}</span>;
const Field = ({ title, value }: { title: string; value: string }) => <div className="min-w-0 border-b border-slate-100 pb-3"><dt className="text-[0.9375rem] font-semibold uppercase tracking-wide text-slate-500">{title}</dt><dd className="mt-1 text-ui-small font-semibold text-slate-800 break-words">{value || '—'}</dd></div>;
const PAYMENT_SORT_OPTIONS = [
    ['', 'Default order'], ['date:desc', 'Newest first'], ['date:asc', 'Oldest first'],
    ['amount:desc', 'Amount: high to low'], ['amount:asc', 'Amount: low to high'],
    ['member:asc', 'Member: A–Z'], ['member:desc', 'Member: Z–A'],
    ['plan:asc', 'Plan: A–Z'], ['plan:desc', 'Plan: Z–A'],
    ['mode:asc', 'Method: A–Z'], ['mode:desc', 'Method: Z–A'],
    ['status:asc', 'Status: A–Z'], ['status:desc', 'Status: Z–A'],
    ['order:asc', 'Order reference: A–Z'], ['order:desc', 'Order reference: Z–A'],
    ['receipt:asc', 'Payment reference: A–Z'], ['receipt:desc', 'Payment reference: Z–A'],
];

/** Registered accounts, reviewed applications and membership receipts in one office view. */
export default function MembershipRegistrations() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [data, setData] = useState<MembershipDashboard | null>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');
    const [tab, setTab] = useState<'members' | 'payments' | 'archived'>('members');
    const [filter, setFilter] = useState('all');
    const [paymentSort, setPaymentSort] = useState('');
    const [detail, setDetail] = useState<MembershipDetail | null>(null);
    const [opening, setOpening] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deletingPayment, setDeletingPayment] = useState('');
    const deleteInFlight = useRef(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [planId, setPlanId] = useState('');
    const [mode, setMode] = useState('cash');
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [receiptNumber, setReceiptNumber] = useState('');
    const [membershipNumber, setMembershipNumber] = useState('');
    const [commencementYear, setCommencementYear] = useState('');
    const offeredPlans = detail?.confirmation?.plans || [];
    const selectedPlan = offeredPlans.find(p => p.id === planId);
    const [ack, setAck] = useState(false);
    const chooseSummary = (nextTab: 'members' | 'payments', nextFilter: string) => { setTab(nextTab); setFilter(nextFilter); };
    const remove = async () => {
        if (!detail || !window.confirm(`Permanently delete ${detail.member.name}'s account and registration from the database? Their login, application, business profile and membership payments will be removed. This cannot be undone or refund payments. They must register again to sign in.`)) return;
        setSaving(true);
        try { await deleteMembershipRegistration(detail.member.id); setModalOpen(false); setDetail(null); await load(); toast.success('Member account and registration permanently deleted.'); }
        catch (e) { toast.error(errorMessage(e, 'Could not delete registration.')); }
        finally { setSaving(false); }
    };
    const load = async () => {
        setLoading(true); setError('');
        try { setData(await loadMembershipDashboard()); }
        catch (e) { setError(errorMessage(e, 'Could not load membership registrations.')); }
        finally { setLoading(false); }
    };
    useEffect(() => { void load(); }, []);
    const removeArchivedPayment = async (payment: MembershipPayment) => {
        if (!payment.registrationDeleted || !payment.id || deleteInFlight.current) return;
        deleteInFlight.current = true;
        try {
            if (!window.confirm(`Permanently delete this archived membership payment?\n\n${payment.name || payment.email || 'Deleted account'}\n${payment.planName}\nOrder: ${payment.orderId || payment.id}\n\nOnly this payment record will be removed from the database and reports. This cannot be undone and does not refund any payment. Export a copy first if needed.`)) return;
            setDeletingPayment(payment.id);
            await deleteArchivedMembershipPayment(payment.id);
            setData(current => current ? { ...current, payments: current.payments.filter(row => row.id !== payment.id) } : current);
            toast.success('Archived payment permanently deleted.');
            await load();
        } catch (e) { toast.error(errorMessage(e, 'Could not delete archived payment.')); }
        finally { deleteInFlight.current = false; setDeletingPayment(''); }
    };
    const open = async (id: string) => {
        setAck(false); setModalOpen(true); setOpening(true); setDetail(null); setShowConfirm(false); setNote(''); setReceiptNumber(''); setMembershipNumber(''); setMode('cash'); setPlanId(''); setAmount('');
        setCommencementYear('');
        try {
            const result = await loadMembershipDetail(id); setDetail(result);
            setCommencementYear(result.confirmation?.commencementYear || '');
            if (result.confirmation?.plans.length === 1) { const p = result.confirmation.plans[0]; setPlanId(p.id); setAmount(String(p.price)); }
        }
        catch (e) { toast.error(errorMessage(e, 'Could not load member details.')); setModalOpen(false); }
        finally { setOpening(false); }
    };
    const members = useMemo(() => (data?.rows || []).filter(r => filter === 'all' || (filter === 'submitted' ? !!r.applicationId : filter === 'waived' ? r.confirmation === 'Fee waived' : r.status === filter)), [data, filter]);
    const currentPayments = (data?.payments || []).filter(r => !r.registrationDeleted);
    const archivedPayments = (data?.payments || []).filter(r => r.registrationDeleted);
    const payments = useMemo(() => {
        const rows = (data?.payments || []).filter(r => (tab === 'archived' ? !!r.registrationDeleted : !r.registrationDeleted) && (filter === 'all' || (filter === 'waived' ? r.mode === 'waived' && r.status === 'paid' : r.status === filter)));
        if (!paymentSort) return rows;
        const [field, direction] = paymentSort.split(':');
        const value = (row: MembershipPayment): string | number => {
            if (field === 'amount') return row.amount;
            if (field === 'date') return new Date(row.paidAt || row.createdAt).getTime() || 0;
            if (field === 'member') return `${row.name} ${row.email}`;
            if (field === 'plan') return row.planName;
            if (field === 'mode') return row.mode;
            if (field === 'status') return row.status;
            if (field === 'order') return row.orderId;
            return row.paymentId || '';
        };
        return rows.sort((a, b) => {
            const left = value(a), right = value(b);
            const compared = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
            return direction === 'desc' ? -compared : compared;
        });
    }, [data, filter, tab, paymentSort]);
    const memberColumns: AdminColumn<MembershipRegistration>[] = [
        { key: 'name', header: 'Member', width: 'min-w-[15rem] max-w-[20rem]', sortValue: r => `${r.name} ${r.email} ${r.phone} ${r.memberNumber}`, render: r => <div className="space-y-1"><p className="font-bold text-slate-900">{r.name}</p><p className="text-ui-caption text-slate-500 [overflow-wrap:anywhere]">{r.email}</p><p className="text-ui-caption text-slate-500">{r.phone}</p></div> },
        { key: 'registered', header: 'Registered', width: 'min-w-[10rem]', sortValue: r => r.registeredAt, render: r => date(r.registeredAt), hideOnMobile: true },
        { key: 'application', header: 'Application', width: 'min-w-[11rem]', sortValue: r => r.applicationStatus, render: r => <Status value={r.applicationStatus} /> },
        { key: 'plan', header: 'Plan', width: 'min-w-[11rem] max-w-[16rem]', sortValue: r => `${r.planName} ${r.kind}`, render: r => <div>{r.planName || label(r.kind)}<p className="text-ui-caption text-slate-500">{r.confirmation}</p></div> },
        { key: 'status', header: 'Membership', width: 'min-w-[14rem]', sortValue: r => r.status, render: r => <div><Status value={r.status} /><p className="mt-1 text-ui-caption text-slate-500">{r.lifetime ? 'Lifetime' : r.expiresAt ? `Until ${membershipValidityLabel(r.expiresAt)}` : ''}</p></div> },
        { key: 'collected', header: 'Collected', width: 'min-w-[10rem]', sortValue: r => r.collected, render: r => <span className="whitespace-nowrap tabular-nums">{rupees(r.collected)}</span>, align: 'right' },
        { key: 'action', header: 'Action', width: 'min-w-[10rem]', sticky: 'right', render: r => <button className={ADMIN_PRIMARY_BTN} onClick={() => void open(r.id)}><Eye className="w-4 h-4" /> Details</button> }
    ];
    const paymentColumns: AdminColumn<MembershipPayment>[] = [
        { key: 'member', header: 'Member', width: 'min-w-[14rem] max-w-[20rem]', sortValue: r => `${r.name} ${r.email}`, render: r => <div className="space-y-1"><p className="font-bold">{r.name || 'Member'}</p><p className="text-ui-caption text-slate-500 [overflow-wrap:anywhere]">{r.email}</p></div> },
        { key: 'plan', header: 'Membership', width: 'min-w-[11rem] max-w-[15rem]', sortValue: r => `${r.planName} ${r.mode} ${r.status}`, render: r => <div className="space-y-1"><p className="font-semibold">{r.planName}</p><p className="text-ui-caption text-slate-500">{r.mode === 'waived' ? 'Fee waived' : label(r.mode)}</p></div> },
        { key: 'references', header: 'References', width: 'min-w-[17rem] max-w-[20rem]', sortValue: r => `${r.orderId} ${r.paymentId || ''}`, render: r => <dl className="space-y-2 text-ui-caption"><div><dt className="font-semibold text-slate-500">Order</dt><dd className="mt-0.5 [overflow-wrap:anywhere]">{r.orderId || '—'}</dd></div><div><dt className="font-semibold text-slate-500">Payment / receipt</dt><dd className="mt-0.5 [overflow-wrap:anywhere]">{r.paymentId || '—'}</dd></div></dl> },
        { key: 'amount', header: 'Payment', width: 'min-w-[13rem]', sortValue: r => `${r.amount} ${r.status} ${r.paidAt || r.createdAt}`, render: r => <div className="space-y-2"><Status value={r.status} /><p className={`whitespace-nowrap tabular-nums ${r.status === 'paid' ? 'font-semibold' : 'text-slate-500'}`}>{rupees(r.amount)}{r.status === 'paid' ? '' : ' due'}</p><p className="text-ui-caption text-slate-500">{date(r.paidAt || r.createdAt)}</p></div> },
        { key: 'action', header: 'Action', width: 'min-w-[13rem]', sticky: 'right', render: r => r.registrationDeleted
            ? <button type="button" className={`${ADMIN_SECONDARY_BTN} !text-rose-700 !border-rose-200 hover:!bg-rose-50`} disabled={!!deletingPayment} onClick={() => void removeArchivedPayment(r)}><Trash2 className="h-4 w-4 shrink-0" /><span>{deletingPayment === r.id ? 'Deleting…' : 'Delete permanently'}</span></button>
            : r.memberId ? <button className={ADMIN_PRIMARY_BTN} onClick={() => void open(r.memberId)}>Details</button> : '—' }
    ];
    const submit = async () => {
        if (!selectedPlan || (selectedPlan.audience === 'business' && !selectedPlan.commencementYears.includes(commencementYear))) { toast.error('Choose the eligible plan and a business commencement year from its range.'); return; }
        if (!detail || !planId || !note.trim() || !ack || (mode !== 'waived' && !(Number(amount) > 0))) { toast.error('Choose a plan, enter the amount and notes, and confirm the details below.'); return; }
        setSaving(true);
        try {
            const confirmed = await confirmMembership(detail.member.id, { planId, mode, amount: mode === 'waived' ? 0 : Number(amount), note, receiptNumber, membershipNumber: membershipNumber.trim(), commencementYear: selectedPlan.audience === 'business' ? commencementYear : undefined });
            setDetail(confirmed); setShowConfirm(false); toast.success('Membership confirmed. The member now has active dashboard access.'); await load();
        } catch (e) { toast.error(errorMessage(e, 'Could not confirm membership.')); }
        finally { setSaving(false); }
    };
    const exportReport = async () => {
        if (exporting || loading || !data) return;
        setExporting(true);
        try { await exportMembershipReport(tab, filter); }
        catch (e) { toast.error(errorMessage(e, 'Could not download the Excel report.')); }
        finally { setExporting(false); }
    };

    const summary = data?.summary;
    return <div className={`flex min-h-dvh lg:h-screen ${ADMIN_BG}`}>
        <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0 lg:overflow-hidden">
            <AdminPageHeader title="Membership registrations" subtitle="Registered accounts, applications and membership payments. Open a member to review or confirm their membership." onMenu={() => setSidebarOpen(true)} actions={<><button className={ADMIN_SECONDARY_BTN} disabled={!data || loading || exporting} onClick={() => void exportReport()}><Download className="w-4 h-4" /> {exporting ? 'Preparing Excel...' : 'Export Excel'}</button><button className={ADMIN_SECONDARY_BTN} onClick={() => void load()} disabled={loading}><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button></>} />
            <main className={`flex-1 lg:overflow-y-auto ${ADMIN_PAGE}`}>
                {error && <div role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-rose-700">{error} <button className="underline" onClick={() => void load()}>Retry</button></div>}
                <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-3 sm:gap-4">
                    <AdminStat primary icon={<Users className="w-5 h-5" />} label="Registered" value={String(summary?.registered ?? 0)} hint={`${summary?.submitted ?? 0} applications submitted`} tone="blue" onClick={() => chooseSummary('members', 'all')} />
                    <AdminStat icon={<BadgeCheck className="w-5 h-5" />} label="Active members" value={String(summary?.active ?? 0)} hint={`${summary?.waived ?? 0} fee-waiver confirmations`} tone="violet" onClick={() => chooseSummary('members', 'active')} />
                    <AdminStat icon={<IndianRupee className="w-5 h-5" />} label="Collected" value={rupees(summary?.collected ?? 0)} hint="money actually received" tone="emerald" onClick={() => chooseSummary('payments', 'paid')} />
                    <AdminStat icon={<Clock className="w-5 h-5" />} label="Awaiting payment" value={String(summary?.awaiting ?? 0)} hint={`${summary?.pendingReview ?? 0} awaiting review · ${summary?.expired ?? 0} expired`} tone="amber" onClick={() => chooseSummary('members', 'awaiting_payment')} />
                </div>
                <div className="flex flex-wrap items-center gap-3 my-6">
                    <div className="flex w-full flex-wrap gap-1 rounded-xl bg-slate-100 p-1 sm:w-auto">{(['members', 'payments', 'archived'] as const).map(t => <button key={t} onClick={() => { setTab(t); setFilter('all'); }} className={`min-h-11 flex-auto whitespace-nowrap rounded-lg px-3 py-2 text-ui-caption font-semibold sm:flex-none sm:px-4 ${tab === t ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}>{t === 'members' ? 'Members' : t === 'payments' ? 'Payments' : 'Archived payments'} <span className="ml-1">{t === 'members' ? data?.rows.length ?? 0 : t === 'payments' ? currentPayments.length : archivedPayments.length}</span></button>)}</div>
                    <label className="flex w-full min-w-0 items-center gap-2 text-ui-caption font-semibold text-slate-600 sm:w-auto">Show<select className={ADMIN_INPUT} value={filter} onChange={e => setFilter(e.target.value)}>
                        {(tab === 'members' ? [['all', 'All registrations'], ['registered', 'Application not submitted'], ['submitted', 'Applications submitted'], ['pending', 'Awaiting review'], ['awaiting_payment', 'Awaiting payment'], ['active', 'Active'], ['expired', 'Expired'], ['waived', 'Fee waived'], ['rejected', 'Rejected'], ['blocked', 'Blocked']] : [['all', 'All payments'], ['paid', 'Paid / confirmed'], ['created', 'Pending checkout'], ['waived', 'Fee waived'], ['failed', 'Failed'], ['cancelled', 'Cancelled']]).map(([v, text]) => <option key={v} value={v}>{text}</option>)}
                    </select></label>
                </div>
                {tab === 'archived' && <p className="text-ui-caption text-slate-500">Payments retained from deleted registrations. Export any records you need before permanently deleting an unnecessary payment.</p>}
                {tab === 'members' ? <AdminTable key={`members-${filter}`} rows={members} columns={memberColumns} minWidth="1296px" cardBreakpoint={1000} rowKey={r => r.id} loading={loading} searchable searchPlaceholder="Name, email, mobile, member number or plan" empty="No members match this filter." /> : <AdminTable key={`payments-${filter}`} rows={payments} columns={paymentColumns} sortable={false} pageResetKey={paymentSort} minWidth="1088px" cardBreakpoint={1088} rowKey={r => r.id} loading={loading} searchable searchPlaceholder="Name, email, order or payment reference" toolbar={<label className="flex w-full flex-wrap items-center gap-2 text-sm font-semibold text-slate-600 sm:w-auto"><span>Sort by</span><select aria-label="Sort payments" className={`${ADMIN_INPUT} w-full sm:w-60`} value={paymentSort} onChange={e => setPaymentSort(e.target.value)}>{PAYMENT_SORT_OPTIONS.map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></label>} empty="No payments match this filter." />}
            </main>
        </div>
        <Dialog open={modalOpen} onOpenChange={v => { if (!saving) setModalOpen(v); }}>
            <DialogContent className="w-[calc(100%-1rem)] sm:max-w-3xl max-h-[90dvh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-5 sm:p-6 border-b pr-12"><DialogTitle className={SECTION_TITLE}>{detail?.member.name || 'Membership details'}</DialogTitle><DialogDescription>{detail?.member.memberNumber || 'Registration and application details'}</DialogDescription></DialogHeader>
                <div className="overflow-y-auto min-h-0 flex-1 p-4 sm:p-6 space-y-5 text-ui-small">
                    {opening ? <div className="py-10 flex justify-center"><Loader2 className="animate-spin" /></div> : detail && <>
                        <section className={`${ADMIN_CARD} p-4 sm:p-5`}><h2 className={`${SECTION_TITLE} mb-4`}>Member details</h2><dl className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Field title="Name" value={detail.member.name} /><Field title="Registered" value={date(detail.member.registeredAt)} /><Field title="Email" value={detail.member.email} /><Field title="Mobile" value={detail.member.phone} /><Field title="Member type" value={label(detail.member.kind)} /><Field title="Region" value={detail.member.region} /><Field title="Application" value={detail.member.applicationStatus} /><Field title="Submitted" value={date(detail.member.submittedAt)} /></dl></section>
                        <section className={`${ADMIN_CARD} p-4 sm:p-5`}><h2 className={`${SECTION_TITLE} mb-4`}>Membership details</h2><dl className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Field title="Status" value={label(detail.member.status)} /><Field title="Plan" value={detail.member.planName || 'Not activated'} /><Field title="Activated" value={date(detail.member.activatedAt)} /><Field title="Valid until" value={detail.member.lifetime ? 'Lifetime' : membershipValidityLabel(detail.member.expiresAt)} /><Field title="Amount collected" value={rupees(detail.member.collected)} /><Field title="Confirmation" value={detail.member.confirmation} /></dl>{detail.member.applicationId && <a className="inline-block mt-4 font-semibold text-blue-600 underline" href={`/super-admin/approvals?application=${encodeURIComponent(detail.member.applicationId)}`}>Open application review</a>}</section>
                        <section className={`${ADMIN_CARD} p-4 sm:p-5`}><h2 className={`${SECTION_TITLE} mb-4`}>Payment history</h2>{detail.payments.length ? detail.payments.map(p => <div key={p.id} className="py-3 border-b last:border-0 space-y-1"><div className="flex flex-wrap justify-between gap-2"><span className="font-semibold">{p.planName} · {rupees(p.amount)}</span><Status value={p.status} /></div><p className="text-ui-caption text-slate-600">{p.mode === 'waived' ? 'Fee waived — no payment received' : label(p.mode)} · {date(p.paidAt || p.createdAt)}</p><p className="text-xs text-slate-500 break-all">Order: {p.orderId}</p>{p.paymentId && <p className="text-xs text-slate-500 break-all">Payment: {p.paymentId}</p>}{p.manual && <div className="rounded-lg bg-blue-50 p-3 text-ui-caption text-slate-700"><p>Confirmed by {p.manual.byName} on {date(p.manual.at)}</p><p>{p.manual.note}</p>{p.manual.waivedAmount > 0 && <p>Fee waived: {rupees(p.manual.waivedAmount)}</p>}</div>}</div>) : <p className="text-slate-500">No payment records yet.</p>}</section>
                        {showConfirm ? <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:p-5"><h2 className="text-lg font-bold mb-2">Confirm membership</h2><p className="text-ui-caption text-slate-600 mb-4">Initial membership requires complete Personal, Business and Declaration forms submitted for review. {detail.member.applicationStatus === 'Pending' ? 'This also approves the submitted application using the Super Admin review workflow. ' : ''}The member receives active dashboard access and membership confirmation by email and WhatsApp.</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><label className="text-ui-caption font-semibold">Membership plan<select aria-label="Membership plan" className={`${ADMIN_INPUT} mt-1 w-full`} value={planId} onChange={e => { const p = offeredPlans.find(p => p.id === e.target.value); setPlanId(e.target.value); setAmount(p ? String(p.price) : ''); setCommencementYear(y => p?.commencementYears.includes(y) ? y : ''); setAck(false); }}><option value="">Choose a plan</option>{offeredPlans.map(p => <option key={p.id} value={p.id}>{p.name} · {rupees(p.price)}</option>)}</select></label><label className="text-ui-caption font-semibold">Confirmation mode<select aria-label="Confirmation mode" className={`${ADMIN_INPUT} mt-1 w-full`} value={mode} onChange={e => setMode(e.target.value)}><option value="waived">Confirm without payment (fee waiver)</option><option value="cash">Cash received</option><option value="upi">UPI received</option><option value="bank_transfer">Bank transfer received</option><option value="cheque">Cheque received</option></select></label>{mode !== 'waived' && <><label className="text-ui-caption font-semibold">Actual amount received (₹)<input className={`${ADMIN_INPUT} mt-1 w-full`} type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></label><label className="text-ui-caption font-semibold">Receipt / transaction reference<input className={`${ADMIN_INPUT} mt-1 w-full`} value={receiptNumber} onChange={e => setReceiptNumber(e.target.value)} maxLength={120} /></label></>}<div className="sm:col-span-2 rounded-xl bg-white/70 px-3 py-2 text-ui-caption text-slate-600">{offeredPlans.length ? "Plans and year ranges follow this member's category and the current membership settings." : "No eligible plan is available. Check the member's category, commencement year and active plans."}</div>{selectedPlan?.audience === "business" && <label className="text-ui-caption font-semibold sm:col-span-2">Business commencement year<select aria-label="Business commencement year" className={`${ADMIN_INPUT} mt-1 w-full`} value={commencementYear} onChange={e => { setCommencementYear(e.target.value); setAck(false); }}><option value="">Choose commencement year</option>{selectedPlan.commencementYears.map(year => <option key={year} value={year}>{year}</option>)}</select><span className="mt-1 block text-ui-caption font-normal text-slate-500">{selectedPlan.name}: started {selectedPlan.commencementYearLabel}. The plan advances automatically as the business reaches the next configured range.</span></label>}<label className="text-ui-caption font-semibold sm:col-span-2">Membership ID<input aria-label="Membership ID" className={`${ADMIN_INPUT} mt-1 w-full uppercase`} value={detail.member.assignedMemberNumber || membershipNumber} readOnly={!!detail.member.assignedMemberNumber} onChange={e => setMembershipNumber(e.target.value.toUpperCase())} placeholder="ACTIV-BEG-20261012-001" maxLength={40} /><span className="mt-1 block text-ui-caption font-normal text-slate-500">{detail.member.assignedMemberNumber ? "The member keeps this ID when renewing." : "Enter the office membership ID, or leave blank to generate one automatically."}</span></label><label className="text-ui-caption font-semibold sm:col-span-2">{mode === 'waived' ? 'Reason for fee waiver' : 'Payment / confirmation notes'}<textarea className={`${ADMIN_INPUT} mt-1 w-full h-24`} value={note} onChange={e => setNote(e.target.value)} maxLength={500} /></label></div><p className="mt-3 text-ui-caption text-slate-600">{mode === 'waived' ? '₹0 will be recorded as collected. The waived plan fee and your reason stay in the audit record.' : 'Only the amount actually received is added to Collected.'}</p><label className="mt-4 flex items-start gap-3 font-semibold text-ui-caption"><input type="checkbox" className="mt-1 h-4 w-4" checked={ack} onChange={e => setAck(e.target.checked)} />I checked the submitted application and confirm the recorded payment or fee waiver.</label><div className="flex flex-wrap gap-3 mt-4"><button className={ADMIN_PRIMARY_BTN} disabled={saving || !ack} onClick={() => void submit()}>{saving && <Loader2 className="w-4 h-4 animate-spin" />} Confirm membership</button><button className={ADMIN_SECONDARY_BTN} disabled={saving} onClick={() => setShowConfirm(false)}>Back</button></div></section> : detail.member.canConfirm ? <button className={`${ADMIN_PRIMARY_BTN} w-full sm:w-auto`} onClick={() => setShowConfirm(true)}>Confirm membership / record payment</button> : <p className="rounded-xl bg-slate-50 p-3 text-ui-caption text-slate-600">{detail.member.blockedReason}</p>}
                    </>}
                </div>
                <div className="border-t p-4 flex flex-wrap justify-between gap-3">{detail && <button className={`${ADMIN_SECONDARY_BTN} text-rose-600`} disabled={saving} onClick={() => void remove()}><Trash2 className="h-4 w-4" />Delete registration</button>}<button className={ADMIN_SECONDARY_BTN} disabled={saving} onClick={() => setModalOpen(false)}>Close</button></div>
            </DialogContent>
        </Dialog>
    </div>;
}
