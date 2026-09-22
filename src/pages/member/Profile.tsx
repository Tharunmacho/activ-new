import React, { useEffect, useState } from "react";
import { resizeCompanyNames, toCount } from "@/lib/sisterConcerns";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  Check, FileText, ArrowLeft, ArrowRight, User, MapPin, KeyRound, UsersRound,
  Building2, ScrollText, Trash2, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import MemberPageShell from "./MemberPageShell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CARD_TITLE } from '@/components/layout/appTypography';
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
  getMyApplication,
  errorMessage,
} from "@/services/activApi";
/**
 * Option lists that mirror the backend enums. Hand-written copies of these had
 * drifted so far that the financial step could not be saved at all — see the
 * header of `memberFormOptions.ts`.
 */
import {
  SOCIAL_CATEGORIES,
  GENDERS,
  religionsFor,
  normalizeReligion,
  commencementYears,
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
  socialCategory?: string;
  religion?: string;
  gender?: string;

  /*
   * Step 2: Business Information — two questions.
   *
   * Organisation name, constitution, business types, activities, employee
   * count, chamber membership and government bodies used to be asked here, and
   * a whole Financial & Compliance step sat between this and the declaration.
   * All of it describes a COMPANY rather than an applicant, so all of it is
   * asked once per company in the Business Creation Account instead — a member
   * trading through two companies had one answer each here, describing
   * whichever was filled in last.
   *
   * `businessYear` is the exception and stays. It is what resolves the
   * membership band and therefore the PRICE of the membership (see MEMBERSHIP
   * PRICING in CLAUDE.md), so it has to have exactly one answer per applicant.
   */
  doingBusiness?: string;
  businessYear?: string;

  // Step 3: Declaration
  sisterConcerns?: string;
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
  socialCategory: "",
  religion: "",
  gender: "",
  doingBusiness: "",
  businessYear: "",
  sisterConcerns: "",
  declarationAccepted: false,
};

/**
 * The three steps, as the left rail names them.
 *
 * `hint` is what the step is actually for, in the member's words. A rail that
 * lists "Business" and nothing else asks someone to guess what is behind it.
 *
 * `Financial` used to sit third. It is asked per company in the Business
 * Creation Account now — see the note on `ProfileData` — so the application
 * itself is three steps for everybody, business and aspirant alike.
 */
const RAIL = [
  { n: 1, name: 'Personal', hint: 'Who you are and where' },
  { n: 2, name: 'Business', hint: 'Whether you trade, and since when' },
  { n: 3, name: 'Declaration', hint: 'Confirm and submit' },
] as const;

/** "Three steps" reads better than "3 steps" in a sentence; the rail decides. */
/**
 * THE BUSINESS ACCOUNT FORM'S FIELD, on the application form too.
 *
 * The shared `Input` ships `border-black` on a white ground — a hard 1px
 * rule that reads as a wireframe beside the slate-50 well `CompanyForm`
 * uses on every control. Two forms a member fills in the same week should
 * not look like two products, and this is the one the association asked to
 * be matched.
 *
 * Applied per call site rather than by changing `Input` itself: that
 * component is used by the admin panels and the CMS, which were built
 * against the bordered look.
 */
const FIELD =
  'mt-1.5 h-[3.25rem] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 ' +
  'text-[1.1875rem] font-medium text-slate-900 placeholder:font-medium placeholder:text-slate-400 ' +
  'transition-colors hover:border-slate-300 focus:bg-white focus:border-transparent ' +
  'focus:ring-2 focus:ring-blue-600 disabled:bg-slate-100 disabled:text-slate-500';

/** Its label — the size `Label` has always been on this form. */
const FIELD_LABEL = 'block text-[1.1875rem] font-medium text-slate-800';

const STEP_WORDS: Record<number, string> = { 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five' };

const STEP_HEADING: Record<number, { title: string; blurb: string }> = {
  1: { title: 'Personal details', blurb: 'Your name, how we reach you, and the region your application is reviewed in.' },
  2: { title: 'Business details', blurb: 'Whether you are trading today, and the year you started. Everything else about a company is asked in your Business Account.' },
  3: { title: 'Declaration', blurb: 'A last look, then confirm the undertaking and submit for review.' },
};

/**
 * One titled block of fields — a SECTION, not a card.
 *
 * Each step used to be an unbroken run of inputs under a single heading — ten
 * deep on step 1, with the password boxes sitting between "Email" and
 * "Religion" as though they were the same thought. Captioned blocks are what
 * make a long form scannable: you can tell what a block is for before reading
 * a single label.
 *
 * THEY WERE CARDS, AND FOUR OF THEM ON ONE STEP WAS THREE TOO MANY. "About
 * you", "Location", "Change your password" and "Demographic details" are four
 * parts of ONE form about ONE person, and four bordered, shadowed rectangles
 * down a page say the opposite — that these are four separate things that
 * happen to be stacked. The chrome also cost a border, a shadow and a gap
 * between every pair of headings, which is a lot of furniture to walk past on
 * the way to a text box.
 *
 * The blocks are unchanged; only the frame moved out to `SectionGroup`, which
 * draws it once for all of them.
 */
function Section({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="p-5 lg:p-6">
      <div className="flex items-start gap-3 pb-4 mb-5 border-b border-[#F1F5F9]">
        <span className="w-10 h-10 rounded-xl bg-[#EEF3FE] flex items-center justify-center shrink-0">
          <Icon className="w-[1.125rem] h-[1.125rem] text-[#1E50E6]" />
        </span>
        <div className="min-w-0">
          <h3 className={`${CARD_TITLE} text-[#0F172A]`}>{title}</h3>
          {subtitle ? <p className="text-[1rem] text-[#64748B] mt-1 leading-snug">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

/**
 * THE CARD. One per step, holding every section in it.
 *
 * `divide-y` rather than a border on each section: sections are conditional —
 * step 3 drops "Sister concerns" for an aspirant — and `first:border-t-0`
 * picks the first ELEMENT, which is not the first RENDERED one once a
 * condition removes it. A rule would then be drawn above nothing. `divide-y`
 * only ever draws between siblings that actually rendered.
 *
 * The step's action bar stays OUTSIDE this card, deliberately. It is the same
 * control in the same place on every step, and putting it inside would let it
 * move as a section above it grows or a conditional block opens — which is the
 * exact thing the note on that bar says it exists to prevent.
 */
function SectionGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white border border-[#E8EEF6] overflow-hidden
                    shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)]
                    divide-y divide-[#F1F5F9]">
      {children}
    </div>
  );
}

/** Columns from md up, so a phone number stops being a 700px-wide input. */
function Fields({ children, cols = 2 }: { children: React.ReactNode; cols?: 1 | 2 | 3 }) {
  const grid = cols === 1 ? '' : cols === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2';
  return <div className={`grid gap-5 ${grid}`}>{children}</div>;
}

export default function Profile() {
  const [states, setStates] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(1);
  /**
   * The furthest step this member has reached — NOT the same as `currentStep`.
   *
   * The rail decided "can I click this?" with `s.n < currentStep`, which is only
   * true for steps behind the one on screen. So the moment a returning member
   * was resumed onto step 3, steps 1 and 2 were clickable and 4 was not — right
   * — but stepping BACK to 2 to check an answer made 3 and 4 unreachable again,
   * and the only way forward was to re-submit each step in turn. High-water mark
   * kept separately, so the rail walks both ways.
   */
  const [furthestStep, setFurthestStep] = useState<number>(1);
  const [isLocked, setIsLocked] = useState(false);
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const [hasExistingProfile, setHasExistingProfile] = useState(false);
  /**
   * True when the signed-in account has no row in "web users" at all — an admin
   * account reaching the member profile page. See the 404 branch in
   * `loadUserProfile`.
   */
  const [noMemberRecord, setNoMemberRecord] = useState(false);

  /**
   * WHETHER THE APPLICATION HAS ALREADY BEEN DECIDED.
   *
   * A member whose application three admins have approved still comes to
   * this screen to correct a phone number — and it showed them a wizard
   * ending in "Submit Application", which would lodge a SECOND application
   * for somebody who is already a member. The screen is the same form either
   * way; what changes is the last button and what it does.
   */
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  /*
   * The company-name rows. ONE source of truth, and that is the fix.
   *
   * There were two. A react-hook-form field called `companyNames` held a single
   * typed string and was what the form showed by default; this array held the
   * rows and was what `handleFinalSubmit` actually sent. A `showSeparateFields`
   * checkbox switched the view between them. Two consequences, both silent:
   *
   *   - "Add Another Company" pushed a row onto an array that the default view
   *     did not render, so the button appeared to do nothing at all.
   *   - A name typed into that default field was never in this array, so it was
   *     filtered out at submit and the company was lost. No error, and the
   *     applicant had watched themselves type it.
   *
   * So there is no mode switch now and no form field — just the rows, rendered
   * one per company, each removable. Same shape as `Settings.tsx` and
   * `DeclarationForm.tsx`, which ask this question the same way.
   */
  const [companyNames, setCompanyNames] = useState<string[]>([""]);

  const updateCompanyName = (index: number, value: string) => {
    setCompanyNames((rows) => rows.map((row, i) => (i === index ? value : row)));
  };

  /*
   * ==========================================================================
   * THE COUNT AND THE BOXES ARE ONE ANSWER, SO THEY MOVE TOGETHER
   * ==========================================================================
   *
   * "No. of Sister Concerns: 3" beside one name box is a form contradicting
   * itself, and the applicant has no way to know which half the association
   * will read. Typing a number now builds that many boxes; adding or removing a
   * box moves the number. Neither can be left behind by the other.
   *
   * SHRINKING DROPS BLANKS BEFORE IT DROPS TYPED NAMES. Going 3 -> 2 with
   * ["Acme", "", "Baker"] keeps both companies rather than deleting Baker for
   * being last — the blank row is the one carrying nothing. Only when there are
   * no blanks left does a typed name go, which at that point is the honest
   * consequence of answering "2".
   */
  /* `resizeCompanyNames` lives in `lib/sisterConcerns.ts` — see the note there. */

  /** The number field. Digits only — a count cannot be negative or fractional. */
  const handleSisterCountChange = (raw: string) => {
    const digits = toCount(raw);
    setValue("sisterConcerns", digits, { shouldDirty: true });
    // `''` while the box is being cleared is not zero: it is "no answer yet".
    // Wiping the rows on the way past an empty string would throw away typed
    // names every time somebody selected the number and retyped it.
    if (digits === "") return;
    setCompanyNames((rows) => resizeCompanyNames(rows, Number(digits)));
  };

  const addCompanyName = () => setCompanyNames((rows) => {
    const next = [...rows, ""];
    setValue("sisterConcerns", String(next.length), { shouldDirty: true });
    return next;
  });

  /*
   * Removing a row takes the count down with it. The list may now be empty —
   * unlike before, when it kept one box back — because the count is what says
   * whether there are any: a member who answers 0 should not be left looking at
   * a company field, and one who answers 1 gets the box straight back.
   */
  const removeCompanyName = (index: number) => {
    setCompanyNames((rows) => {
      const next = rows.filter((_, i) => i !== index);
      setValue("sisterConcerns", String(next.length), { shouldDirty: true });
      return next;
    });
  };
  /**
   * The member's actual consent, which used to be a decorative ✓ glyph with no
   * value behind it. It gates `handleFinalSubmit` and is sent as
   * `agreeToDeclaration`.
   */
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const navigate = useNavigate();
  /**
   * `?step=2` — "open this application AT the business step".
   *
   * My Profile and My Documents list the four sections with a "Complete now"
   * against each, and those pointed at `/member/forms/financial` — the
   * standalone form pages, which are a SECOND set of screens asking the same
   * questions. A member filling one of those is not filling in this
   * application: different screen, different stepper, and nothing carries them
   * on to the step after it. The links come here now and name the step, so
   * "Complete now" against Business opens the business step of the
   * application the member is actually completing.
   *
   * A hint, not a command: the loader below still resolves where the member
   * genuinely is, and this only chooses between steps they have reached. An
   * out-of-range or unreached step is ignored rather than obeyed — a link is
   * not a reason to let someone skip a form.
   */
  const [searchParams] = useSearchParams();
  const requestedStep = (() => {
    const raw = Number(searchParams.get('step'));
    return Number.isInteger(raw) && raw >= 1 && raw <= RAIL.length ? raw : 0;
  })();

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProfileData>({ defaultValues: defaultProfile });

  // Auto-save disabled - Data is saved manually when clicking Save/Next buttons

  /**
   * EVERY STEP THE MEMBER HAS ALREADY ANSWERED, BACK IN ITS FIELDS.
   *
   * This used to load step 1 and then `return` inside the `if (personalResult
   * .data)` branch — so the business, financial and declaration reads below it
   * were only ever reached by a member who had NO personal profile, which is
   * nobody who has completed a step. Anyone who filled in step 2 and came back
   * found it blank, retyped it, and saved a second time over the top.
   *
   * The four reads are independent and are issued together. One failing must
   * not blank the others: each is applied only if it answers, and `reset` is
   * called ONCE at the end with everything merged, so React Hook Form gets one
   * new baseline rather than four partial ones racing each other.
   */
  /**
   * WHETHER THE RECORD HAS ARRIVED YET, AND WHETHER IT ARRIVED AT ALL.
   *
   * The screen had neither. It rendered the form immediately and filled it in
   * when three reads came back — so for as long as those took, a member who
   * navigated here (or came back to the tab) saw their own profile as a page
   * of EMPTY BOXES. That is the "profile not showing" fault: nothing was
   * broken, the screen simply showed the blank state of a form that was still
   * loading, and looked identical to a member who had filled nothing in.
   *
   * Worse, a failed read was swallowed by a `catch` that only logged: the
   * boxes then stayed empty for good, and pressing Save would overwrite a
   * real record with them. `loadFailed` stops that by keeping the form off
   * the screen entirely until the record is in hand.
   */
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    const loadUserProfile = async () => {
      setLoadingProfile(true);
      setLoadFailed(false);
      try {
        const token = localStorage.getItem("token");

        // If authenticated, load from backend
        if (!token) return;

        const auth = {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        };

        /** A step's payload, or null if it is not there yet. */
        const read = async (path: string) => {
          try {
            const response = await apiFetch(path, auth);
            if (!response.ok) return { status: response.status, data: null as any };
            const body = await response.json();
            return { status: response.status, data: body?.data ?? null };
          } catch {
            return { status: 0, data: null as any };
          }
        };

        /*
          Three reads. The financial record is no longer a step of this
          application — it is filled in per company, in the Business Creation
          Account — so there is nothing on this form for it to populate.
        */
        const [personal, business, declaration] = await Promise.all([
          read("/members/my-profile"),
          read("/members/business-info"),
          read("/members/declaration-info"),
        ]);

        /**
         * A 404 on the personal read means this account has no member record at
         * all.
         *
         * `GET /members/my-profile` looks the caller up in the MemberDetails
         * collection. An admin — block, district, state or super — lives in
         * `adminsdb`, not there, so the call answers `404 Profile not found`.
         * This used to fall through and leave the form rendered empty and
         * editable, which reads exactly like a member who has not filled
         * anything in yet. It is not: pressing Save then calls
         * `PUT /members/profile`, which does the same lookup and answers
         * `404 Member not found`, so the form can never save either. Saying so
         * is the difference between a blank form and an explanation.
         */
        if (personal.status === 404) {
          setNoMemberRecord(true);
          return;
        }

        /*
         * `status: 0` is the shape `read` returns when the request threw —
         * no network, a dropped connection, a CORS failure. Anything 500 and
         * up is the server saying it could not answer. Either way the form
         * must not be shown: an empty box a member then saves over is how a
         * filled-in profile becomes a blank one.
         */
        if (personal.status === 0 || personal.status >= 500) {
          setLoadFailed(true);
          return;
        }

        /*
         * HAS THIS MEMBER ALREADY APPLIED?
         *
         * ASK THE APPLICATIONS COLLECTION. Nothing on the profile record can
         * answer this, and one field on it looked like it could:
         *
         *     || personal.data?.membershipNumber
         *
         * `GET /members/my-profile` does not return `membershipNumber` as a
         * stored value. It returns
         *
         *     member.membershipNumber || String(member._id).slice(-8).toUpperCase()
         *
         * — a DERIVED id that every member has, applied or not. (It is the
         * "ID 49C436C6" printed on the profile screen.) So the test was true
         * for everybody, always. The consequences ran the whole length of the
         * screen and every one of them looked deliberate:
         *
         *   - the last button read "Save changes", never "Submit Application"
         *   - the step subtitle read "Your declaration", not "Step 3 of 3"
         *   - `createApplicationFromStoredForms` returned at its
         *     `if (alreadyApplied)` guard BEFORE calling `submitApplication`,
         *     and reported "Your details have been updated" on the way out
         *
         * So the form saved perfectly and lodged nothing, with a success
         * toast over it. A member reached 100%, appeared in no admin queue at
         * any tier, and had no way to tell.
         *
         * `getMyApplication()` is the same call the dashboard derives
         * `applicationSubmitted` from, so the two screens cannot disagree
         * about whether this member has applied.
         *
         * The other two tests are kept because both are real: a stored
         * `applicationId` is written when an application is lodged, and an
         * ACTIVE membership cannot exist without one.
         */
        const existingApplication = await getMyApplication().catch(() => null);
        const already = !!(existingApplication
            || personal.data?.applicationId
            || String(personal.data?.membershipStatus || '').toLowerCase() === 'active');
        setAlreadyApplied(already);

        /** "yes" / "no" — the shape the radio groups are registered with. */
        const yesNo = (value: unknown): string => {
          if (value === true) return "yes";
          if (value === false) return "no";
          if (value === "yes" || value === "no") return value;
          return "";
        };

        const merged: Record<string, unknown> = {};
        /** Which steps actually came back answered — drives the rail below. */
        const answered = { personal: false, business: false };

        // ------------------------------------------------- step 1: personal
        if (personal.data) {
          const d = personal.data;
          answered.personal = true;
          setHasExistingProfile(true);
          setIsLocked(d.isLocked || false);

          Object.assign(merged, {
            name: d.fullName || d.name || "",
            phone: d.phoneNumber || "",
            email: d.email || "",
            state: d.state || "",
            district: d.district || "",
            block: d.block || "",
            city: d.city || "",
            socialCategory: d.socialCategory || "",
            // Old spellings are mapped onto the list's current wording, so
            // a returning member is not handed a blank select and asked to
            // answer a question they already answered. Anything with no
            // equivalent comes back '' — see `normalizeReligion`.
            religion: normalizeReligion(d.religion),
            gender: d.gender || "",
            // Never restored: these are not stored, and a prefilled password box
            // is a password box the member cannot tell is empty.
            password: "",
            confirmPassword: "",
            currentPassword: ""
          });

          // The two dependent dropdowns need their options before the values
          // above can select anything — an <option> that does not exist yet
          // cannot be the selected one.
          if (d.state) {
            getDistricts(d.state)
              .then((r) => setDistricts((r.districts || []).map((x) => x.name)))
              .catch(() => setDistricts([]));

            if (d.district) {
              getBlocks(d.state, d.district)
                .then((r) => setBlocks((r.blocks || []).map((x) => x.name)))
                .catch(() => setBlocks([]));
            }
          }
        }

        // ------------------------------------------------- step 2: business
        /*
         * Two fields. `businessCommencementYear` is the name
         * `GET /members/business-info` returns; the form's own `businessYear`
         * shorthand is kept as a fallback so an older cached response shape
         * still populates the step rather than blanking it.
         */
        if (business.data) {
          const d = business.data;
          answered.business = d.doingBusiness !== null && d.doingBusiness !== undefined;

          Object.assign(merged, {
            doingBusiness: yesNo(d.doingBusiness),
            businessYear: String(d.businessCommencementYear || d.businessYear || "")
          });
        }

        // ---------------------------------------------- step 3: declaration
        if (declaration.data) {
          const d = declaration.data;
          const names: string[] = Array.isArray(d.companyNames)
            ? d.companyNames.map((value: unknown) => String(value ?? ""))
            : [];

          Object.assign(merged, {
            sisterConcerns: d.sisterConcerns === null || d.sisterConcerns === undefined
              ? ""
              : String(d.sisterConcerns),
          });

          /*
           * These two live outside the form, so `reset` cannot restore them.
           * The row list keeps one empty box when there is nothing stored, or
           * the member is left with an "Add" button and nowhere to type.
           */
          /*
           * The saved NAMES are the authority on load, and the count is set to
           * match them. They can disagree on a record written before the two
           * were tied together, and a stored count of 2 must not silently
           * delete a third company the member actually entered.
           */
          setCompanyNames(names);
          setValue("sisterConcerns", String(names.length), { shouldDirty: false });
          setDeclarationAccepted(d.agreeToDeclaration === true);
        }

        // One baseline, once — see the note above this effect.
        if (Object.keys(merged).length) {
          reset((prev: ProfileData) => ({ ...prev, ...merged } as ProfileData));
        }

        /**
         * OPEN THE FIRST STEP THAT STILL NEEDS AN ANSWER.
         *
         * A member who had filled two steps and came back landed on step 1 with
         * no way forward: the rail only lets you click a step you have already
         * passed, and `currentStep` always started at 1, so steps 2 and 3 were
         * unreachable until step 1 was submitted again. Resuming where they
         * stopped is also simply what "come back later" means for a form whose
         * own strapline is "everything saves as you go".
         *
         * `furthestStep` is remembered separately so the rail stays walkable in
         * BOTH directions afterwards — going back to check step 2 must not make
         * step 3 unreachable again.
         */
        const firstUnanswered = [answered.personal, answered.business]
          .findIndex((done) => !done);
        const resumeAt = firstUnanswered === -1 ? RAIL.length : firstUnanswered + 1;
        setFurthestStep(resumeAt);
        // `?step=` may only pick a step at or before the one they have reached.
        setCurrentStep(requestedStep && requestedStep <= resumeAt ? requestedStep : resumeAt);
      } catch (error) {
        console.error("Error loading profile:", error);
        setLoadFailed(true);
      } finally {
        setLoadingProfile(false);
      }
    };

    loadUserProfile();
  }, [reset, requestedStep, loadAttempt]);

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

  /**
   * Move forward a step, and remember that this member has now reached it.
   *
   * Advancing with a bare `setCurrentStep` was what made the rail forget: the
   * step opened, the member filled it in, and nothing recorded that they had
   * ever been there — so on the next visit the rail offered them step 1 again.
   */
  const advanceTo = (step: number) => {
    setFurthestStep((mark) => Math.max(mark, step));
    setCurrentStep(step);
  };

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

    if (!data.socialCategory || !data.socialCategory.trim()) {
      toast.error("Social Category is required");
      return false;
    }

    if (!data.religion || !data.religion.trim()) {
      toast.error("Religion is required");
      return false;
    }

    /*
      Checked, not merely collected.

      Social category narrows the religions on offer, and the control clears an
      incompatible answer when the category changes — but a value can also
      arrive from a saved record written before the rule existed. Saving it
      would store a combination the form itself will not let anyone pick.
    */
    if (!religionsFor(data.socialCategory).includes(data.religion)) {
      toast.error(`Please choose a religion recognised for ${data.socialCategory}`);
      return false;
    }

    if (!data.gender || !data.gender.trim()) {
      toast.error("Gender is required");
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
          socialCategory: data.socialCategory,
          religion: data.religion,
          gender: data.gender,
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
        advanceTo(2);
      }
    } else if (currentStep === 2) {
      if (!data.doingBusiness) {
        toast.error("Please select if you are doing business");
        return;
      }

      const isAspirant = data.doingBusiness === "no";

      if (!isAspirant && !data.businessYear) {
        toast.error("Please select the year your business commenced");
        return;
      }

      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      try {
        /*
         * The names the schema actually stores.
         *
         * This block used to send `organization`, `constitution`,
         * `businessYear`, `employees`, `chamber` and `govtOrgs` — none of which
         * `updateMember` reads. Mongoose strict mode dropped every one, the
         * request answered 200 and the toast said "saved", so a member filled
         * in eight fields and got two back. Two fields are asked here now, and
         * both are sent under the names the record uses.
         *
         * An aspirant sends no commencement year at all. `""` would overwrite a
         * stored year with a blank — and the membership band, and the price,
         * with it.
         */
        const businessData: Record<string, unknown> = {
          doingBusiness: data.doingBusiness,
          registrationType: isAspirant ? "aspirant" : "business",
        };
        if (!isAspirant) businessData.businessCommencementYear = data.businessYear;

        const response = await apiFetch("/members/profile", {
          method: 'PUT',
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(businessData)
        });

        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          console.error("Failed to save business information:", result);
          toast.error("Failed to save business information");
          return;
        }

        toast.success("Business information saved!");

        // Dispatch event to refresh profile completion
        window.dispatchEvent(new CustomEvent('formSubmitted'));
        window.dispatchEvent(new CustomEvent('profileUpdated'));
      } catch (error) {
        console.error("Error saving business form:", error);
        toast.error("Failed to save business information");
        return;
      }

      saveCurrentStepData(data);

      /*
        BOTH kinds of applicant continue to the declaration.

        An aspirant used to submit their whole application from this step,
        through a checkbox inside an amber panel — so the two kinds of applicant
        agreed to two differently-worded declarations on two different screens,
        and only the one on step 4 was recorded in the declaration collection.
        There is one declaration step and everybody signs it.
      */
      advanceTo(3);
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
        /*
         * An aspirant has no sister concerns to report, and the fields
         * are not on their screen — so nothing is sent for them rather
         * than a "0" the form filled in on their behalf. A stored 0 and
         * an unasked question read identically to every later report,
         * and only one of them is something the applicant said.
         */
        const isBusinessApplicant = data.doingBusiness === "yes";
        const declarationData = {
          sisterConcerns: isBusinessApplicant ? (data.sisterConcerns || "") : "",
          companyNames: isBusinessApplicant
            ? companyNames.filter(name => name.trim() !== "")
            : [],
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

      /*
       * ALREADY A MEMBER: save and stop.
       *
       * Everything above this line has written the three step records, which
       * IS the edit. Lodging another application would put a second row in
       * the admin queues for somebody already approved, and the tier reviews
       * on the first one would have nothing to do with it.
       */
      if (alreadyApplied) {
        toast.success('Your details have been updated');
        window.dispatchEvent(new CustomEvent('profileUpdated'));
        navigate('/member/profile-view');
        // `false`, not a bare `return`. The signature is `Promise<boolean>`
        // and the caller reads it as one; `undefined` happened to be falsy,
        // which is the right answer here by luck rather than by statement.
        return false;
      }

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


  /**
   * What this step is asking for.
   *
   * `getSubtitle()` was called here and defined nowhere — a ReferenceError the
   * moment the page mounted, so the whole profile form failed to render.
   */
  const getSubtitle = () => {
    if (alreadyApplied) {
      return ({
        1: 'Your personal details',
        2: 'Your business details',
        3: 'Your declaration',
      }[currentStep] || 'Your details');
    }
    return ({
      1: 'Step 1 of 3 — your personal details',
      2: 'Step 2 of 3 — your business details',
      3: 'Step 3 of 3 — your declaration',
    }[currentStep] || 'Complete the three steps to submit your application');
  };

  /**
   * The hero's node rail — one node per step, named as the header names it.
   *
   * Completion is counted in *finished* steps, so a member on step 1 sees 0%
   * rather than a quarter of the work already credited to them. It reaches 100%
   * only on submission, when the screen hands over to Application Status.
   */
  const progress = Math.round(((currentStep - 1) / RAIL.length) * 100);
  const heading = STEP_HEADING[currentStep] || STEP_HEADING[1];

  /* ------------------------------------------------- still loading */

  if (loadingProfile) {
    return (
      <MemberPageShell title="Profile Completion" subtitle="Loading your details…" width="wide">
        <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <div className="h-[22rem] animate-pulse rounded-2xl bg-slate-200/70" />
          <div className="space-y-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-200/70" />
            ))}
          </div>
        </div>
      </MemberPageShell>
    );
  }

  /* --------------------------------------------- the load failed */

  if (loadFailed) {
    return (
      <MemberPageShell title="Profile Completion" subtitle="Your details could not be loaded" width="wide">
        <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
          <p className="text-[1.625rem] font-extrabold tracking-tight text-amber-900">
            We could not load your profile
          </p>
          {/* The form is deliberately NOT rendered behind this. Empty boxes a
              member fills in and saves would overwrite the record that failed
              to load — the one outcome worse than showing nothing. */}
          <p className="mt-2 text-[1.125rem] font-semibold text-amber-800">
            Nothing is shown here rather than an empty form, which you could
            save over the details you already have.
          </p>
          <button
            type="button"
            onClick={() => setLoadAttempt((n) => n + 1)}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-6 py-3.5
                       text-[1.125rem] font-bold text-white transition-colors hover:bg-amber-700"
          >
            Try again
          </button>
        </div>
      </MemberPageShell>
    );
  }

  return (
    <MemberPageShell
      /* "Profile Completion" is what this is for somebody still applying.
         For a member whose application is decided it is My Profile — the
         screen they came to from a tile of that name, and a heading that
         tells an approved member their profile is incomplete is simply
         wrong. */
      /*
       * THE HEADING NAMES THE STEP BEING EDITED.
       *
       * It read "My Profile" on all three steps, which is the name of the
       * screen you came FROM. Pressing Edit beside "Business Information"
       * landed you on a page headed "My Profile" with no confirmation that
       * the press had taken you anywhere in particular — and on a form whose
       * fields are a scroll below the fold, the heading is the only thing on
       * screen that can say which section you are in.
       *
       * `STEP_HEADING` is the same table the step's own hero is titled from,
       * so the page heading and the hero cannot name the step differently.
       */
      title={heading.title}
      subtitle={getSubtitle()}
      /*
       * Laid out as the Application Status screen is, deliberately.
       *
       * That screen is the reference for what a member page looks like on this
       * site: `width="wide"` with a 1400px inner column, one blue gradient hero
       * carrying the headline, the percentage and a node rail, and plain white
       * `rounded-2xl` cards on `#E8EEF6` borders beneath it. This page had a
       * visual identity of its own — a free-standing square stepper above a
       * teal banner, teal gradient buttons, `text-gray-*` body copy — so it
       * read as a different product from the screen a member reaches one click
       * later. Same shell, same palette, same card treatment now.
       */
      width="wide"
      sidebar={false}
    >
      <div className="w-full">
        {/*
          THE STEP'S BLURB, AND ONLY THE BLURB.

          There was an `<h2>{heading.title}</h2>` above this line, and once the
          page header started naming the step — so that pressing Edit beside a
          section says which section you landed in — the step was titled twice,
          six lines apart:

              Personal details            <- the header band
              Your personal details

              Personal details            <- here
              Your name, how we reach you…

          The blurb stays because it is the only one of the four lines that says
          something the others do not: what this step is actually for. One
          heading, one description.

          It stays ABOVE THE GRID rather than inside the right-hand column. It
          used to be the first thing in that column, which is why the two
          columns never lined up: the form column began with ~5rem of heading
          and the membership card began with the card, so the card's top edge
          landed level with the middle of the first form card. Nothing was
          mis-set — they were being measured from different starting points.
        */}
        <p className="text-[1.1875rem] text-[#64748B] mb-6 max-w-[68ch]">{heading.blurb}</p>

        <div className="grid gap-6 lg:gap-7 lg:grid-cols-[23rem_minmax(0,1fr)] items-start">

          {/* ======================================================= left rail
              THE CARD RUNS TO THE BOTTOM OF THE VIEW.

              It used to be as tall as its own contents — brand block, four
              steps, a help line — and then stopped, leaving a stub beside a
              form column three times its height. Nothing was misaligned; the
              rail simply ended in the middle of the page and the eye read the
              white below it as something missing.

              A screen tall instead: 100vh less the header, the page padding
              above and below, and the step heading that now sits above the
              grid — so its foot lands on the fold.

              NOT STICKY, and that is the point. Sticky made the card leave its
              row the moment the page moved: it locked under the header while
              the form column kept scrolling, so the two card tops were flush at
              the top of the page and nowhere else. A pinned card that drifts
              out of line with the thing beside it reads as a misalignment every
              time you scroll, which is worse than losing the pinning. Both
              cards are ordinary items in one grid row now, so they start on the
              same line at every scroll position.

              The steps take the space they need, `Need help?` is pushed to the
              floor of the card,
              and the flexible middle absorbs the difference — so the rail meets
              the bottom of the window at every height instead of at four
              particular ones. The nav scrolls within itself on a short screen,
              so a laptop can still reach step 4. */}
          <aside className="lg:h-[calc(100vh-13.5rem)]">
            <div className="h-full flex flex-col rounded-2xl border border-[#E8EEF6] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)] overflow-hidden">

              {/* Brand and progress, in one block, so "how far am I" is answered
                  before the eye reaches the steps. */}
              <div className="shrink-0 bg-blue-600 text-white p-5 lg:p-6">
                <p className="text-[0.75rem] font-bold uppercase tracking-[0.14em] text-white/70">
                  Membership application
                </p>
                <h2 className={`${CARD_TITLE} mt-1.5`}>
                  ACTIV Membership
                </h2>
                {/*
                  COUNTED FROM THE RAIL, not typed.

                  It read "Four steps" beside a rail of three and a header
                  saying "Step 3 of 3" — the form lost a step at some point and
                  this line did not hear about it. Reading the number off
                  `RAIL.length` means the sentence cannot disagree with the
                  list underneath it again.
                */}
                <p className="text-[1rem] text-white/80 mt-1 leading-snug">
                  {alreadyApplied
                    ? 'Your membership record. Everything saves as you go.'
                    : `${STEP_WORDS[RAIL.length] || RAIL.length} steps. Everything saves as you go.`}
                </p>

                <div className="flex items-center gap-3 mt-5">
                  <div className="h-1.5 flex-1 rounded-full bg-white/25 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-white transition-all duration-500 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="font-display text-[1rem] font-extrabold tabular shrink-0">
                    {progress}%
                  </span>
                </div>
              </div>

              {/*
                  THE FOUR STEPS, SPREAD DOWN THE CARD.

                  A cleared step links back to itself; an unreached one does
                  not, so the rail can never skip a member past a form they have
                  not filled in.

                  Each row takes an equal share of the height and the connector
                  between two nodes grows with it, so a taller card reads as a
                  longer journey rather than a short list with a hole underneath.
                  What does NOT grow is the tinted panel behind the current step:
                  that hugs its own two lines, because a highlight stretched to a
                  quarter of the card is a coloured rectangle, not a marker.
                  `min-h` keeps a row legible on a laptop, at which point the nav
                  scrolls instead of crushing them. */}
              <nav className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col"
                   aria-label="Application steps">
                {RAIL.map((s, i) => {
                  // `done` paints the green tick: a step BEHIND the one on
                  // screen. `reachable` decides whether it can be clicked, and
                  // is the high-water mark — see `furthestStep`.
                  const done = s.n < currentStep;
                  const reachable = s.n <= Math.max(currentStep, furthestStep);
                  const active = s.n === currentStep;
                  const last = i === RAIL.length - 1;
                  return (
                    <button
                      key={s.n}
                      type="button"
                      onClick={() => reachable && setCurrentStep(s.n)}
                      disabled={!reachable}
                      aria-current={active ? 'step' : undefined}
                      className={`group w-full flex-1 min-h-[3.5rem] flex gap-3 text-left pl-3
                                  rounded-xl focus-visible:outline focus-visible:outline-2
                                  focus-visible:outline-offset-2 focus-visible:outline-[#1E50E6]
                                  ${reachable ? '' : 'cursor-default'}`}
                    >
                      <span className="flex flex-col items-center shrink-0 pt-2.5">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center
                                          text-[1.0625rem] font-bold transition-colors ${done
                            ? 'bg-[#16A34A] text-white'
                            : active
                              ? 'bg-[#1E50E6] text-white ring-4 ring-[#DBE6FD]'
                              : 'bg-slate-100 text-[#94A3B8]'
                          }`}>
                          {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : s.n}
                        </span>
                        {!last ? (
                          <span className={`w-0.5 flex-1 min-h-[1rem] mt-1.5 rounded-full
                                            ${done ? 'bg-[#16A34A]' : 'bg-slate-200'}`} />
                        ) : null}
                      </span>

                      <span className={`min-w-0 flex-1 self-start rounded-xl px-3 py-2.5 mr-3
                                        transition-colors ${active
                          ? 'bg-[#EEF3FE]'
                          : reachable ? 'group-hover:bg-slate-50' : ''
                        }`}>
                        <span className={`block text-[1.1875rem] font-bold leading-tight ${active
                            ? 'text-[#1E50E6]'
                            : done ? 'text-[#0F172A]' : 'text-[#94A3B8]'
                          }`}>
                          {s.name}
                        </span>
                        <span className={`block text-[1.0625rem] mt-0.5 leading-snug ${active ? 'text-[#475569]' : 'text-[#94A3B8]'
                          }`}>
                          {s.hint}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </nav>

              <div className="shrink-0 px-5 py-4 border-t border-[#F1F5F9] bg-slate-50/70">
                <p className="text-[0.75rem] font-bold uppercase tracking-[0.08em] text-[#64748B]">
                  Need help?
                </p>
                <a
                  href="https://activ.org.in"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[1rem] font-semibold text-[#1E50E6] hover:underline"
                >
                  activ.org.in
                </a>
              </div>
            </div>
          </aside>

          {/* ==================================================== the step form */}
          <div className="min-w-0 space-y-5">

            {isLocked && currentStep === 1 && (
              <div className="rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] p-4
                              flex flex-wrap items-center justify-between gap-3">
                <p className="font-display text-[1.1875rem] font-bold text-[#15803D]">
                  Profile saved successfully
                </p>
                <Button
                  type="button"
                  onClick={() => setIsLocked(false)}
                  variant="outline"
                  size="sm"
                  className="border-[#BBF7D0] text-[#15803D] hover:bg-[#DCFCE7] font-semibold"
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
              <div className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-5">
                <h3 className={`${CARD_TITLE} text-[#92400E] mb-1`}>
                  This account has no member profile
                </h3>
                <p className="text-[1rem] text-[#B45309] leading-relaxed">
                  You are signed in with an administrator account, which is stored
                  separately from member records — so there are no personal details to
                  load here, and saving this form would not work. Use an admin dashboard
                  instead, or sign in with a member account to edit a member profile.
                </p>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-5">
                <SectionGroup>

                <Section icon={User} title="About you" subtitle="The name and contact details your membership is issued against.">
                  <Fields>
                    <div>
                      <Label htmlFor="name" className={FIELD_LABEL}>Name *</Label>
                      <Input
                        id="name"
                        placeholder="Enter your full name"
                        {...register("name", { required: true })}
                        className={FIELD}
                        disabled={isLocked}
                      />
                      {errors.name && <p className="mt-1.5 text-[1.1875rem] font-semibold text-red-600">Name is required</p>}
                    </div>

                    <div>
                      <Label htmlFor="phone" className={FIELD_LABEL}>Phone Number *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="Enter phone number"
                        {...register("phone", { required: true })}
                        className={FIELD}
                        disabled={isLocked}
                      />
                      {errors.phone && <p className="mt-1.5 text-[1.1875rem] font-semibold text-red-600">Phone number is required</p>}
                    </div>

                    <div>
                      <Label htmlFor="email" className={FIELD_LABEL}>Email ID *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="Enter email"
                        {...register("email", { required: true })}
                        className={FIELD}
                        disabled={isLocked}
                      />
                      {errors.email && <p className="mt-1.5 text-[1.1875rem] font-semibold text-red-600">Email is required</p>}
                    </div>
                  </Fields>
                </Section>

                <Section icon={MapPin} title="Location" subtitle="This decides which Block, District and State admins review your application.">
                  <Fields>
                    <div>
                      <Label htmlFor="state" className={FIELD_LABEL}>State *</Label>
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
                            <SelectTrigger className={FIELD}>
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
                      {errors.state && <p className="mt-1.5 text-[1.1875rem] font-semibold text-red-600">State is required</p>}
                    </div>

                    <div>
                      <Label htmlFor="district" className={FIELD_LABEL}>District *</Label>
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
                            <SelectTrigger className={FIELD}>
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
                      {errors.district && <p className="mt-1.5 text-[1.1875rem] font-semibold text-red-600">District is required</p>}
                    </div>

                    <div>
                      <Label htmlFor="block" className={FIELD_LABEL}>Block *</Label>
                      <Controller
                        name="block"
                        control={control}
                        rules={{ required: true }}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value} disabled={!selectedDistrict || isLocked}>
                            <SelectTrigger className={FIELD}>
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
                                <div className="px-2 py-1.5 text-[1.1875rem] text-[#64748B]">No blocks available</div>
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {errors.block && <p className="mt-1.5 text-[1.1875rem] font-semibold text-red-600">Block is required</p>}
                    </div>

                    <div>
                      <Label htmlFor="city" className={FIELD_LABEL}>City *</Label>
                      <Input
                        id="city"
                        placeholder="Enter city"
                        {...register("city", { required: true })}
                        className={FIELD}
                        disabled={isLocked}
                      />
                      {errors.city && <p className="mt-1.5 text-[1.1875rem] font-semibold text-red-600">City is required</p>}
                    </div>
                  </Fields>
                </Section>

                {/*
                  Password fields are their own block now.

                  They used to sit in the middle of the personal-details grid,
                  between "Email" and "Religion", where they read as three more
                  required fields on a form that had not mentioned passwords.
                  Every member filling this in already has a password; almost
                  nobody wants to change it here. Saying that once, above the
                  three inputs, is the whole fix.
                */}
                <Section
                  icon={KeyRound}
                  title="Change your password"
                  subtitle="Optional — leave all three blank to keep the password you sign in with."
                >
                  <Fields cols={3}>
                    <div>
                      <Label htmlFor="currentPassword" className={FIELD_LABEL}>Current Password</Label>
                      <PasswordInput
                        id="currentPassword"
                        placeholder="Enter your current login password"
                        autoComplete="current-password"
                        wrapperClassName="mt-1"
                        {...register("currentPassword")}
                        disabled={isLocked}
                      />
                      <p className="text-[1.0625rem] text-[#64748B] mt-1">The password you use to sign in.</p>
                    </div>

                    <div>
                      <Label htmlFor="password" className={FIELD_LABEL}>New Password</Label>
                      <PasswordInput
                        id="password"
                        placeholder="Enter new password"
                        autoComplete="new-password"
                        wrapperClassName="mt-1"
                        {...register("password")}
                        disabled={isLocked}
                      />
                      <p className="text-[1.0625rem] text-[#64748B] mt-1">At least 8 characters.</p>
                    </div>

                    <div>
                      <Label htmlFor="confirmPassword" className={FIELD_LABEL}>Confirm Password</Label>
                      <PasswordInput
                        id="confirmPassword"
                        placeholder="Confirm new password"
                        autoComplete="new-password"
                        wrapperClassName="mt-1"
                        {...register("confirmPassword")}
                        disabled={isLocked}
                      />
                    </div>
                  </Fields>
                </Section>

                {/*
                  THREE fields, and the order is the point.

                  Social category comes FIRST because it decides the second: the
                  religions on offer depend on it. Asked the other way round, a
                  religion already chosen has to be rewritten the moment the
                  category is answered, and a field that silently changes its own
                  value reads as the form losing an answer.
                */}
                <Section
                  icon={UsersRound}
                  title="Demographic details"
                  subtitle="Used for association reporting only, never shown in the member directory."
                >
                  <Fields>
                    <div>
                      <Label htmlFor="socialCategory" className={FIELD_LABEL}>
                        Social Category <span className="text-red-500">*</span>
                      </Label>
                      <Controller
                        name="socialCategory"
                        control={control}
                        render={({ field }) => (
                          <Select
                            value={field.value}
                            onValueChange={(value) => {
                              field.onChange(value);
                              /*
                                Clear a religion the new category does not admit.

                                Cleared, not re-picked: choosing the first allowed
                                religion for them would record an answer the member
                                never gave, about their own faith. Only cleared when
                                it is genuinely incompatible, so moving between two
                                categories that both allow Hindu keeps a Hindu answer.
                              */
                              const religion = watch("religion");
                              if (religion && !religionsFor(value).includes(religion)) {
                                reset({ ...watch(), socialCategory: value, religion: "" });
                              }
                            }}
                          >
                            <SelectTrigger className={FIELD}>
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

                    <div>
                      <Label htmlFor="religion" className={FIELD_LABEL}>
                        Religion <span className="text-red-500">*</span>
                      </Label>
                      {/*
                        Religion, narrowed by the category above.

                        Scheduled Caste status under the Constitution (Scheduled
                        Castes) Order 1950 is confined to Hindu, Sikh and
                        Buddhist members, so an SC applicant is shown those three and
                        nothing else — offering the other two offers a combination
                        that cannot be true.

                        Disabled until the category is answered, rather than
                        showing all five and shrinking the list afterwards.
                        Somebody who picks Islam and then picks SC would watch
                        their own answer disappear with no explanation; this way
                        the question is simply not open yet.
                      */}
                      <Controller
                        name="religion"
                        control={control}
                        render={({ field }) => (
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={!watch("socialCategory")}
                          >
                            <SelectTrigger className={FIELD}>
                              <SelectValue placeholder="Select religion" />
                            </SelectTrigger>
                            <SelectContent>
                              {religionsFor(watch("socialCategory")).map((r) => (
                                <SelectItem key={r} value={r}>{r}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {/* Only the disabled-state prompt — see PersonalForm. */}
                      <p className="text-[1.0625rem] text-[#64748B] mt-1">
                        {!watch("socialCategory") ? "Choose a social category first." : " "}
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="gender" className={FIELD_LABEL}>
                        Gender <span className="text-red-500">*</span>
                      </Label>
                      <Controller
                        name="gender"
                        control={control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger className={FIELD}>
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                            <SelectContent>
                              {GENDERS.map((g) => (
                                <SelectItem key={g} value={g}>{g}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </Fields>
                </Section>

                </SectionGroup>

                {/*
                  The step's actions live in a bar of their own.

                  Every step ends the same way and in the same place, so the
                  button does not move as a card above it grows or a conditional
                  block opens.
                */}
                <div className="rounded-2xl bg-white border border-[#E8EEF6] shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)]
                                px-5 py-4 flex items-center gap-3">
                  <p className="text-[1rem] text-[#64748B] hidden sm:block">Step 1 of 3</p>
                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={isLocked}
                    className="ml-auto bg-[#1E50E6] hover:bg-[#1a45c9] font-bold h-11 min-w-[9rem]"
                  >
                    {isLocked ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Profile Saved
                      </>
                    ) : (
                      <>
                        Next
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-5">
                <SectionGroup>
                <Section
                  icon={Building2}
                  title="Business information"
                  subtitle="Two questions. Everything else about a company — constitution, activities, GSTIN, turnover, government registrations — is asked once in your Business Account."
                >
                  <div className="space-y-6">
                    <div>
                      <Label className="text-[1.1875rem] font-medium">
                        Are you currently doing business? <span className="text-red-500">*</span>
                      </Label>
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
                      <div>
                        <Label htmlFor="businessYear" className={FIELD_LABEL}>
                          Business Commencement Year <span className="text-red-500">*</span>
                        </Label>
                        <Controller
                          name="businessYear"
                          control={control}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger className={FIELD}>
                                <SelectValue placeholder="Select year" />
                              </SelectTrigger>
                              {/*
                                1950 to this year, newest first.

                                The list used to start at `currentYear - 49`, so a
                                company trading since 1948 — and every one older
                                than fifty years — had no year it could pick and
                                the field was left blank. The floor is a fixed
                                1950 now, and the length follows the calendar
                                instead of being frozen at 50.
                              */}
                              <SelectContent className="max-h-72">
                                {commencementYears().map((year) => (
                                  <SelectItem key={year} value={year}>{year}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        {/*
                          NO PLAN OR PRICE UNDER THIS FIELD.

                          `PlanHint` used to name the band and the amount here
                          ("Enterprise, ₹20,000 · confirmed at the payment step").
                          It is off both year fields now. The component is kept
                          and still reads the live plan rows — it was never a
                          hardcoded price, and MEMBERSHIP PRICING in CLAUDE.md
                          still governs it — so restoring it is one line if the
                          association wants the figure shown again.
                        */}
                      </div>
                    )}

                    {watch("doingBusiness") === "no" && (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                        <div className="flex items-start gap-3">
                          <div className="text-blue-600 mt-1">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                          </div>
                          <div>
                            <h4 className="font-semibold text-blue-900 mb-1">Registering as Aspirant</h4>
                            {/*
                              No declaration checkbox here any more.

                              An aspirant used to submit their whole application
                              from this panel, agreeing to a differently-worded
                              undertaking from the one on the declaration step —
                              and only the declaration step's answer was ever
                              recorded. Both kinds of applicant continue to step 3
                              and sign the same thing.
                            */}
                            <p className="text-[1.1875rem] text-blue-800">
                              You are registering as an Aspirant (student or non-business
                              member). There is nothing further to fill in here — continue
                              to the declaration to submit your application.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Section>
                </SectionGroup>

                <div className="rounded-2xl bg-white border border-[#E8EEF6] shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)]
                                px-5 py-4 flex items-center gap-3">
                  <p className="text-[1rem] text-[#64748B] hidden sm:block">Step 2 of 3</p>
                  <div className="ml-auto flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentStep(1)}
                      className="font-semibold h-11"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Previous
                    </Button>
                    <Button
                      type="button"
                      onClick={handleNext}
                      className="bg-[#1E50E6] hover:bg-[#1a45c9] font-bold h-11 min-w-[9rem]"
                    >
                      Next
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-5">
                <SectionGroup>
                {/*
                  SISTER CONCERNS IS A BUSINESS QUESTION, and step 2 has
                  already asked whether there is a business.

                  It was rendered unconditionally, so an applicant who
                  answered "no" to trading was still asked how many OTHER
                  companies they own — a question with no answer that is
                  true, on the last screen before they sign a declaration
                  that the information is correct. "Enter 0 if there are
                  none" does not rescue it: the honest answer for an
                  aspirant is that the question does not apply, and a form
                  that will not accept that is a form asking them to
                  certify a field they were made to invent.

                  An aspirant now sees the undertaking alone, which is the
                  whole of what step 3 means for them. Both kinds of
                  applicant still sign the SAME undertaking on this same
                  step — see the note on the aspirant panel in step 2.
                */}
                {watch("doingBusiness") === "yes" && (
                <Section icon={Building2} title="Sister concerns" subtitle="Other companies under the same ownership. Enter 0 if there are none.">
                <div className="space-y-6">
                <div>
                  <Label htmlFor="sisterConcerns" className={FIELD_LABEL}>No. of Sister Concerns</Label>
                  {/*
                    Controlled, not `register`-and-forget: typing here has to
                    build the boxes below, and a registered input hands its
                    value to the form without telling this component.
                  */}
                  <Input
                    id="sisterConcerns"
                    type="number"
                    placeholder="Enter number"
                    min={0}
                    value={watch("sisterConcerns") ?? ""}
                    onChange={(e) => handleSisterCountChange(e.target.value)}
                    className={FIELD}
                  />
                  <p className="text-[1.0625rem] text-[#64748B] mt-1">
                    Positive integers only — a name box appears for each one
                  </p>
                </div>

                {/*
                  Nothing to show when the answer is none. A "Name(s) of
                  Company" label over an empty list asks a question the member
                  has already answered with 0.
                */}
                {companyNames.length > 0 && (
                <div>
                  <Label htmlFor="companyName0" className={FIELD_LABEL}>Name(s) of Company</Label>
                  <div className="space-y-3 mt-2">
                    {companyNames.map((value, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          id={`companyName${index}`}
                          placeholder={`Company ${index + 1}`}
                          value={value}
                          onChange={(e) => updateCompanyName(index, e.target.value)}
                          className="flex-1"
                        />
                        {/*
                          On EVERY row, including the first.

                          Hiding it on a one-row list means the control is
                          absent exactly when somebody is looking for it, and
                          the row it would act on is right there. Deleting the
                          last row clears it rather than leaving no field —
                          `removeCompanyName` keeps one empty box — so the
                          button is never a dead end.

                          An icon, and therefore an `aria-label`: a bare icon
                          is unreadable to a screen reader, and "Remove" alone
                          would be three identical announcements on a
                          three-company list.
                        */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove company ${index + 1}`}
                          title="Remove"
                          onClick={() => removeCompanyName(index)}
                          className="shrink-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={addCompanyName}
                    className="mt-3 w-full font-semibold"
                  >
                    + Add Another Company
                  </Button>
                </div>
                )}

                </div>
                </Section>
                )}

                <Section icon={ScrollText} title="The undertaking" subtitle="Read this before you submit — it is the agreement your application is reviewed under.">
                  <div className="rounded-xl bg-[#FFFBEB] border border-[#FDE68A] p-5">
                    <p className="text-[1.1875rem] text-[#92400E] leading-relaxed">
                      This application is under the Verification and Screening Process. We have every
                      right to ACCEPT or REJECT this application according to our membership policy.
                    </p>

                    <label className="flex items-start gap-3 cursor-pointer mt-4 pt-4
                                      border-t border-[#FDE68A]">
                      <input
                        type="checkbox"
                        checked={declarationAccepted}
                        onChange={(e) => setDeclarationAccepted(e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-[#B45309] shrink-0"
                      />
                      <span className="text-[1.1875rem] font-semibold text-[#92400E]">
                        I confirm the above information is true and correct
                        <span className="text-red-600 ml-0.5">*</span>
                      </span>
                    </label>
                  </div>
                </Section>
                </SectionGroup>

                <div className="rounded-2xl bg-white border border-[#E8EEF6] shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)]
                                px-5 py-4 flex items-center gap-3">
                  <p className="text-[1rem] text-[#64748B] hidden sm:block">
                    {alreadyApplied ? 'Save your changes' : 'Last step'}
                  </p>
                  <div className="ml-auto flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentStep(2)}
                      className="font-semibold h-11"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Previous
                    </Button>
                    <Button
                      type="button"
                      onClick={handleFinalSubmit}
                      className="bg-[#1E50E6] hover:bg-[#1a45c9] font-bold h-11 min-w-[11rem]"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      {alreadyApplied ? 'Save changes' : 'Submit Application'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </MemberPageShell>
  );
}
