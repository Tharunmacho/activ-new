import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, Building2, Phone, Landmark, ReceiptText, Lock,
  BadgeCheck, TrendingUp, Save, PackageSearch,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { validateMobile } from '@/lib/phoneNumber';
import BusinessPageShell from './BusinessPageShell';
import { Card, SectionHeading, FieldGrid, Field } from './BusinessUI';
import { apiFetch } from "@/services/activApi";
import { resolveMediaUrl } from "@/config/api.config";
import { BUSINESS_TYPES, normalizeBusinessType } from '@/lib/businessTypes';
import {
  CONSTITUTION_TYPES,
  TURNOVER_RANGES,
  TURNOVER_MANUAL,
  GOVT_REGISTRATIONS,
  GOVT_SCHEMES,
} from '@/lib/memberFormOptions';
import { useActiveCompanyStore } from '@/contexts/ActiveCompanyContext';
import ProductCategoryInput from '@/components/shared/ProductCategoryInput';
import ExportCouncilInput from '@/components/shared/ExportCouncilInput';
import FinancialYearsInput from '@/components/shared/FinancialYearsInput';
import type { ProductCategory } from '@/lib/nicCodes';

/**
 * THE BUSINESS CREATION ACCOUNT — identity, business detail and finances.
 *
 * Constitution, activities, employee count, chamber membership, PAN, GSTIN,
 * ITR, turnover, government registrations and schemes were all asked during
 * registration, once per MEMBER. Every one of them describes a COMPANY, and a
 * member trading through two companies had one answer each — describing
 * whichever was filled in last, with the second company's details having
 * nowhere to go at all.
 *
 * They are asked here instead, once per company, on the screen that creates it.
 *
 * `businessCommencementYear` is deliberately NOT on this form. It is what
 * resolves the applicant's membership band and therefore the price of their
 * membership (see MEMBERSHIP PRICING in CLAUDE.md), so it has to have exactly
 * one answer per member — it stays on the registration flow's business step.
 *
 * ONE implementation, rendered by two routes.
 *
 * `/business/create-profile` (a member's FIRST company, reached from the
 * dashboard) and `/business/companies/add` (any company after it) were two
 * separate screens asking overlapping subsets of the same questions — one
 * required an email address and the other did not, one sent multipart always
 * and the other only with a logo. Adding the constitution, turnover and
 * registration sections to both would have been two copies of twenty fields,
 * which is precisely how the five disagreeing `businessType` lists documented
 * in `businessTypes.js` came about. Both routes render this.
 */

/**
 * `filedITR` and `memberOfOtherChamber` are Booleans on the schema; these
 * controls hold strings.
 *
 * A saved `false` spread straight into state leaves a control that compares
 * `=== 'no'` showing nothing selected, so a member who answered the question
 * came back to a blank form and could not tell it had saved. Same failure in
 * both directions as the `doingBusiness` / `registrationType` disagreement
 * documented in `member.controller.js`.
 */
const toChoice = (value: unknown): string => {
  if (value === true || value === 'yes' || value === 'true') return 'yes';
  if (value === false || value === 'no' || value === 'false') return 'no';
  return '';
};

/** `''` is "unanswered" and is not sent — it would blank the stored answer. */
const toBool = (choice: string): boolean | undefined =>
  choice === 'yes' ? true : choice === 'no' ? false : undefined;

const asArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((v) => String(v)) : [];

interface CompanyFormData {
  // Identity & contact
  businessName: string;
  description: string;
  businessType: string;
  mobileNumber: string;
  email: string;
  area: string;
  location: string;
  logo: string;
  // Business detail
  constitutionType: string;
  businessActivities: string;
  productCategories: ProductCategory[];
  numberOfEmployees: string;
  memberOfOtherChamber: string;
  otherChamber: string;
  // Financial
  panNumber: string;
  gstNumber: string;
  filedITR: string;
  itrYears: string;
  turnoverRange: string;
  turnoverOther: string;
  // Government
  govtRegistrations: string[];
  msmeUdyamNumber: string;
  nsicRegistrationNumber: string;
  exportCouncilName: string;
  exportCouncilRegNumber: string;
  otherRegistrationDetails: string;
  govtSchemes: string[];
  schemeDetails: string;
}

const EMPTY_FORM: CompanyFormData = {
  businessName: '',
  description: '',
  businessType: '',
  mobileNumber: '',
  email: '',
  area: '',
  location: '',
  logo: '',
  constitutionType: '',
  businessActivities: '',
  productCategories: [],
  numberOfEmployees: '',
  memberOfOtherChamber: '',
  otherChamber: '',
  panNumber: '',
  gstNumber: '',
  filedITR: '',
  itrYears: '',
  turnoverRange: '',
  turnoverOther: '',
  govtRegistrations: [],
  msmeUdyamNumber: '',
  nsicRegistrationNumber: '',
  exportCouncilName: '',
  exportCouncilRegNumber: '',
  otherRegistrationDetails: '',
  govtSchemes: [],
  schemeDetails: '',
};

/** A selectable pill — the business area's own idiom for a short option list. */
const Pill = ({
  label, selected, onClick,
}: { label: string; selected: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={`px-5 py-3 rounded-xl text-[1.25rem] font-bold border transition-colors ${selected
      ? 'bg-blue-600 text-white border-blue-600'
      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
      }`}
  >
    {label}
  </button>
);

/** Yes / no. Answering neither is allowed — none of this is required. */
const YesNo = ({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) => (
  <div className="flex gap-2">
    <Pill label="Yes" selected={value === 'yes'} onClick={() => onChange('yes')} />
    <Pill label="No" selected={value === 'no'} onClick={() => onChange('no')} />
  </div>
);

/**
 * A ticked card — one body a company may be registered with.
 *
 * A real `<input type="checkbox">` rather than a styled button with
 * `aria-pressed`: these are independent additions, not a pick-one, and a
 * checkbox is the control that says so to a screen reader as well as to the
 * eye. (The same distinction `CmsChoice` / `CmsCheck` draws on the CMS side.)
 */
const CheckCard = ({
  label, description, checked, onChange, lockedNote,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  /**
   * Why this one cannot be turned off, when it cannot.
   *
   * Present means locked. A disabled tick with no reason beside it reads as a
   * broken control; naming the cause makes it a consequence of something the
   * member themselves did.
   */
  lockedNote?: string;
}) => (
  <label
    className={`flex items-start gap-3.5 rounded-xl border p-5 transition-colors ${lockedNote ? 'cursor-default' : 'cursor-pointer'} ${checked
      ? 'border-blue-500 bg-blue-50/60'
      : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
  >
    <input
      type="checkbox"
      checked={checked}
      disabled={Boolean(lockedNote)}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-0.5 h-[1.125rem] w-[1.125rem] shrink-0 accent-blue-600
                 disabled:cursor-not-allowed"
    />
    <span className="min-w-0">
      <span className="block text-[1.25rem] font-bold text-slate-800">{label}</span>
      <span className="block text-[1.1875rem] text-slate-500 mt-1">{description}</span>
      {lockedNote ? (
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-blue-100/70 px-2 py-1
                         text-[1rem] font-semibold text-blue-800">
          <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {lockedNote}
        </span>
      ) : null}
    </span>
  </label>
);

/** A titled band inside a card, for a card that carries two questions. */
const Subsection = ({
  title, hint, children,
}: { title: string; hint?: string; children: React.ReactNode }) => (
  <div className="pt-5 mt-5 border-t border-slate-100 first:pt-0 first:mt-0 first:border-t-0">
    <p className="text-[1.375rem] font-extrabold tracking-tight text-slate-900">{title}</p>
    {hint ? <p className="text-[1.1875rem] text-slate-500 mt-1 mb-3.5">{hint}</p> : <div className="mb-3.5" />}
    {children}
  </div>
);

export interface CompanyFormProps {
  /** The company being edited. Absent means this form creates one. */
  companyId?: string;
  /** Page title and strapline — the two routes name the same job differently. */
  title: string;
  subtitle: string;
  /** Where a save returns to. */
  returnTo: string;
  /**
   * Where Cancel goes, when that is not where a save goes.
   *
   * They were the same value, and on the create-first-company route that made
   * Cancel a loop: it returned to the business dashboard, whose entire content
   * for a member with no company is an empty state and a button back to this
   * form. Leaving a form should land somewhere with something on it.
   */
  cancelTo?: string;
  /**
   * Render the business rail.
   *
   * Off for the first-company form: every link in that rail — Products, Stock,
   * Discover, Analytics — describes a company that does not exist yet, so it
   * was being shown greyed out. Eight inert controls framing the one form that
   * matters reads as a broken page rather than a focused one.
   */
  sidebar?: boolean;
  /** Label for the primary button when creating. */
  createLabel?: string;
  /**
   * Grey out the rest of the business rail.
   *
   * True only on the first-company screen, and only once the lookup has
   * CONFIRMED there is no company yet — every other business screen is scoped
   * to a company that does not exist, so the links go nowhere. An unknown
   * answer must fail open; see the note in `BusinessProfile`.
   */
  disableNavigation?: boolean;
}

const CompanyForm = ({
  companyId,
  title,
  subtitle,
  returnTo,
  cancelTo,
  sidebar = true,
  createLabel = 'Create Company',
  disableNavigation = false,
}: CompanyFormProps) => {
  const navigate = useNavigate();
  const id = companyId;
  const isEditMode = Boolean(id);

  const { loadCompanies } = useActiveCompanyStore();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CompanyFormData>(EMPTY_FORM);
  const [logoPreview, setLogoPreview] = useState('');
  /**
   * The chosen file itself, kept alongside the preview.
   *
   * The logo was read with `FileReader` and posted as a base64 string in a JSON
   * `logo` field. `createBusinessProfile` / `updateBusinessProfileById` take the
   * logo from `req.file` — multer, multipart — and never destructure `logo`
   * from the body, so that string was dropped on the floor. The request still
   * answered `success: true` (everything *else* in it saved), the toast said
   * "Company updated successfully", and the logo silently never changed. Mobile
   * has always sent multipart; so does this now.
   */
  const [logoFile, setLogoFile] = useState<File | null>(null);
  /** The cover image, held the same way and for the same reasons as the logo. */
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string>('');

  useEffect(() => {
    if (isEditMode) {
      fetchCompanyData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchCompanyData = async () => {
    try {
      const response = await apiFetch(`/business-profiles/${id}`);
      const result = await response.json();

      if (result.success) {
        const d = result.data || {};
        setFormData({
          businessName: d.businessName || '',
          description: d.description || '',
          // A row written before the lists were reconciled can hold a value
          // this select no longer offers; '' makes the user pick a valid one
          // rather than showing a blank that silently saves the old value.
          businessType: normalizeBusinessType(d.businessType),
          mobileNumber: d.mobileNumber || '',
          email: d.email || '',
          area: d.area || '',
          location: d.location || '',
          logo: d.logo || '',
          constitutionType: d.constitutionType || '',
          businessActivities: d.businessActivities || '',
          productCategories: Array.isArray(d.productCategories)
            ? d.productCategories.map((entry: any) => ({
              code: entry?.code || '',
              description: entry?.description || '',
              industryType: entry?.industryType || '',
            })).filter((entry: ProductCategory) => entry.description)
            : [],
          numberOfEmployees: d.numberOfEmployees || '',
          memberOfOtherChamber: toChoice(d.memberOfOtherChamber),
          otherChamber: d.otherChamber || '',
          // `panNumber` is `select: false` on the schema; the owner-scoped read
          // asks for it by name, so it is here. If it ever comes back missing,
          // '' plus the "leave blank to keep" hint below is the safe reading.
          panNumber: d.panNumber || '',
          gstNumber: d.gstNumber || '',
          filedITR: toChoice(d.filedITR),
          itrYears: d.itrYears || '',
          turnoverRange: d.turnoverRange || '',
          turnoverOther: d.turnoverOther || '',
          govtRegistrations: asArray(d.govtRegistrations),
          msmeUdyamNumber: d.msmeUdyamNumber || '',
          nsicRegistrationNumber: d.nsicRegistrationNumber || '',
          exportCouncilName: d.exportCouncilName || '',
          exportCouncilRegNumber: d.exportCouncilRegNumber || '',
          otherRegistrationDetails: d.otherRegistrationDetails || '',
          govtSchemes: asArray(d.govtSchemes),
          schemeDetails: d.schemeDetails || '',
        });
        if (d.logo) {
          setLogoPreview(d.logo);
        }
        if (d.banner) {
          setBannerPreview(d.banner);
        }
      }
    } catch (error) {
      console.error('Error fetching company:', error);
      toast.error('Failed to fetch company data');
    }
  };

  const setField = <K extends keyof CompanyFormData>(field: K, value: CompanyFormData[K]) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleIn = (field: 'govtRegistrations' | 'govtSchemes', value: string) =>
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v) => v !== value)
        : [...prev[field], value],
    }));

  /**
   * NSIC TICKS MSME / UDYAM AND HOLDS IT ON.
   *
   * NSIC's Single Point Registration is issued BY the National Small Industries
   * Corporation TO firms that are already registered MSMEs — the Udyam
   * registration is what makes a firm eligible to apply for it. So a company
   * ticking NSIC has told us it is an MSME whether or not it thought to tick
   * that too, and plenty will not: NSIC is the thing they were asked for by a
   * tender, Udyam is paperwork they filed years ago. Ticking it for them is the
   * difference between a complete record and one missing the registration every
   * MSME benefit is keyed on.
   *
   * LOCKED rather than merely ticked, because the two are not independent
   * answers. Leaving MSME untickable-off would let a member produce
   * "NSIC yes, MSME no" in two clicks, which describes a company that cannot
   * exist. The lock is shown and explained on the card, so it reads as a
   * consequence of their own NSIC tick rather than as a control that has
   * stopped working — and unticking NSIC releases it immediately.
   */
  const msmeLockedByNsic = formData.govtRegistrations.includes('NSIC');

  const toggleRegistration = (body: string) =>
    setFormData((prev) => {
      const has = prev.govtRegistrations.includes(body);

      // The lock, enforced in the state and not only in the markup: a disabled
      // input is a hint to a mouse, not a guarantee.
      if (body === 'MSME / Udyam' && has && prev.govtRegistrations.includes('NSIC')) {
        return prev;
      }

      let next = has
        ? prev.govtRegistrations.filter((v) => v !== body)
        : [...prev.govtRegistrations, body];

      if (body === 'NSIC' && !has && !next.includes('MSME / Udyam')) {
        next = [...next, 'MSME / Udyam'];
      }

      return {
        ...prev,
        govtRegistrations: next,
        // A number whose body is no longer ticked has nowhere on screen to be
        // corrected, so it goes with it — the same rule the save path applies.
        msmeUdyamNumber: next.includes('MSME / Udyam') ? prev.msmeUdyamNumber : '',
        nsicRegistrationNumber: next.includes('NSIC') ? prev.nsicRegistrationNumber : '',
      };
    });

  /** "None" is exclusive: picking it clears the rest, and vice versa. */
  const toggleScheme = (scheme: string) =>
    setFormData((prev) => {
      const selected = prev.govtSchemes.includes(scheme);
      if (scheme === 'None') {
        return { ...prev, govtSchemes: selected ? [] : ['None'], schemeDetails: '' };
      }
      const next = selected
        ? prev.govtSchemes.filter((s) => s !== scheme)
        : [...prev.govtSchemes.filter((s) => s !== 'None'), scheme];
      return { ...prev, govtSchemes: next };
    });

  const registeredWith = (body: string) => formData.govtRegistrations.includes(body);
  const isManualTurnover = formData.turnoverRange === TURNOVER_MANUAL;

  /** What the description under each registration checkbox says. */
  const registrationHints = useMemo<Record<string, string>>(() => ({
    'Export Councils': 'EPC, FIEO or a commodity board',
    'MSME / Udyam': 'Micro, small or medium enterprise registration',
    'NSIC': 'National Small Industries Corporation — the government body supporting MSMEs',
    'Other': 'Any other government body you are registered with',
  }), []);

  /**
   * The cover image. Same rules as the logo, and a wider cap.
   *
   * 4MB rather than the logo's 2: a banner is a landscape photograph where a
   * logo is a small square mark, and holding both to the same limit would fail
   * a perfectly ordinary cover for being what it is.
   */
  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error('Please upload an image smaller than 4MB');
      return;
    }
    setBannerFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setBannerPreview(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file');
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        toast.error('Please upload an image smaller than 2MB');
        return;
      }

      // The file is what gets uploaded; the data URL is only for the preview
      // beside the picker, and is deliberately NOT put into formData.logo.
      setLogoFile(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  /**
   * The request body, built once and rendered into whichever transport is used.
   *
   * Real Booleans and real arrays. An unanswered yes/no is `''`, which Mongoose
   * cannot cast to Boolean — it threw a ValidationError and the request came
   * back 500 with no message a member could act on — so an unanswered question
   * is left out of the payload entirely, which is what "unanswered" means.
   */
  const buildPayload = (): Record<string, unknown> => {
    const payload: Record<string, unknown> = {
      businessName: formData.businessName.trim(),
      description: formData.description.trim(),
      businessType: formData.businessType,
      mobileNumber: formData.mobileNumber.trim(),
      email: formData.email.trim(),
      area: formData.area.trim(),
      location: formData.location.trim(),
      constitutionType: formData.constitutionType,
      businessActivities: formData.businessActivities.trim(),
      productCategories: formData.productCategories,
      numberOfEmployees: formData.numberOfEmployees.trim(),
      otherChamber: formData.otherChamber.trim(),
      panNumber: formData.panNumber.trim(),
      gstNumber: formData.gstNumber.trim(),
      turnoverRange: formData.turnoverRange,
      // The manual figure belongs to exactly one slab. Sending a stale one
      // alongside a picked slab would store two turnovers that disagree.
      turnoverOther: isManualTurnover ? formData.turnoverOther.trim() : '',
      govtRegistrations: formData.govtRegistrations,
      // Each detail field is cleared when its body is unticked, for the same
      // reason: a number nothing on screen shows is a number nobody can correct.
      msmeUdyamNumber: registeredWith('MSME / Udyam') ? formData.msmeUdyamNumber.trim() : '',
      nsicRegistrationNumber:
        registeredWith('NSIC') ? formData.nsicRegistrationNumber.trim() : '',
      exportCouncilName: registeredWith('Export Councils') ? formData.exportCouncilName.trim() : '',
      exportCouncilRegNumber:
        registeredWith('Export Councils') ? formData.exportCouncilRegNumber.trim() : '',
      otherRegistrationDetails:
        registeredWith('Other') ? formData.otherRegistrationDetails.trim() : '',
      govtSchemes: formData.govtSchemes,
      schemeDetails: formData.govtSchemes.includes('Others') ? formData.schemeDetails.trim() : '',
    };

    const chamber = toBool(formData.memberOfOtherChamber);
    if (chamber !== undefined) payload.memberOfOtherChamber = chamber;

    const itr = toBool(formData.filedITR);
    if (itr !== undefined) payload.filedITR = itr;
    // Cleared when the answer is anything but yes, so a stale list of years
    // cannot outlive the "no" that contradicts it.
    payload.itrYears = formData.filedITR === 'yes' ? formData.itrYears.trim() : '';

    return payload;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    /*
     * FOUR REQUIRED FIELDS, AND ONLY FOUR.
     *
     * Name, type, mobile and city are what make this a company record rather
     * than a blank one: the directory lists it by name, Discover filters it by
     * type and city, and the mobile is how another member reaches it. Nothing
     * downstream works without them.
     *
     * EVERYTHING ELSE IS OPTIONAL, deliberately — the PAN, the GSTIN, the
     * turnover, the registrations and their numbers. Those are the answers a
     * member has to go and look up, and a form that will not save until they
     * are found is a form abandoned halfway or filled with invented values. An
     * invented GSTIN is worse than an empty one, because nothing later can tell
     * it is wrong.
     *
     * A MALFORMED value is still an error wherever one is given: "not a number
     * I can read" and "no number yet" are different answers.
     */
    if (!formData.businessName.trim()) {
      toast.error('Business name is required');
      return;
    }
    if (!formData.businessType) {
      toast.error('Business type is required');
      return;
    }
    if (!formData.mobileNumber.trim()) {
      toast.error('Mobile number is required');
      return;
    }
    if (!formData.location.trim()) {
      toast.error('City / location is required');
      return;
    }

    /*
     * THREE YEARS, once "yes" has been answered.
     *
     * Only when the company said it HAS filed: a company that has not is not
     * being asked for years, and a guard that fired on them would refuse a
     * perfectly complete form. The picker says the same thing while they are
     * filling it in; this is the last line, for a form submitted anyway.
     */
    if (formData.filedITR === 'yes') {
      const years = String(formData.itrYears || '')
        .split(/[,;]/).map((y) => y.trim()).filter(Boolean);
      if (years.length < 3) {
        toast.error(
          years.length === 0
            ? 'Pick the three financial years returns were filed for'
            : `Pick 3 financial years — ${3 - years.length} more to go`,
        );
        return;
      }
    }

    const phone = validateMobile(formData.mobileNumber, undefined, 'Mobile number');
    if (!phone.ok) {
      toast.error(phone.reason);
      return;
    }

    setLoading(true);

    try {
      const url = isEditMode ? `/business-profiles/${id}` : '/business-profiles';
      const method = isEditMode ? 'PUT' : 'POST';
      const payload = buildPayload();

      /**
       * Multipart when a new logo was picked, JSON otherwise.
       *
       * `apiFetch` drops its own Content-Type for a FormData body so the
       * browser can set the multipart boundary; setting it by hand here would
       * produce a body multer cannot parse.
       *
       * EVERY field of a multipart body is a string, so the arrays go over as
       * JSON and the Booleans as `"true"` / `"false"` — the server reads both
       * shapes. Sending `[object Object]` for a list, or letting a flag survive
       * a text-only save and vanish the moment an image is attached, is the
       * failure this file already carries a note about for `logo` itself.
       */
      let body: BodyInit;
      if (logoFile || bannerFile) {
        const form = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          if (Array.isArray(value)) form.append(key, JSON.stringify(value));
          else form.append(key, String(value ?? ''));
        });
        // Only what was actually re-picked. An absent part means "leave it",
        // which is what the server reads it as.
        if (logoFile) form.append('logo', logoFile);
        if (bannerFile) form.append('banner', bannerFile);
        body = form;
      } else {
        body = JSON.stringify(payload);
      }

      const response = await apiFetch(url, { method, body });
      const result = await response.json();

      if (result.success) {
        toast.success(isEditMode ? 'Company updated successfully' : 'Company created successfully');
        // Every screen reads the shared selection; refresh it so the new name
        // and logo reach the sidebar without a reload.
        await loadCompanies({ force: true });
        navigate(returnTo);
      } else {
        toast.error(result.message || `Failed to ${isEditMode ? 'update' : 'create'} company`);
      }
    } catch (error) {
      console.error('Error saving company:', error);
      toast.error(`An error occurred while ${isEditMode ? 'updating' : 'creating'} the company`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BusinessPageShell
      title={title}
      subtitle={isEditMode && formData.businessName ? formData.businessName : subtitle}
      /*
        FILL THE WINDOW when there is no rail taking up the left of it.

        `standard` caps at 72rem, which on a 1900px monitor left ~370px of bare
        page down each side while the form scrolled for three screens. `form`
        is 96rem: it fills a laptop and still holds the field widths steady on
        anything larger. A screen WITH the rail keeps the cap, because the rail
        already occupies that space.
      */
      width={sidebar ? 'standard' : 'form'}
      surface={sidebar ? 'muted' : 'white'}
      disableNavigation={disableNavigation}
      sidebar={sidebar}
      backTo={cancelTo || returnTo}
      /*
        NO BUTTONS IN THE HEADER.

        Cancel and the submit were in both the header and the foot of the form,
        which is one decision offered twice: on a page this long the header pair
        is permanently on screen, so the destructive one sits a stray click away
        from the fields for the whole time the form is being filled in. The foot
        of the form is where a form is finished, and that is the only place they
        are now. The header is a title and the way back.
      */
    >
      {/*
          Three columns from lg up: identity and the section rail on the left,
          the questions on the right.

          The form was a single `space-y-6` column of six full-width fields
          inside an `max-w-4xl` card, so a ten-digit mobile number sat in an
          850px-wide input while the page still scrolled. It now carries five
          times as many questions, which is exactly why they are banded into
          named sections with a rail rather than run together: a member filling
          in a GSTIN needs to see that they are past the contact details and how
          much is left.
      */}
      {/*
          ONE COLUMN, FULL WIDTH, IN READING ORDER.

          This was a three-column grid: the logo and a jump-list pinned left,
          the questions scrolling on the right. No other screen in this product
          is laid out that way, so the page did not look like the site it is
          part of — and the pinned column left the questions in a narrow strip
          with the two-column field grids inside it squeezed to nothing.

          It is now what every other form here is: titled cards stacked down one
          measured column, each section introduced by its own heading. The same
          shape as `RegistrationFormShell`'s `FormCard`, which is what a member
          has just filled in four of on their way to this screen.

          No jump-list. Seven headings down one column ARE the contents, and a
          second copy of them in a pinned card was furniture, not navigation.
      */}
      {/*
          A GRID OF CARDS, the way the dashboards are laid out — not one tall
          card beside a short one.

          The previous arrangement put identity on the left and EVERYTHING else
          in a single card on the right. The left card ran out after four
          questions and the right one carried on for three screens, so from the
          logo downwards the page was a column of questions beside a column of
          nothing. That empty half is what read as unaligned.

          So the sections are cards again, and they are laid out in rows that
          balance. The top row is the pair that belong together — who the
          company is, and what it does. The rows under it hold the sections a
          member fills in from paperwork, two across, each roughly the height of
          the one beside it.

          Every row collapses to one column below `lg`, in this same order.
      */}
      <form id="company-form" onSubmit={handleSubmit}>
                <div className="space-y-6">

          {/* Identity, and what the company trades in. */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 h-full">
            <Card id="identity" padded={false} className="p-6 h-full !border !border-slate-200 !shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_30px_-12px_rgba(16,24,40,0.28)]">
              <SectionHeading
                title="Company Identity &amp; Contact"
                description="Your mark, and how members reach you"
                icon={Building2}
              />
              {/*
                  THE COVER, ABOVE THE MARK — the order they appear in.

                  A wide, short dropzone, because that is the shape of the thing
                  being asked for: a square box would invite a square image and
                  then crop most of it away.
              */}
              <label
                htmlFor="company-banner"
                className="block mb-5 rounded-2xl border-2 border-dashed border-slate-300
                           hover:border-blue-500 hover:bg-slate-100 transition-colors
                           cursor-pointer overflow-hidden bg-slate-50"
              >
                {bannerPreview ? (
                  <img
                    src={resolveMediaUrl(bannerPreview)}
                    alt="Cover preview"
                    className="w-full h-28 object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-28 px-4 text-center">
                    <Upload className="h-6 w-6 text-slate-400 mb-1.5" />
                    <p className="text-[1.25rem] font-bold text-slate-700">Upload Cover Banner</p>
                    <p className="text-[1.1875rem] text-slate-500">Wide image, max 4MB &middot; optional</p>
                  </div>
                )}
              </label>
              <input
                id="company-banner"
                type="file"
                accept="image/*"
                onChange={handleBannerUpload}
                className="hidden"
              />

              {/*
                  `max-w-sm`. A logo is a small square image, and the dropzone
                  was sized for the narrow pinned column this card used to sit
                  in. Full width it became a 1150px dashed rectangle asking for
                  a 200px file, which reads as a banner upload.
              */}
              <label
                htmlFor="company-logo"
                className="block rounded-2xl border-2 border-dashed border-slate-300
                           hover:border-blue-500 hover:bg-slate-100 transition-colors
                           cursor-pointer overflow-hidden bg-slate-50"
              >
                {/* A stored `/uploads/...` path belongs to the API origin, not to
                    this site; a freshly picked file is a data: URL and is returned
                    untouched. */}
                {logoPreview ? (
                  <img
                    src={resolveMediaUrl(logoPreview)}
                    alt="Logo preview"
                    className="w-full h-36 object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-36 px-4 text-center">
                    <Upload className="h-9 w-9 text-slate-400 mb-3" />
                    <p className="text-[1.25rem] font-bold text-slate-700">Upload Company Logo</p>
                    <p className="text-[1.1875rem] text-slate-500 mt-1">JPG or PNG, max 2MB &middot; optional</p>
                  </div>
                )}
              </label>
              <input
                id="company-logo"
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              {logoPreview ? (
                <p className="text-[1.1875rem] text-slate-500 mt-2 text-center">Click the image to change it</p>
              ) : null}

              <Subsection title="Contact" hint="How other members reach this company">
              {/*
                  ONE FIELD PER ROW in this column.

                  `FieldGrid` goes two-up from `md`, which is right in a
                  full-width card and wrong in a third-width one: it gave
                  each contact field ~170px and truncated "Enter 10-digit
                  mobile number" to "Enter 10-digit mob". The breakpoint
                  describes the WINDOW; this column is narrow at every
                  window size, so the override is unconditional.
              */}
              <FieldGrid className="md:grid-cols-1">
                <Field label="Mobile Number" required>
                  <Input
                    name="mobileNumber"
                    type="tel"
                    placeholder="Enter 10-digit mobile number"
                    value={formData.mobileNumber}
                    onChange={handleInputChange}
                    className="h-12 !text-[1.25rem] bg-slate-50 border-slate-200 placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-blue-500"
                  />
                </Field>

                <Field label="Email Address">
                  <Input
                    name="email"
                    type="email"
                    placeholder="Enter email address"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="h-12 !text-[1.25rem] bg-slate-50 border-slate-200 placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-blue-500"
                  />
                </Field>

                <Field label="City / Location" required>
                  <Input
                    name="location"
                    placeholder="City, State"
                    value={formData.location}
                    onChange={handleInputChange}
                    className="h-12 !text-[1.25rem] bg-slate-50 border-slate-200 placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-blue-500"
                  />
                </Field>

                <Field label="Area / Locality">
                  <Input
                    name="area"
                    placeholder="e.g. Guindy Industrial Estate"
                    value={formData.area}
                    onChange={handleInputChange}
                    className="h-12 !text-[1.25rem] bg-slate-50 border-slate-200 placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-blue-500"
                  />
                </Field>
              </FieldGrid>
              </Subsection>
            </Card>
            </div>
            <div className="lg:col-span-2 h-full">
            <Card id="details" padded={false} className="p-6 h-full !border !border-slate-200 !shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_30px_-12px_rgba(16,24,40,0.28)]">
              <SectionHeading
                title="Business Details"
                description="What the company is and what it does"
                icon={Building2}
              />
              <FieldGrid>
                <Field label="Business Name" required>
                  <Input
                    name="businessName"
                    placeholder="Enter business name"
                    value={formData.businessName}
                    onChange={handleInputChange}
                    className="h-12 !text-[1.25rem] bg-slate-50 border-slate-200 placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-blue-500"
                  />
                </Field>

                <Field label="Type of Business" required>
                  <Select
                    value={formData.businessType}
                    onValueChange={(value) => setField('businessType', value)}
                  >
                    <SelectTrigger className="h-12 !text-[1.25rem] font-semibold bg-slate-50 border-slate-200 data-[placeholder]:font-normal data-[placeholder]:text-slate-400 focus:bg-white focus:ring-blue-500">
                      <SelectValue placeholder="Select a business type" />
                    </SelectTrigger>
                    <SelectContent>
                      {BUSINESS_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Constitution of Company">
                  <Select
                    value={formData.constitutionType}
                    onValueChange={(value) => setField('constitutionType', value)}
                  >
                    <SelectTrigger className="h-12 !text-[1.25rem] font-semibold bg-slate-50 border-slate-200 data-[placeholder]:font-normal data-[placeholder]:text-slate-400 focus:bg-white focus:ring-blue-500">
                      <SelectValue placeholder="Select a constitution" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONSTITUTION_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Number of Employees">
                  <Input
                    name="numberOfEmployees"
                    inputMode="numeric"
                    placeholder="e.g. 25"
                    value={formData.numberOfEmployees}
                    onChange={handleInputChange}
                    className="h-12 !text-[1.25rem] bg-slate-50 border-slate-200 placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-blue-500"
                  />
                </Field>

                <Field
                  label="Business Activities"
                  full
                  hint="What the company actually makes, sells or provides"
                >
                  <Textarea
                    name="businessActivities"
                    placeholder="e.g. Precision machining of automotive components"
                    value={formData.businessActivities}
                    onChange={handleInputChange}
                    className="min-h-[5rem] !text-[1.25rem] bg-slate-50 border-slate-200 placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-blue-500"
                  />
                </Field>

                <Field
                  label="Description"
                  full
                  hint="Shown to other members in the Discover directory"
                >
                  <Textarea
                    name="description"
                    placeholder="Describe your company offerings…"
                    value={formData.description}
                    onChange={handleInputChange}
                    className="min-h-[6rem] !text-[1.25rem] bg-slate-50 border-slate-200 placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-blue-500"
                  />
                </Field>
              </FieldGrid>
            </Card>
            </div>
          </div>

          {/* Two short sections, side by side. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card id="products" padded={false} className="p-6 h-full !border !border-slate-200 !shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_30px_-12px_rgba(16,24,40,0.28)]">
              <SectionHeading
                title="Product Category"
                description="What this company makes or does, classified against NIC"
                icon={PackageSearch}
              />
              <Field
                label="Product categories"
                hint="Type a product or service name — or a NIC code if you know it. Pick as many as apply."
              >
                <ProductCategoryInput
                  value={formData.productCategories}
                  onChange={(next) => setField('productCategories', next)}
                />
              </Field>
            </Card>
            <Card id="affiliations" padded={false} className="p-6 h-full !border !border-slate-200 !shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_30px_-12px_rgba(16,24,40,0.28)]">
              <SectionHeading
                title="Memberships &amp; Affiliations"
                description="Other chambers this company belongs to"
                icon={Landmark}
              />
              <Field label="Is this company a member of another chamber?">
                <YesNo
                  value={formData.memberOfOtherChamber}
                  onChange={(v) => setField('memberOfOtherChamber', v)}
                />
              </Field>

              {formData.memberOfOtherChamber === 'yes' && (
                <div className="mt-5">
                  <Field label="Which chamber?">
                    <Input
                      name="otherChamber"
                      placeholder="Name the chamber"
                      value={formData.otherChamber}
                      onChange={handleInputChange}
                      className="h-12 !text-[1.25rem] bg-slate-50 border-slate-200 placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-blue-500"
                    />
                  </Field>
                </div>
              )}
            </Card>
          </div>

          {/* The two paperwork sections, likewise. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card id="financial" padded={false} className="p-6 h-full !border !border-slate-200 !shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_30px_-12px_rgba(16,24,40,0.28)]">
              <SectionHeading
                title="Financial Information"
                description="Registration numbers, filing history and scale"
                icon={ReceiptText}
              />
              <Subsection
                title="Tax identification"
                hint="Kept private — never shown in the member directory."
              >
                <FieldGrid>
                  <Field label="PAN Number">
                    <Input
                      value={formData.panNumber}
                      onChange={(e) => setField('panNumber', e.target.value.toUpperCase())}
                      placeholder="ABCDE1234F"
                      maxLength={10}
                      className="h-12 !text-[1.25rem] bg-slate-50 border-slate-200 placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-blue-500"
                    />
                  </Field>

                  <Field label="GSTIN Number">
                    <Input
                      value={formData.gstNumber}
                      onChange={(e) => setField('gstNumber', e.target.value.toUpperCase())}
                      placeholder="22AAAAA0000A1Z5"
                      maxLength={15}
                      className="h-12 !text-[1.25rem] bg-slate-50 border-slate-200 placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-blue-500"
                    />
                  </Field>
                </FieldGrid>
              </Subsection>

              <Subsection title="Income tax">
                <Field label="Has this company filed Income Tax Returns?">
                  <YesNo value={formData.filedITR} onChange={(v) => setField('filedITR', v)} />
                </Field>
              
                {/*
                    "Yes" has to lead somewhere. Answering it changed nothing on
                    screen, which reads as a click that did not register — and
                    recorded that returns exist while asking nothing about them.
                */}
                {formData.filedITR === 'yes' && (
                  <div className="mt-5">
                    <FieldGrid>
                      {/*
                        PICKED, not described.

                        This was a free-text box whose own hint offered three
                        incompatible ways to answer — “last 3 years”, a range,
                        “since inception” — and the first of those means a
                        different thing every year it is read back.
                      */}
                      <Field
                        label="Years filed"
                        hint="Pick the three financial years returns were filed for."
                      >
                        <FinancialYearsInput
                          value={formData.itrYears}
                          onChange={(itrYears) => setField('itrYears', itrYears)}
                        />
                      </Field>
                    </FieldGrid>
                  </div>
                )}
              </Subsection>

              <Subsection
                title="Annual turnover"
                hint="Pick the slab this company falls in, or enter the figure yourself."
              >
                <FieldGrid>
                  <Field label="Turnover">
                    <Select
                      value={formData.turnoverRange}
                      onValueChange={(v) => setField('turnoverRange', v)}
                    >
                      <SelectTrigger className="h-12 !text-[1.25rem] font-semibold bg-slate-50 border-slate-200 data-[placeholder]:font-normal data-[placeholder]:text-slate-400 focus:bg-white focus:ring-blue-500">
                        <SelectValue placeholder="Select turnover range" />
                      </SelectTrigger>
                      {/* Thirteen slabs — capped so the list scrolls rather than
                          covering the window on a short viewport. */}
                      <SelectContent className="max-h-72">
                        {TURNOVER_RANGES.map((range) => (
                          <SelectItem key={range} value={range}>{range}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  {/*
                      The manual box appears only for the slab that asks for it.

                      Rendering it always, greyed, would put an input on screen
                      whose answer is thrown away — and a member who typed into
                      it and saved would be told the save succeeded.
                  */}
                  {isManualTurnover && (
                    <Field
                      label="Turnover figure"
                      required
                      hint="In rupees, as you would write it — e.g. 7,50,00,000 or 7.5 crore"
                    >
                      <Input
                        value={formData.turnoverOther}
                        onChange={(e) => setField('turnoverOther', e.target.value)}
                        placeholder="Enter the annual turnover"
                        className="h-12 !text-[1.25rem] bg-slate-50 border-slate-200 placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-blue-500"
                      />
                    </Field>
                  )}
                </FieldGrid>

                {formData.turnoverRange && !isManualTurnover ? (
                  <p className="mt-3 inline-flex items-center gap-1.5 text-[1.1875rem] font-medium text-slate-500">
                    <TrendingUp className="h-3.5 w-3.5 text-blue-600" />
                    Recorded as {formData.turnoverRange}
                  </p>
                ) : null}
              </Subsection>
            </Card>
            <Card id="government" padded={false} className="p-6 h-full !border !border-slate-200 !shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_30px_-12px_rgba(16,24,40,0.28)]">
              <SectionHeading
                title="Government Registrations"
                description="Bodies this company is registered with, and schemes it has availed"
                icon={BadgeCheck}
              />
              <Subsection
                title="Registered with government"
                hint="Tick every body that applies — a company is routinely registered with more than one."
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {GOVT_REGISTRATIONS.map((body) => (
                    <CheckCard
                      key={body}
                      label={body}
                      description={registrationHints[body] || ''}
                      checked={registeredWith(body)}
                      onChange={() => toggleRegistration(body)}
                      lockedNote={
                        body === 'MSME / Udyam' && msmeLockedByNsic
                          ? 'Required for NSIC'
                          : undefined
                      }
                    />
                  ))}
                </div>

                {/*
                    One detail field per body, shown only when that body is
                    ticked. A single shared "registration number" box would lose
                    which number belongs to which registration, which is the
                    whole reason these are asked separately.
                */}
                {registeredWith('MSME / Udyam') && (
                  <div className="mt-5">
                    <FieldGrid>
                      <Field
                        label="Udyam Registration Number"
                        hint="Issued by the Ministry of MSME."
                      >
                        <Input
                          value={formData.msmeUdyamNumber}
                          onChange={(e) => setField('msmeUdyamNumber', e.target.value.toUpperCase())}
                          placeholder="UDYAM-XX-00-0000000"
                          className="h-12 !text-[1.25rem] bg-slate-50 border-slate-200 placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-blue-500"
                        />
                      </Field>
                    </FieldGrid>
                  </div>
                )}

                {registeredWith('NSIC') && (
                  <div className="mt-5">
                    <FieldGrid>
                      <Field
                        label="NSIC Registration Number"
                        hint="The Single Point Registration (SPRS) number NSIC issued."
                      >
                        <Input
                          value={formData.nsicRegistrationNumber}
                          onChange={(e) =>
                            setField('nsicRegistrationNumber', e.target.value.toUpperCase())}
                          placeholder="NSIC / SPRS number"
                          className="h-12 !text-[1.25rem] bg-slate-50 border-slate-200 placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-blue-500"
                        />
                      </Field>
                    </FieldGrid>
                  </div>
                )}

                {registeredWith('Export Councils') && (
                  <div className="mt-5">
                    <FieldGrid>
                      <Field
                        label="Export Council"
                        hint="The body that issued your RCMC — DGFT Appendix 2T."
                        /*
                          FULL WIDTH, and the RCMC number drops to its own row.
                          `FieldGrid` is two columns, which gives this field
                          about 220px in the right-hand card — and these names
                          run to "Basic Chemicals, Cosmetics and Dyes Export
                          Promotion Council (CHEMEXCIL)". At half width both the
                          placeholder and every row in the list truncate, so the
                          member is picking between strings they cannot read.
                        */
                        full
                      >
                        {/*
                          A picker, not a text box.

                          It was an `<Input>` placeholdered "e.g. FIEO, EEPC
                          India", and free text gave back "EEPC", "eepc india"
                          and "Engineering Export Promotion Council" as three
                          different councils. The list is grouped as the
                          Appendix groups it, searchable by abbreviation, and
                          still accepts a body it does not have — the DGFT
                          amends 2T without telling anybody here.
                        */}
                        <ExportCouncilInput
                          value={formData.exportCouncilName}
                          onChange={(v) => setField('exportCouncilName', v)}
                        />
                      </Field>
                      <Field
                        label="Council Registration / RCMC Number"
                        hint="The Registration-Cum-Membership Certificate number."
                      >
                        <Input
                          value={formData.exportCouncilRegNumber}
                          onChange={(e) =>
                            setField('exportCouncilRegNumber', e.target.value.toUpperCase())}
                          placeholder="Membership / RCMC number"
                          className="h-12 !text-[1.25rem] bg-slate-50 border-slate-200 placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-blue-500"
                        />
                      </Field>
                    </FieldGrid>
                  </div>
                )}

                {registeredWith('Other') && (
                  <div className="mt-5">
                    <Field label="Other registration details">
                      <Textarea
                        value={formData.otherRegistrationDetails}
                        onChange={(e) => setField('otherRegistrationDetails', e.target.value)}
                        placeholder="Name the body and the registration number"
                        className="min-h-[5rem] !text-[1.25rem] bg-slate-50 border-slate-200 placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-blue-500"
                      />
                    </Field>
                  </div>
                )}
              </Subsection>

              <Subsection
                title="Government schemes"
                hint="Schemes this company has availed. Select all that apply."
              >
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

                {formData.govtSchemes.includes('Others') && (
                  <div className="mt-5">
                    <Field label="Specify other schemes">
                      <Textarea
                        value={formData.schemeDetails}
                        onChange={(e) => setField('schemeDetails', e.target.value)}
                        placeholder="Name the scheme and the benefit availed"
                        className="min-h-[5rem] !text-[1.25rem] bg-slate-50 border-slate-200 placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-blue-500"
                      />
                    </Field>
                  </div>
                )}
              </Subsection>
            </Card>
          </div>

            {/* Actions repeat at the foot of a long form, right-aligned rather
                than two full-bleed buttons filling the card. */}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="border-slate-200 text-slate-700 hover:bg-slate-50 text-[1.25rem] font-bold h-12"
                onClick={() => navigate(cancelTo || returnTo)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-[1.25rem] font-bold h-12"
                disabled={loading}
              >
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Saving…' : isEditMode ? 'Update Company' : createLabel}
              </Button>
            </div>
        </div>
      </form>
    </BusinessPageShell>
  );
};

export default CompanyForm;
