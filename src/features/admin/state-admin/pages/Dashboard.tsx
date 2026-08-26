import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  FileText, Users, CheckCircle, XCircle,
  Clock, Loader2, LogOut
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import AdminSidebar from "./AdminSidebar";
import { getAdminInfo, getStoredAdminData, adminLogout } from "@/services/adminApi";
import { getAdminDashboard } from "@/services/activApi";
import { toast } from "sonner";
import { apiFetch, dashboardPathForRole } from "@/services/activApi";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adminInfo, setAdminInfo] = useState<any>(null);
  const [stats, setStats] = useState({
    totalMembers: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  });
  const [recentApplications, setRecentApplications] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Use stored admin data immediately
      const storedAdmin = getStoredAdminData();
      if (storedAdmin) {
        setAdminInfo(storedAdmin);
      }

      const token = localStorage.getItem('token');
      
      // Fetch all data in parallel for faster loading
      const [adminResponse, dashboard] = await Promise.all([
        getAdminInfo(),
        getAdminDashboard()
      ]);

      // Update admin info
      if (adminResponse.success) {
        const admin = adminResponse.data;
        const enrichedAdmin = {
          ...admin,
          state: admin.meta?.state || admin.state,
          district: admin.meta?.district || admin.district,
          block: admin.meta?.block || admin.block
        };
        setAdminInfo(enrichedAdmin);
        localStorage.setItem('adminData', JSON.stringify(enrichedAdmin));
      }

      // Update dashboard data
      if (dashboard.scopeUnresolved) {
        setStats({ totalMembers: 0, pending: 0, approved: 0, rejected: 0 });
        setRecentApplications([]);
        setApplications([]);
        toast.error(dashboard.message || 'Scope unresolved');
      } else {
        setStats({
          totalMembers: dashboard.stats?.totalMembers || 0,
          pending: dashboard.stats?.pendingApplications || 0,
          approved: dashboard.stats?.approvedApplications || 0,
          rejected: dashboard.stats?.rejectedApplications || 0
        });

        const allApps = dashboard.applicants?.all || [];
        const approvedApps = dashboard.applicants?.approved || [];
        const rejectedApps = dashboard.applicants?.rejected || [];

        const appsWithBuckets = allApps.map((app: any) => {
          let bucket = 'pending';
          if (approvedApps.some((a: any) => a._id === app._id || a.applicationId === app.applicationId)) bucket = 'approved';
          else if (rejectedApps.some((a: any) => a._id === app._id || a.applicationId === app.applicationId)) bucket = 'rejected';
          return { ...app, bucket };
        });

        setRecentApplications(appsWithBuckets.slice(0, 3));
        setApplications(appsWithBuckets);
      }

    } catch (error: any) {
      console.error('Error loading dashboard data:', error);
      // Don't show error toast for missing token on initial load
      if (!error.message?.includes('No admin token')) {
        toast.error(error.message || 'Failed to load dashboard data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    adminLogout();
    toast.success('Logged out successfully');
    navigate('/');
  };

  const role = adminInfo?.role || '';
  const userName = adminInfo?.fullName || 'Admin';

  const roleLabel = useMemo(() => {
    if (role === 'block_admin') return 'Block Admin';
    if (role === 'district_admin') return 'District Admin';
    if (role === 'state_admin') return 'State Admin';
    if (role === 'super_admin') return 'Super Admin';
    return 'Admin';
  }, [role]);

  const dashboardTitle = useMemo(() => {
    if (role === 'block_admin') return 'Block Admin Dashboard';
    if (role === 'district_admin') return 'District Admin Dashboard';
    if (role === 'state_admin') return 'State Admin Dashboard';
    if (role === 'super_admin') return 'Super Admin Dashboard';
    return 'Admin Dashboard';
  }, [role]);

  const dashboardSubtitle = useMemo(() => {
    // For state admin, show only the state
    const state = adminInfo?.state || adminInfo?.meta?.state;
    if (state && state !== 'undefined' && state !== 'null') {
      return state;
    }
    return 'Manage your dashboard';
  }, [adminInfo]);

  const avatarInitials = useMemo(() => {
    const parts = (userName || 'A').trim().split(/\s+/);
    return parts.map(p => p[0]).join('').slice(0, 2).toUpperCase();
  }, [userName]);

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
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

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
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <Avatar className="w-10 h-10 ring-2 ring-blue-100 cursor-pointer hover:ring-4 transition-all" onClick={() => navigate('/state-admin/settings')}>
            {adminInfo?.avatarUrl && <AvatarImage src={adminInfo.avatarUrl} className="object-cover" />}
            <AvatarFallback className="bg-gradient-to-br from-blue-600 to-purple-600 text-white font-bold">
              {avatarInitials}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Main scrollable content */}
        <div className="flex-1 flex flex-col overflow-auto">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
                <p className="text-gray-600">Loading dashboard...</p>
              </div>
            </div>
          ) : (
            <>
              {/* TOP SECTION - White Header with Shadow */}
              <div className="bg-white p-6 lg:p-10 shadow-lg">
                <div className="max-w-7xl mx-auto pt-12 lg:pt-0">

                  {/* Header Section */}
                  <div className="mb-8">
                    <div className="flex flex-col md:flex-row items-center md:items-start gap-4 text-center md:text-left">
                      <Avatar className="w-16 h-16 ring-4 ring-blue-100 cursor-pointer hover:ring-6 hover:ring-blue-200 transition-all" onClick={() => navigate('/state-admin/settings')}>
                        {adminInfo?.avatarUrl && <AvatarImage src={adminInfo.avatarUrl} className="object-cover" />}
                        <AvatarFallback className="bg-gradient-to-br from-blue-600 to-purple-600 text-white font-bold text-2xl">
                          {avatarInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{userName}</h1>
                        <p className="text-gray-600 text-base md:text-lg">{roleLabel}</p>
                        <p className="text-sm text-gray-500 mt-1">{dashboardSubtitle}</p>
                      </div>
                    </div>
                  </div>

                  {/* Statistics Section */}
                  <div>
                <h2 className="text-xl font-semibold mb-4 text-gray-900">Overview Statistics</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 border border-blue-500 shadow-xl hover:shadow-2xl transition-all duration-300">
                    <p className="text-blue-100 text-sm mb-1 font-medium">Total Members</p>
                    <p className="text-4xl font-bold text-white">{stats.totalMembers}</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl p-6 border border-purple-500 shadow-xl hover:shadow-2xl transition-all duration-300">
                    <p className="text-purple-100 text-sm mb-1 font-medium">Pending</p>
                    <p className="text-4xl font-bold text-white">{stats.pending}</p>
                  </div>
                  <div className="bg-gradient-to-br from-cyan-600 to-cyan-700 rounded-2xl p-6 border border-cyan-500 shadow-xl hover:shadow-2xl transition-all duration-300">
                    <p className="text-cyan-100 text-sm mb-1 font-medium">Approved</p>
                    <p className="text-4xl font-bold text-white">{stats.approved}</p>
                  </div>
                  <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-6 border border-indigo-500 shadow-xl hover:shadow-2xl transition-all duration-300">
                    <p className="text-indigo-100 text-sm mb-1 font-medium">Rejected</p>
                    <p className="text-4xl font-bold text-white">{stats.rejected}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* MAIN CONTENT - Light Background */}
          <div className="bg-gradient-to-br from-gray-50 to-white p-6 lg:p-10">
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Recent Activity</h2>
                  <p className="text-gray-600 text-sm">Latest application submissions</p>
                </div>
                <Link to="/state-admin/approvals">
                  <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg px-6 shadow-lg">
                    View All
                  </Button>
                </Link>
              </div>

              {/* Applications Table/List */}
              <div className="bg-white rounded-2xl p-6 shadow-2xl border border-gray-100">
                <div className="hidden md:grid grid-cols-4 gap-4 px-4 py-3 text-sm font-semibold text-gray-700 border-b border-gray-200 mb-4">
                  <div>Name</div>
                  <div>Status</div>
                  <div>Size</div>
                  <div>Modified</div>
                </div>

                <div className="space-y-3">
                  {recentApplications.length > 0 ? (
                    recentApplications.map((app) => (
                      <div
                        key={app._id}
                        className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-all duration-200 shadow-sm border border-blue-100"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10 ring-2 ring-blue-200">
                            <AvatarFallback className="bg-gradient-to-br from-blue-600 to-purple-600 text-white font-bold text-sm">
                              {app.fullName ? app.fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase() : 'N/A'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{app.fullName || 'Unknown'}</p>
                            <p className="text-xs text-gray-600">{app.applicationId || app.applicationNumber || 'N/A'}</p>
                          </div>
                        </div>
                        <div>
                          <Badge
                            variant="outline"
                            className={
                              app.bucket === 'approved'
                                ? "bg-green-500 text-white hover:bg-green-600 border-0 shadow-md"
                                : app.bucket === 'rejected'
                                ? "bg-red-500 text-white hover:bg-red-600 border-0 shadow-md"
                                : "bg-yellow-500 text-white border-0 shadow-md"
                            }
                          >
                            {app.bucket === 'approved' ? 'Approved' :
                             app.bucket === 'rejected' ? 'Rejected' : 'Pending'}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-700 font-medium">{app.memberType === 'business' ? 'Business' : 'Aspirant'}</div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700 font-medium">
                            {new Date(app.submittedAt).toLocaleDateString()}
                          </span>
                          <Link to={`/state-admin/approvals`}>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-blue-600 hover:bg-blue-50 font-medium"
                            >
                              View
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                      <p>No applications found</p>
                      <p className="text-sm">Applications from your jurisdiction will appear here</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
