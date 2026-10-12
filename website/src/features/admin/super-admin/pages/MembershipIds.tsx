import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Menu, Pencil, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import AdminSidebar from './AdminSidebar';
import { ADMIN_BG, ADMIN_PAGE, ADMIN_CARD, ADMIN_INPUT, ADMIN_PRIMARY_BTN, ADMIN_SECONDARY_BTN } from '@/features/admin/components/AdminUI';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { correctionForm, listMembershipIds, getMembershipId, updateMembershipId, type MembershipIdRecord, type MembershipIdPage, type MembershipIdCorrection } from '@/services/membershipIdApi';
import { errorMessage } from '@/services/activApi';

const INPUTS = [
    ['fullName', 'Full name'], ['email', 'Email / login'], ['phoneNumber', 'Mobile number'], ['whatsappNumber', 'WhatsApp number'],
    ['state', 'State'], ['district', 'District'], ['block', 'Block'], ['city', 'City'], ['place', 'Place / overseas address'], ['educationalQualification', 'Education']
] as const;
const date = (value: string) => value ? new Date(value + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not recorded';

export default function MembershipIds() {
    const [data, setData] = useState<MembershipIdPage | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [search, setSearch] = useState(''), [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true), [error, setError] = useState('');
    const [selected, setSelected] = useState<MembershipIdRecord | null>(null);
    const [form, setForm] = useState<MembershipIdCorrection | null>(null);
    const [saving, setSaving] = useState(false), [formError, setFormError] = useState('');
    const request = useRef(0);
    const load = useCallback(async () => {
        const current = ++request.current; setLoading(true); setError('');
        try { const result = await listMembershipIds(search, page); if (current === request.current) setData(result); }
        catch (e) { if (current === request.current) setError(errorMessage(e, 'Could not load membership IDs.')); }
        finally { if (current === request.current) setLoading(false); }
    }, [search, page]);
    useEffect(() => { const timer = setTimeout(() => void load(), 250); return () => { clearTimeout(timer); request.current++; }; }, [load]);
    const open = async (row: MembershipIdRecord) => {
        setFormError('');
        try { const latest = await getMembershipId(row.id); setSelected(latest); setForm(correctionForm(latest)); }
        catch (e) { toast.error(errorMessage(e, 'Could not load member details.')); }
    };
    const save = async (event: React.FormEvent) => {
        event.preventDefault(); if (!selected || !form || saving) return;
        setSaving(true); setFormError('');
        try { await updateMembershipId(selected.id, form); setSelected(null); setForm(null); toast.success('Membership record updated.'); await load(); }
        catch (e) { setFormError(errorMessage(e, 'Could not save this member.')); }
        finally { setSaving(false); }
    };
    const set = (key: keyof MembershipIdCorrection, value: string | boolean) => setForm(f => f && ({ ...f, [key]: value }));
    return <div className={`flex h-screen ${ADMIN_BG}`}><AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} /><main className={`min-w-0 flex-1 overflow-y-auto ${ADMIN_PAGE}`}>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div><button className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 lg:hidden" onClick={() => setSidebarOpen(true)}><Menu size={20} />Menu</button><h1 className="flex items-center gap-3 text-3xl font-bold text-slate-950"><BadgeCheck className="text-blue-600" />Membership IDs</h1><p className="mt-2 text-base text-slate-600">Every member, their identity and their membership record.</p></div>
            <button className={ADMIN_SECONDARY_BTN} onClick={() => void load()} disabled={loading}><RefreshCw size={18} />Refresh</button>
        </div>
        <section className={`${ADMIN_CARD} mb-5 p-4 sm:p-5`}>
            <p className="font-semibold text-slate-900 break-all">ACTIV-BEG-20261012-001</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">Category · joining year, month and day · unique daily number. BEG Beginner · INT Intermediate · IDL Ideal · STU Student · ASP Aspirant · LIF Lifetime.</p>
            <p className="mt-2 text-sm text-slate-500">IDs stay the same during renewals. Previous IDs remain searchable after a correction.</p>
        </section>
        <div className="mb-4 flex flex-wrap items-center gap-3"><label className="relative min-w-0 flex-1"><span className="sr-only">Search membership IDs</span><Search size={18} className="absolute left-3 top-3.5 text-slate-400" /><input className={`${ADMIN_INPUT} w-full pl-10`} placeholder="Search ID, name, email or mobile" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></label><span className="text-sm font-semibold text-slate-500">{data?.total || 0} members</span></div>
        {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
        <section className={`${ADMIN_CARD} overflow-hidden`} aria-busy={loading}>
            {loading ? <p className="p-8 text-center text-slate-500">Loading members…</p> : data?.rows.length ? data.rows.map(row => <article key={row.id} className="grid gap-4 border-b border-slate-100 p-4 last:border-0 sm:p-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0"><p className="break-all text-base font-bold text-blue-800">{row.membershipNumber || 'ID pending'}</p><h2 className="mt-1 font-semibold text-slate-950">{row.fullName}</h2><p className="mt-1 text-sm text-slate-500">{row.planName || 'Member'} · <span className="capitalize">{row.status}</span></p></div>
                <div className="min-w-0 text-sm text-slate-600"><p className="break-all">{row.email}</p><p className="mt-1">{row.phoneNumber}</p><p className="mt-1">{[row.city || row.district, row.state].filter(Boolean).join(', ') || row.place}</p></div>
                <div className="grid grid-cols-2 gap-3 text-sm lg:block"><p><span className="block text-slate-500">Member since</span><span className="font-semibold">{date(row.memberSince)}</span></p><p className="lg:mt-2"><span className="block text-slate-500">Valid until</span><span className="font-semibold">{row.lifetime ? 'Lifetime' : date(row.validUntil)}</span></p></div>
                <button className={ADMIN_SECONDARY_BTN} onClick={() => void open(row)}><Pencil size={16} />{row.editable ? 'Edit record' : 'View record'}</button>
            </article>) : <p className="p-8 text-center text-slate-500">No membership records match your search.</p>}
        </section>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm"><button className={ADMIN_SECONDARY_BTN} disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page} of {Math.max(1, Math.ceil((data?.total || 0) / (data?.limit || 20)))}</span><button className={ADMIN_SECONDARY_BTN} disabled={loading || page * (data?.limit || 20) >= (data?.total || 0)} onClick={() => setPage(p => p + 1)}>Next</button></div>
        <p className="mt-5 text-sm text-slate-500">New memberships appear here after activation. <Link to="/super-admin/membership-registrations" className="font-semibold text-blue-700 underline">Record a membership payment</Link>.</p>
    </main>
    <Dialog open={!!selected} onOpenChange={open => { if (!open && !saving) { setSelected(null); setForm(null); } }}>
        <DialogContent className="flex max-h-[92dvh] w-[calc(100%-1rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0">
            <DialogHeader className="border-b p-5 pr-12"><DialogTitle>{selected?.editable ? 'Edit membership record' : 'Archived membership record'}</DialogTitle><DialogDescription>{selected?.fullName} · {selected?.planName}</DialogDescription></DialogHeader>
            {form && selected && <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                    <fieldset disabled={saving || !selected.editable}>
                        <label className="block text-sm font-semibold">Membership ID<input aria-label="Membership ID" className={`${ADMIN_INPUT} mt-2 w-full font-mono`} value={form.membershipNumber} disabled={form.generateId} onChange={e => set('membershipNumber', e.target.value.toUpperCase())} required={!form.generateId} /></label>
                        <label className="mt-3 flex items-start gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.generateId} onChange={e => set('generateId', e.target.checked)} className="mt-1" />Assign the next available ID using this member's category and joining date</label>
                        <div className="mt-5 grid gap-4 sm:grid-cols-2">{INPUTS.map(([key, label]) => <label key={key} className="min-w-0 text-sm font-semibold">{label}<input className={`${ADMIN_INPUT} mt-2 w-full`} type={key === 'email' ? 'email' : 'text'} value={form[key]} onChange={e => set(key, e.target.value)} required={['fullName', 'email', 'phoneNumber'].includes(key)} maxLength={200} /></label>)}</div>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Member since<input className={`${ADMIN_INPUT} mt-2 w-full min-w-0`} type="date" value={form.memberSince} onChange={e => set('memberSince', e.target.value)} /></label>{!selected.lifetime && <label className="text-sm font-semibold">Valid through (inclusive)<input className={`${ADMIN_INPUT} mt-2 w-full min-w-0`} type="date" value={form.validUntil} onChange={e => set('validUntil', e.target.value)} /></label>}</div>
                        {selected.editable && <label className="mt-5 block text-sm font-semibold">Reason for this correction<textarea className={`${ADMIN_INPUT} mt-2 min-h-24 w-full`} value={form.note} onChange={e => set('note', e.target.value)} maxLength={500} required /></label>}
                    </fieldset>
                    {!!selected.previousIds.length && <p className="mt-4 break-words text-sm text-slate-500">Previous IDs: {selected.previousIds.join(', ')}</p>}
                    {!!selected.history.length && <details className="mt-5 text-sm"><summary className="cursor-pointer font-semibold">Correction history</summary>{selected.history.map((item, i) => <div key={i} className="mt-3 border-t pt-3"><p className="break-words">{item.note}</p><p className="text-slate-500">{item.by} · {new Date(item.at).toLocaleString('en-IN')}</p>{Object.entries(item.changes).map(([key, change]) => <p key={key} className="break-all text-slate-600">{key}: {String(change.before ?? '—')} → {String(change.after ?? '—')}</p>)}</div>)}</details>}
                </div>
                <div className="shrink-0 border-t bg-white p-4">{formError && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{formError}</p>}<div className="flex justify-end gap-3"><button type="button" className={ADMIN_SECONDARY_BTN} disabled={saving} onClick={() => { setSelected(null); setForm(null); }}>Close</button>{selected.editable && <button type="submit" className={ADMIN_PRIMARY_BTN} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>}</div></div>
            </form>}
        </DialogContent>
    </Dialog></div>;
}
