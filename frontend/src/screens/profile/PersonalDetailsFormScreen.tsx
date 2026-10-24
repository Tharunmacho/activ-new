import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { PremiumInput as Field, Loading, Notice, SPACE, ProfileForm3D } from '../../ui';
import { errorText } from '../../ui/data';
import { getMyProfile, updateProfile, setFirstPassword } from '../../services/memberApi';
import { accountPasswordStatus } from '../../utils/authCapabilities';
import { getStates, getDistricts, getBlocks, fetchRegionTree, RegionNode } from '../../services/regions';
import {
  FormScreen, FormFooter, FormSection, SelectField, FieldLabel, FieldMessage, ChoicePills,
} from './formKit';
import {
  SOCIAL_CATEGORIES, GENDERS, religionsFor, normalizeReligion, normalizeSocialCategory, normalizeGender,
} from './memberFormOptions';
import { personalDetailsErrors } from './personalDetailsValidation';
import { validateMobile } from '../registration/phone';
import { countryFromDial } from '../registration/countryCodes';

/**
 * ============================================================================
 * STEP 1 OF 3 — PERSONAL DETAILS (website: pages/member/PersonalForm.tsx)
 * ============================================================================
 *
 *   GET /members/my-profile   the saved answers, `isLocked`, `isInternational`,
 *                             `country`, `place`
 *   PUT /members/profile      { fullName, phoneNumber, email, state, district,
 *                               block, city, place, socialCategory, religion,
 *                               gender }  — the website's exact body
 *
 * Social accounts can choose their first password through /auth/set-password.
 * Credentials stay out of the profile payload and navigation state.
 *
 * A member outside India (decided by the SERVER from their number) gives a
 * place instead of a state/district/block; the region is not sent at all.
 *
 * Errors are shown, never swallowed: the region gate's message names the
 * region, and moving on after a failed save is how a member arrives at the
 * declaration with nothing stored.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'PersonalDetailsForm'> & {
  /**
   * EDIT MODE — the website's /member/profile?step=1 reached from the profile
   * view: same fields, same PUT, but it saves and returns instead of walking on
   * to step 2.
   */
  editMode?: boolean;
  /** Rendered above the first section (edit mode puts the photo here). */
  topSlot?: React.ReactNode;
};

const STEPS = ['Personal', 'Business', 'Declaration'];

/** A page-level Notice already sits on the gutter; here it only needs the section rhythm. */
const NOTICE = { marginTop: 0, marginBottom: SPACE.lg };

interface FormState {
  fullName: string;
  phoneNumber: string;
  email: string;
  state: string;
  district: string;
  block: string;
  city: string;
  place: string;
  socialCategory: string;
  religion: string;
  gender: string;
}

const EMPTY: FormState = {
  fullName: '',
  phoneNumber: '',
  email: '',
  state: '',
  district: '',
  block: '',
  city: '',
  place: '',
  socialCategory: '',
  religion: '',
  gender: '',
};

const names = (nodes: RegionNode[]) => (nodes || []).map((n) => n?.name || '').filter(Boolean);

/** Keep the saved value visible even when it is no longer listed. */
const withCurrent = (list: string[], current?: string | null) => {
  const value = String(current || '').trim();
  if (!value) return list;
  return (list || []).some((item) => (item || '').toLowerCase() === value.toLowerCase()) ? list : [value, ...(list || [])];
};

const PersonalDetailsFormScreen: React.FC<Props> = ({ navigation, route, editMode = false, topSlot }) => {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [canSetPassword, setCanSetPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [isLocked, setIsLocked] = useState(false);
  const [storedAbroad, setStoredAbroad] = useState(false);
  const [storedCountry, setStoredCountry] = useState('');
  const [needsFirstPhone, setNeedsFirstPhone] = useState(false);
  const firstPhone = needsFirstPhone ? validateMobile(form.phoneNumber) : null;
  const firstPhoneCountry = firstPhone?.ok && firstPhone.stored.startsWith('+') ? countryFromDial(firstPhone.stored) : undefined;
  const firstPhoneAbroad = !!firstPhoneCountry && firstPhoneCountry.iso2 !== 'IN';
  const isAbroad = storedAbroad || firstPhoneAbroad;
  const abroadCountry = storedCountry || (firstPhoneAbroad ? firstPhoneCountry?.name || '' : '');

  const [states, setStates] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<string[]>([]);
  const [regionError, setRegionError] = useState('');
  /** Bumped by "Try again"; also bumped when the tree lands so districts/blocks re-read it. */
  const [regionAttempt, setRegionAttempt] = useState(0);
  const [regionVersion, setRegionVersion] = useState(0);
  /** False when no region on the platform is staffed at all (website `coverageAvailable`). */
  const [coverageAvailable, setCoverageAvailable] = useState(true);

  /* ---------------------------------------------------------------- load */

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const profile = await getMyProfile();
      if (!profile || (!profile.fullName && !profile.email)) throw new Error('Could not load your saved details. Please try again.');
      const seed = route?.params?.userData || {};
      setForm({
        fullName: String(profile?.fullName || seed?.fullName || ''),
        phoneNumber: String(profile?.phoneNumber || seed?.phoneNumber || ''),
        email: String(profile?.email || seed?.email || ''),
        state: String(profile?.state || ''),
        district: String(profile?.district || ''),
        block: String(profile?.block || ''),
        city: String(profile?.city || ''),
        place: String(profile?.place || profile?.city || ''),
        socialCategory: normalizeSocialCategory(profile?.socialCategory),
        religion: normalizeReligion(profile?.religion),
        gender: normalizeGender(profile?.gender),
      });
      setIsLocked(profile?.isLocked === true && profile?.personalDetailsComplete !== false
        && Object.keys(personalDetailsErrors(profile)).length === 0);
      setStoredAbroad(profile?.isInternational === true);
      setStoredCountry(String(profile?.country || ''));
      setNeedsFirstPhone(!String(profile?.phoneNumber || '').trim());
      setCanSetPassword(accountPasswordStatus(profile) === 'not_set');
      setPassword(''); setConfirmPassword(''); setPasswordError('');
    } catch (err) {
      setLoadError(errorText(err, 'Could not load your details.'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* ---------------------------------------------------------------- regions */

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    setRegionError('');
    // A dropped connection (or a dev-machine hiccup) should not strand the
    // form: try three times, backing off, before asking the member to retry.
    const attempt = (tries: number) => {
      getStates(regionAttempt > 0 || tries > 0)
        .then((nodes) => {
          if (cancelled) return;
          setStates(names(nodes));
          setRegionVersion((v) => v + 1);
        })
        .catch(() => {
          if (cancelled) return;
          if (tries < 2) {
            timer = setTimeout(() => attempt(tries + 1), 1500 * (tries + 1));
          } else {
            setRegionError('Could not load regions. Check your connection and try again.');
          }
        });
    };
    attempt(0);
    fetchRegionTree(false, 'all')
      .then((tree) => { if (!cancelled) setCoverageAvailable(tree?.coverageAvailable !== false); })
      .catch(() => { /* a failed read is not "no coverage" */ });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [regionAttempt]);

  useEffect(() => {
    let cancelled = false;
    if (!form.state) {
      setDistricts([]);
      return undefined;
    }
    getDistricts(form.state)
      .then((nodes) => { if (!cancelled) setDistricts(withCurrent(names(nodes), form.district)); })
      .catch(() => { if (!cancelled) setDistricts(withCurrent([], form.district)); });
    return () => { cancelled = true; };
  }, [form.state, form.district, regionVersion]);

  useEffect(() => {
    let cancelled = false;
    if (!form.state || !form.district) {
      setBlocks([]);
      return undefined;
    }
    getBlocks(form.state, form.district)
      .then((nodes) => { if (!cancelled) setBlocks(withCurrent(names(nodes), form.block)); })
      .catch(() => { if (!cancelled) setBlocks(withCurrent([], form.block)); });
    return () => { cancelled = true; };
  }, [form.state, form.district, form.block, regionVersion]);

  /* ---------------------------------------------------------------- edits */

  /** Parents clear children; a category change clears an incompatible religion. */
  const setField = (field: keyof FormState, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value || '' };
      if (field === 'state') {
        next.district = '';
        next.block = '';
      } else if (field === 'district') {
        next.block = '';
      } else if (field === 'socialCategory') {
        if (next.religion && !religionsFor(value).includes(next.religion)) next.religion = '';
      }
      return next;
    });
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const allowedReligions = useMemo(() => religionsFor(form.socialCategory), [form.socialCategory]);

  const goNext = () => {
    navigation.navigate('BusinessInformationForm', {
      userData: { email: form.email, fullName: form.fullName, phoneNumber: form.phoneNumber },
    });
  };

  const validate = (): boolean => {
    const next = personalDetailsErrors(form, { international: isAbroad, blockRequired: blocks.length > 0 });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const finishEdit = () => {
    if (navigation.canGoBack()) navigation.goBack();
  };

  const handleNext = async () => {
    if (loading || loadError || saving) return;
    // Locked by the server once submitted: nothing to save, but the member can
    // still walk on to the next step instead of meeting a dead button.
    if (isLocked) {
      if (editMode) finishEdit(); else goNext();
      return;
    }
    if (!validate()) {
      Alert.alert('Missing details', 'Please fill in all required fields.');
      return;
    }
    setPasswordError('');
    if (canSetPassword && (password || confirmPassword)) {
      if (password.length < 8) { setPasswordError('Use at least 8 characters for your password.'); return; }
      if (password !== confirmPassword) { setPasswordError('New password and confirm password do not match.'); return; }
    }

    setSaving(true);
    try {
      if (canSetPassword && password) {
        await setFirstPassword(password, confirmPassword);
        setCanSetPassword(false); setPassword(''); setConfirmPassword('');
      }
      const place = (form.place || '').trim();
      await updateProfile(
        isAbroad
          ? { ...form, state: undefined, district: undefined, block: undefined, city: place, place }
          : { ...form },
      );
      if (editMode) {
        Alert.alert('Saved', 'Personal information saved.', [{ text: 'OK', onPress: finishEdit }]);
      } else {
        goNext();
      }
    } catch (err) {
      Alert.alert('Could not save', errorText(err, 'Failed to save your details'));
    } finally {
      setSaving(false);
    }
  };

  /* ---------------------------------------------------------------- render */

  if (loading) {
    return (
      <FormScreen
        title={editMode ? 'Personal details' : 'Complete Your Profile'}
        subtitle={editMode ? 'Edit your profile' : 'Personal details'}
        onBack={() => navigation.goBack()}
        step={editMode ? undefined : 1}
        steps={STEPS}
        art={<ProfileForm3D size={88} />}
      >
        <Loading label="Loading your details…" />
      </FormScreen>
    );
  }

  return (
    <FormScreen
      title={editMode ? 'Personal details' : 'Complete Your Profile'}
      subtitle={editMode ? 'Edit your profile' : 'Personal details'}
      onBack={() => navigation.goBack()}
      step={editMode ? undefined : 1}
      steps={STEPS}
      art={<ProfileForm3D size={88} />}
      footer={(
        <FormFooter
          primaryLabel={isLocked ? (editMode ? 'Done' : 'Continue') : (editMode ? 'Save changes' : 'Save & continue')}
          onPrimary={handleNext}
          loading={saving}
          disabled={loading || !!loadError}
        />
      )}
    >
      {/* The slot's content (edit mode: the photo card) lands on the gutter. */}
      {topSlot ? <View style={{ marginHorizontal: SPACE.lg }}>{topSlot}</View> : null}

      {loadError ? (
        <Notice kind="danger" text={loadError} action="Retry" onAction={load} style={NOTICE} />
      ) : null}
      {isLocked ? (
        <Notice
          kind="info"
          icon="lock-outline"
          style={NOTICE}
          text={editMode
            ? 'Your personal details were submitted and are locked.'
            : 'Your personal details were submitted and are locked. Continue to the next step.'}
        />
      ) : null}
      {!isAbroad && !coverageAvailable ? (
        <Notice
          kind="warning"
          style={NOTICE}
          text="Location data is unavailable. Retry loading regions."
        />
      ) : null}

      <FormSection
        icon="location-on"
        title="Location"
        subtitle="Where you are based"
      >
        {isAbroad ? (
          <Field
            label="Place"
            required
            value={form.place}
            onChangeText={(v) => setField('place', v)}
            placeholder={abroadCountry ? `Your city, ${abroadCountry}` : 'Your city and country'}
            error={errors.place}
            hint={`You are registered from ${abroadCountry || 'outside India'} — no state, district or block is needed.`}
            editable={!isLocked}
            icon="public"
            style={{ marginBottom: 0 }}
          />
        ) : (
          <>
            {regionError ? (
              <Notice
                kind="danger"
                text={regionError}
                action="Try again"
                onAction={() => setRegionAttempt((n) => n + 1)}
                style={NOTICE}
              />
            ) : null}
            <SelectField
              label="State"
              required
              value={form.state}
              options={withCurrent(states, form.state)}
              onChange={(v) => setField('state', v)}
              placeholder="Select state"
              icon="map"
              iconBadge
              error={errors.state}
              disabled={isLocked}
              emptyText="No regions are open yet"
            />
            <SelectField
              label="District"
              required
              value={form.district}
              options={districts}
              onChange={(v) => setField('district', v)}
              placeholder={form.state ? 'Select district' : 'Choose a state first'}
              icon="apartment"
              iconBadge
              error={errors.district}
              disabled={isLocked || !form.state}
            />
            <SelectField
              label="Block"
              required={blocks.length > 0}
              value={form.block}
              options={blocks}
              onChange={(v) => setField('block', v)}
              placeholder={form.district ? (blocks.length ? 'Select block' : 'No development blocks ? district only') : 'Choose a district first'}
              icon="holiday-village"
              iconBadge
              error={errors.block}
              disabled={isLocked || !form.district || !blocks.length}
            />
            <Field
              label="City"
              required
              value={form.city}
              onChangeText={(v) => setField('city', v)}
              placeholder="Enter city name"
              error={errors.city}
              editable={!isLocked}
              icon="place"
              style={{ marginBottom: 0 }}
            />
          </>
        )}
      </FormSection>

      <FormSection icon="contact-phone" title="Contact" subtitle="We will use this to reach you">
        <Field
          label="Full name"
          required
          value={form.fullName}
          onChangeText={(v) => setField('fullName', v)}
          placeholder="Enter full name"
          autoCapitalize="words"
          error={errors.fullName}
          editable={!isLocked}
          icon="person-outline"
        />
        <Field
          label="Phone number"
          required
          value={form.phoneNumber}
          onChangeText={(v) => setField('phoneNumber', v)}
          placeholder={needsFirstPhone ? 'Mobile number with country code' : 'Enter phone number'}
          keyboardType="phone-pad"
          maxLength={20}
          error={errors.phoneNumber}
          editable={!isLocked}
          icon="phone"
        />
        <Field
          label="Email address"
          required
          value={form.email}
          onChangeText={(v) => setField('email', v)}
          placeholder="Enter email address"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          error={errors.email}
          editable={!isLocked}
          icon="mail-outline"
          style={{ marginBottom: 0 }}
        />
      </FormSection>

      {canSetPassword && !isLocked && <FormSection icon="lock-outline" title="Set your ACTIV password"
        subtitle="Use your email and this password next time. Social sign-in will keep working. Leave both blank to use social sign-in only.">
        <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry
          autoCapitalize="none" autoCorrect={false} textContentType="newPassword" autoComplete="new-password"
          editable={!saving} placeholder="At least 8 characters" icon="lock-outline" />
        <Field label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry
          autoCapitalize="none" autoCorrect={false} textContentType="newPassword" autoComplete="new-password"
          editable={!saving} placeholder="Enter the same password again" error={passwordError} icon="lock-outline" />
      </FormSection>}

      <FormSection icon="groups" title="Personal background" subtitle="All three answers are required for your application">
        <SelectField
          label="Social category"
          required
          value={form.socialCategory}
          options={SOCIAL_CATEGORIES}
          onChange={(v) => setField('socialCategory', v)}
          placeholder="Select social category"
          icon="diversity-3"
          error={errors.socialCategory}
          disabled={isLocked}
        />
        <SelectField
          label="Religion"
          required
          value={form.religion}
          options={allowedReligions}
          onChange={(v) => setField('religion', v)}
          placeholder={form.socialCategory ? 'Select religion' : 'Choose a social category first'}
          icon="self-improvement"
          error={errors.religion}
          disabled={isLocked || !form.socialCategory}
        />
        <View>
          <FieldLabel label="Gender" required />
          <ChoicePills
            options={(GENDERS as readonly string[]).map((g) => ({ value: g, label: g }))}
            value={form.gender}
            onChange={(v) => setField('gender', v)}
            disabled={isLocked}
          />
          <FieldMessage error={errors.gender} />
        </View>
      </FormSection>
    </FormScreen>
  );
};

export default PersonalDetailsFormScreen;
