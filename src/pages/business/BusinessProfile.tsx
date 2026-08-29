import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Building2, Phone } from "lucide-react";
import { toast } from "sonner";
import BusinessPageShell from "./BusinessPageShell";
import { Card, SectionHeading, FieldGrid, Field } from "./BusinessUI";
import { apiFetch } from "@/services/activApi";
import { BUSINESS_TYPES } from "@/lib/businessTypes";
import { useActiveCompanyStore } from "@/contexts/ActiveCompanyContext";

const BusinessProfile = () => {
    const navigate = useNavigate();
    const { loadCompanies } = useActiveCompanyStore();

    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    /**
     * Whether the member already has a company.
     *
     * `null` means "not established yet" — the lookup has not returned, or it
     * failed. This used to be a boolean initialised `false` that was only ever
     * re-set to `false`; it was never once set true, so `disableNavigation`
     * (`!hasExistingProfile`) was a constant `true` and every sidebar link on
     * this page was dead for everyone, in every state, including when the
     * lookup errored and we knew nothing at all.
     *
     * Navigation is now disabled only when we have *confirmed* there is no
     * company to act on — the case the gate was written for. An unknown answer
     * fails open: the company-scoped screens all render their own empty state.
     */
    const [hasProfile, setHasProfile] = useState<boolean | null>(null);

    const [formData, setFormData] = useState({
        businessName: "",
        email: "",
        description: "",
        businessType: "",
        mobileNumber: "",
        area: "",
        location: "",
        logo: null as File | null,
    });

    useEffect(() => {
        const loadActiveCompany = async () => {
            try {
                const token = localStorage.getItem("token");
                if (!token) return;

                const response = await apiFetch("/business-profiles/me");

                if (response.ok) {
                    const result = await response.json();

                    if (result.data) {
                        // A profile already exists — this screen has nothing to do.
                        setHasProfile(true);
                        navigate("/business/dashboard");
                        return;
                    }
                    setHasProfile(false);
                }
            } catch (error) {
                console.error("Error loading active company:", error);
                // Leave `hasProfile` null — unknown, so navigation stays open.
            }
        };

        loadActiveCompany();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                toast.error('Please upload an image file');
                return;
            }
            if (file.size > 2 * 1024 * 1024) {
                toast.error('Please upload an image smaller than 2MB');
                return;
            }

            setFormData({ ...formData, logo: file });
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        if (!formData.businessName || !formData.businessType || !formData.mobileNumber || !formData.email) {
            toast.error("Please fill in all required fields");
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            toast.error("Please enter a valid email address");
            return;
        }

        if (!formData.location.trim()) {
            toast.error("City / location is required");
            return;
        }

        setSaving(true);

        try {
            const token = localStorage.getItem("token");
            if (!token) {
                toast.error("Please login to save business profile");
                navigate("/login");
                return;
            }

            /**
             * Multipart, because that is how the logo reaches the server.
             *
             * This sent `logo: logoPreview` — the base64 preview string — inside a
             * JSON body. `createBusinessProfile` takes the logo from `req.file`
             * (multer) and never destructures `logo` from the body, so the image
             * was dropped while everything around it saved and the toast reported
             * success. The File itself was already in `formData.logo` and simply
             * was not being sent.
             */
            const companyData = new FormData();
            companyData.append("businessName", formData.businessName);
            companyData.append("email", formData.email);
            companyData.append("description", formData.description);
            companyData.append("businessType", formData.businessType);
            companyData.append("mobileNumber", formData.mobileNumber);
            companyData.append("area", formData.area);
            companyData.append("location", formData.location);
            if (formData.logo) {
                companyData.append("logo", formData.logo);
            }

            // `apiFetch` drops its own Content-Type for FormData so the browser
            // can set the multipart boundary.
            const response = await apiFetch("/business-profiles", {
                method: "POST",
                body: companyData
            });

            const result = await response.json();

            if (response.ok || result.success) {
                toast.success("Company profile created successfully!");
                await loadCompanies({ force: true });
                navigate("/business/dashboard");
            } else {
                toast.error(result.message || "Failed to save company profile");
            }
        } catch (error) {
            console.error("Error saving company profile:", error);
            toast.error("Failed to save company profile");
        } finally {
            setSaving(false);
        }
    };

    return (
        <BusinessPageShell
            title="Create Business Profile"
            subtitle="Register your company to start listing products and reaching buyers"
            width="standard"
            disableNavigation={hasProfile === false}
            actions={
                <>
                    <Button
                        variant="outline"
                        className="border-slate-200 text-slate-700 hover:bg-slate-50"
                        onClick={() => navigate("/business/dashboard")}
                    >
                        Cancel
                    </Button>
                    <Button
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? 'Saving…' : 'Create Profile'}
                    </Button>
                </>
            }
        >
            {/*
                This page had no `max-w-*` wrapper at all and only `p-3 md:p-4`
                padding, so on a 1920px screen every input ran to ~1000px wide —
                the inverse of the other screens' over-narrow columns, from the
                same cause: no deliberate desktop container.
            */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <Card className="lg:sticky lg:top-0">
                    <SectionHeading title="Company Logo" icon={Upload} />

                    <label
                        htmlFor="profile-logo"
                        className="block rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500
                                   transition-colors cursor-pointer overflow-hidden bg-slate-50"
                    >
                        {logoPreview ? (
                            <img src={logoPreview} alt="Logo preview" className="w-full h-48 object-cover" />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-48 px-4 text-center">
                                <Upload className="h-9 w-9 text-slate-400 mb-3" />
                                <p className="text-sm font-semibold text-slate-700">Upload Company Logo</p>
                                <p className="text-xs text-slate-500 mt-1">JPG or PNG, max 2MB</p>
                            </div>
                        )}
                    </label>
                    <input
                        id="profile-logo"
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                    />
                    {logoPreview ? (
                        <p className="text-xs text-slate-500 mt-2 text-center">Click the image to change it</p>
                    ) : null}
                </Card>

                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <SectionHeading title="Business Details" icon={Building2} />
                        <FieldGrid>
                            <Field label="Business Name" required>
                                <Input
                                    id="businessName"
                                    placeholder="Enter your business name"
                                    value={formData.businessName}
                                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                                    className="h-11 border-slate-200 focus-visible:ring-blue-500"
                                />
                            </Field>

                            <Field label="Business Type" required>
                                <Select
                                    value={formData.businessType}
                                    onValueChange={(value) => setFormData({ ...formData, businessType: value })}
                                >
                                    <SelectTrigger className="h-11 border-slate-200 focus:ring-blue-500">
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {BUSINESS_TYPES.map((type) => (
                                            <SelectItem key={type} value={type}>{type}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>

                            <Field label="Description" full>
                                <Textarea
                                    id="description"
                                    placeholder="Describe what your business does, your products/services, and what makes you unique…"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="min-h-[7.5rem] border-slate-200 focus-visible:ring-blue-500"
                                />
                            </Field>
                        </FieldGrid>
                    </Card>

                    <Card>
                        <SectionHeading title="Contact &amp; Location" icon={Phone} />
                        <FieldGrid>
                            <Field label="Mobile Number" required>
                                <Input
                                    id="mobileNumber"
                                    type="tel"
                                    placeholder="+91 98765 43210"
                                    value={formData.mobileNumber}
                                    onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                                    className="h-11 border-slate-200 focus-visible:ring-blue-500"
                                />
                            </Field>

                            <Field label="Email Address" required>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="business@example.com"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="h-11 border-slate-200 focus-visible:ring-blue-500"
                                />
                            </Field>

                            <Field label="City / Location" required>
                                <Input
                                    id="location"
                                    placeholder="e.g., Mumbai, Maharashtra"
                                    value={formData.location}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    className="h-11 border-slate-200 focus-visible:ring-blue-500"
                                />
                            </Field>

                            <Field label="Area / Locality">
                                <Input
                                    id="area"
                                    placeholder="e.g., Downtown, Industrial Zone"
                                    value={formData.area}
                                    onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                                    className="h-11 border-slate-200 focus-visible:ring-blue-500"
                                />
                            </Field>
                        </FieldGrid>
                    </Card>

                    <div className="flex justify-end gap-3">
                        <Button
                            variant="outline"
                            className="border-slate-200 text-slate-700 hover:bg-slate-50"
                            onClick={() => navigate("/business/dashboard")}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? 'Saving…' : 'Create Profile'}
                        </Button>
                    </div>
                </div>
            </div>
        </BusinessPageShell>
    );
};

export default BusinessProfile;
