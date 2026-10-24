import { AuthTitle } from '../auth/authKit';
import React, { useState } from 'react';
import { Alert, StyleSheet, View, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api.config';
import { clearSession, sanitizeUser } from '../../services/session';
import { takePublicAction } from '../../services/publicNavigation';
import { useAuthStore } from '../../stores/exampleStore';
import useRegionCascade from '../../hooks/useRegionCascade';
import {
  Notice, SPACE, BottomActionBar,
  PremiumScreen, PREMIUM_OVERLAP, PremiumStepper, PremiumSection, PremiumInput, PremiumSelect,
  PremiumFooter, GlassIconButton, BrandLogo, FadeInUp,
} from '../../ui';
import { errorText } from '../../ui/data';

/**
 * ============================================================================
 * REGISTRATION 2 OF 2 — LOCATION (website: pages/member/Register.tsx, step 2)
 * ============================================================================
 *
 *   POST /auth/register { fullName, email, password, phoneNumber,
 *                         whatsappNumber, state, district, block, city, place }
 *
 * Regions come from GET /regions/tree?include=all (services/regions.ts), as on
 * the website: a state staffed only by a state admin is a real choice, and
 * district and block are optional beneath it — the application still routes
 * (tierRouting walks up to the first tier with an admin). The server validates
 * to the depth given.
 *
 * Abroad (phone country not India): no region, a `place` instead.
 *
 * The previous session is forgotten first (clearSession), and the password is
 * NEVER written into stored user data — only the server's user object, passed
 * through sanitizeUser.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'RegistrationStep2'>;

const STEPS = ['Account', 'Location'];

const RegistrationStep2Screen: React.FC<Props> = ({ navigation, route }) => {
  const params = route?.params || ({} as any);
  const fullName = String(params?.fullName || '');
  const email = String(params?.email || '');
  const phoneNumber = String(params?.phoneNumber || '');
  const whatsappNumber = String(params?.whatsappNumber || phoneNumber);
  const password = String(params?.password || '');
  const countryName = String(params?.countryName || '');
  const isAbroad = !!countryName;

  const region = useRegionCascade();
  const [city, setCity] = useState('');
  const [place, setPlace] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuthStore();

  const handleSubmit = async () => {
    if (!fullName.trim() || !email.trim() || !password) {
      Alert.alert('Missing details', 'Full name, email and password are required. Please complete the account step.', [
        { text: 'Go back', onPress: () => navigation.goBack() },
      ]);
      return;
    }
    const trimmedPlace = (place || '').trim();
    if (isAbroad && !trimmedPlace) {
      setError('Please enter the place you are in — your city and country.');
      return;
    }
    // No client-side region requirement, as on the website: the server
    // (regionService.validateRegion) decides, and answers in its own words.
    setError('');
    setSubmitting(true);

    try {
      await clearSession();
      const res = await api.post(ENDPOINTS.AUTH.REGISTER, {
        fullName: fullName.trim(),
        email,
        password,
        phoneNumber,
        whatsappNumber: whatsappNumber || phoneNumber,
        state: isAbroad ? '' : region.state || '',
        district: isAbroad ? '' : region.district || '',
        block: isAbroad ? '' : region.block || '',
        city: isAbroad ? trimmedPlace : (city || '').trim(),
        place: isAbroad ? trimmedPlace : '',
      });

      const data = res?.data?.data || res?.data || {};
      const token: string = data?.token || '';
      const user = data?.user || {};
      if (!token) throw new Error(res?.data?.message || 'Registration failed. Please try again.');

      // Register returns the role on `user`. Stored WITHOUT any password.
      const role = String(user?.role || 'member');
      const stored = sanitizeUser({
        ...user,
        fullName: data?.memberDetails?.fullName || user?.fullName || fullName,
      });
      await login(stored, token, role as any);

      const resume = takePublicAction();
      navigation.reset(resume
        ? { index: 1, routes: [{ name: 'MemberMain' }, resume] }
        : { index: 0, routes: [{ name: 'MemberMain' }] });
    } catch (err: any) {
      const message = errorText(err, 'Registration failed. Please try again.');
      if (err?.response?.status === 409 || /already registered/i.test(message)) {
        // Back to the field it is about, as the website does.
        navigation.navigate('RegistrationStep1', { taken: /mobile/i.test(message) ? 'phoneNumber' : 'email' });
        return;
      }
      if (err?.response?.status === 400) region.reload();
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PremiumScreen
      waveHeight={44}
      tone="member"
      footer={(
        <BottomActionBar>
          <PremiumFooter
            secondaryLabel="Back"
            onSecondary={() => navigation.goBack()}
            primaryLabel="Complete registration"
            primaryIcon="how-to-reg"
            onPrimary={handleSubmit}
            loading={submitting}
          />
        </BottomActionBar>
      )}
      header={(
        <View>
          <View style={s.topRow}>
            <GlassIconButton
              icon={Platform.OS === 'ios' ? 'arrow-back-ios-new' : 'arrow-back'}
              onPress={() => navigation.goBack()}
              accessibilityLabel="Go back"
            />
            <BrandLogo size="sm" />
          </View>
          <View style={s.heroRow}>
            <FadeInUp delay={60} style={s.heroText}>
              <AuthTitle
                eyebrow="Member registration"
                title="Your location"
                subtitle="Profile details — optional. You can finish this later from your dashboard."
              />
            </FadeInUp>
          </View>
          <FadeInUp delay={200} distance={10}>
            <PremiumStepper step={2} labels={STEPS} style={s.stepper} />
          </FadeInUp>
        </View>
      )}
    >
      <FadeInUp delay={240} style={s.overlap}>
        {isAbroad ? (
          <PremiumSection icon="place" title="Your place" subtitle="Shown on your certificate and dashboard">
            {error ? <Notice kind="danger" text={error} style={s.notice} /> : null}
            <Notice
              kind="info"
              icon="public"
              style={s.notice}
              text={`You are registering from ${countryName}. State, district and block are not needed — your application goes straight to the ACTIV head office for approval.`}
            />
            <PremiumInput
              label="Place"
              required
              value={place}
              onChangeText={(v) => { setPlace(v); setError(''); }}
              placeholder={`Your city, ${countryName}`}
              icon="location-city"
              editable={!submitting}
              style={{ marginBottom: 0 }}
            />
          </PremiumSection>
        ) : (
          <PremiumSection icon="map" title="Region" subtitle="Routes your application to the admins for your area">
            {error ? <Notice kind="danger" text={error} style={s.notice} /> : null}
            {region.error ? (
              <Notice kind="danger" text={region.error} action="Retry" onAction={region.reload} style={s.notice} />
            ) : null}
            {region.noCoverage ? (
              <Notice
                kind="warning"
                style={s.notice}
                text="Location data is unavailable. Please retry loading regions."
              />
            ) : null}
            <PremiumSelect
              label="State"
              icon="map"
              iconBadge
              value={region.state}
              options={(region.states || []).map((n) => n?.name || '').filter(Boolean)}
              onChange={(v) => { region.setState(v); setError(''); }}
              placeholder={region.loading ? 'Loading regions…' : 'Select state'}
              disabled={submitting || region.loading}
            />
            <PremiumSelect
              label="District"
              icon="apartment"
              iconBadge
              value={region.district}
              options={(region.districts || []).map((n) => n?.name || '').filter(Boolean)}
              onChange={region.setDistrict}
              placeholder={region.state ? 'Select district' : 'Please select state first'}
              disabled={submitting || !region.state}
              emptyText="No districts listed for this state yet"
            />
            <PremiumSelect
              label="Block"
              icon="holiday-village"
              iconBadge
              value={region.block}
              options={(region.blocks || []).map((n) => n?.name || '').filter(Boolean)}
              onChange={region.setBlock}
              placeholder={region.district ? (region.refreshing ? 'Loading blocks...' : !region.blocks.length ? 'No development blocks ? district only' : 'Select block') : 'Please select district first'}
              disabled={submitting || !region.district || region.refreshing || !region.blocks.length}
              emptyText="No development blocks listed; your district is sufficient"
            />
            <PremiumInput
              label="City"
              value={city}
              onChangeText={setCity}
              placeholder="Enter city name"
              icon="location-city"
              editable={!submitting}
              style={{ marginBottom: 0 }}
            />
          </PremiumSection>
        )}
      </FadeInUp>
    </PremiumScreen>
  );
};

const s = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroRow: { marginTop: SPACE.lg },
  heroText: { minWidth: 0 },
  stepper: { marginTop: SPACE.lg, marginBottom: SPACE.md },
  overlap: { marginTop: -PREMIUM_OVERLAP },
  // Inside a section the Notice drops its own gutter and keeps the field rhythm.
  notice: { marginHorizontal: 0, marginTop: 0, marginBottom: SPACE.lg },
});

export default RegistrationStep2Screen;
