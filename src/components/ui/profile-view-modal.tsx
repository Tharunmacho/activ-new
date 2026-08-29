import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
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

const Section = ({
  title, subtitle, icon: Icon, tint, rows,
}: {
  title: string; subtitle: string; icon: LucideIcon; tint: string;
  rows: { label: string; value: unknown }[];
}) => {
  const visible = rows.filter((r) => hasValue(r.value));
  if (!visible.length) return null;
  return (
    <section className="rounded-xl border border-slate-200 overflow-hidden">
      <header className={`flex items-start gap-3 px-5 py-4 ${tint}`}>
        <Icon className="w-5 h-5 mt-0.5 shrink-0" />
        <div>
          <h3 className="font-bold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-600">{subtitle}</p>
        </div>
      </header>
      <dl className="divide-y divide-slate-100 bg-white">
        {visible.map((r) => (
          <div key={r.label} className="flex items-start gap-4 px-5 py-3">
            <dt className="w-44 shrink-0 text-sm text-slate-500">{r.label}</dt>
            <dd className="text-sm font-medium text-slate-800 break-words min-w-0">{show(r.value)}</dd>
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
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
          <DialogTitle className="text-xl">Application Details</DialogTitle>
          <DialogDescription>
            Complete application information submitted by the member
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
            <p className="text-sm text-slate-500">Loading application…</p>
          </div>
        ) : !profile ? (
          <div className="py-20 text-center">
            <p className="text-sm text-slate-500">No application data to show.</p>
          </div>
        ) : (
          <>
            {/* Identity, matching mobile's hero: name, role pill, status. */}
            <div className="px-6 py-4 flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50">
              <span className="w-12 h-12 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0">
                {displayName.split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900 truncate">{displayName}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge className={isAspirant ? "bg-emerald-600" : "bg-blue-600"}>{roleLabel}</Badge>
                  {!!p.statusLabel && <Badge variant="outline">{p.statusLabel}</Badge>}
                </div>
              </div>
            </div>

            {!!p.rejectionReason && (
              <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm text-red-800">
                  <span className="font-semibold">Rejection reason: </span>
                  {p.rejectionReason}
                </p>
              </div>
            )}

            <ScrollArea className="max-h-[52vh] px-6 py-4">
              <div className="space-y-4">
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
            </ScrollArea>

            {/* Decisions, for the queue that can make them. */}
            {canAct && (
              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
                {rejecting ? (
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-700">Reason for rejection</label>
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
