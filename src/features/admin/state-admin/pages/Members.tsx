import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
// One import, not two. A duplicated line declared every one of these names
// twice, which is a hard TypeScript error — it went unnoticed because the root
// `tsconfig.json` sets `"files": []` and only lists project references, so a
// plain `tsc --noEmit` type-checks nothing at all. Use `tsc -b` or
// `tsc --noEmit -p tsconfig.app.json`.
import { Search, Filter, Users, Mail, Phone, MapPin, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useMemo } from "react";
import AdminSidebar from "./AdminSidebar";
import { toast } from "sonner";
import ProfileViewModal from "@/components/ui/profile-view-modal";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch, dashboardPathForRole, getApplicationProfile, errorMessage, getAdminDashboard } from "@/services/activApi";

// Deterministically assign active/inactive based on member index
const isInactiveMember = (index: number) => index % 4 === 3;

const Members = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const filteredMembers = useMemo(() => {
    const source = buckets[tab] || [];
    return source.filter(member =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [buckets, tab, searchQuery]);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      setLoading(true);
      
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Please login again');
        setLoading(false);
        return;
      }

      const dashboard = await getAdminDashboard();
      if (dashboard.scopeUnresolved) {
        throw new Error(dashboard.message || 'Scope unresolved');
      }

      const approvedApplicants = dashboard.applicants?.approved || [];
      
      const mappedMembers = approvedApplicants.map((app: any, originalIndex: number) => {
        const inactive = isInactiveMember(originalIndex);
        const statusLabel = inactive ? 'Inactive' : 'Active';
        const statusColor = inactive ? 'bg-red-500' : 'bg-green-500';
        
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
    } catch (error: any) {
      console.error('Error loading members:', error);
      toast.error(error.message || 'Failed to load members');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewProfile = async (applicationId: string) => {
    if (!applicationId) {
      toast.error('This member has no application on record');
      return;
    }

    try {
      setProfileLoading(true);
      setProfileModalOpen(true);
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

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-gray-50 to-white">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col">
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
          {loading ? (
            <div className="flex-1 flex items-center justify-center min-h-[60vh]">
              <div className="text-center">
                <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
                <p className="text-gray-600">Loading members...</p>
              </div>
            </div>
          ) : (
          <div className="w-full max-w-6xl mx-auto space-y-6 pt-12 lg:pt-0">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 shadow-xl p-6 rounded-2xl border border-blue-500">
              <h1 className="text-3xl font-bold text-white">Members</h1>
              <p className="text-blue-100 mt-1">Manage and view all registered members</p>
            </div>

            <Card className="shadow-lg border-0">
              <CardContent className="pt-6">
                <div className="flex gap-2 mb-6">
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
                </Tabs>
              </CardContent>
            </Card>

            {filteredMembers.length === 0 ? (
              <Card className="shadow-lg border-0">
                <CardContent className="pt-12 pb-12">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                      <Users className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No members found</h3>
                    <p className="text-sm text-gray-600">
                      {searchQuery ? "Try adjusting your search" : "There are no members to display yet."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredMembers.map((member) => (
                  <div
                    key={member.id}
                    className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 border border-blue-500 shadow-xl hover:shadow-2xl transition-all duration-300"
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <Avatar className="w-16 h-16 ring-4 ring-white/30">
                        <AvatarImage src={member.avatar} className="object-cover" />
                        <AvatarFallback className="bg-white/20 text-white font-bold text-lg">
                          {member.name.split(' ').map((n: string) => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-white">{member.name}</h3>
                        <p className="text-blue-100 text-sm truncate">{member.id}</p>
                        <Badge className={`${member.statusColor} text-white hover:opacity-90 mt-2`}>
                          {member.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-blue-100">
                        <Mail className="w-4 h-4" />
                        <span className="text-sm truncate">{member.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-blue-100">
                        <Phone className="w-4 h-4" />
                        <span className="text-sm truncate">{member.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-blue-100">
                        <MapPin className="w-4 h-4" />
                        <span className="text-sm truncate">{member.location}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/20">
                      <div className="flex justify-between items-center">
                        <span className="text-blue-100 text-xs">Joined: {member.joinDate}</span>
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="bg-white text-blue-600 hover:bg-blue-50"
                          onClick={() => handleViewProfile(member.applicationId)}
                        >
                          View Profile
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}
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