import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { User, Bell, Shield, Globe, LogOut, Save, Lock, Mail, Phone, MapPin, Check } from "lucide-react";
import BusinessSidebar from "./BusinessSidebar";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const Settings = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("account");
    const [loading, setLoading] = useState(true);
    const [userData, setUserData] = useState<any>(null);
    const [activeCompany, setActiveCompany] = useState<any>(null);
    const [formData, setFormData] = useState({
        businessName: "",
        email: "",
        phone: "",
        location: "",
        description: ""
    });
    const [notifications, setNotifications] = useState({
        email: true,
        push: true,
        sms: false,
        marketing: false,
        updates: true,
    });

    useEffect(() => {
        loadUserData();
    }, []);

    const loadUserData = async () => {
        try {
            const token = localStorage.getItem('token');
            
            // Load active company
            const companyRes = await fetch('http://localhost:4000/api/companies/active', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const companyResult = await companyRes.json();
            
            if (companyResult.success && companyResult.data) {
                const company = companyResult.data;
                setActiveCompany(company);
                setFormData({
                    businessName: company.businessName || "",
                    email: company.email || "",
                    phone: company.mobileNumber || "",
                    location: company.location || "",
                    description: company.businessType || ""
                });
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!activeCompany) {
            toast.error("No active company found");
            return;
        }

        try {
            const token = localStorage.getItem('token');
            
            const updateData = {
                businessName: formData.businessName,
                email: formData.email,
                mobileNumber: formData.phone,
                location: formData.location,
                businessType: formData.description
            };

            const response = await fetch(`http://localhost:4000/api/companies/${activeCompany._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updateData)
            });

            const result = await response.json();
            
            if (result.success) {
                toast.success("Settings saved successfully!");
                loadUserData(); // Reload data
            } else {
                toast.error(result.message || "Failed to save settings");
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error("An error occurred while saving settings");
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate("/");
        toast.success("Logged out successfully");
    };

    const settingsSections = [
        { id: "account", label: "Account", icon: User },
        { id: "notifications", label: "Notifications", icon: Bell },
        { id: "security", label: "Security & Privacy", icon: Shield },
        { id: "preferences", label: "Preferences", icon: Globe },
    ];

    if (loading) {
        return (
            <div className="min-h-screen flex bg-white items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading settings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex bg-gradient-to-br from-gray-50 to-white">
            <BusinessSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="p-5 md:p-6 bg-white border-b border-gray-200 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-1">Settings</h1>
                            <p className="text-gray-600 text-sm md:text-base">Manage your account and application preferences</p>
                        </div>
                        <Button
                            onClick={handleSave}
                            className="h-11 px-6 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-md hover:shadow-lg w-fit"
                        >
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                        </Button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-4 md:p-6 overflow-auto">
                    <div className="max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-6">
                            {/* Left Sidebar - Navigation */}
                            <div className="lg:col-span-3">
                                <div className="bg-white rounded-xl border-0 shadow-lg overflow-hidden lg:sticky lg:top-6">
                                    <div className="p-4 md:p-5">
                                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Settings</h3>
                                        <nav className="space-y-1">
                                            {settingsSections.map((section) => (
                                                <button
                                                    key={section.id}
                                                    onClick={() => setActiveTab(section.id)}
                                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === section.id
                                                        ? 'bg-blue-600 text-white font-semibold shadow-md'
                                                        : 'text-gray-700 hover:bg-gray-100'
                                                        }`}
                                                >
                                                    <section.icon className={`h-5 w-5 ${activeTab === section.id ? 'text-white' : 'text-gray-400'}`} />
                                                    <span className="text-sm">{section.label}</span>
                                                </button>
                                            ))}
                                        </nav>
                                    </div>

                                    <div className="border-t border-gray-200 p-4 md:p-5">
                                        <Button
                                            onClick={handleLogout}
                                            variant="outline"
                                            className="w-full justify-start rounded-lg border-2 border-red-200 text-red-600 hover:bg-red-50 font-semibold h-11"
                                        >
                                            <LogOut className="h-4 w-4 mr-3" />
                                            Logout
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Right Content Area */}
                            <div className="lg:col-span-9 space-y-5">
                                {/* Account Settings */}
                                {activeTab === "account" && (
                                    <div className="space-y-5">
                                        <div className="bg-white rounded-xl border-0 shadow-lg p-5 md:p-6">
                                            <div className="mb-6">
                                                <h2 className="text-lg md:text-xl font-bold text-blue-600">Profile Information</h2>
                                                <p className="text-sm text-gray-500 mt-1">Update your account details and business information</p>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                <div>
                                                    <Label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                                        <User className="h-4 w-4 text-gray-400" />
                                                        Business Name
                                                    </Label>
                                                    <Input
                                                        placeholder="Enter business name"
                                                        value={formData.businessName}
                                                        onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                                                        className="h-11 rounded-lg border-2 border-gray-200 focus:border-blue-500"
                                                    />
                                                </div>

                                                <div>
                                                    <Label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                                        <Mail className="h-4 w-4 text-gray-400" />
                                                        Email Address
                                                    </Label>
                                                    <Input
                                                        type="email"
                                                        placeholder="business@example.com"
                                                        value={formData.email}
                                                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                                                        className="h-11 rounded-lg border-2 border-gray-200 focus:border-blue-500"
                                                    />
                                                </div>

                                                <div>
                                                    <Label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                                        <Phone className="h-4 w-4 text-gray-400" />
                                                        Phone Number
                                                    </Label>
                                                    <Input
                                                        type="tel"
                                                        placeholder="+91 98765 43210"
                                                        value={formData.phone}
                                                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                                        className="h-11 rounded-lg border-2 border-gray-200 focus:border-blue-500"
                                                    />
                                                </div>

                                                <div>
                                                    <Label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                                        <MapPin className="h-4 w-4 text-gray-400" />
                                                        Location
                                                    </Label>
                                                    <Input
                                                        placeholder="City, State"
                                                        value={formData.location}
                                                        onChange={(e) => setFormData({...formData, location: e.target.value})}
                                                        className="h-11 rounded-lg border-2 border-gray-200 focus:border-blue-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-xl border-0 shadow-lg p-5 md:p-6">
                                            <h3 className="text-lg font-bold text-gray-800 mb-4">Business Category</h3>
                                            <Input
                                                placeholder="e.g., Technology, Retail, Food & Beverage"
                                                value={formData.description}
                                                onChange={(e) => setFormData({...formData, description: e.target.value})}
                                                className="h-11 rounded-lg border-2 border-gray-200 focus:border-blue-500"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Notifications */}
                                {activeTab === "notifications" && (
                                    <div className="bg-white rounded-xl border-0 shadow-lg p-5 md:p-6">
                                        <div className="mb-6">
                                            <h2 className="text-lg md:text-xl font-bold text-blue-600">Notification Preferences</h2>
                                            <p className="text-sm text-gray-500 mt-1">Choose how you want to be notified</p>
                                        </div>

                                        <div className="space-y-3">
                                            {[
                                                { key: "email", label: "Email Notifications", description: "Receive important updates and newsletters via email", icon: Mail },
                                                { key: "push", label: "Push Notifications", description: "Get instant alerts on your device for real-time updates", icon: Bell },
                                                { key: "sms", label: "SMS Notifications", description: "Receive critical alerts via text message", icon: Phone },
                                                { key: "marketing", label: "Marketing Communications", description: "Stay informed about new features and promotions", icon: Check },
                                                { key: "updates", label: "Product Updates", description: "Get notified when we add new features", icon: Check },
                                            ].map((item) => (
                                                <div key={item.key} className="flex items-center justify-between p-4 md:p-5 rounded-lg bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-100">
                                                    <div className="flex items-start gap-3 md:gap-4 flex-1">
                                                        <div className="p-2 rounded-lg bg-white shadow-sm">
                                                            <item.icon className="h-5 w-5 text-blue-600" />
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-gray-800 text-sm md:text-base">{item.label}</p>
                                                            <p className="text-xs md:text-sm text-gray-600 mt-1">{item.description}</p>
                                                        </div>
                                                    </div>
                                                    <Switch
                                                        checked={notifications[item.key as keyof typeof notifications]}
                                                        onCheckedChange={(checked) =>
                                                            setNotifications({ ...notifications, [item.key]: checked })
                                                        }
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Security & Privacy */}
                                {activeTab === "security" && (
                                    <div className="space-y-5">
                                        <div className="bg-white rounded-xl border-0 shadow-lg p-5 md:p-6">
                                            <div className="mb-6">
                                                <h2 className="text-lg md:text-xl font-bold text-blue-600">Security Settings</h2>
                                                <p className="text-sm text-gray-500 mt-1">Protect your account and data</p>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <Button
                                                    variant="outline"
                                                    className="h-auto justify-start rounded-lg border-2 border-gray-200 hover:bg-blue-50 hover:border-blue-300 p-5"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="p-3 rounded-lg bg-blue-50">
                                                            <Lock className="h-6 w-6 text-blue-600" />
                                                        </div>
                                                        <div className="text-left">
                                                            <p className="font-semibold text-gray-800">Change Password</p>
                                                            <p className="text-xs text-gray-500 mt-1">Update your account password</p>
                                                        </div>
                                                    </div>
                                                </Button>

                                                <Button
                                                    variant="outline"
                                                    className="h-auto justify-start rounded-lg border-2 border-gray-200 hover:bg-purple-50 hover:border-purple-300 p-5"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="p-3 rounded-lg bg-purple-50">
                                                            <Shield className="h-6 w-6 text-purple-600" />
                                                        </div>
                                                        <div className="text-left">
                                                            <p className="font-semibold text-gray-800">Two-Factor Auth</p>
                                                            <p className="text-xs text-gray-500 mt-1">Add an extra layer of security</p>
                                                        </div>
                                                    </div>
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Preferences */
                                {activeTab === "preferences" && (
                                    <div className="bg-white rounded-xl border-0 shadow-lg p-5 md:p-6">
                                        <div className="mb-6">
                                            <h2 className="text-lg md:text-xl font-bold text-blue-600">Application Preferences</h2>
                                            <p className="text-sm text-gray-500 mt-1">Customize your experience</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div>
                                                <Label className="text-sm font-semibold text-gray-700 mb-2 block">Language</Label>
                                                <select className="w-full h-11 px-4 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:outline-none">
                                                    <option>English (US)</option>
                                                    <option>Hindi</option>
                                                    <option>Tamil</option>
                                                </select>
                                            </div>
                                            <div>
                                                <Label className="text-sm font-semibold text-gray-700 mb-2 block">Timezone</Label>
                                                <select className="w-full h-11 px-4 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:outline-none">
                                                    <option>IST (GMT+5:30)</option>
                                                    <option>UTC</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
