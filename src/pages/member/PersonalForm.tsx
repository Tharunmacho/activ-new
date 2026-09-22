import { useState, useEffect, useMemo } from "react";
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
import {
  SOCIAL_CATEGORIES,
  GENDERS,
  religionsFor,
  normalizeReligion,
} from "@/lib/memberFormOptions";

interface PersonalFormData {
  /** `fullName`, not `name` — this is the field name the backend stores. */
  fullName: string;
  phoneNumber: string;
  email: string;
  state: string;
  district: string;
  block: string;
  city: string;
  socialCategory: string;
  religion: string;
  gender: string;
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
    socialCategory: "",
    religion: "",
    gender: "",
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
          socialCategory: profile.socialCategory || "",
          // Old spellings — "Hindu", "hindu", "HINDU" — are mapped onto the
          // list's current wording, so a returning member is not handed a blank
          // select and asked to answer a question they already answered.
          // Anything with no equivalent comes back '' and has to be re-picked
          // — see `normalizeReligion`.
          religion: normalizeReligion(profile.religion),
          gender: profile.gender || "",
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
      } else if (field === "socialCategory") {
        /*
          Social category narrows the religions on offer, so a category change
          can leave behind a religion the new category does not admit.

          Cleared rather than re-picked. Choosing the first allowed religion for
          them would record an answer the applicant never gave, on a question
          about their own faith — the same reason the region selects above clear
          their children instead of auto-picking.

          Only cleared when it is actually incompatible: switching between two
          categories that both allow Hindu must not wipe a Hindu answer.
        */
        if (next.religion && !religionsFor(value).includes(next.religion)) {
          next.religion = "";
        }
      }
      return next;
    });
  };

  /**
   * The religions this applicant's social category admits.
   *
   * Memoised because it is read three times in one render — the hint, the
   * `length` test in it, and the option list — and recomputing a fresh array
   * each time would give `SelectContent` a new `key` identity on every
   * keystroke elsewhere in the form.
   */
  const allowedReligions = useMemo(
    () => religionsFor(formData.socialCategory),
    [formData.socialCategory],
  );

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
      !formData.socialCategory ||
      !formData.religion ||
      !formData.gender
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
      description="Personal Details — Step 1 of 3"
      submitLabel="Next"
      submitting={submitting}
      disabled={isLocked}
      onSubmit={handleSubmit}
    >
      {!coverageAvailable && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-[1.1875rem] text-amber-800">
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

      {/*
        DEMOGRAPHIC INFORMATION — three fields, and the order is the point.

        Social category comes first because it DECIDES the second: the religions
        on offer depend on it, and a religion box that silently rewrites itself
        after the category is answered reads as the form losing an answer. Asked
        in this order there is nothing to rewrite.
      */}
      <FormCard
        icon={Users}
        title="Demographic Information"
        subtitle="Help us know you better"
      >
        <FormGrid>
          <FormField
            label="Social Category"
            required
          >
            <Select
              value={formData.socialCategory}
              onValueChange={(v) => setField("socialCategory", v)}
            >
              <SelectTrigger className="h-11 border-slate-200 focus:ring-blue-500">
                <SelectValue placeholder="Select Social Category" />
              </SelectTrigger>
              <SelectContent>
                {SOCIAL_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>

          {/*
            Religion, narrowed by the category above.

            Scheduled Caste status is confined to Hindu, Sikh and Buddhist, so
            an SC applicant is shown those three and nothing else — offering the
            other two offers a combination that cannot be true.

            Disabled until the category is answered rather than showing all five
            and shrinking the list afterwards. An applicant who picks Muslim and
            then picks SC would watch their answer disappear with no explanation;
            this way the question is simply not open yet, and the hint says why.
          */}
          <FormField
            label="Religion"
            required
            /*
              The list narrowing itself is the message.
              A note under the field announcing that it had narrowed said
              nothing the shortened dropdown did not already show, and it named
              the category back at the person who had just picked it. Only the
              prompt that is genuinely useful survives: the one explaining why
              the field is still disabled.
            */
            hint={!formData.socialCategory ? "Choose a social category first" : undefined}
          >
            <Select
              value={formData.religion}
              onValueChange={(v) => setField("religion", v)}
              disabled={!formData.socialCategory}
            >
              <SelectTrigger className="h-11 border-slate-200 focus:ring-blue-500">
                <SelectValue placeholder="Select Religion" />
              </SelectTrigger>
              <SelectContent>
                {allowedReligions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Gender" required>
            <Select value={formData.gender} onValueChange={(v) => setField("gender", v)}>
              <SelectTrigger className="h-11 border-slate-200 focus:ring-blue-500">
                <SelectValue placeholder="Select Gender" />
              </SelectTrigger>
              <SelectContent>
                {GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
        </FormGrid>
      </FormCard>
    </RegistrationFormShell>
  );
};

export default PersonalInformationForm;
