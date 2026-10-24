import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Alert, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { Loading, Notice, SPACE, SIZE, RADIUS, PALETTE, TYPE, Storefront3D } from '../../ui';
import { errorText } from '../../ui/data';
import { getBusinessInfo, updateProfile } from '../../services/memberApi';
import {
  FormScreen, FormFooter, FormSection, SelectField, FieldLabel, ChoicePills, k,
} from './formKit';
import { commencementYears } from './memberFormOptions';
import PlatinumApplicationCard from './PlatinumApplicationCard';
import { businessFormError } from '../../utils/applicationFormValidation';

/**
 * ============================================================================
 * STEP 2 OF 3 — BUSINESS STATUS (website: pages/member/BusinessForm.tsx)
 * ============================================================================
 *
 * Two questions and no more: do you trade, and (if so) since which year; if
 * not, aspirant or student. Organisation, constitution, activities, employees,
 * chambers and the whole Financial step moved to the Business Account, because
 * they describe a COMPANY and a member may have several.
 *
 *   GET /members/business-info
 *   PUT /members/profile  { doingBusiness: Boolean,
 *                           registrationType: 'business'|'aspirant'|'student',
 *                           businessCommencementYear? }   (omitted when not trading
 *                           — a blank would overwrite the stored year and the
 *                           price band with it)
 *
 * EVERYONE continues to the declaration. The old aspirant shortcut submitted an
 * application from here with a different declaration and nothing recorded in
 * the declaration collection.
 *
 * No price under the year: the website deliberately stopped showing one (its
 * PlanHint is kept unrendered). The band is resolved server-side at payment.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'BusinessInformationForm'> & {
  /** Website /member/profile?step=2 from the profile view: save and return. */
  editMode?: boolean;
};

const STEPS = ['Personal', 'Business', 'Declaration'];

type Choice = 'yes' | 'no' | '';
type Kind = 'aspirant' | 'student' | '';

/** Boolean, or the legacy 'yes'/'no' strings, as the control's value. */
const toChoice = (value: unknown): Choice => {
  if (value === true || value === 'yes') return 'yes';
  if (value === false || value === 'no') return 'no';
  return '';
};

const toKind = (saved: any): Kind => {
  if (String(saved?.registrationType || '').toLowerCase() === 'student') return 'student';
  if (String(saved?.registrationType || '').toLowerCase() === 'aspirant') return 'aspirant';
  return '';
};

const BusinessInformationFormScreen: React.FC<Props> = ({ navigation, route, editMode = false }) => {
  const [doingBusiness, setDoingBusiness] = useState<Choice>('');
  const [kind, setKind] = useState<Kind>('');
  const [year, setYear] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);

  const years = useMemo(() => commencementYears(), []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const saved = await getBusinessInfo();
      if (saved && typeof saved === 'object' && Object.keys(saved).length > 0) {
        setDoingBusiness(toChoice(saved?.doingBusiness));
        setKind(toKind(saved));
        const y = saved?.businessCommencementYear;
        setYear(y === undefined || y === null ? '' : String(y));
      }
    } catch (err) {
      setLoadError(errorText(err, 'Failed to load form data'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isAspirant = doingBusiness === 'no';

  const choose = (value: Choice) => {
    setDoingBusiness(value);
    // An aspirant has no commencement year — leaving one would price them into
    // a band for a business they just said they do not have.
    if (value === 'no') setYear('');
    if (value === 'yes') setKind('');
  };

  const handleNext = async () => {
    if (loading || loadError || saving) return;
    const error = businessFormError({ doingBusiness, registrationType: kind, businessCommencementYear: year });
    if (error) { Alert.alert('Required', error); return; }
    if (!doingBusiness) {
      Alert.alert('Required', 'Please select whether you are currently doing business.');
      return;
    }
    if (isAspirant && !kind) {
      Alert.alert('Required', 'Please choose whether you are an aspirant or a student.');
      return;
    }
    if (!isAspirant && !year) {
      Alert.alert('Required', 'Please select the year your business commenced.');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        doingBusiness: !isAspirant,
        registrationType: isAspirant ? (kind === 'student' ? 'student' : 'aspirant') : 'business',
      };
      if (!isAspirant) payload.businessCommencementYear = year;

      await updateProfile(payload);
      if (editMode) {
        Alert.alert('Saved', 'Business information saved.', [
          { text: 'OK', onPress: () => { if (navigation.canGoBack()) navigation.goBack(); } },
        ]);
      } else {
        navigation.navigate('DeclarationForm', { userData: route?.params?.userData || {} });
      }
    } catch (err) {
      Alert.alert('Could not save', errorText(err, 'Failed to save your business details'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <FormScreen
        title="Business Information"
        subtitle="Business status"
        onBack={() => navigation.goBack()}
        step={editMode ? undefined : 2}
        steps={STEPS}
        art={<Storefront3D size={88} />}
      >
        <Loading label="Loading…" />
      </FormScreen>
    );
  }

  return (
    <FormScreen
      title="Business Information"
      subtitle="Business status"
      onBack={() => navigation.goBack()}
      step={editMode ? undefined : 2}
      steps={STEPS}
      art={<Storefront3D size={88} />}
      footer={(
        <FormFooter
          secondaryLabel="Back"
          onSecondary={() => navigation.goBack()}
          primaryLabel={editMode ? 'Save changes' : 'Next'}
          onPrimary={handleNext}
          loading={saving}
          disabled={!!loadError}
        />
      )}
    >
      {loadError ? (
        <Notice kind="danger" text={loadError} action="Retry" onAction={load} style={{ marginTop: 0, marginBottom: SPACE.lg }} />
      ) : null}

      <FormSection icon="work-outline" title="Business status" subtitle="This decides how your application is reviewed">
        <View style={k.fieldWrap}>
          <FieldLabel label="Are you currently doing business?" required />
          <ChoicePills
            options={[
              { value: 'yes' as const, label: 'Yes', icon: 'storefront' },
              { value: 'no' as const, label: 'No', icon: 'lightbulb-outline' },
            ]}
            value={doingBusiness}
            onChange={choose}
          />
        </View>

        {isAspirant ? (
          <View style={k.fieldWrap}>
            <FieldLabel label="Which describes you?" required />
            <ChoicePills
              options={[
                { value: 'aspirant' as const, label: 'Aspirant', icon: 'trending-up' },
                { value: 'student' as const, label: 'Student', icon: 'school' },
              ]}
              value={kind}
              onChange={setKind}
            />
            <Text style={k.hint}>Aspirant — planning to start a business. Student — currently studying.</Text>
          </View>
        ) : null}

        {isAspirant && kind ? (
          <Notice
            kind="info"
            style={{ marginHorizontal: 0, marginTop: 0 }}
            text={`You are registering as ${kind === 'student' ? 'a student' : 'an aspirant'}. You will be offered the ${kind === 'student' ? 'Student' : 'Aspirant'} membership. Continue to the declaration to submit your application.`}
          />
        ) : null}
      </FormSection>

      {doingBusiness === 'yes' ? (
        <FormSection icon="event" title="Business commencement" subtitle="The year your business started trading">
          <SelectField
            label="Commencement year"
            required
            value={year}
            options={years}
            onChange={setYear}
            placeholder="Select year"
            icon="calendar-today"
          />
          <View style={s.aside}>
            <Icon name="info-outline" size={SIZE.iconSm} color={PALETTE.textMuted} style={{ marginTop: 1 }} />
            <Text style={s.asideText}>
              Everything else about your company — constitution, activities, GSTIN, turnover and
              government registrations — is asked once in your Business Account, which you can set up
              after your application is submitted.
            </Text>
          </View>
        </FormSection>
      ) : null}

      {/* Website PlatinumNotice: for anyone joining as a business, at the foot of the step. */}
      {doingBusiness !== 'no' ? (
        <PlatinumApplicationCard onApply={() => (navigation as any).navigate('PlatinumRequest')} />
      ) : null}
    </FormScreen>
  );
};

const s = StyleSheet.create({
  aside: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm,
    backgroundColor: PALETTE.fieldBg, borderRadius: RADIUS.md, padding: SPACE.md,
  },
  asideText: { ...TYPE.caption, flex: 1, lineHeight: 18 },
});

export default BusinessInformationFormScreen;
