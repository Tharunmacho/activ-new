import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
    Camera, Loader2, Mail, Phone, MessageCircle, MapPin, KeyRound, Eye, EyeOff, LogOut,
    UserRound, Briefcase, LifeBuoy, ChevronRight, ShieldCheck, Pencil,
} from 'lucide-react';
import MemberPageShell from '@/pages/member/MemberPageShell';
import { useMembershipGate } from '@/features/member/useMembershipGate';
import {
    getMyProfile, getMyApplication, changePassword, logout, errorMessage,
} from '@/services/activApi';
import { MemberAvatar, uploadMemberPhoto } from '@/features/member/memberPhoto';
import AssociationUpdatePreferences from '../components/AssociationUpdatePreferences';

/**
 * SETTINGS — THE ACCOUNT, NOT THE APPLICATION.
 *
 * This screen used to be a second copy of the application: personal details,
 * the business question and the declaration, all editable, beside a "My
 * Profile" that carried the same three. Two screens editing one record with
 * different field sets is how fields went missing before (see the note that
 * used to head this file), and to the applicant it read as the same page twice.
 *
 * So the split is by QUESTION now:
 *
 *   My Profile  what you told us — the application, edited through its steps
 *   Settings    your account — photo, password, how we reach you, sign out
 *
 * Contact and region details are SHOWN here and edited in My Profile. Saving
 * them from here would go through `PUT /members/profile`, which also creates and
 * locks the Personal Details record — a phone-number change could mark a form
 * "complete" the member never filled in.
 */

type Profile = Record<string, any>;

const initials = (name: string) =>
    (name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || 'M';

/** "9876543210" -> "+91 98765 43210"; anything else as stored. */
const prettyPhone = (value: unknown) => {
    const digits = String(value || '').replace(/\D/g, '');
    const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
    return local.length === 10 ? `+91 ${local.slice(0, 5)} ${local.slice(5)}` : String(value || '');
};

function Section({ icon, title, hint, children, action }: {
    icon: ReactNode; title: string; hint?: string; children: ReactNode; action?: ReactNode;
}) {
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">{icon}</span>
                    <div className="min-w-0">
                        <h2 className="font-display text-[1.375rem] sm:text-[1.5625rem] font-semibold text-slate-900">{title}</h2>
                        {hint ? <p className="mt-0.5 text-[1.125rem] sm:text-[1.125rem] text-slate-500">{hint}</p> : null}
                    </div>
                </div>
                {action}
            </div>
            {children}
        </section>
    );
}

function DetailRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
    return (
        <div className="flex min-w-0 items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
            <span className="shrink-0 text-slate-400">{icon}</span>
            <div className="min-w-0">
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                <p className="truncate text-[1.125rem] font-medium text-slate-800" title={value || undefined}>
                    {value || <span className="font-normal text-slate-400">Not given</span>}
                </p>
            </div>
        </div>
    );
}

function PasswordInput({ label, value, onChange, autoComplete }: {
    label: string; value: string; onChange: (v: string) => void; autoComplete: string;
}) {
    const [shown, setShown] = useState(false);
    return (
        <label className="block min-w-0">
            <span className="text-[1.125rem] font-semibold text-slate-700">{label}</span>
            <span className="relative mt-1.5 block">
                <input
                    type={shown ? 'text' : 'password'}
                    value={value}
                    autoComplete={autoComplete}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 pr-11 text-[1.125rem] text-slate-900
                               outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <button
                    type="button"
                    onClick={() => setShown((s) => !s)}
                    aria-label={shown ? 'Hide password' : 'Show password'}
                    className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center text-slate-400 hover:text-slate-600"
                >
                    {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
            </span>
        </label>
    );
}

export default function AccountSettings() {
    const navigate = useNavigate();
    const { isPaid } = useMembershipGate();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [appStatus, setAppStatus] = useState('');
    const [loading, setLoading] = useState(true);

    const [photoBusy, setPhotoBusy] = useState(false);
    const fileRef = useRef<HTMLInputElement | null>(null);

    const [pw, setPw] = useState({ old: '', next: '', confirm: '' });
    const [pwBusy, setPwBusy] = useState(false);

    const load = useCallback(async () => {
        const [p, a] = await Promise.allSettled([getMyProfile(), getMyApplication()]);
        setProfile(p.status === 'fulfilled' ? (p.value || {}) : {});
        const app: any = a.status === 'fulfilled' ? a.value : null;
        setAppStatus(String(app?.status || ''));
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const name = String(profile?.fullName || profile?.name || '');
    const memberId = String(profile?.membershipNumber || profile?.memberCode || '');

    const status = (() => {
        if (isPaid) return { text: memberId ? `Active member · ${memberId}` : 'Active member', tone: 'bg-emerald-400/20 text-emerald-50' };
        const s = appStatus.toLowerCase();
        if (s.includes('approved')) return { text: 'Approved · payment due', tone: 'bg-amber-300/25 text-amber-50' };
        if (s.includes('reject')) return { text: 'Application not approved', tone: 'bg-rose-400/25 text-rose-50' };
        if (s) return { text: 'Application under review', tone: 'bg-white/20 text-white' };
        return { text: 'Applicant · application not submitted', tone: 'bg-white/20 text-white' };
    })();

    const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setPhotoBusy(true);
        try {
            // The shared store: every avatar on the page (sidebar, dashboards)
            // updates the moment this lands.
            const url = await uploadMemberPhoto(file);
            setProfile((prev) => ({ ...(prev || {}), profilePhoto: url }));
            toast.success('Profile photo updated');
        } catch (err) {
            toast.error(errorMessage(err, 'Could not upload the photo. Please try again.'));
        } finally {
            setPhotoBusy(false);
        }
    };

    const onChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pw.old) { toast.error('Enter your current password'); return; }
        if (pw.next.length < 6) { toast.error('The new password needs at least 6 characters'); return; }
        if (pw.next !== pw.confirm) { toast.error('The two new passwords do not match'); return; }
        if (pw.next === pw.old) { toast.error('Choose a password different from the current one'); return; }
        setPwBusy(true);
        try {
            await changePassword(pw.old, pw.next);
            setPw({ old: '', next: '', confirm: '' });
            toast.success('Your password has been changed');
        } catch (err) {
            toast.error(errorMessage(err, 'Could not change the password'));
        } finally {
            setPwBusy(false);
        }
    };

    const onSignOut = async () => {
        await logout().catch(() => null);
        navigate('/login', { replace: true });
    };

    const shortcuts = [
        { icon: <UserRound className="h-4 w-4" />, label: 'My Profile', note: 'Your application details', to: '/member/profile-view' },
        { icon: <Briefcase className="h-4 w-4" />, label: 'Business Account', note: 'Companies, catalogue and reach', to: '/business/create-profile' },
        { icon: <LifeBuoy className="h-4 w-4" />, label: 'Help & Support', note: 'Contact your regional office', to: '/member/help' },
    ];

    return (
        <MemberPageShell title="Settings" subtitle="Your account, password and sign-in">
            {loading ? (
                <div className="flex min-h-[40vh] items-center justify-center gap-3 text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin" /> Loading your account…
                </div>
            ) : (
                <div className="grid w-full gap-4 sm:gap-5 lg:grid-cols-2 xl:grid-cols-3">
                    {/* ---- the account, at a glance ---- */}
                    <section className="lg:col-span-2 xl:col-span-3 overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e3a8a] to-[#2563eb] p-4 sm:p-6 text-white
                                        shadow-[0_10px_28px_-6px_rgba(16,24,40,0.25)]">
                        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
                            <div className="relative h-20 w-20 shrink-0 sm:h-24 sm:w-24">
                                {/* Tap to see it full size (and change it there). */}
                                <MemberAvatar
                                    name={name}
                                    className="h-full w-full rounded-2xl bg-white/15 ring-4 ring-white/25"
                                    initialsClassName="font-display text-[1.75rem] font-bold text-white"
                                />
                                <button
                                    type="button"
                                    onClick={() => fileRef.current?.click()}
                                    disabled={photoBusy}
                                    aria-label="Change profile photo"
                                    className="absolute -bottom-2 -right-2 grid h-10 w-10 place-items-center rounded-full bg-white text-blue-700 shadow-lg
                                               hover:bg-blue-50 disabled:opacity-70"
                                >
                                    {photoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                                </button>
                                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPhoto} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-display text-[1.75rem] sm:text-[2.125rem] font-bold">{name || 'Your account'}</p>
                                <p className="truncate text-[1.125rem] text-white/80">{String(profile?.email || '')}</p>
                                <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-ui-caption font-semibold ${status.tone}`}>
                                    {status.text}
                                </span>
                            </div>
                        </div>
                    </section>

                    {/* ---- contact and region: shown here, edited in My Profile ---- */}
                    <Section
                        icon={<MapPin className="h-4 w-4" />}
                        title="Your details"
                        hint="As your application records them"
                        action={(
                            <button
                                type="button"
                                onClick={() => navigate('/member/profile-view')}
                                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-[1.125rem] font-semibold
                                           text-blue-700 hover:bg-blue-50"
                            >
                                <Pencil className="h-3.5 w-3.5" /> Edit in My Profile
                            </button>
                        )}
                    >
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
                            <DetailRow icon={<Mail className="h-4 w-4" />} label="Email" value={String(profile?.email || '')} />
                            <DetailRow icon={<Phone className="h-4 w-4" />} label="Mobile" value={prettyPhone(profile?.phoneNumber)} />
                            <DetailRow icon={<MessageCircle className="h-4 w-4" />} label="WhatsApp" value={prettyPhone(profile?.whatsappNumber || profile?.phoneNumber)} />
                            {profile?.isInternational ? (
                                <DetailRow icon={<MapPin className="h-4 w-4" />} label="Place" value={String(profile?.place || profile?.city || '')} />
                            ) : (
                                <>
                                    <DetailRow icon={<MapPin className="h-4 w-4" />} label="Block" value={String(profile?.block || '')} />
                                    <DetailRow icon={<MapPin className="h-4 w-4" />} label="District" value={String(profile?.district || '')} />
                                    <DetailRow icon={<MapPin className="h-4 w-4" />} label="State" value={String(profile?.state || '')} />
                                </>
                            )}
                        </div>
                        <p className="mt-3 text-ui-caption text-slate-500">
                            Your region decides which Block, District and State Admins review your application.
                        </p>
                    </Section>

                    {/* ---- password ---- */}
                    <Section icon={<KeyRound className="h-4 w-4" />} title="Password" hint="Use at least 6 characters">
                        <form onSubmit={onChangePassword} className="grid gap-3">
                            <PasswordInput label="Current password" value={pw.old} autoComplete="current-password"
                                onChange={(v) => setPw((p) => ({ ...p, old: v }))} />
                            <PasswordInput label="New password" value={pw.next} autoComplete="new-password"
                                onChange={(v) => setPw((p) => ({ ...p, next: v }))} />
                            <PasswordInput label="Confirm new password" value={pw.confirm} autoComplete="new-password"
                                onChange={(v) => setPw((p) => ({ ...p, confirm: v }))} />
                            <div className="flex flex-col gap-2 pt-1">
                                <button type="button" onClick={() => navigate('/forgot-password')}
                                    className="order-last min-h-10 text-center text-[1.125rem] font-semibold text-blue-700 hover:underline">
                                    Forgot your password?
                                </button>
                                <button type="submit" disabled={pwBusy}
                                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5
                                               text-[1.125rem] font-semibold text-white disabled:opacity-70">
                                    {pwBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                                    Update password
                                </button>
                            </div>
                        </form>
                    </Section>

                    <AssociationUpdatePreferences />

                    {/* ---- shortcuts + sign out ---- */}
                    <section className="lg:col-span-2 xl:col-span-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                            {shortcuts.map((s) => (
                                <button key={s.to} type="button" onClick={() => navigate(s.to)}
                                    className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-left hover:bg-slate-50">
                                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700">{s.icon}</span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[1.125rem] font-semibold text-slate-800">{s.label}</span>
                                        <span className="block truncate text-ui-caption text-slate-500">{s.note}</span>
                                    </span>
                                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                                </button>
                            ))}
                            <button type="button" onClick={onSignOut}
                                className="flex min-h-[3.75rem] items-center justify-center gap-2 rounded-xl border border-rose-200
                                           bg-rose-50 px-4 text-[1.125rem] font-semibold text-rose-700 hover:bg-rose-100">
                                <LogOut className="h-4 w-4" /> Sign out
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </MemberPageShell>
    );
}
