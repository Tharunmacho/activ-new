import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileText, TrendingUp, Landmark } from "lucide-react";
import { toast } from "sonner";
import RegistrationFormShell, { FormCard, FormField, FormGrid } from "./RegistrationFormShell";
import { getFinancialInfo, updateProfile, errorMessage } from "@/services/activApi";

/**
 * The six ranges `MemberFinancialInfo.turnoverRange` accepts, verbatim.
 *
 * Spelling matters down to the spaces: the schema says "50 Lakhs - 1 Crore",
 * and this form used to send "50 Lakhs-1 Crore", which is a different string
 * and a failed save.
 */
const TURNOVER_RANGES = [
  'Below 1 Lakh',
  '1-5 Lakhs',
  '5-10 Lakhs',
  '10-50 Lakhs',
  '50 Lakhs - 1 Crore',
  'Above 1 Crore',
];

/** The scheme list the mobile form offers, in its order. */
const GOVT_SCHEMES = [
  'Startup India',
  'MUDRA',
  'Stand-Up India',
  'PMEGP',
  'None',
  'Others',
];

/**
 * The server stores `filedITR` and `govtSchemeBenefit` as Booleans; the controls
 * here hold strings. Reading a saved `true` straight into state left BOTH
 * options unselected, so a member who had answered the question came back to a
 * blank form and could not tell it had saved.
 */
const toChoice = (value: unknown): string => {
  if (value === true || value === 'yes') return 'yes';
  if (value === false || value === 'no') return 'no';
  return '';
};

/** The inverse, for the write path. `''` is "unanswered" and is not sent. */
const toBool = (choice: string): boolean | undefined =>
  choice === 'yes' ? true : choice === 'no' ? false : undefined;

/**
 * Only what `MemberFinancialInfo` actually stores, and only what mobile asks.
 *
 * Eight inputs have been removed over two passes. Seven of them — the ITR years,
 * three per-year turnover figures and three named government schemes — do not
 * exist in the schema at all, so Mongoose strict mode dropped every one on save:
 * a member could type their turnover history, see "saved successfully", and have
 * none of it kept. The eighth, `udyamNumber`, does exist, but mobile has never
 * collected it, and mobile is the reference for this form.
 */
interface FinancialFormData {
  panNumber: string;
  gstNumber: string;
  filedITR: string;
  turnoverRange: string;
  govtSchemeBenefit: string;
  /** Which schemes, as on mobile. Drives `govtSchemeBenefit`. */
  govtSchemes: string[];
  schemeDetails: string;
}

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

const FinancialForm = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<FinancialFormData>({
    panNumber: "",
    gstNumber: "",
    filedITR: "",
    turnoverRange: "",
    govtSchemeBenefit: "",
    govtSchemes: [],
    schemeDetails: "",
  });

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
      const saved = await getFinancialInfo();

      if (saved && Object.keys(saved).length > 0) {
        // Spread first, then put the two Booleans back into the shape the
        // controls compare against. Without this the response overwrites `""`
        // with `true`, and `formData.filedITR === "yes"` is false for a member
        // who answered yes.
        setFormData((current) => ({
          ...current,
          ...saved,
          filedITR: toChoice((saved as any).filedITR),
          govtSchemeBenefit: toChoice((saved as any).govtSchemeBenefit),
          govtSchemes: Array.isArray((saved as any).govtSchemes)
            ? (saved as any).govtSchemes
            : current.govtSchemes,
          schemeDetails: (saved as any).schemeDetails || current.schemeDetails,
        }));
      }
    } catch (error) {
      console.warn("Could not load financial details:", error);
      toast.error(errorMessage(error, "Failed to load form data"));
    }
  };

  const setField = (field: keyof FinancialFormData, value: any) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const toggleScheme = (scheme: string) =>
    setFormData((current) => {
      // "None" is exclusive: picking it clears the rest, and picking anything
      // else clears it.
      const selected = current.govtSchemes.includes(scheme);
      if (scheme === "None") {
        return { ...current, govtSchemes: selected ? [] : ["None"], schemeDetails: "" };
      }
      const next = selected
        ? current.govtSchemes.filter((s) => s !== scheme)
        : [...current.govtSchemes.filter((s) => s !== "None"), scheme];
      return { ...current, govtSchemes: next };
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      /**
       * Booleans as Booleans.
       *
       * The names already match the backend, but the types did not: `"yes"`
       * casts to `true` and `"no"` to `false`, while `""` — an untouched control
       * — is not castable at all and made the whole request a 500. Anything
       * still unanswered is left out of the payload instead.
       *
       * `govtSchemeBenefit` is derived from the selection exactly as mobile
       * derives it, so both clients record the same flag for the same answer.
       */
      const isGovtBeneficiary =
        formData.govtSchemes.length > 0 && !formData.govtSchemes.includes("None");

      const payload: Record<string, any> = {
        panNumber: formData.panNumber,
        gstNumber: formData.gstNumber,
        govtSchemes: formData.govtSchemes,
        schemeDetails: formData.govtSchemes.includes("Others")
          ? formData.schemeDetails
          : undefined,
        govtSchemeBenefit: isGovtBeneficiary,
      };

      const itr = toBool(formData.filedITR);
      if (itr !== undefined) payload.filedITR = itr;

      // An empty range is not a member of the enum, so omit rather than send it.
      if (formData.turnoverRange) payload.turnoverRange = formData.turnoverRange;

      await updateProfile(payload);

      toast.success("Financial information saved");
      window.dispatchEvent(new Event('formSubmitted'));

      // Advance to step 4, as mobile does.
      navigate("/member/forms/declaration");
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save your financial details"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RegistrationFormShell
      step={3}
      title="Financial & Compliance"
      description="Financial Details — Step 3 of 4"
      previousTo="/member/forms/business"
      submitLabel="Next"
      submitting={submitting}
      onSubmit={handleSubmit}
    >
      {/* Mirrors mobile's "Tax Identification" card. */}
      <FormCard
        icon={FileText}
        title="Tax Identification"
        subtitle="Your registration numbers"
      >
        <FormGrid>
          <FormField label="PAN Number">
            <Input
              value={formData.panNumber}
              onChange={(e) => setField("panNumber", e.target.value.toUpperCase())}
              placeholder="ABCDE1234F"
              maxLength={10}
              className="h-11 border-slate-200 focus-visible:ring-blue-500"
            />
          </FormField>

          <FormField label="GSTIN Number">
            <Input
              value={formData.gstNumber}
              onChange={(e) => setField("gstNumber", e.target.value.toUpperCase())}
              placeholder="22AAAAA0000A1Z5"
              maxLength={15}
              className="h-11 border-slate-200 focus-visible:ring-blue-500"
            />
          </FormField>
        </FormGrid>
      </FormCard>

      {/* Mirrors mobile's "Turnover & Compliance" card. */}
      <FormCard
        icon={TrendingUp}
        title="Turnover &amp; Compliance"
        subtitle="Your filing history and scale"
      >
        <FormField label="Have you filed Income Tax Returns (ITR)?">
          <div className="flex gap-2">
            <Pill label="Yes" selected={formData.filedITR === "yes"} onClick={() => setField("filedITR", "yes")} />
            <Pill label="No" selected={formData.filedITR === "no"} onClick={() => setField("filedITR", "no")} />
          </div>
        </FormField>

        <FormField label="Annual Turnover Range">
          <div className="flex flex-wrap gap-2">
            {TURNOVER_RANGES.map((range) => (
              <Pill
                key={range}
                label={range}
                selected={formData.turnoverRange === range}
                onClick={() => setField("turnoverRange", range)}
              />
            ))}
          </div>
        </FormField>
      </FormCard>

      {/* Mirrors mobile's "Government Scheme Benefits" card. */}
      <FormCard
        icon={Landmark}
        title="Government Scheme Benefits"
        subtitle="Schemes you have availed"
      >
        <FormField label="Which government schemes have you availed?" hint="Select all that apply">
          <div className="flex flex-wrap gap-2">
            {GOVT_SCHEMES.map((scheme) => (
              <Pill
                key={scheme}
                label={scheme}
                selected={formData.govtSchemes.includes(scheme)}
                onClick={() => toggleScheme(scheme)}
              />
            ))}
          </div>
        </FormField>

        {formData.govtSchemes.includes("Others") && (
          <FormField label="Specify Other Schemes">
            <Textarea
              value={formData.schemeDetails}
              onChange={(e) => setField("schemeDetails", e.target.value)}
              placeholder="Name the scheme and the benefit availed"
              className="min-h-[5.625rem] border-slate-200 focus-visible:ring-blue-500"
            />
          </FormField>
        )}
      </FormCard>
    </RegistrationFormShell>
  );
};

export default FinancialForm;
