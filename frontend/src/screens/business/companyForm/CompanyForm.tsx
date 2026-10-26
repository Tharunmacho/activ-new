import { useAppTheme, useThemeStyles } from '../../../ui/AppTheme';
import type { AppTheme } from '../../../ui/AppTheme';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { Notice, BottomActionBar, SPACE, BrandScrollPage, BrandTopBar, PREMIUM_OVERLAP, FadeInUp, PremiumSection, PremiumInput, PremiumStepper, GradientButton, PressableScale } from '../../../ui';
import api from '../../../services/api';
import { resolveMediaUrl } from '../../../config/api.config';
import { getCompany, errorMessage } from '../../../services/businessApi';
import { useActiveCompanyStore } from '../../../stores/activeCompanyStore';
import {
  BUSINESS_TYPES, CONSTITUTION_TYPES, TURNOVER_RANGES, TURNOVER_MANUAL, GOVT_REGISTRATIONS,
  REGISTRATION_HINTS, GOVT_SCHEMES, ITR_YEARS_EXPECTED, normalizeBusinessType, toChoice, toBool,
  parseYears, checkMobile,
} from './companyOptions';
import { ProductCategory } from './nicCodes';
import {
  Label, SubHeading, ChipChoice, ChipMulti, YesNo, CheckTile,
  YearsPicker, CategoryPicker, CouncilPicker, pickImage, PickedImage,
} from './controls';
import { BizStatePage, CoverHero } from '../businessKit';

/**
 * ============================================================================
 * THE COMPANY FORM — one implementation for Add, Edit and the first-company
 * Business Profile screen, like the website's `pages/business/CompanyForm.tsx`.
 * ============================================================================
 *
 *   POST /business-profiles        create   (multipart when a logo/cover is picked)
 *   PUT  /business-profiles/:id    update   (same)
 *   GET  /business-profiles/:id    load for edit (owner-scoped, carries panNumber)
 *
 * The payload is the website's `buildPayload()` field for field. Every clearable
 * field is ALWAYS sent — an absent key means "untouched" to the server, so a
 * field the member emptied would otherwise silently keep its old value.
 *
 * Multipart rules (every part is a string): arrays go as JSON, Booleans as
 * "true"/"false"; `logo` and `banner` are file parts sent only when re-picked.
 * JSON otherwise. An unanswered yes/no is left OUT (Mongoose cannot cast '').
 *
 * Required: name, type, mobile, city — and three ITR years once "filed ITR" is
 * yes. Everything else is optional; a malformed mobile is still an error.
 */

interface CompanyFields {
  businessName: string;
  description: string;
  businessType: string;
  mobileNumber: string;
  email: string;
  area: string;
  location: string;
  constitutionType: string;
  businessActivities: string;
  productCategories: ProductCategory[];
  numberOfEmployees: string;
  memberOfOtherChamber: string;
  otherChamber: string;
  panNumber: string;
  gstNumber: string;
  filedITR: string;
  itrYears: string;
  turnoverRange: string;
  turnoverOther: string;
  govtRegistrations: string[];
  msmeUdyamNumber: string;
  nsicRegistrationNumber: string;
  exportCouncilName: string;
  exportCouncilRegNumber: string;
  otherRegistrationDetails: string;
  govtSchemes: string[];
  schemeDetails: string;
}

const EMPTY: CompanyFields = {
  businessName: '', description: '', businessType: '', mobileNumber: '', email: '', area: '', location: '',
  constitutionType: '', businessActivities: '', productCategories: [], numberOfEmployees: '',
  memberOfOtherChamber: '', otherChamber: '', panNumber: '', gstNumber: '', filedITR: '', itrYears: '',
  turnoverRange: '', turnoverOther: '', govtRegistrations: [], msmeUdyamNumber: '', nsicRegistrationNumber: '',
  exportCouncilName: '', exportCouncilRegNumber: '', otherRegistrationDetails: '', govtSchemes: [], schemeDetails: '',
};

type Errors = Partial<Record<'businessName' | 'businessType' | 'mobileNumber' | 'location' | 'itrYears', string>>;

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : []);

const fromCompany = (d: any): CompanyFields => ({
  businessName: str(d?.businessName),
  description: str(d?.description),
  businessType: normalizeBusinessType(d?.businessType),
  mobileNumber: str(d?.mobileNumber),
  email: str(d?.email),
  area: str(d?.area),
  location: str(d?.location),
  constitutionType: str(d?.constitutionType),
  businessActivities: str(d?.businessActivities),
  productCategories: (Array.isArray(d?.productCategories) ? d.productCategories : [])
    .map((e: any) => ({ code: str(e?.code), description: str(e?.description), industryType: str(e?.industryType) }))
    .filter((e: ProductCategory) => !!e.description),
  numberOfEmployees: str(d?.numberOfEmployees),
  memberOfOtherChamber: toChoice(d?.memberOfOtherChamber),
  otherChamber: str(d?.otherChamber),
  panNumber: str(d?.panNumber),
  gstNumber: str(d?.gstNumber),
  filedITR: toChoice(d?.filedITR),
  itrYears: str(d?.itrYears),
  turnoverRange: str(d?.turnoverRange),
  turnoverOther: str(d?.turnoverOther),
  govtRegistrations: strList(d?.govtRegistrations),
  msmeUdyamNumber: str(d?.msmeUdyamNumber),
  nsicRegistrationNumber: str(d?.nsicRegistrationNumber),
  exportCouncilName: str(d?.exportCouncilName),
  exportCouncilRegNumber: str(d?.exportCouncilRegNumber),
  otherRegistrationDetails: str(d?.otherRegistrationDetails),
  govtSchemes: strList(d?.govtSchemes),
  schemeDetails: str(d?.schemeDetails),
});

/** The website's buildPayload(), verbatim in behaviour. */
const buildPayload = (f: CompanyFields): Record<string, unknown> => {
  const has = (body: string) => (f.govtRegistrations || []).includes(body);
  const t = (v: string) => (v || '').trim();
  const payload: Record<string, unknown> = {
    businessName: t(f.businessName),
    description: t(f.description),
    businessType: f.businessType,
    mobileNumber: t(f.mobileNumber),
    email: t(f.email),
    area: t(f.area),
    location: t(f.location),
    constitutionType: f.constitutionType,
    businessActivities: t(f.businessActivities),
    productCategories: f.productCategories || [],
    numberOfEmployees: t(f.numberOfEmployees),
    otherChamber: t(f.otherChamber),
    panNumber: t(f.panNumber),
    gstNumber: t(f.gstNumber),
    turnoverRange: f.turnoverRange,
    turnoverOther: f.turnoverRange === TURNOVER_MANUAL ? t(f.turnoverOther) : '',
    govtRegistrations: f.govtRegistrations || [],
    msmeUdyamNumber: has('MSME / Udyam') ? t(f.msmeUdyamNumber) : '',
    nsicRegistrationNumber: has('NSIC') ? t(f.nsicRegistrationNumber) : '',
    exportCouncilName: has('Export Councils') ? t(f.exportCouncilName) : '',
    exportCouncilRegNumber: has('Export Councils') ? t(f.exportCouncilRegNumber) : '',
    otherRegistrationDetails: has('Other') ? t(f.otherRegistrationDetails) : '',
    govtSchemes: f.govtSchemes || [],
    schemeDetails: (f.govtSchemes || []).includes('Others') ? t(f.schemeDetails) : '',
  };
  const chamber = toBool(f.memberOfOtherChamber);
  if (chamber !== undefined) payload.memberOfOtherChamber = chamber;
  const itr = toBool(f.filedITR);
  if (itr !== undefined) payload.filedITR = itr;
  payload.itrYears = f.filedITR === 'yes' ? t(f.itrYears) : '';
  return payload;
};

export interface CompanyFormProps {
  /** The company being edited; absent means this form creates one. */
  companyId?: string;
  title: string;
  subtitle?: string;
  createLabel?: string;
  /** Values to start a NEW company with (e.g. the member's own mobile/email). */
  prefill?: Partial<Pick<CompanyFields, 'mobileNumber' | 'email'>>;
  onBack: () => void;
  /** Called after the server confirms the save; the store is already refreshed. */
  onSaved: (company: any, mode: 'create' | 'update') => void;
}

export default function CompanyForm({ companyId, title, subtitle, createLabel = 'Create company', prefill, onBack, onSaved }: CompanyFormProps) {
  const { palette: PALETTE } = useAppTheme();
  const styles = useThemeStyles(makeStyles);
  const isEdit = !!companyId;
  const loadCompanies = useActiveCompanyStore((st) => st.loadCompanies);

  const [form, setForm] = useState<CompanyFields>(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [logo, setLogo] = useState<PickedImage>(null);
  const [banner, setBanner] = useState<PickedImage>(null);
  const [savedLogo, setSavedLogo] = useState('');
  const [savedBanner, setSavedBanner] = useState('');
  const [step, setStep] = useState(1);
  /*
   * NEW COMPANY: every section must be OPENED before it can be created.
   * Fields without a star stay optional, but a company created from the
   * identity section alone was the common case — people filled four boxes and
   * left. `furthest` is the furthest section reached; Create appears only on
   * the last one. Editing an existing company saves from any section.
   */
  const [furthest, setFurthest] = useState(1);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setLoadError('');
    try {
      const d = await getCompany(companyId);
      if (!d) throw new Error('This company could not be found.');
      setForm(fromCompany(d));
      setSavedLogo(str(d?.logo));
      setSavedBanner(str(d?.banner));
    } catch (err: any) {
      setLoadError(err?.response ? errorMessage(err, 'Could not load this company.') : String(err?.message || 'Could not load this company.'));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  // A new company starts with the member's own contact details, if given —
  // only into fields still empty, never over something already typed.
  const prefillMobile = prefill?.mobileNumber || '';
  const prefillEmail = prefill?.email || '';
  useEffect(() => {
    if (isEdit || (!prefillMobile && !prefillEmail)) return;
    setForm((f) => ({
      ...f,
      mobileNumber: f.mobileNumber || prefillMobile,
      email: f.email || prefillEmail,
    }));
  }, [isEdit, prefillMobile, prefillEmail]);

  const set = <K extends keyof CompanyFields>(key: K, value: CompanyFields[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  };
  // One section at a time; moving between them returns to the top of the page.
  const goStep = (n: number) => {
    let next = Math.max(1, Math.min(4, Math.round(Number(n || 1))));
    // A new company: back freely, forward one section at a time.
    if (!isEdit && next > furthest + 1) next = furthest + 1;
    setStep(next);
    setFurthest((f) => Math.max(f, next));
    try { scrollRef.current?.scrollTo({ y: 0, animated: true }); } catch (err) { console.warn('Scroll safely caught:', err); }
  };

  /* NSIC implies MSME / Udyam, and holds it on (website CompanyForm). */
  const msmeLocked = (form.govtRegistrations || []).includes('NSIC');
  const toggleRegistration = (body: string) =>
    setForm((prev) => {
      const list = prev.govtRegistrations || [];
      const has = list.includes(body);
      if (body === 'MSME / Udyam' && has && list.includes('NSIC')) return prev;
      let next = has ? list.filter((v) => v !== body) : [...list, body];
      if (body === 'NSIC' && !has && !next.includes('MSME / Udyam')) next = [...next, 'MSME / Udyam'];
      return {
        ...prev,
        govtRegistrations: next,
        msmeUdyamNumber: next.includes('MSME / Udyam') ? prev.msmeUdyamNumber : '',
        nsicRegistrationNumber: next.includes('NSIC') ? prev.nsicRegistrationNumber : '',
      };
    });

  /* "None" is exclusive. */
  const toggleScheme = (scheme: string) =>
    setForm((prev) => {
      const list = prev.govtSchemes || [];
      const on = list.includes(scheme);
      if (scheme === 'None') return { ...prev, govtSchemes: on ? [] : ['None'], schemeDetails: '' };
      const next = on ? list.filter((x) => x !== scheme) : [...list.filter((x) => x !== 'None'), scheme];
      return { ...prev, govtSchemes: next };
    });

  const registered = (body: string) => (form.govtRegistrations || []).includes(body);

  const summary = useMemo(() => {
    const requiredDone = [form.businessName, form.businessType, form.mobileNumber, form.location].filter((v) => (v || '').trim()).length;
    const business = [form.constitutionType, form.numberOfEmployees, form.businessActivities, form.description]
      .filter((v) => (v || '').trim()).length + ((form.productCategories || []).length ? 1 : 0) + (form.memberOfOtherChamber ? 1 : 0);
    const financial = [form.panNumber, form.gstNumber, form.filedITR, form.turnoverRange].filter((v) => (v || '').trim()).length;
    const government = (form.govtRegistrations || []).length + (form.govtSchemes || []).length;
    return { requiredDone, business, financial, government };
  }, [form]);

  const validate = (): boolean => {
    const e: Errors = {};
    if (!(form.businessName || '').trim()) e.businessName = 'Business name is required';
    if (!form.businessType) e.businessType = 'Business type is required';
    if (!(form.mobileNumber || '').trim()) e.mobileNumber = 'Mobile number is required';
    if (!(form.location || '').trim()) e.location = 'City / location is required';
    if (!e.mobileNumber) {
      const phone = checkMobile(form.mobileNumber, 'Mobile number');
      if (phone) e.mobileNumber = phone;
    }
    if (form.filedITR === 'yes') {
      const years = parseYears(form.itrYears);
      if (years.length < ITR_YEARS_EXPECTED) {
        e.itrYears = years.length === 0
          ? 'Pick the three financial years returns were filed for'
          : `Pick 3 financial years — ${ITR_YEARS_EXPECTED - years.length} more to go`;
      }
    }
    setErrors(e);
    const first = Object.values(e).find(Boolean);
    if (first) {
      if (e.businessName || e.businessType || e.mobileNumber || e.location) goStep(1);
      else if (e.itrYears) goStep(3);
      Alert.alert('Check the form', first);
      return false;
    }
    return true;
  };

  /** Leaving Identity on a new company: its four starred answers first. */
  const identityProblem = (): string => {
    if (!(form.businessName || '').trim()) return 'Business name is required';
    if (!form.businessType) return 'Business type is required';
    if (!(form.mobileNumber || '').trim()) return 'Mobile number is required';
    if (!(form.location || '').trim()) return 'City / location is required';
    return checkMobile(form.mobileNumber, 'Mobile number') || '';
  };

  const forward = () => {
    if (!isEdit && step === 1) {
      const problem = identityProblem();
      if (problem) {
        validate();
        return;
      }
    }
    goStep(step + 1);
  };

  const lastStep = step >= STEP_LABELS.length;
  const canCreate = isEdit || (lastStep && furthest >= STEP_LABELS.length);

  const submit = async () => {
    if (!canCreate) { forward(); return; }
    if (saving || !validate()) return;
    setSaving(true);
    try {
      const payload = buildPayload(form);
      const url = isEdit ? `/business-profiles/${encodeURIComponent(companyId || '')}` : '/business-profiles';
      let res: any;
      if (logo?.uri || banner?.uri) {
        const body = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          if (Array.isArray(value)) body.append(key, JSON.stringify(value));
          else body.append(key, value === null || value === undefined ? '' : String(value));
        });
        if (logo?.uri) body.append('logo', { uri: logo.uri, type: logo.type, name: logo.name } as any);
        if (banner?.uri) body.append('banner', { uri: banner.uri, type: banner.type, name: banner.name } as any);
        const headers = { 'Content-Type': 'multipart/form-data' };
        res = isEdit ? await api.put(url, body, { headers }) : await api.post(url, body, { headers });
      } else {
        res = isEdit ? await api.put(url, payload) : await api.post(url, payload);
      }
      const ok = res?.data?.success !== false;
      if (!ok) throw new Error(res?.data?.message || `Failed to ${isEdit ? 'update' : 'create'} the company`);
      const saved = res?.data?.data || res?.data || {};
      try { await loadCompanies({ force: true }); } catch (err) { console.warn('Company refresh safely caught:', err); }
      onSaved(saved, isEdit ? 'update' : 'create');
    } catch (err: any) {
      Alert.alert('Not saved', err?.response
        ? errorMessage(err, `Failed to ${isEdit ? 'update' : 'create'} the company.`)
        : String(err?.message || 'Something went wrong. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <BizStatePage title={title} eyebrow="Company profile" onBack={onBack} rows={4} />;
  }
  if (loadError) {
    return <BizStatePage title={title} eyebrow="Company profile" onBack={onBack} error={loadError} onRetry={load} />;
  }

  const logoUri = logo?.uri || (savedLogo ? resolveMediaUrl(savedLogo) : '');
  const bannerUri = banner?.uri || (savedBanner ? resolveMediaUrl(savedBanner) : '');

  const header = (
    <View style={styles.headerPad}>
      <BrandTopBar onBack={onBack} title={title} />
      <FadeInUp delay={60} distance={12} style={{ marginTop: SPACE.md }}>
        <CoverHero
          banner={bannerUri}
          logo={logoUri}
          name={(form.businessName || '').trim() || (isEdit ? 'Your company' : 'Your new company')}
          subtitle={isEdit ? (form.businessType || subtitle || 'Edit the details below') : (subtitle || 'Register your company')}
          pickHint="Tap the cover or the logo to change it · logo up to 2 MB, cover up to 4 MB"
          onPickBanner={() => pickImage(4 * 1024 * 1024, 'cover image', setBanner)}
          onPickLogo={() => pickImage(2 * 1024 * 1024, 'logo', setLogo)}
        />
      </FadeInUp>
      <FadeInUp delay={160} distance={8}>
        {/* The four sections as a stepper; tap a step to jump straight to it. */}
        <View style={styles.stepperWrap}>
          <PremiumStepper tone="business" step={step} labels={STEP_LABELS} />
          <View style={styles.stepTaps}>
            {STEP_LABELS.map((label, i) => (
              <Pressable
                key={label}
                style={styles.stepTap}
                onPress={() => goStep(i + 1)}
                accessibilityRole="button"
                accessibilityLabel={`Go to ${STEP_TITLES[i]}`}
                accessibilityState={{ selected: step === i + 1 }}
              />
            ))}
          </View>
        </View>
      </FadeInUp>
    </View>
  );

  const footer = (
    <BottomActionBar note={isEdit
      ? `Section ${step} of ${STEP_LABELS.length} · save from any section`
      : lastStep
        ? 'All four sections done. Fields without a star could be left blank.'
        : `Section ${step} of ${STEP_LABELS.length} · go through every section to create the company. Fields without a star can be left blank.`}
    >
      <StepNav icon="chevron-left" label="Previous section" disabled={step <= 1 || saving} onPress={() => goStep(step - 1)} />
      <GradientButton tone="business"
        label={isEdit ? 'Update company' : canCreate ? createLabel : `Next: ${STEP_TITLES[step] || ''}`}
        icon={canCreate ? 'check' : 'arrow-forward'}
        onPress={canCreate ? submit : forward}
        loading={saving}
        style={{ flex: 1 }}
      />
      <StepNav icon="chevron-right" label="Next section" disabled={lastStep || saving} onPress={forward} />
    </BottomActionBar>
  );

  return (
    <BrandScrollPage tone="business" header={header} footer={footer} scrollRef={scrollRef} waveHeight={60}>
      <FadeInUp key={step} delay={40} style={styles.overlap}>
        {step === 1 ? (
          /* ------------------------------------------------ 1. identity & contact */
          <PremiumSection tone="business"
            icon={summary.requiredDone === 4 ? 'check' : 'badge'}
            title="Identity & contact"
            subtitle={`${summary.requiredDone} of 4 required answered`}
          >
            <PremiumInput tone="business" label="Business name" required value={form.businessName} onChangeText={(v) => set('businessName', v)} placeholder="Enter business name" icon="storefront" error={errors.businessName} />
            <Label text="Type of business" required />
            <ChipChoice options={BUSINESS_TYPES} value={form.businessType} onChange={(v) => set('businessType', v)} required error={errors.businessType} />
            <PremiumInput tone="business" label="Mobile number" required value={form.mobileNumber} onChangeText={(v) => set('mobileNumber', v)} placeholder="10-digit mobile number" keyboardType="phone-pad" icon="phone" error={errors.mobileNumber} hint="How other members reach this company" />
            <PremiumInput tone="business" label="Email address" value={form.email} onChangeText={(v) => set('email', v)} placeholder="Enter email address" keyboardType="email-address" autoCapitalize="none" icon="mail-outline" />
            <PremiumInput tone="business" label="City / location" required value={form.location} onChangeText={(v) => set('location', v)} placeholder="City, State" icon="location-city" error={errors.location} />
            <PremiumInput tone="business" label="Area / locality" value={form.area} onChangeText={(v) => set('area', v)} placeholder="e.g. Guindy Industrial Estate" icon="place" style={{ marginBottom: 0 }} />
          </PremiumSection>
        ) : step === 2 ? (
          /* ------------------------------------------------ 2. business */
          <PremiumSection tone="business"
            icon="business-center"
            title="Business details"
            subtitle={summary.business ? `${summary.business} answered` : 'Constitution, activities, categories'}
          >
            <Label text="Constitution of company" />
            <ChipChoice options={CONSTITUTION_TYPES} value={form.constitutionType} onChange={(v) => set('constitutionType', v)} />
            <PremiumInput tone="business" label="Number of employees" value={form.numberOfEmployees} onChangeText={(v) => set('numberOfEmployees', v)} placeholder="e.g. 25" keyboardType="number-pad" icon="groups" />
            <PremiumInput tone="business" label="Business activities" value={form.businessActivities} onChangeText={(v) => set('businessActivities', v)} placeholder="e.g. Precision machining of automotive components" multiline hint="What the company actually makes, sells or provides" />
            <PremiumInput tone="business" label="Description" value={form.description} onChangeText={(v) => set('description', v)} placeholder="Describe your company's offerings…" multiline hint="Shown to other members in the Discover directory" />

            <SubHeading title="Product categories" hint="Type a product or service name — or a NIC code if you know it. Pick as many as apply." />
            <CategoryPicker value={form.productCategories} onChange={(next) => set('productCategories', next)} />

            <SubHeading title="Memberships & affiliations" />
            <Label text="Is this company a member of another chamber?" />
            <YesNo value={form.memberOfOtherChamber} onChange={(v) => { set('memberOfOtherChamber', v); if (v !== 'yes') set('otherChamber', ''); }} />
            {form.memberOfOtherChamber === 'yes' ? (
              <PremiumInput tone="business" label="Which chamber?" value={form.otherChamber} onChangeText={(v) => set('otherChamber', v)} placeholder="Name the chamber" icon="account-balance" />
            ) : null}
          </PremiumSection>
        ) : step === 3 ? (
          /* ------------------------------------------------ 3. financial */
          <PremiumSection tone="business"
            icon="account-balance-wallet"
            title="Financial information"
            subtitle={summary.financial ? `${summary.financial} of 4 answered` : 'PAN, GSTIN, returns, turnover'}
          >
            <Notice kind="info" icon="lock-outline" text="Tax identifiers are kept private — never shown in the ACTIV Network." style={styles.inlineNotice} />
            <PremiumInput tone="business" label="PAN number" value={form.panNumber} onChangeText={(v) => set('panNumber', (v || '').toUpperCase())} placeholder="ABCDE1234F" autoCapitalize="characters" icon="credit-card" />
            <PremiumInput tone="business" label="GSTIN number" value={form.gstNumber} onChangeText={(v) => set('gstNumber', (v || '').toUpperCase())} placeholder="22AAAAA0000A1Z5" autoCapitalize="characters" icon="receipt-long" />

            <SubHeading title="Income tax" />
            <Label text="Has this company filed Income Tax Returns?" />
            <YesNo value={form.filedITR} onChange={(v) => { set('filedITR', v); setErrors((e) => ({ ...e, itrYears: undefined })); }} />
            {form.filedITR === 'yes' ? (
              <>
                <Label text="Years filed" hint="Pick the three financial years returns were filed for." />
                <YearsPicker value={form.itrYears} onChange={(v) => set('itrYears', v)} />
                {errors.itrYears ? (
                  <View style={styles.errorRow}>
                    <Icon name="error-outline" size={14} color={PALETTE.red} />
                    <Text style={styles.error}>{errors.itrYears}</Text>
                  </View>
                ) : null}
              </>
            ) : null}

            <SubHeading title="Annual turnover" hint="Pick the slab this company falls in, or enter the figure yourself." />
            <ChipChoice options={TURNOVER_RANGES} value={form.turnoverRange} onChange={(v) => set('turnoverRange', v)} />
            {form.turnoverRange === TURNOVER_MANUAL ? (
              <PremiumInput tone="business" label="Turnover figure" value={form.turnoverOther} onChangeText={(v) => set('turnoverOther', v)} placeholder="Enter the annual turnover" icon="currency-rupee" hint="In rupees, as you would write it — e.g. 7,50,00,000 or 7.5 crore" />
            ) : null}
          </PremiumSection>
        ) : (
          /* ------------------------------------------------ 4. government */
          <PremiumSection tone="business"
            icon="verified"
            title="Government registrations"
            subtitle={summary.government ? `${summary.government} selected` : 'Registrations and schemes availed'}
          >
            <Label text="Registered with government" hint="Tick every body that applies — a company is routinely registered with more than one." />
            {GOVT_REGISTRATIONS.map((body) => (
              <CheckTile
                key={body}
                label={body}
                description={REGISTRATION_HINTS[body]}
                checked={registered(body)}
                onPress={() => toggleRegistration(body)}
                lockedNote={body === 'MSME / Udyam' && msmeLocked ? 'Included with NSIC — NSIC registers MSMEs' : undefined}
              />
            ))}

            {registered('MSME / Udyam') ? (
              <PremiumInput tone="business" label="Udyam registration number" value={form.msmeUdyamNumber} onChangeText={(v) => set('msmeUdyamNumber', (v || '').toUpperCase())} placeholder="UDYAM-XX-00-0000000" autoCapitalize="characters" hint="Issued by the Ministry of MSME." icon="badge" style={{ marginTop: SPACE.sm }} />
            ) : null}
            {registered('NSIC') ? (
              <PremiumInput tone="business" label="NSIC registration number" value={form.nsicRegistrationNumber} onChangeText={(v) => set('nsicRegistrationNumber', (v || '').toUpperCase())} placeholder="NSIC / SPRS number" autoCapitalize="characters" hint="The Single Point Registration (SPRS) number NSIC issued." icon="badge" />
            ) : null}
            {registered('Export Councils') ? (
              <>
                <Label text="Export council" hint="The body that issued your RCMC — DGFT Appendix 2T." />
                <CouncilPicker value={form.exportCouncilName} onChange={(v) => set('exportCouncilName', v)} />
                <PremiumInput tone="business" label="Council registration / RCMC number" value={form.exportCouncilRegNumber} onChangeText={(v) => set('exportCouncilRegNumber', (v || '').toUpperCase())} placeholder="Membership / RCMC number" autoCapitalize="characters" icon="public" />
              </>
            ) : null}
            {registered('Other') ? (
              <PremiumInput tone="business" label="Other registration details" value={form.otherRegistrationDetails} onChangeText={(v) => set('otherRegistrationDetails', v)} placeholder="Name the body and the registration number" multiline />
            ) : null}

            <SubHeading title="Government schemes" hint="Schemes this company has availed. Select all that apply." />
            <ChipMulti options={GOVT_SCHEMES} values={form.govtSchemes} onToggle={toggleScheme} />
            {(form.govtSchemes || []).includes('Others') ? (
              <PremiumInput tone="business" label="Specify other schemes" value={form.schemeDetails} onChangeText={(v) => set('schemeDetails', v)} placeholder="Name the scheme and the benefit availed" multiline />
            ) : null}
          </PremiumSection>
        )}
      </FadeInUp>

      {/* The next section, one tap — so a long form never ends in a dead end. */}
      {step < STEP_LABELS.length ? (
        <PressableScale onPress={forward} style={styles.nextWrap} contentStyle={styles.nextCard} accessibilityRole="button" accessibilityLabel={`Next: ${STEP_TITLES[step]}`}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.nextEyebrow} maxFontSizeMultiplier={1.3}>{isEdit ? 'Next section' : `Next · section ${step + 1} of ${STEP_LABELS.length}`}</Text>
            <Text style={styles.nextTitle} maxFontSizeMultiplier={1.3}>{STEP_TITLES[step]}</Text>
          </View>
          <Icon name="arrow-forward" size={20} color={PALETTE.violet} />
        </PressableScale>
      ) : null}
    </BrandScrollPage>
  );
}

const STEP_LABELS = ['Identity', 'Business', 'Finance', 'Govt'];
const STEP_TITLES = ['Identity & contact', 'Business details', 'Financial information', 'Government registrations'];

/** A round previous / next control beside the sticky save. */
function StepNav({ icon, label, onPress, disabled }: { icon: string; label: string; onPress: () => void; disabled?: boolean }) {
  const { palette: PALETTE, premiumTone } = useAppTheme();
  const styles = useThemeStyles(makeStyles);
  const p = premiumTone('business');
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.9}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
    >
      {disabled ? (
        <View style={[styles.nav, styles.navOff]}><Icon name={icon} size={26} color={PALETTE.textFaint} /></View>
      ) : (
        <LinearGradient colors={[p.accentSoft, PALETTE.violetBorder]} style={[styles.nav, { borderColor: PALETTE.violetBorder }]}>
          <Icon name={icon} size={26} color={p.accentDark} />
        </LinearGradient>
      )}
    </PressableScale>
  );
}

const makeStyles = ({ palette: PALETTE, type: TYPE }: AppTheme) => StyleSheet.create({
  headerPad: { paddingBottom: SPACE.xs },
  stepperWrap: { marginTop: SPACE.xl, marginBottom: SPACE.lg },
  stepTaps: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  stepTap: { flex: 1 },
  overlap: { marginTop: -PREMIUM_OVERLAP },
  inlineNotice: { marginHorizontal: 0, marginTop: 0, marginBottom: SPACE.lg },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: -SPACE.xs, marginBottom: SPACE.md },
  error: { ...TYPE.caption, flex: 1, color: PALETTE.redDark },
  nav: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  navOff: { backgroundColor: PALETTE.field, borderColor: PALETTE.border },
  nextWrap: { marginHorizontal: SPACE.lg },
  nextCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.lg, borderRadius: 20,
    backgroundColor: PALETTE.violetTint, borderWidth: 1, borderColor: PALETTE.violetBorder, borderStyle: 'dashed',
  },
  nextEyebrow: { ...TYPE.eyebrow, color: PALETTE.violetDark },
  nextTitle: { ...TYPE.heading, marginTop: 2 },
});
