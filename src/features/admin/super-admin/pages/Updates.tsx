import { useCallback, useEffect, useState } from 'react';
import { Menu, Plus, Pencil, Trash2, X, Pin, Globe, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import AdminSidebar from './AdminSidebar';
import {
    listAllAnnouncements, createAnnouncement, updateAnnouncement,
    setAnnouncementStatus, deleteAnnouncement,
    type Announcement, type AnnouncementCategory,
} from '@/services/memberHubApi';
import { errorMessage, getStates, getDistricts, getBlocks } from '@/services/activApi';
import { toast } from 'sonner';

/**
 * Association Updates, authored (MEM-001).
 *
 * The Super Admin writes a notice, says WHO it is for — by region and by
 * membership — and publishes it. Every member whose state, district and block
 * match sees it on their dashboard; a blank region means everyone.
 *
 * Region targeting is bottom-up and cumulative, which is worth being explicit
 * about because it is the opposite of how the approval geofence reads. An
 * update with a state and no district goes to the whole state. An update with a
 * block goes only to that block. There is no "all districts except one".
 *
 * Two independent controls, deliberately kept apart:
 *
 *   status   — is it ready? A draft is stored and shown to nobody.
 *   audience — who is it for? `paid` restricts it to active memberships.
 *
 * Collapsing them into one dropdown was tempting and wrong: "draft" and
 * "members only" are not points on the same scale, and an editor who wants a
 * members-only notice must not have to publish it to find that out.
 */

const CATEGORIES: { value: AnnouncementCategory; label: string }[] = [
    { value: 'general', label: 'General update' },
    { value: 'notice', label: 'Notice' },
    { value: 'policy', label: 'Policy' },
    { value: 'scheme', label: 'Scheme' },
    { value: 'achievement', label: 'Achievement' },
    { value: 'urgent', label: 'Urgent' },
];

interface FormState {
    title: string;
    summary: string;
    body: string;
    category: AnnouncementCategory;
    state: string;
    district: string;
    block: string;
    audience: 'all' | 'paid';
    bannerUrl: string;
    bannerAlt: string;
    attachmentUrl: string;
    attachmentLabel: string;
    pinned: boolean;
    status: 'draft' | 'published';
    expiresAt: string;
}

const BLANK: FormState = {
    title: '', summary: '', body: '', category: 'general',
    state: '', district: '', block: '',
    audience: 'all',
    bannerUrl: '', bannerAlt: '', attachmentUrl: '', attachmentLabel: '',
    pinned: false, status: 'published', expiresAt: '',
};

/** A `date` input value from a stored instant, in LOCAL time — never UTC. */
const toDateInput = (value?: string | null): string => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export default function SuperAdminUpdates() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const [rows, setRows] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<string | null>(null);
    const [form, setForm] = useState<FormState>({ ...BLANK });
    const [saving, setSaving] = useState(false);

    const [states, setStates] = useState<string[]>([]);
    const [districts, setDistricts] = useState<string[]>([]);
    const [blocks, setBlocks] = useState<string[]>([]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await listAllAnnouncements();
            setRows(data?.announcements || []);
            setError('');
        } catch (err) {
            setError(errorMessage(err, 'Could not load updates'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    /*
     * The region tree, read once and narrowed as the editor picks.
     *
     * `getStates`/`getDistricts`/`getBlocks` all read one cached tree, so this
     * costs a single request however many times the dropdowns change.
     */
    useEffect(() => {
        let cancelled = false;

        getStates()
            .then((data) => {
                if (!cancelled) setStates((data?.states || []).map((s: any) => s.name).filter(Boolean));
            })
            .catch(() => { if (!cancelled) setStates([]); });

        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        let cancelled = false;

        if (!form.state) {
            setDistricts([]);
            setBlocks([]);
            return;
        }

        getDistricts(form.state)
            .then((data) => {
                if (!cancelled) setDistricts((data?.districts || []).map((d: any) => d.name).filter(Boolean));
            })
            .catch(() => { if (!cancelled) setDistricts([]); });

        return () => { cancelled = true; };
    }, [form.state]);

    useEffect(() => {
        let cancelled = false;

        if (!form.state || !form.district) {
            setBlocks([]);
            return;
        }

        getBlocks(form.state, form.district)
            .then((data) => {
                if (!cancelled) setBlocks((data?.blocks || []).map((b: any) => b.name).filter(Boolean));
            })
            .catch(() => { if (!cancelled) setBlocks([]); });

        return () => { cancelled = true; };
    }, [form.state, form.district]);

    const openNew = () => {
        setEditing(null);
        setForm({ ...BLANK });
        setShowForm(true);
    };

    const openEdit = (row: Announcement) => {
        setEditing(row.id);
        setForm({
            title: row.title || '',
            summary: row.summary || '',
            body: row.body || '',
            category: row.category || 'general',
            state: row.state || '',
            district: row.district || '',
            block: row.block || '',
            audience: row.audience === 'paid' ? 'paid' : 'all',
            bannerUrl: row.bannerUrl || '',
            bannerAlt: row.bannerAlt || '',
            attachmentUrl: row.attachmentUrl || '',
            attachmentLabel: row.attachmentLabel || '',
            pinned: !!row.pinned,
            status: row.status || 'draft',
            expiresAt: toDateInput(row.expiresAt),
        });
        setShowForm(true);
    };

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setSaving(true);

        try {
            const payload = {
                ...form,
                /*
                 * An expiry is the END of that day, not its midnight.
                 *
                 * A `date` input gives "2026-09-14", and sending that as-is
                 * expires the update at 00:00 on the 14th — a day earlier than
                 * the editor meant, and on the very day they chose. 23:59:59
                 * local is what "up to and including the 14th" means.
                 */
                expiresAt: form.expiresAt
                    ? new Date(`${form.expiresAt}T23:59:59`).toISOString()
                    : '',
            };

            if (editing) await updateAnnouncement(editing, payload);
            else await createAnnouncement(payload);

            toast.success(editing ? 'Update saved' : 'Update created');
            setShowForm(false);
            await load();
        } catch (err) {
            const message = errorMessage(err, 'Could not save the update');
            setError(message);
            toast.error(message);
        } finally {
            setSaving(false);
        }
    };

    const togglePublished = async (row: Announcement) => {
        try {
            await setAnnouncementStatus(row.id, row.status === 'published' ? 'draft' : 'published');
            toast.success(row.status === 'published' ? 'Withdrawn from members' : 'Published to members');
            await load();
        } catch (err) {
            toast.error(errorMessage(err, 'Could not change the status'));
        }
    };

    const remove = async (row: Announcement) => {
        if (!window.confirm(`Delete "${row.title}"? Members who have already read it will no longer see it.`)) {
            return;
        }

        try {
            await deleteAnnouncement(row.id);
            toast.success('Update deleted');
            await load();
        } catch (err) {
            toast.error(errorMessage(err, 'Could not delete the update'));
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex">
            <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 min-w-0">
                <header className="bg-white border-b px-6 py-4 flex items-center gap-3">
                    <button
                        className="lg:hidden text-gray-600"
                        onClick={() => setSidebarOpen(true)}
                        aria-label="Open menu"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold text-gray-900">Association Updates</h1>
                        <p className="text-sm text-gray-600 mt-0.5">
                            News and notices, targeted by region and by membership.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={openNew}
                        className="ml-auto shrink-0 inline-flex items-center gap-1.5 px-4 h-10 rounded-xl
                                   bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                    >
                        <Plus className="w-4 h-4" /> New update
                    </button>
                </header>

                <main className="p-6 space-y-5">
                    {error ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                            {error}
                        </div>
                    ) : null}

                    {/* ---------------------------------------------- the form */}
                    {showForm ? (
                        <form
                            onSubmit={submit}
                            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 lg:p-6 space-y-5"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <h2 className="text-lg font-bold text-slate-900">
                                    {editing ? 'Edit update' : 'New update'}
                                </h2>
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    aria-label="Close"
                                    className="text-slate-400 hover:text-slate-700"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                                    <Field label="Headline">
                                        <input
                                            required
                                            value={form.title}
                                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                                            className={INPUT}
                                        />
                                    </Field>
                                </div>

                                <div className="sm:col-span-2">
                                    <Field
                                        label="Standfirst"
                                        hint="One line, shown on the dashboard card. Left blank, the opening of the body is used."
                                    >
                                        <input
                                            value={form.summary}
                                            onChange={(e) => setForm({ ...form, summary: e.target.value })}
                                            className={INPUT}
                                        />
                                    </Field>
                                </div>

                                <div className="sm:col-span-2">
                                    <Field label="The update">
                                        <textarea
                                            rows={6}
                                            value={form.body}
                                            onChange={(e) => setForm({ ...form, body: e.target.value })}
                                            className={`${INPUT} h-auto py-2.5 resize-y`}
                                        />
                                    </Field>
                                </div>

                                <Field label="Category">
                                    <select
                                        value={form.category}
                                        onChange={(e) => setForm({
                                            ...form, category: e.target.value as AnnouncementCategory,
                                        })}
                                        className={INPUT}
                                    >
                                        {CATEGORIES.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </Field>

                                <Field label="Stop showing after" hint="Optional. Blank means it stays up.">
                                    <input
                                        type="date"
                                        value={form.expiresAt}
                                        onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                                        className={INPUT}
                                    />
                                </Field>

                                <div className="sm:col-span-2">
                                    <Field label="Banner image URL" hint="Optional. A circular or poster reads best whole.">
                                        <input
                                            value={form.bannerUrl}
                                            onChange={(e) => setForm({ ...form, bannerUrl: e.target.value })}
                                            className={INPUT}
                                        />
                                    </Field>
                                </div>

                                <Field label="Attachment URL" hint="A circular or form members can open.">
                                    <input
                                        value={form.attachmentUrl}
                                        onChange={(e) => setForm({ ...form, attachmentUrl: e.target.value })}
                                        className={INPUT}
                                    />
                                </Field>

                                <Field label="Attachment label">
                                    <input
                                        value={form.attachmentLabel}
                                        placeholder="Circular 14/2026"
                                        onChange={(e) => setForm({ ...form, attachmentLabel: e.target.value })}
                                        className={INPUT}
                                    />
                                </Field>
                            </div>

                            {/* ---- who it reaches ---- */}
                            <div className="border-t border-slate-100 pt-5">
                                <h3 className="text-sm font-bold text-slate-900">Who it reaches</h3>
                                <p className="text-[12.5px] text-slate-500 mt-0.5 mb-4">
                                    Leave a region blank to reach everyone below that level. A block-level
                                    update goes only to that block.
                                </p>

                                {/*
                                  * Chosen from the live region tree, never typed.
                                  *
                                  * `RegionInput` on Manage Admins is deliberately
                                  * free text — typing a new block there is how a
                                  * region comes into existence. Here the opposite
                                  * is true: targeting is matched with an anchored
                                  * regex, so a typed "tamil nadu" against a stored
                                  * "Tamil Nadu" is a different region and the
                                  * update reaches nobody, silently. Picking from
                                  * the tree means the spelling is the database's.
                                  */}
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <Field label="State" hint="Blank reaches every state.">
                                        <select
                                            value={form.state}
                                            onChange={(e) => setForm({
                                                ...form, state: e.target.value, district: '', block: '',
                                            })}
                                            className={INPUT}
                                        >
                                            <option value="">All states</option>
                                            {states.map((name) => (
                                                <option key={name} value={name}>{name}</option>
                                            ))}
                                        </select>
                                    </Field>

                                    <Field label="District">
                                        <select
                                            value={form.district}
                                            disabled={!form.state}
                                            onChange={(e) => setForm({
                                                ...form, district: e.target.value, block: '',
                                            })}
                                            className={`${INPUT} disabled:bg-slate-50 disabled:text-slate-400`}
                                        >
                                            <option value="">
                                                {form.state ? 'All districts' : 'Pick a state first'}
                                            </option>
                                            {districts.map((name) => (
                                                <option key={name} value={name}>{name}</option>
                                            ))}
                                        </select>
                                    </Field>

                                    <Field label="Block">
                                        <select
                                            value={form.block}
                                            disabled={!form.district}
                                            onChange={(e) => setForm({ ...form, block: e.target.value })}
                                            className={`${INPUT} disabled:bg-slate-50 disabled:text-slate-400`}
                                        >
                                            <option value="">
                                                {form.district ? 'All blocks' : 'Pick a district first'}
                                            </option>
                                            {blocks.map((name) => (
                                                <option key={name} value={name}>{name}</option>
                                            ))}
                                        </select>
                                    </Field>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2 mt-4">
                                    <AudienceOption
                                        selected={form.audience === 'all'}
                                        onSelect={() => setForm({ ...form, audience: 'all' })}
                                        icon={<Globe className="w-4 h-4" />}
                                        title="All members"
                                        detail="Everyone signed in, whether or not they have paid."
                                    />
                                    <AudienceOption
                                        selected={form.audience === 'paid'}
                                        onSelect={() => setForm({ ...form, audience: 'paid' })}
                                        icon={<Lock className="w-4 h-4" />}
                                        title="Paid members only"
                                        detail="Only members with an active membership can open it."
                                    />
                                </div>
                            </div>

                            {/* ---- publish ---- */}
                            <div className="border-t border-slate-100 pt-5 flex flex-wrap items-end gap-4">
                                <Field label="Status" hint="A draft is stored and shown to nobody.">
                                    <select
                                        value={form.status}
                                        onChange={(e) => setForm({
                                            ...form, status: e.target.value as 'draft' | 'published',
                                        })}
                                        className={INPUT}
                                    >
                                        <option value="published">Published</option>
                                        <option value="draft">Draft</option>
                                    </select>
                                </Field>

                                <label className="flex items-center gap-2 h-11 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.pinned}
                                        onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
                                        className="w-4 h-4 rounded border-slate-300 text-blue-600"
                                    />
                                    <span className="text-sm text-slate-700">Pin to the top of every feed</span>
                                </label>

                                <div className="ml-auto flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowForm(false)}
                                        className="px-4 h-11 rounded-xl border border-slate-200 text-sm
                                                   font-semibold text-slate-600 hover:bg-slate-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="px-5 h-11 rounded-xl bg-blue-600 text-white text-sm font-bold
                                                   hover:bg-blue-700 disabled:opacity-60 inline-flex
                                                   items-center gap-2"
                                    >
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                        {editing ? 'Save update' : 'Create update'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    ) : null}

                    {/* ---------------------------------------------- listing */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                        <h2 className="text-lg font-bold text-slate-900 mb-4">
                            Updates ({rows.length})
                        </h2>

                        {loading ? (
                            <p className="text-sm text-slate-500 py-8 text-center">Loading…</p>
                        ) : rows.length === 0 ? (
                            <p className="text-sm text-slate-500 py-8 text-center">
                                Nothing published yet. Create one and it appears on every matching
                                member's dashboard.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-slate-500 border-b border-slate-200">
                                            <th className="pb-2 pr-4 font-medium">Headline</th>
                                            <th className="pb-2 pr-4 font-medium">Reaches</th>
                                            <th className="pb-2 pr-4 font-medium">Published</th>
                                            <th className="pb-2 font-medium text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row) => (
                                            <tr key={row.id} className="border-b border-slate-100">
                                                <td className="py-3 pr-4">
                                                    <span className="font-medium text-slate-800">{row.title}</span>
                                                    {row.pinned ? (
                                                        <span className="ml-2 inline-flex items-center gap-1
                                                                         text-[10px] font-bold uppercase
                                                                         text-blue-700 align-middle">
                                                            <Pin className="w-3 h-3" /> Pinned
                                                        </span>
                                                    ) : null}
                                                    <span className="block text-xs text-slate-400 capitalize">
                                                        {row.category}
                                                    </span>
                                                </td>

                                                <td className="py-3 pr-4 text-slate-500">
                                                    {row.targetLabel || 'All regions'}
                                                    <span className="block text-xs">
                                                        {row.audience === 'paid' ? 'Paid members only' : 'All members'}
                                                    </span>
                                                </td>

                                                <td className="py-3 pr-4">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                        row.status === 'published'
                                                            ? 'bg-green-100 text-green-700'
                                                            : 'bg-slate-100 text-slate-500'
                                                    }`}>
                                                        {row.status}
                                                    </span>
                                                    {row.publishedAt ? (
                                                        <span className="block text-xs text-slate-400 mt-0.5">
                                                            {new Date(row.publishedAt).toLocaleDateString('en-GB')}
                                                        </span>
                                                    ) : null}
                                                </td>

                                                <td className="py-3 text-right whitespace-nowrap">
                                                    <button
                                                        onClick={() => togglePublished(row)}
                                                        aria-label={row.status === 'published' ? 'Withdraw' : 'Publish'}
                                                        title={row.status === 'published' ? 'Withdraw' : 'Publish'}
                                                        className="p-1.5 rounded text-slate-500 hover:bg-slate-100"
                                                    >
                                                        {row.status === 'published'
                                                            ? <EyeOff className="w-4 h-4" />
                                                            : <Eye className="w-4 h-4" />}
                                                    </button>

                                                    <button
                                                        onClick={() => openEdit(row)}
                                                        aria-label="Edit"
                                                        className="p-1.5 rounded text-slate-500 hover:bg-slate-100"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>

                                                    {/* Labelled, not a bare icon two pixels
                                                        from the pencil: one of them is
                                                        reversible and the other is not. */}
                                                    <button
                                                        onClick={() => remove(row)}
                                                        aria-label={`Delete ${row.title}`}
                                                        className="ml-1 inline-flex items-center gap-1.5 px-2.5 py-1.5
                                                                   rounded-lg text-xs font-medium text-red-600
                                                                   border border-red-200 hover:bg-red-50"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" /> Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}

const INPUT = 'w-full h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400';

function Field({
    label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <label className="block min-w-0">
            <span className="block text-[12px] font-semibold text-slate-700 mb-1">{label}</span>
            {children}
            {hint ? <span className="block text-[11.5px] text-slate-400 mt-1">{hint}</span> : null}
        </label>
    );
}

function AudienceOption({
    selected, onSelect, icon, title, detail,
}: {
    selected: boolean;
    onSelect: () => void;
    icon: React.ReactNode;
    title: string;
    detail: string;
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={`text-left rounded-xl border p-3 transition-colors ${
                selected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
            }`}
        >
            <span className={`inline-flex items-center gap-2 text-sm font-semibold ${
                selected ? 'text-blue-700' : 'text-slate-800'
            }`}>
                {icon} {title}
            </span>
            <span className="block text-xs text-slate-500 mt-1">{detail}</span>
        </button>
    );
}
