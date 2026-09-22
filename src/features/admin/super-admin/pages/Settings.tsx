import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
    User,
    Bell,
    CheckCircle,
    XCircle,
    Clock,
    Users,
    HelpCircle,
    LogOut,
    ChevronRight,
    Mail,
    MapPin,
    Shield
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";
import { toast } from "sonner";
import ProfileEditModal from "../components/ProfileEditModal";
import AuditLog from "../components/AuditLog";
import { apiFetch, dashboardPathForRole, logout } from "@/services/activApi";
import { AdminPageHeader, ADMIN_BG, ADMIN_PAGE } from "@/features/admin/components/AdminUI";

import { CARD_TITLE } from '@/components/layout/appTypography';
const Settings = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeStatus, setActiveStatus] = useState(true);
    const [profileModalOpen, setProfileModalOpen] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const navigate = useNavigate();

    // State for admin info
    const [adminInfo, setAdminInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    
    // Get fallback info from localStorage
    const userName = adminInfo?.fullName || localStorage.getItem('userName') || 'Super Admin';
    const userEmail = adminInfo?.email || localStorage.getItem('userEmail') || 'admin@example.com';
    const role = localStorage.getItem('role') || 'super_admin';
    const adminLocation = 'All India';

    const roleLabel = useMemo(() => {
        if (role === 'block_admin') return 'Block Admin';
        if (role === 'district_admin') return 'District Admin';
        if (role === 'state_admin') return 'State Admin';
        if (role === 'super_admin') return 'Super Admin';
        return 'Admin';
    }, [role]);

    const avatarInitials = useMemo(() => {
        if (role === 'block_admin') return 'BA';
        if (role === 'district_admin') return 'DA';
        if (role === 'state_admin') return 'SA';
        if (role === 'super_admin') return 'SU';
        return userName.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
    }, [role, userName]);

    /**
     * `logout()`, not a hand-written list of keys.
     *
     * The list below it removed nine entries and never `token` — the key
     * `apiFetch` authenticates with — so this button navigated to /login while
     * leaving a live session token in the browser. The same defect was fixed in
     * `AdminSidebar` and this second copy was missed.
     */
    const handleLogout = async () => {
        try {
            await logout();
        } catch (err) {
            console.warn('Logout safely caught:', err);
        }
        navigate('/login');
    };

    // Fetch real stats from backend
    /**
     * The three figures mobile's Settings shows under "Platform".
     *
     * Not the approval counts that were here — those are the Hub's job, and
     * repeating them told a super admin nothing new on a page about their own
     * account and the audit trail.
     */
    const [stats, setStats] = useState({
        totalMembers: 0,
        totalApplications: 0,
        totalAdmins: 0
    });

    const fetchAdminData = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            
            if (!token) {
                setLoading(false);
                return;
            }

            // Fetch admin info
            const adminResponse = await apiFetch('/admin/profile', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (adminResponse.ok) {
                const adminData = await adminResponse.json();
                setAdminInfo(adminData.data);
                
                // Update localStorage with fresh data
                if (adminData.data) {
                    localStorage.setItem('userName', adminData.data.fullName);
                    localStorage.setItem('userEmail', adminData.data.email);
                }
            }

            // Fetch stats
            const statsResponse = await apiFetch(dashboardPathForRole(), {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (statsResponse.ok) {
                const statsData = await statsResponse.json();
                /**
                 * `/admin/super/overview` nests its figures under `data.stats`.
                 * Reading `data.total` off the root found nothing and `|| 0`
                 * turned every miss into a confident zero — the same mistake
                 * that made the Hub report an empty platform.
                 */
                const s = statsData.data?.stats || {};
                setStats({
                    totalMembers: s.totalMembers || 0,
                    totalApplications: s.totalApplications || 0,
                    totalAdmins: s.totalAdmins || 0
                });
            }
        } catch (error) {
            console.error('❌ Error fetching admin data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleProfileUpdate = async () => {
        await fetchAdminData();
        setRefreshTrigger(prev => prev + 1);
    };

    // Fetch admin info
    useEffect(() => {
        fetchAdminData();
    }, []);

    return (
        <div className="min-h-screen flex bg-white">
            {/* No overlay here: `AdminSidebar` draws its own inside the drawer,
                at `z-50`. A second one at `z-20` sat BEHIND the rail and in
                front of the page, so a tap meant to dismiss the menu was caught
                by the wrong element. */}
            {/* Sidebar - Responsive */}
            <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} refreshTrigger={refreshTrigger} />

            {/* Main Content */}
            {/*
                  * `min-w-0` — WITHOUT IT THIS COLUMN CANNOT SHRINK.
                  *
                  * A flex item's `min-width` defaults to `auto`, which refuses to
                  * go below the intrinsic minimum width of its own content. So
                  * one wide child — a table, an unbreakable email address, a grid
                  * that does not collapse — pushes this column past the viewport,
                  * and because the column is the whole page, the PAGE grows with
                  * it. Chrome then widens the layout viewport to match and every
                  * card sits a few pixels off the right edge of the screen with
                  * nothing to scroll them back.
                  *
                  * That is what put the blue "Total members" card half off a
                  * 360px screen. `min-w-0` lets the column be the width it is
                  * given, and the wide child clips or scrolls inside it instead.
                  * The same fix `AdminSidebar` needed on the vertical axis.
                  */}
            <div className="flex-1 min-w-0 flex flex-col">
                {/* Mobile Header - Only visible on mobile */}
                {/* `lg:hidden`, matching the breakpoint the rail appears at.
                    At `md` this bar disappeared while the rail was still hidden,
                    so between 768px and 1023px there was no way to open the
                    navigation at all. */}
                {/*
                  * `AdminPageHeader` — the title bar this screen did not have.
                  *
                  * It opened with a bare back arrow and no heading, so the one
                  * screen that says who you are signed in as never said what it
                  * was. The avatar stays reachable: the profile card below is
                  * the thing that opens the editor, and a second entry point in
                  * the header was two controls doing one job.
                  */}
                <AdminPageHeader
                    title="Settings"
                    subtitle="Your account, the platform's figures, and everything that has been done on it."
                    onMenu={() => setSidebarOpen(true)}
                />

                {/* ONE pane on the shared token, not three hand-padded
                    blocks. `ADMIN_PAGE` carries the padding, the 24px rhythm
                    and the centred 90rem column; the back arrow that used to
                    sit here belongs to the header above now. */}
                <div className={`flex-1 overflow-y-auto ${ADMIN_PAGE}`}>
                        <div className="bg-white border border-slate-200 rounded-2xl shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)] p-6">
                            {/* Header Section */}
                            <div className="mb-8">
                                <div className="flex flex-col md:flex-row items-center md:items-start gap-4 text-center md:text-left">
                                    <Avatar className="w-20 h-20 ring-4 ring-blue-100 cursor-pointer hover:ring-6 hover:ring-blue-200 transition-all" onClick={() => setProfileModalOpen(true)}>
                                        {adminInfo?.avatarUrl && <AvatarImage src={adminInfo.avatarUrl} className="object-cover" />}
                                        <AvatarFallback className="bg-blue-600 text-white font-bold text-[1.75rem]">
                                            {avatarInitials}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <h1 className="text-[1.75rem] md:text-[2.125rem] font-bold text-slate-900">{userName}</h1>
                                        <p className="text-slate-500 text-[1.25rem] md:text-[1.375rem] flex items-center gap-2 justify-center md:justify-start mt-1">
                                            <Shield className="w-5 h-5" />
                                            {roleLabel}
                                        </p>
                                        <div className="flex flex-col sm:flex-row items-center gap-3 mt-3">
                                            <div className="flex items-center gap-2 text-slate-500">
                                                <Mail className="w-4 h-4" />
                                                <span className="text-[1.25rem]">{userEmail}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-500">
                                                <MapPin className="w-4 h-4" />
                                                <span className="text-[1.25rem]">{adminLocation}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 mt-4 justify-center md:justify-start">
                                            <span className="font-medium text-slate-700">Status:</span>
                                            <Badge className={activeStatus ? "bg-green-500 hover:bg-green-600" : "bg-slate-500 hover:bg-slate-600"}>
                                                {activeStatus ? "Active" : "Inactive"}
                                            </Badge>
                                            <Switch
                                                checked={activeStatus}
                                                onCheckedChange={setActiveStatus}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Statistics Grid */}
                            <div>
                                <h2 className={`${CARD_TITLE} text-slate-900 mb-4`}>Platform</h2>
                                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                                    <div className="bg-blue-600 rounded-2xl p-6 shadow-[0_10px_28px_-6px_rgba(37,99,235,0.55)]">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Users className="w-5 h-5 text-blue-100" />
                                            <p className="text-blue-100 text-[1.25rem] font-medium">Total members</p>
                                        </div>
                                        <p className="text-[2.5625rem] font-bold tracking-tight tabular-nums text-white">{stats.totalMembers}</p>
                                    </div>
                                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)]">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Clock className="w-5 h-5 text-amber-500" />
                                            <p className="text-slate-500 text-[1.25rem] font-medium">Applications</p>
                                        </div>
                                        <p className="text-[2.5625rem] font-bold tracking-tight tabular-nums text-slate-900">{stats.totalApplications}</p>
                                    </div>
                                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)]">
                                        <div className="flex items-center gap-2 mb-2">
                                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                                            <p className="text-slate-500 text-[1.25rem] font-medium">Admin accounts</p>
                                        </div>
                                        <p className="text-[2.5625rem] font-bold tracking-tight tabular-nums text-slate-900">{stats.totalAdmins}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                    {/* MAIN CONTENT - Light Background */}
                    <div className="space-y-6">
                            <h2 className={`${CARD_TITLE} text-slate-900`}>Settings &amp; Preferences</h2>

                            <div className="grid gap-5 md:grid-cols-2">
                                {/* Account Settings Card */}
                                <Card className="border border-slate-200 rounded-2xl shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)] overflow-hidden">
                                    <CardHeader className="border-b border-slate-100 bg-white">
                                        <CardTitle className="text-[1.375rem] font-bold flex items-center gap-2">
                                            <User className="w-5 h-5 text-blue-600" />
                                            Account Settings
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-4 space-y-2">
                                        <button 
                                            onClick={() => setProfileModalOpen(true)}
                                            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 rounded-xl transition-colors duration-200 group border border-transparent hover:border-slate-200"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                                                    <User className="w-5 h-5 text-blue-600" />
                                                </div>
                                                <span className="font-medium text-slate-900">Profile Information</span>
                                            </div>
                                            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                                        </button>
                                    </CardContent>
                                </Card>

                                {/* Support Card */}
                                <Card className="border border-slate-200 rounded-2xl shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)] overflow-hidden">
                                    <CardHeader className="border-b border-slate-100 bg-white">
                                        <CardTitle className="text-[1.375rem] font-bold flex items-center gap-2">
                                            <HelpCircle className="w-5 h-5 text-blue-600" />
                                            Help & Support
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-4 space-y-2">
                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center justify-between p-4 hover:bg-red-50 rounded-xl transition-all duration-200 group border border-transparent hover:border-red-200"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center group-hover:bg-red-200 transition-colors">
                                                    <LogOut className="w-5 h-5 text-red-600" />
                                                </div>
                                                <span className="font-medium text-red-600">Logout</span>
                                            </div>
                                            <ChevronRight className="w-5 h-5 text-red-400 group-hover:text-red-600 transition-colors" />
                                        </button>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                    {/*
                      * The audit log.
                      *
                      * Mobile's SystemScreen carries this beside the profile card.
                      * This page had a "Security & Privacy" button and no record
                      * behind it, which is the wrong way round — the heading
                      * promised oversight and the thing providing it was missing.
                      */}
                    <AuditLog />
                </div>
            </div>

            {/* Profile Edit Modal */}
            <ProfileEditModal 
                open={profileModalOpen}
                onClose={() => setProfileModalOpen(false)}
                adminData={adminInfo}
                onProfileUpdate={handleProfileUpdate}
            />
        </div>
    );
};

export default Settings;
