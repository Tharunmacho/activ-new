import { useEffect, useMemo, useState } from 'react';
import { Users, BadgeCheck, IndianRupee, Clock, RefreshCw, Download, Eye, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import AdminSidebar from './AdminSidebar';
import { AdminPageHeader, AdminStat, ADMIN_BG, ADMIN_PAGE, ADMIN_CARD, ADMIN_INPUT, ADMIN_PRIMARY_BTN, ADMIN_SECONDARY_BTN, rupees } from '@/features/admin/components/AdminUI';
import { SECTION_TITLE } from '@/components/layout/appTypography';
import { AdminTable, type AdminColumn } from '@/features/admin/components/AdminTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { loadMembershipDashboard, loadMembershipDetail, confirmMembership, deleteMembershipRegistration, type MembershipDashboard, type MembershipRegistration, type MembershipPayment, type MembershipDetail } from '@/services/membershipDashboardApi';
import { errorMessage } from '@/services/activApi';

const date = (v: string | null) => v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const label = (v: string) => v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const Status = ({ value }: { value: string }) => <span className={`inline-flex rounded-full px-3 py-1 text-[1.0625rem] font-semibold ${['active', 'paid', 'Approved'].includes(value) ? 'bg-emerald-50 text-emerald-700' : ['failed', 'rejected', 'Rejected', 'blocked', 'cancelled'].includes(value) ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>{label(value)}</span>;
const Field = ({ title, value }: { title: string; value: string }) => <div className="min-w-0 border-b border-slate-100 pb-3"><dt className="text-[0.9375rem] font-semibold uppercase tracking-wide text-slate-500">{title}</dt><dd className="mt-1 text-[1.1875rem] font-semibold text-slate-800 break-words">{value || '—'}</dd></div>;

/** Registered accounts, reviewed applications and membership receipts in one office view. */
export default function MembershipRegistrations() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [data, setData] = useState<MembershipDashboard | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [tab, setTab] = useState<'members' | 'payments' | 'archived'>('members');
    const [filter, setFilter] = useState('all');
    const [detail, setDetail] = useState<MembershipDetail | null>(null);
    const [opening, setOpening] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [planId, setPlanId] = useState('');
    const [mode, setMode] = useState('cash');
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [receiptNumber, setReceiptNumber] = useState('');
    const [ack, setAck] = useState(false);
    const chooseSummary = (nextTab: 'members' | 'payments', nextFilter: string) => { setTab(nextTab); setFilter(nextFilter); };
    const remove = async () => {
        if (!detail || !window.confirm(`Delete ${detail.member.name}'s registration? Their login and membership access will be disabled. Payment history stays available in the report. This does not refund payments.`)) return;
        setSaving(true);
        try { await deleteMembershipRegistration(detail.member.id); setModalOpen(false); setDetail(null); await load(); toast.success('Registration deleted. Payment history retained.'); }
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
    const open = async (id: string) => {
        setAck(false); setModalOpen(true); setOpening(true); setDetail(null); setShowConfirm(false); setNote(''); setReceiptNumber(''); setMode('cash'); setPlanId(''); setAmount('');
        try { setDetail(await loadMembershipDetail(id)); }
        catch (e) { toast.error(errorMessage(e, 'Could not load member details.')); setModalOpen(false); }
        finally { setOpening(false); }
    };
    const members = useMemo(() => (data?.rows || []).filter(r => filter === 'all' || (filter === 'submitted' ? !!r.applicationId : filter === 'waived' ? r.confirmation === 'Fee waived' : r.status === filter)), [data, filter]);
    const currentPayments = (data?.payments || []).filter(r => !r.registrationDeleted);
    const archivedPayments = (data?.payments || []).filter(r => r.registrationDeleted);
    const payments = useMemo(() => (data?.payments || []).filter(r => (tab === 'archived' ? !!r.registrationDeleted : !r.registrationDeleted) && (filter === 'all' || (filter === 'waived' ? r.mode === 'waived' && r.status === 'paid' : r.status === filter))), [data, filter, tab]);
    const memberColumns: AdminColumn<MembershipRegistration>[] = [
        { key: 'name', header: 'Member', sortValue: r => `${r.name} ${r.email} ${r.phone} ${r.memberNumber}`, render: r => <div><p className="font-bold text-slate-900">{r.name}</p><p className="text-[1.0625rem] text-slate-500 break-all">{r.email}</p><p className="text-[1.0625rem] text-slate-500">{r.phone}</p></div> },
        { key: 'registered', header: 'Registered', sortValue: r => r.registeredAt, render: r => date(r.registeredAt), hideOnMobile: true },
        { key: 'application', header: 'Application', sortValue: r => r.applicationStatus, render: r => <Status value={r.applicationStatus} /> },
        { key: 'plan', header: 'Plan', sortValue: r => `${r.planName} ${r.kind}`, render: r => <div>{r.planName || label(r.kind)}<p className="text-[1.0625rem] text-slate-500">{r.confirmation}</p></div> },
        { key: 'status', header: 'Membership', sortValue: r => r.status, render: r => <div><Status value={r.status} /><p className="mt-1 text-[1.0625rem] text-slate-500">{r.lifetime ? 'Lifetime' : r.expiresAt ? `Until ${date(r.expiresAt)}` : ''}</p></div> },
        { key: 'collected', header: 'Collected', sortValue: r => r.collected, render: r => rupees(r.collected), align: 'right' },
        { key: 'action', header: 'Action', sticky: 'right', render: r => <button className={ADMIN_PRIMARY_BTN} onClick={() => void open(r.id)}><Eye className="w-4 h-4" /> Details</button> }
    ];
    const paymentColumns: AdminColumn<MembershipPayment>[] = [
        { key: 'member', header: 'Member', sortValue: r => `${r.name} ${r.email}`, render: r => <div className="break-all"><p className="font-bold">{r.name || 'Member'}</p><p className="text-[1.0625rem] text-slate-500">{r.email}</p></div> },
        { key: 'order', header: 'Order reference', sortValue: r => r.orderId, render: r => <span className="text-[1.0625rem] break-all">{r.orderId}</span>, hideOnMobile: true, width: 'min-w-[14rem]' },
        { key: 'payment', header: 'Payment / receipt reference', sortValue: r => r.paymentId, render: r => <span className="text-[1.0625rem] break-all">{r.paymentId || '—'}</span>, width: 'min-w-[13rem]' },
        { key: 'plan', header: 'Plan', sortValue: r => r.planName, render: r => r.planName },
        { key: 'mode', header: 'Mode', sortValue: r => r.mode, render: r => r.mode === 'waived' ? 'Fee waived' : label(r.mode) },
        { key: 'status', header: 'Status', sortValue: r => r.status, render: r => <Status value={r.status} /> },
        { key: 'amount', header: 'Amount received', sortValue: r => r.amount, render: r => r.status === 'paid' ? rupees(r.amount) : <span className="text-slate-500">{rupees(r.amount)} due</span>, align: 'right' },
        { key: 'date', header: 'Date', sortValue: r => r.paidAt || r.createdAt, render: r => date(r.paidAt || r.createdAt), hideOnMobile: true },
        { key: 'action', header: 'Action', sticky: 'right', render: r => r.memberId && !r.registrationDeleted ? <button className={ADMIN_PRIMARY_BTN} onClick={() => void open(r.memberId)}>Details</button> : '—' }
    ];
    const submit = async () => {
        if (!detail || !planId || !note.trim() || !ack || (mode !== 'waived' && !(Number(amount) > 0))) { toast.error('Choose a plan, enter the amount and notes, and confirm the details below.'); return; }
        setSaving(true);
        try {
            const confirmed = await confirmMembership(detail.member.id, { planId, mode, amount: mode === 'waived' ? 0 : Number(amount), note, receiptNumber, manualAdmission: !!detail.member.requiresManualAdmission });
            setDetail(confirmed); setShowConfirm(false); toast.success('Membership confirmed. The member now has active dashboard access.'); await load();
        } catch (e) { toast.error(errorMessage(e, 'Could not confirm membership.')); }
        finally { setSaving(false); }
    };
    const exportReport = () => {
        const rows: (string | number)[][] = tab === 'members'
            ? [['Name', 'Email', 'Mobile', 'Registered', 'Application', 'Membership', 'Plan', 'Member number', 'Collected', 'Valid until', 'Confirmation'], ...members.map(r => [r.name, r.email, r.phone, date(r.registeredAt), r.applicationStatus, r.status, r.planName, r.memberNumber, r.collected, r.lifetime ? 'Lifetime' : date(r.expiresAt), r.confirmation])]
            : [['Name', 'Email', 'Order', 'Payment ID', 'Plan', 'Status', 'Mode', 'Order amount', 'Amount received', 'Date', 'Confirmed by', 'Note'], ...payments.map(r => [r.name, r.email, r.orderId, r.paymentId, r.planName, r.status, r.mode, r.amount, r.status === 'paid' ? r.amount : 0, date(r.paidAt || r.createdAt), r.manual?.byName || '', r.manual?.note || ''])];
        // Formula-like user text must stay text when the report is opened in Excel.
        const csv = rows.map(row => row.map(v => { let s = String(v ?? ''); if (/^[=+@\-\t\r]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; }).join(',')).join('\r\n');
        const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }));
        const a = document.createElement('a'); a.href = url; a.download = `membership-${tab}-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
    };
    const summary = data?.summary;
    return <div className={`flex h-screen ${ADMIN_BG}`}>
        <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <AdminPageHeader title="Membership registrations" subtitle="Registered accounts, applications and membership payments. Open a member to review or confirm their membership." onMenu={() => setSidebarOpen(true)} actions={<><button className={ADMIN_SECONDARY_BTN} disabled={!data || loading} onClick={exportReport}><Download className="w-4 h-4" /> Export report</button><button className={ADMIN_SECONDARY_BTN} onClick={() => void load()} disabled={loading}><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button></>} />
            <main className={`flex-1 overflow-y-auto ${ADMIN_PAGE}`}>
                {error && <div role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-rose-700">{error} <button className="underline" onClick={() => void load()}>Retry</button></div>}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <AdminStat primary icon={<Users className="w-5 h-5" />} label="Registered" value={String(summary?.registered ?? 0)} hint={`${summary?.submitted ?? 0} applications submitted`} tone="blue" onClick={() => chooseSummary('members', 'all')} />
                    <AdminStat icon={<BadgeCheck className="w-5 h-5" />} label="Active members" value={String(summary?.active ?? 0)} hint={`${summary?.waived ?? 0} fee-waiver confirmations`} tone="violet" onClick={() => chooseSummary('members', 'active')} />
                    <AdminStat icon={<IndianRupee className="w-5 h-5" />} label="Collected" value={rupees(summary?.collected ?? 0)} hint="money actually received" tone="emerald" onClick={() => chooseSummary('payments', 'paid')} />
                    <AdminStat icon={<Clock className="w-5 h-5" />} label="Awaiting payment" value={String(summary?.awaiting ?? 0)} hint={`${summary?.pendingReview ?? 0} awaiting review · ${summary?.expired ?? 0} expired`} tone="amber" onClick={() => chooseSummary('members', 'awaiting_payment')} />
                </div>
                <div className="flex flex-wrap items-center gap-3 my-6">
                    <div className="flex w-full flex-wrap gap-1 rounded-xl bg-slate-100 p-1 sm:w-auto">{(['members', 'payments', 'archived'] as const).map(t => <button key={t} onClick={() => { setTab(t); setFilter('all'); }} className={`min-h-11 flex-1 rounded-lg px-3 py-2 text-[1.0625rem] font-semibold sm:flex-none sm:px-4 ${tab === t ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}>{t === 'members' ? 'Members' : t === 'payments' ? 'Payments' : 'Archived payments'} <span className="ml-1">{t === 'members' ? data?.rows.length ?? 0 : t === 'payments' ? currentPayments.length : archivedPayments.length}</span></button>)}</div>
                    <label className="flex w-full min-w-0 items-center gap-2 text-[1.0625rem] font-semibold text-slate-600 sm:w-auto">Show<select className={ADMIN_INPUT} value={filter} onChange={e => setFilter(e.target.value)}>
                        {(tab === 'members' ? [['all', 'All registrations'], ['registered', 'Application not submitted'], ['submitted', 'Applications submitted'], ['pending', 'Awaiting review'], ['awaiting_payment', 'Awaiting payment'], ['active', 'Active'], ['expired', 'Expired'], ['waived', 'Fee waived'], ['rejected', 'Rejected'], ['blocked', 'Blocked']] : [['all', 'All payments'], ['paid', 'Paid / confirmed'], ['created', 'Pending checkout'], ['waived', 'Fee waived'], ['failed', 'Failed'], ['cancelled', 'Cancelled']]).map(([v, text]) => <option key={v} value={v}>{text}</option>)}
                    </select></label>
                </div>
                {tab === 'archived' && <p className="text-[1.0625rem] text-slate-500">Payments retained from deleted registrations, for accounting records.</p>}
                {tab === 'members' ? <AdminTable key={`members-${filter}`} rows={members} columns={memberColumns} rowKey={r => r.id} loading={loading} searchable searchPlaceholder="Name, email, mobile, member number or plan" empty="No members match this filter." /> : <AdminTable key={`payments-${filter}`} rows={payments} columns={paymentColumns} minWidth="1200px" cardBreakpoint={760} rowKey={r => r.id} loading={loading} searchable searchPlaceholder="Name, email, order or payment reference" empty="No payments match this filter." />}
            </main>
        </div>
        <Dialog open={modalOpen} onOpenChange={v => { if (!saving) setModalOpen(v); }}>
            <DialogContent className="w-[calc(100%-1rem)] sm:max-w-3xl max-h-[90dvh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-5 sm:p-6 border-b pr-12"><DialogTitle className={SECTION_TITLE}>{detail?.member.name || 'Membership details'}</DialogTitle><DialogDescription>{detail?.member.memberNumber || 'Registration and application details'}</DialogDescription></DialogHeader>
                <div className="overflow-y-auto min-h-0 flex-1 p-4 sm:p-6 space-y-5 text-[1.1875rem]">
                    {opening ? <div className="py-10 flex justify-center"><Loader2 className="animate-spin" /></div> : detail && <>
                        <section className={`${ADMIN_CARD} p-4 sm:p-5`}><h2 className={`${SECTION_TITLE} mb-4`}>Member details</h2><dl className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Field title="Name" value={detail.member.name} /><Field title="Registered" value={date(detail.member.registeredAt)} /><Field title="Email" value={detail.member.email} /><Field title="Mobile" value={detail.member.phone} /><Field title="Member type" value={label(detail.member.kind)} /><Field title="Region" value={detail.member.region} /><Field title="Application" value={detail.member.applicationStatus} /><Field title="Submitted" value={date(detail.member.submittedAt)} /></dl></section>
                        <section className={`${ADMIN_CARD} p-4 sm:p-5`}><h2 className={`${SECTION_TITLE} mb-4`}>Membership details</h2><dl className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Field title="Status" value={label(detail.member.status)} /><Field title="Plan" value={detail.member.planName || 'Not activated'} /><Field title="Activated" value={date(detail.member.activatedAt)} /><Field title="Valid until" value={detail.member.lifetime ? 'Lifetime' : date(detail.member.expiresAt)} /><Field title="Amount collected" value={rupees(detail.member.collected)} /><Field title="Confirmation" value={detail.member.confirmation} /></dl>{detail.member.applicationId && <a className="inline-block mt-4 font-semibold text-blue-600 underline" href={`/super-admin/approvals?application=${encodeURIComponent(detail.member.applicationId)}`}>Open application review</a>}</section>
                        <section className={`${ADMIN_CARD} p-4 sm:p-5`}><h2 className={`${SECTION_TITLE} mb-4`}>Payment history</h2>{detail.payments.length ? detail.payments.map(p => <div key={p.id} className="py-3 border-b last:border-0 space-y-1"><div className="flex flex-wrap justify-between gap-2"><span className="font-semibold">{p.planName} · {rupees(p.amount)}</span><Status value={p.status} /></div><p className="text-[1.0625rem] text-slate-600">{p.mode === 'waived' ? 'Fee waived — no payment received' : label(p.mode)} · {date(p.paidAt || p.createdAt)}</p><p className="text-xs text-slate-500 break-all">Order: {p.orderId}</p>{p.paymentId && <p className="text-xs text-slate-500 break-all">Payment: {p.paymentId}</p>}{p.manual && <div className="rounded-lg bg-blue-50 p-3 text-[1.0625rem] text-slate-700"><p>Confirmed by {p.manual.byName} on {date(p.manual.at)}</p><p>{p.manual.note}</p>{p.manual.waivedAmount > 0 && <p>Fee waived: {rupees(p.manual.waivedAmount)}</p>}</div>}</div>) : <p className="text-slate-500">No payment records yet.</p>}</section>
                        {showConfirm ? <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:p-5"><h2 className="text-lg font-bold mb-2">Confirm membership</h2><p className="text-[1.0625rem] text-slate-600 mb-4">{detail.member.requiresManualAdmission ? 'You are admitting this registered account directly after checking the member details. This records an office admission without inventing an application approval. ' : ''}{detail.member.applicationStatus === 'Pending' ? 'This also approves the submitted application using the Super Admin review workflow. ' : ''}The member receives active dashboard access and membership confirmation by email and WhatsApp.</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><label className="text-[1.0625rem] font-semibold">Membership plan<select aria-label="Membership plan" className={`${ADMIN_INPUT} mt-1 w-full`} value={planId} onChange={e => { setPlanId(e.target.value); setAmount(String(data?.plans.find(p => p.id === e.target.value)?.price || '')); }}><option value="">Choose a plan</option>{data?.plans.map(p => <option key={p.id} value={p.id}>{p.name} · {rupees(p.price)}</option>)}</select></label><label className="text-[1.0625rem] font-semibold">Confirmation mode<select aria-label="Confirmation mode" className={`${ADMIN_INPUT} mt-1 w-full`} value={mode} onChange={e => setMode(e.target.value)}><option value="waived">Confirm without payment (fee waiver)</option><option value="cash">Cash received</option><option value="upi">UPI received</option><option value="bank_transfer">Bank transfer received</option><option value="cheque">Cheque received</option></select></label>{mode !== 'waived' && <><label className="text-[1.0625rem] font-semibold">Actual amount received (₹)<input className={`${ADMIN_INPUT} mt-1 w-full`} type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></label><label className="text-[1.0625rem] font-semibold">Receipt / transaction reference<input className={`${ADMIN_INPUT} mt-1 w-full`} value={receiptNumber} onChange={e => setReceiptNumber(e.target.value)} maxLength={120} /></label></>}<label className="text-[1.0625rem] font-semibold sm:col-span-2">{mode === 'waived' ? 'Reason for fee waiver' : 'Payment / confirmation notes'}<textarea className={`${ADMIN_INPUT} mt-1 w-full h-24`} value={note} onChange={e => setNote(e.target.value)} maxLength={500} /></label></div><p className="mt-3 text-[1.0625rem] text-slate-600">{mode === 'waived' ? '₹0 will be recorded as collected. The waived plan fee and your reason stay in the audit record.' : 'Only the amount actually received is added to Collected.'}</p><label className="mt-4 flex items-start gap-3 font-semibold text-[1.0625rem]"><input type="checkbox" className="mt-1 h-4 w-4" checked={ack} onChange={e => setAck(e.target.checked)} />{detail.member.requiresManualAdmission ? "I checked this member's details and authorise office admission with the recorded payment or waiver." : "I checked the member details and confirm the recorded payment or fee waiver."}</label><div className="flex flex-wrap gap-3 mt-4"><button className={ADMIN_PRIMARY_BTN} disabled={saving || !ack} onClick={() => void submit()}>{saving && <Loader2 className="w-4 h-4 animate-spin" />} Confirm membership</button><button className={ADMIN_SECONDARY_BTN} disabled={saving} onClick={() => setShowConfirm(false)}>Back</button></div></section> : detail.member.canConfirm ? <button className={`${ADMIN_PRIMARY_BTN} w-full sm:w-auto`} onClick={() => setShowConfirm(true)}>Confirm membership / record payment</button> : <p className="rounded-xl bg-slate-50 p-3 text-[1.0625rem] text-slate-600">{detail.member.blockedReason}</p>}
                    </>}
                </div>
                <div className="border-t p-4 flex flex-wrap justify-between gap-3">{detail && <button className={`${ADMIN_SECONDARY_BTN} text-rose-600`} disabled={saving} onClick={() => void remove()}><Trash2 className="h-4 w-4" />Delete registration</button>}<button className={ADMIN_SECONDARY_BTN} disabled={saving} onClick={() => setModalOpen(false)}>Close</button></div>
            </DialogContent>
        </Dialog>
    </div>;
}
