import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Menu, Upload, User, Briefcase, FileText, Building2, Edit, Camera } from "lucide-react";
import { toast } from "sonner";
import { getBusinessInfo, getFinancialInfo, getDeclarationInfo } from "@/services/activApi";
import MemberSidebar from "./MemberSidebar";
import { apiFetch } from "@/services/activApi";

const ProfileView = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [profileImage, setProfileImage] = useState<string>("");
    const [personalData, setPersonalData] = useState<any>(null);
    const [businessData, setBusinessData] = useState<any>(null);
    const [financialData, setFinancialData] = useState<any>(null);
    const [declarationData, setDeclarationData] = useState<any>(null);

    /**
     * Whether this member sees the paid profile.
     *
     * Mobile has two profile screens. `ProfileScreen`, for an unpaid member,
     * stops at the fields registration collected — name, email, phone, then
     * state, district, block, city. `PaidProfileScreen` is the one that adds
     * religion and social category. This page stands in for both, so it has to
     * make the same distinction rather than showing everything to everyone.
     *
     * Read from the same localStorage key the sidebar gates its navigation on,
     * so a member cannot see one thing in the menu and another on the page.
     */
    const isPaid = (() => {
        try {
            return localStorage.getItem('paymentStatus') === 'completed';
        } catch {
            return false;
        }
    })();

    useEffect(() => {
        loadProfileData();

        // Listen for profile updates from settings
        const handleProfileUpdate = () => {
            loadProfileData();
        };

        window.addEventListener('profileDataUpdated', handleProfileUpdate);

        return () => {
            window.removeEventListener('profileDataUpdated', handleProfileUpdate);
        };
    }, []);

    const loadProfileData = async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) {
                navigate("/login");
                return;
            }

            setLoading(true);

            // Load Personal Form
            const personalRes = await apiFetch("/members/my-profile", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (personalRes.ok) {
                const result = await personalRes.json();
                if (result.data) {
                    setPersonalData(result.data);
                    if (result.data.profileImage) {
                        setProfileImage(result.data.profileImage);
                    }
                }
            }

            /**
             * The other three forms — for a paid member only.
             *
             * Fetched here rather than always, because an unpaid member is shown
             * none of it: three requests that would be thrown away. Each failure
             * is swallowed on its own, so a member who never filled in the
             * financial form still sees their business details.
             */
            if (isPaid) {
                const [business, financial, declaration] = await Promise.all([
                    getBusinessInfo().catch(() => null),
                    getFinancialInfo().catch(() => null),
                    getDeclarationInfo().catch(() => null),
                ]);
                setBusinessData(business);
                setFinancialData(financial);
                setDeclarationData(declaration);
            }

        } catch (error) {
            console.error("Error loading profile:", error);
            toast.error("Failed to load profile data");
        } finally {
            setLoading(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error("Please upload an image file");
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            toast.error("Image size should be less than 2MB");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result as string;
            setProfileImage(base64String);

            // Save to backend
            try {
                const token = localStorage.getItem("token");
                const response = await apiFetch("/members/profile", {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ profileImage: base64String })
                });

                if (response.ok) {
                    toast.success("Profile image updated successfully");
                } else {
                    toast.error("Failed to update profile image");
                }
            } catch (error) {
                console.error("Error uploading image:", error);
                toast.error("Failed to upload image");
            }
        };
        reader.readAsDataURL(file);
    };

    if (loading) {
        return (
            <div className="flex h-screen bg-gray-50">
                <MemberSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-gray-600">Loading profile...</p>
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
                        <div className="flex items-center gap-4">
                            <button
                                className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
                                onClick={() => setSidebarOpen(true)}
                            >
                                <Menu className="h-6 w-6" />
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>
                                <p className="text-sm text-gray-600 mt-1">View and manage your profile information</p>
                            </div>
                        </div>
                        <Button onClick={() => navigate('/member/settings')} variant="outline">
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Profile
                        </Button>
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                    <div className="max-w-5xl mx-auto space-y-6">
                        {/* Profile Header Card */}
                        <Card className="p-6">
                            <div className="flex flex-col md:flex-row items-center gap-6">
                                <div className="relative">
                                    <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border-4 border-white shadow-lg">
                                        {profileImage ? (
                                            <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <User className="h-16 w-16 text-gray-400" />
                                        )}
                                    </div>
                                    <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700 shadow-lg">
                                        <Camera className="h-4 w-4" />
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            className="hidden"
                                        />
                                    </label>
                                </div>
                                <div className="flex-1 text-center md:text-left">
                                    {/* `name` is not a field this backend returns — it stores `fullName`,
                                        so this always fell through to the literal "User" while the
                                        card below showed the real name two inches lower. */}
                                    <h2 className="text-2xl font-bold text-gray-800">
                                        {personalData?.fullName || personalData?.name || "Member"}
                                    </h2>
                                    <p className="text-gray-600 mt-1">{personalData?.email || ""}</p>
                                    <p className="text-gray-600">{personalData?.phoneNumber || ""}</p>
                                    <div className="flex flex-wrap gap-2 mt-3 justify-center md:justify-start">
                                        {personalData?.district && (
                                            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                                                {personalData.district}
                                            </span>
                                        )}
                                        {personalData?.state && (
                                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                                                {personalData.state}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* Personal Information */}
                        {personalData && (
                            <Card className="p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <User className="h-5 w-5 text-blue-600" />
                                    <h3 className="text-xl font-bold text-gray-800">Personal Information</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* `fullName` is the field the backend stores; `name`
                                        was read here and is never returned, so this showed
                                        blank for every member. */}
                                    <InfoItem label="Full Name" value={personalData.fullName || personalData.name} />
                                    <InfoItem label="Email" value={personalData.email} />
                                    <InfoItem label="Phone Number" value={personalData.phoneNumber} />
                                    {/* Role and Status are the two the mobile Profile screen
                                        shows that this page did not. */}
                                    <InfoItem label="Role" value={personalData.role || 'Member'} />
                                    <InfoItem
                                        label="Membership Status"
                                        value={personalData.membershipStatus || 'pending'}
                                    />
                                    <InfoItem label="State" value={personalData.state} />
                                    <InfoItem label="District" value={personalData.district} />
                                    <InfoItem label="Block" value={personalData.block} />
                                    <InfoItem label="City" value={personalData.city} />
                                    {isPaid && (
                                        <>
                                            <InfoItem label="Religion" value={personalData.religion} />
                                            <InfoItem label="Social Category" value={personalData.socialCategory} />
                                        </>
                                    )}
                                </div>
                            </Card>
                        )}

                        {/*
                          * Business, financial and declaration — paid members only.
                          *
                          * Mobile's `PaidProfileScreen` lists all fifteen of these; this
                          * page showed none, so a member who had filled in four forms
                          * during registration could see the first one back and no more.
                          *
                          * Three cards rather than one long list, because they come from
                          * three separate forms and are corrected separately — and each
                          * only renders when its form has been filled in, so a member who
                          * declared no business is not shown an empty business card.
                          */}
                        {isPaid && businessData && (
                            <Card className="p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <Briefcase className="h-5 w-5 text-blue-600" />
                                    <h3 className="text-xl font-bold text-gray-800">Business Information</h3>
                                </div>
                                {/*
                                  * An aspirant gets one line, not eight blank ones.
                                  *
                                  * `doingBusiness === false` means the member declared
                                  * they run no business, so organisation, constitution
                                  * and the rest were never asked for. Mobile prints a
                                  * single status row here; rendering the full set would
                                  * be eight labels with nothing beside them.
                                  */}
                                {businessData.doingBusiness === false ? (
                                    <div className="grid grid-cols-1 gap-4">
                                        <InfoItem
                                            label="Business Status"
                                            value="Aspirant (Not currently doing business)"
                                        />
                                    </div>
                                ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <InfoItem label="Business Status" value={yesNo(businessData.doingBusiness)} />
                                    <InfoItem label="Organization Name" value={businessData.organizationName} />
                                    <InfoItem label="Constitution Type" value={businessData.constitutionType} />
                                    <InfoItem label="Commencement Year" value={businessData.businessCommencementYear} />
                                    <InfoItem label="Number of Employees" value={businessData.numberOfEmployees} />
                                    <InfoItem label="Business Activities" value={asText(businessData.businessActivities)} />
                                    <InfoItem label="Business Types" value={asText(businessData.businessTypes)} />
                                    <InfoItem label="Govt Organizations" value={asText(businessData.govtOrganizations)} />
                                    <InfoItem label="Other Chamber Member?" value={yesNo(businessData.memberOfOtherChamber)} />
                                    <InfoItem label="Other Chamber Name" value={businessData.otherChamber} />
                                </div>
                                )}
                            </Card>
                        )}

                        {/* Hidden for an aspirant: they were never asked for a PAN or
                            a turnover, so the card would carry two "No" answers and
                            nothing else. Mobile omits it on the same condition. */}
                        {isPaid && financialData && businessData?.doingBusiness !== false && (
                            <Card className="p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <Building2 className="h-5 w-5 text-blue-600" />
                                    <h3 className="text-xl font-bold text-gray-800">Financial &amp; Compliance</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <InfoItem label="PAN Number" value={financialData.panNumber} />
                                    <InfoItem label="GST Number" value={financialData.gstNumber} />
                                    <InfoItem label="UDYAM Number" value={financialData.udyamNumber} />
                                    <InfoItem label="Filed ITR?" value={yesNo(financialData.filedITR)} />
                                    <InfoItem label="Turnover Range" value={financialData.turnoverRange} />
                                    <InfoItem label="Govt Scheme Benefit?" value={yesNo(financialData.govtSchemeBenefit)} />
                                </div>
                            </Card>
                        )}

                        {isPaid && declarationData && (
                            <Card className="p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <FileText className="h-5 w-5 text-blue-600" />
                                    <h3 className="text-xl font-bold text-gray-800">Declaration</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <InfoItem
                                        label="Number of Sister Concerns"
                                        value={declarationData.sisterConcerns}
                                    />
                                    <InfoItem
                                        label="Company Names"
                                        value={asText(declarationData.companyNames)}
                                    />
                                    <InfoItem
                                        label="Declaration Agreed?"
                                        value={yesNo(declarationData.agreeToDeclaration)}
                                    />
                                </div>
                            </Card>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

/**
 * Render a boolean as words.
 *
 * `false` is a real answer — "no, I do not run a business" — and handing it
 * straight to `InfoItem` would hide the row, because that component treats a
 * falsy value as absent. `undefined` still means unanswered and still hides.
 */
const yesNo = (value: unknown): string | undefined => {
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    if (value === undefined || value === null || value === '') return undefined;
    return String(value);
};

/** `businessActivities` is stored as a list; joined so it reads as a sentence. */
const asText = (value: unknown): string | undefined => {
    if (Array.isArray(value)) return value.filter(Boolean).join(', ') || undefined;
    if (value === undefined || value === null || value === '') return undefined;
    return String(value);
};

const InfoItem = ({ label, value }: { label: string; value?: string | number }) => {
    if (!value) return null;
    
    return (
        <div>
            <p className="text-sm font-medium text-gray-600 mb-1">{label}</p>
            <p className="text-gray-800">{value}</p>
        </div>
    );
};

export default ProfileView;
