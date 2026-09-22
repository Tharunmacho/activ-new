import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  User, Building2, Wallet, ClipboardCheck, Check, X, Loader2, type LucideIcon,
} from "lucide-react";

/**
 * The applicant detail view — the website's counterpart to mobile's
 * `ApplicantDetailScreen`.
 *
 * It read a vocabulary that does not exist. The props declared `pan`, `gst`,
 * `udyam`, `employees`, `chamber`, `govtOrgs`, `businessYear`, `organization`,
 * `constitution`, `declarationAccepted`, `itrYears` and `turnover1..3`, while
 * `getApplicationProfile` (`services/activApi.ts`) spreads the four stored
 * sections and therefore emits the schema's own names — `panNumber`,
 * `gstNumber`, `numberOfEmployees`, `organizationName`, `agreeToDeclaration`
 * and so on. Not one of those aliases was ever produced, so every branch that
 * depended on them was dead: the Business and Financial sections are gated on
 * `pan || gst || udyam` and could never open at all, and the fields that did
 * render did so by luck, being the handful the function renames explicitly.
 *
 * The fields and their order now follow mobile's four sections exactly, reading
 * the canonical keys with the same fallbacks mobile uses. `itrYears` and
 * `turnover1..3` are gone: no schema stores them, so they could only ever have
 * been blank.
 */

export interface ProfileData {
  // personal
  fullName?: string; name?: string;
  email?: string; phone?: string; phoneNumber?: string;
  block?: string; district?: string; state?: string; city?: string;
  dateOfBirth?: string; dob?: string;
  gender?: string;
  aadhaarNumber?: string; aadhaar?: string; idNumber?: string;
  streetName?: string; street?: string; address?: string;
  educationalQualification?: string; education?: string;
  religion?: string; socialCategory?: string;
  // business
  doingBusiness?: boolean | string;
  registrationType?: string; memberType?: string; role?: string;
  organizationName?: string; businessName?: string;
  constitutionType?: string;
  businessTypes?: string[] | string; businessType?: string;
  businessActivities?: string;
  businessCommencementYear?: string | number;
  numberOfEmployees?: string | number;
  memberOfOtherChamber?: boolean;
  otherChamber?: string;
  govtOrganizations?: string[] | string;
  // financial
  panNumber?: string; gstNumber?: string; udyamNumber?: string;
  filedITR?: boolean; itrFiled?: boolean;
  turnoverRange?: string; lastYearTurnover?: string;
  govtSchemeBenefit?: boolean;
  govtSchemes?: string[] | string;
  schemeDetails?: string;
  // declaration
  sisterConcerns?: number | string;
  companyNames?: string[] | string;
  agreeToDeclaration?: boolean; agreeToTerms?: boolean;
  // meta
  status?: string;
  statusLabel?: string;
  stage?: string;
  submittedAt?: string | null;
  rejectionReason?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  profile: ProfileData | null;
  loading?: boolean;
  /**
   * Supplied only where a decision is possible — the Approvals queue. The
   * Members screens list already-approved members and pass nothing, so the
   * view stays read-only there, exactly as it is today.
   */
  onReview?: (action: "approve" | "reject", reason?: string) => Promise<void>;
}

/**
 * Mobile hides a row whose value is empty rather than printing a dash.
 *
 * `false` counts as empty, and that is the point. Every Boolean on these forms
 * defaults to `false` in the schema, so a member who never opened Form 3 still
 * had `filedITR: false` and `govtSchemeBenefit: false` stored against them —
 * and this printed both as "No", which is indistinguishable from someone who
 * opened the form and answered No. An aspirant was shown a full "Financial &
 * Compliance" section and a "Declaration & Terms" section reading
 * "Agreed to Terms: No", describing forms they were never asked to fill.
 *
 * `String(false)` is "false", which is not the empty string, so the old test
 * treated every unanswered Boolean as answered.
 *
 * Only a `true` is worth a row. What an applicant declared they DO is a fact
 * about them; what they did not declare is the absence of a fact, and the
 * section disappears with its last row. Membership type is a string and is
 * unaffected — it still says whether they are an aspirant or a business.
 */
const hasValue = (v: unknown): boolean => {
  if (v === null || v === undefined) return false;
  if (typeof v === "boolean") return v;
  if (Array.isArray(v)) return v.length > 0;
  return String(v).trim() !== "";
};

const show = (v: unknown): string => {
  if (Array.isArray(v)) return v.filter(Boolean).join(", ");
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
};

const formatDate = (v?: string | null): string => {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

/** `true`/`false` may arrive as a real Boolean or as the string form. */
const asBool = (v: unknown): boolean | undefined => {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "yes") return true;
  if (v === "false" || v === "no") return false;
  return undefined;
};

/**
 * One of the four submitted forms.
 *
 * ===========================================================================
 * A GRID, NOT A FLEX ROW WITH A FIXED-WIDTH LABEL
 * ===========================================================================
 *
 * The rows were `flex` with `dt` at a hard `w-44`. That lines the values up
 * only while every label fits in 176px: one that does not wraps, its own row
 * grows, and the value beside it sits at a different height from the value
 * above — which is exactly the ragged column this section was reported for.
 * `grid-cols-[minmax(0,11rem)_1fr]` gives every row the same two tracks, so the
 * values share one left edge whatever the labels do, and the label column can
 * still shrink on a narrow screen instead of squeezing the value to nothing.
 *
 * The header is a slate strip with the icon in a tinted tile rather than a
 * fully tinted band: four sections each washed in their own colour read as four
 * unrelated documents, and the colour is more useful identifying the form than
 * covering it.
 */
/** The stage, as a pill — the same three the queue card shows. */
const STATUS_PILL: Record<string, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-red-200 bg-red-50 text-red-700",
};

const Section = ({
  title, subtitle, icon: Icon, tint, rows,
}: {
  title: string; subtitle: string; icon: LucideIcon; tint: string;
  rows: { label: string; value: unknown }[];
}) => {
  const visible = rows.filter((r) => hasValue(r.value));
  if (!visible.length) return null;
  return (
    <section className="rounded-xl border border-slate-200 overflow-hidden bg-white
                        shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3.5">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tint}`}>
          <Icon className="w-[18px] h-[18px]" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[1.25rem] font-extrabold tracking-tight text-slate-900">{title}</h3>
          <p className="text-[1.1875rem] font-medium text-slate-500">{subtitle}</p>
        </div>
      </header>
      <dl className="divide-y divide-slate-100">
        {visible.map((r) => (
          <div
            key={r.label}
            className="grid grid-cols-[minmax(0,11rem)_1fr] items-baseline gap-4 px-5 py-3"
          >
            <dt className="text-[1.1875rem] font-semibold text-slate-500">{r.label}</dt>
            <dd className="text-[1.25rem] font-semibold text-slate-900 break-words min-w-0">
              {show(r.value)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

export default function ProfileViewModal({ open, onClose, profile, loading, onReview }: Props) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  const p = profile || {};

  /**
   * The same rule the server applies, so the two badges cannot disagree.
   *
   * `admin.service.js` requires BOTH halves — `doingBusiness === false` AND an
   * explicit aspirant marker — before it calls someone an aspirant. This used
   * an OR, so an applicant who declared no business but carries no marker was
   * "Business Member" in the queue and "Aspirant" in this view, from the same
   * record.
   */
  const isAspirant =
    asBool(p.doingBusiness) === false &&
    (p.registrationType === "aspirant" || p.memberType === "aspirant");

  const displayName = p.fullName || p.name || "Applicant";
  const roleLabel = isAspirant ? "Aspirant" : "Business Member";
  const stage = (p.stage || "").toLowerCase();
  const canAct = !!onReview && stage === "pending";

  const submit = async (action: "approve" | "reject") => {
    if (!onReview) return;
    setBusy(action);
    try {
      await onReview(action, action === "reject" ? reason.trim() : undefined);
      setRejecting(false);
      setReason("");
      onClose();
    } finally {
      setBusy(null);
    }
  };

  const otherChamber = asBool(p.memberOfOtherChamber);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      {/*
        * `flex flex-col`, overriding the dialog's own `grid`.
        *
        * The body used to be a `ScrollArea` with `max-h-[52vh]` — a guess at
        * how much room was left once the header, the identity strip and the
        * footer had taken theirs. It was the wrong guess in both directions:
        * short applications left a gap under the footer, and long ones cut a
        * row clean through the middle at an arbitrary height. As a flex column
        * the body simply takes what is left, and the cut always lands on the
        * footer's own border.
        */}
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden
                                rounded-2xl border-slate-200">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4 border-b border-slate-200 text-left">
          <DialogTitle className="text-[1.625rem] font-extrabold tracking-tight text-slate-900">
            Application Details
          </DialogTitle>
          <DialogDescription className="text-[1.25rem] font-medium text-slate-500">
            Complete application information submitted by the member
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
            <p className="text-[1.25rem] text-slate-500">Loading application…</p>
          </div>
        ) : !profile ? (
          <div className="py-20 text-center">
            <p className="text-[1.25rem] text-slate-500">No application data to show.</p>
          </div>
        ) : (
          <>
            {/* Identity, matching mobile's hero: name, role pill, status. */}
            <div className="shrink-0 px-6 py-4 flex flex-wrap items-center gap-3.5
                            border-b border-slate-200 bg-white">
              <span className="w-12 h-12 rounded-full bg-blue-600 text-white text-[1.25rem] font-bold
                               flex items-center justify-center shrink-0">
                {displayName.split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[1.375rem] font-extrabold tracking-tight text-slate-900 truncate">
                  {displayName}
                </p>
                {/* Both pills the same height and the same case, so the pair
                    reads as one row rather than as two controls. */}
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-[0.9375rem]
                                    font-bold text-white
                                    ${isAspirant ? "bg-emerald-600" : "bg-blue-600"}`}>
                    {roleLabel}
                  </span>
                  {!!p.statusLabel && (
                    <span className={`inline-flex h-6 items-center rounded-full border px-2.5
                                      text-[0.9375rem] font-bold ${STATUS_PILL[stage] || STATUS_PILL.pending}`}>
                      {p.statusLabel}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/*
              * Inside the scrolling body, not pinned above it.
              *
              * It sat between the identity strip and the scroll area, so on a
              * long reason it ate the room the forms needed and could not be
              * scrolled away from.
              */}
            <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50 px-6 py-5">
              <div className="space-y-4">
                {!!p.rejectionReason && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3.5">
                    <p className="text-[0.9375rem] font-extrabold uppercase tracking-widest text-red-700">
                      Rejection reason
                    </p>
                    <p className="mt-1.5 text-[1.25rem] font-semibold text-red-900">{p.rejectionReason}</p>
                  </div>
                )}
                <Section
                  title="Form 1: Personal & Demographic Details"
                  subtitle="Basic contact and demographic information"
                  icon={User}
                  tint="bg-indigo-50 text-indigo-700"
                  rows={[
                    { label: "Full Name", value: p.fullName || p.name },
                    /*
                        Moved here from the business section.
                        For an aspirant every Boolean on Forms 2-4 is now
                        hidden, so those sections disappear entirely — and the
                        one fact worth keeping went with them. Personal details
                        always carry a name and an email, so this row is always
                        reachable.
                    */
                    { label: "Membership Type", value: p.memberType || p.registrationType || p.role },
                    { label: "Block", value: p.block },
                    { label: "City / Town", value: p.city },
                    { label: "District", value: p.district },
                    { label: "State", value: p.state },
                    { label: "Phone Number", value: p.phoneNumber || p.phone },
                    { label: "Email Address", value: p.email },
                    { label: "Date of Birth", value: formatDate(p.dateOfBirth || p.dob) },
                    { label: "Gender", value: p.gender },
                    { label: "Aadhaar / ID No", value: p.aadhaarNumber || p.aadhaar || p.idNumber },
                    { label: "Street Address", value: p.streetName || p.street || p.address },
                    { label: "Education", value: p.educationalQualification || p.education },
                    { label: "Religion", value: p.religion },
                    { label: "Social Category", value: p.socialCategory },
                  ]}
                />

                {/*
                    No hard gate on these two.

                    Mobile hides them for an aspirant, which is safe there
                    because an aspirant is never asked the questions. Gating on
                    the flag as well as on emptiness can only ever SUPPRESS
                    something that was genuinely filled in — for instance an
                    applicant who answered the business form and later switched
                    their declaration. `Section` already renders nothing when
                    every one of its rows is empty, so an aspirant sees exactly
                    what mobile shows them: nothing.
                */}
                {(
                  <>
                    <Section
                      title="Form 2: Business Information"
                      subtitle="Company profile and operational details"
                      icon={Building2}
                      tint="bg-blue-50 text-blue-700"
                      rows={[
                        { label: "Doing Business", value: asBool(p.doingBusiness) },
                        { label: "Organization Name", value: p.organizationName || p.businessName },
                        { label: "Constitution Type", value: p.constitutionType },
                        { label: "Business Type", value: p.businessTypes || p.businessType },
                        { label: "Business Activities", value: p.businessActivities },
                        { label: "Commencement Year", value: p.businessCommencementYear },
                        { label: "Employees Count", value: p.numberOfEmployees },
                        { label: "Other Chamber Member", value: otherChamber },
                        { label: "Other Chamber Details", value: p.otherChamber },
                        { label: "Govt. Organizations", value: p.govtOrganizations },
                      ]}
                    />

                    <Section
                      title="Form 3: Financial & Compliance"
                      subtitle="Taxation, scheme benefits and compliance"
                      icon={Wallet}
                      tint="bg-emerald-50 text-emerald-700"
                      rows={[
                        { label: "PAN Number", value: p.panNumber },
                        { label: "GST Number", value: p.gstNumber },
                        { label: "Udyam Number", value: p.udyamNumber },
                        { label: "ITR Filed", value: asBool(p.filedITR ?? p.itrFiled) },
                        { label: "Turnover Range", value: p.turnoverRange || p.lastYearTurnover },
                        { label: "Govt. Scheme Benefits", value: asBool(p.govtSchemeBenefit) },
                        { label: "Schemes Availed", value: p.govtSchemes },
                        { label: "Other Scheme Details", value: p.schemeDetails },
                      ]}
                    />
                  </>
                )}

                <Section
                  title="Form 4: Declaration & Terms"
                  subtitle="Affiliation and legal agreement"
                  icon={ClipboardCheck}
                  tint="bg-amber-50 text-amber-700"
                  rows={[
                    ...(isAspirant ? [] : [
                      { label: "Sister Concerns", value: p.sisterConcerns },
                      { label: "Company Names", value: p.companyNames },
                    ]),
                    {
                      label: "Agreed to Terms",
                      // No "assume yes" fallback: the agreement is either on the
                      // record or it is not, and printing "Yes (Confirmed)" for a
                      // member who never ticked it asserts a consent that does
                      // not exist.
                      value: asBool(p.agreeToDeclaration ?? p.agreeToTerms),
                    },
                    { label: "Submitted Date", value: formatDate(p.submittedAt) },
                  ]}
                />
              </div>
            </div>

            {/* Decisions, for the queue that can make them. */}
            {canAct && (
              <div className="shrink-0 px-6 py-4 border-t border-slate-200 bg-white">
                {rejecting ? (
                  <div className="space-y-3">
                    <label className="text-[1.25rem] font-semibold text-slate-700">Reason for rejection</label>
                    <Textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Explain why this application is being rejected"
                      className="min-h-[5rem]"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => { setRejecting(false); setReason(""); }}>
                        Cancel
                      </Button>
                      <Button
                        className="bg-red-600 hover:bg-red-700"
                        disabled={busy !== null}
                        onClick={() => submit("reject")}
                      >
                        {busy === "reject" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Reject"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3 justify-end">
                    <Button
                      variant="outline"
                      className="border-red-200 text-red-600 hover:bg-red-50"
                      disabled={busy !== null}
                      onClick={() => setRejecting(true)}
                    >
                      <X className="w-4 h-4 mr-1.5" /> Reject
                    </Button>
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      disabled={busy !== null}
                      onClick={() => submit("approve")}
                    >
                      {busy === "approve"
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <><Check className="w-4 h-4 mr-1.5" /> Approve</>}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
