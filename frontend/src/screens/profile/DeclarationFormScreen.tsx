import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { PremiumInput as Field, Loading, Notice, PALETTE, SIZE, SPACE, TYPE, Declaration3D, PressableScale } from '../../ui';
import { errorText } from '../../ui/data';
import {
  getMyProfile, getBusinessInfo, getFinancialInfo, getDeclarationInfo, updateProfile, getMyApplications,
} from '../../services/memberApi';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api.config';
import { FormScreen, FormFooter, FormSection, FieldLabel, CheckRow } from './formKit';
import { normaliseStatus } from '../member/dashboard/memberRules';
import { personalDetailsErrors } from './personalDetailsValidation';
import { businessFormError, declarationFormError } from '../../utils/applicationFormValidation';

/**
 * ============================================================================
 * STEP 3 OF 3 — DECLARATION & SUBMIT (website: pages/member/DeclarationForm.tsx)
 * ============================================================================
 *
 *   1. PUT /members/profile { sisterConcerns: Number, companyNames: string[],
 *                             agreeToDeclaration }   (0 / [] for a non-business
 *                             applicant, who is never shown the question)
 *   2. read BACK from the server — my-profile, business-info, financial-info,
 *      declaration-info — so the application carries what was stored, not
 *      whatever this screen remembers
 *   3. region guard (India only): no state/district/block → back to step 1
 *   4. POST /applications { applicationType: 'membership', fullName, email,
 *      phone, state, district, block, registrationType, memberType,
 *      data: { personalDetails, businessInfo, financialInfo, declaration } }
 *   5. keep the server's own _id (never an invented one)
 *
 * The admin review screens read `data.*`; a flat body arrives as a blank file.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'DeclarationForm'> & {
  /** Website /member/profile?step=3 from the profile view: save and return. */
  editMode?: boolean;
};

/**
 * Approved members save profile changes without a second application. Pending
 * applicants can submit corrected forms to the same pending file; rejected
 * applicants may submit a new complete application.
 */
const hasApplied = (apps: any, profile: any) =>
  (Array.isArray(apps) && apps.some((a: any) => normaliseStatus(a?.status) === 'Approved'))
  || String(profile?.membershipStatus || '').toLowerCase() === 'active';

const STEPS = ['Personal', 'Business', 'Declaration'];

/** Where the submitted application's server id is kept (the website's `applicationId`). */
export const APPLICATION_ID_KEY = '@activ_application_id';

const DECLARATION_POINTS = [
  'All the information provided by me is true and correct to the best of my knowledge.',
  'I understand that any false information may lead to rejection of my application.',
  'I agree to abide by the rules and regulations of the organization.',
  'I authorize the organization to verify the information provided.',
];

const isNonBusiness = (business: any) =>
  business?.doingBusiness === false
  || business?.doingBusiness === 'no'
  || business?.registrationType === 'aspirant'
  || business?.registrationType === 'student';

const DeclarationFormScreen: React.FC<Props> = ({ navigation, editMode = false }) => {
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [sisterConcerns, setSisterConcerns] = useState('');
  const [companies, setCompanies] = useState<string[]>(['']);
  const [agree, setAgree] = useState(false);
  /** null until read — the business-only card shows only on an explicit true. */
  const [isBusinessApplicant, setIsBusinessApplicant] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [saved, business, apps, me] = await Promise.all([
        getDeclarationInfo(),
        getBusinessInfo(),
        getMyApplications(),
        getMyProfile(),
      ]);
      const businessError = businessFormError(business);
      if (businessError) { setLoadError(businessError); return; }
      setIsBusinessApplicant(business.doingBusiness === true || business.doingBusiness === 'yes');
      setAlreadyApplied(hasApplied(apps, me));
      if (saved && typeof saved === 'object') {
        const count = saved?.sisterConcerns;
        setSisterConcerns(count === undefined || count === null ? '' : String(count));
        const list = Array.isArray(saved?.companyNames)
          ? (saved.companyNames as any[]).map((c) => String(c || '')).filter((c) => c.trim())
          : typeof saved?.companyNames === 'string'
            ? String(saved.companyNames).split(',').map((c) => c.trim()).filter(Boolean)
            : [];
        setCompanies(list.length ? list : ['']);
        // The stored answer, so a returning applicant sees their tick.
        setAgree(saved?.agreeToDeclaration === true);
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

  const setCompany = (index: number, value: string) =>
    setCompanies((prev) => (prev || []).map((c, i) => (i === index ? value : c)));
  const addCompany = () => setCompanies((prev) => [...(prev || []), '']);
  const removeCompany = (index: number) =>
    setCompanies((prev) => {
      const next = (prev || []).filter((_, i) => i !== index);
      return next.length ? next : [''];
    });

  const handleSubmit = async () => {
    if (loading || loadError || submitting) return;
    const declarationError = declarationFormError({ sisterConcerns, companyNames: companies, agreeToDeclaration: agree }, isBusinessApplicant === true);
    if (declarationError) { Alert.alert('Declaration needed', declarationError); return; }
    if (!agree) {
      Alert.alert('Declaration required', 'Please accept the declaration to proceed.');
      return;
    }

    setSubmitting(true);
    try {
      const business = isBusinessApplicant === true;
      const companyNames = (companies || []).map((c) => (c || '').trim()).filter(Boolean);
      await updateProfile({
        sisterConcerns: business ? Number(sisterConcerns || 0) : 0,
        companyNames: business ? companyNames : [],
        agreeToDeclaration: true,
      });

      if (editMode || alreadyApplied) {
        Alert.alert('Saved', 'Your details have been updated.', [
          { text: 'OK', onPress: () => { if (navigation.canGoBack()) navigation.goBack(); } },
        ]);
        return;
      }

      const [profile, businessInfo, financial, declaration] = await Promise.all([
        getMyProfile(),
        getBusinessInfo(),
        getFinancialInfo().catch(() => ({} as any)),
        getDeclarationInfo(),
      ]);
      const sectionError = businessFormError(businessInfo) || declarationFormError(declaration, businessInfo.doingBusiness === true || businessInfo.doingBusiness === 'yes');
      if (sectionError) { Alert.alert('Complete your forms', sectionError); return; }

      // The region gate refuses an application with no routable region. A
      // member outside India has none by design and routes to the head office.
      if (profile?.personalDetailsComplete === false || Object.keys(personalDetailsErrors(profile)).length > 0) {
        Alert.alert(
          'Personal details needed',
          'Please complete every required personal detail, including religion, social category and gender, before submitting.',
          [
            { text: 'Open personal details', onPress: () => navigation.navigate('PersonalDetailsForm', { userData: {} }) },
            { text: 'Cancel', style: 'cancel' },
          ],
        );
        return;
      }

      const isStudent = String(businessInfo?.registrationType || '').toLowerCase() === 'student';
      const isAspirant = isNonBusiness(businessInfo) || isStudent;
      const applicantKind = isStudent ? 'student' : isAspirant ? 'aspirant' : 'business';

      const res = await api.post(ENDPOINTS.APPLICATIONS.CREATE, {
        applicationType: 'membership',
        fullName: profile?.fullName || '',
        email: profile?.email || '',
        phone: profile?.phoneNumber || '',
        state: profile?.state,
        district: profile?.district,
        block: profile?.block,
        registrationType: applicantKind,
        memberType: applicantKind,
        data: {
          personalDetails: {
            fullName: profile?.fullName || '',
            email: profile?.email || '',
            phone: profile?.phoneNumber || '',
            phoneNumber: profile?.phoneNumber || '',
            state: profile?.state,
            district: profile?.district,
            block: profile?.block,
            city: profile?.city || '',
            place: profile?.place || '',
            socialCategory: profile?.socialCategory || '',
            religion: profile?.religion || '',
            gender: profile?.gender || '',
          },
          businessInfo: businessInfo || {},
          financialInfo: financial || {},
          declaration: declaration || { sisterConcerns, companyNames, agreeToDeclaration: true },
        },
      });

      const application = res?.data?.data || res?.data || {};
      const applicationId = String(application?._id || application?.id || '');
      if (applicationId) {
        try {
          await AsyncStorage.setItem(APPLICATION_ID_KEY, applicationId);
        } catch (e) {
          console.warn('Storing application id safely caught:', e);
        }
      }

      navigation.reset({ index: 0, routes: [{ name: 'ApplicationSubmitted' }] });
    } catch (err) {
      Alert.alert('Could not submit', errorText(err, 'Failed to submit your application'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <FormScreen
        title="Declaration"
        subtitle="Final step"
        onBack={() => navigation.goBack()}
        step={editMode ? undefined : 3}
        steps={STEPS}
        art={<Declaration3D size={88} />}
      >
        <Loading label="Loading…" />
      </FormScreen>
    );
  }

  const showCompanies = Number(sisterConcerns || 0) > 0;

  return (
    <FormScreen
      title="Declaration"
      subtitle="Final step"
      onBack={() => navigation.goBack()}
      step={editMode ? undefined : 3}
      steps={STEPS}
      art={<Declaration3D size={88} />}
      footerNote={agree ? undefined : 'Tick the declaration below to continue.'}
      footer={(
        <FormFooter
          secondaryLabel="Back"
          onSecondary={() => navigation.goBack()}
          primaryLabel={editMode || alreadyApplied ? 'Save changes' : 'Submit application'}
          primaryIcon={editMode || alreadyApplied ? 'check' : 'send'}
          onPrimary={handleSubmit}
          loading={submitting}
          disabled={!!loadError || !agree}
        />
      )}
    >
      {alreadyApplied && !editMode ? (
        <Notice
          kind="info"
          style={s.notice}
          text="Your application is approved. Saving here updates your declaration without lodging a new application."
        />
      ) : null}

      {loadError ? (
        <Notice kind="danger" text={loadError} action="Retry" onAction={load} style={s.notice} />
      ) : null}

      {isBusinessApplicant === true ? (
        <FormSection icon="business-center" title="Sister concerns & firms" subtitle="Other businesses under the same ownership">
          <Field
            label="Number of sister concerns"
            value={sisterConcerns}
            onChangeText={(v) => setSisterConcerns((v || '').replace(/[^0-9]/g, ''))}
            placeholder="Enter number (0 if none)"
            keyboardType="number-pad"
            maxLength={3}
            icon="numbers"
            style={showCompanies ? undefined : { marginBottom: 0 }}
          />
          {showCompanies ? (
            <View>
              <FieldLabel label="Company names" required />
              {(companies || []).map((value, index) => (
                <View key={`company-${index}`} style={s.companyRow}>
                  <Field
                    style={{ flex: 1, marginBottom: 0 }}
                    value={value}
                    onChangeText={(v) => setCompany(index, v)}
                    placeholder={`Company ${index + 1}`}
                    icon="business"
                    accessibilityLabel={`Company ${index + 1}`}
                  />
                  {(companies || []).length > 1 ? (
                    <TouchableOpacity
                      style={s.remove}
                      onPress={() => removeCompany(index)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove company ${index + 1}`}
                    >
                      <Icon name="delete-outline" size={SIZE.icon} color={PALETTE.red} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
              <PressableScale onPress={addCompany} scaleTo={0.97} contentStyle={s.add} accessibilityRole="button" accessibilityLabel="Add another company">
                <Icon name="add-circle-outline" size={SIZE.icon} color={PALETTE.blue} />
                <Text style={s.addText}>Add another company</Text>
              </PressableScale>
            </View>
          ) : null}
        </FormSection>
      ) : null}

      <FormSection icon="gavel" title="Member declaration" subtitle="Read and accept before submitting">
        <View style={s.terms}>
          <Text style={s.termsTitle}>I hereby declare that:</Text>
          {DECLARATION_POINTS.map((point, i) => (
            <View key={point} style={s.point}>
              <View style={s.num}><Text style={s.numText} maxFontSizeMultiplier={1}>{i + 1}</Text></View>
              <Text style={s.pointText}>{point}</Text>
            </View>
          ))}
        </View>
        <CheckRow checked={agree} onToggle={() => setAgree((v) => !v)}>
          <Text style={s.agreeText}>
            I have read and agree to the above declaration. I understand that this submission is final
            and any false information may result in termination of membership.
            <Text style={{ color: PALETTE.red }}> *</Text>
          </Text>
        </CheckRow>
      </FormSection>
    </FormScreen>
  );
};

const s = StyleSheet.create({
  // A page-level Notice already sits on the gutter; here it only needs the section rhythm.
  notice: { marginTop: 0, marginBottom: SPACE.lg },
  companyRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.sm },
  remove: {
    width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: PALETTE.dangerSoft,
  },
  add: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, minHeight: 52,
    borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: PALETTE.blue,
    backgroundColor: PALETTE.blueTint, marginTop: SPACE.xs,
  },
  addText: { ...TYPE.bodyStrong, color: PALETTE.blue },
  terms: {
    backgroundColor: PALETTE.blueTint, borderRadius: 18, borderWidth: 1, borderColor: PALETTE.blueSoft,
    padding: SPACE.lg, marginBottom: SPACE.sm,
  },
  termsTitle: { ...TYPE.bodyStrong, marginBottom: SPACE.xs },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md, marginTop: SPACE.sm },
  num: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: PALETTE.blue,
    alignItems: 'center', justifyContent: 'center', marginTop: -1,
  },
  numText: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: PALETTE.white },
  pointText: { ...TYPE.body, flex: 1, minWidth: 0, fontSize: 13, lineHeight: 19 },
  agreeText: { ...TYPE.body },
});

export default DeclarationFormScreen;
