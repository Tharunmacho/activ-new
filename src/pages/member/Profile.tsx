import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Menu, Eye, EyeOff, Bell, User, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import MemberPageShell from "./MemberPageShell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  apiFetch,
  getStates,
  getDistricts,
  getBlocks,
  getMyProfile,
  getBusinessInfo,
  getFinancialInfo,
  getDeclarationInfo,
  submitApplication,
  errorMessage,
} from "@/services/activApi";
/**
 * Option lists that mirror the backend enums. Hand-written copies of these had
 * drifted so far that the financial step could not be saved at all — see the
 * header of `memberFormOptions.ts`.
 */
import {
  CONSTITUTION_TYPES,
  BUSINESS_TYPE_OPTIONS,
  TURNOVER_RANGES,
  SOCIAL_CATEGORIES,
} from "@/lib/memberFormOptions";

type ProfileData = {
  // Step 1: Personal, Account, Demographic
  name: string;
  block?: string;
  state?: string;
  district?: string;
  city?: string;
  phone: string;
  email: string;
  currentPassword?: string;
  password?: string;
  confirmPassword?: string;
  religion?: string;
  socialCategory?: string;

  // Step 2: Business Information
  doingBusiness?: string;
  organization?: string;
  constitution?: string;
  businessTypes?: string[];
  businessYear?: string;
  employees?: string;
  chamber?: string;
  chamberDetails?: string;
  govtOrgs?: string[];

  // Step 3: Financial & Compliance
  pan?: string;
  gst?: string;
  udyam?: string;
  filedITR?: string;
  itrYears?: string;
  turnoverRange?: string;
  turnover1?: string;
  turnover2?: string;
  turnover3?: string;
  govtSchemes?: string;
  scheme1?: string;
  scheme2?: string;
  scheme3?: string;

  // Step 4: Declaration
  sisterConcerns?: string;
  companyNames?: string;
  declarationAccepted?: boolean;
};

const defaultProfile: ProfileData = {
  name: "",
  block: "",
  state: "",
  district: "",
  city: "",
  phone: "",
  email: "",
  currentPassword: "",
  password: "",
  confirmPassword: "",
  religion: "",
  socialCategory: "",
  doingBusiness: "",
  organization: "",
  constitution: "",
  businessTypes: [],
  businessYear: "",
  employees: "",
  chamber: "",
  chamberDetails: "",
  govtOrgs: [],
  pan: "",
  gst: "",
  udyam: "",
  filedITR: "",
  itrYears: "",
  turnoverRange: "",
  turnover1: "",
  turnover2: "",
  turnover3: "",
  govtSchemes: "",
  scheme1: "",
  scheme2: "",
  scheme3: "",
  sisterConcerns: "",
  companyNames: "",
  declarationAccepted: false,
};

export default function Profile() {
  const [states, setStates] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isLocked, setIsLocked] = useState(false);
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const [hasExistingProfile, setHasExistingProfile] = useState(false);
  /**
   * True when the signed-in account has no row in "web users" at all — an admin
   * account reaching the member profile page. See the 404 branch in
   * `loadUserProfile`.
   */
  const [noMemberRecord, setNoMemberRecord] = useState(false);
  const [companyNames, setCompanyNames] = useState<string[]>([""]);
  const [showSeparateFields, setShowSeparateFields] = useState(false);
  /**
   * The member's actual consent, which used to be a decorative ✓ glyph with no
   * value behind it. It gates `handleFinalSubmit` and is sent as
   * `agreeToDeclaration`.
   */
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<ProfileData>({ defaultValues: defaultProfile });

  // Auto-save disabled - Data is saved manually when clicking Save/Next buttons

  // Load profile data from backend on mount
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const token = localStorage.getItem("token");

        // If authenticated, load from backend
        if (!token) return;

        // Load personal form data
        const personalFormResponse = await apiFetch("/members/my-profile", {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });


        if (personalFormResponse.ok) {
          const personalResult = await personalFormResponse.json();

          if (personalResult.data) {
            const formData = personalResult.data;

            setHasExistingProfile(true);
            setIsLocked(formData.isLocked || false);

            const formValues = {
              name: formData.fullName || formData.name || "",
              phone: formData.phoneNumber || "",
              email: formData.email || "",
              state: formData.state || "",
              district: formData.district || "",
              block: formData.block || "",
              city: formData.city || "",
              religion: formData.religion || "",
              socialCategory: formData.socialCategory || "",
              password: "",
              confirmPassword: "",
              currentPassword: ""
            };

            reset(formValues);

            // Load districts if state exists
            if (formData.state) {
              getDistricts(formData.state)
                .then((r) => setDistricts((r.districts || []).map((d) => d.name)))
                .catch(() => setDistricts([]));

              // Load blocks if district exists
              if (formData.district) {
                getBlocks(formData.state, formData.district)
                  .then((r) => setBlocks((r.blocks || []).map((b) => b.name)))
                  .catch(() => setBlocks([]));
              }
            }
            return;
          }
        }

        /**
         * A 404 here means this account has no member record at all.
         *
         * `GET /members/my-profile` looks the caller up in the "web users"
         * (MemberDetails) collection. An admin — block, district, state or super
         * — lives in `adminsdb`, not there, so the call answers
         * `404 Profile not found`. This branch used to fall straight through and
         * leave the form rendered empty and editable, which reads exactly like a
         * member who simply has not filled anything in yet. It is not: pressing
         * "Save Personal Details" then calls `PUT /members/profile`, which does
         * the same lookup and answers `404 Member not found`, so the form can
         * never save either. Saying so is the difference between a blank form
         * and an explanation.
         */
        if (personalFormResponse.status === 404) {
          setNoMemberRecord(true);
          return;
        }

        // Load business form data
        const businessFormResponse = await apiFetch("/members/business-info", {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });


        if (businessFormResponse.ok) {
          const businessResult = await businessFormResponse.json();

          if (businessResult.data) {
            const businessData = businessResult.data;

            reset(prev => ({
              ...prev,
              doingBusiness: businessData.doingBusiness || "",
              organization: businessData.organization || "",
              constitution: businessData.constitution || "",
              businessTypes: businessData.businessTypes || [],
              businessYear: businessData.businessYear || "",
              employees: businessData.employees || "",
              chamber: businessData.chamber || "",
              chamberDetails: businessData.chamberDetails || "",
              govtOrgs: businessData.govtOrgs || []
            }));
          }
        }
      } catch (error) {
        console.error("Error loading profile:", error);
      }
    };

    loadUserProfile();
  }, [reset]);

  /**
   * Selectable states come from the admin database, never a bundled list.
   *
   * Only regions with an active admin may be chosen: an application submitted
   * into an unstaffed block lands in nobody's queue. The bundled
   * `india-districts` file offered every state in India regardless, so this
   * dropdown showed ~30 options where the platform actually covers 2.
   */
  useEffect(() => {
    let cancelled = false;
    getStates()
      .then((r) => { if (!cancelled) setStates((r.states || []).map((x) => x.name)); })
      .catch(() => { if (!cancelled) setStates([]); });
    return () => { cancelled = true; };
  }, []);

  // Load districts when state changes
  const selectedState = watch("state");
  useEffect(() => {
    if (selectedState) {
      getDistricts(selectedState)
        .then((r) => setDistricts((r.districts || []).map((d) => d.name)))
        .catch(() => setDistricts([]));
    } else {
      setDistricts([]);
    }
  }, [selectedState]);

  // Load blocks when state and district change
  const selectedDistrict = watch("district");
  useEffect(() => {
    /**
     * `getBlocks`, the same helper every other region dropdown uses.
     *
     * This effect hand-rolled the request with `apiFetch` and then did
     * `setBlocks(data.data)`. The endpoint answers with an OBJECT —
     * `{ state, district, blocks: [{ name, admins }], coverageAvailable }` —
     * so that stored the whole envelope where the render expects an array of
     * strings. `blocks.length` on an object is `undefined`, `undefined > 0` is
     * false, and the dropdown fell through to "No blocks available". With no
     * options the Select had nothing matching the member's saved block, so the
     * field rendered blank even though "Ariyalur" was on their record and was
     * being returned by the API.
     *
     * Nothing errored anywhere: an object is a perfectly good thing to put in
     * state, and the symptom only appeared one step later, in the render.
     *
     * This effect runs whenever state or district changes, so it always
     * overwrote the correct list a moment after the form was populated — which
     * is why the initial load getting it right made no difference. Using the
     * shared helper, as the states and districts effects already do, removes
     * the second response shape that caused it.
     */
    const loadBlocks = async () => {
      if (!selectedState || !selectedDistrict) {
        setBlocks([]);
        return;
      }
      try {
        const result = await getBlocks(selectedState, selectedDistrict);
        setBlocks((result.blocks || []).map((b) => b.name));
      } catch (error) {
        console.error("Error loading blocks:", error);
        setBlocks([]);
      }
    };
    loadBlocks();
  }, [selectedState, selectedDistrict]);

  const saveCurrentStepData = (data: ProfileData) => {
    const currentData = JSON.parse(localStorage.getItem("userProfile") || "{}");
    const updatedData = { ...currentData, ...data };
    localStorage.setItem("userProfile", JSON.stringify(updatedData));
    localStorage.setItem("registrationData", JSON.stringify(updatedData));
    return updatedData;
  };

  const saveStep1 = async (data: ProfileData) => {
    // Validate all required fields
    if (!data.name || !data.name.trim()) {
      toast.error("Name is required");
      return false;
    }

    if (!data.phone || !data.phone.trim()) {
      toast.error("Phone number is required");
      return false;
    }

    if (!data.email || !data.email.trim()) {
      toast.error("Email is required");
      return false;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      toast.error("Please enter a valid email address");
      return false;
    }

    if (!data.state || !data.state.trim()) {
      toast.error("State is required");
      return false;
    }

    if (!data.district || !data.district.trim()) {
      toast.error("District is required");
      return false;
    }

    if (!data.block || !data.block.trim()) {
      toast.error("Block is required");
      return false;
    }

    if (!data.city || !data.city.trim()) {
      toast.error("City is required");
      return false;
    }

    if (!data.religion || !data.religion.trim()) {
      toast.error("Religion is required");
      return false;
    }

    if (!data.socialCategory || !data.socialCategory.trim()) {
      toast.error("Social Category is required");
      return false;
    }

    try {
      const token = localStorage.getItem("token");

      // Check if user wants to change password
      const wantsToChangePassword = data.password && data.password.trim() !== "";

      if (wantsToChangePassword && token) {
        // Validate password fields
        if (data.password.length < 6) {
          toast.error("New password must be at least 6 characters");
          return false;
        }

        if (data.password !== data.confirmPassword) {
          toast.error("New password and confirm password do not match");
          return false;
        }

        // Current password is required when changing password
        if (!data.currentPassword || data.currentPassword.trim() === "") {
          toast.error("Please enter your current password to change it");
          return false;
        }

        const passwordResponse = await apiFetch("/auth/change-password", {
          method: 'POST',
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            currentPassword: data.currentPassword,
            newPassword: data.password
          })
        });

        const passwordResult = await passwordResponse.json();

        if (!passwordResponse.ok) {
          toast.error(passwordResult.message || "Failed to update password");
          return false;
        }

        toast.success("Password updated successfully");
      }

      if (token) {
        // Save Step 1 fields to "additional form for personal information 1" collection
        const step1Data = {
          name: data.name,
          phoneNumber: data.phone,
          email: data.email,
          state: data.state,
          district: data.district,
          block: data.block,
          city: data.city,
          religion: data.religion,
          socialCategory: data.socialCategory,
          isLocked: true
        };

        const saveResponse = await apiFetch("/members/profile", {
          method: 'PUT',
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(step1Data)
        });

        if (!saveResponse.ok) {
          toast.error("Failed to save profile");
          return false;
        }

        // Mark that profile now exists and lock it
        setHasExistingProfile(true);
        setIsLocked(true);
      }

      saveCurrentStepData(data);
      toast.success(hasExistingProfile ? "Profile updated successfully!" : "Profile saved successfully!");

      // Dispatch event to refresh profile completion
      window.dispatchEvent(new CustomEvent('formSubmitted'));
      window.dispatchEvent(new CustomEvent('profileUpdated'));

      return true;
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to save profile");
      return false;
    }
  };

  const handleNext = async () => {
    const data = watch();
    if (currentStep === 1) {
      const saved = await saveStep1(data);
      if (saved) {
        setCurrentStep(2);
      }
    } else if (currentStep === 2) {
      if (data.doingBusiness === "no") {
        // Check if declaration is accepted
        if (!data.declarationAccepted) {
          toast.error("Please accept the declaration to continue");
          return;
        }

        // Save business form with "no" status (Aspirant)
        const token = localStorage.getItem("token");
        if (!token) {
          toast.error("Authentication required");
          return;
        }

        try {

          const businessResponse = await apiFetch("/members/profile", {
            method: 'PUT',
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ doingBusiness: "no" })
          });

          const businessResult = await businessResponse.json();

          if (!businessResponse.ok) {
            console.error("❌ Failed to save business form:", businessResult);
            toast.error("Failed to save business information");
            return;
          }


          // Also save declaration form for aspirant

          const declarationResponse = await apiFetch("/members/profile", {
            method: 'PUT',
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              remarks: "Aspirant application",
              declarationAccepted: true
            })
          });

          const declarationResult = await declarationResponse.json();

          if (!declarationResponse.ok) {
            console.error("❌ Failed to save declaration:", declarationResult);
            toast.error("Failed to submit declaration");
            return;
          }


        } catch (error) {
          console.error("❌ Error saving forms:", error);
          toast.error("Failed to save information");
          return;
        }

        saveCurrentStepData(data);

        // The same call the business branch makes. This used to invent an id
        // and navigate, creating nothing.
        if (!(await createApplicationFromStoredForms())) return;

        toast.success("Application submitted successfully!");

        // Dispatch events to refresh profile completion immediately
        window.dispatchEvent(new CustomEvent('formSubmitted'));
        window.dispatchEvent(new CustomEvent('profileUpdated'));

        navigate('/member/application-submitted');
        return;
      } else if (data.doingBusiness === "yes") {
        if (!data.organization || !data.constitution || !data.businessTypes?.length) {
          toast.error("Please fill in all required business information");
          return;
        }

        // Save business form to business_profiles collection
        try {
          const token = localStorage.getItem("token");
          if (token) {
            const businessData = {
              doingBusiness: data.doingBusiness,
              organization: data.organization,
              constitution: data.constitution,
              businessTypes: data.businessTypes,
              businessActivities: data.businessYear, // Using businessYear field for activities
              businessYear: data.businessYear,
              employees: data.employees,
              chamber: data.chamber,
              chamberDetails: data.chamberDetails || "",
              govtOrgs: data.govtOrgs || []
            };



            const response = await apiFetch("/members/profile", {
              method: 'PUT',
              headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify(businessData)
            });

            const result = await response.json();

            if (!response.ok) {
              console.error("❌ Failed to save:", result);
              toast.error("Failed to save business information");
              return;
            }

            toast.success("Business information saved!");
            
            // Dispatch event to refresh profile completion
            window.dispatchEvent(new CustomEvent('formSubmitted'));
            window.dispatchEvent(new CustomEvent('profileUpdated'));
          }
        } catch (error) {
          console.error("Error saving business form:", error);
          toast.error("Failed to save business information");
          return;
        }

        saveCurrentStepData(data);
        setCurrentStep(3);
      } else {
        toast.error("Please select if you are doing business");
      }
    } else if (currentStep === 3) {
      // Save financial form to "additional form for financial 3" collection
      try {
        const token = localStorage.getItem("token");
        if (token) {
          const financialData = {
            pan: data.pan,
            gst: data.gst,
            udyam: data.udyam,
            filedITR: data.filedITR,
            itrYears: data.itrYears,
            turnoverRange: data.turnoverRange,
            turnover1: data.turnover1,
            turnover2: data.turnover2,
            turnover3: data.turnover3,
            govtSchemes: data.govtSchemes,
            scheme1: data.scheme1 || "",
            scheme2: data.scheme2 || "",
            scheme3: data.scheme3 || ""
          };

          const response = await apiFetch("/members/profile", {
            method: 'PUT',
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(financialData)
          });

          if (!response.ok) {
            toast.error("Failed to save financial information");
            return;
          }

          toast.success("Financial information saved!");
          // Dispatch event to refresh profile completion
          window.dispatchEvent(new CustomEvent('formSubmitted'));
          window.dispatchEvent(new CustomEvent('profileUpdated'));
        }
      } catch (error) {
        console.error("Error saving financial form:", error);
        toast.error("Failed to save financial information");
        return;
      }

      saveCurrentStepData(data);
      setCurrentStep(4);
    }
  };

  const handleFinalSubmit = async () => {
    const data = watch();
    saveCurrentStepData(data);

    // The declaration is a real answer now, and it gates submission.
    if (!declarationAccepted) {
      toast.error("Please accept the declaration to submit your application");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (token) {
        // Save Step 4 to "additional form for declaration 4" collection
        const declarationData = {
          sisterConcerns: data.sisterConcerns || "",
          companyNames: companyNames.filter(name => name.trim() !== ""),
          /**
           * `agreeToDeclaration`, not `declarationAccepted`.
           *
           * `updateMember` reads the agreement as
           * `profileData.agreeToDeclaration || profileData.agreeToTerms || false`
           * — `declarationAccepted` is not one of the keys it looks at, so the
           * consent was recorded as `false` for every member who submitted from
           * this screen. Nothing errored, and the profile-completion bar (which
           * tests `agreeToDeclaration`) could never reach 100% as a result.
           */
          agreeToDeclaration: true
        };

        const response = await apiFetch("/members/profile", {
          method: 'PUT',
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(declarationData)
        });

        if (!response.ok) {
          toast.error("Failed to submit declaration");
          return;
        }
      }
    } catch (error) {
      console.error("Error saving declaration:", error);
      toast.error("Failed to submit application");
      return;
    }

    /**
     * Actually create the application.
     *
     * This function used to stop at the declaration save and then do this:
     *
     *     const applicationId = `APP-${Date.now()}-${Math.random()...}`;
     *     localStorage.setItem('applicationId', applicationId);
     *     navigate('/member/application-submitted');
     *
     * It invented an id on the client, said "Application submitted
     * successfully!", and showed the submitted screen — while never calling
     * `POST /applications`. No Application document was created, so the member
     * appeared in no admin queue at any tier and had no record of having
     * applied. Nothing errored anywhere; the only evidence was the applicant
     * never arriving.
     *
     * `DeclarationForm.tsx` was corrected for exactly this and carries the same
     * note; this screen — the one members actually reach from the dashboard —
     * was missed.
     *
     * The sections are read back from the server rather than from local state,
     * so the application carries what was really stored.
     */
    if (!(await createApplicationFromStoredForms())) return;

    navigate('/member/application-submitted');
  };

  /**
   * Create the application on the server, and remember the id it gives back.
   *
   * There were TWO submit paths on this screen. The business branch was
   * corrected to call `POST /applications`; the **aspirant** branch was not —
   * it invented `APP-${Date.now()}-${random}`, wrote it to localStorage, said
   * "Application submitted successfully!" and showed the submitted screen,
   * while never creating anything. An aspirant therefore appeared in no admin
   * queue at any tier, and because `ProfileContext` counts a submitted
   * application as a finished profile, their bar sat at 67% for ever with all
   * three forms filled in and nothing left to fill.
   *
   * Both branches now call this, so there is one definition of what submitting
   * means and neither can drift from the other again.
   *
   * Returns true when the application was created; the caller stops on false.
   */
  const createApplicationFromStoredForms = async (): Promise<boolean> => {
    try {
      const [profile, business, financial, declaration] = await Promise.all([
        getMyProfile().catch(() => ({} as any)),
        getBusinessInfo().catch(() => ({} as any)),
        getFinancialInfo().catch(() => ({} as any)),
        getDeclarationInfo().catch(() => ({} as any)),
      ]);

      // The region gate refuses an application whose block has no active admin,
      // so an incomplete personal step has to be caught with a message that
      // says what to do about it.
      if (!profile?.state || !profile?.district || !profile?.block) {
        toast.error("Please complete your personal details first — we need your region to route the application.");
        return false;
      }

      const isAspirant =
        business?.doingBusiness === false ||
        business?.doingBusiness === "no" ||
        business?.registrationType === "aspirant";

      const application = await submitApplication({
        applicationType: "membership",
        fullName: profile.fullName || "",
        email: profile.email || "",
        phone: profile.phoneNumber || "",
        state: profile.state,
        district: profile.district,
        block: profile.block,
        registrationType: isAspirant ? "aspirant" : "business",
        memberType: isAspirant ? "aspirant" : "business",
        data: {
          personalDetails: {
            fullName: profile.fullName || "",
            email: profile.email || "",
            phone: profile.phoneNumber || "",
            phoneNumber: profile.phoneNumber || "",
            state: profile.state,
            district: profile.district,
            block: profile.block,
            city: profile.city || "",
            religion: profile.religion || "",
            socialCategory: profile.socialCategory || "",
          },
          businessInfo: business || {},
          financialInfo: financial || {},
          declaration: declaration || {},
        },
      });

      // The server's own id, not a locally invented one — this is what the
      // status screen and every admin queue key off.
      const applicationId = application?._id || application?.id || "";
      if (applicationId) localStorage.setItem("applicationId", String(applicationId));
    } catch (error) {
      toast.error(errorMessage(error, "Failed to submit your application"));
      return false;
    }

    toast.success("Application submitted successfully!");

    // Dispatch events to refresh profile completion immediately
    window.dispatchEvent(new CustomEvent('formSubmitted'));
    window.dispatchEvent(new CustomEvent('profileUpdated'));

    return true;
  };

  const toggleBusinessType = (type: string) => {
    const currentTypes = watch("businessTypes") || [];
    const updated = currentTypes.includes(type)
      ? currentTypes.filter(t => t !== type)
      : [...currentTypes, type];
    return updated;
  };

  const toggleGovtOrg = (org: string) => {
    const currentOrgs = watch("govtOrgs") || [];
    const updated = currentOrgs.includes(org)
      ? currentOrgs.filter(o => o !== org)
      : [...currentOrgs, org];
    return updated;
  };

  /**
   * What this step is asking for.
   *
   * `getSubtitle()` was called here and defined nowhere — a ReferenceError the
   * moment the page mounted, so the whole profile form failed to render.
   */
  const getSubtitle = () => ({
    1: 'Step 1 of 4 — your personal details',
    2: 'Step 2 of 4 — your business details',
    3: 'Step 3 of 4 — your financial details',
    4: 'Step 4 of 4 — your declaration',
  }[currentStep] || 'Complete the four steps to submit your application');

  return (
    <MemberPageShell
      title="Profile Completion"
      subtitle={getSubtitle()}
      width="standard"
            sidebar={false}
    >
      <div className="relative">
        {/* Step Indicators */}
        <div className="mb-8 md:mb-10">
          <div className="flex items-center justify-center gap-3 md:gap-6 lg:gap-8 mb-4">
            {[1, 2, 3, 4].map((s, index) => (
              <div key={s} className="flex items-center gap-3 md:gap-6 lg:gap-8">
                <div
                  className="w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-2xl flex items-center justify-center font-bold text-base md:text-lg transition-all cursor-pointer hover:scale-105"
                  style={{
                    background: s < currentStep
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      : s === currentStep
                        ? 'linear-gradient(135deg, #0f766e 0%, #134e4a 100%)'
                        : '#e2e8f0',
                    color: s <= currentStep ? '#ffffff' : '#94a3b8',
                    boxShadow: s === currentStep ? '0 10px 25px -5px rgba(15, 118, 110, 0.4)' : 'none'
                  }}
                >
                  {s < currentStep ? <CheckCircle className="w-6 h-6 md:w-7 md:h-7" /> : s}
                </div>
                {index < 3 && (
                  <div
                    className="hidden md:block w-12 lg:w-20 h-1 rounded-full transition-all"
                    style={{
                      background: s < currentStep ? '#10b981' : '#e2e8f0'
                    }}
                  />
                )}
              </div>
            ))}
          </div>
          <p className="text-center text-sm md:text-base text-gray-500 font-medium">Step {currentStep} of 4</p>
        </div>

        <Card
          className="border-0 overflow-hidden"
          style={{
            borderRadius: '24px',
            boxShadow: '0 20px 60px -15px rgba(0, 0, 0, 0.12)'
          }}
        >
          <div
            className="py-6 md:py-8 px-6 md:px-10"
            style={{ background: 'linear-gradient(135deg, #0f766e 0%, #134e4a 100%)' }}
          >
            <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-white">ACTIV Membership</h2>
            <p className="text-teal-200 text-sm md:text-base mt-1">Complete your profile to apply for membership</p>
          </div>

          <CardContent className="p-6 md:p-8 lg:p-10">
            {isLocked && currentStep === 1 && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                <p className="text-sm text-green-800">
                  ✓ Profile saved successfully
                </p>
                <Button
                  type="button"
                  onClick={() => setIsLocked(false)}
                  variant="outline"
                  size="sm"
                  className="border-green-600 text-green-600 hover:bg-green-50"
                >
                  Edit Profile
                </Button>
              </div>
            )}

            {/*
              An account with no member record gets told so, instead of an
              empty form it can neither fill from nor save to.
            */}
            {noMemberRecord && (
              <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
                <h3 className="text-base font-semibold text-amber-900 mb-1">
                  This account has no member profile
                </h3>
                <p className="text-sm text-amber-800">
                  You are signed in with an administrator account, which is stored
                  separately from member records — so there are no personal details to
                  load here, and saving this form would not work. Use an admin dashboard
                  instead, or sign in with a member account to edit a member profile.
                </p>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg md:text-xl font-semibold mb-6 text-gray-800">Personal details</h3>
                  <div className="space-y-5 md:grid md:grid-cols-2 md:gap-6 md:space-y-0">
                    <div>
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        placeholder="Enter your full name"
                        {...register("name", { required: true })}
                        className="mt-1"
                        disabled={isLocked}
                      />
                      {errors.name && <p className="text-red-500 text-sm mt-1">Name is required</p>}
                    </div>

                    <div>
                      <Label htmlFor="state">State *</Label>
                      <Controller
                        name="state"
                        control={control}
                        rules={{ required: true }}
                        render={({ field }) => (
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value);
                              const currentData = watch();
                              reset({ ...currentData, state: value, district: '', block: '' });
                            }}
                            value={field.value}
                            disabled={isLocked}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select state" />
                            </SelectTrigger>
                            <SelectContent>
                              {states.map((state) => (
                                <SelectItem key={state} value={state}>
                                  {state}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {errors.state && <p className="text-red-500 text-sm mt-1">State is required</p>}
                    </div>

                    <div>
                      <Label htmlFor="district">District *</Label>
                      <Controller
                        name="district"
                        control={control}
                        rules={{ required: true }}
                        render={({ field }) => (
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value);
                              const currentData = watch();
                              reset({ ...currentData, district: value, block: '' });
                            }}
                            value={field.value}
                            disabled={!selectedState || isLocked}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder={selectedState ? "Select district" : "Select state first"} />
                            </SelectTrigger>
                            <SelectContent>
                              {districts.map((district) => (
                                <SelectItem key={district} value={district}>
                                  {district}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {errors.district && <p className="text-red-500 text-sm mt-1">District is required</p>}
                    </div>

                    <div>
                      <Label htmlFor="block">Block *</Label>
                      <Controller
                        name="block"
                        control={control}
                        rules={{ required: true }}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value} disabled={!selectedDistrict || isLocked}>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder={selectedDistrict ? "Select block" : "Select district first"} />
                            </SelectTrigger>
                            <SelectContent>
                              {blocks.length > 0 ? (
                                blocks.map((block) => (
                                  <SelectItem key={block} value={block}>
                                    {block}
                                  </SelectItem>
                                ))
                              ) : (
                                <div className="px-2 py-1.5 text-sm text-gray-500">No blocks available</div>
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {errors.block && <p className="text-red-500 text-sm mt-1">Block is required</p>}
                    </div>

                    <div>
                      <Label htmlFor="city">City *</Label>
                      <Input
                        id="city"
                        placeholder="Enter city"
                        {...register("city", { required: true })}
                        className="mt-1"
                        disabled={isLocked}
                      />
                      {errors.city && <p className="text-red-500 text-sm mt-1">City is required</p>}
                    </div>

                    <div>
                      <Label htmlFor="phone">Phone Number *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="Enter phone number"
                        {...register("phone", { required: true })}
                        className="mt-1"
                        disabled={isLocked}
                      />
                      {errors.phone && <p className="text-red-500 text-sm mt-1">Phone number is required</p>}
                    </div>

                    <div>
                      <Label htmlFor="email">Email ID *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="Enter email"
                        {...register("email", { required: true })}
                        className="mt-1"
                        disabled={isLocked}
                      />
                      {errors.email && <p className="text-red-500 text-sm mt-1">Email is required</p>}
                    </div>

                    <div>
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <PasswordInput
                        id="currentPassword"
                        placeholder="Enter your current login password"
                        autoComplete="current-password"
                        wrapperClassName="mt-1"
                        {...register("currentPassword")}
                        disabled={isLocked}
                      />
                      <p className="text-xs text-gray-500 mt-1">Required only if you want to change your password. Enter the password you use to login.</p>
                    </div>

                    <div>
                      <Label htmlFor="password">New Password</Label>
                      <PasswordInput
                        id="password"
                        placeholder="Enter new password (optional)"
                        autoComplete="new-password"
                        wrapperClassName="mt-1"
                        {...register("password")}
                        disabled={isLocked}
                      />
                      <p className="text-xs text-gray-500 mt-1">Leave blank to keep your current password.</p>
                    </div>

                    <div>
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <PasswordInput
                        id="confirmPassword"
                        placeholder="Confirm new password"
                        autoComplete="new-password"
                        wrapperClassName="mt-1"
                        {...register("confirmPassword")}
                        disabled={isLocked}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6 md:pt-8">
                  <h3 className="text-lg md:text-xl font-semibold mb-6 text-gray-800">Demographic details</h3>
                  <div className="space-y-4 md:grid md:grid-cols-2 md:gap-6 md:space-y-0">
                    <div>
                      <Label htmlFor="religion">Religion</Label>
                      <Input
                        id="religion"
                        placeholder="Enter religion"
                        {...register("religion")}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="socialCategory">Social Category</Label>
                      <Controller
                        name="socialCategory"
                        control={control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {SOCIAL_CATEGORIES.map((c) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6 md:pt-8">
                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={isLocked}
                    className="w-full py-5 rounded-xl font-semibold text-white"
                    style={{
                      background: isLocked
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                        : 'linear-gradient(135deg, #0f766e 0%, #134e4a 100%)',
                      boxShadow: isLocked ? 'none' : '0 8px 20px -4px rgba(15, 118, 110, 0.4)'
                    }}
                  >
                    {isLocked ? 'Profile Saved ✓' : 'Next'}
                  </Button>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-8">
                <h3 className="text-lg md:text-xl font-semibold mb-6 text-gray-800">Business Information</h3>

                <div>
                  <Label className="text-sm font-medium">Doing Business</Label>
                  <div className="flex gap-6 mt-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        value="yes"
                        {...register("doingBusiness", { required: true })}
                      />
                      <span>Yes</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        value="no"
                        {...register("doingBusiness", { required: true })}
                      />
                      <span>No</span>
                    </label>
                  </div>
                </div>

                {watch("doingBusiness") === "yes" && (
                  <>
                    <div>
                      <Label htmlFor="organization">Name of the Organization</Label>
                      <Input
                        id="organization"
                        placeholder="Enter organization name"
                        {...register("organization")}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="constitution">Constitution of the Company</Label>
                      <Controller
                        name="constitution"
                        control={control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select constitution type" />
                            </SelectTrigger>
                            <SelectContent>
                              {CONSTITUTION_TYPES.map((c) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div>
                      <Label>Type of Business</Label>
                      <div className="mt-2 space-y-2">
                        {BUSINESS_TYPE_OPTIONS.map((type) => (
                          <label key={type} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              value={type}
                              checked={watch("businessTypes")?.includes(type)}
                              onChange={(e) => {
                                const updated = toggleBusinessType(type);
                                reset({ ...watch(), businessTypes: updated });
                              }}
                            />
                            <span>{type}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="businessActivities">Business Activities</Label>
                      <textarea
                        id="businessActivities"
                        placeholder="Describe your business activities"
                        {...register("businessYear")}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md min-h-[100px]"
                      />
                    </div>

                    <div>
                      <Label htmlFor="businessYear">Business Commencement Year</Label>
                      <Controller
                        name="businessYear"
                        control={control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select year" />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 50 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                                <SelectItem key={year} value={year.toString()}>
                                  {year}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div>
                      <Label htmlFor="employees">Number of Employees</Label>
                      <Input
                        id="employees"
                        type="number"
                        placeholder="Enter number of employees"
                        {...register("employees")}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Member of any other Chamber/Association</Label>
                      <div className="flex gap-6 mt-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            value="yes"
                            {...register("chamber")}
                          />
                          <span>Yes</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            value="no"
                            {...register("chamber")}
                          />
                          <span>No</span>
                        </label>
                      </div>
                    </div>

                    {watch("chamber") === "yes" && (
                      <div>
                        <textarea
                          placeholder="Please specify chamber/association details"
                          {...register("chamberDetails")}
                          className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md min-h-[80px]"
                        />
                      </div>
                    )}

                    <div>
                      <Label>Registered with Govt. Organization</Label>
                      <div className="mt-2 space-y-2">
                        {["MSME", "KVIC", "NABARD", "None", "Others"].map((org) => (
                          <label key={org} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              value={org}
                              checked={watch("govtOrgs")?.includes(org)}
                              onChange={(e) => {
                                const updated = toggleGovtOrg(org);
                                reset({ ...watch(), govtOrgs: updated });
                              }}
                            />
                            <span>{org}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {watch("doingBusiness") === "no" && (
                  <>
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                      <div className="flex items-start gap-3">
                        <div className="text-blue-600 mt-1">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-semibold text-blue-900 mb-1">Registering as Aspirant</h4>
                          <p className="text-sm text-blue-800">
                            You are registering as an Aspirant (Student / Non-business member). Financial information is not required.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 bg-amber-50 border-2 border-amber-200 rounded-xl">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="text-amber-600 mt-1">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-amber-900 mb-2">Declaration</h4>
                          <p className="text-sm text-amber-800 mb-3">
                            This application is under the Verification and Screening Process. We have every right to ACCEPT or REJECT this application according to our membership policy.
                          </p>
                          <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
                            <input
                              type="checkbox"
                              {...register("declarationAccepted")}
                              className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label className="text-sm text-gray-700">
                              I hereby declare that all the information provided above is true and correct to the best of my knowledge. I understand that providing false information may result in rejection of my application.
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="border-t pt-6 md:pt-8 flex gap-4">
                  <Button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="flex-1 bg-white border-2 border-teal-600 text-teal-600 hover:bg-teal-50 py-5 rounded-xl font-semibold"
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    onClick={handleNext}
                    className="flex-1 py-5 rounded-xl font-semibold text-white"
                    style={{
                      background: 'linear-gradient(135deg, #0f766e 0%, #134e4a 100%)',
                      boxShadow: '0 8px 20px -4px rgba(15, 118, 110, 0.4)'
                    }}
                  >
                    Next →
                  </Button>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-8">
                <h3 className="text-lg md:text-xl font-semibold mb-6 text-gray-800">Financial & Compliance Information</h3>

                <div className="space-y-5 md:grid md:grid-cols-2 md:gap-6 md:space-y-0">
                  <div>
                    <Label htmlFor="pan">PAN Number</Label>
                    <Input
                      id="pan"
                      placeholder="Enter PAN number"
                      {...register("pan")}
                      className="mt-1"
                      maxLength={10}
                    />
                    <p className="text-xs text-gray-500 mt-1">Validate PAN Number (10 chars Alphanumeric)</p>
                  </div>

                  <div>
                    <Label htmlFor="gst">GST Number</Label>
                    <Input
                      id="gst"
                      placeholder="Enter GST number"
                      {...register("gst")}
                      className="mt-1"
                      maxLength={15}
                    />
                    <p className="text-xs text-gray-500 mt-1">Validate GSTIN Number (15 chars)</p>
                  </div>

                  <div>
                    <Label htmlFor="udyam">Udyam Number</Label>
                    <Input
                      id="udyam"
                      placeholder="Enter Udyam number"
                      {...register("udyam")}
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">Optional</p>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Filed Income Tax Returns</Label>
                    <div className="flex gap-6 mt-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="yes"
                          {...register("filedITR")}
                        />
                        <span>Yes</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="no"
                          {...register("filedITR")}
                        />
                        <span>No</span>
                      </label>
                    </div>
                  </div>

                  {watch("filedITR") === "yes" && (
                    <div>
                      <Label htmlFor="itrYears">How many continuous years have you filed ITR?</Label>
                      <Input
                        id="itrYears"
                        type="number"
                        placeholder="Enter number of years"
                        {...register("itrYears")}
                        className="mt-1"
                      />
                    </div>
                  )}

                  <div>
                    <Label htmlFor="turnoverRange">Turnover</Label>
                    <Controller
                      name="turnoverRange"
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select turnover range" />
                          </SelectTrigger>
                          <SelectContent>
                            {TURNOVER_RANGES.map((r) => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-3 block">Turnover for Last 3 Yrs</Label>

                    <div className="space-y-4">
                      <div>
                        <Input
                          placeholder="Enter turnover amount"
                          {...register("turnover1")}
                          className="mt-1"
                        />
                        <p className="text-xs text-gray-500 mt-1">FY 2024-25</p>
                      </div>

                      <div>
                        <Input
                          placeholder="Enter turnover amount"
                          {...register("turnover2")}
                          className="mt-1"
                        />
                        <p className="text-xs text-gray-500 mt-1">FY 2023-24</p>
                      </div>

                      <div>
                        <Input
                          placeholder="Enter turnover amount"
                          {...register("turnover3")}
                          className="mt-1"
                        />
                        <p className="text-xs text-gray-500 mt-1">FY 2022-23</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Have you got benefitted through any Govt. Schemes to your Business?</Label>
                    <div className="flex gap-6 mt-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="yes"
                          {...register("govtSchemes")}
                        />
                        <span>Yes</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="no"
                          {...register("govtSchemes")}
                        />
                        <span>No</span>
                      </label>
                    </div>
                  </div>

                  {watch("govtSchemes") === "yes" && (
                    <div className="space-y-3">
                      <Input
                        placeholder="Scheme 1"
                        {...register("scheme1")}
                        className="mt-1"
                      />
                      <Input
                        placeholder="Scheme 2"
                        {...register("scheme2")}
                        className="mt-1"
                      />
                      <Input
                        placeholder="Scheme 3"
                        {...register("scheme3")}
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>

                <div className="border-t pt-6 md:pt-8 flex gap-4">
                  <Button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="flex-1 bg-white border-2 border-teal-600 text-teal-600 hover:bg-teal-50 py-5 rounded-xl font-semibold"
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    onClick={handleNext}
                    className="flex-1 py-5 rounded-xl font-semibold text-white"
                    style={{
                      background: 'linear-gradient(135deg, #0f766e 0%, #134e4a 100%)',
                      boxShadow: '0 8px 20px -4px rgba(15, 118, 110, 0.4)'
                    }}
                  >
                    Next →
                  </Button>
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-8">
                <h3 className="text-lg md:text-xl font-semibold mb-6 text-gray-800">Declaration</h3>

                <div>
                  <Label htmlFor="sisterConcerns">No. of Sister Concerns</Label>
                  <Input
                    id="sisterConcerns"
                    type="number"
                    placeholder="Enter number"
                    min={0}
                    {...register("sisterConcerns")}
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">Positive integers only</p>
                </div>

                <div>
                  <Label htmlFor="companyNames">Name(s) of Company</Label>
                  {showSeparateFields ? (
                    <div className="space-y-3 mt-2">
                      {companyNames.map((_, index) => (
                        <Input
                          key={index}
                          placeholder={`Enter company name ${index + 1}`}
                          value={companyNames[index]}
                          onChange={(e) => {
                            const updated = [...companyNames];
                            updated[index] = e.target.value;
                            setCompanyNames(updated);
                          }}
                          className="mt-1"
                        />
                      ))}
                    </div>
                  ) : (
                    <Input
                      id="companyNames"
                      placeholder="Enter company name"
                      {...register("companyNames")}
                      className="mt-1"
                    />
                  )}

                  <Button
                    type="button"
                    onClick={() => setCompanyNames([...companyNames, ""])}
                    className="mt-3 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  >
                    Add Another Company
                  </Button>

                  <div className="mt-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={showSeparateFields}
                        onChange={(e) => setShowSeparateFields(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-600">Show one field per name entered above</span>
                    </label>
                  </div>
                </div>

                <div className="border-t pt-6 md:pt-8">
                  <div className="p-5 md:p-6 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl">
                    <Label className="text-base md:text-lg font-semibold mb-3 block text-amber-900">Declaration</Label>
                    <p className="text-sm md:text-base text-amber-800 mb-4">
                      This application is under the Verification and Screening Process. We have every right to ACCEPT or REJECT this application according to our membership policy.
                    </p>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={declarationAccepted}
                        onChange={(e) => setDeclarationAccepted(e.target.checked)}
                        className="mt-1 w-4 h-4 accent-amber-600"
                      />
                      <span className="text-sm md:text-base font-medium text-amber-900">
                        I confirm the above information is true and correct
                        <span className="text-red-600 ml-0.5">*</span>
                      </span>
                    </label>
                  </div>
                </div>

                <div className="border-t pt-6 md:pt-8 flex gap-4">
                  <Button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="flex-1 py-5 rounded-xl font-semibold border-2"
                    style={{ borderColor: '#0f766e', color: '#0f766e', background: 'transparent' }}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    onClick={handleFinalSubmit}
                    className="flex-1 py-5 rounded-xl font-semibold text-white"
                    style={{
                      background: 'linear-gradient(135deg, #0f766e 0%, #134e4a 100%)',
                      boxShadow: '0 8px 20px -4px rgba(15, 118, 110, 0.4)'
                    }}
                  >
                    Submit Application
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MemberPageShell>
  );
}
