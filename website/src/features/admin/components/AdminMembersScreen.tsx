import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, Users, BadgeCheck, CalendarClock, XCircle, Hourglass, Send, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import AdminSidebar from "./AdminSidebar";
import AdminMemberList from "./AdminMemberList";
import ProfileViewModal from "@/components/ui/profile-view-modal";
import { getApplicationProfile, memberAction, errorMessage } from "@/services/activApi";
import {
    listAdminMembers, setMemberReminders, remindMemberNow, remindAllExpired,
    type AdminMember, type AdminMembersPayload, type MembersTab,
} from "@/services/adminMembersApi";
import { type AdminTier } from "./tierConfig";
import { adminRegionLabel } from "@/lib/session";
import { AdminPageHeader, AdminStat, ADMIN_BG, ADMIN_PAGE } from './AdminUI';

/**
 * ADMIN → MEMBERS, for every tier — each inside its own region.
 *
 * ACTIVE means PAID and in date. EXPIRED means the paid period has ended — the
 * server flips it automatically — and those members are sent "renew now" on
 * the 1st and 15th of every month while their Reminders switch is on. AWAITING
 * PAYMENT is an approved application whose fee is not paid yet.
 *
 * This replaced a directory of "approved + rejected applications", where Active
 * meant approved and Inactive meant rejected — neither said whether anyone had
 * paid. The rules are `backend/src/modules/admin/adminMembers.service.js`.
 *
 * WHO MAY DO WHAT: every tier reads. The Reminders switch, "Remind now" and
 * "Remind all expired" are the State Admin's (and the Super Admin's) — the
 * server refuses anyone else. Block / delete stay State and Super only, as before.
 */

const TABS: { key: MembersTab; label: string }[] = [
    { key: 'active', label: 'Active' },
    { key: 'expiring', label: 'Expiring soon' },
    { key: 'expired', label: 'Expired' },
    { key: 'awaiting', label: 'Awaiting payment' },
    { key: 'all', label: 'All' },
];

const TYPES = [
    { key: '', label: 'All types' },
    { key: 'business', label: 'Business' },
    { key: 'aspirant', label: 'Aspirant' },
    { key: 'student', label: 'Student' },
];

const inTab = (m: AdminMember, tab: MembersTab) => {
    if (tab === 'active') return m.status === 'active';
    if (tab === 'expiring') return m.status === 'active' && m.expiringSoon;
    if (tab === 'expired') return m.status === 'expired';
    if (tab === 'awaiting') return m.status === 'awaiting_payment';
    return true;
};

export default function AdminMembersScreen({ tier }: { tier: AdminTier }) {
    /** "Tamil Nadu", "Ariyalur district, Tamil Nadu" — the signed-in admin's own patch. */
    const regionLabel = adminRegionLabel();
    const mayManageMembers = tier === 'state' || tier === 'super';

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [data, setData] = useState<AdminMembersPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [tab, setTab] = useState<MembersTab>('active');
    const [type, setType] = useState('');
    const [query, setQuery] = useState('');
    const [busyId, setBusyId] = useState<string | null>(null);
    const [bulkBusy, setBulkBusy] = useState(false);

    const [selectedProfile, setSelectedProfile] = useState<any>(null);
    const [profileModalOpen, setProfileModalOpen] = useState(false);
    const [profileLoading, setProfileLoading] = useState(false);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setLoadError('');
            setData(await listAdminMembers({ tab: 'all' }));
        } catch (error) {
            setLoadError(errorMessage(error, "The members list could not be loaded"));
            setData(null);
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { load(); }, [load, tier]);

    const rows = useMemo(() => data?.rows || [], [data]);
    /* Server answer AND the screen's tier: a district or block screen never
       draws a reminder control, whatever the response says. */
    const canManageReminders = !!data?.canManageReminders && mayManageMembers;

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return rows
            .filter((m) => inTab(m, tab))
            .filter((m) => !type || m.kind === type)
            .filter((m) => !q || [m.name, m.email, m.phone, m.memberNumber, m.block, m.district].some((v) => String(v || '').toLowerCase().includes(q)));
    }, [rows, tab, type, query]);

    const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.key, rows.filter((m) => inTab(m, t.key)).length])) as Record<MembersTab, number>, [rows]);
    const summary = data?.summary;

    /* ---------------------------------------------------------- actions */

    const patchRow = (id: string, patch: Partial<AdminMember>) =>
        setData((d) => (d ? { ...d, rows: d.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) } : d));

    const onToggleReminders = async (m: AdminMember, enabled: boolean) => {
        setBusyId(m.id);
        try {
            await setMemberReminders(m.id, enabled);
            patchRow(m.id, { reminders: enabled });
            toast.success(enabled
                ? `Reminders on — ${m.name || 'this member'} is reminded on the 1st and 15th once expired`
                : `Reminders off for ${m.name || 'this member'}`);
        } catch (error) {
            toast.error(errorMessage(error, 'Could not change reminders'));
        } finally {
            setBusyId(null);
        }
    };

    const onRemindNow = async (m: AdminMember) => {
        setBusyId(m.id);
        try {
            const r = await remindMemberNow(m.id);
            patchRow(m.id, { lastReminderAt: r.at || new Date().toISOString() });
            toast.success(`Renewal reminder sent to ${m.name || 'the member'} — email, WhatsApp and their bell`);
        } catch (error) {
            toast.error(errorMessage(error, 'Could not send the reminder'));
        } finally {
            setBusyId(null);
        }
    };

    const onRemindAll = async () => {
        if (!window.confirm(`Send a renewal reminder to every expired member in your region with reminders on? Anyone reminded in the last 24 hours is skipped.`)) return;
        setBulkBusy(true);
        try {
            const r = await remindAllExpired();
            toast.success(`Reminder sent to ${r.sent} member${r.sent === 1 ? '' : 's'}${r.skipped ? ` · ${r.skipped} skipped (reminded in the last 24 hours)` : ''}`);
            load();
        } catch (error) {
            toast.error(errorMessage(error, 'Could not send reminders'));
        } finally {
            setBulkBusy(false);
        }
    };

    const onToggleActive = async (m: AdminMember, nextActive: boolean) => {
        if (!m.applicationId) { toast.error('This member has no application on record'); return; }
        setBusyId(m.id);
        try {
            await memberAction(m.applicationId, nextActive ? 'activate' : 'suspend');
            toast.success(nextActive ? 'Member unblocked — they can sign in again' : 'Member blocked — they can no longer sign in');
            await load();
        } catch (error) {
            toast.error(errorMessage(error, 'Could not update this member'));
        } finally {
            setBusyId(null);
        }
    };

    const onDelete = async (m: AdminMember) => {
        if (!m.applicationId) { toast.error('This member has no application on record'); return; }
        const ok = window.confirm(`Permanently delete ${m.name || 'this member'}?\n\nThis removes their application, login, member record, business, financial and declaration forms. It cannot be undone.`);
        if (!ok) return;
        setBusyId(m.id);
        try {
            await memberAction(m.applicationId, 'delete');
            toast.success(`${m.name || 'Member'} deleted`);
            await load();
        } catch (error) {
            toast.error(errorMessage(error, 'Could not delete this member'));
        } finally {
            setBusyId(null);
        }
    };

    const onOpen = async (m: AdminMember) => {
        if (!m.applicationId) { toast.error('This member has no application on record'); return; }
        try {
            setProfileLoading(true);
            setProfileModalOpen(true);
            const profile = await getApplicationProfile(m.applicationId);
            if (!profile) { toast.error('Application not found'); setProfileModalOpen(false); return; }
            setSelectedProfile(profile);
        } catch (error) {
            toast.error(errorMessage(error, 'Failed to load application data'));
            setProfileModalOpen(false);
        } finally {
            setProfileLoading(false);
        }
    };

    const emptyHint = query || type
        ? 'Try a different search or type.'
        : tab === 'expired' ? 'Nobody’s membership has lapsed.'
            : tab === 'expiring' ? 'No membership ends in the next 30 days.'
                : tab === 'awaiting' ? 'Every approved applicant has paid.'
                    : 'Members appear here once they have paid.';

    return (
        <div className={`min-h-screen flex ${ADMIN_BG}`}>
            {/* No `tier`: the sidebar labels itself from the SIGNED-IN role, not the route. */}
            <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 min-w-0 flex flex-col">
                <AdminPageHeader
                    title="Members"
                    subtitle={tier === 'super'
                        ? 'Paid members across the association — who is active, who has lapsed, who is still to pay'
                        : `Members in ${regionLabel || 'your region'} — who is active, who has lapsed, who is still to pay`}
                    onMenu={() => setSidebarOpen(true)}
                />

                <div className={`flex-1 overflow-y-auto ${ADMIN_PAGE}`}>
                    {data?.scopeUnresolved ? (
                        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-ui-caption text-amber-900">
                            {(data as any).message || 'This account has no region on record, so no members can be shown. Ask the Super Admin to set its region.'}
                        </p>
                    ) : null}

                    {/* ---- the figures ---- */}
                    {loadError ? (
                        <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-[1rem] text-rose-800">
                                <strong>Members could not be loaded.</strong> {loadError}
                            </p>
                            <button type="button" onClick={load}
                                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100">
                                <RefreshCw className="h-4 w-4" /> Retry
                            </button>
                        </div>
                    ) : null}

                    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                        <AdminStat primary icon={<BadgeCheck className="h-5 w-5" />} label="Active" hint={summary?.renewedThisMonth ? `Paid and in date · ${summary.renewedThisMonth} renewed this month` : 'Paid and in date'} value={summary?.active ?? 0} onClick={() => setTab('active')} />
                        <AdminStat tone="amber" icon={<CalendarClock className="h-5 w-5" />} label="Expiring soon" hint="Within 30 days" value={summary?.expiringSoon ?? 0} onClick={() => setTab('expiring')} />
                        <AdminStat tone="rose" icon={<XCircle className="h-5 w-5" />} label="Expired" hint="Not renewed" value={summary?.expired ?? 0} onClick={() => setTab('expired')} />
                        <AdminStat tone="slate" icon={<Hourglass className="h-5 w-5" />} label="Awaiting payment" hint="Approved, not paid" value={summary?.awaitingPayment ?? 0} onClick={() => setTab('awaiting')} />
                    </div>

                    <p className="flex items-start gap-2 rounded-xl bg-blue-50/60 px-3 py-2.5 text-[0.9375rem] text-slate-600 ring-1 ring-blue-100">
                        <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                        <span>
                            <strong className="text-slate-800">Active</strong> = paid and in date. When the paid period ends the member moves to
                            <strong className="text-slate-800"> Expired</strong> by itself
                            {canManageReminders
                                ? <>, and — while their Reminders switch is on — is sent “your membership has expired, renew now” on the 1st and 15th of every month.</>
                                : '.'}
                        </span>
                    </p>

                    {/* ---- tabs ---- */}
                    <div role="tablist" aria-label="Members" className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200/60 [scrollbar-width:none]">
                        {TABS.map((t) => {
                            const on = tab === t.key;
                            return (
                                <button key={t.key} role="tab" aria-selected={on} type="button" onClick={() => setTab(t.key)}
                                    className={`flex min-h-10 flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[1rem] font-semibold transition-colors ${
                                        on ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                                    {t.label}
                                    <span className={`rounded-full px-1.5 text-[0.8125rem] ${on ? 'bg-white/20' : 'bg-white text-slate-500'}`}>{counts[t.key] ?? 0}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* ---- search, type, bulk ---- */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="relative min-w-0 flex-1">
                            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, phone, Member ID or area…"
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                        </div>
                        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Membership type"
                            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base outline-none focus:border-blue-500 sm:w-48">
                            {TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                        </select>
                        {canManageReminders && (tab === 'expired' || tab === 'all') && counts.expired > 0 ? (
                            <button type="button" onClick={onRemindAll} disabled={bulkBusy}
                                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white disabled:opacity-60">
                                {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Remind all expired
                            </button>
                        ) : null}
                    </div>

                    <AdminMemberList
                        members={visible}
                        loading={loading}
                        busyId={busyId}
                        emptyHint={emptyHint}
                        onOpen={onOpen}
                        canManageReminders={canManageReminders}
                        onToggleReminders={onToggleReminders}
                        onRemindNow={onRemindNow}
                        onToggleActive={mayManageMembers ? onToggleActive : undefined}
                        onDelete={mayManageMembers ? onDelete : undefined}
                    />

                    {!loading && rows.length === 0 && !data?.scopeUnresolved ? (
                        <p className="flex items-center gap-2 text-[0.9375rem] text-slate-500"><Users className="h-4 w-4" /> No paid or approved members in this region yet.</p>
                    ) : null}
                </div>
            </div>

            <ProfileViewModal
                open={profileModalOpen}
                onClose={() => { setProfileModalOpen(false); setSelectedProfile(null); }}
                profile={selectedProfile}
                loading={profileLoading}
            />
        </div>
    );
}
