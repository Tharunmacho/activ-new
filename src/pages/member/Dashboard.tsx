import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Menu, User, Briefcase } from "lucide-react";
import { useState, useEffect } from "react";
import MemberSidebar from "./MemberSidebar";
import { useNavigate } from "react-router-dom";
import { useProfile } from "@/contexts/ProfileContext";
import { apiFetch, getPaymentStatus } from "@/services/activApi";

const MemberDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userName, setUserName] = useState(() => localStorage.getItem("userName") || "");
  const [profilePhoto, setProfilePhoto] = useState(() => localStorage.getItem("userProfilePhoto") || "");
  /**
   * The member's company, or nothing.
   *
   * This defaulted to the string "TechCorp Solution" — a company that does not
   * exist, shown under the name of every member who has not registered a
   * business. It is not a placeholder in the harmless sense: it is rendered in
   * the same position, with the same styling, as a real company name, so there
   * is nothing to tell a member that what they are reading is invented. A
   * member with no business account should see no company line at all.
   */
  const [organizationName, setOrganizationName] = useState(() => localStorage.getItem("userOrganization") || "");
  const [isFirstVisit, setIsFirstVisit] = useState(true);
  const [latestApplication, setLatestApplication] = useState<any | null>(null);
  const [hasBusinessAccount, setHasBusinessAccount] = useState(false);
  const navigate = useNavigate();
  const { profileCompletion, formsCompleted, totalFormsRequired, memberType, isFullyCompleted } = useProfile();

  useEffect(() => {
    // Check payment status first - redirect users appropriately
    const checkPaymentStatus = async () => {
      const token = localStorage.getItem("token");
      if (!token) return false;

      try {
        const response = await apiFetch("/applications/my-applications", {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            if (await getPaymentStatus() === 'completed') {
              // User has paid, redirect to paid dashboard
              navigate("/payment/member-dashboard", { replace: true });
              return true;
            }
          }
        } else {
          // No application found - new user, redirect to unpaid dashboard
          navigate("/member/unpaid-dashboard", { replace: true });
          return true;
        }
      } catch (error) {
        console.error("Error checking payment status:", error);
        // If error, redirect to unpaid dashboard for safety
        navigate("/member/unpaid-dashboard", { replace: true });
        return true;
      }
      return false;
    };

    // Fetch user data from backend
    const fetchUserData = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        // Fallback to localStorage if no token
        const storedUserName = localStorage.getItem("userName");
        if (storedUserName) {
          setUserName(storedUserName);
        }
        return;
      }

      try {
        // Parallel fetch for better performance
        const [authRes, companyRes] = await Promise.all([
          apiFetch("/members/my-profile", {
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json"
            }
          }),
          apiFetch("/business-profiles/me", {
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json"
            }
          })
        ]);

        if (authRes.ok) {
          const result = await authRes.json();
          if (result.success && result.data) {
            const fullName = result.data.fullName || "";
            const email = result.data.email || "";
            const photo = result.data.profilePhoto || "";
            
            // Update state and localStorage
            setUserName(fullName);
            localStorage.setItem("userName", fullName);
            localStorage.setItem("userEmail", email);
            localStorage.setItem("userId", result.data.userId || "");
            
            if (photo) {
              setProfilePhoto(photo);
              localStorage.setItem("userProfilePhoto", photo);
            }
          }
        } else {
          // Fallback to localStorage if API fails
          const storedUserName = localStorage.getItem("userName");
          if (storedUserName) {
            setUserName(storedUserName);
          }
        }
        
        // Process company data
        if (companyRes.ok) {
          const companyResult = await companyRes.json();
          const orgName = companyResult?.data?.businessName || "";
          // Cleared as well as set. `/business-profiles/me` answers with a null
          // `data` when the member has no company, and only ever writing on the
          // truthy branch left a deleted company's name on screen — read back
          // from localStorage on every later visit.
          setOrganizationName(orgName);
          if (orgName) localStorage.setItem("userOrganization", orgName);
          else localStorage.removeItem("userOrganization");
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        // Fallback to localStorage
        const storedUserName = localStorage.getItem("userName");
        if (storedUserName) {
          setUserName(storedUserName);
        }
      }
    };

    const checkBusinessAccount = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;

      try {
        const response = await apiFetch("/business-profiles/me", {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setHasBusinessAccount(true);
          }
        }
      } catch (error) {
        console.error("Error checking business account:", error);
      }
    };

    const initDashboard = async () => {
      // Check payment status first
      const isPaid = await checkPaymentStatus();
      if (isPaid) {
        return; // Stop if user is redirected
      }

      // Continue with normal dashboard loading
      await fetchUserData();
      await checkBusinessAccount();

      const hasVisitedBefore = localStorage.getItem("hasVisitedDashboard");
      if (hasVisitedBefore) {
        setIsFirstVisit(false);
      } else {
        // Mark first visit as complete
        localStorage.setItem("hasVisitedDashboard", "true");
      }
    };

    initDashboard();

    // Listen for profile updates
    const handleProfilePhotoUpdate = () => {
      const photo = localStorage.getItem('userProfilePhoto') || '';
      setProfilePhoto(photo);
    };

    const handleUserDataUpdate = () => {
      const name = localStorage.getItem('userName') || '';
      setUserName(name);
    };

    const handleCompanyUpdate = () => {
      setOrganizationName(localStorage.getItem('userOrganization') || '');
    };

    window.addEventListener('profilePhotoUpdated', handleProfilePhotoUpdate);
    window.addEventListener('userDataUpdated', handleUserDataUpdate);
    window.addEventListener('companyUpdated', handleCompanyUpdate);

    return () => {
      window.removeEventListener('profilePhotoUpdated', handleProfilePhotoUpdate);
      window.removeEventListener('userDataUpdated', handleUserDataUpdate);
      window.removeEventListener('companyUpdated', handleCompanyUpdate);
    };
  }, [navigate]);

  // Load latest application from backend (fallback to localStorage)
  useEffect(() => {
    async function loadApplications() {
      let apps: any[] = [];
      // Get applications from local storage
      try {
        apps = JSON.parse(localStorage.getItem('applications') || '[]');
      } catch (_) {
        apps = [];
      }
      
      if (apps.length) {
        const sorted = [...apps].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
        setLatestApplication(sorted[0]);
      } else {
        setLatestApplication(null);
      }
    }
    loadApplications();
  }, []);

  // Profile completion data comes from ProfileContext - no need to fetch again

  let business: any = {};
  try {
    const businessRaw = localStorage.getItem("userProfileDetails");
    business = businessRaw ? JSON.parse(businessRaw) : {};
  } catch (_) {
    business = {} as any;
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar menu for all screen sizes */}
      <MemberSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Header with menu button - Only visible on mobile */}
        <div className="md:hidden flex items-center justify-between p-4 bg-white border-b">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="p-2"
          >
            <Menu className="h-6 w-6" />
          </Button>
          <h1 className="text-xl font-bold">Dashboard</h1>
          <Avatar className="w-10 h-10">
            {profilePhoto ? (
              <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover rounded-full" />
            ) : (
              <>
                <AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face" className="object-cover" />
                <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-800 text-white font-bold">
                  {userName ? userName.split(" ").map(n => n[0]).join("").toUpperCase() : "SD"}
                </AvatarFallback>
              </>
            )}
          </Avatar>
        </div>

        <div className="flex-1 p-4 md:p-6 overflow-auto bg-white">
          <div className="w-full max-w-6xl mx-auto">
            {/* Welcome section */}
            <div className="mb-6">

              <div className="flex items-center gap-4 mt-4">
                <Avatar className="w-16 h-16 ring-4 ring-blue-100">
                  {profilePhoto ? (
                    <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <>
                      <AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=128&h=128&fit=crop&crop=face" className="object-cover" />
                      <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-800 text-white text-2xl font-bold">
                        {userName ? userName.split(" ").map(n => n[0]).join("").toUpperCase() : "SD"}
                      </AvatarFallback>
                    </>
                  )}
                </Avatar>
                <div>
                  <h2 className="text-xl font-bold md:text-2xl text-gray-800">
                    {isFirstVisit ? "Welcome" : "Welcome back"}, {userName || "Member"}
                  </h2>
                  {organizationName && <p className="text-gray-500">{organizationName}</p>}
                </div>
              </div>
            </div>

            {/* Application Status or Profile Completion Card */}
            {isFullyCompleted ? (
              <Card className="shadow-lg border-0 w-full mb-6 bg-green-600 text-white">
                <CardContent className="p-6 md:p-8">
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                    <div className="flex-1">
                      <h3 className="text-2xl md:text-3xl font-bold mb-3">Application Submitted</h3>
                      <p className="text-sm opacity-90 mb-4">
                        Your membership application is currently under review. Track your approval progress.
                      </p>
                      <div className="mt-4">
                        <Button 
                          className="bg-white text-green-600 hover:bg-gray-100 font-semibold px-8 py-2" 
                          onClick={() => navigate('/member/application-status')}
                        >
                          View Status
                        </Button>
                      </div>
                    </div>
                    <div className="w-20 h-20 md:w-24 md:h-24 bg-white rounded-xl flex items-center justify-center shadow-lg">
                      <svg className="w-12 h-12 md:w-16 md:h-16 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-lg border-0 w-full mb-6 bg-blue-600 text-white">
                <CardContent className="p-6 md:p-8">
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                    <div className="flex-1">
                      <h3 className="text-2xl md:text-3xl font-bold mb-3">Complete Your Profile</h3>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="text-4xl font-bold">{profileCompletion}%</div>
                        <span className="text-sm opacity-90">completed</span>
                      </div>
                      <p className="text-sm opacity-90 mb-4">Unlock all features by completing your profile.</p>
                      <div className="mt-4">
                        <Button className="bg-white text-blue-600 hover:bg-gray-100 font-semibold px-8 py-2" onClick={() => navigate('/member/profile')}>
                          Complete Profile
                        </Button>
                      </div>
                    </div>
                    <div className="w-20 h-20 md:w-24 md:h-24 bg-white rounded-xl flex items-center justify-center shadow-lg">
                      <svg className="w-12 h-12 md:w-16 md:h-16 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Your Business Account Card - Professional Purple */}
            <Card className="shadow-lg border-0 w-full mb-4 md:mb-6 bg-blue-700 text-white">
              <CardContent className="p-5 md:p-8">
                <div className="flex flex-row items-center gap-4 md:gap-6">
                  <div className="flex-1">
                    <h3 className="text-xl md:text-2xl lg:text-3xl font-bold mb-2 md:mb-3">Your Business Account</h3>
                    <div className="mb-2 md:mb-3">
                      <span className="inline-block text-xs md:text-sm font-semibold bg-white bg-opacity-20 rounded-full px-3 md:px-4 py-1.5 md:py-2">Pending</span>
                    </div>
                    <p className="text-sm opacity-90 mb-4">View and manage your business profile and settings</p>
                    <div className="mt-4">
                      <Button 
                        className="bg-white text-blue-700 hover:bg-gray-100 font-semibold px-8 py-2" 
                        onClick={() => navigate(hasBusinessAccount ? '/business/dashboard' : '/business/create-profile')}
                      >
                        {hasBusinessAccount ? 'View Account' : 'Create Account'}
                      </Button>
                    </div>
                  </div>
                  <div className="hidden sm:flex w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 bg-white rounded-xl items-center justify-center shadow-lg flex-shrink-0">
                    <Briefcase className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 text-blue-700" />
                  </div>
                </div>
              </CardContent>
            </Card>


            {/* Profile Status Card */}            {/* Membership card and documents after membership */}
            {latestApplication?.payment?.status === 'Completed' && (
              <>
                <Card className="w-full mb-6 border-0 shadow-medium bg-gradient-to-r from-blue-600 to-blue-800 text-white">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-semibold bg-white/20 rounded-full px-2 py-0.5">{(latestApplication.payment.plan || 'annual').toString().toUpperCase()}</span>
                          <span className="text-xs font-semibold bg-green-500 rounded-full px-2 py-0.5">Active</span>
                        </div>
                        <div className="text-sm opacity-90">Member since</div>
                        <div className="text-xl font-bold">
                          {latestApplication.payment.paidAt ? new Date(latestApplication.payment.paidAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
                        </div>
                        <div className="text-sm mt-1 opacity-90">Member ID: <span className="font-semibold">{latestApplication.id}</span></div>
                      </div>
                      <div className="hidden md:block w-10 h-10 rounded-full bg-white/30" />
                    </div>
                  </CardContent>
                </Card>

                <div className="mb-3">
                  <h3 className="text-xl font-semibold">Official Documents</h3>
                  <p className="text-sm text-muted-foreground">Access and download essential documents related to your account</p>
                </div>

                <div className="space-y-3 mb-6">
                  <button
                    className="w-full flex items-center justify-between px-4 py-4 rounded-xl bg-green-100 text-green-900"
                    onClick={() => {
                      const blob = new Blob([`Tax Exemption CertificateMember: ${userName || 'Member'}Member ID: ${latestApplication.id}Date: ${new Date().toLocaleDateString()}`], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `Tax-Exemption-${latestApplication.id}.txt`;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <span className="font-medium">Download Tax Exemption Certificate</span>
                    <span>⬇️</span>
                  </button>
                </div>
              </>
            )}

            {/* Quick actions grid - mobile optimized (single set, clickable) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {/* Removed ADF Form, Certificate, Help Center, Events cards */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemberDashboard;


