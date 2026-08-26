import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Menu, CheckCircle, Clock, AlertCircle, FileText, User, Briefcase, DollarSign, ArrowRight, TrendingUp, ShieldCheck, Sparkles } from "lucide-react";
import MemberSidebar from "./MemberSidebar";
import { toast } from "sonner";
import { apiFetch } from "@/services/activApi";
import { useProfile } from "@/contexts/ProfileContext";

/**
 * What a business account gets you, exactly as the mobile card lists it.
 *
 * A constant rather than inline markup because the three rows are identical in
 * shape — repeating the wrapper three times is three chances for one of them to
 * drift out of alignment with the others.
 */
const BUSINESS_BENEFITS = [
    { icon: TrendingUp, title: 'Grow Your Reach', detail: 'Connect with more customers' },
    { icon: ShieldCheck, title: 'Verified & Trusted', detail: 'Build credibility for your business' },
    { icon: Sparkles, title: 'Premium Benefits', detail: 'Unlock exclusive business tools' },
];

const UnpaidDashboard = () => {
    // The same figure the sidebar badge shows, from the one place that computes
    // it — two independent calculations would disagree the moment either moved.
    const { profileCompletion } = useProfile();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [applicationData, setApplicationData] = useState<any>(null);
    const [formsCompleted, setFormsCompleted] = useState({
        personal: false,
        business: false,
        financial: false,
        declaration: false
    });

    // Add a state to track if profile is completed
    const [profileCompleted, setProfileCompleted] = useState(false);

    useEffect(() => {
        loadApplicationData();
    }, []);

    // Check profile completion (dummy logic, replace with real check)
    useEffect(() => {
        // You should replace this with a real API call or logic
        // For now, check localStorage or applicationData for profile completion
        const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
        if (userProfile && userProfile.profileCompleted) {
            setProfileCompleted(true);
        } else {
            setProfileCompleted(false);
        }
    }, [applicationData]);

    const loadApplicationData = async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) {
                navigate("/login");
                return;
            }

            // Load application status
            const appResponse = await apiFetch("/applications/my-applications", {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (appResponse.ok) {
                const appResult = await appResponse.json();
                setApplicationData(appResult.data);
            }

            // Check which forms are completed
            const personalRes = await apiFetch("/members/my-profile", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const businessRes = await apiFetch("/members/business-info", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const financialRes = await apiFetch("/members/financial-info", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const declarationRes = await apiFetch("/members/declaration-info", {
                headers: { "Authorization": `Bearer ${token}` }
            });

            setFormsCompleted({
                personal: personalRes.ok && (await personalRes.json()).data,
                business: businessRes.ok && (await businessRes.json()).data,
                financial: financialRes.ok && (await financialRes.json()).data,
                declaration: declarationRes.ok && (await declarationRes.json()).data
            });

        } catch (error) {
            console.error("Error loading application data:", error);
            toast.error("Failed to load application data");
        } finally {
            setLoading(false);
        }
    };

    const allFormsCompleted = Object.values(formsCompleted).every(completed => completed);
    const allApproved = applicationData?.approvals?.personal === 'approved' && 
                       applicationData?.approvals?.business === 'approved' && 
                       applicationData?.approvals?.declaration === 'approved';

    const handleCompleteFormsClick = () => {
        // Navigate to first incomplete form
        if (!formsCompleted.personal) {
            navigate("/member/forms/personal");
        } else if (!formsCompleted.business) {
            navigate("/member/forms/business");
        } else if (!formsCompleted.financial) {
            navigate("/member/forms/financial");
        } else if (!formsCompleted.declaration) {
            navigate("/member/forms/declaration");
        } else {
            navigate("/member/application-status");
        }
    };

    const handlePaymentClick = () => {
        if (allApproved) {
            navigate("/member/application-status");
        } else {
            toast.info("Please wait for admin approvals before proceeding to payment");
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen bg-gray-50">
                <MemberSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-gray-50">
            <MemberSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="bg-white shadow-sm z-10 shrink-0">
                    <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
                                onClick={() => setSidebarOpen(true)}
                            >
                                <Menu className="h-6 w-6" />
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
                                <p className="text-sm text-gray-600 mt-1">Complete your profile to unlock all features</p>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                {/*
                    Padded and centred, on the same gutter as the header.

                    This was `flex items-start justify-start` around a
                    `max-w-4xl … mt-12 ml-12` block: the content was pinned hard
                    to the left behind a 48px margin that matched nothing else on
                    the page — the header beside it uses `px-4 sm:px-6 lg:px-8` —
                    and capped narrow enough to leave a third of a desktop screen
                    empty to its right. `max-w-7xl mx-auto` is what the paid
                    dashboard uses, so the two now line up with each other.
                */}
                <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8">
                    <div className="w-full max-w-7xl mx-auto space-y-6">
                        {/* Show only profile and business cards if profile not completed */}
                        {!profileCompleted && (
                            /*
                                Side by side on a wide screen, and the same
                                height as each other.

                                They were two stacked blocks in a narrow column,
                                so one ran considerably taller than the other and
                                the eye read them as unrelated. `items-stretch`
                                plus `h-full` on each Card makes the pair match
                                whichever content is longer.
                            */
                            <div className="grid gap-6 xl:grid-cols-2 items-stretch">
                                {/*
                                  * Card 1 — Complete Your Profile.
                                  *
                                  * Ported from the mobile `DashboardScreen`, which shows a
                                  * live completion percentage and a filling bar. This card
                                  * previously showed the same heading with no figure at
                                  * all, so a member had no way to tell whether they were
                                  * nearly done or had barely started.
                                  *
                                  * The artwork is the same PNG the app ships, copied into
                                  * `public/` rather than re-drawn, so the two stay
                                  * identical when either is changed.
                                  */}
                                <Card className="bg-blue-600 text-white shadow-xl overflow-hidden h-full">
                                    <CardContent className="p-8 lg:p-10 h-full flex items-center justify-between gap-6">
                                        <div className="flex-1 min-w-0">
                                            <h2 className="text-3xl font-bold mb-4 leading-tight">
                                                Complete Your<br />Profile
                                            </h2>

                                            <p className="text-lg mb-3">
                                                You're{' '}
                                                <span className="font-bold text-2xl text-yellow-300">
                                                    {profileCompletion}%
                                                </span>{' '}
                                                there!
                                            </p>

                                            <div className="flex items-center gap-3 mb-5 max-w-sm">
                                                <div className="flex-1 h-2.5 bg-white/25 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-white rounded-full transition-all duration-500"
                                                        style={{ width: `${profileCompletion}%` }}
                                                    />
                                                </div>
                                                <span className="text-sm font-bold shrink-0">{profileCompletion}%</span>
                                            </div>

                                            <p className="text-white/80 mb-6 text-base">
                                                Unlock all features by completing your profile.
                                            </p>

                                            <Button
                                                onClick={() => navigate('/member/profile')}
                                                className="bg-white text-blue-600 hover:bg-blue-50 font-semibold text-lg px-8 py-3"
                                            >
                                                Complete Profile
                                            </Button>
                                        </div>

                                        <img
                                            src="/clipboard_3d.png"
                                            alt=""
                                            className="hidden md:block w-40 lg:w-48 shrink-0 object-contain drop-shadow-2xl"
                                        />
                                    </CardContent>
                                </Card>

                                {/*
                                  * Card 2 — Your Business Account.
                                  *
                                  * The three benefits below are the ones the mobile card
                                  * lists. They were the whole argument for creating a
                                  * business account and appeared nowhere on this page, so
                                  * the button asked members to do something without saying
                                  * what it gets them.
                                  */}
                                {/* Blue, not purple — the site has one accent. */}
                                <Card className="bg-blue-700 text-white shadow-xl overflow-hidden h-full">
                                    <CardContent className="p-8 lg:p-10 h-full flex items-start justify-between gap-6">
                                        <div className="flex-1 min-w-0">
                                            <h2 className="text-3xl font-bold mb-2">Your Business Account</h2>
                                            <p className="text-white/80 mb-6 text-base">
                                                View and manage your business profile and settings
                                            </p>

                                            <div className="space-y-4 mb-7">
                                                {BUSINESS_BENEFITS.map(({ icon: Icon, title, detail }) => (
                                                    <div key={title} className="flex items-start gap-3">
                                                        <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center
                                                                        justify-center shrink-0">
                                                            <Icon className="h-4 w-4" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-semibold text-base leading-tight">{title}</p>
                                                            <p className="text-white/75 text-sm">{detail}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <Button
                                                onClick={() => navigate('/business/create-profile')}
                                                className="bg-white text-blue-700 hover:bg-blue-50 font-semibold text-lg px-8 py-3"
                                            >
                                                Create Account
                                            </Button>
                                        </div>

                                        <img
                                            src="/briefcase_3d.png"
                                            alt=""
                                            className="hidden md:block w-40 lg:w-48 shrink-0 object-contain drop-shadow-2xl"
                                        />
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* Show application forms only if profile is completed */}
                        {profileCompleted && (
                            <>
                                {/* Application Progress Card */}
                                <Card className="bg-gradient-to-br from-blue-600 to-blue-800 text-white">
                                    <CardContent className="p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <h2 className="text-2xl font-bold">Your Application Progress</h2>
                                            <div className="bg-white/20 px-4 py-2 rounded-full">
                                                <span className="font-semibold">
                                                    {Object.values(formsCompleted).filter(Boolean).length} / 4 Forms
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-blue-100 mb-4">
                                            Complete all forms and get admin approval to proceed with payment
                                        </p>
                                        <div className="w-full bg-white/20 rounded-full h-3">
                                            <div 
                                                className="bg-white rounded-full h-3 transition-all duration-500"
                                                style={{ width: `${(Object.values(formsCompleted).filter(Boolean).length / 4) * 100}%` }}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>

                                {/*
                                  * The three destinations the mobile unpaid
                                  * dashboard reaches that this one did not.
                                  *
                                  * `DashboardScreen.tsx` navigates to
                                  * ApplicationStatus, BusinessDashboard and
                                  * PersonalDetailsForm; the website offered only
                                  * Complete Profile and Create Account, so an
                                  * unpaid member here could not check where their
                                  * application had got to without knowing the URL.
                                  */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <Card
                                        className="cursor-pointer hover:shadow-lg transition-shadow"
                                        onClick={() => navigate('/member/application-status')}
                                    >
                                        <CardContent className="p-5 text-center">
                                            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center
                                                            justify-center mx-auto mb-3 text-blue-600 text-xl">
                                                &#9202;
                                            </div>
                                            <h4 className="font-semibold text-gray-900">Application Status</h4>
                                            <p className="text-xs text-gray-500 mt-1">Where your review has got to</p>
                                        </CardContent>
                                    </Card>

                                    <Card
                                        className="cursor-pointer hover:shadow-lg transition-shadow"
                                        onClick={() => navigate('/member/forms/personal')}
                                    >
                                        <CardContent className="p-5 text-center">
                                            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center
                                                            justify-center mx-auto mb-3 text-emerald-600 text-xl">
                                                &#9997;
                                            </div>
                                            <h4 className="font-semibold text-gray-900">Personal Details</h4>
                                            <p className="text-xs text-gray-500 mt-1">Review or edit your details</p>
                                        </CardContent>
                                    </Card>

                                    <Card
                                        className="cursor-pointer hover:shadow-lg transition-shadow"
                                        onClick={() => navigate('/business/dashboard')}
                                    >
                                        <CardContent className="p-5 text-center">
                                            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center
                                                            justify-center mx-auto mb-3 text-blue-700 text-xl">
                                                &#127970;
                                            </div>
                                            <h4 className="font-semibold text-gray-900">Business Account</h4>
                                            <p className="text-xs text-gray-500 mt-1">Manage your business profile</p>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Forms Checklist */}
                                <Card>
                                    <CardContent className="p-6">
                                        <h3 className="text-xl font-bold text-gray-800 mb-4">Application Forms</h3>
                                        <div className="space-y-3">
                                            <FormStatusItem 
                                                icon={<User className="h-5 w-5" />}
                                                title="Personal Information"
                                                completed={formsCompleted.personal}
                                                onClick={() => navigate("/member/personal-form")}
                                            />
                                            <FormStatusItem 
                                                icon={<Briefcase className="h-5 w-5" />}
                                                title="Business Information"
                                                completed={formsCompleted.business}
                                                onClick={() => navigate("/member/business-form")}
                                            />
                                            <FormStatusItem 
                                                icon={<DollarSign className="h-5 w-5" />}
                                                title="Financial Information"
                                                completed={formsCompleted.financial}
                                                onClick={() => navigate("/member/financial-form")}
                                            />
                                            <FormStatusItem 
                                                icon={<FileText className="h-5 w-5" />}
                                                title="Declaration"
                                                completed={formsCompleted.declaration}
                                                onClick={() => navigate("/member/declaration-form")}
                                            />
                                        </div>

                                        {!allFormsCompleted && (
                                            <Button 
                                                onClick={handleCompleteFormsClick}
                                                className="w-full mt-6 bg-blue-600 hover:bg-blue-700"
                                            >
                                                Continue Application
                                                <ArrowRight className="ml-2 h-4 w-4" />
                                            </Button>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Approval Status */}
                                {allFormsCompleted && (
                                    <Card>
                                        <CardContent className="p-6">
                                            <h3 className="text-xl font-bold text-gray-800 mb-4">Approval Status</h3>
                                            <div className="space-y-3">
                                                <ApprovalStatusItem 
                                                    title="Personal Form"
                                                    status={applicationData?.approvals?.personal || 'pending'}
                                                />
                                                <ApprovalStatusItem 
                                                    title="Business Form"
                                                    status={applicationData?.approvals?.business || 'pending'}
                                                />
                                                <ApprovalStatusItem 
                                                    title="Declaration Form"
                                                    status={applicationData?.approvals?.declaration || 'pending'}
                                                />
                                            </div>

                                            {allApproved ? (
                                                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                                                    <div className="flex items-center gap-2 text-green-700 mb-2">
                                                        <CheckCircle className="h-5 w-5" />
                                                        <span className="font-semibold">All Forms Approved!</span>
                                                    </div>
                                                    <p className="text-sm text-green-600 mb-3">
                                                        Congratulations! Your application has been approved. Proceed to payment to activate your membership.
                                                    </p>
                                                    <Button 
                                                        onClick={handlePaymentClick}
                                                        className="w-full bg-green-600 hover:bg-green-700"
                                                    >
                                                        Proceed to Payment
                                                        <ArrowRight className="ml-2 h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                                    <div className="flex items-center gap-2 text-amber-700">
                                                        <Clock className="h-5 w-5" />
                                                        <span className="font-semibold">Awaiting Admin Approval</span>
                                                    </div>
                                                    <p className="text-sm text-amber-600 mt-2">
                                                        Your forms are under review. You'll be notified once approved.
                                                    </p>
                                                </div>
                                            )}

                                            <Button 
                                                onClick={() => navigate("/member/application-status")}
                                                variant="outline"
                                                className="w-full mt-4"
                                            >
                                                View Detailed Status
                                            </Button>
                                        </CardContent>
                                    </Card>
                                )}
                            </>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

const FormStatusItem = ({ icon, title, completed, onClick }: any) => (
    <div 
        onClick={onClick}
        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
    >
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${completed ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`}>
                {icon}
            </div>
            <span className="font-medium text-gray-800">{title}</span>
        </div>
        {completed ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
        ) : (
            <AlertCircle className="h-5 w-5 text-amber-500" />
        )}
    </div>
);

const ApprovalStatusItem = ({ title, status }: any) => (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <span className="font-medium text-gray-700">{title}</span>
        <div className="flex items-center gap-2">
            {status === 'approved' ? (
                <>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-600">Approved</span>
                </>
            ) : status === 'rejected' ? (
                <>
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium text-red-600">Rejected</span>
                </>
            ) : (
                <>
                    <Clock className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-600">Pending</span>
                </>
            )}
        </div>
    </div>
);

export default UnpaidDashboard;
