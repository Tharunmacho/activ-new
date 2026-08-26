import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Filter, Users, Mail, Phone, MapPin, CheckCircle, XCircle, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useState, useEffect, useMemo } from "react";
import AdminSidebar from "./AdminSidebar";
import { toast } from "sonner";
import ProfileViewModal from "@/components/ui/profile-view-modal";
import AdminMemberList from "@/features/admin/components/AdminMemberList";
import { apiFetch, dashboardPathForRole, getApplicationProfile, errorMessage, getAdminDashboard } from "@/services/activApi";

// Deterministically assign active/inactive based on member index
const isInactiveMember = (index: number) => index % 4 === 3;

const Members = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  // Fetch applications data to show all requests (pending, approved, rejected)
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        
        if (!token) {
          toast.error('Please login again');
          return;
        }

        const dashboard = await getAdminDashboard();
        if (dashboard.scopeUnresolved) {
          throw new Error(dashboard.message || 'Scope unresolved');
        }

        const approvedApplicants = dashboard.applicants?.approved || [];
        
        // Map applications to member format with status
        const mappedMembers = approvedApplicants.map((app: any, originalIndex: number) => {
          const inactive = isInactiveMember(originalIndex);
          const statusLabel = inactive ? 'Inactive' : 'Active';
          const statusColor = inactive ? 'bg-red-500' : 'bg-green-500';
          
          // Extract userId properly
          let userIdValue = app.userId;
          if (typeof app.userId === 'object' && app.userId !== null) {
            userIdValue = app.userId._id || app.userId.id;
          }
          
          return {
            id: app._id || app.applicationId,
            applicationId: app.applicationId || app._id,
            name: app.fullName || 'Unknown',
            email: app.email || app.userId?.email || 'N/A',
            phone: app.phone || app.userId?.phone || 'N/A',
            location: `${app.block || 'N/A'}, ${app.district || 'N/A'}, ${app.state || 'N/A'}`,
            status: statusLabel,
            statusColor: statusColor,
            rawStatus: app.status,
            memberType: app.memberType || 'aspirant',
            role: app.memberType === 'business' ? 'Business' : 'Aspirant',
            joinDate: app.submittedAt ? new Date(app.submittedAt).toLocaleDateString('en-IN') : 'N/A',
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(app.fullName || 'U')}&background=3b82f6&color=fff`,
            userId: userIdValue
          };
        });

        setMembers(mappedMembers);
      } catch (error) {
        console.error('❌ Error fetching members:', error);
        toast.error('Failed to load members');
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, []);

  // Function to fetch and view profile
  const handleViewProfile = async (applicationId: string) => {
    if (!applicationId) {
      toast.error('This member has no application on record');
      return;
    }

    try {
      setProfileLoading(true);
      setProfileModalOpen(true);

      // Flattens the application's four `data.*` sections into one profile.
      // The previous version read `personalForm` / `businessForm` / ... which
      // this backend does not return, so the modal opened blank on a request
      // that had actually succeeded.
      const profile = await getApplicationProfile(applicationId);

      if (!profile) {
        toast.error('Application not found');
        setSelectedProfile(null);
        setProfileModalOpen(false);
        return;
      }

      setSelectedProfile(profile);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to load application data'));
      setProfileModalOpen(false);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleCloseProfile = () => {
    setProfileModalOpen(false);
    setSelectedProfile(null);
  };

  // Filter members by status tabs
  const buckets = useMemo(() => {
    const active: any[] = [];
    const inactive: any[] = [];
    const all: any[] = [...members];

    members.forEach(member => {
      if (member.status === 'Inactive') {
        inactive.push(member);
      } else {
        active.push(member);
      }
    });

    return { all, active, inactive };
  }, [members]);

  const counts = useMemo(() => ({
    total: members.length,
    active: buckets.active.length,
    inactive: buckets.inactive.length,
  }), [members.length, buckets.active.length, buckets.inactive.length]);

  const currentMembers = buckets[tab] || [];
  
  const filteredMembers = currentMembers.filter(member =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-gray-50 to-white">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar - Responsive */}
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
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
          <h1 className="text-xl font-bold text-gray-900">Members</h1>
          <Avatar className="w-10 h-10 ring-2 ring-blue-100">
            <AvatarImage src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=96&h=96&fit=crop&crop=face" className="object-cover" />
            <AvatarFallback className="bg-gradient-to-br from-blue-600 to-purple-600 text-white font-bold">
              {(localStorage.getItem('userName') || 'A').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>

        <div className="flex-1 p-4 md:p-6 overflow-auto">
          <div className="w-full max-w-6xl mx-auto space-y-6 pt-12 lg:pt-0">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 shadow-xl p-6 rounded-2xl border border-blue-500">
              <h1 className="text-3xl font-bold text-white">Members</h1>
              <p className="text-blue-100 mt-1">Manage and view all registered members</p>
            </div>

            {/* Search Bar */}
            <Card className="shadow-lg border-0">
              <CardContent className="pt-6">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input
                      placeholder="Search members by name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button variant="outline" size="icon">
                    <Filter className="w-5 h-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Tabs for filtering */}
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-auto p-1">
                <TabsTrigger value="all" className="flex items-center gap-2 py-3">
                  <Users className="w-4 h-4" />
                  All ({counts.total})
                </TabsTrigger>
                <TabsTrigger value="active" className="flex items-center gap-2 py-3">
                  <CheckCircle className="w-4 h-4" />
                  Active ({counts.active})
                </TabsTrigger>
                <TabsTrigger value="inactive" className="flex items-center gap-2 py-3">
                  <XCircle className="w-4 h-4" />
                  Inactive ({counts.inactive})
                </TabsTrigger>
              </TabsList>

              <TabsContent value={tab} className="mt-6">
            {/* Members Grid */}
            {/*
              One quiet row per member, matching the mobile Members screen.
              This was a three-column grid of blue-gradient cards carrying the
              avatar, member type, a status badge, email, phone, location, a
              join date and a button — white-on-blue, so the name and email were
              the least legible things on it. The row is shared by all three
              tiers now; the markup used to be copied into each.
            */}
            <AdminMemberList
              members={filteredMembers.map((m: any) => ({
                id: String(m.id),
                applicationId: m.applicationId,
                name: m.name,
                email: m.email,
                status: m.status,
              }))}
              loading={loading}
              emptyHint={searchQuery ? "Try adjusting your search" : "There are no members to display yet."}
              onOpen={(m) => handleViewProfile(m.applicationId)}
            />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
      <ProfileViewModal 
        open={profileModalOpen}
        onClose={handleCloseProfile}
        profile={selectedProfile}
        loading={profileLoading}
      />
    </div>
  );
};

export default Members;