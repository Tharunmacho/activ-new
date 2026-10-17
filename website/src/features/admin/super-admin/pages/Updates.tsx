import { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, Pencil, Pin, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import AdminSidebar from './AdminSidebar';
import UpdateComposer from '../components/UpdateComposer';
import { AdminPageHeader, ADMIN_PAGE } from '@/features/admin/components/AdminUI';
import { useCardTable } from '@/lib/useCardTable';
import { updateAudienceLabel } from '@/lib/memberAudience';
import { resolveUpdateDeliveryChannels, updateDeliverySummary } from '@/lib/updateDeliveryChannels';
import { errorMessage } from '@/services/activApi';
import { listAllAnnouncements, setAnnouncementStatus, deleteAnnouncement, type Announcement } from '@/services/memberHubApi';
import './updates-list.css';

export default function SuperAdminUpdates() {
    const cardTableRef = useCardTable();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [rows, setRows] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Announcement | null>(null);
    const [actionId, setActionId] = useState('');
    const load = useCallback(async () => {
        setLoading(true);
        try { const data = await listAllAnnouncements(); setRows(data?.announcements || []); setError(''); }
        catch (err) { setError(errorMessage(err, 'Could not load updates')); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { void load(); }, [load]);
    const togglePublished = async (row: Announcement) => {
        // Review the audience and content before publishing an existing draft.
        if (row.status === 'draft') { setEditing(row); setShowForm(true); return; }
        setActionId(row.id);
        try { await setAnnouncementStatus(row.id, 'draft'); toast.success('Update moved to drafts'); await load(); }
        catch (err) { toast.error(errorMessage(err, 'Could not change the status')); }
        finally { setActionId(''); }
    };
    const remove = async (row: Announcement) => {
        if (!window.confirm(`Delete "${row.title}"? It will no longer appear in members’ feeds.`)) return;
        setActionId(row.id);
        try { await deleteAnnouncement(row.id); toast.success('Update deleted'); await load(); }
        catch (err) { toast.error(errorMessage(err, 'Could not delete the update')); }
        finally { setActionId(''); }
    };

    return <div className="flex min-h-screen bg-white">
        <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="min-w-0 flex-1">
            <AdminPageHeader title="Association Updates" subtitle="Share news, notices and membership information with the right members."
                onMenu={() => setSidebarOpen(true)} actions={!showForm && <button type="button" onClick={() => { setEditing(null); setShowForm(true); }} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-[18px] font-semibold text-white hover:bg-blue-800"><Plus size={18} />New update</button>} />
            <main className={`${ADMIN_PAGE} text-[18px] leading-7`}>
                {showForm ? <UpdateComposer key={editing?.id || 'new'} initial={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); void load(); }} /> : <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                    <h2 className="mb-5 text-[22px] font-semibold text-slate-900">Your updates <span className="ml-1 text-[18px] font-normal text-slate-500">({rows.length})</span></h2>
                    {error ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-[18px] text-red-700">{error}<button type="button" className="ml-3 min-h-10 font-semibold underline" onClick={() => void load()}>Retry</button></div>
                        : loading ? <p role="status" className="py-10 text-center text-[18px] text-slate-500">Loading updates…</p>
                        : !rows.length ? <div className="py-12 text-center"><p className="text-[20px] font-medium text-slate-800">Share your first update</p><p className="mt-2 text-[18px] text-slate-500">Add a message or poster, choose its audience, and publish when ready.</p></div>
                        : <div className="admin-updates-records"><div ref={cardTableRef} className="card-table overflow-x-auto"><table className="w-full text-[18px]"><colgroup><col className="admin-updates-title"/><col className="admin-updates-audience"/><col className="admin-updates-status"/><col className="admin-updates-actions"/></colgroup><thead><tr className="border-b border-slate-200 text-left text-[18px] text-slate-500"><th className="pb-3 pr-4 font-medium">Update</th><th className="pb-3 pr-4 font-medium">Audience</th><th className="pb-3 pr-4 font-medium">Status</th><th className="pb-3 text-right font-medium">Actions</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-b border-slate-100 last:border-0">
                            <td className="py-4 pr-4"><span className="break-words font-medium text-slate-900">{row.title}</span>{row.pinned && <span className="ml-2 inline-flex items-center gap-1 text-sm font-semibold text-blue-700"><Pin size={12} />Pinned</span>}<span className="mt-1 block text-[18px] capitalize text-slate-500">{row.category}</span></td>
                            <td className="py-4 pr-4 text-[18px] text-slate-700">{row.recipientMode === 'selected' && <span className="mb-1 block font-semibold">{row.memberIds?.length || 0} selected members</span>}{updateAudienceLabel(row.audience)}{row.audience === 'plans' && <span className="ml-1">({row.planKeys?.length || 0})</span>}<span className="mt-1 block text-[18px] text-slate-500">{row.targetLabel || 'All regions'}</span></td>
                            <td className="py-4 pr-4"><span className={`inline-block rounded-full px-2.5 py-1 text-sm font-semibold capitalize ${row.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{row.status}</span><span className="mt-2 block break-words text-[18px] text-slate-600">Notifications: {updateDeliverySummary(resolveUpdateDeliveryChannels(row))}</span>{row.publishedAt && <span className="mt-1 block text-[18px] text-slate-500">{new Date(row.publishedAt).toLocaleDateString('en-GB')}</span>}</td>
                            <td className="py-4 text-right"><div className="admin-update-actions"><button type="button" disabled={!!actionId} onClick={() => void togglePublished(row)} aria-label={row.status === 'published' ? 'Move to draft' : 'Review and publish'} title={row.status === 'published' ? 'Move to draft' : 'Review and publish'} className="inline-grid h-11 w-11 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-50">{row.status === 'published' ? <EyeOff size={18} /> : <Eye size={18} />}</button><button type="button" disabled={!!actionId} onClick={() => { setEditing(row); setShowForm(true); }} aria-label={`Edit ${row.title}`} className="inline-grid h-11 w-11 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"><Pencil size={18} /></button><button type="button" disabled={!!actionId} onClick={() => void remove(row)} aria-label={`Delete ${row.title}`} className="inline-grid h-11 w-11 place-items-center rounded-lg text-red-700 hover:bg-red-50"><Trash2 size={18} /></button></div></td>
                        </tr>)}</tbody></table></div></div>}
                </section>}
            </main>
        </div>
    </div>;
}
