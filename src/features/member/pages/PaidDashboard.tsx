import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    getRecentActivity,
    getMyProfile,
    getBusinessInfo,
    type MemberActivity,
} from '@/services/activApi';
import {
    User, Settings, Calendar, Headphones, FileText, Download, Clock,
    Briefcase, ChevronRight, BadgeCheck, CalendarDays,
} from 'lucide-react';
import MemberPageShell from '@/pages/member/MemberPageShell';
import { toast } from 'sonner';

/**
 * The dashboard a member sees once their payment has been recorded.
 *
 * Rendered inside `MemberPageShell` — the same shell every other member screen
 * uses, and the member counterpart of the `BusinessPageShell` the business
 * screens sit in. This page had grown its own chrome instead: a `#352367`
 * purple band with rounded bottom corners, a second mobile-only header above
 * it, and its own `h-screen overflow-y-auto` column. So one page had a
 * different sidebar treatment, a different header and a different scroll
 * container from the rest of the site, with its content in a `max-w-4xl`
 * column that left a third of a desktop screen empty beside it.
 *
 * The palette is the site's blue. The pink membership card and the
 * indigo-to-purple business banner were the last purple in the member area.
 *
 * Two invented values came back with that redesign and are gone again:
 * `memberId || 'TC-2024-1345'`, and a "Member since" falling back to
 * `January 15, 2020`. Both are mobile's placeholders. An ID that is really a
 * literal cannot be quoted to anyone or matched against a certificate, and a
 * join date printed for someone who has none is simply false — each row is
 * omitted when there is nothing real to put in it.
 */
export default function PaidDashboard() {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [isBusinessMember, setIsBusinessMember] = useState(false);
    const [activity, setActivity] = useState<MemberActivity[]>([]);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            // Settled, not all-or-nothing: the business lookup 404s for a member
            // who never filled that form in, and that must not blank the page.
            const [profileResult, businessResult] = await Promise.allSettled([
                getMyProfile(),
                getBusinessInfo(),
            ]);
            if (cancelled) return;

            if (profileResult.status === 'fulfilled') setProfile(profileResult.value);
            if (businessResult.status === 'fulfilled') {
                setIsBusinessMember((businessResult.value as any)?.doingBusiness === true);
            }
            setLoading(false);
        })();

        getRecentActivity(6).then(rows => { if (!cancelled) setActivity(rows); });
        return () => { cancelled = true; };
    }, []);

    const name = profile?.fullName || 'Member';
    const planLabel = isBusinessMember ? 'Business Membership' : 'Aspirant Membership';

    /** Only what the record holds — no placeholder id, no placeholder date. */
    const memberId = profile?.membershipNumber || '';
    const membershipType = String(profile?.membershipType || '').trim();
    const memberSince = profile?.membershipActivatedAt || profile?.approvedAt || '';
    const memberSinceLabel = memberSince
        ? new Date(memberSince).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'long', year: 'numeric',
        })
        : '';

    /**
     * The four tiles.
     *
     * Events and Support rendered as buttons with no `onClick` at all — styled
     * identically to the two that worked, and doing nothing when pressed. There
     * is no member Events or Support page on this site, so they go to the public
     * pages that answer the same need rather than staying dead.
     */
    const TILES = [
        { label: 'Profile', icon: User, to: '/member/profile-view' },
        { label: 'Events', icon: Calendar, to: '#', isUpcoming: true },
        { label: 'Support', icon: Headphones, to: '#', isUpcoming: true },
        { label: 'Settings', icon: Settings, to: '/member/settings' },
    ];

    const DOCUMENTS = [
        { label: 'Membership Certificate', to: '/member/certificate/membership' },
        { label: 'Tax Exemption Certificate', to: '/member/certificate/tax-exemption' },
    ];

    if (loading) {
        return (
            <MemberPageShell title="Dashboard" subtitle="Your membership" width="wide">
                <p className="text-slate-500 py-20 text-center">Loading your dashboard…</p>
            </MemberPageShell>
        );
    }

    return (
        <MemberPageShell
            title="Dashboard"
            subtitle={`Welcome back, ${name.split(' ')[0]}`}
            width="wide"
        >
            <div className="space-y-6">
                {/* Membership card */}
                <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 text-white p-6 lg:p-8 shadow-lg">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                            <h2 className="text-2xl font-bold truncate">{name}</h2>
                            <p className="text-blue-100 text-sm mt-1">{planLabel}</p>
                        </div>

                        <div className="flex flex-wrap gap-2 shrink-0">
                            {/* Absent when the record carries no type, rather than
                                the literal "Lifetime" this printed for everyone
                                while the stored value was 'annual'. */}
                            {membershipType && membershipType !== 'none' ? (
                                <span className="bg-white/20 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide capitalize">
                                    {membershipType}
                                </span>
                            ) : null}
                            <span className="bg-green-500 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide inline-flex items-center gap-1">
                                <BadgeCheck className="w-3.5 h-3.5" /> Active
                            </span>
                        </div>
                    </div>

                    {(memberSinceLabel || memberId) && (
                        <div className="mt-6 pt-5 border-t border-white/20 flex flex-wrap gap-x-10 gap-y-3">
                            {memberSinceLabel ? (
                                <div>
                                    <p className="text-xs text-blue-200 uppercase tracking-wide flex items-center gap-1.5">
                                        <CalendarDays className="w-3.5 h-3.5" /> Member since
                                    </p>
                                    <p className="font-semibold mt-0.5">{memberSinceLabel}</p>
                                </div>
                            ) : null}
                            {memberId ? (
                                <div>
                                    <p className="text-xs text-blue-200 uppercase tracking-wide">Member ID</p>
                                    <p className="font-semibold mt-0.5 tracking-wider tabular-nums">{memberId}</p>
                                </div>
                            ) : null}
                        </div>
                    )}
                </div>

                <div className="grid gap-6 lg:grid-cols-12 items-start">
                    {/* Quick actions */}
                    <div className="lg:col-span-7">
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-4">
                            {TILES.map(({ label, icon: Icon, to, isUpcoming }) => (
                                <button
                                    key={label}
                                    type="button"
                                    onClick={() => {
                                        if (isUpcoming) {
                                            toast.info(`${label} is an upcoming feature!`);
                                        } else {
                                            navigate(to);
                                        }
                                    }}
                                    className="bg-white rounded-2xl p-6 flex flex-col items-center justify-center
                                               border border-slate-200 shadow-sm hover:border-blue-400
                                               hover:bg-blue-50 transition-colors"
                                >
                                    <span className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-3">
                                        <Icon className="w-7 h-7 text-blue-600" />
                                    </span>
                                    <span className="text-sm font-semibold text-slate-800">{label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Documents, and the business area */}
                    <div className="lg:col-span-5 space-y-6">
                        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                            <h3 className="text-lg font-bold text-slate-900 mb-1">Official Documents</h3>
                            <p className="text-sm text-slate-500 mb-5">
                                Issued against your active membership.
                            </p>

                            <div className="space-y-3">
                                {DOCUMENTS.map((doc) => (
                                    <button
                                        key={doc.to}
                                        type="button"
                                        /* These had no onClick: two buttons styled as
                                           downloads that did nothing when pressed. */
                                        onClick={() => navigate(doc.to)}
                                        className="w-full flex items-center justify-between gap-3 p-4 rounded-xl
                                                   border border-slate-200 hover:border-blue-400 hover:bg-blue-50
                                                   transition-colors text-left"
                                    >
                                        <span className="flex items-center gap-3 min-w-0">
                                            <span className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center
                                                             justify-center shrink-0">
                                                <FileText className="w-5 h-5" />
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block text-sm font-semibold text-slate-900 truncate">
                                                    {doc.label}
                                                </span>
                                                <span className="block text-xs text-slate-500">
                                                    View, print or save as PDF
                                                </span>
                                            </span>
                                        </span>
                                        <Download className="w-5 h-5 text-blue-500 shrink-0" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Only for a member who declared a business — an aspirant
                            has no catalog or storefront to open. */}
                        {isBusinessMember && (
                            <div className="rounded-2xl bg-gradient-to-br from-blue-700 to-blue-900 text-white p-6 shadow-md">
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <h4 className="text-base font-bold flex items-center gap-1.5">
                                            <Briefcase className="w-4 h-4" /> Business Dashboard
                                        </h4>
                                        <p className="text-xs text-blue-100 mt-1">
                                            Manage catalog, companies, analytics &amp; sales
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => navigate('/business/dashboard')}
                                        className="inline-flex items-center gap-1 bg-white text-blue-700 hover:bg-blue-50
                                                   px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors shrink-0"
                                    >
                                        Open <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent activity */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 mb-1">Recent Activity</h3>
                    <p className="text-sm text-slate-500 mb-5">What has happened on your account.</p>

                    {activity.length === 0 ? (
                        <p className="text-sm text-slate-400 py-6 text-center">
                            Nothing yet. Activity appears here as your account changes.
                        </p>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {activity.map((row, i) => (
                                <div key={row.id || i} className="flex items-start gap-3 py-3">
                                    <span className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center
                                                     justify-center shrink-0">
                                        <Clock className="w-4 h-4" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-medium text-slate-900">
                                            {row.description || row.type}
                                        </span>
                                        <span className="block text-xs text-slate-400 mt-0.5">
                                            {row.at ? new Date(row.at).toLocaleString() : ''}
                                        </span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </MemberPageShell>
    );
}
