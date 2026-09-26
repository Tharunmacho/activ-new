import { MenuTile } from '@/components/shared/MenuTile';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, UserPlus, Building2, Package } from "lucide-react";
import { useState, useEffect } from "react";
import MemberSidebar from "@/pages/member/MemberSidebar";
import { toast } from "sonner";
import { apiFetch } from "@/services/activApi";

import { PAGE_TITLE, CARD_TITLE } from '@/components/layout/appTypography';
interface Member {
  userId: string;
  fullName: string;
  email: string;
  profilePicture?: string;
  companies: Array<{
    _id: string;
    businessName: string;
    businessType: string;
    logo?: string;
  }>;
  products: Array<{
    _id: string;
    /** The Product document's field is `name`; `productName` never existed. */
    name: string;
    imageUrl?: string;
    price: number;
    category: string;
  }>;
  productCount: number;
}

const Explore = () => {
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);

  useEffect(() => {
    loadPaidMembers();
  }, []);

  useEffect(() => {
    if (query.trim() === "") {
      setFilteredMembers(members);
    } else {
      const filtered = members.filter(member => 
        member.fullName.toLowerCase().includes(query.toLowerCase()) ||
        member.email.toLowerCase().includes(query.toLowerCase()) ||
        member.companies.some(c => c.businessName.toLowerCase().includes(query.toLowerCase())) ||
        member.products.some(p => (p?.name || '').toLowerCase().includes(query.toLowerCase()))
      );
      setFilteredMembers(filtered);
    }
  }, [query, members]);

  const loadPaidMembers = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await apiFetch('/members?limit=50', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setMembers(result.data);
          setFilteredMembers(result.data);
        }
      } else {
        toast.error('Failed to load members');
      }
    } catch (error) {
      console.error('Error loading members:', error);
      toast.error('Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = (memberName: string) => {
    toast.success(`Connection request sent to ${memberName}!`);
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Sidebar menu for all screen sizes */}
      <MemberSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header with menu button - Only visible on mobile */}
        {/* `lg:hidden` and `lg:block` below, matching the breakpoint
            `MemberSidebar` switches at. At `md` this bar disappeared while the
            rail was still a drawer, so between 768px and 1023px the screen had
            no title and no way to open the navigation. */}
        <div className="lg:hidden flex items-center gap-2 p-4 bg-white border-b">
          <MenuTile onClick={() => setSidebarOpen(true)} />
          <h1 className={`${PAGE_TITLE} flex-1 min-w-0 truncate`}>Explore Members</h1>
        </div>

        {/* Page content */}
        <div className="flex-1 p-3 md:p-6 overflow-auto">
          <div className="w-full max-w-[110rem] mx-auto">
            <h1 className={`${PAGE_TITLE} mb-6 hidden lg:block text-slate-800`}>Explore Members</h1>

            {/* Search Bar */}
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
              <Input
                placeholder="Search members, businesses, or products..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-12 py-6 rounded-2xl border-2 border-slate-200 focus:border-blue-500 shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)]"
              />
            </div>

            {/* Loading State */}
            {loading && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-slate-500">Loading members...</p>
              </div>
            )}

            {/* Members Grid */}
            {!loading && filteredMembers.length === 0 && (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-500">No paid members found</p>
              </div>
            )}

            {!loading && filteredMembers.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMembers.map((member) => (
                  <Card key={member.userId} className="overflow-hidden hover:shadow-2xl transition-all duration-300 rounded-2xl border-0">
                    <CardContent className="p-0">
                      {/* Member Header */}
                      <div className="bg-blue-600 p-6 text-white">
                        <div className="flex items-center gap-4 mb-4">
                          <Avatar className="w-16 h-16 border-4 border-white shadow-lg">
                            <AvatarImage src={member.profilePicture || "/placeholder.svg"} />
                            <AvatarFallback className="bg-white text-blue-600 text-[1.5625rem] font-bold">
                              {member.fullName ? member.fullName.charAt(0).toUpperCase() : 'M'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <h3 className={CARD_TITLE}>{member.fullName || 'Member'}</h3>
                            <p className="text-[1.1875rem] text-blue-100">{member.email || ''}</p>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleConnect(member.fullName)}
                          className="w-full bg-white text-blue-600 hover:bg-blue-50 font-semibold rounded-xl"
                          size="sm"
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          Connect
                        </Button>
                      </div>

                      {/* Companies Section */}
                      {member.companies.length > 0 && (
                        <div className="p-4 bg-slate-50 border-b">
                          <div className="flex items-center gap-2 mb-3">
                            <Building2 className="w-4 h-4 text-slate-500" />
                            <span className="font-semibold text-[1.1875rem] text-slate-700">
                              {member.companies.length} {member.companies.length === 1 ? 'Business' : 'Businesses'}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {member.companies.slice(0, 2).map((company) => (
                              <div key={company._id} className="bg-white p-3 rounded-lg shadow-sm">
                                <p className="font-medium text-[1.1875rem] text-slate-900">{company.businessName}</p>
                                <p className="text-[1.0625rem] text-slate-500">{company.businessType}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Products Grid */}
                      {member.products.length > 0 ? (
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-semibold text-[1.1875rem] text-slate-700">
                              {member.productCount} {member.productCount === 1 ? 'Product' : 'Products'}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {member.products.slice(0, 6).map((product) => (
                              <div key={product._id} className="relative group cursor-pointer">
                                <div className="aspect-square bg-slate-200 rounded-lg overflow-hidden">
                                  {product.imageUrl ? (
                                    <img
                                      src={product.imageUrl}
                                      alt={product.name || 'Product'}
                                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-slate-200">
                                      <Package className="w-8 h-8 text-slate-500" />
                                    </div>
                                  )}
                                </div>
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-70 transition-all duration-300 rounded-lg flex items-center justify-center">
                                  <div className="opacity-0 group-hover:opacity-100 text-white text-center px-2">
                                    <p className="text-[1.0625rem] font-semibold line-clamp-2">{product.name}</p>
                                    <p className="text-[1.0625rem] mt-1">₹{product.price}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 text-center">
                          <p className="text-[1.1875rem] text-slate-500">No products yet</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Explore;