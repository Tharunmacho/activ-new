import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  FileText, Users, CheckCircle, XCircle,
  Clock
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AdminSidebar from "./AdminSidebar";
import { getSuperOverview, getAdminProfile, errorMessage } from "@/services/activApi";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminInfo, setAdminInfo] = useState<any>(null);

  /**
   * Real platform figures, not placeholders.
   *
   * What stood here was three invented applicants — "John Doe", "Jane Smith",
   * "Robert Brown", with stock photos — and a stats block hardcoded to zero.
   * On screen that is indistinguishable from real data, which makes it worse
   * than an empty state: a Super Admin could read those names and believe them.
   */
  const [recentApplications, setRecentApplications] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalMembers: 0, pending: 0, approved: 0, rejected: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [overview, profile] = await Promise.all([
          getSuperOverview().catch(() => null),
          getAdminProfile().catch(() => null),
        ]);
        if (cancelled) return;

        if (profile) setAdminInfo(profile);

        if (overview) {
          const s = overview.stats || overview;
          setStats({
            totalMembers: Number(s.totalMembers ?? s.members ?? 0),
            pending: Number(s.pendingApplications ?? s.pending ?? 0),
            approved: Number(s.approvedApplications ?? s.approved ?? 0),
            rejected: Number(s.rejectedApplications ?? s.rejected ?? 0),
          });

          const recent = overview.recentApplications || overview.recent || overview.applications || [];
          setRecentApplications(
            (Array.isArray(recent) ? recent : []).slice(0, 5).map((a: any) => ({
              id: a.id || a.applicationId || a._id || '',
              name: a.fullName || a.email || 'Applicant',
              status: a.stage || a.status || 'pending',
              date: a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : '',
              image: a.profilePhoto || '',
            })),
          );
        }
      } catch (error) {
        if (!cancelled) console.warn('Could not load the super admin overview:', errorMessage(error));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const role = (typeof window !== 'undefined' ? localStorage.getItem('role') : '') || '';
  const userName = (typeof window !== 'undefined' ? localStorage.getItem('userName') : '') || 'Admin';

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
    if (role === 'block_admin') return 'Manage Block Level';
    if (role === 'district_admin') return 'Manage District Level';
    if (role === 'state_admin') return 'Manage State Level';
    if (role === 'super_admin') return 'Manage All Levels';
    return 'Manage your dashboard';
  }, [role]);

  const avatarInitials = useMemo(() => {
    if (role === 'block_admin') return 'BA';
    if (role === 'district_admin') return 'DA';
    if (role === 'state_admin') return 'SA';
    if (role === 'super_admin') return 'SU';
    const parts = (userName || 'A').trim().split(/\s+/);
    return parts.map(p => p[0]).join('').slice(0, 2).toUpperCase();
  }, [role, userName]);

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
          <Avatar className="w-10 h-10 ring-2 ring-blue-100 cursor-pointer hover:ring-4 transition-all" onClick={() => navigate('/super-admin/settings')}>
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
            <div className="max-w-7xl mx-auto pt-12 lg:pt-0">

              {/* Header Section */}
              <div className="mb-8">
                <div className="flex flex-col md:flex-row items-center md:items-start gap-4 text-center md:text-left">
                  <Avatar className="w-16 h-16 ring-4 ring-blue-100">
                    <AvatarImage src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=96&h=96&fit=crop&crop=face" className="object-cover" />
                    <AvatarFallback className="bg-gradient-to-br from-blue-600 to-purple-600 text-white font-bold text-2xl">
                      {avatarInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{dashboardTitle}</h1>
                    <p className="text-gray-600 text-base md:text-lg">{dashboardSubtitle}</p>
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
                <Link to="/admin/applications">
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
                  {recentApplications.map((app) => (
                    <div
                      key={app.id}
                      className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-all duration-200 shadow-sm border border-blue-100"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10 ring-2 ring-blue-200">
                          <AvatarImage src={app.image} className="object-cover" />
                          <AvatarFallback className="bg-gradient-to-br from-blue-600 to-purple-600 text-white font-bold text-sm">
                            {app.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{app.name}</p>
                          <p className="text-xs text-gray-600">{app.id}</p>
                        </div>
                      </div>
                      <div>
                        <Badge
                          variant={app.status === "approved" ? "default" : "outline"}
                          className={
                            app.status === "approved"
                              ? "bg-green-500 text-white hover:bg-green-600 border-0 shadow-md"
                              : "bg-orange-500 text-white border-0 shadow-md"
                          }
                        >
                          {app.status === "approved" ? "Approved" : "Pending"}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-700 font-medium">{app.size}</div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700 font-medium">{app.date}</span>
                        <Link to={`/admin/application/${app.id}`}>
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
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
