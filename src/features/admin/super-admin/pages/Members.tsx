import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Filter, Users, Mail, Phone, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import AdminSidebar from "./AdminSidebar";
import { toast } from "sonner";
import ProfileViewModal from "@/components/ui/profile-view-modal";
import { getApplicationProfile, errorMessage } from "@/services/activApi";

const Members = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  // Dummy member data
  const members = [
    {
      id: "M001",
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "+91 98765 43210",
      location: "Mumbai, Maharashtra",
      status: "Active",
      role: "Member",
      joinDate: "2024-01-15",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=96&h=96&fit=crop&crop=face",
      userId: "user001"
    },
    {
      id: "M002",
      name: "Jane Smith",
      email: "jane.smith@example.com",
      phone: "+91 98765 43211",
      location: "Delhi, NCR",
      status: "Active",
      role: "Member",
      joinDate: "2024-01-14",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&fit=crop&crop=face",
      userId: "user002"
    },
    {
      id: "M003",
      name: "Robert Brown",
      email: "robert.brown@example.com",
      phone: "+91 98765 43212",
      location: "Bangalore, Karnataka",
      status: "Active",
      role: "Member",
      joinDate: "2024-01-13",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=96&h=96&fit=crop&crop=face",
      userId: "user003"
    },
    {
      id: "M004",
      name: "Sarah Johnson",
      email: "sarah.johnson@example.com",
      phone: "+91 98765 43213",
      location: "Pune, Maharashtra",
      status: "Inactive",
      role: "Member",
      joinDate: "2024-01-12",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=96&h=96&fit=crop&crop=face",
      userId: "user004"
    },
    {
      id: "M005",
      name: "Michael Lee",
      email: "michael.lee@example.com",
      phone: "+91 98765 43214",
      location: "Chennai, Tamil Nadu",
      status: "Active",
      role: "Member",
      joinDate: "2024-01-11",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=96&h=96&fit=crop&crop=face",
      userId: "user005"
    },
  ];

  const filteredMembers = members.filter(member =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

            {/* Members Grid */}
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
                          {member.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-white">{member.name}</h3>
                        <p className="text-blue-100 text-sm">{member.id}</p>
                        <Badge className={member.status === 'Active' ? 'bg-green-500 hover:bg-green-600 mt-2' : 'bg-gray-500 hover:bg-gray-600 mt-2'}>
                          {member.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-blue-100">
                        <Mail className="w-4 h-4" />
                        <span className="text-sm">{member.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-blue-100">
                        <Phone className="w-4 h-4" />
                        <span className="text-sm">{member.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-blue-100">
                        <MapPin className="w-4 h-4" />
                        <span className="text-sm">{member.location}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/20">
                      <div className="flex justify-between items-center">
                        <span className="text-blue-100 text-xs">Joined: {member.joinDate}</span>
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="bg-white text-blue-600 hover:bg-blue-50"
                          onClick={() => handleViewProfile(member.userId)}
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