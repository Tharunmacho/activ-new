import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Phone, Users } from "lucide-react";
import { toast } from "sonner";
import RegistrationFormShell, { FormCard, FormField, FormGrid } from "./RegistrationFormShell";
import {
  getMyProfile,
  updateProfile,
  getStates,
  getDistricts,
  getBlocks,
  errorMessage,
} from "@/services/activApi";

/** The options mobile's Personal Details screen offers, in its order. */
const RELIGION_OPTIONS = [
  "Hinduism",
  "Christianity",
  "Islam",
  "Sikhism",
  "Buddhism",
  "Jainism",
  "Others",
];

const SOCIAL_CATEGORY_OPTIONS = [
  "Christian ST",
  "Christian SC",
  "ST",
  "SC",
  "Others",
];

interface PersonalFormData {
  /** `fullName`, not `name` — this is the field name the backend stores. */
  fullName: string;
  phoneNumber: string;
  email: string;
  state: string;
  district: string;
  block: string;
  city: string;
  religion: string;
  socialCategory: string;
}

const PersonalInformationForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<PersonalFormData>({
    fullName: "",
    phoneNumber: "",
    email: "",
    state: "",
    district: "",
    block: "",
    city: "",
    religion: "",
    socialCategory: "",
  });

  const [states, setStates] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<string[]>([]);
  /**
   * False when the platform has no staffed region at all. That is a different
   * thing from "the request failed", and the two need different messages.
   */
  const [coverageAvailable, setCoverageAvailable] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadFormData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Region options come from the API, never from a bundled list.
   *
   * Which regions exist is decided by which admins are staffed: a block with no
   * admin must not be offered, because an application submitted into it would
   * land in nobody's queue and could never be reviewed.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getStates();
        if (cancelled) return;
        setStates((result.states || []).map((s) => s.name));
        setCoverageAvailable(result.coverageAvailable !== false);
      } catch (error) {
        if (!cancelled) console.warn("Could not load states:", error);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!formData.state) {
        setDistricts([]);
        return;
      }
      try {
        const result = await getDistricts(formData.state);
        if (!cancelled) setDistricts((result.districts || []).map((d) => d.name));
      } catch (error) {
        if (!cancelled) console.warn("Could not load districts:", error);
      }
    })();
    return () => { cancelled = true; };
  }, [formData.state]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!formData.state || !formData.district) {
        setBlocks([]);
        return;
      }
      try {
        const result = await getBlocks(formData.state, formData.district);
        if (!cancelled) setBlocks((result.blocks || []).map((b) => b.name));
      } catch (error) {
        if (!cancelled) console.warn("Could not load blocks:", error);
      }
    })();
    return () => { cancelled = true; };
  }, [formData.state, formData.district]);

  /**
   * Load the member's saved personal details.
   *
   * One call: `/members/my-profile` already returns the personal fields.
   * `isLocked` comes back true once the form has been submitted, and the server
   * is the authority on that — a client-side guess would let a locked form be
   * edited and then silently rejected.
   */
  const loadFormData = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      const profile = await getMyProfile();

      if (profile && (profile.fullName || profile.email)) {
        setFormData({
          fullName: profile.fullName || "",
          phoneNumber: profile.phoneNumber || "",
          email: profile.email || "",
          state: profile.state || "",
          district: profile.district || "",
          block: profile.block || "",
          city: profile.city || "",
          religion: profile.religion || "",
          socialCategory: profile.socialCategory || "",
        });

        setIsLocked(profile.isLocked === true);
      }
    } catch (error) {
      console.warn("Could not load personal details:", error);
      toast.error(errorMessage(error, "Could not load your details"));
    }
  };

  /**
   * Changing a parent clears its children rather than auto-picking the first
   * option — the same rule mobile applies. Auto-picking silently moves the
   * member to a region they never chose, and their application follows them.
   */
  const setField = (field: keyof PersonalFormData, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "state") {
        next.district = "";
        next.block = "";
      } else if (field === "district") {
        next.block = "";
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLocked) {
      toast.error("Form is locked and cannot be edited");
      return;
    }

    if (
      !formData.fullName ||
      !formData.phoneNumber ||
      !formData.email ||
      !formData.state ||
      !formData.district ||
      !formData.block ||
      !formData.city ||
      !formData.religion ||
      !formData.socialCategory
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      // Sent with the backend's own field names. `updateProfile` routes each
      // group of fields to its own collection and mirrors the personal details
      // onto the member's application, so the admin queues stay in step.
      await updateProfile(formData);

      toast.success("Personal information saved");
      window.dispatchEvent(new Event("formSubmitted"));

      // Advance to step 2, as mobile does — it navigates straight to
      // `BusinessInformationForm`. Returning to the dashboard here is what made
      // a four-step application impossible to walk through.
      navigate("/member/forms/business");
    } catch (error) {
      // The region gate rejects a district or block with no active admin, and
      // its message names the region — worth showing verbatim rather than
      // replacing with a generic failure.
      toast.error(errorMessage(error, "Failed to save your details"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RegistrationFormShell
      step={1}
      title="Complete Your Profile"
      description="Personal Details — Step 1 of 4"
      submitLabel="Next"
      submitting={submitting}
      disabled={isLocked}
      onSubmit={handleSubmit}
    >
      {!coverageAvailable && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No region on the platform currently has an active block admin, so there is
          nothing to select yet. An administrator has to open a region before an
          application can be routed.
        </div>
      )}

      {/* Mirrors mobile's "Location Information" card. */}
      <FormCard
        icon={MapPin}
        title="Location Information"
        subtitle="Tell us where your business is located"
      >
        <FormGrid>
          <FormField label="State" required>
            <Select value={formData.state} onValueChange={(v) => setField("state", v)}>
              <SelectTrigger className="h-11 border-slate-200 focus:ring-blue-500">
                <SelectValue placeholder="Select State" />
              </SelectTrigger>
              <SelectContent>
                {states.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            label="District"
            required
            hint={!formData.state ? "Choose a state first" : undefined}
          >
            <Select
              value={formData.district}
              onValueChange={(v) => setField("district", v)}
              disabled={!formData.state}
            >
              <SelectTrigger className="h-11 border-slate-200 focus:ring-blue-500">
                <SelectValue placeholder="Select District" />
              </SelectTrigger>
              <SelectContent>
                {districts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            label="Block"
            required
            hint={!formData.district ? "Choose a district first" : undefined}
          >
            <Select
              value={formData.block}
              onValueChange={(v) => setField("block", v)}
              disabled={!formData.district}
            >
              <SelectTrigger className="h-11 border-slate-200 focus:ring-blue-500">
                <SelectValue placeholder="Select Block" />
              </SelectTrigger>
              <SelectContent>
                {blocks.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="City" required>
            <Input
              value={formData.city}
              onChange={(e) => setField("city", e.target.value)}
              placeholder="Enter City Name"
              className="h-11 border-slate-200 focus-visible:ring-blue-500"
            />
          </FormField>
        </FormGrid>
      </FormCard>

      {/* Mirrors mobile's "Contact Information" card. */}
      <FormCard
        icon={Phone}
        title="Contact Information"
        subtitle="We'll use this to reach you"
      >
        <FormGrid>
          <FormField label="Full Name" required full>
            <Input
              value={formData.fullName}
              onChange={(e) => setField("fullName", e.target.value)}
              placeholder="Enter Full Name"
              autoComplete="name"
              className="h-11 border-slate-200 focus-visible:ring-blue-500"
            />
          </FormField>

          <FormField label="Phone Number" required>
            <Input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={formData.phoneNumber}
              onChange={(e) => setField("phoneNumber", e.target.value)}
              placeholder="Enter Phone Number"
              className="h-11 border-slate-200 focus-visible:ring-blue-500"
            />
          </FormField>

          <FormField label="Email Address" required>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setField("email", e.target.value)}
              placeholder="Enter Email Address"
              className="h-11 border-slate-200 focus-visible:ring-blue-500"
            />
          </FormField>
        </FormGrid>
      </FormCard>

      {/* Mirrors mobile's "Demographic Information" card. */}
      <FormCard
        icon={Users}
        title="Demographic Information"
        subtitle="Help us know you better"
      >
        <FormGrid>
          <FormField label="Religion" required>
            <Select value={formData.religion} onValueChange={(v) => setField("religion", v)}>
              <SelectTrigger className="h-11 border-slate-200 focus:ring-blue-500">
                <SelectValue placeholder="Select Religion" />
              </SelectTrigger>
              <SelectContent>
                {RELIGION_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Social Category" required>
            <Select
              value={formData.socialCategory}
              onValueChange={(v) => setField("socialCategory", v)}
            >
              <SelectTrigger className="h-11 border-slate-200 focus:ring-blue-500">
                <SelectValue placeholder="Select Social Category" />
              </SelectTrigger>
              <SelectContent>
                {SOCIAL_CATEGORY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
        </FormGrid>
      </FormCard>
    </RegistrationFormShell>
  );
};

export default PersonalInformationForm;
