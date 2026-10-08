import { useCallback, useEffect, useMemo, useState } from 'react';
import PlatinumRequestDetails from './PlatinumRequestDetails';
import {
    Crown, Search, Loader2, Check, Undo2, X, ShieldCheck, Infinity as InfinityIcon, Receipt,
    Phone, MessageCircle, Mail, Inbox, PhoneCall, Building2, MapPin, Clock, FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage, getRegionTree } from '@/services/activApi';
import { ADMIN_INPUT, ADMIN_PRIMARY_BTN, ADMIN_SECONDARY_BTN } from '@/features/admin/components/AdminUI';
import { CARD_TITLE, CARD_SUBTITLE } from '@/components/layout/appTypography';
import { PlatinumBadge } from '@/components/shared/Platinum';
import {
    getPlatinumOverview, searchPlatinumCandidates, grantPlatinum, revokePlatinum, createPlatinumAccount, updatePlatinumAccount,
    PAYMENT_MODE_LABEL, type PlatinumCandidate, type PlatinumPaymentMode, type PlatinumOverview,
    listPlatinumRequests, updatePlatinumRequest, type PlatinumRequest, type PlatinumRequestStatus,
} from '@/services/platinumApi';

/**
 * PLATINUM LIFETIME MEMBERS — granted here, paid at the office.
 *
 * The fee (₹2,00,000 by default — the `platinum` plan row above) is taken in
 * cash, cheque or transfer and never through the online checkout. The Super
 * Admin finds the member, records the receipt and grants; the member's
 * membership becomes lifetime (no renewal, ever) with a Platinum badge on their
 * dashboard and certificate. Only an approved applicant or an existing member
 * can be granted — the server says why when not.
 *
 * Inline panels rather than a dialog (RULE 2 / the phone standard).
 */

const rupees = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const day = (v?: string | null) => {
    if (!v) return '';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
const today = () => new Date().toISOString().slice(0, 10);
const FIELD_LABEL = 'block text-[1.1875rem] font-semibold text-slate-700';
const region = (m: PlatinumCandidate) => [m.block, m.district, m.state].filter(Boolean).join(', ');

function OfficeAccountForm({ onCreated }: { onCreated: (m: PlatinumCandidate) => void }) {
    const [form, setForm] = useState({ fullName: '', email: '', password: '', phoneNumber: '', whatsappNumber: '', state: '', district: '', block: '' });
    const [busy, setBusy] = useState(false);
    const [states, setStates] = useState<any[]>([]);
    const [regionsLoading, setRegionsLoading] = useState(true);
    const [regionError, setRegionError] = useState('');
    const loadRegions = useCallback(async (force = false) => {
        setRegionsLoading(true); setRegionError('');
        try { const tree = await getRegionTree(force, 'all'); setStates(tree.states); }
        catch (err) { setRegionError(errorMessage(err, 'Could not load registration regions.')); }
        finally { setRegionsLoading(false); }
    }, []);
    useEffect(() => { void loadRegions(); }, [loadRegions]);
    const districts = states.find(s => s.name === form.state)?.districts || [];
    const blocks = districts.find((d: any) => d.name === form.district)?.blocks || [];
    const selectExisting = async () => {
        const email = form.email.trim().toLowerCase();
        const phone = form.phoneNumber.replace(/\D/g, '').slice(-10);
        if (!email && phone.length !== 10) { toast.error('Enter the existing member’s email or 10-digit mobile number.'); return; }
        setBusy(true);
        try {
            const matches = await searchPlatinumCandidates(email || phone);
            const member = matches.find(m => email ? m.email.toLowerCase() === email : m.phoneNumber.replace(/\D/g, '').slice(-10) === phone);
            if (!member) { toast.info('No account matches. Use the new account fields below if this member has never registered.'); return; }
            if (member.blockedReason && !member.canAdmitManually) { toast.error(member.blockedReason); return; }
            setForm(f => ({ ...f, password: '' }));
            onCreated(member); toast.success('Existing account selected. Its login and contact details are retained.');
        } catch (err) { toast.error(errorMessage(err, 'Could not find the existing member.')); }
        finally { setBusy(false); }
    };
    const submit = async () => {
        if (!form.email.trim() && form.phoneNumber.replace(/\D/g, '').length < 10) { toast.error('Enter the member email or mobile number.'); return; }
        setBusy(true);
        try {
            const member = await createPlatinumAccount(form);
            setForm({ fullName: '', email: '', password: '', phoneNumber: '', whatsappNumber: '', state: '', district: '', block: '' });
            onCreated(member); toast.success(member.existingAccount ? 'Existing account selected. Record payment to upgrade; login details are retained.' : 'Account created. Record payment to activate Lifetime.');
        } catch (e) { toast.error(errorMessage(e, 'Could not create account.')); }
        finally { setBusy(false); }
    };
    return <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:p-5 font-sans"><h3 className={CARD_TITLE}>Member account for Lifetime</h3><p className={`mt-2 text-slate-600 ${CARD_SUBTITLE}`}>Existing business members keep the same email, password and mobile when upgrading to Lifetime. Enter their email or mobile and select their existing account. Fill all fields only for a new member.</p>
        <button type="button" disabled={busy} onClick={() => void selectExisting()} className={`mt-4 ${ADMIN_SECONDARY_BTN} h-auto min-h-12 py-3 max-w-full !whitespace-normal`}>Use existing account / upgrade</button>
        {regionError && <p role="alert" className="mt-3 text-red-700">{regionError} <button type="button" className="underline" onClick={() => void loadRegions(true)}>Retry</button></p>}
        {!regionsLoading && !regionError && !states.length && <p role="status" className="mt-3 text-slate-600">Location data is unavailable. Reload regions to try again.</p>}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {(['fullName', 'email', 'password', 'phoneNumber', 'whatsappNumber'] as const).map(key => <label key={key} className={`min-w-0 ${FIELD_LABEL}`}>{{ fullName: 'Full name', email: 'Email', password: 'Password', phoneNumber: 'Mobile', whatsappNumber: 'WhatsApp number' }[key]}<input className={`mt-2 ${ADMIN_INPUT} font-normal`} type={key === 'password' ? 'password' : key === 'email' ? 'email' : 'text'} inputMode={key === 'phoneNumber' || key === 'whatsappNumber' ? 'tel' : undefined} autoComplete={key === 'password' ? 'new-password' : 'off'} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} /></label>)}
            <label className={`min-w-0 ${FIELD_LABEL}`}>State<select className={`mt-2 ${ADMIN_INPUT} font-normal`} aria-label="State" value={form.state} disabled={regionsLoading || busy || !states.length} onChange={e => setForm(f => ({ ...f, state: e.target.value, district: '', block: '' }))}><option value="">{regionsLoading ? 'Loading regions…' : 'Choose state'}</option>{states.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}</select></label>
            <label className={`min-w-0 ${FIELD_LABEL}`}>District<select className={`mt-2 ${ADMIN_INPUT} font-normal`} aria-label="District" value={form.district} disabled={!form.state || busy || !districts.length} onChange={e => setForm(f => ({ ...f, district: e.target.value, block: '' }))}><option value="">Choose district</option>{districts.map((d: any) => <option key={d.name} value={d.name}>{d.name}</option>)}</select></label>
            <label className={`min-w-0 ${FIELD_LABEL}`}>Block<select className={`mt-2 ${ADMIN_INPUT} font-normal`} aria-label="Block" value={form.block} disabled={!form.district || busy || !blocks.length} onChange={e => setForm(f => ({ ...f, block: e.target.value }))}><option value="">{form.district && !blocks.length ? 'No development blocks — district only' : 'Choose block'}</option>{blocks.map((b: any) => <option key={b.name} value={b.name}>{b.name}</option>)}</select></label>
        </div><button type="button" disabled={busy || (!form.email.trim() && !form.phoneNumber.trim())} onClick={() => void submit()} className={`mt-5 ${ADMIN_PRIMARY_BTN} h-auto min-h-12 py-3 w-full sm:w-auto !whitespace-normal`}>{busy ? 'Creating…' : 'Continue to Lifetime payment'}</button></div>;
}

function AccountEditor({ member, onSaved }: { member: PlatinumCandidate; onSaved: (m: PlatinumCandidate) => void }) {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ email: member.email, phoneNumber: member.phoneNumber, whatsappNumber: member.whatsappNumber || member.phoneNumber, password: '' });
    const [busy, setBusy] = useState(false);
    const save = async () => {
        setBusy(true);
        try {
            const updated = await updatePlatinumAccount(member.id, { ...form, password: form.password || undefined });
            if (!updated?.id) throw new Error('Account update could not be confirmed.');
            setForm(f => ({ ...f, password: '' })); onSaved(updated); setOpen(false);
            toast.success('Login and contact details saved. Use the saved email and password to sign in.');
        } catch (err) { toast.error(errorMessage(err, 'Could not save account details.')); }
        finally { setBusy(false); }
    };
    return <div className="my-3">
        <button type="button" className={ADMIN_SECONDARY_BTN} onClick={() => setOpen(!open)}>Edit login and contact details</button>
        {open && <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-slate-600">Changes update this member's account. Leave the new password blank to keep the current password.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">{(['email', 'phoneNumber', 'whatsappNumber', 'password'] as const).map(key => <label key={key} className={FIELD_LABEL}>
                {{ email: 'Login email', phoneNumber: 'Mobile number', whatsappNumber: 'WhatsApp number', password: 'New password' }[key]}
                <input className={`mt-2 ${ADMIN_INPUT}`} type={key === 'password' ? 'password' : key === 'email' ? 'email' : 'tel'} autoComplete={key === 'password' ? 'new-password' : 'off'} value={form[key]} disabled={busy} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
            </label>)}</div>
            <button type="button" disabled={busy} className={`mt-4 ${ADMIN_PRIMARY_BTN}`} onClick={() => void save()}>{busy ? 'Saving…' : 'Save account details'}</button>
        </div>}
    </div>;
}

function GrantForm({ member, price, onDone, onCancel }: {
    member: PlatinumCandidate; price: number; onDone: (m: PlatinumCandidate) => void; onCancel: () => void;
}) {
    const [amount, setAmount] = useState(String(price || ''));
    const [mode, setMode] = useState<PlatinumPaymentMode>('cash');
    const [receipt, setReceipt] = useState('');
    const [receivedOn, setReceivedOn] = useState(today());
    const [note, setNote] = useState('');
    const [confirmed, setConfirmed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [manualAdmission, setManualAdmission] = useState(false);

    const submit = async () => {
        const value = Number(amount);
        if (!Number.isFinite(value) || value <= 0) { toast.error('Enter the actual positive amount received'); return; }
        if (member.blockedReason && (!manualAdmission || !note.trim())) { toast.error('Confirm office admission and enter its reason.'); return; }
        if (value !== price && !note.trim()) { toast.error('Explain the difference from the Lifetime fee.'); return; }
        if (!confirmed) { toast.error('Tick the box to confirm the payment was received'); return; }
        setBusy(true);
        try {
            const updated = await grantPlatinum(member.id, {
                amount: value, paymentMode: mode, receiptNumber: receipt.trim(), receivedOn, note: note.trim(), manualAdmission,
            });
            toast.success(`${member.fullName || 'The member'} is now a Lifetime Member`);
            onDone(updated);
        } catch (err) {
            toast.error(errorMessage(err, 'Could not grant Lifetime'));
        } finally {
            setBusy(false);
        }
    };

    const field = `mt-2 ${ADMIN_INPUT} font-normal`;

    return (
        <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/50 p-3 sm:p-4">
            <p className="flex items-center gap-2 text-[1.125rem] font-semibold text-slate-800">
                <Receipt className="h-4 w-4 text-blue-700" /> Record the payment received at the office
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {member.blockedReason && <label className="sm:col-span-2 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-slate-700"><input type="checkbox" checked={manualAdmission} onChange={e => setManualAdmission(e.target.checked)} className="mt-1" /><span>I admit this member directly as Super Admin after office payment. Their application is not marked approved; my admission reason must be recorded below.</span></label>}
                <label className={`min-w-0 ${FIELD_LABEL}`}>Amount received (₹)
                    <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} className={field} />
                </label>
                <label className={`min-w-0 ${FIELD_LABEL}`}>Paid by
                    <select value={mode} onChange={(e) => setMode(e.target.value as PlatinumPaymentMode)} className={field}>
                        {(Object.keys(PAYMENT_MODE_LABEL) as PlatinumPaymentMode[]).map((k) => (
                            <option key={k} value={k}>{PAYMENT_MODE_LABEL[k]}</option>
                        ))}
                    </select>
                </label>
                <label className={`min-w-0 ${FIELD_LABEL}`}>Receipt / cheque / UTR no.
                    <input value={receipt} onChange={(e) => setReceipt(e.target.value)} placeholder="Optional" className={field} />
                </label>
                <label className={`min-w-0 ${FIELD_LABEL}`}>Received on
                    <input type="date" value={receivedOn} max={today()} onChange={(e) => setReceivedOn(e.target.value)} className={field} />
                </label>
                <label className={`min-w-0 sm:col-span-2 ${FIELD_LABEL}`}>Note
                    <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional — e.g. received at the Chennai office" className={field} />
                </label>
            </div>
            {Number(amount) !== Number(price) && amount !== '' ? (
                <p className="mt-2 text-[1rem] text-amber-700">
                    This differs from the Lifetime price of {rupees(price)}. That is allowed — the amount received is what is recorded.
                </p>
            ) : null}
            <label className="mt-3 flex items-start gap-2 text-[1.125rem] text-slate-700">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 h-4 w-4 accent-blue-600" />
                <span>I confirm {rupees(Number(amount) || 0)} has been received from <strong>{member.fullName || 'this member'}</strong>.
                    Their membership becomes lifetime and never needs renewing.</span>
            </label>
            <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={onCancel} disabled={busy}
                    className={ADMIN_SECONDARY_BTN}>
                    <X className="h-4 w-4" /> Cancel
                </button>
                <button type="button" onClick={submit} disabled={busy || !confirmed}
                    className={ADMIN_PRIMARY_BTN}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />} Grant Lifetime
                </button>
            </div>
        </div>
    );
}

const CONTACT_LABEL: Record<string, string> = { call: 'Phone call', whatsapp: 'WhatsApp', email: 'Email' };
const STATUS_CHIP: Record<string, string> = {
    new: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
    contacted: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    converted: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    declined: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
};
const STATUS_WORD: Record<string, string> = { new: 'New', contacted: 'Contacted', converted: 'Lifetime granted', declined: 'Declined' };
const digits = (v: string) => String(v || '').replace(/\D/g, '');
const waNumber = (v: string) => { const d = digits(v); return d.length === 10 ? `91${d}` : d; };

/**
 * PLATINUM REQUESTS — members who pressed "Apply for Platinum".
 *
 * The office and every Super Admin are emailed the moment one arrives; this
 * is the queue to work through: call them, mark contacted, and once the fee
 * is received grant it here — which closes the request by itself.
 */
function PlatinumRequests({ price, onGranted }: { price: number; onGranted: () => void }) {
    const [tab, setTab] = useState<'new' | 'contacted' | 'all'>('new');
    const [rows, setRows] = useState<PlatinumRequest[]>([]);
    const [counts, setCounts] = useState<Record<string, number>>({ new: 0, contacted: 0, all: 0 });
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState('');
    const [granting, setGranting] = useState('');
    const [declining, setDeclining] = useState('');
    const [note, setNote] = useState('');
    /** The request whose full member record is open. */
    const [detailsFor, setDetailsFor] = useState('');

    const load = useCallback(async () => {
        try {
            const r = await listPlatinumRequests(tab === 'all' ? 'all' : tab);
            setRows(r.requests || []);
            setCounts(r.counts || {});
        } catch (err) {
            toast.error(errorMessage(err, 'Could not load Lifetime requests'));
        } finally {
            setLoading(false);
        }
    }, [tab]);
    useEffect(() => { setLoading(true); load(); }, [load]);

    const setStatus = async (r: PlatinumRequest, status: PlatinumRequestStatus, notes?: string) => {
        setBusy(r.id);
        try {
            await updatePlatinumRequest(r.id, { status, ...(notes !== undefined ? { notes } : {}) });
            toast.success(status === 'contacted' ? 'Marked as contacted' : status === 'declined' ? 'Request declined' : 'Updated');
            setDeclining(''); setNote('');
            load();
        } catch (err) {
            toast.error(errorMessage(err, 'Could not update the request'));
        } finally {
            setBusy('');
        }
    };

    const TABS: { key: 'new' | 'contacted' | 'all'; label: string }[] = [
        { key: 'new', label: 'New' }, { key: 'contacted', label: 'Contacted' }, { key: 'all', label: 'All' },
    ];

    return (
        <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/40 p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="flex items-center gap-2 font-display text-[1.5rem] font-semibold text-slate-900">
                        <Inbox className="h-5 w-5 text-blue-700" /> Lifetime requests
                    </h3>
                    <p className="text-[1.0625rem] text-slate-500">Members who asked to become Lifetime. Call them, then grant it once the payment is received.</p>
                </div>
                <div className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-slate-200">
                    {TABS.map((t) => (
                        <button key={t.key} type="button" onClick={() => setTab(t.key)}
                            className={`min-h-10 rounded-lg px-3 text-[1.0625rem] font-semibold ${tab === t.key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                            {t.label}{typeof counts[t.key] === 'number' ? <span className="ml-1.5 opacity-80">{counts[t.key]}</span> : null}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <p className="mt-4 flex items-center gap-2 text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
            ) : rows.length === 0 ? (
                <p className="mt-4 rounded-xl bg-white p-4 text-[1.0625rem] text-slate-500 ring-1 ring-slate-100">
                    {tab === 'new' ? 'No new requests. When a member presses “Apply for Lifetime”, it appears here and the office is emailed.' : 'Nothing here yet.'}
                </p>
            ) : (
                <ul className="mt-4 space-y-3">
                    {rows.map((r) => {
                        const regionText = [r.block, r.district, r.state].filter(Boolean).join(', ');
                        const openRow = r.status === 'new' || r.status === 'contacted';
                        return (
                            <li key={r.id} className="rounded-2xl bg-white p-3 sm:p-4 ring-1 ring-slate-200">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0 flex-1">
                                        <p className="flex flex-wrap items-center gap-2">
                                            <span className="truncate text-[1.1875rem] font-semibold text-slate-900">{r.name || 'Member'}</span>
                                            <span className={`rounded-full px-2.5 py-0.5 text-[0.9375rem] font-semibold ${STATUS_CHIP[r.status] || STATUS_CHIP.new}`}>
                                                {STATUS_WORD[r.status] || r.status}
                                            </span>
                                            <span className="text-[0.9375rem] text-slate-400">{day(r.createdAt)}</span>
                                        </p>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {r.phone ? (
                                                <a href={`tel:${digits(r.phone)}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 text-[1rem] font-semibold text-blue-700 hover:bg-blue-100">
                                                    <Phone className="h-4 w-4" /> {r.phone}
                                                </a>
                                            ) : null}
                                            {r.phone ? (
                                                <a href={`https://wa.me/${waNumber(r.phone)}`} target="_blank" rel="noopener noreferrer"
                                                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 text-[1rem] font-semibold text-emerald-700 hover:bg-emerald-100">
                                                    <MessageCircle className="h-4 w-4" /> WhatsApp
                                                </a>
                                            ) : null}
                                            {r.email ? (
                                                <a href={`mailto:${r.email}?subject=${encodeURIComponent('Your ACTIV Lifetime Membership request')}`}
                                                    className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 text-[1rem] font-semibold text-slate-700 hover:bg-slate-100">
                                                    <Mail className="h-4 w-4 shrink-0" /> <span className="truncate">{r.email}</span>
                                                </a>
                                            ) : null}
                                            <button type="button" aria-expanded={detailsFor === r.id}
                                                onClick={() => setDetailsFor(detailsFor === r.id ? '' : r.id)}
                                                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-2.5 text-[1rem] font-semibold text-blue-700 hover:bg-blue-50">
                                                <FileText className="h-4 w-4" /> {detailsFor === r.id ? 'Hide details' : 'View full details'}
                                            </button>
                                        </div>
                                        <dl className="mt-2 grid gap-x-4 gap-y-1 text-[1rem] text-slate-600 sm:grid-cols-2">
                                            <div className="flex min-w-0 items-center gap-1.5"><PhoneCall className="h-4 w-4 shrink-0 text-slate-400" />
                                                <span className="truncate">Prefers {CONTACT_LABEL[r.preferredContact] || 'a call'}{r.preferredTime ? ` · ${r.preferredTime}` : ''}</span></div>
                                            {regionText ? <div className="flex min-w-0 items-center gap-1.5"><MapPin className="h-4 w-4 shrink-0 text-slate-400" /><span className="truncate">{regionText}</span></div> : null}
                                            {r.companyName ? <div className="flex min-w-0 items-center gap-1.5"><Building2 className="h-4 w-4 shrink-0 text-slate-400" /><span className="truncate">{r.companyName}</span></div> : null}
                                            {r.handledBy ? <div className="flex min-w-0 items-center gap-1.5"><Clock className="h-4 w-4 shrink-0 text-slate-400" /><span className="truncate">{r.handledBy} · {day(r.handledAt)}</span></div> : null}
                                        </dl>
                                        {r.message ? <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[1rem] text-slate-700 [overflow-wrap:anywhere]">“{r.message}”</p> : null}
                                        {r.notes ? <p className="mt-1 text-[0.9375rem] text-slate-500 [overflow-wrap:anywhere]">Note: {r.notes}</p> : null}
                                    </div>

                                    {openRow && granting !== r.id && declining !== r.id ? (
                                        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col lg:w-52">
                                            {r.status === 'new' ? (
                                                <button type="button" disabled={busy === r.id} onClick={() => setStatus(r, 'contacted')}
                                                    className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 font-semibold text-blue-700 hover:bg-blue-50">
                                                    {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Mark contacted
                                                </button>
                                            ) : null}
                                            <button type="button" onClick={() => setGranting(r.id)} disabled={!!r.blockedReason && !r.canAdmitManually}
                                                title={r.blockedReason || undefined}
                                                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 font-semibold text-white disabled:opacity-50">
                                                <Crown className="h-4 w-4" /> Grant Lifetime
                                            </button>
                                            <button type="button" onClick={() => { setDeclining(r.id); setNote(''); }}
                                                className="min-h-10 rounded-xl px-3 font-semibold text-slate-500 hover:bg-slate-50">Decline</button>
                                            {r.blockedReason ? <p className="text-[0.9375rem] text-amber-700">{r.blockedReason}</p> : null}
                                        </div>
                                    ) : null}
                                </div>

                                {detailsFor === r.id ? <PlatinumRequestDetails requestId={r.id} /> : null}

                                {declining === r.id ? (
                                    <div className="mt-3 flex flex-col gap-2 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-center">
                                        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (optional, for your records)"
                                            className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-[1.0625rem] outline-none focus:border-blue-500" />
                                        <div className="flex gap-2">
                                            <button type="button" onClick={() => setDeclining('')} className="min-h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 font-semibold text-slate-600">Keep</button>
                                            <button type="button" disabled={busy === r.id} onClick={() => setStatus(r, 'declined', note.trim())}
                                                className="min-h-10 flex-1 rounded-xl bg-slate-700 px-3 font-semibold text-white">Decline</button>
                                        </div>
                                    </div>
                                ) : null}

                                {granting === r.id ? (
                                    <GrantForm
                                        member={{ id: r.memberId, fullName: r.name } as PlatinumCandidate}
                                        price={price}
                                        onCancel={() => setGranting('')}
                                        onDone={() => { setGranting(''); load(); onGranted(); }}
                                    />
                                ) : null}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

export default function PlatinumMembers() {
    const [overview, setOverview] = useState<PlatinumOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState('');
    const [results, setResults] = useState<PlatinumCandidate[]>([]);
    const [searching, setSearching] = useState(false);
    const [granting, setGranting] = useState<string>('');
    const [undoing, setUndoing] = useState<string>('');
    const [undoBusy, setUndoBusy] = useState(false);
    const [creating, setCreating] = useState(false);
    const [created, setCreated] = useState<PlatinumCandidate | null>(null);
    const accountSaved = (member: PlatinumCandidate) => {
        setCreated(current => current?.id === member.id ? member : current);
        setResults(current => current.map(row => row.id === member.id ? member : row));
        setOverview(current => current ? { ...current, members: current.members.map(row => row.id === member.id ? member : row) } : current);
    };

    const load = useCallback(async () => {
        try { setOverview(await getPlatinumOverview()); }
        catch (err) { toast.error(errorMessage(err, 'Could not load Lifetime members')); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    // Debounced search — one request per pause in typing.
    useEffect(() => {
        const text = q.trim();
        if (text.length < 2) { setResults([]); return undefined; }
        let cancelled = false;
        setSearching(true);
        const t = window.setTimeout(async () => {
            try { const r = await searchPlatinumCandidates(text); if (!cancelled) setResults(r || []); }
            catch { if (!cancelled) setResults([]); }
            finally { if (!cancelled) setSearching(false); }
        }, 300);
        return () => { cancelled = true; window.clearTimeout(t); };
    }, [q]);

    const price = overview?.plan?.price || 200000;
    const members = useMemo(() => overview?.members || [], [overview]);

    const onGranted = (m: PlatinumCandidate) => {
        setGranting('');
        setResults((rs) => rs.map((r) => (r.id === m.id ? m : r)));
        load();
    };

    const undo = async (m: PlatinumCandidate) => {
        setUndoBusy(true);
        try {
            await revokePlatinum(m.id);
            toast.success(`Lifetime removed from ${m.fullName || 'the member'}; their earlier membership is restored`);
            setUndoing('');
            load();
        } catch (err) {
            toast.error(errorMessage(err, 'Could not remove Lifetime'));
        } finally {
            setUndoBusy(false);
        }
    };

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
            <button type="button" className={`mb-4 ${ADMIN_PRIMARY_BTN} h-auto min-h-12 py-3 max-w-full !whitespace-normal`} onClick={() => setCreating(v => !v)}>Create an office member account</button>
            {creating && <OfficeAccountForm onCreated={m => { setCreated(m); setCreating(false); }} />}
            {created && <div className="mb-6 rounded-xl border border-blue-200 p-4"><h3 className="font-bold">Selected account: {created.fullName}</h3><p className="text-slate-600">Sign-in email: {created.email}. Edit the login or contact details below if needed, then record payment to activate lifetime membership.</p><AccountEditor key={created.id} member={created} onSaved={accountSaved} /><GrantForm member={created} price={price} onDone={m => { setCreated(null); onGranted(m); }} onCancel={() => setCreated(null)} /></div>}
            {/* ---- the offer ---- */}
            <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#0b1f5c] via-[#1e3a8a] to-[#2563eb] p-4 sm:p-5 text-white">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="flex items-center gap-2 text-[1rem] font-semibold uppercase tracking-[0.18em] text-[#f8e7b0]">
                            <Crown className="h-4 w-4" /> Lifetime Membership
                        </p>
                        <p className="mt-1 font-display text-[2rem] sm:text-[2.5rem] font-bold">{rupees(price)}</p>
                        <p className="text-[1.125rem] text-white/75">One payment at the office · never renews · granted here</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="rounded-xl bg-white/10 px-3 py-2">
                            <p className="font-display text-[1.625rem] font-bold">{loading ? '—' : members.length}</p>
                            <p className="text-[1.125rem] text-white/70">Lifetime members</p>
                        </div>
                        <div className="rounded-xl bg-white/10 px-3 py-2">
                            <p className="grid place-items-center"><InfinityIcon className="h-6 w-6" /></p>
                            <p className="text-[1.125rem] text-white/70">Validity</p>
                        </div>
                    </div>
                </div>
                <p className="mt-3 text-[1rem] text-white/60">
                    The price is the Lifetime plan in the list above — edit it there. Members see it advertised on their dashboard.
                </p>
            </div>

            {/* ---- who asked ---- */}
            <PlatinumRequests price={price} onGranted={load} />

            {/* ---- grant ---- */}
            <div className="mt-5">
                <h3 className="font-display text-[1.5rem] font-semibold text-slate-900">Make a member Lifetime</h3>
                <p className="text-[1.125rem] text-slate-500">Search by name, email, mobile or Member ID. Their application must be approved.</p>
                <div className="relative mt-3">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Start typing a name, email or number…"
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-[1.125rem] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                    {searching ? <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" /> : null}
                </div>

                {q.trim().length >= 2 && !searching && results.length === 0 ? (
                    <p className="mt-3 text-[1.125rem] text-slate-500">No member matches “{q.trim()}”.</p>
                ) : null}

                <ul className="mt-3 space-y-2">
                    {results.map((m) => (
                        <li key={m.id} className="rounded-xl border border-slate-200 p-3">
                            <AccountEditor member={m} onSaved={accountSaved} />
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                                        <span className="truncate">{m.fullName || 'Unnamed member'}</span>
                                        {m.membershipTier === 'platinum' ? <PlatinumBadge size="sm" /> : null}
                                    </p>
                                    <p className="truncate text-[1.0625rem] text-slate-500">{[m.email, m.phoneNumber].filter(Boolean).join(' · ')}</p>
                                    <p className="truncate text-[1rem] text-slate-400">{[m.membershipNumber, region(m)].filter(Boolean).join(' · ')}</p>
                                </div>
                                {m.membershipTier === 'platinum' ? (
                                    <span className="inline-flex items-center gap-1 text-[1.0625rem] font-semibold text-emerald-700"><Check className="h-4 w-4" /> Lifetime</span>
                                ) : m.blockedReason && !m.canAdmitManually ? (
                                    <span className="text-[1.0625rem] text-amber-700 sm:max-w-[16rem] sm:text-right">{m.blockedReason}</span>
                                ) : granting === m.id ? null : (
                                    <button type="button" onClick={() => setGranting(m.id)}
                                        className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 font-semibold text-white sm:w-auto">
                                        <Crown className="h-4 w-4" /> Make Lifetime
                                    </button>
                                )}
                            </div>
                            {granting === m.id ? (
                                <GrantForm member={m} price={price} onDone={onGranted} onCancel={() => setGranting('')} />
                            ) : null}
                        </li>
                    ))}
                </ul>
            </div>

            {/* ---- the list ---- */}
            <div className="mt-6">
                <h3 className="font-display text-[1.5rem] font-semibold text-slate-900">Lifetime members</h3>
                {loading ? (
                    <p className="mt-3 flex items-center gap-2 text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
                ) : members.length === 0 ? (
                    <p className="mt-3 rounded-xl bg-slate-50 p-4 text-[1.125rem] text-slate-500">
                        No Lifetime members yet. Search above to grant the first one.
                    </p>
                ) : (
                    <ul className="mt-3 space-y-2">
                        {members.map((m) => (
                            <li key={m.id} className="rounded-xl border border-slate-200 p-3">
                                <AccountEditor member={m} onSaved={accountSaved} />
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                        <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                                            <span className="truncate">{m.fullName || 'Unnamed member'}</span><PlatinumBadge size="sm" />
                                        </p>
                                        <p className="truncate text-[1.0625rem] text-slate-500">{[m.membershipNumber, m.email].filter(Boolean).join(' · ')}</p>
                                        {m.platinumGrant ? (
                                            <p className="text-[1rem] text-slate-500">
                                                {rupees(m.platinumGrant.amount)} · {PAYMENT_MODE_LABEL[m.platinumGrant.paymentMode as PlatinumPaymentMode] || 'Paid'}
                                                {m.platinumGrant.receiptNumber ? ` · ${m.platinumGrant.receiptNumber}` : ''}
                                                {' · '}granted {day(m.platinumGrant.grantedAt)}
                                            </p>
                                        ) : null}
                                    </div>
                                    {undoing === m.id ? (
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                            <span className="text-[1rem] text-slate-600 sm:max-w-[15rem]">Restore their earlier membership and cancel this receipt?</span>
                                            <div className="flex gap-2">
                                                <button type="button" onClick={() => setUndoing('')} disabled={undoBusy}
                                                    className="min-h-10 flex-1 rounded-xl border border-slate-200 px-3 font-semibold text-slate-700">Keep</button>
                                                <button type="button" onClick={() => undo(m)} disabled={undoBusy}
                                                    className="inline-flex min-h-10 flex-1 items-center justify-center gap-1 rounded-xl bg-rose-600 px-3 font-semibold text-white">
                                                    {undoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Remove
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button type="button" onClick={() => setUndoing(m.id)}
                                            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 text-[1.125rem] font-semibold text-slate-600 hover:bg-slate-50">
                                            <Undo2 className="h-4 w-4" /> Undo
                                        </button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
                <p className="mt-3 flex items-start gap-2 text-[1rem] text-slate-500">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                    Each grant is recorded as a paid membership receipt, so it appears on the member’s 80G certificate and in payment reports.
                </p>
            </div>
        </section>
    );
}
