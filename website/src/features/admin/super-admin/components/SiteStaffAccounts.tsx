import { useEffect, useState } from 'react';
import { Pencil, Loader2, Eye, EyeOff, X, ShieldCheck, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { CARD_TITLE } from '@/components/layout/appTypography';
import {
    listStaffAccounts, updateStaffAccount, errorMessage, type StaffAccount,
} from '@/services/activApi';

/**
 * Site-staff accounts — the CMS admin and the events admin.
 *
 * The Super Admin maintains these credentials directly: name, email, phone,
 * active, and a new password. Nothing here reaches a super admin account (the
 * server refuses one whatever id is sent) and nothing here has a region — these
 * accounts run one portal each.
 *
 * The editor is deliberately the Manage Admins form and nothing more: name,
 * email, phone, and a new password that is left alone when blank.
 */

const MIN = 8;

const formatWhen = (value: string | null) => {
    if (!value) return 'Never';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const INPUT = 'h-11 w-full px-3.5 rounded-xl border border-slate-200 text-ui-body outline-none transition-colors focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10';
const LABEL = 'block text-ui-body font-semibold text-slate-700 mb-2';

/** The same fields, in the same order, as the admin form in Manage Admins. */
type Draft = {
    fullName: string; email: string; phoneNumber: string;
    password: string; confirmPassword: string;
};

export default function SiteStaffAccounts({ query = '', hidden = false, onCountChange }: {
    query?: string; hidden?: boolean; onCountChange?: (count: number) => void;
}) {
    const [accounts, setAccounts] = useState<StaffAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [reveal, setReveal] = useState<Record<string, boolean>>({});
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true);
        setFailed(false);
        try {
            setAccounts(await listStaffAccounts());
        } catch {
            setFailed(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);
    const needle = query.trim().toLowerCase();
    const visibleAccounts = accounts.filter(account => needle.length < 2 ||
        `${account.fullName} ${account.email} ${account.roleLabel}`.toLowerCase().includes(needle));
    useEffect(() => { onCountChange?.(accounts.length); }, [accounts.length, onCountChange]);

    const openEdit = (a: StaffAccount) => {
        setEditingId(a.id);
        setReveal({});
        setDraft({
            fullName: a.fullName || '',
            email: a.email || '',
            phoneNumber: a.phoneNumber || '',
            // Blank means "leave the password alone", as in Manage Admins.
            password: '',
            confirmPassword: '',
        });
    };

    const close = () => {
        setEditingId(null);
        setDraft(null);
        setReveal({});
    };

    const patch = (next: Partial<Draft>) => setDraft(prev => (prev ? { ...prev, ...next } : prev));

    const save = async (a: StaffAccount) => {
        if (!draft) return;
        if (!draft.fullName.trim()) { toast.error('Full name is required'); return; }
        if (draft.password && draft.password.length < MIN) {
            toast.error(`The password must be at least ${MIN} characters`);
            return;
        }
        if (draft.password && draft.password !== draft.confirmPassword) {
            toast.error('The two passwords do not match');
            return;
        }

        setSaving(true);
        try {
            // `active` is not sent: an absent field is left as it is.
            const payload: Record<string, any> = {
                fullName: draft.fullName.trim(),
                email: draft.email.trim().toLowerCase(),
                phoneNumber: draft.phoneNumber.trim(),
            };
            if (draft.password) payload.password = draft.password;

            const res = await updateStaffAccount(a.id, payload);
            const changed: string[] = Array.isArray(res?.changed) ? res.changed : [];
            if (changed.length === 0) toast.message('Nothing to change');
            else toast.success(changed.includes('password') ? 'Saved - the new password works now' : `${a.roleLabel || 'Account'} updated`);

            close();
            await load();
        } catch (err) {
            toast.error(errorMessage(err, 'Could not update this account'));
        } finally {
            setSaving(false);
        }
    };

    const passwordField = (name: 'password' | 'confirmPassword', label: string, placeholder: string) => {
        if (!draft) return null;
        const shown = !!reveal[name];
        return (
            <div className="min-w-0">
                <label htmlFor={`staff-${name}`} className={LABEL}>{label}</label>
                <div className="relative">
                    <input
                        id={`staff-${name}`}
                        type={shown ? 'text' : 'password'}
                        value={draft[name]}
                        placeholder={placeholder}
                        onChange={(e) => patch({ [name]: e.target.value } as Partial<Draft>)}
                        autoComplete="new-password"
                        autoCorrect="off"
                        spellCheck={false}
                        className={`${INPUT} pr-10`}
                    />
                    <button
                        type="button"
                        onClick={() => setReveal(prev => ({ ...prev, [name]: !prev[name] }))}
                        aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
                        aria-pressed={shown}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                    >
                        {shown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        );
    };

    const editor = (a: StaffAccount) => {
        if (!draft) return null;
        const field = (name: 'fullName' | 'email' | 'phoneNumber', label: string, type: string, placeholder: string) => (
            <div className="min-w-0">
                <label htmlFor={`staff-${name}`} className={LABEL}>{label}</label>
                <input
                    id={`staff-${name}`}
                    type={type}
                    value={draft[name]}
                    placeholder={placeholder}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => patch({ [name]: e.target.value } as Partial<Draft>)}
                    className={INPUT}
                />
            </div>
        );

        return (
            <form
                onSubmit={(e) => { e.preventDefault(); save(a); }}
                className="mt-5 pt-5 border-t border-slate-200 space-y-4"
            >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {field('fullName', 'Full Name', 'text', 'Jane Doe')}
                    {field('email', 'Email Address', 'email', 'name@activ.com')}
                    {field('phoneNumber', 'Phone (optional)', 'tel', '9876543210')}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {passwordField('password', 'New Password (leave blank to keep)', 'At least 8 characters')}
                    {/* Asked for only once a new password is typed, as in Manage Admins. */}
                    {draft.password.length > 0 && passwordField('confirmPassword', 'Confirm Password', 'Type the password again')}
                </div>

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={close}
                        className="h-11 w-full sm:w-auto px-6 rounded-xl border border-slate-200 text-ui-body font-semibold text-slate-700 hover:border-slate-300"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex h-11 w-full sm:w-auto items-center justify-center gap-2 px-6 rounded-xl bg-blue-600 text-white text-ui-body font-semibold disabled:opacity-60"
                    >
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        Save changes
                    </button>
                </div>
            </form>
        );
    };

    if (hidden) return null;
    return (
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-6 space-y-4" aria-labelledby="staff-accounts-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 id="staff-accounts-title" className={`${CARD_TITLE} text-slate-900`}>Site staff accounts</h2>
                    <p className="text-ui-body text-slate-500 mt-0.5">
                        The CMS, events and mobile event-attendance sign-ins. Change their name, email or password here.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={load}
                    aria-label="Reload staff accounts"
                    className="shrink-0 grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {loading && accounts.length === 0 ? (
                <div className="flex items-center gap-3 py-6 text-slate-500 text-ui-body">
                    <Loader2 className="w-5 h-5 animate-spin" /> Loading staff accounts…
                </div>
            ) : failed ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-ui-body text-red-800 flex flex-wrap items-center justify-between gap-3">
                    <span>Could not load the staff accounts.</span>
                    <button type="button" onClick={load} className="font-semibold underline">Try again</button>
                </div>
            ) : visibleAccounts.length === 0 ? (
                <p className="py-4 text-ui-body text-slate-500">{needle.length >= 2 ? 'No staff accounts match this search.' : 'No CMS, events or attendance staff account exists yet.'}</p>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {visibleAccounts.map((a) => {
                        const editing = editingId === a.id;
                        return (
                            <article key={a.id} className={`rounded-xl border p-4 sm:p-5 ${editing ? 'border-blue-300 ring-4 ring-blue-500/10' : 'border-slate-200'}`}>
                                <div className="flex flex-wrap items-start gap-3">
                                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
                                        <ShieldCheck className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-semibold text-slate-900 text-[1.3125rem] [overflow-wrap:anywhere]">{a.fullName || 'Unnamed account'}</p>
                                            <span className="text-ui-caption font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{a.roleLabel}</span>
                                            {!a.active && (
                                                <span className="text-ui-caption font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">Deactivated</span>
                                            )}
                                        </div>
                                        <p className="text-ui-small text-slate-600 break-all">{a.email}</p>
                                        <p className="text-ui-small text-slate-500">
                                            {a.phoneNumber ? `${a.phoneNumber} · ` : ''}Last sign-in: {formatWhen(a.lastLoginAt)}
                                        </p>
                                    </div>
                                    {!editing && (
                                        <button
                                            type="button"
                                            onClick={() => openEdit(a)}
                                            className="inline-flex items-center gap-2 h-10 px-3.5 rounded-lg border border-slate-200 text-ui-small font-semibold text-slate-700 hover:bg-slate-50 shrink-0"
                                        >
                                            <Pencil className="w-4 h-4" /> Edit
                                        </button>
                                    )}
                                    {editing && (
                                        <button type="button" onClick={close} aria-label="Close editor"
                                            className="grid h-10 w-10 place-items-center rounded-lg text-slate-400 hover:text-slate-700 shrink-0">
                                            <X className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>

                                {editing && editor(a)}
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
