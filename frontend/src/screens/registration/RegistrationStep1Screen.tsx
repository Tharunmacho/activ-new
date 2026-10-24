import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api.config';
import {
  PALETTE, SIZE, SPACE, TYPE, BottomActionBar,
  PremiumScreen, PREMIUM_OVERLAP, PremiumStepper, PremiumSection, PremiumInput, PremiumSelect,
  PremiumFooter, PremiumLabel, GlassIconButton, BrandLogo, FadeInUp, flagEmoji,
} from '../../ui';
import { AuthTitle } from '../auth/authKit';
import { FieldMessage, CheckRow, EyeToggle } from '../profile/formKit';
import { DIAL_COUNTRIES, INDIA, DialCountry, countryLabel, checkPhone, checkLooseNumber } from './phone';

/**
 * ============================================================================
 * REGISTRATION 1 OF 2 — ACCOUNT (website: pages/member/Register.tsx, step 1)
 * ============================================================================
 *
 * Full name, phone (with its country), WhatsApp (ticked "same as phone" by
 * default), email, password. Before moving on:
 *
 *   POST /auth/check-availability { email, phoneNumber }  -> { email, phoneNumber }
 *
 * so "already registered" lands under the field it is about. A failed check
 * does not block — the server re-checks on register.
 *
 * A phone country other than India makes this a member ABROAD: step 2 then
 * asks for a place instead of a state/district/block. The server decides the
 * same thing from the stored '+<code>' number, so this only decides what the
 * form asks.
 *
 * Arriving from Google / Facebook / LinkedIn with no account yet, the verified
 * email and name are carried in as route params and prefilled.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'RegistrationStep1'>;

const STEPS = ['Account', 'Location'];

/** The picker's labels, and each label's ISO code for its flag — built once. */
const COUNTRY_LABELS = DIAL_COUNTRIES.map(countryLabel);
const ISO_BY_LABEL: Record<string, string> = DIAL_COUNTRIES.reduce((acc, c) => {
  acc[countryLabel(c)] = c?.iso2 || '';
  return acc;
}, {} as Record<string, string>);

type Errors = Partial<Record<'fullName' | 'phone' | 'whatsapp' | 'email' | 'password' | 'confirm', string>>;

const TAKEN_EMAIL = 'This email is already registered. Please sign in instead.';
const TAKEN_PHONE = 'This mobile number is already registered. Please sign in instead.';

const RegistrationStep1Screen: React.FC<Props> = ({ navigation, route }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState<DialCountry>(INDIA);
  const [phone, setPhone] = useState('');
  const [sameWhatsapp, setSameWhatsapp] = useState(true);
  const [whatsapp, setWhatsapp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [checking, setChecking] = useState(false);

  // Prefill from a social sign-in with no account yet.
  const prefillEmail = route?.params?.email || '';
  const prefillName = route?.params?.name || '';
  useEffect(() => {
    if (prefillEmail) setEmail(prefillEmail);
    if (prefillName) setFullName(prefillName);
  }, [prefillEmail, prefillName]);

  // Sent back from step 2 because the server found a duplicate.
  const taken = route?.params?.taken || '';
  useEffect(() => {
    if (taken === 'email') setErrors((prev) => ({ ...prev, email: TAKEN_EMAIL }));
    if (taken === 'phoneNumber') setErrors((prev) => ({ ...prev, phone: TAKEN_PHONE }));
  }, [taken]);

  const clear = (field: keyof Errors) => setErrors((prev) => ({ ...prev, [field]: '' }));

  const handleNext = async () => {
    if (checking) return;
    const next: Errors = {};
    // The website's react-hook-form rules and messages, exactly.
    const cleanName = (fullName || '').trim();
    if (!cleanName) next.fullName = 'Full name required';
    const cleanTyped = (email || '').trim();
    if (!cleanTyped) next.email = 'Email required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanTyped)) next.email = 'Invalid email';
    if (!password) next.password = 'Password required';
    else if (password.length < 6) next.password = 'At least 6 characters';
    if (confirm && confirm !== password) next.confirm = 'Passwords do not match';

    const phoneCheck = checkPhone(phone, country, 'Phone number');
    if (!phoneCheck.ok) next.phone = phoneCheck.reason;
    const whatsappCheck = sameWhatsapp ? phoneCheck : checkLooseNumber(whatsapp, 'WhatsApp number');
    if (!sameWhatsapp && !whatsappCheck.ok) next.whatsapp = whatsappCheck.reason;

    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    const cleanEmail = (email || '').toLowerCase().trim();
    setChecking(true);
    try {
      const res = await api.post(ENDPOINTS.AUTH.CHECK_AVAILABILITY, {
        email: cleanEmail,
        phoneNumber: phoneCheck.stored,
      });
      const result = res?.data?.data || res?.data || {};
      if (result?.email || result?.phoneNumber) {
        setErrors((prev) => ({
          ...prev,
          email: result?.email ? TAKEN_EMAIL : prev.email,
          phone: result?.phoneNumber ? TAKEN_PHONE : prev.phone,
        }));
        return;
      }
    } catch {
      /* unknown — the server checks again on register */
    } finally {
      setChecking(false);
    }

    navigation.navigate('RegistrationStep2', {
      fullName: cleanName,
      email: cleanEmail,
      phoneNumber: phoneCheck.stored,
      whatsappNumber: whatsappCheck.ok ? whatsappCheck.stored : phoneCheck.stored,
      password,
      countryName: country?.iso2 === INDIA.iso2 ? '' : country?.name || '',
    });
  };

  return (
    <PremiumScreen
      waveHeight={44}
      tone="member"
      footer={(
        <BottomActionBar>
          <PremiumFooter primaryLabel={checking ? 'Checking…' : 'Next'} onPrimary={handleNext} loading={checking} />
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
                title="Create your account"
                subtitle="Start with your name, contact details and a secure password."
              />
            </FadeInUp>
          </View>
          <FadeInUp delay={200} distance={10}>
            <PremiumStepper step={1} labels={STEPS} style={s.stepper} />
          </FadeInUp>
        </View>
      )}
    >
      <FadeInUp delay={240} style={s.overlap}>
        <PremiumSection icon="person-add" title="About you" subtitle="Your name and how we reach you">
          <PremiumInput
            label="Full name"
            required
            value={fullName}
            onChangeText={(value) => { setFullName(value); clear('fullName'); }}
            placeholder="Enter your full name"
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            icon="person-outline"
            error={errors.fullName}
            editable={!checking}
          />

          <PremiumSelect
            label="Phone country"
            icon="public"
            value={countryLabel(country)}
            options={COUNTRY_LABELS}
            optionEmoji={(label) => flagEmoji(ISO_BY_LABEL[label])}
            onChange={(label) => {
              const hit = DIAL_COUNTRIES.find((c) => countryLabel(c) === label);
              setCountry(hit || INDIA);
              clear('phone');
            }}
          />
          <PremiumInput
            label="Phone number"
            required
            value={phone}
            onChangeText={(v) => { setPhone(v); clear('phone'); }}
            placeholder={country?.dial === '91' ? '10-digit mobile number' : 'Mobile number'}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            maxLength={country?.dial === '91' ? 10 : 16}
            error={errors.phone}
            editable={!checking}
            icon="phone"
            prefix={`${flagEmoji(country?.iso2)} +${country?.dial || ''}`}
          />

          <View>
            <PremiumLabel label="WhatsApp number" required />
            <CheckRow checked={sameWhatsapp} onToggle={() => { setSameWhatsapp((v) => !v); clear('whatsapp'); }}>
              Same as my phone number
            </CheckRow>
            {sameWhatsapp ? null : (
              <PremiumInput
                value={whatsapp}
                onChangeText={(v) => { setWhatsapp(v); clear('whatsapp'); }}
                placeholder={`+${country?.dial || '91'} XXXXXXXXXX`}
                keyboardType="phone-pad"
                error={errors.whatsapp}
                icon="chat"
                accessibilityLabel="WhatsApp number"
                style={{ marginTop: SPACE.xs, marginBottom: 0 }}
              />
            )}
            <FieldMessage hint="Application updates are sent here on WhatsApp." />
          </View>
        </PremiumSection>
      </FadeInUp>

      <FadeInUp delay={320}>
        <PremiumSection icon="lock-outline" title="Sign-in details" subtitle="This is what you will sign in with">
          <PremiumInput
            label="Email address"
            required
            value={email}
            onChangeText={(v) => { setEmail(v); clear('email'); }}
            placeholder="your.email@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            error={errors.email}
            editable={!checking}
            icon="mail-outline"
          />
          <PremiumInput
            label="Password"
            required
            value={password}
            onChangeText={(v) => { setPassword(v); clear('password'); }}
            placeholder="At least 6 characters"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            error={errors.password}
            editable={!checking}
            icon="lock-outline"
            right={<EyeToggle shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
          />
          <PremiumInput
            label="Confirm password"
            value={confirm}
            onChangeText={(v) => { setConfirm(v); clear('confirm'); }}
            placeholder="Re-enter password"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.confirm}
            editable={!checking}
            icon="lock-outline"
            style={{ marginBottom: 0 }}
          />
        </PremiumSection>
      </FadeInUp>

      <View style={s.footerRow}>
        <Text style={s.prompt} maxFontSizeMultiplier={1.3}>Already have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Login')} accessibilityRole="link" style={s.linkHit}>
          <Text style={s.link} maxFontSizeMultiplier={1.3}>Sign in</Text>
        </TouchableOpacity>
      </View>
    </PremiumScreen>
  );
};

const s = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroRow: { marginTop: SPACE.lg },
  heroText: { minWidth: 0 },
  stepper: { marginTop: SPACE.lg, marginBottom: SPACE.md },
  overlap: { marginTop: -PREMIUM_OVERLAP },
  footerRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', marginHorizontal: SPACE.lg },
  prompt: { ...TYPE.body, color: PALETTE.textMuted },
  linkHit: { minHeight: SIZE.touch, justifyContent: 'center', paddingHorizontal: SPACE.xs },
  link: { ...TYPE.bodyStrong, color: PALETTE.blue, fontWeight: '700' },
});

export default RegistrationStep1Screen;
