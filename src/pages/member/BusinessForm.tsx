import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Briefcase, Building2, Landmark } from "lucide-react";
import { toast } from "sonner";
import RegistrationFormShell, { FormCard, FormField, FormGrid } from "./RegistrationFormShell";
import { getBusinessInfo, updateProfile, submitApplication, errorMessage } from "@/services/activApi";

/** The three option lists mobile's Business Information screen offers. */
const CONSTITUTION_TYPES = ['OPC', 'TRUST', 'SOCIETY', 'Proprietorship', 'Partnership', 'Private Limited'];
const BUSINESS_TYPES = ['Manufacturing', 'Trader', 'Service Provider', 'Others'];
const GOVT_ORGANIZATIONS = ['MSME', 'KVIC', 'NABARD', 'None', 'Others'];

/**
 * `doingBusiness` and `memberOfOtherChamber` are Booleans on `BusinessInfo`;
 * these controls hold strings. Both directions were wrong.
 *
 * Reading: a saved `false` was spread straight into state, and every control
 * compares `=== "no"`, so an aspirant reopened the form with nothing selected.
 *
 * Writing: the controller derives `registrationType` from
 * `doingBusiness ? 'business' : 'aspirant'`. `"no"` is a non-empty string and
 * therefore truthy, so an aspirant was stored as `doingBusiness: false` — the
 * cast worked — but `registrationType: 'business'`. One document, two answers,
 * and the admin queues read the wrong one.
 */
const toChoice = (value: unknown): string => {
  if (value === true || value === 'yes') return 'yes';
  if (value === false || value === 'no') return 'no';
  return '';
};

const toBool = (choice: string): boolean | undefined =>
  choice === 'yes' ? true : choice === 'no' ? false : undefined;

interface BusinessFormData {
  doingBusiness: string;
  organizationName: string;
  constitutionType: string;
  businessTypes: string[];
  businessActivities: string;
  businessCommencementYear: string;
  numberOfEmployees: string;
  memberOfOtherChamber: string;
  otherChamber: string;
  govtOrganizations: string[];
}

/** A selectable pill, matching mobile's `pillButton`. */
const Pill = ({
  label, selected, onClick,
}: { label: string; selected: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${selected
      ? "bg-blue-600 text-white border-blue-600"
      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
      }`}
  >
    {label}
  </button>
);

/** A yes / no pair, matching mobile's two-pill choice. */
const YesNo = ({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) => (
  <div className="flex gap-2">
    <Pill label="Yes" selected={value === "yes"} onClick={() => onChange("yes")} />
    <Pill label="No" selected={value === "no"} onClick={() => onChange("no")} />
  </div>
);

const BusinessInformationForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<BusinessFormData>({
    doingBusiness: "",
    organizationName: "",
    constitutionType: "",
    businessTypes: [],
    businessActivities: "",
    businessCommencementYear: "",
    numberOfEmployees: "",
    memberOfOtherChamber: "",
    otherChamber: "",
    govtOrganizations: [],
  });

  /** Only shown to an aspirant, exactly as on mobile. */
  const [agreeToDeclaration, setAgreeToDeclaration] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadFormData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFormData = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      // Returns the saved values, or documented defaults when nothing has been
      // filled in yet — it never 404s on an empty form.
      const saved = await getBusinessInfo();

      if (saved && Object.keys(saved).length > 0) {
        setFormData((current) => ({
          ...current,
          ...saved,
          doingBusiness: toChoice((saved as any).doingBusiness),
          memberOfOtherChamber: toChoice((saved as any).memberOfOtherChamber),
        }));
      }
    } catch (error) {
      console.warn("Could not load business details:", error);
      toast.error(errorMessage(error, "Failed to load form data"));
    }
  };

  const setField = (field: keyof BusinessFormData, value: any) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const toggleIn = (field: 'businessTypes' | 'govtOrganizations', value: string) =>
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v) => v !== value)
        : [...prev[field], value],
    }));

  const isAspirant = formData.doingBusiness === "no";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.doingBusiness) {
      toast.error("Please select whether you are currently doing business");
      return;
    }

    /**
     * Aspirant path — the branch mobile takes when `doingBusiness === false`.
     *
     * It is a *terminal* step: an applicant with no business has nothing to say
     * on the Financial or Declaration forms, so mobile writes the profile, POSTs
     * the application and lands on the submitted screen. The website used to
     * save and stop, leaving the application never actually submitted.
     */
    if (isAspirant) {
      if (!agreeToDeclaration) {
        toast.error("Please accept the declaration to continue");
        return;
      }

      setSubmitting(true);
      try {
        const aspirantData = {
          doingBusiness: false,
          registrationType: 'aspirant',
          memberOfOtherChamber: false,
          govtOrganizations: [],
          submittedAt: new Date().toISOString(),
        };

        await updateProfile(aspirantData);
        await submitApplication(aspirantData);

        window.dispatchEvent(new Event('formSubmitted'));
        navigate('/member/application-submitted');
      } catch (error) {
        toast.error(errorMessage(error, "Failed to submit aspirant registration"));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Active business validation, as on mobile.
    if (!formData.organizationName.trim()) {
      toast.error("Organization name is required");
      return;
    }
    if (!formData.constitutionType) {
      toast.error("Please select a Constitution Type");
      return;
    }

    setSubmitting(true);
    try {
      /**
       * Real Booleans, and nothing that cannot be cast.
       *
       * An unanswered choice is `""`, which Mongoose cannot cast to Boolean —
       * it threw a ValidationError and the request came back 500 with no usable
       * message. The guard above already refuses to submit without an answer,
       * but the payload no longer depends on that being the only path in.
       */
      const payload: Record<string, any> = { ...formData, doingBusiness: true };

      const chamber = toBool(formData.memberOfOtherChamber);
      if (chamber === undefined) delete payload.memberOfOtherChamber;
      else payload.memberOfOtherChamber = chamber;

      await updateProfile(payload);

      toast.success("Business information saved");
      window.dispatchEvent(new Event('formSubmitted'));

      // Advance to step 3, as mobile does.
      navigate("/member/forms/financial");
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save your business details"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RegistrationFormShell
      step={2}
      title="Business Information"
      description="Business Details — Step 2 of 4"
      previousTo="/member/forms/personal"
      submitLabel={isAspirant ? "Submit" : "Next"}
      submitting={submitting}
      onSubmit={handleSubmit}
    >
      <FormCard
        icon={Briefcase}
        title="Business Status"
        subtitle="This decides the rest of your application"
      >
        <FormField label="Are you currently doing business?" required>
          <YesNo value={formData.doingBusiness} onChange={(v) => setField("doingBusiness", v)} />
        </FormField>

        {isAspirant && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-blue-900 mb-3">
              You are registering as an <strong>aspirant</strong>. There is nothing further
              to fill in — accepting the declaration below submits your application.
            </p>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreeToDeclaration}
                onChange={(e) => setAgreeToDeclaration(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm text-slate-700">
                I declare that the information provided is true and correct to the best
                of my knowledge.
              </span>
            </label>
          </div>
        )}
      </FormCard>

      {/* Everything below applies only to an active business, matching mobile. */}
      {formData.doingBusiness === "yes" && (
        <>
          <FormCard
            icon={Building2}
            title="Organization Details"
            subtitle="Tell us about your business"
          >
            <FormGrid>
              <FormField label="Organization Name" required full>
                <Input
                  value={formData.organizationName}
                  onChange={(e) => setField("organizationName", e.target.value)}
                  placeholder="Enter organization name"
                  className="h-11 border-slate-200 focus-visible:ring-blue-500"
                />
              </FormField>

              <FormField label="Constitution Type" required full>
                <div className="flex flex-wrap gap-2">
                  {CONSTITUTION_TYPES.map((type) => (
                    <Pill
                      key={type}
                      label={type}
                      selected={formData.constitutionType === type}
                      onClick={() => setField("constitutionType", type)}
                    />
                  ))}
                </div>
              </FormField>

              <FormField label="Business Types" full hint="Select all that apply">
                <div className="flex flex-wrap gap-2">
                  {BUSINESS_TYPES.map((type) => (
                    <Pill
                      key={type}
                      label={type}
                      selected={formData.businessTypes.includes(type)}
                      onClick={() => toggleIn("businessTypes", type)}
                    />
                  ))}
                </div>
              </FormField>

              <FormField label="Business Commencement Year">
                <Input
                  inputMode="numeric"
                  maxLength={4}
                  value={formData.businessCommencementYear}
                  onChange={(e) => setField("businessCommencementYear", e.target.value)}
                  placeholder="e.g. 2018"
                  className="h-11 border-slate-200 focus-visible:ring-blue-500"
                />
              </FormField>

              <FormField label="Number of Employees">
                <Input
                  inputMode="numeric"
                  value={formData.numberOfEmployees}
                  onChange={(e) => setField("numberOfEmployees", e.target.value)}
                  placeholder="e.g. 25"
                  className="h-11 border-slate-200 focus-visible:ring-blue-500"
                />
              </FormField>

              <FormField label="Business Activities" full>
                <Textarea
                  value={formData.businessActivities}
                  onChange={(e) => setField("businessActivities", e.target.value)}
                  placeholder="Describe what your business does"
                  className="min-h-[100px] border-slate-200 focus-visible:ring-blue-500"
                />
              </FormField>
            </FormGrid>
          </FormCard>

          <FormCard
            icon={Landmark}
            title="Memberships & Affiliations"
            subtitle="Other chambers and government bodies you are registered with"
          >
            <FormField label="Are you a member of another chamber?">
              <YesNo
                value={formData.memberOfOtherChamber}
                onChange={(v) => setField("memberOfOtherChamber", v)}
              />
            </FormField>

            {formData.memberOfOtherChamber === "yes" && (
              <FormField label="Which chamber?">
                <Input
                  value={formData.otherChamber}
                  onChange={(e) => setField("otherChamber", e.target.value)}
                  placeholder="Name the chamber"
                  className="h-11 border-slate-200 focus-visible:ring-blue-500"
                />
              </FormField>
            )}

            <FormField label="Government Organizations" hint="Select all that apply">
              <div className="flex flex-wrap gap-2">
                {GOVT_ORGANIZATIONS.map((org) => (
                  <Pill
                    key={org}
                    label={org}
                    selected={formData.govtOrganizations.includes(org)}
                    onClick={() => toggleIn("govtOrganizations", org)}
                  />
                ))}
              </div>
            </FormField>
          </FormCard>
        </>
      )}
    </RegistrationFormShell>
  );
};

export default BusinessInformationForm;
