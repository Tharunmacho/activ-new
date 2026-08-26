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
import { apiFetch, dashboardPathForRole } from "@/services/activApi";

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

    const handleLogout = () => {
        // Clear all local storage items related to login
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('memberId');
        localStorage.removeItem('userName');
        localStorage.removeItem('role');
        localStorage.removeItem('isAdminLoggedIn');
        localStorage.removeItem('adminId');
        localStorage.removeItem('sessionStart');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('adminToken');

        // Navigate to main login page
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
        <div className="min-h-screen flex bg-gradient-to-br from-gray-100 to-gray-50">
            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                ></div>
            )}

            {/* Sidebar - Responsive */}
            <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} refreshTrigger={refreshTrigger} />

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                {/* Mobile Header - Only visible on mobile */}
                <div className="md:hidden flex items-center justify-between p-4 bg-white border-b shadow-sm">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <h1 className="text-xl font-bold text-gray-900">Settings</h1>
                    <Avatar className="w-10 h-10 ring-2 ring-blue-100 cursor-pointer hover:ring-4 transition-all" onClick={() => setProfileModalOpen(true)}>
                        {adminInfo?.avatarUrl && <AvatarImage src={adminInfo.avatarUrl} className="object-cover" />}
                        <AvatarFallback className="bg-gradient-to-br from-blue-600 to-purple-600 text-white font-bold">
                            {avatarInitials}
                        </AvatarFallback>
                    </Avatar>
                </div>

                {/* Main scrollable content */}
                <div className="flex-1 flex flex-col overflow-auto">
                    {/* TOP SECTION - White Header with Shadow */}
                    <div className="bg-white p-6 lg:p-10 shadow-lg">
                        <div className="max-w-6xl mx-auto pt-12 lg:pt-0">
                            {/* Header Section */}
                            <div className="mb-8">
                                <div className="flex flex-col md:flex-row items-center md:items-start gap-4 text-center md:text-left">
                                    <Avatar className="w-20 h-20 ring-4 ring-blue-100 cursor-pointer hover:ring-6 hover:ring-blue-200 transition-all" onClick={() => setProfileModalOpen(true)}>
                                        {adminInfo?.avatarUrl && <AvatarImage src={adminInfo.avatarUrl} className="object-cover" />}
                                        <AvatarFallback className="bg-gradient-to-br from-blue-600 to-purple-600 text-white font-bold text-2xl">
                                            {avatarInitials}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{userName}</h1>
                                        <p className="text-gray-600 text-base md:text-lg flex items-center gap-2 justify-center md:justify-start mt-1">
                                            <Shield className="w-5 h-5" />
                                            {roleLabel}
                                        </p>
                                        <div className="flex flex-col sm:flex-row items-center gap-3 mt-3">
                                            <div className="flex items-center gap-2 text-gray-600">
                                                <Mail className="w-4 h-4" />
                                                <span className="text-sm">{userEmail}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-gray-600">
                                                <MapPin className="w-4 h-4" />
                                                <span className="text-sm">{adminLocation}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 mt-4 justify-center md:justify-start">
                                            <span className="font-medium text-gray-700">Status:</span>
                                            <Badge className={activeStatus ? "bg-green-500 hover:bg-green-600" : "bg-gray-500 hover:bg-gray-600"}>
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
                                <h2 className="text-xl font-semibold mb-4 text-gray-900">Platform</h2>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 border border-blue-500 shadow-xl hover:shadow-2xl transition-all duration-300">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Users className="w-5 h-5 text-blue-100" />
                                            <p className="text-blue-100 text-sm font-medium">Total members</p>
                                        </div>
                                        <p className="text-4xl font-bold text-white">{stats.totalMembers}</p>
                                    </div>
                                    <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl p-6 border border-purple-500 shadow-xl hover:shadow-2xl transition-all duration-300">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Clock className="w-5 h-5 text-purple-100" />
                                            <p className="text-purple-100 text-sm font-medium">Applications</p>
                                        </div>
                                        <p className="text-4xl font-bold text-white">{stats.totalApplications}</p>
                                    </div>
                                    <div className="bg-gradient-to-br from-cyan-600 to-cyan-700 rounded-2xl p-6 border border-cyan-500 shadow-xl hover:shadow-2xl transition-all duration-300">
                                        <div className="flex items-center gap-2 mb-2">
                                            <CheckCircle className="w-5 h-5 text-cyan-100" />
                                            <p className="text-cyan-100 text-sm font-medium">Admin accounts</p>
                                        </div>
                                        <p className="text-4xl font-bold text-white">{stats.totalAdmins}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* MAIN CONTENT - Light Background */}
                    <div className="bg-gradient-to-br from-gray-50 to-white p-6 lg:p-10">
                        <div className="max-w-6xl mx-auto space-y-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">Settings & Preferences</h2>

                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Account Settings Card */}
                                <Card className="shadow-xl border-0 hover:shadow-2xl transition-shadow duration-300">
                                    <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                                            <User className="w-5 h-5 text-blue-600" />
                                            Account Settings
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-4 space-y-2">
                                        <button 
                                            onClick={() => setProfileModalOpen(true)}
                                            className="w-full flex items-center justify-between p-4 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 rounded-xl transition-all duration-200 group border border-transparent hover:border-blue-200"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                                                    <User className="w-5 h-5 text-blue-600" />
                                                </div>
                                                <span className="font-medium text-gray-900">Profile Information</span>
                                            </div>
                                            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                                        </button>
                                    </CardContent>
                                </Card>

                                {/* Support Card */}
                                <Card className="shadow-xl border-0 hover:shadow-2xl transition-shadow duration-300">
                                    <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                                        <CardTitle className="text-lg font-bold flex items-center gap-2">
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
                    </div>

                    {/*
                      * The audit log.
                      *
                      * Mobile's SystemScreen carries this beside the profile card.
                      * This page had a "Security & Privacy" button and no record
                      * behind it, which is the wrong way round — the heading
                      * promised oversight and the thing providing it was missing.
                      */}
                    <div className="mt-6">
                        <AuditLog />
                    </div>
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
