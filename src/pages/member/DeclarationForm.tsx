import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, FileCheck } from "lucide-react";
import { toast } from "sonner";
import RegistrationFormShell, { FormCard, FormField } from "./RegistrationFormShell";
import {
  getMyProfile,
  getBusinessInfo,
  getFinancialInfo,
  getDeclarationInfo,
  updateProfile,
  submitApplication,
  errorMessage,
} from "@/services/activApi";

interface DeclarationFormData {
  sisterConcerns: string;
  companyNames: string[];
  agreeToDeclaration: boolean;
}

const DeclarationForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<DeclarationFormData>({
    sisterConcerns: "",
    companyNames: [],
    agreeToDeclaration: false,
  });

  const [submitting, setSubmitting] = useState(false);
  const [companyInputs, setCompanyInputs] = useState<string[]>([""]);

  useEffect(() => {
    loadFormData();
  }, []);

  const loadFormData = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      const saved = await getDeclarationInfo();

      if (saved && Object.keys(saved).length > 0) {
        setFormData((current) => ({
          ...current,
          ...saved,
          // A number out of the API, a string in the input — as mobile does it.
          sisterConcerns:
            (saved as any).sisterConcerns === undefined || (saved as any).sisterConcerns === null
              ? current.sisterConcerns
              : String((saved as any).sisterConcerns),
        }));
        if (saved.companyNames && saved.companyNames.length > 0) {
          setCompanyInputs(saved.companyNames);
        }
      }
    } catch (error) {
      console.error("Error loading form:", error);
      toast.error("Failed to load form data");
    }
  };

  const handleCompanyNameChange = (index: number, value: string) => {
    const newInputs = [...companyInputs];
    newInputs[index] = value;
    setCompanyInputs(newInputs);
    setFormData({ ...formData, companyNames: newInputs.filter((name) => name.trim() !== "") });
  };

  const addCompanyInput = () => {
    setCompanyInputs([...companyInputs, ""]);
  };

  const removeCompanyInput = (index: number) => {
    const newInputs = companyInputs.filter((_, i) => i !== index);
    setCompanyInputs(newInputs.length > 0 ? newInputs : [""]);
    setFormData({ ...formData, companyNames: newInputs.filter((name) => name.trim() !== "") });
  };

  /**
   * Save the declaration, then submit the membership application.
   *
   * The application MUST carry all four form sections nested under `data`.
   * This is the shape the mobile app sends and the shape every admin review
   * screen reads: `buildApplicant` on the server pulls the applicant's details
   * out of `data.personalDetails`, `data.businessInfo`, `data.financialInfo`
   * and `data.declaration`.
   *
   * The previous version sent only a client-invented `applicationId`, a
   * `userName` and the region — no `data` at all. The application was created
   * successfully and appeared in the admin's queue with every detail blank,
   * because there was nothing for the server to read. That is a silent data
   * loss: nothing errors, and the applicant is told they have applied.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.agreeToDeclaration) {
      toast.error("Please accept the declaration to proceed");
      return;
    }

    setSubmitting(true);
    try {
      // `sisterConcerns` is a Number in the schema. Sending the input's string
      // form let Mongoose fall back to the default and record 0.
      await updateProfile({
        ...formData,
        sisterConcerns: Number(formData.sisterConcerns || 0),
      });

      toast.success("Declaration submitted successfully!");
      window.dispatchEvent(new Event("formSubmitted"));

      // Gather every section the applicant has filled in. Read back from the
      // server rather than from local state so the application carries what was
      // actually stored, not what this page happens to remember.
      const [profile, business, financial, declaration] = await Promise.all([
        getMyProfile().catch(() => ({} as any)),
        getBusinessInfo().catch(() => ({} as any)),
        getFinancialInfo().catch(() => ({} as any)),
        getDeclarationInfo().catch(() => ({} as any)),
      ]);

      // The region gate refuses an application whose block has no active admin,
      // so an incomplete personal form has to be caught here with a message that
      // says what to do about it.
      if (!profile.state || !profile.district || !profile.block) {
        toast.error("Please complete your personal details first — we need your region to route the application.");
        return;
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
          declaration: declaration || formData,
        },
      });

      // The server's own id, not a locally invented one — this is what the
      // status screen and every admin queue key off.
      const applicationId = application?._id || application?.id || "";
      if (applicationId) localStorage.setItem("applicationId", String(applicationId));

      navigate("/member/application-submitted");
    } catch (error) {
      toast.error(errorMessage(error, "Failed to submit your application"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RegistrationFormShell
      step={4}
      title="Declaration"
      description="Final Declaration — Step 4 of 4"
      previousTo="/member/forms/financial"
      submitLabel="Submit Application"
      submitting={submitting}
      disabled={!formData.agreeToDeclaration}
      onSubmit={handleSubmit}
    >
      {/* Mirrors mobile's "Sister Concerns & Firms" card. */}
      <FormCard
        icon={Building2}
        title="Sister Concerns &amp; Firms"
        subtitle="Other businesses under the same ownership"
      >
                  <div>
                    <Label htmlFor="sisterConcerns" className="text-sm font-medium mb-2 block">
                      Number of Sister Concerns
                    </Label>
                    <Input
                      id="sisterConcerns"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={formData.sisterConcerns}
                      onChange={(e) => {
                        // Digits only. The field is a count, and a negative one
                        // fails the schema's `min: 0`.
                        const digits = e.target.value.replace(/[^0-9]/g, "");
                        setFormData({ ...formData, sisterConcerns: digits });
                      }}
                      placeholder="Enter number (0 if none)"
                    />
                  </div>

                  {/* Company Names */}
                  {Number(formData.sisterConcerns || 0) > 0 && (
                    <div className="space-y-3">
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
      </FormCard>

      {/* Mirrors mobile's "Member Declaration" card. */}
      <FormCard
        icon={FileCheck}
        title="Member Declaration"
        subtitle="Read and accept before submitting"
      >
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-slate-800 mb-2">I hereby declare that:</p>
          <ul className="list-disc list-inside space-y-1 ml-1 text-sm text-slate-700">
            <li>All the information provided by me is true and correct to the best of my knowledge.</li>
            <li>I understand that any false information may lead to rejection of my application.</li>
            <li>I agree to abide by the rules and regulations of the organization.</li>
            <li>I authorize the organization to verify the information provided.</li>
          </ul>
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <Checkbox
            id="declaration"
            checked={formData.agreeToDeclaration}
            onCheckedChange={(checked) => setFormData({ ...formData, agreeToDeclaration: checked as boolean })}
            className="mt-1"
          />
          <span className="text-sm text-slate-700">
            I have read and agree to the above declaration. I understand that this submission
            is final and any false information may result in termination of membership.
            <span className="text-red-500 ml-0.5">*</span>
          </span>
        </label>
      </FormCard>
    </RegistrationFormShell>
  );
};

export default DeclarationForm;
