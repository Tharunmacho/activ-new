import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Briefcase, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import RegistrationFormShell, { FormCard, FormField, FormGrid } from "./RegistrationFormShell";
import { getBusinessInfo, updateProfile, errorMessage } from "@/services/activApi";
import { commencementYears } from "@/lib/memberFormOptions";

/**
 * Step 2 asks two questions and no more.
 *
 * Organisation name, constitution, business types, activities, employee count,
 * chamber membership and government bodies were all asked here. They have moved
 * to the Business Creation Account, together with the whole Financial &
 * Compliance step, because every one of them describes a COMPANY: a member who
 * trades through two of them had one answer each, describing whichever company
 * was filled in last, and the second company's details had nowhere to go.
 *
 * `businessCommencementYear` is the exception and stays here. It is not a
 * detail about a company — it is what resolves the applicant's membership band
 * and therefore the price of the membership itself (see MEMBERSHIP PRICING in
 * CLAUDE.md). Asked per company it would give one applicant several answers to
 * a question that has exactly one.
 */

/**
 * `doingBusiness` is a Boolean on `BusinessInfo`; this control holds a string.
 * Both directions were wrong.
 *
 * Reading: a saved `false` was spread straight into state, and the control
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

interface BusinessFormData {
  doingBusiness: string;
  businessCommencementYear: string;
}

/** A selectable pill, matching mobile's `pillButton`. */
const Pill = ({
  label, selected, onClick,
}: { label: string; selected: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-5 py-2.5 rounded-xl text-[1.1875rem] font-semibold border transition-colors ${selected
      ? "bg-blue-600 text-white border-blue-600"
      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
      }`}
  >
    {label}
  </button>
);

const BusinessInformationForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<BusinessFormData>({
    doingBusiness: "",
    businessCommencementYear: "",
  });
  const [submitting, setSubmitting] = useState(false);

  /** 1950 to this year, newest first. Fixed for the life of the screen. */
  const years = useMemo(() => commencementYears(), []);

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
        setFormData({
          doingBusiness: toChoice((saved as any).doingBusiness),
          // A year out of the API may be a number; the select compares strings.
          businessCommencementYear:
            (saved as any).businessCommencementYear === undefined ||
              (saved as any).businessCommencementYear === null
              ? ""
              : String((saved as any).businessCommencementYear),
        });
      }
    } catch (error) {
      console.warn("Could not load business details:", error);
      toast.error(errorMessage(error, "Failed to load form data"));
    }
  };

  const setField = (field: keyof BusinessFormData, value: string) =>
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      // An aspirant has no commencement year. Leaving a previously entered one
      // behind would price them into a band for a business they just said they
      // do not have.
      if (field === "doingBusiness" && value === "no") next.businessCommencementYear = "";
      return next;
    });

  const isAspirant = formData.doingBusiness === "no";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.doingBusiness) {
      toast.error("Please select whether you are currently doing business");
      return;
    }

    if (!isAspirant && !formData.businessCommencementYear) {
      toast.error("Please select the year your business commenced");
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
      const payload: Record<string, any> = {
        doingBusiness: !isAspirant,
        registrationType: isAspirant ? 'aspirant' : 'business',
      };

      // Sent only when there is one. An empty string here would overwrite a
      // stored year with a blank, and the price band with it.
      if (!isAspirant) {
        payload.businessCommencementYear = formData.businessCommencementYear;
      }

      await updateProfile(payload);

      toast.success("Business information saved");
      window.dispatchEvent(new Event('formSubmitted'));

      /*
        BOTH paths go to the declaration now.

        An aspirant used to submit their whole application from this screen,
        through a checkbox tucked inside a blue notice — so the two kinds of
        applicant agreed to two differently-worded declarations, on two
        different screens, and only one of them was recorded in the declaration
        collection. There is one declaration step and everybody signs it.
      */
      navigate("/member/forms/declaration");
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
      description="Business Details — Step 2 of 3"
      previousTo="/member/forms/personal"
      submitLabel="Next"
      submitting={submitting}
      onSubmit={handleSubmit}
    >
      <FormCard
        icon={Briefcase}
        title="Business Status"
        subtitle="This decides how your application is reviewed"
      >
        <FormField label="Are you currently doing business?" required>
          <div className="flex gap-2">
            <Pill
              label="Yes"
              selected={formData.doingBusiness === "yes"}
              onClick={() => setField("doingBusiness", "yes")}
            />
            <Pill
              label="No"
              selected={isAspirant}
              onClick={() => setField("doingBusiness", "no")}
            />
          </div>
        </FormField>

        {isAspirant && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-[1.1875rem] text-blue-900">
              You are registering as an <strong>aspirant</strong>. There is nothing
              further to fill in here — continue to the declaration to submit your
              application.
            </p>
          </div>
        )}
      </FormCard>

      {/*
        The commencement year, and only the commencement year.

        Its own card rather than a second field in the one above, because it is
        a different question with a consequence of its own: this is the year the
        membership band and the fee are resolved from, which is what `PlanHint`
        says underneath it.
      */}
      {formData.doingBusiness === "yes" && (
        <FormCard
          icon={CalendarClock}
          title="Business Commencement"
          subtitle="The year your business started trading"
        >
          <FormGrid>
            <FormField label="Commencement Year" required>
              <Select
                value={formData.businessCommencementYear}
                onValueChange={(v) => setField("businessCommencementYear", v)}
              >
                <SelectTrigger className="h-11 border-slate-200 focus:ring-blue-500">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                {/*
                  Seventy-odd years, so the list scrolls rather than covering the
                  window. Newest first — most applicants pick a recent year.
                */}
                <SelectContent className="max-h-72">
                  {years.map((year) => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/*
                NO PLAN OR PRICE UNDER THIS FIELD — see the twin note in
                `Profile.tsx`. `PlanHint` is kept, unrendered, and the price
                is met at the payment step, which resolves the band from the
                saved record and is the only figure that was ever binding.
              */}
            </FormField>

            <div className="hidden md:block" aria-hidden="true" />
          </FormGrid>

          <p className="text-[1.1875rem] text-slate-500">
            Everything else about your company — constitution, activities, GSTIN,
            turnover and government registrations — is asked once in your{" "}
            <strong className="font-semibold text-slate-700">Business Account</strong>,
            which you can set up after your application is submitted.
          </p>
        </FormCard>
      )}
    </RegistrationFormShell>
  );
};

export default BusinessInformationForm;
