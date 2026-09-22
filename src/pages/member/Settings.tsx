import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    User, Mail, Phone, MapPin, Save, Camera, Menu, Briefcase, Building2,
    FileCheck, ArrowRight,
} from "lucide-react";
import MemberSidebar from "./MemberSidebar";
import MemberTopBar from "@/features/member/components/MemberTopBar";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { PAGE_SUBTITLE, PAGE_TITLE } from '@/components/layout/appTypography';
import {
    apiFetch, getStates, getDistricts, getBlocks, errorMessage,
} from "@/services/activApi";
import {
    SOCIAL_CATEGORIES,
    GENDERS,
    religionsFor,
    normalizeReligion,
    commencementYears,
} from "@/lib/memberFormOptions";

/**
 * EVERY SECTION OF THE APPLICATION, EDITABLE, IN ONE PLACE.
 *
 * This screen used to show Personal Information and nothing else to anyone who
 * had not paid — the business and declaration sections were behind
 * `isPaid`, and an applicant reaching Settings was told their forms were
 * "locked while they are in review" with a link to Help & Support. So the only
 * way to fix a mistyped commencement year was to email somebody about it.
 *
 * All of it is here now, prefilled from the record and written straight back.
 *
 * WHAT IS NOT HERE, and deliberately: the company's own details — constitution,
 * activities, PAN, GSTIN, turnover, government registrations. Those describe a
 * COMPANY, not an applicant, and a member may have several; they are edited per
 * company in the Business Account, and this screen links there rather than
 * carrying a second copy of the form. (Two screens editing one record with
 * different field sets is how the six silently-dropped business fields
 * documented below came about in the first place.)
 */

/**
 * A stored Boolean, as the form's yes/no strings.
 *
 * `doingBusiness` is a Boolean in the database and a yes/no string in these
 * controls. `value || ""` turned a stored `false` into the empty string —
 * indistinguishable from "never answered" — so a member who had said "no"
 * reopened the page with the question blank.
 */
const yesNoText = (value: unknown): string => {
    if (value === true) return "yes";
    if (value === false) return "no";
    return String(value ?? "");
};

/** A yes / no pair. Answering neither leaves the stored answer alone. */
const YesNo = ({
    value, onChange,
}: { value: string; onChange: (v: string) => void }) => (
    <div className="flex gap-2">
        {["yes", "no"].map((choice) => (
            <button
                key={choice}
                type="button"
                aria-pressed={value === choice}
                onClick={() => onChange(choice)}
                className={`px-5 py-2 rounded-xl text-[1.1875rem] font-semibold border transition-colors ${value === choice
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
            >
                {choice === "yes" ? "Yes" : "No"}
            </button>
        ))}
    </div>
);

const MemberSettings = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [profilePhoto, setProfilePhoto] = useState("");
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

    /** Region options, from the admin database — never a bundled list. */
    const [states, setStates] = useState<string[]>([]);
    const [districts, setDistricts] = useState<string[]>([]);
    const [blocks, setBlocks] = useState<string[]>([]);

    const [formData, setFormData] = useState({
        // Personal
        name: "",
        email: "",
        phoneNumber: "",
        city: "",
        state: "",
        district: "",
        block: "",
        socialCategory: "",
        religion: "",
        gender: "",

        // Business — the two questions the application asks
        doingBusiness: "",
        businessYear: "",

        // Declaration
        sisterConcerns: "",
        companyNames: [] as string[],
        declarationAccepted: false,
    });

    /** Extra rows for the company-name list, kept beside the saved value. */
    const [companyInputs, setCompanyInputs] = useState<string[]>([""]);

    /** The religions this member's social category admits. */
    const allowedReligions = useMemo(
        () => religionsFor(formData.socialCategory),
        [formData.socialCategory],
    );

    /** 1950 to this year, newest first. Fixed for the life of the screen. */
    const years = useMemo(() => commencementYears(), []);

    useEffect(() => {
        loadUserData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /*
     * Region options come from the API.
     *
     * These three fields were free-text boxes, and that is not a cosmetic
     * problem: `buildGeoFilter` matches a member's region against an admin's
     * with an ANCHORED regex, so "Tamil Nadu" typed as "tamil  nadu" is a
     * different region holding one member and visible to no admin's queue. A
     * member could type themselves out of every dashboard from this screen and
     * nothing would report it. See ADMIN-FIRST REGION ARCHITECTURE in CLAUDE.md.
     */
    useEffect(() => {
        let cancelled = false;
        getStates()
            .then((r) => { if (!cancelled) setStates((r.states || []).map((s) => s.name)); })
            .catch(() => { if (!cancelled) setStates([]); });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        let cancelled = false;
        if (!formData.state) {
            setDistricts([]);
            return;
        }
        getDistricts(formData.state)
            .then((r) => { if (!cancelled) setDistricts((r.districts || []).map((d) => d.name)); })
            .catch(() => { if (!cancelled) setDistricts([]); });
        return () => { cancelled = true; };
    }, [formData.state]);

    useEffect(() => {
        let cancelled = false;
        if (!formData.state || !formData.district) {
            setBlocks([]);
            return;
        }
        getBlocks(formData.state, formData.district)
            .then((r) => { if (!cancelled) setBlocks((r.blocks || []).map((b) => b.name)); })
            .catch(() => { if (!cancelled) setBlocks([]); });
        return () => { cancelled = true; };
    }, [formData.state, formData.district]);

    /**
     * One setter, with the dependencies between fields in it.
     *
     * Changing a parent region clears its children rather than auto-picking the
     * first option: auto-picking silently moves the member to a region they
     * never chose, and their application queue follows them. Changing the social
     * category clears a religion the new category does not admit.
     */
    const setField = (field: string, value: unknown) =>
        setFormData((prev) => {
            const next = { ...prev, [field]: value } as typeof prev;
            if (field === "state") {
                next.district = "";
                next.block = "";
            } else if (field === "district") {
                next.block = "";
            } else if (field === "socialCategory") {
                if (next.religion && !religionsFor(String(value)).includes(next.religion)) {
                    next.religion = "";
                }
            } else if (field === "doingBusiness" && value === "no") {
                // An aspirant has no commencement year. Leaving one behind would
                // price them into a band for a business they just said they do
                // not have.
                next.businessYear = "";
            }
            return next;
        });

    const loadUserData = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/login');
                return;
            }

            const auth = { headers: { 'Authorization': `Bearer ${token}` } };

            // Three reads, issued together. The financial record is not edited
            // here any more — it belongs to a company, in the Business Account.
            const [personalRes, businessRes, declarationRes] = await Promise.all([
                apiFetch('/members/my-profile', auth),
                apiFetch('/members/business-info', auth),
                apiFetch('/members/declaration-info', auth),
            ]);

            if (personalRes.ok) {
                const personalResult = await personalRes.json();
                if (personalResult.success && personalResult.data) {
                    const data = personalResult.data;
                    setProfilePhoto(data.profilePhoto || "");
                    setFormData(prev => ({
                        ...prev,
                        // `fullName` is what the endpoint returns; `name` is kept
                        // as a fallback for an older cached response shape.
                        name: data.fullName || data.name || "",
                        email: data.email || "",
                        phoneNumber: data.phoneNumber || "",
                        city: data.city || "",
                        state: data.state || "",
                        district: data.district || "",
                        block: data.block || "",
                        socialCategory: data.socialCategory || "",
                        // Old spellings map onto the list's current wording.
                        // Mapped, so a returning member is not handed a blank
                        // select — see `normalizeReligion`.
                        religion: normalizeReligion(data.religion),
                        gender: data.gender || "",
                    }));
                }
            }

            if (businessRes.ok) {
                const businessResult = await businessRes.json();
                if (businessResult.success && businessResult.data) {
                    /*
                     * `businessCommencementYear` is the name
                     * `GET /members/business-info` returns. This screen used to
                     * read the form's own shorthand, so six business fields came
                     * back `undefined`, rendered empty over data that existed,
                     * and the next save wrote those blanks back.
                     */
                    const d = businessResult.data;
                    setFormData(prev => ({
                        ...prev,
                        doingBusiness: yesNoText(d.doingBusiness),
                        businessYear: String(d.businessCommencementYear || d.businessYear || ""),
                    }));
                }
            }

            if (declarationRes.ok) {
                const declarationResult = await declarationRes.json();
                if (declarationResult.success && declarationResult.data) {
                    const d = declarationResult.data;
                    const names: string[] = Array.isArray(d.companyNames)
                        ? d.companyNames.map((v: unknown) => String(v ?? ""))
                        : [];
                    setFormData(prev => ({
                        ...prev,
                        sisterConcerns: String(d.sisterConcerns ?? ""),
                        companyNames: names,
                        // `agreeToDeclaration` is what the endpoint returns.
                        declarationAccepted: d.agreeToDeclaration === true,
                    }));
                    // One empty row when there is nothing stored, or the member
                    // is left with an "Add" button and nowhere to type.
                    setCompanyInputs(names.length ? names : [""]);
                }
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            toast.error('Failed to load settings data');
        } finally {
            setLoading(false);
        }
    };

    const handleCompanyNameChange = (index: number, value: string) => {
        const next = [...companyInputs];
        next[index] = value;
        setCompanyInputs(next);
        setFormData(prev => ({ ...prev, companyNames: next.filter((n) => n.trim() !== "") }));
    };

    const addCompanyInput = () => setCompanyInputs([...companyInputs, ""]);

    const removeCompanyInput = (index: number) => {
        const next = companyInputs.filter((_, i) => i !== index);
        setCompanyInputs(next.length ? next : [""]);
        setFormData(prev => ({ ...prev, companyNames: next.filter((n) => n.trim() !== "") }));
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
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    const handleSave = async () => {
        if (formData.socialCategory && formData.religion
            && !allowedReligions.includes(formData.religion)) {
            toast.error(`Please choose a religion recognised for ${formData.socialCategory}`);
            return;
        }
        if (formData.doingBusiness === "yes" && !formData.businessYear) {
            toast.error("Please select the year your business commenced");
            return;
        }

        setSaving(true);
        try {
            const token = localStorage.getItem('token');

            /**
             * ONE request, carrying every section.
             *
             * `updateMember` routes a single body to all four collections — the
             * personal record, the business record, the financial record and the
             * declaration — so this used to be four sequential PUTs to the same
             * endpoint with overlapping bodies, plus a fifth that re-sent the
             * name. Four round trips, four chances to half-succeed, and no way
             * to tell the member which half.
             *
             * Every key is the name the schema actually stores. The form's own
             * shorthand (`organization`, `constitution`, `businessYear`,
             * `employees`, `chamber`, `govtOrgs`) is not read by the controller,
             * so Mongoose strict mode dropped all six on every save while the
             * response said 200 and the toast said "saved".
             */
            const payload: Record<string, unknown> = {
                // `fullName`, not `name`.
                fullName: formData.name,
                email: formData.email,
                phoneNumber: formData.phoneNumber,
                city: formData.city,
                state: formData.state,
                district: formData.district,
                block: formData.block,
                socialCategory: formData.socialCategory,
                religion: formData.religion,
                gender: formData.gender,

                // `agreeToDeclaration` is the stored field; `declarationAccepted`
                // is not a key the server reads, so the consent used to be
                // recorded as false for everyone who saved from here.
                // Never a count from a field an aspirant was not shown.
                sisterConcerns: formData.doingBusiness === "yes" ? formData.sisterConcerns : "",
                companyNames: formData.companyNames,
                agreeToDeclaration: formData.declarationAccepted,
            };

            /*
              An unanswered business question is left out entirely.

              `''` cannot be cast to Boolean and failed the whole request with a
              500 no client could act on; omitting it is what "unanswered" means
              and leaves the stored answer alone.
            */
            if (formData.doingBusiness) {
                payload.doingBusiness = formData.doingBusiness;
                payload.registrationType =
                    formData.doingBusiness === "no" ? "aspirant" : "business";
                if (formData.doingBusiness === "yes") {
                    payload.businessCommencementYear = formData.businessYear;
                }
            }

            const response = await apiFetch('/members/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                // The region gate rejects a district or block with no active
                // admin and its message names the region — worth showing
                // verbatim rather than replacing with a generic failure.
                const result = await response.json().catch(() => ({}));
                toast.error(result?.message || "Failed to update your details");
                return;
            }

            toast.success("Your details have been updated");

            localStorage.setItem('userName', formData.name);
            localStorage.setItem('userEmail', formData.email);
            // Every surface that shows the member's name or completion reads
            // these; without them the sidebar keeps the old name until a reload.
            window.dispatchEvent(new CustomEvent('userDataUpdated'));
            window.dispatchEvent(new CustomEvent('profileDataUpdated'));
            window.dispatchEvent(new CustomEvent('formSubmitted'));

            // Read back what was actually stored rather than trusting local
            // state — the server normalises phone numbers and region spellings.
            await loadUserData();
        } catch (error) {
            console.error('Error updating profile:', error);
            toast.error(errorMessage(error, "Error updating profile"));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen bg-white font-sans">
                <MemberSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-slate-500">Loading...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-50">
            <MemberSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="h-[5.5rem] shrink-0 bg-white border-b border-slate-200 flex items-center gap-3 px-6 z-10">
                    <button
                        type="button"
                        className="lg:hidden text-slate-500 hover:text-slate-700 shrink-0"
                        onClick={() => setSidebarOpen(true)}
                        aria-label="Open menu"
                    >
                        <Menu className="w-5 h-5" />
                    </button>

                    <div className="min-w-0">
                        <h1 className={`${PAGE_TITLE} text-slate-900 truncate`}>
                            Settings
                        </h1>
                        <p className={`${PAGE_SUBTITLE} text-slate-500 mt-0.5 truncate hidden sm:block`}>
                            Manage your profile and account preferences
                        </p>
                    </div>

                    <div className="ml-auto flex items-center gap-2 shrink-0">
                        <MemberTopBar />
                    </div>
                </header>

                {/* Content */}
                <div className="flex-1 p-6 overflow-auto">
                    <div className="max-w-[90rem] space-y-6">
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
                                            <AvatarFallback className="bg-blue-600 text-white text-[1.75rem] font-bold">
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
                                        <p className="text-[1.0625rem] text-slate-500 mt-2">JPG, PNG or GIF. Max size 5MB.</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* ------------------------------------------- personal */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <User className="h-5 w-5 text-blue-600" />
                                    Personal Information
                                </CardTitle>
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
                                            onChange={(e) => setField("name", e.target.value)}
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
                                            onChange={(e) => setField("email", e.target.value)}
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
                                            inputMode="numeric"
                                            maxLength={10}
                                            value={formData.phoneNumber}
                                            onChange={(e) => setField("phoneNumber", e.target.value)}
                                            placeholder="9876543210"
                                        />
                                    </div>

                                    <div>
                                        <Label className="flex items-center gap-2 mb-2">
                                            <MapPin className="h-4 w-4" />
                                            City
                                        </Label>
                                        <Input
                                            value={formData.city}
                                            onChange={(e) => setField("city", e.target.value)}
                                            placeholder="Enter city"
                                        />
                                    </div>

                                    <div>
                                        <Label className="mb-2">State</Label>
                                        <Select
                                            value={formData.state}
                                            onValueChange={(v) => setField("state", v)}
                                        >
                                            <SelectTrigger><SelectValue placeholder="Select State" /></SelectTrigger>
                                            <SelectContent>
                                                {states.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <Label className="mb-2">District</Label>
                                        <Select
                                            value={formData.district}
                                            onValueChange={(v) => setField("district", v)}
                                            disabled={!formData.state}
                                        >
                                            <SelectTrigger><SelectValue placeholder="Select District" /></SelectTrigger>
                                            <SelectContent>
                                                {districts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <Label className="mb-2">Block</Label>
                                        <Select
                                            value={formData.block}
                                            onValueChange={(v) => setField("block", v)}
                                            disabled={!formData.district}
                                        >
                                            <SelectTrigger><SelectValue placeholder="Select Block" /></SelectTrigger>
                                            <SelectContent>
                                                {blocks.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <Label className="mb-2">Social Category</Label>
                                        <Select
                                            value={formData.socialCategory}
                                            onValueChange={(v) => setField("socialCategory", v)}
                                        >
                                            <SelectTrigger><SelectValue placeholder="Select Social Category" /></SelectTrigger>
                                            <SelectContent>
                                                {SOCIAL_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/*
                                        Religion, narrowed by the category above.

                                        Asked in this order because the category
                                        decides this field: a religion already
                                        chosen would have to be rewritten the
                                        moment the category is answered, and a
                                        field that silently changes its own value
                                        reads as the form losing an answer.

                                        Disabled until the category is answered
                                        rather than showing all five and then
                                        shrinking the list.
                                    */}
                                    <div>
                                        <Label className="mb-2">Religion</Label>
                                        <Select
                                            value={formData.religion}
                                            onValueChange={(v) => setField("religion", v)}
                                            disabled={!formData.socialCategory}
                                        >
                                            <SelectTrigger><SelectValue placeholder="Select Religion" /></SelectTrigger>
                                            <SelectContent>
                                                {allowedReligions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        {/* Only the disabled-state prompt — see PersonalForm. */}
                                        <p className="text-[1.0625rem] text-slate-500 mt-1.5">
                                            {!formData.socialCategory ? "Choose a social category first." : " "}
                                        </p>
                                    </div>

                                    <div>
                                        <Label className="mb-2">Gender</Label>
                                        <Select
                                            value={formData.gender}
                                            onValueChange={(v) => setField("gender", v)}
                                        >
                                            <SelectTrigger><SelectValue placeholder="Select Gender" /></SelectTrigger>
                                            <SelectContent>
                                                {GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* ------------------------------------------- business */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Briefcase className="h-5 w-5 text-blue-600" />
                                    Business Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-5">
                                    <div>
                                        <Label className="mb-2">Are you currently doing business?</Label>
                                        <YesNo
                                            value={formData.doingBusiness}
                                            onChange={(v) => setField("doingBusiness", v)}
                                        />
                                        <p className="text-[1.0625rem] text-slate-500 mt-1.5">
                                            Answering "No" records you as an aspirant member.
                                        </p>
                                    </div>

                                    {formData.doingBusiness === "yes" && (
                                        <div className="max-w-sm">
                                            <Label className="mb-2">Business Commencement Year</Label>
                                            <Select
                                                value={formData.businessYear}
                                                onValueChange={(v) => setField("businessYear", v)}
                                            >
                                                <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                                                {/* Seventy-odd years, so the list scrolls
                                                    rather than covering the window. */}
                                                <SelectContent className="max-h-72">
                                                    {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <p className="text-[1.0625rem] text-slate-500 mt-1.5">
                                                This year decides which membership plan you are offered.
                                                The fee is confirmed at the payment step.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* ---------------------------------------- declaration */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileCheck className="h-5 w-5 text-blue-600" />
                                    Declaration
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-5">
                                    {/*
                                        SISTER CONCERNS IS A BUSINESS QUESTION, and the business step
                                        has already asked whether there is a business. Asking an
                                        aspirant how many OTHER companies they own, on the screen where
                                        they certify the information is correct, is asking them to
                                        invent a field. "0 if none" is not the honest answer; "this does
                                        not apply" is, and the form had no way to say it.
                                        Same gate as `Profile.tsx` step 3.
                                    */}
                                    {formData.doingBusiness === "yes" && (
                                    <>
                                    <div className="max-w-sm">
                                        <Label className="mb-2">Number of Sister Concerns</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            inputMode="numeric"
                                            value={formData.sisterConcerns}
                                            onChange={(e) => {
                                                // Digits only. The field is a count, and a
                                                // negative one fails the schema's `min: 0`.
                                                const digits = e.target.value.replace(/[^0-9]/g, "");
                                                setField("sisterConcerns", digits);
                                            }}
                                            placeholder="Enter number (0 if none)"
                                        />
                                    </div>

                                    {Number(formData.sisterConcerns || 0) > 0 && (
                                        <div className="space-y-3 max-w-xl">
                                            <Label>Company Names</Label>
                                            {companyInputs.map((value, index) => (
                                                <div key={index} className="flex gap-2">
                                                    <Input
                                                        value={value}
                                                        onChange={(e) => handleCompanyNameChange(index, e.target.value)}
                                                        placeholder={`Company ${index + 1}`}
                                                        className="flex-1"
                                                    />
                                                    {companyInputs.length > 1 && (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={() => removeCompanyInput(index)}
                                                            className="text-red-600 hover:text-red-700"
                                                        >
                                                            Remove
                                                        </Button>
                                                    )}
                                                </div>
                                            ))}
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={addCompanyInput}
                                                className="w-full"
                                            >
                                                + Add Another Company
                                            </Button>
                                        </div>
                                    )}
                                    </>
                                    )}

                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <Checkbox
                                            checked={formData.declarationAccepted}
                                            onCheckedChange={(checked) =>
                                                setField("declarationAccepted", checked === true)}
                                            className="mt-1"
                                        />
                                        <span className="text-[1.1875rem] text-slate-700">
                                            I declare that all the information provided is true and correct
                                            to the best of my knowledge, and I understand that false
                                            information may result in rejection of my application.
                                        </span>
                                    </label>
                                </div>
                            </CardContent>
                        </Card>

                        {/*
                          * Company and financial details, and where they actually live.
                          *
                          * Not a second copy of the company form. Constitution, PAN,
                          * GSTIN, turnover and government registrations describe a
                          * COMPANY, and a member may have more than one — asked here
                          * they would have one set of answers describing whichever
                          * company was edited last. This is a signpost.
                          */}
                        <Card className="border-blue-100 bg-blue-50/60">
                            <CardContent className="pt-6 flex flex-wrap items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <p className="text-[1.1875rem] font-bold text-slate-900 flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-blue-600" />
                                        Company &amp; financial details
                                    </p>
                                    <p className="text-[1.1875rem] text-slate-500 mt-1.5 leading-relaxed max-w-2xl">
                                        Constitution, type of business, activities, PAN, GSTIN, turnover
                                        and government registrations are held against each company rather
                                        than against you, so they are edited in your Business Account.
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="border-blue-200 text-blue-700 hover:bg-blue-100 shrink-0"
                                    onClick={() => navigate('/business/companies')}
                                >
                                    Open Business Account
                                    <ArrowRight className="h-4 w-4 ml-2" />
                                </Button>
                            </CardContent>
                        </Card>

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
                                <p className="text-[1.0625rem] text-slate-500 mt-3">
                                    Changes are written to your record immediately and are what the
                                    review team sees.
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MemberSettings;
