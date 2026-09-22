import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import AuthSplitLayout from "@/shared/components/AuthSplitLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { register as registerUser } from "@/services/authService";
import axios from "axios";
import { apiFetch, getStates, getDistricts, getBlocks } from "@/services/activApi";
import { PhoneInput } from "@/components/ui/phone-input";
import { validateMobile } from "@/lib/phoneNumber";
import { DEFAULT_COUNTRY, countryByIso2 } from "@/lib/countryCodes";

/**
 * The same ruled field the sign-in screen uses — see the note there. Kept in
 * step deliberately: these two screens sit one click apart, and a boxed
 * register form beside a ruled sign-in reads as two different products.
 */
/**
 * The label, at `BusinessUI.Field`'s weight and a size above it.
 *
 * `<Label>` ships at 14px medium, which on a card of fourteen controls reads
 * as annotation around the boxes rather than as the form's own questions —
 * and it was two steps below the field text under it.
 */
const LABEL = 'block text-[1.1875rem] font-semibold text-slate-800 mb-2';

/** The card's buttons: `BusinessUI`'s blue at the size the fields now run. */
const BUTTON = 'h-[3.75rem] text-[1.25rem] font-semibold rounded-xl';

const FIELD =
  'h-[3.75rem] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-[1.375rem] ' +
  'font-medium text-slate-900 placeholder:text-[1.1875rem] placeholder:font-normal ' +
  'placeholder:text-slate-400 ' +
  'transition-colors hover:border-slate-300 focus:bg-white focus:border-transparent ' +
  'focus:ring-2 focus:ring-blue-600';

const MemberRegister = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);


  // Location API state
  const [states, setStates] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<string[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(false);

  const [partialData, setPartialData] = useState<any>({});

  // Location API base URL
  // Region options come from the admin database, never a bundled list: only
  // regions with an active admin may be chosen.
  const LOCATION_API_BASE_URL = "";

  type Step1Form = {
    firstName?: string;
    mobile?: string;
    whatsapp?: string;
    email: string;
    password: string;
    confirmPassword?: string;
  };

  type Step2Form = {
    stateName?: string;
    districtName?: string;
    block?: string;
    city?: string;
  };

  const {
    register: registerStep1,
    handleSubmit: handleSubmitStep1,
    setValue: setValueStep1,
    watch: watchStep1,
    formState: { errors: errorsStep1 },
  } = useForm<Step1Form>({ mode: 'onSubmit' });

  /** Most people use one number for both — see the note on the field. */
  const [sameWhatsapp, setSameWhatsapp] = useState(true);
  const mobileValue = watchStep1('mobile');

  /*
   * The country sits beside the phone number, not inside it.
   *
   * Held as its own piece of state rather than as a '+91' glued to the front of
   * the digits, because the two answers change independently: picking a country
   * must not rewrite the number the member is halfway through typing, and
   * correcting a digit must not reset the country.
   *
   * WhatsApp has NO picker of its own, deliberately. It is one field for one
   * number in the overwhelming case — the tickbox below is ticked by default —
   * and a second country dropdown on a field most people never touch is two
   * controls to answer one question. A member whose WhatsApp really is abroad
   * can still type it in full: `validateMobile` reads the '+' prefix and works
   * the country out, the same way the server does.
   */
  const [phoneCountry, setPhoneCountry] = useState<string>(DEFAULT_COUNTRY);

  /** The dialling code shown in the WhatsApp placeholder. Display only. */
  const whatsappDialHint = countryByIso2(phoneCountry)?.dial || '91';

  /*
   * Keep the mirrored field in step while the box is ticked.
   *
   * Without this, ticking the box copies the number ONCE and then goes stale
   * the moment the phone number is corrected — the member fixes a typo in one
   * field and registers with the typo still in the other, which is the number
   * every WhatsApp message then goes to.
   *
   * What is copied is the SUBMITTABLE form, not the raw digits: a foreign phone
   * number mirrored as bare digits would be read as an Indian one on the way
   * out, so the '+<code>' goes across with it. An Indian number copies as the
   * bare ten digits it has always been.
   */
  useEffect(() => {
    if (!sameWhatsapp) return;
    const mirrored = validateMobile(mobileValue, phoneCountry);
    setValueStep1('whatsapp', mirrored.ok ? mirrored.stored : (mobileValue || ''));
  }, [sameWhatsapp, mobileValue, phoneCountry, setValueStep1]);
  const { register: registerStep2, handleSubmit: handleSubmitStep2, control: controlStep2, watch: watchStep2, setValue: setValueStep2, formState: { errors: errorsStep2 } } = useForm<Step2Form>({
    mode: 'onSubmit',
    defaultValues: { stateName: '', districtName: '', block: '', city: '' },
  });

  // Watch for state and district changes
  const selectedState = watchStep2('stateName');
  const selectedDistrict = watchStep2('districtName');

  /**
   * Selectable regions come from the admin database.
   *
   * A state is offered only if some block beneath it has an active admin, so
   * every choice here leads to a reviewable application. The bundled
   * `india-districts` list offered all of India regardless — an applicant could
   * register into a region with nobody to review them.
   */
  useEffect(() => {
    let cancelled = false;
    getStates()
      .then((r) => { if (!cancelled) setStates((r.states || []).map((x) => x.name)); })
      .catch(() => { if (!cancelled) setStates([]); });
    return () => { cancelled = true; };
  }, []);

  // Fetch districts when state changes
  useEffect(() => {
    if (!selectedState) {
      setDistricts([]);
      setBlocks([]);
      return;
    }

    let cancelled = false;
    getDistricts(selectedState)
      .then((r) => { if (!cancelled) setDistricts((r.districts || []).map((d) => d.name)); })
      .catch(() => { if (!cancelled) setDistricts([]); });

    setValueStep2('districtName', '');
    setValueStep2('block', '');
    setBlocks([]);
    return () => { cancelled = true; };
  }, [selectedState, setValueStep2]);

  // Fetch blocks when district changes
  useEffect(() => {
    const fetchBlocks = async () => {
      if (!selectedState || !selectedDistrict) {
        setBlocks([]);
        return;
      }

      try {
        setLoadingBlocks(true);
        const result = await getBlocks(selectedState, selectedDistrict);
        setBlocks((result.blocks || []).map((b) => b.name));
        setValueStep2('block', '');
      } catch (error) {
        // Deliberately empty, never invented. This used to substitute
        // "<District> Block 1/2/3" — names that exist nowhere in the database.
        // Registering with one is refused by the region gate, so the applicant
        // was offered a choice guaranteed to fail.
        setBlocks([]);
        setValueStep2('block', '');
      } finally {
        setLoadingBlocks(false);
      }
    };

    fetchBlocks();
  }, [selectedState, selectedDistrict, setValueStep2]);

  const handleStep1Submit = (data: Step1Form) => {
    if (data.confirmPassword && data.password !== data.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    /*
     * Both numbers are checked HERE, not on the final submit.
     *
     * The server refuses a bad number either way, but by the time Step 2 is
     * submitted the applicant has picked a state, a district and a block, and
     * being sent back for a typo they made three screens ago is how a
     * registration gets abandoned. The rule is the same one the server applies
     * — `backend/src/modules/common/phoneNumber.js` — so the two cannot
     * disagree about what is acceptable.
     */
    const phone = validateMobile(data.mobile, phoneCountry, 'Phone number');
    if (!phone.ok) {
      toast.error(phone.reason);
      return;
    }

    /*
     * The WhatsApp number is judged with NO country passed, so the rule falls
     * back to reading a '+' prefix and otherwise assuming India — which is what
     * a field with no picker beside it means. When the box is ticked the value
     * being judged is the phone number's already-normalised form, so the two
     * cannot disagree about a number the member entered once.
     */
    const whatsapp = validateMobile(
      sameWhatsapp ? phone.stored : data.whatsapp,
      undefined,
      'WhatsApp number',
    );
    if (!whatsapp.ok) {
      toast.error(whatsapp.reason);
      return;
    }

    /*
     * Stored normalised, so what is shown back and what is submitted agree.
     * `stored` and not `national`: an Indian number is the bare ten digits it
     * has always been, and a foreign one keeps its '+<code>' — which is the
     * only thing that tells the server it is not Indian.
     */
    setPartialData({ ...data, mobile: phone.stored, whatsapp: whatsapp.stored });
    setStep(2);
  };

  const handleStep2Submit = async (data: Step2Form) => {
    try {
      if (partialData.confirmPassword && partialData.password !== partialData.confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }

      // Validate required fields
      if (!partialData.email || !partialData.password) {
        toast.error('Email and password are required');
        return;
      }

      const registrationData = {
        fullName: partialData.firstName || '',
        email: partialData.email,
        phoneNumber: partialData.mobile || '',
        whatsappNumber: partialData.whatsapp || partialData.mobile || '',
        password: partialData.password,
        confirmPassword: partialData.confirmPassword || partialData.password,
        state: data.stateName || '',
        district: data.districtName || '',
        block: data.block || '',
        city: data.city || ''
      };


      toast.loading('Registering your account...');
      const response = await registerUser(registrationData);
      toast.dismiss();


      if (response.success && response.data) {
        toast.success('Registration successful! Welcome to ACTIVian Portal');

        // Store authentication token
        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
        }

        const completeUserData = {
          firstName: partialData.firstName || '',
          email: partialData.email,
          phone: partialData.mobile || '',
          mobile: partialData.mobile || '',
          whatsapp: partialData.whatsapp || partialData.mobile || '',
          state: data.stateName || '',
          district: data.districtName || '',
          block: data.block || '',
          city: data.city || '',
          memberId: response.data.user.id,
        };

        localStorage.setItem('userProfile', JSON.stringify(completeUserData));
        localStorage.setItem('registrationData', JSON.stringify(completeUserData));
        localStorage.setItem('memberId', response.data.user.id);

        
        // Navigate to unpaid dashboard
        setTimeout(() => {
          navigate('/member/unpaid-dashboard', { replace: true });
        }, 500);
      } else {
        // Show specific error messages
        if (response.message?.includes('already registered')) {
          toast.error('This email is already registered. Please login or use a different email.');
        } else {
          toast.error(response.message || 'Registration failed. Please try again.');
        }
      }
    } catch (error: any) {
      toast.dismiss();
      console.error('Registration exception:', error);
      toast.error(error.message || 'Something went wrong. Please try again.');
    }
  };

  return (
    <AuthSplitLayout
      eyebrow="Join ACTIV"
      headline={<>Join ACTIVian<br />Community! 👋</>}
      quote={'"Your Journey to Empowerment Starts Here"'}
      lede="Become a member of ACTIVian and unlock access to exclusive benefits, community resources and business opportunities designed to empower your growth."
      formEyebrow={`Step ${step} of 2`}
      title={step === 1 ? 'Create your account' : 'Your profile details'}
      subtitle={
        step === 1
          ? 'An email address and a password are all we need to begin.'
          : 'Optional — you can skip this and finish it later from your dashboard.'
      }
      assurance="We never share your details outside the association."
      surface="card"
    >
      {/*
        THE PROGRESS BAR CARRIES THE STEP, and the heading says which one in
        words above it. The panel beside this used to list both steps as a
        checklist; two places saying the same thing is two places to keep in
        step, and the list was hidden below `md` — where most people register.
      */}
      {/*
        THE CARD'S OWN HEADING — `BusinessUI.SectionHeading`, to the class:
        22px extrabold slate-900 with a blue-600 icon and a 16px slate-500
        line under it. That component is what every card on the business
        account screens opens with, and this card had nothing, so the form
        began at a label with no idea what it was part of.
      */}
      <div className="mb-5 flex items-start gap-2">
        <UserPlus className="mt-1 h-5 w-5 shrink-0 text-blue-600" />
        <div className="min-w-0">
          <h2 className="text-[1.5rem] font-bold tracking-tight text-slate-900">
            {step === 1 ? 'Account credentials' : 'Profile details'}
          </h2>
          <p className="mt-1 text-[1.125rem] text-slate-500">
            {step === 1
              ? 'Required — this is what you will sign in with.'
              : 'Optional — you can finish this later from your dashboard.'}
          </p>
        </div>
      </div>

      <div
        className="mb-7 h-2 w-full overflow-hidden rounded-full bg-blue-100"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={2}
        aria-label={`Step ${step} of 2`}
      >
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-300"
          style={{ width: step === 1 ? '50%' : '100%' }}
        />
      </div>

              {step === 1 ? (
                <form onSubmit={handleSubmitStep1(handleStep1Submit)} className="space-y-5">
                  <div>
                    <Label htmlFor="firstName" className={LABEL}>Full Name</Label>
                    <Input
                      id="firstName"
                      placeholder="Enter your full name"
                      className={FIELD}
                      {...registerStep1('firstName')}
                    />
                  </div>

                  <div>
                    <Label htmlFor="mobile" className={LABEL}>Phone Number*</Label>
                    {/*
                      Registered through the form's own API rather than with
                      `{...registerStep1('mobile')}`, because this control owns
                      two values and a ref-registered input can only carry one.
                      `shouldValidate` is off: the number is judged on submit,
                      like everything else on this step.
                    */}
                    {/*
                      The ruled treatment, reached through child selectors.

                      `PhoneInput` is shared with the profile screens and
                      hardcodes its own bordered shell, so the alternative was
                      a variant prop on a component three other forms use. The
                      arbitrary selectors keep the change at this call site,
                      which is the only place the field has to look like this.
                    */}
                    <PhoneInput
                      id="mobile"
                      name="mobile"
                      className="mt-1 [&>div]:h-[3.75rem] [&>div]:rounded-xl
                                 [&>div>input]:text-[1.375rem] [&>div>input]:font-medium"
                      value={mobileValue || ''}
                      onChange={(national) =>
                        setValueStep1('mobile', national, { shouldValidate: false })
                      }
                      country={phoneCountry}
                      onCountryChange={setPhoneCountry}
                    />
                  </div>

                  {/*
                    The WhatsApp number, asked for separately.
                    Separate from the phone number because for a good number of
                    members they are not the same handset — a business SIM and a
                    personal WhatsApp — and messaging the wrong one fails with
                    nothing on screen to explain why. The tickbox is there
                    because for most people they ARE the same, and making
                    everyone type ten digits twice is how a form gets a typo in
                    the number the platform will actually message.
                  */}
                  <div>
                    <Label htmlFor="whatsapp" className={LABEL}>WhatsApp Number*</Label>
                    {/*
                      No country picker here, on purpose — see the note beside
                      `phoneCountry`. The placeholder follows the country chosen
                      for the phone number, because that is the number this
                      field mirrors by default; a hard-coded '+91' on a form
                      whose phone number is British is the field contradicting
                      itself.
                    */}
                    <Input
                      id="whatsapp"
                      inputMode="tel"
                      placeholder={`+${whatsappDialHint} XXXXXXXXXX`}
                      className={FIELD}
                      disabled={sameWhatsapp}
                      {...registerStep1('whatsapp')}
                    />
                    <label className="mt-2.5 flex items-center gap-2.5 text-[1.125rem] font-normal text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                        checked={sameWhatsapp}
                        onChange={(e) => {
                          setSameWhatsapp(e.target.checked);
                          // Copy immediately so the field shows what will be
                          // submitted. Leaving it blank while ticked is the
                          // version people report as "it lost my number".
                          if (e.target.checked) {
                            setValueStep1('whatsapp', watchStep1('mobile') || '');
                          }
                        }}
                      />
                      Same as my phone number
                    </label>
                    <p className="mt-2 text-[1.125rem] text-slate-500">
                      Application updates are sent here on WhatsApp.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="email" className={LABEL}>Email Address*</Label>
                    {/*
                      Registration is a new account, so nothing here should be
                      filled in from a saved one. The browser was offering the
                      credentials of whoever last signed in on this machine,
                      which is how somebody ends up submitting the sign-up form
                      with an address that is already registered.
                    */}
                    <Input
                      id="email"
                      type="email"
                      placeholder="your.email@example.com"
                      className={FIELD}
                      autoComplete="off"
                      {...registerStep1('email', {
                        required: 'Email required',
                        pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' }
                      })}
                    />
                    {errorsStep1.email && <p className="text-[1.125rem] font-medium text-red-600 mt-1.5">{errorsStep1.email.message}</p>}
                  </div>

                  <div>
                    <Label htmlFor="password" className={LABEL}>Password*</Label>
                    <PasswordInput
                      id="password"
                      placeholder="Enter Password"
                      className={FIELD}
                      // `new-password` is what tells the browser this is a
                      // password being CHOSEN, not one being recalled: it stops
                      // the autofill and offers to generate one instead.
                      autoComplete="new-password"
                      {...registerStep1('password', {
                        required: 'Password required',
                        minLength: { value: 6, message: 'At least 6 characters' },
                      })}
                    />
                    {errorsStep1.password && <p className="text-[1.125rem] font-medium text-red-600 mt-1.5">{errorsStep1.password.message}</p>}
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword" className={LABEL}>Confirm Password</Label>
                    <PasswordInput
                      id="confirmPassword"
                      placeholder="Confirm Password"
                      className={FIELD}
                      autoComplete="new-password"
                      {...registerStep1('confirmPassword')}
                    />
                  </div>

                  <Button type="submit" className={`w-full ${BUTTON} bg-blue-600 hover:bg-blue-700 text-white`}>
                    Next <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>

                  <p className="text-center text-[1.1875rem] text-slate-500">
                    Already have an account?{" "}
                    <Link to="/login" className="font-bold text-blue-700 hover:text-blue-900">
                      Sign in
                    </Link>
                  </p>
                </form>
              ) : (
                <form onSubmit={handleSubmitStep2(handleStep2Submit)} className="space-y-5">
                  <div>
                    <Label htmlFor="state" className={LABEL}>State</Label>
                    <Controller
                      control={controlStep2}
                      name="stateName"
                      render={({ field }) => (
                        <Select value={field.value || ''} onValueChange={(v: string) => field.onChange(v)}>
                          <SelectTrigger className={FIELD}>
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                          <SelectContent>
                            {states.map((s) => (
                              <SelectItem key={s} value={s} className="text-[1.25rem]">{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div>
                    <Label htmlFor="district" className={LABEL}>District</Label>
                    <Controller
                      control={controlStep2}
                      name="districtName"
                      render={({ field }) => (
                        <Select
                          value={field.value || ''}
                          onValueChange={(v: string) => field.onChange(v)}
                          disabled={!selectedState}
                        >
                          <SelectTrigger className={FIELD}>
                            <SelectValue placeholder={!selectedState ? 'Please select state first' : 'Select district'} />
                          </SelectTrigger>
                          <SelectContent>
                            {districts.map((d) => (
                              <SelectItem key={d} value={d} className="text-[1.25rem]">{d}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div>
                    <Label htmlFor="block" className={LABEL}>Block</Label>
                    <Controller
                      control={controlStep2}
                      name="block"
                      render={({ field }) => (
                        <Select
                          value={field.value || ''}
                          onValueChange={(v: string) => field.onChange(v)}
                          disabled={!selectedDistrict || loadingBlocks}
                        >
                          <SelectTrigger className={FIELD}>
                            <SelectValue placeholder={
                              !selectedDistrict ? 'Please select district first' : loadingBlocks ? 'Loading blocks...' : 'Select block'
                            } />
                          </SelectTrigger>
                          <SelectContent>
                            {blocks.map((b) => (
                              <SelectItem key={b} value={b} className="text-[1.25rem]">{b}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div>
                    <Label htmlFor="city" className={LABEL}>City</Label>
                    <Input
                      id="city"
                      placeholder="Enter city name"
                      className={FIELD}
                      {...registerStep2('city')}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className={`flex-1 ${BUTTON}`}
                        onClick={() => setStep(1)}
                      >
                        <ArrowLeft className="mr-2 h-5 w-5" />
                        Back
                      </Button>
                      <Button type="submit" className={`flex-1 ${BUTTON} bg-blue-600 hover:bg-blue-700 text-white`}>
                        Complete Registration
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className={`w-full ${BUTTON} font-semibold text-slate-500 hover:text-slate-900`}
                      onClick={() => handleStep2Submit({ stateName: '', districtName: '', block: '', city: '' })}
                    >
                      Skip & Go to Dashboard
                    </Button>
                  </div>

                  <p className="text-center text-[1.1875rem] text-slate-500">
                    Already have an account?{" "}
                    <Link to="/login" className="font-bold text-blue-700 hover:text-blue-900">
                      Sign in
                    </Link>
                  </p>
                </form>
              )}
    </AuthSplitLayout>
  );
};

export default MemberRegister;
