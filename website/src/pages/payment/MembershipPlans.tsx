import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { unwrap } from '@/services/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowLeft, Lock, Shield, CreditCard, Zap, FileText, Mail, Star, Building2, Loader2, Crown, Sparkles, Award, GraduationCap } from 'lucide-react';
import { resolvePlanEligibility, type MembershipPlan } from '@/features/member/membershipPlans';
import { toast } from 'sonner';
import MemberPageShell from '../member/MemberPageShell';

interface Plan {
  audience: string;
  minYears?: number;
  maxYears?: number | null;
  id: string;
  name: string;
  description: string;
  price: number;
  features: string[];
  popular?: boolean;
  experience: string;
  icon: any;
  accentColor: string;
  bgGradient: string;
}

/**
 * Presentation only. The plans themselves — names, prices, features, and which
 * of them a given member may buy — live in `features/member/membershipPlans`,
 * transcribed from the mobile `CompleteMembershipScreen` so the two clients
 * cannot drift on what a membership costs.
 */
const DECOR: Record<string, Pick<Plan, 'icon' | 'accentColor' | 'bgGradient'>> = {
  basic: {
    icon: Sparkles,
    accentColor: '#0ea5e9',
    bgGradient: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
  },
  intermediate: {
    icon: Crown,
    accentColor: '#2563eb',
    bgGradient: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
  },
  ideal: {
    icon: Award,
    accentColor: '#1e40af',
    bgGradient: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
  },
  aspirant: {
    icon: Star,
    accentColor: '#0284c7',
    bgGradient: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
  },
  student: {
    icon: GraduationCap,
    accentColor: '#2563eb',
    bgGradient: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
  },
};

const decorate = (plan: MembershipPlan): Plan => ({
  ...plan,
  // By key first; a plan the Super Admin added later takes its audience's look.
  ...(DECOR[plan.id] || DECOR[plan.audience] || DECOR.basic),
});

/** How the applicant's kind reads on this screen. */
const KIND_LABEL: Record<string, string> = { business: 'Company', aspirant: 'Aspirant', student: 'Student' };

/*
 * NO PLACEHOLDER PLANS.
 *
 * A hardcoded list here was the initial state, so the screen painted three
 * cards at 5,000 / 10,000 / 20,000 for as long as the fetch took and then
 * replaced them. Every one of those numbers stops being true the moment the
 * Super Admin edits a price, and a member who reads the flash and looks away
 * has been shown a figure the association did not set. The screen starts
 * empty and says it is loading instead.
 */


export default function MembershipPlans() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const upgrading = params.get('upgrade') === '1';
  const [upgradeReason, setUpgradeReason] = useState('');
  const [commencementYear, setCommencementYear] = useState('');
  /**
   * Which plans this member is offered, and which is preselected.
   *
   * Both used to be fixed: three company plans, with the middle one selected.
   * An applicant who declared no business was therefore shown a company plan
   * starting at Rs 5,000 and had no way to reach the Rs 2,000 aspirant plan
   * mobile offers them — so the two clients disagreed about the price of the
   * same membership.
   */
  const [plans, setPlans] = useState<Plan[]>([]);
  /**
   * Null until the prices arrive.
   *
   * It held a placeholder plan before, which is how a stale price reached the
   * screen: every reader of `selectedPlan` had a number to print before anyone
   * had asked the server what the number was. Null forces each of them to wait.
   */
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [planLocked, setPlanLocked] = useState(false);
  /** The prices could not be read at all — distinct from "no plans exist". */
  const [loadFailed, setLoadFailed] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadUserData();
  }, [upgrading]);

  const loadUserData = async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      if (upgrading) {
        const result = unwrap<any>(await api.get('/payment/upgrade/plans'), {});
        const offered = (result.plans || []).map((p: any) => decorate({ ...p, id: p.key }));
        setPlans(offered); setSelectedPlan(offered[0] || null); setPlanLocked(false);
        setCommencementYear(String(result.commencementYear || ''));
        setUpgradeReason(result.reason || 'The full plan fee is charged. Your upgraded annual membership starts after successful payment and is valid for one year.');
        setUserData({ memberType: KIND_LABEL[result.kind], experience: result.currentPlan, applicationId: '' });
        return;
      }
      const eligibility = await resolvePlanEligibility();

      const offered = eligibility.plans.map(decorate);
      setPlans(offered);
      setSelectedPlan(eligibility.selected ? decorate(eligibility.selected) : null);
      setPlanLocked(eligibility.locked);
      setLoadFailed(eligibility.failed);

      setUserData({
        memberType: KIND_LABEL[eligibility.audience] || 'Company',
        experience: eligibility.experience,
        applicationId: eligibility.applicationId,
      });
    } catch (error) {
      /**
       * Real defaults, not an invented identity.
       *
       * This used to fall back to an application id of 'APP-TEST' under the
       * name 'Member' at 'member@activ.org' — values that then travelled into
       * the payment as if they described someone. The company plans are a safe
       * default because they are what an unclassified applicant sees anyway;
       * a fabricated application id is not.
       */
      console.error('Error loading user data:', error);
      // No plans and no invented price — the screen says it could not load
      // rather than offering a figure nobody set.
      setLoadFailed(true);
      setPlans([]);
      setSelectedPlan(null);
      setUserData({
        memberType: 'Company',
        experience: '',
        applicationId: '',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSelect = (plan: Plan) => {
    // An aspirant's plan follows from what they declared, as on mobile, where
    // the cards are rendered but not selectable.
    if (planLocked) return;
    setSelectedPlan(plan);
  };

  /**
   * On to the gateway, which is where the payment is actually recorded.
   *
   * This called `initiatePayment()` -> `POST /payment/initiate`, a route the
   * backend does not declare, so the button answered 404 and no membership
   * could be bought from the website at all. Mobile's
   * `CompleteMembershipScreen.handlePayment` makes no request either: it
   * carries the plan to the gateway screen, and the gateway posts
   * `/payment/complete`. This is that same step.
   */
  const handlePayment = async () => {
    /*
     * No plan, no payment.
     *
     * `selectedPlan` is null until the prices load, and this project builds
     * with `strictNullChecks: false` — so nothing but this line stops a click
     * during a failed load from reading `.price` off null and taking the screen
     * down on the way to the gateway.
     */
    if (!selectedPlan) {
      toast.error('The membership prices have not loaded yet. Please try again.');
      return;
    }
    if (upgrading && selectedPlan.audience === 'business') {
      const year = Number(commencementYear), age = new Date().getFullYear() - year;
      if (!/^\d{4}$/.test(commencementYear) || year < 1800 || age < 0) { toast.error('Enter a valid business commencement year.'); return; }
      if (age < Number(selectedPlan.minYears || 0) || (selectedPlan.maxYears != null && age >= selectedPlan.maxYears)) { toast.error('Choose the plan matching your business commencement year.'); return; }
    }

    setProcessing(true);
    try {
      navigate('/payment/gateway', {
        state: {
          planType: selectedPlan.name,
          planId: selectedPlan.id,
          planAmount: selectedPlan.price,
          totalAmount: selectedPlan.price,
          applicationId: userData?.applicationId || '',
          upgrade: upgrading,
          commencementYear: upgrading && selectedPlan.audience === 'business' ? commencementYear : undefined,
        },
      });
    } catch (error) {
      console.error('Could not open checkout:', error);
      toast.error('Unable to open checkout. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        /* No `fontFamily`. It named Inter and a system stack, which put this
           whole screen in a different face from the product around it — and
           Inter is still second in the stack in `tailwind.config.ts`, so the
           two are close enough that it reads as slightly-off rather than as
           wrong. `font-sans` on this site IS Poppins; nothing here needs to
           name a family. */
        style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        }}
      >
        <div className="text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              boxShadow: '0 8px 24px -4px rgba(37, 99, 235, 0.4)'
            }}
          >
            <Loader2 className="w-8 h-8 animate-spin text-white" />
          </div>
          <h2 className="text-[1.1875rem] font-semibold text-slate-900 mb-1">Loading Plans</h2>
          <p className="text-slate-500 text-[1.0625rem]">Please wait...</p>
        </div>
      </div>
    );
  }

  /*
   * NO PRICE, NO PAGE.
   *
   * Everything below reads `selectedPlan` — the summary, the total, the Pay
   * button's label. With `strictNullChecks` off, the compiler will not stop any
   * of that from running against null, so the guard has to be here.
   *
   * It says which of the two situations it is. "We could not reach the server"
   * is worth retrying; "no plans are being offered" is not, and a member who
   * retries that one forever has been misled about whose problem it is.
   */
  if (!selectedPlan || plans.length === 0) {
    return (
      <MemberPageShell title={upgrading ? 'Upgrade membership' : 'Membership'}>
        <div className="max-w-md mx-auto py-12 sm:py-20 px-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-6 h-6 text-amber-600" />
          </div>
          <h2 className="text-[1.1875rem] font-semibold text-slate-900 mb-1">
            {loadFailed ? 'Could not load the plans' : upgrading ? 'Update your profile to change membership' : 'No membership plans are available'}
          </h2>
          <p className="text-slate-500 text-[1.0625rem] mb-6">
            {loadFailed
              ? 'The membership prices could not be read just now. Nothing has been charged.'
              : upgrading ? upgradeReason : 'The association has not published a plan for your membership yet. '
                + 'Please contact the office.'}
          </p>
          {loadFailed && (
            <Button onClick={() => { setLoading(true); loadUserData(); }}>
              Try again
            </Button>
          )}
          {upgrading && !loadFailed && <div className="flex flex-wrap justify-center gap-3"><Button className="max-w-full h-auto whitespace-normal py-2" onClick={() => navigate('/member/profile?step=2')}>Edit category and commencement year</Button><Button variant="outline" onClick={() => void loadUserData()}>Refresh eligible plan</Button></div>}
        </div>
      </MemberPageShell>
    );
  }

  /* ------------------------------------------------------------------ design */

  const fmt = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
  const JOURNEY = upgrading ? ['Profile', 'Plan', 'Payment', 'Active'] : ['Application', 'Approved', 'Payment', 'Active'];

  return (
    <MemberPageShell
      title={upgrading ? 'Upgrade membership' : 'Membership'}
      subtitle={upgrading ? 'Your plan follows your updated profile' : 'Complete your ACTIV membership'}
      width="wide"
      sidebar={false}
      actions={
        <div className="flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5">
          <Lock className="h-3.5 w-3.5 text-emerald-600" />
          <span className="hidden text-[0.9rem] font-semibold text-emerald-700 sm:inline">Secure checkout</span>
        </div>
      }
    >
      {upgrading && <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:p-6"><p className="text-[1.25rem]">{upgradeReason}</p><p className="mt-2 text-slate-600">Your email, password, mobile number and previous receipts stay with this account.</p>{selectedPlan.audience === 'business' && <label className="mt-4 block max-w-md font-semibold text-slate-700">Business commencement year<input aria-label="Business commencement year" inputMode="numeric" maxLength={4} value={commencementYear} onChange={e => setCommencementYear(e.target.value.replace(/\D/g, ''))} placeholder="Year your business started" className="mt-2 h-12 w-full rounded-xl border border-blue-200 bg-white px-4 font-normal" /><span className="mt-2 block text-base font-normal">Choose the business plan matching this year. Your profile updates after payment succeeds.</span></label>}</div>}
      <div className="pb-28 lg:pb-6">
        {/* ============================================================ hero */}
        <section className="relative mb-6 overflow-hidden rounded-3xl px-5 py-7 text-white sm:mb-8 sm:px-10 sm:py-10"
                 style={{ backgroundImage: 'linear-gradient(135deg, #0f1c47 0%, #1c2e68 45%, #2563eb 100%)' }}>
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-sky-400/20 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.07]"
               style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1.2px)', backgroundSize: '18px 18px' }} />

          <div className="relative grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[0.8rem] font-bold uppercase tracking-[0.14em] ring-1 ring-white/25">
                <Sparkles className="h-3.5 w-3.5" /> {upgrading ? 'Membership upgrade' : 'Application approved'}
              </span>
              <h1 className="mt-4 text-[1.75rem] font-black leading-tight tracking-tight sm:text-[2.5rem]">
                {upgrading ? 'Your next membership' : planLocked ? 'Your membership is one step away' : 'Choose your membership'}
              </h1>
              <p className="mt-2 max-w-xl text-[1rem] text-blue-100 sm:text-[1.0625rem]">
                {upgrading ? 'Select your new membership. Business plans follow the commencement year you enter above.' : planLocked
                  ? userData?.memberType === 'Student'
                    ? 'The plan for students who are not yet in business.'
                    : userData?.memberType === 'Aspirant'
                    ? 'The plan for applicants who have not yet registered a business.'
                    : `Your plan is set by your business — trading ${userData?.experience || 'for a while'}.`
                  : 'Pick the plan that fits your business. You can see everything it includes below.'}
              </p>
            </div>

            {/* Where they are in the journey */}
            <ol className="flex items-center gap-1.5 sm:gap-2">
              {JOURNEY.map((step, i) => {
                const done = i < (upgrading ? 1 : 2);
                const now = i === (upgrading ? 1 : 2);
                return (
                  <li key={step} className="flex items-center gap-1.5 sm:gap-2">
                    <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] font-bold sm:px-3 sm:text-[0.8rem]
                                      ${now ? 'bg-white text-[#1c2e68] shadow-lg' : done ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60'}`}>
                      {done ? <CheckCircle className="h-3.5 w-3.5" /> : <span className="grid h-3.5 w-3.5 place-items-center text-[0.65rem]">{i + 1}</span>}
                      <span className={now ? '' : 'hidden sm:inline'}>{step}</span>
                    </span>
                    {i < JOURNEY.length - 1 && <span className="h-px w-3 bg-white/30 sm:w-5" />}
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
          {/* ========================================================= plans */}
          <div className="min-w-0">
            <div className={`grid gap-4 sm:gap-5 ${plans.length === 1 ? 'grid-cols-1' : plans.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-3'}`}>
              {plans.map((plan) => {
                const Icon = plan.icon;
                const isSelected = selectedPlan.id === plan.id;
                const recommended = planLocked || plan.popular;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => handlePlanSelect(plan)}
                    aria-pressed={isSelected}
                    className={`group relative flex h-full flex-col rounded-3xl p-[2px] text-left transition-all duration-300
                                ${isSelected ? 'shadow-[0_24px_50px_-20px_rgb(37_99_235/0.55)] -translate-y-0.5' : 'hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-22px_rgb(15_23_42/0.35)]'}
                                ${planLocked ? 'cursor-default' : 'cursor-pointer'}`}
                    style={{ backgroundImage: isSelected ? 'linear-gradient(135deg, #1c2e68, #2563eb 60%, #38bdf8)' : 'linear-gradient(#e2e8f0, #e2e8f0)' }}
                  >
                    <div className="flex h-full flex-col rounded-[1.4rem] bg-white p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white shadow-md"
                                style={{ background: plan.bgGradient }}>
                            <Icon className="h-5 w-5" />
                          </span>
                          <div className="min-w-0">
                            <h3 className="text-[1.1rem] font-extrabold text-slate-900">{plan.name}</h3>
                            {plan.experience && (
                              <span className="mt-0.5 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[0.75rem] font-semibold text-slate-600">
                                {plan.experience}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition
                                          ${isSelected ? 'border-transparent bg-[#2563eb] text-white' : 'border-slate-300 bg-white'}`}>
                          {isSelected && <CheckCircle className="h-4 w-4" />}
                        </span>
                      </div>

                      {recommended && (
                        <span className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[0.75rem] font-bold text-amber-700 ring-1 ring-amber-200">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {planLocked ? 'Recommended for you' : 'Most popular'}
                        </span>
                      )}

                      <div className="mt-5 flex items-end gap-1.5">
                        <span className="text-[2.4rem] font-black leading-none tracking-tight text-slate-900 sm:text-[2.75rem]">{fmt(plan.price)}</span>
                        <span className="pb-1 text-[0.9rem] font-medium text-slate-500">/ year</span>
                      </div>
                      {plan.description && <p className="mt-2 text-[0.95rem] leading-relaxed text-slate-500">{plan.description}</p>}

                      <div className="my-5 h-px bg-slate-100" />

                      <ul className="flex-1 space-y-2.5">
                        {(plan.features || []).map((feature, index) => (
                          <li key={index} className="flex items-start gap-2.5 text-[0.95rem] leading-snug text-slate-700">
                            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-50 text-[#2563eb]">
                              <CheckCircle className="h-3.5 w-3.5" />
                            </span>
                            <span className="min-w-0 break-words">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <span className={`mt-6 flex h-11 items-center justify-center gap-2 rounded-xl text-[0.95rem] font-bold transition
                                        ${isSelected ? 'bg-[#1c2e68] text-white' : 'bg-slate-100 text-slate-700 group-hover:bg-slate-200'}`}>
                        {isSelected ? <><CheckCircle className="h-4 w-4" /> Selected</> : planLocked ? 'Your plan' : 'Choose this plan'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* What happens after paying */}
            <div className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { icon: Zap, title: 'Instant activation', text: 'Your membership starts the moment you pay.' },
                { icon: Award, title: 'Membership certificate', text: 'Download it from your dashboard.' },
                { icon: Mail, title: 'Receipt by email', text: 'And a confirmation on WhatsApp.' },
                { icon: Building2, title: 'Member benefits', text: 'Directory, events and your company page.' },
              ].map(({ icon: I, title, text }) => (
                <div key={title} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#2563eb]"><I className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <p className="text-[0.95rem] font-bold text-slate-900">{title}</p>
                    <p className="text-[0.85rem] leading-snug text-slate-500">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ======================================================= summary */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_60px_-30px_rgb(15_23_42/0.35)]">
              <div className="px-6 pb-5 pt-6">
                <p className="text-[0.75rem] font-bold uppercase tracking-[0.16em] text-slate-400">Order summary</p>
                <div className="mt-4 flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl text-white" style={{ background: selectedPlan.bgGradient }}>
                    <CreditCard className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[1.05rem] font-extrabold text-slate-900">{selectedPlan.name}</p>
                    <p className="text-[0.85rem] text-slate-500">{userData?.memberType === 'Company' || !userData?.memberType ? 'Business' : userData.memberType} membership · 1 year</p>
                  </div>
                </div>

                <dl className="mt-5 space-y-2.5 text-[0.95rem]">
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Membership fee</dt><dd className="font-semibold text-slate-900">{fmt(selectedPlan.price)}</dd></div>
                  {selectedPlan.experience && (
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Band</dt><dd className="text-right font-semibold text-slate-900">{selectedPlan.experience}</dd></div>
                  )}
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Taxes</dt><dd className="font-semibold text-emerald-600">Included</dd></div>
                </dl>
              </div>
              <div className="border-t border-dashed border-slate-200 bg-slate-50/70 px-6 py-5">
                <div className="flex items-end justify-between">
                  <span className="text-[0.95rem] font-bold text-slate-700">Total</span>
                  <span className="text-[1.9rem] font-black leading-none text-[#1c2e68]">{fmt(selectedPlan.price)}</span>
                </div>
                <button
                  type="button"
                  onClick={handlePayment}
                  disabled={processing}
                  className="btn-shine relative mt-5 flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl text-[1.05rem] font-bold text-white
                             shadow-[0_14px_30px_-12px_rgb(37_99_235/0.7)] transition active:scale-[0.98] disabled:opacity-60"
                  style={{ backgroundImage: 'linear-gradient(135deg, #1c2e68 0%, #2563eb 100%)' }}
                >
                  {processing ? <><Loader2 className="h-5 w-5 animate-spin" /> Opening checkout…</> : <><Lock className="h-4 w-4" /> Pay {fmt(selectedPlan.price)} securely</>}
                </button>
                <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                  {['UPI', 'Cards', 'Net banking', 'Wallets'].map((m) => (
                    <span key={m} className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[0.75rem] font-semibold text-slate-600">{m}</span>
                  ))}
                </div>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-[0.8rem] text-slate-500">
                  <Shield className="h-3.5 w-3.5 text-emerald-600" /> 256-bit SSL · processed by Instamojo
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ==================================================== phone pay bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-10px_30px_-12px_rgb(15_23_42/0.25)] backdrop-blur lg:hidden"
           style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.8rem] font-semibold text-slate-500">{selectedPlan.name}</p>
            <p className="text-[1.35rem] font-black leading-tight text-[#1c2e68]">{fmt(selectedPlan.price)}</p>
          </div>
          <button
            type="button"
            onClick={handlePayment}
            disabled={processing}
            className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl px-6 text-[1rem] font-bold text-white
                       shadow-[0_10px_24px_-10px_rgb(37_99_235/0.8)] active:scale-95 disabled:opacity-60"
            style={{ backgroundImage: 'linear-gradient(135deg, #1c2e68 0%, #2563eb 100%)' }}
          >
            {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-4 w-4" />} Pay now
          </button>
        </div>
      </div>
    </MemberPageShell>
  );
}
