import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Mail, Phone, MapPin, Save, Camera } from "lucide-react";
import MemberSidebar from "./MemberSidebar";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/services/activApi";

const MemberSettings = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    /**
     * Whether this member sees the paid sections.
     *
     * The same localStorage key the sidebar gates its navigation on, so the menu
     * and this page cannot disagree about who the member is.
     */
    const isPaid = (() => {
        try {
            return localStorage.getItem('paymentStatus') === 'completed';
        } catch {
            return false;
        }
    })();
    const [profilePhoto, setProfilePhoto] = useState("");
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    
    const [formData, setFormData] = useState({
        // Personal Information (matches PersonalForm model)
        name: "",
        email: "",
        phoneNumber: "",
        city: "",
        state: "",
        district: "",
        block: "",
        religion: "",
        socialCategory: "",
        
        // Business Information (matches BusinessForm model)
        doingBusiness: "",
        organization: "",
        constitution: "",
        businessTypes: [] as string[],
        businessActivities: "",
        businessYear: "",
        employees: "",
        chamber: "",
        chamberDetails: "",
        govtOrgs: [] as string[],
        
        // Declaration Information (matches DeclarationForm model)
        sisterConcerns: "",
        companyNames: [] as string[],
        declarationAccepted: false,
        
        // Financial Information (matches FinancialForm model)
        pan: "",
        gst: "",
        udyam: "",
        filedITR: "",
        turnoverRange: "",
        govtSchemes: "",
    });

    useEffect(() => {
        loadUserData();
    }, []);

    const loadUserData = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/login');
                return;
            }

            // Parallel fetch all data at once for faster loading
            const [personalRes, businessRes, declarationRes, financialRes] = await Promise.all([
                // Fetched once. The same endpoint was requested twice in this
                // very list, and both results fed the same form.
                apiFetch('/members/my-profile', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                apiFetch('/members/business-info', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                apiFetch('/members/declaration-info', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                apiFetch('/members/financial-info', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            // Process user data
            if (personalRes.ok) {
                const userResult = await personalRes.clone().json();
                if (userResult.success && userResult.data) {
                    setProfilePhoto(userResult.data.profilePhoto || "");
                }
            }

            // Process personal form data
            if (personalRes.ok) {
                const personalResult = await personalRes.json();
                if (personalResult.success && personalResult.data) {
                    const data = personalResult.data;
                    setFormData(prev => ({
                        ...prev,
                        name: data.name || "",
                        email: data.email || "",
                        phoneNumber: data.phoneNumber || "",
                        city: data.city || "",
                        state: data.state || "",
                        district: data.district || "",
                        block: data.block || "",
                        religion: data.religion || "",
                        socialCategory: data.socialCategory || ""
                    }));
                }
            }

            // Process business form data
            if (businessRes.ok) {
                const businessResult = await businessRes.json();
                if (businessResult.success && businessResult.data) {
                    setFormData(prev => ({
                        ...prev,
                        doingBusiness: businessResult.data.doingBusiness || "",
                        organization: businessResult.data.organization || "",
                        constitution: businessResult.data.constitution || "",
                        businessTypes: businessResult.data.businessTypes || [],
                        businessActivities: businessResult.data.businessActivities || "",
                        businessYear: businessResult.data.businessYear || "",
                        employees: businessResult.data.employees || "",
                        chamber: businessResult.data.chamber || "",
                        chamberDetails: businessResult.data.chamberDetails || "",
                        govtOrgs: businessResult.data.govtOrgs || []
                    }));
                }
            }

            // Process declaration form data
            if (declarationRes.ok) {
                const declarationResult = await declarationRes.json();
                if (declarationResult.success && declarationResult.data) {
                    setFormData(prev => ({
                        ...prev,
                        sisterConcerns: declarationResult.data.sisterConcerns || "",
                        companyNames: declarationResult.data.companyNames || [],
                        declarationAccepted: declarationResult.data.declarationAccepted || false
                    }));
                }
            }

            // Process financial form data
            if (financialRes.ok) {
                const financialResult = await financialRes.json();
                if (financialResult.success && financialResult.data) {
                    setFormData(prev => ({
                        ...prev,
                        pan: financialResult.data.pan || "",
                        gst: financialResult.data.gst || "",
                        udyam: financialResult.data.udyam || "",
                        filedITR: financialResult.data.filedITR || "",
                        turnoverRange: financialResult.data.turnoverRange || "",
                        govtSchemes: financialResult.data.govtSchemes || "",
                    }));
                }
            }

        } catch (error) {
            console.error('Error loading user data:', error);
            toast.error('Failed to load settings data');
        } finally {
            setLoading(false);
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image size should be less than 5MB');
            return;
        }

        setIsUploadingPhoto(true);
        try {
            /**
             * Multipart, POST, and the file itself.
             *
             * This previously sent a base64 string as JSON to
             * `PUT /members/profile-photo` — a route that does not exist (the
             * method is POST) against a handler that reads `req.files`. Every
             * upload 404'd, and because the failure was only logged the member
             * saw their photo appear locally and vanish on reload.
             *
             * `photo` is the field name the mobile app uses; the route accepts
             * any field via `upload.any()`, so both clients work unchanged.
             */
            const form = new FormData();
            form.append('photo', file);

            const token = localStorage.getItem('token');
            const response = await apiFetch('/members/profile-photo', {
                method: 'POST',
                // No Content-Type: the browser must set the multipart boundary
                // itself, and naming it here produces a body the server cannot
                // parse.
                headers: { 'Authorization': `Bearer ${token}` },
                body: form,
            });

            if (response.ok) {
                const result = await response.json();
                const url = result?.data?.profilePhoto || result?.data?.url || '';
                if (url) setProfilePhoto(url);
                toast.success('Profile photo updated');
                window.dispatchEvent(new Event('profileDataUpdated'));
            } else {
                // A failed upload must say so. Silently keeping the local
                // preview is what made this look like it worked.
                toast.error('Could not upload the photo. Please try again.');
            }
        } catch (error) {
            console.error('Error uploading photo:', error);
            toast.error('Error uploading photo');
            setIsUploadingPhoto(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('token');

            // Update personal form - POST works, PUT has issues
            const personalResponse = await apiFetch('/members/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    // `fullName`, not `name`. The controller reads
                    // `profileData.fullName`; anything else is dropped without
                    // an error, so the form reported success and changed nothing.
                    fullName: formData.name,
                    email: formData.email,
                    phoneNumber: formData.phoneNumber,
                    city: formData.city,
                    state: formData.state,
                    district: formData.district,
                    block: formData.block,
                    religion: formData.religion,
                    socialCategory: formData.socialCategory
                })
            });

            // Update business form - POST works
            const businessResponse = await apiFetch('/members/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    doingBusiness: formData.doingBusiness,
                    organization: formData.organization,
                    constitution: formData.constitution,
                    businessTypes: formData.businessTypes,
                    businessActivities: formData.businessActivities,
                    businessYear: formData.businessYear,
                    employees: formData.employees,
                    chamber: formData.chamber || undefined, // Send undefined instead of empty string
                    chamberDetails: formData.chamberDetails,
                    govtOrgs: formData.govtOrgs
                })
            });

            // Update declaration form - POST works
            const declarationResponse = await apiFetch('/members/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    sisterConcerns: formData.sisterConcerns,
                    companyNames: formData.companyNames,
                    declarationAccepted: formData.declarationAccepted
                })
            });

            // Update financial form - POST works
            const financialResponse = await apiFetch('/members/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    pan: formData.pan,
                    gst: formData.gst,
                    udyam: formData.udyam,
                    filedITR: formData.filedITR || undefined, // Send undefined instead of empty string
                    turnoverRange: formData.turnoverRange,
                    govtSchemes: formData.govtSchemes || undefined, // Send undefined instead of empty string
                })
            });

            if (personalResponse.ok) {
                // Also update the user profile (fullName) in the User model
                const updateRes = await apiFetch('/members/profile', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        fullName: formData.name,
                        email: formData.email
                    })
                });

                if (updateRes.ok) {
                    toast.success("Profile updated successfully!");
                    // Update localStorage
                    localStorage.setItem('userName', formData.name);
                    localStorage.setItem('userEmail', formData.email);
                    if (formData.organization) {
                        localStorage.setItem('userOrganization', formData.organization);
                    }
                    // Dispatch events to update sidebar immediately
                    window.dispatchEvent(new CustomEvent('userDataUpdated'));
                    window.dispatchEvent(new CustomEvent('profileDataUpdated'));
                    if (formData.organization) {
                        window.dispatchEvent(new CustomEvent('companyUpdated'));
                    }
                    
                    // No need to reload - sidebar will update via events
                    loadUserData();
                } else {
                    toast.success("Profile forms updated!");
                    // Update localStorage even if user profile API fails
                    localStorage.setItem('userName', formData.name);
                    localStorage.setItem('userEmail', formData.email);
                    if (formData.organization) {
                        localStorage.setItem('userOrganization', formData.organization);
                    }
                    window.dispatchEvent(new CustomEvent('userDataUpdated'));
                    window.dispatchEvent(new CustomEvent('profileDataUpdated'));
                    if (formData.organization) {
                        window.dispatchEvent(new CustomEvent('companyUpdated'));
                    }
                    loadUserData();
                }
            } else {
                toast.error("Failed to update profile");
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            toast.error("Error updating profile");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen bg-gray-50">
                <MemberSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading...</p>
                    </div>
                </div>
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
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
                            <p className="text-sm text-gray-600 mt-1">Manage your profile and account preferences</p>
                        </div>
                        <button
                            className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                    </div>
                </header>

                {/* Content */}
                <div className="flex-1 p-4 md:p-6 overflow-auto">
                    <div className="max-w-4xl mx-auto space-y-6">
                        {/* Profile Photo Section */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Profile Photo</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-6">
                                    <div className="relative">
                                        <Avatar className="w-24 h-24">
                                            <AvatarImage src={profilePhoto || undefined} />
                                            <AvatarFallback className="bg-gradient-to-br from-blue-600 to-purple-600 text-white text-2xl font-bold">
                                                {formData.name ? formData.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "U"}
                                            </AvatarFallback>
                                        </Avatar>
                                        {isUploadingPhoto && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full">
                                                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handlePhotoUpload}
                                            className="hidden"
                                            id="photo-upload"
                                        />
                                        <label htmlFor="photo-upload">
                                            <Button
                                                type="button"
                                                onClick={() => document.getElementById('photo-upload')?.click()}
                                                disabled={isUploadingPhoto}
                                                className="cursor-pointer"
                                            >
                                                <Camera className="h-4 w-4 mr-2" />
                                                {isUploadingPhoto ? 'Uploading...' : 'Change Photo'}
                                            </Button>
                                        </label>
                                        <p className="text-xs text-gray-500 mt-2">JPG, PNG or GIF. Max size 5MB.</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Profile Information */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Personal Information</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label className="flex items-center gap-2 mb-2">
                                            <User className="h-4 w-4" />
                                            Full Name
                                        </Label>
                                        <Input
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="Enter your full name"
                                        />
                                    </div>

                                    <div>
                                        <Label className="flex items-center gap-2 mb-2">
                                            <Mail className="h-4 w-4" />
                                            Email
                                        </Label>
                                        <Input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="your.email@example.com"
                                        />
                                    </div>

                                    <div>
                                        <Label className="flex items-center gap-2 mb-2">
                                            <Phone className="h-4 w-4" />
                                            Phone Number
                                        </Label>
                                        <Input
                                            type="tel"
                                            value={formData.phoneNumber}
                                            onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                                            placeholder="+91 98765 43210"
                                        />
                                    </div>

                                    <div>
                                        <Label className="flex items-center gap-2 mb-2">
                                            <MapPin className="h-4 w-4" />
                                            City
                                        </Label>
                                        <Input
                                            value={formData.city}
                                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                            placeholder="Enter city"
                                        />
                                    </div>

                                    <div>
                                        <Label className="mb-2">State</Label>
                                        <Input
                                            value={formData.state}
                                            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                            placeholder="Enter state"
                                        />
                                    </div>

                                    <div>
                                        <Label className="mb-2">District</Label>
                                        <Input
                                            value={formData.district}
                                            onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                                            placeholder="Enter district"
                                        />
                                    </div>

                                    <div>
                                        <Label className="mb-2">Block</Label>
                                        <Input
                                            value={formData.block}
                                            onChange={(e) => setFormData({ ...formData, block: e.target.value })}
                                            placeholder="Enter block"
                                        />
                                    </div>

                                    <div>
                                        <Label className="mb-2">Religion</Label>
                                        <Input
                                            value={formData.religion}
                                            onChange={(e) => setFormData({ ...formData, religion: e.target.value })}
                                            placeholder="Enter religion"
                                        />
                                    </div>

                                    <div>
                                        <Label className="mb-2">Social Category</Label>
                                        <Input
                                            value={formData.socialCategory}
                                            onChange={(e) => setFormData({ ...formData, socialCategory: e.target.value })}
                                            placeholder="Enter social category"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/*
                          * Business, financial and declaration — paid members only.
                          *
                          * Mobile gives an unpaid member `EditProfileScreen`: seven
                          * personal fields and nothing else. These three sections belong
                          * to `PaidSettingsScreen`, which an unpaid member has no route
                          * to. Reaching them here through "Edit Profile" let an unpaid
                          * member edit a business record they cannot yet have, and did it
                          * by walking past the paid-only gate on the sidebar entry.
                          *
                          * Each form also has its own dedicated screen at
                          * `/member/forms/*`, which is where they are filled in during
                          * registration. This is for corrections afterwards.
                          */}
                        {isPaid && (
                        <>
                        {/* Business Information */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Business Information</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label className="mb-2">Doing Business</Label>
                                        <Input
                                            value={formData.doingBusiness}
                                            onChange={(e) => setFormData({ ...formData, doingBusiness: e.target.value })}
                                            placeholder="Yes/No"
                                        />
                                    </div>

                                    <div>
                                        <Label className="mb-2">Organization Name</Label>
                                        <Input
                                            value={formData.organization}
                                            onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                                            placeholder="Enter organization name"
                                        />
                                    </div>

                                    <div>
                                        <Label className="mb-2">Constitution</Label>
                                        <Input
                                            value={formData.constitution}
                                            onChange={(e) => setFormData({ ...formData, constitution: e.target.value })}
                                            placeholder="Enter constitution type"
                                        />
                                    </div>

                                    <div>
                                        <Label className="mb-2">Business Year</Label>
                                        <Input
                                            value={formData.businessYear}
                                            onChange={(e) => setFormData({ ...formData, businessYear: e.target.value })}
                                            placeholder="Enter business year"
                                        />
                                    </div>

                                    <div>
                                        <Label className="mb-2">Number of Employees</Label>
                                        <Input
                                            value={formData.employees}
                                            onChange={(e) => setFormData({ ...formData, employees: e.target.value })}
                                            placeholder="Enter employee count"
                                        />
                                    </div>

                                    <div>
                                        <Label className="mb-2">Chamber Membership</Label>
                                        <Input
                                            value={formData.chamber}
                                            onChange={(e) => setFormData({ ...formData, chamber: e.target.value })}
                                            placeholder="Yes/No"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <Label className="mb-2">Chamber Details</Label>
                                        <Input
                                            value={formData.chamberDetails}
                                            onChange={(e) => setFormData({ ...formData, chamberDetails: e.target.value })}
                                            placeholder="Enter chamber details"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <Label className="mb-2">Business Activities</Label>
                                        <Input
                                            value={formData.businessActivities}
                                            onChange={(e) => setFormData({ ...formData, businessActivities: e.target.value })}
                                            placeholder="Enter business activities"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Financial Information */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Financial & Compliance Information</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label className="mb-2">PAN Number</Label>
                                        <Input
                                            value={formData.pan}
                                            onChange={(e) => setFormData({ ...formData, pan: e.target.value })}
                                            placeholder="Enter PAN number"
                                        />
                                    </div>

                                    <div>
                                        <Label className="mb-2">GST Number</Label>
                                        <Input
                                            value={formData.gst}
                                            onChange={(e) => setFormData({ ...formData, gst: e.target.value })}
                                            placeholder="Enter GST number"
                                        />
                                    </div>

                                    <div>
                                        <Label className="mb-2">Udyam Number</Label>
                                        <Input
                                            value={formData.udyam}
                                            onChange={(e) => setFormData({ ...formData, udyam: e.target.value })}
                                            placeholder="Enter Udyam number"
                                        />
                                    </div>

                                    <div>
                                        <Label className="mb-2">Filed ITR</Label>
                                        <Input
                                            value={formData.filedITR}
                                            onChange={(e) => setFormData({ ...formData, filedITR: e.target.value })}
                                            placeholder="Yes/No"
                                        />
                                    </div>


                                    <div>
                                        <Label className="mb-2">Turnover Range</Label>
                                        <Input
                                            value={formData.turnoverRange}
                                            onChange={(e) => setFormData({ ...formData, turnoverRange: e.target.value })}
                                            placeholder="Enter turnover range"
                                        />
                                    </div>




                                    <div>
                                        <Label className="mb-2">Government Schemes</Label>
                                        <Input
                                            value={formData.govtSchemes}
                                            onChange={(e) => setFormData({ ...formData, govtSchemes: e.target.value })}
                                            placeholder="Yes/No"
                                        />
                                    </div>



                                </div>
                            </CardContent>
                        </Card>

                        {/* Declaration Information */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Declaration Information</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label className="mb-2">Sister Concerns</Label>
                                        <Input
                                            value={formData.sisterConcerns}
                                            onChange={(e) => setFormData({ ...formData, sisterConcerns: e.target.value })}
                                            placeholder="Enter sister concerns"
                                        />
                                    </div>

                                    <div>
                                        <Label className="mb-2">Declaration Accepted</Label>
                                        <Input
                                            value={formData.declarationAccepted ? "Yes" : "No"}
                                            onChange={(e) => setFormData({ ...formData, declarationAccepted: e.target.value.toLowerCase() === "yes" })}
                                            placeholder="Yes/No"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        </>
                        )}
                        {/* Save Button */}
                        <Card>
                            <CardContent className="pt-6">
                                <Button 
                                    onClick={handleSave} 
                                    disabled={saving}
                                    className="w-full md:w-auto bg-blue-600 hover:bg-blue-700"
                                >
                                    <Save className="h-4 w-4 mr-2" />
                                    {saving ? "Saving..." : "Save All Changes"}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MemberSettings;
