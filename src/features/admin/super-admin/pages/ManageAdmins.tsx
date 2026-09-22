import { useEffect, useState } from 'react';
import {
    Plus, Search, Pencil, Trash2, Loader2, Users,
    AlertTriangle, X, ShieldCheck, Eye, EyeOff, Menu,
} from 'lucide-react';
import { toast } from 'sonner';
import AdminSidebar from './AdminSidebar';
import RegionInput from '../components/RegionInput';
import { AdminBackButton, ADMIN_PAGE } from '@/features/admin/components/AdminUI';
import { PAGE_SUBTITLE, PAGE_TITLE, CARD_TITLE } from '@/components/layout/appTypography';
import {
    listAdmins, createAdmin, updateAdmin, deleteAdmin,
    previewAdminRemoval, suggestAdminRegions, errorMessage,
    type ManagedAdmin, type AdminRole,
} from '@/services/activApi';

/**
 * Create, edit and remove the admin accounts that staff each region.
 *
 * This is the screen that decides which regions exist. Region fields are free
 * text on purpose: typing a brand-new block into a brand-new district is a
 * valid one-step way to open that region for registration, and there is no
 * requirement that a parent admin exists first. What matters is spelling —
 * "Tamil Nadu" and "tamil  nadu" are two different regions to the geofence,
 * each holding half of one queue — so the form suggests names already in use
 * and the server reconciles the rest.
 *
 * A tier never stores a region below its own level. A state admin has no
 * district and no block, and the form asks for exactly the fields that tier
 * owns rather than showing three boxes and hoping.
 */

const ROLES: { value: AdminRole; label: string; needs: ('state' | 'district' | 'block')[] }[] = [
    { value: 'state_admin', label: 'State Admin', needs: ['state'] },
    { value: 'district_admin', label: 'District Admin', needs: ['state', 'district'] },
    { value: 'block_admin', label: 'Block Admin', needs: ['state', 'district', 'block'] },
];

const BLANK = {
    fullName: '', email: '', phoneNumber: '', password: '', confirmPassword: '',
    role: 'block_admin' as AdminRole, state: '', district: '', block: '',
};

export default function ManageAdmins() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [admins, setAdmins] = useState<ManagedAdmin[]>([]);
    const [counts, setCounts] = useState({ all: 0, block_admin: 0, district_admin: 0, state_admin: 0 });
    const [loading, setLoading] = useState(true);

    const [role, setRole] = useState('all');
    const [query, setQuery] = useState('');

    const [form, setForm] = useState({ ...BLANK });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    /**
     * Which password fields are currently readable, keyed by field name.
     *
     * Never persisted and reset with the form, so closing and reopening the
     * dialog starts masked again — a revealed field left open on a shared screen
     * is a different problem from the one the eye solves.
     */
    const [reveal, setReveal] = useState<Record<string, boolean>>({});

    const [removing, setRemoving] = useState<{ admin: ManagedAdmin; preview: any } | null>(null);
    /**
     * Two lists per level, kept separate on purpose.
     *
     * `inUse` is regions that already have an admin; `reference` is the
     * canonical India list nobody staffs yet. Merging them — which is what the
     * old flat datalist did — made a state with 405 staffed blocks look
     * identical to one with none.
     */
    const [inUse, setInUse] = useState<Record<string, string[]>>({});
    const [reference, setReference] = useState<Record<string, string[]>>({});

    const load = async () => {
        setLoading(true);
        const params: Record<string, string> = {};
        if (role !== 'all') params.role = role;
        // The server ignores a query under two characters; sending it anyway
        // would make the list flicker on the first keystroke.
        if (query.trim().length >= 2) params.q = query.trim();

        const data = await listAdmins(params);
        setAdmins(data.admins || []);
        setCounts(data.counts || counts);
        setLoading(false);
    };

    useEffect(() => { load(); }, [role]);

    // Debounced, because this runs on every keystroke and the endpoint scans
    // every admin row.
    useEffect(() => {
        const t = setTimeout(() => { load(); }, 350);
        return () => clearTimeout(t);
    }, [query]);

    const needs = ROLES.find(r => r.value === form.role)?.needs || [];

    /**
     * Refetch when the form opens or the scope above changes.
     *
     * A district list is only meaningful once a state is chosen, and a block
     * list once a district is — so both are reloaded when either moves.
     */
    useEffect(() => {
        if (!formOpen) return;
        needs.forEach(loadSuggestions);
    }, [formOpen, form.role, form.state, form.district]);

    /**
     * Which spellings already exist at this level.
     *
     * The endpoint answers `{ states, districts, blocks, referenceStates }` — it
     * does NOT take a `level` and does not return `regions`. Reading a
     * `regions` key off it found nothing, so the datalist was silently empty and
     * every region had to be typed from memory. That is exactly how one region
     * becomes two spellings and one queue becomes two half-queues.
     *
     * `districts` and `blocks` are scoped by the state and district already
     * chosen, which is why those are passed rather than filtered here.
     */
    /**
     * Which names exist at this level, and which are merely known to the
     * reference data.
     *
     * The endpoint answers six lists — `states`, `districts`, `blocks` and a
     * `reference*` counterpart for each — and takes no `level`. Everything
     * below a state is already scoped by the `state` and `district` passed in,
     * which is why those are sent rather than filtered here.
     */
    const loadSuggestions = async (level: 'state' | 'district' | 'block') => {
        const data = await suggestAdminRegions({
            state: form.state,
            district: form.district,
        });

        setInUse(prev => ({ ...prev, [level]: data[`${level}s`] || [] }));

        /*
         * THE REFERENCE EXISTS AT ALL THREE LEVELS, AND ONLY STATES WERE ASKED
         * FOR.
         *
         * `referenceDistricts` and `referenceBlocks` have been in this
         * endpoint's response since it was written — scoped by the state and
         * district already chosen — and this read them as `[]`. So the State
         * box suggested all 36 states of India while District and Block
         * suggested only what somebody had already staffed: on a brand-new
         * state, nothing at all. Every district and block in the country had to
         * be typed from memory, which is precisely how one region becomes two
         * spellings and one queue becomes two half-queues.
         *
         * Keyed per level rather than fetched per level: one call answers all
         * three, so the district list is already correct by the time the block
         * box is reached.
         */
        const REFERENCE_KEY = {
            state: 'referenceStates',
            district: 'referenceDistricts',
            block: 'referenceBlocks',
        } as const;

        setReference(prev => ({
            ...prev,
            [level]: data[REFERENCE_KEY[level]] || [],
        }));
    };

    const openNew = () => {
        setEditingId(null);
        setForm({ ...BLANK });
        // Masked again on every open: a field left readable from the last
        // account created is a credential sitting on screen.
        setReveal({});
        setFormOpen(true);
    };

    const openEdit = (a: ManagedAdmin) => {
        setEditingId(a.id);
        setReveal({});
        setForm({
            fullName: a.fullName || '',
            email: a.email || '',
            phoneNumber: a.phoneNumber || '',
            // Never prefilled: the stored value is a bcrypt hash and cannot be
            // read back. Blank means "leave the password alone".
            password: '',
            confirmPassword: '',
            role: a.role,
            state: a.state || '',
            district: a.district || '',
            block: a.block || '',
        });
        setFormOpen(true);
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();

        /**
         * A mistyped password on create locks the new admin out of an account
         * they have never signed into, and the only copy of what was actually
         * typed is a bcrypt hash. Mobile asks twice for exactly this reason.
         */
        if (form.password && form.password !== form.confirmPassword) {
            toast.error('The two passwords do not match');
            return;
        }
        if (!editingId && form.password.length < 8) {
            toast.error('The password must be at least 8 characters');
            return;
        }

        setSaving(true);
        try {
            // Only the fields this tier owns are sent. A state admin carrying a
            // block would put an empty string into the region tree.
            const payload: Record<string, any> = {
                fullName: form.fullName.trim(),
                email: form.email.trim().toLowerCase(),
                phoneNumber: form.phoneNumber.trim(),
                role: form.role,
            };
            needs.forEach((k) => { payload[k] = (form as any)[k].trim(); });
            if (form.password) payload.password = form.password;

            if (editingId) {
                await updateAdmin(editingId, payload);
                toast.success('Admin updated');
            } else {
                await createAdmin(payload);
                toast.success('Admin created — the region is now open for registration');
            }

            setFormOpen(false);
            await load();
        } catch (err) {
            toast.error(errorMessage(err, 'Could not save this admin'));
        } finally {
            setSaving(false);
        }
    };

    /** Show what the removal costs before asking to confirm it. */
    const askRemove = async (admin: ManagedAdmin) => {
        const preview = await previewAdminRemoval(admin.id);
        setRemoving({ admin, preview });
    };

    const confirmRemove = async () => {
        if (!removing) return;
        try {
            await deleteAdmin(removing.admin.id);
            toast.success('Admin deleted');
            setRemoving(null);
            await load();
        } catch (err) {
            toast.error(errorMessage(err, 'Could not delete this admin'));
        }
    };

    const field = (
        name: keyof typeof BLANK, label: string, type = 'text', hint?: string,
        list?: string, placeholder?: string,
    ) => {
        /*
         * A PASSWORD SET FOR SOMEBODY ELSE HAS TO BE READABLE BACK.
         *
         * The usual argument for masking is shoulder-surfing your own password,
         * which you know. This field is different: the super admin is inventing
         * a credential they must then pass to another person, and they get
         * exactly one chance to read it — it is stored as a bcrypt hash and
         * cannot be shown again afterwards. Masked, the only way to check what
         * was typed is to type it twice and trust the confirm box, and a
         * mistyped-then-confirmed password locks the new admin out of an account
         * that reports itself as created successfully.
         *
         * Per-field state, keyed by name, so revealing the password does not
         * also reveal the confirm box — they are compared by eye and two
         * independently readable values is the point.
         */
        const isPassword = type === 'password';
        const revealed = !!reveal[name];
        const inputType = isPassword && revealed ? 'text' : type;

        return (
            <div className="space-y-1.5 min-w-0">
                <label htmlFor={name} className="block text-[1.25rem] font-semibold text-slate-700 mb-2">{label}</label>

                <div className="relative">
                    <input
                        id={name}
                        name={name}
                        type={inputType}
                        value={(form as any)[name]}
                        list={list}
                        placeholder={placeholder}
                        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
                        /**
                         * This form creates an account for SOMEBODY ELSE.
                         *
                         * Without this the browser helpfully fills Email with the
                         * signed-in super admin's own address and Password with their
                         * saved one — so "Create admin" submits credentials nobody
                         * typed. `new-password` is the value browsers honour on a
                         * password field; `off` alone is widely ignored there.
                         *
                         * Kept keyed off `type`, not `inputType`: revealing the
                         * field must not turn it into an ordinary text box that
                         * the browser then offers to autofill and remember.
                         */
                        autoComplete={isPassword ? 'new-password' : 'off'}
                        autoCorrect="off"
                        spellCheck={false}
                        className={`h-11 w-full px-3.5 rounded-xl border border-slate-200 text-[1.25rem] outline-none transition-colors focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10
                                    focus:outline-none focus:ring-2 focus:ring-blue-600
                                    focus:border-transparent ${isPassword ? 'pr-10' : ''}`}
                    />

                    {isPassword && (
                        <button
                            type="button"
                            onClick={() => setReveal(prev => ({ ...prev, [name]: !prev[name] }))}
                            /* The label says what pressing it DOES, which is what a
                               screen reader user needs; the icon shows the same. */
                            aria-label={revealed ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
                            aria-pressed={revealed}
                            title={revealed ? 'Hide' : 'Show'}
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-md
                                       text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                        >
                            {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    )}
                </div>

                {hint && <p className="text-[1.1875rem] text-slate-500">{hint}</p>}
            </div>
        );
    };

    const regionField = (level: 'state' | 'district' | 'block') => {
        // A district cannot be chosen before its state, nor a block before its
        // district: the suggestion list is scoped by the level above it.
        const blockedBy =
            level === 'district' ? (form.state ? '' : 'state')
                : level === 'block' ? (form.district ? '' : 'district')
                    : '';

        const scope =
            level === 'district' && form.state ? `in ${form.state}`
                : level === 'block' && form.district ? `in ${form.district}`
                    : '';

        return (
            <RegionInput
                key={level}
                label={level.charAt(0).toUpperCase() + level.slice(1)}
                value={(form as any)[level]}
                onChange={(name) => setForm({ ...form, [level]: name })}
                inUse={inUse[level] || []}
                reference={reference[level] || []}
                scopeLabel={scope}
                disabled={!!blockedBy}
                hint={blockedBy
                    ? `Pick the ${blockedBy} first.`
                    : 'Pick one already in use to join it, or type a new name and press +.'}
            />
        );
    };

    return (
        <div className="min-h-screen bg-white flex">
            <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 min-w-0">
                {/*
                  * THE MENU BUTTON AND THE WAY BACK.
                  *
                  * Neither was here. Below `lg` the rail is a drawer, so this
                  * screen — reached from the Hub, and the one that decides which
                  * regions exist — had no navigation on it at all on a phone:
                  * no menu, no back, only the browser's own chrome.
                  */}
                {/*
                  * STACKED ON A PHONE, ONE ROW FROM `sm`.
                  *
                  * `flex-wrap` alone does not do this: the title block is
                  * `flex-1`, so it shrinks to make room for the button rather
                  * than pushing it to a second line — which left "Manage
                  * Admins" wrapping over two lines beside a paragraph squeezed
                  * into a 150px column. A column at this width gives the
                  * heading and its explanation the whole bar and puts the one
                  * action underneath, full width, where a thumb reaches it.
                  */}
                <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4
                                   flex flex-col sm:flex-row sm:flex-wrap sm:items-center
                                   sm:justify-between gap-3 sm:gap-4">
                    <div className="flex items-start gap-2 min-w-0 sm:flex-1">
                        <button
                            type="button"
                            className="lg:hidden shrink-0 mt-1 text-slate-500 hover:text-slate-900"
                            onClick={() => setSidebarOpen(true)}
                            aria-label="Open menu"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        <div className="shrink-0 mt-0.5">
                            <AdminBackButton />
                        </div>
                        <div className="min-w-0">
                            <h1 className={`${PAGE_TITLE} text-slate-900`}>
                                Manage Admins
                            </h1>
                            <p className={`${PAGE_SUBTITLE} text-slate-600 mt-0.5`}>
                                Creating a block admin is what opens a region for registration.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                        <button
                            onClick={openNew}
                            className="inline-flex flex-1 sm:flex-none items-center justify-center gap-2 h-11
                                       px-4 sm:px-5 rounded-xl bg-blue-600
                                       text-white text-[1.25rem] font-semibold transition-colors hover:bg-blue-700"
                        >
                            <Plus className="w-4 h-4" /> Add admin
                        </button>
                    </div>
                </header>

                <main className={ADMIN_PAGE}>
                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[13.75rem]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Name, email or region"
                                className="h-11 w-full pl-9 pr-3.5 rounded-xl border border-slate-200 text-[1.25rem] outline-none transition-colors focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10
                                           focus:outline-none focus:ring-2 focus:ring-blue-600"
                            />
                        </div>

                        <div className="flex gap-2">
                            {[
                                { key: 'all', label: `All (${counts.all})` },
                                { key: 'state_admin', label: `State (${counts.state_admin})` },
                                { key: 'district_admin', label: `District (${counts.district_admin})` },
                                { key: 'block_admin', label: `Block (${counts.block_admin})` },
                            ].map(t => (
                                <button
                                    key={t.key}
                                    onClick={() => setRole(t.key)}
                                    className={`px-3 py-2 rounded-lg text-[1.25rem] font-medium transition-colors ${
                                        role === t.key
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* List */}
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)] overflow-hidden">
                        {loading ? (
                            <div className="bg-white border border-slate-200 rounded-2xl shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)] flex items-center justify-center gap-3 py-16 text-slate-500">
                                <Loader2 className="w-5 h-5 animate-spin" /> Loading admins…
                            </div>
                        ) : admins.length === 0 ? (
                            <div className="bg-white border border-slate-200 rounded-2xl shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)] text-center py-16 px-6">
                                <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                <p className="text-slate-900 font-medium">No admins match</p>
                                <p className="text-[1.25rem] text-slate-500 mt-1">
                                    {query || role !== 'all'
                                        ? 'Try a different filter.'
                                        : 'Add one to open a region for registration.'}
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-[1.25rem]">
                                    <thead className="bg-slate-50 text-left border-b border-slate-200">
                                        <tr>
                                            <th className="px-5 py-4 text-[1.0625rem] sm:text-[1rem] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Name</th>
                                            <th className="px-5 py-4 text-[1.0625rem] sm:text-[1rem] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Role</th>
                                            <th className="px-5 py-4 text-[1.0625rem] sm:text-[1rem] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Region</th>
                                            <th className="px-5 py-4 text-[1.0625rem] sm:text-[1rem] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Queue</th>
                                            <th className="px-5 py-4 text-[1.0625rem] sm:text-[1rem] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {admins.map(a => (
                                            <tr key={a.id} className={a.active ? '' : 'opacity-60'}>
                                                <td className="px-5 py-3">
                                                    <p className="font-medium text-slate-900">{a.fullName || '—'}</p>
                                                    <p className="text-[1.1875rem] text-slate-500">{a.email}</p>
                                                </td>
                                                <td className="px-5 py-3 text-slate-700">
                                                    {ROLES.find(r => r.value === a.role)?.label || a.role}
                                                </td>
                                                <td className="px-5 py-3 text-slate-700">{a.region || '—'}</td>
                                                <td className="px-5 py-3">
                                                    {/* Nothing is assigned to an admin id — queries are
                                                        geofenced by region string — so admins on one
                                                        region share one queue by construction. */}
                                                    {a.coAdmins > 0 ? (
                                                        <span className="text-[1.1875rem] bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                                                            shared with {a.coAdmins}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[1.1875rem] text-slate-500">sole owner</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3 text-right whitespace-nowrap">
                                                    <button
                                                        onClick={() => openEdit(a)}
                                                        aria-label={`Edit ${a.fullName}`}
                                                        className="p-2 rounded text-slate-500 hover:bg-slate-100"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => askRemove(a)}
                                                        aria-label={`Delete ${a.fullName}`}
                                                        className="p-2 rounded text-red-500 hover:bg-red-50"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
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

            {/* ---------------------------------------------------- the form */}
            {formOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto p-4">
                    <form onSubmit={submit} className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 my-8">
                        <header className="flex items-center justify-between px-6 py-5 border-b">
                            <h2 className={`${CARD_TITLE} text-slate-900`}>
                                {editingId ? 'Edit admin' : 'Add admin'}
                            </h2>
                            <button
                                type="button" onClick={() => setFormOpen(false)}
                                aria-label="Close" className="text-slate-400 hover:text-slate-700"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </header>

                        <div className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <label htmlFor="role" className="block text-[1.25rem] font-semibold text-slate-700 mb-2">Role</label>
                                <select
                                    id="role"
                                    value={form.role}
                                    onChange={(e) => {
                                        const next = e.target.value as AdminRole;
                                        // Clear regions the new tier does not own, so a
                                        // demoted form cannot submit a stale block.
                                        const keeps = ROLES.find(r => r.value === next)?.needs || [];
                                        setForm({
                                            ...form,
                                            role: next,
                                            state: keeps.includes('state') ? form.state : '',
                                            district: keeps.includes('district') ? form.district : '',
                                            block: keeps.includes('block') ? form.block : '',
                                        });
                                    }}
                                    className="h-11 w-full px-3.5 rounded-xl border border-slate-200 text-[1.25rem] outline-none transition-colors focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                                >
                                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                </select>
                                {/* Mobile shows this too. Which collection an account
                                    lands in is not incidental — it is how the platform
                                    finds it again. */}
                                <p className="text-[1.1875rem] text-slate-500">
                                    Saved into the{' '}
                                    <span className="font-mono">{form.role.replace('_admin', '')}admins</span>{' '}
                                    collection.
                                </p>
                            </div>

                            {/* Region first, as on mobile: it is the decision the rest
                                of the form hangs off, and the one that opens a region
                                for registration. */}
                            <div className="space-y-4 pb-2 border-b">
                                <p className="text-[1.25rem] font-semibold text-slate-800">Region</p>
                                {needs.map(regionField)}
                            </div>

                            {field('fullName', 'Full Name', 'text', undefined, undefined, 'Jane Doe')}
                            {field('email', 'Email Address', 'email', undefined, undefined, 'name@activ.com')}
                            {field('phoneNumber', 'Phone (optional)', 'tel', undefined, undefined, '9876543210')}

                            {field('password',
                                editingId ? 'New Password (leave blank to keep)' : 'Password',
                                'password',
                                editingId ? undefined : 'At least 8 characters.',
                                undefined,
                                'At least 8 characters')}

                            {/* Asked for whenever a password is being set — on create
                                always, on edit only once something has been typed. */}
                            {(!editingId || form.password.length > 0) && field(
                                'confirmPassword', 'Confirm Password', 'password',
                                undefined, undefined, 'Type the password again',
                            )}
                        </div>

                        <footer className="flex gap-3 px-6 py-4 border-t">
                            <button
                                type="button"
                                onClick={() => setFormOpen(false)}
                                className="h-11 px-5 rounded-xl border border-slate-200 text-[1.25rem] font-semibold text-slate-700 transition-colors hover:border-slate-300"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg
                                           bg-blue-600 text-white text-[1.25rem] font-medium disabled:opacity-60"
                            >
                                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                {editingId ? 'Save changes' : 'Create admin'}
                            </button>
                        </footer>
                    </form>
                </div>
            )}

            {/* ------------------------------------------- removal confirmation */}
            {removing && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                        <div className="flex items-start gap-3 mb-4">
                            <AlertTriangle className="w-6 h-6 text-red-500 shrink-0" />
                            <div>
                                <h2 className={`${CARD_TITLE} text-slate-900`}>
                                    Delete {removing.admin.fullName}?
                                </h2>
                                <p className="text-[1.25rem] text-slate-500 mt-1">
                                    This removes the account permanently.
                                </p>
                            </div>
                        </div>

                        {/* What it costs, from the server, before the decision. */}
                        {removing.preview?.pendingApplications > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                                <p className="text-[1.25rem] text-amber-900">
                                    <strong>{removing.preview.pendingApplications}</strong> pending
                                    application(s) sit in this region's queue.
                                    {removing.admin.coAdmins > 0
                                        ? ` ${removing.admin.coAdmins} other admin(s) also cover it, so they stay reachable.`
                                        : ' Nobody else covers it — they escalate to the tier above until a replacement is added.'}
                                </p>
                            </div>
                        )}

                        {removing.admin.coAdmins === 0 && (
                            <div className="flex items-start gap-2 text-[1.25rem] text-slate-500 mb-4">
                                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
                                <p>
                                    Ownership is worked out at read time, so adding a replacement later
                                    hands them the full queue rather than an empty one.
                                </p>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => setRemoving(null)}
                                className="flex-1 py-2.5 rounded-lg border border-slate-200 text-[1.25rem] font-medium"
                            >
                                Keep
                            </button>
                            <button
                                onClick={confirmRemove}
                                className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-[1.25rem] font-medium hover:bg-red-700"
                            >
                                Delete permanently
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
