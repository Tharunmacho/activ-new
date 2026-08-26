import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '@/contexts/ProfileContext';
import { getRecentActivity, type MemberActivity } from '@/services/activApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  User,
  Calendar,
  Headphones,
  Settings,
  ShoppingCart,
  Menu,
  Bell,
  Package,
  Store,
  TrendingUp,
  Send,
  Boxes,
  BarChart3,
  MessageSquare,
  FileCheck
, Search, FileText, Clock} from 'lucide-react';
import { getUserApplication } from '@/services/applicationApi';
import MemberSidebar from '@/pages/member/MemberSidebar';
import { apiFetch, getPaymentStatus } from "@/services/activApi";

export default function MemberDashboard() {
  const { profileCompletion } = useProfile();
  const [activity, setActivity] = useState<MemberActivity[]>([]);

  // The feed is a supporting detail: it loads on its own and its failure is
  // already swallowed by the service, so the rest of the dashboard renders
  // whatever happens to it.
  useEffect(() => {
    let cancelled = false;
    getRecentActivity(6).then((rows) => { if (!cancelled) setActivity(rows); });
    return () => { cancelled = true; };
  }, []);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const token = localStorage.getItem('token');

      // Fetch both application data and user profile data in parallel
      const [app, profileRes] = await Promise.all([
        getUserApplication(),
        apiFetch('/members/my-profile', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      let profilePhoto = '';

      // Get profile photo from API response
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        if (profileData.success && profileData.data?.profilePhoto) {
          let photo = profileData.data.profilePhoto;

          // If it's a base64 string without data URI prefix, add it
          if (photo && !photo.startsWith('data:') && !photo.startsWith('http')) {
            photo = `data:image/png;base64,${photo}`;
          }

          profilePhoto = photo;
          localStorage.setItem('userProfilePhoto', profilePhoto);
        }
      }

      const planType = app.paymentDetails?.planType ||
        (app.memberType === 'business' ? 'Business Membership' : 'Aspirant Plan');

      setUserData({
        name: app.fullName || 'Member',
        email: app.email || 'member@activ.org',
        planType,
        status: await getPaymentStatus() === 'completed' ? 'Active' : 'Pending',
        profilePhoto: profilePhoto
      });
    } catch (error) {
      console.error('Error loading user data:', error);
      setUserData({
        name: 'Member',
        email: 'member@activ.org',
        planType: 'Intermediate Plan',
        status: 'Active',
        profilePhoto: ''
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <MemberSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm z-10">
          <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden p-2 rounded-lg hover:bg-gray-100"
              >
                <Menu className="w-6 h-6" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Member Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
            {/* Welcome Card */}
            <Card className="mb-6 border-0 shadow-lg bg-gradient-to-r from-teal-600 to-teal-700 text-white">
              <CardContent className="p-8">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-16 h-16 border-4 border-white/30">
                      {userData?.profilePhoto ? (
                        <img
                          src={userData.profilePhoto}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <AvatarFallback className="bg-white text-teal-600 text-2xl font-bold">
                          {userData?.name ? userData.name.charAt(0).toUpperCase() : 'M'}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div>
                      <h2 className="text-3xl font-bold mb-1">Welcome back, {userData?.name || 'Member'}!</h2>
                      <p className="text-teal-100">{userData?.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge className="bg-white/20 text-white hover:bg-white/30">{userData?.planType}</Badge>
                    <Badge className="bg-green-500 text-white hover:bg-green-600">✓ {userData?.status}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/*
              * The Business Account entry point.
              *
              * This replaces a banner announcing an "E-commerce Platform" with a
              * STAGE 2 LIVE badge. No such platform exists: this backend has a
              * product catalog and a business directory and nothing resembling a
              * storefront, and the mobile paid dashboard carries no equivalent
              * banner. What it DOES carry is this — one card into the business
              * area, described by what that area actually contains.
              */}
            <Card className="mb-6 border-0 shadow-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <CardContent className="p-8">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold mb-2">Business Dashboard</h3>
                    <p className="text-blue-100 mb-6">
                      Manage catalog, companies, analytics &amp; sales.
                    </p>

                    <div className="flex flex-wrap gap-3">
                      <Button
                        className="bg-white text-blue-700 hover:bg-blue-50 font-semibold"
                        onClick={() => navigate('/business/dashboard')}
                      >
                        <Store className="w-4 h-4 mr-2" />
                        Open Business Dashboard
                      </Button>
                      <Button
                        className="bg-blue-800 text-white hover:bg-blue-900 font-semibold"
                        onClick={() => navigate('/business/products')}
                      >
                        <Package className="w-4 h-4 mr-2" />
                        My Products
                      </Button>
                    </div>
                  </div>

                  <div className="hidden lg:flex gap-4">
                    <div className="w-20 h-20 bg-white/15 rounded-2xl flex items-center justify-center">
                      <Store className="w-9 h-9" />
                    </div>
                    <div className="w-20 h-20 bg-white/15 rounded-2xl flex items-center justify-center">
                      <Package className="w-9 h-9" />
                    </div>
                    <div className="w-20 h-20 bg-white/15 rounded-2xl flex items-center justify-center">
                      <TrendingUp className="w-9 h-9" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/*
              * Official Documents and Recent Activity.
              *
              * Both are on the mobile paid dashboard as placeholders — the
              * certificate buttons opened an `Alert` and the feed mapped over a
              * local array — because there was no endpoint behind either. There
              * is now, so these are the real thing on both counts.
              */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Official Documents</h3>
                  <p className="text-sm text-gray-500 mb-5">
                    Issued against your active membership.
                  </p>

                  <div className="space-y-3">
                    <button
                      onClick={() => navigate('/member/certificate/membership')}
                      className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200
                                 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center
                                      justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">Membership Certificate</p>
                        <p className="text-xs text-gray-500">View, print or save as PDF</p>
                      </div>
                    </button>

                    <button
                      onClick={() => navigate('/member/certificate/tax-exemption')}
                      className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200
                                 hover:border-green-400 hover:bg-green-50 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-lg bg-green-100 text-green-700 flex items-center
                                      justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">Tax Exemption Certificate</p>
                        <p className="text-xs text-gray-500">View, print or save as PDF</p>
                      </div>
                    </button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Recent Activity</h3>
                  <p className="text-sm text-gray-500 mb-5">
                    What has happened on your account.
                  </p>

                  {activity.length === 0 ? (
                    <p className="text-sm text-gray-400 py-6 text-center">
                      Nothing yet. Activity appears here as your application progresses.
                    </p>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {activity.map((row) => (
                        <div key={row.id} className="flex items-start gap-3 py-3">
                          <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center
                                          justify-center shrink-0 mt-0.5">
                            <Clock className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900">{row.description || row.type}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {row.at ? new Date(row.at).toLocaleString() : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="mb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/member/profile-view')}>
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <User className="w-8 h-8 text-blue-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">My Profile</h4>
                    <p className="text-sm text-gray-500">View & edit profile</p>
                    {/* Was a literal "85% Complete" for everyone, regardless of what
                        they had actually filled in. */}
                    <p className="text-xs text-blue-600 mt-2 font-semibold">{profileCompletion}% Complete</p>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/business/discover')}>
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 bg-pink-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <ShoppingCart className="w-8 h-8 text-pink-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">Discover</h4>
                    <p className="text-sm text-gray-500">Browse member businesses</p>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/explore')}>
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <Search className="w-8 h-8 text-purple-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">Explore Members</h4>
                    <p className="text-sm text-gray-500">Browse the member directory</p>
                  </CardContent>
                </Card>


                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/member/settings')}>
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <Settings className="w-8 h-8 text-gray-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">Settings</h4>
                    <p className="text-sm text-gray-500">Account preferences</p>
                    <p className="text-xs text-gray-600 mt-2 font-semibold">Help & Settings</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
